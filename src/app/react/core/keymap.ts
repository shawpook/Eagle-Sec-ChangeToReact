import { scopeSingleton } from './machineryInfra';
import { beginZoomingTransition } from '../services/detailService';
import { machineryOpenAll, machineryOpenCommunity, machineryOpenRandom, openFolder, openSmartFolder } from '../services/folderCoreService';
import { machineryGotoBottom, machineryGotoTop, machineryScrollbarTo, machineryToggleAll } from '../services/gridService';
import { machineryChangeTo1Star, machineryChangeTo2Star, machineryChangeTo3Star, machineryChangeTo4Star, machineryChangeTo5Star, machineryRemoveStar, saveCrop } from '../services/imageOpsService';
import { machineryAddVideoComment, machineryNextGifFrame, machineryPrevGifFrame } from '../services/mediaService';
import { machineryToggleZoom, machineryZoomIn, machineryZoomOut } from '../services/viewOpsService';
import { syncListFromScope } from '../store/listState';
import { clickEl, q, qa, scrollTopValue } from '../utils/domQuery';
import { throttle } from '../utils/func';
import { moveCropToolChannel, resizeCropToolChannel } from '../global/bus';
import { machineryCopyImages, machineryCreateTxtFileFromTemplate, machineryToggleCommentMode } from './itemDomain';
import { machineryCloseWindowHandler, machineryDestoryMousetrap, machineryMHandler, machineryModShiftDownHandler, machineryModShiftLeftHandler, machineryModShiftRightHandler, machineryModShiftUpHandler, machineryOpenActionsPanel, machineryOpenQuickSearch } from './keymapActions';
import { machineryOpenNextFolder, machineryOpenNextSmartFolder, machineryOpenParentFolder, machineryOpenPrevFolder, machineryOpenPrevSmartFolder, machineryOpenRecent, machineryOpenTrash, machineryOpenUnfiled, machineryRefreshRandom, machinerySetFolderCover, machineryToggleAllFolders, machineryUpdateSidebarList } from './libraryDomain';
import { machineryOpenPluginPanel, machineryQuicklook, machineryToggleDetailMode } from './miscDomain';
import { machineryBack, machineryNextHistory, machineryOpenNextQuickAccess, machineryOpenPrevQuickAccess, machineryPrevHistory, machineryUndo } from './navHistory';
import { machineryMultipleSelectDown, machineryMultipleSelectNext, machineryMultipleSelectPrev, machineryMultipleSelectUp, machineryOpenInspectorFolderSelectPanel, machineryOpenInspectorTagSelectPanel, machineryRemoveSelected, machinerySelectAll, machinerySelectDown, machinerySelectNext, machinerySelectPrev, machinerySelectUp } from './selectionViewDomain';
import { detailZoom } from './smoothZoomEngine';
import { machineryOpenAllTags, machineryOpenNextGroup, machineryOpenPrevGroup, machineryOpenUntagged } from './tagManagerDomain';
import { useBodyState } from '../store/bodyState';
import { useFolderState } from '../store/folderState';
import { useMiscRawState } from '../store/miscRawState';
import { usePreferencesState } from '../store/preferencesState';
import { useSelectionState } from '../store/selectionState';
import { writeScopeField } from './scopeFieldBridge';
/**
 * b1-9bv-A：mousetrap v1.6.3 自研替换（js/vendors/mousetrap.min.js 退役）。
 *
 * 契约 = 本仓消费面子集（考据定案见 PROGRESS P2-bv）：
 * - 全局 bind/unbind：dataMachinery initMousetrap 循环、detail/detailHooks ×3、
 *   preview-window usePreviewMousetrap；
 * - 元素实例 new Mousetrap(el) + bind/reset：useSelectAll / ContentEditable / Sidebar。
 * descope（全仓零消费）：sequences（空格序列）、trigger、addKeycodes、keyup action
 * 监听、stopCallback 覆写、handleKey 外部直调。unbind 取真删除（v1.6.3 为 bind noop
 * 覆盖，可观察语义等价：unbind 后按键无动作且不 prevent）。
 */

const SPECIAL_CODES: Record<number, string> = {
  8: 'backspace', 9: 'tab', 13: 'enter', 16: 'shift', 17: 'ctrl', 18: 'alt',
  20: 'capslock', 27: 'esc', 32: 'space', 33: 'pageup', 34: 'pagedown',
  35: 'end', 36: 'home', 37: 'left', 38: 'up', 39: 'right', 40: 'down',
  45: 'ins', 46: 'del', 91: 'meta', 93: 'meta', 224: 'meta',
};
for (let i = 1; i < 20; i++) SPECIAL_CODES[111 + i] = 'f' + i;
for (let i = 0; i <= 9; i++) SPECIAL_CODES[96 + i] = String(i);

