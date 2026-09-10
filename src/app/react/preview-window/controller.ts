import { FileUrlHelper } from '../core/fileUrlHelper';
import { detailZoom, ensureDetailZoom } from '../core/smoothZoomEngine';
/**
 * 预览大窗控制器——preview-window.js（PreviewWindowController）无 Angular 移植。
 *
 * 阶段9a-1：本模块取代 Angular 控制器成为唯一数据面。controllerScope 是普通对象，字段与
 * 原 $scope 同名同形（current/images/pluginModule/imageSize/gifViewer/isGrayscaleMode/
 * isHideNavigator/useMpvPlayer/...），方法保留原函数名与原语义（selectNext/selectPrev/
 * zoom/smartZoom/updateZoomRatio/openWithDefault/openWithFinder/copyAsPath/copyImage/
 * startDrag/getRawUrl/getRawPath/...），使 preview-window.js 的调用点零改动。
 *
 * 订阅模型：applyController(fn) = fn(controllerScope) + notify（ng-click 的 $apply 等价）；
 * 异步回调（ipc/定时器/Promise）内改字段后调 notifyController()（$evalAsync 等价）。
 * 另有 $evalAsync/$apply/$watch/$on 门面，兼容阶段5 detailHooks（useMediaElement/
 * useMpvMediaElement）对 window.$bodyScope 的既有调用。
 *
 * 测试契约（preview-delivery-closed-loop 的 --smoke-preview-delivery 驱动）：
 *   window.__eaglePreviewController = controllerScope（driver 的 $bodyScope 机械替换目标）
 *   window.$bodyScope = controllerScope（gif-viewer iframe 与 detailHooks 的既有通道）
 *
 * 数据面通道零改动：ipcRenderer（'get.viewer.image'/'ondragstart'/'open-with-default'/
 * 'show-item-in-folder'/'copy-images'/'screencapture-from-extension'/'reveal-in-eagle'/
 * 'activate-font'/'deactivate-font'/'regenerate-thumbnail'/'regenerate-gif-thumbnail'）、
 * electron-settings、localStorage（eagle.viewer.lastZoomMode/isHideNavigator_Viewer/
 * eagle.videoPlayer.volume）、window.ShortcutManager、Mousetrap。
 */

const req = (name: string): any => (window as any).require?.(name);

/* ================= 模块级依赖（preview-window.js 1-39 逐字） ================= */

const path = req('path');
const fs = req('fs');
const electron = req('electron');
const remote = req('@electron/remote');
const Menu = remote ? remote.Menu : undefined;
const MenuItem = remote ? remote.MenuItem : undefined;
const ipcRenderer = (electron && electron.ipcRenderer) || (req('electron') ? req('electron').ipcRenderer : null);
const currentWindow = remote ? remote.getCurrentWindow() : null;
const electronSettings = req(String(req('app-root-path')) + '/my_modules/electron-settings');
const USER_DATA_PATH = (req('@electron/remote') && req('@electron/remote').app && req('@electron/remote').app.getPath('userData')) || '';
const EAGLE_THUMBNAIL_TEMP_PATH = path.normalize(USER_DATA_PATH + '/eagle-temp');

let fontFolder: string;
if (process.platform === 'darwin') {
  fontFolder = `${req('@electron/remote')?.app?.getPath?.('home') || ''}/library/Fonts/EagleApp/`;
} else {
  fontFolder = `${process.env.SYSTEMROOT}/Fonts/`;
}

// MPV Player（旧 preview-window.js 27-31 逐字；npm 模块在 real-electron 下加载，浏览器预览静默失败）
try {
  const { MpvVideoElement, defaultPlugins, ABLoopPlugin } = req('mpv-video-player') || {};
  const EagleNotePlugin = req(String(req('app-root-path')) + '/app/js/plugins/eagle-note-plugin');
  if (MpvVideoElement && defaultPlugins) {
    defaultPlugins.forEach((plugin: any) => MpvVideoElement.use(plugin));
    MpvVideoElement.use(ABLoopPlugin);
    MpvVideoElement.use(EagleNotePlugin);
  }
} catch (err) {
  console.warn('[eagle-preview] mpv-video-player unavailable', err);
}

const VIDEO_TYPES: Record<string, boolean> = {};
((window as any).EagleConfig?.VIDEO_FORMATS || []).forEach((ext: string) => {
  VIDEO_TYPES[ext] = true;
});
const AUDIO_TYPES: Record<string, boolean> = {};
((window as any).EagleConfig?.AUDIO_FORMATS || []).forEach((ext: string) => {
  AUDIO_TYPES[ext] = true;
});
const MODEL_TYPES: Record<string, boolean> = {};
((window as any).EagleConfig?.MODEL_FORMATS || []).forEach((ext: string) => {
  MODEL_TYPES[ext] = true;
});
const FONT_TYPES: Record<string, boolean> = {};
((window as any).EagleConfig?.FONT_FORMATS || []).forEach((ext: string) => {
  FONT_TYPES[ext] = true;
});
const URL_TYPES: Record<string, boolean> = {};
((window as any).EagleConfig?.URL_FORMATS || []).forEach((ext: string) => {
  URL_TYPES[ext] = true;
});

/* ================= videojs SeekBar 覆写（41-79 逐字） ================= */

(function initVideoJsOverrides() {
  const videojs = (window as any).videojs;
  if (!videojs || !videojs.getComponent) return;
  const SeekBar = videojs.getComponent('SeekBar');
  if (!SeekBar) return;
  SeekBar.prototype.getPercent = function getPercent(this: any) {
    const time = this.player_.currentTime();
    const percent = time / this.player_.duration();
    return percent >= 1 ? 1 : percent;
  };

  SeekBar.prototype.handleMouseMove = function handleMouseMove(this: any, event: any) {
    const that = this;
    const player = this.player_;
    let newTime = this.calculateDistance(event) * this.player_.duration();
    if (newTime === this.player_.duration()) {
      newTime = newTime - 0.1;
    }
    if (player.children_[0]) {
      player.children_[0].currentTime = newTime;
    }
    player.currentTime(newTime);
    that.update();
    this.handleMouseUp(event);
  };
})();

/* ================= 拖放阻断（81-89 逐字） ================= */

document.addEventListener(
  'dragover',
  function (event: any) {
    event.preventDefault();
    return false;
  },
  false
);

document.addEventListener(
  'drop',
  function (event: any) {
    event.preventDefault();
    return false;
  },
  false
);

function gup(name: string, url?: string) {
  if (!url) url = window.location.href;
  name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
  const regexS = '[\\?&]' + name + '=([^&#]*)';
  const regex = new RegExp(regexS);
  const results = regex.exec(url);
  return results == null ? null : results[1];
}

/* ================= 订阅存储（digest 等价） ================= */

let version = 0;
const listeners = new Set<() => void>();

