import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { bootStack, stop, waitFor, delay } from './react-cdp-harness.mjs';

// A real, isolated library built in one pass, so testing scrolling does not spend minutes
// exercising the import transaction for every fixture. Images and thumbnails stay on disk.
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-continuous-grid-'));
const libraryPath = path.join(root, 'Continuous.library');
const count = 600;
fs.mkdirSync(path.join(libraryPath, 'images'), { recursive: true });
const writeJson = (file, value) => fs.writeFileSync(file, JSON.stringify(value));
writeJson(path.join(libraryPath, 'metadata.json'), {
  applicationVersion: '4.0.0', folders: [{ id: 'SCROLL-FOLDER', name: 'Scroll folder', children: [
    { id: 'SCROLL-CHILD', name: 'Child folder', children: [] },
  ] }, { id: 'SCROLL-SPARSE', name: 'Sparse folder', children: [] }],
  smartFolders: [], quickAccess: [], tagsGroups: [], modificationTime: Date.now(),
});
writeJson(path.join(libraryPath, 'tags.json'), { historyTags: [], starredTags: [] });
writeJson(path.join(libraryPath, 'saved-filters.json'), []);
const dimensions = [[180, 120], [120, 180], [160, 160], [320, 90], [90, 360]];
const images = await Promise.all(dimensions.map(async ([width, height], index) =>
  sharp({ create: { width, height, channels: 4, background: { r: 40 + index * 35, g: 110, b: 175, alpha: 1 } } }).png().toBuffer()));
for (let i = 0; i < count; i++) {
  const id = `SCROLL-${String(i).padStart(4, '0')}`;
  const name = `Scroll fixture ${String(i).padStart(4, '0')}`;
  const index = i % dimensions.length;
  const [width, height] = dimensions[index];
  const directory = path.join(libraryPath, 'images', `${id}.info`);
  fs.mkdirSync(directory);
  writeJson(path.join(directory, 'metadata.json'), {
    id, name, ext: 'png', width, height, size: images[index].length, tags: [],
    folders: i < 360 ? ['SCROLL-FOLDER'] : i >= count - 7 ? ['SCROLL-SPARSE'] : [],
    star: 0, isDeleted: false, noThumbnail: false,
    modificationTime: 1700000000000 + i, lastModified: 1700000000000 + i,
    comments: [], annotation: '', url: '',
    palettes: [{ color: [40 + index * 35, 110, 175], ratio: 1 }],
  });
  fs.writeFileSync(path.join(directory, `${name}.png`), images[index]);
  fs.writeFileSync(path.join(directory, `${name}_thumbnail.png`), images[index]);
}

