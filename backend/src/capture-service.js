import { DownloadError } from './controlled-downloader.js';
import { importBase64, importBookmark, importUrl } from './importer.js';

const DEFAULT_MAX_BATCH_ITEMS = 200;
const DEFAULT_SCREENSHOT_BYTES = 30 * 1024 * 1024;

export class CaptureError extends Error {
  constructor(message, code = 'INVALID_CAPTURE_REQUEST', statusCode = 400, detail = '') {
    super(message);
    this.name = 'CaptureError';
    this.code = code;
    this.statusCode = statusCode;
    this.detail = detail;
  }
}

function cleanString(value, fallback = '') {
  const text = String(value === null || value === undefined ? '' : value).trim();
  return text || fallback;
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isDataUri(value) {
  return /^data:image\/[^;,]+(;base64)?,/i.test(String(value || ''));
}

function isHttpUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch (err) {
    return false;
  }
}

function isLocalPath(value) {
  const text = String(value || '').trim();
  if (!text) return false;
  if (/^[a-zA-Z]:[\\/]/.test(text)) return true;
  if (/^(\\\\|\/\/)/.test(text)) return true;
  if (/^file:/i.test(text)) return true;
  return false;
}

function normalizeBase64(value, ext) {
  const text = String(value || '').trim();
  if (!text) throw new CaptureError('Image data is required', 'INVALID_IMAGE_DATA', 400);
  if (isDataUri(text)) return text;
  const safeExt = /^[a-z0-9]{1,10}$/i.test(String(ext || '')) ? String(ext).toLowerCase() : 'png';
  return `data:image/${safeExt === 'jpg' ? 'jpeg' : safeExt};base64,${text}`;
}

function parseStringArray(value) {
  if (Array.isArray(value)) return value.map((entry) => cleanString(entry)).filter(Boolean);
  if (value === null || value === undefined || value === '') return [];
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed.map((entry) => cleanString(entry)).filter(Boolean);
    } catch (err) {
      // Fall through to comma-separated parsing.
    }
    return trimmed.split(',').map((entry) => cleanString(entry)).filter(Boolean);
  }
  return [];
}

