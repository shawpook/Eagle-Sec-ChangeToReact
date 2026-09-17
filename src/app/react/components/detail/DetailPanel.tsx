import React, { useEffect, useState } from 'react';
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
 *
 * F-VP-1c（2026-09-17，视频详情控件条/右键菜单修复）：portal 目标必须以 state 解析。
 * 三个 host 元素由 <BodyBindings />（main.tsx:125）渲染，而本组件（main.tsx:150）紧随其后；
 * 原先在**渲染期**直接 `document.getElementById` 取值，若本组件先于 BodyBindings 提交渲染
 * （并发渲染下可能发生），取值为 null，`createPortal` 整行短路 —— `DetailContainerInterior`
 * 与其内的 `useDetailNgClass` 永不挂载，`#detail-container` 上就永远没有 `is-video` 类。
 * 后果：`_content-area.scss:527` 给 `.smooth_zoom_preloader #detail-container` 的
 * `width: 20000px`（图片缩放虚拟画布）无法被 `.is-video { width: 100% !important }` 覆盖，
 * 容器撑到 20000px，`.vjs-control-bar` 随之同宽 —— 控件条 DOM 齐全却溢出视口，
 * 用户可感知为「能播放但没有控件条 / 右键扩展菜单唤不出」。
 * 改为 state + effect 解析：目标缺席时先渲染 null，就绪后 setState 触发一次重渲染补挂。
 */
function usePortalTargets() {
  const [targets, setTargets] = useState<{
    host: HTMLElement | null;
    container: HTMLElement | null;
    cropHost: HTMLElement | null;
  }>({ host: null, container: null, cropHost: null });

  useEffect(() => {
    const resolve = () =>
      setTargets((prev) => {
        const next = {
          host: document.getElementById('eagle-detail-host'),
          container: document.getElementById('detail-container'),
          cropHost: document.getElementById('eagle-detail-cropsize-host'),
        };
        const same = prev.host === next.host
          && prev.container === next.container
          && prev.cropHost === next.cropHost;
        return same ? prev : next;
      });
    resolve();
    // #detail-container 等壳元素由 BodyBindings 渲染，首次 effect 时可能尚未提交；
    // MutationObserver 覆盖「稍后就绪」，避免依赖帧数猜测。
    const observer = new MutationObserver(resolve);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return targets;
}

export function DetailPanel() {
  const { snapshot } = useDetailState();
  useRectSelect();

  const { host, container, cropHost } = usePortalTargets();

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
