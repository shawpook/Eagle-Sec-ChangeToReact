import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import AdmZip from 'adm-zip';
import { createFolder, loadLibrary } from '../backend/src/library-store.js';
import { importFile } from '../backend/src/importer.js';
import { findDuplicates } from '../backend/src/duplicates.js';
import { importEaglepack, packLibrary } from '../backend/src/eaglepack.js';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-eaglepack-'));
const tempLib = path.join(tempRoot, 'eaglepack-test.library');
const packedFile = path.join(tempRoot, 'eaglepack-test.eaglepack');
const importedLib = path.join(tempRoot, 'eaglepack-imported.library');
const legacyPack = path.join(tempRoot, 'legacy.eaglepack');
const legacyLib = path.join(tempRoot, 'legacy-imported.library');
const brokenPack = path.join(tempRoot, 'broken.eaglepack');
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceFile = path.join(
  projectRoot,
  'frontend/public/mock-library/Eagle Reverse Demo.library/images/MOCK0001.info/Welcome Library.png'
);

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

fs.mkdirSync(tempLib, { recursive: true });
fs.writeFileSync(
  path.join(tempLib, 'metadata.json'),
  JSON.stringify({ applicationVersion: '4.0.0', folders: [], smartFolders: [], quickAccess: [], tagsGroups: [], modificationTime: Date.now() }),
  'utf8'
);
fs.writeFileSync(path.join(tempLib, 'tags.json'), JSON.stringify({ historyTags: ['pack'], starredTags: [] }), 'utf8');
fs.writeFileSync(path.join(tempLib, 'saved-filters.json'), '[]', 'utf8');

const library = loadLibrary(tempLib);
const rootFolder = createFolder(library, { name: 'Pack Root' });
const childFolder = createFolder(library, { name: 'Pack Child', parentID: rootFolder.id });
const first = importFile(library, sourceFile, { name: 'Duplicate A', folderIDs: [rootFolder.id], tags: ['pack'] });
const second = importFile(library, sourceFile, { name: 'Duplicate B', folderIDs: [childFolder.id], tags: ['pack'] });

const duplicates = findDuplicates(library);
if (duplicates.length !== 1 || duplicates[0].items.length !== 2) throw new Error('duplicate detection returned wrong groups');

packLibrary(library, packedFile, { folderId: rootFolder.id, items: [first.id, second.id], includeLibraryState: true });
if (!fs.existsSync(packedFile)) throw new Error('eaglepack file missing');
const zip = new (AdmZip.default || AdmZip)(packedFile);
const names = zip.getEntries().map((entry) => entry.entryName.replace(/\\/g, '/'));
if (!names.includes('pack.json')) throw new Error('original pack.json is missing');
if (names.includes('manifest.json') || names.some((name) => name.startsWith('images/'))) throw new Error('legacy custom layout leaked into original-format export');
for (const item of [first, second]) {
  if (!names.includes(`${item.id}.info/metadata.json`) || !names.includes(`${item.id}.info/${item.name}.${item.ext}`)) {
    throw new Error(`original Eaglepack item layout missing: ${item.id}`);
  }
}
const pack = JSON.parse(zip.readAsText('pack.json'));
if (pack.images.length !== 2 || pack.folder?.name !== 'Pack Root' || pack.folder.children?.[0]?.name !== 'Pack Child') {
  throw new Error('pack.json folder or image metadata mismatch');
}

const imported = importEaglepack(packedFile, importedLib, { mode: 'replace' });
if (imported.manifest.source !== 'pack.json' || imported.imported !== 2 || imported.library.items.length !== 2) {
  throw new Error('original Eaglepack import count mismatch');
}
const importedIds = new Set(imported.library.items.map((item) => item.id));
if (importedIds.has(first.id) || importedIds.has(second.id)) throw new Error('Eaglepack import did not remap item IDs');
const importedFolders = imported.library.folders;
if (importedFolders.length !== 1 || importedFolders[0].id === rootFolder.id || importedFolders[0].children[0].id === childFolder.id) {
  throw new Error('Eaglepack import did not remap folder IDs');
}
if (!imported.library.tags.historyTags.includes('pack')) throw new Error('Eaglepack library state tags were not restored');
for (const item of imported.library.items) {
  if (!item.folders.length || !fs.existsSync(path.join(importedLib, 'images', `${item.id}.info`, `${item.name}.${item.ext}`))) {
    throw new Error(`imported item files or folder binding missing: ${item.id}`);
  }
  if (sha256(path.join(importedLib, 'images', `${item.id}.info`, `${item.name}.${item.ext}`)) !== sha256(sourceFile)) {
    throw new Error(`imported item hash mismatch: ${item.id}`);
  }
}

const merged = importEaglepack(packedFile, importedLib, { mode: 'merge' });
if (!merged.merged || merged.imported !== 0 || merged.skipped !== 2 || merged.library.items.length !== 2) {
  throw new Error('Eaglepack duplicate merge policy failed');
}

const LegacyZip = AdmZip.default || AdmZip;
const legacy = new LegacyZip();
legacy.addFile('manifest.json', Buffer.from(JSON.stringify({ format: 'eaglepack', version: 1, items: [{ id: first.id, name: first.name, ext: first.ext }] }), 'utf8'));
legacy.addFile('metadata.json', Buffer.from(JSON.stringify(library.metadata), 'utf8'));
legacy.addFile('tags.json', Buffer.from(JSON.stringify(library.tags), 'utf8'));
legacy.addFile('saved-filters.json', Buffer.from('[]', 'utf8'));
legacy.addFile('cache.json', Buffer.from(`${JSON.stringify(first)}\n`, 'utf8'));
for (const file of fs.readdirSync(path.join(tempLib, 'images', `${first.id}.info`))) {
  legacy.addFile(`images/${first.id}.info/${file}`, fs.readFileSync(path.join(tempLib, 'images', `${first.id}.info`, file)));
}
legacy.writeZip(legacyPack);
const legacyImported = importEaglepack(legacyPack, legacyLib, { mode: 'replace' });
if (legacyImported.library.items.length !== 1 || legacyImported.library.items[0].id !== first.id) {
  throw new Error('legacy manifest Eaglepack import compatibility failed');
}

const BrokenZip = AdmZip.default || AdmZip;
const broken = new BrokenZip();
broken.addFile('pack.json', Buffer.from(JSON.stringify({ images: [{ id: 'MISSING', name: 'Missing', ext: 'png' }] }), 'utf8'));
broken.writeZip(brokenPack);
let rejected = false;
try {
  importEaglepack(brokenPack, path.join(tempRoot, 'broken.library'), { mode: 'replace' });
} catch (err) {
  rejected = /original file is missing|item directory is missing/.test(err.message);
}
if (!rejected) throw new Error('corrupt Eaglepack was not rejected');

console.log(`EAGLEPACK_ORIGINAL_COMPAT_OK ${packedFile}`);
