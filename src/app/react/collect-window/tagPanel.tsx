/**
 * 采集窗标签选择面板宿主——tag-select-panel.html（205 行逐字）+ 指令 link（1471-1555 逐字：
 * TagSelectPanel 实例 + initDraggable/initResizable + TAG.SELECT.PANEL.OPEN → init(10ms)/open(0ms)）。
 * vs-grid-repeat 虚拟化 9b-2c 接入（当前全量渲染 groups；select-panel-list 的 columns attr 由
 * vs-grid 设置，本片保持缺省 = 键盘上下走跨群组分支，与无 vs-grid 的原行为一致）。
 */

import { useEffect, useRef, useState } from 'react';
import { controllerScope, applyController, ct, registerTagPanelOpenerHost } from './controller';

function escapeHtml(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
import { CollectTagSelectPanel } from './tagPanelEngine';

const $: any = (...args: any[]) => (window as any).jQuery(...args);



export function TagSelectPanelHost() {
  const panelRef = useRef<any>(null);
  const rootRef = useRef<HTMLElement>(null);
  const [, bump] = useState(0);
  const bumpAll = () => bump((v: number) => v + 1);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const $selectPanel = $(el).find('.tag-select-panel');

    const panel = new CollectTagSelectPanel({
      showCreateTagBtn: false,
      fixedSize: true,
      scope: { $evalAsync: () => applyController(() => {}) },
      panelSelector: 'tag-select-panel .tag-select-panel',
      searchInputSelector: 'tag-select-panel .panel-header input',
    });
    panelRef.current = panel;
    (window as any).__eagleCollectTagPanel = panel;

    const initDraggable = () => {
      let dragOriginalSize: any = {};
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
    };

    const initResizable = () => {
      $selectPanel.resizable({
        maxWidth: 800,
        minWidth: 200,
        minHeight: 160,
        maxHeight: 640,
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
    };

    initDraggable();
    initResizable();

    registerTagPanelOpenerHost((params: any) => {
      setTimeout(() => {
        panel.init(params);
        bumpAll();
      }, 10);

      setTimeout(() => {
        // 原版 TagSelectPanel.open() 覆写无参（preventCollision 参数被静默丢弃，怪癖逐字）
        (panel as any).open({ preventCollisionWithElement: params.preventCollisionWithElement });
        bumpAll();
      }, 0);
    });

    return () => {
      (window as any).__eagleCollectTagPanel = null;
    };
  }, []);

  const panel = panelRef.current;
  const inited = !!panel && !!panel.listData && Array.isArray(panel.listData.groups);
  const listData = inited ? panel.listData : { items: [], groups: [], tagGroups: [], selectedTags: {}, tagGroupsCountMap: {}, currentIndex: -1, currentItem: null, sidebarGroup: undefined };
  const theme = controllerScope.theme || 'dark';
  const themePath = theme === 'light' || theme === 'lightgray' ? 'light' : 'dark';
  const panelState = panel || { isShowSidebar: false, isShowCount: false, isOpenSettings: false, isInit: false, vsGridRepeatOptions: { listMode: false }, columnSize: 'small' };

  return (
    <tag-select-panel ref={rootRef as any}>
    <select-panel
      className={`select-panel tag-select-panel${panelState.isShowSidebar && listData.tagGroups.length > 0 ? ' has-sidebar' : ''}`}
      onMouseUp={() => panel && panel.focusSearchInput()}
    >
      <div className="panel-header">
        <div className="search">
          <input id="tag-select-panel-search-input" type="search" maxLength={128} placeholder={ct('general.search')} />
        </div>

        {listData.tagGroups.length > 0 && (
          <div className={`ic-btn${panelState.isShowSidebar ? ' active' : ''}`} onClick={() => { panel.toggleSidebar(); bumpAll(); }}>
            <img src={`assets/images/${themePath}/icons/ic_toggle-sidebar.svg`} />
          </div>
        )}

        <div className="ic-btn" onClick={() => { panel.openSettings(); bumpAll(); }}>
          <img src={`assets/images/${themePath}/icons/ic-tag-settings.svg`} />
        </div>
      </div>

      <div className={`panel-container${panelState.isShowSidebar && listData.tagGroups.length > 0 ? ' has-sidebar' : ''}`}>
        <div className="panel-sidebar">
          <div className={`panel-sidebar-item${!listData.sidebarGroup ? ' active' : ''}`} onClick={() => { panel.selectGroup(); bumpAll(); }}>
            <div className="icon">
              <div className="fake-svg png" style={{ WebkitMaskImage: 'url(assets/images/base/icons/ic-tag-all.png)', WebkitMaskSize: '10px' }} />
            </div>
            <div className="name">{ct('selectTagPanel.sidebar.all')}</div>
            <div className="right">
              {listData.tagGroupsCountMap['all'] ? <div className="count">{listData.tagGroupsCountMap['all']}</div> : null}
            </div>
          </div>
          {listData.tagGroups.map((group: any) => (
            <div
              key={group.id}
              className={`panel-sidebar-item color-${group.color}${listData.sidebarGroup && listData.sidebarGroup.id === group.id ? ' active' : ''}`}
              onClick={() => { panel.selectGroup(group); bumpAll(); }}
            >
              <div className="icon">
                <div className="fake-svg png" />
              </div>
              <div className="name">{group.name}</div>
              <div className="right">
                <div className="count">{listData.tagGroupsCountMap[group.id]}</div>
              </div>
            </div>
          ))}
          <div
            className={`panel-sidebar-item${listData.sidebarGroup && listData.sidebarGroup.id === 'none' ? ' active' : ''}`}
            onClick={() => { panel.selectGroup('none'); bumpAll(); }}
          >
            <div className="icon">
              <div className="fake-svg png" style={{ WebkitMaskImage: 'url(assets/images/base/icons/ic-tag-unfiled.png)', WebkitMaskSize: '10px' }} />
            </div>
            <div className="name">{ct('selectTagPanel.sidebar.unfiled')}</div>
            <div className="right">
              {listData.tagGroupsCountMap['none'] ? <div className="count">{listData.tagGroupsCountMap['none']}</div> : null}
            </div>
          </div>
        </div>

        <div className="panel-list">
          {panelState.isInit && listData.items.length === 0 && listData.groups.length === 0 && (
            <div className="panel-empty">
              <span>{ct('selectTagPanel.empty.all')}</span>
            </div>
          )}

          <select-panel-list className="grid-container">
            {(listData.groups || []).map((group: any) => (
              <div key={group.id}>
                <div className="group-label" onClick={() => { panel.toggleGroup(group.id); bumpAll(); }} onContextMenu={(e: any) => { e.preventDefault(); panel.toggleAllGroups(group.id); bumpAll(); }}>
                  <div className="name">
                    {group.name} <span>({group.items.length})</span>
                  </div>
                  <div className={`ic-btn expand${!group.isCollapsed ? ' expand' : ''}`}>
                    <img src={`assets/images/${themePath}/icons/ic-inspector-expand.svg`} />
                  </div>
                </div>
                {!group.isCollapsed &&
                  group.items.map((item: any) => (
                    <div
                      key={`${group.id}-${item.id}-${item.index}`}
                      className={`select-panel-item${item.id === (listData.currentItem && listData.currentItem.id) ? ' active' : ''}${
                        listData.selectedTags[item.name] ? ' checked' : ''
                      }`}
                      onClick={(e: any) => {
                        panel.openItem(e.nativeEvent || e, item);
                        bumpAll();
                      }}
                      onMouseEnter={(e: any) => panel.hoverItem(e.nativeEvent || e, item)}
                    >
                      {item.type === 'create' ? (
                        <div
                          className={`list-item create color-${listData.currentGroup ? listData.currentGroup.color : ''}`}
                          style={{ height: 25, lineHeight: '25px' }}
                        >
                          <div className="icon">
                            <div className="fake-svg png" />
                          </div>
                          <div className="name">
                            {ct('selectTagPanel.newTagBtn')} "<b>{item.name}</b>"
                          </div>
                        </div>
                      ) : (
                        <div
                          className={`list-item color-${item.color || ''}${
                            item.id === (listData.currentItem && listData.currentItem.id) ? ' active' : ''
                          }${listData.selectedTags[item.name] ? ' selected' : ''}${
                            (listData.searchKeyword || '').length > 0 ? ' search-mode' : ''
                          }${item.isRecent ? ' recent' : ''}${item.isStarred ? ' starred' : ''}`}
                          style={{ height: 25, lineHeight: '25px' }}
                          title={item.name}
                        >
                          <div className="icon">
                            <div className="fake-svg png" />
                          </div>
                          <div className="name" dangerouslySetInnerHTML={{ __html: fuzzyMatchName(item.name, listData.searchKeyword) }} title={item.name} />
                          <div className="right">
                            {panelState.isShowCount && item.imageCount ? (
                              <div className="count">
                                <span>(</span>
                                {item.imageCount}
                                <span>)</span>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            ))}
          </select-panel-list>
        </div>
      </div>

      <div className="panel-footer">
        <div className="left">
          {/* 原版 ng-hide="selected.length === 0 || !panel.isShowSidebar"：selected 未定义 → digest 抛错 → 元素保持可见（怪癖逐字） */}
          <div className="shortcut-tip">
            {ct('selectTagPanel.shortcuts.switch')}
            <key>Tab</key>
          </div>
          <div className="shortcut-tip">
            {ct('selectTagPanel.shortcuts.move')}
            <div className="keys">
              <key>↑</key>
              <key>↓</key>
              <key>←</key>
              <key>→</key>
            </div>
          </div>
          <div className="shortcut-tip">
            {ct('selectTagPanel.shortcuts.select')}
            <key>︎⏎</key>
          </div>
        </div>
        <div className="right">
          <div className="shortcut-tip">
            {ct('selectTagPanel.shortcuts.close')}
            <key>︎ESC</key>
          </div>
        </div>
      </div>

      <div
        className={`setting-panel${panelState.isOpenSettings ? ' open' : ''}`}
        onMouseDown={(e: any) => e.stopPropagation()}
        onMouseUp={(e: any) => e.stopPropagation()}
      >
        <div className="setting-panel-container">
          <div className="panel-item" style={{ marginTop: 4 }}>
            <div className="label">{ct('selectTagPanel.settings.layout')}</div>
            <div className="value">
              <div className="btn-group">
                <div
                  className={`btn${panelState.vsGridRepeatOptions.listMode ? ' active' : ''}`}
                  onClick={() => {
                    panel.setListMode(true);
                    bumpAll();
                  }}
                  onMouseUp={() => panel.focusSearchInput()}
                >
                  <img src={`assets/images/${themePath}/icons/ic-layout-list.svg`} />
                </div>
                <div
                  className={`btn${!panelState.vsGridRepeatOptions.listMode ? ' active' : ''}`}
                  onClick={() => {
                    panel.setListMode(false);
                    bumpAll();
                  }}
                  onMouseUp={() => panel.focusSearchInput()}
                >
                  <img src={`assets/images/${themePath}/icons/ic-layout-grid.svg`} />
                </div>
              </div>
            </div>
          </div>

          {!panelState.vsGridRepeatOptions.listMode && (
            <div className="panel-item" style={{ marginTop: 4 }}>
              <div className="label">{ct('selectTagPanel.settings.columnSize.label')}</div>
              <div className="value">
                <div
                  className="select select-xs"
                  onClick={(e: any) => e.stopPropagation()}
                >
                  <select
                    tabIndex={-1}
                    value={panelState.columnSize}
                    onChange={(e) => {
                      panel.columnSize = (e.target as HTMLSelectElement).value;
                      panel.setColumnSize(panel.columnSize);
                      panel.focusSearchInput();
                      bumpAll();
                    }}
                  >
                    <option value="large">{ct('selectTagPanel.settings.columnSize.l')}</option>
                    <option value="medium">{ct('selectTagPanel.settings.columnSize.m')}</option>
                    <option value="small">{ct('selectTagPanel.settings.columnSize.s')}</option>
                    <option value="xsmall">{ct('selectTagPanel.settings.columnSize.xs')}</option>
                  </select>
                  <div className="select-content">
                    {panelState.columnSize === 'large' && <div className="select-value">{ct('selectTagPanel.settings.columnSize.l')}</div>}
                    {panelState.columnSize === 'medium' && <div className="select-value">{ct('selectTagPanel.settings.columnSize.m')}</div>}
                    {panelState.columnSize === 'small' && <div className="select-value">{ct('selectTagPanel.settings.columnSize.s')}</div>}
                    {panelState.columnSize === 'xsmall' && <div className="select-value">{ct('selectTagPanel.settings.columnSize.xs')}</div>}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="separator" />

          <div className="panel-item" onClick={() => { panel.toggleStarredTags(); bumpAll(); }}>
            <div className="label">{ct('selectTagPanel.label.starred')}</div>
            <div className="value">
              <label className="toggle" onClick={(e: any) => e.preventDefault()}>
                <input type="checkbox" checked={!!panelState.isShowStarredTags} readOnly />
                <span className="slider" />
              </label>
            </div>
          </div>

          <div className="panel-item" onClick={() => { panel.toggleRecentTags(); bumpAll(); }}>
            <div className="label">{ct('selectTagPanel.label.recent')}</div>
            <div className="value">
              <label className="toggle" onClick={(e: any) => e.preventDefault()}>
                <input type="checkbox" checked={!!panelState.isShowRecentTags} readOnly />
                <span className="slider" />
              </label>
            </div>
          </div>

          <div className="panel-item" onClick={() => { panel.toggleCount(); bumpAll(); }}>
            <div className="label">{ct('selectTagPanel.displayProperties.count')}</div>
            <div className="value">
              <label className="toggle" onClick={(e: any) => e.preventDefault()}>
                <input type="checkbox" checked={!!panelState.isShowCount} readOnly />
                <span className="slider" />
              </label>
            </div>
          </div>
        </div>
      </div>
      <div className="setting-panel-overlay" onClick={() => { panel.closeSettings(); bumpAll(); }} />
    </select-panel>
    <select-panel-overlay onClick={() => { panel.close(); bumpAll(); }} onMouseUp={() => panel.focusSearchInput()} />
    </tag-select-panel>
  );
}

function fuzzyMatchName(name: string, keyword: string): string {
  if (!keyword) return escapeHtml(name);
  const search = keyword.replace(/ /g, '').toLowerCase();
  let searchPosition = 0;
  let tokens = '';
  for (let n = 0; n < name.length; n++) {
    let ch = escapeHtml(name[n]);
    if (searchPosition < search.length && name[n].toLowerCase() === search[searchPosition]) {
      ch = '<b>' + ch + '</b>';
      searchPosition += 1;
    }
    tokens += ch;
  }
  if (searchPosition !== search.length) return escapeHtml(name);
  return tokens;
}
