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
  machineryToggleCurrentLevelSmartFoldersInner, machineryFilterSidebarItem, getFilter as machineryGetFilter } from './dataMachinery';

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
const NOT_SUPPORT_CUSTEOM_THUMBNAIL_TYPES: any = { tif: true, jpg: true, png: true, bmp: true, webp: true };
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
// b1-9w：菜单点击路径补端口的全局消费（clipboard 由 copyAs* 族 / eagleClasses.copyTags 消费；
// _ 为 lodash——copyTags 的 _.throttle / renameFontsWithFullName 的 _.get / openFilesWithDefault
// 的 _.debounce 消费；showFinderAlert 为 bundle 19064-19068 顶层 var，localStorage 初始化）
const clipboard: any = _req('electron')?.clipboard || (window as any).clipboard;
const _: any = (window as any)._;
let __lv_showFinderAlert: any = localStorage.getItem("eagle.hint.showInFinder") !== 'false';
const i18n: any = (window as any).i18n;
let preferences: any = (window as any).electronSettings?.getPreferences?.() || {};
const FixUtils: any = {};
const dialog: any = _req('@electron/remote')?.dialog;
const systemPreferences: any = _req('@electron/remote')?.systemPreferences;
// b1-9ak：Menu/MenuItem 供给——bundle 顶层 const（openApplicationContextMenu/ShareMenu
// 等菜单路径消费；此前 bare Menu ReferenceError，menu-popup 闭环测试揪出）
const remote: any = _req('@electron/remote');
const Menu: any = remote?.Menu;
const MenuItem: any = remote?.MenuItem;
// Angular 注入服务 shim（$timeout 语义 = 延时执行 + digest）
const $timeout: any = (fn: any, ms?: number) => setTimeout(() => {
  try { if (typeof fn === 'function') fn(); } finally { try { getBodyScope().$apply(); } catch (err) { /* noop */ } }
}, ms || 0);
// b1-9 收口：`$timeout.cancel(promise)` 是 Angular 注入服务的第二形态，被 60+ 处移植代码
// 消费（__lv_searchTimeout / __lv_nextTimeout / __lv_calculateImageBindingTimeout …）。
// shim 世界此前只提供调用形态 → `$timeout.cancel is not a function` 在 select 等高频
// 函数首行即抛。语义取「取消延时执行」（不涉 Angular 的 promise/$apply 未决异常）。
$timeout.cancel = function (timer: any): boolean {
  if (timer === null || timer === undefined) return false;
  try { clearTimeout(timer); } catch (err) { /* noop */ }
  return true;
};
const $filter: any = (name: string) => {
  const s: any = getBodyScope();
  if (s && s.$root && s.$root.$filter) return s.$root.$filter(name);
  // shim 世界无 $rootScope.$filter：退到 machinery 的 getFilter()（Angular 在世走 injector，
  // 缺席时为 EagleApp.filter 逐字移植的等价表），否则 `$filter('i18n')(…)` 首行即抛。
  const inst: any = machineryGetFilter();
  return inst ? inst(name) : undefined;
};


// ── b1-9q：openItemContextMenu 依赖的 link 级函数与模块常量 ──────────────────

// URL_MODULE（bundle 顶层 const；fileUrlHelper.ts 同款惰性解析）
const URL_MODULE: any = (() => {
  const req = (window as any).require;
  if (typeof req !== 'function') return (window as any).URL_MODULE;
  const appRoot = (window as any).appRoot;
  const rootPath = appRoot && (appRoot.path || appRoot);
  if (rootPath) { try { return req(`${rootPath}/my_modules/url`); } catch (err) {} }
  try { return req('url'); } catch (err) { return (window as any).URL_MODULE; }
})();

// ContextMenu（bundle 15836-15843 逐字；angular.element("html").scope() → getBodyScope()——
// 根 scope 广播，React ContextMenuPanel 经 $on('CONTEXTMENU.OPEN') 消费）
const ContextMenu: any = {
  open(options: any) {
    const root: any = getBodyScope();
    root && root.$broadcast && root.$broadcast('CONTEXTMENU.OPEN', options);
  },
  close() {
    const root: any = getBodyScope();
    root && root.$broadcast && root.$broadcast('CONTEXTMENU.CLOSE');
  },
};

// renameImages（bundle 41480-41495 逐字；$scope→getBodyScope()。bare event 为 bundle
// window.event 怪癖逐字保留——Chromium 下 bare 标识符经全局回退读到 window.event）
function renameImages() {
  const s: any = getBodyScope();
  if (!s) return;
  if (s.selected.length > 1) {
    s.$root.$broadcast('OPEN_RENAME', {
      type: 'IMAGE',
      images: s.selected,
    });
  }
  else {
    var imageId = s.selected[0].id;
    var $box = $(`#box-${imageId}`);
    if ($box.length > 0) {
      setTimeout(() => {
        enableImageNameEditable(event, $box.find('.name'));
      }, 50);
    }
  }
}

// enableImageNameEditable（bundle 21975-22062 逐字；$scope→getBodyScope()——原码
// blur 回调内 angular.element("body").scope() 的 shim 等价；debounce 经 window.debounce
// 全局回退；exitEditable 为原码内嵌函数逐字保留）
function enableImageNameEditable(event: any, $name: any) {
  if (!$name) return;
  if ($name.hasClass('editable')) return;
  var originalName = $name.text().trim();
  $name.attr('contenteditable', 'true');
  $name.addClass('editable');
  $name.focus();
  setTimeout(function () {
    $name.focus();
    $name.select();
    document.execCommand('selectAll', false, null);
  }, 50);

  $name.off('mousedown').on('mousedown', function (event: any) {
    event.stopPropagation();
  });

  $name.off('keydown').on('keydown', function (event: any) {
    var keyCode = event.keyCode;
    switch (keyCode) {
      case 13:
        event.preventDefault();
        event.stopPropagation();
        $name.trigger('blur');
        break;
      case 27:
        event.preventDefault();
        event.stopPropagation();
        $name.html(`<span>${originalName}</span>`);
        exitEditable();
        break;
      case 65:
        if (event.metaKey || event.ctrlKey) {
          event.preventDefault();
          event.stopPropagation();
          document.execCommand('selectAll', false, null);
        }
        break;
    }
  });

  $name.off('paste').on('paste', function (e: any) {
    e.preventDefault();
    var text = (e.originalEvent || e).clipboardData.getData('text/plain');
    document.execCommand('insertHTML', false, text);
  });

  $name.off('blur').on('blur', debounce(function () {
    exitEditable();
    var $scope = getBodyScope();
    var newName = $name.text();
    if (!newName || !newName.trim()) {
      $name.html(`<span>${originalName}</span>`);
      return;
    }
    if (newName !== originalName && $scope && $scope.selected[0]) {
      var name = newName;
      var image = $scope.selected[0];
      name = name.substr(0, remainingFilenameLength($scope.libraryPath));
      name = sanitize(name).replace(/%/g, '').replace(/&lt;/g, '').replace(/&gt;/g, '').trim();
      name = _.unescape(name);
      eagle.inspector.newName = name;

      if (emojiRegex.test(name)) {
        name = name.replace(emojiRegex, '');
        eagle.inspector.newName = name;
      }

      if (name) {
        image.oldName = originalName;
        image.name = name;
        image.newName = name;
      }
      $name.html(`<span>${name}</span>`);
      console.log(`${originalName} > ${name}`);
      ayncsImagesChange([image]);
      hiddenByCurrentFilter([image]);
      $scope.$evalAsync();
      try { electronLog && electronLog.info(`[app] Change list item's name: ${originalName}(${image.id}) > ${newName}`); } catch (err) {}
    }
  }, 200, true));

  function exitEditable() {
    $name.attr('contenteditable', 'false');
    $name.removeClass('editable');
    $name.off('blur').off('keydown').off('paste').off('mousedown');
    $name.blur();
  }
}


// b1-9ap 模块级辅助（controller 闭包等价物；makeControllerFns 工厂外共享）
// eagle.utils.tree.walk 安全封装（w.eagle.utils.tree.walk 缺席时等价平铺递归，不丢展开态）
function treeWalkSafe(nodes: any, childKey: string, fn: (node: any, parent: any, depth?: any) => void) {
  const w = window as any;
  const walk = w.eagle && w.eagle.utils && w.eagle.utils.tree && w.eagle.utils.tree.walk;
  if (walk) {
    walk(nodes, childKey, fn);
    return;
  }
  const walkAll = (nodesInner: any, parent: any, depth: number) => {
    (nodesInner || []).forEach(function (n: any) {
      fn(n, parent, depth);
      walkAll(n[childKey], n, depth + 1);
    });
  };
  walkAll(nodes, null, 0);
}

function wElectronLogInfo(msg: string) {
  const w = window as any;
  w.electronLog && w.electronLog.info(msg);
}

