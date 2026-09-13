import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { contextMenuOpenChannel, contextMenuCloseChannel } from '../../global/bus';
import { t } from '../../global/eagleGlobals';
import { shortcuts } from '../../app/filters';
import { useToolbarState } from '../../store/toolbarState';
import { max } from '../../utils/lang';
import { q, widthOf, heightOf, outerWidthOf, offsetOf } from '../../utils/domQuery';
import { makeSortable } from '../interactions/sortable';

/**
 * 阶段7a：contextMenu 模块接管。
 *
 * 规范 = bundle 15847-16582（contextMenu/contextMenuItems/contextMenuEmojiItems/
 * autoPositionContextMenu/onErrorSrc 指令）+ js/modules/context-menu/*.html 模板逐字转写。
 * 开合通道不变：ContextMenu.open/close 广播 CONTEXTMENU.OPEN / CONTEXTMENU.CLOSE。
 */

const themePathOf = (theme: string) => (theme === 'light' || theme === 'lightgray' ? 'light' : 'dark');
const iconSrc = (theme: string, icon: string) => `assets/images/${themePathOf(theme)}/icons/context-menu/${icon}`;

/** fuzzyMatch filter（bundle:19951）：fuzzy_match(text=label, search=keyword）。 */
export function fuzzyMatchHtml(label: any, searchKeyword: string): string {
  const text = label == null ? '' : String(label);
  if (!searchKeyword) return text;
  const fn = (window as any).fuzzy_match;
  if (!fn) return text;
  return fn(text, searchKeyword) || text;
}

/* ---------------- emoji/icon 组（contextMenuEmojiItems 16396-16582 逐字） ---------------- */

