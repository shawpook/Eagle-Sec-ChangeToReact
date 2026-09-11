import { FileUrlHelper } from '../../core/fileUrlHelper';
import { detailZoom } from '../../core/smoothZoomEngine';
import { useEffect } from 'react';
import { ipcRenderer } from '../../global/eagleGlobals';
import { updateZoomRatio } from '../../services/detailService';
import { addVideoComment, setAsVideoThumbnail, videoScreenShot } from '../../services/mediaService';
import { syncDetailFromScope, useDetailState } from '../../store/detailState';
import { useBodyState } from '../../store/bodyState';
import { getBodyScope, scopeApply } from '../../core/appCore';
import { machineryLeaveDetailMode, machineryOpenPluginPanel, machinerySelectNext, machinerySelectPrev } from '../../core/dataMachinery';
import { makeResizable } from '../interactions/resizable';
import { onDetailClick } from '../../services/selectionService';
import { openItemContextMenu } from '../../services/itemMenuService';
import { refreshVideoCommentsChannel } from '../../global/bus';
import { scopeEvalAsync } from '../../global/scopeShim';

/**
 * 阶段5：详情模式交互 hooks —— mediaElement/mpvMediaElement/audioMediaElement
 * （bundle 64843-66496）、mouseGesture（70837-71140）、rectSelect（72564-72799）
 * 与 #detail-container ng-class/ng-click 行为的逐字移植。
 *
 * 规范原则：
 * - 全局 jQuery/$、videojs、Mousetrap、videoHelper、FileUrlHelper、preferences、
 *   debounce/throttle/guid/AnnotationPreview 与旧版共用同一份（window 属性）。
 * - 事件回调一律调 getBodyScope() 上的同名函数；「scope.$parent.useMpvPlayer」
 *   写到 body scope（接管后该旗标的唯一消费方是 React 快照）。
 * - React 卸载等价旧 scope.$on('$destroy')；element.remove() 不做（节点归 React 管）。
 */

export const $: any = () => {
  const jQuery = (window as any).jQuery;
  // safeZoomData：smoothZoom('getZoomData') 的容错包装（插件未初始化时按 1:1 兜底，
  // 旧指令在未初始化时此处会抛错中断，兜底仅覆盖该异常路径）。
  if (jQuery && !jQuery.fn.safeZoomData) {
    jQuery.fn.safeZoomData = function (this: any) {
      try {
        return detailZoom()?.getZoomData();
      } catch (err) {
        return { ratio: 1, scaledX: 0, scaledY: 0 };
      }
    };
  }
  return jQuery;
};
export const jq = $;
export const videojs = () => (window as any).videojs;

export const req = (name: string): any => (window as any).require?.(name);
export const getIpc = (): any => req('electron')?.ipcRenderer || ipcRenderer();
export const getCurrentWindow = (): any =>
  req('electron')?.remote?.getCurrentWindow?.() || req('@electron/remote')?.getCurrentWindow?.();

/** 静态壳 #detail-container 上被剥掉的 Angular 行为的唯一宿主查找。 */
export const detailContainer = (): HTMLElement => document.getElementById('detail-container') as HTMLElement;

/* ------------------------------------------------------------------ */
/* mediaElement（bundle 64843-65684 逐字移植）                          */
/* ------------------------------------------------------------------ */

// b1-9bm：videopreview 原生监听清理注册表——dispose（原 jQuery 命名空间 off）与
// 视频重挂（原 .off().on() 链）统一走此摘除，杜绝 body 级监听泄漏。
let videopreviewCleanups: Array<() => void> = [];
function clearVideopreviewListeners(): void {
  const pending = videopreviewCleanups;
  videopreviewCleanups = [];
  pending.forEach((fn) => {
    try { fn(); } catch (err) { /* noop */ }
  });
}

