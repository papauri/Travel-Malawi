/**
 * Turns cloud-drive share links into direct image URLs.
 *
 * A share link from OneDrive, Google Drive or Dropbox points at a viewer page,
 * not at the image, so dropping one into an `<img src>` renders nothing. Each
 * provider has a direct-content form; this converts to it.
 *
 * These forms are conventions rather than documented APIs. They work today and
 * have worked for years, but they are the providers' to change, and none of
 * them is a CDN — see the caveat in SECURITY.md before relying on this for a
 * whole catalogue of photographs.
 */

export type ShareProvider = 'onedrive' | 'sharepoint' | 'googledrive' | 'dropbox';

export interface ShareLinkResult {
  url: string;
  /** Set when the input was recognised and rewritten. */
  provider?: ShareProvider;
  /** Shown to the person who pasted it, so the rewrite is not a silent change. */
  note?: string;
}

/**
 * OneDrive personal short links resolve through the public shares API, which
 * takes the whole share URL base64url-encoded behind a `u!` marker.
 */
function encodeOneDriveShare(url: string): string {
  // btoa handles Latin-1 only; share URLs are ASCII, so this is safe here.
  const base64 = typeof btoa === 'function'
    ? btoa(url)
    : Buffer.from(url, 'utf-8').toString('base64');
  const encoded = base64.replace(/=+$/, '').replace(/\//g, '_').replace(/\+/g, '-');
  return `https://api.onedrive.com/v1.0/shares/u!${encoded}/root/content`;
}

function withParam(url: string, key: string, value: string): string {
  const separator = url.includes('?') ? '&' : '?';
  return url.includes(`${key}=`) ? url : `${url}${separator}${key}=${value}`;
}

/**
 * Rewrites a share link to something an `<img>` can load. Anything already
 * direct, or from a provider we do not know, is returned untouched.
 */
export function resolveShareUrl(input: string): ShareLinkResult {
  const url = (input ?? '').trim();
  if (!url || !/^https?:\/\//i.test(url)) return { url };

  // Already rewritten — do not double-encode on a second save.
  if (/api\.onedrive\.com\/v1\.0\/shares\//i.test(url)) return { url, provider: 'onedrive' };

  // --- OneDrive personal: 1drv.ms short links --------------------------------
  if (/^https:\/\/1drv\.ms\//i.test(url)) {
    return {
      url: encodeOneDriveShare(url),
      provider: 'onedrive',
      note: 'OneDrive share link converted to a direct image link.',
    };
  }

  // --- OneDrive personal: onedrive.live.com viewer ---------------------------
  if (/^https:\/\/onedrive\.live\.com\//i.test(url)) {
    if (/\/download/i.test(url)) return { url, provider: 'onedrive' };
    return {
      url: url.replace(/onedrive\.live\.com\/[^?]*/i, 'onedrive.live.com/download'),
      provider: 'onedrive',
      note: 'OneDrive link converted to its download form.',
    };
  }

  // --- OneDrive for Business / SharePoint ------------------------------------
  if (/\.sharepoint\.com\//i.test(url)) {
    return {
      url: withParam(url, 'download', '1'),
      provider: 'sharepoint',
      note: 'SharePoint link converted to a direct download link.',
    };
  }

  // --- Google Drive ----------------------------------------------------------
  const driveFile = url.match(/drive\.google\.com\/file\/d\/([^/?#]+)/i);
  const driveOpen = url.match(/drive\.google\.com\/open\?id=([^&]+)/i);
  const driveId = driveFile?.[1] ?? driveOpen?.[1];
  if (driveId) {
    // The googleusercontent host serves the bytes and tolerates hotlinking far
    // better than the drive.google.com/uc form, which often returns a warning
    // page for larger files.
    return {
      url: `https://lh3.googleusercontent.com/d/${driveId}`,
      provider: 'googledrive',
      note: 'Google Drive link converted to a direct image link.',
    };
  }

  // --- Dropbox ---------------------------------------------------------------
  if (/dropbox\.com\//i.test(url)) {
    if (/[?&]raw=1/.test(url)) return { url, provider: 'dropbox' };
    return {
      url: withParam(url.replace(/[?&]dl=[01]/i, ''), 'raw', '1'),
      provider: 'dropbox',
      note: 'Dropbox link converted to a direct image link.',
    };
  }

  return { url };
}

/** True when the link needs rewriting to display as an image. */
export function isShareLink(url: string): boolean {
  return !!resolveShareUrl(url).provider;
}

export const SHARE_PROVIDER_NAMES: Record<ShareProvider, string> = {
  onedrive: 'OneDrive',
  sharepoint: 'SharePoint',
  googledrive: 'Google Drive',
  dropbox: 'Dropbox',
};
