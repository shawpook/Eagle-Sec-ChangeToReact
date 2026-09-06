import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSidebarState, themePath, SidebarNodeSnapshot } from '../../store/sidebarState';
import { findLiveNode, getBodyScope, scopeApply } from '../../global/scopeBridge';
import { t } from '../../global/eagleGlobals';
import { shortcuts, shortcutsWrapper, longTitle } from '../../app/filters';
import { clickNode, clickSmartNode, toggleFolderExpand, toggleSmartFolderExpand, dblclickSidebarFolder, preventMiddleClick } from '../../services/sidebarService';

/**
 * 阶段2：侧栏接管。
 *
 * DOM 规范 = src/app/index.html 78-496 行的 Angular 模板（逐字转 JSX）。
 * 事件 = 调回 EagleController 同名函数；拖拽沿用 jQuery UI（sidebarFolderItem 等指令移植）。
 */

const fuzzy = (keyword: string, name: string | undefined): string => {
  if (!name) return '';
  const fn = (window as any).fuzzy_match;
  if (!fn || !keyword) return name;
  return fn(keyword, name) || name;
};

const iconSrc = (theme: string, icon: string) => `assets/images/${themePath(theme)}/icons/${icon}`;

/** Angular `number:0 | noZero` 语义：千分位分组，0 → ''。 */
const num = (value: number | undefined): string => {
  if (value == null) return '';
  if (value === 0) return '';
  return String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

const call = (fn: string, ...args: any[]) => (e: any) =>
  scopeApply(getBodyScope(), (scope) => {
    const target = typeof scope[fn] === 'function' ? scope[fn] : undefined;
    if (!target) return;
    target(...(args.length ? args : [e]));
  });

const callWithNode = (fn: string) => (e: any) => {
  const id = (e.currentTarget as HTMLElement)?.closest('[data-sidebar-node-id]')?.getAttribute('data-sidebar-node-id') || '';
  const live = findLiveNode(id);
  scopeApply(getBodyScope(), (scope) => scope[fn] && scope[fn](e, live));
};

const stopAndCall = (fn: string, ...args: any[]) => (e: any) => {
  e.stopPropagation();
  e.preventDefault();
  scopeApply(getBodyScope(), (scope) => scope[fn] && scope[fn](...args));
};

const maskIcon = (name: string) => `assets/images/base/mask-icons/${name}`;

/* ============ 虚拟滚动（vs-repeat 窗口算法移植，bundle:17080-17300） ============ */

export function useVirtualWindow(containerRef: React.RefObject<HTMLDivElement | null>, sizes: number[], resetKey: unknown) {
  const [win, setWin] = useState({ startIndex: 0, endIndex: Math.min(sizes.length, 40), beforeSize: 0, afterSize: 0 });
  const cumulative = useMemo(() => {
    const acc: number[] = [0];
    for (let i = 0; i < sizes.length; i++) acc.push(acc[i] + (sizes[i] || 27));
    return acc;
  }, [sizes]);

  const recompute = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const excess = 50;
    const scrollPos = container.scrollTop;
    const clientSize = container.clientHeight || container.getBoundingClientRect().height;
    let startIndex = 0;
    while (startIndex < sizes.length && cumulative[startIndex] < scrollPos) startIndex++;
    if (startIndex > 0) startIndex--;
    startIndex = Math.max(Math.floor(startIndex - excess / 2), 0);
    let endIndex = startIndex;
    while (endIndex < sizes.length && cumulative[endIndex] < scrollPos + clientSize) endIndex++;
    endIndex = Math.min(Math.ceil(endIndex + excess / 2), sizes.length);
    const beforeSize = cumulative[startIndex] || 0;
    const afterSize = Math.max(0, (cumulative[sizes.length] || 0) - (cumulative[endIndex] || 0));
    setWin((prev) =>
      prev.startIndex === startIndex && prev.endIndex === endIndex && prev.beforeSize === beforeSize && prev.afterSize === afterSize
        ? prev
        : { startIndex, endIndex, beforeSize, afterSize }
    );
  }, [cumulative, sizes.length]);

  useEffect(() => { recompute(); }, [resetKey, recompute]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.addEventListener('scroll', recompute, { passive: true });
    window.addEventListener('resize', recompute);
    return () => {
      container.removeEventListener('scroll', recompute);
      window.removeEventListener('resize', recompute);
    };
  }, [recompute]);

  // vsAutoScroll（bundle:69856）：sidebarIndex 变化时滚动到对应项。
  useEffect(() => {
    const container = containerRef.current;
    const snapshot = useSidebarState.getState().snapshot;
    const idx = snapshot.sidebarIndex;
    if (!container || idx == null || idx < 0 || idx >= sizes.length) return;
    const targetPos = cumulative[idx];
    const scrollTop = container.scrollTop;
    const containerHeight = container.clientHeight || container.getBoundingClientRect().height;
    const size = sizes[idx];
    let to: number | undefined;
    if (Math.abs(targetPos - scrollTop) > containerHeight) to = targetPos - containerHeight / 2;
    else if (targetPos > scrollTop + containerHeight - size) to = targetPos - containerHeight + size;
    else if (targetPos < scrollTop) to = targetPos;
    if (to != null) container.scrollTop = to;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useSidebarState.getState().snapshot.sidebarIndex]);

  return win;
}

