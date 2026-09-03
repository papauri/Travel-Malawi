import React, { useState } from 'react';
import { useAIAssistant, AIGenerateOptions } from '../hooks/useAIAssistant';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { PenLine, RefreshCw, Check, X, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
  value: string;
  onChange: (text: string) => void;
  entityType: 'property' | 'room' | 'conference' | 'dining';
  context?: {
    name?: string;
    location?: string;
    locationNotes?: string;
    category?: string;
    amenities?: string[];
    capacity?: number;
    extraNotes?: string;
  };
  fieldLabel?: string;
  className?: string;
}

export default function AIAssistantButton({
  value,
  onChange,
  entityType,
  context,
  fieldLabel = 'description',
  className = '',
}: Props) {
  const { status, generate, generating } = useAIAssistant();
  const [isOpen, setIsOpen] = useState(false);
  useBodyScrollLock(isOpen);
  const [suggestion, setSuggestion] = useState<string>('');
  const [activeAction, setActiveAction] = useState<'draft' | 'polish' | 'shorten'>('draft');
  const [customNote, setCustomNote] = useState('');

  // Strict Kill Switch check: If admin disabled AI or no key configured, render nothing
  if (!status.enabled || !status.available) {
    return null;
  }

  const hasExistingText = !!value?.trim();

  const handleRun = async (action: 'draft' | 'polish' | 'shorten') => {
    setActiveAction(action);
    const options: AIGenerateOptions = {
      action,
      entityType,
      currentText: value,
      details: {
        ...context,
        extraNotes: customNote.trim() || context?.extraNotes,
      },
    };

    const result = await generate(options);
    if (result) {
      setSuggestion(result);
    }
  };

  const handleApply = () => {
    if (!suggestion) return;
    onChange(suggestion);
    toast.success('Applied to description');
    setIsOpen(false);
    setSuggestion('');
    setCustomNote('');
  };

  const handleOpen = () => {
    setIsOpen(true);
    setSuggestion('');
    setCustomNote('');
    // Auto-trigger appropriate action
    if (hasExistingText) {
      handleRun('polish');
    } else {
      handleRun('draft');
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-stone-600 hover:text-stone-900 bg-stone-100/90 hover:bg-stone-200/90 rounded-lg transition border border-stone-200/80 shadow-2xs ${className}`}
        title="Assist with writing description"
      >
        <PenLine className="w-3.5 h-3.5 text-stone-500" />
        <span>{hasExistingText ? 'Refine with Assistant' : 'Draft with Assistant'}</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white border border-stone-200 rounded-2xl shadow-xl max-w-xl w-full p-4 sm:p-6 space-y-4 sm:space-y-5 text-left relative max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-stone-100 pb-4">
              <div>
                <h3 className="font-serif font-bold text-lg text-stone-900 flex items-center gap-2">
                  <span>Writing Assistant</span>
                  <span className="text-[10px] font-sans font-semibold tracking-wider uppercase text-stone-500 bg-stone-100 px-2 py-0.5 rounded-full border border-stone-200/60">
                    {status.activeProvider}
                  </span>
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  Generate or refine your {fieldLabel} tailored for guests.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-stone-400 hover:text-stone-600 p-1.5 rounded-lg hover:bg-stone-100 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Action Tabs */}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={generating}
                onClick={() => handleRun('draft')}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition ${
                  activeAction === 'draft'
                    ? 'bg-stone-900 text-white border-stone-900'
                    : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
                }`}
              >
                Draft From Details
              </button>

              {hasExistingText && (
                <>
                  <button
                    type="button"
                    disabled={generating}
                    onClick={() => handleRun('polish')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition ${
                      activeAction === 'polish'
                        ? 'bg-stone-900 text-white border-stone-900'
                        : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
                    }`}
                  >
                    Polish & Enhance
                  </button>
                  <button
                    type="button"
                    disabled={generating}
                    onClick={() => handleRun('shorten')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition ${
                      activeAction === 'shorten'
                        ? 'bg-stone-900 text-white border-stone-900'
                        : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
                    }`}
                  >
                    Make Concise
                  </button>
                </>
              )}
            </div>

            {/* Extra Guidance */}
            <div>
              <label className="block text-xs font-semibold text-stone-600 mb-1">
                Custom details or emphasis <span className="text-stone-400 font-normal">(optional)</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customNote}
                  onChange={e => setCustomNote(e.target.value)}
                  placeholder="e.g. mention solar backup, beachfront firepit, or boat trips..."
                  className="w-full text-xs bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-stone-900 outline-none focus:border-stone-900 transition"
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleRun(activeAction);
                    }
                  }}
                />
                <button
                  type="button"
                  disabled={generating}
                  onClick={() => handleRun(activeAction)}
                  className="px-3 py-2 text-xs font-semibold bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl border border-stone-200 transition shrink-0"
                >
                  Regenerate
                </button>
              </div>
            </div>

            {/* Preview Box */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-stone-500 font-medium">
                <span>Suggested Description</span>
                {generating && (
                  <span className="inline-flex items-center gap-1.5 text-stone-600">
                    <Loader2 className="w-3 h-3 animate-spin" /> Drafting...
                  </span>
                )}
              </div>

              <div className="bg-stone-50/80 border border-stone-200 rounded-xl p-4 min-h-[120px] text-sm text-stone-800 leading-relaxed relative">
                {generating ? (
                  <div className="flex flex-col items-center justify-center py-6 text-stone-400 space-y-2">
                    <Loader2 className="w-5 h-5 animate-spin text-stone-600" />
                    <span className="text-xs">Formulating authentic description...</span>
                  </div>
                ) : suggestion ? (
                  <p className="whitespace-pre-line">{suggestion}</p>
                ) : (
                  <p className="text-stone-400 text-xs italic">
                    Click one of the options above to generate a draft.
                  </p>
                )}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 text-xs font-medium text-stone-600 hover:bg-stone-100 rounded-xl transition"
              >
                Cancel
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={generating || !suggestion}
                  onClick={() => handleRun(activeAction)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-xl border border-stone-200 transition disabled:opacity-50"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Try Again</span>
                </button>

                <button
                  type="button"
                  disabled={generating || !suggestion}
                  onClick={handleApply}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 rounded-xl transition shadow-sm disabled:opacity-50"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Use This Description</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
