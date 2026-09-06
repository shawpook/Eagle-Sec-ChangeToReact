import { create } from 'zustand';
import { startScopeSync } from '../global/scopeBridge';
import { migrateScopeFieldToStore } from '../global/scopeShim';

/**
 * 11-pre a2：toast-alert 三块状态源（index.html 失败重试提示 / 本地服务器警告 /
 * 库写入权限警告）。全部为 body scope 的 digest 驱动状态（bundle 22659
 * 'extension-server-init-failed'、23451 $.ajax localhost 探测、23461
 * ACCESS.checkALCs、30414 'image-processing-error' push errorList），scope 快照
 * 同源同语义；openErrorModal/cleanAllError 经广播与既有 React ErrorModal（7c 系列）
 * 衔接，toast 组件只做展示与 callScope 转发。
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

let bound = false;

// b1-9az R1-batch2：恒等字段源翻转（toastState 2 个布尔；errorCount 为 errorList.length
// 派生，留快照链）。同值守卫同 bodyState/listState（b1-9az 批 1 教训）。
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

export function bindToastSync(): void {
  if (bound) return;
  bound = true;

  startScopeSync({
    watch: ['errorList.length'],
    build: (scope) => ({
      errorCount: (scope.errorList && scope.errorList.length) || 0,
    } as Partial<ToastState>),
    apply: (snapshot) => useToastState.setState(snapshot as Partial<ToastState>),
  });
}
