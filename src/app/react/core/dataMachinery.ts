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
import { updateCurrentOrderAndIncrease, isInFolder } from './controllerFns';

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

/* ── c14：智能文件夹规则匹配域 ───────────────────────────────────────── */

/* MATCH_FUNCTION 表（bundle 32117-32143 逐字；26 规则函数经 window 解析——bundle 8369-9418
   顶层函数（b1 后由 public/vendor/eagle-match-rules.js script 注入供给）） */
let matchFunctionTable: any = null;
function getMatchFunctionTable(): any {
  const w = window as any;
  if (!matchFunctionTable) {
    matchFunctionTable = {
      "name": w.isMatchNameRule,
      "folderName": w.isMatchFolderNameRule,
      "url": w.isMatchUrlRule,
      "annotation": w.isMatchAnnotationRule,
      "comments": w.isMatchCommentsRule,
      "width": w.isMatchWidthRule,
      "height": w.isMatchHeightRule,
      "fileSize": w.isMatchFileSizeRule,
      "createTime": w.isMatchTimeRule,
      "mtime": w.isMatchMTimeRule,
      "btime": w.isMatchBTimeRule,
      "tags": w.isMatchTagsRule,
      "rating": w.isMatchRatingRule,
      "folders": w.isMatchFoldersRule,
      "type": w.isMatchTypeRule,
      "shape": w.isMatchShapeRule,
      "color": w.isMatchColorRule,
      "duration": w.isMatchDurationRule,
      "bpm": w.isMatchBPMRule,
      "camera": w.isMatchCameraRule,
      "iso": w.isMatchISORule,
      "aperture": w.isMatchApertureRule,
      'focalLength': w.isMatchFocalLengthRule,
      'shutter': w.isMatchShutterRule,
      "timestamp": w.isMatchTimestampRule,
      "fontActivated": w.isMatchFontActivatedRule
    };
  }
  return matchFunctionTable;
}

/* isMatchCondition（bundle 32145-32175 逐字） */
function machineryIsMatchCondition(condition: any, image: any): boolean {
  const MATCH_FUNCTION = getMatchFunctionTable();
  var allMatch = true; // 全部符合

  for (let i = 0; i < condition.rules.length; i++) {
    var isMatch = false;
    isMatch = MATCH_FUNCTION[condition.rules[i].property](condition.rules[i], image);

    // 如果有任何一調規則沒有 match，交集狀態必為 false
    if (!isMatch) {
      allMatch = false;
    }
    // 交集判斷不需要等待所有條件計算完畢
    if (condition.match === "AND" && !isMatch) {
      return false;
    }
    // 假如是聯集且有任何一條規則已經 match
    else if (condition.match === "OR" && isMatch) {
      return true;
    }
  }

  // 如果全不符合
  if (allMatch) {
    return true;
  }

  return false;
}

/* existInSmartFilter（bundle 32091-32116 逐字；递归 parent 链） */
export function machineryExistInSmartFilter(s: any, smartFolder: any, image: any): boolean {
  try {
    var conditions = smartFolder.conditions;

    for (var i = 0; i < smartFolder.conditions.length; i++) {
      var boolean = smartFolder.conditions[i].boolean || "TRUE";
      var isMatch = machineryIsMatchCondition(smartFolder.conditions[i], image);
      if (boolean === "FALSE") {
        isMatch = !isMatch;
      }
      if (!isMatch) return false;
    }
    let parent = s.smartFolderMappings[smartFolder.parent];
    if (parent) {
      return machineryExistInSmartFilter(s, parent, image);
    }
    else {
      return true;
    }
  }
  catch (err) {
    return false;
  }
}

/* ── c14b：筛选引擎（filterData 27654-28504 逐字分片）────────────────── */

// ── c14b 域内自管（原 controller 闭包 var：27004/27005）──
let imageSearchController: any = null;
let semanticSearchController: any = null;

/* filterData 分片 1：import 月份/时间、mtime、类型含排、档案大小、长度、BPM、解析度、
   标注、注释（27654-27960 逐字） */
