import React, { useMemo, useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ChevronDown } from 'lucide-react';

export interface FormattedDescriptionProps {
  text?: string | null;
  className?: string;
  paragraphClassName?: string;
  /** Whether the text can be collapsed and unfolded if it exceeds the height threshold */
  collapsible?: boolean;
  /** Height in pixels when folded. Defaults to 96px (approx 3-4 lines). */
  collapsedHeight?: number;
  /** Label for unfolding button. Defaults to 'See more details'. */
  expandLabel?: string;
  /** Label for folding button. Defaults to 'Show less'. */
  collapseLabel?: string;
  /** Tailwind gradient classes for fading out the folded text. Defaults to 'from-transparent to-white'. */
  fadeGradientClass?: string;
  /** Additional styling classes for the toggle button */
  buttonClassName?: string;
  /** Initial expansion state */
  defaultExpanded?: boolean;
}

/**
 * Preprocesses user-entered text (descriptions, host directions, location notes,
 * guidelines, house rules, policies) so that:
 * 1. Bullet lists using dashes (-), bullets (•), or hyphens (–, —) are recognized
 *    by the markdown parser even if the host didn't leave an empty line before them.
 * 2. Numbered steps (1., 2., 1)) are properly separated into ordered list items.
 * 3. Leading whitespace, indentations, and line breaks are preserved rather than
 *    collapsed into a single unformatted chunk of text.
 * 4. Empty lines create distinct paragraph breaks.
 */
function normalizeDescriptionMarkdown(raw: string): string {
  if (!raw) return '';

  const lines = raw.split(/\r?\n/);
  const normalizedLines: string[] = [];
  let inList = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Check if line starts with a list bullet (-, *, +, •, –, —)
    const bulletMatch = line.match(/^([ \t]*)[•–—*+-]([ \t]+)(.*)$/);
    // Check if line starts with numbered list (1., 2., 1))
    const numberedMatch = line.match(/^([ \t]*)(\d+)[\.\)]([ \t]+)(.*)$/);

    if (bulletMatch) {
      const indent = bulletMatch[1];
      const content = bulletMatch[3];
      // If previous line was regular text and not empty, insert an empty line before list starts
      if (!inList && normalizedLines.length > 0 && normalizedLines[normalizedLines.length - 1].trim() !== '') {
        normalizedLines.push('');
      }
      inList = true;
      normalizedLines.push(`${indent}- ${content}`);
    } else if (numberedMatch) {
      const indent = numberedMatch[1];
      const num = numberedMatch[2];
      const content = numberedMatch[4];
      if (!inList && normalizedLines.length > 0 && normalizedLines[normalizedLines.length - 1].trim() !== '') {
        normalizedLines.push('');
      }
      inList = true;
      normalizedLines.push(`${indent}${num}. ${content}`);
    } else {
      // If we were in a list and this is a non-empty, non-list line, insert an empty line to cleanly exit list
      if (inList && line.trim() !== '') {
        normalizedLines.push('');
      }
      inList = false;
      normalizedLines.push(line);
    }
  }

  return normalizedLines.join('\n');
}

/**
 * FormattedDescription:
 * Renders user-provided property descriptions, host notes, location instructions,
 * and property policies preserving line breaks, bullet lists, dashes, bolding,
 * and paragraphs as the user intended.
 *
 * Supports collapsible unfolding so long text can be previewed cleanly
 * without dominating the viewport or making cards bulky.
 */
