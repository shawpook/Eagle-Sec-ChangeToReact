import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { controllerScope, applyController, subscribeController, getControllerVersion, pvT } from './controller';
import { usePreviewMouseGesture, usePreviewTgaImage, usePreviewMousetrap } from './detailHooks';
import { applyNgClassSet, useMediaElement, useMpvMediaElement } from '../components/detail/detailHooks';
import { useRetryWhenError, useCommentsContainer, useCommentItem } from '../components/detail/commentHooks';
import { WebviewToolbar } from '../components/detail/DetailToolbar';
import { useTippy } from '../components/hooks';
import { shortcuts } from '../app/filters';

const req = (name: string): any => (window as any).require?.(name);

/**
 * 阶段9a-1：预览大窗 React 壳——preview-window.html（383 行）逐字转写。
 *
 * 静态壳保留在 preview-window.html（元素身份永不重建）：#drag-mode-overlay/.drag-area/
 * .container/#detail-container（smoothZoom wrap 关系不破坏，同阶段5 详情模式）。
 * React 以 portal 注入四处锚点：
 *   - #eagle-preview-toolbar-anchor → 工具列 ng-switch（7 分支）
 *   - #eagle-preview-content-anchor → toast + not-support-preview
 *   - #detail-container → 查看器 ng-switch（14 分支）
 *   - #eagle-preview-footbar-anchor → gif 播放器工具列
 * body 的 theme/platform/type-* / ng-class 集合由 effect 差量维护（hide-toolbar/fullscreen
 * 由既有 jQuery/JS 动态切换，效果只在插值串变化时重写——与原版 digest 行为一致）。
 */

const themePathOf = (theme: string) => (theme === 'light' || theme === 'lightgray' ? 'light' : 'dark');
const iconSrc = (theme: string, icon: string) => `assets/images/${themePathOf(theme)}/icons/${icon}`;
const number0 = (n: any) => {
  const v = Number(n);
  if (Number.isNaN(v)) return '';
  return Math.round(v).toLocaleString('en-US');
};

const VIDEO_EXTS = 'ts|3gp|360|afx|vap|eva|mp4|mov|m4v|webm|mkv|avi|wmv|mpg|mts|flv|m2ts|f4v'.split('|');
const FONT_EXTS = 'ttf|otf|ttc|woff|woff2'.split('|');
const MODEL_EXTS = 'fbx|obj|3ds|3mf|dae|ifc|ply|stl|glb'.split('|');
const RAW_EXTS = '3fr|arw|cr2|cr3|crw|dng|erf|pef|raf|rw2|sr2|srw|x3f|orf|mrw|nef|nrw|raw'.split('|');
const SPECIAL_EXTS =
  'hdr|exr|ico|psd|psb|indd|idml|indt|xd|skp|dwg|cdr|blend|c4d|clip|dds|prd|pxd|sketch|fig|af|afdesign|afpub|afphoto|ai|sketchraw|icns|skt|eps|key|potx|pptx|ppt|docx|doc|pages|xlsx|xls|eddx|emmx|numbers|graffle|xmind|mindnode'.split(
    '|'
  );
const URL_EXTS = 'url|mhtml|html'.split('|');

const call = (fn: string, ...preArgs: any[]) => (e?: any) =>
  applyController((s) => {
    if (typeof s[fn] === 'function') s[fn](...(preArgs.length ? preArgs : e === undefined ? [] : [e]));
  });

const ngShowStyle = (shown: boolean, style?: React.CSSProperties): React.CSSProperties =>
  shown ? style || {} : { ...(style || {}), display: 'none' };

/* ================= 工具列子组件（toolbarBtn / navigator 指令模板逐字） ================= */

function ToolbarBtnPin({ theme }: { theme: string }) {
  return (
    <div
      style={ngShowStyle(controllerScope.isAlwaysOnTop, { WebkitAppRegion: 'no-drag' } as any)}
      className="ic-btn"
      tippy=""
      tippy-placement="bottom"
      tippy-content={`${pvT('titlebar.alwayTop.off')}<key>Shift</key><key>T</key>`}
      onClick={call('toggleAlwaysOnTop')}
    >
      <img src={iconSrc(theme, 'ic-toolbar-unpin.svg')} />
    </div>
  );
}

function ToolbarBtnUnpin({ theme }: { theme: string }) {
  return (
    <div
      style={ngShowStyle(!controllerScope.isAlwaysOnTop, { WebkitAppRegion: 'no-drag' } as any)}
      className="ic-btn"
      tippy=""
      tippy-placement="bottom"
      tippy-content={`${pvT('titlebar.alwayTop.on')}<key>Shift</key><key>T</key>`}
      onClick={call('toggleAlwaysOnTop')}
    >
      <img src={iconSrc(theme, 'ic-toolbar-pin.svg')} />
    </div>
  );
}

