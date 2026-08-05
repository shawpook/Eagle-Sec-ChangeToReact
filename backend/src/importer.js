import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resolveLibraryPath, saveItems, saveLibraryState } from './library-store.js';
import { generateThumbnail, readImageDimensions } from './thumbnailer.js';
import { getControlledDownloadService } from './controlled-downloader.js';

let thumbnailTaskService = null;

export function configureThumbnailTaskService(service) {
  thumbnailTaskService = service || null;
}

function generateId(prefix = 'ITEM') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
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

function readFileHeader(filePath, maxBytes = 4096) {
  const descriptor = fs.openSync(filePath, 'r');
  try {
    const buffer = Buffer.alloc(maxBytes);
    const bytesRead = fs.readSync(descriptor, buffer, 0, maxBytes, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    fs.closeSync(descriptor);
  }
}

function detectFileType(filePath, hints = {}) {
  const buffer = readFileHeader(filePath);
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
  } else if (buffer.length >= 12 && buffer.subarray(4, 8).toString('ascii') === 'ftyp') {
    const brand = buffer.subarray(8, 12).toString('ascii').toLowerCase();
    if (['isom', 'iso2', 'mp41', 'mp42', 'avc1', 'dash', 'mmp4'].includes(brand)) {
      magicExt = 'mp4';
      mime = 'video/mp4';
    }
  } else if (buffer.length >= 4 && buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])) && buffer.includes(Buffer.from('webm'))) {
    magicExt = 'webm';
    mime = 'video/webm';
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
    ...(options.medium ? { medium: options.medium } : {}),
    ...(options.videoID ? { videoID: options.videoID } : {}),
    ...(options.videoEmbed ? { videoEmbed: options.videoEmbed } : {}),
    ...(options.duration ? { duration: options.duration } : {}),
    ...(options.videoThumb ? { videoThumb: options.videoThumb } : {}),
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
    if (item.noThumbnail && thumbnailTaskService?.supports(item.ext)) {
      try {
        const task = thumbnailTaskService.enqueue(library, item.id);
        item.thumbnailTask = task.id;
        item.processingThumbnail = true;
      } catch (err) {
        if (err.code !== 'THUMBNAIL_TASK_CONFLICT') item.thumbnailError = err.code || 'THUMBNAIL_GENERATION_FAILED';
      }
    }
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
  const downloader = options.downloadService || getControlledDownloadService();
  const download = await downloader.download({
    url: sourceUrl,
    headers: options.headers || {},
    referer: options.referer || options.website,
    userAgent: options.userAgent,
    validateImage: options.validateImage !== false,
  });
  try {
    return importFile(library, download.path, {
      ...options,
      name: options.name || path.parse(download.originalName).name,
      originalName: options.originalName || download.originalName,
      mime: download.mime || options.mime,
      size: download.size,
      url: sourceUrl,
    });
  } finally {
    downloader.release(download.taskId);
  }
}

function folderNode(name, parentID) {
  return {
    id: generateId('FOLDER'),
    name: cleanName(name) || 'Folder',
    description: '',
    children: [],
    modificationTime: Date.now(),
    tags: [],
    ...(parentID ? { parent: parentID } : {}),
  };
}

function scanFolderTree(rootPath, options = {}) {
  const files = [];
  const errors = [];
  let maxDepth = 1;
  const maxFiles = Number(options.maxFiles) || 100000;
  const maxDepthAllowed = Number(options.maxDepth) || 15;

  const walk = (directory, parentID, depth) => {
    if (depth > maxDepthAllowed) throw new Error(`Folder depth exceeds ${maxDepthAllowed}: ${directory}`);
    maxDepth = Math.max(maxDepth, depth);
    const node = folderNode(path.basename(directory), parentID);
    let entries;
    try {
      entries = fs.readdirSync(directory, { withFileTypes: true });
    } catch (err) {
      errors.push({ path: directory, error: err.message });
      return node;
    }
    entries.sort((left, right) => left.name.localeCompare(right.name, 'zh-CN', { numeric: true, sensitivity: 'base' }));
    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) {
        errors.push({ path: fullPath, error: 'Symbolic links are skipped' });
      } else if (entry.isDirectory()) {
        if (entry.name.toLowerCase().endsWith('.library')) {
          errors.push({ path: fullPath, error: 'Nested .library directory is skipped' });
        } else {
          node.children.push(walk(fullPath, node.id, depth + 1));
        }
      } else if (entry.isFile()) {
        files.push({ path: fullPath, folderID: node.id });
        if (files.length > maxFiles) throw new Error(`Folder contains more than ${maxFiles} files`);
      }
    }
    return node;
  };

  return { tree: walk(rootPath, options.parentID, 1), files, errors, depth: maxDepth };
}