const PUNCT_CODES: Record<number, string> = {
  106: '*', 107: '+', 109: '-', 110: '.', 111: '/', 186: ';', 187: '=',
  188: ',', 189: '-', 190: '.', 191: '/', 192: '`', 219: '[', 220: '\\',
  221: ']', 222: "'",
};

const SHIFT_SYMBOLS: Record<string, string> = {
  '~': '`', '!': '1', '@': '2', '#': '3', '$': '4', '%': '5', '^': '6',
  '&': '7', '*': '8', '(': '9', ')': '0', '_': '-', '+': '=', ':': ';',
  '"': "'", '<': ',', '>': '.', '?': '/', '|': '\\',
};

const ALIASES: Record<string, string> = {
  option: 'alt', command: 'meta', 'return': 'enter', escape: 'esc', plus: '+',
  mod: /Mac|iPod|iPhone|iPad/.test(navigator.platform) ? 'meta' : 'ctrl',
};

const MODIFIER_NAMES = ['shift', 'ctrl', 'alt', 'meta'];

/** v1.6.3 的 p 反查表排除 96-111 段（numpad 数字 96-105；106-111 本不在 special 表）——
 * '0'-'5' 星标键因此是 keypress，与 hardcoded 表行为逐键一致。 */
const ACTION_KEYDOWN_NAMES: Record<string, boolean> = {};
for (const codeStr of Object.keys(SPECIAL_CODES)) {
  const code = Number(codeStr);
  if (code > 95 && code < 112) continue;
  ACTION_KEYDOWN_NAMES[SPECIAL_CODES[code]] = true;
}

function keyFromEvent(event: any): string | null {
  if (event.type === 'keypress') {
    let ch = String.fromCharCode(event.which);
    if (!event.shiftKey) ch = ch.toLowerCase();
    return ch;
  }
  return SPECIAL_CODES[event.which] || PUNCT_CODES[event.which] ||
    String.fromCharCode(event.which).toLowerCase();
}

function modifiersFromEvent(event: any): string[] {
  const mods: string[] = [];
  if (event.shiftKey) mods.push('shift');
  if (event.altKey) mods.push('alt');
  if (event.ctrlKey) mods.push('ctrl');
  if (event.metaKey) mods.push('meta');
  return mods;
}

/** v1.6.3 D()：自 from 沿 parentNode 向上找 target；a===document 守卫先于 a===b 终止——
 * global 实例（target=document）恒 false（落到 INPUT 拦截检查），元素实例命中即 true
 * （实例内部 INPUT 不拦——useSelectAll 依赖此分叉）。 */
function isWithinTarget(from: Node | null, target: Node): boolean {
  if (from == null || from === document) return false;
  if (from === target) return true;
  return isWithinTarget(from.parentNode, target);
}

interface Binding {
  callback: (event: any, combo: string) => any;
  modifiers: string[];
  action: string;
  combo: string;
}

class Keymap {
  _target: any;
  _callbacks: Record<string, Binding[]>;

  constructor(target?: any) {
    this._target = target || document;
    this._callbacks = {};
    const handler = (event: any) => this._onKey(event);
    this._target.addEventListener('keypress', handler, false);
    this._target.addEventListener('keydown', handler, false);
  }

  private _onKey(event: any): void {
    if (typeof event.which !== 'number') event.which = event.keyCode;
    const key = keyFromEvent(event);
    if (key) this._dispatch(key, modifiersFromEvent(event), event);
  }

  private _dispatch(key: string, modifiers: string[], event: any): void {
    const list = this._callbacks[key];
    if (!list || !list.length) return;
    const modifierKey = modifiers.slice().sort().join(',');
    // keypress（无 meta/ctrl）跳过修饰匹配（v1.6.3 e2 短路语义）
    const looseModifiers = event.type === 'keypress' && !event.metaKey && !event.ctrlKey;
    const matched = list.filter((binding) => {
      if (binding.action !== event.type) return false;
      return looseModifiers || binding.modifiers.slice().sort().join(',') === modifierKey;
    });
    for (const binding of matched) {
      const target = event.target || event.srcElement;
      if (this.stopCallback(event, target)) return;
      if (binding.callback(event, binding.combo) === false) {
        if (event.preventDefault) event.preventDefault();
        if (event.stopPropagation) event.stopPropagation();
      }
    }
  }

  bind(combo: any, callback: any, action?: string): Keymap {
    const combos = combo instanceof Array ? combo : [combo];
    for (const single of combos) {
      const parsed = this.parse(single, action);
      // v1.6.3 rebind splice 语义：同 combo+action 覆盖旧回调
      this._callbacks[parsed.key] = (this._callbacks[parsed.key] || [])
        .filter((b) => !(b.combo === single && b.action === parsed.action));
      this._callbacks[parsed.key].push({
        callback, modifiers: parsed.modifiers, action: parsed.action, combo: single,
      });
    }
    return this;
  }