function ToolbarBtnClose({ theme }: { theme: string }) {
  const platform = controllerScope.platform;
  const isMaximize = controllerScope.isMaximize;
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {platform === 'win32' && (
        <div style={{ WebkitAppRegion: 'no-drag' } as any} className="ic-btn" onClick={call('minimize')}>
          <img src={iconSrc(theme, 'ic-windows-hide.svg')} />
        </div>
      )}
      {platform === 'win32' && !isMaximize && (
        <div style={{ WebkitAppRegion: 'no-drag' } as any} className="ic-btn" onClick={call('maximize')}>
          <img src={iconSrc(theme, 'ic-windows-fullscreen.svg')} />
        </div>
      )}
      {platform === 'win32' && isMaximize && (
        <div style={{ WebkitAppRegion: 'no-drag' } as any} className="ic-btn" onClick={call('restore')}>
          <img src={iconSrc(theme, 'ic-windows-restore.svg')} />
        </div>
      )}
      <div style={{ WebkitAppRegion: 'no-drag' } as any} className="ic-btn" onClick={call('close')}>
        <img src={iconSrc(theme, 'ic-toolbar-close.svg')} />
      </div>
    </div>
  );
}

function ToolbarBtnZoomFit({ theme }: { theme: string }) {
  return (
    <div
      className={`ic-btn${controllerScope.lastZoomMode === 'edge' ? ' active' : ''}`}
      style={{ WebkitAppRegion: 'no-drag' } as any}
      tippy=""
      tippy-placement="bottom"
      tippy-content={`${pvT('toolbar.zoomFitPage')}<key>\`</key>`}
      onClick={call('toggleZoom')}
    >
      <img src={iconSrc(theme, 'ic-toolbar-zoom-fit.svg')} />
    </div>
  );
}

function ToolbarBtnFrameByFrame({ theme }: { theme: string }) {
  return (
    <div
      className={`ic-btn${controllerScope.usingGifPlayer ? ' active' : ''}`}
      style={{ WebkitAppRegion: 'no-drag' } as any}
      tippy=""
      tippy-placement="bottom"
      tippy-content={pvT('gifViewer.enableBtn')}
      onClick={call('toggleGifPlayerMode')}
    >
      <img src={iconSrc(theme, 'ic-toolbar-gif-frames.svg')} />
    </div>
  );
}

function ToolbarBtnZoomActual({ theme }: { theme: string }) {
  return (
    <div
      style={{ WebkitAppRegion: 'no-drag' } as any}
      className="ic-btn"
      tippy=""
      tippy-placement="bottom"
      tippy-content={`${pvT('toolbar.zoomActualBtn')}${shortcuts('<key>Command</key><key>0</key>')}`}
      onClick={call('zoomActual')}
    >
      <img src={iconSrc(theme, 'ic-toolbar-zoom-actual.svg')} />
    </div>
  );
}

function PreviewNavigator({ theme }: { theme: string }) {
  const scope = controllerScope;
  const atFirst = scope.currentIndex() === 1;
  const atLast = scope.currentIndex() === scope.images.length;
  return (
    <>
      <div className="navigator">
        <div
          style={{ WebkitAppRegion: 'no-drag' } as any}
          className={`ic-btn prev${atFirst ? ' disabled' : ''}`}
          onClick={call('selectPrev')}
        >
          <img src={iconSrc(theme, 'ic-toolbar-prev.svg')} />
        </div>
        <div
          style={{ WebkitAppRegion: 'no-drag' } as any}
          className={`ic-btn next${atLast ? ' disabled' : ''}`}
          onClick={call('selectNext')}
        >
          <img src={iconSrc(theme, 'ic-toolbar-next.svg')} />
        </div>
      </div>
      <div className="separator" />
    </>
  );
}

function RatioButton() {
  return (
    <div
      style={{ WebkitAppRegion: 'no-drag', padding: '0 6px' } as any}
      className="ic-btn"
      onClick={call('openRatioContextMenu')}
    >
      {number0(controllerScope.imageSize.zoomRatio)}%
    </div>
  );
}

function PinCloseGroup({ theme, zoomControls }: { theme: string; zoomControls: boolean }) {
  return (
    <div className="ic-btn-group">
      {zoomControls && (
        <>
          <RatioButton />
          <ToolbarBtnZoomActual theme={theme} />
          <ToolbarBtnZoomFit theme={theme} />
        </>
      )}
      <ToolbarBtnPin theme={theme} />
      <ToolbarBtnUnpin theme={theme} />
      <ToolbarBtnClose theme={theme} />
    </div>
  );
}

