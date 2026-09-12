/**
 * cZ-4：条目数据域——12 通道截肢 + 逐字重挂（image.added/removed/palette.updated/
 * changed.mute/changed/update-item-view-by-id/file-uploaded/thumbnail-generated×2/
 * update-txt-item/webp.converted/calculateImageBinding/new-folders）+ finishQueue
 * watchCollection 域内接管。
 *
 * - **image.changed 精确保留**：bundle 有第二处理器（DuplicateModal 59465，写自身 modal
 *   scope）且 React DuplicateFamily 自给监听——签名只摘主 EagleController 处理器
 *   （'hiddenByCurrentFilter([item])'）。webp.converted 同源保留 React ProgressDialogs。
 * - **闭合函数域内移植**：muteRebind（= w.throttle(rebindRefresh(true), 3000, true)）、
 *   muteCalcuteImageBinding（+ 两个 timeout 局部）、updateItemListView（34300 逐字）。
 * - **finishQueue watchCollection**：scope watch 不随通道截肢消亡——先按 watch 表达式
 *   'finishQueue' 从 scope.$$watchers 摘除 bundle watcher，再以 React 域重挂同表达式
 *   watcher（autoSelect/reload/OPEN_DUPLICATE 全流程逐字；addImageTimeLeftInterval 域内）。
 * - **有意略去/等价**：无（本片全部行为域内复刻；$timeout 语义 = setTimeout + $apply）。
 */

import { persistSweep, removeChannelListenersBySource, sweepForeignWatchers } from './appCore';
import { detailZoom } from './smoothZoomEngine';
import { ipcRenderer } from '../global/eagleGlobals';
import { syncUploadFromScope } from '../store/uploadState';
import { syncListFromScope } from '../store/listState';
import { syncInspectorFromScope } from '../store/inspectorState';
import { IPCHelper } from '../core/ipcHelper';
import { debounce } from '../utils/func';

import { machineryRememberVideoCurrentTime } from '../services/mediaService';
import { resetFilter } from './filterDomain';
import { scrollToSelectedItem } from '../services/batchOpsService';
import { glRemoveitemsChannel, openDuplicateChannel, openDuplicateScanPanelChannel } from '../global/bus';
import { scopeEvalAsync } from './scopeRuntime';
import { q, findEl, getAttr, setAttrEl, setTextEl, setHtmlEl, setHtml, setCssEl, removeClassEl, setWidthEl, cssGet, dataSet } from '../utils/domQuery';
import { machineryGetAncestorFolders, machinerySaveFolder } from './libraryDomain';
import { machineryRelayout } from '../services/gridService';
import { machineryCheckOperationSafety } from '../services/viewOpsService';
import { machineryQuickOpenFolder, machineryUpdateSidebarList } from './libraryDomain';
import { machineryCurrentIndex, machineryUpdateListSlider } from '../services/gridService';
import { uploadFiles } from '../services/uploadService';
import { syncDetailFromScope } from '../store/detailState';
import { syncFilterFromScope } from '../store/filterState';
import { syncPanelFromScope } from '../store/panelState';
import { syncSidebarFromScope } from '../store/sidebarState';
import { addClass, addClassEl, cssSet, hasClass, heightOf, offEl, onEl, qa, removeClass, selectText, setAttr, setScrollTop, textEl, trigger, triggerEl } from '../utils/domQuery';
import { isString, max, uniq } from '../utils/lang';
import { emojiRegex, getRemainingFilenameLength, getSanitize, pinyinCache } from '../utils/normalize';
import { openRenameChannel } from './../global/bus';
import { callExternal } from './externalSupply';
import { machineryGetFolderImages } from './libraryDomain';

import { FileUrlHelper } from './fileUrlHelper';
import { getFilter, machineryCalcuteFilterBadge, machineryCalcuteFilterResult, machineryUpdateFilterCounts } from './filterDomain';
import { machineryCalcuteContainTags, machineryGetExtendTags, machineryRefreshSubfolderList, machineryUpdateSubFolderWidth } from './tagManagerDomain';
import { machineryGetSelectedTags, machineryUpdateSelection } from './selectionViewDomain';
import { getOffsetScrollbarFn } from '../services/gridService';
import { machineryAdjustLayoutWidth } from '../services/gridService';
import { scrollTopValue, show, widthOf } from '../utils/domQuery';
import { machineryCalculateFilterCounts } from './filterDomain';
import { getLanguageBCP, machineryLeaveDetailMode, updateCurrentOrderAndIncrease } from './miscDomain';
import { machineryAutoResizeTagFilter } from './tagManagerDomain';
import { getTimeout, machineryCalls } from './machineryInfra';
import { useListState } from '../store/listState';
import { useFolderState } from '../store/folderState';
import { useSelectionState } from '../store/selectionState';
import { useMiscRawState } from '../store/miscRawState';
import { useItemState } from '../store/itemState';
import { useBodyState } from '../store/bodyState';
import { writeScopeField } from './scopeFieldBridge';
import { useLayoutState } from '../store/layoutState';
import { usePreferencesState } from '../store/preferencesState';
declare const $bodyScope: any;
declare const RecentFileManager: any;
declare const __cc_openFilesWithDefault: any;
declare const __cc_openInFinder: any;
declare const __cc_openWithOther: any;
declare const analytics: any;
declare const eagle: any;
declare const openInNewWindow: any;
declare const path: any;
declare const pluginModule: any;
declare const swal: any;
declare const IPCHelper: any;
declare const remote: any;

let done = false;

// ── 域内自管的 controller 闭包状态 ──
let domainMuteCalcuteImageBindingTimeout: any = null;
let domainMuteCalcuteImageBindingTimeoutDuration = 200;
let domainAddImageTimeLeftInterval: any = null;
let domainMuteRebind: any = null;

function domainTimeout(fn: any, ms?: number): any {
  return setTimeout(() => {
    try { if (typeof fn === 'function') fn(); } finally { try { scopeEvalAsync(); } catch (err) { /* noop */ } }
  }, ms || 0);
}

/* muteRebind（bundle 27014 逐字；throttle 为 bundle 顶层 var → window） */
function ensureMuteRebind(): any {
  const w = window as any;
  if (!domainMuteRebind && w.throttle) {
    domainMuteRebind = w.throttle(function () {
      machineryRebindRefresh(true);
    }, 3000, true);
  }
  return domainMuteRebind;
}

/* muteCalcuteImageBinding（bundle 28672 逐字） */
function domainMuteCalcuteImageBinding(params: any, callback: any): void {
  if (!domainMuteCalcuteImageBindingTimeout) {
    domainMuteCalcuteImageBindingTimeoutDuration = 200;
    console.log(`muteCalcuteImageBindingTimeoutDuration = 200;`);
  }
  else {
    domainMuteCalcuteImageBindingTimeoutDuration = 4000;
    console.log(`muteCalcuteImageBindingTimeoutDuration = 4000;`);
  }
  clearTimeout(domainMuteCalcuteImageBindingTimeout);
  domainMuteCalcuteImageBindingTimeout = setTimeout(function () {
    machineryCalculateImageBinding(params, callback);
    domainMuteCalcuteImageBindingTimeout = undefined;
  }, params.timeout || domainMuteCalcuteImageBindingTimeoutDuration);
}

/* updateItemListView（bundle 34300 逐字；FileUrlHelper/VIDEO_TYPES/AUDIO_TYPES 全局） */
function domainUpdateItemListView(generated: any): void {
  const w = window as any;
  const FileUrlHelper = w.FileUrlHelper;
  const VIDEO_TYPES = useMiscRawState.getState().VIDEO_TYPES || {};
  const AUDIO_TYPES = useMiscRawState.getState().AUDIO_TYPES || {};
  if (!generated || !useItemState.getState().itemMappings[generated.id]) return;

  const $imgEl = q("#box-" + generated.id + " img");
  const image = useItemState.getState().itemMappings[generated.id];
  const originWidth = image.width;
  const originHeight = image.height;
  const originOrientation = image.orientation;

  if (!image) return;

  if (useItemState.getState().itemMappings[generated.id]) {
    if (!useItemState.getState().modifiedMappings[generated.id]) {
      useItemState.getState().modifiedMappings[generated.id] = 1;
    }
    else {
      useItemState.getState().modifiedMappings[generated.id]++;
    }

    machineryUpdateFilterCounts(image, -1, Date.now());
    machineryUpdateFilterCounts(generated, 1, Date.now());

    image.width = generated.width;
    image.height = generated.height;
    image.size = generated.size;
    image.ext = generated.ext;

    if (generated.fontMetas) {
      image.fontMetas = generated.fontMetas;
    }

    if ("png jpg".indexOf(generated.ext) === -1) {
      setTextEl(q("#box-" + image.id + " .type-label"), generated.ext.toUpperCase());
    }
    else {
      setTextEl(q("#box-" + image.id + " .type-label"), "");
    }
    setAttrEl(q("#box-" + image.id + " .name"), "data-ext", `.${generated.ext}`);

    if (generated.text && generated.text !== image.text) {
      image.text = generated.text;
      const paragraphs = image.text.split("\n");
      let paragraphsHTML = "";
      paragraphsHTML += `<h4>${image.name.trim()}</h4>`;
      paragraphs.forEach(function (paragraph: any) {
        paragraphsHTML += `<p>${paragraph.trim()}</p>`;
      });
      setHtmlEl(q("#box-" + image.id + " .txt-content div"), paragraphsHTML);
    }

    if (generated.mtime) { image.mtime = generated.mtime; }
    if (generated.btime) { image.btime = generated.btime; }
    if (generated.animated) { image.animated = generated.animated; }
    if (generated.orientation) { image.orientation = generated.orientation; }
    if (generated.resolutionWidth) { image.resolutionWidth = generated.resolutionWidth; }
    if (generated.resolutionHeight) { image.resolutionHeight = generated.resolutionHeight; }

    if (image.orientation && !generated.orientation) {
      delete image.orientation;
    }

    let refreshThumb = false;
    if (image.noPreview !== generated.noPreview) {
      image.noPreview = generated.noPreview;
      if (image.noPreview) {
        machineryRebindRefresh();
      }
    }

    if (image.customThumbnail !== generated.customThumbnail) {
      image.customThumbnail = generated.customThumbnail;
      refreshThumb = true;
    }

    if (generated.noThumbnail) {
      image.noThumbnail = generated.noThumbnail;
    }
    else {
      if (image.noThumbnail) {
        delete image.noThumbnail;
        delete image.disable;
        refreshThumb = true;
      }
    }

    if (generated.palettes) {
      image.palettes = generated.palettes;
      image.processingPalette = generated.processingPalette;
    }

    // 如果尺寸发生改变，才需要重新更新画面排版
    const aspectRatio = `${image.width} / ${image.height}`;
    const currentAspectRatio = cssGet(findEl(q("#box-" + image.id), ".thumbnail"), "aspect-ratio");
    if (
      (originHeight !== generated.height && originWidth !== generated.width) ||
      originOrientation !== generated.orientation ||
      aspectRatio !== currentAspectRatio
    ) {
      machineryUpdateItemView(image);
      machineryRelayout();
      getOffsetScrollbarFn()(30);
      refreshThumb = true;
    }

    if (generated.duration !== image.duration) {
      image.duration = generated.duration;
      machineryUpdateItemView(image);
    }

    if (generated.bpm !== image.bpm) {
      image.bpm = generated.bpm;
      machineryUpdateItemView(image);
    }

    if (refreshThumb && !image.noPreview) {
      const boxEl = q("#box-" + image.id);
      setAttrEl(findEl(boxEl, "img"), "src", FileUrlHelper.getThumbnailUrl(image) + "&v=" + Date.now());
      setCssEl(findEl(boxEl, ".thumbnail"), { "aspect-ratio": `${image.width} / ${image.height}` });
    }
  }
  if ($imgEl && !image.noPreview) {
    const parentEl = $imgEl.parentElement;
    if (parentEl) { removeClassEl(parentEl, "dummy"); parentEl.title = ""; }
    const src = getAttr($imgEl, "src") || getAttr($imgEl, 'lazysrc');
    let newSrc;
    if (src) {
      if (generated.ext === 'svg') {
        newSrc = FileUrlHelper.getThumbnailUrl(generated) + "?v=" + Date.now();
        setAttrEl($imgEl, "src", newSrc);
        setAttrEl($imgEl, "lazysrc", newSrc);
      }
      else if (generated.noThumbnail) {
        newSrc = FileUrlHelper.getThumbnailUrl(generated) + "?v=" + Date.now();
        setAttrEl($imgEl, "src", newSrc);
        setAttrEl($imgEl, "lazysrc", newSrc);
      }
      else {
        newSrc = FileUrlHelper.getThumbnailUrl(generated);
        if (newSrc.indexOf("?v") > -1) {
          setAttrEl($imgEl, "src", newSrc + "&v=" + Date.now());
          setAttrEl($imgEl, "lazysrc", newSrc + "&v=" + Date.now());
        }
        else {
          setAttrEl($imgEl, "src", newSrc + "?v=" + Date.now());
          setAttrEl($imgEl, "lazysrc", newSrc + "?v=" + Date.now());
        }
      }
    }
  }
  useMiscRawState.getState().finishGenerateQueue.push(generated);
  machineryRememberVideoCurrentTime(useSelectionState.getState().current);

  if (useBodyState.getState().isDetailMode) {
    if (generated && useSelectionState.getState().selected && useSelectionState.getState().selected[0] && generated.id === useSelectionState.getState().selected[0].id) {
      if (VIDEO_TYPES[useSelectionState.getState().current.ext] || AUDIO_TYPES[useSelectionState.getState().current.ext]) {
        /* 原码空分支（视频当前时间的特殊处理占位），逐字保留 */
      }
      else {
        detailZoom()?.updateNavigator( useSelectionState.getState().current);
      }
    }
  }
}


