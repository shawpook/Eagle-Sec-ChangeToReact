import React, { useEffect } from 'react';
import { useAppState } from '../store/appState';

/**
 * 阶段1：壳与全局状态（被动初始化器）。
 *
 * 迁移期 Angular 仍持有同一个 `<body>`，并由 EagleController 写入 theme/platform/vibrancy/class。
 * 因此这里【不】主动改写 body 属性，只做两件被动的事：
 *   1) 启动时把 electronSettings / eagle 全局读入 zustand store，供后续 React 组件消费；
 *   2) 监听偏好/主题变化的生效事件（shims 的 storage 广播 + IPC），刷新 store。
 *
 * 等到对应子系统（侧栏/网格/…）真正由 React 接管时，才由该子系统组件写 DOM，
 * 避免与 Angular 在同一个元素上双写冲突。body 的 class 组合逻辑见各阶段组件。
 */

export function AppRoot() {
  const refreshFromGlobals = useAppState((s) => s.refreshFromGlobals);
  const applyThemePreference = useAppState((s) => s.applyThemePreference);

  useEffect(() => {
    refreshFromGlobals();

    const onStorage = () => refreshFromGlobals();
    // Electron 真实环境偏好更新通过 IPC broadcast 推送。
    const ipc = (window as any).$$electronIpc || (window as any).__eagleIpc;
    const onUpdatePrefs = () => refreshFromGlobals();
    // RootController（bundle:20072-20090）同款事件：主题偏好变化带完整 theme 对象。
    const onThemeChange = (_e: unknown, themePref?: { name?: string; css?: string }) =>
      applyThemePreference(themePref);
    ipc?.on?.('update-preferences', onUpdatePrefs);
    ipc?.on?.('change.current.theme', onThemeChange);

    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('storage', onStorage);
      ipc?.removeListener?.('update-preferences', onUpdatePrefs);
      ipc?.removeListener?.('change.current.theme', onThemeChange);
    };
  }, [refreshFromGlobals, applyThemePreference]);

  return null;
}
