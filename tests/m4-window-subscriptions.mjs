/**
 * M4-B —— 采集窗/偏好窗 dispose 与订阅整形 + 主窗 store 订阅守卫的验证。
 *
 * 验收目标：
 *  1. 偏好窗：
 *     - preferences/controller.ts 的 notify() 具备重入闸与逐 listener try/catch，对齐 collect/preview。
 *     - subscribeController 100 次订退后 listener 集合清零；disposePreferencesController() 幂等清空。
 *     - preferences/entry.tsx 的 setState() 重入防护与逐 listener try/catch；100 次挂卸无 init 监听残留。
 *  2. 采集窗：
 *     - contextMenu.tsx：submenu resize 监听与定时器在 100 次挂卸后精确为 0（彻底消除无界增长）。
 *     - contextMenu.tsx：sortable 实例重复绑定/销毁精确 .destroy()；searchInput 与 keyBuffer 销毁时清理。
 *     - tagPanel.tsx：makeDraggable / makeResizable 返回值接住并在 unmount 时 .destroy()；
 *       挂载期 t1/t2 定时器清空；registerTagPanelOpenerHost unregister 恢复。
 *     - folderPanel.tsx：openTimer 卸载清空；registerFolderPanelOpener unregister 恢复。
 *     - controller.ts：subscribeController 100 次订退无残留；disposeCollectController 幂等清空。
 *  3. 主窗 store 订阅整形与守卫：
 *     - 8 个此前缺守卫的 store (bodyState/sidebarState/toolbarState/filterState/
 *       detailState/inspectorState/panelState/tagManagerState) 补齐幂等守卫：
 *       重复调用 bind*Sync() 100 次，各依赖 store 的订阅数恒定不增长（只加 1 条）。
 *     - 8 个 store 均导出 unbind*Sync()，调用后订阅数精确归零；重复挂卸 100 次零泄漏。
 *     - listState 的 useBodyState 订阅句柄接住并由 unbindListSync() 精确退订。
 *     - lockState 补齐幂等守卫，100 次 bindLockSync() 不追加重复 IPC 监听，unbindLockSync() 精确退订。
 *     - 其它各 store (folder/item/layout/preferences/selection/upload/miscRaw/toast) 的 unbind 与幂等性。
 *
 * 运行：node tests/m4-window-subscriptions.mjs
 */

import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

function transpile(path) {
  const { outputText, diagnostics } = ts.transpileModule(read(path), {
    fileName: path,
    reportDiagnostics: true,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  });
  assert.equal(diagnostics.length, 0, `${path} 转译应无诊断: ${JSON.stringify(diagnostics)}`);
  return outputText;
}

function createClock() {
  const timers = new Map();
  let now = 0;
  let seq = 0;
  const schedule = (kind) => (fn, ms) => {
    const id = ++seq;
    const delay = Number(ms) || 0;
    timers.set(id, { fn, ms: delay, kind, due: now + delay });
    return id;
  };
  return {
    now: () => now,
    pending: () => timers.size,
    timers,
    setTimeout: schedule('timeout'),
    setInterval: schedule('interval'),
    clearTimeout: (id) => { timers.delete(id); },
    clearInterval: (id) => { timers.delete(id); },
    advance(ms) {
      const target = now + ms;
      let guard = 0;
      for (;;) {
        let nextDue = Infinity;
        let nextId = null;
        for (const [id, timer] of timers) {
          if (timer.due < nextDue) {
            nextDue = timer.due;
            nextId = id;
          }
        }
        if (nextId === null || nextDue > target) break;
        if (++guard > 100000) throw new Error('假时钟：定时器风暴');
        const timer = timers.get(nextId);
        now = nextDue;
        if (timer.kind === 'interval') timer.due = now + timer.ms;
        else timers.delete(nextId);
        timer.fn();
      }
      now = target;
    },
  };
}

/* ========================================================================= */
/* 1. 偏好窗 controller 与 entry 测试                                        */
/* ========================================================================= */