  unbind(combo: any, action?: string): Keymap {
    const combos = combo instanceof Array ? combo : [combo];
    for (const single of combos) {
      const parsed = this.parse(single, action);
      this._callbacks[parsed.key] = (this._callbacks[parsed.key] || [])
        .filter((b) => !(b.combo === single && b.action === parsed.action));
    }
    return this;
  }

  reset(): Keymap {
    this._callbacks = {};
    return this;
  }

  stopCallback(event: any, target: any): boolean {
    if (target && target.className && (' ' + target.className + ' ').indexOf(' mousetrap ') > -1) {
      return false;
    }
    if (target && isWithinTarget(target, this._target)) return false;
    let element = target;
    if (event && event.composedPath && typeof event.composedPath === 'function') {
      const path0 = event.composedPath()[0];
      if (path0 !== event.target) element = path0;
    }
    return !!element && (element.tagName === 'INPUT' || element.tagName === 'SELECT' ||
      element.tagName === 'TEXTAREA' || element.isContentEditable);
  }

  handleKey(key: string, modifiers: string[], event: any): void {
    this._dispatch(key, modifiers, event);
  }

  parse(combo: string, action?: string): { key: string; modifiers: string[]; action: string } {
    const parts = combo === '+' ? ['+'] : combo.replace(/\+{2}/g, '+plus').split('+');
    const modifiers: string[] = [];
    let key = '';
    for (const raw of parts) {
      let part = raw;
      if (ALIASES[part]) part = ALIASES[part];
      if (action && action !== 'keypress' && SHIFT_SYMBOLS[part]) {
        part = SHIFT_SYMBOLS[part];
        modifiers.push('shift');
      }
      if (MODIFIER_NAMES.indexOf(part) > -1) modifiers.push(part);
      key = part;
    }
    if (!action) action = ACTION_KEYDOWN_NAMES[key] ? 'keydown' : 'keypress';
    if (action === 'keypress' && modifiers.length) action = 'keydown';
    return { key, modifiers, action };
  }
}

/* v1.6.3 d.init()：document 全局实例的 prototype 方法复制为构造器 statics——
 * Mousetrap.bind(...) 全局面 + new Mousetrap(el) 元素实例双通道。 */
const globalTrap = new Keymap(document);
const Mousetrap: any = Keymap;
for (const name of ['bind', 'unbind', 'reset', 'stopCallback', 'handleKey']) {
  Mousetrap[name] = function (this: any, ...args: any[]) {
    return (globalTrap as any)[name].apply(globalTrap, args);
  };
}

let installed = false;

export function installKeymap(): void {
  if (installed) return;
  installed = true;
  const w = window as any;
  if (!w.Mousetrap) w.Mousetrap = Mousetrap;
}


// ═══ b1-9bz-D-1 B-5：零依赖声明归位（dataMachinery 剪出，逐字）═══
export function getPageDownHandlerFn(): any { return scopeSingleton('pageDownHandler', () => machineryPageDownHandler()); }

export function getPageUpHandlerFn(): any { return scopeSingleton('pageUpHandler', () => machineryPageUpHandler()); }

