import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getBodyScope } from '../../global/scopeBridge';
import { calculateImageBinding } from '../../services/gridBindingService';
import { t } from '../../global/eagleGlobals';
import { usePanelState } from '../../store/panelState';
import { $, getIpc } from '../detail/detailHooks';
import { TagSelectPanel } from './selectPanelEngine';
import { fuzzyMatchHtml } from './ContextMenu';
import { useVsGridRepeat, themePathOf } from './SelectPanels';

/**
 * 阶段7d-3a：inspectorTagSelectPanel 指令接管（bundle 57911-58122 + inspector-tag-select-panel.html）。
 *
 * 与 generalTagSelectPanel 同用 TagSelectPanel 引擎与 useVsGridRepeat；模板差异：
 * pinned class + 置頂/取消置頂按鈕、無選擇空狀態（inspector.noSelection）、
 * select-panel-list 的 list-mode class、setting-panel 無 right:6px、
 * footer switch 快捷鍵 ng-hide、overlay ng-show=!panel.isPined。
 *
 * 通道零改动：INSPECTOR.TAG.SELECT.PANEL.OPEN 广播（body scope $broadcast，body $on 接收）、
 * ipc 'app-status-loading'；localStorage 键 eagle.tagsPopup.* 原样。
 */

const iv = (v: any): any => (v === undefined || v === null ? '' : v);
const ngShow = (show: boolean) => (show ? undefined : ({ display: 'none' } as React.CSSProperties));

