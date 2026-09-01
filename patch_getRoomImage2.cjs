const fs = require('fs');
let code = fs.readFileSync('src/lib/images.ts', 'utf8');

const oldFunc = `export function getRoomImage(room: { imageUrl?: string; galleryUrls?: unknown },
  hotel?: { name?: string; imageUrl?: string; galleryUrls?: unknown } | null): string {
  const direct = normalizeImageUrl(room?.imageUrl);
  if (direct) return direct;
  
  if (Array.isArray(room?.galleryUrls) && room.galleryUrls.length > 0) {
    const galDirect = normalizeImageUrl(room.galleryUrls[0] as string);
    if (galDirect) return galDirect;
  }

  if (hotel) {
    const images = getHotelImages(hotel);
    // Prefer a gallery shot over the hero image so a room card does not simply
    // repeat the picture shown at the top of the page.
    return images[1] ?? images[0];
  }

  return PLACEHOLDER_IMAGE;
}`;

const newFunc = `export function getRoomImage(room: { imageUrl?: string; galleryUrls?: unknown },
  hotel?: { name?: string; imageUrl?: string; galleryUrls?: unknown } | null): string {
  const direct = normalizeImageUrl(room?.imageUrl);
  if (direct) return direct;
  
  if (Array.isArray(room?.galleryUrls) && room.galleryUrls.length > 0) {
    const galDirect = normalizeImageUrl(room.galleryUrls[0] as string);
    if (galDirect) return galDirect;
  }

  return PLACEHOLDER_IMAGE;
}`;

code = code.replace(oldFunc, newFunc);
fs.writeFileSync('src/lib/images.ts', code);