function ToolbarSwitch() {
  const scope = controllerScope;
  const theme = scope.theme || 'gray';
  const current = scope.current;
  const ext = current ? current.ext : '';
  const pluginExt = scope.pluginModule?.previewExtension?.getViewerPluginExt
    ? scope.pluginModule.previewExtension.getViewerPluginExt(current)
    : undefined;
  const themeAttr = { theme };
  const showNav = (scope.images || []).length > 1;
  const toolbarRootRef = useRef<HTMLDivElement>(null);
  // 原 tippy 指令（bundle 17365，stage5 useTippy 逐字）：属性变化（$observe 语义）→ 销毁重建
  useTippy(
    toolbarRootRef,
    JSON.stringify([
      theme,
      scope.currentIndex(),
      (scope.images || []).length,
      scope.isAlwaysOnTop,
      scope.isMaximize,
      scope.lastZoomMode,
      scope.usingGifPlayer,
      scope.platform,
    ])
  );
  const titleName = (
    <div id="tilte-name" className="title-name" onContextMenu={call('startDrag')}>
      {scope.getMetas(current)}
    </div>
  );

  let toolbar: React.ReactNode = null;
  if (pluginExt === 'url' || pluginExt === 'mhtml' || pluginExt === 'html') {
    toolbar = (
      <div className="toolbar">
        <div className="left">
          <WebviewToolbar snapshot={themeAttr as any} webviewId={`webview-${current?.id}`} />
        </div>
        <div className="right">
          {showNav && <PreviewNavigator theme={theme} />}
          <PinCloseGroup theme={theme} zoomControls={false} />
        </div>
      </div>
    );
  } else if (pluginExt === 'gif') {
    toolbar = (
      <div className="toolbar">
        <div className="left">{titleName}</div>
        <div className="separator" />
        <div className="right">
          {showNav && <PreviewNavigator theme={theme} />}
          <div className="ic-btn-group">
            <RatioButton />
            <ToolbarBtnFrameByFrame theme={theme} />
            <ToolbarBtnZoomActual theme={theme} />
            <ToolbarBtnZoomFit theme={theme} />
            <ToolbarBtnPin theme={theme} />
            <ToolbarBtnUnpin theme={theme} />
            <ToolbarBtnClose theme={theme} />
          </div>
        </div>
      </div>
    );
  } else if (VIDEO_EXTS.includes(ext) || FONT_EXTS.includes(ext) || MODEL_EXTS.includes(ext) || ext === 'txt') {
    toolbar = (
      <div className="toolbar">
        <div className="left">{titleName}</div>
        <div className="separator" />
        <div className="right">
          {showNav && <PreviewNavigator theme={theme} />}
          <PinCloseGroup theme={theme} zoomControls={false} />
        </div>
      </div>
    );
  } else {
    toolbar = (
      <div className="toolbar">
        <div className="left">{titleName}</div>
        <div className="separator" />
        <div className="right">
          {showNav && <PreviewNavigator theme={theme} />}
          <PinCloseGroup theme={theme} zoomControls />
        </div>
      </div>
    );
  }

  return (
    <div ref={toolbarRootRef} ng-switch="" onDoubleClick={(e) => e.stopPropagation()}
      onMouseUp={(e) => {
        const event = e.nativeEvent;
        if ((event as any).button === 1) {
          applyController((s) => {
            if (typeof s.onMiddleClick === 'function') s.onMiddleClick(event);
          });
        }
      }}
    >
      {toolbar}
    </div>
  );
}

/* ================= 查看器容器内部（ng-switch 14 分支逐字） ================= */

function CommentsLayerSvg() {
  const current = controllerScope.current;
  useCommentsContainer(current?.id, !!(current?.comments && current.comments.length));
  return (
    <div className="comments" comments-container="">
      {(current?.comments || []).map((comment: any, i: number) => (
        <CommentItemBoxSvg key={i} comment={comment} index={i} />
      ))}
    </div>
  );
}

function CommentItemBoxSvg({ comment, index }: { comment: any; index: number }) {
  const elRef = useRef<HTMLDivElement>(null);
  const ratio = controllerScope.ratio || 1;
  useCommentItem(elRef, index, { enabled: true });
  const zoomRatioExp = controllerScope.imageSize.zoomRatioExp || 100;
  return (
    <div
      id={`comment-${comment.id}`}
      comment-item=""
      className="comment"
      style={{
        width: comment.width * (1 / ratio),
        height: comment.height * (1 / ratio),
        top: comment.y * (1 / ratio),
        left: comment.x * (1 / ratio),
      }}
      ref={elRef}
    >
      <div className="badge" style={{ zoom: `${((100 / zoomRatioExp) * 100).toFixed(4)}%` }}>
        {index + 1}
      </div>
      <div
        className="remove"
        style={{ zoom: `${((100 / zoomRatioExp) * 100).toFixed(4)}%` }}
        onClick={() => {
          // 原版 $root.removeComment 在预览窗 $rootScope 上不存在（removeComment 属主窗口
          // EagleController，bundle 未加载）→ 原版此点击为 no-op，守卫等价保留。
          applyController((s) => {
            if (typeof s.$root?.removeComment === 'function') s.$root.removeComment(index, comment);
          });
        }}
      >
        ×
      </div>
    </div>
  );
}

function GifImgPreview() {
  const imgRef = useRef<HTMLImageElement>(null);
  const scope = controllerScope;
  useRetryWhenError(imgRef, 'raw', scope.current?.id);
  const zoomRatioExp = scope.imageSize.zoomRatioExp || 100;
  const cls = `${zoomRatioExp >= 200 ? 'zoom-in' : ''} ${
    scope.imageSize.zoomRatio > 100 && scope.preferences?.habits?.renderBehavior === 'pixelated' ? 'pixelated' : ''
  }`.trim();
  return <img id="detail-image" className={cls} src={scope.getRawUrl(scope.current)} ref={imgRef} />;
}

