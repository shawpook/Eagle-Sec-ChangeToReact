/**
 * c3：EagleController 函数域逐字移植（第一批 = upload/library/sort/view + 错误清理，
 * 14 个函数）。提取自 bundle EagleController link 体（brace 精确扫描），机械替换：
 *   $scope → s（makeControllerFns(getScope) 注入的 body scope）、
 *   $rootScope → s.$root。
 * 状态在过渡期仍存于 scope（bundle ipc/watch 回调同写——避免 split-brain）；
 * callScope 路由优先命中本表（hooks.ts），bundle 同名函数退为后备。cZ 时随状态
 * 一并迁入 AppCore。
 */
// @ts-nocheck
import { getBodyScope } from '../global/scopeBridge';
import { IPCHelper } from './ipcHelper';

// ── bundle 模块级 const shim（18982-19045 区域子集；按 14 函数实际引用引入）──
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
const currentWindow: any = (window as any).electron?.remote?.getCurrentWindow?.() || _req('@electron/remote')?.getCurrentWindow?.();
const electronSettings: any = (window as any).electronSettings;
const electronLog: any = (window as any).electronLog || console;
const ipcRenderer: any = (window as any).__eagleIpc || (window as any).electron?.ipcRenderer;
const i18n: any = (window as any).i18n;
let preferences: any = (window as any).electronSettings?.getPreferences?.() || {};
const FixUtils: any = {};

