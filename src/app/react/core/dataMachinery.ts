/**
 * c9 数据机器域——EagleController 内部机器移植（scope 函数替换绞杀）。
 *
 * - **sortRawData（bundle 21621-21708 逐字）**：raw 排序 + updateCurrentOrderAndIncrease。
 *   排序语言依赖 languageBCP → root.language 重算（bundle 20053：`languageBCP = $scope.language.replace("_", "-")`，
 *   初值 "en"（19053）。
 * - **getAncestorFolders（bundle 42508 逐字）/ getExtendTags（32028 逐字）**：controller 闭包函数 → 域内移植。
 *
 * - **c9b rebindRefresh 域**：
 *   - rebindRefresh（27366-27454 逐字；async）：calcuteFilterResult 置顶排序 allData/filtereds
 *     重建 + refreshSubfolderList + keywordDebounce 梯度 + updateItemsView + 网格重置 +
 *     HoverPreview 隐藏。calcuteFilterResult/calcuteContainTags/refreshSubfolderList/
 *     updateItemsView 仍由 bundle 承载（经 scope 解析，后续片接管）；resetNgGridLayoutData
 *     为 ngGridLayout 指令 66970 隐式全局（window.*）；calcuteFilterBadge 为域内移植版。
 *   - calcuteFilterBadge（27522-27633 逐字；controller 闭包函数）：纯 eagle.filter.filterBadge
 *     计数（标签/颜色/类型/相机/星等/字体/时间/BPM/标注/网址/以图找图/语义）。
 *   - filterSidebarItem（37967-38001 逐字；controller 闭包函数）：chineseConvert/cartesianProduct/
 *     pinyinlite（re-require 十行成员）+ _.uniq/_.max + String.prototype.score（bundle 2621）。
 *   - rebindRefreshLazy（27007-27013 逐字；1000ms 防抖）/ updateSidebarList（42545-42617 逐字；
 *     20ms 防抖）——rebindRefreshLazyTimeout/updateSidebarListTimeout 域内自管。
 *
 * - **c9c 视图/加载域**：updateItemsView（35065-35072 逐字）、switchLayout（33790-33846 逐字；
 *   relayout/offsetScrollbar/initMenu 经 scope 解析）、prependImages（30524-30538 逐字）+
 *   resetImageData（30540-30548 闭包函数；prependImagesTimeout 域内自管）、reload（42867-42918
 *   逐字；_.debounce(fn,100,true) leading-edge，实例一次性创建）+ autoResizeTagFilter（43119-43128
 *   闭包函数）。
 *
 * - **c9d 缩放/放映/计数/最近文件夹**：getRatioExp（31336）/ getRatioNonExp（31343）纯函数、
 *   updateZoomRatio（31391-31418 逐字；smoothZoom vendor 插件、updateZoomRatioTimeout 域内
 *   自管）、toggleSlideshow（23816）、smartFolderCount（46646；existInSmartFilter/lockImageFilter
 *   经 scope 解析）、getRecentFolders（31969；localStorage recentMoveFolders 逐字键）。
 *   注：unlockPassword 为 scope 字段（非函数），React 侧 5 处读写经桥接/字段解析，无需移植。
 *
 * - **c9e 单条目视图机**：updateItemView（34847-35063 逐字；updateItemsView 循环体）——
 *   metas 十分支（RESOLUTION/FILESIZE/TYPE/MTIME/BTIME/TAGS/RATING）+ 选中/标记/旋转类/
 *   字体激活状态 DOM 更新；依赖 window.* 全局（fileSize/fontFolder/sanitize/installedFonts/
 *   i18n/VIDEO_TYPES 等）+ $filter 经 injector + fs 经 window.require('fs')。checkTouchIDSupport
 *   （29002-29010 逐字）一并替换（React lockState 与 bundle 29014/29109 调用点共用）。
 *
 * - **calculateImageBinding（bundle 28684-28965 逐字）**：核心重建机——duration 1/50 退避逻辑
 *   （重入时退避 50ms）、TagManager.azGroups → $timeout.cancel、$timeout(work,duration)、
 *   work = raw 检查 + sortRawData + 全部 resets + 三次 tree.walk（folderMappings/folderList/pinyin/
 *   tagsSuggestion/ancestorsCache、extendTags/covers、smartFolderMappings）+ raw 循环（itemMappings/
 *   trash/all/exts/untaggedCount/unfiledCount/folders 修复/lockedImages/tags 计数/封面 default map）+
 *   extList→eagle.filter.filterTypes + covers 补全 walk + TagManager.rawdata/pinyinCache/calculateTags +
 *   s.tags + timeEnd + callback + catch）。pinyinCache/calculateImageBindingTimeout 原为 controller
 *   闭包变量 → 域内自管。**scope 函数替换后**，bundle 侧 muteCalcuteImageBinding 等全部
 *   `$scope.calculateImageBinding(...)` 调用面即走本实现（绞杀内部机器）。
 *
 * - **有意略去（无副作用，注释标注）**：`var path = require('path');`（原文内从未使用）。
 *
 * 外部依赖经 window.* live binding（eagle/tinyPinyin/_/FileUrlHelper/AUDIO_TYPES/electronLog），
 * TagManager 经 scope 字段（bundle 48351 `$scope.TagManager = TagManager`）；updateCurrentOrderAndIncrease
 * 复用 controllerFns 移植版（getBodyScope 后端）；$filter/$timeout 经 injector 注入（Angular digest 语义不变）。
 */

import { getBodyScope } from '../global/scopeBridge';
import { updateCurrentOrderAndIncrease } from './controllerFns';

// ── 域内自管的 controller 闭包变量（原 bundle 28682/28683 内 var）──
let pinyinCache: Record<string, string> = {};
let calculateImageBindingTimeout: any = null;
// ── c9b 域内自管（原 controller 闭包 var：26927 邻域 updateSidebarListTimeout / 27006
//    rebindRefreshLazyTimeout）──
let updateSidebarListTimeout: any = null;
let rebindRefreshLazyTimeout: any = null;
// ── c9c 域内自管（原 controller 闭包 var：prependImagesTimeout，30519 邻域）──
let prependImagesTimeout: any = null;
// ── c9d 域内自管（原 controller 闭包 var：updateZoomRatioTimeout，31389 邻域）──
let updateZoomRatioTimeout: any = null;

let filterCache: any = null;
function getFilter(): any {
  if (filterCache) return filterCache;
  try {
    const ang = (window as any).angular;
    if (ang && ang.element && ang.element(document).injector) {
      filterCache = ang.element(document).injector().get('$filter');
    }
  } catch (err) { /* noop */ }
  return filterCache;
}