export function takeoverItemDomain(): void {
  if (done) return;
  done = true;
  const w = window as any;
  const ipc: any = ipcRenderer();
  if (!ipc || typeof ipc.on !== 'function') return;

  const diag: any = { takenOver: true, removed: {} as Record<string, number> };
  w.__eagleItemDomain = diag;

  // ── 截肢（签名摘 bundle 主处理器；保护 DuplicateModal / React DuplicateFamily /
  //    ProgressDialogs 等既有监听）──
  const chans: Array<[string, string[]]> = [
    ['image.added', ['needUpdateView']],
    ['image.removed', ['raw.splice(i, 1)']],
    ['image.palette.updated', ['processingPalette']],
    ['image.changed.mute', ['angular.extend(img, newImage)']],
    ['image.changed', ['hiddenByCurrentFilter([item])']],
    ['update-item-view-by-id', ['fontActivated']],
    ['file-uploaded', ['lastestAddItem']],
    ['thumbnail-generated', ['smoothZoom', 'file-uploaded-end']],
    ['update-txt-item', ['item.text = params.text']],
    ['webp.converted', ['updateItemListView(converted)']],
    ['calculateImageBinding', ['muteRebind();']],
    ['new-folders', ['saveFolder();']],
  ];
  for (const [ch, sigs] of chans) {
    diag.removed[ch] = removeChannelListenersBySource(ipc, ch, sigs);
  }

  const electronLog: any = w.electronLog || console;


  // ── image.added（23579 逐字）──
  ipc.on('image.added', function (_event: any, newImage: any) {
    if (!useItemState.getState().raw) return;
    if (newImage && newImage.id && newImage.ext) {
      // 避免重复添加
      if (newImage.id && useItemState.getState().itemMappings[newImage.id]) { return; }

      if (useItemState.getState().raw) { useItemState.getState().raw.unshift(newImage); }
      syncListFromScope();
      // b1-9o：raw 变更后失效内容过滤缓存（bundle 导入路径走无缓存 rebindRefresh 隐式重建，
      // shim 世界导入路径不经过 rebindRefresh——缓存不失效则 filterContent 永远吃到旧快照，
      // 11a49 的 a4 空态无法闭合即此）
      writeScopeField('contentFilterCache', null);
      // 判斷是否需要更新畫面，如果 groupkey 屬於前 3 頁面，就更新
      const key = w.ig.getGroupKeys(false)[0] - 1000000;
      const needUpdateView = key <= 1;
      writeScopeField('startCursor', 0);
      machineryPrependImages([newImage], needUpdateView);
      machineryCalculateImageBinding({ ignoreSort: false }, function () {
        ensureMuteRebind() && ensureMuteRebind()();
        machineryUpdateSelection();
      });
    }
    scopeEvalAsync();
  });

  // ── image.removed（23602 逐字）──
  ipc.on('image.removed', function (_event: any, id: any) {
    if (!useItemState.getState().raw) return;
    // b1-9o：raw 变更后失效内容过滤缓存（同 image.added 处注）
    writeScopeField('contentFilterCache', null);
    for (let i = 0; i < useItemState.getState().raw.length; i++) {
      const img = useItemState.getState().raw[i];
      if (img.id === id) {
        useItemState.getState().raw.splice(i, 1);
        syncListFromScope();
        break;
      }
    }

    const removedBoxEl = q("#box-" + id);
    if (w.ig && w.ig.remove && removedBoxEl) w.ig.remove(removedBoxEl);

    domainMuteCalcuteImageBinding({ ignoreSort: true }, function () {
      machineryRebindRefresh(true);
      machineryUpdateSelection();
      scopeEvalAsync();
    });
  });

  // ── image.palette.updated（23627 逐字）──
  ipc.on('image.palette.updated', function (_event: any, newImage: any) {
    if (!useItemState.getState().raw) return;
    if (!newImage && newImage.palettes) return;

    machineryUpdateItemView(newImage);

    const img = useItemState.getState().itemMappings[newImage.id];
    if (img && newImage.palettes) {
      img.palettes = newImage.palettes;
      if (newImage.modificationTime) {
        img.modificationTime = newImage.modificationTime;
      }
      delete img.processingPalette;
      return;
    }
    else if (img && img.processingPalette && !newImage.processingPalette) {
      delete img.processingPalette;
      return;
    }

    scopeEvalAsync();
  });

  // ── image.changed.mute（23651 逐字）──
  ipc.on('image.changed.mute', function (_event: any, newImage: any) {
    if (!useItemState.getState().raw) return;

    const item = q("#box-" + newImage.id);
    if (item && newImage.isDeleted) {
      glRemoveitemsChannel.emit([item]);
    }
    else {
      machineryUpdateItemView(newImage);
    }
    scopeEvalAsync();

    const img = useItemState.getState().itemMappings[newImage.id];
    if (img) {
      // b1-9i：bundle 在世时此处为 w.angular.extend（浅合并自有可枚举属性）——shim 世界无
      // window.angular（且不得注入，见 b1-9e 雷区记录），Object.assign 语义等价
      Object.assign(img, newImage);
      delete img.processingPalette;
      ensureMuteRebind() && ensureMuteRebind()();
      return;
    }
  });

  // ── image.changed（23673 逐字；getHashID/hiddenByCurrentFilter 全局）──
  ipc.on('image.changed', function (_event: any, newImage: any) {
    if (!useItemState.getState().raw) return;

    console.log("image.changed");

    const hashID = w.getHashID(newImage);

    const item = q("#box-" + newImage.id);
    if (item && newImage.isDeleted) {
      glRemoveitemsChannel.emit([item]);
    }
    else {
      machineryUpdateItemView(newImage);
    }
    w.hiddenByCurrentFilter([item]);

    const img = useItemState.getState().itemMappings[newImage.id];
    if (img && newImage && img.id === newImage.id) {
      // b1-9i：bundle 在世时此处为 w.angular.extend（浅合并自有可枚举属性）——shim 世界无
      // window.angular（且不得注入，见 b1-9e 雷区记录），Object.assign 语义等价
      Object.assign(img, newImage);
      img.star = newImage.star;
      delete img.processingPalette;
    }

    machineryUpdateSelection();

    domainMuteCalcuteImageBinding({ ignoreSort: true }, function () {
      machineryRebindRefresh(true);
      machineryUpdateSelection();
      scopeEvalAsync();
    });
    void hashID;
  });

  // ── update-item-view-by-id（23992 逐字；installedFonts 全局）──
  ipc.on('update-item-view-by-id', function (_e: any, id: any) {
    if (useItemState.getState().itemMappings[id]) {
      const item = useItemState.getState().itemMappings[id];
      delete item.activating;
      delete item.deactivating;
      machineryUpdateItemView(item);
      if (item.fontMetas && item.fontMetas.postScriptName) {
        const key = Object.keys(item.fontMetas.postScriptName)[0];
        const postScriptName = item.fontMetas.postScriptName && item.fontMetas.postScriptName[key];
        if (w.installedFonts[`${postScriptName}_.${item.ext}`]) {
          w.eagle.filter.filterCounts['fontActivated']['activated']++;
          w.eagle.filter.filterCounts['fontActivated']['deactivated']--;
        }
        else {
          w.eagle.filter.filterCounts['fontActivated']['activated']--;
          w.eagle.filter.filterCounts['fontActivated']['deactivated']++;
        }
      }
    }
  });

  // ── file-uploaded（30427 逐字；readChunk → require，FileUrlHelper 全局，类型表 scope）──
  ipc.on('file-uploaded', function (_e: any, image: any) {

    if (image && image.id && image.ext) {
      writeScopeField('lastestAddItem', image);
      useItemState.getState().itemMappings[image.id] = image;
      // b1-9o：raw 变更后失效内容过滤缓存（同 image.added 处注）
      writeScopeField('contentFilterCache', null);
      // 判斷是否重複，如果重復，就先紀錄在 $scope.duplicateQueue 裡面
      const existsImage = machineryIsDuplicateImage(image);
      const needCheckRepeat = usePreferencesState.getState().preferences.notification.notification.enable !== 'false' && usePreferencesState.getState().preferences.notification.notification.when.repeatImage === 'true';

      if (existsImage && needCheckRepeat) {
        // 使用 md5 判断是否真的重复
        try {
          const readChunk = w.require && w.require('read-chunk');
          // 旧图片的 md5
          const existsPath = w.FileUrlHelper.getRawPath(existsImage);
          const existsBuff = readChunk.sync(existsPath, 0, 4096000);

          // 新图片的 md5
          const newPath = w.FileUrlHelper.getRawPath(image);
          const newBuff = readChunk.sync(newPath, 0, 4096000);

          if (existsBuff.equals(newBuff)) {
            useMiscRawState.getState().duplicateQueue.push(image);
          }
          else {
            if (useItemState.getState().raw) { useItemState.getState().raw.unshift(image); }
            syncListFromScope();
            machineryAddToDuplicateMapping(image);
          }
        }
        catch (err) {
          if (useItemState.getState().raw) { useItemState.getState().raw.unshift(image); }
          syncListFromScope();
          useItemState.getState().itemMappings[image.id] = image;
          machineryAddToDuplicateMapping(image);
          electronLog && electronLog.error((err as any).stack || err);
        }
      }
      // 否則添加至列表中
      else {
        if (useItemState.getState().raw) { useItemState.getState().raw.unshift(image); }
        syncListFromScope();
        machineryAddToDuplicateMapping(image);
      }

      const VIDEO_TYPES = useMiscRawState.getState().VIDEO_TYPES || {};
      const AUDIO_TYPES = useMiscRawState.getState().AUDIO_TYPES || {};
      const FONT_TYPES = useMiscRawState.getState().FONT_TYPES || {};
      const filterExtensions = w.eagle.filter.filterExtensions;
      if (VIDEO_TYPES[image.ext]) {
        filterExtensions['video'] = true;
      } else if (AUDIO_TYPES[image.ext]) {
        filterExtensions[image.ext] = true;
        filterExtensions['audio'] = true;
      } else if (FONT_TYPES[image.ext]) {
        filterExtensions['font'] = true;
      } else {
        switch (image.ext) {
          case 'ppt':
          case 'pptx':
          case 'potx':
            filterExtensions['powerpoint'] = true;
            break;
          case 'doc':
          case 'docx':
            filterExtensions['word'] = true;
            break;
          case 'xls':
          case 'xlsx':
            filterExtensions['excel'] = true;
            break;
          default:
            filterExtensions[image.ext] = true;
        }
      }
    }

    useMiscRawState.getState().finishQueue.push(image);
    syncUploadFromScope();

    // Note: 故意不使用 async 來更新畫面，加速畫面性能
    const progress = useMiscRawState.getState().finishQueue.length / useMiscRawState.getState().uploadQueue.length;
    setHtmlEl(findEl(q("#upload-queue-progress"), ".message .percentage"), useMiscRawState.getState().finishQueue.length + "/" + useMiscRawState.getState().uploadQueue.length);
    setWidthEl(findEl(q("#upload-queue-progress"), ".current"), progress * 100 + "%");

    if (progress < 0.97) {
      w.updateWindowProgressBar(progress);
    }
    else {
      w.updateWindowProgressBar(-1);
    }

    // 仅更新包含此图片的列表
    if (useMiscRawState.getState().finishQueue.length === useMiscRawState.getState().uploadQueue.length) {
      machineryCalculateImageBinding({}, function () {
        scopeEvalAsync();
      });
    }
    else {
      domainMuteCalcuteImageBinding({ ignoreSort: true }, function () {
        scopeEvalAsync();
      });
    }
  });

  // ── thumbnail-generated #1（31147 逐字：详情图刷新）──
  ipc.on('thumbnail-generated', function (_e: any, generated: any) {
    if (!generated || !generated.id || !useSelectionState.getState().selected || !useSelectionState.getState().selected[0]) return;
    if (useSelectionState.getState().selected && useSelectionState.getState().selected[0] && generated.id === useSelectionState.getState().selected[0].id) {
      const detailImageEl = q("img#detail-image");
      if (detailImageEl) {
        const rawURL = getRawUrl(generated);
        setCssEl(detailImageEl, {
          "transform": `rotate(0deg)`,
          "transition": "none",
          "display": "none"
        });
        const temp = new Image();
        temp.onload = function () {
          setAttrEl(detailImageEl, "src", rawURL);
          detailZoom()?.updateNavigator( generated);

          dataSet(detailImageEl, "degree", 0);

          machineryForceFitImageSize(generated);
          setCssEl(detailImageEl, {
            "display": "block"
          });
        };
        temp.src = rawURL;
      }
    }
  });

  // ── thumbnail-generated #2（34281 逐字：封面更新 + 未收录回补 file-uploaded-end）──
  ipc.on('thumbnail-generated', function (_e: any, generated: any) {
    console.log("thumbnail-generated");
    if (generated && generated.id) {
      const existItem = useItemState.getState().itemMappings[generated.id];
      if (existItem) {
        // 更新封面
        domainUpdateItemListView(generated);
      }
      else {
        ipc.send("file-uploaded-end", generated);
      }
      scopeEvalAsync();
    }
  });

  // ── update-txt-item（31141 逐字）──
  ipc.on('update-txt-item', function (_e: any, params: any) {
    const item = useItemState.getState().itemMappings[params.id];
    if (item) {
      item.text = params.text;
      machineryUpdateTxtItem(item);
      scopeEvalAsync();
    }
  });

  // ── webp.converted（34267 逐字）──
  ipc.on('webp.converted', function (_e: any, converted: any) {
    // 更新封面
    if (converted && useItemState.getState().itemMappings[converted.id]) {
      domainUpdateItemListView(converted);
    }
    scopeEvalAsync();
  });

  // ── calculateImageBinding（30549 逐字）──
  ipc.on('calculateImageBinding', function () {
    machineryCalculateImageBinding({}, function () {
      ensureMuteRebind() && ensureMuteRebind()();
      machineryUpdateSelection();
    });
    scopeEvalAsync();
  });

  // ── new-folders（30560 逐字）──
  ipc.on('new-folders', function (_e: any, folders: any) {
    folders.forEach(function (f: any) {
      useFolderState.getState().folders.push(f);
    });

    machineryUpdateSidebarList();

    machineryCalculateImageBinding({ ignoreSort: true }, function () {
      machineryRebindRefresh();
      scopeEvalAsync();
      machinerySaveFolder();
    });

    machinerySaveFolder();
    electronLog && electronLog.info(`[app] New ${folders.length} folders`);
  });

  /* finishQueue watchCollection（bundle 34506-34666 逐字；机械替换 $scope → s /
     $rootScope → s.$root / $timeout → domainTimeout / addImageTimeLeftInterval →
     domainAddImageTimeLeftInterval / IPCHelper → w.IPCHelper / remote → w.remote /
     currentWindow → w.currentWindow；isInFolder 复用 controllerFns 移植版）。
     **b1-9 缺口补齐**：原注「$watchCollection 的 exp/fn 被 Angular 包装为不透明对象，无法
     摘除——bundle watcher 保持独占」。bundle 在世时确实如此（故此处**仅在 shim 世界注册**，
     避免 bundle 侧双处理）；bundle 死亡后该 watcher 随之消失，导入完成链路失去唯一的
     `calculateImageBinding → reload(true) → 网格刷新` 触发点——表现为导入成功但
     allData 恒为 0、DOM 零 box（m1 的 markdown meta 即停在此处）。
     两点诚实适配（否则 shim 世界整段 watcher 首抛即失效）：
       1. duplicateSound 在 React 侧无供给（bundle 顶层 var），bundle 原码直调 .play() →
          改 `s.duplicateSound && …` 守卫；
       2. `$scope.finishQueue.length > 2` 在上一行 finishQueue 已置 [] 后恒假（bundle 原
          bug），逐字保留（remote/currentWindow 仅在该死分支内被读取）。 */
  // 惰性挂载：bodyScope 就绪时机晚于本域接管，故重试至可注册为止（同 boxGridEngine attach 模式）
  // b1-9bz-C-4：finishQueue 检测改由本域自建 200ms 轮询驱动（与 shim watcher 同频），
  // handler 体原样保留为 handleFinishQueueChanged。不改写入点 —— 此前「push 后直调」
  // 的改法会因触发时机与 flush 不一致导致 1m1 挂 7 个断言。
  let finishQueuePoll: any = null;
  const attachFinishQueueWatch = () => {
    let prevFinishQueue: any[] = (useMiscRawState.getState().finishQueue || []).slice();
    if (finishQueuePoll) clearInterval(finishQueuePoll);
    finishQueuePoll = setInterval(() => {
      const cur: any[] = (useMiscRawState.getState().finishQueue || []).slice();
      if (cur.length === prevFinishQueue.length) return;
      const oldValue = prevFinishQueue;
      prevFinishQueue = cur;
      try { handleFinishQueueChanged(cur, oldValue); } catch (err) { /* noop */ }
    }, 200);
    return true;
  };
  if (!attachFinishQueueWatch()) {
    const retryFinishQueueWatch = setInterval(() => {
      if (attachFinishQueueWatch()) clearInterval(retryFinishQueueWatch);
    }, 300);
  }
}

