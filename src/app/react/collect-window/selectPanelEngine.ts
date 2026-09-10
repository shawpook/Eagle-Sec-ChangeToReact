/**
 * 采集窗 SelectPanel 引擎——js/directives/select-panel.js + folder-select-panel.js 无 Angular
 * 逐字移植（阶段9b-1）。与阶段7 引擎（bundle 版）是同族分叉：collect 版定位用自身 mousemove
 * 追踪（controller.mouseState）+ jQuery 定位；tab 切换已停用（onTabKey 直接 return 的怪癖保留）；
 * close() 为空实现（原版注释掉的逻辑，逐字保留）；String.prototype.score / cartesianProduct
 * 由本模块提供（原 select-panel.js 顶层全局）。
 */

import { mouseState } from './controller';
import { scopeEvalAsync } from '../global/scopeShim';

const $: any = (...args: any[]) => (window as any).jQuery(...args);

/* ---- String.prototype.score（select-panel.js 4-99 逐字） ---- */
if (!(String.prototype as any).__eagleScorePatched) {
  (String.prototype as any).score = function (this: any, word: string, fuzziness?: number) {
    const string = this;
    if (string === word) {
      return 1;
    }
    if (word === '') {
      return 0;
    }
    let runningScore = 0;
    let charScore;
    let finalScore;
    const lString = string.toLowerCase();
    const strLength = string.length;
    const lWord = word.toLowerCase();
    const wordLength = word.length;
    let idxOf;
    let startAt = 0;
    let fuzzies = 1;
    let fuzzyFactor = 1;
    let i;

    if (fuzziness) {
      fuzzyFactor = 1 - fuzziness;
    }

    if (fuzziness) {
      for (i = 0; i < wordLength; i += 1) {
        idxOf = lString.indexOf(lWord[i], startAt);
        if (idxOf === -1) {
          fuzzies += fuzzyFactor;
        } else {
          if (startAt === idxOf) {
            charScore = 0.7;
          } else {
            charScore = 0.1;
            if (string[idxOf - 1] === ' ') {
              charScore += 0.8;
            }
          }
          if (string[idxOf] === word[i]) {
            charScore += 0.1;
          }
          runningScore += charScore;
          startAt = idxOf + 1;
        }
      }
    } else {
      for (i = 0; i < wordLength; i += 1) {
        idxOf = lString.indexOf(lWord[i], startAt);
        if (-1 === idxOf) {
          return 0;
        }
        if (startAt === idxOf) {
          charScore = 0.7;
        } else {
          charScore = 0.1;
          if (string[idxOf - 1] === ' ') {
            charScore += 0.8;
          }
        }
        if (string[idxOf] === word[i]) {
          charScore += 0.1;
        }
        runningScore += charScore;
        startAt = idxOf + 1;
      }
    }

    finalScore = (0.5 * (runningScore / strLength + runningScore / wordLength)) / fuzzies;

    if (lWord[0] === lString[0] && finalScore < 0.85) {
      finalScore += 0.15;
    }

    return finalScore;
  };
  (String.prototype as any).__eagleScorePatched = true;
}

export function cartesianProduct(elements: string[][], length = 10): string[][] {
  if (!Array.isArray(elements)) {
    throw new TypeError();
  }
  const end = elements.length - 1;
  const result: string[][] = [];

  function addTo(curr: string[], start: number) {
    const first = elements[start];
    const last = start === end;

    for (let i = 0; i < first.length; ++i) {
      const copy = curr.slice();
      copy.push(first[i]);

      if (result.length >= length) break;

      if (last) {
        result.push(copy);
      } else {
        addTo(copy, start + 1);
      }
    }
  }

  if (elements.length) {
    addTo([], 0);
  } else {
    result.push([]);
  }
  return result;
}

/* ---- 面板 i18n（原版裸 `i18n.__` 全局在采集窗页面未定义 → 原版该路径抛 ReferenceError；
 *      这里守卫读取（有 window.i18n 则用之），行为面等价降级为键原样返回 ---- */
export const panelI18n = (key: string): string => {
  const i18n = (window as any).i18n;
  if (i18n && typeof i18n.__ === 'function') {
    try {
      return i18n.__(key);
    } catch (err) {
      /* fallthrough */
    }
  }
  return key;
};

/* ---- SelectPanelSearchInput（select-panel.js 100-208 逐字） ---- */

export class SelectPanelSearchInput {
  enterKeydown: any;
  escKeydown: any;
  $input: any;
  onChange: any;
  onEnterKey: any;
  onEscKey: any;
  onTabKey: any;
  onUpKey: any;
  onDownKey: any;
  onLeftKey: any;
  onRightKey: any;
  onPaste: any;

