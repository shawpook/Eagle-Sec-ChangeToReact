/**
 * cZ-6：选择/视图域——scope watch/watchCollection/$on 接管（无 ipc 通道）。
 *
 * - **watchCollection "selected"（34214 + darwin quicklook 34265）**：body scope 上有两个
 *   'selected' watcher（54323 inspector scope / 58048 指令 scope 的不属 body，不动）——
 *   按 exp 全量摘除后域内重挂两个（主 watcher 全量逐字；darwin watcher 平台守卫内注册）。
 * - **imageSize.height / imageSize.zoomRatio watch（34200/34211）**：enlarge/shrink
 *   Thumbnails 为 controller 闭包（20324/20345）→ 域内移植（含 timeout 局部）。
 * - **listMetaType watch（37269）** → changeMetaItems（scope 函数）。
 * - **finishGenerateQueue watchCollection（34496）**：缩略图再生成清队（cZ-4 遗留同族）。
 * - **$on UPDATE_SELECTION / SAVE_FOLDER（42379/42383）**：$$listeners 摘除后重挂。
 */

import { getBodyScope } from '../global/scopeBridge';

let done = false;

function domainTimeout(s: any, fn: any, ms?: number): any {
  return setTimeout(() => {
    try { if (typeof fn === 'function') fn(); } finally { try { s.$apply(); } catch (err) { /* noop */ } }
  }, ms || 0);
}

/* 按 watch 表达式全量摘除 scope watcher（body scope 上同表达式可有多个），返回摘除数 */
function removeScopeWatchersAll(s: any, exp: string): number {
  let removed = 0;
  try {
    const watchers = s.$$watchers;
    if (!Array.isArray(watchers)) return 0;
    for (let i = watchers.length - 1; i >= 0; i--) {
      if (watchers[i] && watchers[i].exp === exp) {
        watchers.splice(i, 1);
        removed++;
      }
    }
  } catch (err) { /* noop */ }
  return removed;
}

function removeScopeListener(s: any, evt: string): number {
  let removed = 0;
  try {
    const listeners = s.$$listeners && s.$$listeners[evt];
    if (Array.isArray(listeners)) {
      removed = listeners.length;
      s.$$listeners[evt] = [];
    }
  } catch (err) { /* noop */ }
  return removed;
}

/* enlargeThumbnails（20324 逐字；timeout 局部域内自管） */
let domainEnlargeThumbnailsTimeout: any = null;
function domainEnlargeThumbnails(): void {
  const $: any = (window as any).$;
  clearTimeout(domainEnlargeThumbnailsTimeout);
  domainEnlargeThumbnailsTimeout = setTimeout(() => {
    console.time("enlargeThumbnails");
    const $boxs = $(".box.show.jpg, .box.show.png, .box.show.webp, .box.show.bmp, .box.show.jfif").not(".enlarge-thumbnail");
    const $imgs = $boxs.find(".thumbnail img");

    $imgs.each(function (this: any) {
      const $self = $(this);
      const $box = $self.parent().parent();
      const rawsrc = $self.attr('raw');
      if (rawsrc) {
        $self.attr('src', rawsrc);
        $box.addClass("enlarge-thumbnail");
      }
    });
    console.timeEnd("enlargeThumbnails");
  }, 600);
}

/* shrinkThumbnails（20345 逐字） */
let domainShrinkThumbnailsTimeout: any = null;
function domainShrinkThumbnails(): void {
  const $: any = (window as any).$;
  clearTimeout(domainShrinkThumbnailsTimeout);
  domainShrinkThumbnailsTimeout = setTimeout(() => {
    console.time("shrinkThumbnails");
    const $boxs = $(".box.enlarge-thumbnail.jpg, .box.enlarge-thumbnail.png, .box.enlarge-thumbnail.webp, .box.enlarge-thumbnail.bmp, .box.enlarge-thumbnail.jfif");
    const $imgs = $boxs.find(".thumbnail img");

    $imgs.each(function (this: any) {
      const $self = $(this);
      const $box = $self.parent().parent();
      const lsrc = $self.attr('lsrc');
      if (lsrc) {
        $self.attr('src', lsrc);
        $box.removeClass("enlarge-thumbnail");
      }
    });
    console.timeEnd("shrinkThumbnails");
  }, 600);
}

/* setLastItem（38490 逐字；_.debounce → window._） */
let domainSetLastItem: any = null;
function ensureSetLastItem(s: any): any {
  const w = window as any;
  if (!domainSetLastItem && w._ && w._.debounce) {
    domainSetLastItem = w._.debounce(function (item: any) {
      if (item) {
        localStorage.setItem(`eagle.lastViewItem.${s.rootDir}`, item.id);
        localStorage.setItem(`eagle.lastViewItemTime.${s.rootDir}`, String(Date.now()));
      }
    }, 333);
  }
  return domainSetLastItem;
}

