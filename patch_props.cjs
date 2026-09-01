const fs = require('fs');

let imgCode = fs.readFileSync('src/components/ImageUpload.tsx', 'utf8');
imgCode = imgCode.replace(
  `interface Props {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  hint?: React.ReactNode;
  folder?: string;
}`,
  `interface Props {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  hint?: React.ReactNode;
  folder?: string;
  tooltip?: string;
}`
);
imgCode = imgCode.replace(
  `export default function ImageUpload({
  value,
  onChange,
  label,
  hint,
  folder = "uploads",
}: Props) {`,
  `export default function ImageUpload({
  value,
  onChange,
  label,
  hint,
  folder = "uploads",
  tooltip,
}: Props) {`
);
fs.writeFileSync('src/components/ImageUpload.tsx', imgCode);

let galCode = fs.readFileSync('src/components/GalleryUpload.tsx', 'utf8');
galCode = galCode.replace(
  `interface Props {
  value: string[];
  onChange: (urls: string[]) => void;
  label?: string;
  hint?: React.ReactNode;
  folder?: string;
}`,
  `interface Props {
  value: string[];
  onChange: (urls: string[]) => void;
  label?: string;
  hint?: React.ReactNode;
  folder?: string;
  tooltip?: string;
}`
);
galCode = galCode.replace(
  `export default function GalleryUpload({
  value,
  onChange,
  label,
  hint,
  folder = "uploads",
}: Props) {`,
  `export default function GalleryUpload({
  value,
  onChange,
  label,
  hint,
  folder = "uploads",
  tooltip,
}: Props) {`
);
fs.writeFileSync('src/components/GalleryUpload.tsx', galCode);