function machineryFilterDataPart1(s: any, w: any, data: any[]): any[] {

  if (Object.keys(w.eagle.filter.filterRules.import.selectedMonths).length > 0) {
    data = data.filter(function (image: any) {
      let importDate = new Date(image.modificationTime);
      let importYear = importDate.getFullYear();
      let importMonth = ("" + (importDate.getMonth() + 1)).padStart(2, "0");
      return w.eagle.filter.filterRules.import.selectedMonths[`${importYear}/${importMonth}`];
    });
  }

  // 时间筛选
  if (w.eagle.filter.filterRules.import.today || w.eagle.filter.filterRules.import.yesterday || w.eagle.filter.filterRules.import.last7day || w.eagle.filter.filterRules.import.last30day || w.eagle.filter.filterRules.import.last90day || w.eagle.filter.filterRules.import.last365day || w.eagle.filter.filterRules.import.usingRange) {

    var ONE_DAY = 1000 * 60 * 60 * 24;
    let today = new Date();
    today.setHours(0, 0, 0);
    let todayTime = today.getTime();
    let yesterdayTime = todayTime - ONE_DAY;

    data = data.filter(function (image: any) {

      var result = false;
      if (w.eagle.filter.filterRules.import.today) {
        if (image.modificationTime > todayTime) result = true;
      }
      if (w.eagle.filter.filterRules.import.yesterday) {
        if (image.modificationTime < todayTime && image.modificationTime > yesterdayTime) result = true;
      }
      if (w.eagle.filter.filterRules.import.last7day) {
        if (Date.now() - image.modificationTime < ONE_DAY * 7) result = true;
      }
      if (w.eagle.filter.filterRules.import.last30day) {
        if (Date.now() - image.modificationTime < ONE_DAY * 30) result = true;
      }
      if (w.eagle.filter.filterRules.import.last90day) {
        if (Date.now() - image.modificationTime < ONE_DAY * 90) result = true;
      }
      if (w.eagle.filter.filterRules.import.last365day) {
        if (Date.now() - image.modificationTime < ONE_DAY * 365) result = true;
      }
      if (w.eagle.filter.filterRules.import.usingRange) {
        if (w.eagle.filter.filterRules.import.range && w.eagle.filter.filterRules.import.range[0] && w.eagle.filter.filterRules.import.range[1]) {
          if (w.eagle.filter.filterRules.import.range[0] <= image.modificationTime && image.modificationTime <= w.eagle.filter.filterRules.import.range[1] + ONE_DAY) result = true;
        }
      }
      return result;
    });
  }

  // 修改时间筛选
  if (Object.keys(w.eagle.filter.filterRules.mtime.selectedMonths).length > 0) {
    data = data.filter(function (image: any) {
      let mtime = image.mtime || image.modificationTime;
      let modifyDate = new Date(mtime);
      let modifyYear = modifyDate.getFullYear();
      let modifyMonth = ("" + (modifyDate.getMonth() + 1)).padStart(2, "0");
      return w.eagle.filter.filterRules.mtime.selectedMonths[`${modifyYear}/${modifyMonth}`];
    });
  }

  if (w.eagle.filter.filterRules.mtime.today || w.eagle.filter.filterRules.mtime.yesterday || w.eagle.filter.filterRules.mtime.last7day || w.eagle.filter.filterRules.mtime.last30day || w.eagle.filter.filterRules.mtime.last90day || w.eagle.filter.filterRules.mtime.last365day || w.eagle.filter.filterRules.mtime.usingRange) {

    var ONE_DAY2 = 1000 * 60 * 60 * 24;
    let today2 = new Date();
    today2.setHours(0, 0, 0);
    let todayTime2 = today2.getTime();
    let yesterdayTime2 = todayTime2 - ONE_DAY2;

    data = data.filter(function (image: any) {

      var result = false;
      var mtime = image.mtime || image.modificationTime;

      if (w.eagle.filter.filterRules.mtime.today) {
        if (mtime > todayTime2) result = true;
      }
      if (w.eagle.filter.filterRules.mtime.yesterday) {
        if (mtime < todayTime2 && mtime > yesterdayTime2) result = true;
      }
      if (w.eagle.filter.filterRules.mtime.last7day) {
        if (Date.now() - mtime < ONE_DAY2 * 7) result = true;
      }
      if (w.eagle.filter.filterRules.mtime.last30day) {
        if (Date.now() - mtime < ONE_DAY2 * 30) result = true;
      }
      if (w.eagle.filter.filterRules.mtime.last90day) {
        if (Date.now() - mtime < ONE_DAY2 * 90) result = true;
      }
      if (w.eagle.filter.filterRules.mtime.last365day) {
        if (Date.now() - mtime < ONE_DAY2 * 365) result = true;
      }
      if (w.eagle.filter.filterRules.mtime.usingRange) {
        if (w.eagle.filter.filterRules.import.range && w.eagle.filter.filterRules.import.range[0] && w.eagle.filter.filterRules.import.range[1]) {
          if (w.eagle.filter.filterRules.import.range[0] <= mtime && mtime <= w.eagle.filter.filterRules.import.range[1] + ONE_DAY2) result = true;
        }
      }
      return result;
    });
  }

  // 类型筛选
  if (Object.keys(w.eagle.filter.filterRules.type.includes).length > 0) {
    data = data.filter(function (image: any) {
      if (w.eagle.filter.filterRules.type.includes[image.ext]) return true;
      if (w.eagle.filter.filterRules.type.includes['video']) {
        return w.VIDEO_TYPES[image.ext];
      }
      if (w.eagle.filter.filterRules.type.includes['url']) {
        if (image.ext == 'url' && !image.medium) return true;
      }
      if (w.eagle.filter.filterRules.type.includes['youtube']) {
        if (image.ext == 'url' && image.medium == 'youtube') return true;
      }
      if (w.eagle.filter.filterRules.type.includes['vimeo']) {
        if (image.ext == 'url' && image.medium == 'vimeo') return true;
      }
      if (w.eagle.filter.filterRules.type.includes['bilibili']) {
        if (image.ext == 'url' && image.medium == 'bilibili') return true;
      }
      if (w.eagle.filter.filterRules.type.includes['audio']) {
        return w.AUDIO_TYPES[image.ext];
      }
      if (w.eagle.filter.filterRules.type.includes['powerpoint']) {
        if (image.ext == 'ppt' || image.ext == 'pptx' || image.ext == 'potx') return true;
      }
      if (w.eagle.filter.filterRules.type.includes['word']) {
        if (image.ext == 'doc' || image.ext == 'docx') return true;
      }
      if (w.eagle.filter.filterRules.type.includes['excel']) {
        if (image.ext == 'xls' || image.ext == 'xlsx') return true;
      }
      if (w.eagle.filter.filterRules.type.includes['font']) {
        return w.FONT_TYPES[image.ext];
      }
      return false;
    });
  }

  // 類型排除
  if (Object.keys(w.eagle.filter.filterRules.type.excludes).length > 0) {
    data = data.filter(function (image: any) {
      if (w.eagle.filter.filterRules.type.excludes[image.ext]) return false;
      if (w.eagle.filter.filterRules.type.excludes['video']) {
        if (w.VIDEO_TYPES[image.ext]) return false;
      }
      if (w.eagle.filter.filterRules.type.excludes['url']) {
        if (image.ext == 'url' && !image.medium) return false;
      }
      if (w.eagle.filter.filterRules.type.excludes['youtube']) {
        if (image.ext == 'url' && image.medium == 'youtube') return false;
      }
      if (w.eagle.filter.filterRules.type.excludes['vimeo']) {
        if (image.ext == 'url' && image.medium == 'vimeo') return false;
      }
      if (w.eagle.filter.filterRules.type.excludes['bilibili']) {
        if (image.ext == 'url' && image.medium == 'bilibili') return false;
      }

      if (w.eagle.filter.filterRules.type.excludes['audio']) {
        if (w.AUDIO_TYPES[image.ext]) return false;
      }
      if (w.eagle.filter.filterRules.type.excludes['powerpoint']) {
        if (image.ext == 'ppt' || image.ext == 'pptx' || image.ext == 'potx') return false;
      }
      if (w.eagle.filter.filterRules.type.excludes['word']) {
        if (image.ext == 'doc' || image.ext == 'docx') return false;
      }
      if (w.eagle.filter.filterRules.type.excludes['excel']) {
        if (image.ext == 'xls' || image.ext == 'xlsx') return false;
      }
      if (w.eagle.filter.filterRules.type.excludes['font']) {
        if (w.FONT_TYPES[image.ext]) return false;
      }
      return true;
    });
  }

  // 档案大小筛选
  // 最小值
  if (w.$.isNumeric(w.eagle.filter.filterRules.file.min)) {
    var unit = 1024;
    if (w.eagle.filter.filterRules.file.unit == 'mb') {
      unit = 1024 * 1024;
    }
    data = data.filter(function (image: any) {
      return image.size >= parseInt((w.eagle.filter.filterRules.file.min * unit) as any);
    });
  }
  // 最大值
  if (w.$.isNumeric(w.eagle.filter.filterRules.file.max)) {
    var unit2 = 1024;
    if (w.eagle.filter.filterRules.file.unit == 'mb') {
      unit2 = 1024 * 1024;
    }
    data = data.filter(function (image: any) {
      return image.size <= parseInt((w.eagle.filter.filterRules.file.max * unit2) as any);
    });
  }

  // 视频、音频长度筛选
  // 最小值
  if (w.$.isNumeric(w.eagle.filter.filterRules.duration.min)) {
    var unit3 = 1;
    if (w.eagle.filter.filterRules.duration.unit == 'h') {
      unit3 = 60 * 60;
    }
    else if (w.eagle.filter.filterRules.duration.unit == 'm') {
      unit3 = 60;
    }
    data = data.filter(function (image: any) {
      return image.duration >= parseInt((w.eagle.filter.filterRules.duration.min * unit3) as any);
    });
  }
  // 最大值
  if (w.$.isNumeric(w.eagle.filter.filterRules.duration.max)) {
    var unit4 = 1;
    if (w.eagle.filter.filterRules.duration.unit == 'h') {
      unit4 = 60 * 60;
    }
    else if (w.eagle.filter.filterRules.duration.unit == 'm') {
      unit4 = 60;
    }
    data = data.filter(function (image: any) {
      return image.duration <= parseInt((w.eagle.filter.filterRules.duration.max * unit4) as any);
    });
  }

  // BPM 最小值
  if (w.$.isNumeric(w.eagle.filter.filterRules.bpm.min)) {
    data = data.filter(function (image: any) {
      if (!image.bpm) return false;
      return image.bpm >= parseInt(w.eagle.filter.filterRules.bpm.min);
    });
  }
  // BPM 最大值
  if (w.$.isNumeric(w.eagle.filter.filterRules.bpm.max)) {
    data = data.filter(function (image: any) {
      if (!image.bpm) return false;
      return image.bpm <= parseInt(w.eagle.filter.filterRules.bpm.max);
    });
  }

  // 图片大小筛选
  // 宽度最小值
  if (w.$.isNumeric(w.eagle.filter.filterRules.resolution.minW)) {
    data = data.filter(function (image: any) {
      return image.width >= parseInt(w.eagle.filter.filterRules.resolution.minW);
    });
  }
  // 宽度最大值
  if (w.$.isNumeric(w.eagle.filter.filterRules.resolution.maxW)) {
    data = data.filter(function (image: any) {
      return image.width <= parseInt(w.eagle.filter.filterRules.resolution.maxW);
    });
  }
  // 高度最小值
  if (w.$.isNumeric(w.eagle.filter.filterRules.resolution.minH)) {
    data = data.filter(function (image: any) {
      return image.height >= parseInt(w.eagle.filter.filterRules.resolution.minH);
    });
  }
  // 高度最大值
  if (w.$.isNumeric(w.eagle.filter.filterRules.resolution.maxH)) {
    data = data.filter(function (image: any) {
      return image.height <= parseInt(w.eagle.filter.filterRules.resolution.maxH);
    });
  }

  // 图片标注筛选
  // 有标注
  if (w.eagle.filter.filterRules.annotation.has) {
    // 不需要关键字
    if (!w.eagle.filter.filterRules.annotation.keywords) {
      data = data.filter(function (image: any) {
        return image.comments && image.comments.length > 0;
      });
    }
    // 需要关键字
    else {
      var keywords = w.eagle.filter.filterRules.annotation.keywords.split(",");
      data = data.filter(function (image: any) {
        var matchCount = 0;
        for (var i = 0; i < keywords.length; i++) {
          var keyword = keywords[i].toLowerCase();
          if (image.comments && image.comments.length > 0) {
            for (var j = 0; j < image.comments.length; j++) {
              var comment = image.comments[j];
              if (comment.annotation.toLowerCase().indexOf(keyword) > -1) {
                matchCount++;
                break;
              }
            }
          }
        }
        return (matchCount == keywords.length);
      });
    }
  }
  // 没标注
  else if (w.eagle.filter.filterRules.annotation.no) {
    data = data.filter(function (image: any) {
      return !image.comments || image.comments.length == 0;
    });
  }

  return data;
}

