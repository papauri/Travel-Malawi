import React, { useState, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Upload,
  FileText,
  Image,
  X,
  Check,
  Loader2,
  AlertCircle,
  ClipboardPaste,
  Building2,
  ArrowRight,
  ArrowLeft,
  Plus,
  Trash2,
  User,
  Phone,
  MapPin,
  BedDouble,
  Clock,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAIAssistant, describeAIError } from '../hooks/useAIAssistant';
import {
  COMMON_AMENITIES,
  ListingDraft,
  PROPERTY_CATEGORIES,
  PropertyCategory,
} from '../lib/listing';
import {
  parsePropertyText,
  ParsedPropertyResult,
  roomPriceFields,
} from '../lib/localPropertyParser';
import { RoomInput } from '../lib/validateRoom';
import { auth } from '../lib/firebase';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { useModalScrollIsolation } from '../hooks/useModalScrollIsolation';

interface PropertyDocumentImporterProps {
  open: boolean;
  onClose: () => void;
  onImport: (data: Partial<ListingDraft> & { categories?: PropertyCategory[] }) => void;
}

const ACCEPTED_TYPES: Record<string, string> = {
  'text/plain': '.txt',
  'text/csv': '.csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'application/vnd.ms-excel': '.xls',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
};

const MAX_SIZE_MB = 8;

type StepIndex = 1 | 2 | 3;