export function machineryBuildMousetrap(): any {
  const w = window as any;
  const bindings: any = {};

  // 建立快捷鍵名稱到處理函數的映射
  const shortcutHandlerMap: any = {
    'player.playAndPause': () => {
      machineryQuicklook();
    },
    'player.prev1frame': () => {
      machineryPrevGifFrame(1);
    },
    'player.next1frame': () => {
      machineryNextGifFrame(1);
    },
    'player.prev10frame': () => {
      machineryPrevGifFrame(10);
    },
    'player.next10frame': () => {
      machineryNextGifFrame(10);
    },
    'player.speed.up': () => {
      let playbackRates = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 3, 4, 8];
      if (useSelectionState.getState().current.ext == 'gif') {
        let currnt = useMiscRawState.getState().gifViewer.speed;
        let idx = playbackRates.indexOf(currnt);
        if (idx !== -1 && playbackRates[idx + 1]) {
          useMiscRawState.getState().gifViewer.setSpeed(playbackRates[idx + 1]);
        }
      }
    },
    'player.speed.down': () => {
      let playbackRates = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 3, 4, 8];
      if (useBodyState.getState().isDetailMode) {
        if (useSelectionState.getState().current.ext == 'gif') {
          let currnt = useMiscRawState.getState().gifViewer.speed;
          let idx = playbackRates.indexOf(currnt);
          if (idx !== -1 && playbackRates[idx - 1]) {
            useMiscRawState.getState().gifViewer.setSpeed(playbackRates[idx - 1]);
          }
        }
      }
    },
    'player.thumbnail.set': () => { }, // 不做任何事情，但需要把這個快速鍵還給其它有綁定的人
    'player.thumbnail.copy': () => { }, // 不做任何事情，但需要把這個快速鍵還給其它有綁定的人
    'player.thumbnail.save': () => { }, // 不做任何事情，但需要把這個快速鍵還給其它有綁定的人
  };

  // 從 preferences 載入快捷鍵
  if (w.preferences && w.preferences.shortcuts && w.preferences.shortcuts.keybinds && w.ShortcutManager) {
    for (const [keyName, electronKey] of Object.entries(w.preferences.shortcuts.keybinds)) {
      if (shortcutHandlerMap[keyName] && electronKey) {
        const mousetrapKey = w.ShortcutManager.electronToMousetrap(electronKey);
        if (mousetrapKey) {
          bindings[mousetrapKey] = shortcutHandlerMap[keyName];
          // console.log(`[Preview] Mapped ${keyName}: ${electronKey} -> ${mousetrapKey}`);
        }
      }
    }
  }

  // 添加硬編碼的快捷鍵（未在 preferences 中定義或沒有對應設定的）
  const hardcodedShortcuts: any = {
    '*': (folders: any, isExpand: any) => machineryToggleAllFolders(folders, isExpand),
    '/': (folders: any, isExpand: any) => machineryToggleAllFolders(folders, isExpand),
    '-': (event: any) => machineryZoomOut(event),
    '+': (event: any) => machineryZoomIn(event),
    '=': (event: any) => machineryZoomIn(event),
    '0': () => machineryRemoveStar(),
    '1': (event: any) => machineryChangeTo1Star(event),
    '2': (event: any) => machineryChangeTo2Star(event),
    '3': (event: any) => machineryChangeTo3Star(event),
    '4': (event: any) => machineryChangeTo4Star(event),
    '5': (event: any) => machineryChangeTo5Star(event),
    'r': () => machineryRefreshRandom(),
    't': () => machineryOpenInspectorTagSelectPanel(),
    'g': (event: any) => machineryOpenActionsPanel(event),
    'f': (event: any) => machineryOpenInspectorFolderSelectPanel(event),
    'j': (event: any) => machineryOpenQuickSearch(event),
    'n': ($event: any) => machineryNHandler($event),
    'm': ($event: any) => machineryMHandler($event),
    'mod+z': () => machineryUndo(),
    'mod+a': (event: any) => machinerySelectAll(event),
    'mod+c': (event: any) => machineryCopyImages(event),
    'mod+w': ($event: any) => machineryCloseWindowHandler($event),
    'space': (event: any) => machineryQuicklook(event),
    'shift+space': getPageUpHandlerFn(),
    'c': (event: any) => machineryKeyCHandler(event),
    'p': (event: any) => machineryKeyPHandler(event),
    'a': (event: any) => machineryKeyLeftHandler(event),
    'd': (event: any) => machineryKeyRightHandler(event),
    'w': (event: any) => machineryKeyUpHandler(event),
    's': (event: any) => machineryKeyDownHandler(event),
    'left': (event: any) => machineryKeyLeftHandler(event),
    'right': (event: any) => machineryKeyRightHandler(event),
    'up': (event: any) => machineryKeyUpHandler(event),
    'shift+up': (event: any) => machineryMultipleSelectUp(event),
    'down': (event: any) => machineryKeyDownHandler(event),
    'shift+down': (event: any) => machineryMultipleSelectDown(event),
    'shift+right': (event: any) => machineryMultipleSelectNext(event),
    'shift+left': (event: any) => machineryMultipleSelectPrev(event),
    'mod+up': (event: any) => machineryModUpHandler(event),
    'mod+down': (event: any) => machineryModDownHandler(event),
    'mod+left': (event: any) => machineryModLeftHandler(event),
    'mod+right': (event: any) => machineryModRightHandler(event),
    'mod+shift+up': (event: any) => machineryModShiftUpHandler(event),
    'mod+shift+down': (event: any) => machineryModShiftDownHandler(event),
    'mod+shift+left': (event: any) => machineryModShiftLeftHandler(event),
    'mod+shift+right': (event: any) => machineryModShiftRightHandler(event),
    'backspace': () => machineryBack(),
    'alt+right': () => machineryNextHistory(),
    'alt+left': () => machineryPrevHistory(),
    'mod+s': () => machinerySaveHandler(),
    '`': (event: any) => machineryToggleZoom(event),
    'mod++': (event: any) => machineryZoomIn(event),
    'mod+-': (event: any) => machineryZoomOut(event),
    'tab': ($event: any) => machineryToggleAll($event),
    'alt+up': () => machineryOpenParentFolder(),
    'alt+shift+n': (event: any) => machineryCreateTxtFileFromTemplate(event),
    'alt+shift+c': () => machinerySetFolderCover(),
    'enter': ($event: any, isInline: any) => machineryToggleDetailMode($event, isInline),
    'del': (event: any) => machineryRemoveSelected(event),
  };

  // 合併硬編碼快捷鍵（如果沒有被 preferences 覆蓋）
  for (const [key, handler] of Object.entries(hardcodedShortcuts)) {
    if (!bindings[key]) {
      bindings[key] = handler;
    }
  }

  // 處理 'mod+plus' 的特殊情況（確保 + 號的快捷鍵都能正常工作）
  if (bindings['mod+='] && !bindings['mod+plus']) {
    bindings['mod+plus'] = bindings['mod+='];
  }

  console.log('[App] Total mousetrap bindings:', Object.keys(bindings).length);
  return bindings;
}