// ── APPEND:c14b-2 ──

/* filterData 分片 2：注释/网址/方向/星等/字体/相机/颜色/关键字/已删排序/random 预筛
   （27960-28170 逐字） */
function machineryFilterDataPart2(s: any, w: any, data: any[]): any[] {

  // 图片注释筛选
  // 有注释
  if (w.eagle.filter.filterRules.note.has) {
    // 不需要关键字
    if (!w.eagle.filter.filterRules.note.keywords) {
      data = data.filter(function (image: any) {
        return image.annotation && image.annotation.length > 0;
      });
    }
    // 需要关键字
    else {
      var keywords = w.eagle.filter.filterRules.note.keywords.split(",");
      data = data.filter(function (image: any) {
        var matchCount = 0;
        for (var i = 0; i < keywords.length; i++) {
          var keyword = keywords[i].toLowerCase();
          if (image.annotation && image.annotation.toLowerCase().indexOf(keyword) > -1) {
            matchCount++;
          }
        }
        return (matchCount == keywords.length);
      });
    }
  }
  // 没注释
  else if (w.eagle.filter.filterRules.note.no) {
    data = data.filter(function (image: any) {
      return !image.annotation || image.annotation.length == 0;
    });
  }

  // 来源网址筛选
  // 有網址
  if (w.eagle.filter.filterRules.url.has) {
    // 不需要关键字
    if (!w.eagle.filter.filterRules.url.keywords) {
      data = data.filter(function (image: any) {
        return image.url && image.url.length > 0;
      });
    }
    // 需要关键字
    else {
      var keywords2 = w.eagle.filter.filterRules.url.keywords.split(",");
      data = data.filter(function (image: any) {
        var matchCount = 0;
        for (var i = 0; i < keywords2.length; i++) {
          var keyword = keywords2[i].toLowerCase();
          if (image.url && image.url.toLowerCase().indexOf(keyword) > -1) {
            matchCount++;
          }
        }
        return (matchCount == keywords2.length);
      });
    }
  }
  // 沒網址
  else if (w.eagle.filter.filterRules.url.no) {
    data = data.filter(function (image: any) {
      return !image.url || image.url.length == 0;
    });
  }

  // 方向筛选
  if (w.eagle.filter.filterRules.shape.landscape || w.eagle.filter.filterRules.shape.portrait || w.eagle.filter.filterRules.shape.square || w.eagle.filter.filterRules.shape.panoramicLandscape || w.eagle.filter.filterRules.shape.panoramicPortrait || w.eagle.filter.filterRules.shape.custom || w.eagle.filter.filterRules.shape['43'] || w.eagle.filter.filterRules.shape['34'] || w.eagle.filter.filterRules.shape['169'] || w.eagle.filter.filterRules.shape['916']) {
    data = data.filter(function (image: any) {
      var result = false;
      if (w.eagle.filter.filterRules.shape.landscape) {
        if (image.width > image.height) result = true;
      }
      if (!result && w.eagle.filter.filterRules.shape.portrait) {
        if (image.height > image.width) result = true;
      }
      if (!result && w.eagle.filter.filterRules.shape.square) {
        if (image.width == image.height) result = true;
      }
      if (!result && w.eagle.filter.filterRules.shape.panoramicLandscape) {
        if (image.width > image.height && image.width / image.height >= 2.5) result = true;
      }
      if (!result && w.eagle.filter.filterRules.shape.panoramicPortrait) {
        if (image.width < image.height && image.height / image.width >= 2.5) result = true;
      }
      if (!result && w.eagle.filter.filterRules.shape['43']) {
        if (image.width / image.height === 4 / 3) {
          result = true;
        }
      }
      if (!result && w.eagle.filter.filterRules.shape['34']) {
        if (image.width / image.height === 3 / 4) {
          result = true;
        }
      }
      if (!result && w.eagle.filter.filterRules.shape['169']) {
        if (image.width / image.height === 16 / 9) {
          result = true;
        }
      }
      if (!result && w.eagle.filter.filterRules.shape['916']) {
        if (image.width / image.height === 9 / 16) {
          result = true;
        }
      }
      if (!result && w.eagle.filter.filterRules.shape.custom) {
        if (w.eagle.filter.filterRules.shape.width && w.eagle.filter.filterRules.shape.height) {
          if (image.width / image.height === w.eagle.filter.filterRules.shape.width / w.eagle.filter.filterRules.shape.height) {
            result = true;
          }
        }
        else {
          result = true;
        }
      }
      return result;
    });
  }

  // 星等筛选
  if (w.eagle.filter.filterRules.rating['5'] || w.eagle.filter.filterRules.rating['4'] || w.eagle.filter.filterRules.rating['3'] || w.eagle.filter.filterRules.rating['2'] || w.eagle.filter.filterRules.rating['1'] || w.eagle.filter.filterRules.rating['0']) {
    let starMap: any = {
      "5": w.eagle.filter.filterRules.rating['5'],
      "4": w.eagle.filter.filterRules.rating['4'],
      "3": w.eagle.filter.filterRules.rating['3'],
      "2": w.eagle.filter.filterRules.rating['2'],
      "1": w.eagle.filter.filterRules.rating['1'],
    };
    data = data.filter(function (image: any) {
      if (w.eagle.filter.filterRules.rating['0'] && !image.star) return true;
      return starMap[image.star];
    });
  }

  // 字体筛选
  if (w.eagle.filter.filterRules.font.activated) {
    data = data.filter(function (image: any) {
      if (!image.fontMetas) return false;
      try {
        var key = Object.keys(image.fontMetas.postScriptName)[0];
        var postScriptName = image.fontMetas.postScriptName && image.fontMetas.postScriptName[key];
        return w.installedFonts[`${postScriptName}_.${image.ext}`];
      }
      catch (err) { /* noop */ }
    });
  }
  else if (w.eagle.filter.filterRules.font.deactivated) {
    data = data.filter(function (image: any) {
      if (!image.fontMetas) return false;
      try {
        var key = Object.keys(image.fontMetas.postScriptName)[0];
        var postScriptName = image.fontMetas.postScriptName && image.fontMetas.postScriptName[key];
        return !w.installedFonts[`${postScriptName}_.${image.ext}`];
      }
      catch (err) { /* noop */ }
    });
  }

  var selectedCameras = Object.keys(w.eagle.filter.filterRules.camera);
  if (selectedCameras.length > 0) {
    data = data.filter(function (image: any) {
      if (image && image.rawMetas && image.rawMetas.camera) {
        return w.eagle.filter.filterRules.camera[image.rawMetas.camera];
      }
      return false;
    });
  }

  // 颜色筛选
  if (w.eagle.filter.filterRules.color.value) {
    data = data.filter(s.colorFilter);
  }

  // 黑白图片过滤
  if (w.eagle.filter.filterRules.color.gray) {
    console.time("grayColorFilter");
    data = data.filter(s.grayColorFilter);
    console.timeEnd("grayColorFilter");
  }

  if (w.eagle.filter.filterRules.color.value && s.viewMode !== "random") {
    data = data.sort(function (a: any, b: any) {
      var da = s.colorDistancesMap[a.id] || 100;
      var db = s.colorDistancesMap[b.id] || 100;
      if (da > db) return 1;
      if (da < db) return -1;
      return 0;
    });
  }

  // 关键字筛选
  if (s.keyword) {
    console.time("$scope.searchFilter");
    data = data.filter(s.searchFilter);
    console.timeEnd("$scope.searchFilter");
  }

  // 已刪除時間排序
  if (s.viewMode === 'trash') {
    data = getFilter()('orderBy')(data, function (image: any) {
      if (image.deletedTime) {
        return -image.deletedTime;
      }
      return -image.modificationTime;
    });
  }
  else if (s.viewMode === 'random') {
    console.time("shuffle");
    if (s.shuffle.length > 0) {
      data = s.shuffle.filter(function (item: any) {
        return s.itemMappings[item.id] && !s.itemMappings[item.id].isDeleted;
      });
    }
    else {
      (data as any).shuffle();
      s.shuffle = data;
    }
    console.timeEnd("shuffle");
  }

  s.preelaborations = [];
  if (w.eagle.filter.filterBadge > 0) {
    if (w.eagle.filter.folderFilterLogic === "OR" || w.eagle.filter.tagFilterLogic === "OR") {
      data.forEach(function (image: any) {
        s.preelaborations.push(image);
      });
    }
    else {
      s.preelaborations = data;
    }
  }
  else {
    s.preelaborations = data;
  }

  return data;
}

