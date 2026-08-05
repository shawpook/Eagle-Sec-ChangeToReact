import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import iconv from 'iconv-lite';
import { isTextThumbnailExtension } from './file-format-policy.js';
import { itemOriginalPath, saveItems } from './library-store.js';
import { readTextSnippet } from './text-document-support.js';

const TEXT_UNDO_FILE = 'text-undo.bin';
const MAX_TEXT_SAVE_BYTES = 50 * 1024 * 1024;

export class TextSaveError extends Error {
  constructor(message, options = {}) {
    super(message, options);
    this.name = 'TextSaveError';
    this.code = options.code || 'TEXT_SAVE_FAILED';
    this.statusCode = options.statusCode || 422;
  }
}

function uniqueSibling(filePath, label) {
  return `${filePath}.${label}-${process.pid}-${crypto.randomUUID()}`;
}

function findItem(library, itemId) {
  if (!itemId) {
    throw new TextSaveError('Item id is required', { code: 'ITEM_ID_REQUIRED', statusCode: 400 });
  }
  const item = library.items.find((entry) => entry.id === itemId);
  if (!item) {
    throw new TextSaveError('Item not found', { code: 'ITEM_NOT_FOUND', statusCode: 404 });
  }
  return item;
}

function assertTextItem(item) {
  if (!isTextThumbnailExtension(item.ext)) {
    throw new TextSaveError(`Text save is not supported for format: ${item.ext || 'unknown'}`, {
      code: 'TEXT_FORMAT_UNSUPPORTED',
      statusCode: 415,
    });
  }
}

function normalizeForCompare(value) {
  return String(value || '').replace(/\r\n?/g, '\n');
}

function encodeContent(content, encoding, lineEnding) {
  const text = lineEnding === 'crlf' ? String(content).replace(/\n/g, '\r\n') : String(content);
  let buffer;
  if (encoding === 'utf-8') {
    buffer = Buffer.from(text, 'utf8');
    const decoded = iconv.decode(buffer, 'utf-8');
    if (normalizeForCompare(decoded) !== String(content)) {
      throw new TextSaveError(`Text encoding cannot preserve content without loss: ${encoding}`, {
        code: 'TEXT_ENCODING_UNSUPPORTED',
        statusCode: 422,
      });
    }
  } else {
    if (!iconv.encodingExists(encoding)) {
      throw new TextSaveError(`Text encoding is not supported for save: ${encoding}`, {
        code: 'TEXT_ENCODING_UNSUPPORTED',
        statusCode: 422,
      });
    }
    buffer = iconv.encode(text, encoding);
    const decoded = iconv.decode(buffer, encoding);
    if (normalizeForCompare(decoded) !== String(content)) {
      throw new TextSaveError(`Text encoding cannot preserve content without loss: ${encoding}`, {
        code: 'TEXT_ENCODING_UNSUPPORTED',
        statusCode: 422,
      });
    }
  }
  return buffer;
}

function addBom(buffer, encoding, hasBom) {
  if (!hasBom) return buffer;
  if (encoding === 'utf-8') return Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), buffer]);
  if (encoding === 'utf-16le') return Buffer.concat([Buffer.from([0xff, 0xfe]), buffer]);
  if (encoding === 'utf-16be') return Buffer.concat([Buffer.from([0xfe, 0xff]), buffer]);
  return buffer;
}

function readFileHeader(filePath, maxBytes = 8192) {
  const fd = fs.openSync(filePath, 'r');
  try {
    const stat = fs.fstatSync(fd);
    const length = Math.min(stat.size, maxBytes);
    const buffer = Buffer.alloc(length);
    if (length === 0) return buffer;
    let offset = 0;
    while (offset < length) {
      const bytesRead = fs.readSync(fd, buffer, offset, length - offset, offset);
      if (bytesRead === 0) break;
      offset += bytesRead;
    }
    return buffer.subarray(0, offset);
  } finally {
    fs.closeSync(fd);
  }
}

function detectHeader(header, encoding) {
  const hasBom = header.length >= 3 && header[0] === 0xef && header[1] === 0xbb && header[2] === 0xbf
    || header.length >= 2 && ((header[0] === 0xff && header[1] === 0xfe) || (header[0] === 0xfe && header[1] === 0xff));
  const crlf = header.includes(Buffer.from([0x0d, 0x0a]));
  return {
    hasBom,
    lineEnding: crlf ? 'crlf' : 'lf',
    encoding,
  };
}

function replaceFile(source, buffer) {
  const infoDir = path.dirname(source);
  fs.mkdirSync(infoDir, { recursive: true });
  const backup = uniqueSibling(source, 'backup');
  const temp = uniqueSibling(source, 'pending');
  const hadOriginal = fs.existsSync(source);
  let installed = false;
  try {
    fs.writeFileSync(temp, buffer);
    if (hadOriginal) fs.renameSync(source, backup);
    fs.renameSync(temp, source);
    installed = true;
  } catch (err) {
    if (installed && fs.existsSync(source)) fs.rmSync(source, { force: true });
    if (hadOriginal && fs.existsSync(backup)) fs.renameSync(backup, source);
    throw err;
  } finally {
    if (fs.existsSync(temp)) fs.rmSync(temp, { force: true });
    if (!installed && fs.existsSync(backup)) fs.rmSync(backup, { force: true });
  }
}

export class TextSaveService {
  constructor(options = {}) {
    this.regenerate = options.regenerate || null;
  }

