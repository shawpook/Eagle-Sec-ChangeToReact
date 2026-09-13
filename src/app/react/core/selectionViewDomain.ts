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
import { getWindowScope } from './scopeFace';
import { persistSweep, sweepForeignWatchers } from './appCore';
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
import { useBodyState } from '../store/bodyState';
import { usePreferencesState } from '../store/preferencesState';
import { useFolderState } from '../store/folderState';
import { writeScopeField } from './scopeFieldBridge';
let done = false;

function domainTimeout(fn: any, ms?: number): any {
  return setTimeout(() => {
    try { if (typeof fn === 'function') fn(); } finally { try { scopeEvalAsync(); } catch (err) { /* noop */ } }
  }, ms || 0);
}


function removeScopeListener(evt: string): number {
  let removed = 0;
  try {
    const listeners = useMiscRawState.getState().$$listeners && useMiscRawState.getState().$$listeners[evt];
    if (Array.isArray(listeners)) {
      removed = listeners.length;
      useMiscRawState.getState().$$listeners[evt] = [];
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

 // E1c：原以 $watch 存在性判 scope 就绪；shim 已移除 $watch

  // ── watchCollection "selected"（34214 主 watcher；摘 body scope 全部 'selected' watcher）──
  // ── selected 主 watcher（34214-34259 逐字；b1-9l 补挂——此前仅 darwin quicklook 变体注册过
  //    （平台守卫错位），win32 上选中集变化无人重建 selectedMappings / 触发 updateSelection，
  //    m1-E-selected-watch 断言面。依赖：setLastItem（38490 link var 逐字）、selectItemsView
  //    （35073 逐字）随 watcher 一并补挂；AnnotationPreview（52076）整条未端口——按存在性守卫）──
  const setLastItem = w.debounce(function (item: any) {
    if (item) {
      localStorage.setItem(`eagle.lastViewItem.${useMiscRawState.getState().rootDir}`, item.id);
      localStorage.setItem(`eagle.lastViewItemTime.${useMiscRawState.getState().rootDir}`, String(Date.now()));
    }
  }, 333);
  const selectItemsView = function (items: any) {
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
  onSelectedChanged(function (oldValue: any) {

    writeScopeField('selectedMappings', {});
    writeScopeField('zoomFitSize', 0);

    useSelectionState.getState().selected.forEach(function (image: any, index: any) {
      if (image) {
        useItemState.getState().selectedMappings[image.id] = true;
      }
    });

    if (useSelectionState.getState().selected.length > 0) {
      machineryUpdateSelection();
    }

    if (useBodyState.getState().isDetailMode && useBodyState.getState().smoothZoomDone) {
      // 只在「詳情模式中切換圖片」時執行。（bundle 原注：剛進入詳情模式時 smoothZoomDone
      // 為 false，#detail-image 尚未渲染，這些 DOM 操作無意義，且 updateNavigator 會在
      // enterDetailMode 的 $timeout 中重做。）
      writeScopeField('showLargeImage', false);
      machineryRememberVideoCurrentTime(oldValue[0]);
      if (w.AnnotationPreview) w.AnnotationPreview.hide();
      dataSet(q("#detail-image"), "degree", 0);
      cssSet("#detail-image", {
        "transform": ``,
      });
      setTimeout(() => {
        detailZoom()?.updateNavigator( useSelectionState.getState().current);
      }, 300);
    }

    if (useSelectionState.getState().selected.length === 1) {
      writeScopeField('lastSelectedIndex', machineryCurrentIndex() - 1);
    }

    // 全选
    if (useSelectionState.getState().selected.length === useItemState.getState().allData.length) {
      writeScopeField('lastSelectedIndex', useSelectionState.getState().selected.length - 1);
      addClass(".box", "selected");
    }
    else {
      selectItemsView(useSelectionState.getState().selected);
    }

    var lastItem = useSelectionState.getState().selected[0];
    if (lastItem) {
      setLastItem(lastItem);
    }
  });

  // ── darwin quicklook watch（34265；平台守卫内注册，与 bundle 一致）──
  if (w.process.platform == 'darwin') {
    onSelectedChanged(w.debounce(function () {
      // 如果当前是预览视窗开启状态，切换内容时要自动在开启预览视窗
      if (useSelectionState.getState().selected.length === 1 && useMiscRawState.getState().isPreviewing) {
        const ipc: any = w.$$electronIpc || w.__eagleIpc;
        if (ipc && ipc.send) ipc.send('quicklook', useSelectionState.getState().selected[0]);
      }
    }, 300, true));
  }

  // ── imageSize.height（34200 逐字）── b1-9bz-C-4：$watch → 写入点直调
  // 实现（enlarge/shrink）已迁到 dataMachinery 的 machineryEnlarge/ShrinkThumbnails，
  // 由 machineryOnImageSizeHeightChanged 统一入口在写入点调用（Toolbar 滑条 / openAll /
  // zoomActual）。保留 Angular $watch「注册即触发一次」的语义。
  {
    {
      // 原 watcher 首次触发发生在 flush（域接管之后、scope 已就绪）；此处为同步接管路径，
      // 直接调用可能早于 scope 就绪 —— 用 try/catch 兜住，避免中断后续通道注册。
      try { machineryOnImageSizeHeightChanged(); } catch (err) { /* noop */ }
    }
  }

  // ── imageSize.zoomRatio（34211 逐字）── b1-9bz-C-4：$watch → 写入点直调
  // 由 machineryOnZoomRatioChanged 在 5 个写入点调用（dataMachinery ×3 + detailService ×2）。
  // 保留 Angular $watch「注册即触发一次」的语义（try/catch 兜住：接管时 scope 可能未就绪）。
  {
    {
      try { machineryOnZoomRatioChanged(); } catch (err) { /* noop */ }
    }
  }

  // ── listMetaType（37269 逐字）── b1-9bz-C-4：$watch → 显式调用
  // 原 $watch 的语义是「外部写 s.listMetaType 后触发 changeMetaItems」；唯一外部写入点
  // （SmallPanels 的元信息下拉）已改为直接调 machineryChangeMetaItems。
  // 另：Angular $watch 注册时会以 (当前值, 当前值) 立即触发一次 listener —— 保留该语义。
  {
    {
      try { machineryChangeMetaItems(useMiscRawState.getState().listMetaType); } catch (err) { /* noop */ }
    }
  }

  // ── $on UPDATE_SELECTION / SAVE_FOLDER（42379/42383 逐字）──
  diag.listenersRemoved['UPDATE_SELECTION'] = removeScopeListener('UPDATE_SELECTION');
  updateSelectionChannel.on(function () {
    machineryUpdateSelection();
  });

  diag.listenersRemoved['SAVE_FOLDER'] = removeScopeListener('SAVE_FOLDER');
  saveFolderChannel.on(function () {
    machinerySaveFolder();
  });
}


// ═══ b1-9bz-D-1 B-5：零依赖声明归位（dataMachinery 剪出，逐字）═══
// ── c18d 域内自管（原 controller 闭包 var：cleanSelectedTimeout，46644 邻域）──
let cleanSelectedTimeout: any = null;

// ── c18e-2b 域内自管（原 controller 闭包 var：lastMoveToTrashCheckbox 46118）──
let lastMoveToTrashCheckbox: any = 1;

/* getSelectedItemElements（bundle 21864-21876 逐字） */
export function machineryGetSelectedItemElements(): any[] {
  var items = machineryGetSelectedItems();
  items = items.map(function (item: any) {
    // if (!item.el) {
    //     item.el = $(item.content)[0];
    //     console.log(item.el);
    // }
    return item.el;
  });
  return items;
}

export function machineryGetSelectedItems(): any[] {
  const w = window as any;
  var items = w.ig.getItems(true);
  items = items.filter(function (item: any) {
    return useItemState.getState().selectedMappings[item.id];
    // if (item && item.el && item.el.id) {
    //     var id = item.el.id.replace("box-", "");
    //     return $scope.selectedMappings[id] !== undefined;
    // }
  });
  return items;
}

/* getSelectedTags（bundle 38865-38869 逐字） */
export function machineryGetSelectedTags(): string[] {
  if (!useMiscRawState.getState().selectedTags) return [];
  return Object.keys(useMiscRawState.getState().selectedTags);
}

/* getSelection（bundle 36632-36649 逐字） */
export function machineryGetSelection(): any {
  var arr: any[] = [];
  useSelectionState.getState().selected.forEach(function (image: any) {
    var idx = useItemState.getState().allData.indexOf(image);
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
export function machineryMultipleSelectDown(event: any): void {
  if (useBodyState.getState().isCropMode) {
    moveCropToolChannel.emit({ horizontal: 0, vertical: 10 });
    return;
  }
  if (useBodyState.getState().layout === "ListLayout") {
    machineryMultipleSelectNext(event);
  }
}

export function machineryMultipleSelectNext(event: any): void {
  if (useBodyState.getState().currentFocus == 'sidebar') return;
  if (useBodyState.getState().isCropMode) {
    moveCropToolChannel.emit({ horizontal: 10, vertical: 0 });
    return;
  }
  if (useBodyState.getState().isDetailMode) return;
  var selection = machineryGetSelection();
  var start = selection.start;
  var end = selection.end + 1;

  if (start < useSelectionState.getState().lastSelectedIndex) {
    let startItem = useItemState.getState().allData[start];
    let idx = useSelectionState.getState().selected.indexOf(startItem);
    if (idx !== -1) {
      useSelectionState.getState().selected.splice(idx, 1);
      syncInspectorFromScope();
      machineryAutoScroll(useSelectionState.getState().lastSelectedIndex);
    }
  }
  else {
    if (useItemState.getState().allData[end]) {
      useSelectionState.getState().selected.push(useItemState.getState().allData[end]);
      syncInspectorFromScope();
      machineryAutoScroll(end);
    }
  }
}

export function machineryMultipleSelectPrev(event: any): void {
  if (useBodyState.getState().currentFocus == 'sidebar') return;
  if (useBodyState.getState().isCropMode) {
    moveCropToolChannel.emit({ horizontal: -10, vertical: 0 });
    return;
  }
  if (useBodyState.getState().isDetailMode) return;
  var selection = machineryGetSelection();
  var start = selection.start;
  var end = selection.end;

  if (end > useSelectionState.getState().lastSelectedIndex) {
    let endItem = useItemState.getState().allData[end];
    let idx = useSelectionState.getState().selected.indexOf(endItem);
    if (idx !== -1) {
      useSelectionState.getState().selected.splice(idx, 1);
      syncInspectorFromScope();
      machineryAutoScroll(useSelectionState.getState().lastSelectedIndex);
    }
  }
  else {
    if (useItemState.getState().allData[start - 1]) {
      useSelectionState.getState().selected.push(useItemState.getState().allData[start - 1]);
      syncInspectorFromScope();
      machineryAutoScroll(start - 1);
    }
  }
}

/* multipleSelectUp（bundle 35898-35906 逐字：ListLayout 委派 multipleSelectPrev） */
export function machineryMultipleSelectUp(event: any): void {
  if (useBodyState.getState().isCropMode) {
    moveCropToolChannel.emit({ horizontal: 0, vertical: -10 });
    return;
  }
  if (useBodyState.getState().layout === "ListLayout") {
    machineryMultipleSelectPrev(event);
  }
}

export function machineryOpenInspectorFolderSelectPanel(event: any): void {
  const w = window as any;
  event && event.stopPropagation();

  if (useSelectionState.getState().selected.length === 0) return;

  const folders = useFolderState.getState().folders;
  const originalSelectedIds = w.eagle.inspector.calculateFolders(useSelectionState.getState().selected).reduce((acc: any, cur: any) => {
    acc[cur] = true;
    return acc;
  }, {});

  FolderSelectPanel.open({
    folders: folders,
    selectedIds: originalSelectedIds,
    onChanged: (result: any) => {

      if (!result?.isDirty) return;

      const { selectedFolderIds, deselectedFolderIds } = result;
      machineryCheckOperationSafety(() => {
        try {
          let selectedFolders: any[] = [];
          let folderIds: any[] = [];
          let selectedItems: any[] = [];

          useSelectionState.getState().selected.forEach((item: any) => {
            selectedItems.push(item);
          });

          Object.keys(selectedFolderIds).forEach((folderId) => {
            if (useItemState.getState().folderMappings[folderId] && !originalSelectedIds[folderId]) {
              selectedFolders.push(useItemState.getState().folderMappings[folderId]);
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

          w.eagle.utils.tree.walk(useFolderState.getState().folders, 'children', (folder: any, parent: any) => {
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
                  if (useFolderState.getState().currentFolder && useFolderState.getState().currentFolder.id === folder.id) {
                    w.ig.remove(q("#box-" + item.id));
                    useFolderState.getState().currentFolder.imagesMappings[item.id] = false;
                  }
                  item.folders.splice(idx2, 1);
                  machineryUpdateFilterCounts(item, -1);
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
            const _ws: any = getWindowScope();
            if (_ws.viewMode === 'unfiled') {
              glRemoveitemsChannel.emit(_ws.getSelectedItemElements());
            }

            machineryCalculateImageBinding({ ignoreSort: true }, () => {
              machineryRebindRefresh(true, undefined, undefined);
              machineryUpdateSelection();
            });

            var message = getFilter()('i18n')("notify.image.moveToFolders", [
              { "property": "imageCount", "value": selectedItems.length },
              { "property": "folderCount", "value": selectedFolders.length }
            ]);

            if (useSelectionState.getState().selected.length === 1) {
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
            useMiscRawState.getState().notify({
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
              writeScopeField('selected', origin);
              syncInspectorFromScope();
              writeScopeField('current', origin[0]);
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

export function machineryOpenInspectorTagSelectPanel(): void {
  if (useSelectionState.getState().selected.length === 0) return;
  inspectorTagSelectPanelOpenChannel.emit();
}

export function machineryRemoveSelected(event: any): void {
  const w = window as any;
  const $timeout = getTimeout();
  event?.preventDefault();
  event?.stopPropagation();

  if (useBodyState.getState().currentFocus == 'sidebar') {
    if (useMiscRawState.getState().selectedFolders.length > 0) {
      machineryRemoveSelectedFolders();
    }
    else if (useMiscRawState.getState().selectedSmartFolders.length > 0) {
      machineryRemoveSelectedSmartFolders();
    }
    else if (useFolderState.getState().currentFolder) {
      machineryRemoveFolder(useFolderState.getState().currentFolder);
    } else if (useFolderState.getState().currentSmartFolder) {
      machineryRemoveSmartFolder(useFolderState.getState().currentSmartFolder);
    }
  }
  else if (useBodyState.getState().currentFocus == 'tags') {
    if (useMiscRawState.getState().currentTagGroup) {
      machineryRemoveTagGroup(useMiscRawState.getState().currentTagGroup);
    }
  }
  else if (useItemState.getState().selectedFolderMappings && Object.keys(useItemState.getState().selectedFolderMappings).length > 0) {
    var selectedFolders = Object.keys(useItemState.getState().selectedFolderMappings).map(function (key: any) {
      return key;
    });
    var folderId = selectedFolders[0];
    if (folderId && useItemState.getState().folderMappings[folderId]) {
      machineryRemoveFolder(useItemState.getState().folderMappings[folderId], {
        ignoreSelectNext: true
      });
    }
  }
  else if (useBodyState.getState().viewMode === 'alltags' && useMiscRawState.getState().currentTagGroup) {
    var selectedTags = machineryGetSelectedTags();
    if (selectedTags && selectedTags.length > 0) {
      useMiscRawState.getState().TagManager.removeTagsFromGroup(useMiscRawState.getState().currentTagGroup.id, selectedTags);
    }
  }
  else {

    if (useSelectionState.getState().selected.length <= 0) return;

    if (useBodyState.getState().viewMode == "trash") {
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
          machineryRemovePermanently();
        });
      });
    }
    else {
      machineryCheckOperationSafety(function () {
        writeScopeField('lastIndex', machineryGetSelection().start);

        if (useFolderState.getState().currentFolder) {

          // 强制重置该文件夹及祖先封面
          machineryResetFolderCover(useFolderState.getState().currentFolder);

          var containsMultipleFolder = false;
          for (var i = 0; i < useSelectionState.getState().selected.length; i++) {
            var img = useSelectionState.getState().selected[i];
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
              machineryRemoveFolderContents({ isForceToTrash: isForceToTrash });
              scopeEvalAsync();
            }, function () { });
          }
          else {
            machineryRemoveFolderContents({ isForceToTrash: true });
          }
        } else if (useMiscRawState.getState().currentTag || useFolderState.getState().currentSmartFolder || useBodyState.getState().viewMode === 'all' || useBodyState.getState().viewMode === 'unfiled' || useBodyState.getState().viewMode === 'untagged' || useBodyState.getState().viewMode === 'recent' || useBodyState.getState().viewMode === 'random') {

          var origin: any[] = [];
          let now = Date.now();
          useSelectionState.getState().selected.forEach(function (image: any) {
            image.isDeleted = true;
            image.deletedTime = Date.now();
            origin.push(image);
            machineryUpdateFilterCounts(image, -1, now);
          });

          // 实机 QA（2026-09-13）：待删元素必须在「自动选中下一项」之前捕获
          // （原版依赖 $watch 异步重建 selectedMappings 的时序；React 侧同步重建，
          // 延后捕获会拿到替换后的选区 → gl:removeItems 空集、已删条目残留网格）。
          var itemElements = machineryGetSelectedItemElements();

          var message = getFilter()('i18n')("notify.image.remove", [
            { "property": "count", "value": useSelectionState.getState().selected.length },
          ]);
          if (useSelectionState.getState().selected.length === 1) { message = message.replace("images", "image"); }

          (useMiscRawState.getState().notify || useMiscRawState.getState().notify).call(undefined, {
            message: message,
            duration: 4000,
          }, function () {
            let now = Date.now();
            origin.forEach(function (image: any) {
              image.isDeleted = false;
              delete image.deletedTime;
              machineryUpdateFilterCounts(image, 1, now);
            });
            writeScopeField('selected', origin);
            syncInspectorFromScope();
            if (useBodyState.getState().isDetailMode) {
              writeScopeField('current', origin[0]);
              syncDetailFromScope();
              syncInspectorFromScope();
            }
            machineryCalculateImageBinding({ ignoreSort: true }, function () {
              if (
                useBodyState.getState().viewMode !== 'random'
              ) {
                machineryRebindRefresh();
              }
              w.ScrollbarSaver.restoreScrollPosition();
            });
            w.ayncsImagesChange(origin);
            w.hiddenByCurrentFilter(origin);
          });

          if (useBodyState.getState().isDetailMode) {
            $timeout(function () {
              machineryZoom();
            }, 100)
          }

          if (usePreferencesState.getState().preferences.notification.soundEffect.enable != 'false' && usePreferencesState.getState().preferences.notification.soundEffect.when.deleteImage == 'true') {
            useMiscRawState.getState().removeSound && useMiscRawState.getState().removeSound.play && useMiscRawState.getState().removeSound.play();
          }
          w.ayncsImagesChange(useSelectionState.getState().selected);
          w.hiddenByCurrentFilter(useSelectionState.getState().selected);

          // 自動選取下一個圖片，如果沒有下一個，選上一個，都沒有就空
          writeScopeField('lastIndex', machineryGetSelection().start);
          var next = useItemState.getState().allData[useMiscRawState.getState().lastIndex + useSelectionState.getState().selected.length];
          var prev = useItemState.getState().allData[useMiscRawState.getState().lastIndex - 1];

          if (next) {
            writeScopeField('selected', [next]);
            syncInspectorFromScope();
            if (useBodyState.getState().isDetailMode) {
              writeScopeField('current', next);
              syncDetailFromScope();
              syncInspectorFromScope();
            }
          } else if (prev) {
            writeScopeField('selected', [prev]);
            syncInspectorFromScope();
            if (useBodyState.getState().isDetailMode) {
              writeScopeField('current', prev);
              syncDetailFromScope();
              syncInspectorFromScope();
            }
          } else {
            writeScopeField('selected', []);
            syncInspectorFromScope();
            if (useBodyState.getState().isDetailMode) {
              machineryLeaveDetailMode();
            }
          }

          $timeout(function () {
            machineryForceFitImageSize(useSelectionState.getState().current);
            machineryZoom();
          }, 100);

          w.ScrollbarSaver.saveScrollPosition();

          glRemoveitemsChannel.emit(itemElements);

          writeScopeField('lastSelectedIndex', machineryCurrentIndex() - 1);
          machineryAutoScroll();

          machineryCalculateImageBinding({ ignoreSort: true }, function () {
            if (
              useBodyState.getState().viewMode !== 'random' ||
              (useFolderState.getState().currentFolder && useFolderState.getState().currentFolder.orderBy !== "RANDOM")
            ) {
              machineryRebindRefresh(true);
            }
            machineryUpdateSelection();
            if (useFolderState.getState().currentFolder) { w.electronLog && w.electronLog.info(`[app] Remove ${itemElements.length} files from ${useFolderState.getState().currentFolder.name}(${useFolderState.getState().currentFolder.id}), folder remain ${useFolderState.getState().currentFolder.imageCount} files, all remain ${useItemState.getState().all.length} files, trash remain ${useItemState.getState().trash.length} files`); }
            else { w.electronLog && w.electronLog.info(`[app] Remove ${itemElements.length} files, all remain ${useItemState.getState().all.length} files, trash remain ${useItemState.getState().trash.length} files`); }
          });
        } else {
          return;
        }
      }, 200);
    }
  }
}

export function machineryRemoveSelectedFolders(): void {
  const w = window as any;
  if (useMiscRawState.getState().selectedFolders.length === 0) return;

  var removeConfirmMsg = getFilter()('i18n')("dialog.removeFolder.descMultiple", [
    { "property": "count", "value": useMiscRawState.getState().selectedFolders.length },
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
    machineryCheckOperationSafety2(useMiscRawState.getState().selectedFolders.length, function () {
      var isDeleteImages = (result == 1);
      useMiscRawState.getState().selectedFolders.forEach(function (folder: any) {
        if (folder.password && !folder.isUnLock) return;
        machineryRemoveFolderInner(folder, { isDeleteImages: isDeleteImages, ignoreRestore: true });
      });
    }, 1);
  }, function () { });
}

export function machineryRemoveSelectedSmartFolders(): void {
  const w = window as any;
  if (useMiscRawState.getState().selectedSmartFolders.length === 0) return;

  var removeConfirmMsg = getFilter()('i18n')("dialog.removeSmartFolder.descMultiple", [
    { "property": "count", "value": useMiscRawState.getState().selectedSmartFolders.length },
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
    useMiscRawState.getState().selectedSmartFolders.forEach(function (smartFolder: any) {
      machineryRemoveSmartFolderInner(smartFolder, { ignoreRestore: true });
    });
    writeScopeField('selectedSmartFolders', []);
  }, function () { });
}

/* selectAll（bundle 46628-46645 逐字） */
export function machinerySelectAll(event: any): void {
  const $timeout = getTimeout();
  event && event.stopPropagation();
  if (useBodyState.getState().viewMode == 'alltags') {
    writeScopeField('selectedTags', {});
    syncTagManagerFromScope();
    useMiscRawState.getState().TagManager.tagsResult.tags.forEach((tagName: any) => {
      useMiscRawState.getState().selectedTags[tagName] = true;
      syncTagManagerFromScope();
    });
  }
  else {
    var selected: any[] = [];
    Array.prototype.push.apply(selected, useItemState.getState().allData);
    writeScopeField('selected', selected);
    syncInspectorFromScope();
    writeScopeField('selectedMappings', {});
    $timeout.cancel(cleanSelectedTimeout);
    writeScopeField('currentFocus', "content");
  }
}

export function machinerySelectDown(event: any): void {
  event && event.preventDefault();
  var selection = machineryGetSelection();
  var end = selection.end || 0;
  var $arround = machineryGetArroundBox(end);
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
    if (useBodyState.getState().layout === "GridLayout") {
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
    var image = machineryGetItemByElement(target);
    writeScopeField('selected', [image]);
    syncInspectorFromScope();
    writeScopeField('selectedFolderMappings', {});
    syncListFromScope();
    if (useBodyState.getState().isDetailMode) {
      writeScopeField('current', useSelectionState.getState().selected[0]);
      syncDetailFromScope();
      syncInspectorFromScope();
    }
    machineryAutoScroll(target);
  }
  if (useBodyState.getState().isDetailMode) {
    machineryForceFitImageSize(useSelectionState.getState().selected[0], true);
    writeScopeField('current', useSelectionState.getState().selected[0]);
    syncDetailFromScope();
    syncInspectorFromScope();
    writeScopeField('isGifReady', false);
    syncDetailFromScope();
    detailZoom()?.updateNavigator( useSelectionState.getState().current);
    if (!machineryLastZoom()) {
      machineryZoom();
    }
  }
}

/* selectFolder（bundle 34666-34676 逐字：文件夹单项选中重置面） */
export function machinerySelectFolder(event: any, folder: any): void {
  (document.activeElement as any).blur();
  if (folder) {
    writeScopeField('selectedFolderMappings', {});
    syncListFromScope();
    writeScopeField('selectedMappings', {});
    useItemState.getState().selectedFolderMappings[folder.id] = true;
    syncListFromScope();
    writeScopeField('currentFocus', "content");
    writeScopeField('selected', []);
    syncInspectorFromScope();
    machineryUpdateSelection();
  }
}

export function machinerySelectNext(event: any): void {
  const w = window as any;
  const $timeout = getTimeout();
  if (useBodyState.getState().isCropMode) {
    moveCropToolChannel.emit({ horizontal: 1, vertical: 0 });
    return;
  }

  var selection = machineryGetSelection();
  var start = selection.start;
  var end = selection.end + 1;

  if (useBodyState.getState().isDetailMode) {
    machineryRememberScrollTops(useSelectionState.getState().current);
  }

  if (!useItemState.getState().allData[end]) {
    show("#is-last-item");
    setTimeout(() => { hide("#is-last-item"); }, 500);
    return;
  }
  else {
    detailZoom()?.cleanBitmapViewer();
  }

  writeScopeField('selected', [useItemState.getState().allData[end]]);
  syncInspectorFromScope();
  writeScopeField('selectedFolderMappings', {});
  syncListFromScope();
  writeScopeField('currentFocus', "content");

  if (useBodyState.getState().isDetailMode) {
    $timeout.cancel(nextTimeout);
    machineryForceFitImageSize(useSelectionState.getState().selected[0], true);
    writeScopeField('current', useSelectionState.getState().selected[0]);
    syncDetailFromScope();
    syncInspectorFromScope();
    writeScopeField('isGifReady', false);
    syncDetailFromScope();
  }

  machineryAutoScroll(end);

  if (useSelectionState.getState().current) {
    detailZoom()?.updateNavigator( useSelectionState.getState().current);
    if (!machineryLastZoom()) {
      machineryZoom();
    }
    nextTimeout = $timeout(function () {
      if (!machineryLastZoom()) {
        machineryZoom();
      }
      var nextImage = useItemState.getState().allData[end + 1];
      machineryPreloadImage("next");
    }, 100);
    machineryAddToRecentFile(useSelectionState.getState().current);
  }
}

export function machinerySelectPrev(event: any): void {
  const w = window as any;
  const $timeout = getTimeout();
  if (useBodyState.getState().isCropMode) {
    moveCropToolChannel.emit({ horizontal: -1, vertical: 0 });
    return;
  }

  var selection = machineryGetSelection();
  var start = selection.start;
  var end = selection.end + 1;

  if (start === 0) {
    show("#is-first-item");
    setTimeout(() => { hide("#is-first-item"); }, 500);
    return;
  }
  if (useItemState.getState().allData.length == 0) { return; }

  if (useBodyState.getState().isDetailMode) {
    detailZoom()?.cleanBitmapViewer();
    machineryRememberScrollTops(useSelectionState.getState().current);
    writeScopeField('isGifReady', false);
    syncDetailFromScope();
  }

  if (useItemState.getState().allData[start - 1]) {
    writeScopeField('selected', []);
    syncInspectorFromScope();
    useSelectionState.getState().selected.push(useItemState.getState().allData[start - 1]);
    syncInspectorFromScope();
    if (useBodyState.getState().isDetailMode) {
      machineryForceFitImageSize(useSelectionState.getState().selected[0], true);
      writeScopeField('current', useSelectionState.getState().selected[0]);
      syncDetailFromScope();
      syncInspectorFromScope();
    }
    machineryAutoScroll(start - 1);
  } else {
    writeScopeField('selected', []);
    syncInspectorFromScope();
    useSelectionState.getState().selected.push(useItemState.getState().allData[0]);
    syncInspectorFromScope();
    machineryForceFitImageSize(useSelectionState.getState().selected[0], true);
    writeScopeField('current', useSelectionState.getState().selected[0]);
    syncDetailFromScope();
    syncInspectorFromScope();
    machineryAutoScroll(0);
  }
  writeScopeField('selectedFolderMappings', {});
  syncListFromScope();
  writeScopeField('currentFocus', "content");
  if (useSelectionState.getState().current) {
    detailZoom()?.updateNavigator( useSelectionState.getState().current);
    if (!machineryLastZoom()) {
      machineryZoom();
    }
    $timeout.cancel(prevTimeout);
    prevTimeout = $timeout(function () {
      if (!machineryLastZoom()) {
        machineryZoom();
      }
      machineryPreloadImage("prev");
    }, 100);
    machineryAddToRecentFile(useSelectionState.getState().current);
  }
}

export function machinerySelectUp(event: any): void {
  event && event.preventDefault();

  var selection = machineryGetSelection();
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
    if (useBodyState.getState().layout === "GridLayout") {
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
    var image = machineryGetItemByElement(target);
    writeScopeField('selected', [image]);
    syncInspectorFromScope();
    writeScopeField('selectedFolderMappings', {});
    syncListFromScope();
    if (useBodyState.getState().isDetailMode) {
      writeScopeField('current', useSelectionState.getState().selected[0]);
      syncDetailFromScope();
      syncInspectorFromScope();
    }
    machineryAutoScroll(target);
  }
  if (useBodyState.getState().isDetailMode) {
    machineryForceFitImageSize(useSelectionState.getState().selected[0], true);
    writeScopeField('current', useSelectionState.getState().selected[0]);
    syncDetailFromScope();
    syncInspectorFromScope();
    writeScopeField('isGifReady', false);
    syncDetailFromScope();
    detailZoom()?.updateNavigator( useSelectionState.getState().current);
    if (!machineryLastZoom()) {
      machineryZoom();
    }
  }
}

export function machineryToggleSelectSmartFolder(event: any, smartFolder: any): void {
  var expand = !smartFolder.isExpand;
  var smartFolders = smartFolder.children;
  smartFolder.isExpand = expand;
  machineryToggleCurrentLevelSmartFoldersInner(smartFolders, expand);
}

export function machineryUpdateSelection(): void {
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
     eagle→w.eagle / 原 $bodyScope 取用→scope 面。s.inspector 即 eagle.inspector（bundle
     21615/54307 `$scope.inspector = eagle.inspector` 同引用） */
  getTimeout().cancel(updateSelectionTimeout);
  updateSelectionTimeout = getTimeout()(function () {

    var selected = useSelectionState.getState().selected;
    if (selected.length > 1) {
      useMiscRawState.getState().inspector.newNamePlaceholder = w.i18n.__("inspector.names.multipleTitles");
      syncInspectorFromScope();
      useMiscRawState.getState().inspector.newUrlPlaceholder = w.i18n.__("inspector.names.multipleUrls");
      syncInspectorFromScope();
      useMiscRawState.getState().inspector.newName = w.eagle.inspector.calculateName(selected);
      syncInspectorFromScope();
      useMiscRawState.getState().inspector.newUrl = w.eagle.inspector.calculateUrl(selected);
      syncInspectorFromScope();
      useMiscRawState.getState().inspector.newTags = w.eagle.inspector.calculateTags(selected);
      syncInspectorFromScope();
      useMiscRawState.getState().inspector.newAnnotation = w.eagle.inspector.calculateAnnotation(selected);
      syncInspectorFromScope();
      useMiscRawState.getState().inspector.folders = w.eagle.inspector.calculateFolders(selected);
      useMiscRawState.getState().inspector.star = w.eagle.inspector.calculateStar(selected);
      syncInspectorFromScope();
      useMiscRawState.getState().inspector.size = w.eagle.inspector.calculateFileSize(selected);
      syncInspectorFromScope();
      useMiscRawState.getState().inspector.activeTab = "ITEM";
      syncInspectorFromScope();
    } else if (selected.length == 1) {
      if (selected[0]) {
        useMiscRawState.getState().inspector.newNamePlaceholder = getFilter()('i18n')("title");
        syncInspectorFromScope();
        useMiscRawState.getState().inspector.newUrlPlaceholder = "http://";
        syncInspectorFromScope();
        useMiscRawState.getState().inspector.newName = selected[0].name || "";
        syncInspectorFromScope();
        useMiscRawState.getState().inspector.newUrl = selected[0].url || "";
        syncInspectorFromScope();
        useMiscRawState.getState().inspector.newTags = selected[0].tags;
        syncInspectorFromScope();
        useMiscRawState.getState().inspector.newAnnotation = selected[0].annotation || "";
        syncInspectorFromScope();
        useMiscRawState.getState().inspector.folders = [];
        useMiscRawState.getState().inspector.star = selected[0].star || 0;
        syncInspectorFromScope();
        useMiscRawState.getState().inspector.activeTab = "ITEM";
        syncInspectorFromScope();
      }
    }
    else {
      useMiscRawState.getState().inspector.activeTab = "SIDEBAR";
      syncInspectorFromScope();
      switch (useBodyState.getState().viewMode) {
        case "all":
          useMiscRawState.getState().inspector.category = {
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
          useMiscRawState.getState().inspector.category = {
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
          useMiscRawState.getState().inspector.category = {
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
          useMiscRawState.getState().inspector.category = {
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
          useMiscRawState.getState().inspector.category = {
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
          if (useMiscRawState.getState().selectedFolders.length > 0) {
            useMiscRawState.getState().inspector.category = {
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
          else if (useItemState.getState().selectedFolderMappings && Object.keys(useItemState.getState().selectedFolderMappings).length >= 1) {
            var selectedFolders = Object.keys(useItemState.getState().selectedFolderMappings).map(function (key) {
              return key;
            });
            if (selectedFolders[0] && useItemState.getState().folderMappings[selectedFolders[0]]) {
              w.eagle.inspector.inspectorFolder = useItemState.getState().folderMappings[selectedFolders[0]];
              useMiscRawState.getState().inspector.category = {
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
          else if (useFolderState.getState().currentFolder) {
            w.eagle.inspector.inspectorFolder = useFolderState.getState().currentFolder;
            useMiscRawState.getState().inspector.category = {
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
          else if (useFolderState.getState().currentSmartFolder) {
            useMiscRawState.getState().inspector.category = {
              newName: useFolderState.getState().currentSmartFolder.name,
              newDescription: useFolderState.getState().currentSmartFolder.description || "",
              createDate: useFolderState.getState().currentSmartFolder.modificationTime,
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
    if (useMiscRawState.getState().inspector.newTags.length > 0) {
      useMiscRawState.getState().inspector.newTags = sortTagsForSelection(useMiscRawState.getState().inspector.newTags);
      syncInspectorFromScope();
    }
  }, 30);
}

// ── c18e-1 域内自管（原 controller 闭包 var：nextTimeout 36419 邻域 / prevTimeout 36536 邻域）──
let nextTimeout: any = null;

let prevTimeout: any = null;

/* sortTags（bundle 54828 逐字；$scope→s。try/catch 原码自带——tagMappings 缺项不炸派生） */
function sortTagsForSelection(original: any): any {
  try {
    if (!original || original.length === 0) return;
    let tags = [...original];

    const tagGroupsIndexMap: any = {};
    useMiscRawState.getState().TagManager.groups.forEach((tagGroup: any, index: any) => {
      tagGroupsIndexMap[tagGroup.id] = index;
    });

    tagGroupsIndexMap['none'] = useMiscRawState.getState().TagManager.groups.length;

    tags = tags.sort((tagA: any, tagB: any) => {
      const a = useMiscRawState.getState().TagManager.tagMappings[tagA];
      const b = useMiscRawState.getState().TagManager.tagMappings[tagB];
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
