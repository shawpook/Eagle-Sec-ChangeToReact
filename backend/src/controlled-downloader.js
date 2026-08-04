import dns from 'node:dns';
import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import sharp from 'sharp';

const DEFAULT_CONCURRENCY = 5;
const DEFAULT_TIMEOUT_MS = 300_000;
const DEFAULT_MAX_BYTES = 100 * 1024 * 1024;
const DEFAULT_MAX_REDIRECTS = 5;
const DEFAULT_LEASE_MS = 10 * 60 * 1000;
const BLOCKED_HOSTNAMES = new Set(['localhost', 'localhost.localdomain', 'metadata.google.internal']);
const ALLOWED_HEADERS = new Set(['accept', 'accept-language', 'referer', 'user-agent']);

export class DownloadError extends Error {
  constructor(message, options = {}) {
    super(message, options.cause ? { cause: options.cause } : undefined);
    this.name = 'DownloadError';
    this.code = options.code || 'DOWNLOAD_FAILED';
    this.statusCode = options.statusCode || 502;
    this.detail = options.detail || '';
    this.url = options.url || '';
  }
}

function parseIpv4(address) {
  const parts = String(address).split('.').map(Number);
  return parts.length === 4 && parts.every((part) => Number.isInteger(part) && part >= 0 && part <= 255) ? parts : null;
}

function isBlockedIpv4(address) {
  const parts = parseIpv4(address);
  if (!parts) return true;
  const [a, b, c] = parts;
  return a === 0
    || a === 10
    || a === 127
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 0 && c === 0)
    || (a === 192 && b === 0 && c === 2)
    || (a === 192 && b === 88 && c === 99)
    || (a === 192 && b === 168)
    || (a === 198 && (b === 18 || b === 19))
    || (a === 198 && b === 51 && c === 100)
    || (a === 203 && b === 0 && c === 113)
    || a >= 224;
}

function normalizeIpv6(address) {
  return String(address).toLowerCase().split('%')[0];
}

function mappedIpv4(address) {
  const value = normalizeIpv6(address);
  const dotted = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(value);
  if (dotted) return dotted[1];
  const hex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(value);
  if (!hex) return null;
  const high = Number.parseInt(hex[1], 16);
  const low = Number.parseInt(hex[2], 16);
  return `${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`;
}

export function isBlockedAddress(address) {
  const family = net.isIP(address);
  if (family === 4) return isBlockedIpv4(address);
  if (family !== 6) return true;
  const mapped = mappedIpv4(address);
  if (mapped) return isBlockedIpv4(mapped);
  const value = normalizeIpv6(address);
  return value === '::'
    || value === '::1'
    || value.startsWith('::')
    || value.startsWith('64:ff9b:')
    || value.startsWith('fc')
    || value.startsWith('fd')
    || /^fe[89ab]/.test(value)
    || value.startsWith('ff')
    || value.startsWith('2001:db8:')
    || value.startsWith('3fff:');
}

function safeHeaderValue(value) {
  const text = String(value || '').trim();
  if (!text || /[\r\n]/.test(text)) return '';
  return text.slice(0, 2048);
}

export function sanitizeDownloadHeaders(input = {}) {
  const source = { ...(input.headers || input) };
  if (input.referer) source.referer = input.referer;
  if (input.userAgent) source['user-agent'] = input.userAgent;
  const headers = {};
  for (const [name, rawValue] of Object.entries(source)) {
    const normalized = String(name).toLowerCase();
    if (!ALLOWED_HEADERS.has(normalized)) continue;
    const value = safeHeaderValue(rawValue);
    if (value) headers[normalized] = value;
  }
  if (!headers.accept) headers.accept = 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8';
  return headers;
}

function parseAllowedHosts(value) {
  return new Set(String(value || '').split(',').map((host) => host.trim().toLowerCase()).filter(Boolean));
}

function normalizeOptions(options = {}) {
  const numberOr = (value, fallback, minimum = 1) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.max(minimum, parsed) : fallback;
  };
  return {
    concurrency: numberOr(options.concurrency, DEFAULT_CONCURRENCY),
    timeoutMs: numberOr(options.timeoutMs, DEFAULT_TIMEOUT_MS),
    maxBytes: numberOr(options.maxBytes, DEFAULT_MAX_BYTES),
    maxRedirects: numberOr(options.maxRedirects, DEFAULT_MAX_REDIRECTS, 0),
    leaseMs: numberOr(options.leaseMs, DEFAULT_LEASE_MS),
  };
}

