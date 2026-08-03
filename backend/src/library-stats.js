import fs from 'node:fs';
import path from 'node:path';
import { itemOriginalPath, saveItems } from './library-store.js';
import { ensureThumbnail, generateThumbnailAsync } from './thumbnailer.js';
import { findDuplicates } from './duplicates.js';

function countFolders(tree) {
  let count = 0;
  for (const folder of tree || []) {
    count += 1;
    count += countFolders(folder.children || []);
  }
  return count;
}

export function computeStats(library) {
  const items = library.items || [];
  const now = Date.now();
  const recentDay = 7 * 86400000;
  let totalSize = 0;
  let missingOriginal = 0;
  let missingMetadata = 0;
  let noThumbnail = 0;
  let recentlyAdded = 0;

  for (const item of items) {
    totalSize += Number(item.size) || 0;
    if (!item.metadata && !fs.existsSync(path.join(library.rootDir, 'images', `${item.id}.info`, 'metadata.json'))) {
      missingMetadata += 1;
    }
    if (!item.url && !fs.existsSync(itemOriginalPath(library, item))) {
      missingOriginal += 1;
    }
    if (item.noThumbnail) noThumbnail += 1;
    if (now - Number(item.modificationTime || 0) <= recentDay) recentlyAdded += 1;
  }

  const tags = new Set(items.flatMap((item) => item.tags || []));
  return {
    libraryName: library.libraryName,
    items: items.length,
    folders: countFolders(library.folders),
    smartFolders: library.smartFolders.length,
    tagGroups: library.tagsGroups.length,
    tags: tags.size,
    totalSize,
    recentlyAdded,
    deleted: items.filter((item) => item.isDeleted).length,
    missingMetadata,
    missingOriginal,
    noThumbnail,
    duplicateGroups: findDuplicates(library).length,
    modificationTime: library.metadata.modificationTime,
  };
}

export function folderStats(tree) {
  const nodeStats = (folder) => {
    const itemCount = 0;
    return {
      id: folder.id,
      name: folder.name,
      itemCount,
      children: (folder.children || []).map(nodeStats),
    };
  };
  return (tree || []).map(nodeStats);
}

export async function repairLibrary(library) {
  const report = {
    repairedMetadata: 0,
    repairedThumbnails: 0,
    missingOriginals: [],
  };
  let changed = false;
  for (const item of library.items) {
    const infoDir = path.join(library.rootDir, 'images', `${item.id}.info`);
    const metaFile = path.join(infoDir, 'metadata.json');
    if (!fs.existsSync(metaFile)) {
      fs.mkdirSync(infoDir, { recursive: true });
      changed = true;
      report.repairedMetadata += 1;
    }
    if (!item.url && !fs.existsSync(itemOriginalPath(library, item))) {
      report.missingOriginals.push({ id: item.id, name: item.name, ext: item.ext });
    } else {
      try {
        await generateThumbnailAsync(library, item);
        report.repairedThumbnails += 1;
      } catch (err) {
        // Thumbnail cannot be generated for this item.
      }
    }
  }
  if (changed) saveItems(library);
  return report;
}
