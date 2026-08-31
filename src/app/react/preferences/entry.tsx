import { createRoot } from 'react-dom/client';
import { useEffect, useRef, useState } from 'react';
import PreferencesShell from './shell';

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

    // ipcRenderer.on('init')：8a 的测试契约透传（ready 标记）；
    // 8e-2 起真正的 init 序列在 shell.tsx（runInitSequence）。
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

    // shims 就绪标记：本 effect 提交后，本组件与 shell 的 'init' 监听器均已注册
    // （子组件 effect 先于父 effect 执行），此刻发射 init 不会丢失。
    (window as any).__eaglePreferencesEntryReady = true;

    return () => {
      if (ipc.off) ipc.off('init', onInit);
    };
  }, [host]);

  // 8a：壳接线；8b-8e-1 面板经 panels portal；8e-2 起整个窗口由 PreferencesShell 承载
  void host;
  return <PreferencesShell />;
}

const host = document.getElementById('eagle-preferences-react-host');
if (host) {
  createRoot(host).render(<PreferencesRoot />);
}
