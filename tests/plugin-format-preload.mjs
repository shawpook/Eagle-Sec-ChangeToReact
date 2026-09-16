/**
 * M6-3 —— 格式插件 preload 的原生根修正验证。
 *
 * 被修的缺陷：三处调用点原各自内联
 * ```
 * req('url').pathToFileURL(req('path').join((window as any).appRoot.path, '/app/js/plugin/api-format-extension.js')).href
 * ```
 * `appRoot.path` 恒为 URL 空间路径 `/src`，`bareModules['url']` 无条件指向
 * `browserRuntime.urlModule`（其 `pathToFileURL` → `localAssetUrl` → `new URL(p, window.location.origin)`），
 * 而 Electron 渲染层以 HTTP 加载（`electron/main.cjs:8,852`）⇒ 该 preload 恒为
 * `http://…/src/app/js/plugin/api-format-extension.js`，**从未被加载**。
 *
 * 本单元测试的判据与局限（**明写**）：
 *  - 判据一（单一解析点）是**源码文本**判据：读磁盘上的真实文件，断言三处调用点都经由同一个
 *    具名导入标识符，且该标识符在 React 子树内只有一处定义；同时断言旧惯用式的特征串绝迹。
 *    它证明的是「接线集中」，不是「运行期只走一条路」——后者由判据三的**穷举不变式**覆盖。
 *  - 判据二/三在 `vm` 中**真实装载并执行**解析函数与 `electron/preload.cjs`（桩掉 `electron` 桥
 *    与 `window`/`document`），断言返回值的**形态**。
 *  - **局限**：本测试不启动 Electron。webview tag 是否启用、preload 是否真的被 guest 加载，
 *    由 `outputs/` 中的实测探针（Electron 22.3.7）覆盖，本文件的
 *    `isWebviewTagEnabled` 只验证「探测判据」本身，不声称活体结论。
 *
 * 运行：node tests/plugin-format-preload.mjs
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';
import ts from 'typescript';

const PLUGIN_FORMAT_PRELOAD = 'src/app/react/core/pluginFormatPreload.ts';
const ELECTRON_PRELOAD = 'electron/preload.cjs';

/** 三处调用点（M6-3 唯一允许改动 preload 接线的地方）。 */
const CALL_SITES = [
  'src/app/react/components/detail/DetailViewer.tsx',
  'src/app/react/components/inspector/Inspector.tsx',
  'src/app/react/preview-window/shell.tsx',
];

const RESOLVER_NAME = 'resolveFormatExtensionPreloadFromHost';
const MODULE_SPECIFIER = 'core/pluginFormatPreload';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

function transpile(p) {
  const { outputText, diagnostics } = ts.transpileModule(read(p), {
    fileName: p,
    reportDiagnostics: true,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  assert.equal(diagnostics.length, 0, `${p} 转译应无诊断`);
  return outputText;
}

/* ================= 判据一：三处调用点经由同一解析点（源码文本） ================= */

/**
 * 调用点判据（**可对任意文本求值**，故负向自证可用被篡改的样本把它跑红）。
 *
 * 判据逐条：
 *  1. 文件中出现 `resolveFormatExtensionPreloadFromHost` 的**调用**（`NAME(` 形式）；
 *  2. 从 `core/pluginFormatPreload` 具名导入该标识符；
 *  3. 旧惯用式特征串绝迹：`pathToFileURL`、`appRoot.path` 与 api-format-extension 的拼接；
 *  4. 该文件内不再出现 `api-format-extension.js` 字面量（资源定位的唯一来源已移出调用点）。
 */
function evaluateCallSite(p, text) {
  const problems = [];
  if (!new RegExp(`${RESOLVER_NAME}\\s*\\(`).test(text)) {
    problems.push(`${p}: 未调用 ${RESOLVER_NAME}(`);
  }
  if (!new RegExp(`import\\s*\\{[^}]*\\b${RESOLVER_NAME}\\b[^}]*\\}\\s*from\\s*['"][^'"]*${MODULE_SPECIFIER}['"]`).test(text)) {
    problems.push(`${p}: 未从 ${MODULE_SPECIFIER} 具名导入 ${RESOLVER_NAME}`);
  }
  if (/pathToFileURL/.test(text)) {
    problems.push(`${p}: 仍含旧惯用式的 pathToFileURL 调用`);
  }
  if (/api-format-extension\.js/.test(text)) {
    problems.push(`${p}: 仍内联 api-format-extension.js 字面量（资源定位应唯一来源于解析模块/桌面桥）`);
  }
  return problems;
}

test('M6-3 / 单一解析点：三处调用点都经由具名导入的同一解析函数，旧惯用式绝迹', () => {
  const problems = CALL_SITES.flatMap((p) => evaluateCallSite(p, read(p)));
  assert.deepEqual(problems, [], `三处调用点应全部收敛到 ${MODULE_SPECIFIER}:\n${problems.join('\n')}`);
});

test('M6-3 / 单一解析点：解析入口在整个 React 子树只有一处定义', () => {
  // 定义点判据：`function NAME(` 形式。递归扫描整个 React 子树，若出现第二个定义点，
  // 说明「单一解析点」已被复制。
  const reactRoot = new URL('../src/app/react/', import.meta.url);
  const seen = new Set();
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = new URL(`${entry.name}${entry.isDirectory() ? '/' : ''}`, dir);
      if (entry.isDirectory()) walk(full);
      else if (/\.tsx?$/.test(entry.name)) {
        if (new RegExp(`function\\s+${RESOLVER_NAME}\\s*\\(`).test(readFileSync(full, 'utf8'))) {
          seen.add(fileURLToPath(full));
        }
      }
    }
  };
  walk(reactRoot);

  const relSeen = [...seen]
    .map((p) => path.relative(fileURLToPath(reactRoot), p).replace(/\\/g, '/'))
    .sort();
  assert.deepEqual(relSeen, ['core/pluginFormatPreload.ts'], `${RESOLVER_NAME} 应只有一处定义`);
});

