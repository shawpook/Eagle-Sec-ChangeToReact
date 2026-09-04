import React, { useEffect } from 'react';
import { getBodyScope, scopeApply } from '../../global/scopeBridge';
import { installBoxGrid } from './boxGridEngine';

/**
 * 阶段4：#box-list 接管。
 *
 * index.html 保留静态 #box-list 元素（ng-grid-layout 等旧引用已删），boxes 由
 * boxGridEngine（ngGridLayout 指令逐字移植）经 window.resetNgGridLayoutData 契约生成，
 * 保持 window.ig / NgGridStrings 同名全局供 scrollbar/框选等既有消费方使用。
 * 引擎直接操作 #box-list 子 DOM（eg.InfiniteGrid 契约），React 不参与其子树渲染。
 * 原 ng-mousedown/ng-right-click 行为在 effect 中等价挂回。
 */

export function BoxList() {
  useEffect(() => {
    const host = document.getElementById('box-list');
    const cleanups: Array<() => void> = [];

    if (host) {
      // 原 ng-mousedown="cleanSelected($event)" / ng-right-click="openFileListContextMenu($event)"。
      // b1-9o：box 内点击由 select 链处理——bundle 在世时 ng-grid item 处理器先截停并
      // stopPropagation，容器级 cleanSelected 不会吞掉 box 点击；shim 世界等价实现为
      // 「box 内 mousedown → s.select(e, item)，box 外才走 cleanSelected」。
      const onMouseDown = (e: MouseEvent) => {
        const boxEl = (e.target as HTMLElement | null)?.closest?.('.box') as HTMLElement | null;
        if (boxEl) {
          scopeApply(getBodyScope(), (s) => {
            const id = boxEl.getAttribute('data-box-id');
            const item = id && s.itemMappings ? s.itemMappings[id] : null;
            if (item && typeof s.select === 'function') s.select(e, item);
          });
          return;
        }
        scopeApply(getBodyScope(), (s) => s.cleanSelected && s.cleanSelected(e));
      };
      const onContextMenu = (e: MouseEvent) => scopeApply(getBodyScope(), (s) => s.openFileListContextMenu && s.openFileListContextMenu(e));
      host.addEventListener('mousedown', onMouseDown);
      host.addEventListener('contextmenu', onContextMenu);
      cleanups.push(() => {
        host.removeEventListener('mousedown', onMouseDown);
        host.removeEventListener('contextmenu', onContextMenu);
      });
    }

    cleanups.push(installBoxGrid());

    return () => cleanups.forEach((fn) => fn());
  }, []);

  // boxes 由引擎生成，React 不渲染子树
  return null;
}
