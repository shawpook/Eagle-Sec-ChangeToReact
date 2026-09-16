/** M6-2 验收 3：插件根收敛到仓库内 `plugins/` 之后，
 *  ① 资源缺失必须**明确失败**（D24①）——不是静默 warn 后继续供出 404 页面；
 *  ② 不再有「隐式开发机依赖」（工作区上两级 / H:/dev/plugins / H:/resources）；
 *  ③ 对外 URL **一个都不变**（只换磁盘根，不动契约）；
 *  ④ 调用失败路径可观测（未知插件 id）。
 *
 *  负向自证：把 EAGLE_PLUGINS_ROOT 指到不存在的目录，backend 与 electron 都必须非零退出并给出
 *  明确错误码；同时用**好根**做对照（exit 0 + 插件真被发现加载），证明这两条断言有区分度、
 *  不是「只要起过进程就算过」。
 */
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '..');
const repoPluginsRoot = path.join(projectRoot, 'plugins');
const require = createRequire(import.meta.url);

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

/** 去掉注释后的**可执行代码行**（行内注释也剥，但要求 `//` 前有空白，
 *  免得把 `http://localhost` 这类字面量当成注释削掉）。 */
function codeLines(source) {
  const out = [];
  let inBlock = false;
  for (const raw of source.split(/\r?\n/)) {
    const line = raw.replace(/\s\/\/.*$/, '').trim();
    if (inBlock) {
      if (line.includes('*/')) inBlock = false;
      continue;
    }
    if (line.startsWith('/*')) {
      if (!line.includes('*/')) inBlock = true;
      continue;
    }
    if (line.startsWith('//') || line.startsWith('*') || line === '') continue;
    out.push(line);
  }
  return out;
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

const tempDirs = [];
function makeTempRoot(prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

/** 起一个后端直到退出，返回退出码与全部输出。用于「必须失败」的场景。 */
async function runServerExpectExit(env, timeoutMs = 20000) {
  const child = spawn(process.execPath, [path.join(projectRoot, 'backend/src/server.js')], {
    cwd: projectRoot,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk.toString(); });
  child.stderr.on('data', (chunk) => { output += chunk.toString(); });
  const code = await new Promise((resolve) => {
    const timer = setTimeout(() => {
      child.kill();
      resolve('TIMEOUT');
    }, timeoutMs);
    child.once('exit', (exitCode) => {
      clearTimeout(timer);
      resolve(exitCode);
    });
  });
  return { code, output };
}

/** 起一个后端并等它就绪（干净 cwd / electron 对照都用它），返回句柄。 */
async function startServer({ cwd = projectRoot, env = {} } = {}) {
  const [apiPort, thumbnailPort, extensionPort] = await Promise.all([freePort(), freePort(), freePort()]);
  const tempRoot = makeTempRoot('eagle-plugin-server-');
  const child = spawn(process.execPath, [path.join(projectRoot, 'backend/src/server.js')], {
    cwd,
    env: {
      ...process.env,
      EAGLE_API_PORT: String(apiPort),
      EAGLE_THUMBNAIL_PORT: String(thumbnailPort),
      EAGLE_EXTENSION_PORT: String(extensionPort),
      EAGLE_LIBRARY_STATE_FILE: path.join(tempRoot, 'library-state.json'),
      EAGLE_USER_DATA_DIR: tempRoot,
      ...env,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk.toString(); });
  child.stderr.on('data', (chunk) => { output += chunk.toString(); });
  const deadline = Date.now() + 20000;
  while (!output.includes(`localhost:${apiPort}`)) {
    if (child.exitCode !== null) throw new Error(`server exited early: ${output}`);
    if (Date.now() > deadline) throw new Error(`server timeout: ${output}`);
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return {
    apiPort,
    apiBase: `http://127.0.0.1:${apiPort}`,
    output: () => output,
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
    },
  };
}

/** 起一次 electron 主进程到退出。入口必须是 `electron/main.cjs`
 *  ——仓库 package.json 没有 `main` 字段，`electron .` 不会执行任何主进程代码
 *  （实测：静默存活、零输出，会让这类断言变成恒真断言）。 */
async function runElectron({ env, timeoutMs = 60000 }) {
  const electronBinary = require('electron');
  assert(typeof electronBinary === 'string' && fs.existsSync(electronBinary), `electron binary not found: ${electronBinary}`);
  const child = spawn(electronBinary, [path.join(projectRoot, 'electron/main.cjs'), '--smoke-plugin'], {
    cwd: projectRoot,
    env: {
      ...process.env,
      EAGLE_ELECTRON_USER_DATA_DIR: makeTempRoot('eagle-plugin-electron-userdata-'),
      ...env,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk.toString(); });
  child.stderr.on('data', (chunk) => { output += chunk.toString(); });
  const code = await new Promise((resolve) => {
    const timer = setTimeout(() => {
      child.kill();
      resolve('TIMEOUT');
    }, timeoutMs);
    child.once('exit', (exitCode) => {
      clearTimeout(timer);
      resolve(exitCode);
    });
  });
  return { code, output };
}

/** 环境里若已被外部注入 EAGLE_PLUGINS_ROOT，本测试的前提就不成立。 */
if (process.env.EAGLE_PLUGINS_ROOT !== undefined) {
  console.log(`WARN 环境已注入 EAGLE_PLUGINS_ROOT=${process.env.EAGLE_PLUGINS_ROOT}，默认根断言可能被掩盖`);
}

await check('静态：插件根解析不再依赖工作区外的隐式路径', async () => {
  const serverLines = codeLines(fs.readFileSync(path.join(projectRoot, 'backend/src/server.js'), 'utf8'));
  for (const [needle, why] of [
    ['programRoot', '工作区上两级的 programRoot 仍是可执行代码'],
    ['resources/plugin_templates', '仍引用不存在的 resources/plugin_templates'],
    ['tests/fixtures/plugins', '仍从测试目录 tests/fixtures/plugins 读插件'],
  ]) {
    const hit = serverLines.find((line) => line.includes(needle));
    assert(!hit, `${why}: ${hit}`);
  }

  const electronSource = fs.readFileSync(path.join(projectRoot, 'electron/main.cjs'), 'utf8');
  const bodyMatch = /async function loadServicePlugins\(\)\s*\{([\s\S]*?)\n\}/.exec(electronSource);
  assert(bodyMatch, 'electron/main.cjs has no loadServicePlugins body');
  const bodyLines = codeLines(bodyMatch[1]);
  assert(
    !bodyLines.some((line) => /'\.\.',\s*'\.\.'/.test(line) || /"\.\.",\s*"\.\."/.test(line)),
    'electron loadServicePlugins still resolves the plugin root via the parent-of-parent directory'
  );
  assert(
    bodyLines.some((line) => line.includes('EAGLE_PLUGINS_ROOT')),
    'electron loadServicePlugins does not honour EAGLE_PLUGINS_ROOT'
  );
  assert(
    bodyLines.some((line) => line.includes("'plugins'") || line.includes('"plugins"')),
    'electron loadServicePlugins does not point at the in-repo plugins/ root'
  );

  assert(
    !fs.existsSync(path.join(projectRoot, 'tests/fixtures/plugins')),
    'tests/fixtures/plugins still exists — the example plugin was copied, not moved'
  );
  assert(fs.existsSync(path.join(repoPluginsRoot, 'example-service-plugin/manifest.json')), 'in-repo example plugin missing');
});

await check('资源缺失①：EAGLE_PLUGINS_ROOT 指向不存在的目录 → 非零退出 + PLUGIN_ROOT_MISSING', async () => {
  const missing = path.join(makeTempRoot('eagle-plugin-absent-'), 'plugins');
  const { code, output } = await runServerExpectExit({
    EAGLE_PLUGINS_ROOT: missing,
    EAGLE_USER_DATA_DIR: makeTempRoot('eagle-plugin-absent-userdata-'),
    EAGLE_API_PORT: '0',
  });
  assert(code !== 'TIMEOUT', `server kept running with a missing plugins root:\n${output}`);
  assert(code !== 0, `server exited 0 despite a missing plugins root:\n${output}`);
  assert(output.includes('PLUGIN_ROOT_MISSING'), `missing explicit error code:\n${output}`);
  assert(output.includes(missing), `error does not name the missing path:\n${output}`);
});

await check('资源缺失②：有模板根但无示例插件 → PLUGIN_EXAMPLE_MISSING', async () => {
  const root = makeTempRoot('eagle-plugin-no-example-');
  fs.mkdirSync(path.join(root, 'plugins/_templates'), { recursive: true });
  const { code, output } = await runServerExpectExit({
    EAGLE_PLUGINS_ROOT: path.join(root, 'plugins'),
    EAGLE_USER_DATA_DIR: makeTempRoot('eagle-plugin-no-example-userdata-'),
  });
  assert(code !== 'TIMEOUT' && code !== 0, `expected non-zero exit, got ${code}:\n${output}`);
  assert(output.includes('PLUGIN_EXAMPLE_MISSING'), `missing explicit error code:\n${output}`);
});

await check('资源缺失③：有示例插件但无模板根 → PLUGIN_TEMPLATES_MISSING', async () => {
  const root = makeTempRoot('eagle-plugin-no-templates-');
  fs.mkdirSync(path.join(root, 'plugins/example-service-plugin'), { recursive: true });
  const { code, output } = await runServerExpectExit({
    EAGLE_PLUGINS_ROOT: path.join(root, 'plugins'),
    EAGLE_USER_DATA_DIR: makeTempRoot('eagle-plugin-no-templates-userdata-'),
  });
  assert(code !== 'TIMEOUT' && code !== 0, `expected non-zero exit, got ${code}:\n${output}`);
  assert(output.includes('PLUGIN_TEMPLATES_MISSING'), `missing explicit error code:\n${output}`);
});

const cleanCwd = makeTempRoot('eagle-plugin-clean-cwd-');
let server = null;
try {
  // 干净 cwd（仓库外）+ 显式不设 EAGLE_PLUGINS_ROOT：验证默认根本身不依赖检出目录深度。
  // env 里给 undefined 的键会被 child_process 跳过，等效于从子进程环境中删除该变量。
  server = await startServer({ cwd: cleanCwd, env: { EAGLE_PLUGINS_ROOT: undefined } });

  await check('干净 cwd 启动：默认插件根解析到仓库内 plugins/，无工作区外依赖', async () => {
    const line = server.output().split(/\r?\n/).find((entry) => entry.includes('Eagle Reverse plugins root:'));
    assert(line, `server did not report its plugins root:\n${server.output()}`);
    const reported = line.split('Eagle Reverse plugins root:')[1].trim().replace(/\\/g, '/');
    const expected = repoPluginsRoot.replace(/\\/g, '/');
    assert(reported === expected, `plugins root is ${reported}, expected the in-repo ${expected}`);
    // 落点必须在仓库内：不能是工作区兄弟目录、H:/dev/plugins、H:/resources 之类的开发机路径。
    const relative = path.relative(projectRoot, path.resolve(reported));
    assert(!relative.startsWith('..') && !path.isAbsolute(relative), `plugins root escapes the repo: ${reported}`);
    for (const forbidden of ['H:/dev/plugins', 'H:/resources', 'dev/plugins']) {
      assert(!reported.includes(forbidden), `plugins root still depends on a dev-machine path: ${reported}`);
    }
  });

  const api = async (method, urlPath, body) => {
    const res = await fetch(`${server.apiBase}${urlPath}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch (err) {
      json = null;
    }
    return { status: res.status, json, text };
  };

  await check('对外 URL 不变：示例插件与模板仍从原路径供出', async () => {
    const pluginPage = await api('GET', '/plugins/eagle-reverse-example-service/index.html');
    assert(pluginPage.status === 200, `example plugin page HTTP ${pluginPage.status}`);
    assert(pluginPage.text.includes('/plugin-shim.js'), 'served example plugin page lost the SDK shim');

    for (const name of ['window', 'service', 'preview', 'inspector']) {
      const page = await api('GET', `/plugin-templates/${name}/index.html`);
      assert(page.status === 200, `/plugin-templates/${name}/index.html HTTP ${page.status}`);
    }

    const list = await api('GET', '/api/plugins');
    const ids = list.json.data.map((entry) => entry.id);
    assert(
      list.json.data.some((entry) => entry.url === '/plugins/eagle-reverse-example-service/index.html'),
      `example plugin url changed: ${JSON.stringify(ids)}`
    );
    for (const name of ['window', 'service', 'preview', 'inspector']) {
      const entry = list.json.data.find((item) => item.id === `eagle-reverse-template-${name}`);
      assert(entry, `template plugin ${name} disappeared from /api/plugins (ids=${ids.join(',')})`);
      assert(entry.url === `/plugin-templates/${name}/index.html`, `template url changed: ${entry.url}`);
    }

    const opened = await api('POST', '/api/plugins/open', { id: 'eagle-reverse-example-service' });
    assert(opened.status === 200 && opened.json.status === 'success', `open failed: ${opened.text}`);
    assert(
      opened.json.data.url === `http://localhost:${server.apiPort}/plugins/eagle-reverse-example-service/index.html`,
      `open url changed: ${opened.json.data.url}`
    );
  });

  await check('调用失败：未知插件 id 明确报错（不返回空对象装成功）', async () => {
    const detail = await api('GET', '/api/plugins/eagle-reverse-does-not-exist');
    assert(detail.status === 404, `expected 404 for unknown plugin detail, got ${detail.status}: ${detail.text}`);
    assert(detail.json && detail.json.status === 'error', `expected an error envelope, got ${detail.text}`);

    const opened = await api('POST', '/api/plugins/open', { id: 'eagle-reverse-does-not-exist' });
    assert(opened.status === 404, `expected 404 for unknown plugin open, got ${opened.status}: ${opened.text}`);
    assert(opened.json && opened.json.status === 'error', `expected an error envelope, got ${opened.text}`);

    // 失败调用不得污染插件清单。
    const list = await api('GET', '/api/plugins');
    assert(
      list.json.data.some((entry) => entry.id === 'eagle-reverse-example-service'),
      'plugin list corrupted after failed calls'
    );
  });

  await check('electron 资源缺失 → 非零退出 + SERVICE_PLUGIN_LOAD_FAILED（不静默降级）', async () => {
    const missing = path.join(makeTempRoot('eagle-plugin-electron-absent-'), 'plugins');
    const { code, output } = await runElectron({
      env: { EAGLE_PLUGINS_ROOT: missing, EAGLE_API_URL: server.apiBase },
    });
    assert(code !== 'TIMEOUT', `electron kept running with a missing plugins root:\n${output}`);
    assert(code !== 0, `electron exited 0 despite a missing plugins root:\n${output}`);
    assert(output.includes('SERVICE_PLUGIN_LOAD_FAILED'), `electron did not report the load failure:\n${output}`);
    assert(output.includes('PLUGIN_RESOURCE_MISSING'), `electron lost the explicit error code:\n${output}`);
    // 未降级：坏根时绝不能走到开插件窗那一步。
    assert(!output.includes('PLUGIN_WINDOW_OK'), `electron opened the plugin window anyway:\n${output}`);
  });

  await check('electron 对照（好根）→ exit 0，插件真被发现并加载（证明上一条有区分度）', async () => {
    const { code, output } = await runElectron({
      env: { EAGLE_PLUGINS_ROOT: repoPluginsRoot, EAGLE_API_URL: server.apiBase },
    });
    assert(code === 0, `electron exited ${code} with the in-repo plugins root:\n${output}`);
    assert(
      output.includes('Loaded service plugin:') && output.includes('eagle-reverse-example-service'),
      `electron did not load the service plugin from the in-repo root:\n${output}`
    );
    assert(output.includes('PLUGIN_WINDOW_OK'), `electron plugin window did not report eagle:\n${output}`);
  });
} finally {
  if (server) await server.stop();
}

for (const dir of tempDirs) {
  try {
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  } catch (err) {
    // Windows 文件锁：清理失败不影响测试结果。
  }
}

const failed = results.filter((entry) => !entry.ok);
for (const entry of results) {
  console.log(`${entry.ok ? 'PASS' : 'FAIL'} ${entry.name}${entry.error ? ` :: ${entry.error}` : ''}`);
}
if (failed.length > 0) {
  console.error(`plugin resource missing failed: ${failed.length}/${results.length}`);
  process.exit(1);
}
console.log(`plugin resource missing passed: ${results.length}/${results.length}`);
