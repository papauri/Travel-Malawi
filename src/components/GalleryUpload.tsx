import React, { useState, useRef } from "react";
import { Upload, Link as LinkIcon, Image as ImageIcon, Loader2, X, GripVertical } from "lucide-react";
import { uploadImage, uploadErrorMessage, validateImage, IMAGE_ACCEPT_ATTR } from "../lib/uploadImage";
import { resolveShareUrl, SHARE_PROVIDER_NAMES } from "../lib/shareLinks";
import toast from "react-hot-toast";
import SmartImage from "./SmartImage";

interface Props {
  value: string[];
  onChange: (urls: string[]) => void;
  label?: string;
  folder?: string;
}

export default function GalleryUpload({ value = [], onChange, label = "Gallery Images", folder = "gallery" }: Props) {
  const [mode, setMode] = useState<"url" | "upload">("upload");
  const [urlInput, setUrlInput] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
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
    <div className="w-full">
      <label className="block text-sm font-bold text-stone-700 mb-2 uppercase tracking-wide">{label}</label>
      
      {/* Draggable Grid */}
      {value.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mb-6">
          {value.map((url, idx) => (
            <div
              key={`${url}-${idx}`}
              draggable
              onDragStart={(e) => handleDragStart(e, idx)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => handleDragOver(e, idx)}
              className={`relative aspect-video rounded-xl overflow-hidden group cursor-move bg-stone-100 transition-all ${idx === 0 ? "border-2 border-emerald-500 shadow-md ring-2 ring-emerald-500/20" : "border border-stone-200 hover:border-stone-300"}`}
            >
              <SmartImage src={url} alt={`Gallery ${idx + 1}`} className="w-full h-full object-cover pointer-events-none" />
              {idx === 0 && (
                <div className="absolute top-2 left-2 bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider shadow-sm">
                  Cover Photo
                </div>
              )}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                <GripVertical className="text-white h-8 w-8" />
              </div>
              <button
                type="button"
                onClick={() => removeImage(idx)}
                className="absolute top-2 right-2 bg-red-500 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition hover:bg-red-600 z-10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add new image controls */}
      <div className="bg-stone-50 p-4 rounded-xl border border-stone-200">
        <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-3">Add more images</p>
        <div className="flex gap-2 mb-3">
          <button
            type="button"
            onClick={() => setMode("url")}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition ${
              mode === "url" ? "bg-stone-900 text-white" : "bg-stone-200 text-stone-600 hover:bg-stone-300"
            }`}
          >
            <LinkIcon className="h-4 w-4" /> URL
          </button>
          <button
            type="button"
            onClick={() => setMode("upload")}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition ${
              mode === "upload" ? "bg-stone-900 text-white" : "bg-stone-200 text-stone-600 hover:bg-stone-300"
            }`}
          >
            <Upload className="h-4 w-4" /> Upload
          </button>
        </div>

        {mode === "url" ? (
          <div className="flex gap-2">
            <input
              type="url"
              value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && (e.preventDefault(), handleAddUrl())}
              className="flex-1 rounded-xl border-stone-200 border bg-white p-3 text-sm focus:ring-2 focus:ring-stone-900 outline-none transition"
              placeholder="e.g. https://example.com/image.jpg"
            />
            <button
              type="button"
              onClick={handleAddUrl}
              className="bg-stone-900 text-white px-4 rounded-xl text-sm font-medium hover:bg-stone-800 transition"
            >
              Add
            </button>
          </div>
        ) : (
          <div 
            className={`w-full rounded-xl border-2 border-dashed ${isDraggingFile ? 'border-stone-900 bg-stone-100' : 'border-stone-300 bg-white'} p-6 flex flex-col items-center justify-center text-center hover:border-stone-400 transition cursor-pointer`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={handleDragOverFile}
            onDragLeave={handleDragLeaveFile}
            onDrop={handleDropFile}
          >
            {isUploading ? (
              <div className="flex flex-col items-center justify-center space-y-3">
                <Loader2 className="h-8 w-8 text-stone-400 animate-spin" />
                <p className="text-sm text-stone-500 font-medium">Uploading...</p>
              </div>
            ) : (
              <>
                <ImageIcon className={`h-8 w-8 mb-3 transition ${isDraggingFile ? 'text-stone-900' : 'text-stone-400'}`} />
                <p className={`text-sm font-medium mb-1 ${isDraggingFile ? 'text-stone-900' : 'text-stone-600'}`}>
                  {isDraggingFile ? 'Drop images here' : 'Click or drag images to upload'}
                </p>
                <p className="text-xs text-stone-400">JPG, PNG, WEBP (multiple allowed)</p>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept={IMAGE_ACCEPT_ATTR}
              multiple
              className="hidden"
              onChange={handleFileChange}
              disabled={isUploading}
            />
          </div>
        )}
      </div>
    </div>
  );
}