// ═══ b1-9bz-A：controllerFns 表体归位（逐字平移；getScope()→getBodyScope()；表项指针化）═══
// —— controllerFns 模块级声明随迁（verbatim；按原声明顺序防 TDZ）——
const _req: any = (n: string) => { try { return (window as any).require(n); } catch (err) { return undefined; } };

const EagleConfig: any = (window as any).EagleConfig || {};

const AUDIO_TYPES: any = {}; (EagleConfig.AUDIO_FORMATS || []).forEach(function (ext: string) { AUDIO_TYPES[ext] = true; });

const fs: any = _req('fs');

const electronSettings: any = (window as any).electronSettings;

const electronLog: any = (window as any).electronLog || console;

const __cf_ipcRenderer: any = (window as any).__eagleIpc || (window as any).electron?.ipcRenderer;

const clipboard: any = _req('electron')?.clipboard || (window as any).clipboard;

let __lv_showFinderAlert: any = localStorage.getItem("eagle.hint.showInFinder") !== 'false';

const i18n: any = (window as any).i18n;

let preferences: any = (window as any).electronSettings?.getPreferences?.() || {};

const $filter: any = (name: string) => {
  // E4：原 `s.$root.$filter`（Angular injector 滤镜服务）在去 Angular 后恒缺席——直接走移植表。
  const inst: any = getFilter();
  return inst ? inst(name) : undefined;
};

// —— link 级共享态（原 makeControllerFns 闭包声明）——
var __lv_image: any;
var __lv_path: any;

let lvInited = false;
const initLinkVars = () => {
  if (lvInited) return;
  lvInited = true;
  // __lv_path（原 initLinkVars 逐字）
        __lv_path = _req('path');

};


export function openFileWithDefault(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    return (function (file: any) {
            if (!file || !file.id) return;
            if (q(".swal2-container")) { return; }
            var folderPath = __lv_path.normalize(useMiscRawState.getState().libraryPath + "/images/" + file.id + ".info/");
            var rawPath = __lv_path.normalize(folderPath + file.name + "." + file.ext);
            IPCHelper.send('open-with-default', rawPath);
            RecentFileManager.addFile(file);
    }).apply(null, args);
  }

export function copyAsLink(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    return (function (event, items) {
            if (!items || !items[0]) return;
            let text = ``;
            items.forEach(function (item, index) {
                if (item && item.id) {
                    // http://localhost:41595/item?id=:item.id
                    text += `http://localhost:41595/item?id=${item.id}`;
                    // text += `eagle://item/${item.id}`;
                    if (index !== items.length - 1) {
                        text += "\n";
                    }
                }
            });

            clipboard.writeText(text);
            useMiscRawState.getState().notify({
                message: i18n.__("notify.colorCopySuccess"),
                duration: 750
            });
        }).apply(null, args);
  }

export function copyAsPath(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    return (function (event) {
            if (!useSelectionState.getState().selected || !useSelectionState.getState().selected[0]) return;
            let copyText = "";
            useSelectionState.getState().selected.forEach(function (item, index) {
                var folderPath = __lv_path.normalize(useMiscRawState.getState().libraryPath + "/images/" + item.id + ".info/");
                var rawPath = __lv_path.normalize(folderPath + item.name + "." + item.ext);
                if (index == 0) {
                    copyText += rawPath;
                }
                else {
                    copyText += `\n${rawPath}`;
                }
            });
            clipboard.writeText(copyText);
            useMiscRawState.getState().notify({
                message: $filter('i18n')("notify.copyPath.successMsg"),
                duration: 750
            });
        }).apply(null, args);
  }

export function getFolderFullPath(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    return (function (folder) {
            if (folder) {
                if (folder.parent) {
                    try {
                        var ancestors = machineryGetAncestorFolders(folder, []);
                        ancestors.unshift(folder);
                        var names = ancestors.reverse().map(function (folder) {
                            return folder.name || "";
                        });
                        var namePath = names.join(" / ");
                        return namePath;
                    }
                    catch (err) {
                        return "";
                    }
                }
                else {
                    return folder.name || "";
                }
            }
            return "";
        }).apply(null, args);
  }

export function getGIFPath(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    return (function() {
            if (useSelectionState.getState().current) {
                var gifPath = FileUrlHelper.getRawPath(useSelectionState.getState().current);
                var gifUrl = FileUrlHelper.getRawUrl(useSelectionState.getState().current);
                var renderBehavior = usePreferencesState.getState().preferences.habits.renderBehavior;
                return "gif-viewer/index.html?path=" + encodeURIComponent(gifPath) + "&url=" + encodeURIComponent(gifUrl) + "&name=" + encodeURIComponent(useSelectionState.getState().current.name + ".gif") + `&render=${renderBehavior}`;
            }
        }).apply(null, args);
  }

export function getModelPath(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    return (function() {
            if (useSelectionState.getState().current) {
                var rawUrl = FileUrlHelper.getRawUrl(useSelectionState.getState().current);
				rawUrl = rawUrl.replaceAll(',', '%2C');
                var type = useSelectionState.getState().current.ext;
				return `model-viewer/website/index.html#model=${rawUrl}`;
            }
        }).apply(null, args);
  }

export function getNativeViewerPath(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    return (function() {
            if (useSelectionState.getState().current) {
                var __lv_filePath = useMiscRawState.getState().imagesDir + useSelectionState.getState().current.id + ".info/";
                return "native-viewer/index.html?path=" + encodeURIComponent(__lv_filePath) + "&name=" + encodeURIComponent(useSelectionState.getState().current.name + "." + useSelectionState.getState().current.ext) + "&ext=" + useSelectionState.getState().current.ext + "&width=" + useSelectionState.getState().current.width + "&height=" + useSelectionState.getState().current.height + "&id=" + useSelectionState.getState().current.id;
            }
        }).apply(null, args);
  }

export function getPDFPath(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    return (function() {
            if (useSelectionState.getState().current) {
            	var pdfPath = FileUrlHelper.getRawUrl(useSelectionState.getState().current);
                var locale = preferences.general.language.replace("_", "-");
                return `pdf-viewer/web/viewer.html?path=${encodeURIComponent(pdfPath)}&locale=${locale}&theme=${useBodyState.getState().theme}`;
            }
        }).apply(null, args);
  }

export function getRawPath(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    return (function (__lv_image) {
            if (!__lv_image || !useMiscRawState.getState().imagesDir) return;
            if (!useItemState.getState().modifiedMappings[__lv_image.id]) {
                return "file://" +  getRawPath(useMiscRawState.getState().imagesDir, __lv_image);
            }
            else {
                return "file://" +  getRawPath(useMiscRawState.getState().imagesDir, __lv_image) + "?v=" + useItemState.getState().modifiedMappings[__lv_image.id];
            }
        }).apply(null, args);
  }

export function getRawUrl(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    return (function (__lv_image) {
            if (!useMiscRawState.getState().imagesDir || !__lv_image) return;
            let rawUrl = FileUrlHelper.getRawUrl(__lv_image);
            if (!EagleConfig.SUPPORT_FORMATS[__lv_image.ext]) {
                rawUrl = FileUrlHelper.getThumbnailUrl(__lv_image);
            }
            if ($bodyScope.modifiedMappings && $bodyScope.modifiedMappings[__lv_image.id]) {
	            rawUrl = `${rawUrl}?v=${$bodyScope.modifiedMappings[__lv_image.id]}`;
	        }
        	return rawUrl;
        }).apply(null, args);
  }

export function getRawViewerPath(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    return (function() {
            if (useSelectionState.getState().current) {
                var __lv_image = useSelectionState.getState().current;
                var rawPath = useMiscRawState.getState().imagesDir + useSelectionState.getState().current.id + ".info/";
                return `./raw-viewer/index.html?orientation=${__lv_image.orientation}&path=${encodeURIComponent(rawPath)}&name=${encodeURIComponent(__lv_image.name)}&ext=${__lv_image.ext}&width=${__lv_image.width}&height=${__lv_image.height}`;
            }
        }).apply(null, args);
  }

export function getTxtPath(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    return (function() {
            if (useSelectionState.getState().current) {
                return `./text-editor/text-editor.html?id=${useSelectionState.getState().current.id}&theme=${useBodyState.getState().theme}&name=${useSelectionState.getState().current.name}&language=${useBodyState.getState().language}`;
            }
        }).apply(null, args);
  }

export function getURLSrc(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    return (function () {
            let item = useSelectionState.getState().current;
        	if (item.ext === "url") {
        		var embed;
        		if (item.medium === "youtube") {
        			embed = `https://www.youtube-nocookie.com/embed/${item.videoID}?autoplay=1&vq=hq1080`;
        		}
        		else if (item.medium === "vimeo") {
        			embed = `https://player.vimeo.com/video/${item.videoID}?autoplay=1`;
        		}
        		else {
        			embed = item.url;
        		}
        		return embed;
        	}
            else {
                return FileUrlHelper.getRawUrl(useSelectionState.getState().current);
            }
        }).apply(null, args);
  }

export function openItemLocation(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    return (function (item, folder) {
            resetFilter();
            writeScopeField('keyword', "");
            machineryQuickOpenFolder(folder, item);
        }).apply(null, args);
  }

export function openWithOther(...args: any[]) {
    if (!__cc_openWithOther) {
      __cc_openWithOther = debounce(function () {
        if (useSelectionState.getState().selected.length > 0) {
            __cf_ipcRenderer.send('open-with-dialog', FileUrlHelper.getRawPath(useSelectionState.getState().selected[0]));
        }
      }, 200, true);
    }
    return __cc_openWithOther(...args);
  }

export function openInFinder(...args: any[]) {
    if (!__cc_openInFinder) {
      __cc_openInFinder = (function () {
        function openInFinderImpl() {
            if (useSelectionState.getState().selected.length > 0) {
                machineryCheckOperationSafety(function () {
                    useSelectionState.getState().selected.forEach(function (file, index) {
                        if (index > 30) return;
                        var folderPath = path.normalize(useMiscRawState.getState().libraryPath + "/images/" + file.id + ".info/");
                        var rawPath = path.normalize(folderPath + file.name + "." + file.ext);
                        if (fs.existsSync(rawPath)) {
                            __cf_ipcRenderer.send('show-item-in-folder', rawPath);
                        }
                        else if (fs.existsSync(folderPath + 'metadata.json')) {
                            __cf_ipcRenderer.send('show-item-in-folder', folderPath + 'metadata.json');
                        }
                        else {
                            __cf_ipcRenderer.send('show-item-in-folder', folderPath);
                        }
                        electronLog && electronLog.info("[app] Open item inFinder: " + folderPath);
                    });
                }, 10);
            }
        };
        return debounce(function () {

            // 禁止在任何 Modal 开启时，使用这个功能，避免快捷键冲突
            if (q(".modal.open, .import-modal.open")) return;
            if (!useSelectionState.getState().selected.length) return;

            var btnLable;

            if (process.platform === 'win32') {
                btnLable = i18n.__("dialog.openInFinder.openExplorerBtn");
            }
            else {
                btnLable = i18n.__("dialog.openInFinder.openFinderBtn");
            }

            if (__lv_showFinderAlert) {
                swal({
                    html: `
                        <div class="alert">
                            <div class="alert-icon warning"></div>
                            <h4 class="alert-title">${i18n.__("dialog.openInFinder.title")}</h4>
                            <p class="alert-desc">${i18n.__("dialog.openInFinder.desc")}</p>
                        </div>
                    `,
                    showCloseButton: false, showCancelButton: true, allowOutsideClick: false, focusConfirm: true, focusCancel: false, padding: 24,
                    width: 400,
                    customClass: "alert-box",
                    input: 'checkbox',
                    inputValue: 0,
                    inputValidator: function (result) {
                        return new Promise(function (resolve, reject) {
                            resolve(result);
                        })
                    },
                    inputPlaceholder: i18n.__('general.askagain'),
                    cancelButtonColor: "#777777",
                    confirmButtonText: btnLable,
                    cancelButtonText: i18n.__("general.cancel"),
                }).then(function (result) {
                    __lv_showFinderAlert = (result === 0);
                    if (!__lv_showFinderAlert) {
                        localStorage.setItem("eagle.hint.showInFinder", __lv_showFinderAlert);
                    }
                    openInFinderImpl();
                });
            }
            else {
                openInFinderImpl();
            }


        }, 200, true);
      })();
    }
    return __cc_openInFinder(...args);
  }

