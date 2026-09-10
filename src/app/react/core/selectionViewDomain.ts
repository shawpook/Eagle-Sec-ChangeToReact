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

import { detailZoom } from './smoothZoomEngine';
import { getBodyScope, persistSweep, sweepForeignWatchers } from './appCore';
import { syncDetailFromScope } from '../store/detailState';
import { machineryChangeMetaItems, machineryCurrentIndex, machineryRememberVideoCurrentTime, machinerySaveFolder, machineryUpdateListSlider, machineryUpdateSelection, machineryUpdateSubFolderWidth } from './dataMachinery';
import { saveFolderChannel, updateSelectionChannel } from '../global/bus';
import { scopeEvalAsync } from '../global/scopeShim';

let done = false;

function domainTimeout(s: any, fn: any, ms?: number): any {
  return setTimeout(() => {
    try { if (typeof fn === 'function') fn(); } finally { try { scopeEvalAsync(); } catch (err) { /* noop */ } }
  }, ms || 0);
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
  // ── selected 主 watcher（34214-34259 逐字；b1-9l 补挂——此前仅 darwin quicklook 变体注册过
  //    （平台守卫错位），win32 上选中集变化无人重建 selectedMappings / 触发 updateSelection，
  //    m1-E-selected-watch 断言面。依赖：setLastItem（38490 link var 逐字）、selectItemsView
  //    （35073 逐字）随 watcher 一并补挂；AnnotationPreview（52076）整条未端口——按存在性守卫）──
  const setLastItem = w.debounce(function (item: any) {
    const s2: any = getBodyScope();
    if (!s2) return;
    if (item) {
      localStorage.setItem(`eagle.lastViewItem.${s2.rootDir}`, item.id);
      localStorage.setItem(`eagle.lastViewItemTime.${s2.rootDir}`, String(Date.now()));
    }
  }, 333);
  const selectItemsView = function (items: any) {
    const s2: any = getBodyScope();
    if (!s2) return;
    const $boxContainer = w.$("#box-container");
    $boxContainer.find(".box.selected").removeClass("selected");
    (items || []).forEach(function (item: any) {
      if (s2.selectedMappings[item.id]) {
        w.$("#box-" + item.id).addClass("selected");
      }
      else {
        w.$("#box-" + item.id).removeClass("selected");
      }
    });
  };
  s0.$watchCollection("selected", function (newValue: any, oldValue: any) {
    const s: any = getBodyScope();
    if (!s) return;

    s.selectedMappings = {};
    s.zoomFitSize = 0;

    s.selected.forEach(function (image: any, index: any) {
      if (image) {
        s.selectedMappings[image.id] = true;
      }
    });

    if (s.selected.length > 0) {
      s.updateSelection();
    }

    if (s.isDetailMode && s.smoothZoomDone) {
      // 只在「詳情模式中切換圖片」時執行。（bundle 原注：剛進入詳情模式時 smoothZoomDone
      // 為 false，#detail-image 尚未渲染，這些 DOM 操作無意義，且 updateNavigator 會在
      // enterDetailMode 的 $timeout 中重做。）
      s.showLargeImage = false;
      machineryRememberVideoCurrentTime(s, oldValue[0]);
      if (w.AnnotationPreview) w.AnnotationPreview.hide();
      w.$("#detail-image").data("degree", 0);
      w.$("#detail-image").css({
        "transform": ``,
      });
      setTimeout(() => {
        const sNow: any = getBodyScope();
        detailZoom()?.updateNavigator( sNow && sNow.current);
      }, 300);
    }

    if (s.selected.length === 1) {
      s.lastSelectedIndex = machineryCurrentIndex(s) - 1;
    }

    // 全选
    if (s.selected.length === s.allData.length) {
      s.lastSelectedIndex = s.selected.length - 1;
      w.$(".box").addClass("selected");
    }
    else {
      selectItemsView(s.selected);
    }

    var lastItem = s.selected[0];
    if (lastItem) {
      setLastItem(lastItem);
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
  const hFn1 = function (newValue: any) {
    const s: any = getBodyScope();
    if (!s) return;
    machineryUpdateSubFolderWidth(s);
    machineryUpdateListSlider(s, newValue);
    if (s.imageSize.height > 600 && s.showOriginalImageWhenLarge) {
      domainEnlargeThumbnails();
    }
    else {
      domainShrinkThumbnails();
    }
  };
  s0.$watch("imageSize.height", hFn1);
  sweepForeignWatchers(s0, 'imageSize.height', [hFn1], 'enlargeThumbnails');

  // ── imageSize.zoomRatio（34211 逐字）──
  const zFn1 = function (newValue: any) {
    const s: any = getBodyScope();
    if (!s) return;
    s.sliderZoomRatio = newValue;
    syncDetailFromScope();
  };
  s0.$watch("imageSize.zoomRatio", zFn1);
  sweepForeignWatchers(s0, 'imageSize.zoomRatio', [zFn1], 'sliderZoomRatio');

  // ── listMetaType（37269 逐字）── b1-9bz-C-4：$watch → 显式调用
  // 原 $watch 的语义是「外部写 s.listMetaType 后触发 changeMetaItems」；唯一外部写入点
  // （SmallPanels 的元信息下拉）已改为直接调 machineryChangeMetaItems。
  // 另：Angular $watch 注册时会以 (当前值, 当前值) 立即触发一次 listener —— 保留该语义。
  {
    const s: any = getBodyScope();
    if (s) machineryChangeMetaItems(s, s.listMetaType);
  }

  // ── $on UPDATE_SELECTION / SAVE_FOLDER（42379/42383 逐字）──
  diag.listenersRemoved['UPDATE_SELECTION'] = removeScopeListener(s0, 'UPDATE_SELECTION');
  updateSelectionChannel.on(function () {
    const s: any = getBodyScope();
    if (!s) return;
    s.updateSelection();
  });

  diag.listenersRemoved['SAVE_FOLDER'] = removeScopeListener(s0, 'SAVE_FOLDER');
  saveFolderChannel.on(function () {
    const s: any = getBodyScope();
    if (!s) return;
    machinerySaveFolder(s);
  });
}
