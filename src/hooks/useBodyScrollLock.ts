import { useEffect } from 'react';

export function useBodyScrollLock(lock: boolean) {
  useEffect(() => {
    if (!lock) return;

    const root = document.documentElement;
    const body = document.body;
    
    const previousOverflow = root.style.overflow;
    const previousBodyOverflow = body.style.overflow;
    const previousPaddingRight = body.style.paddingRight;

    // Calculate scrollbar width
    const scrollbarWidth = window.innerWidth - root.clientWidth;

    // Only add padding if there's actually a scrollbar
    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${scrollbarWidth}px`;
    }
    root.style.overflow = 'hidden';
    body.style.overflow = 'hidden';

    // Stop Lenis instance from capturing wheel gestures while modal is open
    const lenis = (window as any).__lenis;
    if (lenis && typeof lenis.stop === 'function') {
      try {
        lenis.stop();
      } catch (err) {
        // Silently ignore if lenis is not ready
      }
    }

    return () => {
      root.style.overflow = previousOverflow;
      body.style.overflow = previousBodyOverflow;
      body.style.paddingRight = previousPaddingRight;

      if (lenis && typeof lenis.start === 'function') {
        try {
          lenis.start();
        } catch (err) {
          // Silently ignore
        }
      }
    };
  }, [lock]);
}
