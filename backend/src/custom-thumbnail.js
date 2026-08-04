import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { analyzeImagePalettes } from './color-analyzer.js';
import { itemOriginalPath, itemThumbnailPath, saveItems } from './library-store.js';

const MAX_SOURCE_BYTES = 10_000_000;
const MAX_DECODED_PIXELS = 30_000_000;
const DEFAULT_THUMBNAIL_SIZE = 320;
const SHARP_REFRESH_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'webp', 'heic', 'heif', 'avif', 'tif', 'tiff', 'raw', 'cr2', 'nef', 'arw',
]);

export class CustomThumbnailError extends Error {
  constructor(message, options = {}) {
    super(message, options);
    this.name = 'CustomThumbnailError';
    this.code = options.code || 'CUSTOM_THUMBNAIL_FAILED';
    this.statusCode = options.statusCode || 422;
  }
}

function uniqueSibling(filePath, label) {
  return `${filePath}.${label}-${process.pid}-${crypto.randomUUID()}`;
}

function assertFiniteDimension(value, name) {
  if (value === undefined || value === null || value === '') return undefined;
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0 || number > MAX_DECODED_PIXELS) {
    throw new CustomThumbnailError(`${name} must be a positive finite number`, {
      code: 'INVALID_THUMBNAIL_DIMENSIONS',
      statusCode: 400,
    });
  }
  return Math.round(number);
}

function resolveSourceFile(input) {
  if (!input || typeof input !== 'string' || input.includes('\0') || !path.isAbsolute(input)) {
    throw new CustomThumbnailError('Thumbnail source must be an absolute file path', {
      code: 'INVALID_THUMBNAIL_PATH',
      statusCode: 400,
    });
  }

  let sourcePath;
  let stat;
  try {
    const linkStat = fs.lstatSync(input);
    if (linkStat.isSymbolicLink()) {
      throw new CustomThumbnailError('Symbolic links are not accepted as thumbnail sources', {
        code: 'UNSAFE_THUMBNAIL_PATH',
        statusCode: 400,
      });
    }
    sourcePath = fs.realpathSync(input);
    stat = fs.statSync(sourcePath);
  } catch (err) {
    if (err instanceof CustomThumbnailError) throw err;
    throw new CustomThumbnailError('Thumbnail source file does not exist', {
      code: 'THUMBNAIL_SOURCE_NOT_FOUND',
      statusCode: 404,
      cause: err,
    });
  }

  if (!stat.isFile()) {
    throw new CustomThumbnailError('Thumbnail source must be a regular file', {
      code: 'INVALID_THUMBNAIL_PATH',
      statusCode: 400,
    });
  }
  if (stat.size <= 0 || stat.size > MAX_SOURCE_BYTES) {
    throw new CustomThumbnailError(`Thumbnail source must be between 1 byte and ${MAX_SOURCE_BYTES} bytes`, {
      code: 'THUMBNAIL_SOURCE_TOO_LARGE',
      statusCode: 413,
    });
  }
  return sourcePath;
}

function targetPaths(library, item) {
  const itemDir = path.resolve(library.rootDir, 'images', `${item.id}.info`);
  const target = path.resolve(itemThumbnailPath(library, item));
  if (target !== itemDir && !target.startsWith(itemDir + path.sep)) {
    throw new CustomThumbnailError('Resolved thumbnail target escapes the item directory', {
      code: 'UNSAFE_THUMBNAIL_TARGET',
      statusCode: 400,
    });
  }
  return { itemDir, target };
}

async function renderCustomThumbnail(sourcePath, tempPath) {
  try {
    const info = await sharp(sourcePath, {
      failOn: 'error',
      limitInputPixels: MAX_DECODED_PIXELS,
      sequentialRead: true,
    })
      .rotate()
      .png({ compressionLevel: 9 })
      .toFile(tempPath);
    if (!info.width || !info.height || info.width * info.height > MAX_DECODED_PIXELS) {
      throw new CustomThumbnailError('Decoded thumbnail dimensions exceed the safety limit', {
        code: 'THUMBNAIL_PIXELS_EXCEEDED',
        statusCode: 413,
      });
    }
    return info;
  } catch (err) {
    if (err instanceof CustomThumbnailError) throw err;
    throw new CustomThumbnailError(`Unable to decode thumbnail image: ${err.message}`, {
      code: 'THUMBNAIL_DECODE_FAILED',
      statusCode: 422,
      cause: err,
    });
  }
}

async function renderOriginalThumbnail(library, item, tempPath, maxSize) {
  const original = itemOriginalPath(library, item);
  if (!fs.existsSync(original) || !fs.statSync(original).isFile()) {
    throw new CustomThumbnailError('Original item file does not exist', {
      code: 'ORIGINAL_FILE_NOT_FOUND',
      statusCode: 404,
    });
  }
  try {
    return await sharp(original, {
      failOn: 'error',
      limitInputPixels: MAX_DECODED_PIXELS,
      sequentialRead: true,
    })
      .rotate()
      .resize({ width: maxSize, height: maxSize, fit: 'inside', withoutEnlargement: true })
      .png({ compressionLevel: 9 })
      .toFile(tempPath);
  } catch (err) {
    throw new CustomThumbnailError(`Unable to regenerate thumbnail from the original file: ${err.message}`, {
      code: 'THUMBNAIL_REGEN_FAILED',
      statusCode: 422,
      cause: err,
    });
  }
}

function restoreItem(item, snapshot) {
  for (const key of Object.keys(item)) delete item[key];
  Object.assign(item, snapshot);
}

