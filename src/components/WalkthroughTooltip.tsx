import React, { useState, useEffect, useRef } from 'react';
import { X, ConciergeBell } from 'lucide-react';

export const WALKTHROUGH_SESSION_KEY = 'tp_walkthrough_concierge_chat_seen';

// In-memory set ensures tooltip is marked seen even if sessionStorage is blocked in iframes
const seenInMemory = new Set<string>();

let activeWalkthroughId: string | null = null;

/**
 * Checks whether the walkthrough tooltip has already been displayed
 * during the current browser session.
 */
export function hasSeenWalkthrough(id?: string): boolean {
  const key = id ? `${WALKTHROUGH_SESSION_KEY}_${id}` : WALKTHROUGH_SESSION_KEY;
  if (seenInMemory.has(key)) return true;
  try {
    return sessionStorage.getItem(key) === 'true' || localStorage.getItem(key) === 'true';
  } catch {
    return false;
  }
}

/**
 * Marks the walkthrough tooltip as seen for the current browser session.
 */
export function markWalkthroughSeen(id?: string): void {
  const key = id ? `${WALKTHROUGH_SESSION_KEY}_${id}` : WALKTHROUGH_SESSION_KEY;
  seenInMemory.add(key);
  try {
    sessionStorage.setItem(key, 'true');
  } catch {}
  try {
    localStorage.setItem(key, 'true');
  } catch {}
}

/**
 * Utility for debugging or resetting the session walkthrough.
 */
export function resetWalkthroughSession(id?: string): void {
  const key = id ? `${WALKTHROUGH_SESSION_KEY}_${id}` : WALKTHROUGH_SESSION_KEY;
  seenInMemory.delete(key);
  try {
    sessionStorage.removeItem(key);
  } catch {}
  try {
    localStorage.removeItem(key);
  } catch {}
}

export interface WalkthroughTooltipProps {
  id: string;
  icon?: React.ReactNode;
  title: string;
  description: string;
  arrowPosition?: 'top-right' | 'top-center' | 'bottom-right' | 'bottom-center' | 'left' | 'right';
  className?: string;
  delayMs?: number; // Time before appearing (default 600ms)
  visibleMs?: number; // Time to remain fully visible before auto-closing (default 3200ms)
  fadeMs?: number; // Time to slowly fade away (default 300ms)
  onDismiss?: () => void;
}

