import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { scanLibraryConsistency } from '../backend/src/library-consistency-service.js';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-consistency-scan-'));
const libraryPath = path.join(tempRoot, 'scan.library');
fs.mkdirSync(path.join(libraryPath, 'images', 'ITEM-1.info'), { recursive: true });
fs.mkdirSync(path.join(libraryPath, 'images', 'ITEM-ORPHAN.info'), { recursive: true });
fs.writeFileSync(path.join(libraryPath, 'metadata.json'), JSON.stringify({
  applicationVersion: '4.0.0',
  folders: ['FOLDER-MISSING'],
  smartFolders: [],
  quickAccess: [],
  tagsGroups: [],
  modificationTime: Date.now(),
}), 'utf8');
fs.writeFileSync(path.join(libraryPath, 'tags.json'), JSON.stringify({ historyTags: [], starredTags: [] }), 'utf8');
fs.writeFileSync(path.join(libraryPath, 'saved-filters.json'), '[]', 'utf8');
fs.writeFileSync(path.join(libraryPath, 'folders.json'), '[]', 'utf8');
fs.writeFileSync(path.join(libraryPath, 'cache.json'), JSON.stringify({
  id: 'ITEM-1',
  name: 'Broken Item',
  ext: 'png',
  folders: ['FOLDER-MISSING'],
}), 'utf8');
fs.writeFileSync(path.join(libraryPath, 'search-index.json'), JSON.stringify({
  version: 2,
  updatedAt: Date.now(),
  items: [],
}), 'utf8');
fs.writeFileSync(path.join(libraryPath, 'images', 'ITEM-1.info', 'metadata.json'), JSON.stringify({
  id: 'ITEM-1',
  name: 'Broken Item',
  ext: 'png',
}), 'utf8');
fs.writeFileSync(path.join(libraryPath, 'images', 'ITEM-ORPHAN.info', 'metadata.json'), JSON.stringify({
  id: 'ITEM-ORPHAN',
  name: 'Orphan',
  ext: 'png',
}), 'utf8');

function directoryHash(root) {
  const lines = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) lines.push(`${path.relative(root, full).split(path.sep).join('/')}:${crypto.createHash('sha256').update(fs.readFileSync(full)).digest('hex')}`);
    }
  };
  walk(root);
  return lines.sort().join('\n');
}

const before = directoryHash(libraryPath);
const report = scanLibraryConsistency(libraryPath);
const codes = new Set(report.issues.map((entry) => entry.code));
for (const expected of [
  'MISSING_ORIGINAL_FILE',
  'MISSING_THUMBNAIL',
  'CACHE_ITEM_MISSING',
  'INVALID_FOLDER_REFERENCE',
  'SEARCH_INDEX_ITEM_MISSING',
]) {
  assert.ok(codes.has(expected), `scan did not report ${expected}: ${JSON.stringify(report.issues)}`);
}
assert.ok(report.reportDigest && report.issueCount > 0, 'scan report digest was not generated');
const after = directoryHash(libraryPath);
assert.equal(before, after, 'consistency scan mutated the library');

try { fs.rmSync(tempRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }); } catch (err) { /* Windows 文件锁：清理失败不影响测试结果 */ }
console.log('LIBRARY_CONSISTENCY_SCAN_OK');