// ── APPEND:c14b-3 ──

/* filterData 分片 3：标签 OR/AND/EQUAL、文件夹 OR/AND/EQUAL、lockedImages、排序、
   以图找图/语义搜索、recent 排序（28170-28504 逐字） */
async function machineryFilterDataPart3(s: any, w: any, data: any[]): Promise<any[]> {

  // 如果是 OR 逻辑需要保留所有 tags filter 的结果，为了计算 containTags
  if (w.eagle.filter.tagFilterLogic === "OR") {

    if ((w.eagle.filter.filterRules.tag.includes && w.eagle.filter.filterRules.tag.includes.length > 0) || (w.eagle.filter.filterRules.tag.excludes && w.eagle.filter.filterRules.tag.excludes.length > 0)) {
      data = data.filter(function (image: any) {

        // 包含標籤
        if (w.eagle.filter.filterRules.tag.includes.length > 0) {
          for (var i = 0; i < w.eagle.filter.filterRules.tag.includes.length; i++) {
            var tag = w.eagle.filter.filterRules.tag.includes[i];
            if (image.tags && image.tags.length > 0) {
              for (var j = 0; j < image.tags.length; j++) {
                if (image.tags[j] == tag) {
                  return true;
                }
              }
            }
          }
        }

        // 排除標籤
        if (w.eagle.filter.filterRules.tag.excludes.length > 0) {
          var matchCount = 0;
          for (var i = 0; i < w.eagle.filter.filterRules.tag.excludes.length; i++) {
            var tag = w.eagle.filter.filterRules.tag.excludes[i];
            if (image.tags && image.tags.length > 0) {
              if (image.tags.indexOf(tag) !== -1) {
                matchCount++;
              }
            }
          }
          if (matchCount === 0) {
            return true;
          }
        }
        return false;
      });

      if (w.eagle.filter.filterRules.tag.no) {
        s.preelaborations.forEach(function (image: any) {
          if (!image.tags || image.tags.length === 0) {
            data.push(image);
          }
        });
      }
    }
    else {
      if (w.eagle.filter.filterRules.tag.no) {
        data = data.filter(function (image: any) {
          return !image.tags || image.tags.length === 0;
        });
      }
    }
  }
  // 标签筛选（and 逻辑）
  else if (w.eagle.filter.tagFilterLogic === "AND" || w.eagle.filter.tagFilterLogic === "EQUAL") {

    // 包含標籤
    if (w.eagle.filter.filterRules.tag.includes && w.eagle.filter.filterRules.tag.includes.length > 0) {
      data = data.filter(function (image: any) {
        var matchCount = 0;
        for (var i = 0; i < w.eagle.filter.filterRules.tag.includes.length; i++) {
          var tag = w.eagle.filter.filterRules.tag.includes[i];
          if (image.tags && image.tags.length > 0) {
            for (var j = 0; j < image.tags.length; j++) {
              if (image.tags[j] == tag) {
                if (w.eagle.filter.tagFilterLogic === "EQUAL") {
                  if (image.tags.length === w.eagle.filter.filterRules.tag.includes.length) {
                    matchCount++;
                  }
                }
                else {
                  matchCount++;
                }
                break;
              }
            }
          }
        }
        return (matchCount == w.eagle.filter.filterRules.tag.includes.length);
      });
    }

    // 排除標籤
    if (w.eagle.filter.filterRules.tag.excludes && w.eagle.filter.filterRules.tag.excludes.length > 0) {
      data = data.filter(function (image: any) {
        for (var i = 0; i < w.eagle.filter.filterRules.tag.excludes.length; i++) {
          var tag = w.eagle.filter.filterRules.tag.excludes[i];
          if (image.tags && image.tags.length > 0) {
            if (image.tags.indexOf(tag) !== -1) {
              return false;
            }
          }
        }
        return true;
      });
    }

    // 没标签筛选
    if (w.eagle.filter.filterRules.tag.no) {
      data = data.filter(function (image: any) {
        return !image.tags || image.tags.length === 0;
      });
    }
  }

  // 筛选器文件夹
  // OR
  if (w.eagle.filter.folderFilterLogic === "OR") {

    var filterFolders = Object.values(w.eagle.filter.filterRules.folder.includes).map(function (folder: any) { return folder; });
    var excludeFolders = Object.values(w.eagle.filter.filterRules.folder.excludes).map(function (folder: any) { return folder; });

    if (filterFolders.length > 0 || excludeFolders.length > 0) {

      data = data.filter(function (image: any) {

        // 包含文件夹
        if (filterFolders.length > 0) {
          for (var i = 0; i < filterFolders.length; i++) {
            var folderId = filterFolders[i].id;
            if (folderId === "NoFolders" && image.folders.length === 0) {
              return true;
            }
            if (folderId && image.folders && image.folders.length > 0) {
              for (var j = 0; j < image.folders.length; j++) {
                if (image.folders[j] == folderId) {
                  return true;
                }
              }
            }
          }
        }

        // 排除文件夹
        if (excludeFolders.length > 0) {
          var matchCount = 0;
          for (var i = 0; i < excludeFolders.length; i++) {
            var folderId = excludeFolders[i].id;
            if (folderId === "NoFolders" && image.folders.length === 0) {
              matchCount++;
            }
            if (image.folders && image.folders.length > 0) {
              if (image.folders.indexOf(folderId) !== -1) {
                matchCount++;
              }
            }
          }
          if (matchCount === 0) {
            return true;
          }
        }

        return false;
      });
    }
  }
  // AND
  else if (w.eagle.filter.folderFilterLogic === "AND" || w.eagle.filter.folderFilterLogic === "EQUAL") {

    var filterFolders2 = Object.values(w.eagle.filter.filterRules.folder.includes).map(function (folder: any) { return folder; });
    var excludeFolders2 = Object.values(w.eagle.filter.filterRules.folder.excludes).map(function (folder: any) { return folder; });

    // 包含文件夹
    if (filterFolders2.length > 0) {
      data = data.filter(function (image: any) {
        var matchCount = 0;
        for (var i = 0; i < filterFolders2.length; i++) {
          var folder = filterFolders2[i];
          var folderId = folder.id;
          if (folderId === "NoFolders" && image.folders.length === 0) {
            matchCount++;
          }
          if (folder && image.folders && image.folders.length > 0) {
            for (var j = 0; j < image.folders.length; j++) {
              if (image.folders[j] == folder.id) {
                if (w.eagle.filter.folderFilterLogic === "EQUAL") {
                  if (image.folders.length === filterFolders2.length) {
                    matchCount++;
                  }
                }
                else {
                  matchCount++;
                }
                break;
              }
            }
          }
        }
        return (matchCount === filterFolders2.length);
      });
    }

    // 排除文件夹
    if (excludeFolders2.length > 0) {
      data = data.filter(function (image: any) {
        for (var i = 0; i < excludeFolders2.length; i++) {
          var folderId = excludeFolders2[i].id;
          if (folderId === "NoFolders" && image.folders.length === 0) {
            return false;
          }
          if (image.folders && image.folders.length > 0) {
            if (image.folders.indexOf(folderId) !== -1) {
              return false;
            }
          }
        }
        return true;
      });
    }
  }

  // 如果沒有使用加密文件夾，就不需要判斷這件事情
  if (Object.keys(s.lockedImages).length > 0) {
    data = data.filter(s.lockImageFilter);
  }

  // 文件夹有自己的排序方式
  if (!s.$root.selectedFolders.length && s.currentFolder && s.currentFolder.orderBy) {
    if (s.orderBy !== "IMPORT" || s.currentFolder.orderBy !== s.orderBy) {
      data = s.sortData(data, s.currentFolder.orderBy);
    }
    if (!s.currentFolder.sortIncrease) {
      data = data.reverse();
    }
  }

  // 智能文件夹有自己的排序方式
  else if (s.currentSmartFolder && s.currentSmartFolder.orderBy) {
    if (s.currentSmartFolder.orderBy !== s.orderBy || s.currentSmartFolder.orderBy === "RANDOM") {
      data = s.sortData(data, s.currentSmartFolder.orderBy);
    }
    if (!s.currentSmartFolder.sortIncrease) {
      data = data.reverse();
    }
  }
  else if (!s.sortIncrease && !w.eagle.filter.filterRules.color.value) {
    data = data.reverse();
  }

  // 內部以圖找圖 by id
  if (w.eagle.filter.filterRules.image.itemId || w.eagle.filter.filterRules.image.base64) {
    if (imageSearchController) {
      imageSearchController.abort();
    }
    imageSearchController = new AbortController();
    const imageSignal = imageSearchController.signal;

    try {
      const handle = (w.eagle.filter.filterRules.image.itemId)
        ? w.eagle.aiSearch.searchByItemId(w.eagle.filter.filterRules.image.itemId, { signal: imageSignal })
        : w.eagle.aiSearch.searchByBase64(w.eagle.filter.filterRules.image.base64, { signal: imageSignal });
      const result = await handle;
      const ids: any = {};
      ids[result.eagleId] = {
        score: 1,
        id: result.eagleId
      };
      result.results.forEach((item: any) => {
        if (item.score > 0.1) {
          ids[item.id] = item;
        }
      });

      data = data.filter((item: any) => {
        return ids[item.id];
      }).sort((a: any, b: any) => {
        return ids[b.id].score - ids[a.id].score;
      });
    }
    catch (err: any) {
      if (err.name === 'AbortError') return data;
    }
  }

  // 语义
  if (w.eagle.filter.filterRules.semantic.value) {
    if (semanticSearchController) {
      semanticSearchController.abort();
    }
    semanticSearchController = new AbortController();

    try {
      const result = await w.eagle.aiSearch.searchByText(
        w.eagle.filter.filterRules.semantic.value,
        { signal: semanticSearchController.signal }
      );
      const ids: any = {};
      ids[result.eagleId] = {
        score: 1,
        id: result.eagleId
      };
      result.results.forEach((item: any) => {
        ids[item.id] = item;
      });

      data = data.filter((item: any) => {
        return ids[item.id];
      }).sort((a: any, b: any) => {
        return ids[b.id].score - ids[a.id].score;
      });
    }
    catch (err: any) {
      if (err.name === 'AbortError') return data;
    }
  }

  if (s.viewMode === 'recent') {
    data = data.sort(function (a: any, b: any) {
      return w.RecentFileManager.recentFilesOrder[a.id] - w.RecentFileManager.recentFilesOrder[b.id];
    });
  }

  return data;
}