export function subscribeController(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getControllerVersion(): number {
  return version;
}

let notifying = false;
function notify(): void {
  if (notifying) return; // digest 期重入折叠（$phase 语义）
  notifying = true;
  try {
    version++;
    listeners.forEach((l) => {
      try {
        l();
      } catch (err) {
        console.error('[eagle-preview-controller] listener error', err);
      }
    });
    runWatchers();
  } finally {
    notifying = false;
  }
}

/** ng-click 的 $apply 等价：执行变更后统一 notify。 */
export function applyController(fn?: (s: any) => void): void {
  try {
    if (fn) fn(controllerScope);
  } catch (err) {
    console.error('[eagle-preview-controller]', err);
  }
  notify();
}

/** $evalAsync 等价（异步回调边界）。 */
export function notifyController(): void {
  notify();
}

/* ================= i18n 通道（preview-window.html 内联 script 的 window.i18n） ================= */

export const pvT = (key: string, pairs?: any[]): string => {
  try {
    const i18nInst = (window as any).i18n;
    if (!i18nInst || typeof i18nInst.__ !== 'function') return key;
    let out = i18nInst.__(key);
    if (pairs) {
      pairs.forEach((pair: any) => {
        out = String(out).replace('{' + pair.property + '}', pair.value);
      });
    }
    return out;
  } catch (err) {
    return key;
  }
};

/* ================= controllerScope ================= */

const scope: any = {
  /* ---- 构造期静态字段（417-453 + 1577-1593 逐字） ---- */
  VIDEO_TYPES,
  AUDIO_TYPES,
  MODEL_TYPES,
  FONT_TYPES,
  URL_TYPES,
  imageId: gup('id', window.location.href),
  platform: process.platform,
  isMaximize: false,
  isDetailMode: true,
  isGrayscaleMode: false,
  theme: 'gray',
  MAX_DIMENSION: 120000000,
  language: 'en',
  preferences: null,
  imageSize: {
    modified: false,
    zoomRatio: 100,
  },
  isHideNavigator: true,
  lastZoomMode: 'fit',
  zoomFitSize: 0,
  showDetailImage: false,
  showCopyToast: false,
  usingGifPlayer: false,
  useMpvPlayer: undefined,
  images: [],
  current: undefined,
  metas: '',
  imagesDir: undefined,
  libraryImagesPath: undefined,
  pluginModule: undefined,
  gifPlayer: undefined,
  isGifReady: false,
  mousetrap: {},
};

/* ---- $watch/$on/$evalAsync/$apply 门面（兼容 detailHooks 既有调用） ---- */

const watchers: Array<{ get: () => any; fn: (n: any, o: any) => void; last: any }> = [];

function runWatchers(): void {
  for (const w of watchers) {
    let next: any;
    try {
      next = w.get();
    } catch (err) {
      continue;
    }
    if (next !== w.last) {
      const prev = w.last;
      w.last = next;
      try {
        w.fn(next, prev);
      } catch (err) {
        console.error('[eagle-preview-controller] watcher error', err);
      }
    }
  }
}

scope.$root = scope;
scope.$$phase = false;
scope.$watch = (expr: string, fn: (n: any, o: any) => void) => {
  const get =
    expr === 'theme'
      ? () => scope.theme
      : expr === 'current.id'
        ? () => (scope.current ? scope.current.id : undefined)
        : () => undefined;
  const w = { get, fn, last: get() };
  watchers.push(w);
  return () => {
    const i = watchers.indexOf(w);
    if (i > -1) watchers.splice(i, 1);
  };
};
scope.$on = () => () => {};
scope.$evalAsync = (fn?: (s: any) => void) => {
  try {
    if (fn) fn(scope);
  } catch (err) {
    console.error('[eagle-preview-controller] $evalAsync', err);
  }
  notify();
};
scope.$apply = (fn?: (s: any) => void) => {
  try {
    if (fn) fn(scope);
  } catch (err) {
    console.error('[eagle-preview-controller] $apply', err);
  }
  notify();
};

/* ---- cgNotify 等价层（angular-notify.min.js 逐字语义，无 Angular 版；9a-2） ----
 * 模板：.cg-notify-message[.cg-notify-message-center] > (隐藏的 message div) +
 * .cg-notify-message-template（messageTemplate 编译目标）+ .cg-notify-close 按钮。
 * 堆叠：startTop=10 / verticalSpacing=15 / 关闭中 +20px；center 在 append 后按
 * offsetWidth/2 取负 margin-left；opacity transitionend 即移除并重排。
 * CSS 由 preview-window.html 保留的 angular-notify.min.css 提供。
 */

const NOTIFY_START_TOP = 10;
const NOTIFY_VERTICAL_SPACING = 15;
const notifyMessages: HTMLElement[] = [];

function notifyRestack(): void {
  let nextTop = NOTIFY_START_TOP;
  for (let i = notifyMessages.length - 1; i >= 0; i--) {
    const el = notifyMessages[i];
    const h = el.offsetHeight;
    let top = nextTop + h + 10;
    if (el.getAttribute('data-closing')) {
      top += 20;
    } else {
      nextTop += h + NOTIFY_VERTICAL_SPACING;
    }
    el.style.top = `${top}px`;
    el.style.marginTop = `-${h + 10}px`;
    el.style.visibility = 'visible';
  }
}

function notifyRemove(el: HTMLElement): void {
  const i = notifyMessages.indexOf(el);
  if (i > -1) notifyMessages.splice(i, 1);
  el.remove();
  notifyRestack();
}

function notifyClose(el: HTMLElement): void {
  el.style.opacity = '0';
  el.setAttribute('data-closing', 'true');
  notifyRestack();
}

export function notifyCloseAll(): void {
  for (const el of notifyMessages) {
    el.style.opacity = '0';
  }
}

function notifyShow(options: { duration?: number; messageTemplate: string; position?: string }): void {
  const duration = options.duration || 10000;
  const position = options.position || 'center';

  const el = document.createElement('div');
  el.className = `cg-notify-message${position === 'center' ? ' cg-notify-message-center' : ''}`;

  const messageDiv = document.createElement('div');
  messageDiv.style.display = 'none';
  el.appendChild(messageDiv);

  const templateDiv = document.createElement('div');
  templateDiv.className = 'cg-notify-message-template';
  templateDiv.innerHTML = options.messageTemplate;
  el.appendChild(templateDiv);

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'cg-notify-close';
  closeBtn.innerHTML = '<span aria-hidden="true">×</span><span class="cg-notify-sr-only">Close</span>';
  closeBtn.addEventListener('click', () => notifyClose(el));
  el.appendChild(closeBtn);

  // 原 messageTemplate 的 undo 链接 <a ng-click="closeAll();undo();">（$compile 于 $rootScope 子 scope）
  const undoLink = templateDiv.querySelector('a');
  if (undoLink) {
    undoLink.addEventListener('click', function () {
      scope.closeAll();
      scope.undo();
    });
  }

  // 原 webkitTransitionEnd 判定：opacity 属性过渡结束即移除
  el.addEventListener('transitionend', (a: any) => {
    if (a.propertyName === 'opacity' || el.style.opacity === '0') {
      notifyRemove(el);
    }
  });

  document.body.appendChild(el);
  notifyMessages.push(el);

  setTimeout(function () {
    if (position === 'center') {
      el.style.marginLeft = `-${el.offsetWidth / 2}px`;
    }
  }, 0);
  setTimeout(function () {
    notifyRestack();
  }, 0);
  if (duration > 0) {
    setTimeout(function () {
      notifyClose(el);
    }, duration);
  }
}

/* ---- $rootScope 等价（undo/closeAll/notify——preview-window.js 449-484 逐字） ---- */

scope.undo = function () {};
scope.closeAll = function () {
  notifyCloseAll();
};
scope.notify = function (params: any, restoreCallbackk?: any) {
  if (!params || !params.message) return;

  let messageTemplate = '<span>' + params.message;

  if (restoreCallbackk) {
    messageTemplate = messageTemplate + ' <a>' + pvT('notify.button.undo') + '</a></span>';
  } else {
    messageTemplate = messageTemplate + '</span>';
  }

  notifyCloseAll();

  setTimeout(function () {
    notifyShow({
      duration: params.duration || 4000,
      messageTemplate: messageTemplate,
      position: 'center',
    });
    if (restoreCallbackk) {
      scope.undo = restoreCallbackk;
    } else {
      scope.undo = function () {};
    }
  }, 100);
};

/* ---- 路径/URL 工具（487-553 逐字） ---- */

scope.getRawPath = function (image: any) {
  if (!image || !scope.imagesDir) return;
  return (window as any).getRawPath(scope.imagesDir, image);
};

scope.getExifRawPath = function () {
  if (scope.current) {
    return `./exif-viewer/index.html?orientation=${scope.current.orientation}&path=${encodeURIComponent(
      scope.getRawPath(scope.current)
    )}&width=${scope.current.width}&height=${scope.current.height}&zoom=${scope.preferences?.habits?.renderBehavior}`;
  }
};

scope.getRawUrl = function (image: any) {
  if (!scope.imagesDir || !image) return;
  return FileUrlHelper.getRawUrl(image);
};

scope.getThumbnailUrl = function (image: any) {
  if (!scope.imagesDir || !image) return;
  return FileUrlHelper.getThumbnailUrl(image);
};

scope.getThumbnailPath = function (image: any) {
  return (window as any).getThumbnailPath(scope.imagesDir, image);
};

scope.getRatioExp = function (ratio: number) {
  if (ratio > 100) {
    ratio = 100 + (ratio - 100) * 7;
  }
  return parseInt(String(ratio));
};

scope.getRatioNonExp = function (ratio: number) {
  if (ratio > 100) {
    ratio = (ratio - 100) / 7 + 100;
  }
  return ratio;
};

/* ---- 查看器路径（1060-1132 逐字） ---- */

scope.getModelPath = function () {
  if (scope.current) {
    let rawUrl = FileUrlHelper.getRawUrl(scope.current);
    rawUrl = rawUrl.replaceAll(',', '%2C');
    const type = scope.current.ext;
    return `model-viewer/website/index.html#model=${rawUrl}`;
  }
};

scope.getPDFPath = function () {
  if (scope.current) {
    const pdfPath = FileUrlHelper.getRawUrl(scope.current);
    const locale = (scope.preferences?.general?.language || 'en').replace('_', '-');
    return `pdf-viewer/web/viewer.html?path=${encodeURIComponent(pdfPath)}&locale=${locale}&theme=${scope.theme}`;
  }
};

scope.getGIFPath = function () {
  if (scope.current) {
    const gifPath = FileUrlHelper.getRawPath(scope.current);
    const gifUrl = FileUrlHelper.getRawUrl(scope.current);
    const renderBehavior = scope.preferences?.habits?.renderBehavior;
    return (
      'gif-viewer/index.html?path=' +
      encodeURIComponent(gifPath) +
      '&url=' +
      encodeURIComponent(gifUrl) +
      '&name=' +
      encodeURIComponent(scope.current.name + '.gif') +
      `&render=${renderBehavior}`
    );
  }
};

scope.getNativeViewerPath = function () {
  if (scope.current) {
    const filePath = scope.imagesDir + scope.current.id + '.info/';
    return (
      'native-viewer/index.html?path=' +
      encodeURIComponent(filePath) +
      '&name=' +
      encodeURIComponent(scope.current.name + '.' + scope.current.ext) +
      '&ext=' +
      scope.current.ext +
      '&width=' +
      scope.current.width +
      '&height=' +
      scope.current.height +
      '&id=' +
      scope.current.id
    );
  }
};

scope.getRawViewerPath = function () {
  if (scope.current) {
    const image = scope.current;
    const rawPath = scope.imagesDir + scope.current.id + '.info/';
    return (
      './raw-viewer/index.html?orientation=' +
      image.orientation +
      '&path=' +
      encodeURIComponent(rawPath) +
      '&name=' +
      encodeURIComponent(image.name) +
      '&ext=' +
      image.ext +
      '&width=' +
      image.width +
      '&height=' +
      image.height
    );
  }
};

scope.getFontPath = function () {
  if (scope.current) {
    return `./font-viewer/font-viewer.html?id=${scope.current.id}`;
  }
};

scope.getTxtPath = function () {
  if (scope.current) {
    return `./text-editor/text-editor.html?id=${scope.current.id}&theme=${scope.theme}&language=${scope.preferences?.general?.language}`;
  }
};

scope.getURLSrc = function () {
  const item = scope.current;
  if (item.ext === 'url') {
    let embed;
    if (item.medium === 'youtube') {
      embed = `https://www.youtube-nocookie.com/embed/${item.videoID}?autoplay=1&vq=hq1080`;
    } else if (item.medium === 'vimeo') {
      embed = `https://player.vimeo.com/video/${item.videoID}?autoplay=1`;
    } else {
      embed = item.url;
    }
    return embed;
  } else {
    return FileUrlHelper.getRawUrl(scope.current);
  }
};

/* ---- 字体（1134-1159 逐字） ---- */

scope.isFontActivate = function (item: any) {
  const key = Object.keys(item.fontMetas.postScriptName)[0];
  const postScriptName = item.fontMetas.postScriptName && item.fontMetas.postScriptName[key];
  const outPath = `${fontFolder}/${postScriptName}.${item.ext}`;
  return fs.existsSync(outPath);
};

scope.activateFont = function (font: any, _options: any) {
  ipcRenderer.send('activate-font', font);
  scope.notify({
    message: pvT('notify.font.activate', [{ property: 'name', value: font.name }]),
    duration: 1000,
  });
};

scope.deactivateFont = function (font: any, _options: any) {
  ipcRenderer.send('deactivate-font', font);
  scope.notify({
    message: pvT('notify.font.deactivate', [{ property: 'name', value: font.name }]),
    duration: 1000,
  });
};

/* ---- 元数据/索引（1161-1182 逐字） ---- */

scope.getMetas = function (current: any) {
  if (!current) return;
  let metas = '';
  if (current && current.fontMetas && current.fontMetas.weight) {
    metas = `${current.name}.${current.ext}`;
  } else if (current && current.ext === 'txt') {
    metas = `${current.name}.${current.ext}`;
  } else if (current && current.ext === 'url') {
    metas = `${current.name} - ${current.url}`;
  } else {
    metas = `${current.name}.${current.ext} (${current.width}×${current.height})`;
  }
  return metas;
};

scope.currentIndex = function () {
  if (!scope.images) return undefined;
  return scope.images.indexOf(scope.current) + 1;
};

/* ---- 缩放体系（1184-1218、1557-1593、1595-1678、1807-1903 逐字） ---- */

let updateZoomRatioTimeout: any;
scope.updateZoomRatio = function (ratio: number, x: any, y: any, hasTransition?: boolean) {
  scope.imageSize.modified = true;

  let pageX: any, pageY: any;

  if (ratio) {
    scope.imageSize.zoomRatio = parseInt(String(ratio));
  }

  if ((window as any).$.isNumeric(x) && (window as any).$.isNumeric(y)) {
    pageX = x;
    pageY = y;
  } else {
    pageX = (window as any).$(window).width() / 2;
    pageY = (window as any).$(window).height() / 2;
  }

  if (hasTransition) {
    clearTimeout(updateZoomRatioTimeout);
    (window as any).$('#detail-container').addClass('zooming');
    updateZoomRatioTimeout = setTimeout(function () {
      (window as any).$('#detail-container').removeClass('zooming');
    }, 300);
  }

  detailZoom()?.focusTo( {
    zoom: scope.imageSize.zoomRatio,
    pageX: pageX,
    pageY: pageY,
    speed: 0,
  });
};

scope.openRatioContextMenu = function () {
  const contextMenu = new Menu();
  const ratioItem = (label: string, value: number) =>
    new MenuItem({
      label,
      type: 'checkbox',
      checked: parseInt(String(scope.imageSize.zoomRatio)) === value,
      click: function () {
        scope.updateZoomRatio(value, undefined, undefined, true);
        notifyController();
      },
    });
  contextMenu.append(ratioItem('5%', 5));
  contextMenu.append(ratioItem('10%', 10));
  contextMenu.append(ratioItem('25%', 25));
  contextMenu.append(ratioItem('50%', 50));
  contextMenu.append(ratioItem('100%', 100));
  contextMenu.append(ratioItem('125%', 125));
  contextMenu.append(ratioItem('150%', 150));
  contextMenu.append(ratioItem('200%', 200));
  contextMenu.append(ratioItem('300%', 300));
  contextMenu.append(ratioItem('400%', 400));
  contextMenu.append(ratioItem('800%', 800));
  contextMenu.append(new MenuItem({ type: 'separator' }));
  contextMenu.append(
    new MenuItem({
      label: pvT('context.zoom.zoomActural'),
      accelerator: scope.preferences?.shortcuts?.keybinds?.['view.zoom.actual'],
      click: function () {
        scope.zoomActual();
      },
    })
  );
  contextMenu.append(
    new MenuItem({
      label: pvT('context.zoom.zoomFit'),
      accelerator: scope.preferences?.shortcuts?.keybinds?.['view.zoom.fit'],
      click: function () {
        scope.zoomFit();
      },
    })
  );

  setTimeout(function () {
    contextMenu.popup(currentWindow);
  }, 50);
};

scope.nextFrameHandler = (window as any).throttle
  ? (window as any).throttle(
      function (event: any) {
        event && event.preventDefault();
        let amount = 1;
        if (event.shiftKey) amount = 10;
        if (scope.isDetailMode) {
          if (scope.current.ext === 'gif') {
            scope.nextGifFrame(amount);
          }
        }
      },
      100,
      true
    )
  : function () {};

scope.prevFrameHandler = (window as any).throttle
  ? (window as any).throttle(
      function (event: any) {
        event && event.preventDefault();
        let amount = 1;
        if (event.shiftKey) amount = 10;
        if (scope.isDetailMode) {
          if (scope.current.ext === 'gif') {
            scope.prevGifFrame(amount);
          }
        }
      },
      100,
      true
    )
  : function () {};

let copyImageTimeout: any;
scope.videoScreenShot = function (copyMode?: boolean) {
  if (scope.current) {
    const video = (window as any).$('.detail-wrap video')[0];
    const currentTime = video.currentTime;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    const width = scope.current.width;
    const height = scope.current.height;

    canvas.width = width;
    canvas.height = height;

    video.setAttribute('crossOrigin', 'Anonymous');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const base64 = canvas.toDataURL('image/jpeg', 0.95);

    if (copyMode) {
      try {
        scope.showCopyToast = true;
        clearTimeout(copyImageTimeout);
        copyImageTimeout = setTimeout(function () {
          scope.showCopyToast = false;
          notifyController();
        }, 1000);
        const nativeImage = electron.nativeImage;
        const newImage = nativeImage.createFromDataURL(base64);
        remote.clipboard.writeImage(newImage);
        notifyController();
      } catch (err: any) {
        (window as any).electronLog && (window as any).electronLog.error(err.stack || err);
      }
    } else {
      const data = {
        id: (window as any).guid(),
        name: `${scope.current.name} - ${currentTime}`,
        url: scope.current.url || '',
        tags: [],
        modificationTime: Date.now(),
        base64data: base64,
      };
      ipcRenderer.send('screencapture-from-extension', data);
    }
  }
};

scope.saveVideoFrame = function () {
  scope.videoScreenShot();
};

scope.copeVideoFrame = function () {
  scope.videoScreenShot(true);
};

scope.mHandler = function () {
  (window as any).$('.vjs-mute-control').click();
};

scope.flipHandler = function ($event: any) {
  $event && $event.preventDefault && $event.preventDefault();
  if (scope.current && (VIDEO_TYPES[scope.current.ext] || AUDIO_TYPES[scope.current.ext])) {
    scope.flipVideo($event, scope.current);
  } else {
    scope.flipImage($event, scope.current, true);
  }
};

scope.rotateHandler = function ($event: any) {
  $event && $event.preventDefault && $event.preventDefault();
  if (scope.current && (VIDEO_TYPES[scope.current.ext] || AUDIO_TYPES[scope.current.ext])) {
    scope.rotateVideo($event, scope.current);
  } else {
    scope.rotateImage($event, scope.current, true);
  }
};

scope.rotateVideo = function (event: any) {
  const video = (window as any).$('.detail-wrap video')[0];
  if (video) {
    const $video = (window as any).$(video);
    let degree = $video.data('degree') || 0;
    if (event.type === 'click') {
      if (!event.shiftKey) {
        degree = degree - 90;
      } else {
        degree = degree + 90;
      }
    } else {
      degree = degree - 90;
    }

    degree = degree % 360;
    if (degree < 0) {
      degree += 360;
    }

    $video.data('degree', degree);
    $video.removeClass('r90 r180 r270');
    $video.addClass(`r${degree}`);
  }
};

scope.rotateImage = function (event: any, image: any, writeToFile = false) {
  const rotatedImage = image;
  if (!rotatedImage) return;
  const [originalWidth, originalHeight] = [rotatedImage.width, rotatedImage.height];
  [rotatedImage.width, rotatedImage.height] = [originalHeight, originalWidth];

  let degree = (window as any).$('#detail-image').data('degree') || 0;
  let rotationDegree;

  if (event.type === 'click') {
    if (!event.shiftKey) {
      degree = degree - 90;
      rotationDegree = -90;
      detailZoom()?.rotate( { angle: -90, item: rotatedImage });
    } else {
      degree = degree + 90;
      rotationDegree = 90;
      detailZoom()?.rotate( { angle: 90, item: rotatedImage });
    }
  } else {
    degree = degree - 90;
    rotationDegree = -90;
    detailZoom()?.rotate( { angle: -90, item: rotatedImage });
  }

  (window as any).$('#detail-image').data('degree', degree);
  (window as any).$('#detail-image').css({
    transform: `rotate(${degree}deg) scaleX(1) scaleY(1)`,
    transition: 'transform 100ms ease-in-out',
  });

  const shouldWriteToFile = writeToFile && scope.preferences?.habits?.imageRotateMode === 'write';
  if (shouldWriteToFile && rotatedImage) {
    const rawPath = FileUrlHelper.getRawPath(rotatedImage);
    if (!rawPath) {
      console.warn('Cannot get raw path for image:', rotatedImage);
      return;
    }
    try {
      const rotateImageUtil = req(String(req('app-root-path')) + '/app/js/utils/rotateImage.js');
      rotateImageUtil(rawPath, rotationDegree)
        .then((result: any) => {
          console.log(`Image rotated (${rotationDegree}°) and saved: ${rawPath}`);
          if (result && result.width && result.height) {
            rotatedImage.width = result.width;
            rotatedImage.height = result.height;
          }
          delete rotatedImage.orientation;
          ipcRenderer.send('regenerate-thumbnail', [rotatedImage]);
        })
        .catch((err: any) => {
          console.error(`Failed to save rotated image: ${err.message}`);
          rotatedImage.width = originalWidth;
          rotatedImage.height = originalHeight;
        });
    } catch (requireErr: any) {
      console.error(`Failed to load rotateImage module: ${requireErr.message}`);
      rotatedImage.width = originalWidth;
      rotatedImage.height = originalHeight;
    }
  }
};

scope.flipImage = function (event: any, image: any, writeToFile = false) {
  if (scope.isCropMode) return;
  const rotatedImage = image || (scope.selected && scope.selected[0]);
  if (!rotatedImage) return;

  let scaleX = 1,
    scaleY = 1;
  if (event.type === 'click') {
    if (!event.shiftKey) {
      scaleX = -1;
    } else {
      scaleY = -1;
    }
  } else {
    scaleX = -1;
  }

  detailZoom()?.flip( scaleX, scaleY);

  const shouldWriteToFile = writeToFile && scope.preferences?.habits?.imageRotateMode === 'write';
  if (shouldWriteToFile && rotatedImage) {
    let flipType: any;
    if (scaleX === -1 && scaleY === -1) {
      flipType = 'both';
    } else if (scaleX === -1) {
      flipType = 'horizontal';
    } else if (scaleY === -1) {
      flipType = 'vertical';
    }

    const rawPath = FileUrlHelper.getRawPath(rotatedImage);
    if (!rawPath) {
      console.warn('Cannot get raw path for image:', rotatedImage);
      return;
    }

    try {
      const flipImageUtil = req(String(req('app-root-path')) + '/app/js/utils/flipImage.js');
      flipImageUtil(rawPath, flipType)
        .then(() => {
          console.log(`Image flipped (${flipType}) and saved: ${rawPath}`);
          ipcRenderer.send('regenerate-thumbnail', [rotatedImage]);
        })
        .catch((err: any) => {
          console.error(`Failed to save flipped image: ${err.message}`);
        });
    } catch (requireErr: any) {
      console.error(`Failed to load flipImage module: ${requireErr.message}`);
    }
  }
};

scope.flipVideo = function (event: any) {
  const video = (window as any).$('.detail-wrap video')[0];
  if (video) {
    const $video = (window as any).$(video);
    let flip = $video.data('flip') || 1;
    flip = flip * -1;
    if (flip === 1) {
      $video.removeClass('flip');
    } else {
      $video.addClass('flip');
    }
    $video.data('flip', flip);
  }
};

scope.zoomActual = function (event?: any) {
  event && event.preventDefault && event.preventDefault();
  scope.imageSize.zoomRatio = 100;
  scope.updateZoomRatio(100, undefined, undefined, true);
};

scope.zoomFit = function (event?: any) {
  event && event.preventDefault && event.preventDefault();
  scope.imageSize.zoomRatio = 100;
  scope.zoomFitSize = 0;

  (window as any).$('#detail-container').addClass('zooming');
  setTimeout(function () {
    (window as any).$('#detail-container').removeClass('zooming');
  }, 300);

  scope.smartZoom();
  scope.imageSize.modified = false;
};

if (localStorage.getItem('isHideNavigator_Viewer') === 'false') {
  scope.isHideNavigator = false;
}

scope.lastZoomMode = localStorage['eagle.viewer.lastZoomMode'] || 'fit';
scope.toggleZoom = function (event: any) {
  if (!scope.isDetailMode) return;
  if (scope.lastZoomMode !== 'edge') {
    scope.zoomFitEdge(event, true);
    scope.lastZoomMode = 'edge';
  } else {
    scope.zoomFit(event);
    scope.lastZoomMode = 'fit';
  }
};

scope.zoomFitEdge = function (event: any, hasTransition?: boolean) {
  event && event.preventDefault && event.preventDefault();

  if (hasTransition) {
    (window as any).$('#detail-container').addClass('zooming');
    setTimeout(function () {
      (window as any).$('#detail-container').removeClass('zooming');
    }, 300);
  }

  const windowHeight = (window as any).$(window).height();
  const windowWidth = (window as any).$(window).width();
  const windowSize = Math.min(windowHeight, windowWidth);
  let ratio = scope.imageSize.zoomRatio || 100;
  const containerWidth = (window as any).$('.smooth_zoom_preloader').width();
  const containerHeight = (window as any).$('.smooth_zoom_preloader').height();
  let offsetY = 0;
  const pageX = (window as any).$(window).width() / 2;
  const pageY = (window as any).$(window).height() / 2;

  if (!scope.current) return;

  const a = Math.ceil((containerHeight / scope.current.height) * 100);
  const b = Math.ceil((containerWidth / scope.current.width) * 100);
  ratio = Math.min(a, b);

  const width = (window as any).$('#detail-container').width();
  const height = (scope.current && scope.current.height) || (window as any).$('#detail-container').height();

  offsetY = offsetY || 0;

  if (ratio) {
    if (ratio === 99 || ratio === 101) ratio = 100;
    scope.imageSize.zoomRatio = parseInt(String(ratio));
    scope.zoomFitSize = scope.imageSize.zoomRatio;
  }

  detailZoom()?.focusTo( {
    x: width / 2,
    y: height / 2 + offsetY,
    zoom: scope.imageSize.zoomRatio,
    speed: 0,
    pageX: pageX,
    pageY: pageY,
  });
};

scope.toggleRatioContextMenu = function () {
  if (scope.imageSize.zoomRatio != 100) {
    scope.zoomActual();
  } else {
    scope.zoom();
  }
};

scope.copyImage = function (event?: any) {
  event && event.preventDefault && event.preventDefault();
  ipcRenderer.send('copy-images', [scope.current]);
  scope.showCopyToast = true;
  clearTimeout(copyImageTimeout);
  copyImageTimeout = setTimeout(function () {
    scope.showCopyToast = false;
    notifyController();
  }, 1000);
};

scope.zoomIn = function (event?: any) {
  event && event.preventDefault && event.preventDefault();
  let ratio = parseInt(String(scope.imageSize.zoomRatio));
  if (ratio >= 400) {
    ratio = 800;
  } else if (ratio >= 200) {
    ratio = 400;
  } else if (ratio >= 100) {
    ratio = 200;
  } else if (ratio >= 50) {
    ratio = 100;
  } else if (ratio >= 25) {
    ratio = 50;
  } else if (ratio >= 10) {
    ratio = 25;
  } else {
    ratio = 10;
  }
  if (ratio > 800) ratio = 800;
  scope.imageSize.zoomRatio = ratio;
  scope.updateZoomRatio(undefined, undefined, undefined, true);
};

scope.zoomOut = function (event?: any) {
  event && event.preventDefault && event.preventDefault();
  let ratio = parseInt(String(scope.imageSize.zoomRatio));
  if (ratio <= 10) {
    ratio = 5;
  } else if (ratio <= 25) {
    ratio = 10;
  } else if (ratio <= 50) {
    ratio = 25;
  } else if (ratio <= 100) {
    ratio = 50;
  } else if (ratio <= 200) {
    ratio = 100;
  } else if (ratio <= 400) {
    ratio = 200;
  } else if (ratio <= 800) {
    ratio = 400;
  }
  scope.imageSize.zoomRatio = ratio;
  scope.updateZoomRatio(undefined, undefined, undefined, true);
};

scope.toggleGrayscale = function (event?: any) {
  event && event.preventDefault && event.preventDefault();
  scope.isGrayscaleMode = !scope.isGrayscaleMode;
};

scope.spaceHandler = function (event: any) {
  if (scope.current.ext === 'gif') {
    scope.toggleGifPlay();
  } else if (scope.isDetailMode && !scope.isInlineMode && VIDEO_TYPES[scope.current.ext]) {
    scope.toggleVideoPlay();
  }
};

scope.toggleVideoPlay = function () {
  const video = (window as any).$('.detail-wrap video')[0];
  if (!video.paused) {
    video.pause();
  } else {
    video.play();
  }
};

scope.homeHandler = function (event: any) {
  detailZoom()?.goToY( 40);
};

scope.endHandler = function (event: any) {
  detailZoom()?.goToY( -99999999);
  detailZoom()?.moveY( -window.outerHeight + 60);
};

scope.upHandler = function () {
  detailZoom()?.moveY( -100);
};

scope.downHandler = function () {
  detailZoom()?.moveY( 100);
};

/* ---- 导航（1761-1795 逐字） ---- */

scope.selectNext = function (event?: any) {
  event && event.preventDefault && event.preventDefault();
  if (scope.images.length <= 1) {
    return;
  }
  scope.imageSize.modified = false;
  const index = scope.currentIndex() - 1;
  if (scope.images[index + 1]) {
    scope.current = scope.images[index + 1];
  } else {
    return;
  }
  detailZoom()?.updateNavigator( scope.current);
  scope.zoom();
};

scope.selectPrev = function (event?: any) {
  event && event.preventDefault && event.preventDefault();
  if (scope.images.length <= 1) {
    return;
  }
  scope.imageSize.modified = false;
  const index = scope.currentIndex() - 1;
  if (scope.images[index - 1]) {
    scope.current = scope.images[index - 1];
  } else {
    return;
  }
  detailZoom()?.updateNavigator( scope.current);
  scope.zoom();
};

/* ---- 窗口控制（731-766 逐字） ---- */

scope.toggleAlwaysOnTop = function () {
  scope.isAlwaysOnTop = !scope.isAlwaysOnTop;
  if (scope.isAlwaysOnTop) {
    currentWindow.setAlwaysOnTop(true, 'pop-up-menu');
  } else {
    currentWindow.setAlwaysOnTop(false);
  }
};

scope.toggleFullScreen = function () {
  currentWindow.setFullScreen(!currentWindow.isFullScreen());
};

scope.close = function () {
  if (currentWindow.isFullScreen()) {
    currentWindow.setFullScreen(false);
  } else {
    currentWindow.close();
  }
};

scope.minimize = () => {
  currentWindow.minimize();
};

scope.maximize = () => {
  if (!currentWindow.isMaximized()) {
    currentWindow.maximize();
    scope.isMaximize = true;
  } else {
    currentWindow.unmaximize();
    scope.isMaximize = false;
  }
};

scope.restore = () => {
  if (!currentWindow.isMaximized()) {
    currentWindow.maximize();
    scope.isMaximize = true;
  } else {
    currentWindow.unmaximize();
    scope.isMaximize = false;
  }
};

/* ---- 拖拽/动作（852-910 逐字） ---- */

scope.startDrag = function (event: any) {
  if (scope.current) {
    const transformsJSON = JSON.stringify([scope.current]);
    ipcRenderer.send('ondragstart', { images: transformsJSON, target: scope.current, resize: 120 });
  }
};

scope.onMiddleClick = function (event: any) {
  if (event && event.button === 1) {
    if (scope.preferences?.habits?.middleBtn === 'openNewWindow') {
      event && event.preventDefault();
      scope.close();
      return;
    }
  }
};

scope.openWithDefault = function (event?: any) {
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }
  const rawPath = FileUrlHelper.getRawPath(scope.current);
  ipcRenderer.send('open-with-default', rawPath);
};

