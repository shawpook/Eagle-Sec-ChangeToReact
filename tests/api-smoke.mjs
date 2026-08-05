import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '..');
const apiBase = process.env.EAGLE_API_URL || 'http://127.0.0.1:41695';
const thumbnailBase = process.env.EAGLE_THUMBNAIL_URL || 'http://127.0.0.1:41692';
const extensionBase = process.env.EAGLE_EXTENSION_URL || 'http://127.0.0.1:41693';

const results = [];

async function check(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
  } catch (err) {
    results.push({ name, ok: false, error: err.message });
  }
}

async function jsonOk(url, options) {
  const res = await fetch(url, options);
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  const body = await res.json();
  if (body.status !== 'success') throw new Error(`${url} -> ${JSON.stringify(body)}`);
  return body;
}

await check('GET /api/application/info', async () => {
  await jsonOk(`${apiBase}/api/application/info`);
});

await check('GET /api/library/info', async () => {
  const body = await jsonOk(`${apiBase}/api/library/info`);
  if (body.data.library.items < 17) throw new Error(`expected at least 17 items, got ${body.data.library.items}`);
});

await check('GET /api/folder/list', async () => {
  const body = await jsonOk(`${apiBase}/api/folder/list`);
  if (!Array.isArray(body.data) || body.data.length === 0) throw new Error('folder list empty');
});

await check('GET /api/tag/all', async () => {
  const body = await jsonOk(`${apiBase}/api/tag/all`);
  if (!Array.isArray(body.data.tags)) throw new Error('tags missing');
});

await check('GET /api/item/list', async () => {
  const body = await jsonOk(`${apiBase}/api/item/list`);
  if (body.data.length < 17) throw new Error('item list too short');
});

await check('POST /api/item/addFromURL', async () => {
  const body = await jsonOk(`${apiBase}/api/item/addFromURL`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Smoke Added', url: 'https://example.com/smoke.png', dryRun: true }),
  });
  if (!body.data.id) throw new Error('added item has no id');
});

await check('POST /api/v2/item/query', async () => {
  const body = await jsonOk(`${apiBase}/api/v2/item/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ limit: 3, offset: 0 }),
  });
  if (!Array.isArray(body.data.data)) throw new Error('v2 query data missing');
});

await check('GET /api/v2/smartFolder/all', async () => {
  await jsonOk(`${apiBase}/api/v2/smartFolder/all`);
});

await check('GET /api/v2/tagGroup/all', async () => {
  await jsonOk(`${apiBase}/api/v2/tagGroup/all`);
});

await check('GET /api/v2/aiSearch/isInstalled', async () => {
  await jsonOk(`${apiBase}/api/v2/aiSearch/isInstalled`);
});

await check('GET 41692 thumbnail', async () => {
  const url = `${thumbnailBase}/?filePath=${encodeURIComponent('/mock-library/Eagle Reverse Demo.library/images/MOCK0001.info/Welcome Library_thumbnail.png')}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`thumbnail HTTP ${res.status}`);
  const type = res.headers.get('content-type') || '';
  if (!type.startsWith('image/')) throw new Error(`thumbnail content-type ${type}`);
});

await check('GET 41693 extension info', async () => {
  const res = await fetch(`${extensionBase}/`);
  if (!res.ok) throw new Error(`extension HTTP ${res.status}`);
  const body = await res.json();
  if (!body.isVersion4) throw new Error('extension info missing isVersion4');
});

await check('POST 41693 collect save', async () => {
  const res = await fetch(`${extensionBase}/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ type: 'image', title: 'Smoke Save', dryRun: 'true' }),
  });
  if (!res.ok) throw new Error(`extension post HTTP ${res.status}`);
  const body = await res.json();
  if (!body.data.id) throw new Error('extension post response has no id');
});

const failed = results.filter((entry) => !entry.ok);
for (const entry of results) {
  console.log(`${entry.ok ? 'PASS' : 'FAIL'} ${entry.name}${entry.error ? ` :: ${entry.error}` : ''}`);
}
if (failed.length > 0) {
  console.error(`api smoke failed: ${failed.length}/${results.length}`);
  process.exit(1);
}
console.log(`api smoke passed: ${results.length}/${results.length}`);
