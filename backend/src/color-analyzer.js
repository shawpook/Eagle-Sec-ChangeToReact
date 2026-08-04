import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { itemOriginalPath, itemThumbnailPath, saveItems } from './library-store.js';

const DEFAULT_CONCURRENCY = 3;
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_DELAY_MS = 20;
const MAX_ANALYSIS_SIDE = 480;
const MAX_DECODED_PIXELS = 30_000_000;
const MAX_COLORS = 12;

export class PaletteAnalysisError extends Error {
  constructor(message, options = {}) {
    super(message, options);
    this.name = 'PaletteAnalysisError';
    this.code = options.code || 'PALETTE_ANALYSIS_FAILED';
    this.statusCode = options.statusCode || 422;
  }
}

function sourcePathForItem(library, item) {
  const thumbnail = itemThumbnailPath(library, item);
  if (!item.noThumbnail && fs.existsSync(thumbnail) && fs.statSync(thumbnail).isFile()) return thumbnail;
  const original = itemOriginalPath(library, item);
  if (fs.existsSync(original) && fs.statSync(original).isFile()) return original;
  throw new PaletteAnalysisError(`Image source not found for item ${item.id}`, {
    code: 'IMAGE_SOURCE_NOT_FOUND',
    statusCode: 404,
  });
}

function quantizeRgba(data) {
  const buckets = new Map();
  let opaquePixels = 0;
  const pixelCount = Math.floor(data.length / 4);
  const skip = pixelCount < 25_000 ? 1 : pixelCount < 250_000 ? 2 : pixelCount < 1_000_000 ? 4 : 8;

  for (let pixel = 0; pixel < pixelCount; pixel += skip) {
    const offset = pixel * 4;
    if (data[offset + 3] < 170) continue;
    const red = data[offset];
    const green = data[offset + 1];
    const blue = data[offset + 2];
    const key = `${red >> 4},${green >> 4},${blue >> 4}`;
    const bucket = buckets.get(key) || { count: 0, red: 0, green: 0, blue: 0 };
    bucket.count += 1;
    bucket.red += red;
    bucket.green += green;
    bucket.blue += blue;
    buckets.set(key, bucket);
    opaquePixels += 1;
  }

  if (opaquePixels === 0 || buckets.size === 0) {
    throw new PaletteAnalysisError('Image has no analyzable opaque pixels', { code: 'NO_ANALYZABLE_PIXELS' });
  }

  const colors = [...buckets.values()]
    .map((bucket) => {
      const rawRatio = (bucket.count / opaquePixels) * 100;
      const ratio = rawRatio >= 5 ? Math.trunc(rawRatio) : Math.round(rawRatio * 100) / 100;
      return {
        color: [
          Math.round(bucket.red / bucket.count),
          Math.round(bucket.green / bucket.count),
          Math.round(bucket.blue / bucket.count),
        ],
        ratio,
      };
    })
    .filter((entry) => entry.ratio >= 0.25)
    .sort((left, right) => right.ratio - left.ratio);

  if (colors.length === 0) {
    throw new PaletteAnalysisError('Image palette is empty after quantization', { code: 'EMPTY_PALETTE' });
  }

  if (colors.length <= 5) return colors.slice(0, MAX_COLORS);
  const selected = colors.slice(0, 5);
  for (let index = 5; index < colors.length && selected.length < MAX_COLORS; index += 1) {
    const color = colors[index];
    if ((index < 6 && color.ratio > 0.1) || (index >= 6 && color.ratio > 0.3)) selected.push(color);
  }
  return selected;
}