scope.openWithFinder = function (event?: any) {
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }
  const rawPath = FileUrlHelper.getRawPath(scope.current);
  ipcRenderer.send('show-item-in-folder', rawPath);
};

scope.copyAsPath = function (event?: any) {
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }
  const rawPath = FileUrlHelper.getRawPath(scope.current);
  req('electron').clipboard.writeText(rawPath);
  scope.showCopyToast = true;
  clearTimeout(copyImageTimeout);
  copyImageTimeout = setTimeout(function () {
    scope.showCopyToast = false;
    notifyController();
  }, 1000);
};

scope.copyAsLink = function (event?: any) {
  if (scope.current) {
    req('electron').clipboard.writeText(`http://localhost:41595/item?id=${scope.current.id}`);
    scope.showCopyToast = true;
    clearTimeout(copyImageTimeout);
    copyImageTimeout = setTimeout(function () {
      scope.showCopyToast = false;
      notifyController();
    }, 1000);
  }
};

/* ---- 右键菜单（912-1058 逐字） ---- */

scope.openContextMenu = function (event: any) {
  event.stopPropagation();

  const contextMenu = new Menu();
  const openWithDefault = new MenuItem({
    label: pvT('context.image.openInDefault'),
    accelerator: scope.preferences?.shortcuts?.keybinds?.['view.file.opendefault'],
    click: function () {
      scope.openWithDefault();
    },
  });

  let openWithFinderLabel = pvT('context.image.openInExplorer');
  if (process.platform === 'darwin') {
    openWithFinderLabel = pvT('context.image.revealInFinder');
  }
  const openWithFinder = new MenuItem({
    label: openWithFinderLabel,
    accelerator: scope.preferences?.shortcuts?.keybinds?.['view.file.openfinder'],
    click: function () {
      scope.openWithFinder();
    },
  });

  const copyItem = new MenuItem({
    label: pvT('context.image.copyItems') + ' (&C)',
    accelerator: 'CmdOrCtrl+C',
    click: function () {
      scope.copyImage();
      notifyController();
    },
  });

  const grayscaleItem = new MenuItem({
    label: pvT('appmenu.view>grayscale'),
    type: 'checkbox',
    accelerator: scope.preferences?.shortcuts?.keybinds?.['view.grayscale'],
    checked: scope.isGrayscaleMode,
    click: function (event: any) {
      scope.toggleGrayscale(event);
      notifyController();
    },
  });
  const rotateItem = new MenuItem({
    label: pvT('toolbar.rotateBtnHint'),
    accelerator: scope.preferences?.shortcuts?.keybinds?.['edit.image.rotate'],
    click: function (event: any) {
      scope.rotateHandler(event);
    },
  });
  const flipItem = new MenuItem({
    label: pvT('toolbar.flipBtnHint'),
    accelerator: scope.preferences?.shortcuts?.keybinds?.['edit.image.flip'],
    click: function (event: any) {
      scope.flipHandler(event);
    },
  });
  const revealInFolder = new MenuItem({
    label: (window as any).i18n.__('previewWindow.revealInEagle'),
    click: function () {
      ipcRenderer.send('reveal-in-eagle', scope.current);
    },
  });

  const current = scope.current;
  const isVideo = !!(current && VIDEO_TYPES[current.ext]);

  contextMenu.append(openWithDefault);
  contextMenu.append(openWithFinder);
  contextMenu.append(new MenuItem({ type: 'separator' }));
  contextMenu.append(copyItem);
  contextMenu.append(
    new MenuItem({
      label: (window as any).i18n.__('context.image.copyItemPath'),
      accelerator: scope.preferences?.shortcuts?.keybinds?.['edit.copy.path'],
      click: function () {
        scope.copyAsPath();
        notifyController();
      },
    })
  );
  contextMenu.append(
    new MenuItem({
      label: (window as any).i18n.__('appmenu.edit>copyAsLink'),
      click: function () {
        scope.copyAsLink();
        notifyController();
      },
    })
  );
  contextMenu.append(new MenuItem({ type: 'separator' }));

  if (isVideo) {
    const copyCurrentVideoScreen = new MenuItem({
      label: (window as any).i18n.__('context.image.copyCurrentFrameToClipboard') + ' (&P)',
      accelerator: scope.preferences?.shortcuts?.keybinds?.['player.thumbnail.copy'],
      click: function () {
        scope.videoScreenShot(true);
      },
    });

    const saveCurrentVideoScreen = new MenuItem({
      label: (window as any).i18n.__('context.image.saveCurrentFrame') + ' (&S)',
      accelerator: scope.preferences?.shortcuts?.keybinds?.['player.thumbnail.save'],
      click: function () {
        scope.videoScreenShot();
      },
    });
    contextMenu.append(copyCurrentVideoScreen);
    contextMenu.append(saveCurrentVideoScreen);
    contextMenu.append(new MenuItem({ type: 'separator' }));
  }

  contextMenu.append(rotateItem);
  contextMenu.append(flipItem);
  contextMenu.append(
    new MenuItem({
      label: (window as any).i18n.__('appmenu.view>showNavigator'),
      type: 'checkbox',
      checked: !scope.isHideNavigator,
      click: function () {
        scope.isHideNavigator = !scope.isHideNavigator;
        localStorage['isHideNavigator_Viewer'] = scope.isHideNavigator;
        notifyController();
      },
    })
  );
  contextMenu.append(grayscaleItem);

  const opacityMenu = new Menu();
  for (let i = 10; i <= 100; i += 10) {
    (function (opacity: number) {
      opacityMenu.append(
        new MenuItem({
          label: opacity + '%',
          type: 'checkbox',
          checked: currentWindow.getOpacity() === opacity / 100,
          click: function () {
            currentWindow.setOpacity(opacity / 100);
          },
        })
      );
    })(i);
  }

  const opacityItem = new MenuItem({
    label: (window as any).i18n.__('appmenu.view>opacity'),
    submenu: opacityMenu,
  });

  contextMenu.append(opacityItem);
  contextMenu.append(new MenuItem({ type: 'separator' }));
  contextMenu.append(revealInFolder);

  setTimeout(function () {
    contextMenu.popup(currentWindow);
  }, 100);
};

