import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export interface SEOHeadProps {
  title?: string;
  description?: string;
  keywords?: string;
  image?: string;
  url?: string;
  type?: 'website' | 'article' | 'hotel';
  schema?: Record<string, any> | Array<Record<string, any>>;
  /** Keep this page out of search results (404s, private screens). */
  noindex?: boolean;
}

const DEFAULT_TITLE = 'Travel Malawi';
const DEFAULT_DESCRIPTION =
  'Travel Malawi is a directory of verified independent lodges, Lake Malawi cottages, safari camps, boutique hotels, and guest houses across Malawi. Contact each property directly.';
const DEFAULT_IMAGE = 'https://ulendomalawi.com/icons/icon-512.png';
const BASE_ORIGIN = 'https://ulendomalawi.com';
const INDEXABLE = 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';

function setMetaTag(attrName: 'name' | 'property', attrValue: string, content: string) {
  let element = document.querySelector(`meta[${attrName}="${attrValue}"]`) as HTMLMetaElement | null;
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attrName, attrValue);
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
}

function setCanonical(href: string) {
  let canonicalTag = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!canonicalTag) {
    canonicalTag = document.createElement('link');
    canonicalTag.setAttribute('rel', 'canonical');
    document.head.appendChild(canonicalTag);
  }
  canonicalTag.setAttribute('href', href);
}

/** Puts the head back to the site defaults for whatever page is current. */
function resetHead() {
  const canonicalUrl = `${BASE_ORIGIN}${window.location.pathname}`;
  document.title = DEFAULT_TITLE;
  setMetaTag('name', 'description', DEFAULT_DESCRIPTION);
  setMetaTag('name', 'robots', INDEXABLE);
  setMetaTag('property', 'og:title', DEFAULT_TITLE);
  setMetaTag('property', 'og:description', DEFAULT_DESCRIPTION);
  setMetaTag('property', 'og:image', DEFAULT_IMAGE);
  setMetaTag('property', 'og:url', canonicalUrl);
  setMetaTag('property', 'og:type', 'website');
  setMetaTag('name', 'twitter:title', DEFAULT_TITLE);
  setMetaTag('name', 'twitter:description', DEFAULT_DESCRIPTION);
  setMetaTag('name', 'twitter:image', DEFAULT_IMAGE);
  setCanonical(canonicalUrl);
}

/**
 * Manages document head metadata dynamically for enhanced search engine ranking,
 * OpenGraph sharing cards, and Schema.org rich snippets.
 */
export default function SEOHead({
  title,
  description,
  keywords,
  image,
  url,
  type = 'website',
  schema,
  noindex = false,
}: SEOHeadProps) {
  const location = useLocation();

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const fullTitle = title
      ? title.includes('Travel Malawi')
        ? title
        : `${title} | Travel Malawi`
      : DEFAULT_TITLE;

    const metaDescription = description || DEFAULT_DESCRIPTION;
    let metaImage = image
      ? image.startsWith('http')
        ? image
        : `${BASE_ORIGIN}${image.startsWith('/') ? '' : '/'}${image}`
      : DEFAULT_IMAGE;

    if (metaImage.includes('res.cloudinary.com')) {
      metaImage = metaImage.replace(/\.(webp|avif)(\?.*)?$/i, '.jpg$2');
    }

    const canonicalUrl = url || `${BASE_ORIGIN}${location.pathname}`;

    // 1. Update Title
    document.title = fullTitle;

    // 2. Standard Search Metadata
    setMetaTag('name', 'description', metaDescription);
    if (keywords) {
      setMetaTag('name', 'keywords', keywords);
    }

    // 3. OpenGraph Tags
    setMetaTag('property', 'og:title', fullTitle);
    setMetaTag('property', 'og:description', metaDescription);
    setMetaTag('property', 'og:image', metaImage);
    setMetaTag('property', 'og:image:secure_url', metaImage);
    setMetaTag('property', 'og:image:alt', fullTitle);
    setMetaTag('property', 'og:image:width', '1200');
    setMetaTag('property', 'og:image:height', '630');
    setMetaTag('property', 'og:url', canonicalUrl);
    setMetaTag('property', 'og:type', type === 'hotel' ? 'website' : type);
    setMetaTag('property', 'og:site_name', 'Travel Malawi');

    // 4. Twitter Tags
    setMetaTag('name', 'twitter:title', fullTitle);
    setMetaTag('name', 'twitter:description', metaDescription);
    setMetaTag('name', 'twitter:image', metaImage);
    setMetaTag('name', 'twitter:image:alt', fullTitle);
    setMetaTag('name', 'twitter:card', 'summary_large_image');

    // 5. Canonical Link Tag and robots
    setCanonical(canonicalUrl);
    setMetaTag('name', 'robots', noindex ? 'noindex, follow' : INDEXABLE);

    // 6. Schema.org JSON-LD structured data for page
    const scriptId = 'dynamic-seo-schema';
    let scriptElement = document.getElementById(scriptId) as HTMLScriptElement | null;

    if (schema) {
      if (!scriptElement) {
        scriptElement = document.createElement('script');
        scriptElement.id = scriptId;
        scriptElement.type = 'application/ld+json';
        document.head.appendChild(scriptElement);
      }
      scriptElement.text = JSON.stringify(schema);
    } else if (scriptElement) {
      scriptElement.remove();
    }

    return () => {
      // Cleanup dynamically injected schema on page unmount
      const existing = document.getElementById(scriptId);
      if (existing) existing.remove();
      // Pages without their own SEOHead (profile, bookings...) would otherwise
      // keep the previous page's title, description and canonical.
      resetHead();
    };
  }, [title, description, keywords, image, url, type, schema, noindex, location.pathname]);

  return null;
}
