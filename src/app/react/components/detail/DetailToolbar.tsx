import React, { useEffect, useRef, useState } from 'react';
import { useDetailState, DetailSnapshot } from '../../store/detailState';
import { useToolbarState } from '../../store/toolbarState';
import { getBodyScope, scopeApply } from '../../global/scopeBridge';
import { t } from '../../global/eagleGlobals';
import { shortcuts, shortcutsWrapper } from '../../app/filters';
import { useTippy } from '../hooks';
import { CornerBtns } from '../toolbar/Toolbar';
import { getCurrentWindow, $ } from './detailHooks';
import { req } from './detailHooks';
import { useMouseGesture } from './detailHooks';

/**
 * 阶段5：详情模式工具列/悬浮层 —— index.html 391-634 行逐字转写。
 * （面包屑、缩放滑条、webview-toolbar、裁切工具列、插件工具列、通用工具列、
 * corner-btns、gif footbar、is-last/first tips、too-big 预览、inline 工具列）
 */

const themePathOf = (theme: string) => (theme === 'light' || theme === 'lightgray' ? 'light' : 'dark');
const iconSrc = (theme: string, icon: string) => `assets/images/${themePathOf(theme)}/icons/${icon}`;

const call = (fn: string, ...preArgs: any[]) => (e?: any) =>
  scopeApply(getBodyScope(), (scope) => {
    if (typeof scope[fn] === 'function') scope[fn](...(preArgs.length ? preArgs : e === undefined ? [] : [e]));
  });

/* ---------------- webview-toolbar 指令（bundle:64319 + 模板逐字） ---------------- */

