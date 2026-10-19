import React from 'react';

interface TypewriterCreditProps {
  className?: string;
}

// Small-print developer credit for the (dark) footer. Kept static and quiet:
// the old typing/deleting loop with a green cursor read as a console gimmick (D2).
export default function TypewriterCredit({ className = '' }: TypewriterCreditProps) {
  return (
    <span className={`inline text-[11px] sm:text-xs text-stone-400 ${className}`}>
      Website by{' '}
      <a
        href="https://promanaged-it.com"
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-stone-300 underline decoration-stone-600 underline-offset-2 transition-colors hover:text-amber-200 hover:decoration-amber-200"
      >
        ProManaged IT
      </a>
    </span>
  );
}