let timeoutCache: any = null;
function getTimeout(): any {
  if (timeoutCache) return timeoutCache;
  try {
    const ang = (window as any).angular;
    if (ang && ang.element && ang.element(document).injector) {
      timeoutCache = ang.element(document).injector().get('$timeout');
    }
  } catch (err) { /* noop */ }
  return timeoutCache;
}

/* languageBCP 重算（bundle 20053 逐字；初值 "en"） */
function getLanguageBCP(s: any): string {
  try {
    const lang = s.language ?? s.$root?.language ?? 'en';
    return String(lang).replace('_', '-');
  } catch (err) {
    return 'en';
  }
}

/* 取得文件夹祖先们（bundle 42508 逐字） */
export function machineryGetAncestorFolders(s: any, folder: any, folders: any[]): any[] {
  try {
    if (folder.parent && s.folderMappings[folder.parent]) {
      const parent = s.folderMappings[folder.parent];
      if (parent.id != folder.id) {
        folders.push(parent);
        return machineryGetAncestorFolders(s, parent, folders);
      }
    }
    folders = [...new Set(folders)];
    return folders;
  } catch (err: any) {
    const w = window as any;
    w.electronLog && w.electronLog.error(err.stack || err);
    folders = [...new Set(folders)];
    return folders;
  }
}

/* 取得继承炼的标签（bundle 32028 逐字；tags.unique() 为 bundle Array 原型扩展，保留原调用） */
export function machineryGetExtendTags(s: any, folder: any, tags: any[]): any[] {
  const uniqueTags: any = tags as any;
  try {
    if (folder.tags) {
      folder.tags.forEach(function (tag: any) {
        tags.push(tag);
      });
    }
    const parent = s.folderMappings[folder.parent];
    if (parent && parent.tags && folder.parent) {
      return machineryGetExtendTags(s, parent, tags);
    }
    else {
      return uniqueTags.unique().reverse();
    }
  } catch (err) {
    return uniqueTags.unique().reverse();
  }
}

/* sortRawData（bundle 21621-21708 逐字） */
export function machinerySortRawData(s: any, orderBy: any): void {
  console.time("sortRawData");
  const languageBCP = getLanguageBCP(s);
  switch (orderBy) {
    case 'NAME':
      // 使用 collator 会比直接呼叫 localeCompare 快上 20x 以上
      var collator = new Intl.Collator(languageBCP, { numeric: true, sensitivity: 'base' } );
      s.raw = s.raw.sort(function (a: any, b: any) {
        return collator.compare(a.name, b.name);
      });
      break;
    case 'EXT':
      var collator2 = new Intl.Collator(languageBCP, { numeric: true, sensitivity: 'base' } );
      s.raw = s.raw.sort(function (a: any, b: any) {
        return collator2.compare(a.ext, b.ext);
      });
      break;
    case 'RESOLUTION':
      s.raw = s.raw.sort(function(a: any, b: any) {
        var ra = a.width * a.height;
        var rb = b.width * b.height;
        if(ra > rb) return 1;
        if(ra < rb) return -1;
        return 0;
      });
      break;
    case 'FILESIZE':
      s.raw = s.raw.sort(function(a: any, b: any) {
        var sizeA = parseInt(a.size);
        var sizeB = parseInt(b.size);
        if(sizeA > sizeB) return 1;
        if(sizeA < sizeB) return -1;
        return 0;
      });
      break;
    case 'RATING':
      s.raw = s.raw.sort(function(a: any, b: any) {
        var starA = parseInt(a.star) || 0;
        var starB = parseInt(b.star) || 0;
        if(starA > starB) return 1;
        if(starA < starB) return -1;
        return 0;
      });
      break;
    case 'DURATION':
      s.raw = s.raw.sort(function(a: any, b: any) {
        var durationA = parseInt(a.duration) || 0;
        var durationB = parseInt(b.duration) || 0;
        if(durationA > durationB) return 1;
        if(durationA < durationB) return -1;
        return 0;
      });
      break;
    case 'BTIME':
      s.raw = s.raw.sort(function(a: any, b: any) {
        var btimeA = a.btime || a.modificationTime;
        var btimeB = b.btime || b.modificationTime;
        if(btimeA > btimeB) return -1;
        if(btimeA < btimeB) return 1;
      });
      break;
    case 'MTIME':
      s.raw = s.raw.sort(function(a: any, b: any) {
        var mtimeA = a.mtime || a.modificationTime;
        var mtimeB = b.mtime || b.modificationTime;
        if(mtimeA > mtimeB) return -1;
        if(mtimeA < mtimeB) return 1;
      });
      break;
    case 'TAGS':
      // 使用 collator 会比直接呼叫 localeCompare 快上 20x 以上
      var collator3 = new Intl.Collator(languageBCP, { numeric: true, sensitivity: 'base' } );
      s.raw = s.raw.sort(function (a: any, b: any) {
        const aTag1 = a?.tags?.[0] ?? '';
        const bTag1 = b?.tags?.[0] ?? '';
        return collator3.compare(aTag1, bTag1);
      });
      break;
    default:
      s.raw = s.raw.sort(function(a: any, b: any) {
        var mtimeA = a.modificationTime || a.mtime;
        var mtimeB = b.modificationTime || b.mtime;
        if(mtimeA > mtimeB) return -1;
        if(mtimeA < mtimeB) return 1;
      });
  }
  updateCurrentOrderAndIncrease();
  console.timeEnd("sortRawData");
}

