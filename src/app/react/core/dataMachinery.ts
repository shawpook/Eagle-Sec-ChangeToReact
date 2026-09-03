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
import { FolderSelectPanel } from '../components/stage7/selectPanelEngine';
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

/* ── c15b：列表高度/缩放适配 ─────────────────────────────────────────── */

// ── c15b 域内自管（原 controller 闭包 var：saveListHeightTimeout，33719 邻域）──
let saveListHeightTimeout: any = null;

/* saveListHeight（bundle 33720-33742 逐字；150ms 防抖，per-folder localStorage 键逐字） */
export function machinerySaveListHeight(s: any, height: any): void {
  clearTimeout(saveListHeightTimeout);
  saveListHeightTimeout = setTimeout(function () {
    if (s.currentFolder) {
      localStorage.setItem("eagle.list.thumbSize." + s.currentFolder.id, height);
    } else if (s.currentSmartFolder) {
      localStorage.setItem("eagle.list.thumbSize." + s.currentSmartFolder.id, height);
    } else if (s.currentTag) {
      localStorage.setItem("eagle.list.thumbSize." + s.currentTag, height);
    } else if (s.viewMode === 'all') {
      localStorage.setItem("eagle.list.thumbSize.all", height);
    } else if (s.viewMode === 'unfiled') {
      localStorage.setItem("eagle.list.thumbSize.unfiled", height);
    } else if (s.viewMode === 'untagged') {
      localStorage.setItem("eagle.list.thumbSize.untagged", height);
    } else if (s.viewMode === 'trash') {
      localStorage.setItem("eagle.list.thumbSize.trash", height);
    } else if (s.viewMode === 'random') {
      localStorage.setItem("eagle.list.thumbSize.random", height);
    } else if (s.viewMode === 'recent') {
      localStorage.setItem("eagle.list.thumbSize.recent", height);
    }
  }, 150);
}

/* adjustLayoutWidth（bundle 33839-33947 逐字；ig._layout._columnLength 经 window 解析，
   scrollToCurrentItem 经 scope 解析） */
export function machineryAdjustLayoutWidth(s: any, increases: any): void {
  const w = window as any;
  if (!s.isItemBindCalculated) return;

  increases = increases || 0;
  var height;
  s.boxContianerWidth = w.$("#box-container").width() || s.boxContianerWidth;
  s.boxContianerHeight = w.$("#box-container").height() || s.boxContianerHeight;
  if (s.layout === "GridLayout" || s.layout === "SquareLayout") {
    if (!w.ig._layout._columnLength) return;
    var containerWidth = w.$("#box-container").width() || s.boxContianerWidth;
    containerWidth = containerWidth - 16 - 10 - 6;
    var currentColumn = w.ig._layout._columnLength;
    var newColumn = (currentColumn + increases) || 1;
    var newHeight = parseInt(((containerWidth - 10 * (newColumn + 1))) / newColumn as any);
    height = Math.ceil(newHeight / 5) * 5;
    if (height > s.MAX_LIST_WIDTH) height = s.MAX_LIST_WIDTH;
  }
  else {
    let step = 50;
    if (s.imageSize.height > 500) {
      step = 100;
    }
    else if (s.imageSize.height < 200) {
      step = 25;
    }
    height = parseInt((s.imageSize.height + (step * -increases)) / 5 as any) * 5;
  }
  if (height > s.MAX_LIST_WIDTH) height = s.MAX_LIST_WIDTH;
  if (height < 75) height = 75;
  s.imageSize.height = parseInt(height);

  if (!height) height = s.imageSize.height;
  if (w.angular.isNumber(height) && height > 0) {
    s.lastImageHeight = s.imageSize.height;
    w.$("#box-container").attr("box-size", height);
    var margin = Math.floor((containerWidth % height) / (parseInt(containerWidth / height as any) - 1));
    if (margin === Infinity) margin = 10;
    s.relayout(margin);

    s.scrollToCurrentItem();
  }
}

/* zoomFit（bundle 33949-33985 逐字；changeListHeight/adjustLayoutWidth/smartZoom/
   zoomFitEdge 经 scope 解析） */
export function machineryZoomFit(s: any, event: any, noAnimation: any): void {
  const w = window as any;
  event && event.preventDefault && event.preventDefault();
  if (!s.isDetailMode) {
    s.imageSize.height = 150;
    s.changeListHeight();
    if (s.layout === "GridLayout" || s.layout === "SquareLayout") {
      s.adjustLayoutWidth(0);
      machinerySaveListHeight(s, s.imageSize.height);
    }
  } else {
    if (s.VIDEO_TYPES[s.current.ext]) {
      // 如果是視頻格式，撐滿畫面
      var mpvPlayer = w.$(".detail-wrap mpv-video")[0];
      if (mpvPlayer) {
        mpvPlayer.scaleMode = 'fit';
      }
      else {
        var $video = w.$(".detail-wrap video");
        if ($video.length > 0) {
          $video.removeClass("fit");
        }
      }
      return;
    }
    s.zoomFitSize = 0;
    s.lastZoomMode = "fit";
    localStorage["eagle.viewer.lastZoomMode"] = s.lastZoomMode;
    s.imageSize.zoomRatio = 100;
    s.imageSize.zoomRatioExp = s.getRatioExp(s.imageSize.zoomRatio);

    if (!noAnimation) {
      w.$("#detail-container").addClass("zooming");
      setTimeout(function () {
        w.$("#detail-container").removeClass("zooming");
      }, 300);
    }

    s.smartZoom(undefined, true);
  }
}

/* ── c15c：选择定位/侧栏索引/页面重置/筛选计数 ───────────────────────── */

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

/* changeSidebarIndex（bundle 36656-36665 逐字） */
export function machineryChangeSidebarIndex(s: any, node: any): void {
  const $timeout = getTimeout();
  const folder = s.folderMappings[node?.id];
  const idx = s.sidebarList.indexOf(folder);
  if (idx !== -1) {
    s.sidebarIndex = -1;
    $timeout(function () {
      s.sidebarIndex = idx;
    }, 1);
  }
}

/* resetPage（bundle 36668-36700 逐字；resetFilter/findDupclipate 经 scope 解析，
   eagle.inspector.reset 经 c12 挂载面，ig.clear 经 window） */
export function machineryResetPage(s: any): void {
  const w = window as any;

  // Note: 切换文件夹时，强制触发 inspector 输入框先进行 change
  (document.activeElement as any)?.blur?.();
  s.$root.$broadcast("RESET_PAGE");
  s.listDone = false;
  setTimeout(() => { w.ig.clear(); }, 40);
  s.isOpenWebpagePanel = false;
  s.currentTag = undefined;
  s.startCursor = 0;
  s.currentFolder = undefined;
  w.eagle.inspector.reset();
  s.currentFolderChildren = undefined;
  s.currentSmartFolder = undefined;
  s.$root.selectedFoldersMappings = {};
  s.$root.selectedFolders = [];
  s.selectedFolderMappings = {};
  s.$root.selectedSmartFoldersMappings = {};
  s.$root.selectedSmartFolders = [];
  s.currentId = undefined;
  s.layout = localStorage.getItem(`eagle.list.layout.${s.rootDir}`) || localStorage.getItem("eagle.list.layout") || "JustifiedLayout";

  if (!w.eagle.filter.isLock) {
    s.resetFilter();
    s.keyword = undefined;
  }
  w.$("#image-drop-area").hide();

  if (s.duplicateTarget) {
    s.duplicateTarget = undefined;
    s.findDupclipate(undefined);
  }
}

/* calculateFilterCounts（bundle 42929-42944 逐字；calculateFilterCountsTimeout 域内自管，
   updateFilterCounts 经 scope 解析） */
let calculateFilterCountsTimeout: any = null;
export function machineryCalculateFilterCounts(s: any): void {
  const w = window as any;
  clearTimeout(calculateFilterCountsTimeout);
  calculateFilterCountsTimeout = setTimeout(function () {
    console.time("calculateFilterCounts");
    w.eagle.filter.resetFilterCounts();
    let now = Date.now();
    for (let i = 0; i < s.allData.length; i++) {
      const image = s.allData[i];
      s.updateFilterCounts(image, 1, now);
    }
    console.timeEnd("calculateFilterCounts");
    s.$evalAsync();
  }, 500);
}

/* ── c15d：openAll 及支撑链 ──────────────────────────────────────────── */

// ── c15d 域内自管（原 controller 闭包 var）──
let openAllTimeout: any = null;
let updateListHeightTimeout: any = null;

/* setViewMode（bundle 38475-38479 逐字；_.debounce 500——防抖实例为模块级单例，与 bundle
   controller init 同语义） */
let setViewModeDebounced: any = null;
function machinerySetViewMode(s: any, viewMode: any): void {
  const w = window as any;
  if (!viewMode) return;
  if (!setViewModeDebounced) {
    setViewModeDebounced = w._.debounce(function (vm: any) {
      localStorage.setItem(`eagle.viewMode.${s.rootDir}`, vm);
    }, 500);
  }
  setViewModeDebounced(viewMode);
}

/* setLastFolder（bundle 38480-38488 逐字；_.debounce 500 单实例语义同上） */
let setLastFolderDebounced: any = null;
function machinerySetLastFolder(s: any, folderId: any): void {
  const w = window as any;
  if (!setLastFolderDebounced) {
    setLastFolderDebounced = w._.debounce(function (fid: any) {
      if (!fid) {
        localStorage.removeItem(`eagle.lastFolder.${s.rootDir}`);
      }
      else {
        machinerySetViewMode(s, "all");
        localStorage.setItem(`eagle.lastFolder.${s.rootDir}`, fid);
      }
    }, 500);
  }
  setLastFolderDebounced(folderId);
}

/* updateListHeight（bundle 33712-33719 逐字；50ms 防抖） */
export function machineryUpdateListHeight(s: any, height: any): void {
  const w = window as any;
  clearTimeout(updateListHeightTimeout);
  updateListHeightTimeout = setTimeout(function () {
    w.$("#box-container").attr("box-size", height);
  }, 50);
}

/* ScrollbarSaver（bundle 46754-46812 逐字；隐式全局赋值 → if-absent 接装 window） */
export function buildScrollbarSaver(): any {
  const w = window as any;
  const ScrollbarSaver: any = {
    positionMapping: {},
    getId: function () {
      const s: any = getBodyScope();
      var id;
      if (s.currentFolder) { id = s.currentFolder.id; }
      else if (s.currentSmartFolder) { id = s.currentSmartFolder.id; }
      else if (s.viewMode == "all") { id = "all"; }
      else if (s.viewMode == "unfiled") { id = "unfiled"; }
      else if (s.viewMode == "untagged") { id = "untagged"; }
      else if (s.viewMode == "trash") { id = "trash"; }
      else if (s.viewMode == "random") { id = "random"; }
      else if (s.viewMode == "recent") { id = "recent"; }
      return id;
    },
    saveScrollPosition: function () {
      const s: any = getBodyScope();
      if (w.eagle.filter.filterBadge > 0) return;
      if (s.keyword) return;
      if (w.$(".box").length + w.$(".sub-folder").length === 0) return;
      var scrollTop = w.$("#box-container").scrollTop();
      var obj: any = {};
      var id = ScrollbarSaver.getId();

      if (scrollTop === 0) {
        delete ScrollbarSaver.positionMapping[id];
        return;
      }

      var startCursor = 0;
      var offsetTop = (w.$(".box-list")[0] && w.$(".box-list")[0].offsetTop) || 0;
      var scrollOffset;
      if (w.$(".sub-folder").length > 0 && s.startCursor === 0) {
        scrollOffset = w.$("#box-container").scrollTop();
      }
      else {
        if (w.$(".box").length === 0) return;
        scrollOffset = Math.abs(w.$(".box").eq(0).offset().top - 44) + offsetTop;
      }
      var its = w.ig.getItems();
      if (its[0]) { startCursor = its[0].groupKey - 1000000; }

      if (!id) return;

      if (startCursor) { obj.cursor = startCursor; }
      obj.offset = scrollOffset;
      ScrollbarSaver.positionMapping[id] = obj;
    },
    restoreScrollPosition: function () {
      const s: any = getBodyScope();
      if (s.viewMode === 'random') return;
      if (w.eagle.filter.filterBadge > 0) return;
      var id = ScrollbarSaver.getId();

      if (!id) return;

      var obj = ScrollbarSaver.positionMapping[id];
      var $boxContainer = w.$("#box-container");
      if (obj) {
        s.startCursor = obj.cursor || 0;
        var offset = obj.offset || 0;
        var times = [20, 300];
        for (var i = times[0]; i < times[1]; i += 20) {
          setTimeout(function () {
            if (ScrollbarSaver.getId() !== id || $boxContainer.scrollTop() !== offset) {
              $boxContainer.scrollTop(offset);
            }
          }, i);
        }
      }
      else {
        s.startCursor = 0;
      }
    }
  };
  return ScrollbarSaver;
}

/* openAll（bundle 36702-36733 逐字；openAllTimeout 域内自管；UrlStateService 经 scope
   解析（bundle 20208 $scope 赋值）——post-b1 Angular $location 缺席为诚实缺口，该服务
   移植随 c16 详情族定 $location shim 方案） */
export function machineryOpenAll(s: any, ignoreHistory: any, callback: any): void {
  const w = window as any;
  const $timeout = getTimeout();

  if (s.viewMode === 'all' && s.allData.length > 0 && w.eagle.filter.filterRules.color.value == undefined) {
    if (callback) {
      callback();
    }
    if (s.isDetailMode) {
      s.leaveDetailMode();
    }
    return;
  }

  w.ScrollbarSaver.saveScrollPosition();

  s.viewMode = 'all';
  s.$root.currentFocus = "sidebar";
  s.resetPage();

  $timeout.cancel(openAllTimeout);
  openAllTimeout = $timeout(function () {
    if (!ignoreHistory) {
      s.UrlStateService.setState({ view: 'all', folder: null, smartfolder: null, tag: null, color: null });
    }
    s.imageSize.height = localStorage.getItem("eagle.list.thumbSize.all") || 150;
    s.imageSize.height = parseInt(s.imageSize.height);
    machinerySetLastFolder(s, undefined);
    machineryUpdateListHeight(s, s.imageSize.height);
    w.ScrollbarSaver.restoreScrollPosition();
    w.$("#sidebar-item-container").scrollTop(0);
    s.reload();
    if (callback) {
      callback();
    }
    w.analytics.screenView('All');
  }, 50);
}

/* ── c16a：详情模式进出 ──────────────────────────────────────────────── */

// ── c16a 域内自管（原 controller 闭包 var：zoomInitTimeout，31586）──
let zoomInitTimeout: any = null;

/* enterDetailMode（bundle 31587-31664 逐字；smoothZoom = vendor jQuery 插件；
   lastZoom/preloadImage/addToRecentFile 经 scope 解析；removePlayingAudios/HoverPreview
   经 window（bundle 顶层——b1 后随 hover-preview 字节提取片供给）；initDetailMode/
   smoothZoomDone 为 scope 字段） */
export function machineryEnterDetailMode(s: any, $event: any, image: any): void {
  const w = window as any;
  const $timeout = getTimeout();
  w.$("#detail-container").css("opacity", 0);

  var duration = 100;
  if (s.isInlineMode) {
    duration = 50;
  }

  if (s.selected.length <= 0) return;
  image = image || s.selected[s.selected.length - 1];
  s.isDetailMode = true;
  s.current = image;
  s.selected = [image];
  s.showDetailImage = true;
  // 移除 $scope.zoom(image) — 此時 Angular 尚未跑 digest，
  // body 還沒有 is-detail-mode class，$(".content-panel").width() 讀到的是列表模式尺寸，
  // 算出的 zoom 一定是錯的。正確的 zoom 會在下方 $timeout 回調中執行。
  w.eagle.inspector.activeTab = "ITEM";
  s.smoothZoomDone = false;

  $timeout.cancel(zoomInitTimeout);
  zoomInitTimeout = $timeout(function () {
    if (!s.initDetailMode) {
      s.initDetailMode = true;
      w.$("#detail-container").smoothZoom({
        width: '100%',
        height: '100%',
        responsive: true,
        mouse_WHEEL: true,
        mouse_DOUBLE_CLICK: false,
        zoom_BUTTONS_SHOW: false,
        pan_BUTTONS_SHOW: false,
        background_COLOR: 'transparent',
        border_SIZE: 0,
        animation_SMOOTHNESS: 0,
        animation_SPEED_ZOOM: 0,
        animation_SPEED_PAN: 0,
        zoom_MAX: 800,
        zoom_MIN: 5,
        on_IMAGE_LOAD: function () {
          $timeout(function () {
            w.$(window).trigger("orientationchange");
            s.showDetailImage = true;
            s.smoothZoomDone = true;
            if (!s.lastZoom()) {
              s.zoom(image);
            }
            w.$("#detail-container").smoothZoom('updateNavigator', s.current);

            w.$("#detail-container").css("opacity", 1);
            w.$(".smooth_zoom_preloader").show();

            // 如果用户没有设置过 mousewheel 偏好
            if (!s.$root.preferences.habits.scrollBehaviorTour) {
              w.$(".smooth_zoom_preloader").one("mousewheel.tour", function () {
                s.$root.$broadcast("OPEN_MOUSEWHEEL_PREFERENCE_WINDOW");
              });
            }
          }, 100);
        }
      });
    } else {
      s.smoothZoomDone = true;
      w.$("#detail-container").smoothZoom('updateNavigator', s.current);
      w.$(window).trigger("orientationchange");
      if (!s.lastZoom()) {
        s.zoom(image);
      }
      w.$("#detail-container").css("opacity", 1);
      setTimeout(function () {
        s.preloadImage("next");
      }, 200);
    }
    s.addToRecentFile(s.current);
    w.removePlayingAudios();
    w.HoverPreview.hide();
  }, duration);
}

