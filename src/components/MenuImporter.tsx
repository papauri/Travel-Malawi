import React, { useState, useRef, useCallback, useMemo } from 'react';
import {
  Upload,
  FileText,
  Image,
  X,
  Check,
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  ClipboardPaste,
  Zap,
  Sparkles,
  Info,
  Trash2,
  Plus,
  RefreshCw,
  Edit2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { MenuSection, MenuItem, PriceMap } from '../types';
import { parseMenuText } from '../lib/localMenuParser';

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
          throw new Error('Local tool can directly decipher text, CSV, and formatted lists. For images or scanned PDFs, switch to AI Deep Scan or paste the menu text.');
        }

        const localResult = parseMenuText(textToParse, currencies);
        if (localResult.sections.length > 0 && localResult.sections.some(s => s.items.length > 0)) {
          setExtractedSections(localResult.sections);
          setExpandedSections(new Set(localResult.sections.map((_, i) => i)));
          setDecipherEngineUsed('local');
          toast.success(`⚡ Deciphered ${localResult.stats.itemsCount} items with Local Tool!`);
          return;
        } else {
          throw new Error('Could not identify distinct menu items. Try formatting lines with item name, dash, and price (e.g. "Chambo Cakes - MWK 14,000 / USD 8").');
        }
      }

      // 2. AI ENGINE EXECUTION (Sends to backend with safe response handling & local fallback)
      let res: Response;
      let rawTextForFallback = activeTab === 'text' ? pastedText.trim() : '';

      if (activeTab === 'text') {
        res = await fetch('/api/ai/parse-menu', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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
        // Server returned an HTML error or non-JSON page
        console.warn('Non-JSON response from /api/ai/parse-menu:', rawText.slice(0, 150));
        
        // If we have raw text, immediately recover using the Local Tool!
        if (rawTextForFallback) {
          const localFallback = parseMenuText(rawTextForFallback, currencies);
          if (localFallback.sections.length > 0 && localFallback.sections.some(s => s.items.length > 0)) {
            setExtractedSections(localFallback.sections);
            setExpandedSections(new Set(localFallback.sections.map((_, i) => i)));
            setDecipherEngineUsed('fallback');
            toast('AI provider was unreachable. Automatically deciphered using the Local Tool!', { icon: '⚡' });
            return;
          }
        }
        throw new Error(`Server returned unexpected format (${res.status}). Use the Local Tool instead for instant offline deciphering.`);
      }

      if (!res.ok) {
        // If AI returned 503 or error, check if we can fall back to local parser
        if (rawTextForFallback) {
          const localFallback = parseMenuText(rawTextForFallback, currencies);
          if (localFallback.sections.length > 0 && localFallback.sections.some(s => s.items.length > 0)) {
            setExtractedSections(localFallback.sections);
            setExpandedSections(new Set(localFallback.sections.map((_, i) => i)));
            setDecipherEngineUsed('fallback');
            toast('Deciphered using Local Tool (AI not configured)', { icon: '⚡' });
            return;
          }
        }
        throw new Error(data.error || `Processing failed (${res.status})`);
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
            prices: item.prices || {},
            tags: item.tags || [],
          })),
        }));
        setExtractedSections(sections);
        setExpandedSections(new Set(sections.map((_, i) => i)));
        setDecipherEngineUsed(data.engine === 'local' ? 'local' : 'ai');
        toast.success(`Imported ${sections.length} section(s) with ${sections.reduce((sum, s) => sum + s.items.length, 0)} items!`);
      } else {
        // If AI returned empty, try local parser
        if (rawTextForFallback) {
          const localFallback = parseMenuText(rawTextForFallback, currencies);
          if (localFallback.sections.length > 0) {
            setExtractedSections(localFallback.sections);
            setExpandedSections(new Set(localFallback.sections.map((_, i) => i)));
            setDecipherEngineUsed('fallback');
            toast.success('Deciphered using Local Tool!');
            return;
          }
        }
        throw new Error('Could not extract menu items from this content. Please check the text or try a clearer file.');
      }
    } catch (err: any) {
      console.error('Decipher menu error:', err);
      // If we have text and haven't tried local yet, try it now
      if (activeTab === 'text' && pastedText.trim()) {
        try {
          const localFallback = parseMenuText(pastedText.trim(), currencies);
          if (localFallback.sections.length > 0 && localFallback.sections.some(s => s.items.length > 0)) {
            setExtractedSections(localFallback.sections);
            setExpandedSections(new Set(localFallback.sections.map((_, i) => i)));
            setDecipherEngineUsed('fallback');
            toast('Deciphered with Local Tool (offline)', { icon: '⚡' });
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
      toast.success(`Imported ${extractedSections.length} menu section(s) with ${extractedSections.reduce((sum, s) => sum + s.items.length, 0)} items!`);
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

  if (!open) return null;

  return (
    <div id="menu-importer-modal" className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col border border-stone-200">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-stone-200 bg-stone-50/50">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-stone-900">Decipher & Import Menu</h3>
              <span className="text-[10px] font-medium tracking-wide uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                Local + AI Tools
              </span>
            </div>
            <p className="text-xs text-stone-500 mt-0.5">
              Instantly parse menus from plain text, CSV, photos, PDFs, or spreadsheets
            </p>
          </div>
          <button
            id="close-importer-btn"
            onClick={handleClose}
            className="p-1.5 rounded-full hover:bg-stone-200/70 text-stone-400 hover:text-stone-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Engine Switcher Bar (when not reviewing) */}
        {!extractedSections && (
          <div className="px-5 pt-3 pb-2 bg-stone-50 border-b border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs text-stone-600 font-medium">
              <span>Deciphering Engine:</span>
            </div>
            <div className="inline-flex p-1 rounded-xl bg-stone-200/70 text-xs font-semibold">
              <button
                type="button"
                id="engine-local-btn"
                onClick={() => {
                  setEngine('local');
                  setError(null);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                  engine === 'local'
                    ? 'bg-white text-emerald-700 shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <Zap className="w-3.5 h-3.5 text-emerald-600" />
                <span>Local Tool (Fast & Offline)</span>
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
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                <span>AI Vision Scan</span>
              </button>
            </div>
          </div>
        )}

        {/* Tab Selector (only when not viewing extracted results) */}
        {!extractedSections && (
          <div className="flex border-b border-stone-200 bg-stone-50 px-5 pt-2 gap-2">
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
              <span>Paste Menu Text / CSV</span>
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
              <span>Upload Document (Photo / PDF / TXT)</span>
            </button>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {!extractedSections ? (
            <>
              {activeTab === 'text' ? (
                /* Paste Raw Text Mode */
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-stone-600">
                    <span className="font-medium">Paste your menu text or price list below:</span>
                    {pastedText.length > 0 && (
                      <span className="font-mono text-[11px] text-stone-400">
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
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3.5 text-xs font-mono outline-none focus:border-stone-900 focus:bg-white transition resize-none leading-relaxed"
                  />

                  {/* Live Local Analysis Card */}
                  {liveAnalysis && liveAnalysis.sections.length > 0 && (
                    <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
                          <Zap className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-emerald-900">
                            Local Tool Detected: {liveAnalysis.stats.sectionsCount} section{liveAnalysis.stats.sectionsCount !== 1 ? 's' : ''} (
                            {liveAnalysis.sections.map((s) => s.name).slice(0, 3).join(', ')}
                            {liveAnalysis.sections.length > 3 ? '...' : ''}), {liveAnalysis.stats.itemsCount} dishes
                          </p>
                          <p className="text-[11px] text-emerald-700">
                            {liveAnalysis.stats.pricesFoundCount} prices detected with tags • Ready to decipher in 0ms without AI
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        id="instant-decipher-btn"
                        onClick={() => processMenu('local')}
                        className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg shadow-xs transition shrink-0"
                      >
                        ⚡ Decipher Now
                      </button>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[11px] text-stone-500">
                    <div className="flex items-center gap-2">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      <span>Supports MWK, USD, dual currencies, and tags like (gf), (v), (sf)</span>
                    </div>
                    {pastedText.length > 0 && (
                      <button
                        type="button"
                        id="clear-menu-text-btn"
                        onClick={() => setPastedText('')}
                        className="text-stone-500 hover:text-stone-800 underline"
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
                      file ? 'border-emerald-300 bg-emerald-50' : 'border-stone-300 hover:border-stone-400 hover:bg-stone-50'
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
                          <FileText className="w-12 h-12 mx-auto text-emerald-500" />
                        )}
                        <p className="text-sm font-semibold text-stone-800">{file.name}</p>
                        <p className="text-xs text-stone-400">{(file.size / 1024).toFixed(0)} KB • Click to change</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex justify-center gap-3">
                          <Image className="w-8 h-8 text-stone-400" />
                          <FileText className="w-8 h-8 text-stone-400" />
                          <Upload className="w-8 h-8 text-stone-400" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-stone-800">Drop your menu file here</p>
                          <p className="text-xs text-stone-400 mt-1">
                            or click to browse • Text files, CSV, Excel, photos, or PDFs
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs text-stone-600">
                    <div className="flex items-center gap-2 p-2.5 bg-stone-50 rounded-lg border border-stone-200">
                      <Zap className="w-4 h-4 text-emerald-600" />
                      <span>Text (.txt) or CSV: 100% Local Tool</span>
                    </div>
                    <div className="flex items-center gap-2 p-2.5 bg-stone-50 rounded-lg border border-stone-200">
                      <Image className="w-4 h-4 text-blue-500" />
                      <span>Photo or scanned page (AI OCR)</span>
                    </div>
                    <div className="flex items-center gap-2 p-2.5 bg-stone-50 rounded-lg border border-stone-200">
                      <FileText className="w-4 h-4 text-red-500" />
                      <span>PDF menu file (AI OCR)</span>
                    </div>
                    <div className="flex items-center gap-2 p-2.5 bg-stone-50 rounded-lg border border-stone-200">
                      <FileText className="w-4 h-4 text-emerald-600" />
                      <span>Excel spreadsheet (.xlsx)</span>
                    </div>
                  </div>
                </>
              )}

              {error && (
                <div id="importer-error-banner" className="flex items-start gap-2.5 p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-red-600" />
                  <div className="flex-1">
                    <p className="font-semibold">{error}</p>
                    {activeTab === 'file' && (
                      <p className="mt-1 text-stone-600">
                        Tip: You can copy and paste the text directly into the "Paste Menu Text" tab to use the instant Local Tool.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Extracted Results Review */
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                    <Check className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-emerald-950">
                      Deciphered {extractedSections.length} section{extractedSections.length !== 1 ? 's' : ''} with{' '}
                      {extractedSections.reduce((sum, s) => sum + s.items.length, 0)} dishes
                    </p>
                    <p className="text-xs text-emerald-700 flex items-center gap-1.5 mt-0.5">
                      {decipherEngineUsed === 'local' ? (
                        <>
                          <Zap className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Deciphered via Local Parser Tool (zero network latency)</span>
                        </>
                      ) : decipherEngineUsed === 'fallback' ? (
                        <>
                          <Zap className="w-3.5 h-3.5 text-amber-600" />
                          <span>Deciphered via Local Tool Fallback (AI was offline)</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Deciphered via AI Vision Engine</span>
                        </>
                      )}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  id="re-extract-btn"
                  onClick={() => setExtractedSections(null)}
                  className="text-xs text-stone-500 hover:text-stone-900 flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-emerald-100/60 transition"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Re-parse</span>
                </button>
              </div>

              {/* Sections list */}
              <div className="space-y-3">
                {extractedSections.map((section, sIdx) => (
                  <div key={`ext-sec-${section.id || sIdx}-${sIdx}`} className="border border-stone-200 rounded-xl overflow-hidden shadow-xs">
                    <div className="w-full flex items-center justify-between p-3.5 bg-stone-50/80 border-b border-stone-200">
                      <button
                        type="button"
                        onClick={() => toggleSection(sIdx)}
                        className="flex items-center gap-2 text-left flex-1"
                      >
                        {expandedSections.has(sIdx) ? (
                          <ChevronUp className="w-4 h-4 text-stone-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-stone-400" />
                        )}
                        <div>
                          <p className="text-sm font-bold text-stone-900">
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
                                <p className="text-sm font-semibold text-stone-800">{item.name}</p>
                                {item.description && (
                                  <p className="text-xs text-stone-500 mt-1 leading-relaxed">{item.description}</p>
                                )}
                                {item.tags && item.tags.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1.5">
                                    {item.tags.map((tag, tIdx) => (
                                      <span
                                        key={`ext-tag-${tag}-${sIdx}-${iIdx}-${tIdx}`}
                                        className="text-[10px] uppercase font-semibold px-2 py-0.5 bg-stone-100 text-stone-600 rounded-md"
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
                                    {item.prices.MWK && (
                                      <p className="text-xs font-bold text-emerald-800">
                                        MK {Number(item.prices.MWK).toLocaleString()}
                                      </p>
                                    )}
                                    {item.prices.USD && (
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
        <div className="p-4 border-t border-stone-200 bg-stone-50/50 flex flex-col sm:flex-row items-center justify-between gap-3">
          {!extractedSections ? (
            <>
              <div className="text-xs text-stone-500 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-stone-400" />
                <span>
                  {engine === 'local'
                    ? 'Local Tool runs 100% in your browser. No AI or network required.'
                    : 'AI Vision analyzes images and PDFs using machine learning models.'}
                </span>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  id="cancel-importer-btn"
                  onClick={handleClose}
                  className="px-4 py-2 text-xs font-semibold text-stone-600 hover:text-stone-800 rounded-full transition"
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
                  className="px-5 py-2.5 text-xs font-semibold bg-stone-900 text-white rounded-full hover:bg-stone-800 disabled:opacity-40 flex items-center gap-2 shadow-xs transition"
                >
                  {processing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Deciphering Menu...</span>
                    </>
                  ) : (
                    <>
                      {engine === 'local' ? <Zap className="w-4 h-4 text-emerald-400" /> : <Sparkles className="w-4 h-4 text-indigo-300" />}
                      <span>{engine === 'local' ? 'Decipher with Local Tool' : 'Decipher with AI'}</span>
                    </>
                  )}
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-xs text-stone-500">
                Ready to add to restaurant menu. Existing sections will be preserved or merged.
              </p>
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  id="start-over-btn"
                  onClick={() => {
                    setExtractedSections(null);
                    setFile(null);
                    setPastedText('');
                    setPreview(null);
                  }}
                  className="px-4 py-2 text-xs font-semibold text-stone-600 hover:text-stone-800 transition"
                >
                  Start Over
                </button>
                <button
                  type="button"
                  id="apply-menu-btn"
                  onClick={handleApply}
                  className="px-5 py-2.5 text-xs font-semibold bg-emerald-700 text-white rounded-full hover:bg-emerald-600 flex items-center gap-2 shadow-xs transition"
                >
                  <Check className="w-4 h-4" />
                  <span>Apply to Restaurant Menu</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
