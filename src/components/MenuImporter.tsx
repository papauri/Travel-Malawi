import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Upload,
  FileText,
  X,
  Check,
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  ClipboardPaste,
  Zap,
  ScanText,
  Info,
  Trash2,
  Plus,
  RefreshCw,
  Edit2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { MenuSection, MenuItem, PriceMap } from '../types';
import { parseMenuText } from '../lib/localMenuParser';
import { auth } from '../lib/firebase';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { useModalScrollIsolation } from '../hooks/useModalScrollIsolation';
import { useAIAssistant, describeAIError } from '../hooks/useAIAssistant';

interface MenuImporterProps {
  open: boolean;
  onClose: () => void;
  onImport: (sections: MenuSection[]) => void;
  currencies: string[];
}

const ACCEPTED_TYPES = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
  'text/plain': '.txt',
  'text/csv': '.csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
};

const MAX_SIZE_MB = 8;

export default function MenuImporter({ open, onClose, onImport, currencies }: MenuImporterProps) {
  useBodyScrollLock(open);
  const scrollIsolationRef = useModalScrollIsolation<HTMLDivElement>(open);
  const { status: aiStatus } = useAIAssistant();
  const hasSmartScanner = Boolean(aiStatus.enabled && aiStatus.available);

  const [activeTab, setActiveTab] = useState<'text' | 'file'>('text');
  const [engine, setEngine] = useState<'local' | 'ai'>('local');
  const [file, setFile] = useState<File | null>(null);
  const [pastedText, setPastedText] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extractedSections, setExtractedSections] = useState<MenuSection[] | null>(null);
  const [decipherEngineUsed, setDecipherEngineUsed] = useState<'local' | 'ai' | 'fallback'>('local');
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  // Synchronize engine if smart scanner is not available
  useEffect(() => {
    if (!hasSmartScanner && engine === 'ai') {
      setEngine('local');
    }
  }, [hasSmartScanner, engine]);

  // Keyboard escape listener to cleanly close modal
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  // Live real-time analysis using local parser
  const liveAnalysis = useMemo(() => {
    if (!pastedText || pastedText.trim().length < 10) return null;
    try {
      return parseMenuText(pastedText.trim(), currencies);
    } catch {
      return null;
    }
  }, [pastedText, currencies]);

  const reset = () => {
    setFile(null);
    setPastedText('');
    setPreview(null);
    setProcessing(false);
    setError(null);
    setExtractedSections(null);
    setExpandedSections(new Set());
    setDecipherEngineUsed('local');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFile = useCallback((f: File) => {
    setError(null);
    setExtractedSections(null);

    if (f.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`File too large. Maximum size is ${MAX_SIZE_MB}MB.`);
      return;
    }

    const accepted = Object.keys(ACCEPTED_TYPES);
    if (!accepted.includes(f.type) && !f.name.match(/\.(jpg|jpeg|png|webp|pdf|txt|csv|xlsx)$/i)) {
      setError('Unsupported file type. Please upload an image, PDF, text file, CSV, or Excel file.');
      return;
    }

    setFile(f);

    // If it's a text or csv file, auto-set engine to local
    if (f.type.startsWith('text/') || f.name.match(/\.(txt|csv)$/i)) {
      setEngine('local');
    } else {
      setEngine('ai');
    }

    // Preview for images
    if (f.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target?.result as string);
      reader.readAsDataURL(f);
    } else {
      setPreview(null);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  // Decipher logic: handles Local Tool (instant, in-browser) and AI (with graceful fallback)
  const processMenu = async (overrideEngine?: 'local' | 'ai') => {
    const selectedEngine = overrideEngine || engine;

    if (activeTab === 'file' && !file) return;
    if (activeTab === 'text' && !pastedText.trim()) {
      setError('Please paste your menu text first.');
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      // 1. LOCAL ENGINE EXECUTION (Instant, 100% in-browser, no network failure, zero cost)
      if (selectedEngine === 'local') {
        let textToParse = '';

        if (activeTab === 'text') {
          textToParse = pastedText.trim();
        } else if (file && (file.type.startsWith('text/') || file.name.match(/\.(txt|csv)$/i))) {
          // Read local text file directly in browser
          textToParse = await file.text();
        } else {
          // File is an image/PDF but user selected local parser
          throw new Error('Local tool directly parses text, CSV, and formatted lists. For images or scanned PDFs, switch to Document & Vision Scan or paste the menu text.');
        }

        const localResult = parseMenuText(textToParse, currencies);
        if (localResult.sections.length > 0 && localResult.sections.some(s => s.items.length > 0)) {
          setExtractedSections(localResult.sections);
          setExpandedSections(new Set(localResult.sections.map((_, i) => i)));
          setDecipherEngineUsed('local');
          toast.success(`Found ${localResult.stats.itemsCount} items`);
          return;
        } else {
          throw new Error('Could not identify distinct menu items. Try formatting lines with item name, dash, and price (e.g. "Chambo Cakes - MWK 14,000 / USD 8").');
        }
      }

      // 2. DOCUMENT SCANNER ENGINE EXECUTION (Sends to backend with safe response handling & local fallback)
      let res: Response;
      let rawTextForFallback = activeTab === 'text' ? pastedText.trim() : '';

      const token = auth.currentUser ? await auth.currentUser.getIdToken() : '';
      const authHeaders: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

      if (activeTab === 'text') {
        res = await fetch('/api/ai/parse-menu', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders },
          body: JSON.stringify({ text: pastedText.trim(), currencies }),
        });
      } else {
        // If it's a text/csv file, also keep text handy for fallback
        if (file && (file.type.startsWith('text/') || file.name.match(/\.(txt|csv)$/i))) {
          try {
            rawTextForFallback = await file.text();
          } catch {}
        }

        const formData = new FormData();
        formData.append('menu', file!);
        formData.append('currencies', JSON.stringify(currencies));

        res = await fetch('/api/ai/parse-menu', {
          method: 'POST',
          headers: authHeaders,
          body: formData,
        });
      }

      // Check Content-Type to avoid "Unexpected token '<'" crash on HTML error pages
      const contentType = res.headers.get('content-type') || '';
      let data: any = null;

      if (contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const rawText = await res.text();
        console.warn('Non-JSON response from /api/ai/parse-menu:', rawText.slice(0, 150));
        
        // If we have raw text, immediately recover using the Local Tool!
        if (rawTextForFallback) {
          const localFallback = parseMenuText(rawTextForFallback, currencies);
          if (localFallback.sections.length > 0 && localFallback.sections.some(s => s.items.length > 0)) {
            setExtractedSections(localFallback.sections);
            setExpandedSections(new Set(localFallback.sections.map((_, i) => i)));
            setDecipherEngineUsed('fallback');
            toast('The scanner was unreachable, so the menu was read on this device instead.');
            return;
          }
        }
        throw new Error(`Server returned unexpected format (${res.status}). Use the Local Tool instead for instant extraction.`);
      }

      if (!res.ok) {
        // If scanner returned 503 or error, check if we can fall back to local parser
        if (rawTextForFallback) {
          const localFallback = parseMenuText(rawTextForFallback, currencies);
          if (localFallback.sections.length > 0 && localFallback.sections.some(s => s.items.length > 0)) {
            setExtractedSections(localFallback.sections);
            setExpandedSections(new Set(localFallback.sections.map((_, i) => i)));
            setDecipherEngineUsed('fallback');
            toast('Read on this device');
            return;
          }
        }
        throw new Error(describeAIError(res, data));
      }

      if (data.sections && Array.isArray(data.sections) && data.sections.length > 0) {
        const sections: MenuSection[] = data.sections.map((s: any, sIdx: number) => ({
          id: s.id || `imported-section-${Date.now()}-${sIdx}`,
          name: s.name || `Section ${sIdx + 1}`,
          description: s.description || '',
          items: (s.items || []).map((item: any, iIdx: number) => ({
            id: item.id || `imported-item-${Date.now()}-${sIdx}-${iIdx}`,
            name: item.name || 'Unnamed item',
            description: item.description || '',
            // The scanner can return prices as strings ("14,000") or zero;
            // keep only real positive numbers so menu math stays numeric.
            prices: Object.fromEntries(
              Object.entries(item.prices || {})
                .map(([cur, v]) => [cur, Number(String(v).replace(/,/g, ''))] as const)
                .filter(([, v]) => Number.isFinite(v) && v > 0)
            ) as PriceMap,
            tags: item.tags || [],
          })),
        }));
        setExtractedSections(sections);
        setExpandedSections(new Set(sections.map((_, i) => i)));
        setDecipherEngineUsed(data.engine === 'local' ? 'local' : 'ai');
        toast.success(`Found ${sections.length} section(s) with ${sections.reduce((sum, s) => sum + s.items.length, 0)} items`);
      } else {
        // If scanner returned empty, try local parser
        if (rawTextForFallback) {
          const localFallback = parseMenuText(rawTextForFallback, currencies);
          if (localFallback.sections.length > 0) {
            setExtractedSections(localFallback.sections);
            setExpandedSections(new Set(localFallback.sections.map((_, i) => i)));
            setDecipherEngineUsed('fallback');
            toast.success('Read on this device');
            return;
          }
        }
        throw new Error('Could not extract menu items from this content. Please check the text or try a clearer file.');
      }
    } catch (err: any) {
      console.error('Menu extraction error:', err);
      // If we have text and haven't tried local yet, try it now
      if (activeTab === 'text' && pastedText.trim()) {
        try {
          const localFallback = parseMenuText(pastedText.trim(), currencies);
          if (localFallback.sections.length > 0 && localFallback.sections.some(s => s.items.length > 0)) {
            setExtractedSections(localFallback.sections);
            setExpandedSections(new Set(localFallback.sections.map((_, i) => i)));
            setDecipherEngineUsed('fallback');
            toast('Read on this device');
            return;
          }
        } catch {}
      }
      setError(err.message || 'Failed to process menu.');
    } finally {
      setProcessing(false);
    }
  };

  const handleApply = () => {
    if (extractedSections) {
      onImport(extractedSections);
      toast.success(`Added ${extractedSections.length} menu section(s) with ${extractedSections.reduce((sum, s) => sum + s.items.length, 0)} items`);
      handleClose();
    }
  };

  const toggleSection = (idx: number) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  const removeItem = (sIdx: number, iIdx: number) => {
    if (!extractedSections) return;
    const updated = [...extractedSections];
    updated[sIdx] = {
      ...updated[sIdx],
      items: updated[sIdx].items.filter((_, idx) => idx !== iIdx),
    };
    setExtractedSections(updated);
  };

  const removeSection = (sIdx: number) => {
    if (!extractedSections) return;
    setExtractedSections(extractedSections.filter((_, idx) => idx !== sIdx));
  };

  const updateItemPrice = (sIdx: number, iIdx: number, curr: 'USD' | 'MWK', val: number) => {
    if (!extractedSections) return;
    const updated = [...extractedSections];
    const item = updated[sIdx].items[iIdx];
    const prices: PriceMap = { ...item.prices, [curr]: val };
    if (!val || val <= 0) delete prices[curr];
    updated[sIdx].items[iIdx] = { ...item, prices };
    setExtractedSections(updated);
  };

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      id="menu-importer-modal"
      className="fixed inset-0 z-[100] overflow-y-auto overscroll-contain bg-stone-950/50 flex min-h-full items-center justify-center p-3 sm:p-4 md:p-6 text-center"
      data-lenis-prevent="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        ref={scrollIsolationRef}
        data-lenis-prevent="true"
        className="bg-white rounded-xl w-full max-w-2xl max-h-[calc(100dvh-2.5rem)] sm:max-h-[88vh] overflow-hidden shadow-sm flex flex-col border border-stone-200 text-left overscroll-contain my-auto relative"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 p-5 border-b border-stone-200 shrink-0">
          <div className="min-w-0">
            <h3 className="tm-h2">Import a menu</h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Paste text or upload a photo, PDF or spreadsheet. You check it before it is added.
            </p>
          </div>
          <button
            id="close-importer-btn"
            onClick={handleClose}
            className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-400 hover:text-stone-700 transition"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Engine Switcher Bar (only when smart scanner is available and not reviewing) */}
        {!extractedSections && hasSmartScanner && (
          <div className="px-5 pt-3 pb-2 border-b border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-1.5 text-xs text-stone-600 font-medium">
              <span>How to read it</span>
            </div>
            <div className="inline-flex p-1 rounded-lg bg-stone-100 text-xs font-medium">
              <button
                type="button"
                id="engine-local-btn"
                onClick={() => {
                  setEngine('local');
                  setError(null);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                  engine === 'local'
                    ? 'bg-white text-stone-900 shadow-sm'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                <span>On this device</span>
              </button>
              <button
                type="button"
                id="engine-ai-btn"
                onClick={() => {
                  setEngine('ai');
                  setError(null);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                  engine === 'ai'
                    ? 'bg-white text-stone-900 shadow-sm'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <ScanText className="w-3.5 h-3.5" />
                <span>Scan photos and PDFs</span>
              </button>
            </div>
          </div>
        )}

        {/* Tab Selector (only when not viewing extracted results) */}
        {!extractedSections && (
          <div className="flex border-b border-stone-200 px-5 pt-2 gap-2 shrink-0 overflow-x-auto">
            <button
              type="button"
              id="tab-paste-text"
              onClick={() => {
                setActiveTab('text');
                setError(null);
              }}
              className={`flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-semibold border-b-2 transition ${
                activeTab === 'text'
                  ? 'border-stone-900 text-stone-900'
                  : 'border-transparent text-stone-500 hover:text-stone-800'
              }`}
            >
              <ClipboardPaste className="w-4 h-4" />
              <span>Paste text</span>
            </button>
            <button
              type="button"
              id="tab-upload-file"
              onClick={() => {
                setActiveTab('file');
                setError(null);
              }}
              className={`flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-semibold border-b-2 transition ${
                activeTab === 'file'
                  ? 'border-stone-900 text-stone-900'
                  : 'border-transparent text-stone-500 hover:text-stone-800'
              }`}
            >
              <Upload className="w-4 h-4" />
              <span>Upload a file</span>
            </button>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 overscroll-contain" data-lenis-prevent="true">
          {!extractedSections ? (
            <>
              {activeTab === 'text' ? (
                /* Paste Raw Text Mode */
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-stone-600">
                    <span className="font-medium">Paste your menu or price list</span>
                    {pastedText.length > 0 && (
                      <span className="tabular-nums text-[11px] text-stone-400">
                        {pastedText.length} chars • {pastedText.split(/\r?\n/).length} lines
                      </span>
                    )}
                  </div>

                  <textarea
                    id="pasted-menu-textarea"
                    rows={10}
                    value={pastedText}
                    onChange={(e) => {
                      setPastedText(e.target.value);
                      setError(null);
                    }}
                    placeholder={`STARTERS

Chambo Fish Cakes - MWK 14,000 / USD 8
Fresh Lake Malawi chambo with spicy mayo dipping sauce (gf)

Spicy Samosas (3 pcs) - MWK 6,500
Vegetable or minced beef with mango chutney (v)

MAIN COURSES
Whole Grilled Lake Chambo - MWK 32,000 / USD 18
Served with lemon garlic butter, nsima or chips, and seasoned relish (sf)

Pan-Fried Kampango Fillet - MWK 28,000 / USD 16
Succulent lake catfish with garlic herbs (gf, sf)

BEVERAGES
Carlsberg Green (330ml) - MWK 2,500
Fresh Malawi Mango Smoothie - MWK 4,500`}
                    className="tm-input resize-none leading-relaxed"
                  />

                  {/* Live Local Analysis Card */}
                  {liveAnalysis && liveAnalysis.sections.length > 0 && (
                    <div className="p-3 bg-stone-50 rounded-lg flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-stone-900">
                            Found {liveAnalysis.stats.sectionsCount} section{liveAnalysis.stats.sectionsCount !== 1 ? 's' : ''} (
                            {liveAnalysis.sections.map((s) => s.name).slice(0, 3).join(', ')}
                            {liveAnalysis.sections.length > 3 ? '…' : ''}), {liveAnalysis.stats.itemsCount} dishes
                          </p>
                          <p className="text-[11px] text-stone-500">
                            {liveAnalysis.stats.pricesFoundCount} prices found
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        id="instant-decipher-btn"
                        onClick={() => processMenu('local')}
                        className="tm-btn tm-btn-secondary tm-btn-sm shrink-0"
                      >
                        Use this
                      </button>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-stone-500">
                    <div className="flex items-center gap-2">
                      <span>MWK and USD prices and tags like (gf), (v) are understood.</span>
                    </div>
                    {pastedText.length > 0 && (
                      <button
                        type="button"
                        id="clear-menu-text-btn"
                        onClick={() => setPastedText('')}
                        className="tm-link"
                      >
                        Clear text
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                /* Upload Document Mode */
                <>
                  <div
                    ref={dropRef}
                    id="dropzone-area"
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onClick={() => inputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                      file ? 'border-stone-400 bg-stone-50' : 'border-stone-300 hover:border-stone-400 hover:bg-stone-50'
                    }`}
                  >
                    <input
                      ref={inputRef}
                      type="file"
                      accept=".jpg,.jpeg,.png,.webp,.pdf,.txt,.csv,.xlsx"
                      onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                      className="hidden"
                    />
                    {file ? (
                      <div className="space-y-2">
                        {preview ? (
                          <img src={preview} alt="Menu preview" className="max-h-40 mx-auto rounded-lg object-contain" />
                        ) : (
                          <FileText className="w-12 h-12 mx-auto text-stone-500" />
                        )}
                        <p className="text-sm font-semibold text-stone-800">{file.name}</p>
                        <p className="text-xs text-stone-400">{(file.size / 1024).toFixed(0)} KB • Click to change</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex justify-center">
                          <Upload className="w-8 h-8 text-stone-400" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-stone-800">Drop your menu file here</p>
                          <p className="text-xs text-stone-400 mt-1">
                            or click to browse. Photo, PDF, text, CSV or Excel.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>


                </>
              )}

              {error && (
                <div id="importer-error-banner" className="flex items-start gap-2.5 p-3 bg-red-50 rounded-lg text-xs text-red-700">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-red-600" />
                  <div className="flex-1">
                    <p className="font-semibold">{error}</p>
                    {activeTab === 'file' && (
                      <p className="mt-1 text-stone-600">
                        Tip: copy the menu text into the "Paste text" tab instead.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Extracted Results Review */
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-emerald-50 rounded-lg">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Check className="w-4 h-4 text-emerald-700 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-emerald-900">
                      Extracted {extractedSections.length} section{extractedSections.length !== 1 ? 's' : ''} with{' '}
                      {extractedSections.reduce((sum, s) => sum + s.items.length, 0)} dishes
                    </p>
                    <p className="text-xs text-emerald-800 mt-0.5">
                      {decipherEngineUsed === 'ai'
                        ? 'Read by the scanner. Check the items below.'
                        : 'Read on this device. Check the items below.'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  id="re-extract-btn"
                  onClick={() => setExtractedSections(null)}
                  className="tm-btn tm-btn-quiet tm-btn-sm"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Try again</span>
                </button>
              </div>

              {/* Sections list */}
              <div className="space-y-3">
                {extractedSections.map((section, sIdx) => (
                  <div key={`ext-sec-${section.id || sIdx}-${sIdx}`} className="border border-stone-200 rounded-xl overflow-hidden">
                    <div className="w-full flex items-center justify-between p-3.5 bg-stone-50 border-b border-stone-200">
                      <button
                        type="button"
                        onClick={() => toggleSection(sIdx)}
                        className="flex items-center gap-2 text-left flex-1 min-w-0"
                      >
                        {expandedSections.has(sIdx) ? (
                          <ChevronUp className="w-4 h-4 text-stone-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-stone-400" />
                        )}
                        <div>
                          <p className="text-sm font-semibold text-stone-900 break-words">
                            {section.name}{' '}
                            <span className="text-xs font-normal text-stone-500">
                              ({section.items.length} item{section.items.length !== 1 ? 's' : ''})
                            </span>
                          </p>
                          {section.description && (
                            <p className="text-xs text-stone-500 mt-0.5">{section.description}</p>
                          )}
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => removeSection(sIdx)}
                        className="p-1 text-stone-400 hover:text-red-600 rounded transition ml-2"
                        title="Delete section"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {expandedSections.has(sIdx) && (
                      <div className="divide-y divide-stone-100 bg-white">
                        {section.items.length === 0 ? (
                          <p className="p-4 text-xs text-stone-400 italic text-center">No items in this section</p>
                        ) : (
                          section.items.map((item, iIdx) => (
                            <div key={`ext-item-${item.id || iIdx}-${sIdx}-${iIdx}`} className="p-3.5 flex justify-between items-start gap-3 hover:bg-stone-50/50 transition">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-stone-800 break-words">{item.name}</p>
                                {item.description && (
                                  <p className="text-xs text-stone-500 mt-1 leading-relaxed">{item.description}</p>
                                )}
                                {item.tags && item.tags.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1.5">
                                    {item.tags.map((tag, tIdx) => (
                                      <span
                                        key={`ext-tag-${tag}-${sIdx}-${iIdx}-${tIdx}`}
                                        className="tm-tag"
                                      >
                                        {tag}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>

                              <div className="flex items-center gap-3 shrink-0">
                                {item.prices && Object.keys(item.prices).length > 0 ? (
                                  <div className="text-right">
                                    {!!item.prices.MWK && (
                                      <p className="text-xs font-semibold text-stone-900 tabular-nums">
                                        MK {Number(item.prices.MWK).toLocaleString()}
                                      </p>
                                    )}
                                    {!!item.prices.USD && (
                                      <p className="text-xs font-medium text-stone-600">
                                        ${Number(item.prices.USD).toLocaleString()}
                                      </p>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-[11px] text-stone-400 italic">No price</span>
                                )}

                                <button
                                  type="button"
                                  onClick={() => removeItem(sIdx, iIdx)}
                                  className="p-1 text-stone-300 hover:text-red-500 rounded transition"
                                  title="Remove item"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-stone-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          {!extractedSections ? (
            <>
              <div className="text-xs text-stone-500 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-stone-400" />
                <span>
                  {engine === 'local'
                    ? 'Read in your browser. Nothing is uploaded.'
                    : 'Photos and PDFs are sent to the scanner to read.'}
                </span>
              </div>
              <div className="tm-actions w-full sm:w-auto justify-end">
                <button
                  type="button"
                  id="cancel-importer-btn"
                  onClick={handleClose}
                  className="tm-btn tm-btn-quiet"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  id="process-menu-btn"
                  onClick={() => processMenu()}
                  disabled={
                    processing ||
                    (activeTab === 'file' && !file) ||
                    (activeTab === 'text' && pastedText.trim().length < 5)
                  }
                  className="tm-btn tm-btn-primary"
                >
                  {processing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Reading menu…</span>
                    </>
                  ) : (
                    <>
                      <span>Read menu</span>
                    </>
                  )}
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-xs text-stone-500">
                Your existing menu sections are kept.
              </p>
              <div className="tm-actions w-full sm:w-auto justify-end">
                <button
                  type="button"
                  id="start-over-btn"
                  onClick={() => {
                    setExtractedSections(null);
                    setFile(null);
                    setPastedText('');
                    setPreview(null);
                  }}
                  className="tm-btn tm-btn-quiet"
                >
                  Start over
                </button>
                <button
                  type="button"
                  id="apply-menu-btn"
                  onClick={handleApply}
                  className="tm-btn tm-btn-primary"
                >
                  <Check className="w-4 h-4" />
                  <span>Add to menu</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
