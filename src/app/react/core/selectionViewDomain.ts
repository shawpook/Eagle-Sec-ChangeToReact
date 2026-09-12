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

import { machineryRememberVideoCurrentTime } from '../services/mediaService';
import { saveFolderChannel, updateSelectionChannel } from '../global/bus';
import { scopeEvalAsync } from './scopeRuntime';
import { onSelectedChanged } from './selectionNotify';
import { addClass, removeClass, cssSet, q, dataSet } from '../utils/domQuery';

import { machinerySaveFolder } from './libraryDomain';
import { machineryCurrentIndex } from '../services/gridService';
import { machineryOnZoomRatioChanged } from '../services/viewOpsService';
import { machineryChangeMetaItems, machineryOnImageSizeHeightChanged } from './itemDomain';
import { FolderSelectPanel } from '../components/stage7/selectPanelEngine';
import { calculateImageBindingChannel, glRemoveitemsChannel, inspectorTagSelectPanelOpenChannel, rebindRefreshChannel, updateInspectorChannel } from '../global/bus';
import { addToRecentFolders } from '../services/batchOpsService';
import { machineryGetArroundBox, machineryRememberScrollTops } from '../services/gridService';
import { machineryCheckOperationSafety, machineryCheckOperationSafety2, machineryLastZoom, machineryZoom } from '../services/viewOpsService';
import { syncInspectorFromScope } from '../store/inspectorState';
import { syncListFromScope } from '../store/listState';
import { syncTagManagerFromScope } from '../store/tagManagerState';
import { hide, offsetOf, qa, show } from '../utils/domQuery';
import { moveCropToolChannel } from './../global/bus';
import { getFilter, machineryUpdateFilterCounts } from './filterDomain';
import { machineryCalculateImageBinding, machineryForceFitImageSize, machineryGetItemByElement, machineryPreloadImage, machineryRebindRefresh } from './itemDomain';
import { machineryAddToRecentFile, machineryRemoveFolder, machineryRemoveFolderContents, machineryRemoveFolderInner, machineryRemoveSmartFolder, machineryRemoveSmartFolderInner, machineryResetFolderCover, machineryToggleCurrentLevelSmartFoldersInner } from './libraryDomain';
import { machineryRemoveTagGroup } from './tagManagerDomain';

