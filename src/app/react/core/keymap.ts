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
