import '../core/shimsLegacy';
// M1-F04：boot 安装面必须排在 ./controller **之前**——controller 在模块求值期就读
// req('path') / req('@electron/remote') / window.videojs。本 import 的模块主体在求值末尾调用
// installPreviewBoot()，并自带 `import '../core/shimsLegacy'` 作为前置契约（载入器就是 shim 的
// requireModule）。迁移前这套全局由 preview-window.html 的内联经典脚本供给，且因 appRoot 未定义
// 而实际从未安装成功（详见 boot.ts 文件头与 F04 报告）。
import { assertPreviewBootInstalled } from './boot';
import { createRoot } from 'react-dom/client';
import { useEffect } from 'react';
import PreviewShell from './shell';
import { applyController } from './controller';
import { installKeymap } from '../core/keymap';
import { installTippy } from '../core/tippyLite';
import { installShortcutManager } from '../core/shortcutManager';

// b1-9bv-A：mousetrap vendor 脚本标签已摘除——本 bundle 不走 installBundleGlobals，
// 在模块求值期自行 install（usePreviewMousetrap effect 前于 render，时序安全）。
// b1-9bx-A：tippy vendor 脚本标签同批摘除——shell 的 useTippy 消费 window.tippy，
// 同样在模块求值期补装。
// R5：shortcut-manager 经典脚本同批摘除——controller 的键位映射读 window.ShortcutManager
// 的 electronToMousetrap，须早于 runInitSequence 装配（模块求值期即满足）。
installKeymap();
installTippy();
installShortcutManager();

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
    let active = true;
    const onInit = (_event: any, params: any) => {
      if (!active) return;
      applyController((s) => s.runInitSequence(params));
    };
    const subscription = typeof ipc?.on === 'function' ? ipc.on('init', onInit) : undefined;

    // shims 就绪标记：本 effect 提交后 controller 模块与 shell 的监听器均已注册，此刻
    // 发射 init 不会丢失（子组件 effect 先于父 effect 执行，controller 监听在 import 期注册）。
    (window as any).__eaglePreviewEntryReady = true;
    return () => {
      if (!active) return;
      active = false;
      (window as any).__eaglePreviewEntryReady = false;
      // 新桥优先 disposer；旧版 on 返回 void/Emitter 时按原 callback 精确清理。
      if (typeof subscription === 'function') subscription();
      else if (typeof ipc?.off === 'function') ipc.off('init', onInit);
      else if (typeof ipc?.removeListener === 'function') ipc.removeListener('init', onInit);
    };
  }, []);

  return <PreviewShell />;
}

const host = document.getElementById('eagle-preview-react-host');
if (host) {
  // M1-F04 顺序不变式：必需 boot 全局未到位就抛，不让半装状态流入 React 树/controller 调用期。
  assertPreviewBootInstalled();
  createRoot(host).render(<PreviewEntryRoot />);
}
