import React, { useState, useRef } from "react";
import {
  Upload,
  Link as LinkIcon,
  Image as ImageIcon,
  Loader2,
  Trash2,
  RefreshCw,
  X,
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
  const [mode, setMode] = useState<"url" | "upload">("upload");
  const [isChanging, setIsChanging] = useState(false);
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
      setIsChanging(false);
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
      {/* Header bar */}
      <div className="flex items-center justify-between gap-3 mb-2.5">
        <div>
          <div className="flex items-center gap-2">
            <label className="block text-sm font-bold text-stone-800 tracking-wide">
              {label}
            </label>
            {tooltip && <Tooltip text={tooltip} />}
          </div>
          {hint && (
            <div className="text-xs text-stone-500 mt-0.5 leading-relaxed">
              {hint}
            </div>
          )}
        </div>

        {/* Compact, non-wide mode switcher when adding or replacing photo */}
        {(!value || isChanging) && (
          <div className="inline-flex items-center bg-stone-100 p-1 rounded-lg border border-stone-200 shrink-0">
            <button
              type="button"
              onClick={() => setMode("upload")}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition ${
                mode === "upload"
                  ? "bg-white text-stone-900 shadow-xs"
                  : "text-stone-600 hover:text-stone-900"
              }`}
            >
              <Upload className="h-3.5 w-3.5" />
              <span>Upload</span>
            </button>
            <button
              type="button"
              onClick={() => setMode("url")}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition ${
                mode === "url"
                  ? "bg-white text-stone-900 shadow-xs"
                  : "text-stone-600 hover:text-stone-900"
              }`}
            >
              <LinkIcon className="h-3.5 w-3.5" />
              <span>Web Link</span>
            </button>
            {value && isChanging && (
              <button
                type="button"
                onClick={() => setIsChanging(false)}
                className="px-2 py-1 text-xs text-stone-500 hover:text-stone-800 ml-1 rounded"
                title="Cancel replacement"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Existing Image Preview Card */}
      {value && !isChanging && (
        <div className="relative rounded-xl overflow-hidden aspect-video bg-stone-100 border border-stone-200 shadow-xs group">
          <SmartImage
            src={value}
            alt="Preview"
            className="w-full h-full object-cover"
          />

          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30 opacity-0 group-hover:opacity-100 transition-opacity" />

          {/* Badge */}
          <div className="absolute top-2.5 left-2.5">
            <span className="px-2.5 py-1 bg-stone-900/80 backdrop-blur-xs text-white text-[11px] font-semibold rounded-md shadow-xs">
              Cover Active
            </span>
          </div>

          {/* Action buttons on top-right */}
          <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setIsChanging(true)}
              className="px-2.5 py-1.5 bg-stone-900/85 hover:bg-stone-900 text-white rounded-lg transition-colors backdrop-blur-xs shadow-xs text-xs flex items-center gap-1.5 font-medium cursor-pointer"
              title="Replace this photo"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Replace
            </button>
            <button
              type="button"
              onClick={() => onChange("")}
              className="p-1.5 bg-stone-900/85 hover:bg-red-600 text-white rounded-lg transition-colors backdrop-blur-xs shadow-xs text-xs flex items-center justify-center cursor-pointer"
              title="Remove photo"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Upload / URL Input Interface (when empty or replacing) */}
      {(!value || isChanging) && (
        <div className="mt-2">
          {mode === "url" ? (
            <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 space-y-2">
              <div className="flex gap-2">
                <input
                  type="url"
                  value={value}
                  onChange={(e) => {
                    const { url } = resolveShareUrl(e.target.value);
                    onChange(url);
                  }}
                  className="flex-1 rounded-lg border-stone-200 border bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-stone-900 focus:border-stone-900 outline-none transition"
                  placeholder="Paste direct URL or Drive/OneDrive/Dropbox link..."
                />
                {value && (
                  <button
                    type="button"
                    onClick={() => setIsChanging(false)}
                    className="px-3 py-2 bg-stone-900 text-white text-xs font-semibold rounded-lg hover:bg-stone-800 transition"
                  >
                    Done
                  </button>
                )}
              </div>

              {shareNote && (
                <p className="text-xs text-emerald-700 font-medium">{shareNote}</p>
              )}

              <p className="text-[11px] text-stone-500">
                Direct links and share links from OneDrive, Google Drive and Dropbox are converted automatically.
              </p>
            </div>
          ) : (
            <div
              className={`w-full rounded-xl border-2 border-dashed ${
                isDraggingFile
                  ? "border-amber-500 bg-amber-50/30"
                  : "border-stone-300 bg-stone-50/50 hover:border-amber-500 hover:bg-amber-50/10"
              } p-6 flex flex-col items-center justify-center text-center transition cursor-pointer group`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={handleDragOverFile}
              onDragLeave={handleDragLeaveFile}
              onDrop={handleDropFile}
            >
              {isUploading ? (
                <div className="flex flex-col items-center justify-center space-y-2 w-full py-2">
                  <Loader2 className="h-7 w-7 text-amber-600 animate-spin" />
                  <p className="text-xs text-stone-700 font-semibold">
                    Uploading{progress > 0 ? ` — ${progress}%` : "…"}
                  </p>
                  {progress > 0 && (
                    <div className="w-36 h-1.5 bg-stone-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-stone-900 transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div className="w-10 h-10 rounded-full bg-stone-200/70 group-hover:bg-amber-100 text-stone-500 group-hover:text-amber-800 flex items-center justify-center mb-2 transition-transform group-hover:scale-105">
                    <ImageIcon className="h-5 w-5" />
                  </div>
                  <p className="text-xs font-bold text-stone-800 mb-0.5">
                    {isDraggingFile ? "Drop image here" : "Click to select or drag photo here"}
                  </p>
                  <p className="text-[11px] text-stone-400">
                    JPG, PNG, WebP, AVIF or GIF · up to {formatBytes(MAX_IMAGE_BYTES)}
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
      )}
    </div>
  );
}