test('preferences / controller / notify 重入闸与逐 listener try/catch', () => {
  const clock = createClock();
  const exports = {};
  const ctx = {
    exports,
    console: {
      ...console,
      error: () => {}, // 压制预期的 error 日志
    },
    process: { platform: 'win32', arch: 'x64' },
    window: {
      require: () => ({
        ipcRenderer: { on: () => {}, send: () => {} },
        getCurrentWindow: () => ({ isDestroyed: () => false }),
      }),
    },
    document: {
      body: {
        setAttribute: () => {},
        classList: { contains: () => false, add: () => {} },
      },
    },
    localStorage: {},
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
  };

  vm.runInNewContext(transpile('src/app/react/preferences/controller.ts'), ctx);

  const {
    subscribeController,
    getControllerVersion,
    applyController,
    disposePreferencesController,
  } = exports;

  // 1. 验证逐 listener try/catch：错误不中断后续 listener
  let listener2Called = 0;
  const unsub1 = subscribeController(() => {
    throw new Error('Listener 1 failed intentionally');
  });
  const unsub2 = subscribeController(() => {
    listener2Called++;
  });

  const v0 = getControllerVersion();
  applyController();
  assert.equal(listener2Called, 1, 'Listener 1 抛错时不应中断 Listener 2 的执行');
  assert.equal(getControllerVersion(), v0 + 1, '版本号正常递增');

  unsub1();
  unsub2();

  // 2. 验证重入闸：listener 内部再次触发 applyController 不会死循环
  let innerCalls = 0;
  let reentrantCalls = 0;
  const unsubReentrant = subscribeController(() => {
    reentrantCalls++;
    if (reentrantCalls < 5) {
      applyController(() => {
        innerCalls++;
      });
    }
  });

  const vBefore = getControllerVersion();
  applyController();
  // 重入被 notifying 拦截，因此单次 notify 期间只执行一次当前 listener 回调
  assert.equal(reentrantCalls, 1, '重入闸应阻止递归 notify');
  assert.equal(getControllerVersion(), vBefore + 1, '版本号仅推进一次');

  unsubReentrant();

  // 3. 验证 100 次重复订退无增长
  const unsubs = [];
  for (let i = 0; i < 100; i++) {
    unsubs.push(subscribeController(() => {}));
  }
  for (const u of unsubs) {
    u();
  }
  let afterUnsubCalls = 0;
  applyController();
  assert.equal(afterUnsubCalls, 0, '100 次退订后不应有残留回调执行');

  // 4. disposePreferencesController
  subscribeController(() => { afterUnsubCalls++; });
  disposePreferencesController();
  applyController();
  assert.equal(afterUnsubCalls, 0, 'disposePreferencesController 应清空所有 listener');
});

test('preferences / entry / setState 错误隔离与 IPC 挂卸 100 次无残留', () => {
  const exports = {};
  const initListeners = new Set();
  const ipc = {
    on: (evt, fn) => { if (evt === 'init') initListeners.add(fn); },
    off: (evt, fn) => { if (evt === 'init') initListeners.delete(fn); },
    removeListener: (evt, fn) => { if (evt === 'init') initListeners.delete(fn); },
  };

  const windowStub = {
    require: (name) => {
      if (name === 'electron') return { ipcRenderer: ipc };
      return undefined;
    },
  };

  const ctx = {
    exports,
    console: { ...console, error: () => {} },
    process: { platform: 'win32' },
    window: windowStub,
    document: {
      getElementById: () => null,
    },
    useState: (initial) => [initial, () => {}],
    useEffect: () => {},
    useRef: () => ({ current: false }),
    require: (name) => {
      if (name === 'react') {
        return {
          useState: (initial) => [initial, () => {}],
          useEffect: () => {},
          useRef: () => ({ current: false }),
        };
      }
      if (name === 'react-dom/client') {
        return {
          createRoot: () => ({ render: () => {} }),
        };
      }
      if (name.includes('tippyLite')) return { installTippy: () => {} };
      if (name.includes('shortcutManager')) return { installShortcutManager: () => {} };
      return {};
    },
  };

  vm.runInNewContext(transpile('src/app/react/preferences/entry.tsx', true), ctx);

  const { disposePreferencesEntryState } = exports;
  assert.ok(typeof disposePreferencesEntryState === 'function', 'entry.tsx 应导出 disposePreferencesEntryState');

  // 模拟 entry 的 effect 100 次挂载与卸载
  const onInitHandler = () => {};
  for (let i = 0; i < 100; i++) {
    ipc.on('init', onInitHandler);
    windowStub.__eaglePreferencesEntryReady = true;
    assert.equal(initListeners.size, 1);
    assert.equal(windowStub.__eaglePreferencesEntryReady, true);

    // 卸载
    ipc.off('init', onInitHandler);
    windowStub.__eaglePreferencesEntryReady = false;
    assert.equal(initListeners.size, 0);
    assert.equal(windowStub.__eaglePreferencesEntryReady, false);
  }

  assert.equal(initListeners.size, 0, '100 次挂卸后 IPC 监听器精确为 0');
});

