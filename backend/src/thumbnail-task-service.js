import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { analyzeImagePalettes } from './color-analyzer.js';
import { itemOriginalPath, itemThumbnailPath, saveItems } from './library-store.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '../..');
const electronBinary = path.resolve(projectRoot, 'node_modules/electron/dist/electron.exe');
const pdfWorker = path.resolve(projectRoot, 'electron/pdf-thumbnail-worker.cjs');
const videoWorker = path.resolve(projectRoot, 'electron/video-thumbnail-worker.cjs');
const DEFAULT_CONCURRENCY = 3;
const DEFAULT_TIMEOUT_MS = 100_000;
const DEFAULT_MAX_SIZE = 480;
const MAX_SOURCE_BYTES = 100_000_000;
const MAX_VIDEO_SOURCE_BYTES = 2_000_000_000;
const MAX_DECODED_PIXELS = 30_000_000;
const SHARP_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'tif', 'tiff', 'avif', 'heic', 'heif']);
const VIDEO_EXTENSIONS = new Set(['mp4', 'webm']);
const PRIMARY_EXTENSIONS = new Set(['svg', 'gif', 'webp', 'tif', 'tiff', 'pdf', ...VIDEO_EXTENSIONS]);

export class ThumbnailTaskError extends Error {
  constructor(message, options = {}) {
    super(message, options);
    this.name = 'ThumbnailTaskError';
    this.code = options.code || 'THUMBNAIL_GENERATION_FAILED';
    this.statusCode = options.statusCode || 422;
  }
}

function snapshotTask(task) {
  return {
    id: task.id,
    itemId: task.itemId,
    format: task.format,
    status: task.status,
    progress: task.progress,
    createdAt: task.createdAt,
    startedAt: task.startedAt || null,
    completedAt: task.completedAt || null,
    error: task.error || null,
    code: task.code || null,
    result: task.result || null,
    cancelRequested: task.cancelRequested === true,
  };
}

function uniqueSibling(filePath, label) {
  return `${filePath}.${label}-${process.pid}-${crypto.randomUUID()}`;
}

function assertItem(library, itemId) {
  if (!itemId) throw new ThumbnailTaskError('Item id is required', { code: 'ITEM_ID_REQUIRED', statusCode: 400 });
  const item = library.items.find((entry) => entry.id === itemId);
  if (!item) throw new ThumbnailTaskError('Item not found', { code: 'ITEM_NOT_FOUND', statusCode: 404 });
  return item;
}

function assertSource(library, item) {
  const source = itemOriginalPath(library, item);
  let stat;
  try {
    stat = fs.statSync(source);
  } catch (err) {
    throw new ThumbnailTaskError('Original item file does not exist', {
      code: 'ORIGINAL_FILE_NOT_FOUND',
      statusCode: 404,
      cause: err,
    });
  }
  if (!stat.isFile()) throw new ThumbnailTaskError('Original item source must be a regular file', { code: 'INVALID_ITEM_SOURCE', statusCode: 400 });
  if (stat.size <= 0) throw new ThumbnailTaskError('Original item source is empty', { code: 'EMPTY_ITEM_SOURCE', statusCode: 422 });
  const maxSourceBytes = VIDEO_EXTENSIONS.has(String(item.ext || '').toLowerCase()) ? MAX_VIDEO_SOURCE_BYTES : MAX_SOURCE_BYTES;
  if (stat.size > maxSourceBytes) throw new ThumbnailTaskError(`Original item source exceeds ${maxSourceBytes} bytes`, { code: 'THUMBNAIL_SOURCE_TOO_LARGE', statusCode: 413 });
  return source;
}

function restoreItem(item, snapshot) {
  for (const key of Object.keys(item)) delete item[key];
  Object.assign(item, snapshot);
}

