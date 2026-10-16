import imageCompression from 'browser-image-compression';
import { auth } from './firebase';

export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'];
export const IMAGE_ACCEPT_ATTR = ACCEPTED_IMAGE_TYPES.join(',');
export const MAX_RAW_INPUT_BYTES = 40 * 1024 * 1024; // Allow up to 40MB raw uploads from modern cameras & phones
export const MAX_IMAGE_BYTES = MAX_RAW_INPUT_BYTES;

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export class ImageUploadError extends Error {}

export function validateImage(file: File): string | null {
  if (!file) return 'No file selected.';
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    return file.type
      ? `${file.type.split('/')[1]?.toUpperCase() || 'That file type'} is not supported. Use JPG, PNG, WebP, AVIF or GIF.`
      : 'That file is not an image.';
  }
  if (file.size > MAX_RAW_INPUT_BYTES) {
    return `That image is ${formatBytes(file.size)}. The limit is ${formatBytes(MAX_RAW_INPUT_BYTES)} before automatic compression.`;
  }
  if (file.size === 0) return 'That file is empty.';
  return null;
}

/**
 * Ultra-reliable HTML5 Canvas compressor for scaling down large raw photos (up to 40MB)
 * to standard web dimensions (max 1920px) without memory spikes or crashes.
 */
function compressViaCanvas(file: File, maxDimension = 1920, quality = 0.82): Promise<File> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return resolve(file);
    }

    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let { width, height } = img;

      if (!width || !height) {
        return resolve(file);
      }

      // Proportional scale down to maxDimension
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      try {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return resolve(file);
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        const mimeType = 'image/webp';
        canvas.toBlob(
          (blob) => {
            if (!blob || blob.size === 0) {
              return resolve(file);
            }
            const cleanName = file.name.replace(/\.[^/.]+$/, '.webp');
            const resultFile = new File([blob], cleanName, {
              type: mimeType,
              lastModified: Date.now(),
            });
            resolve(resultFile);
          },
          mimeType,
          quality
        );
      } catch (err) {
        console.warn('[ImageCompressor] Canvas drawing error:', err);
        resolve(file);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file);
    };

    img.src = objectUrl;
  });
}

/**
 * Compresses an image file down to recommended web sizes (max 1920px, ~500KB - 800KB).
 * Handles large raw camera photos (e.g. 15MB–25MB) safely.
 */
export async function compressImageToRecommended(file: File): Promise<File> {
  // GIFs and already lightweight files (< 300KB) don't need compression
  if (file.type === 'image/gif' || file.size < 300 * 1024) {
    return file;
  }

  // 1. Try browser-image-compression with optimized parameters
  try {
    const compressed = await imageCompression(file, {
      maxSizeMB: 0.8,
      maxWidthOrHeight: 1920,
      useWebWorker: true,
      fileType: 'image/webp',
      initialQuality: 0.82,
    });
    if (compressed && compressed.size > 0 && compressed.size < file.size) {
      return new File([compressed], file.name.replace(/\.[^/.]+$/, '.webp'), {
        type: 'image/webp',
        lastModified: Date.now(),
      });
    }
  } catch (err) {
    console.warn('[ImageCompressor] browser-image-compression fell through to Canvas compressor:', err);
  }

  // 2. HTML5 Canvas progressive compressor fallback (guarantees resize even on 20MB files)
  try {
    const canvasCompressed = await compressViaCanvas(file, 1920, 0.82);
    if (canvasCompressed && canvasCompressed.size < file.size) {
      return canvasCompressed;
    }
  } catch (err) {
    console.warn('[ImageCompressor] Canvas compressor error:', err);
  }

  return file;
}

export interface UploadOptions {
  onProgress?: (percent: number) => void;
}

/**
 * Uploads an image either to Cloudinary (if configured in .env) or to the app's
 * built-in Express server endpoint (/api/upload).
 * Automatically compresses big photos (like 20MB) to recommended web size (< 800KB).
 */
export async function uploadImage(
  file: File,
  folder: string = 'uploads',
  options: UploadOptions = {}
): Promise<string> {
  const problem = validateImage(file);
  if (problem) throw new ImageUploadError(problem);

  // Automatically compress the image before uploading to recommended web size (< 800KB)
  const fileToUpload = await compressImageToRecommended(file);

  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

  // 1. If Cloudinary is explicitly configured, use it
  if (cloudName && uploadPreset) {
    return uploadToCloudinary(fileToUpload, folder, cloudName, uploadPreset, options);
  }

  // 2. Otherwise default to the app's native server upload endpoint
  return uploadToServer(fileToUpload, folder, options);
}

function uploadToCloudinary(
  file: File,
  folder: string,
  cloudName: string,
  uploadPreset: string,
  options: UploadOptions
): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const url = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
    xhr.open('POST', url, true);

    if (options.onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          options.onProgress!(Math.round((e.loaded / e.total) * 100));
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText);
          resolve(response.secure_url);
        } catch {
          reject(new ImageUploadError('Failed to parse Cloudinary response.'));
        }
      } else {
        reject(new ImageUploadError(`Cloudinary upload failed: ${xhr.statusText}`));
      }
    };

    xhr.onerror = () => {
      reject(new ImageUploadError('Network error while uploading to Cloudinary.'));
    };

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', uploadPreset);
    formData.append('folder', `travel-malawi/${folder}`);
    xhr.send(formData);
  });
}

async function uploadToServer(
  file: File,
  folder: string,
  options: UploadOptions
): Promise<string> {
  const token = await auth.currentUser?.getIdToken();

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/upload', true);

    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }

    if (options.onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          options.onProgress!(Math.round((e.loaded / e.total) * 100));
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText);
          if (response?.url) {
            resolve(response.url);
          } else {
            reject(new ImageUploadError(response?.error || 'Failed to parse upload response.'));
          }
        } catch {
          reject(new ImageUploadError('Failed to parse server upload response.'));
        }
      } else {
        try {
          const errRes = JSON.parse(xhr.responseText);
          reject(new ImageUploadError(errRes?.error || `Upload failed with status ${xhr.status}.`));
        } catch {
          reject(new ImageUploadError(`Upload failed with status ${xhr.status}.`));
        }
      }
    };

    xhr.onerror = () => {
      reject(new ImageUploadError('Network error while uploading image to server.'));
    };

    const formData = new FormData();
    // folder must be appended first so Multer diskStorage destination reads it
    formData.append('folder', folder);
    formData.append('image', file);
    xhr.send(formData);
  });
}

export function uploadErrorMessage(error: unknown): string {
  if (error instanceof ImageUploadError) return error.message;
  if (error instanceof Error) return error.message;
  return 'An unknown error occurred during image upload.';
}
