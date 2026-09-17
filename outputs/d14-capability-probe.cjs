/**
 * D14 取证脚本（一次性，不是门禁）。
 *
 * 要回答两个问题（见 docs/audit-verification-2026-09-17.md R1-3 与本整改记录 §3.2）：
 *   1. Electron 渲染层里 nativeRequire('http') 到底能不能用？
 *      决定 http/https/JsonRestServer 应保持「显式失败」还是可以「接线」。
 *   2. 主进程 app.getPath('userData') 在真实 Electron 下能否取到真值？
 *      决定 R1-2 新增的同步 IPC 通道是否真的消除了 /mock-user-data 伪造路径。
 *
 * 关键点：渲染层窗口必须使用与生产一致的 webPreferences
 * （nodeIntegration:true / contextIsolation:false / sandbox:false），
 * 否则取证结果没有意义。
 *
 * 用法（工作区根目录，普通终端）：
 *   npx electron outputs/d14-capability-probe.cjs
 */
'use strict';

const { app, BrowserWindow, ipcMain } = require('electron');

const MODULES = ['http', 'https', 'net', 'node:os', 'node:fs', 'path', 'child_process', 'electron'];

function main() {
  // 问题 2：主进程侧的真值（在窗口创建之前取，避免任何依赖）
  const mainPaths = {};
  for (const name of ['userData', 'temp', 'home', 'appData', 'documents']) {
    try {
      mainPaths[name] = app.getPath(name);
    } catch (err) {
      mainPaths[name] = `ERROR: ${err && err.message ? err.message : err}`;
    }
  }

  // 问题 3（R1-2 闭环）：与 electron/main.cjs 里新增的通道**同一份实现**，
  // 验证「渲染层 sendSync → main handler → 真值回程」这条链路真的通。
  ipcMain.on('app:get-path', (event, name) => {
    try {
      const value = typeof name === 'string' ? app.getPath(name) : '';
      event.returnValue = typeof value === 'string' ? value : '';
    } catch (err) {
      event.returnValue = '';
    }
  });

  const win = new BrowserWindow({
    show: false,
    width: 400,
    height: 300,
    // 与生产一致（R4-4 收敛前保持现状，见 electron-main-gates 的安全面快照）
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      sandbox: false,
      webviewTag: true,
    },
  });

  win.loadURL('about:blank').then(async () => {
    // executeJavaScript 跑在主世界，nodeIntegration 打开时 require 应可用
    const probe = `JSON.stringify((function () {
      var out = {};
      var mods = ${JSON.stringify(MODULES)};
      for (var i = 0; i < mods.length; i++) {
        var m = mods[i];
        try {
          var mod = require(m);
          out[m] = { ok: true, type: typeof mod, sample: Object.keys(mod || {}).slice(0, 4) };
        } catch (e) {
          out[m] = { ok: false, error: String((e && e.message) || e).slice(0, 160) };
        }
      }
      // R1-2 闭环：渲染层经同步 IPC 向主进程要真值（与 shim desktopCapability 同型）
      out.__ipc = {};
      try {
        var ipc = require('electron').ipcRenderer;
        out.__ipc.userData = ipc.sendSync('app:get-path', 'userData');
        out.__ipc.temp = ipc.sendSync('app:get-path', 'temp');
        out.__ipc.emptyName = ipc.sendSync('app:get-path', '');
        out.__ipc.badName = ipc.sendSync('app:get-path', '__no_such_path__');
      } catch (e) {
        out.__ipc = { __failed: String((e && e.message) || e).slice(0, 160) };
      }
      out.__meta = {
        hasRequire: typeof require === 'function',
        hasProcess: typeof process === 'object',
        nodeIntegration: typeof require === 'function',
        platform: (typeof process === 'object') ? process.platform : 'n/a',
        versions: (typeof process === 'object' && process.versions) ? {
          node: process.versions.node, electron: process.versions.electron, chrome: process.versions.chrome
        } : null,
      };
      return out;
    })())`;

    let renderer = null;
    try {
      renderer = JSON.parse(await win.webContents.executeJavaScript(probe));
    } catch (err) {
      renderer = { __probeFailed: String((err && err.message) || err) };
    }

    console.log('D14_PROBE_BEGIN');
    console.log(JSON.stringify({ mainPaths, renderer }, null, 2));
    console.log('D14_PROBE_END');
    app.quit();
  });
}

app.whenReady().then(main).catch((err) => {
  console.error('D14_PROBE_FAILED', err);
  app.exit(1);
});
