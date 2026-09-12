import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadLibrary, saveItems } from '../backend/src/library-store.js';
import {
  acquireLibraryLock,
  LibraryTransactionCoordinator,
  releaseLibraryLock,
} from '../backend/src/library-transaction-coordinator.js';
import { readGeneration } from '../backend/src/library-strict.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-library-concurrency-'));
const libraryPath = path.join(tempRoot, 'concurrency.library');
fs.mkdirSync(libraryPath, { recursive: true });
fs.writeFileSync(path.join(libraryPath, 'metadata.json'), JSON.stringify({
  applicationVersion: '4.0.0',
  folders: [],
  smartFolders: [],
  quickAccess: [],
  tagsGroups: [],
  modificationTime: Date.now(),
}), 'utf8');
fs.writeFileSync(path.join(libraryPath, 'tags.json'), JSON.stringify({ historyTags: [], starredTags: [] }), 'utf8');
fs.writeFileSync(path.join(libraryPath, 'saved-filters.json'), '[]', 'utf8');

const library = loadLibrary(libraryPath);
const item = {
  id: 'ITEM-CONCURRENT',
  name: 'Concurrent',
  ext: 'png',
  tags: [],
  folders: [],
  annotation: '',
  url: '',
  star: 0,
  modificationTime: Date.now(),
  lastModified: Date.now(),
  isDeleted: false,
  noThumbnail: true,
};
library.items.unshift(item);
saveItems(library);

const coordinator = new LibraryTransactionCoordinator();
const results = await Promise.all([
  coordinator.run(library, {
    mutate: (current) => {
      const entry = current.items.find((entry) => entry.id === item.id);
      entry.tags = [...new Set([...(entry.tags || []), 'one'])];
    },
  }),
  coordinator.run(library, {
    mutate: (current) => {
      const entry = current.items.find((entry) => entry.id === item.id);
      entry.tags = [...new Set([...(entry.tags || []), 'two'])];
    },
  }),
]);
assert.deepEqual(results.map((entry) => entry.transactionId).filter(Boolean).length, 2);
const reloaded = loadLibrary(libraryPath);
assert.deepEqual(reloaded.itemMap.get(item.id).tags.sort(), ['one', 'two']);

const conflictLibrary = loadLibrary(libraryPath);
await assert.rejects(
  coordinator.run(conflictLibrary, {
    expectedGeneration: 0,
    mutate: () => {},
  }),
  (err) => err.code === 'LIBRARY_VERSION_CONFLICT'
);

const lock = acquireLibraryLock(libraryPath);
assert.throws(
  () => acquireLibraryLock(libraryPath),
  (err) => err.code === 'LIBRARY_WRITE_LOCKED'
);
releaseLibraryLock(lock);

assert.ok(readGeneration(libraryPath) >= 3, `generation did not advance: ${readGeneration(libraryPath)}`);
try { fs.rmSync(tempRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }); } catch (err) { /* Windows 文件锁：清理失败不影响测试结果 */ }
console.log('LIBRARY_CONCURRENCY_OK');
