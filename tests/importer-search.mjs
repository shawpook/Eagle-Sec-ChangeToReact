import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadLibrary } from '../backend/src/library-store.js';
import { exportItem, importFile } from '../backend/src/importer.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '..');
const tempRoot = path.join(projectRoot, 'test-run');
const tempLib = path.join(tempRoot, 'importer-test.library');
const tempExport = path.join(tempRoot, 'importer-export');
const sourceFile = path.join(
  projectRoot,
  'frontend/public/mock-library/Eagle Reverse Demo.library/images/MOCK0001.info/Welcome Library.png'
);

fs.mkdirSync(tempLib, { recursive: true });
fs.writeFileSync(
  path.join(tempLib, 'metadata.json'),
  JSON.stringify({ applicationVersion: '4.0.0', folders: [], smartFolders: [], quickAccess: [], tagsGroups: [], modificationTime: Date.now() }),
  'utf8'
);
fs.writeFileSync(path.join(tempLib, 'tags.json'), JSON.stringify({ historyTags: [], starredTags: [] }), 'utf8');
fs.writeFileSync(path.join(tempLib, 'saved-filters.json'), '[]', 'utf8');

const library = loadLibrary(tempLib);
const item = importFile(library, sourceFile, { name: 'Imported Welcome', tags: ['imported'], star: 5 });

if (!item.id || !item.name || item.ext !== 'png') throw new Error('importFile returned invalid item');
if (!fs.existsSync(path.join(tempLib, 'images', `${item.id}.info`, `${item.name}.png`))) {
  throw new Error('imported original file missing');
}
if (!fs.existsSync(path.join(tempLib, 'images', `${item.id}.info`, `${item.name}_thumbnail.png`))) {
  throw new Error('imported thumbnail missing');
}

const exported = exportItem(library, item, tempExport);
if (!exported || !fs.existsSync(exported)) throw new Error('exported file missing');

fs.rmSync(tempLib, { recursive: true, force: true });
fs.rmSync(tempExport, { recursive: true, force: true });

const apiBase = process.env.EAGLE_API_URL || 'http://127.0.0.1:41595';
const searchRes = await fetch(`${apiBase}/api/item/search?keyword=Welcome`);
if (!searchRes.ok) throw new Error(`search HTTP ${searchRes.status}`);
const searchBody = await searchRes.json();
if (searchBody.status !== 'success' || searchBody.data.length === 0) throw new Error('search returned no items');

const v2Res = await fetch(`${apiBase}/api/v2/item/query`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ tags: ['UI'], limit: 5 }),
});
const v2Body = await v2Res.json();
if (v2Body.status !== 'success' || !Array.isArray(v2Body.data.data)) throw new Error('v2 query filter failed');

console.log(`Importer/search passed: imported ${item.name}, search ${searchBody.data.length} items`);
