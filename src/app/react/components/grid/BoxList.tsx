import React, { useEffect } from 'react';
import { getBodyScope, scopeApply } from '../../global/scopeBridge';
import { callScope } from '../hooks';
import { installBoxGrid } from './boxGridEngine';
import { zoomIn as gridZoomIn, zoomOut as gridZoomOut } from '../../services/gridService';

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

      // b1-9au：网格交互层重建——原 jQuery 委托族（bundle 21938 mouseup / 22178 名称双击
      // 重命名 / 22183 缩略图双击进详情 / 22212 条目右键）随 C1 消亡后仅 mousedown 选中
      // 重挂过，其余全数缺失（图像点不开、条目右键错绑容器菜单、名称双击重命名死、
      // mouseup 收拢选择死）。按原委托语义以原生监听重挂。
      const boxFrom = (target: EventTarget | null) =>
        (target as HTMLElement | null)?.closest?.('.box') as HTMLElement | null;
      const itemOf = (boxEl: HTMLElement | null) => {
        const s = getBodyScope();
        const id = boxEl?.getAttribute('data-box-id');
        return id && s?.itemMappings ? s.itemMappings[id] : null;
      };
      const callFn = (fn: string, ...args: any[]) => {
        // fns 表条目不经 scopeShim get 回退（无 fns-table fallback），必须走 callScope 路由
        (callScope(fn, ...args) as (e?: any) => any)(undefined);
      };

      const onMouseUp = (e: MouseEvent) => {
        const boxEl = boxFrom(e.target);
        if (!boxEl) return;
        callFn('onBoxMouseup', e, itemOf(boxEl));
      };

      const onDblClick = (e: MouseEvent) => {
        const boxEl = boxFrom(e.target);
        if (!boxEl) return;
        const isName = !!(e.target as HTMLElement | null)?.classList?.contains('name');
        callFn('onBoxListDblClick', e, itemOf(boxEl), isName, isName ? (e.target as HTMLElement) : null);
      };

      const onContextMenu = (e: MouseEvent) => {
        const boxEl = boxFrom(e.target);
        if (boxEl) {
          // 原 22212：条目右键 → openItemContextMenu（stopPropagation）
          e.stopPropagation();
          callFn('openItemContextMenu', e, itemOf(boxEl));
          return;
        }
        // 原 45249：列表空白处右键 → openFileListContextMenu（排序面板）
        callFn('openFileListContextMenu', e);
      };

      // 原 19764/19771：Ctrl/Alt+滚轮网格缩放（throttle 120 leading 语义；原绑定在
      // #box-container 容器——含 box 间空隙区域）
      let wheelLocked = false;
      const onWheel = (e: WheelEvent) => {
        if (!e.altKey && !e.ctrlKey) return;
        e.preventDefault();
        e.stopPropagation();
        if (wheelLocked) return;
        wheelLocked = true;
        window.setTimeout(() => { wheelLocked = false; }, 120);
        // b1-9bd：滚轮缩放直调 gridService（原 callFn('zoomIn'/'zoomOut') 绕 scope）
        e.deltaY < 0 ? gridZoomIn(e) : gridZoomOut(e);
      };

      const onContextMenuHost = onContextMenu;
      host.addEventListener('mousedown', onMouseDown);
      host.addEventListener('mouseup', onMouseUp);
      host.addEventListener('dblclick', onDblClick);
      host.addEventListener('contextmenu', onContextMenuHost);
      // wheel 只挂容器（原版语义；box-list 在其内，事件自然冒泡）
      const boxContainer = document.getElementById('box-container');
      boxContainer?.addEventListener('wheel', onWheel, { passive: false });
      cleanups.push(() => {
        host.removeEventListener('mousedown', onMouseDown);
        host.removeEventListener('mouseup', onMouseUp);
        host.removeEventListener('dblclick', onDblClick);
        host.removeEventListener('contextmenu', onContextMenuHost);
        boxContainer?.removeEventListener('wheel', onWheel);
      });
    }

    cleanups.push(installBoxGrid());

    return () => cleanups.forEach((fn) => fn());
  }, []);

  // boxes 由引擎生成，React 不渲染子树
  return null;
}
