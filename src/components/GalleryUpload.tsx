import React, { useState, useRef } from "react";
import { Upload, Link as LinkIcon, Image as ImageIcon, Loader2, X, GripVertical, Eye, Plus, Star, ChevronLeft, ChevronRight, Trash2, CheckSquare, Square } from "lucide-react";
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
  compact?: boolean;
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
  compact = false,
}: Props) {
  const [mode, setMode] = useState<"url" | "upload">("upload");
  const [urlInput, setUrlInput] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set());
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
    // A second batch dropped mid-upload would append to the same stale list
    // and drop the first batch's photos.
    if (isUploading) {
      toast.error("Please wait for the current upload to finish.");
      return;
    }
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
    if (idx < 0 || idx >= value.length) return;
    const newUrls = [...value];
    const removedUrl = newUrls.splice(idx, 1)[0];
    onChange(newUrls);
    toast.success("Photo removed. Save to apply.", {
      icon: "🗑️",
      duration: 5000,
    });
  };

  const toggleSelectUrl = (url: string) => {
    setSelectedUrls(prev => {
      const next = new Set(prev);
      if (next.has(url)) {
        next.delete(url);
      } else {
        next.add(url);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedUrls.size === value.length) {
      setSelectedUrls(new Set());
    } else {
      setSelectedUrls(new Set(value));
    }
  };

  const handleDeleteSelected = () => {
    if (selectedUrls.size === 0) return;
    const count = selectedUrls.size;
    const newUrls = value.filter(u => !selectedUrls.has(u));
    onChange(newUrls);
    setSelectedUrls(new Set());
    setIsSelectMode(false);
    toast.success(`Removed ${count} photo${count > 1 ? 's' : ''}. Save to apply.`, {
      icon: "🗑️",
    });
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
    e.dataTransfer.effectAllowed = "copyMove";
    const url = value[idx] || "";
    e.dataTransfer.setData("text/plain", url);
    e.dataTransfer.setData("application/x-travelmalawi-photo-url", url);
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
        <div className="absolute inset-0 bg-amber-50/95 rounded-xl z-30 flex flex-col items-center justify-center text-amber-900 border-2 border-dashed border-amber-400 pointer-events-none p-6">
          <Upload className="h-8 w-8 text-amber-700 mb-2" />
          <p className="text-sm font-semibold">Drop photos to upload</p>
        </div>
      )}

      {/* Header Bar */}
      <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 min-w-0 ${compact ? 'mb-2' : 'mb-3'}`}>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <label className={`tm-label mb-0 ${compact ? 'text-xs' : ''}`}>{label}</label>
            {tooltip && <Tooltip text={tooltip} />}
            <span className="tm-tag">
              {value.length} {value.length === 1 ? 'photo' : 'photos'}
            </span>
          </div>
          {hint && <div className={`text-stone-500 ${compact ? 'text-xs mt-0.5' : 'text-xs mt-1'}`}>{hint}</div>}
        </div>

        {/* Upload / link switch */}
        <div className="tm-actions gap-1.5 self-start sm:self-auto shrink-0">
          <div className="inline-flex items-center bg-stone-100 p-0.5 rounded-lg">
            <button
              type="button"
              onClick={() => setMode("upload")}
              className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1 transition-colors ${
                mode === "upload"
                  ? "bg-white text-stone-900 shadow-sm"
                  : "text-stone-600 hover:text-stone-900"
              }`}
            >
              <Upload className="h-3 w-3" />
              <span>Upload</span>
            </button>
            <button
              type="button"
              onClick={() => setMode("url")}
              className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1 transition-colors ${
                mode === "url"
                  ? "bg-white text-stone-900 shadow-sm"
                  : "text-stone-600 hover:text-stone-900"
              }`}
            >
              <LinkIcon className="h-3 w-3" />
              <span>Link</span>
            </button>
          </div>

          {value.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setIsSelectMode(!isSelectMode);
                setSelectedUrls(new Set());
              }}
              className={`tm-btn tm-btn-sm ${isSelectMode ? "tm-btn-secondary" : "tm-btn-quiet"}`}
              title={isSelectMode ? "Stop selecting" : "Select several photos to delete"}
            >
              {!isSelectMode && <Trash2 className="h-3 w-3 text-red-600" />}
              <span>{isSelectMode ? "Cancel" : "Select to delete"}</span>
            </button>
          )}
        </div>
      </div>

      {/* Select & Delete Bulk Action Bar */}
      {isSelectMode && value.length > 0 && (
        <div className="mb-3 tm-actions justify-between rounded-lg bg-red-50 px-3 py-2">
          <div className="tm-actions">
            <button
              type="button"
              onClick={handleSelectAll}
              className="tm-btn tm-btn-secondary tm-btn-sm"
            >
              {selectedUrls.size === value.length ? (
                <>
                  <Square className="w-3.5 h-3.5 text-stone-500" />
                  <span>Deselect all</span>
                </>
              ) : (
                <>
                  <CheckSquare className="w-3.5 h-3.5 text-stone-500" />
                  <span>Select all ({value.length})</span>
                </>
              )}
            </button>
            <span className="text-xs font-medium text-red-800">
              {selectedUrls.size} selected
            </span>
          </div>

          <button
            type="button"
            onClick={handleDeleteSelected}
            disabled={selectedUrls.size === 0}
            className="tm-btn tm-btn-danger tm-btn-sm"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete ({selectedUrls.size})</span>
          </button>
        </div>
      )}

      {/* URL Input Bar (visible when mode === 'url') */}
      {mode === "url" && (
        <div className="mb-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 min-w-0">
          <div className="relative flex-1 min-w-0">
            <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
            <input
              type="url"
              value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && (e.preventDefault(), handleAddUrl())}
              className="tm-input pl-9"
              placeholder="Paste a photo link (Google Drive, OneDrive, Dropbox…)"
            />
          </div>
          <button
            type="button"
            onClick={handleAddUrl}
            className="tm-btn tm-btn-secondary shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add photo</span>
          </button>
        </div>
      )}

      {/* Uploading Status Banner */}
      {isUploading && (
        <div className="mb-3 flex items-center gap-2 text-xs text-amber-900">
          <Loader2 className="h-4 w-4 text-amber-700 animate-spin shrink-0" />
          <span className="min-w-0 break-words">
            {uploadStatus || "Uploading photos…"}
          </span>
        </div>
      )}

      {/* Gallery Grid */}
      {value.length === 0 ? (
        compact ? (
          /* Compact Empty State */
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border border-dashed border-stone-300 hover:border-amber-400 rounded-lg p-3 flex items-center justify-between gap-2.5 transition-colors cursor-pointer min-w-0"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <ImageIcon className="h-4 w-4 text-stone-400 shrink-0" />
              <p className="text-xs text-stone-600 truncate">No photos yet</p>
            </div>
            <span className="tm-btn tm-btn-secondary tm-btn-sm pointer-events-none shrink-0">
              <Upload className="h-3 w-3" />
              <span>Add photos</span>
            </span>
          </div>
        ) : (
          /* Standard Empty State */
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-stone-300 hover:border-stone-400 rounded-xl p-6 sm:p-8 flex flex-col items-center justify-center text-center transition-colors cursor-pointer"
          >
            <ImageIcon className="h-6 w-6 text-stone-400 mb-2" />
            <p className="text-sm text-stone-600 mb-3">Drop photos here or choose them from your device.</p>
            <span className="tm-btn tm-btn-secondary tm-btn-sm pointer-events-none">
              <Upload className="h-3.5 w-3.5" />
              <span>Choose photos</span>
            </span>
          </div>
        )
      ) : (
        /* Populated Grid with Integrated Upload Tile */
        <div className={compact ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 max-h-60 overflow-y-auto pr-1" : "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3"}>
          {value.map((url, idx) => {
            const isSelected = selectedUrls.has(url);
            return (
              <div
                key={`gallery-${idx}`}
                draggable={!isSelectMode}
                onDragStart={(e) => handleDragStart(e, idx)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => handleDragOver(e, idx)}
                onClick={() => {
                  if (isSelectMode) toggleSelectUrl(url);
                }}
                className={`relative aspect-video rounded-lg overflow-hidden group ${isSelectMode ? 'cursor-pointer ring-2' : 'cursor-move'} ${isSelected ? 'ring-red-600 bg-red-50' : 'ring-transparent'} bg-stone-100 border border-stone-200 hover:border-stone-300 transition-colors select-none`}
              >
                <SmartImage
                  src={url}
                  alt={`Gallery ${idx + 1}`}
                  className="w-full h-full object-cover pointer-events-none"
                />

                {/* Hover scrim so the overlay buttons stay readable */}
                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

                {/* Top-Left: Position / Cover Badge OR Selection Checkbox */}
                <div className="absolute top-2 left-2 z-10">
                  {isSelectMode ? (
                    <div className={`p-1 rounded-md ${isSelected ? 'bg-red-600 text-white' : 'bg-stone-900/80 text-white/80'}`}>
                      {isSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                    </div>
                  ) : showCoverBadge && idx === 0 ? (
                    <span className="px-2 py-0.5 bg-white/95 text-amber-900 text-xs font-medium rounded-md flex items-center gap-1 pointer-events-none">
                      Cover
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.5 bg-stone-900/70 text-white text-xs tabular-nums rounded-md pointer-events-none">
                      #{idx + 1}
                    </span>
                  )}
                </div>

                {/* Reorder Arrows (◀ and ▶) for touch and quick sorting */}
                {!isSelectMode && (
                  <div className="absolute bottom-2 left-2 flex items-center gap-1 z-10 opacity-90 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                    {idx > 0 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          moveImage(idx, idx - 1);
                        }}
                        className="p-1 bg-stone-900/80 hover:bg-stone-900 text-white rounded-md transition-colors cursor-pointer"
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
                        className="p-1 bg-stone-900/80 hover:bg-stone-900 text-white rounded-md transition-colors cursor-pointer"
                        title="Move forward"
                      >
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                )}

                {/* Action Buttons: ALWAYS VISIBLE ON MOBILE / TOUCH (opacity-100 on small screens, hover on desktop) */}
                {!isSelectMode && (
                  <div className="absolute top-2 right-2 flex items-center gap-1.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity z-10">
                    {onSetCover && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSetCover(url, idx);
                        }}
                        className="p-1.5 bg-stone-900/80 hover:bg-stone-900 text-amber-300 rounded-lg transition-colors cursor-pointer"
                        title="Make this the cover photo"
                        aria-label="Set as cover"
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
                      className="p-1.5 bg-stone-900/80 hover:bg-stone-900 text-white rounded-lg transition-colors cursor-pointer"
                      title="View full photo"
                      aria-label="View photo"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeImage(idx);
                      }}
                      className="p-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors cursor-pointer flex items-center justify-center"
                      title="Delete photo"
                      aria-label="Delete photo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {/* Integrated "Add Photos" Tile inside the Grid */}
          {!isSelectMode && (
            <div
              onClick={() => fileInputRef.current?.click()}
              className={`relative aspect-video rounded-lg ${compact ? 'p-2' : 'p-3'} border-2 border-dashed border-stone-300 hover:border-amber-500 transition-colors flex flex-col items-center justify-center text-center cursor-pointer text-stone-600 hover:text-amber-900`}
              title="Add more photos"
            >
              <Plus className={compact ? "w-4 h-4 mb-1" : "w-5 h-5 mb-1"} />
              <p className="text-xs font-medium">Add photos</p>
            </div>
          )}
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

      {/* Lightbox Modal with Delete support */}
      {lightboxIdx !== null && (
        <Lightbox
          images={value}
          initialIndex={lightboxIdx}
          onClose={() => setLightboxIdx(null)}
          onDelete={(delIdx) => removeImage(delIdx)}
        />
      )}
    </div>
  );
}