/* ============ jQuery UI 拖拽（sidebar*Item 指令移植） ============ */

function initSidebarDrag(root: HTMLElement, kind: 'folder' | 'smartFolder' | 'quickAccess') {
  const $ = (window as any).jQuery || (window as any).$;
  if (!$ || !$.ui) return () => {};
  const cleanups: Array<() => void> = [];
  const isSmart = kind === 'smartFolder';
  const isQuick = kind === 'quickAccess';
  const prefix = isSmart ? 'multiple-drop-smart-folder' : isQuick ? 'multiple-drop-quick-access' : 'multiple-drop-folder';

  root.querySelectorAll<HTMLElement>(`[data-sidebar-kind="${kind}"]`).forEach((el) => {
    if ((el as any).__eagleDragInit) return;
    (el as any).__eagleDragInit = true;
    let initTimeout: any;
    let hasInit = false;
    const detach: Array<() => void> = [];

    const initEvent = () => {
      const bodyScope = getBodyScope();
      if (!bodyScope) return;
      const $root = bodyScope.$root;
      const dragKey = isSmart ? 'draggedSmartFolders' : 'draggedFolders';

      $(el).draggable({
        scroll: false,
        distance: 5,
        appendTo: 'body',
        cursor: 'default',
        cursorAt: { top: -5, left: -5 },
        helper: (event: any) => {
          const id = $(event.target).closest('[data-sidebar-node-id]').attr('data-sidebar-node-id');
          const live = findLiveNode(id);
          $root[dragKey] = [];
          let last = live;
          const selectedKey = isSmart ? 'selectedSmartFolders' : 'selectedFolders';
          if ($root[selectedKey] && $root[selectedKey].indexOf(live) > -1) {
            last = $root[selectedKey][$root[selectedKey].length - 1];
            $root[selectedKey].forEach((f: any) => $root[dragKey].push(f));
          } else {
            $root[dragKey].push(last);
          }
          $root.draggedQuickAccess = live;
          const count = $root[dragKey].length || 1;
          const folderName = (last && last.name) || '';
          const folderIcon = (last && last.icon) || 'folder-close';
          if (count > 1) {
            return $(`
              <div class='multiple-drag-folder-helper multiple'>
                <div class="icon icon-${folderIcon}"><div class="fake-svg"></div></div>
                <div class="name">${folderName}</div>
                <div class="badge">${count}</div>
              </div>`);
          }
          return $(`
            <div class='multiple-drag-folder-helper'>
              <div class="icon icon-${folderIcon}"><div class="fake-svg"></div></div>
              <div class="name">${folderName}</div>
            </div>`);
        },
        start: () => {
          (window as any).dragCheck = true;
          $('body').addClass(isSmart ? 'dragging-smart-folder' : 'dragging-folder');
          $('body').addClass('dragging-quick-access');
          $(el).addClass('prevent-drop');
        },
        stop: () => {
          $('body').removeClass(isSmart ? 'dragging-smart-folder' : 'dragging-folder');
          $('body').removeClass('dragging-quick-access');
          $(el).removeClass('prevent-drop');
          setTimeout(() => { (window as any).dragCheck = false; }, 50);
        },
      });

      const dropInto = (selector: string, fnName: string, asSiblingBelow?: boolean) => {
        $(el)
          .find(selector)
          .droppable({
            tolerance: 'pointer',
            drop: (event: any) => {
              event.stopPropagation();
              const id = $(event.target).closest('[data-sidebar-node-id]').attr('data-sidebar-node-id');
              const target = findLiveNode(id);
              if (target) {
                const dragged = bodyScope.$root[dragKey];
                bodyScope[fnName](dragged, target, ...(asSiblingBelow ? [true] : []));
                bodyScope.$evalAsync();
              }
            },
          });
      };

      if (isQuick) {
        dropInto(`.${prefix}-top-area`, 'moveFoldersAsSibling');
        dropInto(`.${prefix}-bottom-area`, 'moveFoldersAsSibling', true);
      } else if (isSmart) {
        dropInto(`.${prefix}-name-area`, 'moveSmartFoldersToSmartFolder');
        dropInto(`.${prefix}-top-area`, 'moveSmartFolderTo');
        dropInto(`.${prefix}-bottom-area`, 'moveSmartFolderTo', true);
      } else {
        dropInto(`.${prefix}-name-area`, 'moveFoldersToFolder');
        dropInto(`.${prefix}-top-area`, 'moveFoldersAsSibling');
        dropInto(`.${prefix}-bottom-area`, 'moveFoldersAsSibling', true);
      }
    };

    const onOver = () => {
      initTimeout = setTimeout(() => { if (!hasInit) { initEvent(); hasInit = true; } }, 100);
    };
    const onLeave = () => { if (initTimeout) clearTimeout(initTimeout); };
    el.addEventListener('mouseover', onOver);
    el.addEventListener('mouseleave', onLeave);
    detach.push(() => el.removeEventListener('mouseover', onOver));
    detach.push(() => el.removeEventListener('mouseleave', onLeave));
    cleanups.push(() => {
      detach.forEach((fn) => fn());
      try { $(el).draggable('destroy'); } catch {}
      try { $(el).find('.ui-droppable').droppable('destroy'); } catch {}
    });
  });

  return () => cleanups.forEach((fn) => fn());
}

/* ============ tippy（bundle:17365 指令移植） ============ */

