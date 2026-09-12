import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { updateSidebarList } from '../../services/sidebarService';
import { saveFolder } from '../../services/folderService';
import { t } from '../../global/eagleGlobals';
import { usePanelState } from '../../store/panelState';
import { useSelectAll } from '../hooks';
import { q, widthOf, setCssEl, offsetOf } from '../../utils/domQuery';
import { fuzzyMatchHtml } from './ContextMenu';
import { deepCopy, FolderSelectPanel } from './selectPanelEngine';
import { TagsInput } from './SelectPanels';
import { getBodyScope } from '../../core/appCore';

import { openSmartFolder } from '../../services/folderCoreService';
import { editSmartFolderChannel, folderSelectPanelOpenChannel, newSmartFolderChannel } from '../../global/bus';
import { scopeEvalAsync } from '../../core/scopeRuntime';

import { machineryChangeSidebarIndex, machinerySmartFolderCount } from '../../core/libraryDomain';
import { machineryRebindRefresh } from '../../core/itemDomain';
import { machineryContentFilter } from '../../core/filterDomain';
import { useItemState } from '../../store/itemState';
import { useBodyState } from '../../store/bodyState';
import { useFolderState } from '../../store/folderState';
/**
 * 阶段7d-1c-2：folderSelectPanel + foldersInput + NewSmartFolderController 接管。
 *
 * 规范来源：
 * - vs-repeat 库（bundle 16736-17394，Eagle 改过 sizes 计算：size = item.size || elementSize）
 *   → useVsRepeat 垂直虚拟化；vs-auto-scroll 指令（bundle 69856-69900）随行内联。
 * - folder-select-panel 指令 = bundle 556-637（js/directives/folder-select-panel.js + html）；
 *   FolderSelectPanel 类在 selectPanelEngine.ts。
 * - folders-input 指令 = bundle 64399-64442（folders-input.html）。
 * - ng-flatpickr 指令 = bundle 17416（new FlatpickrInstance(input, fpOpts()) + fpOnSetup({fpItem})）。
 * - NewSmartFolderController = bundle 74323-74733 + index.html 模板逐字。
 *
 * 通道零改动：FOLDER.SELECT.PANEL.OPEN / NEW.SMART.FOLDER / EDIT.SMART.FOLDER / CONTEXTMENU.OPEN
 * 广播；localStorage 键 eagle.folderSelectPanel.collapsedFolderIds 原样。
 */

const ngShow = (show: boolean) => (show ? undefined : ({ display: 'none' } as React.CSSProperties));
const themePathOf = (theme: string) => (theme === 'light' || theme === 'lightgray' ? 'light' : 'dark');
const w = () => window as any;

/** selectall 指令（bundle 70600：Mousetrap mod+a 全选 / esc 失焦）随 input 内联包装。 */
function SelectAllInput({ inputRef: externalRef, ...props }: any) {
  const innerRef = useRef<HTMLInputElement>(null);
  const ref = externalRef || innerRef;
  useSelectAll(ref);
  return <input ref={ref} {...props} />;
}

/* ================= vs-repeat（16736-17394 垂直虚拟化）+ vs-auto-scroll（69856-69900） ================= */

/** folder-select-panel.html 的 vs-repeat 属性（vs-excess=78 vs-repeat=26 vs-size=size） */
const VS_REPEAT_OPTIONS = { elementSize: 26, excess: 78 };

interface VsRepeatResult {
  sizes: number[];
  sizesCumulative: number[];
  innerItems: any[];
  beforeHeight: number;
  afterHeight: number;
  startIndex: number;
  endIndex: number;
}

export function useVsRepeat(
  containerRef: React.RefObject<HTMLElement | null>,
  items: any[] | undefined,
  options: { elementSize: number; excess: number },
  version: number
): VsRepeatResult {
  const [tick, bump] = useState(0);

  // $scrollParent.on('scroll', throttle(scrollHandler, 33, true))：leading + trailing 节流
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let last = 0;
    let trailing: any;
    const fire = () => {
      last = Date.now();
      bump((v: number) => v + 1);
    };
    const onScroll = () => {
      const now = Date.now();
      if (now - last >= 33) {
        fire();
      } else {
        clearTimeout(trailing);
        trailing = setTimeout(fire, 33 - (now - last));
      }
    };
    container.addEventListener('scroll', onScroll, { passive: true });

    // onWindowResize（17150-17167）：无 vs-autoresize → 仅 200ms 防抖后 updateInnerCollection
    let resizeTimeout: any;
    const onWindowResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => bump((v: number) => v + 1), 200);
    };
    window.addEventListener('resize', onWindowResize);

    return () => {
      container.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onWindowResize);
      clearTimeout(trailing);
      clearTimeout(resizeTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef.current]);

  return useMemo(() => {
    const container = containerRef.current;
    if (!container || !items) {
      return { sizes: [], sizesCumulative: [], innerItems: [], beforeHeight: 0, afterHeight: 0, startIndex: 0, endIndex: 0 };
    }
    const { elementSize, excess } = options;
    const originalCollection = items;
    const originalLength = originalCollection.length;

    // refresh()（16942-16980 逐字，Eagle 改版：var size = item.size || $scope.elementSize）
    const sizes = originalCollection.map((item: any) => item.size || elementSize);
    let sum = 0;
    const sizesCumulative = sizes.map((size: number) => {
      const res = sum;
      if (size) {
        sum += size;
      }
      return res;
    });
    sizesCumulative.push(sum);

    const offsetBefore = 0;
    const offsetAfter = 0;
    // updateTotalSize（17213-17215）
    const totalSize = offsetBefore + sizesCumulative[originalLength] + offsetAfter;

    // updateInnerCollection（17234-17361，sizesPropertyExists 分支逐字；
    // scrollOffset 恒 0：repeatContainer 与 $scrollParent 为同一元素）
    const scrollPosition = container.scrollTop;
    const clientSize = container.clientHeight;
    const scrollOffset = 0;

    let __startIndex = 0;
    while (sizesCumulative[__startIndex] < scrollPosition - offsetBefore - scrollOffset) {
      __startIndex++;
    }
    if (__startIndex > 0) {
      __startIndex--;
    }
    __startIndex = Math.max(Math.floor(__startIndex - excess / 2), 0);

    let __endIndex = __startIndex;
    while (sizesCumulative[__endIndex] < scrollPosition - offsetBefore - scrollOffset + clientSize) {
      __endIndex++;
    }
    __endIndex = Math.min(Math.ceil(__endIndex + excess / 2), originalLength);

    // digestRequired 分支省略：原逻辑仅用于避免无效 digest，React 每次重渲染即最新值
    // （16999：+5 preload）
    const innerCollection = originalCollection.slice(__startIndex, __endIndex + 5);

    // before/after 占位（17090-17093 插入 + 17355-17362 高度计算逐字）
    const o1 = sizesCumulative[__startIndex] + offsetBefore;
    const o2 = sizesCumulative[innerCollection.length + __startIndex] + offsetBefore;
    const beforeHeight = o1;
    const afterHeight = totalSize - o2;

    void version;
    return { sizes, sizesCumulative, innerItems: innerCollection, beforeHeight, afterHeight, startIndex: __startIndex, endIndex: __endIndex };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, options, version, containerRef.current, tick]);
}

/** vs-auto-scroll（69856-69900 逐字）：$watch(index) 变化时滚动使当前项可见。 */
export function useVsAutoScroll(
  containerRef: React.RefObject<HTMLElement | null>,
  vr: VsRepeatResult,
  index: number | undefined
) {
  const lastIndexRef = useRef<number | undefined>(undefined);
  const sizesRef = useRef(vr.sizes);
  const sizesCumulativeRef = useRef(vr.sizesCumulative);
  sizesRef.current = vr.sizes;
  sizesCumulativeRef.current = vr.sizesCumulative;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const idx = index;
    if (idx === lastIndexRef.current) return; // $watch 仅在变化时触发
    lastIndexRef.current = idx;
    try {
      if (idx !== undefined) {
        const sizes = sizesRef.current;
        const sizesCumulative = sizesCumulativeRef.current;
        if (!sizes || !sizesCumulative) return;
        const targetPos = sizesCumulative[idx];
        const scrollTop = container.scrollTop;
        const containerHeight = container.clientHeight;
        let to: number | undefined;
        // 如果根本不在画面上，直接跳跃
        if (Math.abs(targetPos - scrollTop) > containerHeight) {
          to = targetPos - containerHeight / 2;
        }
        // 处于画面下方
        else if (targetPos > scrollTop + containerHeight - sizes[idx]) {
          to = targetPos - containerHeight + sizes[idx];
        }
        // 处于画面上方
        else if (targetPos < scrollTop) {
          to = targetPos;
        }
        // jQuery $container.scrollTop(undefined) 为 getter no-op
        if (to !== undefined) {
          container.scrollTop = to;
        }
      }
    } catch (err) {
      // 原版 catch(err) {} 静默
    }
  });
}

