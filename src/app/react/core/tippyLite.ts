/**
 * b1-9bx-A：tippy v6.3.7 自研替换（js/vendors/tippy.js 退役）。
 *
 * 契约 = 本仓消费面（考据定案见 PROGRESS P3-bx）：tippy(el, options) 构造 +
 * instance.destroy()（零其他实例方法）；options = content/placement/animation
 * ('scale' 纯 data 属性——vendor 无 scale keyframes)/arrow:false/allowHTML:true；
 * DOM = div[data-tippy-root] > .tippy-box[data-placement^=X][data-animation][data-state]
 * > .tippy-arrow? + .tippy-content；trigger = mouseenter/focus show、mouseleave/blur
 * hide；appendTo = document.body（v6 non-interactive 默认）；css 1,289B 逐字注入。
 * descope（全仓零消费）：插件四件、singleton/delegate/hideAll、popper.js 定位引擎
 * （本实现用原生 floating 算法替代——getBoundingClientRect + viewport clamp）、
 * 选择器/NodeList 入参（消费面恒单元素，仅留 Element 单元路径 + 字符串兜底）。
 * 单例幂等：el._tippy 已存在先 destroy 再建（v6 重复建会双实例——font-viewer 的
 * 重复调用在 vendor 下本就是双 popper 缺陷，本实现收敛为内容更新语义）。
 */

const _w: any = window as any;

let installed = false;

/* vendor v6.3.7 运行时注入 css 逐字（var css 字面量） */
const TIPPY_CSS = '.tippy-box[data-animation=fade][data-state=hidden]{opacity:0}[data-tippy-root]{max-width:calc(100vw - 10px)}.tippy-box{position:relative;background-color:#333;color:#fff;border-radius:4px;font-size:14px;line-height:1.4;white-space:normal;outline:0;transition-property:transform,visibility,opacity}.tippy-box[data-placement^=top]>.tippy-arrow{bottom:0}.tippy-box[data-placement^=top]>.tippy-arrow:before{bottom:-7px;left:0;border-width:8px 8px 0;border-top-color:initial;transform-origin:center top}.tippy-box[data-placement^=bottom]>.tippy-arrow{top:0}.tippy-box[data-placement^=bottom]>.tippy-arrow:before{top:-7px;left:0;border-width:0 8px 8px;border-bottom-color:initial;transform-origin:center bottom}.tippy-box[data-placement^=left]>.tippy-arrow{right:0}.tippy-box[data-placement^=left]>.tippy-arrow:before{border-width:8px 0 8px 8px;border-left-color:initial;right:-7px;transform-origin:center left}.tippy-box[data-placement^=right]>.tippy-arrow{left:0}.tippy-box[data-placement^=right]>.tippy-arrow:before{left:-7px;border-width:8px 8px 8px 0;border-right-color:initial;transform-origin:center right}.tippy-box[data-inertia][data-state=visible]{transition-timing-function:cubic-bezier(.54,1.5,.38,1.11)}.tippy-arrow{width:16px;height:16px;color:#333}.tippy-arrow:before{content:"";position:absolute;border-color:transparent;border-style:solid}.tippy-content{position:relative;padding:5px 9px;z-index:1}';

interface TippyOptions {
  content?: any;
  placement?: string;
  animation?: string;
  arrow?: boolean;
  allowHTML?: boolean;
  [key: string]: any;
}

interface TippyInstance {
  reference: HTMLElement;
  popper: HTMLElement;
  props: TippyOptions;
  destroy: () => void;
}