function ImageBranch() {
  const scope = controllerScope;
  const w = scope.current?.width || 0;
  const h = scope.current?.height || 0;
  const long =
    (w === 1242 && h === 2208) ||
    (w * 2.7 <= h && w >= 320) ||
    (w * 1.8 < h && w >= 960) ||
    (w >= 1080 && h >= 1080);
  return (
    <div className={`detail-wrap ${scope.current?.ext} movable${long ? ' long' : ''}`}>
      <div className="image-wrap" style={ngShowStyle(scope.showDetailImage)}>
        <img
          id="detail-image"
          width={w}
          height={h}
          src={scope.getThumbnailUrl(scope.current) || 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAAXNSR0IArs4c6QAAAA1JREFUGFdj+Hfu+X8ACTQDswCYXvgAAAAASUVORK5CYII='}
          style={{ marginLeft: -2 }}
        />
      </div>
    </div>
  );
}

function SvgBranch() {
  const scope = controllerScope;
  const w = scope.current?.width || 0;
  const h = scope.current?.height || 0;
  const rect = scope.commentRect || ({} as any);
  return (
    <div className={`detail-wrap svg movable bg-${scope.current?.background}`}>
      <div className="image-wrap">
        <div
          className="rect"
          style={ngShowStyle(!!(rect.w && rect.h), {
            width: rect.w,
            height: rect.h,
            top: rect.startY,
            left: rect.startX,
          })}
        />
        <CommentsLayerSvg />
        <img id="detail-image" width={w} height={h} src={scope.getRawUrl(scope.current)} />
      </div>
    </div>
  );
}

function GifBranch() {
  const scope = controllerScope;
  const w = scope.current?.width || 0;
  const h = scope.current?.height || 0;
  const gifEnabled = scope.preferences?.habits?.gifViewer === 'on' || scope.usingGifPlayer;
  return (
    <div
      className={`detail-wrap ${scope.current?.ext}`}
      onMouseDown={(e) =>
        applyController((s) => {
          if (typeof s.gifViewer?.mousedown === 'function') s.gifViewer.mousedown(e.nativeEvent);
        })
      }
      onMouseUp={(e) =>
        applyController((s) => {
          if (typeof s.gifViewer?.mouseup === 'function') s.gifViewer.mouseup(e.nativeEvent);
        })
      }
    >
      {gifEnabled && (
        <iframe id="gif-viewer" src={scope.getGIFPath()} width={w} height={h} />
      )}
      {!gifEnabled && (
        <div className="image-wrap">
          <GifImgPreview />
        </div>
      )}
    </div>
  );
}

function NativeVideoBranchPreview() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const scope = controllerScope;
  useMediaElement(videoRef);
  return (
    <video className="video-js vjs-default-skin" controls ref={videoRef} src={scope.getRawUrl(scope.current)}>
      <source src={scope.getRawUrl(scope.current)} type="video/mp4" />
    </video>
  );
}

function MpvVideoBranchPreview() {
  const videoRef = useRef<HTMLElement>(null);
  const scope = controllerScope;
  useMpvMediaElement(videoRef, scope.current?.id);
  return <mpv-video controls controls-mode="always" autoplay src={scope.getRawUrl(scope.current)} ref={videoRef as any} />;
}

function TgaBranch() {
  const scope = controllerScope;
  const w = scope.current?.width || 0;
  const h = scope.current?.height || 0;
  const imgRef = useRef<HTMLImageElement>(null);
  usePreviewTgaImage(imgRef, scope.getRawUrl(scope.current));
  const zoomRatioExp = scope.imageSize.zoomRatioExp || 100;
  const long =
    (w === 1242 && h === 2208) ||
    (w * 2.7 <= h && w >= 320) ||
    (w * 1.8 < h && w >= 960) ||
    (w >= 1080 && h >= 1080);
  return (
    <div className={`detail-wrap${long ? ' long' : ''}`}>
      <div className="image-wrap" style={ngShowStyle(scope.showDetailImage)}>
        <img
          tga-img=""
          id="detail-image"
          className={`${zoomRatioExp >= 200 ? 'zoom-in' : ''} ${
            scope.imageSize.zoomRatio > 100 && scope.preferences?.habits?.renderBehavior === 'pixelated'
              ? 'pixelated'
              : ''
          }`.trim()}
          width={w}
          height={h}
          src={scope.getThumbnailUrl(scope.current)}
          ref={imgRef}
        />
      </div>
    </div>
  );
}

function SpecialBranch() {
  const scope = controllerScope;
  const w = scope.current?.width || 0;
  const h = scope.current?.height || 0;
  const long =
    (w === 1242 && h === 2208) ||
    (w * 2.7 <= h && w >= 320) ||
    (w * 1.8 < h && w >= 960) ||
    (w >= 1080 && h >= 1080);
  return (
    <div className={`detail-wrap${long ? ' long' : ''}`}>
      <div className="image-wrap" style={ngShowStyle(scope.showDetailImage)}>
        <iframe
          style={{ zIndex: 10, position: 'absolute', pointerEvents: 'none' }}
          src={scope.getNativeViewerPath()}
          width={w}
          height={h}
        />
        <img id="detail-image" width={w} height={h} src={scope.getThumbnailUrl(scope.current)} />
      </div>
    </div>
  );
}