function useTippy(ref: React.RefObject<HTMLElement | null>, dep: unknown) {
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const tippy = (window as any).tippy;
    if (!tippy) return;
    const instances: Array<any> = [];
    root.querySelectorAll<HTMLElement>('[tippy][tippy-content]').forEach((el) => {
      const content = el.getAttribute('tippy-content') || '';
      const instance = tippy(el, {
        animation: 'scale',
        arrow: false,
        content,
        placement: (el.getAttribute('tippy-placement') as any) || 'right',
        allowHTML: true,
      });
      (instance as any)._eagleContent = content;
      instances.push(instance);
    });
    return () => instances.forEach((instance) => instance.destroy());
  }, [dep]);
}

/* ============ 节点渲染 ============ */

function RenameInput({ node, commitFn, autoFocusEvent }: { node: SidebarNodeSnapshot; commitFn: string; autoFocusEvent?: string }) {
  const [draft, setDraft] = useState(node.newFolderName ?? node.name ?? '');
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { setDraft(node.newFolderName ?? node.name ?? ''); }, [node.id, node.editable]);

  useEffect(() => {
    if (!autoFocusEvent) return;
    const scope = getBodyScope();
    if (!scope) return;
    const dereg = scope.$on(autoFocusEvent, () => {
      setTimeout(() => {
        const el = ref.current;
        if (!el) return;
        el.click();
        el.focus();
        el.select();
      }, (ref.current as any)?.dataset?.autoFocusDelay ? Number((ref.current as any).dataset.autoFocusDelay) : 100);
    });
    return () => { try { dereg(); } catch {} };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFocusEvent]);

  const commit = () => {
    const live = findLiveNode(node.id);
    if (!live) return;
    live.newFolderName = draft;
    scopeApply(getBodyScope(), (scope) => {
      scope[commitFn](live, draft);
      // smart folder 的 ng-blur 额外把 editable 关掉（index.html 智能文件夹 input）。
      if (commitFn === 'changeSmartFolderName') live.editable = false;
    });
  };

  return (
    <input
      ref={ref}
      type="text"
      maxLength={2048}
      id={`folder-input-${node.id}`}
      data-auto-focus-event={autoFocusEvent}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onMouseUp={(e) => e.stopPropagation()}
      value={draft}
      onChange={(e) => {
        setDraft(e.target.value);
        const live = findLiveNode(node.id);
        if (live) live.newFolderName = e.target.value;
      }}
      onKeyDown={(e) => callWithNode('onRenameKeydown')(e)}
      onBlur={commit}
      onPaste={(e) => callWithNode('onPasteFolderName')(e)}
      autoFocus
    />
  );
}

function FolderNode({ node, theme, keyword }: { node: SidebarNodeSnapshot; theme: string; keyword: string }) {
  return (
    <div
      data-sidebar-kind="folder"
      data-sidebar-node-id={node.id}
      id={`folder-${node.id}`}
      parent={node.parent}
      className={`item sidebar-folder-item ${node.cls}`}
      style={{ zIndex: 100000 - node.index, height: `${node.size}px` }}
      onClick={(e) => { const live = findLiveNode(node.id); clickNode(e, live); }}
      onContextMenu={(e) => { const live = findLiveNode(node.id); scopeApply(getBodyScope(), (s) => s.openFolderContextMenu(e, live)); }}
      onMouseDown={(e) => { if (e.button === 1) preventMiddleClick(e); }}
      onDoubleClick={(e) => { const live = findLiveNode(node.id); scopeApply(getBodyScope(), (s) => s.rename(e, live)); }}
      onDrop={(e) => scopeApply(getBodyScope(), (s) => s.onDropFolder(e.nativeEvent))}
      onDragEnter={(e) => scopeApply(getBodyScope(), (s) => s.onDragEnterFolder(e.nativeEvent))}
      onDragOver={(e) => scopeApply(getBodyScope(), (s) => s.onDragOverFolder(e.nativeEvent))}
      onDragLeave={(e) => scopeApply(getBodyScope(), (s) => s.onDragLeaveFolder(e.nativeEvent))}
    >
      <div className="guidelines">
        {(node.guidelines || []).map((line, i) => {
          const isLast = i + 1 === (node.styles && node.styles.depth) && (node.children || []).length > 0;
          return (
            <div key={i} className={`guideline color-${line} depth-${i + 1}`}>
              {!isLast && <div className="top" />}
              {!isLast && <div className="middle" />}
              {!isLast && <div className="bottom" />}
            </div>
          );
        })}
      </div>
      <div
        className="expand-icon"
        onClick={(e) => { const live = findLiveNode(node.id); toggleFolderExpand(e, live); }}
        onMouseDown={(e) => e.stopPropagation()}
        onMouseUp={(e) => e.stopPropagation()}
        onContextMenu={(e) => { const live = findLiveNode(node.id); scopeApply(getBodyScope(), (s) => s.openFolderExpandContextMenu(e, live)); }}
      >
        <img src={iconSrc(theme, 'ic-arrow-right.svg')} />
      </div>
      <div className="icon" onDoubleClick={(e) => { const live = findLiveNode(node.id); toggleFolderExpand(e, live); }}>
        <div className="lock-icon lock"><img src={iconSrc(theme, 'ic-lock-folder.svg')} /></div>
        <div className="fake-svg png" />
      </div>
      <div
        className="name"
        onDoubleClick={(e) => { e.stopPropagation(); const live = findLiveNode(node.id); dblclickSidebarFolder(e, live); }}
        title={longTitle(node.name)}
        dangerouslySetInnerHTML={{ __html: fuzzy(keyword, node.name) }}
      />
      <RenameInput node={node} commitFn="changeFolderName" />
      <div className="badge self" onDoubleClick={(e) => { const live = findLiveNode(node.id); toggleFolderExpand(e, live); }}>{num(node.imageCount)}</div>
      <div className="badge descendant" onDoubleClick={(e) => { const live = findLiveNode(node.id); toggleFolderExpand(e, live); }}>{num(node.descendantImageCount)}</div>
      <div className="active-bg" />
      <div className="multiple-drop-folder-top-area" />
      <div className="multiple-drop-folder-name-area" />
      <div className="multiple-drop-folder-bottom-area" />
    </div>
  );
}

