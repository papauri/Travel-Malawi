const fs = require('fs');
let code = fs.readFileSync('src/pages/ManageHotel.tsx', 'utf8');

const target = `          const hData = { id: docSnap.id, ...docSnap.data() } as Hotel;
          setHotel(hData);
          setEditHotelData(hData);`;

const replacement = `          const hData = { id: docSnap.id, ...docSnap.data() } as Hotel;
          
          // Seed missing images with local fallbacks so the admin sees exactly what guests see and can manage them.
          if (!hData.imageUrl) {
             const local = localImagesForName(hData.name);
             if (local.length > 0) hData.imageUrl = local[0];
          }
          if (!hData.galleryUrls || hData.galleryUrls.length === 0) {
             const local = localImagesForName(hData.name);
             if (local.length > 1) {
                hData.galleryUrls = local.slice(1);
             } else if (local.length > 0) {
                hData.galleryUrls = [local[0]];
             }
          }

          setHotel(hData);
          setEditHotelData(hData);`;

if (!code.includes(target)) {
    console.error("Target not found!");
} else {
    code = code.replace(target, replacement);
    fs.writeFileSync('src/pages/ManageHotel.tsx', code);
    console.log("Patched successfully!");
}
