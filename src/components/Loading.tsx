import React from 'react';

/**
 * Loading states, one quiet language for the whole app: a hairline "route"
 * with a short segment travelling along it (the same motif as the splash in
 * index.html). Each one fades in after a short delay, so a fast load shows
 * nothing at all instead of a flash. Styles live in index.css (.tm-route,
 * .tm-topbar, .tm-reveal) and stand still under reduced motion.
 */

/** A section or panel that is still loading. */
export function Loading({ label, className = '' }: { label?: string; className?: string }) {
  return (
    <div role="status" aria-live="polite" className={`tm-reveal flex flex-col items-center justify-center gap-3 py-12 ${className}`}>
      <span className="tm-route" aria-hidden="true" />
      {label ? <span className="text-xs text-stone-500">{label}</span> : <span className="sr-only">Loading</span>}
    </div>
  );
}

/** A whole page that is still loading. */
export function PageLoading({ label }: { label?: string }) {
  return <Loading label={label} className="min-h-[60vh]" />;
}

/**
 * While a page's code is downloading: a hairline across the top of the
 * screen, and the page area kept at its height so the footer does not jump.
 */
export function RouteLoading() {
  return (
    <div className="min-h-[60vh]" role="status" aria-live="polite">
      <span className="tm-topbar tm-reveal" aria-hidden="true" />
      <span className="sr-only">Loading page</span>
    </div>
  );
}
