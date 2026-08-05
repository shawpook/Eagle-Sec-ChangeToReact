import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  readGeneration,
  readJsonStrict,
  sha256Text,
} from './library-strict.js';

function issue(code, severity, message, details = {}) {
  return {
    id: `ISSUE-${code}-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
    code,
    severity,
    path: details.path || '',
    itemId: details.itemId || '',
    message,
    fixable: Boolean(details.fixable),
    destructive: Boolean(details.destructive),
    suggestedAction: details.suggestedAction || '',
    evidence: details.evidence || {},
  };
}

function arraySchema(name) {
  return (value) => {
    if (!Array.isArray(value)) return `${name} must be an array`;
    return null;
  };
}

function readCacheItems(cacheFile) {
  if (!fs.existsSync(cacheFile)) return [];
  const items = [];
  const errors = [];
  const lines = fs.readFileSync(cacheFile, 'utf8').split(/\r?\n/).filter(Boolean);
  lines.forEach((line, index) => {
    try {
      const value = JSON.parse(line);
      if (!value || !value.id) errors.push(`cache line ${index + 1} has no id`);
      else items.push(value);
    } catch (err) {
      errors.push(`cache line ${index + 1} is invalid JSON`);
    }
  });
  return { items, errors };
}

function collectFolderIds(tree, ids = new Set()) {
  for (const folder of tree || []) {
    if (!folder || !folder.id) continue;
    if (ids.has(folder.id)) return { ids, duplicate: folder.id };
    ids.add(folder.id);
    const child = collectFolderIds(folder.children || [], ids);
    if (child.duplicate) return child;
  }
  return { ids, duplicate: null };
}

export function scanLibraryConsistency(rootDir, options = {}) {
  const issues = [];
  const root = path.resolve(rootDir);
  const metadataFile = path.join(root, 'metadata.json');
  const tagsFile = path.join(root, 'tags.json');
  const savedFiltersFile = path.join(root, 'saved-filters.json');
  const foldersFile = path.join(root, 'folders.json');
  const cacheFile = path.join(root, 'cache.json');
  const searchIndexFile = path.join(root, 'search-index.json');

  let metadata = null;
  let folders = [];
  let tags = null;
  let savedFilters = [];
  let searchIndex = null;
  try {
    metadata = readJsonStrict(metadataFile, {
      allowMissing: false,
      schema: (value) => value && typeof value === 'object' && !Array.isArray(value) ? null : 'metadata.json must be an object',
    });
  } catch (err) {
    issues.push(issue(err.code || 'LIBRARY_JSON_PARSE_ERROR', 'critical', err.message, {
      path: 'metadata.json',
      fixable: false,
    }));
  }
  for (const [file, name, schema, defaultValue] of [
    [tagsFile, 'tags.json', (value) => value && typeof value === 'object' && !Array.isArray(value) ? null : 'tags.json must be an object', { historyTags: [], starredTags: [] }],
    [savedFiltersFile, 'saved-filters.json', arraySchema('saved-filters.json'), []],
    [foldersFile, 'folders.json', arraySchema('folders.json'), []],
    [searchIndexFile, 'search-index.json', (value) => value && typeof value === 'object' && !Array.isArray(value) ? null : 'search-index.json must be an object', null],
  ]) {
    try {
      const parsed = readJsonStrict(file, { allowMissing: true, fallback: defaultValue, schema });
      if (name === 'tags.json') tags = parsed;
      if (name === 'saved-filters.json') savedFilters = parsed;
      if (name === 'folders.json') folders = parsed;
      if (name === 'search-index.json') searchIndex = parsed;
    } catch (err) {
      issues.push(issue(err.code || 'LIBRARY_JSON_PARSE_ERROR', 'error', err.message, {
        path: name,
        fixable: name === 'search-index.json' || name === 'cache.json',
        suggestedAction: name === 'search-index.json' ? 'rebuild-search-index' : '',
      }));
    }
  }

  const cache = readCacheItems(cacheFile);
  for (const error of cache.errors) {
    issues.push(issue('CACHE_INVALID_LINE', 'error', error, {
      path: 'cache.json',
      fixable: true,
      suggestedAction: 'rebuild-cache',
    }));
  }

  const imagesDir = path.join(root, 'images');
  const itemIds = new Set();
  const metadataById = new Map();
  if (fs.existsSync(imagesDir)) {
    for (const entry of fs.readdirSync(imagesDir, { withFileTypes: true })) {
      const infoDir = path.join(imagesDir, entry.name);
      if (!entry.isDirectory() || !entry.name.endsWith('.info')) {
        if (entry.isFile() || entry.isDirectory()) {
          issues.push(issue('UNEXPECTED_IMAGES_ENTRY', 'warning', `Unexpected entry in images/: ${entry.name}`, {
            path: `images/${entry.name}`,
            destructive: true,
          }));
        }
        continue;
      }
      const itemId = entry.name.slice(0, -'.info'.length);
      if (itemIds.has(itemId)) {
        issues.push(issue('DUPLICATE_ITEM_ID', 'error', `Duplicate item ID directory: ${itemId}`, {
          path: `images/${entry.name}`,
          itemId,
        }));
      }
      itemIds.add(itemId);
      const metaFile = path.join(infoDir, 'metadata.json');
      let item = null;
      try {
        item = readJsonStrict(metaFile, {
          allowMissing: false,
          schema: (value) => value && typeof value === 'object' && !Array.isArray(value) ? null : 'item metadata.json must be an object',
        });
      } catch (err) {
        issues.push(issue(err.code || 'ITEM_METADATA_INVALID', 'error', err.message, {
          path: `images/${entry.name}/metadata.json`,
          itemId,
          fixable: false,
        }));
      }
      if (item && item.id) {
        if (item.id !== itemId) {
          issues.push(issue('INFO_DIRECTORY_ID_MISMATCH', 'error', `metadata.id ${item.id} does not match directory ${itemId}`, {
            path: `images/${entry.name}/metadata.json`,
            itemId,
          }));
        }
        metadataById.set(item.id, item);
        if (item.name && item.ext) {
          const original = path.join(infoDir, `${item.name}.${item.ext}`);
          if (!fs.existsSync(original) || !fs.statSync(original).isFile()) {
            issues.push(issue('MISSING_ORIGINAL_FILE', 'error', `Original file is missing: ${item.name}.${item.ext}`, {
              path: `images/${entry.name}/${item.name}.${item.ext}`,
              itemId: item.id,
              fixable: false,
            }));
          }
          const thumbnail = path.join(infoDir, `${item.name}_thumbnail.png`);
          if (!item.noThumbnail && !fs.existsSync(thumbnail)) {
            issues.push(issue('MISSING_THUMBNAIL', 'warning', `Thumbnail is missing: ${item.name}_thumbnail.png`, {
              path: `images/${entry.name}/${item.name}_thumbnail.png`,
              itemId: item.id,
              fixable: true,
              suggestedAction: 'generate-thumbnail',
            }));
          }
        }
      }
    }
  }

  const cacheIds = new Set(cache.items.map((item) => item.id));
  for (const itemId of itemIds) {
    if (!cacheIds.has(itemId)) {
      issues.push(issue('CACHE_ITEM_MISSING', 'warning', `cache.json does not contain item ${itemId}`, {
        path: 'cache.json',
        itemId,
        fixable: true,
        suggestedAction: 'rebuild-cache',
      }));
    }
  }
  for (const cacheItem of cache.items) {
    if (!itemIds.has(cacheItem.id)) {
      issues.push(issue('ORPHAN_CACHE_ITEM', 'warning', `cache.json references missing item directory ${cacheItem.id}`, {
        path: 'cache.json',
        itemId: cacheItem.id,
        fixable: false,
      }));
    }
  }

  const folderTree = folders.length > 0 ? folders : (metadata?.folders || []);
  const folderResult = collectFolderIds(folderTree);
  const treeFolderIds = folderResult.ids;
  if (metadata && Array.isArray(metadata.folders)) {
    const metadataFolderIds = new Set(metadata.folders);
    for (const folderId of metadataFolderIds) {
      if (!treeFolderIds.has(folderId)) {
        issues.push(issue('INVALID_FOLDER_REFERENCE', 'warning', `metadata.folders references missing folder ${folderId}`, {
          path: 'metadata.json',
          fixable: true,
          suggestedAction: 'remove-invalid-folder-reference',
        }));
      }
    }
    for (const cacheItem of cache.items) {
      for (const folderId of cacheItem.folders || []) {
        if (!treeFolderIds.has(folderId)) {
          issues.push(issue('INVALID_FOLDER_REFERENCE', 'warning', `Item ${cacheItem.id} references missing folder ${folderId}`, {
            path: 'cache.json',
            itemId: cacheItem.id,
            fixable: true,
            suggestedAction: 'remove-invalid-folder-reference',
          }));
        }
      }
    }
  }

  if (folderResult.duplicate) {
    issues.push(issue('DUPLICATE_FOLDER_ID', 'error', `Duplicate folder ID: ${folderResult.duplicate}`, {
      path: 'folders.json',
      fixable: true,
      suggestedAction: 'repair-folder-tree',
    }));
  }

  if (searchIndex && Array.isArray(searchIndex.items)) {
    const indexedIds = new Set(searchIndex.items.map((item) => item && item.id));
    for (const itemId of itemIds) {
      if (!indexedIds.has(itemId)) {
        issues.push(issue('SEARCH_INDEX_ITEM_MISSING', 'warning', `search-index.json does not contain item ${itemId}`, {
          path: 'search-index.json',
          itemId,
          fixable: true,
          suggestedAction: 'rebuild-search-index',
        }));
      }
    }
  }

  const generation = metadata ? readGeneration(root) : 0;
  const issuePayload = issues.map((entry) => ({
    id: entry.id,
    code: entry.code,
    severity: entry.severity,
    path: entry.path,
    itemId: entry.itemId,
    message: entry.message,
    fixable: entry.fixable,
    destructive: entry.destructive,
    suggestedAction: entry.suggestedAction,
  }));
  const reportDigest = consistencyReportDigest({ generation, issues });
  return {
    libraryPath: root,
    libraryName: path.basename(root).replace(/\.library$/i, ''),
    generation,
    scannedAt: Date.now(),
    issueCount: issues.length,
    criticalCount: issues.filter((entry) => entry.severity === 'critical').length,
    errorCount: issues.filter((entry) => entry.severity === 'error').length,
    warningCount: issues.filter((entry) => entry.severity === 'warning').length,
    reportDigest,
    issues,
  };
}

export function verifyScanReport(rootDir, report) {
  const current = scanLibraryConsistency(rootDir);
  if (!report || !report.reportDigest) return { ok: false, reason: 'missing report digest' };
  if (current.generation !== Number(report.generation)) {
    return { ok: false, reason: 'generation changed' };
  }
  if (current.reportDigest !== report.reportDigest) {
    return { ok: false, reason: 'report digest changed' };
  }
  return { ok: true, report: current };
}

export function consistencyReportDigest(report) {
  return crypto.createHash('sha256').update(JSON.stringify({
    generation: report.generation,
    issues: report.issues.map((entry) => ({
      code: entry.code,
      path: entry.path,
      severity: entry.severity,
    })),
  })).digest('hex');
}
