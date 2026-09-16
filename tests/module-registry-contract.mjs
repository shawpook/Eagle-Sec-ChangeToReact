/**
 * M2-4 / M7-1 契约测试：`moduleRegistry.ts` 撤销类型豁免 + 隐式截获契约化。
 *
 * 覆盖：
 *  1. 静态规范守卫：首行 @ts-nocheck 已撤销、零新增 any / @ts-ignore / @ts-expect-error；
 *  2. 穷尽式表驱动等价性：登记表中 34 项条目（33 模块路径 + 1 通用 json）与原源码中
 *     全部 endsWith 分支逐项完全一致，少一条即失败；
 *  3. 行为逐项一致性：对全部 34 个分支，重构后的表驱动解析与原契约返回值形态逐项同构；
 *  4. 可观测性：每次截获均被记录到 `getInterceptedRequests()`，可查询 category/reason/pattern；
 *  5. 封堵绕过路径：对 `/app/js/plugin` 等目录模块，带 `/index.js` 与 `/index` 后缀
 *     均归一化命中拦截表返回替身，杜绝绕过落到磁盘真实执行（原实现含 Angular 依赖）；
 *  6. 解桩保护：flipImage/rotateImage 仍保留真实 loadJsModule 加载，不回退为空桩。
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';
import { NOCHECK_LEDGER, scanTypeDirectives, auditNoCheck } from './typecheck.mjs';

const { posix } = path;
const REGISTRY_FILE = 'src/app/react/core/shim/moduleRegistry.ts';
// 必须用 fileURLToPath：本仓路径含空格与中文，`new URL(...).pathname` 不做百分号解码。
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * 实扫 `src/` 下头部带**有效**整文件 `@ts-nocheck` 的文件，产出真实记录。
 *
 * 用途：本节断言「台账与源码逐项一致」时，**期望值由源码实扫得出，而不是写死一个数字**。
 * 原先这里写的是 `assert.equal(NOCHECK_LEDGER.length, 5, '待撤销清单数量必须精确为 5')`——
 * 那会让本测试随**任何其他批次**的 shim 类型化进度无谓变红（M2-7 把它降到 2 时就撞上了）。
 * 本测试守的是「moduleRegistry.ts 已从台账解绑」，不是「全仓恰好剩 N 个文件」。
 * 路径经原文还原（`.pathname` 会把空格与非 ASCII 目录名百分号编码）。
 */
function scanSrcNoCheckRecords() {
  const found = [];
  (function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      if (!/\.(?:[cm]?js|tsx?)$/.test(entry.name)) continue;
      const rel = path.relative(projectRoot, full).split(path.sep).join('/');
      // scanTypeDirectives 的返回值**不含 file**，由调用方补（口径同 frontend-gates-unit.mjs）。
      found.push(...scanTypeDirectives(fs.readFileSync(full, 'utf8'), rel).map((record) => ({ ...record, file: rel })));
    }
  })(path.join(projectRoot, 'src'));
  return found;
}

function readSource(rel) {
  return fs.readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
}

/** 本测试允许加载的真实 shim 模块子集 */
const ALLOWED_MODULES = new Set([
  'src/app/react/core/ipcWriteState.ts',
  'src/app/react/core/shim/environment.ts',
  'src/app/react/core/shim/browserRuntime.ts',
  'src/app/react/core/shim/desktopCapability.ts',
  'src/app/react/core/shim/ipcBus.ts',
  'src/app/react/core/shim/settingsI18n.ts',
  'src/app/react/core/shim/demoSeed.ts',
  'src/app/react/core/shim/moduleRegistry.ts',
]);