/* ---- GIF 播放器（1907-2261 逐字） ---- */

scope.gifPlayer;
scope.gifUpadteInterval;

scope.gifViewer = {
  frames: [],
  mousedownTime: 0,
  mousedownX: 0,
  mousedownY: 0,
  range: undefined,
  speed: 1,
  setThumbnail: function () {
    if (!scope.isGifReady) return;
    const curr = scope.gifPlayer.get_current_frame();
    const f = scope.gifPlayer.get_frame(curr);
    if (!f) return;
    const b64 = f.base64;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    const image = new Image();
    image.onload = function () {
      canvas.width = image.width;
      canvas.height = image.height;
      ctx.drawImage(image, 0, 0);

      let ratio = 1;
      if (canvas.height > canvas.width) {
        if (canvas.width > 480) {
          ratio = 480 / canvas.width;
        } else {
          ratio = 1;
        }
      } else {
        if (canvas.height > 480) {
          ratio = 480 / canvas.height;
        } else {
          ratio = 1;
        }
      }
      if (ratio !== 1) {
        (window as any).canvasResizeTo(canvas, ratio);
      }

      const base64string = canvas.toDataURL();
      ipcRenderer.send('regenerate-gif-thumbnail', {
        gif: scope.current,
        base64string: base64string,
      });
    };
    image.src = f.base64;
  },
  setSpeed: function (speed = 1) {
    scope.gifViewer.speed = speed;
    notifyController();
    scope.gifPlayer.set_speed(speed);
    (window as any).$('.gif-toolbar-btn.speed span').text(`${speed}x`);
  },
  mousedown: function (event: any) {
    if (event.button !== 0) return;
    scope.gifViewer.mousedownX = event.clientX;
    scope.gifViewer.mousedownY = event.clientY;
    scope.gifViewer.mousedownTime = Date.now();
  },
  mouseup: function (event: any) {
    if (event.button !== 0) return;
    if (
      Date.now() - scope.gifViewer.mousedownTime < 333 &&
      Math.abs(scope.gifViewer.mousedownX - event.clientX) < 5 &&
      Math.abs(scope.gifViewer.mousedownY - event.clientY) < 5
    ) {
      scope.toggleGifPlay();
      notifyController();
    }
  },
  cancelRange: function () {
    if (scope.gifViewer.range !== undefined) {
      scope.gifViewer.range = undefined;
      const $resizableBar = (window as any).$('.gif-toolbar .resize-bar');
      $resizableBar.css({
        left: '0%',
        width: '100%',
      });
      if (scope.gifPlayer) {
        scope.gifPlayer.move_to(0);
      }
    }
  },
  nextFrame: function () {
    const curr = scope.gifPlayer.get_current_frame();
    let index = curr + 1;
    if (index + 1 > scope.gifViewer.frames.length - 1) index = scope.gifViewer.frames.length - 1;
    scope.gifViewer.setFrame(index);
    scope.gifPlayer.pause();
  },
  prevFrame: function () {
    const curr = scope.gifPlayer.get_current_frame();
    let index = curr - 1;
    if (index - 1 < 0) index = 0;
    scope.gifViewer.setFrame(index);
    scope.gifPlayer.pause();
  },
  setFrame: function (index: number) {
    scope.gifPlayer.move_to(index);
  },
  onProgress: function (progress: number, length: any) {
    clearInterval(scope.gifUpadteInterval);
    if (scope.isGifReady === true) {
      scope.isGifReady = false;
      scope.gifViewer.frames = [];
      scope.gifViewer.mousedownTime = 0;
      scope.gifViewer.mousedownX = 0;
      scope.gifViewer.mousedownY = 0;
      scope.gifViewer.range = undefined;
      scope.gifPlayer = undefined;
      notifyController();
    }
    updateGifProgressbar(progress);
    (window as any).$('.gif-toolbar .message span').text(`${parseInt(String(progress * 100))}%`);
  },
  onFinished: function (result: any) {
    scope.gifViewer.range = undefined;
    scope.gifPlayer = result.gifPlayer;
    scope.isGifReady = true;
    scope.gifViewer.frames = result.frames;
    scope.gifViewer.playing = result.playing;
    scope.gifViewer.setSpeed(1);
    notifyController();
    const $resizableBar = (window as any).$('.gif-toolbar .resize-bar');
    (window as any).$('.gif-toolbar .total-frame').text(`/ ${scope.gifViewer.frames.length}`);

    if ($resizableBar.is('.ui-resizable')) {
      $resizableBar.resizable('destroy');
    }

    $resizableBar.css({
      left: 0,
      width: 'auto',
    });

    (window as any).$('.gif-toolbar.in').removeClass('in');
    setTimeout(function () {
      (window as any).$('.gif-toolbar').addClass('in');
    }, 100);

    let gifPlayerResizeOriginalState = false;
    let gifPlayerResizing = false;
    let gifPlayerLastResizeLeft: any;
    let gifPlayerLastResizeWidth: any;
    $resizableBar.resizable({
      handles: 'e, w',
      containment: '.gif-toolbar .progress-bar',
      start: function (event: any, ui: any) {
        gifPlayerLastResizeLeft = parseInt(ui.element.css('left'));
        gifPlayerLastResizeWidth = ui.element.width();
        gifPlayerResizeOriginalState = scope.gifPlayer.get_playing();
        scope.gifPlayer.pause();
      },
      resize: function (event: any, ui: any) {
        (window as any).$('#gif-progress-indicator').hide();
        gifPlayerResizing = true;
      },
      stop: function (event: any, ui: any) {
        gifPlayerResizing = false;
        const frames = scope.gifViewer.frames;
        const parentWidth = (window as any).$('.gif-toolbar .progress-bar').width();
        const left = parseInt(ui.element.css('left'));
        const width = ui.element.width();
        const leftP = (left / parentWidth) * 100;
        const widthP = (width / parentWidth) * 100;
        $resizableBar.css({
          left: `${leftP}%`,
          width: `${widthP}%`,
        });

        let index = scope.gifPlayer.get_current_frame();
        if (index < 0) index = 0;
        if (gifPlayerLastResizeLeft !== left) {
          if (scope.gifViewer.range === undefined) {
            scope.gifViewer.range = [index, scope.gifViewer.frames.length];
          } else {
            scope.gifViewer.range = [index, scope.gifViewer.range[1]];
          }
        } else if (gifPlayerLastResizeWidth !== width) {
          if (scope.gifViewer.range === undefined) {
            scope.gifViewer.range = [0, index + 1];
          } else {
            scope.gifViewer.range = [scope.gifViewer.range[0], index + 1];
          }
        }

        if (scope.gifViewer.range[0] > scope.gifViewer.range[1]) {
          scope.gifViewer.range = [scope.gifViewer.range[1], scope.gifViewer.range[0]];
        }
        console.log(scope.gifViewer.range);

        (window as any).$('#gif-progress-indicator').show();
        if (gifPlayerResizeOriginalState) {
          scope.gifPlayer.play();
        }
      },
    });

    scope.gifUpadteInterval = setInterval(function () {
      try {
        let c = scope.gifPlayer.get_current_frame();
        const length = scope.gifPlayer.get_length();

        if (scope.gifViewer.range && !gifPlayerResizing && !gifPlayerProgressDown) {
          const start = scope.gifViewer.range[0];
          const end = scope.gifViewer.range[1];
          if (c <= start) {
            c = start;
            scope.gifPlayer.move_to(c);
          }
          if (c >= end) {
            c = start;
            scope.gifPlayer.move_to(c);
          }
        }

        const text = (window as any).paddingNumber(c + 1, `${length}`.length);
        if ((window as any).$('.gif-toolbar .current-frame').text() !== text) {
          (window as any).$('.gif-toolbar .current-frame').text(text);
        }
        updateGifIndicator(c + 1);
      } catch (err) {}
    }, 50);
  },
};

