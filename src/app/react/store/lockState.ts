import { create } from 'zustand';
import { ipcRenderer } from '../global/eagleGlobals';
import { migrateScopeFieldToStore } from '../global/scopeShim';
import { getBodyScope } from '../core/appCore';

/**
 * 11-pre a3：lock-screen 双块状态源（文件夹密码锁 + 应用锁屏）。
 *
 * - isAppLocked 在 $rootScope（RootController 启动按 privacy.enable 判定、lockApp 置真、
 *   解锁路径置假）；folder 锁定态 = currentFolder.password && !isUnLock。
 *   全部走 scope 快照（digest 驱动，与原 ng-show/ng-if 同源同语义）。
 * - 输入/校验/解锁数据流保留 bundle 原逻辑（unlockPasswordKeyup / unlockAppPasswordKeyup /
 *   focus* / TouchID 处理器经 callScope 调用）；React 输入框**保留原 id**（C 模式，同
 *   background-state-spinner 先例）——bundle 的 $("#lock-password-input") shake/focus 与
 *   $("#app-lock-password-input") val/focus/blur 重聚焦循环继续作用于 React 渲染的节点。
 * - canUseTouchID：bundle 29001-29009 逐字（darwin + systemPreferences.canPromptTouchID），
 *   React 侧自算；'preferences-updated' 时重算（同 bundle 29107）。
 */

interface LockState {
  isAppLocked: boolean;
  folderLocked: boolean;
  folderPasswordTips: string;
  canUseTouchID: boolean;
}

export const useLockState = create<LockState>(() => ({
  isAppLocked: false,
  folderLocked: false,
  folderPasswordTips: '',
  canUseTouchID: false,
}));

/** bundle checkTouchIDSupport（29003-29009）逐字等价。 */
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

// b1-9az R1-batch2：isAppLocked 源翻转——$root 即 proxy 自指，scope 侧
// `s.$root.isAppLocked = x` 经同一 set 陷阱落本 store。folderLocked/folderPasswordTips
// 为 currentFolder 嵌套派生，b1-9by-A 起由写入点直调 syncFolderLock 驱动。
// 同值守卫同 bodyState（b1-9az 批 1 教训）。
migrateScopeFieldToStore(
  'isAppLocked',
  () => useLockState.getState().isAppLocked,
  (value: any) => {
    if (useLockState.getState().isAppLocked !== value) useLockState.setState({ isAppLocked: !!value });
  },
);

/**
 * b1-9by-A：folderLocked/folderPasswordTips 直写收敛——currentFolder 对象替换
 * （dataMachinery/controllerFns/libraryDomain/folderMenuService/batchOpsService）与
 * isUnLock 写点调用（原 200ms 轮询快照退役）。
 */
export function syncFolderLock(): void {
  const s: any = getBodyScope();
  if (!s) return;
  const cf = s.currentFolder;
  const locked = !!(cf && cf.password && !cf.isUnLock);
  const tips = (cf && cf.passwordTips) || '';
  const cur = useLockState.getState();
  if (cur.folderLocked !== locked || cur.folderPasswordTips !== tips) {
    useLockState.setState({ folderLocked: locked, folderPasswordTips: tips });
  }
}

export function bindLockSync(): void {
  // 供闭环测试（CDP Runtime.evaluate）直接访问 React 全局状态，不参与业务逻辑。
  (window as any).__eagleLockState = useLockState;
  // 供闭环测试直写 scope 后手动驱动（原 $evalAsync 触发快照链的等价物）。
  (window as any).__eagleLockSync = syncFolderLock;

  // b1-9by-A：startScopeSync 退役——保留一次性对齐，后续由写入点直调驱动。
  syncFolderLock();

  useLockState.setState({ canUseTouchID: checkCanUseTouchID() });

  // bundle 29107-29111：偏好变更后动态更新 Touch ID 支援状态
  const ipc = ipcRenderer();
  if (ipc && typeof ipc.on === 'function') {
    ipc.on('preferences-updated', () => {
      useLockState.setState({ canUseTouchID: checkCanUseTouchID() });
    });
  }
}

/** cZ-2：preferences-updated 截肢后的重挂入口（preferencesDomain 调用）。 */
export function refreshTouchID(): void {
  useLockState.setState({ canUseTouchID: checkCanUseTouchID() });
}
