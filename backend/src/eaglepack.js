import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import AdmZip from 'adm-zip';
import { itemOriginalPath, loadLibrary, saveItems, saveLibraryState } from './library-store.js';

function zipModule() {
  return AdmZip.default || AdmZip;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeEntryName(value) {
  return String(value || '').replace(/\\/g, '/').replace(/^\/+/, '');
}

function ensureSafeEntryName(value) {
  const name = normalizeEntryName(value);
  if (!name || name.split('/').includes('..') || path.isAbsolute(name)) {
    throw new Error(`Unsafe Eaglepack entry: ${value}`);
  }
  return name;
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2), 'utf8');
}

function sha1(buffer) {
  return crypto.createHash('sha1').update(buffer).digest('hex');
}

function fileSha1(file) {
  if (!fs.existsSync(file)) return null;
  return sha1(fs.readFileSync(file));
}

function nextId(usedIds) {
  let id;
  do {
    id = `ITEM-${Date.now()}-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
  } while (usedIds.has(id));
  usedIds.add(id);
  return id;
}

function nextFolderId(usedIds) {
  let id;
  do {
    id = `FOLDER-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
  } while (usedIds.has(id));
  usedIds.add(id);
  return id;
}

function walkFolders(folders, callback) {
  for (const folder of folders || []) {
    callback(folder);
    walkFolders(folder.children || [], callback);
  }
}

function allFolderIds(folders) {
  const ids = [];
  walkFolders(folders, (folder) => {
    if (folder.id) ids.push(folder.id);
  });
  return ids;
}

function remapFolderTree(sourceFolders, usedFolderIds, itemIdMap) {
  const folders = clone(sourceFolders || []);
  const folderIdMap = new Map();
  walkFolders(folders, (folder) => {
    if (folder.id) folderIdMap.set(folder.id, nextFolderId(usedFolderIds));
  });
  walkFolders(folders, (folder) => {
    const oldId = folder.id;
    folder.id = folderIdMap.get(oldId) || nextFolderId(usedFolderIds);
    folder.isExpand = true;
    folder.modificationTime = Date.now();
    if (folder.coverId) folder.coverId = itemIdMap.get(folder.coverId) || '';
    delete folder.images;
  });
  return { folders, folderIdMap };
}

function exportableItem(item, preserveFolders) {
  const result = clone(item);
  for (const key of ['encodeName', 'disable', 'buffer', 'startAt', 'oldName', 'newName', 'playing', 'thumbnailPath', 'rawPath', '$$hashKey', 'activating', 'deactivating']) {
    delete result[key];
  }
  if (!preserveFolders) result.folders = [];
  if (result.isDeleted) {
    result.folders = [];
    delete result.isDeleted;
  }
  return result;
}

function resolveSelectedItems(library, options) {
  if (!Array.isArray(options.items) || options.items.length === 0) {
    return library.items.filter((item) => !item.isDeleted);
  }
  const ids = new Set(options.items.map((item) => typeof item === 'string' ? item : item.id));
  return library.items.filter((item) => ids.has(item.id));
}

function findFolderById(folders, id) {
  let result = null;
  walkFolders(folders, (folder) => {
    if (!result && folder.id === id) result = folder;
  });
  return result;
}

export function packLibrary(library, destFile, options = {}) {
  const Zip = zipModule();
  const zip = new Zip();
  const onProgress = typeof options.onProgress === 'function' ? options.onProgress : () => {};
  const selected = resolveSelectedItems(library, options);
  const sourceFolder = options.folder || (options.folderId ? findFolderById(library.folders, options.folderId) : null);
  const pack = {
    images: selected
      .map((item) => exportableItem(item, Boolean(sourceFolder || options.includeLibraryState)))
      .sort((left, right) => Number(right.modificationTime || 0) - Number(left.modificationTime || 0)),
  };
  if (sourceFolder) pack.folder = clone(sourceFolder);

  zip.addFile('pack.json', Buffer.from(JSON.stringify(pack), 'utf8'));
  let processed = 0;
  for (const item of pack.images) {
    const infoDir = path.join(library.rootDir, 'images', `${item.id}.info`);
    const originalFile = path.join(infoDir, `${item.name}.${item.ext}`);
    if (!fs.existsSync(infoDir) || !fs.statSync(infoDir).isDirectory()) {
      throw new Error(`Eaglepack item directory is missing: ${item.id}`);
    }
    if (!fs.existsSync(originalFile)) {
      throw new Error(`Eaglepack original file is missing: ${item.id}`);
    }
    zip.addLocalFolder(infoDir, `${item.id}.info`);
    processed += 1;
    onProgress({ current: processed, total: pack.images.length });
  }

  if (options.includeLibraryState) {
    zip.addFile('_eagle_sec/library.json', Buffer.from(JSON.stringify({
      metadata: library.metadata,
      tags: library.tags,
      savedFilters: library.savedFilters,
      folders: library.folders,
      smartFolders: library.smartFolders,
      quickAccess: library.quickAccess,
      tagsGroups: library.tagsGroups,
    }), 'utf8'));
  }

  fs.mkdirSync(path.dirname(destFile), { recursive: true });
  zip.writeZip(destFile);
  return destFile;
}

