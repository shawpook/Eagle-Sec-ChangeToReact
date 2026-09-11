import { FileUrlHelper } from '../../core/fileUrlHelper';
import { useEffect, useRef } from 'react';
import { t } from '../../global/eagleGlobals';
import { safeZoomData, getIpc, req } from './detailHooks';
import { q, qa, widthOf, heightOf, offsetOf, outerWidthOf, outerHeightOf, cssGet, setCssEl, setHtmlEl, focusEl, blurEl, onEl, offEl } from '../../utils/domQuery';
import { syncDetailFromScope } from '../../store/detailState';
import { getBodyScope, scopeApply } from '../../core/appCore';
import { saveCrop } from '../../services/imageOpsService';
import { getRawPath } from '../../core/itemDomain';
import { moveCropToolChannel, rebindRefreshChannel, resizeCropToolChannel } from '../../global/bus';
import { makeResizable } from '../interactions/resizable';
/**
 * 阶段5：批注/评论/裁切 hooks —— rectComment（72439-72564）、commentsContainer
 * （72353-72439）、commentItem（72215-72353）、cropImage（71520-72215）、
 * tifImg（16580-16668）、tgaImg（70250-70330）、retryWhenError/retryWhenThumbError
 * （70198-70248）的逐字移植。
 */

const liveCurrent = () => getBodyScope()?.current;

/** commentsContainer link 內賦值到 $rootScope 的 removeComment（72400-72423）。 */
export function removeComment(index: number) {
  const $bodyScope = getBodyScope();
  const ipc = getIpc();
  const image = $bodyScope.selected[0];
  const originComments = JSON.parse(JSON.stringify(image.comments));

  image.comments.splice(index, 1);
  rebindRefreshChannel.emit(true);
  ipc.send('image-change', image);

  (window as any).electronLog && (window as any).electronLog.info(`[app] Remove image annotation: ${image.name}(${image.id})`);

  const message = t('notify.annotation.remove');
  // 復原
  scopeApply($bodyScope, function (s) {
    s.notify(
      {
        message: message,
        duration: 4000,
      },
      function () {
        image.comments = originComments;
        rebindRefreshChannel.emit(true);
        getIpc().send('image-change', image);
      }
    );
  });
  (window as any).AnnotationPreview.blur();
  (window as any).AnnotationPreview.hide();
}

/* ------------------------------------------------------------------ */
/* rectComment（綁在靜態 #detail-container；enabled = isCommentMode）    */
/* ------------------------------------------------------------------ */

