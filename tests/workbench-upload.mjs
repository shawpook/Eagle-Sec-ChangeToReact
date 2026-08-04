import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '..');
const tempRoot = path.join(projectRoot, 'test-run');
const tempLib = path.join(tempRoot, 'workbench-upload.library');
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

const form = new FormData();
form.append('file', new Blob([fs.readFileSync(sourceFile)], { type: 'image/png' }), 'Uploaded Workbench.png');
form.append('tags', 'workbench,upload');
form.append('annotation', 'uploaded from workbench');
const uploadRes = await fetch(`${apiBase}/api/item/upload`, { method: 'POST', body: form });
const uploadBody = await uploadRes.json();
if (uploadBody.status !== 'success' || !uploadBody.data.id) throw new Error('workbench upload failed');

const list = await json('GET', `${apiBase}/api/item/list`);
if (!list.data.some((item) => item.id === uploadBody.data.id)) throw new Error('uploaded item missing from list');

await json('POST', `${apiBase}/api/library/switch`, { libraryPath: '/mock-library/Eagle Reverse Demo.library' });
fs.rmSync(tempLib, { recursive: true, force: true });

console.log('Workbench upload test passed');
