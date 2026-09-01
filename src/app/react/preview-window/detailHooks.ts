import { useEffect } from 'react';
import { getBodyScope } from '../global/scopeBridge';
import { controllerScope, applyController } from './controller';

/**
 * 阶段9a：preview-window.js 特有指令的逐字移植（与阶段5 detailHooks 同风格）。
 *
 * - usePreviewMouseGesture：preview-window.js 128-411 mouseGesture 指令（注意与主窗口
 *   useMouseGesture 行为不同——缩放公式 linear-800、换页阈值 333ms、右键 openContextMenu）。
 * - usePreviewTgaImage：preview-window.js 2367-2440 tgaImg 指令（$bodyScope.current 原图路径）。
 * - usePreviewMousetrap：js/modules/wMousetrap.js 语义（watch scope.mousetrap → Mousetrap.bind，
 *   throttle(50) + $evalAsync 包裹，$destroy 解绑）。
 */

const $: any = () => (window as any).jQuery;
const req = (name: string): any => (window as any).require?.(name);

/* ------------------------------------------------------------------ */
/* mouseGesture（preview-window.js 128-411 逐字）                       */
/* ------------------------------------------------------------------ */

export function usePreviewMouseGesture(ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    let downTime: any;
    let isZooming = false;
    let startPoint = { x: 0, y: 0 };
    let endPoint = { x: 0, y: 0 };
    let originData = { x: undefined as number | undefined, y: undefined as number | undefined, ratio: 100 };
    let maxDistanceX = 0;

    // 視覺反饋元件
    let $gestureCanvas: any = null;
    let gestureContext: any = null;
    const gestureThreshold = 20;
    let animationFrame: any = null;
    let trailPoints: Array<{ x: number; y: number }> = [];
    const maxTrailLength = 30;

    function createGestureCanvas() {
      if (!$gestureCanvas) {
        $gestureCanvas = $()('<canvas class="gesture-canvas"></canvas>');
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

    let currentMouseX = 0;
    let currentMouseY = 0;

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
        const targetX = startPoint.y ? currentMouseX : trailPoints[trailPoints.length - 1].x;
        const targetY = startPoint.y ? currentMouseY : trailPoints[trailPoints.length - 1].y;

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

      currentMouseX = mouseX;
      currentMouseY = mouseY;

      const distanceX = mouseX - startPoint.x;
      const absDistance = Math.abs(distanceX);

      if (absDistance > gestureThreshold && !isZooming) {
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
      if (event.button === 2 || event.button === 1) {
        event.preventDefault();
        event.stopPropagation();
        downTime = Date.now();
        [startPoint.x, startPoint.y] = [event.pageX, event.pageY];
        originData.ratio = controllerScope.imageSize.zoomRatio;
        originData.x = event.pageX;
        originData.y = event.pageY;
        maxDistanceX = 0;
        hideGestureVisual();
      }
    };
    $()(element).on('mousedown', onMouseDown);

    const onMouseMove = (event: any) => {
      if (startPoint.y) {
        if (isZooming || Math.abs(startPoint.y - event.pageY) > Math.abs(startPoint.x - event.pageX)) {
          isZooming = true;
          hideGestureVisual();
          const distanceY = (startPoint.y - event.pageY) * 2;
          let ratio =
            originData.ratio +
            (Math.max(originData.ratio + distanceY, Math.abs(originData.ratio - distanceY)) * distanceY) / 800;
          ratio = parseInt(String(ratio));
          if (ratio <= 5) {
            ratio = 5;
          }
          if (ratio >= 800) {
            ratio = 800;
          }
          controllerScope.updateZoomRatio(ratio, originData.x, originData.y);
          controllerScope.$evalAsync();
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
        [endPoint.x, endPoint.y] = [event.pageX, event.pageY];

        if (Math.abs(startPoint.y - event.pageY) - 5 > Math.abs(startPoint.x - event.pageX)) {
          // 垂直拖拽（縮放已在 move 中處理）
        } else if (Math.abs(endPoint.x - startPoint.x) > 20 && originData.ratio === controllerScope.imageSize.zoomRatio) {
          if (Date.now() - downTime <= 333) {
            if (endPoint.x > startPoint.x) {
              controllerScope.selectNext();
              controllerScope.$evalAsync();
            } else {
              controllerScope.selectPrev();
              controllerScope.$evalAsync();
            }
          }
        } else if (!isZooming && Math.abs(endPoint.x - startPoint.x) < 2 && Math.abs(endPoint.y - startPoint.y) < 2) {
          controllerScope.openContextMenu(event, controllerScope.current);
        }
      }
      downTime = undefined;
      isZooming = false;
      startPoint = { x: 0, y: 0 };
      endPoint = { x: 0, y: 0 };
      originData = { x: undefined, y: undefined, ratio: 100 };
      maxDistanceX = 0;
    };
    $()(window).on('mouseup.mouseGesture', onMouseUp);

    return () => {
      $()(element).off('mousedown');
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
  }, []);
}

/* ------------------------------------------------------------------ */
/* tgaImg（preview-window.js 2367-2440 逐字）                           */
/* ------------------------------------------------------------------ */

export function usePreviewTgaImage(ref: React.RefObject<HTMLImageElement | null>, rawUrl?: string) {
  useEffect(() => {
    const element = ref.current;
    if (!element || !rawUrl) return;

    const $parent = $()(element.parentNode);

    function tagCanNotRead(imageData: any) {
      if (!imageData) {
        return false;
      } else {
        const isSame = imageData.every((val: any, i: number, arr: any) => val === arr[0]);
        return isSame;
      }
    }

    function loadTga(newValue: any) {
      if (!newValue) return;
      if ($parent.find('canvas').length > 0) {
        $()(element).css('opacity', 0);
        $()(element).css('position', 'absolute');
        $()(element).css('z-index', '9999');
        $parent.find('canvas').remove();
      }
      console.time('tga');
      const filePath = newValue;
      const filePath2 = (window as any).FileUrlHelper.getRawPath(controllerScope.current);
      try {
        const TgaLoader = req(String(req('app-root-path')) + '/app/js/vendors/tga.js');
        const tga = new TgaLoader();
        const buffer = req('fs').readFileSync(filePath2);
        tga.load(buffer);
        const canvas = tga.getCanvas();
        const base64 = canvas.toDataURL('image/png');
        const buffer2 = (window as any).decodeBase64Image(base64).data;
        if (buffer2.length <= 5000) {
          throw new Error('');
        }
        $parent.append(canvas);
        $()(element).css('opacity', 0);
        $()(element).css('position', 'absolute');
        $()(element).css('z-index', '9999');
        console.timeEnd('tga');
      } catch (err) {
        const libtga = req(String(req('app-root-path')) + '/app/js/vendors/libtga.js');
        libtga.loadFile(filePath, function (err2: any, img: any) {
          if (!err2 && img && !tagCanNotRead(img.imageData)) {
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d')!;
            const imageData = context.createImageData(img.width, img.height);
            canvas.height = img.height;
            canvas.width = img.width;
            imageData.data.set(img.imageData);
            context.putImageData(imageData, 0, 0);

            $parent.append(canvas);
            $()(element).css('opacity', 0);
            $()(element).css('position', 'absolute');
            $()(element).css('z-index', '9999');
            console.timeEnd('tga');
          }
        });
      }
    }

    loadTga(rawUrl);
    return () => {
      // 原 scope.$on('$destroy')：指令未注册清理，仅移除视觉元素
      $parent.find('canvas').remove();
    };
  }, [rawUrl, ref]);
}

/* ------------------------------------------------------------------ */
/* wMousetrap（js/modules/wMousetrap.js 语义）                          */
/* ------------------------------------------------------------------ */

export function usePreviewMousetrap() {
  useEffect(() => {
    const mousetrap = getBodyScope()?.mousetrap;
    if (!mousetrap || typeof mousetrap !== 'object') return;
    const Mousetrap = (window as any).Mousetrap;
    const throttle = (window as any).throttle;
    if (!Mousetrap || !Mousetrap.bind) return;

    function applyWrapper(func: any) {
      return throttle
        ? throttle(function (e: any) {
            func(e);
            controllerScope.$evalAsync();
          }, 50)
        : function (e: any) {
            func(e);
            controllerScope.$evalAsync();
          };
    }

    for (const key in mousetrap) {
      if (Object.prototype.hasOwnProperty.call(mousetrap, key)) {
        Mousetrap.unbind(key);
        Mousetrap.bind(key, applyWrapper(mousetrap[key]));
      }
    }

    return () => {
      for (const key in mousetrap) {
        if (Object.prototype.hasOwnProperty.call(mousetrap, key)) {
          Mousetrap.unbind(key);
        }
      }
    };
  }, []);
}

void applyController;