let gifPlayerProgressDown = false;
let gifPlayerOriginalState = false;

const updateGifIndicator = function (index: number) {
  let percent = ((index - 1) / (scope.gifViewer.frames.length - 1)) * 100;
  if (percent < 0) percent = 0;
  const value = `${percent}%`;
  if ((window as any).$('#gif-progress-indicator').css('left') !== value) {
    (window as any).$('#gif-progress-indicator').css('left', value);
  }
};

const updateGifProgressbar = function (progress: number) {
  (window as any).$('.gif-toolbar .progress-bar .current').css('width', `${progress * 100}%`);
};

scope.toggleGifPlay = function () {
  if (scope.gifPlayer && scope.isGifReady) {
    if (scope.gifViewer.playing) {
      scope.gifPlayer.pause();
      scope.gifViewer.playing = false;
      notifyController();
    } else {
      scope.gifPlayer.play();
      scope.gifViewer.playing = true;
      notifyController();
    }
    (window as any).$('.gif-viewer').css('opacity', 0.8);
    setTimeout(function () {
      (window as any).$('.gif-viewer').css('opacity', 1);
    }, 100);
  }
};

scope.nextGifFrame = function (amount = 1) {
  if (scope.gifPlayer && scope.isGifReady) {
    scope.gifPlayer.pause();
    scope.gifViewer.playing = false;
    const curr = scope.gifPlayer.get_current_frame();
    const total = scope.gifViewer.frames.length;
    let idx = curr + amount;
    if (idx > total) idx = total - 1;
    scope.gifPlayer.move_to(idx);
    notifyController();
  }
};

