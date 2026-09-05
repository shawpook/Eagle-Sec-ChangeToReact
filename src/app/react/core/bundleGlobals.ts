/**
 * c10：bundle 全局接管（if-absent）——b1 后 app.bundle.js 死亡，其顶层 var/function/const
 * 在 window 上的 live binding 全部消失。本模块为 React 消费面（machinery/组件/域）依赖的
 * bundle 全局安装 React 自有实现：
 *
 * - **if-absent 语义**：window.X 无值才装——bundle 在世时沿用其绑定（加载顺序：bundle
 *   classic script 先于 React module script），行为零改变；b1 后 bundle 缺席，由本模块供给。
 *   幂等可重入。
 * - **Tier 1（本片）**：machinery/组件运行时硬依赖——appRoot（19002）、EagleConfig（2051）、
 *   VIDEO/AUDIO/FONT_TYPES（18988-18991）、SPECIAL_TYPES（18994）、fileSize（2548-2572）、
 *   re-require 十行（22776-22787 同路径，require 缓存命中同一实例）、installedFonts（19243）、
 *   fontFolder（19192-19198）、FileUrlHelper（React c1 移植版 fileUrlHelper.ts）。
 * - **Tier 2（后续片，PROGRESS 收口表跟踪）**：getHashID/guid/fuzzy_match/fuzzy_score/
 *   cloneTree/decodeBase64Image/hiddenByCurrentFilter/ayncsImagesChange/APIServer 族/
 *   Registration/SlowNotify/RecentFileManager/analytics/eg(InfiniteGrid)——当前仅 bundle
 *   域内路径使用，b1 前随各自 c 域移植接装。
 */

import { FileUrlHelper } from './fileUrlHelper';
import { eagle as coreEagle } from './eagleApi';
import { coreState } from './appCore';
import { getBodyScope } from '../global/scopeBridge';

declare const Buffer: any;

let installed = false;

/* c12：eagle 成员反转挂载（if-absent）——window.eagle 基座来自 js/lib/eagle-api.js（独立
   script 标签，b1 存活：utils.tree/urlEnlargerRemote），bundle 只挂载类实例成员（249 inspector/
   606 filter/957 duplicateChecker/1012 reverseImageSearch/1844 aiSearch/1882 customExport/
   1915 combineImages/2048 action + runtime plugin/isDev）。b1 后这些成员消失 → 由 React
   c2 全家桶（eagleClasses.ts，2071 行逐字移植）if-absent 补齐。bundle 在世时成员已存在，
   零改动；React 消费方 19 处 s.eagle.* 走 $scope.eagle（= bundle 实例），无分叉。 */
function installEagleMembers(): void {
  const w = window as any;
  if (!w.eagle) {
    w.eagle = coreEagle;
  }
  const eagle = w.eagle;
  const m = coreEagle as any;
  if (!eagle.inspector) eagle.inspector = m.inspector;
  if (!eagle.filter) eagle.filter = m.filter;
  if (!eagle.duplicateChecker) eagle.duplicateChecker = m.duplicateChecker;
  if (!eagle.reverseImageSearch) eagle.reverseImageSearch = m.reverseImageSearch;
  if (!eagle.aiSearch) eagle.aiSearch = m.aiSearch;
  if (!eagle.customExport) eagle.customExport = m.customExport;
  if (!eagle.combineImages) eagle.combineImages = m.combineImages;
  if (!eagle.action) eagle.action = m.action;
  // runtime 占位成员（bundle 17670/17804 extension server init 置 {}；collect modal 脚本写 app.*）
  if (!eagle.plugin) eagle.plugin = {};
  if (!eagle.app) eagle.app = {};
  if (!eagle.containerSize) eagle.containerSize = {};
}

/* guid（bundle 2396-2398 逐字） */
function _guid(): string {
  return (Date.now().toString(36) + Math.random().toString(36).substr(2, 5)).toUpperCase();
}

/* throttle（bundle 2400-2438 逐字，含原码乱码注释） */
function _throttle(fn: any, delay: any, immediate: any, debounce: any): any {
  var curr = +new Date(), //µ±Ç°ÊÂ¼þ
    last_call = 0,
    last_exec = 0,
    timer: any = null,
    diff: any, //Ê±¼ä²î
    context: any, //ÉÏÏÂÎÄ
    args: any,
    exec = function () {
      last_exec = curr;
      fn.apply(context, args);
    };
  return function (this: any) {
    curr = +new Date();
    context = this,
      args = arguments,
      diff = curr - (debounce ? last_call : last_exec) - delay;
    clearTimeout(timer);
    if (debounce) {
      if (immediate) {
        timer = setTimeout(exec, delay);
      } else if (diff >= 0) {
        exec();
      }
    } else {
      if (diff >= 0) {
        exec();
      } else if (immediate) {
        timer = setTimeout(exec, -diff);
      }
    }
    last_call = curr;
  };
}

/* debounce（bundle 2440-2458 逐字；bundle 自有实现，非 lodash） */
function _debounce(func: any, wait: any, immediate: any): any {
  var timeout: any;
  return function (this: any) {
    var context = this,
      args = arguments;
    var later = function () {
      timeout = null;
      if (!immediate) func.apply(context, args);
    };
    var callNow = immediate && !timeout;
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    if (callNow) func.apply(context, args);
  };
}

/* fuzzy_match（bundle 2516-2547 逐字） */
function _fuzzy_match(text: any, search: any): any {
  try {
    // 对搜索词和文本进行 Unicode 标准化处理
    var normalizedText = text.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    var normalizedSearch = search.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/\ /g, '').toLowerCase();

    var tokens: any[] = [];
    var search_position = 0;
    for (var n = 0; n < text.length; n++) {
      var text_char = text[n];
      var normalized_char = normalizedText[n];

      if (search_position < normalizedSearch.length &&
        normalized_char == normalizedSearch[search_position]) {
        text_char = '<b>' + text_char + '</b>';
        search_position += 1;
      }
      tokens.push(text_char);
    }

    if (search_position != normalizedSearch.length) {
      return '';
    }
    return tokens.join('');
  }
  catch (err) {
    return text;
  }
}

/* decodeBase64Image（bundle 2949-2963 逐字；Buffer = Electron nodeIntegration 全局，b1 存活） */
function _decodeBase64Image(dataString: string): any {
  let response: any = {};
  if (dataString.indexOf(`data:image/svg+xml;utf8,`) > -1) {
    let svgStr = dataString.split(`data:image/svg+xml;utf8,`)[1];
    response.data = new Buffer(decodeURIComponent(svgStr), 'utf-8');
  }
  else {
    let base64 = dataString.split(";base64,")?.[1];
    let type = dataString.match(/^data:(.+?);/)?.[1];
    if (!base64 || !type) return;
    response.type = type;
    response.data = new Buffer(base64, 'base64');
  }
  return response;
}

/* cloneTree（bundle 8207-8242 逐字） */
function _cloneTree(newTree: any[], tree: any, extraInfo: any): void {
  var arr: any;
  if (Array.isArray(tree)) {
    arr = tree;
  }
  else {
    arr = tree["children"];
  }
  if (arr && Array.isArray(arr)) {
    arr.forEach(function (node: any) {
      var newNode: any = {
        id: node.id,
        name: node.name,
        description: node.description || "",
        children: [],
        modificationTime: node.modificationTime,
        tags: node.tags || [],
        extendTags: node.extendTags,
        icon: node.icon,
        iconColor: node.iconColor,
        pinyin: node.pinyin,
        password: node.password || "",
        passwordTips: node.passwordTips || "",
        coverId: node.coverId,
      };
      if (node.orderBy) {
        newNode.orderBy = node.orderBy;
        newNode.sortIncrease = node.sortIncrease;
      }
      if (extraInfo) {
        newNode.isExpand = node.isExpand;
      }
      newTree.push(newNode);
      _cloneTree(newNode.children, node, extraInfo);
    });
  }
}

/* getHashID（bundle 2127-2273 逐字；依赖 i18n（index.html 内联脚本，b1 存活）、
   EagleConfig.SUPPORT_FORMATS、pluginModule.previewExtension、VIDEO_TYPES_GLOBAL、_.get） */