function commitThumbnail(library, item, target, pending, patch) {
  const snapshot = structuredClone(item);
  const backup = uniqueSibling(target, 'backup');
  const hadTarget = fs.existsSync(target);
  let replacementInstalled = false;
  let backupCanBeRemoved = false;
  try {
    if (hadTarget) fs.renameSync(target, backup);
    fs.renameSync(pending, target);
    replacementInstalled = true;
    const clearCustomThumbnail = patch.clearCustomThumbnail === true;
    const itemPatch = { ...patch };
    delete itemPatch.clearCustomThumbnail;
    Object.assign(item, itemPatch, { lastModified: Date.now() });
    delete item.noThumbnail;
    delete item.noPreview;
    delete item.thumbnailError;
    delete item.thumbnailTask;
    delete item.processingThumbnail;
    if (clearCustomThumbnail) delete item.customThumbnail;
    saveItems(library);
    backupCanBeRemoved = true;
  } catch (err) {
    restoreItem(item, snapshot);
    try {
      if (replacementInstalled && fs.existsSync(target)) fs.rmSync(target, { force: true });
      if (hadTarget && fs.existsSync(backup)) fs.renameSync(backup, target);
      backupCanBeRemoved = true;
    } catch (rollbackError) {
      throw new ThumbnailTaskError(`Thumbnail update failed and rollback failed: ${rollbackError.message}`, {
        code: 'THUMBNAIL_ROLLBACK_FAILED',
        statusCode: 500,
        cause: err,
      });
    }
    throw err;
  } finally {
    if (fs.existsSync(pending)) fs.rmSync(pending, { force: true });
    if (backupCanBeRemoved && fs.existsSync(backup)) fs.rmSync(backup, { force: true });
  }
}

async function renderSharp(source, output, maxSize, extension) {
  try {
    const image = sharp(source, {
      animated: false,
      failOn: 'error',
      limitInputPixels: MAX_DECODED_PIXELS,
      pages: 1,
      sequentialRead: true,
    });
    const metadata = await image.metadata();
    if (!metadata.width || !metadata.height || metadata.width * metadata.height > MAX_DECODED_PIXELS) {
      throw new ThumbnailTaskError('Decoded image dimensions exceed the safety limit', {
        code: 'THUMBNAIL_PIXELS_EXCEEDED',
        statusCode: 413,
      });
    }
    const result = await image
      .rotate()
      .resize({ width: maxSize, height: maxSize, fit: 'inside', withoutEnlargement: true })
      .png({ compressionLevel: 9 })
      .toFile(output);
    return {
      width: metadata.width,
      height: metadata.height,
      pages: metadata.pages || 1,
      animated: (extension === 'gif' || extension === 'webp') && Number(metadata.pages || 1) > 1,
      thumbnailWidth: result.width,
      thumbnailHeight: result.height,
    };
  } catch (err) {
    if (err instanceof ThumbnailTaskError) throw err;
    throw new ThumbnailTaskError(`Unable to decode ${extension.toUpperCase()} thumbnail source: ${err.message}`, {
      code: 'THUMBNAIL_DECODE_FAILED',
      statusCode: 422,
      cause: err,
    });
  }
}

function renderElectronWorker({ worker, envKey, options, label, unavailableCode, startFailedCode, failedCode, onChild }) {
  if (!fs.existsSync(electronBinary) || !fs.existsSync(worker)) {
    return Promise.reject(new ThumbnailTaskError(`${label} thumbnail renderer is unavailable`, {
      code: unavailableCode,
      statusCode: 501,
    }));
  }
  return new Promise((resolve, reject) => {
    const env = { ...process.env };
    delete env.ELECTRON_RUN_AS_NODE;
    delete env.NODE_OPTIONS;
    env[envKey] = JSON.stringify(options);
    const child = fork(worker, [], {
      execPath: electronBinary,
      cwd: projectRoot,
      env,
      stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
    });
    onChild(child);
    let stderr = '';
    let settled = false;
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('message', (message) => {
      if (settled) return;
      settled = true;
      onChild(null);
      if (!child.killed) child.kill();
      if (message?.ok) resolve(message.result);
      else reject(new ThumbnailTaskError(`Unable to render ${label} thumbnail: ${message?.error || 'Unknown renderer failure'}`, {
        code: message?.code || failedCode,
        statusCode: message?.code === 'THUMBNAIL_PIXELS_EXCEEDED' ? 413 : 422,
      }));
    });
    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      onChild(null);
      reject(new ThumbnailTaskError(`Unable to start ${label} thumbnail renderer: ${err.message}`, {
        code: startFailedCode,
        statusCode: 500,
        cause: err,
      }));
    });
    child.on('exit', (code) => {
      onChild(null);
      if (settled) return;
      settled = true;
      reject(new ThumbnailTaskError(`${label} thumbnail renderer exited with code ${code}${stderr ? `: ${stderr.trim()}` : ''}`, {
        code: failedCode,
        statusCode: 422,
      }));
    });
  });
}

