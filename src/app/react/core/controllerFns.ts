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
import { detailZoom } from './smoothZoomEngine';
import { IPCHelper } from './ipcHelper';
// b1-8 裸引用审计修复：controller 闭包裸调改走 machinery 移植版直调（ESM 循环依赖——
// 双侧均为函数声明提升，无顶层执行面，运行时安全；colliding 名（calcuteContainFolders/
// toggleCurrentLevel{Folders,SmartFolders}）不经 scope 面，避免覆盖 bundle $scope 同名体）
import { machineryGetVideoPlayer, machineryCalcRotateDegree, machineryGetFolderParentChilder,
  machineryGetArroundBox, machineryGetAncestorSmartFolders, machineryCalcuteContainFolders,
  machineryToggleAllFolders, machineryToggleCurrentLevelFolders, machineryToggleAllSmartFoldersInner,
  machineryToggleCurrentLevelSmartFoldersInner, machineryFilterSidebarItem, getFilter as machineryGetFilter } from './dataMachinery';
// b1-9bn：菜单族竖切——builder 迁 itemMenuService；URL_MODULE/ContextMenu/renameImages 迁
// contextMenuDomain（getContextMenu 供其余 8 个菜单 builder 暂留消费，bo 批随频道切换一并归位）
import { itemMenuOpenItemContextMenu } from '../services/itemMenuService';
import { installFolderMenuFns } from '../services/folderMenuService';
import { installMiscMenuFns } from '../services/miscMenuService';
import { installBatchOpsFns, cancelCleanSelectedTimeout } from '../services/batchOpsService';
import { installFolderCoreFns } from '../services/folderCoreService';
import { installImageOpsFns } from '../services/imageOpsService';
import { installFontTagFns } from '../services/fontTagService';
import { ContextMenu, renameImages } from './contextMenuDomain';
import { contextMenuOpenChannel } from '../global/bus';
import { debounce, throttle } from '../utils/func';
import { get, isString, unescape } from '../utils/lang';

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
// b1-9bc：原 window._（lodash）消费面已原生化——copyTags 用 utils/func throttle、
// renameFontsWithFullName 用 utils/lang get、openFilesWithDefault 用 utils/func debounce；
// showFinderAlert 为 bundle 19064-19068 顶层 var，localStorage 初始化）
const clipboard: any = _req('electron')?.clipboard || (window as any).clipboard;
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