export function makeControllerFns(getScope: () => any) {
  const fns: Record<string, any> = {};
  const def = (name: string, body: (s: any, ...args: any[]) => any) => {
    fns[name] = function (...args: any[]) {
      const s: any = getScope();
      if (!s) return;
      return body(s, ...args);
    };
  };

  fns["cancelAllTasks"] = function (...args) {
    const s = getScope();
    if (!s) return;
    return (function() {
            s.uploadQueue = [];
            s.finishQueue = [];

            IPCHelper.send('cancel.all');
            // 讓 Palette Queue 繼續
            setTimeout(function () {
                IPCHelper.send('palette-resume');

                // 针对尚未分析颜色的图片，进行颜色分析
                var images = [];
                var ONE_DAY = 1000 * 60 * 60 * 24;
                var now = Date.now();
                for (var rindex = 0; rindex < s.raw.length; rindex++) {
                    var image = s.raw[rindex];
                    // 不需要判断超过 1 天的图片
                    if (now - image.modificationTime > ONE_DAY) { break; }
                    if (image.hasOwnProperty("processingPalette") && !image.palettes) {
                        images.push(image);
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

  fns["uploadFiles"] = function (...args) {
    const s = getScope();
    if (!s) return;
    return (function($files, folder) {

            if ($files.length === 0) {
                s.hideUploadQueue();
                return;
            }

            console.log("s.uploadFiles");
            console.time("添加圖片耗費時間");

            var images = [];

            console.time("s.uploadFiles.初始化");
            let now = Date.now();
            for (let index = 0; index < $files.length; index++) {
                const file = $files[index];
                var fileName = file.name || path.basename(file.path);
                fileName = fileName.replace(path.extname(file.path), "").replace(/%/g, "").replace(emojiRegex, '');
                var image = {
                    id: file.id || guid(),
                    name: fileName,
                    path: file.path,
                    type: file.type,
                    size: file.size,
                    tags: file.tags || [],
                    url: file.url || "",
                    annotation: file.annotation || "",
                    lastModified: file.lastModified,
                    modificationTime: file.modificationTime || (now + index),
                    folders: file.folders || [],
                    star: file.star || undefined
                };

                if (file.cutMode) image.cutMode = true;
                if (file.merged) image.merged = true;

                images.push(image);

                if (folder) {
                    image.folders.push(folder.id);
                    image.folders = [...new Set(image.folders)];
                    if (image.tags && folder.extendTags) {
                        folder.extendTags.forEach(function (tag) {
                            image.tags.push(tag);
                        });
                        image.tags = [...new Set(image.tags)];
                    }
                    else {
                        image.tags = folder.extendTags || image.tags || [];
                    }
                }

                s.uploadQueue.push(image);
            }
            console.timeEnd("s.uploadFiles.初始化");
            console.time("s.uploadFiles.ipcRenderer.send");
            IPCHelper.send('upload-local-files', {
                files: images.reverse()
            });

            console.timeEnd("s.uploadFiles.ipcRenderer.send");
            $("#upload-queue-progress").find(".message .percentage").html(s.finishQueue.length + "/" + s.uploadQueue.length);
            $("#upload-queue-progress").find(".current").width(s.finishQueue.length/s.uploadQueue.length*100 + "%");
        }).apply(null, args);
  };

  fns["uploadUrls"] = function (...args) {
    const s = getScope();
    if (!s) return;
    return (function(urls, fds, params) {
            var folders = [];
            let extendTags = [];

            if (fds && fds.length > 0) {
                folders = fds.map(function (fd) {
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

            var files = urls.map(function(url, index) {
                
				let fileName = params && params.names && params.names[index] || "";
                let newTags = params?.tags;
                let tags = [];
                if (newTags && newTags.length > 0) {
                    tags = [...extendTags, ...newTags];
                }
                else if (extendTags.length > 0){
                    tags = [...extendTags];
                }

                tags = [...new Set(tags)];
                console.log(`before: ${fileName.length}`)
                fileName = fileName.substr(0, remainingFilenameLength(s.libraryPath));
                console.log(`after: ${fileName.length}`)

				fileName = sanitize(fileName).replace(/%/g, "").replace(/&lt;/g,"").replace(/&gt;/g,"").trim();
                return {
                    id: params?.ids && params?.ids[index] || undefined,
                    url: url,
                    folders: fds || [],
                    tags: tags,
                    type: params && params.types && params.types[index] || undefined,
                    name: fileName || undefined,
                    annotation: (params && params.annotations && params.annotations[index]) || "",
                    star: (params && params.stars && params.stars[index]) || undefined,
                    website: params && params.urls && params.urls[index] || "",
                    headers: params && params.headers && params.headers[index] || undefined,
                    modificationTime: (params && params.modificationTimes && params.modificationTimes[index]) || Date.now() + index
                }
            });
            if (files.length > 0) {
                s.showUploadQueue();
            }
            ipcRenderer.send('upload-urls', files);
        }).apply(null, args);
  };

  fns["switchLibrary"] = function (...args) {
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

  fns["changeOrderBy"] = function (...args) {
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

  fns["switchGridLayout"] = function (...args) {
    const s = getScope();
    if (!s) return;
    return (function () {
            s.switchLayout("GridLayout");
            s.$evalAsync();
            s.saveLayout(s.currentFolder || s.currentSmartFolder, "GridLayout");
        }).apply(null, args);
  };

  fns["switchJustifiedLayout"] = function (...args) {
    const s = getScope();
    if (!s) return;
    return (function () {
            s.switchLayout("JustifiedLayout");
            s.$evalAsync();
            s.saveLayout(s.currentFolder || s.currentSmartFolder, "JustifiedLayout");
        }).apply(null, args);
  };

  fns["switchListLayout"] = function (...args) {
    const s = getScope();
    if (!s) return;
    return (function () {
            s.switchLayout("ListLayout");
            s.$evalAsync();
            s.saveLayout(s.currentFolder || s.currentSmartFolder, "ListLayout");
        }).apply(null, args);
  };

  fns["switchSquareLayout"] = function (...args) {
    const s = getScope();
    if (!s) return;
    return (function () {
            s.switchLayout("SquareLayout");
            s.$evalAsync();
            s.saveLayout(s.currentFolder || s.currentSmartFolder, "SquareLayout");
        }).apply(null, args);
  };

  fns["updateContainerHieght"] = function (...args) {
    const s = getScope();
    if (!s) return;
    return (function (hasAnimation, delay = 1) {
            let duration = 170;
            if (!hasAnimation) duration = 1;
            setTimeout(() => {
                if (eagle.filter.isOpen) {
                    var $filterBar = $("#filter-toolbar");
                    var height = $filterBar.outerHeight();
                    $("#box-container").css({
                        "padding-bottom": height,
                        "height": `calc(100% - ${48 + height}px)`
                    });
                    $("#box-container-scrollbar").css({
                        "top": 48 + height,
                    });
                    $("#box-container").css({
                        "margin-top": height,
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
            }, delay);
        }).apply(null, args);
  };

  fns["updateItemView"] = function (...args) {
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
                var tags = item.tags || [];
                var isTagged = tags.length > 0;
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
                    var tags = item.tags.map(function (tag) {
                        try {
                            return `<div class="tag color-${$bodyScope.TagManager.tagMappings[tag].color}">${tag}</div>`;
                        } catch (err) {}
                    });
                    tagsFormated = tags.join("");
                }

                $element.attr("data-height", item.height);
                $element.attr("data-width", item.width);

                if ($name.text() !== item.name) {
                    if (!s.modifiedMappings[item.id]) s.modifiedMappings[item.id] = 0;
                    s.modifiedMappings[item.id]++;
                    let src = FileUrlHelper.getLastestThumbnailUrl(item);
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

  fns["cleanLibraryPathPermissionError"] = function (...args) {
    const s = getScope();
    if (!s) return;
    return (function (event) {
            s.libraryPathPermissionError = false;
        }).apply(null, args);
  };

  fns["cleanLocalhostError"] = function (...args) {
    const s = getScope();
    if (!s) return;
    return (function (event) {
            s.localhostError = false;
        }).apply(null, args);
  };

  fns["cleanAllError"] = function (...args) {
    const s = getScope();
    if (!s) return;
    return (function (event) {
            event && event.stopPropagation();
            s.$root.$broadcast("CLEAN_ALL_ERROR", {
                errorList: s.errorList
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
