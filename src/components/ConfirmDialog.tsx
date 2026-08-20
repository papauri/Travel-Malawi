import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
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
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm"
            onClick={onCancel}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-white rounded-[2rem] w-full max-w-sm overflow-hidden shadow-2xl p-6 relative z-10"
          >
            <div className="flex flex-col items-center text-center">
              <div className={`p-4 rounded-full mb-4 ${isDestructive ? 'bg-red-50 text-red-600' : 'bg-stone-100 text-stone-900'}`}>
                <AlertTriangle className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-stone-900 mb-2">{title}</h3>
              <p className="text-stone-500 text-sm leading-relaxed mb-8">{message}</p>
              <div className="flex gap-3 w-full">
                <button
                  onClick={onCancel}
                  className="flex-1 bg-stone-100 text-stone-700 px-4 py-3 rounded-xl font-medium hover:bg-stone-200 transition"
                >
                  {cancelText}
                </button>
                <button
                  onClick={() => {
                    onConfirm();
                    onCancel();
                  }}
                  className={`flex-1 px-4 py-3 rounded-xl font-medium transition text-white ${
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
