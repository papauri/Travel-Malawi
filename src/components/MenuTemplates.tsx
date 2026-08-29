/**
 * Six presentations of the same menu data.
 *
 * These follow the conventions restaurant menus actually use rather than any
 * one source: a leader-dotted classic, a centred fine-dining card, a stripped
 * minimal list, a two-column bistro board, a modern card grid, and a heritage
 * layout with a ruled border. Only the styling differs — every template renders
 * the same sections, items, descriptions and per-currency prices, so switching
 * template never changes what the kitchen is offering.
 */

import React from 'react';
import { CurrencyCode, MenuSection, MenuTemplate, Restaurant } from '../types';
import { formatMoney, packagePrice } from '../lib/currency';
import SmartImage from './SmartImage';

export interface MenuTemplateOption {
  id: MenuTemplate;
  name: string;
  description: string;
}

export const MENU_TEMPLATES: MenuTemplateOption[] = [
  { id: 'classic', name: 'Classic', description: 'Serif headings with leader dots running to the price.' },
  { id: 'elegant', name: 'Elegant', description: 'Centred and airy, for a set dinner or fine dining.' },
  { id: 'minimal', name: 'Minimal', description: 'Plain type, generous space, no ornament at all.' },
  { id: 'bistro', name: 'Bistro', description: 'Two columns on a warm ground, like a cafe board.' },
  { id: 'modern', name: 'Modern', description: 'Cards in a grid, prices as chips.' },
  { id: 'heritage', name: 'Heritage', description: 'Ruled border and small caps, in an older register.' },
];

interface Props {
  restaurant: Restaurant;
  currency: CurrencyCode;
}

/** An item's price in the chosen currency, or null when it has none. */
function itemPrice(item: { prices?: Record<string, number | undefined> }, currency: CurrencyCode): number | null {
  return packagePrice(item as never, currency);
}

function priceLabel(item: { prices?: Record<string, number | undefined> }, currency: CurrencyCode): string | null {
  const amount = itemPrice(item, currency);
  return amount === null ? null : formatMoney(amount, currency);
}

/** Shared masthead. `logoOnly` drops the wordmark and leaves just the mark. */
function Masthead({
  restaurant,
  align = 'center',
  accentClass = 'text-stone-400',
  titleClass,
}: Props & { align?: 'center' | 'left'; accentClass?: string; titleClass: string }) {
  const logo = restaurant.logoUrl;
  const showWordmark = !restaurant.logoOnly || !logo;
  const alignment = align === 'center' ? 'items-center text-center' : 'items-start text-left';

  return (
    <header className={`flex flex-col ${alignment} gap-2.5 sm:gap-3 mb-8 sm:mb-10 md:mb-12`}>
      {logo && (
        <SmartImage
          src={logo}
          alt={restaurant.name ? `${restaurant.name} logo` : 'Restaurant logo'}
          className="h-12 sm:h-16 w-auto max-w-[12rem] object-contain mb-1"
        />
      )}
      {showWordmark && (
        <>
          {restaurant.name && <h2 className={titleClass}>{restaurant.name}</h2>}
          {restaurant.tagline && (
            <p className={`text-[10px] sm:text-xs uppercase tracking-[0.22em] sm:tracking-[0.28em] font-medium ${accentClass}`}>
              {restaurant.tagline}
            </p>
          )}
          {restaurant.description && (
            <p className="text-stone-600 text-xs sm:text-sm md:text-base leading-relaxed max-w-xl">
              {restaurant.description}
            </p>
          )}
        </>
      )}
    </header>
  );
}

function Footnote({ text, className = '' }: { text?: string; className?: string }) {
  if (!text) return null;
  return (
    <div className={`mt-8 sm:mt-10 pt-4 border-t border-stone-200/60 ${className}`}>
      <p className="text-xs text-stone-500 italic leading-relaxed">{text}</p>
    </div>
  );
}

