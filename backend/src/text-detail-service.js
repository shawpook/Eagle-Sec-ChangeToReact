import fs from 'node:fs';
import { isTextThumbnailExtension, resolveTextMimeType } from './file-format-policy.js';
import { itemOriginalPath } from './library-store.js';
import { readTextSnippet } from './text-document-support.js';

const DEFAULT_TEXT_DETAIL_BYTES = 1 * 1024 * 1024;
const MAX_TEXT_DETAIL_BYTES = 5 * 1024 * 1024;

export class TextDetailError extends Error {
  constructor(message, options = {}) {
    super(message, options);
    this.name = 'TextDetailError';
    this.code = options.code || 'TEXT_DETAIL_READ_FAILED';
    this.statusCode = options.statusCode || 422;
  }
}

function findItem(library, itemId) {
  if (!itemId) {
    throw new TextDetailError('Item id is required', { code: 'ITEM_ID_REQUIRED', statusCode: 400 });
  }
  const item = library.items.find((entry) => entry.id === itemId);
  if (!item) {
    throw new TextDetailError('Item not found', { code: 'ITEM_NOT_FOUND', statusCode: 404 });
  }
  return item;
}

function resolveLimit(value) {
  const parsed = Math.floor(Number(value));
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_TEXT_DETAIL_BYTES;
  return Math.min(MAX_TEXT_DETAIL_BYTES, parsed);
}

function resolveOffset(value, totalBytes) {
  const parsed = Math.floor(Number(value));
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.min(totalBytes, parsed);
}

export function readTextItemDetail(library, itemId, options = {}) {
  const item = findItem(library, itemId);
  if (!isTextThumbnailExtension(item.ext)) {
    throw new TextDetailError(`Text detail is not supported for format: ${item.ext || 'unknown'}`, {
      code: 'TEXT_FORMAT_UNSUPPORTED',
      statusCode: 415,
    });
  }

  const source = itemOriginalPath(library, item);
  let stat;
  try {
    stat = fs.statSync(source);
  } catch (err) {
    throw new TextDetailError('Original item file does not exist', {
      code: 'ORIGINAL_FILE_NOT_FOUND',
      statusCode: 404,
      cause: err,
    });
  }
  if (!stat.isFile()) {
    throw new TextDetailError('Original item source must be a regular file', {
      code: 'INVALID_TEXT_SOURCE',
      statusCode: 400,
    });
  }

  const limit = resolveLimit(options.limit);
  const offset = resolveOffset(options.offset, stat.size);
  const firstPage = readTextSnippet(source, {
    offset: 0,
    maxBytes: Math.min(limit, 4096),
  });
  const snippet = readTextSnippet(source, {
    offset,
    maxBytes: limit,
    encoding: firstPage.encoding,
  });

  return {
    id: item.id,
    name: item.name,
    ext: item.ext,
    mimeType: resolveTextMimeType(item.ext),
    encoding: snippet.encoding,
    size: stat.size,
    mtimeMs: stat.mtimeMs,
    offset: snippet.offset,
    endOffset: snippet.endOffset,
    bytesRead: snippet.bytesRead,
    totalBytes: snippet.totalBytes,
    truncated: snippet.truncated,
    hasMore: snippet.endOffset < stat.size,
    content: snippet.content,
  };
}
