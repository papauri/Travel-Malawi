import { useEffect } from 'react';

export function useBodyScrollLock(lock: boolean) {
  useEffect(() => {
    if (!lock) return;

    const root = document.documentElement;
    const body = document.body;
    
    const previousOverflow = root.style.overflow;
    const previousPaddingRight = body.style.paddingRight;

    // Calculate scrollbar width
    const scrollbarWidth = window.innerWidth - root.clientWidth;

    // Only add padding if there's actually a scrollbar
    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${scrollbarWidth}px`;
    }
    root.style.overflow = 'hidden';

    return () => {
      root.style.overflow = previousOverflow;
      body.style.paddingRight = previousPaddingRight;
    };
  }, [lock]);
}
