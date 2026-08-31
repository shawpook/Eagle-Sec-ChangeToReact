import { createRoot } from 'react-dom/client';
import { useEffect, useRef, useState } from 'react';
import { PreferencesGeneralSidebarPanels } from './panels';

/**
 * 阶段8：偏好窗口 React 入口（preferences.html / PreferenceApp 绞杀者）。
 *
 * 架构（PROGRESS 阶段8 勘察）：独立 BrowserWindow，main.cjs preferencesUrl() 走 vite；
 * shims 由 vite middleware 注入（mock ipc/remote）；'init' ipc 携带 Registration/panel/keyword。
 *
 * 铁律：数据面零改动——所有读写仍走 ipcRenderer 通道（'chnage-preferences' 原版拼写保留）/
 * electronSettings / window 全局；回调等价 ng-click 的 $apply 语义。
 * 迁移方式：8a 仅接线（本文件：host 挂载 + init 监听 + 偏好 store）；8b-8e 逐面板接管
 * （general/sidebar/control/habits/screencapture/shortcuts/notification/privacy/autoImport/
 * developer），接管即从 preferences.html 删除对应 ng 模板块；8e 完成后移除 ng-app。
 */

const req = (name: string): any => (window as any).require?.(name);

export interface PreferencesWindowState {
  registration: any;
  panel: string;
  keyword: string;
  ready: boolean;
}

// 简单外部 store（与主窗口 zustand 同风格；供 8b-8e 各面板组件共享）
let state: PreferencesWindowState = { registration: null, panel: '', keyword: '', ready: false };
const listeners = new Set<() => void>();
function setState(patch: Partial<PreferencesWindowState>) {
  state = { ...state, ...patch };
  // 闭环测试契约（CDP Runtime.evaluate 直读）
  (window as any).__eaglePreferencesState = state;
  listeners.forEach((l) => l());
}
export function usePreferencesWindowState(): PreferencesWindowState {
  const [, bump] = useState(0);
  useEffect(() => {
    const l = () => bump((v: number) => v + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return state;
}

function PreferencesRoot() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const initedRef = useRef(false);

  useEffect(() => {
    setHost(document.getElementById('eagle-preferences-react-host'));
  }, []);

  useEffect(() => {
    const ipc = req('electron')?.ipcRenderer;
    if (!ipc || !ipc.on) return;

    // ipcRenderer.on('init')（preferences.js 802-843 的数据面等价：参数入库 + ready 标记；
    // Angular 版的 initAutoLaunch/initPreference/initPlugins/updateKeybinds 仍在旧控制器内
    // 运行，8b 起逐面板搬移）
    const onInit = (event: any, params: any) => {
      setState({
        registration: params && params.Registration ? params.Registration : null,
        panel: (params && params.panel) || '',
        keyword: (params && params.keyword) || '',
        ready: true,
      });
      initedRef.current = true;
    };
    ipc.on('init', onInit);
    return () => {
      if (ipc.off) ipc.off('init', onInit);
    };
  }, [host]);

  // 8a：壳接线；8b 起 general/sidebar 面板经 panels.tsx portal 渲染（锚点在 .content 顶部）
  void host;
  return <PreferencesGeneralSidebarPanels />;
}

const host = document.getElementById('eagle-preferences-react-host');
if (host) {
  createRoot(host).render(<PreferencesRoot />);
}
