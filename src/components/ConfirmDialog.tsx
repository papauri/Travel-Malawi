import React, { useEffect } from 'react';
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

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-stone-950/50 backdrop-blur-sm"
            onClick={onCancel}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ type: 'spring', stiffness: 420, damping: 34, mass: 0.9 }}
            className="bg-white rounded-[1.75rem] w-full max-w-sm overflow-hidden shadow-2xl shadow-stone-950/25 p-7 relative z-10"
          >
            <div className="flex flex-col items-center text-center">
              <div className={`h-14 w-14 grid place-items-center rounded-full mb-5 ${
                isDestructive ? 'bg-red-50 text-red-600' : 'bg-stone-100 text-stone-900'
              }`}>
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-serif font-semibold text-stone-900 mb-2 tracking-tight">{title}</h3>
              <p className="text-stone-500 text-sm leading-relaxed mb-7">{message}</p>
              <div className="flex gap-3 w-full">
                <button
                  onClick={onCancel}
                  className="flex-1 bg-stone-100 text-stone-700 px-4 py-3 rounded-full font-semibold text-sm hover:bg-stone-200 transition"
                >
                  {cancelText}
                </button>
                <button
                  onClick={() => {
                    onConfirm();
                    onCancel();
                  }}
                  className={`flex-1 px-4 py-3 rounded-full font-semibold text-sm transition text-white ${
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
    </AnimatePresence>
  );
}
