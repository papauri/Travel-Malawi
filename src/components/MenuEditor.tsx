import React, { useState } from 'react';
import { GripVertical, Plus, Trash2, ChevronUp, ChevronDown, Upload } from 'lucide-react';
import { CurrencyCode, MenuItem, MenuSection, Restaurant } from '../types';
import { CURRENCIES, CURRENCY_CODES } from '../lib/currency';
import { MENU_TEMPLATES } from './MenuTemplates';
import OpeningHoursEditor from './OpeningHoursEditor';
import ImageUpload from './ImageUpload';
import { defaultWeek } from '../lib/hours';
import MenuImporter from './MenuImporter';
import ConfirmDialog from './ConfirmDialog';

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

const inputClass = 'tm-input';

/**
 * Editor for a property's restaurant: whether it exists, how the menu looks,
 * and what is on it. Prices reuse the same per-currency model as rooms, so a
 * kitchen quoting kwacha does not have to think in dollars.
 */
export default function MenuEditor({ value, onChange, currencies }: Props) {
  const [showImporter, setShowImporter] = useState(false);
  const [sectionToDelete, setSectionToDelete] = useState<MenuSection | null>(null);
  const priced = currencies.length > 0 ? currencies : (['USD'] as CurrencyCode[]);

  const patch = (changes: Partial<Restaurant>) => onChange({ ...value, ...changes });

  const handleMenuImport = (importedSections: MenuSection[]) => {
    // If current sections only contain empty placeholders (0 items), replace them cleanly
    const current = value.sections || [];
    const hasExistingDishes = current.some(s => s.items && s.items.length > 0);
    const cleanedCurrent = current.filter(s => s.items && s.items.length > 0);
    const merged = hasExistingDishes ? [...cleanedCurrent, ...importedSections] : importedSections;
    onChange({ ...value, sections: merged, enabled: true });
  };

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
    <div className="space-y-6 min-w-0">
      <MenuImporter
        open={showImporter}
        onClose={() => setShowImporter(false)}
        onImport={handleMenuImport}
        currencies={currencies}
      />

      {/* --- Whether the property has one at all, and the menu importer --- */}
      <div className="tm-panel flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <label className="flex items-start gap-3 cursor-pointer min-w-0">
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
        <button
          type="button"
          id="top-import-menu-btn"
          onClick={() => {
            if (!value.enabled) patch({ enabled: true });
            setShowImporter(true);
          }}
          title="Upload a photo, PDF, spreadsheet or pasted price list"
          className="tm-btn tm-btn-secondary shrink-0 self-start"
        >
          <Upload className="w-4 h-4" />
          Import a menu
        </button>
      </div>

      {value.enabled && (
        <>
          {/* --- Identity --- */}
          <div className="tm-panel space-y-5">
            <h3 className="tm-h2">Restaurant details</h3>

            <div className="grid md:grid-cols-2 gap-5">
              <div>
                <label className="tm-label">Name</label>
                <input
                  type="text"
                  value={value.name ?? ''}
                  onChange={e => patch({ name: e.target.value })}
                  placeholder="e.g. The Boathouse"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="tm-label">Tagline</label>
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
              <label className="tm-label">Description</label>
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
          <div className="tm-panel">
            <h3 className="tm-h2 mb-1">Menu design</h3>
            <p className="tm-muted mb-4">
              The same dishes, presented six ways. Changing this never changes what is on the menu.
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {MENU_TEMPLATES.map((template, tIdx) => {
                const selected = value.template === template.id;
                return (
                  <button
                    key={`${template.id || 'tpl'}-${tIdx}`}
                    type="button"
                    onClick={() => patch({ template: template.id })}
                    aria-pressed={selected}
                    className={`text-left rounded-lg border p-3 transition min-w-0 ${
                      selected
                        ? 'border-amber-700 bg-amber-50 ring-1 ring-amber-700'
                        : 'border-stone-200 hover:border-stone-400 bg-white'
                    }`}
                  >
                    <span className="block font-semibold mb-1">{template.name}</span>
                    <span className="block text-xs leading-relaxed text-stone-500">
                      {template.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* --- The menu itself --- */}
          <div className="tm-panel">
            <div className="flex flex-wrap items-center justify-between mb-4 gap-3">
              <h3 className="tm-h2">Menu</h3>
              <div className="tm-actions">
                <button
                  type="button"
                  onClick={() => setShowImporter(true)}
                  className="tm-btn tm-btn-quiet tm-btn-sm"
                >
                  <Upload className="w-4 h-4" />
                  Import
                </button>
                <button
                  type="button"
                  onClick={() => patch({ sections: [...value.sections, { id: newId(), name: 'New section', items: [] }] })}
                  className="tm-btn tm-btn-secondary tm-btn-sm"
                >
                  <Plus className="h-4 w-4" /> Add section
                </button>
              </div>
            </div>

            {value.sections.length === 0 && (
              <p className="tm-muted border border-dashed border-stone-300 rounded-lg p-6 text-center">
                No sections yet. Add one for starters, mains, drinks…
              </p>
            )}

            <div className="space-y-6">
              {value.sections.map((section, sectionIndex) => (
                <div key={`menu-sec-${section.id || sectionIndex}-${sectionIndex}`} className="min-w-0">
                  <div className="flex items-center gap-1 bg-stone-50 rounded-lg px-3 py-2">
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
                      onClick={() =>
                        section.items.length > 0
                          ? setSectionToDelete(section)
                          : patch({ sections: value.sections.filter(s => s.id !== section.id) })
                      }
                      aria-label="Delete section"
                      className="p-1.5 text-stone-400 hover:text-red-600 transition"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="pt-1 sm:pl-3 divide-y divide-stone-100">
                    {section.items.map((item, itemIndex) => (
                      <div key={`menu-item-${item.id || itemIndex}-${sectionIndex}-${itemIndex}`} className="py-3 space-y-2 min-w-0">
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={item.name}
                            onChange={e => patchItem(section.id, item.id, { name: e.target.value })}
                            placeholder="Dish name"
                            className={`${inputClass} font-medium`}
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
                          className={inputClass}
                        />

                        <div className="flex flex-wrap gap-3">
                          {priced.map((code, cIdx) => (
                            <div key={`price-input-${code}-${sectionIndex}-${itemIndex}-${cIdx}`} className="flex items-center gap-1.5">
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
                                className="w-24 sm:w-28 bg-white border border-stone-300 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:border-stone-500"
                              />
                            </div>
                          ))}
                          <input
                            type="text"
                            value={(item.tags ?? []).join(', ')}
                            onChange={e =>
                              patchItem(section.id, item.id, {
                                // Kept loosely while typing so a comma or space is not eaten;
                                // trimmed and emptied out when the menu is saved.
                                tags: e.target.value.split(',').map(t => t.trimStart()),
                              })
                            }
                            placeholder="Tags, e.g. v, gf"
                            className={`${inputClass} flex-1 min-w-[8rem]`}
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
                      className="tm-btn tm-btn-quiet tm-btn-sm mt-1"
                    >
                      <Plus className="h-4 w-4" /> Add dish
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6">
              <label className="tm-label">Footnote</label>
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

      <ConfirmDialog
        isOpen={!!sectionToDelete}
        title="Delete section?"
        message={`"${sectionToDelete?.name || 'This section'}" and its ${sectionToDelete?.items.length ?? 0} dish${sectionToDelete?.items.length === 1 ? '' : 'es'} will be removed from the menu when you save.`}
        confirmText="Delete section"
        isDestructive
        onCancel={() => setSectionToDelete(null)}
        onConfirm={() => {
          if (sectionToDelete) patch({ sections: value.sections.filter(s => s.id !== sectionToDelete.id) });
          setSectionToDelete(null);
        }}
      />
    </div>
  );
}

export { CURRENCY_CODES };
