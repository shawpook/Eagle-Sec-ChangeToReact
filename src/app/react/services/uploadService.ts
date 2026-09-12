/**
 * b1-9bz-A：uploadService.ts 新建落点——controllerFns 表体归位。
 * 函数体为 makeControllerFns 表内壳逐字平移（getScope()→getBodyScope()）。
 */

import { getBodyScope } from '../core/appCore';
import { IPCHelper } from '../core/ipcHelper';
import { syncUploadFromScope } from '../store/uploadState';

import { q, findEl, removeClass, setHtmlEl, setWidthEl } from '../utils/domQuery';


import { machineryHideUploadQueue, machineryShowUploadQueue } from '../core/itemDomain';
import { getFilter } from '../core/filterDomain';
import { scopeEvalAsync } from '../core/scopeRuntime';
import { useFolderState } from '../store/folderState';
import { useMiscRawState } from '../store/miscRawState';
import { useItemState } from '../store/itemState';
import { writeScopeField } from '../core/scopeFieldBridge';
// ═══ b1-9bz-A：controllerFns 表体归位（逐字平移；getScope()→getBodyScope()；表项指针化）═══
// —— controllerFns 模块级声明随迁（verbatim；按原声明顺序防 TDZ）——
const _req: any = (n: string) => { try { return (window as any).require(n); } catch (err) { return undefined; } };

