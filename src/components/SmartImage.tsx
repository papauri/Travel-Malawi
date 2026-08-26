import React, { useEffect, useMemo, useState } from 'react';
import { PLACEHOLDER_IMAGE, normalizeImageUrl } from '../lib/images';

interface Props extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src' | 'onError'> {
  src?: string | null;
  alt: string;
  /** Tried in order if `src` fails, before falling back to the placeholder. */
  fallbacks?: string[];
  /** Tints the element and pulses until the image decodes. */
  showSkeleton?: boolean;
}

/**
 * An `<img>` that degrades gracefully.
 *
 * Stored image URLs are unreliable — some are empty, some have 404'd since they
 * were saved — and a bare `<img>` turns those into a broken-image glyph (an
 * empty `src` is worse still: the browser re-requests the current page). This
 * walks a fallback chain on error and always lands on an inline placeholder.
 *
 * `referrerPolicy="no-referrer"` is set because several lodge sites serve
 * images only when no foreign referrer is sent.
 */
export default function SmartImage({
  src,
  alt,
  fallbacks = [],
  showSkeleton = true,
  className = '',
  ...imgProps
}: Props) {
  const fallbackKey = fallbacks.join('|');

  // The placeholder always terminates the chain, so this is never empty.
  const candidates = useMemo(() => {
    const resolved = [src, ...fallbacks]
      .map(normalizeImageUrl)
      .filter((url): url is string => url !== null);
    return [...new Set([...resolved, PLACEHOLDER_IMAGE])];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, fallbackKey]);

  const [index, setIndex] = useState(0);
  const [loaded, setLoaded] = useState(false);

  // Restart the chain when the subject of the image changes.
  useEffect(() => {
    setIndex(0);
    setLoaded(false);
  }, [candidates[0]]);

  return (
    <img
      {...imgProps}
      src={candidates[index]}
      alt={alt}
      loading={imgProps.loading ?? 'lazy'}
      decoding={imgProps.decoding ?? 'async'}
      referrerPolicy="no-referrer"
      // Advance through the fallback chain; the last entry is the inline
      // placeholder, so this settles rather than looping.
      onError={() => setIndex(prev => (prev < candidates.length - 1 ? prev + 1 : prev))}
      onLoad={() => setLoaded(true)}
      className={`${showSkeleton && !loaded ? 'bg-stone-200 animate-pulse' : ''} ${className}`.trim()}
    />
  );
}
