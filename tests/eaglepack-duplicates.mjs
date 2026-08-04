import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadLibrary } from '../backend/src/library-store.js';
import { importFile } from '../backend/src/importer.js';
import { findDuplicates } from '../backend/src/duplicates.js';
import { packLibrary, importEaglepack } from '../backend/src/eaglepack.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '..');
const tempRoot = path.join(projectRoot, 'test-run');
const tempLib = path.join(tempRoot, 'eaglepack-test.library');
const packedFile = path.join(tempRoot, 'eaglepack-test.eaglepack');
const importedLib = path.join(tempRoot, 'eaglepack-imported.library');
const sourceFile = path.join(
  projectRoot,
  'frontend/public/mock-library/Eagle Reverse Demo.library/images/MOCK0001.info/Welcome Library.png'
);
const apiBase = process.env.EAGLE_API_URL || 'http://127.0.0.1:41695';

fs.rmSync(tempLib, { recursive: true, force: true });
fs.rmSync(importedLib, { recursive: true, force: true });
fs.rmSync(packedFile, { force: true });
fs.mkdirSync(tempLib, { recursive: true });
fs.writeFileSync(
  path.join(tempLib, 'metadata.json'),
  JSON.stringify({ applicationVersion: '4.0.0', folders: [], smartFolders: [], quickAccess: [], tagsGroups: [], modificationTime: Date.now() }),
  'utf8'
);
fs.writeFileSync(path.join(tempLib, 'tags.json'), JSON.stringify({ historyTags: [], starredTags: [] }), 'utf8');
fs.writeFileSync(path.join(tempLib, 'saved-filters.json'), '[]', 'utf8');

const library = loadLibrary(tempLib);
importFile(library, sourceFile, { name: 'Duplicate A' });
importFile(library, sourceFile, { name: 'Duplicate B' });

const duplicates = findDuplicates(library);
if (duplicates.length === 0) throw new Error('duplicate detection returned no groups');

packLibrary(library, packedFile);
if (!fs.existsSync(packedFile)) throw new Error('eaglepack file missing');

const imported = importEaglepack(packedFile, importedLib);
if (imported.manifest.format !== 'eaglepack') throw new Error('eaglepack manifest missing');
if (imported.library.items.length !== 2) throw new Error('eaglepack import item count mismatch');
const merged = importEaglepack(packedFile, importedLib, { mode: 'merge' });
if (!merged.merged || merged.library.items.length !== 2) throw new Error('eaglepack merge mode failed');

await fetch(`${apiBase}/api/library/switch`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ libraryPath: tempLib }),
});
const dupRes = await fetch(`${apiBase}/api/item/duplicates`);
const dupBody = await dupRes.json();
if (dupBody.status !== 'success' || dupBody.data.length === 0) throw new Error('api duplicate detection failed');
const mergeGroup = dupBody.data[0].items;
const mergeRes = await fetch(`${apiBase}/api/item/mergeDuplicates`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ ids: mergeGroup.map((entry) => entry.id) }),
});
const mergeBody = await mergeRes.json();
if (mergeBody.status !== 'success') throw new Error('merge duplicates failed');
const listRes = await fetch(`${apiBase}/api/item/list`);
const listBody = await listRes.json();
if (listBody.data.length !== 1) throw new Error('merge did not reduce item count to 1');

const pluginRes = await fetch(`${apiBase}/api/plugins`);
const pluginBody = await pluginRes.json();
if (pluginBody.status !== 'success' || !pluginBody.data.some((plugin) => plugin.id === 'eagle-reverse-example-service')) {
  throw new Error('plugin list missing example plugin');
}

await fetch(`${apiBase}/api/library/switch`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ libraryPath: '/mock-library/Eagle Reverse Demo.library' }),
});

fs.rmSync(tempLib, { recursive: true, force: true });
fs.rmSync(importedLib, { recursive: true, force: true });
fs.rmSync(packedFile, { force: true });

console.log('Eaglepack/duplicates/plugin test passed');