function CustomBranch() {
  const scope = controllerScope;
  const w = scope.current?.width || 0;
  const h = scope.current?.height || 0;
  const large = w * h >= 25000000;
  const long =
    (w === 1242 && h === 2208) ||
    (w * 2.7 <= h && w >= 320) ||
    (w * 1.8 < h && w >= 960) ||
    (w >= 1080 && h >= 1080);
  return (
    <div className={`detail-wrap${large ? ' large' : ''}${long ? ' long' : ''}`}>
      {!scope.current?.noPreview && (
        <div className="image-wrap" style={ngShowStyle(scope.showDetailImage)}>
          <img id="detail-image" width={w} height={h} src={scope.getThumbnailUrl(scope.current)} />
        </div>
      )}
    </div>
  );
}

/* ---------------- plugin-view 指令移植（js/directives/plugin-view.js 预览窗版，port 阶段5 PluginView） ---------------- */

let previewPluginWebView: any = null;
let previewPluginWebViewInitialized = false;

function PreviewPluginView({ item, url }: { item: any; url?: string }) {
  const hostRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!item) return;

    function init() {
      const preloadPath = req('url')
        .pathToFileURL(req('path').join((window as any).appRoot.path, '/app/js/plugin/api-format-extension.js'))
        .href;
      const wv = document.createElement('webview') as any;
      wv.setAttribute('preload', preloadPath);
      wv.setAttribute('allowpopups', '');
      wv.setAttribute('nodeintegration', '');
      wv.setAttribute('webpreferences', 'contextIsolation=false');
      wv.setAttribute('src', url);
      previewPluginWebViewInitialized = true;

      if (hostRef.current && !hostRef.current.querySelector('webview')) {
        hostRef.current.appendChild(wv);
      }

      wv.addEventListener('did-fail-load', (e: any) => {
        console.log(e);
      });
      wv.addEventListener('console-message', (e: any) => {
        console.log(e.message);
      });
      wv.addEventListener('crash', (e: any) => {
        console.log(e);
      });
      wv.addEventListener('will-navigate', (e: any) => {
        console.log(e.url);
        if (e.url && e.url !== wv.src) {
        } else {
          e.preventDefault();
          e.stopPropagation();
          wv.stop();
          wv.reload();
        }
      });
      previewPluginWebView = wv;
      wv.addEventListener('dom-ready', () => {
        const s = controllerScope;
        const current = s.current;
        const plugin = s.pluginModule?.previewExtension?.getViewerPlugin(current);
        const allowZoom = s.pluginModule?.previewExtension?.allowZoom(current?.ext);

        let style = '';
        if (allowZoom && current) {
          style = `
                        aspect-ratio: ${current.width / current.height};
                        max-width: 100%;
                        max-height: 100%;
                        width: ${current.width}px;
                        height: ${current.height}px;
                    `;
        }
        wv.setAttribute('style', style);

        try {
          const remote = req('@electron/remote');
          const app = remote?.app;
          const pjson = req((window as any).appRoot.path + '/package.json');
          const preferences = (window as any).preferences;
          const script = `
                            window.parentID = ${remote?.getCurrentWindow?.()?.webContents?.id};
                            window.windowID = ${wv.getWebContentsId()};
                            window.eagle.app.theme = '${preferences?.theme?.name}';
                            window.eagle.app.version = '${pjson?.version}';
                            window.eagle.app.build = ${pjson?.buildNumber};
                            window.eagle.app.locale = '${preferences?.general?.language}';
                            window.eagle.app.runningUnderARM64Translation = ${app?.runningUnderARM64Translation};
                            window.eagle.plugin = {};
                            window.eagle.plugin.path = '${String(plugin?.path || '').replace(/\\/gm, '/').replace(/'/g, "\\'")}';
                            window.eagle.plugin.path = require('path').normalize(window.eagle.plugin.path);
                            window.eagle.library.path = '${String(s?.libraryPath || '').replace(/\\/gm, '/').replace(/'/g, "\\'")}';
                            window.eagle.library.path = require('path').normalize(window.eagle.library.path);
                            window.eagle.app.userDataPath = '${String(app?.getPath('userData') || '').replace(/\\/gm, '/').replace(/'/g, "\\'")}';

                            try {
                                global.__dirname = eagle.plugin.path;
                                eagle.isDev = !eagle.plugin.path.includes('Eagle/Plugins') && !eagle.plugin.path.includes('Eagle\\\\Plugins');
                            } catch (err) {
                                console.log(err);
                            }
                        `;
          wv.executeJavaScript(script);
        } catch (err) {}
        setTimeout(() => {
          wv.send('plugin-create', plugin);
          wv.send('plugin-run');
        }, 100);
      });
    }

    if (!previewPluginWebViewInitialized) {
      init();
    } else if (previewPluginWebView) {
      if (hostRef.current && !hostRef.current.querySelector('webview')) {
        hostRef.current.appendChild(previewPluginWebView);
      }
      previewPluginWebView.setAttribute('src', '');
      setTimeout(() => {
        previewPluginWebView?.setAttribute('src', url);
      }, 50);
    }

    return () => {
      // 原 scope.$on('$destroy')：src 清空
      previewPluginWebView?.setAttribute('src', '');
    };
  }, [item?.id, url]);

  return <plugin-view id="plugin-viewer" ref={hostRef as any} />;
}

/* ---------------- web-view 指令移植（js/directives/webview.js 预览窗版，port 阶段5 WebViewBranch） ---------------- */