function SmartFolderNode({ node, theme, keyword }: { node: SidebarNodeSnapshot; theme: string; keyword: string }) {
  return (
    <div
      data-sidebar-kind="smartFolder"
      data-sidebar-node-id={node.id}
      id={`smart-folder-${node.id}`}
      className={`item depth-${(node.styles && node.styles.depth) || 0} sidebar-smart-folder-item ${node.cls}`}
      style={{ zIndex: 100000 - node.index, height: `${node.size}px` }}
      onClick={(e) => { const live = findLiveNode(node.id); clickSmartNode(e, live); }}
      onContextMenu={(e) => { const live = findLiveNode(node.id); scopeApply(getBodyScope(), (s) => s.openSmartFolderContextMenu(e, live)); }}
      onMouseDown={(e) => { if (e.button === 1) preventMiddleClick(e); }}
    >
      <div className="guidelines">
        {(node.guidelines || []).map((line, i) => (
          <div key={i} className={`guideline color-${line} depth-${i + 1}`}>
            <div className="top" />
            <div className="middle" style={i + 1 === (node.styles && node.styles.depth) && (node.children || []).length > 0 ? { display: 'none' } : undefined} />
            <div className="bottom" />
          </div>
        ))}
      </div>
      <div
        className="expand-icon"
        onClick={(e) => { const live = findLiveNode(node.id); toggleSmartFolderExpand(e, live); }}
        onMouseDown={(e) => e.stopPropagation()}
        onMouseUp={(e) => e.stopPropagation()}
        onContextMenu={(e) => { const live = findLiveNode(node.id); scopeApply(getBodyScope(), (s) => s.openSmartFolderExpandContextMenu(e, live)); }}
      >
        <img src={iconSrc(theme, 'ic-arrow-right.svg')} />
      </div>
      <div className="icon" onDoubleClick={(e) => { const live = findLiveNode(node.id); toggleSmartFolderExpand(e, live); }}>
        <div className="fake-svg png" style={{ WebkitMaskImage: `url(${maskIcon('ic_smart-folder.png')})` }} />
      </div>
      <div
        className="name"
        onDoubleClick={(e) => { e.stopPropagation(); const live = findLiveNode(node.id); scopeApply(getBodyScope(), (s) => s.dblclickSidebarSmartFolderGroup(e, live)); }}
        title={longTitle(node.name)}
        dangerouslySetInnerHTML={{ __html: fuzzy(keyword, node.name) }}
      />
      <RenameInput node={node} commitFn="changeSmartFolderName" autoFocusEvent={`rename-folder-${node.id}`} />
      <div className="badge" onDoubleClick={(e) => { const live = findLiveNode(node.id); toggleSmartFolderExpand(e, live); }}>{num(node.imageCount)}</div>
      <div className="active-bg" />
      <div className="multiple-drop-smart-folder-top-area" />
      <div className="multiple-drop-smart-folder-name-area" />
      <div className="multiple-drop-smart-folder-bottom-area" />
    </div>
  );
}

function QuickAccessNode({ node, theme, keyword }: { node: SidebarNodeSnapshot; theme: string; keyword: string }) {
  const isFolder = node.type === 'folder';
  const name = node.resolvedName || '';
  return (
    <div data-sidebar-kind="quickAccess" data-sidebar-node-id={node.id} id={`quick-access-${node.id}`}>
      <div
        className={`item depth-0 sidebar-quick-access-item ${node.cls}`}
        style={{ zIndex: 100000 - node.index, height: `${node.size}px` }}
        onClick={(e) => {
          const live = findLiveNode(node.id);
          scopeApply(getBodyScope(), (s) => {
            if (isFolder) s.openFolder(s.folderMappings[node.id], false, `quickaccess-${node.id}`);
            else s.openSmartFolder(s.smartFolderMappings[node.id], false, `quickaccess-${node.id}`);
          });
        }}
        onContextMenu={(e) => { const live = findLiveNode(node.id); scopeApply(getBodyScope(), (s) => s.openQuickAccessContextMenu(e, live)); }}
        onMouseDown={(e) => { if (e.button === 1) preventMiddleClick(e); }}
        onDrop={isFolder ? (e) => scopeApply(getBodyScope(), (s) => s.onDropFolder(e.nativeEvent)) : undefined}
        onDragEnter={isFolder ? (e) => scopeApply(getBodyScope(), (s) => s.onDragEnterFolder(e.nativeEvent)) : undefined}
        onDragOver={isFolder ? (e) => scopeApply(getBodyScope(), (s) => s.onDragOverFolder(e.nativeEvent)) : undefined}
        onDragLeave={isFolder ? (e) => scopeApply(getBodyScope(), (s) => s.onDragLeaveFolder(e.nativeEvent)) : undefined}
      >
        <div className="icon">
          <div className="lock-icon lock"><img src={iconSrc(theme, 'ic-lock-folder.svg')} /></div>
          {isFolder ? (
            <div className="fake-svg png" />
          ) : (
            <div className="fake-svg png" style={{ WebkitMaskImage: `url(${maskIcon('ic_smart-folder.png')})` }} />
          )}
        </div>
        <div className="name" title={longTitle(name)} dangerouslySetInnerHTML={{ __html: isFolder ? fuzzy(keyword, name) : name }} />
        <div className="badge">{num(node.resolvedCount)}</div>
        <div className="active-bg" />
        <div className="multiple-drop-quick-access-top-area" />
        <div className="multiple-drop-quick-access-bottom-area" />
      </div>
    </div>
  );
}

