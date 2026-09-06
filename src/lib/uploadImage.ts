import imageCompression from 'browser-image-compression';

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

export async function uploadImage(
  file: File,
  folder: string = 'uploads',
  options: UploadOptions = {}
): Promise<string> {
  const problem = validateImage(file);
  if (problem) throw new ImageUploadError(problem);

  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName || !uploadPreset) {
    throw new ImageUploadError(
      "Cloudinary is not configured. Please add VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET to your .env file."
    );
  }

  // Compress the image before uploading to save bandwidth and storage costs
  let fileToUpload = file;
  try {
    if (file.type !== 'image/gif') {
      console.log('Starting image compression...');
      fileToUpload = await imageCompression(file, {
        maxSizeMB: 0.4, 
        maxWidthOrHeight: 1920, 
        useWebWorker: false,
        fileType: 'image/webp'
      });
          console.log('Image compression finished.');
    }
  } catch (error) {
    console.warn('Image compression failed, falling back to original file', error);
  }

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
        } catch (err) {
          reject(new ImageUploadError("Failed to parse Cloudinary response."));
        }
      } else {
        reject(new ImageUploadError(`Cloudinary upload failed: ${xhr.statusText}`));
      }
    };

    xhr.onerror = () => {
      reject(new ImageUploadError("Network error while uploading to Cloudinary."));
    };

    const formData = new FormData();
    formData.append('file', fileToUpload);
    formData.append('upload_preset', uploadPreset);
    formData.append('folder', `travel-malawi/${folder}`); // Optional organization in Cloudinary

    xhr.send(formData);
  });
}

export function uploadErrorMessage(error: unknown): string {
  if (error instanceof ImageUploadError) return error.message;
  if (error instanceof Error) return error.message;
  return "An unknown error occurred during image upload.";
}


