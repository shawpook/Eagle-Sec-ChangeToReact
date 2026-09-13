// Persistence smoke 的渲染层驱动（真实页面上下文；main.cjs executeJavaScript 载入）。
// 阶段由 EAGLE_PERSISTENCE_PHASE 选择：
//  - edit：用真实编辑入口做改名(含 URL)/注释/标签/评分/文件夹归属/多选评分，
//          每次编辑后经 window.eagleDesktop.library.current()（真实后端）轮询到落库。
//  - check：重启后读回并断言全部已落库值（改名/URL/注释/标签/评分/文件夹/多选评分）。
// 断言差异以 PERSIST_EDIT_DONE / PERSIST_CHECK_* 标记 + JSON 输出，由测试侧判定。
(async () => {
  'use strict';
  const w = window;
  // 参数由 main.cjs 注入（渲染层 process 为 shims mock，无 env）
  const env = w.__persistEnv || {};
  const phase = env.phase || 'edit';
  const folderId = env.folderId || '';
  const expectedIds = Array.isArray(env.expectedIds) ? env.expectedIds : [];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const report = { phase };

  try {
    const scope = await (async () => {
      const deadline = Date.now() + 40000;
      while (Date.now() < deadline) {
        const s = w.__eagleDriver;
        // 等**真实库**的条目就位（内置 mock fixture 可能会先出现；真实 seed 到达后含全部期望 id）。
        if (s && Array.isArray(s.raw) && s.raw.length >= 2 && s.listDone
          && expectedIds.every((id) => s.raw.some((item) => item && item.id === id))) return s;
        await sleep(120);
      }
      throw new Error('boot timeout: raw missing expected ids ' + expectedIds.join(','));
    })();
    const actions = w.__eagleInspectorActions;
    if (!actions || typeof actions.imagesChange !== 'function') throw new Error('no inspector actions');

    const currentItems = async () => {
      const current = await w.eagleDesktop.library.current();
      return Array.isArray(current && current.items) ? current.items : [];
    };
    const pollPersisted = async (pred, label, timeout = 25000) => {
      const deadline = Date.now() + timeout;
      while (Date.now() < deadline) {
        const items = await currentItems();
        const hit = pred(items);
        if (hit) return hit;
        await sleep(200);
      }
      throw new Error(label + ' timeout');
    };
    const currentItem = (id) => scope.raw.find((entry) => entry && entry.id === id);
    const selectItems = async (ids) => {
      scope.selected = [];
      scope.selectedMappings = {};
      ids.forEach((id, index) => {
        const item = currentItem(id);
        if (!item) throw new Error('item not found: ' + id);
        scope.select({ button: 0, ctrlKey: index > 0, metaKey: false, shiftKey: false, stopPropagation() {}, preventDefault() {} }, item);
      });
      scope.selected = ids.map((id) => currentItem(id));
      scope.current = scope.selected[0] || null;
      actions.updateSelection();
      scope.$evalAsync();
      await sleep(200);
    };

    if (phase === 'edit') {
      const id1 = scope.raw[0].id;
      const id2 = scope.raw[1].id;
      report.ids = [id1, id2];

      // 1. 改名 + URL
      await selectItems([id1]);
      scope.inspector.newName = 'Persist-Renamed';
      scope.inspector.newUrl = 'https://persist.test/url';
      actions.imagesChange();
      report.stepRename = await pollPersisted(
        (items) => items.find((it) => it.id === id1 && it.name === 'Persist-Renamed' && it.url === 'https://persist.test/url'),
        'rename persist');

      // 2. 注释
      scope.inspector.newAnnotation = 'Persist-Anno';
      actions.annotationChange();
      report.stepAnnotation = await pollPersisted(
        (items) => items.find((it) => it.id === id1 && it.annotation === 'Persist-Anno'),
        'annotation persist');

      // 3. 标签
      scope.TagManager.addTags(['persist-tag-a', 'persist-tag-b']);
      report.stepTags = await pollPersisted(
        (items) => items.find((it) => it.id === id1 && (it.tags || []).includes('persist-tag-a') && (it.tags || []).includes('persist-tag-b')),
        'tags persist');

      // 4. 评分
      scope.changeStar(4, false, true);
      report.stepStar = await pollPersisted(
        (items) => items.find((it) => it.id === id1 && it.star === 4),
        'star persist');

      // 5. 文件夹归属
      if (folderId) {
        scope.addImagesToFolder([currentItem(id1)], { id: folderId, name: 'Persist-Folder' });
        report.stepFolder = await pollPersisted(
          (items) => items.find((it) => it.id === id1 && (it.folders || []).includes(folderId)),
          'folder persist');
      }

      // 6. 多选评分
      await selectItems([id1, id2]);
      scope.changeStar(3, false, true);
      report.stepMultiStar = await pollPersisted(
        (items) => {
          const a = items.find((it) => it.id === id1);
          const b = items.find((it) => it.id === id2);
          return a && b && a.star === 3 && b.star === 3 ? [a, b] : null;
        },
        'multi star persist');

      report.final = await currentItems();
    } else if (phase === 'check') {
      const items = await pollPersisted(() => Array.isArray((w.__eagleDriver || {}).raw) && true ? currentItems() : null, 'items ready');
      const id1 = scope.raw[0].id;
      const id2 = scope.raw[1].id;
      const a = items.find((it) => it.id === id1);
      const b = items.find((it) => it.id === id2);
      report.check = {
        id1: a && { name: a.name, url: a.url, annotation: a.annotation, star: a.star, tags: (a.tags || []).slice(), folders: (a.folders || []).slice() },
        id2: b && { name: b.name, star: b.star, tags: (b.tags || []).slice() },
      };
      report.ok = !!(a && b
        && a.name === 'Persist-Renamed'
        && a.url === 'https://persist.test/url'
        && a.annotation === 'Persist-Anno'
        && a.star === 3
        && (a.tags || []).includes('persist-tag-a')
        && (a.tags || []).includes('persist-tag-b')
        && (!folderId || (a.folders || []).includes(folderId))
        && b.star === 3);
    }
  } catch (err) {
    report.error = String((err && err.stack) || (err && err.message) || err);
    report.ok = false;
  }
  return report;
})();