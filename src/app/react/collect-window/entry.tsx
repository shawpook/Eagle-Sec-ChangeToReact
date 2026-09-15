import '../core/shimsLegacy';
// R5：采集窗 window.eagle / window.CollectItem 的装配必须在 ./shell（→ controller.ts 模块尾
// 立即执行的 IIFE，求值期同步读 eagle.env.browser.name）之前完成。ESM 按 import 声明顺序求值
// 依赖，故本副作用模块置于 shell 之前即可，无需依赖外层调用顺序。
import './api/installEagleApi';
import { createRoot } from 'react-dom/client';
import { useEffect } from 'react';
import CollectShell from './shell';
import { controllerScope } from './controller';
import { installDialog } from '../core/dialog';

// R5：本 bundle 不走 installBundleGlobals（那是主窗装配面），在模块求值期自行补装。
// collect-window/index.html 原引用的 js/vendors/sweetalert2.all.min.js 退役——本窗唯一
// SweetAlert 消费点是 folderPanel.createFolder（swal({input:'text', showCancelButton…})），
// 与主窗 65 调用点同源，由自研 core/dialog.ts（.swal2-* 类名逐字复刻）供给零视觉回归。
installDialog();

/**
 * 采集窗 React 入口（collect-window.html / CollectApp 绞杀者）。阶段9b-1。
 *
 * 就绪标记 __eagleCollectEntryReady 在 effect（React commit 后）设置——shims collect 分支
 * 轮询该标记 + folders 就绪后调 initFolderSelect()（原 Angular 行为等价）。
 */
function CollectEntryRoot() {
  useEffect(() => {
    (window as any).__eagleCollectEntryReady = true;
  }, []);

  void controllerScope;
  return <CollectShell />;
}

const host = document.getElementById('eagle-collect-react-host');
if (host) {
  createRoot(host).render(<CollectEntryRoot />);
}
