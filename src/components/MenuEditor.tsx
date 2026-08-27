import React from 'react';
import { GripVertical, Plus, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import { CurrencyCode, MenuItem, MenuSection, Restaurant } from '../types';
import { CURRENCIES, CURRENCY_CODES } from '../lib/currency';
import { MENU_TEMPLATES } from './MenuTemplates';
import OpeningHoursEditor from './OpeningHoursEditor';
import ImageUpload from './ImageUpload';
import { defaultWeek } from '../lib/hours';

interface Props {
  value: Restaurant;
  onChange: (restaurant: Restaurant) => void;
  /** Currencies the property sells in, so menu prices match its room prices. */
  currencies: CurrencyCode[];
}

const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export function emptyRestaurant(): Restaurant {
  return {
    enabled: true,
    name: '',
    tagline: '',
    description: '',
    template: 'classic',
    logoOnly: false,
    hours: defaultWeek('12:00', '22:00'),
    sections: [
      { id: newId(), name: 'Starters', items: [] },
      { id: newId(), name: 'Mains', items: [] },
    ],
  };
}

const inputClass =
  'w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-stone-900 transition';

/**
 * Editor for a property's restaurant: whether it exists, how the menu looks,
 * and what is on it. Prices reuse the same per-currency model as rooms, so a
 * kitchen quoting kwacha does not have to think in dollars.
 */
export default function MenuEditor({ value, onChange, currencies }: Props) {
  const priced = currencies.length > 0 ? currencies : (['USD'] as CurrencyCode[]);

  const patch = (changes: Partial<Restaurant>) => onChange({ ...value, ...changes });

  const patchSection = (sectionId: string, changes: Partial<MenuSection>) =>
    patch({ sections: value.sections.map(s => (s.id === sectionId ? { ...s, ...changes } : s)) });

  const patchItem = (sectionId: string, itemId: string, changes: Partial<MenuItem>) =>
    patchSection(sectionId, {
      items: value.sections.find(s => s.id === sectionId)!.items.map(i =>
        i.id === itemId ? { ...i, ...changes } : i
      ),
    });

  const moveSection = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= value.sections.length) return;
    const next = [...value.sections];
    [next[index], next[target]] = [next[target], next[index]];
    patch({ sections: next });
  };

  return (
    <div className="space-y-8">
      {/* --- Whether the property has one at all --- */}
      <div className="bg-white rounded-3xl border border-stone-200 p-6 md:p-8">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={value.enabled}
            onChange={e => patch({ enabled: e.target.checked })}
            className="w-5 h-5 mt-0.5 rounded border-stone-300 text-stone-900 focus:ring-stone-900"
          />
          <span>
            <span className="block font-semibold text-stone-900">This property has a restaurant</span>
            <span className="block text-sm text-stone-500 mt-0.5">
              Adds a Menu tab to your listing. Turn it off to hide the tab without losing the menu.
            </span>
          </span>
        </label>
      </div>

      {value.enabled && (
        <>
          {/* --- Identity --- */}
          <div className="bg-white rounded-3xl border border-stone-200 p-6 md:p-8 space-y-6">
            <h3 className="font-serif text-xl text-stone-900">Restaurant details</h3>

            <div className="grid md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Name</label>
                <input
                  type="text"
                  value={value.name ?? ''}
                  onChange={e => patch({ name: e.target.value })}
                  placeholder="e.g. The Boathouse"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Tagline</label>
                <input
                  type="text"
                  value={value.tagline ?? ''}
                  onChange={e => patch({ tagline: e.target.value })}
                  placeholder="e.g. Lakeside dining"
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Description</label>
              <textarea
                rows={2}
                value={value.description ?? ''}
                onChange={e => patch({ description: e.target.value })}
                placeholder="A sentence on the kitchen, the produce, the view…"
                className={`${inputClass} resize-none`}
              />
            </div>

            <ImageUpload
              label="Menu logo — a transparent PNG works best"
              value={value.logoUrl ?? ''}
              onChange={url => patch({ logoUrl: url })}
              folder="menu-logos"
            />

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={value.logoOnly ?? false}
                onChange={e => patch({ logoOnly: e.target.checked })}
                className="w-5 h-5 mt-0.5 rounded border-stone-300 text-stone-900 focus:ring-stone-900"
              />
              <span>
                <span className="block font-medium text-stone-800 text-sm">Show the logo only</span>
                <span className="block text-xs text-stone-500 mt-0.5">
                  Hides the name, tagline and description at the head of the menu — for a logo
                  that already carries the wordmark.
                </span>
              </span>
            </label>

            <OpeningHoursEditor
              value={value.hours}
              onChange={hours => patch({ hours })}
              label="Kitchen hours"
              hint="Often different from the property's own hours."
            />
          </div>

          {/* --- Template --- */}
          <div className="bg-white rounded-3xl border border-stone-200 p-6 md:p-8">
            <h3 className="font-serif text-xl text-stone-900 mb-1">Menu design</h3>
            <p className="text-sm text-stone-500 mb-6">
              The same dishes, presented six ways. Changing this never changes what is on the menu.
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {MENU_TEMPLATES.map(template => {
                const selected = value.template === template.id;
                return (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => patch({ template: template.id })}
                    aria-pressed={selected}
                    className={`text-left rounded-2xl border p-4 transition ${
                      selected
                        ? 'border-stone-900 bg-stone-900 text-white'
                        : 'border-stone-200 hover:border-stone-400 bg-white'
                    }`}
                  >
                    <span className="block font-semibold mb-1">{template.name}</span>
                    <span className={`block text-xs leading-relaxed ${selected ? 'text-stone-300' : 'text-stone-500'}`}>
                      {template.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* --- The menu itself --- */}
          <div className="bg-white rounded-3xl border border-stone-200 p-6 md:p-8">
            <div className="flex items-center justify-between mb-6 gap-4">
              <h3 className="font-serif text-xl text-stone-900">Menu</h3>
              <button
                type="button"
                onClick={() => patch({ sections: [...value.sections, { id: newId(), name: 'New section', items: [] }] })}
                className="flex items-center gap-2 bg-stone-900 text-white px-4 py-2 rounded-full text-sm font-semibold hover:bg-stone-800 transition"
              >
                <Plus className="h-4 w-4" /> Add section
              </button>
            </div>

            {value.sections.length === 0 && (
              <p className="text-sm text-stone-500 border border-dashed border-stone-300 rounded-2xl p-8 text-center">
                No sections yet. Add one for starters, mains, drinks…
              </p>
            )}

            <div className="space-y-6">
              {value.sections.map((section, sectionIndex) => (
                <div key={section.id} className="rounded-2xl border border-stone-200 overflow-hidden">
                  <div className="flex items-center gap-2 bg-stone-50 px-4 py-3 border-b border-stone-200">
                    <GripVertical className="h-4 w-4 text-stone-300 shrink-0" />
                    <input
                      type="text"
                      value={section.name}
                      onChange={e => patchSection(section.id, { name: e.target.value })}
                      placeholder="Section name"
                      className="flex-1 bg-transparent font-semibold text-stone-900 outline-none min-w-0"
                    />
                    <button
                      type="button"
                      onClick={() => moveSection(sectionIndex, -1)}
                      disabled={sectionIndex === 0}
                      aria-label="Move section up"
                      className="p-1.5 text-stone-400 hover:text-stone-900 disabled:opacity-30 transition"
                    >
                      <ChevronUp className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveSection(sectionIndex, 1)}
                      disabled={sectionIndex === value.sections.length - 1}
                      aria-label="Move section down"
                      className="p-1.5 text-stone-400 hover:text-stone-900 disabled:opacity-30 transition"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => patch({ sections: value.sections.filter(s => s.id !== section.id) })}
                      aria-label="Delete section"
                      className="p-1.5 text-stone-400 hover:text-red-600 transition"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="p-4 space-y-3">
                    {section.items.map(item => (
                      <div key={item.id} className="rounded-xl border border-stone-100 bg-stone-50/60 p-3 space-y-2">
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={item.name}
                            onChange={e => patchItem(section.id, item.id, { name: e.target.value })}
                            placeholder="Dish name"
                            className={`${inputClass} bg-white font-medium`}
                          />
                          <button
                            type="button"
                            onClick={() => patchSection(section.id, { items: section.items.filter(i => i.id !== item.id) })}
                            aria-label="Remove dish"
                            className="shrink-0 p-2 text-stone-400 hover:text-red-600 transition"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>

                        <input
                          type="text"
                          value={item.description ?? ''}
                          onChange={e => patchItem(section.id, item.id, { description: e.target.value })}
                          placeholder="Description — optional"
                          className={`${inputClass} bg-white text-stone-600`}
                        />

                        <div className="flex flex-wrap gap-3">
                          {priced.map(code => (
                            <div key={code} className="flex items-center gap-1.5">
                              <span className="text-xs font-semibold text-stone-500 w-6 text-right">
                                {CURRENCIES[code].symbol}
                              </span>
                              <input
                                type="number"
                                min="0"
                                step={CURRENCIES[code].step}
                                value={item.prices?.[code] ?? 0}
                                onChange={e =>
                                  patchItem(section.id, item.id, {
                                    prices: { ...(item.prices ?? {}), [code]: Number(e.target.value) },
                                  })
                                }
                                className="w-28 bg-white border border-stone-200 rounded-lg px-2 py-1.5 text-sm text-center outline-none focus:border-stone-900"
                              />
                            </div>
                          ))}
                          <input
                            type="text"
                            value={(item.tags ?? []).join(', ')}
                            onChange={e =>
                              patchItem(section.id, item.id, {
                                tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean),
                              })
                            }
                            placeholder="Tags, e.g. v, gf"
                            className={`${inputClass} bg-white flex-1 min-w-[8rem]`}
                          />
                        </div>
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={() =>
                        patchSection(section.id, {
                          items: [...section.items, { id: newId(), name: '', prices: {} }],
                        })
                      }
                      className="w-full border border-dashed border-stone-300 rounded-xl py-2.5 text-sm font-medium text-stone-500 hover:border-stone-500 hover:text-stone-900 transition"
                    >
                      + Add dish
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6">
              <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">
                Footnote
              </label>
              <input
                type="text"
                value={value.footnote ?? ''}
                onChange={e => patch({ footnote: e.target.value })}
                placeholder="Allergens, service charge, sitting times…"
                className={inputClass}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export { CURRENCY_CODES };