function cleanFilename(value) {
  return String(value || '')
    .replace(/[\\/:*?"<>|\x00-\x1f]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180) || 'download.bin';
}

function filenameFromDisposition(value) {
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(value || '');
  if (encoded) {
    try {
      return cleanFilename(decodeURIComponent(encoded[1]));
    } catch (err) {
      return cleanFilename(encoded[1]);
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(value || '');
  return plain ? cleanFilename(plain[1]) : '';
}

function filenameFromUrl(url) {
  try {
    return cleanFilename(decodeURIComponent(path.basename(new URL(url).pathname || '')) || 'download.bin');
  } catch (err) {
    return 'download.bin';
  }
}

function isProcessAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err && err.code === 'EPERM';
  }
}

function cleanupStaleDownloadDirectories(now = Date.now()) {
  let entries = [];
  try {
    entries = fs.readdirSync(os.tmpdir(), { withFileTypes: true });
  } catch (err) {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith('eagle-download-')) continue;
    const directory = path.join(os.tmpdir(), entry.name);
    const leasePath = path.join(directory, 'lease.json');
    try {
      const lease = JSON.parse(fs.readFileSync(leasePath, 'utf8'));
      if (Number(lease.expiresAt) <= now || !isProcessAlive(Number(lease.pid))) {
        fs.rmSync(directory, { recursive: true, force: true });
      }
    } catch (err) {
      // 不删除没有本服务租约标记的目录，避免误伤其他临时内容。
    }
  }
}

function looksLikeHtml(buffer) {
  const head = buffer.subarray(0, 4096).toString('utf8').replace(/^\uFEFF/, '').trimStart().toLowerCase();
  return head.startsWith('<!doctype html') || head.startsWith('<html') || head.startsWith('<head') || head.startsWith('<body');
}

async function validateDownloadedFile(filePath, contentType, options = {}) {
  const handle = await fs.promises.open(filePath, 'r');
  const head = Buffer.alloc(4096);
  let bytesRead = 0;
  try {
    ({ bytesRead } = await handle.read(head, 0, head.length, 0));
  } finally {
    await handle.close();
  }
  const sample = head.subarray(0, bytesRead);
  const normalizedType = String(contentType || '').split(';')[0].trim().toLowerCase();
  if (normalizedType === 'text/html' || normalizedType === 'application/xhtml+xml' || looksLikeHtml(sample)) {
    throw new DownloadError('Downloaded content is HTML, not a valid import file', {
      code: 'CONTENT_TYPE_BLOCKED',
      statusCode: 415,
      detail: normalizedType,
    });
  }
  if (options.validateImage) {
    try {
      const metadata = await sharp(filePath, { limitInputPixels: 30_000_000, failOn: 'error' }).metadata();
      if (!metadata.format || !metadata.width || !metadata.height) throw new Error('Image metadata is incomplete');
    } catch (err) {
      throw new DownloadError(`Downloaded image cannot be decoded: ${err.message}`, {
        code: 'IMAGE_DECODE_FAILED',
        statusCode: 422,
        cause: err,
      });
    }
  }
}

function cloneTask(task) {
  return {
    id: task.id,
    url: task.url,
    status: task.status,
    progress: task.progress,
    receivedBytes: task.receivedBytes,
    totalBytes: task.totalBytes,
    active: task.status === 'running',
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    startedAt: task.startedAt || null,
    completedAt: task.completedAt || null,
    expiresAt: task.expiresAt || null,
    result: task.result ? { ...task.result } : null,
    error: task.error ? { ...task.error } : null,
  };
}

export class ControlledDownloadService {
  constructor(options = {}) {
    this.options = normalizeOptions(options);
    this.allowedHosts = options.allowedHosts instanceof Set ? options.allowedHosts : parseAllowedHosts(options.allowedHosts);
    this.lookup = options.lookup || ((hostname) => dns.promises.lookup(hostname, { all: true, verbatim: true }));
    this.queue = [];
    this.tasks = new Map();
    this.active = 0;
    this.maxObservedActive = 0;
    cleanupStaleDownloadDirectories();
    this.cleanupTimer = setInterval(() => this.cleanupExpired(), Math.min(this.options.leaseMs, 60_000));
    this.cleanupTimer.unref?.();
  }

  status() {
    return {
      concurrency: this.options.concurrency,
      active: this.active,
      pending: this.queue.length,
      maxObservedActive: this.maxObservedActive,
      tasks: [...this.tasks.values()].map(cloneTask),
    };
  }

  task(id) {
    const task = this.tasks.get(id);
    return task ? cloneTask(task) : null;
  }

  start(params = {}) {
    const task = {
      id: `DOWNLOAD-${Date.now()}-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
      url: String(params.url || ''),
      params,
      status: 'queued',
      progress: 0,
      receivedBytes: 0,
      totalBytes: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      controller: new AbortController(),
      resolve: null,
      reject: null,
      result: null,
      error: null,
      tempDir: '',
    };
    const promise = new Promise((resolve, reject) => {
      task.resolve = resolve;
      task.reject = reject;
    });
    this.tasks.set(task.id, task);
    this.queue.push(task);
    this.#drain();
    return { id: task.id, promise };
  }

  async download(params = {}) {
    return this.start(params).promise;
  }

  cancel(id) {
    const task = this.tasks.get(id);
    if (!task || ['complete', 'error', 'cancelled'].includes(task.status)) return false;
    task.controller.abort(new DownloadError('Download cancelled', { code: 'TASK_CANCEL', statusCode: 499, url: task.url }));
    if (task.status === 'queued') {
      this.queue = this.queue.filter((entry) => entry !== task);
      this.#finishCancelled(task);
    } else {
      task.status = 'cancelling';
      task.updatedAt = Date.now();
    }
    return true;
  }

  release(idOrPath) {
    const task = this.tasks.get(idOrPath) || [...this.tasks.values()].find((entry) => entry.result && entry.result.path === idOrPath);
    if (!task) return false;
    this.#removeTemp(task);
    task.expiresAt = null;
    if (['complete', 'error', 'cancelled'].includes(task.status)) this.tasks.delete(task.id);
    return true;
  }

  cleanupExpired(now = Date.now()) {
    for (const task of this.tasks.values()) {
      if (task.expiresAt && task.expiresAt <= now) this.release(task.id);
    }
  }

  close() {
    clearInterval(this.cleanupTimer);
    for (const task of this.tasks.values()) {
      if (!['complete', 'error', 'cancelled'].includes(task.status)) this.cancel(task.id);
      this.#removeTemp(task);
    }
    this.tasks.clear();
  }

  async #resolveTarget(url) {
    const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    if (BLOCKED_HOSTNAMES.has(hostname) && !this.allowedHosts.has(hostname)) {
      throw new DownloadError(`Blocked download host: ${hostname}`, { code: 'SSRF_BLOCKED', statusCode: 403, url: url.href });
    }
    const literalFamily = net.isIP(hostname);
    let addresses;
    try {
      addresses = literalFamily ? [{ address: hostname, family: literalFamily }] : await this.lookup(hostname);
    } catch (err) {
      throw new DownloadError(`Download host cannot be resolved: ${hostname}`, {
        code: 'DNS_FAILED',
        statusCode: 502,
        cause: err,
        url: url.href,
      });
    }
    if (!Array.isArray(addresses) || addresses.length === 0) {
      throw new DownloadError(`Download host cannot be resolved: ${hostname}`, { code: 'DNS_FAILED', statusCode: 502, url: url.href });
    }
    if (!this.allowedHosts.has(hostname)) {
      const blocked = addresses.find((entry) => isBlockedAddress(entry.address));
      if (blocked) {
        throw new DownloadError(`Blocked download address: ${blocked.address}`, { code: 'SSRF_BLOCKED', statusCode: 403, url: url.href });
      }
    }
    return addresses[0];
  }

  async #request(task, url, outputPath, redirectCount = 0) {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new DownloadError(`Unsupported URL protocol: ${parsed.protocol}`, { code: 'UNSUPPORTED_PROTOCOL', statusCode: 400, url });
    }
    if (parsed.username || parsed.password) {
      throw new DownloadError('Credentials in download URLs are not allowed', { code: 'URL_CREDENTIALS_BLOCKED', statusCode: 400, url });
    }
    const resolved = await this.#resolveTarget(parsed);
    const headers = sanitizeDownloadHeaders(task.params);
    const client = parsed.protocol === 'https:' ? https : http;
    const response = await new Promise((resolve, reject) => {
      const request = client.request(parsed, {
        method: 'GET',
        headers,
        signal: task.controller.signal,
        lookup: (_hostname, lookupOptions, callback) => {
          if (lookupOptions && lookupOptions.all) callback(null, [resolved]);
          else callback(null, resolved.address, resolved.family);
        },
      }, resolve);
      request.setTimeout(this.options.timeoutMs, () => {
        request.destroy(new DownloadError(`Download timed out after ${this.options.timeoutMs} ms`, {
          code: 'NETWORK_TIMEOUT',
          statusCode: 504,
          url: parsed.href,
        }));
      });
      request.on('error', reject);
      request.end();
    });

    const statusCode = response.statusCode || 0;
    if (statusCode >= 300 && statusCode < 400 && response.headers.location) {
      response.resume();
      if (redirectCount >= this.options.maxRedirects) {
        throw new DownloadError(`Download exceeded ${this.options.maxRedirects} redirects`, {
          code: 'TOO_MANY_REDIRECTS',
          statusCode: 508,
          url: parsed.href,
        });
      }
      const nextUrl = new URL(response.headers.location, parsed).href;
      return this.#request(task, nextUrl, outputPath, redirectCount + 1);
    }
    if (statusCode < 200 || statusCode >= 300) {
      response.resume();
      throw new DownloadError(`Download failed: HTTP ${statusCode}`, {
        code: 'HTTP_ERROR',
        statusCode: statusCode >= 400 && statusCode <= 599 ? statusCode : 502,
        detail: `HTTP ${statusCode}`,
        url: parsed.href,
      });
    }

    const declaredLength = Number(response.headers['content-length'] || 0);
    if (Number.isFinite(declaredLength) && declaredLength > this.options.maxBytes) {
      response.destroy();
      throw new DownloadError(`Remote file exceeds ${this.options.maxBytes} byte limit`, {
        code: 'FILE_TOO_LARGE',
        statusCode: 413,
        url: parsed.href,
      });
    }
    task.totalBytes = declaredLength > 0 ? declaredLength : 0;
    let received = 0;
    const limiter = new Transform({
      transform: (chunk, _encoding, callback) => {
        received += chunk.length;
        task.receivedBytes = received;
        task.progress = task.totalBytes > 0 ? Math.min(99, Math.round((received / task.totalBytes) * 100)) : 0;
        task.updatedAt = Date.now();
        if (received > this.options.maxBytes) {
          callback(new DownloadError(`Remote file exceeds ${this.options.maxBytes} byte limit`, {
            code: 'FILE_TOO_LARGE',
            statusCode: 413,
            url: parsed.href,
          }));
          return;
        }
        callback(null, chunk);
      },
    });
    await pipeline(response, limiter, fs.createWriteStream(outputPath, { flags: 'wx' }), { signal: task.controller.signal });
    if (received === 0) {
      throw new DownloadError('Remote file is empty', { code: 'EMPTY_FILE', statusCode: 422, url: parsed.href });
    }
    return {
      finalUrl: parsed.href,
      contentType: String(response.headers['content-type'] || ''),
      contentDisposition: String(response.headers['content-disposition'] || ''),
      size: received,
      redirects: redirectCount,
    };
  }

  async #run(task) {
    task.status = 'running';
    task.startedAt = Date.now();
    task.updatedAt = task.startedAt;
    this.active += 1;
    this.maxObservedActive = Math.max(this.maxObservedActive, this.active);
    const timeout = setTimeout(() => {
      task.controller.abort(new DownloadError(`Download timed out after ${this.options.timeoutMs} ms`, {
        code: 'NETWORK_TIMEOUT',
        statusCode: 504,
        url: task.url,
      }));
    }, this.options.timeoutMs);
    try {
      task.tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'eagle-download-'));
      await fs.promises.writeFile(path.join(task.tempDir, 'lease.json'), JSON.stringify({
        taskId: task.id,
        pid: process.pid,
        createdAt: Date.now(),
        expiresAt: Date.now() + this.options.leaseMs,
      }), 'utf8');
      const outputPath = path.join(task.tempDir, 'payload.download');
      const metadata = await this.#request(task, task.url, outputPath);
      await validateDownloadedFile(outputPath, metadata.contentType, task.params);
      const originalName = filenameFromDisposition(metadata.contentDisposition) || filenameFromUrl(metadata.finalUrl);
      task.status = 'complete';
      task.progress = 100;
      task.completedAt = Date.now();
      task.updatedAt = task.completedAt;
      task.expiresAt = task.completedAt + this.options.leaseMs;
      await fs.promises.writeFile(path.join(task.tempDir, 'lease.json'), JSON.stringify({
        taskId: task.id,
        pid: process.pid,
        createdAt: task.createdAt,
        expiresAt: task.expiresAt,
      }), 'utf8');
      task.result = {
        taskId: task.id,
        path: outputPath,
        originalName,
        url: task.url,
        finalUrl: metadata.finalUrl,
        mime: metadata.contentType.split(';')[0].trim().toLowerCase(),
        size: metadata.size,
        redirects: metadata.redirects,
        expiresAt: task.expiresAt,
      };
      task.resolve({ ...task.result });
    } catch (error) {
      const reason = task.controller.signal.aborted ? task.controller.signal.reason : error;
      if (reason && reason.code === 'TASK_CANCEL') {
        this.#finishCancelled(task);
      } else {
        const normalized = reason instanceof DownloadError
          ? reason
          : new DownloadError(reason && reason.message ? reason.message : 'Download failed', {
              code: reason && reason.name === 'AbortError' ? 'NETWORK_TIMEOUT' : 'DOWNLOAD_FAILED',
              statusCode: reason && reason.name === 'AbortError' ? 504 : 502,
              cause: reason,
              url: task.url,
            });
        task.status = 'error';
        task.completedAt = Date.now();
        task.updatedAt = task.completedAt;
        task.expiresAt = task.completedAt + this.options.leaseMs;
        task.error = { code: normalized.code, message: normalized.message, detail: normalized.detail, statusCode: normalized.statusCode };
        this.#removeTemp(task);
        task.reject(normalized);
      }
    } finally {
      clearTimeout(timeout);
      this.active -= 1;
      this.#drain();
    }
  }

  #finishCancelled(task) {
    const error = task.controller.signal.reason instanceof DownloadError
      ? task.controller.signal.reason
      : new DownloadError('Download cancelled', { code: 'TASK_CANCEL', statusCode: 499, url: task.url });
    task.status = 'cancelled';
    task.completedAt = Date.now();
    task.updatedAt = task.completedAt;
    task.expiresAt = task.completedAt + this.options.leaseMs;
    task.error = { code: error.code, message: error.message, statusCode: error.statusCode };
    this.#removeTemp(task);
    task.reject(error);
  }

  #removeTemp(task) {
    if (task.tempDir && fs.existsSync(task.tempDir)) fs.rmSync(task.tempDir, { recursive: true, force: true });
    task.tempDir = '';
  }

  #drain() {
    while (this.active < this.options.concurrency && this.queue.length > 0) {
      const task = this.queue.shift();
      if (task.status === 'queued') this.#run(task);
    }
  }
}

let defaultService;

export function getControlledDownloadService() {
  if (!defaultService) {
    defaultService = new ControlledDownloadService({
      concurrency: process.env.EAGLE_DOWNLOAD_CONCURRENCY === undefined ? DEFAULT_CONCURRENCY : Number(process.env.EAGLE_DOWNLOAD_CONCURRENCY),
      timeoutMs: process.env.EAGLE_DOWNLOAD_TIMEOUT_MS === undefined ? DEFAULT_TIMEOUT_MS : Number(process.env.EAGLE_DOWNLOAD_TIMEOUT_MS),
      maxBytes: process.env.EAGLE_DOWNLOAD_MAX_BYTES === undefined ? DEFAULT_MAX_BYTES : Number(process.env.EAGLE_DOWNLOAD_MAX_BYTES),
      maxRedirects: process.env.EAGLE_DOWNLOAD_MAX_REDIRECTS === undefined ? DEFAULT_MAX_REDIRECTS : Number(process.env.EAGLE_DOWNLOAD_MAX_REDIRECTS),
      leaseMs: process.env.EAGLE_DOWNLOAD_LEASE_MS === undefined ? DEFAULT_LEASE_MS : Number(process.env.EAGLE_DOWNLOAD_LEASE_MS),
      allowedHosts: process.env.EAGLE_DOWNLOAD_ALLOW_HOSTS,
    });
  }
  return defaultService;
}
