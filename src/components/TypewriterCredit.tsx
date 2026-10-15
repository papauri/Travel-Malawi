import React, { useState, useEffect } from 'react';

interface TypewriterCreditProps {
  className?: string;
}

const PHRASES = [
  'Website developed by ProManaged IT',
  'Crafted & engineered by ProManaged IT',
  'Digital hospitality infrastructure by ProManaged IT',
  'Built with passion for Malawi by ProManaged IT',
];

const TARGET_BRAND = 'ProManaged IT';

export default function TypewriterCredit({ className = '' }: TypewriterCreditProps) {
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [displayedText, setDisplayedText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const currentPhrase = PHRASES[phraseIndex];
    let timer: NodeJS.Timeout;

    if (!isDeleting) {
      // Typing phase
      if (displayedText.length < currentPhrase.length) {
        timer = setTimeout(() => {
          setDisplayedText(currentPhrase.slice(0, displayedText.length + 1));
        }, 60 + Math.random() * 30); // Natural keystroke cadence
      } else {
        // Finished typing full phrase, pause before deleting
        timer = setTimeout(() => {
          setIsDeleting(true);
        }, 2400);
      }
    } else {
      // Deleting phase
      if (displayedText.length > 0) {
        timer = setTimeout(() => {
          setDisplayedText(currentPhrase.slice(0, displayedText.length - 1));
        }, 28); // Smooth and quick backspace
      } else {
        // Finished deleting, brief rest then move to next phrase
        timer = setTimeout(() => {
          setIsDeleting(false);
          setPhraseIndex((prev) => (prev + 1) % PHRASES.length);
        }, 450);
      }
    }

    return () => clearTimeout(timer);
  }, [displayedText, isDeleting, phraseIndex]);

  // Determine if the typed portion has reached or included parts of "ProManaged IT"
  const currentPhrase = PHRASES[phraseIndex];
  const brandStart = currentPhrase.indexOf(TARGET_BRAND);

  const renderContent = () => {
    if (brandStart !== -1 && displayedText.length > brandStart) {
      const prefix = currentPhrase.slice(0, brandStart).trimEnd();
      const brandPart = displayedText.slice(brandStart);
      return (
        <span className="inline">
          <span>{prefix}&nbsp;</span>
          <a
            href="https://promanaged-it.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-stone-300 hover:text-emerald-400 font-semibold transition-colors duration-150 inline underline decoration-stone-600/60 hover:decoration-emerald-400 underline-offset-2"
            title="Visit ProManaged IT"
          >
            {brandPart}
          </a>
        </span>
      );
    }
    return <span className="inline whitespace-pre">{displayedText}</span>;
  };

  return (
    <span className={`inline-flex items-center text-[11px] sm:text-xs text-stone-400 font-mono tracking-tight select-none ${className}`}>
      {/* Screen reader accessible label */}
      <span className="sr-only">Website developed by ProManaged IT</span>
      
      {/* Animated visual display with non-collapsing typography */}
      <span aria-hidden="true" className="inline min-h-[1.25rem]">
        {renderContent()}
        <span
          className="inline-block w-1.5 h-3 bg-emerald-400 ml-1 translate-y-[1px] animate-pulse align-middle"
          aria-hidden="true"
        />
      </span>
    </span>
  );
}