export default function FormattedDescription({
  text,
  className = 'text-stone-600',
  paragraphClassName = '',
  collapsible = false,
  collapsedHeight = 96,
  expandLabel = 'See more details',
  collapseLabel = 'Show less',
  fadeGradientClass = 'from-transparent to-white',
  buttonClassName = '',
  defaultExpanded = false,
}: FormattedDescriptionProps) {
  if (!text || !text.trim()) {
    return null;
  }

  const preprocessed = useMemo(() => normalizeDescriptionMarkdown(text), [text]);
  const contentRef = useRef<HTMLDivElement>(null);
  const [isExpanded, setIsExpanded] = useState<boolean>(defaultExpanded);
  const [canExpand, setCanExpand] = useState<boolean>(false);

  useEffect(() => {
    if (!collapsible) return;
    const el = contentRef.current;
    if (!el) return;

    const check = () => {
      if (el) {
        // scrollHeight of an overflow:hidden element gives true unconstrained height
        setCanExpand(el.scrollHeight > collapsedHeight + 8);
      }
    };

    check();

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(check);
      observer.observe(el);
      return () => observer.disconnect();
    }
  }, [collapsible, collapsedHeight, preprocessed]);

  const isFolded = collapsible && canExpand && !isExpanded;

  const handleTextClick = (e: React.MouseEvent) => {
    if (!canExpand) return;
    const target = e.target as HTMLElement;
    // Don't intercept if user clicked an explicit link or interactive child
    if (target.closest('a, button, input, textarea')) return;
    setIsExpanded(prev => !prev);
  };

  return (
    <div className={`formatted-description-wrapper relative ${canExpand ? 'group cursor-pointer' : ''}`}>
      <div
        ref={contentRef}
        onClick={handleTextClick}
        role={canExpand ? 'button' : undefined}
        tabIndex={canExpand ? 0 : undefined}
        onKeyDown={canExpand ? (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsExpanded(prev => !prev);
          }
        } : undefined}
        title={canExpand ? (isExpanded ? 'Click to show less' : 'Click to see more details') : undefined}
        style={
          isFolded
            ? {
                maxHeight: `${collapsedHeight}px`,
                maskImage: 'linear-gradient(to bottom, rgba(0, 0, 0, 1) 0%, rgba(0, 0, 0, 1) 35%, rgba(0, 0, 0, 0.35) 75%, rgba(0, 0, 0, 0) 100%)',
                WebkitMaskImage: 'linear-gradient(to bottom, rgba(0, 0, 0, 1) 0%, rgba(0, 0, 0, 1) 35%, rgba(0, 0, 0, 0.35) 75%, rgba(0, 0, 0, 0) 100%)',
              }
            : undefined
        }
        className={`formatted-description leading-relaxed transition-all duration-300 ease-in-out ${
          isFolded ? 'overflow-hidden select-none' : 'overflow-visible'
        } ${canExpand ? 'cursor-pointer hover:opacity-95' : ''} ${className}`}
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            p: ({ node, children, ...props }) => (
              <p
                onClick={canExpand ? handleTextClick : undefined}
                className={`mb-2.5 last:mb-0 leading-relaxed whitespace-pre-line ${canExpand ? 'cursor-pointer' : ''} ${paragraphClassName}`}
                {...props}
              >
                {children}
              </p>
            ),
            ul: ({ node, children, ...props }) => (
              <ul className="list-disc pl-5 sm:pl-6 my-2.5 space-y-1.5 marker:opacity-75" {...props}>
                {children}
              </ul>
            ),
            ol: ({ node, children, ...props }) => (
              <ol className="list-decimal pl-5 sm:pl-6 my-2.5 space-y-1.5 marker:opacity-75 font-medium" {...props}>
                {children}
              </ol>
            ),
            li: ({ node, children, ...props }) => (
              <li className="leading-relaxed pl-0.5" {...props}>
                {children}
              </li>
            ),
            strong: ({ node, children, ...props }) => (
              <strong className="font-semibold opacity-95" {...props}>
                {children}
              </strong>
            ),
            em: ({ node, children, ...props }) => (
              <em className="italic opacity-90" {...props}>
                {children}
              </em>
            ),
            h3: ({ node, children, ...props }) => (
              <h3 className="font-serif text-lg sm:text-xl font-semibold mt-4 mb-2 tracking-tight" {...props}>
                {children}
              </h3>
            ),
            h4: ({ node, children, ...props }) => (
              <h4 className="font-semibold text-sm sm:text-base mt-3 mb-1" {...props}>
                {children}
              </h4>
            ),
            blockquote: ({ node, children, ...props }) => (
              <blockquote className="border-l-2 border-current/30 pl-3.5 my-2.5 italic opacity-85 text-xs sm:text-sm" {...props}>
                {children}
              </blockquote>
            ),
          }}
        >
          {preprocessed}
        </ReactMarkdown>
      </div>

      {/* Unfold / Fold Button */}
      {collapsible && canExpand && (
        <button
          type="button"
          onClick={() => setIsExpanded(prev => !prev)}
          className={`mt-1.5 inline-flex items-center gap-1 text-xs font-semibold hover:opacity-80 transition cursor-pointer select-none ${
            buttonClassName || 'text-stone-900 underline underline-offset-4 decoration-stone-300'
          }`}
          aria-expanded={isExpanded}
        >
          <span>{isExpanded ? collapseLabel : expandLabel}</span>
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform duration-200 ${
              isExpanded ? 'rotate-180' : ''
            }`}
          />
        </button>
      )}
    </div>
  );
}