function commitThumbnail(library, item, target, tempPath, mutateItem) {
  const snapshot = structuredClone(item);
  const backup = uniqueSibling(target, 'backup');
  const hadTarget = fs.existsSync(target);
  let replacementInstalled = false;
  let backupCanBeRemoved = false;

  try {
    if (hadTarget) fs.renameSync(target, backup);
    if (tempPath) {
      fs.renameSync(tempPath, target);
      replacementInstalled = true;
    }
    mutateItem(item);
    saveItems(library);
    backupCanBeRemoved = true;
  } catch (err) {
    restoreItem(item, snapshot);
    try {
      if (replacementInstalled && fs.existsSync(target)) fs.rmSync(target, { force: true });
      if (hadTarget && fs.existsSync(backup)) fs.renameSync(backup, target);
      backupCanBeRemoved = true;
    } catch (rollbackError) {
      // 回滚失败时保留备份文件，避免 finally 再次扩大数据损失。
      throw new CustomThumbnailError(`Thumbnail update failed and file rollback failed: ${rollbackError.message}`, {
        code: 'THUMBNAIL_ROLLBACK_FAILED',
        statusCode: 500,
        cause: err,
      });
    }
    throw err;
  } finally {
    if (tempPath && fs.existsSync(tempPath)) fs.rmSync(tempPath, { force: true });
    if (backupCanBeRemoved && fs.existsSync(backup)) fs.rmSync(backup, { force: true });
  }
}

export class CustomThumbnailService {
  constructor(options = {}) {
    this.analyze = options.analyze || analyzeImagePalettes;
    this.regenerate = options.regenerate || null;
    this.maxSize = Math.max(1, Number(options.maxSize) || DEFAULT_THUMBNAIL_SIZE);
    this.itemQueues = new Map();
  }

  set(library, params = {}) {
    const itemId = params.id || params.itemID || params.itemId;
    return this.#enqueue(library, itemId, () => this.#set(library, itemId, params));
  }

  reset(library, itemId) {
    return this.#enqueue(library, itemId, () => this.#reset(library, itemId));
  }

  refresh(library, itemId, options = {}) {
    return this.#enqueue(library, itemId, async () => {
      const item = this.#findItem(library, itemId);
      if (item.customThumbnail) {
        const { target } = targetPaths(library, item);
        if (fs.existsSync(target)) return { item, path: target, preservedCustomThumbnail: true };
      }
      if (this.regenerate) {
        const task = await this.regenerate(library, itemId, options);
        return { ...task.result, task: task.id };
      }
      return this.#reset(library, itemId);
    });
  }

  #findItem(library, itemId) {
    if (!itemId) {
      throw new CustomThumbnailError('Item id is required', { code: 'ITEM_ID_REQUIRED', statusCode: 400 });
    }
    const item = library.items.find((entry) => entry.id === itemId);
    if (!item) {
      throw new CustomThumbnailError('Item not found', { code: 'ITEM_NOT_FOUND', statusCode: 404 });
    }
    return item;
  }

  #enqueue(library, itemId, operation) {
    const key = `${path.resolve(library.rootDir)}\0${String(itemId || '')}`;
    const previous = this.itemQueues.get(key) || Promise.resolve();
    const current = previous.catch(() => undefined).then(operation);
    const tracked = current.finally(() => {
      if (this.itemQueues.get(key) === tracked) this.itemQueues.delete(key);
    });
    this.itemQueues.set(key, tracked);
    return tracked;
  }

  async #set(library, itemId, params) {
    const item = this.#findItem(library, itemId);
    const sourcePath = resolveSourceFile(params.thumbnailPath || params.filePath);
    const width = assertFiniteDimension(params.width, 'width');
    const height = assertFiniteDimension(params.height, 'height');
    const { itemDir, target } = targetPaths(library, item);
    fs.mkdirSync(itemDir, { recursive: true });
    const tempPath = uniqueSibling(target, 'pending');

    const info = await renderCustomThumbnail(sourcePath, tempPath);
    const palettes = await this.analyze(tempPath);
    commitThumbnail(library, item, target, tempPath, (current) => {
      current.width = width || info.width || current.width;
      current.height = height || info.height || current.height;
      current.customThumbnail = true;
      current.palettes = palettes;
      current.lastModified = Date.now();
      delete current.noThumbnail;
      delete current.noPreview;
      delete current.processingPalette;
    });
    return { item, path: target, palettes };
  }

  async #reset(library, itemId) {
    const item = this.#findItem(library, itemId);
    const { itemDir, target } = targetPaths(library, item);
    fs.mkdirSync(itemDir, { recursive: true });
    const tempPath = uniqueSibling(target, 'pending');
    const extension = String(item.ext || '').toLowerCase();
    let info = null;
    let palettes = null;

    if (SHARP_REFRESH_EXTENSIONS.has(extension)) {
      info = await renderOriginalThumbnail(library, item, tempPath, this.maxSize);
      palettes = await this.analyze(tempPath);
    } else if (this.regenerate) {
      if (fs.existsSync(tempPath)) fs.rmSync(tempPath, { force: true });
      const task = await this.regenerate(library, itemId);
      return { ...task.result, customThumbnail: false, task: task.id };
    }

    commitThumbnail(library, item, target, info ? tempPath : null, (current) => {
      delete current.customThumbnail;
      delete current.processingPalette;
      current.lastModified = Date.now();
      if (info) {
        current.width = info.width || current.width;
        current.height = info.height || current.height;
        current.palettes = palettes;
        delete current.noThumbnail;
        delete current.noPreview;
      } else {
        delete current.width;
        delete current.height;
        delete current.palettes;
        current.noThumbnail = true;
        current.noPreview = true;
      }
    });
    return { item, path: info ? target : null, palettes, customThumbnail: false };
  }
}
