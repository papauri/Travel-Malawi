import React, { useState, useRef } from "react";
import {
  Upload,
  Link as LinkIcon,
  Image as ImageIcon,
  Loader2,
  Eye,
  Info,
  Trash2,
} from "lucide-react";
import Tooltip from './Tooltip';
import {
  uploadImage,
  uploadErrorMessage,
  validateImage,
  IMAGE_ACCEPT_ATTR,
  MAX_IMAGE_BYTES,
  formatBytes,
} from "../lib/uploadImage";
import { resolveShareUrl, SHARE_PROVIDER_NAMES } from "../lib/shareLinks";
import toast from "react-hot-toast";
import SmartImage from "./SmartImage";

interface Props {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  hint?: React.ReactNode;
  folder?: string;
  tooltip?: string;
}

export default function ImageUpload({
  value,
  onChange,
  label = "Image",
  hint,
  folder = "uploads",
  tooltip,
}: Props) {
  const [mode, setMode] = useState<"url" | "upload">(value ? "url" : "upload");
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  /** Set when the current value came from a recognised share link. */
  const shareNote = (() => {
    const provider = resolveShareUrl(value ?? "").provider;
    if (!provider) return "";
    return `Recognised as a ${SHARE_PROVIDER_NAMES[provider]} link.`;
  })();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isDraggingFile, setIsDraggingFile] = useState(false);

  const handleDragOverFile = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(true);
  };

  const handleDragLeaveFile = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
  };

  const handleDropFile = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    await upload(file);
  };

  /** One path for both the drop zone and the file picker. */
  const upload = async (file: File) => {
    // Checked before the network call, so a wrong file type or an oversized
    // photo is reported immediately rather than after a failed round trip.
    const problem = validateImage(file);
    if (problem) {
      toast.error(problem);
      return;
    }

    setIsUploading(true);
    setProgress(0);
    try {
      const url = await uploadImage(file, folder, { onProgress: setProgress });
      onChange(url);
      setMode("url");
      toast.success("Image uploaded.");
    } catch (error) {
      console.error("Error uploading image:", error);
      toast.error(uploadErrorMessage(error), { duration: 7000 });
    } finally {
      setIsUploading(false);
      setProgress(0);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset first, so picking the same file twice still fires a change event.
    e.target.value = "";
    if (!file) return;
    await upload(file);
  };

  return (
    <div className="w-full">
      <div className="mb-3">
        <div className="flex items-center gap-2">
          <label className="block text-sm font-bold text-stone-700 uppercase tracking-wide">
            {label}
          </label>
          {tooltip && <Tooltip text={tooltip} />}
        </div>
        {hint && (
          <div className="text-sm text-stone-500 mt-1 leading-relaxed">
            {hint}
          </div>
        )}
      </div>

      {value && (
        <div className="mb-4 relative rounded-xl overflow-hidden aspect-video bg-stone-100 border border-stone-200 shadow-sm group">
          <SmartImage
            src={value}
            alt="Preview"
            className="w-full h-full object-cover"
          />
          <div className="absolute top-3 right-3 z-10">
            <button
              type="button"
              onClick={() => onChange("")}
              className="px-2.5 py-1.5 bg-stone-900/80 hover:bg-red-600 text-white rounded-lg transition-colors backdrop-blur-sm shadow text-xs flex items-center gap-1.5 font-medium cursor-pointer"
              title="Remove photo"
            >
              <Trash2 className="w-3.5 h-3.5" /> Remove
            </button>
          </div>
          {mode === "url" && (
            <div className="absolute inset-0 pointer-events-none bg-black/40 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="text-white text-sm font-medium drop-shadow-md bg-black/40 px-3 py-1 rounded-full">
                Current Cover Photo
              </span>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2 mb-3">
        <button
          type="button"
          onClick={() => setMode("url")}
          className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition ${
            mode === "url"
              ? "bg-stone-900 text-white"
              : "bg-stone-100 text-stone-600 hover:bg-stone-200"
          }`}
        >
          <LinkIcon className="h-4 w-4" /> Use URL
        </button>
        <button
          type="button"
          onClick={() => setMode("upload")}
          className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition ${
            mode === "upload"
              ? "bg-stone-900 text-white"
              : "bg-stone-100 text-stone-600 hover:bg-stone-200"
          }`}
        >
          <Upload className="h-4 w-4" /> Upload File
        </button>
      </div>

      {mode === "url" ? (
        <div>
          <input
            type="url"
            value={value}
            onChange={(e) => {
              // Converted on entry, so what is stored is what renders. Pasting
              // a OneDrive or Drive share link otherwise saves a viewer page.
              const { url } = resolveShareUrl(e.target.value);
              onChange(url);
            }}
            className="w-full rounded-xl border-stone-200 border bg-stone-50 p-4 focus:ring-2 focus:ring-stone-900 focus:border-transparent outline-none transition"
            placeholder="e.g. https://example.com/image.jpg"
          />

          {shareNote && (
            <p className="text-xs text-emerald-700 mt-2">{shareNote}</p>
          )}

          <p className="text-xs text-stone-400 mt-2">
            Share links from OneDrive, Google Drive and Dropbox are converted
            automatically. The file must be shared with{" "}
            <span className="font-medium">anyone with the link</span>, or guests
            will see a broken image.
          </p>
        </div>
      ) : (
        <div
          className={`w-full rounded-xl border-2 border-dashed ${isDraggingFile ? "border-stone-900 bg-stone-100" : "border-stone-300 bg-stone-50"} p-6 flex flex-col items-center justify-center text-center hover:border-stone-400 transition cursor-pointer`}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={handleDragOverFile}
          onDragLeave={handleDragLeaveFile}
          onDrop={handleDropFile}
        >
          {isUploading ? (
            <div className="flex flex-col items-center justify-center space-y-3 w-full">
              <Loader2 className="h-8 w-8 text-stone-400 animate-spin" />
              <p className="text-sm text-stone-500 font-medium">
                Uploading{progress > 0 ? ` — ${progress}%` : "…"}
              </p>
              {progress > 0 && (
                <div className="w-40 h-1 bg-stone-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-stone-900 transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              )}
            </div>
          ) : (
            <>
              <ImageIcon
                className={`h-8 w-8 mb-3 transition ${isDraggingFile ? "text-stone-900" : "text-stone-400"}`}
              />
              <p
                className={`text-sm font-medium mb-1 ${isDraggingFile ? "text-stone-900" : "text-stone-600"}`}
              >
                {isDraggingFile
                  ? "Drop image here"
                  : "Click or drag an image to upload"}
              </p>
              <p className="text-xs text-stone-400">
                JPG, PNG, WebP, AVIF or GIF · up to{" "}
                {formatBytes(MAX_IMAGE_BYTES)}
              </p>
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept={IMAGE_ACCEPT_ATTR}
            className="hidden"
            onChange={handleFileChange}
            disabled={isUploading}
          />
        </div>
      )}
    </div>
  );
}
