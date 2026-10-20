import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useAIAssistant, AIGenerateOptions } from '../hooks/useAIAssistant';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { useModalScrollIsolation } from '../hooks/useModalScrollIsolation';
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
  const scrollIsolationRef = useModalScrollIsolation<HTMLDivElement>(isOpen);
  const [suggestion, setSuggestion] = useState<string>('');
  const [activeAction, setActiveAction] = useState<'draft' | 'polish' | 'shorten'>('draft');
  const [customNote, setCustomNote] = useState('');

  // Strict Kill Switch check: If admin completely disabled AI system-wide or AI is unavailable, render nothing
  if (!status.available || !status.enabled) {
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
    toast.success(`Applied to ${fieldLabel}`);
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

  const choiceClass = (action: 'draft' | 'polish' | 'shorten') =>
    `tm-btn tm-btn-sm ${activeAction === action ? 'tm-btn-primary' : 'tm-btn-secondary'}`;

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className={`tm-btn tm-btn-secondary tm-btn-sm ${className}`}
        title={`Help me write the ${fieldLabel}`}
      >
        <PenLine className="w-3.5 h-3.5" aria-hidden="true" />
        <span>{hasExistingText ? `Improve ${fieldLabel}` : `Write ${fieldLabel} for me`}</span>
      </button>

      {isOpen && typeof document !== 'undefined' && createPortal(
        <div
          data-lenis-prevent="true"
          className="fixed inset-0 z-[160] overflow-y-auto overscroll-contain flex min-h-full items-center justify-center p-3 sm:p-4 text-center bg-stone-900/40 animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsOpen(false);
          }}
        >
          <div
            ref={scrollIsolationRef}
            data-lenis-prevent="true"
            role="dialog"
            aria-modal="true"
            aria-label={`Write the ${fieldLabel}`}
            className="tm-panel shadow-sm max-w-xl w-full space-y-4 text-left relative max-h-[calc(100dvh-2.5rem)] sm:max-h-[88vh] overflow-y-auto overscroll-contain my-auto min-w-0"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="tm-h2">{hasExistingText ? `Improve your ${fieldLabel}` : `Write your ${fieldLabel}`}</h3>
                <p className="tm-muted mt-0.5">Pick a starting point, read the draft, then use it or edit it yourself.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="tm-btn tm-btn-quiet tm-btn-sm shrink-0"
                aria-label="Close"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <div className="tm-actions">
              <button type="button" disabled={generating} onClick={() => handleRun('draft')} className={choiceClass('draft')}>
                Write from my details
              </button>
              {hasExistingText && (
                <>
                  <button type="button" disabled={generating} onClick={() => handleRun('polish')} className={choiceClass('polish')}>
                    Tidy it up
                  </button>
                  <button type="button" disabled={generating} onClick={() => handleRun('shorten')} className={choiceClass('shorten')}>
                    Make it shorter
                  </button>
                </>
              )}
            </div>

            <div>
              <label htmlFor="ai-assist-note" className="tm-label">
                Anything to mention? <span className="font-normal text-stone-400">(optional)</span>
              </label>
              <input
                id="ai-assist-note"
                type="text"
                value={customNote}
                onChange={e => setCustomNote(e.target.value)}
                placeholder="e.g. solar backup, beach fire pit, boat trips"
                className="tm-input"
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleRun(activeAction);
                  }
                }}
              />
            </div>

            <div className="space-y-1.5">
              <p className="tm-label mb-0">Draft</p>
              <div className="rounded-lg border border-stone-200 bg-stone-50 p-4 min-h-[120px] text-sm text-stone-800 leading-relaxed break-words">
                {generating ? (
                  <div className="flex items-center justify-center gap-2 py-6 tm-muted">
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                    <span>Writing a draft...</span>
                  </div>
                ) : suggestion ? (
                  <p className="whitespace-pre-line">{suggestion}</p>
                ) : (
                  <p className="tm-muted">Choose an option above to get a draft.</p>
                )}
              </div>
            </div>

            <div className="tm-divider pt-4 flex flex-wrap items-center justify-between gap-2">
              <button type="button" onClick={() => setIsOpen(false)} className="tm-btn tm-btn-quiet tm-btn-sm">
                Cancel
              </button>
              <div className="tm-actions">
                <button
                  type="button"
                  disabled={generating}
                  onClick={() => handleRun(activeAction)}
                  className="tm-btn tm-btn-secondary tm-btn-sm"
                >
                  <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Try again</span>
                </button>
                <button
                  type="button"
                  disabled={generating || !suggestion}
                  onClick={handleApply}
                  className="tm-btn tm-btn-primary tm-btn-sm"
                >
                  <Check className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Use this text</span>
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
