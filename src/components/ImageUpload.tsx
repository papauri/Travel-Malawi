import React, { useState, useRef } from 'react';
import { Upload, Link as LinkIcon, Image as ImageIcon, Loader2 } from 'lucide-react';
import { uploadImage } from '../lib/uploadImage';
import toast from 'react-hot-toast';

interface Props {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  folder?: string;
}

export default function ImageUpload({ value, onChange, label = 'Image', folder = 'uploads' }: Props) {
  const [mode, setMode] = useState<'url' | 'upload'>('url');
  const [isUploading, setIsUploading] = useState(false);
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
    
    setIsUploading(true);
    try {
      const url = await uploadImage(file, folder);
      onChange(url);
      setMode('url');
    } catch (error) {
      console.error("Error uploading image:", error);
      toast.error('Failed to upload image.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const url = await uploadImage(file, folder);
      onChange(url);
      setMode('url');
    } catch (error) {
      console.error("Error uploading image:", error);
      toast.error('Failed to upload image.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="w-full">
      <label className="block text-sm font-bold text-stone-700 mb-2 uppercase tracking-wide">{label}</label>
      
      <div className="flex gap-2 mb-3">
        <button
          type="button"
          onClick={() => setMode('url')}
          className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition ${
            mode === 'url' ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
          }`}
        >
          <LinkIcon className="h-4 w-4" /> Use URL
        </button>
        <button
          type="button"
          onClick={() => setMode('upload')}
          className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition ${
            mode === 'upload' ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
          }`}
        >
          <Upload className="h-4 w-4" /> Upload File
        </button>
      </div>

      {mode === 'url' ? (
        <input
          type="url"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full rounded-xl border-stone-200 border bg-stone-50 p-4 focus:ring-2 focus:ring-stone-900 focus:border-transparent outline-none transition"
          placeholder="https://images.unsplash.com/..."
        />
      ) : (
        <div 
          className={`w-full rounded-xl border-2 border-dashed ${isDraggingFile ? 'border-stone-900 bg-stone-100' : 'border-stone-300 bg-stone-50'} p-6 flex flex-col items-center justify-center text-center hover:border-stone-400 transition cursor-pointer`}
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
                {isDraggingFile ? 'Drop image here' : 'Click or drag an image to upload'}
              </p>
              <p className="text-xs text-stone-400">JPG, PNG, WEBP (max 5MB)</p>
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
            disabled={isUploading}
          />
        </div>
      )}
      
      {value && mode === 'upload' && !isUploading && (
        <div className="mt-3 relative rounded-xl overflow-hidden h-32 bg-stone-100 border border-stone-200">
          <img src={value} alt="Preview" className="w-full h-full object-cover" />
        </div>
      )}
    </div>
  );
}