scope.prevGifFrame = function (amount = 1) {
  if (scope.gifPlayer && scope.isGifReady) {
    scope.gifPlayer.pause();
    scope.gifViewer.playing = false;
    const curr = scope.gifPlayer.get_current_frame();
    let idx = curr - amount;
    if (idx < 0) idx = 0;
    scope.gifPlayer.move_to(idx);
    notifyController();
  }
};

scope.toggleGifPlayerMode = function () {
  scope.usingGifPlayer = !scope.usingGifPlayer;
};

scope.openGifContextMenu = function (event: any) {
  event.stopPropagation();

  const contextMenu = new Menu();
  contextMenu.append(
    new MenuItem({
      label: (window as any).i18n.__('context.gifViewer.setThumbnail'),
      click: () => {
        scope.gifViewer.setThumbnail();
        notifyController();
      },
    })
  );

  contextMenu.append(
    new MenuItem({
      label: (window as any).i18n.__('context.gifViewer.cancelRange'),
      click: () => {
        scope.gifViewer.cancelRange();
        notifyController();
      },
    })
  );

  contextMenu.popup(currentWindow);
};

/* ---- 缩放（1807-1903 逐字） ---- */

scope.zoom = function () {
  if (scope.lastZoomMode === 'edge') {
    scope.zoomFitEdge();
  } else {
    scope.smartZoom();
  }
};

