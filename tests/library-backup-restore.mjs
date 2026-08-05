import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadLibrary } from '../backend/src/library-store.js';
import { importFile } from '../backend/src/importer.js';
import {
  createRecoveryPoint,
  listRecoveryPoints,
  restoreRecoveryPoint,
  verifyRecoveryPoint,
} from '../backend/src/library-backup-service.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-backup-restore-'));
const libraryPath = path.join(tempRoot, 'source.library');
fs.mkdirSync(libraryPath, { recursive: true });
fs.writeFileSync(path.join(libraryPath, 'metadata.json'), JSON.stringify({
  applicationVersion: '4.0.0',
  folders: [],
  smartFolders: [],
  quickAccess: [],
  tagsGroups: [],
  modificationTime: Date.now(),
}), 'utf8');
fs.writeFileSync(path.join(libraryPath, 'tags.json'), JSON.stringify({ historyTags: [], starredTags: [] }), 'utf8');
fs.writeFileSync(path.join(libraryPath, 'saved-filters.json'), '[]', 'utf8');

const library = loadLibrary(libraryPath);
const source = path.join(projectRoot, 'frontend/public/mock-library/Eagle Reverse Demo.library/images/MOCK0001.info/Welcome Library.png');
const imported = importFile(library, source, { name: 'Backup Item', tags: ['backup'] });

const first = createRecoveryPoint(libraryPath, { label: 'first' });
const listed = listRecoveryPoints(libraryPath);
assert.ok(listed.some((entry) => entry.id === first.id), 'created recovery point was not listed');
const verified = verifyRecoveryPoint(libraryPath, first.id);
assert.equal(verified.ok, true, `recovery point verification failed: ${JSON.stringify(verified)}`);

const backupRoot = path.join(libraryPath, 'backup', 'recovery-v1', 'backups', first.id);
const tampered = path.join(backupRoot, 'cache.json');
fs.writeFileSync(tampered, 'tampered', 'utf8');
const tamperedVerification = verifyRecoveryPoint(libraryPath, first.id);
assert.equal(tamperedVerification.ok, false, 'tampered recovery point should not verify');
fs.writeFileSync(tampered, fs.readFileSync(path.join(libraryPath, 'cache.json'), 'utf8'), 'utf8');

const second = createRecoveryPoint(libraryPath, { label: 'second' });
assert.equal(verifyRecoveryPoint(libraryPath, second.id).ok, true);
const destination = path.join(tempRoot, 'restored.library');
const restored = restoreRecoveryPoint(libraryPath, second.id, destination);
assert.equal(fs.existsSync(destination), true);
const restoredLibrary = loadLibrary(destination);
const restoredItem = restoredLibrary.itemMap.get(imported.id);
assert.ok(restoredItem, 'restored library is missing the imported item');
assert.equal(restoredItem.name, 'Backup Item');
assert.deepEqual(restoredItem.tags, ['backup']);
assert.equal(restored.libraryName, 'restored');

fs.rmSync(tempRoot, { recursive: true, force: true });
console.log('LIBRARY_BACKUP_RESTORE_OK');
