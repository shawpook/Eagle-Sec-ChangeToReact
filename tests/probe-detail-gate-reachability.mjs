/**
 * 探针（诊断，不入套件）：详情原图交付门控的可达性。
 *
 * 结论（2026-09-14 实跑）：门控包装的是 scope 面/驱动面的 `enterDetailMode`
 * （`driverApi.ACTION_FIELDS` 白名单 + `miscRawState` store 字段），而 React UI 的所有入口
 * 都直接调用 import 的 `machineryEnterDetailMode`（`selectionService.ts:200` 网格双击、
 * `inspectorActions`、`detailService`、`miscDomain` 等），两者不是同一函数对象 ——
 * 故 UI 路径**当前不经过门控**（`pathA` 无 state 变化，`pathB` 驱动面才有）。
 *
 * 详见 `docs/e5-5-shims-retirement-plan.md` §0.1。
 * 用法：node tests/probe-detail-gate-reachability.mjs
 */
import { bootWithItem, finish } from './closed-loop-common.mjs';

let ctx;
let extra = {};
let failure = null;
try {
  ctx = await bootWithItem('gateprobe2');
  const { ev, waitFor } = ctx;
  await waitFor(async () => (await ev(`document.querySelectorAll('.box').length`)) > 0, 'boxes', 15000);

  const identity = await ev(`(() => {
    const M = window.__eagleMachinery || {};
    const D = window.__eagleDriver || {};
    return {
      machineryIsFn: typeof M.enterDetailMode,
      driverIsFn: typeof D.enterDetailMode,
      sameObject: M.enterDetailMode === D.enterDetailMode,
      machineryHasGateFlag: !!(M.enterDetailMode && M.enterDetailMode.__eagleOriginalGate),
      driverHasGateFlag: !!(D.enterDetailMode && D.enterDetailMode.__eagleOriginalGate),
    };
  })()`);

  // Path A：machinery 导出（React UI 实际调用面）
  const pathA = await ev(`(() => {
    const d = window.__eagleDetailDeliveryState;
    d.itemId = ''; d.mode = ''; d.lockedAt = 0;
    const item = (window.__eagleDriver.raw || [])[0];
    try { window.__eagleMachinery.enterDetailMode(null, item); } catch (e) { return { err: String(e && e.message) }; }
    return { itemId: d.itemId, mode: d.mode, lockedAt: d.lockedAt };
  })()`);

  // Path B：驱动面（main.cjs / 测试驱动脚本实际调用面）
  const pathB = await ev(`(() => {
    const d = window.__eagleDetailDeliveryState;
    d.itemId = ''; d.mode = ''; d.lockedAt = 0;
    const item = (window.__eagleDriver.raw || [])[0];
    try { window.__eagleDriver.enterDetailMode(null, item); } catch (e) { return { err: String(e && e.message) }; }
    return { itemId: d.itemId, mode: d.mode, lockedAt: d.lockedAt };
  })()`);

  extra = { identity, pathA_machineryExport: pathA, pathB_driverApi: pathB };
} catch (err) {
  failure = err;
}
await finish(ctx, failure, 'GATE_PROBE_OK', extra);