// 原 $("#folder-input-" + id).focus().select()（React Sidebar 沿用同 DOM id 约定）
function wQueryFocusFolderInput(folderId: any) {
  const el = document.getElementById('folder-input-' + folderId);
  if (el) {
    (el as HTMLElement).focus();
    (el as HTMLElement).select && (el as HTMLElement).select();
  }
}

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
  var __lv_TagManager;
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

  /* b1-9 收口修复：原 initLinkVars 赋值的是**无前缀**裸名（pinyinCache / updateListHeight /
     saveListHeight / setLastFolder …），而机械改名后的函数体读的是 __lv_ 前缀名 —— ESM 严格模式
     下「未声明标识符赋值」直接 ReferenceError，被各 fn 首行 try/catch 吞掉，于是 initLinkVars
     恒为空操作，真正被读的 6 个 link 变量（path / TagManager / pinyinCache / updateListHeight /
     setLastFolder / saveListHeight）始终 undefined（uploadFiles 的 __lv_path.extname 即此爆点）。
     原 172-224 行裸名赋值（start / image / video / … / idx）引用的标识符（countOfSend / items /
     $bodyScope / $image / HoverPreview / commentScope / event / node / currentTagGroup …）在本模块
     并不存在；且这些名对应的 __lv_ 变量要么在函数内有局部绑定、要么是超时句柄（就地赋值，
     undefined 语义无害），故整体删除。 */
  let linkVarsInited = false;
  const initLinkVars = () => {
    // TagManager 挂载（bundle 48351 `$scope.TagManager = TagManager`）可能晚于首次 initLinkVars
    const s0: any = getBodyScope();
    if (s0 && s0.TagManager) __lv_TagManager = s0.TagManager;
    if (linkVarsInited) return;
    linkVarsInited = true;
    // 初始化（原 link 期赋值，$scope 引用改为 getBodyScope()）
    try {
      // path（bundle 顶层 var path = require('path')；shim 世界经 window.require）
      __lv_path = _req('path');
      __lv_pinyinCache = {};

      var updateListHeightTimeout: any;
      __lv_updateListHeight = function (height: any) {
            clearTimeout(updateListHeightTimeout);
            updateListHeightTimeout = setTimeout(function () {
                $("#box-container").attr("box-size", height);
            }, 50);
        }

        var saveListHeightTimeout: any;
      __lv_saveListHeight = function (height: any) {
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

      __lv_setLastFolder = _.debounce(function setLastFolder (folderId: any) {
            if (!folderId) {
                localStorage.removeItem(`eagle.lastFolder.${getBodyScope().rootDir}`);
            }
            else {
            	getBodyScope().setViewMode("all");
                localStorage.setItem(`eagle.lastFolder.${getBodyScope().rootDir}`, folderId);
            }
        }, 500);
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
            var outPath = `${fontFolder}/${postScriptName}.${font.ext}`;
            if (process.platform === 'darwin') {
                if (!fs.existsSync(outPath)) {
                    fse.copySync(rawPath, outPath);
                    installedFonts[`${postScriptName}_.${font.ext}`] = true;
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

            ipcRenderer.send('electron-info', `[app] Install font: ${rawPath}`);
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

  /* addImagesToFolder（bundle 43132-43198 逐字；b1-9d 供给缺口补齐——155 fns 抽取时漏项，
     m1 `scope.addImagesToFolder is not a function` 即此。两处适配：angular.copy → 数组切片
     （shim 世界无 angular；folders/tags 皆字符串数组，非数组原样保留同 angular.copy 语义），
     angular.element(document.body).injector().get('$filter') → 本模块 $filter shim。） */
  fns["addImagesToFolder"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function (images, folder) {

            var origin = [];
            var originFolders = [];
            var originTags = [];

            // 同一個資料夾，不需要移動
            if (images.length === 1 && images[0].folders.indexOf(folder.id) !== -1) {
                return;
            }

            // 移除當前文件夾，放到新的文件夾
            images.forEach(function(image) {

                origin.push(image);
                originFolders.push(Array.isArray(image.folders) ? image.folders.slice() : image.folders);
                originTags.push(Array.isArray(image.tags) ? image.tags.slice() : image.tags);

                if (!image.folders) image.folders = [];
                if (!image.tags) image.tags = [];
                if (image.folders.indexOf(folder.id) === -1) {
                    image.folders.push(folder.id);
                    if (folder.extendTags) {
                        folder.extendTags.forEach(function(tag) {
                            if (image.tags.indexOf(tag) === -1) {
                                image.tags.push(tag);
                            }
                        });
                    }
                }
                image.isDeleted = false;

            });
            ayncsImagesChange(images);
            hiddenByCurrentFilter(images);
            s.calculateImageBinding({ ignoreSort: true }, function () {
                s.rebindRefresh(true);
                s.updateSelection();
            });

            var message = $filter('i18n')("notify.image.moveToFolder", [
                { "property": "imageCount", "value": images.length },
                { "property": "folderName", "value": folder.name }
            ]);
            if (images.length === 1) { message = message.replace("images", "image"); }

            s.notify({
                message: message,
                duration: 4000,
            }, function () {
                origin.forEach(function (image, index) {
                    image.folders = originFolders[index];
                    image.tags = originTags[index];
                });
                s.images = origin;
                s.current = origin[0];
                s.calculateImageBinding({ ignoreSort: true }, function () {
                    s.rebindRefresh();
                    s.updateSelection();
                });
                ayncsImagesChange(origin);
            });

            electronLog && electronLog.info(`[app] Categorize ${images.length} files to ${folder.name}(${folder.id})`);
            analytics.event('File', 'Categorize', 'Context');
        }).apply(null, args);
  };

  // ── b1-9k：四個「小函数」补端口（b1-9g 台账根因 4a/4b/4e；bundle 逐字 + $scope→s 适配）──

  /* cancelEmptyTrash（bundle 33602-33608 逐字；EmptyTrashProgress 取消按钮守卫式调用
     s.cancelEmptyTrash——缺席时 isCleaningTrash 恒 true、对话框永不关。backgroundWindowID
     为 bundle link var（window live binding）；shim 世界无背景窗，IPCHelper.sendTo 内部
     try/catch 兜住 undefined id，与 ayncsImagesChange 的 undefined 判定同型） */
  fns["cancelEmptyTrash"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function () {
            s.isCleaningTrash = false;
            s.trashRemoved = 0;
            s.currentTrashRemoved = 0;
            IPCHelper.send('palette-resume');
            IPCHelper.sendTo((window as any).backgroundWindowID, 'cancel-empty-trash');
    }).apply(null, args);
  };

  /* emptyTrash（bundle 37013-37094 逐字；trash 右键菜单「清空回收站」唯一激活路径——
     isCleaningTrash=true 由此置位驱动 EmptyTrashProgress；物理删除经 ayncsImagesRemove
     分批发 empty-trash → main b1-9ar 逐 id 落 backend） */
  fns["emptyTrash"] = function (...args) {
    const s = getScope();
    if (!s) return;
    return (function () {
            if (s.trash && s.trash.length > 0) {
                swal({
                    html: `
                        <div class="alert">
                            <div class="alert-icon warning"></div>
                            <h4 class="alert-title">${i18n.__('dialog.emptyTrash.title')}</h4>
                            <p class="alert-desc">${i18n.__("dialog.emptyTrash.desc")}</p>
                        </div>
                    `,
                    showCloseButton: false, showCancelButton: true, allowOutsideClick: false, focusConfirm: false, focusCancel: false, padding: 24,
                    width: 400,
                    customClass: "alert-box",
                    cancelButtonColor: "#777777",
                    confirmButtonText: i18n.__('dialog.emptyTrash.button'),
                    cancelButtonText: i18n.__("general.cancel"),
                }).then(function () {

                    var removeCount = s.trash.length;

                    var willDelete = {};
                    s.trash.forEach(function(r: any) {
                        if (r.id) {
                            willDelete[r.id] = true;
                        }
                    });

                    for (var i = 0; i < s.raw.length; i++) {
                        var image = s.raw[i];
                        if (image.id && willDelete[image.id]) {
                            s.raw.splice(i, 1);
                            delete s.itemMappings[image.id];
                            i--;
                            continue;
                        }
                    }

                    try { electronLog && electronLog.info(`[app] Empty trash`); } catch (err) {};
                    ayncsImagesRemove(s.trash);

                    s.trash = [];
                    s.updateSelection();
                    s.rebindRefresh();
                    s.findDupclipate(undefined);

                    // 更新進度
                    s.removeProgress = 0;
                    s.currentTrashRemoved = 0;
                    s.trashRemoved += removeCount;
                    s.isCleaningTrash = true;
                    // 觸發 AI Search 全量同步
                    eagle.aiSearch.fullSync();

                    // 如果声音效果是开启的
                    if (s.$root.preferences.notification.soundEffect.enable != 'false' && s.$root.preferences.notification.soundEffect.when.deleteFolder == 'true') {
                        s.removeSound.play();
                    }
                });
            }
    }).apply(null, args);
  };

  /* emptyRestore（bundle 37096-37137 逐字；trash 右键菜单「全部恢复」——isDeleted=false
     + ayncsImagesChange 回存） */
  fns["emptyRestore"] = function (...args) {
    const s = getScope();
    if (!s) return;
    return (function () {
            if (s.trash && s.trash.length > 0) {
                swal({
                    html: `
                        <div class="alert">
                            <div class="alert-icon warning"></div>
                            <h4 class="alert-title">${i18n.__('dialog.restoreAll.title')}</h4>
                            <p class="alert-desc">${i18n.__("dialog.restoreAll.desc")}</p>
                        </div>
                    `,
                    showCloseButton: false, showCancelButton: true, allowOutsideClick: false, focusConfirm: false, focusCancel: false, padding: 24,
                    width: 400,
                    customClass: "alert-box",
                    cancelButtonColor: "#777777",
                    confirmButtonText: i18n.__('dialog.restoreAll.button'),
                    cancelButtonText: i18n.__("general.cancel"),
                }).then(function () {
                    var changes = [];
                    let now = Date.now();
                    s.trash.forEach(function(image: any) {
                        image.isDeleted = false;
                        changes.push(image);
                        s.updateFilterCounts(image, -1, now);
                        // ipcRenderer.send('image-change', image);
                    });
                    if (changes.length > 0) {
                        ayncsImagesChange(changes);
                        try { electronLog && electronLog.info(`[app] Restore ${changes.length} files from trash`); } catch (err) {};
                    }
                    s.trash = [];

                    s.calculateImageBinding({ ignoreSort: true }, function() {
                        s.rebindRefresh();
                        s.updateSelection();
                        s.$evalAsync();
                    });
                });
            }
    }).apply(null, args);
  };

  /* openTrashContextMenu（bundle 37924-37952 逐字；侧栏 trash 右键菜单——
     「清空回收站/全部恢复」双项，disabled = trash 空） */
  fns["openTrashContextMenu"] = function (...args) {
    const s = getScope();
    if (!s) return;
    return (function (event: any) {

            const disabled = s.trash.length === 0;
            const $trash = $(event.delegateTarget);

            ContextMenu.open({
                items: [
                    {
                        disabled: disabled,
                        label: i18n.__('context.emptyTrash.empty'),
                        keywords: `empty delete remove trash`,
                        icon: 'ic-trash-empty.svg',
                        click: () => { s.$evalAsync(() => { s.emptyTrash(); }); }
                    },
                    {
                        disabled: disabled,
                        label: $filter('i18n')('context.emptyTrash.restoreAll'),
                        keywords: `restore`,
                        icon: 'ic-trash-restore.svg',
                        click: () => { s.$evalAsync(() => { s.emptyRestore(); }); }
                    }
                ],
                showSearch: false,
                onOpened: () => {
                    $trash.addClass("context-activate");
                },
                onClosed: () => {
                    $trash.removeClass("context-activate");
                }
            });
    }).apply(null, args);
  };

  /* openFileWithDefault（bundle 33301-33308 逐字；debounce 经 window 全局回退——
     openFilesWithDefault（8755）同款适配。双击缩略图 habits.doubleclick==='external'
     分支的唯一依赖，此前缺席） */
  fns["openFileWithDefault"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function (file: any) {
            if (!file || !file.id) return;
            if ($(".swal2-container").length > 0) { return; }
            var folderPath = __lv_path.normalize(s.libraryPath + "/images/" + file.id + ".info/");
            var rawPath = __lv_path.normalize(folderPath + file.name + "." + file.ext);
            IPCHelper.send('open-with-default', rawPath);
            RecentFileManager.addFile(file);
    }).apply(null, args);
  };

  /* openFileListContextMenu（bundle 45249-45251 逐字；列表空白处右键唯一正主——
     此前缺席致 BoxList 容器级右键解析恒 undefined、条目右键也被错绑到此） */
  fns["openFileListContextMenu"] = function (...args) {
    const s = getScope();
    if (!s) return;
    return (function (event: any) {
            event.stopPropagation();
            s.openOrderMenu();
    }).apply(null, args);
  };

  /* openOrderMenu（bundle 45253-45257 逐字；Toolbar 排序按钮 + 列表右键共用——
     此前缺席致排序按钮点击无效果） */
  fns["openOrderMenu"] = function (...args) {
    const s = getScope();
    if (!s) return;
    return (function (event: any) {
            event && event.stopPropagation();
            s.$root.$broadcast("OPEN_LAYOUT_PANEL");
            updateCurrentOrderAndIncrease();
    }).apply(null, args);
  };

  /* onBoxMouseup（bundle 34821-34844 逐字；box mouseup 收拢选择 + sidebar focus 边界——
     原委托链（21938）的一部分，此前未移植） */
  fns["onBoxMouseup"] = function (...args) {
    const s = getScope();
    if (!s) return;
    return (function (event: any, image: any) {
            if (event && event.button === 0) {

                // 如果從 sidebar focus 狀態點擊列表已選擇圖片，不該造成已選擇圖片選取狀態消失
                if (s.$root.currentFocus !== "content" && s.selected.length > 1) {
                    if (image && s.selectedMappings[image.id]) {
                        s.$root.currentFocus = "content";
                        return;
                    }
                }
                if (image && s.selectedMappings[image.id]) {
                    // 如果點擊這些按鍵，就許消選取
                    if (event) {
                        if (event.metaKey || event.shiftKey || event.ctrlKey) {}
                        // 符合系统操作逻辑
                        else {
                            var targetSelectedIndex = s.allData.indexOf(image);
                            s.selected = [image];
                            s.lastSelectedIndex = targetSelectedIndex;
                        }
                    }
                    return;
                }
            }
    }).apply(null, args);
  };

  /* onBoxListDblClick（bundle 22178+22183 委托 dblclick 逐字合并——「图像打不开」根因：
     原 jQuery 委托绑定随 C1 消亡后从未重挂。name 双击 → enableImageNameEditable（本文件
     136 行移植版）；缩略图/img/video 双击 → ctrl/meta 新窗、alt 系统开启、否则按
     habits.doubleclick 进详情/系统开启。enableImageNameEditable 为模块内函数直调） */
  fns["onBoxListDblClick"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function (event: any, item: any, isName: any, $element: any) {
            if (isName) {
                enableImageNameEditable(event, $element);
                return;
            }
            if (!item) return;
            if (event.metaKey || event.ctrlKey) {
                if (
                    (EagleConfig.SUPPORT_FORMATS[item.ext] && !AUDIO_TYPES[item.ext]) ||
                    (window as any).pluginModule?.previewExtension?.viewerPluginMap?.[item.ext]
                ) {
                    openInNewWindow([item]);
                    (window as any).analytics?.event?.('NewWindow', 'Open', item.ext);
                }
                return;
            }
            else if (event.altKey) {
                s.openFilesWithDefault([item]);
                return;
            }
            else {
                if (s.$root.preferences.habits.doubleclick !== 'external') {
                    s.enterDetailMode(event, item);
                }
                else {
                    // 使用预设软体开启
                    s.openFileWithDefault(item);
                }
                s.$evalAsync();
            }
    }).apply(null, args);
  };

  /* cancelRegenerateThumbnail（bundle 34491-34494 逐字；FileThumbnailProgress 取消按钮同上——
     缺席时 regenerateThumbnailQueue 不清空、缩略图进度框永不关） */
  fns["cancelRegenerateThumbnail"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function () {
            IPCHelper.send('cancel.generate.thumbnail');
            s.regenerateThumbnailQueue = [];
    }).apply(null, args);
  };

  /* addToFolders（bundle 43200-43210 逐字；「添加到文件夹」入口——广播 OPEN-ADD-FOLDER-MODAL
     打开 FolderModals。eagle.inspector.calculateFolders 由 eagleClasses 供给（bare eagle 经
     window 全局回退解析，与同文件 ayncsImagesChange 同型） */
  fns["addToFolders"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function (e) {
            if (s.selected.length > 0) {
                s.$root.$broadcast("OPEN-ADD-FOLDER-MODAL", {
                    current: s.currentFolder,
                    folders: s.folders,
                    images: s.selected,
                    existsFolders: eagle.inspector.calculateFolders(s.selected),
                });
            }
    }).apply(null, args);
  };

  /* createFolder（bundle 40538-40604 逐字；body 级 options 版——selectPanelEngine 的
     新建文件夹 confirm 回调走 getBodyScope().createFolder({name,...})。guid 为 bundle
     全局（bundleGlobals 供给 w.guid，bare 经 window 全局回退解析） */
  fns["createFolder"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function ({ name, parentID, sibling, position = "top", callback }) {

            if (name === undefined) return;

            const folderId = guid();
            const folder = {
                id: folderId,
                name: name,
                folders: [],
                modificationTime: Date.now(),
                editable: false,
                tags: [],
                children: [],
                isExpand: true,
            };

            if (parentID) {
                folder.parent = parentID;
            }

            // 兄弟模式
            if (sibling) {
                const siblingParent = s.folderMappings[sibling.parent];
                let index;
                if (siblingParent) {
                    index = siblingParent.children.indexOf(sibling);
                    if (index === -1) index = siblingParent.children.length - 1;
                    siblingParent.children.splice(index + 1, 0, folder);
                }
                else {
                    index = s.folders.indexOf(sibling);
                    if (index === -1) index = s.folders.length - 1;
                    s.folders.splice(index + 1, 0, folder);
                }
            }
            // 添加成為孩子
            else if (parentID) {
                const parent = s.folderMappings[parentID];
                if (parent) {
                    parent.children.splice(0, 0, folder);
                }
            }
            // 添加在第一層
            else {
                if (position === "top") {
                    s.folders.splice(0, 0, folder);
                }
                else if (position === "bottom") {
                    s.folders.splice(s.folders.length, 0, folder);
                }
            }

            s.folderMappings[folder.id] = folder;
            s.addToRecentFolders([folder.id]);
            s.updateSidebarList();
            s.calculateImageBinding({ ignoreSort: true }, function() {
                s.refreshSubfolderList();
                s.saveFolder();
                if (callback) callback(folder);
                if (folder.parent) {
                    electronLog && electronLog.info(`[app] New sub-folder: ${folder.id}, parent: ${folder.parent}`);
                }
                else {
                    electronLog && electronLog.info(`[app] New folder: ${folder.id}`);
                }
                analytics.event('Folder', 'Create');
            });
    }).apply(null, args);
  };


  /* openItemContextMenu（bundle 43452-44603 逐字：EagleController 内 async 箭头函数体；
     b1-9q 大块移植——条目右键真实菜单。适配：$scope→s / $rootScope→s.$root（机械）；
     ContextMenu → 模块常量（bundle 15836-15843 逐字语义：根 scope 广播
     CONTEXTMENU.OPEN/CLOSE，React ContextMenuPanel 消费）；URL_MODULE → 模块级惰性解析
     （fileUrlHelper 同款）；removePlayingAudios/openWithApplicationPath/
     ayncsImagesGeneratePalette/ReverseImageSearch → bundleGlobals 同名供给（bundle 顶层
     全局的原生归宿）；bare eagle/$/_/i18n/$bodyScope/swal/preferences/process 经 window
     全局回退解析（本文件既有先例）。 */
  fns["openItemContextMenu"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (async (event, target) => {

        if (event?.target?.tagName === 'INPUT') return;

        event.stopPropagation();

        if (s.selected.indexOf(target) === -1) return;
        removePlayingAudios();
        
        const item = target || s.current;
        const items = s.selected;
        const viewMode = s.viewMode;
        const isMultiple = items.length > 1;
        const isSupportFormat = EagleConfig.SUPPORT_FORMATS[item.ext];
        const isFullScreen = currentWindow.isFullScreen();
        const isDetailMode = s.isDetailMode;
        const isInFolderList = !!s.currentFolder;
        const canPreview = (isSupportFormat || pluginModule?.previewExtension.thumbnailPluginMap[item.ext]);

        // 檔案可以打開的資料夾
        const openInFolderMenuItems = item?.folders?.reduce((acc, folderId) => {
            const folder = s.folderMappings[folderId];
            if (!folder) return acc;
            acc.push({
                label: folder.name,
                keywords: 'open 打開 location 位置 eagle',
                click: () => {
                    s.openItemLocation(s.selected[0], folder);
                    s.$evalAsync();
                }
            });
            return acc;
        }, []) ?? [];

        // 檔案是否可以被 Eagle 正常解析預覽
        let canPin = false;
        if (isInFolderList) {
            canPin = items.slice(0, 100).reduce((acc, item) => {
                if (!item.pinned || !item.pinned[s?.currentFolder?.id]) {
                    acc = false;
                }
                return acc;
            }, true);
        }

        // 添加到其它資源庫
        let historyLibraryMenu = {};
        historyLibraryMenu.items = $bodyScope.getLibraryHistory().filter((history) => {
            var isCurrent = false;
            if ($bodyScope.libraryPath) {
                isCurrent = path.normalize(history.path) == path.normalize($bodyScope.libraryPath);
            }
            return !isCurrent;
        }).map((history) => {
            let iconPath = path.normalize(`${history.path}/icon.png`);
            let iconUrl = URL_MODULE.pathToFileURL(iconPath).href;
            return {
                label: history.name,
                keywords: `${i18n.__('context.image.addToLibrary')} library 資源庫 add to`,
                accelerator: history.dir,
                image: iconUrl,
                fallbackImage: 'assets/images/base/library-logo.svg',
                click: () => {
                    s.$root.$broadcast("ADD_TO_LIBRARY", {
                        items: items,
                        library: history
                    });
                    s.$evalAsync();
                }
            }
        });

        let openWithOtherMenuItem = {};
        if (process.platform === 'darwin') {
            let submenu = { items: [] };
            try {
                const rawPath = FileUrlHelper.getRawPath(item);
                const getAssociatedApplications = require(appRoot + '/my_modules/get-associated-application');
                let asso = await getAssociatedApplications(FileUrlHelper.getRawPath(item));
                asso.forEach((result) => {
                    try {
                        if (result.name === "Eagle.app") return;
                        submenu.items.push({
                            image: result.icon,
                            label: (result.default)? result.name + ` (${i18n.__("general.default")})` : result.name,
                            click: () => { openWithApplicationPath(result.path, rawPath, item); }
                        });
                    } catch (err) {}
                    if (result.default) {
                        submenu.items.push({
                            role: 'separator',
                        });
                    }
                });
            }
            catch (err) {}
            openWithOtherMenuItem = {
                visible: !isMultiple,
                label: i18n.__('context.image.openInOthers'),
                icon: 'ic-open-other.svg',
                submenu: submenu
            }
        }
        else {
            openWithOtherMenuItem = {
                visible: !isMultiple,
                accelerator: preferences.shortcuts.keybinds['view.file.openother'],
                label: i18n.__('context.image.openInOthers'),
                icon: 'ic-open-other.svg',
                click: () => {
                    s.openWithOther();
                }
            }
        }

        let pluginsMenuItems = [];
        const lastOpenedPluginsIds = pluginModule.getLastOpenedPlugins(3);
        const lastOpenedPluginsIdsMap = lastOpenedPluginsIds.reduce((acc, cur) => {
            acc[cur] = true;
            return acc;
        }, {});

        let lastOpenedPluginsMenuItems = [];
        let otherPluginsMenuItems = [];

        pluginModule.plugins.forEach((plugin) => {
            const manifest = plugin.manifest;
            const icon = `${URL_MODULE.pathToFileURL(`${plugin.path}/${manifest.logo}`).href}?t=${Date.now()}`;
            const name = manifest.name;
            const executable = !!manifest.main;
            const isServicePlugin = manifest?.main?.serviceMode;
            if (executable && !isServicePlugin && !pluginModule.isPluginDisabled(manifest.id)) {
                if (lastOpenedPluginsIdsMap[manifest.id]) {
                    lastOpenedPluginsMenuItems.push({
                        label: name,
                        image: icon,
                        accelerator: pluginModule.pluginShortcuts[manifest.id]??"",
                        keywords: `${i18n.__('general.plugin')} ${manifest.name} ${manifest?.keywords?.join(" ")}`,
                        click: () => {
                            pluginModule.open(plugin);
                        }
                    });
                }
                else {
                    otherPluginsMenuItems.push({
                        label: name,
                        image: icon,
                        accelerator: pluginModule.pluginShortcuts[manifest.id]??"",
                        keywords: `${i18n.__('general.plugin')} ${manifest.name} ${manifest?.keywords?.join(" ")}`,
                        click: () => {
                            pluginModule.open(plugin);
                        }
                    });
                }
            }
        });

        lastOpenedPluginsMenuItems.sort((a, b) => {
            return lastOpenedPluginsIds.indexOf(a) - lastOpenedPluginsIds.indexOf(b);
        });

        otherPluginsMenuItems.sort((a, b) => {
            return a.label.localeCompare(b.label);
        });

        pluginsMenuItems = [{ role: 'label', label: i18n.__("modal.pluginPanel.label.recent") }, ...lastOpenedPluginsMenuItems, { role: 'separator' }, ...otherPluginsMenuItems];

        ContextMenu.open({
            items: [
                // 還原
                {
                    visible: item.isDeleted,
                    label: i18n.__('context.image.restore'),
                    keywords: 'restore 還原 戻す',
                    icon: 'ic-trash-restore.svg',
                    click: () => {
                        s.selected.forEach((item) => {
                            item.isDeleted = false;
                        });
                        s.calculateImageBinding({ ignoreSort: true }, () => {
                            s.rebindRefresh(true);
                        });
                        const itemElements = s.getSelectedItemElements();
                        s.$root.$broadcast("gl:removeItems", itemElements);
                        ayncsImagesChange(items);
                        try { electronLog && electronLog.info(`[app] Restore ${items.length} files from trash`); } catch (err) {};
                        s.$evalAsync();
                    }
                },
                // --- (還原)
                {
                    visible: item.isDeleted,
                    role: 'separator',
                },
                // 启用字型 (字體）
                {
                    disabled: !(!s.isFontActivate(item) && !item.activating && !item.deactivating),
                    visible: !!FONT_TYPES[item.ext],
                    label: i18n.__('Context.Image.Font.Activate'),
                    keywords: 'font activate enable 啟用 啟動 字型 字體',
                    icon: 'ic-font-activate.svg',
                    click: () => { s.activateFonts(items); },
                },
                // 停用字型 (字體）
                {
                    disabled: (!s.isFontActivate(item) && !item.activating && !item.deactivating),
                    visible: !!FONT_TYPES[item.ext],
                    label: i18n.__('Context.Image.Font.Deactivate'),
                    keywords: 'font deactivate disable 停用 停止 字型 字體',
                    icon: 'ic-font-deactivate.svg',
                    click: () => { s.deactivateFonts(items); },
                },
                // --- (字體）
                {
                    visible: !!FONT_TYPES[item.ext],
                    role: 'separator',
                },
                // 设置当前画面为视频封面（視頻）
                {
                    visible: !!VIDEO_TYPES[item.ext] && isDetailMode,
                    accelerator: preferences.shortcuts.keybinds['player.thumbnail.set'],
                    label: i18n.__('context.image.updateVideoThumbanil'),
                    keywords: 'cover thumbnail 封面',
                    icon: 'ic-video-update-thumbnail.svg',
                    click: () => {
                        s.setAsVideoThumbnail();
                    },
                },
                // 拷贝当前画面（視頻）
                {
                    visible: !!VIDEO_TYPES[item.ext] && isDetailMode,
                    accelerator: preferences.shortcuts.keybinds['player.thumbnail.copy'],
                    label: i18n.__("context.image.copyCurrentFrameToClipboard"),
                    keywords: 'cover thumbnail 封面 copy 複製',
                    icon: 'ic-video-copy-frame.svg',
                    click: () => {
                        s.videoScreenShot(true);
                    },
                },
                // 保存当前画面（視頻）
                {
                    visible: !!VIDEO_TYPES[item.ext] && isDetailMode,
                    accelerator: preferences.shortcuts.keybinds['player.thumbnail.save'],
                    label: i18n.__("context.image.saveCurrentFrame"),
                    keywords: 'cover thumbnail 封面 save 儲存 保存',
                    icon: 'ic-video-save-frame.svg',
                    click: () => {
                        s.videoScreenShot();
                    },
                },
                // 保存当前画面（視頻）
                {
                    visible: !!VIDEO_TYPES[item.ext] && isDetailMode,
                    label: i18n.__("context.image.loadSubtitles"),
                    keywords: 'srt subtitle 字幕',
                    icon: 'ic-video-load-subtitle.svg',
                    click: () => {
                        s.loadSubtitles();
                    },
                },
                // ---（視頻）
                {
                    visible: !!VIDEO_TYPES[item.ext] && isDetailMode,
                    role: 'separator',
                },
                // 在新窗口打开
                {
                    visible: canPreview && items.length <= 20000 && !AUDIO_TYPES[item.ext],
                    accelerator: preferences.shortcuts.keybinds['view.file.opennewwindow'],
                    label: i18n.__('Context.Open.New.Window'),
                    keywords: 'open new window 開啟 打開 新視窗 新窗口',
                    icon: 'ic-open-new-window.svg',
                    click: () => {
                        s.openInPreviewWindow();
                    },
                },
                // 在默认应用打开
                {
                    accelerator: preferences.shortcuts.keybinds['view.file.opendefault'],
                    label: i18n.__('context.image.openInDefault'),
                    keywords: 'open default application 開啟 打開 默認 預設 應用',
                    icon: 'ic-open-default.svg',
                    click: () => {
                        s.openFilesWithDefault(s.selected);
                        s.$evalAsync();
                    },
                },
                // 其它應用打開
                openWithOtherMenuItem,
                // 在访达中打开
                {
                    label: (process.platform === 'darwin')? i18n.__('context.image.revealInFinder'): i18n.__('context.image.openInExplorer'),
                    accelerator: preferences.shortcuts.keybinds['view.file.openfinder'],
                    keywords: 'open finder explorer 開啟 打開 資源管理器 資源管理員 文件管理器',
                    icon: (process.platform === 'darwin')? 'ic-open-finder.svg': 'ic-open-explorer.svg',
                    click: () => {
                        s.openInFinder();
                    },
                },
                // 打开文件所在的位置(單選)
                {
                    visible: !isMultiple,
                    label: i18n.__("context.image.openItemLocation"),
                    icon: 'ic-open-eagle.svg',
                    submenu: {
                        items: [{
                            label: i18n.__("appmenu.view>all"),
                            keywords: `${i18n.__("context.image.openItemLocation")} open eagle 打開 location 位置`,
                            click: () => {
                                s.openItemLocation(item, null);
                                s.$evalAsync();
                            }
                        }, ...openInFolderMenuItems],
                    }
                },
                // 插件
                {
                    visible: pluginsMenuItems.length > 0,
                    role: 'separator',
                },
                {
                    visible: pluginsMenuItems.length > 0,
                    label: i18n.__('general.plugin'),
                    icon: 'ic-plugin.svg',
                    submenu: {
                        items: pluginsMenuItems
                    },
                },
                // ---
                {
                    role: 'separator',
                },
                // 添加到上一次使用的文件夾
                // addToLastUsedFolder
                {
                    disabled: s.getRecentFolders().length === 0,
                    label: i18n.__('appmenu.find>addToLastFolder'),
                    keywords: 'add to last used folder 添加至上次使用的文件夾',
                    icon: 'ic-folder-last-used.svg',
                    accelerator: preferences.shortcuts.keybinds['organize.folder.addLast'],
                    click: () => {
                        s.addToLastUsedFolder();
                        s.$evalAsync();
                    },
                },
                // 添加至文件夹...
                {
                    accelerator: s.$root.preferences.shortcuts.keybinds['find.add.to'] || 'CmdOrCtrl+Shift+J',
                    label: i18n.__('context.image.addToFolder'),
                    keywords: 'add to folder 添加至文件夾 添加到資料夾',
                    icon: 'ic-folder-add-to.svg',
                    click: () => {
                        s.addToFolders();
                        s.$evalAsync();
                    },
                },
                // 添加至其它资源库...
                {
                    label: i18n.__('context.image.addToLibrary'),
                    keywords: 'add to library 添加至資源庫',
                    icon: 'ic-library-add-to.svg',
                    submenu: historyLibraryMenu
                },
                // 导出
                {
                    label: i18n.__("context.image.export"),
                    keywords: 'export 匯出 導出',
                    icon: 'ic-export.svg',
                    submenu: {
                        items: [
                            {
                                label: i18n.__("context.image.export>eaglepack"),
                                keywords: `${i18n.__("context.image.export")} export eaglepack 匯出 導出`,
                                icon: 'ic-export-eaglepack.svg',
                                accelerator:  preferences.shortcuts.keybinds['file.export.item.eaglepack'],
                                click: () => {
                                    s.exportSelectedAsEaglepack();
                                }
                            },
                            {
                                label: i18n.__("context.image.export>computer"),
                                keywords: `${i18n.__("context.image.export")} export computer 匯出 導出 電腦`,
                                icon: 'ic-export-computer.svg',
                                accelerator:  preferences.shortcuts.keybinds['file.export.item.computer'],
                                click: () => {
                                    s.exportSelectedAsFolder();
                                }
                            },
                            {
                                label: i18n.__("context.image.exportAsFormat"),
                                icon: 'ic-export-format.svg',
                                keywords: `${i18n.__("context.image.export")} export as format 匯出 導出 格式`,
                                accelerator:  preferences.shortcuts.keybinds['file.export.item.as'],
                                click: () => {
                                    s.exportSelectedAsFormat();
                                    s.$evalAsync();
                                }
                            },
                            {
                                label: i18n.__("context.image.exportToCsv"),
                                icon: 'ic-export-csv.svg',
                                keywords: 'export csv 導出 匯出',
                                accelerator:  preferences.shortcuts.keybinds['file.export.csv'],
                                click: () => {
                                    s.exportSelectedToCsv();
                                    s.$evalAsync();
                                }
                            }
                        ]
                    }
                },
                // 分享
                {
                    visible: process.platform === 'darwin',
                    label: i18n.__("context.image.share"),
                    keywords: 'share 分享',
                    icon: 'ic-share.svg',
                    keepOpen: true,
                    click: () => {
                        const filePaths = items.map((item) => {
                            return FileUrlHelper.getRawPath(item);
                        });
                        const shareMenu = new remote.ShareMenu( { filePaths: filePaths } );
                        shareMenu.popup();
                    },
                },
                // ---
                {
                    role: 'separator',
                },
                // 置頂（文件夾列表）
                {
                    visible: isInFolderList && !canPin,
                    label: i18n.__("context.image.pin>pin"),
                    keywords: 'pin 置頂',
                    icon: 'ic-pin.svg',
                    click: () => {
                        // TODO 需重構獨立成 function
                        s.checkOperationSafety(() => {
                            var now = Date.now();
                            s.selected.forEach((item, index) => {
                                if (!item.pinned) { item.pinned = {} };
                                if (s.$root.selectedFolders?.length > 0) {
                                    // 取得 item folders 和 s.$root.selectedFolders 的交集
                                    const folders = item.folders.filter((folderId) => {
                                        return s.$root.selectedFoldersMappings[folderId];
                                    });
                                    folders.forEach((folderId) => {
                                        item.pinned[folderId] = now - index;
                                    });
                                }
                                else {
                                    item.pinned[s.currentFolder.id] = now - index;
                                }
                            });
                            ayncsImagesChange(s.selected);
                            var message = $filter('i18n')("notify.pinned.pin", [
                                { "property": "count", "value": s.selected.length },
                            ]);
                            s.notify({
                                message: message,
                                duration: 1500
                            });
                            s.rebindRefresh();
                            // s.scrollToSelectedItem();
                            s.$evalAsync();
                        });
                    },
                },
                // 取消置頂（文件夾列表）
                {
                    visible: isInFolderList && canPin,
                    label: i18n.__("context.image.pin>unpin"),
                    keywords: 'unpin 取消置頂',
                    icon: 'ic-unpin.svg',
                    click: () => {
                        // TODO 需重構獨立成 function
                        s.checkOperationSafety(() => {
                            var now = Date.now();
                            s.selected.forEach((item, index) => {
                                if (!item.pinned) return;
                                if (s.$root.selectedFolders?.length > 0) {
                                    // 取得 item folders 和 s.$root.selectedFolders 的交集
                                    const folders = item.folders.filter((folderId) => {
                                        return s.$root.selectedFoldersMappings[folderId];
                                    });
                                    folders.forEach((folderId) => {
                                        delete item.pinned[folderId];
                                    });
                                }
                                else {
                                    delete item.pinned[s.currentFolder.id];
                                }
                                if (Object.keys(item.pinned).length === 0) {
                                    delete item.pinned;
                                }
                            });
                            ayncsImagesChange(s.selected);
                            var message = $filter('i18n')("notify.pinned.unpin", [
                                { "property": "count", "value": s.selected.length },
                            ]);
                            s.notify({
                                message: message,
                                duration: 1500
                            });
                            s.selected = [s.getNext()];
                            s.rebindRefresh();
                            // s.scrollToSelectedItem();
                            s.$evalAsync();
                        });
                    },
                },
                // ---（文件夾列表）
                {
                    visible: isInFolderList,
                    role: 'separator',
                },
                // 設為文件夾封面（文件夾列表）
                {
                    visible: isInFolderList,
                    accelerator: 'Alt+Shift+C',
                    label: i18n.__('context.image.setAsCover'),
                    keywords: 'set as cover 設為封面',
                    icon: 'ic-folder-set-cover.svg',
                    click: () => {
                        s.setFolderCover();
                        s.$evalAsync();
                    },
                },
                // ---（文件夾列表）
                {
                    visible: isInFolderList,
                    role: 'separator',
                },
                // 用所选项目新建文件夹(多選)
                {
                    visible: isMultiple,
                    label: $filter('i18n')("context.image.addImageToNewFolder", [
                        { "property": "count", "value": items.length }
                    ]),
                    keywords: 'folder selection new',
                    icon: 'ic-folder-new-with-selection.svg',
                    click: () => {
                        s.newFolderWidthSelection();
                    },
                },
                // 重命名(多選)
                {
                    accelerator: preferences.shortcuts.keybinds[`edit.rename.${process.platform}`],
                    visible: isMultiple,
                    label: i18n.__('context.image.batchRename.msg1') + items.length + i18n.__('context.image.batchRename.msg2'),
                    keywords: '重命名 rename',
                    icon: 'ic-rename.svg',
                    click: () => {
                        renameImages();
                        s.$evalAsync();
                    },
                },
                // 重命名(單選)
                {
                    accelerator: preferences.shortcuts.keybinds[`edit.rename.${process.platform}`],
                    visible: !isMultiple,
                    label: i18n.__('context.image.batchRename.msg1'),
                    keywords: '重命名 rename',
                    icon: 'ic-rename.svg',
                    click: () => {
                        renameImages();
                        s.$evalAsync();
                    },
                },
                // 复制文件
                {
                    accelerator: 'CmdOrCtrl+C',
                    label: (isMultiple)? i18n.__('context.image.copyItems'): i18n.__('context.image.copyItem'),
                    keywords: 'copy file 複製 文件',
                    icon: 'ic-file-copy.svg',
                    click: () => {
                        s.copyImages(event);
                        s.$evalAsync();
                    },
                },
                // 复制文件路径
                {
                    accelerator: s.$root.preferences.shortcuts.keybinds['edit.copy.path'],
                    label: i18n.__('context.image.copyItemPath'),
                    keywords: 'copy path 複製 路徑',
                    icon: 'ic-file-copy-path.svg',
                    click: () => {
                        s.copyAsPath();
                        s.$evalAsync();
                    },
                },
                // 复制...
                {
                    label: i18n.__("context.image.copy"),
                    keywords: 'copy 複製',
                    icon: 'ic-file-copy-ohters.svg',
                    submenu: {
                        items: [
                            // 复制链接
                            {
                                accelerator: s.$root.preferences.shortcuts.keybinds['edit.copy.eaglelink'],
                                label: i18n.__("appmenu.edit>copyAsLink"),
                                keywords: `${i18n.__("context.image.copy")} copy link 拷貝 複製 鏈接 連結`,
                                icon: '',
                                click: () => {
                                    s.copyAsLink(undefined, items);
                                    s.$evalAsync();
                                },
                            },
                            // 文件夹路径
                            {
                                accelerator: s.$root.preferences.shortcuts.keybinds['edit.copy.folderpath'],
                                label: i18n.__("context.image.copyAsFolderPath"),
                                keywords: `${i18n.__("context.image.copy")} copy folder path 拷貝 複製 文件夾 資料夾 路徑`,
                                icon: '',
                                click: () => {
                                    s.copyAsFolderPath();
                                    s.$evalAsync();
                                },
                            },
                            // 缩略图
                            {
                                accelerator: s.$root.preferences.shortcuts.keybinds['edit.copy.thumbnail'],
                                label: i18n.__("context.image.copyAsThumbnail"),
                                keywords: `${i18n.__("context.image.copy")} copy thumbnail 拷貝 複製 縮略圖`,
                                icon: '',
                                click: () => {
                                    s.copyAsThumbnail();
                                    s.$evalAsync();
                                },
                            },
                            // Base64
                            {
                                disabled: isMultiple,
                                accelerator: s.$root.preferences.shortcuts.keybinds['edit.copy.base64'],
                                label: 'Base64',
                                keywords: `${i18n.__("context.image.copy")} copy 拷貝 複製`,
                                icon: '',
                                click: () => {
                                    s.copyAsBase64();
                                    s.$evalAsync();
                                },
                            },
                            // 名称
                            {
                                accelerator: s.$root.preferences.shortcuts.keybinds['edit.copy.name'],
                                label: i18n.__("context.image.copyAsName"),
                                keywords: `${i18n.__("context.image.copy")} copy name 拷貝 複製 名稱`,
                                icon: '',
                                click: () => {
                                    s.copyAsProperity("name");
                                    s.$evalAsync();
                                },
                            },
                        ]
                    }
                },
                // 复制标签
                {
                    disabled: !(eagle?.inspector?.newTags?.length > 0),
                    accelerator: preferences.shortcuts.keybinds['organize.tag.copy'],
                    label: i18n.__('context.image.copyTag'),
                    keywords: 'copy tag 複製 標籤',
                    icon: 'ic-tag-copy.svg',
                    click: () => {
                        s.copyTags();
                    },
                },
                // 粘贴标签
                {
                    disabled: !eagle.inspector.copiedTags,
                    accelerator: preferences.shortcuts.keybinds['organize.tag.paste'],
                    label: i18n.__('context.image.pasteTag'),
                    keywords: 'paste tag 粘貼 標籤 貼上',
                    icon: 'ic-tag-paste.svg',
                    click: () => {
                        s.pasteTags();
                    },
                },
                // ---
                {
                    role: 'separator',
                },
                // 創建拼圖（多選）
                {
                    visible: isMultiple && isSupportFormat,
                    accelerator: preferences.shortcuts.keybinds['edit.image.merge'],
                    label: i18n.__('context.image.merge'),
                    keywords: 'merge combine 拼圖 合併',
                    icon: 'ic-file-combine.svg',
                    click: () => {
                        eagle.combineImages.open(s.selected);
                        s.$evalAsync();
                    }
                },
                // 创建副本(單選)
                {
                    visible: !isMultiple,
                    accelerator: s.$root.preferences.shortcuts.keybinds['edit.duplicate'],
                    label: i18n.__("context.image.clone"),
                    keywords: 'clone duplicate 複製 副本',
                    icon: 'ic-copy-duplicate.svg',
                    click: () => {
                        s.duplicateItem();
                        s.$evalAsync();
                    },
                },
                // ---
                {
                    role: 'separator',
                },
                // Eagle 5.0
                // {
                //     visible: !isMultiple,
                //     label: i18n.__('context.image.reverseSearchLocal'),
                //     keywords: 'search by image',
                //     icon: 'ic-search-by-image.svg',
                //     click: () => {
                //         s.openAll();
                //         s.openFilter();
                //         s.$broadcast('OPEN_IMAGE_FILTER', { itemId: item.id });
                //     },
                // },
                // 以图搜图
                {
                    visible: item.ext !== 'svg',
                    label: i18n.__('context.image.reverseSearch'),
                    keywords: 'reverse search picture image',
                    icon: 'ic-reverse-search.svg',
                    submenu: {
                        items: [
                            // Google
                            {
                                visible: EagleConfig.SUPPORT_FORMATS[item.ext] && item.ext !== 'svg',
                                label: i18n.__('context.image.reverseSearch>google'),
                                keywords: `${i18n.__('context.image.reverseSearch')} google reverse search image 以圖找圖`,
                                enabled: item.ext !== 'svg',
                                accelerator: preferences.shortcuts.keybinds['find.reverse.google'],
                                click: () => {
                                    eagle.reverseImageSearch.search(item, ReverseImageSearch.ENGINES.GOOGLE);
                                    s.$evalAsync();
                                }
                            },
                            // Bing
                            {
                                visible: item.ext !== 'svg',
                                label: i18n.__("general.bing"),
                                keywords: `${i18n.__('context.image.reverseSearch')} bing reverse search image 以圖找圖`,
                                accelerator: preferences.shortcuts.keybinds['find.reverse.bing'],
                                enabled: item.ext !== 'svg',
                                click: () => {
                                    eagle.reverseImageSearch.search(item, ReverseImageSearch.ENGINES.BING);
                                }
                            },
                            // Yandex
                            {
                                visible: item.ext !== 'svg',
                                label: "Yandex",
                                keywords: `${i18n.__('context.image.reverseSearch')} reverse search image 以圖找圖`,
                                enabled: item.ext !== 'svg',
                                accelerator: preferences.shortcuts.keybinds['find.reverse.yandex'],
                                click: () => {
                                    eagle.reverseImageSearch.search(item, ReverseImageSearch.ENGINES.YANDEX);
                                }
                            },
                            // TinEye
                            {
                                visible: item.ext !== 'svg',
                                label: "TinEye",
                                keywords: `${i18n.__('context.image.reverseSearch')} reverse search image 以圖找圖`,
                                enabled: item.ext !== 'svg',
                                accelerator: preferences.shortcuts.keybinds['find.reverse.tineye'],
                                click: () => {
                                    eagle.reverseImageSearch.search(item, ReverseImageSearch.ENGINES.TINEYE);
                                }
                            },
                            {
                                visible: item.ext !== 'svg',
                                label: "SauceNAO",
                                keywords: `${i18n.__('context.image.reverseSearch')} reverse search image 以圖找圖 sauceNAO`,
                                enabled: item.ext !== 'svg',
                                accelerator: preferences.shortcuts.keybinds['find.reverse.saucenao'],
                                click: () => {
                                    eagle.reverseImageSearch.search(item, ReverseImageSearch.ENGINES.SAUCENAO);
                                }
                            },
                            // ---
                            {
                                visible: item.ext !== 'svg' && preferences.general.language === 'zh_CN',
                                label: "百度",
                                keywords: `${i18n.__('context.image.reverseSearch')} baidu reverse search image 以圖找圖`,
                                enabled: item.ext !== 'svg',
                                accelerator: preferences.shortcuts.keybinds['find.reverse.baidu'],
                                click: () => {
                                    eagle.reverseImageSearch.search(item, ReverseImageSearch.ENGINES.BAIDU);
                                }
                            },
                            {
                                visible: item.ext !== 'svg' && preferences.general.language === 'zh_CN',
                                label: "搜狗",
                                keywords: `${i18n.__('context.image.reverseSearch')} sougo reverse search image 以圖找圖`,
                                enabled: item.ext !== 'svg',
                                accelerator: preferences.shortcuts.keybinds['find.reverse.sogou'],
                                click: () => {
                                    eagle.reverseImageSearch.search(item, ReverseImageSearch.ENGINES.SOGOU);
                                }
                            }
                        ]
                    }
                },
                // ---
                {
                    role: 'separator',
                },
                // 进入简报模式
                {
                    visible: !isFullScreen,
                    accelerator: preferences.shortcuts.keybinds['view.toggle.slideshow'],
                    label: i18n.__('context.image.slideshowOn'),
                    keywords: 'enter slide show presentation 簡報 演示 進入',
                    icon: 'ic-slideshow-on.svg',
                    click: () => {
                        s.toggleSlideshow();
                    }
                },
                // 離開全螢幕
                {
                    visible: isFullScreen,
                    label: i18n.__('context.image.slideshowOff'),
                    accelerator: preferences.shortcuts.keybinds['view.toggle.slideshow'],
                    keywords: 'exit leave slide show presentation 簡報 演示 離開 退出',
                    icon: 'ic-slideshow-off.svg',
                    click: () => {
                        ipcRenderer.send('toggle-slideshow');
                    }
                },
                // 顯示導航器（詳情模式）
                {
                    visible: isDetailMode,
                    checked: !s.isHideNavigator,
                    label: i18n.__("appmenu.view>showNavigator"),
                    keywords: 'show navigator 導航器 顯示',
                    icon: 'ic-navigator.svg',
                    click: () => {
                        s.isHideNavigator = !s.isHideNavigator;
                        localStorage["isHideNavigator"] = s.isHideNavigator;
                        s.$evalAsync();
                    },
                },
                // 缩略图背景
                {
                    visible: !isDetailMode,
                    label: i18n.__('context.image.thumbnailBG'),
                    keywords: 'thumbnail background 縮略圖 背景',
                    icon: 'ic-file-transparent-grid.svg',
                    submenu: {
                        items: [
                            // 無
                            {
                                checked: !item.background,
                                icon: 'ic-transparent-grid-none.svg',
                                label: i18n.__('context.image.thumbnailBG>none'),
                                keywords: `${i18n.__('context.image.thumbnailBG')} thumbnail background transparent grid none 縮略圖 背景 無`,
                                click: () => { s.changeImagesBackground(items, undefined); }
                            },
                            // ---
                            {
                                role: 'separator',
                            },
                            // 黑
                            {
                                checked: item.background === 'dark',
                                icon: 'ic-transparent-grid-black.svg',
                                label: i18n.__('context.image.thumbnailBG>dark'),
                                keywords: `${i18n.__('context.image.thumbnailBG')} thumbnail background transparent grid dark black 縮略圖 背景 黑 #000`,
                                click: () => { s.changeImagesBackground(items, 'dark'); }
                            },
                            // 灰
                            {
                                checked: item.background === 'gray',
                                icon: 'ic-transparent-grid-gray.svg',
                                label: i18n.__('context.image.thumbnailBG>gray'),
                                keywords: `${i18n.__('context.image.thumbnailBG')} thumbnail background transparent grid gray grey 縮略圖 背景 灰 #777`,
                                click: () => { s.changeImagesBackground(items, 'gray'); }
                            },
                            // 白
                            {
                                checked: item.background === 'light',
                                icon: 'ic-transparent-grid-white.svg',
                                label: i18n.__('context.image.thumbnailBG>light'),
                                keywords: `${i18n.__('context.image.thumbnailBG')} thumbnail background transparent grid light white 縮略圖 背景 白 #fff`,
                                click: () => { s.changeImagesBackground(items, 'light'); }
                            },
                            // 網格
                            {
                                checked: item.background === 'grid',
                                icon: 'ic-transparent-grid.svg',
                                label: i18n.__('context.image.thumbnailBG>grid'),
                                keywords: `${i18n.__('context.image.thumbnailBG')} thumbnail background transparent grid 縮略圖 背景 網格 透明`,
                                click: () => { s.changeImagesBackground(items, 'grid'); }
                            },
                        ]
                    }
                },
                // 黑白预览
                {
                    checked: s.isGrayscaleMode,
                    accelerator: preferences.shortcuts.keybinds['view.grayscale'],
                    label: i18n.__('appmenu.view>grayscale'),
                    keywords: 'grayscale black 黑白 预览 預覽',
                    icon: 'ic-grayscale.svg',
                    keepOpen: true,
                    click: () => {
                        s.isGrayscaleMode = !s.isGrayscaleMode;
                        s.$evalAsync();
                    }
                },
                // ---(Webp)
                {
                    visible: item.ext === 'webp',
                    role: 'separator',
                },
                // 转换为
                {
                    visible: item.ext === 'webp',
                    label: i18n.__("context.image.webpConvert"),
                    icon: 'ic-webp-convert.svg',
                    submenu: {
                        items: [
                            // PNG
                            {
                                visible: item.ext === 'webp',
                                label: "PNG",
                                keywords: `${i18n.__("context.image.webpConvert")} webp convert png 轉換`,
                                click: () => { s.$root.$broadcast('WEBP_CONVERT_START', { images: s.selected, format: "png" }); s.$evalAsync(); }
                            },
                            // JPG
                            {
                                visible: item.ext === 'webp',
                                label: "JPG",
                                keywords: `${i18n.__("context.image.webpConvert")} webp convert jpg 轉換`,
                                click: () => { s.$root.$broadcast('WEBP_CONVERT_START', { images: s.selected, format: "jpg" }); s.$evalAsync(); }
                            },
                        ]
                    }
                },
                // 更多
                {
                    label: i18n.__('Context.Image.Other'),
                    keywords: '',
                    icon: 'ic-more-actions.svg',
                    submenu: {
                        items: [
                            // 自定义缩略图（选择文件）
                            {
                                visible: !isMultiple && !NOT_SUPPORT_CUSTEOM_THUMBNAIL_TYPES[item.ext],
                                accelerator: preferences.shortcuts.keybinds['edit.thumbnail.custom.file'],
                                label: i18n.__("context.image.customThumb"),
                                keywords: 'more thumbnail custom 更多 自定義 縮略圖 縮圖',
                                icon: '',
                                click: () => {
                                    s.setCustomThumbnail();
                                },
                            },
                            // 自定义缩略图（从剪切板）
                            {
                                visible: !isMultiple && !NOT_SUPPORT_CUSTEOM_THUMBNAIL_TYPES[item.ext],
                                accelerator: preferences.shortcuts.keybinds['edit.thumbnail.custom.clipboard'],
                                label: i18n.__("context.image.customThumbFromClipboard"),
                                keywords: 'more thumbnail custom clipboard 更多 自定義 縮略圖 縮圖 剪貼簿 剪切板',
                                icon: '',
                                click: () => {
                                    s.setCustomThumbnailFromClipboard();
                                },
                            },
                            // 重置缩略图
                            {
                                visible: !isMultiple && !!item.customThumbnail && !NOT_SUPPORT_CUSTEOM_THUMBNAIL_TYPES[item.ext],
                                label: i18n.__("context.image.customThumb>reset"),
                                accelerator: preferences.shortcuts.keybinds['edit.thumbnail.custom.reset'],
                                keywords: 'more thumbnail custom reset 更多 自定義 縮略圖 縮圖 重置',
                                icon: '',
                                click: () => {
                                    s.resetCustomThumbnail();
                                }
                            },
                            // ---
                            {
                                visible: !isMultiple && !NOT_SUPPORT_CUSTEOM_THUMBNAIL_TYPES[item.ext],
                                role: 'separator',
                            },
                            // 刷新缩略图
                            {
                                accelerator: preferences.shortcuts.keybinds['edit.thumbnail.refresh'],
                                label: i18n.__('context.image.updateThumbanil'),
                                keywords: 'more thumbnail update refresh 更多 縮略圖 縮圖 刷新 更新',
                                icon: '',
                                click: () => {
                                    s.regenerateThumbnail();
					                    s.$evalAsync();
                                },
                            },
                            // 重新分析颜色
                            {
                                label: i18n.__('context.image.updatePalette'),
                                keywords: 'more palette color update refresh 更多 調色板 調色盤 刷新 更新 重新分析 顏色',
                                icon: '',
                                click: () => {
                                    ayncsImagesGeneratePalette(items);
                                },
                            },
                            // 用其他文件替換
                            {
                                visible: items.length === 1,
                                label: i18n.__('context.image.replaceFile'),
                                keywords: 'more replace substitute 覆蓋 覆写 替换',
                                icon: '',
                                click: () => {
                                    s.replaceFile();
                                },
                            },
                            // ---（字體）
                            {
                                visible: !!FONT_TYPES[item.ext],
                                role: 'separator',
                            },
                            // 以 family name 重命名字体（字體）
                            {
                                visible: !!FONT_TYPES[item.ext],
                                label: i18n.__('Context.Image.Font.Rename'),
                                keywords: 'font rename 字體 字型 重命名',
                                click: () => {
                                    s.renameFontsWithFullName(items);
                                }
                            },
                            // 設置字體預設語言（字體）
                            {
                                visible: !!FONT_TYPES[item.ext],
                                role: 'label',
                                label: i18n.__("Context.Image.Font.ChangeLang"),
                            },
                            {
                                visible: !!FONT_TYPES[item.ext],
                                label: "English",
                                keywords: 'font english en us 字體 字型 英文',
                                click: () => {
                                    s.changeFontDefaultLang(items, 'en');
                                    s.$evalAsync();
                                }
                            },
                            {
                                visible: !!FONT_TYPES[item.ext],
                                label: "日本語",
                                keywords: 'font japanese jp 字體 字型 日文',
                                click: () => {
                                    s.changeFontDefaultLang(items, 'jp');
                                    s.$evalAsync();
                                }
                            },
                            {
                                visible: !!FONT_TYPES[item.ext],
                                label: "한국어",
                                keywords: 'font korean kr 字體 字型 韓文',
                                click: () => {
                                    s.changeFontDefaultLang(items, 'kr');
                                    s.$evalAsync();
                                }
                            },
                            {
                                visible: !!FONT_TYPES[item.ext],
                                label: "Chinese(Simplified)",
                                keywords: 'font chinese simplified zh_CN 字體 字型 簡體中文',
                                click: () => {
                                    s.changeFontDefaultLang(items, 'zh_CN');
                                    s.$evalAsync();
                                }
                            },
                            {
                                visible: !!FONT_TYPES[item.ext],
                                label: "Chinese(Traditional)",
                                keywords: 'font chinese traditional zh_TW 字體 字型 繁體中文',
                                click: () => {
                                    s.changeFontDefaultLang(items, 'zh_TW');
                                    s.$evalAsync();
                                }
                            },
                        ]
                    }
                },
                // ---
                {
                    role: 'separator',
                },
                // 從文件夾中移除
                {
                    visible: !!s.currentFolder,
                    accelerator: preferences.shortcuts.keybinds[`edit.remove.folder.${s.platform}`],
                    label: i18n.__('context.image.removeFromFolder'),
                    keywords: 'remove from folder delete 從文件夾中移除 從資料夾中移除',
                    icon: 'ic-file-remove-folder.svg',
                    click: () => {
                        s.removeFromFolder(event, s.currentFolder.id);
                        s.$evalAsync();
                    },
                },
                // 丢到回收站
                {
                    visible: viewMode !== 'trash',
                    accelerator: preferences.shortcuts.keybinds[`edit.remove.trash.${s.platform}`],
                    label: i18n.__('context.image.moveToTrash'),
                    keywords: 'move to trash remove delete 丟到回收站 垃圾桶',
                    icon: 'ic-file-move-trash.svg',
                    click: () => {
                        s.removeSelected();
                        s.$evalAsync();
                    },
                },
                // 永久刪除
                {
                    visible: viewMode === 'trash',
                    label: i18n.__('dialog.permanentlyDelay.title'),
                    keywords: 'permanently delete remove 永久刪除',
                    icon: 'ic-file-delete-permanently.svg',
                    click: () => {
                        swal({
                            html: `
                                <div class="alert">
                                    <div class="alert-icon warning"></div>
                                    <h4 class="alert-title">${i18n.__('dialog.permanentlyDelay.title')}</h4>
                                    <p class="alert-desc">${i18n.__("dialog.permanentlyDelay.desc")}</p>
                                </div>
                            `,
                            showCloseButton: false, showCancelButton: true, allowOutsideClick: false, focusConfirm: true, focusCancel: false, padding: 24,
                            width: 400,
                            customClass: "alert-box",
                            cancelButtonColor: "#777777",
                            confirmButtonText: i18n.__('dialog.permanentlyDelay.button'),
                            cancelButtonText: i18n.__("general.cancel"),
                        }).then(() => {
                            s.$evalAsync(() => {
                                s.removePermanently();
                                if (s.$root.preferences.notification.soundEffect.enable != 'false' && s.$root.preferences.notification.soundEffect.when.deleteFolder == 'true') {
                                    s.removeSound.play();
                                }
                            });
                        });
                    },
                },
            ],
            showSearch: true,
        });
        s.$root.currentFocus = "content";
    }).apply(null, args);
  };

  /* getLibraryHistory（bundle 31927-31946 逐字；$scope→s、path→__lv_path（c3 改名惯例，
     initLinkVars 惰性初始化）。openItemContextMenu 的「添加到其它資源庫」子菜单依赖） */
  fns["getLibraryHistory"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function (length) {
            let result = [];
            s.libraryHistory.forEach(function (history, index) {

                var libraryName = __lv_path.basename(history).replace('.library', '');
                var libraryPath = __lv_path.dirname(history).replace(/\\$/g, "").replace(/\/$/, "");

                if (length === undefined) {
                    result.push({
                        name: libraryName,
                        dir: libraryPath,
                        path: history
                    });
                }
                else if (index + 1 < length) {
                    result.push({
                        name: libraryName,
                        dir: libraryPath,
                        path: history
                    });
                }
            });
            return result;
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
                let dateKey = `${importYear}/${importMonth}`;
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
                        if (!eagle.filter.filterCounts['mtime']['year/month'][`${modifyYear}/${modifyMonth}`]) {
                             eagle.filter.filterCounts['mtime']['year/month'][`${modifyYear}/${modifyMonth}`] = 0;
                        }
                        eagle.filter.filterCounts['mtime']['year/month'][`${modifyYear}/${modifyMonth}`]++;
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
                console.log(`发现 ${images.length} 张图片需要刷新缩略图, 省略了 ${s.raw.length - rindex} 次判断`);
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
                try { electronLog && electronLog.info(`[app] Change folder order to “${s.currentFolder.name}(${s.currentFolder.id})” order by: ${orderBy}`); } catch (err) {};
            }
            else if (s.currentSmartFolder) {
                s.setSmartFolderOrder(s.currentSmartFolder, orderBy);
                try { electronLog && electronLog.info(`[app] Change smart-folder order to “${s.currentSmartFolder.name}(${s.currentSmartFolder.id})” order by: ${orderBy}`); } catch (err) {};
            }
            else {
                if (orderBy) {
                    s.orderBy = orderBy;
                    s.orderByName = i18n.__(`context.order.orderBy>${s.orderBy.toLowerCase()}`);
                    localStorage.setItem(`eagle.list.orderBy.${s.rootDir}`, s.orderBy);
                    s.sortRawData(s.orderBy);
                    s.rebindRefresh();
                    s.$evalAsync();
                    try { electronLog && electronLog.info(`[app] Change global list order to: ${orderBy}`); } catch (err) {};
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
            // b1-9ay：dragCheck 原 bundle 闭包 var，逐字移植丢声明后裸引用在首次拖拽前
            // 是未声明全局——每个侧栏文件夹点击即 ReferenceError 且被 $apply 吞
            // （sweep B6 直调实锤）。Sidebar draggable 经 window.dragCheck 中转。
            if (event.which == 2 || (window as any).dragCheck) {
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
            // b1-9ay：同 clickNode——dragCheck 经 window 中转（原 bundle 闭包 var）
            if (event.which == 2 || (window as any).dragCheck) {
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
                    copyText += `\n${rawPath}`;
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
            var outPath = `${fontFolder}/${postScriptName}.${font.ext}`;
            var folderPath = __lv_path.normalize(s.libraryPath + "/images/" + font.id + ".info/");
            var rawPath = __lv_path.normalize(folderPath + name);
            if (process.platform === 'darwin') {
                if (fs.existsSync(outPath)) {
                    fse.removeSync(`${fontFolder}/${postScriptName}.${font.ext}`);
                    installedFonts[`${postScriptName}_.${font.ext}`] = false;
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

            ipcRenderer.send('electron-info', `[app] Unstall font: ${rawPath}`);
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
                return `./exif-viewer/index.html?orientation=${s.current.orientation}&path=${encodeURIComponent(FileUrlHelper.getRawUrl(s.current))}&width=${s.current.width}&height=${s.current.height}&zoom=${s.$root.preferences.habits.renderBehavior}`;
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
                return `./font-viewer/font-viewer.html?id=${s.current.id}&theme=${s.theme}&language=${s.language}`;
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
                return "gif-viewer/index.html?path=" + encodeURIComponent(gifPath) + "&url=" + encodeURIComponent(gifUrl) + "&name=" + encodeURIComponent(s.current.name + ".gif") + `&render=${renderBehavior}`;
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
				return `model-viewer/website/index.html#model=${rawUrl}`;
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
            __lv_result[`depth-${node.styles.depth}`] = true;
            __lv_result[`icon-${node.icon}`] = true;
            __lv_result[`color-${node.iconColor}`] = true;
			let parent = s.folderMappings[node.parent];
			if (parent) {
				__lv_result[`parent-color-${parent?.iconColor}`] = true;
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
                return `pdf-viewer/web/viewer.html?path=${encodeURIComponent(pdfPath)}&locale=${locale}&theme=${s.theme}`;
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
	            rawUrl = `${rawUrl}?v=${$bodyScope.modifiedMappings[__lv_image.id]}`;
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
                return `./raw-viewer/index.html?orientation=${__lv_image.orientation}&path=${encodeURIComponent(rawPath)}&name=${encodeURIComponent(__lv_image.name)}&ext=${__lv_image.ext}&width=${__lv_image.width}&height=${__lv_image.height}`;
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
                start: arr[0],
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
				__lv_result[`parent-color-${parent?.iconColor}`] = true;
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
                return `./text-editor/text-editor.html?id=${s.current.id}&theme=${s.theme}&name=${s.current.name}&language=${s.language}`;
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
                return installedFonts[`${postScriptName}_.${item.ext}`];
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
                    electronLog && electronLog.info(`[app] Drag ${folders.length} folders as ${folder.name}(${folder.id}) sibling`);
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
                    electronLog && electronLog.info(`[app] Drag ${folders.length} folders as ${folder.name}(${folder.id}) children`);
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
                tags: [],
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
                        electronLog && electronLog.info(`[app] New sub-folder: ${folder.id}, parent: ${folder.parent}`);
                    }
                    else {
                        electronLog && electronLog.info(`[app] New folder: ${folder.id}`);
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
            // b1-9ak：冒烟捕获分支——__EAGLE_MENU_SMOKE 时序列化菜单模板通报 main
            // （原生 popup 无法被 CDP 观察且会阻塞会话；dragSmokeMode 同款先例）。
            // 旗标由 preload 直通（shims 会 stub window.process/window.require，env 不可达）
            if ((window as any).__EAGLE_MENU_SMOKE === true) {
                // 模板由 main 侧原生序列化（remote 经代理读 items 实测为空）
                ipcRenderer.send('smoke:menu-popup', { site: 'application-menu' });
                return;
            }
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
                $(`#${id}-filter-item`).click();
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
            
            (window as any).__oicmT.push('before-open');
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

			if (localStorage[`eagle.list.layout.${s.currentFolder.id}`]) {
                if (s.layout !== localStorage[`eagle.list.layout.${s.currentFolder.id}`]) {
                    s.switchLayout(localStorage[`eagle.list.layout.${s.currentFolder.id}`]);
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
                                    path: __lv_packPath
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
                                    keywords: `${i18n.__("appmenu.file>autoImport")} 自動導入 設定 設置 settings auto import`,
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
                                            selected: true
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

			if (localStorage[`eagle.list.layout.${s.currentSmartFolder.id}`]) {
				s.switchLayout(localStorage[`eagle.list.layout.${s.currentSmartFolder.id}`]); 
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
                if (degree) $__lv_video.addClass(`r${degree}`);

                if (degree === 90 || degree === 270) {
                    __lv_video.style.setProperty('max-height', `calc(${__lv_video.videoHeight / __lv_video.videoWidth * 100}% - 24px)`, 'important');
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
                    tags: __lv_group.tags
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
                    var $box =$(`#box-${__lv_target.id}`);
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
                        console.log(`目标在第 ${startPage} 页`);
                        console.log($(`#box-${__lv_target.id}`).length);
                        // 東西不在畫面上，強制更新畫面然後定位
                        if ($(`#box-${__lv_target.id}`).length === 0 || startPage !== s.startCursor) {
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
                                    return k.startsWith('"') ? `"${converted}"` : converted;
                                });
                            } else {
                                // 單一關鍵字
                                let cleanK = kw.replace(/"/g, '');
                                let converted = chineseConvert.tw2cn(cleanK);
                                return kw.startsWith('"') ? `"${converted}"` : converted;
                            }
                        });
                        
                        s.keywords_tw = s.keywords.map(kw => {
                            if (Array.isArray(kw)) {
                                // OR 群組
                                return kw.map(k => {
                                    let cleanK = k.replace(/"/g, '');
                                    let converted = chineseConvert.cn2tw(cleanK);
                                    return k.startsWith('"') ? `"${converted}"` : converted;
                                });
                            } else {
                                // 單一關鍵字
                                let cleanK = kw.replace(/"/g, '');
                                let converted = chineseConvert.cn2tw(cleanK);
                                return kw.startsWith('"') ? `"${converted}"` : converted;
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
                x: __lv_width / 2,
                y: __lv_height / 2 + __lv_offsetY,
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
                ipcRenderer.send('ondragstart', { images: __lv_transformsJSON, target: s.current, resize: 120 });
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
                        "height": `calc(100% - ${48 + __lv_height}px)`
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
                        if (installedFonts[`${postScriptName}_.${__lv_image.ext}`]) {
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
                    path: __lv_file.path,
                    type: __lv_file.type,
                    size: __lv_file.size,
                    tags: __lv_file.tags || [],
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
                files: images.reverse()
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
                console.log(`before: ${fileName.length}`)
                fileName = fileName.substr(0, remainingFilenameLength(s.libraryPath));
                console.log(`after: ${fileName.length}`)

				fileName = sanitize(fileName).replace(/%/g, "").replace(/&lt;/g,"").replace(/&gt;/g,"").trim();
                return {
                    id: params?.ids && params?.ids[index] || undefined,
                    url: url,
                    folders: __lv_fds || [],
                    tags: __lv_tags,
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
                            'max-width': `${w}px !important`,
                            'max-height': `${h}px !important`,
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
                x: __lv_width / 2,
                y: __lv_height / 2 + __lv_offsetY,
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

  // ── b1-9w：openItemContextMenu 点击路径缺口补端口（33 个；bundle 逐字 +
  // 机械替换 $scope→s / $rootScope→s.$root / $bodyScope→getBodyScope()；
  // _.throttle/_.debounce 实例语义 = 控制器期一次性创建 → __cc_* 惰性单例）──

  // copyTags（bundle 30228-30234；eagle.inspector.copyTags() 无参 = 拷贝检查器 newTags）
  let __cc_copyTags: any = null;
  fns["copyTags"] = function (...args) {
    if (!__cc_copyTags) {
      __cc_copyTags = _.throttle(function () {
        const s = getScope();
        if (!s) return;
        eagle.inspector.copyTags();
        s.notify({
          message: $filter('i18n')("Context.Tag.Copy.Success"),
          duration: 750
        });
      }, 500);
    }
    return __cc_copyTags(...args);
  };

  // pasteTags（bundle 30236-30253）
  fns["pasteTags"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function(event) {
        event && event.preventDefault();
        event && event.stopPropagation();
        var copiedTags = eagle.inspector.copiedTags;
        if (s.selected && s.selected.length > 0 && copiedTags && copiedTags.length > 0) {
            s.selected.forEach(function (image) {
                copiedTags.forEach(function (tag) {
                    if (image.tags.indexOf(tag) === -1) {
                        image.tags.push(tag);
                    }
                });
            });
            s.updateSelection();
            ayncsImagesChange(s.selected);
            hiddenByCurrentFilter(s.selected);
            electronLog.info(`[app] Paste tags ${JSON.stringify(copiedTags)} to ${s.selected.length} files`);
        }
    }).apply(null, args);
  };

  // duplicateItem（bundle 30220-30226；'duplicate-file' 通道 main 进程无 handler——bundle 时代即空放，保真）
  fns["duplicateItem"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function (event) {
            event && event.preventDefault();
            event && event.stopPropagation();
            if (s.selected[0]) {
                ipcRenderer.send('duplicate-file', s.selected[0].id);
            }
        }).apply(null, args);
  };

  // removeFromFolder（bundle 30074-30176 全体）
  fns["removeFromFolder"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function(event, folderId) {

        if (event && event.stopPropagation) {
            event.stopPropagation();
        }

        if (!folderId && s.selected.length <= 0) return;

        var origins = [];

        s.selected.forEach(function(image) {
            var idx = image.folders.indexOf(folderId);
            if (idx !== -1) {
                origins.push(image);
                image.folders.splice(idx, 1);
            }
        });

        try {
            electronLog && electronLog.info(`[app] Remove ${s.selected.length} files from ${s.folderMappings[folderId].name}(${folderId})`);
        } catch (err) {};

        ayncsImagesChange(s.selected);
        hiddenByCurrentFilter(s.selected);

        var message = $filter('i18n')("notify.image.removeFromFolder", [
            { "property": "imageCount", "value": s.selected.length },
            { "property": "folderName", "value": s.folderMappings[folderId].name }
        ]);

        if (s.selected.length === 1) { message = message.replace("images", "image"); }

        // 自動選取下一個圖片，如果沒有下一個，選上一個，都沒有就空
        if (s.currentFolder && s.currentFolder.id === folderId) {
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
                s.leaveDetailMode();
            }

            if (s.isDetailMode) {
                $timeout(function() {
                    s.forceFitImageSize(s.current);
                    s.zoom();
                }, 100);
            }
            ScrollbarSaver.saveScrollPosition();

            var itemElements = s.getSelectedItemElements();
            s.$root.$broadcast("gl:removeItems", itemElements);
        }

        if (s.$root.preferences.notification.soundEffect.enable != 'false' && s.$root.preferences.notification.soundEffect.when.deleteImage == 'true') {
            s.removeSound.play();
        }

        s.calculateImageBinding({ ignoreSort: true }, function() {
            s.rebindRefresh(true);
            s.updateSelection();
        });

        s.$root.notify({
            message: message,
            duration: 5000,
        }, function() {
            origins.forEach(function(image) {
                if (image.folders.indexOf(folderId) === -1) {
                    image.folders.push(folderId);
                    image.folders = [...new Set(image.folders)];
                }
            });

            // 如果這張圖片就在這個資料夾，畫面需要更新
            if (s.currentFolder && s.currentFolder.id === folderId) {
                s.calculateImageBinding({ ignoreSort: true }, function() {
                    s.rebindRefresh();
                    s.updateSelection();
                });
            } else {
                s.updateSelection();
                s.rebindRefresh(true);
            }

            ayncsImagesChange(origins);
        });
    }).apply(null, args);
  };

  // exportSelectedAsFolder（bundle 26364-26449）
  fns["exportSelectedAsFolder"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function () {
        if (s.selected.length === 0) return;
        s.exportFolder(function (savePath) {
            if (savePath) {
                var imageNames = {};
                for (var i = 0; i < s.selected.length; i++) {
                    var image = s.selected[i];
                    imageNames[image.name + "." + image.ext] = image.name;
                }

                var needSpace = eagle.inspector.calculateFileSize(s.selected);
                s.checkDiskSpace(savePath, needSpace, function () {

                    fs.readdir(savePath, function(err, files) {

                        var sameFileCount = 0;

                        files.forEach(function (filename) {
                            if (imageNames[filename]) {
                                sameFileCount++;
                            }
                        });

                        if (sameFileCount > 0) {

                            var message = $filter('i18n')("Dialog.Export.As.Folder.Message", [
                                { "property": "savePath", "value": savePath },
                                { "property": "sameFileCount", "value": sameFileCount },
                            ]);

                            swal({
                                html: `
                                    <div class="alert">
                                        <div class="alert-icon warning"></div>
                                        <h4 class="alert-title">${i18n.__("Dialog.Export.As.Folder.Title")}</h4>
                                        <p class="alert-desc">${message}</p>
                                    </div>
                                `,
                                showCloseButton: false, showCancelButton: true, allowOutsideClick: false, focusConfirm: true, focusCancel: false, padding: 24,
                                width: 400,
                                customClass: "alert-box",
                                cancelButtonColor: "#777777",
                                confirmButtonText: i18n.__("Dialog.Export.As.Folder.Button"),
                                cancelButtonText: i18n.__("general.cancel"),
                            }).then(function () {
                                if ((window as any).backgroundWindowID === undefined) {
                                    IPCHelper.send('export-as-folder', {
                                        folder: undefined,
                                        images: s.selected,
                                        savePath: savePath,
                                        needSpace: needSpace
                                    });
                                }
                                else {
                                    IPCHelper.sendTo((window as any).backgroundWindowID, 'export-as-folder', {
                                        folder: undefined,
                                        images: s.selected,
                                        savePath: savePath,
                                        needSpace: needSpace
                                    });
                                }
                            });
                        }
                        else {
                            if ((window as any).backgroundWindowID === undefined) {
                                IPCHelper.send('export-as-folder', {
                                    folder: undefined,
                                    images: s.selected,
                                    savePath: savePath,
                                    needSpace: needSpace
                                });
                            }
                            else {
                                IPCHelper.sendTo((window as any).backgroundWindowID, 'export-as-folder', {
                                    folder: undefined,
                                    images: s.selected,
                                    savePath: savePath,
                                    needSpace: needSpace
                                });
                            }
                        }
                    });
                });
            }
        });
    }).apply(null, args);
  };

  // exportFolder（bundle 26615-26630）
  fns["exportFolder"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function(callback) {
        dialog.showOpenDialog(currentWindow, {
            title: $filter('i18n')('dialog.exportAsFolder.title'),
            filters: [],
            properties: ['openDirectory', 'createDirectory'],
            buttonLabel: $filter('i18n')("dialog.exportAsFolder.botton")
        }).then(result => {
            var paths = result.filePaths;
            if (paths && paths[0]) {
                var savePath = paths[0];
                callback(savePath)
            }
            else {
                callback(undefined);
            }
        });
    }).apply(null, args);
  };

  // checkDiskSpace（bundle 26732-26735：Eagle 已停用磁盘空间检查，直通回调）
  fns["checkDiskSpace"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function(path, needSpace, callback) {
        callback && callback();
    }).apply(null, args);
  };

  // exportSelectedAsEaglepack（bundle 26589-26613）
  fns["exportSelectedAsEaglepack"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function () {
        if (s.selected.length === 0) return;
        var defaultPath = path.join("*/", 'Untitled' + '.eaglepack');

        dialog.showSaveDialog(currentWindow, {
            defaultPath: defaultPath,
            title: i18n.__('Context.Image.Export'),
            filters: [{ name: 'Eagle Package File', extensions: ['eaglepack'] }]
        }).then(result => {
            var savePath = result.filePath;
            if (!savePath) return;
            if ((window as any).backgroundWindowID === undefined) {
                IPCHelper.send('export-images', {
                    images: s.selected,
                    savePath: savePath
                });
            }
            else {
                IPCHelper.sendTo((window as any).backgroundWindowID, 'export-images', {
                    images: s.selected,
                    savePath: savePath
                });
            }
        });
    }).apply(null, args);
  };

  // exportSelectedAsFormat（bundle 26633-26636）
  fns["exportSelectedAsFormat"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function () {
        if (s.selected.length === 0) return;
        eagle.customExport.open(s.selected);
    }).apply(null, args);
  };

  // exportSelectedToCsv（bundle 26638-26730；bundle 体内局部 const fs = require('fs')
  // 与模块级 fs 同物，收编）
  fns["exportSelectedToCsv"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function () {
        if (s.selected.length === 0) return;

        electronLog.info(`[App] Export CSV started, selected count: ${s.selected.length}`);

        const options = {
            title: i18n.__('dialog.exportCsv.title'),
            defaultPath: 'eagle-export.csv',
            filters: [
                { name: 'CSV Files', extensions: ['csv'] }
            ]
        };

        const filePath = dialog.showSaveDialogSync(options);
        if (!filePath) return;

        // CSV 字串轉義函數
        function escapeCSV(str) {
            if (!str) return '';
            str = String(str);
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                return '"' + str.replace(/"/g, '""') + '"';
            }
            return str;
        }

        // 日期格式化函數
        function formatDate(timestamp) {
            if (!timestamp) return '';
            const date = new Date(timestamp);
            return date.toISOString().replace('T', ' ').slice(0, 19);
        }

        try {
            // 準備 CSV 數據
            const headers = ['ID', 'Name', 'Extension', 'Width', 'Height', 'Duration',
                             'URL', 'Annotation', 'Comments', 'Tags', 'Folders',
                             'Size', 'Rating', 'Imported At', 'Modified At', 'File Path'];

            const rows = s.selected.map(item => {
                // 獲取文件夾名稱
                let folderNames = [];
                if (item.folders && item.folders.length > 0) {
                    folderNames = item.folders.map(folderId => {
                        // 使用 folderMappings 取得文件夾名稱
                        const folder = s.folderMappings[folderId];
                        return folder ? folder.name : folderId;
                    });
                }
                // item.comments[0].annotation
                const commentString = item?.comments ? item?.comments?.map(comment => comment.annotation).join('\n') : '';

                return [
                    item.id,
                    escapeCSV(item.name),
                    item.ext || '',
                    item.width || '',
                    item.height || '',
                    item.duration || '', // 影片持續時間
                    escapeCSV(item.url || ''),
                    escapeCSV(item.annotation || ''),
                    escapeCSV(commentString), // 圖片標住
                    escapeCSV((item.tags || []).join(', ')),
                    escapeCSV(folderNames.join(', ')), // 使用文件夾名稱
                    item.size || '',
                    item.star || '',
                    formatDate(item.modificationTime),
                    formatDate(item.lastModified),
                    escapeCSV(FileUrlHelper.getRawPath(item))
                ];
            });

            // 寫入檔案
            const csvContent = [headers, ...rows]
                .map(row => row.join(','))
                .join('\n');

            fs.writeFileSync(filePath, '\uFEFF' + csvContent, 'utf8'); // BOM for Excel

            // 顯示成功訊息
            s.$root.notify({
                message: i18n.__('notify.exporCSV.title'),
                duration: 5000,
            });

            ipcRenderer.send('show-item-in-folder', filePath);

        } catch (error) {
            electronLog.error('[App] Export CSV failed:', error);
        }
    }).apply(null, args);
  };

  // changeFontDefaultLang（bundle 32874-32883）
  fns["changeFontDefaultLang"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function (items, lang) {
        if (items && items.length > 0) {
            s.checkOperationSafety(function () {
                items.forEach(function (item) {
                    item.fontMetas.preferLng = lang;
                });
                ipcRenderer.send('regenerate-thumbnail', items);
            }, 10);
        }
    }).apply(null, args);
  };

  // renameFontsWithFullName（bundle 32885-32927）
  fns["renameFontsWithFullName"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function (items) {
        if (items && items.length > 0) {
            s.checkOperationSafety(function () {
                var updates = [];
                var lng = s.$root.preferences.general.language;
                var preferLng = 'en';
                switch (lng) {
                    case 'zh_TW':
                    case 'zh_CN':
                        preferLng = "zh";
                        break;
                    default:
                        preferLng = "en";
                }
                items.forEach(function (item) {
                    if (item && FONT_TYPES[item.ext]) {
                        if (item.fontMetas) {
                            try {
                                var fontFamily = _.get(item.fontMetas, `fontFamily.${preferLng}`, undefined) || _.get(item.fontMetas, `fontFamily.en`, "");
                                if (fontFamily && fontFamily.length > 0) {
                                    var originName = item.name;
                                    var newName = fontFamily;
                                    item.name = newName;
                                    item.oldName = originName;
                                    item.newName = newName;
                                    updates.push(item);
                                }
                                console.log(fontFamily);
                            }
                            catch (err) {}
                        }
                    }
                });
                ayncsImagesChange(updates);
                hiddenByCurrentFilter(updates);
                s.updateItemsView(items);
                s.calculateImageBinding({}, function () {
                    s.rebindRefresh(true);
                    s.updateSelection();
                });
            }, 10);
        }
    }).apply(null, args);
  };

  // activateFonts（bundle 32929-32947；activateFont 单数版已在 fns 表 346）
  fns["activateFonts"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function (items) {
        if (!items || items.length === 0) return;
        if (!fs.existsSync(fontFolder)) {
            fs.mkdirSync(fontFolder);
        }
        items.forEach(function (font) {
            s.activateFont(font, {showNotify: false, updateView: false});
        });
        if (process.platform === 'darwin') {
            s.updateItemsView(items);
        }
        s.notify({
            message: $filter('i18n')("notify.fonts.activate", [
                        { "property": "count", "value": items.length }
                    ]),
            duration: 1000
        });
        analytics.event("Font", "Install");
    }).apply(null, args);
  };

  // deactivateFonts（bundle 32996-33012；deactivateFont 单数版已在 fns 表 2755）
  fns["deactivateFonts"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function (items) {
        if (!fs.existsSync(fontFolder)) { return; }
        items.forEach(function (font) {
            s.deactivateFont(font, {showNotify: false, updateView: false});
        });
        if (process.platform === 'darwin') {
            s.updateItemsView(items);
        }

        s.notify({
            message: $filter('i18n')("notify.fonts.deactivate", [
                        { "property": "count", "value": items.length }
                    ]),
            duration: 1000
        });
        analytics.event("Font", "Uninstall");
    }).apply(null, args);
  };

  // openWithOther（bundle 33061-33065）
  let __cc_openWithOther: any = null;
  fns["openWithOther"] = function (...args) {
    if (!__cc_openWithOther) {
      __cc_openWithOther = _.debounce(function () {
        const s = getScope();
        if (!s) return;
        if (s.selected.length > 0) {
            ipcRenderer.send('open-with-dialog', FileUrlHelper.getRawPath(s.selected[0]));
        }
      }, 200, true);
    }
    return __cc_openWithOther(...args);
  };

  // openInFinder（bundle 33073-33146；debounce 实例 + 内层 helper openInFinder →
  // openInFinderImpl；showFinderAlert → __lv_showFinderAlert（模块顶层））
  let __cc_openInFinder: any = null;
  fns["openInFinder"] = function (...args) {
    if (!__cc_openInFinder) {
      __cc_openInFinder = (function () {
        function openInFinderImpl() {
            const s = getScope();
            if (!s) return;
            if (s.selected.length > 0) {
                s.checkOperationSafety(function () {
                    s.selected.forEach(function (file, index) {
                        if (index > 30) return;
                        var folderPath = path.normalize(s.libraryPath + "/images/" + file.id + ".info/");
                        var rawPath = path.normalize(folderPath + file.name + "." + file.ext);
                        if (fs.existsSync(rawPath)) {
                            ipcRenderer.send('show-item-in-folder', rawPath);
                        }
                        else if (fs.existsSync(folderPath + 'metadata.json')) {
                            ipcRenderer.send('show-item-in-folder', folderPath + 'metadata.json');
                        }
                        else {
                            ipcRenderer.send('show-item-in-folder', folderPath);
                        }
                        electronLog && electronLog.info("[app] Open item inFinder: " + folderPath);
                    });
                }, 10);
            }
        };
        return _.debounce(function () {
            const s = getScope();
            if (!s) return;

            // 禁止在任何 Modal 开启时，使用这个功能，避免快捷键冲突
            if ($(".modal.open, .import-modal.open").length > 0) return;
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
  };

  // setAsVideoThumbnail（bundle 33148-33189；getVideoPlayer 走 s.getVideoPlayer
  // （dataMachinery c9d 域内移植）；backgroundWindowID 在 shim 世界恒 undefined →
  // 与 bundle 后台窗消亡后语义一致）
  fns["setAsVideoThumbnail"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (async function() {
        if (!s.current) return;

        var player = s.getVideoPlayer();
        if (!player) return;

        var currentTime = player.el.currentTime;

        if (player.type === 'mpv') {
            try {
                var imageData = await player.el.screenshot(currentTime);
                if (!imageData) return;
                var canvas = document.createElement('canvas');
                canvas.width = imageData.width;
                canvas.height = imageData.height;
                canvas.getContext('2d').putImageData(imageData, 0, 0);
                var base64 = canvas.toDataURL("image/jpeg", 0.95);
                var decode = decodeBase64Image(base64);
                if (!decode || !decode.data) return;

                var newFilePath = EAGLE_THUMBNAIL_TEMP_PATH + "/" + guid() + ".jpg";
                fs.writeFileSync(newFilePath, decode.data);

                s.current.thumbnailAt = currentTime;
                // b1-9ae：后台窗已除名——backgroundWindowID undefined → 走 main（b1-9aa handler），
                // 与 bundle 26409 条件模式同型（undefined → send 分支）
                if ((window as any).backgroundWindowID === undefined) {
                    ipcRenderer.send('set-custom-thumbnail', {
                        item: s.current,
                        thumbnailPath: newFilePath,
                        width: s.current.width,
                        height: s.current.height
                    });
                }
                else {
                    ipcRenderer.sendTo((window as any).backgroundWindowID, 'set-custom-thumbnail', {
                        item: s.current,
                        thumbnailPath: newFilePath,
                        width: s.current.width,
                        height: s.current.height
                    });
                }
            } catch (err) {
                electronLog && electronLog.error(err.stack || err);
            }
        }
        else {
            s.current.thumbnailAt = currentTime;
            IPCHelper.send('regenerate-video-thumbnail', {
                video: s.current,
                startAt: currentTime
            });
        }
    }).apply(null, args);
  };

  // loadSubtitles（bundle 33199-33231；bundle 体内裸 item 在 EagleController 语境取
  // 当前项——菜单「載入字幕」只对详情视频出现，语义 = s.current）
  fns["loadSubtitles"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function () {
        const item = s.current;
        // 1. show file choose dialog
        dialog.showOpenDialog(currentWindow, {
            title: "Load Subtitles",
            properties: ['openFile'],
            filters: [
                { name: 'Subtitles', extensions: ['srt', 'vtt'] }
            ]
        }).then((result) => {
            if (!result.canceled) {
                const filePath = result.filePaths[0];
                const itemName = item.name;
                const ext = path.extname(filePath).toLowerCase();
                const rawPath = FileUrlHelper.getRawPath(item);
                const infoPath = path.dirname(rawPath);
                const subtitlePath = `${infoPath}/${itemName}${ext}`;

                fs.copyFile(filePath, subtitlePath, (err) => {
                    if (err) {
                        alert("An error ocurred updating the file" + err.message);
                    }
                    else {
                        const video = $(".detail-wrap video")[0];
                        if (video) {
                            const src = video.src;
                            const newSrc = src.replace(/v=\d+/, `v=${Date.now()}`);
                            video.src = newSrc;
                        }
                    }
                });
            }
        });
    }).apply(null, args);
  };

  // openFilesWithDefault（bundle 33310-33323；RecentFileManager → w.RecentFileManager
  // （b1-9w bundleGlobals 供给））
  let __cc_openFilesWithDefault: any = null;
  fns["openFilesWithDefault"] = function (...args) {
    if (!__cc_openFilesWithDefault) {
      __cc_openFilesWithDefault = _.debounce(function(files) {
        const s = getScope();
        if (!s) return;
        if ($(".swal2-container").length > 0) { return; }
        s.checkOperationSafety(function () {
            files.forEach(function (file, index) {
                if (!file || !file.id) return;
                if (index < 40) {
                    var folderPath = __lv_path.normalize(s.libraryPath + "/images/" + file.id + ".info/");
                    var rawPath = __lv_path.normalize(folderPath + file.name + "." + file.ext);
                    ipcRenderer.send('open-with-default', rawPath);
                }
            });
            RecentFileManager.addFiles(files);
        }, 10);
      }, 500, true);
    }
    return __cc_openFilesWithDefault(...args);
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

  // setCustomThumbnail（bundle 33458-33499）
  fns["setCustomThumbnail"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function () {
        let item = s.selected[0];
        if (!item || NOT_SUPPORT_CUSTEOM_THUMBNAIL_TYPES[item.ext]) return;
        dialog.showOpenDialog(currentWindow, {
            title: "Choose thumbnail",
            filters: [
                { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'bmp', 'webp'] },
            ],
            properties: ['openFile']
        }).then(result => {
            let paths = result.filePaths;
            if (!paths || paths.length === 0) return;
            let filePath = paths[0];
            let stat = fs.statSync(filePath);

            // 检查文件大小、尺寸，超过进行警告
            if (stat.size > 10000000) {
                swal({
                    html: `
                        <div class="alert">
                            <div class="alert-icon error"></div>
                            <h4 class="alert-title">Exceed the Maximum File Size</h4>
                            <p class="alert-desc">The file has not been added for it exceeds the maximum file size of 10MB.</p>
                        </div>
                    `,
                    showCloseButton: false, showCancelButton: true, allowOutsideClick: false, focusConfirm: true, focusCancel: false, padding: 24,
                    width: 400,
                    customClass: "alert-box",
                    cancelButtonColor: "#777777",
                    confirmButtonText: i18n.__("general.ok"),
                    cancelButtonText: i18n.__("general.cancel"),
                }).then(function () {});
                return;
            }

            // b1-9ae：同上——undefined → send 走 main（b1-9aa handler）
            if ((window as any).backgroundWindowID === undefined) {
                ipcRenderer.send('set-custom-thumbnail', {
                    item: item,
                    thumbnailPath: filePath
                });
            }
            else {
                ipcRenderer.sendTo((window as any).backgroundWindowID, 'set-custom-thumbnail', {
                    item: item,
                    thumbnailPath: filePath
                });
            }

        }).catch(err => {})
    }).apply(null, args);
  };

  // setCustomThumbnailFromClipboard（bundle 33501-33533；getClipboardImage →
  // w.getClipboardImage（b1-9w bundleGlobals 供给）；getExt → w.getExt（_getExt 已供））
  fns["setCustomThumbnailFromClipboard"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (async function() {
        let item = s.selected[0];
        if (!item || NOT_SUPPORT_CUSTEOM_THUMBNAIL_TYPES[item.ext]) return;
        let newFilePath = `${EAGLE_THUMBNAIL_TEMP_PATH}/${guid()}.png`;
        let clipboardData = await getClipboardImage();
        let filePath = clipboardData?.files[0];
        let image = clipboardData.image;

        if (filePath) {
            try {
                let ext = getExt({path: filePath});
                let support_ext = { jpg: true, png: true, gif: true, bmp: true, webp: true };
                if (support_ext[ext]) {
                    fse.copySync(filePath, newFilePath);
                    // b1-9ae：同上——undefined → send 走 main（b1-9aa handler）
                    if ((window as any).backgroundWindowID === undefined) {
                        ipcRenderer.send('set-custom-thumbnail', {
                            item: item,
                            thumbnailPath: newFilePath
                        });
                    }
                    else {
                        ipcRenderer.sendTo((window as any).backgroundWindowID, 'set-custom-thumbnail', {
                            item: item,
                            thumbnailPath: newFilePath
                        });
                    }
                    return;
                }
            }
            catch (err) {}
        }

        if (image) {
            let buffer = image.toPNG(100);
            fs.writeFileSync(newFilePath, buffer);
            // b1-9ae：同上——undefined → send 走 main（b1-9aa handler）
            if ((window as any).backgroundWindowID === undefined) {
                ipcRenderer.send('set-custom-thumbnail', {
                    item: item,
                    thumbnailPath: newFilePath
                });
            }
            else {
                ipcRenderer.sendTo((window as any).backgroundWindowID, 'set-custom-thumbnail', {
                    item: item,
                    thumbnailPath: newFilePath
                });
            }
        }
    }).apply(null, args);
  };

  // resetCustomThumbnail（bundle 33535-33540）
  fns["resetCustomThumbnail"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function () {
        delete s.selected[0].customThumbnail;
        s.regenerateThumbnailQueue.push(s.selected[0]);
        s.$evalAsync();
        ayncsImagesGenerateThumbnail([s.selected[0]]);
    }).apply(null, args);
  };

  // getNext（bundle 36374-36381）
  fns["getNext"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function () {
        var selection = s.getSelection();
        var start = selection.start;
        var end = selection.end;
        return s.allData[end + 1] || s.allData[end - 1];
    }).apply(null, args);
  };

  // changeImagesBackground（bundle 40008-40022）
  fns["changeImagesBackground"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function (images, color) {
        if (!images || images.length === 0) return;
        for (let i = 0; i < images.length; i++) {
            var image = images[i];
            if (!color) {
                delete image.background;
            }
            else {
                image.background = color;
            }
        }
        ayncsImagesChange(images);
        s.updateItemsView(s.selected);
        try { electronLog && electronLog.info(`[app] Change ${images.length} files thumbnail background to: ${color}`); } catch (err) {};
    }).apply(null, args);
  };

  // newFolderWidthSelection（bundle 40442-40531 全体，含 sanitizeFolderName 内层）
  fns["newFolderWidthSelection"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function () {
        swal({
            html: `
                <div class="alert">
                    <div class="alert-icon create"></div>
                    <h4 class="alert-title">${i18n.__("dialog.createFolderWithItems.title")}</h4>
                    <p class="alert-desc">${i18n.__("dialog.createFolderWithItems.desc")}</p>
                </div>
            `,
            showCloseButton: false, showCancelButton: true, allowOutsideClick: false, focusConfirm: true, focusCancel: false, padding: 24,
            width: 400,
            customClass: "alert-box",
            cancelButtonColor: "#777777",
            confirmButtonText: i18n.__("dialog.createFolderWithItems.createBtn"),
            cancelButtonText: i18n.__("general.cancel"),
            input: 'text',
            inputPlaceholder: "",
            inputValue: '',
        }).then(function (name) {
            function sanitizeFolderName(folderName) {
                if (typeof folderName !== 'string') return '';

                // 移除 tab，統一空白
                folderName = folderName.replace(/\t/g, ' ').replace(/\s+/g, ' ').trim();

                if (process.platform === 'darwin') {
                    // macOS：僅移除冒號與斜線
                    folderName = folderName
                        .replace(/[:\/\\]/g, ' ')  // 移除冒號、正反斜線
                        .trim();
                } else {
                    // Windows：移除非法字元與控制碼
                    folderName = folderName
                        .replace(/[<>:"\/\\|?*\x00-\x1F]/g, '')  // 非法字元與控制碼
                        .replace(/[ ]+$/, '')                    // 結尾空白
                        .replace(/[.]+$/, '')                    // 結尾句點
                        .trim();

                    // 避免使用保留名稱
                    const reservedNames = new Set([
                        'CON', 'PRN', 'AUX', 'NUL',
                        'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
                        'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'
                    ]);
                    if (reservedNames.has(folderName.toUpperCase())) {
                        folderName += '_';
                    }
                }

                return folderName;
            }

            var folderName = sanitizeFolderName(name);

            var folderId = guid();
            var folder = {
                id: folderId,
                name: folderName,
                images: [],
                folders: [],
                modificationTime: Date.now(),
                editable: false,
                imagesMappings: {},
                tags: [],
                children: [],
                isExpand: true,
            };
            s.folders.splice(s.folders.length, 0, folder);
            s.folderMappings[folder.id] = folder;
            s.updateSidebarList();
            s.addToRecentFolders([folder.id]);

            // 添加圖片
            s.selected.forEach(function(image) {
                if (!image.folders) image.folders = [];
                image.folders.push(folderId);
            });
            ayncsImagesChange(s.selected);
            hiddenByCurrentFilter(s.selected);
            s.calculateImageBinding({ ignoreSort: true }, function() {
                s.rebindRefresh();
            });
            s.openFolder(folder);
            setTimeout(function() {
                s.saveFolder();
            }, 1000);
            electronLog && electronLog.info(`[app] Create new folder ${folder.name}(${folder.id}) with ${s.selected.length} files`);
            analytics.event('Folder', 'Create-With-Images', folder.name);
        });
    }).apply(null, args);
  };

  // addToLastUsedFolder（bundle 43211-43251 全体）
  fns["addToLastUsedFolder"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function () {
        s.checkOperationSafety(function () {
            var recentFolders = s.getRecentFolders();
            if (!recentFolders || recentFolders.length === 0) return;
            if (!recentFolders[0] || !s.selected[0]) return;
            var folder = recentFolders[0];
            s.addToRecentFolders([folder.id]);
            s.addImagesToFolder(s.selected, folder);
            if (s.viewMode === 'unfiled') {
                var itemElements = s.getSelectedItemElements();
                s.$root.$broadcast("gl:removeItems", itemElements);
                // 自動選取下一個圖片，如果沒有下一個，選上一個，都沒有就空
                s.lastIndex = s.getSelection().start;
                var next = s.allData[s.lastIndex + s.selected.length];
                var prev = s.allData[s.lastIndex - 1];
                if (next) {
                    s.selected = [next];
                    s.current = next;
                }
                else if (prev) {
                    s.selected = [prev];
                    s.current = prev;
                }
                else {
                    s.selected = [];
                    s.leaveDetailMode();
                }
            }
        });
    }).apply(null, args);
  };

  // openInPreviewWindow（bundle 43252-43263；openInNewWindow → w.openInNewWindow
  // （b1-9w bundleGlobals 供给））
  fns["openInPreviewWindow"] = function (...args) {
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
  };

  // copyAsProperity（bundle 46496-46512）
  fns["copyAsProperity"] = function (...args) {
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
  };

  // copyAsFolderPath（bundle 46514-46531）
  fns["copyAsFolderPath"] = function (...args) {
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
  };

  // copyAsThumbnail（bundle 46554-46562）
  fns["copyAsThumbnail"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function () {
        // b1-9ae：同上——undefined → send 走 main（b1-9aa copy-thumbnails handler → CF_HDROP）
        if ((window as any).backgroundWindowID === undefined) {
            ipcRenderer.send('copy-thumbnails', s.selected);
        }
        else {
            ipcRenderer.sendTo((window as any).backgroundWindowID, 'copy-thumbnails', s.selected);
        }
        setTimeout(function () {
            s.notify({
                message: $filter('i18n')("previewWindow.copied"),
                duration: 1000
            });
        }, 150);
    }).apply(null, args);
  };

  // copyAsBase64（bundle 46564-46593）
  fns["copyAsBase64"] = function (...args) {
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
  };

  // onSidebarResize（bundle 21138-21150 逐字；jQuery-UI resizable 的 resize 回调面，
  // 挂载侧 = BodyBindings 的 #sidebar resizable 接线（原 index.html resizable 指令
  // bundle 70423：maxWidth 600 / minWidth 200 / handles 'e'））
  let __lv_onSidebarResizeTimeout: any = null;
  fns["onSidebarResize"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function(e, ui) {
        if (ui && ui.size.width >= 200) {
            s.containerSize.sidebar = ui.size.width;
            s.$root.$broadcast('$$rebind::refreshContainSize');
            s.updateSliderPosition();
            clearTimeout(__lv_onSidebarResizeTimeout);
            __lv_onSidebarResizeTimeout = setTimeout(function () {
                s.relayout();
                s.offsetScrollbar(30);
                localStorage.setItem("eagle.containerSize.sidebar", ui.size.width);
            }, 500);
        }
    }).apply(null, args);
  };

  // ── b1-9ao：侧栏 expand 右键菜单族（bundle 38578-38658 + toggle 家族 38730-38823 逐字）──
  // 台账⑨首批：Sidebar.tsx:360 已消费 openFolderExpandContextMenu 但此前全仓无定义（活断）。
  // ContextMenu.open（已删 DOM widget）→ 等价广播 CONTEXTMENU.OPEN（ContextMenuPanel 经
  // getBodyScope().$on 监听，scopeShim $broadcast 含自身监听者）。onOpened/onClosed 的
  // $(event.delegateTarget) → React synthetic currentTarget classList。

  // controller 闭包函数 toggleAllFolders（bundle 38730-38735 逐字）
  function toggleAllFolders(folders: any, isExpand: any) {
    folders.forEach(function (f: any) {
      if (f.isExpand !== isExpand) {
        f.isExpand = isExpand;
        localStorage.setItem("eagle.sidebar.folder.expand." + f.id, f.isExpand);
      }
    });
    s.updateSidebarList();
  }

  // controller 闭包函数 toggleCurrentLevelFolders（bundle 38740-38746 逐字）
  function toggleCurrentLevelFolders(folders: any, isExpand: any) {
    folders.forEach(function (f: any) {
      if (f.isExpand !== isExpand) {
        f.isExpand = isExpand;
        localStorage.setItem("eagle.sidebar.folder.expand." + f.id, f.isExpand);
      }
    });
    s.updateSidebarList();
  }

  // controller 闭包函数 toggleAllSmartFolders（bundle 38831-38839 逐字；eagle.utils.tree.walk）
  function toggleAllSmartFolders(smartFolders: any, isExpand: any) {
    const walk = (w.eagle && w.eagle.utils && w.eagle.utils.tree && w.eagle.utils.tree.walk) || null;
    if (walk) {
      walk(smartFolders, 'children', function (f: any, parent: any) {
        if (f.isExpand !== isExpand) {
          f.isExpand = isExpand;
          localStorage.setItem("eagle.sidebar.smartFolder.expand." + f.id, f.isExpand);
        }
      });
    } else {
      // 后备：等价平铺递归（walk 缺席时不静默丢展开态）
      const walkAll = (nodes: any) => {
        (nodes || []).forEach(function (f: any) {
          if (f.isExpand !== isExpand) {
            f.isExpand = isExpand;
            localStorage.setItem("eagle.sidebar.smartFolder.expand." + f.id, f.isExpand);
          }
          walkAll(f.children);
        });
      };
      walkAll(smartFolders);
    }
    s.updateSidebarList();
  }

  // controller 闭包函数 toggleCurrentLevelSmartFolders（bundle 38841-38849 逐字）
  function toggleCurrentLevelSmartFolders(smartFolders: any, isExpand: any) {
    smartFolders.forEach(function (f: any) {
      if (f.isExpand !== isExpand) {
        f.isExpand = isExpand;
        localStorage.setItem("eagle.sidebar.smartFolder.expand." + f.id, f.isExpand);
      }
    });
    s.updateSidebarList();
  }

  // toggleSelectFolder（bundle 38750-38753 逐字）
  fns["toggleSelectFolder"] = function (...args) {
    const s2 = getScope();
    if (!s2) return;
    return (function (event, folderArg) {
      var expand = !folderArg.isExpand;
      var folders = folderArg.children;
      folderArg.isExpand = expand;
      toggleCurrentLevelFolders(folders, expand);
    }).apply(null, args);
  };

  // toggleCurrentLevelFolders（bundle 38757-38765 逐字）
  fns["toggleCurrentLevelFolders"] = function (...args) {
    const s2 = getScope();
    if (!s2) return;
    return (function (event, folderArg) {
      var expand = !folderArg.isExpand;
      var parent = s2.folderMappings[folderArg.parent];
      var folders = s2.folders;
      if (parent && parent.children) {
        folders = parent.children;
      }
      toggleCurrentLevelFolders(folders, expand);
    }).apply(null, args);
  };

  // toggleAllFolderExpand（bundle 38767-38780 逐字）
  fns["toggleAllFolderExpand"] = function (...args) {
    const s2 = getScope();
    if (!s2) return;
    return (function (event, folderArg) {
      var folder = folderArg || s2.currentFolder;
      if (s2.folders && s2.folders.length > 0) {
        var expand = !s2.folders[0].isExpand;
        if (folder) {
          setTimeout(function () { s2.changeSidebarIndex(folder); s2.$evalAsync(); }, 100);
          if (folder.parent) {
            var parent = s2.folderMappings[folder.parent];
            if (parent) {
              expand = !parent.isExpand;
            }
          }
        }
        if (!expand) s2.sidebarIndex = 0;
        toggleAllFolders(s2.folders, expand);
        s2.updateSidebarList();
      }
    }).apply(null, args);
  };

  // toggleSelectSmartFolder（bundle 38786-38790 逐字）
  fns["toggleSelectSmartFolder"] = function (...args) {
    const s2 = getScope();
    if (!s2) return;
    return (function (event, smartFolderArg) {
      var expand = !smartFolderArg.isExpand;
      var smartFolders = smartFolderArg.children;
      smartFolderArg.isExpand = expand;
      toggleCurrentLevelSmartFolders(smartFolders, expand);
    }).apply(null, args);
  };

  // toggleCurrentLevelSmartFolders（bundle 38792-38800 逐字）
  fns["toggleCurrentLevelSmartFolders"] = function (...args) {
    const s2 = getScope();
    if (!s2) return;
    return (function (event, smartFolderArg) {
      var expand = !smartFolderArg.isExpand;
      var parent = s2.smartFolderMappings[smartFolderArg.parent];
      var smartFolders = s2.smartFolders;
      if (parent && parent.children) {
        smartFolders = parent.children;
      }
      toggleCurrentLevelSmartFolders(smartFolders, expand);
    }).apply(null, args);
  };

  // toggleAllSmartFolderExpand（bundle 38801-38815 逐字）
  fns["toggleAllSmartFolderExpand"] = function (...args) {
    const s2 = getScope();
    if (!s2) return;
    return (function (event, smartFolderArg) {
      var smartFolder = smartFolderArg || s2.currentSmartFolder;
      if (s2.smartFolders && s2.smartFolders.length > 0) {
        var expand = !s2.smartFolders[0].isExpand;
        if (smartFolder) {
          setTimeout(function () { s2.changeSidebarIndex(smartFolder); s2.$evalAsync(); }, 100);
          if (smartFolder.parent) {
            var parent = s2.smartFolderMappings[smartFolder.parent];
            if (parent) {
              expand = !parent.isExpand;
            }
          }
        }
        if (!expand) s2.sidebarIndex = 0;
        toggleAllSmartFolders(s2.smartFolders, expand);
        s2.updateSidebarList();
      }
    }).apply(null, args);
  };

  // toggleAllFolders（bundle 38816-38823 逐字；$scope 委托面）
  fns["toggleAllFolders"] = function (...args) {
    const s2 = getScope();
    if (!s2) return;
    return (function () {
      if (s2.currentSmartFolder) {
        s2.toggleAllSmartFolderExpand();
      }
      else {
        s2.toggleAllFolderExpand();
      }
    }).apply(null, args);
  };

  // openFolderExpandContextMenu（bundle 38578-38618 逐字；ContextMenu.open → 等价广播）
  fns["openFolderExpandContextMenu"] = function (...args) {
    const s2 = getScope();
    if (!s2) return;
    return (function (eventArg, folderArg) {
      eventArg.stopPropagation();
      const folderEl = eventArg && eventArg.currentTarget;
      s2.$broadcast('CONTEXTMENU.OPEN', {
        items: [
          {
            label: i18n.__('Context.Expand.Folder'),
            icon: 'ic-expand.svg',
            click: () => {
              s2.toggleSelectFolder(eventArg, folderArg);
              s2.$evalAsync();
            }
          },
          {
            label: i18n.__('Context.Expand.SameLevel.Folders'),
            icon: 'ic-expand-same.svg',
            click: () => {
              s2.toggleCurrentLevelFolders(eventArg, folderArg);
              s2.$evalAsync();
            }
          },
          {
            label: i18n.__('Context.Expand.All.Folders'),
            icon: 'ic-expand-all.svg',
            click: () => {
              s2.toggleAllFolderExpand(eventArg, folderArg);
              s2.$evalAsync();
            }
          },
        ],
        showSearch: false,
        onOpened: () => {
          folderArg.isSelected = true;
          try { folderEl && folderEl.classList && folderEl.classList.add('context-activate'); } catch (err) { /* 委托元素缺席不阻塞 */ }
          s2.$evalAsync();
        },
        onClosed: () => {
          folderArg.isSelected = false;
          try { folderEl && folderEl.classList && folderEl.classList.remove('context-activate'); } catch (err2) { /* 同上 */ }
          s2.$evalAsync();
        }
      });
    }).apply(null, args);
  };


  // ── b1-9ap：台账⑨主菜单第一批——openFolderContextMenu 及其依赖面（bundle 39012-39549
  //    + 依赖 fns 逐字移植；$scope→s、$rootScope.$broadcast→s.$root 广播总线语义、
  //    angular.copy/extend→JSON 深拷/Object.assign、eagle.utils.tree.walk→treeWalkSafe）──

  // controller 闭包函数 reorderFolderByTitle（bundle 41765-41781 逐字）
  function reorderFolderByTitleClosure(folders: any, reverse: any) {
    folders = folders.sort(function (a: any, b: any) {
      try {
        var na = a.name.toLowerCase();
        var nb = b.name.toLowerCase();
        if (na && nb) {
          return na.localeCompare(nb, (window as any).languageBCP, { numeric: true });
        }
      }
      catch (err) {}
    });

    if (reverse) {
      folders = folders.reverse();
    }
  }

  // controller 闭包函数 removeFolder（bundle 42050-42205 逐字；angular.copy→JSON 深拷）
  function removeFolderClosure(folder: any, { isDeleteImages, ignoreSelectNext, ignoreRestore }: any) {
    const s = getScope();
    const w = window as any;

    // 支持復原文件夾
    var originalFolders: any[] = [];
    var originalImages: any[] = [];
    var originalImageFolders: any[] = [];
    var folderId = folder.id;
    if (!ignoreRestore) {
      w.cloneTree(originalFolders, s.folders, true);
    }

    // 找到包含 folder 的 list
    var parent = s.folderMappings[folder.parent];
    var children = (parent) ? parent.children : s.folders;
    if (!Array.isArray(children)) return;

    var index = children.indexOf(folder);
    if (index === -1) return;

    // 移除 folder
    children.splice(index, 1);

    // 删除包含 folder.id 的图片
    if (s.raw && s.raw.length > 0) {
      var changed: any[] = [];
      for (var rindex = s.raw.length - 1; rindex >= 0; rindex--) {
        var image = s.raw[rindex];
        if (image.folders) {
          var idx = image.folders.indexOf(folder.id);
          if (idx > -1) {
            if (isDeleteImages) {
              // 如果圖片還存在於其它文件夾，就不丟到垃圾桶
              if (image.folders && image.folders.length === 1) {
                image.isDeleted = true;
              }
            }
            originalImageFolders.push(JSON.parse(JSON.stringify(image.folders)));
            image.folders.splice(idx, 1);
            changed.push(image);
            originalImages.push(image);
          }
        }
      }
      w.ayncsImagesChange(changed);
      w.hiddenByCurrentFilter(changed);
    }

    // 同时删除子文件夹图片
    if (folder.children) {
      treeWalkSafe(folder.children, 'children', function (child: any, parent2: any) {
        if (s.raw && s.raw.length > 0) {
          var changed2: any[] = [];
          for (var rindex2 = s.raw.length - 1; rindex2 >= 0; rindex2--) {
            var image2 = s.raw[rindex2];
            if (image2.folders) {
              var idx2 = image2.folders.indexOf(child.id);
              if (idx2 > -1) {
                if (isDeleteImages) {
                  // 如果圖片還存在於其它文件夾，就不丟到垃圾桶
                  if (image2.folders && image2.folders.length === 1) {
                    image2.isDeleted = true;
                  }
                }
                originalImageFolders.push(JSON.parse(JSON.stringify(image2.folders)));
                image2.folders.splice(idx2, 1);
                changed2.push(image2);
                originalImages.push(image2);
              }
            }
          }
          w.ayncsImagesChange(changed2);
          w.hiddenByCurrentFilter(changed2);
        }
      });
    }

    // 开启下一个文件夹（优先兄弟 → 父 → All）
    if (!ignoreSelectNext) {
      if (children.length > 0) {
        var next = children[index] || children[index - 1] || children[0];
        s.openFolder(next);
      } else if (parent) {
        s.openFolder(parent);
      } else {
        s.openAll();
      }
    }
    else {
      s.rebindRefresh();
    }

    // 播放删除音效
    if (s.$root.preferences.notification.soundEffect.enable != 'false' && s.$root.preferences.notification.soundEffect.when.deleteFolder == 'true') {
      s.removeSound && s.removeSound.play && s.removeSound.play();
    }

    w.QuickAccessManager.remove('folder', folder);
    if (folder.children && s.quickAccess.length > 0) {
      treeWalkSafe(folder.children, 'children', function (child: any, parent3: any) {
        w.QuickAccessManager.remove('folder', child);
      });
    }
    s.updateSidebarList();

    // 移除记录
    delete s.folderMappings[folder.id];
    void folderId;
    s.calculateImageBinding({ ignoreSort: true }, function () {
      s.$evalAsync();
      s.saveFolderDebounce && s.saveFolderDebounce();
      if (isDeleteImages) { w.electronLog && w.electronLog.info(`[app] Delete folder: ${folder.name}(${folder.id}), contains ${originalImages.length} files, all remain ${s.all.length} files, trash remain: ${s.trash.length} files`); }
      else { w.electronLog && w.electronLog.info(`[app] Delete folder: ${folder.name}(${folder.id}), just remove folder not contains ${originalImages.length} files, all remain ${s.all.length} files, trash remain: ${s.trash.length} files`); }
    });

    if (!ignoreRestore) {
      var message = $filter('i18n')('notify.folder.remove', [
        { property: 'folder', value: folder.name },
      ]);
      (s.$root.notify || s.notify).call(s.$root, {
        message: message,
        duration: 7000,
      }, function () {
        s.folders = originalFolders;

        treeWalkSafe(s.folders, 'children', function (folder3: any, parent3: any) {
          if (!folder3.children) { folder3.children = []; }
          if (folder3 && parent3) { folder3.parent = parent3.id; }
          s.folderMappings[folder3.id] = folder3;
        });

        for (var i = originalImages.length - 1; i >= 0; i--) {
          var image3 = originalImages[i];
          var imageOriginalFolders = originalImageFolders[i];
          if (image3.isDeleted && imageOriginalFolders && imageOriginalFolders.length > 0) {
            image3.isDeleted = false;
          }
          image3.folders = JSON.parse(JSON.stringify(imageOriginalFolders));
        }
        s.updateSidebarList();
        s.rebindRefresh();
        w.ayncsImagesChange(originalImages);
      });
    }
  }

  // checkOperationSafety2（bundle 26824-26852 逐字）
  fns["checkOperationSafety2"] = function (...args) {
    const s = getScope();
    if (!s) return;
    return ((count: any, callback: any, amount: any = 100) => {
      try {
        if (count >= amount) {
          var html = $filter('i18n')('Dialog.BulkAction.Descript', [
            { property: 'count', value: count },
          ]);
          swal({
            html: `
                            <div class="alert">
                                <div class="alert-icon warning"></div>
                                <h4 class="alert-title">${i18n.__('Dialog.BulkAction.Title')}</h4>
                                <p class="alert-desc">${html}</p>
                            </div>
                        `,
            showCloseButton: false, showCancelButton: true, allowOutsideClick: false, focusConfirm: false, focusCancel: false, padding: 24,
            allowEnterKey: false,
            width: 400,
            customClass: 'alert-box',
            cancelButtonColor: '#777777',
            confirmButtonText: i18n.__('Dialog.BulkAction.Button'),
            cancelButtonText: i18n.__('general.cancel'),
          }).then(function (result: any) {
            callback && callback();
            s.$evalAsync();
          });
        }
        else {
          callback && callback();
        }
      }
      catch (err) {
        callback && callback();
      }
    }).apply(null, args);
  };

  // refreshSubfolderList（bundle 27462-27490 逐字）——b1-9al 摘除 bundle 后悬空供给
  //（newFolder/removeFolder 回调消费），本批补移植
  fns["refreshSubfolderList"] = function (...args) {
    const s = getScope();
    if (!s) return;
    return (function () {
      // 过滤子文件夹
      if (s.currentFolder) {
        let subFolders: any[] = [];
        if (s.showSubfolderContent) {
          s.subFolders = getAllChildFolder(s.currentFolder);
          if (s.subFolderSortableOptions) s.subFolderSortableOptions.disabled = true;
        }
        else {
          s.subFolders = s.currentFolder.children;
          if (s.subFolderSortableOptions) s.subFolderSortableOptions.disabled = false;
        }
        if (s.keyword) {
          s.subFolders = s.subFolders.filter(function (folder: any) {
            if (folder.name.toLowerCase().indexOf(s.keyword.toLowerCase()) > -1) {
              return true;
            }
            if (folder && folder.tags) {
              var folderTags = folder.tags.join('');
              if (folderTags.toLowerCase().indexOf(s.keyword.toLowerCase()) > -1) {
                return true;
              }
            }
          });
          if (s.subFolderSortableOptions) s.subFolderSortableOptions.disabled = true;
        }
      }
      else {
        s.subFolders = [];
      }
    }).apply(null, args);
  };

  // setFolderPassword / changeFolderPassword / resetFolderPassword（bundle 41324-41349 逐字）
  fns["setFolderPassword"] = function (...args) {
    const s = getScope();
    if (!s) return;
    return (function (folder: any) {
      var f = folder || s.currentFolder;
      if (!f) return;
      s.$root.$broadcast('SET-FOLDER-PASSWORD', { folder: f, mode: 'new' });
    }).apply(null, args);
  };

  fns["changeFolderPassword"] = function (...args) {
    const s = getScope();
    if (!s) return;
    return (function (folder: any) {
      var f = folder || s.currentFolder;
      if (!f) return;
      s.$root.$broadcast('SET-FOLDER-PASSWORD', { folder: f, mode: 'change' });
    }).apply(null, args);
  };

  fns["resetFolderPassword"] = function (...args) {
    const s = getScope();
    if (!s) return;
    return (function (folder: any) {
      var f = folder || s.currentFolder;
      if (!f) return;
      s.$root.$broadcast('SET-FOLDER-PASSWORD', { folder: f, mode: 'reset' });
    }).apply(null, args);
  };

  // setFoldersOrder + setFolderOrder（bundle 41351-41377 逐字）
  fns["setFoldersOrder"] = function (...args) {
    const s = getScope();
    if (!s) return;
    return (function (folders: any, orderBy: any, ignoreReload: any) {
      folders.forEach(function (folder: any) {
        s.setFolderOrder(folder, orderBy);
      });
      s.sortRawData(orderBy);
      s.rebindRefresh();
      s.$evalAsync();
    }).apply(null, args);
  };

  fns["setFolderOrder"] = function (...args) {
    const s = getScope();
    if (!s) return;
    return (function (folder: any, orderBy: any, ignoreReload: any) {
      if (!folder) return;
      if (!orderBy) {
        delete folder.orderBy;
        delete folder.sortIncrease;
      }
      else {
        folder.orderBy = orderBy;
        if (folder.sortIncrease === undefined) {
          folder.sortIncrease = true;
        }
      }
      if (s.currentFolder === folder && !ignoreReload) {
        s.reload();
      }
      s.saveFolder();
    }).apply(null, args);
  };

  // setFoldersSortIncrease + setFolderSortIncrease（bundle 41379-41395 逐字）
  fns["setFoldersSortIncrease"] = function (...args) {
    const s = getScope();
    if (!s) return;
    return (function (folders: any, sortIncrease: any, ignoreReload: any) {
      folders.forEach(function (folder: any) {
        s.setFolderSortIncrease(folder, sortIncrease);
      });
    }).apply(null, args);
  };

  fns["setFolderSortIncrease"] = function (...args) {
    const s = getScope();
    if (!s) return;
    return (function (folder: any, sortIncrease: any, ignoreReload: any) {
      if (!folder) return;
      folder.sortIncrease = !!sortIncrease;
      if (s.currentFolder === folder && !ignoreReload) {
        s.reload();
      }
      s.saveFolder();
    }).apply(null, args);
  };

  // lockFolder（bundle 41465-41478 逐字）
  fns["lockFolder"] = function (...args) {
    const s = getScope();
    if (!s) return;
    return (function (event: any, f: any) {
      var folder = f || s.currentFolder;
      if (!folder) return;
      if (!folder.isUnLock || !folder.password) return;
      delete folder.isUnLock;
      s.isLoading = true;
      s.selected = [];
      s.updateSidebarList();
      s.calculateImageBinding({ ignoreSort: true }, function () {
        s.rebindRefresh();
        s.updateSelection();
        s.isLoading = false;
      });
    }).apply(null, args);
  };

  // settingFolder（bundle 41571-41593 逐字）
  fns["settingFolder"] = function (...args) {
    const s = getScope();
    if (!s) return;
    return (function (event: any, folder: any) {
      var f = folder;
      if (!f) {
        f = s.currentFolder || s.currentSmartFolder;
        if (s.selectedFolderMappings && Object.keys(s.selectedFolderMappings).length > 0) {
          var selectedFolders = Object.keys(s.selectedFolderMappings).map(function (key) {
            return key;
          });
          var folderId = selectedFolders[0];
          if (folderId && s.folderMappings[folderId]) {
            f = s.folderMappings[folderId];
          }
        }
      }
      if (!f) return;

      if (f.conditions) {
        s.$root.$broadcast('EDIT.SMART.FOLDER', f);
      }
      else {
        s.$root.$broadcast('FOLDER_SETTINGS', f);
      }
    }).apply(null, args);
  };

  // renameFolder（bundle 41617-41629 逐字）
  fns["renameFolder"] = function (...args) {
    const s = getScope();
    if (!s) return;
    return (function (event: any, folder: any) {
      s.viewMode = undefined;
      s.currentFolder = folder;
      folder.editable = true;
      folder.newFolderName = folder.name;
      setTimeout(function () {
        wQueryFocusFolderInput(folder.id);
      }, 100);
      setTimeout(function () {
        wQueryFocusFolderInput(folder.id);
      }, 200);
    }).apply(null, args);
  };

  // batchRenameFolders（bundle 41631-41641 逐字）
  fns["batchRenameFolders"] = function (...args) {
    const s = getScope();
    if (!s) return;
    return (function () {
      var selectedFolders = s.$root.selectedFolders;
      if (selectedFolders.length === 0) return;

      s.$root.$broadcast('OPEN_RENAME', {
        type: 'FOLDER',
        folders: selectedFolders
      });
    }).apply(null, args);
  };

  // reorderFolderByTitle / reorderAllFolderByTitle（bundle 41782-41829 逐字）
  fns["reorderFolderByTitle"] = function (...args) {
    const s = getScope();
    if (!s) return;
    return (function (folders: any, reverse: any) {
      swal({
        html: `
                    <div class="alert">
                        <div class="alert-icon warning"></div>
                        <h4 class="alert-title">${i18n.__('dialog.reorderFolder.title')}</h4>
                    </div>
                `,
        showCloseButton: false, showCancelButton: true, allowOutsideClick: false, focusConfirm: true, focusCancel: false, padding: 24,
        width: 400,
        customClass: 'alert-box',
        cancelButtonColor: '#777777',
        confirmButtonText: i18n.__('dialog.reorderFolder.sortBtn'),
        cancelButtonText: i18n.__('general.cancel'),
      }).then(function () {
        reorderFolderByTitleClosure(folders, reverse);
        s.updateSidebarList();
        s.saveFolder();
        s.$evalAsync();
        try { wElectronLogInfo('[app] Sort folders by folder name'); } catch (err) {}
      });
    }).apply(null, args);
  };

  fns["reorderAllFolderByTitle"] = function (...args) {
    const s = getScope();
    if (!s) return;
    return (function (reverse: any) {
      swal({
        html: `
                    <div class="alert">
                        <div class="alert-icon warning"></div>
                        <h4 class="alert-title">${i18n.__('dialog.reorderFolder.title')}</h4>
                    </div>
                `,
        showCloseButton: false, showCancelButton: true, allowOutsideClick: false, focusConfirm: true, focusCancel: false, padding: 24,
        width: 400,
        customClass: 'alert-box',
        cancelButtonColor: '#777777',
        confirmButtonText: i18n.__('dialog.reorderFolder.sortBtn'),
        cancelButtonText: i18n.__('general.cancel'),
      }).then(function () {
        reorderFolderByTitleClosure(s.folders, reverse);
        treeWalkSafe(s.folders, 'children', function (folder: any, parent: any) {
          reorderFolderByTitleClosure(folder.children, reverse);
        });
        s.updateSidebarList();
        s.saveFolder();
        s.$evalAsync();
        try { wElectronLogInfo('[app] Sort all folders by folder name'); } catch (err) {}
      });
    }).apply(null, args);
  };

  // cloneFolder（bundle 41720-41763 逐字；angular.copy→JSON 深拷）
  fns["cloneFolder"] = function (...args) {
    const s = getScope();
    if (!s) return;
    return (function (event: any, folder: any) {
      var resetFolder = function (fd: any) {
        delete fd.$$hashKey;
        fd.covers = [];
        fd.images = [];
        fd.imagesMappings = {};
        fd.imageCount = 0;
        fd.modificationTime = Date.now();
        fd.password = '';
        fd.passwordTips = '';
        delete fd.descendantImageCount;
      };
      var newFolder = JSON.parse(JSON.stringify(folder));
      resetFolder(newFolder);

      var children = s.folders;
      if (folder.parent && s.folderMappings[folder.parent]) {
        let parent = s.folderMappings[folder.parent];
        children = parent.children;
      }
      var idx = children.indexOf(folder);
      newFolder.id = guid();
      newFolder.children = newFolder.children || [];

      treeWalkSafe(newFolder.children, 'children', function (sf: any, parent: any) {
        let newId = guid();
        sf.id = newId;
        sf.children = sf.children || [];
        if (parent) {
          sf.parent = parent.id;
        }
        resetFolder(sf);
        s.folderMappings[newId] = sf;
      });

      if (idx > -1) {
        children.splice(idx + 1, 0, newFolder);
        s.folderMappings[newFolder.id] = newFolder;
        s.updateSidebarList();
        s.saveFolder();
        try { wElectronLogInfo(`[app] Clone folder: ${folder.name}(${folder.id}), new folder: ${newFolder.name}(${newFolder.id})`); } catch (err) {}
      }
      s.calculateImageBinding({ ignoreSort: true }, function () {});
    }).apply(null, args);
  };


  // changeFolderIcon / changeSelectedFoldersIcon（bundle 39981-40006 逐字）
  fns["changeFolderIcon"] = function (...args) {
    const s = getScope();
    if (!s) return;
    return (function (event: any, folder: any, icon: any) {
      const w = window as any;
      if (!icon) {
        delete folder.icon;
      }
      else {
        folder.icon = icon;
      }
      s.saveFolder();
      try { w.electronLog && w.electronLog.info(`[app] Change folder: ${folder.name}(${folder.id}) icon to: ${icon}`); } catch (err) {}
      w.analytics.event('ChangeIcon', 'Folder', icon);
    }).apply(null, args);
  };

  fns["changeSelectedFoldersIcon"] = function (...args) {
    const s = getScope();
    if (!s) return;
    return (function (event: any, icon: any) {
      const w = window as any;
      if (s.$root.selectedFolders.length === 0) return;
      s.$root.selectedFolders.forEach(function (folder: any) {
        if (!icon) {
          delete folder.icon;
        }
        else {
          folder.icon = icon;
        }
      });
      s.saveFolder();
      try { w.electronLog && w.electronLog.info(`[app] Change ${s.$root.selectedFolders.length} folders icon to: ${icon}`); } catch (err) {}
      w.analytics.event('ChangeIcon', 'Folder', icon);
    }).apply(null, args);
  };

  // changeFolderColor / changeSelectedFoldersColor（bundle 40040-40067 逐字）
  fns["changeFolderColor"] = function (...args) {
    const s = getScope();
    if (!s) return;
    return (function (event: any, folder: any, color: any) {
      const w = window as any;
      if (!color) {
        delete folder.iconColor;
      }
      else {
        folder.iconColor = color;
      }
      s.updateSidebarList();
      s.saveFolder();
      try { w.electronLog && w.electronLog.info(`[app] Change folder: ${folder.name}(${folder.id}) icon color to: ${color}`); } catch (err) {}
      w.analytics.event('ChangeColor', 'Folder', color);
    }).apply(null, args);
  };

  fns["changeSelectedFoldersColor"] = function (...args) {
    const s = getScope();
    if (!s) return;
    return (function (event: any, color: any) {
      const w = window as any;
      if (s.$root.selectedFolders.length === 0) return;
      s.$root.selectedFolders.forEach(function (folder: any) {
        if (!color) {
          delete folder.iconColor;
        }
        else {
          folder.iconColor = color;
        }
      });
      s.updateSidebarList();
      s.saveFolder();
      try { w.electronLog && w.electronLog.info(`[app] Change ${s.$root.selectedFolders.length} folders icon color to: ${color}`); } catch (err) {}
      w.analytics.event('ChangeColor', 'Folder', color);
    }).apply(null, args);
  };

  // folderExportAsPack（bundle 40085-40134 逐字；angular.extend→Object.assign）
  fns["folderExportAsPack"] = function (...args) {
    const s = getScope();
    if (!s) return;
    return (function (event: any, folder: any) {
      const w = window as any;
      var images: any[] = [];
      var f: any = {};
      for (var rindex = s.raw.length - 1; rindex >= 0; rindex--) {
        try {
          var image = s.raw[rindex];
          if (image.isDeleted) continue;
          var isContain = image.folders.indexOf(folder.id) > -1;
          if (!isContain) {
            treeWalkSafe(folder.children, 'children', function (child: any, parent: any) {
              if (image.folders.indexOf(child.id) > -1) {
                isContain = true;
                return;
              }
            });
          }
          if (isContain) {
            images.push(image);
          }
        }
        catch (err) {}
      }
      Object.assign(f, folder);
      f.images = images;
      var defaultPath = w.path.join('*/', 'Untitled' + '.eaglepack');
      if (folder) {
        defaultPath = w.path.join('*/', folder.name.replace(/^\./, '') + '.eaglepack');
      }

      dialog.showSaveDialog(currentWindow, {
        defaultPath: defaultPath,
        title: i18n.__('Context.Image.Export'),
        filters: [{ name: 'Eagle Package File', extensions: ['eaglepack'] }]
      }).then((result: any) => {
        var savePath = result.filePath;
        if (!savePath) return;
        if ((window as any).backgroundWindowID === undefined) {
          IPCHelper.send('export-images', {
            folder: f,
            savePath: savePath
          });
        }
        else {
          IPCHelper.sendTo((window as any).backgroundWindowID, 'export-images', {
            folder: f,
            savePath: savePath
          });
        }
      });
    }).apply(null, args);
  };

  // folderExportAsFolder（bundle 40136-40430 逐字）
  fns["folderExportAsFolder"] = function (...args) {
    const s = getScope();
    if (!s) return;
    return (function (event: any, folder: any) {
      const w = window as any;
      var folders = s.$root.selectedFolders;
      if (folder) {
        folders = [folder];
      }
      else {
        if (s.$root.selectedFolders.length === 0) return;
        folders = s.$root.selectedFolders;
      }

      var exportFolder = function (folder2: any, savePath: any) {
        var images: any[] = [];
        if (savePath) {
          for (var rindex = s.raw.length - 1; rindex >= 0; rindex--) {
            try {
              var image = s.raw[rindex];
              if (image.isDeleted) continue;
              var isContain = image.folders.indexOf(folder2.id) > -1;
              if (!isContain) {
                treeWalkSafe(folder2.children, 'children', function (child: any, parent: any) {
                  if (image.folders.indexOf(child.id) > -1) {
                    isContain = true;
                    return;
                  }
                });
              }
              if (isContain && !(s.lockedImages && s.lockedImages[image.id])) {
                images.push(image);
              }
            }
            catch (err) {}
          }

          function sanitizeFolderName(folderName: any) {
            if (typeof folderName !== 'string') return '';

            // 移除 tab，統一空白
            folderName = folderName.replace(/\t/g, ' ').replace(/\s+/g, ' ').trim();

            if (w.process.platform === 'darwin') {
              // macOS：僅移除冒號與斜線
              folderName = folderName
                .replace(/[:\/\\]/g, ' ')
                .trim();
            } else {
              // Windows：移除非法字元與控制碼
              folderName = folderName
                .replace(/[<>:"\/\\|?*\x00-\x1F]/g, '')
                .replace(/[ ]+$/, '')
                .replace(/[.]+$/, '')
                .trim();

              // 避免使用保留名稱
              const reservedNames = new Set([
                'CON', 'PRN', 'AUX', 'NUL',
                'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
                'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'
              ]);
              if (reservedNames.has(folderName.toUpperCase())) {
                folderName += '_';
              }
            }

            return folderName;
          }

          var folderName = sanitizeFolderName(folder2.name);
          var folderDir = w.path.normalize(savePath + '/' + folderName);
          if (fs.existsSync(folderDir)) {
            var message = $filter('i18n')('Dialog.Folder.Export.As.Folder.Message', [
              { property: 'folderDir', value: folderDir }
            ]);

            swal({
              html: `
                                <div class="alert">
                                    <div class="alert-icon warning"></div>
                                    <h4 class="alert-title">${i18n.__('Dialog.Folder.Export.As.Folder.Title')}</h4>
                                    <p class="alert-desc">${message}</p>
                                </div>
                            `,
              showCloseButton: false, showCancelButton: true, allowOutsideClick: false, focusConfirm: true, focusCancel: false, padding: 24,
              width: 400,
              customClass: 'alert-box',
              cancelButtonColor: '#777777',
              confirmButtonText: i18n.__('Dialog.Folder.Export.As.Folder.Button'),
              cancelButtonText: i18n.__('general.cancel'),
            }).then(function () {
              if ((window as any).backgroundWindowID === undefined) {
                IPCHelper.send('export-as-folder', {
                  folder: folder2,
                  images: images,
                  savePath: savePath
                });
              }
              else {
                IPCHelper.sendTo((window as any).backgroundWindowID, 'export-as-folder', {
                  folder: folder2,
                  images: images,
                  savePath: savePath
                });
              }
            });
          }
          else {
            if ((window as any).backgroundWindowID === undefined) {
              IPCHelper.send('export-as-folder', {
                folder: folder2,
                images: images,
                savePath: savePath
              });
            }
            else {
              IPCHelper.sendTo((window as any).backgroundWindowID, 'export-as-folder', {
                folder: folder2,
                images: images,
                savePath: savePath
              });
            }
          }
        }
      };
      s.exportFolder(function (savePath: any) {
        folders.forEach(function (folder2: any) {
          exportFolder(folder2, savePath);
        });
      });
    }).apply(null, args);
  };

  // moveFolders（bundle 40431-40440 逐字）
  fns["moveFolders"] = function (...args) {
    const s = getScope();
    if (!s) return;
    return (function (selectedFolders: any, node: any) {
      var selected = (selectedFolders && selectedFolders.length > 0) ? selectedFolders : [node];
      if (selected && selected.length > 0) {
        s.$root.$broadcast('OPEN-MOVE-FOLDER-MODAL', {
          current: s.currentFolder,
          folders: s.folders,
          selectedFolders: selected
        });
      }
    }).apply(null, args);
  };

  // removeFolder / removeSelectedFolders（bundle 41935-42019 逐字；递归引用闭包版）
  fns["removeFolder"] = function (...args) {
    const s = getScope();
    if (!s) return;
    return (function (folder: any, params: any = {}) {
      if (folder.password && !folder.isUnLock) return;

      // 如果圖片或子文件夾超過數量，就需要顯示詢問視窗
      if (folder.images && folder.imageCount > 0 || folder && folder.children.length > 0) {
        setTimeout(function () {
          var removeConfirmMsg = $filter('i18n')('dialog.removeFolder.desc', [
            { property: 'folder', value: folder.name },
          ]);
          swal({
            html: `
                            <div class="alert">
                                <div class="alert-icon warning"></div>
                                <h4 class="alert-title">${$filter('i18n')('dialog.removeFolder.title')}</h4>
                                <p class="alert-desc">${removeConfirmMsg}</p>
                            </div>
                        `,
            showCloseButton: false, showCancelButton: true, allowOutsideClick: false, focusConfirm: true, focusCancel: false, padding: 24,
            width: 400,
            customClass: 'alert-box',
            cancelButtonColor: '#777777',
            input: 'checkbox',
            inputValue: 1,
            inputValidator: function (result: any) {
              return new Promise(function (resolve, reject) {
                resolve(result);
              });
            },
            inputPlaceholder: $filter('i18n')('dialog.removeFolder.checkbox'),
            confirmButtonText: $filter('i18n')('dialog.removeFolder.button'),
            cancelButtonText: $filter('i18n')('general.cancel'),
          }).then(function (result: any) {
            s.checkOperationSafety2(folder.descendantImageCount, function () {
              params.isDeleteImages = (result == 1);
              removeFolderClosure(folder, params);
              s.$evalAsync();
            }, 50);
          }, function () {});
        }, 100);
      }
      else {
        removeFolderClosure(folder, params);
      }
    }).apply(null, args);
  };

  fns["removeSelectedFolders"] = function (...args) {
    const s = getScope();
    if (!s) return;
    return (function () {
      if (s.$root.selectedFolders.length === 0) return;

      var removeConfirmMsg = $filter('i18n')('dialog.removeFolder.descMultiple', [
        { property: 'count', value: s.$root.selectedFolders.length },
      ]);
      swal({
        html: `
                        <div class="alert">
                            <div class="alert-icon warning"></div>
                            <h4 class="alert-title">${$filter('i18n')('dialog.removeFolder.title')}</h4>
                            <p class="alert-desc">${removeConfirmMsg}</p>
                        </div>
                    `,
        showCloseButton: false, showCancelButton: true, allowOutsideClick: false, focusConfirm: true, focusCancel: false, padding: 24,
        width: 400,
        customClass: 'alert-box',
        cancelButtonColor: '#777777',
        input: 'checkbox',
        inputValue: 1,
        inputValidator: function (result: any) {
          return new Promise(function (resolve, reject) {
            resolve(result);
          });
        },
        inputPlaceholder: $filter('i18n')('dialog.removeFolder.checkbox'),
        confirmButtonText: $filter('i18n')('dialog.removeFolder.button'),
        cancelButtonText: $filter('i18n')('general.cancel'),
      }).then(function (result: any) {
        s.checkOperationSafety2(s.$root.selectedFolders.length, function () {
          var isDeleteImages = (result == 1);
          s.$root.selectedFolders.forEach(function (folder: any) {
            if (folder.password && !folder.isUnLock) return;
            removeFolderClosure(folder, { isDeleteImages: isDeleteImages, ignoreRestore: true });
          });
        }, 1);
      }, function () {});
    }).apply(null, args);
  };

  // copyFolderLink（bundle 46606-46615 逐字）
  fns["copyFolderLink"] = function (...args) {
    const s = getScope();
    if (!s) return;
    return (function (event: any, folder: any) {
      if (folder && folder.id) {
        clipboard.writeText(`http://localhost:41595/folder?id=${folder.id}`);
        s.notify({
          message: i18n.__('notify.colorCopySuccess'),
          duration: 750
        });
      }
    }).apply(null, args);
  };

  // showListSubfolderContent（bundle 45351-45364 逐字）
  fns["showListSubfolderContent"] = function (...args) {
    const s = getScope();
    if (!s) return;
    return (function () {
      const w = window as any;
      s.showSubfolderContent = !s.showSubfolderContent;
      preferences.showSubfolderContent = s.showSubfolderContent;
      (window as any).electronSettings.set('preferences', preferences).then(function () {});
      s.calculateImageBinding({ ignoreSort: true }, function () {
        s.rebindRefresh();
        s.updateSelection();
        const scrollbar = document.getElementById('box-container-scrollbar') || (w.$ && w.$('#box-container-scrollbar')[0]);
        if (scrollbar) scrollbar.dispatchEvent(new Event('UPDATE_BOX_SCROLLBAR', { bubbles: true }));
      });

      s.$evalAsync();
      if (s.showSubfolderContent) { w.electronLog && w.electronLog.info('[app] Show sub-folder on list: ON'); }
      else { w.electronLog && w.electronLog.info('[app] Show sub-folder on list: OFF'); }
    }).apply(null, args);
  };

  // openFolderContextMenu（bundle 39012-39549 逐字；ContextMenu.open → 模块常量广播；
  // $(event.delegateTarget) → React synthetic currentTarget classList）
  fns["openFolderContextMenu"] = function (...args) {
    const s = getScope();
    if (!s) return;
    return (function (event: any, folder: any) {
      const w = window as any;

      if (event && event.target && event.target.tagName === 'INPUT') return;

      const disabled = !!folder.password && !folder.isUnLock;
      const isOpenQuickAccess = s.$root.preferences.sidebar.quickAccess != 'false';
      const isAddedQuickAccess = w.QuickAccessManager.indexOf(folder) > -1;
      const isMultiple = s.selectedFoldersMappings[folder.id];
      const selectedFolders = s.$root.selectedFolders;

      let items: any = null;
      let historyLibraryMenu: any = {};

      historyLibraryMenu.items = s.getLibraryHistory().filter((history: any) => {
        var isCurrent = false;
        if (s.libraryPath) {
          isCurrent = w.path.normalize(history.path) == w.path.normalize(s.libraryPath);
        }
        return !isCurrent;
      }).map((history: any) => {
        return {
          label: history.name,
          keywords: i18n.__('context.image.addToLibrary') + ' library 資源庫',
          accelerator: history.dir,
          icon: 'ic-library-logo.svg',
          click: () => {
            const items2 = s.getFolderImages(folder, true);
            s.$root.$broadcast('ADD_TO_LIBRARY', {
              folder: folder,
              items: items2,
              library: history
            });
            s.$evalAsync();
          }
        };
      });

      if (isMultiple && selectedFolders.length > 1) {

        // 當前的排序方式
        const currentOrder = selectedFolders.reduce((prev: any, current: any) => {
          return ((prev && prev.orderBy) === (current && current.orderBy)) ? (prev && prev.orderBy) : undefined;
        }, undefined);

        const currentOrderIncrease = selectedFolders.reduce((prev: any, current: any) => {
          return ((prev && prev.sortIncrease) === (current && current.sortIncrease)) ? (prev && prev.sortIncrease) : undefined;
        }, undefined);

        let defaultOrderItem = {
          checked: !currentOrder,
          label: i18n.__('context.order.orderBy>default'),
          icon: 'ic-order-by.svg',
          click: () => {
            s.setFoldersOrder(selectedFolders, undefined);
          }
        };

        let orderItems = ['import', 'mtime', 'btime', 'name', 'ext', 'filesize', 'resolution', 'rating', 'duration', 'random'].map((order) => {
          const uppercase = order && order.toUpperCase();
          return {
            checked: currentOrder === uppercase,
            label: i18n.__(`context.order.orderBy>${order}`),
            keywords: order,
            icon: `ic-order-by-${order}.svg`,
            click: () => {
              s.setFoldersOrder(selectedFolders, uppercase || undefined);
            }
          };
        });

        let increaseItems = [
          {
            checked: currentOrderIncrease === true,
            label: i18n.__('context.order.orderBy>increase'),
            icon: 'ic-order-by-increase.svg',
            click: () => {
              s.setFoldersSortIncrease(selectedFolders, true);
            }
          },
          {
            checked: currentOrderIncrease === false,
            label: i18n.__('context.order.orderBy>decrease'),
            icon: 'ic-order-by-decrease.svg',
            click: () => {
              s.setFoldersSortIncrease(selectedFolders, false);
            }
          },
        ];

        let orderByItems = [defaultOrderItem, ...orderItems, { role: 'separator' }, ...increaseItems];

        items = [
          // 添加到最愛 / 從最愛移除
          {
            visible: isOpenQuickAccess && !isAddedQuickAccess,
            label: i18n.__('context.folder.quickAccessAdd'),
            keywords: '最愛 加入 快速存取 add quick access favorite',
            icon: 'ic-favorite-add.svg',
            click: () => {
              w.QuickAccessManager.addMultiple('folder', selectedFolders);
              s.$evalAsync();
            }
          },
          {
            visible: isOpenQuickAccess && isAddedQuickAccess,
            label: i18n.__('context.folder.quickAccessRemove'),
            keywords: '最愛 移除 快速存取 remove quick access favorite',
            icon: 'ic-favorite-remove.svg',
            click: () => {
              w.QuickAccessManager.removeMultiple('folder', selectedFolders);
              s.$evalAsync();
            }
          },
          {
            visible: isOpenQuickAccess,
            role: 'separator'
          },
          // 移動文件夾
          {
            label: i18n.__('context.folder.moveFolder'),
            keywords: 'move folder dir 資料夾 文件夾 移动',
            icon: 'ic-folder-move.svg',
            accelerator: s.$root.preferences.shortcuts.keybinds['edit.folder.move'],
            click: () => {
              s.moveFolders(selectedFolders, folder);
              s.$evalAsync();
            }
          },
          // 批次命名
          {
            accelerator: s.$root.preferences.shortcuts.keybinds[`edit.rename.${w.process.platform}`],
            label: i18n.__('context.image.batchRename.msg1') + selectedFolders.length + i18n.__('context.image.batchRename.msg2'),
            keywords: '重命名 重新命名 rename',
            icon: 'ic-rename.svg',
            click: () => {
              s.batchRenameFolders(event);
              s.$evalAsync();
            }
          },
          // 修改排序
          {
            label: i18n.__('context.order.label.orderBy'),
            icon: 'ic-order-by.svg',
            submenu: {
              items: orderByItems
            }
          },
          // 導出
          {
            disabled: disabled,
            icon: 'ic-export.svg',
            label: i18n.__('context.folder.export'),
            submenu: {
              items: [
                {
                  disabled: disabled,
                  label: i18n.__('context.folder.export>computer'),
                  keywords: '導出 エクスポート 本地 export computer local',
                  icon: 'ic-export-computer.svg',
                  click: () => {
                    s.folderExportAsFolder(event);
                    s.$evalAsync();
                  }
                }
              ]
            }
          },
          {
            role: 'separator'
          },
          // emoji
          {
            label: i18n.__('context.folder.icon'),
            icon: 'ic-emoji.svg',
            submenu: {
              items: [{
                role: 'emoji',
                click: (emoji: any) => {
                  s.changeSelectedFoldersIcon(event, emoji);
                }
              }]
            }
          },
          // color
          {
            role: 'color',
            click: (color: any) => {
              s.changeSelectedFoldersColor(event, color);
              s.$evalAsync();
            }
          },
          // ---
          // 刪除
          {
            role: 'separator'
          },
          {
            accelerator: (w.process.platform === 'win32') ? 'Delete' : 'CmdOrCtrl+⌫',
            label: i18n.__('context.folder.remove'),
            keywords: '資料夾 文件夾 刪除 移除 remove delete folder dir',
            icon: 'ic-folder-remove.svg',
            click: () => {
              s.removeSelectedFolders();
              s.$evalAsync();
            }
          },
        ];
      }
      else {
        items = [
          // 新增資料夾
          {
            accelerator: s.$root.preferences.shortcuts.keybinds['file.create.folder'] || 'CmdOrCtrl+Shift+N',
            label: i18n.__('context.folder.newFolder'),
            keywords: 'folder dir new create 資料夾 文件夾 新建 建立 新增 ',
            icon: 'ic-folder-new-folder.svg',
            click: () => {
              s.newFolder(folder, false, true);
              s.$evalAsync();
            }
          },
          // 新增子資料夾
          {
            disabled: disabled,
            accelerator: 'Alt+N',
            label: i18n.__('context.folder.newSubFolder'),
            keywords: 'sub folder dir new create 資料夾 文件夾 新建 建立 新增 子資料夾',
            icon: 'ic-folder-new-sub-folder.svg',
            click: () => {
              s.newFolder(folder, true);
              s.$evalAsync();
            }
          },
          // 移動文件夾
          {
            label: i18n.__('context.folder.moveFolder'),
            keywords: 'move folder dir 資料夾 文件夾 移动',
            icon: 'ic-folder-move.svg',
            accelerator: s.$root.preferences.shortcuts.keybinds['edit.folder.move'],
            click: () => {
              s.moveFolders(selectedFolders, folder);
              s.$evalAsync();
            }
          },
          // ---
          {
            role: 'separator'
          },
          // 添加到最愛 / 從最愛移除
          {
            visible: isOpenQuickAccess && !isAddedQuickAccess,
            label: i18n.__('context.folder.quickAccessAdd'),
            keywords: '最愛 加入 快速存取 add quick access favorite',
            icon: 'ic-favorite-add.svg',
            click: () => {
              w.QuickAccessManager.add('folder', folder);
              s.$evalAsync();
            }
          },
          {
            visible: isOpenQuickAccess && isAddedQuickAccess,
            label: i18n.__('context.folder.quickAccessRemove'),
            keywords: '最愛 移除 快速存取 remove quick access favorite',
            icon: 'ic-favorite-remove.svg',
            click: () => {
              w.QuickAccessManager.remove('folder', folder);
              s.$evalAsync();
            }
          },
          {
            visible: isOpenQuickAccess,
            role: 'separator'
          },
          // 重命名
          {
            accelerator: s.$root.preferences.shortcuts.keybinds[`edit.rename.${w.process.platform}`],
            label: i18n.__('context.folder.renameFolder'),
            keywords: '重命名 重新命名 rename',
            icon: 'ic-rename.svg',
            click: () => {
              s.renameFolder(event, folder);
              s.$evalAsync();
            }
          },
          // 複製連結
          {
            label: i18n.__('appmenu.edit>copyAsLink'),
            keywords: '複製 連結 copy link',
            icon: 'ic-folder-copy-link.svg',
            click: () => {
              s.copyFolderLink(event, folder);
              s.$evalAsync();
            }
          },
          // 自動標籤
          {
            accelerator: 'CmdOrCtrl+Shift+R',
            label: i18n.__('context.folder.autoTagging'),
            icon: 'ic-folder-auto-tag.svg',
            disabled: disabled,
            click: (event2: any) => {
              s.settingFolder(event2, folder);
              s.$evalAsync();
            }
          },
          // 密碼保護
          {
            label: i18n.__('context.folder.password'),
            icon: 'ic-password.svg',
            submenu: {
              items: [
                {
                  disabled: !!folder.password,
                  label: i18n.__('context.folder.password>create'),
                  accelerator: preferences.shortcuts.keybinds['edit.folder.password.create'],
                  click: () => {
                    s.setFolderPassword(folder);
                    s.$evalAsync();
                  }
                },
                {
                  disabled: !folder.password,
                  label: i18n.__('context.folder.password>change'),
                  accelerator: preferences.shortcuts.keybinds['edit.folder.password.change'],
                  click: () => {
                    s.changeFolderPassword(folder);
                    s.$evalAsync();
                  }
                },
                {
                  disabled: !folder.password,
                  label: i18n.__('context.folder.password>reset'),
                  accelerator: preferences.shortcuts.keybinds['edit.folder.password.reset'],
                  click: () => {
                    s.resetFolderPassword(folder);
                    s.$evalAsync();
                  }
                },
                {
                  disabled: !(!!folder.password && !!folder.isUnLock),
                  label: i18n.__('context.folder.password>lock'),
                  accelerator: preferences.shortcuts.keybinds['edit.folder.password.lock'],
                  click: () => {
                    s.lockFolder(event, folder);
                    s.$evalAsync();
                  }
                }
              ]
            }
          },
          // ---
          // 排序
          {
            label: i18n.__('context.folder.sortByTitle'),
            icon: 'ic-order-by.svg',
            submenu: {
              items: [
                {
                  label: i18n.__('context.folder.sortByTitle>title') + `(${i18n.__('context.folder.sortByCurrentLevel')}) (A→Z)`,
                  keywords: i18n.__('context.folder.sortByTitle'),
                  click: () => {
                    let folders = (folder.parent) ? s.folderMappings[folder.parent].children : s.folders;
                    s.reorderFolderByTitle(folders);
                  }
                },
                {
                  label: i18n.__('context.folder.sortByTitle>title') + `(${i18n.__('context.folder.sortByCurrentLevel')}) (Z→A)`,
                  keywords: i18n.__('context.folder.sortByTitle'),
                  click: () => {
                    let folders = (folder.parent) ? s.folderMappings[folder.parent].children : s.folders;
                    s.reorderFolderByTitle(folders, true);
                  }
                },
                {
                  label: i18n.__('context.folder.sortByTitle>title') + `(${i18n.__('context.folder.sortByAllLevel')}) (A→Z)`,
                  keywords: i18n.__('context.folder.sortByTitle'),
                  click: () => {
                    s.reorderAllFolderByTitle();
                  }
                },
                {
                  label: i18n.__('context.folder.sortByTitle>title') + `(${i18n.__('context.folder.sortByAllLevel')}) (Z→A)`,
                  keywords: i18n.__('context.folder.sortByTitle'),
                  click: () => {
                    s.reorderAllFolderByTitle(true);
                  }
                },
              ]
            }
          },
          {
            role: 'separator'
          },
          {
            label: i18n.__('Context.Expand.Folder'),
            icon: 'ic-expand.svg',
            click: () => {
              s.toggleSelectFolder(event, folder);
              s.$evalAsync();
            }
          },
          {
            label: i18n.__('Context.Expand.SameLevel.Folders'),
            icon: 'ic-expand-same.svg',
            click: () => {
              s.toggleCurrentLevelFolders(event, folder);
              s.$evalAsync();
            }
          },
          {
            accelerator: '/',
            label: i18n.__('Context.Expand.All.Folders'),
            icon: 'ic-expand-all.svg',
            click: () => {
              s.toggleAllFolderExpand(event, folder);
              s.$evalAsync();
            }
          },
          {
            role: 'separator'
          },
          // 克隆
          {
            disabled: disabled,
            label: i18n.__('context.folder.clone'),
            keywords: '複製 克隆 clone',
            icon: 'ic-clone.svg',
            click: () => {
              s.cloneFolder(event, folder);
              s.$evalAsync();
            }
          },
          // ---
          {
            role: 'separator'
          },
          // 導出
          {
            disabled: disabled,
            icon: 'ic-export.svg',
            label: i18n.__('context.folder.export'),
            submenu: {
              items: [
                {
                  disabled: disabled,
                  label: i18n.__('context.folder.export>computer'),
                  keywords: '導出 エクスポート 本地 export computer local',
                  icon: 'ic-export-computer.svg',
                  click: () => {
                    s.folderExportAsFolder(event, folder);
                    s.$evalAsync();
                  }
                },
                {
                  disabled: disabled,
                  label: i18n.__('context.folder.export>eaglepack'),
                  keywords: '導出 エクスポート export eaglepack',
                  icon: 'ic-export-eaglepack.svg',
                  click: () => {
                    s.folderExportAsPack(event, folder);
                    s.$evalAsync();
                  }
                }
              ]
            }
          },
          // 添加至資源庫
          {
            label: i18n.__('context.image.addToLibrary'),
            keywords: '',
            icon: 'ic-library-add-to.svg',
            submenu: historyLibraryMenu
          },
          // ---
          { role: 'separator' },
          // 在父文件夾顯示子文件夾內容
          {
            checked: s.showSubfolderContent,
            label: i18n.__('context.folder.toogleSubFolderContent'),
            icon: 'ic-folder-show-sub-folder-content.svg',
            click: () => {
              s.showListSubfolderContent();
              s.$evalAsync();
            }
          },
          // ---
          { role: 'separator' },
          // emoji
          {
            label: i18n.__('context.folder.icon'),
            icon: 'ic-emoji.svg',
            submenu: {
              items: [{
                role: 'emoji',
                click: (emoji: any) => {
                  s.changeFolderIcon(event, folder, emoji);
                }
              }]
            }
          },
          // color
          {
            role: 'color',
            click: (color: any) => {
              s.changeFolderColor(event, folder, color);
              s.$evalAsync();
            }
          },
          // ---
          // 刪除
          {
            role: 'separator'
          },
          {
            accelerator: (w.process.platform === 'win32') ? 'Delete' : 'CmdOrCtrl+⌫',
            label: i18n.__('context.folder.remove'),
            keywords: '資料夾 文件夾 刪除 移除 remove delete folder dir',
            icon: 'ic-folder-remove.svg',
            click: () => {
              s.removeFolder(folder);
              s.$evalAsync();
            }
          },
        ];
      }
      const folderEl = event && event.currentTarget;
      ContextMenu.open({
        items: items,
        showSearch: true,
        onOpened: () => {
          try { folderEl && folderEl.classList && folderEl.classList.add('context-activate'); } catch (err) {}
        },
        onClosed: () => {
          try { folderEl && folderEl.classList && folderEl.classList.remove('context-activate'); } catch (err2) {}
        }
      });
    }).apply(null, args);
  };


  // ── b1-9aq：台账⑨第三批——openSmartFolderContextMenu 主菜单 + 依赖面（bundle 39550-40105
  //    + 41395-41440/41652-41719/41831-42049/26287-26331/40267-40430 逐字）──

  // controller 闭包函数 ayncsUpdateSmartFoldersCount（bundle 26301-26331 逐字）
  function ayncsUpdateSmartFoldersCount(smartFolders: any, callback: any) {
    const s = getScope();
    if (!smartFolders || smartFolders.length === 0) return;
    setTimeout(() => {
      let total = smartFolders.length;
      let once = 3;
      let loopCount = total / once;
      let countOfSend = 0;

      function send() {
        var start = countOfSend * once;
        var arr = smartFolders.slice(start, start + once);
        countOfSend += 1;

        for (let i = 0; i < arr.length; i++) {
          arr[i].imageCount = s.smartFolderCount(arr[i]);
          if (!arr[i].pinyin) {
            arr[i].pinyin = (window as any).tinyPinyin.convertToPinyin(arr[i].name);
          }
        }

        s.$evalAsync();

        loop();
      }

      function loop() {
        if (countOfSend < loopCount) {
          window.requestAnimationFrame(send);
        }
        else {
          callback && callback();
        }
      }
      loop();
    }, 30);
  }

  // refreshSmartFolderCount（bundle 26287-26290 逐字）
  fns["refreshSmartFolderCount"] = function (...args) {
    const s = getScope();
    if (!s) return;
    return (function () {
      ayncsUpdateSmartFoldersCount(s.smartFolderList, () => {});
    }).apply(null, args);
  };

  // setSmartFoldersOrder + setSmartFolderOrder（bundle 41395-41422 逐字）
  fns["setSmartFoldersOrder"] = function (...args) {
    const s = getScope();
    if (!s) return;
    return (function (smartFolders: any, orderBy: any, ignoreReload: any) {
      smartFolders.forEach(function (folder: any) {
        s.setSmartFolderOrder(folder, orderBy);
      });
      s.sortRawData(orderBy);
      s.rebindRefresh();
      s.$evalAsync();
    }).apply(null, args);
  };

  fns["setSmartFolderOrder"] = function (...args) {
    const s = getScope();
    if (!s) return;
    return (function (folder: any, orderBy: any) {
      if (!folder) return;
      if (!orderBy) {
        delete folder.orderBy;
        delete folder.sortIncrease;
      }
      else {
        folder.orderBy = orderBy;
        if (folder.sortIncrease === undefined) {
          folder.sortIncrease = true;
        }
      }
      if (s.currentSmartFolder === folder) {
        s.reload();
      }
      s.saveFolder();
    }).apply(null, args);
  };

  // setSmartFoldersSortIncrease + setSmartFolderSortIncrease（bundle 41423-41440 逐字）
  fns["setSmartFoldersSortIncrease"] = function (...args) {
    const s = getScope();
    if (!s) return;
    return (function (smartFolders: any, sortIncrease: any, ignoreReload: any) {
      smartFolders.forEach(function (folder: any) {
        s.setSmartFolderSortIncrease(folder, sortIncrease);
      });
    }).apply(null, args);
  };

  fns["setSmartFolderSortIncrease"] = function (...args) {
    const s = getScope();
    if (!s) return;
    return (function (folder: any, sortIncrease: any) {
      if (!folder) return;
      folder.sortIncrease = !!sortIncrease;
      if (s.currentSmartFolder === folder) {
        s.reload();
      }
      s.saveFolder();
    }).apply(null, args);
  };

  // batchRenameSmartFolders（bundle 41654-41662 逐字）
  fns["batchRenameSmartFolders"] = function (...args) {
    const s = getScope();
    if (!s) return;
    return (function () {
      var selectedSmartFolders = s.$root.selectedSmartFolders;
      if (selectedSmartFolders.length === 0) return;

      s.$root.$broadcast('OPEN_RENAME', {
        type: 'SMART_FOLDER',
        folders: selectedSmartFolders
      });
    }).apply(null, args);
  };

  // changeSmartFolderIcon / changeSmartFolderColor（bundle 41664-41687 逐字）
  fns["changeSmartFolderIcon"] = function (...args) {
    const s = getScope();
    if (!s) return;
    return (function (event: any, smartFolder: any, icon: any) {
      const w = window as any;
      if (!icon) {
        delete smartFolder.icon;
      }
      else {
        smartFolder.icon = icon;
      }
      s.saveFolder();
      try { w.electronLog && w.electronLog.info(`[app] Change folder: ${smartFolder.name}(${smartFolder.id}) icon to: ${icon}`); } catch (err) {}
      w.analytics.event('ChangeIcon', 'SmartFolder', icon);
    }).apply(null, args);
  };

  fns["changeSmartFolderColor"] = function (...args) {
    const s = getScope();
    if (!s) return;
    return (function (event: any, smartFolder: any, color: any) {
      const w = window as any;
      if (!color) {
        delete smartFolder.iconColor;
      }
      else {
        smartFolder.iconColor = color;
      }
      s.updateSidebarList();
      s.saveFolder();
      try { w.electronLog && w.electronLog.info(`[app] Change smart-folder: ${smartFolder.name}(${smartFolder.id}) icon color to: ${color}`); } catch (err) {}
      w.analytics.event('ChangeColor', 'SmartFolder', color);
    }).apply(null, args);
  };

  // changeSelectedSmartFoldersIcon / changeSelectedSmartFoldersColor（bundle 40022-40084 逐字）
  fns["changeSelectedSmartFoldersIcon"] = function (...args) {
    const s = getScope();
    if (!s) return;
    return (function (event: any, icon: any) {
      const w = window as any;
      if (s.$root.selectedSmartFolders.length === 0) return;
      s.$root.selectedSmartFolders.forEach(function (smartFolder: any) {
        if (!icon) {
          delete smartFolder.icon;
        }
        else {
          smartFolder.icon = icon;
        }
      });
      s.updateSidebarList();
      s.saveFolder();
      try { w.electronLog && w.electronLog.info(`[app] Change ${s.$root.selectedSmartFolders.length} smart-folders icon to: ${icon}`); } catch (err) {}
      w.analytics.event('ChangeIcon', 'SmartFolder', icon);
    }).apply(null, args);
  };

  fns["changeSelectedSmartFoldersColor"] = function (...args) {
    const s = getScope();
    if (!s) return;
    return (function (event: any, color: any) {
      const w = window as any;
      if (s.$root.selectedSmartFolders.length === 0) return;
      s.$root.selectedSmartFolders.forEach(function (smartFolder: any) {
        if (!color) {
          delete smartFolder.iconColor;
        }
        else {
          smartFolder.iconColor = color;
        }
      });
      s.updateSidebarList();
      s.saveFolder();
      try { w.electronLog && w.electronLog.info(`[app] Change ${s.$root.selectedSmartFolders.length} smart-folders icon color to: ${color}`); } catch (err) {}
      w.analytics.event('ChangeColor', 'SmartFolder', color);
    }).apply(null, args);
  };

  // cloneSmartFolder（bundle 41689-41718 逐字；angular.copy→JSON 深拷）
  fns["cloneSmartFolder"] = function (...args) {
    const s = getScope();
    if (!s) return;
    return (function (event: any, smartFolder: any) {
      const w = window as any;
      var newFolder = JSON.parse(JSON.stringify(smartFolder));
      var children = s.smartFolders;
      if (smartFolder.parent && s.smartFolderMappings[smartFolder.parent]) {
        let parent = s.smartFolderMappings[smartFolder.parent];
        children = parent.children;
      }
      var idx = children.indexOf(smartFolder);
      newFolder.id = guid();
      newFolder.children = newFolder.children || [];

      treeWalkSafe(newFolder.children, 'children', function (sf: any, parent: any) {
        let newId = guid();
        sf.id = newId;
        sf.children = sf.children || [];
        if (parent) {
          sf.parent = parent.id;
        }
        s.smartFolderMappings[newId] = sf;
      });

      if (idx > -1) {
        children.splice(idx, 0, newFolder);
        s.smartFolderMappings[newFolder.id] = newFolder;
        s.updateSidebarList();
        s.saveFolder();
        try { w.electronLog && w.electronLog.info(`[app] Clone smart-folder: ${smartFolder.name}(${smartFolder.id}), new smart-folder: ${newFolder.name}(${newFolder.id})`); } catch (err) {}
      }
    }).apply(null, args);
  };

  // renameSmartFolder（bundle 41652-41662 邻接定义逐字）
  fns["renameSmartFolder"] = function (...args) {
    const s = getScope();
    if (!s) return;
    return (function (event: any, smartFolder: any) {
      s.viewMode = undefined;
      s.currentSmartFolder = smartFolder;
      smartFolder.editable = true;
      smartFolder.newFolderName = smartFolder.name;
      setTimeout(function () {
        wQueryFocusFolderInput(smartFolder.id);
      }, 100);
      setTimeout(function () {
        wQueryFocusFolderInput(smartFolder.id);
      }, 200);
    }).apply(null, args);
  };

  // copySmartFolderLink（bundle 46617-46626 逐字）
  fns["copySmartFolderLink"] = function (...args) {
    const s = getScope();
    if (!s) return;
    return (function (event: any, smartFolder: any) {
      if (smartFolder && smartFolder.id) {
        clipboard.writeText(`http://localhost:41595/smart-folder?id=${smartFolder.id}`);
        s.notify({
          message: i18n.__('notify.colorCopySuccess'),
          duration: 750
        });
      }
    }).apply(null, args);
  };

  // controller 闭包函数 removeSmartFolder（bundle 41851-41934 逐字；angular.copy→JSON 深拷）
  function removeSmartFolderClosure(smartFolder: any, { ignoreSelectNext, ignoreRestore }: any) {
    const s = getScope();
    const w = window as any;

    var message = $filter('i18n')('notify.folder.remove', [
      { property: 'folder', value: smartFolder.name },
    ]);

    var children = s.smartFolders;
    if (smartFolder.parent && s.smartFolderMappings[smartFolder.parent]) {
      let parent = s.smartFolderMappings[smartFolder.parent];
      children = parent.children;
    }
    var origin = JSON.parse(JSON.stringify(children));
    var idx = children.indexOf(smartFolder);

    if (idx === -1) return;

    children.splice(idx, 1);
    delete s.smartFolderMappings[smartFolder.id];
    w.QuickAccessManager.remove('smartFolder', smartFolder);

    // 如果已經沒有資料夾
    if (idx === 0) {
      if (children[idx]) {
        s.openSmartFolder(children[idx]);
      } else {
        s.currentSmartFolder = undefined;
        s.openAll();
      }
    }
    // 如果還有資料夾
    else {
      if (children[idx]) {
        s.openSmartFolder(children[idx]);
      } else {
        if (children[idx - 1]) {
          s.openSmartFolder(children[idx - 1]);
        } else {
          s.currentSmartFolder = undefined;
          s.openAll();
        }
      }
    }

    // 如果声音效果是开启的
    if (s.$root.preferences.notification.soundEffect.enable != 'false' && s.$root.preferences.notification.soundEffect.when.deleteFolder == 'true') {
      s.removeSound && s.removeSound.play && s.removeSound.play();
    }
    s.updateSidebarList();

    $timeout(function () {
      s.saveFolderDebounce && s.saveFolderDebounce();
    }, 1000);

    w.electronLog && w.electronLog.info(`[app] Remove smart-folder: ${smartFolder.name}(${smartFolder.id})`);

    if (!ignoreRestore) {
      (s.$root.notify || s.notify).call(s.$root, {
        message: message,
        duration: 5000,
      }, function () {
        if (smartFolder.parent && s.smartFolderMappings[smartFolder.parent]) {
          let parent = s.smartFolderMappings[smartFolder.parent];
          parent.children = origin;
        }
        else {
          s.smartFolders = origin;
        }
        s.smartFolderMappings[smartFolder.id] = smartFolder;
        treeWalkSafe(s.smartFolders, 'children', function (sf: any, parent: any, depth: any) {
          s.smartFolderMappings[sf.id] = sf;
        });
        s.updateSidebarList();
        s.openSmartFolder(smartFolder);
        s.saveFolderDebounce && s.saveFolderDebounce();
        s.$evalAsync();
      });
    }
  }

  // removeSmartFolder / removeSelectedSmartFolders（bundle 41831-42049 逐字）
  fns["removeSmartFolder"] = function (...args) {
    const s = getScope();
    if (!s) return;
    return (function (smartFolder: any) {
      setTimeout(function () {
        var removeConfirmMsg = $filter('i18n')('dialog.removeSmartFolder.desc', [
          { property: 'folder', value: smartFolder.name },
        ]);
        swal({
          html: `
                        <div class="alert">
                            <div class="alert-icon warning"></div>
                            <h4 class="alert-title">${i18n.__('dialog.removeSmartFolder.title')}</h4>
                            <p class="alert-desc">${removeConfirmMsg}</p>
                        </div>
                    `,
          showCloseButton: false, showCancelButton: true, allowOutsideClick: false, focusConfirm: true, focusCancel: false, padding: 24,
          width: 400,
          customClass: 'alert-box',
          cancelButtonColor: '#777777',
          confirmButtonText: i18n.__('dialog.removeSmartFolder.button'),
          cancelButtonText: i18n.__('general.cancel'),
        }).then(function () {
          removeSmartFolderClosure(smartFolder, {});
        });
      }, 100);
    }).apply(null, args);
  };

  fns["removeSelectedSmartFolders"] = function (...args) {
    const s = getScope();
    if (!s) return;
    return (function () {
      if (s.$root.selectedSmartFolders.length === 0) return;

      var removeConfirmMsg = $filter('i18n')('dialog.removeSmartFolder.descMultiple', [
        { property: 'count', value: s.$root.selectedSmartFolders.length },
      ]);
      swal({
        html: `
                        <div class="alert">
                            <div class="alert-icon warning"></div>
                            <h4 class="alert-title">${$filter('i18n')('dialog.removeSmartFolder.title')}</h4>
                            <p class="alert-desc">${removeConfirmMsg}</p>
                        </div>
                    `,
        showCloseButton: false, showCancelButton: true, allowOutsideClick: false, focusConfirm: true, focusCancel: false, padding: 24,
        width: 400,
        customClass: 'alert-box',
        cancelButtonColor: '#777777',
        confirmButtonText: $filter('i18n')('dialog.removeSmartFolder.button'),
        cancelButtonText: $filter('i18n')('general.cancel'),
      }).then(function (result: any) {
        s.$root.selectedSmartFolders.forEach(function (smartFolder: any) {
          removeSmartFolderClosure(smartFolder, { ignoreRestore: true });
        });
        s.$root.selectedSmartFolders = [];
      }, function () {});
    }).apply(null, args);
  };

  // smartFolderExportAsPack（bundle 40267-40331 逐字；angular.extend→Object.assign）
  fns["smartFolderExportAsPack"] = function (...args) {
    const s = getScope();
    if (!s) return;
    return (function (event: any, smartFolder: any) {
      const w = window as any;
      var isInSmartFolder = function (sf: any, image: any) {
        if (sf.children && sf.children.length === 0 && sf.conditions && sf.conditions.length === 0) {
          return false;
        }
        else if (sf.children && sf.children.length > 0 && sf.conditions && sf.conditions.length === 0) {
          for (let i = 0; i < sf.children.length; i++) {
            let smartFolder = sf.children[i];
            if (s.existInSmartFilter(smartFolder, image)) {
              return true;
            }
          }
          return false;
        }
        else {
          return s.existInSmartFilter(s.currentSmartFolder, image);
        }
      };

      var f: any = {};
      var folderId = guid();
      var images: any[] = [];
      for (var i = 0; i < s.raw.length; i++) {
        var image = s.raw[i];
        if (image.isDeleted) continue;
        if (isInSmartFolder(smartFolder, image)) {
          var clone: any = {};
          Object.assign(clone, image);
          clone.folders = [folderId];
          images.push(clone);
        }
      }
      if (images.length === 0) return;
      Object.assign(f, smartFolder);
      f.id = folderId;
      f.images = images;
      delete f.children;

      var defaultPath = w.path.join('*/', 'Untitled' + '.eaglepack');
      if (smartFolder) {
        defaultPath = w.path.join('*/', smartFolder.name.replace(/^\./, '') + '.eaglepack');
      }

      dialog.showSaveDialog(currentWindow, {
        defaultPath: defaultPath,
        title: i18n.__('Context.Image.Export'),
        filters: [{ name: 'Eagle Package File', extensions: ['eaglepack'] }]
      }).then((result: any) => {
        var savePath = result.filePath;
        if (!savePath) return;
        if ((window as any).backgroundWindowID === undefined) {
          IPCHelper.send('export-images', {
            folder: f,
            savePath: savePath
          });
        }
        else {
          IPCHelper.sendTo((window as any).backgroundWindowID, 'export-images', {
            folder: f,
            savePath: savePath
          });
        }
      });
    }).apply(null, args);
  };

  // smartFolderExportAsFolder（bundle 40333-40430 逐字）
  fns["smartFolderExportAsFolder"] = function (...args) {
    const s = getScope();
    if (!s) return;
    return (function (event: any, smartFolder: any) {
      const w = window as any;
      var isInSmartFolder = function (sf: any, image: any) {
        if (sf.children && sf.children.length === 0 && sf.conditions && sf.conditions.length === 0) {
          return false;
        }
        else if (sf.children && sf.children.length > 0 && sf.conditions && sf.conditions.length === 0) {
          for (let i = 0; i < sf.children.length; i++) {
            let smartFolder = sf.children[i];
            if (s.existInSmartFilter(smartFolder, image)) {
              return true;
            }
          }
          return false;
        }
        else {
          return s.existInSmartFilter(s.currentSmartFolder, image);
        }
      };

      s.exportFolder(function (savePath: any) {
        var f: any = {};
        var folderId = guid();
        var images: any[] = [];
        if (savePath) {
          for (var i = 0; i < s.raw.length; i++) {
            var image = s.raw[i];
            if (image.isDeleted) continue;
            if (isInSmartFolder(smartFolder, image)) {
              var clone: any = {};
              Object.assign(clone, image);
              clone.folders = [folderId];
              images.push(clone);
            }
          }
          if (images.length === 0) return;
          Object.assign(f, smartFolder);
          f.id = folderId;
          f.images = images;
          delete f.children;
          var folderDir = w.path.normalize(savePath + '/' + smartFolder.name.replace(/\//g, ' ').replace(/\\/g, ' ').replace(/%/g, ''));
          if (fs.existsSync(folderDir)) {
            var message = $filter('i18n')('Dialog.Folder.Export.As.Folder.Message', [
              { property: 'folderDir', value: folderDir }
            ]);

            swal({
              html: `
                                <div class="alert">
                                    <div class="alert-icon warning"></div>
                                    <h4 class="alert-title">${i18n.__('Dialog.Folder.Export.As.Folder.Title')}</h4>
                                    <p class="alert-desc">${message}</p>
                                </div>
                            `,
              showCloseButton: false, showCancelButton: true, allowOutsideClick: false, focusConfirm: true, focusCancel: false, padding: 24,
              width: 400,
              customClass: 'alert-box',
              cancelButtonColor: '#777777',
              confirmButtonText: i18n.__('Dialog.Folder.Export.As.Folder.Button'),
              cancelButtonText: i18n.__('general.cancel'),
            }).then(function () {
              if ((window as any).backgroundWindowID === undefined) {
                IPCHelper.send('export-as-folder', {
                  folder: f,
                  images: images,
                  savePath: savePath
                });
              }
              else {
                IPCHelper.sendTo((window as any).backgroundWindowID, 'export-as-folder', {
                  folder: f,
                  images: images,
                  savePath: savePath
                });
              }
            });
          }
          else {
            if ((window as any).backgroundWindowID === undefined) {
              IPCHelper.send('export-as-folder', {
                folder: f,
                images: images,
                savePath: savePath
              });
            }
            else {
              IPCHelper.sendTo((window as any).backgroundWindowID, 'export-as-folder', {
                folder: f,
                images: images,
                savePath: savePath
              });
            }
          }
        }
      });
    }).apply(null, args);
  };

  // newSmartFolder / newChildSmartFolder / newSmartFolderGroup / prependFolder（bundle 39866-39910 逐字）
  fns["newSmartFolder"] = function (...args) {
    const s = getScope();
    if (!s) return;
    return (function (event: any, smartFolder: any) {
      s.$root.$broadcast('NEW.SMART.FOLDER', { smartFolder: smartFolder, parent: undefined });
    }).apply(null, args);
  };

  fns["newChildSmartFolder"] = function (...args) {
    const s = getScope();
    if (!s) return;
    return (function (event: any, smartFolder: any) {
      s.$root.$broadcast('NEW.SMART.FOLDER', { smartFolder: smartFolder || s.currentSmartFolder, parent: smartFolder });
    }).apply(null, args);
  };

  fns["newSmartFolderGroup"] = function (...args) {
    const s = getScope();
    if (!s) return;
    return (function (event: any) {
      const w = window as any;
      var smartFolderGroup = {
        id: guid(),
        name: i18n.__('general.untitled.title'),
        modificationTime: Date.now(),
        children: [],
        conditions: [],
        icon: 'grid'
      };
      s.smartFolders.push(smartFolderGroup);
      s.updateSidebarList();
      s.saveFolder();
      w.analytics.event('SmartFolder', 'CreateGroup');
      return smartFolderGroup;
    }).apply(null, args);
  };

  fns["prependFolder"] = function (...args) {
    const s = getScope();
    if (!s) return;
    return (function (folder: any) {
      s.folders.unshift(folder);
      s.folderMappings[folder.id] = folder;
      s.updateSidebarList();
      setTimeout(function () {
        s.calculateImageBinding({ ignoreSort: true }, function () {
          s.saveFolder();
        });
      }, 1000);
    }).apply(null, args);
  };

  // openNewSmartFolderContextMenu（bundle 39878-39910 逐字）
  fns["openNewSmartFolderContextMenu"] = function (...args) {
    const s = getScope();
    if (!s) return;
    return (function (event: any) {
      ContextMenu.open({
        items: [
          {
            label: i18n.__('appmenu.file>createSmartFolder'),
            icon: 'ic-smart-folder-new.svg',
            accelerator: preferences.shortcuts.keybinds['file.create.smartfolder'],
            click: () => {
              s.newSmartFolder(event);
              s.$evalAsync();
            }
          },
          {
            label: i18n.__('appmenu.file>createSmartFolderGroup'),
            icon: 'ic-smart-folder-new-group.svg',
            click: () => {
              var smartFolderGroup = s.newSmartFolderGroup(event);
              s.openSmartFolder(smartFolderGroup);
              $timeout(function () {
                s.renameSmartFolder(event, smartFolderGroup);
              }, 150);
              s.$evalAsync();
            }
          }
        ],
        showSearch: false,
      });
    }).apply(null, args);
  };

  // openSmartFolderContextMenu（bundle 39550-39877 逐字；多选/单选双分支）
  fns["openSmartFolderContextMenu"] = function (...args) {
    const s = getScope();
    if (!s) return;
    return (function (event: any, smartFolder: any) {
      const w = window as any;

      if (event && event.target && event.target.tagName === 'INPUT') return;

      const isOpenQuickAccess = s.$root.preferences.sidebar.quickAccess != 'false';
      const isAddedQuickAccess = w.QuickAccessManager.indexOf(smartFolder) > -1;
      const isMultiple = s.$root.selectedSmartFoldersMappings && s.$root.selectedSmartFoldersMappings[smartFolder.id];
      const selectedSmartFolders = s.$root.selectedSmartFolders;

      let items: any = null;
      let historyLibraryMenu: any = {};

      historyLibraryMenu.items = s.getLibraryHistory().filter((history: any) => {
        var isCurrent = false;
        if (s.libraryPath) {
          isCurrent = w.path.normalize(history.path) == w.path.normalize(s.libraryPath);
        }
        return !isCurrent;
      }).map((history: any) => {
        return {
          label: history.name,
          keywords: 'library 資源庫',
          accelerator: history.dir,
          icon: 'ic-library-logo.svg',
          click: () => {
            s.$root.$broadcast('ADD_TO_LIBRARY', {
              smartFolder: smartFolder,
              items: [],
              library: history
            });
            s.$evalAsync();
          }
        };
      });

      if (isMultiple && selectedSmartFolders.length > 1) {

        // 當前的排序方式
        const currentOrder = selectedSmartFolders.reduce((prev: any, current: any) => {
          return ((prev && prev.orderBy) === (current && current.orderBy)) ? (prev && prev.orderBy) : undefined;
        }, undefined);

        const currentOrderIncrease = selectedSmartFolders.reduce((prev: any, current: any) => {
          return ((prev && prev.sortIncrease) === (current && current.sortIncrease)) ? (prev && prev.sortIncrease) : undefined;
        }, undefined);

        let defaultOrderItem = {
          checked: !currentOrder,
          label: i18n.__('context.order.orderBy>default'),
          icon: 'ic-order-by.svg',
          click: () => {
            s.setSmartFoldersOrder(selectedSmartFolders, undefined);
          }
        };

        let orderItems = ['import', 'mtime', 'btime', 'name', 'ext', 'filesize', 'resolution', 'rating', 'duration', 'random'].map((order) => {
          const uppercase = order && order.toUpperCase();
          return {
            checked: currentOrder === uppercase,
            label: i18n.__(`context.order.orderBy>${order}`),
            keywords: order,
            icon: `ic-order-by-${order}.svg`,
            click: () => {
              s.setSmartFoldersOrder(selectedSmartFolders, uppercase || undefined);
            }
          };
        });

        let increaseItems = [
          {
            checked: currentOrderIncrease === true,
            label: i18n.__('context.order.orderBy>increase'),
            icon: 'ic-order-by-increase.svg',
            click: () => {
              s.setSmartFoldersSortIncrease(selectedSmartFolders, true);
            }
          },
          {
            checked: currentOrderIncrease === false,
            label: i18n.__('context.order.orderBy>decrease'),
            icon: 'ic-order-by-decrease.svg',
            click: () => {
              s.setSmartFoldersSortIncrease(selectedSmartFolders, false);
            }
          },
        ];

        let orderByItems = [defaultOrderItem, ...orderItems, { role: 'separator' }, ...increaseItems];

        items = [
          // 修改排序
          {
            label: i18n.__('context.order.label.orderBy'),
            icon: 'ic-order-by.svg',
            submenu: {
              items: orderByItems
            }
          },
          // 添加到最愛 / 從最愛移除
          {
            visible: isOpenQuickAccess,
            role: 'separator'
          },
          {
            visible: isOpenQuickAccess && !isAddedQuickAccess,
            label: i18n.__('context.smartFolder.quickAccessAdd'),
            keywords: '最愛 加入 快速存取 add quick access favorite',
            icon: 'ic-favorite-add.svg',
            click: () => {
              w.QuickAccessManager.addMultiple('smartFolder', selectedSmartFolders);
              s.$evalAsync();
            }
          },
          {
            visible: isOpenQuickAccess && isAddedQuickAccess,
            label: i18n.__('context.smartFolder.quickAccessRemove'),
            keywords: '最愛 移除 快速存取 remove quick access favorite',
            icon: 'ic-favorite-remove.svg',
            click: () => {
              w.QuickAccessManager.removeMultiple('smartFolder', selectedSmartFolders);
              s.$evalAsync();
            }
          },
          // 批次命名
          {
            accelerator: s.$root.preferences.shortcuts.keybinds[`edit.rename.${w.process.platform}`],
            label: i18n.__('context.image.batchRename.msg1') + selectedSmartFolders.length + i18n.__('context.image.batchRename.msg2'),
            keywords: '重命名 重新命名 rename',
            icon: 'ic-rename.svg',
            click: () => {
              s.batchRenameSmartFolders(event);
              s.$evalAsync();
            }
          },
          {
            role: 'separator'
          },
          // emoji
          {
            label: i18n.__('context.smartFolder.changeIcon'),
            icon: 'ic-emoji.svg',
            submenu: {
              items: [{
                role: 'emoji',
                click: (emoji: any) => {
                  s.changeSelectedSmartFoldersIcon(event, emoji);
                }
              }]
            }
          },
          // color
          {
            role: 'color',
            click: (color: any) => {
              s.changeSelectedSmartFoldersColor(event, color);
              s.$evalAsync();
            }
          },
          // ---
          // 刪除
          {
            role: 'separator'
          },
          {
            accelerator: (w.process.platform === 'win32') ? 'Delete' : 'CmdOrCtrl+⌫',
            label: i18n.__('context.smartFolder.removeFolder'),
            keywords: '資料夾 文件夾 刪除 移除 remove delete smart folder dir',
            icon: 'ic-smart-folder-remove.svg',
            click: () => {
              s.removeSelectedSmartFolders();
              s.$evalAsync();
            }
          },
        ];
      }
      else {
        items = [
          // 新增智能文件夾
          {
            label: i18n.__('context.smartFolder.newSmartFolder'),
            keywords: '資料夾 文件夾 新建 建立 新增 智能 智慧 new create smart',
            icon: 'ic-smart-folder-new.svg',
            click: function () {
              s.newSmartFolder(event, smartFolder);
              s.$evalAsync();
            }
          },
          // 新增子文件夾
          {
            label: i18n.__('context.folder.newSubFolder'),
            keywords: '資料夾 文件夾 新建 建立 新增 智能 智慧 子 smart folder dir new create sub child',
            icon: 'ic-smart-folder-new-sub.svg',
            click: function () {
              s.newChildSmartFolder(event, smartFolder);
              s.$evalAsync();
            }
          },
          // 重命名
          {
            accelerator: s.$root.preferences.shortcuts.keybinds[`edit.rename.${w.process.platform}`],
            label: i18n.__('context.smartFolder.renameFolder'),
            keywords: '重命名 重新命名 rename',
            icon: 'ic-rename.svg',
            click: () => {
              s.renameSmartFolder(event, smartFolder);
              s.$evalAsync();
            }
          },
          // 修改規則
          {
            accelerator: preferences.shortcuts.keybinds['edit.folder.setting'],
            label: i18n.__('context.smartFolder.editRules'),
            keywords: '規則 修改 編輯 edit rule',
            icon: 'ic-smart-folder-rule.svg',
            click: () => {
              s.settingFolder(event, smartFolder);
              s.$evalAsync();
            }
          },
          // 克隆
          {
            label: i18n.__('context.smartFolder.clone'),
            keywords: '複製 克隆 clone',
            icon: 'ic-clone.svg',
            click: () => {
              s.cloneSmartFolder(event, smartFolder);
              s.$evalAsync();
            }
          },
          // 複製連結
          {
            label: i18n.__('appmenu.edit>copyAsLink'),
            keywords: '複製 連結 copy link',
            icon: 'ic-copy-link.svg',
            click: () => {
              s.copySmartFolderLink(event, smartFolder);
              s.$evalAsync();
            }
          },
          // 刷新
          {
            label: i18n.__('context.order.refresh'),
            keywords: '刷新 重新載入 refresh reload',
            icon: 'ic-refresh.svg',
            click: () => {
              s.refreshSmartFolderCount(event);
              s.$evalAsync();
            }
          },
          // 添加到最愛 / 從最愛移除
          {
            visible: isOpenQuickAccess,
            role: 'separator'
          },
          {
            visible: isOpenQuickAccess && !isAddedQuickAccess,
            label: i18n.__('context.smartFolder.quickAccessAdd'),
            keywords: '最愛 加入 快速存取 add quick access favorite',
            icon: 'ic-favorite-add.svg',
            click: () => {
              w.QuickAccessManager.add('smartFolder', smartFolder);
              s.$evalAsync();
            }
          },
          {
            visible: isOpenQuickAccess && isAddedQuickAccess,
            label: i18n.__('context.smartFolder.quickAccessRemove'),
            keywords: '最愛 移除 快速存取 remove quick access favorite',
            icon: 'ic-favorite-remove.svg',
            click: () => {
              w.QuickAccessManager.remove('smartFolder', smartFolder);
              s.$evalAsync();
            }
          },
          // ---
          {
            role: 'separator'
          },
          // 導出
          {
            icon: 'ic-export.svg',
            label: i18n.__('context.smartFolder.export'),
            submenu: {
              items: [
                {
                  label: i18n.__('context.smartFolder.export>computer'),
                  keywords: '導出 エクスポート 本地 export computer local',
                  icon: 'ic-export-computer.svg',
                  click: () => {
                    s.smartFolderExportAsFolder(event, smartFolder);
                    s.$evalAsync();
                  }
                },
                {
                  label: i18n.__('context.smartFolder.export>eaglepack'),
                  keywords: '導出 エクスポート export eaglepack',
                  icon: 'ic-export-eaglepack.svg',
                  click: () => {
                    s.smartFolderExportAsPack(event, smartFolder);
                    s.$evalAsync();
                  }
                }
              ]
            }
          },
          // 添加至資源庫
          {
            label: i18n.__('context.image.addToLibrary'),
            keywords: '',
            icon: 'ic-library-add-to.svg',
            submenu: historyLibraryMenu
          },
          // ---
          // emoji
          {
            label: i18n.__('context.smartFolder.changeIcon'),
            icon: 'ic-emoji.svg',
            submenu: {
              items: [{
                role: 'emoji',
                click: (emoji: any) => {
                  s.changeSmartFolderIcon(event, smartFolder, emoji);
                }
              }]
            }
          },
          // color
          {
            role: 'color',
            click: (color: any) => {
              s.changeSmartFolderColor(event, smartFolder, color);
              s.$evalAsync();
            }
          },
          // ---
          // 刪除
          {
            role: 'separator'
          },
          {
            accelerator: (w.process.platform === 'win32') ? 'Delete' : 'CmdOrCtrl+⌫',
            label: i18n.__('context.smartFolder.removeFolder'),
            keywords: '資料夾 文件夾 刪除 移除 remove delete smart folder dir',
            icon: 'ic-smart-folder-remove.svg',
            click: () => {
              s.removeSmartFolder(smartFolder);
              s.$evalAsync();
            }
          },
        ];
      }

      const folderEl = event && event.currentTarget;
      ContextMenu.open({
        items: items,
        showSearch: true,
        onOpened: () => {
          try { folderEl && folderEl.classList && folderEl.classList.add('context-activate'); } catch (err) {}
        },
        onClosed: () => {
          try { folderEl && folderEl.classList && folderEl.classList.remove('context-activate'); } catch (err2) {}
        }
      });
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
