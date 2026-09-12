import { glRemoveitemsChannel, glResetChannel, glScrolltotopChannel } from '../../global/bus';
import { machineryRelayout, machineryScrollbarTo } from '../../services/gridService';
import { useMiscRawState } from '../../store/miscRawState';
/**
 * b1-9be2：内容网格引擎 —— @egjs/react-infinitegrid v4 renderer 交换（v3 vanilla 退役）。
 *
 * 原实现（ngGridLayout 指令逐字移植）= DOMParser 模板字符串 + v3 append/prepend 分页 +
 * layoutComplete 补类。v4 交换后：
 *  - 条目渲染 = React children（BoxItem，虚拟化由 v4 visible-children 承担）
 *  - 分页模型 = v4 内建 requestAppend/requestPrepend 虚拟滚动（不再需要 v3 的组页机制）
 *  - window.ig facade 保留（25 处既有消费面零改动）：remove/getItems/clear/trigger/
 *    layout/getGroupKeys/_layout._columnLength —— 逐项委托 v4 ref 或模块内等效实现
 *  - resetNgGridLayoutData / gl:* 事件 / window.NgGridStrings 全局契约保留
 *
 * DOM 契约：#box-list 由 BoxList.tsx 挂 v4 组件（wrapper→container 双层），条目绝对定位
 * transform 由 v4 ItemRenderer 写入（与 v3 同为 absolute + translate 模型）。
 */


type EngineState = {
  items: any[];
  startCursor: number;
  startGroupKey: number;
  scrollPercentage: number | null;
  version: number;
};

let state: EngineState = { items: [], startCursor: 0, startGroupKey: 1000000, scrollPercentage: null, version: 0 };
let engineListeners: Array<() => void> = [];

/** BoxList 订阅引擎状态变化（items/布局/页游标），驱动 v4 children 重建。 */
export function subscribeEngine(fn: () => void): () => void {
  engineListeners.push(fn);
  return () => {
    engineListeners = engineListeners.filter((f) => f !== fn);
  };
}

export function getEngineState(): EngineState {
  return state;
}

function notify() {
  state.version++;
  engineListeners.forEach((f) => { try { f(); } catch (err) {} });
}

/* ---------- v4 ref 桥（BoxList 在 v4 挂载后注册） ---------- */

type GridRef = any;
let gridRef: GridRef = null;

export function registerGridRef(ref: GridRef): void {
  gridRef = ref;
  (window as any).__v4grid = ref;
  installFacade();
}

function visibleEls(): HTMLElement[] {
  if (!gridRef) return [];
  const container = gridRef.getContainerElement ? gridRef.getContainerElement() : null;
  if (!container) return [];
  return Array.from(container.querySelectorAll('.box[data-box-id]')) as HTMLElement[];
}

function itemInfosOf(): Array<{ id: string; el: HTMLElement; groupKey: number }> {
  // v4 getItems() 返回 GridItem[]（.contents/.groupKey）；React 世界元素从 DOM 容器反查
  // —— id/el/groupKey 三元组与 v3 fork 的 Item 形状对齐（消费面只读这些字段）。
  return visibleEls().map((el) => ({
    id: el.getAttribute('data-box-id') || '',
    el,
    groupKey: Number(el.getAttribute('data-grid-groupkey') || 0),
  }));
}

/** 页游标：当前首组 groupKey（v3 getGroupKeys 语义 = 已挂组的组号数组）。 */
function groupKeys(): number[] {
  const keys = new Set<number>();
  visibleEls().forEach((el) => {
    const k = el.getAttribute('data-grid-groupkey');
    if (k !== null) keys.add(Number(k));
  });
  return Array.from(keys).sort((a, b) => a - b);
}

/* ---------- window.ig facade（v3 API 面 → v4/模块实现） ---------- */

