/** M6-2：插件页 SDK 注入顺序 + /plugin-shim.js 回调**真实派发**。
 *
 * 断言对象是**后端真实供出的字节**（不是源码常量）：把服务端返回的插件页 HTML，
 * 按文档顺序在最小 DOM 里求值，外部 <script src> 真的回后端取。因此：
 *   - 顺序错（shim 晚于插件脚本）→ 插件顶层 eagle 未定义 → ReferenceError，测试失败；
 *   - 注册了但从不派发 → 探针与副作用（marker 文件 / DOM 状态）对不上，测试失败。
 *
 * 负向自证：把 shim 从同一份 HTML 里摘掉后**必须**复现 ReferenceError，
 * 证明上面几条不是「恒真断言」。
 */
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '..');
const require = createRequire(import.meta.url);
const markerPath = path.join(os.tmpdir(), 'eagle-reverse-plugin-marker.txt');
const shimTag = '<script src="/plugin-shim.js"></script>';

const results = [];
async function check(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
  } catch (err) {
    results.push({ name, ok: false, error: err.message });
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function freePort() {
  return new Promise((resolve, reject) => {
    const server = http.createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
  });
}

async function startServer() {
  const [apiPort, thumbnailPort, extensionPort] = await Promise.all([freePort(), freePort(), freePort()]);
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-plugin-sdk-'));
  const child = spawn(process.execPath, ['backend/src/server.js'], {
    cwd: projectRoot,
    env: {
      ...process.env,
      EAGLE_API_PORT: String(apiPort),
      EAGLE_THUMBNAIL_PORT: String(thumbnailPort),
      EAGLE_EXTENSION_PORT: String(extensionPort),
      EAGLE_LIBRARY_STATE_FILE: path.join(tempRoot, 'library-state.json'),
      EAGLE_USER_DATA_DIR: tempRoot,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk.toString(); });
  child.stderr.on('data', (chunk) => { output += chunk.toString(); });
  const deadline = Date.now() + 15000;
  while (!output.includes(`localhost:${apiPort}`)) {
    if (child.exitCode !== null) throw new Error(`server exited: ${output}`);
    if (Date.now() > deadline) throw new Error(`server timeout: ${output}`);
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return {
    child,
    tempRoot,
    apiBase: `http://127.0.0.1:${apiPort}`,
    stop: async () => {
      child.kill();
      await new Promise((resolve) => {
        if (child.exitCode !== null) {
          resolve();
          return;
        }
        child.once('exit', resolve);
        setTimeout(resolve, 3000);
      });
      try {
        fs.rmSync(tempRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
      } catch (err) {
        // Windows 文件锁：清理失败不影响测试结果。
      }
    },
  };
}

/** 最小 DOM：只实现插件页真正用到的面。window 自身即 vm 的全局对象，
 *  这样 `window.eagle = ...` 与插件脚本里的裸 `eagle` 指向同一个绑定（与浏览器一致）。 */
function createDom() {
  const winListeners = new Map();
  const docListeners = new Map();
  const elements = new Map();
  const register = (map, type, fn) => {
    if (!map.has(type)) map.set(type, []);
    map.get(type).push(fn);
  };
  const fire = (map, type) => {
    for (const fn of map.get(type) || []) fn({ type });
  };
  const makeElement = (id) => ({ id, textContent: '', dataset: {} });
  const body = makeElement('body');
  elements.set('body', body);
  const document = {
    readyState: 'loading',
    hidden: false,
    body,
    documentElement: makeElement('html'),
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, makeElement(id));
      return elements.get(id);
    },
    addEventListener(type, fn) { register(docListeners, type, fn); },
    fire(type) { fire(docListeners, type); },
  };
  const window = {
    document,
    console,
    require,
    setTimeout,
    clearTimeout,
    URL,
    location: { origin: 'http://127.0.0.1/' },
    addEventListener(type, fn) { register(winListeners, type, fn); },
    fire(type) { fire(winListeners, type); },
  };
  window.window = window;
  vm.createContext(window);
  return { window, document, elements };
}

/** 按文档顺序求值页面里的 <script>：内联直接跑，src 的回后端真取。 */
async function runPage(html, baseUrl) {
  const dom = createDom();
  const scriptRe = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = scriptRe.exec(html)) !== null) {
    const srcMatch = /\bsrc\s*=\s*["']([^"']+)["']/i.exec(match[1]);
    let code = match[2];
    let filename = `${baseUrl}#inline@${match.index}`;
    if (srcMatch) {
      const url = new URL(srcMatch[1], baseUrl).href;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`script fetch failed: ${url} HTTP ${res.status}`);
      code = await res.text();
      filename = url;
    }
    vm.runInContext(code, dom.window, { filename });
  }
  dom.document.readyState = 'complete';
  dom.document.fire('DOMContentLoaded');
  return dom;
}

