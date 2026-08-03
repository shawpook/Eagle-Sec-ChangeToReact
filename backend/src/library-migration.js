import fs from 'node:fs';
import path from 'node:path';
import { itemOriginalPath, loadLibrary, resolveLibraryPath, saveItems, saveLibraryState } from './library-store.js';
import { thumbnailPath } from './thumbnailer.js';

export function scanLibrary(libraryPath) {
  const rootDir = resolveLibraryPath(libraryPath);
  if (!rootDir || !fs.existsSync(rootDir)) {
    throw new Error(`Library not found: ${libraryPath}`);
  }
  const issues = [];
  const metadataFile = path.join(rootDir, 'metadata.json');
  const cacheFile = path.join(rootDir, 'cache.json');
  const tagsFile = path.join(rootDir, 'tags.json');
  const savedFiltersFile = path.join(rootDir, 'saved-filters.json');
  if (!fs.existsSync(metadataFile)) issues.push('missing metadata.json');
  if (!fs.existsSync(cacheFile)) issues.push('missing cache.json');
  if (!fs.existsSync(tagsFile)) issues.push('missing tags.json');
  if (!fs.existsSync(savedFiltersFile)) issues.push('missing saved-filters.json');

  const library = loadLibrary(rootDir);
  let missingMetadata = 0;
  let missingOriginal = 0;
  let missingThumbnail = 0;
  for (const item of library.items) {
    const infoDir = path.join(rootDir, 'images', `${item.id}.info`);
    if (!fs.existsSync(path.join(infoDir, 'metadata.json'))) missingMetadata += 1;
    if (!item.url && !fs.existsSync(itemOriginalPath(library, item))) missingOriginal += 1;
    if (!item.noThumbnail && !fs.existsSync(thumbnailPath(library, item))) missingThumbnail += 1;
  }
  if (missingMetadata > 0) issues.push(`${missingMetadata} missing item metadata`);
  if (missingOriginal > 0) issues.push(`${missingOriginal} missing original files`);
  if (missingThumbnail > 0) issues.push(`${missingThumbnail} missing thumbnails`);

  return {
    path: rootDir,
    name: library.libraryName,
    valid: issues.length === 0,
    itemCount: library.items.length,
    folders: library.folders.length,
    smartFolders: library.smartFolders.length,
    tagsGroups: library.tagsGroups.length,
    issues,
  };
}

export function migrateLibrary(sourcePath, destDir) {
  const sourceRoot = resolveLibraryPath(sourcePath);
  if (!sourceRoot || !fs.existsSync(sourceRoot)) {
    throw new Error(`Library not found: ${sourcePath}`);
  }
  const destination = path.resolve(destDir || `${sourceRoot}-migrated`);
  fs.rmSync(destination, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.cpSync(sourceRoot, destination, { recursive: true });
  const library = loadLibrary(destination);
  saveItems(library);
  saveLibraryState(library);
  return {
    source: sourceRoot,
    destination,
    library: {
      name: library.libraryName,
      itemCount: library.items.length,
      path: library.libraryPath,
    },
  };
}
