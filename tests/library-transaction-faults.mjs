import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadLibrary } from '../backend/src/library-store.js';
import { recoverLibrary } from '../backend/src/library-transaction-coordinator.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(projectRoot, 'frontend/public/mock-library/Eagle Reverse Demo.library/images/MOCK0001.info/Welcome Library.png');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-tx-faults-'));
const libraryPath = path.join(tempRoot, 'faults.library');

function makeLibrary() {
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
}

function runCrashChild(failpoint) {
  const script = `
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const { loadLibrary } = await import(pathToFileURL(${JSON.stringify(path.join(projectRoot, 'backend/src/library-store.js'))}).href);
const { importFile } = await import(pathToFileURL(${JSON.stringify(path.join(projectRoot, 'backend/src/importer.js'))}).href);
const { ItemWorkflowService } = await import(pathToFileURL(${JSON.stringify(path.join(projectRoot, 'backend/src/item-workflow-service.js'))}).href);
const library = loadLibrary(process.env.LIBRARY_PATH);
const item = importFile(library, process.env.SOURCE_FILE, { name: 'Old Name' });
process.env.EAGLE_TX_FAILPOINT = process.env.TX_FAILPOINT;
process.env.EAGLE_TX_FAILPOINT_EXIT = '1';
new ItemWorkflowService().updateMany(library, [{ id: item.id, name: 'New Name' }]);
`;
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--input-type=module', '-e', script], {
      cwd: projectRoot,
      env: {
        ...process.env,
        LIBRARY_PATH: libraryPath,
        SOURCE_FILE: source,
        TX_FAILPOINT: failpoint,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    child.stdout.on('data', (chunk) => { output += chunk.toString(); });
    child.stderr.on('data', (chunk) => { output += chunk.toString(); });
    child.once('error', reject);
    child.once('exit', (code) => {
      if (code !== 77) reject(new Error(`Crash child exited ${code}: ${output}`));
      else resolve();
    });
  });
}

function itemState(library) {
  const item = library.items.find((entry) => entry.name === 'Old Name' || entry.name === 'New Name');
  assert.ok(item, 'expected item metadata was not found');
  const originalNew = path.join(library.rootDir, 'images', `${item.id}.info`, 'New Name.png');
  const originalOld = path.join(library.rootDir, 'images', `${item.id}.info`, 'Old Name.png');
  const cacheItem = fs.readFileSync(path.join(library.rootDir, 'cache.json'), 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .find((entry) => entry.id === item.id);
  return {
    name: item.name,
    metadata: item.name,
    cache: cacheItem?.name,
    newFileExists: fs.existsSync(originalNew),
    oldFileExists: fs.existsSync(originalOld),
  };
}

function assertComplete(state, expectedName) {
  assert.equal(state.metadata, expectedName);
  assert.equal(state.cache, expectedName);
  if (expectedName === 'New Name') {
    assert.equal(state.newFileExists, true);
    assert.equal(state.oldFileExists, false);
  } else {
    assert.equal(state.newFileExists, false);
    assert.equal(state.oldFileExists, true);
  }
}

for (const [failpoint, expectedName] of [
  ['after-manifest-prepared', 'Old Name'],
  ['after-operation:0', 'New Name'],
  ['before-commit-marker', 'New Name'],
  ['after-commit-before-cleanup', 'New Name'],
]) {
  makeLibrary();
  await runCrashChild(failpoint);
  const recovery = recoverLibrary(libraryPath);
  assert.ok(
    recovery.recovered + recovery.rolledBack + recovery.cleaned >= 1,
    `recovery did not settle transaction for ${failpoint}: ${JSON.stringify(recovery)}`
  );
  assert.equal(recovery.recoveryRequired, 0, `recovery required manual intervention: ${JSON.stringify(recovery)}`);
  assertComplete(itemState(loadLibrary(libraryPath)), expectedName);
  fs.rmSync(libraryPath, { recursive: true, force: true });
}

try { fs.rmSync(tempRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }); } catch (err) { /* Windows 文件锁：清理失败不影响测试结果 */ }
console.log('LIBRARY_TRANSACTION_FAULTS_OK');