export function machineryEndHandler(event: any): void {
  const w = window as any;
  if (useBodyState.getState().isDetailMode) {
    beginZoomingTransition();
    detailZoom()?.goToY( -99999999);
    detailZoom()?.moveY( -window.outerHeight + 60);
  }
  else {
    machineryGotoBottom();
  }
}

export function machineryHomeHandler(event: any): void {
  const w = window as any;
  if (useBodyState.getState().isDetailMode) {
    beginZoomingTransition();
    detailZoom()?.goToY( 40);
  }
  else {
    machineryGotoTop();
  }
}

/* destoryMousetrap（bundle 49316-49325 逐字；destory 原码 typo 逐字保留） */
/* initMousetrap（bundle 49326-49330 逐字） */
export function machineryInitMousetrap(): void {
  machineryDestoryMousetrap();
  writeScopeField('mousetrap', machineryBuildMousetrap());
  // b1-9av：mousetrap 绑定消费端补移植（bundle 49326-49341 逐字——原由 mgo-mousetrap
  // 指令 + 本函数双承载，Angular 消亡后 map 无人 bind，全键盘层死：Enter/方向键/Del/
  // Mod+Z/空格 quicklook 等）。applyWrapper 逐字：throttle 25 + $evalAsync。
  const w = window as any;
  const Mousetrap = w.Mousetrap;
  if (!Mousetrap || !useMiscRawState.getState().mousetrap) return;
  const applyWrapper = function (func: any) {
    return w.throttle(function (e: any) {
      func(e);
    }, 25);
  };
  for (var key in useMiscRawState.getState().mousetrap) {
    if (useMiscRawState.getState().mousetrap.hasOwnProperty(key)) {
      Mousetrap.unbind(key);
      Mousetrap.bind(key, applyWrapper(useMiscRawState.getState().mousetrap[key]));
    }
  }
}

/* keyCHandler（bundle 35099-35103 逐字）、keyPHandler（35104-35106 逐字） */
export function machineryKeyCHandler(event: any): void {
  if (useBodyState.getState().isInlineMode) return;
  if (useBodyState.getState().isDetailMode) {
    machineryToggleCommentMode(event);
  }
}

