import { ref, uploadBytesResumable, getDownloadURL, StorageError } from 'firebase/storage';
import { storage } from './firebase';
import { v4 as uuidv4 } from 'uuid';
import imageCompression from 'browser-image-compression';

export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'];
export const IMAGE_ACCEPT_ATTR = ACCEPTED_IMAGE_TYPES.join(',');

// We still have a hard limit, but we drop it to 10MB just to prevent browser crash during compression
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

const EXTENSION_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/gif': 'gif',
};

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

function describeError(error: unknown): string {
  const code = (error as StorageError)?.code;
  switch (code) {
    case 'storage/unauthorized':
      return 'You do not have permission to upload here. Sign in again, or ask an administrator to check the storage rules.';
    case 'storage/unauthenticated':
      return 'Your session expired. Sign in again and retry the upload.';
    case 'storage/retry-limit-exceeded':
      return 'The upload timed out. Check your connection and try again.';
    case 'storage/canceled':
      return 'Upload cancelled.';
    case 'storage/quota-exceeded':
      return 'This project has run out of storage.';
    case 'storage/invalid-checksum':
      return 'The file was corrupted in transit. Please try again.';
    case 'storage/unknown':
    default:
      return (
        'Could not reach image storage. If this is a new project, Firebase Storage ' +
        'may not be enabled yet — see SECURITY.md for the one-time setup step.'
      );
  }
}

export interface UploadOptions {
  onProgress?: (percent: number) => void;
}

export async function uploadImage(
  file: File,
  folder: string = 'uploads',
  options: UploadOptions = {}
): Promise<string> {
  const problem = validateImage(file);
  if (problem) throw new ImageUploadError(problem);

  // Compress the image before uploading to save storage costs and improve load times
  let fileToUpload = file;
  try {
    // We don't compress GIFs as it breaks the animation
    if (file.type !== 'image/gif') {
      fileToUpload = await imageCompression(file, {
        maxSizeMB: 0.4, // Max file size of 400KB
        maxWidthOrHeight: 1920, // Max dimension
        useWebWorker: true,
        fileType: 'image/webp' // Convert everything to WebP for massive space savings
      });
    }
  } catch (error) {
    console.warn('Image compression failed, falling back to original file', error);
  }

  // Use webp if we successfully converted it, otherwise fallback to original extension
  const extension = fileToUpload.type === 'image/webp' ? 'webp' : (EXTENSION_BY_TYPE[fileToUpload.type] ?? 'jpg');
  const filePath = `${folder}/${uuidv4()}.${extension}`;
  const storageRef = ref(storage, filePath);

  const task = uploadBytesResumable(storageRef, fileToUpload, {
    contentType: fileToUpload.type,
    // Listing photos change rarely and are served on every page view.
    cacheControl: 'public, max-age=31536000, immutable',
  });

  await new Promise<void>((resolve, reject) => {
    task.on(
      'state_changed',
      snapshot => {
        if (!options.onProgress || snapshot.totalBytes === 0) return;
        options.onProgress(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100));
      },
      error => reject(new ImageUploadError(describeError(error))),
      () => resolve()
    );
  });

  return getDownloadURL(storageRef);
}

export function uploadErrorMessage(error: unknown): string {
  if (error instanceof ImageUploadError) return error.message;
  return describeError(error);
}