function parseIndexedCollection(body, key) {
  const prefix = `${key}[`;
  const result = [];
  for (const [name, value] of Object.entries(body || {})) {
    if (!name.startsWith(prefix)) continue;
    const match = /^[^[]+\[(\d+)\]$/.exec(name);
    if (match) {
      result[Number(match[1])] = value;
      continue;
    }
    const objectMatch = /^[^[]+\[(\d+)\]\[([^\]]+)\]$/.exec(name);
    if (objectMatch) {
      const index = Number(objectMatch[1]);
      result[index] = result[index] || {};
      result[index][objectMatch[2]] = value;
    }
  }
  return result.filter((entry) => entry !== undefined);
}

function parseCollection(body, keys) {
  for (const key of keys) {
    if (Array.isArray(body[key])) return body[key];
    const indexed = parseIndexedCollection(body, key);
    if (indexed.length > 0) return indexed;
    if (typeof body[key] === 'string' && body[key].trim()) {
      try {
        const parsed = JSON.parse(body[key]);
        if (Array.isArray(parsed)) return parsed;
      } catch (err) {
        return body[key].split(',').map((value) => value.trim()).filter(Boolean);
      }
    }
  }
  return [];
}

function parseFolderIds(body) {
  const ids = parseCollection(body, ['folderIDs']);
  if (ids.length > 0) return ids;
  const plural = parseCollection(body, ['folders']);
  if (plural.length > 0) return plural;
  const singular = cleanString(body.folderID || body.folderId);
  return singular ? [singular] : [];
}

function parseTagList(body) {
  const indexed = parseCollection(body, ['tags']);
  return parseStringArray(indexed.length > 0 ? indexed : body.tags);
}

function parseHeaders(body) {
  const raw = body && (body.headers || body.requestHeaders);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return raw;
}

function itemMeta(body = {}, fallback = {}) {
  return {
    name: cleanString(body.title || body.name || fallback.name, 'Collected Image'),
    url: cleanString(body.url || fallback.url),
    website: cleanString(body.website || body.pageUrl || body.page_url || fallback.website),
    annotation: cleanString(body.annotation || body.note || fallback.annotation),
    tags: parseTagList(body).length > 0 ? parseTagList(body) : parseTagList(fallback),
    folders: parseFolderIds(body).length > 0 ? parseFolderIds(body) : parseFolderIds(fallback),
    star: toNumber(body.star === undefined || body.star === null || body.star === '' ? fallback.star : body.star),
    headers: parseHeaders(body),
    referer: cleanString(body.referer),
    userAgent: cleanString(body.userAgent || body.user_agent),
    modificationTime: toNumber(body.modificationTime),
    ext: cleanString(body.ext || fallback.ext),
    mime: cleanString(body.mime),
  };
}

function normalizeBatchItems(body) {
  const rawItems = parseCollection(body, ['items', 'images']);
  const global = { ...(body || {}) };
  delete global.images;
  delete global.items;
  return rawItems.map((entry, index) => {
    if (typeof entry === 'string') {
      const merged = { ...global, src: entry, name: cleanString(global.title || global.name, `Captured ${index + 1}`) };
      return merged;
    }
    if (entry && typeof entry === 'object') {
      const merged = { ...global, ...entry };
      delete merged.images;
      delete merged.items;
      const meta = itemMeta(merged);
      return {
        ...merged,
        name: meta.name,
        url: meta.url,
        website: meta.website,
        annotation: meta.annotation,
        tags: meta.tags,
        folders: meta.folders,
        star: meta.star,
        headers: meta.headers,
        referer: meta.referer,
        userAgent: meta.userAgent,
      };
    }
    return null;
  }).filter(Boolean);
}

function normalizeCaptureRequest(body = {}) {
  const type = cleanString(body.type).toLowerCase();
  const batchItems = normalizeBatchItems(body);
  if (batchItems.length > 0) {
    return { kind: 'batch', type, items: batchItems };
  }

  const src = cleanString(body.src);
  const base64 = cleanString(body.base64 || body.base64data);
  const url = cleanString(body.url || body.href);

  if (type === 'save-url' || type === 'bookmark' || type === 'url') {
    return { kind: 'bookmark', type, url: cleanString(body.url || body.href || src), meta: itemMeta(body) };
  }
  if (type === 'screencapture' || type === 'screenshot' || (base64 && !isHttpUrl(base64))) {
    const data = normalizeBase64(base64 || src, body.ext);
    return { kind: 'image-data', type, data, meta: itemMeta(body) };
  }
  if (src && isDataUri(src)) {
    return { kind: 'image-data', type, data: src, meta: itemMeta(body) };
  }
  if (src && isHttpUrl(src)) {
    return { kind: 'remote-image', type, url: src, meta: itemMeta(body) };
  }
  if (url && isHttpUrl(url) && (type === 'image' || type === 'addurl' || !type)) {
    return { kind: 'remote-image', type, url, meta: itemMeta(body) };
  }
  if (url) {
    return { kind: 'bookmark', type, url, meta: itemMeta(body) };
  }
  throw new CaptureError('Capture request must contain image data, an HTTP URL, or a bookmark URL', 'INVALID_CAPTURE_REQUEST', 400);
}

function assertNoLocalPath(value) {
  if (isLocalPath(value)) {
    throw new CaptureError('Local paths and file URLs are not allowed in browser capture requests', 'INVALID_CAPTURE_REQUEST', 400);
  }
}

function errorCode(err) {
  if (err && err.code) return err.code;
  return 'CAPTURE_FAILED';
}

function errorMessage(err) {
  return err && err.message ? err.message : 'Capture failed';
}

function errorDetail(err) {
  return err && err.detail ? err.detail : '';
}

function captureDownloadCode(code) {
  if (code === 'HTTP_ERROR') return 'DOWNLOAD_HTTP_ERROR';
  if (code === 'TASK_CANCEL') return 'CAPTURE_CANCELLED';
  if (code === 'IMAGE_DECODE_FAILED') return 'INVALID_IMAGE_DATA';
  return code;
}

export class CaptureService {
  constructor(options = {}) {
    this.downloadService = options.downloadService;
    this.maxBatchItems = Number(options.maxBatchItems) || DEFAULT_MAX_BATCH_ITEMS;
    this.screenshotLimitBytes = Number(options.screenshotLimitBytes) || DEFAULT_SCREENSHOT_BYTES;
    this.tasks = new Map();
  }

  async captureSingle(library, body = {}) {
    const normalized = normalizeCaptureRequest(body);
    if (normalized.kind === 'bookmark') {
      const meta = normalized.meta;
      assertNoLocalPath(normalized.url);
      try {
        return importBookmark(library, {
          name: meta.name,
          url: normalized.url,
          website: meta.website,
          annotation: meta.annotation,
          tags: meta.tags,
          folders: meta.folders,
          star: meta.star,
        });
      } catch (err) {
        throw new CaptureError(errorMessage(err), errorCode(err), 400, errorDetail(err));
      }
    }

    if (normalized.kind === 'image-data') {
      const meta = normalized.meta;
      if (Buffer.byteLength(normalized.data, 'utf8') > this.screenshotLimitBytes * 1.35) {
        throw new CaptureError('Capture image data is too large', 'REQUEST_TOO_LARGE', 413);
      }
      try {
        return importBase64(library, normalized.data, {
          name: meta.name,
          ext: meta.ext,
          url: meta.url,
          website: meta.website,
          annotation: meta.annotation,
          tags: meta.tags,
          folderIDs: meta.folders,
          star: meta.star,
          modificationTime: meta.modificationTime,
        });
      } catch (err) {
        if (err instanceof CaptureError) throw err;
        throw new CaptureError(errorMessage(err), 'INVALID_IMAGE_DATA', 422, errorDetail(err));
      }
    }

    if (normalized.kind === 'remote-image') {
      const meta = normalized.meta;
      assertNoLocalPath(normalized.url);
      try {
        return await importUrl(library, normalized.url, {
          name: meta.name,
          website: meta.website,
          annotation: meta.annotation,
          tags: meta.tags,
          folderIDs: meta.folders,
          star: meta.star,
          modificationTime: meta.modificationTime,
          headers: meta.headers,
          referer: meta.referer || meta.website,
          userAgent: meta.userAgent,
          downloadService: this.downloadService,
          validateImage: true,
        });
      } catch (err) {
        if (err instanceof DownloadError) {
          throw new CaptureError(errorMessage(err), captureDownloadCode(errorCode(err)), err.statusCode || 502, errorDetail(err));
        }
        throw new CaptureError(errorMessage(err), errorCode(err), 502, errorDetail(err));
      }
    }

    throw new CaptureError('Unsupported capture request', 'UNSUPPORTED_CAPTURE_TYPE', 400);
  }

  startBatch(library, body = {}) {
    const normalized = normalizeCaptureRequest(body);
    if (normalized.kind !== 'batch') {
      throw new CaptureError('Batch capture requires items or images', 'INVALID_CAPTURE_REQUEST', 400);
    }
    const items = normalized.items.slice(0, this.maxBatchItems);
    if (items.length === 0) {
      throw new CaptureError('Batch capture requires at least one item', 'INVALID_CAPTURE_REQUEST', 400);
    }
    const now = Date.now();
    const job = {
      id: `CAPTURE-${now}-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
      status: 'queued',
      progress: 0,
      message: 'Capture queued',
      createdAt: now,
      updatedAt: now,
      startedAt: null,
      completedAt: null,
      cancelled: false,
      result: {
        items: [],
        errors: [],
        total: items.length,
        cancelled: false,
        status: 'queued',
      },
      promise: null,
      resolve: null,
    };
    job.promise = new Promise((resolve) => {
      job.resolve = resolve;
    });
    this.tasks.set(job.id, job);
    this.#runBatch(job, library, items).catch(() => {});
    return this.task(job.id);
  }

  awaitJob(id) {
    const job = this.tasks.get(String(id || ''));
    if (!job) return null;
    if (job.promise) return job.promise;
    return Promise.resolve(this.task(job.id));
  }

  task(id) {
    const job = this.tasks.get(String(id || ''));
    if (!job) return null;
    return {
      id: job.id,
      status: job.status,
      progress: job.progress,
      message: job.message,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      cancelled: job.cancelled,
      result: job.result,
    };
  }

  cancel(id) {
    const job = this.tasks.get(String(id || ''));
    if (!job || ['complete', 'failed', 'partial', 'cancelled'].includes(job.status)) return false;
    job.cancelled = true;
    job.status = 'cancelled';
    job.message = 'Capture cancelled';
    job.completedAt = Date.now();
    job.updatedAt = job.completedAt;
    if (job.result) {
      job.result.cancelled = true;
      job.result.status = 'cancelled';
    }
    if (job.resolve) job.resolve(this.task(job.id));
    return true;
  }

  status() {
    return [...this.tasks.values()].map((job) => this.task(job.id));
  }

  async #runBatch(job, library, items) {
    job.status = 'running';
    job.startedAt = Date.now();
    job.updatedAt = job.startedAt;
    job.message = 'Capturing items';
    const result = {
      items: [],
      errors: [],
      total: items.length,
      cancelled: false,
      status: 'running',
    };
    for (let index = 0; index < items.length; index += 1) {
      if (job.cancelled) break;
      const entry = items[index];
      try {
        const item = await this.captureSingle(library, entry);
        result.items.push(item);
      } catch (err) {
        result.errors.push({
          index,
          url: cleanString(entry.url || entry.src),
          code: captureDownloadCode(errorCode(err)),
          message: errorMessage(err),
        });
      }
      job.result = {
        items: result.items.slice(),
        errors: result.errors.slice(),
        total: result.total,
        cancelled: job.cancelled,
        status: 'running',
      };
      job.progress = Math.round(((index + 1) / items.length) * 100);
      job.updatedAt = Date.now();
      await new Promise((resolve) => setImmediate(resolve));
    }
    const cancelled = job.cancelled;
    const status = cancelled
      ? 'cancelled'
      : result.errors.length === 0
        ? 'complete'
        : result.items.length > 0
          ? 'partial'
          : 'failed';
    job.status = status;
    job.progress = cancelled ? job.progress : 100;
    job.completedAt = Date.now();
    job.updatedAt = job.completedAt;
    job.message = cancelled ? 'Capture cancelled' : status === 'complete' ? 'Capture complete' : 'Capture completed with errors';
    result.cancelled = cancelled;
    result.status = status;
    job.result = result;
    if (job.resolve) job.resolve(this.task(job.id));
  }
}
