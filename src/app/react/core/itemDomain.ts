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

import { removeChannelListenersBySource, sweepForeignWatchers, persistSweep } from './appCore';
import { detailZoom } from './smoothZoomEngine';
import { getBodyScope } from '../global/scopeBridge';
import { ipcRenderer } from '../global/eagleGlobals';
import { isInFolder } from './controllerFns';
import { syncUploadFromScope } from '../store/uploadState';
import { syncListFromScope } from '../store/listState';
import { syncInspectorFromScope } from '../store/inspectorState';

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
    try { if (typeof fn === 'function') fn(); } finally { try { s.$apply(); } catch (err) { /* noop */ } }
  }, ms || 0);
}

/* muteRebind（bundle 27014 逐字；throttle 为 bundle 顶层 var → window） */
function ensureMuteRebind(s: any): any {
  const w = window as any;
  if (!domainMuteRebind && w.throttle) {
    domainMuteRebind = w.throttle(function () {
      s.rebindRefresh(true);
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
    s.calculateImageBinding(params, callback);
    domainMuteCalcuteImageBindingTimeout = undefined;
  }, params.timeout || domainMuteCalcuteImageBindingTimeoutDuration);
}

/* updateItemListView（bundle 34300 逐字；FileUrlHelper/VIDEO_TYPES/AUDIO_TYPES 全局） */
function domainUpdateItemListView(s: any, generated: any): void {
  const w = window as any;
  const $ = w.$;
  const FileUrlHelper = w.FileUrlHelper;
  const VIDEO_TYPES = s.VIDEO_TYPES || {};
  const AUDIO_TYPES = s.AUDIO_TYPES || {};
  if (!generated || !s.itemMappings[generated.id]) return;

  const $img = $("#box-" + generated.id + " img");
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

    s.updateFilterCounts(image, -1, Date.now());
    s.updateFilterCounts(generated, 1, Date.now());

    image.width = generated.width;
    image.height = generated.height;
    image.size = generated.size;
    image.ext = generated.ext;

    if (generated.fontMetas) {
      image.fontMetas = generated.fontMetas;
    }

    if ("png jpg".indexOf(generated.ext) === -1) {
      $("#box-" + image.id + " .type-label").text(generated.ext.toUpperCase());
    }
    else {
      $("#box-" + image.id + " .type-label").text("");
    }
    $("#box-" + image.id + " .name").attr("data-ext", `.${generated.ext}`);

    if (generated.text && generated.text !== image.text) {
      image.text = generated.text;
      const paragraphs = image.text.split("\n");
      let paragraphsHTML = "";
      paragraphsHTML += `<h4>${image.name.trim()}</h4>`;
      paragraphs.forEach(function (paragraph: any) {
        paragraphsHTML += `<p>${paragraph.trim()}</p>`;
      });
      $("#box-" + image.id + " .txt-content div").html(paragraphsHTML);
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
        s.rebindRefresh();
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
    const currentAspectRatio = $("#box-" + image.id).find(".thumbnail").css("aspect-ratio");
    if (
      (originHeight !== generated.height && originWidth !== generated.width) ||
      originOrientation !== generated.orientation ||
      aspectRatio !== currentAspectRatio
    ) {
      s.updateItemView(image);
      s.relayout();
      s.offsetScrollbar(30);
      refreshThumb = true;
    }

    if (generated.duration !== image.duration) {
      image.duration = generated.duration;
      s.updateItemView(image);
    }

    if (generated.bpm !== image.bpm) {
      image.bpm = generated.bpm;
      s.updateItemView(image);
    }

    if (refreshThumb && !image.noPreview) {
      const $element = $("#box-" + image.id);
      $element.find("img").attr("src", FileUrlHelper.getThumbnailUrl(image) + "&v=" + Date.now());
      $element.find(".thumbnail").css("aspect-ratio", `${image.width} / ${image.height}`);
    }
  }
  if ($img && $img.length > 0 && !image.noPreview) {
    $img.parent().removeClass("dummy").prop("title", "");
    const src = $img.attr("src") || $img.attr('lazysrc');
    let newSrc;
    if (src) {
      if (generated.ext === 'svg') {
        newSrc = FileUrlHelper.getThumbnailUrl(generated) + "?v=" + Date.now();
        $img.attr("src", newSrc);
        $img.attr("lazysrc", newSrc);
      }
      else if (generated.noThumbnail) {
        newSrc = FileUrlHelper.getThumbnailUrl(generated) + "?v=" + Date.now();
        $img.attr("src", newSrc);
        $img.attr("lazysrc", newSrc);
      }
      else {
        newSrc = FileUrlHelper.getThumbnailUrl(generated);
        if (newSrc.indexOf("?v") > -1) {
          $img.attr("src", newSrc + "&v=" + Date.now());
          $img.attr("lazysrc", newSrc + "&v=" + Date.now());
        }
        else {
          $img.attr("src", newSrc + "?v=" + Date.now());
          $img.attr("lazysrc", newSrc + "?v=" + Date.now());
        }
      }
    }
  }
  s.finishGenerateQueue.push(generated);
  s.rememberVideoCurrentTime(s.current);

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
  const $: any = w.$;

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
      s.prependImages([newImage], needUpdateView);
      s.calculateImageBinding({ ignoreSort: false }, function () {
        ensureMuteRebind(s) && ensureMuteRebind(s)();
        s.updateSelection();
      });
    }
    s.$evalAsync();
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

    if (w.ig && w.ig.remove) w.ig.remove($("#box-" + id)[0]);

    domainMuteCalcuteImageBinding(s, { ignoreSort: true }, function () {
      s.rebindRefresh(true);
      s.updateSelection();
      s.$evalAsync();
    });
  });

  // ── image.palette.updated（23627 逐字）──
  ipc.on('image.palette.updated', function (_event: any, newImage: any) {
    const s = sNow();
    if (!s) return;
    if (!s.raw) return;
    if (!newImage && newImage.palettes) return;

    s.updateItemView(newImage);

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

    s.$evalAsync();
  });

  // ── image.changed.mute（23651 逐字）──
  ipc.on('image.changed.mute', function (_event: any, newImage: any) {
    const s = sNow();
    if (!s) return;
    if (!s.raw) return;

    const item = $("#box-" + newImage.id)[0];
    if (item && newImage.isDeleted) {
      s.$root.$broadcast("gl:removeItems", [item]);
    }
    else {
      s.updateItemView(newImage);
    }
    s.$evalAsync();

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

    const item = $("#box-" + newImage.id)[0];
    if (item && newImage.isDeleted) {
      s.$root.$broadcast("gl:removeItems", [item]);
    }
    else {
      s.updateItemView(newImage);
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

    s.updateSelection();

    domainMuteCalcuteImageBinding(s, { ignoreSort: true }, function () {
      s.rebindRefresh(true);
      s.updateSelection();
      s.$evalAsync();
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
      s.updateItemView(item);
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
      const existsImage = s.isDuplicateImage(image);
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
            s.addToDuplicateMapping(image);
          }
        }
        catch (err) {
          if (s.raw) { s.raw.unshift(image); }
          syncListFromScope();
          s.itemMappings[image.id] = image;
          s.addToDuplicateMapping(image);
          electronLog && electronLog.error((err as any).stack || err);
        }
      }
      // 否則添加至列表中
      else {
        if (s.raw) { s.raw.unshift(image); }
        syncListFromScope();
        s.addToDuplicateMapping(image);
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
    $("#upload-queue-progress").find(".message .percentage").html(s.finishQueue.length + "/" + s.uploadQueue.length);
    $("#upload-queue-progress").find(".current").width(progress * 100 + "%");

    if (progress < 0.97) {
      w.updateWindowProgressBar(progress);
    }
    else {
      w.updateWindowProgressBar(-1);
    }

    // 仅更新包含此图片的列表
    if (s.finishQueue.length === s.uploadQueue.length) {
      s.calculateImageBinding({}, function () {
        s.$evalAsync();
      });
    }
    else {
      domainMuteCalcuteImageBinding(s, { ignoreSort: true }, function () {
        s.$evalAsync();
      });
    }
  });

  // ── thumbnail-generated #1（31147 逐字：详情图刷新）──
  ipc.on('thumbnail-generated', function (_e: any, generated: any) {
    const s = sNow();
    if (!s) return;
    if (!generated || !generated.id || !s.selected || !s.selected[0]) return;
    if (s.selected && s.selected[0] && generated.id === s.selected[0].id) {
      const $detailImage = $("img#detail-image");
      if ($detailImage.length) {
        const rawURL = s.getRawUrl(generated);
        $detailImage.css({
          "transform": `rotate(0deg)`,
          "transition": "none",
          "display": "none"
        });
        const temp = new Image();
        temp.onload = function () {
          $detailImage.attr("src", rawURL);
          detailZoom()?.updateNavigator( generated);

          $detailImage.data("degree", 0);

          s.forceFitImageSize(generated);
          $detailImage.css({
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
      s.$evalAsync();
    }
  });

  // ── update-txt-item（31141 逐字）──
  ipc.on('update-txt-item', function (_e: any, params: any) {
    const s = sNow();
    if (!s) return;
    const item = s.itemMappings[params.id];
    if (item) {
      item.text = params.text;
      s.updateTxtItem(item);
      s.$evalAsync();
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
    s.$evalAsync();
  });

  // ── calculateImageBinding（30549 逐字）──
  ipc.on('calculateImageBinding', function () {
    const s = sNow();
    if (!s) return;
    s.calculateImageBinding({}, function () {
      ensureMuteRebind(s) && ensureMuteRebind(s)();
      s.updateSelection();
    });
    s.$evalAsync();
  });

  // ── new-folders（30560 逐字）──
  ipc.on('new-folders', function (_e: any, folders: any) {
    const s = sNow();
    if (!s) return;
    folders.forEach(function (f: any) {
      s.folders.push(f);
    });

    s.updateSidebarList();

    s.calculateImageBinding({ ignoreSort: true }, function () {
      s.rebindRefresh();
      s.$evalAsync();
      s.saveFolder();
    });

    s.saveFolder();
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
  const attachFinishQueueWatch = () => {
    const s: any = sNow();
    const w: any = window as any;
    if (!s || typeof s.$watchCollection !== 'function') return false;
    if (w.angular) return true; // bundle 在世：其 finishQueue watcher 仍独占，避免双处理
    s.$watchCollection(() => s.finishQueue, function (newValue: any, oldValue: any) {
      if (newValue === oldValue) return;

      if (!s.raw || s.raw.length === 0) {
        if (s.finishQueue.length > 0 && s.finishQueue.length === s.uploadQueue.length) {
          s.finishQueue = [];
          syncUploadFromScope();
          s.uploadQueue = [];
          syncUploadFromScope();
          s.hideUploadQueue();
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
        $("#upload-queue-progress").find(".message .percentage").html(s.finishQueue.length + "/" + s.uploadQueue.length);
        $("#upload-queue-progress").find(".current").width(s.finishQueue.length / s.uploadQueue.length * 100 + "%");
        s.hideUploadQueue();

        // 判斷是否有重複的圖片
        if (s.$root.preferences.notification.notification.enable !== 'false' && s.$root.preferences.notification.notification.when.repeatImage != 'false') {
          if (s.duplicateQueue.length > 0) {
            s.$root.$broadcast("OPEN_DUPLICATE", {
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
            s.addToDuplicateMapping(img);
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
                s.scrollToSelectedItem();
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
                  s.scrollToSelectedItem();
                }, 120);
              }
            }
          }
        }

        s.calculateImageBinding({}, function () {
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
    });
    return true;
  };
  if (!attachFinishQueueWatch()) {
    const retryFinishQueueWatch = setInterval(() => {
      if (attachFinishQueueWatch()) clearInterval(retryFinishQueueWatch);
    }, 300);
  }
}
