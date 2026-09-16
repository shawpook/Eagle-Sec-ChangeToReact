// 插件 SDK（window.eagle）由后端在 <head> 起始处注入的 /plugin-shim.js 提供，
// 因此本文件在顶层即可安全引用 eagle。回调在 DOMContentLoaded 后按 create → run → show 派发，
// hide / beforeExit 分别随页面隐藏与卸载派发（见 /plugin-shim.js）。
function eagleReverseSetStatus(text) {
  const node = document.getElementById('plugin-status');
  if (node) node.textContent = text;
}

eagle.onPluginCreate((plugin) => {
  const manifest = (plugin && plugin.manifest) || {};
  eagleReverseSetStatus(`created: ${manifest.name || manifest.id || 'unknown'}`);
});

eagle.onPluginRun(() => {
  eagleReverseSetStatus('running');
});

eagle.onPluginShow(() => {
  if (document.body) document.body.dataset.eaglePluginVisible = '1';
});

eagle.onPluginHide(() => {
  if (document.body) document.body.dataset.eaglePluginVisible = '0';
});

eagle.onPluginBeforeExit(() => {
  eagleReverseSetStatus('exiting');
});
