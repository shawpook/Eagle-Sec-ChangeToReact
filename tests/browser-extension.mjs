import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '..');
const extensionRoot = path.join(projectRoot, 'frontend/public/browser-extension');
const extensionBase = process.env.EAGLE_EXTENSION_URL || 'http://127.0.0.1:41693';
const previewOrigin = process.env.EAGLE_PREVIEW_ORIGIN || 'http://127.0.0.1:5176';

const manifest = JSON.parse(fs.readFileSync(path.join(extensionRoot, 'manifest.json'), 'utf8'));
if (manifest.manifest_version !== 3) throw new Error('extension manifest version mismatch');
for (const file of ['background.js', 'content.js', 'popup.html', 'popup.js', 'icons/icon128.png']) {
  if (!fs.existsSync(path.join(extensionRoot, file))) throw new Error(`extension file missing: ${file}`);
}

const statusRes = await fetch(`${extensionBase}/api/extension/status`);
const status = await statusRes.json();
if (status.status !== 'success' || !status.enabled) throw new Error('extension status failed');


const popup = await (await fetch(`${previewOrigin}/browser-extension/popup.html`)).text();
if (!popup.includes('Eagle Reverse Collector') || !popup.includes('popup.js')) throw new Error('popup page missing');

console.log('Browser extension test passed');
