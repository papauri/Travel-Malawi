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
  // Only a logo the property actually uploaded. Falling back to its main
  // photograph put a cropped landscape where a wordmark belongs.
  const logo = restaurant.logoUrl;
  // `logoOnly` with no logo would leave the menu with no heading at all.
  const showWordmark = !restaurant.logoOnly || !logo;
  const alignment = align === 'center' ? 'items-center text-center' : 'items-start text-left';

  return (
    <header className={`flex flex-col ${alignment} gap-3 mb-10`}>
      {logo && (
        // Transparent PNGs are the intent, so nothing is drawn behind it.
        <SmartImage
          src={logo}
          alt={restaurant.name ? `${restaurant.name} logo` : 'Restaurant logo'}
          showSkeleton={false}
          className="h-16 w-auto max-w-[12rem] object-contain"
        />
      )}
      {showWordmark && (
        <>
          {restaurant.name && <h2 className={titleClass}>{restaurant.name}</h2>}
          {restaurant.tagline && (
            <p className={`text-xs uppercase tracking-[0.28em] ${accentClass}`}>{restaurant.tagline}</p>
          )}
          {restaurant.description && (
            <p className="text-stone-600 leading-relaxed max-w-xl">{restaurant.description}</p>
          )}
        </>
      )}
    </header>
  );
}

function Footnote({ text, className = '' }: { text?: string; className?: string }) {
  if (!text) return null;
  return <p className={`text-xs text-stone-500 leading-relaxed mt-10 ${className}`}>{text}</p>;
}