export function useMediaElement(videoRef: React.RefObject<HTMLVideoElement | null>) {
  useEffect(() => {
    const video = videoRef.current as HTMLVideoElement;
    if (!videoRef.current) return;
    const isInPreviewWindow = $()('#preview-window').length > 0;
    const ipc = getIpc();
    const scope = getBodyScope();
    const $parentScope = getBodyScope();
    let player: any;
    const element = $()(video);

    const volume = localStorage.getItem('eagle.videoPlayer.volume') || '100';
    video.volume = parseInt(volume) / 100;

    let minCurrentTime: number | undefined;
    let maxCurrentTime: number | undefined;

    if ($()('div.video-js').length > 0) {
      videojs()($()('div.video-js')[0]).dispose();
      return;
    }

    const cleanups: Array<() => void> = [];

    // 原 scope.$on('$destroy', ...)
    cleanups.push(() => {
      try {
        videojs()(element[0]).dispose();

        const videos = [element[0]];
        element.find('video').each(function (this: any, index: number, v: HTMLVideoElement) {
          videos.push(v);
        });

        videos.forEach(function (v: HTMLVideoElement) {
          v.src = 'file://';
          v.load();
        });

        element.off();
        // element.remove() 不做：节点由 React 管理
        clearVideopreviewListeners();
        if ($()('#not-support-preview').length > 0) {
          $()('#not-support-preview').css('display', '');
        }
      } catch (err) {}
    });

    function initToolbarBtn() {
      document.querySelectorAll('.vjs-button[title]').forEach((el: any) => {
        const attrs = el.attributes;
        let title = attrs.title.value;
        title = (window as any).i18n ? shortcutsOf(title) : title;

        el.removeAttribute('title');

        if (el.hasAttribute('data-tippy')) return;
        (window as any).tippy(el, {
          animation: 'scale',
          arrow: false,
          content: title,
          placement: 'top',
          allowHTML: true,
        });
      });
    }

    function initComments() {
      $()('.vjs-progress-control .video-comments').empty();
      const current = getBodyScope()?.current;
      if (current && current.comments && current.comments.length > 0) {
        const $container = $()('.vjs-progress-control');
        const $comments = $()(`<div class="video-comments"></div>`);

        current.comments.forEach(function (comment: any) {
          const leftP = (comment.duration / video.duration) * 100;
          const $comment = $()(
            `<div comment-id="${comment.id}" class="video-comment" style="left: ${leftP}%;"><div class="annotation"><div>${comment.annotation}</div></div></div>`
          );
          $comments.append($comment);
        });

        $container.append($comments);
      }
    }

    function initShortcuts() {
      const keybinds = (window as any).preferences.shortcuts.keybinds;
      const playbackRates = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 3, 4, 8];
      const frameTime = 0.04166667;
      const bodyScope = getBodyScope();

      const shortcutHandlerMap: Record<string, () => void> = {
        'player.volume.increase': () => {
          video.volume = Math.min(1, video.volume + 0.05);
        },
        'player.volume.decrease': () => {
          video.volume = Math.max(0, video.volume - 0.05);
        },
        'player.prev1frame': () => {
          video.currentTime -= (video as any).frameTime || frameTime;
        },
        'player.next1frame': () => {
          video.currentTime += (video as any).frameTime || frameTime;
        },
        'player.prev10frame': () => {
          video.currentTime -= ((video as any).frameTime || frameTime) * 10;
        },
        'player.next10frame': () => {
          video.currentTime += ((video as any).frameTime || frameTime) * 10;
        },
        'player.step.forward': () => {
          const duration = video.duration || 0;
          const ratio = 0.02;
          const maxStep = 10;
          const step = Math.min(duration * ratio, maxStep);
          video.currentTime += step;
        },
        'player.step.backward': () => {
          const duration = video.duration || 0;
          const ratio = 0.02;
          const maxStep = 10;
          const step = Math.min(duration * ratio, maxStep);
          video.currentTime -= step;
        },
        'player.speed.up': () => {
          const idx = playbackRates.indexOf(video.playbackRate);
          if (idx > -1 && playbackRates[idx + 1]) video.playbackRate = playbackRates[idx + 1];
        },
        'player.speed.down': () => {
          const idx = playbackRates.indexOf(video.playbackRate);
          if (idx > 0) video.playbackRate = playbackRates[idx - 1];
        },
        'player.playAndPause': () => {
          if (!video.paused) {
            video.pause();
          } else {
            video.play();
          }
        },
        'player.thumbnail.set': () => {
          setAsVideoThumbnail();
        },
        'player.thumbnail.copy': () => {
          videoScreenShot(true);
        },
        'player.thumbnail.save': () => {
          videoScreenShot();
        },
      };

      function applyWrapper(func: (event?: any) => void) {
        return (window as any).throttle(function (event: any) {
          event && event.preventDefault();
          func(event);
          scopeEvalAsync();
        }, 24);
      }

      for (const [name, electronKey] of Object.entries(keybinds)) {
        if (shortcutHandlerMap[name] && electronKey) {
          const key = (window as any).ShortcutManager.electronToMousetrap(electronKey);
          if (bodyScope.isInlineMode && key === 'space') return;
          if (key) {
            (window as any).Mousetrap.unbind(key);
            (window as any).Mousetrap.bind(key, applyWrapper(shortcutHandlerMap[name]));
          }
        }
      }
    }

    const offRefresh = refreshVideoCommentsChannel.on(function () {
      initComments();
    });
    cleanups.push(() => offRefresh());

    element.bind(
      'error',
      (window as any).debounce(function (event: any) {
        try {
          console.log('[mediaElement] Video playback error:', event.target.error);
          const oldPath = element[0].currentSrc;
          const current = getBodyScope()?.current;
          const newPath = current ? FileUrlHelper.getRawUrl(current) : '';
          if (oldPath !== newPath) {
            setTimeout(function () {
              element.attr('src', newPath);
            }, 200);
            return;
          }
          console.log('[mediaElement] Falling back to MPV player');
          scopeApply(getBodyScope(), function (s) {
            s.useMpvPlayer = true;
            syncDetailFromScope();
          });
        } catch (err) {}
      }, 100, true)
    );

    let initVideoJS = false;

    let avgFPS = 0;
    let lastFrameTime: number | undefined;
    let isPaused = false;
    let frameRendered = false;

    const frameCounter = (time: number, metadata: any) => {
      frameRendered = true;
      (video as any).requestVideoFrameCallback(frameCounter);
      if (isPaused) return;
      if (lastFrameTime !== undefined && lastFrameTime > 0) {
        const frameTime = (time - (lastFrameTime as number)) / 1000;
        if (frameTime) {
          if ((video as any).frameTime) {
            (video as any).frameTime = ((video as any).frameTime + frameTime) / 2;
          } else {
            (video as any).frameTime = frameTime;
          }
          (video as any).fps = 1000 / ((video as any).frameTime * 1000);
        }
      }
      lastFrameTime = time;
    };

    const onPause = () => {
      isPaused = true;
      lastFrameTime = 0;
      setTimeout(() => {
        document.querySelectorAll('.vjs-control-bar .vjs-button[title]').forEach((el: any) => {
          el.removeAttribute('title');
        });
      }, 300);
    };
    const onPlay = () => {
      isPaused = false;
      setTimeout(() => {
        document.querySelectorAll('.vjs-control-bar .vjs-button[title]').forEach((el: any) => {
          el.removeAttribute('title');
        });
      }, 300);
    };
    video.addEventListener('pause', onPause);
    video.addEventListener('play', onPlay);
    cleanups.push(() => {
      video.removeEventListener('pause', onPause);
      video.removeEventListener('play', onPlay);
    });

    const onEnded = function () {
      if ((video as any).customizeLoop) {
        video.currentTime = 0;
        setTimeout(function () {
          video.play();
        }, 50);
      } else if (minCurrentTime !== 0) {
        video.pause();
      }
    };
    video.addEventListener('ended', onEnded);
    cleanups.push(() => video.removeEventListener('ended', onEnded));

    const onLoadedMetadata = function () {
      (video as any).cancelVideoFrameCallback?.(frameCounter);
      (video as any).requestVideoFrameCallback(frameCounter);

      console.log('loadedmetadata');

      // 偵測無法播放的影片：metadata 載入但無法解碼
      if ((!video.videoWidth && !video.videoHeight) || !isFinite(video.duration) || video.duration <= 0) {
        console.log('[mediaElement] Unplayable video detected (no dimensions or duration), falling back to MPV');
        scopeApply(getBodyScope(), function (s) {
          s.useMpvPlayer = true;
          syncDetailFromScope();
        });
        return;
      }

      // 情況 2：metadata 看似正常但實際無法解碼（黑屏）→ 延遲偵測
      frameRendered = false;
      const frameCheckTimeout = setTimeout(function () {
        if (!frameRendered && !video.paused) {
          console.log('[mediaElement] No frames rendered during playback, falling back to MPV');
          scopeApply(getBodyScope(), function (s) {
            s.useMpvPlayer = true;
            syncDetailFromScope();
          });
        }
      }, 1500);
      cleanups.push(() => clearTimeout(frameCheckTimeout));

      element.find('~ .not-support-preview').hide();

      minCurrentTime = 0;
      maxCurrentTime = video.duration;

      const volume2 = localStorage.getItem('eagle.videoPlayer.volume') || '100';
      video.volume = parseInt(volume2) / 100;

      if (video.videoHeight) {
        $()(video).css({
          'max-width': video.videoWidth,
          'max-height': video.videoHeight,
        });
      }

      const currentTime = getBodyScope()?.current
        ? localStorage.getItem('eagle.videoPlayer.currentTime.' + getBodyScope().current.id)
        : undefined;
      const rootPreferences = (getBodyScope()?.$root?.preferences || {}) as any;
      const autoPlay = rootPreferences.video?.autoPlay != 'false';
      const zoomFill = rootPreferences.video?.zoomFill != 'false';
      const rememberPosition = rootPreferences.video?.rememberPosition != 'false';
      const loopShortVideo = rootPreferences.video?.loopShortVideo != 'false';
      const duration = video.duration;
      const src = video.src;

      if (loopShortVideo && video.duration <= 30) {
        (video as any).customizeLoop = true;
      } else {
        (video as any).customizeLoop = localStorage.getItem('eagle.videoPlayer.loop') === 'true';
      }

      if (rememberPosition && currentTime) {
        video.currentTime = parseFloat(currentTime);
      }

      if (initVideoJS) {
        if (autoPlay) {
          video.play();
        } else {
          video.pause();
        }

        if (!zoomFill) {
          $()(video).addClass('fit');
        } else {
          $()(video).removeClass('fit');
        }

        if ((video as any).customizeLoop) {
          $()('.vjs-icon-loop').addClass('enabled');
        } else {
          $()('.vjs-icon-loop').removeClass('enabled');
        }

        initTrack();
        initComments();
        setTimeout(function () {
          initThumbnailPewivew();
        }, 500);

        return;
      }

      function initResizer() {
        const $container = $()('.vjs-progress-control');
        const resizableBar = document.createElement('div');
        resizableBar.className = 'resize-bar';
        resizableBar.innerHTML = '<div class="bar"></div>';
        const $resizableBar = $()(resizableBar);
        $resizableBar.css({
          left: 0,
          width: 'auto',
        });
        // D-2f：jQuery-UI resizable → 自研
        makeResizable(resizableBar, {
          minWidth: 2,
          handles: 'e, w',
          containment: '.vjs-progress-control',
          start: function () {
            minCurrentTime = 0;
            maxCurrentTime = video.duration;
            $()('.vjs-progress-holder').css('pointer-events', 'none');
          },
          stop: function (event: any, ui: any) {
            $()('.vjs-progress-holder').css('pointer-events', 'initial');

            const resizerLeft = ui.position.left;
            const resizerWidth = ui.size.width;
            const progressWith = $()('.vjs-progress-holder').width();
            const resizerLeftP = (resizerLeft / progressWith) * 100;
            const resizerWidthP = (resizerWidth / progressWith) * 100;

            $resizableBar.css({
              left: `${resizerLeftP}%`,
              width: `${resizerWidthP}%`,
            });

            minCurrentTime = Number((video.duration * resizerLeftP) / 100);
            maxCurrentTime = (video.duration * (resizerLeft + resizerWidth)) / progressWith;

            minCurrentTime = Number((minCurrentTime as number).toFixed(2));
          },
        });
        $container.append($resizableBar);
      }

      function initTrack() {
        const existsTracks = player.remoteTextTracks().tracks_;
        existsTracks.forEach(function (track: any) {
          player.textTracks().removeTrack(track);
        });
        element.find('track').remove();

        // 載入字幕
        const current = getBodyScope()?.current;
        if (!current) return;
        const fs = req('fs');
        const pathMod = req('path');
        const URL_MODULE = req((window as any).appRoot.path + '/my_modules/url');
        const videoPath = FileUrlHelper.getRawPath(current);
        const vttTrackPath = videoPath.replace(`.${current.ext}`, '.vtt');
        const vttTrackName = pathMod.basename(vttTrackPath);
        fs.exists(vttTrackPath, function (isExists: boolean) {
          if (!isExists) return;
          player.addRemoteTextTrack(
            {
              kind: 'captions',
              label: vttTrackName,
              srclang: 'en',
              src: URL_MODULE.pathToFileURL(vttTrackPath).href,
            },
            false
          );
          player.textTracks().tracks_[0].mode = 'showing';
        });

        const srtTrackPath = videoPath.replace(`.${current.ext}`, '.srt');
        const srtTrackName = pathMod.basename(srtTrackPath);
        fs.readFile(srtTrackPath, 'utf8', function (err: any, str: string) {
          if (!str) return;
          const vtt2srt = req((window as any).appRoot.path + '/my_modules/vtt2srt') || req((window as any).appRoot + '/my_modules/vtt2srt');
          vtt2srt(str).then(function (strUrl: string) {
            const options = {
              kind: 'captions',
              label: srtTrackName,
              srclang: 'en',
              src: strUrl,
            };
            player.addRemoteTextTrack(options, false);
            player.textTracks().tracks_[0].mode = 'showing';
          });
        });
      }

      clearVideopreviewListeners();
      function initThumbnailPewivew() {
        const $container = $()('.vjs-progress-holder.vjs-slider.vjs-slider-horizontal');
        const $thumbnailVideo = $()('<video/>', {
          id: 'video-preview-thumb',
          src: src,
          controls: false,
          autoplay: false,
          muted: true,
        });
        const $progressbar = $container.find('.vjs-slider-bar');
        $container.find('video').off().remove();
        $container.append($thumbnailVideo);
        const videoWidth = $thumbnailVideo.width();
        let updatePreviewTimeout: any;
        let startX: number | undefined;
        let offsetX: number | undefined;
        let originPaused: boolean | undefined;
        let isMouseDown = false;
        // b1-9bm：jQuery 命名空间事件 → 原生监听（清理注册表：dispose 与重挂时统一摘除；
        // pageX/offsetX/buttons 均为 MouseEvent 原生字段，语义零改动）
        const containerEl = $container[0] as HTMLElement;
        const progressBarEl = $progressbar[0] as HTMLElement;
        const thumbVideoEl = $thumbnailVideo[0] as HTMLElement;
        const onVp = (el: HTMLElement, type: 'mousedown' | 'mousemove' | 'mouseup', fn: (e: MouseEvent) => void) => {
          el.addEventListener(type, fn as EventListener);
          videopreviewCleanups.push(() => el.removeEventListener(type, fn as EventListener));
        };

        onVp(containerEl, 'mousedown', function (event: MouseEvent) {
            event.stopPropagation();
            startX = event.pageX;
            offsetX = event.offsetX;
            if (event.buttons === 1 || (event.buttons === undefined && event.which === 1)) {
              isMouseDown = true;
              originPaused = video.paused;
              if (!video.paused) {
                video.pause();
              }
            }
          });

        onVp(progressBarEl, 'mouseup', function () {
          startX = undefined;
          isMouseDown = false;
        });

        onVp(containerEl, 'mousemove', function (event: MouseEvent) {
          if (startX === undefined) {
            startX = event.pageX;
            offsetX = event.offsetX;
          }
        });

        const updateVideoPreview = function (event: any) {
          try {
            // clearTimeout(updatePreviewTimeout);
            const diff = event.pageX - (startX as number);
            let mouseX = (offsetX as number) + diff;
            const cw = $container.width();

            let mouseTime: number = duration;
            if (mouseTime > cw) mouseTime = cw;
            if (mouseX < 0) mouseX = 0;

            mouseTime = parseFloat(String(duration * (mouseX / cw)));
            let left = (mouseX / cw) * 100;

            if (left > 100) left = 100;
            if (left < 0) left = 0;

            if (mouseTime >= 0) {
              $thumbnailVideo.css('left', `${left}%`);
              if ((event.buttons === 1 || (event.buttons === undefined && event.which === 1)) && isMouseDown) {
                (window as any).videoHelper.setVideosCurrentTime([video, $thumbnailVideo[0]], Math.round(mouseTime));
                $progressbar.css('width', `${left}%`);
                if (Math.round(mouseTime) === 0 && left < 0.2) {
                  (window as any).videoHelper.setVideosCurrentTime([video, $thumbnailVideo[0]], Math.round(mouseTime));
                  $thumbnailVideo.css('left', `0%`);
                  $progressbar.css('width', `0%`);
                }
              } else {
                (window as any).videoHelper.setCurrentTime($thumbnailVideo[0], mouseTime);
              }
            }
          } catch (err) {}
          void updatePreviewTimeout;
          void videoWidth;
        };

        onVp(document.body, 'mousemove', function (event: MouseEvent) {
            if (startX === undefined) {
              return;
            }
            updateVideoPreview(event);
          });

        onVp(video, 'mousedown', function (event: MouseEvent) {
            startX = undefined;
            isMouseDown = false;
            updateVideoPreview(event);
          });

        document.querySelectorAll('.vjs-button').forEach((btn) => {
          onVp(btn as HTMLElement, 'mousedown', function () {
            startX = undefined;
            isMouseDown = false;
          });
        });

        onVp(document.body, 'mouseup', function (event: MouseEvent) {
            startX = undefined;
            isMouseDown = false;
            if (event.buttons === 0 || (event.buttons === undefined && event.which === 1)) {
              if (originPaused === false) {
                video.play();
              }
              originPaused = undefined;
            }
          });
      }

      initVideoJS = true;
      videojs()(video, {
        language: ((window as any).preferences && (window as any).preferences.general && (window as any).preferences.general.language) || 'en',
        loadingSpinner: false,
        volume: volume2,
        playbackRates: [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 3, 4, 8],
        disableSeekBar: true,
      }).ready(function (this: any) {
        if (!getBodyScope()?.isDetailMode) {
          return;
        }
        player = this;
        // Videojs bug，滑桿不會自動更新
        $()(player.el()).find('.vjs-volume-level').css('width', video.volume * 100 + '%');
        const $video = $()(video);
        const $playButton = $()(player.controlBar.playToggle.el_);
        const fullScreenButton = player.controlBar.fullscreenToggle.el_;
        const $fullScreenButton = $()(fullScreenButton).detach();
        const loopBtn = player.controlBar.addChild('button');

        if (!zoomFill) {
          $video.addClass('fit');
        } else {
          $video.removeClass('fit');
        }

        loopBtn.controlText(player.localize('Loop'));
        loopBtn.addClass('vjs-icon-loop');
        loopBtn.on('click', function () {
          (video as any).customizeLoop = !(video as any).customizeLoop;
          localStorage.setItem('eagle.videoPlayer.loop', (video as any).customizeLoop);
          updateLoopButton();
        });
        $fullScreenButton.insertAfter(loopBtn.el_);

        // 笔记按钮
        if (!isInPreviewWindow) {
          const noteBtn = player.controlBar.addChild('button');
          noteBtn.controlText(player.localize('Note'));
          noteBtn.addClass('vjs-icon-note');
          noteBtn.on('click', function () {
            video.pause();
            addVideoComment(getBodyScope()?.current, video);
          });
          const $noteBtn = $()(noteBtn.el_).detach();
          $noteBtn.insertBefore($fullScreenButton);
        }

        // 快進退按鈕，壓住不放會持續觸發
        const forwardBtn = player.controlBar.addChild('button');
        forwardBtn.controlText(player.localize('Forward'));
        forwardBtn.addClass('vjs-icon-forward');

        let forwardInterval: any;
        function forwardStep() {
          const duration2 = video.duration || 0;
          const ratio = 0.02;
          const maxStep = 20;
          const step = Math.min(duration2 * ratio, maxStep);
          video.currentTime += step;
        }
        forwardBtn.on('mousedown', function () {
          forwardStep();
          clearInterval(forwardInterval);
          forwardInterval = setInterval(forwardStep, 100);
        });
        const clearForward = () => clearInterval(forwardInterval);
        $(document).on('mouseup mouseleave', clearForward);
        cleanups.push(clearForward);

        const backwardBtn = player.controlBar.addChild('button');
        backwardBtn.controlText(player.localize('Backward'));
        backwardBtn.addClass('vjs-icon-backward');

        let backwardInterval: any;
        function backwardStep() {
          const duration2 = video.duration || 0;
          const ratio = 0.02;
          const maxStep = 10;
          const step = Math.min(duration2 * ratio, maxStep);
          video.currentTime -= step;
        }
        backwardBtn.on('mousedown', function () {
          backwardStep();
          clearInterval(backwardInterval);
          backwardInterval = setInterval(backwardStep, 100);
        });
        const clearBackward = () => clearInterval(backwardInterval);
        $(document).on('mouseup mouseleave', clearBackward);
        cleanups.push(clearBackward);

        const $forwardBtn = $()(forwardBtn.el_).detach();
        const $backwardBtn = $()(backwardBtn.el_).detach();

        $forwardBtn.insertAfter($playButton);
        $backwardBtn.insertAfter($playButton);

        player.el_.addEventListener('mousewheel', function (event: any) {
          doScroll(event, player);
        }, false);
        const old_element = $()('.vjs-fullscreen-control')[0];
        if (!old_element) {
          video.pause();
          return;
        }
        const new_element = old_element.cloneNode(true);
        old_element.parentNode.replaceChild(new_element, old_element);
        $()('.vjs-fullscreen-control').eq(0).on('click', function (event: any) {
          event.preventDefault();
          if (!isInPreviewWindow) {
            ipc.send('toggle-slideshow');
          } else {
            const win = getCurrentWindow();
            if (win.isFullScreen()) {
              win.setFullScreen(false);
            } else {
              win.setFullScreen(true);
            }
          }
        });

        updateLoopButton();

        function updateLoopButton() {
          if (!(video as any).customizeLoop) {
            $()(loopBtn.el_).removeClass('enabled');
          } else {
            $()(loopBtn.el_).addClass('enabled');
          }
        }

        if (autoPlay) {
          video.play();
        } else {
          video.pause();
        }
        initTrack();
        initThumbnailPewivew();
        initResizer();
        initComments();

        // 初始化 tooltips
        initToolbarBtn();

        // 初始化快速鍵功能
        initShortcuts();
      });
    };
    video.addEventListener('loadedmetadata', onLoadedMetadata);
    cleanups.push(() => video.removeEventListener('loadedmetadata', onLoadedMetadata));

    // 原 link 層 updateInterval（行為照舊：檢查裁切區間循環）
    const updateInterval = setInterval(function () {
      if (video && video.currentTime && !video.paused) {
        if (video.currentTime >= (maxCurrentTime as number)) {
          (window as any).videoHelper.setCurrentTime(video, minCurrentTime);
          if (!(video as any).customizeLoop) {
            video.pause();
          }
        } else if (video.currentTime < (minCurrentTime as number)) {
          (window as any).videoHelper.setCurrentTime(video, minCurrentTime);
          if (!(video as any).customizeLoop) {
            video.pause();
          }
        }
      }
    }, 32);
    cleanups.push(() => clearInterval(updateInterval));

    let volumeTimeout: any;
    video.onvolumechange = function () {
      let iconClass = 'vol-3';
      let value: any = Math.round(video.volume * 100) / 1;
      if (video.muted) value = 0;
      if (value === 0) {
        iconClass = 'vol-0';
      } else if (value < 30) {
        iconClass = 'vol-1';
      } else if (value < 100) {
        iconClass = 'vol-2';
      } else {
        iconClass = 'vol-3';
      }
      value = (value as any) + '%';
      $()('#video-player-tips').removeClass('vol-0 vol-1 vol-2 vol-3').addClass(iconClass);
      $()('#video-player-tips .value').html(value);
      $()('#video-player-tips').show();
      localStorage.setItem('eagle.videoPlayer.volume', value);
      clearTimeout(volumeTimeout);
      volumeTimeout = setTimeout(function () {
        $()('#video-player-tips').hide();
      }, 1000);
    };

    element.on('dblclick', function () {
      if (!isInPreviewWindow) {
        const s = getBodyScope();
        machineryLeaveDetailMode(s);
      } else {
        getBodyScope().toggleFullScreen();
        scopeEvalAsync();
      }
    });

    let direction: string = '';
    let directionTimeout: any;
    const doScroll = function (e: any, player: any) {
      const rootPreferences = (getBodyScope()?.$root?.preferences || {}) as any;
      if (!isInPreviewWindow && rootPreferences.habits?.scrollBehavior === 'paging') {
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      if (!player) return;

      directionTimeout = setTimeout(function () {
        direction = '';
      }, 300);

      const deltaX = Math.max(-1, Math.min(1, -e.deltaX));
      const deltaY = Math.max(-1, Math.min(1, -e.deltaY));
      const duration = video.duration || 0;
      const ratio = 0.02;
      const maxStep = 10;
      const baseSeeStep = Math.min(duration * ratio, maxStep);

      const deltaFactor = Math.min(Math.abs(e.deltaY || e.deltaX) / 100, 1);
      const seekStep = baseSeeStep * (0.1 + deltaFactor * 0.9);

      let step = 0;
      if ((e.shiftKey || e.altKey) && e.deltaY) {
        direction = 'horizontal';
        if (!e.deltaX) {
          step = -e.deltaY > 0 ? seekStep : -seekStep;
        }
      } else if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        direction = 'vertical';
        if (rootPreferences.habits?.videoScrollBehavior === 'progress') {
          step = -e.deltaY > 0 ? seekStep : -seekStep;
        }
      } else {
        direction = 'horizontal';
        step = -e.deltaX > 0 ? seekStep : -seekStep;
      }

      if (direction == 'horizontal' || rootPreferences.habits?.videoScrollBehavior === 'progress') {
        clearTimeout(directionTimeout);
        const absStep = Math.abs(step);
        let newTime = video.currentTime;
        if (step < 0 && newTime - absStep <= video.duration) {
          newTime += absStep;
        }
        if (step > 0 && newTime + absStep > 0) {
          newTime -= absStep;
        }
        if (newTime === player.duration()) {
          newTime = newTime - 0.1;
        }
        player.currentTime(newTime);
        const progress = (newTime / video.duration) * 100;
        const $progressbar = $()('.vjs-play-progress.vjs-slider-bar');
        $progressbar.css('width', `${progress}%`);
      } else if (direction == 'vertical' && Math.abs(e.deltaY) > 7) {
        clearTimeout(directionTimeout);
        if (deltaY == 1) {
          if (video.volume + 0.05 > 1) {
            video.volume = 1;
          } else {
            video.volume += 0.05;
          }
        } else {
          if (video.volume - 0.05 < 0) {
            video.volume = 0;
          } else {
            video.volume -= 0.05;
          }
        }
      }
    };
    void avgFPS;

    return () => cleanups.forEach((fn) => fn());
  }, []);
}