function PreviewWebViewBranch({ item, urlSrc }: { item: any; urlSrc?: string }) {
  const hostRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const element = hostRef.current;
    if (!element || !item || !urlSrc) return;

    function init() {
      const isVideo = item.medium !== undefined;
      const tagName = 'webview';
      let className = '';
      let referrer = '';
      if (isVideo) className = 'is-video';
      if (urlSrc!.indexOf('youtube-nocookie.com') > -1) referrer = 'http://localhost/';
      const userAgent = (window as any).EagleConfig.USER_AGENT;

      element!.innerHTML = `<${tagName} id="url-viewer" class="${className}" allowpopups useragent="${userAgent}" httpreferrer="${referrer}"></${tagName}>`;

      const webview = element!.querySelector('webview') as any;
      if (!webview) return;

      const remote = req('@electron/remote');
      const win = remote?.getCurrentWindow?.();
      win?.on('leave-full-screen', function () {
        webview.executeJavaScript(`document.exitFullscreen();`);
      });

      webview.addEventListener('enter-html-full-screen', () => {
        if (process.platform === 'darwin') {
          webview.executeJavaScript(`document.exitFullscreen();`);
        }
        applyController((s) => {
          // 原版 $bodyScope.toggleSlideshow() 在预览窗控制器上不存在（主窗口函数）→ 守卫等价
          if (typeof s.toggleSlideshow === 'function') s.toggleSlideshow();
        });
      });
      webview.addEventListener('did-fail-load', (e: any) => {
        console.log(e);
      });
      webview.addEventListener('console-message', (e: any) => {
        console.log(e.message);
      });
      webview.addEventListener('crash', (e: any) => {
        console.log(e);
      });
      webview.addEventListener('will-navigate', (e: any) => {
        console.log(e.url);
      });
      webview.addEventListener('page-favicon-updated', (e: any) => {
        console.log(e.favicons);
        webview.favicon = e.favicons[0];
      });

      webview.src = urlSrc;
    }

    init();
  }, [item?.id, urlSrc]);

  return <web-view id={`webview-${item?.id}`} src={urlSrc} ref={hostRef as any} />;
}

function DetailContainerInterior() {
  const scope = controllerScope;
  const current = scope.current;
  const ext = current ? current.ext : '';
  const pluginExt = scope.pluginModule?.previewExtension?.getViewerPluginExt
    ? scope.pluginModule.previewExtension.getViewerPluginExt(current)
    : undefined;
  const w = current?.width || 0;
  const h = current?.height || 0;

  let branch: React.ReactNode = null;

  if (pluginExt === 'plugin') {
    branch = (
      <div className="detail-wrap fixed">
        <PreviewPluginView item={current} url={scope.pluginModule?.previewExtension?.getViewerPluginURL(current)} />
      </div>
    );
  } else if (pluginExt === 'gif') {
    branch = <GifBranch />;
  } else if (RAW_EXTS.includes(ext)) {
    branch = (
      <div className={`detail-wrap ${ext}`}>
        <iframe
          className="raw-viewer"
          src={scope.getRawViewerPath()}
          width={w}
          height={h}
        />
      </div>
    );
  } else if (pluginExt === 'pdf') {
    branch = (
      <div className={`detail-wrap fixed ${ext}`}>
        <iframe id="pdf-viewer" src={scope.getPDFPath()} />
      </div>
    );
  } else if (ext === 'txt') {
    branch = (
      <div className={`detail-wrap full ${ext}`}>
        <iframe id="text-editor" src={scope.getTxtPath()} />
      </div>
    );
  } else if (FONT_EXTS.includes(ext)) {
    branch = (
      <div className={`detail-wrap full ${ext}`}>
        <iframe id="font-viewer" src={scope.getFontPath()} />
      </div>
    );
  } else if (URL_EXTS.includes(ext)) {
    branch = (
      <div className={`detail-wrap full ${ext}`}>
        <PreviewWebViewBranch item={current} urlSrc={scope.getURLSrc()} />
      </div>
    );
  } else if (VIDEO_EXTS.includes(ext)) {
    branch = (
      <div
        className={`detail-wrap ${ext}${scope.useMpvPlayer ? ' full' : ' fixed'}`}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        <div id="video-player-tips" className="video-player-tips">
          <div className="tip volume">
            <div className="icon vol-0" />
            <div className="value">90</div>
          </div>
        </div>
        {!scope.useMpvPlayer && <NativeVideoBranchPreview />}
        {scope.useMpvPlayer && <MpvVideoBranchPreview />}
      </div>
    );
  } else if (ext === 'tga') {
    branch = w * h <= scope.MAX_DIMENSION ? <TgaBranch /> : null;
  } else if (MODEL_EXTS.includes(ext)) {
    branch = (
      <div className={`detail-wrap fixed ${ext}`}>
        <iframe id="model-viewer" src={scope.getModelPath()} />
      </div>
    );
  } else if (SPECIAL_EXTS.includes(ext)) {
    branch = <SpecialBranch />;
  } else if (pluginExt === 'custom') {
    branch = scope.isDetailMode ? <CustomBranch /> : null;
  } else if (pluginExt === 'svg') {
    branch = <SvgBranch />;
  } else if (pluginExt === 'image') {
    branch = <ImageBranch />;
  }

  return (
    <>
      {branch}
      {/* NOTE: 避免 zoomer 沒有任何圖片初始化會造成 zoomming 功能異常，因此這裡強制給一張圖 */}
      <img
        style={{ opacity: 0, pointerEvents: 'none' }}
        src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAAXNSR0IArs4c6QAAAA1JREFUGFdj+Hfu+X8ACTQDswCYXvgAAAAASUVORK5CYII="
      />
    </>
  );
}

