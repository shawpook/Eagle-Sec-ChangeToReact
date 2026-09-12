/**
 * cZ-2：主题/偏好域接管——preferences-updated 通道截肢 + React 处理器注册。
 *
 * - **preferences-updated**：bundle 处理器 = checkTouchIDSupport + $evalAsync。React 侧
 *   lockState（lockState.ts）本就自算 canUseTouchID 并自行监听本通道——截肢后由本模块
 *   重挂统一处理器：写 scope.canUseTouchID（bundle TouchID 流仍可读）+ 通知 lockState 刷新。
 * - **change.current.theme / update-preferences 暂不截肢**：bundle 处理器仍承担 RootController
 *   主题落点（owner 桥接后写入透明进 AppCore ✓）与 plugin 快捷键/菜单重初始化（未移植）；
> *   随 cZ 后续域（菜单/插件域）截肢。字段桥已扩容（preferences/vibrancyEnabled/canUseTouchID
 *   —— owner 溯源后 theme/preferences 落点正确）。
 */

import { amputateChannel, getBodyScope } from './appCore';
import { ipcRenderer } from '../global/eagleGlobals';
import { refreshTouchID } from '../store/lockState';
import { scopeEvalAsync } from './scopeRuntime';

function checkCanUseTouchID(): boolean {
  try {
    const w = window as any;
    if (w.process?.platform === 'darwin' && typeof w.require === 'function') {
      const systemPreferences = w.require('@electron/remote').systemPreferences;
      if (systemPreferences && typeof systemPreferences.canPromptTouchID === 'function') {
        return !!systemPreferences.canPromptTouchID();
      }
    }
  } catch (err) {
    console.error('檢查 Touch ID 支援時發生錯誤:', err);
  }
  return false;
}

let done = false;

export function takeoverPreferencesDomain(): void {
  if (done) return;
  done = true;
  const ipc = ipcRenderer();
  if (!ipc || typeof ipc.removeAllListeners !== 'function') return;

  // 截肢 preferences-updated：React 统一处理器（bundle 的 checkTouchIDSupport 消亡，
  // React lockState 接管；scope.canUseTouchID 同步写保持 bundle TouchID 流可读）
  const reattach = amputateChannel(ipc, 'preferences-updated');
  if (reattach) {
    reattach(function () {
      const s = getBodyScope();
      if (s) {
        s.canUseTouchID = checkCanUseTouchID();
        scopeEvalAsync();
      }
      refreshTouchID();
    });
  }
}
