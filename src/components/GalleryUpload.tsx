import React, { useState, useRef } from "react";
import { Upload, Link as LinkIcon, Image as ImageIcon, Loader2, X, GripVertical, Eye, Plus, Star, ChevronLeft, ChevronRight } from "lucide-react";
import Tooltip from './Tooltip';
import Lightbox from './Lightbox';
import { uploadImage, uploadErrorMessage, validateImage, IMAGE_ACCEPT_ATTR } from "../lib/uploadImage";
import { resolveShareUrl, SHARE_PROVIDER_NAMES } from "../lib/shareLinks";
import toast from "react-hot-toast";
import SmartImage from "./SmartImage";

interface Props {
  value: string[];
  onChange: (urls: string[]) => void;
  label?: string;
  hint?: React.ReactNode;
  folder?: string;
  tooltip?: string;
  showCoverBadge?: boolean;
  onSetCover?: (url: string, index: number) => void;
}

export default function GalleryUpload({
  value = [],
  onChange,
  label = "Gallery",
  hint,
  folder = "gallery",
  tooltip,
  showCoverBadge = false,
  onSetCover,
}: Props) {
  const [mode, setMode] = useState<"url" | "upload">("upload");
  const [urlInput, setUrlInput] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Drag and Drop state
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
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
    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;
    
    await uploadAll(files);
  };

  /**
   * Uploads a batch, keeping whatever succeeded. A single bad file in a
   * selection of ten used to abandon the other nine.
   */
  const uploadAll = async (files: FileList) => {
    const chosen = Array.from(files);
    const rejected: string[] = [];
    const accepted = chosen.filter(file => {
      const problem = validateImage(file);
      if (problem) rejected.push(`${file.name}: ${problem}`);
      return !problem;
    });

    for (const message of rejected.slice(0, 3)) toast.error(message, { duration: 6000 });
    if (accepted.length === 0) return;

    setIsUploading(true);
    const uploaded: string[] = [];
    let failed = 0;

    for (const [index, file] of accepted.entries()) {
      setUploadStatus(`Uploading ${index + 1} of ${accepted.length}…`);
      try {
        uploaded.push(await uploadImage(file, folder));
      } catch (error) {
        failed++;
        console.error("Error uploading image:", error);
        // Reported once rather than once per file in a failing batch.
        if (failed === 1) toast.error(uploadErrorMessage(error), { duration: 7000 });
      }
    }

    if (uploaded.length > 0) {
      onChange([...value, ...uploaded]);
      toast.success(`Added ${uploaded.length} image${uploaded.length === 1 ? '' : 's'}.`);
    }

    setIsUploading(false);
    setUploadStatus("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    await uploadAll(files);
  };

  const handleAddUrl = () => {
    const entered = urlInput.trim();
    if (!entered) return;
    // A OneDrive, Drive or Dropbox share link points at a viewer page, so it is
    // converted to its direct form before being stored.
    const { url, provider } = resolveShareUrl(entered);
    if (value.includes(url)) {
      toast.error("That image is already in the gallery.");
      return;
    }
    onChange([...value, url]);
    if (provider) toast.success(`Added from ${SHARE_PROVIDER_NAMES[provider]}.`);
    setUrlInput("");
  };

  const removeImage = (idx: number) => {
    const newUrls = [...value];
    newUrls.splice(idx, 1);
    onChange(newUrls);
  };

  const moveImage = (from: number, to: number) => {
    if (to < 0 || to >= value.length) return;
    const newUrls = [...value];
    const item = newUrls.splice(from, 1)[0];
    newUrls.splice(to, 0, item);
    onChange(newUrls);
  };

  const handleDragStart = (e: React.DragEvent, idx: number) => {
    setDraggedIdx(idx);
    e.dataTransfer.effectAllowed = "move";
    setTimeout(() => {
      if (e.target instanceof HTMLElement) {
        e.target.classList.add("opacity-50");
      }
    }, 0);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setDraggedIdx(null);
    if (e.target instanceof HTMLElement) {
      e.target.classList.remove("opacity-50");
    }
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault(); 
    e.dataTransfer.dropEffect = "move";
    if (draggedIdx === null || draggedIdx === idx) return;

    const newUrls = [...value];
    const draggedUrl = newUrls[draggedIdx];
    newUrls.splice(draggedIdx, 1);
    newUrls.splice(idx, 0, draggedUrl);
    
    onChange(newUrls);
    setDraggedIdx(idx);
  };

  return (
    <div 
      className="w-full relative"
      onDragOver={handleDragOverFile}
      onDragLeave={handleDragLeaveFile}
      onDrop={handleDropFile}
    >
      {/* Dragging Overlay */}
      {isDraggingFile && (
        <div className="absolute inset-0 bg-stone-900/80 backdrop-blur-xs rounded-2xl z-30 flex flex-col items-center justify-center text-white border-2 border-dashed border-amber-400 pointer-events-none p-6 animate-in fade-in duration-200">
          <Upload className="h-10 w-10 text-amber-400 mb-2 animate-bounce" />
          <p className="text-base font-bold">Drop images to upload</p>
          <p className="text-xs text-stone-300">Release files anywhere in this gallery</p>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3.5">
        <div>
          <div className="flex items-center gap-2">
            <label className="block text-sm font-bold text-stone-800 tracking-wide">{label}</label>
            {tooltip && <Tooltip text={tooltip} />}
            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-stone-100 text-stone-600 border border-stone-200">
              {value.length} {value.length === 1 ? 'photo' : 'photos'}
            </span>
          </div>
          {hint && <div className="text-xs text-stone-500 mt-1 leading-relaxed">{hint}</div>}
        </div>

        {/* Compact, non-wide mode toggle buttons */}
        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          <div className="inline-flex items-center bg-stone-100/90 p-1 rounded-lg border border-stone-200">
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
          </div>
        </div>
      </div>

      {/* URL Input Bar (visible when mode === 'url') */}
      {mode === "url" && (
        <div className="mb-4 p-3 bg-stone-50 border border-stone-200/90 rounded-xl flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="relative flex-1">
            <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
            <input
              type="url"
              value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && (e.preventDefault(), handleAddUrl())}
              className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-stone-200 rounded-lg focus:ring-2 focus:ring-stone-900 focus:border-stone-900 outline-none transition"
              placeholder="Paste image link or share URL (Google Drive, OneDrive, Dropbox)..."
            />
          </div>
          <button
            type="button"
            onClick={handleAddUrl}
            className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Photo</span>
          </button>
        </div>
      )}

      {/* Uploading Status Banner */}
      {isUploading && (
        <div className="mb-4 p-3 bg-amber-50/80 border border-amber-200 rounded-xl flex items-center gap-3 animate-pulse">
          <Loader2 className="h-4 w-4 text-amber-700 animate-spin shrink-0" />
          <span className="text-xs font-semibold text-amber-900">
            {uploadStatus || "Uploading images to gallery..."}
          </span>
        </div>
      )}

      {/* Gallery Grid */}
      {value.length === 0 ? (
        /* Empty State */
        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-stone-300 hover:border-stone-400 hover:bg-stone-50/50 rounded-2xl p-8 flex flex-col items-center justify-center text-center transition cursor-pointer group"
        >
          <div className="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center text-stone-400 group-hover:text-stone-700 group-hover:scale-105 transition-all mb-3">
            <ImageIcon className="h-6 w-6" />
          </div>
          <p className="text-sm font-semibold text-stone-800 mb-1">No photos added yet</p>
          <p className="text-xs text-stone-500 mb-4 max-w-sm">
            Drag &amp; drop photos here, or click to browse from your device. High-res photos increase bookings.
          </p>
          <button
            type="button"
            className="px-4 py-2 bg-stone-900 text-white text-xs font-semibold rounded-lg shadow-xs hover:bg-stone-800 transition inline-flex items-center gap-1.5 pointer-events-none"
          >
            <Upload className="h-3.5 w-3.5" />
            <span>Select Photos</span>
          </button>
        </div>
      ) : (
        /* Populated Grid with Integrated Upload Tile */
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
          {value.map((url, idx) => (
            <div
              key={`gallery-${idx}`}
              draggable
              onDragStart={(e) => handleDragStart(e, idx)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => handleDragOver(e, idx)}
              className="relative aspect-video rounded-xl overflow-hidden group cursor-move bg-stone-100 border border-stone-200 hover:border-stone-300 hover:shadow-md transition-all select-none"
            >
              <SmartImage
                src={url}
                alt={`Gallery ${idx + 1}`}
                className="w-full h-full object-cover pointer-events-none"
              />

              {/* Gradient hover overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/40 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

              {/* Position / Cover Badge */}
              <div className="absolute top-2 left-2 pointer-events-none z-10">
                {showCoverBadge && idx === 0 ? (
                  <span className="px-2 py-0.5 bg-amber-500 text-white text-[10px] font-bold rounded-md shadow-xs flex items-center gap-1">
                    ★ Cover
                  </span>
                ) : (
                  <span className="px-1.5 py-0.5 bg-stone-900/70 text-white text-[10px] font-mono rounded-md backdrop-blur-xs">
                    #{idx + 1}
                  </span>
                )}
              </div>

              {/* Hover Drag Grip Indicator */}
              <div className="absolute bottom-2 left-2 bg-stone-900/80 backdrop-blur-xs text-white px-1.5 py-0.5 rounded text-[10px] font-medium opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none flex items-center gap-0.5">
                <GripVertical className="h-3 w-3" />
                <span>Move</span>
              </div>

              {/* Reorder Arrows (◀ and ▶) for touch and quick sorting */}
              <div className="absolute bottom-2 right-2 flex items-center gap-1 z-10 opacity-90 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                {idx > 0 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      moveImage(idx, idx - 1);
                    }}
                    className="p-1 bg-stone-900/80 hover:bg-stone-900 text-white rounded-md transition backdrop-blur-xs cursor-pointer shadow-xs"
                    title="Move backward"
                  >
                    <ChevronLeft className="w-3 h-3" />
                  </button>
                )}
                {idx < value.length - 1 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      moveImage(idx, idx + 1);
                    }}
                    className="p-1 bg-stone-900/80 hover:bg-stone-900 text-white rounded-md transition backdrop-blur-xs cursor-pointer shadow-xs"
                    title="Move forward"
                  >
                    <ChevronRight className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Action Buttons */}
              <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                {onSetCover && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSetCover(url, idx);
                    }}
                    className="p-1.5 bg-stone-900/80 hover:bg-amber-600 text-amber-300 hover:text-white rounded-lg transition-colors backdrop-blur-xs cursor-pointer shadow-xs"
                    title="Promote to Cover Photo"
                  >
                    <Star className="w-3.5 h-3.5 fill-current" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setLightboxIdx(idx);
                  }}
                  className="p-1.5 bg-stone-900/80 hover:bg-stone-900 text-white rounded-lg transition-colors backdrop-blur-xs cursor-pointer shadow-xs"
                  title="View full photo"
                >
                  <Eye className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeImage(idx);
                  }}
                  className="p-1.5 bg-stone-900/80 hover:bg-red-600 text-white rounded-lg transition-colors backdrop-blur-xs cursor-pointer shadow-xs"
                  title="Remove photo"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}

          {/* Integrated "Add Photos" Tile inside the Grid */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="relative aspect-video rounded-xl border-2 border-dashed border-stone-300 hover:border-amber-500 hover:bg-amber-50/20 transition-all flex flex-col items-center justify-center p-3 text-center cursor-pointer group bg-stone-50/60"
            title="Click to add more photos"
          >
            <div className="w-8 h-8 rounded-full bg-stone-200/80 group-hover:bg-amber-100 text-stone-600 group-hover:text-amber-800 flex items-center justify-center mb-1.5 transition-transform group-hover:scale-105">
              <Plus className="w-4 h-4" />
            </div>
            <p className="text-xs font-bold text-stone-700 group-hover:text-amber-900">Add Photos</p>
            <p className="text-[10px] text-stone-400 group-hover:text-stone-500">Drop or browse</p>
          </div>
        </div>
      )}

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={IMAGE_ACCEPT_ATTR}
        multiple
        className="hidden"
        onChange={handleFileChange}
        disabled={isUploading}
      />

      {/* Lightbox Modal */}
      {lightboxIdx !== null && (
        <Lightbox
          images={value}
          initialIndex={lightboxIdx}
          onClose={() => setLightboxIdx(null)}
        />
      )}
    </div>
  );
}