export function openFilesWithDefault(...args: any[]) {
    if (!__cc_openFilesWithDefault) {
      __cc_openFilesWithDefault = debounce(function(files) {
        if (q(".swal2-container")) { return; }
        machineryCheckOperationSafety(function () {
            files.forEach(function (file, index) {
                if (!file || !file.id) return;
                if (index < 40) {
                    var folderPath = __lv_path.normalize(useMiscRawState.getState().libraryPath + "/images/" + file.id + ".info/");
                    var rawPath = __lv_path.normalize(folderPath + file.name + "." + file.ext);
                    __cf_ipcRenderer.send('open-with-default', rawPath);
                }
            });
            RecentFileManager.addFiles(files);
        }, 10);
      }, 500, true);
    }
    return __cc_openFilesWithDefault(...args);
  }

export function openInPreviewWindow(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    return (function () {
        if (useSelectionState.getState().selected.length <= 20000) {
            var items = useSelectionState.getState().selected.filter(function (item) {
                return (EagleConfig.SUPPORT_FORMATS[item.ext] || pluginModule?.previewExtension.thumbnailPluginMap[item.ext]) && !AUDIO_TYPES[item.ext];
            });
            if (items.length > 0) {
                openInNewWindow(items);
                analytics.event('NewWindow', 'Open', items[0].ext);
                RecentFileManager.addFiles(items);
            }
        }
    }).apply(null, args);
  }

export function copyAsProperity(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    return (function (properity) {
        if (!useSelectionState.getState().selected || !useSelectionState.getState().selected[0]) return;
        let copyText = "";
        useSelectionState.getState().selected.forEach(function (item, index) {
            if (index == 0) {
                copyText += `${item[properity] || ""}`;
            }
            else {
                copyText += `\n${item[properity] || ""}`;
            }
        });
        clipboard.writeText(copyText);
        useMiscRawState.getState().notify({
            message: $filter('i18n')("notify.copyPath.successMsg"),
            duration: 750
        });
    }).apply(null, args);
  }

export function copyAsFolderPath(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    return (function (event) {
        if (!useSelectionState.getState().selected || !useSelectionState.getState().selected[0]) return;
        let copyText = "";
        useSelectionState.getState().selected.forEach(function (item, index) {
            var folderPath = path.normalize(useMiscRawState.getState().libraryPath + "/images/" + item.id + ".info/");
            if (index == 0) {
                copyText += folderPath;
            }
            else {
                copyText += `\n${folderPath}`;
            }
        });
        clipboard.writeText(copyText);
        useMiscRawState.getState().notify({
            message: $filter('i18n')("notify.copyPath.successMsg"),
            duration: 750
        });
    }).apply(null, args);
  }

export function copyAsThumbnail(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    return (function () {
        // b1-9ae：同上——undefined → send 走 main（b1-9aa copy-thumbnails handler → CF_HDROP）
        if ((window as any).backgroundWindowID === undefined) {
            __cf_ipcRenderer.send('copy-thumbnails', useSelectionState.getState().selected);
        }
        else {
            __cf_ipcRenderer.sendTo((window as any).backgroundWindowID, 'copy-thumbnails', useSelectionState.getState().selected);
        }
        setTimeout(function () {
            useMiscRawState.getState().notify({
                message: $filter('i18n')("previewWindow.copied"),
                duration: 1000
            });
        }, 150);
    }).apply(null, args);
  }

export function copyAsBase64(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    return (function () {
        let item = useSelectionState.getState().selected[0];
        let folderPath = path.normalize(useMiscRawState.getState().libraryPath + "/images/" + item.id + ".info/");
        let rawPath = path.normalize(`${folderPath}${item.name}.${item.ext}`);
        let thumbPath = path.normalize(`${folderPath}${item.name}_thumbnail.png`);
        let imageType = { jpg: true, jfif: true, insp: true, png: true, webp: true, gif: true };
        let ext2type = { "gif": "gif", "jpg": "jpeg", "png": "png", "jpeg": "jpeg", "jfif": "jpeg", "jpe": "jpeg", "insp": "jpeg", "webp": "webp" };
        let type;
        let base64;

        try {
            if (imageType[item.ext]) {
                type = ext2type[item.ext];
                base64 = fs.readFileSync(rawPath, 'base64');
            }
            else {
                type = "webp";
                base64 = fs.readFileSync(thumbPath, 'base64');
            }

            clipboard.writeText(`data:image/${type};base64,${base64}`);
            useMiscRawState.getState().notify({
                message: $filter('i18n')("previewWindow.copied"),
                duration: 1000
            });
        }
        catch (err) {
            electronLog && electronLog.error(err.stack || err);
        }
    }).apply(null, args);
  }

export function isInFolder (__lv_image, folder) {
            try {
            	if (!folder) return false;
                if (!__lv_image) return false;
                if (!__lv_image.folders || !__lv_image.folders.indexOf) {
                    __lv_image.folders = [];
                }
                // 状况1: 该资料夹本身包含图片
                var isContain = __lv_image.folders.indexOf(folder.id) > -1;
                if (useListState.getState().showSubfolderContent) {
                    // 状况2: 该资料夹不包含图片，但该资料夹的子文件夹包含
                    // 加速版本作法，更快判断图片是否存在于子文件夹
                    if (useFolderState.getState().currentFolderChildren) {
                        for (var i = 0; i < __lv_image.folders.length; i++) {
                            var __lv_folderId = __lv_image.folders[i];
                            if (useFolderState.getState().currentFolderChildren[__lv_folderId]) {
                                return true;
                            }
                        }
                    }
                    else {
                        eagle.utils.tree.walk(folder.children, 'children', function (child, parent) {
                            if (__lv_image.folders && __lv_image.folders.length > 0 && __lv_image.folders.indexOf(child.id) > -1) {
                                isContain = true;
                                return;
                            }
                        });
                    }
                }
                return isContain;
            }
            catch (err) {
                return false;
            }
        }

/* b1-9bz-C-4：finishQueue 变更处理（原 $watchCollection 的 handler，原样提取） */
function handleFinishQueueChanged(newValue: any, oldValue: any): void {
  const w: any = window as any;

    if (!useItemState.getState().raw || useItemState.getState().raw.length === 0) {
      if (useMiscRawState.getState().finishQueue.length > 0 && useMiscRawState.getState().finishQueue.length === useMiscRawState.getState().uploadQueue.length) {
        writeScopeField('finishQueue', []);
        syncUploadFromScope();
        writeScopeField('uploadQueue', []);
        syncUploadFromScope();
        machineryHideUploadQueue();
      }
      return;
    }

    if (useMiscRawState.getState().finishQueue.length > 0 && useMiscRawState.getState().finishQueue.length >= useMiscRawState.getState().uploadQueue.length) {
      // 清除倒数计时工具
      writeScopeField('addImageStartTime', undefined);
      clearInterval(domainAddImageTimeLeftInterval);

      var total = useMiscRawState.getState().uploadQueue.length;
      // 以队列最后一张图判断，是否要刷新使用者当前查看的列表
      var lastImage = useMiscRawState.getState().finishQueue[useMiscRawState.getState().finishQueue.length - 1];

      // 自动选择新增的图片
      var newItems: any[] = [];
      useMiscRawState.getState().finishQueue.forEach(function (image: any) {
        if (image && image.id) {
          newItems.push(image);
        }
      });

      writeScopeField('finishQueue', []);
      syncUploadFromScope();
      writeScopeField('uploadQueue', []);
      syncUploadFromScope();
      setHtmlEl(findEl(q("#upload-queue-progress"), ".message .percentage"), useMiscRawState.getState().finishQueue.length + "/" + useMiscRawState.getState().uploadQueue.length);
      setWidthEl(findEl(q("#upload-queue-progress"), ".current"), useMiscRawState.getState().finishQueue.length / useMiscRawState.getState().uploadQueue.length * 100 + "%");
      machineryHideUploadQueue();

      // 判斷是否有重複的圖片
      if (usePreferencesState.getState().preferences.notification.notification.enable !== 'false' && usePreferencesState.getState().preferences.notification.notification.when.repeatImage != 'false') {
        if (useMiscRawState.getState().duplicateQueue.length > 0) {
          openDuplicateChannel.emit({
            currentFolder: useFolderState.getState().currentFolder,
            mappings: useItemState.getState().duplicateMappings,
            duplicates: useMiscRawState.getState().duplicateQueue
          });
          if (usePreferencesState.getState().preferences.notification.soundEffect.enable != 'false') {
            useMiscRawState.getState().duplicateSound && useMiscRawState.getState().duplicateSound.play();
          }
          writeScopeField('duplicateQueue', []);
        }
      }
      // 如果沒有啟動重複通知，一律圖片直接添加上來
      else {
        useMiscRawState.getState().duplicateQueue.forEach(function (img: any) {
          machineryAddToDuplicateMapping(img);
          if (useItemState.getState().raw) { useItemState.getState().raw.unshift(img); }
          syncListFromScope();
        });
        writeScopeField('duplicateQueue', []);
      }

      function autoSelectUploadedItems() {
        if (useBodyState.getState().isDetailMode) return;

        if (usePreferencesState.getState().preferences.general.autoSelect !== 'true') {
          if (newItems.length === 1) {
            domainTimeout(function () {
              scrollToSelectedItem();
            }, 120);
          }
          return;
        }

        // 避免几百几千个？
        if (useBodyState.getState().viewMode !== 'random') {
          var MAX_AUTO_SELECT = 1000;
          if (newItems && newItems.length <= MAX_AUTO_SELECT) {
            writeScopeField('selected', newItems);
            syncInspectorFromScope();
            var targetSelectedIndex = useItemState.getState().allData.indexOf(useSelectionState.getState().selected[0]);
            writeScopeField('lastSelectedIndex', targetSelectedIndex);
            writeScopeField('currentFocus', "content");
            if (newItems.length === 1) {
              domainTimeout(function () {
                scrollToSelectedItem();
              }, 120);
            }
          }
        }
      }

      machineryCalculateImageBinding({}, function () {
        // NOTE: 图片添加完成后，如果添加的图片不是使用者正在查看的文件夹，不需要刷新画面
        if (useFolderState.getState().currentFolder) {
          try {
            if (!lastImage || !lastImage.folders) {
              useMiscRawState.getState().reload(true);
              autoSelectUploadedItems();
              return;
            }
            const needReload = isInFolder(lastImage, useFolderState.getState().currentFolder);
            if (needReload) {
              writeScopeField('startCursor', 0);
              useMiscRawState.getState().reload(true);
              autoSelectUploadedItems();
            }
          }
          catch (err: any) {
            useMiscRawState.getState().reload(true);
            autoSelectUploadedItems();
            electronLog && electronLog.error(err.stack || err);
          }
        }
        else if (useFolderState.getState().currentSmartFolder) {
          useMiscRawState.getState().reload(true);
        }
        // 如果来自全部图片、未归类、未分类，一律进行刷新
        else if (useBodyState.getState().viewMode == "all" || useBodyState.getState().viewMode == "unfiled" || useBodyState.getState().viewMode == "untagged") {
          writeScopeField('startCursor', 0);
          useMiscRawState.getState().reload(true);
          autoSelectUploadedItems();
        }
      });

      try {
        if (useMiscRawState.getState().finishQueue.length > 2) {
          if (w.process.platform == 'darwin') {
            window.setTimeout(function () { w.remote.app.dock.bounce("critical"); }, 1000);
          } else {
            window.setTimeout(function () {
              if (!document.hasFocus()) {
                w.currentWindow.flashFrame(true);
              }
            }, 1000);
          }
        }
      }
      catch (err: any) {
        electronLog && electronLog.error(err.stack || err);
      }

      // 讓 Palette Queue 繼續
      w.IPCHelper && w.IPCHelper.send('palette-resume', undefined, true);
      console.log("添加 %s 張圖片完成", total);
      console.timeEnd("添加圖片耗費時間");
    }
}


// ═══ b1-9bz-D-1 B-5：零依赖声明归位（dataMachinery 剪出，逐字）═══
export function machineryAddToDuplicateMapping(image: any): void {
  const w = window as any;
  var hashID = w.getHashID(image);
  if (!useItemState.getState().duplicateMappings) writeScopeField('duplicateMappings', {});
  useItemState.getState().duplicateMappings[hashID] = image;
}

export function machineryIsDuplicateImage(image: any): any {
  const w = window as any;
  if (!useItemState.getState().duplicateMappings) return false;
  if (image.ext === 'svg') return false;
  if (image.ext === 'tif') return false;
  if (image.ext === 'tiff') return false;

  var hashID = w.getHashID(image);
  if (!hashID) return false;
  // 垃圾桶文件不纳入考量
  if (useItemState.getState().duplicateMappings[hashID] && useItemState.getState().duplicateMappings[hashID].isDeleted) return false;
  return useItemState.getState().duplicateMappings[hashID];
}

export function machineryOpenDuplicate(options: any = {}): void {
  if (options?.selected) {
    openDuplicateScanPanelChannel.emit({
      items: [...useSelectionState.getState().selected],
      onMergedCallback: () => {
        writeScopeField('selected', useSelectionState.getState().selected.filter((item: any) => {
          return !item.isDeleted;
        }));
        syncInspectorFromScope();
        scopeEvalAsync();
      },
    });
  }
  else if (options?.currentPage) {
    openDuplicateScanPanelChannel.emit({
      items: [...useItemState.getState().allData],
    });
  }
  else {
    openDuplicateScanPanelChannel.emit({
      items: [...useItemState.getState().all],
    });
  }
}

