/**
 * 采集窗右键菜单——context-menu.js（462）+ context-menu.html/items.html（30+147）无 Angular
 * 逐字移植。阶段9b-2a。
 *
 * ContextMenu.open/close 全局静态（原版 $rootScope 广播 CONTEXTMENU.OPEN/CLOSE → React 版
 * 模块级监听器通知）；openItemSubmenu 的 $bodyScope.* 路径在采集窗本就未定义（原版
 * ReferenceError 怪癖，Angular 经 $exceptionHandler 吞掉、React 事件Handler抛错仅记录）——逐字保留。
 * ui-sortable 分支：menu.sortable 时经 jQuery UI sortable 挂载（sortableOptions.update → onSorted）。
 */

import { useEffect, useRef, useState } from 'react';
import { ct } from './controller';
import { getSortable, makeSortable } from '../components/interactions/sortable';

import { q, hasClass, widthOf, heightOf, setCssEl, onEl, offsetOf, outerWidthOf } from '../utils/domQuery';
const treeUtil = (window as any).eagle.utils.tree;

type Listener = () => void;
const listeners = new Set<Listener>();
let menuState: any = null; // 当前 init 的 menu（原 scope.displayMenu/activeMenu 源头）
let menuVersion = 0;

function emit() {
  menuVersion++;
  listeners.forEach((l) => l());
}

export class ContextMenu {
  static open(options: any) {
    menuState = options;
    menuVersion++;
    openSignal++;
    listeners.forEach((l) => l());
  }
  static close() {
    closeSignal++;
    listeners.forEach((l) => l());
  }
}

let openSignal = 0;
let closeSignal = 0;

