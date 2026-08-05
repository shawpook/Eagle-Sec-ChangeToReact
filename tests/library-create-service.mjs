import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LibraryService } from '../backend/src/library-service.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-library-service-'));
const stateFile = path.join(tempRoot, 'state', 'library-state.json');
const librariesRoot = path.join(tempRoot, 'libraries');
fs.mkdirSync(librariesRoot, { recursive: true });

const first = new LibraryService({
  stateFile,
  defaultLibraryPath: path.join(projectRoot, 'frontend/public/mock-library/Eagle Reverse Demo.library'),
});
const created = first.create({ name: '闭环测试库', savePath: librariesRoot });
const libraryPath = path.join(librariesRoot, '闭环测试库.library');

if (created.library.rootDir !== libraryPath) throw new Error('created library path mismatch');
for (const relative of ['metadata.json', 'tags.json', 'saved-filters.json', 'folders.json', 'cache.json', 'search-index.json', 'images']) {
  if (!fs.existsSync(path.join(libraryPath, relative))) throw new Error(`missing library artifact: ${relative}`);
}
const metadata = JSON.parse(fs.readFileSync(path.join(libraryPath, 'metadata.json'), 'utf8'));
if (!Array.isArray(metadata.folders) || !Array.isArray(metadata.smartFolders) || !Array.isArray(metadata.tagsGroups)) {
  throw new Error('metadata defaults are invalid');
}
const index = JSON.parse(fs.readFileSync(path.join(libraryPath, 'search-index.json'), 'utf8'));
if (index.version !== 2 || index.items.length !== 0) throw new Error('search index defaults are invalid');
if (fs.readFileSync(path.join(libraryPath, 'cache.json'), 'utf8') !== '') throw new Error('new library cache must be empty');

const restarted = new LibraryService({
  stateFile,
  defaultLibraryPath: path.join(projectRoot, 'frontend/public/mock-library/Eagle Reverse Demo.library'),
});
const restored = restarted.current({ includeItems: true });
if (restored.path !== libraryPath || restored.itemCount !== 0 || restored.items.length !== 0) {
  throw new Error('current library did not survive service restart');
}
if (!restarted.history().includes(libraryPath)) throw new Error('library history did not survive service restart');

console.log(`LIBRARY_SERVICE_CREATE_OK ${libraryPath}`);
