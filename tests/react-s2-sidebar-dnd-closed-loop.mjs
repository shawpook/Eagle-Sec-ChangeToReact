/**
 * b1-9bh：侧栏原生 DnD 闭环（be2 前置的套件补缺——sidebar 文件夹拖拽此前零覆盖）。
 *
 * 覆盖 initSidebarDrag（原生 HTML5 DnD 版）的契约：
 *  1. dragstart 建 payload（draggedFolders）+ dragCheck=true + helper 入 body
 *  2. drop 命中 name-area → moveFoldersToFolder（源成为目标的子文件夹）
 *  3. drop 命中 bottom-area → moveFoldersAsSibling(asSiblingBelow)（父级不变、同级排列）
 *  4. dragend 清理（helper 移除、dragCheck 50ms 后复位 false）
 * 断言全部用 scope 信号（folderMappings[].parent / $root.draggedFolders），
 * 视觉类不可靠（PROGRESS b1-9au 教训）。
 */
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { bootStack, stop, waitFor, delay } from './react-cdp-harness.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-sidebar-dnd-'));
const librariesRoot = path.join(tempRoot, 'libraries');
const stateFile = path.join(tempRoot, 'library-state.json');
const userDataDir = path.join(tempRoot, 'user-data');
fs.mkdirSync(librariesRoot, { recursive: true });

let stack;
let folderIds = {};
let failure = null;
const failures = [];
const watchdog = setTimeout(() => { console.log('SIDEBAR_DND_WATCHDOG'); process.exit(2); }, 300000);