function _getHashID(image: any, hasColorInfo: any): any {
  const w = window as any;
  var hashID = '';
  try {
    if (image) {
      if (image.name === w.i18n.__("general.untitled.title")) {
        return hashID;
      }

      // 本體不支原且也沒有插件支援
      if (!w.EagleConfig.SUPPORT_FORMATS[image.ext] && !w.pluginModule.previewExtension.thumbnailPluginMap[image.ext]) {
        return hashID;
      }

      if (w.VIDEO_TYPES_GLOBAL[image.ext]) {
        hashID = 'v-' + image.size + image.duration;
        return hashID;
      }

      // if (image && image.palettes) {
      switch (image.ext) {
        case 'svg':
        case 'tga':
        case 'bmp':
        case 'txt':
          break;
        case 'url':
          if (image.videoID) {
            hashID = 'u-' + image.videoID;
          }
          else {
            hashID = 'u-' + image.url;
          }
          break;
        case 'mp3':
        case 'wav':
        case 'ogg':
        case 'flac':
        case 'm4a':
        case 'aac':
          if (!hasColorInfo) {
            hashID = 'ad' + image.size + image.duration + image.ext;
            if (image.bpm) {
              hashID += image.bpm;
            }
          }
          else if (image.bpm) {
            hashID = 'ad' + image.size + image.duration + image.ext + image.name + image.bmp;
          }
          break;
        case 'pdf':
          hashID = 'pdf-' + image.size + image.width + image.height;
          break;
        case 'ttf': {
          var uniqueID = w._.get(image, `fontMetas.uniqueID.en`, w._.get(image, `fontMetas.uniqueID.zh`, w._.get(image, `fontMetas.uniqueID.jp`, image?.fontMetas?.ID)));
          if (!uniqueID) return undefined;
          var postScriptName = w._.get(image, `fontMetas.postScriptName.en`, w._.get(image, `fontMetas.postScriptName.zh`, w._.get(image, `fontMetas.postScriptName.jp`, undefined)));
          var version = w._.get(image, `fontMetas.version.en`, w._.get(image, `fontMetas.version.zh`, w._.get(image, `fontMetas.version.jp`, undefined)));
          hashID = 'ttf-' + image.size + uniqueID + postScriptName + version;
          break;
        }
        case 'otf': {
          var uniqueID2 = w._.get(image, `fontMetas.uniqueID.en`, w._.get(image, `fontMetas.uniqueID.zh`, w._.get(image, `fontMetas.uniqueID.jp`, image?.fontMetas?.ID)));
          if (!uniqueID2) return undefined;
          var postScriptName2 = w._.get(image, `fontMetas.postScriptName.en`, w._.get(image, `fontMetas.postScriptName.zh`, w._.get(image, `fontMetas.postScriptName.jp`, undefined)));
          var version2 = w._.get(image, `fontMetas.version.en`, w._.get(image, `fontMetas.version.zh`, w._.get(image, `fontMetas.version.jp`, undefined)));
          hashID = 'otf-' + image.size + uniqueID2 + postScriptName2 + version2;
          break;
        }
        case 'ttc': {
          var uniqueID3 = w._.get(image, `fontMetas.uniqueID.en`, w._.get(image, `fontMetas.uniqueID.zh`, w._.get(image, `fontMetas.uniqueID.jp`, image?.fontMetas?.ID)));
          if (!uniqueID3) return undefined;
          var postScriptName3 = w._.get(image, `fontMetas.postScriptName.en`, w._.get(image, `fontMetas.postScriptName.zh`, w._.get(image, `fontMetas.postScriptName.jp`, undefined)));
          var version3 = w._.get(image, `fontMetas.version.en`, w._.get(image, `fontMetas.version.zh`, w._.get(image, `fontMetas.version.jp`, undefined)));
          hashID = 'ttc-' + image.size + uniqueID3 + postScriptName3 + version3;
          console.log(hashID);
          break;
        }
        case 'woff': {
          var uniqueID4 = w._.get(image, `fontMetas.uniqueID.en`, w._.get(image, `fontMetas.uniqueID.zh`, w._.get(image, `fontMetas.uniqueID.jp`, image?.fontMetas?.ID)));
          if (!uniqueID4) return undefined;
          var postScriptName4 = w._.get(image, `fontMetas.postScriptName.en`, w._.get(image, `fontMetas.postScriptName.zh`, w._.get(image, `fontMetas.postScriptName.jp`, undefined)));
          var version4 = w._.get(image, `fontMetas.version.en`, w._.get(image, `fontMetas.version.zh`, w._.get(image, `fontMetas.version.jp`, undefined)));
          hashID = 'woff-' + image.size + uniqueID4 + postScriptName4 + version4;
          break;
        }
        default:
          if (hasColorInfo && image.palettes && image.palettes[0]) {
            hashID = 'image-';

            if (image.palettes[0]) {
              hashID += (
                (new String(Math.ceil(image.palettes[0].color[0] / 10) * 10) as any) +
                (new String(Math.ceil(image.palettes[0].color[1] / 10) * 10) as any) +
                (new String(Math.ceil(image.palettes[0].color[2] / 10) * 10) as any)
              );
            }

            if (image.palettes[1]) {
              hashID += (
                (new String(image.palettes[1].color[0]) as any) +
                (new String(image.palettes[1].color[1]) as any) +
                (new String(image.palettes[1].color[2]) as any)
              );
            }

            if (image.palettes[2]) {
              hashID += (
                (new String(image.palettes[2].color[0]) as any) +
                (new String(image.palettes[2].color[1]) as any) +
                (new String(image.palettes[2].color[2]) as any)
              );
            }

            hashID += (image.size + '' + image.width + '' + image.height + '' + image.ext);
          }
          else if (hasColorInfo) {
            const canGeneratePalette = (image: any, thumbnailSize: any) => {
              if (!image || !thumbnailSize) { return false; }
              var max = 30000000;
              var sum = 0;
              var newHeight = image.height / (image.width / thumbnailSize);
              sum = newHeight * thumbnailSize;
              return sum <= max;
            };
            // NOTE: 长图片没有进行颜色分析，所以只能额外做这个判断
            if (!canGeneratePalette(image, 640)) {
              return 'image-' + image.size + '' + image.width + '' + image.height + '' + image.ext;
            }
            return undefined;
          }
          else if (image.ext == "bmp") {
            return undefined;
          }
          else {
            hashID = 'image-' + image.size + '' + image.width + '' + image.height + '' + image.ext;
          }

        // image.palettes.forEach(function (palette, index) {
        //     hashID = hashID + (new String(
        //         Math.ceil( (palette.color[0] + palette.color[1] + palette.color[2] ) / 8 ) * 8 + '' +
        //         Math.round(palette.ratio*10)
        //     );
        // });
      }
    }
  }
  catch (err) {
  }
  return hashID;
}

/* hiddenByCurrentFilter（bundle 49600-49663 逐字；filterData/contentFilter/smartFolderCount
   经 $bodyScope 解析——filterData/contentFilter 仍由 bundle 承载，smartFolderCount 已是
   c9d 移植版） */
function _hiddenByCurrentFilter(items: any[]): void {
  const w = window as any;
  const bs: any = w.$bodyScope;

  if (!items || items.length === 0) return;
  let total = items.length;
  let once = 350;
  let loopCount = total / once;
  let countOfSend = 0;

  async function send() {
    var start = countOfSend * once;
    var willSendItems = items.slice(start, start + once);
    countOfSend += 1;

    try {
      if (!willSendItems || willSendItems.length === 0) return;
      console.log("第 %d 更新，目前進度 %d / %d", countOfSend, willSendItems.length + (countOfSend - 1) * once, total);
      var keepItems = await bs.filterData(willSendItems);
      keepItems = keepItems.filter(bs.contentFilter);
      var keetItemsMap: any = {};
      keepItems.forEach(function (item: any) {
        keetItemsMap[item.id] = true;
      });
      var result: any[] = [];
      willSendItems.forEach(function (item: any) {
        if (!keetItemsMap[item.id]) {
          result.push(item);
        }
      });
      if (result.length > 0) {
        var hiddenItemMap: any = {};
        var hiddenElements: any[] = [];
        result.forEach(function (item: any) {
          var $box = w.$(`#box-${item.id}`);
          if ($box.length > 0) {
            hiddenElements.push($box[0]);
          }
          hiddenItemMap[item.id] = true;
        });

        // 从当前筛选结果移除项目
        bs.allData = bs.allData.filter((item: any) => {
          return !hiddenItemMap[item.id];
        });

        if (hiddenElements.length > 0) {
          bs.$broadcast("gl:removeItems", hiddenElements);
          if (bs.currentSmartFolder) {
            bs.currentSmartFolder.imageCount = bs.smartFolderCount(bs.currentSmartFolder);
            bs.$evalAsync();
          }
        }
      }
      // console.timeEnd("hiddenByCurrentFilter");
    }
    catch (err) { /* noop */ }

    loop();
  }

  function loop() {
    if (countOfSend < loopCount) {
      window.requestAnimationFrame(send);
    }
  }
  loop();
}

/* ayncsImagesChange（bundle 49667-49704 逐字；ipcRenderer 经统一表达式，backgroundWindowID
   为 window live binding——libraryDomain 域接管其赋值点） */
function _ayncsImagesChange(images: any[]): void {
  const w = window as any;
  const ipc: any = w.__eagleIpc || (w.electron && w.electron.ipcRenderer);
  if (!images || images.length === 0) return;
  setTimeout(() => {
    let total = images.length;
    let once = 350;
    let loopCount = total / once;
    let countOfSend = 0;

    function send() {
      var start = countOfSend * once;
      var willSendImages = images.slice(start, start + once);
      countOfSend += 1;
      console.log("第 %d 批傳送，目前進度 %d / %d", countOfSend, willSendImages.length + (countOfSend - 1) * once, total);
      // console.log(willSendImages);

      willSendImages.forEach((image: any) => {
        image.lastModified = Date.now();
      });

      if (w.backgroundWindowID === undefined) {
        ipc.send('images-change', willSendImages);
      }
      else {
        ipc.sendTo(w.backgroundWindowID, 'images-change', willSendImages);
      }

      willSendImages.forEach(function (image: any) {
        delete image['oldName'];
        delete image['newName'];
      });
      loop();
    }

    function loop() {
      if (countOfSend < loopCount) {
        window.requestAnimationFrame(send);
      }
    }
    loop();
  }, 0);
}

/* startAPIServer（bundle 18945-18968 逐字；APIServer 由 initAPIServer 赋值——bundle 在世
   时为其赋值，initAPIServer 移植片接管赋值点） */
function _startAPIServer(): void {
  const w = window as any;
  try {
    w.APIServer.start(() => {
      console.log('JSON API server started.');
      console.log(`try GET to access http://localhost:41595/`);

      setTimeout(() => {
        const xhr = new XMLHttpRequest();
        xhr.open("GET", `http://localhost:41595/`, true);
        xhr.onreadystatechange = () => {
          console.log(xhr);

          if (xhr.responseURL === "" && xhr.status == 0) {
            w.electronLog.info("[app] API server start fail[1].");
            (window as any).stopAPIServer();
          }
        };
        xhr.onerror = () => { /* noop */ };
        xhr.send();
      }, 5000);
    });
  }
  catch (err) { /* noop */ }
}

/* stopAPIServer（bundle 18970-18975 逐字） */
function _stopAPIServer(): void {
  const w = window as any;
  try {
    w.APIServer.stop();
    console.log('JSON API server stopped.');
  }
  catch (err) { /* noop */ }
}

/* checkBackgroundHeartbeat（bundle 19147-19190 逐字；heartbeatStopCount/heartbeatInterval
   为 window live binding——libraryDomain 域接管其赋值点；app/currentWindow 经 @electron/remote） */
