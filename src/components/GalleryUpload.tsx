import React, { useState, useRef } from "react";
import { Upload, Link as LinkIcon, Image as ImageIcon, Loader2, X, GripVertical } from "lucide-react";
import { uploadImage } from "../lib/uploadImage";
import toast from "react-hot-toast";

interface Props {
  value: string[];
  onChange: (urls: string[]) => void;
  label?: string;
  folder?: string;
}

export default function GalleryUpload({ value = [], onChange, label = "Gallery Images", folder = "gallery" }: Props) {
  const [mode, setMode] = useState<"url" | "upload">("url");
  const [urlInput, setUrlInput] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Drag and Drop state
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      const newUrls = [...value];
      for (let i = 0; i < files.length; i++) {
        const url = await uploadImage(files[i], folder);
        newUrls.push(url);
      }
      onChange(newUrls);
    } catch (error) {
      console.error("Error uploading images:", error);
      toast.error("Failed to upload image(s).");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleAddUrl = () => {
    if (!urlInput.trim()) return;
    onChange([...value, urlInput.trim()]);
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {value.map((url, idx) => (
            <div
              key={`${url}-${idx}`}
              draggable
              onDragStart={(e) => handleDragStart(e, idx)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => handleDragOver(e, idx)}
              className="relative aspect-video rounded-xl overflow-hidden group cursor-move bg-stone-100 border border-stone-200"
            >
              <img src={url} alt={`Gallery ${idx + 1}`} className="w-full h-full object-cover pointer-events-none" />
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
              placeholder="https://images.unsplash.com/..."
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
          <div className="w-full rounded-xl border-2 border-dashed border-stone-300 bg-white p-6 flex flex-col items-center justify-center text-center hover:border-stone-400 transition cursor-pointer" onClick={() => fileInputRef.current?.click()}>
            {isUploading ? (
              <div className="flex flex-col items-center justify-center space-y-3">
                <Loader2 className="h-8 w-8 text-stone-400 animate-spin" />
                <p className="text-sm text-stone-500 font-medium">Uploading...</p>
              </div>
            ) : (
              <>
                <ImageIcon className="h-8 w-8 text-stone-400 mb-3" />
                <p className="text-sm text-stone-600 font-medium mb-1">Click to select images</p>
                <p className="text-xs text-stone-400">JPG, PNG, WEBP (multiple allowed)</p>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
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
