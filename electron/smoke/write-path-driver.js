// Write-path stub smoke 的渲染层驱动（在真实页面上下文执行；main.cjs executeJavaScript 载入）。
// 职责：用真实编辑入口（inspectorActions.imagesChange / scope.changeStar）触发
// images-change/image-change，收集 item:operation-result 与 image.changed 时序，返回报告。
// 断言在测试侧对照 main 侧的 stub 请求日志（requests.jsonl）进行。
// 覆盖（P1-c-2 验证①）：单次路由；入队时快照（快速连续改名）；写入顺序；延迟响应；
// 失败隔离（failNext 后恢复）；多选编辑；changeStar。
(async () => {
  'use strict';
  const w = window;
  const report = { ops: [], changed: [], error: null };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  try {
    const scope = await (async () => {
      const deadline = Date.now() + 60000;
      while (Date.now() < deadline) {
        const s = w.__eagleDriver;
        if (s && Array.isArray(s.raw) && s.raw.length >= 2 && s.listDone) return s;
        await sleep(100);
      }
      throw new Error('boot timeout: no driver/raw');
    })();
    const actions = w.__eagleInspectorActions;
    if (!actions || typeof actions.imagesChange !== 'function') throw new Error('no inspector actions');

    const bus = w.__eagleIpc;
    // shims 的 EventEmitter 以 Angular `$on` 双参签名回调：callback({}, ...args)
    bus.on('item:operation-result', (_event, value) => { report.ops.push(value); });
    bus.on('image.changed', (_event, item) => { report.changed.push(item && item.id); });

    const control = (payload) => {
      if (w.eagleDesktop && w.eagleDesktop.ipc) w.eagleDesktop.ipc.send('write-stub:control', payload);
    };
    const selectItems = async (ids) => {
      scope.selected = [];
      scope.selectedMappings = {};
      ids.forEach((id, index) => {
        const item = scope.raw.find((entry) => entry && entry.id === id);
        if (!item) throw new Error('item not found: ' + id);
        scope.select({ button: 0, ctrlKey: index > 0, metaKey: false, shiftKey: false, stopPropagation() {}, preventDefault() {} }, item);
      });
      scope.selected = ids.map((id) => scope.raw.find((entry) => entry && entry.id === id));
      scope.current = scope.selected[0] || null;
      actions.updateSelection();
      scope.$evalAsync();
      await sleep(200);
    };
    let awaited = 0;
    const waitOp = async (label) => {
      const deadline = Date.now() + 15000;
      while (awaited >= report.ops.length) {
        if (Date.now() > deadline) throw new Error('op timeout: ' + label);
        await sleep(40);
      }
      const value = report.ops[awaited];
      awaited += 1;
      return value;
    };

    // step 1：单选改名 → 1 次 updateMany（单路由）
    await selectItems([scope.raw[0].id]);
    scope.inspector.newName = 'Rename-A';
    actions.imagesChange();
    report.step1 = await waitOp('rename-a');

    // step 2：快速连续改名 → 入队快照（step2a 必须还是 Snap-A，即使此刻 live 对象已是 Snap-B）
    scope.inspector.newName = 'Snap-A';
    actions.imagesChange();
    scope.inspector.newName = 'Snap-B';
    actions.imagesChange();
    report.step2a = await waitOp('snap-a');
    report.step2b = await waitOp('snap-b');

    // step 3：延迟响应（delayMs=180）→ op 仍按序返回
    control({ failNext: 0, delayMs: 180 });
    const t3 = Date.now();
    scope.inspector.newName = 'Delay-C';
    actions.imagesChange();
    report.step3 = await waitOp('delay-c');
    report.step3Ms = Date.now() - t3;
    control({ failNext: 0, delayMs: 0 });
    await sleep(50);

    // step 4：强制失败 → item:operation-result ok:false
    control({ failNext: 1 });
    await sleep(50);
    scope.inspector.newName = 'Fail-D';
    actions.imagesChange();
    report.step4 = await waitOp('fail-d');

    // step 5：失败后继续 → ok:true 且顺序保持
    scope.inspector.newName = 'Fail-E';
    actions.imagesChange();
    report.step5 = await waitOp('fail-e');
    control({ failNext: 0 });

    // step 6：多选改名 → 1 次 updateMany、2 条 image.changed
    await selectItems([scope.raw[0].id, scope.raw[1].id]);
    const changedBefore = report.changed.length;
    scope.inspector.newName = 'Multi-X';
    actions.imagesChange();
    report.step6 = await waitOp('multi-x');
    report.multiChanged = report.changed.slice(changedBefore);

    // step 7：评分 → 1 次 updateMany
    scope.changeStar(3, false, true);
    report.step7 = await waitOp('star');

    await sleep(400);
  } catch (err) {
    report.error = String((err && err.stack) || (err && err.message) || err);
  }
  return report;
})();