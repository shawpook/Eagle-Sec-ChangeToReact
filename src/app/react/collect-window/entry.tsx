import { createRoot } from 'react-dom/client';
import { useEffect } from 'react';
import CollectShell from './shell';
import { controllerScope } from './controller';

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
