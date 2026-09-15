/**
 * R5：查看器（iframe 子窗）→ 父窗通道的**具名接口**。
 *
 * 背景：六个查看器都是 main.cjs 建窗后 `iframe`/`webview` 内嵌的页面，凭 iframe 继承的
 * nodeIntegration 直接读 `window.parent`（`require` / `process` / `ipcRenderer` / `global`），
 * 并经父窗**驱动面**回调（如 `gifViewer.onProgress`、`inspector.newName` + `imagesChange`）。
 * 迁移期各入口散落 `const parent = window.parent as any;`，且「驱动面优先序」在两个文件里
 * 各写了一遍。本模块把这条跨窗边界收敛为**一处具名面**：
 *
 *  - `viewerParent()`：父窗对象（含 `require`/`process`/`ipcRenderer`/`global`/`focus`）。
 *  - `driverScope()`：父窗驱动面，**优先 `__eagleDriver`**（core/driverApi.ts 的显式白名单面，
 *    E5-3 起为主通道），过渡期回落 `$bodyScope`。原写法在 gif/font 两处逐字重复，此处归一。
 *  - `parentRequire()` / `parentIpc()`：最常用的两个能力，省去每处再取一次 parent。
 *
 * 语义与迁移前逐字一致：全部是**惰性读取**（每次调用现取 `window.parent`），不在模块求值期缓存
 * ——查看器入口都在 React 组件/hook 内调用，父窗始终可用；若父窗缺失，行为仍与原先
 * `(window.parent as any).x` 相同（抛错），不新增吞错。
 */

/** 父窗对象（nodeIntegration 继承下的 `window.parent`）。 */
export function viewerParent(): any {
  return window.parent as any;
}

/**
 * 父窗驱动面：`__eagleDriver`（显式白名单）优先，过渡期回落 `$bodyScope`。
 * 返回 `undefined` 表示父窗未提供驱动面（调用方自行判空，与迁移前一致）。
 */
export function driverScope(): any {
  const parent = viewerParent();
  if (!parent) return undefined;
  return parent.__eagleDriver || parent.$bodyScope || undefined;
}

/** 经父窗 `require` 取 Node 模块（iframe 继承 nodeIntegration，与原实现同通道）。 */
export function parentRequire(name: string): any {
  return viewerParent().require(name);
}

/** 父窗 `ipcRenderer`（原生 ipcRenderer，非 shims 总线）。 */
export function parentIpc(): any {
  return viewerParent().ipcRenderer;
}