/* filterData（bundle 27654-28504 装配；三分片顺序执行） */
export async function machineryFilterData(s: any, data: any[]): Promise<any[]> {
  const w = window as any;
  data = machineryFilterDataPart1(s, w, data);
  data = machineryFilterDataPart2(s, w, data);
  data = await machineryFilterDataPart3(s, w, data);
  return data;
}

/* calcuteFilterResult（bundle 27634-27653 逐字） */
export async function machineryCalcuteFilterResult(s: any, data: any[], contentFilterCache: any): Promise<any[]> {
  s.colorDistancesMap = {};
  return new Promise<any[]>(async (resolve, reject) => {
    try {
      let result: any[];
      if (contentFilterCache) {
        result = contentFilterCache.slice(0);
      }
      else {
        result = s.raw.filter(s.contentFilter);
        s.contentFilterCache = result.slice(0);
      }
      const filtered = await machineryFilterData(s, result);
      resolve(filtered);
    } catch (err) {
      reject(err);
    }
  });
}

/* ── c14c：contentFilter / calcuteContainTags / RecentFileManager ───────── */

/* RecentFileManager（bundle 52307-52390 逐字；save = w.throttle(1000, immediate)） */
function buildRecentFileManager(): any {
  const w = window as any;
  const RecentFileManager: any = {
    libraryName: "",
    recentFiles: [],
    recentFilesOrder: {},
    maxHistory: 5000,
    init: function (libraryName: any) {
      RecentFileManager.libraryName = libraryName;
      let json = (window as any).localStorage[`eagle.recentFiles.${RecentFileManager.libraryName}`];
      if (json) {
        try {
          RecentFileManager.recentFiles = JSON.parse(json);
          RecentFileManager.calOrders();
        }
        catch (err) {
          RecentFileManager.recentFiles = [];
        }
      }
    },
    calOrders: function () {
      try {
        for (var i = 0; i < RecentFileManager.recentFiles.length; i++) {
          let itemId = RecentFileManager.recentFiles[i];
          RecentFileManager.recentFilesOrder[itemId] = i + 1;
        }
      }
      catch (err) { /* noop */ }
    },
    isExists: function (item: any) {
      if (!item || !item.id) return false;
      return RecentFileManager.recentFilesOrder[item.id];
    },
    addFile: function (item: any) {
      try {
        if (!RecentFileManager.libraryName) {
          console.error("RecentFileManager.libraryName is empty");
          return;
        }
        if (!item || !item.id) return;
        RecentFileManager.recentFiles.unshift(item.id);
        RecentFileManager.calOrders();
        RecentFileManager.save();
      }
      catch (err) { /* noop */ }
    },
    addFiles: function (items: any) {
      try {
        if (!RecentFileManager.libraryName) {
          console.error("RecentFileManager.libraryName is empty");
          return;
        }
        if (!items) return;
        if (items.length >= 20) return;
        items.reverse().forEach(function (item: any) {
          if (!item || !item.id) return;
          RecentFileManager.recentFiles.unshift(item.id);
          RecentFileManager.calOrders();
        });
        RecentFileManager.save();
      }
      catch (err) { /* noop */ }
    },
    clean: function () {
      RecentFileManager.recentFiles = [];
      RecentFileManager.recentFilesOrder = {};
      RecentFileManager.save();
    },
    save: w.throttle(function () {
      try {
        if (!RecentFileManager.libraryName) {
          console.error("RecentFileManager.libraryName is empty");
          return;
        }
        // 最多保存 5000 個
        RecentFileManager.recentFiles = [...new Set(RecentFileManager.recentFiles)];
        if (RecentFileManager.recentFiles.length > RecentFileManager.maxHistory) {
          RecentFileManager.recentFiles.length = RecentFileManager.maxHistory;
        }
        let json = JSON.stringify(RecentFileManager.recentFiles);
        (window as any).localStorage[`eagle.recentFiles.${RecentFileManager.libraryName}`] = json;
      }
      catch (err) { /* noop */ }
    }, 1000, true),
  };
  return RecentFileManager;
}