function createIsolatedLoader(contextOverrides = {}) {
  const cache = new Map();

  function resolve(fromRel, spec) {
    assert.ok(spec.startsWith('.'), `外部依赖未白名单隔离：${spec}（来自 ${fromRel}）`);
    const base = posix.join(posix.dirname(fromRel), spec);
    for (const candidate of [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`]) {
      if (ALLOWED_MODULES.has(candidate)) return candidate;
    }
    assert.fail(`模块不在本测试白名单：${base}（来自 ${fromRel}）`);
  }

  const localStorageData = new Map();
  const mockLocalStorage = {
    getItem: (k) => (localStorageData.has(String(k)) ? localStorageData.get(String(k)) : null),
    setItem: (k, v) => { localStorageData.set(String(k), String(v)); },
    removeItem: (k) => { localStorageData.delete(String(k)); },
    clear: () => localStorageData.clear(),
  };

  class MockXMLHttpRequest {
    constructor() {
      this.status = 0;
      this.responseText = '';
      this.url = '';
    }
    open(method, url) {
      this.url = String(url || '');
    }
    send() {
      try {
        const filePath = path.resolve(import.meta.dirname, '..', this.url.replace(/^\//, ''));
        if (fs.existsSync(filePath)) {
          this.status = 200;
          this.responseText = fs.readFileSync(filePath, 'utf8');
        } else {
          this.status = 404;
          this.responseText = '';
        }
      } catch {
        this.status = 500;
      }
    }
  }

  const appRoot = { path: '/src', toString: () => '/src' };
  const mockWindow = {
    location: { origin: 'http://localhost:5173', pathname: '/src/app/index.html' },
    localStorage: mockLocalStorage,
    process: { platform: 'win32', env: {} },
    Buffer: { alloc: () => new Uint8Array(), from: () => new Uint8Array() },
    XMLHttpRequest: MockXMLHttpRequest,
    appRoot,
    ...contextOverrides.window,
  };

  const sandbox = {
    window: mockWindow,
    document: {},
    console,
    process: mockWindow.process,
    XMLHttpRequest: MockXMLHttpRequest,
    appRoot,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    localStorage: mockLocalStorage,
    ...contextOverrides,
  };

  function load(rel) {
    if (cache.has(rel)) return cache.get(rel);
    const code = readSource(rel);
    const { outputText, diagnostics } = ts.transpileModule(code, {
      fileName: rel,
      reportDiagnostics: true,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    });
    assert.equal(diagnostics.length, 0, `${rel} 转译错误`);
    const module = { exports: {} };
    cache.set(rel, module.exports);
    vm.runInNewContext(outputText, {
      ...sandbox,
      module,
      exports: module.exports,
      require: (spec) => load(resolve(rel, spec)),
    }, { filename: rel });
    return module.exports;
  }

  return { load, sandbox };
}

// =============================================================================
// 1. 静态规范与类型豁免撤销守卫
// =============================================================================

test('静态守卫：moduleRegistry.ts 已撤销 @ts-nocheck，且 NOCHECK_LEDGER 同步下调 1', () => {
  const source = readSource(REGISTRY_FILE);
  const firstLine = source.split('\n')[0].trim();
  assert.doesNotMatch(firstLine, /^\/\/\s*@ts-nocheck/, 'moduleRegistry.ts 首行不得再有 @ts-nocheck');

  // 使用语法树扫描指令，排除注释说明文字中的伪匹配
  const directives = scanTypeDirectives(source, REGISTRY_FILE);
  const hasEffectiveNocheck = directives.some((d) => d.kind === 'nocheck' && d.effective);
  assert.equal(hasEffectiveNocheck, false, '不得存在有效的整文件 @ts-nocheck');
  const hasIgnore = directives.some((d) => d.kind === 'ignore' || d.kind === 'expect-error');
  assert.equal(hasIgnore, false, '不得新增 @ts-ignore 或 @ts-expect-error');

  // 台账中不再有 moduleRegistry.ts
  const hasInLedger = NOCHECK_LEDGER.some((entry) => entry.file === REGISTRY_FILE);
  assert.equal(hasInLedger, false, `${REGISTRY_FILE} 必须已从 NOCHECK_LEDGER 移除`);

  // 台账与**源码实扫**逐项对账（而非写死数字）：台账多一行、少一行，或源码多一个、少一个
  // 整文件 @ts-nocheck，都会让 unlisted / stale 至少一侧非空而变红。
  const audit = auditNoCheck(scanSrcNoCheckRecords());
  assert.deepEqual(audit.unlisted, [], '源码里的整文件 @ts-nocheck 必须都已登记进台账');
  assert.deepEqual(audit.stale, [], '台账条目对应的文件必须仍带整文件 @ts-nocheck（否则该条目已失效）');
  assert.deepEqual(
    audit.files,
    NOCHECK_LEDGER.map((entry) => entry.file).sort(),
    '台账集合必须与源码实扫集合逐一相等',
  );
});

// =============================================================================
// 2. 穷尽式表驱动对照测试（数量与条目严格等价）
// =============================================================================

const EXPECTED_34_PATTERNS = [
  '/my_modules/electron-settings',
  '/my_modules/url',
  '/my_modules/json-rest-light',
  '/app/js/api-server-v2',
  '/app/js/plugin',
  '/app/js/plugins/eagle-note-plugin',
  '/my_modules/n-readlines',
  '/my_modules/appdata-path',
  '/my_modules/junk',
  '/my_modules/is-hidden-file',
  '/my_modules/file-icon',
  '/my_modules/is-directory',
  '/my_modules/access',
  '/app/js/utils/remainingFilenameLength.js',
  '/app/js/utils/getBestURL.js',
  '/app/js/utils/is-accelerator.js',
  '/app/js/utils/unorm.js',
  '/app/js/utils/flipImage.js',
  '/app/js/utils/rotateImage.js',
  '/my_modules/tiny-pinyin',
  '/my_modules/pinyinlite',
  '/my_modules/cartesian-product',
  '/my_modules/sanitize-filename',
  '/my_modules/chinese_convert',
  '/my_modules/get-drive-type',
  '/my_modules/curl-request',
  '/my_modules/downloadFile',
  '/my_modules/vtt2srt',
  '/my_modules/bplist-parse',
  '/my_modules/heif/native',
  '/my_modules/image-cropper',
  '/my_modules/get-associated-application',
  '/my_modules/image-size',
  '.json',
];

test('表驱动契约：INTERCEPT_TABLE 条目数严格等于原分支数 34 项，少一条即失败', () => {
  const loader = createIsolatedLoader();
  const reg = loader.load(REGISTRY_FILE);
  assert.ok(Array.isArray(reg.INTERCEPT_TABLE), '必须导出只读表 INTERCEPT_TABLE');
  assert.equal(
    reg.INTERCEPT_TABLE.length,
    34,
    `截获表登记数 (${reg.INTERCEPT_TABLE.length}) 必须严格等于原源码分支数 (34)`
  );

  const tablePatterns = JSON.parse(JSON.stringify(reg.INTERCEPT_TABLE.map((e) => e.pattern)));
  assert.deepEqual(tablePatterns, EXPECTED_34_PATTERNS, '表中的 34 项模式必须与原分支模式完全一致');

  // 每条都必须具备非空的元数据说明
  for (const entry of reg.INTERCEPT_TABLE) {
    assert.ok(typeof entry.pattern === 'string' && entry.pattern.length > 0, `pattern 无效: ${entry.pattern}`);
    assert.ok(typeof entry.category === 'string' && entry.category.length > 0, `category 无效: ${entry.pattern}`);
    assert.ok(typeof entry.reason === 'string' && entry.reason.length > 0, `reason 无效: ${entry.pattern}`);
    assert.ok(typeof entry.resolve === 'function', `resolve 无效: ${entry.pattern}`);
  }
});

// =============================================================================
// 3. 逐项行为等价性测试（全部 34 个分支）
// =============================================================================

test('行为逐项等价性：重构前后对全部 34 个分支返回形态逐项一致', () => {
  const loader = createIsolatedLoader();
  const reg = loader.load(REGISTRY_FILE);
  reg.populateBareModules();
  reg.resetInterceptedRequests();

  // 1. electron-settings
  const s1 = reg.requireModule('/src/my_modules/electron-settings');
  assert.ok(s1 && typeof s1.getSync === 'function', 'electron-settings 门面应具备 getSync');

  // 2. url
  const s2 = reg.requireModule('/src/my_modules/url');
  assert.ok(s2 && typeof s2.pathToFileURL === 'function' && typeof s2.fileURLToPath === 'function', 'url 门面应具备 pathToFileURL/fileURLToPath');

  // 3. json-rest-light
  const s3 = reg.requireModule('/src/my_modules/json-rest-light');
  assert.ok(s3 && typeof s3.JsonRestServer === 'function', 'json-rest-light 应导出 JsonRestServer');

  // 4. api-server-v2
  const s4 = reg.requireModule('/src/app/js/api-server-v2');
  assert.ok(s4 && typeof s4.initAPIServerV2 === 'function', 'api-server-v2 应有 initAPIServerV2');

  // 5. plugin
  const s5 = reg.requireModule('/src/app/js/plugin');
  assert.ok(s5 && typeof s5.init === 'function' && Array.isArray(s5.plugins), 'plugin 应返回 pluginModule 替身');

  // 6. eagle-note-plugin
  const s6 = reg.requireModule('/src/app/js/plugins/eagle-note-plugin');
  assert.deepEqual(Object.keys(s6), [], 'eagle-note-plugin 应返回空对象');

  // 7. n-readlines
  const s7 = reg.requireModule('/src/my_modules/n-readlines');
  assert.ok(typeof s7 === 'function', 'n-readlines 应为行读取器');

  // 8. appdata-path
  const s8 = reg.requireModule('/src/my_modules/appdata-path');
  assert.equal(typeof s8, 'function');
  assert.equal(s8(), '/mock-user-data');

  // 9. junk
  const s9 = reg.requireModule('/src/my_modules/junk');
  assert.ok(s9 && typeof s9.is === 'function' && typeof s9.not === 'function', 'junk 走真实加载应导出 is/not');

  // 10. is-hidden-file
  const s10 = reg.requireModule('/src/my_modules/is-hidden-file');
  assert.equal(s10.check('file.txt'), false);

  // 11. file-icon
  const s11 = reg.requireModule('/src/my_modules/file-icon');
  assert.equal(typeof s11.getFileIcon, 'function');
  assert.equal(s11.getFileIconSync('x'), null);

  // 12. is-directory
  const s12 = reg.requireModule('/src/my_modules/is-directory');
  assert.equal(typeof s12.check, 'function');
  assert.equal(typeof s12.checkSync, 'function');
  assert.equal(s12.check('dir'), false);

  // 13. access
  const s13 = reg.requireModule('/src/my_modules/access');
  assert.equal(s13.checkALCs(), true);
  assert.equal(s13.checkAccess(), true);
  assert.equal(s13.checkACL(), true);

  // 14. remainingFilenameLength.js
  const s14 = reg.requireModule('/src/app/js/utils/remainingFilenameLength.js');
  assert.equal(typeof s14, 'function');
  assert.equal(s14(), 240);

  // 15. getBestURL.js
  const s15 = reg.requireModule('/src/app/js/utils/getBestURL.js');
  assert.equal(typeof s15, 'function');
  assert.equal(s15(), '');

  // 16. is-accelerator.js
  const s16 = reg.requireModule('/src/app/js/utils/is-accelerator.js');
  assert.equal(typeof s16, 'function');
  assert.equal(s16(), true);

  // 17. unorm.js
  const s17 = reg.requireModule('/src/app/js/utils/unorm.js');
  assert.equal(s17.nfc('abc'), 'abc');
  assert.equal(s17.nfd('abc'), 'abc');

  // 18. flipImage.js (F06 解桩：loadJsModule 真实加载)
  const s18 = reg.requireModule('/src/app/js/utils/flipImage.js');
  assert.equal(typeof s18, 'function', 'flipImage 必须是函数');
  assert.ok(s18.length >= 2, 'flipImage 元数必须 >= 2（真实实现）');

  // 19. rotateImage.js (F06 解桩：loadJsModule 真实加载)
  const s19 = reg.requireModule('/src/app/js/utils/rotateImage.js');
  assert.equal(typeof s19, 'function', 'rotateImage 必须是函数');
  assert.ok(s19.length >= 2, 'rotateImage 元数必须 >= 2（真实实现）');

  // 20-24. 拼音/简繁族
  assert.equal(reg.requireModule('/src/my_modules/tiny-pinyin'), reg.bareModules['tiny-pinyin']);
  assert.equal(reg.requireModule('/src/my_modules/pinyinlite'), reg.bareModules['pinyinlite']);
  assert.equal(reg.requireModule('/src/my_modules/cartesian-product'), reg.bareModules['cartesian-product']);
  assert.equal(reg.requireModule('/src/my_modules/sanitize-filename'), reg.bareModules['sanitize-filename']);
  assert.equal(reg.requireModule('/src/my_modules/chinese_convert'), reg.bareModules['chinese_convert']);

  // 25. get-drive-type
  const s25 = reg.requireModule('/src/my_modules/get-drive-type');
  assert.equal(s25(), 'local');

  // 26. curl-request
  const s26 = reg.requireModule('/src/my_modules/curl-request');
  assert.equal(typeof s26.get, 'function');
  assert.equal(typeof s26.post, 'function');

  // 27. downloadFile
  const s27 = reg.requireModule('/src/my_modules/downloadFile');
  assert.equal(typeof s27.download, 'function');

  // 28. vtt2srt
  const s28 = reg.requireModule('/src/my_modules/vtt2srt');
  assert.equal(typeof s28, 'function');

  // 29. bplist-parse
  const s29 = reg.requireModule('/src/my_modules/bplist-parse');
  assert.equal(s29(), '');

  // 30. heif/native
  const s30 = reg.requireModule('/src/my_modules/heif/native');
  assert.deepEqual(Object.keys(s30), []);

  // 31. image-cropper
  const s31 = reg.requireModule('/src/my_modules/image-cropper');
  assert.equal(typeof s31, 'function');

  // 32. get-associated-application
  const s32 = reg.requireModule('/src/my_modules/get-associated-application');
  assert.equal(typeof s32, 'function');

  // 33. image-size
  const s33 = reg.requireModule('/src/my_modules/image-size');
  assert.equal(s33(), null);

  // 34. .json
  const s34 = reg.requireModule('/src/nonexistent-fixture.json');
  assert.deepEqual(Object.keys(s34), [], '缺失的 JSON 返回空对象');
});

// =============================================================================
// 4. 可观测性与记录查询断言
// =============================================================================

test('可观测性契约：被截获请求记录结构化日志，不抛错且可通过 getInterceptedRequests 查询', () => {
  const loader = createIsolatedLoader();
  const reg = loader.load(REGISTRY_FILE);
  reg.resetInterceptedRequests();
  assert.equal(reg.getInterceptedRequests().length, 0);

  reg.requireModule('/src/app/js/plugin');
  reg.requireModule('/src/my_modules/access');

  const records = reg.getInterceptedRequests();
  assert.equal(records.length, 2);
  assert.equal(records[0].request, '/src/app/js/plugin');
  assert.equal(records[0].pattern, '/app/js/plugin');
  assert.equal(records[0].category, 'stub-plugin');
  assert.match(records[0].reason, /插件内核替身/);
  assert.ok(records[0].timestamp > 0);

  assert.equal(records[1].pattern, '/my_modules/access');
  assert.equal(records[1].category, 'stub-security');

  reg.resetInterceptedRequests();
  assert.equal(reg.getInterceptedRequests().length, 0);
});

// =============================================================================
// 5. 封堵绕过路径（杜绝 /index.js 与 /index 穿透）
// =============================================================================

test('堵住绕过路径：/index.js 与 /index 写法均命中登记表，杜绝穿透落到磁盘真实执行', () => {
  const loader = createIsolatedLoader();
  const reg = loader.load(REGISTRY_FILE);
  reg.resetInterceptedRequests();

  // (a) /app/js/plugin 目录模块的三种写法全部命中同一替身
  const v1 = reg.requireModule('/src/app/js/plugin');
  const v2 = reg.requireModule('/src/app/js/plugin/index.js');
  const v3 = reg.requireModule('/src/app/js/plugin/index');

  assert.equal(v1, v2, '/index.js 后缀必须命中同一替身，不得绕过');
  assert.equal(v1, v3, '/index 后缀必须命中同一替身，不得绕过');

  const logs = reg.getInterceptedRequests();
  assert.equal(logs.length, 3);
  assert.equal(logs[0].pattern, '/app/js/plugin');
  assert.equal(logs[1].pattern, '/app/js/plugin');
  assert.equal(logs[2].pattern, '/app/js/plugin');

  // (b) api-server-v2 亦同等封堵
  const a1 = reg.requireModule('/src/app/js/api-server-v2');
  const a2 = reg.requireModule('/src/app/js/api-server-v2/index.js');
  assert.equal(typeof a1.initAPIServerV2, 'function');
  assert.equal(typeof a2.initAPIServerV2, 'function');
});

// =============================================================================
// 6. 特殊入口与未截获请求
// =============================================================================

test('顶层特例与未截获回落契约不变', () => {
  const loader = createIsolatedLoader();
  const reg = loader.load(REGISTRY_FILE);

  // app-root-path
  const root = reg.requireModule('app-root-path');
  assert.equal(root.path, '/src');

  // i18n
  const i18n1 = reg.requireModule('/src/i18n');
  const i18n2 = reg.requireModule('/src/i18n/index.js');
  assert.equal(typeof i18n1, 'function', 'MockI18n 应当是构造类');
  assert.equal(i18n1, i18n2, '/src/i18n 与 /src/i18n/index.js 应返回同一 MockI18n 引用');
});