function _checkBackgroundHeartbeat(): void {
  const w = window as any;
  const ipc: any = w.__eagleIpc || (w.electron && w.electron.ipcRenderer);
  // 理论上不该被呼叫，如果被呼叫 N 次，很有可能后台已经崩溃了，应在前台进行提示
  try {
    w.heartbeatStopCount++;
    if (w.heartbeatStopCount >= 30) {
      w.electronLog.error(`[app] The background process does not respond for more than 180 seconds`);
      clearInterval(w.heartbeatInterval);
      w.swal({
        html: `
                    <div class="alert">
                        <div class="alert-icon error"></div>
                        <h4 class="alert-title">${w.i18n.__("dialog.bgcrash.title")}</h4>
                        <p class="alert-desc">${w.i18n.__("dialog.bgcrash.desc")}</p>
                    </div>
                `,
        showCloseButton: false, showCancelButton: true, allowOutsideClick: false, focusConfirm: true, focusCancel: false, padding: 24,
        width: 400,
        customClass: "alert-box",
        cancelButtonColor: "#777777",
        confirmButtonText: w.i18n.__("dialog.bgcrash.btn1"),
        cancelButtonText: w.i18n.__("dialog.bgcrash.btn2"),
      }).then(function () {
        w.electronLog.error(`[app] The background process does not respond, user click retry btn`);
        w.heartbeatStopCount -= 5;
        w.heartbeatInterval = setInterval((window as any).checkBackgroundHeartbeat, 10000);
      }, function () {
        ipc.send("save-cache-file");
        if (w.currentWindow && !w.currentWindow.isDestroyed()) {
          w.currentWindow.hide();
        }
        setTimeout(function () {
          w.app.relaunch();
          w.app.exit(0);
        }, 3000);
      });
    }
    else {
      w.electronLog.error(`[app] The background process does not respond for more than ${w.heartbeatStopCount * 10} seconds`);
    }
  }
  catch (err) { /* noop */ }
}

/* ── b1-9a：基础设施 + 纯函数批（bundle 顶层逐字/等价提取）── */

/* getRawPath（bundle 2348-2361 逐字；force 形参 bundle 体内未使用——保留签名） */
function _getRawPath(imagesDir: any, image: any, force?: any): any {
  if (!image || !image.name) return;
  var imageDir = imagesDir + image.id + ".info/";
  var rawPath = "";
  var encodeName = encodeURIComponent(image.name);

  if (image.ext === 'svg') {
    rawPath = imageDir + encodeName + ".svg";
  } else {
    rawPath = imageDir + encodeName + "." + image.ext;
  }

  return rawPath.replace(/#/g, '%23');
}

/* getThumbnailPath（bundle 2363-2388 逐字） */
function _getThumbnailPath(imagesDir: any, image: any): any {
  if (!image || !image.name) return;
  if (image.noThumbnail) {
    return _getRawPath(imagesDir, image);
  }
  else {

    var imageDir = imagesDir + image.id + ".info/";
    var thumbnailPath = "";
    var encodeName = encodeURIComponent(image.name);

    if (image.ext === 'svg') {
      if (image.forceThumbnail) {
        thumbnailPath = `${imageDir}${encodeName}_thumbnail.png`;
      }
      else {
        thumbnailPath = `${imageDir}${encodeName}.svg`;
      }
    }
    else {
      thumbnailPath = `${imageDir}${encodeName}_thumbnail.png`;
      // thumbnailPath = "http://localhost:41592/?filePath=" + imageDir + encodeName + "_thumbnail.png";
    }

    return thumbnailPath.replace(/#/g, '%23');
  }
}

/* getExt（bundle 53678-53703 逐字；fs/path 经 require——bundle 顶层同源） */
function _getExt(file: any): any {
  const w = window as any;
  var pathMod = w.require('path');
  var fsMod = w.require('fs');

  var extname = pathMod.extname(file.path).toLowerCase();
  var ext = extname.replace(".", "");

  if (w.EagleConfig.SUPPORT_FORMATS[ext] === true) {
    return ext;
  }
  else if (extname === '.dmg') {
    return "dmg";
  }
  else if (extname === '.crdownload') {
    return undefined;
  }
  // 下载暂存文件 firefox
  else if (extname === '.part') {
    return undefined;
  }
  // 下载暂存文件 safari
  else if (extname === '.download') {
    return undefined;
  }
  else if (fsMod.statSync(file.path).isDirectory()) {
    return undefined;
  }
  return ext;
}

/* ayncsImagesRemove（bundle 49709-49745 逐字：50/批 empty-trash 分批（backgroundWindowID
   undefined → ipcRenderer.send / 否则 sendTo——与 _ayncsImagesChange 同双轨）） */
function _ayncsImagesRemove(images: any[]): void {
  const w = window as any;
  if (!images || images.length === 0) return;
  w.electronLog.info(`[app] Delete ${images.length} files permanently`);
  setTimeout(() => {
    let total = images.length;
    let once = 50;
    let loopCount = total / once;
    let countOfSend = 0;

    function send() {
      var start = countOfSend * once;
      var willSendImages = images.slice(start, start + once);
      countOfSend += 1;
      var imageIdString = "";
      willSendImages.forEach(function (r: any) {
        if (r.id) {
          imageIdString += r.id + ",";
        }
      });
      const ipc = w.__eagleIpc || w.ipcRenderer;
      if (w.backgroundWindowID === undefined) {
        ipc.send('empty-trash', imageIdString);
      }
      else {
        ipc.sendTo(w.backgroundWindowID, 'empty-trash', imageIdString);
      }
      loop();
    }

    function loop() {
      if (countOfSend < loopCount) {
        window.requestAnimationFrame(send);
      }
    }
    loop();
  }, 0);
}

/* updateWindowProgressBar（bundle 49810 逐字：throttle 333ms leading——节流实例一次性
   创建（w.throttle = bundle 2400 helper 同源 _throttle）；currentWindow 经 bundleGlobals
   @electron/remote 供给） */
let _updateWindowProgressBarInst: any = null;
function _getUpdateWindowProgressBar(): any {
  const w = window as any;
  if (!_updateWindowProgressBarInst) {
    _updateWindowProgressBarInst = w.throttle((progress: any) => {
      try {
        if (w.currentWindow && !w.currentWindow.isDestroyed()) {
          w.currentWindow.setProgressBar(progress);
        }
      }
      catch (err) { }
    }, 333, true);
  }
  return _updateWindowProgressBarInst;
}

/* 鼠标追踪（bundle 20366-20378 逐字：document mousemove → windowMouseX/Y = pageX/pageY +
   isMouseMoving 100ms 复位——windowMouseX/Y/isMouseMoving 为 bundle 顶层 var） */
let _mouseTrackerInstalled = false;
function _installMouseTracker(): void {
  if (_mouseTrackerInstalled) return;
  const w = window as any;
  var mousemoveTimeout: any;
  var isMouseMoving = false;
  document.addEventListener('mousemove', function (e: any) {
    w.windowMouseX = e.pageX;
    w.windowMouseY = e.pageY;
    if (isMouseMoving) return;
    isMouseMoving = true;
    clearTimeout(mousemoveTimeout);
    mousemoveTimeout = setTimeout(function () {
      isMouseMoving = false;
    }, 100);
  }, false);
  _mouseTrackerInstalled = true;
}

/* ── b1-9b：管理器批（bundle 顶层对象逐字提取；$scope 类引用经 getBodyScope 同双轨解析）── */

/* QuickAccessManager 方法面（bundle 46666-46753 逐字——bundle 19061 `var QuickAccessManager = {}`
   顶体 + controller init 挂方法；b1 后由本模块同序重建） */
function _attachQuickAccessManager(qam: any): void {
  const w = window as any;
  const s = (): any => getBodyScope();

  qam.add = function (type: any, object: any) {
    s().quickAccess.push({
      type: type,
      id: object.id
    });
    s().updateSidebarList();
    qam.save();
    w.electronLog.info(`[app] Add ${type}(${object.id}) to quick access`);
    w.analytics.event('QuickAccess', 'Add', type);
  };

  qam.addMultiple = function (type: any, objects: any) {
    if (!objects) return;
    objects.forEach(function (object: any) {
      if (qam.indexOf(object) === -1) {
        s().quickAccess.push({
          type: type,
          id: object.id
        });
        w.electronLog.info(`[app] Add ${type}(${object.id}) to quick access`);
        w.analytics.event('QuickAccess', 'Add', type);
      }
    });
    s().updateSidebarList();
    qam.save();
  };

  qam.remove = function (type: any, object: any) {
    var idx = qam.indexOf(object);
    if (idx > -1) {
      s().quickAccess.splice(idx, 1);
      s().updateSidebarList();
      qam.save();
      w.electronLog.info(`[app] Remove ${type}(${object.id}) from quick access`);
      w.analytics.event('QuickAccess', 'Remove', type);
    }
  };

  qam.removeMultiple = function (type: any, objects: any) {
    if (!objects) return;
    objects.forEach(function (object: any) {
      var idx = qam.indexOf(object);
      if (idx > -1) {
        s().quickAccess.splice(idx, 1);
        w.electronLog.info(`[app] Remove ${type}(${object.id}) from quick access`);
        w.analytics.event('QuickAccess', 'Remove', type);
      }
    });
    s().updateSidebarList();
    qam.save();
  };

  qam.removeIndex = function (idx: any) {
    if (idx > -1) {
      var object = s().quickAccess[idx];
      s().quickAccess.splice(idx, 1);
      s().updateSidebarList();
      qam.save();
      w.electronLog.info(`[app] Remove ${object.type}(${object.id}) from quick access`);
      w.analytics.event('QuickAccess', 'Remove', object.type);
    }
  };

  qam.save = function () {
    s().saveFolder();
  };

  qam.indexOf = function (object: any) {
    var arr = s().quickAccess;
    for (var i = 0; i < arr.length; i++) {
      if (object.id === arr[i].id) {
        return i;
      }
    }
    return -1;
  };

  qam.getItem = function (type: any, id: any) {
    switch (type) {
      case "folder":
        return s().folderMappings[id];
      case "smartFolder":
        return s().smartFolderMappings[id];
    }
  };
}

/* RecentFileManager（bundle 52307-52422 逐字；save = w.throttle(fn, 1000, true)——bundle 顶层
   throttle 同源；localStorage 键 eagle.recentFiles.* 逐字） */
function _buildRecentFileManager(): any {
  const w = window as any;
  const RecentFileManager: any = {
    libraryName: "",
    recentFiles: [],
    recentFilesOrder: {},
    maxHistory: 5000,
    init: function (libraryName: any) {
      RecentFileManager.libraryName = libraryName;
      let json = localStorage[`eagle.recentFiles.${RecentFileManager.libraryName}`];
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
      catch (err) { }
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
      catch (err) { }
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
      catch (err) { }
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
        localStorage[`eagle.recentFiles.${RecentFileManager.libraryName}`] = json;
      }
      catch (err) { }
    }, 1000, true)
  };
  return RecentFileManager;
}