export default function PropertyDocumentImporter({
  open,
  onClose,
  onImport,
}: PropertyDocumentImporterProps) {
  const { status: aiStatus } = useAIAssistant();
  const hasAI = Boolean(aiStatus.enabled && aiStatus.available);

  const [step, setStep] = useState<StepIndex>(1);
  const [activeTab, setActiveTab] = useState<'text' | 'file'>('text');
  const [file, setFile] = useState<File | null>(null);
  const [pastedText, setPastedText] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftData, setDraftData] = useState<ParsedPropertyResult | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  useBodyScrollLock(open);
  const scrollIsolationRef = useModalScrollIsolation<HTMLDivElement>(open);

  // Live zero-credit detection badge in Paste Text mode
  const liveDetection = useMemo(() => {
    if (!pastedText || pastedText.trim().length < 8) return null;
    try {
      const parsed = parsePropertyText(pastedText);
      const parts: string[] = [];
      if (parsed.name) parts.push(`Property name (${parsed.name})`);
      if (parsed.category) parts.push(parsed.category);
      if (parsed.location) parts.push(parsed.location);
      const roomCount = parsed.rooms?.length || 0;
      if (roomCount > 0) parts.push(`${roomCount} room${roomCount === 1 ? '' : 's'}`);
      const amenityCount = parsed.amenities?.length || 0;
      if (amenityCount > 0) parts.push(`${amenityCount} amenit${amenityCount === 1 ? 'y' : 'ies'}`);
      if (
        parsed.ownerName ||
        parsed.managerName ||
        parsed.contactPhone ||
        parsed.contactWhatsapp ||
        parsed.contactEmail
      ) {
        parts.push('contact info');
      }
      if (parts.length === 0) return null;
      return {
        parsed,
        summary: `Detected: ${parts.join(', ')}`,
      };
    } catch {
      return null;
    }
  }, [pastedText]);

  const reset = () => {
    setStep(1);
    setActiveTab('text');
    setFile(null);
    setPastedText('');
    setPreview(null);
    setProcessing(false);
    setError(null);
    setDraftData(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFile = useCallback((f: File) => {
    setError(null);

    if (f.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`File too large. Maximum size is ${MAX_SIZE_MB}MB.`);
      return;
    }

    const accepted = Object.keys(ACCEPTED_TYPES);
    if (!accepted.includes(f.type) && !f.name.match(/\.(jpg|jpeg|png|webp|pdf|txt|csv|xlsx|xls)$/i)) {
      setError('Unsupported file type. Please upload a TXT, CSV, Excel (.xlsx), image, or PDF file.');
      return;
    }

    setFile(f);

    if (f.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target?.result as string);
      reader.readAsDataURL(f);
    } else {
      setPreview(null);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const f = e.dataTransfer.files?.[0];
      if (f) handleFile(f);
    },
    [handleFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const normalizeAndMergeParsed = (
    primary: ParsedPropertyResult,
    fallback?: ParsedPropertyResult
  ): ParsedPropertyResult => {
    const merged: ParsedPropertyResult = {
      ...fallback,
      ...Object.fromEntries(
        Object.entries(primary).filter(([_, v]) => v !== undefined && v !== '' && v !== null)
      ),
    };

    const rawCat = (merged.category || (merged.categories && merged.categories[0]) || '') as string;
    const validCat = (PROPERTY_CATEGORIES as readonly string[]).includes(rawCat)
      ? (rawCat as PropertyCategory)
      : fallback?.category || '';

    const rawRooms =
      Array.isArray(primary.rooms) && primary.rooms.length > 0
        ? primary.rooms
        : Array.isArray(fallback?.rooms)
        ? fallback!.rooms!
        : [];

    const normalizedRooms: RoomInput[] = rawRooms.map((r: any) => {
      const rawUsd = Number(r.prices?.USD ?? r.priceUSD ?? r.price ?? 0) || 0;
      const rawMwk = Number(r.prices?.MWK ?? r.priceMWK ?? 0) || 0;
      const maxGuests = Math.max(1, Number(r.maxGuests) || 2);
      const quantity = Math.max(1, Number(r.quantity) || 1);

      return {
        name: String(r.name || 'Standard Room').trim(),
        description: String(r.description || '').trim(),
        maxGuests,
        baseGuests: Math.min(2, maxGuests),
        quantity,
        // Only the currencies the document priced — never converted (owner decision).
        ...roomPriceFields(Math.round(rawUsd), Math.round(rawMwk)),
      };
    });

    const combinedAmenities = Array.from(
      new Set([...(fallback?.amenities || []), ...(primary.amenities || [])].filter(Boolean))
    );

    return {
      name: merged.name || '',
      category: validCat,
      categories: validCat ? [validCat] : merged.categories || [],
      stayType: merged.stayType || 'rooms',
      location: merged.location || '',
      locationNotes: merged.locationNotes || '',
      description: merged.description || '',
      ownerName: merged.ownerName || '',
      ownerPhone: merged.ownerPhone || '',
      ownerEmail: merged.ownerEmail || '',
      managerName: merged.managerName || '',
      managerPhone: merged.managerPhone || '',
      managerEmail: merged.managerEmail || '',
      contactPhone:
        merged.contactPhone || merged.contactWhatsapp || merged.managerPhone || merged.ownerPhone || '',
      contactWhatsapp:
        merged.contactWhatsapp || merged.contactPhone || merged.managerPhone || merged.ownerPhone || '',
      contactEmail: merged.contactEmail || merged.managerEmail || merged.ownerEmail || '',
      checkInTime: merged.checkInTime || '14:00',
      checkOutTime: merged.checkOutTime || '11:00',
      amenities: combinedAmenities,
      rooms: normalizedRooms,
    };
  };

  const handleDecipherDetails = async () => {
    if (activeTab === 'text' && !pastedText.trim()) {
      setError('Please paste your rate sheet or property text first.');
      return;
    }
    if (activeTab === 'file' && !file) {
      setError('Please select a file to upload.');
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      const isTextFile =
        activeTab === 'file' &&
        file &&
        (file.type.startsWith('text/') || /\.(txt|csv)$/i.test(file.name));

      // 1. Instant Zero-Credit Local Parsing for pasted text or .txt / .csv files
      if (activeTab === 'text' || isTextFile) {
        const rawText = activeTab === 'text' ? pastedText.trim() : await file!.text();
        const localParsed = parsePropertyText(rawText);
        const normalized = normalizeAndMergeParsed(localParsed);
        if (!normalized.name && !normalized.location && !normalized.description && !(normalized.rooms?.length)) {
          setError('No property details were found in that text. Include the property name, location or room rates and try again.');
          return;
        }
        setDraftData(normalized);
        setStep(2);
        return;
      }

      const isSpreadsheetFile =
        activeTab === 'file' &&
        file &&
        (file.type.includes('spreadsheet') ||
          file.type.includes('excel') ||
          /\.(xlsx|xls)$/i.test(file.name));

      // 2. Image or PDF file upload (requires AI vision) vs Excel spreadsheet (works with 0-credit server XLSX->local parser)
      if (!hasAI && !isSpreadsheetFile) {
        setError(
          'Scanning photos or PDFs requires cloud vision. Please switch to "Paste Text / Rate Sheet" or upload a .txt, .csv, or .xlsx file for instant local deciphering.'
        );
        return;
      }

      const token = auth.currentUser ? await auth.currentUser.getIdToken() : '';
      const formData = new FormData();
      formData.append('document', file!);

      const res = await fetch('/api/ai/parse-property-doc', {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
      });

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error('Could not scan binary document. Paste the text directly for instant extraction.');
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(describeAIError(res, data));
      }

      if (data && data.extracted) {
        const normalized = normalizeAndMergeParsed(data.extracted);
        setDraftData(normalized);
        setStep(2);
      } else {
        throw new Error('Could not extract property details from this file.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to decipher document.');
    } finally {
      setProcessing(false);
    }
  };

  const updateField = <K extends keyof ParsedPropertyResult>(
    key: K,
    value: ParsedPropertyResult[K]
  ) => {
    setDraftData((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const toggleAmenity = (amenity: string) => {
    setDraftData((prev) => {
      if (!prev) return prev;
      const current = prev.amenities || [];
      const exists = current.includes(amenity);
      return {
        ...prev,
        amenities: exists ? current.filter((a) => a !== amenity) : [...current, amenity],
      };
    });
  };

  const updateRoom = (index: number, patch: Partial<RoomInput>) => {
    setDraftData((prev) => {
      if (!prev) return prev;
      const currentRooms = [...(prev.rooms || [])];
      const existing = currentRooms[index] || {};
      currentRooms[index] = { ...existing, ...patch };
      return { ...prev, rooms: currentRooms };
    });
  };

  const updateRoomPrice = (index: number, currency: 'USD' | 'MWK', rawVal: string) => {
    const num = Math.max(0, Number(rawVal) || 0);
    setDraftData((prev) => {
      if (!prev) return prev;
      const currentRooms = [...(prev.rooms || [])];
      const existing = currentRooms[index] || {};
      const nextPrices = { ...(existing.prices || {}), [currency]: num };
      // Each currency is typed by the host; the other one is never derived.
      currentRooms[index] = {
        ...existing,
        ...roomPriceFields(nextPrices.USD || 0, nextPrices.MWK || 0),
      };
      return { ...prev, rooms: currentRooms };
    });
  };

  const addRoom = () => {
    setDraftData((prev) => {
      if (!prev) return prev;
      const nextRooms: RoomInput[] = [
        ...(prev.rooms || []),
        {
          name: '',
          description: '',
          maxGuests: 2,
          baseGuests: 2,
          quantity: 1,
          currencies: ['USD', 'MWK'],
          prices: {},
        },
      ];
      return { ...prev, rooms: nextRooms };
    });
  };

  const removeRoom = (index: number) => {
    setDraftData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        rooms: (prev.rooms || []).filter((_, i) => i !== index),
      };
    });
  };

  const handleApplyToProperty = () => {
    if (!draftData) return;

    const cleanPayload: Partial<ListingDraft> & { categories?: PropertyCategory[] } = {};

    if (draftData.name?.trim()) cleanPayload.name = draftData.name.trim();
    if (draftData.category) {
      cleanPayload.category = draftData.category;
      cleanPayload.categories = [draftData.category];
    } else if (draftData.categories && draftData.categories.length > 0) {
      cleanPayload.category = draftData.categories[0];
      cleanPayload.categories = draftData.categories;
    }
    if (draftData.stayType) cleanPayload.stayType = draftData.stayType;
    if (draftData.location?.trim()) cleanPayload.location = draftData.location.trim();
    if (draftData.locationNotes?.trim()) cleanPayload.locationNotes = draftData.locationNotes.trim();
    if (draftData.description?.trim()) cleanPayload.description = draftData.description.trim();

    if (draftData.ownerName?.trim()) cleanPayload.ownerName = draftData.ownerName.trim();
    if (draftData.ownerPhone?.trim()) cleanPayload.ownerPhone = draftData.ownerPhone.trim();
    if (draftData.ownerEmail?.trim()) cleanPayload.ownerEmail = draftData.ownerEmail.trim();

    if (draftData.managerName?.trim()) cleanPayload.managerName = draftData.managerName.trim();
    if (draftData.managerPhone?.trim()) cleanPayload.managerPhone = draftData.managerPhone.trim();
    if (draftData.managerEmail?.trim()) cleanPayload.managerEmail = draftData.managerEmail.trim();

    if (draftData.contactPhone?.trim()) cleanPayload.contactPhone = draftData.contactPhone.trim();
    if (draftData.contactWhatsapp?.trim()) cleanPayload.contactWhatsapp = draftData.contactWhatsapp.trim();
    if (draftData.contactEmail?.trim()) cleanPayload.contactEmail = draftData.contactEmail.trim();

    if (draftData.checkInTime?.trim()) cleanPayload.checkInTime = draftData.checkInTime.trim();
    if (draftData.checkOutTime?.trim()) cleanPayload.checkOutTime = draftData.checkOutTime.trim();

    if (draftData.amenities && draftData.amenities.length > 0) {
      cleanPayload.amenities = draftData.amenities;
    }

    const validRooms = (draftData.rooms || [])
      .filter((r) => r.name && r.name.trim().length > 0)
      .map((r) => {
        const usd = Math.max(0, Number(r.prices?.USD) || 0);
        const mwk = Math.max(0, Number(r.prices?.MWK) || 0);
        const maxGuests = Math.max(1, Number(r.maxGuests) || 2);
        return {
          name: r.name!.trim(),
          description: (r.description || '').trim(),
          maxGuests,
          baseGuests: Math.min(2, maxGuests),
          quantity: Math.max(1, Number(r.quantity) || 1),
          ...roomPriceFields(usd, mwk),
        };
      });

    if (validRooms.length > 0) {
      cleanPayload.rooms = validRooms;
    }

    const droppedRooms = (draftData.rooms || []).length - validRooms.length;
    if (droppedRooms > 0) {
      toast(`${droppedRooms} room${droppedRooms === 1 ? '' : 's'} without a name ${droppedRooms === 1 ? 'was' : 'were'} not imported.`);
    }

    onImport(cleanPayload);
    toast.success('Property details applied to your listing!');
    handleClose();
  };

  if (!open || typeof document === 'undefined') return null;

  const inputClass =
    'w-full bg-white border border-stone-200 rounded-xl px-3 py-2 text-xs text-stone-900 outline-none focus:border-stone-900 transition';
  const labelClass = 'block text-[11px] font-semibold text-stone-600 mb-1';

  return createPortal(
    <div
      id="property-document-importer-modal"
      data-lenis-prevent="true"
      className="fixed inset-0 z-[100] overflow-y-auto overscroll-contain bg-stone-950/60 backdrop-blur-xs flex min-h-full items-center justify-center p-3 sm:p-4 md:p-6 text-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        ref={scrollIsolationRef}
        data-lenis-prevent="true"
        className="bg-white rounded-2xl sm:rounded-3xl w-full max-w-2xl max-h-[calc(100dvh-2.5rem)] sm:max-h-[88vh] overflow-hidden shadow-2xl flex flex-col border border-stone-200 text-left overscroll-contain my-auto relative"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200 shrink-0">
          <div>
            <h3 className="text-base sm:text-lg font-serif font-bold text-stone-900">
              Import Property Details
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Extract property info, owner &amp; contacts, amenities, and room rates in seconds
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded-full hover:bg-stone-100 text-stone-400 hover:text-stone-600 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 3-Step Minimalist Indicator Bar */}
        <div className="grid grid-cols-3 border-b border-stone-200 bg-stone-50 text-xs font-semibold shrink-0">
          <button
            type="button"
            onClick={() => setStep(1)}
            className={`py-2.5 px-3 text-center border-b-2 transition cursor-pointer ${
              step === 1
                ? 'border-stone-900 text-stone-900 bg-white'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            1. Source Document
          </button>
          <button
            type="button"
            disabled={!draftData}
            onClick={() => draftData && setStep(2)}
            className={`py-2.5 px-3 text-center border-b-2 transition ${
              step === 2
                ? 'border-stone-900 text-stone-900 bg-white'
                : draftData
                ? 'border-transparent text-stone-600 hover:text-stone-900 cursor-pointer'
                : 'border-transparent text-stone-300 cursor-not-allowed'
            }`}
          >
            2. Property &amp; Contacts
          </button>
          <button
            type="button"
            disabled={!draftData}
            onClick={() => draftData && setStep(3)}
            className={`py-2.5 px-3 text-center border-b-2 transition ${
              step === 3
                ? 'border-stone-900 text-stone-900 bg-white'
                : draftData
                ? 'border-transparent text-stone-600 hover:text-stone-900 cursor-pointer'
                : 'border-transparent text-stone-300 cursor-not-allowed'
            }`}
          >
            3. Rooms &amp; Rates {draftData?.rooms?.length ? `(${draftData.rooms.length})` : ''}
          </button>
        </div>

        {/* Modal Body */}
        <div
          data-lenis-prevent="true"
          className="flex-1 overflow-y-auto overscroll-contain p-5 space-y-5"
        >
          {/* ================= STEP 1: SOURCE DOCUMENT ================= */}
          {step === 1 && (
            <div className="space-y-4">
              {/* Source Mode Tabs */}
              <div className="flex bg-stone-100 p-1 rounded-xl gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('text');
                    setError(null);
                  }}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    activeTab === 'text'
                      ? 'bg-white text-stone-900 shadow-2xs'
                      : 'text-stone-500 hover:text-stone-800'
                  }`}
                >
                  <ClipboardPaste className="w-3.5 h-3.5" />
                  <span>Paste Text / Rate Sheet</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('file');
                    setError(null);
                  }}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    activeTab === 'file'
                      ? 'bg-white text-stone-900 shadow-2xs'
                      : 'text-stone-500 hover:text-stone-800'
                  }`}
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload File (TXT, CSV, Photo, PDF)</span>
                </button>
              </div>

              {activeTab === 'text' ? (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-xs text-stone-500">
                    <span>
                      Paste a hotel brochure, WhatsApp rate sheet, room tariff list, or contact card:
                    </span>
                    {pastedText.trim().length > 0 && (
                      <button
                        type="button"
                        onClick={() => setPastedText('')}
                        className="text-stone-400 hover:text-stone-700 underline text-[11px]"
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  <textarea
                    rows={10}
                    value={pastedText}
                    onChange={(e) => {
                      setPastedText(e.target.value);
                      setError(null);
                    }}
                    placeholder={`Example:
Property Name: Example Lakeside Lodge
Location: Cape Maclear, Mangochi
Owner: Chisomo Banda (+265 999 123 456, chisomo@example.com)
WhatsApp: +265 888 654 321
Check-in: 14:00 | Check-out: 10:30
Amenities: Free WiFi, Solar backup power, Private beach, Breakfast included, Restaurant, Bar

ROOMS & RATES:
- Standard Lakeview Chalet (Sleeps 2, 4 units) - $95 / MK 165,000
- Family Beach Cottage (Sleeps 4, 2 units) - $160 / MK 280,000`}
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3.5 text-xs font-mono text-stone-900 outline-none focus:border-stone-900 focus:bg-white transition resize-none leading-relaxed"
                  />

                  {liveDetection && (
                    <div className="flex items-center justify-between gap-2 px-3 py-2 bg-stone-100 border border-stone-200 rounded-xl text-xs text-stone-700">
                      <div className="flex items-center gap-2 min-w-0">
                        <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span className="truncate font-medium">{liveDetection.summary}</span>
                      </div>
                      <span className="text-[10px] font-mono text-stone-500 shrink-0">Instant</span>
                    </div>
                  )}
                </div>
              ) : (
                <div
                  ref={dropRef}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onClick={() => inputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                    file
                      ? 'border-stone-400 bg-stone-50'
                      : 'border-stone-300 hover:border-stone-400 hover:bg-stone-50'
                  }`}
                >
                  <input
                    ref={inputRef}
                    type="file"
                    accept=".txt,.csv,.xlsx,.xls,.jpg,.jpeg,.png,.webp,.pdf"
                    onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                    className="hidden"
                  />
                  {file ? (
                    <div className="space-y-2">
                      {preview ? (
                        <img
                          src={preview}
                          alt="Document preview"
                          className="max-h-40 mx-auto rounded-lg object-contain"
                        />
                      ) : (
                        <FileText className="w-10 h-10 mx-auto text-stone-700" />
                      )}
                      <p className="text-sm font-semibold text-stone-800">{file.name}</p>
                      <p className="text-xs text-stone-500">
                        {(file.size / 1024).toFixed(0)} KB • Click to change file
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      <div className="flex justify-center gap-3">
                        <FileText className="w-7 h-7 text-stone-400" />
                        <Image className="w-7 h-7 text-stone-400" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-stone-700">
                          Drop your rate sheet or property document here
                        </p>
                        <p className="text-xs text-stone-400 mt-1">
                          Supports .txt and .csv (instant in-browser)
                          {hasAI ? ', plus photos and PDFs' : ''}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {error && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>
          )}

          {/* ================= STEP 2: PROPERTY, OWNER & CONTACTS ================= */}
          {step === 2 && draftData && (
            <div className="space-y-5">
              {/* Property Identity & Location */}
              <div className="space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-stone-500">
                  <Building2 className="w-3.5 h-3.5" />
                  <span>Property Basics</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-1">
                    <label className={labelClass}>Property Name</label>
                    <input
                      type="text"
                      value={draftData.name || ''}
                      onChange={(e) => updateField('name', e.target.value)}
                      placeholder="e.g. Example Lakeside Lodge"
                      className={inputClass}
                    />
                  </div>
                  <div className="sm:col-span-1">
                    <label className={labelClass}>Category</label>
                    <select
                      value={draftData.category || ''}
                      onChange={(e) =>
                        updateField('category', e.target.value as PropertyCategory | '')
                      }
                      className={inputClass}
                    >
                      <option value="">Select category...</option>
                      {PROPERTY_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-1">
                    <label className={labelClass}>Location (Town / Area)</label>
                    <input
                      type="text"
                      value={draftData.location || ''}
                      onChange={(e) => updateField('location', e.target.value)}
                      placeholder="e.g. Cape Maclear, Mangochi"
                      className={inputClass}
                    />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>
                    Directions / Access Notes{' '}
                    <span className="font-normal text-stone-400">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={draftData.locationNotes || ''}
                    onChange={(e) => updateField('locationNotes', e.target.value)}
                    placeholder="e.g. Off M5 Lakeshore Road, 2km past Chembe trading centre"
                    className={inputClass}
                  />
                </div>
              </div>

              {/* Owner & Manager Details */}
              <div className="space-y-3 pt-3 border-t border-stone-100">
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-stone-500">
                  <User className="w-3.5 h-3.5" />
                  <span>Owner &amp; Manager Details</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className={labelClass}>Owner Name</label>
                    <input
                      type="text"
                      value={draftData.ownerName || ''}
                      onChange={(e) => updateField('ownerName', e.target.value)}
                      placeholder="Proprietor / Owner"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Owner Phone</label>
                    <input
                      type="text"
                      value={draftData.ownerPhone || ''}
                      onChange={(e) => updateField('ownerPhone', e.target.value)}
                      placeholder="+265 99..."
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Owner Email</label>
                    <input
                      type="email"
                      value={draftData.ownerEmail || ''}
                      onChange={(e) => updateField('ownerEmail', e.target.value)}
                      placeholder="owner@example.com"
                      className={inputClass}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className={labelClass}>Manager / Host Name</label>
                    <input
                      type="text"
                      value={draftData.managerName || ''}
                      onChange={(e) => updateField('managerName', e.target.value)}
                      placeholder="General Manager / Host"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Manager Phone</label>
                    <input
                      type="text"
                      value={draftData.managerPhone || ''}
                      onChange={(e) => updateField('managerPhone', e.target.value)}
                      placeholder="+265 88..."
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Manager Email</label>
                    <input
                      type="email"
                      value={draftData.managerEmail || ''}
                      onChange={(e) => updateField('managerEmail', e.target.value)}
                      placeholder="manager@example.com"
                      className={inputClass}
                    />
                  </div>
                </div>
              </div>

              {/* Front Desk / Booking Contacts & Check-in Schedule */}
              <div className="space-y-3 pt-3 border-t border-stone-100">
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-stone-500">
                  <Phone className="w-3.5 h-3.5" />
                  <span>Front Desk, WhatsApp &amp; Check-In Hours</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className={labelClass}>Booking / Front Desk Phone</label>
                    <input
                      type="text"
                      value={draftData.contactPhone || ''}
                      onChange={(e) => updateField('contactPhone', e.target.value)}
                      placeholder="+265 99..."
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>WhatsApp Number</label>
                    <input
                      type="text"
                      value={draftData.contactWhatsapp || ''}
                      onChange={(e) => updateField('contactWhatsapp', e.target.value)}
                      placeholder="+265 99..."
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Booking Email</label>
                    <input
                      type="email"
                      value={draftData.contactEmail || ''}
                      onChange={(e) => updateField('contactEmail', e.target.value)}
                      placeholder="bookings@example.com"
                      className={inputClass}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 max-w-xs">
                  <div>
                    <label className={labelClass}>Check-in Time</label>
                    <input
                      type="text"
                      value={draftData.checkInTime || '14:00'}
                      onChange={(e) => updateField('checkInTime', e.target.value)}
                      placeholder="14:00"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Check-out Time</label>
                    <input
                      type="text"
                      value={draftData.checkOutTime || '11:00'}
                      onChange={(e) => updateField('checkOutTime', e.target.value)}
                      placeholder="11:00"
                      className={inputClass}
                    />
                  </div>
                </div>
              </div>

              {/* Description & Amenities */}
              <div className="space-y-3 pt-3 border-t border-stone-100">
                <div>
                  <label className={labelClass}>Property Description</label>
                  <textarea
                    rows={3}
                    value={draftData.description || ''}
                    onChange={(e) => updateField('description', e.target.value)}
                    placeholder="Overview of your stay, surroundings, and hospitality..."
                    className={`${inputClass} resize-none leading-relaxed`}
                  />
                </div>

                <div>
                  <label className={labelClass}>
                    Amenities ({draftData.amenities?.length || 0} selected)
                  </label>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {COMMON_AMENITIES.map((amenity) => {
                      const active = (draftData.amenities || []).includes(amenity);
                      return (
                        <button
                          key={amenity}
                          type="button"
                          onClick={() => toggleAmenity(amenity)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition cursor-pointer ${
                            active
                              ? 'bg-stone-900 text-white border-stone-900'
                              : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
                          }`}
                        >
                          {amenity}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================= STEP 3: ROOMS & RATES ================= */}
          {step === 3 && draftData && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-stone-600 flex items-center gap-1.5">
                    <BedDouble className="w-3.5 h-3.5" />
                    <span>Deciphered Rooms &amp; Nightly Rates ({draftData.rooms?.length || 0})</span>
                  </h4>
                  <p className="text-[11px] text-stone-500 mt-0.5">
                    Review or adjust room names, guest capacity, unit counts, and USD / MWK rates.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addRoom}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-semibold transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Room</span>
                </button>
              </div>

              {(!draftData.rooms || draftData.rooms.length === 0) ? (
                <div className="p-6 border border-dashed border-stone-300 rounded-2xl text-center bg-stone-50/50 space-y-2">
                  <BedDouble className="w-6 h-6 text-stone-400 mx-auto" />
                  <p className="text-xs font-semibold text-stone-700">
                    No individual room lines were detected in this document.
                  </p>
                  <p className="text-[11px] text-stone-500 max-w-sm mx-auto">
                    You can add a room right now using "+ Add Room" above, or click "Apply to Property" to import the property &amp; contact details first.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {draftData.rooms.map((room, idx) => (
                    <div
                      key={`deciphered-room-${idx}`}
                      className="p-3.5 rounded-2xl border border-stone-200 bg-stone-50/60 space-y-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-mono font-bold text-stone-500 uppercase">
                          Room #{idx + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeRoom(idx)}
                          className="p-1 text-stone-400 hover:text-red-600 rounded-lg transition cursor-pointer"
                          title="Delete room"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                        <div className="sm:col-span-5">
                          <label className={labelClass}>Room / Chalet Name</label>
                          <input
                            type="text"
                            value={room.name || ''}
                            onChange={(e) => updateRoom(idx, { name: e.target.value })}
                            placeholder="e.g. Deluxe Lakeview Chalet"
                            className={inputClass}
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className={labelClass}>Max Guests</label>
                          <input
                            type="number"
                            min={1}
                            max={30}
                            value={room.maxGuests ?? 2}
                            onChange={(e) =>
                              updateRoom(idx, {
                                maxGuests: Math.max(1, parseInt(e.target.value, 10) || 1),
                              })
                            }
                            className={inputClass}
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className={labelClass}>Units (Qty)</label>
                          <input
                            type="number"
                            min={1}
                            max={200}
                            value={room.quantity ?? 1}
                            onChange={(e) =>
                              updateRoom(idx, {
                                quantity: Math.max(1, parseInt(e.target.value, 10) || 1),
                              })
                            }
                            className={inputClass}
                          />
                        </div>
                        <div className="sm:col-span-3 grid grid-cols-2 gap-1.5">
                          <div>
                            <label className={labelClass}>USD ($)</label>
                            <input
                              type="number"
                              min={0}
                              value={room.prices?.USD || ''}
                              onChange={(e) => updateRoomPrice(idx, 'USD', e.target.value)}
                              className={inputClass}
                            />
                          </div>
                          <div>
                            <label className={labelClass}>MWK (MK)</label>
                            <input
                              type="number"
                              min={0}
                              step={1000}
                              value={room.prices?.MWK || ''}
                              onChange={(e) => updateRoomPrice(idx, 'MWK', e.target.value)}
                              className={inputClass}
                            />
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className={labelClass}>
                          Room Description{' '}
                          <span className="font-normal text-stone-400">(optional)</span>
                        </label>
                        <input
                          type="text"
                          value={room.description || ''}
                          onChange={(e) => updateRoom(idx, { description: e.target.value })}
                          placeholder="e.g. King bed, private veranda overlooking Lake Malawi, ensuite shower"
                          className={inputClass}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 border-t border-stone-200 bg-stone-50 flex items-center justify-between gap-3 shrink-0">
          {step === 1 && (
            <>
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 text-xs font-semibold text-stone-600 hover:text-stone-900 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDecipherDetails}
                disabled={
                  processing ||
                  (activeTab === 'file' && !file) ||
                  (activeTab === 'text' && pastedText.trim().length < 5)
                }
                className="px-5 py-2.5 text-xs font-semibold bg-stone-900 text-white rounded-xl hover:bg-stone-800 flex items-center gap-2 disabled:opacity-40 cursor-pointer transition"
              >
                {processing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <FileText className="w-4 h-4" />
                )}
                <span>{processing ? 'Deciphering...' : 'Decipher Details'}</span>
              </button>
            </>
          )}

          {step === 2 && draftData && (
            <>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-stone-600 hover:text-stone-900 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
              <div className="flex items-center gap-2">
                {(!draftData.rooms || draftData.rooms.length === 0) && (
                  <button
                    type="button"
                    onClick={handleApplyToProperty}
                    className="px-4 py-2 text-xs font-semibold border border-stone-300 bg-white hover:bg-stone-100 text-stone-800 rounded-xl transition cursor-pointer"
                  >
                    Apply Details
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 text-xs font-semibold bg-stone-900 text-white rounded-xl hover:bg-stone-800 transition cursor-pointer"
                >
                  <span>Next: Rooms &amp; Rates</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </>
          )}

          {step === 3 && draftData && (
            <>
              <button
                type="button"
                onClick={() => setStep(2)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-stone-600 hover:text-stone-900 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
              <button
                type="button"
                onClick={handleApplyToProperty}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 text-xs font-semibold bg-stone-900 text-white rounded-xl hover:bg-stone-800 transition cursor-pointer shadow-xs"
              >
                <Check className="w-4 h-4" />
                <span>Apply to Property</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
