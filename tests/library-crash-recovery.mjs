import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadLibrary } from '../backend/src/library-store.js';
import { recoverLibrary } from '../backend/src/library-transaction-coordinator.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-crash-recovery-'));
const libraryPath = path.join(tempRoot, 'crash.library');
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

const script = `
import { pathToFileURL } from 'node:url';
const { loadLibrary } = await import(pathToFileURL(${JSON.stringify(path.join(projectRoot, 'backend/src/library-store.js'))}).href);
const { importFile } = await import(pathToFileURL(${JSON.stringify(path.join(projectRoot, 'backend/src/importer.js'))}).href);
const { ItemWorkflowService } = await import(pathToFileURL(${JSON.stringify(path.join(projectRoot, 'backend/src/item-workflow-service.js'))}).href);
const library = loadLibrary(process.env.LIBRARY_PATH);
const item = importFile(library, process.env.SOURCE_FILE, { name: 'Crash Old' });
process.env.EAGLE_TX_FAILPOINT = 'before-commit-marker';
process.env.EAGLE_TX_FAILPOINT_EXIT = '1';
new ItemWorkflowService().updateMany(library, [{ id: item.id, name: 'Crash New' }]);
`;

const child = spawn(process.execPath, ['--input-type=module', '-e', script], {
  cwd: projectRoot,
  env: {
    ...process.env,
    LIBRARY_PATH: libraryPath,
    SOURCE_FILE: path.join(projectRoot, 'frontend/public/mock-library/Eagle Reverse Demo.library/images/MOCK0001.info/Welcome Library.png'),
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let output = '';
child.stdout.on('data', (chunk) => { output += chunk.toString(); });
child.stderr.on('data', (chunk) => { output += chunk.toString(); });
const exitCode = await new Promise((resolve) => child.once('exit', resolve));
assert.equal(exitCode, 77, `crash child exited ${exitCode}: ${output}`);

const recovery = recoverLibrary(libraryPath);
assert.ok(recovery.recovered >= 1, `recovery did not roll forward: ${JSON.stringify(recovery)}`);
const reloaded = loadLibrary(libraryPath);
assert.equal(reloaded.items.find((entry) => entry.name === 'Crash New')?.name, 'Crash New');
const item = reloaded.items.find((entry) => entry.name === 'Crash New');
assert.equal(fs.existsSync(path.join(libraryPath, 'images', `${item.id}.info`, 'Crash New.png')), true);

try { fs.rmSync(tempRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }); } catch (err) { /* Windows 文件锁：清理失败不影响测试结果 */ }
console.log('LIBRARY_CRASH_RECOVERY_OK');
