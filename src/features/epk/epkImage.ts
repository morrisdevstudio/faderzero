const EPK_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_EPK_IMAGE_BYTES = 10 * 1024 * 1024;

export type EpkImageSize = { maxWidth: number; maxHeight: number };

export const EPK_HERO_IMAGE_SIZE: EpkImageSize = { maxWidth: 2400, maxHeight: 1350 };
export const EPK_PHOTO_IMAGE_SIZE: EpkImageSize = { maxWidth: 1600, maxHeight: 1600 };

export function fitEpkImageSize(width: number, height: number, bounds: EpkImageSize): { width: number; height: number } {
  const scale = Math.min(1, bounds.maxWidth / width, bounds.maxHeight / height);
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export async function compressEpkImage(file: File, bounds: EpkImageSize): Promise<File> {
  if (!EPK_IMAGE_TYPES.has(file.type) || file.size > MAX_EPK_IMAGE_BYTES) {
    throw new Error('Choisissez une image JPEG, PNG ou WebP de 10 Mo maximum.');
  }

  const image = await loadImage(file);
  try {
    const size = fitEpkImageSize(image.width, image.height, bounds);
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error("Impossible de préparer l'image sur cet appareil.");
    context.drawImage(image, 0, 0, size.width, size.height);
    const blob = await canvasToWebp(canvas);
    if (blob.size > MAX_EPK_IMAGE_BYTES) throw new Error("L'image optimisée dépasse 10 Mo.");
    return new File([blob], `${file.name.replace(/\.[^.]+$/, '') || 'image'}.webp`, { type: 'image/webp' });
  } finally {
    if ('close' in image && typeof image.close === 'function') image.close();
  }
}

async function loadImage(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') return createImageBitmap(file, { imageOrientation: 'from-image' });
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = objectUrl;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function canvasToWebp(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Impossible de convertir l'image en WebP.")), 'image/webp', 0.84);
  });
}
