import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getBodyScope, getRootScope } from '../../global/scopeBridge';
import { t } from '../../global/eagleGlobals';
import { usePanelState } from '../../store/panelState';
import { $, getIpc } from '../detail/detailHooks';
import { fuzzyMatchHtml } from './ContextMenu';
import { TagSelectPanel, TagSelectPanelItem } from './selectPanelEngine';

/**
 * 阶段7d-1c-1：tagsInput + generalTagSelectPanel + AutoTaggingController 接管。
 *
 * 规范来源：
 * - vsGridRepeat 指令 = bundle 14686-15106（网格虚拟化：calculateColumns/calculatePositions/
 *   binarySearch/calculateVisibleItems；渲染差分由 React 重渲染等价）
 * - generalTagSelectPanel 指令 = bundle 58122-58256 + js/directives/general-tag-select-panel.html
 *   （GeneralTagSelectPanel 类 58115-58120 仅静态 open 广播）
 * - tagsInput 指令 = bundle 64443-64489 + js/directives/tags-input.html
 * - AutoTaggingController = bundle 74190-74316 + index.html 模板逐字
 *
 * 通道零改动：GENERAL.TAG.SELECT.PANEL.OPEN / INSPECTOR.TAG.SELECT.PANEL.OPEN 广播、
 * FOLDER_SETTINGS 广播、ipc 'image-change'；localStorage 键 eagle.tagsPopup.* 原样。
 */

const iv = (v: any): any => (v === undefined || v === null ? '' : v);
const ngShow = (show: boolean) => (show ? undefined : { display: 'none' } as React.CSSProperties);
const themePathOf = (theme: string) => (theme === 'light' || theme === 'lightgray' ? 'light' : 'dark');

export function openGeneralTagSelectPanel(params: any) {
  // GeneralTagSelectPanel 类（58115-58120）：$rootScope（html scope）广播
  const rootScope = getRootScope();
  if (rootScope) rootScope.$broadcast('GENERAL.TAG.SELECT.PANEL.OPEN', params);
}

/* ================= vsGridRepeat 指令（14686-15106）→ useVsGridRepeat ================= */

interface VsGridPos {
  type: 'group' | 'item';
  id: any;
  name?: any;
  x: number;
  y: number;
  width: number;
  height: number;
  group?: any;
  item?: any;
  index?: number;
}

