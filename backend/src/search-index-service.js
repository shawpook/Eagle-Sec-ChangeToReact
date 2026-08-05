import path from 'node:path';
import { isTextThumbnailExtension } from './file-format-policy.js';
import { readTextSnippet } from './text-document-support.js';

export const SEARCH_INDEX_VERSION = 2;
export const MAX_TEXT_SEARCH_CHARS = 20_000;
const TEXT_SEARCH_READ_BYTES = 128 * 1024;

function extractTextContent(rootDir, item) {
  if (!isTextThumbnailExtension(item.ext)) return '';
  const source = path.join(rootDir, 'images', `${item.id}.info`, `${item.name}.${item.ext}`);
  try {
    const snippet = readTextSnippet(source, { maxBytes: TEXT_SEARCH_READ_BYTES });
    return snippet.content.slice(0, MAX_TEXT_SEARCH_CHARS);
  } catch (err) {
    return '';
  }
}

export function buildSearchIndex(library) {
  const previous = new Map(
    Array.isArray(library.searchIndex?.items)
      ? library.searchIndex.items.map((entry) => [entry.id, entry])
      : []
  );
  const items = (library.items || []).map((item) => {
    const freshnessKey = `${item.lastModified || item.modificationTime || 0}:${item.size || 0}`;
    const entry = {
      id: item.id,
      name: item.name,
      ext: item.ext,
      tags: item.tags || [],
      folders: item.folders || [],
      annotation: item.annotation || '',
      url: item.url || '',
      star: item.star || 0,
      modificationTime: item.modificationTime || 0,
      searchVersion: SEARCH_INDEX_VERSION,
      freshnessKey,
    };
    const cached = previous.get(item.id);
    if (cached && cached.freshnessKey === freshnessKey && typeof cached.textContent === 'string') {
      entry.textContent = cached.textContent;
    } else {
      entry.textContent = extractTextContent(library.rootDir, item);
    }
    return entry;
  });
  return {
    version: SEARCH_INDEX_VERSION,
    updatedAt: Date.now(),
    items,
  };
}