export function takeoverSelectionViewDomain(): void {
  if (done) return;
  done = true;
  const w = window as any;
  const diag: any = { takenOver: true, watchesRemoved: {} as Record<string, number>, listenersRemoved: {} as Record<string, number> };
  w.__eagleSelectionViewDomain = diag;

  const $: any = w.$;
  const s0: any = getBodyScope();
  if (!s0 || typeof s0.$watch !== 'function') return;

  // ── watchCollection "selected"（34214 主 watcher；摘 body scope 全部 'selected' watcher）──
  diag.watchesRemoved['selected'] = removeScopeWatchersAll(s0, 'selected');
  s0.$watchCollection("selected", function (newValue: any, oldValue: any) {
    const s: any = getBodyScope();
    if (!s) return;

    s.selectedMappings = {};
    s.zoomFitSize = 0;

    s.selected.forEach(function (image: any, _index: any) {
      if (image) {
        s.selectedMappings[image.id] = true;
      }
    });

    if (s.selected.length > 0) {
      s.updateSelection();
    }

    if (s.isDetailMode && s.smoothZoomDone) {
      // 只在「詳情模式中切換圖片」時執行。
      // 剛進入詳情模式時 smoothZoomDone 為 false，#detail-image 尚未渲染，
      // 這些 DOM 操作無意義，且 updateNavigator 會在 enterDetailMode 的 $timeout 中重做。
      s.showLargeImage = false;
      s.rememberVideoCurrentTime(oldValue[0]);
      w.AnnotationPreview.hide();
      $("#detail-image").data("degree", "0");
      $("#detail-image").css({
        "transform": ``
      });
      setTimeout(() => {
        $("#detail-container").smoothZoom('updateNavigator', s.current);
      }, 300);
    }

    if (s.selected.length === 1) {
      s.lastSelectedIndex = s.currentIndex() - 1;
    }

    // 全选
    if (s.selected.length === s.allData.length) {
      s.lastSelectedIndex = s.selected.length - 1;
      $(".box").addClass("selected");
    }
    else {
      s.selectItemsView(s.selected);
    }

    const lastItem = s.selected[0];
    if (lastItem) {
      ensureSetLastItem(s) && ensureSetLastItem(s)(lastItem);
    }
  });

  // ── darwin quicklook watch（34265；平台守卫内注册，与 bundle 一致）──
  if (w.process.platform == 'darwin') {
    s0.$watchCollection("selected", w.debounce(function () {
      const s: any = getBodyScope();
      if (!s) return;
      // 如果当前是预览视窗开启状态，切换内容时要自动在开启预览视窗
      if (s.selected.length === 1 && s.isPreviewing) {
        const ipc: any = w.$$electronIpc || w.__eagleIpc;
        if (ipc && ipc.send) ipc.send('quicklook', s.selected[0]);
      }
    }, 300, true));
  }

  // ── imageSize.height（34200 逐字）──
  diag.watchesRemoved['imageSize.height'] = removeScopeWatchersAll(s0, 'imageSize.height');
  s0.$watch("imageSize.height", function (newValue: any) {
    const s: any = getBodyScope();
    if (!s) return;
    s.updateSubFolderWidth();
    s.updateListSlider(newValue);
    if (s.imageSize.height > 600 && s.showOriginalImageWhenLarge) {
      domainEnlargeThumbnails();
    }
    else {
      domainShrinkThumbnails();
    }
  });

  // ── imageSize.zoomRatio（34211 逐字）──
  diag.watchesRemoved['imageSize.zoomRatio'] = removeScopeWatchersAll(s0, 'imageSize.zoomRatio');
  s0.$watch("imageSize.zoomRatio", function (newValue: any) {
    const s: any = getBodyScope();
    if (!s) return;
    s.sliderZoomRatio = newValue;
  });

  // ── listMetaType（37269 逐字）──
  diag.watchesRemoved['listMetaType'] = removeScopeWatchersAll(s0, 'listMetaType');
  s0.$watch("listMetaType", function (type: any) {
    const s: any = getBodyScope();
    if (!s) return;
    s.changeMetaItems(type);
  });

  // ── finishGenerateQueue watchCollection（34496 逐字）──
  diag.watchesRemoved['finishGenerateQueue'] = removeScopeWatchersAll(s0, 'finishGenerateQueue');
  s0.$watchCollection("finishGenerateQueue", function () {
    const s: any = getBodyScope();
    if (!s) return;
    if (s.finishGenerateQueue.length >= s.regenerateThumbnailQueue.length) {
      domainTimeout(s, function () {
        s.finishGenerateQueue = [];
        s.regenerateThumbnailQueue = [];
        s.findDupclipate(undefined);
      }, 200);
    }
  });

  // ── $on UPDATE_SELECTION / SAVE_FOLDER（42379/42383 逐字）──
  diag.listenersRemoved['UPDATE_SELECTION'] = removeScopeListener(s0, 'UPDATE_SELECTION');
  s0.$on('UPDATE_SELECTION', function (_e: any) {
    const s: any = getBodyScope();
    if (!s) return;
    s.updateSelection();
  });

  diag.listenersRemoved['SAVE_FOLDER'] = removeScopeListener(s0, 'SAVE_FOLDER');
  s0.$on('SAVE_FOLDER', function (_e: any) {
    const s: any = getBodyScope();
    if (!s) return;
    s.saveFolder();
  });
}
