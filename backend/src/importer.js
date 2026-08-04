import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resolveLibraryPath, saveItems } from './library-store.js';
import { generateThumbnail, readImageDimensions } from './thumbnailer.js';

function generateId() {
  return `ITEM-${Date.now()}-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
}

function cleanName(name) {
  return String(name || '')
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
}

function safeExt(ext) {
  const value = String(ext || '').replace(/^\./, '').toLowerCase();
  return /^[a-z0-9]{1,10}$/.test(value) ? value : 'bin';
}

function sourceToLocalPath(source) {
  if (!source) return null;
  if (/^https?:\/\//i.test(source)) return null;
  const value = String(source).replace(/\\/g, '/');
  const resolved = value.startsWith('/mock-library/') || value.startsWith('/src/')
    ? resolveLibraryPath(value)
    : path.resolve(value);
  if (!fs.existsSync(resolved)) throw new Error(`Source file not found: ${source}`);
  if (!fs.statSync(resolved).isFile()) throw new Error(`Source is not a file: ${source}`);
  return resolved;
}

function detectFileType(filePath, hints = {}) {
  const buffer = fs.readFileSync(filePath);
  let magicExt = '';
  let mime = '';
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    magicExt = 'png';
    mime = 'image/png';
  } else if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    magicExt = 'jpg';
    mime = 'image/jpeg';
  } else if (buffer.length >= 6 && (buffer.subarray(0, 6).toString('ascii') === 'GIF87a' || buffer.subarray(0, 6).toString('ascii') === 'GIF89a')) {
    magicExt = 'gif';
    mime = 'image/gif';
  } else if (buffer.length >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') {
    magicExt = 'webp';
    mime = 'image/webp';
  }
  const originalExt = path.extname(String(hints.originalName || '')).slice(1);
  const pathExt = path.extname(filePath).slice(1);
  const hintExt = String(hints.ext || '').replace(/^\./, '');
  const ext = safeExt(magicExt || hintExt || originalExt || pathExt);
  return { ext, mime: mime || hints.mime || 'application/octet-stream' };
}

export function importFile(library, source, options = {}) {
  const sourcePath = sourceToLocalPath(source);
  if (!sourcePath) throw new Error('Local source file is required');
  const originalName = options.originalName || path.basename(sourcePath);
  const parsedOriginal = path.parse(originalName);
  const detected = detectFileType(sourcePath, {
    ext: options.ext,
    mime: options.mime || options.type,
    originalName,
  });
  let rawName = options.name || parsedOriginal.name || path.parse(sourcePath).name;
  const rawExt = path.extname(rawName);
  if (rawExt) rawName = rawName.slice(0, -rawExt.length);
  const name = cleanName(rawName) || 'New Item';
  const ext = detected.ext;
  const id = options.id || generateId();
  const now = Date.now();
  const infoDir = path.join(library.rootDir, 'images', `${id}.info`);
  const originalFile = path.join(infoDir, `${name}.${ext}`);
  const stat = fs.statSync(sourcePath);
  let dimensions = { width: 0, height: 0 };
  try {
    dimensions = readImageDimensions(sourcePath, ext);
  } catch (err) {
    dimensions = { width: 0, height: 0 };
  }

  const item = {
    id,
    name,
    ext,
    mime: detected.mime,
    width: Number(options.width) || dimensions.width,
    height: Number(options.height) || dimensions.height,
    size: Number(options.size) || stat.size,
    url: options.url || '',
    website: options.website || '',
    annotation: options.annotation || '',
    tags: Array.isArray(options.tags) ? options.tags : [],
    folders: Array.isArray(options.folderIDs) ? options.folderIDs : Array.isArray(options.folders) ? options.folders : [],
    star: Number(options.star) || 0,
    modificationTime: Number(options.modificationTime) || now,
    lastModified: Number(options.lastModified) || stat.mtimeMs || now,
    noThumbnail: false,
    isDeleted: false,
    comments: [],
  };

  fs.mkdirSync(infoDir, { recursive: true });
  try {
    fs.copyFileSync(sourcePath, originalFile);
    try {
      generateThumbnail(library, item);
    } catch (err) {
      item.noThumbnail = true;
    }
    library.items.unshift(item);
    saveItems(library);
    return item;
  } catch (err) {
    if (fs.existsSync(infoDir)) fs.rmSync(infoDir, { recursive: true, force: true });
    throw err;
  }
}

export function importFiles(library, sources, options = {}) {
  const list = Array.isArray(sources) ? sources : [sources];
  return list.map((source) => importFile(library, source, options));
}

export async function importUrl(library, sourceUrl, options = {}) {
  let parsedUrl;
  try {
    parsedUrl = new URL(sourceUrl);
  } catch (err) {
    throw new Error(`Invalid URL: ${sourceUrl}`);
  }
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error(`Unsupported URL protocol: ${parsedUrl.protocol}`);
  const response = await fetch(parsedUrl, { headers: options.headers || {} });
  if (!response.ok) throw new Error(`Download failed: HTTP ${response.status}`);
  const contentLength = Number(response.headers.get('content-length') || 0);
  if (contentLength > 100 * 1024 * 1024) throw new Error('Remote file exceeds 100 MB import limit');
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length === 0) throw new Error('Remote file is empty');
  if (buffer.length > 100 * 1024 * 1024) throw new Error('Remote file exceeds 100 MB import limit');
  const urlName = decodeURIComponent(path.basename(parsedUrl.pathname || '')) || 'Downloaded Item';
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-url-'));
  const tempFile = path.join(tempDir, cleanName(urlName) || 'download.bin');
  fs.writeFileSync(tempFile, buffer);
  try {
    return importFile(library, tempFile, {
      ...options,
      name: options.name || path.parse(urlName).name,
      originalName: options.originalName || urlName,
      mime: response.headers.get('content-type') || options.mime,
      url: sourceUrl,
    });
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

export function importFolder(library, folderPath, options = {}) {
  const resolved = path.resolve(folderPath);
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
    throw new Error(`Folder not found: ${folderPath}`);
  }
  const entries = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else {
        entries.push(importFile(library, fullPath, options));
      }
    }
  };
  walk(resolved);
  return entries;
}

export function importBase64(library, data, options = {}) {
  const match = /^data:([^;,]+);base64,(.*)$/s.exec(String(data || ''));
  if (!match) throw new Error('Invalid base64 data URI');
  const ext = options.ext || match[1].split('/').pop() || 'bin';
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-base64-'));
  const tempFile = path.join(tempDir, `payload.${safeExt(ext)}`);
  fs.writeFileSync(tempFile, Buffer.from(match[2], 'base64'));
  try {
    return importFile(library, tempFile, { ...options, ext, originalName: options.name ? `${options.name}.${ext}` : path.basename(tempFile) });
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

export function importBookmark(library, params = {}) {
  const url = params.url || params.href || '';
  const name = params.name || params.title || new URL(url).hostname || 'Bookmark';
  return importFile(library, url, {
    name,
    ext: 'url',
    url,
    website: params.website || '',
    annotation: params.annotation || '',
    tags: params.tags || [],
    star: params.star || 0,
  });
}

export function exportLibrary(library, destDir) {
  const resolved = path.resolve(destDir);
  fs.mkdirSync(resolved, { recursive: true });
  fs.cpSync(library.rootDir, resolved, { recursive: true });
  return resolved;
}

export function exportItem(library, item, destDir) {
  const resolvedDest = path.resolve(destDir);
  fs.mkdirSync(resolvedDest, { recursive: true });
  const sourcePath = path.join(library.rootDir, 'images', `${item.id}.info`, `${item.name}.${item.ext}`);
  if (!fs.existsSync(sourcePath)) return null;
  const destPath = path.join(resolvedDest, `${item.name}.${item.ext}`);
  fs.copyFileSync(sourcePath, destPath);
  return destPath;
}