export async function importFolder(library, folderPath, options = {}, hooks = {}) {
  const resolved = path.resolve(folderPath);
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
    throw new Error(`Folder not found: ${folderPath}`);
  }
  if (resolved.toLowerCase().endsWith('.library')) throw new Error('Importing a .library as a folder is not allowed');

  const scan = scanFolderTree(resolved, options);
  const imported = [];
  const errors = [...scan.errors];
  const originalFolders = library.folders.slice();
  const originalMetadataFolders = Array.isArray(library.metadata.folders) ? library.metadata.folders.slice() : [];
  const rootParent = options.parentID
    ? (() => {
        const find = (tree) => {
          for (const folder of tree) {
            if (folder.id === options.parentID) return folder;
            const child = find(folder.children || []);
            if (child) return child;
          }
          return null;
        };
        return find(library.folders);
      })()
    : null;
  if (options.parentID && !rootParent) throw new Error(`Parent folder not found: ${options.parentID}`);
  if (rootParent) rootParent.children.push(scan.tree);
  else library.folders.push(scan.tree);

  const collectFolderIds = (folder, ids = []) => {
    ids.push(folder.id);
    for (const child of folder.children || []) collectFolderIds(child, ids);
    return ids;
  };
  library.metadata.folders = [...new Set([...originalMetadataFolders, ...collectFolderIds(scan.tree)])];
  library.metadata.modificationTime = Date.now();
  saveLibraryState(library);

  try {
    for (let index = 0; index < scan.files.length; index += 1) {
      if (hooks.isCancelled && hooks.isCancelled()) {
        return { items: imported, folder: scan.tree, errors, cancelled: true, total: scan.files.length, depth: scan.depth };
      }
      const source = scan.files[index];
      try {
        const item = importFile(library, source.path, {
          ...options,
          folderIDs: [...new Set([...(Array.isArray(options.folderIDs) ? options.folderIDs : []), source.folderID])],
        });
        imported.push(item);
        if (hooks.onProgress) hooks.onProgress({ current: index + 1, total: scan.files.length, item, path: source.path });
      } catch (err) {
        errors.push({ path: source.path, error: err.message });
        if (hooks.onProgress) hooks.onProgress({ current: index + 1, total: scan.files.length, error: err.message, path: source.path });
      }
      await new Promise((resolve) => setImmediate(resolve));
    }
    return { items: imported, folder: scan.tree, errors, cancelled: false, total: scan.files.length, depth: scan.depth };
  } catch (err) {
    library.folders = originalFolders;
    library.metadata.folders = originalMetadataFolders;
    saveLibraryState(library);
    throw err;
  }
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
  let parsed;
  try {
    parsed = new URL(url);
  } catch (err) {
    throw new Error(`Invalid bookmark URL: ${url}`);
  }
  const name = params.name || params.title || parsed.hostname || 'Bookmark';
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-bookmark-'));
  const tempFile = path.join(tempDir, `${cleanName(name) || 'Bookmark'}.url`);
  fs.writeFileSync(tempFile, `[InternetShortcut]\r\nURL=${url}\r\n`, 'utf8');
  try {
    return importFile(library, tempFile, {
      name,
      originalName: path.basename(tempFile),
      ext: 'url',
      mime: 'application/internet-shortcut',
      url,
      website: params.website || '',
      annotation: params.annotation || '',
      tags: params.tags || [],
      folders: params.folders || params.folderIDs || [],
      star: params.star || 0,
      medium: params.medium || '',
      videoID: params.videoID || '',
      videoEmbed: params.videoEmbed || '',
      duration: params.duration || 0,
      videoThumb: params.videoThumb || '',
    });
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
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
