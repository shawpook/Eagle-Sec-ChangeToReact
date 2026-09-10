import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { bootStack, stop, waitFor, delay } from '../tests/react-cdp-harness.mjs';
import { PNG } from 'pngjs';

// 残余扫查 A：启动期错误普查（Page.reload 全程 CDP 事件捕获）+ DOM/scope 清单。
// 目的：把"改得不彻底会遗留什么"从猜测变成数据——boot 期 ReferenceError/TypeError 类
// （hover-preview b1-9aw 同类雷）在此现形；清单供 sweep B 逐面走查用。
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-residue-sweep-'));
const librariesRoot = path.join(tempRoot, 'libraries');
const sourcesRoot = path.join(tempRoot, 'sources');
const stateFile = path.join(tempRoot, 'library-state.json');
const userDataDir = path.join(tempRoot, 'user-data');
fs.mkdirSync(librariesRoot, { recursive: true });
fs.mkdirSync(sourcesRoot, { recursive: true });

function createPng(filePath, color, width = 640, height = 480) {
  const image = new PNG({ width, height });
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    const offset = pixel * 4;
    image.data[offset] = color[0];
    image.data[offset + 1] = color[1];
    image.data[offset + 2] = color[2];
    image.data[offset + 3] = 255;
  }
  fs.writeFileSync(filePath, PNG.sync.write(image));
}

let stack;
let failure = null;
const watchdog = setTimeout(() => { console.log('SWEEP_A_WATCHDOG'); process.exit(2); }, 300000);