const emojiRegex: any = /\p{Emoji_Presentation}|\p{Extended_Pictographic}|([0-9]\u{FE0F}\u{20E3})|([*#\u{1F51F}]\u{FE0F}\u{20E3})/gmu;

const remainingFilenameLength: any = (function () {
  const arp: any = _req('app-root-path');
  try { return arp && arp.path ? _req(arp.path + '/app/js/utils/remainingFilenameLength.js') : undefined; } catch (err) { return undefined; }
})();

const sanitize: any = (function () {
  const arp: any = _req('app-root-path');
  try { return arp ? _req(String(arp) + '/my_modules/sanitize-filename') : undefined; } catch (err) { return undefined; }
})();

const currentWindow: any = (window as any).electron?.remote?.getCurrentWindow?.() || _req('@electron/remote')?.getCurrentWindow?.();

const ipcRenderer: any = (window as any).__eagleIpc || (window as any).electron?.ipcRenderer;

const i18n: any = (window as any).i18n;

const dialog: any = _req('@electron/remote')?.dialog;

const remote: any = _req('@electron/remote');

const $filter: any = (name: string) => {
  const s: any = getBodyScope();
  if (s && s.$root && s.$root.$filter) return s.$root.$filter(name);
  // shim 世界无 $rootScope.$filter：退到 machinery 的 getFilter()（Angular 在世走 injector，
  // 缺席时为 EagleApp.filter 逐字移植的等价表），否则 `$filter('i18n')(…)` 首行即抛。
  const inst: any = getFilter();
  return inst ? inst(name) : undefined;
};

// —— link 级共享态（原 makeControllerFns 闭包声明）——
var __lv_fds: any;
var __lv_files: any;
var __lv_path: any;
var __lv_result: any;

let lvInited = false;
const initLinkVars = () => {
  if (lvInited) return;
  lvInited = true;
  // __lv_path（原 initLinkVars 逐字）
        __lv_path = _req('path');

};

const getScope = getBodyScope;  // b1-9bz-A：原 makeControllerFns(getScope) 注入的等价别名

export function cancelAllTasks(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    return (function() {
            writeScopeField('uploadQueue', []);
            syncUploadFromScope();
            writeScopeField('finishQueue', []);
            syncUploadFromScope();

            (window as any).IPCHelper.send('cancel.all');
            // 讓 Palette Queue 繼續
            setTimeout(function () {
                (window as any).IPCHelper.send('palette-resume');

                // 针对尚未分析颜色的图片，进行颜色分析
                var images = [];
                var ONE_DAY = 1000 * 60 * 60 * 24;
                var __lv_now = Date.now();
                for (var rindex = 0; rindex < useItemState.getState().raw.length; rindex++) {
                    var __lv_image = useItemState.getState().raw[rindex];
                    // 不需要判断超过 1 天的图片
                    if (__lv_now - __lv_image.modificationTime > ONE_DAY) { break; }
                    if (__lv_image.hasOwnProperty("processingPalette") && !__lv_image.palettes) {
                        images.push(__lv_image);
                    }
                }
                console.log(`发现 ${images.length} 张图片需要刷新缩略图, 省略了 ${useItemState.getState().raw.length - rindex} 次判断`);
                if (images.length > 0) {
                    ipcRenderer.send('check.image.palette', images);
                }

                if (currentWindow && !currentWindow.isDestroyed()) {
                    currentWindow.setProgressBar(-1);
                }
            }, 1000);
            removeClass("#upload-queue-progress", "open");
            removeClass("body", "is-uploading");
        }).apply(null, args);
  }

export function importFolders(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
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
  }

export function uploadFiles(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    return (function($__lv_files, folder) {

            if ($__lv_files.length === 0) {
                machineryHideUploadQueue();
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

                useMiscRawState.getState().uploadQueue.push(__lv_image);
                syncUploadFromScope();
            }
            console.timeEnd("s.uploadFiles.初始化");
            console.time("s.uploadFiles.ipcRenderer.send");
            (window as any).IPCHelper.send('upload-local-files', {
                files: images.reverse()
            });

            console.timeEnd("s.uploadFiles.ipcRenderer.send");
            setHtmlEl(findEl(q("#upload-queue-progress"), ".message .percentage"), useMiscRawState.getState().finishQueue.length + "/" + useMiscRawState.getState().uploadQueue.length);
            setWidthEl(findEl(q("#upload-queue-progress"), ".current"), useMiscRawState.getState().finishQueue.length/useMiscRawState.getState().uploadQueue.length*100 + "%");
        }).apply(null, args);
  }

export function uploadUrls(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    return (function(urls, __lv_fds, params) {
            var folders = [];
            let extendTags = [];

            if (__lv_fds && __lv_fds.length > 0) {
                folders = __lv_fds.map(function (fd) {
                    return useItemState.getState().folderMappings[fd];
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
                fileName = fileName.substr(0, remainingFilenameLength(useMiscRawState.getState().libraryPath));
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
                machineryShowUploadQueue();
            }
            ipcRenderer.send('upload-urls', __lv_files);
        }).apply(null, args);
  }


// ═══ b1-9bz-D-1 B-5：零依赖声明归位（dataMachinery 剪出，逐字）═══
export function machineryOnDropContainer(event: any): void {
  const w = window as any;


    if (w.dragging) {
        w.dragging = false;
        return;
    }

    event && event.preventDefault();
    event && event.stopPropagation();

    var fsPath = w.require('path');
    var ipcRenderer = w.require('electron').ipcRenderer;
    var folder = useFolderState.getState().currentFolder;
    var dragUrl: any = undefined;
    if (event.dataTransfer) {
      const holder = document.createElement("div");
      holder.innerHTML = event.dataTransfer.getData("text/html");
      dragUrl = holder.querySelector("img")?.getAttribute("src");
    }
    var files = event.dataTransfer && event.dataTransfer.files;
    var dragFile = false;

    if (!dragUrl) {
        if (w.is.url(event.dataTransfer.getData("text/plain"))) {
            dragUrl = event.dataTransfer.getData("text/plain");
        }
        // if (dragUrl && dragUrl.indexOf("data:image") === -1 ) {
        //     dragUrl = undefined;
        // }
        if (files && files[0] && files[0].path) {
            dragFile = true;
        }
    }
    console.log(dragFile);

    removeClass("#box-container", "drag-accept");

    if (!w.dragging && files.length == 1 && files[0].path.indexOf(".eaglepack") !== -1) {
        var file = files[0];
        var packPath = file.path;
        ipcRenderer.send("open-eaglepack", {
            path: packPath,
            folderId: folder && folder.id
        });
        return;
    }
	else if (!w.dragging && files.length == 1 && files[0].path.indexOf(".eagleplugin") !== -1) {
        var file = files[0];
        var pluginPath = file.path;
        ipcRenderer.send("open-eagleplugin-file", {
            path: pluginPath
        });
        return;
    }
    else if (!w.dragging && files.length == 1 && files[0].path.endsWith(".library")) {
        var file2 = files[0];
        var libraryPath = file.path;
        ipcRenderer.send('open-library', libraryPath);
        return;
    }

    if (!w.dragging && files && files[0] && files[0].path) {

        // 如果文件夾名稱過長，路徑會變成很奇怪的符號
        if (files[0] && !w.fs.existsSync(files[0].path)) {
            w.swal({
                html: `
                    <div class="alert">
                        <div class="alert-icon error"></div>
                        <h4 class="alert-title">${w.i18n.__("Dialog.PathTooLong.Title")}</h4>
                        <p class="alert-desc">${w.i18n.__("Dialog.PathTooLong.Description")}</p>
                    </div>
                `,
                showCloseButton: false, showCancelButton: false, allowOutsideClick: false, focusConfirm: true, focusCancel: false, padding: 24,
                width: 360,
                customClass: "alert-box",
                cancelButtonColor: "#777777",
                confirmButtonText: w.i18n.__("general.close"),
            }).then(function () {});
            w.electronLog && w.electronLog.error("[app] Unable to add local folder, beacuse the path is too long: " + files[0].path);
            return;
        }

        console.time("拖曳档案事件");
        machineryShowUploadQueue();

        var fds = [];
        var notSupportFiles = [];   // 不支持添加的文件


        for (var i = 0; i < files.length; i++) {
        // for (var i = files.length - 1; i >= 0; i--) {
            var filePath = files[i].path;
            var lowercase = filePath.toLowerCase();
            var ext = w.getExt(files[i]);
            if (ext) {
                // var ext = w.getExt(files[i]);
                if (w.EagleConfig.SUPPORT_FORMATS[ext]) {
                    files[i].type = "image/" + ext;
                    fds.push(files[i]);
                }
                else if (filePath.indexOf("svg") !== -1 || filePath.indexOf("icns") !== -1 || filePath.indexOf("ico") !== -1) {
                    fds.push(files[i]);
                }
                else if (!w.IS_HIDDEN_FILE.check(lowercase)) {
                    fds.push(files[i]);
                }
            }
            // 使用者拖曳資料夾
            else if (w.IS_DIRECTORY.check(filePath)) {
                var dirFiles = w.walk(filePath);
                if (dirFiles && dirFiles.length !== 0) {
                    var now = Date.now();
                    dirFiles.forEach(function (p: any, index: any) {
                        var fpath = p;
                        // var stat = fs.statSync(fpath);
                        var f: any = {
                            name: fsPath.basename(fpath),
                            // size: stat.size,
                            path: fpath,
                            lastModified: now,
                        };
                        var ext = w.getExt(f);
                        if (w.EagleConfig.SUPPORT_FORMATS[ext]) {
                            f.type = "image/" + ext;
                            fds.push(f);
                        }
                        else if (fpath.indexOf("svg") !== -1) {
                            f.type = "image/svg+xml";
                            fds.push(f);
                        }
                        else if (fpath.indexOf("icns") !== -1) {
                            f.type = "icns";
                            fds.push(f);
                        }
                        else if (fpath.indexOf("ico") !== -1) {
                            f.type = "ico";
                            fds.push(f);
                        }
                        else {
                            fds.push(f);
                            // notSupportFiles.push(f);
                        }
                    });
                }
                else {
                    machineryHideUploadQueue();
                }
            }
            else {
                fds.push(files[i]);
                // notSupportFiles.push(files[i]);
            }
        }

        if (fds.length == 0 && files.length == 1 && notSupportFiles.length > 0) {
            machineryHideUploadQueue();
        }
        else {
            // let reason = (w.process.platform === 'darwin')? w.i18n.__("Dialog.NotSupport.Format.Descript.Mac") :  w.i18n.__("Dialog.NotSupport.Format.Descript.Windows");
            // notSupportFiles.forEach(function (file) {
            //     $bodyScope.errorList.push({
            //         type: 'ADD_ERROR',
            //         object: { 
            //             name: file.name,
            //             path: file.path 
            //         },
            //         reason: reason
            //     });
            // });
            console.log("收到 Drop，準備添加");
            // Windows 拖拽顺序无法对应当前 explorer，所以这里自己做了排序
            if (w.process.platform === 'win32') { w.sortByAZ(fds); }
            uploadFiles(fds, folder);
            if (folder) { w.electronLog && w.electronLog.info(`[app] Drop ${fds.length} files to ${folder.name}(${folder.id})(Center), path: ${fds[0].path}`); }
            else { w.electronLog && w.electronLog.info(`[app] Drop ${fds.length} files to All(Center), path: ${fds[0].path}`); }
            scopeEvalAsync();
        }
        console.timeEnd("拖曳档案事件");
    }
    // else if (!w.dragging && dragFile) {
    //     s.uploadDraggingBoard(folder, dragUrl);
    //     machineryShowUploadQueue(s);
    //     console.log("上传记忆体内的图片");
    // }
    else if (!w.dragging && dragUrl) {
        if (w.is.url(dragUrl)) {
        // if (w.is.url(dragUrl) && dragUrl.indexOf("data:image" !== -1)) {
            machineryShowUploadQueue();
        }
        if (w.is.url(dragUrl)) {
            useMiscRawState.getState().uploadUrl(dragUrl, folder);
            if (folder) { w.electronLog && w.electronLog.info(`[app] Drop url: ${dragUrl} to ${folder.name}(${folder.id})（Center）`); }
            else { w.electronLog && w.electronLog.info(`[app] Drop url ${dragUrl} to All(Center)`); }
        }
        // bundle 原 bug 逐字保留：实参实为 ("data:image" > -1)，即 indexOf(false)
        else if ((dragUrl as any).indexOf(("data:image" as any) > -1) ) {
            useMiscRawState.getState().uploadUrl(dragUrl, folder);
            if (folder) { w.electronLog && w.electronLog.info(`[app] Drop base64 url to: ${folder.name}(${folder.id})(Center)`); }
            else { w.electronLog && w.electronLog.info(`[app] Drop base64 url to All(Center)`); }
        }
        else {
            var $filter = getFilter();
            var html = (w.process.platform === 'darwin')? $filter('i18n')("Dialog.NotSupport.Format.Descript.Mac") :  $filter('i18n')("Dialog.NotSupport.Format.Descript.Windows");
            machineryHideUploadQueue();
            w.swal({
                title: w.i18n.__("Dialog.NotSupport.Format.Title"),
                html: html,
                showCloseButton: false, showCancelButton: false, allowOutsideClick: true, focusConfirm: true, focusCancel: false, padding: 24,
                width: 360,
                cancelButtonColor: "#777777",
                confirmButtonText: w.i18n.__("Dialog.NotSupport.Format.Buttom"),
            }).then(function () {});
        }
    }
    w.dragging = false;
}
