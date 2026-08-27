import React, { useEffect, useId, useRef } from 'react';
import { motion } from 'motion/react';
import { X } from 'lucide-react';

type Size = 'sm' | 'md' | 'lg';

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
  const panelRef = useRef<HTMLDivElement>(null);

  // Escape closes, and the page behind is frozen while the dialog is up.
  // Locking the root element also stops Lenis, which drives the page by
  // scrolling the window.
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);

    const root = document.documentElement;
    const previousOverflow = root.style.overflow;
    root.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      root.style.overflow = previousOverflow;
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

  if (!open) return null;

  // z-[100] puts the dialog above the page's own fixed furniture — the floating
  // chat button, the mobile nav, the booking status pill — all of which sit at
  // z-50. Sharing that level meant the later element in the DOM won, which on a
  // phone put the chat button squarely on top of this dialog's submit button:
  // `items-end` pins the panel to the bottom of the screen, exactly where that
  // button floats.
  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
        className="absolute inset-0 bg-stone-950/50 backdrop-blur-sm"
        onClick={onClose}
      />

      <motion.div
        ref={panelRef}
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 420, damping: 34, mass: 0.9 }}
        className={`relative z-10 w-full ${SIZES[size]} bg-white shadow-2xl shadow-stone-950/25
          rounded-t-[1.75rem] sm:rounded-[1.75rem]
          max-h-[92dvh] sm:max-h-[88dvh] flex flex-col overflow-hidden`}
      >
        {/* Grab handle for the sheet presentation on small screens. */}
        <div className="sm:hidden pt-3 pb-1 flex justify-center shrink-0">
          <span className="h-1 w-10 rounded-full bg-stone-200" />
        </div>

        <div className="flex items-start gap-4 px-6 sm:px-8 pt-5 sm:pt-7 pb-5 border-b border-stone-100 shrink-0">
          <div className="flex-1 min-w-0">
            <h2 id={titleId} className="text-xl sm:text-2xl font-serif font-semibold text-stone-900 tracking-tight">
              {title}
            </h2>
            {description && (
              <p className="text-sm text-stone-500 mt-1.5 leading-relaxed">{description}</p>
            )}
          </div>
          {!hideClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="shrink-0 -mr-1 -mt-1 p-2 rounded-full text-stone-400 hover:text-stone-900 hover:bg-stone-100 transition"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* `data-lenis-prevent` hands the wheel back to this element, otherwise
            Lenis keeps the gesture for the page underneath. */}
        <div data-lenis-prevent className="flex-1 overflow-y-auto overscroll-contain scrollbar-slim px-6 sm:px-8 py-6">
          {children}
        </div>

        {footer && (
          <div className="shrink-0 border-t border-stone-100 bg-white/95 backdrop-blur px-6 sm:px-8 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        )}
      </motion.div>
    </div>
  );
}

/** Shared field styling, so every form in the app looks like one product. */
export const fieldClass =
  'w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-sm text-stone-900 ' +
  'placeholder:text-stone-400 outline-none transition ' +
  'focus:bg-white focus:border-stone-900 focus:ring-4 focus:ring-stone-900/5 ' +
  'focus-within:bg-white focus-within:border-stone-900 focus-within:ring-4 focus-within:ring-stone-900/5';

export const labelClass = 'block text-xs font-semibold text-stone-500 tracking-wide mb-1.5';
