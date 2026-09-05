import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bootStack, stop, waitFor } from './react-cdp-harness.mjs';

// b1-9ak：Menu.popup 自动化——原生菜单无法被 CDP 观察（真弹会阻塞会话），main 侧
// EAGLE_MENU_SMOKE 吞 popup 改记录菜单模板（label/type/visible/submenu 长度）。
// 六站点验证策略：
//   1 FolderModals moreButtonClick（move/add-to-folder 模态树）     —— 静态接线审计
//      （模态需 UI 流程打开，运行时驱动成本高于收益；模板结构字符串断言）
//   2 controllerFns openApplicationContextMenu                      —— 运行时闭环（scope 直调）
//   3 controllerFns shareMenu（darwin-only，Windows 不可达）        —— 静态接线审计
//   4 preview-window openRatioContextMenu                           —— 静态接线审计
//   5 preview-window opacity 菜单                                    —— 静态接线审计
//   6 preview-window gifViewer 菜单                                  —— 静态接线审计
// 运行时捕获证明 stub 基建端到端有效；静态断言锁定模板构造不回退。

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-menu-popup-'));
const librariesRoot = path.join(tempRoot, 'libraries');
const stateFile = path.join(tempRoot, 'library-state.json');
const userDataDir = path.join(tempRoot, 'user-data');
const menuCapturesFile = path.join(tempRoot, 'menu-captures.json');
fs.mkdirSync(librariesRoot, { recursive: true });

process.env.EAGLE_MENU_SMOKE = '1';
process.env.EAGLE_MENU_SMOKE_OUT = menuCapturesFile;

