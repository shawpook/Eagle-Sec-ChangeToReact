import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '..');
const screenshotDir = path.join(projectRoot, 'screenshots');
const debugPort = process.env.EAGLE_DEBUG_PORT || 9226;
const origin = process.env.EAGLE_PREVIEW_URL || 'http://127.0.0.1:5176';

fs.mkdirSync(screenshotDir, { recursive: true });

async function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let id = 0;
  const pending = new Map();
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const entry = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) entry.reject(new Error(JSON.stringify(msg.error)));
      else entry.resolve(msg.result);
    }
  };
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  return {
    ws,
    send(method, params = {}) {
      return new Promise((resolve, reject) => {
        const msgId = ++id;
        pending.set(msgId, { resolve, reject });
        ws.send(JSON.stringify({ id: msgId, method, params }));
      });
    },
  };
}

const version = await (await fetch(`http://127.0.0.1:${debugPort}/json/version`)).json();
const browser = await connect(version.webSocketDebuggerUrl);
const targets = await browser.send('Target.getTargets');
const pageTarget = targets.targetInfos.find((target) => target.type === 'page');
if (pageTarget) await browser.send('Target.closeTarget', { targetId: pageTarget.targetId });
const created = await browser.send('Target.createTarget', { url: 'about:blank' });
browser.ws.close();

const page = await connect(`ws://127.0.0.1:${debugPort}/devtools/page/${created.targetId}`);
await page.send('Runtime.enable');
await page.send('Page.enable');

const pages = [
  // b1-9bz-E5 收尾：main 是本循环第一页，除应用自身渲染外还要等 vite 对整棵 app 模块图做**冷**
  // 转换（后续页共享缓存故更快）+ 200+ 张懒加载缩略图挂载；实测稳定态 img=203，
  // 但 6s 常不足（固定 sleep 无轮询）。放宽到 25s，判据不变。
  ['main', `${origin}/src/app/index.html`, 25000, () => getComputedStyle(document.body).display !== 'none' && !!document.querySelector('#main-app') && document.body.innerText.includes('智能文件夹') && document.querySelectorAll('img').length > 20],
  ['preferences', `${origin}/src/app/preferences.html`, 6000, () => document.body.innerText.replace(/\s+/g, ' ').length > 200],
  ['workbench', `${origin}/workbench.html`, 4000, () => document.body.innerText.includes('Eagle Reverse Workbench') && document.querySelectorAll('.item-card').length > 0],
  ['roadmap', `${origin}/roadmap.html`, 4000, () => document.body.innerText.includes('Eagle Roadmap Panels') && document.querySelectorAll('nav button').length >= 6],
  ['collect', `${origin}/src/app/collect-window/index.html`, 6000, () => document.querySelectorAll('.select-panel-item').length >= 5],
  ['exif', `${origin}/src/app/exif-viewer/index.html?path=${encodeURIComponent('/mock-library/Eagle Reverse Demo.library/images/MOCK0001.info/Welcome Library.png')}&width=1536&height=960&orientation=1`, 5000, () => document.querySelector('img')?.getAttribute('src').includes('Welcome Library.png')],
  ['font', `${origin}/src/app/font-viewer/font-viewer.html`, 5000, () => document.body.innerText.includes('Moonlight')],
  ['gif', `${origin}/src/app/gif-viewer/index.html?path=${encodeURIComponent('/mock-assets/sample.gif')}&render=normal`, 5000, () => !!document.querySelector('img[src*="sample.gif"]')],
  ['raw', `${origin}/src/app/raw-viewer/index.html?path=${encodeURIComponent('/mock-library/Eagle Reverse Demo.library/images/MOCK0001.info/')}&ext=png&name=${encodeURIComponent('Welcome Library')}&width=1536&height=960&orientation=1`, 5000, () => !!document.querySelector('img[src*="thumbnail"]')],
  ['text-editor', `${origin}/src/app/text-editor/text-editor.html?theme=dark&language=zh_CN`, 5000, () => document.body.innerText.includes('Eagle Reverse text editor sample')],
  ['native', `${origin}/src/app/native-viewer/index.html?path=${encodeURIComponent('/mock-library/Eagle Reverse Demo.library/images/MOCK0001.info/')}&name=${encodeURIComponent('Welcome Library.png')}&id=MOCK0001&ext=png&width=1536&height=960`, 5000, () => document.body.classList.contains('ready')],
  ['model', `${origin}/src/app/model-viewer/website/index.html#model=/mock-assets/box.glb`, 8000, () => document.querySelector('#main_file_name')?.textContent === 'box.glb'],
  ['pdf', `${origin}/src/app/pdf-viewer/web/viewer.html?path=${encodeURIComponent('/mock-assets/sample.pdf')}`, 8000, () => !!document.querySelector('.pdfViewer .page')],
  ['plugin', 'http://127.0.0.1:41695/plugins/eagle-reverse-example-service/index.html', 3000, () => document.body.innerText.includes('Eagle Reverse Example Service') && typeof window.eagle !== 'undefined'],
  ['video', `${origin}/media-viewer/video.html?path=${encodeURIComponent('/mock-assets/sample.webp')}`, 3000, () => !!document.querySelector('video')?.src],
  ['audio', `${origin}/media-viewer/audio.html?path=${encodeURIComponent('/mock-assets/sample.wav')}`, 5000, () => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return false;
    const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    for (let i = 0; i < data.length; i += 4) if (data[i + 3] > 0) return true;
    return false;
  }],
  ['extension', `${origin}/browser-extension/popup.html`, 3000, () => document.body.innerText.includes('Eagle Reverse Collector') && document.querySelectorAll('button').length >= 3],
];

const results = [];
for (const [name, url, wait, verify] of pages) {
  await page.send('Page.navigate', { url });
  await new Promise((resolve) => setTimeout(resolve, wait));
  const evalResult = await page.send('Runtime.evaluate', {
    expression: `Boolean((${verify.toString()})())`,
    returnByValue: true,
  });
  const screenshot = await page.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(screenshotDir, `${name}.png`), Buffer.from(screenshot.data, 'base64'));
  const ok = evalResult.result.value === true;
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name} -> screenshots/${name}.png`);
}

page.ws.close();
const failed = results.filter((entry) => !entry.ok);
if (failed.length > 0) {
  console.error(`screenshot regression failed: ${failed.length}/${results.length}`);
  process.exit(1);
}
console.log(`screenshot regression passed: ${results.length}/${results.length}`);
