import { useEffect } from 'react';

// Number of mounted locks. Stacked modals share one lock: the page is locked
// by the first and only released when the last one closes.
let activeLocks = 0;
let saved: { rootOverflow: string; bodyOverflow: string; paddingRight: string } | null = null;

function getLenis(): any {
  return (window as any).__lenis;
}

function acquire() {
  activeLocks++;
  if (activeLocks > 1) return;

  const root = document.documentElement;
  const body = document.body;
  saved = {
    rootOverflow: root.style.overflow,
    bodyOverflow: body.style.overflow,
    paddingRight: body.style.paddingRight,
  };

  // Only add padding if there's actually a scrollbar
  const scrollbarWidth = window.innerWidth - root.clientWidth;
  if (scrollbarWidth > 0) {
    body.style.paddingRight = `${scrollbarWidth}px`;
  }
  root.style.overflow = 'hidden';
  body.style.overflow = 'hidden';

  // Stop Lenis instance from capturing wheel gestures while a modal is open
  try {
    getLenis()?.stop?.();
  } catch (err) {
    // Lenis not ready
  }
}

function release() {
  activeLocks = Math.max(0, activeLocks - 1);
  if (activeLocks > 0 || !saved) return;

  const root = document.documentElement;
  const body = document.body;
  root.style.overflow = saved.rootOverflow;
  body.style.overflow = saved.bodyOverflow;
  body.style.paddingRight = saved.paddingRight;
  saved = null;

  try {
    getLenis()?.start?.();
  } catch (err) {
    // Lenis not ready
  }
}

/**
 * Called on every route change. When no modal holds a lock, clears any
 * leftover overflow freeze (written by code outside this hook) and restarts
 * Lenis, so a new page can always scroll.
 */
export function releaseStaleScrollLock() {
  if (activeLocks > 0) return;
  const root = document.documentElement;
  const body = document.body;
  if (root.style.overflow === 'hidden') root.style.overflow = '';
  if (body.style.overflow === 'hidden') {
    body.style.overflow = '';
    body.style.paddingRight = '';
  }
  try {
    const lenis = getLenis();
    if (lenis?.isStopped) lenis.start();
  } catch (err) {
    // Lenis not ready
  }
}

export function useBodyScrollLock(lock: boolean) {
  useEffect(() => {
    if (!lock) return;
    acquire();
    return release;
  }, [lock]);
}