const EMOJI_GROUPS: Array<Array<{ type: string; icon?: string }>> = [
  [
    { type: 'icon' },
    { type: 'icon', icon: 'library' },
    { type: 'icon', icon: 'box' },
    { type: 'icon', icon: 'grid' },
    { type: 'icon', icon: 'layer' },
    { type: 'icon', icon: 'briefcase' },
    { type: 'icon', icon: 'photo' },
    { type: 'icon', icon: 'photos' },
    { type: 'icon', icon: 'video' },
    { type: 'icon', icon: 'film' },
    { type: 'icon', icon: 'film2' },
    { type: 'icon', icon: 'film3' },
    { type: 'icon', icon: 'music' },
    { type: 'icon', icon: 'book' },
    { type: 'icon', icon: 'book2' },
    { type: 'icon', icon: 'bookshelf' },
    { type: 'icon', icon: 'keynote' },
    { type: 'icon', icon: 'camera' },
    { type: 'icon', icon: 'aperture' },
    { type: 'icon', icon: 'attachment' },
    { type: 'icon', icon: 'scissors' },
    { type: 'icon', icon: 'palette' },
    { type: 'icon', icon: 'wrench' },
    { type: 'icon', icon: 'helmet' },
    { type: 'icon', icon: 'life-buoy' },
    { type: 'icon', icon: 'graph' },
    { type: 'icon', icon: 'graph2' },
    { type: 'icon', icon: 'tableware' },
    { type: 'icon', icon: 'cog' },
    { type: 'icon', icon: 'bachelor-cap' },
    { type: 'icon', icon: 'cones' },
    { type: 'icon', icon: 'dribbble' },
    { type: 'icon', icon: 'email' },
    { type: 'icon', icon: 'business-card' },
    { type: 'icon', icon: 'coffee' },
    { type: 'icon', icon: 'cart' },
    { type: 'icon', icon: 'lightbulb' },
    { type: 'icon', icon: 'inspiration' },
    { type: 'icon', icon: 'thumb-up' },
    { type: 'icon', icon: 'thumb-down' },
    { type: 'icon', icon: 'like' },
    { type: 'icon', icon: 'unlike' },
    { type: 'icon', icon: 'star' },
    { type: 'icon', icon: 'hot' },
    { type: 'icon', icon: 'upload' },
    { type: 'icon', icon: 'download' },
    { type: 'icon', icon: 'paid' },
    { type: 'icon', icon: 'free' },
    { type: 'icon', icon: 'medical' },
    { type: 'icon', icon: 'shield' },
    { type: 'icon', icon: 'search' },
    { type: 'icon', icon: 'shortcuts' },
    { type: 'icon', icon: 'recycle' },
    { type: 'icon', icon: 'excalmation' },
    { type: 'icon', icon: 'question' },
    { type: 'icon', icon: 'coin1' },
    { type: 'icon', icon: 'coin2' },
    { type: 'icon', icon: 'coin3' },
    { type: 'icon', icon: 'coin4' },
    { type: 'icon', icon: 'wallet' },
    { type: 'icon', icon: 'watch' },
    { type: 'icon', icon: 'clock' },
    { type: 'icon', icon: 'calendar-week' },
    { type: 'icon', icon: 'calendar-month' },
  ],
  [
    { type: 'icon', icon: 'website' },
    { type: 'icon', icon: 'phone' },
    { type: 'icon', icon: 'tablet' },
    { type: 'icon', icon: 'desktop' },
    { type: 'icon', icon: 'tv' },
    { type: 'icon', icon: 'cpu' },
    { type: 'icon', icon: 'safari' },
    { type: 'icon', icon: 'chrome' },
    { type: 'icon', icon: 'pie' },
    { type: 'icon', icon: 'bar-chart' },
    { type: 'icon', icon: 'line-chart' },
    { type: 'icon', icon: '2d' },
    { type: 'icon', icon: '3d' },
    { type: 'icon', icon: 'contrast' },
    { type: 'icon', icon: 'texture' },
    { type: 'icon', icon: 'transition' },
    { type: 'icon', icon: 'animation' },
    { type: 'icon', icon: 'spectrogram' },
    { type: 'icon', icon: 'font-sans' },
    { type: 'icon', icon: 'font-sans-serif' },
    { type: 'icon', icon: 'font-handwritten' },
    { type: 'icon', icon: 'flag' },
    { type: 'icon', icon: 'earth' },
    { type: 'icon', icon: 'pin' },
    { type: 'icon', icon: 'pin-check' },
    { type: 'icon', icon: 'map' },
    { type: 'icon', icon: 'road' },
    { type: 'icon', icon: 'motor' },
    { type: 'icon', icon: 'rocket' },
    { type: 'icon', icon: 'airplan' },
    { type: 'icon', icon: 'ship' },
    { type: 'icon', icon: 'train' },
    { type: 'icon', icon: 'car' },
    { type: 'icon', icon: 'truck' },
    { type: 'icon', icon: 'water-drop' },
    { type: 'icon', icon: 'sun' },
    { type: 'icon', icon: 'moon' },
    { type: 'icon', icon: 'cloud' },
    { type: 'icon', icon: 'flower' },
    { type: 'icon', icon: 'leaf' },
    { type: 'icon', icon: 'tree' },
    { type: 'icon', icon: 'mountain' },
    { type: 'icon', icon: 'smile' },
    { type: 'icon', icon: 'laugh' },
    { type: 'icon', icon: 'sad' },
    { type: 'icon', icon: 'meh' },
    { type: 'icon', icon: 'frown' },
    { type: 'icon', icon: 'die' },
    { type: 'icon', icon: 'baby' },
    { type: 'icon', icon: 'kid' },
    { type: 'icon', icon: 'angel' },
    { type: 'icon', icon: 'demon' },
    { type: 'icon', icon: 'hand' },
    { type: 'icon', icon: 'brain' },
  ],
  [
    { type: 'icon', icon: 'number0' },
    { type: 'icon', icon: 'number1' },
    { type: 'icon', icon: 'number2' },
    { type: 'icon', icon: 'number3' },
    { type: 'icon', icon: 'number4' },
    { type: 'icon', icon: 'number5' },
    { type: 'icon', icon: 'number6' },
    { type: 'icon', icon: 'number7' },
    { type: 'icon', icon: 'number8' },
    { type: 'icon', icon: 'number9' },
    { type: 'icon', icon: 'number10' },
    { type: 'icon', icon: 'number11' },
    { type: 'icon', icon: 'number12' },
    { type: 'icon', icon: 'number13' },
    { type: 'icon', icon: 'number14' },
    { type: 'icon', icon: 'number15' },
    { type: 'icon', icon: 'number16' },
    { type: 'icon', icon: 'number17' },
    { type: 'icon', icon: 'number18' },
    { type: 'icon', icon: 'number19' },
    { type: 'icon', icon: 'number20' },
  ],
];

