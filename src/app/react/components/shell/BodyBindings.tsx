import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useBodyState } from '../../store/bodyState';
import { useListState } from '../../store/listState';
import { useSidebarState } from '../../store/sidebarState';
import { useAppState } from '../../store/appState';
// b1-9bz-B：callScope 字符串派发退役——改为落点导出直 import（表项本就是同对象指针）
import { contentFocus, dblclickContentPanel } from '../../core/miscDomain';
import { openApplicationContextMenu } from '../../services/miscMenuService';
import { syncPanelFromScope } from '../../store/panelState';
import { runInBodyScope } from '../../core/appCore';
import { onSidebarResize } from '../../services/sidebarService';
import { makeResizable } from '../interactions/resizable';

/**
 * 11-pre a8：body 绑定层 React 等价（C 模式直写静态壳节点）。
 *
 * - body className（class 插值 + ng-class 28 项逐一对应）/ theme/platform/vibrancy attrs；
 * - link#app-style ng-href（css/style_{theme}.css）；
 * - #main-app 'ui-ready'（ng-class：!isUILoaded || isLoading）；
 * - #list-content-panel（ng-class hide/filter-open/small-list/expand-right + style
 *   left/right = containerSize.sidebar+1 / inspector.width+1）；
 * - #box-container（ng-show viewMode!='alltags' → display；ng-class empty/pixelated）。
 * 订阅 store 快照，差异字段才写 DOM（避免每 digest 全量重写）。
 */

function setText(el: HTMLElement | null, value: string): void {
  if (el && el.className !== value) el.className = value;
}

function setStyle(el: HTMLElement | null, key: 'display' | 'left' | 'right', value: string): void {
  if (el && el.style[key] !== value) el.style[key] = value;
}

export function BodyBindings() {
  const s = useBodyState();
  const isUILoaded = useSidebarState((st) => st.snapshot.isUILoaded);
  const isLoading = s.isLoading;

  useEffect(() => {
    const body = document.body;
    if (!body) return;

    // class 插值（class="{{::platform}} {{language}} current-focus-{{currentFocus}} {{viewMode}}-view"）
    // b1-9az：viewMode 已源翻转（裸值，openFolder 会写 undefined）——展示级默认在此收敛
    const base = [s.platform, s.language, `current-focus-${s.currentFocus}`, `${s.viewMode || 'all'}-view`]
      .filter(Boolean).join(' ');
    // ng-class 28 项（index.html 38-68 逐字）
    const map: Record<string, boolean> = {
      'layout-fill': s.layoutOptions === 'Fill',
      'is-windows-11': s.isWin11,
      'is-detail-mode': s.isDetailMode,
      'is-inline-mode': s.isInlineMode,
      'is-comment-mode': s.isCommentMode,
      'is-grayscale-mode': s.isGrayscaleMode,
      'hide-navigator': s.isHideNavigator || !s.smoothZoomDone,
      'is-small-box': s.imageHeight < 150,
      'is-middle-box': s.imageHeight <= 250 && s.imageHeight >= 150,
      'is-square-layout': s.layout === 'SquareLayout',
      'show-list-resolution': s.listPropResolution,
      'show-list-dateImported': s.listPropDateImported,
      'show-list-tags': s.listPropTags,
      'show-list-rating': s.listPropRating,
      'show-list-extension': s.listPropExtension,
      'show-list-fileSize': s.listPropFileSize,
      'box-sortable': s.boxSortable,
      'cropping': s.isCropMode,
      'is-maximize': s.isMaximize,
      'hide-sidebar': s.isHideSidebar,
      'hide-inspector': s.isHideInspector,
      'hide-all': s.isHideInspector && s.isHideSidebar,
      'is-filter-open': s.filterOpen,
      'slideshow': s.isSlideshowMode,
      'hide-badge': s.hideBadge,
      'hide-zoom-btn': s.hideZoomBtn,
      'show-transparent-grid': s.showTransparentGrid,
    };
    const extra = Object.keys(map).filter((k) => map[k]).join(' ');
    setText(body, `${base} ${extra}`.trim());

    // theme/platform/vibrancy attrs
    if (body.getAttribute('theme') !== s.theme) body.setAttribute('theme', s.theme);
    if (s.platform && body.getAttribute('platform') !== s.platform) body.setAttribute('platform', s.platform);
    const vibrancy = s.vibrancyEnabled ? 'true' : 'false';
    if (body.getAttribute('vibrancy') !== vibrancy) body.setAttribute('vibrancy', vibrancy);

    // link#app-style ng-href
    const appStyle = document.getElementById('app-style') as HTMLLinkElement | null;
    const href = `css/style_${s.theme}.css`;
    if (appStyle && !appStyle.href.endsWith(href)) appStyle.href = href;

    // #main-app ng-class ui-ready（!isUILoaded || isLoading）
    setText(document.getElementById('main-app'), !isUILoaded || isLoading ? 'ui-ready' : '');

    // #list-content-panel ng-class + style
    const panel = document.getElementById('list-content-panel');
    if (panel) {
      setText(panel, [
        'content-panel',
        s.viewMode === 'community' ? 'hide' : '',
        s.filterOpen ? 'filter-open' : '',
        s.imageHeight <= 100 ? 'small-list' : '',
        s.viewMode === 'alltags' ? 'expand-right' : '',
      ].filter(Boolean).join(' '));
      setStyle(panel, 'left', `${s.sidebarWidth + 1}px`);
      setStyle(panel, 'right', `${s.inspectorWidth + 1}px`);
    }
  }, [s, isUILoaded, isLoading]);

  return null;
}