/* shortcuts filter（與 app/filters.ts 的 shortcuts 一致；此處供 initToolbarBtn 使用） */
function shortcutsOf(key: string): string {
  if (!key) return '';
  const platform = (window as any).process?.platform;
  if (platform != 'darwin') {
    return key.replace('CommandOrControl', 'Ctrl').replace('CmdOrCtrl', 'Ctrl').replace('⌘', 'Ctrl');
  }
  return key;
}

/* ------------------------------------------------------------------ */
/* mpvMediaElement（bundle 65684-66094 逐字移植）                       */
/* ------------------------------------------------------------------ */

const darkBaseVariables: Record<string, string> = {
  'primary-color': '#f8f9fb',
  'primary-hover-color': '#f8f9fb',
  'tooltip-bg': 'rgba(0, 0, 0, 0.8)',
  'text-color': '#f8f9fb',
  'text-secondary-color': 'rgba(248, 249, 251, 0.7)',
  'progress-bg': 'rgba(248, 249, 251, 0.25)',
  'progress-buffered-color': 'rgba(248, 249, 251, 0.15)',
  'progress-played-color': 'rgba(248, 249, 251, 0.5)',
  'button-color': '#BDBEC0',
  'button-hover-color': '#f8f9fb',
  'button-active-color': '#f8f9fb',
  '--vp-button-hover-bg': 'rgba(248, 249, 251, 0.05)',
  '--vp-button-active-bg': 'rgba(248, 249, 251, 0.1)',
  'border-color': 'rgba(255, 255, 255, 0.08)',
  'shadow-color': 'rgba(0, 0, 0, 0.3)',
};

