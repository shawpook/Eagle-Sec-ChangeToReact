const status = document.querySelector('#status');
const setStatus = (text) => { status.textContent = text; };

/**
 * M6-1：本文件同时被两种环境加载，这里把差别**显式化**，不再让它表现为一个无从追查的 TypeError。
 *   1) 真实扩展环境——扩展从 `chrome-extension://<id>/popup.html` 加载，有 chrome.* API；
 *   2) 被 HTTP 服务的**演示页**——`frontend/public/**` 整目录逐字进产物，dev 中间件
 *      （frontend/vite.preview.config.mjs）与生产静态服务（scripts/serve-frontend.mjs）
 *      都会给它注入 `/eagle-runtime-config.js` 后以 `http://` 提供。该环境没有扩展 API。
 * 注入不影响扩展本体：扩展从磁盘读 popup.html，磁盘副本不含该标签
 * （由 tests/browser-extension-delivery.mjs 断言）。
 */
const inExtensionContext = typeof chrome !== 'undefined' && !!(chrome.runtime && chrome.runtime.id);

if (!inExtensionContext) {
  setStatus('演示页：扩展 API 不可用，请以“加载已解压的扩展程序”加载本目录');
}

/** 地址的唯一来源是 background.js；此处只消费，不复制任何地址常量。 */
async function runtimeConfig() {
  const result = await chrome.runtime.sendMessage({ type: 'get-runtime' });
  const config = result && result.ok ? result.data : null;
  if (!config || !config.workbenchUrl) throw new Error((result && result.error) || 'runtime config unavailable');
  return config;
}

async function send(type) {
  if (!inExtensionContext) {
    setStatus('演示页：无法采集');
    return;
  }
  setStatus('Collecting...');
  const result = await chrome.runtime.sendMessage({ type });
  if (result && result.ok) setStatus('Sent to Eagle Reverse');
  else setStatus('Failed: ' + ((result && result.error) || 'unknown'));
}

async function openWorkbench() {
  if (!inExtensionContext) {
    setStatus('演示页：无法打开工作台');
    return;
  }
  const { workbenchUrl } = await runtimeConfig();
  await chrome.tabs.create({ url: workbenchUrl });
}

function onClick(id, handler) {
  document.querySelector(id).addEventListener('click', () => {
    handler().catch((error) => setStatus('Failed: ' + (error && error.message ? error.message : error)));
  });
}

onClick('#collectPage', () => send('collect-page'));
onClick('#collectImage', () => send('collect-image'));
onClick('#collectScreenshot', () => send('collect-screenshot'));
onClick('#openWorkbench', openWorkbench);