// b1-9bn：URL_MODULE / ContextMenu / renameImages 已迁 contextMenuDomain.ts



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
      name = unescape(name);
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
  // __lv_cleanSelectedTimeout → batchOpsService 模块单源（b1-9bl-B；select 取消点走
  // cancelCleanSelectedTimeout 导出，保持 select 取消 pending cleanSelected timer 契约）
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

      __lv_setLastFolder = debounce(function setLastFolder (folderId: any) {
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


  /* addImagesToFolder（bundle 43132-43198 逐字；b1-9d 供给缺口补齐——155 fns 抽取时漏项，
     m1 `scope.addImagesToFolder is not a function` 即此。两处适配：angular.copy → 数组切片
     （shim 世界无 angular；folders/tags 皆字符串数组，非数组原样保留同 angular.copy 语义），
     angular.element(document.body).injector().get('$filter') → 本模块 $filter shim。） */

  // ── b1-9k：四個「小函数」补端口（b1-9g 台账根因 4a/4b/4e；bundle 逐字 + $scope→s 适配）──

  /* cancelEmptyTrash（bundle 33602-33608 逐字；EmptyTrashProgress 取消按钮守卫式调用
     s.cancelEmptyTrash——缺席时 isCleaningTrash 恒 true、对话框永不关。backgroundWindowID
     为 bundle link var（window live binding）；shim 世界无背景窗，IPCHelper.sendTo 内部
     try/catch 兜住 undefined id，与 ayncsImagesChange 的 undefined 判定同型） */

  /* emptyTrash（bundle 37013-37094 逐字；trash 右键菜单「清空回收站」唯一激活路径——
     isCleaningTrash=true 由此置位驱动 EmptyTrashProgress；物理删除经 ayncsImagesRemove
     分批发 empty-trash → main b1-9ar 逐 id 落 backend） */

  /* emptyRestore（bundle 37096-37137 逐字；trash 右键菜单「全部恢复」——isDeleted=false
     + ayncsImagesChange 回存） */

  /* openTrashContextMenu（bundle 37924-37952 逐字；侧栏 trash 右键菜单——
     「清空回收站/全部恢复」双项，disabled = trash 空） */

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

  /* openOrderMenu（bundle 45253-45257 逐字；Toolbar 排序按钮 + 列表右键共用——
     此前缺席致排序按钮点击无效果） */

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

  /* addToFolders（bundle 43200-43210 逐字；「添加到文件夹」入口——广播 OPEN-ADD-FOLDER-MODAL
     打开 FolderModals。eagle.inspector.calculateFolders 由 eagleClasses 供给（bare eagle 经
     window 全局回退解析，与同文件 ayncsImagesChange 同型） */

  /* createFolder（bundle 40538-40604 逐字；body 级 options 版——selectPanelEngine 的
     新建文件夹 confirm 回调走 getBodyScope().createFolder({name,...})。guid 为 bundle
     全局（bundleGlobals 供给 w.guid，bare 经 window 全局回退解析） */


  /* openItemContextMenu（b1-9bn：1,159 行 async 构建器整体迁 itemMenuService；
     fns 表留壳走 itemMenuOpenItemContextMenu，挂载面/键位表/内部调用零改动） */
  fns["openItemContextMenu"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    return itemMenuOpenItemContextMenu(getScope(), ...args);
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
            	detailZoom()?.goToY( -99999999);
            	detailZoom()?.moveY( -window.outerHeight + 60);
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
                // b1-9bj：原 ColorPickerSetColor 随 vendor 退役——自研 picker 经 props 从
                // rules.color.value 派生，此处写面即外部同步
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
            	detailZoom()?.goToY( 40);
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
                detailZoom()?.goTo( state.data.tX, state.data.tY, state.data.rA);
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
                detailZoom()?.cleanBitmapViewer();
                detailZoom()?.clearPreloadData();
                
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



  fns["openQuickSearch"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function (event) {
            s.$root.$broadcast('OPEN_QUICK_SEARCH_MODAL');
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

            cancelCleanSelectedTimeout();

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
                detailZoom()?.updateNavigator( $bodyScope.current);
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
                detailZoom()?.cleanBitmapViewer();
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
                detailZoom()?.updateNavigator( $bodyScope.current);
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
                detailZoom()?.cleanBitmapViewer();
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
                detailZoom()?.updateNavigator( $bodyScope.current);
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
                detailZoom()?.updateNavigator( $bodyScope.current);
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
            detailZoom()?.focusTo( {
                x: __lv_width / 2,
                y: __lv_height / 2 + __lv_offsetY,
                zoom: s.imageSize.zoomRatio,
                speed: 0
            });
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
                // b1-9ba：OPEN_LIBRARY_PANEL 廣播全樹無接收者（library-panel 指令檔從未
                // 掛載，bundle 摘除後徹底死亡）——廣播體移除；程式庫面板豎切時按 React
                // 語義歸位。
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
            
            detailZoom()?.focusTo( {
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
            detailZoom()?.focusTo( {
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








  // openWithOther（bundle 33061-33065）
  let __cc_openWithOther: any = null;
  fns["openWithOther"] = function (...args) {
    if (!__cc_openWithOther) {
      __cc_openWithOther = debounce(function () {
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
        return debounce(function () {
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
      __cc_openFilesWithDefault = debounce(function(files) {
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
  // b1-9bo：CONTEXTMENU 频道已切 eagleBus（ContextMenuPanel 经 bus.on 监听）。
  // onOpened/onClosed 的 $(event.delegateTarget) → React synthetic currentTarget classList。

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

  // openFolderExpandContextMenu（bundle 38578-38618 逐字；b1-9bo：直发广播改
  // eagleBus 频道——CONTEXTMENU 频道原子切换面之一）
  fns["openFolderExpandContextMenu"] = function (...args) {
    const s2 = getScope();
    if (!s2) return;
    return (function (eventArg, folderArg) {
      eventArg.stopPropagation();
      const folderEl = eventArg && eventArg.currentTarget;
      contextMenuOpenChannel.emit({
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







  // b1-9bo：folder/smartFolder 菜单 + CRUD 族（ap/aq 台账区 + 三 builder，2,540 行）
  // 整体迁 folderMenuService——installFolderMenuFns 批量注册（条目名零改动）
  installFolderMenuFns(fns, getScope);
  // b1-9bp：剩余 10 个菜单 builder（trash/fileList/order/application/filterAdd/new/
  // quickAccess/ratio/sidebarVisible/smartFolderExpand，845 行）迁 miscMenuService
  installMiscMenuFns(fns, getScope);
  // b1-9bq：批量操作（移动/打标/删除/导出/回收站）19 fns 迁 batchOpsService
  installBatchOpsFns(fns, getScope);
  // b1-9br：文件夹核心操作族（创建/移动/归档/回收站恢复）7 fns 迁 folderCoreService
  installFolderCoreFns(fns, getScope);
  // b1-9bs：图像操作 + 视图更新族（rotate/flip/crop/replace/binding/update 族）16 fns
  // 迁 imageOpsService
  installImageOpsFns(fns, getScope);
  // b1-9bt：字体操作族 + tag 漏网（S3 遗留 4 fns）12 fns 迁 fontTagService——S7 收官
  installFontTagFns(fns, getScope);
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