export function machineryKeyDownHandler(event: any): void {
  const w = window as any;
  event && event.preventDefault();
  if (qa(".swal2-container").length > 0) return;
  if (useBodyState.getState().currentFocus == "content") {
    if (useBodyState.getState().isDetailMode && !useBodyState.getState().isInlineMode) {
      if (useBodyState.getState().isCropMode) {
        moveCropToolChannel.emit({ horizontal: 0, vertical: 1 });
        return;
      }
      else {
        detailZoom()?.moveY( 150);
      }
    } else {
      machinerySelectDown(event);
    }
  }
  else if (useBodyState.getState().currentFocus == "sidebar") {
    writeScopeField('selectedFolders', []);
    syncListFromScope();
    writeScopeField('selectedFoldersMappings', {});
    writeScopeField('selectedSmartFoldersMappings', {});
    writeScopeField('selectedSmartFolders', []);
    if (useBodyState.getState().viewMode == "all") {
      if (usePreferencesState.getState().preferences.sidebar.unfiled != 'false') {
        machineryOpenUnfiled();
      }
      else if (usePreferencesState.getState().preferences.sidebar.untagged != 'false') {
        machineryOpenUntagged();
      }
      else if (usePreferencesState.getState().preferences.sidebar.recent != 'false') {
        machineryOpenRecent();
      }
      else if (usePreferencesState.getState().preferences.sidebar.random != 'false') {
        machineryOpenRandom();
      }
      else if (usePreferencesState.getState().preferences.sidebar.community2 != 'false') {
        machineryOpenCommunity();
      }
      else {
        machineryOpenAllTags();
      }
    }
    else if (useBodyState.getState().viewMode == "unfiled") {
      if (usePreferencesState.getState().preferences.sidebar.untagged != 'false') {
        machineryOpenUntagged();
      }
      else if (usePreferencesState.getState().preferences.sidebar.recent != 'false') {
        machineryOpenRecent();
      }
      else if (usePreferencesState.getState().preferences.sidebar.random != 'false') {
        machineryOpenRandom();
      }
      else if (usePreferencesState.getState().preferences.sidebar.community2 != 'false') {
        machineryOpenCommunity();
      }
      else {
        machineryOpenAllTags();
      }
    }
    else if (useBodyState.getState().viewMode == "untagged") {
      if (usePreferencesState.getState().preferences.sidebar.recent != 'false') {
        machineryOpenRecent();
      }
      else if (usePreferencesState.getState().preferences.sidebar.random != 'false') {
        machineryOpenRandom();
      }
      else if (usePreferencesState.getState().preferences.sidebar.community2 != 'false') {
        machineryOpenCommunity();
      }
      else {
        machineryOpenAllTags();
      }
    }
    else if (useBodyState.getState().viewMode == "recent") {
      if (usePreferencesState.getState().preferences.sidebar.random != 'false') {
        machineryOpenRandom();
      }
      else if (usePreferencesState.getState().preferences.sidebar.community2 != 'false') {
        machineryOpenCommunity();
      }
      else {
        machineryOpenAllTags();
      }
    }
    else if (useBodyState.getState().viewMode == "random") {
      if (usePreferencesState.getState().preferences.sidebar.community2 != 'false') {
        machineryOpenCommunity();
      }
      else {
        machineryOpenAllTags();
      }
    }
    else if (useBodyState.getState().viewMode == "community") {
      machineryOpenAllTags();
    }
    else if (useBodyState.getState().viewMode == "alltags") { machineryOpenTrash() } else if (useBodyState.getState().viewMode == "trash") {

      var listItems = useMiscRawState.getState().sidebarList;
      var folders = listItems.filter(function (item: any) {
        return item.vstype === 'folder';
      });
      var smartFolders = listItems.filter(function (item: any) {
        return item.vstype === 'smartFolder' || item.vstype === 'smartFolderGroup';
      });
      var quickAccessItems = listItems.filter(function (item: any) {
        return item.vstype === 'quickAccess';
      });
      if (quickAccessItems.length > 0) {
        clickEl("#quick-access-" + quickAccessItems[0].id);
      }
      else if (smartFolders.length > 0 && smartFolders[0]) {
        openSmartFolder(smartFolders[0]);
      }
      else if (folders.length > 0 && folders[0]) {
        openFolder(folders[0]);
      }
    }
    else {
      if (useMiscRawState.getState().currentId.indexOf("smart-folder") > -1) {
        machineryOpenNextSmartFolder();
      }
      else if (useMiscRawState.getState().currentId.indexOf("quick") > -1) {
        machineryOpenNextQuickAccess();
      }
      else if (useMiscRawState.getState().currentId.indexOf("folder") > -1) {
        machineryOpenNextFolder();
      }
    }
  }
  else if (useBodyState.getState().currentFocus == "tags") {
    machineryOpenNextGroup();
  }
}

export function machineryKeyLeftHandler(event: any): void {
  const w = window as any;
  event && event.preventDefault();
  if (qa(".swal2-container").length > 0) return;
  if (useBodyState.getState().currentFocus == "content") {
    machinerySelectPrev(event);
  }
  else if (useBodyState.getState().currentFocus == "tags") {
    writeScopeField('currentFocus', "sidebar");
  }
  else {
    if (useMiscRawState.getState().selectedFolders.length > 1) {
      useMiscRawState.getState().selectedFolders.forEach(function (folder: any) {
        if (folder.children && folder.children.length > 0) {
          if (folder.isExpand !== false) {
            folder.isExpand = false;
            w.localStorage.setItem("eagle.sidebar.folder.expand." + folder.id, false);
          }
        }
      });
      machineryUpdateSidebarList();
    }
    else if (useFolderState.getState().currentFolder) {
      if (!useFolderState.getState().currentFolder.children || useFolderState.getState().currentFolder.children.length == 0) {
        useFolderState.getState().currentFolder.isExpand = true;
        machineryUpdateSidebarList();
      }
      else {
        useFolderState.getState().currentFolder.isExpand = false;
        machineryUpdateSidebarList();
      }
      w.localStorage.setItem("eagle.sidebar.folder.expand." + useFolderState.getState().currentFolder.id, false);
    }
    else if (useFolderState.getState().currentSmartFolder) {
      if (!useFolderState.getState().currentSmartFolder.children || useFolderState.getState().currentSmartFolder.children.length == 0) {
        useFolderState.getState().currentSmartFolder.isExpand = true;
        machineryUpdateSidebarList();
      }
      else {
        useFolderState.getState().currentSmartFolder.isExpand = false;
        machineryUpdateSidebarList();
      }
      w.localStorage.setItem("eagle.sidebar.smartFolder.expand." + useFolderState.getState().currentSmartFolder.id, false);
    }
  }
}

