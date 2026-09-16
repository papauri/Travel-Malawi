import React, { useState } from "react";
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

export default function ManagerMessageTemplatesHub({
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
      const q = query(
        collection(db, "hotels"),
        where("managerId", "==", user.uid),
      );
      const snapshot = await getDocs(q);
      const batch = writeBatch(db);

      snapshot.docs.forEach((docSnap) => {
        if (docSnap.id !== hotel.id) {
          batch.update(docSnap.ref, { messageTemplates: templates });
        }
      });

      await batch.commit();
      toast.success(
        `Applied templates to ${snapshot.size - 1} other properties`,
      );
    } catch (error) {
      console.error(error);
      toast.error("Failed to apply to all properties");
    } finally {
      setApplyingToAll(false);
    }
  };

  const { generate } = useAIAssistant();

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

        toast.success("Assistant drafted a template!");
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
    <div className="bg-white rounded-2xl border border-stone-200 shadow-2xs overflow-hidden mb-8">
      <div className="p-5 md:p-7 bg-stone-50 border-b border-stone-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <MessageSquare className="w-5 h-5 text-stone-900" />
            <h2 className="text-xl font-bold text-stone-900">
              Message Templates Hub
            </h2>
          </div>
          <p className="text-sm text-stone-600">
            Create reusable Email & WhatsApp templates. Harness the Draft Assistant to write the
            perfect message.
          </p>
        </div>
        {!editingId && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                setEditingId("new");
                setType("whatsapp");
                setTitle("");
                setSubject("");
                setBody("");
              }}
              className="shrink-0 flex items-center gap-1.5 bg-stone-900 hover:bg-stone-800 text-white px-4 py-2 rounded-xl font-bold transition text-sm shadow-sm"
            >
              <Plus className="w-4 h-4" />
              New Template
            </button>
            <button
              onClick={applyToAllProperties}
              disabled={applyingToAll}
              className="shrink-0 flex items-center gap-1.5 bg-white border border-stone-200 hover:bg-stone-50 text-stone-700 px-4 py-2 rounded-xl font-bold transition text-sm shadow-sm disabled:opacity-50"
              title="Apply these templates to all properties you manage"
            >
              <Globe className="w-4 h-4" />
              {applyingToAll ? "Applying..." : "Apply to All My Properties"}
            </button>
            <button
              onClick={revertToDefaults}
              className="shrink-0 flex items-center gap-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-100 px-4 py-2 rounded-xl font-bold transition text-sm"
              title="Revert to system defaults"
            >
              <RotateCcw className="w-4 h-4" />
              Reset Defaults
            </button>
          </div>
        )}
      </div>

      <div className="p-6 md:p-8">
        {editingId && (
          <div className="bg-stone-50 p-6 rounded-2xl border border-stone-200 mb-8 animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-stone-900 text-lg">
                {editingId === "new" ? "Create Template" : "Edit Template"}
              </h3>
              <button
                onClick={() => setShowAIPrompt(!showAIPrompt)}
                className="flex items-center gap-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-3 py-1.5 rounded-lg text-sm font-bold transition border border-indigo-100"
              >
                {showAIPrompt ? "Close Assistant" : "Open Draft Assistant"}
              </button>
            </div>

            {showAIPrompt && (
              <div className="mb-6 bg-indigo-50/50 p-4 rounded-xl border border-indigo-100">
                <label className="block text-xs font-bold text-indigo-800 uppercase tracking-wider mb-2">
                  Draft Instructions
                </label>
                <textarea
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="e.g. Write a friendly welcome email that reminds guests about the 2PM check-in and our free breakfast."
                  className="w-full bg-white border border-indigo-200 text-stone-900 text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 mb-3"
                  rows={2}
                />
                <button
                  onClick={generateWithAI}
                  disabled={isGenerating}
                  className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition disabled:opacity-50 w-full sm:w-auto"
                >
                  {isGenerating && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isGenerating ? "Drafting Template..." : "Auto-Draft Content"}
                </button>
              </div>
            )}

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-stone-700 mb-1">
                    Type
                  </label>
                  <div className="flex rounded-xl overflow-hidden border border-stone-200 bg-white">
                    <button
                      type="button"
                      onClick={() => setType("whatsapp")}
                      className={`flex-1 py-2 text-sm font-bold flex items-center justify-center gap-2 ${type === "whatsapp" ? "bg-green-500 text-white" : "text-stone-500 hover:bg-stone-50"}`}
                    >
                      <MessageSquare className="w-4 h-4" /> WhatsApp
                    </button>
                    <button
                      type="button"
                      onClick={() => setType("email")}
                      className={`flex-1 py-2 text-sm font-bold flex items-center justify-center gap-2 ${type === "email" ? "bg-blue-500 text-white" : "text-stone-500 hover:bg-stone-50"}`}
                    >
                      <Mail className="w-4 h-4" /> Email
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-stone-700 mb-1">
                    Template Name
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Booking Confirmation"
                    className="w-full bg-white border border-stone-200 text-stone-900 text-sm font-medium rounded-xl px-4 py-2.5 focus:outline-none focus:border-stone-400 transition"
                  />
                </div>
              </div>

              {type === "email" && (
                <div>
                  <label className="block text-sm font-bold text-stone-700 mb-1">
                    Email Subject
                  </label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="e.g. Your stay at our property"
                    className="w-full bg-white border border-stone-200 text-stone-900 text-sm font-medium rounded-xl px-4 py-2.5 focus:outline-none focus:border-stone-400 transition"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-bold text-stone-700 mb-1">
                  Message Body
                </label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Type your message here..."
                  rows={6}
                  className="w-full bg-white border border-stone-200 text-stone-900 text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-stone-400 transition"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={saveTemplate}
                  className="bg-stone-900 hover:bg-stone-800 text-white px-6 py-2.5 rounded-xl font-bold transition shadow-sm text-sm"
                >
                  Save Template
                </button>
                <button
                  onClick={resetForm}
                  className="bg-white hover:bg-stone-100 text-stone-600 border border-stone-200 px-6 py-2.5 rounded-xl font-bold transition text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="flex border-b border-stone-200 mb-6 mt-2">
          <button
            onClick={() => setActiveListTab("whatsapp")}
            className={`flex-1 md:flex-none px-4 py-3 text-sm font-bold border-b-2 transition ${activeListTab === "whatsapp" ? "border-green-500 text-green-700" : "border-transparent text-stone-500 hover:text-stone-700"}`}
          >
            <div className="flex items-center justify-center md:justify-start gap-2">
              <MessageSquare className="w-4 h-4" /> WhatsApp
            </div>
          </button>
          <button
            onClick={() => setActiveListTab("email")}
            className={`flex-1 md:flex-none px-4 py-3 text-sm font-bold border-b-2 transition ${activeListTab === "email" ? "border-blue-500 text-blue-700" : "border-transparent text-stone-500 hover:text-stone-700"}`}
          >
            <div className="flex items-center justify-center md:justify-start gap-2">
              <Mail className="w-4 h-4" /> Email
            </div>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.filter((t) => t.type === activeListTab).map((t) => (
            <div
              key={t.id}
              className={`p-5 rounded-2xl border transition-all ${t.enabled ? "bg-white border-stone-200 shadow-sm" : "bg-stone-50 border-stone-200 opacity-60"}`}
            >
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2">
                  {t.type === "email" ? (
                    <Mail className="w-5 h-5 text-blue-500" />
                  ) : (
                    <MessageSquare className="w-5 h-5 text-green-500" />
                  )}
                  <h4 className="font-bold text-stone-900">{t.title}</h4>
                </div>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => toggleEnabled(t.id, t.enabled)}
                    className={`p-1.5 rounded-lg transition ${t.enabled ? "bg-green-100 text-green-700" : "bg-stone-200 text-stone-500"} hover:opacity-80`}
                    title={t.enabled ? "Disable" : "Enable"}
                  >
                    {t.enabled ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <X className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    onClick={() => startEdit(t)}
                    className="p-1.5 bg-stone-100 hover:bg-stone-200 text-stone-600 rounded-lg transition"
                    title="Edit"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deleteTemplate(t.id)}
                    className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {t.type === "email" && t.subject && (
                <div className="text-xs font-bold text-stone-500 mb-1 pb-1 border-b border-stone-100">
                  Subj: {t.subject}
                </div>
              )}

              <div className="text-sm text-stone-600 line-clamp-3 whitespace-pre-wrap mt-2">
                {t.body}
              </div>

              {!t.isCustom && (
                <div className="mt-3 pt-3 border-t border-stone-100 flex items-center gap-1.5">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-stone-400 bg-stone-100 px-2 py-0.5 rounded-md">
                    Default
                  </span>
                </div>
              )}
            </div>
          ))}

          {templates.filter((t) => t.type === activeListTab).length === 0 && (
            <div className="col-span-full py-12 text-center bg-stone-50 rounded-2xl border border-stone-200 border-dashed">
              <MessageSquare className="w-12 h-12 text-stone-300 mx-auto mb-3" />
              <p className="text-stone-500 font-medium">
                No {activeListTab} templates created yet.
              </p>
              <button
                onClick={revertToDefaults}
                className="mt-4 text-stone-600 hover:text-stone-900 text-sm font-bold underline"
              >
                Load Default Templates
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
