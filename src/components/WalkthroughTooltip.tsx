import React, { useState, useEffect, useRef } from 'react';
import { X, ConciergeBell } from 'lucide-react';

export const WALKTHROUGH_SESSION_KEY = 'tp_walkthrough_concierge_chat_seen';

/**
 * Checks whether the walkthrough tooltip has already been displayed
 * during the current browser session.
 */
export function hasSeenWalkthrough(): boolean {
  try {
    return sessionStorage.getItem(WALKTHROUGH_SESSION_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Marks the walkthrough tooltip as seen for the current browser session.
 */
export function markWalkthroughSeen(): void {
  try {
    sessionStorage.setItem(WALKTHROUGH_SESSION_KEY, 'true');
  } catch {}
}

/**
 * Utility for debugging or resetting the session walkthrough.
 */
export function resetWalkthroughSession(): void {
  try {
    sessionStorage.removeItem(WALKTHROUGH_SESSION_KEY);
  } catch {}
}

export interface WalkthroughTooltipProps {
  id: string;
  icon?: React.ReactNode;
  title: string;
  description: string;
  arrowPosition?: 'top-right' | 'top-center' | 'bottom-right' | 'bottom-center' | 'left' | 'right';
  className?: string;
  delayMs?: number; // Time before appearing (default 800ms)
  visibleMs?: number; // Time to remain fully visible (default 4500ms)
  fadeMs?: number; // Time to slowly fade away (default 2500ms)
  onDismiss?: () => void;
}

export default function WalkthroughTooltip({
  id,
  icon = <ConciergeBell className="w-3.5 h-3.5 text-amber-400" />,
  title,
  description,
  arrowPosition = 'bottom-right',
  className = '',
  delayMs = 800,
  visibleMs = 4500,
  fadeMs = 2500,
  onDismiss,
}: WalkthroughTooltipProps) {
  // Phase state: 'init' -> 'appearing' -> 'visible' -> 'vanishing' -> 'gone'
  const [phase, setPhase] = useState<'init' | 'appearing' | 'visible' | 'vanishing' | 'gone'>('init');
  const [progressWidth, setProgressWidth] = useState(100);
  const dismissedRef = useRef(false);

  useEffect(() => {
    // Check if user already saw the walkthrough in this browser session
    if (hasSeenWalkthrough()) {
      setPhase('gone');
      return;
    }

    // Step 1: Wait for initial delay after mount
    const timerDelay = setTimeout(() => {
      if (dismissedRef.current) return;
      // Mark as seen immediately so navigating or subsequent mounts won't repeat
      markWalkthroughSeen();
      setPhase('appearing');

      // Next tick: transition to fully visible
      requestAnimationFrame(() => {
        setPhase('visible');
        setProgressWidth(0);
      });
    }, delayMs);

    // Step 2: Begin the slow vanishing phase
    const timerVanishing = setTimeout(() => {
      if (dismissedRef.current) return;
      setPhase('vanishing');
    }, delayMs + visibleMs);

    // Step 3: Complete vanishing and unmount
    const timerGone = setTimeout(() => {
      if (dismissedRef.current) return;
      setPhase('gone');
      onDismiss?.();
    }, delayMs + visibleMs + fadeMs);

    return () => {
      clearTimeout(timerDelay);
      clearTimeout(timerVanishing);
      clearTimeout(timerGone);
    };
  }, [delayMs, visibleMs, fadeMs, onDismiss]);

  const handleDismiss = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    dismissedRef.current = true;
    markWalkthroughSeen();
    setPhase('gone');
    onDismiss?.();
  };

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