function renderPdf(source, output, maxSize, onChild) {
  return renderElectronWorker({
    worker: pdfWorker,
    envKey: 'EAGLE_PDF_THUMBNAIL_OPTIONS',
    options: { source, output, maxSize, maxImagePixels: MAX_DECODED_PIXELS },
    label: 'PDF first page',
    unavailableCode: 'PDF_RENDERER_UNAVAILABLE',
    startFailedCode: 'PDF_RENDERER_FAILED',
    failedCode: 'PDF_RENDER_FAILED',
    onChild,
  });
}

function renderVideo(source, output, maxSize, startAt, onChild) {
  return renderElectronWorker({
    worker: videoWorker,
    envKey: 'EAGLE_VIDEO_THUMBNAIL_OPTIONS',
    options: { source, output, maxSize, maxImagePixels: MAX_DECODED_PIXELS, startAt },
    label: 'video frame',
    unavailableCode: 'VIDEO_RENDERER_UNAVAILABLE',
    startFailedCode: 'VIDEO_RENDERER_FAILED',
    failedCode: 'VIDEO_RENDER_FAILED',
    onChild,
  });
}

export class ThumbnailTaskService {
  constructor(options = {}) {
    const concurrency = Number(options.concurrency);
    const timeoutMs = Number(options.timeoutMs);
    const maxSize = Number(options.maxSize);
    this.concurrency = Math.max(1, Number.isFinite(concurrency) ? concurrency : DEFAULT_CONCURRENCY);
    this.timeoutMs = Math.max(1, Number.isFinite(timeoutMs) ? timeoutMs : DEFAULT_TIMEOUT_MS);
    this.maxSize = Math.max(1, Number.isFinite(maxSize) ? maxSize : DEFAULT_MAX_SIZE);
    this.analyze = options.analyze || analyzeImagePalettes;
    this.render = options.render || null;
    this.pending = [];
    this.active = 0;
    this.tasks = new Map();
    this.itemQueues = new Set();
  }

  status(taskId) {
    if (taskId) {
      const task = this.tasks.get(taskId);
      if (!task) throw new ThumbnailTaskError('Thumbnail task not found', { code: 'THUMBNAIL_TASK_NOT_FOUND', statusCode: 404 });
      return snapshotTask(task);
    }
    return {
      concurrency: this.concurrency,
      timeoutMs: this.timeoutMs,
      maxSize: this.maxSize,
      active: this.active,
      pending: this.pending.length,
      length: this.active + this.pending.length,
      tasks: [...this.tasks.values()].map(snapshotTask),
    };
  }

  enqueue(library, itemId, options = {}) {
    const item = assertItem(library, itemId);
    const key = `${path.resolve(library.rootDir)}\0${item.id}`;
    if (this.itemQueues.has(key)) {
      throw new ThumbnailTaskError('A thumbnail task is already queued for this item', {
        code: 'THUMBNAIL_TASK_CONFLICT',
        statusCode: 409,
      });
    }
    const extension = String(item.ext || '').toLowerCase();
    if (!SHARP_EXTENSIONS.has(extension) && extension !== 'pdf' && !VIDEO_EXTENSIONS.has(extension)) {
      throw new ThumbnailTaskError(`Thumbnail format is not supported: ${extension || 'unknown'}`, {
        code: 'THUMBNAIL_FORMAT_UNSUPPORTED',
        statusCode: 415,
      });
    }
    const task = {
      id: `THUMB-${Date.now()}-${crypto.randomUUID()}`,
      library,
      itemId: item.id,
      itemKey: key,
      format: extension,
      status: 'queued',
      progress: 0,
      createdAt: Date.now(),
      cancelRequested: false,
      child: null,
      options,
    };
    this.tasks.set(task.id, task);
    this.itemQueues.add(key);
    item.processingThumbnail = true;
    item.thumbnailTask = task.id;
    delete item.thumbnailError;
    saveItems(library);
    this.pending.push(task);
    this.#drain();
    return snapshotTask(task);
  }

