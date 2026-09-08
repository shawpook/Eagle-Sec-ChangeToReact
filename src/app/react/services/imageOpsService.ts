/**
 * b1-9bs：imageOpsService —— 图像操作 + 视图更新族归位（S7 批 19）。
 *
 * 居民（16 个，逐字；原 controllerFns fns 表条目，install 工厂同 bo/bp/bq/br）：
 * - 视图更新：updateItemView（222）/ updateSelection / changeStar（67）/ currentIndex
 * - 图像几何：rotateImage（143）/ flipImage（65）/ saveCrop（103）/ replaceFile（129）
 * - 绑定引擎：calculateImageBinding（280）
 * - 缩略图/视频帧族：regenerateThumbnail / cancelRegenerateThumbnail / getThumbnailPath /
 *   getThumbnailUrl / copeVideoFrame / saveVideoFrame / startDrag
 * （updateItemView 的 watch 链与 scopeShim 双轨面不动——S7-bs 收编目标为 fns 表体）
 *
 * 符号解析面（batchOpsService 同模式）：
 * - i18n/eagle/swal/preferences/process/electronLog/analytics/hiddenByCurrentFilter/
 *   ayncsImagesChange → window 全局回退
 * - fs/sanitize → _req 惰性（controllerFns 同源：app-root-path 定位 bundle 内联件）
 * - $filter/$timeout → 双轨 shim
 * - IPCHelper → core 同源；dialog/currentWindow/remote/ipcRenderer → electron 同源
 */
// @ts-nocheck
import { detailZoom } from '../core/smoothZoomEngine';
import { IPCHelper } from '../core/ipcHelper';
import { getFilter as machineryGetFilter } from '../core/dataMachinery';
import { debounce } from '../utils/func';
import { syncListFromScope } from '../store/listState';
import { syncSidebarFromScope } from '../store/sidebarState';
import { syncFilterFromScope } from '../store/filterState';
import { syncDetailFromScope } from '../store/detailState';
import { getBodyScope } from '../core/appCore';

// b1-9bl-B：bo-bt 迁移漏带的闭包 link 变量（原 controllerFns closure 层共享 var）。
// 服务侧本地重建解析（controllerFns initLinkVars 同式），使各 fn 首行
// try { initLinkVars(); } 从 no-op 转为真实供给。
var __lv_TagManager;
var __lv_calculateImageBindingTimeout;
var __lv_lastRotateImage;
var __lv_rotateImageSaveTimeout;
var __lv_rotateImageTimeout;
var __lv_pinyinCache = {};
const initLinkVars = () => {
	const s0: any = getBodyScope();
	if (s0 && s0.TagManager) __lv_TagManager = s0.TagManager;
};

const _req: any = (n: string) => { try { return (window as any).require(n); } catch (err) { return undefined; } };
const i18n: any = (window as any).i18n;
let preferences: any = (window as any).electronSettings?.getPreferences?.() || {};
const eagle: any = (window as any).eagle;
const swal: any = (...args: any[]) => (window as any).swal(...args);
const remote: any = _req('@electron/remote');
const dialog: any = remote?.dialog;
const currentWindow: any = (window as any).electron?.remote?.getCurrentWindow?.() || _req('@electron/remote')?.getCurrentWindow?.();
const ipcRenderer: any = (window as any).__eagleIpc || (window as any).electron?.ipcRenderer;
const electronLog: any = (window as any).electronLog || console;
const fs: any = _req('fs');
const sanitize: any = (function () {
  const arp: any = _req('app-root-path');
  try { return arp ? _req(String(arp) + '/my_modules/sanitize-filename') : undefined; } catch (err) { return undefined; }
})();
const $filter: any = (name: string) => {
  const s: any = getBodyScope();
  const root = s && s.$root;
  if (root && root.$filter) return root.$filter(name);
  const inst: any = machineryGetFilter();
  return inst ? inst(name) : undefined;
};
// $timeout 语义 = 延时执行 + digest（controllerFns 同源）
const $timeout: any = (fn: any, ms?: number) => setTimeout(() => {
  try { if (typeof fn === 'function') fn(); } finally { try { getBodyScope().$apply(); } catch (err) { /* noop */ } }
}, ms || 0);

