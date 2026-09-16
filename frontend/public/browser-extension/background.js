/**
 * M6-1（F18 端口单一来源）：扩展要连的地址**只在本文件声明一次**。
 *
 * 为什么缺口在扩展：M5-1 建立的唯一地址来源 `/eagle-runtime-config.js` 通过
 * `window.__EAGLE_*` 下发，而 MV3 service worker 没有 `window`，popup 也不与页面同源，
 * 两者都够不到它。扩展因此是 M5-1 覆盖范围之外唯一没有被覆盖的消费者。
 *   - 本文件的 `DEFAULT_RUNTIME` 是扩展侧的唯一声明处；
 *   - `popup.js` 通过 `chrome.runtime.sendMessage({ type: 'get-runtime' })` 取同一份值，
 *     popup 侧不复制任何地址常量。
 *
 * 默认值必须等于**生产**默认，否则默认部署下扩展连不上：
 *   apiBaseUrl   == scripts/start-production.mjs 的 EAGLE_EXTENSION_PORT 默认（41693）
 *   workbenchUrl == scripts/start-production.mjs 的 EAGLE_FRONTEND_PORT 默认（4173）
 * `tests/browser-extension-delivery.mjs` 反向读取该脚本校验这两个值，防止与生产漂移。
 *
 * 运行期覆盖（不改变上面的默认值语义）：
 *   `chrome.storage.local.eagleRuntimeConfig = { apiBaseUrl, workbenchUrl }`。
 * 注意 manifest 的 `host_permissions` 不随运行期变化，故 manifest 声明的是 **loopback 全端口**，
 * 以便 EAGLE_EXTENSION_PORT 换端口后扩展仍被授权；取舍说明见同目录 README.md。
 */
const RUNTIME_STORAGE_KEY = 'eagleRuntimeConfig';

const DEFAULT_RUNTIME = Object.freeze({
  apiBaseUrl: 'http://localhost:41693',
  workbenchUrl: 'http://localhost:4173/workbench.html',
});

function normalizeBase(value) {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/\/+$/, '');
}

async function resolveRuntime() {
  let override = null;
  try {
    const bag = await chrome.storage.local.get(RUNTIME_STORAGE_KEY);
    override = bag && bag[RUNTIME_STORAGE_KEY];
  } catch (error) {
    override = null; // 存储不可用时退回默认值，不阻断采集
  }
  return {
    apiBaseUrl: normalizeBase(override && override.apiBaseUrl) || DEFAULT_RUNTIME.apiBaseUrl,
    workbenchUrl: normalizeBase(override && override.workbenchUrl) || DEFAULT_RUNTIME.workbenchUrl,
  };
}

async function postCapture(body) {
  const { apiBaseUrl } = await resolveRuntime();
  const form = new URLSearchParams();
  for (const [key, value] of Object.entries(body || {})) {
    if (Array.isArray(value)) form.set(key, JSON.stringify(value));
    else if (value !== undefined && value !== null) form.set(key, String(value));
  }
  return fetch(`${apiBaseUrl}/api/collect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form,
  }).then((response) => response.json());
}

async function collectPage(payload) {
  return postCapture({
    type: 'import-images',
    title: payload.title || '',
    url: payload.url || '',
    website: payload.url || '',
    images: Array.isArray(payload.images) ? payload.images.map((src) => ({ src, title: payload.title || '' })) : [],
  });
}

async function collectImage(payload) {
  return postCapture({
    type: 'image',
    title: payload.title || '',
    src: payload.src || '',
    url: payload.url || '',
    website: payload.url || '',
  });
}

async function collectScreenshot(payload) {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs && tabs[0];
  if (!tab || tab.id === undefined) throw new Error('No active tab found');
  const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
  return postCapture({
    type: 'screencapture',
    title: payload.title || tab.title || 'Page Screenshot',
    src: dataUrl,
    url: tab.url || payload.url || '',
    website: tab.url || payload.url || '',
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  Promise.resolve()
    .then(() => {
      if (message.type === 'get-runtime') return resolveRuntime();
      if (message.type === 'collect-page') return collectPage(message);
      if (message.type === 'collect-image') return collectImage(message);
      if (message.type === 'collect-screenshot') return collectScreenshot(message);
      throw new Error('Unknown collect type');
    })
    .then((data) => sendResponse({ ok: true, data }))
    .catch((err) => sendResponse({ ok: false, error: err.message }));
  return true;
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ eagleReverseExtensionReady: true });
});
