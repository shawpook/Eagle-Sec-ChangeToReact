import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useToolbarState, ToolbarSnapshot } from '../../store/toolbarState';
import { t } from '../../global/eagleGlobals';
import { shortcuts, shortcutsWrapper } from '../../app/filters';
import { useTippy, useSelectAll } from '../hooks';
import { zoomIn as gridZoomIn, zoomOut as gridZoomOut } from '../../services/gridService';
import { syncBodyFromScope } from '../../store/bodyState';
import { syncDetailFromScope } from '../../store/detailState';
import { syncInspectorFromScope } from '../../store/inspectorState';
import { syncToolbarFromScope } from '../../store/toolbarState';
import { getBodyScope, scopeApply, scoped, SCOPED_HANDLER } from '../../core/appCore';
import { makeSortable } from '../interactions/sortable';
import { maximize } from '../../core/miscDomain';
import { resetFilter, search, searchFocus } from '../../core/filterDomain';
import { openApplicationContextMenu, openOrderMenu } from '../../services/miscMenuService';
import { openFolder, openSmartFolder } from '../../services/folderCoreService';
import { machineryOnImageSizeHeightChanged, machineryOpenAll, machineryOpenUnfiled, machineryChangeSidebarIndex, machineryOpenPluginPanel, machineryToggleAll, machineryPrevHistory, machineryNextHistory, machineryRefreshRandom, machineryOpenActionsPanel } from '../../core/dataMachinery';

/**
 * 阶段3a：工具栏接管。
 *
 * DOM 规范 = src/app/index.html 141-273 行 .toolbar + 130-139 行 .search-suggestions
 * （旧引用已从 index.html 删除，壳保留：#eagle-toolbar-host / #eagle-search-suggestions-host）。
 * 事件调回 EagleController 同名函数；cornerBtns 指令（bundle:63187）逐字移植。
 */

function themePathOf(theme: string): string {
  return theme === 'light' || theme === 'lightgray' ? 'light' : 'dark';
}

const iconSrc = (theme: string, icon: string) => `assets/images/${themePathOf(theme)}/icons/${icon}`;

const call = (fn: string | ((...a: any[]) => any), ...preArgs: any[]) => (e?: any) =>
  scopeApply(getBodyScope(), (scope) => {
    const target = typeof fn === 'function' ? fn : scope[fn];
    if (typeof target !== 'function') return;
    const args = preArgs.length ? preArgs : e === undefined ? [] : [e];
    // scoped(fn)：见 appCore.SCOPED_HANDLER——machinery 函数需以 scope 为首参。
    if (typeof fn === 'function' && (fn as any)[SCOPED_HANDLER]) target(scope, ...args);
    else target(...args);
  });

/** 多语句 ng-click 的逐字转写（如 resetKeyword(); resetFilter(); filterContent(); openAll()）。 */
const callSeq = (...fns: Array<[string | ((...a: any[]) => any), any?]>) => (e: any) =>
  scopeApply(getBodyScope(), (scope) => {
    for (const [fn, arg] of fns) {
      const target = typeof fn === 'function' ? fn : scope[fn];
      if (typeof target !== 'function') continue;
      const args = arg !== undefined ? [arg] : [e];
      if (typeof fn === 'function' && (fn as any)[SCOPED_HANDLER]) target(scope, ...args);
      else target(...args);
    }
  });