export function WebviewToolbar({ snapshot, webviewId }: { snapshot: DetailSnapshot; webviewId: string }) {
  const { theme } = snapshot;
  const [control, setControl] = useState<any>(null);
  const controlRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    // 原 attrs.$observe('webviewId') → $timeout(init, 200)
    const timer = setTimeout(() => {
      if (cancelled) return;
      const webview = document.querySelector(`#${webviewId} webview`) as any;
      if (!webview) return;

      const wc: any = {
        getTitle: () => webview.getTitle(),
        getURL: () => webview.getURL(),
        favicon: webview.favicon,
        canGoBack: () => webview.canGoBack(),
        canGoForward: () => webview.canGoForward(),
        isLoading: () => webview.isLoading(),
        stop: () => webview.stop(),
        reload: () => webview.reload(),
        goBack: () => webview.goBack(),
        goForward: () => webview.goForward(),
        openExternal: () => req('electron').shell.openExternal(webview.src),
        copyURL: () => req('electron').clipboard.writeText(webview.src),
      };

      const onTitle = (e: any) => {
        wc.title = e.title;
        wc.url = webview.getURL();
        setControl({ ...wc });
      };
      const onFavicon = (e: any) => {
        wc.favicon = e.favicons[0];
        setControl({ ...wc });
      };
      webview.addEventListener('page-title-updated', onTitle);
      webview.addEventListener('page-favicon-updated', onFavicon);

      controlRef.current = wc;
      setControl({ ...wc });
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [webviewId]);

  const goBack = () => controlRef.current?.goBack();
  const goForward = () => controlRef.current?.goForward();
  const reload = () => controlRef.current?.reload();
  const openExternal = () => controlRef.current?.openExternal();
  const copyURL = () => controlRef.current?.copyURL();

  return (
    <div className="webview-toolbar" style={{ margin: '0 8px' }}>
      <div className="left-panel">
        <div
          className={`ic-btn backward-btn${control && !control.canGoBack() ? ' disabled' : ''}`}
          tippy=""
          tippy-placement="bottom"
          tippy-content={t('webview.goback')}
          onClick={goBack}
        >
          <img src={iconSrc(theme, 'webview/ic-webview-backward.svg')} />
        </div>
        <div
          className={`ic-btn forward-btn${control && !control.canGoForward() ? ' disabled' : ''}`}
          tippy=""
          tippy-placement="bottom"
          tippy-content={t('webview.goforward')}
          onClick={goForward}
        >
          <img src={iconSrc(theme, 'webview/ic-webview-forward.svg')} />
        </div>
        <div className="ic-btn reload-btn" tippy="" tippy-placement="bottom" tippy-content={t('webview.reload')} onClick={reload}>
          <img src={iconSrc(theme, 'webview/ic-webview-refresh.svg')} />
        </div>
        <div
          className="ic-btn open-external-btn"
          tippy=""
          tippy-placement="bottom"
          tippy-content={t('webview.openInBrowser')}
          onClick={openExternal}
        >
          <img src={iconSrc(theme, 'webview/ic-webview-open-external.svg')} />
        </div>
      </div>
      <div className="separator" />
      <div className="center-panel">
        <div className="favicon" style={{ backgroundImage: `url(${control?.favicon || ''})` }} />
        <div className="title" tippy="" tippy-placement="bottom" tippy-content={control?.getTitle?.() || ''}>
          {control?.getTitle?.() || ''}
        </div>
        <div className="url" tippy="" tippy-placement="bottom" tippy-content={control?.getURL?.() || ''}>
          {control?.getURL?.() || ''}
        </div>
      </div>
      <div className="right-panel">
        <div className="ic-btn copy-url-btn" tippy="" tippy-placement="bottom" tippy-content={t('webview.copyUrl')} onClick={copyURL}>
          <img src={iconSrc(theme, 'webview/ic-webview-copy-url.svg')} />
        </div>
      </div>
    </div>
  );
}

/* ---------------- 详情工具列（index.html 391-540 逐字） ---------------- */

export function DetailToolbar({ snapshot }: { snapshot: DetailSnapshot }) {
  const toolbarSnapshot = useToolbarState((s: any) => s.snapshot);
  const {
    theme,
    keybinds,
    current,
    allDataCount,
    currentIndex,
    sliderZoomRatio,
    zoomRatioExp,
    isInlineMode,
    isDetailMode,
    isCropMode,
    isCommentMode,
    isGif,
    usingGifPlayer,
    supportRotate,
    supportCrop,
    pluginIsViewer,
    pluginAllowZoom,
    isUrlType,
    isFontType,
    isVideoType,
    isAudioType,
    isModelType,
    isPdf,
    disableZoom,
    pinnedPlugins,
    needUpdatePluginCount,
    inspectorHide,
    viewMode,
  } = snapshot;

  const ext = current?.ext || '';
  const isImgFlipExt = ['jpg', 'png', 'webp', 'bmp', 'avif'].includes(ext);
  const isImgRotateExt = ['jpg', 'png', 'webp', 'bmp'].includes(ext);
  const isCropableExt = ['jpg', 'png', 'webp'].includes(ext);
  const showSlidersBar =
    !isInlineMode && isDetailMode && !isUrlType && !isFontType && !isVideoType && !isAudioType && (!pluginIsViewer || pluginAllowZoom);
  const showSlider =
    !(disableZoom || isFontType || isVideoType || isAudioType || isModelType || ext === 'pdf');
  const showPluginRight = pluginIsViewer && !pluginAllowZoom;
  const showGeneralRight = !isCropMode && (!pluginIsViewer || pluginAllowZoom);
  const commentsCount = current?.comments?.length || 0;

  const toolbarRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef<HTMLDivElement>(null);
  useTippy(toolbarRef, JSON.stringify([current?.id, isCommentMode, usingGifPlayer, zoomRatioExp, theme, pinnedPlugins.length]));

  useEffect(() => {
    // pinned-plugins ui-sortable（angular-ui-sortable 语义：拖拽结束后按 DOM 顺序回写 model）
    const el = pinnedRef.current;
    if (!el) return;
    const jQuery = $();
    if (!jQuery) return;
    jQuery(el).sortable({
      update: () => {
        scopeApply(getBodyScope(), (s) => {
          const order = jQuery(el).sortable('toArray', { attribute: 'data-plugin-index' }).map(Number);
          const plugins = s.pluginModule.pinnedPlugins || [];
          s.pluginModule.pinnedPlugins = order.map((i: number) => plugins[i]).filter(Boolean);
        });
      },
    });
    return () => {
      try {
        jQuery(el).sortable('destroy');
      } catch {}
    };
  }, [pinnedPlugins.length]);

  const stopDbl = (e: any) => e.stopPropagation();

  return (
    <div className="toolbar has-border" ref={toolbarRef} onDoubleClick={(e) => { e.stopPropagation(); call('maximize')(e); }}>
      {/* 麵包削 */}
      <div className="breadcrumbs" style={{ minWidth: 24 }} onDoubleClick={stopDbl}>
        <div
          id="toggle-all-btn"
          className="ic-btn"
          onContextMenu={call('openSidebarMenu')}
          onClick={call('toggleAll')}
        >
          <img src={iconSrc(theme, 'ic_toggle-sidebar.svg')} />
        </div>
        <div
          className="ic-btn prev no-padding"
          tippy=""
          tippy-content={`${t('toolbar.exitBtn')}<key>ESC</key>`}
          tippy-placement="bottom"
          onClick={call('leaveDetailMode')}
        >
          <img src={iconSrc(theme, 'ic-toolbar-exit.svg')} />
        </div>
        <ul style={{ maxWidth: 'initial' }}>
          <li className="show" style={{ marginLeft: 5 }}>
            <div className="counter">
              {currentIndex} / {allDataCount}
            </div>
          </li>
        </ul>
      </div>

      {/* 圖片放大縮小滑塊 */}
      <div className="sliders-bar center long" onDoubleClick={stopDbl} style={showSlidersBar ? undefined : { display: 'none' }}>
        <div className="slider" style={showSlider ? undefined : { display: 'none' }}>
          <div className="range-wrap">
            <div className="range-progressbar">
              <div className="current" style={{ width: `${((sliderZoomRatio / 200) * 100).toFixed(4)}%` }} />
            </div>
            <input
              id="detail-slider-ratio"
              className="range"
              type="range"
              name="points"
              min={5}
              max={200}
              tabIndex={-1}
              value={sliderZoomRatio}
              onChange={(e) => {
                const value = Number(e.target.value);
                scopeApply(getBodyScope(), (s) => {
                  s.sliderZoomRatio = value;
                });
              }}
            />
          </div>
          <div
            className="ic-btn"
            onContextMenu={call('toggleRatioContextMenu')}
            onMouseUp={(e) => e.stopPropagation()}
            onClick={call('openRatioContextMenu')}
          >
            {Number.isFinite(zoomRatioExp) ? Math.round(zoomRatioExp).toLocaleString('en-US') : zoomRatioExp}%
          </div>
        </div>
      </div>

      {/* 書籤工具列 */}
      {isDetailMode && isUrlType && current && <WebviewToolbar snapshot={snapshot} webviewId={`webview-${current.id}`} />}

      {/* 裁切模式工具列 */}
      {isCropMode && (
        <div className="right" onDoubleClick={stopDbl}>
          <input id="crop-width" type="number" placeholder={t('general.w')} />
          <input id="crop-height" type="number" placeholder={t('general.h')} style={{ marginRight: 12 }} />
          <div className="ic-btn has-padding primary" onClick={call('saveCrop')}>
            {t('toolbar.cropSaveBtn')}
          </div>
          <div className="ic-btn has-padding" onClick={(e) => call('saveCrop', true)(e)}>
            {t('toolbar.cropSaveAs')}
          </div>
          <div className="ic-btn has-padding" onClick={call('cancelCrop')}>
            {t('general.cancel')}
          </div>
        </div>
      )}

      {/* 插件工具列 */}
      {showPluginRight && (
        <div className="right" onDoubleClick={stopDbl}>
          <div className={`ic-btn prev no-padding${currentIndex == 1 ? ' disabled' : ''}`} onClick={call('selectPrev')}>
            <img src={iconSrc(theme, 'ic-toolbar-prev.svg')} />
          </div>
          <div
            className={`ic-btn next no-padding${currentIndex == allDataCount ? ' disabled' : ''}`}
            onClick={call('selectNext')}
          >
            <img src={iconSrc(theme, 'ic-toolbar-next.svg')} />
          </div>
        </div>
      )}

      {/* 通用工具列 */}
      {showGeneralRight && (
        <div className="right" onDoubleClick={stopDbl}>
          {/* 置頂插件 */}
          {pinnedPlugins.length > 0 ? (
            <div className="pinned-plugins" ref={pinnedRef}>
              {pinnedPlugins.map((plugin, i) => (
                <div
                  key={i}
                  data-plugin-index={i}
                  className="ic-btn"
                  tippy=""
                  tippy-content={plugin.name || ''}
                  tippy-placement="bottom"
                  onClick={() => {
                    const live = getBodyScope()?.pluginModule?.pinnedPlugins?.[i];
                    if (live) scopeApply(getBodyScope(), (s) => s.pluginModule.open(live));
                  }}
                >
                  <img width={20} height={20} src={plugin.icon} />
                </div>
              ))}
            </div>
          ) : null}

          <div
            className="ic-btn filter-btn no-padding"
            tippy=""
            tippy-content={`${t('general.plugin')} <key>P</key>`}
            tippy-placement="bottom"
            style={viewMode === 'alltags' ? { display: 'none' } : undefined}
            onClick={call('openPluginPanel')}
          >
            <img src={iconSrc(theme, 'ic-toolbar-plugin.svg')} />
            {needUpdatePluginCount > 0 && <div className="badge-count" />}
          </div>

          {/* 影片工具 */}
          {isVideoType && (
            <div
              className="ic-btn"
              tippy=""
              tippy-content={`${t('toolbar.openInDefaultBtn')}${shortcuts(shortcutsWrapper(keybinds['view.file.opendefault'] || ''))}`}
              tippy-placement="bottom"
              onClick={(e) => call('openFileWithDefault', current)(e)}
            >
              <img src={iconSrc(theme, 'ic-toolbar-open-default.svg')} />
            </div>
          )}
          {isVideoType && (
            <div
              className="ic-btn"
              tippy=""
              tippy-content={`${t('toolbar.flipBtnHint')}${shortcuts(shortcutsWrapper(keybinds['edit.image.flip'] || ''))}`}
              tippy-placement="bottom"
              onClick={(e) => call('flipVideo', e, current)(e)}
            >
              <img src={iconSrc(theme, 'ic-toolbar-flip.svg')} />
            </div>
          )}
          {isVideoType && (
            <div
              className="ic-btn"
              tippy=""
              tippy-placement="bottom"
              tippy-content={`${t('toolbar.rotateBtnHint')}${shortcuts(shortcutsWrapper(keybinds['edit.image.rotate'] || ''))}`}
              onClick={(e) => call('rotateVideo', e, current)(e)}
            >
              <img src={iconSrc(theme, 'ic-toolbar-rotate.svg')} />
            </div>
          )}

          {/* 逐帧播放 */}
          <div
            className={`ic-btn${usingGifPlayer ? ' active' : ''}`}
            onClick={call('toggleGifPlayerMode')}
            tippy=""
            tippy-placement="bottom"
            tippy-content={t('gifViewer.enableBtn')}
            style={!isGif ? { display: 'none' } : undefined}
          >
            <img src={iconSrc(theme, 'ic-toolbar-gif-frames.svg')} />
          </div>
          {/* 标注模式 */}
          <div
            onDoubleClick={stopDbl}
            className={`ic-btn${isCommentMode ? ' active' : ''}`}
            style={{ cursor: 'context-menu', ...(isHideAnnotation(ext, snapshot) ? { display: 'none' } : null) }}
            tippy=""
            tippy-placement="bottom"
            tippy-content={`${t('general.viewMode.annotation')}<key>C</key>`}
            onClick={call('toggleCommentMode')}
          >
            <img src={iconSrc(theme, 'ic-toolbar-comment.svg')} />
            {commentsCount > 0 && <div className="badge">{commentsCount}</div>}
          </div>

          {isImgFlipExt && (
            <div
              className={`ic-btn${!supportRotate ? ' disabled' : ''}`}
              tippy=""
              tippy-placement="bottom"
              tippy-content={`${t('toolbar.flipBtnHint')}${shortcuts('<key>Shift</key><key>F</key>')}`}
              onClick={(e) => call('flipImage', e, current, true)(e)}
            >
              <img src={iconSrc(theme, 'ic-toolbar-flip.svg')} />
            </div>
          )}
          {/* 旋轉 */}
          {isImgRotateExt && (
            <div
              className={`ic-btn${!supportRotate ? ' disabled' : ''}`}
              tippy=""
              tippy-placement="bottom"
              tippy-content={`${t('toolbar.rotateBtnHint')}${shortcuts('<key>Shift</key><key>R</key>')}`}
              onClick={(e) => call('rotateImage', e, current)(e)}
            >
              <img src={iconSrc(theme, 'ic-toolbar-rotate.svg')} />
            </div>
          )}
          {ext === 'avif' && (
            <div className="ic-btn disabled" tippy="" tippy-placement="bottom" tippy-content={t('toolbar.notSupport')}>
              <img src={iconSrc(theme, 'ic-toolbar-rotate.svg')} />
            </div>
          )}
          {/* 裁切按鈕（可互動） */}
          {isCropableExt && (
            <div
              className={`ic-btn${!supportCrop ? ' disabled' : ''}`}
              tippy=""
              tippy-placement="bottom"
              tippy-content={`${t('toolbar.cropBtnHint')}${shortcuts(shortcutsWrapper(keybinds['edit.image.crop'] || ''))}`}
              onClick={(e) => call('cropImage', e, current)(e)}
            >
              <img src={iconSrc(theme, 'ic-toolbar-crop.svg')} />
            </div>
          )}
          {ext === 'avif' && (
            <div className="ic-btn disabled" tippy="" tippy-placement="bottom" tippy-content={t('toolbar.notSupport')}>
              <img src={iconSrc(theme, 'ic-toolbar-crop.svg')} />
            </div>
          )}
          {!disableZoom && (
            <div
              className="ic-btn"
              tippy=""
              tippy-placement="bottom"
              tippy-content={`${t('toolbar.zoomActualBtn')}${shortcuts(shortcutsWrapper(keybinds['view.zoom.actual'] || ''))}`}
              onClick={call('zoomActual')}
            >
              <img src={iconSrc(theme, 'ic-toolbar-zoom-actual.svg')} />
            </div>
          )}
          <div
            className={`ic-btn${snapshot.lastZoomMode === 'edge' ? ' active' : ''}`}
            style={disableZoom ? { display: 'none' } : undefined}
            tippy=""
            tippy-placement="bottom"
            tippy-content={`${t('toolbar.zoomFitPage')}${shortcuts('<key>`</key>')}`}
            onClick={call('toggleZoom')}
          >
            <img src={iconSrc(theme, 'ic-toolbar-zoom-fit.svg')} />
          </div>
          <div className={`ic-btn prev no-padding${currentIndex == 1 ? ' disabled' : ''}`} onClick={call('selectPrev')}>
            <img src={iconSrc(theme, 'ic-toolbar-prev.svg')} />
          </div>
          <div
            className={`ic-btn next no-padding${currentIndex == allDataCount ? ' disabled' : ''}`}
            onClick={call('selectNext')}
          >
            <img src={iconSrc(theme, 'ic-toolbar-next.svg')} />
          </div>
        </div>
      )}

      {inspectorHide && (
        <CornerBtns
          snapshot={{
            ...(toolbarSnapshot as any),
            theme,
            keybinds,
            isAlwaysOnTop: toolbarSnapshot.isAlwaysOnTop,
            isMaximize: toolbarSnapshot.isMaximize,
            platform: toolbarSnapshot.platform,
          }}
        />
      )}
    </div>
  );
}

/** 标注按钮 ng-hide（index.html:486）。 */
function isHideAnnotation(ext: string, snapshot: DetailSnapshot): boolean {
  return (
    snapshot.isCropMode ||
    snapshot.isVideoType ||
    snapshot.isAudioType ||
    snapshot.isFontType ||
    snapshot.isModelType ||
    snapshot.isUrlType ||
    ext === 'pdf' ||
    ext === 'txt'
  );
}

/* ---------------- Gif 播放器工具列（index.html 542-587 逐字） ---------------- */

const GIF_SPEEDS = [8, 4, 3, 2, 1.75, 1.5, 1.25, 1, 0.75, 0.5, 0.25];

export function GifFootbar({ snapshot }: { snapshot: DetailSnapshot }) {
  const { theme, keybinds, isGif, isGifReady, gifPlaying, gifSpeed, gifEnabled } = snapshot;
  const footbarRef = useRef<HTMLDivElement>(null);
  useTippy(footbarRef, JSON.stringify([gifPlaying, gifSpeed, theme]));

  if (!(isGif && gifEnabled)) return null;

  return (
    <div className="footbar" onDoubleClick={(e) => e.stopPropagation()}>
      <div className="gif-toolbar in" style={!isGifReady ? { display: 'none' } : undefined}>
        {!gifPlaying && (
          <div
            className="gif-toolbar-btn play-btn"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              call('toggleGifPlay')(e);
            }}
          >
            <img src={iconSrc(theme, 'player/ic-toolbar-play.svg')} />
          </div>
        )}
        {gifPlaying && (
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
          >
            <img src={iconSrc(theme, 'player/ic-toolbar-pause.svg')} />
          </div>
        )}
        <div
          className="gif-toolbar-btn"
          tippy=""
          tippy-placement="top"
          tippy-content={`${t('appmenu.view>prevFrame')}${shortcuts(shortcutsWrapper(keybinds['player.prev1frame'] || ''))}`}
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
          tippy-content={`${t('appmenu.view>nextFrame')}${shortcuts(shortcutsWrapper(keybinds['player.next1frame'] || ''))}`}
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
          <span>1x</span>
          <div className="speed-menu">
            {GIF_SPEEDS.map((speed) => (
              <div
                key={speed}
                className={`speed-menu-itme${gifSpeed === speed ? ' active' : ''}`}
                onClick={(e) =>
                  scopeApply(getBodyScope(), (s) => {
                    if (typeof s.gifViewer?.setSpeed === 'function') s.gifViewer.setSpeed(speed);
                  })
                }
              >
                {speed}x
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
      <div className="gif-toolbar init" style={isGifReady ? { display: 'none' } : undefined}>
        <div className="progress-bar">
          <div className="bar" />
          <div className="current" style={{ width: '0%' }} />
        </div>
        <div className="message">
          {t('progress.loadGifViewer.msg')}(<span className="percent" />)
        </div>
      </div>
    </div>
  );
}

/* ---------------- not-support-preview 指令（bundle:61393 + 模板逐字） ---------------- */

export function NotSupportPreview({ snapshot }: { snapshot: DetailSnapshot }) {
  const { theme, current } = snapshot;
  if (!current) return null;
  const hasPlugin = ((): boolean => {
    try {
      const plugins = (window as any).PluginCenterFactory.getData().plugins;
      const pluginExtMap: Record<string, boolean> = {};
      plugins.forEach((plugin: any) => {
        plugin?.exts?.forEach((ext: string) => {
          pluginExtMap[ext] = true;
        });
      });
      return !!pluginExtMap[current.ext];
    } catch (err) {
      return false;
    }
  })();
  const openPluginCenter = () => {
    getCurrentWindow()?.webContents?.send('open-plugin-center-and-search', current.ext);
  };

  return (
    <div className="not-support-preview" id="not-support-preview">
      <div className="not-support-preview-content">
        <img
          className="icon"
          style={{ width: 192, height: 144 }}
          src={`assets/images/${themePathOf(theme)}/illustrations/not-supported-format.png`}
        />
        <div className="title">
          <span>{current.name}</span>.{current.ext}
        </div>
        <p className="desc" style={hasPlugin ? { display: 'none' } : undefined}>
          {t('pages.noPreview.desc')}
        </p>
        <p className="desc" style={!hasPlugin ? { display: 'none' } : undefined}>
          {t('pages.noPreview.plugin')}
        </p>
        <div className="buttons">
          <div
            className="button button-xs button-primary"
            style={hasPlugin ? undefined : { display: 'none' }}
            onDoubleClick={(e) => e.stopPropagation()}
            onClick={openPluginCenter}
          >
            <img src="assets/images/dark/icons/context-menu/ic-plugin.svg" />
            {t('pages.noPreview.downloadPlugin')}
          </div>
          <div
            className="button button-xs button-grey"
            onDoubleClick={(e) => e.stopPropagation()}
            onClick={(e) => call('openItemContextMenu', e, current)(e)}
          >
            <img src={`assets/images/${themePathOf(theme)}/icons/context-menu/ic-open-other.svg`} />
            {t('pages.noPreview.openOther')}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- too-big / tips / inline 工具列（index.html 589-634 逐字） ---------------- */

export function DetailFloatingBits({ snapshot }: { snapshot: DetailSnapshot }) {
  const { theme, current, isInlineMode, allDataCount, currentIndex, maxDimension } = snapshot;
  const ref = useRef<HTMLDivElement>(null);
  const tooBigRef = useRef<HTMLDivElement>(null);
  useTippy(ref, JSON.stringify([current?.id, isInlineMode]));
  useMouseGesture(tooBigRef);
  const ext = current?.ext || '';
  const tooBig =
    current &&
    !current.customThumbnail &&
    current.width * current.height > maxDimension &&
    ['tif', 'tiff', 'heic', 'heif', 'hif', 'tga'].includes(ext);

  return (
    <>
      <div id="is-last-item" className="image-player-tips">
        <div className="tip">{t('viewer.isLastItem')}</div>
      </div>

      <div id="is-first-item" className="image-player-tips">
        <div className="tip">{t('viewer.isFirstItem')}</div>
      </div>

      {/* 解析度过大无法预览的图 */}
      {tooBig && (
        <div className="not-support-preview" ref={tooBigRef}>
          <div className="not-support-preview-content">
            <div className="thumbnail">
              <img src={snapshot.thumbnailUrl} />
            </div>
            <div className="title">{t('pages.tooBigPreview.title')}</div>
            <p>
              {t('pages.tooBigPreview.desc1')} {Number(maxDimension).toLocaleString('en-US')} {t('pages.tooBigPreview.desc2')}
            </p>
            <div
              className="icon-btn active has-padding"
              onDoubleClick={(e) => e.stopPropagation()}
              onClick={(e) => call('openItemContextMenu', e, current)(e)}
            >
              {t('pages.tooBigPreview.button')}
            </div>
          </div>
        </div>
      )}

      {/* 无法预览的图 */}
      {current && !current.customThumbnail && snapshot.notSupportFormat && !snapshot.pluginIsViewer && (
        <NotSupportPreview snapshot={snapshot} />
      )}

      <div className="inline-toolbar" onDoubleClick={(e) => e.stopPropagation()} style={!isInlineMode ? { display: 'none' } : undefined}>
        <div
          className={`inline-toolbar-btn prev-btn${isInlineMode ? ' inline-mode' : ''}${currentIndex == 1 ? ' disabled' : ''}`}
          onClick={call('selectPrev')}
        >
          <img src={`assets/images/${themePathOf(theme)}/icons/ic-inline-prev-btn.svg`} />
        </div>
        <div className="inline-pages">
          <div className="curr">{currentIndex}</div>
          <img src={`assets/images/${themePathOf(theme)}/icons/ic-inline-mode-split.svg`} />
          <div className="total">{allDataCount}</div>
        </div>
        <div
          className={`inline-toolbar-btn next-btn${isInlineMode ? ' inline-mode' : ''}${currentIndex == allDataCount ? ' disabled' : ''}`}
          onClick={call('selectNext')}
        >
          <img src={`assets/images/${themePathOf(theme)}/icons/ic-inline-next-btn.svg`} />
        </div>
      </div>

      <div
        id="inline-close-btn"
        className="inline-float-btn"
        style={!isInlineMode ? { display: 'none' } : undefined}
        onClick={call('leaveDetailMode')}
        tippy=""
        tippy-content={`${t('toolbar.exitBtn')}<key>Space</key>`}
        tippy-placement="left"
      >
        <img src={`assets/images/${themePathOf(theme)}/icons/ic-inline-exit-btn.svg`} />
      </div>
    </>
  );
}