/* calculateImageBinding（bundle 28684-28965 逐字） */
export function machineryCalculateImageBinding(s: any, params: any, callback: any): void {
  const w = window as any;
  var duration = 50;
  if (calculateImageBindingTimeout) {
    duration = 50;
  } else {
    duration = 1;
  }
  const TagManager = s.TagManager;
  if (TagManager && TagManager.azGroups) {
    const $timeout = getTimeout();
    $timeout && $timeout.cancel(calculateImageBindingTimeout);
  }
  const $timeout = getTimeout();
  calculateImageBindingTimeout = $timeout(function () {
    try {
      if (!s.raw) return;

      if (!params.ignoreSort) {
        s.sortRawData(s.orderBy);
      }

      console.time("calculateImageBinding");
      /* var path = require('path');（原文未使用，略去——无副作用） */
      var tags: any = {};
      var exts: any = {};
      s.all = [];
      s.untagged = [];
      s.unfiledCount = 0;
      s.untaggedCount = 0;
      s.trash = [];
      s.folderMappings = {};
      s.tagsSuggestion = [];
      s.folderList = [];
      s.lockedImages = {};

      const ancestorsCache: any = {};
      const defaultFolderCoverIdMap: any = {};

      w.eagle.utils.tree.walk(s.folders, 'children', function(folder: any, parent: any, depth: any) {
        if (folder && parent) {
          folder.parent = parent.id;
        }

        // 列表版本 Folders
        s.folderList.push(folder);

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
            s.tagsSuggestion.push({
              value: tag,
              text: tag
            });
          });
        }

        ancestorsCache[folder.id] = machineryGetAncestorFolders(s, folder, [folder]);

        s.folderMappings[folder.id] = folder;
      });

      w.eagle.utils.tree.walk(s.folders, 'children', function(folder: any, parent: any) {
        folder.extendTags = machineryGetExtendTags(s, folder, []);
        folder.covers = [];
      });


      w.eagle.utils.tree.walk(s.smartFolders, 'children', function (smartFolder: any, parent: any, depth: any) {
        s.smartFolderMappings[smartFolder.id] = smartFolder;
      });

      // 重新建立圖片關係
      for (var rindex = 0; rindex < s.raw.length; rindex++) {
        var image = s.raw[rindex];

        if (!s.itemMappings[image.id]) {
          s.itemMappings[image.id] = image;
        }

        if (image.isDeleted) {
          s.trash.push(image);
        }
        else {

          // 計算資料夾圖片總數
          if (image.folders && image.folders.length > 0) {
            var increaseAncestors: any = {};
            image.folders.forEach(function(folderId: any) {
              var folder = s.folderMappings[folderId];
              if (folder) {
                folder.imageCount++;

                if (folder.password && !folder.isUnLock) {
                  s.lockedImages[image.id] = true;
                }

                // 祖先们也都 + 1 , 记录在其他栏位上
                var ancestors = ancestorsCache[folder.id] || machineryGetAncestorFolders(s, folder, [folder]);
                ancestors.forEach(function (ancestor: any) {
                  // 避免重复加总
                  if (increaseAncestors[ancestor.id]) {
                    return;
                  }
                  if (!ancestor.descendantImageCount) ancestor.descendantImageCount = 0;
                  ancestor.descendantImageCount++;
                  increaseAncestors[ancestor.id] = true;

                  if (ancestor.password && !ancestor.isUnLock) {
                    s.lockedImages[image.id] = true;
                  }
                });
              }
            });
          }

          if (!s.lockedImages[image.id]) {
            s.all.push(image);
            exts[image.ext] = true;
            if (image.tags && image.tags.length == 0) {
              s.untaggedCount++;
            }

            if (!image.folders) {
              s.unfiledCount++;
            }
            else if (image.folders.length === 0) {
              s.unfiledCount++;
            }
            else {
              // 修复异常 folders
              if (image.folders.length === 1 && !s.folderMappings[image.folders[0]]) {
                if (s.libraryModificationTime && image.lastModified && image.lastModified < s.libraryModificationTime) {
                  image.folders = [];
                  s.unfiledCount++;
                }
              }
              else if (image.folders[0] === null || image.folders[1] === null) {
                image.folders = [...new Set(image.folders)].filter(function (obj: any) { return obj != null; });
                if (image.folders.length === 0) {
                  s.unfiledCount++;
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
          if (!s.lockedImages[image.id]) {
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
            if (s.lockedImages[image.id]) continue;
            // txt 不支持做为封面
            if (image.ext === 'txt') continue;
            var folderId = image.folders[i];
            var folder = s.folderMappings[folderId];
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
      w.eagle.filter.filterTypes = [...new Set(w.eagle.filter.filterTypes)];

      // 如果祖先门没有封面，补上封面
      w.eagle.utils.tree.walk(s.folders, 'children', function(folder: any, parent: any) {
        try {
          let converId = folder.coverId || defaultFolderCoverIdMap[folder.id];
          if (!folder.covers) folder.covers = [];
          if (converId && s.itemMappings[converId]) {
            var coverImage = s.itemMappings[converId];
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
          if (w._.isString(tags[key].name)) {
            pinyinCache[key] = w.tinyPinyin.convertToPinyin(tags[key].name);
          }
        }
        tags[key].pinyin = pinyinCache[key];
        if (key) {
          TagManager.rawdata.push(tags[key]);
        }
      });

      TagManager.calculateTags();
      s.tags = TagManager.rawdata;

      if (!s.tags) {
        s.tags = [];
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

/* ── c9b：rebindRefresh 域 ───────────────────────────────────────────── */

/* calcuteFilterBadge（bundle 27522-27633 逐字；controller 闭包函数 → 域内移植。
   纯 eagle.filter.* 读写，无 scope 依赖） */
export function machineryCalcuteFilterBadge(): void {
  const w = window as any;
  const filter = w.eagle.filter;
  filter.filterBadge = 0;
  // 标签
  if (filter.filterRules.tag.includes) {
    filter.filterBadge += filter.filterRules.tag.includes.length;
  }
  if (filter.filterRules.tag.excludes) {
    filter.filterBadge += filter.filterRules.tag.excludes.length;
  }
  var filterFolderCount = Object.keys(filter.filterRules.folder.includes).length;
  if (filterFolderCount) {
    filter.filterBadge += filterFolderCount;
  }
  var excludeFolderCount = Object.keys(filter.filterRules.folder.excludes).length;
  if (excludeFolderCount) {
    filter.filterBadge += excludeFolderCount;
  }

  if (filter.filterRules.tag.no) { filter.filterBadge++; }
  // 颜色
  if (filter.filterRules.color.value) filter.filterBadge++;
  if (filter.filterRules.color.gray) filter.filterBadge++;
  // 类型
  if (filter.filterRules.shape.landscape) filter.filterBadge++;
  if (filter.filterRules.shape.portrait) filter.filterBadge++;
  if (filter.filterRules.shape.square) filter.filterBadge++;
  if (filter.filterRules.shape.panoramicLandscape) filter.filterBadge++;
  if (filter.filterRules.shape.panoramicPortrait) filter.filterBadge++;
  if (filter.filterRules.shape.custom) filter.filterBadge++;
  if (filter.filterRules.shape['43']) filter.filterBadge++;
  if (filter.filterRules.shape['34']) filter.filterBadge++;
  if (filter.filterRules.shape['169']) filter.filterBadge++;
  if (filter.filterRules.shape['916']) filter.filterBadge++;


  // 相机
  if (Object.keys(filter.filterRules.camera).length > 0) {
    filter.filterBadge += Object.keys(filter.filterRules.camera).length;
  }
  // 星等
  if (filter.filterRules.rating['5']) filter.filterBadge++;
  if (filter.filterRules.rating['4']) filter.filterBadge++;
  if (filter.filterRules.rating['3']) filter.filterBadge++;
  if (filter.filterRules.rating['2']) filter.filterBadge++;
  if (filter.filterRules.rating['1']) filter.filterBadge++;
  if (filter.filterRules.rating['0']) filter.filterBadge++;
  // 字体
  if (filter.filterRules.font.activated) filter.filterBadge++;
  if (filter.filterRules.font.deactivated) filter.filterBadge++;

  // 类型
  filter.filterBadge += Object.keys(filter.filterRules.type.includes).length;
  filter.filterBadge += Object.keys(filter.filterRules.type.excludes).length;

  // 时间过滤
  if (filter.filterRules.import.today) filter.filterBadge++;
  if (filter.filterRules.import.yesterday) filter.filterBadge++;
  if (filter.filterRules.import.last7day) filter.filterBadge++;
  if (filter.filterRules.import.last30day) filter.filterBadge++;
  if (filter.filterRules.import.last90day) filter.filterBadge++;
  if (filter.filterRules.import.last365day) filter.filterBadge++;
  if (filter.filterRules.import.usingRange) filter.filterBadge++;
  if (Object.keys(filter.filterRules.import.selectedMonths).length > 0) {
    filter.filterBadge += Object.keys(filter.filterRules.import.selectedMonths).length;
  }

  // 修改时间过滤
  if (filter.filterRules.mtime.today) filter.filterBadge++;
  if (filter.filterRules.mtime.yesterday) filter.filterBadge++;
  if (filter.filterRules.mtime.last7day) filter.filterBadge++;
  if (filter.filterRules.mtime.last30day) filter.filterBadge++;
  if (filter.filterRules.mtime.last90day) filter.filterBadge++;
  if (filter.filterRules.mtime.last365day) filter.filterBadge++;
  if (filter.filterRules.mtime.usingRange) filter.filterBadge++;
  if (Object.keys(filter.filterRules.mtime.selectedMonths).length > 0) {
    filter.filterBadge += Object.keys(filter.filterRules.mtime.selectedMonths).length;
  }

  // 解析度
  if (filter.filterRules.resolution.minW) filter.filterBadge++;
  if (filter.filterRules.resolution.maxW) filter.filterBadge++;
  if (filter.filterRules.resolution.minH) filter.filterBadge++;
  if (filter.filterRules.resolution.maxH) filter.filterBadge++;
  // 档案大小
  if (filter.filterRules.file.min) filter.filterBadge++;
  if (filter.filterRules.file.max) filter.filterBadge++;
  // 长度
  if (filter.filterRules.duration.min) filter.filterBadge++;
  if (filter.filterRules.duration.max) filter.filterBadge++;
  // BPM
  if (filter.filterRules.bpm.min) filter.filterBadge++;
  if (filter.filterRules.bpm.max) filter.filterBadge++;
  // 标注
  if (filter.filterRules.annotation.has) filter.filterBadge++;
  if (filter.filterRules.annotation.no) filter.filterBadge++;
  // 标注
  if (filter.filterRules.note.has) filter.filterBadge++;
  if (filter.filterRules.note.no) filter.filterBadge++;
  // 网址
  if (filter.filterRules.url.has) filter.filterBadge++;
  if (filter.filterRules.url.no) filter.filterBadge++;
  // 以图找图
  if (filter.filterRules.image.base64) filter.filterBadge++;
  if (filter.filterRules.image.itemId) filter.filterBadge++;
  // 自然语言
  if (filter.filterRules.semantic.value) filter.filterBadge++;
}

/* filterSidebarItem（bundle 37967-38001 逐字；controller 闭包函数 → 域内移植。
   依赖 chineseConvert/cartesianProduct/pinyinlite（re-require 十行成员，window.* live binding）、
   _.uniq/_.max（vendor 全局）、String.prototype.score（bundle 2621 原型扩展）） */
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
      search: [folderNameCN, ...w._.uniq(
        w.cartesianProduct(w.pinyinlite(folderNameCN, { keepUnrecognized: true }).filter((p: any) => p.length > 0))
          .map((item: any) => item.join(' '))
      )],
    };
  });

  var scores = folderSearchItems.map((item: any) => {
    return {
      item: item,
      name: item.name,
      score: w._.max(item.search.map((pinyin: any) => pinyin.score(keyword_cn))),
    };
  });

  var result = scores.filter((i: any) => i.score > 0).map(function (i: any) {
    return i.item.folder;
  });

  return result;
}

/* rebindRefresh（bundle 27366-27454 逐字；async。calcuteFilterResult/calcuteContainTags/
   refreshSubfolderList/updateItemsView/getFolderList 等仍由 bundle 承载，经 scope 解析；
   resetNgGridLayoutData = ngGridLayout 指令 66970 隐式全局赋值（window.*）；HoverPreview
   顶层 var（51689）→ window.*；calcuteFilterBadge 为域内移植版） */
export async function machineryRebindRefresh(s: any, muteMode: any, contentFilterCache: any, startCursor: any): Promise<void> {
  const w = window as any;

  if (!s.isItemBindCalculated) return;
  if (!s.raw) return;
  console.time("rebindRefresh");
  var data: any[] = [];

  console.time("calcuteFilterResult");
  data = await s.calcuteFilterResult(data, contentFilterCache);
  console.timeEnd("calcuteFilterResult");


  // 计算这批图片里面出现的标签
  if (w.eagle.filter.tagFilterLogic === "OR" || w.eagle.filter.tagFilterLogic === "EQUAL") {
    s.calcuteContainTags(s.preelaborations);
  }
  else if (w.eagle.filter.tagFilterLogic === "AND") {
    s.calcuteContainTags(data);
  }

  // 计算 Filter Badge 数量
  machineryCalcuteFilterBadge();

  // 置顶排序
  console.time("sort:置顶");
  if (s.currentFolder && s.currentFolder.orderBy !== "RANDOM") {
    let currentFolderId = s.currentFolder.id;
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

  s.allData = data;

  // Note: 2019/08/05 避免拖拽順序使用 $scope.itemMappings 獲取的內容跟真實內容不一致，造成拖拽無法使用
  // 這段代碼主要用來刷新頁面上出現元件的有效性
  if (s.currentFolder) {
    try {
      for (let i = 0; i < s.allData.length; i++) {
        s.itemMappings[s.allData[i].id] = s.allData[i];
      }
    } catch (err) { /* noop */ }
  }

  s.filtereds = s.allData.slice(0, s.len * s.page);

  s.refreshSubfolderList();

  // 減少重複計算，將原先計算智能文件夾數量功能，放在這裡
  if (s.$root.selectedSmartFolders.length === 0 && s.currentSmartFolder) {
    if (s.currentSmartFolder.conditions && s.currentSmartFolder.conditions.length > 0) {
      s.currentSmartFolder.imageCount = s.allData.length;
    }
  }

  let currentViewDataLength = s.allData.length;
  if (currentViewDataLength < 200) {
    s.keywordDebounce = 50;
  }
  else if (currentViewDataLength < 50000) {
    s.keywordDebounce = 200;
  }
  else if (currentViewDataLength < 100000) {
    s.keywordDebounce = 250;
  }
  else {
    s.keywordDebounce = 300;
  }

  console.timeEnd("rebindRefresh");

  if (!muteMode) {
    if (w.eagle.filter.filterBadge > 0) s.startCursor = 0;
    w.resetNgGridLayoutData(s.allData, startCursor || s.startCursor);
  }
  s.updateItemsView(s.selected);
  w.$("#box-container-scrollbar").trigger("UPDATE_BOX_SCROLLBAR");
  if (w.HoverPreview.isShow) {
    w.HoverPreview.hide();
  }
  s.$evalAsync();
}

/* rebindRefreshLazy（bundle 27007-27013 逐字；1000ms 防抖，rebindRefreshLazyTimeout 域内自管） */
export function machineryRebindRefreshLazy(s: any): void {
  const $timeout = getTimeout();
  $timeout.cancel(rebindRefreshLazyTimeout);
  rebindRefreshLazyTimeout = $timeout(function () {
    s.rebindRefresh();
  }, 1000);
}

/* updateSidebarList（bundle 42545-42617 逐字；20ms 防抖，updateSidebarListTimeout 域内自管。
   getFolderList/getSmartFolderList/getQuickAccessList 仍由 bundle 承载经 scope 解析；
   filterSidebarItem 为域内移植版） */
export function machineryUpdateSidebarList(s: any): void {
  const $timeout = getTimeout();
  $timeout.cancel(updateSidebarListTimeout);
  updateSidebarListTimeout = $timeout(function () {
    // console.time("$scope.updateSidebarList");
    var list: any[] = [];
    var allItem = { vstype: 'all', size: 27 };
    var unfiledItem = { vstype: 'unfiled', size: 27 };
    var untaggedItem = { vstype: 'untagged', size: 27 };
    var randomItem = { vstype: 'random', size: 27 };
    var recentItem = { vstype: 'recent', size: 27 };
    var communityItem = { vstype: 'community', size: 27 };
    var allTagsItem = { vstype: 'allTags', size: 27 };
    var trashItem = { vstype: 'trash', size: 27 };
    var folders = s.getFolderList();
    var smartFolders = s.getSmartFolderList();
    var quickAccess = s.getQuickAccessList();
    var quickAccessLabel = { vstype: 'label-qucik-access', size: 25 };
    var smartFolderLabel = { vstype: 'label-smart-folder', size: 25 };
    var folderLabel = { vstype: 'label-folder', size: 25 };

    folders = machineryFilterSidebarItem(folders, s.folderKeyword);
    smartFolders = machineryFilterSidebarItem(smartFolders, s.folderKeyword);

    list.push(allItem);
    if (s.$root.preferences.sidebar.unfiled != 'false') {
      list.push(unfiledItem);
    }
    if (s.$root.preferences.sidebar.untagged != 'false') {
      list.push(untaggedItem);
    }
    if (s.$root.preferences.sidebar.recent != 'false') {
      list.push(recentItem);
    }
    if (s.$root.preferences.sidebar.random != 'false') {
      list.push(randomItem);
    }
    if (s.$root.preferences.sidebar.community2 != 'false') {
      list.push(communityItem);
    }
    list.push(allTagsItem);
    list.push(trashItem);

    if (s.quickAccess.length > 0 && s.$root.preferences.sidebar.quickAccess != 'false') {
      list.push({ vstype: 'separator', size: 14 });
      list.push(quickAccessLabel);
      if (s.isExpandQuickAccess && s.quickAccess.length > 0) {
        list = list.concat(quickAccess);
        list.push({ vstype: 'separator', size: 14 });
      }
    }
    else {
      list.push({ vstype: 'separator', size: 14 });
    }

    if (s.$root.preferences.sidebar.smartFolder != 'false') {
      if (!s.folderKeyword) {
        list.push(smartFolderLabel);
      }
      else if (smartFolders.length > 0) {
        list.push(smartFolderLabel);
      }
      if (smartFolders.length > 0) {
        if (s.isExpandSmartFolder) {
          list = list.concat(smartFolders);
          list.push({ vstype: 'separator', size: 14 });
        }
      }
    }

    if (s.$root.preferences.sidebar.folder != 'false') {
      if (!s.folderKeyword) {
        list.push(folderLabel);
      }
      else if (folders.length > 0) {
        list.push(folderLabel);
      }
      if (s.isExpandFolder) {
        list = list.concat(folders);
      }
    }

    list.forEach(function (node: any, index: number) {
      node.index = index;
    });

    s.sidebarList = list;
  }, 20);
}

/* ── c9c：视图/加载域 ───────────────────────────────────────────────── */

/* updateItemsView（bundle 35065-35072 逐字；updateItemView 仍由 bundle 承载经 scope 解析） */
export function machineryUpdateItemsView(s: any, items: any[]): void {
  const w = window as any;
  w.$(".box.selected").removeClass("selected");
  for (var i = items.length - 1; i >= 0; i--) {
    var item = items[i];
    s.updateItemView(item);
  }
}

/* switchLayout（bundle 33790-33846 逐字；relayout/offsetScrollbar/initMenu 仍由 bundle
   承载经 scope 解析） */
export function machinerySwitchLayout(s: any, layout: any, forceLayout: any): void {
  const w = window as any;
  var $container = w.$("#box-container");
  var allLayout = "grid-layout justified-layout list-layout";
  switch (layout) {
    case "GridLayout":
      window.requestAnimationFrame(() => {
        w.$("body").removeClass("is-square-layout is-list-layout");
      });
      s.layout = "GridLayout";
      $container.removeClass(allLayout).addClass("grid-layout");
      s.relayout();
      // $scope.adjustLayoutWidth(0);
      w.electronLog && w.electronLog.info("[app] Layout: Waterfall");
      break;
    case "SquareLayout":
      window.requestAnimationFrame(() => {
        w.$("body").removeClass("is-square-layout is-list-layout");
        w.$("body").addClass("is-square-layout");
      });
      s.layout = "SquareLayout";
      $container.removeClass(allLayout).addClass("grid-layout");
      s.relayout();
      // $scope.adjustLayoutWidth(0);
      w.electronLog && w.electronLog.info("[app] Layout: Grid");
      break;
    case "ListLayout":
      window.requestAnimationFrame(() => {
        w.$("body").removeClass("is-square-layout is-list-layout");
        w.$("body").addClass("is-list-layout");
      });
      s.layout = "ListLayout";
      $container.removeClass(allLayout).addClass("list-layout");
      s.relayout();
      w.electronLog && w.electronLog.info("[app] Layout: List");
      break;
    default:
      window.requestAnimationFrame(() => {
        w.$("body").removeClass("is-square-layout is-list-layout");
      });
      s.layout = "JustifiedLayout";
      $container.removeClass(allLayout).addClass("justified-layout");
      s.relayout();
      w.electronLog && w.electronLog.info("[app] Layout: Justified");
  }

  s.offsetScrollbar(30);
  s.$root.initMenu();
}

/* resetImageData（bundle 30540-30548 逐字；controller 闭包函数 → 域内移植） */
function machineryResetImageData(s: any, images: any[]): void {
  const w = window as any;
  if (s.viewMode == "all" || (s.currentFolder && images[0].folders[0] && images[0].folders.indexOf(s.currentFolder.id) > -1) || (images[0].folders && images[0].folders.length === 0 && s.viewMode == "unfiled")) {
    w.resetNgGridLayoutData(s.allData, 0);
    s.$evalAsync();
  }
}

/* prependImages（bundle 30524-30538 逐字；prependImagesTimeout 域内自管。
   原码 updateView 参数未使用，逐字保留签名） */
export function machineryPrependImages(s: any, images: any[], updateView: any): void {
  for (var i = 0; i < images.length; i++) {
    s.itemMappings[images[i].id] = images[i];
  }

  if (images[0].id) {
    s.allData.unshift(images[0]);
    clearTimeout(prependImagesTimeout);
    prependImagesTimeout = setTimeout(function () {
      machineryResetImageData(s, images);
    }, 500);
  }
}

/* autoResizeTagFilter（bundle 43119-43128 逐字；controller 闭包函数 → 域内移植） */
function machineryAutoResizeTagFilter(s: any): void {
  const w = window as any;
  var tagsLength = s.containTags.length;
  var height = tagsLength * 24 + 54;
  if (s.containerSize && s.containerSize.tagFilter) {
    if (s.containerSize.tagFilter > height) {
      w.$(".tags-filter").height(height);
    }
    else {
      w.$(".tags-filter").height(s.containerSize.tagFilter);
    }
  }
}

/* reload（bundle 42867-42918 逐字；_.debounce(fn, 100, true) leading-edge 防抖原样复刻，
   防抖实例在 applyDataMachineryScope 时一次性创建（与 bundle controller init 同语义）。
   leaveDetailMode/relayout/updateSelection/calculateFilterCounts/updateSubFolderWidth/
   adjustLayoutWidth 仍由 bundle 承载经 scope 解析；rebindRefresh 已是移植版（scope 解析即达）） */
export function machineryReload(s: any): any {
  const w = window as any;
  return w._.debounce(function reload(keepDetailMode: any) {
    s.hexColor = undefined;
    s.unlockPassword = "";

    if (!keepDetailMode) {
      if (s.isDetailMode) {
        s.leaveDetailMode();
      }

      if (s.selected.length > 0) {
        s.selected = [];
      }
    }

    s.loadMoreDisable = false;
    s.lastImageHeight = s.imageSize.height;
    s.boxContianerWidth = w.$("#box-container").width() || s.boxContianerWidth;
    s.rebindRefresh();
    s.relayout();
    s.updateSelection();
    s.calculateFilterCounts();
    s.updateSubFolderWidth();
    w.$("#box-container-scrollbar").trigger("UPDATE_BOX_SCROLLBAR");

    machineryAutoResizeTagFilter(s);
    if (s.layout === "GridLayout" || s.layout === "SquareLayout") {
      s.adjustLayoutWidth(0);
    }
    s.listDone = true;

    if (w.$("#box-container").scrollTop() !== 0) {
      w.$("#box-container").scrollTop(0);
    }
    w.$(".box.processed").removeClass("processed");
    setTimeout(function () {
      w.$("#image-drop-area").show();
      w.$("#box-container").trigger("scroll");
    }, 100);
    setTimeout(function () {
      w.$("#box-container").trigger("scroll");
    }, 500);

  }, 100, true);
}

/* ── c9d：缩放/放映/计数/最近文件夹 ──────────────────────────────────── */

/* getRatioExp（bundle 31336-31341 逐字） */
export function machineryGetRatioExp(ratio: any): number {
  if (ratio > 100) {
    ratio = 100 + (ratio - 100) * 7;
  }
  return parseInt(ratio);
}

/* getRatioNonExp（bundle 31343-31348 逐字） */
export function machineryGetRatioNonExp(ratio: any): number {
  if (ratio > 100) {
    ratio = (ratio - 100) / 7 + 100;
  }
  return ratio;
}

/* updateZoomRatio（bundle 31391-31418 逐字；smoothZoom = vendor jQuery 插件；
   updateZoomRatioTimeout 域内自管） */
export function machineryUpdateZoomRatio(s: any, ratio: any, x: any, y: any, hasTransition: any): void {
  const w = window as any;
  var pageX: any, pageY: any;

  if (ratio) {
    s.imageSize.zoomRatio = ratio;
    s.imageSize.zoomRatioExp = machineryGetRatioExp(s.imageSize.zoomRatio);
  }

  if (w.$.isNumeric(x) && w.$.isNumeric(y)) {
    pageX = x;
    pageY = y;
  } else {
    pageX = w.$(window).width() / 2;
    pageY = w.$(window).height() / 2;
  }

  if (hasTransition) {
    clearTimeout(updateZoomRatioTimeout);
    w.$("#detail-container").addClass("zooming");
    updateZoomRatioTimeout = setTimeout(function () {
      w.$("#detail-container").removeClass("zooming");
    }, 300);
  }

  w.$("#detail-container").smoothZoom('focusTo', {
    zoom: s.imageSize.zoomRatioExp,
    pageX: pageX,
    pageY: pageY,
    speed: 0
  });
}

/* toggleSlideshow（bundle 23816-23823 逐字；enter/leaveSlideshowMode 经 scope 解析） */
export function machineryToggleSlideshow(s: any): void {
  if (!s.isSlideshowMode) {
    s.enterSlideshowMode();
  } else {
    s.leaveSlideshowMode();
  }
}

/* smartFolderCount（bundle 46646-46661 逐字；existInSmartFilter/lockImageFilter 经 scope 解析） */
export function machinerySmartFolderCount(s: any, smartFolder: any): any {
  if (smartFolder) {
    if (smartFolder.conditions.length === 0) return 0;
    // console.time("计算智能文件夹图片数量");
    var images: any[] = [];
    images = s.raw.filter(function (image: any) {
      if (image.isDeleted) return false;
      return s.existInSmartFilter(smartFolder, image);
    });
    if (Object.keys(s.lockedImages).length > 0) {
      images = images.filter(s.lockImageFilter);
    }
    // console.timeEnd("计算智能文件夹图片数量");
    return images.length;
  }
}

/* getRecentFolders（bundle 31969-31988 逐字） */
export function machineryGetRecentFolders(s: any, length: any): any[] {
  var len = length;
  if (!length) len = 8;
  var recentMoveFolders: any = localStorage.getItem("recentMoveFolders");
  if (recentMoveFolders) {
    recentMoveFolders = JSON.parse(recentMoveFolders);
    recentMoveFolders = recentMoveFolders.slice(0, len);
  }
  else {
    return [];
  }

  recentMoveFolders = recentMoveFolders.filter(function (folderId: any) {
    return !!s.folderMappings[folderId];
  });

  var recentFolders = recentMoveFolders.map(function (folderId: any) {
    return s.folderMappings[folderId];
  });

  recentFolders = [...new Set(recentFolders)];
  return recentFolders;
}

/* updateItemView（bundle 34847-35063 逐字；单条目 DOM 更新机——updateItemsView 循环体。
   依赖：window.* 全局（$/FileUrlHelper/fileSize/fontFolder/sanitize/installedFonts/i18n/
   VIDEO_TYPES/AUDIO_TYPES/FONT_TYPES/SPECIAL_TYPES）、$filter 经 injector（duration/domainName/
   date）、fs 经 window.require('fs')、TagManager/listMetaType 经 scope 字段） */
export function machineryUpdateItemView(s: any, item: any): void {
  const w = window as any;
  const fs = w.require && w.require('fs');

  if (!item) return;
  try {
    var id = item.id;
    var $element = w.$("#box-" + id);
    if ($element.length === 0) return;
    var $name = $element.find(".name span");
    var $iconName = $element.find(".ext-icon-name");
    var $metas = $element.find(".metas");
    var thumbnail = $element.find(".thumbnail");
    var $propTags = $element.find(".prop.tags");
    var $propResolution = $element.find(".prop.resolution");
    var $propRating = $element.find(".prop.rating");
    var $propSize = $element.find(".prop.size");
    var isSelected = s.selectedMappings[id];
    var tags = item.tags || [];
    var isTagged = tags.length > 0;
    var $annotationCount = $element.find(".annotation-count");
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
          return `<div class="tag color-${s.TagManager.tagMappings[tag].color}">${tag}</div>`;
        } catch (err) { /* noop */ }
      });
      tagsFormated = tags2.join("");
    }

    $element.attr("data-height", item.height);
    $element.attr("data-width", item.width);

    if ($name.text() !== item.name) {
      if (!s.modifiedMappings[item.id]) s.modifiedMappings[item.id] = 0;
      s.modifiedMappings[item.id]++;
      let src = w.FileUrlHelper.getLastestThumbnailUrl(item);
      var $img = $element.find(".thumbnail img");
      $img.attr("lazysrc", "");
      $img.attr("lsrc", src);
      $img.attr("raw", src);
      // 確保不是在編輯模式
      if (!$name.parent().hasClass('editable')) {
        $name.text(item.name);
        $iconName.text(item.name);
      }
    }

    if (item.comments && item.comments.length > 0) {
      $element.addClass("has-annotation");
      $annotationCount.text(item.comments.length);
    }
    else {
      $element.removeClass("has-annotation");
    }

    $element.removeClass("bg-light bg-dark bg-gray bg-grid");
    if (item.background) {
      $element.addClass(`bg-${item.background}`);
    }

    var metas = '';
    const $filter = getFilter();
    switch (s.listMetaType) {
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
          w.$("#box-" + item.id + " .txt-content div").html(paragraphsHTML);
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
    $metas.html(metas);

    $propTags.html(tagsFormated);
    if (item.width) {
      $propResolution.html(`${item.width} x ${item.height}`);
    }
    else {
      $propResolution.html(`-`);
    }
    $propRating.html(`<span class="small star">${ratingStrings[item.star]}</span>`);
    $propSize.html(`${w.fileSize(item.size, 1)}`);

    if (isSelected) {
      $element.addClass("selected");
    }
    else {
      $element.removeClass("selected");
    }

    if (isTagged) {
      $element.addClass("tagged");
    }
    else {
      $element.removeClass("tagged");
    }

    $element.find("img").removeClass("r2 r3 r4 r5 r6 r7 r8");
    if (item.orientation && !item.noThumbnail) {
      if (item.orientation === 8) {
        $element.find("img").addClass(" r8 ");
      }
      else if (item.orientation === 7) {
        $element.find("img").addClass(" r7 ");
      }
      else if (item.orientation === 6) {
        $element.find("img").addClass(" r6 ");
      }
      else if (item.orientation === 5) {
        $element.find("img").addClass(" r5 ");
      }
      else if (item.orientation === 4) {
        $element.find("img").addClass(" r4 ");
      }
      else if (item.orientation === 3) {
        $element.find("img").addClass(" r3 ");
      }
      else if (item.orientation === 2) {
        $element.find("img").addClass(" r2 ");
      }

      if (item.orientation > 4) {
        if (item.width < item.height) {
          $element.find("img").css("min-width", `${item.height / item.width * 100}%`);
        }
        else {
          $element.find("img").css("width", `${item.height / item.width * 100}%`);
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
        $element.addClass("activating");
      }
      else if (fs && fs.existsSync(fontPath)) {
        w.installedFonts[`${postScriptName}_.${item.ext}`] = true;
        $element.removeClass("activating");
        $element.addClass("activated");
        $element.find(".activate-btn").attr("title", deactivatedLabel);
      }
      else {
        w.installedFonts[`${postScriptName}_.${item.ext}`] = false;
        $element.removeClass("activating");
        $element.removeClass("activated");
        $element.find(".activate-btn").attr("title", activatedLabel);
      }
    }
  }
  catch (err) {
    console.error(err);
  }
}

/* checkTouchIDSupport（bundle 29002-29010 逐字；systemPreferences 经 @electron/remote。
   原码 quirk 逐字保留：非 darwin 平台不写 canUseTouchID（无 else 分支）。bundle 29014/29109
   调用点与 React lockState 流共用本实现） */
export function machineryCheckTouchIDSupport(s: any): void {
  const w = window as any;
  let systemPreferences: any = null;
  try {
    systemPreferences = w.require && w.require('@electron/remote').systemPreferences;
  } catch (err) { /* noop */ }
  if (w.process && w.process.platform === 'darwin' && systemPreferences && systemPreferences.canPromptTouchID) {
    try {
      s.canUseTouchID = systemPreferences.canPromptTouchID();
    } catch (err) {
      console.error('檢查 Touch ID 支援時發生錯誤:', err);
      s.canUseTouchID = false;
    }
  }
}

/* relayout（bundle 27329-27364 逐字；ig = window.eg.InfiniteGrid 实例（libraryDomain
   loaded 处理器创建），eg = window.eg（c13 UMD 提取 if-absent 供给）） */
export function machineryRelayout(s: any, margin: any): void {
  const w = window as any;
  if (!s.isItemBindCalculated) return;
  var $container = w.$("#box-container");
  var currentImageSize = s.imageSize.height;
  w.$("#box-container").attr("box-size", Math.floor(currentImageSize / 5) * 5);
  const ig = w.ig;
  if (!ig) return;
  if (s.layout === "JustifiedLayout") {
    var cw = $container.width();
    ig.setLayout(w.eg.InfiniteGrid.JustifiedLayout, {
      minSize: currentImageSize * 1 - 10,
      maxSize: currentImageSize * 1 + 10,
      margin: 8,
    });
    ig._renderer.updateSize(ig.getItems(false));
    ig.layout(true);
    ig._watcher._onCheck();
  }
  else if (s.layout === "ListLayout") {
    ig.setLayout(w.eg.InfiniteGrid.GridLayout, {
      margin: 0,
      align: "left",
    });
    ig._renderer.updateSize(ig.getItems(false));
    ig.layout(true);
    ig._watcher._onCheck();
  }
  else {
    ig.setLayout(w.eg.InfiniteGrid.GridLayout, {
      margin: Math.max(margin, 8) || 8,
      align: "left",
    });
    ig._renderer.updateSize(ig.getItems(false));
    ig.layout(true);
    ig._watcher._onCheck();
  }
  ig._updateContainerHeight();
}

let applied = false;
export function applyDataMachineryScope(): void {
  if (applied) return;
  applied = true;
  const s = getBodyScope();
  if (!s) return;

  // scope 函数替换：此后 bundle 侧全部 $scope.calculateImageBinding 调用面（muteCalcuteImageBinding/
  // library.changed 等）即走移植实现（绞杀内部机器）。c9b：rebindRefresh/rebindRefreshLazy/
  // updateSidebarList 一并替换（React 域 10+ 处调用面 + bundle 18203/18438/$broadcast 路径）。
  s.calculateImageBinding = (params: any, callback: any) => machineryCalculateImageBinding(s, params, callback);
  s.sortRawData = (orderBy: any) => machinerySortRawData(s, orderBy);
  s.getAncestorFolders = (folder: any, folders: any[]) => machineryGetAncestorFolders(s, folder, folders);
  s.rebindRefresh = (muteMode: any, contentFilterCache: any, startCursor: any) => machineryRebindRefresh(s, muteMode, contentFilterCache, startCursor);
  s.rebindRefreshLazy = () => machineryRebindRefreshLazy(s);
  s.updateSidebarList = () => machineryUpdateSidebarList(s);
  // c9c：updateItemsView/switchLayout/prependImages/reload（reload = 一次性创建的 leading-edge
  // 防抖实例，与 bundle controller init 同语义）
  s.updateItemsView = (items: any[]) => machineryUpdateItemsView(s, items);
  s.switchLayout = (layout: any, forceLayout: any) => machinerySwitchLayout(s, layout, forceLayout);
  s.prependImages = (images: any[], updateView: any) => machineryPrependImages(s, images, updateView);
  s.reload = machineryReload(s);
  // c9d：缩放/放映/计数/最近文件夹（getRatioExp/getRatioNonExp 纯函数被 updateZoomRatio
  // 与 React 域 24 处调用面共用）
  s.getRatioExp = (ratio: any) => machineryGetRatioExp(ratio);
  s.getRatioNonExp = (ratio: any) => machineryGetRatioNonExp(ratio);
  s.updateZoomRatio = (ratio: any, x: any, y: any, hasTransition: any) => machineryUpdateZoomRatio(s, ratio, x, y, hasTransition);
  s.toggleSlideshow = () => machineryToggleSlideshow(s);
  s.smartFolderCount = (smartFolder: any) => machinerySmartFolderCount(s, smartFolder);
  s.getRecentFolders = (length: any) => machineryGetRecentFolders(s, length);
  // c9e：updateItemView（updateItemsView 循环体；bundle 侧 $bodyScope.updateItemView 19688-19751
  // 与 ipc 路径 21234/23632+ 全部改走移植版）
  s.updateItemView = (item: any) => machineryUpdateItemView(s, item);
  s.checkTouchIDSupport = () => machineryCheckTouchIDSupport(s);
  // c13：relayout（ig/eg 经 window 解析）
  s.relayout = (margin: any) => machineryRelayout(s, margin);

  (window as any).__eagleDataMachinery = {
    version: 7,
    applied: true,
    sortRawData: 'machinery',
    calculateImageBinding: 'machinery',
    getAncestorFolders: 'machinery',
    getExtendTags: 'machinery',
    rebindRefresh: 'machinery',
    rebindRefreshLazy: 'machinery',
    updateSidebarList: 'machinery',
    calcuteFilterBadge: 'machinery',
    filterSidebarItem: 'machinery',
    updateItemsView: 'machinery',
    switchLayout: 'machinery',
    prependImages: 'machinery',
    reload: 'machinery',
    autoResizeTagFilter: 'machinery',
    resetImageData: 'machinery',
    getRatioExp: 'machinery',
    getRatioNonExp: 'machinery',
    updateZoomRatio: 'machinery',
    toggleSlideshow: 'machinery',
    smartFolderCount: 'machinery',
    getRecentFolders: 'machinery',
    updateItemView: 'machinery',
    checkTouchIDSupport: 'machinery',
    relayout: 'machinery',
  };
}
