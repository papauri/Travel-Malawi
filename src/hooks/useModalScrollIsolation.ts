import { useCallback, useEffect, useRef } from 'react';

/**
 * Custom hook to isolate scrolling to the modal / dropdown container.
 * When the user's cursor is within the modal, scrolling with a mouse wheel
 * or touchpad will only scroll the content inside the modal and will NEVER
 * scroll the underlying webpage (Travel Malawi page).
 *
 * Handles:
 * 1. Lenis smooth scroll prevention via `data-lenis-prevent="true"`
 * 2. Native hardware-accelerated smooth scrolling when hovering over scrollable areas
 * 3. Boundary lock (preventing page scroll chaining when hitting top/bottom)
 * 4. Header/tab/padding wheel redirection to the modal's inner scrollable list
 */
export function useModalScrollIsolation<T extends HTMLElement = HTMLDivElement>(isActive: boolean = true) {
  const nodeRef = useRef<T | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  const attachWheelListener = useCallback((node: T | null) => {
    // Cleanup any existing listener first
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }

    nodeRef.current = node;

    if (!node || !isActive) return;

    // Apply native overscroll containment to the modal
    node.style.overscrollBehavior = 'contain';
    // Tell Lenis smooth-scroll library to never hijack scroll inside this modal
    node.setAttribute('data-lenis-prevent', 'true');

    // Also mark all scrollable children with overscroll-contain and data-lenis-prevent
    const scrollables = node.querySelectorAll<HTMLElement>(
      '.overflow-y-auto, .overflow-y-scroll, .overflow-auto, [data-scrollable="true"], textarea'
    );
    scrollables.forEach((el) => {
      el.style.overscrollBehavior = 'contain';
      el.setAttribute('data-lenis-prevent', 'true');
    });

    const handleWheel = (e: WheelEvent) => {
      // Stop wheel event from propagating outside this modal to the document or Lenis
      e.stopPropagation();

      const target = e.target as HTMLElement | null;

      // 1. Check if the mouse is directly over a scrollable element or textarea
      let scrollable: HTMLElement | null = target?.closest(
        '.overflow-y-auto, .overflow-y-scroll, .overflow-auto, [data-scrollable="true"], textarea'
      ) as HTMLElement;

      // 2. If not over a scrollable child (e.g. cursor is over the header, tabs, or padding),
      // fallback to the primary scrollable container inside this modal
      if (!scrollable || !node.contains(scrollable)) {
        scrollable = node.querySelector(
          '.overflow-y-auto, .overflow-y-scroll, .overflow-auto, [data-scrollable="true"], textarea'
        );
      }

      if (scrollable) {
        scrollable.style.overscrollBehavior = 'contain';
        scrollable.setAttribute('data-lenis-prevent', 'true');

        const isDirectChild = scrollable === target || scrollable.contains(target);

        if (isDirectChild) {
          // Cursor is directly over the scrollable area.
          // Allow native browser scrolling, but if hitting top or bottom boundary,
          // prevent bubbling to the background page.
          const maxScrollTop = scrollable.scrollHeight - scrollable.clientHeight;
          const isAtTop = scrollable.scrollTop <= 0 && e.deltaY < 0;
          const isAtBottom = scrollable.scrollTop >= maxScrollTop - 1 && e.deltaY > 0;

          if (isAtTop || isAtBottom) {
            e.preventDefault();
          }
        } else {
          // Cursor is on header, tabs, or whitespace:
          // Directly scroll the modal's scrollable list and stop background page scroll!
          scrollable.scrollTop += e.deltaY;
          if (e.deltaX) {
            scrollable.scrollLeft += e.deltaX;
          }
          e.preventDefault();
        }
      } else {
        // Modal has no scrollable content: prevent background page from scrolling
        e.preventDefault();
      }
    };

    // Attach non-passive wheel listener so e.preventDefault() can block background page scroll
    node.addEventListener('wheel', handleWheel, { passive: false });

    cleanupRef.current = () => {
      node.removeEventListener('wheel', handleWheel);
    };
  }, [isActive]);

  // Ensure cleanup on unmount
  useEffect(() => {
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
    };
  }, []);

  // When isActive changes, re-attach or detach on the current node
  useEffect(() => {
    if (nodeRef.current) {
      attachWheelListener(nodeRef.current);
    }
  }, [isActive, attachWheelListener]);

  return attachWheelListener;
}


