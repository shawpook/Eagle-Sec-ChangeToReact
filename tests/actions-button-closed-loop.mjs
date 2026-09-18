/**
 * 探针：ai-action 点击后为何无提示。逐步验证 pluginModule 的可用性。
 */
import { bootWithItem } from './closed-loop-common.mjs';
import { stop } from './react-cdp-harness.mjs';

const ctx = await bootWithItem('actdiag');
const { ev, delay } = ctx;
const out = {};

try {
  // 1. pluginModule 真身状态
  out.pmKeys = await ev(`(() => {
    const pm = window.pluginModule;
    if (!pm) return 'undefined';
    return { isObject: typeof pm === 'object', mapKeys: Object.keys(pm).slice(0, 25) };
  })()`);
  out.pmFromStore = await ev(`(() => {
    const pm = window.__eagleMiscRawState?.getState?.()?.pluginModule;
    return pm ? Object.keys(pm).slice(0, 15) : 'none';
  })()`);

  // 2. checkPluginInstalled 实调
  out.check = await ev(`(() => {
    try { return window.pluginModule.checkPluginInstalled('ai-action'); }
    catch (e) { return 'THROW: ' + e.message; }
  })()`);
  out.installedMaps = await ev(`(() => {
    try { return Object.keys(window.pluginModule.installedPluginMaps || {}); }
    catch (e) { return 'THROW: ' + e.message; }
  })()`);

  // 3. 手动跑一遍 open 链路，看每步返回
  out.manualOpen = await ev(`(() => {
    const log = [];
    try {
      log.push('pluginModule=' + typeof window.pluginModule);
      log.push('eagle.action=' + typeof window.eagle?.action);
      log.push('open=' + typeof window.eagle?.action?.open);
      const inst = window.pluginModule.checkPluginInstalled('ai-action');
      log.push('installed=' + inst);
      if (!inst) {
        log.push('showInstallPluginDialog=' + typeof window.pluginModule.showInstallPluginDialog);
        // 直接调，看是否抛错
        try { window.pluginModule.showInstallPluginDialog('ai-action'); log.push('dialog-called'); }
        catch (e) { log.push('dialog THROW: ' + e.message); }
      }
    } catch (e) { log.push('OUTER THROW: ' + e.message); }
    return log;
  })()`);
  await delay(1200);
  out.dialogAfterManual = await ev(`(() => {
    const c = document.querySelector('.swal2-container, .swal-modal, .swal-overlay');
    return c ? (c.textContent || '').trim().slice(0, 150) : 'no-dialog';
  })()`);
  out.swalCalls = await ev(`window.__swalCalls || 'no-hook'`);
} catch (err) {
  out.fatal = err.message;
}

console.log(JSON.stringify(out, null, 2));
await stop(ctx.stack.electron);
await stop(ctx.stack.vite);
process.exit(0);
