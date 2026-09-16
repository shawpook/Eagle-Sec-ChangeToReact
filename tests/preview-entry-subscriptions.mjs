import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

function loadModule(path, imports, globals = {}, source = readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')) {
  const { outputText, diagnostics } = ts.transpileModule(source, {
    fileName: path,
    reportDiagnostics: true,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  });
  assert.equal(diagnostics.length, 0, `${path} 转译应无诊断`);
  const exports = {};
  vm.runInNewContext(outputText, {
    ...globals,
    exports,
    require(name) {
      assert.ok(Object.hasOwn(imports, name), `禁止加载未隔离的依赖：${name}`);
      return imports[name];
    },
  }, { filename: path });
  return exports;
}

// 只执行实际 shim 的 EventEmitter 类，不执行其模块级路由、计时器或回程注册。
const shimPath = 'src/app/react/core/shim/ipcBus.ts';
const shimSource = readFileSync(new URL(`../${shimPath}`, import.meta.url), 'utf8');
const shimAst = ts.createSourceFile(shimPath, shimSource, ts.ScriptTarget.Latest, true);
const shimClass = shimAst.statements.find((node) => ts.isClassDeclaration(node) && node.name?.text === 'EventEmitter');
assert.ok(shimClass, '必须测试实际 shim 的 EventEmitter 类');
const { EventEmitter: ShimEmitter } = loadModule(shimPath, {}, { console }, shimClass.getText(shimAst));

function createBus(kind) {
  const bus = kind === 'shim' ? new ShimEmitter() : new EventEmitter();
  return {
    bus,
    count: () => kind === 'shim' ? (bus.listeners.get('init') || []).length : bus.listenerCount('init'),
    emit: (params) => kind === 'shim' ? bus.emit('init', params) : bus.emit('init', {}, params),
  };
}

function loadBridge(window) {
  return loadModule('src/app/react/core/channelBridge.ts', {
    './ipcWriteState': { getIpcWriteState: () => assert.fail('本测试不得进入写库路径') },
    './settings': {},
    './scopeFace': {},
  }, { window });
}

function loadEntry(ipc, { deferController = false, bridge } = {}) {
  const effects = [];
  const applied = [];
  const installers = [];
  // M1-F04 的顺序不变式：entry.tsx 在 createRoot **之前**必须已校验 boot 全局到位。
  // 这里按调用序记录，用来断言「assertPreviewBootInstalled 先于 createRoot」——只记录不 stub 实现，
  // 因此不放松本文件「禁止加载未隔离的依赖」的判据（./boot 仍是受控替身，见下方 imports）。
  const order = [];
  const events = new EventEmitter();
  const window = {
    __eagleIpc: ipc,
    require: (name) => name === 'electron' ? { ipcRenderer: ipc } : undefined,
    addEventListener: (name, callback) => events.on(name, callback),
    removeEventListener: (name, callback) => events.off(name, callback),
  };
  loadModule('src/app/react/preview-window/entry.tsx', {
    '../core/shimsLegacy': {},
    'react-dom/client': {
      createRoot: () => { order.push('createRoot'); return { render: (element) => element.type() }; },
    },
    react: { useEffect: (effect) => effects.push(effect) },
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }) },
    './shell': { default: () => null },
    './boot': { assertPreviewBootInstalled: () => { order.push('boot'); } },
    './controller': { applyController: (callback) => callback({ runInitSequence: (params) => applied.push(params) }) },
    '../core/keymap': { installKeymap: () => installers.push('keymap') },
    '../core/tippyLite': { installTippy: () => installers.push('tippy') },
    '../core/shortcutManager': { installShortcutManager: () => installers.push('shortcut') },
  }, {
    window,
    document: { getElementById: (id) => id === 'eagle-preview-react-host' ? {} : null },
  });
  assert.deepEqual(installers, ['keymap', 'tippy', 'shortcut']);
  assert.equal(effects.length, 1);
  // F04 引入：boot 校验必须发生，且必须早于 createRoot。顺序反了就等于把半装状态放进 React 树。
  assert.deepEqual(order, ['boot', 'createRoot'], 'boot 校验必须先于 createRoot');
  return { mount: effects[0], window, applied };
}