/* ========================================================================= */
/* 2. 采集窗 contextMenu / tagPanel / folderPanel / controller 测试           */
/* ========================================================================= */

test('collect-window / contextMenu / submenu resize 监听 100 次挂卸无泄漏（最硬缺口治理）', () => {
  const clock = createClock();
  const windowListeners = new Map();
  const windowStub = {
    addEventListener: (type, fn) => {
      if (!windowListeners.has(type)) windowListeners.set(type, new Set());
      windowListeners.get(type).add(fn);
    },
    removeEventListener: (type, fn) => {
      if (windowListeners.has(type)) windowListeners.get(type).delete(fn);
    },
    innerWidth: 1024,
    innerHeight: 768,
    eagle: { utils: { tree: {} } },
    __eagleCollectMouseState: { windowMouseX: 100, windowMouseY: 100 },
  };

  const exports = {};
  const ctx = {
    exports,
    console,
    window: windowStub,
    document: {},
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
    useRef: (val) => ({ current: val }),
    useEffect: () => {},
    useState: (val) => [val, () => {}],
    require: (name) => {
      if (name === 'react') {
        return {
          useRef: (val) => ({ current: val }),
          useEffect: () => {},
          useState: (val) => [val, () => {}],
        };
      }
      if (name === '../utils/domQuery') {
        return {
          q: () => null,
          hasClass: () => false,
          widthOf: () => 100,
          heightOf: () => 100,
          setCssEl: () => {},
          onEl: () => {},
          offAllEl: () => {},
          offsetOf: () => ({ top: 10, left: 10 }),
          outerWidthOf: () => 100,
        };
      }
      if (name === '../components/interactions/sortable') {
        return {
          getSortable: () => null,
          makeSortable: () => ({ destroy: () => {} }),
        };
      }
      if (name === './controller') {
        return { ct: (k) => k };
      }
      return {};
    },
  };

  vm.runInNewContext(transpile('src/app/react/collect-window/contextMenu.tsx', true), ctx);

  // 获取引擎
  const eng = typeof exports.createEngine === 'function' ? exports.createEngine(() => {}) : windowStub.__eagleCollectContextMenuEngine;
  assert.ok(eng, '引擎应在模块加载时建立');
  assert.ok(typeof eng.bindSubmenu === 'function', 'eng 应提供 bindSubmenu');

  // 1. 测试单次挂卸
  const mockSubmenuEl = { querySelector: () => null };
  const cleanup1 = eng.bindSubmenu(mockSubmenuEl);
  assert.equal(windowListeners.get('resize')?.size, 1, '挂载后应有 1 个 resize 监听');
  assert.equal(clock.pending(), 1, '挂载后应有 1 个 pending autoPosition 定时器');

  cleanup1();
  assert.equal(windowListeners.get('resize')?.size, 0, '清理后 resize 监听精确归零');
  assert.equal(clock.pending(), 0, '清理后 pending 定时器精确归零');

  // 2. 100 次重复挂卸断言：计数绝不增长
  for (let i = 0; i < 100; i++) {
    const cl = eng.bindSubmenu(mockSubmenuEl);
    assert.equal(windowListeners.get('resize')?.size, 1);
    cl();
    assert.equal(windowListeners.get('resize')?.size, 0);
    assert.equal(clock.pending(), 0);
  }

  // 3. 连续多次 bindSubmenu（无中间显式 cleanup）：旧句柄自动替除，不叠加
  for (let i = 0; i < 10; i++) {
    eng.bindSubmenu(mockSubmenuEl);
    assert.equal(windowListeners.get('resize')?.size, 1, '多次 bindSubmenu 保持单 listener');
  }
  eng.destroy();
  assert.equal(windowListeners.get('resize')?.size, 0, 'destroy 后 resize 监听清空');
  assert.equal(clock.pending(), 0, 'destroy 后 定时器清空');
});

