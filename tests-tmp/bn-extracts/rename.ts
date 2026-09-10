// renameImages（bundle 41480-41495 逐字；$scope→getBodyScope()。bare event 为 bundle
// window.event 怪癖逐字保留——Chromium 下 bare 标识符经全局回退读到 window.event）
function renameImages() {
  const s: any = getBodyScope();
  if (!s) return;
  if (s.selected.length > 1) {
    s.$root.$broadcast('OPEN_RENAME', {
      type: 'IMAGE',
      images: s.selected,
    });
  }
  else {
    var imageId = s.selected[0].id;
    var $box = $(`#box-${imageId}`);
    if ($box.length > 0) {
      setTimeout(() => {
        enableImageNameEditable(event, $box.find('.name'));
      }, 50);
    }
  }
}
