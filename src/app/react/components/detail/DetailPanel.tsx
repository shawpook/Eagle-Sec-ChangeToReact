import React from 'react';
import { createPortal } from 'react-dom';
import { useDetailState } from '../../store/detailState';
import { useRectSelect } from './detailHooks';
import { DetailToolbar, GifFootbar, DetailFloatingBits } from './DetailToolbar';
import { DetailContainerInterior } from './DetailViewer';

/**
 * 阶段5：详情模式顶层接管。
 *
 * 壳（index.html 保留）：.content-panel.detail-mode（ng-show/style 左右边距/壳级
 * ng-dblclick/ng-mousedown 仍由 Angular 驱动）+ #detail-container（元素身份永不重建，
 * smoothZoom 包裹关系不破坏）。
 * portal 内容全部是 Fragment（包裹 div 会破坏 .content-panel 的直接子元素布局）：
 * - #eagle-detail-host：详情工具列 / gif footbar / tips / too-big / not-support / inline
 * - #detail-container：comment-blur / mouse-gesture / 各类型查看分支 / 隐藏占位 img
 * - #eagle-detail-cropsize-host：#crop-size（原模板位於 detail-container 之後）
 */
export function DetailPanel() {
  const { snapshot } = useDetailState();
  useRectSelect();

  const host = typeof document !== 'undefined' ? document.getElementById('eagle-detail-host') : null;
  const container = typeof document !== 'undefined' ? document.getElementById('detail-container') : null;
  const cropHost = typeof document !== 'undefined' ? document.getElementById('eagle-detail-cropsize-host') : null;

  return (
    <>
      {host && createPortal(
        <>
          <DetailToolbar snapshot={snapshot} />
          <GifFootbar snapshot={snapshot} />
          <DetailFloatingBits snapshot={snapshot} />
        </>,
        host
      )}
      {container && createPortal(<DetailContainerInterior snapshot={snapshot} />, container)}
      {cropHost && createPortal(
        snapshot.isCropMode ? <div id="crop-size" className="crop-size" /> : null,
        cropHost
      )}
    </>
  );
}
