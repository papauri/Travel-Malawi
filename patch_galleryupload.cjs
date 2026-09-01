const fs = require('fs');
let code = fs.readFileSync('src/components/GalleryUpload.tsx', 'utf8');

code = code.replace("GripVertical, Eye } from \"lucide-react\";", "GripVertical, Eye, Info } from \"lucide-react\";\nimport Tooltip from './Tooltip';");

const targetInterface = `interface GalleryUploadProps {
  value: string[];
  onChange: (urls: string[]) => void;
  folder: string;
  label?: string;
  hint?: string;
}`;
const replaceInterface = `interface GalleryUploadProps {
  value: string[];
  onChange: (urls: string[]) => void;
  folder: string;
  label?: string;
  hint?: string;
  tooltip?: string;
}`;
code = code.replace(targetInterface, replaceInterface);

const targetProps = `export default function GalleryUpload({
  value,
  onChange,
  folder,
  label = "Gallery",
  hint,
}: GalleryUploadProps) {`;
const replaceProps = `export default function GalleryUpload({
  value,
  onChange,
  folder,
  label = "Gallery",
  hint,
  tooltip,
}: GalleryUploadProps) {`;
code = code.replace(targetProps, replaceProps);

const targetLabel = `        <label className="block text-sm font-bold text-stone-700 uppercase tracking-wide">{label}</label>
        {hint && (
          <div className="flex items-start gap-2.5 text-sm bg-indigo-50/80 text-indigo-900 p-3.5 rounded-xl mt-2 border border-indigo-100/80 shadow-sm mb-4">
            <Eye className="h-4 w-4 mt-0.5 shrink-0 text-indigo-600" />
            <div className="leading-relaxed">
              <span className="font-semibold text-indigo-800">Guest View:</span> {hint}
            </div>
          </div>
        )}`;
const replaceLabel = `        <div className="flex items-center gap-2 mb-1">
          <label className="block text-sm font-bold text-stone-700 uppercase tracking-wide">{label}</label>
          {tooltip && <Tooltip text={tooltip} />}
        </div>
        {hint && <div className="text-sm text-stone-500 mb-4 leading-relaxed">{hint}</div>}`;
code = code.replace(targetLabel, replaceLabel);

fs.writeFileSync('src/components/GalleryUpload.tsx', code);
