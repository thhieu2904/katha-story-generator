const UPLOADABLE_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const IMAGE_EXTENSION_PATTERN = /\.(?:jpe?g|png|webp|heic|heif)$/i;

export const MAX_VISION_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_CAMERA_SOURCE_BYTES = 40 * 1024 * 1024;
const MAX_CAMERA_IMAGE_EDGE = 2560;

export type VisionImagePreparationErrorCode = 'unsupported' | 'too_large';

export class VisionImagePreparationError extends Error {
  constructor(public readonly code: VisionImagePreparationErrorCode) {
    super(code);
    this.name = 'VisionImagePreparationError';
  }
}

function inferredUploadType(file: File) {
  const type = file.type.toLowerCase().split(';', 1)[0];
  if (UPLOADABLE_IMAGE_TYPES.has(type)) return type;
  if (type === 'image/jpg') return 'image/jpeg';
  if (type) return null;

  if (/\.jpe?g$/i.test(file.name)) return 'image/jpeg';
  if (/\.png$/i.test(file.name)) return 'image/png';
  if (/\.webp$/i.test(file.name)) return 'image/webp';
  return null;
}

function normalizeUploadableFile(file: File) {
  const type = inferredUploadType(file);
  if (!type) return null;
  if (file.type === type) return file;

  return new File([file], file.name, {
    type,
    lastModified: file.lastModified,
  });
}

function looksLikeCameraImage(file: File) {
  return file.type.toLowerCase().startsWith('image/') || IMAGE_EXTENSION_PATTERN.test(file.name);
}

function loadBrowserImage(sourceUrl: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = document.createElement('img');
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new VisionImagePreparationError('unsupported'));
    image.src = sourceUrl;
  });
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new VisionImagePreparationError('unsupported'));
    }, 'image/jpeg', quality);
  });
}

async function transcodeCameraImage(file: File) {
  const sourceUrl = URL.createObjectURL(file);
  try {
    const image = await loadBrowserImage(sourceUrl);
    if (!image.naturalWidth || !image.naturalHeight) {
      throw new VisionImagePreparationError('unsupported');
    }

    const scale = Math.min(1, MAX_CAMERA_IMAGE_EDGE / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new VisionImagePreparationError('unsupported');

    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    let converted = await canvasToJpeg(canvas, 0.88);
    if (converted.size > MAX_VISION_IMAGE_BYTES) {
      converted = await canvasToJpeg(canvas, 0.72);
    }
    if (converted.size > MAX_VISION_IMAGE_BYTES) {
      throw new VisionImagePreparationError('too_large');
    }

    const jpegName = file.name.replace(/\.[^.]+$/, '') || 'camera-photo';
    return new File([converted], `${jpegName}.jpg`, {
      type: 'image/jpeg',
      lastModified: file.lastModified,
    });
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

export async function prepareVisionImage(file: File): Promise<File> {
  if (!file.size || !looksLikeCameraImage(file)) {
    throw new VisionImagePreparationError('unsupported');
  }
  if (file.size > MAX_CAMERA_SOURCE_BYTES) {
    throw new VisionImagePreparationError('too_large');
  }

  const normalized = normalizeUploadableFile(file);
  if (normalized && normalized.size <= MAX_VISION_IMAGE_BYTES) {
    return normalized;
  }

  return transcodeCameraImage(file);
}
