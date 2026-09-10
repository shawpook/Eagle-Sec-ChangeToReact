import { useEffect, useRef } from 'react';

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

/* b1-9bz-B-8：controllerFns fns 表与 callScope 派发均已退役。
   表体归位（b1-9bz-A）后消费面全部直 import，本文件不再持有任何函数表镜像；
   测试观测钩子移至 core/portsProbe.ts。 */

/* b1-9bz-B：callScope 字符串派发退役——20 个消费点（BodyBindings 3 / LockScreens 7 /
   ProgressBars 1 / ToastAlerts 4 / BoxList callFn 4 名 + 派发器本身）已全部改为落点导出
   直 import + scopeApply（表项本就是这些导出的指针，同对象调用，零行为变化）。
   b1-9bz-B-8：测试契约用的 __eagleCoreFns 亦已随 fns 表退役，观测钩子移至
   core/portsProbe.ts（窄口径、无运行期供给语义）。 */
