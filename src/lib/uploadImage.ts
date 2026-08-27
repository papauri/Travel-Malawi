/**
 * Image uploads.
 *
 * The previous version passed any file straight to Firebase Storage with no
 * validation and let failures surface as a bare "Failed to upload image", which
 * was unhelpful given the most common failure is that Storage has not been
 * enabled on the project at all.
 */

import { ref, uploadBytesResumable, getDownloadURL, StorageError } from 'firebase/storage';
import { storage } from './firebase';
import { v4 as uuidv4 } from 'uuid';

/** Matches the content types allowed by storage.rules. */
export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'];

/** The `accept` attribute for a file input, kept in step with the above. */
export const IMAGE_ACCEPT_ATTR = ACCEPTED_IMAGE_TYPES.join(',');

/** 8 MB, matching storage.rules. Rejected here so the upload never starts. */
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

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

/** Thrown for problems worth showing the user verbatim. */
export class ImageUploadError extends Error {}

/** Checks a file before any network call. Returns null when it is fine. */
export function validateImage(file: File): string | null {
  if (!file) return 'No file selected.';
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    return file.type
      ? `${file.type.split('/')[1]?.toUpperCase() || 'That file type'} is not supported. Use JPG, PNG, WebP, AVIF or GIF.`
      : 'That file is not an image.';
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return `That image is ${formatBytes(file.size)}. The limit is ${formatBytes(MAX_IMAGE_BYTES)} — try exporting it smaller.`;
  }
  if (file.size === 0) return 'That file is empty.';
  return null;
}

/**
 * Turns a Storage error code into something a property manager can act on.
 * `storage/unknown` on a project with no bucket is by far the most common, and
 * "unknown" tells them nothing.
 */
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
  /** Called with 0–100 as the upload proceeds. */
  onProgress?: (percent: number) => void;
}

/**
 * Uploads one image and resolves to its public download URL.
 *
 * The stored name is a UUID with an extension derived from the file's actual
 * content type, not from whatever the original filename claimed.
 */
export async function uploadImage(
  file: File,
  folder: string = 'uploads',
  options: UploadOptions = {}
): Promise<string> {
  const problem = validateImage(file);
  if (problem) throw new ImageUploadError(problem);

  const extension = EXTENSION_BY_TYPE[file.type] ?? 'jpg';
  const filePath = `${folder}/${uuidv4()}.${extension}`;
  const storageRef = ref(storage, filePath);

  const task = uploadBytesResumable(storageRef, file, {
    contentType: file.type,
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

/** Message for a caught upload failure, whatever its shape. */
export function uploadErrorMessage(error: unknown): string {
  if (error instanceof ImageUploadError) return error.message;
  return describeError(error);
}
