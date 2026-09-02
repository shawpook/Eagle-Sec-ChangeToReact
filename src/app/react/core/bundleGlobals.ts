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

  // ── installedFonts（bundle 19243：var installedFonts = {}）──
  if (!w.installedFonts) w.installedFonts = {};

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
      'pluginModule'].filter((n) => w[n] !== undefined),
    eagleMembers: ['inspector', 'filter', 'duplicateChecker', 'reverseImageSearch', 'aiSearch',
      'customExport', 'combineImages', 'action', 'plugin', 'app', 'containerSize', 'utils']
      .filter((n) => w.eagle && w.eagle[n] !== undefined),
  };
}
