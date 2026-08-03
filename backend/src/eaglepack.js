import fs from 'node:fs';
import path from 'node:path';
import AdmZip from 'adm-zip';
import { loadLibrary, saveItems } from './library-store.js';

function zipModule() {
  return AdmZip.default || AdmZip;
}

export function packLibrary(library, destFile) {
  const Zip = zipModule();
  const zip = new Zip();
  const manifest = {
    format: 'eaglepack',
    version: 1,
    library: {
      name: library.libraryName,
      applicationVersion: library.metadata.applicationVersion || '4.0.0',
    },
    exportedAt: Date.now(),
    items: library.items.map((item) => ({ id: item.id, name: item.name, ext: item.ext })),
  };
  zip.addFile('manifest.json', Buffer.from(JSON.stringify(manifest, null, 2), 'utf8'));
  zip.addFile('metadata.json', Buffer.from(JSON.stringify(library.metadata, null, 2), 'utf8'));
  zip.addFile('tags.json', Buffer.from(JSON.stringify(library.tags, null, 2), 'utf8'));
  zip.addFile('saved-filters.json', Buffer.from(JSON.stringify(library.savedFilters, null, 2), 'utf8'));
  zip.addFile('cache.json', Buffer.from(library.items.map((item) => JSON.stringify(item)).join('\n') + '\n', 'utf8'));

  const imagesDir = path.join(library.rootDir, 'images');
  if (fs.existsSync(imagesDir)) {
    zip.addLocalFolder(imagesDir, 'images');
  }
  fs.mkdirSync(path.dirname(destFile), { recursive: true });
  zip.writeZip(destFile);
  return destFile;
}

export function importEaglepack(zipFile, destDir, options = {}) {
  const Zip = zipModule();
  const zip = new Zip(zipFile);
  const manifestEntry = zip.getEntry('manifest.json');
  if (!manifestEntry) {
    throw new Error('Eaglepack manifest.json is missing');
  }
  const manifest = JSON.parse(manifestEntry.getData().toString('utf8'));
  if (manifest.format !== 'eaglepack') {
    throw new Error(`Unsupported pack format: ${manifest.format}`);
  }
  const existing = options.mode === 'merge' && fs.existsSync(destDir) ? loadLibrary(destDir) : null;
  if (options.mode === 'replace') {
    fs.rmSync(destDir, { recursive: true, force: true });
  }
  fs.mkdirSync(destDir, { recursive: true });
  zip.extractAllTo(destDir, true);
  if (existing) {
    const imported = loadLibrary(destDir);
    const existingIds = new Set(existing.items.map((item) => item.id));
    for (const item of imported.items) {
      if (!existingIds.has(item.id)) existing.items.push(item);
    }
    existing.metadata.folders = [...new Set([...(existing.metadata.folders || []), ...(imported.metadata.folders || [])])];
    existing.metadata.smartFolders = [...new Set([...(existing.metadata.smartFolders || []), ...(imported.metadata.smartFolders || [])])];
    existing.metadata.tagsGroups = [...new Set([...(existing.metadata.tagsGroups || []), ...(imported.metadata.tagsGroups || [])])];
    existing.tags.historyTags = [...new Set([...(existing.tags.historyTags || []), ...(imported.tags.historyTags || [])])];
    existing.tags.starredTags = [...new Set([...(existing.tags.starredTags || []), ...(imported.tags.starredTags || [])])];
    saveItems(existing);
    return {
      manifest,
      library: existing,
      merged: true,
    };
  }
  return {
    manifest,
    library: loadLibrary(destDir),
    merged: false,
  };
}