export default function WalkthroughTooltip({
  id,
  icon = <ConciergeBell className="w-3.5 h-3.5 text-stone-300" />,
  title,
  description,
  arrowPosition = 'bottom-right',
  className = '',
  delayMs = 600,
  visibleMs = 3200,
  fadeMs = 300,
  onDismiss,
}: WalkthroughTooltipProps) {
  // Phase state: 'init' -> 'appearing' -> 'visible' -> 'vanishing' -> 'gone'
  const [phase, setPhase] = useState<'init' | 'appearing' | 'visible' | 'vanishing' | 'gone'>('init');
  const [progressWidth, setProgressWidth] = useState(100);
  const dismissedRef = useRef(false);
  const tooltipRef = useRef<HTMLElement>(null);

  const handleDismiss = () => {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    if (activeWalkthroughId === id) {
      activeWalkthroughId = null;
    }
    markWalkthroughSeen(id);
    markWalkthroughSeen(); // Also mark global key
    setPhase('gone');
    onDismiss?.();
  };

  useEffect(() => {
    // Check if user already saw this walkthrough tooltip
    if (hasSeenWalkthrough(id)) {
      setPhase('gone');
      return;
    }

    // Step 1: Wait for initial delay after mount
    const timerDelay = setTimeout(() => {
      if (dismissedRef.current) return;

      // Ensure only one walkthrough tooltip is shown at a time
      if (activeWalkthroughId && activeWalkthroughId !== id) {
        // If another tooltip is already active, suppress this one
        markWalkthroughSeen(id);
        setPhase('gone');
        return;
      }

      activeWalkthroughId = id;
      markWalkthroughSeen(id);
      markWalkthroughSeen();
      setPhase('appearing');

      requestAnimationFrame(() => {
        if (dismissedRef.current) return;
        setPhase('visible');
        setProgressWidth(0);
      });
    }, delayMs);

    // Step 2: Auto-close timer begins vanishing phase
    const timerVanishing = setTimeout(() => {
      if (dismissedRef.current) return;
      setPhase('vanishing');
    }, delayMs + visibleMs);

    // Step 3: Complete vanishing and unmount
    const timerGone = setTimeout(() => {
      if (dismissedRef.current) return;
      if (activeWalkthroughId === id) {
        activeWalkthroughId = null;
      }
      setPhase('gone');
      onDismiss?.();
    }, delayMs + visibleMs + fadeMs);

    // Auto-dismiss on outside interaction or page scroll
    const handleOutsideInteraction = (e: Event) => {
      if (tooltipRef.current && !tooltipRef.current.contains(e.target as Node)) {
        handleDismiss();
      }
    };

    const handleScroll = () => {
      handleDismiss();
    };

    document.addEventListener('pointerdown', handleOutsideInteraction, true);
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      clearTimeout(timerDelay);
      clearTimeout(timerVanishing);
      clearTimeout(timerGone);
      document.removeEventListener('pointerdown', handleOutsideInteraction, true);
      window.removeEventListener('scroll', handleScroll);
      if (activeWalkthroughId === id) {
        activeWalkthroughId = null;
      }
    };
  }, [id, delayMs, visibleMs, fadeMs, onDismiss]);

  if (phase === 'init' || phase === 'gone') {
    return null;
  }

  // Determine caret styling based on arrowPosition
  let arrowClasses = '';
  switch (arrowPosition) {
    case 'bottom-right':
      arrowClasses = 'absolute -bottom-1.5 right-6 w-3 h-3 rotate-45 bg-stone-900 border-r border-b border-amber-400/40';
      break;
    case 'bottom-center':
      arrowClasses = 'absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 bg-stone-900 border-r border-b border-amber-400/40';
      break;
    case 'top-right':
      arrowClasses = 'absolute -top-1.5 right-4 w-3 h-3 rotate-45 bg-stone-900 border-l border-t border-amber-400/40';
      break;
    case 'top-center':
      arrowClasses = 'absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 bg-stone-900 border-l border-t border-amber-400/40';
      break;
    case 'left':
      arrowClasses = 'absolute -left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 rotate-45 bg-stone-900 border-l border-b border-amber-400/40';
      break;
    case 'right':
      arrowClasses = 'absolute -right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 rotate-45 bg-stone-900 border-r border-t border-amber-400/40';
      break;
  }

  // Dynamic opacity and transform based on phase
  const isFullyVisible = phase === 'visible';
  const isVanishing = phase === 'vanishing';
  const isAppearing = phase === 'appearing';

  return (
    <aside
      ref={tooltipRef}
      id={id}
      role="status"
      aria-live="polite"
      onClick={handleDismiss}
      className={`group cursor-pointer select-none rounded-2xl bg-stone-900/95 text-stone-100 p-3 shadow-[0_16px_40px_rgba(0,0,0,0.4)] border border-amber-400/40 backdrop-blur-md transition-all ${className}`}
      style={{
        opacity: isFullyVisible ? 1 : isAppearing ? 0.8 : isVanishing ? 0 : 0,
        transform: isFullyVisible
          ? 'translateY(0) scale(1)'
          : isAppearing
          ? 'translateY(4px) scale(0.96)'
          : isVanishing
          ? 'translateY(-6px) scale(0.97)'
          : 'translateY(6px) scale(0.95)',
        transition: isVanishing
          ? `opacity ${fadeMs}ms cubic-bezier(0.4, 0, 0.2, 1), transform ${fadeMs}ms cubic-bezier(0.4, 0, 0.2, 1)`
          : 'opacity 350ms cubic-bezier(0.16, 1, 0.3, 1), transform 350ms cubic-bezier(0.16, 1, 0.3, 1)',
        pointerEvents: isFullyVisible || isAppearing ? 'auto' : 'none',
      }}
      title="Click to dismiss"
    >
      {/* Directional Caret Pointer */}
      <div className={arrowClasses} />

      {/* Header Row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-400/20 text-xs shadow-inner shrink-0">
            {icon}
          </span>
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300 truncate">
            {title}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[9px] font-semibold text-stone-400 bg-stone-800/90 px-1.5 py-0.5 rounded-full border border-stone-700/60">
            Tip
          </span>
          <button
            type="button"
            onClick={handleDismiss}
            className="text-stone-400 hover:text-white p-0.5 rounded-full hover:bg-stone-800 transition cursor-pointer"
            title="Dismiss tip"
            aria-label="Dismiss tip"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Description */}
      <p className="text-[11px] text-stone-200/90 leading-snug mt-1.5 font-normal">
        {description}
      </p>

      {/* Vanishing Progress Line */}
      <div className="w-full bg-stone-800/80 h-[1.5px] rounded-full overflow-hidden mt-2.5">
        <div
          className="h-full bg-gradient-to-r from-amber-400 via-amber-300 to-amber-200/40 rounded-full"
          style={{
            width: `${progressWidth}%`,
            transitionProperty: 'width',
            transitionDuration: isFullyVisible ? `${visibleMs}ms` : '0ms',
            transitionTimingFunction: 'linear',
          }}
        />
      </div>
    </aside>
  );
}
