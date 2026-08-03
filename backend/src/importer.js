import fs from 'node:fs';
import path from 'node:path';
import { resolveLibraryPath, saveItems } from './library-store.js';
import { generateThumbnail } from './thumbnailer.js';

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
  if (value.startsWith('/mock-library/') || value.startsWith('/src/')) {
    return resolveLibraryPath(value);
  }
  const absolute = path.resolve(value);
  return fs.existsSync(absolute) ? absolute : null;
}

export function importFile(library, source, options = {}) {
  const sourcePath = sourceToLocalPath(source);
  const baseName = sourcePath ? path.basename(sourcePath) : options.name || 'New Item';
  const parsed = path.parse(baseName);
  let rawName = options.name || parsed.name;
  if (parsed.ext && rawName.toLowerCase().endsWith(parsed.ext.toLowerCase())) {
    rawName = rawName.slice(0, -parsed.ext.length);
  }
  const name = cleanName(rawName);
  const ext = safeExt(options.ext || parsed.ext.replace(/^\./, ''));
  const id = options.id || generateId();
  const now = Date.now();
  const infoDir = path.join(library.rootDir, 'images', `${id}.info`);
  fs.mkdirSync(infoDir, { recursive: true });

  const item = {
    id,
    name,
    ext,
    width: Number(options.width) || 0,
    height: Number(options.height) || 0,
    size: options.size || (sourcePath ? fs.statSync(sourcePath).size : 0),
    url: options.url || (sourcePath ? '' : source || ''),
    website: options.website || '',
    annotation: options.annotation || '',
    tags: Array.isArray(options.tags) ? options.tags : [],
    folders: Array.isArray(options.folderIDs) ? options.folderIDs : Array.isArray(options.folders) ? options.folders : [],
    star: Number(options.star) || 0,
    modificationTime: now,
    lastModified: now,
    noThumbnail: false,
    isDeleted: false,
    comments: [],
  };

  if (sourcePath) {
    const originalFile = path.join(infoDir, `${item.name}.${item.ext}`);
    fs.copyFileSync(sourcePath, originalFile);
    generateThumbnail(library, item);
  }

  library.items.unshift(item);
  saveItems(library);
  return item;
}

export function importFiles(library, sources, options = {}) {
  const list = Array.isArray(sources) ? sources : [sources];
  return list.map((source) => importFile(library, source, options));
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
  const tempFile = path.join(path.dirname(library.rootDir), '.import-base64.tmp');
  fs.writeFileSync(tempFile, Buffer.from(match[2], 'base64'));
  try {
    return importFile(library, tempFile, { ...options, ext });
  } finally {
    fs.rmSync(tempFile, { force: true });
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