const lightBaseVariables: Record<string, string> = {
  'primary-color': '#2c2f32',
  'primary-hover-color': '#2c2f32',
  'tooltip-bg': 'rgba(0, 0, 0, 0.8)',
  'text-color': '#2c2f32',
  'text-secondary-color': 'rgba(44, 47, 50, 0.7)',
  'progress-bg': 'rgba(80, 85, 91, 0.25)',
  'progress-buffered-color': 'rgba(80, 85, 91, 0.15)',
  'progress-played-color': 'rgba(80, 85, 91, 0.75)',
  'button-color': '#50555B',
  'button-hover-color': '#2c2f32',
  'button-active-color': '#2c2f32',
  '--vp-button-hover-bg': 'rgba(44, 47, 50, 0.05)',
  '--vp-button-active-bg': 'rgba(44, 47, 50, 0.08)',
  'border-color': 'rgba(0, 0, 0, 0.1)',
  'shadow-color': 'rgba(0, 0, 0, 0.15)',
};

const eagleThemeConfig: Record<string, { bg: string; base: Record<string, string> }> = {
  dark: { bg: 'rgba(24, 25, 28, 0.95)', base: darkBaseVariables },
  gray: { bg: 'rgba(55, 56, 60, 0.95)', base: darkBaseVariables },
  blue: { bg: 'rgba(13, 22, 48, 0.95)', base: darkBaseVariables },
  purple: { bg: 'rgba(28, 20, 36, 0.95)', base: darkBaseVariables },
  light: { bg: 'rgba(255, 255, 255, 0.95)', base: lightBaseVariables },
  lightgray: { bg: 'rgba(227, 228, 230, 0.95)', base: lightBaseVariables },
};

function buildEagleTheme(themeName: string) {
  const config = eagleThemeConfig[themeName] || eagleThemeConfig.dark;
  const variables = Object.assign({}, config.base, {
    'controls-bg': config.bg,
    'menu-bg': config.bg,
  });
  return { name: 'eagle-' + themeName, variables: variables };
}