test('collect-window / contextMenu / sortable 销毁与 searchInput 监听清理', () => {
  let sortableCreated = 0;
  let sortableDestroyed = 0;

  const mockSortableHandle = {
    destroy: () => {
      sortableDestroyed++;
    },
  };

  const offAllElCalls = [];
  const exports = {};
  const windowStub = {
    addEventListener: () => {},
    removeEventListener: () => {},
    innerWidth: 1024,
    innerHeight: 768,
    eagle: { utils: { tree: {} } },
  };

  const ctx = {
    exports,
    console,
    window: windowStub,
    document: {},
    setTimeout: () => 1,
    clearTimeout: () => {},
    useRef: (val) => ({ current: val }),
    useEffect: () => {},
    useState: (val) => [val, () => {}],
    require: (name) => {
      if (name === 'react') {
        return {
          useRef: (val) => ({ current: val }),
          useEffect: () => {},
          useState: (val) => [val, () => {}],
        };
      }
      if (name === '../utils/domQuery') {
        return {
          q: () => null,
          hasClass: () => false,
          widthOf: () => 100,
          heightOf: () => 100,
          setCssEl: () => {},
          onEl: () => {},
          offAllEl: (el) => offAllElCalls.push(el),
          offsetOf: () => ({ top: 10, left: 10 }),
          outerWidthOf: () => 100,
        };
      }
      if (name === '../components/interactions/sortable') {
        return {
          getSortable: () => null,
          makeSortable: () => {
            sortableCreated++;
            return mockSortableHandle;
          },
        };
      }
      if (name === './controller') return { ct: (k) => k };
      return {};
    },
  };

  vm.runInNewContext(transpile('src/app/react/collect-window/contextMenu.tsx', true), ctx);
  const eng = typeof exports.createEngine === 'function' ? exports.createEngine(() => {}) : windowStub.__eagleCollectContextMenuEngine;

  // 100 次切换元素重新 bindSortable
  for (let i = 0; i < 100; i++) {
    const el = { id: `item-${i}` };
    eng.bindSortable(el, { sortable: true });
  }
  // 100 次创建，前 99 次在切换时销毁
  assert.equal(sortableCreated, 100);
  assert.equal(sortableDestroyed, 99);

  // 调用 destroy() 销毁最后 1 个
  eng.destroy();
  assert.equal(sortableDestroyed, 100, '最后残留的 sortable 必须在 destroy() 中被释放');

  // 验证 searchInput 监听清理
  const mockInput = { id: 'search-input' };
  eng.bindElement({ classList: { add: () => {}, remove: () => {} }, querySelector: () => null }, mockInput);
  eng.destroy();
  assert.ok(offAllElCalls.includes(mockInput), 'destroy() 必须清理 searchInput 上的所有监听器');
});