  async save(library, itemId, input = {}) {
    const item = findItem(library, itemId);
    assertTextItem(item);
    const expectedMtimeMs = Number(input.expectedMtimeMs);
    if (!Number.isFinite(expectedMtimeMs)) {
      throw new TextSaveError('expectedMtimeMs is required to prevent save conflicts', {
        code: 'TEXT_SAVE_MTIME_REQUIRED',
        statusCode: 400,
      });
    }
    if (typeof input.content !== 'string') {
      throw new TextSaveError('Text content is required', { code: 'TEXT_SAVE_CONTENT_REQUIRED', statusCode: 400 });
    }

    const source = itemOriginalPath(library, item);
    let stat;
    try {
      stat = fs.statSync(source);
    } catch (err) {
      throw new TextSaveError('Original item file does not exist', {
        code: 'ORIGINAL_FILE_NOT_FOUND',
        statusCode: 404,
        cause: err,
      });
    }
    if (Math.abs(stat.mtimeMs - expectedMtimeMs) > 1) {
      throw new TextSaveError('Text file was modified since it was loaded', {
        code: 'TEXT_SAVE_CONFLICT',
        statusCode: 409,
      });
    }
    if (stat.size > MAX_TEXT_SAVE_BYTES) {
      throw new TextSaveError(`Text save exceeds ${MAX_TEXT_SAVE_BYTES} bytes`, {
        code: 'TEXT_SAVE_TOO_LARGE',
        statusCode: 413,
      });
    }

    const snippet = readTextSnippet(source);
    const header = readFileHeader(source);
    const detected = detectHeader(header, snippet.encoding);
    const newBuffer = addBom(encodeContent(input.content, detected.encoding, detected.lineEnding), detected.encoding, detected.hasBom);
    if (newBuffer.length > MAX_TEXT_SAVE_BYTES) {
      throw new TextSaveError(`Text save exceeds ${MAX_TEXT_SAVE_BYTES} bytes`, {
        code: 'TEXT_SAVE_TOO_LARGE',
        statusCode: 413,
      });
    }

    const infoDir = path.dirname(source);
    const undoFile = path.join(infoDir, TEXT_UNDO_FILE);
    const previousBytes = fs.readFileSync(source);
    const itemSnapshot = structuredClone(item);
    const hadOriginal = fs.existsSync(source);
    const backup = uniqueSibling(source, 'backup');
    const temp = uniqueSibling(source, 'pending');
    let installed = false;
    let undoInstalled = false;

    try {
      fs.writeFileSync(temp, newBuffer);
      if (!fs.existsSync(undoFile)) {
        fs.writeFileSync(undoFile, previousBytes);
        undoInstalled = true;
      }
      if (hadOriginal) fs.renameSync(source, backup);
      fs.renameSync(temp, source);
      installed = true;
      item.size = newBuffer.length;
      item.lastModified = Date.now();
      item.modificationTime = item.lastModified;
      saveItems(library);
    } catch (err) {
      for (const key of Object.keys(item)) delete item[key];
      Object.assign(item, itemSnapshot);
      if (installed && fs.existsSync(source)) fs.rmSync(source, { force: true });
      if (hadOriginal && fs.existsSync(backup)) fs.renameSync(backup, source);
      if (undoInstalled && fs.existsSync(undoFile)) fs.rmSync(undoFile, { force: true });
      throw err;
    } finally {
      if (fs.existsSync(temp)) fs.rmSync(temp, { force: true });
      if (installed && fs.existsSync(backup)) fs.rmSync(backup, { force: true });
    }

    const result = {
      id: item.id,
      name: item.name,
      ext: item.ext,
      size: newBuffer.length,
      mtimeMs: fs.statSync(source).mtimeMs,
      encoding: detected.encoding,
      hasUndo: fs.existsSync(undoFile),
    };

    if (this.regenerate) {
      try {
        const task = await this.regenerate(library, item.id);
        result.thumbnailTask = task?.id || null;
      } catch (err) {
        result.thumbnailWarning = err.message;
      }
    }
    return result;
  }

  async undo(library, itemId) {
    const item = findItem(library, itemId);
    assertTextItem(item);
    const source = itemOriginalPath(library, item);
    const infoDir = path.dirname(source);
    const undoFile = path.join(infoDir, TEXT_UNDO_FILE);
    if (!fs.existsSync(undoFile)) {
      throw new TextSaveError('Text undo snapshot is not available', {
        code: 'TEXT_UNDO_UNAVAILABLE',
        statusCode: 404,
      });
    }

    const previousBytes = fs.readFileSync(undoFile);
    const itemSnapshot = structuredClone(item);
    const hadOriginal = fs.existsSync(source);
    const backup = uniqueSibling(source, 'backup');
    const temp = uniqueSibling(source, 'pending');
    let installed = false;
    try {
      fs.writeFileSync(temp, previousBytes);
      if (hadOriginal) fs.renameSync(source, backup);
      fs.renameSync(temp, source);
      installed = true;
      item.size = previousBytes.length;
      item.lastModified = Date.now();
      item.modificationTime = item.lastModified;
      saveItems(library);
      fs.rmSync(undoFile, { force: true });
    } catch (err) {
      for (const key of Object.keys(item)) delete item[key];
      Object.assign(item, itemSnapshot);
      if (installed && fs.existsSync(source)) fs.rmSync(source, { force: true });
      if (hadOriginal && fs.existsSync(backup)) fs.renameSync(backup, source);
      throw err;
    } finally {
      if (fs.existsSync(temp)) fs.rmSync(temp, { force: true });
      if (installed && fs.existsSync(backup)) fs.rmSync(backup, { force: true });
    }

    const result = {
      id: item.id,
      name: item.name,
      ext: item.ext,
      size: previousBytes.length,
      mtimeMs: fs.statSync(source).mtimeMs,
      hasUndo: false,
    };
    if (this.regenerate) {
      try {
        const task = await this.regenerate(library, item.id);
        result.thumbnailTask = task?.id || null;
      } catch (err) {
        result.thumbnailWarning = err.message;
      }
    }
    return result;
  }
}
