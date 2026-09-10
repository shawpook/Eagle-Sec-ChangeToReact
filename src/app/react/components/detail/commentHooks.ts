import { FileUrlHelper } from '../../core/fileUrlHelper';
import { useEffect, useRef } from 'react';
import { t } from '../../global/eagleGlobals';
import { $, getIpc, req } from './detailHooks';
import { syncDetailFromScope } from '../../store/detailState';
import { getBodyScope, scopeApply } from '../../core/appCore';
import { saveCrop } from '../../services/imageOpsService';
import { getRawPath } from '../../core/itemDomain';
import { moveCropToolChannel, rebindRefreshChannel, resizeCropToolChannel } from '../../global/bus';
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
      const zoomData = $()(element).safeZoomData();
      const zoomRatio = zoomData.ratio;

      const offset = $()(element).offset();
      void offset;
      posRef.current.startX = e.pageX;
      posRef.current.startY = e.pageY;
      const rect: any = {};
      rect.startX = posRef.current.downX = e.offsetX;
      rect.startY = posRef.current.downY = e.offsetY + $()(element).scrollTop() / zoomRatio;
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
        $()('#annotation-preview-container-input').focus();
      }, 24);
      setTimeout(function () {
        $()('#annotation-preview-container-input').blur();
      }, 50);
      scopeApply(s, function (sc) {
        if ($()('#box-container').length <= 0) return;
        const offsetLeft = $()('#box-container').offset().left - $()('#detail-image').offset().left;
        const offsetTop = $()('#box-container').offset().top - $()('#detail-image').offset().top;
        void offsetLeft;
        void offsetTop;
        const image = $()('#detail-image').get(0);
        const ratio = sc.current ? sc.current.width / image.clientWidth : 0;
        const zoomData = $()(element).safeZoomData();
        const zoomRatio = zoomData.ratio;

        sc.dragging = false;

        const rect = sc.commentRect || {};
        const comment = {
          id: (window as any).guid(),
          x: Math.round(rect.startX * ratio),
          y: Math.round((rect.startY + $()(element).scrollTop()) * ratio),
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
          $()(window).trigger('resize.comments');
          setTimeout(function () {
            (window as any).AnnotationPreview.lastElem = $()('#comment-' + comment.id)[0];
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
      const zoomData = $()(element).safeZoomData();
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
  const $image = $()('#detail-image');
  if (image && image.width && $image.length) {
    scopeApply($bodyScope, function (s) {
      s.ratio = image.width / $image.width();
      syncDetailFromScope();
    });
  }
}

export function useCommentsContainer(currentId: string | undefined, hasComments: boolean) {
  useEffect(() => {
    const $w = $();
    $()('.annotation').blur();

    const resizeHandler = () => recomputeCommentRatio();

    resizeHandler();
    $()(window).on('resize.comments', resizeHandler);
    // 原 $(window).trigger("resize.comments") 消費方
    (window as any).__eagleResizeComments = () => $()(window).trigger('resize.comments');

    // 原 $watch("image.id") → 圖片載入後重算 ratio
    if (hasComments) {
      const $image = $()('#detail-image');
      if (getBodyScope()?.current?.width && $image.length) {
        const onLoad = function () {
          const image = getBodyScope()?.current;
          if (!image) return;
          scopeApply(getBodyScope(), function (s) {
            s.ratio = image.width / $image.width();
            syncDetailFromScope();
            s.$evalAsync?.();
          });
          $image.off('load.comment');
        };
        $image.on('load.comment', onLoad);
      }
    }

    // 原 $("#detail-image").on("click") → comment-blur focus/blur
    const $detailImage = $()('#detail-image');
    const onImageClick = function () {
      setTimeout(function () {
        $()('#comment-blur').focus();
      }, 24);

      setTimeout(function () {
        $()('#comment-blur').blur();
      }, 100);
    };
    $detailImage.on('click', onImageClick);

    void $w;
    return () => {
      $()(window).off('resize.comments', resizeHandler);
      $detailImage.off('click', onImageClick);
      $detailImage.off('load.comment');
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

    const $container = $()('#detail-container');
    const $el = $()(element);

    $el.resizable();

    const handleMousedown = function () {
      resizing = true;
    };
    $el.find('.ui-resizable-handle').on('mousedown', handleMousedown);

    const annotationWheel = function (event: any) {
      event.stopPropagation();
    };
    $el.find('.annotation').on('mousewheel', annotationWheel);

    const onResizeStart = function () {
      const s = getBodyScope();
      if (!s?.isCommentMode) return;
      zoomData = $()('#detail-container').safeZoomData();
      zoomRatio = zoomData.ratio;
    };
    $el.on('resizestart', onResizeStart);

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
    $el.on('resize', onResize);

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
    $el.on('resizestop', onResizeStop);

    const onMouseDownDrag = function (e: any) {
      const s = getBodyScope();
      e.stopPropagation();
      e.preventDefault();
      if (resizing) return;
      if (!s?.isCommentMode) return;
      dragging = true;
      zoomData = $()('#detail-container').safeZoomData();
      const comment = s?.current?.comments?.[commentIndex];
      originTop = comment ? comment.y : 0;
      originLeft = comment ? comment.x : 0;
      startX = e.pageX;
      startY = e.pageY;
    };
    $el.on('mousedown.drag', onMouseDownDrag);

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
        $el.css({
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
    $el.on('mouseup.drag', onMouseUpDrag);

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
        $el.css({
          top: newY + 'px',
          left: newX + 'px',
        });
        $()('[contenteditable]:focus').blur();
        (window as any).AnnotationPreview.hide();
      }
    };
    $container.on('mousemove.drag', onMouseMoveDrag);

    return () => {
      try {
        $el.resizable('destroy');
      } catch (err) {}
      $el.find('.ui-resizable-handle').off('mousedown', handleMousedown);
      $el.find('.annotation').off('mousewheel', annotationWheel);
      $el.off('resizestart', onResizeStart);
      $el.off('resize', onResize);
      $el.off('resizestop', onResizeStop);
      $el.off('mousedown.drag', onMouseDownDrag);
      $el.off('mouseup.drag', onMouseUpDrag);
      $container.off('mousemove.drag', onMouseMoveDrag);
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
    const $cropContainer = $()(element);
    const $cropArea = $cropContainer.find('.crop-area');
    const $cropSize = $()(cropSizeEl);
    let containerWidth = s0?.current?.width || 0;
    let containerHeight = s0?.current?.height || 0;
    const minCropSize = 24;

    const $toolbarWidthInput = $()('#crop-width');
    const $toolbarHeightInput = $()('#crop-height');

    const showSizeTimeout = { id: 0 };

    function updateCropperSize() {
      let w = parseInt($toolbarWidthInput.val());
      let h = parseInt($toolbarHeightInput.val());
      const s = getBodyScope();

      if ($cropArea && w > 0 && h > 0) {
        w = parseInt(String(Math.min(w, s?.current?.width || w)));
        h = parseInt(String(Math.min(h, s?.current?.height || h)));

        $cropArea.css({
          width: w,
          height: h,
        });

        showSize();

        $toolbarWidthInput.val(w);
        $toolbarHeightInput.val(h);
      }
    }

    $toolbarWidthInput.off('change').on('change', updateCropperSize);
    $toolbarHeightInput.off('change').on('change', updateCropperSize);
    const widthKeyup = function (event: any) {
      if (event && event.keyCode === 13) {
        $toolbarHeightInput.trigger('focus');
        $toolbarHeightInput.trigger('select');
      }
    };
    const heightKeyup = function () {
      $toolbarHeightInput.trigger('blur');
    };
    $toolbarWidthInput.off('keyup').on('keyup', widthKeyup);
    $toolbarHeightInput.off('keyup').on('keyup', heightKeyup);

    $cropArea.width(containerWidth);
    $cropArea.height(containerHeight);
    $cropArea.css({
      top: 0,
      left: 0,
      width: containerWidth,
      height: containerHeight,
    });
    $cropArea.addClass('ui-resizable-resizing');
    $cropArea.resizable({
      handles: 'n, e, s, w, ne, se, sw, nw',
    });

    $cropSize.html(
      `x:${0} y:${0}, ${t('general.w')}:${containerWidth} ${t('general.h')}:${containerHeight}`
    );
    $cropSize.hide();
    $toolbarWidthInput.val(containerWidth);
    $toolbarHeightInput.val(containerHeight);

    $cropContainer.find('.ui-resizable-handle').css({
      transform: `scale(${100 / zoomRatio})`,
    });

    $cropContainer.css({
      'outline-width': `${Math.max((100 / zoomRatio) * 1, 1)}px`,
    });

    const handleDown = function () {
      cropResizing = true;
    };
    $cropArea.find('.ui-resizable-handle').on('mousedown', handleDown);

    // 原 $watch("current")：裁切容器跟隨當前條目尺寸
    const applyCurrentSize = function () {
      const s = getBodyScope();
      containerWidth = s?.current?.width || 0;
      containerHeight = s?.current?.height || 0;
      $cropArea.css({
        top: 0,
        left: 0,
        width: containerWidth,
        height: containerHeight,
      });
    };

    // 原 $watch("imageSize.zoomRatio")
    const applyZoom = function (newValue: number) {
      $cropContainer.find('.ui-resizable-handle').css({
        transform: `scale(${100 / newValue})`,
      });
      $cropContainer.css({
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
      const width = $cropArea.width();
      const height = $cropArea.height();
      const top = parseInt($cropArea.css('top'));
      const left = parseInt($cropArea.css('left'));
      const windowWidth = containerWidth;
      const windowHeight = containerHeight;
      if (offsetX !== 0) {
        if (offsetX > 0) {
          if (left + offsetX + width > windowWidth) {
            $cropArea.css('left', windowWidth - width);
          } else {
            $cropArea.css('left', left + offsetX);
          }
        } else if (offsetX < 0) {
          if (left + offsetX > 0) {
            $cropArea.css('left', left + offsetX);
          } else {
            $cropArea.css('left', 0);
          }
        }
      }
      if (offsetY !== 0) {
        if (offsetY > 0) {
          if (top + offsetY + height > windowHeight) {
            $cropArea.css('top', windowHeight - height);
          } else {
            $cropArea.css('top', top + offsetY);
          }
        } else if (offsetY < 0) {
          if (top + offsetY > 0) {
            $cropArea.css('top', top + offsetY);
          } else {
            $cropArea.css('top', 0);
          }
        }
      }
      showSize();
    }

    function resizeCropper(offsetX: number, offsetY: number) {
      const width = $cropArea.outerWidth();
      const height = $cropArea.outerHeight();
      const top = parseInt($cropArea.css('top'));
      const left = parseInt($cropArea.css('left'));
      const windowWidth = containerWidth;
      const windowHeight = containerHeight;
      if (offsetX !== 0) {
        if (offsetX > 0) {
          if (left + offsetX + width > windowWidth) {
            $cropArea.css('width', windowWidth - left);
          } else {
            $cropArea.css('width', width + offsetX);
          }
        } else if (offsetX < 0) {
          if (width > minCropSize) {
            $cropArea.css('width', width + offsetX);
          } else {
            $cropArea.css('width', minCropSize);
          }
        }
      }
      if (offsetY !== 0) {
        if (offsetY > 0) {
          if (top + offsetY + height > windowHeight) {
            $cropArea.css('height', windowHeight - top);
          } else {
            $cropArea.css('height', height + offsetY);
          }
        } else if (offsetY < 0) {
          if (height > minCropSize) {
            $cropArea.css('height', height + offsetY);
          } else {
            $cropArea.css('height', minCropSize);
          }
        }
      }
      $toolbarWidthInput.val($cropArea.width());
      $toolbarHeightInput.val($cropArea.height());
      showSize();
    }

    const showSize = function () {
      updateSize();
      $cropSize.show();
      clearTimeout(showSizeTimeout.id);
      showSizeTimeout.id = setTimeout(function () {
        $cropSize.hide();
      }, 1000) as unknown as number;
    };

    const updateSize = (window as any).throttle(function () {
      $cropSize.html(
        `x:${num0(parseInt($cropArea.css('left')))} y:${num0(parseInt($cropArea.css('top')))}, ${t('general.w')}:${num0(
          $cropArea.width()
        )} ${t('general.h')}:${num0($cropArea.height())}`
      );
      const position = $cropArea[0].getBoundingClientRect();
      $cropSize.css({
        left: position.x + position.width - 10,
        top: position.y + position.height,
        transform: 'translateX(-50%)',
      });
    }, 33);

    const onDblClick = () => {
      const s = getBodyScope();
      saveCrop();
    };
    $cropArea.on('dblclick', onDblClick);

    const onResizeStart = function (event: any) {
      event.stopPropagation();

      $cropSize.show();

      zoomData = $()('#detail-container').safeZoomData();
      zoomRatioLocal = zoomData.ratio;

      const targetClass = event.originalEvent.target.classList.value;
      $cropSize.removeClass(
        'orientation-ne orientation-se orientation-nw orientation-sw orientation-n orientation-e orientation-s orientation-w'
      );
      if (targetClass.indexOf('ui-resizable-ne') > -1) {
        $cropSize.addClass('orientation-ne');
        orientationY = 'n';
        orientationX = 'e';
      } else if (targetClass.indexOf('ui-resizable-se') > -1) {
        $cropSize.addClass('orientation-se');
        orientationY = 's';
        orientationX = 'e';
      } else if (targetClass.indexOf('ui-resizable-sw') > -1) {
        $cropSize.addClass('orientation-sw');
        orientationY = 's';
        orientationX = 'w';
      } else if (targetClass.indexOf('ui-resizable-nw') > -1) {
        $cropSize.addClass('orientation-nw');
        orientationY = 'n';
        orientationX = 'w';
      } else if (targetClass.indexOf('ui-resizable-w') > -1) {
        $cropSize.addClass('orientation-w');
        orientationY = '';
        orientationX = 'w';
      } else if (targetClass.indexOf('ui-resizable-e') > -1) {
        $cropSize.addClass('orientation-e');
        orientationY = '';
        orientationX = 'e';
      } else if (targetClass.indexOf('ui-resizable-s') > -1) {
        $cropSize.addClass('orientation-s');
        orientationY = 's';
        orientationX = '';
      } else if (targetClass.indexOf('ui-resizable-n') > -1) {
        $cropSize.addClass('orientation-n');
        orientationY = 'n';
        orientationX = '';
      } else {
        orientationX = '';
        orientationY = '';
      }

      originalCanvasX = zoomData.scaledX;
      originalCanvasY = zoomData.scaledY;
    };
    $cropArea.on('resizestart', onResizeStart);

    const onResize = function (event: any, ui: any) {
      event.preventDefault();
      event.stopPropagation();

      $cropSize.css({
        top: `${event.pageY}px`,
        left: `${event.pageX}px`,
      });

      zoomData = $()('#detail-container').safeZoomData();
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

      $cropSize.html(
        `x:${num0(parseInt($cropArea.css('left')))} y:${num0(parseInt($cropArea.css('top')))}, ${t('general.w')}:${num0(
          displayWidth
        )} ${t('general.h')}:${num0(displayHeight)}`
      );
      $toolbarWidthInput.val(displayWidth);
      $toolbarHeightInput.val(displayHeight);
    };
    $cropArea.on('resize', onResize);

    const onResizeStop = function (event: any) {
      event.stopPropagation();
      cropResizing = false;
      $cropSize.hide();
    };
    $cropArea.on('resizestop', onResizeStop);

    const onDragDown = function (e: any) {
      e.stopPropagation();
      e.preventDefault();
      if (cropResizing) return;
      draggingCropArea = true;
      zoomData = $()('#detail-container').safeZoomData();

      const of = $cropArea.position();
      const zr = zoomData.ratio;

      containerWidth = $cropContainer.width();
      containerHeight = $cropContainer.height();

      const cropAreaWidth = $cropArea.width();
      const cropAreaHeight = $cropArea.height();

      originTop = of.top / zr;
      originLeft = of.left / zr;
      startX = e.pageX;
      startY = e.pageY;

      originalCanvasX = zoomData.scaledX;
      originalCanvasY = zoomData.scaledY;

      $cropArea.addClass('ui-resizable-resizing');
      void cropAreaWidth;
      void cropAreaHeight;
    };
    $cropArea.on('mousedown.drag', onDragDown);

    const onWinMouseUp = function () {
      if (!draggingCropArea) return;
      $cropArea.removeClass('ui-resizable-resizing');
      draggingCropArea = false;
    };
    $()(window).on('mouseup.cropimage', onWinMouseUp);

    const onWinMouseMove = function (e: any) {
      if (!draggingCropArea) return;

      e.stopPropagation();
      e.preventDefault();

      const currentX = e.pageX;
      const currentY = e.pageY;
      zoomData = $()('#detail-container').safeZoomData();
      const zr = zoomData.ratio;

      const offsetX = (startX - currentX) / zr;
      const offsetY = (startY - currentY) / zr;
      const offsetCanvasX = parseInt(String((originalCanvasX - zoomData.scaledX) / zr));
      const offsetCanvasY = parseInt(String((originalCanvasY - zoomData.scaledY) / zr));
      let top = Math.floor(originTop - offsetY - offsetCanvasY);
      let left = Math.floor(originLeft - offsetX - offsetCanvasX);

      const cropAreaWidth = $cropArea.width();
      const cropAreaHeight = $cropArea.height();

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

      $cropArea.css({
        top: `${top}px`,
        left: `${left}px`,
        backgroundPosition: `${-left}px ${-top}px`,
      });

      showSize();
    };
    $()(window).on('mousemove.cropimage', onWinMouseMove);

    // current 變化 → 重算容器尺寸
    applyCurrentSize();

    return () => {
      try {
        $cropArea.resizable('destroy');
      } catch (err) {}
      $cropArea.find('.ui-resizable-handle').off('mousedown', handleDown);
      $cropArea.off('resizestart');
      $cropArea.off('resize');
      $cropArea.off('resizestop');
      $cropArea.off('mouseup.cropimage');
      $cropArea.off('dblclick', onDblClick);
      $cropArea.off('mousedown.drag', onDragDown);
      $()(window).off('mousemove.cropimage');
      $()(window).off('mouseup.cropimage');
      $toolbarWidthInput.off('change').off('keyup');
      $toolbarHeightInput.off('change').off('keyup');
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

    const $parent = $()(img.parentNode);

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

      $()('#detail-image').css('opacity', 1);

      const canvas = $parent.find('canvas');
      if (canvas.length > 0) {
        canvas.remove();
        $()(img).css({
          opacity: 1,
          position: '',
          'z-index': '',
        });
      }

      try {
        const filePath = FileUrlHelper.getRawUrl(image);
        const { rgba, width, height } = await loadURLFromWorker(filePath);

        if (rgba) {
          canvas.remove();
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
          $()(cnv).css({
            'z-index': '10000',
            position: 'relative',
          });
          $parent.append(cnv);
          $()(img).css({
            position: 'absolute',
            'z-index': '9999',
          });
          $()('#detail-image').css('opacity', 0);
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

    const $parent = $()(img.parentNode);

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
      if ($parent.find('canvas').length > 0) {
        $()(img).css('opacity', 0);
        $()(img).css('position', 'absolute');
        $()(img).css('z-index', '9999');
        $parent.find('canvas').remove();
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
        $parent.append(canvas);
        $()(img).css('opacity', 0);
        $()(img).css('position', 'absolute');
        $()(img).css('z-index', '9999');
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

            $parent.append(canvas);
            $()(img).css('opacity', 0);
            $()(img).css('position', 'absolute');
            $()(img).css('z-index', '9999');
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