/* 16 fns（逐字；fns/getScope 为闭包注入） */
export function installImageOpsFns(fns: any, getScope: any): void {
  fns["changeStar"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function (star, showNotify, force) {
            if (s.selected.length === 0) return;
            if (!star && s.selected.length === 1 && !s.selected[0].star) {
            	return;
            }

            s.checkOperationSafety(function () {

                let changedItems = [];

                // 刪除星星
                if (star === undefined || (eagle.inspector.star === star && !force)) {
                    for (var i = 0; i < s.selected.length; i++) {
                        let __lv_image = s.selected[i];
                        if (__lv_image.star) {
                            eagle.filter.filterCounts['rating']['0']++;
                            eagle.filter.filterCounts['rating']['' + __lv_image.star]--;
                            delete __lv_image.star;
                            changedItems.push(__lv_image);
                        }
                    }
                    delete eagle.inspector.star;
                    if (showNotify) {
                        s.notify({
                            message: $filter('i18n')('appmenu.tag>removeRating'),
                            duration: 750
                        });
                    }
                    electronLog && electronLog.info(`[app] Remove rating, total: ${changedItems.length} files`);
                    analytics.event('Rating', 'Remove');
                }
                else {
                    for (var i = 0; i < s.selected.length; i++) {
                        let __lv_image = s.selected[i];
                        if (__lv_image.star !== star) {
                            eagle.filter.filterCounts['rating']['' + __lv_image.star]--;
                            __lv_image.star = star;
                            eagle.filter.filterCounts['rating']['' + star]++;
                            eagle.filter.filterCounts['rating']['0']--;
                            changedItems.push(__lv_image);
                        }
                    }
                    eagle.inspector.star = star;
                    var message = $filter('i18n')("notify.setStar.msg", [
                        { "property": "star", "value": star }
                    ]);
                    if (showNotify) {
                        s.notify({
                            message: message,
                            duration: 750
                        });
                    }
                    electronLog && electronLog.info(`[app] Add ${star} star, total: ${changedItems.length} files`);
                    analytics.event('Rating', 'Set', star);
                }
                s.updateItemsView(s.selected);
                if (changedItems.length > 0) {
                    ayncsImagesChange(changedItems);
                    hiddenByCurrentFilter(changedItems);
                }
            });
        }).apply(null, args);
  };

  fns["updateItemView"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function (item) {

            if (!item) return;
            try {
                var id = item.id;
                var $element = $("#box-" + id);
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
                var __lv_tags = item.tags || [];
                var isTagged = __lv_tags.length > 0;
                var $annotationCount = $element.find(".annotation-count");
                var ratingStrings = {
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
                    var __lv_tags = item.tags.map(function (tag) {
                        try {
                            return `<div class="tag color-${$bodyScope.TagManager.tagMappings[tag].color}">${tag}</div>`;
                        } catch (err) {}
                    });
                    tagsFormated = __lv_tags.join("");
                }

                $element.attr("data-height", item.height);
                $element.attr("data-width", item.width);

                if ($name.text() !== item.name) {
                    if (!s.modifiedMappings[item.id]) s.modifiedMappings[item.id] = 0;
                    s.modifiedMappings[item.id]++;
                    let __lv_src = FileUrlHelper.getLastestThumbnailUrl(item);
                    var $img = $element.find(".thumbnail img");
                    $img.attr("lazysrc", "");
                    $img.attr("lsrc", __lv_src);
                    $img.attr("raw", __lv_src);
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
                switch ($bodyScope.listMetaType) {
                    case 'RESOLUTION':
                    	if (item.duration && VIDEO_TYPES[item.ext]) {
                            metas = $filter('duration')(item.duration);
                        }
                        else if (item.duration && AUDIO_TYPES[item.ext]) {
                            metas = $filter('duration')(item.duration);
                        }
                        else if (item.fontMetas && FONT_TYPES[item.ext]) {
                            metas = item.fontMetas.weight;
                        }
                        else if (item.noPreview) {
                            metas = `${fileSize(item.size, 1)}`;
                        }
                        else if (SPECIAL_TYPES[item.ext]) {
                            metas = `${fileSize(item.size, 1)}`;
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
                            paragraphs.forEach(function (paragraph) {
                                paragraphsHTML += `<p>${paragraph.trim()}</p>`;
                            });
                            $("#box-" + item.id + " .txt-content div").html(paragraphsHTML);
                        }
                        break;
                    case 'FILESIZE':
                        metas = `${fileSize(item.size, 1)}`;
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
                $propSize.html(`${fileSize(item.size, 1)}`);

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
                    var fontPath = `${fontFolder}/${sanitize(postScriptName)}.${item.ext}`;
                    var activatedLabel = i18n.__("Context.Image.Font.Activate");
                    var deactivatedLabel = i18n.__("Context.Image.Font.Deactivate");
                    // 添加正在启用、正在停用状态
                    if (item.activating || item.deactivating) {
                        $element.addClass("activating");
                    }
                    else if (fs.existsSync(fontPath)) {
                        installedFonts[`${postScriptName}_.${item.ext}`] = true;
                        $element.removeClass("activating");
                        $element.addClass("activated");
                        $element.find(".activate-btn").attr("title", deactivatedLabel);
                    }
                    else {
                        installedFonts[`${postScriptName}_.${item.ext}`] = false;
                        $element.removeClass("activating");
                        $element.removeClass("activated");
                        $element.find(".activate-btn").attr("title", activatedLabel);
                    }
                }
            }
            catch (err) {
                console.error(err);
            }
        }).apply(null, args);
  };

  fns["updateSelection"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function() {
            s.$broadcast("UPDATE_INSPECTOR");
        }).apply(null, args);
  };

  fns["startDrag"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function (event) {
            if (s.current) {
                var __lv_transformsJSON = JSON.stringify([s.current]);
                ipcRenderer.send('ondragstart', { images: __lv_transformsJSON, target: s.current, resize: 120 });
            }
        }).apply(null, args);
  };

  fns["copeVideoFrame"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function () {
        	s.videoScreenShot(true);
        }).apply(null, args);
  };

  fns["saveVideoFrame"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function () {
        	s.videoScreenShot();
        }).apply(null, args);
  };

  fns["cancelRegenerateThumbnail"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function () {
            IPCHelper.send('cancel.generate.thumbnail');
            s.regenerateThumbnailQueue = [];
    }).apply(null, args);
  };

  fns["getThumbnailPath"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function (__lv_image) {
            if (!s.imagesDir || !__lv_image) return;
            return FileUrlHelper.getThumbnailUrl(__lv_image);
        }).apply(null, args);
  };

  fns["getThumbnailUrl"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function (__lv_image) {
            if (!s.imagesDir || !__lv_image) return;
            return FileUrlHelper.getThumbnailUrl(__lv_image);
        }).apply(null, args);
  };

  fns["currentIndex"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function() {
            if (!s.allData) return undefined;
            return s.allData.indexOf(s.selected[0]) + 1;
        }).apply(null, args);
  };

  // regenerateThumbnail（bundle 33325-33332；ayncsImagesGenerateThumbnail →
  // w.ayncsImagesGenerateThumbnail（b1-9w bundleGlobals 供给））
  fns["regenerateThumbnail"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function () {
        s.selected.forEach(function(image) {
            s.regenerateThumbnailQueue.push(image);
        });
        ayncsImagesGenerateThumbnail(s.selected);
    }).apply(null, args);
  };

  fns["calculateImageBinding"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function(params = { ignoreSort : false }, callback) {

            var duration = 50;
            if (__lv_calculateImageBindingTimeout) {
                duration = 50;
            } else {
                duration = 1;
            }
            if (__lv_TagManager.azGroups) {
                $timeout.cancel(__lv_calculateImageBindingTimeout);
            }
            __lv_calculateImageBindingTimeout = $timeout(function() {

                try {

                    if (!s.raw) return;

                    if (!params.ignoreSort) {
                        s.sortRawData(s.orderBy);
                    }

                    console.time("calculateImageBinding");
                    var __lv_path = require('path');
                    var __lv_tags = {};
                    var exts = {};
                    s.all = [];
                    syncSidebarFromScope();
                    s.untagged = [];
                    s.unfiledCount = 0;
                    s.untaggedCount = 0;
                    s.trash = [];
                    syncSidebarFromScope();
                    syncListFromScope();
                    s.folderMappings = {};
                    s.tagsSuggestion = [];
                    s.folderList = [];
                    syncSidebarFromScope();
                    s.lockedImages = {};

                    let ancestorsCache = {};
                    let defaultFolderCoverIdMap = {};

                    eagle.utils.tree.walk(s.folders, 'children', function(folder, parent, depth) {

                        if (folder && parent) {
                            folder.parent = parent.id;
                        }

                        // 列表版本 Folders
                        s.folderList.push(folder);
                        syncSidebarFromScope();

                        // 去除重複的資料夾
                        folder.children = $filter('unique')(folder.children, 'id');
                        folder.imagesMappings = {};
                        folder.images = [];
                        folder.imageCount = 0;
                        folder.depth = depth;
                        folder.descendantImageCount = 0;

                        if (!folder.pinyin && typeof folder.name === "string") {
                            folder.pinyin = tinyPinyin.convertToPinyin(folder.name);
                        }

                        if (folder.tags && folder.tags.length > 0) {
                            folder.tags.forEach(function(tag) {
                                s.tagsSuggestion.push({
                                    value: tag,
                                    text: tag
                                });
                            });
                        }

                        ancestorsCache[folder.id] = s.getAncestorFolders(folder, [folder]);

                        s.folderMappings[folder.id] = folder;
                    });

                    eagle.utils.tree.walk(s.folders, 'children', function(folder, parent) {
                        folder.extendTags = s.getExtendTags(folder, []);
						folder.covers = [];
                    });


                    eagle.utils.tree.walk(s.smartFolders, 'children', function (smartFolder, parent, depth) {
                        s.smartFolderMappings[smartFolder.id] = smartFolder;
                    });

                    // 重新建立圖片關係
                    for (var rindex = 0; rindex < s.raw.length; rindex++) {
                        var __lv_image = s.raw[rindex];

                        if (!s.itemMappings[__lv_image.id]) {
                            s.itemMappings[__lv_image.id] = __lv_image;
                        }

                        if (__lv_image.isDeleted) {
                            s.trash.push(__lv_image);
                            syncSidebarFromScope();
                            syncListFromScope();
                        }
						else {

                            // 計算資料夾圖片總數
                            if (__lv_image.folders && __lv_image.folders.length > 0) {
                                var increaseAncestors = {};
                                __lv_image.folders.forEach(function(__lv_folderId) {
                                    var folder = s.folderMappings[__lv_folderId];
                                    if (folder) {
                                        folder.imageCount++;

                                        if (folder.password && !folder.isUnLock) {
                                            s.lockedImages[__lv_image.id] = true;
                                        }

                                        // 祖先们也都 + 1 , 记录在其他栏位上
                                        var ancestors = ancestorsCache[folder.id] || s.getAncestorFolders(folder, [folder]);
                                        ancestors.forEach(function (ancestor) {
                                            // 避免重复加总
                                            if (increaseAncestors[ancestor.id]) {
                                                return;
                                            }
                                            if (!ancestor.descendantImageCount) ancestor.descendantImageCount = 0;
                                            ancestor.descendantImageCount++;
                                            increaseAncestors[ancestor.id] = true;

                                            if (ancestor.password && !ancestor.isUnLock) {
                                                s.lockedImages[__lv_image.id] = true;
                                            }
                                        });
                                    }
                                });
                            }

                            if (!s.lockedImages[__lv_image.id]) {
                                s.all.push(__lv_image);
                                syncSidebarFromScope();
                                exts[__lv_image.ext] = true;
                                if (__lv_image.tags && __lv_image.tags.length == 0) {
                                    s.untaggedCount++;
                                }

                                if (!__lv_image.folders) {
                                    s.unfiledCount++;
                                }
                                else if (__lv_image.folders.length === 0) {
                                    s.unfiledCount++;
                                }
                                else {
                                    // 修复异常 folders
                                    if (__lv_image.folders.length === 1 && !s.folderMappings[__lv_image.folders[0]]) {
                                        if (s.libraryModificationTime && __lv_image.lastModified && __lv_image.lastModified < s.libraryModificationTime) {
                                            __lv_image.folders = [];
                                            s.unfiledCount++;
                                        }
                                    }
                                    else if (__lv_image.folders[0] === null || __lv_image.folders[1] === null) {
										__lv_image.folders = [...new Set(__lv_image.folders)].filter(function (obj) { return obj != null; });
										if (__lv_image.folders.length === 0) {
											s.unfiledCount++;
											try {
												electronLog && electronLog.error(`[app] ${__lv_image.id} 's folder properity is incorrect[2], move to Uncategorized`);
											} catch (err) {}
										}
                                    }
                                }
                            }

                            if (!__lv_image.tags) {
                                __lv_image.tags = [];
                            }
                        }

						

                        if (!__lv_image.isDeleted && __lv_image.tags && __lv_image.tags.length > 0) {
                            if (!s.lockedImages[__lv_image.id]) {
                                __lv_image.tags.forEach(function(tag) {
                                    var tagName = tag;
                                    if (!tagName || tagName.length > 500) return;
                                    var tempTag = __lv_tags[tagName];
                                    if (!tempTag) {
                                        __lv_tags[tagName] = {
                                            name: tag,
                                            imageCount: 0,
                                            groups: []
                                        };
                                        tempTag = __lv_tags[tagName];
                                    }
                                    tempTag.imageCount++;
                                });
                            }
                        }

						if (__lv_image.folders && __lv_image.folders.length > 0) {
                            for (var i = 0; i < __lv_image.folders.length; i++) {
                                if (__lv_image.isDeleted) continue;
                                if (__lv_image.noPreview) continue;
								if (s.lockedImages[__lv_image.id]) continue;
                                // txt 不支持做为封面
                                if (__lv_image.ext === 'txt') continue;
                                var __lv_folderId = __lv_image.folders[i];
                                var folder = s.folderMappings[__lv_folderId];
                                if (folder) {
                                    if (!defaultFolderCoverIdMap[__lv_folderId]) {
                                        defaultFolderCoverIdMap[__lv_folderId] = __lv_image.id;
                                    }
                                }
                            }
                        }
                    }

                    // 計算當前資料有哪些檔案類型
                    var extList = [];
                    Object.keys(exts).map(function(key) {
                        extList.push(key);
                    });

                    extList = extList.sort();
                    eagle.filter.filterTypes = [...extList, ...eagle.filter.buildInTypes];
                    syncFilterFromScope();
                    eagle.filter.filterTypes = [...new Set(eagle.filter.filterTypes)];
                    syncFilterFromScope();

                    // 如果祖先门没有封面，补上封面
                    eagle.utils.tree.walk(s.folders, 'children', function(folder, parent) {
                        try {
                            let converId = folder.coverId || defaultFolderCoverIdMap[folder.id];
                            if (!folder.covers) folder.covers = [];
                            if (converId && s.itemMappings[converId]) {
                                var coverImage = s.itemMappings[converId];
                                var __lv_thumbnailPath = FileUrlHelper.getThumbnailUrl(coverImage);
                                let pos = "";
                                if (coverImage.fontMetas) {
                                    pos = `center`;
                                }
                                else if (AUDIO_TYPES[coverImage.ext]) {
                                    pos = `audio center;`;
                                }
                                folder.covers[0] = `<img class="sub-folder-cover ${pos}" src="${__lv_thumbnailPath}" style="aspect-ratio: ${coverImage.width / coverImage.height};">`;
                                if (!parent?.covers?.length) {
                                    parent.covers = [`<img class="sub-folder-cover ${pos}" src="${__lv_thumbnailPath}" style="aspect-ratio: ${coverImage.width / coverImage.height};">`];
                                }
                            }
                            if (folder.covers.length == 0) {
                                folder.children.forEach(function (child) {
                                    Array.prototype.push.apply(folder.covers, child.covers);
                                    if (folder.covers.length > 3) return;
                                });
                            }
                        }
                        catch (err) {}
                    });

                    // 初始化 Tags
                    __lv_TagManager.rawdata = [];
                    Object.keys(__lv_tags).forEach(function(key) {
                        if (!__lv_pinyinCache[key]) {
                            if (isString(__lv_tags[key].name)) {
                                __lv_pinyinCache[key] = tinyPinyin.convertToPinyin(__lv_tags[key].name);
                            }
                        }
                        __lv_tags[key].pinyin = __lv_pinyinCache[key];
                        if (key) {
                            __lv_TagManager.rawdata.push(__lv_tags[key]);
                        }
                    });

                    __lv_TagManager.calculateTags();
                    s.tags = __lv_TagManager.rawdata;
                    syncSidebarFromScope();

                    if (!s.tags) {
                        s.tags = [];
                        syncSidebarFromScope();
                    }

                    console.timeEnd("calculateImageBinding");
                    if (callback) {
                        callback();
                    }
                }
                catch (err) {
                    electronLog && electronLog.error(err.stack || err);
                }
            }, duration);
        }).apply(null, args);
  };

  fns["rotateImage"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function (event, __lv_image) {

            if (s.isCropMode) return;

            if (__lv_lastRotateImage === __lv_image) {
                clearTimeout(__lv_rotateImageTimeout);
                clearTimeout(__lv_rotateImageSaveTimeout);
            }

            if ($("canvas#detail-image").length > 0) {
                alert("Not support apng file format.");
                return;
            }

            let rotatedImage = __lv_image || s.selected[0];
            if (!rotatedImage) return;

            if (s.preferences.habits.imageRotateMode === 'write') {
                const [originalWidth, originalHeight] = [rotatedImage.width, rotatedImage.height];
                [rotatedImage.width, rotatedImage.height] = [originalHeight, originalWidth];
            }
            
            var degree = $("#detail-image").data("degree") || 0;
            
            // 鼠标点击
            if (event.type === "click") {
                if (!event.shiftKey) {
                    degree = degree - 90;
                    detailZoom()?.rotate( {angle: -90, item: rotatedImage});
                }
                else {
                    degree = degree + 90;
                    detailZoom()?.rotate( {angle: 90, item: rotatedImage});
                }
            }
            else {
                degree = degree - 90;
                detailZoom()?.rotate( {angle: -90, item: rotatedImage});
            }

            $("#detail-image").data("degree", degree);
            $("#detail-image").css({
                "transform": `rotate(${degree}deg) scaleX(1) scaleY(1)`,
                "transition": "transform 100ms ease-in-out"
            });

            __lv_lastRotateImage = rotatedImage;

            s.isRotating = true;
            __lv_rotateImageSaveTimeout = setTimeout(async function () {

                // 检查度数，如果不为 0 并且设定为写入文件时执行写入动作
                if (degree % 360 != 0 && s.preferences.habits.imageRotateMode === 'write') {
                    var rawPath = FileUrlHelper.getRawPath(rotatedImage);
                    if (!rawPath) {
                        s.isRotating = false;
                        return;
                    }

                    try {
                        fs.accessSync(rawPath, fs.W_OK)
                    }
                    catch (err) {
                        s.isRotating = false;
                        rotatedImage.width = originalWidth;
                        rotatedImage.height = originalHeight;
                        $("#detail-image").css({
                            "transform": `none`,
                            "transition": "none"
                        });

                        swal({
                            html: `
                                <div class="alert">
                                    <div class="alert-icon error"></div>
                                    <h4 class="alert-title">Error</h4>
                                    <p class="alert-desc">${err?.message}</p>
                                </div>
                            `,
                            showCloseButton: false, showCancelButton: true, allowOutsideClick: false, focusConfirm: false, focusCancel: false, padding: 24,
                            width: 400,
                            customClass: "alert-box",
                            confirmButtonColor: "#1373FB", // 1373FB
                            cancelButtonColor: "#777777",
                            confirmButtonText: i18n.__('general.ok'),
                            cancelButtonText: i18n.__("general.cancel"),
                        }).then(() => {});
                        return;
                    }

                    // 使用統一的 rotateImage utils 處理所有格式
                    try {
                        const rotateImage = require(appRoot.path + '/app/js/utils/rotateImage.js');
                        const __lv_result = await rotateImage(rawPath, degree, {
                            onSuccess: function(newWidth, newHeight) {
                                // 如果 utils 返回了新的尺寸，更新圖片尺寸
                                if (newWidth && newHeight) {
                                    rotatedImage.width = newWidth;
                                    rotatedImage.height = newHeight;
                                    s.updateItemView(rotatedImage);
                                    s.relayout();
                                }
                            }
                        });
                        
                        // 旋轉成功
                        s.isRotating = false;
                        delete rotatedImage.orientation;
                        s.updateItemView(rotatedImage);
                        ipcRenderer.send('regenerate-thumbnail', [rotatedImage]);
                        s.$evalAsync();
                        
                        try { 
                            electronLog && electronLog.info(`[app] Rotate image: ${rotatedImage.name}(${rotatedImage.id})`); 
                        } catch (err) {};
                        
                    } catch (err) {
                        // 旋轉失敗，恢復原狀
                        s.isRotating = false;
                        rotatedImage.width = originalWidth;
                        rotatedImage.height = originalHeight;
                        $("#detail-image").css({
                            "transform": `none`,
                            "transition": "none"
                        });
                        
                        console.error('Image rotation failed:', err);
                        alert(err.message || "Image rotation failed.");
                        
                        electronLog && electronLog.error(err.stack || err);
                        s.$evalAsync();
                    }
                }
                else {
                    s.isRotating = false;
                }
            }, 200);
        }).apply(null, args);
  };

  fns["flipImage"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function (event, __lv_image, writeToFile = false) {

            if (s.isCropMode) return;
            var rotatedImage = __lv_image || s.selected[0];
            if (!rotatedImage) return;

            // 直接進行 bitmap 翻轉，不需要狀態追蹤
            var scaleX = 1, scaleY = 1;
            if (event.type === "click") {
                if (!event.shiftKey) {
                    scaleX = -1; // 水平翻轉
                }
                else {
                    scaleY = -1; // 垂直翻轉
                }
            }
            else {
                scaleX = -1; // 預設水平翻轉
            }
            
            // 調用 smoothZoom flip 方法進行 bitmap 翻轉顯示
            detailZoom()?.flip( scaleX, scaleY);

            // 處理檔案寫入功能，根據設定決定是否寫入
            var shouldWriteToFile = writeToFile && s.preferences.habits.imageRotateMode === 'write';
            if (shouldWriteToFile && rotatedImage) {
                // 根據 scaleX 和 scaleY 決定翻轉類型
                var flipType;
                if (scaleX === -1 && scaleY === -1) {
                    flipType = 'both';
                } else if (scaleX === -1) {
                    flipType = 'horizontal';
                } else if (scaleY === -1) {
                    flipType = 'vertical';
                }

                // 使用正確的方式獲取檔案路徑
                var rawPath = FileUrlHelper.getRawPath(rotatedImage);
                if (!rawPath) {
                    console.warn('Cannot get raw path for image:', rotatedImage);
                    return;
                }

                // 載入 flipImage 工具模組並執行翻轉
                try {
                    const flipImageUtil = require(appRoot.path + '/app/js/utils/flipImage.js');
                    flipImageUtil(rawPath, flipType)
                        .then(() => {
                            console.log(`Image flipped (${flipType}) and saved: ${rawPath}`);
                            // 重新生成縮圖
                            ipcRenderer.send('regenerate-thumbnail', [rotatedImage]);
                        })
                        .catch(err => {
                            console.error(`Failed to save flipped image: ${err.message}`);
                        });
                } catch (requireErr) {
                    console.error(`Failed to load flipImage module: ${requireErr.message}`);
                }
            }
        }).apply(null, args);
  };

  fns["saveCrop"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function (saveAsNewFile) {
            var $cropArea = $("#crop-image-tool .crop-area");
            var [top, left] = [$cropArea.css("top").replace("px", ""), $cropArea.css("left").replace("px", "")];
            var [__lv_width, __lv_height] = [$cropArea.width(), $cropArea.height()];
            var croppedImage = s.current;
            var imagePath = FileUrlHelper.getRawPath(croppedImage);

            electronLog.info(`[app] Crop image: ${imagePath}`);

            if (!fs.existsSync(imagePath)) {
                s.cancelCrop();
                electronLog.error(`[app] Image file does not exist`);
                return;
            }
            setTimeout(() => {
                const imageCropper = require(appRoot + '/my_modules/image-cropper');
                imageCropper(imagePath, croppedImage, top, left, __lv_width, __lv_height, function (err, { buffer, base64 }) {
                    electronLog.info(`[app] Prepare to write to file: ${imagePath}`);

                    if (buffer && buffer.length > 0) {

                        if (saveAsNewFile) {
                            let newId = guid();
                            let newFilePath = `${EAGLE_THUMBNAIL_TEMP_PATH}/${newId}.${croppedImage.ext}`;
                            fs.writeFile(newFilePath, buffer, function (err) {
                                let newFile = {
                                    name: croppedImage.name,
                                    path: newFilePath,
                                    lastModified: Date.now(),
                                    tags: croppedImage.tags || [],
                                    folders: croppedImage.folders || [],
                                    url: croppedImage.url || "",
                                    lastModified: croppedImage.modificationTime + 0.1,
                                    modificationTime: croppedImage.modificationTime + 0.1,
                                    star: croppedImage.star,
                                    merged: true
                                };
                                s.uploadFiles([newFile]);
                                s.isCropMode = false;
                                syncDetailFromScope();
                                s.leaveDetailMode();
                                s.$evalAsync();
                            });
                            return;
                        }

                        setTimeout(function () {
                            swal({
                                html: `
                                    <div class="alert">
                                        <div class="alert-image" style="display: flex; justify-content: center;">
                                            <img src="${base64}" style="margin-bottom: 12px;object-fit: scale-down;width: 350px;height: 350px;border-radius: 6px;">
                                        </div>
                                        <h4 class="alert-title">${i18n.__("dialog.cropConfirm.title")}</h4>
                                        <p class="alert-desc">${i18n.__("dialog.cropConfirm.desc")}</p>
                                    </div>
                                `,
                                showCloseButton: false, showCancelButton: true, allowOutsideClick: false, focusConfirm: true, focusCancel: false, padding: 24,
                                width: 400,
                                customClass: "tutorial-modal",
                                cancelButtonColor: "#777777",
                                confirmButtonText: i18n.__("dialog.cropConfirm.saveButton"),
                                cancelButtonText: i18n.__("general.cancel"),
                            }).then(function() {
                                fse.copySync(imagePath, imagePath + ".bk", { preserveTimestamps: true });
                                    fs.writeFile(imagePath, buffer, function (err) {
                                        if (!err) {
                                            fse.removeSync(imagePath + ".bk");
                                            ipcRenderer.send('regenerate-thumbnail', [croppedImage]);
                                            [croppedImage.width, croppedImage.height] = [__lv_width, __lv_height];
                                            s.updateItemView(croppedImage);

                                            // 强制更新相关 folder 封面
                                            if (croppedImage.folders) {
                                                croppedImage.folders.forEach(function (fid) {
                                                    s.resetFolderCover(s.folderMappings[fid]);
                                                });
                                            }

                                            s.calculateImageBinding({ ignoreSort: true }, function () {});
                                            s.relayout();
                                            s.$evalAsync();
                                        }
                                        else {
                                            fse.copySync(imagePath + ".bk", imagePath, { preserveTimestamps: true });
                                            fse.removeSync(imagePath + ".bk");
                                        }
                                        s.isCropMode = false;
                                        syncDetailFromScope();
                                        s.$evalAsync();
                                    });
                            });
                        }, 200);
                    }
                    else {
                        s.isCropMode = false;
                        syncDetailFromScope();
                    }
                });
            }, 500);
        }).apply(null, args);
  };

  // replaceFile（bundle 33333-33456 全体，含 executeFileReplacement/handleError 内层）
  fns["replaceFile"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function () {
        // 檢查是否只選擇了一個檔案
        if (!s.selected || s.selected.length !== 1) return;

        const item = s.selected[0];

        // 使用 dialog.showOpenDialog 讓用戶選擇文件
        dialog.showOpenDialog(currentWindow, {
            title: i18n.__('Dialog.ReplaceFile.SelectTitle'),
            properties: ['openFile'],
            filters: [{ name: 'All Files', extensions: ['*'] }]
        }).then(function(result) {
            if (result.canceled || !result.filePaths?.length) return;

            const newFilePath = result.filePaths[0];
            const newFileName = path.basename(newFilePath);

            // 使用 swal 確認對話框
            swal({
                html: `
                    <div class="alert">
                        <div class="alert-icon warning"></div>
                        <h4 class="alert-title">${i18n.__("Dialog.ReplaceFile.Title")}</h4>
                        <p class="alert-desc">${i18n.__("Dialog.ReplaceFile.Description").replace("{fileName}", newFileName)}</p>
                    </div>
                `,
                showCloseButton: false,
                showCancelButton: true,
                allowOutsideClick: false,
                focusConfirm: true,
                focusCancel: false,
                padding: 24,
                width: 400,
                customClass: "alert-box",
                cancelButtonColor: "#777777",
                confirmButtonText: i18n.__("Dialog.ReplaceFile.Confirm"),
                cancelButtonText: i18n.__("general.cancel"),
            }).then(function (confirm) {
                if (!confirm) return;

                // 執行替換邏輯
                executeFileReplacement(item, newFilePath);
            }, function () {
                // 使用者取消
            });
        }).catch(function(err) {
            electronLog.error('[App] Failed to open file dialog:', err);
        });

        function executeFileReplacement(item, newFilePath) {
            const libraryPath = getBodyScope().libraryPath;
            const currentFilePath = path.join(libraryPath, 'images', item.id + '.info', item.name + '.' + item.ext);
            const backupFilePath = currentFilePath + '.bk';

            electronLog.info('[App] User replace file %s with %s', currentFilePath, newFilePath);

            // Step 1: 備份原文件
            fs.rename(currentFilePath, backupFilePath, function(err) {
                if (err) {
                    electronLog.error('[App] Failed to backup original file:', err);
                    handleError(err);
                    return;
                }

                // Step 2: 複製新文件到原位置
                const newExt = path.extname(newFilePath).slice(1).toLowerCase() || 'unknown';
                const targetPath = path.join(path.dirname(currentFilePath), item.name + '.' + newExt);

                fs.copyFile(newFilePath, targetPath, function(copyErr) {
                    if (copyErr) {
                        electronLog.error('[App] Failed to copy new file:', copyErr);
                        // 恢復原文件
                        fs.rename(backupFilePath, currentFilePath, function(restoreErr) {
                            if (restoreErr) {
                                electronLog.error('[App] Failed to restore original file:', restoreErr);
                            }
                            handleError(copyErr);
                        });
                        return;
                    }

                    electronLog.info('[App] File replacement successful');

                    // Step 3: 更新item屬性
                    item.ext = newExt;

                    // Step 4: 同步到背景進程
                    if (typeof ayncsImagesChange === 'function') {
                        ayncsImagesChange([item]);
                    }

                    getBodyScope().updateItemListView(item);


                    // Step 5: 更新 UI
                    getBodyScope().$evalAsync();

                    // Step 6: 刪除備份文件
                    fs.unlink(backupFilePath, function(unlinkErr) {
                        if (unlinkErr) {
                            electronLog.warn('[App] Failed to delete backup file:', unlinkErr);
                            // 備份文件刪除失敗不影響主流程
                        }
                    });

                    setTimeout(() => {
                        // 刷新缩略图
                        s.regenerateThumbnailQueue.push(item);
                        ayncsImagesGenerateThumbnail([item]);
                    }, 500);
                });
            });
        }

        function handleError(err) {
            electronLog.error('[App] Failed to replace file:', err);
            swal({
                type: 'error',
                title: i18n.__('Dialog.ReplaceFile.ErrorTitle'),
                text: i18n.__('Dialog.ReplaceFile.ErrorMessage'),
                confirmButtonText: i18n.__('general.ok')
            });
        }
    }).apply(null, args);
  };
}