/* contentFilter（bundle 31804-31896 逐字；isInFolder 复用 controllerFns 移植版，
   RecentFileManager 经 window 解析） */
export function machineryContentFilter(s: any, image: any): boolean {
  const w = window as any;
  try {
    if (s.$root.selectedSmartFolders.length > 0) {
      if (image.isDeleted) return false;
      for (let i = 0; i < s.$root.selectedSmartFolders.length; i++) {
        let smartFolder = s.$root.selectedSmartFolders[i];
        if (machineryExistInSmartFilter(s, smartFolder, image)) {
          return true;
        }
      }
      return false;
    }
    else if (s.currentSmartFolder) {
      if (image.isDeleted) return false;
      if (s.currentSmartFolder.children && s.currentSmartFolder.children.length === 0 && s.currentSmartFolder.conditions && s.currentSmartFolder.conditions.length === 0) {
        return false;
      }
      else if (s.currentSmartFolder.children && s.currentSmartFolder.children.length > 0 && s.currentSmartFolder.conditions && s.currentSmartFolder.conditions.length === 0) {
        for (let i = 0; i < s.currentSmartFolder.children.length; i++) {
          let smartFolder = s.currentSmartFolder.children[i];
          if (machineryExistInSmartFilter(s, smartFolder, image)) {
            return true;
          }
        }
        return false;
      }
      else {
        return machineryExistInSmartFilter(s, s.currentSmartFolder, image);
      }
    }
    switch (s.viewMode) {
      case "all":
        if (!image.isDeleted) return true;
        break;
      case "unfiled":
        if (image.isDeleted) return false;
        if (!image.folders || image.folders.length === 0 || (image.folders.length === 1 && image.folders[0] && !s.folderMappings[image.folders[0]])) {
          return true;
        }
        break;
      case "untagged":
        if (image.isDeleted) return false;
        if (!image.tags || image.tags.length === 0) {
          return true;
        }
        break;
      case "random":
        if (!image.isDeleted) return true;
        break;
      case "recent":
        return (w.RecentFileManager.isExists(image));
      case "trash":
        if (image.isDeleted) return true;
        break;
      default:
        // 文件夹多选
        if (s.$root.selectedFolders.length > 0) {
          if (image.isDeleted) return false;
          for (var i = 0; i < s.$root.selectedFolders.length; i++) {
            var folder = s.$root.selectedFolders[i];
            if (isInFolder(image, folder)) {
              return true;
            }
          }
        }
        // 文件夹单选
        else if (s.currentFolder) {
          if (image.isDeleted) return false;
          if (isInFolder(image, s.currentFolder)) {
            return true;
          }
          return false;
        } else if (s.currentTag) {
          if (image.isDeleted) return false;
          return image.tags.indexOf(s.currentTag) > -1;
        }
        return false;
    }
    return false;
  }
  catch (err) {
    return false;
  }
}