/* ================= Gif 播放器工具列（footbar 337-380 逐字） ================= */

function GifFootbar() {
  const scope = controllerScope;
  const theme = scope.theme || 'gray';
  const isGifReady = scope.isGifReady;
  const playing = scope.gifViewer?.playing;
  const footbarRef = useRef<HTMLDivElement>(null);
  useTippy(footbarRef, JSON.stringify([theme, isGifReady, playing, scope.gifViewer?.speed]));
  return (
    <div
      ref={footbarRef}
      className="footbar"
      style={ngShowStyle(scope.current?.ext === 'gif')}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <div className="gif-toolbar in" style={ngShowStyle(isGifReady)}>
        <div
          className="gif-toolbar-btn play-btn"
          tippy=""
          tippy-placement="top"
          tippy-content="<key>Space</key>"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            call('toggleGifPlay')(e);
          }}
          style={ngShowStyle(!playing)}
        >
          <img src={iconSrc(theme, 'player/ic-toolbar-play.svg')} />
        </div>
        <div
          className="gif-toolbar-btn pause-btn"
          tippy=""
          tippy-placement="top"
          tippy-content="<key>Space</key>"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            call('toggleGifPlay')(e);
          }}
          style={ngShowStyle(playing)}
        >
          <img src={iconSrc(theme, 'player/ic-toolbar-pause.svg')} />
        </div>
        <div
          className="gif-toolbar-btn"
          tippy=""
          tippy-placement="top"
          tippy-content={`${pvT('appmenu.view>prevFrame')}<key>[</key>`}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            call('prevGifFrame')(e);
          }}
        >
          <img src={iconSrc(theme, 'player/ic-toolbar-backward.svg')} />
        </div>
        <div
          className="gif-toolbar-btn"
          tippy=""
          tippy-placement="top"
          tippy-content={`${pvT('appmenu.view>nextFrame')}<key>]</key>`}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            call('nextGifFrame')(e);
          }}
        >
          <img src={iconSrc(theme, 'player/ic-toolbar-forward.svg')} />
        </div>
        <div className="current-frame" />
        <div className="total-frame" />
        <div className="progress-bar">
          <div id="gif-progress-indicator" />
          <div id="thumbnail-preview" className="thumbnail-preview">
            <img src="" />
            <div className="current-index" />
          </div>
          <div className="bar" />
          <div className="resize-bar">
            <div className="bar" />
          </div>
        </div>
        <div className="gif-toolbar-btn speed">
          {/* 原版为静态文本 "1x"，显示由 setSpeed 的 jQuery .text() 直写拥有（React 静态节点 diff 不回写） */}
          <span>1x</span>
          <div className="speed-menu">
            {[4, 3, 2, 1.75, 1.5, 1.25, 1, 0.75, 0.5, 0.25].map((value) => (
              <div
                key={value}
                className={`speed-menu-itme${scope.gifViewer?.speed === value ? ' active' : ''}`}
                onClick={() => applyController((s) => s.gifViewer.setSpeed(value))}
              >
                {value}x
              </div>
            ))}
          </div>
        </div>
        <div
          className="gif-toolbar-btn more"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            call('openGifContextMenu')(e);
          }}
        >
          <img src={iconSrc(theme, 'player/ic-toolbar-more.svg')} />
        </div>
      </div>
      <div className="gif-toolbar init" style={ngShowStyle(!isGifReady)}>
        <div className="progress-bar">
          <div className="bar" />
          <div className="current" style={{ width: '0%' }} />
        </div>
        <div className="message">
          {pvT('progress.loadGifViewer.msg')}(<span className="percent" />)
        </div>
      </div>
    </div>
  );
}

/* ================= not-support-preview（ng-if 独立组件：内部 ref + mouseGesture） ================= */

function NotSupportPreview() {
  const scope = controllerScope;
  const notSupportRef = useRef<HTMLDivElement>(null);
  usePreviewMouseGesture(notSupportRef);
  return (
    <div className="not-support-preview" ref={notSupportRef}>
      <div className="not-support-preview-content">
        <div className="thumbnail">
          <img src={scope.getThumbnailUrl(scope.current)} />
        </div>
        <div className="title">{pvT('pages.tooBigPreview.title')}</div>
        <p>
          {pvT('pages.tooBigPreview.desc1')} {number0(scope.MAX_DIMENSION)} {pvT('pages.tooBigPreview.desc2')}
        </p>
      </div>
    </div>
  );
}

/* ================= Shell ================= */

function useControllerVersion(): number {
  const [, bump] = useState(0);
  useEffect(() => subscribeController(() => bump((v) => v + 1)), []);
  return getControllerVersion();
}

