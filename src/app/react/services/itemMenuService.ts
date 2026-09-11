/**
 * b1-9bn：itemMenuService —— openItemContextMenu 1,159 行 async 构建器归位
 * （controllerFns fns 表留壳；挂载面/键位表零改动）。
 *
 * 逐字来源：controllerFns b1-9q/b1-9w 移植体（bundle 43452-44603 + 点击路径补端口）。
 * 显式化差异（controllerFns 为 @ts-nocheck + makeControllerFns 闭包；本文件为独立
 * service，符号解析面如下）：
 * - getScope 前导/initLinkVars → controllerFns 壳内完成（此处 s 由参数传入）
 * - $filter/ipcRenderer/electronLog/currentWindow/remote → 模块常量（controllerFns 同源解析）
 * - EagleConfig/VIDEO/AUDIO/FONT/NOT_SUPPORT_* → 模块常量（bundle 18982-19045 同源）
 * - URL_MODULE/ContextMenu/renameImages/openWithApplicationPath → contextMenuDomain
 * - bare eagle/$/i18n/$bodyScope/swal/preferences/process/path/require/appRoot/
 *   FileUrlHelper/pluginModule/ReverseImageSearch/ayncsImagesChange/ayncsImagesGeneratePalette/
 *   removePlayingAudios → window 全局回退（bundleGlobals 供给；Vite 编译后与 controllerFns
 *   既有形态等价，bo 批 CONTEXTMENU 频道切 eagleBus 时一并复核）
 */
// @ts-nocheck
import { URL_MODULE, ContextMenu, renameImages, openWithApplicationPath } from '../core/contextMenuDomain';
import { machineryOpenAll, machineryRemovePermanently, machineryToggleSlideshow } from '../core/dataMachinery';
import { machineryVideoScreenShot } from './mediaService';
import { syncInspectorFromScope } from '../store/inspectorState';
import { getBodyScope } from '../core/appCore';
import { copyAsBase64, copyAsFolderPath, copyAsLink, copyAsPath, copyAsProperity, copyAsThumbnail, openFilesWithDefault, openInFinder, openInPreviewWindow, openItemLocation, openWithOther } from '../core/itemDomain';
import { duplicateItem, getLibraryHistory } from './folderCoreService';
import { changeImagesBackground, resetCustomThumbnail, setCustomThumbnail, setCustomThumbnailFromClipboard } from './imageOpsService';
import { loadSubtitles, setAsVideoThumbnail } from './mediaService';
import { getNext } from './viewOpsService';
import { addToFolders, addToLastUsedFolder, copyTags, exportSelectedAsEaglepack, exportSelectedAsFolder, exportSelectedAsFormat, exportSelectedToCsv, pasteTags, removeFromFolder, scrollToSelectedItem } from './batchOpsService';
import { newFolderWidthSelection } from './folderCoreService';
import { activateFonts, changeFontDefaultLang, deactivateFonts, isFontActivate, renameFontsWithFullName } from './fontTagService';
import { regenerateThumbnail, replaceFile } from './imageOpsService';
import { addToLibraryChannel, glRemoveitemsChannel, webpConvertStartChannel } from '../global/bus';
import { scopeEvalAsync } from '../global/scopeShim';
import { machineryGetRecentFolders } from '../core/libraryDomain';
import { machineryCheckOperationSafety } from './viewOpsService';
import { machinerySetFolderCover } from '../core/libraryDomain';
import { machineryCalculateImageBinding, machineryCopyImages, machineryRebindRefresh } from '../core/itemDomain';
import { getFilter, machineryOpenFilter } from '../core/filterDomain';
import { getFilter as machineryGetFilter } from '../core/filterDomain';
import { machineryGetSelectedItemElements, machineryRemoveSelected } from '../core/selectionViewDomain';
const _req: any = (n: string) => { try { return (window as any).require(n); } catch (err) { return undefined; } };
const EagleConfig: any = (window as any).EagleConfig || {};
const VIDEO_TYPES: any = {}; (EagleConfig.VIDEO_FORMATS || []).forEach(function (ext: string) { VIDEO_TYPES[ext] = true; });
const AUDIO_TYPES: any = {}; (EagleConfig.AUDIO_FORMATS || []).forEach(function (ext: string) { AUDIO_TYPES[ext] = true; });
const FONT_TYPES: any = {}; (EagleConfig.FONT_FORMATS || []).forEach(function (ext: string) { FONT_TYPES[ext] = true; });
const NOT_SUPPORT_CUSTEOM_THUMBNAIL_TYPES: any = { tif: true, jpg: true, png: true, bmp: true, webp: true };
const electronLog: any = (window as any).electronLog || console;
const ipcRenderer: any = (window as any).__eagleIpc || (window as any).electron?.ipcRenderer;
const currentWindow: any = (window as any).electron?.remote?.getCurrentWindow?.() || _req('@electron/remote')?.getCurrentWindow?.();
const remote: any = _req('@electron/remote');
const $filter: any = (name: string) => {
  const s: any = getBodyScope();
  const root = s && s.$root;
  if (root && root.$filter) return root.$filter(name);
  // shim 世界无 $rootScope.$filter：退到 machinery 的 getFilter()（controllerFns 同源语义）
  const inst: any = machineryGetFilter();
  return inst ? inst(name) : undefined;
};

