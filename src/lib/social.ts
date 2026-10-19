export type SocialNetwork = 'facebook' | 'instagram';

const HOSTS: Record<SocialNetwork, string[]> = {
  facebook: ['facebook.com', 'fb.com', 'fb.me'],
  instagram: ['instagram.com', 'instagr.am'],
};

const PROFILE_BASE: Record<SocialNetwork, string> = {
  facebook: 'https://www.facebook.com/',
  instagram: 'https://www.instagram.com/',
};

/**
 * Turns what a person typed (full link, "facebook.com/page", "@handle" or a
 * bare handle) into a safe https link on that network, or null. Links to any
 * other site are refused so a profile field can't point guests elsewhere.
 */
export function socialUrl(raw: string | undefined | null, network: SocialNetwork): string | null {
  const value = (raw || '').trim();
  if (!value) return null;

  const handle = value.replace(/^@/, '');
  if (/^[A-Za-z0-9._-]{1,100}$/.test(handle) && !handle.includes('..') && !/\.(com|am|me)$/i.test(handle)) {
    return PROFILE_BASE[network] + handle;
  }

  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    const host = url.hostname.toLowerCase().replace(/^(www|m|web)\./, '');
    if (!HOSTS[network].includes(host)) return null;
    if (url.pathname === '/' || url.pathname === '') return null;
    url.protocol = 'https:';
    return url.toString();
  } catch {
    return null;
  }
}

export function hasSocialLinks(source: { socialFacebook?: string; socialInstagram?: string } | null | undefined): boolean {
  return Boolean(source && (socialUrl(source.socialFacebook, 'facebook') || socialUrl(source.socialInstagram, 'instagram')));
}