  constructor(params: any) {
    this.$input = $(params.selector);
    this.onChange = params.onChange || function () {};
    this.onEnterKey = params.onEnterKey || function () {};
    this.onEscKey = params.onEscKey || function () {};
    this.onTabKey = params.onTabKey || function () {};
    this.onUpKey = params.onUpKey || function () {};
    this.onDownKey = params.onDownKey || function () {};
    this.onLeftKey = params.onLeftKey || function () {};
    this.onRightKey = params.onRightKey || function () {};
    this.onPaste = params.onPaste || function () {};
    this.enterKeydown = false;
    this.escKeydown = false;

    this.$input.off('keyup').on('keyup', (event: any) => {
      switch (event.keyCode) {
        case 13:
          if (this.enterKeydown) {
            this.onEnterKey(event);
            this.enterKeydown = false;
          }
          break;
        case 27:
          if (this.escKeydown) {
            event.preventDefault();
            event.stopPropagation();
            this.onEscKey();
            this.escKeydown = false;
          }
          break;
      }
    });

    this.$input.off('keydown').on('keydown', (event: any) => {
      switch (event.keyCode) {
        case 9:
          if (this.onTabKey !== undefined) {
            event.preventDefault();
            event.stopPropagation();
            this.onTabKey(event);
          }
          break;
        case 13:
          event.preventDefault();
          if (event.metaKey || event.ctrlKey) {
            this.onEnterKey(event);
          } else {
            this.enterKeydown = true;
          }
          break;
        case 37:
          this.onLeftKey(event);
          break;
        case 39:
          this.onRightKey(event);
          break;
        case 38:
          event.preventDefault();
          this.onUpKey();
          break;
        case 40:
          event.preventDefault();
          this.onDownKey();
          break;
        case 27:
          event.preventDefault();
          this.escKeydown = true;
          break;
        default:
          break;
      }
    });

    this.$input.off('paste').on('paste', (event: any) => {
      this.onPaste(event);
    });

    this.$input.off('input').on('input', () => {
      this.onChange();
    });
  }

  focus() {
    setTimeout(() => {
      this.$input.focus();
    }, 24);
  }

  blur() {
    this.$input.blur();
  }
}

/* ---- SelectPanel 基类（select-panel.js 209-494 逐字） ---- */

export class SelectPanel {
  fixedSize: any;
  searchInput: any;
  listData: any;
  $panel: any;
  onOpened: any;
  onClosed: any;
  scope: any;
  panelHeight: any;


  constructor(params: any) {
    this.scope = params.scope;
    this.$panel = $(params.panelSelector);
    this.fixedSize = params.fixedSize ?? false;

    this.searchInput = new SelectPanelSearchInput({
      scope: params.scope,
      selector: params.searchInputSelector,
      onChange: () => {
        this.listData.searchKeyword = this.searchInput.$input.val();
        this.keywordChanged();
        scopeEvalAsync();
      },
      onEnterKey: (event: any) => {
        const item = this.listData?.items?.[this.listData.currentIndex];
        this.openItem(event, item);
        scopeEvalAsync();
      },
      onEscKey: () => {
        this.close();
        scopeEvalAsync();
      },
      onTabKey: (event: any) => {
        this.onTabKey(event);
        scopeEvalAsync();
      },
      onUpKey: (event: any) => {
        this.selectUp(event);
        scopeEvalAsync();
      },
      onDownKey: (event: any) => {
        this.selectDown(event);
        scopeEvalAsync();
      },
      onLeftKey: (event: any) => {
        this.selectLeft(event);
        scopeEvalAsync();
      },
      onRightKey: (event: any) => {
        this.selectRight(event);
        scopeEvalAsync();
      },
      onPaste: (event: any) => {
        this.onPaste(event);
        scopeEvalAsync();
      },
    });
  }

  init(params: any) {
    this.reset();
    this.panelHeight = this.$panel.height();
    this.onOpened = params.onOpened || (() => {});
    this.onClosed = params.onClosed || (() => {});
  }

  reset() {
    if (!this.listData) {
      this.listData = {
        items: [],
        currentIndex: -1,
        searchKeyword: '',
      };
    }
    this.listData.items = [];
    this.listData.currentIndex = -1;
    this.listData.searchKeyword = '';
    this.clearSearchInput();
  }