export function machineryUpdateTxtItem(item: any): void {
  const w = window as any;
  var paragraphs = item.text.split("\n");
  var paragraphsHTML = "";
  paragraphsHTML += `<h4>${item.name.trim()}</h4>`;
  paragraphs.forEach(function (paragraph: any) {
    paragraphsHTML += `<p>${paragraph.trim()}</p>`;
  });
  setHtml("#box-" + item.id + " .txt-content div", paragraphsHTML);
  if (useSelectionState.getState().selected.length === 0 && useSelectionState.getState().selected[0] === item) {
    setHtml(".inspector .txt-content div", paragraphsHTML);
  }
}


// ═══ b1-9bz-D-1 B-5：零依赖声明归位（dataMachinery 剪出，逐字）═══
// ── b1-7d-3 域内自管（原 controller 闭包 var：addImageTimeLeftInterval 45319 邻域）──
let addImageTimeLeftInterval: any = null;

// ── 域内自管的 controller 闭包变量（原 bundle 28682/28683 内 var）──
export let calculateImageBindingTimeout: any = null;

// ── b1-4a 域内自管（原 controller 闭包 var：checkListItemsLessThanContainerTimeout 33661
//    邻域 / changeListHeightTimeout 33745 邻域）──
let checkListItemsLessThanContainerTimeout: any = null;

/* calculateImageBinding（bundle 28684-28965 逐字） */
export function machineryCalculateImageBinding(params: any, callback: any): void {
  const w = window as any;
  var duration = 50;
  if (calculateImageBindingTimeout) {
    duration = 50;
  } else {
    duration = 1;
  }
  const TagManager = useMiscRawState.getState().TagManager;
  if (TagManager && TagManager.azGroups) {
    const $timeout = getTimeout();
    $timeout && $timeout.cancel(calculateImageBindingTimeout);
  }
  const $timeout = getTimeout();
  calculateImageBindingTimeout = $timeout(function () {
    try {
      if (!useItemState.getState().raw) return;

      if (!params.ignoreSort) {
        machinerySortRawData(useMiscRawState.getState().orderBy);
      }

      console.time("calculateImageBinding");
      /* var path = require('path');（原文未使用，略去——无副作用） */
      var tags: any = {};
      var exts: any = {};
      writeScopeField('all', []);
      syncSidebarFromScope();
      writeScopeField('untagged', []);
      writeScopeField('unfiledCount', 0);
      writeScopeField('untaggedCount', 0);
      writeScopeField('trash', []);
      syncSidebarFromScope();
      syncListFromScope();
      writeScopeField('folderMappings', {});
      writeScopeField('tagsSuggestion', []);
      writeScopeField('folderList', []);
      syncSidebarFromScope();
      writeScopeField('lockedImages', {});

      const ancestorsCache: any = {};
      const defaultFolderCoverIdMap: any = {};

      w.eagle.utils.tree.walk(useFolderState.getState().folders, 'children', function(folder: any, parent: any, depth: any) {
        if (folder && parent) {
          folder.parent = parent.id;
        }

        // 列表版本 Folders
        useFolderState.getState().folderList.push(folder);
        syncSidebarFromScope();

        // 去除重複的資料夾
        const $filter = getFilter();
        folder.children = $filter('unique')(folder.children, 'id');
        folder.imagesMappings = {};
        folder.images = [];
        folder.imageCount = 0;
        folder.depth = depth;
        folder.descendantImageCount = 0;

        if (!folder.pinyin && typeof folder.name === "string") {
          folder.pinyin = w.tinyPinyin.convertToPinyin(folder.name);
        }

        if (folder.tags && folder.tags.length > 0) {
          folder.tags.forEach(function(tag: any) {
            useMiscRawState.getState().tagsSuggestion.push({
              value: tag,
              text: tag
            });
          });
        }

        ancestorsCache[folder.id] = machineryGetAncestorFolders(folder, [folder]);

        useItemState.getState().folderMappings[folder.id] = folder;
      });

      w.eagle.utils.tree.walk(useFolderState.getState().folders, 'children', function(folder: any, parent: any) {
        folder.extendTags = machineryGetExtendTags(folder, []);
        folder.covers = [];
      });


      w.eagle.utils.tree.walk(useFolderState.getState().smartFolders, 'children', function (smartFolder: any, parent: any, depth: any) {
        useItemState.getState().smartFolderMappings[smartFolder.id] = smartFolder;
      });

      // 重新建立圖片關係
      for (var rindex = 0; rindex < useItemState.getState().raw.length; rindex++) {
        var image = useItemState.getState().raw[rindex];

        if (!useItemState.getState().itemMappings[image.id]) {
          useItemState.getState().itemMappings[image.id] = image;
        }

        if (image.isDeleted) {
          useItemState.getState().trash.push(image);
          syncSidebarFromScope();
          syncListFromScope();
        }
        else {

          // 計算資料夾圖片總數
          if (image.folders && image.folders.length > 0) {
            var increaseAncestors: any = {};
            image.folders.forEach(function(folderId: any) {
              var folder = useItemState.getState().folderMappings[folderId];
              if (folder) {
                folder.imageCount++;

                if (folder.password && !folder.isUnLock) {
                  useItemState.getState().lockedImages[image.id] = true;
                }

                // 祖先们也都 + 1 , 记录在其他栏位上
                var ancestors = ancestorsCache[folder.id] || machineryGetAncestorFolders(folder, [folder]);
                ancestors.forEach(function (ancestor: any) {
                  // 避免重复加总
                  if (increaseAncestors[ancestor.id]) {
                    return;
                  }
                  if (!ancestor.descendantImageCount) ancestor.descendantImageCount = 0;
                  ancestor.descendantImageCount++;
                  increaseAncestors[ancestor.id] = true;

                  if (ancestor.password && !ancestor.isUnLock) {
                    useItemState.getState().lockedImages[image.id] = true;
                  }
                });
              }
            });
          }

          if (!useItemState.getState().lockedImages[image.id]) {
            useItemState.getState().all.push(image);
            syncSidebarFromScope();
            exts[image.ext] = true;
            if (image.tags && image.tags.length == 0) {
              writeScopeField('untaggedCount', useListState.getState().untaggedCount + 1);
            }

            if (!image.folders) {
              writeScopeField('unfiledCount', useListState.getState().unfiledCount + 1);
            }
            else if (image.folders.length === 0) {
              writeScopeField('unfiledCount', useListState.getState().unfiledCount + 1);
            }
            else {
              // 修复异常 folders
              if (image.folders.length === 1 && !useItemState.getState().folderMappings[image.folders[0]]) {
                if (useMiscRawState.getState().libraryModificationTime && image.lastModified && image.lastModified < useMiscRawState.getState().libraryModificationTime) {
                  image.folders = [];
                  writeScopeField('unfiledCount', useListState.getState().unfiledCount + 1);
                }
              }
              else if (image.folders[0] === null || image.folders[1] === null) {
                image.folders = [...new Set(image.folders)].filter(function (obj: any) { return obj != null; });
                if (image.folders.length === 0) {
                  writeScopeField('unfiledCount', useListState.getState().unfiledCount + 1);
                  try {
                    w.electronLog && w.electronLog.error(`[app] ${image.id} 's folder properity is incorrect[2], move to Uncategorized`);
                  } catch (err) { /* noop */ }
                }
              }
            }
          }

          if (!image.tags) {
            image.tags = [];
          }
        }


        if (!image.isDeleted && image.tags && image.tags.length > 0) {
          if (!useItemState.getState().lockedImages[image.id]) {
            image.tags.forEach(function(tag: any) {
              var tagName = tag;
              if (!tagName || tagName.length > 500) return;
              var tempTag = tags[tagName];
              if (!tempTag) {
                tags[tagName] = {
                  name: tag,
                  imageCount: 0,
                  groups: []
                };
                tempTag = tags[tagName];
              }
              tempTag.imageCount++;
            });
          }
        }

        if (image.folders && image.folders.length > 0) {
          for (var i = 0; i < image.folders.length; i++) {
            if (image.isDeleted) continue;
            if (image.noPreview) continue;
            if (useItemState.getState().lockedImages[image.id]) continue;
            // txt 不支持做为封面
            if (image.ext === 'txt') continue;
            var folderId = image.folders[i];
            var folder = useItemState.getState().folderMappings[folderId];
            if (folder) {
              if (!defaultFolderCoverIdMap[folderId]) {
                defaultFolderCoverIdMap[folderId] = image.id;
              }
            }
          }
        }
      }

      // 計算當前資料有哪些檔案類型
      var extList: any[] = [];
      Object.keys(exts).map(function(key: any) {
        extList.push(key);
      });

      extList = extList.sort();
      w.eagle.filter.filterTypes = [...extList, ...w.eagle.filter.buildInTypes];
      syncFilterFromScope();
      w.eagle.filter.filterTypes = [...new Set(w.eagle.filter.filterTypes)];
      syncFilterFromScope();

      // 如果祖先门没有封面，补上封面
      w.eagle.utils.tree.walk(useFolderState.getState().folders, 'children', function(folder: any, parent: any) {
        try {
          let converId = folder.coverId || defaultFolderCoverIdMap[folder.id];
          if (!folder.covers) folder.covers = [];
          if (converId && useItemState.getState().itemMappings[converId]) {
            var coverImage = useItemState.getState().itemMappings[converId];
            var thumbnailPath = w.FileUrlHelper.getThumbnailUrl(coverImage);
            let pos = "";
            if (coverImage.fontMetas) {
              pos = `center`;
            }
            else if (w.AUDIO_TYPES[coverImage.ext]) {
              pos = `audio center;`;
            }
            folder.covers[0] = `<img class="sub-folder-cover ${pos}" src="${thumbnailPath}" style="aspect-ratio: ${coverImage.width / coverImage.height};">`;
            if (!parent?.covers?.length) {
              parent.covers = [`<img class="sub-folder-cover ${pos}" src="${thumbnailPath}" style="aspect-ratio: ${coverImage.width / coverImage.height};">`];
            }
          }
          if (folder.covers.length == 0) {
            folder.children.forEach(function (child: any) {
              Array.prototype.push.apply(folder.covers, child.covers);
              if (folder.covers.length > 3) return;
            });
          }
        }
        catch (err) { /* noop */ }
      });

      // 初始化 Tags
      TagManager.rawdata = [];
      Object.keys(tags).forEach(function(key: any) {
        if (!pinyinCache[key]) {
          if (isString(tags[key].name)) {
            pinyinCache[key] = w.tinyPinyin.convertToPinyin(tags[key].name);
          }
        }
        tags[key].pinyin = pinyinCache[key];
        if (key) {
          TagManager.rawdata.push(tags[key]);
        }
      });

      TagManager.calculateTags();
      writeScopeField('tags', TagManager.rawdata);
      syncSidebarFromScope();

      if (!useFolderState.getState().tags) {
        writeScopeField('tags', []);
        syncSidebarFromScope();
      }

      console.timeEnd("calculateImageBinding");
      if (callback) {
        callback();
      }
    }
    catch (err: any) {
      w.electronLog && w.electronLog.error(err.stack || err);
    }
  }, duration);
}

function machineryCalcuteAddImageTimeLeft(): void {
  const w = window as any;
  if (useMiscRawState.getState().uploadQueue.length > 0) {
    if (!useMiscRawState.getState().addImageStartTime) {
      writeScopeField('addImageStartTime', Date.now());
    }
    var elapsedTime = (new Date().getTime()) - useMiscRawState.getState().addImageStartTime;
    var chunksPerTime = useMiscRawState.getState().finishQueue.length / elapsedTime;
    var estimatedTotalTime = useMiscRawState.getState().uploadQueue.length / chunksPerTime;
    var remain = parseInt((estimatedTotalTime - elapsedTime) / 1000 as any);
    if (w.is.number(remain)) {
      writeScopeField('addImageTimeLeftInSeconds', remain);
      syncUploadFromScope();
    }
  }
}

/* changeMetaItems（bundle 37273-37278 逐字） */
export function machineryChangeMetaItems(type: any): void {
  const w = window as any;
  writeScopeField('listMetaType', type);
  syncPanelFromScope();
  w.localStorage.setItem("eagle.list.meta.type", useMiscRawState.getState().listMetaType);
  machineryUpdateItemsView(useItemState.getState().allData);
  w.electronLog && w.electronLog.info(`[app] Change list display info: ${useMiscRawState.getState().listMetaType}`);
}

export function machineryCheckListItemsLessThanContainer(): void {
  const w = window as any;
  if (!w.ig) return;
  if (w.ig.getItems().length < 180) {
    clearTimeout(checkListItemsLessThanContainerTimeout);
    checkListItemsLessThanContainerTimeout = setTimeout(function () {
      console.log("checkListItemsLessThanContainer");
      // 如果列表尺寸很小，一次載入兩頁
      var boxList = q("#box-container .box-list") as HTMLElement | null;
      if (boxList && boxList.style) {
        var boxListHeight = parseInt(boxList.style.height);
        if (boxListHeight < heightOf(q("#box-container"))) {
          w.ig.trigger("append");
        }
      }
    }, 500);
  }
}

export function machineryCopyImages(event: any): void {
  const w = window as any;
  if (useBodyState.getState().viewMode === 'alltags') {
    var selectedTags = machineryGetSelectedTags();
    if (selectedTags && selectedTags.length > 0) {
      w.electron.clipboard.writeText(selectedTags.join(","));
      useMiscRawState.getState().notify({
        message: getFilter()('i18n')("Context.Tag.Copy.Success"),
        duration: 1000
      });
    }
  }
  else {
    if (useBodyState.getState().currentFocus == "sidebar") {
      if (useMiscRawState.getState().selectedFolders.length > 0) {
        let copyText = "";
        useMiscRawState.getState().selectedFolders.forEach(function (folder: any, index: any) {
          copyText += folder.name;
          if (index < useMiscRawState.getState().selectedFolders.length - 1) {
            copyText += "\n";
          }
        });
        w.electron.clipboard.writeText(copyText);
      }
      else if (useMiscRawState.getState().selectedSmartFolders.length > 0) {
        let copyText = "";
        useMiscRawState.getState().selectedSmartFolders.forEach(function (folder: any, index: any) {
          copyText += folder.name;
          if (index < useMiscRawState.getState().selectedSmartFolders.length - 1) {
            copyText += "\n";
          }
        });
        w.electron.clipboard.writeText(copyText);
      }
      else if (useFolderState.getState().currentSmartFolder) {
        w.electron.clipboard.writeText(useFolderState.getState().currentSmartFolder.name);
      }
      else if (useFolderState.getState().currentFolder) {
        w.electron.clipboard.writeText(useFolderState.getState().currentFolder.name);
      }
    }
    else if (useSelectionState.getState().selected.length > 0) {
      const ipc = w.__eagleIpc || (w.electron && w.electron.ipcRenderer);
      ipc.sendTo(w.backgroundWindowID, 'copy-images', useSelectionState.getState().selected);
      w.RecentFileManager.addFiles(useSelectionState.getState().selected);
      setTimeout(function () {
        useMiscRawState.getState().notify({
          message: getFilter()('i18n')("previewWindow.copied"),
          duration: 1000
        });
      }, 150);
    }
  }
}

