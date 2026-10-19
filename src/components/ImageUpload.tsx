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

  const dragCounter = useRef(0);
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  const handleDragEnterFile = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current += 1;
    setIsDraggingFile(true);
  };

  const handleDragOverFile = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    if (!isDraggingFile) setIsDraggingFile(true);
  };

  const handleDragLeaveFile = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsDraggingFile(false);
    }
  };

  const handleDropFile = async (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current = 0;
    setIsDraggingFile(false);

    // 1. Check if an existing photo URL was dragged and dropped (e.g. from Room Gallery)
    const customUrl = e.dataTransfer.getData("application/x-travelmalawi-photo-url");
    const textUrl = e.dataTransfer.getData("text/plain");
    const candidateUrl = (customUrl || textUrl || "").trim();

    if (candidateUrl && (candidateUrl.startsWith("http://") || candidateUrl.startsWith("https://") || candidateUrl.startsWith("/") || candidateUrl.startsWith("data:"))) {
      onChange(candidateUrl);
      setIsChanging(false);
      toast.success("Set as cover photo.");
      return;
    }

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
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2 min-w-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <label className="tm-label mb-0">
              {label}
            </label>
            {tooltip && <Tooltip text={tooltip} />}
          </div>
          {hint && (
            <div className="text-xs text-stone-500 mt-0.5">
              {hint}
            </div>
          )}
        </div>

        {/* Compact, non-wide mode switcher when adding or replacing photo */}
        {(!value || isChanging) && (
          <div className="inline-flex items-center bg-stone-100 p-0.5 rounded-lg shrink-0">
            <button
              type="button"
              onClick={() => setMode("upload")}
              className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors ${
                mode === "upload"
                  ? "bg-white text-stone-900 shadow-sm"
                  : "text-stone-600 hover:text-stone-900"
              }`}
            >
              <Upload className="h-3.5 w-3.5" />
              <span>Upload</span>
            </button>
            <button
              type="button"
              onClick={() => setMode("url")}
              className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors ${
                mode === "url"
                  ? "bg-white text-stone-900 shadow-sm"
                  : "text-stone-600 hover:text-stone-900"
              }`}
            >
              <LinkIcon className="h-3.5 w-3.5" />
              <span>Link</span>
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
        <div 
          onDragEnter={handleDragEnterFile}
          onDragOver={handleDragOverFile}
          onDragLeave={handleDragLeaveFile}
          onDrop={handleDropFile}
          className="relative rounded-lg overflow-hidden aspect-video bg-stone-100 border border-stone-200 group"
        >
          <SmartImage
            src={value}
            alt="Preview"
            className="w-full h-full object-cover pointer-events-none"
          />

          <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

          {/* Active Drag Overlay when dragging a photo from gallery over an existing cover */}
          {isDraggingFile && (
            <div className="absolute inset-0 bg-amber-50/95 flex flex-col items-center justify-center text-amber-900 border-2 border-dashed border-amber-400 z-30 p-4 pointer-events-none">
              <Upload className="w-7 h-7 text-amber-700 mb-1.5" />
              <p className="text-xs font-semibold">Drop to replace the cover photo</p>
            </div>
          )}

          {/* Badge */}
          <div className="absolute top-2.5 left-2.5 pointer-events-none">
            <span className="px-2 py-0.5 bg-white/95 text-stone-800 text-xs font-medium rounded-md">
              Cover
            </span>
          </div>

          {/* Action buttons on top-right */}
          <div className="absolute top-2.5 right-2.5 flex flex-wrap justify-end items-center gap-1.5 z-20">
            <button
              type="button"
              onClick={() => setIsChanging(true)}
              className="px-2.5 py-1.5 bg-stone-900/85 hover:bg-stone-900 text-white rounded-lg transition-colors text-xs flex items-center gap-1.5 font-medium cursor-pointer"
              title="Replace this photo"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Replace
            </button>
            <button
              type="button"
              onClick={() => onChange("")}
              className="p-1.5 bg-stone-900/85 hover:bg-red-600 text-white rounded-lg transition-colors text-xs flex items-center justify-center cursor-pointer"
              title="Remove photo"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Upload / URL Input Interface (when empty or replacing) */}
      {(!value || isChanging) && (
        mode === "url" ? (
          <div 
            onDragEnter={handleDragEnterFile}
            onDragOver={handleDragOverFile}
            onDragLeave={handleDragLeaveFile}
            onDrop={handleDropFile}
            className={`p-3 rounded-lg border transition-colors ${
              isDraggingFile ? 'border-amber-500 bg-amber-50' : 'border-stone-200'
            } space-y-2 min-w-0`}
          >
            <div className="flex gap-2 min-w-0">
              <input
                type="url"
                value={value}
                onChange={(e) => {
                  const { url } = resolveShareUrl(e.target.value);
                  onChange(url);
                }}
                className="tm-input flex-1 min-w-0"
                placeholder="Paste a photo link (Drive, OneDrive, Dropbox…)"
              />
              {value && (
                <button
                  type="button"
                  onClick={() => setIsChanging(false)}
                  className="tm-btn tm-btn-secondary shrink-0"
                >
                  Done
                </button>
              )}
            </div>

            {shareNote && (
              <p className="text-xs text-emerald-700 font-medium">{shareNote}</p>
            )}

            <p className="text-xs text-stone-500">
              Share links from OneDrive, Google Drive and Dropbox work too.
            </p>
          </div>
        ) : (
          <div
            className={`w-full aspect-video rounded-lg border-2 border-dashed ${
              isDraggingFile
                ? "border-amber-500 bg-amber-50"
                : "border-stone-300 hover:border-amber-500"
            } p-4 flex flex-col items-center justify-center text-center transition-colors cursor-pointer select-none`}
            onClick={() => fileInputRef.current?.click()}
            onDragEnter={handleDragEnterFile}
            onDragOver={handleDragOverFile}
            onDragLeave={handleDragLeaveFile}
            onDrop={handleDropFile}
          >
            {isUploading ? (
              <div className="flex flex-col items-center justify-center space-y-2 w-full py-2 pointer-events-none">
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
            ) : isDraggingFile ? (
              <div className="flex flex-col items-center justify-center pointer-events-none">
                <Upload className="w-7 h-7 text-amber-700 mb-1.5" />
                <p className="text-xs font-semibold text-amber-900">Drop to set as cover</p>
              </div>
            ) : (
              <div className="pointer-events-none flex flex-col items-center">
                <ImageIcon className="h-5 w-5 text-stone-400 mb-1.5" />
                <p className="text-xs font-medium text-stone-700">
                  Drop a photo here or click to choose
                </p>
              </div>
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
        )
      )}
    </div>
  );
}