/* ================= folder-select-panel 指令（556-637 + 模板逐字） ================= */

export function FolderSelectPanelHost() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const { snapshot } = usePanelState();
  const theme = snapshot.theme;
  const [, bump] = useState(0);
  const rootRef = useRef<HTMLElement>(null);
  const listRef = useRef<HTMLElement | null>(null);
  const panelRef = useRef<FolderSelectPanel | null>(null);

  useEffect(() => {
    setHost(document.getElementById('eagle-folder-select-panel-host'));
  }, []);

  useEffect(() => {
    if (!host || !rootRef.current) return;

    const panel = new FolderSelectPanel({
      notify: () => bump((v: number) => v + 1),
      panelSelector: '#folder-select-panel',
      searchInputSelector: '#folder-select-panel-search-input',
    });
    panelRef.current = panel;
    // 闭环测试契约
    (window as any).__eagleFolderSelectPanel = panel;

    // 如果面板的位置壓住了標籤選擇按鈕，則將面板移動到檢查器左側 + 10px 處（567-578 逐字）
    const preventOverlayInspector = () => {
      try {
        const selectPanel = rootRef.current ? (rootRef.current.querySelector('.select-panel') as HTMLElement | null) : null;
        const inspectorLeft = offsetOf(q('.inspector'))?.left || 0;
        const panelWidth = widthOf(selectPanel);
        const panelLeft = offsetOf(selectPanel)?.left || 0;
        const newLeft = inspectorLeft - panelWidth + 5;
        if (panelLeft + panelWidth > inspectorLeft && newLeft > 0) {
          setCssEl(selectPanel, { left: newLeft });
        }
      } catch (e) {}
    };

    // scope.$on('FOLDER.SELECT.PANEL.OPEN')（586-634；Object.assign(scope, ...) → 实例直读）
    let off: any;
    {
      off = folderSelectPanelOpenChannel.on((params: any) => {
        panel.init(params);

        // $timeout(..., 20) → setTimeout 20
        setTimeout(() => {
          panel.open();
          preventOverlayInspector();
        }, 20);

        bump((v: number) => v + 1);
      });
    }

    return () => {
      if (off) off();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host]);

  const panel = panelRef.current;
  const listData = panel?.listData;
  const collapsedFolderIds = panel?.collapsedFolderIds || {};

  // ng-click/ng-mouseenter 后的 Angular digest 等价：DOM 事件驱动的面板调用后强制重渲染
  const bumpAll = () => bump((v: number) => v + 1);

  // hoverItem 包装（613-622 逐字：鼠标位移距离 0 不改 currentIndex）
  const hoverItem = (event: any, item: any) => {
    if (!panel) return;
    const currentMouseX = event.clientX;
    const currentMouseY = event.clientY;
    const lastMouseX = w().windowMouseX;
    const lastMouseY = w().windowMouseY;
    const distance = Math.sqrt(Math.pow(currentMouseX - lastMouseX, 2) + Math.pow(currentMouseY - lastMouseY, 2));
    if (distance !== 0) {
      panel.hoverItem(item.index);
      bumpAll();
    }
  };

  const vr = useVsRepeat(listRef, listData?.items, VS_REPEAT_OPTIONS, listData?.items?.length ?? 0);
  useVsAutoScroll(listRef, vr, listData?.currentIndex);

  if (!host) return null;

  return createPortal(
    <>
      <select-panel
        ref={rootRef as any}
        id="folder-select-panel"
        className={`select-panel folder-select-panel max-depth-${listData?.maxDepth ?? ''}`}
        onMouseUp={() => panel && panel.focusSearchInput()}
      >
        <div className="panel-header">
          {/* 搜索框 */}
          <div className="search">
            <input id="folder-select-panel-search-input" type="search" placeholder={t('general.search')} />
          </div>

          <div className="tabs">
            {/* 全部 */}
            <div
              className={`tab${listData?.currentTab === 'ALL' ? ' active' : ''}`}
              onClick={() => { panel && panel.changeTab('ALL'); bumpAll(); }}
              tippy=""
              tippy-placement="top"
              tippy-content={t('selectFolderPanel.tabs.all')}
            >
              <img src={`assets/images/${themePathOf(theme)}/icons/ic-folder-select-all.svg`} />
            </div>
            {/* 最近使用 */}
            <div
              className={`tab${listData?.currentTab === 'RECENT' ? ' active' : ''}`}
              onClick={() => { panel && panel.changeTab('RECENT'); bumpAll(); }}
              tippy=""
              tippy-placement="top"
              tippy-content={t('selectFolderPanel.tabs.recent')}
            >
              <img src={`assets/images/${themePathOf(theme)}/icons/ic-folder-select-recent.svg`} />
            </div>
            {/* 已选 */}
            <div
              className={`tab${listData?.currentTab === 'SELECTED' ? ' active' : ''}`}
              onClick={() => { panel && panel.changeTab('SELECTED'); bumpAll(); }}
              tippy=""
              tippy-placement="top"
              tippy-content={t('selectFolderPanel.tabs.selected')}
            >
              <img src={`assets/images/${themePathOf(theme)}/icons/ic-folder-select-selected.svg`} />
            </div>
          </div>
        </div>

        {/* 空状态 */}
        {listData?.items?.length === 0 && (
          <div className="panel-empty">
            {listData.currentTab === 'ALL' && <span>{t('selectFolderPanel.empty.all')}</span>}
            {listData.currentTab === 'RECENT' && <span>{t('selectFolderPanel.empty.recent')}</span>}
            {listData.currentTab === 'SELECTED' && <span>{t('selectFolderPanel.empty.selected')}</span>}
          </div>
        )}

        {/* 项目列表 */}
        <div className="panel-list" style={ngShow(!(listData?.items?.length === 0))}>
          <select-panel-list ref={listRef as any} vs-excess="78" vs-repeat="26" vs-size="size">
            <div className="vs-repeat-before-content" style={{ width: '100%', minHeight: vr.beforeHeight }} />
            {vr.innerItems.map((item: any, i: number) => {
              const isActive = item.index == listData?.currentIndex;
              const isChecked = !!(listData && listData.selectedIds[item.id]);
              let inner: React.ReactNode = null;
              if (item.type === 'separator') {
                // 分隔線
                inner = <div className="separator" />;
              } else if (item.type === 'create') {
                // 建立資料夾
                inner = (
                  <div
                    className={`list-item${isActive ? ' active' : ''}`}
                    style={{ height: '26px', lineHeight: '26px' }}
                  >
                    <div className="checkbox">
                      <img src={`assets/images/${themePathOf(theme)}/icons/ic-folder-select-create.svg`} />
                    </div>
                    <div className="icon">
                      <div className="fake-svg png" />
                    </div>
                    <div className="name">
                      {t('selectFolderPanel.newFolderBtn')} "<b>{item.name}</b>"
                    </div>
                  </div>
                );
              } else {
                // 選擇資料夾
                const searchMode =
                  (listData && (listData.currentTab === 'SELECTED' || (listData.searchKeyword || '').length > 0)) || false;
                inner = (
                  <div
                    className={`list-item depth-${item.depth} color-${item.iconColor ?? ''} icon-${item.icon ?? ''}${isActive ? ' active' : ''}${isChecked ? ' selected' : ''}${searchMode ? ' search-mode' : ''}`}
                    style={{ height: '26px', lineHeight: '26px' }}
                    onContextMenu={(e) => {
                      e.stopPropagation();
                      panel && panel.openItemSubmenu(item);
                    }}
                  >
                    {!item.isRecent && (
                      <div className="guidelines">
                        {(item.guidelines || []).map((line: string, gi: number) => (
                          <div
                            key={gi}
                            className={`guideline color-${line} depth-${gi + 1}`}
                            style={ngShow(item.depth !== gi)}
                          >
                            <div className="top" />
                            <div className="middle" />
                            <div className="bottom" />
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="checkbox">
                      <div className="check-icon" />
                    </div>
                    <div className="icon">
                      <div className="fake-svg png" />
                      {item.isRecent && <div className="history-badge" />}
                    </div>
                    <div
                      className="name"
                      dangerouslySetInnerHTML={{ __html: fuzzyMatchHtml(item.name, listData?.searchKeyword || '') }}
                    />
                    <div className="right">
                      {item.parentItem && <div className="parent-name">{item.parentItem.name}</div>}
                      <div
                        className={`ic-btn collapse${!collapsedFolderIds[item.id] ? ' rotate' : ''}`}
                        style={ngShow(!listData?.searchKeyword)}
                        onClick={(e) => {
                          e.stopPropagation();
                          panel && panel.toggleExpand(item);
                          bumpAll();
                        }}
                      >
                        {!item.isRecent && item.hasChildren && (
                          <img src={`assets/images/${themePathOf(theme)}/icons/ic-panel-item-expand.svg`} />
                        )}
                      </div>
                    </div>
                  </div>
                );
              }
              return (
                <div
                  key={i}
                  className={`select-panel-item${isActive ? ' active' : ''}${isChecked ? ' checked' : ''}`}
                  onClick={(e) => { panel && panel.openItem(e, item); bumpAll(); }}
                  onMouseEnter={(e) => hoverItem(e, item)}
                >
                  {inner}
                </div>
              );
            })}
            <div className="vs-repeat-after-content" style={{ width: '100%', minHeight: vr.afterHeight }} />
          </select-panel-list>
        </div>

        <div className="panel-footer">
          <div className="left">
            <div className="shortcut-tip">
              {t('selectFolderPanel.shortcuts.switch')}
              <key>Tab</key>
            </div>
            <div className="shortcut-tip">
              {t('selectFolderPanel.shortcuts.move')}
              <div className="keys">
                <key>↑</key>
                <key>↓</key>
              </div>
            </div>
            <div className="shortcut-tip">
              {t('selectFolderPanel.shortcuts.select')}
              <key>︎⏎</key>
            </div>
          </div>
          <div className="right">
            <div className="shortcut-tip">
              {t('selectFolderPanel.shortcuts.close')}
              <key>︎ESC</key>
            </div>
          </div>
        </div>
      </select-panel>
      <select-panel-overlay onClick={() => { panel && panel.close(); bumpAll(); }} />
    </>,
    host
  );
}

/* ================= folders-input 指令（64399-64442 + folders-input.html 逐字） ================= */

export function FoldersInput({
  theme,
  folderIds,
  onFolderIdsReplace,
  onChange,
  style,
}: {
  theme: string;
  folderIds: any[];
  onFolderIdsReplace?: (next: any[]) => void;
  onChange?: () => void;
  style?: React.CSSProperties;
}) {
  const folderIdsRef = useRef(folderIds);
  folderIdsRef.current = folderIds;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onReplaceRef = useRef(onFolderIdsReplace);
  onReplaceRef.current = onFolderIdsReplace;
  // link 期一次性捕获（$scope.folderMappings = $bodyScope.folderMappings，对象引用原地变更）
  const folderMappingsRef = useRef<any>(useItemState.getState().folderMappings);

  const [, setBump] = useState(0);

  const openPanel = () => {
        const folders = useFolderState.getState().folders;
    const originalSelectedIds = folderIdsRef.current.reduce(
      (map: any, id: any) => {
        map[id] = true;
        return map;
      },
      {} as any
    );

    FolderSelectPanel.open({
      folders: folders,
      selectedIds: originalSelectedIds,
      onChanged: (result: any) => {
        if (!result?.isDirty) return;
        const { selectedFolderIds, deselectedFolderIds } = result;
        void deselectedFolderIds;
        // $scope.folderIds = Object.keys(selectedFolderIds) —— '=' 双向绑定写回父级数组引用
        if (onReplaceRef.current) onReplaceRef.current(Object.keys(selectedFolderIds));
        // $evalAsync($timeout(onChange)) → setTimeout 0
        setTimeout(() => {
          onChangeRef.current && onChangeRef.current();
        }, 0);
      },
    });
  };

  const remove = (index: number) => {
    folderIdsRef.current.splice(index, 1);
    setBump((v) => v + 1);
    onChangeRef.current && onChangeRef.current();
  };

  const folderMappings = folderMappingsRef.current || {};

  return (
    <div
      id="folders-input"
      className="labels-input"
      style={style}
      onClick={(e) => {
        e.stopPropagation();
        openPanel();
      }}
    >
      <div className="empty" style={ngShow(folderIds.length === 0)}>
        {t('createAction.rule.addFolders')}
      </div>
      <div className="label-container">
        {folderIds.map((folderId: any, index: number) => (
          <div className={`label-item color-${folderMappings[folderId]?.iconColor ?? ''}`} key={index}>
            <span className="label-item-name">{folderMappings[folderId]?.name}</span>
            <div
              className="ic-btn label-item-remove-btn"
              onClick={(e) => {
                e.stopPropagation();
                remove(index);
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

/* ================= ng-flatpickr（bundle 17416 逐字） ================= */

function FlatpickrInput({ fpOpts, fpOnSetup, rule, ...rest }: any) {
  const inputRef = useRef<HTMLInputElement>(null);
  const fpOptsRef = useRef(fpOpts);
  const fpOnSetupRef = useRef(fpOnSetup);
  fpOptsRef.current = fpOpts;
  fpOnSetupRef.current = fpOnSetup;

  // ng-flatpickr link：new FlatpickrInstance(n[0], t.fpOpts()); t.fpOnSetup && t.fpOnSetup({fpItem: r})
  // $destroy → r.destroy()
  useEffect(() => {
    const FP = w().FlatpickrInstance;
    if (!FP || !inputRef.current) return;
    const instance = new FP(inputRef.current, fpOptsRef.current);
    if (fpOnSetupRef.current) fpOnSetupRef.current(instance);
    return () => {
      try {
        instance.destroy();
      } catch (e) {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 原 onChange 经 angular.element(instance._input).scope().rule 取规则 → 挂到 input 元素
  useLayoutEffect(() => {
    if (inputRef.current) {
      (inputRef.current as any).__eagleRule = rule;
    }
  });

  return <input ref={inputRef} data-enabletime="true" {...rest} />;
}

/* ================= NewSmartFolderController（74323-74733 + index.html 模板逐字） ================= */

const defaultConditions = () => [
  {
    rules: [
      {
        property: 'name',
        method: 'contain',
        value: '',
      },
    ],
    match: 'OR',
    boolean: 'TRUE',
  },
];

export function NewSmartFolderModal() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const { snapshot } = usePanelState();
  const theme = snapshot.theme;
  const [isOpen, setIsOpen] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [isNoFolderName, setIsNoFolderName] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [, bump] = useState(0);
  const bumpAll = () => bump((v: number) => v + 1);

  const isEditModeRef = useRef<any>(undefined);
  const smartFolderRef = useRef<any>(undefined);
  const originSmartFolderRef = useRef<any>(undefined);
  const parentRef = useRef<any>(undefined);
  const conditionsRef = useRef<any[]>(defaultConditions());
  const foldersSuggestionRef = useRef<any[]>([]);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const folderNameRef = useRef('');
  folderNameRef.current = folderName;
  const recalcRef = useRef<() => void>(() => {});

  // dateOpts1/dateOpts2（74319-74350 逐字；controller 期一次性定义；
  // angular.element(instance._input).scope().rule → instance._input.__eagleRule）
  const dateOptsRef = useRef<any>(null);
  if (!dateOptsRef.current) {
    const lang = String(useBodyState.getState().language ?? '');
    const locale = lang.indexOf('zh') > -1 ? 'zh' : 'en';
    dateOptsRef.current = {
      dateOpts1: {
        dateFormat: 'Y-m-d',
        allowInput: false,
        locale: locale,
        onChange: (selectedDates: any, dateStr: any, instance: any) => {
          const rule = (instance._input as any).__eagleRule;
          if (selectedDates.length == 1) {
            const date = selectedDates[0].getTime();
            rule.value = [date];
            recalcRef.current();
          }
        },
      },
      dateOpts2: {
        dateFormat: 'Y-m-d',
        allowInput: false,
        locale: locale,
        mode: 'range',
        onChange: (selectedDates: any, dateStr: any, instance: any) => {
          const rule = (instance._input as any).__eagleRule;
          if (selectedDates.length == 2) {
            const start = selectedDates[0].getTime();
            const end = selectedDates[1].getTime();
            rule.value = [start, end];
            recalcRef.current();
          }
        },
      },
    };
  }

  // datePostSetup（74352-74363 逐字）
  const datePostSetup = (fpItem: any, rule: any) => {
    const value = rule.value;
    if (value.length === 1) {
      fpItem.setDate(new Date(value[0]));
    } else if (value.length === 2) {
      fpItem.setDate([new Date(value[0]), new Date(value[1])]);
    }
  };

  const init = () => {
    foldersSuggestionRef.current = [];
        w().eagle.utils.tree.walk(useFolderState.getState().folders, 'children', (folder: any, parent: any) => {
      foldersSuggestionRef.current.push({
        value: folder.id,
        text: folder.name,
      });
    });
  };

  // $index（未在 ng-repeat 内）为 undefined：undefined + 1 = NaN → splice(NaN,…) 按 0 处理
  const createCondition = (index: number) => {
    if (conditionsRef.current.length >= 30) return;
    const newCondition = {
      rules: [
        {
          property: 'name',
          method: 'contain',
          value: '',
        },
      ],
      match: 'OR',
      boolean: 'TRUE',
    };
    conditionsRef.current.splice(index, 0, newCondition);
    recalculateResult();
  };

  const removeCondition = (condition: any) => {
    if (conditionsRef.current.length === 0) return;
    const idx = conditionsRef.current.indexOf(condition);
    if (idx > -1) {
      conditionsRef.current.splice(idx, 1);
      recalculateResult();
    }
  };

  const createRule = (condition: any, index: number) => {
    if (condition.rules.length >= 30) return;
    const newRule = {
      property: 'name',
      method: 'contain',
      value: '',
    };
    condition.rules.splice(index, 0, newRule);
    recalculateResult();
  };

  const removeRule = (condition: any, rule: any) => {
    if (condition.rules.length == 1) return;
    const idx = condition.rules.indexOf(rule);
    if (idx > -1) {
      condition.rules.splice(idx, 1);
      recalculateResult();
    }
  };

  const changeProperty = (rule: any) => {
    switch (rule.property) {
      case 'name':
      case 'url':
      case 'annotation':
      case 'camera':
        rule.method = 'contain';
        rule.value = '';
        break;
      case 'width':
      case 'height':
        rule.method = '>';
        rule.value = [480, 0];
        break;
      case 'fileSize':
        rule.method = '>';
        rule.value = [1, 0];
        rule.unit = 'mb';
        break;
      case 'shape':
        rule.method = 'equal';
        rule.value = 'landscape';
        break;
      case 'rating':
        rule.method = 'equal';
        rule.value = '5';
        break;
      case 'type':
        rule.method = 'equal';
        rule.value = w().eagle.filter.filterTypes[0] || 'png';
        break;
      case 'color':
        rule.method = 'similar';
        rule.value = '#0087EF';
        break;
      case 'tags':
        rule.method = 'intersection';
        rule.value = [];
        break;
      case 'folders':
        rule.method = 'intersection';
        rule.value = [];
        break;
      case 'createTime':
        rule.method = 'before';
        rule.value = [];
        break;
      case 'mtime':
        rule.method = 'before';
        rule.value = [];
        break;
      case 'btime':
        rule.method = 'before';
        rule.value = [];
        break;
      case 'duration':
        rule.method = '<=';
        rule.value = [30, 0];
        rule.unit = 's';
        break;
      case 'bpm':
        rule.method = '>=';
        rule.value = [160, 0];
        break;
      case 'iso':
        rule.method = '>';
        rule.value = [100, 0];
        break;
      case 'aperture':
        rule.method = '>';
        rule.value = [3.5, 0];
        break;
      case 'focalLength':
        rule.method = '>';
        rule.value = [20.0, 0];
        break;
      case 'shutter':
        rule.method = '>';
        rule.value = [100.0, 0];
        break;
      case 'timestamp':
        rule.method = 'before';
        rule.value = [];
        break;
      case 'fontActivated':
        rule.method = 'activate';
        break;
    }
    recalculateResult();
  };

  const changeMethod = (rule: any) => {
    switch (rule.property) {
      case 'createTime':
      case 'mtime':
      case 'btime':
        if (rule.method === 'between') {
          rule.value = '';
        } else if (rule.value.indexOf('~') > -1) {
          rule.value = '';
        } else if (rule.method === 'within') {
          rule.value[0] = 30;
        }
        break;
    }
    recalculateResult();
  };

  const changeValue = (rule?: any, tags?: any) => {
    void rule;
    void tags;
    recalculateResult();
  };

  // ng-model-options debounce 等价：模型变更即时、changeValue 按延迟去抖、blur 立即冲刷（blur: 0）
  const debounceTimersRef = useRef<Map<string, any>>(new Map());
  const debouncedRecalc = (key: string, delay: number) => {
    const timers = debounceTimersRef.current;
    clearTimeout(timers.get(key));
    timers.set(
      key,
      setTimeout(() => {
        timers.delete(key);
        recalculateResult();
      }, delay)
    );
  };
  const flushRecalc = (key: string) => {
    const timers = debounceTimersRef.current;
    const timer = timers.get(key);
    if (timer) {
      clearTimeout(timer);
      timers.delete(key);
      recalculateResult();
    }
  };

  const recalculateResult = () => {
    const body = getBodyScope();

    body.currentSmartFolder = {
      name: '',
      conditions: conditionsRef.current,
    };
    if (smartFolderRef.current && smartFolderRef.current.parent) {
      useFolderState.getState().currentSmartFolder.parent = smartFolderRef.current.parent;
    }
    // $filter('filter')(raw, contentFilter)——contentFilter 为函数谓词，等价 raw.filter
    const result = useItemState.getState().raw.filter((x: any) => machineryContentFilter(body, x));
    const count = result.length;
    setTotalCount(count);
    machineryRebindRefresh(body, undefined, undefined, undefined);
    // digest 等价：强制重渲染展示 conditions/rules 的原地变更
    bumpAll();
  };
  recalcRef.current = recalculateResult;

  const nameKeydown = (event: any) => {
    const keyCode = event.keyCode;
    if (keyCode === 27) {
      cancel();
    } else if (keyCode === 13) {
      if (event.metaKey || event.ctrlKey) {
        event.target?.blur?.();
        save();
      }
    }
    // selectall 指令（mod+a / esc；AutoTaggingModal 同款内联模拟——Mousetrap 在 React 委托下会阻断 onKeyDown）
    if ((event.ctrlKey || event.metaKey) && String(event.key || '').toLowerCase() === 'a') {
      event.stopPropagation();
      nameInputRef.current?.select();
    } else if (keyCode === 27) {
      event.stopPropagation();
      nameInputRef.current?.blur();
    }
  };

  const save = () => {
    const body = getBodyScope();

    if (!folderNameRef.current) {
      setIsNoFolderName(true);
      return;
    } else {
      setIsNoFolderName(false);
    }

    // create 分支的 var smartFolder 函数级提升（edit 分支引用它 → TypeError 被 try/catch 吞掉，保留怪癖）
    let smartFolder: any;

    if (!isEditModeRef.current) {
      smartFolder = {
        id: w().guid(),
        name: folderNameRef.current,
        conditions: conditionsRef.current,
        modificationTime: Date.now(),
        children: [],
      };

      let children = useFolderState.getState().smartFolders;
      if (parentRef.current) {
        if (!parentRef.current.children) {
          parentRef.current.children = [];
        }
        children = parentRef.current.children;
        smartFolder.parent = parentRef.current.id;
        parentRef.current.isExpand = true;
      }

      let idx = (children && children.length) || 0;
      if (originSmartFolderRef.current) {
        idx = children.indexOf(originSmartFolderRef.current) + 1;
      }

      children.splice(idx, 0, smartFolder);
      smartFolder.imageCount = machinerySmartFolderCount(body, smartFolder);
      useItemState.getState().smartFolderMappings[smartFolder.id] = smartFolder;
      updateSidebarList();
      openSmartFolder(smartFolder);
      setTimeout(() => {
        machineryChangeSidebarIndex(smartFolder);
      }, 400);
      try {
        if (w().electronLog) w().electronLog.info(`[app] Create new smart-folder: ${smartFolder.name}(${smartFolder.id})`);
        if (w().electronLog) w().electronLog.info(`${JSON.stringify(smartFolder)}`);
        w().analytics.event('SmartFolder', 'Create', smartFolder.name);
      } catch (err) {}
    } else {
      smartFolderRef.current.name = folderNameRef.current;
      smartFolderRef.current.conditions = conditionsRef.current;
      smartFolderRef.current.modificationTime = Date.now();
      smartFolderRef.current.imageCount = machinerySmartFolderCount(body, smartFolderRef.current);
      if (smartFolderRef.current) {
        updateSidebarList();
        openSmartFolder(smartFolderRef.current);
        setTimeout(() => {
          machineryChangeSidebarIndex(smartFolderRef.current);
        }, 400);
        try {
          if (w().electronLog) w().electronLog.info(`[app] Edit smart-folder: ${smartFolderRef.current.name}(${smartFolderRef.current.id})`);
          if (w().electronLog) w().electronLog.info(`${JSON.stringify(smartFolderRef.current)}`);
          // 原版此处引用提升后的 smartFolder（edit 分支未赋值）→ TypeError → catch（怪癖保留）
          w().analytics.event('SmartFolder', 'Rename', smartFolder.name);
        } catch (err) {}

        setTimeout(() => {
          // 原版 $scope.smartFolderCount 经 scope 原型链解析到 body.smartFolderCount
          w().eagle.utils.tree.walk(smartFolderRef.current.children, 'children', (csf: any, parent: any, depth: any) => {
            csf.imageCount = machinerySmartFolderCount(body, csf);
          });
          bumpAll();
        }, 200);
      }
    }
    saveFolder();
    isEditModeRef.current = undefined;
    setIsOpen(false);
    const input = document.getElementById('smart-folder-name-input');
    if (input) input.setAttribute('tabindex', '-1');
  };

  const cancel = () => {
    const body = getBodyScope();
    const input = document.getElementById('smart-folder-name-input');
    if (input) input.setAttribute('tabindex', '-1');
    if (isEditModeRef.current) {
      body.currentSmartFolder = smartFolderRef.current || undefined;
    } else {
      body.currentSmartFolder = originSmartFolderRef.current || undefined;
    }
    isEditModeRef.current = undefined;
    setIsOpen(false);
    machineryRebindRefresh(body, undefined, undefined, undefined);
    scopeEvalAsync();
  };

  useEffect(() => {
    setHost(document.getElementById('eagle-smart-folder-host'));
  }, []);

  useEffect(() => {

    // $scope.$on("NEW.SMART.FOLDER")（74387-74414 逐字）
    const offNew = newSmartFolderChannel.on(({ smartFolder, parent }: any) => {
      init();
      parentRef.current = undefined;
      setIsOpen(true);
      smartFolderRef.current = undefined;
      setFolderName('');
      conditionsRef.current = defaultConditions();
      originSmartFolderRef.current = smartFolder;
      if (!parent) {
        if (smartFolder && smartFolder.parent && useItemState.getState().smartFolderMappings[smartFolder.parent]) {
          parentRef.current = useItemState.getState().smartFolderMappings[smartFolder.parent];
        }
      } else {
        parentRef.current = useItemState.getState().smartFolderMappings[parent.id];
      }
      setTimeout(() => {
        document.getElementById('smart-folder-name-input')?.focus();
      }, 100);
      bumpAll();
    });

    // $scope.$on("EDIT.SMART.FOLDER")（74416-74435 逐字）
    const offEdit = editSmartFolderChannel.on((smartFolder: any) => {
      init();
      if (smartFolder) {
        const sf = deepCopy(smartFolder);
        isEditModeRef.current = true;
        smartFolderRef.current = smartFolder;
        setIsOpen(true);
        setFolderName(sf.name);
        conditionsRef.current = sf.conditions;
        conditionsRef.current.forEach((condition: any) => {
          if (!condition.boolean) {
            condition.boolean = 'TRUE';
          }
        });
      }
      recalcRef.current();
      setTimeout(() => {
        document.getElementById('smart-folder-name-input')?.focus();
      }, 100);
      bumpAll();
    });

    // 闭环测试契约
    (window as any).__eagleNewSmartFolder = {
      save: () => save(),
      cancel: () => cancel(),
      recalculateResult: () => recalcRef.current(),
      get isOpen() {
        return isOpen;
      },
      get conditions() {
        return conditionsRef.current;
      },
    };

    return () => {
      offNew();
      offEdit();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host]);

  if (!host) return null;

  const filterTypes = w().eagle?.filter?.filterTypes || [];
  const filterExtensions = w().eagle?.filter?.filterExtensions || {};
  const renderRuleValue = (rule: any, ci: number, ri: number) => {
    const dk = `${ci}-${ri}`;
    switch (rule.property) {
      /* 標題、網址、註釋專用 */
      case 'name':
      case 'folderName':
      case 'url':
      case 'annotation':
      case 'comments':
      case 'camera':
        return (
          <SelectAllInput
            type="text"
            maxLength={2048}
            value={rule.value ?? ''}
            onChange={(e: any) => {
              rule.value = e.target.value;
              bumpAll();
              debouncedRecalc(dk, 300);
            }}
            onBlur={() => flushRecalc(dk)}
            style={ngShow(!(rule.method === 'empty' || rule.method === 'not-empty'))}
            selectall=""
          />
        );
      /* 寬高專用 */
      case 'width':
      case 'height':
      case 'iso':
        return (
          <div className="row">
            {rule.method != 'between' && (
              <div className="col-xs-12">
                <SelectAllInput
                  type="number"
                  value={rule.value[0] ?? ''}
                  onChange={(e: any) => {
                    rule.value[0] = e.target.value === '' ? undefined : Number(e.target.value);
                    bumpAll();
                    debouncedRecalc(dk, 300);
                  }}
                  onBlur={() => flushRecalc(dk)}
                  selectall=""
                />
              </div>
            )}
            {rule.method == 'between' && (
              <div className="col-xs-12">
                <SelectAllInput
                  type="number"
                  style={{ display: 'inline-block', width: '85px', margin: '0 0 0 6px' }}
                  value={rule.value[0] ?? ''}
                  onChange={(e: any) => {
                    rule.value[0] = e.target.value === '' ? undefined : Number(e.target.value);
                    bumpAll();
                    debouncedRecalc(dk, 300);
                  }}
                  onBlur={() => flushRecalc(dk)}
                  selectall=""
                />{' '}
                ~{' '}
                <SelectAllInput
                  type="number"
                  style={{ display: 'inline-block', width: '85px', margin: '0' }}
                  value={rule.value[1] ?? ''}
                  onChange={(e: any) => {
                    rule.value[1] = e.target.value === '' ? undefined : Number(e.target.value);
                    bumpAll();
                    debouncedRecalc(dk, 300);
                  }}
                  onBlur={() => flushRecalc(dk)}
                  selectall=""
                />
              </div>
            )}
          </div>
        );
      /* 檔案大小 */
      case 'fileSize':
        return (
          <div className="row">
            {rule.method != 'between' && (
              <div className="col-xs-8">
                <SelectAllInput
                  type="number"
                  value={rule.value[0] ?? ''}
                  onChange={(e: any) => {
                    rule.value[0] = e.target.value === '' ? undefined : Number(e.target.value);
                    bumpAll();
                    debouncedRecalc(dk, 300);
                  }}
                  onBlur={() => flushRecalc(dk)}
                  selectall=""
                />
              </div>
            )}
            {rule.method == 'between' && (
              <div className="col-xs-8">
                <SelectAllInput
                  type="number"
                  style={{ display: 'inline-block', width: '54px', margin: '0 0 0 6px' }}
                  value={rule.value[0] ?? ''}
                  onChange={(e: any) => {
                    rule.value[0] = e.target.value === '' ? undefined : Number(e.target.value);
                    bumpAll();
                    debouncedRecalc(dk, 300);
                  }}
                  onBlur={() => flushRecalc(dk)}
                  selectall=""
                />{' '}
                ~{' '}
                <SelectAllInput
                  type="number"
                  style={{ display: 'inline-block', width: '54px', margin: '0' }}
                  value={rule.value[1] ?? ''}
                  onChange={(e: any) => {
                    rule.value[1] = e.target.value === '' ? undefined : Number(e.target.value);
                    bumpAll();
                    debouncedRecalc(dk, 300);
                  }}
                  onBlur={() => flushRecalc(dk)}
                  selectall=""
                />
              </div>
            )}
            <div className="col-xs-4">
              <div className="select select-xs">
                <select
                  tabIndex={-1}
                  value={rule.unit ?? ''}
                  onChange={(e: any) => {
                    rule.unit = e.target.value;
                    changeValue();
                  }}
                >
                  <option value="kb">KB</option>
                  <option value="mb">MB</option>
                </select>
              </div>
            </div>
          </div>
        );
      /* 視頻長度 */
      case 'duration':
        return (
          <div className="row">
            {rule.method != 'between' && (
              <div className="col-xs-8">
                <SelectAllInput
                  type="number"
                  value={rule.value[0] ?? ''}
                  onChange={(e: any) => {
                    rule.value[0] = e.target.value === '' ? undefined : Number(e.target.value);
                    bumpAll();
                    debouncedRecalc(dk, 300);
                  }}
                  onBlur={() => flushRecalc(dk)}
                  selectall=""
                />
              </div>
            )}
            {rule.method == 'between' && (
              <div className="col-xs-8">
                <SelectAllInput
                  type="number"
                  style={{ display: 'inline-block', width: '54px', margin: '0 0 0 6px' }}
                  value={rule.value[0] ?? ''}
                  onChange={(e: any) => {
                    rule.value[0] = e.target.value === '' ? undefined : Number(e.target.value);
                    bumpAll();
                    debouncedRecalc(dk, 300);
                  }}
                  onBlur={() => flushRecalc(dk)}
                  selectall=""
                />{' '}
                ~{' '}
                <SelectAllInput
                  type="number"
                  style={{ display: 'inline-block', width: '54px', margin: '0' }}
                  value={rule.value[1] ?? ''}
                  onChange={(e: any) => {
                    rule.value[1] = e.target.value === '' ? undefined : Number(e.target.value);
                    bumpAll();
                    debouncedRecalc(dk, 300);
                  }}
                  onBlur={() => flushRecalc(dk)}
                  selectall=""
                />
              </div>
            )}
            <div className="col-xs-4">
              <div className="select select-xs">
                <select
                  tabIndex={-1}
                  value={rule.unit ?? ''}
                  onChange={(e: any) => {
                    rule.unit = e.target.value;
                    changeValue();
                  }}
                >
                  <option value="s">{t('modal.smartFolder.ruleValue.s')}</option>
                  <option value="m">{t('modal.smartFolder.ruleValue.m')}</option>
                  <option value="h">{t('modal.smartFolder.ruleValue.h')}</option>
                </select>
              </div>
            </div>
          </div>
        );
      /* BPM */
      case 'bpm':
        return (
          <div className="row">
            {rule.method != 'between' && (
              <div className="col-xs-12">
                <SelectAllInput
                  type="number"
                  value={rule.value[0] ?? ''}
                  onChange={(e: any) => {
                    rule.value[0] = e.target.value === '' ? undefined : Number(e.target.value);
                    bumpAll();
                    debouncedRecalc(dk, 300);
                  }}
                  onBlur={() => flushRecalc(dk)}
                  selectall=""
                />
              </div>
            )}
            {rule.method == 'between' && (
              <div className="col-xs-12">
                <SelectAllInput
                  type="number"
                  style={{ display: 'inline-block', width: '54px', margin: '0 0 0 6px' }}
                  value={rule.value[0] ?? ''}
                  onChange={(e: any) => {
                    rule.value[0] = e.target.value === '' ? undefined : Number(e.target.value);
                    bumpAll();
                    debouncedRecalc(dk, 300);
                  }}
                  onBlur={() => flushRecalc(dk)}
                  selectall=""
                />{' '}
                ~{' '}
                <SelectAllInput
                  type="number"
                  style={{ display: 'inline-block', width: '54px', margin: '0' }}
                  value={rule.value[1] ?? ''}
                  onChange={(e: any) => {
                    rule.value[1] = e.target.value === '' ? undefined : Number(e.target.value);
                    bumpAll();
                    debouncedRecalc(dk, 300);
                  }}
                  onBlur={() => flushRecalc(dk)}
                  selectall=""
                />
              </div>
            )}
          </div>
        );
      /* 光圈 */
      case 'aperture':
        return (
          <div className="row">
            <div className="col-xs-2" style={{ textAlign: 'right', lineHeight: '26px' }}>
              f/
            </div>
            {rule.method != 'between' && (
              <div className="col-xs-10">
                <SelectAllInput
                  type="number"
                  value={rule.value[0] ?? ''}
                  onChange={(e: any) => {
                    rule.value[0] = e.target.value === '' ? undefined : Number(e.target.value);
                    bumpAll();
                    debouncedRecalc(dk, 300);
                  }}
                  onBlur={() => flushRecalc(dk)}
                  selectall=""
                />
              </div>
            )}
            {rule.method == 'between' && (
              <div className="col-xs-10">
                <SelectAllInput
                  type="number"
                  style={{ display: 'inline-block', width: '54\\px', margin: '0 0 0 6px' }}
                  value={rule.value[0] ?? ''}
                  onChange={(e: any) => {
                    rule.value[0] = e.target.value === '' ? undefined : Number(e.target.value);
                    bumpAll();
                    debouncedRecalc(dk, 300);
                  }}
                  onBlur={() => flushRecalc(dk)}
                  selectall=""
                />{' '}
                ~{' '}
                <SelectAllInput
                  type="number"
                  style={{ display: 'inline-block', width: '54px', margin: '0' }}
                  value={rule.value[1] ?? ''}
                  onChange={(e: any) => {
                    rule.value[1] = e.target.value === '' ? undefined : Number(e.target.value);
                    bumpAll();
                    debouncedRecalc(dk, 500);
                  }}
                  onBlur={() => flushRecalc(dk)}
                  selectall=""
                />
              </div>
            )}
          </div>
        );
      /* 焦距 */
      case 'focalLength':
        return (
          <div className="row">
            {rule.method != 'between' && (
              <div className="col-xs-10">
                <SelectAllInput
                  type="number"
                  value={rule.value[0] ?? ''}
                  onChange={(e: any) => {
                    rule.value[0] = e.target.value === '' ? undefined : Number(e.target.value);
                    bumpAll();
                    debouncedRecalc(dk, 300);
                  }}
                  onBlur={() => flushRecalc(dk)}
                  selectall=""
                />
              </div>
            )}
            {rule.method == 'between' && (
              <div className="col-xs-10">
                <SelectAllInput
                  type="number"
                  style={{ display: 'inline-block', width: '54px', margin: '0 0 0 6px' }}
                  value={rule.value[0] ?? ''}
                  onChange={(e: any) => {
                    rule.value[0] = e.target.value === '' ? undefined : Number(e.target.value);
                    bumpAll();
                    debouncedRecalc(dk, 300);
                  }}
                  onBlur={() => flushRecalc(dk)}
                  selectall=""
                />{' '}
                ~{' '}
                <SelectAllInput
                  type="number"
                  style={{ display: 'inline-block', width: '54px', margin: '0' }}
                  value={rule.value[1] ?? ''}
                  onChange={(e: any) => {
                    rule.value[1] = e.target.value === '' ? undefined : Number(e.target.value);
                    bumpAll();
                    debouncedRecalc(dk, 500);
                  }}
                  onBlur={() => flushRecalc(dk)}
                  selectall=""
                />
              </div>
            )}
            <div className="col-xs-2" style={{ textAlign: 'left', lineHeight: '26px' }}>
              {' '}
              mm
            </div>
          </div>
        );
      /* 快门时间 */
      case 'shutter':
        return (
          <div className="row">
            <div className="col-xs-2" style={{ textAlign: 'right', lineHeight: '26px' }}>
              1/
            </div>
            {rule.method != 'between' && (
              <div className="col-xs-10">
                <SelectAllInput
                  type="number"
                  value={rule.value[0] ?? ''}
                  onChange={(e: any) => {
                    rule.value[0] = e.target.value === '' ? undefined : Number(e.target.value);
                    bumpAll();
                    debouncedRecalc(dk, 300);
                  }}
                  onBlur={() => flushRecalc(dk)}
                  selectall=""
                />
              </div>
            )}
            {rule.method == 'between' && (
              <div className="col-xs-10">
                <SelectAllInput
                  type="number"
                  style={{ display: 'inline-block', width: '54px', margin: '0 0 0 6px' }}
                  value={rule.value[0] ?? ''}
                  onChange={(e: any) => {
                    rule.value[0] = e.target.value === '' ? undefined : Number(e.target.value);
                    bumpAll();
                    debouncedRecalc(dk, 300);
                  }}
                  onBlur={() => flushRecalc(dk)}
                  selectall=""
                />{' '}
                ~{' '}
                <SelectAllInput
                  type="number"
                  style={{ display: 'inline-block', width: '54px', margin: '0' }}
                  value={rule.value[1] ?? ''}
                  onChange={(e: any) => {
                    rule.value[1] = e.target.value === '' ? undefined : Number(e.target.value);
                    bumpAll();
                    debouncedRecalc(dk, 300);
                  }}
                  onBlur={() => flushRecalc(dk)}
                  selectall=""
                />
              </div>
            )}
          </div>
        );
      /* 日期專用 */
      case 'btime':
      case 'mtime':
      case 'createTime':
      case 'timestamp':
        return (
          <>
            {rule.method != 'between' && rule.method != 'within' && (
              <FlatpickrInput
                fpOpts={dateOptsRef.current.dateOpts1}
                fpOnSetup={(fpItem: any) => datePostSetup(fpItem, rule)}
              />
            )}
            {rule.method == 'between' && (
              <FlatpickrInput
                fpOpts={dateOptsRef.current.dateOpts2}
                fpOnSetup={(fpItem: any) => datePostSetup(fpItem, rule)}
              />
            )}
            {rule.method == 'within' && (
              <div className="row">
                <div className="col-xs-9">
                  <SelectAllInput
                    type="number"
                    value={rule.value[0] ?? ''}
                    onChange={(e: any) => {
                      rule.value[0] = e.target.value === '' ? undefined : Number(e.target.value);
                      bumpAll();
                      debouncedRecalc(dk, 300);
                    }}
                    onBlur={() => flushRecalc(dk)}
                    selectall=""
                  />
                </div>
                <div className="col-xs-3" style={{ lineHeight: '26px', paddingLeft: '10px' }}>
                  {t('modal.smartFolder.ruleValue.typeDays')}
                </div>
              </div>
            )}
          </>
        );
      /* 形狀專用 */
      case 'shape':
        return (
          <>
            <div className="select select-xs">
              <select
                tabIndex={-1}
                value={rule.value ?? ''}
                onChange={(e: any) => {
                  rule.value = e.target.value;
                  changeValue();
                }}
              >
                <option value="landscape">{t('modal.smartFolder.ruleValue.shapeLandscape')}</option>
                <option value="portrait">{t('modal.smartFolder.ruleValue.shapePortrait')}</option>
                <option value="square">{t('modal.smartFolder.ruleValue.shapeSquare')}</option>
                <option value="panoramic-landscape">{t('modal.smartFolder.ruleValue.shapePanoramicLandscape')}</option>
                <option value="panoramic-portrait">{t('modal.smartFolder.ruleValue.shapePanoramicPortrait')}</option>
                <option value="custom">{t('filter.orientation>custom')}</option>
              </select>
            </div>
            {rule.value === 'custom' && (
              <div className="custom-shapre-item row" style={{ padding: '8px 0 8px 4px', lineHeight: '26px' }}>
                <input
                  className="col-xs-4"
                  type="number"
                  placeholder="W"
                  value={rule.width ?? ''}
                  onChange={(e: any) => {
                    rule.width = e.target.value === '' ? undefined : Number(e.target.value);
                    changeValue();
                    bumpAll();
                  }}
                  style={{ textAlign: 'center', marginRight: '8px' }}
                />
                :
                <input
                  className="col-xs-4"
                  type="number"
                  placeholder="H"
                  value={rule.height ?? ''}
                  onChange={(e: any) => {
                    rule.height = e.target.value === '' ? undefined : Number(e.target.value);
                    changeValue();
                    bumpAll();
                  }}
                  style={{ textAlign: 'center', marginLeft: '8px' }}
                />
              </div>
            )}
          </>
        );
      /* 評分專用 */
      case 'rating':
        return (
          <div>
            {rule.method != 'contain' && (
              <div className="select select-xs">
                <select
                  tabIndex={-1}
                  value={rule.value ?? ''}
                  onChange={(e: any) => {
                    rule.value = e.target.value;
                    changeValue();
                  }}
                >
                  <option value="1">⭑</option>
                  <option value="2">⭑⭑</option>
                  <option value="3">⭑⭑⭑</option>
                  <option value="4">⭑⭑⭑⭑</option>
                  <option value="5">⭑⭑⭑⭑⭑</option>
                  <option value="none">None</option>
                </select>
              </div>
            )}
            {rule.method == 'contain' && (
              <SelectAllInput
                maxLength={256}
                type="text"
                value={rule.value ?? ''}
                onChange={(e: any) => {
                  rule.value = e.target.value;
                  bumpAll();
                  debouncedRecalc(dk, 300);
                }}
                onBlur={() => flushRecalc(dk)}
                selectall=""
              />
            )}
          </div>
        );
      /* 類型專用 */
      case 'type':
        return (
          <div className="select select-xs">
            <select
              tabIndex={-1}
              value={rule.value ?? ''}
              onChange={(e: any) => {
                rule.value = e.target.value;
                changeValue();
              }}
            >
              {filterTypes.map((type: any, ti: number) => (
                <option key={ti} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
        );
      case 'color':
        return (
          <div className="color-picker">
            <SelectAllInput
              style={ngShow(rule.method !== 'grayscale')}
              tabIndex={-1}
              type="text"
              placeholder="#FF0000"
              value={rule.value ?? ''}
              onChange={(e: any) => {
                rule.value = e.target.value;
                bumpAll();
              }}
              selectall=""
            />
            <input
              style={ngShow(rule.method !== 'grayscale')}
              tabIndex={-1}
              type="color"
              name="favcolor"
              value={rule.value ?? '#ff0000'}
              onChange={(e: any) => {
                rule.value = e.target.value;
                bumpAll();
                debouncedRecalc(`${dk}-color`, 200);
              }}
              onBlur={() => flushRecalc(`${dk}-color`)}
            />
          </div>
        );
      case 'tags':
        return (
          <div style={ngShow(!(rule.method === 'empty' || rule.method === 'not-empty'))}>
            <TagsInput
              theme={theme}
              tags={rule.value || []}
              onTagsReplace={(next: any[]) => {
                rule.value = next;
                bumpAll();
              }}
              onChange={() => changeValue()}
              style={{ marginLeft: '3px' }}
            />
          </div>
        );
      case 'folders':
        return (
          <div style={ngShow(!(rule.method === 'empty' || rule.method === 'not-empty'))}>
            <FoldersInput
              theme={theme}
              folderIds={rule.value || []}
              onFolderIdsReplace={(next: any[]) => {
                rule.value = next;
                bumpAll();
              }}
              onChange={() => changeValue()}
              style={{ marginLeft: '3px' }}
            />
          </div>
        );
      default:
        return null;
    }
  };

  // 方法下拉分组（模板 ng-switch-when 逐字）
  const methodGroup = (rule: any): React.ReactNode => {
    switch (rule.property) {
      /* 標題、網址、註釋專用 */
      case 'name':
      case 'folderName':
      case 'url':
      case 'annotation':
      case 'comments':
      case 'camera':
        return (
          <div className="select select-xs">
            <select
              tabIndex={-1}
              value={rule.method ?? ''}
              onChange={(e: any) => {
                rule.method = e.target.value;
                changeMethod(rule);
              }}
            >
              <option value="contain">{t('modal.smartFolder.method.contain')}</option>
              <option value="uncontain">{t('modal.smartFolder.method.unconatin')}</option>
              <option value="startWith">{t('modal.smartFolder.method.startWith')}</option>
              <option value="endWith">{t('modal.smartFolder.method.endWith')}</option>
              <option value="equal">{t('modal.smartFolder.method.equal')}</option>
              <option value="empty">{t('modal.smartFolder.method.empty')}</option>
              <option value="not-empty">{t('modal.smartFolder.method.notEmpty')}</option>
              <option value="regex">{t('modal.smartFolder.method.regex')}</option>
            </select>
          </div>
        );
      /* 寬、高、文件大小、視頻長度、BPM 專用 */
      case 'width':
      case 'height':
      case 'fileSize':
      case 'duration':
      case 'bpm':
      case 'iso':
      case 'aperture':
      case 'focalLength':
      case 'shutter':
        return (
          <div className="select select-xs">
            <select
              tabIndex={-1}
              value={rule.method ?? ''}
              onChange={(e: any) => {
                rule.method = e.target.value;
                changeMethod(rule);
              }}
            >
              <option value=">">{t('modal.smartFolder.method.>')}</option>
              <option value=">=">{t('modal.smartFolder.method.>=')}</option>
              <option value="=">{t('modal.smartFolder.method.=')}</option>
              <option value="<">{t('modal.smartFolder.method.<')}</option>
              <option value="<=">{t('modal.smartFolder.method.<=')}</option>
              <option value="between">{t('modal.smartFolder.method.Between')}</option>
            </select>
          </div>
        );
      /* 字体 */
      case 'fontActivated':
        return (
          <div className="select select-xs" style={{ width: '336px' }}>
            <select
              tabIndex={-1}
              value={rule.method ?? ''}
              onChange={(e: any) => {
                rule.method = e.target.value;
                changeMethod(rule);
              }}
            >
              <option value="activate">{t('modal.smartFolder.method.activate')}</option>
              <option value="deactivate">{t('modal.smartFolder.method.deactivate')}</option>
            </select>
          </div>
        );
      /* 日期專用 */
      case 'createTime':
      case 'mtime':
      case 'btime':
      case 'timestamp':
        return (
          <div className="select select-xs">
            <select
              tabIndex={-1}
              value={rule.method ?? ''}
              onChange={(e: any) => {
                rule.method = e.target.value;
                changeMethod(rule);
              }}
            >
              <option value="before">{t('modal.smartFolder.method.before')}</option>
              <option value="after">{t('modal.smartFolder.method.after')}</option>
              <option value="between">{t('modal.smartFolder.method.dateBetween')}</option>
              <option value="on">{t('modal.smartFolder.method.on')}</option>
              <option value="within">{t('modal.smartFolder.method.within')}</option>
            </select>
          </div>
        );
      /* 類型專用 */
      case 'type':
        return (
          <div className="select select-xs">
            <select
              tabIndex={-1}
              value={rule.method ?? ''}
              onChange={(e: any) => {
                rule.method = e.target.value;
                changeMethod(rule);
              }}
            >
              <option value="equal">{t('modal.smartFolder.method.is')}</option>
              <option value="unequal">{t('modal.smartFolder.method.not')}</option>
            </select>
          </div>
        );
      /* 形狀專用 */
      case 'shape':
        return (
          <div className="select select-xs">
            <select
              tabIndex={-1}
              value={rule.method ?? ''}
              onChange={(e: any) => {
                rule.method = e.target.value;
                changeMethod(rule);
              }}
            >
              <option value="equal">{t('modal.smartFolder.method.is')}</option>
              <option value="unequal">{t('modal.smartFolder.method.not')}</option>
            </select>
          </div>
        );
      /* 評分專用 */
      case 'rating':
        return (
          <div className="select select-xs">
            <select
              tabIndex={-1}
              value={rule.method ?? ''}
              onChange={(e: any) => {
                rule.method = e.target.value;
                changeMethod(rule);
              }}
            >
              <option value="equal">{t('modal.smartFolder.method.is')}</option>
              <option value="unequal">{t('modal.smartFolder.method.not')}</option>
              <option value="contain">{t('modal.smartFolder.method.contain')}</option>
            </select>
          </div>
        );
      /* 顏色專用 */
      case 'color':
        return (
          <div className="select select-xs">
            <select
              tabIndex={-1}
              value={rule.method ?? ''}
              onChange={(e: any) => {
                rule.method = e.target.value;
                changeMethod(rule);
              }}
            >
              <option value="similar">{t('modal.smartFolder.method.similar')}</option>
              <option value="accuracy">{t('modal.smartFolder.method.accuracy')}</option>
              <option value="grayscale">{t('modal.smartFolder.method.grayscale')}</option>
            </select>
          </div>
        );
      /* 標籤、資料夾專用 */
      case 'tags':
      case 'folders':
        return (
          <div className="select select-xs">
            <select
              tabIndex={-1}
              value={rule.method ?? ''}
              onChange={(e: any) => {
                rule.method = e.target.value;
                changeMethod(rule);
              }}
            >
              <option value="union">{t('modal.smartFolder.method.union')}</option>
              <option value="intersection">{t('modal.smartFolder.method.intersection')}</option>
              <option value="equal">{t('modal.smartFolder.method.equal')}</option>
              <option value="identity">{t('modal.smartFolder.method.identity')}</option>
              <option value="empty">{t('modal.smartFolder.method.empty')}</option>
              <option value="not-empty">{t('modal.smartFolder.method.notEmpty')}</option>
            </select>
          </div>
        );
      default:
        return null;
    }
  };

  return createPortal(
    <>
      {isOpen && (
        <div className="modal smart-folder-modal open">
          <div className="modal-header">
            {isEditModeRef.current && <div className="name">{t('context.smartFolder.editRules')}</div>}
            {!isEditModeRef.current && <div className="name">{t('appmenu.file>createSmartFolder')}</div>}
            <div className="close" onClick={() => cancel()} />
          </div>
          <div className="section">
            <label htmlFor="">{t('modal.smartFolder.name')}</label>
            <input
              id="smart-folder-name-input"
              maxLength={1024}
              type="text"
              placeholder=""
              value={folderName ?? ''}
              ref={nameInputRef}
              onChange={(e: any) => setFolderName(e.target.value)}
              onKeyDown={nameKeydown}
              tabIndex={-1}
              className={isNoFolderName ? 'input-negative' : ''}
              selectall=""
            />
            <p className="tips" dangerouslySetInnerHTML={{ __html: t('hint.whatIsSmartFolder') }} />
          </div>
          <div className="section rules-section" style={{ overflow: 'auto', display: isOpen ? undefined : 'none' }}>
            {conditionsRef.current.length === 0 && (
              <div className="btn" onClick={() => createCondition(Number.NaN)}>
                <img src={`assets/images/${themePathOf(theme)}/icons/ic-condition-add.svg`} />
              </div>
            )}
            {conditionsRef.current.map((condition: any, ci: number) => (
              <div className="condition" key={ci}>
                <div className="set">
                  {ci === 0 && <span>{t('modal.smartFolder.match')}</span>}
                  {ci !== 0 && <span>{t('modal.smartFolder.matchAnd')}</span>}
                  <div className="select select-xs">
                    <select
                      tabIndex={-1}
                      value={condition.match ?? ''}
                      onChange={(e: any) => {
                        condition.match = e.target.value;
                        recalculateResult();
                      }}
                    >
                      <option value="AND">{t('modal.smartFolder.conditionAll')}</option>
                      <option value="OR">{t('modal.smartFolder.conditionAny')}</option>
                    </select>
                  </div>
                  <span>{t('modal.smartFolder.match2')}</span>
                  <div className="select select-xs">
                    <select
                      tabIndex={-1}
                      value={condition.boolean ?? ''}
                      onChange={(e: any) => {
                        condition.boolean = e.target.value;
                        recalculateResult();
                      }}
                    >
                      <option value="TRUE">{t('modal.smartFolder.true')}</option>
                      <option value="FALSE">{t('modal.smartFolder.false')}</option>
                    </select>
                  </div>
                  <div style={{ float: 'right', paddingRight: '7px' }}>
                    <div className="btn" onClick={() => removeCondition(condition)}>
                      <img src={`assets/images/${themePathOf(theme)}/icons/ic-condition-remove.svg`} />
                    </div>
                    <div className="btn" onClick={() => createCondition(ci + 1)}>
                      <img src={`assets/images/${themePathOf(theme)}/icons/ic-condition-add.svg`} />
                    </div>
                  </div>
                </div>
                {condition.rules.map((rule: any, ri: number) => (
                  <div className="rules" key={ri}>
                    <div className="row top-md rule">
                      <div className="col-xs-3">
                        <div className="select select-xs">
                          <select
                            tabIndex={-1}
                            value={rule.property ?? ''}
                            onChange={(e: any) => {
                              rule.property = e.target.value;
                              changeProperty(rule);
                            }}
                          >
                            <option value="name">{t('modal.smartFolder.rule.propertyName')}</option>
                            <option value="type">{t('modal.smartFolder.rule.propertyType')}</option>
                            <option value="tags">{t('modal.smartFolder.rule.propertyTags')}</option>
                            <option value="folders">{t('modal.smartFolder.rule.propertyFolders')}</option>
                            <option value="folderName">{t('modal.smartFolder.rule.propertyFolderName')}</option>
                            <option value="color">{t('modal.smartFolder.rule.propertyColor')}</option>
                            <option value="createTime">{t('modal.smartFolder.rule.propertyCreateTime')}</option>
                            <option value="mtime">{t('modal.smartFolder.rule.propertyMTime')}</option>
                            <option value="btime">{t('modal.smartFolder.rule.propertyBTime')}</option>
                            <option value="url">{t('modal.smartFolder.rule.propertyUrl')}</option>
                            <option value="annotation">{t('modal.smartFolder.rule.propertyAnnotation')}</option>
                            <option value="width">{t('modal.smartFolder.rule.propertyWidth')}</option>
                            <option value="height">{t('modal.smartFolder.rule.propertyHeight')}</option>
                            <option value="fileSize">{t('modal.smartFolder.rule.propertySize')}</option>
                            <option value="shape">{t('modal.smartFolder.rule.propertyShape')}</option>
                            <option value="rating">{t('modal.smartFolder.rule.propertyRating')}</option>
                            <option value="comments">{t('modal.smartFolder.rule.propertyComments')}</option>
                            <option value="duration">{t('modal.smartFolder.rule.duration')}</option>
                            <option
                              value="fontActivated"
                              style={ngShow(!!filterExtensions['font'])}
                            >
                              {t('modal.smartFolder.rule.fontActivated')}
                            </option>
                            <option
                              value="camera"
                              style={ngShow(!!(filterExtensions['raw'] || (rule.property as any)?.property === 'camera'))}
                            >
                              {t('modal.smartFolder.rule.camera')}
                            </option>
                            <option
                              value="iso"
                              style={ngShow(!!(filterExtensions['raw'] || (rule.property as any)?.property === 'iso'))}
                            >
                              {t('modal.smartFolder.rule.iso')}
                            </option>
                            <option
                              value="aperture"
                              style={ngShow(!!(filterExtensions['raw'] || (rule.property as any)?.property === 'aperture'))}
                            >
                              {t('modal.smartFolder.rule.aperture')}
                            </option>
                            <option
                              value="focalLength"
                              style={ngShow(!!(filterExtensions['raw'] || (rule.property as any)?.property === 'focalLength'))}
                            >
                              {t('modal.smartFolder.rule.focalLength')}
                            </option>
                            <option
                              value="shutter"
                              style={ngShow(!!(filterExtensions['raw'] || (rule.property as any)?.property === 'shutter'))}
                            >
                              {t('modal.smartFolder.rule.shutter')}
                            </option>
                            <option
                              value="timestamp"
                              style={ngShow(!!(filterExtensions['raw'] || (rule.property as any)?.property === 'timestamp'))}
                            >
                              {t('modal.smartFolder.rule.timestamp')}
                            </option>
                            <option value="bpm" style={ngShow(!!filterExtensions['audio'])}>
                              BPM
                            </option>
                          </select>
                        </div>
                      </div>
                      <div className="col-xs-3">{methodGroup(rule)}</div>
                      <div className="col-xs-6">
                        <div className="rule-value">{renderRuleValue(rule, ci, ri)}</div>
                        <div
                          className={`btn${condition.rules.length <= 1 ? ' disabled' : ''}`}
                          onClick={() => removeRule(condition, rule)}
                        >
                          <img src={`assets/images/${themePathOf(theme)}/icons/ic-condition-remove.svg`} />
                        </div>
                        <div
                          className={`btn${condition.rules.length >= 30 ? ' disabled' : ''}`}
                          onClick={() => createRule(condition, ri + 1)}
                        >
                          <img src={`assets/images/${themePathOf(theme)}/icons/ic-condition-add.svg`} />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div className="section textAlign-right darken" style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <div className="preview" style={{ marginRight: 'auto' }}>
              {t('modal.smartFolder.hitMsg.found')}
              {totalCount}
              {t('modal.smartFolder.hitMsg.result')}
            </div>
            {isEditModeRef.current && (
              <div className="button button-xs button-primary" onClick={() => save()}>
                {t('modal.smartFolder.buttons.saveChanges')}
              </div>
            )}
            {!isEditModeRef.current && (
              <div className="button button-xs button-primary" onClick={() => save()}>
                {t('modal.smartFolder.buttons.create')}
              </div>
            )}
            <div className="button button-xs button-grey" onClick={() => cancel()}>
              {t('general.cancel')}
            </div>
          </div>
        </div>
      )}
      <div className="modal-overlay" />
    </>,
    host
  );
}