export function machineryKeyPHandler(event: any): void {
  machineryOpenPluginPanel(event);
}

export function machineryKeyRightHandler(event: any): void {
  const w = window as any;
  event && event.preventDefault();
  if (qa(".swal2-container").length > 0) return;
  if (useBodyState.getState().currentFocus == "content") {
    machinerySelectNext(event);
  }
  else {
    if (useMiscRawState.getState().selectedFolders.length > 1) {
      useMiscRawState.getState().selectedFolders.forEach(function (folder: any) {
        if (folder.children && folder.children.length > 0) {
          if (folder.isExpand !== true) {
            folder.isExpand = true;
            w.localStorage.setItem("eagle.sidebar.folder.expand." + folder.id, true);
          }
        }
      });
      machineryUpdateSidebarList();
    }
    else if (useFolderState.getState().currentFolder) {
      useFolderState.getState().currentFolder.isExpand = true;
      machineryUpdateSidebarList();
      w.localStorage.setItem("eagle.sidebar.folder.expand." + useFolderState.getState().currentFolder.id, true);
    }
    else if (useFolderState.getState().currentSmartFolder) {
      useFolderState.getState().currentSmartFolder.isExpand = true;
      machineryUpdateSidebarList();
      w.localStorage.setItem("eagle.sidebar.smartFolder.expand." + useFolderState.getState().currentSmartFolder.id, true);
    }
    else if (useBodyState.getState().viewMode == "alltags") {
      writeScopeField('currentFocus', "tags");
    }
  }
}

export function machineryKeyUpHandler(event: any): void {
  const w = window as any;
  event && event.preventDefault();
  if (qa(".swal2-container").length > 0) return;
  if (useBodyState.getState().currentFocus == "content") {
    if (useBodyState.getState().isDetailMode && !useBodyState.getState().isInlineMode) {
      if (useBodyState.getState().isCropMode) {
        moveCropToolChannel.emit({ horizontal: 0, vertical: -1 });
        return;
      }
      else {
        detailZoom()?.moveY( -150);
      }
    } else {
      machinerySelectUp(event);
    }
  }
  else if (useBodyState.getState().currentFocus == "sidebar") {
    writeScopeField('selectedFolders', []);
    syncListFromScope();
    writeScopeField('selectedFoldersMappings', {});
    writeScopeField('selectedSmartFoldersMappings', {});
    writeScopeField('selectedSmartFolders', []);
    if (useBodyState.getState().viewMode == "all") { } else if (useBodyState.getState().viewMode == "unfiled") { machineryOpenAll() }
      else if (useBodyState.getState().viewMode == "untagged") {
        if (usePreferencesState.getState().preferences.sidebar.unfiled != 'false') {
          machineryOpenUnfiled();
        }
        else {
          machineryOpenAll();
        }
      }
      else if (useBodyState.getState().viewMode == "recent") {
        if (usePreferencesState.getState().preferences.sidebar.untagged != 'false') {
          machineryOpenUntagged();
        }
        else if (usePreferencesState.getState().preferences.sidebar.unfiled != 'false') {
          machineryOpenUnfiled();
        }
        else {
          machineryOpenAll();
        }
      }
      else if (useBodyState.getState().viewMode == "random") {
        if (usePreferencesState.getState().preferences.sidebar.recent != 'false') {
          machineryOpenRecent();
        }
        else if (usePreferencesState.getState().preferences.sidebar.untagged != 'false') {
          machineryOpenUntagged();
        }
        else if (usePreferencesState.getState().preferences.sidebar.unfiled != 'false') {
          machineryOpenUnfiled();
        }
        else {
          machineryOpenAll();
        }
      }
      else if (useBodyState.getState().viewMode == "community") {
        if (usePreferencesState.getState().preferences.sidebar.random != 'false') {
          machineryOpenRandom();
        }
        else if (usePreferencesState.getState().preferences.sidebar.recent != 'false') {
          machineryOpenRecent();
        }
        else if (usePreferencesState.getState().preferences.sidebar.untagged != 'false') {
          machineryOpenUntagged();
        }
        else if (usePreferencesState.getState().preferences.sidebar.unfiled != 'false') {
          machineryOpenUnfiled();
        }
        else {
          machineryOpenAll();
        }
      }
      else if (useBodyState.getState().viewMode == "alltags") {
        if (usePreferencesState.getState().preferences.sidebar.community2 != 'false') {
          machineryOpenCommunity();
        }
        else if (usePreferencesState.getState().preferences.sidebar.random != 'false') {
          machineryOpenRandom();
        }
        else if (usePreferencesState.getState().preferences.sidebar.recent != 'false') {
          machineryOpenRecent();
        }
        else if (usePreferencesState.getState().preferences.sidebar.untagged != 'false') {
          machineryOpenUntagged();
        }
        else if (usePreferencesState.getState().preferences.sidebar.unfiled != 'false') {
          machineryOpenUnfiled();
        }
        else {
          machineryOpenAll();
        }
      }
      else if (useBodyState.getState().viewMode == "trash") {
        machineryOpenAllTags()
      }
      else {
        if (useMiscRawState.getState().currentId) {
          if (useMiscRawState.getState().currentId.indexOf("smart-folder") > -1) {
            machineryOpenPrevSmartFolder();
          }
          else if (useMiscRawState.getState().currentId.indexOf("quick") > -1) {
            machineryOpenPrevQuickAccess();
          }
          else if (useMiscRawState.getState().currentId.indexOf("folder") > -1) {
            machineryOpenPrevFolder();
          }
        }
      }
  }
  else if (useBodyState.getState().currentFocus == "tags") {
    machineryOpenPrevGroup();
  }
}

