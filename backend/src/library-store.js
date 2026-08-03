import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '../..');
const mockLibraryDir = path.join(projectRoot, 'frontend/public/mock-library');
const reverseRoot = path.resolve(projectRoot, '..');

const defaultFolders = [
  {
    id: 'FOLDER-ROOT',
    name: '设计参考',
    description: '从原版资源中整理的界面素材',
    children: [
      { id: 'FOLDER-WELCOME', name: '欢迎 / 引导', children: [], modificationTime: 0 },
      { id: 'FOLDER-EMPTY', name: '空状态', children: [], modificationTime: 0 },
      { id: 'FOLDER-PLUGIN', name: '插件 / 工具', children: [], modificationTime: 0 },
    ],
    modificationTime: 0,
  },
];

const defaultSmartFolders = [
  { id: 'SMART-STAR', name: '五星收藏', description: '', conditions: [], modificationTime: 0 },
  { id: 'SMART-UI', name: 'UI 参考', description: '', conditions: [], modificationTime: 0 },
];

const defaultTagsGroups = [
  { id: 'TAGGROUP-DESIGN', name: '设计', tags: ['UI', '欢迎', '空状态', '插件'], modificationTime: 0 },
  { id: 'TAGGROUP-WORKFLOW', name: '流程', tags: ['注册', '授权', '回收站'], modificationTime: 0 },
];

function readJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    return fallback;
  }
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2), 'utf8');
}