/** Angular `number:0`（千分位分组）。 */
const num0 = (value: number | undefined | null): string => {
  if (value == null) return '0';
  return String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

function fuzzyHighlight(keyword: string, word?: string): string {
  if (!word) return '';
  const fn = (window as any).fuzzy_match;
  if (!fn || !keyword) return word;
  // fuzzy_match(text, search)：text=被高亮的词条（与 fuzzyMatch filter 的调用次序一致）
  return fn(word, keyword) || word;
}

/* ---------------- corner-btns 指令（bundle:63187 + corner-btns.html 模板逐字） ---------------- */

export function CornerBtns({ snapshot, hideAlwaysOnTop }: { snapshot: ToolbarSnapshot; hideAlwaysOnTop?: boolean }) {
  const { theme, platform, isAlwaysOnTop, isMaximize, keybinds } = snapshot;
  const currentWindow = () => (window as any).require?.('electron')?.remote?.getCurrentWindow?.();
  const minimize = () => currentWindow()?.minimize?.();
  const maximize = () => {
    const win = currentWindow();
    if (!win) return;
    if (win.isFullScreen()) win.setFullScreen(false);
    else if (!win.isMaximized()) { win.maximize(); const s = getBodyScope(); if (s) s.isMaximize = true; }
    else { win.unmaximize(); const s = getBodyScope(); if (s) s.isMaximize = false; }
    syncToolbarFromScope();
  };
  const restore = maximize;
  const close = () => currentWindow()?.close?.();
  const toggleAlwaysOnTop = () => scopeApply(getBodyScope(), (s) => s.toggleAlwaysOnTop());
  const stop = (e: any) => { e.stopPropagation(); e.preventDefault(); };
  const pinTip = `${t('titlebar.alwayTop.on')}${shortcuts(shortcutsWrapper(keybinds['view.alwaysOnTop'] || ''))}`;
  const unpinTip = `${t('titlebar.alwayTop.off')}${shortcuts(shortcutsWrapper(keybinds['view.alwaysOnTop'] || ''))}`;

  if (platform === 'darwin') {
    return (
      <div className="corner-btns darwin" onDoubleClick={stop}>
        {!hideAlwaysOnTop && (
          <>
            <div className="ic-btn" style={!isAlwaysOnTop ? undefined : { display: 'none' }} tippy="" tippy-placement="bottom" tippy-content={pinTip} onClick={toggleAlwaysOnTop}>
              <img src={iconSrc(theme, 'ic-window-pin.svg')} />
            </div>
            <div className="ic-btn active" style={isAlwaysOnTop ? undefined : { display: 'none' }} tippy="" tippy-placement="bottom" tippy-content={unpinTip} onClick={toggleAlwaysOnTop}>
              <img src={iconSrc(theme, 'ic-window-unpin.svg')} />
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="corner-btns win32" onDoubleClick={stop}>
      {!hideAlwaysOnTop && (
        <>
          <div className="ic-btn" style={!isAlwaysOnTop ? undefined : { display: 'none' }} tippy="" tippy-placement="bottom" tippy-content={pinTip} onClick={toggleAlwaysOnTop}>
            <img src={iconSrc(theme, 'ic-window-pin.svg')} />
          </div>
          <div className="ic-btn active" style={isAlwaysOnTop ? undefined : { display: 'none' }} tippy="" tippy-placement="bottom" tippy-content={unpinTip} onClick={toggleAlwaysOnTop}>
            <img src={iconSrc(theme, 'ic-window-unpin.svg')} />
          </div>
          <div className="separator" />
        </>
      )}
      <div className="windows-btns">
        <div ng-click="minimize()" className="ic-btn windows-btn" style={{ backgroundImage: `url(${iconSrc(theme, 'ic-windows-hide.svg')})` }} onClick={minimize} />
        <div ng-click="maximize()" className="ic-btn windows-btn" style={{ backgroundImage: `url(${iconSrc(theme, 'ic-windows-fullscreen.svg')})`, ...(isMaximize ? { display: 'none' } : null) }} onClick={maximize} />
        <div ng-click="restore()" className="ic-btn windows-btn" style={{ backgroundImage: `url(${iconSrc(theme, 'ic-windows-restore.svg')})`, ...(!isMaximize ? { display: 'none' } : null) }} onClick={restore} />
        <div className="close-btn-wrap" onClick={close}>
          <div ng-click="close()" id="close-btn" className="ic-btn windows-btn" style={{ backgroundImage: `url(${iconSrc(theme, 'ic-windows-close.svg')})` }} onClick={close} />
        </div>
      </div>
    </div>
  );
}

/* ---------------- 搜寻框（普通模式 + 随机模式两种变体） ---------------- */

function SearchBox({ snapshot, randomMode }: { snapshot: ToolbarSnapshot; randomMode?: boolean }) {
  const { keyword } = snapshot;
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(keyword);
  const debounceRef = useRef<any>(null);
  useSelectAll(inputRef);

  useEffect(() => { if (document.activeElement !== inputRef.current) setDraft(keyword); }, [keyword]);

  // $("#search").on("focus") → $rootScope.currentFocus = "content"（bundle:21830，原直绑元素已被 React 接管）
  const onFocus = (e: any) => {
    scopeApply(getBodyScope(), (s) => {
      s.$root.currentFocus = 'content';
      searchFocus(e);
    });
  };

  return (
    <div className="search-wrap">
      <div
        className="scope-select"
        ng-click="openSearchScopeMenu($event)"
        tippy=""
        tippy-placement="bottom"
        tippy-content={t('Context.SearchScope.Label')}
        onClick={call('openSearchScopeMenu')}
      >
        <img src={iconSrc(snapshot.theme, 'ic-toolbar-arrow-down.svg')} />
      </div>
      <input
        ref={inputRef}
        id="search"
        tabIndex={randomMode ? undefined : -1}
        maxLength={4096}
        type="search"
        selectall=""
        className="search"
        placeholder={t('toolbar.searchPlaceholder')}
        value={draft}
        onChange={(e) => {
          const value = e.target.value;
          setDraft(value);
          if (randomMode) {
            // 随机模式变体：ng-change="search(keyword)"，ng-model-options debounce 200ms
            clearTimeout(debounceRef.current);
            debounceRef.current = setTimeout(() => {
              scopeApply(getBodyScope(), (s) => {
                s.keyword = value;
                search(value);
              });
            }, 200);
          } else {
            scopeApply(getBodyScope(), (s) => { s.keyword = value; });
          }
        }}
        onKeyDown={(e) => {
          scopeApply(getBodyScope(), (s) => { s.keyword = (e.target as HTMLInputElement).value; });
          call('seachKeyup')(e);
        }}
        onFocus={onFocus}
        onBlur={(e) => {
          if (randomMode) {
            clearTimeout(debounceRef.current);
            scopeApply(getBodyScope(), (s) => {
              s.keyword = draft;
              search(draft);
            });
          }
          call('searchBlur')(e);
        }}
        onClick={onFocus}
      />
    </div>
  );
}

/* ---------------- 主组件 ---------------- */

export function Toolbar() {
  const snapshot = useToolbarState((s) => s.snapshot);
  const [toolbarHost, setToolbarHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setToolbarHost(document.getElementById('eagle-toolbar-host'));
  }, []);

  // 原 .toolbar 上的 ng-show="!isDetailMode || isInlineMode" 与 ng-dblclick="maximize()"
  useLayoutEffect(() => {
    const host = toolbarHost;
    if (!host) return;
    const visible = !snapshot.isDetailMode || snapshot.isInlineMode;
    host.style.display = visible ? '' : 'none';
    const onDblClick = (e: MouseEvent) => scopeApply(getBodyScope(), () => maximize(e));
    host.addEventListener('dblclick', onDblClick);
    return () => host.removeEventListener('dblclick', onDblClick);
  }, [toolbarHost, snapshot.isDetailMode, snapshot.isInlineMode]);

  const tippyRef = useRef<HTMLElement | null>(null);
  tippyRef.current = toolbarHost;
  useTippy(tippyRef, snapshot);

  // pinned-plugins ui-sortable（angular-ui-sortable 语义：拖拽结束后按 DOM 顺序回写 model）
  const pinnedRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = pinnedRef.current;
    if (!el) return;
    const scope = getBodyScope();
    if (!scope) return;
    const options = scope.pluginModule?.pinPluginSortableOptions;
    const syncModel = () => {
      scopeApply(scope, (s) => {
        const nodes = Array.from(el.querySelectorAll('.ic-btn'));
        const plugins = s.pluginModule.pinnedPlugins || [];
        if (nodes.length !== plugins.length) return;
        const order = nodes.map((node) => {
          const icon = node.querySelector('img');
          return plugins.findIndex((p: any) => p && p.icon && icon && p.icon === icon.getAttribute('src'));
        });
        if (order.some((i) => i < 0)) return;
        const current = plugins.map((_: unknown, i: number) => i);
        if (JSON.stringify(order) !== JSON.stringify(current)) {
          s.pluginModule.pinnedPlugins = order.map((i: number) => plugins[i]).filter(Boolean);
          syncToolbarFromScope();
        }
      });
    };
    const sortable = makeSortable(el, {
      ...(options || {}),
      update: (e: unknown) => { options?.update?.(e, undefined); setTimeout(syncModel, 1); },
    });
    return () => { sortable.destroy(); };
  }, [snapshot.pinnedPlugins.length, snapshot.ready, toolbarHost]);

  if (!toolbarHost) return null;

  const { viewMode } = snapshot;
  const normalRightVisible = viewMode !== 'random';

  return createPortal(
    <>
      {/* 麵包削 */}
      <div className="breadcrumbs" onDoubleClick={(e) => e.stopPropagation()}>
        {snapshot.isHideSidebar ? (
          <div className="ic-btn application-menu-btn" ng-click="openApplicationContextMenu($event)" onClick={call(openApplicationContextMenu)}>
            <img src={iconSrc(snapshot.theme, 'ic-app-menu.svg')} />
          </div>
        ) : null}
        <div id="toggle-all-btn" className="ic-btn" ng-click="toggleAll($event)" onClick={call(scoped(machineryToggleAll))} onContextMenu={call('openSidebarMenu')}>
          <img src={iconSrc(snapshot.theme, 'ic_toggle-sidebar.svg')} />
        </div>
        <div
          className={`ic-btn prev no-padding${snapshot.canGoBack ? '' : ' disabled'}`}
          tippy=""
          tippy-placement="bottom"
          tippy-content={shortcuts('<key>⌘</key><key>←</key>')}
          ng-click="prevHistory($event)"
          onClick={call(scoped(machineryPrevHistory))}
        >
          <img src={iconSrc(snapshot.theme, 'ic-toolbar-prev.svg')} />
        </div>
        <div
          className={`ic-btn next no-padding${snapshot.canGoForward ? '' : ' disabled'}`}
          tippy=""
          tippy-placement="bottom"
          tippy-content={shortcuts('<key>⌘</key><key>→</key>')}
          ng-click="nextHistory($event)"
          onClick={call(scoped(machineryNextHistory))}
        >
          <img src={iconSrc(snapshot.theme, 'ic-toolbar-next.svg')} />
        </div>

        <ul>
          <li style={viewMode === 'all' ? undefined : { display: 'none' }} onClick={callSeq(['resetKeyword'], [resetFilter], ['filterContent'], [scoped(machineryOpenAll)])}>{t('general.pages.all')}</li>
          <li style={viewMode === 'unfiled' ? undefined : { display: 'none' }} onClick={callSeq(['resetKeyword'], [resetFilter], ['filterContent'], [scoped(machineryOpenUnfiled)])}>{t('general.pages.unfiled')}</li>
          <li style={viewMode === 'untagged' ? undefined : { display: 'none' }} onClick={callSeq(['resetKeyword'], [resetFilter], ['filterContent'], ['openUntagged'])}>{t('general.pages.untagged')}</li>
          <li style={viewMode === 'recent' ? undefined : { display: 'none' }} onClick={callSeq(['resetKeyword'], [resetFilter], ['filterContent'], ['openRecent'])}>{t('general.pages.recent')}</li>

          {viewMode === 'alltags' || snapshot.hasCurrentTag ? (
            <li ng-click="openAllTags()" onClick={call('openAllTags')}>
              {snapshot.selectedTagsCount === 0 ? (
                <span>{t('general.pages.allTags')} ({num0(snapshot.tagsCount)})</span>
              ) : (
                <span>{t('toolbar.breadcumbs.selected')} ({num0(snapshot.selectedTagsCount)})</span>
              )}
            </li>
          ) : null}

          <li style={viewMode === 'random' ? undefined : { display: 'none' }} onClick={callSeq(['resetKeyword'], [resetFilter], ['filterContent'])}>{t('general.pages.random')}</li>
          <li style={viewMode === 'trash' ? undefined : { display: 'none' }} onClick={callSeq(['resetKeyword'], [resetFilter], ['filterContent'], ['openTrash'])}>{t('general.pages.trash')}</li>
          <li style={!viewMode && snapshot.selectedFoldersCount > 0 ? undefined : { display: 'none' }}>{t('toolbar.breadcumbs.selected')} {snapshot.selectedFoldersCount} {t('toolbar.breadcumbs.folders')}</li>
          <li style={!viewMode && snapshot.selectedSmartFoldersCount > 0 ? undefined : { display: 'none' }}>{t('toolbar.breadcumbs.selected')} {snapshot.selectedSmartFoldersCount} {t('toolbar.breadcumbs.smartFolders')}</li>

          {!viewMode && snapshot.currentFolder && snapshot.selectedFoldersCount === 0 ? (
            <li
              className={snapshot.currentFolder.parent ? 'has-parent' : ''}
              ng-click="openFolder(currentFolder)"
              title={snapshot.currentFolderPath}
              onClick={callSeq(['resetKeyword'], [resetFilter], ['filterContent'], [openFolder, liveCurrentFolder()], [scoped(machineryChangeSidebarIndex), liveCurrentFolder()])}
              onContextMenu={(e) => call('openFolderFullPathContextMenu', liveCurrentFolder())(e)}
            >
              {snapshot.currentFolder.name}
            </li>
          ) : null}

          {!viewMode && snapshot.currentSmartFolder && snapshot.selectedSmartFoldersCount === 0 ? (
            <li ng-click="openSmartFolder(currentSmartFolder)" onClick={() => call(openSmartFolder, liveCurrentSmartFolder())()}>
              {snapshot.currentSmartFolder.name}
            </li>
          ) : null}

          {viewMode !== 'alltags' && (snapshot.filterBadge || snapshot.keyword) ? (
            <li
              style={{ WebkitAppRegion: 'drag' } as any}
              className="active show"
              title={`${t('toolbar.breadcumbs.searchResult')} (${num0(snapshot.allDataCount)})`}
            >
              <img src={iconSrc(snapshot.theme, 'ic-separator.svg')} />
              {t('toolbar.breadcumbs.searchResult')} ({num0(snapshot.allDataCount)})
            </li>
          ) : null}
        </ul>
      </div>

      <div id="box-list-slider" className="sliders-bar has-btn" style={!snapshot.isDetailMode || snapshot.isInlineMode ? undefined : { display: 'none' }} onDoubleClick={(e) => e.stopPropagation()}>
        <div className="slider" style={viewMode === 'alltags' ? { display: 'none' } : undefined}>
          <div
            className="ic-btn zoom-btn"
            ng-click="zoomOut($event);"
            tippy=""
            tippy-placement="bottom"
            tippy-content={`${t('appmenu.view>zoomOut')} <key>-</key>`}
            onClick={gridZoomOut}
          >
            <img src={iconSrc(snapshot.theme, 'ic-toolbar-zoom-out.svg')} />
          </div>
          <div className="range-wrap">
            <div className="range-progressbar">
              <div className="current" style={{ width: `${(snapshot.imageSizeHeight / snapshot.maxListWidth) * 100}%` }} />
            </div>
            <input
              className="range"
              type="range"
              name="points"
              min={75}
              max={snapshot.maxListWidth}
              step={5}
              tabIndex={-1}
              value={snapshot.imageSizeHeight}
              onChange={(e) => {
                const v = Number(e.target.value);
                scopeApply(getBodyScope(), (s) => {
                  s.imageSize.height = v;
                  machineryOnImageSizeHeightChanged(s);
                });
                syncToolbarFromScope();
                syncBodyFromScope();
                syncDetailFromScope();
                syncInspectorFromScope();
                call('onListSizeChange')();
              }}
            />
          </div>
          <div
            className="ic-btn zoom-btn"
            ng-click="zoomIn($event);"
            tippy=""
            tippy-placement="bottom"
            tippy-content={`${t('appmenu.view>zoomIn')} <key>+</key>`}
            onClick={gridZoomIn}
          >
            <img src={iconSrc(snapshot.theme, 'ic-toolbar-zoom-in.svg')} />
          </div>
        </div>
      </div>

      <div className="right" style={normalRightVisible ? undefined : { display: 'none' }} onDoubleClick={(e) => e.stopPropagation()}>
        {snapshot.pinnedPlugins.length > 0 ? (
          <div className="pinned-plugins" ref={pinnedRef}>
            {snapshot.pinnedPlugins.map((plugin, i) => (
              <div
                key={i}
                className="ic-btn"
                ng-click="pluginModule.open(plugin)"
                tippy=""
                tippy-placement="bottom"
                tippy-content={plugin.name || ''}
                onClick={() => { const live = getBodyScope()?.pluginModule?.pinnedPlugins?.[i]; if (live) scopeApply(getBodyScope(), (s) => s.pluginModule.open(live)); }}
              >
                <img width={20} height={20} src={plugin.icon} />
              </div>
            ))}
          </div>
        ) : null}

        <div
          className="ic-btn filter-btn no-padding"
          tippy=""
          tippy-placement="bottom"
          tippy-content={`${t('general.plugin')} <key>P</key>`}
          style={viewMode === 'alltags' ? { display: 'none' } : undefined}
          ng-click="openPluginPanel($event)"
          onClick={call(scoped(machineryOpenPluginPanel))}
        >
          <img src={iconSrc(snapshot.theme, 'ic-toolbar-plugin.svg')} />
          <div style={snapshot.needUpdatePluginCount > 0 ? undefined : { display: 'none' }} className="badge-count" />
        </div>
        {snapshot.randomOrderBy ? (
          <div
            id="refresh-random"
            className="ic-btn"
            tippy=""
            tippy-placement="bottom"
            tippy-content={`${t('toolbar.randomRefhreshBtn')}<key>R</key>`}
            ng-click="refreshRandom()"
            onClick={call(scoped(machineryRefreshRandom))}
          >
            <img src={iconSrc(snapshot.theme, 'ic_refresh.svg')} />
          </div>
        ) : null}
        <div
          className="ic-btn filter-btn no-padding"
          tippy=""
          tippy-placement="bottom"
          tippy-content={`${t('appmenu.actions')} <key>G</key>`}
          style={viewMode === 'alltags' ? { display: 'none' } : undefined}
          ng-click="openActionsPanel($event)"
          onClick={call(scoped(machineryOpenActionsPanel))}
        >
          <img src={iconSrc(snapshot.theme, 'ic-toolbar-action.svg')} />
        </div>
        <div
          className="ic-btn filter-btn no-padding"
          tippy=""
          tippy-placement="bottom"
          tippy-content={shortcuts(t('context.order.orderBy'))}
          style={viewMode === 'alltags' ? { display: 'none' } : undefined}
          ng-click="openOrderMenu($event)"
          onClick={call(openOrderMenu)}
        >
          <img src={iconSrc(snapshot.theme, 'ic-toolbar-layout.svg')} />
        </div>
        <div
          className={`ic-btn filter-btn no-padding${snapshot.filterIsOpen ? ' active' : ''}`}
          tippy=""
          tippy-placement="bottom"
          tippy-content={`${t('toolbar.filterHint')}${shortcuts(shortcutsWrapper(snapshot.keybinds['find.filter.toggle'] || ''))}`}
          style={viewMode === 'alltags' ? { display: 'none' } : undefined}
          ng-click="toggleFilter()"
          onClick={call('toggleFilter')}
        >
          <div className="badge" style={snapshot.filterBadge > 0 ? undefined : { display: 'none' }}>{snapshot.filterBadge > 0 ? snapshot.filterBadge : ''}</div>
          <img src={iconSrc(snapshot.theme, 'ic-toolbar-filter.svg')} />
        </div>

        <div className="tabs" style={viewMode === 'alltags' ? { marginRight: '4px' } : { display: 'none', marginRight: '4px' }}>
          <div className={`tab${viewMode === 'alltags' && snapshot.tagViewLayoutMode === 'INLINE' ? ' active' : ''}`} ng-click="toggleTagLayout()" onClick={call('toggleTagLayout')}>
            <img src={iconSrc(snapshot.theme, 'ic-tag-manager-layout-grid.svg')} />
          </div>
          <div className={`tab${viewMode === 'alltags' && snapshot.tagViewLayoutMode === 'LIST' ? ' active' : ''}`} ng-click="toggleTagLayout()" onClick={call('toggleTagLayout')}>
            <img src={iconSrc(snapshot.theme, 'ic-tag-manager-layout-list.svg')} />
          </div>
        </div>

        <div className="ic-btn no-padding" style={viewMode === 'alltags' ? { marginRight: '4px' } : { display: 'none', marginRight: '4px' }} ng-click="openTagGroupListContextMenu($event)" onClick={call('openTagGroupListContextMenu')}>
          <img src={iconSrc(snapshot.theme, 'ic-tag-manager-sort.svg')} />
        </div>

        <SearchBox snapshot={snapshot} />

        {snapshot.inspectorHide || viewMode === 'alltags' ? <CornerBtns snapshot={snapshot} /> : null}
      </div>

      <div className="right" style={!normalRightVisible ? undefined : { display: 'none' }} onDoubleClick={(e) => e.stopPropagation()}>
        <div
          id="refresh-random"
          className="ic-btn"
          tippy=""
          tippy-placement="bottom"
          tippy-content={`${t('toolbar.randomRefhreshBtn')}<key>R</key>`}
          ng-click="refreshRandom()"
          onClick={call('refreshRandom')}
        >
          <img src={iconSrc(snapshot.theme, 'ic_refresh.svg')} />
        </div>
        <div
          className={`ic-btn filter-btn no-padding${snapshot.filterIsOpen ? ' active' : ''}`}
          style={viewMode === 'alltags' ? { display: 'none' } : undefined}
          ng-click="toggleFilter()"
          onClick={call('toggleFilter')}
        >
          <div className="badge" style={snapshot.filterBadge ? undefined : { display: 'none' }}>{snapshot.filterBadge || ''}</div>
          <img src={iconSrc(snapshot.theme, 'ic-toolbar-filter.svg')} />
        </div>
        <SearchBox snapshot={snapshot} randomMode />
        {snapshot.inspectorHide ? <CornerBtns snapshot={snapshot} /> : null}
      </div>
    </>,
    toolbarHost
  );
}

/** 从活 scope 取 currentFolder/currentSmartFolder（事件回调需活对象）。 */
function liveCurrentFolder(): any { return getBodyScope()?.currentFolder; }
function liveCurrentSmartFolder(): any { return getBodyScope()?.currentSmartFolder; }

/* ---------------- 搜寻自动提示（index.html:130-139） ---------------- */

export function SearchSuggestions() {
  const snapshot = useToolbarState((s) => s.snapshot);
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => { setHost(document.getElementById('eagle-search-suggestions-host')); }, []);

  useLayoutEffect(() => {
    if (!host) return;
    const visible = snapshot.showSuggestions && (snapshot.keywordSuggestions.length > 0 || snapshot.hsks.length > 0);
    host.style.display = visible ? '' : 'none';
  }, [host, snapshot.showSuggestions, snapshot.keywordSuggestions.length, snapshot.hsks.length]);

  if (!host) return null;

  return createPortal(
    <>
      <div className="suggestions section" style={snapshot.keywordSuggestions.length > 0 ? undefined : { display: 'none' }}>
        {snapshot.keywordSuggestions.map((suggestion, index) => (
          <div
            key={index}
            className={`suggestion${snapshot.searchIndex === index ? ' selected' : ''}`}
            onMouseEnter={(e) => call('hoverSuggestion', index)(e)}
            onClick={(e) => call('selectSuggestion', index)(e)}
          >
            <span className="name" dangerouslySetInnerHTML={{ __html: fuzzyHighlight(snapshot.keyword, suggestion.word) }} />
          </div>
        ))}
      </div>
      <div className="section" style={snapshot.hsks.length > 0 ? undefined : { display: 'none' }}>
        {snapshot.hsks.map((history, index) => (
          <div
            key={index}
            className={`suggestion${snapshot.searchIndex === index + 100 ? ' selected' : ''}`}
            onClick={(e) => call('selectHistoryKeyword', index)(e)}
            onMouseEnter={(e) => call('hoverHistory', index)(e)}
          >
            <span className="name" dangerouslySetInnerHTML={{ __html: fuzzyHighlight(snapshot.keyword, history) }} />
            <div className="remove-history" onClick={(e) => call('removeSeachKeyword', history)(e)}>
              <img src={iconSrc(snapshot.theme, 'ic-search-history-remove.svg')} />
            </div>
          </div>
        ))}
      </div>
    </>,
    host
  );
}