try {
  stack = await bootStack({
    librariesRoot, stateFile, userDataDir,
    beforeElectron: async (apiPort) => {
      const post = async (route, body) => {
        const response = await Promise.race([
          fetch(`http://127.0.0.1:${apiPort}${route}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
          new Promise((_, rej) => setTimeout(() => rej(new Error('fixture timeout')), 15000)),
        ]);
        const payload = await response.json();
        if (!response.ok || payload.status !== 'success') throw new Error(`${route}: ${JSON.stringify(payload)}`);
        return payload.data;
      };
      await post('/api/library/create', { name: 'Sweep', savePath: librariesRoot });
      const colors = [[25, 60, 210], [30, 180, 90], [200, 120, 30]];
      const images = [];
      for (let i = 0; i < 3; i++) {
        const p = path.join(sourcesRoot, `Sweep ${i + 1}.png`);
        createPng(p, colors[i]);
        images.push({ path: p, name: `Sweep ${i + 1}` });
      }
      const txtPath = path.join(sourcesRoot, 'notes.txt');
      fs.writeFileSync(txtPath, 'sweep fixture text\n');
      images.push({ path: txtPath, name: 'notes' });
      await post('/api/item/addFromPaths', { images });
      const folderA = await post('/api/folder/create', { name: '设计参考' });
      await post('/api/folder/create', { name: '子文件夹', parent: folderA.id });
      await post('/api/tag/create', { name: 'sweep-tag' });
    },
  });
  const { page } = stack;
  const sendT = async (method, params, ms = 12000) => {
    const r = await Promise.race([
      page.send(method, params),
      new Promise((resolve) => setTimeout(() => resolve({ __timeout: method }), ms)),
    ]);
    if (r && r.__timeout) throw new Error(`CDP timeout: ${method}`);
    return r;
  };
  const evaluate = async (expression) => {
    const r = await sendT('Runtime.evaluate', { expression, returnByValue: true });
    if (r.exceptionDetails) throw new Error(`eval failed: ${r.exceptionDetails.exception?.description?.slice(0, 200)}`);
    return r.result.value;
  };

  // 事件捕获先于 reload——启动期（导航起）全程在网
  await sendT('Runtime.enable');
  await sendT('Log.enable');
  await sendT('Page.enable');
  await sendT('Page.reload');
  await waitFor(async () => (await evaluate(`document.readyState`)) === 'complete', 'ready', 60000);
  await waitFor(async () => (await evaluate(`!!window.$bodyScope`)) === true, 'scope', 60000);
  await waitFor(async () => {
    const n = await evaluate(`document.querySelectorAll('.box').length`);
    return typeof n === 'number' && n >= 4 ? n : null;
  }, 'boxes', 60000);
  await delay(2500); // 沉淀懒加载/异步初始化期的尾部错误

  // ── 错误普查分类 ──
  const fatalPatterns = /ReferenceError|TypeError|SyntaxError|is not a function|is not defined|Cannot read|Cannot access|undefined is not|null is not|__lv_|$digest/i;
  const seen = new Map();
  for (const message of page.events) {
    let kind = null, text = null;
    if (message.method === 'Runtime.exceptionThrown') {
      kind = 'exception';
      text = message.params.exceptionDetails?.exception?.description || message.params.exceptionDetails?.text || '';
    } else if (message.method === 'Log.entryAdded') {
      const entry = message.params.entry;
      if (entry.level !== 'error') continue;
      kind = `log:${entry.source}`;
      text = `${entry.text} ${entry.url || ''} ${entry.lineNumber ?? ''}`;
    } else if (message.method === 'consoleAPICalled') {
      const p = message.params;
      if (p.type !== 'error') continue;
      kind = `console:${p.type}`;
      text = p.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 300);
    }
    if (!kind) continue;
    const key = `${kind}::${text.slice(0, 160)}`;
    const entry = seen.get(key) || { kind, text: text.slice(0, 300), count: 0, fatal: fatalPatterns.test(text) };
    entry.count += 1;
    seen.set(key, entry);
  }
  const errors = Array.from(seen.values());
  const fatal = errors.filter((e) => e.fatal);
  console.log(`SWEEP_A_ERRORS ${JSON.stringify({ total: errors.length, fatal: fatal.length })}`);
  for (const e of errors) console.log(`SWEEP_A_ERR ${e.fatal ? 'FATAL' : 'noise'} x${e.count} [${e.kind}] ${e.text.replace(/\n/g, ' | ').slice(0, 240)}`);

  // ── DOM 清单（签名普查 + 全部 id）──
  const dom = await evaluate(`(() => {
    const census = {};
    const walk = (el, depth) => {
      if (!el || depth > 5) return;
      const cls = typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\\s+/).slice(0, 2).join('.') : '';
      const sig = el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + cls;
      census[sig] = (census[sig] || 0) + 1;
      for (const c of el.children) walk(c, depth + 1);
    };
    walk(document.body, 0);
    const ids = Array.from(document.querySelectorAll('[id]')).map((e) => e.id);
    return { census, ids };
  })()`);
  fs.writeFileSync(path.join(projectRoot, 'tests-tmp', 'residue-sweep-a-dom.json'), JSON.stringify(dom, null, 1));

  // ── scope 字段清单（sweep B 断言信号备选）──
  const scopeDump = await evaluate(`(() => {
    const s = window.$bodyScope;
    const keys = Object.keys(s);
    return {
      total: keys.length,
      interesting: keys.filter((k) => /view|order|sort|detail|zoom|imagesize|search|filter|select|tag|folder|panel|menu|toolbar|mode|trash|info|rating|rotate/i.test(k)).sort(),
    };
  })()`);
  fs.writeFileSync(path.join(projectRoot, 'tests-tmp', 'residue-sweep-a-scope.json'), JSON.stringify(scopeDump, null, 1));

  const targets = await (await fetch(`http://127.0.0.1:${stack.debugPort}/json/list`)).json();
  console.log(`SWEEP_A_TARGETS ${JSON.stringify(targets.map((t) => ({ type: t.type, url: t.url.slice(0, 80), title: t.title.slice(0, 40) })))}`);
  console.log(`SWEEP_A_OK`);
} catch (err) {
  failure = err;
  console.error(`SWEEP_A_FAIL ${err.message}`);
} finally {
  clearTimeout(watchdog);
  if (stack) { await stop(stack.electron); await stop(stack.vite); await stop(stack.backend); }
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
process.exit(failure ? 1 : 0);
