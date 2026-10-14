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
}

const DEFAULT_TITLE = 'Travel Malawi';
const DEFAULT_DESCRIPTION =
  'Direct booking platform connecting travelers with verified independent lodges, Lake Malawi cottages, safari camps, boutique hotels, and guest houses across Malawi.';
const DEFAULT_IMAGE = 'https://ulendomalawi.com/hotels/kaya_main.jpg';
const BASE_ORIGIN = 'https://ulendomalawi.com';

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
    const metaImage = image
      ? image.startsWith('http')
        ? image
        : `${BASE_ORIGIN}${image.startsWith('/') ? '' : '/'}${image}`
      : DEFAULT_IMAGE;

    const canonicalUrl = url || `${BASE_ORIGIN}${location.pathname}`;

    // 1. Update Title
    document.title = fullTitle;

    // Helper to update or create meta tags
    const setMetaTag = (attrName: 'name' | 'property', attrValue: string, content: string) => {
      let element = document.querySelector(`meta[${attrName}="${attrValue}"]`) as HTMLMetaElement | null;
      if (!element) {
        element = document.createElement('meta');
        element.setAttribute(attrName, attrValue);
        document.head.appendChild(element);
      }
      element.setAttribute('content', content);
    };

    // 2. Standard Search Metadata
    setMetaTag('name', 'description', metaDescription);
    if (keywords) {
      setMetaTag('name', 'keywords', keywords);
    }

    // 3. OpenGraph Tags
    setMetaTag('property', 'og:title', fullTitle);
    setMetaTag('property', 'og:description', metaDescription);
    setMetaTag('property', 'og:image', metaImage);
    setMetaTag('property', 'og:url', canonicalUrl);
    setMetaTag('property', 'og:type', type === 'hotel' ? 'website' : type);
    setMetaTag('property', 'og:site_name', 'Travel Malawi');

    // 4. Twitter Tags
    setMetaTag('name', 'twitter:title', fullTitle);
    setMetaTag('name', 'twitter:description', metaDescription);
    setMetaTag('name', 'twitter:image', metaImage);
    setMetaTag('name', 'twitter:card', 'summary_large_image');

    // 5. Canonical Link Tag
    let canonicalTag = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonicalTag) {
      canonicalTag = document.createElement('link');
      canonicalTag.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalTag);
    }
    canonicalTag.setAttribute('href', canonicalUrl);

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
    };
  }, [title, description, keywords, image, url, type, schema, location.pathname]);

  return null;
}