/* calcuteContainTags 闭包版（bundle 27196-27292 逐字） */
function machineryCalcuteContainTagsInner(s: any, data: any[]): any {
  const w = window as any;
  var tagsCount: any = {};
  var tagsMappings: any = {};
  var noTagsCount = 0;

  w.eagle.filter.filterRules.tag.excludes.forEach(function (tag: any) {
    tagsCount[tag] = 0;
  });

  for (var i = data.length - 1; i >= 0; i--) {
    var image = data[i];
    if (image.tags && image.tags.length > 0) {
      image.tags.forEach(function (tag: any) {
        if (tag && tag.length > 200) return;
        if (!tagsCount[tag]) { tagsCount[tag] = 0; }
        tagsCount[tag]++;
      });
    }
    else {
      noTagsCount++;
    }
  }

  var tags = Object.keys(tagsCount).map(function (key: any) {
    var idx = w.eagle.filter.filterRules.tag.includes.indexOf(key);
    var eidx = w.eagle.filter.filterRules.tag.excludes.indexOf(key);
    var index;
    if (idx > -1 && (w.eagle.filter.tagFilterLogic === "AND")) {
      index = tagsCount[key] - idx;
    }
    else if (eidx > -1 && (w.eagle.filter.tagFilterLogic === "AND")) {
      index = tagsCount[key] - 100;
    }
    else {
      index = tagsCount[key] - 100;
    }
    tagsMappings[key] = {
      isSelected: idx > -1,
      isExcluded: eidx > -1,
      name: key,
      pinyin: s.TagManager.tagMappings[key] && s.TagManager.tagMappings[key].pinyin,
      imageCount: tagsCount[key],
      index: index
    };
    return tagsMappings[key];
  });

  tags.sort(function (tag1: any, tag2: any) {
    return tag2.imageCount - tag1.imageCount;
  });

  if (noTagsCount === 0 && !w.eagle.filter.isLock) {
    w.eagle.filter.filterRules.tag.no = false;
  }

  return {
    containTagsMappings: tagsMappings,
    containTags: tags,
    noTagsCount: noTagsCount
  };
}