/* leaveDetailMode（bundle 31680-31726 逐字；rememberScrollTops/rememberVideoCurrentTime/
   fadeOutDetailMode/initMousetrap 经 window/scope 解析——initMousetrap 归键盘域后续片；
   gifUpadteInterval 原码 typo 逐字保留） */
export function machineryLeaveDetailMode(s: any): void {
  const w = window as any;
  const $timeout = getTimeout();

  s.isCropMode = false;
  s.usingGifPlayer = false;

  if (s.isDetailMode) {

    s.rememberScrollTops(s.current);

    s.isDetailMode = false;
    s.showDetailImage = false;
    s.smoothZoomDone = false;
    s.commentRect = undefined;

    // 記住上次播放位置
    s.rememberVideoCurrentTime(s.current); s.current = undefined;
    $timeout.cancel(zoomInitTimeout);

    setTimeout(function () {
      if (s.isDetailMode) return;
      w.$(".content-panel.detail-mode").removeClass("inline-mode open");
      w.$(".smooth_zoom_preloader").scrollLeft(0);
    }, 50);

    s.isInlineMode = false;
    s.fadeOutDetailMode();
    w.$("#detail-container").smoothZoom('cleanBitmapViewer');
    w.$("#detail-container").smoothZoom('clearPreloadData');

    if (s.isGifReady === true) {
      s.isGifReady = false;
      delete s.gifViewer.frames;
      s.gifViewer.frames = [];
      s.gifViewer.mousedownTime = 0;
      s.gifViewer.mousedownX = 0;
      s.gifViewer.mousedownY = 0;
      s.gifViewer.range = undefined;
      s.gifPlayer = undefined;
    }

    w.initMousetrap ? w.initMousetrap() : machineryInitMousetrap(s);
    clearInterval(s.gifUpadteInterval);
  }
}

/* ── c16c：saveFolder ────────────────────────────────────────────────── */

/* saveFolder（bundle 42399-42467 逐字；cloneTree 经 window（c10a-2）、IPCHelper 经
   window（shims 顶层词法上 window，libraryDomain 同一消费模式）、appRoot.path = app-root-path
   模块的 path 属性、TagManager 经 scope） */
export function machinerySaveFolder(s: any): void {
  const w = window as any;
  console.time("$scope.saveFolder");

  // 保存時進行日文濁音正規化
  const unrom = w.require(w.appRoot.path + '/app/js/utils/unorm.js');
  const nfc = (text: any) => {
    try {
      return unrom.nfc(text);
    }
    catch (err) {
      return text;
    }
  };

  var folders: any[] = [];
  w.cloneTree(folders, s.folders);

  w.eagle.utils.tree.walk(folders, 'children', function (folder: any, parent: any, depth: any) {
    folder.name = nfc(folder.name);
  });

  const smartFolders = s.smartFolders.map(function (smartFolder: any) {
    var clone: any = {
      id: smartFolder.id,
      icon: smartFolder.icon,
      iconColor: smartFolder.iconColor,
      name: smartFolder.name,
      description: smartFolder.description || "",
      modificationTime: smartFolder.modificationTime,
      conditions: smartFolder.conditions,
    };
    if (smartFolder.children) {
      clone.children = smartFolder.children;
    }
    if (smartFolder.orderBy) {
      clone.orderBy = smartFolder.orderBy;
      clone.sortIncrease = smartFolder.sortIncrease;
    }
    return clone;
  });

  w.eagle.utils.tree.walk(smartFolders, 'children', function (smartFolder: any, parent: any, depth: any) {
    smartFolder.name = nfc(smartFolder.name);
  });

  const groups = s.TagManager.groups.map(function (group: any) {
    var g: any = {
      id: group.id,
      name: nfc(group.name),
      tags: group.tags
    };
    if (group.color) {
      g.color = group.color;
    }
    if (group.description !== undefined) {
      g.description = group.description;
    }
    return g;
  });

  const quickAccess = s.quickAccess.map(function (item: any) {
    return {
      type: item.type,
      id: item.id
    };
  });

  const libraryPath = s.libraryPath;

    // IPCHelper（bundle 3471 const = 脚本级词法绑定，window/ESM 均不可达）——send 语义等价
  // 复刻（bundle 3473-3482：ipcRenderer.send + electronLog + try/catch 静默）
  try {
    const ipc = w.__eagleIpc || (w.electron && w.electron.ipcRenderer);
    ipc.send('folders-change', {
      // NOTE: 把資源庫路徑寫死，避免更新到其他資源庫路徑
      libraryDir: libraryPath,
      folders: folders,
      smartFolders: smartFolders,
      quickAccess: quickAccess,
      tagsGroups: groups,
    });
    w.electronLog && w.electronLog.info('[ipc] folders-change');
  }
  catch (err) {
  }

  console.timeEnd("$scope.saveFolder");
}

/* ── c16d：键盘域（buildMousetrap/destoryMousetrap/initMousetrap）──────── */

/* buildMousetrap（bundle 49177-49314 逐字；handlers 全部 $scope.* → s.*；preferences 经
   window（var live binding）、ShortcutManager/Mousetrap 为 vendor script（b1 存活）。
   返回 bindings 映射——由 mgo-mousetrap 指令消费绑定，与 bundle 同语义） */
export function machineryBuildMousetrap(s: any): any {
  const w = window as any;
  const bindings: any = {};

  // 建立快捷鍵名稱到處理函數的映射
  const shortcutHandlerMap: any = {
    'player.playAndPause': () => {
      s.quicklook();
    },
    'player.prev1frame': () => {
      s.prevGifFrame(1);
    },
    'player.next1frame': () => {
      s.nextGifFrame(1);
    },
    'player.prev10frame': () => {
      s.prevGifFrame(10);
    },
    'player.next10frame': () => {
      s.nextGifFrame(10);
    },
    'player.speed.up': () => {
      let playbackRates = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 3, 4, 8];
      if (s.current.ext == 'gif') {
        let currnt = s.gifViewer.speed;
        let idx = playbackRates.indexOf(currnt);
        if (idx !== -1 && playbackRates[idx + 1]) {
          s.gifViewer.setSpeed(playbackRates[idx + 1]);
        }
      }
    },
    'player.speed.down': () => {
      let playbackRates = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 3, 4, 8];
      if (s.isDetailMode) {
        if (s.current.ext == 'gif') {
          let currnt = s.gifViewer.speed;
          let idx = playbackRates.indexOf(currnt);
          if (idx !== -1 && playbackRates[idx - 1]) {
            s.gifViewer.setSpeed(playbackRates[idx - 1]);
          }
        }
      }
    },
    'player.thumbnail.set': () => { }, // 不做任何事情，但需要把這個快速鍵還給其它有綁定的人
    'player.thumbnail.copy': () => { }, // 不做任何事情，但需要把這個快速鍵還給其它有綁定的人
    'player.thumbnail.save': () => { }, // 不做任何事情，但需要把這個快速鍵還給其它有綁定的人
  };

  // 從 preferences 載入快捷鍵
  if (w.preferences && w.preferences.shortcuts && w.preferences.shortcuts.keybinds && w.ShortcutManager) {
    for (const [keyName, electronKey] of Object.entries(w.preferences.shortcuts.keybinds)) {
      if (shortcutHandlerMap[keyName] && electronKey) {
        const mousetrapKey = w.ShortcutManager.electronToMousetrap(electronKey);
        if (mousetrapKey) {
          bindings[mousetrapKey] = shortcutHandlerMap[keyName];
          // console.log(`[Preview] Mapped ${keyName}: ${electronKey} -> ${mousetrapKey}`);
        }
      }
    }
  }

  // 添加硬編碼的快捷鍵（未在 preferences 中定義或沒有對應設定的）
  const hardcodedShortcuts: any = {
    '*': s.toggleAllFolders,
    '/': s.toggleAllFolders,
    '-': s.zoomOut,
    '+': s.zoomIn,
    '=': s.zoomIn,
    '0': s.removeStar,
    '1': s.changeTo1Star,
    '2': s.changeTo2Star,
    '3': s.changeTo3Star,
    '4': s.changeTo4Star,
    '5': s.changeTo5Star,
    'r': s.refreshRandom,
    't': s.openInspectorTagSelectPanel,
    'g': s.openActionsPanel,
    'f': s.openInspectorFolderSelectPanel,
    'j': s.openQuickSearch,
    'n': s.nHandler,
    'm': s.mHandler,
    'mod+z': s.undo,
    'mod+a': s.selectAll,
    'mod+c': s.copyImages,
    'mod+w': s.closeWindowHandler,
    'space': s.quicklook,
    'shift+space': s.pageUpHandler,
    'c': s.keyCHandler,
    'p': s.keyPHandler,
    'a': s.keyLeftHandler,
    'd': s.keyRightHandler,
    'w': s.keyUpHandler,
    's': s.keyDownHandler,
    'left': s.keyLeftHandler,
    'right': s.keyRightHandler,
    'up': s.keyUpHandler,
    'shift+up': s.multipleSelectUp,
    'down': s.keyDownHandler,
    'shift+down': s.multipleSelectDown,
    'shift+right': s.multipleSelectNext,
    'shift+left': s.multipleSelectPrev,
    'mod+up': s.modUpHandler,
    'mod+down': s.modDownHandler,
    'mod+left': s.modLeftHandler,
    'mod+right': s.modRightHandler,
    'mod+shift+up': s.modShiftUpHandler,
    'mod+shift+down': s.modShiftDownHandler,
    'mod+shift+left': s.modShiftLeftHandler,
    'mod+shift+right': s.modShiftRightHandler,
    'backspace': s.back,
    'alt+right': s.nextHistory,
    'alt+left': s.prevHistory,
    'mod+s': s.saveHandler,
    '`': s.toggleZoom,
    'mod++': s.zoomIn,
    'mod+-': s.zoomOut,
    'tab': s.toggleAll,
    'alt+up': s.openParentFolder,
    'alt+shift+n': s.createTxtFileFromTemplate,
    'alt+shift+c': s.setFolderCover,
    'enter': s.toggleDetailMode,
    'del': s.removeSelected,
  };

  // 合併硬編碼快捷鍵（如果沒有被 preferences 覆蓋）
  for (const [key, handler] of Object.entries(hardcodedShortcuts)) {
    if (!bindings[key]) {
      bindings[key] = handler;
    }
  }

  // 處理 'mod+plus' 的特殊情況（確保 + 號的快捷鍵都能正常工作）
  if (bindings['mod+='] && !bindings['mod+plus']) {
    bindings['mod+plus'] = bindings['mod+='];
  }

  console.log('[App] Total mousetrap bindings:', Object.keys(bindings).length);
  return bindings;
}

/* destoryMousetrap（bundle 49316-49325 逐字；destory 原码 typo 逐字保留） */
export function machineryDestoryMousetrap(s: any): void {
  const w = window as any;
  if (!s.mousetrap) return;

  for (var key in s.mousetrap) {
    if (s.mousetrap.hasOwnProperty(key)) {
      w.Mousetrap.unbind(key);
    }
  }
}

/* initMousetrap（bundle 49326-49330 逐字） */
export function machineryInitMousetrap(s: any): void {
  machineryDestoryMousetrap(s);
  s.mousetrap = machineryBuildMousetrap(s);
}

/* ── c17b：notify（cgNotify 服务等价移植）────────────────────────────── */

// ── c17b 域内自管（cgNotify 闭包状态 f/g/h/l/m/n + undoTimeout 20255 邻域）──
const cgStack: any[] = [];        // m：已附加的消息元素栈
const cgScopes: any[] = [];       // n：scope 桩栈
const CG_START_TOP = 10;          // f
const CG_SPACING = 15;            // g
let undoTimeout: any = null;

/* angular-notify.html 模板（bundle 16724 templateCache 逐字；ng-class/ng-style/ng-show/
   ng-click 以具体值物化） */
