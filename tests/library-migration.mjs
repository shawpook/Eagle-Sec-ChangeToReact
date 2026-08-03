import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '..');
const mockLibrary = path.join(projectRoot, 'frontend/public/mock-library/Eagle Reverse Demo.library');
const demoLibrary = path.join(projectRoot, '..', 'library-example/Demo.library');
const destDir = path.join(projectRoot, 'test-run', `migrated-${Date.now()}-${process.pid}.library`);
const apiBase = process.env.EAGLE_API_URL || 'http://127.0.0.1:41595';

async function json(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${url} HTTP ${res.status} ${await res.text()}`);
  return res.json();
}

const scan = await json('GET', `${apiBase}/api/library/scan?path=${encodeURIComponent(mockLibrary)}`);
if (scan.data.itemCount !== 17 || scan.data.valid !== true) throw new Error('mock library scan failed');

const demoScan = await json('GET', `${apiBase}/api/library/scan?path=${encodeURIComponent(demoLibrary)}`);
if (demoScan.data.itemCount !== 0) throw new Error('demo library scan item count mismatch');
if (!demoScan.data.issues.some((issue) => issue.includes('tags.json'))) throw new Error('demo library issues missing');

const migrated = await json('POST', `${apiBase}/api/library/migrate`, {
  sourcePath: mockLibrary,
  destDir,
});
if (migrated.data.library.itemCount !== 17) throw new Error('library migration item count mismatch');
for (const file of ['metadata.json', 'cache.json', 'search-index.json', 'tags.json', 'saved-filters.json']) {
  if (!fs.existsSync(path.join(destDir, file))) throw new Error(`migrated library missing ${file}`);
}

await json('POST', `${apiBase}/api/library/switch`, { libraryPath: destDir });
const info = await json('GET', `${apiBase}/api/library/info`);
if (info.data.library.items !== 17) throw new Error('switched migrated library failed');
await json('POST', `${apiBase}/api/library/switch`, { libraryPath: '/mock-library/Eagle Reverse Demo.library' });

try {
  fs.rmSync(destDir, { recursive: true, force: true });
} catch (err) {
  // Leave temp data if Windows keeps a file locked.
}

console.log('Library migration test passed');
