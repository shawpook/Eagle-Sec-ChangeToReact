/**
 * M4-A —— URL 双向同步与 goBack/goForward 守卫的验证。
 *
 * 背景（只读审计结论，本文件把它变成可断言判据）：
 *  1. **缺陷不是「方法调用无守卫」，而是「属性读取不加括号」**：
 *     `core/navHistory.ts` 写成 `if (…UrlStateService.canGoForward)` —— 读的是**函数对象**
 *     （恒 truthy），guard 恒真 ≡ 无条件 `webContents.goForward()/goBack()`。
 *     同仓 `store/toolbarState.ts:110-111` 是正确口径（带括号 + try/catch）。
 *  2. **URL 双向同步只剩单向**：URL←状态有 11 个写点；URL→状态**只有启动期一次性**读，
 *     React 侧对 `popstate`/`hashchange` **零监听**（旧版 `js/services/url-state-service.js:54`
 *     的监听是被**主动移除**的，触发面全寄托于 Angular `$locationChangeSuccess`；去 Angular
 *     后无人接管）。故 `webContents.goBack()` 只回退地址栏 hash、不改任何应用状态。
 *
 * 判据都不是「源码里看起来加了括号 / 加了监听」：
 *  - 甲：真装载 `navHistory.ts`，用**可计数的 canGoBack/canGoForward 桩**驱动，按
 *    `webContents.goBack/goForward` 的**调用次数**判定。
 *  - 乙：从 `bundleGlobals.ts` **按大括号配对抽真实源码块**（UrlStateService 实现）到 vm 中
 *    执行，用**会抛事件的 location 桩**驱动，按 onChange 订阅者的**收到次数**判定回环防护。
 *  - 丙：从 `libraryDomain.ts` **按大括号配对抽真实函数**到 vm 中执行，按各 open 系与
 *    filterWithColor 的**调用实参**判定四条语义。
 *
 * **局限（明写）**：
 *  - 乙的 location 桩把 hashchange/popstate 建模为**排队后手动 flush**（与浏览器一致：两个
 *    事件都在导航之后**异步**投递；本实现的「先登记自写回显、后收到事件」正是依赖这一点）。
 *    桩不是活的 Chromium —— 活体一路由 Electron smoke（react-stage9a3/9b1）覆盖。
 *  - 丙装载的是**映射函数**，不是整个 libraryDomain（其依赖图过大）。函数体是真实源码文本，
 *    但「它被挂在哪个生命周期上」由丁的结构断言覆盖，不由丙覆盖。
 *  - 「滚动语义」的像素级恢复由 open* 内部既有路径承载，本文件只断言**派发路径与参数**
 *    （即走上了与启动期读点相同的那条 `ignoreReload` 为假的路径），并显式标注。
 *
 * 运行：node tests/m4-url-history.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const NAV_HISTORY = 'src/app/react/core/navHistory.ts';
const BUNDLE_GLOBALS = 'src/app/react/core/bundleGlobals.ts';
const LIBRARY_DOMAIN = 'src/app/react/core/libraryDomain.ts';
const FOLDER_CORE = 'src/app/react/services/folderCoreService.ts';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const stripCR = (text) => text.replace(/\r\n/g, '\n');

/**
 * vm 里造出来的对象/数组带的是 **vm realm 的** Object.prototype，`deepStrictEqual` 会因
 * 原型不同而判不等（报「Values have same structure but are not reference-equal」）。
 * 跨 realm 比较前先规约成宿主 realm 的纯值。
 */
const plain = (value) => JSON.parse(JSON.stringify(value));