function SidebarNodeItem({ node, theme, keyword, viewMode, counts }: {
  node: SidebarNodeSnapshot;
  theme: string;
  keyword: string;
  viewMode: string;
  counts: Record<string, number>;
}) {
  switch (node.vstype) {
    case 'folder':
      return <FolderNode node={node} theme={theme} keyword={keyword} />;
    case 'smartFolder':
      return <SmartFolderNode node={node} theme={theme} keyword={keyword} />;
    case 'quickAccess':
      return <QuickAccessNode node={node} theme={theme} keyword={keyword} />;
    case 'separator':
      return <div className="separator" style={{ zIndex: 100000 - node.index, height: `${node.size}px` }} />;
    case 'label-qucik-access':
      return (
        <div id="quickAccess-header" className="sidebar-item-label" style={{ zIndex: 100000 - node.index, height: `${node.size}px` }}>
          <div className="sidebar-item-label-warp">
            <div className="name expandable" onClick={(e) => scopeApply(getBodyScope(), (s) => s.toggleQuickAccessVisible(e))}>
              {t('sidebar.quickAccessLabel')}
              <span style={counts.quickAccess > 0 ? undefined : { display: 'none' }}> ({counts.quickAccess})</span>
              <span className={`expand${useSidebarState.getState().snapshot.isExpandQuickAccess ? '' : ' collapse'}`}>
                <img src={iconSrc(theme, 'ic-arrow-right.svg')} />
              </span>
            </div>
          </div>
        </div>
      );
    case 'label-smart-folder':
      return (
        <div className="sidebar-item-label" style={{ zIndex: 100000 - node.index, height: `${node.size}px` }}>
          <div className="sidebar-item-label-warp">
            <div className="hide-btns">
              <div
                className="icon-btn"
                tippy=""
                tippy-placement="bottom"
                tippy-content={`${t('sidebar.newSmartFolderHint')}${shortcuts(shortcutsWrapper(useSidebarState.getState().snapshot.keybinds['file.create.smartfolder'] || ''))}`}
                onClick={(e) => scopeApply(getBodyScope(), (s) => s.openNewSmartFolderContextMenu(e))}
              >
                <img src={iconSrc(theme, 'ic-sidebar-add.svg')} />
              </div>
            </div>
            <div className="name expandable" onClick={(e) => scopeApply(getBodyScope(), (s) => s.toggleSmartFolderVisible(e))}>
              {t('sidebar.smartFolderLabel')}
              <span style={counts.smartFolders > 0 ? undefined : { display: 'none' }}> ({counts.smartFolders})</span>
              <span className={`expand${useSidebarState.getState().snapshot.isExpandSmartFolder ? '' : ' collapse'}`}>
                <img src={iconSrc(theme, 'ic-arrow-right.svg')} />
              </span>
            </div>
          </div>
        </div>
      );
    case 'label-folder':
      return (
        <div id="folders-header" className="sidebar-item-label" style={{ zIndex: 100000 - node.index, height: `${node.size}px` }}>
          <div className="sidebar-item-label-warp">
            <div className="hide-btns">
              <div
                id="add-folder-btn"
                className="icon-btn"
                tippy=""
                tippy-placement="bottom"
                tippy-content={`${t('sidebar.newFolderHint')}${shortcuts(shortcutsWrapper(useSidebarState.getState().snapshot.keybinds['file.create.folder'] || ''))}`}
                onClick={(e) => scopeApply(getBodyScope(), (s) => s.newFolder(e))}
              >
                <img src={iconSrc(theme, 'ic-sidebar-add.svg')} />
              </div>
            </div>
            <div className="name expandable" onClick={(e) => scopeApply(getBodyScope(), (s) => s.toggleFolderVisible(e))}>
              {t('sidebar.folderLabel')}
              <span style={counts.folders > 0 ? undefined : { display: 'none' }}> ({counts.folders})</span>
              <span className={`expand${useSidebarState.getState().snapshot.isExpandFolder ? '' : ' collapse'}`}>
                <img src={iconSrc(theme, 'ic-arrow-right.svg')} />
              </span>
            </div>
          </div>
        </div>
      );
    default: {
      // 平铺 item：all / unfiled / untagged / recent / random / community / allTags / trash
      const meta = SIMPLE_META[node.vstype];
      if (!meta) return null;
      const activeView = node.vstype === 'allTags' ? 'alltags' : node.vstype;
      const count = counts[node.vstype] || 0;
      const badgeClickable = node.vstype === 'recent' || node.vstype === 'random' || node.vstype === 'community';
      return (
        <div
          className={`item depth-0${viewMode === activeView ? ' active active-item' : ''}`}
          style={{ zIndex: 100000 - node.index, height: `${node.size}px` }}
          onClick={(e) => scopeApply(getBodyScope(), (s) => s[meta.open] && s[meta.open]())}
          onContextMenu={(e) => scopeApply(getBodyScope(), (s) => s.openSidebarVisibleContextMenu(e))}
          onMouseDown={(e) => { if (e.button === 1) preventMiddleClick(e); }}
        >
          <div className="icon">
            <div className="fake-svg" style={{ WebkitMaskImage: `url(${maskIcon(meta.mask)})` }} />
          </div>
          <div className="name" style={node.vstype === 'community' ? { display: 'flex', alignItems: 'center', gap: '6px' } : undefined}>
            {t(meta.labelKey)}
          </div>
          {badgeClickable ? (
            <div className="badge" onClick={(e) => { e.stopPropagation(); scopeApply(getBodyScope(), (s) => s.openSidebarVisibleContextMenu()); }}>
              <img src={iconSrc(theme, 'ic-more.svg')} />
            </div>
          ) : (
            <div className="badge" style={count ? undefined : { display: 'none' }}>{num(count)}</div>
          )}
          <div className="active-bg" />
        </div>
      );
    }
  }
}