export function machineryCreateTxtFileFromTemplate(event: any): void {
  event && event.preventDefault();
  machineryNewFileFromTemplate("txt");
  scopeEvalAsync();
}

export function machineryEnableImageNameEditable(event: any, $name: any): void {
  const w = window as any;
  const el = (($name as any) instanceof HTMLElement ? $name : ($name && $name[0])) as HTMLElement;
  if (!el) return;
  if (hasClass(el, "editable")) return;
  var originalName = textEl(el).trim();
  el.setAttribute("contenteditable", "true");
  el.classList.add("editable");
  el.focus();
  setTimeout(function () {
    el.focus();
    selectText(el);
    document.execCommand('selectAll', false, null as any);
  }, 50);

  onEl(el, "mousedown", function (event: any) {
    event.stopPropagation();
  });

  onEl(el, "keydown", function (event: any) {
    var keyCode = event.keyCode;
    switch (keyCode) {
      case 13:
        event.preventDefault();
        event.stopPropagation();
        triggerEl(el, "blur");
        break;
      case 27:
        event.preventDefault();
        event.stopPropagation();
        setHtmlEl(el, `<span>${originalName}</span>`);
        exitEditable();
        break;
      case 65:
        if (event.metaKey || event.ctrlKey) {
          event.preventDefault();
          event.stopPropagation();
          document.execCommand('selectAll', false, null as any);
        }
        break;
    }
  });

  onEl(el, "paste", function (e: any) {
    e.preventDefault();
    var text = e.clipboardData ? e.clipboardData.getData('text/plain') : '';
    document.execCommand("insertHTML", false, text);
  });

  onEl(el, "blur", w.debounce(function () {
    exitEditable();
    var newName = textEl(el);
    if (!newName || !newName.trim()) {
      setHtmlEl(el, `<span>${originalName}</span>`);
      return;
    }
    if (newName !== originalName && useSelectionState.getState().selected[0]) {

      var name = newName;
      var image = useSelectionState.getState().selected[0];

      name = name.substr(0, getRemainingFilenameLength()(useMiscRawState.getState().libraryPath));
      name = getSanitize()(name).replace(/%/g, "").replace(/&lt;/g, "").replace(/&gt;/g, "").trim();
      name = unescape(name);
      w.eagle.inspector.newName = name;

      if (emojiRegex.test(name)) {
        name = name.replace(emojiRegex, '');
        w.eagle.inspector.newName = name;
      }

      if (name) {
        image.oldName = originalName;
        image.name = name;
        image.newName = name;
      }
      setHtmlEl(el, `<span>${name}</span>`);
      console.log(`${originalName} > ${name}`);
      w.ayncsImagesChange([image]);
      w.hiddenByCurrentFilter([image]);
      // TagManager.getSuggestTags([image]);
      scopeEvalAsync();
      try { w.electronLog && w.electronLog.info(`[app] Change list item's name: ${originalName}(${image.id}) > ${newName}`); } catch (err) { }
    }
  }, 200, true));

  function exitEditable() {
    el.style.whiteSpace = "normal";
    el.setAttribute("contenteditable", "false");
    el.classList.remove("editable");
    offEl(el, "keyup");
    offEl(el, "keydown");
    offEl(el, "mousedown");
    setTimeout(function () {
      el.style.whiteSpace = "";
    }, 33);
  }
}

export function machineryEnlargeThumbnails(): void {
  clearTimeout(machineryEnlargeThumbnailsTimeout);
  machineryEnlargeThumbnailsTimeout = setTimeout(() => {
    console.time("enlargeThumbnails");
    const boxes = qa(".box.show.jpg, .box.show.png, .box.show.webp, .box.show.bmp, .box.show.jfif")
      .filter((e) => !e.classList.contains("enlarge-thumbnail"));
    const imgs = boxes.flatMap((b) => Array.from(b.querySelectorAll(".thumbnail img")) as HTMLElement[]);

    imgs.forEach((img) => {
      const box = img.parentElement?.parentElement as HTMLElement | null;
      const rawsrc = getAttr(img, 'raw');
      if (rawsrc) {
        setAttrEl(img, 'src', rawsrc);
        if (box) addClassEl(box, "enlarge-thumbnail");
      }
    });
    console.timeEnd("enlargeThumbnails");
  }, 600);
}

let machineryEnlargeThumbnailsTimeout: any = null;

export function machineryFilterSidebarItem(folders: any[], keyword: any): any[] {
  const w = window as any;
  if (!keyword) return folders;
  var keyword_cn = w.chineseConvert.tw2cn(keyword).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/\ /g, '').toLowerCase();

  var folderSearchItems = folders.map((folder: any) => {
    var folderNameCN = w.chineseConvert.tw2cn(folder.name).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    if (keyword.length >= 30 || folder.name.length >= 30) {
      return {
        folder: folder,
        name: folderNameCN,
        search: [folderNameCN]
      };
    }
    return {
      folder: folder,
      name: folderNameCN,
      search: [folderNameCN, ...uniq(
        w.cartesianProduct(w.pinyinlite(folderNameCN, { keepUnrecognized: true }).filter((p: any) => p.length > 0))
          .map((item: any) => item.join(' '))
      )],
    };
  });

  var scores = folderSearchItems.map((item: any) => {
    return {
      item: item,
      name: item.name,
      score: max(item.search.map((pinyin: any) => pinyin.score(keyword_cn))),
    };
  });

  var result = scores.filter((i: any) => i.score > 0).map(function (i: any) {
    return i.item.folder;
  });

  return result;
}

export function machineryFindDupclipate(currentFolder: any, hasColorInfo: any): void {
  const w = window as any;
  var duplicates: any[] = [];
  var pushedMapping: any = {};
  var duplicateMappings: any = {};

  writeScopeField('duplicates', []);
  writeScopeField('duplicateGroupings', {});

  if (!useItemState.getState().raw) return;

  if (!hasColorInfo) {
    duplicateMappings = useItemState.getState().duplicateMappings;
  }
  else {
    duplicateMappings = {};
  }

  writeScopeField('duplicateTarget', currentFolder);

  // 全部圖片
  if (!currentFolder) {
    // 建立查詢表
    w.eagle.filter.filterExtensions = {};
    w.eagle.filter.filterCamerasMapping = {};
    for (var rindex = useItemState.getState().raw.length - 1; rindex >= 0; rindex--) {
      var image = useItemState.getState().raw[rindex];

      // Note: 这部分原来放在 rebindRefresh 中，因为不需要重复计算，故放在这里
      if (w.VIDEO_TYPES[image.ext]) {
        w.eagle.filter.filterExtensions['video'] = true;
      } else if (w.AUDIO_TYPES[image.ext]) {
        w.eagle.filter.filterExtensions[image.ext] = true;
        w.eagle.filter.filterExtensions['audio'] = true;
      } else if (w.FONT_TYPES[image.ext]) {
        w.eagle.filter.filterExtensions['font'] = true;
      } else {
        switch (image.ext) {
          case 'ppt':
          case 'pptx':
          case 'potx':
            w.eagle.filter.filterExtensions['powerpoint'] = true;
            break;
          case 'doc':
          case 'docx':
            w.eagle.filter.filterExtensions['word'] = true;
            break;
          case 'xls':
          case 'xlsx':
            w.eagle.filter.filterExtensions['excel'] = true;
            break;
          case 'arw':
          case 'cr2':
          case 'cr3':
          case 'crw':
          case 'dng':
          case 'erf':
          case 'nef':
          case 'nrw':
          case 'mrw':
          case 'orf':
          case 'pef':
          case 'raf':
          case 'raw':
          case 'rw2':
          case 'sr2':
          case 'srw':
          case 'x3f':
            w.eagle.filter.filterExtensions['raw'] = true;
            w.eagle.filter.filterExtensions[image.ext] = true;
            break;
          default:
            w.eagle.filter.filterExtensions[image.ext] = true;
        }
      }

      if (image.rawMetas) {
        w.eagle.filter.filterCamerasMapping[image.rawMetas.camera] = true;
      }

      var hashID = w.getHashID(image, hasColorInfo);
      if (!hashID) continue;
      if (image.ext === 'svg') continue;
      if (image.ext === 'tif') continue;
      if (image.ext === 'tiff') continue;
      if (image.isDeleted) continue;

      // NOTE: 如果是用户主动扫描，才计算图片去重复
      if (hasColorInfo) {
        if (!useMiscRawState.getState().duplicateGroupings[hashID]) {
          useMiscRawState.getState().duplicateGroupings[hashID] = [];
        }
        useMiscRawState.getState().duplicateGroupings[hashID].push(image);
      }

      // 如果有東西，裡面的東西跟自己都是那個重複者
      if (!duplicateMappings[hashID]) {
        duplicateMappings[hashID] = image;
      } else {
        // Note: 下面注解的代码严重影响效能
        // 优化版
        if (!pushedMapping[hashID]) {
          duplicates.push(duplicateMappings[hashID]);
        }
        pushedMapping[hashID] = true;
        duplicates.push(image);
      }
    }

    if (Object.keys(w.eagle.filter.filterCamerasMapping).length > 0) {
      w.eagle.filter.filterCameras = Object.keys(w.eagle.filter.filterCamerasMapping);
      syncFilterFromScope();
      w.eagle.filter.filterCameras = w.eagle.filter.filterCameras.sort(function (a: any, b: any) {
        if (a > b) return 1;
        if (a < b) return -1;
        return 0;
      });
      syncFilterFromScope();
    }
  }
  else {

    var images = machineryGetFolderImages(currentFolder, useListState.getState().showSubfolderContent);
    for (var rindex2 = images.length - 1; rindex2 >= 0; rindex2--) {

      var image2 = images[rindex2];
      var hashID2 = w.getHashID(image2, hasColorInfo);
      if (!hashID2) continue;
      if (image2.ext === 'svg') continue;
      if (image2.ext === 'tif') continue;
      if (image2.ext === 'tiff') continue;
      if (image2.isDeleted) continue;

      if (hasColorInfo) {
        if (!useMiscRawState.getState().duplicateGroupings[hashID2]) {
          useMiscRawState.getState().duplicateGroupings[hashID2] = [];
        }
        useMiscRawState.getState().duplicateGroupings[hashID2].push(image2);
      }

      // 如果有東西，裡面的東西跟自己都是那個重複者
      if (!duplicateMappings[hashID2]) {
        duplicateMappings[hashID2] = image2;
      } else {
        // 优化版
        if (!pushedMapping[hashID2]) {
          duplicates.push(duplicateMappings[hashID2]);
        }
        pushedMapping[hashID2] = true;
        duplicates.push(image2);
      }
    }
  }

  writeScopeField('duplicates', duplicates);

  if (hasColorInfo) {
    var duplicateGroupings = Object.keys(useMiscRawState.getState().duplicateGroupings).map(function (key: any) { return useMiscRawState.getState().duplicateGroupings[key]; });
    duplicateGroupings = duplicateGroupings.filter(function (group: any) {
      return group.length > 1;
    });
    writeScopeField('duplicateGroupings', duplicateGroupings);
  }
}

export function machineryForceFitImageSize(image: any, usingThumbnail: any): void {
  const w = window as any;
  if (!image) return;
  if (!useBodyState.getState().isDetailMode) return;
  if (qa("#detail-image").length === 0) return;
  cssSet("#detail-image", {
    width: image.width,
    height: image.height,
    transition: 'none'
  });
  if (usingThumbnail) {
    if (image.animated || (image.orientation && image.orientation !== 1)) {
      setAttr("img#detail-image", "src", callExternal('getRawUrl', image));
    }
    else {
      setAttr("img#detail-image", "src", w.FileUrlHelper.getThumbnailUrl(image));
    }
  }
}

export function machineryGetItemByElement(element: any): any {
  if (!element) return "";
  // var id = element.id.replace("box-", "");
  var id = element.getAttribute("data-box-id");
  return useItemState.getState().itemMappings[id];
}

export function machineryHideUploadQueue(): void {
  const w = window as any;
  if (useMiscRawState.getState().uploadQueue.length === 0) {
    removeClass("#upload-queue-progress", "open");
    removeClass("body", "is-uploading");
    w.updateWindowProgressBar(-1);
  }
}

export function machineryNewFileFromTemplate(ext: any): void {
  const w = window as any;
  const fs = w.require('fs');
  const path = w.require('path');

  const templatePath = path.normalize(`${w.resourcesPath}/templates/Untitled.${ext}`);
  if (!fs.existsSync(templatePath)) return;

  const newFilePath = `${w.EAGLE_THUMBNAIL_TEMP_PATH}/Untitled.${ext}`;
  const filePath = newFilePath;
  try {
    const templateContent = fs.readFileSync(templatePath);
    fs.writeFileSync(newFilePath, templateContent);

    const file: any = {
      name: w.i18n.__("general.untitled.title"),
      path: filePath,
      lastModified: Date.now()
    };

    if (useFolderState.getState().currentFolder && useFolderState.getState().currentFolder.id) {
      file.folders = [useFolderState.getState().currentFolder.id];
      if (useFolderState.getState().currentFolder.extendTags) {
        file.tags = useFolderState.getState().currentFolder.extendTags;
        file.tags = [...new Set(file.tags)];
      }
    }
    uploadFiles([file]);
    machineryShowUploadQueue();

    const ipc = w.__eagleIpc || (w.electron && w.electron.ipcRenderer);
    ipc.send('electron-info', `[app] Create file from [Untitled.${ext}]`);
  }
  catch (err: any) {
    w.electronLog && w.electronLog.error(err.stack || err);
  }
}

