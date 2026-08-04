import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { loadLibrary } from '../backend/src/library-store.js';
import { importFile } from '../backend/src/importer.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-csv-comments-'));
const tempLib = path.join(tempRoot, 'csv-comments-test.library');
const sourceFile = path.join(
  projectRoot,
  'frontend/public/mock-library/Eagle Reverse Demo.library/images/MOCK0001.info/Welcome Library.png'
);
const apiBase = process.env.EAGLE_API_URL || 'http://127.0.0.1:41695';

fs.mkdirSync(tempLib, { recursive: true });
fs.writeFileSync(
  path.join(tempLib, 'metadata.json'),
  JSON.stringify({ applicationVersion: '4.0.0', folders: [], smartFolders: [], quickAccess: [], tagsGroups: [], modificationTime: Date.now() }),
  'utf8'
);
fs.writeFileSync(path.join(tempLib, 'tags.json'), JSON.stringify({ historyTags: [], starredTags: [] }), 'utf8');
fs.writeFileSync(path.join(tempLib, 'saved-filters.json'), '[]', 'utf8');

const library = loadLibrary(tempLib);
const item = importFile(library, sourceFile, { name: 'CSV Comment Item', tags: ['csv'], star: 4 });

async function json(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${url} HTTP ${res.status}`);
  return res.json();
}

const originalLibrary = (await json('GET', `${apiBase}/api/library/current`)).data.path;
try {
  await json('POST', `${apiBase}/api/library/switch`, { libraryPath: tempLib });

  const thumb = await json('POST', `${apiBase}/api/item/refreshThumbnail`, { id: item.id });
  if (!thumb.data.path || !fs.existsSync(thumb.data.path)) throw new Error('thumbnail refresh failed');
  const thumbPng = PNG.sync.read(fs.readFileSync(thumb.data.path));
  if (Math.max(thumbPng.width, thumbPng.height) > 480) throw new Error('thumbnail was not resized to 480px max side');

  const csv = await fetch(`${apiBase}/api/export/csv?keyword=CSV`);
  const csvText = await csv.text();
  if (!csvText.includes('CSV Comment Item')) throw new Error('CSV export missing imported item');

  const csvDest = path.join(tempRoot, 'items.csv');
  const csvFile = await json('POST', `${apiBase}/api/export/csv`, { keyword: 'CSV', destFile: csvDest });
  if (!fs.existsSync(csvFile.data.path)) throw new Error('CSV file export missing');

  const added = await json('POST', `${apiBase}/api/v2/item/addComment`, { id: item.id, text: 'hello comment' });
  let comments = await json('GET', `${apiBase}/api/v2/item/getComments?id=${encodeURIComponent(item.id)}`);
  if (comments.data.length !== 1 || comments.data[0].text !== 'hello comment') throw new Error('comment add failed');

  await json('POST', `${apiBase}/api/v2/item/updateComment`, { id: item.id, commentId: added.data.id, text: 'updated' });
  comments = await json('GET', `${apiBase}/api/v2/item/getComments?id=${encodeURIComponent(item.id)}`);
  if (comments.data[0].text !== 'updated') throw new Error('comment update failed');

  await json('POST', `${apiBase}/api/v2/item/removeComment`, { id: item.id, commentId: added.data.id });
  comments = await json('GET', `${apiBase}/api/v2/item/getComments?id=${encodeURIComponent(item.id)}`);
  if (comments.data.length !== 0) throw new Error('comment remove failed');
} finally {
  await json('POST', `${apiBase}/api/library/switch`, { libraryPath: originalLibrary });
  fs.rmSync(tempRoot, { recursive: true, force: true });
}

console.log('CSV/comments/thumbnail test passed');
