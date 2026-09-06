import React from 'react';
import { AlertCircle } from 'lucide-react';

/**
 * The message under a form field that failed validation.
 *
 * Every form in the app reported its problems through a toast: it appeared in
 * the corner, said one thing however many were wrong, and disappeared after a
 * few seconds without ever marking the field that caused it. On a long form —
 * the room editor especially — that left people hunting. This renders nothing
 * at all when there is no problem, so it can be dropped under any field
 * unconditionally.
 */
export default function FieldError({ message, id }: { message?: string; id?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-2 flex items-start gap-1.5 text-sm font-medium text-red-600">
      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{message}</span>
    </p>
  );
}

/** Ring and border for an input in the error state, appended to its classes. */
export const errorFieldClass = 'border-red-300 focus:border-red-500 focus:ring-red-500/10';
