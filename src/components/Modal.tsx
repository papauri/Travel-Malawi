import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { X } from 'lucide-react';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { useModalScrollIsolation } from '../hooks/useModalScrollIsolation';

type Size = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  size?: Size;
  /** Pinned to the bottom of the panel, outside the scrolling body. */
  footer?: React.ReactNode;
  /** Hides the header's close button for dialogs that demand an explicit choice. */
  hideClose?: boolean;
  children: React.ReactNode;
}

const SIZES: Record<Size, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-4xl',
};

/**
 * The shell every dialog in the app sits in.
 *
 * Each modal used to be hand-rolled, which meant each one was missing something
 * different: no entrance animation, no escape key, a backdrop that swallowed
 * clicks instead of closing, and a panel that simply clipped its own content
 * when it grew taller than the window — putting the submit button out of reach.
 *
 * The header and footer are pinned and only the body scrolls, so the title and
 * the primary action stay on screen however long the form gets.
 */
export default function Modal({
  open,
  onClose,
  title,
  description,
  size = 'md',
  footer,
  hideClose = false,
  children,
}: Props) {
  const titleId = useId();
  useBodyScrollLock(open);
  const panelRef = useRef<HTMLDivElement>(null);
  const scrollIsolationRef = useModalScrollIsolation<HTMLDivElement>(open);

  // Escape closes, and the page behind is frozen while the dialog is up.
  // Locking the root element also stops Lenis, which drives the page by
  // scrolling the window.
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);

    

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      
    };
  }, [open, onClose]);

  // Focus moves into the dialog so the keyboard follows the eye, and so the
  // Escape handler works without the user clicking first.
  useEffect(() => {
    if (!open) return;
    const focusable = panelRef.current?.querySelector<HTMLElement>(
      'input:not([type="hidden"]):not([disabled]), textarea, select, button:not([disabled])'
    );
    focusable?.focus({ preventScroll: true });
  }, [open]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[150] overflow-y-auto overscroll-contain flex min-h-full items-center justify-center p-3 sm:p-4 text-center"
      data-lenis-prevent="true"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 bg-stone-950/50 backdrop-blur-sm"
        onClick={onClose}
      />

      <motion.div
        ref={(el) => {
          (panelRef as any).current = el;
          scrollIsolationRef(el);
        }}
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 420, damping: 34, mass: 0.9 }}
        className={`relative z-10 w-full ${SIZES[size]} bg-white shadow-2xl shadow-stone-950/25
          rounded-2xl sm:rounded-3xl
          max-h-[calc(100dvh-1.5rem)] sm:max-h-[88dvh] flex flex-col overflow-hidden my-auto text-left border border-stone-100`}
        data-lenis-prevent="true"
      >

        <div className="flex items-start gap-3 sm:gap-4 px-4 sm:px-6 md:px-7 pt-4 sm:pt-6 pb-3 sm:pb-4 border-b border-stone-100 shrink-0">
          <div className="flex-1 min-w-0">
            <h2 id={titleId} className="text-lg sm:text-xl md:text-2xl font-serif font-bold text-stone-900 tracking-tight leading-snug">
              {title}
            </h2>
            {description && (
              <p className="text-xs sm:text-sm text-stone-500 mt-1 sm:mt-1.5 leading-relaxed">{description}</p>
            )}
          </div>
          {!hideClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="shrink-0 -mr-1 -mt-1 p-1.5 sm:p-2 rounded-full text-stone-400 hover:text-stone-900 hover:bg-stone-100 transition cursor-pointer"
            >
              <X className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
          )}
        </div>

        {/* `data-lenis-prevent` hands the wheel back to this element, otherwise
            Lenis keeps the gesture for the page underneath. */}
        <div data-lenis-prevent="true" className="flex-1 overflow-y-auto overscroll-contain scrollbar-slim px-4 sm:px-6 md:px-7 py-4 sm:py-5">
          {children}
        </div>

        {footer && (
          <div className="shrink-0 border-t border-stone-100 bg-white/95 backdrop-blur px-4 sm:px-6 md:px-7 py-3 sm:py-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        )}
      </motion.div>
    </div>,
    document.body
  );
}

/** Shared field styling, so every form in the app looks like one product. */
export const fieldClass =
  'w-full bg-stone-50 border border-stone-200 rounded-xl px-3 sm:px-3.5 py-2 sm:py-2.5 text-xs sm:text-sm text-stone-900 ' +
  'placeholder:text-stone-400 outline-none transition ' +
  'focus:bg-white focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10 ' +
  'focus-within:bg-white focus-within:border-stone-900 focus-within:ring-2 focus-within:ring-stone-900/10';

export const labelClass = 'block text-[11px] sm:text-xs font-semibold text-stone-500 tracking-wide mb-1 sm:mb-1.5';