export function useMpvMediaElement(videoRef: React.RefObject<HTMLElement | null>, currentId?: string) {
  useEffect(() => {
    const video = videoRef.current as any;
    if (!videoRef.current) return;
    const isInPreviewWindow = $()('#preview-window').length > 0;
    const $bodyScope = getBodyScope();
    const bodyScope = getBodyScope();

    // 從 localStorage 恢復音量
    const volume = localStorage.getItem('eagle.videoPlayer.volume') || '100';
    video.volume = parseInt(volume) / 100;

    // 確保 controls-mode 在初始化後正確套用
    if (video.controlsMode !== undefined) {
      video.controlsMode = video.getAttribute('controls-mode') || 'always';
    }

    // ===== 主題同步 =====
    function applyMpvTheme(theme: string) {
      try {
        if (video.theme) {
          video.theme.apply(buildEagleTheme(theme));
        }
      } catch (err) {
        console.error('[mpvMediaElement] Error applying theme:', err);
      }
    }

    applyMpvTheme(bodyScope?.theme || 'dark');

    // b1-9bz-C-4：$watch('theme') → bodyState 订阅（theme 已源翻转，watcher 归零）
    let lastTheme = bodyScope?.theme;
    const unwatchTheme = useBodyState.subscribe((state: any) => {
      if (state.theme !== lastTheme) {
        lastTheme = state.theme;
        applyMpvTheme(state.theme);
      }
    });

    // ===== 監聽 current 變化 - 切換影片時重設為原生播放器 =====
    // b1-9bz-C-4：$watch('current.id') → detailState 订阅（DetailViewer 传 snapshot.current?.id）
    let lastCurrentId: string | undefined = useDetailState.getState().snapshot.current?.id;
    const unwatchCurrent = useDetailState.subscribe((state: any) => {
      const id = state.snapshot.current?.id;
      if (id !== lastCurrentId && lastCurrentId !== undefined) {
        scopeApply(getBodyScope(), function (s: any) {
          s.useMpvPlayer = false;
          syncDetailFromScope();
        });
      }
      lastCurrentId = id;
    });

    // ===== $destroy 清理 =====
    const cleanups: Array<() => void> = [];
    cleanups.push(() => {
      try {
        if (unwatchTheme) unwatchTheme();
        if (unwatchCurrent) unwatchCurrent();
        if (unwatchComments) unwatchComments();

        const current = getBodyScope()?.current;
        if (current && video.currentTime) {
          localStorage.setItem('eagle.videoPlayer.currentTime.' + current.id, video.currentTime);
        }
        $()(video).off();
        video.destroy?.();

        scopeApply(getBodyScope(), function (s) {
          s.useMpvPlayer = false;
          syncDetailFromScope();
        });
      } catch (err) {
        console.error('[mpvMediaElement] Error during destroy:', err);
      }
    });

    // ===== loadedmetadata 初始化偏好設定 =====
    const onLoadedMetadata = function () {
      if (!getBodyScope()?.isDetailMode && !isInPreviewWindow) {
        return;
      }

      const rootPreferences = (getBodyScope()?.$root?.preferences || {}) as any;
      const autoPlay = rootPreferences.video?.autoPlay != 'false';
      const rememberPosition = rootPreferences.video?.rememberPosition != 'false';
      const loopShortVideo = rootPreferences.video?.loopShortVideo != 'false';

      const volume2 = localStorage.getItem('eagle.videoPlayer.volume') || '100';
      video.volume = parseInt(volume2) / 100;

      if (loopShortVideo && video.duration <= 30) {
        video.loop = true;
      } else {
        video.loop = localStorage.getItem('eagle.videoPlayer.loop') === 'true';
      }

      const current = getBodyScope()?.current;
      if (rememberPosition && current) {
        const savedTime = localStorage.getItem('eagle.videoPlayer.currentTime.' + current.id);
        if (savedTime) {
          const t = parseFloat(savedTime);
          if (t > 0 && t < video.duration) {
            video.currentTime = t;
          }
        }
      }

      if (autoPlay) {
        video.play();
      } else {
        video.pause();
      }

      initShortcuts();

      // 初始化筆記功能
      const noteManager = video.plugins ? video.plugins.get('eagle-notes') : null;
      if (noteManager) {
        if (!isInPreviewWindow) {
          noteManager.setOnAdd(function () {
            video.pause();
            addVideoComment(getBodyScope()?.current, video);
          });
        } else {
          noteManager.hideButton();
        }

        if (current && current.comments) {
          noteManager.setComments(current.comments, video.duration);
        }
      }
    };
    video.addEventListener('loadedmetadata', onLoadedMetadata);
    cleanups.push(() => video.removeEventListener('loadedmetadata', onLoadedMetadata));

    // ===== ended 事件 =====
    const onEnded = function () {
      if (video.loop) {
        video.currentTime = 0;
        setTimeout(function () {
          video.play();
        }, 50);
      }
    };
    video.addEventListener('ended', onEnded);
    cleanups.push(() => video.removeEventListener('ended', onEnded));

    // ===== 筆記更新事件 =====
    const unwatchComments = refreshVideoCommentsChannel.on(function () {
      const noteManager = video.plugins ? video.plugins.get('eagle-notes') : null;
      if (noteManager && getBodyScope()?.current) {
        noteManager.setComments(getBodyScope().current.comments || [], video.duration);
      }
    });

    // ===== 音量變更處理 =====
    let volumeTimeout: any;
    const onVolumeChange = function () {
      let value: any = Math.round(video.volume * 100);
      if (video.muted) value = 0;
      localStorage.setItem('eagle.videoPlayer.volume', value);

      let iconClass = 'vol-3';
      if (value === 0) {
        iconClass = 'vol-0';
      } else if (value < 30) {
        iconClass = 'vol-1';
      } else if (value < 100) {
        iconClass = 'vol-2';
      }
      $()('#video-player-tips').removeClass('vol-0 vol-1 vol-2 vol-3').addClass(iconClass);
      $()('#video-player-tips .value').html(value + '%');
      $()('#video-player-tips').show();
      clearTimeout(volumeTimeout);
      volumeTimeout = setTimeout(function () {
        $()('#video-player-tips').hide();
      }, 1000);
    };
    video.addEventListener('volumechange', onVolumeChange);
    cleanups.push(() => video.removeEventListener('volumechange', onVolumeChange));

    // ===== 錯誤處理 =====
    const onError = (window as any).debounce(function () {
      try {
        $()(video).find('~ .not-support-preview').show();
      } catch (err) {}
    }, 100, true);
    video.addEventListener('error', onError);
    cleanups.push(() => video.removeEventListener('error', onError));

    // ===== 雙擊處理 =====
    const onDblClick = function () {
      if (!isInPreviewWindow) {
        machineryLeaveDetailMode(getBodyScope());
      } else {
        getBodyScope().toggleFullScreen();
        scopeEvalAsync();
      }
    };
    $()(video).on('dblclick', onDblClick);

    // ===== 滑鼠滾輪處理 =====
    let direction: string = '';
    let directionTimeout: any;
    const onWheel = function (e: any) {
      const rootPreferences = (getBodyScope()?.$root?.preferences || {}) as any;
      if (!isInPreviewWindow && rootPreferences.habits?.scrollBehavior === 'paging') {
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      directionTimeout = setTimeout(function () {
        direction = '';
      }, 300);

      const deltaY = Math.max(-1, Math.min(1, -e.deltaY));

      const duration = video.duration || 0;
      const ratio = 0.02;
      const maxStep = 10;
      const baseSeeStep = Math.min(duration * ratio, maxStep);

      const deltaFactor = Math.min(Math.abs(e.deltaY || e.deltaX) / 100, 1);
      const seekStep = baseSeeStep * (0.1 + deltaFactor * 0.9);

      let step = 0;
      if ((e.shiftKey || e.altKey) && e.deltaY) {
        direction = 'horizontal';
        if (!e.deltaX) {
          step = -e.deltaY > 0 ? seekStep : -seekStep;
        }
      } else if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        direction = 'vertical';
        if (rootPreferences.habits?.videoScrollBehavior === 'progress') {
          step = -e.deltaY > 0 ? seekStep : -seekStep;
        }
      } else {
        direction = 'horizontal';
        step = -e.deltaX > 0 ? seekStep : -seekStep;
      }

      if (direction == 'horizontal' || rootPreferences.habits?.videoScrollBehavior === 'progress') {
        clearTimeout(directionTimeout);
        const absStep = Math.abs(step);
        let newTime = video.currentTime;
        if (step < 0 && newTime - absStep <= video.duration) {
          newTime += absStep;
        }
        if (step > 0 && newTime + absStep > 0) {
          newTime -= absStep;
        }
        if (newTime < 0) newTime = 0;
        if (newTime > video.duration) newTime = video.duration;
        video.currentTime = newTime;
      } else if (direction == 'vertical' && Math.abs(e.deltaY) > 7) {
        clearTimeout(directionTimeout);
        if (deltaY == 1) {
          video.volume = Math.min(1, video.volume + 0.05);
        } else {
          video.volume = Math.max(0, video.volume - 0.05);
        }
      }
    };
    video.addEventListener('mousewheel', onWheel, false);
    cleanups.push(() => video.removeEventListener('mousewheel', onWheel));

    // ===== 快速鍵 =====
    function initShortcuts() {
      const keybinds = (window as any).preferences.shortcuts.keybinds;
      const playbackRates = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 3, 4, 8];

      const shortcutHandlerMap: Record<string, () => void> = {
        'player.volume.increase': function () {
          video.volume = Math.min(1, video.volume + 0.05);
        },
        'player.volume.decrease': function () {
          video.volume = Math.max(0, video.volume - 0.05);
        },
        'player.prev1frame': function () {
          video.prevFrame();
        },
        'player.next1frame': function () {
          video.nextFrame();
        },
        'player.prev10frame': function () {
          video.prevFrame(10);
        },
        'player.next10frame': function () {
          video.nextFrame(10);
        },
        'player.step.forward': function () {
          const duration = video.duration || 0;
          const step = Math.min(duration * 0.02, 10);
          video.currentTime += step;
        },
        'player.step.backward': function () {
          const duration = video.duration || 0;
          const step = Math.min(duration * 0.02, 10);
          video.currentTime -= step;
        },
        'player.speed.up': function () {
          const idx = playbackRates.indexOf(video.playbackRate);
          if (idx > -1 && playbackRates[idx + 1]) video.playbackRate = playbackRates[idx + 1];
        },
        'player.speed.down': function () {
          const idx = playbackRates.indexOf(video.playbackRate);
          if (idx > 0) video.playbackRate = playbackRates[idx - 1];
        },
        'player.playAndPause': function () {
          if (!video.paused) {
            video.pause();
          } else {
            video.play();
          }
        },
        'player.thumbnail.set': function () {
          setAsVideoThumbnail();
        },
        'player.thumbnail.copy': function () {
          videoScreenShot(true);
        },
        'player.thumbnail.save': function () {
          videoScreenShot();
        },
      };

      function applyWrapper(func: (event?: any) => void) {
        return (window as any).throttle(function (event: any) {
          event && event.preventDefault();
          func(event);
          scopeEvalAsync();
        }, 24);
      }

      for (const [name, electronKey] of Object.entries(keybinds)) {
        const s = getBodyScope();
        if (shortcutHandlerMap[name] && electronKey) {
          const key = (window as any).ShortcutManager.electronToMousetrap(electronKey);
          if (s?.isInlineMode && key === 'space') continue;
          if (key) {
            (window as any).Mousetrap.unbind(key);
            (window as any).Mousetrap.bind(key, applyWrapper(shortcutHandlerMap[name]));
          }
        }
      }
    }
    void currentId;
    void direction;

    return () => cleanups.forEach((fn) => fn());
  }, []);
}

/* ------------------------------------------------------------------ */
/* audioMediaElement（bundle 66094-66496 逐字移植）                     */
/* ------------------------------------------------------------------ */

