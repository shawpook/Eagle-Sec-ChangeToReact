import React, { useEffect, useRef } from 'react';
import { getBodyScope, runInBodyScope } from '../../core/appCore';


import { machineryUpdateContainerHieght } from '../../services/gridService';
/**
 * filterItem 基础指令移植（bundle:67305-67559，attribute 指令）。
 *
 * 逐字对应原 link 行为：
 *  - 点击根元素切换 .open（互斥：先移除其它 [filter-item].open）
 *  - 内容宽度超出视口时加 .right-menu
 *  - 打开时 #filter-toolbar-overlay.show 同步 + focusInput + updateContainerHieght
 *  - .shortcut-input 键盘：Enter 触发 active check-item 点击 / Esc 关闭 / 上下移动 active
 *  - 普通 input Esc 关闭；增强输入（shortcut-input，非搜索框）500ms 清空 + 首字母高亮
 *  - .check-item mouseenter → active 迁移
 *  - .clear-btn 点击关闭
 *  - open 时触发 onOpen 回调（等价原 elem.trigger("open")）
 */

export interface FilterItemShellProps {
  id: string;
  /** ng-class 的 'active' 条件结果 */
  active: boolean;
  /** ng-class 的 'hide-filter' 条件结果 */
  hideFilter: boolean;
  /** 原 elem.trigger("open") 的等价回调 */
  onOpen?: () => void;
  /** 原 clear-btn 的 ng-click=clearX（第一步 stopPropagation）+ jQuery close() */
  onClear?: (e: React.MouseEvent) => void;
  /** 指令根元素的额外 class（模板里的固定 class） */
  className?: string;
  /** 原 ng-right-click（右键清除）*/
  onContextMenu?: (e: React.MouseEvent) => void;
  children: React.ReactNode;
}

export function FilterItemShell({ id, active, hideFilter, onOpen, onClear, className = '', onContextMenu, children }: FilterItemShellProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  // click 切换（bundle:67321-67344 逐字）
  const onClick = (event: React.MouseEvent) => {
    const target = event.target as HTMLElement;
    // 原版：menu-wrap 自身 stopPropagation（bundle:67345-67347），勾选等操作不影响开合
    if (target.closest('.menu-wrap')) {
      event.stopPropagation();
      return;
    }
    // 原版：clear-btn ng-click 第一步 stopPropagation + jQuery close()（bundle:67348-67352）
    if (target.closest('.clear-btn')) {
      event.stopPropagation();
      onClear?.(event);
      closeShell(rootRef.current);
      return;
    }
    event.stopPropagation();
    const elem = rootRef.current;
    if (!elem) return;
    document.querySelectorAll('[filter-item].open').forEach((el) => {
      if (el !== elem) el.classList.remove('open');
    });
    elem.classList.toggle('open');
    const isOpen = elem.classList.contains('open');
    const menuWrap = elem.querySelector('.menu-wrap') as HTMLElement | null;
    if (isOpen) {
      onOpen?.();
      const menuWidth = menuWrap ? menuWrap.offsetWidth : 0;
      if (
        event.pageX + menuWidth > window.innerWidth &&
        event.pageX - menuWidth > 0
      ) {
        elem.classList.add('right-menu');
      } else {
        elem.classList.remove('right-menu');
      }
      focusInput(elem);
      document.getElementById('filter-toolbar-overlay')?.classList.add('show');
    } else {
      document.getElementById('filter-toolbar-overlay')?.classList.remove('show');
    }
    setTimeout(() => {
      runInBodyScope((s) => machineryUpdateContainerHieght(s));
    }, 50);
    runInBodyScope((s) => {
      s.$root.currentFocus = 'content';
    });
  };

  // .shortcut-input 键盘（bundle:67353-67382 逐字）
  const onShortcutKeyUp = (event: React.KeyboardEvent) => {
    const native = event.nativeEvent as KeyboardEvent;
    switch (native.keyCode) {
      case 13:
        clickSelect(rootRef.current);
        break;
      case 27: {
        event.preventDefault();
        event.stopPropagation();
        closeShell(rootRef.current);
        break;
      }
      case 38:
        selectPrev(rootRef.current);
        break;
      case 40:
        selectNext(rootRef.current);
        break;
      case 9:
        event.preventDefault();
        event.stopPropagation();
        break;
    }
  };

  const onInputKeyUp = (event: React.KeyboardEvent) => {
    if ((event.nativeEvent as KeyboardEvent).keyCode === 27) {
      event.preventDefault();
      event.stopPropagation();
      closeShell(rootRef.current);
    }
  };

  // .check-item mouseenter → active 迁移（bundle:67417-67420）
  const onMouseOver = (event: React.MouseEvent) => {
    const target = event.target as HTMLElement;
    const checkItem = target.closest?.('.check-item');
    if (!checkItem || !rootRef.current?.contains(checkItem)) return;
    rootRef.current.querySelectorAll('.check-item.active').forEach((el) => el.classList.remove('active'));
    checkItem.classList.add('active');
  };

  return (
    <div
      ref={rootRef}
      id={id}
      filter-item=""
      className={`filter-item ${className}${active ? ' active' : ''}${hideFilter ? ' hide-filter' : ''}`}
      onClick={onClick}
      onMouseOver={onMouseOver}
      onContextMenu={onContextMenu}
      onKeyUp={(e) => {
        const target = e.target as HTMLElement;
        if (target.classList.contains('shortcut-input')) onShortcutKeyUp(e);
        else onInputKeyUp(e);
      }}
    >
      {children}
    </div>
  );
}

