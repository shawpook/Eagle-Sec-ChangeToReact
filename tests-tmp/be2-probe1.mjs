// b1-9be2 probe1: measure v3-rendered .box geometry under current pipeline
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-be2-p1-'));
const librariesRoot = path.join(tempRoot, 'libraries');
const stateFile = path.join(tempRoot, 'library-state.json');
const userDataDir = path.join(tempRoot, 'user-data');
fs.mkdirSync(librariesRoot, { recursive: true });
const harnessPath = path.join(projectRoot, 'tests', 'react-cdp-harness.mjs').split(path.sep).join('/');
const { bootStack, stop } = await import('file:///' + harnessPath);
const watchdog = setTimeout(() => { console.log('WATCHDOG'); process.exit(2); }, 150000);
let stack;
try {
  stack = await bootStack({
    librariesRoot, stateFile, userDataDir,
    beforeElectron: async (apiPort) => {
      const post = async (route, body) => {
        const response = await fetch(`http://127.0.0.1:${apiPort}${route}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
        });
        const payload = await response.json();
        if (!response.ok || payload.status !== 'success') throw new Error(`${route} failed`);
        return payload.data;
      };
      await post('/api/library/create', { name: 'BE2 Probe', savePath: librariesRoot });
      const sharp = (await import('sharp')).default;
      const png = await sharp({ create: { width: 640, height: 400, channels: 4, background: '#38bdf8' } }).png().toBuffer();
      for (let i = 0; i < 12; i++) {
        const tmp = path.join(librariesRoot, `be2-${i}.png`);
        fs.writeFileSync(tmp, png);
        await post('/api/item/addFromPath', { paths: [tmp] });
      }
    },
  });
  const { page } = stack;
  await page.send('Runtime.enable');
  await new Promise((r) => setTimeout(r, 14000));
  const expr = `JSON.stringify({
    boxCount: document.querySelectorAll('.box').length,
    boxes: [...document.querySelectorAll('.box')].slice(0, 3).map(el => ({
      w: el.offsetWidth, h: el.offsetHeight,
      styleW: el.style.width || '(none)', styleH: el.style.height || '(none)',
      styleT: el.style.transform.slice(0, 60),
      cls: el.className.slice(0, 60),
      posy: el.getAttribute('posy'),
    })),
    containerAttr: document.getElementById('box-container').getAttribute('box-size'),
    containerCls: document.getElementById('box-container').className,
    igLayoutColumnLength: window.ig && window.ig._layout && window.ig._layout._columnLength,
    imageSize: window.$bodyScope && window.$bodyScope.imageSize && { h: window.$bodyScope.imageSize.height, w: window.$bodyScope.imageSize.width },
    boxListStyleH: document.getElementById('box-list') && document.getElementById('box-list').style.height,
    containerW: document.getElementById('box-container').clientWidth,
  })`;
  const r = await page.send('Runtime.evaluate', { expression: expr, returnByValue: true });
  console.log('BE2', r.result.value);
  // 手动触发 v4 重渲染，观察布局是否唤起
  await page.send('Runtime.evaluate', { expression: `(() => { try { window.ig.layout(); return 'called'; } catch (e) { return 'ERR ' + e.message; } })()`, returnByValue: true });
  await new Promise((r2) => setTimeout(r2, 2500));
  const r3 = await page.send('Runtime.evaluate', { expression: `JSON.stringify({
    after: [...document.querySelectorAll('.box')].slice(0, 3).map(el => ({ w: el.offsetWidth, styleW: el.style.width || '(none)', styleT: el.style.transform.slice(0, 40) })),
    v4gridItems: window.__v4grid && window.__v4grid.getItems ? window.__v4grid.getItems().length : 'noref',
    v4groups: window.__v4grid && window.__v4grid.getGroups ? window.__v4grid.getGroups().length : 'noref',
    v4startCursor: window.__v4grid && window.__v4grid.getStartCursor ? window.__v4grid.getStartCursor() : 'noref',
    v4endCursor: window.__v4grid && window.__v4grid.getEndCursor ? window.__v4grid.getEndCursor() : 'noref',
    wrapperH: document.querySelector('#box-list .box-list') && document.querySelector('#box-list .box-list').style.height,
  })`, returnByValue: true });
  console.log('BE2-AFTER', r3.result.value);
  const r4 = await page.send('Runtime.evaluate', { expression: `(() => {
    const g = window.__v4grid && window.__v4grid.getGroups();
    if (!g || !g.length) return JSON.stringify({err: 'no groups'});
    const g0 = g[0];
    const items = window.__v4grid.getItems();
    return JSON.stringify({
      groupKeys: Object.keys(g0),
      groupKey: g0.groupKey,
      outlines: g0.outlines ? { start: g0.outlines.start && g0.outlines.start.slice(0, 3), end: g0.outlines.end && g0.outlines.end.slice(0, 3) } : null,
      itemKeys: Object.keys(items[0] || {}),
      itemRect: items[0] && items[0].rect ? { top: items[0].rect.top, left: items[0].rect.left } : null,
      itemContentRect: items[0] && items[0].contentRect ? 'has' : null,
    });
  })()`, returnByValue: true });
  console.log('BE2-GROUPS', r4.result.value);
} finally {
  clearTimeout(watchdog);
  try { await Promise.race([stop(stack), new Promise((r) => setTimeout(r, 8000))]); } catch (err) {}
}
process.exit(0);
