import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../electron/preload.cjs', import.meta.url), 'utf8');

// 刻意让每次跨边界的函数成为新代理，验证清理不依赖代理身份缓存。
// 这是 contextBridge 契约的保守模拟，不是 Electron 集成测试。
function proxyAcross(value) {
  if (typeof value === 'function') {
    return (...args) => proxyAcross(value(...args.map(proxyAcross)));
  }
  if (Array.isArray(value)) return value.map(proxyAcross);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, proxyAcross(item)]));
  }
  return value;
}

function loadPreload(mode = 'direct') {
  const ipcRenderer = new EventEmitter();
  const window = {};
  const contextBridge = mode === 'absent' ? undefined : {
    exposeInMainWorld(key, api) {
      if (mode === 'throws') throw new Error('模拟桥不可用');
      window[key] = mode === 'proxied' ? proxyAcross(api) : api;
    },
  };
  const context = vm.createContext({
    window,
    process: { env: {} },
    require(name) {
      assert.equal(name, 'electron');
      return { contextBridge, ipcRenderer };
    },
  });
  vm.runInContext(source, context, { filename: 'electron/preload.cjs' });
  return {
    api: window.eagleDesktop,
    ipcRenderer,
    assertMapEmpty() {
      assert.equal(vm.runInContext('subscriptions.size', context), 0, '订阅映射不得残留');
    },
    assertEmpty() {
      assert.equal(ipcRenderer.eventNames().length, 0, '原生监听必须清空');
      assert.equal(vm.runInContext('subscriptions.size', context), 0, '订阅映射不得残留');
    },
  };
}

const namedChannels = [
  ['library.onChanged', 'library:changed'],
  ['library.onOperationResult', 'library:operation-result'],
  ['preview.onInit', 'preview:init'],
  ['item.onOperationResult', 'item:operation-result'],
  ['onRebindRefresh', 'rebind-refresh', false],
  ['import.onFileProgress', 'import-file-progress'],
  ['import.onFolderProgress', 'import-folder-progress'],
  ['export.onProgress', 'export:progress'],
  ['export.onComplete', 'export:complete'],
  ['export.onError', 'export:error'],
  ['window.onStateChanged', 'window:state-changed'],
];

function getMethod(api, path) {
  return path.split('.').reduce((value, key) => value[key], api);
}

test('具名 on 清单覆盖全部公开订阅入口', () => {
  const { api } = loadPreload();
  const found = [];
  function visit(object, prefix = '') {
    for (const [key, value] of Object.entries(object)) {
      const path = prefix + key;
      if (typeof value === 'function' && /^on[A-Z]/.test(key)) found.push(path);
      else if (value && typeof value === 'object') visit(value, `${path}.`);
    }
  }
  visit(api);
  assert.deepEqual(found.sort(), ['onIpc', ...namedChannels.map(([path]) => path)].sort());
});

for (const mode of ['direct', 'proxied', 'absent', 'throws']) {
  for (const path of ['onIpc', 'ipc.on']) {
    test(`${mode} / ${path}：100 次订退和重复 disposal`, () => {
      const { api, ipcRenderer, assertEmpty } = loadPreload(mode);
      const subscribe = getMethod(api, path);
      let calls = 0;
      for (let index = 0; index < 100; index++) {
        const payload = { index };
        const dispose = subscribe('test:on', (...args) => {
          assert.deepEqual(args, [payload], '仅传一个 payload，不暴露事件对象或额外参数');
          calls++;
        });
        assert.equal(typeof dispose, 'function');
        assert.equal(ipcRenderer.listenerCount('test:on'), 1);
        ipcRenderer.emit('test:on', { sender: '不得暴露' }, payload, '忽略额外参数');
        dispose();
        dispose();
        ipcRenderer.emit('test:on', {}, payload);
        assert.equal(calls, index + 1);
        assertEmpty();
      }
    });
  }
}

for (const mode of ['direct', 'proxied']) {
  for (const [path, channel, withPayload = true] of namedChannels) {
    test(`${mode} / ${path}：100 次订退，保留载荷形状`, () => {
      const { api, ipcRenderer, assertEmpty } = loadPreload(mode);
      let calls = 0;
      for (let index = 0; index < 100; index++) {
        const dispose = getMethod(api, path)((...args) => {
          assert.deepEqual(args, withPayload ? [{ index }] : []);
          calls++;
        });
        assert.equal(typeof dispose, 'function');
        assert.equal(ipcRenderer.listenerCount(channel), 1);
        ipcRenderer.emit(channel, { sender: '不得暴露' }, { index });
        dispose();
        dispose();
        ipcRenderer.emit(channel, {}, { index });
        assert.equal(calls, index + 1);
        assertEmpty();
      }
    });
  }
}

for (const method of ['off', 'removeListener']) {
  test(`${method}：多 callback、重复注册及跨 channel 精确移除`, () => {
    const { api, ipcRenderer, assertEmpty } = loadPreload();
    const seen = [];
    const callback = (value) => seen.push(['a', value]);
    const peer = (value) => seen.push(['b', value]);
    const first = api.ipc.on('first', callback);
    const second = api.ipc.on('first', callback);
    const other = api.ipc.on('first', peer);
    const cross = api.ipc.on('second', callback);
    api.ipc[method]('first', callback);
    assert.equal(ipcRenderer.listenerCount('first'), 2, '仅移除最近一次同 callback 注册');
    second();
    assert.equal(ipcRenderer.listenerCount('first'), 2, '已移除的 disposer 必须幂等');
    api.ipc[method]('first', () => {});
    api.ipc[method]('missing', callback);
    ipcRenderer.emit('first', {}, 1);
    ipcRenderer.emit('second', {}, 2);
    assert.deepEqual(seen, [['a', 1], ['b', 1], ['a', 2]]);
    first();
    other();
    cross();
    assertEmpty();
  });
}