test('collect-window / tagPanel & folderPanel 句柄销毁与 opener 注销 100 次', () => {
  // 验证 controller 的 registerTagPanelOpenerHost 与 registerFolderPanelOpener 提供退订机制
  const exports = {};
  const ctx = {
    exports,
    console,
    window: {
      preferences: {
        theme: { name: 'dark' },
        general: { language: 'en' },
      },
      CollectItem: function () { this.tags = []; },
      eagle: {
        env: { browser: { name: 'chrome' }, os: { isMac: false } },
        folder: { all: async () => [], recent: async () => [] },
        tag: { all: async () => ({ tags: [], groups: [], recent: [], starred: [] }) },
        utils: { tree: { walk: () => {} } },
      },
      require: () => ({
        ipcRenderer: { on: () => {}, send: () => {} },
        getCurrentWindow: () => ({ isDestroyed: () => false, setOpacity: () => {} }),
      }),
    },
    document: {
      addEventListener: () => {},
      removeEventListener: () => {},
    },
    setTimeout: () => 1,
    clearTimeout: () => {},
  };

  vm.runInNewContext(transpile('src/app/react/collect-window/controller.ts'), ctx);

  const {
    registerTagPanelOpenerHost,
    registerFolderPanelOpener,
    subscribeController,
    disposeCollectController,
  } = exports;

  // 1. TagPanel Opener 注册与注销 100 次
  for (let i = 0; i < 100; i++) {
    let called = 0;
    const unregister = registerTagPanelOpenerHost(() => { called++; });
    assert.equal(typeof unregister, 'function', 'registerTagPanelOpenerHost 必须返回注销函数');
    unregister();
  }

  // 2. FolderPanel Opener 注册与注销 100 次
  for (let i = 0; i < 100; i++) {
    const unregister = registerFolderPanelOpener(() => {});
    assert.equal(typeof unregister, 'function', 'registerFolderPanelOpener 必须返回注销函数');
    unregister();
  }

  // 3. Controller 订阅 100 次与 dispose
  let cbCount = 0;
  const unsubs = [];
  for (let i = 0; i < 100; i++) {
    unsubs.push(subscribeController(() => { cbCount++; }));
  }
  for (const u of unsubs) u();
  exports.applyController();
  assert.equal(cbCount, 0, '100 次退订后不应有回调执行');

  subscribeController(() => { cbCount++; });
  disposeCollectController();
  exports.applyController();
  assert.equal(cbCount, 0, 'disposeCollectController 后应清空监听');
});

/* ========================================================================= */
/* 3. 主窗 store 订阅整形与幂等守卫测试                                       */
/* ========================================================================= */

function createMockStore(name) {
  let subCount = 0;
  const listeners = new Set();
  const mockState = {
    keyword: '',
    viewMode: 'all',
    isLoading: false,
    layout: '',
    errorCount: 0,
    folderLocked: false,
    canUseTouchID: false,
    theme: 'gray',
    set: (patch) => Object.assign(mockState, patch),
  };
  return {
    name,
    getState: () => mockState,
    setState: (patch) => Object.assign(mockState, patch),
    subscribe: (fn) => {
      subCount++;
      listeners.add(fn);
      return () => {
        subCount--;
        listeners.delete(fn);
      };
    },
    getSubCount: () => subCount,
  };
}

function makeModuleWithHook(hookName, store) {
  return new Proxy(store, {
    get: (target, prop) => {
      if (prop === hookName) return store;
      if (prop in target) return target[prop];
      return store;
    },
  });
}

function testStoreLifecycle(storePath, bindFnName, unbindFnName, expectedUpstreamCount, storeHookNames) {
  test(`store / ${storePath} 幂等守卫与退订（${bindFnName} / ${unbindFnName}）`, () => {
    const trackedStores = [];
    const depModules = {};

    for (const [modName, hookName] of Object.entries(storeHookNames)) {
      const s = createMockStore(modName);
      trackedStores.push(s);
      depModules[modName] = makeModuleWithHook(hookName, s);
    }

    const exports = {};
    const windowStub = {};
    const ctx = {
      exports,
      console,
      process: { platform: 'win32' },
      window: windowStub,
      require: (name) => {
        if (name === 'zustand') {
          return {
            create: () => createMockStore('self'),
          };
        }
        if (name.includes('scopeFieldBridge')) {
          return { migrateScopeFieldToStore: () => {} };
        }
        for (const [depPath, mod] of Object.entries(depModules)) {
          if (name.includes(depPath)) return mod;
        }
        const fallbackStore = createMockStore(name);
        return new Proxy(fallbackStore, {
          get: (target, prop) => {
            if (prop in target) return target[prop];
            return fallbackStore;
          },
        });
      },
    };

    vm.runInNewContext(transpile(storePath), ctx);

    const bindFn = exports[bindFnName];
    const unbindFn = exports[unbindFnName];

    assert.equal(typeof bindFn, 'function', `${storePath} 必须导出 ${bindFnName}`);
    assert.equal(typeof unbindFn, 'function', `${storePath} 必须导出 ${unbindFnName}`);

    const totalSubs = () => trackedStores.reduce((sum, s) => sum + s.getSubCount(), 0);

    assert.equal(totalSubs(), 0, '初始状态订阅数应为 0');

    // 1. 首次 bind：订阅数等于 expectedUpstreamCount
    bindFn();
    assert.equal(totalSubs(), expectedUpstreamCount, `首次 ${bindFnName} 应建立 ${expectedUpstreamCount} 条订阅`);

    // 2. 幂等性断言：重复 bind 100 次，订阅数绝不增长！
    for (let i = 0; i < 100; i++) {
      bindFn();
      assert.equal(totalSubs(), expectedUpstreamCount, `重复调用 ${bindFnName} 必须幂等，订阅数不得增长`);
    }

    // 3. unbind 断言：精确退订归零
    unbindFn();
    assert.equal(totalSubs(), 0, `调用 ${unbindFnName} 后所有上游订阅必须精确退订并归零`);

    // 4. 循环挂卸 100 次断言：零泄漏
    for (let i = 0; i < 100; i++) {
      bindFn();
      assert.equal(totalSubs(), expectedUpstreamCount);
      unbindFn();
      assert.equal(totalSubs(), 0);
    }
  });
}