  open(params?: any) {
    if (params?.preventCollisionWithElement) {
      this.#moveToCursorPositionAndPreventCollisionWithElement(
        () => {
          this.$panel.addClass('open');
          this.onOpened && this.onOpened();
          setTimeout(() => {
            this.searchInput.focus();
          }, 50);
        },
        params.preventCollisionWithElement,
        0
      );
    } else {
      this.#moveToCursorPosition(() => {
        this.$panel.addClass('open');
        this.onOpened && this.onOpened();
        setTimeout(() => {
          this.searchInput.focus();
        }, 50);
      }, 0);
    }
  }

  close() {
    this.scrollTop();
    this.$panel.removeClass('open');
    this.searchInput.blur();
    this.reset();
    this.onClosed();
  }

  selectUp(_event?: any) {
    if (this.listData.currentIndex > 0) {
      const prevIdx = this.listData.currentIndex - 1;
      const prevItem = this.listData.items[prevIdx];
      if (!prevItem) return;
      this.listData.currentIndex = prevIdx;
      if (!this.isItemSelectable(prevItem)) {
        this.selectUp();
      }
    }
  }

  selectDown(_event?: any) {
    if (this.listData.currentIndex < this.listData.items.length - 1) {
      const nextIdx = this.listData.currentIndex + 1;
      const nextItem = this.listData.items[nextIdx];
      if (!nextItem) return;
      this.listData.currentIndex = nextIdx;
      if (!this.isItemSelectable(nextItem)) {
        this.selectDown();
      }
    }
  }

  openItem(_event: any, _item: any) {
    throw new Error('You have to implement the method doSomething!');
  }

  onTabKey(_event?: any) {}

  onPaste(_event?: any) {}

  selectLeft(_event?: any) {}

  selectRight(_event?: any) {}

  onLeftKey(_event?: any) {}

  onRightKey(_event?: any) {}

  hoverItem(indexOrEvent: any, menu?: any) {
    // TagSelectPanel 覆写为 (event, item)；基类（select-panel.js）为 (index, menu)
    if (typeof indexOrEvent === 'number') {
      this.listData.currentIndex = indexOrEvent;
    }
  }

  focusSearchInput() {
    this.searchInput.focus();
  }

  clearSearchInput() {
    this.searchInput.$input.val('');
  }

  keywordChanged() {
    throw new Error('You have to implement the method doSomething!');
  }

  isItemSelectable(_item: any): boolean {
    throw new Error('You have to implement the method doSomething!');
  }

  scrollTop() {
    this.$panel.find('select-panel-list').scrollTop(0);
  }

  #moveToCursorPositionAndPreventCollisionWithElement(callback: () => void, element: any, retry: number) {
    const $w = $(window);
    const windowWidth = $w.width();
    const windowHeight = $w.height();
    const containerWidth = this.$panel.width();
    const containerHeight = this.$panel.height();
    let x = mouseState.windowMouseX + 10;
    let y = mouseState.windowMouseY - 10;

    if (retry < 3 && containerHeight === this.panelHeight) {
      setTimeout(() => {
        this.#moveToCursorPositionAndPreventCollisionWithElement(callback, element, retry + 1);
      }, 50);
      return;
    }

    if (mouseState.windowMouseX + containerWidth > windowWidth) {
      x = mouseState.windowMouseX - containerWidth - 20;
    }

    if (mouseState.windowMouseY + containerHeight > windowHeight - 20) {
      y = windowHeight - containerHeight - 20;
      y = y < 20 ? 20 : y;
    }

    if (element) {
      const elementRect = element.getBoundingClientRect();
      const elementBottom = elementRect.top + elementRect.height;
      const elementRight = elementRect.left + elementRect.width;

      if (x < elementRight && y < elementBottom) {
        const potentialBottomY = elementBottom + 10;
        if (potentialBottomY + containerHeight <= windowHeight - 20) {
          y = potentialBottomY;
        } else {
          const potentialRightX = elementRight + 10;
          if (potentialRightX + containerWidth <= windowWidth - 20) {
            x = potentialRightX;
          }
        }
      }
    }

    this.$panel.css({
      left: `${x}px`,
      top: `${y}px`,
    });

    callback();
  }

  #moveToCursorPosition(callback: () => void, retry: number) {
    const $w = $(window);
    const windowWidth = $w.width();
    const windowHeight = $w.height();
    const containerWidth = this.$panel.width();
    const containerHeight = this.$panel.height();
    let x = mouseState.windowMouseX + 10;
    let y = mouseState.windowMouseY - 10;
    let maxHeight = windowHeight;

    if (!this.fixedSize) {
      if (retry < 30 && containerHeight === this.panelHeight) {
        setTimeout(() => {
          this.#moveToCursorPosition(callback, retry + 1);
        }, 5);
        return;
      }
    }

    if (mouseState.windowMouseX + containerWidth > windowWidth) {
      x = mouseState.windowMouseX - containerWidth - 20;
    }

    if (mouseState.windowMouseY + containerHeight > windowHeight - 20) {
      y = windowHeight - containerHeight - 20;
      y = y < 20 ? 20 : y;
    } else if (mouseState.windowMouseY - 56 < 0) {
      y = 36;
    }

    maxHeight = windowHeight - y - 80;

    this.$panel.css({
      left: `${x}px`,
      top: `${y}px`,
    });

    this.$panel.find('select-panel-list').css({
      'max-height': `${maxHeight - 40}px`,
    });

    callback();
  }
}