export async function analyzeImagePalettes(filePath) {
  try {
    const { data, info } = await sharp(filePath, {
      failOn: 'error',
      limitInputPixels: MAX_DECODED_PIXELS,
      sequentialRead: true,
    })
      .rotate()
      .resize({
        width: MAX_ANALYSIS_SIDE,
        height: MAX_ANALYSIS_SIDE,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    if (!info.width || !info.height || info.width * info.height > MAX_DECODED_PIXELS) {
      throw new PaletteAnalysisError('Decoded image dimensions exceed the analysis limit', { code: 'IMAGE_TOO_LARGE' });
    }
    return quantizeRgba(data);
  } catch (err) {
    if (err instanceof PaletteAnalysisError) throw err;
    throw new PaletteAnalysisError(`Unable to decode image for palette analysis: ${err.message}`, {
      code: 'IMAGE_DECODE_FAILED',
      cause: err,
    });
  }
}

function delay(ms) {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class ColorAnalyzerService {
  constructor(options = {}) {
    const concurrency = Number(options.concurrency);
    const timeoutMs = Number(options.timeoutMs);
    const delayMs = Number(options.delayMs);
    this.concurrency = Math.max(1, Number.isFinite(concurrency) ? concurrency : DEFAULT_CONCURRENCY);
    this.timeoutMs = Math.max(1, Number.isFinite(timeoutMs) ? timeoutMs : DEFAULT_TIMEOUT_MS);
    this.delayMs = Math.max(0, Number.isFinite(delayMs) ? delayMs : DEFAULT_DELAY_MS);
    this.analyze = options.analyze || analyzeImagePalettes;
    this.pending = [];
    this.active = 0;
    this.paused = false;
  }

  status() {
    return {
      concurrency: this.concurrency,
      timeoutMs: this.timeoutMs,
      delayMs: this.delayMs,
      paused: this.paused,
      active: this.active,
      pending: this.pending.length,
      length: this.active + this.pending.length,
    };
  }

  setDelay(delayMs) {
    const value = Number(delayMs);
    if (!Number.isFinite(value) || value < 0 || value > 5_000) {
      throw new PaletteAnalysisError('Palette queue delay must be between 0 and 5000 ms', {
        code: 'INVALID_QUEUE_DELAY',
        statusCode: 400,
      });
    }
    this.delayMs = value;
    return this.status();
  }

  pause() {
    this.paused = true;
    return this.status();
  }

  resume() {
    this.paused = false;
    this.#drain();
    return this.status();
  }

  enqueue(library, itemId) {
    const item = library.items.find((entry) => entry.id === itemId);
    if (!item) {
      return Promise.reject(new PaletteAnalysisError('Item not found', {
        code: 'ITEM_NOT_FOUND',
        statusCode: 404,
      }));
    }

    item.processingPalette = true;
    delete item.palettes;
    saveItems(library);

    return new Promise((resolve, reject) => {
      this.pending.push({ library, itemId, resolve, reject });
      this.#drain();
    });
  }

  #drain() {
    while (!this.paused && this.active < this.concurrency && this.pending.length > 0) {
      const task = this.pending.shift();
      this.active += 1;
      this.#run(task);
    }
  }

  async #run(task) {
    let timeout;
    try {
      const item = task.library.items.find((entry) => entry.id === task.itemId);
      if (!item) {
        throw new PaletteAnalysisError('Item was removed before palette analysis', {
          code: 'ITEM_NOT_FOUND',
          statusCode: 404,
        });
      }
      const sourcePath = sourcePathForItem(task.library, item);
      const timeoutPromise = new Promise((resolve, reject) => {
        timeout = setTimeout(() => reject(new PaletteAnalysisError(
          `Palette analysis timed out after ${this.timeoutMs} ms`,
          { code: 'PALETTE_TIMEOUT', statusCode: 504 }
        )), this.timeoutMs);
      });
      const palettes = await Promise.race([this.analyze(sourcePath), timeoutPromise]);
      clearTimeout(timeout);

      const current = task.library.items.find((entry) => entry.id === task.itemId);
      if (!current) {
        throw new PaletteAnalysisError('Item was removed during palette analysis', {
          code: 'ITEM_NOT_FOUND',
          statusCode: 404,
        });
      }
      current.palettes = palettes;
      delete current.processingPalette;
      saveItems(task.library);
      await delay(this.delayMs);
      task.resolve({ item: current, palettes, queue: this.status() });
    } catch (err) {
      clearTimeout(timeout);
      const current = task.library.items.find((entry) => entry.id === task.itemId);
      if (current) {
        delete current.processingPalette;
        try {
          saveItems(task.library);
        } catch (saveError) {
          err = new PaletteAnalysisError(`Palette analysis failed and state cleanup could not be saved: ${saveError.message}`, {
            code: 'PALETTE_PERSIST_FAILED',
            statusCode: 500,
            cause: err,
          });
        }
      }
      task.reject(err instanceof PaletteAnalysisError ? err : new PaletteAnalysisError(err.message, { cause: err }));
    } finally {
      this.active -= 1;
      this.#drain();
    }
  }
}