/* body class/platform 属性中 {{::theme}}/{{::platform}} 一次性绑定语义（初值冻结于控制器构造期） */
const INITIAL_THEME = controllerScope.theme || 'gray';
const INITIAL_PLATFORM = controllerScope.platform || '';

function PreviewShell() {
  useControllerVersion();
  usePreviewMousetrap();
  const scope = controllerScope;

  const containerRef = useRef<HTMLElement | null>(null);
  const prevBaseClass = useRef('');

  useEffect(() => {
    containerRef.current = document.getElementById('detail-container');
  }, []);

  usePreviewMouseGesture(containerRef);

  /* ---- body theme/type-* 插值 + ng-class + #detail-container ng-class（原版 digest 语义） ---- */
  useEffect(() => {
    const body = document.body;
    if (!body) return;
    const theme = scope.theme || 'gray';
    const current = scope.current;
    const ext = current ? current.ext : '';
    // class 中 theme/platform 为 {{::theme}}/{{::platform}} 一次性绑定（冻结初值），仅 type-{{current.ext}} 活绑
    const base = `${INITIAL_THEME} ${INITIAL_PLATFORM} type-${ext} hide-toolbar`;
    if (base !== prevBaseClass.current) {
      body.className = base;
      prevBaseClass.current = base;
    }
    // theme attr 活绑（{{theme}}）；platform attr 一次性（{{::platform}}）
    body.setAttribute('theme', theme);
    body.setAttribute('platform', INITIAL_PLATFORM);

    const gifEnabled = scope.preferences?.habits?.gifViewer === 'on' || scope.usingGifPlayer;
    const classMap: Record<string, boolean> = {
      'show-transparent-grid': scope.preferences?.habits?.transparency === 'show',
      gifviewer: gifEnabled,
      'non-perspective':
        (current && current.width * current.height >= 6553600) || (scope.imageSize?.zoomRatio || 100) < 100,
      'is-grayscale-mode': scope.isGrayscaleMode,
      'hide-navigator': scope.isHideNavigator,
      'alway-show-toolbar': Boolean(
        current &&
          (scope.FONT_TYPES[ext] ||
            scope.URL_TYPES[ext] ||
            ext === 'txt' ||
            ext === 'pdf' ||
            scope.MODEL_TYPES[ext] ||
            scope.pluginModule?.previewExtension?.viewerPluginMap?.[ext])
      ),
    };
    applyNgClassSet(body, classMap);

    // #detail-container 的 ng-class（preview-window.html 210-215 逐字表）
    const detail = document.getElementById('detail-container');
    if (detail) {
      applyNgClassSet(detail, {
        'comment-mode': Boolean(scope.isCommentMode),
        'hidden-footer': Boolean(
          current &&
            (scope.MODEL_TYPES[ext] ||
              scope.URL_TYPES[ext] ||
              ext === 'woff' ||
              ext === 'woff2' ||
              ext === 'txt' ||
              ext === 'ttc' ||
              ext === 'ttf' ||
              ext === 'otf' ||
              ext === 'pdf' ||
              scope.VIDEO_TYPES[ext])
        ),
        'is-model': Boolean(current && scope.MODEL_TYPES[ext]),
        'is-pdf': Boolean(current && ext === 'pdf'),
        'is-font': Boolean(
          current &&
            (ext === 'ttf' || ext === 'otf' || ext === 'ttc' || ext === 'woff' || ext === 'woff2' || ext === 'txt')
        ),
        'is-plugin': Boolean(current && scope.pluginModule?.previewExtension?.viewerPluginMap?.[ext]),
        'is-url': Boolean(current && scope.URL_TYPES[ext]),
        'is-video': Boolean(current && scope.VIDEO_TYPES[ext]),
      });
    }
  });

  const current = scope.current;
  const gifEnabled = scope.preferences?.habits?.gifViewer === 'on' || scope.usingGifPlayer;
  const notSupport =
    current &&
    current.width * current.height > scope.MAX_DIMENSION &&
    (current.ext === 'tif' || current.ext === 'tiff' || current.ext === 'heic' || current.ext === 'heif' || current.ext === 'tga');

  const toolbarAnchor = document.getElementById('eagle-preview-toolbar-anchor');
  const contentAnchor = document.getElementById('eagle-preview-content-anchor');
  const detailContainer = document.getElementById('detail-container');
  const footbarAnchor = document.getElementById('eagle-preview-footbar-anchor');

  return (
    <>
      {toolbarAnchor && createPortal(<ToolbarSwitch />, toolbarAnchor)}
      {contentAnchor &&
        createPortal(
          <>
            <div className={`toast${scope.showCopyToast ? ' show' : ''}`} style={{ display: 'none' }}>
              {pvT('previewWindow.copied')}
            </div>
            {notSupport && <NotSupportPreview />}
          </>,
          contentAnchor
        )}
      {detailContainer && createPortal(<DetailContainerInterior />, detailContainer)}
      {/* footbar ng-if（gifViewer 开启或 usingGifPlayer）→ 条件渲染；ng-show（ext=='gif'）→ GifFootbar 内 style */}
      {footbarAnchor && gifEnabled && createPortal(<GifFootbar />, footbarAnchor)}
    </>
  );
}

export default PreviewShell;
