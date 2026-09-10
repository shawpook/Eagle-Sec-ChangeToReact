// URL_MODULE（bundle 顶层 const；fileUrlHelper.ts 同款惰性解析）
const URL_MODULE: any = (() => {
  const req = (window as any).require;
  if (typeof req !== 'function') return (window as any).URL_MODULE;
  const appRoot = (window as any).appRoot;
  const rootPath = appRoot && (appRoot.path || appRoot);
  if (rootPath) { try { return req(`${rootPath}/my_modules/url`); } catch (err) {} }
  try { return req('url'); } catch (err) { return (window as any).URL_MODULE; }
})();

// ContextMenu（bundle 15836-15843 逐字；angular.element("html").scope() → getBodyScope()——
// 根 scope 广播，React ContextMenuPanel 经 $on('CONTEXTMENU.OPEN') 消费）
const ContextMenu: any = {
  open(options: any) {
    const root: any = getBodyScope();
    root && root.$broadcast && root.$broadcast('CONTEXTMENU.OPEN', options);
  },
  close() {
    const root: any = getBodyScope();
    root && root.$broadcast && root.$broadcast('CONTEXTMENU.CLOSE');
  },
};