/* $scope.calcuteContainTags（bundle 27155-27194 逐字） */
export function machineryCalcuteContainTags(s: any, data: any[]): void {
  const w = window as any;
  var result = machineryCalcuteContainTagsInner(s, data);

  // 建立群组列表
  var tagsMappings = result.containTagsMappings;
  s.TagManager.groups.forEach(function (group: any) {
    var groupObject = [];
    group.tags.forEach(function (tag: any) {
      if (tagsMappings[tag]) {
        groupObject.push(tagsMappings[tag]);
        tagsMappings[tag].type = "group-item";
        tagsMappings[tag].group = group;
      }
    });
  });

  s.containTags = [];

  var collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
  result.containTags = result.containTags.sort(function (a: any, b: any) {
    return collator.compare(a.name, b.name);
  });

  result.containTags.forEach(function (tag: any) {
    s.containTags.push(tag);
  });

  // 显示未标签功能
  if (result.noTagsCount > 0) {
    s.containTags.unshift({
      isSelected: w.eagle.filter.filterRules.tag.no,
      name: w.i18n.__("Filter.NoTags"),
      imageCount: result.noTagsCount,
      index: 100000000,
      isNoTags: true
    });
  }
}

/* ── c15：选择广播 + 缩放分发 ────────────────────────────────────────── */

/* updateSelection（bundle 34662-34665 逐字） */
export function machineryUpdateSelection(s: any): void {
  s.$broadcast("UPDATE_INSPECTOR");
}

/* zoom（bundle 31191-31204 逐字；zoomFitEdge/zoomFit/smartZoom 经 scope 解析） */
export function machineryZoom(s: any): void {
  const w = window as any;
  if (!s.isDetailMode) return;
  if (s.lastZoomMode === "edge") {
    if (s.current && !w.VIDEO_TYPES[s.current.ext]) {
      s.zoomFitEdge();
    }
    else {
      s.zoomFit();
    }
  }
  else {
    s.smartZoom();
  }
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
  // c14：existInSmartFilter（26 规则函数经 window + MATCH_FUNCTION 表）
  s.existInSmartFilter = (smartFolder: any, image: any) => machineryExistInSmartFilter(s, smartFolder, image);
  // c14b：筛选引擎（filterData/calcuteFilterResult scope 替换——rebindRefresh 的
  // await s.calcuteFilterResult 即走移植实现）
  s.filterData = (data: any[]) => machineryFilterData(s, data);
  s.calcuteFilterResult = (data: any[], contentFilterCache: any) => machineryCalcuteFilterResult(s, data, contentFilterCache);
  // c14c：contentFilter/calcuteContainTags + RecentFileManager（if-absent）
  s.contentFilter = (image: any) => machineryContentFilter(s, image);
  s.calcuteContainTags = (data: any[]) => machineryCalcuteContainTags(s, data);
  const w2 = window as any;
  if (!w2.RecentFileManager) w2.RecentFileManager = buildRecentFileManager();
  // c15：updateSelection/zoom
  s.updateSelection = () => machineryUpdateSelection(s);
  s.zoom = () => machineryZoom(s);

  (window as any).__eagleDataMachinery = {
    version: 11,
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
    existInSmartFilter: 'machinery',
    isMatchCondition: 'machinery',
    filterData: 'machinery',
    calcuteFilterResult: 'machinery',
    contentFilter: 'machinery',
    calcuteContainTags: 'machinery',
    updateSelection: 'machinery',
    zoom: 'machinery',
  };
}
