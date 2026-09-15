/**
 * F08（m1-f08f09-actions）：跨窗**类型化动作端口**。
 *
 * 为什么要单独成模块：子窗口（`viewers/font`、`viewers/text-editor`）与主 UI 驱动脚本
 * （`electron/main.cjs`）经 `parent.__eagleDriver` / scope 面调用主窗动作，**无法直 import**
 * （iframe 无 ESM 通道、cjs 脚本不参与 ESM 图）。而这些动作的**实现**散在业务域里
 * （改名 = `components/inspector/inspectorActions.ts` 的 `imagesChange()`；评级 =
 * `services/imageOpsService.ts` 的 `machineryChangeStar()` 族）。
 *
 * 本模块是这些跨窗动作的**唯一定义点**：
 *   · 每个端口 = 一个具名、带参数签名的函数，函数体一律**转发既有业务实现**；
 *   · 不新增任何持久化/写库路径——改名沿用 `imagesChange()` 的 `ayncsImagesChange` +
 *     `hiddenByCurrentFilter` + `machineryRebindRefresh` 链，评级沿用 `machineryChangeStar` 链；
 *   · 子窗口的既有调用**协议名**（`imagesChange` / `removeStar` / `changeTo1Star`…`changeTo5Star`）
 *     保持不变，由 `core/externalSupplyRegistrar.ts` 把协议名指向本模块端口。
 *
 * 关于签名的两点如实说明（与派单文字 `renameItem(id, name)` / `setRating(ids, value)` 的差异）：
 *   ① 改名端口取 `renameItem(name)` 而非 `renameItem(id, name)`——既有实现
 *      （`imagesChange()`）的作用对象是主窗**当前选中项**（读 `eagle.inspector.newName`），
 *      子窗协议亦如此（先写 `parent.inspector.newName` 再调 `imagesChange`）。额外接受 `id`
 *      就必须先改主窗选中态，那等于引入第二条选中/持久化路径，与「严禁复制第二套持久化逻辑」冲突。
 *   ② 评级端口同理取 `setRating(stars)`——`machineryChangeStar` 的作用对象是当前选中集。
 *
 * 失败策略（对应 F08/F09「缺必需动作时断言或显式错误，不能安静返回」）：
 *   · 端口内依赖不成立（`eagle.inspector` 未就绪、参数非法）→ 抛 `CrossWindowActionError`，
 *     错误信息带**端口名**与**定位上下文**，可直接 grep；
 *   · 供给本身未注册（启动窗口期）→ `core/externalSupply.ts` 的 `ExternalSupplyNotReadyError`（F10）。
 */

import { imagesChange } from '../components/inspector/inspectorActions';
import {
  machineryChangeStar, machineryChangeTo1Star, machineryChangeTo2Star, machineryChangeTo3Star,
  machineryChangeTo4Star, machineryChangeTo5Star, machineryRemoveStar,
} from '../services/imageOpsService';

/** 跨窗动作端口的显式失败（缺依赖 / 参数非法）。前缀固定，便于从 console / 冒烟输出 grep。 */
export class CrossWindowActionError extends Error {
  readonly action: string;
  readonly detail: string;

  constructor(action: string, detail: string) {
    super(`[cross-window-action] ${action} 无法执行：${detail}`);
    this.name = 'CrossWindowActionError';
    this.action = action;
    this.detail = detail;
  }
}

function hostWindow(): any {
  return typeof window !== 'undefined' ? (window as any) : undefined;
}

/**
 * 改名端口：写主窗 inspector 的待改名 + 触发既有改名链。
 *
 * 与子窗协议（`viewers/font/entry.tsx:301–302` 先写 `inspector.newName` 再 `parentCall('imagesChange')`）
 * 语义等价，只是把两步收成一个具名函数，供类型化消费方（驱动脚本 / 测试 / 新入口）使用。
 */
export function renameItem(name: string): void {
  const inspector = hostWindow()?.eagle?.inspector;
  if (!inspector) {
    throw new CrossWindowActionError('renameItem', '主窗 eagle.inspector 尚未就绪（window.eagle.inspector 缺失）');
  }
  if (typeof name !== 'string' || name.trim() === '') {
    throw new CrossWindowActionError('renameItem', `名称必须是非空字符串，收到 ${JSON.stringify(name)}`);
  }
  inspector.newName = name;
  imagesChange();
}

const STAR_ACTIONS: Record<number, (event?: any) => void> = {
  1: machineryChangeTo1Star,
  2: machineryChangeTo2Star,
  3: machineryChangeTo3Star,
  4: machineryChangeTo4Star,
  5: machineryChangeTo5Star,
};

/**
 * 评级端口：`stars` 取 1–5 设为对应星级，取 `undefined` 清除星级。
 *
 * 星级快捷键族（`machineryChangeToNStar`）首行有 `event.altKey || metaKey || ctrlKey` 早退守卫，
 * 跨窗调用不传 `event` 即安全通过（可选链求值 `undefined` → falsy）——与子窗既有行为一致。
 */
export function setRating(stars: number | undefined): void {
  if (stars === undefined) {
    machineryChangeStar(undefined, true);
    return;
  }
  const action = STAR_ACTIONS[stars];
  if (typeof action !== 'function') {
    throw new CrossWindowActionError('setRating', `星级必须是 1–5 的整数或 undefined（清除），收到 ${JSON.stringify(stars)}`);
  }
  action(undefined);
}

/** 清除星级端口（与 `keymap.ts` 的 `'0'` 键同源实现）。 */
export function removeStar(): void {
  machineryRemoveStar();
}

/** 按序号派发星级端口——`changeTo1Star`…`changeTo5Star` 五个协议名的统一具名实现。 */
export function changeToNStar(stars: number, event?: any): void {
  const action = STAR_ACTIONS[stars];
  if (typeof action !== 'function') {
    throw new CrossWindowActionError('changeToNStar', `未知星级 ${JSON.stringify(stars)}（可用 1–5）`);
  }
  action(event);
}