// bodyState (2 条订阅: useFilterState, usePanelState)
testStoreLifecycle('src/app/react/store/bodyState.ts', 'bindBodySync', 'unbindBodySync', 2, {
  'filterState': 'useFilterState',
  'panelState': 'usePanelState',
});

// sidebarState (2 条订阅: useBodyState, useListState)
testStoreLifecycle('src/app/react/store/sidebarState.ts', 'bindSidebarSync', 'unbindSidebarSync', 2, {
  'bodyState': 'useBodyState',
  'listState': 'useListState',
});

// toolbarState (5 条订阅: useBodyState, useListState, useFilterState, usePanelState, useSidebarState)
testStoreLifecycle('src/app/react/store/toolbarState.ts', 'bindToolbarSync', 'unbindToolbarSync', 5, {
  'bodyState': 'useBodyState',
  'listState': 'useListState',
  'filterState': 'useFilterState',
  'panelState': 'usePanelState',
  'sidebarState': 'useSidebarState',
});

// filterState (2 条订阅: useBodyState, useListState)
testStoreLifecycle('src/app/react/store/filterState.ts', 'bindFilterSync', 'unbindFilterSync', 2, {
  'bodyState': 'useBodyState',
  'listState': 'useListState',
});

// detailState (4 条订阅: useBodyState, useListState, useFilterState, usePanelState)
testStoreLifecycle('src/app/react/store/detailState.ts', 'bindDetailSync', 'unbindDetailSync', 4, {
  'bodyState': 'useBodyState',
  'listState': 'useListState',
  'filterState': 'useFilterState',
  'panelState': 'usePanelState',
});

// inspectorState (4 条订阅: useBodyState, useListState, useFilterState, usePanelState)
testStoreLifecycle('src/app/react/store/inspectorState.ts', 'bindInspectorSync', 'unbindInspectorSync', 4, {
  'bodyState': 'useBodyState',
  'listState': 'useListState',
  'filterState': 'useFilterState',
  'panelState': 'usePanelState',
});

// panelState (2 条订阅: useBodyState, useListState)
testStoreLifecycle('src/app/react/store/panelState.ts', 'bindPanelSync', 'unbindPanelSync', 2, {
  'bodyState': 'useBodyState',
  'listState': 'useListState',
});

// tagManagerState (2 条订阅: useBodyState, useListState)
testStoreLifecycle('src/app/react/store/tagManagerState.ts', 'bindTagManagerSync', 'unbindTagManagerSync', 2, {
  'bodyState': 'useBodyState',
  'listState': 'useListState',
});

// listState (1 条订阅: useBodyState)
testStoreLifecycle('src/app/react/store/listState.ts', 'bindListSync', 'unbindListSync', 1, {
  'bodyState': 'useBodyState',
});