import { machineryRemovePermanently } from '../services/batchOpsService';
import { machineryLeaveDetailMode } from './miscDomain';
import { machineryAutoScroll } from '../services/gridService';
import { getTimeout, machineryCalls } from './machineryInfra';
import { useItemState } from '../store/itemState';
import { useListState } from '../store/listState';
import { useMiscRawState } from '../store/miscRawState';
import { useSelectionState } from '../store/selectionState';
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
export function takeoverSelectionViewDomain(): void {
  if (done) return;
  done = true;
  const w = window as any;
  const diag: any = { takenOver: true, watchesRemoved: {} as Record<string, number>, listenersRemoved: {} as Record<string, number> };
  w.__eagleSelectionViewDomain = diag;

  const s0: any = getBodyScope();
  if (!s0) return; // E1c：原以 $watch 存在性判 scope 就绪；shim 已移除 $watch

  // ── watchCollection "selected"（34214 主 watcher；摘 body scope 全部 'selected' watcher）──
  // ── selected 主 watcher（34214-34259 逐字；b1-9l 补挂——此前仅 darwin quicklook 变体注册过
  //    （平台守卫错位），win32 上选中集变化无人重建 selectedMappings / 触发 updateSelection，
  //    m1-E-selected-watch 断言面。依赖：setLastItem（38490 link var 逐字）、selectItemsView
  //    （35073 逐字）随 watcher 一并补挂；AnnotationPreview（52076）整条未端口——按存在性守卫）──
  const setLastItem = w.debounce(function (item: any) {
    const s2: any = getBodyScope();
    if (!s2) return;
    if (item) {
      localStorage.setItem(`eagle.lastViewItem.${useMiscRawState.getState().rootDir}`, item.id);
      localStorage.setItem(`eagle.lastViewItemTime.${useMiscRawState.getState().rootDir}`, String(Date.now()));
    }
  }, 333);
  const selectItemsView = function (items: any) {
    const s2: any = getBodyScope();
    if (!s2) return;
    removeClass(".box.selected", "selected");
    (items || []).forEach(function (item: any) {
      if (useItemState.getState().selectedMappings[item.id]) {
        addClass("#box-" + item.id, "selected");
      }
      else {
        removeClass("#box-" + item.id, "selected");
      }
    });
  };
  onSelectedChanged(function (s: any, oldValue: any) {
    if (!s) return;

    s.selectedMappings = {};
    s.zoomFitSize = 0;

    s.selected.forEach(function (image: any, index: any) {
      if (image) {
        s.selectedMappings[image.id] = true;
      }
    });

    if (s.selected.length > 0) {
      machineryUpdateSelection(s);
    }

    if (s.isDetailMode && s.smoothZoomDone) {
      // 只在「詳情模式中切換圖片」時執行。（bundle 原注：剛進入詳情模式時 smoothZoomDone
      // 為 false，#detail-image 尚未渲染，這些 DOM 操作無意義，且 updateNavigator 會在
      // enterDetailMode 的 $timeout 中重做。）
      s.showLargeImage = false;
      machineryRememberVideoCurrentTime(s, oldValue[0]);
      if (w.AnnotationPreview) w.AnnotationPreview.hide();
      dataSet(q("#detail-image"), "degree", 0);
      cssSet("#detail-image", {
        "transform": ``,
      });
      setTimeout(() => {
        const sNow: any = getBodyScope();
        detailZoom()?.updateNavigator( sNow && useSelectionState.getState().current);
      }, 300);
    }

    if (s.selected.length === 1) {
      s.lastSelectedIndex = machineryCurrentIndex(s) - 1;
    }

    // 全选
    if (s.selected.length === s.allData.length) {
      s.lastSelectedIndex = s.selected.length - 1;
      addClass(".box", "selected");
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
    onSelectedChanged(w.debounce(function (s: any) {
      if (!s) return;
      // 如果当前是预览视窗开启状态，切换内容时要自动在开启预览视窗
      if (s.selected.length === 1 && s.isPreviewing) {
        const ipc: any = w.$$electronIpc || w.__eagleIpc;
        if (ipc && ipc.send) ipc.send('quicklook', s.selected[0]);
      }
    }, 300, true));
  }

  // ── imageSize.height（34200 逐字）── b1-9bz-C-4：$watch → 写入点直调
  // 实现（enlarge/shrink）已迁到 dataMachinery 的 machineryEnlarge/ShrinkThumbnails，
  // 由 machineryOnImageSizeHeightChanged 统一入口在写入点调用（Toolbar 滑条 / openAll /
  // zoomActual）。保留 Angular $watch「注册即触发一次」的语义。
  {
    const s: any = getBodyScope();
    if (s) {
      // 原 watcher 首次触发发生在 flush（域接管之后、scope 已就绪）；此处为同步接管路径，
      // 直接调用可能早于 scope 就绪 —— 用 try/catch 兜住，避免中断后续通道注册。
      try { machineryOnImageSizeHeightChanged(s); } catch (err) { /* noop */ }
    }
  }

  // ── imageSize.zoomRatio（34211 逐字）── b1-9bz-C-4：$watch → 写入点直调
  // 由 machineryOnZoomRatioChanged 在 5 个写入点调用（dataMachinery ×3 + detailService ×2）。
  // 保留 Angular $watch「注册即触发一次」的语义（try/catch 兜住：接管时 scope 可能未就绪）。
  {
    const s: any = getBodyScope();
    if (s) {
      try { machineryOnZoomRatioChanged(s); } catch (err) { /* noop */ }
    }
  }

  // ── listMetaType（37269 逐字）── b1-9bz-C-4：$watch → 显式调用
  // 原 $watch 的语义是「外部写 s.listMetaType 后触发 changeMetaItems」；唯一外部写入点
  // （SmallPanels 的元信息下拉）已改为直接调 machineryChangeMetaItems。
  // 另：Angular $watch 注册时会以 (当前值, 当前值) 立即触发一次 listener —— 保留该语义。
  {
    const s: any = getBodyScope();
    if (s) {
      try { machineryChangeMetaItems(s, s.listMetaType); } catch (err) { /* noop */ }
    }
  }

  // ── $on UPDATE_SELECTION / SAVE_FOLDER（42379/42383 逐字）──
  diag.listenersRemoved['UPDATE_SELECTION'] = removeScopeListener(s0, 'UPDATE_SELECTION');
  updateSelectionChannel.on(function () {
    const s: any = getBodyScope();
    if (!s) return;
    machineryUpdateSelection(s);
  });

  diag.listenersRemoved['SAVE_FOLDER'] = removeScopeListener(s0, 'SAVE_FOLDER');
  saveFolderChannel.on(function () {
    const s: any = getBodyScope();
    if (!s) return;
    machinerySaveFolder(s);
  });
}


// ═══ b1-9bz-D-1 B-5：零依赖声明归位（dataMachinery 剪出，逐字）═══
// ── c18d 域内自管（原 controller 闭包 var：cleanSelectedTimeout，46644 邻域）──
let cleanSelectedTimeout: any = null;

// ── c18e-2b 域内自管（原 controller 闭包 var：lastMoveToTrashCheckbox 46118）──
let lastMoveToTrashCheckbox: any = 1;

/* getSelectedItemElements（bundle 21864-21876 逐字） */
export function machineryGetSelectedItemElements(s: any): any[] {
  var items = machineryGetSelectedItems(s);
  items = items.map(function (item: any) {
    // if (!item.el) {
    //     item.el = $(item.content)[0];
    //     console.log(item.el);
    // }
    return item.el;
  });
  return items;
}

export function machineryGetSelectedItems(s: any): any[] {
  const w = window as any;
  var items = w.ig.getItems(true);
  items = items.filter(function (item: any) {
    return s.selectedMappings[item.id];
    // if (item && item.el && item.el.id) {
    //     var id = item.el.id.replace("box-", "");
    //     return $scope.selectedMappings[id] !== undefined;
    // }
  });
  return items;
}

/* getSelectedTags（bundle 38865-38869 逐字） */
export function machineryGetSelectedTags(s: any): string[] {
  if (!s.selectedTags) return [];
  return Object.keys(s.selectedTags);
}

/* getSelection（bundle 36632-36649 逐字） */
export function machineryGetSelection(s: any): any {
  var arr: any[] = [];
  s.selected.forEach(function (image: any) {
    var idx = s.allData.indexOf(image);
    if (idx != -1) {
      arr.push(idx);
    }
  });
  var invert = arr[0] > arr[1];
  arr = arr.sort(function (a: any, b: any) {
    return a - b;
  });
  return {
    start: arr[0],
    end: arr[arr.length - 1],
    invert: invert
  };
}

/* multipleSelectDown（bundle 35964-35972 逐字：ListLayout 委派 multipleSelectNext） */
export function machineryMultipleSelectDown(s: any, event: any): void {
  if (s.isCropMode) {
    moveCropToolChannel.emit({ horizontal: 0, vertical: 10 });
    return;
  }
  if (s.layout === "ListLayout") {
    machineryMultipleSelectNext(s, event);
  }
}

export function machineryMultipleSelectNext(s: any, event: any): void {
  if (s.$root.currentFocus == 'sidebar') return;
  if (s.isCropMode) {
    moveCropToolChannel.emit({ horizontal: 10, vertical: 0 });
    return;
  }
  if (s.isDetailMode) return;
  var selection = machineryGetSelection(s);
  var start = selection.start;
  var end = selection.end + 1;

  if (start < s.lastSelectedIndex) {
    let startItem = s.allData[start];
    let idx = s.selected.indexOf(startItem);
    if (idx !== -1) {
      s.selected.splice(idx, 1);
      syncInspectorFromScope();
      machineryAutoScroll(s, s.lastSelectedIndex);
    }
  }
  else {
    if (s.allData[end]) {
      s.selected.push(s.allData[end]);
      syncInspectorFromScope();
      machineryAutoScroll(s, end);
    }
  }
}

export function machineryMultipleSelectPrev(s: any, event: any): void {
  if (s.$root.currentFocus == 'sidebar') return;
  if (s.isCropMode) {
    moveCropToolChannel.emit({ horizontal: -10, vertical: 0 });
    return;
  }
  if (s.isDetailMode) return;
  var selection = machineryGetSelection(s);
  var start = selection.start;
  var end = selection.end;

  if (end > s.lastSelectedIndex) {
    let endItem = s.allData[end];
    let idx = s.selected.indexOf(endItem);
    if (idx !== -1) {
      s.selected.splice(idx, 1);
      syncInspectorFromScope();
      machineryAutoScroll(s, s.lastSelectedIndex);
    }
  }
  else {
    if (s.allData[start - 1]) {
      s.selected.push(s.allData[start - 1]);
      syncInspectorFromScope();
      machineryAutoScroll(s, start - 1);
    }
  }
}

/* multipleSelectUp（bundle 35898-35906 逐字：ListLayout 委派 multipleSelectPrev） */
export function machineryMultipleSelectUp(s: any, event: any): void {
  if (s.isCropMode) {
    moveCropToolChannel.emit({ horizontal: 0, vertical: -10 });
    return;
  }
  if (s.layout === "ListLayout") {
    machineryMultipleSelectPrev(s, event);
  }
}

export function machineryOpenInspectorFolderSelectPanel(s: any, event: any): void {
  const w = window as any;
  event && event.stopPropagation();

  if (s.selected.length === 0) return;

  const folders = s.folders;
  const originalSelectedIds = w.eagle.inspector.calculateFolders(s.selected).reduce((acc: any, cur: any) => {
    acc[cur] = true;
    return acc;
  }, {});

  FolderSelectPanel.open({
    folders: folders,
    selectedIds: originalSelectedIds,
    onChanged: (result: any) => {

      if (!result?.isDirty) return;

      const { selectedFolderIds, deselectedFolderIds } = result;
      machineryCheckOperationSafety(s, () => {
        try {
          let selectedFolders: any[] = [];
          let folderIds: any[] = [];
          let selectedItems: any[] = [];

          s.selected.forEach((item: any) => {
            selectedItems.push(item);
          });

          Object.keys(selectedFolderIds).forEach((folderId) => {
            if (s.folderMappings[folderId] && !originalSelectedIds[folderId]) {
              selectedFolders.push(s.folderMappings[folderId]);
              folderIds.push(folderId);
            }
          });

          addToRecentFolders(folderIds);

          let origin: any[] = [];
          let originFolders: any[] = [];
          let originTags: any[] = [];
          let originDeleted: any[] = [];

          selectedItems.forEach((item: any) => {
            origin.push(item);
            originFolders.push(structuredClone(item.folders));
            originTags.push(structuredClone(item.tags));
            originDeleted.push(item.isDeleted);
          });

          let removedFolderIds: any[] = [];
          Object.keys(deselectedFolderIds).forEach((folderId) => {
            removedFolderIds.push(folderId);
          });

          let hasChanged = false;
          let changedItems: any[] = [];
          let changedMaps: any = {};

          w.eagle.utils.tree.walk(s.folders, 'children', (folder: any, parent: any) => {
            // 添加新分类
            if (selectedFolderIds[folder.id] && !deselectedFolderIds[folder.id]) {
              selectedItems.forEach((item: any) => {
                if (item.folders.indexOf(folder.id) === -1) {
                  item.folders.push(folder.id);
                  if (folder.extendTags) {
                    folder.extendTags.forEach(function (tag: any) {
                      if (item.tags.indexOf(tag) === -1) {
                        item.tags.push(tag);
                      }
                    });
                  }
                  item.isDeleted = false;
                  hasChanged = true;
                  changedItems.push(item);
                  changedMaps[item.id] = true;
                }
              });
            }


            // 删除已有
            else if (deselectedFolderIds[folder.id]) {
              selectedItems.forEach((item: any) => {
                var idx2 = item.folders.indexOf(folder.id);
                if (idx2 !== -1) {
                  if (s.currentFolder && s.currentFolder.id === folder.id) {
                    w.ig.remove(q("#box-" + item.id));
                    s.currentFolder.imagesMappings[item.id] = false;
                  }
                  item.folders.splice(idx2, 1);
                  machineryUpdateFilterCounts(s, item, -1);
                  item.isDeleted = false;
                  hasChanged = true;
                  changedItems.push(item);
                  changedMaps[item.id] = true;
                }
              });
            }
          });

          changedItems = [...new Set(changedItems)];

          if (hasChanged) {
            w.ayncsImagesChange(changedItems);
            w.hiddenByCurrentFilter(changedItems);
            if (w.$bodyScope.viewMode === 'unfiled') {
              glRemoveitemsChannel.emit(w.$bodyScope.getSelectedItemElements());
            }

            machineryCalculateImageBinding(w.$bodyScope, { ignoreSort: true }, () => {
              machineryRebindRefresh(w.$bodyScope, true, undefined, undefined);
              machineryUpdateSelection(w.$bodyScope);
            });

            var message = getFilter()('i18n')("notify.image.moveToFolders", [
              { "property": "imageCount", "value": selectedItems.length },
              { "property": "folderCount", "value": selectedFolders.length }
            ]);

            if (s.selected.length === 1) {
              message = message.replace("images", "image");
            }
            if (selectedFolders.length === 1) {
              message = getFilter()('i18n')("notify.image.moveToFolder", [
                { "property": "folderId", "value": selectedFolders[0].id },
                { "property": "imageCount", "value": selectedItems.length },
                { "property": "folderName", "value": selectedFolders[0].name }
              ]);
            }

            // 復原操作
            s.$root.notify({
              message: message,
              duration: 4000,
            }, function () {
              origin.forEach((item: any, index: any) => {
                if (changedMaps[item.id]) {
                  item.folders = originFolders[index];
                  item.tags = originTags[index];
                  item.isDeleted = originDeleted[index];
                }
              });
              s.selected = origin;
              syncInspectorFromScope();
              s.current = origin[0];
              syncDetailFromScope();
              syncInspectorFromScope();
              calculateImageBindingChannel.emit();
              rebindRefreshChannel.emit(true);
              updateSelectionChannel.emit();
            });

            w.electronLog && w.electronLog.info(`[app] Categorize ${selectedItems.length} files to ${selectedFolders.length} folders`);
            w.analytics.event('File', 'Categorize', 'QuickCategorize');
          }
        }
        catch (err: any) {
          w.electronLog && w.electronLog.error(err.stack || err);
        }
      });
    }
  });
}

export function machineryOpenInspectorTagSelectPanel(s: any): void {
  if (s.selected.length === 0) return;
  inspectorTagSelectPanelOpenChannel.emit();
}

export function machineryRemoveSelected(s: any, event: any): void {
  const w = window as any;
  const $timeout = getTimeout();
  event?.preventDefault();
  event?.stopPropagation();

  if (s.$root.currentFocus == 'sidebar') {
    if (s.$root.selectedFolders.length > 0) {
      machineryRemoveSelectedFolders(s);
    }
    else if (s.$root.selectedSmartFolders.length > 0) {
      machineryRemoveSelectedSmartFolders(s);
    }
    else if (s.currentFolder) {
      machineryRemoveFolder(s, s.currentFolder);
    } else if (s.currentSmartFolder) {
      machineryRemoveSmartFolder(s, s.currentSmartFolder);
    }
  }
  else if (s.$root.currentFocus == 'tags') {
    if (s.currentTagGroup) {
      machineryRemoveTagGroup(s, s.currentTagGroup);
    }
  }
  else if (s.selectedFolderMappings && Object.keys(s.selectedFolderMappings).length > 0) {
    var selectedFolders = Object.keys(s.selectedFolderMappings).map(function (key: any) {
      return key;
    });
    var folderId = selectedFolders[0];
    if (folderId && s.folderMappings[folderId]) {
      machineryRemoveFolder(s, s.folderMappings[folderId], {
        ignoreSelectNext: true
      });
    }
  }
  else if (s.viewMode === 'alltags' && s.currentTagGroup) {
    var selectedTags = machineryGetSelectedTags(s);
    if (selectedTags && selectedTags.length > 0) {
      s.TagManager.removeTagsFromGroup(s.currentTagGroup.id, selectedTags);
    }
  }
  else {

    if (s.selected.length <= 0) return;

    if (s.viewMode == "trash") {
      w.swal({
        html: `
                            <div class="alert">
                                <div class="alert-icon warning"></div>
                                <h4 class="alert-title">${w.i18n.__('dialog.permanentlyDelay.title')}</h4>
                                <p class="alert-desc">${w.i18n.__("dialog.permanentlyDelay.desc")}</p>
                            </div>
                        `,
        showCloseButton: false, showCancelButton: true, allowOutsideClick: false, focusConfirm: false, focusCancel: false, padding: 24,
        allowEnterKey: false,
        width: 400,
        customClass: "alert-box",
        cancelButtonColor: "#777777",
        confirmButtonText: w.i18n.__('dialog.permanentlyDelay.button'),
        cancelButtonText: w.i18n.__("general.cancel"),
      }).then(function () {
        scopeEvalAsync(function () {
          machineryRemovePermanently(s);
        });
      });
    }
    else {
      machineryCheckOperationSafety(s, function () {
        s.lastIndex = machineryGetSelection(s).start;

        if (s.currentFolder) {

          // 强制重置该文件夹及祖先封面
          machineryResetFolderCover(s, s.currentFolder);

          var containsMultipleFolder = false;
          for (var i = 0; i < s.selected.length; i++) {
            var img = s.selected[i];
            if (img && img.folders && img.folders.length > 1) {
              containsMultipleFolder = true;
              break;
            }
          }
          if (containsMultipleFolder) {
            w.swal({
              html: `
                                        <div class="alert">
                                            <div class="alert-icon warning"></div>
                                            <h4 class="alert-title">${w.i18n.__("dialog.moveTrashWhenMultiCategory.title")}</h4>
                                            <p class="alert-desc">${w.i18n.__("dialog.moveTrashWhenMultiCategory.descript")}</p>
                                        </div>
                                    `,
              customClass: "alert-box check-multiple-categories-dialog",
              showCloseButton: false, showCancelButton: true, allowOutsideClick: false, focusConfirm: true, focusCancel: false, padding: 24,
              width: 400,
              cancelButtonColor: "#777777",
              input: 'radio',
              inputOptions: {
                '1': w.i18n.__("dialog.moveTrashWhenMultiCategory.checkbox"),
                '2': w.i18n.__("dialog.moveTrashWhenMultiCategory.button2"),
              },
              inputValue: lastMoveToTrashCheckbox,
              inputValidator: function (result: any) {
                return new Promise(function (resolve: any, reject: any) {
                  resolve(result);
                })
              },
              confirmButtonText: w.i18n.__("dialog.moveTrashWhenMultiCategory.button"),
              cancelButtonText: w.i18n.__("general.cancel"),
            }).then(function (result: any) {
              var isForceToTrash = (result === '2');
              lastMoveToTrashCheckbox = result;
              machineryRemoveFolderContents(s, { isForceToTrash: isForceToTrash });
              scopeEvalAsync();
            }, function () { });
          }
          else {
            machineryRemoveFolderContents(s, { isForceToTrash: true });
          }
        } else if (s.currentTag || s.currentSmartFolder || s.viewMode === 'all' || s.viewMode === 'unfiled' || s.viewMode === 'untagged' || s.viewMode === 'recent' || s.viewMode === 'random') {

          var origin: any[] = [];
          let now = Date.now();
          s.selected.forEach(function (image: any) {
            image.isDeleted = true;
            image.deletedTime = Date.now();
            origin.push(image);
            machineryUpdateFilterCounts(s, image, -1, now);
          });

          var message = getFilter()('i18n')("notify.image.remove", [
            { "property": "count", "value": s.selected.length },
          ]);
          if (s.selected.length === 1) { message = message.replace("images", "image"); }

          (s.$root.notify || s.notify).call(s.$root, {
            message: message,
            duration: 4000,
          }, function () {
            let now = Date.now();
            origin.forEach(function (image: any) {
              image.isDeleted = false;
              delete image.deletedTime;
              machineryUpdateFilterCounts(s, image, 1, now);
            });
            s.selected = origin;
            syncInspectorFromScope();
            if (s.isDetailMode) {
              s.current = origin[0];
              syncDetailFromScope();
              syncInspectorFromScope();
            }
            machineryCalculateImageBinding(s, { ignoreSort: true }, function () {
              if (
                s.viewMode !== 'random'
              ) {
                machineryRebindRefresh(s);
              }
              w.ScrollbarSaver.restoreScrollPosition();
            });
            w.ayncsImagesChange(origin);
            w.hiddenByCurrentFilter(origin);
          });

          if (s.isDetailMode) {
            $timeout(function () {
              machineryZoom(s);
            }, 100)
          }

          if (s.$root.preferences.notification.soundEffect.enable != 'false' && s.$root.preferences.notification.soundEffect.when.deleteImage == 'true') {
            s.removeSound && s.removeSound.play && s.removeSound.play();
          }
          w.ayncsImagesChange(s.selected);
          w.hiddenByCurrentFilter(s.selected);

          // 自動選取下一個圖片，如果沒有下一個，選上一個，都沒有就空
          s.lastIndex = machineryGetSelection(s).start;
          var next = s.allData[s.lastIndex + s.selected.length];
          var prev = s.allData[s.lastIndex - 1];

          if (next) {
            s.selected = [next];
            syncInspectorFromScope();
            if (s.isDetailMode) {
              s.current = next;
              syncDetailFromScope();
              syncInspectorFromScope();
            }
          } else if (prev) {
            s.selected = [prev];
            syncInspectorFromScope();
            if (s.isDetailMode) {
              s.current = prev;
              syncDetailFromScope();
              syncInspectorFromScope();
            }
          } else {
            s.selected = [];
            syncInspectorFromScope();
            if (s.isDetailMode) {
              machineryLeaveDetailMode(s);
            }
          }

          $timeout(function () {
            machineryForceFitImageSize(s, s.current);
            machineryZoom(s);
          }, 100);

          w.ScrollbarSaver.saveScrollPosition();

          var itemElements = machineryGetSelectedItemElements(s);
          glRemoveitemsChannel.emit(itemElements);

          s.lastSelectedIndex = machineryCurrentIndex(s) - 1;
          machineryAutoScroll(s);

          machineryCalculateImageBinding(s, { ignoreSort: true }, function () {
            if (
              s.viewMode !== 'random' ||
              (s.currentFolder && s.currentFolder.orderBy !== "RANDOM")
            ) {
              machineryRebindRefresh(s, true);
            }
            machineryUpdateSelection(s);
            if (s.currentFolder) { w.electronLog && w.electronLog.info(`[app] Remove ${itemElements.length} files from ${s.currentFolder.name}(${s.currentFolder.id}), folder remain ${s.currentFolder.imageCount} files, all remain ${s.all.length} files, trash remain ${s.trash.length} files`); }
            else { w.electronLog && w.electronLog.info(`[app] Remove ${itemElements.length} files, all remain ${s.all.length} files, trash remain ${s.trash.length} files`); }
          });
        } else {
          return;
        }
      }, 200);
    }
  }
}

export function machineryRemoveSelectedFolders(s: any): void {
  const w = window as any;
  if (s.$root.selectedFolders.length === 0) return;

  var removeConfirmMsg = getFilter()('i18n')("dialog.removeFolder.descMultiple", [
    { "property": "count", "value": s.$root.selectedFolders.length },
  ]);
  w.swal({
    html: `
                    <div class="alert">
                        <div class="alert-icon warning"></div>
                        <h4 class="alert-title">${getFilter()('i18n')('dialog.removeFolder.title')}</h4>
                        <p class="alert-desc">${removeConfirmMsg}</p>
                    </div>
                `,
    showCloseButton: false, showCancelButton: true, allowOutsideClick: false, focusConfirm: true, focusCancel: false, padding: 24,
    width: 400,
    customClass: "alert-box",
    cancelButtonColor: "#777777",
    input: 'checkbox',
    inputValue: 1,
    inputValidator: function (result: any) {
      return new Promise(function (resolve: any, reject: any) {
        resolve(result);
      })
    },
    inputPlaceholder: getFilter()('i18n')('dialog.removeFolder.checkbox'),
    confirmButtonText: getFilter()('i18n')('dialog.removeFolder.button'),
    cancelButtonText: getFilter()('i18n')("general.cancel"),
  }).then(function (result: any) {
    machineryCheckOperationSafety2(s, s.$root.selectedFolders.length, function () {
      var isDeleteImages = (result == 1);
      s.$root.selectedFolders.forEach(function (folder: any) {
        if (folder.password && !folder.isUnLock) return;
        machineryRemoveFolderInner(s, folder, { isDeleteImages: isDeleteImages, ignoreRestore: true });
      });
    }, 1);
  }, function () { });
}

export function machineryRemoveSelectedSmartFolders(s: any): void {
  const w = window as any;
  if (s.$root.selectedSmartFolders.length === 0) return;

  var removeConfirmMsg = getFilter()('i18n')("dialog.removeSmartFolder.descMultiple", [
    { "property": "count", "value": s.$root.selectedSmartFolders.length },
  ]);
  w.swal({
    html: `
                    <div class="alert">
                        <div class="alert-icon warning"></div>
                        <h4 class="alert-title">${w.i18n.__('dialog.removeSmartFolder.title')}</h4>
                        <p class="alert-desc">${removeConfirmMsg}</p>
                    </div>
                `,
    showCloseButton: false, showCancelButton: true, allowOutsideClick: false, focusConfirm: true, focusCancel: false, padding: 24,
    width: 400,
    customClass: "alert-box",
    cancelButtonColor: "#777777",
    confirmButtonText: w.i18n.__('dialog.removeSmartFolder.button'),
    cancelButtonText: w.i18n.__("general.cancel"),
  }).then(function (result: any) {
    s.$root.selectedSmartFolders.forEach(function (smartFolder: any) {
      machineryRemoveSmartFolderInner(s, smartFolder, { ignoreRestore: true });
    });
    s.$root.selectedSmartFolders = [];
  }, function () { });
}

/* selectAll（bundle 46628-46645 逐字） */
export function machinerySelectAll(s: any, event: any): void {
  const $timeout = getTimeout();
  event && event.stopPropagation();
  if (s.viewMode == 'alltags') {
    s.selectedTags = {};
    syncTagManagerFromScope();
    s.TagManager.tagsResult.tags.forEach((tagName: any) => {
      s.selectedTags[tagName] = true;
      syncTagManagerFromScope();
    });
  }
  else {
    var selected: any[] = [];
    Array.prototype.push.apply(selected, s.allData);
    s.selected = selected;
    syncInspectorFromScope();
    s.selectedMappings = {};
    $timeout.cancel(cleanSelectedTimeout);
    s.$root.currentFocus = "content";
  }
}

export function machinerySelectDown(s: any, event: any): void {
  event && event.preventDefault();
  var selection = machineryGetSelection(s);
  var end = selection.end || 0;
  var $arround = machineryGetArroundBox(s, end);
  var $box = qa(".box.selected").slice(-1)[0] as HTMLElement | undefined;
  var boxOffest = offsetOf($box || null);
  if (!boxOffest) return;
  var boxCenterX = boxOffest.left;
  var boxCenterY = boxOffest.top;
  var target: HTMLElement | undefined;
  var d = 100000;
  qa(".box").forEach(function (b) {
    var $b = b;
    var offset = offsetOf($b);
    if (!offset) return;
    var bx = offset.left;
    var by = offset.top;
    if (s.layout === "GridLayout") {
      var td = Math.abs(by - boxCenterY);
      if (boxCenterX == bx && by > boxCenterY) {
        if (td < d) {
          d = td;
          target = $b;
        }
      }
    }
    else {
      var td2 = Math.sqrt((boxCenterY - by) * (boxCenterY - by) + (boxCenterX - bx) * (boxCenterX - bx));
      if (boxCenterY < offset.top && Math.abs(boxCenterY - offset.top) > 20) {
        if (td2 < d) {
          d = td2;
          target = $b;
        }
      }
    }
  });
  if (target) {
    var image = machineryGetItemByElement(s, target);
    s.selected = [image];
    syncInspectorFromScope();
    s.selectedFolderMappings = {};
    syncListFromScope();
    if (s.isDetailMode) {
      s.current = s.selected[0];
      syncDetailFromScope();
      syncInspectorFromScope();
    }
    machineryAutoScroll(s, target);
  }
  if (s.isDetailMode) {
    machineryForceFitImageSize(s, s.selected[0], true);
    s.current = s.selected[0];
    syncDetailFromScope();
    syncInspectorFromScope();
    s.isGifReady = false;
    syncDetailFromScope();
    detailZoom()?.updateNavigator( s.current);
    if (!machineryLastZoom(s)) {
      machineryZoom(s);
    }
  }
}

/* selectFolder（bundle 34666-34676 逐字：文件夹单项选中重置面） */
export function machinerySelectFolder(s: any, event: any, folder: any): void {
  (document.activeElement as any).blur();
  if (folder) {
    s.selectedFolderMappings = {};
    syncListFromScope();
    s.selectedMappings = {};
    s.selectedFolderMappings[folder.id] = true;
    syncListFromScope();
    s.$root.currentFocus = "content";
    s.selected = [];
    syncInspectorFromScope();
    machineryUpdateSelection(s);
  }
}

export function machinerySelectNext(s: any, event: any): void {
  const w = window as any;
  const $timeout = getTimeout();
  if (s.isCropMode) {
    moveCropToolChannel.emit({ horizontal: 1, vertical: 0 });
    return;
  }

  var selection = machineryGetSelection(s);
  var start = selection.start;
  var end = selection.end + 1;

  if (s.isDetailMode) {
    machineryRememberScrollTops(s, s.current);
  }

  if (!s.allData[end]) {
    show("#is-last-item");
    setTimeout(() => { hide("#is-last-item"); }, 500);
    return;
  }
  else {
    detailZoom()?.cleanBitmapViewer();
  }

  s.selected = [s.allData[end]];
  syncInspectorFromScope();
  s.selectedFolderMappings = {};
  syncListFromScope();
  s.$root.currentFocus = "content";

  if (s.isDetailMode) {
    $timeout.cancel(nextTimeout);
    machineryForceFitImageSize(s, s.selected[0], true);
    s.current = s.selected[0];
    syncDetailFromScope();
    syncInspectorFromScope();
    s.isGifReady = false;
    syncDetailFromScope();
  }

  machineryAutoScroll(s, end);

  if (s.current) {
    detailZoom()?.updateNavigator( s.current);
    if (!machineryLastZoom(s)) {
      machineryZoom(s);
    }
    nextTimeout = $timeout(function () {
      if (!machineryLastZoom(s)) {
        machineryZoom(s);
      }
      var nextImage = s.allData[end + 1];
      machineryPreloadImage(s, "next");
    }, 100);
    machineryAddToRecentFile(s, s.current);
  }
}

export function machinerySelectPrev(s: any, event: any): void {
  const w = window as any;
  const $timeout = getTimeout();
  if (s.isCropMode) {
    moveCropToolChannel.emit({ horizontal: -1, vertical: 0 });
    return;
  }

  var selection = machineryGetSelection(s);
  var start = selection.start;
  var end = selection.end + 1;

  if (start === 0) {
    show("#is-first-item");
    setTimeout(() => { hide("#is-first-item"); }, 500);
    return;
  }
  if (s.allData.length == 0) { return; }

  if (s.isDetailMode) {
    detailZoom()?.cleanBitmapViewer();
    machineryRememberScrollTops(s, s.current);
    s.isGifReady = false;
    syncDetailFromScope();
  }

  if (s.allData[start - 1]) {
    s.selected = [];
    syncInspectorFromScope();
    s.selected.push(s.allData[start - 1]);
    syncInspectorFromScope();
    if (s.isDetailMode) {
      machineryForceFitImageSize(s, s.selected[0], true);
      s.current = s.selected[0];
      syncDetailFromScope();
      syncInspectorFromScope();
    }
    machineryAutoScroll(s, start - 1);
  } else {
    s.selected = [];
    syncInspectorFromScope();
    s.selected.push(s.allData[0]);
    syncInspectorFromScope();
    machineryForceFitImageSize(s, s.selected[0], true);
    s.current = s.selected[0];
    syncDetailFromScope();
    syncInspectorFromScope();
    machineryAutoScroll(s, 0);
  }
  s.selectedFolderMappings = {};
  syncListFromScope();
  s.$root.currentFocus = "content";
  if (s.current) {
    detailZoom()?.updateNavigator( s.current);
    if (!machineryLastZoom(s)) {
      machineryZoom(s);
    }
    $timeout.cancel(prevTimeout);
    prevTimeout = $timeout(function () {
      if (!machineryLastZoom(s)) {
        machineryZoom(s);
      }
      machineryPreloadImage(s, "prev");
    }, 100);
    machineryAddToRecentFile(s, s.current);
  }
}

export function machinerySelectUp(s: any, event: any): void {
  event && event.preventDefault();

  var selection = machineryGetSelection(s);
  var start = selection.start;
  var $box = q(".box.selected");
  var boxOffest = offsetOf($box);
  if (!boxOffest) return;
  var boxCenterX = boxOffest.left;
  var boxCenterY = boxOffest.top;
  var target: HTMLElement | undefined;
  var d = 100000;

  qa(".box").forEach(function (b) {
    var $b = b;
    var offset = offsetOf($b);
    if (!offset) return;
    var bx = offset.left;
    var by = offset.top;
    if (s.layout === "GridLayout") {
      var td = Math.abs(boxCenterY - by);
      if (boxCenterX == bx && boxCenterY > by) {
        if (td < d) {
          d = td;
          target = $b;
        }
      }
    }
    else {
      var td2 = Math.sqrt((boxCenterY - by) * (boxCenterY - by) + (boxCenterX - bx) * (boxCenterX - bx));
      if (boxCenterY > offset.top && Math.abs(boxCenterY - offset.top) > 20) {
        if (td2 < d) {
          d = td2;
          target = $b;
        }
      }
    }
  });
  if (target) {
    var image = machineryGetItemByElement(s, target);
    s.selected = [image];
    syncInspectorFromScope();
    s.selectedFolderMappings = {};
    syncListFromScope();
    if (s.isDetailMode) {
      s.current = s.selected[0];
      syncDetailFromScope();
      syncInspectorFromScope();
    }
    machineryAutoScroll(s, target);
  }
  if (s.isDetailMode) {
    machineryForceFitImageSize(s, s.selected[0], true);
    s.current = s.selected[0];
    syncDetailFromScope();
    syncInspectorFromScope();
    s.isGifReady = false;
    syncDetailFromScope();
    detailZoom()?.updateNavigator( s.current);
    if (!machineryLastZoom(s)) {
      machineryZoom(s);
    }
  }
}

export function machineryToggleSelectSmartFolder(s: any, event: any, smartFolder: any): void {
  var expand = !smartFolder.isExpand;
  var smartFolders = smartFolder.children;
  smartFolder.isExpand = expand;
  machineryToggleCurrentLevelSmartFoldersInner(s, smartFolders, expand);
}

export function machineryUpdateSelection(s: any): void {
  machineryCalls.updateSelection++;
  const w = window as any;
  // shim 世界保留桥：React inspector 面板经 UPDATE_INSPECTOR 刷新（bundle 54678 版无此广播，
  // 其 UI 直接双向绑定 scope.inspector.*——适配注明）
  updateInspectorChannel.emit();

  /* bundle 54678-54826 完整版逐字（双赋值怪癖：34662 简版被本版覆盖——此前只移植了被覆盖的
     简版；inspector 字段派生（newTags/newName/newUrl/newAnnotation/folders/star/size/
     activeTab/category）经 30ms $timeout 防抖写 scope.inspector.*，7d3a 三断言与
     InspectorTagSelectPanel 的 eagle.inspector.newTags 数据源。适配：$scope→s /
     $rootScope→s.$root / $timeout→getTimeout() / $filter→getFilter() / i18n→w.i18n /
     eagle→w.eagle / $bodyScope→getBodyScope()。s.inspector 即 eagle.inspector（bundle
     21615/54307 `$scope.inspector = eagle.inspector` 同引用） */
  getTimeout().cancel(updateSelectionTimeout);
  updateSelectionTimeout = getTimeout()(function () {

    var selected = s.selected;
    if (selected.length > 1) {
      s.inspector.newNamePlaceholder = w.i18n.__("inspector.names.multipleTitles");
      syncInspectorFromScope();
      s.inspector.newUrlPlaceholder = w.i18n.__("inspector.names.multipleUrls");
      syncInspectorFromScope();
      s.inspector.newName = w.eagle.inspector.calculateName(selected);
      syncInspectorFromScope();
      s.inspector.newUrl = w.eagle.inspector.calculateUrl(selected);
      syncInspectorFromScope();
      s.inspector.newTags = w.eagle.inspector.calculateTags(selected);
      syncInspectorFromScope();
      s.inspector.newAnnotation = w.eagle.inspector.calculateAnnotation(selected);
      syncInspectorFromScope();
      s.inspector.folders = w.eagle.inspector.calculateFolders(selected);
      s.inspector.star = w.eagle.inspector.calculateStar(selected);
      syncInspectorFromScope();
      s.inspector.size = w.eagle.inspector.calculateFileSize(selected);
      syncInspectorFromScope();
      s.inspector.activeTab = "ITEM";
      syncInspectorFromScope();
    } else if (selected.length == 1) {
      if (selected[0]) {
        s.inspector.newNamePlaceholder = getFilter()('i18n')("title");
        syncInspectorFromScope();
        s.inspector.newUrlPlaceholder = "http://";
        syncInspectorFromScope();
        s.inspector.newName = selected[0].name || "";
        syncInspectorFromScope();
        s.inspector.newUrl = selected[0].url || "";
        syncInspectorFromScope();
        s.inspector.newTags = selected[0].tags;
        syncInspectorFromScope();
        s.inspector.newAnnotation = selected[0].annotation || "";
        syncInspectorFromScope();
        s.inspector.folders = [];
        s.inspector.star = selected[0].star || 0;
        syncInspectorFromScope();
        s.inspector.activeTab = "ITEM";
        syncInspectorFromScope();
      }
    }
    else {
      s.inspector.activeTab = "SIDEBAR";
      syncInspectorFromScope();
      switch (s.viewMode) {
        case "all":
          s.inspector.category = {
            newName: w.i18n.__('inspector.names.all'),
            newDescription: "",
            createDate: undefined,
            imageCount: useItemState.getState().all.length,
            fileSize: w.eagle.inspector.calculateFileSize(useItemState.getState().all),
            exportable: false,
            editable: false
          };
          syncInspectorFromScope();
          break;
        case "unfiled":
          s.inspector.category = {
            newName: w.i18n.__('inspector.names.unfiled'),
            newDescription: "",
            createDate: undefined,
            imageCount: useListState.getState().unfiledCount,
            fileSize: w.eagle.inspector.calculateFileSize(useItemState.getState().allData),
            exportable: false,
            editable: false
          };
          syncInspectorFromScope();
          break;
        case "untagged":
          s.inspector.category = {
            newName: w.i18n.__('inspector.names.untagged'),
            newDescription: "",
            createDate: undefined,
            imageCount: useListState.getState().untaggedCount,
            fileSize: w.eagle.inspector.calculateFileSize(useItemState.getState().allData),
            exportable: false,
            editable: false
          };
          syncInspectorFromScope();
          break;
        case "trash":
          s.inspector.category = {
            newName: w.i18n.__('inspector.names.trash'),
            newDescription: "",
            createDate: undefined,
            imageCount: useItemState.getState().allData.length,
            fileSize: w.eagle.inspector.calculateFileSize(useItemState.getState().allData),
            exportable: false,
            editable: false
          };
          syncInspectorFromScope();
          break;
        case "duplicate":
          s.inspector.category = {
            newName: getFilter()('i18n')('inspector.names.duplicate'),
            newDescription: "",
            createDate: undefined,
            imageCount: useItemState.getState().allData.length,
            fileSize: w.eagle.inspector.calculateFileSize(useItemState.getState().allData),
            exportable: false,
            editable: false
          };
          syncInspectorFromScope();
          break;
        default:
          if (s.$root.selectedFolders.length > 0) {
            s.inspector.category = {
              newName: w.i18n.__('inspector.names.multipleTitles'),
              newDescription: "",
              createDate: undefined,
              imageCount: useItemState.getState().allData.length,
              fileSize: w.eagle.inspector.calculateFileSize(useItemState.getState().allData),
              exportable: false,
              editable: false
            };
            syncInspectorFromScope();
          }
          else if (s.selectedFolderMappings && Object.keys(s.selectedFolderMappings).length >= 1) {
            var selectedFolders = Object.keys(s.selectedFolderMappings).map(function (key) {
              return key;
            });
            if (selectedFolders[0] && s.folderMappings[selectedFolders[0]]) {
              w.eagle.inspector.inspectorFolder = s.folderMappings[selectedFolders[0]];
              s.inspector.category = {
                newName: w.eagle.inspector.inspectorFolder.name,
                newDescription: w.eagle.inspector.inspectorFolder.description || "",
                createDate: w.eagle.inspector.inspectorFolder.modificationTime,
                imageCount: w.eagle.inspector.inspectorFolder.imageCount,
                fileSize: undefined,
                exportable: !(w.eagle.inspector.inspectorFolder.password && !w.eagle.inspector.inspectorFolder.isUnLock),
                editable: !(w.eagle.inspector.inspectorFolder.password && !w.eagle.inspector.inspectorFolder.isUnLock)
              };
              syncInspectorFromScope();
            }
          }
          else if (s.currentFolder) {
            w.eagle.inspector.inspectorFolder = s.currentFolder;
            s.inspector.category = {
              newName: w.eagle.inspector.inspectorFolder.name,
              newDescription: w.eagle.inspector.inspectorFolder.description || "",
              createDate: w.eagle.inspector.inspectorFolder.modificationTime,
              imageCount: useItemState.getState().allData.length,
              fileSize: w.eagle.inspector.calculateFileSize(useItemState.getState().allData),
              exportable: true,
              editable: true
            };
            syncInspectorFromScope();
          }
          else if (s.currentSmartFolder) {
            s.inspector.category = {
              newName: s.currentSmartFolder.name,
              newDescription: s.currentSmartFolder.description || "",
              createDate: s.currentSmartFolder.modificationTime,
              imageCount: useItemState.getState().allData.length,
              fileSize: w.eagle.inspector.calculateFileSize(useItemState.getState().allData),
              exportable: true,
              editable: true
            };
            syncInspectorFromScope();
          }
      }
    }

    // 排序標籤，優先使用群組順序排，皆者使用字母順序排
    if (s.inspector.newTags.length > 0) {
      s.inspector.newTags = sortTagsForSelection(s, s.inspector.newTags);
      syncInspectorFromScope();
    }
  }, 30);
}

// ── c18e-1 域内自管（原 controller 闭包 var：nextTimeout 36419 邻域 / prevTimeout 36536 邻域）──
let nextTimeout: any = null;

let prevTimeout: any = null;

/* sortTags（bundle 54828 逐字；$scope→s。try/catch 原码自带——tagMappings 缺项不炸派生） */
function sortTagsForSelection(s: any, original: any): any {
  try {
    if (!original || original.length === 0) return;
    let tags = [...original];

    const tagGroupsIndexMap: any = {};
    s.TagManager.groups.forEach((tagGroup: any, index: any) => {
      tagGroupsIndexMap[tagGroup.id] = index;
    });

    tagGroupsIndexMap['none'] = s.TagManager.groups.length;

    tags = tags.sort((tagA: any, tagB: any) => {
      const a = s.TagManager.tagMappings[tagA];
      const b = s.TagManager.tagMappings[tagB];
      const aName = a.name;
      const bName = b.name;
      const aGroup = a?.groups?.[0] || 'none';
      const bGroup = b?.groups?.[0] || 'none';

      // sort by groups index, if same group, sort by name
      if (tagGroupsIndexMap[aGroup] < tagGroupsIndexMap[bGroup]) return -1;
      if (tagGroupsIndexMap[aGroup] > tagGroupsIndexMap[bGroup]) return 1;
      if (aName < bName) return -1;
      if (aName > bName) return 1;
      return 0;
    });

    return tags;
  } catch (err) {
    console.error(err);
    return original;
  }
}

/* updateSelection（bundle 34662-34665 逐字） */
// b1-9n：updateSelectionTimeout 为 bundle link var（updateSelection $timeout 防抖句柄）
let updateSelectionTimeout: any = null;