function useVsGridRepeat(
  containerRef: React.RefObject<HTMLElement | null>,
  groups: any[] | undefined,
  options: any,
  target: { vsGridItems: any[]; vsGridState: any } | null,
  version: number
) {
  const [, bump] = useState(0);
  const lastTotalHeightRef = useRef(0);

  // options 深度变化 / collection 变化 → needReCalculate；render 事件与滚动 → 普通重渲染
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const jQuery = $();
    const $container = jQuery ? jQuery(container) : null;

    let scrollTimeout: any;
    const onScroll = () => {
      scrollTimeout = setTimeout(() => bump((v) => v + 1), 32);
    };
    container.addEventListener('scroll', onScroll, { passive: true });

    let renderTimeout: any;
    const resizeObserver = new ResizeObserver(() => {
      clearTimeout(renderTimeout);
      renderTimeout = setTimeout(() => bump((v) => v + 1), 100);
    });
    resizeObserver.observe(container);

    // element.on("render") —— panel.render() 经 jQuery trigger 通知重渲染
    let offRender: any;
    if ($container) {
      $container.on('render', () => bump((v) => v + 1));
      offRender = () => $container.off('render');
    }

    // setupScrollHandlers（scrolling class + onScrollStart/End）
    let isScrolling: any;
    let scrollStarted = false;
    const onScrollStartEnd = () => {
      if (!scrollStarted && options?.onScrollStart) {
        options.onScrollStart();
        scrollStarted = true;
      }
      clearTimeout(isScrolling);
      isScrolling = setTimeout(() => {
        if (options?.onScrollEnd) options.onScrollEnd();
        scrollStarted = false;
      }, 100);
    };
    container.addEventListener('scroll', onScrollStartEnd, { passive: true });

    return () => {
      container.removeEventListener('scroll', onScroll);
      container.removeEventListener('scroll', onScrollStartEnd);
      resizeObserver.disconnect();
      clearTimeout(scrollTimeout);
      clearTimeout(renderTimeout);
      if (offRender) offRender();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef.current, options]);

  return useMemo(() => {
    const container = containerRef.current;
    if (!container || !groups) return { visible: [] as VsGridPos[], totalHeight: 0, columns: 0 };

    const columnWidth = options.columnWidth;
    let columnHeight = options.columnHeight;
    const columnGap = options.columnGap;
    const rowGap = options.rowGap;
    const extraRange = options.extraRange;
    const groupLabelHeight = options.groupLabelHeight;
    const squareMode = options.squareMode;
    const listMode = options.listMode;
    const paddingTop = options.paddingTop ?? options.padding ?? 0;
    const paddingBottom = options.paddingBottom ?? options.padding ?? 0;
    const paddingLeft = options.paddingLeft ?? options.padding ?? 0;
    const paddingRight = options.paddingRight ?? options.padding ?? 0;

    // calculateColumns（14770-14805 逐字）
    const containerWidth = container.clientWidth - paddingLeft - paddingRight;
    let totalHeight = 0;
    let columns = 0;

    if (listMode) {
      columns = 1;
    } else {
      columns = Math.floor(containerWidth / (columnWidth + columnGap));
    }
    columns = columns < 1 ? 1 : columns;

    const hideGroup = groups.length === 1;

    groups.forEach((group: any, index: number) => {
      const groupHeight = index === 0 ? groupLabelHeight - paddingTop : groupLabelHeight;
      if (!hideGroup) {
        totalHeight += groupHeight; // Group label height
      }
      if (group.isCollapsed) {
        return;
      }
      totalHeight += Math.ceil(group.items.length / columns) * (columnHeight + rowGap); // Item heights
    });

    totalHeight += paddingTop; // Padding
    totalHeight += paddingBottom; // Padding
    totalHeight += paddingTop; // Padding

    if (target) {
      target.vsGridState.totalHeight = totalHeight;
      target.vsGridState.columns = columns;
    }

    // calculatePositions（14807-14878 逐字）
    const vsGridItems: VsGridPos[] = [];
    const itemMaps: any = {};
    let currentGroupTop = paddingTop ?? 0;

    groups.forEach((group: any, index: number) => {
      const groupHeight = index === 0 ? groupLabelHeight - paddingTop : groupLabelHeight;

      if (!hideGroup) {
        vsGridItems.push({
          type: 'group',
          id: group.id,
          name: group.name,
          x: paddingLeft ?? 0,
          y: currentGroupTop,
          width: containerWidth,
          height: groupHeight,
          group: group,
          index: index,
        });

        currentGroupTop += groupHeight; // Move down for the group label

        if (index !== 0) {
          currentGroupTop += 8;
        }

        // Store positions for items in the group
        if (group.isCollapsed) {
          return;
        }
      }

      let itemRow = 0; // Reset item row for each group
      group.items.forEach((item: any) => {
        const row = Math.floor(itemRow / columns);
        const col = itemRow % columns;
        const top = currentGroupTop + row * (columnHeight + rowGap); // Calculate top position based on group
        const adaptedWidth = containerWidth / columns - columnGap + columnGap / columns;
        const left = col === 0 ? paddingLeft : col * (adaptedWidth + columnGap) + paddingLeft;

        if (squareMode) {
          columnHeight = adaptedWidth;
        }

        if (listMode) {
          void adaptedWidth;
          void left;
        }

        vsGridItems.push({
          type: 'item',
          id: item.id,
          name: item.name,
          x: listMode ? paddingLeft : left,
          y: top,
          width: listMode ? containerWidth : adaptedWidth,
          height: columnHeight,
          item: item,
        });
        itemMaps[item.id] = item;

        itemRow++; // Increment item row for the next item
      });

      currentGroupTop += Math.ceil(group.items.length / columns) * (columnHeight + rowGap); // Move down for items
    });

    // 共享位置数组（panel.vsGridItems —— scrollToItem/scrollToGroup 消费）
    if (target) {
      target.vsGridItems.length = 0;
      vsGridItems.forEach((pos) => target.vsGridItems.push(pos));
    }

    // calculateVisibleItems（14894-14919 逐字）
    const binarySearch = (items: VsGridPos[], targetY: number, start: number, end: number) => {
      while (start <= end) {
        const mid = Math.floor((start + end) / 2);
        if (items[mid].y < targetY) {
          start = mid + 1;
        } else {
          end = mid - 1;
        }
      }
      return start; // 返回第一个大于或等于 target 的索引
    };

    const scrollTop = container.scrollTop;
    const containerHeight = container.clientHeight;
    const visibleItems: VsGridPos[] = [];

    const startIndex = binarySearch(vsGridItems, Math.max(0, scrollTop - extraRange), 0, vsGridItems.length - 1);
    const endIndex = binarySearch(vsGridItems, scrollTop + containerHeight + extraRange, 0, vsGridItems.length - 1);

    // 仅遍历可见项的范围
    for (let i = startIndex; i <= endIndex; i++) {
      const pos = vsGridItems[i];
      if (!pos) continue;
      if (pos.y < scrollTop + containerHeight + extraRange && pos.y + pos.height > scrollTop - extraRange) {
        visibleItems.push(pos);
      }
    }

    return { visible: visibleItems, totalHeight, columns };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups, options, version, containerRef.current]);
}

