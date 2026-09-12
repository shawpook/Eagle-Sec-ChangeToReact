import { create } from 'zustand';
import { ipcRenderer, t } from '../global/eagleGlobals';

import { useMiscRawState } from './miscRawState';

/**
 * 11-pre a1：upload-queue-progress / saving-progress-bar 状态源。
 *
 * - 上传队列条走 scope 快照（bundle 的 uploadFiles / 'file-uploaded' / cancelAllTasks /
 *   watchCollection 完成路径仍维护 uploadQueue/finishQueue/progress/addImageTimeLeftInSeconds，
 *   digest 驱动同步——与原模板 ng-show/ng-class 绑定同源同语义）。
 * - 保存进度条走 'background-state' ipc（原 bundle 23386-23396 在 rAF 里 jQuery 直控，
 *   此处等价转写 metadataQueueLength 分支；palette/download 计数与 heartbeat 留在 bundle）。
 *   注意 bundle 的 'app-status-loading' 处理器（22734）会 removeAllListeners('background-state')
 *   做库重载清理——React 侧监听必须自愈：监听 app-status-loading 并在其后重挂（setTimeout
 *   跳出同一轮监听器链），否则首库加载后保存条永久失聪。
 * - index.html 原模板位删除后，bundle 的 $("#upload-queue-progress"/"#saving-progress-bar")
 *   直控变空集 no-op，UI 单一归属 React（组件不使用原 id）。
 */

interface UploadState {
  queueLength: number;
  finishCount: number;
  /** 单文件模式（uploadQueue.length == 1）进度 0..1（update-progress ipc 写 scope.progress）。 */
  progress: number;
  /** addImageTimeLeftInSeconds（秒；0 = 隐藏 remain，ng-show 语义）。 */
  timeLeft: number;
  savingOpen: boolean;
  savingMessage: string;
  set: (partial: Partial<UploadState>) => void;
}

export const useUploadState = create<UploadState>((set) => ({
  queueLength: 0,
  finishCount: 0,
  progress: 0,
  timeLeft: 0,
  savingOpen: false,
  savingMessage: '',
  set: (partial) => set(partial),
}));

/** Angular number filter（fractionSize=0）等价：千分位分组整数。 */
function number0(value: number): string {
  return Number(value).toLocaleString('en-US');
}

const backgroundStateHandler = (_e: unknown, state: any) => {
  const savingNumber =
    state && typeof state.metadataQueueLength === 'number' ? state.metadataQueueLength : 0;
  if (savingNumber > 3) {
    useUploadState.getState().set({
      savingOpen: true,
      savingMessage: t('progress.savingFiles.msg', [
        { property: 'count', value: number0(savingNumber) },
      ]),
    });
  } else {
    useUploadState.getState().set({ savingOpen: false });
  }
};

function attachBackgroundState(): void {
  const ipc = ipcRenderer();
  if (!ipc || typeof ipc.on !== 'function') return;
  // 重挂前先摘旧监听，避免 app-status-loading 反复触发导致处理器累积。
  if (typeof ipc.removeListener === 'function') ipc.removeListener('background-state', backgroundStateHandler);
  else if (typeof ipc.off === 'function') ipc.off('background-state', backgroundStateHandler);
  ipc.on('background-state', backgroundStateHandler);
}

/**
 * b1-9by-A：上传四字段直写收敛——uploadQueue/finishQueue（push/splice/重置）、
 * progress（update-progress ipc）、addImageTimeLeftInSeconds 写入点调用
 * （原 200ms 轮询快照退役；ProgressDialogs 的 rootRef.* 为组件本地态不经此）。
 */
export function syncUploadFromScope(): void {
  useUploadState.getState().set({
    queueLength: (useMiscRawState.getState().uploadQueue && useMiscRawState.getState().uploadQueue.length) || 0,
    finishCount: (useMiscRawState.getState().finishQueue && useMiscRawState.getState().finishQueue.length) || 0,
    progress: typeof useMiscRawState.getState().progress === 'number' ? useMiscRawState.getState().progress : 0,
    timeLeft: useMiscRawState.getState().addImageTimeLeftInSeconds || 0,
  });
}

let bound = false;

export function bindUploadSync(): void {
  if (bound) return;
  bound = true;

  // 供闭环测试（CDP Runtime.evaluate）直接访问 React 全局状态，不参与业务逻辑。
  (window as any).__eagleUploadState = useUploadState;
  // 供闭环测试直写 scope 后手动驱动（原 $evalAsync 触发快照链的等价物）。
  (window as any).__eagleUploadSync = syncUploadFromScope;

  // b1-9by-A：startScopeSync 退役——保留一次性对齐，后续由写入点直调驱动。
  syncUploadFromScope();

  const ipc = ipcRenderer();
  if (ipc && typeof ipc.on === 'function') {
    // bundle 22734：app-status-loading 时 removeAllListeners('background-state')；
    // setTimeout(0) 跳出本轮监听器链，确保重挂在 bundle 清理之后执行。
    ipc.on('app-status-loading', () => {
      setTimeout(attachBackgroundState, 0);
    });
  }
  attachBackgroundState();
}
