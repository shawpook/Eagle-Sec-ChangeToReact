/**
 * c3：EagleController 函数域逐字移植（React 调用面全量 155 函数）。提取自 bundle
 * EagleController link 体（brace 精确扫描），机械替换：$scope → s（makeControllerFns
 * (getScope) 注入，闭包变量不占实参位）、$rootScope → s.$root。
 * link 级共享 var 声明提升至闭包顶层（__lv_ 前缀防与 shim 重名；代码上下文感知改名）、
 * 初始化惰性首调执行；link 级辅助函数逐字导出。callScope 路由优先命中本表（hooks.ts），
 * bundle 同名函数退为后备。cZ 时随状态一并迁入 AppCore。
 */
// @ts-nocheck
import { getBodyScope } from '../global/scopeBridge';
import { IPCHelper } from './ipcHelper';
// b1-8 裸引用审计修复：controller 闭包裸调改走 machinery 移植版直调（ESM 循环依赖——
// 双侧均为函数声明提升，无顶层执行面，运行时安全；colliding 名（calcuteContainFolders/
// toggleCurrentLevel{Folders,SmartFolders}）不经 scope 面，避免覆盖 bundle $scope 同名体）
import { machineryGetVideoPlayer, machineryCalcRotateDegree, machineryGetFolderParentChilder,
  machineryGetArroundBox, machineryGetAncestorSmartFolders, machineryCalcuteContainFolders,
  machineryToggleAllFolders, machineryToggleCurrentLevelFolders, machineryToggleAllSmartFoldersInner,
  machineryToggleCurrentLevelSmartFoldersInner, machineryFilterSidebarItem } from './dataMachinery';

