import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '..');
const apiBase = process.env.EAGLE_API_URL || 'http://127.0.0.1:41695';
const origin = process.env.EAGLE_PREVIEW_ORIGIN || process.env.EAGLE_PREVIEW_URL || 'http://127.0.0.1:5176';
const debugPort = process.env.EAGLE_DEBUG_PORT || 9226;
const mockLibrary = path.join(projectRoot, 'frontend/public/mock-library/Eagle Reverse Demo.library');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-roadmap-panels-'));
const tempLibrary = path.join(tempRoot, 'roadmap-test.library');
const exportFile = path.join(tempRoot, 'roadmap-export.eaglepack');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function api(pathname, options = {}) {
  const response = await fetch(apiBase + pathname, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.status !== 'success') {
    throw new Error(body.message || `HTTP ${response.status}`);
  }
  return body.data;
}

async function waitForJob(jobId) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 20000) {
    const job = await api(`/api/jobs/${encodeURIComponent(jobId)}`);
    if (job.status === 'complete') return job;
    if (job.status === 'error') throw new Error(job.message);
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error('Job timed out');
}

async function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let id = 0;
  const pending = new Map();
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const entry = pending.get(message.id);
      pending.delete(message.id);
      message.error ? entry.reject(new Error(JSON.stringify(message.error))) : entry.resolve(message.result);
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

async function verifyRoadmapPage() {
  const version = await (await fetch(`http://127.0.0.1:${debugPort}/json/version`)).json();
  const browser = await connect(version.webSocketDebuggerUrl);
  const targets = await browser.send('Target.getTargets');
  const pageTarget = targets.targetInfos.find((target) => target.type === 'page');
  assert(pageTarget, 'roadmap debug host has no page target');
  browser.ws.close();

  const page = await connect(`ws://127.0.0.1:${debugPort}/devtools/page/${pageTarget.targetId}`);
  await page.send('Runtime.enable');
  await page.send('Page.enable');
  const pageUrl = `${origin}/roadmap.html?api=${encodeURIComponent(apiBase)}`;
  await page.send('Page.navigate', { url: pageUrl });

  const evalValue = async (expression) => {
    const result = await page.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(`Roadmap page evaluation failed: ${JSON.stringify(result.exceptionDetails)}`);
    return result.result.value;
  };
  const waitForPage = async (check, label, timeout = 10000) => {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const value = await check();
      if (value) return value;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error(`${label} timeout`);
  };

  const initial = await waitForPage(async () => {
    const value = await evalValue(`JSON.stringify({
      title: document.title,
      active: document.querySelector('.panel.active')?.id,
      items: document.querySelectorAll('#batchItems option').length,
      plugins: document.querySelectorAll('.plugin-card').length,
      api: typeof API === 'string' ? API : null
    })`);
    const state = JSON.parse(value);
    return state.title === 'Eagle Roadmap Panels' && state.items > 0 && state.plugins > 0 ? value : null;
  }, 'roadmap initial data');
  const parsed = JSON.parse(initial);
  assert(parsed.active === 'panel-A', `roadmap active panel mismatch: ${initial}`);
  assert(parsed.api === new URL(apiBase).origin, `roadmap API mismatch: ${initial}`);

  await evalValue(`document.querySelector('[data-tab="B"]').click(); true`);
  const tabB = await evalValue(`document.querySelector('#panel-B').classList.contains('active')`);
  assert(tabB, 'roadmap tab B did not activate');

  await evalValue(`
    document.querySelector('[data-tab="D"]').click();
    const input = document.querySelector('#quickKeyword');
    input.value = 'Roadmap';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('#quickSearchButton').click();
    true
  `);
  const quickState = await waitForPage(async () => {
    const value = await evalValue(`JSON.stringify({
      count: document.querySelectorAll('#quickResults .result-item').length,
      text: document.querySelector('#quickResults').textContent.trim()
    })`);
    const state = JSON.parse(value);
    return state.count > 0 || state.text ? value : null;
  }, 'roadmap quick search');
  const quickResult = JSON.parse(quickState);
  assert(quickResult.count > 0, `roadmap quick search returned no results: ${quickState}`);

  page.ws.close();
}