let stack;
let captures = [];
let failure = null;
try {
  stack = await bootStack({
    librariesRoot,
    stateFile,
    userDataDir,
    beforeElectron: async (apiPort) => {
      const post = async (route, body) => {
        const response = await fetch(`http://127.0.0.1:${apiPort}${route}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const payload = await response.json();
        if (!response.ok || payload.status !== 'success') throw new Error(`${route} failed: ${JSON.stringify(payload)}`);
        return payload.data;
      };
      await post('/api/library/create', { name: 'Menu Popup Smoke', savePath: librariesRoot });
      await post('/api/folder/create', { name: '菜单验证文件夹' });
      await post('/api/v2/smartFolder/create', { name: '菜单验证智能文件夹', conditions: [{ rules: [{ property: 'name', method: 'contain', value: '菜单' }] }] });
    },
  });
  const { page } = stack;

  await waitFor(async () => {
    const r = await page.send('Runtime.evaluate', {
      expression: `document.readyState`,
      returnByValue: true,
    });
    return r.result.value === 'complete';
  }, 'main window ready', 45000);
  await waitFor(async () => (await page.send('Runtime.evaluate', { expression: `!!document.getElementById('main-app') && !!window.$bodyScope`, returnByValue: true })).result.value, 'app scope', 45000);

  const readCaptures = () => {
    try {
      return JSON.parse(fs.readFileSync(menuCapturesFile, 'utf8'));
    } catch (err) {
      return [];
    }
  };

  // ── 站点 2：应用菜单（openApplicationContextMenu）——运行时闭环 ──
  const callResult = await page.send('Runtime.evaluate', {
    expression: `(function () {
      try {
        const s = window.$bodyScope;
        if (!s) return { ok: false, reason: 'no $bodyScope' };
        if (typeof s.openApplicationContextMenu !== 'function') return { ok: false, reason: 'fn missing: ' + typeof s.openApplicationContextMenu };
        s.openApplicationContextMenu();
        return { ok: true };
      } catch (err) { return { ok: false, reason: 'throw: ' + err.message }; }
    })()`,
    returnByValue: true,
  });
  if (!callResult.result.value || callResult.result.value.ok !== true) {
    throw new Error(`openApplicationContextMenu not drivable: ${JSON.stringify(callResult.result.value || callResult.exceptionDetails || callResult)}`);
  }

  await waitFor(() => {
    captures = readCaptures();
    return Array.isArray(captures) && captures.length >= 1;
  }, 'application menu capture', 15000);
  const appMenu = captures[captures.length - 1];
  const appLabels = (appMenu.items || []).map((it) => it.label);
  if (!appLabels.includes('File')) throw new Error(`application menu template missing File menu: ${JSON.stringify(appMenu)}`);
  const fileMenu = (appMenu.items || []).find((it) => it.label === 'File');
  if (!fileMenu || !fileMenu.submenu) throw new Error(`File menu has no submenu: ${JSON.stringify(appMenu)}`);
  if (!appLabels.includes('View') || !appLabels.includes('Help')) throw new Error(`application menu template incomplete: ${JSON.stringify(appLabels)}`);
  console.log(`MENU_POPUP application-menu OK labels=${JSON.stringify(appLabels)}`);

  // ── 站点 1/3：主窗静态接线审计 ──
  const fnsSource = fs.readFileSync(path.join(projectRoot, 'src', 'app', 'react', 'core', 'controllerFns.ts'), 'utf8');
  if (!fnsSource.includes('new remote.ShareMenu(')) throw new Error('shareMenu ShareMenu construction missing');
  if (!fnsSource.includes('shareMenu.popup()')) throw new Error('shareMenu popup call missing');
  if (!fnsSource.includes("process.platform === 'darwin'")) throw new Error('shareMenu darwin guard missing');

  // ── 站点 1：FolderModals 模态树菜单（moreButtonClick）模板构造审计 ──
  const fmSource = fs.readFileSync(path.join(projectRoot, 'src', 'app', 'react', 'components', 'stage7', 'FolderModals.tsx'), 'utf8');
  if (!fmSource.includes('const Menu = remote.Menu;')) throw new Error('folder modal Menu construction missing');
  if (!fmSource.includes('newSubFolderItem') || !fmSource.includes('newSiblingsItem')) throw new Error('folder modal items missing');
  if (!fmSource.includes('contextMenu.popup(w.getCurrentWindow')) throw new Error('folder modal popup call missing');

  // ── 站点 4/5/6：预览窗三菜单静态接线审计 ──
  const pwSource = fs.readFileSync(path.join(projectRoot, 'src', 'app', 'react', 'preview-window', 'controller.ts'), 'utf8');
  if (!pwSource.includes('openRatioContextMenu')) throw new Error('ratio menu builder missing');
  if (!pwSource.includes("'view.zoom.fit'")) throw new Error('ratio menu zoom.fit accelerator missing');
  if (!pwSource.includes('appmenu.view>opacity')) throw new Error('opacity menu i18n missing');
  if (!pwSource.includes('revealInFolder')) throw new Error('opacity menu reveal item missing');
  if (!pwSource.includes('context.gifViewer.setThumbnail')) throw new Error('gif menu setThumbnail missing');
  if (!pwSource.includes('context.gifViewer.cancelRange')) throw new Error('gif menu cancelRange missing');
  const pwPopupCount = (pwSource.match(/contextMenu\.popup\(currentWindow\)/g) || []).length;
  if (pwPopupCount < 3) throw new Error(`preview-window popup sites expected >=3, got ${pwPopupCount}`);

  // ── 站点 7：b1-9ao 侧栏 expand 右键菜单（DOM 菜单走 CONTEXTMENU.OPEN 广播）——
  // 真驱动 + 临时 $on 捕获载荷断言（合成事件 + 从 sidebar 树取真实节点）──
  await waitFor(async () => {
    const r = await page.send('Runtime.evaluate', { expression: `(window.$bodyScope.folders || []).length > 0`, returnByValue: true });
    return r.result.value === true;
  }, 'sidebar folders ready', 20000);
  const expandResult = await page.send('Runtime.evaluate', {
    expression: `(function () {
      try {
        const s = window.$bodyScope;
        if (typeof s.openFolderExpandContextMenu !== 'function') return { ok: false, reason: 'fn missing' };
        const folder = (s.folders || [])[0];
        if (!folder) return { ok: false, reason: 'no folder in sidebar' };
        let captured = null;
        const off = s.$on('CONTEXTMENU.OPEN', (ev, options) => { captured = options; });
        const syntheticEvent = { stopPropagation() {}, currentTarget: null };
        s.openFolderExpandContextMenu(syntheticEvent, folder);
        off();
        if (!captured) return { ok: false, reason: 'no CONTEXTMENU.OPEN captured' };
        const labels = (captured.items || []).map((it) => it.label);
        return {
          ok: captured.showSearch === false
            && captured.items && captured.items.length === 3
            && typeof captured.onOpened === 'function'
            && typeof captured.onClosed === 'function'
            && labels.every((l) => typeof l === 'string' && l.length > 0),
          labels,
          folderExpandToggled: folder.isExpand !== undefined,
        };
      } catch (err) { return { ok: false, reason: 'throw: ' + err.message }; }
    })()`,
    returnByValue: true,
  });
  if (!expandResult.result.value || expandResult.result.value.ok !== true) {
    throw new Error(`folder expand menu not drivable: ${JSON.stringify(expandResult.result.value)}`);
  }
  console.log(`MENU_POPUP folder-expand-menu OK labels=${JSON.stringify(expandResult.result.value.labels)}`);

  // ── 站点 8：b1-9ap 侧栏 folder 主菜单（openFolderContextMenu，单选分支）——真驱动 +
  // 载荷断言（新增資料夾/子資料夾/重命名/克隆/删除等单选面 + 密码子菜单 + 展开组）──
  const folderMenuResult = await page.send('Runtime.evaluate', {
    expression: `(function () {
      try {
        const s = window.$bodyScope;
        if (typeof s.openFolderContextMenu !== 'function') return { ok: false, reason: 'fn missing' };
        const folder = (s.folders || [])[0];
        if (!folder) return { ok: false, reason: 'no folder' };
        let captured = null;
        const off = s.$on('CONTEXTMENU.OPEN', (ev, options) => { captured = options; });
        s.openFolderContextMenu({ stopPropagation() {}, target: { tagName: 'DIV' }, currentTarget: null }, folder);
        off();
        if (!captured) return { ok: false, reason: 'no broadcast captured' };
        const labels = (captured.items || []).filter((it) => it.label).map((it) => it.label);
        const hasPasswordSubmenu = (captured.items || []).some((it) => it.submenu && it.submenu.items && it.submenu.items.length === 4);
        const hasExportSubmenu = (captured.items || []).some((it) => it.submenu && it.submenu.items && it.submenu.items.some((x) => x.icon === 'ic-export-computer.svg'));
        const hasHistorySubmenu = (captured.items || []).some((it) => it.icon === 'ic-library-add-to.svg' && it.submenu && Array.isArray(it.submenu.items));
        return {
          ok: captured.showSearch === true
            && labels.length >= 10
            && hasPasswordSubmenu
            && hasExportSubmenu
            && hasHistorySubmenu
            && typeof captured.onOpened === 'function',
          labelCount: labels.length,
          hasPasswordSubmenu,
          hasExportSubmenu,
          hasHistorySubmenu,
        };
      } catch (err) { return { ok: false, reason: 'throw: ' + err.message }; }
    })()`,
    returnByValue: true,
  });
  if (!folderMenuResult.result.value || folderMenuResult.result.value.ok !== true) {
    throw new Error(`folder context menu not drivable: ${JSON.stringify(folderMenuResult.result.value)}`);
  }
  console.log(`MENU_POPUP folder-context-menu OK labelCount=${folderMenuResult.result.value.labelCount} passwordSubmenu=${folderMenuResult.result.value.hasPasswordSubmenu} exportSubmenu=${folderMenuResult.result.value.hasExportSubmenu} historySubmenu=${folderMenuResult.result.value.hasHistorySubmenu}`);

  // ── 站点 9：b1-9aq 侧栏 smart-folder 主菜单（单选分支）——真驱动 + 载荷断言 ──
  const smartMenuResult = await page.send('Runtime.evaluate', {
    expression: `(function () {
      try {
        const s = window.$bodyScope;
        if (typeof s.openSmartFolderContextMenu !== 'function') return { ok: false, reason: 'fn missing' };
        const smartFolder = (s.smartFolders || [])[0];
        if (!smartFolder) return { ok: false, reason: 'no smart folder in sidebar' };
        let captured = null;
        const off = s.$on('CONTEXTMENU.OPEN', (ev, options) => { captured = options; });
        s.openSmartFolderContextMenu({ stopPropagation() {}, target: { tagName: 'DIV' }, currentTarget: null }, smartFolder);
        off();
        if (!captured) return { ok: false, reason: 'no broadcast captured' };
        const labelCount = (captured.items || []).filter((it) => it.label).length;
        const hasExportSubmenu = (captured.items || []).some((it) => it.submenu && it.submenu.items && it.submenu.items.some((x) => x.icon === 'ic-export-computer.svg' || x.icon === 'ic-export-eaglepack.svg'));
        return {
          ok: captured.showSearch === true
            && labelCount >= 12
            && hasExportSubmenu
            && typeof captured.onOpened === 'function',
          labelCount,
          hasExportSubmenu,
        };
      } catch (err) { return { ok: false, reason: 'throw: ' + err.message }; }
    })()`,
    returnByValue: true,
  });
  if (!smartMenuResult.result.value || smartMenuResult.result.value.ok !== true) {
    throw new Error(`smart folder context menu not drivable: ${JSON.stringify(smartMenuResult.result.value)}`);
  }
  console.log(`MENU_POPUP smart-folder-context-menu OK labelCount=${smartMenuResult.result.value.labelCount} exportSubmenu=${smartMenuResult.result.value.hasExportSubmenu}`);

  console.log(`MENU_POPUP_CLOSED_LOOP_OK ${JSON.stringify({ captures: captures.length, pwPopupCount })}`);
} catch (err) {
  failure = err;
  console.error(err);
} finally {
  process.env.EAGLE_MENU_SMOKE = '';
  try { await stop(stack); } catch (err) { /* 关闭失败不掩盖测试结果 */ }
  // electron 退出后 Dictionaries 等文件锁可能短暂残留——重试清理，勿让 EBUSY 掩盖测试输出
  for (let i = 0; i < 6; i++) {
    try {
      fs.rmSync(tempRoot, { recursive: true, force: true });
      break;
    } catch (err) {
      if (i === 5) console.warn(`cleanup incomplete: ${err.message}`);
      else await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  // Windows 上 electron 子进程树偶发挂起事件循环（句柄残留）——显式收尾，
  // 失败语义经 failure 保留（exit 1），不被 process.exit 吞掉
  if (failure) process.exit(1);
  process.exit(0);
}