export function useCollectContextMenuVersion(): number {
  const [, bump] = useState(0);
  useEffect(() => {
    const l = () => bump((v: number) => v + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return menuVersion;
}

/* ---- 模板行为（context-menu.js link 逐字） ---- */

export function CollectContextMenu() {
  useCollectContextMenuVersion();
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const engine = useRef<any>(null);
  if (!engine.current) {
    engine.current = createEngine(() => {
      /* force update */
      menuVersion++;
      listeners.forEach((l) => l());
    });
  }
  const eng = engine.current;
  // 引擎创建即挂契约（bindElement 时序无关；window.__eagleCollectContextMenu 由 effect 覆盖为同引用）
  (window as any).__eagleCollectContextMenuEngine = eng;

  useEffect(() => {
    try {
      const el = rootRef.current;
      (window as any).__eagleCollectBindDebug = { el: !!el, input: !!searchRef.current };
      if (!el) return;
      eng.bindElement(el, searchRef.current);
      // 测试契约（CDP 直读引擎状态）
      (window as any).__eagleCollectContextMenu = eng;
      return () => {
        eng.bindElement(null, null);
      };
    } catch (err: any) {
      (window as any).__eagleCollectBindError = String(err && err.stack || err);
      return undefined;
    }
  }, []);

  useEffect(() => {
    if (openSignal === eng.lastOpenSignal) return;
    eng.lastOpenSignal = openSignal;
    eng.initRef(menuState);
  }, [openSignal]);

  useEffect(() => {
    if (closeSignal === eng.lastCloseSignal) return;
    eng.lastCloseSignal = closeSignal;
    eng.closeContextMenu();
  }, [closeSignal]);

  const displayMenu = eng.scope.displayMenu || {};
  const activeMenu = eng.scope.activeMenu;
  const theme = (window as any).__eagleCollectController?.theme || 'dark';
  const themePath = theme === 'light' || theme === 'lightgray' ? 'light' : 'dark';
  const width = eng.scope.width;

  return (
    <>
      <div
        ref={rootRef}
        className="context-menu"
        style={{ minWidth: width === 'auto' || !width ? 'auto' : `${width}px` }}
        onMouseUp={() => eng.focusSearchInput()}
      >
        <div className={`search${displayMenu.showSearch ? '' : ' hide-search'}`}>
          <input
            type="search"
            ref={searchRef}
            placeholder={ct('collect-window.context-menu.search')}
            onKeyDown={(e: any) => eng.onSearchKeydown(e.nativeEvent || e)}
            onKeyUp={(e: any) => eng.onSearchKeyup(e.nativeEvent || e)}
            onChange={(e) => {
              eng.scope.searchKeyword = (e.target as HTMLInputElement).value;
              eng.onSearchChange();
            }}
          />
        </div>
        <ContextMenuItems menu={displayMenu} activeMenu={activeMenu} themePath={themePath} eng={eng} />

        {/* 底部常駐按鈕 */}
        {displayMenu.persistents && (
          <div className="persistent-items">
            <div className="context-menu-items">
              {displayMenu.persistents.map((item: any, i: number) => (
                <div key={i} className="context-menu-item-wrap">
                  {item.role === 'separator' ? (
                    <div className="context-menu-separator" />
                  ) : (
                    <div
                      className={`context-menu-item${item.disabled ? ' disabled' : ''}${item.checked === false ? ' unchecked' : ''}`}
                      onClick={() => eng.openItem(item)}
                    >
                      {item.icon && (
                        <div className="icon">
                          <img src={`assets/images/${themePath}/icons/context-menu/${item.icon}`} />
                        </div>
                      )}
                      <div className="label" dangerouslySetInnerHTML={{ __html: item.label ?? '' }} />
                      <div className="right">
                        <div className="accelerator">{item.accelerator}</div>
                        <div className="actions">
                          <div className="icon-checkbox">
                            <img src={`assets/images/${themePath}/icons/context-menu/ic-context-menu-checkbox.svg`} />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <div
        className="context-menu-overlay"
        onClick={() => eng.closeContextMenu()}
        onContextMenu={(e: any) => {
          e.preventDefault();
          eng.closeContextMenu();
        }}
      />
    </>
  );
}

/* ---- context-menu-items.html（147 行逐字，含 sortable/非 sortable 两分支 + 递归 submenu） ---- */

export function ContextMenuItems({ menu, activeMenu, themePath, eng }: any) {
  if (!menu) return null;
  const items = menu.items || [];

  const itemNode = (item: any, index: number) => {
    if (item.role === 'separator') return <div key={index} className="context-menu-separator" />;
    if (item.role === 'label') return <div key={index} className="context-menu-label-item">{item.label}</div>;
    if (item.role === 'color')
      return (
        <div key={index} className="context-menu-color-item" onMouseEnter={() => eng.hoverItem(index, menu)}>
          {['', 'red', 'orange', 'yellow', 'green', 'aqua', 'blue', 'purple', 'pink'].map((color: string) => (
            <div
              key={color || 'default'}
              className={`circle${color ? ` ${color}` : ''}`}
              onClick={() => (color ? item.click(color) : item.click())}
            />
          ))}
        </div>
      );

    const commonCls = `context-menu-item${item.disabled ? ' disabled' : ''}${
      index === menu.currentIndex && !item.disabled ? ' active' : ''
    }${item.submenu ? ' has-submenu' : ''}${item.checked ? ' checked' : ''}${item.checked === false ? ' unchecked' : ''}`;

    const inner = (withMore: boolean) => (
      <>
        {menu.sortableHelper && (
          <div className="drag-helper" onClick={(e: any) => e.stopPropagation()}>
            <img src={`assets/images/${themePath}/icons/ic-drag-help.svg`} />
          </div>
        )}
        {item.icon && (
          <div className="icon">
            <img src={`assets/images/${themePath}/icons/context-menu/${item.icon}`} />
          </div>
        )}
        {item.image && (
          <div className="image">
            <img
              src={item.image}
              onError={(e: any) => {
                if (item.fallbackImage && e.currentTarget.getAttribute('src') !== item.fallbackImage) {
                  e.currentTarget.setAttribute('src', item.fallbackImage);
                }
              }}
            />
          </div>
        )}
        <div className="label" dangerouslySetInnerHTML={{ __html: item.label ?? '' }} />
        {withMore && item.more ? (
          <div className="right">
            <div className="accelerator">{item.accelerator}</div>
            <div className="actions">
              <div
                className="ic-btn icon-more"
                onClick={(e: any) => {
                  e.stopPropagation();
                  eng.openMore(item);
                }}
              >
                <img src={`assets/images/${themePath}/icons/context-menu/ic-context-menu-more.svg`} />
              </div>
            </div>
          </div>
        ) : (
          <div className="right">
            <div className="accelerator">{item.accelerator}</div>
            <div className="actions">
              <div className="icon-checkbox" />
            </div>
          </div>
        )}
        {item.submenu && activeMenu === item.submenu && <div id="submenu-placeholder" />}
      </>
    );

    if (item.role === 'toggle')
      return (
        <div key={index} className={commonCls} onClick={() => eng.openItem(item)} onMouseEnter={() => eng.hoverItem(index, menu)}>
          {inner(false)}
          <div className="right">
            <div
              className="toggle-btn"
              style={{ width: 20, height: 20 }}
              hidden={!item.pinned}
              onClick={(e: any) => {
                e.stopPropagation();
                eng.toggleItem(item);
              }}
            >
              <img src={`assets/images/${themePath}/icons/context-menu/ic-filter-pinned.svg`} />
            </div>
            <div
              className="toggle-btn"
              style={{ width: 20, height: 20 }}
              hidden={!!item.pinned}
              onClick={(e: any) => {
                e.stopPropagation();
                eng.toggleItem(item);
              }}
            >
              <img src={`assets/images/${themePath}/icons/context-menu/ic-filter-pin.svg`} />
            </div>
          </div>
        </div>
      );

    return (
      <div
        key={index}
        className={commonCls}
        onClick={() => eng.openItem(item)}
        onMouseEnter={() => eng.hoverItem(index, menu)}
        onContextMenu={(e: any) => {
          e.preventDefault();
          eng.openMore(item);
        }}
      >
        {inner(true)}
      </div>
    );
  };

  return (
    <>
      {menu.sortable && items.length > 0 && (
        <div className="context-menu-items">
          <div ref={(el: any) => eng.bindSortable(el, menu)}>
            {items.map((item: any, index: number) => (
              <div key={index} className="context-menu-item-wrap">
                {itemNode(item, index)}
              </div>
            ))}
          </div>
          {items.length === 0 && <div className="context-empty">{ct('collect-window.context-menu.search-empty')}</div>}
        </div>
      )}
      {!menu.sortable && (
        <div className="context-menu-items">
          {items.map((item: any, index: number) => (
            <div key={index} className="context-menu-item-wrap">
              {itemNode(item, index)}
            </div>
          ))}
          {items.length === 0 && <div className="context-empty">{ct('collect-window.context-menu.search-empty')}</div>}
        </div>
      )}
      <div className="context-menu-item-submenus">
        {items.map(
          (item: any, index: number) =>
            item.submenu && activeMenu === item.submenu && (
              <div key={index} className="context-menu submenu open" ref={(el: any) => eng.bindSubmenu(el)}>
                <ContextMenuItems menu={item.submenu} activeMenu={activeMenu} themePath={themePath} eng={eng} />
              </div>
            )
        )}
      </div>
    </>
  );
}

/* ---- 引擎（context-menu.js link 体逐字，scope 换为闭包对象） ---- */

function createEngine(forceUpdate: () => void) {
  const scope: any = {
    searchKeyword: '',
    menu: null,
    activeMenu: null,
    displayMenu: {},
    width: 'auto',
  };
  const windowMouse = () => (window as any).__eagleCollectMouseState || { windowMouseX: 0, windowMouseY: 0 };

  let onOpened: any = () => {};
  let onClosed: any = () => {};
  let onSorted: any = () => {};
  let originalMenu: any = null;
  let keyBuffer = '';
  let keyBufferTimeout: any = null;
  let enterKeydown = false;
  let contextMenuEl: HTMLElement | null = null;
  let searchInputEl: HTMLInputElement | null = null;
  let sortableEl: any = null;
  let sortableMenu: any = null;

  const eng: any = {
    scope,
    lastOpenSignal: 0,
    lastCloseSignal: -1,

    bindElement(el: any, input: any) {
      contextMenuEl = el || null;
      searchInputEl = input || null;
      if (searchInputEl) {
        onEl(searchInputEl, 'focus', () => {
          if (!hasClass(contextMenuEl, 'open')) {
            blurSearchInput();
          }
        });
      }
    },

    bindSortable(el: any, menu: any) {
      if (sortableEl === el) return;
      if (sortableEl) {
        const s0 = getSortable(sortableEl);
        if (s0) s0.destroy();
        sortableEl = null;
      }
      if (el && menu.sortable) {
        sortableEl = el;
        sortableMenu = menu;
        // D-2f：jQuery-UI sortable → 自研
        makeSortable(el, {
          distance: 10,
          animation: 200,
          handle: menu.sortableHelper ? '.drag-helper' : undefined,
          disabled: false,
          helper: 'clone',
          update: () => {
            setTimeout(() => {
              onSorted && onSorted(originalMenu.items);
            }, 1);
          },
        });
      }
    },

    bindSubmenu(el: any) {
      if (!el) return;
      // 原 autoPositionContextMenu 指令（462-462 逐字语义）
      const autoPosition = () => {
        const menuItem = q('#submenu-placeholder')?.parentElement;
        if (!menuItem) return;
        const menuItemOffset = offsetOf(menuItem);
        if (!menuItemOffset) return;
        const menuItemTop = menuItem.offsetTop;
        const menuItemLeft = menuItem.offsetLeft;
        const menuItemOffsetTop = menuItemOffset.top;
        const menuItemOffsetLeft = menuItemOffset.left;

        const elementTop = menuItemOffsetTop;
        const elementBottom = elementTop + heightOf(el);
        const elementRight = menuItemOffsetLeft + outerWidthOf(menuItem) + outerWidthOf(el);
        const maxBottom = window.innerHeight - 20;
        const maxRight = window.innerWidth - 20;

        let offsetY = 0;
        let offsetX = 0;

        if (elementBottom > maxBottom) offsetY = elementBottom - maxBottom;
        if (elementRight > maxRight) offsetX = outerWidthOf(menuItem) + outerWidthOf(el);

        offsetY = Math.min(offsetY, elementTop);

        const top = menuItemTop - offsetY;
        const left = Math.max(-menuItemOffsetLeft + 20, menuItemLeft + outerWidthOf(menuItem) - offsetX - 4);

        setCssEl(el, {
          opacity: 1,
          top: `${top}px`,
          left: `${left}px`,
        });

        setCssEl(el.querySelector('.context-menu-items') as HTMLElement | null, {
          maxHeight: `${maxBottom - offsetY}px`,
        });
      };
      setTimeout(autoPosition, 50);
      window.addEventListener('resize', autoPosition);
    },

    selectUp() {
      if (scope.activeMenu.currentIndex > 0) {
        const prevIdx = scope.activeMenu.currentIndex - 1;
        const prevItem = scope.activeMenu.items[prevIdx];
        if (!prevItem) return;
        scope.activeMenu.currentIndex = prevIdx;
        if (!isItemSelectable(prevItem)) {
          eng.selectUp();
        }
      }
    },

    selectDown() {
      if (scope.activeMenu.currentIndex < scope.activeMenu.items.length - 1) {
        const nextIdx = scope.activeMenu.currentIndex + 1;
        const nextItem = scope.activeMenu.items[nextIdx];
        if (!nextItem) return;
        scope.activeMenu.currentIndex = nextIdx;
        if (!isItemSelectable(nextItem)) {
          eng.selectDown();
        }
      }
    },

    hoverItem(index: number, menu: any) {
      menu.currentIndex = index;
      scope.activeMenu = menu;
      const item = menu.items[index];
      eng.openSubmenu(item);
    },

    openSubmenu(item: any) {
      if (!item?.submenu) return;
      scope.activeMenu = item.submenu;
      scope.activeMenu.currentIndex = 0;
      forceUpdate();
    },

    closeSubmenu() {
      scope.activeMenu = originalMenu;
      forceUpdate();
    },

    openItem(item: any) {
      if (!item || item?.submenu) return;
      item?.click && item.click(item);
      if (item?.keepOpen) {
        if (item.checked !== undefined) {
          item.checked = !item.checked;
        }
      } else {
        eng.closeContextMenu();
      }
      forceUpdate();
    },

    toggleItem(item: any) {
      item.pinned = !item.pinned;
      item?.toggle && item.toggle(item.pinned);
      forceUpdate();
    },

    openMore(item: any) {
      item?.more && item.more(item);
    },

    focusSearchInput() {
      setTimeout(() => {
        searchInputEl?.focus();
      }, 24);
    },

    onSearchKeydown(event: any) {
      const idx = scope?.activeMenu?.currentIndex;
      const item = scope?.activeMenu?.items ? scope.activeMenu.items[idx] : null;
      switch (event.keyCode) {
        case 13:
          event.preventDefault();
          enterKeydown = true;
          break;
        case 38:
          event.preventDefault();
          eng.selectUp();
          break;
        case 40:
          event.preventDefault();
          eng.selectDown();
          break;
        case 37:
          eng.closeSubmenu(item);
          break;
        case 39:
          eng.openSubmenu(item);
          break;
        case 27:
          event.preventDefault();
          break;
        default:
          if (!scope.displayMenu.showSearch) {
            event.stopPropagation();
            event.preventDefault();
            keyBuffer += String.fromCharCode(event.keyCode).toLowerCase();
            clearTimeout(keyBufferTimeout);
            keyBufferTimeout = setTimeout(() => {
              keyBuffer = '';
            }, 500);
            const kIdx = scope.activeMenu.items.findIndex((it: any) => it?.label?.toLowerCase().startsWith(keyBuffer));
            if (kIdx >= 0) {
              scope.activeMenu.currentIndex = kIdx;
            }
            forceUpdate();
          }
          break;
      }
    },

    onSearchKeyup(event: any) {
      const item = scope?.activeMenu?.items[scope.activeMenu.currentIndex];
      switch (event.keyCode) {
        case 32:
          if (!scope.displayMenu.showSearch) {
            event.preventDefault();
            eng.openItem(item);
          }
          break;
        case 13:
          if (enterKeydown) {
            eng.openItem(item);
            enterKeydown = false;
          }
          break;
        case 27:
          event.preventDefault();
          eng.closeContextMenu();
          break;
      }
    },

    onSearchChange() {
      if (!scope.displayMenu.showSearch) return;
      if (scope.searchKeyword !== '') {
        scope.displayMenu = getSearchResultMenu();
        if (sortableEl) { const s0 = getSortable(sortableEl); if (s0) s0.setDisabled(true); }
      } else {
        scope.displayMenu = originalMenu;
        scope.displayMenu.currentIndex = -1;
        if (sortableEl) { const s0 = getSortable(sortableEl); if (s0) s0.setDisabled(false); }
      }
      scope.activeMenu = scope.displayMenu;
      forceUpdate();
    },

    initRef(menu: any) {
      eng.init(menu);
    },

    init(menu: any) {
      menu.items = menu.items.filter((item: any) => item.visible !== false);
      treeUtil.walk(menu, 'items', function (item: any) {
        if (item.submenu) {
          item.submenu.items = item.submenu.items.filter((it: any) => it.visible !== false);
        }
      });
      originalMenu = menu;
      scope.width = menu.width || 'auto';
      scope.displayMenu = menu;
      scope.displayMenu.currentIndex = -1;
      scope.activeMenu = menu;
      scope.searchKeyword = '';
      onOpened = menu.onOpened || (() => {});
      onClosed = menu.onClosed || (() => {});
      onSorted = menu.onSorted || (() => {});
      forceUpdate();
      eng.openContextMenu();
    },

    openContextMenu() {
      setTimeout(() => {
        moveToCursorPosition(() => {
          contextMenuEl?.classList.add('open');
          onOpened();
          setTimeout(eng.focusSearchInput, 50);
        }, 0);
      }, 50);
    },

    closeContextMenu() {
      eng.destroy();
      contextMenuEl?.classList.remove('open');
      blurSearchInput();
      onClosed();
      forceUpdate();
    },

    destroy() {
      const cmItems = contextMenuEl?.querySelector('.context-menu-items') as HTMLElement | null;
      if (cmItems) cmItems.style.maxHeight = '';
      scope.searchKeyword = '';
      scope.displayMenu = {};
      scope.activeMenu = null;
    },
  };

  const blurSearchInput = () => {
    searchInputEl?.blur();
  };

  const isItemSelectable = (item: any) => {
    if (item.role === 'toggle') return true;
    return !item.role && !item.disabled;
  };

  function moveToCursorPosition(callback: () => void, retry: number) {
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    const containerWidth = widthOf(contextMenuEl);
    const containerHeight = heightOf(contextMenuEl);
    const searchInputHeight = scope.displayMenu.showSearch ? 36 : 0;

    if (retry < 5 && (containerWidth < 20 || containerHeight < 34 + searchInputHeight || containerWidth < 90)) {
      setTimeout(() => {
        moveToCursorPosition(callback, retry + 1);
      }, 20);
      return;
    }

    let x = windowMouse().windowMouseX + 10;
    let y = windowMouse().windowMouseY - 10;

    if (windowMouse().windowMouseX + containerWidth > windowWidth) {
      x = windowMouse().windowMouseX - containerWidth - 5;
    }

    if (windowMouse().windowMouseY + containerHeight > windowHeight - 20) {
      y = windowHeight - containerHeight - 20;
      y = y < 20 ? 20 : y;
    } else if (windowMouse().windowMouseY - 56 < 0) {
      y = 36;
    }

    setCssEl(contextMenuEl, {
      left: `${x}px`,
      top: `${y}px`,
    });

    const maxHeight = windowHeight - searchInputHeight - y - 20;

    setCssEl(contextMenuEl?.querySelector('.context-menu-items') as HTMLElement | null, {
      maxHeight: `${maxHeight}px`,
    });

    callback();
  }

  function getSearchResultMenu() {
    const filterItems = (items: any, keyword: string) => {
      if (!items) return;
      if (!keyword) return items;

      let result = items.filter((item: any) => {
        const itemName = `${item.label ?? ''} ${item.keywords ?? ''}`;
        return itemName.toLowerCase().indexOf(keyword.toLowerCase()) >= 0;
      });

      result = result.filter((item: any) => !item.role || item.role === 'toggle');
      result = result.filter((item: any) => !item.submenu);
      result = result.filter((item: any) => !item.disabled);

      return result;
    };

    const result: any = {
      items: [],
      showSearch: true,
      currentIndex: 0,
    };

    const level1Result: any = filterItems(originalMenu.items, scope.searchKeyword);
    result.items = [...level1Result];

    originalMenu.items.forEach((item: any) => {
      if (item?.submenu?.items) {
        let level2Result: any = filterItems(item.submenu.items, scope.searchKeyword);
        if (level2Result.length > 0) {
          if (result.items.length > 0) {
            level2Result = [{ role: 'separator' }, { role: 'label', label: item.label }, ...level2Result];
          } else {
            level2Result = [{ role: 'label', label: item.label }, ...level2Result];
          }
          result.items = [...result.items, ...level2Result];
        }
      }
    });

    result.currentIndex = result.items.findIndex((item: any) => isItemSelectable(item)) || 0;
    return result;
  }

  return eng;
}