/* ================= generalTagSelectPanel（58122-58256 + 模板逐字） ================= */

export function GeneralTagSelectPanel() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const { snapshot } = usePanelState();
  const theme = snapshot.theme;
  const [, bump] = useState(0);
  const rootRef = useRef<HTMLElement>(null);
  const listRef = useRef<HTMLElement | null>(null);
  const panelRef = useRef<TagSelectPanel | null>(null);

  useEffect(() => {
    setHost(document.getElementById('eagle-general-tag-select-panel-host'));
  }, []);

  useEffect(() => {
    if (!host || !rootRef.current) return;
    const jQuery = $();

    const panel = new TagSelectPanel({
      showCreateTagBtn: false,
      fixedSize: true,
      notify: () => bump((v) => v + 1),
      panelSelector: 'general-tag-select-panel .tag-select-panel',
      searchInputSelector: 'general-tag-select-panel .panel-header input',
    });
    panelRef.current = panel;
    // 闭环测试契约（与 __eagleInspectorActions 同类）：CDP 直接访问面板实例
    (window as any).__eagleTagSelectPanel = panel;

    // initWindowResize（58151-58182 逐字）
    let resizeTimeout: any;
    const onWindowResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        if (panel.isPined) {
          const $selectPanel = jQuery('.general-tag-select-panel-live select-panel');
          if (!$selectPanel || !$selectPanel.hasClass('open')) return;

          const windowHeight = jQuery(window).height();
          const windowWidth = jQuery(window).width();
          const popupHeight = $selectPanel.height();
          const popupWidth = $selectPanel.width();
          const popupTop = $selectPanel.offset().top;
          const popupLeft = $selectPanel.offset().left;

          // 確保面板不會超出視窗右邊界
          if (popupLeft + popupWidth > windowWidth) {
            const move = popupLeft + popupWidth - windowWidth + 20;
            $selectPanel.css('left', `${popupLeft - move}px`);
          }

          // 確保面板不會超出視窗下邊界
          if (popupHeight + 60 + popupTop > windowHeight) {
            let newHeight = windowHeight - 60;
            const height = Math.max(120, newHeight - popupTop);
            $selectPanel.height(height);
            void newHeight;
          }
        }
      }, 333);
    };
    jQuery(window).on('resize.inspectTagSelect', onWindowResize);

    // initDraggable / initResizable（jQuery UI，缺失時跳過）
    let dragOriginalSize: any = {};
    if (jQuery && jQuery.fn && (jQuery as any).fn.draggable && rootRef.current) {
      const $selectPanel = jQuery(rootRef.current).find('.select-panel');
      $selectPanel.draggable({
        scroll: false,
        distance: 5,
        containment: 'body',
        start: (e: any, ui: any) => {
          dragOriginalSize = {
            height: ui.helper.outerHeight(),
            width: ui.helper.outerWidth(),
          };
        },
        stop: () => {
          $selectPanel.height(dragOriginalSize.height);
          $selectPanel.width(dragOriginalSize.width);
          panel.fixedSize = true;
        },
      });
      $selectPanel.resizable({
        maxWidth: 800,
        minWidth: 200,
        minHeight: 160,
        maxHeight: 920,
        containment: 'body',
        handles: 'n, e, s, w, ne, se, sw, nw',
        // 保存用戶設置的尺寸到 localStorage
        stop: (event: any, ui: any) => {
          const height = ui.element.innerHeight();
          const width = ui.element.innerWidth();
          localStorage.setItem('eagle.tagsPopup.height', height);
          localStorage.setItem('eagle.tagsPopup.width', width);
          panel.height = height;
          panel.width = width;
          panel.fixedSize = true;
        },
      });
    }

    // initWatcher（58227-58243 逐字）
    const scope = getBodyScope();
    let off: any;
    if (scope) {
      const offOpen = scope.$on('GENERAL.TAG.SELECT.PANEL.OPEN', (event: any, params: any) => {
        setTimeout(() => {
          panel.init(params);
          bump((v) => v + 1);
        }, 10);
        setTimeout(() => {
          panel.open();
        }, 0);
        bump((v) => v + 1);
      });
      off = offOpen;
    }

    return () => {
      jQuery(window).off('resize.inspectTagSelect');
      if (off) off();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host]);

  const panel = panelRef.current;
  const listData = panel?.listData;

  const grid = useVsGridRepeat(
    listRef,
    listData?.groups,
    panel?.vsGridRepeatOptions,
    panel ? { vsGridItems: panel.vsGridItems, vsGridState: panel.vsGridState } : null,
    listData?.groups?.length ?? 0
  );

  if (!host) return null;

  const classOf = (obj: any) =>
    Object.keys(obj)
      .filter((k) => obj[k])
      .join(' ');

  const hasSidebar = !!(panel && panel.isShowSidebar && listData?.tagGroups?.length > 0);

  const renderGroupLabel = (pos: VsGridPos) => {
    const group = pos.group;
    return (
      <group>
        <div
          className={`group-label${!group.isCollapsed ? ' expand' : ''}`}
          onClick={() => panel!.toggleGroup(group.id)}
          onContextMenu={(e) => {
            e.preventDefault();
            panel!.toggleAllGroups(group.id);
          }}
        >
          <div className="name">
            {group.name} <span>({group.items.length})</span>
          </div>
          <div
            className="ic-btn expand"
            tippy=""
            tippy-placement="bottom"
            tippy-content={`${t('selectTagPanel.expandLabel')}<key>${t('general.r-click')}</key>`}
          >
            <img src={`assets/images/${themePathOf(theme)}/icons/ic-inspector-expand.svg`} />
          </div>
        </div>
      </group>
    );
  };

  const renderItem = (pos: VsGridPos) => {
    const item = pos.item;
    const currentItem = listData?.currentItem;
    return (
      <item>
        <div
          className={`select-panel-item ${classOf({
            active: currentItem && item.id === currentItem.id,
            checked: !!(listData && listData.selectedTags[item.name]),
          })}`}
          onClick={(e) => panel!.openItem(e)}
          onMouseEnter={(e) => panel!.hoverItem(e.nativeEvent, item)}
        >
          {item.type === 'create' ? (
            <div
              className={`list-item create color-${iv(listData?.currentGroup?.color)} create${currentItem && item.id == currentItem.id ? ' active' : ''}`}
              style={{ height: '25px', lineHeight: '25px' }}
            >
              <div className="icon">
                <div className="fake-svg png"></div>
              </div>
              <div className="name">
                {t('selectTagPanel.newTagBtn')} "<b>{item.name}</b>"
              </div>
            </div>
          ) : (
            <div
              className={`list-item color-${iv(item.color)} ${classOf({
                active: currentItem && item.id == currentItem.id,
                selected: !!(listData && listData.selectedTags[item.name]),
                'search-mode': listData?.currentTab === 'SELECTED' || listData?.searchKeyword?.length > 0 || false,
                recent: !!item.isRecent,
                suggestion: !!item.isSuggestion && !item.isExist,
                starred: !!item.isStarred,
              })}`}
              style={{ height: '25px', lineHeight: '25px' }}
            >
              <div className="icon">
                <div className="fake-svg png"></div>
              </div>
              <div className="name" title={iv(item.name)} dangerouslySetInnerHTML={{ __html: fuzzyMatchHtml(item.name, listData?.searchKeyword || '') }}></div>
              <div className="right">
                {panel!.isShowCount && item.imageCount ? (
                  <div className="count">
                    <span>(</span>
                    {iv(item.imageCount)}
                    <span>)</span>
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </item>
    );
  };

  return createPortal(
    <general-tag-select-panel ref={rootRef as any}>
      <select-panel
        className={`select-panel tag-select-panel${hasSidebar ? ' has-sidebar' : ''}`}
        onMouseUp={() => panel && panel.focusSearchInput()}
      >
        <div className="panel-header">
          {/* 搜索框 */}
          <div className="search">
            <input id="tag-select-panel-search-input" type="search" maxLength={128} placeholder={t('general.search')} />
          </div>

          {/* 隱藏側欄按鈕 */}
          <div
            className={`ic-btn${panel?.isShowSidebar ? ' active' : ''}`}
            onClick={() => panel && panel.toggleSidebar()}
            style={ngShow(!!(listData?.tagGroups?.length > 0))}
          >
            <img src={`assets/images/${themePathOf(theme)}/icons/ic_toggle-sidebar.svg`} />
          </div>

          {/* 設置按鈕 */}
          <div className="ic-btn" onClick={() => panel && panel.openSettings()}>
            <img src={`assets/images/${themePathOf(theme)}/icons/ic-tag-settings.svg`} />
          </div>
        </div>

        <div className={`panel-container${hasSidebar ? ' has-sidebar' : ''}`}>
          <div className="panel-sidebar">
            {/* 全部標籤群組 */}
            <div className="panel-sidebar-item" onClick={() => panel && (panel as any).selectGroup(undefined)} style={ngShow(!!panel)}>
              <div className="icon">
                <div className="fake-svg png" style={{ WebkitMaskImage: 'url(assets/images/base/icons/ic-tag-all.png)', WebkitMaskSize: '10px' }}></div>
              </div>
              <div className="name">{t('selectTagPanel.sidebar.all')}</div>
              <div className="right">{listData?.tagGroupsCountMap?.['all'] ? <div className="count">{listData.tagGroupsCountMap['all']}</div> : null}</div>
            </div>
            {/* 單個標籤群組 */}
            {(listData?.tagGroups || []).map((group: any) => (
              <div
                key={group.id}
                className={`panel-sidebar-item color-${iv(group.color)}${listData?.sidebarGroup?.id === group.id ? ' active' : ''}`}
                onClick={() => panel && panel.selectGroup(group)}
              >
                <div className="icon">
                  <div className="fake-svg png"></div>
                </div>
                <div className="name">{group.name}</div>
                <div className="right">
                  <div className="count">{listData?.tagGroupsCountMap?.[group.id]}</div>
                </div>
              </div>
            ))}
            {/* 未分類標籤群組 */}
            <div
              className={`panel-sidebar-item${listData?.sidebarGroup?.id === 'none' ? ' active' : ''}`}
              onClick={() => panel && panel.selectGroup('none')}
            >
              <div className="icon">
                <div className="fake-svg png" style={{ WebkitMaskImage: 'url(assets/images/base/icons/ic-tag-unfiled.png)', WebkitMaskSize: '10px' }}></div>
              </div>
              <div className="name">{t('selectTagPanel.sidebar.unfiled')}</div>
              <div className="right">
                {listData?.tagGroupsCountMap?.['none'] ? <div className="count">{listData.tagGroupsCountMap['none']}</div> : null}
              </div>
            </div>
          </div>

          {/* 項目列表 */}
          <div className="panel-list">
            {/* 空狀態（初始化時） */}
            {panel?.isInit && listData?.items?.length === 0 && listData?.groups?.length == 0 ? (
              <div className="panel-empty">
                <span>{t('selectTagPanel.empty.all')}</span>
              </div>
            ) : null}

            <select-panel-list className="grid-container" columns={grid.columns} ref={listRef}>
              <div className="grid-placeholder" style={{ height: `${grid.totalHeight}px`, pointerEvents: 'none' }} />
              {grid.visible.map((pos) =>
                pos.type === 'group' ? (
                  <div
                    key={`g-${pos.id}`}
                    className="grid-group-label"
                    data-id={encodeURIComponent(pos.id)}
                    {...(pos.index !== undefined ? { index: pos.index } : {})}
                    style={{ transform: 'translateZ(0)', top: `${pos.y}px`, left: `${pos.x}px`, height: `${pos.height}px`, width: `${pos.width}px` }}
                  >
                    {renderGroupLabel(pos)}
                  </div>
                ) : (
                  <div
                    key={pos.id}
                    className="grid-item"
                    data-id={encodeURIComponent(pos.id)}
                    style={{ transform: 'translateZ(0)', width: `${pos.width}px`, height: `${pos.height}px`, top: `${pos.y}px`, left: `${pos.x}px` }}
                  >
                    {renderItem(pos)}
                  </div>
                )
              )}
            </select-panel-list>
          </div>
        </div>

        <div className="panel-footer">
          <div className="left">
            <div className="shortcut-tip" style={ngShow(!!panel?.isShowSidebar)}>
              {t('selectTagPanel.shortcuts.switch')}
              <key>Tab</key>
            </div>
            <div className="shortcut-tip">
              {t('selectTagPanel.shortcuts.move')}
              <div className="keys">
                <key>↑</key>
                <key>↓</key>
                <key>←</key>
                <key>→</key>
              </div>
            </div>
            <div className="shortcut-tip">
              {t('selectTagPanel.shortcuts.select')}
              <key>︎⏎</key>
            </div>
          </div>
          <div className="right">
            <div className="shortcut-tip">
              {t('selectTagPanel.shortcuts.close')}
              <key>︎ESC</key>
            </div>
          </div>
        </div>

        {/* 標籤設置面板 */}
        <div
          className={`setting-panel${panel?.isOpenSettings ? ' open' : ''}`}
          style={{ right: '6px' }}
          onMouseDown={(e) => e.stopPropagation()}
          onMouseUp={(e) => e.stopPropagation()}
        >
          <div className="setting-panel-container">
            {/* 布局設置 */}
            <div className="panel-item" style={{ marginTop: '4px' }}>
              <div className="label">{t('selectTagPanel.settings.layout')}</div>
              <div className="value">
                <div className="btn-group">
                  <div
                    className={`btn${panel?.vsGridRepeatOptions?.listMode ? ' active' : ''}`}
                    onClick={() => panel && panel.setListMode(true)}
                  >
                    <img src={`assets/images/${themePathOf(theme)}/icons/ic-layout-list.svg`} />
                  </div>
                  <div
                    className={`btn${!panel?.vsGridRepeatOptions?.listMode ? ' active' : ''}`}
                    onClick={() => panel && panel.setListMode(false)}
                  >
                    <img src={`assets/images/${themePathOf(theme)}/icons/ic-layout-grid.svg`} />
                  </div>
                </div>
              </div>
            </div>
            {/* 列寬設置 */}
            <div className="panel-item" style={{ marginTop: '4px', ...(ngShow(!panel?.vsGridRepeatOptions?.listMode) || {}) }}>
              <div className="label">{t('selectTagPanel.settings.columnSize.label')}</div>
              <div className="value">
                <div className="select select-xs" onClick={(e) => e.stopPropagation()}>
                  <select
                    tabIndex={-1}
                    value={panel?.columnSize ?? 'small'}
                    onChange={(e) => {
                      if (panel) {
                        panel.columnSize = e.target.value;
                        panel.setColumnSize(e.target.value);
                      }
                      bump((v) => v + 1);
                    }}
                  >
                    <option value="large">{t('selectTagPanel.settings.columnSize.l')}</option>
                    <option value="medium">{t('selectTagPanel.settings.columnSize.m')}</option>
                    <option value="small">{t('selectTagPanel.settings.columnSize.s')}</option>
                    <option value="xsmall">{t('selectTagPanel.settings.columnSize.xs')}</option>
                  </select>
                  <div className="select-content">
                    {panel?.columnSize == 'large' ? <div className="select-value">{t('selectTagPanel.settings.columnSize.l')}</div> : null}
                    {panel?.columnSize == 'medium' ? <div className="select-value">{t('selectTagPanel.settings.columnSize.m')}</div> : null}
                    {panel?.columnSize == 'small' ? <div className="select-value">{t('selectTagPanel.settings.columnSize.s')}</div> : null}
                    {panel?.columnSize == 'xsmall' ? <div className="select-value">{t('selectTagPanel.settings.columnSize.xs')}</div> : null}
                  </div>
                </div>
              </div>
            </div>

            <div className="separator"></div>

            {/* 顯示標籤設置 */}
            <div className="panel-item" onClick={() => panel && panel.toggleStarredTags()}>
              <div className="label">{t('selectTagPanel.label.starred')}</div>
              <div className="value">
                <label className="toggle" onClick={(e) => e.preventDefault()}>
                  <input type="checkbox" readOnly checked={!!panel?.isShowStarredTags} />
                  <span className="slider"></span>
                </label>
              </div>
            </div>

            <div className="panel-item" onClick={() => panel && panel.toggleRecentTags()}>
              <div className="label">{t('selectTagPanel.label.recent')}</div>
              <div className="value">
                <label className="toggle" onClick={(e) => e.preventDefault()}>
                  <input type="checkbox" readOnly checked={!!panel?.isShowRecentTags} />
                  <span className="slider"></span>
                </label>
              </div>
            </div>

            <div className="panel-item" onClick={() => panel && panel.toggleSuggestedTags()}>
              <div className="label">{t('selectTagPanel.label.recommend')}</div>
              <div className="value">
                <label className="toggle" onClick={(e) => e.preventDefault()}>
                  <input type="checkbox" readOnly checked={!!panel?.isShowSuggestedTags} />
                  <span className="slider"></span>
                </label>
              </div>
            </div>

            <div className="panel-item" onClick={() => panel && panel.toggleCount()}>
              <div className="label">{t('selectTagPanel.displayProperties.count')}</div>
              <div className="value">
                <label className="toggle" onClick={(e) => e.preventDefault()}>
                  <input type="checkbox" readOnly checked={!!panel?.isShowCount} />
                  <span className="slider"></span>
                </label>
              </div>
            </div>
          </div>
        </div>
      </select-panel>
    </general-tag-select-panel>,
    host
  );
}

// select-panel-list 容器 ref（useVsGridRepeat 用；经由渲染后 ref 绑定）
/* ================= tagsInput 指令（64443-64489 + tags-input.html 逐字） ================= */

export function TagsInput({
  theme,
  tags,
  onTagsReplace,
  onChange,
  style,
}: {
  theme: string;
  tags: any[];
  onTagsReplace?: (next: any[]) => void;
  onChange?: () => void;
  style?: React.CSSProperties;
}) {
  const tagsRef = useRef(tags);
  tagsRef.current = tags;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onTagsReplaceRef = useRef(onTagsReplace);
  onTagsReplaceRef.current = onTagsReplace;

  const openPanel = (e: any) => {
    e.stopPropagation();
    const body = getBodyScope();
    const originSelected = tagsRef.current.reduce((map: any, tag: any) => {
      map[tag] = true;
      return map;
    }, {});

    openGeneralTagSelectPanel({
      tagManager: body?.TagManager,
      selectedTags: originSelected,
      // showCreateTagBtn: false,
      onChanged: (result: any) => {
        const { selectedTags } = result;
        // $scope.tags = Object.keys(selectedTags) —— '=' 双向绑定写回父级数组引用
        if (onTagsReplaceRef.current) onTagsReplaceRef.current(Object.keys(selectedTags));
        setTimeout(() => {
          onChangeRef.current && onChangeRef.current();
        }, 0);
      },
    });
  };

  const remove = (tag: any) => {
    const index = tagsRef.current.indexOf(tag);
    if (index >= 0) {
      tagsRef.current.splice(index, 1);
      bumpLocal();
      onChangeRef.current && onChangeRef.current();
    }
  };

  const [, setBump] = useState(0);
  const bumpLocal = () => setBump((v) => v + 1);

  return (
    <div id="tags-input" className="labels-input" style={style} onClick={openPanel}>
      <div className="empty" style={ngShow(tags.length === 0)}>
        {t('inspector.tagInputPlaceholder')}
      </div>
      <div className="label-container">
        {tags.map((tag: any, index: number) => (
          <div className="label-item" key={index}>
            <span className="label-item-name">{tag}</span>
            <div
              className="ic-btn label-item-remove-btn"
              onClick={(e) => {
                e.stopPropagation();
                remove(tag);
              }}
            >
              <img src={`assets/images/${themePathOf(theme)}/icons/ic-inspector-remove-label.svg`} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ================= AutoTaggingController（74190-74316 + 模板逐字） ================= */

export function AutoTaggingModal() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const { snapshot } = usePanelState();
  const theme = snapshot.theme;
  const [open, setOpen] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [folderTags, setFolderTags] = useState<any[]>([]);
  const folderRef = useRef<any>(undefined);
  const folderTagsRef = useRef<any[]>([]);
  const originalTagsRef = useRef<any>(undefined);
  const currentFolderChildrenRef = useRef<any>(undefined);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setHost(document.getElementById('eagle-auto-tagging-host'));
  }, []);

  useEffect(() => {
    const scope = getBodyScope();
    if (!scope) return;
    const off = scope.$on('FOLDER_SETTINGS', (e: any, folder: any) => {
      folderRef.current = folder;
      setOpen(true);
      setFolderName(folder.name);
      const nextTags: any[] = [];
      folderTagsRef.current = nextTags;
      setFolderTags(nextTags);
      originalTagsRef.current = folder.tags.join(',');

      if (folder.tags && folder.tags.length > 0) {
        folder.tags.forEach((tag: any) => {
          nextTags.push(tag);
        });
      }
      setTimeout(() => {
        const input = document.getElementById('auto-tagging-name-input');
        if (input) input.setAttribute('tabindex', '101');
      }, 100);
      bump2();
    });
    return () => off();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host]);

  const [, setBump] = useState(0);
  const bump2 = () => setBump((v) => v + 1);

  const nameKeydown = (event: any) => {
    const keyCode = event.keyCode;
    if (keyCode === 27) {
      cancel();
    } else if (keyCode === 13) {
      if (event.metaKey || event.ctrlKey) {
        (event.target as HTMLElement)?.blur?.();
        save();
      }
    }
    // selectall 指令（mod+a / esc）
    if ((event.ctrlKey || event.metaKey) && String(event.key || '').toLowerCase() === 'a') {
      event.stopPropagation();
      nameInputRef.current?.select();
    } else if (keyCode === 27) {
      event.stopPropagation();
      nameInputRef.current?.blur();
    }
  };

  // 判断图片是否属于当前文件夹（74283-74307 逐字）
  const isInFolder = (image: any, folder: any, ignore: any) => {
    void ignore;
    const w = window as any;
    // 状况1: 该资料夹本身包含图片
    const isContain = image.folders.indexOf(folder.id) > -1;

    // 加速版本作法，更快判断图片是否存在于子文件夹
    if (currentFolderChildrenRef.current) {
      for (let i = 0; i < image.folders.length; i++) {
        const folderId = image.folders[i];
        if (currentFolderChildrenRef.current[folderId]) {
          return true;
        }
      }
    } else {
      let found = false;
      w.eagle.utils.tree.walk(folder.children, 'children', (child: any) => {
        if (image.folders && image.folders.length > 0 && image.folders.indexOf(child.id) > -1) {
          found = true;
          return;
        }
      });
      return found;
    }

    return isContain;
  };

  const getChildFoldersMap = (folder: any) => {
    const childs: any = {};
    (window as any).eagle.utils.tree.walk(folder.children, 'children', (child: any) => {
      childs[child.id] = true;
    });
    return childs;
  };

  const save = () => {
    const body = getBodyScope();
    const rootScope = getRootScope();
    setOpen(false);
    const folder = folderRef.current;
    if (!folder) return;
    const needUpdateFolder = folderName !== folder.name;
    folder.name = folderName;
    folder.tags = [];
    folderTagsRef.current.forEach((tag: any) => {
      folder.tags.push(tag);
    });

    currentFolderChildrenRef.current = getChildFoldersMap(folder);

    let needUpdateTags = true;

    if (originalTagsRef.current === folder.tags.join(',')) {
      needUpdateTags = false;
    }

    // 將標籤加入到資料夾的圖片中
    if (needUpdateTags) {
      body.raw.forEach((image: any) => {
        if (isInFolder(image, folder, true)) {
          if (image.tags) {
            const tags = image.tags.join();
            folder.tags.forEach((tag: any) => {
              image.tags.push(tag);
            });
            image.tags = [...new Set(image.tags)];
            if (tags != image.tags.join()) {
              getIpc().send('image-change', image);
            }
          }
        }
      });
    }

    // 有更动才需要更新
    if (needUpdateFolder || needUpdateTags) {
      rootScope.$broadcast('SAVE_FOLDER');
      rootScope.$broadcast('CALCULATE_IMAGE_BINDING');
      rootScope.$broadcast('UPDATE_SELECTION');
      try {
        if ((window as any).electronLog) (window as any).electronLog.info(`[app] Change folder auto-tags: ${folder.name}(${folder.id}) tags: ${JSON.stringify(folderTagsRef.current)}`);
      } catch (err) {}
    }

    const input = document.getElementById('auto-tagging-name-input');
    if (input) input.setAttribute('tabindex', '-1');
  };

  const cancel = () => {
    folderRef.current = undefined;
    setOpen(false);
    const input = document.getElementById('auto-tagging-name-input');
    if (input) input.setAttribute('tabindex', '-1');
  };

  if (!host) return null;

  return createPortal(
    <>
      <div className={`modal auto-tagging-modal${open ? ' open' : ''}`}>
        <div className="modal-header">
          <div className="name">{t('context.folder.autoTagging')}</div>
          <div className="close" onClick={() => cancel()}></div>
        </div>
        <div className="section">
          <label htmlFor="">{t('general.folderName')}</label>
          <input
            id="auto-tagging-name-input"
            ref={nameInputRef}
            maxLength={1024}
            type="text"
            placeholder=""
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            onKeyDown={nameKeydown}
            tabIndex={-1}
          />
        </div>
        <div className="section" style={ngShow(open)}>
          <label htmlFor="">{t('modal.autoTagging.tagsLabel')}</label>
          <TagsInput
            style={{ minHeight: '56px' }}
            theme={theme}
            tags={folderTags}
            onTagsReplace={(next) => {
              folderTagsRef.current = next;
              setFolderTags(next);
            }}
          />
        </div>
        <div className="section textAlign-right">
          <div className="button button-xs button-primary" onClick={() => save()}>
            {t('modal.autoTagging.saveBtn')}
          </div>
          <div className="button button-xs button-grey" onClick={() => cancel()}>
            {t('general.cancel')}
          </div>
        </div>
      </div>
      <div className="modal-overlay"></div>
    </>,
    host
  );
}