export function InspectorTagSelectPanel() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const { snapshot } = usePanelState();
  const theme = snapshot.theme;
  const [, bump] = useState(0);
  const bumpAll = () => bump((v: number) => v + 1);
  const rootRef = useRef<HTMLElement>(null);
  const listRef = useRef<HTMLElement | null>(null);
  const panelRef = useRef<TagSelectPanel | null>(null);

  useEffect(() => {
    setHost(document.getElementById('eagle-inspector-tag-select-panel-host'));
  }, []);

  useEffect(() => {
    if (!host || !rootRef.current) return;
    const jQuery = $();

    // 指令 link（57921-57932 逐字）
    const panel = new TagSelectPanel({
      fixedSize: true,
      notify: () => bumpAll(),
      panelSelector: 'inspector-tag-select-panel .tag-select-panel',
      searchInputSelector: 'inspector-tag-select-panel .panel-header input',
    });
    panelRef.current = panel;
    // 闭环测试契约
    (window as any).__eagleInspectorTagSelectPanel = panel;

    const $selectPanel = jQuery(rootRef.current).find('.select-panel');

    // 如果面板的位置壓住了標籤選擇按鈕，則將面板移動到檢查器左側 + 10px 處（57929-57940 逐字）
    const preventOverlayInspector = () => {
      try {
        const $sp = jQuery(rootRef.current).find('.select-panel');
        const inspectorLeft = jQuery('.inspector').offset().left;
        const panelWidth = $sp.width();
        const panelLeft = $sp.offset().left;
        const newLeft = inspectorLeft - panelWidth + 5;
        if (panelLeft + panelWidth > inspectorLeft && newLeft > 0) {
          $sp.css('left', newLeft);
        }
      } catch (e) {}
    };

    // 更新建議標籤列表（57943-57957 逐字）
    const updateSelected = () => {
      const body = getBodyScope();
      body.TagManager.getSuggestTags(body.selected);
      setTimeout(() => {
        const originSelected = (window as any).eagle.inspector.newTags.reduce(
          (acc: any, cur: any) => {
            acc[cur] = true;
            return acc;
          },
          {} as any
        );

        panel.listData.selectedTags = originSelected;

        panel.updateTagsState();
        panel.updateItemList();
        bumpAll();
      }, 50);
      bumpAll();
    };

    // 監聽窗口大小改變事件（57960-57991 逐字）
    let resizeTimeout: any;
    const onWindowResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        if (panel.isPined) {
          if (!jQuery('inspector-tag-select-panel select-panel').hasClass('open')) return;

          const windowHeight = jQuery(window).height();
          const windowWidth = jQuery(window).width();
          let popupHeight = $selectPanel.height();
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
            popupHeight = windowHeight - 60;
            const height = Math.max(120, popupHeight - popupTop);
            $selectPanel.height(height);
          }
        }
      }, 333);
    };
    jQuery(window).on('resize.inspectTagSelect', onWindowResize);

    // initDraggable / initResizable（jQuery UI，缺失時跳過）
    let dragOriginalSize: any = {};
    if (jQuery && jQuery.fn && (jQuery as any).fn.draggable) {
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
        stop: (event: any, ui: any) => {
          const height = ui.element.innerHeight();
          const width = ui.element.innerWidth();
          localStorage.setItem('eagle.tagsPopup.height', String(height));
          localStorage.setItem('eagle.tagsPopup.width', String(width));
          panel.height = height;
          panel.width = width;
          panel.fixedSize = true;
        },
      });
    }

    const body = getBodyScope();
    const offs: any[] = [];
    if (body) {
      // $watchCollection("selected")（57938-57942 逐字；selected 为 body scope 同名属性）
      const offSelected = body.$watchCollection('selected', () => {
        if (panel.isPined) {
          updateSelected();
        }
      });
      offs.push(offSelected);

      // $on('INSPECTOR.TAG.SELECT.PANEL.OPEN')（57945-57982 逐字）
      const offOpen = body.$on('INSPECTOR.TAG.SELECT.PANEL.OPEN', (event: any, params: any) => {
        void params;
        body.TagManager.getSuggestTags(body.selected);
        const originSelected = (window as any).eagle.inspector.newTags.reduce(
          (acc: any, cur: any) => {
            acc[cur] = true;
            return acc;
          },
          {} as any
        );

        setTimeout(() => {
          panel.init({
            showCreateTagBtn: true,
            tagManager: body.TagManager,
            selectedTags: originSelected,
            onAdd: (tags: any) => {
              console.log(`onAdd: ${tags}`);
              body.TagManager.addTags(tags);
              calculateImageBinding({ ignoreSort: true }, () => {});
            },
            onRemove: (tags: any) => {
              console.log(`onRemove: ${tags}`);
              tags.forEach((tag: any) => {
                body.TagManager.removeTag(tag);
              });
              calculateImageBinding({ ignoreSort: true }, () => {});
            },
          });
          bumpAll();
        }, 10);

        setTimeout(() => {
          panel.open();
          preventOverlayInspector();
        }, 0);

        bumpAll();
      });
      offs.push(offOpen);
    }

    // ipcRenderer.on('app-status-loading')（57995-58001 逐字）
    const ipc = getIpc();
    const onAppStatusLoading = () => {
      if (panel.isPined) {
        panel.isPined = false;
        panel.close();
        bumpAll();
      }
    };
    if (ipc && ipc.on) {
      ipc.on('app-status-loading', onAppStatusLoading);
    }

    return () => {
      jQuery(window).off('resize.inspectTagSelect');
      offs.forEach((off) => off());
      if (ipc && ipc.off) ipc.off('app-status-loading', onAppStatusLoading);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host]);

  // 切換面板是否固定在屏幕上（57924-57926）
  const togglePined = () => {
    const p = panelRef.current;
    if (!p) return;
    p.isPined = !p.isPined;
    bumpAll();
  };

  const panel = panelRef.current;
  const listData = panel?.listData;
  const body = getBodyScope();
  const selectedCount = body?.selected?.length ?? 0;

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
  const noSelection = !!(panel?.isInit && selectedCount === 0);

  const renderGroupLabel = (pos: any) => {
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

  const renderItem = (pos: any) => {
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
    <inspector-tag-select-panel ref={rootRef as any}>
      <select-panel
        className={`select-panel tag-select-panel${panel?.isPined ? ' pinned' : ''}${hasSidebar ? ' has-sidebar' : ''}`}
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

          {/* 置頂按鈕 */}
          <div
            className="ic-btn"
            onClick={() => togglePined()}
            style={ngShow(!panel?.isPined)}
            tippy=""
            tippy-placement="bottom"
            tippy-content={t('titlebar.alwayTop.on')}
          >
            <img src={`assets/images/${themePathOf(theme)}/icons/ic-window-pin.svg`} />
          </div>

          <div
            className="ic-btn active"
            onClick={() => togglePined()}
            style={ngShow(!!panel?.isPined)}
            tippy=""
            tippy-placement="bottom"
            tippy-content={t('titlebar.alwayTop.off')}
          >
            <img src={`assets/images/${themePathOf(theme)}/icons/ic-window-unpin.svg`} />
          </div>
        </div>

        <div className={`panel-container${hasSidebar ? ' has-sidebar' : ''}`}>
          <div className="panel-sidebar">
            {/* 全部標籤群組 */}
            <div
              className={`panel-sidebar-item${!listData?.sidebarGroup ? ' active' : ''}`}
              onClick={() => panel && (panel as any).selectGroup(undefined)}
            >
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

          {/* 空狀態（沒有選擇檔案） */}
          {noSelection && (
            <div className="panel-empty">
              <span>{t('inspector.noSelection')}</span>
            </div>
          )}

          {/* 項目列表 */}
          <div className={`panel-list${noSelection ? ' hide' : ''}`}>
            {/* 空狀態（初始化時） */}
            {panel?.isInit && listData?.items?.length === 0 && listData?.groups?.length == 0 ? (
              <div className="panel-empty">
                <span>{t('selectTagPanel.empty.all')}</span>
              </div>
            ) : null}

            <select-panel-list
              className={`grid-container${panel?.vsGridRepeatOptions?.listMode ? ' list-mode' : ''}`}
              columns={grid.columns}
              ref={listRef}
            >
              <div className="grid-placeholder" style={{ height: `${grid.totalHeight}px`, pointerEvents: 'none' }} />
              {grid.visible.map((pos: any) =>
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
            <div className="shortcut-tip" style={ngShow(!(selectedCount === 0 || !panel?.isShowSidebar))}>
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
                      bumpAll();
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
        <div className="setting-panel-overlay" onClick={() => panel && panel.closeSettings()} />
      </select-panel>
      <select-panel-overlay style={ngShow(!panel?.isPined)} onClick={() => panel && panel.close()} />
    </inspector-tag-select-panel>,
    host
  );
}