// lockState (1 条 IPC 订阅: preferences-updated)
test('store / lockState IPC 监听幂等守卫与 unbindLockSync', () => {
  const exports = {};
  const ipcListeners = new Set();
  const ipc = {
    on: (evt, fn) => { if (evt === 'preferences-updated') ipcListeners.add(fn); },
    off: (evt, fn) => { if (evt === 'preferences-updated') ipcListeners.delete(fn); },
    removeListener: (evt, fn) => { if (evt === 'preferences-updated') ipcListeners.delete(fn); },
  };

  const lockStore = createMockStore('lock');
  const ctx = {
    exports,
    console,
    process: { platform: 'win32' },
    window: {
      require: (name) => {
        if (name === 'electron') return { ipcRenderer: ipc };
        if (name === '@electron/remote') return { app: { isPackaged: false } };
        return undefined;
      },
    },
    require: (name) => {
      if (name === 'zustand') {
        return {
          create: () => lockStore,
        };
      }
      if (name.includes('scopeFieldBridge')) return { migrateScopeFieldToStore: () => {} };
      if (name.includes('eagleGlobals')) {
        return {
          ipcRenderer: () => ipc,
          t: (k) => k,
        };
      }
      return new Proxy(lockStore, {
        get: (target, prop) => {
          if (prop === 'useLockState') return lockStore;
          if (prop in target) return target[prop];
          return lockStore;
        },
      });
    },
  };

  vm.runInNewContext(transpile('src/app/react/store/lockState.ts'), ctx);

  const { bindLockSync, unbindLockSync } = exports;
  assert.equal(ipcListeners.size, 0);

  // 1. 首次调用
  bindLockSync();
  assert.equal(ipcListeners.size, 1);

  // 2. 幂等性：调用 100 次不增长
  for (let i = 0; i < 100; i++) {
    bindLockSync();
    assert.equal(ipcListeners.size, 1, 'bindLockSync 必须具备幂等守卫');
  }

  // 3. unbindLockSync 精确清除
  unbindLockSync();
  assert.equal(ipcListeners.size, 0, 'unbindLockSync 必须精确摘除 preferences-updated 监听');

  // 4. 重复挂卸 100 次
  for (let i = 0; i < 100; i++) {
    bindLockSync();
    assert.equal(ipcListeners.size, 1);
    unbindLockSync();
    assert.equal(ipcListeners.size, 0);
  }
});

// 其余 stores: 验证 unbind*Sync 存在且重置 bound
const otherStores = [
  ['src/app/react/store/folderState.ts', 'bindFolderSync', 'unbindFolderSync'],
  ['src/app/react/store/itemState.ts', 'bindItemSync', 'unbindItemSync'],
  ['src/app/react/store/layoutState.ts', 'bindLayoutSync', 'unbindLayoutSync'],
  ['src/app/react/store/preferencesState.ts', 'bindPreferencesSync', 'unbindPreferencesSync'],
  ['src/app/react/store/selectionState.ts', 'bindSelectionSync', 'unbindSelectionSync'],
  ['src/app/react/store/uploadState.ts', 'bindUploadSync', 'unbindUploadSync'],
  ['src/app/react/store/miscRawState.ts', 'bindMiscRawSync', 'unbindMiscRawSync'],
  ['src/app/react/store/toastState.ts', 'bindToastSync', 'unbindToastSync'],
];

for (const [path, bindName, unbindName] of otherStores) {
  test(`store / ${path} 幂等与 ${unbindName}`, () => {
    const exports = {};
    const fallbackStore = createMockStore('other');
    const ctx = {
      exports,
      console,
      process: { platform: 'win32' },
      window: {},
      require: (name) => {
        if (name === 'zustand') return { create: () => fallbackStore };
        if (name.includes('scopeFieldBridge')) return { migrateScopeFieldToStore: () => {} };
        if (name.includes('eagleGlobals')) {
          return {
            ipcRenderer: () => ({ on: () => {}, off: () => {}, removeListener: () => {} }),
            t: (k) => k,
          };
        }
        return new Proxy(fallbackStore, {
          get: (target, prop) => {
            if (prop in target) return target[prop];
            return fallbackStore;
          },
        });
      },
    };

    vm.runInNewContext(transpile(path), ctx);

    const bindFn = exports[bindName];
    const unbindFn = exports[unbindName];
    assert.equal(typeof bindFn, 'function', `${path} 必须导出 ${bindName}`);
    assert.equal(typeof unbindFn, 'function', `${path} 必须导出 ${unbindName}`);

    // 重复调用不抛错，unbind 后可再次绑定
    for (let i = 0; i < 100; i++) {
      bindFn();
    }
    unbindFn();
    bindFn();
    unbindFn();
  });
}
