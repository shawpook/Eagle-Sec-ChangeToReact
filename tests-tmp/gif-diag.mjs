// 一次性诊断（禁提交）：gif iframe 链路分段定位
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bootStack, stop, waitFor } from "../tests/react-cdp-harness.mjs";

const gifFixturePath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'frontend', 'public', 'mock-assets', 'sample.gif');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-gif-diag-'));
const librariesRoot = path.join(tempRoot, 'libraries');
const stateFile = path.join(tempRoot, 'library-state.json');
const userDataDir = path.join(tempRoot, 'user-data');
fs.mkdirSync(librariesRoot, { recursive: true });
const stack = await bootStack({ librariesRoot, stateFile, userDataDir });
const { page } = stack;

await waitFor(async () => {
  const r = await page.send('Runtime.evaluate', { expression: `!!document.getElementById('eagle-react-host')`, returnByValue: true });
  return r.result.value === true;
}, 'react host', 45000);

const r1 = await page.send('Runtime.evaluate', {
  expression: `(function () {
    window.__diag = { console: [], glue: null, loaded: null, onFin: null, err: null, frames: null, ready: null, src: null };
    const origErr = console.error;
    const f = document.createElement('iframe');
    f.style.display = 'none';
    f.src = '/src/app/gif-viewer/index.html?path=' + encodeURIComponent(${JSON.stringify(gifFixturePath)}) + '&render=normal';
    f.onload = function () {
      setTimeout(function () {
        try {
          const d = f.contentDocument;
          const ins = d.getElementById('gif-player-ins');
          window.__diag.src = ins && ins.getAttribute('src');
          window.__diag.glue = d.body.className;
        } catch (err) { window.__diag.err = 'glue: ' + err.message; }
      }, 300);
    };
    document.body.appendChild(f);
    let polls = 0;
    const poll = setInterval(function () {
      polls++;
      try {
        const d = f.contentDocument;
        window.__diag.loaded = d && d.body.className;
        const s = window.$bodyScope;
        window.__diag.ready = s ? s.isGifReady : 'no-scope';
        window.__diag.frames = s && s.gifViewer && s.gifViewer.frames ? s.gifViewer.frames.length : 'none';
        if (polls > 60) clearInterval(poll);
      } catch (err) { window.__diag.err = 'poll: ' + err.message; }
    }, 500);
  })()`,
  returnByValue: true,
});
console.log('kickoff:', JSON.stringify(r1.result.value));

await new Promise((res) => setTimeout(res, 15000));
const r2 = await page.send('Runtime.evaluate', { expression: `JSON.stringify(window.__diag)`, returnByValue: true });
console.log('DIAG:', r2.result.value);
await stop(stack);