  wait(taskId) {
    const task = this.tasks.get(taskId);
    if (!task) return Promise.reject(new ThumbnailTaskError('Thumbnail task not found', { code: 'THUMBNAIL_TASK_NOT_FOUND', statusCode: 404 }));
    if (task.status === 'complete') return Promise.resolve(snapshotTask(task));
    if (task.status === 'failed' || task.status === 'cancelled') {
      return Promise.reject(new ThumbnailTaskError(task.error || 'Thumbnail task failed', {
        code: task.code || 'THUMBNAIL_GENERATION_FAILED',
        statusCode: task.status === 'cancelled' ? 409 : 422,
      }));
    }
    return new Promise((resolve, reject) => {
      task.listeners ||= [];
      task.listeners.push({ resolve, reject });
    });
  }

  cancel(taskId) {
    const task = this.tasks.get(taskId);
    if (!task) throw new ThumbnailTaskError('Thumbnail task not found', { code: 'THUMBNAIL_TASK_NOT_FOUND', statusCode: 404 });
    if (['complete', 'failed', 'cancelled'].includes(task.status)) return snapshotTask(task);
    task.cancelRequested = true;
    if (task.status === 'queued') {
      this.pending = this.pending.filter((entry) => entry.id !== task.id);
      this.#finishCancelled(task);
    } else if (task.child && !task.child.killed) {
      task.child.kill();
    }
    return snapshotTask(task);
  }

  async generate(library, itemId, options = {}) {
    const task = this.enqueue(library, itemId, options);
    return this.wait(task.id);
  }

  supports(extension) {
    const normalized = String(extension || '').toLowerCase();
    return SHARP_EXTENSIONS.has(normalized) || normalized === 'pdf' || VIDEO_EXTENSIONS.has(normalized);
  }

  primaryFormats() {
    return [...PRIMARY_EXTENSIONS];
  }

  recover(library) {
    let changed = false;
    for (const item of library.items) {
      if (!item.processingThumbnail && !item.thumbnailTask) continue;
      delete item.processingThumbnail;
      delete item.thumbnailTask;
      item.thumbnailError = 'THUMBNAIL_TASK_INTERRUPTED';
      changed = true;
    }
    if (changed) saveItems(library);
    return changed;
  }

