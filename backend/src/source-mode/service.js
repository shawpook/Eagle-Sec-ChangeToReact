import fs from 'node:fs';
import path from 'node:path';
import { SourceModeDatabase } from './source-db.js';
import { SourceIndexer } from './source-indexer.js';
import { SourceWatcher } from './source-watcher.js';
import { SourceThumbnailService } from './source-thumbnails.js';

function sourceFolderId(rootId, relativePath = '') {
  const safe = String(relativePath || '').replace(/[^a-zA-Z0-9_\-.]/g, '-') || 'root';
  return `SRC-${rootId}-${safe}`;
}

function mapSourceDirectoryNode(node, rootId, ancestors = []) {
  const id = sourceFolderId(rootId, node.relativePath);
  return {
    id,
    name: node.name,
    children: (node.children || []).map((child) => mapSourceDirectoryNode(child, rootId, [...ancestors, id])),
    images: [],
  };
}

export function createSourceModeService(libraryRoot, options = {}) {
  const db = new SourceModeDatabase(libraryRoot);
  const indexer = new SourceIndexer(db, {
    onActivity: options.onActivity || ((activity) => {
      if (options.onActivity) options.onActivity(activity);
    }),
  });
  const thumbnails = new SourceThumbnailService(db);
  const watcher = new SourceWatcher(db, indexer);
  const service = {
    db,
    indexer,
    thumbnails,
    watcher,
    getState() {
      return {
        ...db.readState(),
        libraryPath: db.libraryRoot,
        sourceRoots: indexer.buildTree(),
      };
    },
    setState(state) {
      const next = {
        ...db.readState(),
        ...state,
      };
      db.writeState(next);
      return next;
    },
    scanRoot(id, relativePath) {
      return indexer.scanRoot(id, relativePath);
    },
    getVirtualLibrary(sourceRootId = '') {
      const roots = indexer.buildTree();
      const root = roots.find((entry) => entry.id === sourceRootId) || roots[0] || null;
      const rootId = root ? root.id : '';
      const rootFolderId = rootId ? sourceFolderId(rootId) : '';
      const folders = root
        ? [{
          id: rootFolderId,
          name: root.name,
          children: (root.directories || []).map((directory) => mapSourceDirectoryNode(directory, rootId)),
          images: [],
        }]
        : [];
      const folderIdByRelativePath = new Map([['.', rootFolderId]]);
      const collectFolderIds = (directory) => {
        folderIdByRelativePath.set(directory.relativePath, sourceFolderId(rootId, directory.relativePath));
        for (const child of directory.children || []) collectFolderIds(child);
      };
      if (root) {
        for (const directory of root.directories || []) collectFolderIds(directory);
      }
      const assets = root ? indexer.listAllAssets(root.id) : [];
      const items = assets.map((asset) => {
        const dirname = path.posix.dirname(asset.relativePath);
        const folderChain = [];
        let current = dirname;
        while (current && current !== '.') {
          const folderId = folderIdByRelativePath.get(current);
          if (folderId) folderChain.unshift(folderId);
          current = path.posix.dirname(current);
        }
        const foldersForItem = rootFolderId ? [rootFolderId, ...folderChain] : [];
        return {
          id: asset.id,
          sourceAssetId: asset.id,
          name: asset.name,
          ext: asset.ext,
          size: asset.sizeBytes,
          width: asset.width,
          height: asset.height,
          url: '',
          website: '',
          annotation: '',
          tags: [],
          folders: foldersForItem,
          star: 0,
          modificationTime: asset.mtimeMs,
          lastModified: asset.mtimeMs,
          palettes: [],
          noThumbnail: asset.kind !== 'image',
          isDeleted: false,
        };
      });
      const cachePath = path.join(db.root, 'virtual-cache.json');
      fs.writeFileSync(cachePath, `${items.map((item) => JSON.stringify(item)).join('\n')}\n`, 'utf8');
      const rootDir = root ? root.path : db.libraryRoot;
      return {
        mode: 'source',
        sourceRootId: rootId,
        relativePath: '.',
        rootDir,
        imagesDir: `${rootDir}${path.sep}`,
        cachePath,
        imagesStringPath: cachePath,
        folders,
        smartFolders: [],
        quickAccess: [],
        tagsGroups: [],
        items,
      };
    },
    dispose() {
      watcher.dispose();
      db.dispose();
    },
  };
  watcher.watchAll();
  return service;
}
