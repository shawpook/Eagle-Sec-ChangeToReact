import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { LibraryService } from '../backend/src/library-service.js';
import { exportAsFolder, exportImages } from '../backend/src/export-service.js';
import { importFile } from '../backend/src/importer.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-image-export-'));
const librariesRoot = path.join(tempRoot, 'libraries');
const sourcesRoot = path.join(tempRoot, 'sources');
const flatExport = path.join(tempRoot, 'flat-export');
const treeExport = path.join(tempRoot, 'tree-export');
fs.mkdirSync(librariesRoot, { recursive: true });
fs.mkdirSync(sourcesRoot, { recursive: true });

function makePng(file, red) {
  const image = new PNG({ width: 8, height: 6 });
  for (let index = 0; index < image.data.length; index += 4) {
    image.data[index] = red;
    image.data[index + 1] = 30;
    image.data[index + 2] = 90;
    image.data[index + 3] = 255;
  }
  fs.writeFileSync(file, PNG.sync.write(image));
}
function hash(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

const sourceA = path.join(sourcesRoot, 'a.png');
const sourceB = path.join(sourcesRoot, 'b.png');
makePng(sourceA, 60);
makePng(sourceB, 180);
const fixedTime = new Date('2024-01-02T03:04:05Z');
fs.utimesSync(sourceA, fixedTime, fixedTime);

const service = new LibraryService({
  stateFile: path.join(tempRoot, 'library-state.json'),
  defaultLibraryPath: path.join(projectRoot, 'frontend/public/mock-library/Eagle Reverse Demo.library'),
});
const created = service.create({ name: '图片导出闭环', savePath: librariesRoot });
const library = created.library;
const itemA = importFile(library, sourceA, { name: 'Same Name', folders: ['ROOT'] });
const itemB = importFile(library, sourceB, { name: 'Same Name', folders: ['CHILD'] });

fs.mkdirSync(flatExport, { recursive: true });
fs.writeFileSync(path.join(flatExport, 'Same Name.png'), 'occupied');
const flat = await exportImages(library, { savePath: flatExport, images: [itemA, itemB] });
if (flat.count !== 2 || new Set(flat.paths.map((file) => path.basename(file).toLowerCase())).size !== 2) throw new Error('flat export conflict handling failed');
if (flat.paths.some((file) => path.basename(file) === 'Same Name.png')) throw new Error('flat export overwrote existing file');
if (hash(flat.paths[0]) !== hash(sourceA) || hash(flat.paths[1]) !== hash(sourceB)) throw new Error('flat export hash mismatch');
const exportedMtime = fs.statSync(flat.paths[0]).mtimeMs;
if (Math.abs(exportedMtime - fs.statSync(path.join(library.rootDir, 'images', `${itemA.id}.info`, `${itemA.name}.${itemA.ext}`)).mtimeMs) > 2000) {
  throw new Error('flat export timestamp was not preserved');
}

const folder = {
  id: 'ROOT',
  name: 'Root Folder',
  images: [itemA.id],
  children: [{ id: 'CHILD', name: 'Child Folder', images: [itemB.id], children: [] }],
};
const tree = await exportAsFolder(library, { savePath: treeExport, folder });
const rootFile = path.join(treeExport, 'Root Folder', 'Same Name.png');
const childFile = path.join(treeExport, 'Root Folder', 'Child Folder', 'Same Name.png');
if (tree.count !== 2 || !fs.existsSync(rootFile) || !fs.existsSync(childFile)) throw new Error('folder tree export failed');
if (hash(rootFile) !== hash(sourceA) || hash(childFile) !== hash(sourceB)) throw new Error('folder tree hash mismatch');

let cancelled = false;
try {
  await exportImages(library, { savePath: path.join(tempRoot, 'cancel-export'), images: [itemA, itemB] }, {
    isCancelled: () => cancelled,
    onProgress: () => { cancelled = true; },
  });
} catch (err) {
  if (err.name !== 'ExportCancelledError') throw err;
}
if (!cancelled) throw new Error('export cancellation was not exercised');
if (fs.readdirSync(path.join(tempRoot, 'cancel-export')).length !== 1) throw new Error('export did not stop after cancellation');

console.log(`IMAGE_EXPORT_CLOSED_LOOP_OK ${tempRoot}`);