/* ================= 解析函数的 vm 装载 ================= */

/**
 * 在 vm 中真实执行 `pluginFormatPreload.ts`（转译为 CJS），桩掉其唯一外部依赖
 * `./shim/environment`（只取 `markUnavailable`），并注入 `window` / `document`。
 */
function loadResolverModule({ eagleDesktop, documentStub, registered }) {
  const code = transpile(PLUGIN_FORMAT_PRELOAD);
  const module = { exports: {} };
  const warns = [];
  const sandbox = {
    module,
    exports: module.exports,
    require: (id) => {
      if (id === './shim/environment') {
        return {
          markUnavailable: (capability, reason) => {
            if (!(capability in registered)) registered[capability] = reason;
          },
        };
      }
      throw new Error(`pluginFormatPreload 不应依赖其它模块，实测 require(${id})`);
    },
    console: { warn: (...args) => warns.push(args.join(' ')), log: () => {} },
    window: { eagleDesktop },
    document: documentStub,
  };
  vm.runInNewContext(code, sandbox, { filename: PLUGIN_FORMAT_PRELOAD });
  return { api: module.exports, warns };
}

const REAL_DISK_PATH = fileURLToPath(new URL('../src/app/js/plugin/api-format-extension.js', import.meta.url));

/* ================= 判据二：Electron 态返回真实磁盘路径 ================= */

