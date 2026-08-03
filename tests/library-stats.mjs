import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadLibrary } from '../backend/src/library-store.js';
import { importFile } from '../backend/src/importer.js';
import { thumbnailPath } from '../backend/src/thumbnailer.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '..');
const tempRoot = path.join(projectRoot, 'test-run');
const tempLib = path.join(tempRoot, 'library-stats.library');
const sourceFile = path.join(
  projectRoot,
  'frontend/public/mock-library/Eagle Reverse Demo.library/images/MOCK0001.info/Welcome Library.png'
);
const apiBase = process.env.EAGLE_API_URL || 'http://127.0.0.1:41595';

fs.rmSync(tempLib, { recursive: true, force: true });
fs.mkdirSync(tempLib, { recursive: true });
fs.writeFileSync(
  path.join(tempLib, 'metadata.json'),
  JSON.stringify({ applicationVersion: '4.0.0', folders: [], smartFolders: [], quickAccess: [], tagsGroups: [], modificationTime: Date.now() }),
  'utf8'
);
fs.writeFileSync(path.join(tempLib, 'tags.json'), JSON.stringify({ historyTags: [], starredTags: [] }), 'utf8');
fs.writeFileSync(path.join(tempLib, 'saved-filters.json'), '[]', 'utf8');

const library = loadLibrary(tempLib);
const item = importFile(library, sourceFile, { name: 'Stats Item', star: 5, tags: ['stats'] });
const thumb = thumbnailPath(library, item);
fs.rmSync(thumb, { force: true });

async function json(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${url} HTTP ${res.status}`);
  return res.json();
}

await json('POST', `${apiBase}/api/library/switch`, { libraryPath: tempLib });
const stats = await json('GET', `${apiBase}/api/library/stats`);
if (stats.data.items !== 1 || stats.data.tags !== 1) throw new Error('library stats mismatch');

const repair = await json('POST', `${apiBase}/api/library/repair`);
if (repair.data.repairedThumbnails < 1 || !fs.existsSync(thumb)) throw new Error('library repair failed');

const folderStats = await json('GET', `${apiBase}/api/folder/stats`);
if (!Array.isArray(folderStats.data)) throw new Error('folder stats failed');

await json('POST', `${apiBase}/api/library/switch`, { libraryPath: '/mock-library/Eagle Reverse Demo.library' });
fs.rmSync(tempLib, { recursive: true, force: true });

console.log('Library stats/repair test passed');