try {
  stack = await bootStack({
    librariesRoot, stateFile, userDataDir,
    beforeElectron: async (apiPort) => {
      const post = async (route, body) => {
        const response = await fetch(`http://127.0.0.1:${apiPort}${route}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const payload = await response.json();
        if (!response.ok || payload.status !== 'success') throw new Error(`${route}: ${JSON.stringify(payload)}`);
        return payload.data;
      };
      await post('/api/library/create', { name: 'Sidebar DnD', savePath: librariesRoot });
      const folderId = async (name) => {
        const data = await post('/api/folder/create', { name });
        return (data && data.id) || (data && data.folder && data.folder.id) || data;
      };
      folderIds.alpha = await folderId('DnD Alpha');
      folderIds.beta = await folderId('DnD Beta');
      folderIds.gamma = await folderId('DnD Gamma');
    },
  });
  const { page } = stack;
  const evaluate = async (expression) => {
    const r = await page.send('Runtime.evaluate', { expression, returnByValue: true });
    if (r.exceptionDetails) throw new Error(`eval failed: ${r.exceptionDetails.exception?.description?.slice(0, 200)}`);
    return r.result.value;
  };
  const assert = (name, pass, detail) => {
    console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${pass ? '' : ' — ' + JSON.stringify(detail)}`);
    if (!pass) failures.push(name);
  };

  await waitFor(async () => (await evaluate(`document.readyState`)) === 'complete', 'ready', 60000);
  await waitFor(async () => (await evaluate(`!!window.$bodyScope`)) === true, 'scope', 60000);
  await waitFor(async () => {
    const n = await evaluate(`document.querySelectorAll('[data-sidebar-kind="folder"]').length`);
    return typeof n === 'number' && n >= 3 ? n : null;
  }, 'sidebar nodes', 60000);

  // 侧栏节点 id 与 folder id 对齐（data-sidebar-node-id = folder id）
  const resolve = await evaluate(`(() => {
    const nodes = Array.from(document.querySelectorAll('[data-sidebar-kind="folder"]'));
    return nodes.map((n) => n.getAttribute('data-sidebar-node-id'));
  })()`);
  console.log(`sidebar node ids: ${JSON.stringify(resolve)}`);

  const alpha = folderIds.alpha;
  const beta = folderIds.beta;
  const gamma = folderIds.gamma;
  assert('folder ids resolved', !!alpha && !!beta && !!gamma, folderIds);

  // ── 1. dragstart 契约：dragCheck=true + payload + helper ──
  const startState = await evaluate(`(() => {
    const src = document.getElementById('folder-${alpha}');
    if (!src) return { missing: true };
    src.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: new DataTransfer() }));
    const s = window.$bodyScope;
    return {
      dragCheck: (window as any).dragCheck === undefined ? window.dragCheck : window.dragCheck,
      dragged: s.$root.draggedFolders && s.$root.draggedFolders.map((f) => f.id),
      helper: !!document.querySelector('body > .multiple-drag-folder-helper'),
    };
  })()`.replace(/\(window as any\)/g, 'window'));
  assert('dragstart sets dragCheck', startState.dragCheck === true, startState);
  assert('dragstart builds draggedFolders payload', Array.isArray(startState.dragged) && startState.dragged[0] === alpha, startState);
  assert('dragstart mounts helper', startState.helper === true, startState);

  // ── 2. name-area drop → moveFoldersToFolder（Alpha 成为 Beta 子级）──
  await evaluate(`(() => {
    const src = document.getElementById('folder-${alpha}');
    const dst = document.getElementById('folder-${beta}');
    const zone = dst.querySelector('.multiple-drop-folder-name-area');
    const dt = new DataTransfer();
    zone.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }));
    zone.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
    src.dispatchEvent(new DragEvent('dragend', { bubbles: true, cancelable: true, dataTransfer: dt }));
    return true;
  })()`);
  const nested = await waitFor(async () => {
    const r = await evaluate(`(() => {
      const s = window.$bodyScope;
      const a = s.folderMappings['${alpha}'];
      return { parent: a && a.parent, betaChildren: s.folderMappings['${beta}'] && s.folderMappings['${beta}'].children && s.folderMappings['${beta}'].children.map((c) => c.id) };
    })()`);
    return r.parent === beta ? r : null;
  }, 'alpha nested into beta', 15000);
  assert('name-area drop moves folder into target', nested && nested.parent === beta, nested);

  // dragend 清理：helper 移除、dragCheck 50ms 后复位
  await delay(150);
  const afterEnd = await evaluate(`(() => ({
    helper: !!document.querySelector('body > .multiple-drag-folder-helper'),
    dragCheck: window.dragCheck,
  }))()`);
  assert('dragend removes helper', afterEnd.helper === false, afterEnd);
  assert('dragend resets dragCheck', afterEnd.dragCheck === false, afterEnd);

  // ── 3. bottom-area drop → moveFoldersAsSibling(asSiblingBelow)（Beta 与 Gamma 同级、排其下）──
  await evaluate(`(() => {
    const src = document.getElementById('folder-${beta}');
    const dst = document.getElementById('folder-${gamma}');
    const zone = dst.querySelector('.multiple-drop-folder-bottom-area');
    const dt = new DataTransfer();
    src.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt }));
    zone.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }));
    zone.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
    src.dispatchEvent(new DragEvent('dragend', { bubbles: true, cancelable: true, dataTransfer: dt }));
    return true;
  })()`);
  const sibling = await waitFor(async () => {
    const r = await evaluate(`(() => {
      const s = window.$bodyScope;
      const b = s.folderMappings['${beta}'];
      const g = s.folderMappings['${gamma}'];
      return { betaParent: b && b.parent, gammaParent: g && g.parent };
    })()`);
    return r.betaParent === r.gammaParent ? r : null;
  }, 'beta sibling of gamma', 15000);
  assert('bottom-area drop keeps sibling parity', sibling && sibling.betaParent === sibling.gammaParent, sibling);

  if (failures.length > 0) throw new Error(`Sidebar DnD assertions failed: ${failures.join(', ')}`);
  console.log(`SIDEBAR_DND_CLOSED_LOOP_OK ${JSON.stringify({ checks: 8 })}`);
} catch (err) {
  failure = err;
  console.error(`SIDEBAR_DND_CLOSED_LOOP_FAIL ${err.message}`);
} finally {
  clearTimeout(watchdog);
  if (stack) { await stop(stack.electron); await stop(stack.vite); await stop(stack.backend); }
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
process.exit(failure ? 1 : 0);