// ── bundle 模块级 const shim（18982-19045 区域子集；按批次函数实际引用引入）──
const _req: any = (n: string) => { try { return (window as any).require(n); } catch (err) { return undefined; } };
const EagleConfig: any = (window as any).EagleConfig || {};
const DATE_1_DAY = 86400000;
const DATE_2_DAY = 86400000 * 2;
const DATE_7_DAY = 86400000 * 7;
const DATE_30_DAY = 86400000 * 30;
const DATE_90_DAY = 86400000 * 90;
const DATE_365_DAY = 86400000 * 365;
const VIDEO_TYPES: any = {}; (EagleConfig.VIDEO_FORMATS || []).forEach(function (ext: string) { VIDEO_TYPES[ext] = true; });
const AUDIO_TYPES: any = {}; (EagleConfig.AUDIO_FORMATS || []).forEach(function (ext: string) { AUDIO_TYPES[ext] = true; });
const FONT_TYPES: any = {}; (EagleConfig.FONT_FORMATS || []).forEach(function (ext: string) { FONT_TYPES[ext] = true; });
const SPECIAL_TYPES: any = { mhtml: true, html: true, fbx: true, obj: true, 'glb': true, '3ds': true, '3mf': true, 'dae': true, 'ifc': true, 'ply': true, 'stl': true, af: true, afpub: true, afdesign: true, afphoto: true, fig: true, cdr: true, skp: true, dwg: true, blend: true, c4d: true, clip: true, prd: true, exr: true, hdr: true, skt: true, ppt: true, pptx: true, potx: true, docx: true, doc: true, xls: true, xlsx: true, eddx: true, emmx: true, number: true, page: true, txt: true };
const emojiRegex: any = /\p{Emoji_Presentation}|\p{Extended_Pictographic}|([0-9]\u{FE0F}\u{20E3})|([*#\u{1F51F}]\u{FE0F}\u{20E3})/gmu;
const fs: any = _req('fs');
const remainingFilenameLength: any = (function () {
  const arp: any = _req('app-root-path');
  try { return arp && arp.path ? _req(arp.path + '/app/js/utils/remainingFilenameLength.js') : undefined; } catch (err) { return undefined; }
})();
// b1-8 裸引用审计修复：sanitize 为 bundle 22746 函数内 require(appRoot + ...) 隐式全局
// ——controllerFns 4 处调用（244/245/5732/6010）经本模块 shim 解析（同 remainingFilenameLength 模式）
const sanitize: any = (function () {
  const arp: any = _req('app-root-path');
  try { return arp ? _req(String(arp) + '/my_modules/sanitize-filename') : undefined; } catch (err) { return undefined; }
})();
const currentWindow: any = (window as any).electron?.remote?.getCurrentWindow?.() || _req('@electron/remote')?.getCurrentWindow?.();
const electronSettings: any = (window as any).electronSettings;
const electronLog: any = (window as any).electronLog || console;
const ipcRenderer: any = (window as any).__eagleIpc || (window as any).electron?.ipcRenderer;
const i18n: any = (window as any).i18n;
let preferences: any = (window as any).electronSettings?.getPreferences?.() || {};
const FixUtils: any = {};
const dialog: any = _req('@electron/remote')?.dialog;
const systemPreferences: any = _req('@electron/remote')?.systemPreferences;
// Angular 注入服务 shim（$timeout 语义 = 延时执行 + digest）
const $timeout: any = (fn: any, ms?: number) => setTimeout(() => {
  try { if (typeof fn === 'function') fn(); } finally { try { getBodyScope().$apply(); } catch (err) { /* noop */ } }
}, ms || 0);
const $filter: any = (name: string) => {
  const s: any = getBodyScope();
  return s && s.$root && s.$root.$filter ? s.$root.$filter(name) : undefined;
};

export function makeControllerFns(getScope: () => any) {
  const fns: Record<string, any> = {};

  // link 级共享状态声明（闭包顶层——所有移植函数共享，同原 link 作用域语义）
  var __lv_onTagSidebarResizeTimeout;
  var __lv_pinyinCache;
  var __lv_calculateImageBindingTimeout;
  var __lv_searchTimeout;
  var __lv_keywordModelTimeout;
  var __lv_updateZoomRatioTimeout;
  var __lv_zoomInitTimeout;
  var __lv_updateListHeight;
  var __lv_saveListHeight;
  var __lv_rotateImageTimeout;
  var __lv_rotateImageSaveTimeout;
  var __lv_lastRotateImage;
  var __lv_nextTimeout;
  var __lv_prevTimeout;
  var __lv_openUnfiledTimeout;
  var __lv_setLastFolder;
  var __lv_openSmartFolderTimeout;
  var __lv_updateSidebarListTimeout;
  var __lv_calculateFilterCountsTimeout;
  var __lv_cleanSelectedTimeout;
  var __lv_start;
  var __lv_image;
  var __lv_video;
  var __lv_autoplay;
  var __lv_src;
  var __lv_vq;
  var __lv_mute;
  var __lv_thumbnailPath;
  var __lv_offset;
  var __lv_x;
  var __lv_y;
  var __lv_width;
  var __lv_height;
  var __lv_delay;
  var __lv_comment;
  var __lv_offsetY;
  var __lv_html;
  var __lv_path;
  var __lv_transformsJSON;
  var __lv_file;
  var __lv_packPath;
  var __lv_libraryPath;
  var __lv_fds;
  var __lv_folderId;
  var __lv_filePath;
  var __lv_ext;
  var __lv_files;
  var __lv_now;
  var __lv_tags;
  var __lv_group;
  var __lv_result;
  var __lv_selected;
  var __lv_idx;
  var __lv_target;

  let linkVarsInited = false;
  const initLinkVars = () => {
    if (linkVarsInited) return;
    linkVarsInited = true;
    // 初始化（原 link 期赋值，$scope 引用改为 getBodyScope()）
    try {
      pinyinCache = {};
      updateListHeight = function (height) {
            clearTimeout(updateListHeightTimeout);
            updateListHeightTimeout = setTimeout(function () {
                $("#box-container").attr("box-size", height);
            }, 50);
        }

        var saveListHeightTimeout;
      saveListHeight = function (height) {
            clearTimeout(saveListHeightTimeout);
            saveListHeightTimeout = setTimeout(function() {
                if (getBodyScope().currentFolder) {
                    localStorage.setItem("eagle.list.thumbSize." + getBodyScope().currentFolder.id, height);
                } else if (getBodyScope().currentSmartFolder) {
                    localStorage.setItem("eagle.list.thumbSize." + getBodyScope().currentSmartFolder.id, height);
                } else if (getBodyScope().currentTag) {
                    localStorage.setItem("eagle.list.thumbSize." + getBodyScope().currentTag, height);
                } else if (getBodyScope().viewMode === 'all') {
                    localStorage.setItem("eagle.list.thumbSize.all", height);
                } else if (getBodyScope().viewMode === 'unfiled') {
                    localStorage.setItem("eagle.list.thumbSize.unfiled", height);
                } else if (getBodyScope().viewMode === 'untagged') {
                    localStorage.setItem("eagle.list.thumbSize.untagged", height);
                } else if (getBodyScope().viewMode === 'trash') {
                    localStorage.setItem("eagle.list.thumbSize.trash", height);
                } else if (getBodyScope().viewMode === 'random') {
                    localStorage.setItem("eagle.list.thumbSize.random", height);
                } else if (getBodyScope().viewMode === 'recent') {
                    localStorage.setItem("eagle.list.thumbSize.recent", height);
                }
            }, 150);
        }

        var changeListHeightTimeout;
      setLastFolder = _.debounce(function setLastFolder (folderId) {
            if (!folderId) {
                localStorage.removeItem(`eagle.lastFolder.${getBodyScope().rootDir}`);
            }
            else {
            	s.setViewMode("all");
                localStorage.setItem(`eagle.lastFolder.${getBodyScope().rootDir}`, folderId);
            }
        }, 500);
      start = countOfSend * once;
      image = items[i];
      video = $('<video/>', {
            id: 'video',
            src: $bodyScope.getRawUrl(image),
            type: 'video/mp4',
            controls: false,
            autoplay: true,
            muted: muted,
            draggable: true,
            loop: true
        });
      autoplay = localStorage["listAudioAutoPlay"] != 'false';
      src = $image.attr("src");
      vq = "";
      mute = (muted) ? "1" : "0";
      thumbnailPath = FileUrlHelper.getLastestThumbnailUrl(image);
      offset = $(HoverPreview.lastElem).offset();
      x = offset.left;
      y = offset.top;
      width = Math.min(480, image.width);
      height = Math.min(480, image.height);
      delay = HoverPreview.getDelay(this);
      comment = commentScope.comment;
      offsetY = 0;
      html = $(that).html();
      path = event.dataTransfer.files[0].path;
      transformsJSON = JSON.stringify(transforms);
      file = files[0];
      packPath = file.path;
      libraryPath = file.path;
      fds = [];
      folderId = _.get($scope, 'currentFolder.id');
      filePath = file.path;
      ext = getExt({path: filePath});
      files = node.files;
      now = Date.now();
      tags = Object.keys(getBodyScope().selectedTags).map(function(key) { return key; });
      group = angular.element(event.target).scope().group;
      result = currentTagGroup.tags.filter(function (tag, tidx) {
            var idx = (selectedTags.indexOf(tag));
            if (idx !== -1) {
                if (index > tidx) {
                    shift++;
                }
                return false;
            }
            else {
                return true;
            }
        });
      selected = getBodyScope().selected;
      idx = getBodyScope().allData.indexOf(targetItem);
    } catch (err) { /* 初始化失败不阻塞（bundle 后备仍在） */ }
  };

  fns["activateFont"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function (font, {showNotify, updateView}) {
            if (!font) return;
            if (font.activating || font.deactivating) return;
            var name = font.name + "." + font.ext;
            var key = Object.keys(font.fontMetas.postScriptName)[0];
            var postScriptName = font.fontMetas.postScriptName?.[key];
            var fullName = font?.fontMetas?.fullName?.en || font?.fontMetas?.compatibleFullName?.en;
            var folderPath = __lv_path.normalize(s.libraryPath + "/images/" + font.id + ".info/");
            var rawPath = __lv_path.normalize(folderPath + name);
            var outPath = `$${fontFolder}/$${postScriptName}.$${font.ext}`;
            if (process.platform === 'darwin') {
                if (!fs.existsSync(outPath)) {
                    fse.copySync(rawPath, outPath);
                    installedFonts[`$${postScriptName}_.$${font.ext}`] = true;
                    eagle.filter.filterCounts['fontActivated']['activated']++;
                    eagle.filter.filterCounts['fontActivated']['deactivated']--;
                }
                if (updateView) {
                    s.updateItemsView([font]);
                }
            }
            else {
                ipcRenderer.send("activate-windows-font", {
                    fontId: font.id,
                    fontName: font.name,
                    postScriptName: sanitize(postScriptName),
                    fullName: fullName ?? sanitize(postScriptName),
                    fontExt: font.ext,
                    fontPath: rawPath
                });
                font.activating = true;
                s.updateItemsView([font]);
            }

            ipcRenderer.send('electron-info', `[app] Install font: $${rawPath}`);
            analytics.event("Font", "Install");

            if (showNotify) {
                s.notify({
                    message: $filter('i18n')("notify.font.activate", [
                            { "property": "name", "value": font.name }
                        ]),
                    duration: 1000
                });
            }
        }).apply(null, args);
  };

  fns["addToRecentFolders"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function (folderIDs) {
            if (!folderIDs || folderIDs.length == 0 ) return;
            var recentMoveFolders = localStorage.getItem("recentMoveFolders");
            if (recentMoveFolders) {
                recentMoveFolders = JSON.parse(recentMoveFolders);
            }
            else {
                recentMoveFolders = [];
            }
            folderIDs.forEach(function (folderID) {
                recentMoveFolders.unshift(folderID);
            });
            recentMoveFolders = recentMoveFolders.unique();
            recentMoveFolders = recentMoveFolders.slice(0, 50);

            localStorage.setItem("recentMoveFolders", JSON.stringify(recentMoveFolders));
        }).apply(null, args);
  };

  fns["calculateDateFilter"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function () {

            eagle.filter.filterCounts.import = {
                'today': 0,
                'yesterday': 0,
                '7day': 0,
                '30day': 0,
                '90day': 0,
                '365day': 0,
                "year/month": {},
            };

            eagle.filter.filterCounts.mtime = {
                'today': 0,
                'yesterday': 0,
                '7day': 0,
                '30day': 0,
                '90day': 0,
                '365day': 0,
                "year/month": {},
            };

            let __lv_now = Date.now();
            let today = new Date();
            today.setHours(0,0,0);
            let todayTime = today.getTime();
            let yesterdayTime = todayTime - DATE_1_DAY;

            for (let i = 0; i < s.allData.length; i++) {
                const __lv_image = s.allData[i];
                if (__lv_image.modificationTime > todayTime) eagle.filter.filterCounts['import']['today']++;
                else if (__lv_image.modificationTime < todayTime && __lv_image.modificationTime > yesterdayTime) eagle.filter.filterCounts['import']['yesterday']++;
                if (__lv_now - __lv_image.modificationTime < DATE_7_DAY) eagle.filter.filterCounts['import']['7day']++;
                if (__lv_now - __lv_image.modificationTime < DATE_30_DAY) eagle.filter.filterCounts['import']['30day']++;
                if (__lv_now - __lv_image.modificationTime < DATE_90_DAY) eagle.filter.filterCounts['import']['90day']++;
                if (__lv_now - __lv_image.modificationTime < DATE_365_DAY) eagle.filter.filterCounts['import']['365day']++;

                let importDate = new Date(__lv_image.modificationTime);
                let importYear = importDate.getFullYear();
                let importMonth = ("" + (importDate.getMonth() + 1)).padStart(2, "0");
                let dateObj = eagle.filter.filterCounts['import']['year/month'];
                let dateKey = `$${importYear}/$${importMonth}`;
                if (importYear) {
                    if (!dateObj[dateKey]) {
                         dateObj[dateKey] = 0;
                    }
                    dateObj[dateKey]++;
                }

                // 修改时间
                var mtime = __lv_image.mtime || __lv_image.modificationTime;
                if (mtime) {
                    if (mtime > todayTime) eagle.filter.filterCounts['mtime']['today']++;
                    else if (mtime < todayTime && mtime > yesterdayTime) eagle.filter.filterCounts['mtime']['yesterday']++;
                    if (__lv_now - mtime < DATE_7_DAY) eagle.filter.filterCounts['mtime']['7day']++;
                    if (__lv_now - mtime < DATE_30_DAY) eagle.filter.filterCounts['mtime']['30day']++;
                    if (__lv_now - mtime < DATE_90_DAY) eagle.filter.filterCounts['mtime']['90day']++;
                    if (__lv_now - mtime < DATE_365_DAY) eagle.filter.filterCounts['mtime']['365day']++;

                    let modifyDate = new Date(mtime);
                    let modifyYear = modifyDate.getFullYear();
                    let modifyMonth = ("" + (modifyDate.getMonth() + 1)).padStart(2, "0");
                    if (modifyYear) {
                        if (!eagle.filter.filterCounts['mtime']['year/month'][`$${modifyYear}/$${modifyMonth}`]) {
                             eagle.filter.filterCounts['mtime']['year/month'][`$${modifyYear}/$${modifyMonth}`] = 0;
                        }
                        eagle.filter.filterCounts['mtime']['year/month'][`$${modifyYear}/$${modifyMonth}`]++;
                    }
                }
            }
        }).apply(null, args);
  };

  fns["calculateFilterCounts"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function () {
            
            clearTimeout(__lv_calculateFilterCountsTimeout);
            __lv_calculateFilterCountsTimeout = setTimeout(function () {
                console.time("calculateFilterCounts");
                eagle.filter.resetFilterCounts();
                let __lv_now = Date.now();
                for (let i = 0; i < s.allData.length; i++) {
                    const __lv_image = s.allData[i];
                    s.updateFilterCounts(__lv_image, 1, __lv_now);
                }
                console.timeEnd("calculateFilterCounts");
                s.$evalAsync();
            }, 500);

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
                    s.untagged = [];
                    s.unfiledCount = 0;
                    s.untaggedCount = 0;
                    s.trash = [];
                    s.folderMappings = {};
                    s.tagsSuggestion = [];
                    s.folderList = [];
                    s.lockedImages = {};

                    let ancestorsCache = {};
                    let defaultFolderCoverIdMap = {};

                    eagle.utils.tree.walk(s.folders, 'children', function(folder, parent, depth) {

                        if (folder && parent) {
                            folder.parent = parent.id;
                        }

                        // 列表版本 Folders
                        s.folderList.push(folder);

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
												electronLog && electronLog.error(`[app] $${__lv_image.id} 's folder properity is incorrect[2], move to Uncategorized`);
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
                    eagle.filter.filterTypes = [...new Set(eagle.filter.filterTypes)];

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
                                folder.covers[0] = `<img class="sub-folder-cover $${pos}" src="$${__lv_thumbnailPath}" style="aspect-ratio: $${coverImage.width / coverImage.height};">`;
                                if (!parent?.covers?.length) {
                                    parent.covers = [`<img class="sub-folder-cover $${pos}" src="$${__lv_thumbnailPath}" style="aspect-ratio: $${coverImage.width / coverImage.height};">`];
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
                            if (_.isString(__lv_tags[key].name)) {
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

                    if (!s.tags) {
                        s.tags = [];
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

  fns["calcuteContainFolders"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function (data) {

            var __lv_result = machineryCalcuteContainFolders(s, data);
            var foldersMappings = __lv_result.containFoldersMappings;
            
            s.containFolders = [];

            if (__lv_result.noFoldersCount > 0) {
                s.containFolders.push({
                    id: "NoFolders",
                    name: i18n.__('general.pages.unfiled'),
                    isNoFolder: true,
                    imageCount: __lv_result.noFoldersCount
                });
            }

            eagle.utils.tree.walk(s.folders, 'children', function (folder, parent, depth) {
                var __lv_folderId = folder.id;
                if (foldersMappings[__lv_folderId]) {
                    s.containFolders.push(foldersMappings[__lv_folderId]);
                }
            });
        }).apply(null, args);
  };

  fns["cancelAllTasks"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function() {
            s.uploadQueue = [];
            s.finishQueue = [];

            (window as any).IPCHelper.send('cancel.all');
            // 讓 Palette Queue 繼續
            setTimeout(function () {
                (window as any).IPCHelper.send('palette-resume');

                // 针对尚未分析颜色的图片，进行颜色分析
                var images = [];
                var ONE_DAY = 1000 * 60 * 60 * 24;
                var __lv_now = Date.now();
                for (var rindex = 0; rindex < s.raw.length; rindex++) {
                    var __lv_image = s.raw[rindex];
                    // 不需要判断超过 1 天的图片
                    if (__lv_now - __lv_image.modificationTime > ONE_DAY) { break; }
                    if (__lv_image.hasOwnProperty("processingPalette") && !__lv_image.palettes) {
                        images.push(__lv_image);
                    }
                }
                console.log(`发现 $${images.length} 张图片需要刷新缩略图, 省略了 $${s.raw.length - rindex} 次判断`);
                if (images.length > 0) {
                    ipcRenderer.send('check.image.palette', images);
                }

                if (currentWindow && !currentWindow.isDestroyed()) {
                    currentWindow.setProgressBar(-1);
                }
            }, 1000);
            $("#upload-queue-progress").removeClass("open");
            $("body").removeClass("is-uploading");
        }).apply(null, args);
  };

  fns["changeOrderBy"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function (orderBy) {
            if (s.currentFolder) {
                s.setFolderOrder(s.currentFolder, orderBy);
                try { electronLog && electronLog.info(`[app] Change folder order to “$${s.currentFolder.name}($${s.currentFolder.id})” order by: $${orderBy}`); } catch (err) {};
            }
            else if (s.currentSmartFolder) {
                s.setSmartFolderOrder(s.currentSmartFolder, orderBy);
                try { electronLog && electronLog.info(`[app] Change smart-folder order to “$${s.currentSmartFolder.name}($${s.currentSmartFolder.id})” order by: $${orderBy}`); } catch (err) {};
            }
            else {
                if (orderBy) {
                    s.orderBy = orderBy;
                    s.orderByName = i18n.__(`context.order.orderBy>$${s.orderBy.toLowerCase()}`);
                    localStorage.setItem(`eagle.list.orderBy.$${s.rootDir}`, s.orderBy);
                    s.sortRawData(s.orderBy);
                    s.rebindRefresh();
                    s.$evalAsync();
                    try { electronLog && electronLog.info(`[app] Change global list order to: $${orderBy}`); } catch (err) {};
                }
            }
            updateCurrentOrderAndIncrease();
        }).apply(null, args);
  };

  fns["changeSidebarIndex"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function (node) {
            const folder = s.folderMappings[node?.id];
            const __lv_idx = s.sidebarList.indexOf(folder);
            if (__lv_idx !== -1) {
                s.sidebarIndex = -1;
                $timeout(function () {
                    s.sidebarIndex = __lv_idx; 
                }, 1);
            }
        }).apply(null, args);
  };

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
                    electronLog && electronLog.info(`[app] Remove rating, total: $${changedItems.length} files`);
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
                    electronLog && electronLog.info(`[app] Add $${star} star, total: $${changedItems.length} files`);
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

  fns["cleanAllError"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function (event) {
            event && event.stopPropagation();
            s.$root.$broadcast("CLEAN_ALL_ERROR", {
                errorList: s.errorList
            });
        }).apply(null, args);
  };

  fns["cleanLibraryPathPermissionError"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function (event) {
            s.libraryPathPermissionError = false;
        }).apply(null, args);
  };

  fns["cleanLocalhostError"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function (event) {
            s.localhostError = false;
        }).apply(null, args);
  };

  fns["cleanSelected"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function(event) {
            // 忽略事件传送
            if (event && $("#box-container").outerWidth() <= event.offsetX + 10) {
                event.stopPropagation();
                return;
            }

            // event && event.stopPropagation();
            if (event.metaKey || event.shiftKey || event.ctrlKey) return;
            __lv_cleanSelectedTimeout = $timeout(function() {
                s.selected = [];
                s.selectedFolderMappings = {};
                s.updateSelection();
            }, 100);
        }).apply(null, args);
  };

  fns["clickNode"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function(event, folder) {
            if (event.which == 2 || dragCheck) {
                event.stopPropagation();
                return;
            }
            if (event.metaKey || event.ctrlKey) {
                if (s.currentFolder) {
                    if (s.$root.selectedFolders.indexOf(s.currentFolder) === -1) {
                        s.$root.selectedFolders.push(s.currentFolder);
                    }
                    s.$root.selectedFoldersMappings[s.currentFolder.id] = s.currentFolder;
                }
                s.multipleOpenFolder(folder, true);
            }
            else if (event.shiftKey) {

                if (!s.currentId) return;

                var id = s.currentId;
                var curarentFolderId = id.replace("folder-", "");
                var currentFolder = s.folderMappings[curarentFolderId];
                var fidx = s.sidebarList.indexOf(currentFolder);
                var tidx = s.sidebarList.indexOf(folder);

                if (fidx === -1 || tidx === -1) return;
                if (fidx > tidx) {
                    [fidx, tidx] = [tidx, fidx];
                }

                for (var i = fidx; i <= tidx; i++) {
                    var item = s.sidebarList[i];
                    if (item.vstype === "folder") {
                        var __lv_idx = s.$root.selectedFolders.indexOf(item);
                        if (__lv_idx === -1) {
                            s.$root.selectedFolders.push(item);
                            s.$root.selectedFoldersMappings[item.id] = item;
                        }
                    }
                }
                s.currentFolderChildren = s.getChildFoldersMaps(s.$root.selectedFolders);
                s.reload();
            }
            else {
                s.openFolder(folder, false, 'folder-' + folder.id);
            }
        }).apply(null, args);
  };

  fns["clickSmartNode"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function (event, smartFolder) {
            if (event.which == 2 || dragCheck) {
                event.stopPropagation();
                return;
            }
            if (event.metaKey || event.ctrlKey) {
                if (s.currentSmartFolder) {
                    if (s.$root.selectedSmartFolders.indexOf(s.currentSmartFolder) === -1) {
                        s.$root.selectedSmartFolders.push(s.currentSmartFolder);
                    }
                    s.$root.selectedSmartFoldersMappings[s.currentSmartFolder.id] = s.currentSmartFolder;
                }
                s.multipleOpenSmartFolder(smartFolder, true);
            }
            else if (event.shiftKey) {

                if (!s.currentId) return;

                var id = s.currentId;
                var curarentSmartFolderId = id.replace("smart-folder-", "");
                var currentSmartFolder = s.smartFolderMappings[curarentSmartFolderId];
                var fidx = s.sidebarList.indexOf(currentSmartFolder);
                var tidx = s.sidebarList.indexOf(smartFolder);

                if (fidx === -1 || tidx === -1) return;
                if (fidx > tidx) {
                    [fidx, tidx] = [tidx, fidx];
                }

                for (var i = fidx; i <= tidx; i++) {
                    var item = s.sidebarList[i];
                    var __lv_idx = s.$root.selectedSmartFolders.indexOf(item);
                    if (__lv_idx === -1) {
                        s.$root.selectedSmartFolders.push(item);
                        s.$root.selectedSmartFoldersMappings[item.id] = item;
                    }
                }
                s.reload();
            }
            else {
                s.openSmartFolder(smartFolder, false, 'smart-folder-' + smartFolder.id);
            }
        }).apply(null, args);
  };

  fns["closeQuickSearch"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function (event) {
            s.$root.$broadcast('CLOSE_QUICK_SEARCH_MODAL');
        }).apply(null, args);
  };

  fns["contentFilter"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function(__lv_image) {
            try {
                if (s.$root.selectedSmartFolders.length > 0) {
                    if (__lv_image.isDeleted) return false;
                    for (let i = 0; i < s.$root.selectedSmartFolders.length; i++) {
                        let smartFolder = s.$root.selectedSmartFolders[i];
                		if (s.existInSmartFilter(smartFolder, __lv_image)) {
                            return true;
                        }
                    }
                    return false;
                }
                else if (s.currentSmartFolder) {
                	if (__lv_image.isDeleted) return false;
                	if (s.currentSmartFolder.children && s.currentSmartFolder.children.length === 0 && s.currentSmartFolder.conditions && s.currentSmartFolder.conditions.length === 0) {
                		return false;
                	}
                	else if (s.currentSmartFolder.children && s.currentSmartFolder.children.length > 0 && s.currentSmartFolder.conditions && s.currentSmartFolder.conditions.length === 0) {
                		for (let i = 0; i < s.currentSmartFolder.children.length; i++) {
    	                    let smartFolder = s.currentSmartFolder.children[i];
    	            		if (s.existInSmartFilter(smartFolder, __lv_image)) {
    	                        return true;
    	                    }
    	                }
    	                return false;
                	}
                	else {
                		return s.existInSmartFilter(s.currentSmartFolder, __lv_image);
                	}
                }
                switch (s.viewMode) {
                    case "all":
                        if (!__lv_image.isDeleted) return true;
                        break;
                    case "unfiled":
                        if (__lv_image.isDeleted) return false;
                        if (!__lv_image.folders || __lv_image.folders.length === 0 || (__lv_image.folders.length === 1 && __lv_image.folders[0] && !s.folderMappings[__lv_image.folders[0]])) {
                            return true;
                        }
                        break;
                    case "untagged":
                        if (__lv_image.isDeleted) return false;
                        if (!__lv_image.tags || __lv_image.tags.length === 0) {
                            return true;
                        }
                        break;
                    case "random":
                        if (!__lv_image.isDeleted) return true;
                        break;
                    case "recent":
                        return (RecentFileManager.isExists(__lv_image));
                        break;
                    case "trash":
                        if (__lv_image.isDeleted) return true;
                        break;
                    default:
                        // 文件夹多选
                        if (s.$root.selectedFolders.length > 0) {
                            if (__lv_image.isDeleted) return false;
                            for (var i = 0; i < s.$root.selectedFolders.length; i++) {
                                var folder = s.$root.selectedFolders[i];
                                if (isInFolder(__lv_image, folder)) {
                                    return true;
                                }
                            }
                        }
                        // 文件夹单选
                        else if (s.currentFolder) {
                            if (__lv_image.isDeleted) return false;
                            if (isInFolder(__lv_image, s.currentFolder)) {
                                return true;
                            }
                            return false;
                        } else if (s.currentTag) {
                            if (__lv_image.isDeleted) return false;
                            return __lv_image.tags.indexOf(s.currentTag) > -1;
                        }
                        return false;
                }
                return false;
            }
            catch (err) {
                return false;
            }
        }).apply(null, args);
  };

  fns["contentFocus"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function($event) {
            s.$root.currentFocus = "content";
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

  fns["copyAsLink"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function (event, items) {
            if (!items || !items[0]) return;
            let text = ``;
            items.forEach(function (item, index) {
                if (item && item.id) {
                    // http://localhost:41595/item?id=:item.id
                    text += `http://localhost:41595/item?id=$${item.id}`;
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
  };

  fns["copyAsPath"] = function (...args) {
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
                    copyText += `\n$${rawPath}`;
                }
            });
            clipboard.writeText(copyText);
            s.notify({
                message: $filter('i18n')("notify.copyPath.successMsg"),
                duration: 750
            });
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

  fns["dblclickContentPanel"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function () {
            if (!s.isCropMode) {
                s.leaveDetailMode();
            }    
        }).apply(null, args);
  };

  fns["dblclickSidebarFolder"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function (event, folder) {
        	if (s.$root.preferences.habits.dblclickSidebarItem === 'collapse') {
        		s.toggleFolderExpand(event, folder);
        	}
        	else {
        		s.renameFolder(event, folder);
        	}
        }).apply(null, args);
  };

  fns["dblclickSidebarSmartFolderGroup"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function (event, folder) {
        	if (s.$root.preferences.habits.dblclickSidebarItem === 'collapse') {
        		s.toggleSmartFolderExpand(event, folder);
        	}
        	else {
        		s.renameSmartFolder(event, folder);
        	}
        }).apply(null, args);
  };

  fns["deactivateFont"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function (font, {showNotify, updateView}) {
            if (!font) return;
            if (font.activating || font.deactivating) return;
            var key = Object.keys(font.fontMetas.postScriptName)[0];
            var name = font.name + "." + font.ext;
            var postScriptName = font.fontMetas.postScriptName?.[key];
            var fullName = font?.fontMetas?.fullName?.en || font?.fontMetas?.compatibleFullName?.en;
            var outPath = `$${fontFolder}/$${postScriptName}.$${font.ext}`;
            var folderPath = __lv_path.normalize(s.libraryPath + "/images/" + font.id + ".info/");
            var rawPath = __lv_path.normalize(folderPath + name);
            if (process.platform === 'darwin') {
                if (fs.existsSync(outPath)) {
                    fse.removeSync(`$${fontFolder}/$${postScriptName}.$${font.ext}`);
                    installedFonts[`$${postScriptName}_.$${font.ext}`] = false;
                    eagle.filter.filterCounts['fontActivated']['activated']--;
                    eagle.filter.filterCounts['fontActivated']['deactivated']++;
                }
                if (updateView) {
                    s.updateItemsView([font]);
                }
            }
            else {
                ipcRenderer.send("deactivate-windows-font", {
                    fontId: font.id,
                    fontName: font.name,
                    fontPath: rawPath,
                    postScriptName: postScriptName,
                    fullName: fullName,
                    fontExt: font.ext
                });
                font.deactivating = true;
                s.updateItemsView([font]);
            }

            ipcRenderer.send('electron-info', `[app] Unstall font: $${rawPath}`);
            analytics.event("Font", "Uninstall");

            if (showNotify) {
                s.notify({
                    message: $filter('i18n')("notify.font.deactivate", [
                            { "property": "name", "value": font.name }
                        ]),
                    duration: 1000
                });
            }
        }).apply(null, args);
  };

  fns["endHandler"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function(event) {
            if (s.isDetailMode) { 
            	clearTimeout(__lv_updateZoomRatioTimeout);
                $("#detail-container").addClass("zooming");
                __lv_updateZoomRatioTimeout = setTimeout(function () {
                    $("#detail-container").removeClass("zooming");
                }, 300);
            	$("#detail-container").smoothZoom('goToY', -99999999);
            	$("#detail-container").smoothZoom('moveY', -window.outerHeight + 60);
            }
            else { 
                s.gotoBottom();
            }
        }).apply(null, args);
  };

  fns["escHandler"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function($event) {
            if ($(".swal2-container").length > 0) return;
            if ($(".select-panel.open:not(.pinned)").length > 0) {
                $(".select-panel.open").removeClass("open");
                return;
            }
            s.selectedFolder = undefined;
            if (s.isSlideshowMode) {
                s.isSlideshowMode = false;
                ipcRenderer.send("leave-slideshow");
                return;
            }
            if (!s.isDetailMode) {
                if (document.activeElement?.tagName !== "INPUT") {
                    s.cleanSelected($event);
                }
            } 
            else {
                if (s.isCropMode) {
                    s.isCropMode = false;
                }
                else if (AnnotationPreview.isShow) {
                	AnnotationPreview.hide();
                }
                else {
                    s.leaveDetailMode();
                }
            }
            if (s.isPreviewing) {
                if (process.platform == 'darwin') {
                    ipcRenderer.send('quicklook', s.selected[0]);
                    s.isPreviewing = false;
                }
                return;
            }
        }).apply(null, args);
  };

  fns["excludeWithFolder"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function (folder) {
            if (eagle.filter.filterRules.folder.excludes[folder.id]) {
                delete eagle.filter.filterRules.folder.excludes[folder.id];
            }
            else {
                eagle.filter.filterRules.folder.excludes[folder.id] = folder;
                delete eagle.filter.filterRules.folder.includes[folder.id];
            }

            if (eagle.filter.folderFilterLogic === "AND") {
                $("#filter-folder-list").scrollTop(0);
            }

            s.filterContent();
            s.calculateFilterCounts();
            analytics.event('Filter', 'Folder');
        }).apply(null, args);
  };

  fns["excludeWithTag"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function (tag) {
            // 已存在
            if (tag.isNoTags) {
                eagle.filter.filterRules.tag.no = !eagle.filter.filterRules.tag.no;
                tag.isSelected = false;
                tag.isExcluded = true;
            }
            else {
                var tagName = tag.name;
                var __lv_idx = eagle.filter.filterRules.tag.includes.indexOf(tagName);
                if (__lv_idx > -1) {
                    eagle.filter.filterRules.tag.includes.splice(__lv_idx, 1);
                    tag.isSelected = false;
                }
                else {
                    var eidx = eagle.filter.filterRules.tag.excludes.indexOf(tagName);
                    if (eidx > -1) {
                        eagle.filter.filterRules.tag.excludes.splice(eidx, 1);
                        tag.isExcluded = false;
                    }
                    else {
                        eagle.filter.filterRules.tag.excludes.push(tagName);
                        tag.isExcluded = true;
                        tag.isSelected = false;
                    }
                }
            }

            s.tagKeyword = "";
            s.filterContent();
        }).apply(null, args);
  };

  fns["filterContent"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function(type) {
            if (!s.isItemBindCalculated) return;
            // 重新计算画面图片列表
            s.shuffle = [];
            s.rebindRefresh(undefined, s.contentFilterCache);
            s.$evalAsync();
            $("#box-container").scrollTop(0);
        }).apply(null, args);
  };

  fns["filterWithColor"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function(color, ignoreHistory) {

            if (!color || eagle.filter.filterRules.color.value == color) {
                eagle.filter.filterRules.color.value = undefined;
                eagle.filter.filterRules.color.gray = false;
                s.hexColor = "";
            }
            else if (color === "gray") {
                eagle.filter.filterRules.color.value = undefined;
                eagle.filter.filterRules.color.gray = true;
                s.hexColor = "";
            }
            else {
                eagle.filter.filterRules.color.gray = false;
                eagle.filter.filterRules.color.value = color;
                var hexColor = s.rgbToHex(eagle.filter.filterRules.color.value[0], eagle.filter.filterRules.color.value[1], eagle.filter.filterRules.color.value[2]);
                $('#colorpickerHolder').ColorPickerSetColor(hexColor);
                if (hexColor.length > 6) {
                    s.hexColor = hexColor;
                }
            }
            eagle.filter.isOpen = true;
            s.isDetailMode = false;
            s.updateContainerHieght();
            s.page = 1;

            // Add URL state management for color filtering
            if (!ignoreHistory && (eagle.filter.filterRules.color.value || eagle.filter.filterRules.color.gray)) {
                var colorValue = eagle.filter.filterRules.color.gray ? "gray" : eagle.filter.filterRules.color.value;
                UrlStateService.setState({ 
                    view: 'color', 
                    color: colorValue,
                    folder: null, 
                    smartfolder: null, 
                    tag: null 
                });
            }

            $timeout(function () {
                s.filterContent();
                s.calculateFilterCounts();
            }, 50);
            analytics.event('Filter', 'Color');
        }).apply(null, args);
  };

  fns["filterWithFolder"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function (folder) {

            if (eagle.filter.filterRules.folder.excludes[folder.id]) {
                s.excludeWithFolder(folder);
                return;
            }

            if (eagle.filter.filterRules.folder.includes[folder.id]) {
                delete eagle.filter.filterRules.folder.includes[folder.id];
            }
            else {
                eagle.filter.filterRules.folder.includes[folder.id] = folder;
                delete eagle.filter.filterRules.folder.excludes[folder.id];
            }

            if (eagle.filter.folderFilterLogic === "AND") {
                eagle.filter.filterFolderKeyword = "";
                $("#filter-folder-list").scrollTop(0);
            }

            s.filterContent();
            s.calculateFilterCounts();
            analytics.event('Filter', 'Folder');
        }).apply(null, args);
  };

  fns["filterWithHexColor"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function(hex) {
            if (hex.length === 6 && !hex.startsWith("#") && /^[0-9A-F]{6}$/i.test(hex) ) {
                hex = "#" + hex;
                s.hexColor = hex;
            }
            if (hex && hex.length == 7) {
                var rgb = s.hexToRGB(hex);
                s.filterWithColor(rgb);
            }
            else if (hex && hex == "gray") {
                s.filterWithColor("gray");
            }
        }).apply(null, args);
  };

  fns["filterWithTag"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function (tag) {

            if (tag.isExcluded) {
                s.excludeWithTag(tag);
                return;
            }

            // 已存在
            if (tag.isNoTags) {
                eagle.filter.filterRules.tag.no = !eagle.filter.filterRules.tag.no;
                tag.isSelected = eagle.filter.filterRules.tag.no;
            }
            else {
                var tagName = tag.name;

                var eidx = eagle.filter.filterRules.tag.excludes.indexOf(tagName);
                if (eidx > -1) {
                    eagle.filter.filterRules.tag.excludes.splice(__lv_idx, 1);
                    tag.isExcluded = false;
                }
                else {
                    var __lv_idx = eagle.filter.filterRules.tag.includes.indexOf(tagName);
                    if (__lv_idx > -1) {
                        eagle.filter.filterRules.tag.includes.splice(__lv_idx, 1);
                        tag.isSelected = false;
                    }
                    else {
                        eagle.filter.filterRules.tag.includes.push(tagName);
                        tag.isSelected = true;
                        tag.isExcluded = false;
                    }
                }
            }

            if (eagle.filter.tagFilterLogic === "AND") {
                // s.tagKeyword = "";
                $("#filter-panel .tags-container").scrollTop(0);
            }

            s.filterContent();
            s.calculateFilterCounts();
        }).apply(null, args);
  };

  fns["flipHandler"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function ($event) {
        	if (VIDEO_TYPES[s.current.ext] || AUDIO_TYPES[s.current.ext]) {
        		s.flipVideo($event, s.current);
        	}
        	else {
        		s.flipImage($event, s.current, true);
        	}
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
            $("#detail-container").smoothZoom('flip', scaleX, scaleY);

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
                            console.log(`Image flipped ($${flipType}) and saved: $${rawPath}`);
                            // 重新生成縮圖
                            ipcRenderer.send('regenerate-thumbnail', [rotatedImage]);
                        })
                        .catch(err => {
                            console.error(`Failed to save flipped image: $${err.message}`);
                        });
                } catch (requireErr) {
                    console.error(`Failed to load flipImage module: $${requireErr.message}`);
                }
            }
        }).apply(null, args);
  };

  fns["flipVideo"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function (event) {
            var player = machineryGetVideoPlayer(s);
            if (!player) return;

            if (player.type === 'mpv') {
                var mpv = player.el;
                var flip = (mpv.previewFlip || 1) * -1;
                mpv.flip(flip);
            }
            else {
                var $__lv_video = $(player.el);
                var flip = ($__lv_video.data("flip") || 1) * -1;
                $__lv_video.data("flip", flip);
                if (flip === 1) {
                    $__lv_video.removeClass("flip");
                }
                else {
                    $__lv_video.addClass("flip");
                }
            }
        }).apply(null, args);
  };

  fns["focusAppUnlockPassword"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function () {
            setTimeout(() => {
                $("#app-lock-password-input").focus();
            }, 24);
            $("#app-lock-password-input").on("blur", () => {
                setTimeout(() => {
                    $("#app-lock-password-input").focus();
                }, 24);
            });
        }).apply(null, args);
  };

  fns["focusUnlockPassword"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function () {
            setTimeout(() => {
                $("#lock-password-input").focus();
            }, 24);
        }).apply(null, args);
  };

  fns["getDateFilterCountsArray"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function (type) {
            try {
                var arr = [];
                Object.keys(eagle.filter.filterCounts[type]['year/month']).forEach(function (key) {
                    arr.push({
                        key: key,
                        value: eagle.filter.filterCounts[type]['year/month'][key]
                    })
                });
                return arr;
            }
            catch (err) {
                return [];
            }
        }).apply(null, args);
  };

  fns["getExifRawPath"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function () {
            if (s.current) {
                return `./exif-viewer/index.html?orientation=$${s.current.orientation}&path=$${encodeURIComponent(FileUrlHelper.getRawUrl(s.current))}&width=$${s.current.width}&height=$${s.current.height}&zoom=$${s.$root.preferences.habits.renderBehavior}`;
            }
        }).apply(null, args);
  };

  fns["getFolderFullPath"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function (folder) {
            if (folder) {
                if (folder.parent) {
                    try {
                        var ancestors = s.getAncestorFolders(folder, []);
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
  };

  fns["getFontPath"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function() {
            if (s.current) {
                return `./font-viewer/font-viewer.html?id=$${s.current.id}&theme=$${s.theme}&language=$${s.language}`;
            }
        }).apply(null, args);
  };

  fns["getGIFPath"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function() {
            if (s.current) {
                var gifPath = FileUrlHelper.getRawPath(s.current);
                var gifUrl = FileUrlHelper.getRawUrl(s.current);
                var renderBehavior = s.$root.preferences.habits.renderBehavior;
                return "gif-viewer/index.html?path=" + encodeURIComponent(gifPath) + "&url=" + encodeURIComponent(gifUrl) + "&name=" + encodeURIComponent(s.current.name + ".gif") + `&render=$${renderBehavior}`;
            }
        }).apply(null, args);
  };

  fns["getModelPath"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function() {
            if (s.current) {
                var rawUrl = FileUrlHelper.getRawUrl(s.current);
				rawUrl = rawUrl.replaceAll(',', '%2C');
                var type = s.current.ext;
				return `model-viewer/website/index.html#model=$${rawUrl}`;
            }
        }).apply(null, args);
  };

  fns["getNativeViewerPath"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function() {
            if (s.current) {
                var __lv_filePath = s.imagesDir + s.current.id + ".info/";
                return "native-viewer/index.html?path=" + encodeURIComponent(__lv_filePath) + "&name=" + encodeURIComponent(s.current.name + "." + s.current.ext) + "&ext=" + s.current.ext + "&width=" + s.current.width + "&height=" + s.current.height + "&id=" + s.current.id;
            }
        }).apply(null, args);
  };

  fns["getNodeClass"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function (node) {
            var __lv_result = {
                'active active-item': (s.$root.selectedFolders.length === 0 && s.currentId == 'folder-' + node.id) || s.$root.selectedFoldersMappings[node.id],
                'locked': node.password && !node.isUnLock,
                'collapsed': !node.isExpand && !s.folderKeyword.length,
                'editable': node.editable,
                'selected': node.isSelected,
                'editable': node.editable,
                'empty-node': node.children && node.children.length == 0,
                'show-badge': node.imageCount > 0,
                'close': node.children && node.children.length <= 0 && node.isExpand,
                'show-lock-icon': node.password && !node.isUnLock,
                'show-unlock-icon': node.password && node.isUnLock,
                'has-childred': node.children && node.children.length > 0,
                'first': node.styles && node.styles.first,
                'last': node.styles && node.styles.last,
            }
            __lv_result[`depth-$${node.styles.depth}`] = true;
            __lv_result[`icon-$${node.icon}`] = true;
            __lv_result[`color-$${node.iconColor}`] = true;
			let parent = s.folderMappings[node.parent];
			if (parent) {
				__lv_result[`parent-color-$${parent?.iconColor}`] = true;
			}
            return __lv_result;
        }).apply(null, args);
  };

  fns["getPDFPath"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function() {
            if (s.current) {
            	var pdfPath = FileUrlHelper.getRawUrl(s.current);
                var locale = preferences.general.language.replace("_", "-");
                return `pdf-viewer/web/viewer.html?path=$${encodeURIComponent(pdfPath)}&locale=$${locale}&theme=$${s.theme}`;
            }
        }).apply(null, args);
  };

  fns["getQuickAccessClass"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function (item) {
            var node;
            if (item.type === 'folder') {
                node = s.folderMappings[item.id];
            }
            else {
                node = s.smartFolderMappings[item.id];
            }
            
            if (!node) return;

            var __lv_result = {
                'active active-item': s.currentId === ('quickaccess-' + node.id),
                'locked': node.password && !node.isUnLock,
                'collapsed': !node.isExpand && !s.folderKeyword.length,
                'selected': node.isSelected,
                'editable': node.editable,
                'empty-node': node.children && node.children.length == 0,
                'color-red': node.iconColor == 'red',
                'color-orange': node.iconColor == 'orange',
                'color-yellow': node.iconColor == 'yellow',
                'color-green': node.iconColor == 'green',
                'color-aqua': node.iconColor == 'aqua',
                'color-blue': node.iconColor == 'blue',
                'color-purple': node.iconColor == 'purple',
                'color-pink': node.iconColor == 'pink',
                'show-badge': node.imageCount > 0,
                'close': node.children && node.children.length <= 0 && node.isExpand,
                'show-lock-icon': node.password && !node.isUnLock,
                'show-unlock-icon': node.password && node.isUnLock,
                'has-childred': node.children && node.children.length > 0,
            }
            __lv_result['icon-' + node.icon] = true;
            return __lv_result;
        }).apply(null, args);
  };

  fns["getRatioExp"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function (ratio) {
            if (ratio > 100) {
                ratio = 100 + (ratio - 100) * 7;
            }
            return parseInt(ratio);
        }).apply(null, args);
  };

  fns["getRatioNonExp"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function (ratio) {
            if (ratio > 100) {
                ratio = (ratio - 100) / 7 + 100;
            }
            return ratio;
        }).apply(null, args);
  };

  fns["getRawPath"] = function (...args) {
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
  };

  fns["getRawUrl"] = function (...args) {
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
	            rawUrl = `$${rawUrl}?v=$${$bodyScope.modifiedMappings[__lv_image.id]}`;
	        }
        	return rawUrl;
        }).apply(null, args);
  };

  fns["getRawViewerPath"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function() {
            if (s.current) {
                var __lv_image = s.current;
                var rawPath = s.imagesDir + s.current.id + ".info/";
                return `./raw-viewer/index.html?orientation=$${__lv_image.orientation}&path=$${encodeURIComponent(rawPath)}&name=$${encodeURIComponent(__lv_image.name)}&ext=$${__lv_image.ext}&width=$${__lv_image.width}&height=$${__lv_image.height}`;
            }
        }).apply(null, args);
  };

  fns["getSelectedItemElements"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function () {
            var items = s.getSelectedItems();
            items = items.map(function (item) {
                // if (!item.el) {
                //     item.el = $(item.content)[0];
                //     console.log(item.el);
                // }
                return item.el;
            });
            return items;
        }).apply(null, args);
  };

  fns["getSelectedTags"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function () {
            if (!s.selectedTags) return [];
            return Object.keys(s.selectedTags);
        }).apply(null, args);
  };

  fns["getSelection"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function() {
            var arr = [];
            s.selected.forEach(function(__lv_image) {
                var __lv_idx = s.allData.indexOf(__lv_image);
                if (__lv_idx != -1) {
                    arr.push(__lv_idx);
                }
            });
            var invert = arr[0] > arr[1];
            arr = arr.sort(function(a, b) {
                return a - b;
            });
            return {
                __lv_start: arr[0],
                end: arr[arr.length - 1],
                invert: invert
            }
        }).apply(null, args);
  };

  fns["getSmartFolderClass"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function (smartFolder) {
            
            var __lv_result = {
                'editable': smartFolder.editable,
                'selected': smartFolder.isSelected,
                'collapsed': !smartFolder.isExpand && !s.folderKeyword.length,
                'active active-item': (s.$root.selectedSmartFolders.length === 0 && s.currentId == 'smart-folder-' + smartFolder.id) || s.$root.selectedSmartFoldersMappings[smartFolder.id],
                'color-red': smartFolder.iconColor == 'red',
                'color-orange': smartFolder.iconColor == 'orange',
                'color-yellow': smartFolder.iconColor == 'yellow',
                'color-green': smartFolder.iconColor == 'green',
                'color-aqua': smartFolder.iconColor == 'aqua',
                'color-blue': smartFolder.iconColor == 'blue',
                'color-purple': smartFolder.iconColor == 'purple',
                'color-pink': smartFolder.iconColor == 'pink',
                'has-childred': smartFolder.children && smartFolder.children.length > 0,
                'empty-node': !smartFolder.children || smartFolder.children.length == 0,
                'first': smartFolder.styles && smartFolder.styles.first,
                'last': smartFolder.styles && smartFolder.styles.last,
            };
            __lv_result['icon-' + smartFolder.icon] = true;
			let parent = s.smartFolderMappings[smartFolder.parent];
			if (parent) {
				__lv_result[`parent-color-$${parent?.iconColor}`] = true;
			}
            return __lv_result;
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

  fns["getTxtPath"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function() {
            if (s.current) {
                return `./text-editor/text-editor.html?id=$${s.current.id}&theme=$${s.theme}&name=$${s.current.name}&language=$${s.language}`;
            }
        }).apply(null, args);
  };

  fns["getURLSrc"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function () {
            let item = s.current;
        	if (item.ext === "url") {
        		var embed;
        		if (item.medium === "youtube") {
        			embed = `https://www.youtube-nocookie.com/embed/$${item.videoID}?autoplay=1&vq=hq1080`;
        		}
        		else if (item.medium === "vimeo") {
        			embed = `https://player.vimeo.com/video/$${item.videoID}?autoplay=1`;
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
  };

  fns["gotoBottom"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function () {
            if (s.allData.length < s.options.page) {
                var $boxContainer = $("#box-container");
                var __lv_offset = $boxContainer[0].scrollHeight;
                $boxContainer.scrollTop(__lv_offset);
            }
            else {
                var endCursor = Math.ceil(s.allData.length / s.options.page) - 1 || 0;
                resetNgGridLayoutData(s.allData, endCursor);
                var $boxContainer = $("#box-container");
                var times = [100, 400];
                var __lv_offset = $boxContainer[0].scrollHeight;
                for (var i = times[0]; i < times[1]; i+=100) {
                    s.gotoBottomTimeout = setTimeout(function () { $boxContainer.scrollTop(1000000); }, i);
                }
            }
        }).apply(null, args);
  };

  fns["hexToRGB"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function(hex, alpha) {
            var r = parseInt(hex.slice(1, 3), 16),
                g = parseInt(hex.slice(3, 5), 16),
                b = parseInt(hex.slice(5, 7), 16);
            return [r, g, b];
        }).apply(null, args);
  };

  fns["homeHandler"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function(event) {
            if (s.isDetailMode) {
            	clearTimeout(__lv_updateZoomRatioTimeout);
                $("#detail-container").addClass("zooming");
                __lv_updateZoomRatioTimeout = setTimeout(function () {
                    $("#detail-container").removeClass("zooming");
                }, 300);
            	$("#detail-container").smoothZoom('goToY', 40);
            }
            else {
                s.gotoTop();
            }
        }).apply(null, args);
  };

  fns["hoverHideSidebar"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function ($event) {
            $event && $event.stopPropagation();
            if ($("#sidebar").hasClass("hover-show")) {
                $("#sidebar").removeClass("hover-show");
                setTimeout(() => {
                    $("#sidebar").removeClass("slide-in");
                }, 300);
            }
        }).apply(null, args);
  };

  fns["hoverShowSidebar"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function ($event) {
            $event && $event.stopPropagation();
            if (s.isHideSidebar) {
                if (!$("#sidebar").hasClass("hover-show")) {
                    $("#sidebar").addClass("slide-in");
                    $("#sidebar").addClass("hover-show");
                }
            }
        }).apply(null, args);
  };

  fns["importFolders"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function (currentFolder) {
            dialog.showOpenDialog(currentWindow, {
                title: $filter('i18n')('dialog.importLocalFolder.title'),
                properties: ['openDirectory', 'multiSelections']
            }).then(__lv_result => {
                var paths = __lv_result.filePaths;
                if (paths && paths.length > 0) {
                    paths.forEach(function (p) {
                        // 避免用户导入资源库
                        if (p.endsWith(".library")) {
                            if (paths.length === 1) {
                                ipcRenderer.send('open-library', p);
                            }
                            return;
                        }
                        // 避免用户导入 Pixave 资源库
                        else if (p.endsWith(".pxvlibrary")) {
                            return;
                        }
                        uploadFolderToSidebar(p, currentFolder);
                    });
                }
            });
        }).apply(null, args);
  };

  fns["isFontActivate"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function (item) {
            try {
                var key = Object.keys(item.fontMetas.postScriptName)[0];
                var postScriptName = item.fontMetas.postScriptName && item.fontMetas.postScriptName[key];
                return installedFonts[`$${postScriptName}_.$${item.ext}`];
            }
            catch (err) {
                return false;
            }
        }).apply(null, args);
  };

  fns["lastZoom"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function () {
            if (s.lastZoomMode === "edge") return false;
            if (s.$root.preferences.habits.rememberLastZoom === "off") return false;
            if (!s.current) return false;
            if (s.isInlineMode) return false;
            var state = s.lastItemStates[s.current.id];
            if (state && state.data && state.data.tX !== undefined) {
                $("#detail-container").smoothZoom('goTo', state.data.tX, state.data.tY, state.data.rA);
                var ratio = parseInt(state.data.rA * 100);
                s.imageSize.zoomRatio = s.getRatioNonExp(ratio);
                s.imageSize.zoomRatioExp = ratio;
                return true;
            }
            return false;
        }).apply(null, args);
  };

  fns["leaveDetailMode"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function() {

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
                $timeout.cancel(__lv_zoomInitTimeout);

                setTimeout(function() {
                    if (s.isDetailMode) return;
                    $(".content-panel.detail-mode").removeClass("inline-mode open");
                    $(".smooth_zoom_preloader").scrollLeft(0);
                }, 50);

                s.isInlineMode = false;
                s.fadeOutDetailMode();
                $("#detail-container").smoothZoom('cleanBitmapViewer');
                $("#detail-container").smoothZoom('clearPreloadData');
                
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

                // b1-8：initMousetrap 为 bundle 闭包链（destoryMousetrap/buildMousetrap）——
                // strangling 期 bundle 自管重绑定 / post-b1 bridgeWhenReady 等价；此处跳过不阻塞清理
                try { initMousetrap(); } catch (err) { /* b1-8b 接装前可达性缺失，忽略 */ }
                clearInterval(s.gifUpadteInterval);
            }
        }).apply(null, args);
  };

  fns["mHandler"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function($event) {
            if (!s.isDetailMode) {
                return;
            }
            if (VIDEO_TYPES[s.current.ext] || AUDIO_TYPES[s.current.ext]) {
                $(".vjs-mute-control").click();
            }
        }).apply(null, args);
  };

  fns["maximize"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function() {
            if (process.platform == 'darwin') {
                var isMax = remote.systemPreferences.getUserDefault("AppleActionOnDoubleClick", "string") !== 'Minimize';
                if (isMax) {
                    if (!currentWindow.isMaximized()) {
                        currentWindow.maximize();
                        s.isMaximize = true;
                    } else {
                        currentWindow.unmaximize();
                        s.isMaximize = false;
                    }
                } else {
                    currentWindow.minimize();
                }
            }
        }).apply(null, args);
  };

  fns["moveFoldersAsSibling"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function (folders, folder, isBottom) {

            if (!folder || !folders || folders.length === 0) return;

            // 避免自己拖拽到自己的 Childred
            if (folders.indexOf(folder) > -1) return;
            
            // 避免老爸拖拽到子孙
            var ancestors = s.getAncestorFolders(folder, []);
            for (let i = 0; i < folders.length; i++) {
                const ancestor = folders[i];
                if (ancestors.indexOf(ancestor) > -1) {
                    return;
                }
            }

            var moved = {};
            var children = machineryGetFolderParentChilder(s, folder);
            var __lv_idx = -1;

            if (!children) return;

            __lv_idx = children.indexOf(folder);

            if (__lv_idx === -1)  return;

            folders.forEach(function (folder) {
                moved[folder.id] = folder;
            });

            // 重新排序资料夹（依据视觉顺序）
            folders.sort(function (a, b) {
                try {
                    var aIdx = $("#folder-" + a.id).offset().top;
                    var bIdx = $("#folder-" + b.id).offset().top;
                    if (aIdx < bIdx)
                    return -1;
                    if (aIdx > bIdx)
                        return 1;
                    return 0;
                }
                catch (err) {
                    // debugger
                    return 0;
                }
            });

            var clone = [];
            cloneTree(clone, s.folders, true);

            try {
                for (var i = folders.length - 1; i >= 0; i--) {
                    var f = folders[i];
                    var p = f.parent;
                    if (f.id === folder.id) break;
                    if (!f.parent || !moved[f.parent]) {
                        // 从原来位置移除
                        var ch;
                        var index = -1;
                        if (p && s.folderMappings[p].children) {
                            ch = s.folderMappings[p].children;
                        }
                        else {
                            ch = s.folders;
                        }
                        index = ch.indexOf(f);
                        if (index > -1) {
                            ch.splice(index, 1);
                        }
                    }
                }

                __lv_idx = children.indexOf(folder);

                for (var j = folders.length - 1; j >= 0; j--) {
                    var f = folders[j];
                    // 如果老爸也被移动，孩子就不需要在移动了
                    if (!f.parent || !moved[f.parent]) {
                        if (!folder.parent) {
                            delete f.parent;
                        }
                        else {
                            f.parent = folder.parent;
                        }
                        if (!isBottom) {
                            children.splice(__lv_idx, 0, f);
                        }
                        else {
                            children.splice(__lv_idx + 1, 0, f);
                        }
                    }
                }
                s.updateSidebarList();
                s.saveFolder();
                try {
                    electronLog && electronLog.info(`[app] Drag $${folders.length} folders as $${folder.name}($${folder.id}) sibling`);
                } catch (err) {};
            }
            catch (err) {
                s.folders = clone;
                electronLog && electronLog.error(err.stack || err);
            }
        }).apply(null, args);
  };

  fns["moveFoldersToFolder"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function (folders, folder) {

            if (!folder || !folders || folders.length === 0) return;
        
            // 避免自己拖拽到自己的 Childred
            if (folders.indexOf(folder) > -1) return;

            // 避免老爸拖拽到子孙
            var ancestors = s.getAncestorFolders(folder, []);
            for (let i = 0; i < folders.length; i++) {
                const ancestor = folders[i];
                if (ancestors.indexOf(ancestor) > -1) {
                    return;
                }
            }

            if (!folder.children) {
                folder.children = [];
            }

            var moved = {};
            var children = folder.children;

            folders.forEach(function (folder) {
                moved[folder.id] = folder;
            });

            // 重新排序资料夹（依据视觉顺序）
            folders.sort(function (a, b) {
                try {
                    var aIdx = $("#folder-" + a.id).offset().top;
                    var bIdx = $("#folder-" + b.id).offset().top;
                    if (aIdx < bIdx)
                    return -1;
                    if (aIdx > bIdx)
                        return 1;
                    return 0;
                }
                catch (err) {
                    // debugger
                    return 0;
                }
            });

            var clone = [];
            cloneTree(clone, s.folders, true);

            try {

                for (var i = folders.length - 1; i >= 0; i--) {
                    var f = folders[i];
                    var p = f.parent;
                    if (f.id === folder.id) break;
                    if (!f.parent || !moved[f.parent]) {
                        // 从原来位置移除
                        var ch;
                        var index = -1;
                        if (p && s.folderMappings[p].children) {
                            ch = s.folderMappings[p].children;
                        }
                        else {
                            ch = s.folders;
                        }
                        index = ch.indexOf(f);
                        if (index > -1) {
                            ch.splice(index, 1);
                        }
                    }
                }

                for (let j = 0; j < folders.length; j++) {
                    var f = folders[j];
                    // 如果老爸也被移动，孩子就不需要在移动了
                    if (!moved[f.parent]) {
                        f.parent = folder.id;
                        children.push(f);
                    }
                }

                folder.isExpand = true;
                s.updateSidebarList();
                s.saveFolder();
                try {
                    electronLog && electronLog.info(`[app] Drag $${folders.length} folders as $${folder.name}($${folder.id}) children`);
                } catch (err) {};
            }
            catch (err) {
                s.folders = clone;
                electronLog && electronLog.error(err.stack || err);
            }
        }).apply(null, args);
  };

  fns["newFolder"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function(parent, isSubFolder, isSiblingFolder, ignoreAutoOpen) {

            var __lv_folderId = guid();
            var folder = {
                id: __lv_folderId,
                name: $filter('i18n')('general.untitled.folder'),
                images: [],
                folders: [],
                modificationTime: Date.now(),
                editable: true,
                imagesMappings: {},
                __lv_tags: [],
                children: [],
                isExpand: true,
            };

            // 预设状态：新增同级文件夹
            // 若带有参数 parent 则新增子文件夹
            if (isSiblingFolder) {
                var father = s.folderMappings[parent.parent];
                var children = (father && father.children) ? father.children : s.folders;
                var __lv_idx = children.indexOf(parent);
                // 创建兄弟文件夹，如果目标及目标父文件夹相同，继承文件夹颜色、图标设置
                if (father) {
                    folder.parent = father.id;
                    if (father.icon) {
                        folder.icon = father.icon;
                    }
                    if (father.iconColor) {
                        folder.iconColor = father.iconColor;
                    }
                    parent.isExpand = true;
                }
                if (__lv_idx === -1) __lv_idx = children.length - 1;
                children.splice(__lv_idx + 1, 0, folder);
            }
            else if (s.currentFolder || parent) {
				var __lv_target = parent;
                var parent = parent || s.folderMappings[s.currentFolder.parent];
                var children = (parent && parent.children) ? parent.children : s.folders;
                var __lv_idx = children.indexOf(s.currentFolder);
                if (parent) {
                    folder.parent = parent.id;
                    parent.isExpand = true;
                    // 创建新的文件夹自动继承父文件夹的颜色、图标设置
					if (__lv_target) {
						if (parent && parent.icon !== undefined) {
                            folder.icon = parent.icon;
                        }
                        if (parent && parent.iconColor !== undefined) {
                            folder.iconColor = parent.iconColor;
                        }
                    }
                    else if (s.currentFolder) {
                        if (parent && parent.icon === s.currentFolder.icon) {
                            folder.icon = parent.icon;
                        }
                        if (parent && parent.iconColor === s.currentFolder.iconColor) {
                            folder.iconColor = parent.iconColor;
                        }
                    }
                    else {
                        if (parent && parent.icon !== undefined) {
                            folder.icon = parent.icon;
                        }
                        if (parent && parent.iconColor !== undefined) {
                            folder.iconColor = parent.iconColor;
                        }
                    }
                } else {
                    folder.parent = s.currentFolder.parent;
                }
                if (__lv_idx === -1) __lv_idx = children.length - 1;
                if (isSubFolder) {
                    children.splice(0, 0, folder);
                }
                else {
                    children.splice(__lv_idx + 1, 0, folder);
                }
            }
            // 插入尾端
            else {
                __lv_idx = s.folders.length;
                s.folders.splice(__lv_idx, 0, folder);
            }

            s.folderMappings[folder.id] = folder;
			s.addToRecentFolders([folder.id]);
			
            setTimeout(function() { 
                s.changeSidebarIndex(folder); 
                s.$evalAsync();
                setTimeout(function() { $("#folder-input-" + folder.id).focus().select(); }, 100);
                setTimeout(function() { $("#folder-input-" + folder.id).focus().select(); }, 200);
            }, 150);

            setTimeout(function() { 
                s.changeSidebarIndex(folder); 
                s.$evalAsync();
                setTimeout(function() { 
                    if ($("#folder-input-" + folder.id + ":focus").length === 0) {
                        $("#folder-input-" + folder.id).focus().select(); 
                    }
                }, 100);
            }, 250);

            s.updateSidebarList();

            // Note: 如果用戶當前選擇多個文件，表示正在分類，這時候不要跳轉是比較好的選擇
            if (s.selected.length === 0 && !ignoreAutoOpen) {
                s.openFolder(folder);
            }
            setTimeout(function() {
                s.calculateImageBinding({ ignoreSort: true }, function() {
                    s.refreshSubfolderList();
                    s.saveFolder();
                    if (folder.parent) {
                        electronLog && electronLog.info(`[app] New sub-folder: $${folder.id}, parent: $${folder.parent}`);
                    }
                    else {
                        electronLog && electronLog.info(`[app] New folder: $${folder.id}`);
                    }
                    analytics.event('Folder', 'Create');
                });
            }, 300);
        }).apply(null, args);
  };

  fns["nextGifFrame"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function(amount = 1) {
            if (s.gifPlayer && s.isGifReady) {
                s.gifPlayer.pause();
                s.gifViewer.playing = false;
                var curr = s.gifPlayer.get_current_frame();
                var total = s.gifViewer.frames.length;
                var __lv_idx = curr + amount;
                if (__lv_idx > total) __lv_idx = total - 1;
                s.gifPlayer.move_to(__lv_idx);
                s.$evalAsync();
            }
        }).apply(null, args);
  };

  fns["onDetailClick"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function($event, __lv_image) {
            if ($event.which == 2) {
                ipcRenderer.send('toggle-slideshow');
            }
        }).apply(null, args);
  };

  fns["onTagSidebarResize"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function(e, ui) {
            if (ui && ui.size.width >= 200) {
                s.containerSize.tagSidebar = ui.size.width;
                s.$root.$broadcast('$$rebind::refreshContainSize');
                // s.updateSliderPosition();
                clearTimeout(__lv_onTagSidebarResizeTimeout);
                __lv_onTagSidebarResizeTimeout = setTimeout(function () {
                    // s.relayout();
                    // s.offsetScrollbar(30);
                    localStorage.setItem("eagle.containerSize.tagSidebar", ui.size.width);
                }, 500);
            }
        }).apply(null, args);
  };

  fns["openApplicationContextMenu"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function() {
            var applicationMenu = Menu.getApplicationMenu();
            applicationMenu.popup(currentWindow);
        }).apply(null, args);
  };

  fns["openErrorModal"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function () {
            s.$root.$broadcast("OPEN_ERROR", {
                errorList: s.errorList
            });
        }).apply(null, args);
  };

  fns["openFilterAddContextMenu"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function () {
            s.openFilter();
            $("#filter-toolbar-overlay").click();

            const pinFilter = (id, pinned) => {
                eagle.filter.pinned[id] = pinned;
                eagle.filter.savePinned();
                setTimeout(function () { s.updateContainerHieght(); }, 50);
            };

            const openFilter = (id) => {
                $(`#$${id}-filter-item`).click();
                setTimeout(function () { s.updateContainerHieght(); }, 50);
            }

            let items = [
                {
                    id: "color",
                    label: i18n.__('filter.color'),
                    keywords: "color palette 顏色 調色盤",
                    icon: 'ic-filter-item-color.svg',
                    role: "toggle",
                    pinned: eagle.filter.pinned['color'],
                    toggle: (pinned) => {
                        pinFilter('color', pinned);
                        s.$evalAsync();
                    },
                    click: () => {
                        openFilter('color');
                    }
                },
                // 標籤
                {
                    id: "tags",
                    label: i18n.__('filter.tags'),
                    keywords: "tags label 標籤",
                    icon: 'ic-filter-item-tag.svg',
                    role: "toggle",
                    pinned: eagle.filter.pinned['tags'],
                    toggle: (pinned) => {
                        pinFilter('tags', pinned);
                        s.$evalAsync();
                    },
                    click: () => {
                        openFilter('tags');
                    }
                },
                // 資料夾
                {
                    id: "folders",
                    label: i18n.__('filter.folders'),
                    keywords: "folders dir 資料夾 文件夾",
                    icon: 'ic-filter-item-folder.svg',
                    role: "toggle",
                    pinned: eagle.filter.pinned['folders'],
                    toggle: (pinned) => {
                        pinFilter('folders', pinned);
                        s.$evalAsync();
                    },
                    click: () => {
                        openFilter('folders');
                    }
                },
                // 形狀
                {
                    id: "shape",
                    label: i18n.__('filter.orientation'),
                    keywords: "shape orientation 形狀 方向",
                    icon: 'ic-filter-item-shape.svg',
                    role: "toggle",
                    pinned: eagle.filter.pinned['shape'],
                    toggle: (pinned) => {
                        pinFilter('shape', pinned);
                        s.$evalAsync();
                    },
                    click: () => {
                        s.toggleFilterByType('shape');
                        s.$evalAsync();
                    }
                },
                // 評分
                {
                    id: "rating",
                    label: i18n.__('filter.rating'),
                    keywords: "rating rate star 評分 星等 星級",
                    icon: 'ic-filter-item-rating.svg',
                    role: "toggle",
                    pinned: eagle.filter.pinned['rating'],
                    toggle: (pinned) => {
                        pinFilter('rating', pinned);
                        s.$evalAsync();
                    },
                    click: () => {
                        openFilter('rating');
                    }
                },
                // 類型
                {
                    id: "types",
                    label: i18n.__('filter.types'),
                    keywords: "types type extenstion format 類型 格式 副檔名",
                    icon: 'ic-filter-item-ext.svg',
                    role: "toggle",
                    pinned: eagle.filter.pinned['types'],
                    toggle: (pinned) => {
                        pinFilter('types', pinned);
                        s.$evalAsync();
                    },
                    click: () => {
                        openFilter('types');
                    }
                },
                // 時間
                {
                    id: "import",
                    label: i18n.__('filter.import'),
                    keywords: "date time import 時間 導入 匯入",
                    icon: 'ic-filter-item-import.svg',
                    role: "toggle",
                    pinned: eagle.filter.pinned['import'],
                    toggle: (pinned) => {
                        pinFilter('import', pinned);
                        s.$evalAsync();
                    },
                    click: () => {
                        openFilter('import');
                    }
                },
                // 修改時間
                {
                    id: "mtime",
                    label: i18n.__('filter.mtime'),
                    keywords: "mtime time modify 修改時間",
                    icon: 'ic-filter-item-modify.svg',
                    role: "toggle",
                    pinned: eagle.filter.pinned['mtime'],
                    toggle: (pinned) => {
                        pinFilter('mtime', pinned);
                        s.$evalAsync();
                    },
                    click: () => {
                        openFilter('mtime');
                    }
                },
                // 解析度
                {
                    id: "resolution",
                    label: i18n.__('filter.resolution'),
                    keywords: "resolution dimension 解析度 尺寸 分辨率",
                    icon: 'ic-filter-item-resolution.svg',
                    role: "toggle",
                    pinned: eagle.filter.pinned['resolution'],
                    toggle: (pinned) => {
                        pinFilter('resolution', pinned);
                        s.$evalAsync();
                    },
                    click: () => {
                        openFilter('resolution');
                    }
                },
                // 時長
                {
                    id: "duration",
                    label: i18n.__('filter.duration'),
                    keywords: "duration time 時長 時間",
                    icon: 'ic-filter-item-duration.svg',
                    role: "toggle",
                    pinned: eagle.filter.pinned['duration'],
                    toggle: (pinned) => {
                        pinFilter('duration', pinned);
                        s.$evalAsync();
                    },
                    click: () => {
                        openFilter('duration');
                    }
                },
                // 檔案大小
                {
                    id: "size",
                    label: i18n.__('filter.fileSize'),
                    keywords: "size filesize 檔案大小 文件大小",
                    icon: 'ic-filter-item-size.svg',
                    role: "toggle",
                    pinned: eagle.filter.pinned['size'],
                    toggle: (pinned) => {
                        pinFilter('size', pinned);
                        s.$evalAsync();
                    },
                    click: () => {
                        openFilter('size');
                    }
                },
                // 註解
                {
                    id: "annotation",
                    label: i18n.__('filter.comments'),
                    keywords: "comments comment 註解 標注 筆記 annotation",
                    icon: 'ic-filter-item-comment.svg',
                    role: "toggle",
                    pinned: eagle.filter.pinned['annotation'],
                    toggle: (pinned) => {
                        pinFilter('annotation', pinned);
                        s.$evalAsync();
                    },
                    click: () => {
                        openFilter('annotation');
                    }
                },
                // 筆記
                {
                    id: "note",
                    label: i18n.__('filter.annotation'),
                    // 日文版關鍵字
                    keywords: "note 筆記 註解 註釋",
                    icon: 'ic-filter-item-note.svg',
                    role: "toggle",
                    pinned: eagle.filter.pinned['note'],
                    toggle: (pinned) => {
                        pinFilter('note', pinned);
                        s.$evalAsync();
                    },
                    click: () => {
                        openFilter('note');
                    }
                },
                // 網址
                {
                    id: "url",
                    label: i18n.__('filter.url'),
                    keywords: "url link website 網址 連結 鏈接",
                    icon: 'ic-filter-item-url.svg',
                    role: "toggle",
                    pinned: eagle.filter.pinned['url'],
                    toggle: (pinned) => {
                        pinFilter('url', pinned);
                        s.$evalAsync();
                    },
                    click: () => {
                        openFilter('url');
                    }
                },
                // 字型
                {
                    id: "fontActivated",
                    visible: !!eagle.filter.filterExtensions['font'],
                    label: i18n.__('filter.fontActivated'),
                    keywords: "font 字型 字體",
                    icon: 'ic-filter-item-font.svg',
                    role: "toggle",
                    pinned: eagle.filter.pinned['fontActivated'],
                    toggle: (pinned) => {
                        pinFilter('fontActivated', pinned);
                        s.$evalAsync();
                    },
                    click: () => {
                        openFilter('fontActivated');
                    }
                },
                // BPM 
                {
                    id: "bpm",
                    visible: !!eagle.filter.filterExtensions['audio'],
                    label: "BPM",
                    keywords: "bpm 節拍 節奏",
                    icon: 'ic-filter-item-bpm.svg',
                    role: "toggle",
                    pinned: eagle.filter.pinned['bpm'],
                    toggle: (pinned) => {
                        pinFilter('bpm', pinned);
                        s.$evalAsync();
                    },
                    click: () => {
                        openFilter('bpm');
                    }
                },
                // 相機
                {
                    id: "camera",
                    visible: !!eagle.filter.filterExtensions['raw'],
                    label: i18n.__('filter.camera'),
                    keywords: "camera 相機 攝影機",
                    icon: 'ic-filter-item-camera.svg',
                    role: "toggle",
                    pinned: eagle.filter.pinned['camera'],
                    toggle: (pinned) => {
                        pinFilter('camera', pinned);
                        s.$evalAsync();
                    },
                    click: () => {
                        openFilter('camera');
                    }
                },
            ];

            items = items.sort(function (a, b) {
                let aIndex = eagle.filter.toolbar.findIndex(function (item) {
                    return item.type === a.id;
                });
                let bIndex = eagle.filter.toolbar.findIndex(function (item) {
                    return item.type === b.id;
                });
                return aIndex - bIndex;
            });
            
            ContextMenu.open({
                items: items,
                showSearch: true,
                sortable: true,
                sortableHelper: true,
                onSorted: (items) => {
                    if (!items) return;
                    if (eagle.filter.toolbar && eagle.filter.toolbar.length > 0) {
                        let toolbarOrders = [];
                        items.forEach((item) => {
                            toolbarOrders.push(item.id);
                        });
                        localStorage.setItem("eagle.filter.toolbar.orders", JSON.stringify(toolbarOrders));
                        eagle.filter.initOrders();
                        s.$evalAsync();
                    }
                }
            });
        }).apply(null, args);
  };

  fns["openFolder"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function(fd, ignoreHistory, currentId, ignoreReload, focus) {
            const folder = s.folderMappings[fd?.id];

            if (!folder) return;
            
            // Skip if already in the same folder, but NOT when navigating from URL (ignoreHistory = true)
            // Also check viewMode to ensure we're not coming from a different view type
            if (!ignoreHistory && s.currentFolder === folder && !s.viewMode && (s.allData.length > 0 || s.subFolders.length > 0) && eagle.filter.filterRules.color.value == undefined &&
                eagle.filter.filterRules.import.type == 'undefined' && s.currentId === currentId
            ) {
                if (s.isDetailMode) {
                    s.leaveDetailMode();
                }
                return;
            }

            ScrollbarSaver.saveScrollPosition();

            s.currentSmartFolder = undefined;
            s.$root.currentFocus = focus || "sidebar";
            s.resetPage();
            s.viewMode = undefined;
            s.currentId = currentId || "folder-" + folder.id;
            s.currentFolderPath = s.getFolderFullPath(folder);

            if (s.currentFolder != folder) {
                s.currentFolder = folder;
                s.currentFolderChildren = s.getChildFoldersMap(folder);
            }

			if (localStorage[`eagle.list.layout.$${s.currentFolder.id}`]) {
                if (s.layout !== localStorage[`eagle.list.layout.$${s.currentFolder.id}`]) {
                    s.switchLayout(localStorage[`eagle.list.layout.$${s.currentFolder.id}`]);
                }
			}

            if (!currentId || currentId.indexOf("quickaccess-") === -1) {
	            var ancestors = s.getAncestorFolders(folder, []);
	            if (ancestors.length > 0) {
	                for (var i = 0; i < ancestors.length; i++) {
	                    s.expandFolder(ancestors[i]);
	                }
	            }
            }

            if (!ignoreHistory) {
                UrlStateService.setState({ 
                    view: 'folder', 
                    folder: folder.id,
                    smartfolder: null,
                    tag: null,
                    color: null,
                    page: s.page
                });
            }

            var __lv_height = localStorage.getItem("eagle.list.thumbSize." + folder.id) || 150;
            __lv_height = parseInt(__lv_height);
            s.imageSize.height = parseInt(__lv_height / 5) * 5;
            __lv_updateListHeight(s.imageSize.height);
            if (!ignoreReload) {
                ScrollbarSaver.restoreScrollPosition();
                s.reload();
            }
            else {
                s.rebindRefresh();
            }
            if (s.currentFolder) {
                __lv_setLastFolder(s.currentFolder.id);
            }

            analytics.screenView('Folder');
            
            // 如果文件夾有密碼且未解鎖，並且支援 Touch ID，自動觸發 Touch ID 驗證
            if (s.currentFolder && s.currentFolder.password && !s.currentFolder.isUnLock) {
                if (s.canUseTouchID) {
                    // 延遲一下以確保 UI 已渲染
                    $timeout(function () {
                        s.unlockFolderWithTouchID();
                    }, 500);
                }
            }
        }).apply(null, args);
  };

  fns["openItemLocation"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function (item, folder) {
            s.resetFilter();
            s.keyword = "";
            s.quickOpenFolder(folder, item);
        }).apply(null, args);
  };

  fns["openNewContextMenu"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function() {
            ContextMenu.open({
                items: [
                    // 建立资料夹
                    {
                        accelerator: s.$root.preferences.shortcuts.keybinds['file.create.folder'] || 'CmdOrCtrl+Shift+N',
                        label: i18n.__('context.import.createFolder'),
                        keywords: 'folder dir new create 資料夾 文件夾 新建 建立 新增 ',
                        icon: 'ic-folder-new-folder.svg',
                        click: function() { s.newFolder(); }
                    },
                    // 建立智能资料夹
                    {
                        accelerator: s.$root.preferences.shortcuts.keybinds['file.create.smartfolder'] || 'CmdOrCtrl+Shift+Alt+N',
                        label: i18n.__('context.import.createSmartFolder'),
                        keywords: 'smart folder dir new create 資料夾 文件夾 新建 建立 新增 智能 智慧',
                        icon: 'ic-smart-folder-new.svg',
                        click: function() {
                            s.newSmartFolder();
                            s.$evalAsync();
                        }
                    },
                    {
                        role: 'separator'
                    },
                    // 導入本地文件夾
                    {
                        accelerator: s.$root.preferences.shortcuts.keybinds['file.import.folders'],
                        label: i18n.__('context.import.folders'),
                        keywords: 'import folder dir 資料夾 文件夾 導入 local 本地 本機 本机 匯入 导入',
                        icon: 'ic-import-local.svg',
                        click: function() {
                            s.importFolders();
                        }
                    },
                    // 導入連結
                    {
                        accelerator: s.$root.preferences.shortcuts.keybinds['file.import.links'],
                        label: i18n.__('appmenu.file>links'),
                        keywords: '',
                        icon: 'ic-import-links.svg',
                        click: function() {
                            s.importLinks();
                        }
                    },
                    // 導入 eaglepack
                    {
                        accelerator: s.$root.preferences.shortcuts.keybinds['file.import.eaglepack'],
                        label: i18n.__('context.import.eaglepack'),
                        keywords: 'import eaglepack 素材包 導入 匯入',
                        icon: 'ic-import-eaglepack.svg',
                        click: function () {
                            dialog.showOpenDialog(currentWindow, {
                                title: i18n.__("Dialog.Import.Eaglepack.Message"),
                                filters: [
                                    { name: 'Eagle Pack', extensions: ['eaglepack'] },
                                ],
                                properties: ['openFile']
                            }).then(__lv_result => {
                                var paths = __lv_result.filePaths;
                                if (!paths || paths.length === 0) return;
                                var __lv_packPath = paths[0];
                                ipcRenderer.send("open-eaglepack", {
                                    __lv_path: __lv_packPath
                                });
                            });
                        }
                    },
                    {
                        label: i18n.__("appmenu.file>autoImport"),
                        icon: 'ic-import-autoimport.svg',
                        submenu: {
                            items: [
                                {
                                    label: i18n.__("appmenu.file>autoImport>settings"),
                                    keywords: `$${i18n.__("appmenu.file>autoImport")} 自動導入 設定 設置 settings auto import`,
                                    click: function () {
                                        ipcRenderer.send('open.preferences', {
                                            panel: "autoImport"
                                        });
                                    }
                                },
                                {
                                    disabled: true,
                                    visible: s.$root.preferences.autoImport.enable === 'true' && s.$root.preferences.autoImport.path,
                                    label: s.$root.preferences.autoImport.path,
                                    click: function () {
                                        ipcRenderer.send('open-with-default', s.$root.preferences.autoImport.path);
                                    }
                                }
                            ]
                        }
                    },
                    // 找重複檔案
                    {
                        label: i18n.__("context.import.findDuplicate"),
                        icon: 'ic-find-duplicate.svg',
                        submenu: {
                            items: [
                                {
                                    label: i18n.__("context.import.findDuplicate>all"),
                                    keywords: 'duplicate 重複 搜索 尋找 repeat',
                                    click: function () {
                                        s.openDuplicate();
                                        s.$evalAsync();
                                    }
                                },
                                {
                                    disabled: s.allData.length === 0,
                                    label: i18n.__("context.import.findDuplicate>currentList"),
                                    keywords: 'duplicate 重複 搜索 尋找 repeat',
                                    click: function () {
                                        s.openDuplicate({
                                            currentPage: true
                                        });
                                        s.$evalAsync();
                                    }
                                },
                                {
                                    disabled: s.selected.length <= 1,
                                    label: i18n.__("context.import.findDuplicate>selected"),
                                    keywords: 'duplicate 重複 搜索 尋找 repeat',
                                    click: function () {
                                        s.openDuplicate({
                                            __lv_selected: true
                                        });
                                        s.$evalAsync();
                                    }
                                }
                            ]
                        }
                    },
                    {
                        role: 'separator'
                    },
                    // 設計文件
                    {
                        visible: process.platform == 'darwin' && installedApplications["sketch"].isInstalled,
                        label: "Sketch " + i18n.__("general.document"),
                        keywords: 'template 模板 file',
                        icon: '/templates/ic-sketch.png',
                        click: function() { s.newFileFromTemplate("sketch"); s.$evalAsync(); }
                    },
                    {
                        label: "Photoshop " + i18n.__("general.document"),
                        icon: '/templates/ic-photoshop.png',
                        keywords: 'template 模板 file adobe psd photoshop',
                        click: function() { s.newFileFromTemplate("psd"); s.$evalAsync(); }
                    },
                    {
                        label: "Illustrator " + i18n.__("general.document"),
                        icon: '/templates/ic-illustration.png',
                        keywords: 'template 模板 file adobe ai illustrator',
                        click: function() { s.newFileFromTemplate("ai"); s.$evalAsync(); }
                    },
                    {
                        label: "XD " + i18n.__("general.document"),
                        icon: '/templates/ic-xd.png',
                        keywords: 'template 模板 file adobe xd',
                        click: function() { s.newFileFromTemplate("xd"); s.$evalAsync(); }
                    },
                    {
                        role: 'separator'
                    },
                    // 其它文件
                    {
                        accelerator: 'Alt+Shift+N',
                        label: i18n.__("general.txtDocument"),
                        icon: '/templates/ic-txt.png',
                        keywords: 'template 模板 file note txt text',
                        click: function() { s.newFileFromTemplate("txt"); s.$evalAsync(); }
                    },
                    {
                        label: "Word " + i18n.__("general.document"),
                        icon: '/templates/ic-word.png',
                        keywords: 'template 模板 file office microsoft doc docx word',
                        click: function() { s.newFileFromTemplate("docx"); s.$evalAsync(); }
                    },
                    {
                        label: "PowerPoint " + i18n.__("general.document"),
                        icon: '/templates/ic-powerpoint.png',
                        keywords: 'template 模板 file office microsoft ppt pptx powerpoint',
                        click: function() { s.newFileFromTemplate("pptx"); s.$evalAsync(); }
                    },
                    {
                        label: "Excel " + i18n.__("general.document"),
                        icon: '/templates/ic-excel.png',
                        keywords: 'template 模板 file office microsoft xls xlsx csv excel',
                        click: function() { s.newFileFromTemplate("xlsx"); s.$evalAsync(); }
                    },
                    {
                        visible: process.platform == 'darwin',
                        label: "Keynote " + i18n.__("general.document"),
                        icon: '/templates/ic-keynote.png',
                        keywords: 'template 模板 file apple office',
                        click: function() { s.newFileFromTemplate("key"); s.$evalAsync(); }
                    },
                    {
                        visible: process.platform == 'darwin',
                        label: "Pages " + i18n.__("general.document"),
                        icon: '/templates/ic-pages.png',
                        keywords: 'template 模板 file apple office',
                        click: function() { s.newFileFromTemplate("pages"); s.$evalAsync(); }
                    },
                    {
                        visible: process.platform == 'darwin',
                        label: "Numbers " + i18n.__("general.document"),
                        icon: '/templates/ic-numbers.png',
                        keywords: 'template 模板 file apple office',
                        click: function() { s.newFileFromTemplate("numbers"); s.$evalAsync(); }
                    },
                    {
                        visible: process.platform == 'darwin' && installedApplications["mindnode"].isInstalled,
                        label: "MindNode " + i18n.__("general.document"),
                        icon: '/templates/ic-mindnode.png',
                        keywords: 'template 模板 file mind 脑图 心智图',
                        click: function() { s.newFileFromTemplate("mindnode"); s.$evalAsync(); }
                    },
                    {
                        visible: (process.platform == 'darwin')? installedApplications["xmind"].isInstalled : true,
                        label: "XMind " + i18n.__("general.document"),
                        icon: '/templates/ic-xmind.png',
                        keywords: 'template 模板 file mind 脑图 心智图',
                        click: function() { s.newFileFromTemplate("xmind"); s.$evalAsync(); }
                    },
                    {
                        role: 'separator'
                    },
                    {
                        accelerator: s.$root.preferences.shortcuts.keybinds['file.import.pinterest'],
                        label: "Pinterest",
                        icon: '/templates/ic-pinterest.png',
                        click: function() { s.openPinterest(); }
                    },
                    {
                        label: i18n.__('context.import.others>artstation'),
                        icon: '/templates/ic-artstation.png',
                        accelerator: preferences.shortcuts.keybinds['file.import.artstation'] || 'Ctrl+Alt+Shift+S',
                        click: function() { s.openArtstation(); }
                    },
                    {
                        visible: preferences?.general?.language === "zh_CN",
                        label: i18n.__('context.import.others>huaban'),
                        keywords: 'huaban 花瓣',
                        icon: '/templates/ic-huaban.png',
                        click: function() { s.openHuaban(); }
                    }
                ],
                showSearch: true,
            })
        }).apply(null, args);
  };

  fns["openQuickAccessContextMenu"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function (event, item) {
            const $__lv_target = $(event.delegateTarget);
            ContextMenu.open({
                items: [
                    {
                        label: i18n.__("Context.QuickAccess.Remove"),
                        icon: "ic-favorite-remove.svg",
                        click: () => {
                            const __lv_idx = s.quickAccess.indexOf(item);
                            if (__lv_idx !== -1) {
                                QuickAccessManager.removeIndex(__lv_idx);
                                s.$evalAsync();
                            }
                        }
                    }
                ],
                showSearch: false,
                onOpened: () => {
                    $__lv_target.addClass("context-activate");
                },
                onClosed: () => {
                    $__lv_target.removeClass("context-activate");
                }
            });
        }).apply(null, args);
  };

  fns["openQuickSearch"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function (event) {
            s.$root.$broadcast('OPEN_QUICK_SEARCH_MODAL');
        }).apply(null, args);
  };

  fns["openRatioContextMenu"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function() {
            ContextMenu.open({
                items: [
                    { label: '5%', checked: parseInt(s.imageSize.zoomRatioExp) == 5, click: () => { s.updateZoomRatio(s.getRatioNonExp(5), undefined, undefined, true); s.imageSize.zoomRatioExp = 5; s.$evalAsync(); } },
                    { label: '10%', checked: parseInt(s.imageSize.zoomRatioExp) == 10, click: () => { s.updateZoomRatio(s.getRatioNonExp(10), undefined, undefined, true); s.imageSize.zoomRatioExp = 10; s.$evalAsync(); } },
                    { label: '25%', checked: parseInt(s.imageSize.zoomRatioExp) == 25, click: () => { s.updateZoomRatio(s.getRatioNonExp(25), undefined, undefined, true); s.imageSize.zoomRatioExp = 25; s.$evalAsync(); } },
                    { label: '50%', checked: parseInt(s.imageSize.zoomRatioExp) == 50, click: () => { s.updateZoomRatio(s.getRatioNonExp(50), undefined, undefined, true); s.imageSize.zoomRatioExp = 50; s.$evalAsync(); } },
                    { label: '100%', checked: parseInt(s.imageSize.zoomRatioExp) == 100, click: () => { s.updateZoomRatio(s.getRatioNonExp(100), undefined, undefined, true); s.imageSize.zoomRatioExp = 100; s.$evalAsync(); } },
                    { label: '125%', checked: parseInt(s.imageSize.zoomRatioExp) == 125, click: () => { s.updateZoomRatio(s.getRatioNonExp(125), undefined, undefined, true); s.imageSize.zoomRatioExp = 125; s.$evalAsync(); } },
                    { label: '150%', checked: parseInt(s.imageSize.zoomRatioExp) == 150, click: () => { s.updateZoomRatio(s.getRatioNonExp(150), undefined, undefined, true); s.imageSize.zoomRatioExp = 150; s.$evalAsync(); } },
                    { label: '200%', checked: parseInt(s.imageSize.zoomRatioExp) == 200, click: () => { s.updateZoomRatio(s.getRatioNonExp(200), undefined, undefined, true); s.imageSize.zoomRatioExp = 200; s.$evalAsync(); } },
                    { label: '300%', checked: parseInt(s.imageSize.zoomRatioExp) == 300, click: () => { s.updateZoomRatio(s.getRatioNonExp(300), undefined, undefined, true); s.imageSize.zoomRatioExp = 300; s.$evalAsync(); } },
                    { label: '400%', checked: parseInt(s.imageSize.zoomRatioExp) == 400, click: () => { s.updateZoomRatio(s.getRatioNonExp(400), undefined, undefined, true); s.imageSize.zoomRatioExp = 400; s.$evalAsync(); } },
                    { label: '800%', checked: parseInt(s.imageSize.zoomRatioExp) == 800, click: () => { s.updateZoomRatio(s.getRatioNonExp(800), undefined, undefined, true); s.imageSize.zoomRatioExp = 800; s.$evalAsync(); } },
                    { role: 'separator' },
                    { label: i18n.__('context.zoom.zoomActural'), accelerator: preferences.shortcuts.keybinds['view.zoom.actual'], click: () => { s.zoomActual(); s.$evalAsync(); } },
                    { label: i18n.__('context.zoom.zoomFit'), accelerator: preferences.shortcuts.keybinds['view.zoom.fit'], click: () => { s.zoomFit(); s.$evalAsync(); } },
                ],
                showSearch: false,
            });            
        }).apply(null, args);
  };

  fns["openSidebarVisibleContextMenu"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function () {
            const $__lv_target = $(".sidebar-item-container .item").has(event.target);
            ContextMenu.open({
                items: [
                    {
                        checked: true, 
                        disabled: true,
                        label: i18n.__('preferencesWindow.sidebar.all'),
                        icon: 'ic-sidebar-all.svg',
                        keepOpen: true,
                        click: () => {}
                    },
                    {
                        checked: s.$root.preferences.sidebar.unfiled === 'true', 
                        label: i18n.__('preferencesWindow.sidebar.unfiled'),
                        icon: 'ic-sidebar-unfiled.svg',
                        keepOpen: true,
                        click: () => {
                            if (s.$root.preferences.sidebar.unfiled === "true") s.$root.preferences.sidebar.unfiled = 'false';
                            else s.$root.preferences.sidebar.unfiled = "true";
                            ipcRenderer.send('chnage-preferences', s.$root.preferences);
                        }
                    },
                    {
                        checked: s.$root.preferences.sidebar.untagged === 'true', 
                        label: i18n.__('preferencesWindow.sidebar.untagged'),
                        icon: 'ic-sidebar-untagged.svg',
                        keepOpen: true,
                        click: () => {
                            if (s.$root.preferences.sidebar.untagged === "true") s.$root.preferences.sidebar.untagged = 'false';
                            else s.$root.preferences.sidebar.untagged = "true";
                            ipcRenderer.send('chnage-preferences', s.$root.preferences);
                        }
                    },
                    {
                        checked: s.$root.preferences.sidebar.recent === 'true', 
                        label: i18n.__('general.pages.recent'),
                        icon: 'ic-sidebar-recent.svg',
                        keepOpen: true,
                        click: () => {
                            if (s.$root.preferences.sidebar.recent === "true") s.$root.preferences.sidebar.recent = 'false';
                            else s.$root.preferences.sidebar.recent = "true";
                            ipcRenderer.send('chnage-preferences', s.$root.preferences);
                        }
                    },
                    {
                        checked: s.$root.preferences.sidebar.random === 'true', 
                        label: i18n.__('preferencesWindow.sidebar.random'),
                        icon: 'ic-sidebar-random.svg',
                        keepOpen: true,
                        click: () => {
                            if (s.$root.preferences.sidebar.random === "true") s.$root.preferences.sidebar.random = 'false';
                            else s.$root.preferences.sidebar.random = "true";
                            ipcRenderer.send('chnage-preferences', s.$root.preferences);
                        }
                    },
                    {
                        checked: s.$root.preferences.sidebar.community2 === 'true', 
                        label: i18n.__('preferencesWindow.sidebar.community'),
                        icon: 'ic-sidebar-community.svg',
                        keepOpen: true,
                        click: () => {
                            if (s.$root.preferences.sidebar.community2 === "true") s.$root.preferences.sidebar.community2 = 'false';
                            else s.$root.preferences.sidebar.community2 = "true";
                            ipcRenderer.send('chnage-preferences', s.$root.preferences);
                        }
                    },
                    {
                        checked: true, 
                        disabled: true, 
                        label: i18n.__('preferencesWindow.sidebar.allTags'),
                        icon: 'ic-sidebar-tag-manager.svg',
                        keepOpen: true,
                        click: () => {}
                    }
                ],
                showSearch: false,
                onOpened: () => {
                    $__lv_target.addClass("context-activate");
                },
                onClosed: () => {
                    $__lv_target.removeClass("context-activate");
                }
            });
        }).apply(null, args);
  };

  fns["openSmartFolder"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function(smartFolder, ignoreHistory, currentId) {
            if (!smartFolder) return;
            if (s.currentSmartFolder === smartFolder && s.allData.length > 0 && eagle.filter.filterRules.color.value == undefined &&
                eagle.filter.filterRules.import.type == 'undefined' && s.currentId === currentId
            ) {
                if (s.isDetailMode) {
                    s.leaveDetailMode();
                }
                return;
            }

            ScrollbarSaver.saveScrollPosition();

            if (s.currentFolder) { s.currentFolder.editable = false; }
            if (s.currentSmartFolder) { s.currentSmartFolder.editable = false; }

            s.currentFolder = undefined;
            eagle.inspector.reset();
            s.currentFolderChildren = undefined;
            s.$root.selectedSmartFoldersMappings = {};
            s.$root.selectedSmartFolders = [];
            s.$root.currentFocus = "sidebar";
            s.resetPage();
            s.viewMode = undefined;
            s.currentId = currentId || "smart-folder-" + smartFolder.id;

            if (s.currentSmartFolder != smartFolder) {
                s.currentSmartFolder = smartFolder;
            }

			if (localStorage[`eagle.list.layout.$${s.currentSmartFolder.id}`]) {
				s.switchLayout(localStorage[`eagle.list.layout.$${s.currentSmartFolder.id}`]); 
			}

            if (!currentId || currentId.indexOf("quickaccess-") === -1) {
	            var ancestors = machineryGetAncestorSmartFolders(s, smartFolder, []);
	            if (ancestors.length > 0) {
	                for (var i = 0; i < ancestors.length; i++) {
	                    s.expandSmartFolder(ancestors[i]);
	                }
	            }
            }

            $timeout.cancel(__lv_openSmartFolderTimeout);
            __lv_openSmartFolderTimeout = $timeout(function() {
                if (!ignoreHistory) {
                    UrlStateService.setState({
                        view: 'smartfolder',
                        smartfolder: smartFolder.id,
                        folder: null,
                        tag: null,
                        color: null
                    });
                }
                s.imageSize.height = localStorage.getItem("eagle.list.thumbSize." + smartFolder.id) || 150;
                s.imageSize.height = parseInt(s.imageSize.height);
                __lv_updateListHeight(s.imageSize.height);
                ScrollbarSaver.restoreScrollPosition();
                s.reload();
                analytics.screenView('SmartFolder');

                if (s.currentSmartFolder) {
	                __lv_setLastFolder(s.currentSmartFolder.id);
	            }

            }, 25);
        }).apply(null, args);
  };

  fns["openSmartFolderExpandContextMenu"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function(event, smartFolder) {
            event.stopPropagation();
            ContextMenu.open({
                items: [
                    {
                        label: i18n.__("Context.Expand.Folder"),
                        icon: 'ic-expand.svg',
                        click: () => {
                            s.toggleSelectSmartFolder(event, smartFolder);
                            s.$evalAsync();
                        }
                    },
                    {
                        label: i18n.__("Context.Expand.SameLevel.Folders"),
                        icon: 'ic-expand-same.svg',
                        click: () => {
                            s.toggleCurrentLevelSmartFolders(event, smartFolder);
                            s.$evalAsync();
                        }
                    },
                    {
                        label: i18n.__("Context.Expand.All.Folders"),
                        icon: 'ic-expand-all.svg',
                        click: () => {
                            s.toggleAllSmartFolderExpand(event, smartFolder);
                            s.$evalAsync();
                        }
                    },
                ],
                showSearch: false,
                onOpened: () => {
                    smartFolder.isSelected = true;
                    s.$evalAsync();
                },
                onClosed: () => {
                    smartFolder.isSelected = false;
                    s.$evalAsync();
                }
            });
        }).apply(null, args);
  };

  fns["openTag"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function(tag, ignoreHistory) {
            s.resetPage();
            s.$root.currentFocus = "content";
            s.currentFolder = undefined;
            s.currentFolderChildren = undefined;
            __lv_TagManager.filterWithTags([tag], ignoreHistory);
        }).apply(null, args);
  };

  fns["openUnfiled"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function(ignoreHistory) {

            if (s.viewMode === 'unfiled' && s.allData.length > 0 && eagle.filter.filterRules.color.value == undefined) {
                if (s.isDetailMode) {
                    s.leaveDetailMode();
                }
                return;
            }

            ScrollbarSaver.saveScrollPosition();
            s.viewMode = 'unfiled';
            s.$root.currentFocus = "sidebar";
            s.resetPage();

            $timeout.cancel(__lv_openUnfiledTimeout);
            __lv_openUnfiledTimeout = $timeout(function() {
                if (!ignoreHistory) {
                    UrlStateService.setState({ view: 'unfiled', folder: null, smartfolder: null, tag: null, color: null });
                }
                s.imageSize.height = localStorage.getItem("eagle.list.thumbSize.unfiled") || 150;
                s.imageSize.height = parseInt(s.imageSize.height);
                __lv_setLastFolder(undefined);
                __lv_updateListHeight(s.imageSize.height);
                ScrollbarSaver.restoreScrollPosition();
                $("#sidebar-item-container").scrollTop(0);
                s.reload();
                analytics.screenView('Unfiled');
            }, 50);
        }).apply(null, args);
  };

  fns["prevGifFrame"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function(amount = 1) {
            if (s.gifPlayer && s.isGifReady) {
                s.gifPlayer.pause();
                s.gifViewer.playing = false;
                var curr = s.gifPlayer.get_current_frame();
                var __lv_idx = curr - amount;
                if (__lv_idx < 0) __lv_idx = 0;
                s.gifPlayer.move_to(__lv_idx);
                s.$evalAsync();
            }
        }).apply(null, args);
  };

  fns["preventMiddleClick"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function(event) {
            if( event.which == 2 ) {
                event.stopPropagation();
            }
        }).apply(null, args);
  };

  fns["renameTagGroupBlur"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function (__lv_group, newName) {
            if (newName) {
                __lv_TagManager.renameGroup(__lv_group.id, newName);
                delete __lv_group.editable;
            }
        }).apply(null, args);
  };

  fns["renameTagGroupKeyup"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function (event, __lv_group, newName) {
            event.stopPropagation();
            // event.preventDefault();
            if (event.keyCode === 13) {
                __lv_TagManager.renameGroup(__lv_group.id, newName);
                __lv_group.editable = false;
            }
            else if (event.keyCode === 27) {
                //
                __lv_group.editable = false;
            }
            return false;
        }).apply(null, args);
  };

  fns["resetFilter"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function () {
            eagle.filter.isLock = false;
            eagle.filter.filterBadge = 0;

            eagle.filter.resetFilterRules();

            s.containTags = [];
            s.containFolders = [];

            eagle.filter.filterRules.import.selectedMonths = {};
            eagle.filter.filterRules.mtime.selectedMonths = {};

            $("[filter-item].open").removeClass("open");
            s.startCursor = 0;
            s.$root.$broadcast("Reset_Filter");
            s.calculateFilterCounts();
        }).apply(null, args);
  };

  fns["rotateHandler"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function ($event) {
        	if (VIDEO_TYPES[s.current.ext] || AUDIO_TYPES[s.current.ext]) {
        		s.rotateVideo($event, s.current);
        	}
        	else {
        		s.rotateImage($event, s.current);
        	}
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
                    $("#detail-container").smoothZoom('rotate', {angle: -90, item: rotatedImage});
                }
                else {
                    degree = degree + 90;
                    $("#detail-container").smoothZoom('rotate', {angle: 90, item: rotatedImage});
                }
            }
            else {
                degree = degree - 90;
                $("#detail-container").smoothZoom('rotate', {angle: -90, item: rotatedImage});
            }

            $("#detail-image").data("degree", degree);
            $("#detail-image").css({
                "transform": `rotate($${degree}deg) scaleX(1) scaleY(1)`,
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
                            __lv_html: `
                                <div class="alert">
                                    <div class="alert-icon error"></div>
                                    <h4 class="alert-title">Error</h4>
                                    <p class="alert-desc">$${err?.message}</p>
                                </div>
                            `,
                            showCloseButton: false, showCancelButton: true, allowOutsideClick: false, focusConfirm: false, focusCancel: false, padding: 24,
                            __lv_width: 400,
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
                            electronLog && electronLog.info(`[app] Rotate image: $${rotatedImage.name}($${rotatedImage.id})`); 
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

  fns["rotateVideo"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function (event) {
            var player = machineryGetVideoPlayer(s);
            if (!player) return;

            if (player.type === 'mpv') {
                var mpv = player.el;
                var degree = machineryCalcRotateDegree(mpv.previewRotation || 0, event);
                mpv.rotate(degree);
            }
            else {
                var __lv_video = player.el;
                var $__lv_video = $(__lv_video);
                var degree = machineryCalcRotateDegree($__lv_video.data("degree") || 0, event);

                $__lv_video.data("degree", degree);
                $__lv_video.removeClass("r90 r180 r270");
                if (degree) $__lv_video.addClass(`r$${degree}`);

                if (degree === 90 || degree === 270) {
                    __lv_video.style.setProperty('max-height', `calc($${__lv_video.videoHeight / __lv_video.videoWidth * 100}% - 24px)`, 'important');
                }
                else {
                    $__lv_video.css({ "max-height": "" });
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

            electronLog.info(`[app] Crop image: $${imagePath}`);

            if (!fs.existsSync(imagePath)) {
                s.cancelCrop();
                electronLog.error(`[app] Image file does not exist`);
                return;
            }
            setTimeout(() => {
                const imageCropper = require(appRoot + '/my_modules/image-cropper');
                imageCropper(imagePath, croppedImage, top, left, __lv_width, __lv_height, function (err, { buffer, base64 }) {
                    electronLog.info(`[app] Prepare to write to file: $${imagePath}`);

                    if (buffer && buffer.length > 0) {

                        if (saveAsNewFile) {
                            let newId = guid();
                            let newFilePath = `$${EAGLE_THUMBNAIL_TEMP_PATH}/$${newId}.$${croppedImage.ext}`;
                            fs.writeFile(newFilePath, buffer, function (err) {
                                let newFile = {
                                    name: croppedImage.name,
                                    __lv_path: newFilePath,
                                    lastModified: Date.now(),
                                    __lv_tags: croppedImage.tags || [],
                                    folders: croppedImage.folders || [],
                                    url: croppedImage.url || "",
                                    lastModified: croppedImage.modificationTime + 0.1,
                                    modificationTime: croppedImage.modificationTime + 0.1,
                                    star: croppedImage.star,
                                    merged: true
                                };
                                s.uploadFiles([newFile]);
                                s.isCropMode = false;
                                s.leaveDetailMode();
                                s.$evalAsync();
                            });
                            return;
                        }

                        setTimeout(function () {
                            swal({
                                __lv_html: `
                                    <div class="alert">
                                        <div class="alert-image" style="display: flex; justify-content: center;">
                                            <img src="$${base64}" style="margin-bottom: 12px;object-fit: scale-down;width: 350px;height: 350px;border-radius: 6px;">
                                        </div>
                                        <h4 class="alert-title">$${i18n.__("dialog.cropConfirm.title")}</h4>
                                        <p class="alert-desc">$${i18n.__("dialog.cropConfirm.desc")}</p>
                                    </div>
                                `,
                                showCloseButton: false, showCancelButton: true, allowOutsideClick: false, focusConfirm: true, focusCancel: false, padding: 24,
                                __lv_width: 400,
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
                                        s.$evalAsync();
                                    });
                            });
                        }, 200);
                    }
                    else {
                        s.isCropMode = false;
                    }
                });
            }, 500);
        }).apply(null, args);
  };

  fns["saveFolder"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function() {
            console.time("s.saveFolder");

            // 保存時進行日文濁音正規化
            const unrom = require(appRoot.path + '/app/js/utils/unorm.js');
            const nfc = (text) => {
                try {
                    return unrom.nfc(text);
                }
                catch (err) {
                    return text;
                }
            };

            var folders = [];
            cloneTree(folders, s.folders);

            eagle.utils.tree.walk(folders, 'children', function (folder, parent, depth) {
                folder.name = nfc(folder.name);
            });
            
            const smartFolders = s.smartFolders.map(function(smartFolder) {
                var clone = {
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

            eagle.utils.tree.walk(smartFolders, 'children', function (smartFolder, parent, depth) {
                smartFolder.name = nfc(smartFolder.name);
            });

            const groups = __lv_TagManager.groups.map(function (__lv_group) {
                var g = {
                    id: __lv_group.id,
                    name: nfc(__lv_group.name),
                    __lv_tags: __lv_group.tags
                };
                if (__lv_group.color) {
                    g.color = __lv_group.color;
                }
                if (__lv_group.description !== undefined) {
                    g.description = __lv_group.description;
                }
                return g;
            });

            const quickAccess = s.quickAccess.map(function (item) {
                return {
                    type: item.type,
                    id: item.id
                }
            });

            const __lv_libraryPath = s.libraryPath;

            (window as any).IPCHelper.send('folders-change', {
                // NOTE: 把資源庫路徑寫死，避免更新到其他資源庫路徑
                libraryDir: __lv_libraryPath,
                folders: folders,
                smartFolders: smartFolders,
                quickAccess: quickAccess,
                tagsGroups: groups,
            });

            console.timeEnd("s.saveFolder");
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

  fns["scrollToSelectedItem"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function() {
            var __lv_target = s.selected[0];
            // 自动定位
            if (__lv_target) {

                if (__lv_target.id) {
                    var $box =$(`#box-$${__lv_target.id}`);
                    if ($box.length > 0 && isElementVisible($box[0]) ) {
                        console.log("无须滚动");
                        return;
                    }
                }
                // var originSelected = [];
                // originSelected = originSelected.concat(s.selected);
                if (s.currentFolder && s.currentFolder.orderBy === "RANDOM") {
                    return;        
                }

                for (var i = s.allData.length - 1; i >= 0; i--) {
                    var __lv_image = s.allData[i];
                    if (__lv_target && __lv_target === __lv_image) {
                        var startPage = parseInt(i / 60);
                        console.log(`目标在第 $${startPage} 页`);
                        console.log($(`#box-$${__lv_target.id}`).length);
                        // 東西不在畫面上，強制更新畫面然後定位
                        if ($(`#box-$${__lv_target.id}`).length === 0 || startPage !== s.startCursor) {
                            s.rebindRefresh(undefined, undefined, startPage);
                            s.relayout();    
                        }
                        $("#box-container").css("visibility", "hidden");
                        s.startCursor = startPage;
                        s.$root.currentFocus = "content";
                        $timeout(function () {
                            // s.selected = originSelected;
                            s.selected.forEach(function (item) {
                                s.select(undefined, item);
                            })
                            s.autoScroll();
                            setTimeout(function () {
                                $("#box-container").css("visibility", "initial");
                            }, 50);
                        }, 200);
                        s.$evalAsync();
                        break;
                    }
                }
            }
        }).apply(null, args);
  };

  fns["search"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function() {
            $timeout.cancel(__lv_keywordModelTimeout);
            __lv_keywordModelTimeout = $timeout(function () {
                if (s.keyword === undefined) return;
                if (s.viewMode !=='alltags') {
                    var keyword = s.keyword.toLowerCase();
                    s.isContainAlphabet = keyword.match(/^[A-Za-z0-9]+$/);
                    
                    // 使用新的解析函數支援 OR 語法
                    let keywordStr = s.keyword; // 保留原始大小寫以識別 OR
                    s.keywords = parseKeywordsWithOR(keywordStr);
                    
                    // 將所有關鍵字轉為小寫（但保留結構）
                    s.keywords = s.keywords.map(kw => {
                        if (Array.isArray(kw)) {
                            return kw.map(k => k.toLowerCase());
                        } else {
                            return kw.toLowerCase();
                        }
                    });

                    // 處理繁簡體轉換
                    if (keyword && !s.isContainAlphabet) {
                        // 需要處理 OR 群組的繁簡體轉換
                        s.keywords_cn = s.keywords.map(kw => {
                            if (Array.isArray(kw)) {
                                // OR 群組
                                return kw.map(k => {
                                    // 移除雙引號後進行轉換
                                    let cleanK = k.replace(/"/g, '');
                                    let converted = chineseConvert.tw2cn(cleanK);
                                    // 如果原本有雙引號，加回去
                                    return k.startsWith('"') ? `"$${converted}"` : converted;
                                });
                            } else {
                                // 單一關鍵字
                                let cleanK = kw.replace(/"/g, '');
                                let converted = chineseConvert.tw2cn(cleanK);
                                return kw.startsWith('"') ? `"$${converted}"` : converted;
                            }
                        });
                        
                        s.keywords_tw = s.keywords.map(kw => {
                            if (Array.isArray(kw)) {
                                // OR 群組
                                return kw.map(k => {
                                    let cleanK = k.replace(/"/g, '');
                                    let converted = chineseConvert.cn2tw(cleanK);
                                    return k.startsWith('"') ? `"$${converted}"` : converted;
                                });
                            } else {
                                // 單一關鍵字
                                let cleanK = kw.replace(/"/g, '');
                                let converted = chineseConvert.cn2tw(cleanK);
                                return kw.startsWith('"') ? `"$${converted}"` : converted;
                            }
                        });
                    }
                    else {
                        s.keywords_cn = [];
                        s.keywords_tw = [];
                    }
                    
                    // 清除 RegEx 快取，下次搜尋時會重新建立
                    s.searchRegexGroup = null;
                    
                    updateSuggestions();
                    s.startCursor = 0;
                    s.filterContent();
                    s.calculateFilterCounts();
                }
                else {
                    s.TagManager.renderTagsResult();
                }
                clearTimeout(__lv_searchTimeout);
                __lv_searchTimeout = setTimeout(function () {
                    if (keyword) {
                        analytics.event('Search', 'Keyword', keyword);
                    }
                }, 1000);
            }, s.keywordDebounce);
        }).apply(null, args);
  };

  fns["searchFocus"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function () {
            // 標籤管理模式下，不需要顯示搜尋建議
            if (s.viewMode === 'alltags') {
                s.showSuggestions = false;
                return;
            }
            if (rectSelecting) return;
            updateSuggestions();
            s.showSuggestions = true;
        }).apply(null, args);
  };

  fns["select"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function(event, __lv_image) {

        	if (event && event.button >= 3) {
        		return;
        	}

        	if (event) event.stopPropagation();

            // 中键点击
            if (event && event.button === 1) {
                if (s.$root.preferences.habits.middleBtn === "openNewWindow") {
                    event && event.preventDefault();
                    if (!AUDIO_TYPES[__lv_image.ext]) {
						openInNewWindow([__lv_image]);
                        RecentFileManager.addFile(__lv_image);
	                    analytics.event('NewWindow', 'Open', __lv_image.ext);
                    }
                }
				else if (s.$root.preferences.habits.middleBtn === "openPluginPanel") {
					event && event.preventDefault();
					s.openPluginPanel();
				}
                return;
            }

            if (HoverPreview.isShow) {
                HoverPreview.hide();
                HoverPreviewKeydown = false;
                HoverPreview.lastElem = undefined;
            }

            if (s.$root.currentFocus !== "content" && s.selected.length > 1) {
            	if (__lv_image && s.selectedMappings[__lv_image.id]) {
            		return;
            	}
            }

            s.$root.currentFocus = "content";
            s.selectedFolderMappings = {};

            $("input:focus").blur();
            $("[contenteditable]:focus").blur();

            $timeout.cancel(__lv_cleanSelectedTimeout);

            if (s.isPreviewing) {
                s.isPreviewing = false;
                currentWindow.closeFilePreview();
            }
            window.getSelection().removeAllRanges();

            if (!__lv_image) {
                return;
            }

            // 如果點擊的內容已經選取
            if (__lv_image && s.selectedMappings[__lv_image.id]) {
                // 如果點擊這些按鍵，就許消選取
                if (event) {

                    // Note: macOS control + 点击等同右键
                    let cancelSelect = false;
                    if (process.platform === 'darwin') {
                        cancelSelect = event.metaKey || event.shiftKey;
                    }
                    else {
                        cancelSelect = event.shiftKey || event.ctrlKey;
                    }

                    if (cancelSelect) {
                    	if (event.button !== 2) {
	                        var __lv_idx = s.selected.indexOf(__lv_image);
	                        s.selected.splice(__lv_idx, 1);
	                        delete s.selectedMappings[__lv_image.id];
                        }
                    }
                }
                return;
            }

            var targetSelectedIndex = s.allData.indexOf(__lv_image);

            if (event && !event.metaKey && !event.shiftKey && !event.ctrlKey) {
                s.selected = [];
                s.lastSelectedIndex = targetSelectedIndex;
            }
            if (event && (event.metaKey || event.ctrlKey) ) {
                s.lastSelectedIndex = targetSelectedIndex;
            }
            if (event && event.shiftKey) {
                s.selected.push(__lv_image);
                s.selectedMappings[__lv_image.id] = true;
                var selection = s.getSelection();

                var __lv_start = selection.start;
                var end = selection.end;

                if (s.lastSelectedIndex >= 0) {
                    __lv_start = s.lastSelectedIndex;
                }

                if (targetSelectedIndex >= 0) {
                    end = targetSelectedIndex;
                }

                if (__lv_start > end) {
                    [__lv_start, end] = [end, __lv_start];
                }

                var invert = selection.invert;
                if (!invert) {
                    for (var i = __lv_start; i <= end; i++) {
                        if (s.allData[i]) {
                            var alidx = s.selected.indexOf(s.allData[i]);
                            if (alidx !== -1) {
                                s.selected.splice(alidx, 1);
                            }
                            s.selected.push(s.allData[i]);
                            s.selectedMappings[s.allData[i].id] = true;
                        }
                    }
                }
                else {
                    for (var i = end; i >= __lv_start; i--) {
                        if (s.allData[i]) {
                            var alidx = s.selected.indexOf(s.allData[i]);
                            if (alidx !== -1) {
                                s.selected.splice(alidx, 1);
                            }
                            s.selected.push(s.allData[i]);
                            s.selectedMappings[s.allData[i].id] = true;
                        }
                    }
                }
            } else if (!s.selectedMappings[__lv_image.id]) {
                if (__lv_image && s.selected.indexOf(__lv_image) === -1) {
                    s.selected.push(__lv_image);
                    s.selectedMappings[__lv_image.id] = true;
                }
            }
            s.selected = [...new Set(s.selected)];
        }).apply(null, args);
  };

  fns["selectDown"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function(event) {
            event && event.preventDefault();
            var selection = s.getSelection();
            var end = selection.end || 0;
            var $arround = machineryGetArroundBox(s, end);
            var $box = $(".box.selected").last();
            var boxOffest = $box.offset();
            if (!boxOffest) return;
            var boxCenterX = boxOffest.left;
            var boxCenterY = boxOffest.top;
            var __lv_target;
            var d = 100000;
            $(".box").each(function(index) {
                var $b = $(this);
                var __lv_offset = $b.offset();
                var bx = __lv_offset.left;
                var by = __lv_offset.top;
                if (s.layout === "GridLayout") {
                    var td = Math.abs(by - boxCenterY);
                    if (boxCenterX == bx && by > boxCenterY) {
                        if (td < d) {
                            d = td;
                            __lv_target = $b;
                        }
                    }
                }
                else {
                    var td = Math.sqrt((boxCenterY - by) * (boxCenterY - by) + (boxCenterX - bx) * (boxCenterX - bx));
                    if (boxOffest.top < __lv_offset.top && Math.abs(boxOffest.top - __lv_offset.top) > 20) {
                        if (td < d) {
                            d = td;
                            __lv_target = $b;
                        }
                    }
                }
            });
            if (__lv_target) {
                var __lv_image = s.getItemByElement(__lv_target[0]);
                s.selected = [__lv_image];
                s.selectedFolderMappings = {};
                if (s.isDetailMode) {
                    s.current = s.selected[0];
                }
                s.autoScroll(__lv_target);
            }
            if (s.isDetailMode) {
                s.forceFitImageSize(s.selected[0], true);
                s.current = s.selected[0];
                s.isGifReady = false;
                $("#detail-container").smoothZoom('updateNavigator', $bodyScope.current);
                if (!s.lastZoom()) {
                    s.zoom();
                }
            }
        }).apply(null, args);
  };

  fns["selectNext"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function(event) {

            if (s.isCropMode) {
                s.$root.$broadcast("MOVE-CROP-TOOL", { horizontal: 1, vertical: 0 });
                return;
            }

            var selection = s.getSelection();
            var __lv_start = selection.start;
            var end = selection.end + 1;

            if (s.isDetailMode) {
                s.rememberScrollTops(s.current);
            }

            if (!s.allData[end]) {
                $("#is-last-item").show();
                setTimeout(() => { $("#is-last-item").hide(); }, 500);
                return;
            }
            else {
                $("#detail-container").smoothZoom('cleanBitmapViewer');
            }

            s.selected = [s.allData[end]];
            s.selectedFolderMappings = {};
            s.$root.currentFocus = "content";

            if (s.isDetailMode) {
                $timeout.cancel(__lv_nextTimeout);
                s.forceFitImageSize(s.selected[0], true);
                s.current = s.selected[0];
                s.isGifReady = false;
            }

            s.autoScroll(end);

            if (s.current) {
                $("#detail-container").smoothZoom('updateNavigator', $bodyScope.current);
                if (!s.lastZoom()) {
                    s.zoom();
                }
                __lv_nextTimeout = $timeout(function () {
                    if (!s.lastZoom()) {
                        s.zoom();
                    }
                    var nextImage = s.allData[end + 1];
                    s.preloadImage("next");
                }, 100);
                s.addToRecentFile(s.current);
            }
        }).apply(null, args);
  };

  fns["selectPrev"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function(event) {

            if (s.isCropMode) {
                s.$root.$broadcast("MOVE-CROP-TOOL", { horizontal: -1, vertical: 0 });
                return;
            }

            var selection = s.getSelection();
            var __lv_start = selection.start;
            var end = selection.end + 1;

            if (__lv_start === 0) { 
                $("#is-first-item").show();
                setTimeout(() => { $("#is-first-item").hide(); }, 500);
                return; 
            }
            if (s.allData.length == 0) { return; }

            if (s.isDetailMode) {
                $("#detail-container").smoothZoom('cleanBitmapViewer');
                s.rememberScrollTops(s.current);
                s.isGifReady = false;
            }

            if (s.allData[__lv_start - 1]) {
                s.selected = [];
                s.selected.push(s.allData[__lv_start - 1]);
                if (s.isDetailMode) {
                    s.forceFitImageSize(s.selected[0], true);
                    s.current = s.selected[0];
                }
                s.autoScroll(__lv_start - 1);
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
                $("#detail-container").smoothZoom('updateNavigator', $bodyScope.current);
                if (!s.lastZoom()) {
                    s.zoom();
                }
                $timeout.cancel(__lv_prevTimeout);
                __lv_prevTimeout = $timeout(function () {
                    if (!s.lastZoom()) {
                        s.zoom();
                    }
                    s.preloadImage("prev");
                }, 100)
                s.addToRecentFile(s.current);
            }
        }).apply(null, args);
  };

  fns["selectUp"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function(event) {

            event && event.preventDefault();

            var selection = s.getSelection();
            var __lv_start = selection.start;
            var $box = $(".box.selected").eq(0);
            var boxOffest = $box.offset();
            if (!boxOffest) return;
            var boxCenterX = boxOffest.left;
            var boxCenterY = boxOffest.top;
            var __lv_target;
            var d = 100000;

            $(".box").each(function(index) {
                var $b = $(this);
                var __lv_offset = $b.offset();
                var bx = __lv_offset.left;
                var by = __lv_offset.top;
                if (s.layout === "GridLayout") {
                    var td = Math.abs(boxCenterY - by);
                    if (boxCenterX == bx && boxCenterY > by) {
                        if (td < d) {
                            d = td;
                            __lv_target = $b;
                        }
                    }
                }
                else {
                    var td = Math.sqrt((boxCenterY - by) * (boxCenterY - by) + (boxCenterX - bx) * (boxCenterX - bx));
                    if (boxOffest.top > __lv_offset.top && Math.abs(boxOffest.top - __lv_offset.top) > 20) {
                        if (td < d) {
                            d = td;
                            __lv_target = $b;
                        }
                    }
                }
            });
            if (__lv_target) {
                var __lv_image = s.getItemByElement(__lv_target[0]);
                s.selected = [__lv_image];
                s.selectedFolderMappings = {};
                if (s.isDetailMode) {
                    s.current = s.selected[0];
                }
                s.autoScroll(__lv_target);
            }
            if (s.isDetailMode) {
                s.forceFitImageSize(s.selected[0], true);
                s.current = s.selected[0];
                s.isGifReady = false;
                $("#detail-container").smoothZoom('updateNavigator', $bodyScope.current);
                if (!s.lastZoom()) {
                    s.zoom();
                }
            }
        }).apply(null, args);
  };

  fns["sidebarFocus"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function($event) {
            $event && $event.stopPropagation();
            s.$root.currentFocus = "sidebar";
        }).apply(null, args);
  };

  fns["smartFolderCount"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function (smartFolder) {
            if (smartFolder) {

            	if (smartFolder.conditions.length === 0) return 0;
                // console.time("计算智能文件夹图片数量");
                var images = [];
                images = s.raw.filter(function (__lv_image) {
                    if (__lv_image.isDeleted) return false;
                    return s.existInSmartFilter(smartFolder, __lv_image);
                });
                if (Object.keys(s.lockedImages).length > 0) {
                    images = images.filter(s.lockImageFilter);
                }
                // console.timeEnd("计算智能文件夹图片数量");
                return images.length;
            }
        }).apply(null, args);
  };

  fns["smartZoom"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function(__lv_target, forceMode) {
            var current = __lv_target || s.current;
            var ratio = s.imageSize.zoomRatio || 100;
            var lastRatio = ratio;
            var $container = $(".content-panel");
            var toolbarHeight = 0;
            var containerWidth;
            var containerHeight;
            var __lv_offsetY = 0;

            if (s.isSlideshowMode) {
                toolbarHeight = 0;
                containerWidth = $(window).width();
                containerHeight = $(window).height() - toolbarHeight;
            }
            else if (s.isInlineMode) {
                toolbarHeight = 96;
                containerWidth = $(window).width();
                containerHeight = $container.height() - toolbarHeight;
            }
            else {
                toolbarHeight = 48;
                containerWidth = $container.width();
                containerHeight = $container.height() - toolbarHeight;
            }

            if (!current) return;

            $("#detail-image").css({
                "transform": `rotate(0deg)`,
                "transition": "none"
            });

            // 不使用智能縮放
            if (s.$root.preferences.habits.defaultRatio != "auto" && !forceMode) {
                ratio = 100;
                __lv_offsetY = toolbarHeight/2 * 100 / ratio;
            }
            // 使用智能縮放
            else {
                if (
                	(current.width >= 960 && current.width * 1.8 < current.height) ||
                	(current.width >= 320 && current.width * 2.7 < current.height)
            	) {
                    ratio = parseInt((containerWidth - 0) / current.width * 100);
                    if (ratio > 100) {
                        ratio = 100;
                    }
                    if (current.height > $container.height()) {
                        __lv_offsetY = toolbarHeight/2 * 100 / ratio;
                        __lv_offsetY += (current.height - containerHeight * 100 / ratio) / -2;
                    }
                    else {
                        __lv_offsetY = toolbarHeight/2 * 100 / ratio;
                    }
                } 
                else {
					if (current.height + toolbarHeight / 2 > containerHeight || current.width + toolbarHeight / 2 > containerWidth) {
						var a = parseInt((containerHeight) / current.height * 100);
						var b = parseInt((containerWidth) / current.width * 100);
						ratio = Math.min(a, b);
					}
					else {
						ratio = 100;
					}
					__lv_offsetY = toolbarHeight/2 * 100 / ratio;
                }

                // 如果是手机尺寸并且尺寸符合画面大小
                if (getImagePixelDensity(current) !== 100) {
                    var mr = getImagePixelDensity(current);
                    var largeThanCotainer = current.width * mr / 100 > containerWidth || current.height * mr / 100 > containerHeight;
                    if (!largeThanCotainer) {
                        ratio = mr;
                        __lv_offsetY = toolbarHeight/2 * 100 / ratio;
                    }
                    else {
                        var wr = mr / ((current.width * mr / 100) / containerWidth);
                        var hr = mr / ((current.height * mr / 100) / containerHeight);
                        ratio = Math.min(wr, hr);
                        __lv_offsetY = toolbarHeight/2 * 100 / ratio;
                    }
                }
                else if (isMobileResolution(current.width, current.height)) {
                    var mr = 100 * isMobileResolution(current.width, current.height) / current.height;
                    var largeThanCotainer = current.width * mr / 100 > containerWidth || current.height * mr / 100 > containerHeight;
                    if (!largeThanCotainer) {
                        ratio = mr;
                        __lv_offsetY = toolbarHeight/2 * 100 / ratio;
                    }
                    else {
                    	var wr = mr / ((current.width * mr / 100) / containerWidth);
                        var hr = mr / ((current.height * mr / 100) / containerHeight);
                        ratio = Math.min(wr, hr);
                        __lv_offsetY = toolbarHeight/2 * 100 / ratio;
                    }
                }
                else if (isMobileWidth(current.width) && current.width * 2.4 < current.height) {
                    ratio = isMobileWidth(current.width) / current.width * 100;
                    if (ratio > 100) {
                        ratio = 100;
                    }
                    if (current.height > $container.height()) {
                        __lv_offsetY = (current.height - $container.height() * 100 / ratio) / -2;
                        __lv_offsetY = toolbarHeight/2 * 100 / ratio;
                    }
                }
            }

            var $detailContainer = $("#detail-container");
            var __lv_width = $detailContainer.width();
            var __lv_height = current && current.height || $detailContainer.height();

        	__lv_offsetY = __lv_offsetY || 0;

            if (ratio) {
                s.imageSize.zoomRatio = s.getRatioNonExp(ratio);
                s.imageSize.zoomRatioExp = s.getRatioExp(s.imageSize.zoomRatio);
            }
            s.showLargeImage = true;
            $detailContainer.smoothZoom('focusTo', {
                __lv_x: __lv_width / 2,
                __lv_y: __lv_height / 2 + __lv_offsetY,
                zoom: s.imageSize.zoomRatio,
                speed: 0
            });
        }).apply(null, args);
  };

  fns["startDrag"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function (event) {
            if (s.current) {
                var __lv_transformsJSON = JSON.stringify([s.current]);
                ipcRenderer.send('ondragstart', { images: __lv_transformsJSON, __lv_target: s.current, resize: 120 });
            }
        }).apply(null, args);
  };

  fns["switchGridLayout"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function () {
            s.switchLayout("GridLayout");
            s.$evalAsync();
            s.saveLayout(s.currentFolder || s.currentSmartFolder, "GridLayout");
        }).apply(null, args);
  };

  fns["switchJustifiedLayout"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function () {
            s.switchLayout("JustifiedLayout");
            s.$evalAsync();
            s.saveLayout(s.currentFolder || s.currentSmartFolder, "JustifiedLayout");
        }).apply(null, args);
  };

  fns["switchLibrary"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function (event) {
            var shortcutMode = event.button === undefined;
            var openFixUtils = event && (event.altKey || event.metaKey || event.ctrlKey);
            if (openFixUtils && !shortcutMode) {
                FixUtils.openContextMenu();
            }
            else {
                s.$root.$broadcast("OPEN_LIBRARY_PANEL");
            }
        }).apply(null, args);
  };

  fns["switchListLayout"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function () {
            s.switchLayout("ListLayout");
            s.$evalAsync();
            s.saveLayout(s.currentFolder || s.currentSmartFolder, "ListLayout");
        }).apply(null, args);
  };

  fns["switchSquareLayout"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function () {
            s.switchLayout("SquareLayout");
            s.$evalAsync();
            s.saveLayout(s.currentFolder || s.currentSmartFolder, "SquareLayout");
        }).apply(null, args);
  };

  fns["toggleAll"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function($event) {
            if ($event) {
                $event.preventDefault();
                $event.stopPropagation();
            }
            if (s.isHideSidebar) {
                eagle.inspector.isHideInspector = s.isHideSidebar = false;
            } else {
                eagle.inspector.isHideInspector = s.isHideSidebar = true;
            }
            $timeout(function() {
                s.lastItemStates = {};
                $(window).trigger("orientationchange");
                s.boxContianerWidth = $("#box-container").width() || s.boxContianerWidth;
                s.boxContianerHeight = $("#box-container").height() || s.boxContianerHeight;
                s.relayout();
                s.offsetScrollbar(30);
                if (s.isDetailMode) {
                	s.$root.currentFocus = "content";
                }
                if (s.isDetailMode && s.lastZoomMode === "edge") {
                    s.zoomFitEdge(event);
                }
                // if (s.layout === "GridLayout" || s.layout === "SquareLayout") { 
                //     var currentColumn = ig._layout._columnLength;
                //     var currentWidth = s.imageSize.height;
                //     var targetColumn = Math.floor(s.boxContianerWidth / currentWidth);
                //     s.adjustLayoutWidth(targetColumn - currentColumn); 
                // }
            }, 100);
            localStorage.setItem("isHideSidebar", s.isHideSidebar);
            if (s.isHideSidebar) { electronLog && electronLog.info("[app] Sidebar: OFF"); }
            else { electronLog && electronLog.info("[app] Sidebar: ON"); }
            if (eagle.inspector.isHideInspector) { electronLog && electronLog.info("[app] Sidebar: OFF"); }
            else { electronLog && electronLog.info("[app] Sidebar: ON"); }
        }).apply(null, args);
  };

  fns["toggleExtFilter"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function (__lv_ext) {
            delete eagle.filter.filterRules.type.excludes[__lv_ext];
            if (!eagle.filter.filterRules.type.includes[__lv_ext]) {
                eagle.filter.filterRules.type.includes[__lv_ext] = true;
            }
            else {
                delete eagle.filter.filterRules.type.includes[__lv_ext];
            }
        }).apply(null, args);
  };

  fns["toggleExtFilterExclude"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function (__lv_ext) {
            delete eagle.filter.filterRules.type.includes[__lv_ext];
            if (!eagle.filter.filterRules.type.excludes[__lv_ext]) {
                eagle.filter.filterRules.type.excludes[__lv_ext] = true;
            }
            else {
                delete eagle.filter.filterRules.type.excludes[__lv_ext];
            }
        }).apply(null, args);
  };

  fns["toggleFolderExpand"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function(event, folder) {

            event.stopPropagation();

            if (!folder.children || folder.children.length ==0) return;

            // 如果用户点击了 ⌘ + alt，展开/收起所有层级
            if (event.altKey && (event.metaKey || event.ctrlKey)) {
                var expand = !folder.isExpand;
                machineryToggleAllFolders(s, s.folders, expand);
            }
            // 如果用户点击 ⌘，展开/收起第一层
            else if (event.metaKey || event.ctrlKey) {
                var expand = !folder.isExpand;
                var parent = s.folderMappings[folder.parent];
                var folders = s.folders;
                if (parent && parent.children) {
                    folders = parent.children;
                }
                machineryToggleCurrentLevelFolders(s, folders, expand);
            }
            else if (event.altKey) {
                var expand = !folder.isExpand;
                var folders = folder.children;
                folder.isExpand = expand;
                machineryToggleCurrentLevelFolders(s, folders, expand);
            }
            else {
                folder.isExpand = !folder.isExpand;
                localStorage.setItem("eagle.sidebar.folder.expand." + folder.id, folder.isExpand);
            }
            s.updateSidebarList();
        }).apply(null, args);
  };

  fns["toggleFolderVisible"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function () {
            s.isExpandFolder = !s.isExpandFolder;
            localStorage.setItem("eagle.sidebar.folder.expand", s.isExpandFolder);
            s.updateSidebarList();
        }).apply(null, args);
  };

  fns["toggleGifPlay"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function() {
            if (s.gifPlayer && s.isGifReady) {
                if (s.gifViewer.playing) {
                    s.gifPlayer.pause();
                    s.gifViewer.playing = false;
                    s.$evalAsync();
                }
                else {
                    s.gifPlayer.play();
                    s.gifViewer.playing = true;
                    s.$evalAsync();
                }
                $(".gif-viewer").css("opacity", 0.8);
                setTimeout(function () {
                    $(".gif-viewer").css("opacity", 1);
                }, 100);
            }
        }).apply(null, args);
  };

  fns["toggleGifPlayerMode"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function () {
            s.usingGifPlayer = !s.usingGifPlayer;
            analytics.event('GifViewer', 'Open');
        }).apply(null, args);
  };

  fns["togglePaletteProcessing"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function () {
            if (s.paletteQueuePaused) {
                s.resumePalette();
            }
            else {
                s.pausePalette();
            }
        }).apply(null, args);
  };

  fns["toggleQuickAccessVisible"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function () {
            s.isExpandQuickAccess = !s.isExpandQuickAccess;
            localStorage.setItem("eagle.sidebar.quickAccess.expand", s.isExpandQuickAccess);
            s.updateSidebarList();
        }).apply(null, args);
  };

  fns["toggleRatioContextMenu"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function($event) {
            $event.stopPropagation();
            if (s.imageSize.zoomRatio != 100) {
                s.zoomActual();
            } else {
                s.zoom();
            }
        }).apply(null, args);
  };

  fns["toggleSlideshow"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function () {
                if (!s.isSlideshowMode) {
                    s.enterSlideshowMode();
                } else {
                    s.leaveSlideshowMode();
                }
            }).apply(null, args);
  };

  fns["toggleSmartFolderExpand"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function(event, smartFolder) {

            event.stopPropagation();

            if (!smartFolder.children || smartFolder.children.length == 0) return;

            // 如果用户点击了 ⌘ + alt，展开/收起所有层级
            if (event.altKey && (event.metaKey || event.ctrlKey)) {
                var expand = !smartFolder.isExpand;
                machineryToggleAllSmartFoldersInner(s, s.smartFolders, expand);
            }
            // 如果用户点击 ⌘，展开/收起第一层
            else if (event.metaKey || event.ctrlKey) {
                var expand = !smartFolder.isExpand;
                var parent = s.smartFolderMappings[smartFolder.parent];
                var smartFolders = s.smartFolders;
                if (parent && parent.children) {
                    smartFolders = parent.children;
                }
                machineryToggleCurrentLevelSmartFoldersInner(s, smartFolders, expand);
            }
            else if (event.altKey) {
                var expand = !smartFolder.isExpand;
                var smartFolders = smartFolder.children;
                smartFolder.isExpand = expand;
                machineryToggleCurrentLevelSmartFoldersInner(s, smartFolders, expand);
            }
            else {
	            smartFolder.isExpand = !smartFolder.isExpand;
	            localStorage.setItem("eagle.sidebar.smartFolder.expand." + smartFolder.id, smartFolder.isExpand);
	        }

            s.updateSidebarList();

        }).apply(null, args);
  };

  fns["toggleSmartFolderVisible"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function () {
            s.isExpandSmartFolder = !s.isExpandSmartFolder;
            localStorage.setItem("eagle.sidebar.smartFolder.expand", s.isExpandSmartFolder);
            s.updateSidebarList();
        }).apply(null, args);
  };

  fns["toggleZoom"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function (event) {
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
        }).apply(null, args);
  };

  fns["undo"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function() {
            s.$root.undo();
            s.$root.closeAll();
        }).apply(null, args);
  };

  fns["unlockAppPasswordKeydown"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function (event) {
            event && event.stopPropagation();
            return false;
        }).apply(null, args);
  };

  fns["unlockAppPasswordKeyup"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function (event) {

            var keyCode = event.keyCode;
            var password = s.$root.preferences.privacy.password;
            var typingPassword = $("#app-lock-password-input").val();
            var currentPassword = window.atob(password);

            if (keyCode === 13) {

                $timeout(function () {
                    console.log(typingPassword);
                    if (
                        typingPassword === currentPassword || 
                        Registration && Registration.license && typingPassword && typingPassword === Registration.license.code
                    ) {
                        s.$root.isAppLocked = false;
                        $("#app-lock-password-input").val("");
                        $("#app-lock-password-input").off("blur"); // 移除 blur 事件監聽
                        s.$root.initMenu();
                    }
                    else {
                        $("#app-lock-password-input").addClass("animation--shake-horizontal constant");
                        setTimeout(function () {
                            $("#app-lock-password-input").removeClass("animation--shake-horizontal constant");
                        }, 350);
                    }
                }, 10);
            }
        }).apply(null, args);
  };

  fns["unlockPasswordKeyup"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function (event) {

            var keyCode = event.keyCode;
            var folder = s.currentFolder;
            var currentPassword = window.atob(folder.password);

            if (keyCode === 13) {
                console.log(s.unlockPassword);
                if (
                    s.unlockPassword === currentPassword ||
                    Registration && Registration.license && s.unlockPassword && s.unlockPassword === Registration.license.code
                ) {
                    s.currentFolder.isUnLock = true;
                    s.isLoading = true;
                    s.updateSidebarList();
                    s.calculateImageBinding({ ignoreSort: true }, function () {
                        s.reload();
                        s.updateSelection();
                        s.isLoading = false;
                        s.unlockPassword = "";
                    });
                }
                else {
                    $("#lock-password-input").addClass("animation--shake-horizontal constant");
                    setTimeout(function () {
                        $("#lock-password-input").removeClass("animation--shake-horizontal constant");
                    }, 350);
                }
            }
        }).apply(null, args);
  };

  fns["updateContainerHieght"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function (hasAnimation, __lv_delay = 1) {
            let duration = 170;
            if (!hasAnimation) duration = 1;
            setTimeout(() => {
                if (eagle.filter.isOpen) {
                    var $filterBar = $("#filter-toolbar");
                    var __lv_height = $filterBar.outerHeight();
                    $("#box-container").css({
                        "padding-bottom": __lv_height,
                        "height": `calc(100% - $${48 + __lv_height}px)`
                    });
                    $("#box-container-scrollbar").css({
                        "top": 48 + __lv_height,
                    });
                    $("#box-container").css({
                        "margin-top": __lv_height,
                    });
                }
                else {
                    $("#box-container").css({
                        "padding-bottom": 0,
                        "height": `calc(100% - 48px)`
                    });
                    $("#box-container-scrollbar").css({
                        "top": 48,
                    });
                    $("#box-container").css({
                        "margin-top": 0,
                    });
                }
            }, __lv_delay);
        }).apply(null, args);
  };

  fns["updateFilterCounts"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function (__lv_image, inc, __lv_now) {

            if (!__lv_image) return;

            try {

                var type = __lv_image.medium || __lv_image.ext;
                var shape;

                if (eagle.filter.filterCounts['type'][type] === undefined) {
                    eagle.filter.filterCounts['type'][type] = 1;
                }
                else {
                    eagle.filter.filterCounts['type'][type]+=inc;
                }

                if (__lv_image.rawMetas) {

                    var camera = __lv_image.rawMetas.camera;
                    if (eagle.filter.filterCounts['camera'][camera] === undefined) {
                        eagle.filter.filterCounts['camera'][camera] = 1;
                        if (!eagle.filter.filterCamerasMapping[camera]) {
                            eagle.filter.filterCamerasMapping[camera] = true;
                            eagle.filter.filterCameras = Object.keys(eagle.filter.filterCamerasMapping);
                        }
                    }
                    else {
                        eagle.filter.filterCounts['camera'][camera]+=inc;
                    }
                }

                if (__lv_image.fontMetas) {
                    try {
                        var key = Object.keys(__lv_image.fontMetas.postScriptName)[0];
                        var postScriptName = __lv_image.fontMetas.postScriptName && __lv_image.fontMetas.postScriptName[key];
                        if (installedFonts[`$${postScriptName}_.$${__lv_image.ext}`]) {
                            eagle.filter.filterCounts['fontActivated']['activated']+=inc;
                        }
                        else {
                            eagle.filter.filterCounts['fontActivated']['deactivated']+=inc;
                        }
                    }
                    catch (err) {

                    }
                }

                if (__lv_image.star) {
                    eagle.filter.filterCounts['rating'][__lv_image.star]+=inc;
                }
                else {
                    eagle.filter.filterCounts['rating']['0']+=inc;
                }

                // 形状筛选，只需要针对图片格式进行
                if (__lv_image.width && !AUDIO_TYPES[__lv_image.ext] && !FONT_TYPES[__lv_image.ext] ) {
                    if (__lv_image.width > __lv_image.height) {
                        if (__lv_image.width / __lv_image.height >= 2.5) {
                            shape = "panoramic-landscape";
                        }
                        else {
                            shape = "landscape";
                        }
                        eagle.filter.filterCounts['shape'][shape] += inc;
                    }
                    else if (__lv_image.width < __lv_image.height) {
                        if (__lv_image.height / __lv_image.width >= 2.5) {
                            shape = "panoramic-portrait";
                        }
                        else {
                            shape = "portrait";
                        }
                        eagle.filter.filterCounts['shape'][shape] += inc;
                    }
                    else if (__lv_image.width === __lv_image.height) {
                        shape = "square";
                        eagle.filter.filterCounts['shape'][shape] += inc;
                    }
                    if (__lv_image.width / __lv_image.height === 4 / 3) {
                        shape = "4:3";
                        eagle.filter.filterCounts['shape'][shape] += inc;
                    }
                    else if (__lv_image.width / __lv_image.height === 3 / 4) {
                        shape = "3:4";
                        eagle.filter.filterCounts['shape'][shape] += inc;
                    }
                    else if (__lv_image.width / __lv_image.height === 16 / 9) {
                        shape = "16:9";
                        eagle.filter.filterCounts['shape'][shape] += inc;
                    }
                    else if (__lv_image.width / __lv_image.height === 9 / 16) {
                        shape = "9:16";
                        eagle.filter.filterCounts['shape'][shape] += inc;
                    }
                }

        	}
        	catch (err) {
        	}
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
                            return `<div class="tag color-$${$bodyScope.TagManager.tagMappings[tag].color}">$${tag}</div>`;
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
                    $element.addClass(`bg-$${item.background}`);
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
                            metas = `$${fileSize(item.size, 1)}`;
                        }
                        else if (SPECIAL_TYPES[item.ext]) {
                            metas = `$${fileSize(item.size, 1)}`;
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
                            paragraphsHTML += `<h4>$${item.name.trim()}</h4>`;
                            paragraphs.forEach(function (paragraph) {
                                paragraphsHTML += `<p>$${paragraph.trim()}</p>`;
                            });
                            $("#box-" + item.id + " .txt-content div").html(paragraphsHTML);
                        }
                        break;
                    case 'FILESIZE':
                        metas = `$${fileSize(item.size, 1)}`;
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
                        metas = `<span class="small star">$${ratingStrings[item.star]}</span>`;
                        break;
                }
                $metas.html(metas);

                $propTags.html(tagsFormated);
                if (item.width) {
                    $propResolution.html(`$${item.width} x $${item.height}`);
                }
                else {
                    $propResolution.html(`-`);
                }
                $propRating.html(`<span class="small star">$${ratingStrings[item.star]}</span>`);
                $propSize.html(`$${fileSize(item.size, 1)}`);

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
                            $element.find("img").css("min-width", `$${item.height / item.width * 100}%`);
                        }
                        else {
                            $element.find("img").css("width", `$${item.height / item.width * 100}%`);
                        }
                    }
                }

                if (item.fontMetas && item.fontMetas.postScriptName) {
                    var key = Object.keys(item.fontMetas.postScriptName)[0];
                    var postScriptName = item.fontMetas.postScriptName && item.fontMetas.postScriptName[key];
                    var fontPath = `$${fontFolder}/$${sanitize(postScriptName)}.$${item.ext}`;
                    var activatedLabel = i18n.__("Context.Image.Font.Activate");
                    var deactivatedLabel = i18n.__("Context.Image.Font.Deactivate");
                    // 添加正在启用、正在停用状态
                    if (item.activating || item.deactivating) {
                        $element.addClass("activating");
                    }
                    else if (fs.existsSync(fontPath)) {
                        installedFonts[`$${postScriptName}_.$${item.ext}`] = true;
                        $element.removeClass("activating");
                        $element.addClass("activated");
                        $element.find(".activate-btn").attr("title", deactivatedLabel);
                    }
                    else {
                        installedFonts[`$${postScriptName}_.$${item.ext}`] = false;
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

  fns["updateSidebarList"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function () {
            $timeout.cancel(__lv_updateSidebarListTimeout);
            __lv_updateSidebarListTimeout = $timeout(function () {
                // console.time("s.updateSidebarList");
                var list = [];
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
                
                list.forEach(function (node, index) {
                    node.index = index;
                });

                s.sidebarList = list;
            }, 20);
        }).apply(null, args);
  };

  fns["updateZoomRatio"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function(ratio, __lv_x, __lv_y, hasTransition) {
            var pageX, pageY;

            if (ratio) {
                s.imageSize.zoomRatio = ratio;
                s.imageSize.zoomRatioExp = s.getRatioExp(s.imageSize.zoomRatio);
            }

            if ($.isNumeric(__lv_x) && $.isNumeric(__lv_y)) {
                pageX = __lv_x;
                pageY = __lv_y;
            } else {
                pageX = $(window).width() / 2;
                pageY = $(window).height() / 2;
            }

            if (hasTransition) {
                clearTimeout(__lv_updateZoomRatioTimeout);
                $("#detail-container").addClass("zooming");
                __lv_updateZoomRatioTimeout = setTimeout(function () {
                    $("#detail-container").removeClass("zooming");
                }, 300);
            }
            
            $("#detail-container").smoothZoom('focusTo', {
                zoom: s.imageSize.zoomRatioExp,
                pageX: pageX,
                pageY: pageY,
                speed: 0
            });
        }).apply(null, args);
  };

  fns["uploadFiles"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function($__lv_files, folder) {

            if ($__lv_files.length === 0) {
                s.hideUploadQueue();
                return;
            }

            console.log("s.uploadFiles");
            console.time("添加圖片耗費時間");

            var images = [];

            console.time("s.uploadFiles.初始化");
            let __lv_now = Date.now();
            for (let index = 0; index < $__lv_files.length; index++) {
                const __lv_file = $__lv_files[index];
                var fileName = __lv_file.name || __lv_path.basename(__lv_file.path);
                fileName = fileName.replace(__lv_path.extname(__lv_file.path), "").replace(/%/g, "").replace(emojiRegex, '');
                var __lv_image = {
                    id: __lv_file.id || guid(),
                    name: fileName,
                    __lv_path: __lv_file.path,
                    type: __lv_file.type,
                    size: __lv_file.size,
                    __lv_tags: __lv_file.tags || [],
                    url: __lv_file.url || "",
                    annotation: __lv_file.annotation || "",
                    lastModified: __lv_file.lastModified,
                    modificationTime: __lv_file.modificationTime || (__lv_now + index),
                    folders: __lv_file.folders || [],
                    star: __lv_file.star || undefined
                };

                if (__lv_file.cutMode) __lv_image.cutMode = true;
                if (__lv_file.merged) __lv_image.merged = true;

                images.push(__lv_image);

                if (folder) {
                    __lv_image.folders.push(folder.id);
                    __lv_image.folders = [...new Set(__lv_image.folders)];
                    if (__lv_image.tags && folder.extendTags) {
                        folder.extendTags.forEach(function (tag) {
                            __lv_image.tags.push(tag);
                        });
                        __lv_image.tags = [...new Set(__lv_image.tags)];
                    }
                    else {
                        __lv_image.tags = folder.extendTags || __lv_image.tags || [];
                    }
                }

                s.uploadQueue.push(__lv_image);
            }
            console.timeEnd("s.uploadFiles.初始化");
            console.time("s.uploadFiles.ipcRenderer.send");
            (window as any).IPCHelper.send('upload-local-files', {
                __lv_files: images.reverse()
            });

            console.timeEnd("s.uploadFiles.ipcRenderer.send");
            $("#upload-queue-progress").find(".message .percentage").html(s.finishQueue.length + "/" + s.uploadQueue.length);
            $("#upload-queue-progress").find(".current").width(s.finishQueue.length/s.uploadQueue.length*100 + "%");
        }).apply(null, args);
  };

  fns["uploadUrls"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function(urls, __lv_fds, params) {
            var folders = [];
            let extendTags = [];

            if (__lv_fds && __lv_fds.length > 0) {
                folders = __lv_fds.map(function (fd) {
                    return s.folderMappings[fd];
                });
            }

            folders.forEach((folder) => {
                if (folder?.extendTags) {
                    folder.extendTags.forEach((tag) => {
                        extendTags.push(tag);
                    });
                }
            });

            extendTags = [...new Set(extendTags)];

            var __lv_files = urls.map(function(url, index) {
                
				let fileName = params && params.names && params.names[index] || "";
                let newTags = params?.tags;
                let __lv_tags = [];
                if (newTags && newTags.length > 0) {
                    __lv_tags = [...extendTags, ...newTags];
                }
                else if (extendTags.length > 0){
                    __lv_tags = [...extendTags];
                }

                __lv_tags = [...new Set(__lv_tags)];
                console.log(`before: $${fileName.length}`)
                fileName = fileName.substr(0, remainingFilenameLength(s.libraryPath));
                console.log(`after: $${fileName.length}`)

				fileName = sanitize(fileName).replace(/%/g, "").replace(/&lt;/g,"").replace(/&gt;/g,"").trim();
                return {
                    id: params?.ids && params?.ids[index] || undefined,
                    url: url,
                    folders: __lv_fds || [],
                    __lv_tags: __lv_tags,
                    type: params && params.types && params.types[index] || undefined,
                    name: fileName || undefined,
                    annotation: (params && params.annotations && params.annotations[index]) || "",
                    star: (params && params.stars && params.stars[index]) || undefined,
                    website: params && params.urls && params.urls[index] || "",
                    headers: params && params.headers && params.headers[index] || undefined,
                    modificationTime: (params && params.modificationTimes && params.modificationTimes[index]) || Date.now() + index
                }
            });
            if (__lv_files.length > 0) {
                s.showUploadQueue();
            }
            ipcRenderer.send('upload-urls', __lv_files);
        }).apply(null, args);
  };

  fns["zoom"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function () {
            if (!s.isDetailMode) return;
            if (s.lastZoomMode === "edge") {
                if (s.current && !s.VIDEO_TYPES[s.current.ext]) {
                    s.zoomFitEdge();
                }
                else {
                    s.zoomFit();
                }
            }
            else {
                s.smartZoom();
            }
        }).apply(null, args);
  };

  fns["zoomActual"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function(event) {
            event && event.preventDefault && event.preventDefault();
            if (!s.isDetailMode) {
                s.imageSize.height = 150;
                s.changeListHeight();
                if (s.layout === "GridLayout" || s.layout === "SquareLayout") { 
                    s.adjustLayoutWidth(0);
                    __lv_saveListHeight(s.imageSize.height);
                }
            } else {
                s.imageSize.zoomRatio = 100;
                s.imageSize.zoomRatioExp = s.getRatioExp(s.imageSize.zoomRatio);
                s.updateZoomRatio(100, undefined, undefined, true);

                // 如果是視頻格式，尽可能使用视频原来尺寸
                var mpvPlayer = $(".detail-wrap mpv-video")[0];
                if (mpvPlayer) {
                    mpvPlayer.scaleMode = 'original';
                }
                else {
                    var $__lv_video = $(".detail-wrap video");
                    if ($__lv_video.length > 0) {
                        var w = $__lv_video[0].videoWidth;
                        var h = $__lv_video[0].videoHeight;
                        $__lv_video.css({
                            'max-width': `$${w}px !important`,
                            'max-height': `$${h}px !important`,
                        });
                        $__lv_video.addClass("fit");
                    }
                }
            }
        }).apply(null, args);
  };

  fns["zoomFit"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function(event, noAnimation) {
            event && event.preventDefault && event.preventDefault();
            if (!s.isDetailMode) {
                s.imageSize.height = 150;
                s.changeListHeight();
                if (s.layout === "GridLayout" || s.layout === "SquareLayout") { 
                    s.adjustLayoutWidth(0);
                    __lv_saveListHeight(s.imageSize.height);
                }
            } else {
                if (s.VIDEO_TYPES[s.current.ext]) {
                    // 如果是視頻格式，撐滿畫面
                    var mpvPlayer = $(".detail-wrap mpv-video")[0];
                    if (mpvPlayer) {
                        mpvPlayer.scaleMode = 'fit';
                    }
                    else {
                        var $__lv_video = $(".detail-wrap video");
                        if ($__lv_video.length > 0) {
                            $__lv_video.removeClass("fit");
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
                    $("#detail-container").addClass("zooming");
                    setTimeout(function () {
                        $("#detail-container").removeClass("zooming");
                    }, 300);
                }

                s.smartZoom(undefined, true);
            }
        }).apply(null, args);
  };

  fns["zoomFitEdge"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function(event, hasTransition) {
            event && event.preventDefault && event.preventDefault();

            if (hasTransition) {
                $("#detail-container").addClass("zooming");
                setTimeout(function () {
                    $("#detail-container").removeClass("zooming");
                }, 300);
            }

            var current = s.current;
            var ratio = s.imageSize.zoomRatio || 100;
            var lastRatio = ratio;
            var $container = $(".content-panel");
            var toolbarHeight = 40;
            var containerWidth;
            var containerHeight;
            var __lv_offsetY = 0;
            
            if (s.isSlideshowMode) {
                toolbarHeight = 0;
                containerWidth = $(window).width();
                containerHeight = $(window).height() - toolbarHeight;
            }
            else if (s.isInlineMode) {
                toolbarHeight = 96;
                containerWidth = $(window).width();
                containerHeight = $container.height() - toolbarHeight;
            }
            else {
                toolbarHeight = 48;
                containerWidth = $container.width();
                containerHeight = $container.height() - toolbarHeight;
            }

            var a = parseInt((containerHeight) / current.height * 100);
            var b = parseInt((containerWidth) / current.width * 100);
            ratio = Math.min(a, b);
            __lv_offsetY = toolbarHeight/2 * 100 / ratio;
            
            if (!current) return;

            $("#detail-image").css({
                "transform": `rotate(0deg)`,
                "transition": "none"
            });

            var $detailContainer = $("#detail-container");
            var __lv_width = $detailContainer.width();
            var __lv_height = current && current.height || $detailContainer.height();

            __lv_offsetY = __lv_offsetY || 0;

            if (ratio) {
                s.imageSize.zoomRatio = s.getRatioNonExp(ratio);
                s.imageSize.zoomRatioExp = ratio;
                s.zoomFitSize = ratio;
            }
            s.showLargeImage = true;
            $detailContainer.smoothZoom('focusTo', {
                __lv_x: __lv_width / 2,
                __lv_y: __lv_height / 2 + __lv_offsetY,
                zoom: parseInt(ratio),
                speed: 0
            });
        }).apply(null, args);
  };

  fns["zoomIn"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function(event) {
            event && event.preventDefault && event.preventDefault();
            if (!s.isDetailMode) {
                s.adjustLayoutWidth(-1);
                __lv_saveListHeight(s.imageSize.height);
            } else {
                var ratio = Math.ceil(s.imageSize.zoomRatio / 5) * 5;
                var ratioExp = s.getRatioExp(ratio);
                if (ratioExp >= 400) { ratioExp = 800; } else if (ratioExp >= 200) { ratioExp = 400; } else if (ratioExp >= 100) { ratioExp = 200; } else if (ratioExp >= 50) { ratioExp = 100; } else if (ratioExp >= 25) { ratioExp = 50; } else if (ratioExp >= 10) { ratioExp = 25; } else if (ratioExp >= 5) { ratioExp = 10; } else { ratioExp = 5; }
                if (ratioExp > 800) ratioExp = 800;
                s.imageSize.zoomRatio = s.getRatioNonExp(ratioExp);
                s.imageSize.zoomRatioExp = s.getRatioExp(s.imageSize.zoomRatio);
                s.updateZoomRatio(undefined, undefined, undefined, true);
            }
        }).apply(null, args);
  };

  fns["zoomOut"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function(event) {
            event && event.preventDefault && event.preventDefault();
            if (!s.isDetailMode) {
                s.adjustLayoutWidth(1);
                __lv_saveListHeight(s.imageSize.height);
                s.checkListItemsLessThanContainer();
            } else {
                var ratio = Math.floor(s.imageSize.zoomRatio / 5) * 5;
                var ratioExp = s.getRatioExp(ratio);
                if (ratioExp <= 10) { ratioExp = 5; } else if (ratioExp <= 25) { ratioExp = 10; } else if (ratioExp <= 50) { ratioExp = 25; } else if (ratioExp <= 100) { ratioExp = 50; } else if (ratioExp <= 200) { ratioExp = 100; } else if (ratioExp <= 400) { ratioExp = 200; } else if (ratioExp <= 800) { ratioExp = 400; }
                s.imageSize.zoomRatio = s.getRatioNonExp(ratioExp);
                s.imageSize.zoomRatioExp = s.getRatioExp(s.imageSize.zoomRatio);
                s.updateZoomRatio(undefined, undefined, undefined, true);
            }
        }).apply(null, args);
  };

  return fns;
}