export function closeShell(elem: HTMLElement | null) {
  if (!elem) return;
  const input = elem.querySelector('.shortcut-input') as HTMLElement | null;
  input?.blur?.();
  elem.classList.remove('open');
  if (document.querySelectorAll('[filter-item].open').length === 0) {
    document.getElementById('filter-toolbar-overlay')?.classList.remove('show');
  }
  setTimeout(() => {
    runInBodyScope((s) => machineryUpdateContainerHieght(s));
  }, 50);
}

export function focusInput(elem: HTMLElement | null) {
  if (!elem) return;
  const shortcut = elem.querySelector('.shortcut-input') as HTMLInputElement | null;
  if (shortcut) {
    setTimeout(() => shortcut.focus(), 24);
    return;
  }
  let input = elem.querySelector('input:not(.shortcut-input), textarea') as HTMLInputElement | null;
  if (!input) {
    input = elem.querySelector('input, textarea') as HTMLInputElement | null;
  }
  if (input) {
    setTimeout(() => input!.focus(), 24);
  }
}

function clickSelect(elem: HTMLElement | null) {
  const active = elem?.querySelector('.check-item.active') as HTMLElement | null;
  active?.click();
}

function selectNext(elem: HTMLElement | null) {
  if (!elem) return;
  const items = Array.from(elem.querySelectorAll('.check-item')) as HTMLElement[];
  const active = elem.querySelector('.check-item.active') as HTMLElement | null;
  if (items.length === 0) return;
  if (!active) {
    items[0].classList.add('active');
  } else {
    let idx = items.indexOf(active);
    items.forEach((el) => el.classList.remove('active'));
    if (idx + 1 > items.length) idx = items.length - 1;
    items[idx]?.classList.add('active');
  }
}

function selectPrev(elem: HTMLElement | null) {
  if (!elem) return;
  const items = Array.from(elem.querySelectorAll('.check-item')) as HTMLElement[];
  const active = elem.querySelector('.check-item.active') as HTMLElement | null;
  if (items.length === 0) return;
  if (!active) {
    items[0].classList.add('active');
  } else {
    let idx = items.indexOf(active) - 1;
    items.forEach((el) => el.classList.remove('active'));
    if (idx - 1 < 0) items[0].classList.add('active');
    else items[idx]?.classList.add('active');
  }
}

/** 通用 check-item 组件（.check-icon>.checkbox + .name + .badge）。 */
export function CheckItem({ checked, excluded, onClick, onContextMenu, name, badge, nameClassName, nameHtml }: {
  checked?: boolean;
  excluded?: boolean;
  onClick: (e: React.MouseEvent) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  name?: React.ReactNode;
  badge?: React.ReactNode;
  nameClassName?: string;
  nameHtml?: string;
}) {
  return (
    <div
      className={`check-item${checked ? ' checked' : ''}${excluded ? ' excluded' : ''}${nameClassName ? ` ${nameClassName}` : ''}`}
      onClick={onClick}
      onContextMenu={onContextMenu}
    >
      <div className="check-icon">
        <div className="checkbox" />
      </div>
      {nameHtml !== undefined ? (
        <div className="name" title={undefined} dangerouslySetInnerHTML={{ __html: nameHtml }} />
      ) : (
        <div className="name">{name}</div>
      )}
      {badge !== undefined && badge !== null ? <div className="badge">{badge}</div> : null}
    </div>
  );
}