function installFacade() {
  const w = window as any;
  const facade: any = {
    // remove(el)：v3 接受 Item 或 Element —— v4 消费面两型都传过（FolderModals 传 box 元素，
    // itemDomain 传 $("#box-..")[0]）；引擎侧统一按元素从 items 剔除 + notify。
    remove(target: any) {
      const el: HTMLElement | null = target && target.nodeType === 1 ? target : target && target.el;
      if (!el || !el.getAttribute) return;
      const id = el.getAttribute && el.getAttribute('data-box-id');
      if (!id) return;
      const idx = state.items.findIndex((it) => it.id === id);
      if (idx > -1) state.items.splice(idx, 1);
      const lzm = useMiscRawState.getState().lazyLoadManager;
      if (lzm) {
        try { lzm.unobserve(el); lzm.cancelLoad(el); } catch (err) {}
      }
      notify();
    },
    getItems(visibleOnly?: boolean) {
      void visibleOnly; // v3 参数表示「已渲染组」；v4 虚拟化下 DOM 反查本就是可见集，语义等价
      return itemInfosOf();
    },
    clear() {
      state.items = [];
      notify();
    },
    // trigger('prepend'/'append')：v3 强制本地翻页 —— v4 全量 children 模型下条目已在
    // 树内（虚拟化按组裁剪），无本地页可翻 —— no-op（machineryScrollbarTo /
    // checkListItemsLessThanContainer 两个消费点语义自足）。
    trigger(_name: string) {},
    layout() {
      if (gridRef && gridRef.renderItems) gridRef.renderItems();
    },
    // machineryRelayout 的 setLayout(LayoutClass, opts) —— v4 布局选项（sizeRange/gap）
    // 由 BoxList 渲染时从 scope imageSize 派生，此处仅触发重渲染（zoom 链：imageSize
    // 已先行写入 → notify → BoxList 重渲染 → renderItems 驱动器接管）。
    setLayout(_layoutClass: any, _options: any) {
      notify();
    },
    _renderer: {
      updateSize() {
        if (gridRef && gridRef.renderItems) gridRef.renderItems();
      },
    },
    _watcher: {
      _onCheck() { /* v3 滚动 watcher —— v4 scroll 管理内建，no-op */ },
      // gridDirectives 滚动条联动（266）读滚动位置
      getScrollPos() {
        const sc = gridRef && gridRef.getScrollContainerElement && gridRef.getScrollContainerElement();
        return sc ? sc.scrollTop : 0;
      },
    },
    // gridDirectives 页跳机器（591/620/937/1105）读组元数据：groupKey + outlines
    // {start:[top], end:[bottom]} —— v4 组不保留 outlines，从 item.rect 现算。
    get _items() {
      const groups = (gridRef && gridRef.getGroups ? gridRef.getGroups() : []) || [];
      const items = (gridRef && gridRef.getItems ? gridRef.getItems() : []) || [];
      const byGroup: Record<string, any[]> = {};
      items.forEach((it: any) => {
        const k = String(it.groupKey);
        (byGroup[k] = byGroup[k] || []).push(it);
      });
      return {
        _data: groups.map((g: any) => {
          const its = byGroup[String(g.groupKey)] || [];
          let outlines = { start: [0], end: [0] };
          if (its.length > 0) {
            const top = Math.min(...its.map((i: any) => (i.rect ? i.rect.top : 0)));
            const bottom = Math.max(...its.map((i: any) => (i.rect ? i.rect.top + (i.rect.height || 0) : 0)));
            outlines = { start: [top], end: [bottom] };
          }
          return { groupKey: g.groupKey, outlines };
        }),
      };
    },
    getGroupKeys() {
      return groupKeys();
    },
    _layout: {
      // gridAdjustLayoutWidth 的列数读取（2 处消费）。v4 无内建列数概念 —— 首行盒宽换算：
      // 列宽 = 容器宽/列数（v3 GridLayout._columnSize 公式的逆向）。零盒时 0。
      get _columnLength() {
        const els = visibleEls();
        if (els.length < 2) return els.length === 1 ? computeColumnLength(els) || 1 : 0;
        return computeColumnLength(els);
      },
    },
    _updateContainerHeight() { /* v4 自管容器高度（outline 模型）—— no-op */ },
  };
  w.ig = facade;
  // NgGridStrings：v3 时代模板字符串缓存（boxGridEngine 自写），全树零外部消费——保留空对象
  // 兼容 window 契约探测。
  if (!w.NgGridStrings) w.NgGridStrings = {};
}