test('M6-3 / Electron 态：注入实测形态的桌面桥输入 → 返回真实磁盘 file:// 路径', () => {
  const diskPath = REAL_DISK_PATH;
  const { api } = loadResolverModule({
    eagleDesktop: {
      formatExtensionPreload: () => ({
        ok: true,
        url: pathToFileURL(diskPath).href,
        diskPath,
      }),
    },
    documentStub: { createElement: () => ({ getWebContentsId: () => 1 }) },
    registered: {},
  });

  const res = api.resolveFormatExtensionPreloadFromHost();
  assert.equal(res.ok, true, `应解析成功，实得 ${JSON.stringify(res)}`);
  assert.equal(res.diskPath, diskPath, 'diskPath 应为真实磁盘绝对路径');
  assert.ok(/^file:\/\//i.test(res.preloadUrl), `preloadUrl 应为 file:// 形态，实得 ${res.preloadUrl}`);
  assert.equal(res.preloadUrl, pathToFileURL(diskPath).href, 'file:// URL 应与 pathToFileURL 一致（含百分号编码）');
  assert.ok(path.isAbsolute(res.diskPath), 'diskPath 必须是绝对路径');
  assert.ok(!/^https?:/i.test(res.preloadUrl), 'preloadUrl 绝不能是 http(s)');
  // 判据的实质：这条路径确实指向磁盘上的真实文件（而非 URL 空间路径）。
  assert.ok(existsSync(diskPath), `目标 preload 脚本应真实存在于磁盘：${diskPath}`);
});

test('M6-3 / Electron 态：真实 electron/preload.cjs 的供给面与解析函数契约一致（端到端，纯 Node）', () => {
  const preloadAbs = fileURLToPath(new URL(`../${ELECTRON_PRELOAD}`, import.meta.url));
  const require_ = createRequire(preloadAbs);
  const code = read(ELECTRON_PRELOAD);
  let exposed = null;
  const module = { exports: {} };
  const sandbox = {
    module,
    exports: module.exports,
    require: (id) => {
      if (id === 'electron') {
        return {
          contextBridge: { exposeInMainWorld: (name, api) => { exposed = { name, api }; } },
          ipcRenderer: {},
        };
      }
      return require_(id);
    },
    // preload 是 CommonJS，`__dirname` 由宿主注入 —— 此处按真实语义给 <repo>/electron。
    __dirname: path.dirname(preloadAbs),
    process,
    window: {},
    console: { warn: () => {}, log: () => {} },
  };
  vm.runInNewContext(code, sandbox, { filename: ELECTRON_PRELOAD });

  assert.ok(exposed, 'electron/preload.cjs 应经 contextBridge 暴露桌面桥');
  assert.equal(exposed.name, 'eagleDesktop', '既有暴露名不得改变');
  assert.equal(typeof exposed.api.formatExtensionPreload, 'function', '应新增 formatExtensionPreload 供给面');

  // 交给**生产解析函数**判定：两者契约若不匹配，这里就会红。
  const { api } = loadResolverModule({
    eagleDesktop: exposed.api,
    documentStub: { createElement: () => ({ getWebContentsId: () => 1 }) },
    registered: {},
  });
  const res = api.resolveFormatExtensionPreloadFromHost();
  assert.equal(res.ok, true, `真实 preload.cjs 供给面应被解析函数接受，实得 ${JSON.stringify(res)}`);
  assert.equal(res.diskPath, REAL_DISK_PATH, '真实供给面应锚定到 <repo>/src/app/js/plugin/api-format-extension.js');
  assert.ok(res.preloadUrl.startsWith('file://'), `实得 ${res.preloadUrl}`);

  // 既有字段不得被本批改动：抽样比对若干关键成员仍在。
  for (const key of ['getAppInfo', 'onIpc', 'ipc', 'library', 'item', 'window', 'thumbnailUrl', 'openPlugin']) {
    assert.ok(key in exposed.api, `既有字段 ${key} 不得丢失`);
  }
});

/* ================= 判据三：非 Electron 态明确不可用 + 穷举不变式 ================= */

/** 解析函数**在任何输入下**都不得产出的 preload 形态（即被修的那个缺陷形态）。 */
const isHttpPreload = (res) => res.ok && /^https?:/i.test(res.preloadUrl);

/** 敌意/边界输入集：含**旧惯用式在 Electron 下的真实产物**与各类桥缺失形态。 */
const HOSTILE_INPUTS = [
  ['无桌面桥（非 Electron 态）', undefined],
  ['桌面桥为 null', null],
  ['桌面桥为空对象', {}],
  ['桥存在但无 formatExtensionPreload 字段', { ipc: {} }],
  ['字段非函数', { formatExtensionPreload: 'not-a-function' }],
  ['字段返回 null', { formatExtensionPreload: () => null }],
  ['字段返回字符串', { formatExtensionPreload: () => 'file:///x.js' }],
  ['字段抛错', { formatExtensionPreload: () => { throw new Error('bridge boom'); } }],
  ['桥判定不可用', { formatExtensionPreload: () => ({ ok: false, reason: 'preload 脚本不存在' }) }],
  [
    '**旧惯用式的真实产物**（http:// origin 拼接）',
    { formatExtensionPreload: () => ({
      ok: true,
      url: 'http://localhost:5176/src/app/js/plugin/api-format-extension.js',
      diskPath: '/src/app/js/plugin/api-format-extension.js',
    }) },
  ],
  [
    'https 变体',
    { formatExtensionPreload: () => ({
      ok: true,
      url: 'https://localhost:5176/src/app/js/plugin/api-format-extension.js',
      diskPath: '/src/app/js/plugin/api-format-extension.js',
    }) },
  ],
  ['ok:true 但 url 为空', { formatExtensionPreload: () => ({ ok: true, url: '', diskPath: REAL_DISK_PATH }) }],
  ['ok:true 但 diskPath 为空', { formatExtensionPreload: () => ({ ok: true, url: 'file:///x.js', diskPath: '' }) }],
  ['ok:true 但 diskPath 非字符串', { formatExtensionPreload: () => ({ ok: true, url: 'file:///x.js', diskPath: 42 }) }],
];

test('M6-3 / 非 Electron 态：明确返回不可用，且任何分支都不产出 http(s):// 的 preload', () => {
  for (const [label, bridge] of HOSTILE_INPUTS) {
    const { api } = loadResolverModule({
      eagleDesktop: bridge,
      documentStub: { createElement: () => ({}) },
      registered: {},
    });
    const res = api.resolveFormatExtensionPreload({ desktopBridge: bridge });
    assert.equal(res.ok, false, `[${label}] 应明确不可用，实得 ${JSON.stringify(res)}`);
    assert.equal(res.unavailable, true, `[${label}] 应带 unavailable 标记`);
    assert.equal(res.capability, api.FORMAT_EXTENSION_PRELOAD_CAPABILITY, `[${label}] 应带能力名`);
    assert.ok(typeof res.reason === 'string' && res.reason.length > 0, `[${label}] 应带非空 reason`);
    // 穷举不变式：不可用结果里不得混入任何可被当成 preload 用的字符串。
    assert.equal('preloadUrl' in res, false, `[${label}] 不可用结果不得携带 preloadUrl`);
  }
});

test('M6-3 / 不变式：解析函数在全输入域上绝不产出 http(s):// preload', () => {
  for (const [label, bridge] of HOSTILE_INPUTS) {
    const { api } = loadResolverModule({
      eagleDesktop: bridge,
      documentStub: { createElement: () => ({}) },
      registered: {},
    });
    const res = api.resolveFormatExtensionPreload({ desktopBridge: bridge });
    assert.ok(!isHttpPreload(res), `[${label}] 产出了 http(s) preload：${JSON.stringify(res)}`);
  }
});

test('M6-3 / 非 Electron 态：宿主入口登记能力缺口（不静默）', () => {
  const registered = {};
  const { api, warns } = loadResolverModule({
    eagleDesktop: undefined,
    documentStub: { createElement: () => ({}) },
    registered,
  });
  const res = api.resolveFormatExtensionPreloadFromHost();
  assert.equal(res.ok, false);
  assert.ok(
    api.FORMAT_EXTENSION_PRELOAD_CAPABILITY in registered,
    '非 Electron 态必须登记能力缺口，不得静默当成成功',
  );
  assert.ok(warns.length >= 1, '应至少告警一次');
});

test('M6-3 / 宿主入口：preload 可用但 webview tag 未启用时，登记宿主缺口（实测缺口）', () => {
  const registered = {};
  const { api } = loadResolverModule({
    eagleDesktop: {
      formatExtensionPreload: () => ({ ok: true, url: pathToFileURL(REAL_DISK_PATH).href, diskPath: REAL_DISK_PATH }),
    },
    // 探针②实测：webviewTag 未启用时 createElement('webview') 返回 HTMLElement（无 getWebContentsId）。
    documentStub: { createElement: () => ({ constructor: { name: 'HTMLElement' } }) },
    registered,
  });
  const res = api.resolveFormatExtensionPreloadFromHost();
  assert.equal(res.ok, true, 'preload 路径本身仍应解析成功');
  assert.ok(
    api.WEBVIEW_TAG_CAPABILITY in registered,
    'preload 可解析 ≠ 插件可用：webview tag 未启用必须另行登记',
  );
});

test('M6-3 / webview tag 探测判据：以 getWebContentsId 是否存在为准（与探针②实测同口径）', () => {
  const off = loadResolverModule({ eagleDesktop: {}, documentStub: { createElement: () => ({}) }, registered: {} });
  assert.equal(off.api.isWebviewTagEnabled({ createElement: () => ({}) }), false, '无该方法应判为未启用');
  const on = loadResolverModule({ eagleDesktop: {}, documentStub: { createElement: () => ({}) }, registered: {} });
  assert.equal(on.api.isWebviewTagEnabled({ createElement: () => ({ getWebContentsId: () => 7 }) }), true, '有该方法应判为已启用');
});

/* ================= 判据四：负向自证（判据本身不是恒真） ================= */

test('M6-3 / 负向自证：把某处调用点改回旧惯用式，判据必须变红', () => {
  for (const p of CALL_SITES) {
    const real = read(p);
    assert.deepEqual(evaluateCallSite(p, real), [], `${p} 真实源码应通过`);

    // 篡改样本①：整段换回旧惯用式（模拟"回退这次修复"）。
    const legacy = real.replace(
      new RegExp(`const preload = ${RESOLVER_NAME}\\(\\);`),
      "const preloadPath = req('url').pathToFileURL(req('path').join((window as any).appRoot.path, '/app/js/plugin/api-format-extension.js')).href;",
    );
    assert.notEqual(legacy, real, `${p} 篡改样本应实际改变了文本（否则本负向自证是空洞的）`);
    const problems = evaluateCallSite(p, legacy);
    assert.ok(problems.length > 0, `${p} 改回旧惯用式后判据必须报错，实得 0 条`);
  }
});

test('M6-3 / 负向自证：让调用点绕过解析函数（改走内联新路径）也必须变红', () => {
  const p = CALL_SITES[0];
  const real = read(p);
  const bypass = real.replace(new RegExp(RESOLVER_NAME), 'someOtherResolver');
  assert.notEqual(bypass, real, '篡改样本应实际改变了文本');
  assert.ok(evaluateCallSite(p, bypass).length > 0, '绕过具名解析函数后判据必须报错');
});

test('M6-3 / 负向自证：解析函数若退回旧惯用式产物，不变式必须变红', () => {
  // 逐字复刻被修的旧惯用式在 Electron 态下的产物（实测：http://<origin>/src/app/js/plugin/api-format-extension.js）。
  const legacyResolve = (origin) => ({
    ok: true,
    preloadUrl: new URL('/src/app/js/plugin/api-format-extension.js', origin).href,
    diskPath: '/src/app/js/plugin/api-format-extension.js',
  });
  const legacy = legacyResolve('http://localhost:5176');
  assert.ok(isHttpPreload(legacy), '旧惯用式产物应被判为 http preload（不变式能识别缺陷形态）');

  // 真解析函数必须拒收同一产物 —— 把它当作桌面桥返回值注入。
  const { api } = loadResolverModule({
    eagleDesktop: {
      formatExtensionPreload: () => ({ ok: true, url: legacy.preloadUrl, diskPath: legacy.diskPath }),
    },
    documentStub: { createElement: () => ({}) },
    registered: {},
  });
  const res = api.resolveFormatExtensionPreloadFromHost();
  assert.equal(res.ok, false, '旧惯用式的 http 产物必须被硬闸门拒收');
  assert.ok(!isHttpPreload(res), '拒收后不得残留 http preload');
});

/* ================= 判据五：资源定位的唯一来源 ================= */

test('M6-3 / 唯一来源：api-format-extension.js 的磁盘定位只出现在 electron/preload.cjs', () => {
  const preload = read(ELECTRON_PRELOAD);
  assert.ok(/api-format-extension\.js/.test(preload), 'electron/preload.cjs 应持有该资源的唯一定位');
  assert.ok(
    /path\.join\(\s*__dirname,\s*'\.\.',\s*'src',\s*'app',\s*'js',\s*'plugin',\s*'api-format-extension\.js'/.test(preload),
    '定位应以 <repo>/electron 的 __dirname 为锚点（与 main.cjs:1769 的 plugins 根同族）',
  );
  // 锚点判据只看**赋值语句本身**（注释里出现 process.cwd() 是在说明「不采用」，不算违规）。
  const assignBlock = preload.match(/const formatExtensionPreloadPath = [\s\S]*?;/)?.[0] ?? '';
  assert.ok(assignBlock, '应存在 formatExtensionPreloadPath 的赋值语句');
  assert.ok(/__dirname/.test(assignBlock), `锚点应为 __dirname，实得：${assignBlock.trim()}`);
  assert.ok(!/process\.cwd\(\)/.test(assignBlock), `锚点不得为 process.cwd()，实得：${assignBlock.trim()}`);
  assert.ok(!/'\/src'|"\/src"/.test(assignBlock), '不得把 /src 当磁盘根');
});