/** imageSize.height 变化后的统一处理（原 $watch("imageSize.height") 的 listener）。 */
export function machineryOnImageSizeHeightChanged(): void {
  if (!useLayoutState.getState().imageSize) return;
  machineryUpdateSubFolderWidth();
  machineryUpdateListSlider(useLayoutState.getState().imageSize.height);
  if (useLayoutState.getState().imageSize.height > 600 && useMiscRawState.getState().showOriginalImageWhenLarge) {
    machineryEnlargeThumbnails();
  }
  else {
    machineryShrinkThumbnails();
  }
}

export function machineryPreloadImage(mode: any): void {
  const w = window as any;
  const supportFoamts: any = {
    "jpg": true,
    "jpeg": true,
    "png": true,
    "webp": true,
    "avif": true,
    "insp": true,
    "jfif": true,
    "jpe": true,
    "jxl": true,
    "bmp": true,
  };
  clearTimeout(preloadImageTimeout);
  preloadImageTimeout = setTimeout(function () {
    const idx = machineryCurrentIndex();
    const nextImage = useItemState.getState().allData[idx];
    const preImage = useItemState.getState().allData[idx - 2];
    if (mode === "next") {
      if (nextImage && supportFoamts[nextImage?.ext]) {
        detailZoom()?.preload( nextImage);
      }
    }
    else {
      if (preImage && supportFoamts[preImage?.ext]) {
        detailZoom()?.preload( preImage);
      }
    }
  }, 100);
}

export function machineryPrependImages(images: any[], updateView: any): void {
  for (var i = 0; i < images.length; i++) {
    useItemState.getState().itemMappings[images[i].id] = images[i];
  }

  if (images[0].id) {
    useItemState.getState().allData.unshift(images[0]);
    syncListFromScope();
    clearTimeout(prependImagesTimeout);
    prependImagesTimeout = setTimeout(function () {
      machineryResetImageData(images);
    }, 500);
  }
}

export async function machineryRebindRefresh(muteMode: any, contentFilterCache: any, startCursor: any): Promise<void> {
  machineryCalls.rebindRefresh++;
  const w = window as any;

  if (!useMiscRawState.getState().isItemBindCalculated) return;
  if (!useItemState.getState().raw) return;
  console.time("rebindRefresh");
  var data: any[] = [];

  console.time("calcuteFilterResult");
  data = await machineryCalcuteFilterResult(data, contentFilterCache);
  console.timeEnd("calcuteFilterResult");


  // 计算这批图片里面出现的标签
  if (w.eagle.filter.tagFilterLogic === "OR" || w.eagle.filter.tagFilterLogic === "EQUAL") {
    machineryCalcuteContainTags(useMiscRawState.getState().preelaborations);
  }
  else if (w.eagle.filter.tagFilterLogic === "AND") {
    machineryCalcuteContainTags(data);
  }

  // 计算 Filter Badge 数量
  machineryCalcuteFilterBadge();

  // 置顶排序
  console.time("sort:置顶");
  if (useFolderState.getState().currentFolder && useFolderState.getState().currentFolder.orderBy !== "RANDOM") {
    let currentFolderId = useFolderState.getState().currentFolder.id;
    // 原码 comparator 在 ta/tb 皆空时隐式返回 undefined（quirk 逐字保留），故 return 标注 any
    data = data.sort(function (a: any, b: any): any {
      var ta = a.pinned ? a.pinned[currentFolderId] : undefined;
      var tb = b.pinned ? b.pinned[currentFolderId] : undefined;
      if (ta || tb) {
        try {
          if (ta && !tb) return -1;
          if (!ta && tb) return 1;
          if (ta > tb) return -1;
          if (ta < tb) return 1;
          return 0;
        } catch (err) {
          return 0;
        }
      }
    });
  }
  console.timeEnd("sort:置顶");

  writeScopeField('allData', data);
  syncListFromScope();

  // Note: 2019/08/05 避免拖拽順序使用 $scope.itemMappings 獲取的內容跟真實內容不一致，造成拖拽無法使用
  // 這段代碼主要用來刷新頁面上出現元件的有效性
  if (useFolderState.getState().currentFolder) {
    try {
      for (let i = 0; i < useItemState.getState().allData.length; i++) {
        useItemState.getState().itemMappings[useItemState.getState().allData[i].id] = useItemState.getState().allData[i];
      }
    } catch (err) { /* noop */ }
  }

  writeScopeField('filtereds', useItemState.getState().allData.slice(0, useMiscRawState.getState().len * useMiscRawState.getState().page));
  syncListFromScope();

  machineryRefreshSubfolderList();

  // 減少重複計算，將原先計算智能文件夾數量功能，放在這裡
  if (useMiscRawState.getState().selectedSmartFolders.length === 0 && useFolderState.getState().currentSmartFolder) {
    if (useFolderState.getState().currentSmartFolder.conditions && useFolderState.getState().currentSmartFolder.conditions.length > 0) {
      useFolderState.getState().currentSmartFolder.imageCount = useItemState.getState().allData.length;
    }
  }

  let currentViewDataLength = useItemState.getState().allData.length;
  if (currentViewDataLength < 200) {
    writeScopeField('keywordDebounce', 50);
  }
  else if (currentViewDataLength < 50000) {
    writeScopeField('keywordDebounce', 200);
  }
  else if (currentViewDataLength < 100000) {
    writeScopeField('keywordDebounce', 250);
  }
  else {
    writeScopeField('keywordDebounce', 300);
  }

  console.timeEnd("rebindRefresh");

  if (!muteMode) {
    if (w.eagle.filter.filterBadge > 0) writeScopeField('startCursor', 0);
    w.resetNgGridLayoutData(useItemState.getState().allData, startCursor || useFolderState.getState().startCursor);
  }
  machineryUpdateItemsView(useSelectionState.getState().selected);
  trigger("#box-container-scrollbar", "UPDATE_BOX_SCROLLBAR");
  if (w.HoverPreview.isShow) {
    w.HoverPreview.hide();
  }
  scopeEvalAsync();
}

/* rebindRefreshLazy（bundle 27007-27013 逐字；1000ms 防抖，rebindRefreshLazyTimeout 域内自管） */
export function machineryRebindRefreshLazy(): void {
  const $timeout = getTimeout();
  $timeout.cancel(rebindRefreshLazyTimeout);
  rebindRefreshLazyTimeout = $timeout(function () {
    machineryRebindRefresh();
  }, 1000);
}

export function machineryRemoveFromDuplicateMapping(image: any): void {
  const w = window as any;
  var hashID = w.getHashID(image);
  delete useItemState.getState().duplicateMappings[hashID];
}

export function machineryRenameImages(): void {
  const w = window as any;
  if (useSelectionState.getState().selected.length > 1) {
    openRenameChannel.emit({
      type: "IMAGE",
      images: useSelectionState.getState().selected
    });
  }
  else {
    var imageId = useSelectionState.getState().selected[0].id;
    var $box = q(`#box-${imageId}`);
    if ($box) {
      const boxEl = $box;
      setTimeout(() => {
        machineryEnableImageNameEditable(w.event, boxEl.querySelector(".name"));
      }, 50);
    }
  }
}

/* resetImageData（bundle 30540-30548 逐字；controller 闭包函数 → 域内移植） */
function machineryResetImageData(images: any[]): void {
  const w = window as any;
  if (useBodyState.getState().viewMode == "all" || (useFolderState.getState().currentFolder && images[0].folders[0] && images[0].folders.indexOf(useFolderState.getState().currentFolder.id) > -1) || (images[0].folders && images[0].folders.length === 0 && useBodyState.getState().viewMode == "unfiled")) {
    w.resetNgGridLayoutData(useItemState.getState().allData, 0);
    scopeEvalAsync();
  }
}

/* scrollToCurrentItem（bundle 34118-34130 逐字：selected 末盒 posy 属性 → 容器居中定位） */
export function machineryScrollToCurrentItem(): void {
  const w = window as any;
  if (useSelectionState.getState().selected.length > 0) {
    var $lastItem = qa(".box.selected").slice(-1)[0] as HTMLElement | undefined;
    if ($lastItem) {
      let y = $lastItem.getAttribute("posy");
      if (y != null) {
        let offsetTop = heightOf(q("#box-container")) / 2 - heightOf($lastItem) / 2;
        setScrollTop("#box-container", parseInt(y as any) - offsetTop);
      }
    }
  }
}

export function machineryShowUploadQueue(): void {
  const w = window as any;
  if (!useMiscRawState.getState().addImageStartTime) {
    writeScopeField('addImageStartTime', Date.now());
  }
  addClass("body", "is-uploading");
  addClass("#upload-queue-progress", "open");
  removeClass("#upload-queue-progress .progressbar", "ng-hide");
  setHtml("#upload-queue-progress .message .percentage", useMiscRawState.getState().finishQueue.length + "/" + useMiscRawState.getState().uploadQueue.length);
  addImageTimeLeftInterval = setInterval(function () {
    machineryCalcuteAddImageTimeLeft();
    scopeEvalAsync();
  }, 1000);
}

export function machineryShrinkThumbnails(): void {
  clearTimeout(machineryShrinkThumbnailsTimeout);
  machineryShrinkThumbnailsTimeout = setTimeout(() => {
    console.time("shrinkThumbnails");
    const boxes = qa(".box.enlarge-thumbnail.jpg, .box.enlarge-thumbnail.png, .box.enlarge-thumbnail.webp, .box.enlarge-thumbnail.bmp, .box.enlarge-thumbnail.jfif");
    const imgs = boxes.flatMap((b) => Array.from(b.querySelectorAll(".thumbnail img")) as HTMLElement[]);

    imgs.forEach((img) => {
      const box = img.parentElement?.parentElement as HTMLElement | null;
      const lsrc = getAttr(img, 'lsrc');
      if (lsrc) {
        setAttrEl(img, 'src', lsrc);
        if (box) removeClassEl(box, "enlarge-thumbnail");
      }
    });
    console.timeEnd("shrinkThumbnails");
  }, 600);
}

let machineryShrinkThumbnailsTimeout: any = null;

export function machinerySortData(data: any, orderBy: any): any {
  const w = window as any;
  let clone = data.slice();
  console.time("sortRawData");
  switch (orderBy) {
    case 'NAME':
      // 使用 collator 会比直接呼叫 localeCompare 快上 20x 以上
      var collator = new Intl.Collator(w.languageBCP, { numeric: true, sensitivity: 'base' });
      clone.sort(function (a: any, b: any) {
        return collator.compare(a.name, b.name);
      });
      break;
    case 'EXT':
      var collator2 = new Intl.Collator(w.languageBCP, { numeric: true, sensitivity: 'base' });
      clone.sort(function (a: any, b: any) {
        return collator2.compare(a.ext, b.ext);
      });
      break;
    case 'RESOLUTION':
      clone.sort(function (a: any, b: any) {
        var ra = a.width * a.height;
        var rb = b.width * b.height;
        if (ra > rb) return 1;
        if (ra < rb) return -1;
        return 0;
      });
      break;
    case 'FILESIZE':
      clone.sort(function (a: any, b: any) {
        var sizeA = parseInt(a.size);
        var sizeB = parseInt(b.size);
        if (sizeA > sizeB) return 1;
        if (sizeA < sizeB) return -1;
        return 0;
      });
      break;
    case 'RATING':
      clone.sort(function (a: any, b: any) {
        var starA = parseInt(a.star) || 0;
        var starB = parseInt(b.star) || 0;
        if (starA > starB) return 1;
        if (starA < starB) return -1;
        return 0;
      });
      break;
    case 'DURATION':
      clone.sort(function (a: any, b: any) {
        var durationA = parseInt(a.duration) || 0;
        var durationB = parseInt(b.duration) || 0;
        if (durationA > durationB) return 1;
        if (durationA < durationB) return -1;
        return 0;
      });
      break;
    case 'MANUAL':
      console.time("MANUAL");
      // Note: 使用 mapping 先记录 order 数据，在 sort 函式就不需要使用 _.get 来获取，这样能提升 20x 性能
      var orderMappings: any = {};
      var folderId = useFolderState.getState().currentFolder.id;
      for (var i = 0; i < data.length; i++) {
        var item = data[i];
        if (item.order && item.order[folderId]) { orderMappings[item.id] = item.order[folderId] }
        else { orderMappings[item.id] = item.modificationTime + ''; }
      }

      clone.sort(function (a: any, b: any) {
        var aTime = orderMappings[a.id];
        var bTime = orderMappings[b.id];
        if (aTime > bTime) return -1;
        else if (aTime < bTime) return 1;
        else { return 0; }
      });

      console.timeEnd("MANUAL");
      break;
    case 'BTIME':
      clone.sort(function (a: any, b: any) {
        var btimeA = a.btime || a.modificationTime;
        var btimeB = b.btime || b.modificationTime;
        if (btimeA > btimeB) return -1;
        if (btimeA < btimeB) return 1;
      });
      break;
    case 'MTIME':
      clone.sort(function (a: any, b: any) {
        var mtimeA = a.mtime || a.modificationTime;
        var mtimeB = b.mtime || b.modificationTime;
        if (mtimeA > mtimeB) return -1;
        if (mtimeA < mtimeB) return 1;
      });
      break;
    case 'RANDOM':
      clone.shuffle();
      break;
    case 'TAGS':
      // 使用 collator 会比直接呼叫 localeCompare 快上 20x 以上
      var collator3 = new Intl.Collator(w.languageBCP, { numeric: true, sensitivity: 'base' });
      clone.sort(function (a: any, b: any) {
        const aTag1 = a?.tags?.[0] ?? '';
        const bTag1 = b?.tags?.[0] ?? '';
        return collator3.compare(aTag1, bTag1);
      });
      break;
    default:
      clone.sort(function (a: any, b: any) {
        if (a.modificationTime > b.modificationTime) return -1;
        else if (a.modificationTime < b.modificationTime) return 1;
        return 0;
      });
  }
  console.timeEnd("sortRawData");
  return clone;
}

/* toggleCommentMode（bundle 21166-21169 逐字） */
export function machineryToggleCommentMode(event: any): void {
  event.preventDefault();
  writeScopeField('isCommentMode', !useBodyState.getState().isCommentMode);
  syncDetailFromScope();
}