export function machineryModDownHandler(event: any): void {
  if (useBodyState.getState().isCropMode) {
    event && event.preventDefault();
    resizeCropToolChannel.emit({
      horizontal: 0,
      vertical: 1
    });
    return;
  }
  else {
    machineryEndHandler(event);
  }
}

export function machineryModLeftHandler(event: any): void {
  event && event.preventDefault();
  if (useBodyState.getState().isDetailMode) {
    if (useBodyState.getState().isCropMode) {
      resizeCropToolChannel.emit({
        horizontal: -1,
        vertical: 0
      });
      return;
    }
  }
  else {
    machineryPrevHistory(event);
  }
}

export function machineryModRightHandler(event: any): void {
  event && event.preventDefault();
  if (useBodyState.getState().isDetailMode) {
    if (useBodyState.getState().isCropMode) {
      resizeCropToolChannel.emit({
        horizontal: 1,
        vertical: 0
      });
      return;
    }
  }
  else {
    machineryNextHistory(event);
  }
}

export function machineryModUpHandler(event: any): void {
  if (useBodyState.getState().isCropMode) {
    event && event.preventDefault();
    resizeCropToolChannel.emit({
      horizontal: 0,
      vertical: -1
    });
    return;
  }
  else {
    machineryHomeHandler(event);
  }
}

export function machineryNHandler($event: any): void {
  const w = window as any;
  if (!useBodyState.getState().isDetailMode) {
    return;
  }
  if (w.VIDEO_TYPES[useSelectionState.getState().current.ext] || w.AUDIO_TYPES[useSelectionState.getState().current.ext]) {
    var video = q(".detail-wrap video") || q(".detail-wrap mpv-video");
    if (video) {
      machineryAddVideoComment(useSelectionState.getState().current, video);
    }
  }
}

export function machineryPageDownHandler(): any {
  const w = window as any;
  return throttle(function (event: any) {
    var offset = window.innerHeight - 72;
    if (useBodyState.getState().isDetailMode) {
      detailZoom()?.moveY( offset);
    }
    else {
      var scrollTop = scrollTopValue(".box-container");
      machineryScrollbarTo(q(".box-container"), scrollTop + offset * 1, 100);
    }
  }, 100, true);
}

/* pageUpHandler（bundle 35691-35702 逐字：含 prepend 触发面 ig.trigger("prepend")） */
export function machineryPageUpHandler(): any {
  const w = window as any;
  return throttle(function (event: any) {
    var offset = window.innerHeight - 72;
    if (useBodyState.getState().isDetailMode) {
      detailZoom()?.moveY( -offset);
    }
    else {
      var scrollTop = scrollTopValue(".box-container");
      machineryScrollbarTo(q(".box-container"), scrollTop - offset * 1, 100);
      setTimeout(function () {
        if (useFolderState.getState().startCursor !== 0 && scrollTopValue("#box-container") === 0) {
          w.ig.trigger("prepend");
        }
      }, 200);
    }
  }, 100, true);
}

/* saveHandler（bundle 35985-35991 逐字：crop 模式 saveCrop；saveCrop 经 scope 解析） */
export function machinerySaveHandler(): void {
  if (useMiscRawState.getState().isRotating) return;
  if (useBodyState.getState().isCropMode) {
    saveCrop();
  }
}
