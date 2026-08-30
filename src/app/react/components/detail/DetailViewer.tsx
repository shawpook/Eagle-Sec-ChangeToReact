import React, { useEffect, useRef } from 'react';
import { DetailSnapshot } from '../../store/detailState';
import { getBodyScope, scopeApply } from '../../global/scopeBridge';
import { t } from '../../global/eagleGlobals';
import {
  useMediaElement,
  useMpvMediaElement,
  useAudioMediaElement,
  useMouseGesture,
  useDetailContainerBehaviors,
  req,
} from './detailHooks';
import {
  useCommentItem,
  useCommentsContainer,
  useRectComment,
  useTifImage,
  useTgaImage,
  useRetryWhenError,
  useCropImage,
  removeComment,
  recomputeCommentRatio,
} from './commentHooks';

/**
 * 阶段5：#detail-container 内部（index.html 646-924 行逐字转写）。
 * 壳 #detail-container 保留在 index.html（元素身份永不重建，smoothZoom 包裹关系不破坏）；
 * ng-switch 分支 → pluginExt 条件渲染；ng-class/ng-click 由 useDetailContainerBehaviors 接管；
 * ng-show → style.display 等价转写。
 */

const themePathOf = (theme: string) => (theme === 'light' || theme === 'lightgray' ? 'light' : 'dark');

const call = (fn: string, ...preArgs: any[]) => (e?: any) =>
  scopeApply(getBodyScope(), (scope) => {
    if (typeof scope[fn] === 'function') scope[fn](...(preArgs.length ? preArgs : e === undefined ? [] : [e]));
  });

const VIDEO_EXTS = 'ts|3gp|360|afx|vap|eva|mp4|mov|m4v|webm|mkv|avi|wmv|mpg|mts|flv|m2ts|f4v'.split('|');
const AUDIO_EXTS = 'mp3|wav|ogg|flac|aac'.split('|');
const FONT_EXTS = 'ttc|ttf|otf|woff|woff2'.split('|');
const MODEL_EXTS = 'fbx|obj|3ds|3mf|dae|ifc|ply|stl|glb'.split('|');
const RAW_EXTS = '3fr|arw|cr2|cr3|crw|dng|erf|pef|raf|rw2|sr2|srw|x3f|orf|mrw|nef|nrw|raw'.split('|');
const SPECIAL_EXTS =
  'hdr|exr|ico|graffle|xmind|mindnode|psd|psdt|indd|idml|indt|psb|xd|c4d|blend|clip|skp|dwg|dds|prd|pxd|sketch|fig|afdesign|af|afpub|afphoto|ai|sketchraw|icns|skt|eps|key|potx|pptx|ppt|docx|doc|pages|xlsx|xls|eddx|emmx|numbers|cdr'.split(
    '|'
  );
const URL_EXTS = 'url|html|mhtml'.split('|');

const longClass = (w: number, h: number) =>
  (w === 1242 && h === 2208) || (w * 2.7 <= h && w >= 320) || (w * 1.8 < h && w >= 960) || (w >= 1080 && h >= 1080);
const largeClass = (w: number, h: number) => w * h >= 25000000;

/** comment-item ng-show 等价（ng-show=display:none，不摘除节点）。 */
const ngShowStyle = (shown: boolean, style?: React.CSSProperties): React.CSSProperties =>
  shown ? style || {} : { ...(style || {}), display: 'none' };

/* ---------------- 单个批注框（comment-item 指令移植） ---------------- */

function CommentItemBox({
  snapshot,
  comment,
  index,
  showWhenPositive,
}: {
  snapshot: DetailSnapshot;
  comment: any;
  index: number;
  showWhenPositive: boolean;
}) {
  const elRef = useRef<HTMLDivElement>(null);
  const ratio = snapshot.ratio;
  useCommentItem(elRef, index, { enabled: snapshot.isCommentMode });

  const visible = !showWhenPositive || comment.y * (1 / ratio) > 0;

  return (
    <div
      id={`comment-${comment.id}`}
      comment-item=""
      className="comment"
      style={ngShowStyle(visible, {
        width: comment.width * (1 / ratio),
        height: comment.height * (1 / ratio),
        top: comment.y * (1 / ratio),
        left: comment.x * (1 / ratio),
      })}
      ref={elRef}
    >
      <div className="badge" style={{ zoom: `${((100 / snapshot.zoomRatioExp) * 100).toFixed(4)}%` }}>
        {index + 1}
      </div>
      <div
        className="remove"
        style={{ zoom: `${((100 / snapshot.zoomRatioExp) * 100).toFixed(4)}%` }}
        onClick={() => removeComment(index)}
      >
        ×
      </div>
    </div>
  );
}

