/**
 * M6-4: real-Electron gate for <webview> guest creation and format plugin preload.
 *
 * Host:
 *   electron/main.cjs --regression-host
 *   EAGLE_PREVIEW_URL = http://127.0.0.1:<vite-port>/src/app/index.html
 *
 * The test imports the real pluginFormatPreload.ts through Vite, feeds its resolved
 * file:// URL into a real <webview>, and verifies the format extension preload ran
 * in the guest by observing the `eagle` API it installs.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { bootStack, delay, stop, waitFor } from './react-cdp-harness.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const expectedFormatPreload = path.resolve(
  projectRoot,
  'src/app/js/plugin/api-format-extension.js',
);
const guestPagePath = '/src/app/registration.html?m6-webview-tag-probe=1';

async function evaluate(page, expression, retries = 20) {
  let result;
  try {
    result = await page.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
  } catch (err) {
    if (retries > 0 && /Execution context was destroyed|Cannot find context/i.test(String(err && err.message))) {
      await delay(100);
      return evaluate(page, expression, retries - 1);
    }
    throw err;
  }
  if (result.exceptionDetails) {
    const detail = result.exceptionDetails.exception?.description
      || result.exceptionDetails.text
      || 'Runtime.evaluate failed';
    throw new Error(detail);
  }
  return result.result.value;
}

async function readProbe(page) {
  return evaluate(page, 'window.__m6WebviewTagProbe || null');
}

async function forceKillTree(processInfo) {
  const child = processInfo && processInfo.child;
  if (process.platform !== 'win32' || !child || !child.pid || child.exitCode !== null) return;
  await new Promise((resolve) => {
    const killer = spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    killer.once('exit', resolve);
    killer.once('error', resolve);
  });
}

async function removeTempRoot(tempRoot) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    try {
      fs.rmSync(tempRoot, { recursive: true, force: true });
      return;
    } catch (err) {
      if (!['EBUSY', 'EPERM', 'ENOTEMPTY'].includes(err.code) || attempt === 11) throw err;
      await delay(250);
    }
  }
}

test('webviewTag enables guest creation and the real format preload', { timeout: 120000 }, async (t) => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-m6-webview-tag-'));
  const stack = await bootStack({
    librariesRoot: path.join(tempRoot, 'libraries'),
    stateFile: path.join(tempRoot, 'library-state.json'),
    userDataDir: path.join(tempRoot, 'electron-user-data'),
  });

  try {
    console.log(`M6_WEBVIEW_HOST ${JSON.stringify({
      entry: 'electron/main.cjs --regression-host',
      page: `http://127.0.0.1:${stack.vitePort}/src/app/index.html`,
      guestPage: `http://127.0.0.1:${stack.vitePort}${guestPagePath}`,
      debugPort: stack.debugPort,
    })}`);

    await waitFor(async () => {
      const ready = await evaluate(stack.page, 'document.readyState');
      return ready === 'complete';
    }, 'main window document ready', 30000);

    const origin = `http://127.0.0.1:${stack.vitePort}`;
    const initialState = await evaluate(stack.page, `(async () => {
      const origin = ${JSON.stringify(origin)};
      const resolverUrl = new URL(
        '/src/app/react/core/pluginFormatPreload.ts?m6-webview-tag=1',
        origin,
      ).href;
      const environment = await import(new URL(
        '/src/app/react/core/shim/environment.ts',
        origin,
      ).href);
      const resolver = await import(resolverUrl);
      const resolution = resolver.resolveFormatExtensionPreloadFromHost();
      const element = document.createElement('webview');
      const state = {
        resolution,
        preAppendUpgraded: typeof element.getWebContentsId === 'function',
        constructorName: element.constructor && element.constructor.name,
        appended: false,
        postAppendUpgraded: false,
        webContentsId: null,
        preloadAttribute: null,
        guestUrl: new URL(${JSON.stringify(guestPagePath)}, origin).href,
        events: [],
        webviewTagGapRegistered: Object.prototype.hasOwnProperty.call(
          environment.unavailableCapabilities,
          'webview.tag-disabled',
        ),
      };
      window.__m6WebviewTagProbe = state;
      if (!resolution.ok) return state;

      element.id = 'm6-webview-tag-probe';
      element.setAttribute('preload', resolution.preloadUrl);
      element.setAttribute('nodeintegration', '');
      element.setAttribute('webpreferences', 'contextIsolation=false');
      element.setAttribute('src', state.guestUrl);
      for (const eventName of ['did-attach', 'dom-ready', 'did-finish-load', 'did-fail-load']) {
        element.addEventListener(eventName, (event) => {
          state.events.push({
            name: eventName,
            errorCode: event && event.errorCode,
            validatedURL: event && event.validatedURL,
          });
        });
      }
      document.body.appendChild(element);
      state.appended = true;
      state.preloadAttribute = element.getAttribute('preload');
      state.postAppendUpgraded = typeof element.getWebContentsId === 'function';
      return state;
    })()`);

    let guestTarget = null;
    if (initialState.postAppendUpgraded) {
      try {
        guestTarget = await waitFor(async () => {
          const targets = await (await fetch(`http://127.0.0.1:${stack.debugPort}/json/list`)).json();
          return targets.find((target) => String(target.url).includes('m6-webview-tag-probe=1')) || null;
        }, 'guest webContents target', 15000);
      } catch (err) {
        guestTarget = null;
      }
    }

    let state = initialState;
    if (initialState.postAppendUpgraded) {
      try {
        await waitFor(async () => {
          state = await evaluate(stack.page, `(() => {
            const state = window.__m6WebviewTagProbe;
            const webview = document.getElementById('m6-webview-tag-probe');
            if (!state || !webview) return state || null;
            try {
              state.webContentsId = webview.getWebContentsId();
            } catch (err) {
              state.webContentsIdError = String(err && err.message || err);
            }
            return state;
          })()`);
          return state && state.events.some((event) => (
            event.name === 'dom-ready' || event.name === 'did-finish-load'
          ));
        }, 'guest dom-ready evidence', 15000);
      } catch (err) {
        state = await readProbe(stack.page);
      }
    }

    let guestProbe = null;
    if (state && state.postAppendUpgraded) {
      try {
        guestProbe = await waitFor(async () => {
          const value = await evaluate(stack.page, `(async () => {
            const webview = document.getElementById('m6-webview-tag-probe');
            if (!webview || typeof webview.executeJavaScript !== 'function') return null;
            try {
              return await webview.executeJavaScript(\`({
                eagleType: typeof globalThis.eagle,
                itemApiType: typeof (globalThis.eagle && globalThis.eagle.item),
                loggerType: typeof (globalThis.eagle && globalThis.eagle.log),
                location: location.href
              })\`);
            } catch (err) {
              return null;
            }
          })()`);
          return value && value.eagleType === 'object' ? value : null;
        }, 'format preload execution in guest', 15000);
      } catch (err) {
        guestProbe = null;
      }
    }

    const evidence = {
      ...state,
      guestTarget: guestTarget ? { id: guestTarget.id, type: guestTarget.type, url: guestTarget.url } : null,
      guestProbe,
    };
    console.log(`M6_WEBVIEW_EVIDENCE ${JSON.stringify(evidence)}`);

    await t.test('a) webview element is upgraded before append', () => {
      assert.equal(state.resolution.ok, true, 'M6-3 format preload resolver must succeed');
      assert.equal(state.preAppendUpgraded, true, 'document.createElement("webview") must expose getWebContentsId');
      assert.notEqual(state.constructorName, 'HTMLElement', 'webview must not be a plain HTMLElement');
    });

    await t.test('b) webview attaches and creates a guest', () => {
      assert.equal(state.appended, true, 'probe webview must be appended');
      assert.equal(state.postAppendUpgraded, true, 'appended webview must remain guest-capable');
      assert.equal(Number.isInteger(state.webContentsId), true, 'guest webContents id must be observable');
      assert.equal(
        state.events.some((event) => event.name === 'dom-ready' || event.name === 'did-finish-load'),
        true,
        `guest load event missing: ${JSON.stringify(state.events)}`,
      );
      assert.ok(guestTarget, 'remote-debugging must expose the guest webContents target');
    });

    await t.test('c) real M6-3 preload URL executes in the guest', () => {
      assert.match(state.resolution.preloadUrl, /^file:\/\//i);
      assert.equal(
        path.resolve(state.resolution.diskPath),
        expectedFormatPreload,
        'resolver must point at the real format extension preload',
      );
      assert.equal(state.preloadAttribute, state.resolution.preloadUrl);
      assert.ok(guestProbe, 'guest did not expose the eagle API installed by the format preload');
      assert.equal(guestProbe.eagleType, 'object');
      assert.equal(guestProbe.itemApiType, 'function');
      assert.equal(guestProbe.loggerType, 'object');
      assert.match(guestProbe.location, /m6-webview-tag-probe=1/);
      assert.equal(
        state.webviewTagGapRegistered,
        false,
        'Electron normal path must not register webview.tag-disabled',
      );
    });
  } finally {
    await stop(stack).catch(() => {});
    await forceKillTree(stack.electron);
    await forceKillTree(stack.vite);
    await forceKillTree(stack.backend);
    await delay(500);
    try {
      await removeTempRoot(tempRoot);
    } catch (err) {
      console.warn(`M6_WEBVIEW_TEMP_CLEANUP_WARN ${err.code || err.message}; ${tempRoot}`);
    }
  }
});
