const debugPort = process.env.EAGLE_DEBUG_PORT || 9226;
const origin = process.env.EAGLE_PREVIEW_URL || 'http://127.0.0.1:5174';

const version = await (await fetch(`http://127.0.0.1:${debugPort}/json/version`)).json();
const browserWs = new WebSocket(version.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const msgId = ++id;
    pending.set(msgId, { resolve, reject });
    browserWs.send(JSON.stringify({ id: msgId, method, params }));
  });
}
browserWs.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.id && pending.has(msg.id)) {
    const entry = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? entry.reject(new Error(JSON.stringify(msg.error))) : entry.resolve(msg.result);
  }
};
await new Promise((resolve, reject) => { browserWs.onopen = resolve; browserWs.onerror = reject; });
const targets = await send('Target.getTargets');
for (const target of targets.targetInfos.filter((entry) => entry.type === 'page')) {
  await send('Target.closeTarget', { targetId: target.targetId });
}
const created = await send('Target.createTarget', { url: `${origin}/workbench.html` });
browserWs.close();

const pageWs = new WebSocket(`ws://127.0.0.1:${debugPort}/devtools/page/${created.targetId}`);
let pageId = 0;
const pagePending = new Map();
function pageSend(method, params = {}) {
  return new Promise((resolve, reject) => {
    const msgId = ++pageId;
    pagePending.set(msgId, { resolve, reject });
    pageWs.send(JSON.stringify({ id: msgId, method, params }));
  });
}
pageWs.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.id && pagePending.has(msg.id)) {
    const entry = pagePending.get(msg.id);
    pagePending.delete(msg.id);
    msg.error ? entry.reject(new Error(JSON.stringify(msg.error))) : entry.resolve(msg.result);
  }
};
await new Promise((resolve, reject) => { pageWs.onopen = resolve; pageWs.onerror = reject; });
await pageSend('Runtime.enable');
await pageSend('Page.enable');
await new Promise((resolve) => setTimeout(resolve, 4000));

async function evalValue(expression) {
  const result = await pageSend('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  return result.result.value;
}

await evalValue(`localStorage.clear(); true`);
await pageSend('Page.reload', { ignoreCache: true });
await new Promise((resolve) => setTimeout(resolve, 4000));

const initial = await evalValue(`JSON.stringify({ theme: document.documentElement.dataset.theme, list: document.querySelector('#itemGrid').classList.contains('list-view') })`);
if (initial !== '{"theme":"dark","list":false}') throw new Error(`initial workbench state mismatch: ${initial}`);

await evalValue(`document.querySelector('#menuButton').click(); true`);
const menuVisible = await evalValue(`document.querySelector('#menuPopover').classList.contains('visible')`);
if (!menuVisible) throw new Error('hamburger menu did not open');
await evalValue(`document.querySelector('#menuPopover').classList.remove('visible'); true`);

await evalValue(`document.querySelector('.item-card').click(); true`);
const inspector = await evalValue(`document.querySelector('#inspector').innerText`);
if (!inspector.includes('Name') || !inspector.includes('Tags')) throw new Error('inspector did not render selected item');

await evalValue(`document.querySelector('#themeToggle').click(); document.querySelector('#listButton').click(); true`);
const changed = await evalValue(`JSON.stringify({ theme: document.documentElement.dataset.theme, list: document.querySelector('#itemGrid').classList.contains('list-view') })`);
if (changed !== '{"theme":"light","list":true}') throw new Error(`workbench interactions failed: ${changed}`);

await evalValue(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true })); true`);
const focused = await evalValue(`document.activeElement && document.activeElement.id`);
if (focused !== 'searchKeyword') throw new Error(`shortcut focus failed: ${focused}`);

pageWs.close();
console.log('Workbench interactions test passed');
