/**
 * 全局桥 —— 只读访问 shims.js / preload.cjs 已经建好的全局对象，零复制逻辑。
 *
 * 三个铁律里「数据面零改动」要求 ipcRenderer 通道名、REST 端点、electron-settings 键、
 * localStorage 键全部原样保留。因此这里只做「取引用」，绝不重新实现偏好读写 / IPC 通道。
 */

export interface EagleGlobals {
  i18n: any;
  eagle: any;
  eagleDesktop: any;
  electronSettings: any;
  module?: any;
  __mockLibrary?: any;
}

function fallback<T>(key: keyof EagleGlobals): T {
  return (window as any)[key] as T;
}

export function i18n(): any {
  return (window as any).i18n || fallback<any>('i18n');
}

/** 全局 eagle 单例（eagle.inspector / eagle.filter / eagle.action ...）。 */
export function eagle(): any {
  return (window as any).eagle || fallback<any>('eagle');
}

/** electron-settings 桥（getPreferences / getSync / setSync / has / delete）。 */
export function electronSettings(): any {
  return (window as any).electronSettings || fallback<any>('electronSettings');
}

/** desktop 桥（来自 preload.cjs 的 contextBridge）。 */
export function eagleDesktop(): any {
  return (window as any).eagleDesktop || fallback<any>('eagleDesktop');
}

/** 原生 IPC（浏览器预览态由 shims 提供 mock，Electron 态由 preload 提供真实通道）。 */
export function ipcRenderer(): any {
  const desktop = eagleDesktop();
  if (desktop && desktop.ipc) return desktop.ipc;
  return (window as any).$$electronIpc || (window as any).__eagleIpc;
}

export const t = (key: string, pairs?: Array<{ property: string; value: string }>): string => {
  const fn = i18n() && i18n().__;
  if (!fn) return key;
  let out = fn(key);
  if (out == null || out === key) return key;
  if (pairs) {
    pairs.forEach((pair) => {
      out = out.replace(`{${pair.property}}`, pair.value);
    });
  }
  return out;
};