test('once：100 次消费，先清理映射，旧 disposer 不误删新 on', () => {
  const { api, ipcRenderer, assertEmpty } = loadPreload();
  let calls = 0;
  const callback = () => { calls++; };
  for (let index = 0; index < 100; index++) {
    const dispose = api.ipc.once('once', callback);
    assert.equal(typeof dispose, 'function');
    ipcRenderer.emit('once', {}, index);
    ipcRenderer.emit('once', {}, index);
    assert.equal(calls, index + 1);
    assertEmpty();
    const next = api.ipc.on('once', callback);
    dispose();
    dispose();
    assert.equal(ipcRenderer.listenerCount('once'), 1);
    next();
    assertEmpty();
  }
});

for (const method of ['disposer', 'off', 'removeListener']) {
  test(`once 未触发取消 / ${method}：100 次且不影响同 callback 的 on`, () => {
    const { api, ipcRenderer, assertEmpty } = loadPreload();
    let calls = 0;
    const callback = () => { calls++; };
    for (let index = 0; index < 100; index++) {
      const persistent = api.ipc.on('once', callback);
      const dispose = api.ipc.once('once', callback);
      if (method === 'disposer') dispose();
      else api.ipc[method]('once', callback);
      dispose();
      assert.equal(ipcRenderer.listenerCount('once'), 1);
      ipcRenderer.emit('once', {}, index);
      assert.equal(calls, index + 1);
      persistent();
      assertEmpty();
    }
  });
}

test('once：重入和抛错均不重复执行或残留映射', () => {
  const { api, ipcRenderer, assertEmpty } = loadPreload();
  let calls = 0;
  const dispose = api.ipc.once('once', () => {
    calls++;
    assertEmpty();
    ipcRenderer.emit('once', {}, '重入');
    throw new Error('预期 callback 异常');
  });
  assert.throws(() => ipcRenderer.emit('once', {}, 1), /预期 callback 异常/);
  assert.equal(calls, 1);
  dispose();
  assertEmpty();
});

for (const mode of ['direct', 'proxied']) {
  test(`removeAll / ${mode}：仅清理本桥，保留外部监听且旧句柄安全`, () => {
    const { api, ipcRenderer, assertMapEmpty, assertEmpty } = loadPreload(mode);
    let externalCalls = 0;
    const callback = () => { externalCalls++; };
    const named = api.preview.onInit(callback);
    const pending = api.ipc.once('preview:init', callback);
    api.onIpc('other', callback);
    ipcRenderer.on('preview:init', callback);
    ipcRenderer.on('other', callback);
    ipcRenderer.on('external-only', callback);
    api.ipc.removeAllListeners('preview:init');
    assert.deepEqual(ipcRenderer.listeners('preview:init'), [callback]);
    assert.equal(ipcRenderer.listenerCount('other'), 2);
    const replacement = api.preview.onInit(callback);
    named();
    pending();
    assert.equal(ipcRenderer.listenerCount('preview:init'), 2);
    api.ipc.removeAllListeners();
    api.ipc.removeAllListeners();
    api.ipc.removeAllListeners('external-only');
    assertMapEmpty();
    for (const channel of ['preview:init', 'other', 'external-only']) {
      assert.deepEqual(ipcRenderer.listeners(channel), [callback]);
      ipcRenderer.emit(channel, {}, 1);
    }
    assert.equal(externalCalls, 3);
    const newest = api.ipc.once('preview:init', callback);
    replacement();
    assert.equal(ipcRenderer.listenerCount('preview:init'), 2);
    newest();
    assertMapEmpty();
    for (const channel of ['preview:init', 'other', 'external-only']) ipcRenderer.off(channel, callback);
    assertEmpty();
  });
}

test('派发快照中的已取消 callback 不在卸载后执行', () => {
  const { api, ipcRenderer, assertEmpty } = loadPreload();
  const seen = [];
  const first = api.ipc.on('event', () => {
    seen.push('first');
    disposeLater();
  });
  const disposeLater = api.ipc.on('event', () => seen.push('已取消'));
  const last = api.ipc.on('event', () => seen.push('last'));
  ipcRenderer.emit('event', {}, 1);
  assert.deepEqual(seen, ['first', 'last']);
  first();
  last();
  assertEmpty();
});

test('跨桥身份变化：100 次 once 取消，仅 disposer 清理对应注册', () => {
  const { api, ipcRenderer, assertEmpty } = loadPreload('proxied');
  let calls = 0;
  const callback = () => { calls++; };
  for (let index = 0; index < 100; index++) {
    const peer = api.ipc.on('event', callback);
    const dispose = api.ipc.once('event', callback);
    // 新代理没有稳定身份：off 不得猜测并删掉任意其他订阅。
    api.ipc.off('event', callback);
    assert.equal(ipcRenderer.listenerCount('event'), 2);
    dispose();
    dispose();
    assert.equal(ipcRenderer.listenerCount('event'), 1);
    ipcRenderer.emit('event', {}, index);
    assert.equal(calls, index + 1);
    peer();
    assertEmpty();
  }
});

test('无效 callback 在注册时拒绝且不残留监听', () => {
  const { api, assertEmpty } = loadPreload();
  assert.throws(() => api.ipc.on('event', null), /callback must be a function/);
  assertEmpty();
});