function cgBuildTemplate(position: string, classes: string, centerMargin: string | null, message: string, messageTemplate: string | undefined, onClose: () => void): string {
  const posClass = position === 'center' ? 'cg-notify-message-center' : (position === 'left' ? 'cg-notify-message-left' : (position === 'right' ? 'cg-notify-message-right' : ''));
  const ngClass = `[${classes ? `'${classes}', ` : ''}'${posClass}']`.replace(/'/g, '"');
  const styleAttr = centerMargin !== null ? ` style="margin-left: ${centerMargin};"` : '';
  const messageDiv = messageTemplate !== undefined
    ? `    <div style="display: none;">\n    </div>\n\n    <div class="cg-notify-message-template">\n    </div>`
    : `    <div>\n        ${message}\n    </div>\n\n    <div style="display: none;" class="cg-notify-message-template">\n        \n    </div>`;
  return `<div class="${[classes, posClass].filter(Boolean).join(' ')}"${styleAttr}>` +
    messageDiv +
    `    <button type="button" class="cg-notify-close">` +
    `        <span aria-hidden="true">&times;</span>` +
    `        <span class="cg-notify-sr-only">Close</span>` +
    `    </button>` +
    `</div>`;
}

/* cgNotify restack（bundle 16724 内 i() 逐字：startTop 10 / spacing 15 / closing +20） */
function cgRestack(): void {
  let b = CG_START_TOP;
  for (let c = cgStack.length - 1; c >= 0; c--) {
    const d = 10;
    const e = cgStack[c];
    const h = e[0].offsetHeight;
    let i = b + h + d;
    if (e.attr('data-closing')) i += 20; else b += h + CG_SPACING;
    e.css('top', i + 'px').css('margin-top', '-' + (h + d) + 'px').css('visibility', 'visible');
  }
}

/* notify（$rootScope.notify 20157-20191 + cgNotify 服务核心 16724 等价移植。
   ng-click="closeAll();undo();" 以委托 click 复刻（undo = $rootScope.undo 桩，duration+5000
   后置空，undoTimeout 域内自管）；templateUrl '' → bundle 走 $http 缓存缺省模板，本移植直接
   物化同一模板 DOM） */
export function machineryNotify(s: any, params: any, restoreCallbackk: any): void {
  const w = window as any;
  const $timeout = getTimeout();

  if (!params.message) return;

  const i18nUndo = getFilter()('i18n')("notify.button.undo");
  let messageTemplate = `<span><icon class="${params.status || ''}"></icon>` + params.message;
  if (restoreCallbackk) {
    messageTemplate = messageTemplate + ' <a style="margin-left: 10px;" data-cg-undo="true">' + i18nUndo + '</a></span>';
  } else {
    messageTemplate = messageTemplate + '</span>';
  }

  cgNotifyServiceCloseAll();

  $timeout(function () {
    var duration = params.duration || 4000;

    // ── cgNotify 服务核心（16724 逐字语义）──
    const message = params.message;
    const classes = params.classes || '';
    const position = params.position || 'center';
    const useTemplate = true; // $rootScope.notify 恒传 messageTemplate

    const element = w.$(cgBuildTemplate(position, classes, null, message, messageTemplate, () => { }));
    // undo 锚点：ng-click="closeAll();undo();" 等价委托
    element.on('click', '[data-cg-undo]', function () {
      cgNotifyServiceCloseAll();
      const undo = s.$root.undo;
      if (typeof undo === 'function') undo();
    });
    // 关闭按钮：ng-click="$close()" 等价委托
    element.on('click', '.cg-notify-close', function () {
      element.css('opacity', 0).attr('data-closing', 'true');
      cgRestack();
    });
    // transitionend（opacity）→ remove + 出栈 + restack（bundle 16724 同语义）
    element.bind('webkitTransitionEnd oTransitionEnd otransitionend transitionend msTransitionEnd', function (a: any) {
      if (('opacity' === a.propertyName || 0 === a.currentTarget.style.opacity || (a.originalEvent && 'opacity' === a.originalEvent.propertyName))) {
        element.remove();
        const mi = cgStack.indexOf(element);
        if (mi > -1) cgStack.splice(mi, 1);
        cgRestack();
      }
    });
    // messageTemplate 注入 .cg-notify-message-template
    element.find('.cg-notify-message-template').append(w.$('<span>').html(messageTemplate).contents());
    w.$(document.body).append(element);
    cgStack.push(element);
    if (position === 'center') {
      $timeout(function () {
        element.css('margin-left', '-' + element[0].offsetWidth / 2 + 'px');
      });
    }
    const closeSelf = function () {
      element.css('opacity', 0).attr('data-closing', 'true');
      cgRestack();
    };
    $timeout(function () { cgRestack(); });
    if (params.duration !== 0 && (params.duration || 10000) > 0) {
      $timeout(closeSelf, params.duration || 10000);
    }

    if (restoreCallbackk) {
      s.$root.undo = restoreCallbackk;
    } else {
      s.$root.undo = function () { };
    }
    // 如果使用者超過時間沒有點擊反悔，就把 callback 移除，避免發生錯亂
    clearTimeout(undoTimeout);
    undoTimeout = setTimeout(function () {
      s.$root.undo = function () { };
    }, duration + 5000);

  }, 10);
}

/* cgNotify closeAll（bundle 16724 o.closeAll 逐字：全栈 opacity 0） */
function cgNotifyServiceCloseAll(): void {
  for (let a = cgStack.length - 1; a >= 0; a--) {
    cgStack[a].css('opacity', 0);
  }
}

/* ── c18a：smartZoom/lastZoom（详情智能缩放）──────────────────────────── */

/* lastZoom（bundle 31288-31305 逐字；lastItemStates 经 scope 解析） */
export function machineryLastZoom(s: any): boolean {
  const w = window as any;
  if (s.lastZoomMode === "edge") return false;
  if (s.$root.preferences.habits.rememberLastZoom === "off") return false;
  if (!s.current) return false;
  if (s.isInlineMode) return false;
  var state = s.lastItemStates[s.current.id];
  if (state && state.data && state.data.tX !== undefined) {
    w.$("#detail-container").smoothZoom('goTo', state.data.tX, state.data.tY, state.data.rA);
    var ratio = parseInt(state.data.rA * 100 as any);
    s.imageSize.zoomRatio = machineryGetRatioNonExp(ratio);
    s.imageSize.zoomRatioExp = ratio;
    return true;
  }
  return false;
}

/* smartZoom（bundle 31209-31334 逐字；devicesMetrics/isMobileResolution/getImagePixelDensity/
   isMobileWidth 经 window（c18a 供给），zoomRatio 换算走 machinery 版） */
export function machinerySmartZoom(s: any, target: any, forceMode: any): void {
  const w = window as any;
  var current = target || s.current;
  var ratio = s.imageSize.zoomRatio || 100;
  var lastRatio = ratio;
  var $container = w.$(".content-panel");
  var toolbarHeight = 0;
  var containerWidth;
  var containerHeight;
  var offsetY = 0;

  if (s.isSlideshowMode) {
    toolbarHeight = 0;
    containerWidth = w.$(window).width();
    containerHeight = w.$(window).height() - toolbarHeight;
  }
  else if (s.isInlineMode) {
    toolbarHeight = 96;
    containerWidth = w.$(window).width();
    containerHeight = $container.height() - toolbarHeight;
  }
  else {
    toolbarHeight = 48;
    containerWidth = $container.width();
    containerHeight = $container.height() - toolbarHeight;
  }

  if (!current) return;

  w.$("#detail-image").css({
    "transform": `rotate(0deg)`,
    "transition": "none"
  });

  // 不使用智能縮放
  if (s.$root.preferences.habits.defaultRatio != "auto" && !forceMode) {
    ratio = 100;
    offsetY = toolbarHeight / 2 * 100 / ratio;
  }
  // 使用智能縮放
  else {
    if (
      (current.width >= 960 && current.width * 1.8 < current.height) ||
      (current.width >= 320 && current.width * 2.7 < current.height)
    ) {
      ratio = parseInt((containerWidth - 0) / current.width * 100 as any);
      if (ratio > 100) {
        ratio = 100;
      }
      if (current.height > $container.height()) {
        offsetY = toolbarHeight / 2 * 100 / ratio;
        offsetY += (current.height - containerHeight * 100 / ratio) / -2;
      }
      else {
        offsetY = toolbarHeight / 2 * 100 / ratio;
      }
    }
    else {
      if (current.height + toolbarHeight / 2 > containerHeight || current.width + toolbarHeight / 2 > containerWidth) {
        var a = parseInt((containerHeight) / current.height * 100 as any);
        var b = parseInt((containerWidth) / current.width * 100 as any);
        ratio = Math.min(a, b);
      }
      else {
        ratio = 100;
      }
      offsetY = toolbarHeight / 2 * 100 / ratio;
    }

    // 如果是手机尺寸并且尺寸符合画面大小
    if (w.getImagePixelDensity(current) !== 100) {
      var mr = w.getImagePixelDensity(current);
      var largeThanCotainer = current.width * mr / 100 > containerWidth || current.height * mr / 100 > containerHeight;
      if (!largeThanCotainer) {
        ratio = mr;
        offsetY = toolbarHeight / 2 * 100 / ratio;
      }
      else {
        var wr = mr / ((current.width * mr / 100) / containerWidth);
        var hr = mr / ((current.height * mr / 100) / containerHeight);
        ratio = Math.min(wr, hr);
        offsetY = toolbarHeight / 2 * 100 / ratio;
      }
    }
    else if (w.isMobileResolution(current.width, current.height)) {
      var mr2 = 100 * w.isMobileResolution(current.width, current.height) / current.height;
      var largeThanCotainer2 = current.width * mr2 / 100 > containerWidth || current.height * mr2 / 100 > containerHeight;
      if (!largeThanCotainer2) {
        ratio = mr2;
        offsetY = toolbarHeight / 2 * 100 / ratio;
      }
      else {
        var wr2 = mr2 / ((current.width * mr2 / 100) / containerWidth);
        var hr2 = mr2 / ((current.height * mr2 / 100) / containerHeight);
        ratio = Math.min(wr2, hr2);
        offsetY = toolbarHeight / 2 * 100 / ratio;
      }
    }
    else if (w.isMobileWidth(current.width) && current.width * 2.4 < current.height) {
      ratio = w.isMobileWidth(current.width) / current.width * 100;
      if (ratio > 100) {
        ratio = 100;
      }
      if (current.height > $container.height()) {
        offsetY = (current.height - $container.height() * 100 / ratio) / -2;
        offsetY = toolbarHeight / 2 * 100 / ratio;
      }
    }
  }

  var $detailContainer = w.$("#detail-container");
  var width = $detailContainer.width();
  var height = current && current.height || $detailContainer.height();

  offsetY = offsetY || 0;

  if (ratio) {
    s.imageSize.zoomRatio = machineryGetRatioNonExp(ratio);
    s.imageSize.zoomRatioExp = machineryGetRatioExp(s.imageSize.zoomRatio);
  }
  s.showLargeImage = true;
  $detailContainer.smoothZoom('focusTo', {
    x: width / 2,
    y: height / 2 + offsetY,
    zoom: s.imageSize.zoomRatio,
    speed: 0
  });
}

/* ── c18b：详情缩放余部（zoomActual/toggleZoom/zoomFitEdge/updateContainerHieght）── */

/* zoomActual（bundle 33915-33937 逐字） */
export function machineryZoomActual(s: any, event: any): void {
  const w = window as any;
  event && event.preventDefault && event.preventDefault();
  if (!s.isDetailMode) {
    s.imageSize.height = 150;
    s.changeListHeight();
    if (s.layout === "GridLayout" || s.layout === "SquareLayout") {
      s.adjustLayoutWidth(0);
      machinerySaveListHeight(s, s.imageSize.height);
    }
  } else {
    s.imageSize.zoomRatio = 100;
    s.imageSize.zoomRatioExp = s.getRatioExp(s.imageSize.zoomRatio);
    s.updateZoomRatio(100, undefined, undefined, true);

    // 如果是視頻格式，尽可能使用视频原来尺寸
    var mpvPlayer = w.$(".detail-wrap mpv-video")[0];
    if (mpvPlayer) {
      mpvPlayer.scaleMode = 'original';
    }
    else {
      var $video = w.$(".detail-wrap video");
      if ($video.length > 0) {
        var vW = $video[0].videoWidth;
        var vH = $video[0].videoHeight;
        $video.css({
          'max-width': `${vW}px !important`,
          'max-height': `${vH}px !important`,
        });
        $video.addClass("fit");
      }
    }
  }
}

/* toggleZoom（bundle 33990-34012 逐字） */
export function machineryToggleZoom(s: any, event: any): void {
  const w = window as any;
  if (!s.isDetailMode) return;
  if (s.VIDEO_TYPES[s.current.ext]) {
    if (s.lastZoomMode !== "edge") {
      s.zoomFit(event);
      s.lastZoomMode = "edge";
      s.zoomFitSize = s.imageSize.zoomRatioExp;
    }
    else {
      s.zoomActual(event);
      s.lastZoomMode = "fit";
      s.zoomFitSize = 0;
    }
  }
  else {
    if (s.lastZoomMode !== "edge") {
      s.zoomFitEdge(event, true);
      s.lastZoomMode = "edge";
    }
    else {
      s.zoomFit(event);
      s.lastZoomMode = "fit";
    }
  }
  localStorage["eagle.viewer.lastZoomMode"] = s.lastZoomMode;
}

/* zoomFitEdge（bundle 34015-34077 逐字） */
export function machineryZoomFitEdge(s: any, event: any, hasTransition: any): void {
  const w = window as any;
  event && event.preventDefault && event.preventDefault();

  if (hasTransition) {
    w.$("#detail-container").addClass("zooming");
    setTimeout(function () {
      w.$("#detail-container").removeClass("zooming");
    }, 300);
  }

  var current = s.current;
  var ratio = s.imageSize.zoomRatio || 100;
  var lastRatio = ratio;
  var $container = w.$(".content-panel");
  var toolbarHeight = 40;
  var containerWidth;
  var containerHeight;
  var offsetY = 0;

  if (s.isSlideshowMode) {
    toolbarHeight = 0;
    containerWidth = w.$(window).width();
    containerHeight = w.$(window).height() - toolbarHeight;
  }
  else if (s.isInlineMode) {
    toolbarHeight = 96;
    containerWidth = w.$(window).width();
    containerHeight = $container.height() - toolbarHeight;
  }
  else {
    toolbarHeight = 48;
    containerWidth = $container.width();
    containerHeight = $container.height() - toolbarHeight;
  }

  var a = parseInt((containerHeight) / current.height * 100 as any);
  var b = parseInt((containerWidth) / current.width * 100 as any);
  ratio = Math.min(a, b);
  offsetY = toolbarHeight / 2 * 100 / ratio;

  if (!current) return;

  w.$("#detail-image").css({
    "transform": `rotate(0deg)`,
    "transition": "none"
  });

  var $detailContainer = w.$("#detail-container");
  var width = $detailContainer.width();
  var height = current && current.height || $detailContainer.height();

  offsetY = offsetY || 0;

  if (ratio) {
    s.imageSize.zoomRatio = machineryGetRatioNonExp(ratio);
    s.imageSize.zoomRatioExp = ratio;
    s.zoomFitSize = ratio;
  }
  s.showLargeImage = true;
  $detailContainer.smoothZoom('focusTo', {
    x: width / 2,
    y: height / 2 + offsetY,
    zoom: parseInt(ratio),
    speed: 0
  });
}

/* updateContainerHieght（bundle 34078-34119 逐字；typo 逐字保留） */
export function machineryUpdateContainerHieght(s: any, hasAnimation: any, delay: any = 1): void {
  const w = window as any;
  let duration = 170;
  if (!hasAnimation) duration = 1;
  setTimeout(() => {
    if (w.eagle.filter.isOpen) {
      var $filterBar = w.$("#filter-toolbar");
      var height = $filterBar.outerHeight();
      w.$("#box-container").css({
        "padding-bottom": height,
        "height": `calc(100% - ${48 + height}px)`
      });
      w.$("#box-container-scrollbar").css({
        "top": 48 + height,
      });
      w.$("#box-container").css({
        "margin-top": height,
      });
    }
    else {
      w.$("#box-container").css({
        "padding-bottom": 0,
        "height": `calc(100% - 48px)`
      });
      w.$("#box-container-scrollbar").css({
        "top": 48,
      });
      w.$("#box-container").css({
        "margin-top": 0,
      });
    }
  }, delay);
}

/* ── c18c：历史导航/撤销 ─────────────────────────────────────────────── */

/* undo（bundle 26999-27002 逐字；$rootScope.undo 桩 + closeAll——root 上无 closeAll 时
   走 cg 栈清屏等价） */
export function machineryUndo(s: any): void {
  if (typeof s.$root.undo === 'function') s.$root.undo();
  if (typeof s.$root.closeAll === 'function') s.$root.closeAll();
  else cgNotifyServiceCloseAll();
}

/* nextHistory/prevHistory（bundle 38566-38577 逐字；UrlStateService.canGo* 方法存在性
   判定原样保留，goForward/goBack 经 currentWindow） */
export function machineryNextHistory(s: any): void {
  const w = window as any;
  if (s.UrlStateService.canGoForward) {
    w.currentWindow.webContents.goForward();
  }
}

export function machineryPrevHistory(s: any): void {
  const w = window as any;
  if (s.UrlStateService.canGoBack) {
    w.currentWindow.webContents.goBack();
  }
}

/* back（bundle 30889-30896 逐字） */
export function machineryBack(s: any): void {
  if (!s.isDetailMode) {
    s.prevHistory();
  }
  else {
    s.leaveDetailMode();
  }
}

/* ── c18d：全选/详情切换 ─────────────────────────────────────────────── */

// ── c18d 域内自管（原 controller 闭包 var：cleanSelectedTimeout，46644 邻域）──
let cleanSelectedTimeout: any = null;

/* selectAll（bundle 46628-46645 逐字） */
export function machinerySelectAll(s: any, event: any): void {
  const $timeout = getTimeout();
  event && event.stopPropagation();
  if (s.viewMode == 'alltags') {
    s.selectedTags = {};
    s.TagManager.tagsResult.tags.forEach((tagName: any) => {
      s.selectedTags[tagName] = true;
    });
  }
  else {
    var selected: any[] = [];
    Array.prototype.push.apply(selected, s.allData);
    s.selected = selected;
    s.selectedMappings = {};
    $timeout.cancel(cleanSelectedTimeout);
    s.$root.currentFocus = "content";
  }
}

/* toggleDetailMode（bundle 31005-31029 逐字；saveCrop/renameCurrentFolder/openFolder
   经 scope 解析） */
export function machineryToggleDetailMode(s: any, $event: any, isInline: any): void {
  const w = window as any;
  if (w.$(".swal2-container").length > 0) return;
  if (s.isCropMode) {
    s.saveCrop();
    return;
  }
  if (isInline !== undefined) {
    s.isInlineMode = !!isInline;
    if (s.isInlineMode) {
      s.isCommentMode = false;
    }
  }
  if (s.$root.currentFocus == "sidebar" || s.$root.currentFocus == "tags") {
    s.renameCurrentFolder($event);
  }
  else {
    if (s.selectedFolderMappings && Object.keys(s.selectedFolderMappings).length >= 1) {
      var folderId = Object.keys(s.selectedFolderMappings)[0];
      if (s.folderMappings[folderId]) {
        s.openFolder(s.folderMappings[folderId]);
      }
    }
    else {
      if (s.isDetailMode) {
        s.leaveDetailMode($event);
      }
      else {
        s.enterDetailMode($event, null);
      }
    }
  }
}

/* ── c18e-1：选择导航（selectNext/selectPrev）────────────────────────── */

// ── c18e-1 域内自管（原 controller 闭包 var：nextTimeout 36419 邻域 / prevTimeout 36536 邻域）──
let nextTimeout: any = null;
let prevTimeout: any = null;

/* selectNext（bundle 36382-36444 逐字；getSelection/lastZoom 已 machinery 版经 scope 解析，
   autoScroll/forceFitImageSize/preloadImage/addToRecentFile 为 bundle scope 函数经 scope 解析） */
export function machinerySelectNext(s: any, event: any): void {
  const w = window as any;
  const $timeout = getTimeout();
  if (s.isCropMode) {
    s.$root.$broadcast("MOVE-CROP-TOOL", { horizontal: 1, vertical: 0 });
    return;
  }

  var selection = s.getSelection();
  var start = selection.start;
  var end = selection.end + 1;

  if (s.isDetailMode) {
    s.rememberScrollTops(s.current);
  }

  if (!s.allData[end]) {
    w.$("#is-last-item").show();
    setTimeout(() => { w.$("#is-last-item").hide(); }, 500);
    return;
  }
  else {
    w.$("#detail-container").smoothZoom('cleanBitmapViewer');
  }

  s.selected = [s.allData[end]];
  s.selectedFolderMappings = {};
  s.$root.currentFocus = "content";

  if (s.isDetailMode) {
    $timeout.cancel(nextTimeout);
    s.forceFitImageSize(s.selected[0], true);
    s.current = s.selected[0];
    s.isGifReady = false;
  }

  s.autoScroll(end);

  if (s.current) {
    w.$("#detail-container").smoothZoom('updateNavigator', s.current);
    if (!s.lastZoom()) {
      s.zoom();
    }
    nextTimeout = $timeout(function () {
      if (!s.lastZoom()) {
        s.zoom();
      }
      var nextImage = s.allData[end + 1];
      s.preloadImage("next");
    }, 100);
    s.addToRecentFile(s.current);
  }
}

/* selectPrev（bundle 36502-36552 逐字；首项 is-first-item 提示 + allData 空守卫 +
   详情模式 cleanBitmapViewer + start-1 越界回落 allData[0]） */
export function machinerySelectPrev(s: any, event: any): void {
  const w = window as any;
  const $timeout = getTimeout();
  if (s.isCropMode) {
    s.$root.$broadcast("MOVE-CROP-TOOL", { horizontal: -1, vertical: 0 });
    return;
  }

  var selection = s.getSelection();
  var start = selection.start;
  var end = selection.end + 1;

  if (start === 0) {
    w.$("#is-first-item").show();
    setTimeout(() => { w.$("#is-first-item").hide(); }, 500);
    return;
  }
  if (s.allData.length == 0) { return; }

  if (s.isDetailMode) {
    w.$("#detail-container").smoothZoom('cleanBitmapViewer');
    s.rememberScrollTops(s.current);
    s.isGifReady = false;
  }

  if (s.allData[start - 1]) {
    s.selected = [];
    s.selected.push(s.allData[start - 1]);
    if (s.isDetailMode) {
      s.forceFitImageSize(s.selected[0], true);
      s.current = s.selected[0];
    }
    s.autoScroll(start - 1);
  } else {
    s.selected = [];
    s.selected.push(s.allData[0]);
    s.forceFitImageSize(s.selected[0], true);
    s.current = s.selected[0];
    s.autoScroll(0);
  }
  s.selectedFolderMappings = {};
  s.$root.currentFocus = "content";
  if (s.current) {
    w.$("#detail-container").smoothZoom('updateNavigator', s.current);
    if (!s.lastZoom()) {
      s.zoom();
    }
    $timeout.cancel(prevTimeout);
    prevTimeout = $timeout(function () {
      if (!s.lastZoom()) {
        s.zoom();
      }
      s.preloadImage("prev");
    }, 100);
    s.addToRecentFile(s.current);
  }
}

/* ── c18e-2：多选系（multipleSelect 四件套）──────────────────────────── */

/* multipleSelectUp（bundle 35898-35906 逐字：ListLayout 委派 multipleSelectPrev） */
export function machineryMultipleSelectUp(s: any, event: any): void {
  if (s.isCropMode) {
    s.$root.$broadcast("MOVE-CROP-TOOL", { horizontal: 0, vertical: -10 });
    return;
  }
  if (s.layout === "ListLayout") {
    s.multipleSelectPrev(event);
  }
}

/* multipleSelectDown（bundle 35964-35972 逐字：ListLayout 委派 multipleSelectNext） */
export function machineryMultipleSelectDown(s: any, event: any): void {
  if (s.isCropMode) {
    s.$root.$broadcast("MOVE-CROP-TOOL", { horizontal: 0, vertical: 10 });
    return;
  }
  if (s.layout === "ListLayout") {
    s.multipleSelectNext(event);
  }
}

/* multipleSelectNext（bundle 36559-36585 逐字：sidebar 焦点守卫 + 详情模式跳过 +
   start < lastSelectedIndex 时收缩选区否则扩展 + autoScroll 经 scope） */
export function machineryMultipleSelectNext(s: any, event: any): void {
  if (s.$root.currentFocus == 'sidebar') return;
  if (s.isCropMode) {
    s.$root.$broadcast("MOVE-CROP-TOOL", { horizontal: 10, vertical: 0 });
    return;
  }
  if (s.isDetailMode) return;
  var selection = s.getSelection();
  var start = selection.start;
  var end = selection.end + 1;

  if (start < s.lastSelectedIndex) {
    let startItem = s.allData[start];
    let idx = s.selected.indexOf(startItem);
    if (idx !== -1) {
      s.selected.splice(idx, 1);
      s.autoScroll(s.lastSelectedIndex);
    }
  }
  else {
    if (s.allData[end]) {
      s.selected.push(s.allData[end]);
      s.autoScroll(end);
    }
  }
}

/* multipleSelectPrev（bundle 36586-36613 逐字：end > lastSelectedIndex 时收缩否则
   向 start-1 扩展） */
export function machineryMultipleSelectPrev(s: any, event: any): void {
  if (s.$root.currentFocus == 'sidebar') return;
  if (s.isCropMode) {
    s.$root.$broadcast("MOVE-CROP-TOOL", { horizontal: -10, vertical: 0 });
    return;
  }
  if (s.isDetailMode) return;
  var selection = s.getSelection();
  var start = selection.start;
  var end = selection.end;

  if (end > s.lastSelectedIndex) {
    let endItem = s.allData[end];
    let idx = s.selected.indexOf(endItem);
    if (idx !== -1) {
      s.selected.splice(idx, 1);
      s.autoScroll(s.lastSelectedIndex);
    }
  }
  else {
    if (s.allData[start - 1]) {
      s.selected.push(s.allData[start - 1]);
      s.autoScroll(start - 1);
    }
  }
}

/* ── c18e-2b：removeSelected（46118-46343）───────────────────────────── */

// ── c18e-2b 域内自管（原 controller 闭包 var：lastMoveToTrashCheckbox 46118）──
let lastMoveToTrashCheckbox: any = 1;

/* removeSelected（bundle 46119-46343 逐字；removeSelectedFolders/removeFolder/
   removeFolderContents/checkOperationSafety/removePermanently/resetFolderCover/
   updateFilterCounts/getSelectedItemElements/updateSelection 等 bundle scope 函数经
   scope 解析；TagManager 经 scope 字段（48351）；$filter('i18n') 走 getFilter()；
   swal/i18n/ScrollbarSaver/ayncsImagesChange/hiddenByCurrentFilter/electronLog 经 window） */
export function machineryRemoveSelected(s: any, event: any): void {
  const w = window as any;
  const $timeout = getTimeout();
  event?.preventDefault();
  event?.stopPropagation();

  if (s.$root.currentFocus == 'sidebar') {
    if (s.$root.selectedFolders.length > 0) {
      s.removeSelectedFolders();
    }
    else if (s.$root.selectedSmartFolders.length > 0) {
      s.removeSelectedSmartFolders();
    }
    else if (s.currentFolder) {
      s.removeFolder(s.currentFolder);
    } else if (s.currentSmartFolder) {
      s.removeSmartFolder(s.currentSmartFolder);
    }
  }
  else if (s.$root.currentFocus == 'tags') {
    if (s.currentTagGroup) {
      s.removeTagGroup(s.currentTagGroup);
    }
  }
  else if (s.selectedFolderMappings && Object.keys(s.selectedFolderMappings).length > 0) {
    var selectedFolders = Object.keys(s.selectedFolderMappings).map(function (key: any) {
      return key;
    });
    var folderId = selectedFolders[0];
    if (folderId && s.folderMappings[folderId]) {
      s.removeFolder(s.folderMappings[folderId], {
        ignoreSelectNext: true
      });
    }
  }
  else if (s.viewMode === 'alltags' && s.currentTagGroup) {
    var selectedTags = s.getSelectedTags();
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
        s.$evalAsync(function () {
          s.removePermanently();
        });
      });
    }
    else {
      s.checkOperationSafety(function () {
        s.lastIndex = s.getSelection().start;

        if (s.currentFolder) {

          // 强制重置该文件夹及祖先封面
          s.resetFolderCover(s.currentFolder);

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
              s.removeFolderContents({ isForceToTrash: isForceToTrash });
              s.$evalAsync();
            }, function () { });
          }
          else {
            s.removeFolderContents({ isForceToTrash: true });
          }
        } else if (s.currentTag || s.currentSmartFolder || s.viewMode === 'all' || s.viewMode === 'unfiled' || s.viewMode === 'untagged' || s.viewMode === 'recent' || s.viewMode === 'random') {

          var origin: any[] = [];
          let now = Date.now();
          s.selected.forEach(function (image: any) {
            image.isDeleted = true;
            image.deletedTime = Date.now();
            origin.push(image);
            s.updateFilterCounts(image, -1, now);
          });

          var message = getFilter()('i18n')("notify.image.remove", [
            { "property": "count", "value": s.selected.length },
          ]);
          if (s.selected.length === 1) { message = message.replace("images", "image"); }

          s.$root.notify({
            message: message,
            duration: 4000,
          }, function () {
            let now = Date.now();
            origin.forEach(function (image: any) {
              image.isDeleted = false;
              delete image.deletedTime;
              s.updateFilterCounts(image, 1, now);
            });
            s.selected = origin;
            if (s.isDetailMode) {
              s.current = origin[0];
            }
            s.calculateImageBinding({ ignoreSort: true }, function () {
              if (
                s.viewMode !== 'random'
              ) {
                s.rebindRefresh();
              }
              w.ScrollbarSaver.restoreScrollPosition();
            });
            w.ayncsImagesChange(origin);
            w.hiddenByCurrentFilter(origin);
          });

          if (s.isDetailMode) {
            $timeout(function () {
              s.zoom();
            }, 100)
          }

          if (s.$root.preferences.notification.soundEffect.enable != 'false' && s.$root.preferences.notification.soundEffect.when.deleteImage == 'true') {
            s.removeSound.play();
          }
          w.ayncsImagesChange(s.selected);
          w.hiddenByCurrentFilter(s.selected);

          // 自動選取下一個圖片，如果沒有下一個，選上一個，都沒有就空
          s.lastIndex = s.getSelection().start;
          var next = s.allData[s.lastIndex + s.selected.length];
          var prev = s.allData[s.lastIndex - 1];

          if (next) {
            s.selected = [next];
            if (s.isDetailMode) {
              s.current = next;
            }
          } else if (prev) {
            s.selected = [prev];
            if (s.isDetailMode) {
              s.current = prev;
            }
          } else {
            s.selected = [];
            if (s.isDetailMode) {
              s.leaveDetailMode();
            }
          }

          $timeout(function () {
            s.forceFitImageSize(s.current);
            s.zoom();
          }, 100);

          w.ScrollbarSaver.saveScrollPosition();

          var itemElements = s.getSelectedItemElements();
          s.$root.$broadcast("gl:removeItems", itemElements);

          s.lastSelectedIndex = s.currentIndex() - 1;
          s.autoScroll();

          s.calculateImageBinding({ ignoreSort: true }, function () {
            if (
              s.viewMode !== 'random' ||
              (s.currentFolder && s.currentFolder.orderBy !== "RANDOM")
            ) {
              s.rebindRefresh(true);
            }
            s.updateSelection();
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

/* ── c18e-3：quicklook/copyImages ───────────────────────────────────── */

/* quicklook（bundle 33542-33580 逐字；toggleGifPlay/toggleDetailMode/pageDownHandler 经
   scope 解析；IPCHelper 为脚本级词法绑定（c17a if-absent 接装）经 window；analytics 顶层
   var（105501）/process/swal 容器经 window） */
export function machineryQuicklook(s: any, event: any): void {
  const w = window as any;
  if (w.$(".swal2-container").length > 0) {
    return;
  }
  if (s.isCropMode) return;
  event && event.preventDefault();
  // if ($scope.isDetailMode && !$scope.isInlineMode && VIDEO_TYPES[$scope.current.ext]) {
  //     $scope.toggleVideoPlay();
  // }
  // else if ($scope.isDetailMode && !$scope.isInlineMode && AUDIO_TYPES[$scope.current.ext]) {
  //     $scope.toggleVideoPlay();
  // }
  // else
  if (s.isDetailMode && !s.isInlineMode && (s.current.ext == 'gif')) {
    s.toggleGifPlay();
  }
  else {
    // 如果用户设定是预览
    if (s.$root.preferences.habits.keyspace === "preview") {
      if (s.selected.length > 0) {
        w.$(".content-panel.detail-mode").addClass("inline-mode");
        setTimeout(function () {
          w.$(".content-panel.detail-mode").addClass("open");
        }, 30);
        s.toggleDetailMode(event, true);
        w.analytics.event('QuickLook', 'Open');
      }
    }
    else if (s.$root.preferences.habits.keyspace === "preview-native") {
      if (s.selected.length > 0) {
        if (w.process.platform == 'darwin' && !s.isDetailMode) {
          s.isPreviewing = !s.isPreviewing;
          w.IPCHelper.send('quicklook', s.selected[0]);
        }
      }
    }
    // 如果用户设定是滚动页面
    else {
      s.pageDownHandler(event);
    }
  }
}

/* copyImages（bundle 31747-31795 逐字；clipboard 为 renderer 全局（controllerFns 同款裸引）；
   ipcRenderer 统一表达式；RecentFileManager if-absent 接装经 window；notify 走 machinery 版） */
export function machineryCopyImages(s: any, event: any): void {
  const w = window as any;
  if (s.viewMode === 'alltags') {
    var selectedTags = s.getSelectedTags();
    if (selectedTags && selectedTags.length > 0) {
      w.electron.clipboard.writeText(selectedTags.join(","));
      s.notify({
        message: getFilter()('i18n')("Context.Tag.Copy.Success"),
        duration: 1000
      });
    }
  }
  else {
    if (s.$root.currentFocus == "sidebar") {
      if (s.$root.selectedFolders.length > 0) {
        let copyText = "";
        s.$root.selectedFolders.forEach(function (folder: any, index: any) {
          copyText += folder.name;
          if (index < s.$root.selectedFolders.length - 1) {
            copyText += "\n";
          }
        });
        w.electron.clipboard.writeText(copyText);
      }
      else if (s.$root.selectedSmartFolders.length > 0) {
        let copyText = "";
        s.$root.selectedSmartFolders.forEach(function (folder: any, index: any) {
          copyText += folder.name;
          if (index < s.$root.selectedSmartFolders.length - 1) {
            copyText += "\n";
          }
        });
        w.electron.clipboard.writeText(copyText);
      }
      else if (s.currentSmartFolder) {
        w.electron.clipboard.writeText(s.currentSmartFolder.name);
      }
      else if (s.currentFolder) {
        w.electron.clipboard.writeText(s.currentFolder.name);
      }
    }
    else if (s.selected.length > 0) {
      const ipc = w.__eagleIpc || (w.electron && w.electron.ipcRenderer);
      ipc.sendTo(w.backgroundWindowID, 'copy-images', s.selected);
      w.RecentFileManager.addFiles(s.selected);
      setTimeout(function () {
        s.notify({
          message: getFilter()('i18n')("previewWindow.copied"),
          duration: 1000
        });
      }, 150);
    }
  }
}

/* ── c18e-4：方向键/修饰键 handler 族（第一批）───────────────────────── */

/* keyCHandler（bundle 35099-35103 逐字）、keyPHandler（35104-35106 逐字） */
export function machineryKeyCHandler(s: any, event: any): void {
  if (s.isInlineMode) return;
  if (s.isDetailMode) {
    s.toggleCommentMode(event);
  }
}

export function machineryKeyPHandler(s: any, event: any): void {
  s.openPluginPanel(event);
}

/* keyLeftHandler（bundle 35107-35146 逐字：swal 容器守卫 + content→selectPrev(machinery 版) +
   tags→焦点回落 sidebar + sidebar 文件夹/smart 文件夹折叠（多选折叠与单选展开-折叠分叉），
   localStorage 键逐字） */
export function machineryKeyLeftHandler(s: any, event: any): void {
  const w = window as any;
  event && event.preventDefault();
  if (w.$(".swal2-container").length > 0) return;
  if (s.$root.currentFocus == "content") {
    s.selectPrev(event);
  }
  else if (s.$root.currentFocus == "tags") {
    s.$root.currentFocus = "sidebar";
  }
  else {
    if (s.$root.selectedFolders.length > 1) {
      s.$root.selectedFolders.forEach(function (folder: any) {
        if (folder.children && folder.children.length > 0) {
          if (folder.isExpand !== false) {
            folder.isExpand = false;
            w.localStorage.setItem("eagle.sidebar.folder.expand." + folder.id, false);
          }
        }
      });
      s.updateSidebarList();
    }
    else if (s.currentFolder) {
      if (!s.currentFolder.children || s.currentFolder.children.length == 0) {
        s.currentFolder.isExpand = true;
        s.updateSidebarList();
      }
      else {
        s.currentFolder.isExpand = false;
        s.updateSidebarList();
      }
      w.localStorage.setItem("eagle.sidebar.folder.expand." + s.currentFolder.id, false);
    }
    else if (s.currentSmartFolder) {
      if (!s.currentSmartFolder.children || s.currentSmartFolder.children.length == 0) {
        s.currentSmartFolder.isExpand = true;
        s.updateSidebarList();
      }
      else {
        s.currentSmartFolder.isExpand = false;
        s.updateSidebarList();
      }
      w.localStorage.setItem("eagle.sidebar.smartFolder.expand." + s.currentSmartFolder.id, false);
    }
  }
}

/* keyRightHandler（bundle 35148-35189 逐字：content→selectNext + sidebar 多选展开/单选展开 +
   alltags→焦点 tags，localStorage 键逐字） */
export function machineryKeyRightHandler(s: any, event: any): void {
  const w = window as any;
  event && event.preventDefault();
  if (w.$(".swal2-container").length > 0) return;
  if (s.$root.currentFocus == "content") {
    s.selectNext(event);
  }
  else {
    if (s.$root.selectedFolders.length > 1) {
      s.$root.selectedFolders.forEach(function (folder: any) {
        if (folder.children && folder.children.length > 0) {
          if (folder.isExpand !== true) {
            folder.isExpand = true;
            w.localStorage.setItem("eagle.sidebar.folder.expand." + folder.id, true);
          }
        }
      });
      s.updateSidebarList();
    }
    else if (s.currentFolder) {
      s.currentFolder.isExpand = true;
      s.updateSidebarList();
      w.localStorage.setItem("eagle.sidebar.folder.expand." + s.currentFolder.id, true);
    }
    else if (s.currentSmartFolder) {
      s.currentSmartFolder.isExpand = true;
      s.updateSidebarList();
      w.localStorage.setItem("eagle.sidebar.smartFolder.expand." + s.currentSmartFolder.id, true);
    }
    else if (s.viewMode == "alltags") {
      s.$root.currentFocus = "tags";
    }
  }
}

/* mod 八件套（bundle 35343-35438 逐字：crop 模式→RESIZE-CROP-TOOL 广播（mod 上下 1/
   shift 上下左右 10），否则 mod 上/下委派 homeHandler/endHandler（scope 函数 35636/35650）、
   mod 左/右详情外委派 prevHistory/nextHistory（machinery 版）、modShift 纯 crop 广播） */
export function machineryModUpHandler(s: any, event: any): void {
  if (s.isCropMode) {
    event && event.preventDefault();
    s.$root.$broadcast("RESIZE-CROP-TOOL", {
      horizontal: 0,
      vertical: -1
    });
    return;
  }
  else {
    s.homeHandler(event);
  }
}

export function machineryModDownHandler(s: any, event: any): void {
  if (s.isCropMode) {
    event && event.preventDefault();
    s.$root.$broadcast("RESIZE-CROP-TOOL", {
      horizontal: 0,
      vertical: 1
    });
    return;
  }
  else {
    s.endHandler(event);
  }
}

export function machineryModLeftHandler(s: any, event: any): void {
  event && event.preventDefault();
  if (s.isDetailMode) {
    if (s.isCropMode) {
      s.$root.$broadcast("RESIZE-CROP-TOOL", {
        horizontal: -1,
        vertical: 0
      });
      return;
    }
  }
  else {
    s.prevHistory(event);
  }
}

export function machineryModRightHandler(s: any, event: any): void {
  event && event.preventDefault();
  if (s.isDetailMode) {
    if (s.isCropMode) {
      s.$root.$broadcast("RESIZE-CROP-TOOL", {
        horizontal: 1,
        vertical: 0
      });
      return;
    }
  }
  else {
    s.nextHistory(event);
  }
}

export function machineryModShiftUpHandler(s: any, event: any): void {
  event && event.preventDefault();
  if (s.isCropMode) {
    s.$root.$broadcast("RESIZE-CROP-TOOL", {
      horizontal: 0,
      vertical: -10
    });
    return;
  }
}

export function machineryModShiftDownHandler(s: any, event: any): void {
  event && event.preventDefault();
  if (s.isCropMode) {
    s.$root.$broadcast("RESIZE-CROP-TOOL", {
      horizontal: 0,
      vertical: 10
    });
    return;
  }
}

export function machineryModShiftLeftHandler(s: any, event: any): void {
  event && event.preventDefault();
  if (s.isCropMode) {
    s.$root.$broadcast("RESIZE-CROP-TOOL", {
      horizontal: -10,
      vertical: 0
    });
    return;
  }
}

export function machineryModShiftRightHandler(s: any, event: any): void {
  event && event.preventDefault();
  if (s.isCropMode) {
    s.$root.$broadcast("RESIZE-CROP-TOOL", {
      horizontal: 10,
      vertical: 0
    });
    return;
  }
}

/* ── c18e-5：keyUp/keyDown handler 族（含侧栏导航闭包）───────────────── */

/* 域内闭包移植（原 controller 内 function 声明，非 scope 成员）：
   openPrevQuickAccess（35287-35302）/ openNextQuickAccess（35304-35341）/
   openPrevGroup（35704-35725）/ openNextGroup（35730-35752） */
function machineryOpenPrevQuickAccess(s: any): void {
  const w = window as any;
  var $quickAccessItems = w.$(".sidebar-quick-access-item:visible");
  var $current = w.$(".sidebar-quick-access-item.active");
  var currentIndex = $quickAccessItems.index($current);

  if (currentIndex - 1 >= 0) {
    $quickAccessItems.eq(currentIndex - 1).click();
  }
  else {
    s.openTrash();
  }
}

function machineryOpenNextQuickAccess(s: any): void {
  const w = window as any;
  var $quickAccessItems = w.$(".sidebar-quick-access-item:visible");
  var $current = w.$(".sidebar-quick-access-item.active");
  var currentIndex = $quickAccessItems.index($current);

  if (currentIndex + 1 < $quickAccessItems.length) {
    $quickAccessItems.eq(currentIndex + 1).click();
  }
  else {
    var listItems = s.sidebarList;
    var folders = listItems.filter(function (item: any) {
      return item.vstype === 'folder';
    });
    var smartFolders = listItems.filter(function (item: any) {
      return item.vstype === 'smartFolder' || item.vstype === 'smartFolderGroup';
    });
    if (smartFolders.length > 0 && smartFolders[0]) {
      s.openSmartFolder(smartFolders[0]);
    }
    else if (folders.length > 0 && folders[0]) {
      s.openFolder(folders[0]);
    }
  }
}

function machineryOpenPrevGroup(s: any): void {
  const w = window as any;
  if (s.tagViewMode === "ALL") {
    return;
  }
  else if (s.tagViewMode === "UNFILED") {
    s.openTagAllGroup();
  }
  else if (s.tagViewMode === "STARRED") {
    s.openUnfiledGroup();
  }
  else {
    var $visibleGroups = w.$(".tag-manager-sidebar .group-item:visible");
    var $currentGroup = w.$(".tag-manager-sidebar .group-item.active");
    var currentIndex = $visibleGroups.index($currentGroup);
    if (currentIndex === 0) {
      s.openStarredGroup();
    }
    else if (currentIndex > 0) {
      var prev = s.TagManager.groups[currentIndex - 1];
      if (prev) {
        s.openTagGroup(prev);
      }
    }
  }
}

function machineryOpenNextGroup(s: any): void {
  const w = window as any;
  if (s.tagViewMode === "ALL") {
    s.openUnfiledGroup();
  }
  else if (s.tagViewMode === "UNFILED") {
    s.openStarredGroup();
  }
  else if (s.tagViewMode === "STARRED") {
    if (s.TagManager.groups[0]) {
      s.openTagGroup(s.TagManager.groups[0]);
    }
  }
  else if (s.TagManager.groups.length > 0) {
    var $visibleGroups = w.$(".tag-manager-sidebar .group-item:visible");
    var $currentGroup = w.$(".tag-manager-sidebar .group-item.active");
    var currentIndex = $visibleGroups.index($currentGroup);
    var next = s.TagManager.groups[currentIndex + 1];
    if (next) {
      s.openTagGroup(next);
    }
  }
}

/* keyUpHandler（bundle 35191-35285 逐字：content→crop 广播/moveY -150/selectUp +
   sidebar 清空选择后按 viewMode 七级回落（all 分支为空体、unfiled→openAll、untagged→
   unfiled/all、recent→untagged/unfiled/all、random→recent/untagged/unfiled/all、
   community→random/recent/untagged/unfiled/all、alltags→community/random/recent/untagged/
   unfiled/all 偏好门控、trash→openAllTags）+ currentId 三分（smart-folder/quick/folder，
   注意含 currentId 真值守卫）+ tags→openPrevGroup） */
export function machineryKeyUpHandler(s: any, event: any): void {
  const w = window as any;
  event && event.preventDefault();
  if (w.$(".swal2-container").length > 0) return;
  if (s.$root.currentFocus == "content") {
    if (s.isDetailMode && !s.isInlineMode) {
      if (s.isCropMode) {
        s.$root.$broadcast("MOVE-CROP-TOOL", { horizontal: 0, vertical: -1 });
        return;
      }
      else {
        w.$("#detail-container").smoothZoom('moveY', -150);
      }
    } else {
      s.selectUp(event);
    }
  }
  else if (s.$root.currentFocus == "sidebar") {
    s.$root.selectedFolders = [];
    s.$root.selectedFoldersMappings = {};
    s.$root.selectedSmartFoldersMappings = {};
    s.$root.selectedSmartFolders = [];
    if (s.viewMode == "all") { } else if (s.viewMode == "unfiled") { s.openAll() }
      else if (s.viewMode == "untagged") {
        if (s.$root.preferences.sidebar.unfiled != 'false') {
          s.openUnfiled();
        }
        else {
          s.openAll();
        }
      }
      else if (s.viewMode == "recent") {
        if (s.$root.preferences.sidebar.untagged != 'false') {
          s.openUntagged();
        }
        else if (s.$root.preferences.sidebar.unfiled != 'false') {
          s.openUnfiled();
        }
        else {
          s.openAll();
        }
      }
      else if (s.viewMode == "random") {
        if (s.$root.preferences.sidebar.recent != 'false') {
          s.openRecent();
        }
        else if (s.$root.preferences.sidebar.untagged != 'false') {
          s.openUntagged();
        }
        else if (s.$root.preferences.sidebar.unfiled != 'false') {
          s.openUnfiled();
        }
        else {
          s.openAll();
        }
      }
      else if (s.viewMode == "community") {
        if (s.$root.preferences.sidebar.random != 'false') {
          s.openRandom();
        }
        else if (s.$root.preferences.sidebar.recent != 'false') {
          s.openRecent();
        }
        else if (s.$root.preferences.sidebar.untagged != 'false') {
          s.openUntagged();
        }
        else if (s.$root.preferences.sidebar.unfiled != 'false') {
          s.openUnfiled();
        }
        else {
          s.openAll();
        }
      }
      else if (s.viewMode == "alltags") {
        if (s.$root.preferences.sidebar.community2 != 'false') {
          s.openCommunity();
        }
        else if (s.$root.preferences.sidebar.random != 'false') {
          s.openRandom();
        }
        else if (s.$root.preferences.sidebar.recent != 'false') {
          s.openRecent();
        }
        else if (s.$root.preferences.sidebar.untagged != 'false') {
          s.openUntagged();
        }
        else if (s.$root.preferences.sidebar.unfiled != 'false') {
          s.openUnfiled();
        }
        else {
          s.openAll();
        }
      }
      else if (s.viewMode == "trash") {
        s.openAllTags()
      }
      else {
        if (s.currentId) {
          if (s.currentId.indexOf("smart-folder") > -1) {
            s.openPrevSmartFolder();
          }
          else if (s.currentId.indexOf("quick") > -1) {
            machineryOpenPrevQuickAccess(s);
          }
          else if (s.currentId.indexOf("folder") > -1) {
            s.openPrevFolder();
          }
        }
      }
  }
  else if (s.$root.currentFocus == "tags") {
    machineryOpenPrevGroup(s);
  }
}

/* keyDownHandler（bundle 35440-35610 逐字：content→crop 广播/moveY 150/selectDown +
   sidebar 清空选择后按 viewMode 七级回落（all→unfiled/untagged/recent/random/community/
   allTags、unfiled→untagged/recent/random/community/allTags、untagged→recent/random/
   community/allTags、recent→random/community/allTags、random→community/allTags、
   community→allTags 偏好门控、alltags→openTrash、trash→quickAccess→smartFolders→folders）
   + currentId 三分（**无 currentId 真值守卫，bundle 原样**）+ tags→openNextGroup） */
export function machineryKeyDownHandler(s: any, event: any): void {
  const w = window as any;
  event && event.preventDefault();
  if (w.$(".swal2-container").length > 0) return;
  if (s.$root.currentFocus == "content") {
    if (s.isDetailMode && !s.isInlineMode) {
      if (s.isCropMode) {
        s.$root.$broadcast("MOVE-CROP-TOOL", { horizontal: 0, vertical: 1 });
        return;
      }
      else {
        w.$("#detail-container").smoothZoom('moveY', 150);
      }
    } else {
      s.selectDown(event);
    }
  }
  else if (s.$root.currentFocus == "sidebar") {
    s.$root.selectedFolders = [];
    s.$root.selectedFoldersMappings = {};
    s.$root.selectedSmartFoldersMappings = {};
    s.$root.selectedSmartFolders = [];
    if (s.viewMode == "all") {
      if (s.$root.preferences.sidebar.unfiled != 'false') {
        s.openUnfiled();
      }
      else if (s.$root.preferences.sidebar.untagged != 'false') {
        s.openUntagged();
      }
      else if (s.$root.preferences.sidebar.recent != 'false') {
        s.openRecent();
      }
      else if (s.$root.preferences.sidebar.random != 'false') {
        s.openRandom();
      }
      else if (s.$root.preferences.sidebar.community2 != 'false') {
        s.openCommunity();
      }
      else {
        s.openAllTags();
      }
    }
    else if (s.viewMode == "unfiled") {
      if (s.$root.preferences.sidebar.untagged != 'false') {
        s.openUntagged();
      }
      else if (s.$root.preferences.sidebar.recent != 'false') {
        s.openRecent();
      }
      else if (s.$root.preferences.sidebar.random != 'false') {
        s.openRandom();
      }
      else if (s.$root.preferences.sidebar.community2 != 'false') {
        s.openCommunity();
      }
      else {
        s.openAllTags();
      }
    }
    else if (s.viewMode == "untagged") {
      if (s.$root.preferences.sidebar.recent != 'false') {
        s.openRecent();
      }
      else if (s.$root.preferences.sidebar.random != 'false') {
        s.openRandom();
      }
      else if (s.$root.preferences.sidebar.community2 != 'false') {
        s.openCommunity();
      }
      else {
        s.openAllTags();
      }
    }
    else if (s.viewMode == "recent") {
      if (s.$root.preferences.sidebar.random != 'false') {
        s.openRandom();
      }
      else if (s.$root.preferences.sidebar.community2 != 'false') {
        s.openCommunity();
      }
      else {
        s.openAllTags();
      }
    }
    else if (s.viewMode == "random") {
      if (s.$root.preferences.sidebar.community2 != 'false') {
        s.openCommunity();
      }
      else {
        s.openAllTags();
      }
    }
    else if (s.viewMode == "community") {
      s.openAllTags();
    }
    else if (s.viewMode == "alltags") { s.openTrash() } else if (s.viewMode == "trash") {

      var listItems = s.sidebarList;
      var folders = listItems.filter(function (item: any) {
        return item.vstype === 'folder';
      });
      var smartFolders = listItems.filter(function (item: any) {
        return item.vstype === 'smartFolder' || item.vstype === 'smartFolderGroup';
      });
      var quickAccessItems = listItems.filter(function (item: any) {
        return item.vstype === 'quickAccess';
      });
      if (quickAccessItems.length > 0) {
        w.$("#quick-access-" + quickAccessItems[0].id).click();
      }
      else if (smartFolders.length > 0 && smartFolders[0]) {
        s.openSmartFolder(smartFolders[0]);
      }
      else if (folders.length > 0 && folders[0]) {
        s.openFolder(folders[0]);
      }
    }
    else {
      if (s.currentId.indexOf("smart-folder") > -1) {
        s.openNextSmartFolder();
      }
      else if (s.currentId.indexOf("quick") > -1) {
        machineryOpenNextQuickAccess(s);
      }
      else if (s.currentId.indexOf("folder") > -1) {
        s.openNextFolder();
      }
    }
  }
  else if (s.$root.currentFocus == "tags") {
    machineryOpenNextGroup(s);
  }
}

/* ── c18e-6：selectUp/Down + pageUp/pageDownHandler（滚动翻页面）──────── */

/* getArroundBox（bundle 35091-35097 逐字，controller 闭包） */
function machineryGetArroundBox(s: any, index: any): any {
  const w = window as any;
  var arroundStart = (index - 20 >= 0) ? index - 20 : 0;
  var arroundEnd = (index + 20 > s.allData.length) ? s.allData.length : index + 20;
  var $arround = w.$(".box").slice(arroundStart, arroundEnd);
  return $arround;
}

/* scrollbarTo（bundle 35612-35635 逐字）+ Math.easeInOutQuad（35638-35643 逐字；bundle 于
   controller init 补丁全局 Math，此处同体幂等补丁） */
(Math as any).easeInOutQuad = function (t: any, b: any, c: any, d: any) {
  t /= d / 2;
  if (t < 1) return c / 2 * t * t + b;
  t--;
  return -c / 2 * (t * (t - 2) - 1) + b;
};

function machineryScrollbarTo(element: any, to: any, duration: any): void {
  var start = element.scrollTop,
    change = to - start,
    currentTime = 0,
    increment = 20;

  var animateScroll = function () {
    currentTime += increment;
    var val = (Math as any).easeInOutQuad(currentTime, start, change, duration);
    element.scrollTop = val;
    if (currentTime < duration) {
      setTimeout(animateScroll, increment);
    }
  };
  animateScroll();
}

/* pageDownHandler（bundle 35680-35689 逐字）——_.throttle 实例 apply 时一次性创建
   （与 bundle controller init 同语义），shift+space 绑定消费 */
export function machineryPageDownHandler(s: any): any {
  const w = window as any;
  return w._.throttle(function (event: any) {
    var offset = w.$(window).height() - 72;
    if (s.isDetailMode) {
      w.$("#detail-container").smoothZoom('moveY', offset);
    }
    else {
      var scrollTop = w.$(".box-container").scrollTop();
      machineryScrollbarTo(w.$(".box-container")[0], scrollTop + offset * 1, 100);
    }
  }, 100, true);
}

/* pageUpHandler（bundle 35691-35702 逐字：含 prepend 触发面 ig.trigger("prepend")） */
export function machineryPageUpHandler(s: any): any {
  const w = window as any;
  return w._.throttle(function (event: any) {
    var offset = w.$(window).height() - 72;
    if (s.isDetailMode) {
      w.$("#detail-container").smoothZoom('moveY', -offset);
    }
    else {
      var scrollTop = w.$(".box-container").scrollTop();
      machineryScrollbarTo(w.$(".box-container")[0], scrollTop - offset * 1, 100);
      setTimeout(function () {
        if (s.startCursor !== 0 && w.$("#box-container").scrollTop() === 0) {
          w.ig.trigger("prepend");
        }
      }, 200);
    }
  }, 100, true);
}

/* selectUp（bundle 35840-35906 逐字：GridLayout 同列最近上方盒 / 其他布局上方 20px 外
   最近距离盒，selected 首盒为锚点）+ selectDown（35908-35962 逐字：getArroundBox(end) 邻域 +
   selected 末盒为锚点；**autoScroll(target) 传元素非索引，bundle 怪癖逐字保留**；
   getItemByElement 经 scope 解析） */
export function machinerySelectUp(s: any, event: any): void {
  const w = window as any;
  event && event.preventDefault();

  var selection = s.getSelection();
  var start = selection.start;
  var $box = w.$(".box.selected").eq(0);
  var boxOffest = $box.offset();
  if (!boxOffest) return;
  var boxCenterX = boxOffest.left;
  var boxCenterY = boxOffest.top;
  var target;
  var d = 100000;

  w.$(".box").each(function (this: any, index: any) {
    var $b = w.$(this);
    var offset = $b.offset();
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
      if (boxOffest.top > offset.top && Math.abs(boxOffest.top - offset.top) > 20) {
        if (td2 < d) {
          d = td2;
          target = $b;
        }
      }
    }
  });
  if (target) {
    var image = s.getItemByElement(target[0]);
    s.selected = [image];
    s.selectedFolderMappings = {};
    if (s.isDetailMode) {
      s.current = s.selected[0];
    }
    s.autoScroll(target);
  }
  if (s.isDetailMode) {
    s.forceFitImageSize(s.selected[0], true);
    s.current = s.selected[0];
    s.isGifReady = false;
    w.$("#detail-container").smoothZoom('updateNavigator', s.current);
    if (!s.lastZoom()) {
      s.zoom();
    }
  }
}

export function machinerySelectDown(s: any, event: any): void {
  const w = window as any;
  event && event.preventDefault();
  var selection = s.getSelection();
  var end = selection.end || 0;
  var $arround = machineryGetArroundBox(s, end);
  var $box = w.$(".box.selected").last();
  var boxOffest = $box.offset();
  if (!boxOffest) return;
  var boxCenterX = boxOffest.left;
  var boxCenterY = boxOffest.top;
  var target;
  var d = 100000;
  w.$(".box").each(function (this: any, index: any) {
    var $b = w.$(this);
    var offset = $b.offset();
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
      if (boxOffest.top < offset.top && Math.abs(boxOffest.top - offset.top) > 20) {
        if (td2 < d) {
          d = td2;
          target = $b;
        }
      }
    }
  });
  if (target) {
    var image = s.getItemByElement(target[0]);
    s.selected = [image];
    s.selectedFolderMappings = {};
    if (s.isDetailMode) {
      s.current = s.selected[0];
    }
    s.autoScroll(target);
  }
  if (s.isDetailMode) {
    s.forceFitImageSize(s.selected[0], true);
    s.current = s.selected[0];
    s.isGifReady = false;
    w.$("#detail-container").smoothZoom('updateNavigator', s.current);
    if (!s.lastZoom()) {
      s.zoom();
    }
  }
}

/* ── c18f-1：小 handler 批（评分/视频键/侧栏开关/缩放步进/保存/随机刷新）── */

/* changeTo5Star（bundle 30316-30319 逐字；changeStar 为 bundle scope 函数经 scope 解析） */
export function machineryChangeTo5Star(s: any, event: any): void {
  if (event?.altKey || event?.metaKey || event?.ctrlKey) return;
  s.changeStar(5, true, true);
}

/* closeWindowHandler（bundle 30802-30812 逐字；**bundle 原版怪癖：参数名为 $event 但体内
   引用全局 event——ESM 经 w.event 复刻同语义**（mousetrap 派发期内 window.event 即键盘事件）；
   IPCHelper 脚本级词法绑定（c17a 接装）经 window） */
export function machineryCloseWindowHandler(s: any, $event: any): void {
  const w = window as any;
  if (s.isPreviewing) {
    if (w.process.platform == 'darwin') {
      w.event && w.event.stopPropagation();
      w.event && w.event.preventDefault();
      w.IPCHelper.send('quicklook', s.selected[0]);
      s.isPreviewing = false;
    }
  }
}

/* nHandler（bundle 30813-30824 逐字：详情内视频/音频添加视频评论；VIDEO_TYPES/AUDIO_TYPES
   经 window（Tier-1 TYPES 契约），addVideoComment 经 scope 解析） */
export function machineryNHandler(s: any, $event: any): void {
  const w = window as any;
  if (!s.isDetailMode) {
    return;
  }
  if (w.VIDEO_TYPES[s.current.ext] || w.AUDIO_TYPES[s.current.ext]) {
    var video = w.$(".detail-wrap video")[0] || w.$(".detail-wrap mpv-video")[0];
    if (video) {
      s.addVideoComment(s.current, video);
    }
  }
}

/* mHandler（bundle 30825-30834 逐字：详情内视频/音频静音切换） */
export function machineryMHandler(s: any, $event: any): void {
  const w = window as any;
  if (!s.isDetailMode) {
    return;
  }
  if (w.VIDEO_TYPES[s.current.ext] || w.AUDIO_TYPES[s.current.ext]) {
    w.$(".vjs-mute-control").click();
  }
}

/* toggleAll（bundle 30968-31003 逐字：侧栏+检查器联动开合（eagle.inspector.isHideInspector
   双写）+ lastItemStates 清空 + orientationchange + boxContianerWidth/Height 快照 + relayout/
   offsetScrollbar + 详情 edge 模式 zoomFitEdge（**裸 event 怪癖：$timeout 回调期 window.event
   为 null，以 w.event 复刻**）+ isHideSidebar localStorage 键逐字 + electronLog 双分支） */
export function machineryToggleAll(s: any, $event: any): void {
  const w = window as any;
  const $timeout = getTimeout();
  if ($event) {
    $event.preventDefault();
    $event.stopPropagation();
  }
  if (s.isHideSidebar) {
    w.eagle.inspector.isHideInspector = s.isHideSidebar = false;
  } else {
    w.eagle.inspector.isHideInspector = s.isHideSidebar = true;
  }
  $timeout(function () {
    s.lastItemStates = {};
    w.$(window).trigger("orientationchange");
    s.boxContianerWidth = w.$("#box-container").width() || s.boxContianerWidth;
    s.boxContianerHeight = w.$("#box-container").height() || s.boxContianerHeight;
    s.relayout();
    s.offsetScrollbar(30);
    if (s.isDetailMode) {
      s.$root.currentFocus = "content";
    }
    if (s.isDetailMode && s.lastZoomMode === "edge") {
      s.zoomFitEdge(w.event);
    }
    // if ($scope.layout === "GridLayout" || $scope.layout === "SquareLayout") {
    //     var currentColumn = ig._layout._columnLength;
    //     var currentWidth = $scope.imageSize.height;
    //     var targetColumn = Math.floor($scope.boxContianerWidth / currentWidth);
    //     $scope.adjustLayoutWidth(targetColumn - currentColumn);
    // }
  }, 100);
  w.localStorage.setItem("isHideSidebar", s.isHideSidebar);
  if (s.isHideSidebar) { w.electronLog && w.electronLog.info("[app] Sidebar: OFF"); }
  else { w.electronLog && w.electronLog.info("[app] Sidebar: ON"); }
  if (w.eagle.inspector.isHideInspector) { w.electronLog && w.electronLog.info("[app] Sidebar: OFF"); }
  else { w.electronLog && w.electronLog.info("[app] Sidebar: ON"); }
}

/* zoomIn（bundle 33883-33898 逐字：非详情 adjustLayoutWidth(-1)+saveListHeight（c15b
   machinery 版直调）+ 详情 5 步进 ratioExp 梯度（400/200/100/50/25/10/5 封顶 800）+
   updateZoomRatio machinery 版）；zoomOut（33899-33914 逐字：对称梯度 + 非详情多一步
   checkListItemsLessThanContainer（scope 解析）） */
export function machineryZoomIn(s: any, event: any): void {
  event && event.preventDefault && event.preventDefault();
  if (!s.isDetailMode) {
    s.adjustLayoutWidth(-1);
    machinerySaveListHeight(s, s.imageSize.height);
  } else {
    var ratio = Math.ceil(s.imageSize.zoomRatio / 5) * 5;
    var ratioExp = s.getRatioExp(ratio);
    if (ratioExp >= 400) { ratioExp = 800; } else if (ratioExp >= 200) { ratioExp = 400; } else if (ratioExp >= 100) { ratioExp = 200; } else if (ratioExp >= 50) { ratioExp = 100; } else if (ratioExp >= 25) { ratioExp = 50; } else if (ratioExp >= 10) { ratioExp = 25; } else if (ratioExp >= 5) { ratioExp = 10; } else { ratioExp = 5; }
    if (ratioExp > 800) ratioExp = 800;
    s.imageSize.zoomRatio = s.getRatioNonExp(ratioExp);
    s.imageSize.zoomRatioExp = s.getRatioExp(s.imageSize.zoomRatio);
    s.updateZoomRatio(undefined, undefined, undefined, true);
  }
}

export function machineryZoomOut(s: any, event: any): void {
  event && event.preventDefault && event.preventDefault();
  if (!s.isDetailMode) {
    s.adjustLayoutWidth(1);
    machinerySaveListHeight(s, s.imageSize.height);
    s.checkListItemsLessThanContainer();
  } else {
    var ratio = Math.floor(s.imageSize.zoomRatio / 5) * 5;
    var ratioExp = s.getRatioExp(ratio);
    if (ratioExp <= 10) { ratioExp = 5; } else if (ratioExp <= 25) { ratioExp = 10; } else if (ratioExp <= 50) { ratioExp = 25; } else if (ratioExp <= 100) { ratioExp = 50; } else if (ratioExp <= 200) { ratioExp = 100; } else if (ratioExp <= 400) { ratioExp = 200; } else if (ratioExp <= 800) { ratioExp = 400; }
    s.imageSize.zoomRatio = s.getRatioNonExp(ratioExp);
    s.imageSize.zoomRatioExp = s.getRatioExp(s.imageSize.zoomRatio);
    s.updateZoomRatio(undefined, undefined, undefined, true);
  }
}

/* saveHandler（bundle 35985-35991 逐字：crop 模式 saveCrop；saveCrop 经 scope 解析） */
export function machinerySaveHandler(s: any): void {
  if (s.isRotating) return;
  if (s.isCropMode) {
    s.saveCrop();
  }
}

/* refreshRandom（bundle 42824-42837 逐字：random 视图/RANDOM 排序守卫 + shuffle 清空 +
   refresh-random active 闪烁 50ms + reload（machinery 版经 scope）） */
export function machineryRefreshRandom(s: any): void {
  const w = window as any;
  if (s.isDetailMode) return;

  if (
    s.viewMode === 'random' ||
    (s.currentFolder && s.currentFolder.orderBy === "RANDOM") ||
    (s.currentSmartFolder && s.currentSmartFolder.orderBy === "RANDOM")
  ) {
    s.shuffle = [];
    w.$("#refresh-random").addClass("active");
    setTimeout(function () {
      w.$("#refresh-random").removeClass("active");
    }, 50);
    s.reload();
  }
}

/* ── c18f-2：openParentFolder/createTxtFileFromTemplate/setFolderCover ── */

/* openParentFolder（bundle 38384-38388 逐字；openFolder 经 scope 解析） */
export function machineryOpenParentFolder(s: any): void {
  if (s.currentFolder && s.currentFolder.parent) {
    s.openFolder(s.folderMappings[s.currentFolder.parent]);
  }
}

/* createTxtFileFromTemplate（bundle 37329-37334 逐字；newFileFromTemplate 为 bundle scope
   函数经 scope 解析——文件创建域后续独立切片） */
export function machineryCreateTxtFileFromTemplate(s: any, event: any): void {
  event && event.preventDefault();
  s.newFileFromTemplate("txt");
  s.$evalAsync();
}

/* setFolderCover（bundle 41438-41454 逐字；FileUrlHelper 经 window、getFilter() 复刻
   $filter('i18n')、notify/saveFolder 走 machinery 版） */
export function machinerySetFolderCover(s: any): void {
  const item = s.selected[0];
  if (!s.currentFolder || !item) return;
  s.currentFolder.coverId = item.id;
  var thumbnailUrl = (window as any).FileUrlHelper.getThumbnailUrl(item);
  s.currentFolder.covers[0] = `<img class="sub-folder-cover" src="${thumbnailUrl}" style="aspect-ratio: ${s.selected[0].width / s.selected[0].height};">`;
  var message = getFilter()('i18n')("notify.folder.setAsCover", [
    { "property": "folderName", "value": s.currentFolder.name }
  ]);
  s.notify({
    message: message,
    duration: 750
  });
  s.saveFolder();
}

/* ── c18f-3：inspector 面板/快捷搜索打开器 ───────────────────────────── */

/* openQuickSearch（bundle 32512-32514 逐字） */
export function machineryOpenQuickSearch(s: any, event: any): void {
  s.$root.$broadcast('OPEN_QUICK_SEARCH_MODAL');
}

/* openActionsPanel（bundle 43279-43282 逐字；eagle.action 经 window） */
export function machineryOpenActionsPanel(s: any, event: any): void {
  (window as any).eagle.action.open(s.selected);
}

/* openInspectorTagSelectPanel（bundle 43283-43287 逐字；body scope 生效版——54887 系为
   其他 controller 的 $bodyScope 委派壳） */
export function machineryOpenInspectorTagSelectPanel(s: any): void {
  if (s.selected.length === 0) return;
  s.$broadcast('INSPECTOR.TAG.SELECT.PANEL.OPEN');
}

/* openInspectorFolderSelectPanel（bundle 43288-43448 逐字：FolderSelectPanel.open 参数组
   （ folders/selectedIds/onChanged：checkOperationSafety 包装 → selectedFolderIds/deselected
   FolderIds 分拣 → addToRecentFolders → origin 四联快照 → eagle.utils.tree.walk 添加/删除
   双分支（extendTags 传染、ig.remove + imagesMappings、updateFilterCounts）→ ayncsImagesChange/
   hiddenByCurrentFilter → unfiled 分支 gl:removeItems → calculateImageBinding/rebindRefresh/
   updateSelection → i18n 单复数两形态（复数走 getFilter()，单数逐字 angular.injector 链）→
   notify undo 四字段回滚 → electronLog + analytics 'File','Categorize','QuickCategorize'）。
   FolderSelectPanel 为 bundle 顶层 class（55801，词法绑定不上 window）→ 直连 React 移植版
   selectPanelEngine 的 static open（同 rootScope $broadcast 语义，bundle 在世/缺席双期兼容）；
   体内 $bodyScope.* 引用逐字保留（= 真身 body scope，w.$bodyScope）。 */
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
      s.checkOperationSafety(() => {
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

          s.addToRecentFolders(folderIds);

          let origin: any[] = [];
          let originFolders: any[] = [];
          let originTags: any[] = [];
          let originDeleted: any[] = [];

          selectedItems.forEach((item: any) => {
            origin.push(item);
            originFolders.push(w.angular.copy(item.folders));
            originTags.push(w.angular.copy(item.tags));
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
                    w.ig.remove(w.$("#box-" + item.id)[0]);
                    s.currentFolder.imagesMappings[item.id] = false;
                  }
                  item.folders.splice(idx2, 1);
                  s.updateFilterCounts(item, -1);
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
              s.$root.$broadcast("gl:removeItems", w.$bodyScope.getSelectedItemElements());
            }

            w.$bodyScope.calculateImageBinding({ ignoreSort: true }, () => {
              w.$bodyScope.rebindRefresh(true);
              w.$bodyScope.updateSelection();
            });

            var message = getFilter()('i18n')("notify.image.moveToFolders", [
              { "property": "imageCount", "value": selectedItems.length },
              { "property": "folderCount", "value": selectedFolders.length }
            ]);

            if (s.selected.length === 1) {
              message = message.replace("images", "image");
            }
            if (selectedFolders.length === 1) {
              message = w.angular.element(document.body).injector().get('$filter')('i18n')("notify.image.moveToFolder", [
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
              s.current = origin[0];
              s.$root.$broadcast("CALCULATE_IMAGE_BINDING");
              s.$root.$broadcast("REBIND_REFRESH", true);
              s.$root.$broadcast("UPDATE_SELECTION");
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

/* ── c18g-1：getItemByElement/changeStar/gif 帧步进/addVideoComment/newFileFromTemplate ── */

/* getItemByElement（bundle 21834-21839 逐字：data-box-id 属性 → itemMappings；含
   element.id.replace("box-") 旧实现注释逐字保留） */
export function machineryGetItemByElement(s: any, element: any): any {
  if (!element) return "";
  // var id = element.id.replace("box-", "");
  var id = element.getAttribute("data-box-id");
  return s.itemMappings[id];
}

/* changeStar（bundle 30320-30381 逐字：空选守卫 + 零星单选无星守卫 + checkOperationSafety
   包装两分支——刪除星星（filterCounts rating 0/原星数增减 + delete image.star）与设置星星
   （原星数减/new 星数增/rating 0 减 + eagle.inspector.star 记录）+ i18n 通知 + analytics +
   updateItemsView（machinery 版）+ ayncsImagesChange/hiddenByCurrentFilter） */
export function machineryChangeStar(s: any, star: any, showNotify: any, force: any): void {
  const w = window as any;
  if (s.selected.length === 0) return;
  if (!star && s.selected.length === 1 && !s.selected[0].star) {
    return;
  }

  s.checkOperationSafety(function () {

    let changedItems: any[] = [];

    // 刪除星星
    if (star === undefined || (w.eagle.inspector.star === star && !force)) {
      for (var i = 0; i < s.selected.length; i++) {
        let image = s.selected[i];
        if (image.star) {
          w.eagle.filter.filterCounts['rating']['0']++;
          w.eagle.filter.filterCounts['rating']['' + image.star]--;
          delete image.star;
          changedItems.push(image);
        }
      }
      delete w.eagle.inspector.star;
      if (showNotify) {
        s.notify({
          message: getFilter()('i18n')('appmenu.tag>removeRating'),
          duration: 750
        });
      }
      w.electronLog && w.electronLog.info(`[app] Remove rating, total: ${changedItems.length} files`);
      w.analytics.event('Rating', 'Remove');
    }
    else {
      for (var i = 0; i < s.selected.length; i++) {
        let image = s.selected[i];
        if (image.star !== star) {
          w.eagle.filter.filterCounts['rating']['' + image.star]--;
          image.star = star;
          w.eagle.filter.filterCounts['rating']['' + star]++;
          w.eagle.filter.filterCounts['rating']['0']--;
          changedItems.push(image);
        }
      }
      w.eagle.inspector.star = star;
      var message = getFilter()('i18n')("notify.setStar.msg", [
        { "property": "star", "value": star }
      ]);
      if (showNotify) {
        s.notify({
          message: message,
          duration: 750
        });
      }
      w.electronLog && w.electronLog.info(`[app] Add ${star} star, total: ${changedItems.length} files`);
      w.analytics.event('Rating', 'Set', star);
    }
    s.updateItemsView(s.selected);
    if (changedItems.length > 0) {
      w.ayncsImagesChange(changedItems);
      w.hiddenByCurrentFilter(changedItems);
    }
  });
}

/* nextGifFrame/prevGifFrame（bundle 32838-32863 逐字：gifPlayer/gifViewer 经 scope 解析；
   **next 帧越界上界为 total-1、prev 下界 0——bundle 原样**） */
export function machineryNextGifFrame(s: any, amount: any = 1): void {
  if (s.gifPlayer && s.isGifReady) {
    s.gifPlayer.pause();
    s.gifViewer.playing = false;
    var curr = s.gifPlayer.get_current_frame();
    var total = s.gifViewer.frames.length;
    var idx = curr + amount;
    if (idx > total) idx = total - 1;
    s.gifPlayer.move_to(idx);
    s.$evalAsync();
  }
}

export function machineryPrevGifFrame(s: any, amount: any = 1): void {
  if (s.gifPlayer && s.isGifReady) {
    s.gifPlayer.pause();
    s.gifViewer.playing = false;
    var curr = s.gifPlayer.get_current_frame();
    var idx = curr - amount;
    if (idx < 0) idx = 0;
    s.gifPlayer.move_to(idx);
    s.$evalAsync();
  }
}

/* addVideoComment（bundle 21182-21237 逐字：swal textarea（i18n 经 window）→ guid（Tier-2）
   构造 comment（duration/annotation）→ current.comments 插入 + duration 升序排序 →
   REFRESH_VIDEO_COMMENTS 广播 + updateItemView（scope 解析）+ ipcRenderer 统一表达式
   send('image-change')） */
export function machineryAddVideoComment(s: any, video: any, videoElem: any): void {
  const w = window as any;
  if (!video || !videoElem) return;

  videoElem.pause();

  w.swal({
    html: `
                    <div class="alert">
                        <div class="alert-icon create"></div>
                        <h4 class="alert-title">${w.i18n.__('dialog.videoComment.title')}</h4>
                    </div>
                `,
    input: 'textarea',
    inputPlaceholder: w.i18n.__("dialog.videoComment.placeholder"),
    allowEnterKey: false,
    showCloseButton: false,
    showCancelButton: true,
    allowOutsideClick: false,
    focusConfirm: false,
    focusCancel: false,
    padding: 10,
    position: 'bottom',
    width: 400,
    customClass: "alert-box",
    cancelButtonColor: "#777777",
    confirmButtonText: w.i18n.__("dialog.videoComment.save"),
    cancelButtonText: w.i18n.__("general.cancel"),
  }).then(function (result: any) {

    if (!result) return;

    var comment = {
      id: w.guid(),
      duration: videoElem.currentTime,
      annotation: result,
      lastModified: Date.now()
    }

    if (!s.current.comments) {
      s.current.comments = [];
    }

    s.current.comments.push(comment);
    s.current.comments = s.current.comments.sort(function (a: any, b: any) {
      var da = a.duration;
      var db = b.duration;
      if (da > db) return 1;
      if (da < db) return -1;
      return 0;
    })
    s.$root.$broadcast("REFRESH_VIDEO_COMMENTS");
    s.updateItemView(video);
    s.$evalAsync();

    const ipc = w.__eagleIpc || (w.electron && w.electron.ipcRenderer);
    ipc.send('image-change', s.current);
  })
}

/* newFileFromTemplate（bundle 37336-37374 逐字：resourcesPath/EAGLE_THUMBNAIL_TEMP_PATH 为
   bundle 顶层 var 经 window、fs/path 经 window.require、i18n/FileUrlHelper 经 window、
   uploadFiles/showUploadQueue 经 scope 解析、electronLog 兜底 catch） */
export function machineryNewFileFromTemplate(s: any, ext: any): void {
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

    if (s.currentFolder && s.currentFolder.id) {
      file.folders = [s.currentFolder.id];
      if (s.currentFolder.extendTags) {
        file.tags = s.currentFolder.extendTags;
        file.tags = [...new Set(file.tags)];
      }
    }
    s.uploadFiles([file]);
    s.showUploadQueue();

    const ipc = w.__eagleIpc || (w.electron && w.electron.ipcRenderer);
    ipc.send('electron-info', `[app] Create file from [Untitled.${ext}]`);
  }
  catch (err: any) {
    w.electronLog && w.electronLog.error(err.stack || err);
  }
}

/* ── c18g-2：视图开启器族（random/unfiled/untagged/recent/community/allTags/trash）── */

// ── c18g-2 域内自管（原 controller 闭包 var：openRandomTimeout 36758 邻域 /
//    openUnfiledTimeout 36773 / openUntaggedTimeout 36804 / openRecentTimeout 36835 /
//    openTrashTimeout 36968）──
let openRandomTimeout: any = null;
let openUnfiledTimeout: any = null;
let openUntaggedTimeout: any = null;
let openRecentTimeout: any = null;
let openTrashTimeout: any = null;

/* openRandom（bundle 36740-36770 逐字：同视图+有色规则外早退（callback/leaveDetailMode）+
   resetPage + image-drop-area 隐藏 + 50ms timeout（UrlStateService setState + random 专用
   thumbSize 键 + setLastFolder/updateListHeight **不调** + scrollTop 0 + reload + callback +
   screenView）——**本开启器无 ScrollbarSaver 存取，bundle 原样**） */
export function machineryOpenRandom(s: any, ignoreHistory: any, callback: any): void {
  const w = window as any;
  const $timeout = getTimeout();
  if (s.viewMode === 'random' && s.allData.length > 0 && w.eagle.filter.filterRules.color.value == undefined) {
    if (callback) {
      callback();
    }
    if (s.isDetailMode) {
      s.leaveDetailMode();
    }
    return;
  }

  s.viewMode = 'random';
  s.resetPage();
  s.$root.currentFocus = "sidebar";

  w.$("#image-drop-area").hide();
  $timeout.cancel(openRandomTimeout);
  openRandomTimeout = $timeout(function () {
    if (!ignoreHistory) {
      w.UrlStateService.setState({ view: 'random', folder: null, smartfolder: null, tag: null, color: null });
    }
    s.imageSize.height = w.localStorage.getItem("eagle.list.thumbSize.random") || 150;
    s.imageSize.height = parseInt(s.imageSize.height);
    machinerySetLastFolder(s, undefined);
    w.$("#sidebar-item-container").scrollTop(0);
    s.reload();
    if (callback) {
      callback();
    }
    w.analytics.screenView('Random');
  }, 50);
}

/* openUnfiled（bundle 36774-36802 逐字：早退 + ScrollbarSaver 存取 + unfiled thumbSize 键 +
   updateListHeight + restoreScrollPosition + screenView） */
export function machineryOpenUnfiled(s: any, ignoreHistory: any): void {
  const w = window as any;
  const $timeout = getTimeout();

  if (s.viewMode === 'unfiled' && s.allData.length > 0 && w.eagle.filter.filterRules.color.value == undefined) {
    if (s.isDetailMode) {
      s.leaveDetailMode();
    }
    return;
  }

  w.ScrollbarSaver.saveScrollPosition();
  s.viewMode = 'unfiled';
  s.$root.currentFocus = "sidebar";
  s.resetPage();

  $timeout.cancel(openUnfiledTimeout);
  openUnfiledTimeout = $timeout(function () {
    if (!ignoreHistory) {
      w.UrlStateService.setState({ view: 'unfiled', folder: null, smartfolder: null, tag: null, color: null });
    }
    s.imageSize.height = w.localStorage.getItem("eagle.list.thumbSize.unfiled") || 150;
    s.imageSize.height = parseInt(s.imageSize.height);
    machinerySetLastFolder(s, undefined);
    machineryUpdateListHeight(s, s.imageSize.height);
    w.ScrollbarSaver.restoreScrollPosition();
    w.$("#sidebar-item-container").scrollTop(0);
    s.reload();
    w.analytics.screenView('Unfiled');
  }, 50);
}

/* openUntagged（bundle 36805-36833 逐字：同 openUnfiled 模板，untagged 键） */
export function machineryOpenUntagged(s: any, ignoreHistory: any): void {
  const w = window as any;
  const $timeout = getTimeout();

  if (s.viewMode === 'untagged' && s.allData.length > 0 && w.eagle.filter.filterRules.color.value == undefined) {
    if (s.isDetailMode) {
      s.leaveDetailMode();
    }
    return;
  }

  w.ScrollbarSaver.saveScrollPosition();
  s.viewMode = 'untagged';
  s.$root.currentFocus = "sidebar";
  s.resetPage();

  $timeout.cancel(openUntaggedTimeout);
  openUntaggedTimeout = $timeout(function () {
    if (!ignoreHistory) {
      w.UrlStateService.setState({ view: 'untagged', folder: null, smartfolder: null, tag: null, color: null });
    }
    s.imageSize.height = w.localStorage.getItem("eagle.list.thumbSize.untagged") || 150;
    s.imageSize.height = parseInt(s.imageSize.height);
    machinerySetLastFolder(s, undefined);
    machineryUpdateListHeight(s, s.imageSize.height);
    w.ScrollbarSaver.restoreScrollPosition();
    w.$("#sidebar-item-container").scrollTop(0);
    s.reload();
    w.analytics.screenView('Untagged');
  }, 50);
}

/* openRecent（bundle 36836-36864 逐字：同 openUnfiled 模板，recent 键） */
export function machineryOpenRecent(s: any, ignoreHistory: any): void {
  const w = window as any;
  const $timeout = getTimeout();

  if (s.viewMode === 'recent' && s.allData.length > 0 && w.eagle.filter.filterRules.color.value == undefined) {
    if (s.isDetailMode) {
      s.leaveDetailMode();
    }
    return;
  }

  w.ScrollbarSaver.saveScrollPosition();
  s.viewMode = 'recent';
  s.$root.currentFocus = "sidebar";
  s.resetPage();

  $timeout.cancel(openRecentTimeout);
  openRecentTimeout = $timeout(function () {
    if (!ignoreHistory) {
      w.UrlStateService.setState({ view: 'recent', folder: null, smartfolder: null, tag: null, color: null });
    }
    s.imageSize.height = w.localStorage.getItem("eagle.list.thumbSize.recent") || 150;
    s.imageSize.height = parseInt(s.imageSize.height);
    machinerySetLastFolder(s, undefined);
    machineryUpdateListHeight(s, s.imageSize.height);
    w.ScrollbarSaver.restoreScrollPosition();
    w.$("#sidebar-item-container").scrollTop(0);
    s.reload();
    w.analytics.screenView('Recent');
  }, 50);
}

/* openCommunity（bundle 36866-36888 逐字：community 面板 iframe 化——images 清空 + 详情退出 +
   lng2locale 三语映射 + OPEN_URL_IN_PANEL 广播 + leaveDetailMode（经 $bodyScope 逐字）） */
export function machineryOpenCommunity(s: any, ignoreHistory: any): void {
  const w = window as any;
  w.ScrollbarSaver.saveScrollPosition();
  s.viewMode = 'community';
  s.$root.currentFocus = "sidebar";
  s.resetPage();
  s.images = [];
  s.isDetailMode = false;
  s.selected = [];

  if (!ignoreHistory) {
    w.UrlStateService.setState({ view: 'community', folder: null, smartfolder: null, tag: null, color: null });
  }

  let lng2locale: any = {
    "zh_CN": "cn",
    "zh_TW": "tw",
    "ja_JP": "jp"
  };
  let baseUrl = `https://community-${lng2locale[w.preferences.general.language] || "en"}.eagle.cool`;
  s.$root.$broadcast("OPEN_URL_IN_PANEL", `${baseUrl}`);
  w.$bodyScope.leaveDetailMode();
}

/* openAllTags（bundle 36889-36911 逐字：同视图有色早退 + ScrollbarSaver 存 + rebindRefresh +
   TagManager.renderTagsResult（scope 字段 TagManager，48351）50ms 延迟——**无 imageSize/
   reload 面，bundle 原样**） */
export function machineryOpenAllTags(s: any, ignoreHistory: any): void {
  const w = window as any;
  const $timeout = getTimeout();
  if (s.viewMode === 'alltags' && s.allData.length > 0 && w.eagle.filter.filterRules.color.value == undefined) return;

  w.ScrollbarSaver.saveScrollPosition();

  s.viewMode = 'alltags';
  s.$root.currentFocus = "sidebar";
  s.resetPage();
  s.images = [];
  s.isDetailMode = false;
  s.selected = [];

  if (!ignoreHistory) {
    w.UrlStateService.setState({ view: 'alltags', folder: null, smartfolder: null, tag: null, color: null });
  }

  s.rebindRefresh();
  w.analytics.screenView('AllTags');
  $timeout(() => {
    s.TagManager.renderTagsResult();
  }, 50);
}

/* openTrash（bundle 36969-36996 逐字：早退 + ScrollbarSaver 存取 + trash thumbSize 键 +
   updateListHeight + screenView） */
export function machineryOpenTrash(s: any, ignoreHistory: any): void {
  const w = window as any;
  const $timeout = getTimeout();
  if (s.viewMode === 'trash' && s.allData.length > 0 && w.eagle.filter.filterRules.color.value == undefined) {
    if (s.isDetailMode) {
      s.leaveDetailMode();
    }
    return;
  }
  w.ScrollbarSaver.saveScrollPosition();

  s.viewMode = 'trash';
  s.resetPage();
  s.$root.currentFocus = "sidebar";

  w.$("#image-drop-area").hide();
  $timeout.cancel(openTrashTimeout);
  openTrashTimeout = $timeout(function () {
    if (!ignoreHistory) {
      w.UrlStateService.setState({ view: 'trash', folder: null, smartfolder: null, tag: null, color: null });
    }
    s.imageSize.height = w.localStorage.getItem("eagle.list.thumbSize.trash") || 150;
    s.imageSize.height = parseInt(s.imageSize.height);
    machinerySetLastFolder(s, undefined);
    machineryUpdateListHeight(s, s.imageSize.height);
    w.ScrollbarSaver.restoreScrollPosition();
    w.$("#sidebar-item-container").scrollTop(0);
    s.reload();
    w.analytics.screenView('Trash');
  }, 50);
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
  // c15b：adjustLayoutWidth/zoomFit
  s.adjustLayoutWidth = (increases: any) => machineryAdjustLayoutWidth(s, increases);
  s.zoomFit = (event: any, noAnimation: any) => machineryZoomFit(s, event, noAnimation);
  // c15c：getSelection/changeSidebarIndex/resetPage/calculateFilterCounts
  s.getSelection = () => machineryGetSelection(s);
  s.changeSidebarIndex = (node: any) => machineryChangeSidebarIndex(s, node);
  s.resetPage = () => machineryResetPage(s);
  s.calculateFilterCounts = () => machineryCalculateFilterCounts(s);
  // c15d：openAll + ScrollbarSaver（if-absent；bundle 在世沿用其隐式全局绑定）
  s.openAll = (ignoreHistory: any, callback: any) => machineryOpenAll(s, ignoreHistory, callback);
  if (!w2.ScrollbarSaver) w2.ScrollbarSaver = buildScrollbarSaver();
  // c16a：enterDetailMode/leaveDetailMode
  s.enterDetailMode = ($event: any, image: any) => machineryEnterDetailMode(s, $event, image);
  s.leaveDetailMode = () => machineryLeaveDetailMode(s);
  // c16c：saveFolder
  s.saveFolder = () => machinerySaveFolder(s);
  // c17b：notify（root scope 函数——bundle $rootScope.notify 20157 的等价实现，root/body
  // 双写保证 $rootScope.notify 直调与 s.notify 原型链解析都走移植版）
  const notifyFn = (params: any, restoreCallbackk: any) => machineryNotify(s, params, restoreCallbackk);
  s.$root.notify = notifyFn;
  s.notify = notifyFn;
  // c18a：smartZoom/lastZoom
  s.smartZoom = (target: any, forceMode: any) => machinerySmartZoom(s, target, forceMode);
  s.lastZoom = () => machineryLastZoom(s);
  // c18b：zoomActual/toggleZoom/zoomFitEdge/updateContainerHieght
  s.zoomActual = (event: any) => machineryZoomActual(s, event);
  s.toggleZoom = (event: any) => machineryToggleZoom(s, event);
  s.zoomFitEdge = (event: any, hasTransition: any) => machineryZoomFitEdge(s, event, hasTransition);
  s.updateContainerHieght = (hasAnimation: any, delay: any) => machineryUpdateContainerHieght(s, hasAnimation, delay);
  // c18c：undo/nextHistory/prevHistory/back
  s.undo = () => machineryUndo(s);
  s.nextHistory = () => machineryNextHistory(s);
  s.prevHistory = () => machineryPrevHistory(s);
  s.back = () => machineryBack(s);
  // c18d：selectAll/toggleDetailMode
  s.selectAll = (event: any) => machinerySelectAll(s, event);
  s.toggleDetailMode = ($event: any, isInline: any) => machineryToggleDetailMode(s, $event, isInline);
  // c18e-1：selectNext/selectPrev
  s.selectNext = (event: any) => machinerySelectNext(s, event);
  s.selectPrev = (event: any) => machinerySelectPrev(s, event);
  // c18e-2：multipleSelect 四件套
  s.multipleSelectUp = (event: any) => machineryMultipleSelectUp(s, event);
  s.multipleSelectDown = (event: any) => machineryMultipleSelectDown(s, event);
  s.multipleSelectNext = (event: any) => machineryMultipleSelectNext(s, event);
  s.multipleSelectPrev = (event: any) => machineryMultipleSelectPrev(s, event);
  // c18e-2b：removeSelected
  s.removeSelected = (event: any) => machineryRemoveSelected(s, event);
  // c18e-3：quicklook/copyImages
  s.quicklook = (event: any) => machineryQuicklook(s, event);
  s.copyImages = (event: any) => machineryCopyImages(s, event);
  // c18e-4：方向键/修饰键 handler 族（第一批）
  s.keyCHandler = (event: any) => machineryKeyCHandler(s, event);
  s.keyPHandler = (event: any) => machineryKeyPHandler(s, event);
  s.keyLeftHandler = (event: any) => machineryKeyLeftHandler(s, event);
  s.keyRightHandler = (event: any) => machineryKeyRightHandler(s, event);
  s.modUpHandler = (event: any) => machineryModUpHandler(s, event);
  s.modDownHandler = (event: any) => machineryModDownHandler(s, event);
  s.modLeftHandler = (event: any) => machineryModLeftHandler(s, event);
  s.modRightHandler = (event: any) => machineryModRightHandler(s, event);
  s.modShiftUpHandler = (event: any) => machineryModShiftUpHandler(s, event);
  s.modShiftDownHandler = (event: any) => machineryModShiftDownHandler(s, event);
  s.modShiftLeftHandler = (event: any) => machineryModShiftLeftHandler(s, event);
  s.modShiftRightHandler = (event: any) => machineryModShiftRightHandler(s, event);
  // c18e-5：keyUp/keyDown（侧栏导航级联 + QuickAccess/Group 闭包域内移植）
  s.keyUpHandler = (event: any) => machineryKeyUpHandler(s, event);
  s.keyDownHandler = (event: any) => machineryKeyDownHandler(s, event);
  // c18e-6：selectUp/Down + pageUp/pageDown（throttle 实例 apply 时一次性创建）
  s.selectUp = (event: any) => machinerySelectUp(s, event);
  s.selectDown = (event: any) => machinerySelectDown(s, event);
  s.pageDownHandler = machineryPageDownHandler(s);
  s.pageUpHandler = machineryPageUpHandler(s);
  // c18f-1：小 handler 批
  s.changeTo5Star = (event: any) => machineryChangeTo5Star(s, event);
  s.closeWindowHandler = ($event: any) => machineryCloseWindowHandler(s, $event);
  s.nHandler = ($event: any) => machineryNHandler(s, $event);
  s.mHandler = ($event: any) => machineryMHandler(s, $event);
  s.toggleAll = ($event: any) => machineryToggleAll(s, $event);
  s.zoomIn = (event: any) => machineryZoomIn(s, event);
  s.zoomOut = (event: any) => machineryZoomOut(s, event);
  s.saveHandler = () => machinerySaveHandler(s);
  s.refreshRandom = () => machineryRefreshRandom(s);
  // c18f-2：openParentFolder/createTxtFileFromTemplate/setFolderCover
  s.openParentFolder = () => machineryOpenParentFolder(s);
  s.createTxtFileFromTemplate = (event: any) => machineryCreateTxtFileFromTemplate(s, event);
  s.setFolderCover = () => machinerySetFolderCover(s);
  // c18f-3：inspector 面板/快捷搜索打开器
  s.openQuickSearch = (event: any) => machineryOpenQuickSearch(s, event);
  s.openActionsPanel = (event: any) => machineryOpenActionsPanel(s, event);
  s.openInspectorTagSelectPanel = () => machineryOpenInspectorTagSelectPanel(s);
  s.openInspectorFolderSelectPanel = (event: any) => machineryOpenInspectorFolderSelectPanel(s, event);
  // c18g-1：getItemByElement/changeStar/gif 帧步进/addVideoComment/newFileFromTemplate
  s.getItemByElement = (element: any) => machineryGetItemByElement(s, element);
  s.changeStar = (star: any, showNotify: any, force: any) => machineryChangeStar(s, star, showNotify, force);
  s.nextGifFrame = (amount: any) => machineryNextGifFrame(s, amount);
  s.prevGifFrame = (amount: any) => machineryPrevGifFrame(s, amount);
  s.addVideoComment = (video: any, videoElem: any) => machineryAddVideoComment(s, video, videoElem);
  s.newFileFromTemplate = (ext: any) => machineryNewFileFromTemplate(s, ext);
  // c18g-2：视图开启器族
  s.openRandom = (ignoreHistory: any, callback: any) => machineryOpenRandom(s, ignoreHistory, callback);
  s.openUnfiled = (ignoreHistory: any) => machineryOpenUnfiled(s, ignoreHistory);
  s.openUntagged = (ignoreHistory: any) => machineryOpenUntagged(s, ignoreHistory);
  s.openRecent = (ignoreHistory: any) => machineryOpenRecent(s, ignoreHistory);
  s.openCommunity = (ignoreHistory: any) => machineryOpenCommunity(s, ignoreHistory);
  s.openAllTags = (ignoreHistory: any) => machineryOpenAllTags(s, ignoreHistory);
  s.openTrash = (ignoreHistory: any) => machineryOpenTrash(s, ignoreHistory);

  (window as any).__eagleDataMachinery = {
    version: 34,
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
    adjustLayoutWidth: 'machinery',
    zoomFit: 'machinery',
    saveListHeight: 'machinery',
    getSelection: 'machinery',
    changeSidebarIndex: 'machinery',
    resetPage: 'machinery',
    calculateFilterCounts: 'machinery',
    openAll: 'machinery',
    updateListHeight: 'machinery',
    setLastFolder: 'machinery',
    setViewMode: 'machinery',
    enterDetailMode: 'machinery',
    leaveDetailMode: 'machinery',
    saveFolder: 'machinery',
    buildMousetrap: 'machinery',
    destoryMousetrap: 'machinery',
    initMousetrap: 'machinery',
    notify: 'machinery',
    smartZoom: 'machinery',
    lastZoom: 'machinery',
    zoomActual: 'machinery',
    toggleZoom: 'machinery',
    zoomFitEdge: 'machinery',
    updateContainerHieght: 'machinery',
    undo: 'machinery',
    nextHistory: 'machinery',
    prevHistory: 'machinery',
    back: 'machinery',
    selectAll: 'machinery',
    toggleDetailMode: 'machinery',
    multipleSelectUp: 'machinery',
    multipleSelectDown: 'machinery',
    multipleSelectNext: 'machinery',
    multipleSelectPrev: 'machinery',
    removeSelected: 'machinery',
    quicklook: 'machinery',
    copyImages: 'machinery',
    keyCHandler: 'machinery',
    keyPHandler: 'machinery',
    keyLeftHandler: 'machinery',
    keyRightHandler: 'machinery',
    modUpHandler: 'machinery',
    modDownHandler: 'machinery',
    modLeftHandler: 'machinery',
    modRightHandler: 'machinery',
    modShiftUpHandler: 'machinery',
    modShiftDownHandler: 'machinery',
    modShiftLeftHandler: 'machinery',
    modShiftRightHandler: 'machinery',
    keyUpHandler: 'machinery',
    keyDownHandler: 'machinery',
    selectUp: 'machinery',
    selectDown: 'machinery',
    pageDownHandler: 'machinery',
    pageUpHandler: 'machinery',
    changeTo5Star: 'machinery',
    closeWindowHandler: 'machinery',
    nHandler: 'machinery',
    mHandler: 'machinery',
    toggleAll: 'machinery',
    zoomIn: 'machinery',
    zoomOut: 'machinery',
    saveHandler: 'machinery',
    refreshRandom: 'machinery',
    openParentFolder: 'machinery',
    createTxtFileFromTemplate: 'machinery',
    setFolderCover: 'machinery',
    openQuickSearch: 'machinery',
    openActionsPanel: 'machinery',
    openInspectorTagSelectPanel: 'machinery',
    openInspectorFolderSelectPanel: 'machinery',
    getItemByElement: 'machinery',
    changeStar: 'machinery',
    nextGifFrame: 'machinery',
    prevGifFrame: 'machinery',
    addVideoComment: 'machinery',
    newFileFromTemplate: 'machinery',
    openRandom: 'machinery',
    openUnfiled: 'machinery',
    openUntagged: 'machinery',
    openRecent: 'machinery',
    openCommunity: 'machinery',
    openAllTags: 'machinery',
    openTrash: 'machinery',
    selectNext: 'machinery',
    selectPrev: 'machinery',
  };
}
