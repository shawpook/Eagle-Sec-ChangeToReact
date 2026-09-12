/**
 * b1-9bz-C-4：selected 变更订阅中心（**零依赖叶子模块**）。
 *
 * 背景：selectionViewDomain 与 InspectorTagSelectPanel 原各用 $watchCollection('selected')，
 * 依赖 scopeShim 的 watcher + digest flush。改为本模块的**自建 200ms 轮询**（与 shim
 * ensureFlushTimer 同频）+ 订阅分发：轮询不在 scopeShim 里，删 shim 后仍然工作。
 *
 * 之所以独立成文件（而不是放在 selectionViewDomain / dataMachinery）：
 * - 放 dataMachinery：核心模块任何改动都可能改变 ESM 求值顺序，实测会让启动加载链断；
 * - 放 selectionViewDomain：组件反向 import 域模块会拉偏模块图（实测 stage-smoke 的
 *   theme 断言稳定失败）。叶子模块零依赖，谁 import 都安全。
 */
import { getBodyScope } from './appCore';
import { useSelectionState } from '../store/selectionState';

type Listener = (s: any, oldValue: any[]) => void;

const listeners = new Set<Listener>();
let prev: any[] = [];
let timer: any = null;

function sameSelection(a: any[], b: any[]): boolean {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if ((a[i] && a[i].id) !== (b[i] && b[i].id)) return false;
  }
  return true;
}

function ensurePoll(): void {
  if (timer) return;
  const sv: any = getBodyScope();
  prev = (sv && useSelectionState.getState().selected) ? useSelectionState.getState().selected.slice() : [];
  timer = setInterval(() => {
    const s: any = getBodyScope();
    if (!s) return;
    const cur: any[] = useSelectionState.getState().selected || [];
    if (sameSelection(cur, prev)) return;
    const oldValue = prev;
    prev = cur.slice();
    for (const fn of Array.from(listeners)) {
      try { fn(s, oldValue); } catch (err) { /* noop */ }
    }
  }, 200);
}

/** 订阅 selected 变化；返回退订函数。 */
export function onSelectedChanged(fn: Listener): () => void {
  listeners.add(fn);
  ensurePoll();
  return () => { listeners.delete(fn); };
}

/** 诊断：当前订阅数（测试/CI 观测面）。 */
export function selectedListenerCount(): number {
  return listeners.size;
}