/* SlowNotify（bundle 19073-19133 逐字；show 内 $bodyScope → getBodyScope） */
function _buildSlowNotify(): any {
  const w = window as any;
  return {
    hasShow: false,
    triggerCount: 24,
    resetCount: 4,
    slowCount: 0,
    fastCount: 0,
    calculate: function (loadSpeed: any) {
      if (!loadSpeed || w.SlowNotify.hasShow) return;
      if (loadSpeed > 5000) {
        w.SlowNotify.slowCount += 4;
      }
      else if (loadSpeed > 2500) {
        w.SlowNotify.slowCount += 2.5;
      }
      else if (loadSpeed > 2000) {
        w.SlowNotify.slowCount += 1.5;
      }
      else if (loadSpeed >= 1500) {
        w.SlowNotify.slowCount += 1;
      }

      if (loadSpeed <= 300) {
        w.SlowNotify.fastCount += 2;
      }
      else if (loadSpeed <= 500) {
        w.SlowNotify.fastCount += 1;
      }
      else if (loadSpeed <= 700) {
        w.SlowNotify.fastCount += 0.5;
      }
      else {
        w.SlowNotify.fastCount = 0;
      }
      // console.log(`SlowNotify.slowCount: ${SlowNotify.slowCount}, SlowNotify.fastCount: ${SlowNotify.fastCount}`)
      w.SlowNotify.detect();
    },
    detect: function () {
      if (w.SlowNotify.fastCount >= w.SlowNotify.resetCount) {
        w.SlowNotify.fastCount = 0;
        w.SlowNotify.slowCount = 0;
        // console.log("重置")
      }
      if (w.SlowNotify.slowCount >= w.SlowNotify.triggerCount) {
        w.SlowNotify.show();
      }
    },
    show: function () {
      const bodyScope = getBodyScope();
      bodyScope.showSlowNotify = true;
      bodyScope.$evalAsync(function () {
        setTimeout(function () {
          w.$("#library-warning").addClass("show active");
          setTimeout(function () {
            w.$("#library-warning").removeClass("active");
          }, 10000);
        }, 300);
      });
      w.SlowNotify.hasShow = true;
      console.log("跳出提示");
      w.electronLog && w.electronLog.error(`[app] Warning: hard drive performance too slow`);
    }
  };
}

/* analytics（bundle 105501-105706 逐字；deps：pjson/locale/customDimesion1 为 bundle 顶层
   var（105480-105484）→ 挂载时同径计算；ga4track（105491）经 vendor eagle-ga4mp.js 注入
   后惰性解析（bare 引用 → w.ga4track + 存在性守卫——telemetry 容忍早期调用丢失，登记）） */
function _buildAnalytics(): any {
  const w = window as any;
  const pjson = w.require((w.appRoot && (w.appRoot.path || w.appRoot)) + '/package.json');
  const clientId = w.localStorage["gaClientId"];
  const locale = (w.preferences && w.preferences.language) || "en";
  if (w.customDimesion1 === undefined) w.customDimesion1 = "未激活"; // 105484
  const analyticsObj: any = {
    apiVersion: '1',
    trackID: 'UA-88989101-2',
    clientID: clientId,
    userID: clientId,
    appName: 'Eagle App',
    appVersion: `${pjson.version} (${pjson.buildVersion})`,
    debug: false,
    performanceTracking: true,
    errorTracking: true,
    userLanguage: locale.replace("_", "-").toLowerCase(),
    currency: "USD",
    lastScreenName: '',

    sendRequest: function (data: any, callback: any) {

      // 工程模式不需要記錄
      if (pjson.buildVersion === "dev") return;

      var postData = "v=" + this.apiVersion
        + "&tid=" + this.trackID
        + "&cid=" + this.clientID
        + "&uid=" + this.userID
        + "&an=" + this.appName
        + "&av=" + this.appVersion
        + "&sr=" + this.getScreenResolution()
        + "&vp=" + this.getViewportSize()
        + "&sd=" + this.getColorDept()
        + "&ul=" + this.userLanguage
        + "&ua=" + this.getUserAgent()
        + "&cd1=" + w.customDimesion1  // 自定维度1
        + "&ds=app";

      Object.keys(data).forEach(function (key: any) {
        var val = data[key];
        if (typeof val != "undefined")
          postData += "&" + key + "=" + val;
      });

      var http = new XMLHttpRequest();
      var url = "https://www.google-analytics.com";
      if (!this.debug)
        url += "/collect";
      else
        url += "/debug/collect";

      http.open("POST", url, true);

      http.setRequestHeader("Content-type", "application/x-www-form-urlencoded");

      http.onreadystatechange = function () {
        if (w.analytics.debug)
          console.log(http.response);

        if (http.readyState == 4 && http.status == 200) {
          if (callback)
            callback(true);
        }
        else {
          if (callback)
            callback(false);
        }
      };
      http.send(postData);
    },
    generateClientID: function () {
      var id = "";
      var possibilities = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
      for (var i = 0; i < 5; i++)
        id += possibilities.charAt(Math.floor(Math.random() * possibilities.length));
      return id;
    },
    getScreenResolution: function () {
      return screen.width + "x" + screen.height;
    },
    getColorDept: function () {
      return screen.colorDepth + "-bits";
    },
    getUserAgent: function () {
      return navigator.userAgent;
    },
    getViewportSize: function () {
      return window.screen.availWidth + "x" + window.screen.availHeight;
    },

    /*
     * Measurement Protocol
     * [https://developers.google.com/analytics/devguides/collection/protocol/v1/devguide]
     * https://developers.google.com/analytics/devguides/collection/protocol/v1/parameters#t
     */

    screenView: w.throttle(function (this: any, screename: any) {
      var data = {
        't': 'screenview',
        'cd': screename
      }
      this.sendRequest(data);
      this.lastScreenName = screename;
      w.ga4track && w.ga4track.trackEvent('page_view', {
        page_location: `/${screename}`,
        page_title: screename,
      });
    }, 10000),
    event: function (this: any, category: any, action: any, label: any, value: any) {
      var data = {
        't': 'event',
        'ec': category,
        'ea': action,
        'el': label,
        'ev': value,
        'cd': this.lastScreenName,
      }
      this.sendRequest(data);

      let params: any = {};
      if (action) {
        params[action] = label || "true";
      }
      w.ga4track && w.ga4track.trackEvent(category, params);
    },
    exception: function (this: any, msg: any, fatal: any) {
      var data = {
        't': 'exception',
        'exd': msg,
        'exf': fatal || 0
      }
      this.sendRequest(data);
    },
    timing: function (this: any, category: any, variable: any, time: any, label: any) {
      var data = {
        't': 'timing',
        'utc': category,
        'utv': variable,
        'utt': time,
        'utl': label,
      }
      this.sendRequest(data);
    },
    ecommerce: {
      transactionID: false,
      generateTransactionID: function () {
        var id = "";
        var possibilities = "0123456789";
        for (var i = 0; i < 5; i++)
          id += possibilities.charAt(Math.floor(Math.random() * possibilities.length));
        return id;
      },
      transaction: function (this: any, total: any, items: any) {
        var t_id = "";
        if (!this.ecommerce.transactionID)
          t_id = this.ecommerce.generateTransactionID();
        else
          t_id = this.ecommerce.transactionID;

        var data = {
          't': 'transaction',
          'ti': t_id,
          'tr': total,
          'cu': this.currency,
        }
        this.sendRequest(data);

        items.forEach(function (this: any, item: any) {
          var data = {
            't': 'item',
            'ti': t_id,
            'in': item.name,
            'ip': item.price,
            'iq': item.qty,
            'ic': item.id,
            'cu': this.currency
          }
          this.sendRequest(data);
        })
      }
    },
    custom: function (this: any, data: any) {
      this.sendRequest(data);
    }
  };
  return analyticsObj;
}

/* ScrollbarSaver（bundle 46754-46828 逐字——controller init 赋值；$scope → getBodyScope；
   ig → w.ig（网格实例，b1-9c 归口）） */
