/**
 * b1-9bt：fontTagService —— 字体操作族 + tag 漏网收口（S7 收官）。
 *
 * 居民（12 个，逐字；原 controllerFns fns 表条目，install 工厂同 bo-bs）：
 * - 字体族 8：activateFont / deactivateFont / activateFonts / deactivateFonts /
 *   renameFontsWithFullName / changeFontDefaultLang / isFontActivate / getFontPath
 *   （installedFonts 初扫在 bundleGlobals；TagManager 域在 core/tagManagerDomain）
 * - tag 漏网 4（S3 遗留）：filterWithTag / renameTagGroupKeyup / renameTagGroupBlur /
 *   onTagSidebarResize
 *
 * 符号解析面（imageOpsService 同模式）：
 * - i18n/eagle/swal/process → window 全局回退
 * - fs/sanitize → _req 惰性（app-root-path 定位）
 * - $filter → 双轨 shim；ipcRenderer → electron 同源
 */
// @ts-nocheck

import { syncSidebarFromScope } from '../store/sidebarState';
import { syncTagManagerFromScope } from '../store/tagManagerState';
import { syncBodyFromScope } from '../store/bodyState';
import { getBodyScope } from '../core/appCore';
import { excludeWithTag } from './batchOpsService';
import { rebindRefreshcontainsizeChannel } from '../global/bus';
import { setScrollTop } from '../utils/domQuery';
import { machineryUpdateSliderPosition } from './gridService';
import { machineryRelayout } from './gridService';
import { machineryCheckOperationSafety } from './viewOpsService';
import { machineryCalculateImageBinding, machineryRebindRefresh, machineryUpdateItemsView } from '../core/itemDomain';
import { machineryCalculateFilterCounts, machineryFilterContent } from '../core/filterDomain';
import { getFilter as machineryGetFilter } from '../core/filterDomain';
import { machineryUpdateSelection } from '../core/selectionViewDomain';
import { useMiscRawState } from '../store/miscRawState';
import { useSelectionState } from '../store/selectionState';
import { useBodyState } from '../store/bodyState';
import { useLayoutState } from '../store/layoutState';
import { usePreferencesState } from '../store/preferencesState';
const _req: any = (n: string) => { try { return (window as any).require(n); } catch (err) { return undefined; } };
// b1-9bl-B：bo-bt 迁移漏带的闭包 link 变量（原 controllerFns closure 层共享 var）。
// 服务侧本地重建解析（controllerFns initLinkVars 同式），使各 fn 首行
// try { initLinkVars(); } 从 no-op 转为真实供给。
var __lv_TagManager;
var __lv_onTagSidebarResizeTimeout;
var __lv_path;
const initLinkVars = () => {
	const s0: any = getBodyScope();
	if (s0 && useMiscRawState.getState().TagManager) __lv_TagManager = useMiscRawState.getState().TagManager;
	if (!__lv_path) __lv_path = _req('path');
};

const i18n: any = (window as any).i18n;
const eagle: any = (window as any).eagle;
const swal: any = (...args: any[]) => (window as any).swal(...args);
const ipcRenderer: any = (window as any).__eagleIpc || (window as any).electron?.ipcRenderer;
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