function Tags({ tags }: { tags?: string[] }) {
  if (!tags?.length) return null;
  return (
    <span className="ml-2 inline-flex gap-1 align-middle">
      {tags.map(tag => (
        <span key={tag} className="text-[0.6rem] uppercase tracking-wider text-stone-400 border border-stone-200 rounded px-1 py-0.5">
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
    <div className="bg-white rounded-3xl border border-stone-200 p-8 md:p-14">
      <Masthead {...props} titleClass="font-serif text-4xl text-stone-900 tracking-tight" />
      <div className="space-y-12 max-w-2xl mx-auto">
        {restaurant.sections.map(section => (
          <section key={section.id}>
            <h3 className="font-serif text-2xl text-stone-900 text-center mb-1">{section.name}</h3>
            {section.description && (
              <p className="text-sm text-stone-500 text-center mb-6 italic">{section.description}</p>
            )}
            <ul className="space-y-5 mt-6">
              {section.items.map(item => (
                <li key={item.id}>
                  <div className="flex items-baseline gap-2">
                    <span className="font-medium text-stone-900">{item.name}<Tags tags={item.tags} /></span>
                    {/* The dotted leader is a flexible spacer, so it stretches
                        to whatever room is left on the line. */}
                    <span className="flex-1 border-b border-dotted border-stone-300 translate-y-[-0.25rem]" />
                    <span className="font-medium text-stone-900 tabular-nums">
                      {priceLabel(item, currency) ?? '—'}
                    </span>
                  </div>
                  {item.description && (
                    <p className="text-sm text-stone-500 mt-1 pr-16 leading-relaxed">{item.description}</p>
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
    <div className="bg-[#fbfaf8] rounded-3xl border border-stone-200 p-8 md:p-16">
      <Masthead {...props} titleClass="font-serif text-5xl text-stone-900 tracking-tight font-light" />
      <div className="space-y-14 max-w-xl mx-auto text-center">
        {restaurant.sections.map(section => (
          <section key={section.id}>
            <h3 className="text-[0.7rem] uppercase tracking-[0.35em] text-stone-400 mb-2">{section.name}</h3>
            <span className="block w-10 h-px bg-stone-300 mx-auto mb-8" />
            <ul className="space-y-8">
              {section.items.map(item => (
                <li key={item.id}>
                  <p className="font-serif text-xl text-stone-900">{item.name}</p>
                  {item.description && (
                    <p className="text-sm text-stone-500 mt-1.5 leading-relaxed italic">{item.description}</p>
                  )}
                  <p className="text-sm text-stone-600 mt-2 tabular-nums tracking-wide">
                    {priceLabel(item, currency) ?? ''}
                    <Tags tags={item.tags} />
                  </p>
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
    <div className="bg-white rounded-3xl border border-stone-200 p-8 md:p-14">
      <Masthead {...props} align="left" titleClass="text-3xl font-semibold text-stone-900 tracking-tight" />
      <div className="space-y-12 max-w-2xl">
        {restaurant.sections.map(section => (
          <section key={section.id}>
            <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-400 mb-6">{section.name}</h3>
            <ul className="space-y-6">
              {section.items.map(item => (
                <li key={item.id} className="flex justify-between gap-8">
                  <div className="min-w-0">
                    <p className="text-stone-900">{item.name}<Tags tags={item.tags} /></p>
                    {item.description && (
                      <p className="text-sm text-stone-500 mt-1 leading-relaxed">{item.description}</p>
                    )}
                  </div>
                  <span className="text-stone-900 tabular-nums shrink-0">{priceLabel(item, currency) ?? '—'}</span>
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
    <div className="bg-[#f7f3ea] rounded-3xl border border-[#e6dcc8] p-8 md:p-12">
      <Masthead {...props} accentClass="text-[#a98d5f]" titleClass="font-serif text-4xl text-[#3f3527] tracking-tight" />
      <div className="grid md:grid-cols-2 gap-x-12 gap-y-10">
        {restaurant.sections.map(section => (
          <section key={section.id} className="break-inside-avoid">
            <h3 className="font-serif text-xl text-[#3f3527] pb-2 mb-4 border-b-2 border-[#e6dcc8]">
              {section.name}
            </h3>
            {section.description && <p className="text-sm text-[#7a6a52] mb-4">{section.description}</p>}
            <ul className="space-y-4">
              {section.items.map(item => (
                <li key={item.id} className="flex justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-semibold text-[#3f3527]">{item.name}<Tags tags={item.tags} /></p>
                    {item.description && (
                      <p className="text-sm text-[#7a6a52] mt-0.5 leading-relaxed">{item.description}</p>
                    )}
                  </div>
                  <span className="font-semibold text-[#3f3527] tabular-nums shrink-0">
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
    <div className="bg-stone-50 rounded-3xl border border-stone-200 p-8 md:p-12">
      <Masthead {...props} align="left" titleClass="text-4xl font-bold text-stone-900 tracking-tight" />
      <div className="space-y-10">
        {restaurant.sections.map(section => (
          <section key={section.id}>
            <div className="flex items-baseline gap-3 mb-5">
              <h3 className="text-lg font-bold text-stone-900">{section.name}</h3>
              <span className="flex-1 h-px bg-stone-200" />
              <span className="text-xs text-stone-400 font-medium">{section.items.length} items</span>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {section.items.map(item => (
                <article key={item.id} className="bg-white rounded-2xl border border-stone-200 p-5 flex flex-col">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h4 className="font-semibold text-stone-900 leading-snug">{item.name}</h4>
                    <span className="shrink-0 bg-stone-900 text-white text-xs font-bold px-2.5 py-1 rounded-full tabular-nums">
                      {priceLabel(item, currency) ?? '—'}
                    </span>
                  </div>
                  {item.description && (
                    <p className="text-sm text-stone-500 leading-relaxed">{item.description}</p>
                  )}
                  <div className="mt-auto pt-2"><Tags tags={item.tags} /></div>
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
    <div className="bg-[#fdfcf9] rounded-3xl border border-stone-200 p-4 md:p-6">
      <div className="border-2 border-double border-stone-300 rounded-2xl p-8 md:p-14">
        <Masthead {...props} titleClass="font-serif text-4xl text-stone-900 tracking-[0.08em] uppercase" />
        <div className="space-y-12 max-w-2xl mx-auto">
          {restaurant.sections.map(section => (
            <section key={section.id}>
              <div className="text-center mb-6">
                <h3 className="font-serif text-sm uppercase tracking-[0.3em] text-stone-700">{section.name}</h3>
                <span className="block w-24 h-px bg-stone-300 mx-auto mt-3" />
              </div>
              <ul className="space-y-6">
                {section.items.map(item => (
                  <li key={item.id} className="text-center">
                    <p className="font-serif text-lg text-stone-900 tracking-wide">
                      {item.name}<Tags tags={item.tags} />
                    </p>
                    {item.description && (
                      <p className="text-sm text-stone-500 mt-1 leading-relaxed max-w-md mx-auto">{item.description}</p>
                    )}
                    <p className="font-serif text-stone-700 mt-1.5 tabular-nums">
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
      <div className="bg-white rounded-3xl border border-stone-200 p-12 text-center">
        <p className="text-stone-500">This menu has not been published yet.</p>
        <p className="text-sm text-stone-400 mt-1">Contact the property for today's dishes.</p>
      </div>
    );
  }

  return <Renderer {...props} />;
}
