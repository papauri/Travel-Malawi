const fs = require('fs');
let code = fs.readFileSync('src/components/ImageUpload.tsx', 'utf8');

// replace the Eye icon import and add Tooltip
code = code.replace("Eye,\n} from \"lucide-react\";", "Eye,\n  Info\n} from \"lucide-react\";\nimport Tooltip from './Tooltip';");

const targetInterface = `interface ImageUploadProps {
  value: string;
  onChange: (url: string) => void;
  folder: string;
  label?: string;
  hint?: string;
}`;
const replaceInterface = `interface ImageUploadProps {
  value: string;
  onChange: (url: string) => void;
  folder: string;
  label?: string;
  hint?: string;
  tooltip?: string;
}`;
code = code.replace(targetInterface, replaceInterface);

const targetProps = `export default function ImageUpload({
  value,
  onChange,
  folder,
  label = "Image",
  hint,
}: ImageUploadProps) {`;
const replaceProps = `export default function ImageUpload({
  value,
  onChange,
  folder,
  label = "Image",
  hint,
  tooltip,
}: ImageUploadProps) {`;
code = code.replace(targetProps, replaceProps);

const targetLabel = `        <label className="block text-sm font-bold text-stone-700 uppercase tracking-wide">
          {label}
        </label>
        {hint && (
          <div className="flex items-start gap-2.5 text-sm bg-indigo-50/80 text-indigo-900 p-3.5 rounded-xl mt-2 border border-indigo-100/80 shadow-sm">
            <Eye className="h-4 w-4 mt-0.5 shrink-0 text-indigo-600" />
            <div className="leading-relaxed">
              <span className="font-semibold text-indigo-800">Guest View:</span> {hint}
            </div>
          </div>
        )}`;
const replaceLabel = `        <div className="flex items-center gap-2">
          <label className="block text-sm font-bold text-stone-700 uppercase tracking-wide">
            {label}
          </label>
          {tooltip && <Tooltip text={tooltip} />}
        </div>
        {hint && (
          <div className="text-sm text-stone-500 mt-1 leading-relaxed">
            {hint}
          </div>
        )}`;
code = code.replace(targetLabel, replaceLabel);

fs.writeFileSync('src/components/ImageUpload.tsx', code);