const SIMPLE_META: Record<string, { open: string; mask: string; labelKey: string }> = {
  all: { open: 'openAll', mask: 'ic_all.png', labelKey: 'general.pages.all' },
  unfiled: { open: 'openUnfiled', mask: 'ic_unfield.png', labelKey: 'general.pages.unfiled' },
  untagged: { open: 'openUntagged', mask: 'ic_untaggeds.png', labelKey: 'general.pages.untagged' },
  recent: { open: 'openRecent', mask: 'ic_clock.png', labelKey: 'general.pages.recent' },
  random: { open: 'openRandom', mask: 'ic_random.png', labelKey: 'general.pages.random' },
  community: { open: 'openCommunity', mask: 'ic_community.png', labelKey: 'preferencesWindow.sidebar.community' },
  allTags: { open: 'openAllTags', mask: 'ic_alltags.png', labelKey: 'general.pages.allTags' },
  trash: { open: 'openTrash', mask: 'ic_trashbin.png', labelKey: 'general.pages.trash' },
};

/* ============ 侧栏头部（index.html 81-133） ============ */

function SidebarHeader({ snapshot }: { snapshot: ReturnType<typeof useSidebarState.getState>['snapshot'] }) {
  const { theme, libraryPath, libraryName, keybinds, showSlowNotify, showNTFSWarning, paletteQueuePaused, currentProcessCount } = snapshot;
  return (
    <div className="sidebar-header" onDoubleClick={(e) => { e.preventDefault(); scopeApply(getBodyScope(), (s) => s.maximize(e)); }}>
      {libraryPath ? (
        <div className="sidebar-library-info">
          {!showSlowNotify && showNTFSWarning ? (
            <div id="library-warning" className="ic-btn library-warning show">
              <div className="icon"><img src={iconSrc(theme, 'ic-slow-warning.svg')} alt="" /></div>
              <div className="message" dangerouslySetInnerHTML={{ __html: t('notify.ntfsWarning.message') }} />
            </div>
          ) : null}
          {showSlowNotify ? (
            <div id="library-warning" className="ic-btn library-warning">
              <div className="icon"><img src={iconSrc(theme, 'ic-slow-warning.svg')} alt="" /></div>
              <div className="message" dangerouslySetInnerHTML={{ __html: t('notify.slowDisk.message') }} />
            </div>
          ) : null}
          <span
            id="background-state-spinner"
            className="library-spinner"
            style={{ display: 'none' }}
            tippy=""
            tippy-placement="right"
            tippy-content={`${t(paletteQueuePaused ? 'sidebar.state.title.pausing' : 'sidebar.state.title.analysing')} (${currentProcessCount})`}
            onClick={(e) => { e.stopPropagation(); scopeApply(getBodyScope(), (s) => s.togglePaletteProcessing(e)); }}
          >
            <div className="sm-spiner" style={{ marginTop: 0, display: 'block' }} />
            <div className="pause-icon"><img src={iconSrc(theme, 'ic-status-pause.svg')} /></div>
          </span>
            <div
              className="library-switch-btn"
              tippy=""
              tippy-placement="right"
              tippy-content={`${t('sidebar.switchLibrary')}${shortcuts(shortcutsWrapper(keybinds['library.switch'] || ''))}`}
              onClick={(e) => scopeApply(getBodyScope(), (s) => s.switchLibrary(e))}
              onDoubleClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
            >
              <LibraryIcon libraryPath={libraryPath} />
              <span className="library-name">{libraryName}</span>
              <img src={iconSrc(theme, 'ic_unfold-more.svg')} />
            </div>
        </div>
      ) : null}
      <div className="sidebar-toolbar">
        <div
          className="icon-btn"
          tippy=""
          tippy-placement="bottom"
          tippy-content={`${t('sidebar.addItems')}${shortcuts(shortcutsWrapper(keybinds['file.create.new'] || ''))}`}
          onClick={(e) => scopeApply(getBodyScope(), (s) => s.openNewContextMenu(e))}
        >
          <img src={iconSrc(theme, 'ic_add.svg')} />
        </div>
        <div
          className="icon-btn"
          tippy=""
          tippy-placement="bottom"
          tippy-content={`${t('sidebar.switchFolderBtn')}<key>J</key>`}
          // 兼容钩子：shims 的 source-mode 拦截器靠 ng-click 属性识别该按钮（shims.js:3711）。
          ng-click="openQuickSearch()"
          onClick={(e) => scopeApply(getBodyScope(), (s) => s.openQuickSearch(e))}
        >
          <img src={iconSrc(theme, 'ic_switch.svg')} />
        </div>
        <div
          className="icon-btn"
          tippy=""
          tippy-placement="bottom"
          tippy-content={`${t('context.order.toggle>all')}<key>Tab</key>`}
          onContextMenu={(e) => scopeApply(getBodyScope(), (s) => s.openSidebarMenu(e))}
          onClick={(e) => scopeApply(getBodyScope(), (s) => s.toggleAll(e))}
        >
          <img src={iconSrc(theme, 'ic_toggle-sidebar.svg')} />
        </div>
      </div>
    </div>
  );
}

