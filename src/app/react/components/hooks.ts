import { useEffect, useRef } from 'react';
import { getBodyScope, scopeApply } from '../global/scopeBridge';

/** tippy 指令移植（bundle:17365）：对子树内 [tippy][tippy-content] 元素初始化 tooltip。 */
export function useTippy(ref: React.RefObject<HTMLElement | null>, dep: unknown) {
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const tippy = (window as any).tippy;
    if (!tippy) return;
    const instances: Array<any> = [];
    root.querySelectorAll<HTMLElement>('[tippy][tippy-content]').forEach((el) => {
      // 原 Angular 指令逐元素初始化：一颗失败（如隐藏元素的 tippy() 抛错）不得中断兄弟按钮
      try {
        const content = el.getAttribute('tippy-content') || '';
        const instance = tippy(el, {
          animation: 'scale',
          arrow: false,
          content,
          placement: (el.getAttribute('tippy-placement') as any) || 'right',
          allowHTML: true,
        });
        (instance as any)._eagleContent = content;
        instances.push(instance);
      } catch (err) {
        console.warn('[eagle-use-tippy] mount failed for element', err);
      }
    });
    return () => instances.forEach((instance) => instance.destroy());
  }, [dep]);
}

/** selectAll 指令移植（bundle:70600）：Mousetrap mod+a 全选 / esc 失焦。 */
export function useSelectAll(ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const Mousetrap = (window as any).Mousetrap;
    if (!Mousetrap) return;
    const trap = new Mousetrap(el);
    trap.bind('mod+a', (event: any) => {
      event && event.stopPropagation();
      (el as unknown as HTMLInputElement).select();
    });
    trap.bind('esc', (event: any) => {
      event && event.stopPropagation();
      (el as HTMLElement).blur();
    });
    return () => {
      try { trap.reset(); } catch {}
    };
  }, []);
}

/** 在 Angular scope 上下文中调用函数（ng-click 语义）。 */
export const callScope = (fn: string, ...args: any[]) => (e: any) =>
  scopeApply(getBodyScope(), (scope) => {
    if (typeof scope[fn] === 'function') scope[fn](...(args.length ? args : [e]));
  });