/* ---------------- 批注层（comments-container 指令模板部分） ---------------- */

function CommentsLayer({
  snapshot,
  withRect,
  showWhenPositive,
}: {
  snapshot: DetailSnapshot;
  withRect: boolean;
  showWhenPositive: boolean;
}) {
  const { current, commentRect } = snapshot;
  useCommentsContainer(current?.id, !!current?.comments?.length);
  const rect = commentRect || ({} as any);

  return (
    <div className="comments" comments-container="">
      {withRect && (
        <div
          className="rect"
          style={ngShowStyle(!!(rect.w && rect.h), {
            width: rect.w,
            height: rect.h,
            top: rect.startY,
            left: rect.startX,
          })}
        />
      )}
      {(current?.comments || []).map((comment, i) => (
        <CommentItemBox key={i} snapshot={snapshot} comment={comment} index={i} showWhenPositive={showWhenPositive} />
      ))}
    </div>
  );
}

/* ---------------- plugin-view 指令移植（bundle 17598-17719） ---------------- */

let pluginWebView: any = null;
let pluginWebViewInitialized = false;

function PluginView({ snapshot }: { snapshot: DetailSnapshot }) {
  const hostRef = useRef<HTMLElement>(null);
  const { current, pluginViewerUrl } = snapshot;

  useEffect(() => {
    if (!current) return;

    function init() {
      const preloadPath = req('url')
        .pathToFileURL(req('path').join((window as any).appRoot.path, '/app/js/plugin/api-format-extension.js'))
        .href;
      const wv = document.createElement('webview') as any;
      wv.setAttribute('preload', preloadPath);
      wv.setAttribute('allowpopups', '');
      wv.setAttribute('nodeintegration', '');
      wv.setAttribute('webpreferences', 'contextIsolation=false');
      wv.setAttribute('src', pluginViewerUrl);
      pluginWebViewInitialized = true;

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
      pluginWebView = wv;
      wv.addEventListener('dom-ready', () => {
        const s = getBodyScope();
        const item = s?.current;
        const plugin = s?.pluginModule?.previewExtension?.getViewerPlugin(item);
        const allowZoom = s?.pluginModule?.previewExtension?.allowZoom(item?.ext);

        let style = '';
        if (allowZoom && item) {
          style = `
                        aspect-ratio: ${item.width / item.height};
                        max-width: 100%;
                        max-height: 100%;
                        width: ${item.width}px;
                        height: ${item.height}px;
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

    if (!pluginWebViewInitialized) {
      init();
    } else if (pluginWebView) {
      if (hostRef.current && !hostRef.current.querySelector('webview')) {
        hostRef.current.appendChild(pluginWebView);
      }
      pluginWebView.setAttribute('src', '');
      setTimeout(() => {
        pluginWebView?.setAttribute('src', pluginViewerUrl);
      }, 50);
    }

    return () => {
      // 原 scope.$on('$destroy')：src 清空
      pluginWebView?.setAttribute('src', '');
    };
  }, [current?.id, pluginViewerUrl]);

  return <plugin-view id="plugin-viewer" ref={hostRef as any} />;
}

/* ---------------- web-view 指令移植（bundle 64240-64318） ---------------- */

function WebViewBranch({ snapshot }: { snapshot: DetailSnapshot }) {
  const hostRef = useRef<HTMLElement>(null);
  const { current, urlSrc } = snapshot;

  useEffect(() => {
    const element = hostRef.current;
    if (!element || !current) return;

    function init() {
      const isVideo = current!.medium !== undefined;
      const tagName = 'webview';
      let className = '';
      let referrer = '';
      if (isVideo) className = 'is-video';
      if (urlSrc.indexOf('youtube-nocookie.com') > -1) referrer = 'http://localhost/';
      const userAgent = (window as any).EagleConfig.USER_AGENT;

      element!.innerHTML = `<${tagName} id="url-viewer" class="${className}" allowpopups useragent="${userAgent}" httpreferrer="${referrer}"></${tagName}>`;

      const webview = (element as any).querySelector('webview');
      if (!webview) return;

      const remote = req('@electron/remote');
      const win = remote?.getCurrentWindow?.();
      win?.on('leave-full-screen', function () {
        webview.executeJavaScript(`document.exitFullscreen();`);
      });

      webview.addEventListener('enter-html-full-screen', () => {
        if ((window as any).process?.platform === 'darwin') {
          webview.executeJavaScript(`document.exitFullscreen();`);
        }
        scopeApply(getBodyScope(), (s) => {
          if (typeof s.toggleSlideshow === 'function') s.toggleSlideshow();
          s.$evalAsync?.();
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
  }, [current?.id, urlSrc]);

  return <web-view id={`webview-${current?.id}`} src={urlSrc} ref={hostRef as any} />;
}

/* ---------------- 视频/音频 tip 层 ---------------- */

function VideoPlayerTips() {
  return (
    <div id="video-player-tips" className="video-player-tips">
      <div className="tip volume">
        <div className="icon vol-0" />
        <div className="value">90</div>
      </div>
    </div>
  );
}

/* ---------------- 带错误重试的图 ---------------- */

function GifImg({ snapshot }: { snapshot: DetailSnapshot }) {
  const imgRef = useRef<HTMLImageElement>(null);
  useRetryWhenError(imgRef, 'raw', snapshot.current?.id);
  const cls = `${snapshot.zoomRatioExp >= 200 ? 'zoom-in' : ''} ${snapshot.renderPixelated ? 'pixelated' : ''}`;
  return <img id="detail-image" className={cls} src={snapshot.rawUrl} ref={imgRef} />;
}

function ThumbImg({ snapshot }: { snapshot: DetailSnapshot }) {
  const imgRef = useRef<HTMLImageElement>(null);
  useRetryWhenError(imgRef, 'thumb', snapshot.current?.id);
  return (
    <img
      id="detail-image"
      style={snapshot.showDetailImage ? undefined : { display: 'none' }}
      width={snapshot.current?.width}
      height={snapshot.current?.height}
      src={snapshot.lastestThumbnailUrl}
      ref={imgRef}
    />
  );
}

/* ---------------- 原生/MPV/音频播放器分支 ---------------- */

function NativeVideoBranch({ snapshot }: { snapshot: DetailSnapshot }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  useMediaElement(videoRef);
  return (
    <video className="video-js vjs-default-skin" controls ref={videoRef} src={snapshot.rawUrl}>
      <source src={snapshot.rawUrl} type="video/mp4" />
    </video>
  );
}

function MpvVideoBranch({ snapshot }: { snapshot: DetailSnapshot }) {
  const videoRef = useRef<HTMLElement>(null);
  useMpvMediaElement(videoRef, snapshot.current?.id);
  return <mpv-video controls controls-mode="always" autoplay src={snapshot.rawUrl} ref={videoRef as any} />;
}

function AudioBranch({ snapshot, m4a }: { snapshot: DetailSnapshot; m4a?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  useAudioMediaElement(videoRef);
  const ext = snapshot.current?.ext || '';
  return (
    <>
      <video className="video-js vjs-default-skin" controls ref={videoRef} src={snapshot.rawUrl}>
        <source src={snapshot.rawUrl} type={m4a ? 'audio/mp3' : `audio/${ext}`} />
      </video>
      <div id="detail-wavesurfer" />
    </>
  );
}

/* ---------------- tif/tga 查看图 ---------------- */

function TifImageEl({ snapshot }: { snapshot: DetailSnapshot }) {
  const imgRef = useRef<HTMLImageElement>(null);
  useTifImage(imgRef, snapshot.current?.id);
  return (
    <img
      tif-img=""
      id="detail-image"
      className={`${snapshot.zoomRatioExp >= 200 ? 'zoom-in' : ''} ${snapshot.renderPixelated ? 'pixelated' : ''}`}
      style={snapshot.showDetailImage ? undefined : { display: 'none' }}
      width={snapshot.current?.width}
      height={snapshot.current?.height}
      src={snapshot.thumbnailUrl}
      ref={imgRef}
    />
  );
}

function TgaImageEl({ snapshot }: { snapshot: DetailSnapshot }) {
  const imgRef = useRef<HTMLImageElement>(null);
  useTgaImage(imgRef, snapshot.current?.id);
  return (
    <img
      tga-img={snapshot.rawPath}
      id="detail-image"
      className={`${snapshot.zoomRatioExp >= 200 ? 'zoom-in' : ''} ${snapshot.renderPixelated ? 'pixelated' : ''}`}
      style={snapshot.showDetailImage ? undefined : { display: 'none' }}
      width={snapshot.current?.width}
      height={snapshot.current?.height}
      src={snapshot.thumbnailUrl}
      ref={imgRef}
    />
  );
}

/* ---------------- 裁切工具（crop-image 指令宿主） ---------------- */

function CropTool({ snapshot }: { snapshot: DetailSnapshot }) {
  const areaRef = useRef<HTMLDivElement>(null);
  useCropImage(areaRef, snapshot.isCropMode && snapshot.isDetailMode, snapshot.current?.id, snapshot.zoomRatio);
  return (
    <div id="crop-image-tool" className="crop-image-tool" crop-image="">
      <div className="crop-area" ref={areaRef}>
        <div
          id="crop-overlay"
          className="crop-overlay"
          style={{ width: snapshot.current?.width, height: snapshot.current?.height }}
        >
          <div className="overlay top" />
          <div className="overlay left" />
          <div className="overlay right" />
          <div className="overlay bottom" />
        </div>
      </div>
    </div>
  );
}

/* ---------------- 容器级 ng-class / 行为 hook ---------------- */

function useDetailNgClass(snapshot: DetailSnapshot) {
  const classMap: Record<string, boolean> = {
    'comment-mode': snapshot.isCommentMode,
    'hidden-footer':
      snapshot.isModelType ||
      snapshot.isUrlType ||
      snapshot.isPdf ||
      snapshot.current?.ext === 'txt' ||
      snapshot.isVideoType ||
      snapshot.isAudioType ||
      snapshot.isFontType,
    'is-model': snapshot.isModelType,
    'is-pdf': snapshot.isPdf,
    'is-font': snapshot.isFontType || snapshot.current?.ext === 'txt',
    'is-audio': snapshot.isAudioType,
    'is-url': snapshot.isUrlType,
    'is-video': snapshot.isVideoType,
    'is-plugin': snapshot.pluginIsViewer,
    'plugin-allow-zoom': snapshot.pluginIsViewer && snapshot.pluginAllowZoom,
    'no-effect': !snapshot.showDetailImage,
  };
  const deps = JSON.stringify(classMap) + snapshot.current?.id;
  useDetailContainerBehaviors(classMap, deps);
}

/* ---------------- #detail-container 内部（分支切换） ---------------- */

export function DetailContainerInterior({ snapshot }: { snapshot: DetailSnapshot }) {
  const {
    current,
    pluginExt,
    pluginAllowZoom,
    isCommentMode,
    isCropMode,
    isDetailMode,
    smoothZoomDone,
    showDetailImage,
    initDetailMode,
    useMpvPlayer,
    gifEnabled,
    inspectorRenaming,
    maxDimension,
  } = snapshot;

  const gestureRef = useRef<HTMLDivElement>(null);
  useMouseGesture(gestureRef, '.noSel');

  useDetailNgClass(snapshot);
  useRectComment(isCommentMode);

  // commentsContainer 的 ratio 重算（挂在容器级，任何分支都生效）
  useEffect(() => {
    recomputeCommentRatio();
  }, [current?.id, isCommentMode]);

  const ext = current?.ext || '';
  const w = current?.width || 0;
  const h = current?.height || 0;

  if (!current || !isDetailMode) {
    return null;
  }

  let branch: React.ReactNode = null;

  if (pluginExt === 'plugin') {
    branch = (
      <div className={`detail-wrap${!pluginAllowZoom ? ' fixed' : ''}`}>
        {!pluginAllowZoom && <PluginView snapshot={snapshot} />}
        {pluginAllowZoom && (
          <div className="image-wrap">
            <CommentsLayer snapshot={snapshot} withRect showWhenPositive />
            <div id="detail-image">
              <PluginView snapshot={snapshot} />
            </div>
          </div>
        )}
      </div>
    );
  } else if (pluginExt === 'pdf') {
    branch = (
      <div className={`detail-wrap fixed ${ext}`}>
        <iframe id="pdf-viewer" src={snapshot.pdfPath} />
      </div>
    );
  } else if (pluginExt === 'gif') {
    branch = (
      <div
        className={`detail-wrap ${ext}`}
        onMouseDown={(e) => {
          scopeApply(getBodyScope(), (sc) => {
            if (typeof sc.gifViewer?.mousedown === 'function') sc.gifViewer.mousedown(e);
          });
        }}
        onMouseUp={(e) => {
          scopeApply(getBodyScope(), (sc) => {
            if (typeof sc.gifViewer?.mouseup === 'function') sc.gifViewer.mouseup(e);
          });
        }}
      >
        <div className="image-wrap">
          <CommentsLayer snapshot={snapshot} withRect showWhenPositive />
          {gifEnabled && <iframe id="detail-image" className="gif-viewer" src={snapshot.gifPath} width={w} height={h} />}
          {!gifEnabled && <GifImg snapshot={snapshot} />}
        </div>
      </div>
    );
  } else if (RAW_EXTS.includes(ext)) {
    branch = (
      <div className={`detail-wrap ${ext}`}>
        <div className="image-wrap">
          <CommentsLayer snapshot={snapshot} withRect showWhenPositive />
          <div id="detail-image">
            <iframe className="raw-viewer" src={snapshot.rawViewerPath} width={w} height={h} />
          </div>
        </div>
      </div>
    );
  } else if (VIDEO_EXTS.includes(ext)) {
    branch = !inspectorRenaming && (
      <div className={`detail-wrap fixed ${ext}`} onDoubleClick={(e) => e.stopPropagation()}>
        <VideoPlayerTips />
        {!useMpvPlayer && initDetailMode && <NativeVideoBranch snapshot={snapshot} />}
        {useMpvPlayer && initDetailMode && <MpvVideoBranch snapshot={snapshot} />}
        <div className="not-support-preview" style={{ display: 'none' }}>
          <div className="not-support-preview-content">
            <img
              className="icon"
              style={{ width: 192, height: 144 }}
              src={`assets/images/${themePathOf(snapshot.theme)}/illustrations/not-supported-format.png`}
            />
            <div className="title">
              <span>{current.name}</span>.{ext}
            </div>
            <p className="desc" dangerouslySetInnerHTML={{ __html: t('pages.noPreview.video') }} />
            <div className="buttons">
              <div
                className="button button-xs button-grey"
                onDoubleClick={(e) => e.stopPropagation()}
                onClick={(e) => call('openItemContextMenu', e, current)(e)}
              >
                <img src={`assets/images/${themePathOf(snapshot.theme)}/icons/context-menu/ic-open-other.svg`} />
                {t('pages.tooBigPreview.button')}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  } else if (AUDIO_EXTS.includes(ext)) {
    branch = !inspectorRenaming && (
      <div className={`detail-wrap fixed ${ext}`} onDoubleClick={(e) => e.stopPropagation()}>
        <VideoPlayerTips />
        {initDetailMode && <AudioBranch snapshot={snapshot} />}
      </div>
    );
  } else if (ext === 'm4a') {
    branch = !inspectorRenaming && (
      <div className={`detail-wrap fixed ${ext}`} onDoubleClick={(e) => e.stopPropagation()}>
        <div id="video-player-tips" className="video-player-tips">
          <div className="tip volume">
            {t('videoplayer.volume')} : <div className="value">90</div>
          </div>
        </div>
        {initDetailMode && <AudioBranch snapshot={snapshot} m4a />}
      </div>
    );
  } else if (FONT_EXTS.includes(ext)) {
    branch = (
      <div className={`detail-wrap full ${ext}`}>
        <iframe id="font-viewer" src={snapshot.fontPath} />
      </div>
    );
  } else if (ext === 'txt') {
    branch = (
      <div className={`detail-wrap full ${ext}`}>
        <iframe id="text-editor" src={snapshot.txtPath} />
      </div>
    );
  } else if (ext === 'tif' || ext === 'tiff') {
    branch = (
      <div className={`detail-wrap${largeClass(w, h) ? ' large' : ''}${longClass(w, h) ? ' long' : ''}`}>
        <div className="image-wrap" style={!showDetailImage ? { display: 'none' } : undefined}>
          <CommentsLayer snapshot={snapshot} withRect showWhenPositive />
          <TifImageEl snapshot={snapshot} />
        </div>
      </div>
    );
  } else if (ext === 'tga') {
    branch = (
      <div className={`detail-wrap${largeClass(w, h) ? ' large' : ''}${longClass(w, h) ? ' long' : ''}`}>
        <div className="image-wrap" style={!showDetailImage ? { display: 'none' } : undefined}>
          <CommentsLayer snapshot={snapshot} withRect showWhenPositive />
          <TgaImageEl snapshot={snapshot} />
        </div>
      </div>
    );
  } else if (MODEL_EXTS.includes(ext)) {
    branch = (
      <div className={`detail-wrap fixed ${ext}`}>
        <iframe id="model-viewer" src={snapshot.modelPath} />
      </div>
    );
  } else if (SPECIAL_EXTS.includes(ext)) {
    branch = (
      <div className={`detail-wrap${largeClass(w, h) ? ' large' : ''}${longClass(w, h) ? ' long' : ''}`}>
        {!current.noPreview && (
          <div className="image-wrap" style={!showDetailImage ? { display: 'none' } : undefined}>
            <CommentsLayer snapshot={snapshot} withRect showWhenPositive />
            <iframe
              style={{ zIndex: 10, position: 'absolute', pointerEvents: 'none' }}
              src={snapshot.nativeViewerPath}
              width={w}
              height={h}
            />
            <ThumbImg snapshot={snapshot} />
          </div>
        )}
      </div>
    );
  } else if (pluginExt === 'custom') {
    branch = (
      <div className={`detail-wrap${largeClass(w, h) ? ' large' : ''}${longClass(w, h) ? ' long' : ''}`}>
        {!current.noPreview && (
          <div className="image-wrap" style={!showDetailImage ? { display: 'none' } : undefined}>
            <CommentsLayer snapshot={snapshot} withRect showWhenPositive />
            <ThumbImg snapshot={snapshot} />
          </div>
        )}
      </div>
    );
  } else if (URL_EXTS.includes(ext)) {
    branch = (
      <div className={`detail-wrap full ${ext}`}>
        <WebViewBranch snapshot={snapshot} />
      </div>
    );
  } else if (ext === 'svg') {
    branch = (
      <div className={`detail-wrap ${ext} movable bg-${current.background}`}>
        <div className="image-wrap">
          <div
            className="rect"
            style={ngShowStyle(!!(snapshot.commentRect?.w && snapshot.commentRect?.h), {
              width: snapshot.commentRect?.w,
              height: snapshot.commentRect?.h,
              top: snapshot.commentRect?.startY,
              left: snapshot.commentRect?.startX,
            })}
          />
          <CommentsLayer snapshot={snapshot} withRect={false} showWhenPositive={false} />
          <img id="detail-image" width={w} height={h} src={snapshot.rawUrl} />
        </div>
      </div>
    );
  } else if (pluginExt === 'image') {
    branch = (
      <div
        className={`detail-wrap ${ext} movable bg-${current.background}${largeClass(w, h) ? ' large' : ''}${
          longClass(w, h) ? ' long' : ''
        }`}
      >
        <div className="image-wrap">
          <div
            className="rect"
            style={ngShowStyle(!!(snapshot.commentRect?.w && snapshot.commentRect?.h), {
              width: snapshot.commentRect?.w,
              height: snapshot.commentRect?.h,
              top: snapshot.commentRect?.startY,
              left: snapshot.commentRect?.startX,
            })}
          />
          {isCropMode && isDetailMode && <CropTool snapshot={snapshot} />}
          <CommentsLayer snapshot={snapshot} withRect={false} showWhenPositive={false} />
          <img
            id="detail-image"
            width={w}
            height={h}
            src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAQSURBVHgBAQUA+v8AAAAAAAAFAAFkeJU4AAAAAElFTkSuQmCC"
            style={{ marginLeft: -2 }}
          />
        </div>
      </div>
    );
  }

  return (
    <>
      <input id="comment-blur" type="" name="" style={{ opacity: 0, position: 'absolute', zIndex: -1 }} />
      {smoothZoomDone && <div ref={gestureRef} />}
      {branch}
      {/* NOTE: 避免 zoomer 沒有任何圖片初始化會造成 zoomming 功能異常，因此這裡強制給一張圖 */}
      <img
        style={{ opacity: 0, pointerEvents: 'none' }}
        src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAQSURBVHgBAQUA+v8AAAAAAAAFAAFkeJU4AAAAAElFTkSuQmCC"
      />
    </>
  );
}