/** 只做语法转译（不做类型检查；类型由 tests/typecheck.mjs 负责）。 */
function transpile(code, filename) {
  const { outputText, diagnostics } = ts.transpileModule(code, {
    fileName: filename,
    reportDiagnostics: true,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  assert.equal(diagnostics.length, 0, `${filename} 转译应无诊断`);
  return outputText;
}

/* ==================== 大括号配对抽取（真源码，不重写） ==================== */

/**
 * 从 `openIndex`（指向 `{`）起找到配对 `}` 的下标。
 * 跳过字符串（' " `）与注释（// 与 /*），避免把字面量里的括号计入配对。
 */
function matchBrace(source, openIndex) {
  assert.equal(source[openIndex], '{', 'matchBrace 必须从 { 开始');
  let depth = 0;
  for (let i = openIndex; i < source.length; i++) {
    const ch = source[i];
    const next = source[i + 1];
    if (ch === '/' && next === '/') {
      const nl = source.indexOf('\n', i);
      i = nl === -1 ? source.length : nl;
      continue;
    }
    if (ch === '/' && next === '*') {
      const close = source.indexOf('*/', i + 2);
      i = close === -1 ? source.length : close + 1;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      const quote = ch;
      for (i++; i < source.length; i++) {
        if (source[i] === '\\') { i++; continue; }
        if (source[i] === quote) break;
      }
      continue;
    }
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  throw new Error('大括号未配对');
}

/** 抽 `marker` 起、其后的第一个 `{…}` 块（含块外的前缀，如 `if (…)`）。 */
function extractBlock(source, marker, label) {
  const start = source.indexOf(marker);
  assert.ok(start >= 0, `未在源码中找到标记「${label}」`);
  const open = source.indexOf('{', start);
  assert.ok(open > start, `标记「${label}」之后没有块起始`);
  return source.slice(start, matchBrace(source, open) + 1);
}

/** 抽一个具名函数声明（含签名行）。 */
function extractFunction(source, signature, label) {
  const start = source.indexOf(signature);
  assert.ok(start >= 0, `未在源码中找到函数「${label}」`);
  const open = source.indexOf('{', start);
  const end = matchBrace(source, open);
  return source.slice(start, end + 1);
}

/* ==================== 甲：navHistory 的守卫 ==================== */

/**
 * 装载 `navHistory.ts`（真源码，CommonJS 转译后执行），把它的模块依赖换成桩。
 * 返回的 `webContents` 记录 goBack/goForward 的**真实调用次数**。
 */
function loadNavHistory({ canGoBack, canGoForward, urlStateService } = {}) {
  const calls = { goBack: 0, goForward: 0 };
  const probes = { canGoBack: 0, canGoForward: 0 };

  const webContents = {
    goBack: () => { calls.goBack++; },
    goForward: () => { calls.goForward++; },
  };

  const service = urlStateService !== undefined
    ? urlStateService
    : {
        canGoBack: () => { probes.canGoBack++; return canGoBack; },
        canGoForward: () => { probes.canGoForward++; return canGoForward; },
      };

  const windowStub = {
    currentWindow: { webContents },
  };

  const modules = {
    '../services/folderCoreService': { openFolder: () => {}, openSmartFolder: () => {} },
    '../utils/domQuery': { q: () => null, qaVisible: () => [] },
    './libraryDomain': { machineryOpenTrash: () => {} },
    './miscDomain': { cgNotifyServiceCloseAll: () => {}, machineryLeaveDetailMode: () => {} },
    '../store/miscRawState': { useMiscRawState: { getState: () => ({ UrlStateService: service, undo: undefined, closeAll: undefined }) } },
    '../store/bodyState': { useBodyState: { getState: () => ({ isDetailMode: false }) } },
  };

  const exported = {};
  const context = {
    console,
    window: windowStub,
    exports: exported,
    require(name) {
      assert.ok(Object.hasOwn(modules, name), `${NAV_HISTORY} 不得加载未隔离的依赖：${name}`);
      return modules[name];
    },
  };
  vm.runInNewContext(transpile(stripCR(read(NAV_HISTORY)), NAV_HISTORY), context, { filename: NAV_HISTORY });
  return { exported, calls, probes, windowStub };
}

test('M4-A / 守卫：canGoBack() 为 false 时不得调用 goBack（原实现恒真 → 必然调用）', () => {
  const { exported, calls, probes } = loadNavHistory({ canGoBack: false, canGoForward: false });

  assert.equal(typeof exported.machineryPrevHistory, 'function');
  exported.machineryPrevHistory();

  // 空洞防护：先证明**函数真的被调用了**——原实现读的是函数对象，从不调用它。
  assert.equal(probes.canGoBack, 1, 'canGoBack 必须被真正调用（不是读取函数对象）');
  assert.equal(calls.goBack, 0, 'canGoBack() 为 false 时不得调用 goBack');
});

test('M4-A / 守卫：canGoBack() 为 true 时恰好调用一次 goBack（不得改成永不后退）', () => {
  const { exported, calls, probes } = loadNavHistory({ canGoBack: true, canGoForward: true });

  exported.machineryPrevHistory();
  assert.equal(probes.canGoBack, 1);
  assert.equal(calls.goBack, 1, 'canGoBack() 为 true 时必须后退，且只退一次');
});

test('M4-A / 守卫：canGoForward() 两个分支同理（false 不调用 / true 调用一次）', () => {
  const denied = loadNavHistory({ canGoBack: false, canGoForward: false });
  denied.exported.machineryNextHistory();
  assert.equal(denied.probes.canGoForward, 1, 'canGoForward 必须被真正调用');
  assert.equal(denied.calls.goForward, 0, 'canGoForward() 为 false 时不得调用 goForward');

  const allowed = loadNavHistory({ canGoBack: true, canGoForward: true });
  allowed.exported.machineryNextHistory();
  assert.equal(allowed.calls.goForward, 1, 'canGoForward() 为 true 时必须前进，且只前进一次');
});

test('M4-A / 守卫：UrlStateService 缺席或抛错时不得抛穿、不得误导航', () => {
  // 原实现在此处会抛 TypeError（`undefined.canGoBack`）—— 这是 guard 修正带来的第二个可观察差异。
  const missing = loadNavHistory({ urlStateService: undefined });
  missing.windowStub.currentWindow = { webContents: missing.calls };
  // urlStateService === undefined → 桩内部仍返回 undefined 服务
  const { exported, calls } = loadNavHistory({
    urlStateService: { get canGoBack() { throw new Error('boom'); }, canGoForward: () => { throw new Error('boom'); } },
  });
  assert.doesNotThrow(() => exported.machineryPrevHistory());
  assert.doesNotThrow(() => exported.machineryNextHistory());
  assert.equal(calls.goBack, 0);
  assert.equal(calls.goForward, 0);
  assert.equal(missing.calls.goBack, 0);
});

/* ==================== 乙：UrlStateService 的触发面与回环防护 ==================== */

/**
 * 造一个「会抛事件」的 window 桩：
 *  - `location.hash` 赋值 = 真实导航 → **排队** hashchange（不立即投递，与浏览器一致：
 *    hashchange/popstate 都在导航之后异步派发）。
 *  - `location.__jump(v)` = 模拟浏览器已完成跳转（回退/前进），只改值不排队。
 *  - `flush()` 投递队列中的全部事件。
 */
function makeBrowserStub() {
  const handlers = new Map();
  const queued = [];
  let hash = '#!/';

  const fire = (name) => {
    for (const fn of handlers.get(name) || []) fn({ type: name });
  };

  const location = {
    get hash() { return hash; },
    set hash(value) {
      const next = value.startsWith('#') ? value : `#${value}`;
      if (next === hash) return; // 同值不触发（与浏览器一致）
      hash = next;
      queued.push('hashchange');
    },
    __jump(value) { hash = value.startsWith('#') ? value : `#${value}`; },
  };

  const history = {
    replaceStateCalls: 0,
    replaceState(_state, _title, url) {
      this.replaceStateCalls++;
      hash = url; // 与浏览器一致：replaceState 不派发任何事件
    },
  };

  const windowStub = {
    location,
    addEventListener(name, fn) {
      if (!handlers.has(name)) handlers.set(name, []);
      handlers.get(name).push(fn);
    },
    removeEventListener() {},
  };

  return {
    window: windowStub,
    history,
    /** 浏览器前进/后退：hash 已变，popstate 与 hashchange 双投递。 */
    navigate(nextHash) {
      location.__jump(nextHash);
      queued.push('popstate');
      queued.push('hashchange');
      this.flush();
    },
    flush() {
      const batch = queued.splice(0);
      for (const name of batch) fire(name);
    },
    listenerCount: (name) => (handlers.get(name) || []).length,
  };
}

/** 把 bundleGlobals 里的 UrlStateService 块抽出来，在浏览器桩上执行。 */
function loadUrlStateService({ isDetailMode = false } = {}) {
  const browser = makeBrowserStub();
  const scope = { isDetailMode };
  const source = stripCR(read(BUNDLE_GLOBALS));

  const block = extractBlock(source, 'if (!w.UrlStateService) {', 'UrlStateService');
  // 抽取结果必须确是我们以为的那块——防止标记漂移后静默抽到别处。
  for (const marker of ['usDispatchNavigation', "addEventListener('popstate'", 'usSelfWritten', 'usAppliedHash']) {
    assert.ok(block.includes(marker), `抽取的 UrlStateService 块应含「${marker}」（抽取失败或源码漂移）`);
  }

  const sandbox = {
    console,
    window: browser.window,
    w: browser.window,
    history: browser.history,
    Set,
    getWindowScope: () => scope,
  };
  vm.runInNewContext(transpile(block, BUNDLE_GLOBALS), sandbox, { filename: `${BUNDLE_GLOBALS}#UrlStateService` });

  const service = sandbox.w.UrlStateService;
  assert.ok(service, 'UrlStateService 应已安装');
  return { service, browser, scope };
}

test('M4-A / 触发面：popstate 与 hashchange 都装了监听（旧版 url-state-service.js:54 移除的面）', () => {
  const { browser } = loadUrlStateService();
  assert.equal(browser.listenerCount('popstate'), 1, 'popstate 监听必须装上');
  assert.equal(browser.listenerCount('hashchange'), 1, 'hashchange 监听必须装上');
});

test('M4-A / 回环防护 a：setState 的程序化写入不得被当成一次外部导航回灌', () => {
  const { service, browser } = loadUrlStateService();
  const seen = [];
  service.onChange((state) => seen.push(state));

  service.setState({ view: 'trash', folder: null, smartfolder: null, tag: null, color: null });
  // setState 自身同步分发一次（$locationChangeSuccess 的等价语义）。
  assert.equal(seen.length, 1, 'setState 应同步分发一次');
  assert.equal(seen[0].view, 'trash');

  // 浏览器随后投递由本次写入引发的 hashchange —— 必须被认领并丢弃。
  browser.flush();
  assert.equal(seen.length, 1, '自写回显必须被丢弃，否则形成 URL←状态 → URL→状态 自激');

  // 空洞防护：证明「外部导航确实会分发」——否则上面的「没涨」可能只是因为监听根本没通。
  browser.navigate('#!/?view=all');
  assert.equal(seen.length, 2, '外部导航必须分发（否则本用例不具判别力）');
  assert.equal(seen[1].view, 'all');
});

test('M4-A / 回环防护 b：一次前进/后退的 popstate + hashchange 双投递只应用一次', () => {
  const { service, browser } = loadUrlStateService();
  const seen = [];
  service.onChange((state) => seen.push(state));

  browser.navigate('#!/?view=recent');
  assert.equal(seen.length, 1, '双投递必须去重为一次');

  browser.navigate('#!/?view=unfiled');
  assert.equal(seen.length, 2, '下一次导航仍应分发');
  assert.deepEqual(seen.map((s) => s.view), ['recent', 'unfiled']);
});

test('M4-A / 回环防护：同轮连写两次，两个回显都必须被认领（用计数挂起会漏一个）', () => {
  const { service, browser } = loadUrlStateService();
  const seen = [];
  service.onChange((state) => seen.push(state));

  service.setState({ view: 'folder', folder: 'f1', smartfolder: null, tag: null, color: null });
  service.setState({ view: 'color', color: 'red', folder: null, smartfolder: null, tag: null });
  assert.equal(seen.length, 2, '两次 setState 各同步分发一次');
  browser.flush();
  assert.equal(seen.length, 2, '两个自写回显都必须被认领并丢弃');
});

test('M4-A / 回环防护：replaceState 分支不得留下永不消费的悬账', () => {
  const { service, browser } = loadUrlStateService();
  const seen = [];
  service.onChange((state) => seen.push(state));

  service.setState({ view: 'alltags', folder: null, smartfolder: null, tag: null, color: null }, true);
  assert.equal(browser.history.replaceStateCalls, 1, 'replace=true 应走 replaceState');
  browser.flush();
  assert.equal(seen.length, 1, 'replaceState 不派发事件，不应有额外分发');

  // 关键：此后**真实导航到同一个 hash**必须仍能分发（登记悬账会在此被静默吞掉）。
  browser.navigate(browser.window.location.hash);
  assert.equal(seen.length, 2, 'replace 写入过的 hash 在后续真实导航中不得被误吞');
});

test('M4-A / 语义：detail 模式下 URL→状态 与 setState 同口径（都不改视图）', () => {
  const { service, browser, scope } = loadUrlStateService({ isDetailMode: false });
  const seen = [];
  service.onChange((state) => seen.push(state));

  scope.isDetailMode = true;
  browser.navigate('#!/?view=trash');
  assert.equal(seen.length, 0, 'detail 模式下不得改视图（与 setState 的 $locationChangeStart preventDefault 同口径）');

  scope.isDetailMode = false;
  browser.navigate('#!/?view=untagged');
  assert.equal(seen.length, 1, '退出 detail 模式后恢复分发');
});

test('M4-A / 触发面：onChange 返回的退订函数必须真正摘除监听', () => {
  const { service, browser } = loadUrlStateService();
  const seen = [];
  const off = service.onChange((state) => seen.push(state));

  browser.navigate('#!/?view=random');
  assert.equal(seen.length, 1);
  off();
  browser.navigate('#!/?view=community');
  assert.equal(seen.length, 1, '退订后不得再收到分发');
});

test('M4-A / 触发面：getState 的解析口径不变（view 缺省 all、字段集与写点一致）', () => {
  const { service, browser } = loadUrlStateService();
  browser.window.location.__jump('#!/?view=folder&folder=f9&page=3&color=gray&imageFilter=x');
  assert.deepEqual(plain(service.getState()), {
    view: 'folder', folder: 'f9', smartfolder: null, color: 'gray', page: 3, imageFilter: 'x',
  });

  browser.window.location.__jump('#!/');
  assert.deepEqual(plain(service.getState()), {
    view: 'all', folder: null, smartfolder: null, color: null, page: 1, imageFilter: null,
  });
});

/* ==================== 丙：libraryDomain 的 URL→状态 映射（四条语义） ==================== */

/**
 * 抽 `applyUrlStateView` / `applyUrlStateNavigation` 两个**真实函数**，配桩执行。
 * 记录每个 open 系 / filterWithColor 收到的一次调用实参，并按调用序给出流水线。
 */
function loadUrlStateMapper() {
  const calls = [];
  const record = (name) => (...args) => { calls.push({ name, args }); };

  const pageWrites = [];
  let pageValue = 1;

  const useMiscRawState = {
    getState: () => ({ page: pageValue }),
    setState: (patch) => { pageWrites.push(plain(patch)); if ('page' in patch) pageValue = patch.page; },
  };
  const useItemState = {
    getState: () => ({
      folderMappings: { 'f-1': { id: 'f-1', name: 'Alpha' } },
      smartFolderMappings: { 's-1': { id: 's-1', name: 'Smart' } },
    }),
  };

  const source = stripCR(read(LIBRARY_DOMAIN));
  const fnView = extractFunction(source, 'function applyUrlStateView(urlState: any): boolean {', 'applyUrlStateView');
  const fnNav = extractFunction(source, 'function applyUrlStateNavigation(urlState: any): void {', 'applyUrlStateNavigation');

  const wrappers = `
    (function (machineryOpenUnfiled, machineryOpenUntagged, machineryOpenRandom, machineryOpenRecent,
              machineryOpenCommunity, machineryOpenAllTags, machineryOpenTrash, machineryOpenAll,
              openFolder, openSmartFolder, filterWithColor, useMiscRawState, useItemState) {
      ${fnView}
      ${fnNav}
      return { applyUrlStateView, applyUrlStateNavigation };
    })
  `;

  const factory = vm.runInNewContext(transpile(wrappers, LIBRARY_DOMAIN), { console }, { filename: `${LIBRARY_DOMAIN}#applyUrlState` });
  const api = factory(
    record('machineryOpenUnfiled'), record('machineryOpenUntagged'), record('machineryOpenRandom'),
    record('machineryOpenRecent'), record('machineryOpenCommunity'), record('machineryOpenAllTags'),
    record('machineryOpenTrash'), record('machineryOpenAll'),
    record('openFolder'), record('openSmartFolder'), record('filterWithColor'),
    useMiscRawState, useItemState
  );

  return { api, calls, pageWrites, useMiscRawState };
}

/** UrlStateService.usStateOf 的等价输入（字段集与真实解析一致）。 */
const urlStateOf = (overrides = {}) => ({
  view: 'all', folder: null, smartfolder: null, color: null, page: 1, imageFilter: null, ...overrides,
});

test('M4-A / 语义① 文件夹：view=folder 恢复文件夹，且以 ignoreHistory=true 派发（不产生回写）', () => {
  const { api, calls } = loadUrlStateMapper();
  assert.equal(api.applyUrlStateView(urlStateOf({ view: 'folder', folder: 'f-1' })), true);

  assert.equal(calls.length, 1);
  assert.equal(calls[0].name, 'openFolder');
  assert.deepEqual(calls[0].args, [{ id: 'f-1', name: 'Alpha' }, true], '必须是 (folder, ignoreHistory=true)');
});

test('M4-A / 语义① 文件夹：映射缺席时不动作、不抛错（与启动期读点同判据）', () => {
  const { api, calls } = loadUrlStateMapper();
  assert.equal(api.applyUrlStateView(urlStateOf({ view: 'folder', folder: '不存在' })), false);
  assert.equal(calls.length, 0);
});

test('M4-A / 语义① 智能文件夹：view=smartfolder 走 openSmartFolder(…, true)', () => {
  const { api, calls } = loadUrlStateMapper();
  assert.equal(api.applyUrlStateView(urlStateOf({ view: 'smartfolder', smartfolder: 's-1' })), true);
  assert.equal(calls[0].name, 'openSmartFolder');
  assert.deepEqual(calls[0].args, [{ id: 's-1', name: 'Smart' }, true]);
});

test('M4-A / 语义② 筛选：view=color 恢复色彩筛选，且以 ignoreHistory=true 派发', () => {
  const { api, calls } = loadUrlStateMapper();
  assert.equal(api.applyUrlStateView(urlStateOf({ view: 'color', color: 'gray' })), true);
  assert.equal(calls[0].name, 'filterWithColor');
  assert.deepEqual(calls[0].args, ['gray', true], '必须是 (color, ignoreHistory=true)');
});

test('M4-A / 语义③ 页码：page 必须在视图派发**之前**落位（避免「先旧页加载、再改页重载」）', () => {
  const { api, calls, pageWrites } = loadUrlStateMapper();
  assert.equal(pageWrites.length, 0);

  api.applyUrlStateNavigation(urlStateOf({ view: 'folder', folder: 'f-1', page: 5 }));

  assert.deepEqual(pageWrites, [{ page: 5 }], 'page 应被写为 URL 携带的页码');
  assert.deepEqual(calls.map((c) => c.name), ['openFolder'], 'page 先于视图派发');
});

test('M4-A / 语义③ 页码：page 非有限值时不得写入（不产生 NaN 页码）', () => {
  const { api, pageWrites } = loadUrlStateMapper();
  api.applyUrlStateNavigation(urlStateOf({ view: 'trash', page: NaN }));
  api.applyUrlStateNavigation(urlStateOf({ view: 'trash', page: 0 }));
  assert.deepEqual(pageWrites, [], 'NaN / 0 均不得落位');
});

test('M4-A / 语义④ 滚动：恢复走 open* 的同一条路径（参数决定 ignoreReload 为假 → restoreScrollPosition）', () => {
  const { api, calls } = loadUrlStateMapper();
  api.applyUrlStateNavigation(urlStateOf({ view: 'folder', folder: 'f-1' }));
  api.applyUrlStateNavigation(urlStateOf({ view: 'recent' }));

  // 全部走 open*，且第三参未给 → openFolder 内 `ignoreReload` 为假 → 走
  // `ScrollbarSaver.restoreScrollPosition()` + `reload()`（folderCoreService.ts:851-854）。
  // 这与启动期读点是同一条调用路径——「恢复…滚动语义」由此承载，本用例只断言到路径与参数。
  assert.deepEqual(calls.map((c) => c.name), ['openFolder', 'machineryOpenRecent']);
  for (const call of calls) {
    assert.equal(call.args[call.args.length - 1], true, `${call.name} 必须以 ignoreHistory=true 派发`);
    assert.ok(call.args.length <= 2, `${call.name} 不得传入 ignoreReload（否则跳过 restoreScrollPosition）`);
  }

  // 承载体确实存在：真实源码里 ignoreReload 为假的分支调用 restoreScrollPosition。
  const folderSource = stripCR(read(FOLDER_CORE));
  const restoreIndex = folderSource.indexOf('ScrollbarSaver.restoreScrollPosition()');
  const reloadIndex = folderSource.indexOf('useMiscRawState.getState().reload()', restoreIndex);
  assert.ok(restoreIndex > 0 && reloadIndex > restoreIndex, 'openFolder 的恢复分支应含 restoreScrollPosition + reload');
});

test('M4-A / 语义：view=all 是 URL 的默认值，导航期必须显式接管（启动期不处理它）', () => {
  const { api, calls } = loadUrlStateMapper();
  api.applyUrlStateNavigation(urlStateOf({ view: 'all' }));
  assert.deepEqual(calls.map((c) => c.name), ['machineryOpenAll']);
  assert.deepEqual(calls[0].args, [true], '必须以 ignoreHistory=true 派发');
});

test('M4-A / 语义：七种非文件夹视图逐一映射到对应 open*（skip 与启动期读点一致）', () => {
  const expected = {
    unfiled: 'machineryOpenUnfiled',
    untagged: 'machineryOpenUntagged',
    random: 'machineryOpenRandom',
    recent: 'machineryOpenRecent',
    community: 'machineryOpenCommunity',
    alltags: 'machineryOpenAllTags',
    trash: 'machineryOpenTrash',
  };
  for (const [view, name] of Object.entries(expected)) {
    const { api, calls } = loadUrlStateMapper();
    assert.equal(api.applyUrlStateView(urlStateOf({ view })), true, `${view} 应被认领`);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].name, name);
    assert.deepEqual(calls[0].args, [true], `${view} 必须以 ignoreHistory=true 派发`);
  }
});

test('M4-A / 语义：无法识别的 view 不动作（不得误切视图）', () => {
  const { api, calls } = loadUrlStateMapper();
  assert.equal(api.applyUrlStateView(urlStateOf({ view: 'nonsense' })), false);
  assert.equal(calls.length, 0);
});

/* ==================== 丁：结构守卫（单一真相 / 订阅幂等 / 无重复实现） ==================== */

test('M4-A / 结构：启动期读点改为调用共用实现，不再内联第二份 switch', () => {
  const source = stripCR(read(LIBRARY_DOMAIN));

  assert.ok(
    source.includes('let hasUrlState = applyUrlStateView(urlState);'),
    '启动期读点必须调用 applyUrlStateView（单一真相）'
  );
  // 内联 switch 的搬运已发生：这些 case 现在只应出现在 applyUrlStateView 内**一次**。
  const folderCaseCount = source.split("case 'folder':").length - 1;
  assert.equal(folderCaseCount, 1, `case 'folder' 应只出现一次，实际 ${folderCaseCount} 次（出现了第二份真相）`);
  const colorCaseCount = source.split("case 'color':").length - 1;
  assert.equal(colorCaseCount, 1, `case 'color' 应只出现一次，实际 ${colorCaseCount} 次`);
});

test('M4-A / 结构：每一条 URL←状态 写点的字段都被 URL→状态 解析面带覆盖（同一套字段）', () => {
  // 11 个写点的字段清单（本批先清点后动工，见汇报）。除 view 外，写点使用的字段集合为：
  //   folder / smartfolder / tag / color / page
  // —— URL→状态 的解析面（usStateOf）必须认得其中每一个，否则写进去读不回来。
  const bundle = stripCR(read(BUNDLE_GLOBALS));
  const stateOf = extractBlock(bundle, 'const usStateOf = (search: any) => ({', 'usStateOf');
  for (const field of ['view', 'folder', 'smartfolder', 'color', 'page', 'imageFilter']) {
    assert.ok(stateOf.includes(`${field}:`), `usStateOf 应解析字段「${field}」`);
  }
  // tag 是写点里恒被置 null 的**清除项**，不承载取值——记录在案，不要求解析面带取值。
  assert.ok(!stateOf.includes('tag:'), 'usStateOf 不解析 tag（写点恒置 null，非取值字段）');
});

test('M4-A / 结构：订阅注册幂等（标记挂在服务对象上，重复执行不叠加）', () => {
  const source = stripCR(read(LIBRARY_DOMAIN));
  const marker = '订阅只装一次';
  const start = source.indexOf(marker);
  assert.ok(start >= 0, '未找到订阅注册块');
  const tryStart = source.indexOf('try {', start);
  const tryOpen = source.indexOf('{', tryStart);
  const tryEnd = matchBrace(source, tryOpen);
  // 必须把 catch 子句一并纳入，否则抽出的是裸 try（语法错误 → 转译诊断非 0）。
  let blockEnd = tryEnd;
  const catchMatch = /^\s*catch\s*\([^)]*\)\s*\{/.exec(source.slice(tryEnd + 1));
  if (catchMatch) {
    blockEnd = matchBrace(source, tryEnd + 1 + catchMatch.index + catchMatch[0].length - 1);
  }
  const block = source.slice(tryStart, blockEnd + 1);

  const registered = [];
  const service = {
    onChange(fn) { registered.push(fn); return () => {}; },
  };
  const fnNav = extractFunction(source, 'function applyUrlStateNavigation(urlState: any): void {', 'applyUrlStateNavigation');
  const sandbox = {
    console,
    useMiscRawState: { getState: () => ({ UrlStateService: service }) },
  };
  // fnNav 必须一并纳入作用域：缺它会 ReferenceError，被注册块自己的 try/catch 静默吞掉
  // （本用例正是要测「注册确实发生」，静默吞掉会让断言看得见）。
  const code = `(function (useMiscRawState) { ${fnNav} ${block} })`;
  const run = vm.runInNewContext(transpile(code, LIBRARY_DOMAIN), sandbox, { filename: `${LIBRARY_DOMAIN}#subscribe` });

  run(sandbox.useMiscRawState);
  assert.equal(registered.length, 1, '首次执行应订阅一次');
  run(sandbox.useMiscRawState);
  run(sandbox.useMiscRawState);
  assert.equal(registered.length, 1, '重复执行不得叠加订阅（库切换会反复走到这里）');
  assert.equal(typeof service.__m4NavigationBound, 'function', '幂等标记应是 onChange 的退订句柄');

  // 注册进去的确实是真函数（不是 undefined 被静默吞掉后的空洞通过）。
  assert.equal(typeof registered[0], 'function');

  // 服务缺席时不得抛穿。
  const absent = vm.runInNewContext(transpile(code, LIBRARY_DOMAIN), { console, useMiscRawState: { getState: () => ({}) } }, { filename: `${LIBRARY_DOMAIN}#subscribe2` });
  assert.doesNotThrow(() => absent({ getState: () => ({}) }));
});
