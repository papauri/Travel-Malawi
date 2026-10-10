import imageCompression from 'browser-image-compression';
import { auth } from './firebase';

export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'];
export const IMAGE_ACCEPT_ATTR = ACCEPTED_IMAGE_TYPES.join(',');
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

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
  if (file.size > MAX_IMAGE_BYTES) {
    return `That image is ${formatBytes(file.size)}. The limit is ${formatBytes(MAX_IMAGE_BYTES)} to prevent browser crashes.`;
  }
  if (file.size === 0) return 'That file is empty.';
  return null;
}

export interface UploadOptions {
  onProgress?: (percent: number) => void;
}

/**
 * Uploads an image either to Cloudinary (if configured in .env) or to the app's
 * built-in Express server endpoint (/api/upload).
 */
export async function uploadImage(
  file: File,
  folder: string = 'uploads',
  options: UploadOptions = {}
): Promise<string> {
  const problem = validateImage(file);
  if (problem) throw new ImageUploadError(problem);

  // Compress the image before uploading to save bandwidth and storage costs
  let fileToUpload = file;
  try {
    if (file.type !== 'image/gif') {
      fileToUpload = await imageCompression(file, {
        maxSizeMB: 0.6,
        maxWidthOrHeight: 1920,
        useWebWorker: false,
        fileType: 'image/webp'
      });
    }
  } catch (error) {
    console.warn('Image compression failed, falling back to original file', error);
  }

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
