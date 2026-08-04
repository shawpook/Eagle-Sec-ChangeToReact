import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isLocalRequest, safeResolve } from '../backend/src/security.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

const inside = safeResolve(root, 'frontend/public/workbench.html');
if (!inside.endsWith('workbench.html')) throw new Error('safeResolve rejected valid path');

let rejected = false;
try {
  safeResolve(root, '../outside.txt');
} catch (err) {
  rejected = true;
}
if (!rejected) throw new Error('safeResolve did not reject traversal');

if (!isLocalRequest({ headers: { host: '127.0.0.1:41695' } })) throw new Error('local request rejected');
if (isLocalRequest({ headers: { host: 'evil.example.com' } })) throw new Error('remote request accepted');

console.log('Security test passed');
