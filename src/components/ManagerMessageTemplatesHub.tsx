import React, { useEffect, useRef, useState } from "react";
import {
  MessageSquare,
  Plus,
  Edit3,
  Trash2,
  Check,
  X,
  AlertCircle,
  Mail,
  RotateCcw,
  Copy,
  Loader2,
  Globe,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  doc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  writeBatch,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { Hotel, MessageTemplate, WhatsAppTemplate } from "../types";
import { useAuth } from "../contexts/AuthContext";
import { useAIAssistant } from "../hooks/useAIAssistant";
import { usePlatformMode } from '../contexts/PlatformModeContext';

interface Props {
  hotel: Hotel;
  onHotelUpdate?: (updatedHotel: Hotel) => void;
}

const DEFAULT_TEMPLATES: Omit<MessageTemplate, "id" | "createdAt">[] = [
  {
    title: "Booking Confirmation (WhatsApp)",
    type: "whatsapp",
    body: "Hello! We are thrilled to confirm your upcoming stay with us. Please let us know your estimated time of arrival.",
    enabled: true,
    isCustom: false,
  },
  {
    title: "Booking Confirmation (Email)",
    type: "email",
    subject: "Your Booking Confirmation",
    body: "Dear Guest,\n\nWe are delighted to confirm your upcoming stay. Please let us know if you have any special requests or dietary requirements prior to your arrival.\n\nWarm regards,\nThe Management",
    enabled: true,
    isCustom: false,
  },
  {
    title: "Pre-Arrival Reminder (WhatsApp)",
    type: "whatsapp",
    body: "Hi there! Just a quick reminder that your stay with us begins tomorrow. Safe travels!",
    enabled: true,
    isCustom: false,
  },
  {
    title: "Post-Checkout Thank You (Email)",
    type: "email",
    subject: "Thank You for Staying With Us",
    body: "Dear Guest,\n\nThank you for choosing to stay with us. We hope you had a wonderful time. We would love to welcome you back soon!\n\nBest regards,\nThe Management",
    enabled: true,
    isCustom: false,
  },
];

function ManagerMessageTemplatesHubBody({
  hotel,
  onHotelUpdate,
}: Props) {
  const { user } = useAuth();

  // Migration from old whatsappTemplates to new messageTemplates
  const initialTemplates =
    hotel.messageTemplates ||
    (hotel.whatsappTemplates || []).map((t) => ({
      id: t.id,
      type: "whatsapp" as const,
      title: t.title,
      body: t.body,
      enabled: true,
      isCustom: true,
      createdAt: t.createdAt,
    }));

  const [templates, setTemplates] = useState<MessageTemplate[]>(
    initialTemplates.length > 0
      ? initialTemplates
      : DEFAULT_TEMPLATES.map((t) => ({
          ...t,
          id: Math.random().toString(36).substr(2, 9),
          createdAt: Date.now(),
        })),
  );

  const [editingId, setEditingId] = useState<string | null>(null);
  const [type, setType] = useState<"whatsapp" | "email">("whatsapp");
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const [isGenerating, setIsGenerating] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [showAIPrompt, setShowAIPrompt] = useState(false);
  const [activeListTab, setActiveListTab] = useState<"whatsapp" | "email">("whatsapp");

  const [applyingToAll, setApplyingToAll] = useState(false);

  // Switching property keeps this component mounted; without a reset the next
  // save would write the previous property's templates onto the new one.
  const loadedHotelId = useRef(hotel.id);
  useEffect(() => {
    if (loadedHotelId.current === hotel.id) return;
    loadedHotelId.current = hotel.id;
    const fromHotel = hotel.messageTemplates ||
      (hotel.whatsappTemplates || []).map((t) => ({
        id: t.id,
        type: "whatsapp" as const,
        title: t.title,
        body: t.body,
        enabled: true,
        isCustom: true,
        createdAt: t.createdAt,
      }));
    setTemplates(fromHotel.length > 0
      ? fromHotel
      : DEFAULT_TEMPLATES.map((t) => ({
          ...t,
          id: Math.random().toString(36).substr(2, 9),
          createdAt: Date.now(),
        })));
    resetForm();
  }, [hotel.id]);

  const saveTemplatesToDb = async (newTemplates: MessageTemplate[]) => {
    await updateDoc(doc(db, "hotels", hotel.id!), {
      messageTemplates: newTemplates,
    });
    setTemplates(newTemplates);
    if (onHotelUpdate) {
      onHotelUpdate({ ...hotel, messageTemplates: newTemplates });
    }
  };

  const saveTemplate = async () => {
    if (!title.trim() || !body.trim()) {
      toast.error("Title and body are required");
      return;
    }
    if (type === "email" && !subject.trim()) {
      toast.error("Email templates require a subject line");
      return;
    }

    try {
      let newTemplates = [...templates];
      if (editingId && editingId !== "new") {
        newTemplates = newTemplates.map((t) =>
          t.id === editingId
            ? { ...t, type, title, subject, body, isCustom: true }
            : t,
        );
      } else {
        newTemplates.push({
          id: Math.random().toString(36).substr(2, 9),
          type,
          title,
          subject,
          body,
          enabled: true,
          isCustom: true,
          createdAt: Date.now(),
        });
      }

      await saveTemplatesToDb(newTemplates);
      toast.success(
        editingId === "new" ? "Template created" : "Template updated",
      );
      setEditingId(null);
      resetForm();
    } catch (error) {
      console.error("Error saving template:", error);
      toast.error("Failed to save template");
    }
  };

  const toggleEnabled = async (id: string, currentEnabled: boolean) => {
    try {
      const newTemplates = templates.map((t) =>
        t.id === id ? { ...t, enabled: !currentEnabled } : t,
      );
      await saveTemplatesToDb(newTemplates);
      toast.success(currentEnabled ? "Template disabled" : "Template enabled");
    } catch (error) {
      console.error(error);
      toast.error("Failed to toggle template");
    }
  };

  const deleteTemplate = async (id: string) => {
    if (!confirm("Are you sure you want to delete this template?")) return;
    try {
      const newTemplates = templates.filter((t) => t.id !== id);
      await saveTemplatesToDb(newTemplates);
      toast.success("Template deleted");
    } catch (error) {
      console.error("Error deleting template:", error);
      toast.error("Failed to delete template");
    }
  };

  const startEdit = (t: MessageTemplate) => {
    setEditingId(t.id);
    setType(t.type);
    setTitle(t.title);
    setSubject(t.subject || "");
    setBody(t.body);
    setShowAIPrompt(false);
  };

  const resetForm = () => {
    setEditingId(null);
    setType("whatsapp");
    setTitle("");
    setSubject("");
    setBody("");
    setShowAIPrompt(false);
    setAiPrompt("");
  };

  const revertToDefaults = async () => {
    if (
      !confirm(
        "This will replace all your current templates with the system defaults. Are you sure?",
      )
    )
      return;
    try {
      const newTemplates = DEFAULT_TEMPLATES.map((t) => ({
        ...t,
        id: Math.random().toString(36).substr(2, 9),
        createdAt: Date.now(),
      }));
      await saveTemplatesToDb(newTemplates);
      toast.success("Reverted to default templates");
    } catch (error) {
      console.error(error);
      toast.error("Failed to revert to defaults");
    }
  };

  const applyToAllProperties = async () => {
    if (!user) return;
    if (
      !confirm(
        "This will overwrite the templates for ALL properties you manage with these current templates. Proceed?",
      )
    )
      return;
    setApplyingToAll(true);
    try {
      // The property's own manager: an admin working on someone else's
      // property must not overwrite the admin's own listings.
      const q = query(
        collection(db, "hotels"),
        where("managerId", "==", hotel.managerId || user.uid),
      );
      const snapshot = await getDocs(q);
      const batch = writeBatch(db);
      const others = snapshot.docs.filter((docSnap) => docSnap.id !== hotel.id);

      others.forEach((docSnap) => {
        batch.update(docSnap.ref, { messageTemplates: templates });
      });

      await batch.commit();
      toast.success(
        `Applied templates to ${others.length} other ${others.length === 1 ? "property" : "properties"}`,
      );
    } catch (error) {
      console.error(error);
      toast.error("Failed to apply to all properties");
    } finally {
      setApplyingToAll(false);
    }
  };

  const { status: aiStatus, generate } = useAIAssistant();
  const isAIAvailable = Boolean(aiStatus.enabled && aiStatus.available);

  const generateWithAI = async () => {
    if (!aiPrompt.trim()) {
      toast.error("Please enter instructions for the Draft Assistant");
      return;
    }

    setIsGenerating(true);
    try {
      const text = await generate({
        action: "write_message_template",
        entityType: "hotel",
        details: {
          prompt: aiPrompt,
          property: hotel.name,
          type: type,
          instructions:
            "Keep it professional, warm, and concise. If it's an email, provide a subject line and the body separated by '|||'. Do not include extra commentary.",
        },
      });

      if (text) {
        if (type === "email") {
          const parts = text.split("|||");
          if (parts.length > 1) {
            setSubject(parts[0].trim());
            setBody(parts[1].trim());
          } else {
            setBody(text.trim());
          }
        } else {
          setBody(text.trim());
        }

        toast.success("Draft ready. Check it before saving.");
        setShowAIPrompt(false);
      } else {
        toast.error("Failed to generate draft");
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to generate draft");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="rounded-xl border border-stone-200 bg-white overflow-hidden mb-8 min-w-0">
      <div className="p-4 sm:p-5 border-b border-stone-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="tm-h2 mb-1">
            Message templates
          </h2>
          <p className="tm-muted">
            Reusable email and WhatsApp messages for guests.
          </p>
        </div>
        {!editingId && (
          <div className="tm-actions">
            <button
              onClick={() => {
                setEditingId("new");
                setType("whatsapp");
                setTitle("");
                setSubject("");
                setBody("");
              }}
              className="tm-btn tm-btn-primary"
            >
              <Plus className="w-4 h-4" />
              New template
            </button>
            <button
              onClick={applyToAllProperties}
              disabled={applyingToAll}
              className="tm-btn tm-btn-secondary"
              title="Apply these templates to all properties you manage"
            >
              <Globe className="w-4 h-4" />
              {applyingToAll ? "Applying..." : "Use on all my properties"}
            </button>
            <button
              onClick={revertToDefaults}
              className="tm-btn tm-btn-danger"
              title="Revert to system defaults"
            >
              <RotateCcw className="w-4 h-4" />
              Reset to defaults
            </button>
          </div>
        )}
      </div>

      <div className="p-4 sm:p-5">
        {editingId && (
          <div className="pb-6 mb-6 border-b border-stone-200">
            <div className="flex flex-wrap justify-between items-center gap-2 mb-4">
              <h3 className="tm-h2">
                {editingId === "new" ? "New template" : "Edit template"}
              </h3>
              {isAIAvailable && (
                <button
                  type="button"
                  onClick={() => setShowAIPrompt(!showAIPrompt)}
                  className="tm-btn tm-btn-secondary tm-btn-sm"
                >
                  {showAIPrompt ? "Hide draft help" : "Help me write it"}
                </button>
              )}
            </div>

            {isAIAvailable && showAIPrompt && (
              <div className="mb-4">
                <label className="tm-label">
                  What should it say?
                </label>
                <textarea
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="e.g. Write a friendly welcome email that reminds guests about the 2PM check-in and our free breakfast."
                  className="tm-input mb-2"
                  rows={2}
                />
                <button
                  type="button"
                  onClick={generateWithAI}
                  disabled={isGenerating}
                  className="tm-btn tm-btn-secondary w-full sm:w-auto"
                >
                  {isGenerating && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isGenerating ? "Writing draft..." : "Write a draft"}
                </button>
              </div>
            )}

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="tm-label">
                    Type
                  </label>
                  <div className="flex rounded-lg overflow-hidden border border-stone-300 bg-white">
                    <button
                      type="button"
                      onClick={() => setType("whatsapp")}
                      className={`flex-1 py-2 text-sm font-medium flex items-center justify-center gap-2 ${type === "whatsapp" ? "bg-stone-900 text-white" : "text-stone-600 hover:bg-stone-50"}`}
                    >
                      <MessageSquare className="w-4 h-4" /> WhatsApp
                    </button>
                    <button
                      type="button"
                      onClick={() => setType("email")}
                      className={`flex-1 py-2 text-sm font-medium flex items-center justify-center gap-2 ${type === "email" ? "bg-stone-900 text-white" : "text-stone-600 hover:bg-stone-50"}`}
                    >
                      <Mail className="w-4 h-4" /> Email
                    </button>
                  </div>
                </div>
                <div>
                  <label className="tm-label">
                    Template name
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Booking Confirmation"
                    className="tm-input"
                  />
                </div>
              </div>

              {type === "email" && (
                <div>
                  <label className="tm-label">
                    Email subject
                  </label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="e.g. Your stay at our property"
                    className="tm-input"
                  />
                </div>
              )}

              <div>
                <label className="tm-label">
                  Message
                </label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Type your message here..."
                  rows={6}
                  className="tm-input"
                />
              </div>

              <div className="tm-actions pt-2">
                <button
                  onClick={saveTemplate}
                  className="tm-btn tm-btn-primary"
                >
                  Save template
                </button>
                <button
                  onClick={resetForm}
                  className="tm-btn tm-btn-quiet"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="flex border-b border-stone-200 mb-2">
          <button
            onClick={() => setActiveListTab("whatsapp")}
            className={`flex-1 md:flex-none px-4 py-3 text-sm font-medium border-b-2 transition ${activeListTab === "whatsapp" ? "border-amber-700 text-stone-900" : "border-transparent text-stone-500 hover:text-stone-700"}`}
          >
            <div className="flex items-center justify-center md:justify-start gap-2">
              <MessageSquare className="w-4 h-4" /> WhatsApp
            </div>
          </button>
          <button
            onClick={() => setActiveListTab("email")}
            className={`flex-1 md:flex-none px-4 py-3 text-sm font-medium border-b-2 transition ${activeListTab === "email" ? "border-amber-700 text-stone-900" : "border-transparent text-stone-500 hover:text-stone-700"}`}
          >
            <div className="flex items-center justify-center md:justify-start gap-2">
              <Mail className="w-4 h-4" /> Email
            </div>
          </button>
        </div>

        <div className="divide-y divide-stone-100">
          {templates.filter((t) => t.type === activeListTab).map((t) => (
            <div
              key={t.id}
              className={`py-4 min-w-0 ${t.enabled ? "" : "opacity-60"}`}
            >
              <div className="flex justify-between items-start gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  {t.type === "email" ? (
                    <Mail className="w-4 h-4 text-stone-500 shrink-0" />
                  ) : (
                    <MessageSquare className="w-4 h-4 text-stone-500 shrink-0" />
                  )}
                  <h4 className="font-semibold text-stone-900 truncate">{t.title}</h4>
                  {!t.isCustom && <span className="tm-tag shrink-0">Default</span>}
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => toggleEnabled(t.id, t.enabled)}
                    className={`p-1.5 rounded-lg transition ${t.enabled ? "text-emerald-700 hover:bg-emerald-50" : "text-stone-500 hover:bg-stone-100"}`}
                    title={t.enabled ? "Turn off" : "Turn on"}
                    aria-label={t.enabled ? "Turn off" : "Turn on"}
                  >
                    {t.enabled ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <X className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    onClick={() => startEdit(t)}
                    className="p-1.5 hover:bg-stone-100 text-stone-600 rounded-lg transition"
                    title="Edit"
                    aria-label="Edit"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deleteTemplate(t.id)}
                    className="p-1.5 hover:bg-red-50 text-red-700 rounded-lg transition"
                    title="Delete"
                    aria-label="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {t.type === "email" && t.subject && (
                <div className="text-xs font-medium text-stone-500 mb-1 truncate">
                  Subject: {t.subject}
                </div>
              )}

              <div className="text-sm text-stone-600 line-clamp-3 whitespace-pre-wrap break-words">
                {t.body}
              </div>
            </div>
          ))}

          {templates.filter((t) => t.type === activeListTab).length === 0 && (
            <div className="py-10 text-center">
              <p className="tm-muted">
                No {activeListTab} templates yet.
              </p>
              <button
                onClick={revertToDefaults}
                className="mt-3 tm-btn tm-btn-secondary tm-btn-sm"
              >
                Load default templates
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Guest message templates are only used by booking messages.
 * Gated in a wrapper so none of the body's hooks (Firestore listeners, writes)
 * run while the platform is a directory (D3).
 */
export default function ManagerMessageTemplatesHub(props: Props) {
  const { bookingsEnabled } = usePlatformMode();
  if (!bookingsEnabled) return (
    <p className="text-sm text-stone-600">
      Guest messages are switched off while Travel Malawi runs as a directory. Guests contact you directly with the details on your listing.
    </p>
  );
  return <ManagerMessageTemplatesHubBody {...props} />;
}