try {
  fs.cpSync(mockLibrary, tempLibrary, { recursive: true });
  await api('/api/library/switch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ libraryPath: tempLibrary }),
  });

  const originalItems = await api('/api/item/list');
  assert(originalItems.length >= 3, 'temporary library should contain at least 3 items');
  const ids = originalItems.slice(0, 3).map((item) => item.id);

  const renamed = await api('/api/item/batchRename', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids, mode: 'format', format: 'Roadmap - %NN', startAt: 1 }),
  });
  assert(renamed.length === ids.length, 'batch rename did not update all selected items');
  let currentItems = await api('/api/item/list');
  assert(currentItems.filter((item) => item.name.startsWith('Roadmap - ')).length === ids.length, 'batch rename names not persisted');

  await api('/api/item/batchUpdate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ids,
      patch: { tags: ['RoadmapTag', 'UI'], annotation: 'Roadmap annotation', star: 5, url: 'https://example.com' },
    }),
  });
  currentItems = await api('/api/item/list');
  const updated = currentItems.filter((item) => ids.includes(item.id));
  assert(updated.every((item) => item.tags.includes('RoadmapTag') && item.star === 5), 'batch update not persisted');

  const targetFolder = await api('/api/folder/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Roadmap Folder' }),
  });
  assert(targetFolder.id, 'temporary library should create a folder');
  await api('/api/item/addToFolder', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids, folderID: targetFolder.id, mode: 'move' }),
  });
  currentItems = await api('/api/item/list');
  assert(currentItems.filter((item) => ids.includes(item.id)).every((item) => item.folders.includes(targetFolder.id)), 'folder assignment not persisted');

  await api('/api/folder/setPassword', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ folderID: targetFolder.id, password: 'secret' }),
  });
  const valid = await api('/api/folder/verifyPassword', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ folderID: targetFolder.id, password: 'secret' }),
  });
  const invalid = await api('/api/folder/verifyPassword', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ folderID: targetFolder.id, password: 'wrong' }),
  });
  assert(valid === true && invalid === false, 'folder password verification failed');
  await api('/api/folder/changePassword', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ folderID: targetFolder.id, currentPassword: 'secret', password: 'new-secret' }),
  });
  const changedValid = await api('/api/folder/verifyPassword', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ folderID: targetFolder.id, password: 'new-secret' }),
  });
  assert(changedValid === true, 'folder password change failed');
  await api('/api/folder/removePassword', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ folderID: targetFolder.id }),
  });

  const tagSource = originalItems[0].tags?.[0] || 'UI';
  const tagTarget = 'RoadmapTagTarget';
  await api('/api/tag/update', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: tagSource, newName: tagTarget }),
  });
  currentItems = await api('/api/item/list');
  assert(currentItems.filter((item) => ids.includes(item.id)).some((item) => item.tags.includes(tagTarget)), 'tag rename not persisted');

  const scanSame = await api('/api/item/duplicates/scan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ method: 'same', ids }),
  });
  const scanSimilar = await api('/api/item/duplicates/scan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ method: 'similar', threshold: 0.5, ids }),
  });
  assert(Array.isArray(scanSame.groups) && Array.isArray(scanSimilar.groups), 'duplicate scan did not return groups');

  await api('/api/item/update', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: ids[0],
      name: 'Inspector Updated',
      annotation: 'Inspector annotation',
      tags: ['InspectorTag', 'UI'],
      star: 4,
      comments: [{ id: 'COMMENT-ROADMAP', text: 'Roadmap comment', modificationTime: Date.now() }],
    }),
  });
  currentItems = await api('/api/item/list');
  const inspected = currentItems.find((item) => item.id === ids[0]);
  assert(inspected.name === 'Inspector Updated' && inspected.annotation === 'Inspector annotation', 'inspector update not persisted');
  assert(inspected.comments.some((comment) => comment.text === 'Roadmap comment'), 'inspector comments not persisted');

  const center = await api('/api/plugins/center');
  assert(Array.isArray(center.plugins) && Array.isArray(center.installed), 'plugin center response invalid');

  currentItems = await api('/api/item/list');
  for (const item of currentItems) {
    const originalPath = path.join(tempLibrary, 'images', `${item.id}.info`, `${item.name}.${item.ext}`);
    assert(fs.existsSync(originalPath), `roadmap item original missing before eaglepack export: ${originalPath}`);
  }

  const job = await api('/api/export/eaglepack/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ destFile: exportFile }),
  });
  const completed = await waitForJob(job.job.id);
  assert(completed.status === 'complete' && completed.result.path, 'eaglepack export job did not complete');

  await verifyRoadmapPage();
  console.log('Roadmap panels test passed');
} finally {
  try {
    await api('/api/library/switch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ libraryPath: mockLibrary }),
    });
  } catch (err) {
    console.warn('Failed to switch library back:', err.message);
  }
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
