import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { commitLibrarySnapshot } from './library-transaction-coordinator.js';

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

function writeAtomicFile(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}.tmp`;
  fs.writeFileSync(temp, data, 'utf8');
  fs.renameSync(temp, file);
}

function writeJsonAtomic(file, value) {
  writeAtomicFile(file, JSON.stringify(value, null, 2));
}

function fileSnapshot(file) {
  if (!fs.existsSync(file)) return { file, existed: false, data: null };
  return { file, existed: true, data: fs.readFileSync(file, 'utf8') };
}

function restoreFileSnapshot(snapshot) {
  if (!snapshot.existed) {
    fs.rmSync(snapshot.file, { force: true });
    return;
  }
  writeAtomicFile(snapshot.file, snapshot.data);
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
  writeJsonAtomic(path.join(library.rootDir, 'search-index.json'), index);
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
  return commitLibrarySnapshot(library);
}

export function itemOriginalPath(library, item) {
  return path.join(library.rootDir, 'images', `${item.id}.info`, `${item.name}.${item.ext}`);
}

export function itemThumbnailPath(library, item) {
  return path.join(library.rootDir, 'images', `${item.id}.info`, `${item.name}_thumbnail.png`);
}

export function saveItems(library, options = {}) {
  return commitLibrarySnapshot(library, options);
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
  const parentId = params.parentID || params.parentId;
  if (parentId) {
    const parent = findFolder(library.folders, parentId);
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
  // 删除文件夹时同步清理条目引用，不删除原文件。
  const collectIds = (folder, ids = []) => {
    ids.push(folder.id);
    for (const child of folder.children || []) collectIds(child, ids);
    return ids;
  };
  const target = findFolder(library.folders, id);
  if (!target) return false;
  const removedIds = collectIds(target);
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
    library.metadata.folders = (library.metadata.folders || []).filter((folderId) => !removedIds.includes(folderId));
    for (const item of library.items) {
      item.folders = (item.folders || []).filter((folderId) => !removedIds.includes(folderId));
    }
    library.metadata.modificationTime = Date.now();
    saveItems(library);
  }
  return removed;
}

function detachFolder(tree, id) {
  for (let index = 0; index < tree.length; index += 1) {
    if (tree[index].id === id) {
      const folder = tree[index];
      tree.splice(index, 1);
      return { folder, index };
    }
    const found = detachFolder(tree[index].children || [], id);
    if (found) return found;
  }
  return null;
}

function isDescendant(folder, candidateId) {
  if (folder.id === candidateId) return true;
  return (folder.children || []).some((child) => isDescendant(child, candidateId));
}

export function moveFolder(library, id, parentId, index) {
  // 移动文件夹到目标父级，禁止移入自身或子孙节点形成循环。
  const folder = findFolder(library.folders, id);
  if (!folder) throw new Error('Folder not found');
  const parent = parentId ? findFolder(library.folders, parentId) : null;
  if (parentId && !parent) throw new Error('Target folder not found');
  if (parent && (parent.id === folder.id || isDescendant(folder, parent.id))) {
    throw new Error('Cannot move a folder into itself or its descendant');
  }
  const detached = detachFolder(library.folders, id);
  if (!detached) throw new Error('Folder not found');
  const target = parent ? parent.children : library.folders;
  const insertAt = Number.isInteger(index) && index >= 0 && index <= target.length ? index : target.length;
  target.splice(insertAt, 0, detached.folder);
  library.metadata.folders = collectFolderIds(library.folders);
  library.metadata.modificationTime = Date.now();
  saveLibraryState(library);
  return folder;
}

function collectFolderIds(tree, ids = []) {
  for (const folder of tree || []) {
    ids.push(folder.id);
    collectFolderIds(folder.children || [], ids);
  }
  return ids;
}

export function findSmartFolder(tree, id) {
  for (const folder of tree || []) {
    if (folder.id === id) return folder;
    const child = findSmartFolder(folder.children || [], id);
    if (child) return child;
  }
  return null;
}

function collectSmartFolderIds(tree, ids = []) {
  for (const folder of tree || []) {
    ids.push(folder.id);
    collectSmartFolderIds(folder.children || [], ids);
  }
  return ids;
}

function detachSmartFolder(tree, id) {
  for (let index = 0; index < tree.length; index += 1) {
    if (tree[index].id === id) {
      const folder = tree[index];
      tree.splice(index, 1);
      return { folder, index };
    }
    const found = detachSmartFolder(tree[index].children || [], id);
    if (found) return found;
  }
  return null;
}

function isSmartFolderDescendant(folder, candidateId) {
  if (folder.id === candidateId) return true;
  return (folder.children || []).some((child) => isSmartFolderDescendant(child, candidateId));
}

export function createSmartFolder(library, params = {}) {
  // 智能文件夹与普通文件夹一样保存为可嵌套树结构。
  const folder = {
    id: `SMART-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
    name: String(params.name || 'New Smart Folder').trim() || 'New Smart Folder',
    description: params.description || '',
    conditions: Array.isArray(params.conditions) ? params.conditions : [],
    children: Array.isArray(params.children) ? params.children : [],
    icon: params.icon,
    iconColor: params.iconColor,
    modificationTime: Date.now(),
  };
  const parentId = params.parentID || params.parentId;
  const parent = parentId ? findSmartFolder(library.smartFolders, parentId) : null;
  if (parentId && !parent) throw new Error('Smart folder parent not found');
  const target = parent ? parent.children : library.smartFolders;
  const index = Number.isInteger(params.index) && params.index >= 0 && params.index <= target.length ? params.index : target.length;
  target.splice(index, 0, folder);
  library.metadata.smartFolders = library.smartFolders;
  library.metadata.modificationTime = Date.now();
  saveLibraryState(library);
  return folder;
}

export function updateSmartFolder(library, id, patch = {}) {
  const folder = findSmartFolder(library.smartFolders, id);
  if (!folder) return null;
  Object.assign(folder, patch, { id, modificationTime: Date.now() });
  if (!Array.isArray(folder.children)) folder.children = [];
  library.metadata.smartFolders = library.smartFolders;
  library.metadata.modificationTime = Date.now();
  saveLibraryState(library);
  return folder;
}

export function removeSmartFolder(library, id) {
  const target = findSmartFolder(library.smartFolders, id);
  if (!target) return false;
  const removedIds = collectSmartFolderIds([target]);
  const removed = detachSmartFolder(library.smartFolders, id);
  if (!removed) return false;
  library.metadata.smartFolders = library.smartFolders;
  library.metadata.modificationTime = Date.now();
  saveLibraryState(library);
  return true;
}

export function moveSmartFolder(library, id, parentId, index) {
  const folder = findSmartFolder(library.smartFolders, id);
  if (!folder) throw new Error('Smart folder not found');
  const parent = parentId ? findSmartFolder(library.smartFolders, parentId) : null;
  if (parentId && !parent) throw new Error('Target smart folder not found');
  if (parent && (parent.id === folder.id || isSmartFolderDescendant(folder, parent.id))) {
    throw new Error('Cannot move a smart folder into itself or its descendant');
  }
  const detached = detachSmartFolder(library.smartFolders, id);
  if (!detached) throw new Error('Smart folder not found');
  const target = parent ? parent.children : library.smartFolders;
  const insertAt = Number.isInteger(index) && index >= 0 && index <= target.length ? index : target.length;
  target.splice(insertAt, 0, detached.folder);
  library.metadata.smartFolders = library.smartFolders;
  library.metadata.modificationTime = Date.now();
  saveLibraryState(library);
  return folder;
}
