import React, { useState, useRef, useCallback } from 'react';
import { Upload, FileText, Image, X, Check, Loader2, AlertCircle, ChevronDown, ChevronUp, ClipboardPaste } from 'lucide-react';
import toast from 'react-hot-toast';
import { MenuSection, MenuItem, PriceMap } from '../types';

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
  const [activeTab, setActiveTab] = useState<'file' | 'text'>('file');
  const [file, setFile] = useState<File | null>(null);
  const [pastedText, setPastedText] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extractedSections, setExtractedSections] = useState<MenuSection[] | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  const reset = () => {
    setFile(null);
    setPastedText('');
    setPreview(null);
    setProcessing(false);
    setError(null);
    setExtractedSections(null);
    setExpandedSections(new Set());
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

  const processMenu = async () => {
    if (activeTab === 'file' && !file) return;
    if (activeTab === 'text' && !pastedText.trim()) {
      setError('Please paste your menu text first.');
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      let res: Response;
      if (activeTab === 'text') {
        res = await fetch('/api/ai/parse-menu', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: pastedText.trim(), currencies }),
        });
      } else {
        const formData = new FormData();
        formData.append('menu', file!);
        formData.append('currencies', JSON.stringify(currencies));

        res = await fetch('/api/ai/parse-menu', {
          method: 'POST',
          body: formData,
        });
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Processing failed (${res.status})`);
      }

      const data = await res.json();
      if (data.sections && Array.isArray(data.sections) && data.sections.length > 0) {
        // Ensure IDs
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
        setExpandedSections(new Set(sections.map((_: any, i: number) => i)));
      } else {
        throw new Error('Could not extract menu items from this content. Please check the text or try a clearer file.');
      }
    } catch (err: any) {
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
    setExpandedSections(prev => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-stone-200">
          <div>
            <h3 className="text-lg font-semibold text-stone-900">Import Existing Menu</h3>
            <p className="text-xs text-stone-500 mt-0.5">Decipher your menu from massive text, photo, PDF, Excel, or CSV</p>
          </div>
          <button onClick={handleClose} className="p-1.5 rounded-full hover:bg-stone-100 text-stone-400 hover:text-stone-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector (only when not viewing extracted results) */}
        {!extractedSections && (
          <div className="flex border-b border-stone-200 bg-stone-50 p-1.5 gap-1.5">
            <button
              type="button"
              onClick={() => { setActiveTab('file'); setError(null); }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold transition ${
                activeTab === 'file'
                  ? 'bg-white text-stone-900 shadow-xs border border-stone-200'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload File (Photo / PDF / Excel)</span>
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab('text'); setError(null); }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold transition ${
                activeTab === 'text'
                  ? 'bg-white text-stone-900 shadow-xs border border-stone-200'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              <ClipboardPaste className="w-3.5 h-3.5" />
              <span>Paste Menu Text</span>
            </button>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {!extractedSections ? (
            <>
              {activeTab === 'file' ? (
                <>
                  {/* Drop Zone */}
                  <div
                    ref={dropRef}
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
                        <p className="text-sm font-medium text-stone-700">{file.name}</p>
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
                          <p className="text-sm font-medium text-stone-700">Drop your menu file here</p>
                          <p className="text-xs text-stone-400 mt-1">or click to browse • Photos, PDFs, text, CSV, or Excel</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Supported formats */}
                  <div className="grid grid-cols-2 gap-2 text-xs text-stone-500">
                    <div className="flex items-center gap-2 p-2 bg-stone-50 rounded-lg">
                      <Image className="w-4 h-4 text-blue-500" />
                      <span>Photo of printed menu</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 bg-stone-50 rounded-lg">
                      <FileText className="w-4 h-4 text-red-500" />
                      <span>PDF menu file</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 bg-stone-50 rounded-lg">
                      <FileText className="w-4 h-4 text-green-500" />
                      <span>Text or CSV file</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 bg-stone-50 rounded-lg">
                      <FileText className="w-4 h-4 text-emerald-600" />
                      <span>Excel spreadsheet (.xlsx)</span>
                    </div>
                  </div>
                </>
              ) : (
                /* Paste Raw Text Mode */
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-stone-500">
                    <span>Paste raw menu text, price lists, or email excerpts:</span>
                    {pastedText.length > 0 && (
                      <span className="font-mono text-[11px]">{pastedText.length} characters</span>
                    )}
                  </div>
                  <textarea
                    rows={10}
                    value={pastedText}
                    onChange={(e) => { setPastedText(e.target.value); setError(null); }}
                    placeholder={`Paste massive menu text here. For example:

STARTERS
Chambo Fish Cakes - MWK 14,000 / USD 8
Fresh Lake Malawi chambo with spicy mayo dipping sauce (gf)

Spicy Samosas (3 pcs) - MWK 6,500
Vegetable or minced beef with mango chutney (v)

MAIN COURSES
Whole Grilled Lake Chambo - MWK 32,000 / USD 18
Served with lemon garlic butter, nsima or chips, and seasoned relish

Pan-Fried Kampango Fillet - MWK 28,000 / USD 16
Succulent lake catfish with garlic herbs

BEVERAGES
Carlsberg Green (330ml) - MWK 2,500
Fresh Malawi Mango Smoothie - MWK 4,500`}
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3.5 text-xs font-mono outline-none focus:border-stone-900 transition resize-none leading-relaxed"
                  />
                  <div className="flex items-center justify-between text-[11px] text-stone-400">
                    <span>Automatic price detection in USD and MWK</span>
                    {pastedText.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setPastedText('')}
                        className="text-stone-500 hover:text-stone-800 underline"
                      >
                        Clear text
                      </button>
                    )}
                  </div>
                </div>
              )}

              {error && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </>
          ) : (
            /* Extracted Results Review */
            <div className="space-y-3">
              <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                <Check className="w-5 h-5 text-emerald-600 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-emerald-800">
                    Found {extractedSections.length} section{extractedSections.length !== 1 ? 's' : ''} with{' '}
                    {extractedSections.reduce((sum, s) => sum + s.items.length, 0)} items
                  </p>
                  <p className="text-xs text-emerald-600">Review below, then apply to your menu</p>
                </div>
              </div>

              {extractedSections.map((section, sIdx) => (
                <div key={`ext-sec-${section.id || sIdx}-${sIdx}`} className="border border-stone-200 rounded-lg overflow-hidden">
                  <button
                    onClick={() => toggleSection(sIdx)}
                    className="w-full flex items-center justify-between p-3 bg-stone-50 hover:bg-stone-100 transition"
                  >
                    <div className="text-left">
                      <p className="text-sm font-semibold text-stone-800">
                        {section.name}{' '}
                        <span className="text-xs font-normal text-stone-400">({section.items.length} items)</span>
                      </p>
                      {section.description && (
                        <p className="text-xs text-stone-500 mt-0.5">{section.description}</p>
                      )}
                    </div>
                    {expandedSections.has(sIdx) ? (
                      <ChevronUp className="w-4 h-4 text-stone-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-stone-400" />
                    )}
                  </button>

                  {expandedSections.has(sIdx) && (
                    <div className="divide-y divide-stone-100">
                      {section.items.map((item, iIdx) => (
                        <div key={`ext-item-${item.id || iIdx}-${sIdx}-${iIdx}`} className="p-3 flex justify-between items-start">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-stone-700 truncate">{item.name}</p>
                            {item.description && (
                              <p className="text-xs text-stone-400 mt-0.5 line-clamp-2">{item.description}</p>
                            )}
                            {item.tags && item.tags.length > 0 && (
                              <div className="flex gap-1 mt-1">
                                {item.tags.map((tag, tIdx) => (
                                  <span key={`ext-tag-${tag}-${sIdx}-${iIdx}-${tIdx}`} className="text-[10px] px-1.5 py-0.5 bg-stone-100 text-stone-500 rounded-full">{tag}</span>
                                ))}
                              </div>
                            )}
                          </div>
                          {item.prices && Object.keys(item.prices).length > 0 && (
                            <div className="text-right ml-3 shrink-0">
                              {Object.entries(item.prices).map(([code, amount], pIdx) => (
                                <p key={`ext-price-${code}-${sIdx}-${iIdx}-${pIdx}`} className="text-xs font-medium text-stone-600">
                                  {code === 'MWK' ? `MK ${Number(amount).toLocaleString()}` : `$${amount}`}
                                </p>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-stone-200 flex justify-end gap-3">
          {!extractedSections ? (
            <>
              <button onClick={handleClose} className="px-4 py-2 text-sm text-stone-600 hover:text-stone-800">
                Cancel
              </button>
              <button
                onClick={processMenu}
                disabled={
                  processing ||
                  (activeTab === 'file' && !file) ||
                  (activeTab === 'text' && pastedText.trim().length < 5)
                }
                className="px-5 py-2 text-sm font-medium bg-stone-900 text-white rounded-full hover:bg-stone-800 disabled:opacity-40 flex items-center gap-2 shadow-xs transition"
              >
                {processing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Deciphering Menu...</span>
                  </>
                ) : (
                  <span>Decipher Menu</span>
                )}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => { setExtractedSections(null); setFile(null); setPastedText(''); setPreview(null); }}
                className="px-4 py-2 text-sm text-stone-600 hover:text-stone-800"
              >
                Start Over
              </button>
              <button
                onClick={handleApply}
                className="px-5 py-2 text-sm font-medium bg-emerald-700 text-white rounded-full hover:bg-emerald-600 flex items-center gap-2 shadow-xs transition"
              >
                <Check className="w-4 h-4" />
                <span>Apply to Restaurant Menu</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