scope.smartZoom = function () {
  const windowHeight = (window as any).$(window).height();
  const windowWidth = (window as any).$(window).width();
  const windowSize = Math.min(windowHeight, windowWidth);
  let ratio = scope.imageSize.zoomRatio || 100;
  const containerWidth = (window as any).$('.smooth_zoom_preloader').width();
  const containerHeight = (window as any).$('.smooth_zoom_preloader').height();
  let offsetY = 0;
  const pageX = (window as any).$(window).width() / 2;
  const pageY = (window as any).$(window).height() / 2;

  if (!scope.current) return;

  if (scope.preferences?.habits?.defaultRatio != 'auto') {
    ratio = 100;
  } else {
    if (
      isMobileResolution(scope.current.width, scope.current.height) &&
      windowSize > Math.min(scope.current.width, scope.current.height)
    ) {
      ratio = (100 * isMobileResolution(scope.current.width, scope.current.height)) / scope.current.height;
    } else if (
      (scope.current.width >= 960 && scope.current.width * 1.8 < scope.current.height) ||
      (scope.current.width >= 320 && scope.current.width * 2.7 < scope.current.height)
    ) {
      ratio = parseInt(String((containerWidth / scope.current.width) * 100));
      if (ratio > 100) {
        ratio = 100;
      }
      if (scope.current.height > (window as any).$('.smooth_zoom_preloader').height()) {
        offsetY =
          (scope.current.height - ((window as any).$('.smooth_zoom_preloader').height() * 100) / ratio) / -2;
      }
    } else {
      if (scope.current.height > containerHeight || scope.current.width > containerWidth) {
        const a = Math.ceil((containerHeight / scope.current.height) * 100);
        const b = Math.ceil((containerWidth / scope.current.width) * 100);
        ratio = Math.min(a, b);
      } else {
        ratio = 100;
      }
    }
  }

  const width = (window as any).$('#detail-container').width();
  const height = (scope.current && scope.current.height) || (window as any).$('#detail-container').height();

  offsetY = offsetY || 0;

  if (ratio) {
    if (ratio === 99 || ratio === 101) ratio = 100;
    scope.imageSize.zoomRatio = parseInt(String(ratio));
  }

  detailZoom()?.focusTo( {
    x: width / 2,
    y: height / 2 + offsetY,
    zoom: scope.imageSize.zoomRatio,
    speed: 0,
    pageX: pageX,
    pageY: pageY,
  });
};

function isMobileResolution(w: number, h: number) {
  if (w === h) return false;
  const devicesMetrics = (window as any).devicesMetrics || [];
  for (let i = 0; i < devicesMetrics.length; i++) {
    const size = devicesMetrics[i];
    const remainderW = w % size.w;
    const remainderH = h % size.h;
    const multipleW = w / size.w;
    const multipleH = h / size.h;

    if (remainderW == 0 && remainderH == 0 && multipleW === multipleH) {
      if (w / size.w <= 3) {
        return size.h;
      }
    }
  }
  return false;
}

/* ---- initContainer（821-850 逐字） ---- */

function initContainer() {
  scope.showDetailImage = false;
  ensureDetailZoom({
    width: '100%',
    height: '100%',
    responsive: true,
    mouse_WHEEL: true,
    mouse_DOUBLE_CLICK: false,
    zoom_BUTTONS_SHOW: false,
    pan_BUTTONS_SHOW: false,
    background_COLOR: 'transparent',
    border_SIZE: 0,
    animation_SMOOTHNESS: 0,
    animation_SPEED_ZOOM: 0,
    animation_SPEED_PAN: 0,
    zoom_MAX: 800,
    zoom_MIN: 5,
    on_IMAGE_LOAD: function () {
      setTimeout(function () {
        detailZoom()?.updateNavigator( scope.current);
        (window as any).$(window).trigger('orientationchange');
        scope.zoom();
        (window as any).$('#detail-container').css('opacity', 1);
        setTimeout(function () {
          scope.showDetailImage = true;
          notifyController();
        }, 200);
      }, 200);
    },
  });
}

/* ---- init 序列（581-658 逐字） ---- */

function runInitSequence(params: any) {
  console.log(params);
  if (params) {
    scope.images = params.images;
    try {
      scope.pluginModule = params.pluginModule;
      const pluginModule = scope.pluginModule;
      pluginModule.previewExtension.allowZoom = (ext: string) => {
        const plugin = pluginModule.previewExtension.viewerPluginMap[ext];
        if (!plugin?.manifest?.preview) return false;

        const keys = Object.keys(plugin?.manifest?.preview);
        for (const key of keys) {
          if (key.includes(ext)) {
            return plugin?.manifest?.preview[key]?.viewer?.allowZoom === true;
          }
        }
      };
      pluginModule.previewExtension.getViewerPluginExt = (item: any) => {
        if (!item) return;
        if (pluginModule.previewExtension.viewerPluginMap[item?.ext]) {
          return 'plugin';
        }
        const IMAGE_TYPES: Record<string, boolean> = {
          jpg: true,
          jpeg: true,
          png: true,
          webp: true,
          avif: true,
          insp: true,
          jfif: true,
          jpe: true,
          jxl: true,
          bmp: true,
          tif: true,
          tiff: true,
          hif: true,
          heif: true,
          heic: true,
        };
        if (IMAGE_TYPES[item?.ext]) {
          return 'image';
        }
        if (item.customThumbnail && !(window as any).EagleConfig.SUPPORT_FORMATS[item.ext]) {
          return 'custom';
        }
        return item.ext;
      };
      pluginModule.previewExtension.getViewerPluginURL = (item: any) => {
        const filePath = FileUrlHelper.getRawPath(item);
        const locale = scope.preferences.general.language.replace('_', '-');
        const theme = scope.theme;
        const id = item.id;
        return `${pluginModule?.previewExtension.viewerURL[item?.ext]}?id=${id}&path=${encodeURIComponent(
          filePath
        )}&width=${item.width}&height=${item.height}&lang=${locale}&theme=${theme}`;
      };
      pluginModule.previewExtension.getViewerPlugin = (item: any) => {
        if (!item) return;
        if (pluginModule.previewExtension.viewerPluginMap[item?.ext]) {
          return pluginModule.previewExtension.viewerPluginMap[item?.ext];
        }
        return undefined;
      };
    } catch (err) {
      console.error(err);
    }
    if (process.platform == 'darwin') {
      scope.imagesDir = encodeURI(params.imagesDir);
    } else {
      scope.imagesDir = encodeURI(params.imagesDir.replace(/\\/g, '/'));
    }
    scope.libraryImagesPath = params.imagesDir;
    scope.current = scope.images[0];
    scope.metas = scope.getMetas(scope.current);
    notifyController();
    initContainer();
  }
}

// entry.tsx 的 'init' 监听经 applyController(s => s.runInitSequence(params)) 调用（单一注册点）
scope.runInitSequence = runInitSequence;

/* ---- 构造期（417-579 逐字） ---- */

(function constructor() {
  const preferences = electronSettings.getPreferences();
  (window as any).preferences = preferences;
  scope.preferences = preferences;
  try {
    if (electron && electron.webFrame) electron.webFrame.setZoomFactor(parseInt(preferences.general.zoom) / 100);
  } catch (err) {}
  scope.theme = preferences.theme.css || 'gray';
  if (preferences && preferences.theme.name === 'Auto') {
    if (remote.nativeTheme.shouldUseDarkColors) {
      scope.theme = 'gray';
    } else {
      scope.theme = 'light';
    }
  }

  scope.language = preferences.language || 'en';

  console.log(scope.imageId);

  if (ipcRenderer && ipcRenderer.on) {
    ipcRenderer.on('change.zoom', function (e: any, zoom: any) {
      if (electron && electron.webFrame) electron.webFrame.setZoomFactor(parseInt(zoom) / 100);
    });

    ipcRenderer.on('change.current.theme', function (e: any, theme: any) {
      if (theme.name === 'Auto') {
        if (remote.nativeTheme.shouldUseDarkColors) {
          scope.theme = 'gray';
        } else {
          scope.theme = 'light';
        }
      } else {
        scope.theme = theme.css || 'gray';
      }
      notifyController();
    });

    ipcRenderer.on('update-preferences', function () {
      scope.preferences = electronSettings.getPreferences();
      notifyController();
    });

    ipcRenderer.send('get.viewer.image', scope.imageId);

    // 'init' 序列由 React entry（effect 内）注册 → applyController(runInitSequence)；
    // 此处不重复注册（双 init 会二次 initContainer/smoothZoom 包裹）。
  }

  // 全屏类切换（43-49 逐字）
  if (currentWindow && currentWindow.on) {
    currentWindow.on('enter-full-screen', function () {
      (window as any).$('body').addClass('fullscreen');
    });

    currentWindow.on('leave-full-screen', function () {
      (window as any).$('body').removeClass('fullscreen');
    });
  }

  initShellBehaviors();
})();

/* ---- 壳级行为（660-819 逐字：拖拽模式/窗口控制/hide-toolbar/gif 工具列委托） ---- */

