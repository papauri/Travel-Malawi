import React, { useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Upload, FileText, Image, X, Check, Loader2, AlertCircle, ClipboardPaste, Building } from 'lucide-react';
import toast from 'react-hot-toast';
import { ListingDraft } from '../lib/listing';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { useModalScrollIsolation } from '../hooks/useModalScrollIsolation';

interface PropertyDocumentImporterProps {
  open: boolean;
  onClose: () => void;
  onImport: (data: Partial<ListingDraft>) => void;
}

const ACCEPTED_TYPES = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
  'text/plain': '.txt',
};

const MAX_SIZE_MB = 8;

export default function PropertyDocumentImporter({ open, onClose, onImport }: PropertyDocumentImporterProps) {
  const [activeTab, setActiveTab] = useState<'file' | 'text'>('file');
  const [file, setFile] = useState<File | null>(null);
  const [pastedText, setPastedText] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<Partial<ListingDraft> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  useBodyScrollLock(open);
  const scrollIsolationRef = useModalScrollIsolation<HTMLDivElement>(open);

  const reset = () => {
    setFile(null);
    setPastedText('');
    setPreview(null);
    setProcessing(false);
    setError(null);
    setExtractedData(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFile = useCallback((f: File) => {
    setError(null);
    setExtractedData(null);

    if (f.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`File too large. Maximum size is ${MAX_SIZE_MB}MB.`);
      return;
    }

    const accepted = Object.keys(ACCEPTED_TYPES);
    if (!accepted.includes(f.type) && !f.name.match(/\.(jpg|jpeg|png|webp|pdf|txt)$/i)) {
      setError('Unsupported file type. Please upload an image, PDF, or text file.');
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

  const processDocument = async () => {
    if (activeTab === 'file' && !file) return;
    if (activeTab === 'text' && !pastedText.trim()) {
      setError('Please paste your text first.');
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      let res: Response;
      if (activeTab === 'text') {
        res = await fetch('/api/ai/parse-property-doc', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: pastedText.trim() }),
        });
      } else {
        const formData = new FormData();
        formData.append('document', file!);
        res = await fetch('/api/ai/parse-property-doc', {
          method: 'POST',
          body: formData,
        });
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Processing failed (${res.status})`);
      }

      const data = await res.json();
      if (data && data.extracted) {
        setExtractedData(data.extracted);
      } else {
        throw new Error('Could not extract property details from this content.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to process document.');
    } finally {
      setProcessing(false);
    }
  };

  const handleApply = () => {
    if (extractedData) {
      const normalizedData: Partial<ListingDraft> = {
        ...extractedData,
      };
      if (Array.isArray(extractedData.rooms)) {
        normalizedData.rooms = (extractedData.rooms as any[]).map((r: any) => ({
          name: r.name || 'Standard Room',
          description: r.description || '',
          maxGuests: Number(r.maxGuests) || 2,
          quantity: 1,
          currencies: ['USD', 'MWK'],
          prices: {
            USD: Number(r.prices?.USD ?? r.priceUSD) || 50,
            MWK: Number(r.prices?.MWK ?? r.priceMWK) || 85000,
          },
        }));
      }
      onImport(normalizedData);
      toast.success('Property details imported successfully!');
      handleClose();
    }
  };

  if (!open || typeof document === 'undefined') return null;

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
        className="bg-white rounded-2xl sm:rounded-3xl w-full max-w-lg max-h-[calc(100dvh-2.5rem)] sm:max-h-[88vh] overflow-hidden shadow-2xl flex flex-col border border-stone-200 text-left overscroll-contain my-auto relative"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-stone-200 shrink-0">
          <div>
            <h3 className="text-lg font-semibold text-stone-900">Import Property Details</h3>
            <p className="text-xs text-stone-500 mt-0.5">Auto-fill rooms, prices, owners from a document or photo</p>
          </div>
          <button onClick={handleClose} className="p-1.5 rounded-full hover:bg-stone-100 text-stone-400 hover:text-stone-600 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        {!extractedData && (
          <div className="flex border-b border-stone-200 bg-stone-50 p-1.5 gap-1.5 shrink-0">
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
              <span>Upload File (Photo / PDF)</span>
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
              <span>Paste Text</span>
            </button>
          </div>
        )}

        {/* Body */}
        <div data-lenis-prevent="true" className="flex-1 overflow-y-auto overscroll-contain p-5 space-y-4">
          {!extractedData ? (
            <>
              {activeTab === 'file' ? (
                <>
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
                      accept=".jpg,.jpeg,.png,.webp,.pdf,.txt"
                      onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                      className="hidden"
                    />
                    {file ? (
                      <div className="space-y-2">
                        {preview ? (
                          <img src={preview} alt="Document preview" className="max-h-40 mx-auto rounded-lg object-contain" />
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
                        </div>
                        <div>
                          <p className="text-sm font-medium text-stone-700">Drop your pricing sheet or document here</p>
                          <p className="text-xs text-stone-400 mt-1">or click to browse • Photos, PDFs, or text</p>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-stone-500">
                    <span>Paste raw document text or pricing lists:</span>
                  </div>
                  <textarea
                    rows={10}
                    value={pastedText}
                    onChange={(e) => { setPastedText(e.target.value); setError(null); }}
                    placeholder="Paste your property details here..."
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3.5 text-xs font-mono outline-none focus:border-stone-900 transition resize-none leading-relaxed"
                  />
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
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                <Check className="w-5 h-5 text-emerald-600 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-emerald-800">
                    Document Extracted Successfully
                  </p>
                  <p className="text-xs text-emerald-600">Review the details below. We'll fill the form with this information.</p>
                </div>
              </div>

              <div className="space-y-3">
                {extractedData.name && (
                  <div>
                    <span className="text-[10px] font-bold text-stone-400 uppercase">Property Name</span>
                    <p className="text-sm text-stone-800 font-medium">{extractedData.name}</p>
                  </div>
                )}
                {extractedData.description && (
                  <div>
                    <span className="text-[10px] font-bold text-stone-400 uppercase">Description</span>
                    <p className="text-xs text-stone-700">{extractedData.description}</p>
                  </div>
                )}
                {extractedData.rooms && extractedData.rooms.length > 0 && (
                  <div>
                    <span className="text-[10px] font-bold text-stone-400 uppercase">Rooms ({extractedData.rooms.length})</span>
                    <ul className="text-xs text-stone-700 mt-1 space-y-1">
                      {extractedData.rooms.map((r: any, i) => {
                        const usd = r.prices?.USD ?? r.priceUSD ?? 0;
                        const mwk = r.prices?.MWK ?? r.priceMWK ?? 0;
                        return (
                          <li key={`extracted-room-${r.name || 'room'}-${i}`}>• {r.name} - ${usd} / MK {Number(mwk).toLocaleString()} (Max {r.maxGuests ?? 2})</li>
                        );
                      })}
                    </ul>
                  </div>
                )}
                {extractedData.amenities && extractedData.amenities.length > 0 && (
                  <div>
                    <span className="text-[10px] font-bold text-stone-400 uppercase">Amenities</span>
                    <p className="text-xs text-stone-700">{extractedData.amenities.join(', ')}</p>
                  </div>
                )}
                {extractedData.ownerName && (
                  <div>
                    <span className="text-[10px] font-bold text-stone-400 uppercase">Owner/Manager</span>
                    <p className="text-xs text-stone-700">{extractedData.ownerName} {extractedData.ownerEmail && `(${extractedData.ownerEmail})`} {extractedData.ownerPhone && `- ${extractedData.ownerPhone}`}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-stone-200 flex justify-end gap-3">
          {!extractedData ? (
            <>
              <button onClick={handleClose} className="px-4 py-2 text-sm text-stone-600 hover:text-stone-800">
                Cancel
              </button>
              <button
                onClick={processDocument}
                disabled={processing || (activeTab === 'file' && !file) || (activeTab === 'text' && pastedText.trim().length < 5)}
                className="px-5 py-2 text-sm font-medium bg-stone-900 text-white rounded-full hover:bg-stone-800 flex items-center gap-2 disabled:opacity-40"
              >
                {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Building className="w-4 h-4" />}
                <span>{processing ? 'Processing...' : 'Process Document'}</span>
              </button>
            </>
          ) : (
            <>
              <button onClick={reset} className="px-4 py-2 text-sm text-stone-600 hover:text-stone-800">
                Start Over
              </button>
              <button onClick={handleApply} className="px-5 py-2 text-sm font-medium bg-emerald-700 text-white rounded-full hover:bg-emerald-600 flex items-center gap-2">
                <Check className="w-4 h-4" />
                <span>Apply to Listing</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