function readCache(file) {
  if (!fs.existsSync(file)) return null;
  return fs
    .readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function scanItemMetadata(rootDir) {
  const imagesDir = path.join(rootDir, 'images');
  if (!fs.existsSync(imagesDir)) return [];
  const items = [];
  for (const dirName of fs.readdirSync(imagesDir, { withFileTypes: true })) {
    if (!dirName.isDirectory() || !dirName.name.endsWith('.info')) continue;
    const metaFile = path.join(imagesDir, dirName.name, 'metadata.json');
    if (fs.existsSync(metaFile)) {
      const item = readJson(metaFile, null);
      if (item && item.id) items.push(item);
    }
  }
  return items;
}

function buildSearchIndex(items) {
  return {
    version: 1,
    updatedAt: Date.now(),
    items: items.map((item) => ({
      id: item.id,
      name: item.name,
      ext: item.ext,
      tags: item.tags || [],
      folders: item.folders || [],
      annotation: item.annotation || '',
      url: item.url || '',
      star: item.star || 0,
      modificationTime: item.modificationTime || 0,
    })),
  };
}

function saveSearchIndex(library, index) {
  writeJson(path.join(library.rootDir, 'search-index.json'), index);
}

export function resolveLibraryPath(input) {
  if (!input) return null;
  let value = String(input).replace(/\\/g, '/');
  if (value.startsWith('/mock-library/')) {
    return path.join(mockLibraryDir, value.replace(/^\/mock-library\//, ''));
  }
  if (value.startsWith('/src/')) {
    return path.join(reverseRoot, value.replace(/^\//, ''));
  }
  const absolute = path.resolve(value);
  if (fs.existsSync(absolute)) return absolute;
  if (value.endsWith('.library') && !path.isAbsolute(value)) {
    return path.join(reverseRoot, 'library-example', value);
  }
  return absolute;
}

export function defaultMockLibrary() {
  return '/mock-library/Eagle Reverse Demo.library';
}

export function loadLibrary(input = defaultMockLibrary()) {
  const rootDir = resolveLibraryPath(input);
  if (!rootDir || !fs.existsSync(rootDir)) {
    throw new Error(`Library not found: ${input}`);
  }
  const metadata = readJson(path.join(rootDir, 'metadata.json'), {
    applicationVersion: '4.0.0',
    folders: [],
    smartFolders: [],
    quickAccess: [],
    tagsGroups: [],
    modificationTime: Date.now(),
  });
  const tags = readJson(path.join(rootDir, 'tags.json'), { historyTags: [], starredTags: [] });
  const savedFilters = readJson(path.join(rootDir, 'saved-filters.json'), []);
  const cacheItems = readCache(path.join(rootDir, 'cache.json'));
  const items = cacheItems || scanItemMetadata(rootDir);
  const searchIndexFile = path.join(rootDir, 'search-index.json');
  const searchIndex = fs.existsSync(searchIndexFile)
    ? readJson(searchIndexFile, buildSearchIndex(items))
    : buildSearchIndex(items);
  const libraryName = path.basename(rootDir).replace(/\.library$/i, '') || 'Untitled';
  const isMock = rootDir.startsWith(mockLibraryDir + path.sep);

  let folders = readJson(path.join(rootDir, 'folders.json'), null);
  if (folders === null) {
    if (isMock && Array.isArray(metadata.folders) && metadata.folders.length > 0) {
      folders = defaultFolders;
    } else {
      folders = Array.isArray(metadata.folders) ? metadata.folders : [];
    }
  }

  const smartFolders = Array.isArray(metadata.smartFolders) && metadata.smartFolders.length > 0
    ? metadata.smartFolders
    : (isMock ? defaultSmartFolders : []);
  const tagsGroups = Array.isArray(metadata.tagsGroups) && metadata.tagsGroups.length > 0
    ? metadata.tagsGroups
    : (isMock ? defaultTagsGroups : []);
  const quickAccess = Array.isArray(metadata.quickAccess) ? metadata.quickAccess : [];

  return {
    rootDir,
    libraryPath: input,
    libraryName,
    metadata,
    tags,
    savedFilters,
    folders,
    smartFolders,
    quickAccess,
    tagsGroups,
    items,
    searchIndex,
    itemMap: new Map(items.map((item) => [item.id, item])),
  };
}

export function saveLibraryState(library) {
  const rootDir = library.rootDir;
  writeJson(path.join(rootDir, 'metadata.json'), library.metadata);
  writeJson(path.join(rootDir, 'tags.json'), library.tags);
  writeJson(path.join(rootDir, 'saved-filters.json'), library.savedFilters);
  writeJson(path.join(rootDir, 'folders.json'), library.folders);
}

export function itemOriginalPath(library, item) {
  return path.join(library.rootDir, 'images', `${item.id}.info`, `${item.name}.${item.ext}`);
}

export function itemThumbnailPath(library, item) {
  return path.join(library.rootDir, 'images', `${item.id}.info`, `${item.name}_thumbnail.png`);
}

export function saveItems(library) {
  const cacheFile = path.join(library.rootDir, 'cache.json');
  fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
  fs.writeFileSync(cacheFile, library.items.map((item) => JSON.stringify(item)).join('\n') + '\n', 'utf8');
  for (const item of library.items) {
    const dir = path.join(library.rootDir, 'images', `${item.id}.info`);
    fs.mkdirSync(dir, { recursive: true });
    writeJson(path.join(dir, 'metadata.json'), item);
  }
  library.searchIndex = buildSearchIndex(library.items);
  saveSearchIndex(library, library.searchIndex);
  library.metadata.modificationTime = Date.now();
  saveLibraryState(library);
  library.itemMap = new Map(library.items.map((item) => [item.id, item]));
}

export function saveItem(library, item) {
  const index = library.items.findIndex((entry) => entry.id === item.id);
  if (index >= 0) library.items[index] = item;
  else library.items.unshift(item);
  saveItems(library);
  return item;
}

export function createFolder(library, params = {}) {
  const folder = {
    id: `FOLDER-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
    name: String(params.name || params.folderName || 'New Folder').trim() || 'New Folder',
    description: params.description || '',
    children: [],
    modificationTime: Date.now(),
  };
  if (params.parentID) {
    const parent = findFolder(library.folders, params.parentID);
    if (parent) parent.children.push(folder);
    else library.folders.push(folder);
  } else {
    library.folders.push(folder);
  }
  if (!library.metadata.folders.includes(folder.id)) library.metadata.folders.push(folder.id);
  library.metadata.modificationTime = Date.now();
  saveLibraryState(library);
  return folder;
}

export function findFolder(tree, id) {
  for (const folder of tree || []) {
    if (folder.id === id) return folder;
    const child = findFolder(folder.children, id);
    if (child) return child;
  }
  return null;
}

export function updateFolder(library, id, patch = {}) {
  const folder = findFolder(library.folders, id);
  if (!folder) return null;
  Object.assign(folder, patch, { id, modificationTime: Date.now() });
  library.metadata.modificationTime = Date.now();
  saveLibraryState(library);
  return folder;
}

export function removeFolder(library, id) {
  const removeFrom = (tree) => {
    for (let index = 0; index < tree.length; index += 1) {
      if (tree[index].id === id) {
        tree.splice(index, 1);
        return true;
      }
      if (removeFrom(tree[index].children || [])) return true;
    }
    return false;
  };
  const removed = removeFrom(library.folders);
  if (removed) {
    library.metadata.folders = (library.metadata.folders || []).filter((folderId) => folderId !== id);
    library.metadata.modificationTime = Date.now();
    saveLibraryState(library);
  }
  return removed;
}
