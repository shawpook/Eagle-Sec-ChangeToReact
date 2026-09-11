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

import { getBodyScope, persistSweep, removeChannelListenersBySource, sweepForeignWatchers } from './appCore';
import { detailZoom } from './smoothZoomEngine';
import { ipcRenderer } from '../global/eagleGlobals';
import { syncUploadFromScope } from '../store/uploadState';
import { syncListFromScope } from '../store/listState';
import { syncInspectorFromScope } from '../store/inspectorState';
import { IPCHelper } from '../core/ipcHelper';
import { debounce } from '../utils/func';
import { getOffsetScrollbarFn, getFilter, machineryCalculateImageBinding, machineryCheckOperationSafety, machineryForceFitImageSize, machineryHideUploadQueue, machineryPrependImages, machineryQuickOpenFolder, machineryRebindRefresh, machineryUpdateFilterCounts, machineryUpdateItemView, machineryUpdateSelection, machineryUpdateSidebarList } from './dataMachinery';
import { machineryRememberVideoCurrentTime } from '../services/mediaService';
import { resetFilter } from './filterDomain';
import { scrollToSelectedItem } from '../services/batchOpsService';
import { glRemoveitemsChannel, openDuplicateChannel, openDuplicateScanPanelChannel } from '../global/bus';
import { scopeEvalAsync } from '../global/scopeShim';
import { q, findEl, getAttr, setAttrEl, setTextEl, setHtmlEl, setHtml, setCssEl, removeClassEl, setWidthEl, cssGet, dataSet } from '../utils/domQuery';
import { machineryGetAncestorFolders, machinerySaveFolder } from './libraryDomain';
import { machineryRelayout } from '../services/gridService';
declare const IPCHelper: any;
declare const remote: any;

let done = false;

// ── 域内自管的 controller 闭包状态 ──
let domainMuteCalcuteImageBindingTimeout: any = null;
let domainMuteCalcuteImageBindingTimeoutDuration = 200;
let domainAddImageTimeLeftInterval: any = null;
let domainMuteRebind: any = null;

function domainTimeout(s: any, fn: any, ms?: number): any {
  return setTimeout(() => {
    try { if (typeof fn === 'function') fn(); } finally { try { scopeEvalAsync(); } catch (err) { /* noop */ } }
  }, ms || 0);
}

/* muteRebind（bundle 27014 逐字；throttle 为 bundle 顶层 var → window） */
function ensureMuteRebind(s: any): any {
  const w = window as any;
  if (!domainMuteRebind && w.throttle) {
    domainMuteRebind = w.throttle(function () {
      machineryRebindRefresh(s, true);
    }, 3000, true);
  }
  return domainMuteRebind;
}

/* muteCalcuteImageBinding（bundle 28672 逐字） */
function domainMuteCalcuteImageBinding(s: any, params: any, callback: any): void {
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
    machineryCalculateImageBinding(s, params, callback);
    domainMuteCalcuteImageBindingTimeout = undefined;
  }, params.timeout || domainMuteCalcuteImageBindingTimeoutDuration);
}

