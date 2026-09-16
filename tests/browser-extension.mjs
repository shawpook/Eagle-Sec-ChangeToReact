/**
 * 浏览器扩展的行为冒烟（需要后端与一个前端服务在跑）。
 *
 * 静态契约（端口单一来源、权限面、产物逐字一致）由 `tests/browser-extension-delivery.mjs`
 * 断言，不需要任何服务；本文件只断言「跑起来之后」的行为。
 *
 * M6-1：`popup.html` 同时被两种环境加载，本文件把两者分开断言：
 *   1. **扩展本体**——从磁盘读，扩展经 `chrome-extension://` 加载，不经 HTTP，因此不得含
 *      运行时配置标签；
 *   2. **演示副本**——同一个文件被前端以 HTTP 交付，由 dev 中间件 / `scripts/serve-frontend.mjs`
 *      注入 `/eagle-runtime-config.js`（这层差别正是两者的分界，缺了就无从区分）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { RUNTIME_CONFIG_PATH } from '../frontend/runtime-config.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '..');
const extensionRoot = path.join(projectRoot, 'frontend/public/browser-extension');
const extensionBase = process.env.EAGLE_EXTENSION_URL || 'http://127.0.0.1:41693';
// 演示副本可能由 dev（Vite 5176）或生产静态服务（scripts/serve-frontend.mjs 4173）交付，
// 两者是同一份产物的不同启动方式；EAGLE_PREVIEW_ORIGIN 显式指定时优先。
const previewOrigins = [
  process.env.EAGLE_PREVIEW_ORIGIN,
  'http://127.0.0.1:5176',
  'http://127.0.0.1:4173',
].filter(Boolean);

const manifest = JSON.parse(fs.readFileSync(path.join(extensionRoot, 'manifest.json'), 'utf8'));
if (manifest.manifest_version !== 3) throw new Error('extension manifest version mismatch');
for (const file of ['background.js', 'content.js', 'popup.html', 'popup.js', 'icons/icon128.png']) {
  if (!fs.existsSync(path.join(extensionRoot, file))) throw new Error(`extension file missing: ${file}`);
}

// 扩展本体：交付给浏览器的就是这一份，必须干净。
const popupOnDisk = fs.readFileSync(path.join(extensionRoot, 'popup.html'), 'utf8');
if (!popupOnDisk.includes('Eagle Reverse Collector') || !popupOnDisk.includes('popup.js')) {
  throw new Error('extension popup page missing');
}
if (popupOnDisk.includes(RUNTIME_CONFIG_PATH)) {
  throw new Error(`扩展本体的 popup.html 不得含 ${RUNTIME_CONFIG_PATH}——扩展从磁盘加载，不经 HTTP 注入`);
}

const statusRes = await fetch(`${extensionBase}/api/extension/status`);
const status = await statusRes.json();
if (status.status !== 'success' || !status.enabled) throw new Error('extension status failed');

let previewOrigin = null;
let popupDemo = null;
for (const origin of previewOrigins) {
  try {
    const response = await fetch(`${origin}/browser-extension/popup.html`);
    if (!response.ok) continue;
    popupDemo = await response.text();
    previewOrigin = origin;
    break;
  } catch (error) {
    continue;
  }
}
if (!popupDemo) throw new Error(`popup demo page unreachable via any of: ${previewOrigins.join(', ')}`);
if (!popupDemo.includes('Eagle Reverse Collector') || !popupDemo.includes('popup.js')) throw new Error('popup demo page missing');
if (!popupDemo.includes(RUNTIME_CONFIG_PATH)) {
  throw new Error(`演示副本未经 HTTP 注入 ${RUNTIME_CONFIG_PATH}——popup 的两种加载环境就无从区分`);
}
if (popupDemo === popupOnDisk) {
  throw new Error('演示副本与扩展本体逐字相同——注入未生效，两者混为一谈');
}

console.log(`Browser extension test passed（演示副本来自 ${previewOrigin}）`);
