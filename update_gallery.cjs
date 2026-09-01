const fs = require('fs');
let code = fs.readFileSync('src/components/GalleryUpload.tsx', 'utf8');
code = code.replace(
  '<div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">\n                <GripVertical className="text-white h-8 w-8" />\n              </div>',
  '<div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex flex-col items-center justify-center p-2 text-center pointer-events-none">\n                <GripVertical className="text-white h-6 w-6 mb-1 opacity-80" />\n                <span className="text-[9px] text-white/90 leading-tight break-all font-mono line-clamp-2" title={url}>{url}</span>\n              </div>'
);
fs.writeFileSync('src/components/GalleryUpload.tsx', code);
