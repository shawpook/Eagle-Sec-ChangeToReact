import { createRoot } from 'react-dom/client';
import { useEffect } from 'react';
import PreviewShell from './shell';
import { applyController } from './controller';

/**
 * 阶段9a-1：预览大窗 React 入口（preview-window.html / PreviewWindowController 绞杀者）。
 *
 * 架构（handover §4.4）：preview-window.html 静态壳由 vite middleware 注入本 entry；
 * 'init' ipc（main onDidFinishLoad → preload onInit → shims 桥/mock emit）携带
 * images/imagesDir/rootDir/machineID/Registration/pluginModule → runInitSequence（581-658 逐字）。
 * controller 模块构造期已挂 window.__eaglePreviewController / window.$bodyScope（gif iframe
 * 与 detailHooks 的既有通道）。
 *
 * 就绪标记 __eaglePreviewEntryReady 必须在本 effect（React commit 后）设置——模块尾标记会在
 * commit 前盲发丢失（8e-2 教训：probe 定位 ready 真而 init 未达）。
 */

const req = (name: string): any => (window as any).require?.(name);

function PreviewEntryRoot() {
  useEffect(() => {
    const ipc = req('electron')?.ipcRenderer;
    if (ipc && ipc.on) {
      const onInit = (_event: any, params: any) => {
        applyController((s) => s.runInitSequence(params));
      };
      ipc.on('init', onInit);
    }

    // shims 就绪标记：本 effect 提交后 controller 模块与 shell 的监听器均已注册，此刻
    // 发射 init 不会丢失（子组件 effect 先于父 effect 执行，controller 监听在 import 期注册）。
    (window as any).__eaglePreviewEntryReady = true;
  }, []);

  return <PreviewShell />;
}

const host = document.getElementById('eagle-preview-react-host');
if (host) {
  createRoot(host).render(<PreviewEntryRoot />);
}
