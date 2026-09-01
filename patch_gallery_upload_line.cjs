const fs = require('fs');
let code = fs.readFileSync('src/components/GalleryUpload.tsx', 'utf8');
code = code.replace(
  'export default function GalleryUpload({ value = [], onChange, label = "Gallery Images", hint, folder = "gallery"   tooltip,}: Props) {',
  'export default function GalleryUpload({ value = [], onChange, label = "Gallery", hint, folder = "gallery", tooltip }: Props) {'
);
fs.writeFileSync('src/components/GalleryUpload.tsx', code);