function initializeLibrary(destDir, internalState) {
  fs.mkdirSync(path.join(destDir, 'images'), { recursive: true });
  const metadata = clone(internalState?.metadata || {
    applicationVersion: '4.0.0',
    folders: [],
    smartFolders: [],
    quickAccess: [],
    tagsGroups: [],
    modificationTime: Date.now(),
  });
  metadata.folders = [];
  metadata.modificationTime = Date.now();
  writeJson(path.join(destDir, 'metadata.json'), metadata);
  writeJson(path.join(destDir, 'tags.json'), internalState?.tags || { historyTags: [], starredTags: [] });
  writeJson(path.join(destDir, 'saved-filters.json'), internalState?.savedFilters || []);
  writeJson(path.join(destDir, 'folders.json'), []);
  fs.writeFileSync(path.join(destDir, 'cache.json'), '', 'utf8');
}

function entryMap(zip) {
  const map = new Map();
  for (const entry of zip.getEntries()) {
    const name = ensureSafeEntryName(entry.entryName);
    map.set(name, entry);
  }
  return map;
}

function infoEntries(entries, itemId, prefix = '') {
  const root = `${prefix}${itemId}.info/`;
  return Array.from(entries.entries())
    .filter(([name]) => name.startsWith(root) && name.length > root.length)
    .map(([name, entry]) => ({ relative: name.slice(root.length), entry }));
}

function originalEntry(entries, item, prefix = '') {
  const exact = entries.get(`${prefix}${item.id}.info/${item.name}.${item.ext}`);
  if (exact && !exact.isDirectory) return exact;
  return infoEntries(entries, item.id, prefix)
    .find(({ relative, entry }) => !entry.isDirectory && relative !== 'metadata.json' && !/_thumbnail\.[^/]+$/i.test(relative))?.entry || null;
}

function copyInfoDirectory(entries, oldItem, newItem, destDir, prefix = '') {
  const files = infoEntries(entries, oldItem.id, prefix);
  if (files.length === 0) throw new Error(`Eaglepack item directory is missing: ${oldItem.id}`);
  const output = path.join(destDir, 'images', `${newItem.id}.info`);
  fs.mkdirSync(output, { recursive: true });
  for (const { relative, entry } of files) {
    const safeRelative = ensureSafeEntryName(relative);
    if (safeRelative === 'metadata.json') continue;
    const target = path.resolve(output, safeRelative);
    if (target !== output && !target.startsWith(`${output}${path.sep}`)) {
      throw new Error(`Unsafe Eaglepack item entry: ${relative}`);
    }
    if (entry.isDirectory) fs.mkdirSync(target, { recursive: true });
    else {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, entry.getData());
    }
  }
  writeJson(path.join(output, 'metadata.json'), newItem);
}

function mergeTagState(library, internalState) {
  if (!internalState) return;
  library.tags.historyTags = [...new Set([...(library.tags.historyTags || []), ...(internalState.tags?.historyTags || [])])];
  library.tags.starredTags = [...new Set([...(library.tags.starredTags || []), ...(internalState.tags?.starredTags || [])])];
  library.savedFilters = [...(library.savedFilters || []), ...(internalState.savedFilters || [])];
  library.smartFolders = [...(library.smartFolders || []), ...(internalState.smartFolders || [])];
  library.quickAccess = [...new Set([...(library.quickAccess || []), ...(internalState.quickAccess || [])])];
  library.tagsGroups = [...(library.tagsGroups || []), ...(internalState.tagsGroups || [])];
  library.metadata.smartFolders = library.smartFolders;
  library.metadata.quickAccess = library.quickAccess;
  library.metadata.tagsGroups = library.tagsGroups;
}

