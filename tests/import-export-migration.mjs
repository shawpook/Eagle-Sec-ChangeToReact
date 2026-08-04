import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '..');
const token = `${Date.now()}-${process.pid}`;
const tempRoot = path.join(projectRoot, 'test-run', `import-export-${token}`);
const tempLib = path.join(tempRoot, 'source.library');
const importedLib = path.join(tempRoot, 'restored.library');
const sourceDir = path.join(tempRoot, 'folder-source');
const backupFile = path.join(tempRoot, 'backup.eaglepack');
const exportDir = path.join(tempRoot, 'library-export');
const sourcePng = path.join(
  projectRoot,
  'frontend/public/mock-library/Eagle Reverse Demo.library/images/MOCK0001.info/Welcome Library.png'
);
const apiBase = process.env.EAGLE_API_URL || 'http://127.0.0.1:41695';

fs.mkdirSync(sourceDir, { recursive: true });
fs.copyFileSync(sourcePng, path.join(sourceDir, 'Folder Image.png'));
fs.writeFileSync(path.join(sourceDir, 'Folder Note.txt'), 'folder import', 'utf8');
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
  if (!res.ok) throw new Error(`${method} ${url} HTTP ${res.status} ${await res.text()}`);
  return res.json();
}

await json('POST', `${apiBase}/api/library/switch`, { libraryPath: tempLib });
const folderImport = await json('POST', `${apiBase}/api/item/importFolder`, { folderPath: sourceDir });
if (folderImport.data.count < 2) throw new Error('folder import failed');

const base64Data = `data:image/png;base64,${fs.readFileSync(sourcePng).toString('base64')}`;
await json('POST', `${apiBase}/api/item/importBase64`, { data: base64Data, name: 'Base64 Image' });

const bookmark = await json('POST', `${apiBase}/api/item/importBookmark`, {
  url: 'https://example.com/bookmark',
  title: 'Example Bookmark',
  tags: ['bookmark'],
});
if (bookmark.data.ext !== 'url') throw new Error('bookmark import failed');

await json('POST', `${apiBase}/api/export/library`, { destDir: exportDir });
if (!fs.existsSync(path.join(exportDir, 'metadata.json'))) throw new Error('library export failed');

const backup = await json('POST', `${apiBase}/api/library/backup`, { destFile: backupFile });
if (!fs.existsSync(backup.data.path)) throw new Error('library backup failed');

const restore = await json('POST', `${apiBase}/api/library/restore`, { file: backupFile, destDir: importedLib });
if (restore.data.library.items.length < 3) throw new Error('library restore failed');

await json('POST', `${apiBase}/api/library/switch`, { libraryPath: '/mock-library/Eagle Reverse Demo.library' });
try {
  fs.rmSync(tempRoot, { recursive: true, force: true });
} catch (err) {
  // Leave temp data if Windows keeps a file locked.
}

console.log('Import/export/migration test passed');