export function useAudioMediaElement(videoRef: React.RefObject<HTMLVideoElement | null>) {
  useEffect(() => {
    const video = videoRef.current as HTMLVideoElement;
    if (!videoRef.current) return;

    let wavesurfer: any;
    let wavesurferInterval: any;
    const cleanups: Array<() => void> = [];

    if ($()('div.video-js').length > 0) {
      videojs()($()('div.video-js')[0]).dispose();
      return;
    }

    const ipc = getIpc();
    const element = $()(video);
    const $parentScope = getBodyScope();

    const volume = localStorage.getItem('eagle.videoPlayer.volume') || '100';
    video.volume = parseInt(volume) / 100;

    // 播放器初始化（原 scope.$on('$destroy')）
    cleanups.push(() => {
      if (element[0] && element[0].removeAllListeners) {
        element[0].removeAllListeners();
      }
      video.src = '';
      try {
        videojs()(element[0]).dispose();
      } catch (err) {}
      element.off();
      if (wavesurfer) {
        wavesurfer.destroy();
      }
      clearInterval(wavesurferInterval);
    });

    element.bind(
      'error',
      (window as any)._?.debounce(function () {
        try {
          const current = getBodyScope()?.current;
          const newPath = current ? FileUrlHelper.getRawUrl(current) : '';
          element.attr('src', newPath);
          console.log('视频名称更新，重新定位新图片位置: ' + newPath);
        } catch (err) {}
      }, 333, true)
    );

    let initVideoJS = false;

    const onEnded = function () {
      if ((video as any).customizeLoop) {
        video.currentTime = 0;
        setTimeout(function () {
          video.play();
        }, 50);
      } else {
        video.pause();
      }
    };
    video.addEventListener('ended', onEnded);
    cleanups.push(() => video.removeEventListener('ended', onEnded));

    const onLoadedMetadata = function () {
      console.log('loadedmetadata');

      const volume2 = localStorage.getItem('eagle.videoPlayer.volume') || '100';
      video.volume = parseInt(volume2) / 100;

      const autoPlay = true;
      (video as any).customizeLoop = true;

      if (initVideoJS) {
        if (autoPlay) {
          video.play();
        } else {
          video.pause();
        }

        if ((video as any).customizeLoop) {
          $()('.vjs-icon-loop').addClass('enabled');
        } else {
          $()('.vjs-icon-loop').removeClass('enabled');
        }

        initWaveform();

        initShortcuts();

        return;
      }

      initVideoJS = true;
      videojs()(video, {
        language: ((window as any).preferences && (window as any).preferences.general && (window as any).preferences.general.language) || 'en',
        loadingSpinner: false,
        volume: parseInt(volume2) / 100,
        playbackRates: [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2],
      }).ready(function (this: any) {
        if (!getBodyScope()?.isDetailMode) {
          return;
        }
        const player = this;
        // Videojs bug，滑桿不會自動更新
        $()(player.el()).find('.vjs-volume-level').css('width', video.volume * 100 + '%');
        const fullScreenButton = player.controlBar.fullscreenToggle.el_;
        const $fullScreenButton = $()(fullScreenButton).detach();
        const loopBtn = player.controlBar.addChild('button');
        loopBtn.controlText(player.localize('Loop'));
        loopBtn.addClass('vjs-icon-loop');
        loopBtn.on('click', function () {
          (video as any).customizeLoop = !(video as any).customizeLoop;
          localStorage.setItem('eagle.videoPlayer.loop', (video as any).customizeLoop);
          updateLoopButton();
        });
        $fullScreenButton.insertAfter(loopBtn.el_);

        player.el_.addEventListener('mousewheel', function (event: any) {
          doScroll(event, player);
        }, false);
        const old_element = $()('.vjs-fullscreen-control')[0];
        if (!old_element) {
          video.pause();
          return;
        }
        const new_element = old_element.cloneNode(true);
        old_element.parentNode.replaceChild(new_element, old_element);
        $()('.vjs-fullscreen-control').eq(0).on('click', function (event: any) {
          event.preventDefault();
          ipc.send('toggle-slideshow');
        });

        updateLoopButton();

        function updateLoopButton() {
          if (!(video as any).customizeLoop) {
            $()(loopBtn.el_).removeClass('enabled');
          } else {
            $()(loopBtn.el_).addClass('enabled');
          }
        }

        if (autoPlay) {
          video.play();
        } else {
          video.pause();
        }
        initWaveform();
        initShortcuts();
      });
    };
    video.addEventListener('loadedmetadata', onLoadedMetadata);
    cleanups.push(() => video.removeEventListener('loadedmetadata', onLoadedMetadata));

    function initWaveform() {
      if (video.duration > 3600) return;
      const WaveSurfer = req((window as any).appRoot.path + '/app/js/vendors/wavesurfer.min.js');
      if (wavesurfer) {
        wavesurfer.destroy();
        $()(video).off('pause');
        $()(video).off('play');
        $()(video).off('timeupdate');
        clearInterval(wavesurferInterval);
      }
      wavesurfer = WaveSurfer.create({
        container: '.vjs-progress-holder.vjs-slider.vjs-slider-horizontal',
        waveColor: '#7C7C7C',
        progressColor: '#0072EF',
        cursorColor: '#0072EF',
        cursorWidth: 1,
        normalize: true,
        forceDecode: true,
        height: 40,
        responsive: true,
        interact: false,
      });

      wavesurfer.on('ready', function () {
        wavesurferInterval = setInterval(function () {
          if (video && video.currentTime) {
            const currPercent = video.currentTime / video.duration;
            const curr = wavesurfer.getDuration() * currPercent;
            wavesurfer.setCurrentTime(curr);
          }
        }, 16);

        wavesurfer.setMute(true);
      });

      const src = video.src;
      const xhr = new XMLHttpRequest();
      xhr.open('GET', src);
      xhr.responseType = 'blob';
      xhr.onload = function () {
        wavesurfer.loadBlob(xhr.response);
      };
      xhr.send();
    }

    function initShortcuts() {
      const keybinds = (window as any).preferences.shortcuts.keybinds;
      const playbackRates = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 3, 4, 8];
      const frameTime = 0.04166667;
      const bodyScope = getBodyScope();

      const shortcutHandlerMap: Record<string, () => void> = {
        'player.volume.increase': () => {
          video.volume = Math.min(1, video.volume + 0.05);
        },
        'player.volume.decrease': () => {
          video.volume = Math.max(0, video.volume - 0.05);
        },
        'player.prev1frame': () => {
          video.currentTime -= (video as any).frameTime || frameTime;
        },
        'player.next1frame': () => {
          video.currentTime += (video as any).frameTime || frameTime;
        },
        'player.prev10frame': () => {
          video.currentTime -= ((video as any).frameTime || frameTime) * 10;
        },
        'player.next10frame': () => {
          video.currentTime += ((video as any).frameTime || frameTime) * 10;
        },
        'player.step.forward': () => {
          const duration = video.duration || 0;
          const ratio = 0.02;
          const maxStep = 10;
          const step = Math.min(duration * ratio, maxStep);
          video.currentTime += step;
        },
        'player.step.backward': () => {
          const duration = video.duration || 0;
          const ratio = 0.02;
          const maxStep = 10;
          const step = Math.min(duration * ratio, maxStep);
          video.currentTime -= step;
        },
        'player.speed.up': () => {
          const idx = playbackRates.indexOf(video.playbackRate);
          if (idx > -1 && playbackRates[idx + 1]) video.playbackRate = playbackRates[idx + 1];
        },
        'player.speed.down': () => {
          const idx = playbackRates.indexOf(video.playbackRate);
          if (idx > 0) video.playbackRate = playbackRates[idx - 1];
        },
        'player.playAndPause': () => {
          if (!video.paused) {
            video.pause();
          } else {
            video.play();
          }
        },
      };

      function applyWrapper(func: (event?: any) => void) {
        return (window as any).throttle(function (event: any) {
          event && event.preventDefault();
          func(event);
          scopeEvalAsync();
        }, 24);
      }

      for (const [name, electronKey] of Object.entries(keybinds)) {
        if (shortcutHandlerMap[name] && electronKey) {
          const key = (window as any).ShortcutManager.electronToMousetrap(electronKey);
          if (bodyScope.isInlineMode && key === 'space') return;
          if (key) {
            (window as any).Mousetrap.unbind(key);
            (window as any).Mousetrap.bind(key, applyWrapper(shortcutHandlerMap[name]));
          }
        }
      }
    }

    let volumeTimeout: any;
    video.onvolumechange = function () {
      let iconClass = 'vol-3';
      let value: any = Math.round(video.volume * 100) / 1;
      if (video.muted) value = 0;
      if (value === 0) {
        iconClass = 'vol-0';
      } else if (value < 30) {
        iconClass = 'vol-1';
      } else if (value < 100) {
        iconClass = 'vol-2';
      } else {
        iconClass = 'vol-3';
      }
      value = (value as any) + '%';
      $()('#video-player-tips').removeClass('vol-0 vol-1 vol-2 vol-3').addClass(iconClass);
      $()('#video-player-tips .value').html(value);
      $()('#video-player-tips').show();
      localStorage.setItem('eagle.videoPlayer.volume', value);
      clearTimeout(volumeTimeout);
      volumeTimeout = setTimeout(function () {
        $()('#video-player-tips').hide();
      }, 1000);
    };

    element.on('dblclick', function () {
      const s = getBodyScope();
      machineryLeaveDetailMode(s);
    });

    let direction: string = '';
    let directionTimeout: any;
    const doScroll = function (e: any, player: any) {
      const rootPreferences = (getBodyScope()?.$root?.preferences || {}) as any;
      if (rootPreferences.habits?.scrollBehavior === 'paging') {
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      if (!player) return;

      directionTimeout = setTimeout(function () {
        direction = '';
      }, 300);

      const deltaX = Math.max(-1, Math.min(1, -e.deltaX));
      const deltaY = Math.max(-1, Math.min(1, -e.deltaY));
      const duration = video.duration || 0;
      const ratio = 0.02;
      const maxStep = 10;
      const baseSeeStep = Math.min(duration * ratio, maxStep);

      const deltaFactor = Math.min(Math.abs(e.deltaY || e.deltaX) / 100, 1);
      const seekStep = baseSeeStep * (0.1 + deltaFactor * 0.9);

      let step = 0;
      if ((e.shiftKey || e.altKey) && e.deltaY) {
        direction = 'horizontal';
        if (!e.deltaX) {
          step = -e.deltaY > 0 ? seekStep : -seekStep;
        }
      } else if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        direction = 'vertical';
        if (rootPreferences.habits?.videoScrollBehavior === 'progress') {
          step = -e.deltaY > 0 ? seekStep : -seekStep;
        }
      } else {
        direction = 'horizontal';
        step = -e.deltaX > 0 ? seekStep : -seekStep;
      }

      if (direction == 'horizontal' || rootPreferences.habits?.videoScrollBehavior === 'progress') {
        clearTimeout(directionTimeout);
        const absStep = Math.abs(step);
        let newTime = video.currentTime;
        if (step < 0 && newTime - absStep <= video.duration) {
          newTime += absStep;
        }
        if (step > 0 && newTime + absStep > 0) {
          newTime -= absStep;
        }
        if (newTime === player.duration()) {
          newTime = newTime - 0.1;
        }
        player.currentTime(newTime);
      } else if (direction == 'vertical' && Math.abs(e.deltaY) > 7) {
        clearTimeout(directionTimeout);
        if (deltaY == 1) {
          if (video.volume + 0.05 > 1) {
            video.volume = 1;
          } else {
            video.volume += 0.05;
          }
        } else {
          if (video.volume - 0.05 < 0) {
            video.volume = 0;
          } else {
            video.volume -= 0.05;
          }
        }
      }
    };
    void $parentScope;
    void direction;

    return () => cleanups.forEach((fn) => fn());
  }, []);
}