/* ============ 主组件 ============ */

/** libraryIcon 指令移植（bundle:60358）：資源庫圖標讀取/缺失效無效圖標。 */
function LibraryIcon({ libraryPath }: { libraryPath: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !libraryPath) return;
    const fs = (window as any).require?.('fs');
    const path = (window as any).require?.('path');
    const URL_MODULE = (window as any).require?.('url');
    if (!fs || !path || !URL_MODULE) return;
    const iconPath = path.normalize(`${libraryPath}/icon.png`);
    const iconUrl = URL_MODULE.pathToFileURL(iconPath).href;
    fs.exists(libraryPath, (libraryExists: boolean) => {
      if (!el) return;
      const $item = (window as any).$(`.check-item`).has(el);
      if (!libraryExists) {
        $item.addClass('missing');
        el.innerHTML = `<img src="assets/images/base/icons/ic-library-missing-warning.svg" style="position: absolute; right: -2px; bottom: -2px;">`;
        el.style.backgroundImage = `url(assets/images/base/icons/ic-library-missing.svg)`;
        return;
      }
      $item.removeClass('missing');
      el.innerHTML = '';
      fs.exists(iconPath, (iconExists: boolean) => {
        if (!el) return;
        if (iconExists) el.style.backgroundImage = `url('${iconUrl}?v=${Date.now()}')`;
        else el.style.backgroundImage = `url(assets/images/base/icons/ic-library-small.png)`;
      });
    });
  }, [libraryPath]);
  return <div ref={ref} className="library-icon" library-icon="small" library-path={libraryPath} />;
}

/** selectAll 指令移植（bundle:70600）：Mousetrap mod+a 全選 / esc 失焦。 */
function useSelectAll(ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const Mousetrap = (window as any).Mousetrap;
    if (!Mousetrap) return;
    const trap = new Mousetrap(el);
    trap.bind('mod+a', (event: any) => {
      event && event.stopPropagation();
      (el as unknown as HTMLInputElement).select();
    });
    trap.bind('esc', (event: any) => {
      event && event.stopPropagation();
      (el as HTMLElement).blur();
    });
    return () => {
      try { trap.reset(); } catch {}
    };
  }, []);
}