export function useRectComment(enabled: boolean) {
  const draggingRef = useRef(false);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const posRef = useRef({ startX: 0, startY: 0, downX: 0, downY: 0 });

  useEffect(() => {
    const element = document.getElementById('detail-container');
    if (!element) return;

    // 原 link：$scope.rect = {}（寫回 commentRect，僅首次）
    scopeApply(getBodyScope(), function (s) {
      if (!s.commentRect) {
        s.commentRect = {};
        syncDetailFromScope();
      }
      s.dragging = false;
    });

    const onMouseDown = function (e: any) {
      const target = e.target as HTMLElement;
      if (!target || !target.closest('.image-wrap')) return;
      e.preventDefault();
      const s = getBodyScope();
      const isEnabled = enabledRef.current;
      if (!isEnabled) return;
      if (e.button !== 0) return;
      if ((s?.current && s.current.ext == 'mp4') || s?.current?.ext == 'pdf') {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      const zoomData = safeZoomData();
      const zoomRatio = zoomData.ratio;

      const offset = offsetOf(element);
      void offset;
      posRef.current.startX = e.pageX;
      posRef.current.startY = e.pageY;
      const rect: any = {};
      rect.startX = posRef.current.downX = e.offsetX;
      rect.startY = posRef.current.downY = e.offsetY + element.scrollTop / zoomRatio;
      scopeApply(getBodyScope(), function (sc) {
        sc.commentRect = rect;
        sc.dragging = true;
      });
      draggingRef.current = true;
    };

    const onMouseUp = function () {
      const s = getBodyScope();
      if (!enabledRef.current || !s?.commentRect) return;

      const AnnotationPreview = (window as any).AnnotationPreview;
      AnnotationPreview.hovering = false;
      AnnotationPreview.hide();
      setTimeout(function () {
        focusEl('#annotation-preview-container-input');
      }, 24);
      setTimeout(function () {
        blurEl('#annotation-preview-container-input');
      }, 50);
      scopeApply(s, function (sc) {
        if (!q('#box-container')) return;
        const offsetLeft = (offsetOf(q('#box-container'))?.left ?? 0) - (offsetOf(q('#detail-image'))?.left ?? 0);
        const offsetTop = (offsetOf(q('#box-container'))?.top ?? 0) - (offsetOf(q('#detail-image'))?.top ?? 0);
        void offsetLeft;
        void offsetTop;
        const image = q('#detail-image') as HTMLImageElement;
        const ratio = sc.current ? sc.current.width / image.clientWidth : 0;
        const zoomData = safeZoomData();
        const zoomRatio = zoomData.ratio;

        sc.dragging = false;

        const rect = sc.commentRect || {};
        const comment = {
          id: (window as any).guid(),
          x: Math.round(rect.startX * ratio),
          y: Math.round((rect.startY + element.scrollTop) * ratio),
          width: Math.round(rect.w * ratio),
          height: Math.round(rect.h * ratio),
          annotation: '',
          lastModified: Date.now(),
        };

        if (comment.width > 10 && comment.height > 10) {
          if (!sc.current.comments) {
            sc.current.comments = [];
          }
          sc.current.comments.push(comment);
          rebindRefreshChannel.emit(true);
          window.dispatchEvent(new Event('resize.comments'));
          setTimeout(function () {
            (window as any).AnnotationPreview.lastElem = q('#comment-' + comment.id) || undefined;
            (window as any).AnnotationPreview.show(true);
          }, 100);
          (window as any).electronLog &&
            (window as any).electronLog.info(`[app] New image annoataion: ${sc.current.name}(${sc.current.id})`);
          (window as any).analytics.event('Annotation', 'Create');
        }
        sc.commentRect = undefined;
      });
      draggingRef.current = false;
    };

    const onMouseMove = function (e: any) {
      const s = getBodyScope();
      if (!enabledRef.current) return;
      if (!draggingRef.current) return;
      const zoomData = safeZoomData();
      const zoomRatio = zoomData.ratio;
      if (!s?.commentRect) return;

      const flipX = posRef.current.startX > e.pageX;
      const flipY = posRef.current.startY > e.pageY;

      scopeApply(s, function (sc) {
        const rect = sc.commentRect;
        if (flipX) {
          rect.startX = posRef.current.downX - (posRef.current.startX - e.pageX) / zoomRatio;
        }
        if (flipY) {
          rect.startY = posRef.current.downY - (posRef.current.startY - e.pageY) / zoomRatio;
        }

        rect.w = Math.abs(posRef.current.startX - e.pageX) / zoomRatio;
        rect.h = Math.abs(posRef.current.startY - e.pageY) / zoomRatio;

        sc.$evalAsync?.();
      });
    };

    element.addEventListener('mousedown', onMouseDown);
    element.addEventListener('mouseup', onMouseUp);
    element.addEventListener('mousemove', onMouseMove);
    return () => {
      element.removeEventListener('mousedown', onMouseDown);
      element.removeEventListener('mouseup', onMouseUp);
      element.removeEventListener('mousemove', onMouseMove);
    };
  }, []);
}

/* ------------------------------------------------------------------ */
/* commentsContainer（72353-72439；image=current, ratio 雙向）          */
/* ------------------------------------------------------------------ */

/** resize/圖片載入時重算 ratio 並寫回 body scope（原 commentsContainer resizeHandler）。 */
export function recomputeCommentRatio() {
  const $bodyScope = getBodyScope();
  if (!$bodyScope?.isDetailMode || !$bodyScope.isCommentMode) return;
  const image = $bodyScope.current;
  if (!image) return;
  const $image = q('#detail-image');
  if (image && image.width && $image) {
    scopeApply($bodyScope, function (s) {
      s.ratio = image.width / widthOf($image);
      syncDetailFromScope();
    });
  }
}

export function useCommentsContainer(currentId: string | undefined, hasComments: boolean) {
  useEffect(() => {
    qa('.annotation').forEach(function (el) {
      el.blur();
    });

    const resizeHandler = () => recomputeCommentRatio();

    resizeHandler();
    window.addEventListener('resize.comments', resizeHandler);
    // 原 $(window).trigger("resize.comments") 消費方
    (window as any).__eagleResizeComments = () => window.dispatchEvent(new Event('resize.comments'));

    // 原 $watch("image.id") → 圖片載入後重算 ratio
    if (hasComments) {
      const $image = q('#detail-image');
      if (getBodyScope()?.current?.width && $image) {
        const onLoad = function () {
          const image = getBodyScope()?.current;
          if (!image) return;
          scopeApply(getBodyScope(), function (s) {
            s.ratio = image.width / widthOf($image);
            syncDetailFromScope();
            s.$evalAsync?.();
          });
          offEl($image, 'load');
        };
        onEl($image, 'load', onLoad);
      }
    }

    // 原 $("#detail-image").on("click") → comment-blur focus/blur
    const $detailImage = q('#detail-image');
    const onImageClick = function () {
      setTimeout(function () {
        focusEl('#comment-blur');
      }, 24);

      setTimeout(function () {
        blurEl('#comment-blur');
      }, 100);
    };
    $detailImage?.addEventListener('click', onImageClick);

    return () => {
      window.removeEventListener('resize.comments', resizeHandler);
      $detailImage?.removeEventListener('click', onImageClick);
      offEl($detailImage, 'load');
      delete (window as any).__eagleResizeComments;
    };
  }, [currentId, hasComments]);
}

/* ------------------------------------------------------------------ */
/* commentItem（72215-72353；可拖拽/可縮放的批注框）                     */
/* ------------------------------------------------------------------ */

export function useCommentItem(
  elRef: React.RefObject<HTMLElement | null>,
  commentIndex: number,
  opts: { enabled: boolean }
) {
  useEffect(() => {
    const element = elRef.current;
    if (!element) return;

    const ipc = getIpc();
    let dragging = false;
    let resizing = false;
    let startX = 0;
    let startY = 0;
    let originTop = 0;
    let originLeft = 0;
    let zoomData: any;
    let zoomRatio = 1;

    const $container = q('#detail-container');

    const annotationWheel = function (event: any) {
      event.stopPropagation();
    };
    const annotationEl = element.querySelector('.annotation') as HTMLElement | null;
    annotationEl?.addEventListener('mousewheel', annotationWheel);

    const onResizeStart = function () {
      const s = getBodyScope();
      if (!s?.isCommentMode) return;
      zoomData = safeZoomData();
      zoomRatio = zoomData.ratio;
    };

    const onResize = function (event: any, ui: any) {
      event.preventDefault();
      event.stopPropagation();
      const originWidth = ui.originalSize.width;
      const originHeight = ui.originalSize.height;
      const offsetWidth = ui.size.width - originWidth;
      const offsetHeight = ui.size.height - originHeight;
      ui.size.width = Math.round(originWidth + offsetWidth / zoomRatio);
      ui.size.height = Math.round(originHeight + offsetHeight / zoomRatio);
    };

    const onResizeStop = function (event: any, ui: any) {
      event.stopPropagation();

      const height = ui.element.height();
      const width = ui.element.width();

      scopeApply(getBodyScope(), function (s) {
        resizing = false;
        const comment = s.current?.comments?.[commentIndex];
        if (comment) {
          comment.width = width * (s.ratio || 1);
          comment.height = height * (s.ratio || 1);
        }
        ipc.send('image-change', s.current);
      });
    };
    // D-2f：jQuery-UI resizable → 自研（原 resizestart/resize/resizestop 事件订阅 + handle mousedown 改为回调）
    const rzHandles = makeResizable(element as HTMLElement, {
      start: function () { resizing = true; onResizeStart(); },
      resize: onResize,
      stop: onResizeStop,
    });

    const onMouseDownDrag = function (e: any) {
      const s = getBodyScope();
      e.stopPropagation();
      e.preventDefault();
      if (resizing) return;
      if (!s?.isCommentMode) return;
      dragging = true;
      zoomData = safeZoomData();
      const comment = s?.current?.comments?.[commentIndex];
      originTop = comment ? comment.y : 0;
      originLeft = comment ? comment.x : 0;
      startX = e.pageX;
      startY = e.pageY;
    };
    element.addEventListener('mousedown', onMouseDownDrag);

    const onMouseUpDrag = function (e: any) {
      const s = getBodyScope();
      if (!dragging) return;
      if (!s?.isCommentMode) return;
      scopeApply(s, function (sc) {
        e.stopPropagation();
        dragging = false;
        const currentX = e.pageX;
        const currentY = e.pageY;
        const zr = zoomData.ratio;
        const offsetX = (startX - currentX) / zr;
        const offsetY = (startY - currentY) / zr;
        setCssEl(element, {
          top: originTop - offsetY + 'px',
          left: originLeft - offsetX + 'px',
        });

        const newX = originLeft - offsetX;
        const newY = originTop - offsetY;

        const comment = sc.current?.comments?.[commentIndex];
        if (comment && (newX !== comment.x || newY !== comment.y)) {
          comment.x = newX;
          comment.y = newY;
          getIpc().send('image-change', sc.current);
          setTimeout(function () {
            (window as any).AnnotationPreview.show();
          }, 1);
        } else {
          setTimeout(function () {
            (window as any).AnnotationPreview.focus();
          }, 24);
        }
      });
    };
    element.addEventListener('mouseup', onMouseUpDrag);

    const onMouseMoveDrag = function (e: any) {
      const s = getBodyScope();
      if (!dragging) return;
      if (!s?.isCommentMode) return;

      e.stopPropagation();
      e.preventDefault();

      const currentX = e.pageX;
      const currentY = e.pageY;

      const zr = zoomData.ratio;
      const offsetX = (startX - currentX) / zr;
      const offsetY = (startY - currentY) / zr;

      const comment = s?.current?.comments?.[commentIndex];
      const newX = originLeft - offsetX;
      const newY = originTop - offsetY;

      if (comment && (newX !== comment.x || newY !== comment.y)) {
        setCssEl(element, {
          top: newY + 'px',
          left: newX + 'px',
        });
        blurEl('[contenteditable]:focus');
        (window as any).AnnotationPreview.hide();
      }
    };
    $container?.addEventListener('mousemove', onMouseMoveDrag);

    return () => {
      rzHandles.destroy();
      annotationEl?.removeEventListener('mousewheel', annotationWheel);
      element.removeEventListener('mousedown', onMouseDownDrag);
      element.removeEventListener('mouseup', onMouseUpDrag);
      $container?.removeEventListener('mousemove', onMouseMoveDrag);
    };
  }, [commentIndex, opts.enabled]);
}

/* ------------------------------------------------------------------ */
/* cropImage（71520-72215）                                             */
/* ------------------------------------------------------------------ */

const num0 = (value: number): string => String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

export function useCropImage(
  rootRef: React.RefObject<HTMLElement | null>,
  active: boolean,
  currentId: string | undefined,
  zoomRatio: number
) {
  useEffect(() => {
    if (!active) return;
    const element = rootRef.current;
    if (!element) return;
    const cropSizeEl = document.getElementById('crop-size');
    if (!cropSizeEl) return;

    let draggingCropArea = false;
    let cropResizing = false;

    let startX = 0;
    let startY = 0;
    let originTop = 0;
    let originLeft = 0;
    let zoomData: any;
    let zoomRatioLocal = 1;
    let originalCanvasX = 0;
    let originalCanvasY = 0;
    let orientationY = '';
    let orientationX = '';

    const s0 = getBodyScope();
    const $cropArea = element.querySelector('.crop-area') as HTMLElement;
    const $cropSize = cropSizeEl;
    let containerWidth = s0?.current?.width || 0;
    let containerHeight = s0?.current?.height || 0;
    const minCropSize = 24;

    const $toolbarWidthInput = q('#crop-width') as HTMLInputElement | null;
    const $toolbarHeightInput = q('#crop-height') as HTMLInputElement | null;
    const setVal = (input: HTMLInputElement | null, value: any) => { if (input) input.value = String(value); };
    const getVal = (input: HTMLInputElement | null) => (input ? input.value : '');

    const showSizeTimeout = { id: 0 };

    function updateCropperSize() {
      let w = parseInt(getVal($toolbarWidthInput));
      let h = parseInt(getVal($toolbarHeightInput));
      const s = getBodyScope();

      if ($cropArea && w > 0 && h > 0) {
        w = parseInt(String(Math.min(w, s?.current?.width || w)));
        h = parseInt(String(Math.min(h, s?.current?.height || h)));

        setCssEl($cropArea, {
          width: w,
          height: h,
        });

        showSize();

        setVal($toolbarWidthInput, w);
        setVal($toolbarHeightInput, h);
      }
    }

    onEl($toolbarWidthInput, 'change', updateCropperSize);
    onEl($toolbarHeightInput, 'change', updateCropperSize);
    const widthKeyup = function (event: any) {
      if (event && event.keyCode === 13) {
        $toolbarHeightInput?.focus();
        $toolbarHeightInput?.select();
      }
    };
    const heightKeyup = function () {
      $toolbarHeightInput?.blur();
    };
    onEl($toolbarWidthInput, 'keyup', widthKeyup);
    onEl($toolbarHeightInput, 'keyup', heightKeyup);

    setCssEl($cropArea, { width: containerWidth });
    setCssEl($cropArea, { height: containerHeight });
    setCssEl($cropArea, {
      top: 0,
      left: 0,
      width: containerWidth,
      height: containerHeight,
    });
    $cropArea.classList.add('ui-resizable-resizing');
    // D-2f：jQuery-UI resizable 仅用于创建手柄（实际缩放由下方自研 mousedown 逻辑驱动）→ handlesOnly
    const cropHandles = ($cropArea as HTMLElement | undefined)
      ? makeResizable($cropArea as HTMLElement, { handles: 'n, e, s, w, ne, se, sw, nw', handlesOnly: true })
      : null;

    setHtmlEl($cropSize, 
      `x:${0} y:${0}, ${t('general.w')}:${containerWidth} ${t('general.h')}:${containerHeight}`
    );
    $cropSize.style.display = 'none';
    setVal($toolbarWidthInput, containerWidth);
    setVal($toolbarHeightInput, containerHeight);

    element.querySelectorAll('.ui-resizable-handle').forEach((h) => setCssEl(h as HTMLElement, {
      transform: `scale(${100 / zoomRatio})`,
    }));

    setCssEl(element, {
      'outline-width': `${Math.max((100 / zoomRatio) * 1, 1)}px`,
    });

    const handleDown = function () {
      cropResizing = true;
    };
    $cropArea.querySelectorAll('.ui-resizable-handle').forEach((h) => h.addEventListener('mousedown', handleDown));

    // 原 $watch("current")：裁切容器跟隨當前條目尺寸
    const applyCurrentSize = function () {
      const s = getBodyScope();
      containerWidth = s?.current?.width || 0;
      containerHeight = s?.current?.height || 0;
      setCssEl($cropArea, {
        top: 0,
        left: 0,
        width: containerWidth,
        height: containerHeight,
      });
    };

    // 原 $watch("imageSize.zoomRatio")
    const applyZoom = function (newValue: number) {
      element.querySelectorAll('.ui-resizable-handle').forEach((h) => setCssEl(h as HTMLElement, {
        transform: `scale(${100 / newValue})`,
      }));
      setCssEl(element, {
        'border-width': `${(100 / newValue) * 1}px`,
      });
    };
    applyZoom(zoomRatio);

    // MOVE-CROP-TOOL / RESIZE-CROP-TOOL
    const offMove = moveCropToolChannel.on(function (params: any) {
      if (!params) return;
      moveCropper(params.horizontal, params.vertical);
    });
    const offResize = resizeCropToolChannel.on(function (params: any) {
      if (!params) return;
      resizeCropper(params.horizontal, params.vertical);
    });

    function moveCropper(offsetX: number, offsetY: number) {
      const width = widthOf($cropArea);
      const height = heightOf($cropArea);
      const top = parseInt(cssGet($cropArea, 'top'));
      const left = parseInt(cssGet($cropArea, 'left'));
      const windowWidth = containerWidth;
      const windowHeight = containerHeight;
      if (offsetX !== 0) {
        if (offsetX > 0) {
          if (left + offsetX + width > windowWidth) {
            setCssEl($cropArea, { 'left': windowWidth - width });
          } else {
            setCssEl($cropArea, { 'left': left + offsetX });
          }
        } else if (offsetX < 0) {
          if (left + offsetX > 0) {
            setCssEl($cropArea, { 'left': left + offsetX });
          } else {
            setCssEl($cropArea, { 'left': 0 });
          }
        }
      }
      if (offsetY !== 0) {
        if (offsetY > 0) {
          if (top + offsetY + height > windowHeight) {
            setCssEl($cropArea, { 'top': windowHeight - height });
          } else {
            setCssEl($cropArea, { 'top': top + offsetY });
          }
        } else if (offsetY < 0) {
          if (top + offsetY > 0) {
            setCssEl($cropArea, { 'top': top + offsetY });
          } else {
            setCssEl($cropArea, { 'top': 0 });
          }
        }
      }
      showSize();
    }

    function resizeCropper(offsetX: number, offsetY: number) {
      const width = outerWidthOf($cropArea);
      const height = outerHeightOf($cropArea);
      const top = parseInt(cssGet($cropArea, 'top'));
      const left = parseInt(cssGet($cropArea, 'left'));
      const windowWidth = containerWidth;
      const windowHeight = containerHeight;
      if (offsetX !== 0) {
        if (offsetX > 0) {
          if (left + offsetX + width > windowWidth) {
            setCssEl($cropArea, { 'width': windowWidth - left });
          } else {
            setCssEl($cropArea, { 'width': width + offsetX });
          }
        } else if (offsetX < 0) {
          if (width > minCropSize) {
            setCssEl($cropArea, { 'width': width + offsetX });
          } else {
            setCssEl($cropArea, { 'width': minCropSize });
          }
        }
      }
      if (offsetY !== 0) {
        if (offsetY > 0) {
          if (top + offsetY + height > windowHeight) {
            setCssEl($cropArea, { 'height': windowHeight - top });
          } else {
            setCssEl($cropArea, { 'height': height + offsetY });
          }
        } else if (offsetY < 0) {
          if (height > minCropSize) {
            setCssEl($cropArea, { 'height': height + offsetY });
          } else {
            setCssEl($cropArea, { 'height': minCropSize });
          }
        }
      }
      setVal($toolbarWidthInput, widthOf($cropArea));
      setVal($toolbarHeightInput, heightOf($cropArea));
      showSize();
    }

    const showSize = function () {
      updateSize();
      $cropSize.style.display = '';
      clearTimeout(showSizeTimeout.id);
      showSizeTimeout.id = setTimeout(function () {
        $cropSize.style.display = 'none';
      }, 1000) as unknown as number;
    };

    const updateSize = (window as any).throttle(function () {
      setHtmlEl($cropSize, 
        `x:${num0(parseInt(cssGet($cropArea, 'left')))} y:${num0(parseInt(cssGet($cropArea, 'top')))}, ${t('general.w')}:${num0(
          widthOf($cropArea)
        )} ${t('general.h')}:${num0(heightOf($cropArea))}`
      );
      const position = $cropArea.getBoundingClientRect();
      setCssEl($cropSize, {
        left: position.x + position.width - 10,
        top: position.y + position.height,
        transform: 'translateX(-50%)',
      });
    }, 33);

    const onDblClick = () => {
      const s = getBodyScope();
      saveCrop();
    };
    $cropArea.addEventListener('dblclick', onDblClick);

    const onResizeStart = function (event: any) {
      event.stopPropagation();

      $cropSize.style.display = '';

      zoomData = safeZoomData();
      zoomRatioLocal = zoomData.ratio;

      const targetClass = event.originalEvent.target.classList.value;
      $cropSize.classList.remove(
        ...'orientation-ne orientation-se orientation-nw orientation-sw orientation-n orientation-e orientation-s orientation-w'.split(/\s+/)
      );
      if (targetClass.indexOf('ui-resizable-ne') > -1) {
        $cropSize.classList.add('orientation-ne');
        orientationY = 'n';
        orientationX = 'e';
      } else if (targetClass.indexOf('ui-resizable-se') > -1) {
        $cropSize.classList.add('orientation-se');
        orientationY = 's';
        orientationX = 'e';
      } else if (targetClass.indexOf('ui-resizable-sw') > -1) {
        $cropSize.classList.add('orientation-sw');
        orientationY = 's';
        orientationX = 'w';
      } else if (targetClass.indexOf('ui-resizable-nw') > -1) {
        $cropSize.classList.add('orientation-nw');
        orientationY = 'n';
        orientationX = 'w';
      } else if (targetClass.indexOf('ui-resizable-w') > -1) {
        $cropSize.classList.add('orientation-w');
        orientationY = '';
        orientationX = 'w';
      } else if (targetClass.indexOf('ui-resizable-e') > -1) {
        $cropSize.classList.add('orientation-e');
        orientationY = '';
        orientationX = 'e';
      } else if (targetClass.indexOf('ui-resizable-s') > -1) {
        $cropSize.classList.add('orientation-s');
        orientationY = 's';
        orientationX = '';
      } else if (targetClass.indexOf('ui-resizable-n') > -1) {
        $cropSize.classList.add('orientation-n');
        orientationY = 'n';
        orientationX = '';
      } else {
        orientationX = '';
        orientationY = '';
      }

      originalCanvasX = zoomData.scaledX;
      originalCanvasY = zoomData.scaledY;
    };
    $cropArea.addEventListener('resizestart', onResizeStart);

    const onResize = function (event: any, ui: any) {
      event.preventDefault();
      event.stopPropagation();

      setCssEl($cropSize, {
        top: `${event.pageY}px`,
        left: `${event.pageX}px`,
      });

      zoomData = safeZoomData();
      const offsetCanvasX = parseInt(String((originalCanvasX - zoomData.scaledX) / zoomRatioLocal));
      const offsetCanvasY = parseInt(String((originalCanvasY - zoomData.scaledY) / zoomRatioLocal));

      const isSymmetric = event.altKey;
      const isProportional = event.shiftKey;

      let finalWidth: number, finalHeight: number;

      if (isSymmetric) {
        const centerX = ui.originalPosition.left + ui.originalSize.width / 2;
        const centerY = ui.originalPosition.top + ui.originalSize.height / 2;

        let newWidth = ui.originalSize.width;
        let newHeight = ui.originalSize.height;

        const deltaWidth = (ui.size.width - ui.originalSize.width) / zoomRatioLocal;
        const deltaHeight = (ui.size.height - ui.originalSize.height) / zoomRatioLocal;

        if (orientationX === 'e') {
          const adjustedDeltaWidth = deltaWidth - offsetCanvasX;
          newWidth = ui.originalSize.width + adjustedDeltaWidth * 2;
        } else if (orientationX === 'w') {
          const adjustedDeltaWidth = deltaWidth + offsetCanvasX;
          newWidth = ui.originalSize.width + adjustedDeltaWidth * 2;
        }

        if (orientationY === 's') {
          const adjustedDeltaHeight = deltaHeight - offsetCanvasY;
          newHeight = ui.originalSize.height + adjustedDeltaHeight * 2;
        } else if (orientationY === 'n') {
          const adjustedDeltaHeight = deltaHeight + offsetCanvasY;
          newHeight = ui.originalSize.height + adjustedDeltaHeight * 2;
        }

        if (orientationX && orientationY) {
          let adjustedDeltaWidth: number;
          let adjustedDeltaHeight: number;

          if (orientationX === 'e') {
            adjustedDeltaWidth = deltaWidth - offsetCanvasX;
          } else {
            adjustedDeltaWidth = deltaWidth + offsetCanvasX;
          }

          if (orientationY === 's') {
            adjustedDeltaHeight = deltaHeight - offsetCanvasY;
          } else {
            adjustedDeltaHeight = deltaHeight + offsetCanvasY;
          }

          newWidth = ui.originalSize.width + adjustedDeltaWidth * 2;
          newHeight = ui.originalSize.height + adjustedDeltaHeight * 2;
        }

        if (isProportional) {
          const aspectRatio = ui.originalSize.width / ui.originalSize.height;

          if (orientationX && orientationY) {
            const scaleFactorX = newWidth / ui.originalSize.width;
            const scaleFactorY = newHeight / ui.originalSize.height;

            const scaleFactor = Math.min(scaleFactorX, scaleFactorY);

            newWidth = ui.originalSize.width * scaleFactor;
            newHeight = ui.originalSize.height * scaleFactor;
          } else if (orientationX) {
            newHeight = newWidth / aspectRatio;
          } else if (orientationY) {
            newWidth = newHeight * aspectRatio;
          }
        }

        newWidth = Math.max(newWidth, minCropSize);
        newHeight = Math.max(newHeight, minCropSize);

        let newLeft = centerX - newWidth / 2;
        let newTop = centerY - newHeight / 2;

        if (newLeft < 0) {
          newLeft = 0;
          newWidth = centerX * 2;
        }
        if (newTop < 0) {
          newTop = 0;
          newHeight = centerY * 2;
        }
        if (newLeft + newWidth > containerWidth) {
          newWidth = (containerWidth - centerX) * 2;
        }
        if (newTop + newHeight > containerHeight) {
          newHeight = (containerHeight - centerY) * 2;
        }

        newWidth = Math.max(newWidth, minCropSize);
        newHeight = Math.max(newHeight, minCropSize);

        newLeft = centerX - newWidth / 2;
        newTop = centerY - newHeight / 2;

        newLeft = Math.max(0, Math.min(newLeft, containerWidth - newWidth));
        newTop = Math.max(0, Math.min(newTop, containerHeight - newHeight));

        finalWidth = Math.floor(newWidth);
        finalHeight = Math.floor(newHeight);
        ui.size.width = finalWidth;
        ui.size.height = finalHeight;
        ui.position.left = Math.floor(newLeft);
        ui.position.top = Math.floor(newTop);
      } else {
        const dx = ui.position.left - ui.originalPosition.left;
        const dy = ui.position.top - ui.originalPosition.top;
        let left = ui.originalPosition.left + dx / zoomRatioLocal;
        let top = ui.originalPosition.top + dy / zoomRatioLocal;
        const dw = ui.size.width - ui.originalSize.width;
        const dh = ui.size.height - ui.originalSize.height;
        let maxWidth = containerWidth;
        let maxHeight = containerHeight;

        const maxDx = (maxWidth - minCropSize + offsetCanvasX) * zoomRatioLocal;
        const maxDy = (maxHeight - minCropSize + offsetCanvasY) * zoomRatioLocal;

        if (dx < 0) {
          maxWidth = ui.originalPosition.left + ui.originalSize.width;
        } else if (dx >= maxDx) {
          left = ui.originalPosition.left + maxDx / zoomRatioLocal;
        } else {
          maxWidth = containerWidth - ui.originalPosition.left;
        }

        if (dy < 0) {
          maxHeight = ui.originalPosition.top + ui.originalSize.height;
        } else if (dy >= maxDy) {
          top = ui.originalPosition.top + maxDy / zoomRatioLocal;
        } else {
          maxHeight = containerHeight - ui.originalPosition.top;
        }

        finalWidth = Math.floor(ui.originalSize.width + dw / zoomRatioLocal);
        finalHeight = Math.floor(ui.originalSize.height + dh / zoomRatioLocal);

        if (finalWidth <= minCropSize) finalWidth = minCropSize;
        if (finalHeight <= minCropSize) finalHeight = minCropSize;

        if (orientationY === 's') {
          finalHeight = finalHeight - offsetCanvasY;
        } else if (orientationY === 'n') {
          finalHeight = finalHeight + offsetCanvasY;
          top = top - offsetCanvasY;
        }
        if (orientationX === 'e') {
          finalWidth = finalWidth - offsetCanvasX;
        } else if (orientationX === 'w') {
          finalWidth = finalWidth + offsetCanvasX;
          left = left - offsetCanvasX;
        }

        if (isProportional) {
          const aspectRatio = ui.originalSize.width / ui.originalSize.height;

          if (orientationX && orientationY) {
            let anchorX: number, anchorY: number;

            if (orientationX === 'w' && orientationY === 'n') {
              anchorX = ui.originalPosition.left + ui.originalSize.width;
              anchorY = ui.originalPosition.top + ui.originalSize.height;
            } else if (orientationX === 'e' && orientationY === 'n') {
              anchorX = ui.originalPosition.left;
              anchorY = ui.originalPosition.top + ui.originalSize.height;
            } else if (orientationX === 'w' && orientationY === 's') {
              anchorX = ui.originalPosition.left + ui.originalSize.width;
              anchorY = ui.originalPosition.top;
            } else {
              anchorX = ui.originalPosition.left;
              anchorY = ui.originalPosition.top;
            }

            let newWidth: number, newHeight: number;
            if (Math.abs(dw) > Math.abs(dh * aspectRatio)) {
              newWidth = finalWidth;
              newHeight = finalWidth / aspectRatio;
            } else {
              newWidth = finalHeight * aspectRatio;
              newHeight = finalHeight;
            }

            if (orientationX === 'w') {
              left = anchorX - newWidth;
            } else {
              left = anchorX;
            }

            if (orientationY === 'n') {
              top = anchorY - newHeight;
            } else {
              top = anchorY;
            }

            finalWidth = newWidth;
            finalHeight = newHeight;
          } else if (orientationX) {
            finalHeight = finalWidth / aspectRatio;
          } else if (orientationY) {
            finalWidth = finalHeight * aspectRatio;
          }
        }

        finalWidth = Math.min(finalWidth, maxWidth);
        finalHeight = Math.min(finalHeight, maxHeight);

        finalWidth = Math.max(finalWidth, minCropSize);
        finalHeight = Math.max(finalHeight, minCropSize);

        ui.size.width = finalWidth;
        ui.size.height = finalHeight;

        ui.position.left = Math.floor(Math.max(left, 0));
        ui.position.top = Math.floor(Math.max(top, 0));
      }

      const displayWidth = finalWidth;
      const displayHeight = finalHeight;

      setHtmlEl($cropSize, 
        `x:${num0(parseInt(cssGet($cropArea, 'left')))} y:${num0(parseInt(cssGet($cropArea, 'top')))}, ${t('general.w')}:${num0(
          displayWidth
        )} ${t('general.h')}:${num0(displayHeight)}`
      );
      setVal($toolbarWidthInput, displayWidth);
      setVal($toolbarHeightInput, displayHeight);
    };
    $cropArea.addEventListener('resize', onResize as any);

    const onResizeStop = function (event: any) {
      event.stopPropagation();
      cropResizing = false;
      $cropSize.style.display = 'none';
    };
    $cropArea.addEventListener('resizestop', onResizeStop);

    const onDragDown = function (e: any) {
      e.stopPropagation();
      e.preventDefault();
      if (cropResizing) return;
      draggingCropArea = true;
      zoomData = safeZoomData();

      const of = { top: $cropArea.offsetTop, left: $cropArea.offsetLeft };
      const zr = zoomData.ratio;

      containerWidth = widthOf(element);
      containerHeight = heightOf(element);

      const cropAreaWidth = widthOf($cropArea);
      const cropAreaHeight = heightOf($cropArea);

      originTop = of.top / zr;
      originLeft = of.left / zr;
      startX = e.pageX;
      startY = e.pageY;

      originalCanvasX = zoomData.scaledX;
      originalCanvasY = zoomData.scaledY;

      $cropArea.classList.add('ui-resizable-resizing');
      void cropAreaWidth;
      void cropAreaHeight;
    };
    $cropArea.addEventListener('mousedown', onDragDown);

    const onWinMouseUp = function () {
      if (!draggingCropArea) return;
      $cropArea.classList.remove('ui-resizable-resizing');
      draggingCropArea = false;
    };
    window.addEventListener('mouseup', onWinMouseUp);

    const onWinMouseMove = function (e: any) {
      if (!draggingCropArea) return;

      e.stopPropagation();
      e.preventDefault();

      const currentX = e.pageX;
      const currentY = e.pageY;
      zoomData = safeZoomData();
      const zr = zoomData.ratio;

      const offsetX = (startX - currentX) / zr;
      const offsetY = (startY - currentY) / zr;
      const offsetCanvasX = parseInt(String((originalCanvasX - zoomData.scaledX) / zr));
      const offsetCanvasY = parseInt(String((originalCanvasY - zoomData.scaledY) / zr));
      let top = Math.floor(originTop - offsetY - offsetCanvasY);
      let left = Math.floor(originLeft - offsetX - offsetCanvasX);

      const cropAreaWidth = widthOf($cropArea);
      const cropAreaHeight = heightOf($cropArea);

      if (top < 0) {
        top = 0;
      }
      if (top > containerHeight - cropAreaHeight) {
        top = containerHeight - cropAreaHeight;
      }
      if (left < 0) {
        left = 0;
      }
      if (left > containerWidth - cropAreaWidth) {
        left = containerWidth - cropAreaWidth;
      }

      setCssEl($cropArea, {
        top: `${top}px`,
        left: `${left}px`,
        backgroundPosition: `${-left}px ${-top}px`,
      });

      showSize();
    };
    window.addEventListener('mousemove', onWinMouseMove);

    // current 變化 → 重算容器尺寸
    applyCurrentSize();

    return () => {
      if (cropHandles) cropHandles.destroy();
      $cropArea.querySelectorAll('.ui-resizable-handle').forEach((h) => h.removeEventListener('mousedown', handleDown));
      $cropArea.removeEventListener('resizestart', onResizeStart);
      $cropArea.removeEventListener('resize', onResize as any);
      $cropArea.removeEventListener('resizestop', onResizeStop);
      $cropArea.removeEventListener('dblclick', onDblClick);
      $cropArea.removeEventListener('mousedown', onDragDown);
      window.removeEventListener('mousemove', onWinMouseMove);
      window.removeEventListener('mouseup', onWinMouseUp);
      offEl($toolbarWidthInput, 'change'); offEl($toolbarWidthInput, 'keyup');
      offEl($toolbarHeightInput, 'change'); offEl($toolbarHeightInput, 'keyup');
      offMove && offMove();
      offResize && offResize();
    };
  }, [active, currentId, zoomRatio]);
}

/* ------------------------------------------------------------------ */
/* tifImg（16580-16668）                                                */
/* ------------------------------------------------------------------ */

export function useTifImage(imgRef: React.RefObject<HTMLImageElement | null>, currentId: string | undefined) {
  useEffect(() => {
    const img = imgRef.current;
    if (!img || !currentId) return;
    let worker: Worker | null = null;

    const $parent = img.parentNode as HTMLElement | null;

    async function loadURLFromWorker(url: string) {
      return new Promise<any>((resolve, reject) => {
        if (worker) {
          worker.terminate();
          worker = null;
        }

        worker = new Worker('js/workers/tifWorker.js');
        worker.postMessage({ url });

        worker.onmessage = (e) => {
          const processedURL = e?.data?.url;
          if (processedURL !== url && processedURL) {
            worker?.terminate();
            return;
          }
          if (e.data.error) {
            reject(new Error(e.data.error));
          } else {
            resolve(e.data);
          }
          worker?.terminate();
        };

        worker.onerror = () => {
          reject(new Error('Worker error occurred'));
          worker?.terminate();
        };
      });
    }

    (async function loadTif() {
      const s = getBodyScope();
      const image = s?.current;
      if (!image) return;

      setCssEl(q('#detail-image'), { opacity: 1 });

      const canvas = $parent?.querySelector('canvas') as HTMLCanvasElement | null;
      if (canvas) {
        canvas.remove();
        setCssEl(img, {
          opacity: 1,
          position: '',
          'z-index': '',
        });
      }

      try {
        const filePath = FileUrlHelper.getRawUrl(image);
        const { rgba, width, height } = await loadURLFromWorker(filePath);

        if (rgba) {
          canvas?.remove();
          const cnv = document.createElement('canvas');
          cnv.width = width;
          cnv.height = height;
          const ctx = cnv.getContext('2d')!;
          const imgd = ctx.createImageData(width, height);
          for (let i = 0; i < rgba.length; i++) {
            imgd.data[i] = rgba[i];
          }
          ctx.putImageData(imgd, 0, 0);
          const attr = ['class', 'id'];
          for (let i = 0; i < attr.length; i++) {
            cnv.setAttribute(attr[i], img.getAttribute(attr[i]) || '');
          }
          setCssEl(cnv, {
            'z-index': '10000',
            position: 'relative',
          });
          $parent?.appendChild(cnv);
          setCssEl(img, {
            position: 'absolute',
            'z-index': '9999',
          });
          setCssEl(q('#detail-image'), { opacity: 0 });
        }
      } catch (err) {}
    })();

    return () => {
      worker?.terminate();
      worker = null;
    };
  }, [currentId]);
}

/* ------------------------------------------------------------------ */
/* tgaImg（70250-70330）                                                */
/* ------------------------------------------------------------------ */

export function useTgaImage(imgRef: React.RefObject<HTMLImageElement | null>, currentId: string | undefined) {
  useEffect(() => {
    const img = imgRef.current;
    if (!img || !currentId) return;

    const $parent = img.parentNode as HTMLElement | null;

    function tagCanNotRead(imageData: any) {
      if (!imageData) {
        return false;
      } else {
        const isSame = imageData.every((val: any, i: number, arr: any[]) => val === arr[0]);
        return isSame;
      }
    }

    function loadTga() {
      const s = getBodyScope();
      if (!s?.current) return;
      if ($parent && $parent.querySelectorAll('canvas').length > 0) {
        setCssEl(img, { opacity: 0 });
        setCssEl(img, { position: 'absolute' });
        setCssEl(img, { 'z-index': '9999' });
        $parent.querySelectorAll('canvas').forEach((c) => c.remove());
      }
      const filePath = getBodyScope()?.getRawPath
        ? String(getRawPath(s.current) || '').replace('file://', '')
        : '';
      const filePath2 = FileUrlHelper.getRawPath(s.current);
      try {
        const TgaLoader = req((window as any).appRoot.path + '/app/js/vendors/tga.js');
        const tga = new TgaLoader();
        const buffer = req('fs').readFileSync(filePath2);
        tga.load(buffer);
        const canvas = tga.getCanvas();
        const base64 = canvas.toDataURL('image/png');
        const decodeBase64Image = (window as any).decodeBase64Image;
        const buf = decodeBase64Image ? decodeBase64Image(base64).data : null;
        if (buf && buf.length <= 5000) {
          throw new Error('');
        }
        $parent?.appendChild(canvas);
        setCssEl(img, { opacity: 0 });
        setCssEl(img, { position: 'absolute' });
        setCssEl(img, { 'z-index': '9999' });
      } catch (err) {
        const libtga = req((window as any).appRoot.path + '/app/js/vendors/libtga.js');
        libtga.loadFile(filePath, function (err2: any, loaded: any) {
          if (!err2 && loaded && !tagCanNotRead(loaded.imageData)) {
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d')!;
            const imageData = context.createImageData(loaded.width, loaded.height);
            canvas.height = loaded.height;
            canvas.width = loaded.width;
            imageData.data.set(loaded.imageData);
            context.putImageData(imageData, 0, 0);

            $parent?.appendChild(canvas);
            setCssEl(img, { opacity: 0 });
            setCssEl(img, { position: 'absolute' });
            setCssEl(img, { 'z-index': '9999' });
          }
        });
      }
    }

    loadTga();
    return () => {
      // 原 $watch 無清理；canvas 由下一次載入或分支卸載回收
    };
  }, [currentId]);
}

/* ------------------------------------------------------------------ */
/* retryWhenError / retryWhenThumbError（70198-70248）                   */
/* ------------------------------------------------------------------ */

export function useRetryWhenError(
  imgRef: React.RefObject<HTMLImageElement | null>,
  mode: 'raw' | 'thumb',
  currentId: string | undefined
) {
  useEffect(() => {
    const img = imgRef.current;
    if (!img || !currentId) return;
    let retryCount = mode === 'raw' ? 5 : 50;

    const handler = (window as any)._?.debounce(function () {
      try {
        if (retryCount === 0) {
          return;
        }
        const item = getBodyScope()?.current;
        if (!item) return;
        const helper = FileUrlHelper;
        const newPath = mode === 'raw' ? helper.getRawUrl(item) : helper.getThumbnailUrl(item);
        img.setAttribute('src', newPath);
        console.log('图片名称更新，重新定位新图片位置: ' + newPath);
        retryCount--;
      } catch (err) {}
    }, mode === 'raw' ? 1000 : 100, true);

    img.addEventListener('error', handler);
    return () => img.removeEventListener('error', handler);
  }, [mode, currentId]);
}
