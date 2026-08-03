import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadLibrary } from '../backend/src/library-store.js';
import { importFile } from '../backend/src/importer.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '..');
const tempRoot = path.join(projectRoot, 'test-run');
const tempLib = path.join(tempRoot, 'smart-extension-plugin.library');
const sourceFile = path.join(
  projectRoot,
  'frontend/public/mock-library/Eagle Reverse Demo.library/images/MOCK0001.info/Welcome Library.png'
);
const apiBase = process.env.EAGLE_API_URL || 'http://127.0.0.1:41595';
const extensionBase = process.env.EAGLE_EXTENSION_URL || 'http://127.0.0.1:41593';

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
importFile(library, sourceFile, { name: 'Star Five', star: 5, tags: ['UI'] });
importFile(library, sourceFile, { name: 'Star One', star: 1, tags: ['Other'] });

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
const smart = await json('POST', `${apiBase}/api/v2/smartFolder/create`, {
  name: 'Five Star Only',
  conditions: [{ field: 'star', operator: '=', value: 5 }],
});
const smartItems = await json('GET', `${apiBase}/api/v2/smartFolder/getItems?id=${encodeURIComponent(smart.data.id)}`);
if (smartItems.data.length !== 1 || smartItems.data[0].name !== 'Star Five') {
  throw new Error('smart folder rule engine returned wrong items');
}

for (const route of ['/api/item/addFile', '/api/item/import-images', '/api/collect']) {
  const res = await fetch(`${extensionBase}${route}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ type: 'image', title: 'Extension Save' }),
  });
  const body = await res.json();
  if (body.status !== 'success' || !body.data.id) throw new Error(`extension route failed: ${route}`);
}

const open = await json('POST', `${apiBase}/api/plugins/open`, { id: 'eagle-reverse-example-service' });
const pluginHtml = await (await fetch(open.data.url)).text();
if (!pluginHtml.includes('/plugin-shim.js') || !pluginHtml.includes('Eagle Reverse Example Service')) {
  throw new Error('plugin page shim or content missing');
}

await json('POST', `${apiBase}/api/library/switch`, { libraryPath: '/mock-library/Eagle Reverse Demo.library' });
fs.rmSync(tempLib, { recursive: true, force: true });

console.log('Smart folder/extension/plugin open test passed');
