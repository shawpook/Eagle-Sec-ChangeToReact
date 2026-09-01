import { create } from 'zustand';
import { startScopeSync } from '../global/scopeBridge';

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

export function bindToastSync(): void {
  if (bound) return;
  bound = true;

  startScopeSync({
    watch: ['errorList.length', 'localhostError', 'libraryPathPermissionError'],
    build: (scope) => ({
      errorCount: (scope.errorList && scope.errorList.length) || 0,
      localhostError: !!scope.localhostError,
      libraryPathPermissionError: !!scope.libraryPathPermissionError,
    }),
    apply: (snapshot) => useToastState.setState(snapshot as ToastState),
  });
}