  #drain() {
    while (this.active < this.concurrency && this.pending.length > 0) {
      const task = this.pending.shift();
      if (task.cancelRequested) {
        this.#finishCancelled(task);
        continue;
      }
      this.active += 1;
      this.#run(task);
    }
  }

  async #run(task) {
    task.status = 'running';
    task.progress = 10;
    task.startedAt = Date.now();
    let timeout;
    try {
      const item = assertItem(task.library, task.itemId);
      const source = assertSource(task.library, item);
      const target = itemThumbnailPath(task.library, item);
      const pending = uniqueSibling(target, 'pending');
      task.pendingPath = pending;
      fs.mkdirSync(path.dirname(target), { recursive: true });
      const execution = Promise.resolve(this.#render(task, source, pending));
      execution.finally(() => {
        if (['failed', 'cancelled'].includes(task.status) && fs.existsSync(pending)) fs.rmSync(pending, { force: true });
      }).catch(() => undefined);
      const timeoutPromise = new Promise((resolve, reject) => {
        timeout = setTimeout(() => {
          task.cancelRequested = true;
          if (task.child && !task.child.killed) task.child.kill();
          reject(new ThumbnailTaskError(`Thumbnail generation timed out after ${this.timeoutMs} ms`, {
            code: 'THUMBNAIL_TIMEOUT',
            statusCode: 504,
          }));
        }, this.timeoutMs);
      });
      const info = await Promise.race([execution, timeoutPromise]);
      clearTimeout(timeout);
      if (task.cancelRequested) throw new ThumbnailTaskError('Thumbnail task was cancelled', { code: 'THUMBNAIL_CANCELLED', statusCode: 409 });
      task.progress = 75;
      const palettes = await this.analyze(pending);
      if (task.cancelRequested) throw new ThumbnailTaskError('Thumbnail task was cancelled', { code: 'THUMBNAIL_CANCELLED', statusCode: 409 });
      commitThumbnail(task.library, item, target, pending, {
        width: info.width || item.width,
        height: info.height || item.height,
        palettes,
        clearCustomThumbnail: task.options.clearCustomThumbnail === true,
        ...(info.animated ? { animated: true } : {}),
        ...(info.pages ? { pages: info.pages } : {}),
        ...(Number.isFinite(info.duration) ? { duration: info.duration } : {}),
        ...(Number.isFinite(info.startAt) ? { thumbnailAt: info.startAt } : {}),
        ...(VIDEO_EXTENSIONS.has(task.format) ? {
          resolutionWidth: info.width || item.resolutionWidth || item.width,
          resolutionHeight: info.height || item.resolutionHeight || item.height,
        } : {}),
      });
      task.status = 'complete';
      task.progress = 100;
      task.completedAt = Date.now();
      task.result = { item, path: target, palettes, format: task.format };
      this.#resolve(task);
    } catch (err) {
      clearTimeout(timeout);
      if (err.code === 'THUMBNAIL_TIMEOUT') this.#finishFailed(task, err);
      else if (task.cancelRequested || err.code === 'THUMBNAIL_CANCELLED') this.#finishCancelled(task, err);
      else this.#finishFailed(task, err);
    } finally {
      if (task.pendingPath && fs.existsSync(task.pendingPath)) fs.rmSync(task.pendingPath, { force: true });
      delete task.pendingPath;
      this.active -= 1;
      this.itemQueues.delete(task.itemKey);
      this.#drain();
    }
  }

  async #render(task, source, output) {
    if (this.render) return this.render({ task, source, output, maxSize: task.options.maxSize || this.maxSize });
    if (task.format === 'pdf') {
      return renderPdf(source, output, task.options.maxSize || this.maxSize, (child) => { task.child = child; });
    }
    if (VIDEO_EXTENSIONS.has(task.format)) {
      return renderVideo(source, output, task.options.maxSize || this.maxSize, task.options.startAt, (child) => { task.child = child; });
    }
    return renderSharp(source, output, task.options.maxSize || this.maxSize, task.format);
  }

  #finishCancelled(task, cause) {
    task.status = 'cancelled';
    task.completedAt = Date.now();
    task.error = cause?.message || 'Thumbnail task was cancelled';
    task.code = 'THUMBNAIL_CANCELLED';
    this.itemQueues.delete(task.itemKey);
    this.#cleanupItemState(task, true);
    this.#reject(task, new ThumbnailTaskError(task.error, { code: task.code, statusCode: 409 }));
  }

  #finishFailed(task, cause) {
    const error = cause instanceof ThumbnailTaskError ? cause : new ThumbnailTaskError(cause.message, { cause });
    task.status = 'failed';
    task.completedAt = Date.now();
    task.error = error.message;
    task.code = error.code;
    this.#cleanupItemState(task, false);
    this.#reject(task, error);
  }

  #cleanupItemState(task, cancelled) {
    const item = task.library.items.find((entry) => entry.id === task.itemId);
    if (!item) return;
    delete item.processingThumbnail;
    delete item.thumbnailTask;
    if (!cancelled) item.thumbnailError = task.code;
    try {
      saveItems(task.library);
    } catch (err) {
      task.error = `${task.error}; state persistence failed: ${err.message}`;
      task.code = 'THUMBNAIL_PERSIST_FAILED';
    }
  }

  #resolve(task) {
    for (const listener of task.listeners || []) listener.resolve(snapshotTask(task));
    task.listeners = [];
  }

  #reject(task, error) {
    for (const listener of task.listeners || []) listener.reject(error);
    task.listeners = [];
  }
}