/* ------------------------------------------------------------------ */
/* mouseGesture（bundle 70837-71140 逐字移植）                          */
/* ------------------------------------------------------------------ */

export function useMouseGesture(ref: React.RefObject<HTMLElement | null>, selector?: string) {
  useEffect(() => {
    const $w = $();
    const element = ref.current;
    if (!element) return;

    const downTime = { value: 0 };
    const state = { isZooming: false };
    let startPoint = { x: 0, y: 0 };
    let endPoint = { x: 0, y: 0 };
    let maxDistanceX = 0;
    let originData = { x: undefined as number | undefined, y: undefined as number | undefined, ratio: 100 };
    let $container = $()(element);
    if (selector) {
      $container = $()(selector);
    }

    // 視覺反饋元件
    let $gestureCanvas: any = null;
    let gestureContext: any = null;
    const gestureThreshold = 20;
    let animationFrame: number | null = null;
    let trailPoints: Array<{ x: number; y: number }> = [];
    const maxTrailLength = 30;

    function createGestureCanvas() {
      if (!$gestureCanvas) {
        $gestureCanvas = $()(`<canvas class="gesture-canvas"></canvas>`);
        $gestureCanvas.css({
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          zIndex: 99999,
          pointerEvents: 'none',
          display: 'none',
        });

        $()('body').append($gestureCanvas);

        $gestureCanvas[0].width = window.innerWidth;
        $gestureCanvas[0].height = window.innerHeight;

        gestureContext = $gestureCanvas[0].getContext('2d');

        $()(window).on('resize.gestureCanvas', function () {
          if ($gestureCanvas) {
            $gestureCanvas[0].width = window.innerWidth;
            $gestureCanvas[0].height = window.innerHeight;
          }
        });
      }
      return $gestureCanvas;
    }

    function drawTrail(ctx: any, distance: number) {
      if (trailPoints.length < 2) return;

      const maxRadius = Math.min(8 + distance / 10, 30);

      trailPoints.forEach(function (point, index) {
        const progress = index / trailPoints.length;
        const radius = maxRadius * Math.pow(progress, 1.8);
        const opacity = Math.pow(progress, 2) * 0.6;

        ctx.save();
        ctx.globalAlpha = opacity;

        const fillOpacity = 0.1 + progress * 0.1;
        ctx.fillStyle = 'rgba(0, 114, 239, ' + fillOpacity + ')';
        ctx.strokeStyle = 'rgba(0, 114, 239, ' + fillOpacity * 2 + ')';
        ctx.lineWidth = 1.5;

        ctx.beginPath();
        ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.restore();
      });
    }

    const currentMouse = { x: 0, y: 0 };

    function animateGesture() {
      if (!gestureContext) {
        animationFrame = null;
        return;
      }

      gestureContext.clearRect(0, 0, $gestureCanvas[0].width, $gestureCanvas[0].height);

      if (trailPoints.length === 0 && startPoint.y) {
        for (let i = 0; i < maxTrailLength; i++) {
          trailPoints.push({ x: startPoint.x, y: startPoint.y });
        }
      }

      if (trailPoints.length > 0) {
        const targetX = startPoint.y ? currentMouse.x : trailPoints[trailPoints.length - 1].x;
        const targetY = startPoint.y ? currentMouse.y : trailPoints[trailPoints.length - 1].y;

        let x = targetX;
        let y = targetY;

        for (let i = trailPoints.length - 1; i >= 0; i--) {
          const followSpeed = startPoint.y ? 0.15 : 0.5;
          trailPoints[i].x += (x - trailPoints[i].x) * followSpeed;
          trailPoints[i].y += (y - trailPoints[i].y) * followSpeed;

          x = trailPoints[i].x;
          y = trailPoints[i].y;
        }

        const distance = Math.sqrt(
          Math.pow(trailPoints[trailPoints.length - 1].x - trailPoints[0].x, 2) +
            Math.pow(trailPoints[trailPoints.length - 1].y - trailPoints[0].y, 2)
        );

        if (distance > 5) {
          drawTrail(gestureContext, distance);
        } else if (!startPoint.y) {
          hideGestureVisual();
          return;
        }
      }

      animationFrame = requestAnimationFrame(animateGesture);
    }

    function updateGestureVisual(mouseX: number, mouseY: number) {
      if (!$gestureCanvas) {
        createGestureCanvas();
      }

      currentMouse.x = mouseX;
      currentMouse.y = mouseY;

      const distanceX = mouseX - startPoint.x;
      const absDistance = Math.abs(distanceX);

      if (absDistance > gestureThreshold && !state.isZooming) {
        $gestureCanvas.css('display', 'block');

        if (!animationFrame) {
          animateGesture();
        }
      } else {
        hideGestureVisual();
      }
    }

    function hideGestureVisual() {
      if ($gestureCanvas) {
        $gestureCanvas.css('display', 'none');
      }

      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
        animationFrame = null;
      }

      trailPoints = [];

      if (gestureContext) {
        gestureContext.clearRect(0, 0, $gestureCanvas[0].width, $gestureCanvas[0].height);
      }
    }

    const onMouseDown = (event: any) => {
      (document.activeElement as HTMLElement | null)?.blur();
      if (event.button === 2 || event.button === 1) {
        event.preventDefault();
        event.stopPropagation();
        downTime.value = Date.now();
        startPoint = { x: event.pageX, y: event.pageY };
        originData.ratio = getBodyScope()?.imageSize?.zoomRatio ?? 100;
        originData.x = event.pageX;
        originData.y = event.pageY;
        maxDistanceX = 0;
        hideGestureVisual();
      }
    };
    $container.on('mousedown.mouseGesture', onMouseDown);

    const onMouseMove = (event: any) => {
      if (startPoint.y) {
        if (state.isZooming || Math.abs(startPoint.y - event.pageY) > Math.abs(startPoint.x - event.pageX)) {
          state.isZooming = true;
          hideGestureVisual();
          const distanceY = startPoint.y - event.pageY;

          const sensitivityFactor = originData.ratio < 100 ? 100 : 150;

          const scale = Math.exp(distanceY / sensitivityFactor);
          let ratio = originData.ratio * scale;

          ratio = Math.max(5, Math.min(200, ratio));

          // b1-9bk：直调 detailService（原 scopeApply 绕道；$evalAsync 语义保留）
          updateZoomRatio(ratio, originData.x, originData.y);
          getBodyScope()?.$evalAsync?.();
        } else {
          updateGestureVisual(event.pageX, event.pageY);
        }
      }
      if (Math.abs(startPoint.x - event.pageX) > maxDistanceX) {
        maxDistanceX = Math.abs(startPoint.x - event.pageX);
      }
    };
    $()(window).on('mousemove.mouseGesture', onMouseMove);

    const onMouseUp = (event: any) => {
      if (event.button === 2 || event.button === 1) {
        event.preventDefault();
        event.stopPropagation();
        endPoint = { x: event.pageX, y: event.pageY };

        const s = getBodyScope();
        if (Math.abs(startPoint.y - event.pageY) - 5 > Math.abs(startPoint.x - event.pageX)) {
          // 垂直拖拽（縮放已在 move 中處理）
        } else if (Math.abs(endPoint.x - startPoint.x) > 20 && originData.ratio === s?.imageSize?.zoomRatio) {
          if (Date.now() - downTime.value <= 1000 && Math.abs(endPoint.x - startPoint.x) > (maxDistanceX * 2) / 3) {
            if (endPoint.x > startPoint.x) {
              scopeApply(s, function (sc) {
                machinerySelectNext(sc, undefined);
                sc.$evalAsync?.();
              });
            } else {
              scopeApply(s, function (sc) {
                machinerySelectPrev(sc, undefined);
                sc.$evalAsync?.();
              });
            }
          }
        } else if (!state.isZooming && Math.abs(endPoint.x - startPoint.x) < 2 && Math.abs(endPoint.y - startPoint.y) < 2) {
          if (event && event.button === 1) {
            scopeApply(s, function (sc) {
              machineryOpenPluginPanel(sc, undefined);
            });
          } else {
            scopeApply(s, function (sc) {
              openItemContextMenu(event, sc.current);
              sc.$evalAsync?.();
            });
          }
        }
      }
      downTime.value = 0;
      state.isZooming = false;
      startPoint = { x: 0, y: 0 };
      endPoint = { x: 0, y: 0 };
      originData = { x: undefined, y: undefined, ratio: 100 };
    };
    $()(window).on('mouseup.mouseGesture', onMouseUp);

    void $w;
    return () => {
      $container.off('mousedown.mouseGesture');
      $()(window).off('mousemove.mouseGesture');
      $()(window).off('mouseup.mouseGesture');
      $()(window).off('resize.gestureCanvas');

      if ($gestureCanvas) {
        $gestureCanvas.remove();
        $gestureCanvas = null;
        gestureContext = null;
      }

      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
        animationFrame = null;
      }
    };
  }, [selector]);
}

