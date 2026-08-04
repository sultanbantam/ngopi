import sharp from 'sharp';
import path from 'path';
import fs from 'fs';

const MAX_DIMENSION = 1920;
const JPEG_QUALITY = 80;
const WEBP_QUALITY = 80;

/**
 * Compress an image file in-place using sharp.
 * - Resizes to max 1920px on the longest side (preserving aspect ratio)
 * - Converts to WebP format for smaller file size
 * - Returns the new file path (with .webp extension)
 * - Skips non-image or animated GIF files
 */
export async function compressImage(filePath: string, originalName: string): Promise<{ compressedPath: string; newFilename: string } | null> {
  const ext = path.extname(originalName || filePath).toLowerCase();
  const supportedExts = ['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.heic', '.heif'];

  if (!supportedExts.includes(ext)) {
    return null; // Not a compressible image
  }

  try {
    const metadata = await sharp(filePath).metadata();

    // Skip animated images (GIF with multiple pages)
    if (metadata.pages && metadata.pages > 1) {
      return null;
    }

    // Skip if already small enough
    const stats = fs.statSync(filePath);
    if (stats.size < 50 * 1024) { // < 50 KB, no need to compress
      return null;
    }

    const newFilename = path.basename(filePath, path.extname(filePath)) + '.webp';
    const compressedPath = path.join(path.dirname(filePath), newFilename);

    await sharp(filePath)
      .resize(MAX_DIMENSION, MAX_DIMENSION, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: WEBP_QUALITY })
      .toFile(compressedPath);

    // Remove original file if the compressed file is different
    if (compressedPath !== filePath) {
      fs.unlinkSync(filePath);
    }

    return { compressedPath, newFilename };
  } catch (error) {
    console.error('Image compression failed, using original:', error);
    return null; // Fall back to original file
  }
}