function importOriginalPack(zip, entries, pack, destDir, options) {
  if (!Array.isArray(pack.images)) throw new Error('Eaglepack pack.json images is invalid');
  const internalEntry = entries.get('_eagle_sec/library.json');
  const internalState = internalEntry ? JSON.parse(internalEntry.getData().toString('utf8')) : null;
  const exists = fs.existsSync(path.join(destDir, 'metadata.json'));
  if (options.mode === 'replace' && fs.existsSync(destDir)) fs.rmSync(destDir, { recursive: true, force: true });
  if (!exists || options.mode === 'replace') initializeLibrary(destDir, internalState);
  const library = loadLibrary(destDir);
  const existingHashes = new Set(library.items.map((item) => fileSha1(itemOriginalPath(library, item))).filter(Boolean));
  const usedItemIds = new Set(library.items.map((item) => item.id));
  const usedFolderIds = new Set(allFolderIds(library.folders));
  const itemIdMap = new Map();
  const selected = [];

  for (const sourceItem of pack.images) {
    if (!sourceItem || !sourceItem.id || !sourceItem.name || !sourceItem.ext) {
      throw new Error('Eaglepack contains invalid item metadata');
    }
    const sourceOriginal = originalEntry(entries, sourceItem);
    if (!sourceOriginal) throw new Error(`Eaglepack original file is missing: ${sourceItem.id}`);
    if (existingHashes.has(sha1(sourceOriginal.getData()))) continue;
    const newId = nextId(usedItemIds);
    itemIdMap.set(sourceItem.id, newId);
    selected.push(sourceItem);
  }

  const sourceFolders = pack.folder ? [pack.folder] : (internalState?.folders || []);
  const remapped = remapFolderTree(sourceFolders, usedFolderIds, itemIdMap);
  const importedItems = [];
  for (let index = 0; index < selected.length; index += 1) {
    const sourceItem = selected[index];
    const newItem = clone(sourceItem);
    newItem.id = itemIdMap.get(sourceItem.id);
    newItem.modificationTime = Date.now() + index;
    newItem.lastModified = Number(newItem.lastModified) || newItem.modificationTime;
    newItem.isDeleted = false;
    if (pack.folder || internalState?.folders) {
      newItem.folders = (sourceItem.folders || []).map((id) => remapped.folderIdMap.get(id)).filter(Boolean);
    } else if (options.folderId) {
      newItem.folders = [options.folderId];
    } else {
      newItem.folders = [];
    }
    if (newItem.order && typeof newItem.order === 'object') {
      const order = {};
      for (const [folderId, value] of Object.entries(newItem.order)) {
        const mapped = remapped.folderIdMap.get(folderId);
        if (mapped) order[mapped] = value;
      }
      newItem.order = order;
    }
    copyInfoDirectory(entries, sourceItem, newItem, destDir);
    importedItems.push(newItem);
  }

  if (importedItems.length > 0 && remapped.folders.length > 0) {
    library.folders.push(...remapped.folders);
  }
  library.items.unshift(...importedItems);
  library.metadata.folders = allFolderIds(library.folders);
  mergeTagState(library, internalState);
  saveItems(library);
  saveLibraryState(library);
  return {
    manifest: { format: 'eaglepack', version: 2, source: 'pack.json' },
    pack,
    library,
    imported: importedItems.length,
    skipped: pack.images.length - importedItems.length,
    merged: exists && options.mode !== 'replace',
  };
}

function importLegacyPack(zip, entries, manifest, destDir, options) {
  const exists = fs.existsSync(path.join(destDir, 'metadata.json'));
  if (options.mode === 'replace' && fs.existsSync(destDir)) fs.rmSync(destDir, { recursive: true, force: true });
  if (!exists || options.mode === 'replace') {
    for (const [name, entry] of entries) {
      if (entry.isDirectory) continue;
      if (!['metadata.json', 'tags.json', 'saved-filters.json', 'cache.json'].includes(name) && !name.startsWith('images/')) continue;
      const target = path.resolve(destDir, name);
      if (target !== destDir && !target.startsWith(`${destDir}${path.sep}`)) throw new Error(`Unsafe Eaglepack entry: ${name}`);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, entry.getData());
    }
    return { manifest, library: loadLibrary(destDir), imported: manifest.items?.length || 0, skipped: 0, merged: false };
  }

  const library = loadLibrary(destDir);
  const usedIds = new Set(library.items.map((item) => item.id));
  let imported = 0;
  for (const source of manifest.items || []) {
    if (usedIds.has(source.id)) continue;
    const metadataEntry = entries.get(`images/${source.id}.info/metadata.json`);
    if (!metadataEntry) continue;
    const item = JSON.parse(metadataEntry.getData().toString('utf8'));
    copyInfoDirectory(entries, item, item, destDir, 'images/');
    library.items.push(item);
    usedIds.add(item.id);
    imported += 1;
  }
  saveItems(library);
  return { manifest, library, imported, skipped: (manifest.items?.length || 0) - imported, merged: true };
}

export function importEaglepack(zipFile, destDir, options = {}) {
  if (!fs.existsSync(zipFile)) throw new Error('Eaglepack file not found');
  const Zip = zipModule();
  const zip = new Zip(zipFile);
  const entries = entryMap(zip);
  const packEntry = entries.get('pack.json');
  if (packEntry) {
    const pack = JSON.parse(packEntry.getData().toString('utf8'));
    return importOriginalPack(zip, entries, pack, path.resolve(destDir), { mode: options.mode || 'merge', folderId: options.folderId });
  }
  const manifestEntry = entries.get('manifest.json');
  if (!manifestEntry) throw new Error('Eaglepack pack.json is missing');
  const manifest = JSON.parse(manifestEntry.getData().toString('utf8'));
  if (manifest.format !== 'eaglepack') throw new Error(`Unsupported pack format: ${manifest.format}`);
  return importLegacyPack(zip, entries, manifest, path.resolve(destDir), { mode: options.mode || 'merge' });
}
