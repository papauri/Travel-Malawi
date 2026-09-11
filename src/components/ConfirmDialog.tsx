import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { AlertTriangle } from 'lucide-react';

interface Props {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDestructive?: boolean;
}

/**
 * A short yes/no dialog. Kept separate from `Modal` because its content is
 * static — which lets it keep an exit animation — but it shares the same
 * visual language: soft backdrop, spring entrance, pill actions.
 */
export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  isDestructive = false
}: Props) {
  useBodyScrollLock(isOpen);

  // Escape cancels, and the page behind is frozen — which also stops Lenis,
  // since it scrolls the window.
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKeyDown);
    const root = document.documentElement;
    const previousOverflow = root.style.overflow;
    root.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      root.style.overflow = previousOverflow;
    };
  }, [isOpen, onCancel]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div
          data-lenis-prevent="true"
          className="fixed inset-0 z-[160] overflow-y-auto overscroll-contain flex min-h-full items-center justify-center p-4 text-center"
          role="dialog"
          aria-modal="true"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-stone-950/50 backdrop-blur-sm"
            onClick={onCancel}
          />
          <motion.div
            data-lenis-prevent="true"
            initial={{ opacity: 0, scale: 0.97, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ type: 'spring', stiffness: 420, damping: 34, mass: 0.9 }}
            className="bg-white rounded-2xl sm:rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl shadow-stone-950/25 p-5 sm:p-7 relative z-10 my-auto text-left overscroll-contain border border-stone-100"
          >
            <div className="flex flex-col items-center text-center">
              <div className={`h-11 w-11 sm:h-14 sm:w-14 grid place-items-center rounded-full mb-3.5 sm:mb-5 ${
                isDestructive ? 'bg-red-50 text-red-600' : 'bg-stone-100 text-stone-900'
              }`}>
                <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <h3 className="text-lg sm:text-xl font-serif font-bold text-stone-900 mb-1.5 sm:mb-2 tracking-tight leading-snug">{title}</h3>
              <p className="text-stone-500 text-xs sm:text-sm leading-relaxed mb-5 sm:mb-6">{message}</p>
              <div className="flex gap-2.5 sm:gap-3 w-full">
                <button
                  onClick={onCancel}
                  className="flex-1 bg-stone-100 text-stone-700 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl sm:rounded-full font-semibold text-xs sm:text-sm hover:bg-stone-200 transition cursor-pointer"
                >
                  {cancelText}
                </button>
                <button
                  onClick={() => {
                    onConfirm();
                    onCancel();
                  }}
                  className={`flex-1 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl sm:rounded-full font-semibold text-xs sm:text-sm transition text-white cursor-pointer ${
                    isDestructive ? 'bg-red-600 hover:bg-red-700' : 'bg-stone-900 hover:bg-stone-800'
                  }`}
                >
                  {confirmText}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
