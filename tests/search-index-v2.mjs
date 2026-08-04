import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadLibrary } from '../backend/src/library-store.js';
import { importFile } from '../backend/src/importer.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '..');
const tempRoot = path.join(projectRoot, 'test-run');
const tempLib = path.join(tempRoot, 'search-index-test.library');
const sourceFile = path.join(
  projectRoot,
  'frontend/public/mock-library/Eagle Reverse Demo.library/images/MOCK0001.info/Welcome Library.png'
);
const apiBase = process.env.EAGLE_API_URL || 'http://127.0.0.1:41695';

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
const item = importFile(library, sourceFile, { name: 'Search Index Item', tags: ['csv'], star: 3 });

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
await json('POST', `${apiBase}/api/v2/search/rebuild`);
const index = await json('GET', `${apiBase}/api/search/index`);
if (!index.data.items.some((entry) => entry.id === item.id)) throw new Error('search index missing imported item');

const folder = await json('POST', `${apiBase}/api/v2/folder/create`, { name: 'Temp Folder' });
await json('POST', `${apiBase}/api/v2/folder/remove`, { id: folder.data.id });

await json('POST', `${apiBase}/api/v2/tag/remove`, { name: 'csv' });

const plugin = await json('GET', `${apiBase}/api/plugins/eagle-reverse-example-service`);
if (plugin.data.id !== 'eagle-reverse-example-service') throw new Error('plugin detail missing');

await json('POST', `${apiBase}/api/library/switch`, { libraryPath: '/mock-library/Eagle Reverse Demo.library' });
fs.rmSync(tempLib, { recursive: true, force: true });

console.log('Search index/V2/plugin test passed');