/* ------------------------------------------------------------------ */
/* #detail-container ng-class / ng-click（模板行為接管）                 */
/* ------------------------------------------------------------------ */

/** ng-class 集合差量應用（不碰其他 JS 加的類，如 zooming）。 */
export function applyNgClassSet(el: HTMLElement, desired: Record<string, boolean>) {
  for (const key of Object.keys(desired)) {
    if (desired[key]) el.classList.add(key);
    else el.classList.remove(key);
  }
}

export function useDetailContainerBehaviors(
  detailClassMap: Record<string, boolean>,
  deps: unknown
) {
  useEffect(() => {
    const host = detailContainer();
    if (!host) return;
    applyNgClassSet(host, detailClassMap);
  }, [deps]);

  // ng-click="onDetailClick($event)"（中鍵 → toggle-slideshow）
  useEffect(() => {
    const host = detailContainer();
    if (!host) return;
    const onClick = (event: MouseEvent) => {
      scopeApply(getBodyScope(), (s) => onDetailClick(event));
    };
    host.addEventListener('click', onClick);
    return () => host.removeEventListener('click', onClick);
  }, []);
}

/* ------------------------------------------------------------------ */
/* rectSelect（bundle 72564-72799 逐字移植；綁 #box-container）          */
/* ------------------------------------------------------------------ */

export function useRectSelect() {
  useEffect(() => {
    const element = document.getElementById('box-container') as HTMLElement;
    if (!element) return;

    const w = window as any;
    w.rectSelection = {};
    w.rectSelecting = false;
    let startX = 0;
    let startY = 0;
    let offset = $()(element).offset();
    const $rect = $()(`<div class="rect""></div>`).hide();
    let gridItems: any[] = [];
    const originSelectedMappings: Record<string, boolean> = {};
    let isMultipleSelecting = false;
    let windowHeight = 0;
    const $container = $()('#box-container');

    $container.prepend($rect);

    const onMouseDown = function (e: any) {
      const s = getBodyScope();
      if (e && $container.outerWidth() <= e.offsetX + 10) {
        e.stopPropagation();
        return;
      }

      if (e.which != 1 || s?.isDetailMode) return;
      isMultipleSelecting = e.metaKey || e.ctrlKey;

      offset = $()(element).offset();
      gridItems = w.ig.getItems(true);
      windowHeight = $()(window).height();

      if (e.metaKey || e.shiftKey || e.ctrlKey) {
        //
      } else {
        for (let i = 0; i < gridItems.length; i++) {
          const el = gridItems[i].el;
          if (!isMultipleSelecting) {
            if (el) {
              el.classList.remove('selected');
            }
          }
        }
        if (!isMultipleSelecting) {
          scopeApply(s, function (sc) {
            sc.selectedMappings = {};
          });
        }
      }

      Object.assign(originSelectedMappings, JSON.parse(JSON.stringify(s?.selectedMappings || {})));

      w.rectSelection.startX = startX = e.pageX - offset.left;
      w.rectSelection.startY = startY = e.pageY - offset.top + $()(element).scrollTop();
      w.rectSelecting = true;

      if ($()('#box-container .rect').length == 0) {
        $container.prepend($rect);
      }

      $rect.css({
        transform: 'none',
        top: w.rectSelection.startY,
        left: w.rectSelection.startX,
      });

      $rect.show();
      scopeApply(s, function (sc) {
        sc.$root.currentFocus = 'content';
      });
    };
    element.addEventListener('mousedown', onMouseDown);

    const onMouseUp = function () {
      const s = getBodyScope();
      if (!w.rectSelecting) return;
      if (s?.isDetailMode) {
        return;
      }

      w.rectSelection = {};
      w.rectSelecting = false;

      $rect.css({
        top: 0,
        left: 0,
        width: 0,
        height: 0,
        display: 'none',
        transform: 'none',
      });

      scopeApply(s, function (sc) {
        sc.selected = sc.allData.filter(function (image: any) {
          return sc.selectedMappings[image.id];
        });
        sc.$evalAsync?.();
      });
    };
    $()(window).on('mouseup.rectSelect', onMouseUp);

    const onMouseMove = function (e: any) {
      isMultipleSelecting = e.metaKey || e.ctrlKey;

      if (w.rectSelecting) {
        const s = getBodyScope();
        const scrollTop = $()(element).scrollTop();
        const flipX = startX > e.pageX - offset.left;
        const flipY = startY > e.pageY - offset.top + scrollTop;

        w.rectSelection.w = Math.abs(e.pageX - offset.left - startX);
        w.rectSelection.h = Math.abs(e.pageY - offset.top - startY + scrollTop);

        if (flipX) {
          w.rectSelection.startX = startX - w.rectSelection.w;
        }
        if (flipY) {
          w.rectSelection.startY = startY - w.rectSelection.h;
        }

        if (e.pageY <= offset.top + 24) {
          element.scrollTop = scrollTop - 48;
        } else if (e.pageY >= windowHeight - 24) {
          element.scrollTop = scrollTop + 48;
        }

        $rect.css({
          transform: 'none',
          top: w.rectSelection.startY,
          left: w.rectSelection.startX,
          width: w.rectSelection.w,
          height: w.rectSelection.h,
        });

        gridItems = w.ig.getItems(true);
        for (let i = 0; i < gridItems.length; i++) {
          const el = gridItems[i].el;
          if (!el || !gridItems[i]) {
            continue;
          }
          const id = el.getAttribute('data-box-id');

          if (!isMultipleSelecting) {
            if (contain(gridItems[i])) {
              if (!el.classList.contains('selected')) {
                el.classList.add('selected');
                s.selectedMappings[id] = true;
              }
            } else {
              if (el.classList.contains('selected')) {
                el.classList.remove('selected');
                delete s.selectedMappings[id];
              }
            }
          } else {
            const isOriginalSelected = originSelectedMappings[id];
            if (contain(gridItems[i])) {
              if (isOriginalSelected) {
                el.classList.remove('selected');
                s.selectedMappings[id] = false;
              } else {
                el.classList.add('selected');
                s.selectedMappings[id] = true;
              }
            } else {
              if (isOriginalSelected) {
                el.classList.add('selected');
                s.selectedMappings[id] = true;
              } else {
                el.classList.remove('selected');
                s.selectedMappings[id] = false;
              }
            }
          }
        }
      }
    };
    $()(window).on('mousemove.rectSelect', onMouseMove);

    function contain(gridItem: any) {
      const s = getBodyScope();
      const offsetX = 16;
      const offsetY = 16;
      let w2: number, h2: number;
      if (s?.layout === 'JustifiedLayout') {
        w2 = gridItem.rect.width;
        h2 = gridItem.rect.height;
      } else {
        w2 = gridItem.size.width;
        h2 = gridItem.size.height;
      }
      const a = {
        width: w2,
        height: h2,
        x: gridItem.rect.left,
        y: gridItem.rect.top,
      };
      const b = {
        width: (window as any).rectSelection.w,
        height: (window as any).rectSelection.h,
        x: (window as any).rectSelection.startX,
        y: (window as any).rectSelection.startY,
      };

      if (s?.layout === 'JustifiedLayout') {
        a.x += offsetX;
      }

      a.y += offsetY;

      const subFolderHeight = $()('#sub-folder-container').height();
      if (subFolderHeight) {
        a.y += subFolderHeight + 20;
      }

      return !(
        (a.y + a.height < b.y) ||
        a.y > b.y + b.height ||
        (a.x + a.width < b.x) ||
        a.x > b.x + b.width
      );
    }

    return () => {
      element.removeEventListener('mousedown', onMouseDown);
      $()(window).off('mouseup.rectSelect');
      $()(window).off('mousemove.rectSelect');
      try {
        $rect.remove();
      } catch (err) {}
    };
  }, []);
}
