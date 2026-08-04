import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import jpeg from 'jpeg-js';
import sharp from 'sharp';

export function thumbnailPath(library, item) {
  return path.join(library.rootDir, 'images', `${item.id}.info`, `${item.name}_thumbnail.png`);
}

function resizeRgbaSync(source, maxSize = 320) {
  const maxSide = Math.max(source.width, source.height);
  if (maxSide <= maxSize) return PNG.sync.write(source);
  const scale = maxSize / maxSide;
  const width = Math.max(1, Math.round(source.width * scale));
  const height = Math.max(1, Math.round(source.height * scale));
  const target = new PNG({ width, height, inputColorType: 6, inputHasAlpha: true });
  for (let y = 0; y < height; y += 1) {
    const sourceY = Math.min(source.height - 1, Math.floor(y / scale));
    for (let x = 0; x < width; x += 1) {
      const sourceX = Math.min(source.width - 1, Math.floor(x / scale));
      const sourceIndex = (sourceY * source.width + sourceX) * 4;
      const targetIndex = (y * width + x) * 4;
      target.data[targetIndex] = source.data[sourceIndex];
      target.data[targetIndex + 1] = source.data[sourceIndex + 1];
      target.data[targetIndex + 2] = source.data[sourceIndex + 2];
      target.data[targetIndex + 3] = source.data[sourceIndex + 3];
    }
  }
  return PNG.sync.write(target);
}

function resizePngSync(buffer, maxSize = 320) {
  return resizeRgbaSync(PNG.sync.read(buffer), maxSize);
}

function resizeJpegSync(buffer, maxSize = 320) {
  const source = jpeg.decode(buffer, { useTArray: true });
  return resizeRgbaSync(source, maxSize);
}

export function readImageDimensions(filePath, ext) {
  const normalized = String(ext || path.extname(filePath).slice(1)).toLowerCase();
  const buffer = fs.readFileSync(filePath);
  if (normalized === 'png') {
    const image = PNG.sync.read(buffer);
    return { width: image.width, height: image.height };
  }
  if (normalized === 'jpg' || normalized === 'jpeg') {
    const image = jpeg.decode(buffer, { useTArray: true });
    return { width: image.width, height: image.height };
  }
  return { width: 0, height: 0 };
}

export function generateThumbnail(library, item, options = {}) {
  const original = path.join(library.rootDir, 'images', `${item.id}.info`, `${item.name}.${item.ext}`);
  const target = thumbnailPath(library, item);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (item.ext === 'png' && fs.existsSync(original)) {
    const resized = resizePngSync(fs.readFileSync(original), options.maxSize || 320);
    fs.writeFileSync(target, resized);
    return target;
  }
  if ((item.ext === 'jpg' || item.ext === 'jpeg') && fs.existsSync(original)) {
    const resized = resizeJpegSync(fs.readFileSync(original), options.maxSize || 320);
    fs.writeFileSync(target, resized);
    return target;
  }
  throw new Error(`Cannot generate thumbnail for ${item.id}.${item.ext}`);
}

export async function generateThumbnailAsync(library, item, options = {}) {
  const original = path.join(library.rootDir, 'images', `${item.id}.info`, `${item.name}.${item.ext}`);
  const target = thumbnailPath(library, item);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const supportedBySharp = new Set(['webp', 'heic', 'heif', 'avif', 'tif', 'tiff', 'raw', 'cr2', 'nef', 'arw']);
  if (supportedBySharp.has(String(item.ext || '').toLowerCase()) && fs.existsSync(original)) {
    try {
      await sharp(original)
        .resize({ width: options.maxSize || 320, height: options.maxSize || 320, fit: 'inside', withoutEnlargement: true })
        .png()
        .toFile(target);
      return target;
    } catch (err) {
      // Fall through to the synchronous fallback.
    }
  }
  return generateThumbnail(library, item, options);
}

export function ensureThumbnail(library, item) {
  const target = thumbnailPath(library, item);
  if (fs.existsSync(target)) return target;
  return generateThumbnail(library, item);
}