function computeColumnLength(els: HTMLElement[]): number {
  if (els.length === 0) return 0;
  const tops = new Map<number, number>();
  for (const el of els) {
    const t = Math.round(el.getBoundingClientRect().top);
    tops.set(t, (tops.get(t) || 0) + 1);
  }
  return Math.max(...tops.values());
}

/* ---------- 对外契约（resetNgGridLayoutData + gl:* 事件） ---------- */

let installed = false;
let scopeEventsDereg: Array<() => void> = [];

function applyReset(nextItems: any[], cursor?: number, scrollPercentage?: number) {
  const lzm = useMiscRawState.getState().lazyLoadManager;
  if (lzm) {
    try { lzm.softReset(); lzm.initObserver(); } catch (err) {}
  }
  state = {
    items: nextItems || [],
    startCursor: cursor || 0,
    startGroupKey: 1000000 + (cursor || 0),
    scrollPercentage: scrollPercentage ?? null,
    version: state.version + 1,
  };
  engineListeners.forEach((f) => { try { f(); } catch (err) {} });
}

export function installBoxGrid(): () => void {
  const w = window as any;
  if (installed) return () => {};
  installed = true;

  // E5-2：原 ngGridLayout link 设置的 window.$bodyScope 全局已退役——gridDirectives 等
  // 改直读 store（getScopeFace 仅供应用内部），不再需要为 v3 模块供给全局 scope。

  w.resetNgGridLayoutData = (nextItems: any[], cursor?: number, scrollPercentage?: number) => {
    applyReset(nextItems, cursor, scrollPercentage);
  };

  const attach = () => {
    scopeEventsDereg.push(glResetChannel.on((_e: unknown, nextItems: any[], cursor?: number) => {
      applyReset(nextItems, cursor);
    }));
    scopeEventsDereg.push(glScrolltotopChannel.on(() => applyReset(state.items, state.startCursor)));
    scopeEventsDereg.push(glRemoveitemsChannel.on((_e: unknown, itemElements: any[]) => {
      (itemElements || []).forEach((item) => facadeRemove(item));
    }));
    return true;
  };
  if (!attach()) {
    const retry = setInterval(() => {
      if (attach()) clearInterval(retry);
    }, 300);
    scopeEventsDereg.push(() => clearInterval(retry));
  }

  return () => {
    scopeEventsDereg.forEach((d) => { try { d(); } catch {} });
    scopeEventsDereg = [];
  };
}

function facadeRemove(target: any) {
  const w = window as any;
  if (w.ig && w.ig.remove) w.ig.remove(target);
}

/** 滚动恢复（v3 applyScrollPercentage 等价）：v4 全量 children 下容器总高即全列表高，
 * 目标 = (游标页 × 60 + pct × 60) × 平均条目纵距（v3 = 组 outline 起点 + 组高 × pct，
 * 组=60 条 —— 页内比例定位语义逐字对齐）。 */
export function scrollPercentageTarget(decimalPart: number, itemsLength: number): number | null {
  const container = document.getElementById('box-container');
  if (!container || itemsLength <= 0) return null;
  const listScrollHeight = container.scrollHeight;
  if (listScrollHeight < 50) return null;
  const avgPitch = listScrollHeight / itemsLength;
  return (state.startCursor + decimalPart) * 60 * avgPitch;
}