export function updateCurrentOrderAndIncrease () {
        	var orderBy;
            var sortIncrease;
            if (getBodyScope().currentFolder) {
                orderBy = getBodyScope().currentFolder.orderBy;
                if (getBodyScope().currentFolder.orderBy) {
                    sortIncrease = getBodyScope().currentFolder.sortIncrease;
                }
                else {
                    sortIncrease = getBodyScope().sortIncrease;
                }
            }
            else if (getBodyScope().currentSmartFolder) {
                if (getBodyScope().currentSmartFolder.orderBy) {
                    sortIncrease = getBodyScope().currentSmartFolder.sortIncrease;
                }
                else {
                    sortIncrease = getBodyScope().sortIncrease;
                }
                orderBy = getBodyScope().currentSmartFolder.orderBy;
            }
            else {
                orderBy = getBodyScope().orderBy;
                sortIncrease = getBodyScope().sortIncrease;
            }
            getBodyScope().currentOrderBy = orderBy;
            getBodyScope().currentSortIncrease = sortIncrease;
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

export function parseKeywordsWithOR(keywordStr) {
            // 先處理括號表達式
            function parseWithParentheses(str) {
                // 標記化：將字串分解成 tokens
                function tokenize(input) {
                    let tokens = [];
                    let current = '';
                    let inQuotes = false;
                    let quoteChar = '';
                    
                    for (let i = 0; i < input.length; i++) {
                        let char = input[i];
                        let nextChar = input[i + 1];
                        
                        if (!inQuotes && (char === '"' || char === "'")) {
                            inQuotes = true;
                            quoteChar = char;
                            current += char;
                        } else if (inQuotes && char === quoteChar) {
                            inQuotes = false;
                            current += char;
                            tokens.push(current);
                            current = '';
                        } else if (!inQuotes) {
                            if (char === '(' || char === ')') {
                                if (current.trim()) {
                                    tokens.push(current.trim());
                                    current = '';
                                }
                                tokens.push(char);
                            } else if (char === '|' && nextChar === '|') {
                                if (current.trim()) {
                                    tokens.push(current.trim());
                                    current = '';
                                }
                                tokens.push('OR');
                                i++; // 跳過第二個 |
                            } else if (char === ' ') {
                                if (current.trim()) {
                                    // 檢查是否是 OR 或 or
                                    if (current.toUpperCase() === 'OR') {
                                        tokens.push('OR');
                                    } else {
                                        tokens.push(current.trim());
                                    }
                                    current = '';
                                }
                            } else {
                                current += char;
                            }
                        } else {
                            current += char;
                        }
                    }
                    
                    if (current.trim()) {
                        if (current.toUpperCase() === 'OR') {
                            tokens.push('OR');
                        } else {
                            tokens.push(current.trim());
                        }
                    }
                    
                    return tokens;
                }
                
                // 解析 tokens 成表達式樹
                function parseExpression(tokens) {
                    let index = 0;
                    
                    function parseOr() {
                        let left = parseAnd();
                        
                        while (index < tokens.length && tokens[index] === 'OR') {
                            index++; // 消耗 OR
                            let right = parseAnd();
                            left = { type: 'OR', children: [left, right] };
                        }
                        
                        return left;
                    }
                    
                    function parseAnd() {
                        let terms = [];
                        
                        while (index < tokens.length && tokens[index] !== 'OR' && tokens[index] !== ')') {
                            if (tokens[index] === '(') {
                                index++; // 消耗 (
                                let expr = parseOr();
                                if (index < tokens.length && tokens[index] === ')') {
                                    index++; // 消耗 )
                                }
                                terms.push(expr);
                            } else {
                                terms.push({ type: 'TERM', value: tokens[index] });
                                index++;
                            }
                        }
                        
                        if (terms.length === 0) return null;
                        if (terms.length === 1) return terms[0];
                        return { type: 'AND', children: terms };
                    }
                    
                    return parseOr();
                }
                
                let tokens = tokenize(str);
                return parseExpression(tokens);
            }
            
            // 將表達式樹轉換為扁平化的關鍵字陣列
            function flattenExpression(expr) {
                if (!expr) return [];
                
                if (expr.type === 'TERM') {
                    return [expr.value];
                } else if (expr.type === 'OR') {
                    // 收集所有 OR 的子項
                    let orTerms = [];
                    function collectOrTerms(node) {
                        if (node.type === 'OR') {
                            node.children.forEach(collectOrTerms);
                        } else if (node.type === 'TERM') {
                            orTerms.push(node.value);
                        } else if (node.type === 'AND') {
                            // OR 中包含 AND，整個 AND 群組作為一個單位
                            // 例如: dog || (cat black) 中的 (cat black)
                            let andTerms = [];
                            node.children.forEach(child => {
                                if (child.type === 'TERM') {
                                    andTerms.push(child.value);
                                }
                            });
                            orTerms.push(andTerms.join(' ')); // 合併成一個字串
                        }
                    }
                    collectOrTerms(expr);
                    return [orTerms];
                } else if (expr.type === 'AND') {
                    let __lv_result = [];
                    expr.children.forEach(child => {
                        let flattened = flattenExpression(child);
                        __lv_result = __lv_result.concat(flattened);
                    });
                    return __lv_result;
                }
                
                return [];
            }
            
            // 使用新的解析器
            let expr = parseWithParentheses(keywordStr);
            let keywords = flattenExpression(expr);
            
            return keywords;
        }

export function updateSuggestions() {
            console.time("updateSuggestions");
            getBodyScope().searchIndex = -1;

            var keyword = "";
            if (getBodyScope().keyword) {
                keyword = getBodyScope().keyword.toLowerCase();
            }

            getBodyScope().hsks = getBodyScope().historySearchKeywords.filter(function (word) {
                if (!keyword || keyword == "") return true;
                if (word) {
                    return fuzzy_match(word, keyword).length > 0;
                }
                return false;
            }).slice(0,8);

            var suggestions = [];
            var wordsIndex = {};
            var dataset = [];
            var currPageTags = [];
            var allCount = $bodyScope.all.length;
            getBodyScope().containTags.forEach(function (tag) {
            	if (tag.imageCount && !tag.isNoTags) {
	            	currPageTags.push({
	            		word: tag.name.toLowerCase(),
	            		weight: tag.imageCount,
	            	})
            	}
            });

            if (!keyword) {
                // 推薦關鍵字，暫時移除，感覺多餘了
            	// suggestions = currPageTags;
            	// suggestions.forEach(function (suggestion) {
	        	// 	wordsIndex[suggestion.word] = suggestion.weight;
	        	// });

	        	// // 去重复
	            // var duplicatesMap = {};
	            // suggestions = suggestions.filter(function (suggestion) {
	            // 	if (!duplicatesMap[suggestion.word]) {
	            // 		duplicatesMap[suggestion.word] = true;
	            // 		return true;
	            // 	}
	            // 	return false;
	            // });

            	// suggestions = suggestions.sort(function(a, b) {
	            //     if(a.weight > b.weight) return -1;
	            //     if(a.weight < b.weight) return 1;
	            //     return 0;
	            // });

	            // if (suggestions.length > 5) {
	            //     suggestions.length = 5;
	            // }
            	getBodyScope().keywordSuggestions = suggestions;
                getBodyScope().keywordSuggestions = getBodyScope().keywordSuggestions.filter((suggestion) => {
                    return getBodyScope().hsks.indexOf(suggestion.word) === -1 && suggestion.word;
                });
            	console.timeEnd("updateSuggestions");
            	return;
            }

            if (getBodyScope().globalKeywords && getBodyScope().globalKeywords.length) {
            	dataset = currPageTags.concat(getBodyScope().globalKeywords);
            }

            getBodyScope().keyword_cn = chineseConvert.tw2cn(keyword);
            getBodyScope().keyword_tw = chineseConvert.cn2tw(keyword);
            getBodyScope().isKeywordTW = keyword === getBodyScope().keyword_tw;
            getBodyScope().isKeywordCN = keyword === getBodyScope().keyword_cn;
            getBodyScope().isEnglish = getBodyScope().isKeywordTW === getBodyScope().isKeywordCN;

            if (keyword.length === 1 && getBodyScope().isContainAlphabet) {
                suggestions = dataset.filter(function(suggestion) {
                    return keyword.toLowerCase() === suggestion.word[0].toLowerCase();
                });
            }
            else {
                suggestions = dataset.filter(function(suggestion) {
                    var __lv_idx = suggestion.word.toLowerCase().indexOf(keyword);
                    if (getBodyScope().isEnglish) {
                        return (__lv_idx > -1);
                    }
                    else if (getBodyScope().isKeywordTW) {
                        return (__lv_idx > -1) && (suggestion.word != keyword) ||
                        (suggestion.word.indexOf(getBodyScope().keyword_cn) > -1)
                    }
                    else if (getBodyScope().isKeywordCN) {
                        return (__lv_idx > -1) && (suggestion.word != keyword) ||
                        (suggestion.word.indexOf(getBodyScope().keyword_tw) > -1)
                    }
                });
            }

            suggestions.forEach(function (suggestion) {
        		wordsIndex[suggestion.word] = suggestion.weight;
        	});

            suggestions = suggestions.sort(function(a, b) {
                if(a.weight > b.weight) return -1;
                if(a.weight < b.weight) return 1;
                return 0;
            });

            // 去重复
            var duplicatesMap = {};
            suggestions = suggestions.filter(function (suggestion) {
            	if (!duplicatesMap[suggestion.word]) {
            		duplicatesMap[suggestion.word] = true;
            		return true;
            	}
            	return false;
            });

            if (suggestions.length > 5) {
                suggestions.length = 5;
            }
            
            if (suggestions.length > 0) {
                if (suggestions.length === 1 && suggestions[0].word == getBodyScope().keyword) {

                }
                else {
                    // getBodyScope().showSuggestions = true;
                }
            }
            else {
                getBodyScope().showSuggestions = false;
            }

            getBodyScope().keywordSuggestions = suggestions;
            console.timeEnd("updateSuggestions");
        }