export function machineryUpdateItemView(item: any): void {
  const w = window as any;
  const fs = w.require && w.require('fs');

  if (!item) return;
  try {
    var id = item.id;
    var $element = q("#box-" + id) as HTMLElement | null;
    if (!$element) return;
    const findEl = (sel: string) => $element!.querySelector(sel) as HTMLElement | null;
    var $name = findEl(".name span");
    var $iconName = findEl(".ext-icon-name");
    var $metas = findEl(".metas");
    var $propTags = findEl(".prop.tags");
    var $propResolution = findEl(".prop.resolution");
    var $propRating = findEl(".prop.rating");
    var $propSize = findEl(".prop.size");
    var isSelected = useItemState.getState().selectedMappings[id];
    var tags = item.tags || [];
    var isTagged = tags.length > 0;
    var $annotationCount = findEl(".annotation-count");
    var ratingStrings: any = {
      "undefined": "★★★★★",
      "0": "★★★★★",
      "1": "<y>★</y>★★★★",
      "2": "<y>★★</y>★★★",
      "3": "<y>★★★</y>★★",
      "4": "<y>★★★★</y>★",
      "5": "<y>★★★★★</y>",
    };
    var tagsFormated = "-";
    if (item.tags && item.tags.length) {
      var tags2 = item.tags.map(function (tag: any) {
        try {
          return `<div class="tag color-${useMiscRawState.getState().TagManager.tagMappings[tag].color}">${tag}</div>`;
        } catch (err) { /* noop */ }
      });
      tagsFormated = tags2.join("");
    }

    $element.setAttribute("data-height", item.height);
    $element.setAttribute("data-width", item.width);

    if (textEl($name) !== item.name) {
      if (!useItemState.getState().modifiedMappings[item.id]) useItemState.getState().modifiedMappings[item.id] = 0;
      useItemState.getState().modifiedMappings[item.id]++;
      let src = w.FileUrlHelper.getLastestThumbnailUrl(item);
      var $img = findEl(".thumbnail img");
      if ($img) {
        $img.setAttribute("lazysrc", "");
        $img.setAttribute("lsrc", src);
        $img.setAttribute("raw", src);
      }
      // 確保不是在編輯模式
      if (!$name?.parentElement?.classList.contains('editable')) {
        if ($name) $name.textContent = item.name;
        if ($iconName) $iconName.textContent = item.name;
      }
    }

    if (item.comments && item.comments.length > 0) {
      $element.classList.add("has-annotation");
      if ($annotationCount) $annotationCount.textContent = String(item.comments.length);
    }
    else {
      $element.classList.remove("has-annotation");
    }

    $element.classList.remove("bg-light", "bg-dark", "bg-gray", "bg-grid");
    if (item.background) {
      $element.classList.add(`bg-${item.background}`);
    }

    var metas = '';
    const $filter = getFilter();
    switch (useMiscRawState.getState().listMetaType) {
      case 'RESOLUTION':
        if (item.duration && w.VIDEO_TYPES[item.ext]) {
          metas = $filter('duration')(item.duration);
        }
        else if (item.duration && w.AUDIO_TYPES[item.ext]) {
          metas = $filter('duration')(item.duration);
        }
        else if (item.fontMetas && w.FONT_TYPES[item.ext]) {
          metas = item.fontMetas.weight;
        }
        else if (item.noPreview) {
          metas = `${w.fileSize(item.size, 1)}`;
        }
        else if (w.SPECIAL_TYPES[item.ext]) {
          metas = `${w.fileSize(item.size, 1)}`;
        }
        else if (item.ext === "url") {
          if (item.duration) {
            metas = $filter('duration')(item.duration);
          }
          else {
            metas = $filter('domainName')(item.url);
          }
        }
        else {
          metas = item.width + " x " + item.height;
        }
        if (item.ext === "txt") {
          var paragraphs = item.text.split("\n");
          var paragraphsHTML = "";
          paragraphsHTML += `<h4>${item.name.trim()}</h4>`;
          paragraphs.forEach(function (paragraph: any) {
            paragraphsHTML += `<p>${paragraph.trim()}</p>`;
          });
          setHtml("#box-" + item.id + " .txt-content div", paragraphsHTML);
        }
        break;
      case 'FILESIZE':
        metas = `${w.fileSize(item.size, 1)}`;
        break;
      case 'TYPE':
        metas = item.ext && item.ext.toUpperCase();
        break;
      case 'MTIME':
        var mtime = item.mtime || item.modificationTime;
        metas = $filter("date")(item.mtime || item.modificationTime, "yyyy/MM/dd HH:mm");
        break;
      case 'BTIME':
        var btime = item.btime || item.modificationTime;
        metas = $filter("date")(item.btime || item.modificationTime, "yyyy/MM/dd HH:mm");
        break;
      case 'TAGS':
        metas = tagsFormated;
        break;
      case 'RATING':
        metas = `<span class="small star">${ratingStrings[item.star]}</span>`;
        break;
    }
    if ($metas) $metas.innerHTML = metas;

    if ($propTags) $propTags.innerHTML = tagsFormated;
    if (item.width) {
      if ($propResolution) $propResolution.innerHTML = `${item.width} x ${item.height}`;
    }
    else {
      if ($propResolution) $propResolution.innerHTML = `-`;
    }
    if ($propRating) $propRating.innerHTML = `<span class="small star">${ratingStrings[item.star]}</span>`;
    if ($propSize) $propSize.innerHTML = `${w.fileSize(item.size, 1)}`;

    if (isSelected) {
      $element.classList.add("selected");
    }
    else {
      $element.classList.remove("selected");
    }

    if (isTagged) {
      $element.classList.add("tagged");
    }
    else {
      $element.classList.remove("tagged");
    }

    const imgs = Array.from($element.querySelectorAll("img"));
    imgs.forEach((im) => im.classList.remove("r2", "r3", "r4", "r5", "r6", "r7", "r8"));
    if (item.orientation && !item.noThumbnail) {
      if (item.orientation === 8) {
        imgs.forEach((im) => im.classList.add("r8"));
      }
      else if (item.orientation === 7) {
        imgs.forEach((im) => im.classList.add("r7"));
      }
      else if (item.orientation === 6) {
        imgs.forEach((im) => im.classList.add("r6"));
      }
      else if (item.orientation === 5) {
        imgs.forEach((im) => im.classList.add("r5"));
      }
      else if (item.orientation === 4) {
        imgs.forEach((im) => im.classList.add("r4"));
      }
      else if (item.orientation === 3) {
        imgs.forEach((im) => im.classList.add("r3"));
      }
      else if (item.orientation === 2) {
        imgs.forEach((im) => im.classList.add("r2"));
      }

      if (item.orientation > 4) {
        if (item.width < item.height) {
          imgs.forEach((im) => { (im as HTMLElement).style.minWidth = `${item.height / item.width * 100}%`; });
        }
        else {
          imgs.forEach((im) => { (im as HTMLElement).style.width = `${item.height / item.width * 100}%`; });
        }
      }
    }

    if (item.fontMetas && item.fontMetas.postScriptName) {
      var key = Object.keys(item.fontMetas.postScriptName)[0];
      var postScriptName = item.fontMetas.postScriptName && item.fontMetas.postScriptName[key];
      var fontPath = `${w.fontFolder}/${w.sanitize(postScriptName)}.${item.ext}`;
      var activatedLabel = w.i18n.__("Context.Image.Font.Activate");
      var deactivatedLabel = w.i18n.__("Context.Image.Font.Deactivate");
      // 添加正在启用、正在停用状态
      if (item.activating || item.deactivating) {
        $element.classList.add("activating");
      }
      else if (fs && fs.existsSync(fontPath)) {
        w.installedFonts[`${postScriptName}_.${item.ext}`] = true;
        $element.classList.remove("activating");
        $element.classList.add("activated");
        findEl(".activate-btn")?.setAttribute("title", deactivatedLabel);
      }
      else {
        w.installedFonts[`${postScriptName}_.${item.ext}`] = false;
        $element.classList.remove("activating");
        $element.classList.remove("activated");
        findEl(".activate-btn")?.setAttribute("title", activatedLabel);
      }
    }
  }
  catch (err) {
    console.error(err);
  }
}

/* updateItemsView（bundle 35065-35072 逐字；updateItemView 仍由 bundle 承载经 scope 解析） */
export function machineryUpdateItemsView(items: any[]): void {
  const w = window as any;
  removeClass(".box.selected", "selected");
  for (var i = items.length - 1; i >= 0; i--) {
    var item = items[i];
    machineryUpdateItemView(item);
  }
}

// ── b1-5 域内自管（原 controller 闭包 var：preloadImageTimeout 36447 邻域）──
let preloadImageTimeout: any = null;

// ── c9c 域内自管（原 controller 闭包 var：prependImagesTimeout，30519 邻域）──
export let prependImagesTimeout: any = null;

export let rebindRefreshLazyTimeout: any = null;


// ═══ b1-9bz-D-1 B-5：零依赖声明归位（dataMachinery 剪出，逐字）═══
export function machineryReload(): any {
  const w = window as any;
  return debounce(function reload(keepDetailMode: any) {
    writeScopeField('hexColor', undefined);
    writeScopeField('unlockPassword', "");

    if (!keepDetailMode) {
      if (useBodyState.getState().isDetailMode) {
        machineryLeaveDetailMode();
      }

      if (useSelectionState.getState().selected.length > 0) {
        writeScopeField('selected', []);
        syncInspectorFromScope();
      }
    }

    writeScopeField('loadMoreDisable', false);
    writeScopeField('lastImageHeight', useLayoutState.getState().imageSize.height);
    writeScopeField('boxContianerWidth', widthOf(q("#box-container")) || useMiscRawState.getState().boxContianerWidth);
    machineryRebindRefresh();
    machineryRelayout();
    machineryUpdateSelection();
    machineryCalculateFilterCounts();
    machineryUpdateSubFolderWidth();
    trigger("#box-container-scrollbar", "UPDATE_BOX_SCROLLBAR");

    machineryAutoResizeTagFilter();
    if (useBodyState.getState().layout === "GridLayout" || useBodyState.getState().layout === "SquareLayout") {
      machineryAdjustLayoutWidth(0);
    }
    writeScopeField('listDone', true);

    if (scrollTopValue("#box-container") !== 0) {
      setScrollTop("#box-container", 0);
    }
    removeClass(".box.processed", "processed");
    setTimeout(function () {
      show("#image-drop-area");
      trigger("#box-container", "scroll");
    }, 100);
    setTimeout(function () {
      trigger("#box-container", "scroll");
    }, 500);
  }, 100, true);
}

/* sortRawData（bundle 21621-21708 逐字） */
export function machinerySortRawData(orderBy: any): void {
  console.time("sortRawData");
  const languageBCP = getLanguageBCP();
  switch (orderBy) {
    case 'NAME':
      // 使用 collator 会比直接呼叫 localeCompare 快上 20x 以上
      var collator = new Intl.Collator(languageBCP, { numeric: true, sensitivity: 'base' } );
      writeScopeField('raw', useItemState.getState().raw.sort(function (a: any, b: any) {
        return collator.compare(a.name, b.name);
      }));
      syncListFromScope();
      break;
    case 'EXT':
      var collator2 = new Intl.Collator(languageBCP, { numeric: true, sensitivity: 'base' } );
      writeScopeField('raw', useItemState.getState().raw.sort(function (a: any, b: any) {
        return collator2.compare(a.ext, b.ext);
      }));
      syncListFromScope();
      break;
    case 'RESOLUTION':
      writeScopeField('raw', useItemState.getState().raw.sort(function(a: any, b: any) {
        var ra = a.width * a.height;
        var rb = b.width * b.height;
        if(ra > rb) return 1;
        if(ra < rb) return -1;
        return 0;
      }));
      syncListFromScope();
      break;
    case 'FILESIZE':
      writeScopeField('raw', useItemState.getState().raw.sort(function(a: any, b: any) {
        var sizeA = parseInt(a.size);
        var sizeB = parseInt(b.size);
        if(sizeA > sizeB) return 1;
        if(sizeA < sizeB) return -1;
        return 0;
      }));
      syncListFromScope();
      break;
    case 'RATING':
      writeScopeField('raw', useItemState.getState().raw.sort(function(a: any, b: any) {
        var starA = parseInt(a.star) || 0;
        var starB = parseInt(b.star) || 0;
        if(starA > starB) return 1;
        if(starA < starB) return -1;
        return 0;
      }));
      syncListFromScope();
      break;
    case 'DURATION':
      writeScopeField('raw', useItemState.getState().raw.sort(function(a: any, b: any) {
        var durationA = parseInt(a.duration) || 0;
        var durationB = parseInt(b.duration) || 0;
        if(durationA > durationB) return 1;
        if(durationA < durationB) return -1;
        return 0;
      }));
      syncListFromScope();
      break;
    case 'BTIME':
      writeScopeField('raw', useItemState.getState().raw.sort(function(a: any, b: any) {
        var btimeA = a.btime || a.modificationTime;
        var btimeB = b.btime || b.modificationTime;
        if(btimeA > btimeB) return -1;
        if(btimeA < btimeB) return 1;
      }));
      syncListFromScope();
      break;
    case 'MTIME':
      writeScopeField('raw', useItemState.getState().raw.sort(function(a: any, b: any) {
        var mtimeA = a.mtime || a.modificationTime;
        var mtimeB = b.mtime || b.modificationTime;
        if(mtimeA > mtimeB) return -1;
        if(mtimeA < mtimeB) return 1;
      }));
      syncListFromScope();
      break;
    case 'TAGS':
      // 使用 collator 会比直接呼叫 localeCompare 快上 20x 以上
      var collator3 = new Intl.Collator(languageBCP, { numeric: true, sensitivity: 'base' } );
      writeScopeField('raw', useItemState.getState().raw.sort(function (a: any, b: any) {
        const aTag1 = a?.tags?.[0] ?? '';
        const bTag1 = b?.tags?.[0] ?? '';
        return collator3.compare(aTag1, bTag1);
      }));
      syncListFromScope();
      break;
    default:
      writeScopeField('raw', useItemState.getState().raw.sort(function(a: any, b: any) {
        var mtimeA = a.modificationTime || a.mtime;
        var mtimeB = b.modificationTime || b.mtime;
        if(mtimeA > mtimeB) return -1;
        if(mtimeA < mtimeB) return 1;
      }));
      syncListFromScope();
  }
  updateCurrentOrderAndIncrease();
  console.timeEnd("sortRawData");
}