/** 服务端供出的 HTML 里所有 <script>（含内联正文，用于识别 SDK 自己的引导脚本）。 */
function scriptTags(html) {
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  const tags = [];
  let match;
  while ((match = re.exec(html)) !== null) {
    tags.push({
      at: match.index,
      attrs: match[1],
      body: match[2],
      isShim: match[1].includes('/plugin-shim.js'),
      // SDK 自己的引导脚本（注入的 __eaglePluginManifest 常量），不算「插件自身的脚本」。
      isSdkBootstrap: match[2].startsWith('window.__eaglePluginManifest='),
    });
  }
  return tags;
}

let server = null;
try {
  server = await startServer();
  const pluginUrl = `${server.apiBase}/plugins/eagle-reverse-example-service/index.html`;
  const templateUrl = `${server.apiBase}/plugin-templates/window/index.html`;
  const pluginHtml = await (await fetch(pluginUrl)).text();
  const templateHtml = await (await fetch(templateUrl)).text();

  await check('插件页 SDK 顺序：/plugin-shim.js 先于插件自身的任何脚本', async () => {
    const tags = scriptTags(pluginHtml);
    const shim = tags.find((tag) => tag.isShim);
    assert(shim, `served plugin page has no /plugin-shim.js tag:\n${pluginHtml}`);
    const pluginScripts = tags.filter((tag) => !tag.isShim && !tag.isSdkBootstrap);
    assert(pluginScripts.length > 0, `served plugin page has no plugin scripts:\n${pluginHtml}`);
    assert(
      pluginScripts.some((tag) => /js\/plugin\.js/.test(tag.attrs)),
      `served plugin page has no js/plugin.js tag:\n${pluginHtml}`
    );
    // 契约：shim 必须早于插件自身的**每一个**脚本。原实现插在 </head> 前，
    // 而插件入口就在 <head> 内更靠前 —— 这条断言正是那个缺陷的回归守卫。
    for (const tag of pluginScripts) {
      assert(tag.at > shim.at, `plugin script at ${tag.at} precedes the shim at ${shim.at}: <script${tag.attrs}>`);
    }
  });

  await check('插件顶层能拿到 eagle，且 create/run 回调被真实调用（fs 副作用）', async () => {
    fs.rmSync(markerPath, { force: true });
    const dom = await runPage(pluginHtml, pluginUrl);
    assert(typeof dom.window.eagle === 'object' && dom.window.eagle !== null, 'window.eagle missing after page scripts ran');
    const marker = fs.readFileSync(markerPath, 'utf8');
    assert(marker.includes('PLUGIN-CREATED'), `create callback never ran, marker=${JSON.stringify(marker)}`);
    assert(marker.includes('PLUGIN-RUN'), `run callback never ran, marker=${JSON.stringify(marker)}`);
    // create 的入参来自服务端注入的 manifest，不是 undefined。
    assert(marker.includes('eagle-reverse-example-service'), `create callback got no manifest, marker=${JSON.stringify(marker)}`);
  });

  await check('探针：派发序列与已注册回调可断言（不只看 window.eagle 存在）', async () => {
    const dom = await runPage(pluginHtml, pluginUrl);
    const dispatched = dom.window.eagle.__dispatched;
    assert(Array.isArray(dispatched), 'eagle.__dispatched probe missing');
    assert(dispatched.slice(0, 3).join(',') === 'create,run,show', `unexpected dispatch order: ${dispatched.join(',')}`);
    assert(typeof dom.window.eagle.__callbacks.create === 'function', 'create callback was never registered');
    assert(typeof dom.window.eagle.__callbacks.run === 'function', 'run callback was never registered');
    assert(dom.window.__eaglePluginLifecycleFailures.length === 0, `callbacks threw: ${JSON.stringify(dom.window.__eaglePluginLifecycleFailures)}`);
  });

  await check('负向自证：摘掉 shim 后同一份插件页确实 ReferenceError', async () => {
    const stripped = pluginHtml
      .replace(/<script>window\.__eaglePluginManifest=[\s\S]*?<\/script>/, '')
      .replace(shimTag, '');
    assert(stripped !== pluginHtml && !stripped.includes('/plugin-shim.js'), 'failed to strip the shim from the served page');
    let error = null;
    try {
      await runPage(stripped, pluginUrl);
    } catch (err) {
      error = err;
    }
    assert(error !== null, 'page without the shim loaded fine — the ordering assertions above prove nothing');
    assert(error.name === 'ReferenceError', `expected ReferenceError, got ${error.name}: ${error.message}`);
    assert(/eagle is not defined/.test(error.message), `unexpected error message: ${error.message}`);
  });

  await check('模板页五个回调全部真实派发（create/run/show/hide/beforeExit）', async () => {
    const dom = await runPage(templateHtml, templateUrl);
    const dispatched = dom.window.eagle.__dispatched;
    assert(dispatched.join(',') === 'create,run,show', `after load expected create,run,show — got ${dispatched.join(',')}`);
    // show 的副作用：模板脚手架在 show 里点亮页面标记。
    assert(dom.document.body.dataset.eaglePluginVisible === '1', 'show callback did not run');
    // 页面隐藏 → hide；页面卸载 → beforeExit。
    dom.document.hidden = true;
    dom.document.fire('visibilitychange');
    assert(dom.document.body.dataset.eaglePluginVisible === '0', 'hide callback did not run');
    dom.window.fire('pagehide');
    assert(dom.window.eagle.__dispatched.includes('beforeExit'), 'beforeExit was never dispatched');
    assert(
      dom.document.getElementById('plugin-status').textContent === 'exiting',
      `beforeExit callback did not run, status=${dom.document.getElementById('plugin-status').textContent}`
    );
    assert(dom.window.__eaglePluginLifecycleFailures.length === 0, `callbacks threw: ${JSON.stringify(dom.window.__eaglePluginLifecycleFailures)}`);
  });

  await check('调用失败：回调抛错被记录且不中断后续派发（不吞、不静默）', async () => {
    const shimUrl = `${server.apiBase}/plugin-shim.js`;
    const html = `<html><head><script src="${shimUrl}"></script><script>
      eagle.onPluginCreate(function () { throw new Error('boom'); });
      eagle.onPluginRun(function () { window.__runRan = true; });
    </script></head><body></body></html>`;
    const dom = await runPage(html, server.apiBase);
    assert(dom.window.__runRan === true, 'a throwing create callback aborted the rest of the lifecycle');
    const failures = dom.window.__eaglePluginLifecycleFailures;
    assert(failures.length === 1 && failures[0].name === 'create', `expected one recorded create failure, got ${JSON.stringify(failures)}`);
    assert(/boom/.test(failures[0].message), `failure message lost: ${JSON.stringify(failures)}`);
  });
} finally {
  if (server) await server.stop();
}

const failed = results.filter((entry) => !entry.ok);
for (const entry of results) {
  console.log(`${entry.ok ? 'PASS' : 'FAIL'} ${entry.name}${entry.error ? ` :: ${entry.error}` : ''}`);
}
if (failed.length > 0) {
  console.error(`plugin sdk lifecycle failed: ${failed.length}/${results.length}`);
  process.exit(1);
}
console.log(`plugin sdk lifecycle passed: ${results.length}/${results.length}`);
