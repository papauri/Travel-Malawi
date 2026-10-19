import React from 'react';
import { Facebook, Instagram } from 'lucide-react';
import { socialUrl } from '../lib/social';

interface Props {
  facebook?: string;
  instagram?: string;
  /** Whose pages these are, for screen readers, e.g. "Travel Malawi". */
  name: string;
  tone?: 'light' | 'dark';
  className?: string;
}

/** Facebook and Instagram icons; a network with no valid link is left out. */
export default function SocialLinks({ facebook, instagram, name, tone = 'light', className = '' }: Props) {
  const links = [
    { href: socialUrl(facebook, 'facebook'), label: `${name} on Facebook`, Icon: Facebook },
    { href: socialUrl(instagram, 'instagram'), label: `${name} on Instagram`, Icon: Instagram },
  ].filter((l): l is typeof l & { href: string } => Boolean(l.href));

  if (links.length === 0) return null;

  const linkClass = tone === 'dark'
    ? 'text-stone-400 hover:text-white hover:bg-stone-800'
    : 'text-stone-500 hover:text-stone-900 hover:bg-stone-100';

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {links.map(({ href, label, Icon }) => (
        <a
          key={label}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={label}
          title={label}
          className={`inline-flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${linkClass}`}
        >
          <Icon className="h-4 w-4" />
        </a>
      ))}
    </div>
  );
}
