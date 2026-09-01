/**
 * c3：EagleController 函数域逐字移植（batch1 = upload/library/sort/view + 错误清理 14 函数；
 * batch2 = selection + filter 28 函数；共 42）。提取自 bundle EagleController link 体
 * （brace 精确扫描：字符串/模板 ${} 独立计数/注释/正则字面量），机械替换：
 *   $scope → s（makeControllerFns(getScope) 注入，闭包变量不占实参位）、
 *   $rootScope → s.$root。
 * link 级共享 var 与辅助函数逐字提升（与原 link 作用域共享语义一致——过渡期状态仍以
 * scope 为源，bundle ipc/watch 回调同写避免 split-brain）；callScope 路由优先命中本表
 * （hooks.ts），bundle 同名函数退为后备。cZ 时随状态一并迁入 AppCore。
 */
// @ts-nocheck
import { getBodyScope } from '../global/scopeBridge';
import { IPCHelper } from './ipcHelper';

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
const currentWindow: any = (window as any).electron?.remote?.getCurrentWindow?.() || _req('@electron/remote')?.getCurrentWindow?.();
const electronSettings: any = (window as any).electronSettings;
const electronLog: any = (window as any).electronLog || console;
const ipcRenderer: any = (window as any).__eagleIpc || (window as any).electron?.ipcRenderer;
const i18n: any = (window as any).i18n;
let preferences: any = (window as any).electronSettings?.getPreferences?.() || {};
const FixUtils: any = {};
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
  var searchTimeout;
  var keywordModelTimeout;
  var nextTimeout;
  var prevTimeout;
  var calculateFilterCountsTimeout;
  var cleanSelectedTimeout;
  var start;
  var image;
  var src;
  var offset;
  var x;
  var y;
  var width;
  var height;
  var delay;
  var comment;
  var path;
  var file;
  var fds;
  var ext;
  var files;
  var now;
  var tags;
  var idx;
  var target;

  let linkVarsInited = false;
  const initLinkVars = () => {
    if (linkVarsInited) return;
    linkVarsInited = true;
    // 初始化（原 link 期赋值，$scope 引用改为 getBodyScope()）
    try {
      start = countOfSend * once;
      image = items[i];
      src = $image.attr("src");
      offset = $(HoverPreview.lastElem).offset();
      x = offset.left;
      y = offset.top;
      width = Math.min(480, image.width);
      height = Math.min(480, image.height);
      delay = HoverPreview.getDelay(this);
      comment = commentScope.comment;
      path = event.dataTransfer.files[0].path;
      file = files[0];
      fds = [];
      ext = getExt({path: filePath});
      files = node.files;
      now = Date.now();
      tags = Object.keys(getBodyScope().selectedTags).map(function(key) { return key; });
      idx = getBodyScope().allData.indexOf(targetItem);
    } catch (err) { /* 初始化失败不阻塞（bundle 后备仍在） */ }
  };

  fns["cancelAllTasks"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
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
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
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
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
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

  fns["updateContainerHieght"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
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
            cleanSelectedTimeout = $timeout(function() {
                s.selected = [];
                s.selectedFolderMappings = {};
                s.updateSelection();
            }, 100);
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
            s.selected.forEach(function(image) {
                var idx = s.allData.indexOf(image);
                if (idx != -1) {
                    arr.push(idx);
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

  fns["scrollToSelectedItem"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function() {
            var target = s.selected[0];
            // 自动定位
            if (target) {

                if (target.id) {
                    var $box =$(`#box-${target.id}`);
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
                    var image = s.allData[i];
                    if (target && target === image) {
                        var startPage = parseInt(i / 60);
                        console.log(`目标在第 ${startPage} 页`);
                        console.log($(`#box-${target.id}`).length);
                        // 東西不在畫面上，強制更新畫面然後定位
                        if ($(`#box-${target.id}`).length === 0 || startPage !== s.startCursor) {
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
                            autoScroll();
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

  fns["select"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function(event, image) {

        	if (event && event.button >= 3) {
        		return;
        	}

        	if (event) event.stopPropagation();

            // 中键点击
            if (event && event.button === 1) {
                if (s.$root.preferences.habits.middleBtn === "openNewWindow") {
                    event && event.preventDefault();
                    if (!AUDIO_TYPES[image.ext]) {
						openInNewWindow([image]);
                        RecentFileManager.addFile(image);
	                    analytics.event('NewWindow', 'Open', image.ext);
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
            	if (image && s.selectedMappings[image.id]) {
            		return;
            	}
            }

            s.$root.currentFocus = "content";
            s.selectedFolderMappings = {};

            $("input:focus").blur();
            $("[contenteditable]:focus").blur();

            $timeout.cancel(cleanSelectedTimeout);

            if (s.isPreviewing) {
                s.isPreviewing = false;
                currentWindow.closeFilePreview();
            }
            window.getSelection().removeAllRanges();

            if (!image) {
                return;
            }

            // 如果點擊的內容已經選取
            if (image && s.selectedMappings[image.id]) {
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
	                        var idx = s.selected.indexOf(image);
	                        s.selected.splice(idx, 1);
	                        delete s.selectedMappings[image.id];
                        }
                    }
                }
                return;
            }

            var targetSelectedIndex = s.allData.indexOf(image);

            if (event && !event.metaKey && !event.shiftKey && !event.ctrlKey) {
                s.selected = [];
                s.lastSelectedIndex = targetSelectedIndex;
            }
            if (event && (event.metaKey || event.ctrlKey) ) {
                s.lastSelectedIndex = targetSelectedIndex;
            }
            if (event && event.shiftKey) {
                s.selected.push(image);
                s.selectedMappings[image.id] = true;
                var selection = s.getSelection();

                var start = selection.start;
                var end = selection.end;

                if (s.lastSelectedIndex >= 0) {
                    start = s.lastSelectedIndex;
                }

                if (targetSelectedIndex >= 0) {
                    end = targetSelectedIndex;
                }

                if (start > end) {
                    [start, end] = [end, start];
                }

                var invert = selection.invert;
                if (!invert) {
                    for (var i = start; i <= end; i++) {
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
                    for (var i = end; i >= start; i--) {
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
            } else if (!s.selectedMappings[image.id]) {
                if (image && s.selected.indexOf(image) === -1) {
                    s.selected.push(image);
                    s.selectedMappings[image.id] = true;
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
            var $arround = getArroundBox(end);
            var $box = $(".box.selected").last();
            var boxOffest = $box.offset();
            if (!boxOffest) return;
            var boxCenterX = boxOffest.left;
            var boxCenterY = boxOffest.top;
            var target;
            var d = 100000;
            $(".box").each(function(index) {
                var $b = $(this);
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
                    var td = Math.sqrt((boxCenterY - by) * (boxCenterY - by) + (boxCenterX - bx) * (boxCenterX - bx));
                    if (boxOffest.top < offset.top && Math.abs(boxOffest.top - offset.top) > 20) {
                        if (td < d) {
                            d = td;
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
                autoScroll(target);
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
            var start = selection.start;
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
                $timeout.cancel(nextTimeout);
                s.forceFitImageSize(s.selected[0], true);
                s.current = s.selected[0];
                s.isGifReady = false;
            }

            autoScroll(end);

            if (s.current) {
                $("#detail-container").smoothZoom('updateNavigator', $bodyScope.current);
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
            var start = selection.start;
            var end = selection.end + 1;

            if (start === 0) { 
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

            if (s.allData[start - 1]) {
                s.selected = [];
                s.selected.push(s.allData[start - 1]);
                if (s.isDetailMode) {
                    s.forceFitImageSize(s.selected[0], true);
                    s.current = s.selected[0];
                }
                autoScroll(start - 1);
            } else {
                s.selected = [];
                s.selected.push(s.allData[0]);
                s.forceFitImageSize(s.selected[0], true);
                s.current = s.selected[0];
                autoScroll(0);
            }
            s.selectedFolderMappings = {};
            s.$root.currentFocus = "content";
            if (s.current) {
                $("#detail-container").smoothZoom('updateNavigator', $bodyScope.current);
                if (!s.lastZoom()) {
                    s.zoom();
                }
                $timeout.cancel(prevTimeout);
                prevTimeout = $timeout(function () {
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
            var start = selection.start;
            var $box = $(".box.selected").eq(0);
            var boxOffest = $box.offset();
            if (!boxOffest) return;
            var boxCenterX = boxOffest.left;
            var boxCenterY = boxOffest.top;
            var target;
            var d = 100000;

            $(".box").each(function(index) {
                var $b = $(this);
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
                    var td = Math.sqrt((boxCenterY - by) * (boxCenterY - by) + (boxCenterX - bx) * (boxCenterX - bx));
                    if (boxOffest.top > offset.top && Math.abs(boxOffest.top - offset.top) > 20) {
                        if (td < d) {
                            d = td;
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
                autoScroll(target);
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

  fns["updateSelection"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function() {
            s.$broadcast("UPDATE_INSPECTOR");
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

            let now = Date.now();
            let today = new Date();
            today.setHours(0,0,0);
            let todayTime = today.getTime();
            let yesterdayTime = todayTime - DATE_1_DAY;

            for (let i = 0; i < s.allData.length; i++) {
                const image = s.allData[i];
                if (image.modificationTime > todayTime) eagle.filter.filterCounts['import']['today']++;
                else if (image.modificationTime < todayTime && image.modificationTime > yesterdayTime) eagle.filter.filterCounts['import']['yesterday']++;
                if (now - image.modificationTime < DATE_7_DAY) eagle.filter.filterCounts['import']['7day']++;
                if (now - image.modificationTime < DATE_30_DAY) eagle.filter.filterCounts['import']['30day']++;
                if (now - image.modificationTime < DATE_90_DAY) eagle.filter.filterCounts['import']['90day']++;
                if (now - image.modificationTime < DATE_365_DAY) eagle.filter.filterCounts['import']['365day']++;

                let importDate = new Date(image.modificationTime);
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
                var mtime = image.mtime || image.modificationTime;
                if (mtime) {
                    if (mtime > todayTime) eagle.filter.filterCounts['mtime']['today']++;
                    else if (mtime < todayTime && mtime > yesterdayTime) eagle.filter.filterCounts['mtime']['yesterday']++;
                    if (now - mtime < DATE_7_DAY) eagle.filter.filterCounts['mtime']['7day']++;
                    if (now - mtime < DATE_30_DAY) eagle.filter.filterCounts['mtime']['30day']++;
                    if (now - mtime < DATE_90_DAY) eagle.filter.filterCounts['mtime']['90day']++;
                    if (now - mtime < DATE_365_DAY) eagle.filter.filterCounts['mtime']['365day']++;

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
            
            clearTimeout(calculateFilterCountsTimeout);
            calculateFilterCountsTimeout = setTimeout(function () {
                console.time("calculateFilterCounts");
                eagle.filter.resetFilterCounts();
                let now = Date.now();
                for (let i = 0; i < s.allData.length; i++) {
                    const image = s.allData[i];
                    s.updateFilterCounts(image, 1, now);
                }
                console.timeEnd("calculateFilterCounts");
                s.$evalAsync();
            }, 500);

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
    return (function(image) {
            try {
                if (s.$root.selectedSmartFolders.length > 0) {
                    if (image.isDeleted) return false;
                    for (let i = 0; i < s.$root.selectedSmartFolders.length; i++) {
                        let smartFolder = s.$root.selectedSmartFolders[i];
                		if (s.existInSmartFilter(smartFolder, image)) {
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
    	            		if (s.existInSmartFilter(smartFolder, image)) {
    	                        return true;
    	                    }
    	                }
    	                return false;
                	}
                	else {
                		return s.existInSmartFilter(s.currentSmartFolder, image);
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
                        return (RecentFileManager.isExists(image));
                        break;
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
                    eagle.filter.filterRules.tag.excludes.splice(idx, 1);
                    tag.isExcluded = false;
                }
                else {
                    var idx = eagle.filter.filterRules.tag.includes.indexOf(tagName);
                    if (idx > -1) {
                        eagle.filter.filterRules.tag.includes.splice(idx, 1);
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

  fns["openQuickSearch"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function (event) {
            s.$root.$broadcast('OPEN_QUICK_SEARCH_MODAL');
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

  fns["search"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function() {
            $timeout.cancel(keywordModelTimeout);
            keywordModelTimeout = $timeout(function () {
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
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(function () {
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

  fns["toggleExtFilter"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function (ext) {
            delete eagle.filter.filterRules.type.excludes[ext];
            if (!eagle.filter.filterRules.type.includes[ext]) {
                eagle.filter.filterRules.type.includes[ext] = true;
            }
            else {
                delete eagle.filter.filterRules.type.includes[ext];
            }
        }).apply(null, args);
  };

  fns["toggleExtFilterExclude"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function (ext) {
            delete eagle.filter.filterRules.type.includes[ext];
            if (!eagle.filter.filterRules.type.excludes[ext]) {
                eagle.filter.filterRules.type.excludes[ext] = true;
            }
            else {
                delete eagle.filter.filterRules.type.excludes[ext];
            }
        }).apply(null, args);
  };

  fns["updateFilterCounts"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function (image, inc, now) {

            if (!image) return;

            try {

                var type = image.medium || image.ext;
                var shape;

                if (eagle.filter.filterCounts['type'][type] === undefined) {
                    eagle.filter.filterCounts['type'][type] = 1;
                }
                else {
                    eagle.filter.filterCounts['type'][type]+=inc;
                }

                if (image.rawMetas) {

                    var camera = image.rawMetas.camera;
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

                if (image.fontMetas) {
                    try {
                        var key = Object.keys(image.fontMetas.postScriptName)[0];
                        var postScriptName = image.fontMetas.postScriptName && image.fontMetas.postScriptName[key];
                        if (installedFonts[`${postScriptName}_.${image.ext}`]) {
                            eagle.filter.filterCounts['fontActivated']['activated']+=inc;
                        }
                        else {
                            eagle.filter.filterCounts['fontActivated']['deactivated']+=inc;
                        }
                    }
                    catch (err) {

                    }
                }

                if (image.star) {
                    eagle.filter.filterCounts['rating'][image.star]+=inc;
                }
                else {
                    eagle.filter.filterCounts['rating']['0']+=inc;
                }

                // 形状筛选，只需要针对图片格式进行
                if (image.width && !AUDIO_TYPES[image.ext] && !FONT_TYPES[image.ext] ) {
                    if (image.width > image.height) {
                        if (image.width / image.height >= 2.5) {
                            shape = "panoramic-landscape";
                        }
                        else {
                            shape = "landscape";
                        }
                        eagle.filter.filterCounts['shape'][shape] += inc;
                    }
                    else if (image.width < image.height) {
                        if (image.height / image.width >= 2.5) {
                            shape = "panoramic-portrait";
                        }
                        else {
                            shape = "portrait";
                        }
                        eagle.filter.filterCounts['shape'][shape] += inc;
                    }
                    else if (image.width === image.height) {
                        shape = "square";
                        eagle.filter.filterCounts['shape'][shape] += inc;
                    }
                    if (image.width / image.height === 4 / 3) {
                        shape = "4:3";
                        eagle.filter.filterCounts['shape'][shape] += inc;
                    }
                    else if (image.width / image.height === 3 / 4) {
                        shape = "3:4";
                        eagle.filter.filterCounts['shape'][shape] += inc;
                    }
                    else if (image.width / image.height === 16 / 9) {
                        shape = "16:9";
                        eagle.filter.filterCounts['shape'][shape] += inc;
                    }
                    else if (image.width / image.height === 9 / 16) {
                        shape = "9:16";
                        eagle.filter.filterCounts['shape'][shape] += inc;
                    }
                }

        	}
        	catch (err) {
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

export function isInFolder (image, folder) {
            try {
            	if (!folder) return false;
                if (!image) return false;
                if (!image.folders || !image.folders.indexOf) {
                    image.folders = [];
                }
                // 状况1: 该资料夹本身包含图片
                var isContain = image.folders.indexOf(folder.id) > -1;
                if (getBodyScope().showSubfolderContent) {
                    // 状况2: 该资料夹不包含图片，但该资料夹的子文件夹包含
                    // 加速版本作法，更快判断图片是否存在于子文件夹
                    if (getBodyScope().currentFolderChildren) {
                        for (var i = 0; i < image.folders.length; i++) {
                            var folderId = image.folders[i];
                            if (getBodyScope().currentFolderChildren[folderId]) {
                                return true;
                            }
                        }
                    }
                    else {
                        eagle.utils.tree.walk(folder.children, 'children', function (child, parent) {
                            if (image.folders && image.folders.length > 0 && image.folders.indexOf(child.id) > -1) {
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
                    let result = [];
                    expr.children.forEach(child => {
                        let flattened = flattenExpression(child);
                        result = result.concat(flattened);
                    });
                    return result;
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
                    var idx = suggestion.word.toLowerCase().indexOf(keyword);
                    if (getBodyScope().isEnglish) {
                        return (idx > -1);
                    }
                    else if (getBodyScope().isKeywordTW) {
                        return (idx > -1) && (suggestion.word != keyword) ||
                        (suggestion.word.indexOf(getBodyScope().keyword_cn) > -1)
                    }
                    else if (getBodyScope().isKeywordCN) {
                        return (idx > -1) && (suggestion.word != keyword) ||
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