function initShellBehaviors() {
  // 持压著 Shift 直接拖拽图片窗口位置
  let isDragMode = false;
  (window as any).$(window).on('keydown.toggleDragMode', function (event: any) {
    if (event.keyCode === 16) {
      (window as any).$('#drag-mode-overlay').addClass('show');
      isDragMode = true;
    }
  });

  (window as any).$(window).on('keyup.toggleDragMode', function (event: any) {
    if (event.keyCode === 16) {
      (window as any).$('#drag-mode-overlay').removeClass('show');
      isDragMode = false;
    }
  });

  (window as any).$('#drag-mode-overlay').on('mouseup', function (event: any) {
    if (!event.shiftKey) {
      (window as any).$('#drag-mode-overlay').removeClass('show');
      isDragMode = false;
    }
  });

  (window as any).$('#drag-mode-overlay').on('mousemove', function (event: any) {
    if (isDragMode) {
      (window as any).$('#drag-mode-overlay').removeClass('show');
      isDragMode = false;
    }
  });

  document.addEventListener('mousemove', function (event: any) {
    if (!isDragMode) {
      if (event.shiftKey) {
        (window as any).$('#drag-mode-overlay').addClass('show');
        isDragMode = true;
      }
    } else {
      (window as any).$('#drag-mode-overlay').removeClass('show');
      isDragMode = false;
    }
  });

  (window as any).$('#min-btn').on('click', function () {
    currentWindow && currentWindow.minimize();
  });

  (window as any).$('#max-btn').on('click', function () {
    if (!currentWindow) return;
    if (currentWindow.isFullScreen()) {
      currentWindow.setFullScreen(false);
    } else if (!currentWindow.isMaximized()) {
      currentWindow.maximize();
      scope.isMaximize = true;
    } else {
      currentWindow.unmaximize();
      scope.isMaximize = false;
    }
  });

  (window as any).$('#restore-btn').on('click', function () {
    if (!currentWindow) return;
    if (currentWindow.isFullScreen()) {
      currentWindow.setFullScreen(false);
    } else if (!currentWindow.isMaximized()) {
      currentWindow.maximize();
      scope.isMaximize = true;
    } else {
      currentWindow.unmaximize();
      scope.isMaximize = false;
    }
  });

  (window as any).$(window).on(
    'resize',
    (window as any).throttle
      ? (window as any).throttle(
          function () {
            (window as any).$(window).trigger('orientationchange');
            if (!scope.imageSize.modified) {
              scope.zoom();
              setTimeout(function () {
                scope.zoom();
              }, 200);
              notifyController();
            }
          },
          16
        )
      : function () {}
  );

  const lastPoint: any = {};
  const cursorInterval = setInterval(() => {
    try {
      if (!remote || !currentWindow) return;
      const currentPoint = remote.screen.getCursorScreenPoint();
      const windowBounds = currentWindow.getBounds();

      if (
        currentPoint.x < windowBounds.x ||
        currentPoint.y < windowBounds.y ||
        currentPoint.x > windowBounds.x + windowBounds.width ||
        currentPoint.y > windowBounds.y + windowBounds.height
      ) {
        (window as any).$('body').addClass('hide-toolbar');
      } else {
        if (lastPoint.x === currentPoint.x && lastPoint.y === currentPoint.y) return;
        (window as any).$('body').removeClass('hide-toolbar');
      }

      lastPoint.x = currentPoint.x;
      lastPoint.y = currentPoint.y;
    } catch (err) {}
  }, 500);

  let autoHideToolbarTimeout: any;
  (window as any).$(window).on('blur', function () {
    clearTimeout(autoHideToolbarTimeout);
    (window as any).$('body').addClass('hide-toolbar');
  });

  (window as any).$(document).on('mouseenter', function () {
    clearTimeout(autoHideToolbarTimeout);
    (window as any).$('body').removeClass('hide-toolbar');
  });

  (window as any).$(document).on(
    'mousemove',
    (window as any).throttle
      ? (window as any).throttle(function () {
          (window as any).$('body').removeClass('hide-toolbar');
        }, 200)
      : function () {}
  );

  (window as any).$(document).on('mousemove', function () {
    clearTimeout(autoHideToolbarTimeout);
    autoHideToolbarTimeout = setTimeout(function () {
      (window as any).$('body').addClass('hide-toolbar');
    }, 1000);
  });

  // gif 工具列委托（2156-2242 逐字）
  (window as any).$('body').on('mousedown', '.gif-toolbar .progress-bar', function (this: any, event: any) {
    if (event.button === 0) {
      gifPlayerProgressDown = true;
      gifPlayerOriginalState = scope.gifPlayer && scope.gifPlayer.get_playing();
      (window as any).$('#thumbnail-preview').hide();

      if (scope.isGifReady) {
        const width = (window as any).$(this).width();
        const currentPosX = event.offsetX;
        let index = Math.round((currentPosX / width) * scope.gifViewer.frames.length) + 1;
        if (!index) return;
        if (index - 1 >= scope.gifViewer.frames.length) index = scope.gifViewer.frames.length;
        if (scope.gifViewer.range !== undefined) {
          if (index - 1 > scope.gifViewer.range[1] || index - 1 < scope.gifViewer.range[0]) {
            return;
          }
        }
        (window as any).$('#gif-progress-indicator').css(
          'left',
          `${((index - 1) / (scope.gifViewer.frames.length - 1)) * 100}%`
        );
        scope.gifPlayer.move_to(index - 1);
        scope.gifPlayer.pause();
      }
    }
  });

  (window as any).$('body').on('mouseup', '.gif-toolbar', function (event: any) {
    if (event.button === 0) {
      gifPlayerProgressDown = false;
      if (gifPlayerOriginalState) {
        scope.gifPlayer.play();
      }
    } else if (event.button === 2) {
      scope.openGifContextMenu(event);
    }
    (window as any).$('.gif-toolbar .progress-bar .ui-resizable-handle').css('pointer-events', '');
  });

  (window as any).$('body').on('mouseleave', '.gif-toolbar .progress-bar', function () {
    if (!gifPlayerProgressDown) {
      (window as any).$('#thumbnail-preview').hide();
    }
  });

  (window as any).$('body').on('mousemove', '.gif-toolbar .progress-bar .ui-resizable-handle', function (event: any) {
    event.stopPropagation();
  });

  (window as any).$('body').on('mousemove', '.gif-toolbar .progress-bar', function (this: any, event: any) {
    if (event.button === 0) {
      const currentPosX = event.offsetX;

      if (scope.isGifReady) {
        const width = (window as any).$(this).width();
        let index = Math.round((currentPosX / width) * scope.gifViewer.frames.length) + 1;
        if (index - 1 >= scope.gifViewer.frames.length) index = scope.gifViewer.frames.length;
        if (!gifPlayerProgressDown) {
          const img = (window as any).$('#thumbnail-preview img')[0];
          const f = scope.gifPlayer.get_frame(index - 1);
          if (!f) return;
          img.src = f.base64;

          const w = (window as any).$('#thumbnail-preview img').width();
          let left = currentPosX - w / 2;
          if (left < 0) left = 0;
          if (left > width - w) left = width - w;

          (window as any).$('#thumbnail-preview').css({
            transform: `translateX(${left}px)`,
          });

          (window as any).$('#thumbnail-preview .current-index').text(`${index}`);
          (window as any).$('#thumbnail-preview').show();
        } else {
          (window as any).$('.gif-toolbar .progress-bar .ui-resizable-handle').css('pointer-events', 'none');
          (window as any).$('#gif-progress-indicator').css(
            'left',
            `${((index - 1) / (scope.gifViewer.frames.length - 1)) * 100}%`
          );
          scope.gifPlayer.move_to(index - 1);
          scope.gifPlayer.pause();
        }
      }
    }
  });

  // 快照刷新（旧版依赖 digest 的字段变化 → notify）
  (window as any).$(document).ready(function () {
    notifyController();
  });
}

/* ---- 快捷键绑定（2265-2363 逐字） ---- */

function buildMousetrapBindings() {
  const bindings: Record<string, any> = {};

  const shortcutHandlerMap: Record<string, () => void> = {
    'player.playAndPause': () => {
      if (scope.isDetailMode && !scope.isInlineMode && scope.current.ext == 'gif') {
        scope.toggleGifPlay();
      }
    },
    'player.prev1frame': scope.prevFrameHandler,
    'player.next1frame': scope.nextFrameHandler,
    'player.prev10frame': scope.prevFrameHandler,
    'player.next10frame': scope.nextFrameHandler,

    'player.thumbnail.copy': () => {
      scope.videoScreenShot(true);
    },
    'player.thumbnail.save': () => {
      scope.videoScreenShot();
    },
    'edit.copy.path': scope.copyAsPath,
    'view.file.openfinder': scope.openWithFinder,
    'view.file.opendefault': scope.openWithDefault,
    'edit.image.rotate': scope.rotateHandler,
    'edit.image.flip': scope.flipHandler,
    'edit.image.crop': scope.copeVideoFrame,
    'view.zoom.actual': scope.zoomActual,
    'view.zoom.fit': scope.zoomFit,
    'view.zoom.in': scope.zoomIn,
    'view.zoom.out': scope.zoomOut,
    'view.grayscale': scope.toggleGrayscale,
    'view.scroll.home': scope.homeHandler,
    'view.scroll.end': scope.endHandler,
    'view.alwaysOnTop': scope.toggleAlwaysOnTop,
  };

  if (!(window as any).ShortcutManager || !(window as any).ShortcutManager.electronToMousetrap) {
    console.warn('[Preview] ShortcutManager not available, using hardcoded shortcuts only');
  }

  const preferences = scope.preferences;
  if (preferences && preferences.shortcuts && preferences.shortcuts.keybinds && (window as any).ShortcutManager) {
    for (const [keyName, electronKey] of Object.entries(preferences.shortcuts.keybinds)) {
      if (shortcutHandlerMap[keyName] && electronKey) {
        const mousetrapKey = (window as any).ShortcutManager.electronToMousetrap(electronKey);
        if (mousetrapKey) {
          bindings[mousetrapKey] = shortcutHandlerMap[keyName];
          console.log(`[Preview] Mapped ${keyName}: ${electronKey} -> ${mousetrapKey}`);
        }
      }
    }
  }

  const hardcodedShortcuts: Record<string, any> = {
    esc: scope.close,
    'mod+c': scope.copyImage,
    right: scope.selectNext,
    left: scope.selectPrev,
    m: scope.mHandler,
    a: scope.selectPrev,
    d: scope.selectNext,
    w: scope.upHandler,
    s: scope.downHandler,
    up: scope.upHandler,
    down: scope.downHandler,
    'shift+s': scope.saveVideoFrame,
    'mod+8': scope.zoomFitEdge,
    '`': scope.toggleZoom,
    '=': scope.zoomIn,
    '+': scope.zoomIn,
    '-': scope.zoomOut,
    space: scope.spaceHandler,
    t: scope.toggleAlwaysOnTop,
  };

  for (const [key, handler] of Object.entries(hardcodedShortcuts)) {
    if (!bindings[key]) {
      bindings[key] = handler;
    }
  }

  if (bindings['mod+='] && !bindings['mod+plus']) {
    bindings['mod+plus'] = bindings['mod+='];
  }

  console.log('[Preview] Total mousetrap bindings:', Object.keys(bindings).length);
  return bindings;
}

scope.mousetrap = buildMousetrapBindings();

/* ================= 测试契约 ================= */

export const controllerScope: any = scope;

(window as any).__eaglePreviewController = scope;
(window as any).$bodyScope = scope;

void EAGLE_THUMBNAIL_TEMP_PATH;
void path;
void fs;