function _buildScrollbarSaver(): any {
  const w = window as any;
  const s = (): any => getBodyScope();
  return {
    positionMapping: {},
    getId: function (this: any) {
      var id;
      if (s().currentFolder) { id = s().currentFolder.id; }
      else if (s().currentSmartFolder) { id = s().currentSmartFolder.id; }
      else if (s().viewMode == "all") { id = "all"; }
      else if (s().viewMode == "unfiled") { id = "unfiled"; }
      else if (s().viewMode == "untagged") { id = "untagged"; }
      else if (s().viewMode == "trash") { id = "trash"; }
      else if (s().viewMode == "random") { id = "random"; }
      else if (s().viewMode == "recent") { id = "recent"; }
      return id;
    },
    saveScrollPosition: function (this: any) {
      if (w.eagle.filter.filterBadge > 0) return;
      if (s().keyword) return;
      if (w.$(".box").length + w.$(".sub-folder").length === 0) return;
      var scrollTop = w.$("#box-container").scrollTop();
      var obj: any = {};
      var id = w.ScrollbarSaver.getId();

      if (scrollTop === 0) {
        delete w.ScrollbarSaver.positionMapping[id];
        return;
      }

      var startCursor = 0;
      var offsetTop = (w.$(".box-list")[0] && w.$(".box-list")[0].offsetTop) || 0;
      var scrollOffset;
      if (w.$(".sub-folder").length > 0 && s().startCursor === 0) {
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
      w.ScrollbarSaver.positionMapping[id] = obj;
    },
    restoreScrollPosition: function (this: any) {

      if (s().viewMode === 'random') return;
      if (w.eagle.filter.filterBadge > 0) return;
      var id = w.ScrollbarSaver.getId();

      if (!id) return;

      var obj = w.ScrollbarSaver.positionMapping[id];
      var $boxContainer = w.$("#box-container");
      if (obj) {
        s().startCursor = obj.cursor || 0;
        var offset = obj.offset || 0;
        var times = [20, 300];
        for (var i = times[0]; i < times[1]; i += 20) {
          setTimeout(function () {
            if (w.ScrollbarSaver.getId() !== id || $boxContainer.scrollTop() !== offset) {
              $boxContainer.scrollTop(offset);
            }
          }, i);
        }
      }
      else {
        s().startCursor = 0;
      }
    }
  };
}

/* ── b1-9c：网格耦合收口 + 目录枚举批 ── */

/* walk（bundle 52664-52697 逐字：递归目录枚举——getExt/junk.is/IS_DIRECTORY.check 过滤 +
   .pxd 特判；注释原样保留） */
function _walk(dir: any): any[] {
  const w = window as any;
  var fsMod = w.require('fs');
  var results: any[] = [];
  var list = fsMod.readdirSync(dir);
  for (let i = 0; i < list.length; i++) {
    let file = dir + '/' + list[i];
    let ext = w.getExt({ path: file });
    if (ext) {
      if (!w.junk.is(list[i])) {
        results.push(file);
      }
    }
    else {
      // var stat = fs.statSync(file)
      if (file.endsWith(".pxd")) {
        results.push(file);
      }
      else if (w.IS_DIRECTORY.check(file)) {
        results = results.concat(w.walk(file));
      }
      else {
        if (!w.junk.is(list[i])) {
          results.push(file);
        }
      }
    }
  // }
  // list.forEach(function(file) {
    // file = dir + '/' + file
    // var stat = fs.statSync(file)
    // Note: 特殊格式档案会被误判成文件夹
    // if (file.endsWith(".pxd")) results.push(file);
    // else if (stat && stat.isDirectory()) results = results.concat(walk(file))
    // else results.push(file)
  // })
  }
  return results;
}

/* installedFonts 初扫（bundle 19243-19258 逐字：fontFolder readdir → `${name}_${extname}`
   键表；React machinery 运行时增删复用同表） */
function _scanInstalledFonts(): void {
  const w = window as any;
  const fsMod = w.require('fs');
  const pathMod = w.require('path');
  fsMod.access(w.fontFolder, function (err: any) {
    if (!err) {
      fsMod.readdir(w.fontFolder, function (err2: any, files: any) {
        if (err2) return;
        try {
          files.forEach(function (file: any) {
            var extname = pathMod.extname(file).toLowerCase();
            var name = pathMod.basename(file, extname);
            var key = `${name}_${extname}`;
            w.installedFonts[key] = true;
          });
        }
        catch (err3) { }
        // console.log(installedFonts);
      });
    }
  });
}

export function installBundleGlobals(): void {
  if (installed) return;
  installed = true;
  const w = window as any;
  const req = (name: string): any => {
    try {
      return w.require ? w.require(name) : undefined;
    } catch (err) { return undefined; }
  };

  // ── appRoot（bundle 19002：var appRoot = require('app-root-path')）──
  if (!w.appRoot) {
    const appRootMod = req('app-root-path');
    if (appRootMod) w.appRoot = appRootMod;
  }

  // ── EagleConfig（bundle 2051：const EagleConfig = require(appRoot + '/config.js')）──
  if (!w.EagleConfig && w.appRoot) {
    const cfg = req(w.appRoot + '/config.js');
    if (cfg) w.EagleConfig = cfg;
  }

  // ── 类型表（bundle 18988-18994 逐字；由 EagleConfig 格式表构建）──
  if (!w.VIDEO_TYPES && w.EagleConfig && w.EagleConfig.VIDEO_FORMATS) {
    const VIDEO_TYPES: any = {}; w.EagleConfig.VIDEO_FORMATS.forEach(function (ext: string) { VIDEO_TYPES[ext] = true; });
    w.VIDEO_TYPES = VIDEO_TYPES;
  }
  if (!w.AUDIO_TYPES && w.EagleConfig && w.EagleConfig.AUDIO_FORMATS) {
    const AUDIO_TYPES: any = {}; w.EagleConfig.AUDIO_FORMATS.forEach(function (ext: string) { AUDIO_TYPES[ext] = true; });
    w.AUDIO_TYPES = AUDIO_TYPES;
  }
  if (!w.FONT_TYPES && w.EagleConfig && w.EagleConfig.FONT_FORMATS) {
    const FONT_TYPES: any = {}; w.EagleConfig.FONT_FORMATS.forEach(function (ext: string) { FONT_TYPES[ext] = true; });
    w.FONT_TYPES = FONT_TYPES;
  }
  if (!w.SPECIAL_TYPES) {
    // bundle 18994 原文 afpub 出现两次（对象键去重后行为一致），此处只保留一次
    w.SPECIAL_TYPES = { mhtml: true, html: true, fbx: true, obj: true, 'glb': true, '3ds': true, '3mf': true, 'dae': true, 'ifc': true, 'ply': true, 'stl': true, af: true, afpub: true, afdesign: true, afphoto: true, fig: true, cdr: true, skp: true, dwg: true, blend: true, c4d: true, clip: true, prd: true, exr: true, hdr: true, skt: true, ppt: true, pptx: true, potx: true, docx: true, doc: true, xls: true, xlsx: true, eddx: true, emmx: true, number: true, page: true, txt: true };
  }

  // ── fileSize（bundle 2548-2572 逐字）──
  if (!w.fileSize) {
    w.fileSize = function (bytes: any, precision: any) {
      var units = [
        'bytes',
        'KB',
        'MB',
        'GB',
        'TB',
        'PB'
      ];

      if (isNaN(parseFloat(bytes)) || !isFinite(bytes)) {
        return '?';
      }

      var unit = 0;
      var k = 1024;
      if (w.process && w.process.platform === 'darwin') k = 1000;

      while (bytes >= k) {
        bytes /= k;
        unit++;
      }

      return bytes.toFixed(+precision) + ' ' + units[unit];
    };
  }

  // ── re-require 十行（bundle 22776-22787 同路径；同 require 缓存命中同一实例）──
  try {
    if (!w.fse) w.fse = req('fs-extra');
    if (!w.tinyPinyin) w.tinyPinyin = req(w.appRoot + '/my_modules/tiny-pinyin');
    if (!w.pinyinlite) w.pinyinlite = req(w.appRoot + '/my_modules/pinyinlite');
    if (!w.readChunk) w.readChunk = req('read-chunk');
    if (!w.writeFileAtomic) w.writeFileAtomic = req('write-file-atomic');
    if (!w.cartesianProduct) w.cartesianProduct = req(w.appRoot + '/my_modules/cartesian-product');
    if (!w.sanitize) w.sanitize = req(w.appRoot + '/my_modules/sanitize-filename');
    if (!w.unicodeNormalize) w.unicodeNormalize = req('normalize-strings');
    if (!w.chineseConvert) w.chineseConvert = req(w.appRoot + '/my_modules/chinese_convert');
    if (!w.colorConvert) w.colorConvert = req('color-convert');
    if (!w.DeltaE) w.DeltaE = req('delta-e');
  } catch (err) { /* noop */ }

  // ── installedFonts（bundle 19243：var installedFonts = {}——b1-9c 起在文件尾统一
  // 挂载并执行 fontFolder 初扫）──

  // ── fontFolder（bundle 19192-19198 逐字）──
  if (!w.fontFolder) {
    if (w.process && w.process.platform === 'darwin') {
      try {
        const remoteMod = w.electron && w.electron.remote ? w.electron.remote : (w.require('@electron/remote') || undefined);
        const app = remoteMod && remoteMod.app;
        if (app) w.fontFolder = `${app.getPath("home")}/library/Fonts/EagleApp/`;
      } catch (err) { /* noop */ }
    }
    else {
      w.fontFolder = w.process ? `${w.process.env.SYSTEMROOT}/Fonts/` : undefined;
    }
  }

  // ── FileUrlHelper（React c1 移植版 fileUrlHelper.ts——bundle 2287 对象字面量的逐字提取，
  //    方法面全覆盖：getMetadataPath/getRawPath/getThumbnailPath/getThumbnailUrl/
  //    getLastestThumbnailUrl/getRawUrl）──
  if (!w.FileUrlHelper) w.FileUrlHelper = FileUrlHelper;

  // c12：eagle 成员反转挂载
  installEagleMembers();

  // c17a：bundle 顶层词法 const/let 接装（const/let 不上 window——bundle 在世时 React 裸引
  // 可达依赖 vite IIFE 加载共享全局词法；b1 后 bundle 死亡，由本处 if-absent 供给）。
  // IPCHelper（bundle 3471-3489 逐字；send/sendTo = ipc 统一表达式 + electronLog + try/catch 静默）
  if (!w.IPCHelper) {
    const ipcRef = () => w.__eagleIpc || (w.electron && w.electron.ipcRenderer);
    w.IPCHelper = {
      send: function (channel: string, params: any, ignoreLogging: any) {
        try {
          ipcRef().send(channel, params);
          if (!ignoreLogging) {
            w.electronLog && w.electronLog.info(`[ipc] ${channel}`);
          }
        }
        catch (err) {
        }
      },
      sendTo: function (id: any, channel: string, params: any, ignoreLogging: any) {
        try {
          ipcRef().sendTo(id, channel, params);
          if (!ignoreLogging) {
            w.electronLog && w.electronLog.info(`[ipc] ${channel}`);
          }
        }
        catch (err) {
        }
      }
    };
  }
  // PERFORMANCE_MONITOR（bundle 18977-18980 逐字）
  if (!w.PERFORMANCE_MONITOR) {
    w.PERFORMANCE_MONITOR = {
      watchDigest: false,
      watchMemoryUsage: false,
    };
  }
  // ACCESS（bundle 19026：require(appRoot + '/my_modules/access')）
  if (!w.ACCESS && w.appRoot) {
    const access = req(w.appRoot + '/my_modules/access');
    if (access) w.ACCESS = access;
  }
  // isVentura（bundle 19058 逐字；osVersion = os.release()）
  if (w.isVentura === undefined) {
    try {
      const osMod = req('os');
      const osVersion = osMod ? (osMod.release() || "") : "";
      w.isVentura = w.process && w.process.platform === 'darwin' && parseInt(osVersion) >= 22;
    } catch (err) { w.isVentura = false; }
  }

  // c17c：UrlStateService（js/services/url-state-service.js 逐字语义；原实现为 Angular
  // factory（$location 搜索参数管理），b1 后以 window.location.hash 直读写复刻：
  // hash = '#!path?query'（Angular 默认 hash 模式约定）；isDetailMode 时阻止变更 =
  // $locationChangeStart preventDefault 语义；onChange = $locationChangeSuccess 分发）
  if (!w.UrlStateService) {
    const usListeners: Function[] = [];
    const usParseHash = () => {
      const hash = window.location.hash || '';
      const qi = hash.indexOf('?');
      const search = qi >= 0 ? hash.slice(qi + 1) : '';
      const params: any = {};
      search.split('&').forEach((kv) => {
        if (!kv) return;
        const eq = kv.indexOf('=');
        const k = decodeURIComponent(eq >= 0 ? kv.slice(0, eq) : kv);
        const v = eq >= 0 ? decodeURIComponent(kv.slice(eq + 1)) : '';
        if (k) params[k] = v;
      });
      return params;
    };
    const usComposeHash = (params: any) => {
      const qs = Object.keys(params).map((k) => encodeURIComponent(k) + '=' + encodeURIComponent(params[k])).join('&');
      const hash = window.location.hash || '#!/';
      const pi = hash.indexOf('?');
      const path = pi >= 0 ? hash.slice(0, pi) : hash;
      return path + (qs ? '?' + qs : '');
    };
    const usStateOf = (search: any) => ({
      view: search.view || 'all',
      folder: search.folder || null,  // Keep as string, don't parseInt
      smartfolder: search.smartfolder || null,  // Keep as string, don't parseInt
      color: search.color || null,
      page: search.page ? parseInt(search.page) : 1,
      imageFilter: search.imageFilter || null
    });
    w.UrlStateService = {
      canGoBack: function () { return w.currentWindow && w.currentWindow.webContents && w.currentWindow.webContents.canGoBack(); },
      canGoForward: function () { return w.currentWindow && w.currentWindow.webContents && w.currentWindow.webContents.canGoForward(); },
      getState: function () { return usStateOf(usParseHash()); },
      setState: function (params: any, replace: any) {
        const s: any = w.$bodyScope;
        if (s && s.isDetailMode) return; // $locationChangeStart preventDefault 语义
        const current = usParseHash();
        const merged: any = Object.assign({}, current, params);
        Object.keys(merged).forEach((key) => {
          if (merged[key] === null || merged[key] === undefined || merged[key] === '') {
            delete merged[key];
          }
        });
        const next = usComposeHash(merged);
        const prev = window.location.hash;
        if (next === prev) return;
        if (replace) {
          try { history.replaceState(null, '', next); } catch (err) { window.location.hash = next; }
        } else {
          window.location.hash = next;
        }
        const state = usStateOf(merged);
        usListeners.slice().forEach((fn) => { try { fn(state); } catch (err) { /* noop */ } });
      },
      clearState: function () {
        const s: any = w.$bodyScope;
        if (s && s.isDetailMode) return;
        window.location.hash = usComposeHash({});
      },
      onChange: function (fn: any) {
        usListeners.push(fn);
        return function () {
          const index = usListeners.indexOf(fn);
          if (index > -1) {
            usListeners.splice(index, 1);
          }
        };
      }
    };
  }

  // c13：eg/InfiniteGrid（bundle 3497-8094 内联 pkgd UMD，b1 死亡）——if-absent 懒执行
  // public/vendor 的逐字节提取副本（new Function sloppy 模式 this=globalThis，root=self
  // 语义不变）。libraryDomain 的 new w.eg.InfiniteGrid 与 machineryRelayout 消费。
  if (!w.eg || !w.eg.InfiniteGrid) {
    try {
      fetch('/vendor/egjs-infinitegrid.umd.js')
        .then((r) => r.text())
        .then((txt) => {
          try {
            new Function(txt)();
            if (w.__eagleBundleGlobals) w.__eagleBundleGlobals.egLoaded = true;
          } catch (err) {
            console.error('[bundleGlobals] egjs UMD exec failed', err);
          }
        })
        .catch((err) => console.error('[bundleGlobals] egjs UMD fetch failed', err));
    } catch (err) { /* noop */ }
  }

  // c14：智能文件夹规则匹配族（bundle 8369-9418 顶层函数逐字节提取副本；区域内 require
  // → w.require 机械替换）。26 个 isMatch*Rule + intersect/hexToRGB/rgbToHex/
  // colorSimilarityDistance + cacheColorMappings 状态。classic script 注入（顶层函数声明
  // 落 window 的语义与 bundle 一致——new Function 内声明不落 window，故不可用）。
  if (!w.isMatchNameRule) {
    try {
      fetch('/vendor/eagle-match-rules.js')
        .then((r) => r.text())
        .then((txt) => {
          try {
            const script = document.createElement('script');
            script.textContent = txt;
            document.head.appendChild(script);
            script.remove();
            if (w.__eagleBundleGlobals) w.__eagleBundleGlobals.matchRulesLoaded = true;
          } catch (err) {
            console.error('[bundleGlobals] match-rules exec failed', err);
          }
        })
        .catch((err) => console.error('[bundleGlobals] match-rules fetch failed', err));
    } catch (err) { /* noop */ }
  }

  // c16b：hover-preview 子系统（bundle 50414-52048 顶层单元逐字节提取：cleanupBoxHoverPreview/
  // startHoverPreviewWatch/removePlayingAudios/removeBoxAudioPlayer/HoverPreview——文件内
  // 互引同 script 解析，$bodyScope/FileUrlHelper/$ 经 window 调用时解析）
  if (!w.HoverPreview) {
    try {
      fetch('/vendor/eagle-hover-preview.js')
        .then((r) => r.text())
        .then((txt) => {
          try {
            const script = document.createElement('script');
            script.textContent = txt;
            document.head.appendChild(script);
            script.remove();
            if (w.__eagleBundleGlobals) w.__eagleBundleGlobals.hoverPreviewLoaded = true;
          } catch (err) {
            console.error('[bundleGlobals] hover-preview exec failed', err);
          }
        })
        .catch((err) => console.error('[bundleGlobals] hover-preview fetch failed', err));
    } catch (err) { /* noop */ }
  }

  // c18a：缩放辅助（devicesMetrics 数据表 8245-8339 逐字节提取 + isMobileResolution/
  // getImagePixelDensity/isMobileWidth 移植（controller 闭包函数，非顶层）——machinerySmartZoom
  // 消费）。守卫必须查助手本身：devicesMetrics 是 bundle 顶层 var（天然上 window），
  // 拿它做守卫会永久短路注入，machinerySmartZoom 在 w.getImagePixelDensity 处 TypeError，
  // zoomer 的 updateNavigator/loadURL 链断裂 → 详情原图管线死（c18a-c18d 回归根因）。
  if (!w.getImagePixelDensity || !w.isMobileResolution || !w.isMobileWidth) {
    try {
      fetch('/vendor/eagle-zoom-helpers.js')
        .then((r) => r.text())
        .then((txt) => {
          try {
            const script = document.createElement('script');
            script.textContent = txt;
            document.head.appendChild(script);
            script.remove();
            if (w.__eagleBundleGlobals) w.__eagleBundleGlobals.zoomHelpersLoaded = true;
          } catch (err) {
            console.error('[bundleGlobals] zoom-helpers exec failed', err);
          }
        })
        .catch((err) => console.error('[bundleGlobals] zoom-helpers fetch failed', err));
    } catch (err) { /* noop */ }
  }

  // ── c10a-2 Tier 2：小函数批（全部逐字移植，if-absent）──
  // electron/ipcRenderer 链（bundle 19018-19028：var electron = require('electron')/
  // var ipcRenderer = electron.ipcRenderer；electron 为 node 内建模块可复现）
  if (!w.electron) {
    try { w.electron = req('electron'); } catch (err) { /* noop */ }
  }
  if (!w.ipcRenderer && w.electron) w.ipcRenderer = w.electron.ipcRenderer;
  // currentWindow/app（bundle 19020-19029：const remote = require('@electron/remote')/
  // const currentWindow = remote.getCurrentWindow()/const app = remote.app）
  if (!w.currentWindow || !w.app) {
    try {
      const remoteMod = req('@electron/remote');
      if (remoteMod) {
        if (!w.currentWindow) w.currentWindow = remoteMod.getCurrentWindow();
        if (!w.app) w.app = remoteMod.app;
      }
    } catch (err) { /* noop */ }
  }
  // VIDEO_TYPES_GLOBAL（bundle 2052：getHashID 依赖，与 VIDEO_TYPES 同格式表构建）
  if (!w.VIDEO_TYPES_GLOBAL && w.EagleConfig && w.EagleConfig.VIDEO_FORMATS) {
    const VIDEO_TYPES_GLOBAL: any = {}; w.EagleConfig.VIDEO_FORMATS.forEach(function (ext: string) { VIDEO_TYPES_GLOBAL[ext] = true; });
    w.VIDEO_TYPES_GLOBAL = VIDEO_TYPES_GLOBAL;
  }
  // pluginModule（bundle 19040：const pluginModule = require(`${appRoot}/app/js/plugin`)）
  if (!w.pluginModule && w.appRoot) {
    try { w.pluginModule = req(w.appRoot + '/app/js/plugin'); } catch (err) { /* noop */ }
  }
  // b1-9j：bundle 20207 的 $scope.pluginModule = pluginModule —— shim 世界数据面字段只经
  // coreState/proxy 可达；插件面板（PluginFamily）与详情查看分支（detailState 的 pluginExt）
  // 读 body.pluginModule 取不到 → 桥接同一实例
  if (w.pluginModule && !coreState.pluginModule) {
    coreState.pluginModule = w.pluginModule;
  }

  // ── b1-9q：openItemContextMenu 依赖的 bundle 顶层全局（原码 51042/49552/49777/985）──
  // playingAudiosElements（bundle 全局 let——cleanupBoxHoverPreview 归零写）
  if (!w.playingAudiosElements) w.playingAudiosElements = [];

  // cleanupBoxHoverPreview（bundle 50414-50457 逐字；hover 预览/音视频/iframe 清理）
  if (!w.cleanupBoxHoverPreview) {
    w.cleanupBoxHoverPreview = function ($box: any) {
      if (!$box || !$box.length || !$box.hasClass('hover-active')) return;
      $box.removeClass('hover-active');
      clearTimeout($box[0]._spinnerTimeout);

      var $thumbnail = $box.find('.thumbnail');
      var $image = $thumbnail.find('img');
      $image.show();

      // Video — pause 停渲染 → remove 脫離 DOM → 清 src 釋放資源
      $thumbnail.find('video').each(function (this: any) {
        try { this.pause(); } catch (e) {}
        w.$(this).remove();
        try { this.src = ''; this.load(); } catch (e) {}
      });

      // MPV
      $thumbnail.find('mpv-video').each(function (this: any) {
        try { this.destroy(); } catch (e) {}
      }).remove();

      // Audio
      $thumbnail.find('audio').each(function (this: any) {
        try { this.pause(); this.src = ''; } catch (e) {}
      }).remove();
      w.playingAudiosElements = [];

      // Iframe (YouTube/Vimeo)
      $thumbnail.find('.iframe-wrap').each(function (this: any) {
        try { w.$(this).find('iframe')[0].src = ''; } catch (e) {}
      }).remove();

      // 停用 iframe postMessage 狀態，避免 stale message handler 繼續更新已移除的 UI
      if (typeof w._vimeoPlayerState !== 'undefined') w._vimeoPlayerState.active = false;
      if (typeof w._ytPlayerState !== 'undefined') w._ytPlayerState.active = false;

      // UI
      $thumbnail.find('.video-loading-spinner').remove();
      $thumbnail.find('.video-progress-bar, .audio-progress-bar, .audio-progress-bar-cursor, .current-time, .controls').remove();
      $thumbnail.find('.mute-toggle').off().remove();
      $thumbnail.find('.autoplay-toggle').off();
      $image.off('mousedown.duration').off('mousemove.progressCursor');
      $thumbnail.find('.hover-sentinel').remove();
    };
  }

  // removePlayingAudios（bundle 51042-51045 逐字）
  if (!w.removePlayingAudios) {
    w.removePlayingAudios = function () {
      w.$('#box-container .box.hover-active').each(function (this: any) {
        w.cleanupBoxHoverPreview(w.$(this));
      });
    };
  }

  // openWithApplicationPath（bundle 49552-49565 逐字）
  if (!w.openWithApplicationPath) {
    w.openWithApplicationPath = function (appPath: any, filePath: any, image: any) {
      var vidx = filePath.indexOf('?v=');
      if (vidx > -1 && filePath) {
        filePath = filePath.slice(0, vidx);
      }
      const spawnSync = w.require('child_process').spawnSync;
      var params = ['-a', appPath, decodeURIComponent(filePath)];
      var cp = spawnSync('open', params, {
        timeout: 10000
      });
      if (cp && cp.error) {
        w.process.kill(cp.pid);
      }
      w.RecentFileManager.addFile(image);
    };
  }

  // ayncsImagesGeneratePalette（bundle 49777-49799 逐字；backgroundWindowID 判定与
  // ayncsImagesChange 同型）
  if (!w.ayncsImagesGeneratePalette) {
    w.ayncsImagesGeneratePalette = function (images: any) {
      if (!images || images.length === 0) return;
      setTimeout(() => {
        let total = images.length;
        let once = 300;
        let loopCount = total / once;
        let countOfSend = 0;

        function send() {
          var start = countOfSend * once;
          var willSendImages = images.slice(start, start + once);
          countOfSend += 1;
          if (w.backgroundWindowID === undefined) {
            w.__eagleIpc.send('regenerate-palette', willSendImages);
          }
          else {
            w.__eagleIpc.sendTo(w.backgroundWindowID, 'regenerate-palette', willSendImages);
          }
          loop();
        }

        function loop() {
          if (countOfSend < loopCount) {
            window.requestAnimationFrame(send);
          }
        }
        loop();
      }, 0);
    };
  }

  // ReverseImageSearch（bundle 985-1011 逐字：类 + eagle.reverseImageSearch 挂载）
  if (!w.ReverseImageSearch) {
    w.ReverseImageSearch = class ReverseImageSearch {
      #pluginId = 'eagle-plugin-search-by-image';

      static ENGINES = {
        GOOGLE: 'google',
        YANDEX: 'yandex',
        BING: 'bing',
        TINEYE: 'tineye',
        BAIDU: 'baidu',
        SOGOU: 'sogou',
        SAUCENAO: 'saucenao'
      };

      search(item: any, searchEngine: any = 'google') {
        if (!item) return;
        if (!w.pluginModule.checkPluginInstalled(this.#pluginId)) {
          w.pluginModule.showInstallPluginDialog(this.#pluginId);
          return;
        }
        w.pluginModule.openPluginById(this.#pluginId, { searchEngine: searchEngine });
      }
    };
    w.eagle.reverseImageSearch = new w.ReverseImageSearch();
  }

  if (!w.guid) w.guid = _guid;
  if (!w.throttle) w.throttle = _throttle;
  if (!w.debounce) w.debounce = _debounce;
  if (!w.fuzzy_match) w.fuzzy_match = _fuzzy_match;
  if (!w.decodeBase64Image) w.decodeBase64Image = _decodeBase64Image;
  if (!w.cloneTree) w.cloneTree = _cloneTree;
  if (!w.getHashID) w.getHashID = _getHashID;
  if (!w.hiddenByCurrentFilter) w.hiddenByCurrentFilter = _hiddenByCurrentFilter;
  if (!w.ayncsImagesChange) w.ayncsImagesChange = _ayncsImagesChange;
  if (!w.startAPIServer) w.startAPIServer = _startAPIServer;
  if (!w.stopAPIServer) w.stopAPIServer = _stopAPIServer;
  if (!w.checkBackgroundHeartbeat) w.checkBackgroundHeartbeat = _checkBackgroundHeartbeat;

  // b1-9a：基础设施 + 纯函数批挂载
  // electronLog（bundle 19035 remote.require('electron-log')——渲染层 require 同模块）
  if (!w.electronLog) { try { w.electronLog = req('electron-log'); } catch (err) { /* noop */ } }
  if (!w.getRawPath) w.getRawPath = _getRawPath;
  if (!w.getThumbnailPath) w.getThumbnailPath = _getThumbnailPath;
  if (!w.getExt) w.getExt = _getExt;
  if (!w.ayncsImagesRemove) w.ayncsImagesRemove = _ayncsImagesRemove;
  if (!w.updateWindowProgressBar) w.updateWindowProgressBar = _getUpdateWindowProgressBar();
  // fs（bundle 19015 const fs = require('fs')——TagManager 等裸 fs 消费）
  if (!w.fs) { try { w.fs = req('fs'); } catch (err) { /* noop */ } }
  // path（bundle 19013 var path = require('path')——eagleClasses 等裸 path 消费）
  if (!w.path) { try { w.path = req('path'); } catch (err) { /* noop */ } }
  // junk（bundle 8155/52671 junk.is——node 模块）。本仓 node_modules 无 junk 包，
  // req 结果非「.is 函数」形状时回落内联兼容 shim（语义取 junk 公开 ignore 列表，
  // basename 大小写不敏感；覆盖 walk/onDropContainer 的垃圾文件过滤）。
  if (!w.junk) { try { w.junk = req('junk'); } catch (err) { /* noop */ } }
  if (!w.junk || typeof w.junk.is !== 'function') {
    const junkIs = function (filename: any): boolean {
      const ignoreList = [
        'thumbs.db', 'ehthumbs.db', 'ehthumbs_vista.db',
        'desktop.ini', '$recycle.bin',
        '.ds_store', '.appledouble', '.lsoverride', 'icon\r', '._*', '.spotlight-v100', '.trashes', '__macosx',
        '.bash_history', '.bash_logout', '.bash_profile', '.bashrc', '.git', '.gitignore', '.gitattributes', '.svn', '.hg',
      ];
      const name = String(filename);
      const base = (name.replace(/\\/g, '/').split('/').pop() || '').toLowerCase();
      return ignoreList.some((n) => {
        const t = n.toLowerCase();
        if (t.endsWith('*')) return base.startsWith(t.slice(0, -1));
        return base === t;
      });
    };
    w.junk = { is: junkIs, not: function (filename: any) { return !junkIs(filename); } };
  }
  // IS_DIRECTORY（bundle 19025 require(appRoot + '/my_modules/is-directory')）
  if (!w.IS_DIRECTORY && w.appRoot) { try { w.IS_DIRECTORY = req(w.appRoot + '/my_modules/is-directory'); } catch (err) { /* noop */ } }
  // IS_HIDDEN_FILE（bundle 19023 同上；onDropContainer 的隐藏文件过滤消费）
  if (!w.IS_HIDDEN_FILE && w.appRoot) { try { w.IS_HIDDEN_FILE = req(w.appRoot + '/my_modules/is-hidden-file'); } catch (err) { /* noop */ } }
  // sortByAZ（bundle 2103-2108 逐字：win32 拖放排序；languageBCP 为 bundle 顶层 var，
  // 未供给时 `|| "en"` 回落与 bundle 未赋值态同语义）
  if (!w.sortByAZ) {
    w.sortByAZ = function (arr: any) {
      const collator = new Intl.Collator((window as any).languageBCP || "en", { numeric: true, sensitivity: 'base' });
      arr = arr.sort(function (a: any, b: any) {
        return collator.compare(a.name, b.name);
      });
    };
  }
  // EAGLE_THUMBNAIL_TEMP_PATH（bundle 19030-31：path.normalize(app.getPath('userData') + '/eagle-temp')）
  if (!w.EAGLE_THUMBNAIL_TEMP_PATH && w.app) {
    try {
      const pathMod = req('path');
      w.EAGLE_THUMBNAIL_TEMP_PATH = pathMod.normalize(w.app.getPath('userData') + '/eagle-temp');
    } catch (err) { /* noop */ }
  }
  // resourcesPath（bundle 19038-39：isDev → appRoot.path/build_files/；否则 process.resourcesPath）
  if (w.resourcesPath === undefined) {
    try {
      const pathMod = req('path');
      const isDev = !!(w.app && !w.app.isPackaged);
      w.resourcesPath = isDev
        ? pathMod.join((w.appRoot && w.appRoot.path) || '', '/build_files/')
        : pathMod.join((w.process && w.process.resourcesPath) || '');
    } catch (err) { /* noop */ }
  }
  // 状态初值（bundle 顶层 var 初值——undefined 类天然等价不挂；初值非 undefined 类补齐）
  if (!w.rectSelection) w.rectSelection = {};                    // 72561
  if (w.rectSelecting === undefined) w.rectSelecting = false;    // 72562
  if (w.dragging === undefined) w.dragging = false;              // 52406
  if (w.windowMouseX === undefined) w.windowMouseX = 0;          // 19068
  if (w.windowMouseY === undefined) w.windowMouseY = 0;
  if (w.heartbeatStopCount === undefined) w.heartbeatStopCount = 0; // 19071
  _installMouseTracker();

  // ── b1-9b：管理器批挂载 ──
  // preferences（bundle 105476：preferences = preferences || require(electron-settings).getPreferences() || {}）
  if (!w.preferences) {
    try {
      w.preferences = req((w.appRoot && (w.appRoot.path || w.appRoot)) + '/my_modules/electron-settings').getPreferences() || {};
    } catch (err) { w.preferences = {}; }
  }
  // QuickAccessManager（bundle 19061 {} + 46666-46753 controller init 挂方法——bundle 在世
  // 时沿用其绑定；b1 后本模块同序重建）
  if (!w.QuickAccessManager) {
    w.QuickAccessManager = {};
    _attachQuickAccessManager(w.QuickAccessManager);
  }
  if (!w.RecentFileManager) w.RecentFileManager = _buildRecentFileManager();
  if (!w.SlowNotify) w.SlowNotify = _buildSlowNotify();
  // ScrollbarSaver（bundle 19062 undefined var + controller init 46754 赋值）
  if (!w.ScrollbarSaver) w.ScrollbarSaver = _buildScrollbarSaver();
  // Registration（bundle 19208 逐字；activated 运行时更新走 bundle 22666 ipc 路径——post-b1
  // 由 libraryDomain 注册域接管时接线，登记）
  if (!w.Registration) w.Registration = { activated: false };
  // ga4track（bundle 105491-105496；vendor eagle-ga4mp.js 注入后初始化——注入失败时
  // telemetry 丢失（analytics 方法侧 w.ga4track 守卫），登记）
  if (!w.ga4track) {
    try {
      fetch('/vendor/eagle-ga4mp.js')
        .then((r) => r.text())
        .then((txt) => {
          try {
            const script = document.createElement('script');
            script.textContent = txt;
            document.head.appendChild(script);
            script.remove();
            if (w.ga4mp) {
              if (!w.localStorage["gaClientId"] || w.localStorage["gaClientId"] == 'undefined') {
                w.localStorage.setItem("gaClientId", w.guid());
              }
              const clientId = w.localStorage["gaClientId"];
              w.ga4track = w.ga4mp(["G-LZFKF8K4LB"], {
                user_id: clientId,
                non_personalized_ads: true,
                debug: false
              });
              w.ga4track.setUserProperty('language', w.preferences.general.language.replace("_", "-").toLowerCase());
              w.ga4track.setEventsParameter('app_version', `${w.analytics.appVersion}`);
              w.ga4track.setEventsParameter('app_name', `Eagle App`);
            }
          } catch (err) { console.error('[bundleGlobals] ga4mp exec failed', err); }
        })
        .catch((err) => console.error('[bundleGlobals] ga4mp fetch failed', err));
    } catch (err) { /* noop */ }
  }
  // analytics（bundle 105501 顶层对象——bundle 在世时沿用其绑定）
  if (!w.analytics) w.analytics = _buildAnalytics();

  // ── b1-9c：目录枚举批 + 字体初扫 ──
  if (!w.walk) w.walk = _walk;
  // installedFonts 初扫（bundle 19243 fs.access/readdir——getExt/junk 等已在前序挂载）
  if (!w.installedFonts) {
    w.installedFonts = {};
    _scanInstalledFonts();
  }

  // ── 原型扩展（bundle 2607-2608 / 2621-2703）：bundle 顶层的 Array/String.prototype 扩展，
  //    去 Angular 后随 bundle 死亡消失。React 消费面（dataMachinery getExtendTags 的
  //    tags.unique()、ContextMenu/FolderModals/PluginFamily 的 pinyin.score()）逐字保留了
  //    原调用，故此处 if-absent 补供给；bundle 在世时原型已存在，零调用零改变。
  //    Array.prototype.move（bundle 2610）未被 React 侧消费，不供给（诚实缺口）。
  if (typeof (Array.prototype as any).unique !== 'function') {
    // bundle 2607-2608 逐字（原文为 IIFE 包裹的同体函数）
    (Array.prototype as any).unique = function (this: any) { return [...new Set(this)]; };
  }
  if (typeof (String.prototype as any).score !== 'function') {
    // bundle 2621-2703 逐字（模糊匹配打分；自包含，无外部依赖）
(String.prototype as any).score = function (this: any, word: any, fuzziness: any) {
    'use strict';

    // If the string is equal to the word, perfect match.
    if (this === word) { return 1; }

    //if it's not a perfect match and is empty return 0
    if (word === "") { return 0; }

    var runningScore = 0,
        charScore,
        finalScore,
        string = this,
        lString = string.toLowerCase(),
        strLength = string.length,
        lWord = word.toLowerCase(),
        wordLength = word.length,
        idxOf,
        startAt = 0,
        fuzzies = 1,
        fuzzyFactor = 0, // 原文 var fuzzyFactor;（TS 严格模式不接受 undefined 参与 += ；
                         // 该分支仅在 fuzziness 真值时进入，运行时取值与原文一致）
        i;

    // Cache fuzzyFactor for speed increase
    if (fuzziness) { fuzzyFactor = 1 - fuzziness; }

    // Walk through word and add up scores.
    // Code duplication occurs to prevent checking fuzziness inside for loop
    if (fuzziness) {
        for (i = 0; i < wordLength; i += 1) {

            // Find next first case-insensitive match of a character.
            idxOf = lString.indexOf(lWord[i], startAt);

            if (idxOf === -1) {
                fuzzies += fuzzyFactor;
            } else {
                if (startAt === idxOf) {
                    // Consecutive letter & start-of-string Bonus
                    charScore = 0.7;
                } else {
                    charScore = 0.1;

                    // Acronym Bonus
                    // Weighing Logic: Typing the first character of an acronym is as if you
                    // preceded it with two perfect character matches.
                    if (string[idxOf - 1] === ' ') { charScore += 0.8; }
                }

                // Same case bonus.
                if (string[idxOf] === word[i]) { charScore += 0.1; }

                // Update scores and startAt position for next round of indexOf
                runningScore += charScore;
                startAt = idxOf + 1;
            }
        }
    } else {
        for (i = 0; i < wordLength; i += 1) {
            idxOf = lString.indexOf(lWord[i], startAt);
            if (-1 === idxOf) { return 0; }

            if (startAt === idxOf) {
                charScore = 0.7;
            } else {
                charScore = 0.1;
                if (string[idxOf - 1] === ' ') { charScore += 0.8; }
            }
            if (string[idxOf] === word[i]) { charScore += 0.1; }
            runningScore += charScore;
            startAt = idxOf + 1;
        }
    }

    // Reduce penalty for longer strings.
    finalScore = 0.5 * (runningScore / strLength + runningScore / wordLength) / fuzzies;

    if ((lWord[0] === lString[0]) && (finalScore < 0.85)) {
        finalScore += 0.15;
    }

    return finalScore;
};
  }

  // 诊断契约：冒烟断言全部关键全局在位（bundle 在世 = 沿用其绑定；b1 后 = 本模块供给）
  (window as any).__eagleBundleGlobals = {
    installed: true,
    present: ['appRoot', 'EagleConfig', 'VIDEO_TYPES', 'AUDIO_TYPES', 'FONT_TYPES', 'SPECIAL_TYPES',
      'fileSize', 'fse', 'tinyPinyin', 'pinyinlite', 'readChunk', 'writeFileAtomic', 'cartesianProduct',
      'sanitize', 'unicodeNormalize', 'chineseConvert', 'colorConvert', 'DeltaE', 'installedFonts',
      'fontFolder', 'FileUrlHelper',
      'guid', 'throttle', 'debounce', 'fuzzy_match', 'decodeBase64Image', 'cloneTree', 'getHashID',
      'hiddenByCurrentFilter', 'ayncsImagesChange', 'startAPIServer', 'stopAPIServer',
      'checkBackgroundHeartbeat', 'ipcRenderer', 'currentWindow', 'app', 'VIDEO_TYPES_GLOBAL',
      'pluginModule',
      'electronLog', 'getRawPath', 'getThumbnailPath', 'getExt', 'ayncsImagesRemove',
      'updateWindowProgressBar', 'junk', 'IS_DIRECTORY', 'IS_HIDDEN_FILE', 'sortByAZ',
      'EAGLE_THUMBNAIL_TEMP_PATH',
      'resourcesPath', 'rectSelection', 'windowMouseX',
      'preferences', 'QuickAccessManager', 'RecentFileManager', 'SlowNotify', 'Registration',
      'analytics', 'ScrollbarSaver'].filter((n) => w[n] !== undefined),
    eagleMembers: ['inspector', 'filter', 'duplicateChecker', 'reverseImageSearch', 'aiSearch',
      'customExport', 'combineImages', 'action', 'plugin', 'app', 'containerSize', 'utils']
      .filter((n) => w.eagle && w.eagle[n] !== undefined),
  };
}