for (const kind of ['node', 'shim']) {
  for (const mode of ['disposer', 'void-off', 'void-removeListener', 'emitter']) {
    test(`preview / ${kind} / ${mode}：100 次挂卸、精确清理与迟到 callback 防护`, () => {
      const { bus, count, emit } = createBus(kind);
      const callbacks = [];
      let removals = 0;
      let peerCalls = 0;
      const peer = () => { peerCalls++; };
      bus.on('init', peer);
      const ipc = {
        on(channel, callback) {
          callbacks.push(callback);
          bus.on(channel, callback);
          if (mode === 'disposer') return () => {
            assert.equal(entry.window.__eaglePreviewEntryReady, false, '先取消就绪，再退订');
            removals++;
            bus.off(channel, callback);
            callback({}, { late: true });
          };
          if (mode === 'emitter') return bus;
          return undefined;
        },
        ...(mode === 'void-removeListener' ? {
          removeListener(channel, callback) { removals++; bus.off(channel, callback); },
        } : {
          off(channel, callback) {
            assert.notEqual(mode, 'disposer', '有 disposer 时不得再次依赖 callback 身份');
            removals++;
            bus.off(channel, callback);
          },
        }),
        removeAllListeners() { assert.fail('不得清空其他消费者的 init 订阅'); },
      };
      const entry = loadEntry(ipc);
      for (let index = 0; index < 100; index++) {
        const unmount = entry.mount();
        assert.equal(typeof unmount, 'function');
        assert.equal(entry.window.__eaglePreviewEntryReady, true);
        assert.equal(count(), 2);
        const payload = { index, images: [] };
        emit(payload);
        assert.equal(entry.applied.length, index + 1);
        assert.equal(entry.applied[index], payload, '保留 init 的 event/payload 两参语义');
        unmount();
        unmount();
        assert.equal(entry.window.__eaglePreviewEntryReady, false);
        assert.equal(count(), 1, '仅保留其他消费者');
        assert.equal(removals, index + 1, '清理必须幂等');
        emit({ late: true });
        callbacks[index]({}, { late: true });
        if (index > 0) callbacks[index - 1]({}, { oldMount: true });
        assert.equal(entry.applied.length, index + 1, '卸载后的回调不得再初始化');
      }
      assert.equal(peerCalls, 200);
      bus.off('init', peer);
      assert.equal(count(), 0);
    });
  }

  test(`preview / ${kind}：派发途中卸载，快照内 init 不再修改 controller`, () => {
    const { bus, count, emit } = createBus(kind);
    let unmount;
    const first = () => unmount();
    bus.on('init', first);
    const entry = loadEntry(bus);
    unmount = entry.mount();
    assert.equal(count(), 2);
    emit({ images: [] });
    assert.equal(entry.applied.length, 0);
    assert.equal(count(), 1);
    assert.equal(entry.window.__eaglePreviewEntryReady, false);
    bus.off('init', first);
    assert.equal(count(), 0);
  });
}

test('preview：IPC 尚不存在时卸载仍清除就绪标记', () => {
  const entry = loadEntry(undefined);
  const unmount = entry.mount();
  assert.equal(entry.window.__eaglePreviewEntryReady, true);
  unmount();
  assert.equal(entry.window.__eaglePreviewEntryReady, false);
  assert.equal(entry.applied.length, 0);
});

test('channelBridge：保留 shim 事件面和原生发送单路由，不切换 init 订阅源', async () => {
  const { bus, count, emit } = createBus('shim');
  const sent = [];
  bus.send = (...args) => sent.push(['shim', ...args]);
  bus.sendTo = (...args) => sent.push(['shimTo', ...args]);
  bus.invoke = (...args) => ['shimInvoke', ...args];
  const window = {
    __eagleIpc: bus,
    eagleDesktop: {
      ipc: {
        send: (...args) => sent.push(['native', ...args]),
        sendTo: () => assert.fail('sendTo 必须保持原有忽略目标 id 的发送语义'),
        on: () => assert.fail('事件面不得切到原生 IPC'),
        once: () => assert.fail('事件面不得切到原生 IPC'),
        invoke: () => assert.fail('已有 shim invoke 时不得切换路由'),
      },
      preview: { open: (payload) => { sent.push(['preview', payload]); return Promise.resolve({ ok: true }); } },
    },
  };
  const { getIpcBus } = loadModule('src/app/react/core/channelBridge.ts', {
    './ipcWriteState': { getIpcWriteState: () => assert.fail('本测试不得进入写库路径') },
    './settings': {},
    './scopeFace': {},
  }, { window });
  const facade = getIpcBus();
  assert.equal(getIpcBus(), facade);
  const entry = loadEntry(facade);
  for (let index = 0; index < 100; index++) {
    const unmount = entry.mount();
    emit({ index });
    unmount();
    assert.equal(count(), 0);
    assert.equal(entry.applied.length, index + 1);
  }
  let onceCalls = 0;
  facade.once('probe', () => { onceCalls++; });
  facade.emit('probe', 1);
  facade.emit('probe', 2);
  assert.equal(onceCalls, 1);
  facade.send('update-txt-item', 'a');
  facade.sendTo(42, 'duplicate-file', 'b');
  facade.send('unmigrated', 'c');
  facade.sendTo(43, 'unmigrated', 'd');
  assert.deepEqual(facade.invoke('probe', 1), ['shimInvoke', 'probe', 1]);
  let resultCalls = 0;
  const onResult = (_event, result) => { assert.equal(result.ok, true); resultCalls++; };
  facade.on('preview:operation-result', onResult);
  facade.send('open-preview-window', { images: [{ id: 'one' }, {}] });
  // 跨 vm 的 Promise 同化会增加微任务；等待本轮完整排空，不依赖微任务数量。
  await new Promise(setImmediate);
  facade.off('preview:operation-result', onResult);
  assert.equal(resultCalls, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(sent)), [
    ['native', 'update-txt-item', 'a'],
    ['native', 'duplicate-file', 'b'],
    ['shim', 'unmigrated', 'c'],
    ['shimTo', 43, 'unmigrated', 'd'],
    ['preview', { images: [{ id: 'one' }] }],
  ]);
  delete window.eagleDesktop;
  facade.send('update-txt-item', 'browser');
  assert.deepEqual(sent.at(-1), ['shim', 'update-txt-item', 'browser']);
});