function Tags({ tags }: { tags?: string[] }) {
  if (!tags?.length) return null;
  return (
    <span className="inline-flex flex-wrap gap-1 align-middle ml-1.5">
      {tags.map(tag => (
        <span
          key={tag}
          className="text-[9px] sm:text-[10px] uppercase font-semibold tracking-wider text-emerald-800 bg-emerald-50/90 border border-emerald-200/80 rounded-full px-2 py-0.5 whitespace-nowrap shadow-2xs"
        >
          {tag}
        </span>
      ))}
    </span>
  );
}

const hasItems = (sections: MenuSection[]) => sections.some(s => s.items.length > 0);

// --- Classic: leader dots, the layout most printed menus still use ----------
function ClassicMenu(props: Props) {
  const { restaurant, currency } = props;
  return (
    <div className="bg-white rounded-3xl border border-stone-200 p-5 sm:p-8 md:p-12 lg:p-14 shadow-xs">
      <Masthead {...props} titleClass="font-serif text-3xl sm:text-4xl md:text-5xl text-stone-900 tracking-tight" />
      <div className="space-y-10 sm:space-y-12 max-w-2xl mx-auto">
        {restaurant.sections.map(section => (
          <section key={section.id}>
            <h3 className="font-serif text-xl sm:text-2xl md:text-3xl text-stone-900 text-center mb-1">
              {section.name}
            </h3>
            {section.description && (
              <p className="text-xs sm:text-sm text-stone-500 text-center mb-5 sm:mb-6 italic max-w-md mx-auto">
                {section.description}
              </p>
            )}
            <ul className="space-y-4 sm:space-y-5 mt-4 sm:mt-6">
              {section.items.map(item => (
                <li key={item.id} className="group">
                  <div className="flex items-baseline justify-between gap-2 sm:gap-4">
                    <div className="font-serif font-medium text-stone-900 text-base sm:text-lg flex flex-wrap items-baseline gap-1.5 min-w-0">
                      <span>{item.name}</span>
                      <Tags tags={item.tags} />
                    </div>
                    <span className="hidden sm:inline-block flex-1 border-b border-dotted border-stone-300 translate-y-[-0.25rem] min-w-[20px]" />
                    <span className="font-serif font-semibold text-stone-900 tabular-nums shrink-0 text-sm sm:text-base pl-2">
                      {priceLabel(item, currency) ?? '—'}
                    </span>
                  </div>
                  {item.description && (
                    <p className="text-xs sm:text-sm text-stone-500 mt-1 sm:pr-14 leading-relaxed">
                      {item.description}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <Footnote text={restaurant.footnote} className="text-center max-w-2xl mx-auto" />
    </div>
  );
}

// --- Elegant: centred, wide letter-spacing, plenty of air -------------------
function ElegantMenu(props: Props) {
  const { restaurant, currency } = props;
  return (
    <div className="bg-[#fbfaf8] rounded-3xl border border-stone-200 p-5 sm:p-8 md:p-12 lg:p-16 shadow-xs">
      <Masthead {...props} titleClass="font-serif text-3xl sm:text-4xl md:text-5xl text-stone-900 tracking-tight font-light" />
      <div className="space-y-10 sm:space-y-14 max-w-xl mx-auto text-center">
        {restaurant.sections.map(section => (
          <section key={section.id}>
            <h3 className="text-[10px] sm:text-xs uppercase tracking-[0.25em] sm:tracking-[0.35em] text-stone-500 font-semibold mb-2">
              {section.name}
            </h3>
            <span className="block w-10 sm:w-12 h-px bg-stone-300 mx-auto mb-6 sm:mb-8" />
            <ul className="space-y-6 sm:space-y-8">
              {section.items.map(item => (
                <li key={item.id} className="space-y-1">
                  <p className="font-serif text-lg sm:text-xl md:text-2xl text-stone-900">
                    {item.name}
                  </p>
                  {item.description && (
                    <p className="text-xs sm:text-sm text-stone-500 leading-relaxed italic max-w-md mx-auto">
                      {item.description}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                    <span className="text-xs sm:text-sm font-semibold text-stone-700 tabular-nums tracking-wide">
                      {priceLabel(item, currency) ?? ''}
                    </span>
                    <Tags tags={item.tags} />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <Footnote text={restaurant.footnote} className="text-center max-w-xl mx-auto" />
    </div>
  );
}

// --- Minimal: no rules, no ornament, type doing all the work ----------------
function MinimalMenu(props: Props) {
  const { restaurant, currency } = props;
  return (
    <div className="bg-white rounded-3xl border border-stone-200 p-5 sm:p-8 md:p-12 lg:p-14 shadow-xs">
      <Masthead {...props} align="left" titleClass="text-2xl sm:text-3xl md:text-4xl font-bold text-stone-900 tracking-tight" />
      <div className="space-y-10 sm:space-y-12 max-w-2xl">
        {restaurant.sections.map(section => (
          <section key={section.id}>
            <h3 className="text-xs sm:text-sm font-semibold uppercase tracking-[0.18em] text-stone-400 mb-4 sm:mb-6 pb-2 border-b border-stone-100">
              {section.name}
            </h3>
            <ul className="space-y-5 sm:space-y-6">
              {section.items.map(item => (
                <li key={item.id} className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 sm:gap-6 pb-3 border-b border-stone-50 last:border-b-0">
                  <div className="min-w-0">
                    <div className="text-stone-900 font-medium text-sm sm:text-base flex flex-wrap items-baseline gap-1.5">
                      <span>{item.name}</span>
                      <Tags tags={item.tags} />
                    </div>
                    {item.description && (
                      <p className="text-xs sm:text-sm text-stone-500 mt-1 leading-relaxed">{item.description}</p>
                    )}
                  </div>
                  <span className="text-stone-900 font-semibold text-sm sm:text-base tabular-nums shrink-0">
                    {priceLabel(item, currency) ?? '—'}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <Footnote text={restaurant.footnote} />
    </div>
  );
}

// --- Bistro: warm ground, two columns, chalkboard cadence -------------------
function BistroMenu(props: Props) {
  const { restaurant, currency } = props;
  return (
    <div className="bg-[#f7f3ea] rounded-3xl border border-[#e6dcc8] p-5 sm:p-8 md:p-10 lg:p-12 shadow-xs">
      <Masthead {...props} accentClass="text-[#a98d5f]" titleClass="font-serif text-3xl sm:text-4xl md:text-5xl text-[#3f3527] tracking-tight" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 sm:gap-x-10 lg:gap-x-12 gap-y-8 sm:gap-y-10">
        {restaurant.sections.map(section => (
          <section key={section.id} className="break-inside-avoid">
            <h3 className="font-serif text-lg sm:text-xl text-[#3f3527] pb-2 mb-3 sm:mb-4 border-b-2 border-[#e6dcc8] font-bold">
              {section.name}
            </h3>
            {section.description && (
              <p className="text-xs sm:text-sm text-[#7a6a52] mb-3 italic">{section.description}</p>
            )}
            <ul className="space-y-3.5 sm:space-y-4">
              {section.items.map(item => (
                <li key={item.id} className="flex items-baseline justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold text-[#3f3527] text-sm sm:text-base flex flex-wrap items-baseline gap-1.5">
                      <span>{item.name}</span>
                      <Tags tags={item.tags} />
                    </div>
                    {item.description && (
                      <p className="text-xs sm:text-sm text-[#7a6a52] mt-0.5 leading-relaxed">{item.description}</p>
                    )}
                  </div>
                  <span className="font-bold text-[#3f3527] tabular-nums shrink-0 text-sm sm:text-base">
                    {priceLabel(item, currency) ?? '—'}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <Footnote text={restaurant.footnote} className="text-[#7a6a52]" />
    </div>
  );
}

// --- Modern: cards in a grid, price as a chip -------------------------------
function ModernMenu(props: Props) {
  const { restaurant, currency } = props;
  return (
    <div className="bg-stone-50 rounded-3xl border border-stone-200 p-5 sm:p-8 md:p-10 lg:p-12 shadow-xs">
      <Masthead {...props} align="left" titleClass="text-2xl sm:text-3xl md:text-4xl font-bold text-stone-900 tracking-tight" />
      <div className="space-y-8 sm:space-y-10">
        {restaurant.sections.map(section => (
          <section key={section.id}>
            <div className="flex items-baseline gap-3 mb-4 sm:mb-5">
              <h3 className="text-base sm:text-lg font-bold text-stone-900">{section.name}</h3>
              <span className="flex-1 h-px bg-stone-200" />
              <span className="text-xs text-stone-400 font-medium">{section.items.length} items</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
              {section.items.map(item => (
                <article key={item.id} className="bg-white rounded-2xl border border-stone-200/90 p-4 sm:p-5 flex flex-col justify-between shadow-2xs hover:shadow-xs transition-shadow">
                  <div>
                    <div className="flex items-start justify-between gap-2.5 mb-2">
                      <h4 className="font-semibold text-stone-900 text-sm sm:text-base leading-snug">{item.name}</h4>
                      <span className="shrink-0 bg-stone-900 text-white text-[11px] sm:text-xs font-bold px-2.5 py-1 rounded-full tabular-nums shadow-2xs">
                        {priceLabel(item, currency) ?? '—'}
                      </span>
                    </div>
                    {item.description && (
                      <p className="text-xs sm:text-sm text-stone-500 leading-relaxed mb-3">{item.description}</p>
                    )}
                  </div>
                  <div className="pt-1"><Tags tags={item.tags} /></div>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
      <Footnote text={restaurant.footnote} />
    </div>
  );
}

// --- Heritage: double rule, small caps, an older register -------------------
function HeritageMenu(props: Props) {
  const { restaurant, currency } = props;
  return (
    <div className="bg-[#fdfcf9] rounded-3xl border border-stone-200 p-3.5 sm:p-6 md:p-8 shadow-xs">
      <div className="border-2 border-double border-stone-300 rounded-2xl p-5 sm:p-8 md:p-12 lg:p-14">
        <Masthead {...props} titleClass="font-serif text-2xl sm:text-3xl md:text-4xl text-stone-900 tracking-[0.08em] uppercase" />
        <div className="space-y-10 sm:space-y-12 max-w-2xl mx-auto">
          {restaurant.sections.map(section => (
            <section key={section.id}>
              <div className="text-center mb-5 sm:mb-6">
                <h3 className="font-serif text-xs sm:text-sm uppercase tracking-[0.25em] sm:tracking-[0.3em] text-stone-700 font-bold">
                  {section.name}
                </h3>
                <span className="block w-20 sm:w-24 h-px bg-stone-300 mx-auto mt-2.5" />
              </div>
              <ul className="space-y-5 sm:space-y-6">
                {section.items.map(item => (
                  <li key={item.id} className="text-center space-y-1">
                    <div className="font-serif text-base sm:text-lg text-stone-900 tracking-wide flex flex-wrap items-baseline justify-center gap-1.5">
                      <span>{item.name}</span>
                      <Tags tags={item.tags} />
                    </div>
                    {item.description && (
                      <p className="text-xs sm:text-sm text-stone-500 leading-relaxed max-w-md mx-auto italic">{item.description}</p>
                    )}
                    <p className="font-serif font-semibold text-stone-800 text-xs sm:text-sm mt-1 tabular-nums">
                      {priceLabel(item, currency) ?? ''}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <Footnote text={restaurant.footnote} className="text-center max-w-2xl mx-auto" />
      </div>
    </div>
  );
}

const RENDERERS: Record<MenuTemplate, React.FC<Props>> = {
  classic: ClassicMenu,
  elegant: ElegantMenu,
  minimal: MinimalMenu,
  bistro: BistroMenu,
  modern: ModernMenu,
  heritage: HeritageMenu,
};

export default function MenuTemplateView(props: Props) {
  const { restaurant } = props;
  const Renderer = RENDERERS[restaurant.template] ?? ClassicMenu;

  if (!restaurant.sections?.length || !hasItems(restaurant.sections)) {
    return (
      <div className="bg-white rounded-3xl border border-stone-200 p-8 sm:p-12 text-center shadow-xs">
        <p className="text-stone-600 font-medium">This menu has not been published yet.</p>
        <p className="text-xs sm:text-sm text-stone-400 mt-1">Contact the property for today's dishes and daily specials.</p>
      </div>
    );
  }

  return <Renderer {...props} />;
}

