import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';

export function validateManifest(manifest) {
  if (!manifest.id || !manifest.version || !manifest.main?.url) {
    throw new Error('Plugin manifest is missing id, version, or main.url');
  }
  return true;
}

function buildEagleApi() {
  const callbacks = {
    create: null,
    run: null,
    show: null,
    hide: null,
    beforeExit: null,
  };
  const eagle = {
    onPluginCreate(fn) {
      callbacks.create = fn;
    },
    onPluginRun(fn) {
      callbacks.run = fn;
    },
    onPluginShow(fn) {
      callbacks.show = fn;
    },
    onPluginHide(fn) {
      callbacks.hide = fn;
    },
    onPluginBeforeExit(fn) {
      callbacks.beforeExit = fn;
    },
  };
  return { callbacks, eagle };
}

export function loadPlugin(pluginRoot) {
  const resolvedRoot = path.resolve(pluginRoot);
  const manifestFile = path.join(resolvedRoot, 'manifest.json');
  if (!fs.existsSync(manifestFile)) {
    throw new Error(`Plugin manifest not found: ${manifestFile}`);
  }
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  validateManifest(manifest);
  const pluginFile = path.join(resolvedRoot, 'js', 'plugin.js');
  if (!fs.existsSync(pluginFile)) {
    throw new Error(`Plugin script not found: ${pluginFile}`);
  }

  const { callbacks, eagle } = buildEagleApi();
  const sandbox = {
    console,
    process,
    Buffer,
    eagle,
    module: { exports: {} },
    exports: {},
    require(id) {
      if (id === 'fs') return fs;
      if (id === 'path') return path;
      if (id === 'os') return os;
      throw new Error(`Unexpected plugin require: ${id}`);
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(pluginFile, 'utf8'), sandbox, {
    filename: pluginFile,
  });

  return {
    manifest,
    pluginRoot: resolvedRoot,
    callbacks,
    runLifecycle() {
      const plugin = { manifest, path: resolvedRoot };
      if (callbacks.create) callbacks.create(plugin);
      if (callbacks.run) callbacks.run();
      if (callbacks.show) callbacks.show();
      if (callbacks.hide) callbacks.hide();
      if (callbacks.beforeExit) callbacks.beforeExit({});
    },
  };
}

export function loadServicePlugin(pluginRoot) {
  const plugin = loadPlugin(pluginRoot);
  if (!plugin.manifest.main?.serviceMode) {
    throw new Error(`Plugin is not a service plugin: ${plugin.manifest.id || pluginRoot}`);
  }
  return plugin;
}

export function defaultPluginRoots() {
  return [
    path.resolve(os.homedir(), 'Eagle/Plugins'),
    path.resolve(process.cwd(), 'test-run/user-data/Plugins'),
  ];
}
