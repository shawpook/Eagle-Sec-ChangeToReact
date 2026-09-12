import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { packPlugin } from '../backend/src/plugin-package.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '..');
const pluginDir = path.join(projectRoot, 'tests/fixtures/plugins/example-service-plugin');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-plugin-package-'));
const packFile = path.join(tempRoot, 'example-service.eagleplugin');
const apiBase = process.env.EAGLE_API_URL || 'http://127.0.0.1:41695';

await fetch(`${apiBase}/api/plugins/uninstall`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ id: 'eagle-reverse-example-service' }),
});
packPlugin(pluginDir, packFile);
if (!fs.existsSync(packFile)) throw new Error('plugin pack failed');

async function json(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${url} HTTP ${res.status}: ${text}`);
  return JSON.parse(text);
}

try {
  const installed = await json('POST', `${apiBase}/api/plugins/install`, { file: packFile });
  if (installed.data.manifest.id !== 'eagle-reverse-example-service') throw new Error('plugin install failed');

  const plugins = await json('GET', `${apiBase}/api/plugins`);
  if (!plugins.data.some((plugin) => plugin.id === 'eagle-reverse-example-service' && plugin.installed)) {
    throw new Error('installed plugin missing from list');
  }

  await json('POST', `${apiBase}/api/plugins/disable`, { id: 'eagle-reverse-example-service' });
  await json('POST', `${apiBase}/api/plugins/enable`, { id: 'eagle-reverse-example-service' });
  await json('POST', `${apiBase}/api/plugins/uninstall`, { id: 'eagle-reverse-example-service' });

  const after = await json('GET', `${apiBase}/api/plugins/installed`);
  if (after.data.some((plugin) => plugin.id === 'eagle-reverse-example-service')) throw new Error('plugin uninstall failed');
} finally {
  try { fs.rmSync(tempRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }); } catch (err) { /* Windows 文件锁：清理失败不影响测试结果 */ }
}

console.log('Plugin package test passed');