function createTippy(reference: HTMLElement, options: TippyOptions): TippyInstance {
  const existing = (reference as any)._tippy as TippyInstance | undefined;
  if (existing) existing.destroy();

  const popper = document.createElement('div');
  popper.setAttribute('data-tippy-root', '');
  const box = document.createElement('div');
  box.className = 'tippy-box';
  box.setAttribute('data-animation', options.animation || 'fade');
  box.setAttribute('data-state', 'hidden');
  const placement = options.placement || 'top';
  box.setAttribute('data-placement', placement);
  box.setAttribute('role', 'tooltip');
  if (options.arrow !== false) {
    const arrow = document.createElement('div');
    arrow.className = 'tippy-arrow';
    box.appendChild(arrow);
  }
  const content = document.createElement('div');
  content.className = 'tippy-content';
  if (options.allowHTML) content.innerHTML = options.content == null ? '' : String(options.content);
  else content.textContent = options.content == null ? '' : String(options.content);
  box.appendChild(content);
  popper.appendChild(box);
  popper.style.position = 'fixed';
  popper.style.visibility = 'hidden';
  popper.style.pointerEvents = 'none';
  popper.style.zIndex = '9999999';
  document.body.appendChild(popper);

  /* 原生定位：placement 四向（含 -start/-end 对齐）+ 主轴 10px（vendor offset [0,10]）+
   * viewport 8px clamp。popper 为 fixed（viewport 坐标与 getBoundingClientRect 同系）。 */
  const position = () => {
    const r = reference.getBoundingClientRect();
    const pw = popper.offsetWidth;
    const ph = popper.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const GAP = 10;
    const [base, align] = placement.split('-');
    let x = 0, y = 0;
    if (base === 'top') {
      x = r.left + r.width / 2 - pw / 2;
      y = r.top - ph - GAP;
    } else if (base === 'bottom') {
      x = r.left + r.width / 2 - pw / 2;
      y = r.bottom + GAP;
    } else if (base === 'left') {
      x = r.left - pw - GAP;
      y = r.top + r.height / 2 - ph / 2;
    } else {
      x = r.right + GAP;
      y = r.top + r.height / 2 - ph / 2;
    }
    if (align === 'start') {
      if (base === 'top' || base === 'bottom') x = r.left;
      else y = r.top;
    } else if (align === 'end') {
      if (base === 'top' || base === 'bottom') x = r.right - pw;
      else y = r.bottom - ph;
    }
    if (x < 8) x = 8;
    if (x + pw > vw - 8) x = vw - 8 - pw;
    if (y < 8) y = 8;
    if (y + ph > vh - 8) y = vh - 8 - ph;
    popper.style.left = Math.round(x) + 'px';
    popper.style.top = Math.round(y) + 'px';
  };

  let visible = false;
  const show = () => {
    if (visible) return;
    visible = true;
    position();
    box.setAttribute('data-state', 'visible');
    popper.style.visibility = '';
  };
  const hide = () => {
    if (!visible) return;
    visible = false;
    box.setAttribute('data-state', 'hidden');
    popper.style.visibility = 'hidden';
  };

  const onEnter = () => show();
  const onLeave = () => hide();
  reference.addEventListener('mouseenter', onEnter);
  reference.addEventListener('focus', onEnter);
  reference.addEventListener('mouseleave', onLeave);
  reference.addEventListener('blur', onLeave);

  const instance: TippyInstance = {
    reference,
    popper,
    /* v6 实例面镜像：tests/react-stage9a3-smoke 断言 instance.props.content——
       消费面仅此一处实例属性读取，镜像全 options 即可 */
    props: Object.assign({}, options) as any,
    destroy() {
      reference.removeEventListener('mouseenter', onEnter);
      reference.removeEventListener('focus', onEnter);
      reference.removeEventListener('mouseleave', onLeave);
      reference.removeEventListener('blur', onLeave);
      if (popper.parentNode) popper.parentNode.removeChild(popper);
      delete (reference as any)._tippy;
    },
  };
  (reference as any)._tippy = instance;
  return instance;
}

function tippy(targets: any, options?: TippyOptions): any {
  if (typeof targets === 'string') {
    return Array.from(document.querySelectorAll(targets)).map((el) => createTippy(el as HTMLElement, options || {}));
  }
  if (targets instanceof Element) return createTippy(targets as HTMLElement, options || {});
  return null;
}

export function installTippy(): void {
  if (installed) return;
  installed = true;
  if (!document.getElementById('eagle-tippy-css')) {
    const style = document.createElement('style');
    style.id = 'eagle-tippy-css';
    style.textContent = TIPPY_CSS;
    document.head.appendChild(style);
  }
  if (!_w.tippy) _w.tippy = tippy;
}