/* openItemContextMenu（bundle 43452-44603 逐字；适配面见文件头） */
export async function itemMenuOpenItemContextMenu(s: any, ...args: any[]): Promise<any> {
  const run = async (event: any, target: any) => {

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
                    openItemLocation(s.selected[0], folder);
                    scopeEvalAsync();
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
        historyLibraryMenu.items = getLibraryHistory().filter((history) => {
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
                    addToLibraryChannel.emit({
                        items: items,
                        library: history
                    });
                    scopeEvalAsync();
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
                    openWithOther();
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
                        machineryCalculateImageBinding(s, { ignoreSort: true }, () => {
                            machineryRebindRefresh(s, true);
                        });
                        const itemElements = machineryGetSelectedItemElements(s);
                        glRemoveitemsChannel.emit(itemElements);
                        ayncsImagesChange(items);
                        try { electronLog && electronLog.info(`[app] Restore ${items.length} files from trash`); } catch (err) {};
                        scopeEvalAsync();
                    }
                },
                // --- (還原)
                {
                    visible: item.isDeleted,
                    role: 'separator',
                },
                // 启用字型 (字體）
                {
                    disabled: !(!isFontActivate(item) && !item.activating && !item.deactivating),
                    visible: !!FONT_TYPES[item.ext],
                    label: i18n.__('Context.Image.Font.Activate'),
                    keywords: 'font activate enable 啟用 啟動 字型 字體',
                    icon: 'ic-font-activate.svg',
                    click: () => { activateFonts(items); },
                },
                // 停用字型 (字體）
                {
                    disabled: (!isFontActivate(item) && !item.activating && !item.deactivating),
                    visible: !!FONT_TYPES[item.ext],
                    label: i18n.__('Context.Image.Font.Deactivate'),
                    keywords: 'font deactivate disable 停用 停止 字型 字體',
                    icon: 'ic-font-deactivate.svg',
                    click: () => { deactivateFonts(items); },
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
                        setAsVideoThumbnail();
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
                        machineryVideoScreenShot(s, true);
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
                        machineryVideoScreenShot(s);
                    },
                },
                // 保存当前画面（視頻）
                {
                    visible: !!VIDEO_TYPES[item.ext] && isDetailMode,
                    label: i18n.__("context.image.loadSubtitles"),
                    keywords: 'srt subtitle 字幕',
                    icon: 'ic-video-load-subtitle.svg',
                    click: () => {
                        loadSubtitles();
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
                        openInPreviewWindow();
                    },
                },
                // 在默认应用打开
                {
                    accelerator: preferences.shortcuts.keybinds['view.file.opendefault'],
                    label: i18n.__('context.image.openInDefault'),
                    keywords: 'open default application 開啟 打開 默認 預設 應用',
                    icon: 'ic-open-default.svg',
                    click: () => {
                        openFilesWithDefault(s.selected);
                        scopeEvalAsync();
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
                        openInFinder();
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
                                openItemLocation(item, null);
                                scopeEvalAsync();
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
                    disabled: machineryGetRecentFolders(s).length === 0,
                    label: i18n.__('appmenu.find>addToLastFolder'),
                    keywords: 'add to last used folder 添加至上次使用的文件夾',
                    icon: 'ic-folder-last-used.svg',
                    accelerator: preferences.shortcuts.keybinds['organize.folder.addLast'],
                    click: () => {
                        addToLastUsedFolder();
                        scopeEvalAsync();
                    },
                },
                // 添加至文件夹...
                {
                    accelerator: s.$root.preferences.shortcuts.keybinds['find.add.to'] || 'CmdOrCtrl+Shift+J',
                    label: i18n.__('context.image.addToFolder'),
                    keywords: 'add to folder 添加至文件夾 添加到資料夾',
                    icon: 'ic-folder-add-to.svg',
                    click: () => {
                        addToFolders();
                        scopeEvalAsync();
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
                                    exportSelectedAsEaglepack();
                                }
                            },
                            {
                                label: i18n.__("context.image.export>computer"),
                                keywords: `${i18n.__("context.image.export")} export computer 匯出 導出 電腦`,
                                icon: 'ic-export-computer.svg',
                                accelerator:  preferences.shortcuts.keybinds['file.export.item.computer'],
                                click: () => {
                                    exportSelectedAsFolder();
                                }
                            },
                            {
                                label: i18n.__("context.image.exportAsFormat"),
                                icon: 'ic-export-format.svg',
                                keywords: `${i18n.__("context.image.export")} export as format 匯出 導出 格式`,
                                accelerator:  preferences.shortcuts.keybinds['file.export.item.as'],
                                click: () => {
                                    exportSelectedAsFormat();
                                    scopeEvalAsync();
                                }
                            },
                            {
                                label: i18n.__("context.image.exportToCsv"),
                                icon: 'ic-export-csv.svg',
                                keywords: 'export csv 導出 匯出',
                                accelerator:  preferences.shortcuts.keybinds['file.export.csv'],
                                click: () => {
                                    exportSelectedToCsv();
                                    scopeEvalAsync();
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
                        machineryCheckOperationSafety(s, () => {
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
                            machineryRebindRefresh(s);
                            // scrollToSelectedItem();
                            scopeEvalAsync();
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
                        machineryCheckOperationSafety(s, () => {
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
                            s.selected = [getNext()];
                            syncInspectorFromScope();
                            machineryRebindRefresh(s);
                            // scrollToSelectedItem();
                            scopeEvalAsync();
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
                        machinerySetFolderCover(s);
                        scopeEvalAsync();
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
                        newFolderWidthSelection();
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
                        scopeEvalAsync();
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
                        scopeEvalAsync();
                    },
                },
                // 复制文件
                {
                    accelerator: 'CmdOrCtrl+C',
                    label: (isMultiple)? i18n.__('context.image.copyItems'): i18n.__('context.image.copyItem'),
                    keywords: 'copy file 複製 文件',
                    icon: 'ic-file-copy.svg',
                    click: () => {
                        machineryCopyImages(s, event);
                        scopeEvalAsync();
                    },
                },
                // 复制文件路径
                {
                    accelerator: s.$root.preferences.shortcuts.keybinds['edit.copy.path'],
                    label: i18n.__('context.image.copyItemPath'),
                    keywords: 'copy path 複製 路徑',
                    icon: 'ic-file-copy-path.svg',
                    click: () => {
                        copyAsPath();
                        scopeEvalAsync();
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
                                    copyAsLink(undefined, items);
                                    scopeEvalAsync();
                                },
                            },
                            // 文件夹路径
                            {
                                accelerator: s.$root.preferences.shortcuts.keybinds['edit.copy.folderpath'],
                                label: i18n.__("context.image.copyAsFolderPath"),
                                keywords: `${i18n.__("context.image.copy")} copy folder path 拷貝 複製 文件夾 資料夾 路徑`,
                                icon: '',
                                click: () => {
                                    copyAsFolderPath();
                                    scopeEvalAsync();
                                },
                            },
                            // 缩略图
                            {
                                accelerator: s.$root.preferences.shortcuts.keybinds['edit.copy.thumbnail'],
                                label: i18n.__("context.image.copyAsThumbnail"),
                                keywords: `${i18n.__("context.image.copy")} copy thumbnail 拷貝 複製 縮略圖`,
                                icon: '',
                                click: () => {
                                    copyAsThumbnail();
                                    scopeEvalAsync();
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
                                    copyAsBase64();
                                    scopeEvalAsync();
                                },
                            },
                            // 名称
                            {
                                accelerator: s.$root.preferences.shortcuts.keybinds['edit.copy.name'],
                                label: i18n.__("context.image.copyAsName"),
                                keywords: `${i18n.__("context.image.copy")} copy name 拷貝 複製 名稱`,
                                icon: '',
                                click: () => {
                                    copyAsProperity("name");
                                    scopeEvalAsync();
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
                        copyTags();
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
                        pasteTags();
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
                        scopeEvalAsync();
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
                        duplicateItem();
                        scopeEvalAsync();
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
                //         machineryOpenAll(s);
                //         machineryOpenFilter(s);
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
                                    scopeEvalAsync();
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
                        machineryToggleSlideshow(s);
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
                        scopeEvalAsync();
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
                                click: () => { changeImagesBackground(items, undefined); }
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
                                click: () => { changeImagesBackground(items, 'dark'); }
                            },
                            // 灰
                            {
                                checked: item.background === 'gray',
                                icon: 'ic-transparent-grid-gray.svg',
                                label: i18n.__('context.image.thumbnailBG>gray'),
                                keywords: `${i18n.__('context.image.thumbnailBG')} thumbnail background transparent grid gray grey 縮略圖 背景 灰 #777`,
                                click: () => { changeImagesBackground(items, 'gray'); }
                            },
                            // 白
                            {
                                checked: item.background === 'light',
                                icon: 'ic-transparent-grid-white.svg',
                                label: i18n.__('context.image.thumbnailBG>light'),
                                keywords: `${i18n.__('context.image.thumbnailBG')} thumbnail background transparent grid light white 縮略圖 背景 白 #fff`,
                                click: () => { changeImagesBackground(items, 'light'); }
                            },
                            // 網格
                            {
                                checked: item.background === 'grid',
                                icon: 'ic-transparent-grid.svg',
                                label: i18n.__('context.image.thumbnailBG>grid'),
                                keywords: `${i18n.__('context.image.thumbnailBG')} thumbnail background transparent grid 縮略圖 背景 網格 透明`,
                                click: () => { changeImagesBackground(items, 'grid'); }
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
                        scopeEvalAsync();
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
                                click: () => { webpConvertStartChannel.emit({ images: s.selected, format: "png" }); scopeEvalAsync(); }
                            },
                            // JPG
                            {
                                visible: item.ext === 'webp',
                                label: "JPG",
                                keywords: `${i18n.__("context.image.webpConvert")} webp convert jpg 轉換`,
                                click: () => { webpConvertStartChannel.emit({ images: s.selected, format: "jpg" }); scopeEvalAsync(); }
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
                                    setCustomThumbnail();
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
                                    setCustomThumbnailFromClipboard();
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
                                    resetCustomThumbnail();
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
                                    regenerateThumbnail();
					                    scopeEvalAsync();
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
                                    replaceFile();
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
                                    renameFontsWithFullName(items);
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
                                    changeFontDefaultLang(items, 'en');
                                    scopeEvalAsync();
                                }
                            },
                            {
                                visible: !!FONT_TYPES[item.ext],
                                label: "日本語",
                                keywords: 'font japanese jp 字體 字型 日文',
                                click: () => {
                                    changeFontDefaultLang(items, 'jp');
                                    scopeEvalAsync();
                                }
                            },
                            {
                                visible: !!FONT_TYPES[item.ext],
                                label: "한국어",
                                keywords: 'font korean kr 字體 字型 韓文',
                                click: () => {
                                    changeFontDefaultLang(items, 'kr');
                                    scopeEvalAsync();
                                }
                            },
                            {
                                visible: !!FONT_TYPES[item.ext],
                                label: "Chinese(Simplified)",
                                keywords: 'font chinese simplified zh_CN 字體 字型 簡體中文',
                                click: () => {
                                    changeFontDefaultLang(items, 'zh_CN');
                                    scopeEvalAsync();
                                }
                            },
                            {
                                visible: !!FONT_TYPES[item.ext],
                                label: "Chinese(Traditional)",
                                keywords: 'font chinese traditional zh_TW 字體 字型 繁體中文',
                                click: () => {
                                    changeFontDefaultLang(items, 'zh_TW');
                                    scopeEvalAsync();
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
                        removeFromFolder(event, s.currentFolder.id);
                        scopeEvalAsync();
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
                        machineryRemoveSelected(s);
                        scopeEvalAsync();
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
                            scopeEvalAsync(() => {
                                machineryRemovePermanently(s);
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
        s.$root.currentFocus = "content";  };
  return run(...args);
}

// ═══ b1-9bz-A：controllerFns 表体归位（逐字平移；getScope()→getBodyScope()；表项指针化）═══

// b1-9bz-A 收口：本落点无 __lv_ link 态随迁，但迁移体头部统一带 `try { initLinkVars(); }`
// 序言——缺少本声明时运行期 ReferenceError（被空 catch 吞掉，无症状但破坏迁移体统一形态）。
let lvInited = false;
const initLinkVars = () => {
  if (lvInited) return;
  lvInited = true;
};

const getScope = getBodyScope;  // b1-9bz-A：原 makeControllerFns(getScope) 注入的等价别名

export function openItemContextMenu(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    return itemMenuOpenItemContextMenu(getScope(), ...args);
  }
