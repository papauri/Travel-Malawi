const fs = require("fs");
let code = fs.readFileSync("src/pages/ManageHotel.tsx", "utf-8");

// Add import
if (!code.includes("import GalleryUpload")) {
  code = code.replace(
    "import ImageUpload from '../components/ImageUpload';",
    "import ImageUpload from '../components/ImageUpload';\nimport GalleryUpload from '../components/GalleryUpload';"
  );
}

// Remove the string handling for galleryUrls before saving
const saveHotelSearch = `let galleryUrls = editHotelData.galleryUrls;
      if (typeof galleryUrls === 'string') {
        galleryUrls = (galleryUrls as string).split(',').map(s => s.trim()).filter(Boolean);
      }`;
code = code.replace(saveHotelSearch, "");

// Replace the input with GalleryUpload
const inputSearch = `<label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Gallery URLs (comma separated)</label>
                  <input type="text" value={Array.isArray(editHotelData.galleryUrls) ? editHotelData.galleryUrls.join(', ') : editHotelData.galleryUrls || ''} onChange={e => setEditHotelData({...editHotelData, galleryUrls: e.target.value as any})} className="w-full bg-stone-50 border border-stone-200 p-3 rounded-xl outline-none focus:border-stone-900 transition" placeholder="https://..., https://..." />`;

const inputReplace = `<GalleryUpload 
                    value={editHotelData.galleryUrls || []} 
                    onChange={(urls) => setEditHotelData({ ...editHotelData, galleryUrls: urls })} 
                    label="Hotel Gallery"
                    folder="gallery"
                  />`;

code = code.replace(inputSearch, inputReplace);

fs.writeFileSync("src/pages/ManageHotel.tsx", code, "utf-8");

