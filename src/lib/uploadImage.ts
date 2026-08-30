/**
 * Image uploads to local backend server.
 */

export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'];
export const IMAGE_ACCEPT_ATTR = ACCEPTED_IMAGE_TYPES.join(',');
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

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
    return `That image is ${formatBytes(file.size)}. The limit is ${formatBytes(MAX_IMAGE_BYTES)} — try exporting it smaller.`;
  }
  if (file.size === 0) return 'That file is empty.';
  return null;
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

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/upload', true);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && options.onProgress) {
        options.onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const res = JSON.parse(xhr.responseText);
          resolve(res.url);
        } catch (err) {
          reject(new ImageUploadError('Invalid response from server'));
        }
      } else {
        try {
          const res = JSON.parse(xhr.responseText);
          reject(new ImageUploadError(res.error || 'Upload failed'));
        } catch (err) {
          reject(new ImageUploadError('Upload failed with status ' + xhr.status));
        }
      }
    };

    xhr.onerror = () => reject(new ImageUploadError('Network error during upload'));

    const formData = new FormData();
    formData.append('folder', folder);
    formData.append('image', file);

    xhr.send(formData);
  });
}

export function uploadErrorMessage(error: unknown): string {
  if (error instanceof ImageUploadError) return error.message;
  return (error as Error)?.message || 'An unknown error occurred during upload.';
}