/* 12 fns（逐字；fns/getScope 为闭包注入） */
export function deactivateFont(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getBodyScope();
    if (!s) return;
    return (function (font, {showNotify, updateView}) {
            if (!font) return;
            if (font.activating || font.deactivating) return;
            var key = Object.keys(font.fontMetas.postScriptName)[0];
            var name = font.name + "." + font.ext;
            var postScriptName = font.fontMetas.postScriptName?.[key];
            var fullName = font?.fontMetas?.fullName?.en || font?.fontMetas?.compatibleFullName?.en;
            var outPath = `${fontFolder}/${postScriptName}.${font.ext}`;
            var folderPath = __lv_path.normalize(useMiscRawState.getState().libraryPath + "/images/" + font.id + ".info/");
            var rawPath = __lv_path.normalize(folderPath + name);
            if (process.platform === 'darwin') {
                if (fs.existsSync(outPath)) {
                    fse.removeSync(`${fontFolder}/${postScriptName}.${font.ext}`);
                    installedFonts[`${postScriptName}_.${font.ext}`] = false;
                    eagle.filter.filterCounts['fontActivated']['activated']--;
                    eagle.filter.filterCounts['fontActivated']['deactivated']++;
                }
                if (updateView) {
                    machineryUpdateItemsView(s, [font]);
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
                machineryUpdateItemsView(s, [font]);
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
}

export function activateFont(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getBodyScope();
    if (!s) return;
    return (function (font, {showNotify, updateView}) {
            if (!font) return;
            if (font.activating || font.deactivating) return;
            var name = font.name + "." + font.ext;
            var key = Object.keys(font.fontMetas.postScriptName)[0];
            var postScriptName = font.fontMetas.postScriptName?.[key];
            var fullName = font?.fontMetas?.fullName?.en || font?.fontMetas?.compatibleFullName?.en;
            var folderPath = __lv_path.normalize(useMiscRawState.getState().libraryPath + "/images/" + font.id + ".info/");
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
                    machineryUpdateItemsView(s, [font]);
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
                machineryUpdateItemsView(s, [font]);
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
}

export function renameFontsWithFullName(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getBodyScope();
    if (!s) return;
    return (function (items) {
        if (items && items.length > 0) {
            machineryCheckOperationSafety(s, function () {
                var updates = [];
                var lng = usePreferencesState.getState().preferences.general.language;
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
                                var fontFamily = get(item.fontMetas, `fontFamily.${preferLng}`, undefined) || get(item.fontMetas, `fontFamily.en`, "");
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
                machineryUpdateItemsView(s, items);
                machineryCalculateImageBinding(s, {}, function () {
                    machineryRebindRefresh(s, true);
                    machineryUpdateSelection(s);
                });
            }, 10);
        }
    }).apply(null, args);
}

export function activateFonts(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getBodyScope();
    if (!s) return;
    return (function (items) {
        if (!items || items.length === 0) return;
        if (!fs.existsSync(fontFolder)) {
            fs.mkdirSync(fontFolder);
        }
        items.forEach(function (font) {
            activateFont(font, {showNotify: false, updateView: false});
        });
        if (process.platform === 'darwin') {
            machineryUpdateItemsView(s, items);
        }
        s.notify({
            message: $filter('i18n')("notify.fonts.activate", [
                        { "property": "count", "value": items.length }
                    ]),
            duration: 1000
        });
        analytics.event("Font", "Install");
    }).apply(null, args);
}

export function deactivateFonts(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getBodyScope();
    if (!s) return;
    return (function (items) {
        if (!fs.existsSync(fontFolder)) { return; }
        items.forEach(function (font) {
            deactivateFont(font, {showNotify: false, updateView: false});
        });
        if (process.platform === 'darwin') {
            machineryUpdateItemsView(s, items);
        }

        s.notify({
            message: $filter('i18n')("notify.fonts.deactivate", [
                        { "property": "count", "value": items.length }
                    ]),
            duration: 1000
        });
        analytics.event("Font", "Uninstall");
    }).apply(null, args);
}

export function changeFontDefaultLang(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getBodyScope();
    if (!s) return;
    return (function (items, lang) {
        if (items && items.length > 0) {
            machineryCheckOperationSafety(s, function () {
                items.forEach(function (item) {
                    item.fontMetas.preferLng = lang;
                });
                ipcRenderer.send('regenerate-thumbnail', items);
            }, 10);
        }
    }).apply(null, args);
}

export function isFontActivate(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getBodyScope();
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
}

export function getFontPath(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getBodyScope();
    if (!s) return;
    return (function() {
            if (useSelectionState.getState().current) {
                return `./font-viewer/font-viewer.html?id=${useSelectionState.getState().current.id}&theme=${useBodyState.getState().theme}&language=${useBodyState.getState().language}`;
            }
        }).apply(null, args);
}

export function filterWithTag(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getBodyScope();
    if (!s) return;
    return (function (tag) {

            if (tag.isExcluded) {
                excludeWithTag(tag);
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
                setScrollTop("#filter-panel .tags-container", 0);
            }

            machineryFilterContent(s);
            machineryCalculateFilterCounts(s);
        }).apply(null, args);
}

export function renameTagGroupKeyup(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getBodyScope();
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
}

export function renameTagGroupBlur(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getBodyScope();
    if (!s) return;
    return (function (__lv_group, newName) {
            if (newName) {
                __lv_TagManager.renameGroup(__lv_group.id, newName);
                delete __lv_group.editable;
            }
        }).apply(null, args);
}

export function onTagSidebarResize(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getBodyScope();
    if (!s) return;
    return (function(e, ui) {
            if (ui && ui.size.width >= 200) {
                useLayoutState.getState().containerSize.tagSidebar = ui.size.width;
                syncBodyFromScope();
                syncSidebarFromScope();
                syncTagManagerFromScope();
                rebindRefreshcontainsizeChannel.emit();
                // machineryUpdateSliderPosition(s);
                clearTimeout(__lv_onTagSidebarResizeTimeout);
                __lv_onTagSidebarResizeTimeout = setTimeout(function () {
                    // machineryRelayout(s);
                    // s.offsetScrollbar(30);
                    localStorage.setItem("eagle.containerSize.tagSidebar", ui.size.width);
                }, 500);
            }
        }).apply(null, args);
}