function EmojiItems({ item, theme }: { item: any; theme: string }) {
  void theme;
  return (
    <div className="context-menu-emoji-list">
      {EMOJI_GROUPS.map((emojiGroup, gi) => (
        <div className="emoji-group" key={gi}>
          {emojiGroup.map((emoji, i) => (
            <div className="emoji" key={i} onClick={() => item?.click?.(emoji.icon)}>
              <div
                className="fake-svg icon"
                style={{ WebkitMaskImage: `url(assets/images/base/mask-icons/ic_${emoji.icon || 'folder-close'}.png) !important` } as React.CSSProperties}
              />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/* ---------------- onErrorSrc 指令（15869-15879） ---------------- */

function MenuImage({ src, fallback }: { src: string; fallback?: string }) {
  return (
    <img
      src={src}
      onError={(e) => {
        if (fallback) (e.target as HTMLImageElement).setAttribute('src', fallback);
      }}
    />
  );
}

/* ---------------- 菜单项（context-menu-items.html 逐字，含递归子菜单） ---------------- */

interface MenuCtx {
  openItem: (item: any) => void;
  toggleItem: (item: any) => void;
  openMore: (item: any) => void;
  hoverItem: (index: number, menu: any) => void;
  isItemSelectable: (item: any) => boolean;
  getActive: () => any;
  tick: number;
  theme: string;
}

function MenuItems({
  menu,
  searchKeyword,
  theme,
  ctx,
  stateRef,
}: {
  menu: any;
  searchKeyword: string;
  theme: string;
  ctx: MenuCtx;
  stateRef: React.MutableRefObject<any>;
}) {
  const itemsRef = useRef<HTMLDivElement>(null);
  const active = ctx.getActive();

  // ui-sortable（menu.sortable 分支；options = link 的 sortableOptions）
  useEffect(() => {
    const el = itemsRef.current;
    if (!el || !menu?.sortable) return;
    const opts = stateRef.current.sortableOptions || {};
    // D-2f：jQuery-UI sortable → 自研
    const sortable = makeSortable(el, {
      distance: opts.distance ?? 10,
      animation: opts.animation ?? 200,
      handle: opts.handle,
      disabled: !!opts.disabled,
      helper: 'clone',
      update: () => {
        setTimeout(() => {
          const onSorted = stateRef.current.onSorted;
          onSorted && onSorted(menu.items);
        }, 1);
      },
    });
    return () => {
      sortable.destroy();
    };
  }, [menu?.sortable, menu?.items?.length, ctx.tick]);

  if (!menu) return null;

  const renderItem = (item: any, index: number, branch: 'sortable' | 'plain') => {
    const role = item.role;
    if (role === 'separator') {
      return <div className="context-menu-separator" key={index} />;
    }
    if (branch === 'plain' && role === 'label') {
      return <div className="context-menu-label-item" key={index}>{item.label}</div>;
    }
    if (branch === 'plain' && role === 'color') {
      return (
        <div className="context-menu-color-item" key={index} onMouseEnter={() => ctx.hoverItem(index, menu)}>
          <div className="circle" onClick={() => item.click()} />
          <div className="circle red" onClick={() => item.click('red')} />
          <div className="circle orange" onClick={() => item.click('orange')} />
          <div className="circle yellow" onClick={() => item.click('yellow')} />
          <div className="circle green" onClick={() => item.click('green')} />
          <div className="circle aqua" onClick={() => item.click('aqua')} />
          <div className="circle blue" onClick={() => item.click('blue')} />
          <div className="circle purple" onClick={() => item.click('purple')} />
          <div className="circle pink" onClick={() => item.click('pink')} />
        </div>
      );
    }
    if (branch === 'plain' && role === 'emoji') {
      return (
        <div className="context-menu-emoji-item" key={index} onMouseEnter={() => ctx.hoverItem(index, menu)}>
          <EmojiItems item={item} theme={theme} />
        </div>
      );
    }
    if (role === 'toggle') {
      return (
        <div
          className={`context-menu-item${item.disabled ? ' disabled' : ''}${
            index === menu.currentIndex && !item.disabled ? ' active' : ''
          }${item.submenu ? ' has-submenu' : ''}${item.checked ? ' checked' : ''}${item.checked === false ? ' unchecked' : ''}`}
          key={index}
          onClick={() => ctx.openItem(item)}
          onMouseEnter={() => ctx.hoverItem(index, menu)}
        >
          {branch === 'sortable' && menu.sortableHelper ? (
            <div className="drag-helper" onClick={(e) => e.stopPropagation()}>
              <img src={`assets/images/${themePathOf(theme)}/icons/ic-drag-help.svg`} />
            </div>
          ) : branch === 'plain' ? (
            <div className="drag-helper" onClick={(e) => e.stopPropagation()}>
              <img src={`assets/images/${themePathOf(theme)}/icons/ic-drag-help.svg`} />
            </div>
          ) : null}
          {item.icon && <div className="icon"><img src={iconSrc(theme, item.icon)} /></div>}
          {item.image && (
            <div className="image">
              <MenuImage src={item.image} fallback={item.fallbackImage} />
            </div>
          )}
          <div className="label" dangerouslySetInnerHTML={{ __html: fuzzyMatchHtml(item.label, searchKeyword) }} />
          <div className="right">
            <div
              className="toggle-btn"
              style={{ width: 20, height: 20, ...(item.pinned ? undefined : { display: 'none' }) }}
              onClick={(e) => {
                e.stopPropagation();
                ctx.toggleItem(item);
              }}
            >
              <img src={iconSrc(theme, 'ic-filter-pinned.svg')} />
            </div>
            <div
              className="toggle-btn"
              style={{ width: 20, height: 20, ...(item.pinned ? { display: 'none' } : undefined) }}
              onClick={(e) => {
                e.stopPropagation();
                ctx.toggleItem(item);
              }}
            >
              <img src={iconSrc(theme, 'ic-filter-pin.svg')} />
            </div>
          </div>
        </div>
      );
    }
    // 一般状态（ng-switch-default）
    return (
      <div
        className={`context-menu-item${item.disabled ? ' disabled' : ''}${
          index === menu.currentIndex && !item.disabled ? ' active' : ''
        }${item.submenu || item.more ? ' has-submenu' : ''}${item.checked ? ' checked' : ''}${item.checked === false ? ' unchecked' : ''}`}
        key={index}
        onClick={() => ctx.openItem(item)}
        onMouseEnter={() => ctx.hoverItem(index, menu)}
        onContextMenu={branch === 'sortable' ? () => ctx.openMore(item) : undefined}
      >
        {branch === 'sortable' && menu.sortableHelper ? (
          <div className="drag-helper" onClick={(e) => e.stopPropagation()}>
            <img src={`assets/images/${themePathOf(theme)}/icons/ic-drag-help.svg`} />
          </div>
        ) : null}
        {item.icon && <div className="icon"><img src={iconSrc(theme, item.icon)} /></div>}
        {item.image && (
          <div className="image">
            <MenuImage src={item.image} fallback={item.fallbackImage} />
          </div>
        )}
        <div className="label" dangerouslySetInnerHTML={{ __html: fuzzyMatchHtml(item.label, searchKeyword) }} />
        {!item.more && (
          <div className="right">
            <div className="accelerator">{shortcuts(item.accelerator || '')}</div>
            <div className="actions">
              <div className="icon-checkbox">
                <img src={iconSrc(theme, 'ic-context-menu-checkbox.svg')} />
              </div>
              <div className="icon-arrow-right">
                <img src={iconSrc(theme, 'ic-context-menu-arrow-right.svg')} />
              </div>
            </div>
          </div>
        )}
        {item.more && (
          <div className="right">
            <div className="accelerator">{shortcuts(item.accelerator || '')}</div>
            <div className="actions">
              <div className="ic-btn icon-more" onClick={(e) => { e.stopPropagation(); ctx.openMore(item); }}>
                <img src={iconSrc(theme, 'ic-context-menu-more.svg')} />
              </div>
            </div>
          </div>
        )}
        {item.submenu && active === item.submenu && <div id="submenu-placeholder" />}
      </div>
    );
  };

  return (
    <>
      {menu.sortable && menu.items?.length ? (
        <div className="context-menu-items">
          <div ref={itemsRef}>
            {menu.items.map((item: any, index: number) => (
              <div className="context-menu-item-wrap" key={index}>
                {renderItem(item, index, 'sortable')}
              </div>
            ))}
          </div>
          <div className="context-empty" style={menu.items.length === 0 ? undefined : { display: 'none' }}>
            {t('context.noResult')}
          </div>
        </div>
      ) : null}

      {!menu.sortable ? (
        <div className="context-menu-items">
          {menu.items?.map((item: any, index: number) => (
            <div className="context-menu-item-wrap" key={index}>
              {renderItem(item, index, 'plain')}
            </div>
          ))}
          <div className="context-empty" style={menu.items?.length === 0 ? undefined : { display: 'none' }}>
            {t('context.noResult')}
          </div>
        </div>
      ) : null}

      <div className="context-menu-item-submenus">
        {(menu.items || []).map((item: any, index: number) =>
          item.submenu && active === item.submenu ? (
            <SubmenuPane key={index} item={item} searchKeyword={searchKeyword} theme={theme} ctx={ctx} stateRef={stateRef} />
          ) : null
        )}
      </div>
    </>
  );
}

/** 子菜单窗格（autoPositionContextMenu 指令移植，16350-16393）。 */
function SubmenuPane({
  item,
  searchKeyword,
  theme,
  ctx,
  stateRef,
}: {
  item: any;
  searchKeyword: string;
  theme: string;
  ctx: MenuCtx;
  stateRef: React.MutableRefObject<any>;
}) {
  const elRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = elRef.current;
    if (!element) return;
    const autoPosition = () => {
      const placeholder = q('#submenu-placeholder');
      const $menuItem = placeholder?.parentElement;
      if (!$menuItem) return;

      const position = { top: $menuItem.offsetTop, left: $menuItem.offsetLeft };
      const offset = offsetOf($menuItem);
      if (!offset) return;

      const elementTop = offset.top;
      const elementBottom = elementTop + heightOf(element);
      const elementRight = offset.left + outerWidthOf($menuItem) + outerWidthOf(element);
      const maxBottom = window.innerHeight - 20;
      const maxRight = window.innerWidth - 20;

      let offsetY = 0;
      let offsetX = 0;

      if (elementBottom > maxBottom) offsetY = elementBottom - maxBottom;
      if (elementRight > maxRight) offsetX = outerWidthOf($menuItem) + outerWidthOf(element);

      offsetY = Math.min(offsetY, elementTop);

      // 原版语义（bundle 16350）：top/left 用 $menuItem.position()（offsetParent 相对），
      // offset()（页面相对）只用于边界检查——left 误用 offset.left 会叠加菜单自身 left 造成子菜单飞位。
      const top = position.top - offsetY;
      const left = Math.max(-offset.left + 20, position.left + outerWidthOf($menuItem) - offsetX - 4);

      element.style.opacity = '1';
      element.style.top = `${top}px`;
      element.style.left = `${left}px`;

      const items = element.querySelector('.context-menu-items') as HTMLElement | null;
      if (items) items.style.maxHeight = `${maxBottom - offsetY}px`;
    };
    const timer = setTimeout(autoPosition, 50);
    window.addEventListener('resize', autoPosition);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', autoPosition);
    };
  }, [ctx.tick, item]);

  return (
    <div className="context-menu submenu open" ref={elRef}>
      <MenuItems menu={item.submenu} searchKeyword={searchKeyword} theme={theme} ctx={ctx} stateRef={stateRef} />
    </div>
  );
}

/* ---------------- 主组件（contextMenu 指令 link，15887-16348） ---------------- */

export function ContextMenuPanel() {
  const [tick, setTick] = useState(0);
  const [open, setOpen] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [width, setWidth] = useState<string>('auto');
  const [showSearch, setShowSearch] = useState(false);
  const [persistents, setPersistents] = useState<any[] | undefined>(undefined);

  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const toolbarSnapshot = useToolbarState((s: any) => s.snapshot);
  const menuTheme = () => toolbarSnapshot.theme;

  const stateRef = useRef({
    originalMenu: null as any,
    displayMenu: {} as any,
    activeMenu: null as any,
    onOpened: () => {},
    onClosed: () => {},
    onSorted: undefined as any,
    enterKeydown: false,
    keyBuffer: '',
    keyBufferTimeout: 0 as any,
    sortableOptions: {
      distance: 10,
      animation: 200,
      handle: undefined as any,
      disabled: false,
      onSorted: undefined as any,
    } as any,
  });

  useEffect(() => {
    setHost(document.getElementById('eagle-context-menu-host'));
  }, []);

  const rerender = () => setTick((x) => x + 1);
  void 0;

  const isItemSelectable = (item: any) => {
    if (item.role === 'toggle') return true;
    return !item.role && !item.disabled;
  };

  const selectUp = () => {
    const st = stateRef.current;
    if (st.activeMenu.currentIndex > 0) {
      const prevIdx = st.activeMenu.currentIndex - 1;
      const prevItem = st.activeMenu.items[prevIdx];
      if (!prevItem) return;
      st.activeMenu.currentIndex = prevIdx;
      if (!isItemSelectable(prevItem)) {
        selectUp();
      }
    }
    rerender();
  };

  const selectDown = () => {
    const st = stateRef.current;
    if (st.activeMenu.currentIndex < st.activeMenu.items.length - 1) {
      const nextIdx = st.activeMenu.currentIndex + 1;
      const nextItem = st.activeMenu.items[nextIdx];
      if (!nextItem) return;
      st.activeMenu.currentIndex = nextIdx;
      if (!isItemSelectable(nextItem)) {
        selectDown();
      }
    }
    rerender();
  };

  const openSubmenu = (item: any) => {
    const st = stateRef.current;
    if (!item?.submenu) return;
    st.activeMenu = item.submenu;
    st.activeMenu.currentIndex = 0;
    rerender();
  };

  const closeSubmenu = () => {
    const st = stateRef.current;
    st.activeMenu = st.originalMenu;
    rerender();
  };

  const hoverItem = (index: number, menu: any) => {
    const st = stateRef.current;
    menu.currentIndex = index;
    st.activeMenu = menu;
    const item = menu.items[index];
    openSubmenu(item);
  };

  const openItem = (item: any) => {
    if (!item || item?.submenu) return;
    item?.click && item.click(item);
    if (item?.keepOpen) {
      if (item.checked !== undefined) {
        item.checked = !item.checked;
      }
    } else {
      close();
    }
    rerender();
  };

  const toggleItem = (item: any) => {
    item.pinned = !item.pinned;
    item?.toggle && item.toggle(item.pinned);
    rerender();
  };

  const openMore = (item: any) => {
    item?.more && item.more(item);
  };

  const focusSearchInput = () => {
    setTimeout(() => {
      searchRef.current?.focus();
    }, 24);
  };

  const blurSearchInput = () => {
    searchRef.current?.blur();
  };

  const moveToCursorPosition = (callback: () => void, retry: number) => {
    const el = rootRef.current;
    if (!el) return;
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    const containerWidth = widthOf(el);
    const containerHeight = heightOf(el);
    const searchInputHeight = stateRef.current.displayMenu.showSearch ? 36 : 0;

    if (retry < 5 && (containerHeight < 34 + searchInputHeight || containerWidth < 90)) {
      setTimeout(() => {
        moveToCursorPosition(callback, retry + 1);
      }, 50);
      return;
    }

    const w = window as any;
    let x = w.windowMouseX + 10;
    let y = w.windowMouseY - 10;

    if (w.windowMouseX + containerWidth > windowWidth) {
      x = w.windowMouseX - containerWidth - 5;
    }

    if (w.windowMouseY + containerHeight > windowHeight - 20) {
      y = windowHeight - containerHeight - 20;
      y = y < 20 ? 20 : y;
    } else if (w.windowMouseY - 56 < 0) {
      y = 36;
    }

    el.style.left = `${x}px`;
    el.style.top = `${y}px`;

    const maxHeight = windowHeight - searchInputHeight - y - 20;

    const items = el.querySelector('.context-menu-items') as HTMLElement | null;
    if (items) items.style.maxHeight = `${maxHeight}px`;

    callback();
  };

  const openContextMenu = () => {
    setTimeout(() => {
      moveToCursorPosition(() => {
        rootRef.current?.classList.add('open');
        stateRef.current.onOpened();
        setTimeout(focusSearchInput, 50);
      }, 0);
    }, 50);
  };

  const destroy = () => {
    const st = stateRef.current;
    const items = rootRef.current?.querySelector('.context-menu-items') as HTMLElement | null;
    if (items) items.style.maxHeight = '';
    setSearchKeyword('');
    st.displayMenu = {};
    st.activeMenu = null;
    setShowSearch(false);
    setPersistents(undefined);
    rerender();
  };

  const close = () => {
    const st = stateRef.current;
    destroy();
    rootRef.current?.classList.remove('open');
    blurSearchInput();
    st.onClosed();
    setOpen(false);
    rerender();
  };

  const getSearchResultMenu = (keyword: string) => {
    const st = stateRef.current;
    const chineseConvert = (window as any).chineseConvert;

    const filterItems = (items: any[], kw: string) => {
      if (!items) return items;
      if (!kw) return items;
      const keyword_cn = chineseConvert.tw2cn(kw);

      const temp = items.map((item) => {
        const itemName = `${item.label ?? ''} ${item.keywords ?? ''}`;
        const nameCN = chineseConvert.tw2cn(itemName);
        return {
          item: item,
          name: nameCN,
          search: [nameCN],
        };
      });

      const scores = temp.map((item) => {
        const itemName = `${item.item.label ?? ''} ${item.item.keywords ?? ''}`;
        return {
          item: item,
          name: itemName,
          score: max(item.search.map((pinyin: string) => (pinyin as any).score(keyword_cn))),
        };
      });

      let result = scores
        .filter((i) => i.score > 0)
        .sort((a, b) => b.score - a.score)
        .map(function (i) {
          return i.item.item;
        });

      result = result.filter((item) => !item.role || item.role === 'toggle');
      result = result.filter((item) => !item.submenu);
      result = result.filter((item) => !item.disabled);

      result = result.sort((a, b) => {
        const aIndex = String(a.label ?? '').toLowerCase().indexOf(kw.toLowerCase());
        const bIndex = String(b.label ?? '').toLowerCase().indexOf(kw.toLowerCase());
        if (aIndex === -1 || bIndex === -1) return 0;
        return aIndex - bIndex;
      });

      return result;
    };

    const result: any = {
      items: [],
      showSearch: true,
      currentIndex: 0,
    };

    const level1Result = filterItems(st.originalMenu.items, keyword);
    level1Result.sort((a: any, b: any) => {
      const aIndex = String(a.label ?? '').toLowerCase().indexOf(keyword.toLowerCase());
      const bIndex = String(b.label ?? '').toLowerCase().indexOf(keyword.toLowerCase());
      if (aIndex === -1 || bIndex === -1) return 0;
      return aIndex - bIndex;
    });

    result.items = [...level1Result];

    const level1MatchStartIndex = level1Result.findIndex((item: any) =>
      String(item.label ?? '').toLowerCase().startsWith(keyword.toLowerCase())
    );

    const level2Results: any[] = [];
    st.originalMenu.items.forEach((item: any) => {
      if (item?.submenu?.items) {
        const level2Result = filterItems(item.submenu.items, keyword);
        if (level2Result.length > 0) {
          let level2KeywordIndex = -1;
          level2Result.forEach((level2Item: any) => {
            const keywordIndex = String(level2Item.label ?? '').toLowerCase().indexOf(keyword.toLowerCase());
            if (keywordIndex > level2KeywordIndex) {
              level2KeywordIndex = keywordIndex;
            }
          });

          level2Results.push({
            parent: item,
            index: level2KeywordIndex,
            items: level2Result,
          });
        }
      }
    });

    level2Results.sort((a, b) => {
      if (a.index === -1 || b.index === -1) return 0;
      return a.index - b.index;
    });

    level2Results.forEach((level2Result) => {
      const parent = level2Result.parent;
      let level2Items = level2Result.items;
      const level2Index = level2Result.index;
      if (level1MatchStartIndex === -1 && level2Index >= 0) {
        if (result.items.length > 0) {
          level2Items = [{ role: 'label', label: parent.label }, ...level2Items, { role: 'separator' }];
        } else {
          level2Items = [{ role: 'label', label: parent.label }, ...level2Items];
        }
        result.items = [...level2Items, ...result.items];
      } else {
        if (result.items.length > 0) {
          level2Items = [{ role: 'separator' }, { role: 'label', label: parent.label }, ...level2Items];
        } else {
          level2Items = [{ role: 'label', label: parent.label }, ...level2Items];
        }
        result.items = [...result.items, ...level2Items];
      }
    });

    result.currentIndex = result.items.findIndex((item: any) => isItemSelectable(item)) || 0;
    return result;
  };

  const onSearchChange = (value: string) => {
    const st = stateRef.current;
    setSearchKeyword(value);
    if (!st.displayMenu.showSearch) return;
    if (value !== '') {
      st.displayMenu = getSearchResultMenu(value);
      st.sortableOptions.disabled = true;
      setShowSearch(st.displayMenu.showSearch);
    } else {
      st.displayMenu = st.originalMenu;
      st.displayMenu.currentIndex = -1;
      st.sortableOptions.disabled = false;
      setShowSearch(st.displayMenu.showSearch);
    }
    st.activeMenu = st.displayMenu;
    rerender();
  };

  const onSearchKeydown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    const st = stateRef.current;
    const e = event.nativeEvent as any;
    const idx = st.activeMenu?.currentIndex;
    const item = st.activeMenu?.items ? st.activeMenu.items[idx] : null;
    switch (e.keyCode) {
      case 13:
        e.preventDefault();
        st.enterKeydown = true;
        break;
      case 38:
        e.preventDefault();
        selectUp();
        break;
      case 40:
        e.preventDefault();
        selectDown();
        break;
      case 37:
        closeSubmenu();
        void item;
        break;
      case 39:
        openSubmenu(item);
        break;
      case 27:
        e.preventDefault();
        break;
      default:
        if (!st.displayMenu.showSearch) {
          event.stopPropagation();
          event.preventDefault();
          st.keyBuffer += String.fromCharCode(e.keyCode).toLowerCase();
          clearTimeout(st.keyBufferTimeout);
          st.keyBufferTimeout = setTimeout(() => {
            st.keyBuffer = '';
          }, 500);
          const found = st.activeMenu.items.findIndex((it: any) => String(it?.label ?? '').toLowerCase().startsWith(st.keyBuffer));
          if (found >= 0) {
            st.activeMenu.currentIndex = found;
          }
          rerender();
        }
        break;
    }
  };

  const onSearchKeyup = (event: React.KeyboardEvent<HTMLInputElement>) => {
    const st = stateRef.current;
    const e = event.nativeEvent as any;
    const item = st.activeMenu?.items?.[st.activeMenu.currentIndex];
    switch (e.keyCode) {
      case 32:
        if (!st.displayMenu.showSearch) {
          e.preventDefault();
          openItem(item);
        }
        break;
      case 13:
        if (st.enterKeydown) {
          openItem(item);
          st.enterKeydown = false;
        }
        break;
      case 27:
        e.preventDefault();
        close();
        break;
    }
  };

  const init = (menu: any) => {
    const st = stateRef.current;
    // 清理 menu.items 裡面不需要的 item
    menu.items = menu.items.filter((item: any) => item.visible !== false);
    const walk = (obj: any, cb: (item: any, parent: any) => void, parent: any) => {
      (obj.items || []).forEach((item: any) => {
        cb(item, parent);
        if (item.submenu) walk(item.submenu, cb, item);
      });
    };
    walk(menu, (item: any) => {
      if (item.submenu) {
        item.submenu.items = item.submenu.items.filter((it: any) => it.visible !== false);
      }
    }, menu);
    st.originalMenu = menu;
    st.sortableOptions = {
      distance: 10,
      animation: 200,
      handle: menu.sortableHelper ? '.drag-helper' : undefined,
      disabled: false,
      onSorted: menu.onSorted,
    };
    setWidth(menu.width || 'auto');
    st.displayMenu = menu;
    st.displayMenu.currentIndex = -1;
    st.activeMenu = menu;
    st.onOpened = menu.onOpened || (() => {});
    st.onClosed = menu.onClosed || (() => {});
    st.onSorted = menu.onSorted;
    setShowSearch(menu.showSearch);
    setPersistents(menu.persistents);
  };

  // CONTEXTMENU.OPEN / CLOSE 事件（b1-9bo：自 scope $on 切 eagleBus 订阅——
  // 频道原子切换的消费端；scope 未就绪不再阻断订阅）
  useEffect(() => {
    const offOpen = contextMenuOpenChannel.on((options: any) => {
      init(options);
      setOpen(true);
      rerender();
      openContextMenu();
    });
    const offClose = contextMenuCloseChannel.on(() => {
      close();
    });
    return () => {
      offOpen();
      offClose();
    };
  }, []);

  const ctx: MenuCtx = {
    openItem,
    toggleItem,
    openMore,
    hoverItem,
    isItemSelectable,
    getActive: () => stateRef.current.activeMenu,
    tick,
    theme: menuTheme(),
  };

  const st = stateRef.current;
  void st.onSorted;

  return host
    ? createPortal(
        <>
          <div
            className="context-menu"
            style={{ minWidth: width === 'auto' ? undefined : `${width}px`, ...(open ? undefined : {}) }}
            onMouseUp={() => focusSearchInput()}
            ref={rootRef}
          >
            <div className={`search${!showSearch ? ' hide-search' : ''}`}>
              <input
                type="search"
                ref={searchRef}
                value={searchKeyword}
                onChange={(e) => onSearchChange(e.target.value)}
                onKeyDown={onSearchKeydown}
                onKeyUp={onSearchKeyup}
                placeholder={t('context.search')}
              />
            </div>
            <MenuItems
              menu={st.displayMenu}
              searchKeyword={searchKeyword}
              theme={menuTheme()}
              ctx={ctx}
              stateRef={stateRef}
            />
            {persistents && (
              <div className="persistent-items">
                <div className="context-menu-items">
                  {persistents.map((item: any, index: number) => {
                    if (item.role === 'separator') {
                      return <div className="context-menu-separator" key={index} />;
                    }
                    return (
                      <div
                        className={`context-menu-item${item.disabled ? ' disabled' : ''}${item.checked === false ? ' unchecked' : ''}`}
                        key={index}
                        onClick={() => openItem(item)}
                      >
                        {item.icon && <div className="icon"><img src={iconSrc(menuTheme(), item.icon)} /></div>}
                        <div className="label" dangerouslySetInnerHTML={{ __html: String(item.label ?? '') }} />
                        <div className="right">
                          <div className="accelerator">{shortcuts(item.accelerator || '')}</div>
                          <div className="actions">
                            <div className="icon-checkbox">
                              <img src={iconSrc(menuTheme(), 'ic-context-menu-checkbox.svg')} />
                            </div>
                            <div className="icon-arrow-right">
                              <img src={iconSrc(menuTheme(), 'ic-context-menu-arrow-right.svg')} />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          <div
            className="context-menu-overlay"
            onClick={() => close()}
            onContextMenu={() => close()}
          />
        </>,
        host
      )
    : null;
}