/** #box-container ng-show/ng-class（directives 保持 Angular 编译，仅接管属性绑定）。 */
export function BoxContainerBindings() {
  const viewMode = useBodyState((st) => st.viewMode);
  const l = useListState();
  const renderBehavior = useAppState((st) => (st.preferences?.habits as any)?.renderBehavior);

  useEffect(() => {
    const box = document.getElementById('box-container');
    if (!box) return;
    setStyle(box, 'display', viewMode !== 'alltags' ? '' : 'none');
    const empty = !l.isLoading && l.filteredsCount <= 0;
    const pixelated = renderBehavior == 'pixelated';
    let changed = false;
    [['empty', empty], ['pixelated', pixelated]].forEach(([cls, on]) => {
      const name = cls as string;
      const has = box.classList.contains(name);
      if (on && !has) { box.classList.add(name); changed = true; }
      if (!on && has) { box.classList.remove(name); changed = true; }
    });
    void changed;
  }, [viewMode, l.isLoading, l.filteredsCount, renderBehavior]);

  return null;
}

/** body 级 application-menu-btn（index.html 70-72 逐字；ng-show isLoading）。 */
export function AppMenuButton() {
  const isLoading = useBodyState((st) => st.isLoading);
  const theme = useBodyState((st) => st.theme);
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setHost(document.getElementById('eagle-app-menu-host'));
  }, []);
  if (!host || !isLoading) return null;
  return createPortal(
    <div className="icon-btn application-menu-btn fixed" style={{ position: 'absolute', left: 12, top: 12 }} onClick={(e) => runInBodyScope(() => openApplicationContextMenu(e))}>
      <img src={`assets/images/${theme === 'light' || theme === 'lightgray' ? 'light' : 'dark'}/icons/ic-app-menu.svg`} />
    </div>,
    host
  );
}

/**
 * hover-show-sidebar（ng-hover-intent → hoverShowSidebar）。原实现依赖 jQuery hoverIntent 插件，
 * 该插件从未进入 vendors（`$.fn.hoverIntent` 长期为 undefined），guard 使接线始终短路 —— 无效果面。
 * D-2j：去 jQuery 引用后保留同语义空实现，不引入新行为。
 */
export function HoverShowSidebar() {
  return null;
}

/**
 * #sidebar 拖宽（bundle 70423 resizable 指令 + 21138 onSidebarResize；b1-9x）。
 * 原 index.html:34 的 `resizable="e" on-resize=…` 为 Angular 指令面（b1 后死属性，
 * 已摘除）；本组件以 jQuery-UI resizable C 模式接线：handles 'e' / minWidth 200 /
 * maxWidth 600，resize → onSidebarResize（≥200 门 + containerSize.sidebar 写回 +
 * $$rebind::refreshContainSize 广播 + 500ms 去抖 relayout/offsetScrollbar/localStorage）。
 */
export function SidebarResizable() {
  useEffect(() => {
    const el = document.getElementById('sidebar');
    if (!el) return;
    // D-2f：jQuery-UI → 自研 makeResizable（原 `$.fn.resizable` 缺失即静默降级的守卫一并移除）
    const r = makeResizable(el, {
      maxWidth: 600,
      minWidth: 200,
      handles: 'e',
      resize: function (event: any, ui: any) {
        runInBodyScope((s: any) => {
          onSidebarResize(event, ui);
        });
      },
    });
    return () => {
      r.destroy();
    };
  }, []);
  return null;
}

/** 详情模式包裹层（index.html 313-322 逐字；ng-show → display，元素身份不重建）。 */
export function DetailWrapper() {
  const s = useBodyState();
  const [host, setHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setHost(document.getElementById('eagle-detail-wrapper-host'));
  }, []);

  useEffect(() => {
    const wrapper = document.getElementById('eagle-detail-wrapper');
    if (!wrapper) return;
    setStyle(wrapper, 'display', s.isDetailMode ? '' : 'none');
    setStyle(wrapper, 'left', `${s.sidebarWidth + 1}px`);
    setStyle(wrapper, 'right', `${s.inspectorWidth + 1}px`);
  }, [s.isDetailMode, s.sidebarWidth, s.inspectorWidth]);

  if (!host) return null;
  return createPortal(
    <div
      id="eagle-detail-wrapper"
      className="content-panel detail-mode"
      style={{ display: 'none' }}
      onDoubleClick={(e) => runInBodyScope(() => dblclickContentPanel(e))}
      onMouseDown={(e) => runInBodyScope(() => contentFocus(e))}
    >
      {/* 詳情模式工具列/懸浮層（React portal 內容為 Fragment） */}
      <div id="eagle-detail-host" />
      {/* 詳情查看器：#detail-container 壳保留（smoothZoom 包裹，元素身份不可重建） */}
      <div id="detail-container" className="detail-container" />
      {/* 裁切尺寸提示（React portal） */}
      <div id="eagle-detail-cropsize-host" />
    </div>,
    host
  );
}