let stack;
try {
  stack = await bootStack({
    librariesRoot: root, stateFile: path.join(root, 'state.json'), userDataDir: path.join(root, 'user'),
    beforeElectron: async (port) => {
      const response = await fetch(`http://127.0.0.1:${port}/api/library/switch`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ libraryPath }),
      });
      assert.equal((await response.json()).status, 'success');
    },
  });
  const { page } = stack;
  await page.send('Page.bringToFront');
  const evaluate = async (expression) => {
    const result = await page.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true, timeout: 15000 });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  await waitFor(() => evaluate(`window.__eagleProbe?.allData?.length === ${count} && !!document.querySelector('#box-list .box')`), 'full list ready', 45000);
  await delay(500);
  await evaluate(`(async () => { window.__gridModule = await import('/src/app/react/components/grid/boxGridEngine.ts');
    window.__gridService = await import('/src/app/react/services/gridService.ts');
    window.__folderService = await import('/src/app/react/services/folderCoreService.ts');
    window.__selectionService = await import('/src/app/react/services/selectionService.ts');
    window.__batchService = await import('/src/app/react/services/batchOpsService.ts');
    window.__miscDomain = await import('/src/app/react/core/miscDomain.ts');
    window.__scrollSamples = []; window.__resetCount = 0; window.__gridWrites = [];
    const reset = window.resetNgGridLayoutData;
    window.resetNgGridLayoutData = (...args) => { __resetCount++; return reset(...args); };
    const container = document.getElementById('box-container');
    const descriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollTop');
    Object.defineProperty(container, 'scrollTop', { configurable:true,
      get() { return descriptor.get.call(this); },
      set(top) { __gridWrites.push({top,stack:new Error().stack.split('\\n').slice(1,5)}); descriptor.set.call(this, top); } });
    container.addEventListener('scroll', e =>
      __scrollSamples.push({top:e.target.scrollTop,height:e.target.scrollHeight})); })()`);

  const snapshot = () => evaluate(`(() => {
    const c = document.getElementById('box-container'), r = c.getBoundingClientRect();
    const boxes = [...document.querySelectorAll('#box-list .box')];
    return { top:c.scrollTop, height:c.scrollHeight, viewport:c.clientHeight, width:c.clientWidth,
      x:r.x, y:r.y, right:r.right, gutter:c.offsetWidth-c.clientWidth,
      mounted:boxes.length, first:Number(boxes[0]?.dataset.gridIndex), last:Number(boxes.at(-1)?.dataset.gridIndex),
      resets:__resetCount, version:__gridModule.getEngineVersion(),
      ready:boxes.filter(b => b.classList.contains('show')).length };
  })()`);
  const waitForFrame = () => evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
  const waitForThumbnails = async () => {
    await waitFor(() => evaluate(`(() => {
      const container = document.getElementById('box-container').getBoundingClientRect();
      const images = [...document.querySelectorAll('#box-list .box img')].filter(img => {
        const rect = img.closest('.box').getBoundingClientRect();
        return rect.bottom > container.top && rect.top < container.bottom;
      });
      return images.length > 0 && images.every(img => img.naturalWidth > 0 && img.closest('.box').classList.contains('show'));
    })()`), 'all visible thumbnails loaded', 15000);
  };
  const thumbnailUrl = await evaluate(`document.querySelector('#box-list .box img')?.getAttribute('lsrc')`);
  if (thumbnailUrl) {
    const started = Date.now();
    const response = await fetch(thumbnailUrl, { signal: AbortSignal.timeout(5000) });
    const bytes = (await response.arrayBuffer()).byteLength;
    console.log('THUMBNAIL HTTP', { status:response.status, bytes, elapsed:Date.now()-started });
    assert.equal(response.status, 200, 'fixture thumbnail is served by the real application');
  }
  await waitForThumbnails();
  const initial = await snapshot();
  assert.ok(initial.mounted < count / 2, 'DOM is limited to the viewport and overscan');
  assert.ok(initial.height > initial.viewport * 5, 'one container represents the entire list');
  assert.ok(initial.gutter > 0, 'native scrollbar is available');
  console.log('PASS full-list geometry', initial);

  const wheelPoint = { x: initial.x + initial.width / 2, y: initial.y + initial.viewport / 2 };
  if (!process.env.EAGLE_GRID_SKIP_POINTER) {
    for (let i = 0; i < 40; i++) {
      await page.send('Input.dispatchMouseEvent', { type: 'mouseWheel', ...wheelPoint, deltaX: 0, deltaY: 240 });
      await delay(20);
    }
    await delay(250);
    const down = await snapshot();
    const samples = await evaluate('__scrollSamples');
    assert.equal(down.resets, 0, 'wheel input must not reset or reload the grid');
    assert.equal(down.version, initial.version, 'wheel input only updates the viewport');
    assert.ok(down.first > 60, 'wheel reaches beyond the former first page');
    assert.ok(samples.every((sample, index) => sample.height === initial.height && (!index || sample.top >= samples[index - 1].top)),
      'downward wheel movement is monotonic with a constant scroll height');
    console.log('PASS wheel across former page boundaries', { samples: samples.length, top: down.top, first: down.first });

    await evaluate('__gridService.machineryGotoTop()');
    await waitFor(async () => (await snapshot()).top === 0, 'goto top');
    const start = await snapshot();
    const thumbHeight = Math.max(30, start.viewport * start.viewport / start.height);
    const travel = start.viewport - thumbHeight;
    const x = start.right - start.gutter / 2;
    const y = start.y + thumbHeight / 2;
    const mouse = (type, dy, buttons = 1) => page.send('Input.dispatchMouseEvent', {
      type, x, y: y + dy, button: 'left', buttons, clickCount: 1,
    });
    await mouse('mousePressed', 0);
    const dragDown = [];
    for (let i = 1; i <= 12; i++) {
      await mouse('mouseMoved', travel * i / 16);
      await waitForFrame();
      dragDown.push((await snapshot()).top);
    }
    assert.ok(dragDown.at(-1) > (start.height - start.viewport) * 0.65, 'native thumb reaches deep items');
    assert.ok(dragDown.every((top, index) => !index || top >= dragDown[index - 1]), 'dragging down never scrolls up');
    const held = (await snapshot()).top;
    await delay(350);
    assert.equal((await snapshot()).top, held, 'stationary mouse does not replay delayed scroll writes');
    const dragUp = [];
    for (let i = 11; i >= 0; i--) {
      await mouse('mouseMoved', travel * i / 16);
      await waitForFrame();
      dragUp.push((await snapshot()).top);
    }
    await mouse('mouseReleased', 0, 0);
    assert.equal((await evaluate('__gridWrites')).length, 1, 'dragging has no programmatic scroll writes after goto top');
    assert.ok(dragUp.every((top, index) => !index || top <= dragUp[index - 1]), 'dragging up never scrolls down');
    assert.ok((await snapshot()).top <= 2, 'thumb returns to the beginning');
    assert.equal((await snapshot()).resets, 0, 'thumb dragging never reloads the list');
    for (let i = 0; i < dragDown.length; i++) {
      const expected = (start.height - start.viewport) * (i + 1) / 16;
      // CDP mouse coordinates round to device pixels; allow one thumb pixel of content travel.
      assert.ok(Math.abs(dragDown[i] - expected) < Math.max(4, (start.height - start.viewport) / travel + 2), 'thumb and content use the same pixel mapping');
    }
    console.log('PASS native scrollbar down/up/hold', { down: dragDown, up: dragUp });

    await evaluate('__gridService.machineryGotoBottom()');
    await waitFor(async () => { const state = await snapshot(); return state.last === count - 1 && state.height - state.viewport - state.top <= 1; }, 'last item reachable');
    await delay(350);
    assert.equal((await snapshot()).resets, 0, 'end navigation does not reload');
    await page.send('Input.dispatchMouseEvent', { type: 'mouseWheel', ...wheelPoint, deltaX: 0, deltaY: -420 });
    await delay(400);
    const reversed = await snapshot();
    assert.ok(reversed.top < reversed.height - reversed.viewport - 100, 'wheel reverses immediately at list end');
    assert.equal(reversed.height, initial.height, 'thumbnail mounts do not change total height');
    console.log('PASS last item and reverse wheel');
    await waitForThumbnails();
    console.log('PASS visible thumbnails after rapid scrolling');

  }

  const goTo = async (top) => {
    await evaluate(`__gridModule.scrollGridToOffset(${top})`);
    await waitFor(async () => Math.abs((await snapshot()).top - top) <= 1, `scroll to ${top}`);
    await waitForFrame();
  };
  const assertAnchor = async (position, label) => {
    await waitFor(async () => {
      const offset = await evaluate(`(() => {
        const box = document.getElementById('box-' + ${JSON.stringify(position.anchor.id)});
        return box ? document.getElementById('box-container').getBoundingClientRect().top - box.getBoundingClientRect().top : null;
      })()`);
      return offset != null && Math.abs(offset - position.anchor.offset) <= 1;
    }, label, 5000);
  };
  const shot = async (name) => {
    await waitForThumbnails();
    fs.mkdirSync('test-run', { recursive: true });
    let timeout;
    try {
      // Electron 22 occasionally stalls capture even while Runtime/Input remain responsive.
      const result = await Promise.race([
        page.send('Page.captureScreenshot', { format:'png', captureBeyondViewport:false }),
        new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('capture timeout')), 5000); }),
      ]);
      fs.writeFileSync(`test-run/continuous-grid-${name}.png`, Buffer.from(result.data, 'base64'));
    } catch (error) {
      console.log(`WARN optional ${name} screenshot: ${error.message}`);
    } finally { clearTimeout(timeout); }
  };
  for (const mode of ['GridLayout', 'SquareLayout', 'ListLayout', 'JustifiedLayout']) {
    await evaluate(`__gridService.gridSwitchLayout(${JSON.stringify(mode)})`);
    await waitForFrame();
    await goTo(2000);
    const before = await snapshot();
    await evaluate('__scrollSamples = []; __gridWrites = []');
    for (let i = 0; i < 8; i++) {
      await page.send('Input.dispatchMouseEvent', { type:'mouseWheel', ...wheelPoint, deltaX:0, deltaY:240 });
      await delay(30);
    }
    await delay(200);
    const after = await snapshot();
    assert.ok(after.top > before.top + 1000, `${mode} scrolls through its continuous list`);
    assert.equal(after.height, before.height, `${mode} keeps the full scroll range`);
    assert.equal(after.resets, before.resets, `${mode} does not reload on scroll`);
    assert.equal(after.version, before.version, `${mode} does not rebuild on scroll`);
    assert.deepEqual(await evaluate('__gridWrites'), [], `${mode} has no programmatic scroll writes`);
    assert.ok(await evaluate(`(() => {
      const boxes = [...document.querySelectorAll('#box-list .box')];
      return boxes.every(box => {
        const thumbnail = box.querySelector('.thumbnail').getBoundingClientRect();
        const rect = box.getBoundingClientRect();
        return thumbnail.height <= rect.height + 1;
      });
    })()`), `${mode} thumbnails fit their rows`);
    await shot(mode);
    console.log(`PASS ${mode} real wheel, geometry, thumbnails`);
  }

  await goTo(6200);
  const beforeZoom = await evaluate('__gridModule.getGridScrollPosition()');
  const zoomHeight = (await snapshot()).height;
  await evaluate('__gridService.gridZoomIn()');
  await waitFor(async () => (await snapshot()).height !== zoomHeight, 'zoom changes geometry');
  await assertAnchor(beforeZoom, 'zoom preserves the visible item and pixel offset');
  const beforeResize = await evaluate('__gridModule.getGridScrollPosition()');
  const windowSize = await evaluate('({width:innerWidth,height:innerHeight})');
  const beforeWidth = (await snapshot()).width;
  await page.send('Emulation.setDeviceMetricsOverride', { width:windowSize.width + 160, height:windowSize.height, deviceScaleFactor:1, mobile:false });
  await waitFor(async () => (await snapshot()).width !== beforeWidth, 'viewport width changed');
  await assertAnchor(beforeResize, 'viewport resize preserves the visible item and pixel offset');
  await page.send('Emulation.clearDeviceMetricsOverride');
  await waitForFrame();
  console.log('PASS zoom and viewport resize keep the item anchor');

  await evaluate('__miscDomain.machineryShowListName(); __miscDomain.machineryShowListMetas()');
  await waitForFrame();
  assert.ok(await evaluate(`(() => {
    const box = document.querySelector('#box-list .box');
    return getComputedStyle(box.querySelector('.name')).display === 'none'
      && getComputedStyle(box.querySelector('.metas')).display === 'none'
      && Math.abs(box.getBoundingClientRect().height - box.querySelector('.thumbnail').getBoundingClientRect().height) <= 1;
  })()`), 'hidden captions reserve no empty space');
  await shot('hidden-captions');
  await evaluate('__miscDomain.machineryShowListName(); __miscDomain.machineryShowListMetas()');
  await waitForFrame();
  console.log('PASS caption visibility follows continuous geometry');

  await goTo(4500);
  const beforeUpdate = await evaluate('__gridModule.getGridScrollPosition()');
  await evaluate(`window.__originalGridItems = __eagleProbe.allData;
    __eagleProbe.allData = __eagleProbe.allData.slice(5, -5)`);
  await waitFor(() => evaluate(`__gridModule.getEngineState().items.length === ${count - 10}`), 'offscreen removals reach the full list');
  await assertAnchor(beforeUpdate, 'data updates retain the visible item');
  await evaluate('__eagleProbe.allData = __originalGridItems; delete window.__originalGridItems');
  await waitFor(() => evaluate(`__gridModule.getEngineState().items.length === ${count}`), 'full result restored');
  console.log('PASS same-view data updates include offscreen items and keep position');

  const openFolder = async (id, length) => {
    await evaluate(`__folderService.openFolder(__eagleProbe.folderMappings[${JSON.stringify(id)}])`);
    await waitFor(() => evaluate(`__gridModule.getEngineState().viewKey === __gridModule.gridViewKey()
      && __gridModule.getEngineState().items.length === ${length} && !__gridModule.getEngineState().pendingScroll`), `folder ${id} ready`);
    await waitForFrame();
  };
  await goTo(4500);
  const savedAll = await evaluate('__gridModule.getGridScrollPosition()');
  await openFolder('SCROLL-FOLDER', 360);
  assert.equal((await snapshot()).top, 0, 'first folder visit starts at the top');
  assert.ok(await evaluate(`document.getElementById('eagle-sub-folder-host').getBoundingClientRect().height > 0`), 'subfolder section participates in the scroll container');
  await goTo(3500);
  const savedFolder = await evaluate('__gridModule.getGridScrollPosition()');
  await evaluate('__folderService.machineryOpenAll()');
  await waitFor(() => evaluate(`__gridModule.getEngineState().items.length === ${count} && !__gridModule.getEngineState().pendingScroll`), 'all items restored');
  await assertAnchor(savedAll, 'all view restores its item position');
  await openFolder('SCROLL-FOLDER', 360);
  await assertAnchor(savedFolder, 'folder restores position including the subfolder origin');
  const restoredFolder = await snapshot();
  await evaluate('__gridWrites = []');
  for (let i = 0; i < 5; i++) {
    await page.send('Input.dispatchMouseEvent', { type:'mouseWheel', ...wheelPoint, deltaX:0, deltaY:180 });
    await delay(30);
  }
  await delay(450);
  assert.ok((await snapshot()).top > restoredFolder.top + 700, 'new input wins immediately after restoring a folder');
  assert.deepEqual(await evaluate('__gridWrites'), [], 'folder restoration is never replayed by timers');
  await evaluate(`__gridService.gridSwitchLayout('ListLayout')`);
  await waitForFrame();
  await goTo(0);
  await shot('folder-list');
  console.log('PASS folder return, subfolder/header geometry and immediate input');

  const targetId = await evaluate('__gridModule.getEngineState().items[280].id');
  assert.equal(await evaluate(`!!document.getElementById('box-' + ${JSON.stringify(targetId)})`), false, 'target starts outside the mounted window');
  const beforeSelect = await snapshot();
  await evaluate(`__selectionService.select(undefined, __eagleProbe.itemMappings[${JSON.stringify(targetId)}]); __batchService.scrollToSelectedItem()`);
  await waitFor(() => evaluate(`(() => {
    const box = document.getElementById('box-' + ${JSON.stringify(targetId)});
    const c = document.getElementById('box-container').getBoundingClientRect();
    const r = box?.getBoundingClientRect();
    return r && r.bottom > c.top && r.top < c.bottom;
  })()`), 'offscreen selected item revealed');
  assert.equal((await snapshot()).resets, beforeSelect.resets, 'selection navigation does not reload');
  console.log('PASS offscreen selection uses full-list coordinates');

  await goTo(0);
  assert.equal(await evaluate(`!!document.getElementById('box-' + ${JSON.stringify(targetId)})`), false, 'auto-scroll target starts outside the mounted window');
  const beforeAutoScroll = await snapshot();
  await evaluate(`window.__autoScrollItems = __gridModule.getEngineState().items;
    window.__autoScrollLayoutVersion = __gridModule.getEngineState().layoutVersion`);
  await evaluate('__gridService.machineryAutoScroll(280)');
  await waitFor(() => evaluate(`(() => {
    const box = document.getElementById('box-' + ${JSON.stringify(targetId)});
    const c = document.getElementById('box-container').getBoundingClientRect();
    const r = box?.getBoundingClientRect();
    return r && r.bottom > c.top && r.top < c.bottom;
  })()`), 'auto-scroll command reveals the selected item');
  const afterAutoScroll = await snapshot();
  assert.equal(afterAutoScroll.resets, beforeAutoScroll.resets, 'auto-scroll command does not reload');
  assert.equal(afterAutoScroll.height, beforeAutoScroll.height, 'auto-scroll command keeps the full scroll range');
  assert.ok(await evaluate(`__gridModule.getEngineState().items === __autoScrollItems
    && __gridModule.getEngineState().layoutVersion === __autoScrollLayoutVersion`), 'auto-scroll command preserves list data and layout');
  await evaluate('delete window.__autoScrollItems; delete window.__autoScrollLayoutVersion');
  console.log('PASS auto-scroll command reaches the continuous list through its event channel');

  await openFolder('SCROLL-SPARSE', 7);
  await shot('sparse');
  assert.equal((await snapshot()).mounted, 7, 'sparse folder renders all of its items');
  await openFolder('SCROLL-CHILD', 0);
  assert.equal((await snapshot()).mounted, 0, 'empty folder has no stale items');
  assert.equal((await snapshot()).top, 0, 'empty folder has no stale scroll position');
  console.log('PASS sparse and empty folders');
  const exceptions = page.events.filter(event => event.method === 'Runtime.exceptionThrown');
  assert.deepEqual(exceptions.map(event => event.params.exceptionDetails.exception?.description || event.params.exceptionDetails.text), [], 'scrolling has no unhandled renderer errors');
  console.log('PASS continuous grid scrolling');
} catch (error) {
  console.error('VITE LOG', stack?.vite.output().slice(-1500));
  console.error('BACKEND LOG', stack?.backend.output().slice(-1500));
  if (stack?.page) {
    console.error('GRID STATE', await stack.page.send('Runtime.evaluate', { expression: `JSON.stringify({
      ready:document.readyState,total:window.__eagleProbe?.allData?.length,raw:window.__eagleProbe?.raw?.length,
      loaded:document.querySelectorAll('#box-list .box.show').length,boxes:document.querySelectorAll('#box-list .box').length,
      html:document.getElementById('box-list')?.innerHTML.slice(0,1000),
      calculated:window.__eagleProbe?.isItemBindCalculated,lazy:!!window.__eagleProbe?.lazyLoadManager,
      images:[...document.querySelectorAll('#box-list .box img')].slice(0,3).map(i=>({src:i.src,lsrc:i.getAttribute('lsrc'),complete:i.complete,width:i.naturalWidth})),
      container:document.getElementById('box-container')?.getBoundingClientRect().toJSON(),
      classes:document.getElementById('box-container')?.className,
      lazyState:window.__eagleProbe?.lazyLoadManager && {
        queue:[...__eagleProbe.lazyLoadManager.loadingQueue.keys()],
        pending:__eagleProbe.lazyLoadManager.pendingQueue.map(entry=>entry.box.id),
        timeouts:[...__eagleProbe.lazyLoadManager.loadingTimeouts.keys()] } })`, returnByValue:true }));
  }
  const exceptions = stack?.page?.events?.filter((event) => event.method === 'Runtime.exceptionThrown').slice(-5);
  if (exceptions?.length) console.error(exceptions.map(event => event.params.exceptionDetails.exception?.description || event.params.exceptionDetails.text));
  throw error;
} finally {
  if (stack) {
    stack.page.ws.close();
    await stop(stack.electron);
    await stop(stack.vite);
    await stop(stack.backend);
  }
}
