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

// c3：React 侧已移植的 controller 函数表（逐字，操作同一 scope）——b1-9bz-A 起为指针注册表
// （fns["NAME"] = 落点导出），b1-9bz-B 起消费方全部直 import，本表仅剩 shim 挂载 +
// 测试契约；cZ 状态迁入 AppCore 后随 bz-C 一并删除。
import { makeControllerFns } from '../core/controllerFns';
import { getBodyScope } from '../core/appCore';
let coreFnsCache: Record<string, any> | null = null;
function getCoreFns(): Record<string, any> {
  if (coreFnsCache === null) {
    try {
      coreFnsCache = makeControllerFns(getBodyScope);
    } catch (err) {
      console.error('[core-fns] init failed', err);
      coreFnsCache = {};
    }
  }
  return coreFnsCache!;
}
// c3 测试契约：闭环测试经此直接访问已移植函数表（Routing 证明用）。
try {
  (window as any).__eagleCoreFns = getCoreFns();
} catch (err) { /* scope 未就绪时静默跳过；表本身不依赖 scope，makeControllerFns 只吃 getBodyScope 注入 */ }

/* b1-9bz-B：callScope 字符串派发退役——20 个消费点（BodyBindings 3 / LockScreens 7 /
   ProgressBars 1 / ToastAlerts 4 / BoxList callFn 4 名 + 派发器本身）已全部改为落点导出
   直 import + scopeApply（表项本就是这些导出的指针，同对象调用，零行为变化）。
   摘除后本文件只剩测试契约用的 __eagleCoreFns（stage1c3/probe-filter-toggle 的「表在位」
   证明随 bz-C 一起改写）。 */
