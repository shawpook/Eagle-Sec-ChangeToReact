import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { importFile } from '../backend/src/importer.js';
import { ItemWorkflowError, ItemWorkflowService } from '../backend/src/item-workflow-service.js';
import { loadLibrary } from '../backend/src/library-store.js';
import { LibraryService } from '../backend/src/library-service.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-item-workflow-'));
process.once('exit', () => fs.rmSync(tempRoot, { recursive: true, force: true }));
const stateFile = path.join(tempRoot, 'library-state.json');
const librariesRoot = path.join(tempRoot, 'libraries');
fs.mkdirSync(librariesRoot, { recursive: true });

const libraryService = new LibraryService({
  stateFile,
  defaultLibraryPath: path.join(projectRoot, 'frontend/public/mock-library/Eagle Reverse Demo.library'),
});
const { library } = libraryService.create({ name: 'Item Workflow', savePath: librariesRoot });
const source = path.join(projectRoot, 'frontend/public/mock-library/Eagle Reverse Demo.library/images/MOCK0001.info/Welcome Library.png');
const imported = importFile(library, source, { name: 'Before Rename', tags: ['initial'] });
const workflow = new ItemWorkflowService();

const updated = workflow.updateMany(library, [{
  id: imported.id,
  oldName: imported.name,
  newName: 'After Rename',
  name: 'After Rename',
  url: 'https://example.test/item',
  annotation: 'Inspector persistence',
  tags: ['UI', 'UI', 'workflow'],
  folders: ['FOLDER-A'],
  star: 9,
}])[0];

const infoDir = path.join(library.rootDir, 'images', `${imported.id}.info`);
const oldOriginal = path.join(infoDir, 'Before Rename.png');
const newOriginal = path.join(infoDir, 'After Rename.png');
const oldThumbnail = path.join(infoDir, 'Before Rename_thumbnail.png');
const newThumbnail = path.join(infoDir, 'After Rename_thumbnail.png');
assert.equal(fs.existsSync(oldOriginal), false);
assert.equal(fs.existsSync(newOriginal), true);
assert.equal(fs.existsSync(oldThumbnail), false);
assert.equal(fs.existsSync(newThumbnail), true);
assert.equal(updated.star, 5);
assert.deepEqual(updated.tags, ['UI', 'workflow']);

const metadata = JSON.parse(fs.readFileSync(path.join(infoDir, 'metadata.json'), 'utf8'));
assert.equal(metadata.name, 'After Rename');
assert.equal(metadata.annotation, 'Inspector persistence');
assert.equal(metadata.url, 'https://example.test/item');
assert.deepEqual(metadata.folders, ['FOLDER-A']);

const cacheItem = fs.readFileSync(path.join(library.rootDir, 'cache.json'), 'utf8')
  .split(/\r?\n/)
  .filter(Boolean)
  .map((line) => JSON.parse(line))
  .find((item) => item.id === imported.id);
assert.equal(cacheItem.name, 'After Rename');
assert.equal(cacheItem.annotation, 'Inspector persistence');

const indexed = JSON.parse(fs.readFileSync(path.join(library.rootDir, 'search-index.json'), 'utf8'))
  .items.find((item) => item.id === imported.id);
assert.equal(indexed.name, 'After Rename');
assert.equal(indexed.annotation, 'Inspector persistence');
assert.deepEqual(indexed.tags, ['UI', 'workflow']);

workflow.moveToTrash(library, [imported.id]);
let reloaded = loadLibrary(library.rootDir);
assert.equal(reloaded.itemMap.get(imported.id).isDeleted, true);
assert.ok(reloaded.itemMap.get(imported.id).deletedTime > 0);

workflow.restore(library, [imported.id]);
reloaded = loadLibrary(library.rootDir);
assert.equal(reloaded.itemMap.get(imported.id).isDeleted, false);
assert.equal(Object.prototype.hasOwnProperty.call(reloaded.itemMap.get(imported.id), 'deletedTime'), false);

const conflict = path.join(infoDir, 'Conflict.png');
fs.copyFileSync(newOriginal, conflict);
assert.throws(
  () => workflow.updateMany(library, [{ id: imported.id, name: 'Conflict' }]),
  (err) => err instanceof ItemWorkflowError && err.code === 'ITEM_RENAME_CONFLICT'
);
reloaded = loadLibrary(library.rootDir);
assert.equal(reloaded.itemMap.get(imported.id).name, 'After Rename');
assert.equal(fs.existsSync(newOriginal), true);
assert.equal(fs.existsSync(conflict), true);
assert.throws(
  () => workflow.updateMany(library, [{ id: imported.id, name: 'Trailing Space ' }]),
  (err) => err instanceof ItemWorkflowError && err.code === 'INVALID_ITEM_NAME'
);

workflow.updateMany(library, [{ id: imported.id, name: 'after rename' }]);
assert.equal(fs.readdirSync(infoDir).includes('after rename.png'), true);
assert.equal(fs.readdirSync(infoDir).includes('after rename_thumbnail.png'), true);
workflow.updateMany(library, [{ id: imported.id, name: 'After Rename' }]);
reloaded = loadLibrary(library.rootDir);
assert.equal(reloaded.itemMap.get(imported.id).name, 'After Rename');

console.log(`ITEM_WORKFLOW_CLOSED_LOOP_OK ${JSON.stringify({
  library: library.rootDir,
  itemId: imported.id,
  name: reloaded.itemMap.get(imported.id).name,
  cachePersisted: Boolean(cacheItem),
  searchPersisted: Boolean(indexed),
})}`);