export function Sidebar() {
  const snapshot = useSidebarState((s) => s.snapshot);
  const [host, setHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setHost(document.getElementById('sidebar'));
  }, []);

  const sizes = useMemo(() => snapshot.nodes.map((n) => n.size || 27), [snapshot.nodes]);
  const listRef = useRef<HTMLDivElement>(null);
  const win = useVirtualWindow(listRef, sizes, snapshot.nodes.length + ':' + snapshot.folderKeyword);

  const windowed = snapshot.nodes.slice(win.startIndex, win.endIndex);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // 拖拽 + tippy 挂接（React 渲染后对子树应用 jQuery UI / tippy）
  useEffect(() => {
    const root = wrapperRef.current;
    if (!root) return;
    const destroyers = [
      initSidebarDrag(root, 'folder'),
      initSidebarDrag(root, 'smartFolder'),
      initSidebarDrag(root, 'quickAccess'),
    ];
    return () => destroyers.forEach((d) => d && d());
  }, [win.startIndex, win.endIndex, snapshot.nodes]);

  const tippyRef = useRef<HTMLDivElement>(null);
  useTippy(tippyRef, snapshot);

  // scroll-to-top（原 #sidebar-item-container 上的 jQuery scroll 绑定，bundle:20305）
  const showTopRef = useRef<HTMLDivElement>(null);
  const scrollTopTimeout = useRef<any>(null);
  const onListScroll = useCallback(() => {
    const container = listRef.current;
    const btn = showTopRef.current;
    if (!container || !btn) return;
    clearTimeout(scrollTopTimeout.current);
    scrollTopTimeout.current = setTimeout(() => {
      if (container.scrollTop >= 360) btn.classList.add('show');
      else btn.classList.remove('show');
    }, 333);
  }, []);

  // #sidebar 宿主上的行为（原 ng-mouseleave / ng-mousedown / 宽度绑定）
  useEffect(() => {
    const host = document.getElementById('sidebar');
    if (!host) return;
    const onMouseLeave = (e: MouseEvent) => scopeApply(getBodyScope(), (s) => s.hoverHideSidebar(e));
    const onMouseDown = (e: MouseEvent) => scopeApply(getBodyScope(), (s) => s.sidebarFocus(e));
    host.addEventListener('mouseleave', onMouseLeave);
    host.addEventListener('mousedown', onMouseDown);
    return () => {
      host.removeEventListener('mouseleave', onMouseLeave);
      host.removeEventListener('mousedown', onMouseDown);
    };
  }, []);

  useEffect(() => {
    const el = document.getElementById('sidebar');
    if (el) el.style.width = `${snapshot.sidebarWidth}px`;
  }, [snapshot.sidebarWidth, host]);

  // 挂载时一次性还原原版静态 inline 样式（#source-mode-footer-add 默认隐藏）。
  useLayoutEffect(() => {
    const wrapper = document.getElementById('source-mode-footer-add');
    if (wrapper) wrapper.style.display = 'none';
  }, [host]);

  if (!host) return null;

  return createPortal(
    <div ref={wrapperRef}>
      <div
        className="icon-btn application-menu-btn fixed"
        style={snapshot.isLoading ? { position: 'absolute', left: '12px', top: '12px' } : { display: 'none', position: 'absolute', left: '12px', top: '12px' }}
        onClick={(e) => scopeApply(getBodyScope(), (s) => s.openApplicationContextMenu(e))}
      >
        <img src={iconSrc(snapshot.theme, 'ic-app-menu.svg')} />
      </div>

      <div id="sidebar-scroll-to-top" ref={showTopRef} className="scroll-to-top">
        <img src={iconSrc(snapshot.theme, 'ic-scroll-top.svg')} />
      </div>

      {snapshot.isUILoaded ? <SidebarHeader snapshot={snapshot} /> : null}

      <div
        className="sidebar-container"
        onDragEnter={(e) => scopeApply(getBodyScope(), (s) => s.onDragEnterSidebar(e.nativeEvent))}
        onDragOver={(e) => scopeApply(getBodyScope(), (s) => s.onDragOverSidebar(e.nativeEvent))}
        onDrop={(e) => scopeApply(getBodyScope(), (s) => s.onDropSidebar(e.nativeEvent))}
      >
        <div className="sidebar-scroll-helper top" />
        <div className="sidebar-scroll-helper bottom" />
        <div
          ref={listRef}
          id="sidebar-item-container"
          className={`sidebar-item-container${snapshot.isCleaningTrash ? ' padding-bottom' : ''}`}
          onScroll={onListScroll}
        >
          <div className="vs-repeat-before-content" style={{ height: `${win.beforeSize}px` }} />
          {windowed.map((node, i) => (
            <div key={`${node.id}-${win.startIndex + i}`}>
              <SidebarNodeItem
                node={node}
                theme={snapshot.theme}
                keyword={snapshot.folderKeyword}
                viewMode={snapshot.viewMode}
                counts={snapshot.counts as unknown as Record<string, number>}
              />
            </div>
          ))}
          <div className="vs-repeat-after-content" style={{ height: `${win.afterSize}px` }} />
        </div>
      </div>

      <div
        className="sidebar-droparea"
        onDrop={(e) => scopeApply(getBodyScope(), (s) => s.onDropSidebar(e.nativeEvent))}
        onDragLeave={(e) => scopeApply(getBodyScope(), (s) => s.onDragLeaveSidebar(e.nativeEvent))}
        onMouseMove={(e) => scopeApply(getBodyScope(), (s) => s.onMouseMoveSidebar(e.nativeEvent))}
      >
        <div className="tips">{t('pages.droparea.sidebar')}</div>
      </div>

      <div className="sidebar-footer">
        {/* 原版为静态 inline display:none（Angular 不再重写它）；这里同样只在挂载时设一次，
            之后由 source-mode 逻辑直接改写 display，React 不回收。 */}
        <div id="source-mode-footer-add">
          <button id="source-mode-add-folder" type="button" className="source-mode-footer-button">＋ 添加来源文件夹</button>
        </div>
        <FolderSearchInput keyword={snapshot.folderKeyword} />
      </div>
    </div>,
    host
  );
}

/** 侧栏底部資料夾篩選輸入（selectall 指令 + ng-model-options debounce 50ms）。 */
function FolderSearchInput({ keyword }: { keyword: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(keyword);
  const debounceRef = useRef<any>(null);
  useSelectAll(ref);

  useEffect(() => { if (document.activeElement !== ref.current) setDraft(keyword); }, [keyword]);

  return (
    <input
      ref={ref}
      id="folder-search"
      tabIndex={-1}
      maxLength={1024}
      type="search"
      className="search"
      placeholder={t('sidebar.filterLabel')}
      value={draft}
      onChange={(e) => {
        const value = e.target.value;
        setDraft(value);
        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
          scopeApply(getBodyScope(), (s) => { s.folderKeyword = value; });
        }, 50);
      }}
      onBlur={() => {
        clearTimeout(debounceRef.current);
        scopeApply(getBodyScope(), (s) => { s.folderKeyword = draft; });
      }}
    />
  );
}