/* updateItemListView（bundle 34300 逐字；FileUrlHelper/VIDEO_TYPES/AUDIO_TYPES 全局） */
function domainUpdateItemListView(s: any, generated: any): void {
  const w = window as any;
  const FileUrlHelper = w.FileUrlHelper;
  const VIDEO_TYPES = s.VIDEO_TYPES || {};
  const AUDIO_TYPES = s.AUDIO_TYPES || {};
  if (!generated || !s.itemMappings[generated.id]) return;

  const $imgEl = q("#box-" + generated.id + " img");
  const image = s.itemMappings[generated.id];
  const originWidth = image.width;
  const originHeight = image.height;
  const originOrientation = image.orientation;

  if (!image) return;

  if (s.itemMappings[generated.id]) {
    if (!s.modifiedMappings[generated.id]) {
      s.modifiedMappings[generated.id] = 1;
    }
    else {
      s.modifiedMappings[generated.id]++;
    }

    machineryUpdateFilterCounts(s, image, -1, Date.now());
    machineryUpdateFilterCounts(s, generated, 1, Date.now());

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
        machineryRebindRefresh(s);
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
      machineryUpdateItemView(s, image);
      machineryRelayout(s);
      getOffsetScrollbarFn(s)(30);
      refreshThumb = true;
    }

    if (generated.duration !== image.duration) {
      image.duration = generated.duration;
      machineryUpdateItemView(s, image);
    }

    if (generated.bpm !== image.bpm) {
      image.bpm = generated.bpm;
      machineryUpdateItemView(s, image);
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
  s.finishGenerateQueue.push(generated);
  machineryRememberVideoCurrentTime(s, s.current);

  if (s.isDetailMode) {
    if (generated && s.selected && s.selected[0] && generated.id === s.selected[0].id) {
      if (VIDEO_TYPES[s.current.ext] || AUDIO_TYPES[s.current.ext]) {
        /* 原码空分支（视频当前时间的特殊处理占位），逐字保留 */
      }
      else {
        detailZoom()?.updateNavigator( s.current);
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

  const sNow = (): any => getBodyScope();

  // ── image.added（23579 逐字）──
  ipc.on('image.added', function (_event: any, newImage: any) {
    const s = sNow();
    if (!s) return;
    if (!s.raw) return;
    if (newImage && newImage.id && newImage.ext) {
      // 避免重复添加
      if (newImage.id && s.itemMappings[newImage.id]) { return; }

      if (s.raw) { s.raw.unshift(newImage); }
      syncListFromScope();
      // b1-9o：raw 变更后失效内容过滤缓存（bundle 导入路径走无缓存 rebindRefresh 隐式重建，
      // shim 世界导入路径不经过 rebindRefresh——缓存不失效则 filterContent 永远吃到旧快照，
      // 11a49 的 a4 空态无法闭合即此）
      s.contentFilterCache = null;
      // 判斷是否需要更新畫面，如果 groupkey 屬於前 3 頁面，就更新
      const key = w.ig.getGroupKeys(false)[0] - 1000000;
      const needUpdateView = key <= 1;
      s.startCursor = 0;
      machineryPrependImages(s, [newImage], needUpdateView);
      machineryCalculateImageBinding(s, { ignoreSort: false }, function () {
        ensureMuteRebind(s) && ensureMuteRebind(s)();
        machineryUpdateSelection(s);
      });
    }
    scopeEvalAsync();
  });

  // ── image.removed（23602 逐字）──
  ipc.on('image.removed', function (_event: any, id: any) {
    const s = sNow();
    if (!s) return;
    if (!s.raw) return;
    // b1-9o：raw 变更后失效内容过滤缓存（同 image.added 处注）
    s.contentFilterCache = null;
    for (let i = 0; i < s.raw.length; i++) {
      const img = s.raw[i];
      if (img.id === id) {
        s.raw.splice(i, 1);
        syncListFromScope();
        break;
      }
    }

    const removedBoxEl = q("#box-" + id);
    if (w.ig && w.ig.remove && removedBoxEl) w.ig.remove(removedBoxEl);

    domainMuteCalcuteImageBinding(s, { ignoreSort: true }, function () {
      machineryRebindRefresh(s, true);
      machineryUpdateSelection(s);
      scopeEvalAsync();
    });
  });

  // ── image.palette.updated（23627 逐字）──
  ipc.on('image.palette.updated', function (_event: any, newImage: any) {
    const s = sNow();
    if (!s) return;
    if (!s.raw) return;
    if (!newImage && newImage.palettes) return;

    machineryUpdateItemView(s, newImage);

    const img = s.itemMappings[newImage.id];
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
    const s = sNow();
    if (!s) return;
    if (!s.raw) return;

    const item = q("#box-" + newImage.id);
    if (item && newImage.isDeleted) {
      glRemoveitemsChannel.emit([item]);
    }
    else {
      machineryUpdateItemView(s, newImage);
    }
    scopeEvalAsync();

    const img = s.itemMappings[newImage.id];
    if (img) {
      // b1-9i：bundle 在世时此处为 w.angular.extend（浅合并自有可枚举属性）——shim 世界无
      // window.angular（且不得注入，见 b1-9e 雷区记录），Object.assign 语义等价
      Object.assign(img, newImage);
      delete img.processingPalette;
      ensureMuteRebind(s) && ensureMuteRebind(s)();
      return;
    }
  });

  // ── image.changed（23673 逐字；getHashID/hiddenByCurrentFilter 全局）──
  ipc.on('image.changed', function (_event: any, newImage: any) {
    const s = sNow();
    if (!s) return;
    if (!s.raw) return;

    console.log("image.changed");

    const hashID = w.getHashID(newImage);

    const item = q("#box-" + newImage.id);
    if (item && newImage.isDeleted) {
      glRemoveitemsChannel.emit([item]);
    }
    else {
      machineryUpdateItemView(s, newImage);
    }
    w.hiddenByCurrentFilter([item]);

    const img = s.itemMappings[newImage.id];
    if (img && newImage && img.id === newImage.id) {
      // b1-9i：bundle 在世时此处为 w.angular.extend（浅合并自有可枚举属性）——shim 世界无
      // window.angular（且不得注入，见 b1-9e 雷区记录），Object.assign 语义等价
      Object.assign(img, newImage);
      img.star = newImage.star;
      delete img.processingPalette;
    }

    machineryUpdateSelection(s);

    domainMuteCalcuteImageBinding(s, { ignoreSort: true }, function () {
      machineryRebindRefresh(s, true);
      machineryUpdateSelection(s);
      scopeEvalAsync();
    });
    void hashID;
  });

  // ── update-item-view-by-id（23992 逐字；installedFonts 全局）──
  ipc.on('update-item-view-by-id', function (_e: any, id: any) {
    const s = sNow();
    if (!s) return;
    if (s.itemMappings[id]) {
      const item = s.itemMappings[id];
      delete item.activating;
      delete item.deactivating;
      machineryUpdateItemView(s, item);
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
    const s = sNow();
    if (!s) return;

    if (image && image.id && image.ext) {
      s.lastestAddItem = image;
      s.itemMappings[image.id] = image;
      // b1-9o：raw 变更后失效内容过滤缓存（同 image.added 处注）
      s.contentFilterCache = null;
      // 判斷是否重複，如果重復，就先紀錄在 $scope.duplicateQueue 裡面
      const existsImage = machineryIsDuplicateImage(s, image);
      const needCheckRepeat = s.$root.preferences.notification.notification.enable !== 'false' && s.$root.preferences.notification.notification.when.repeatImage === 'true';

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
            s.duplicateQueue.push(image);
          }
          else {
            if (s.raw) { s.raw.unshift(image); }
            syncListFromScope();
            machineryAddToDuplicateMapping(s, image);
          }
        }
        catch (err) {
          if (s.raw) { s.raw.unshift(image); }
          syncListFromScope();
          s.itemMappings[image.id] = image;
          machineryAddToDuplicateMapping(s, image);
          electronLog && electronLog.error((err as any).stack || err);
        }
      }
      // 否則添加至列表中
      else {
        if (s.raw) { s.raw.unshift(image); }
        syncListFromScope();
        machineryAddToDuplicateMapping(s, image);
      }

      const VIDEO_TYPES = s.VIDEO_TYPES || {};
      const AUDIO_TYPES = s.AUDIO_TYPES || {};
      const FONT_TYPES = s.FONT_TYPES || {};
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

    s.finishQueue.push(image);
    syncUploadFromScope();

    // Note: 故意不使用 async 來更新畫面，加速畫面性能
    const progress = s.finishQueue.length / s.uploadQueue.length;
    setHtmlEl(findEl(q("#upload-queue-progress"), ".message .percentage"), s.finishQueue.length + "/" + s.uploadQueue.length);
    setWidthEl(findEl(q("#upload-queue-progress"), ".current"), progress * 100 + "%");

    if (progress < 0.97) {
      w.updateWindowProgressBar(progress);
    }
    else {
      w.updateWindowProgressBar(-1);
    }

    // 仅更新包含此图片的列表
    if (s.finishQueue.length === s.uploadQueue.length) {
      machineryCalculateImageBinding(s, {}, function () {
        scopeEvalAsync();
      });
    }
    else {
      domainMuteCalcuteImageBinding(s, { ignoreSort: true }, function () {
        scopeEvalAsync();
      });
    }
  });

  // ── thumbnail-generated #1（31147 逐字：详情图刷新）──
  ipc.on('thumbnail-generated', function (_e: any, generated: any) {
    const s = sNow();
    if (!s) return;
    if (!generated || !generated.id || !s.selected || !s.selected[0]) return;
    if (s.selected && s.selected[0] && generated.id === s.selected[0].id) {
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

          machineryForceFitImageSize(s, generated);
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
    const s = sNow();
    if (!s) return;
    console.log("thumbnail-generated");
    if (generated && generated.id) {
      const existItem = s.itemMappings[generated.id];
      if (existItem) {
        // 更新封面
        domainUpdateItemListView(s, generated);
      }
      else {
        ipc.send("file-uploaded-end", generated);
      }
      scopeEvalAsync();
    }
  });

  // ── update-txt-item（31141 逐字）──
  ipc.on('update-txt-item', function (_e: any, params: any) {
    const s = sNow();
    if (!s) return;
    const item = s.itemMappings[params.id];
    if (item) {
      item.text = params.text;
      machineryUpdateTxtItem(s, item);
      scopeEvalAsync();
    }
  });

  // ── webp.converted（34267 逐字）──
  ipc.on('webp.converted', function (_e: any, converted: any) {
    const s = sNow();
    if (!s) return;
    // 更新封面
    if (converted && s.itemMappings[converted.id]) {
      domainUpdateItemListView(s, converted);
    }
    scopeEvalAsync();
  });

  // ── calculateImageBinding（30549 逐字）──
  ipc.on('calculateImageBinding', function () {
    const s = sNow();
    if (!s) return;
    machineryCalculateImageBinding(s, {}, function () {
      ensureMuteRebind(s) && ensureMuteRebind(s)();
      machineryUpdateSelection(s);
    });
    scopeEvalAsync();
  });

  // ── new-folders（30560 逐字）──
  ipc.on('new-folders', function (_e: any, folders: any) {
    const s = sNow();
    if (!s) return;
    folders.forEach(function (f: any) {
      s.folders.push(f);
    });

    machineryUpdateSidebarList(s);

    machineryCalculateImageBinding(s, { ignoreSort: true }, function () {
      machineryRebindRefresh(s);
      scopeEvalAsync();
      machinerySaveFolder(s);
    });

    machinerySaveFolder(s);
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
    const s: any = sNow();
    if (!s) return false;
    let prevFinishQueue: any[] = (s.finishQueue || []).slice();
    if (finishQueuePoll) clearInterval(finishQueuePoll);
    finishQueuePoll = setInterval(() => {
      const cur: any[] = (s.finishQueue || []).slice();
      if (cur.length === prevFinishQueue.length) return;
      const oldValue = prevFinishQueue;
      prevFinishQueue = cur;
      try { handleFinishQueueChanged(s, cur, oldValue); } catch (err) { /* noop */ }
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
  const s: any = getBodyScope();
  if (s && s.$root && s.$root.$filter) return s.$root.$filter(name);
  // shim 世界无 $rootScope.$filter：退到 machinery 的 getFilter()（Angular 在世走 injector，
  // 缺席时为 EagleApp.filter 逐字移植的等价表），否则 `$filter('i18n')(…)` 首行即抛。
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

const getScope = getBodyScope;  // b1-9bz-A：原 makeControllerFns(getScope) 注入的等价别名

export function openFileWithDefault(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function (file: any) {
            if (!file || !file.id) return;
            if (q(".swal2-container")) { return; }
            var folderPath = __lv_path.normalize(s.libraryPath + "/images/" + file.id + ".info/");
            var rawPath = __lv_path.normalize(folderPath + file.name + "." + file.ext);
            IPCHelper.send('open-with-default', rawPath);
            RecentFileManager.addFile(file);
    }).apply(null, args);
  }

export function copyAsLink(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
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
            s.notify({
                message: i18n.__("notify.colorCopySuccess"),
                duration: 750
            });
        }).apply(null, args);
  }

export function copyAsPath(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function (event) {
            if (!s.selected || !s.selected[0]) return;
            let copyText = "";
            s.selected.forEach(function (item, index) {
                var folderPath = __lv_path.normalize(s.libraryPath + "/images/" + item.id + ".info/");
                var rawPath = __lv_path.normalize(folderPath + item.name + "." + item.ext);
                if (index == 0) {
                    copyText += rawPath;
                }
                else {
                    copyText += `\n${rawPath}`;
                }
            });
            clipboard.writeText(copyText);
            s.notify({
                message: $filter('i18n')("notify.copyPath.successMsg"),
                duration: 750
            });
        }).apply(null, args);
  }

export function getFolderFullPath(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function (folder) {
            if (folder) {
                if (folder.parent) {
                    try {
                        var ancestors = machineryGetAncestorFolders(s, folder, []);
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
    const s = getScope();
    if (!s) return;
    return (function() {
            if (s.current) {
                var gifPath = FileUrlHelper.getRawPath(s.current);
                var gifUrl = FileUrlHelper.getRawUrl(s.current);
                var renderBehavior = s.$root.preferences.habits.renderBehavior;
                return "gif-viewer/index.html?path=" + encodeURIComponent(gifPath) + "&url=" + encodeURIComponent(gifUrl) + "&name=" + encodeURIComponent(s.current.name + ".gif") + `&render=${renderBehavior}`;
            }
        }).apply(null, args);
  }

export function getModelPath(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function() {
            if (s.current) {
                var rawUrl = FileUrlHelper.getRawUrl(s.current);
				rawUrl = rawUrl.replaceAll(',', '%2C');
                var type = s.current.ext;
				return `model-viewer/website/index.html#model=${rawUrl}`;
            }
        }).apply(null, args);
  }

export function getNativeViewerPath(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function() {
            if (s.current) {
                var __lv_filePath = s.imagesDir + s.current.id + ".info/";
                return "native-viewer/index.html?path=" + encodeURIComponent(__lv_filePath) + "&name=" + encodeURIComponent(s.current.name + "." + s.current.ext) + "&ext=" + s.current.ext + "&width=" + s.current.width + "&height=" + s.current.height + "&id=" + s.current.id;
            }
        }).apply(null, args);
  }

export function getPDFPath(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function() {
            if (s.current) {
            	var pdfPath = FileUrlHelper.getRawUrl(s.current);
                var locale = preferences.general.language.replace("_", "-");
                return `pdf-viewer/web/viewer.html?path=${encodeURIComponent(pdfPath)}&locale=${locale}&theme=${s.theme}`;
            }
        }).apply(null, args);
  }

export function getRawPath(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function (__lv_image) {
            if (!__lv_image || !s.imagesDir) return;
            if (!s.modifiedMappings[__lv_image.id]) {
                return "file://" +  getRawPath(s.imagesDir, __lv_image);
            }
            else {
                return "file://" +  getRawPath(s.imagesDir, __lv_image) + "?v=" + s.modifiedMappings[__lv_image.id];
            }
        }).apply(null, args);
  }

export function getRawUrl(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function (__lv_image) {
            if (!s.imagesDir || !__lv_image) return;
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
    const s = getScope();
    if (!s) return;
    return (function() {
            if (s.current) {
                var __lv_image = s.current;
                var rawPath = s.imagesDir + s.current.id + ".info/";
                return `./raw-viewer/index.html?orientation=${__lv_image.orientation}&path=${encodeURIComponent(rawPath)}&name=${encodeURIComponent(__lv_image.name)}&ext=${__lv_image.ext}&width=${__lv_image.width}&height=${__lv_image.height}`;
            }
        }).apply(null, args);
  }

export function getTxtPath(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function() {
            if (s.current) {
                return `./text-editor/text-editor.html?id=${s.current.id}&theme=${s.theme}&name=${s.current.name}&language=${s.language}`;
            }
        }).apply(null, args);
  }

export function getURLSrc(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function () {
            let item = s.current;
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
                return FileUrlHelper.getRawUrl(s.current);
            }
        }).apply(null, args);
  }

export function openItemLocation(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function (item, folder) {
            resetFilter();
            s.keyword = "";
            machineryQuickOpenFolder(s, folder, item);
        }).apply(null, args);
  }

export function openWithOther(...args: any[]) {
    if (!__cc_openWithOther) {
      __cc_openWithOther = debounce(function () {
        const s = getScope();
        if (!s) return;
        if (s.selected.length > 0) {
            __cf_ipcRenderer.send('open-with-dialog', FileUrlHelper.getRawPath(s.selected[0]));
        }
      }, 200, true);
    }
    return __cc_openWithOther(...args);
  }

export function openInFinder(...args: any[]) {
    if (!__cc_openInFinder) {
      __cc_openInFinder = (function () {
        function openInFinderImpl() {
            const s = getScope();
            if (!s) return;
            if (s.selected.length > 0) {
                machineryCheckOperationSafety(s, function () {
                    s.selected.forEach(function (file, index) {
                        if (index > 30) return;
                        var folderPath = path.normalize(s.libraryPath + "/images/" + file.id + ".info/");
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
            const s = getScope();
            if (!s) return;

            // 禁止在任何 Modal 开启时，使用这个功能，避免快捷键冲突
            if (q(".modal.open, .import-modal.open")) return;
            if (!s.selected.length) return;

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
        const s = getScope();
        if (!s) return;
        if (q(".swal2-container")) { return; }
        machineryCheckOperationSafety(s, function () {
            files.forEach(function (file, index) {
                if (!file || !file.id) return;
                if (index < 40) {
                    var folderPath = __lv_path.normalize(s.libraryPath + "/images/" + file.id + ".info/");
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
    const s = getScope();
    if (!s) return;
    return (function () {
        if (s.selected.length <= 20000) {
            var items = s.selected.filter(function (item) {
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
    const s = getScope();
    if (!s) return;
    return (function (properity) {
        if (!s.selected || !s.selected[0]) return;
        let copyText = "";
        s.selected.forEach(function (item, index) {
            if (index == 0) {
                copyText += `${item[properity] || ""}`;
            }
            else {
                copyText += `\n${item[properity] || ""}`;
            }
        });
        clipboard.writeText(copyText);
        s.notify({
            message: $filter('i18n')("notify.copyPath.successMsg"),
            duration: 750
        });
    }).apply(null, args);
  }

export function copyAsFolderPath(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function (event) {
        if (!s.selected || !s.selected[0]) return;
        let copyText = "";
        s.selected.forEach(function (item, index) {
            var folderPath = path.normalize(s.libraryPath + "/images/" + item.id + ".info/");
            if (index == 0) {
                copyText += folderPath;
            }
            else {
                copyText += `\n${folderPath}`;
            }
        });
        clipboard.writeText(copyText);
        s.notify({
            message: $filter('i18n')("notify.copyPath.successMsg"),
            duration: 750
        });
    }).apply(null, args);
  }

export function copyAsThumbnail(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function () {
        // b1-9ae：同上——undefined → send 走 main（b1-9aa copy-thumbnails handler → CF_HDROP）
        if ((window as any).backgroundWindowID === undefined) {
            __cf_ipcRenderer.send('copy-thumbnails', s.selected);
        }
        else {
            __cf_ipcRenderer.sendTo((window as any).backgroundWindowID, 'copy-thumbnails', s.selected);
        }
        setTimeout(function () {
            s.notify({
                message: $filter('i18n')("previewWindow.copied"),
                duration: 1000
            });
        }, 150);
    }).apply(null, args);
  }

export function copyAsBase64(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function () {
        let item = s.selected[0];
        let folderPath = path.normalize(s.libraryPath + "/images/" + item.id + ".info/");
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
            s.notify({
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
                if (getBodyScope().showSubfolderContent) {
                    // 状况2: 该资料夹不包含图片，但该资料夹的子文件夹包含
                    // 加速版本作法，更快判断图片是否存在于子文件夹
                    if (getBodyScope().currentFolderChildren) {
                        for (var i = 0; i < __lv_image.folders.length; i++) {
                            var __lv_folderId = __lv_image.folders[i];
                            if (getBodyScope().currentFolderChildren[__lv_folderId]) {
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
function handleFinishQueueChanged(s: any, newValue: any, oldValue: any): void {
  const w: any = window as any;

    if (!s.raw || s.raw.length === 0) {
      if (s.finishQueue.length > 0 && s.finishQueue.length === s.uploadQueue.length) {
        s.finishQueue = [];
        syncUploadFromScope();
        s.uploadQueue = [];
        syncUploadFromScope();
        machineryHideUploadQueue(s);
      }
      return;
    }

    if (s.finishQueue.length > 0 && s.finishQueue.length >= s.uploadQueue.length) {
      // 清除倒数计时工具
      s.addImageStartTime = undefined;
      clearInterval(domainAddImageTimeLeftInterval);

      var total = s.uploadQueue.length;
      // 以队列最后一张图判断，是否要刷新使用者当前查看的列表
      var lastImage = s.finishQueue[s.finishQueue.length - 1];

      // 自动选择新增的图片
      var newItems: any[] = [];
      s.finishQueue.forEach(function (image: any) {
        if (image && image.id) {
          newItems.push(image);
        }
      });

      s.finishQueue = [];
      syncUploadFromScope();
      s.uploadQueue = [];
      syncUploadFromScope();
      setHtmlEl(findEl(q("#upload-queue-progress"), ".message .percentage"), s.finishQueue.length + "/" + s.uploadQueue.length);
      setWidthEl(findEl(q("#upload-queue-progress"), ".current"), s.finishQueue.length / s.uploadQueue.length * 100 + "%");
      machineryHideUploadQueue(s);

      // 判斷是否有重複的圖片
      if (s.$root.preferences.notification.notification.enable !== 'false' && s.$root.preferences.notification.notification.when.repeatImage != 'false') {
        if (s.duplicateQueue.length > 0) {
          openDuplicateChannel.emit({
            currentFolder: s.currentFolder,
            mappings: s.duplicateMappings,
            duplicates: s.duplicateQueue
          });
          if (s.$root.preferences.notification.soundEffect.enable != 'false') {
            s.duplicateSound && s.duplicateSound.play();
          }
          s.duplicateQueue = [];
        }
      }
      // 如果沒有啟動重複通知，一律圖片直接添加上來
      else {
        s.duplicateQueue.forEach(function (img: any) {
          machineryAddToDuplicateMapping(s, img);
          if (s.raw) { s.raw.unshift(img); }
          syncListFromScope();
        });
        s.duplicateQueue = [];
      }

      function autoSelectUploadedItems() {
        if (s.isDetailMode) return;

        if (s.$root.preferences.general.autoSelect !== 'true') {
          if (newItems.length === 1) {
            domainTimeout(s, function () {
              scrollToSelectedItem();
            }, 120);
          }
          return;
        }

        // 避免几百几千个？
        if (s.viewMode !== 'random') {
          var MAX_AUTO_SELECT = 1000;
          if (newItems && newItems.length <= MAX_AUTO_SELECT) {
            s.selected = newItems;
            syncInspectorFromScope();
            var targetSelectedIndex = s.allData.indexOf(s.selected[0]);
            s.lastSelectedIndex = targetSelectedIndex;
            s.$root.currentFocus = "content";
            if (newItems.length === 1) {
              domainTimeout(s, function () {
                scrollToSelectedItem();
              }, 120);
            }
          }
        }
      }

      machineryCalculateImageBinding(s, {}, function () {
        // NOTE: 图片添加完成后，如果添加的图片不是使用者正在查看的文件夹，不需要刷新画面
        if (s.currentFolder) {
          try {
            if (!lastImage || !lastImage.folders) {
              s.reload(true);
              autoSelectUploadedItems();
              return;
            }
            const needReload = isInFolder(lastImage, s.currentFolder);
            if (needReload) {
              s.startCursor = 0;
              s.reload(true);
              autoSelectUploadedItems();
            }
          }
          catch (err: any) {
            s.reload(true);
            autoSelectUploadedItems();
            electronLog && electronLog.error(err.stack || err);
          }
        }
        else if (s.currentSmartFolder) {
          s.reload(true);
        }
        // 如果来自全部图片、未归类、未分类，一律进行刷新
        else if (s.viewMode == "all" || s.viewMode == "unfiled" || s.viewMode == "untagged") {
          s.startCursor = 0;
          s.reload(true);
          autoSelectUploadedItems();
        }
      });

      try {
        if (s.finishQueue.length > 2) {
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
export function machineryAddToDuplicateMapping(s: any, image: any): void {
  const w = window as any;
  var hashID = w.getHashID(image);
  if (!s.duplicateMappings) s.duplicateMappings = {};
  s.duplicateMappings[hashID] = image;
}

export function machineryIsDuplicateImage(s: any, image: any): any {
  const w = window as any;
  if (!s.duplicateMappings) return false;
  if (image.ext === 'svg') return false;
  if (image.ext === 'tif') return false;
  if (image.ext === 'tiff') return false;

  var hashID = w.getHashID(image);
  if (!hashID) return false;
  // 垃圾桶文件不纳入考量
  if (s.duplicateMappings[hashID] && s.duplicateMappings[hashID].isDeleted) return false;
  return s.duplicateMappings[hashID];
}

export function machineryOpenDuplicate(s: any, options: any = {}): void {
  if (options?.selected) {
    openDuplicateScanPanelChannel.emit({
      items: [...s.selected],
      onMergedCallback: () => {
        s.selected = s.selected.filter((item: any) => {
          return !item.isDeleted;
        });
        syncInspectorFromScope();
        scopeEvalAsync();
      },
    });
  }
  else if (options?.currentPage) {
    openDuplicateScanPanelChannel.emit({
      items: [...s.allData],
    });
  }
  else {
    openDuplicateScanPanelChannel.emit({
      items: [...s.all],
    });
  }
}

export function machineryUpdateTxtItem(s: any, item: any): void {
  const w = window as any;
  var paragraphs = item.text.split("\n");
  var paragraphsHTML = "";
  paragraphsHTML += `<h4>${item.name.trim()}</h4>`;
  paragraphs.forEach(function (paragraph: any) {
    paragraphsHTML += `<p>${paragraph.trim()}</p>`;
  });
  setHtml("#box-" + item.id + " .txt-content div", paragraphsHTML);
  if (s.selected.length === 0 && s.selected[0] === item) {
    setHtml(".inspector .txt-content div", paragraphsHTML);
  }
}
