const fs = require('fs');
let code = fs.readFileSync('src/components/ConferenceManager.tsx', 'utf8');

const target = code.substring(
  code.indexOf('            <label className="block">\\n              <span className="text-sm font-semibold text-stone-900 mb-1.5 block">Primary Image URL</span>'),
  code.indexOf('          </div>\\n             \\n          <div className="flex justify-end gap-3 pt-6 border-t border-stone-100">')
);

const newForm = `            <div className="md:col-span-2">
              <ImageUpload
                label="Primary Cover Image"
                value={editingRoom.imageUrl || ''}
                onChange={url => setEditingRoom({ ...editingRoom, imageUrl: url })}
                folder="conferences"
              />
            </div>

            <div className="md:col-span-2 mt-4">
              <GalleryUpload
                label="Gallery Images"
                value={editingRoom.galleryUrls || []}
                onChange={urls => setEditingRoom({ ...editingRoom, galleryUrls: urls })}
                folder="conferences"
              />
            </div>
            
            <div className="md:col-span-2 border-t border-stone-100 pt-6 mt-2">
              <label className="block">
                <span className="text-sm font-semibold text-stone-900 mb-1.5 block">Amenities (Comma separated)</span>
                <input type="text" value={(editingRoom.amenities || []).join(', ')} onChange={e => setEditingRoom({ ...editingRoom, amenities: e.target.value.split(',').map(a => a.trim()).filter(Boolean) })} className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" placeholder="Projector, Whiteboard, AC..." />
              </label>
            </div>
            
            <div className="md:col-span-2">
               <label className="block">
                <span className="text-sm font-semibold text-stone-900 mb-1.5 block">Pricing & Packages Summary</span>
                <input type="text" value={editingRoom.pricing || ''} onChange={e => setEditingRoom({ ...editingRoom, pricing: e.target.value })} className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" placeholder="e.g. From $500 to $1,200 per day" />
              </label>
            </div>
            
            <div className="md:col-span-2">
              <label className="block">
                <span className="text-sm font-semibold text-stone-900 mb-1.5 block">Guidelines & Offers (One per line)</span>
                <textarea rows={4} value={(editingRoom.policies || []).join('\\n')} onChange={e => setEditingRoom({ ...editingRoom, policies: e.target.value.split('\\n').filter(p => p.trim() !== '') })} className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm" placeholder="Breakfast and Coffee/Tea packages available on request\\n50% deposit required to secure booking" />
              </label>
            </div>
`;

code = code.substring(0, code.indexOf('            <label className="block">\\n              <span className="text-sm font-semibold text-stone-900 mb-1.5 block">Primary Image URL</span>')) + newForm + code.substring(code.indexOf('          </div>\\n             \\n          <div className="flex justify-end gap-3 pt-6 border-t border-stone-100">'));

fs.writeFileSync('src/components/ConferenceManager.tsx', code);
