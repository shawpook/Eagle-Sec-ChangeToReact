import { create } from 'zustand';
import { migrateScopeFieldToStore } from '../core/scopeFieldBridge';

import { useMiscRawState } from './miscRawState';

/**
 * 11-pre a2：toast-alert 三块状态源（index.html 失败重试提示 / 本地服务器警告 /
 * 库写入权限警告）。openErrorModal/cleanAllError 经广播与既有 React ErrorModal（7c 系列）
 * 衔接，toast 组件只做展示与 callScope 转发。
 *
 * b1-9by-A：startScopeSync 退役——errorCount（errorList.length 派生）改写入点直调
 * syncErrorCount（miscDomain push / libraryDomain 重置 / ControllerModals remove·clean）；
 * localhostError/libraryPathPermissionError 已源翻转（az R1-batch2）。
 */

interface ToastState {
  errorCount: number;
  localhostError: boolean;
  libraryPathPermissionError: boolean;
}

export const useToastState = create<ToastState>(() => ({
  errorCount: 0,
  localhostError: false,
  libraryPathPermissionError: false,
}));

// b1-9az R1-batch2：恒等字段源翻转（toastState 2 个布尔；errorCount 为 errorList.length
// 派生）。同值守卫同 bodyState/listState（b1-9az 批 1 教训）。
const MIGRATED_TOAST_FIELDS: ReadonlyArray<keyof ToastState> = [
  'localhostError', 'libraryPathPermissionError',
];
for (const fieldName of MIGRATED_TOAST_FIELDS) {
  migrateScopeFieldToStore(
    fieldName,
    () => useToastState.getState()[fieldName],
    (value: any) => {
      if (useToastState.getState()[fieldName] !== value) useToastState.setState({ [fieldName]: value } as Partial<ToastState>);
    },
  );
}

/**
 * b1-9by-A：errorCount 直写收敛——errorList 数组变异点调用（原 200ms 轮询快照退役）。
 * list 缺省读 scope.errorList；ControllerModals 的 errorListRef 与 scope.errorList 同
 * 引用（OPEN_ERROR/CLEAN_ALL_ERROR params 透传），splice/length=0 后传入以即时对齐。
 */
export function syncErrorCount(list?: any[]): void {
  const arr = list || (useMiscRawState.getState().errorList);
  const count = (arr && arr.length) || 0;
  if (useToastState.getState().errorCount !== count) {
    useToastState.setState({ errorCount: count });
  }
}

export function bindToastSync(): void {
  // 供闭环测试直写 scope 后手动驱动（原 $evalAsync 触发快照链的等价物）。
  (window as any).__eagleToastSync = syncErrorCount;
  // b1-9by-A：startScopeSync 退役。保留一次性对齐（启动期 errorList 已有值时
  // 校正 store 初值），后续由写入点直调驱动。
  syncErrorCount();
}
