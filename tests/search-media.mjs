import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import jpeg from 'jpeg-js';
import { loadLibrary, saveItems } from '../backend/src/library-store.js';
import { importFile } from '../backend/src/importer.js';
import { thumbnailPath } from '../backend/src/thumbnailer.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '..');
const tempRoot = path.join(projectRoot, 'test-run');
const tempLib = path.join(tempRoot, `search-media-${Date.now()}-${process.pid}.library`);
const sourceFile = path.join(
  projectRoot,
  'frontend/public/mock-library/Eagle Reverse Demo.library/images/MOCK0001.info/Welcome Library.png'
);
const webpFile = path.join(projectRoot, 'frontend/public/mock-assets/sample.webp');
const apiBase = process.env.EAGLE_API_URL || 'http://127.0.0.1:41695';

async function removeWithRetry(target) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      fs.rmSync(target, { recursive: true, force: true });
      return;
    } catch (err) {
      if (err.code !== 'EBUSY' || attempt === 9) throw err;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
}

fs.mkdirSync(tempLib, { recursive: true });
fs.writeFileSync(
  path.join(tempLib, 'metadata.json'),
  JSON.stringify({ applicationVersion: '4.0.0', folders: [], smartFolders: [], quickAccess: [], tagsGroups: [], modificationTime: Date.now() }),
  'utf8'
);
fs.writeFileSync(path.join(tempLib, 'tags.json'), JSON.stringify({ historyTags: [], starredTags: [] }), 'utf8');
fs.writeFileSync(path.join(tempLib, 'saved-filters.json'), '[]', 'utf8');

const library = loadLibrary(tempLib);
const red = importFile(library, sourceFile, { name: 'Red Large', star: 5, width: 1000, height: 800, tags: ['red'] });
red.palettes = [{ color: [255, 0, 0] }];
const blue = importFile(library, sourceFile, { name: 'Blue Small', star: 1, width: 100, height: 100, tags: ['blue'] });
blue.palettes = [{ color: [0, 0, 255] }];
saveItems(library);

const jpegBuffer = jpeg.encode({ data: Buffer.alloc(400 * 300 * 4, 255), width: 400, height: 300 }, 80).data;
const jpegPath = path.join(tempRoot, 'photo.jpg');
fs.writeFileSync(jpegPath, jpegBuffer);
const photo = importFile(library, jpegPath, { name: 'Photo' });
fs.rmSync(thumbnailPath(library, photo), { force: true });
const webpItem = importFile(library, webpFile, { name: 'Sample.webp' });
fs.rmSync(thumbnailPath(library, webpItem), { force: true });
const video = importFile(library, 'https://example.com/video.mp4', { name: 'video.mp4', size: 1234 });

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
const search = await json('GET', `${apiBase}/api/item/search?color=255,0,0&minWidth=500&sortBy=star&sortIncrease=false`);
if (search.data.length !== 1 || search.data[0].name !== 'Red Large') throw new Error('extended search filter failed');

const redMedia = await json('GET', `${apiBase}/api/item/mediaInfo?id=${encodeURIComponent(red.id)}`);
if (redMedia.data.type !== 'image') throw new Error('media info image type failed');
const videoMedia = await json('GET', `${apiBase}/api/item/mediaInfo?id=${encodeURIComponent(video.id)}`);
if (videoMedia.data.type !== 'video') throw new Error('media info video type failed');

const smart = await json('POST', `${apiBase}/api/v2/smartFolder/create`, {
  name: 'Multi Condition',
  conditions: [
    { field: 'star', operator: '>=', value: 5 },
    { field: 'width', operator: '>=', value: 500 },
  ],
});
const smartItems = await json('GET', `${apiBase}/api/v2/smartFolder/getItems?id=${encodeURIComponent(smart.data.id)}`);
if (smartItems.data.length !== 1 || smartItems.data[0].name !== 'Red Large') throw new Error('multi-condition smart folder failed');

const repair = await json('POST', `${apiBase}/api/library/repair`);
if (repair.data.repairedThumbnails < 1) throw new Error('jpeg thumbnail repair failed');
const jpegThumb = PNG.sync.read(fs.readFileSync(thumbnailPath(library, photo)));
if (Math.max(jpegThumb.width, jpegThumb.height) > 320) throw new Error('jpeg thumbnail not resized');
if (!fs.existsSync(thumbnailPath(library, webpItem))) throw new Error('webp thumbnail not generated');

await json('POST', `${apiBase}/api/library/switch`, { libraryPath: '/mock-library/Eagle Reverse Demo.library' });
try {
  await removeWithRetry(tempLib);
} catch (err) {
  // The temp library is outside the tracked project; leave it if Windows locks the file.
}
fs.rmSync(jpegPath, { force: true });

console.log('Search/media test passed');
