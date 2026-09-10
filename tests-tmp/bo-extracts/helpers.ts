// b1-9ap 模块级辅助（controller 闭包等价物；makeControllerFns 工厂外共享）
// eagle.utils.tree.walk 安全封装（w.eagle.utils.tree.walk 缺席时等价平铺递归，不丢展开态）
function treeWalkSafe(nodes: any, childKey: string, fn: (node: any, parent: any, depth?: any) => void) {
  const w = window as any;
  const walk = w.eagle && w.eagle.utils && w.eagle.utils.tree && w.eagle.utils.tree.walk;
  if (walk) {
    walk(nodes, childKey, fn);
    return;
  }
  const walkAll = (nodesInner: any, parent: any, depth: number) => {
    (nodesInner || []).forEach(function (n: any) {
      fn(n, parent, depth);
      walkAll(n[childKey], n, depth + 1);
    });
  };
  walkAll(nodes, null, 0);
}

function wElectronLogInfo(msg: string) {
  const w = window as any;
  w.electronLog && w.electronLog.info(msg);
}

// 原 $("#folder-input-" + id).focus().select()（React Sidebar 沿用同 DOM id 约定）
function wQueryFocusFolderInput(folderId: any) {
  const el = document.getElementById('folder-input-' + folderId);
  if (el) {
    (el as HTMLElement).focus();
    (el as HTMLElement).select && (el as HTMLElement).select();
  }
}
