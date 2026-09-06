import React, { useEffect, useState } from 'react';

type SupportedTag = 'span' | 'h1' | 'h2' | 'h3' | 'p' | 'div';

interface MaskedPlaceNameProps {
  name?: string;
  fallback?: string;
  className?: string;
  as?: SupportedTag;
}

/**
 * Renders a place name, or obscures/replaces it if privacy/forfeit mode is enabled.
 * Activated via URL (?maskPlaces=true, ?maskPlaces=blur, ?maskPlaces=replace)
 * or via localStorage key ('maskPlaces' = 'true' | 'blur' | 'replace').
 */
export default function MaskedPlaceName({
  name = '',
  fallback = '[Featured Lodge]',
  className = '',
  as: Component = 'span',
}: MaskedPlaceNameProps) {
  const [maskState, setMaskState] = useState<'off' | 'blur' | 'replace'>('off');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    const urlParam = params.get('maskPlaces') || params.get('forfeitNames');
    const stored = window.localStorage.getItem('maskPlaces');

    const activeSetting = urlParam || stored;

    if (activeSetting) {
      if (activeSetting === 'blur') {
        setMaskState('blur');
      } else {
        // default when present (e.g. ?maskPlaces=true or ?maskPlaces=replace)
        setMaskState('replace');
      }
    }
  }, []);

  if (maskState === 'off') {
    return <Component className={className}>{name}</Component>;
  }

  if (maskState === 'blur') {
    return (
      <Component 
        className={`filter blur-[5px] select-none opacity-80 transition-all ${className}`}
        aria-label="Property Name (Redacted for Demo)"
      >
        {name}
      </Component>
    );
  }

  return (
    <Component className={className} aria-label={fallback}>
      {fallback}
    </Component>
  );
}
