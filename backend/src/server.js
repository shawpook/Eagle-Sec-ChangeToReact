import cors from 'cors';
import express from 'express';
import multer from 'multer';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createFolder,
  defaultMockLibrary,
  loadLibrary,
  removeFolder,
  resolveLibraryPath,
  saveItems,
  saveLibraryState,
  updateFolder,
} from './library-store.js';
import { exportItem, exportLibrary, importBase64, importBookmark, importFile, importFolder, importUrl } from './importer.js';
import { ensureThumbnail, generateThumbnail, generateThumbnailAsync, thumbnailPath } from './thumbnailer.js';
import { exportCsvFile, itemsToCsv } from './csv-export.js';
import { importEaglepack, packLibrary } from './eaglepack.js';
import { findDuplicates, findSimilarDuplicates } from './duplicates.js';
import { getSmartFolderItems } from './smart-folders.js';
import { computeStats, folderStats, repairLibrary } from './library-stats.js';
import { getMediaInfo } from './media-info.js';
import { installPlugin, listInstalledPlugins, packPlugin, uninstallPlugin } from './plugin-package.js';
import { migrateLibrary, scanLibrary } from './library-migration.js';
import { getRequestToken, isLocalRequest } from './security.js';
import { describeLibrary, LibraryService } from './library-service.js';
import { exportAsFolder, exportImages } from './export-service.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '../..');
const mockLibraryDir = path.join(projectRoot, 'frontend/public/mock-library');
const reverseRoot = path.resolve(projectRoot, '..');
const programRoot = path.resolve(projectRoot, '../..');
const port = Number(process.env.EAGLE_API_PORT || 41695);
const thumbnailPort = Number(process.env.EAGLE_THUMBNAIL_PORT || 41692);
const extensionPort = Number(process.env.EAGLE_EXTENSION_PORT || 41693);
const apiToken = process.env.EAGLE_API_TOKEN || 'preview-token';
const stateFile = path.resolve(process.env.EAGLE_LIBRARY_STATE_FILE || path.join(projectRoot, 'test-run/user-data/library-state.json'));
const uploadDir = path.join(projectRoot, 'test-run/uploads');
const userPluginsDir = path.join(projectRoot, 'test-run/user-data/Plugins');
fs.mkdirSync(uploadDir, { recursive: true });
fs.mkdirSync(userPluginsDir, { recursive: true });
const upload = multer({ dest: uploadDir });

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/mock-library', express.static(mockLibraryDir));

app.get('/plugin-shim.js', (req, res) => {
  res.type('application/javascript');
  res.send(`(function () {
  if (window.__eaglePluginShimLoaded) return;
  window.__eaglePluginShimLoaded = true;
  const callbacks = {};
  window.eagle = {
    onPluginCreate(fn) { callbacks.create = fn; },
    onPluginRun(fn) { callbacks.run = fn; },
    onPluginShow(fn) { callbacks.show = fn; },
    onPluginHide(fn) { callbacks.hide = fn; },
    onPluginBeforeExit(fn) { callbacks.beforeExit = fn; },
    __callbacks: callbacks,
  };
})();`);
});

function pluginHtmlMiddleware(root, staticRoot) {
  return (req, res, next) => {
    const relative = req.path.replace(/^\/+/, '');
    const file = path.join(root, relative);
    if (req.path.endsWith('.html') && fs.existsSync(file)) {
      let html = fs.readFileSync(file, 'utf8');
      html = html.replace('</head>', '<script src="/plugin-shim.js"></script></head>');
      res.type('html').send(html);
      return;
    }
    next();
  };
}

const examplePluginRoot = path.join(reverseRoot, 'plugins/example-service-plugin');
const pluginTemplatesRoot = path.join(programRoot, 'resources/plugin_templates');
app.use('/plugins/eagle-reverse-example-service', pluginHtmlMiddleware(examplePluginRoot));
app.use('/plugins/eagle-reverse-example-service', express.static(examplePluginRoot));
app.use('/plugin-templates', pluginHtmlMiddleware(pluginTemplatesRoot));
app.use('/plugin-templates', express.static(pluginTemplatesRoot));
app.use('/plugins', express.static(userPluginsDir));

const libraryService = new LibraryService({
  stateFile,
  defaultLibraryPath: defaultMockLibrary(),
});
let currentLibrary = libraryService.currentLibrary();
let folders = currentLibrary.folders;
let smartFolders = currentLibrary.smartFolders;
let tagsGroups = currentLibrary.tagsGroups;

function activateLibrary(library) {
  currentLibrary = library;
  folders = library.folders;
  smartFolders = library.smartFolders;
  tagsGroups = library.tagsGroups;
  return library;
}

function readItems() {
  return currentLibrary.items;
}

function ok(data) {
  return { status: 'success', data };
}

function fail(message) {
  return { status: 'error', message };
}

app.use((req, res, next) => {
  if (isLocalRequest(req) || getRequestToken(req) === apiToken) {
    next();
    return;
  }
  res.status(401).json(fail('Unauthorized'));
});

function findFolder(id, tree = folders) {
  for (const folder of tree) {
    if (folder.id === id) return folder;
    const child = findFolder(id, folder.children || []);
    if (child) return child;
  }
  return null;
}

function itemThumbnailPath(item) {
  return thumbnailPath(currentLibrary, item);
}

const jobs = new Map();

function createJob(type, task) {
  const job = {
    id: `JOB-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    type,
    status: 'queued',
    progress: 0,
    message: 'Queued',
    result: null,
    error: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  jobs.set(job.id, job);
  task(job);
  return job;
}

function updateJob(job, patch) {
  Object.assign(job, patch, { updatedAt: Date.now() });
}

function startEaglepackExportJob(job, options = {}) {
  updateJob(job, { status: 'running', progress: 5, message: 'Preparing eaglepack export' });
  setTimeout(() => {
    try {
      updateJob(job, { progress: 35, message: 'Packing library metadata and images' });
      const target = options.libraryPath ? loadLibrary(options.libraryPath) : currentLibrary;
      const destFile = options.destFile || path.join(projectRoot, 'exports', `${target.libraryName}.eaglepack`);
      const packed = packLibrary(target, destFile);
      updateJob(job, {
        status: 'complete',
        progress: 100,
        message: 'Eaglepack export complete',
        result: { path: packed, count: target.items.length },
      });
    } catch (err) {
      updateJob(job, { status: 'error', progress: 100, message: err.message, error: err.message });
    }
  }, 60);
}

async function startPathImportJob(job, options = {}) {
  const files = Array.isArray(options.files) ? options.files : Array.isArray(options.images) ? options.images : [];
  const items = [];
  const errors = [];
  updateJob(job, {
    status: 'running',
    progress: 0,
    message: 'Importing files',
    cancelled: false,
    result: { items, errors, count: 0, total: files.length, cancelled: false },
  });
  for (let index = 0; index < files.length; index += 1) {
    if (job.cancelled) {
      updateJob(job, {
        status: 'cancelled',
        message: 'File import cancelled',
        result: { items, errors, count: items.length, total: files.length, cancelled: true },
      });
      return;
    }
    const source = typeof files[index] === 'string' ? { path: files[index] } : files[index];
    try {
      items.push(addMockItems({ images: [source] })[0]);
    } catch (err) {
      errors.push({ path: source.path || source.src || '', error: err.message });
    }
    updateJob(job, {
      progress: files.length > 0 ? Math.round(((index + 1) / files.length) * 100) : 100,
      message: `Imported ${index + 1}/${files.length}`,
      result: { items, errors, count: items.length, total: files.length, cancelled: false },
    });
    await new Promise((resolve) => setImmediate(resolve));
  }
  updateJob(job, {
    status: 'complete',
    progress: 100,
    message: 'File import complete',
    result: { items, errors, count: items.length, total: files.length, cancelled: false },
  });
}

async function startFolderImportJob(job, options = {}) {
  updateJob(job, {
    status: 'running',
    progress: 0,
    message: 'Scanning folder',
    cancelled: false,
    result: { items: [], errors: [], count: 0, total: 0, cancelled: false },
  });
  try {
    const result = await importFolder(currentLibrary, options.folderPath, options, {
      isCancelled: () => job.cancelled === true,
      onProgress(progress) {
        const percentage = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 100;
        const prior = job.result || { items: [], errors: [] };
        const items = progress.item ? [...prior.items, progress.item] : prior.items;
        const errors = progress.error ? [...prior.errors, { path: progress.path, error: progress.error }] : prior.errors;
        updateJob(job, {
          progress: percentage,
          message: progress.error ? `Skipped ${path.basename(progress.path)}: ${progress.error}` : `Imported ${progress.current}/${progress.total}`,
          result: { items, errors, count: items.length, total: progress.total, cancelled: false },
        });
      },
    });
    folders = currentLibrary.folders;
    updateJob(job, {
      status: result.cancelled ? 'cancelled' : 'complete',
      progress: result.cancelled ? job.progress : 100,
      message: result.cancelled ? 'Folder import cancelled' : 'Folder import complete',
      result: { ...result, count: result.items.length },
    });
  } catch (err) {
    updateJob(job, { status: 'error', progress: 100, message: err.message, error: err.message });
  }
}

function startEaglepackImportJob(job, options = {}) {
  updateJob(job, { status: 'running', progress: 5, message: 'Preparing eaglepack import' });
  setTimeout(() => {
    try {
      updateJob(job, { progress: 35, message: 'Reading eaglepack archive' });
      const zipFile = path.resolve(options.file || '');
      if (!fs.existsSync(zipFile)) throw new Error('Eaglepack file not found');
      const destDir = options.destDir || path.join(projectRoot, 'test-run', 'imported.library');
      const result = importEaglepack(zipFile, destDir, { mode: options.mode || 'replace' });
      updateJob(job, {
        status: 'complete',
        progress: 100,
        message: 'Eaglepack import complete',
        result: {
          library: { path: result.library.libraryPath, name: result.library.libraryName, items: result.library.items.length },
          merged: result.merged,
        },
      });
    } catch (err) {
      updateJob(job, { status: 'error', progress: 100, message: err.message, error: err.message });
    }
  }, 60);
}

function sanitizeName(value) {
  return String(value || '')
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 255) || 'Untitled';
}

function numberFixedLen(value, length) {
  return String(Number(value) || 0).padStart(Number(length) || 1, '0');
}

function formatDate(value, pattern) {
  const date = value ? new Date(value) : new Date();
  const pad = (num) => String(num).padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hour = pad(date.getHours());
  const minute = pad(date.getMinutes());
  const second = pad(date.getSeconds());
  const long = date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  const map = {
    YYYY_MM_DD: `${year}_${month}_${day}`,
    MM_DD: `${month}_${day}`,
    ll: long,
    'YYYY_MM_DD HH_mm': `${year}_${month}_${day} ${hour}_${minute}`,
    'YYYY_MM_DD HH_mm_ss': `${year}_${month}_${day} ${hour}_${minute}_${second}`,
  };
  return map[pattern] || `${year}-${month}-${day}`;
}

function applyTextCase(value, mode = 'none') {
  const text = String(value || '');
  if (mode === 'uppercase') return text.toUpperCase();
  if (mode === 'lowercase') return text.toLowerCase();
  if (mode === 'capitalize') return text.replace(/(^|[\s-])([a-z])/g, (_, prefix, char) => prefix + char.toUpperCase());
  return text;
}

function folderNamesForItem(item) {
  return (item.folders || [])
    .map((id) => findFolder(id))
    .filter(Boolean)
    .map((folder) => folder.name);
}

function formatBatchName(item, template, index) {
  let name = String(template || '');
  const originName = item.name || '';
  const idx = Number(index) || 1;
  name = name.replace(/%N+/gi, (match) => numberFixedLen(idx, match.length));
  const now = new Date();
  const modified = item.modificationTime ? new Date(item.modificationTime) : now;
  name = name
    .replace(/%DHMS/gi, formatDate(now, 'YYYY_MM_DD HH_mm_ss'))
    .replace(/%DHM/gi, formatDate(now, 'YYYY_MM_DD HH_mm'))
    .replace(/%DDD/gi, formatDate(now, 'll'))
    .replace(/%DD/gi, formatDate(now, 'MM_DD'))
    .replace(/%D/gi, formatDate(now, 'YYYY_MM_DD'))
    .replace(/%MHMS/gi, formatDate(modified, 'YYYY_MM_DD HH_mm_ss'))
    .replace(/%MHM/gi, formatDate(modified, 'YYYY_MM_DD HH_mm'))
    .replace(/%MMM/gi, formatDate(modified, 'll'))
    .replace(/%MM/gi, formatDate(modified, 'MM_DD'))
    .replace(/%M/gi, formatDate(modified, 'YYYY_MM_DD'))
    .replace(/%BHMS/gi, formatDate(modified, 'YYYY_MM_DD HH_mm_ss'))
    .replace(/%BHM/gi, formatDate(modified, 'YYYY_MM_DD HH_mm'))
    .replace(/%BBB/gi, formatDate(modified, 'll'))
    .replace(/%BB/gi, formatDate(modified, 'MM_DD'))
    .replace(/%B/gi, formatDate(modified, 'YYYY_MM_DD'));
  name = name.replace(/\*/gi, originName);
  name = name.replace(/%T/gi, (item.tags || []).slice().sort().join('-'));
  name = name.replace(/%F/gi, folderNamesForItem(item).sort().join('-'));
  return sanitizeName(name);
}

function renameItemFiles(library, item, oldName, newName) {
  const infoDir = path.join(library.rootDir, 'images', `${item.id}.info`);
  const oldOriginal = path.join(infoDir, `${oldName}.${item.ext}`);
  const newOriginal = path.join(infoDir, `${newName}.${item.ext}`);
  const oldThumb = path.join(infoDir, `${oldName}_thumbnail.png`);
  const newThumb = path.join(infoDir, `${newName}_thumbnail.png`);
  if (oldOriginal !== newOriginal && fs.existsSync(oldOriginal) && !fs.existsSync(newOriginal)) {
    fs.renameSync(oldOriginal, newOriginal);
  }
  if (oldThumb !== newThumb && fs.existsSync(oldThumb) && !fs.existsSync(newThumb)) {
    fs.renameSync(oldThumb, newThumb);
  }
}

function uniqueItemName(library, item, candidate) {
  const desired = sanitizeName(candidate);
  let name = desired;
  let suffix = 2;
  while (library.items.some((entry) => entry.id !== item.id && entry.name === name && entry.ext === item.ext)) {
    name = `${desired} (${suffix})`;
    suffix += 1;
  }
  return name;
}

function batchRenameItems(ids, options = {}) {
  const selected = readItems().filter((item) => ids.includes(item.id));
  const mode = options.mode === 'replace' ? 'replace' : 'format';
  const startAt = Number(options.startAt) || 1;
  const changed = [];
  selected.forEach((item, index) => {
    const oldName = item.name;
    let newName = mode === 'replace'
      ? String(oldName).split(options.find || '').join(options.replace || '')
      : formatBatchName(item, options.format || '*', startAt + index);
    newName = applyTextCase(newName, options.textCase);
    newName = uniqueItemName(currentLibrary, item, newName);
    if (newName !== oldName) {
      renameItemFiles(currentLibrary, item, oldName, newName);
      item.name = newName;
      item.lastModified = Date.now();
      changed.push({ id: item.id, name: item.name, oldName });
    }
  });
  if (changed.length > 0) saveItems(currentLibrary);
  return changed;
}

function batchUpdateItems(ids, patch = {}) {
  const allowed = ['name', 'annotation', 'url', 'website', 'star', 'tags', 'folders', 'comments'];
  const selected = readItems().filter((item) => ids.includes(item.id));
  const changed = [];
  for (const item of selected) {
    const next = { ...patch };
    if ('name' in next) {
      const oldName = item.name;
      const newName = uniqueItemName(currentLibrary, item, next.name);
      if (newName !== oldName) renameItemFiles(currentLibrary, item, oldName, newName);
      item.name = newName;
    }
    for (const key of allowed) {
      if (!(key in next) || key === 'name') continue;
      if (key === 'tags' || key === 'folders') {
        item[key] = [...new Set(Array.isArray(next[key]) ? next[key].map((value) => String(value).trim()).filter(Boolean) : [])];
      } else if (key === 'comments') {
        item[key] = Array.isArray(next[key]) ? next[key] : [];
      } else if (key === 'star') {
        item[key] = Math.max(0, Math.min(5, Number(next[key]) || 0));
      } else {
        item[key] = next[key];
      }
    }
    item.lastModified = Date.now();
    changed.push(item);
  }
  if (changed.length > 0) saveItems(currentLibrary);
  return changed.map((item) => ({ id: item.id, name: item.name, tags: item.tags, folders: item.folders }));
}

function addItemsToFolder(ids, folderId, mode = 'add') {
  const folder = findFolder(folderId);
  if (!folder) throw new Error('Folder not found');
  const selected = readItems().filter((item) => ids.includes(item.id));
  for (const item of selected) {
    if (mode === 'move') {
      item.folders = [folderId];
    } else {
      item.folders = [...new Set([...(item.folders || []), folderId])];
    }
    item.lastModified = Date.now();
  }
  if (selected.length > 0) saveItems(currentLibrary);
  return selected.map((item) => ({ id: item.id, folders: item.folders }));
}

function setFolderPassword(folder, password) {
  if (!folder) throw new Error('Folder not found');
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.createHash('sha256').update(`${salt}:${password}`).digest('hex');
  updateFolder(currentLibrary, folder.id, { hasPassword: true, passwordSalt: salt, passwordHash: hash, modificationTime: Date.now() });
}

function verifyFolderPassword(folder, password) {
  if (!folder || !folder.passwordHash || !folder.passwordSalt) return false;
  const actual = crypto.createHash('sha256').update(`${folder.passwordSalt}:${password}`).digest('hex');
  const left = Buffer.from(actual, 'hex');
  const right = Buffer.from(folder.passwordHash, 'hex');
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function replaceTag(oldName, newName) {
  const source = String(oldName || '').trim();
  const target = String(newName || '').trim();
  if (!source || !target) throw new Error('Tag names are required');
  for (const item of readItems()) {
    if (item.tags && item.tags.includes(source)) {
      item.tags = [...new Set(item.tags.map((tag) => (tag === source ? target : tag)))];
    }
  }
  for (const group of tagsGroups) {
    if (group.tags && group.tags.includes(source)) {
      group.tags = [...new Set(group.tags.map((tag) => (tag === source ? target : tag)))];
    }
  }
  currentLibrary.metadata.tagsGroups = tagsGroups;
  saveItems(currentLibrary);
}

function mergeTags(source, target) {
  const from = String(source || '').trim();
  const to = String(target || '').trim();
  if (!from || !to) throw new Error('Tag names are required');
  for (const item of readItems()) {
    if (item.tags && item.tags.includes(from)) {
      item.tags = [...new Set(item.tags.map((tag) => (tag === from ? to : tag)).filter((tag) => tag !== from))];
    }
  }
  for (const group of tagsGroups) {
    if (group.tags && group.tags.includes(from)) {
      group.tags = [...new Set(group.tags.map((tag) => (tag === from ? to : tag)).filter((tag) => tag !== from))];
    }
  }
  currentLibrary.metadata.tagsGroups = tagsGroups;
  saveItems(currentLibrary);
}

app.get('/', (req, res) => {
  res.json(
    ok({
      name: 'Eagle Reverse API',
      version: '0.1.0',
      api: ['/api/library/info', '/api/folder/list', '/api/tag/all', '/api/item/list'],
    })
  );
});

function listPlugins() {
  const roots = [
    path.join(reverseRoot, 'plugins'),
    path.join(programRoot, 'resources/plugin_templates'),
  ];
  const plugins = [];
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const manifestFile = path.join(root, entry.name, 'manifest.json');
      if (!fs.existsSync(manifestFile)) continue;
      try {
        const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
        const isTemplate = root.includes('plugin_templates');
        const pluginName = manifest.id || entry.name;
        plugins.push({
          id: manifest.id,
          version: manifest.version,
          name: manifest.name,
          serviceMode: !!manifest.main?.serviceMode,
          width: manifest.main?.width || 640,
          height: manifest.main?.height || 480,
          url: isTemplate
            ? `/plugin-templates/${entry.name}/index.html`
            : `/plugins/${pluginName}/index.html`,
          path: path.join(root, entry.name),
        });
      } catch (err) {
        // Skip malformed manifests.
      }
    }
  }
  for (const manifest of listInstalledPlugins(userPluginsDir)) {
    const existing = plugins.find((entry) => entry.id === manifest.id);
    if (existing) {
      existing.installed = true;
      existing.path = manifest.path;
      existing.url = `/plugins/${manifest.id}/index.html`;
    } else {
      plugins.push({
        id: manifest.id,
        version: manifest.version,
        name: manifest.name,
        serviceMode: !!manifest.main?.serviceMode,
        width: manifest.main?.width || 640,
        height: manifest.main?.height || 480,
        url: `/plugins/${manifest.id}/index.html`,
        path: manifest.path,
        installed: true,
      });
    }
  }
  return plugins;
}

app.get('/api/plugins', (req, res) => {
  res.json(ok(listPlugins()));
});

app.get('/api/plugins/center', (req, res) => {
  const plugins = listPlugins();
  res.json(
    ok({
      plugins,
      installed: plugins.filter((plugin) => plugin.installed),
      templates: plugins.filter((plugin) => String(plugin.url || '').includes('/plugin-templates/')),
      example: plugins.find((plugin) => plugin.id === 'eagle-reverse-example-service') || null,
    })
  );
});

app.get('/api/plugins/installed', (req, res) => {
  res.json(ok(listInstalledPlugins(userPluginsDir)));
});

app.get('/api/plugins/:id', (req, res) => {
  const plugin = listPlugins().find((entry) => entry.id === req.params.id);
  if (!plugin) {
    res.status(404).json(fail('Plugin not found'));
    return;
  }
  res.json(ok(plugin));
});

app.post('/api/plugins/open', (req, res) => {
  const plugin = listPlugins().find((entry) => entry.id === req.body.id);
  if (!plugin) {
    res.status(404).json(fail('Plugin not found'));
    return;
  }
  const apiPort = Number(process.env.EAGLE_API_PORT || 41695);
  res.json(
    ok({
      url: `http://localhost:${apiPort}${plugin.url}`,
      width: req.body.width || plugin.width,
      height: req.body.height || plugin.height,
    })
  );
});

app.post('/api/plugins/pack', (req, res) => {
  try {
    const sourceDir = path.resolve(req.body.sourceDir);
    const destFile = req.body.destFile || path.join(projectRoot, 'exports', `${path.basename(sourceDir)}.eagleplugin`);
    const packed = packPlugin(sourceDir, destFile);
    res.json(ok({ path: packed }));
  } catch (err) {
    res.status(400).json(fail(err.message));
  }
});

app.post('/api/plugins/install', (req, res) => {
  try {
    const zipFile = path.resolve(req.body.file);
    if (!fs.existsSync(zipFile)) {
      res.status(400).json(fail('Plugin package not found'));
      return;
    }
    const installed = installPlugin(zipFile, userPluginsDir);
    res.json(ok(installed));
  } catch (err) {
    res.status(400).json(fail(err.message));
  }
});

app.post('/api/plugins/uninstall', (req, res) => {
  try {
    res.json(ok(uninstallPlugin(userPluginsDir, req.body.id)));
  } catch (err) {
    res.status(400).json(fail(err.message));
  }
});

const pluginStateFile = path.join(projectRoot, 'test-run/user-data/plugin-state.json');
function readPluginState() {
  try {
    return JSON.parse(fs.readFileSync(pluginStateFile, 'utf8'));
  } catch (err) {
    return { disabled: [] };
  }
}

function savePluginState(state) {
  fs.mkdirSync(path.dirname(pluginStateFile), { recursive: true });
  fs.writeFileSync(pluginStateFile, JSON.stringify(state, null, 2), 'utf8');
}

app.post('/api/plugins/enable', (req, res) => {
  const state = readPluginState();
  state.disabled = (state.disabled || []).filter((id) => id !== req.body.id);
  savePluginState(state);
  res.json(ok(true));
});

app.post('/api/plugins/disable', (req, res) => {
  const state = readPluginState();
  state.disabled = [...new Set([...(state.disabled || []), req.body.id])];
  savePluginState(state);
  res.json(ok(true));
});

app.get('/api/library/info', (req, res) => {
  const items = readItems();
  res.json(
    ok({
      library: {
        path: currentLibrary.rootDir,
        name: currentLibrary.libraryName,
        folders: folders.length,
        smartFolders: smartFolders.length,
        tagsGroups: tagsGroups.length,
        items: items.length,
      },
    })
  );
});

app.get('/api/library/current', (req, res) => {
  res.json(ok(describeLibrary(currentLibrary, { includeItems: req.query.includeItems === 'true' })));
});

app.post('/api/library/create', (req, res) => {
  try {
    const result = libraryService.create(req.body || {});
    activateLibrary(result.library);
    res.status(201).json(ok({
      ...describeLibrary(result.library, { includeItems: true }),
      createdFiles: result.createdFiles,
      history: libraryService.history(),
    }));
  } catch (err) {
    res.status(400).json(fail(err.message));
  }
});

app.post('/api/library/open', (req, res) => {
  try {
    const library = activateLibrary(libraryService.open(req.body.libraryPath || req.body.path));
    res.json(ok({
      ...describeLibrary(library, { includeItems: true }),
      history: libraryService.history(),
    }));
  } catch (err) {
    res.status(400).json(fail(err.message));
  }
});

app.get('/api/library/stats', (req, res) => {
  res.json(ok(computeStats(currentLibrary)));
});

app.get('/api/v2/library/stats', (req, res) => {
  res.json(ok(computeStats(currentLibrary)));
});

app.get('/api/folder/stats', (req, res) => {
  res.json(ok(folderStats(folders)));
});

app.post('/api/library/repair', async (req, res) => {
  res.json(ok(await repairLibrary(currentLibrary)));
});

app.get('/api/library/scan', (req, res) => {
  try {
    res.json(ok(scanLibrary(req.query.path)));
  } catch (err) {
    res.status(400).json(fail(err.message));
  }
});

app.post('/api/library/migrate', (req, res) => {
  try {
    res.json(ok(migrateLibrary(req.body.sourcePath, req.body.destDir)));
  } catch (err) {
    res.status(400).json(fail(err.message));
  }
});

app.get('/api/library/validate', (req, res) => {
  try {
    res.json(ok(scanLibrary(req.query.path)));
  } catch (err) {
    res.status(400).json(fail(err.message));
  }
});

app.get('/api/library/history', (req, res) => {
  res.json(ok(libraryService.history()));
});

app.post('/api/library/history', (req, res) => {
  try {
    res.json(ok(libraryService.setHistory(req.body.history || req.body.libraryHistory || [])));
  } catch (err) {
    res.status(400).json(fail(err.message));
  }
});

app.post('/api/library/structure', (req, res) => {
  try {
    const requestedPath = req.body.libraryDir || req.body.libraryPath;
    if (requestedPath && path.resolve(requestedPath) !== path.resolve(currentLibrary.rootDir)) {
      throw new Error('Library structure update does not target the current library');
    }
    if (Array.isArray(req.body.folders)) currentLibrary.folders = req.body.folders;
    if (Array.isArray(req.body.smartFolders)) currentLibrary.smartFolders = req.body.smartFolders;
    if (Array.isArray(req.body.quickAccess)) currentLibrary.quickAccess = req.body.quickAccess;
    if (Array.isArray(req.body.tagsGroups)) currentLibrary.tagsGroups = req.body.tagsGroups;
    const collectFolderIds = (tree, ids = []) => {
      for (const folder of tree || []) {
        ids.push(folder.id);
        collectFolderIds(folder.children || [], ids);
      }
      return ids;
    };
    currentLibrary.metadata.folders = collectFolderIds(currentLibrary.folders);
    currentLibrary.metadata.smartFolders = currentLibrary.smartFolders;
    currentLibrary.metadata.quickAccess = currentLibrary.quickAccess;
    currentLibrary.metadata.tagsGroups = currentLibrary.tagsGroups;
    currentLibrary.metadata.modificationTime = Date.now();
    folders = currentLibrary.folders;
    smartFolders = currentLibrary.smartFolders;
    tagsGroups = currentLibrary.tagsGroups;
    saveLibraryState(currentLibrary);
    res.json(ok(describeLibrary(currentLibrary)));
  } catch (err) {
    res.status(400).json(fail(err.message));
  }
});

app.get('/api/folder/list', (req, res) => {
  res.json(ok(folders));
});

app.get('/api/folder/listRecent', (req, res) => {
  res.json(ok(folders));
});

app.get('/api/tag/all', (req, res) => {
  const tags = tagsGroups.flatMap((group) => group.tags).map((name) => ({ name, imageCount: 0, groups: [] }));
  res.json(ok({ tags }));
});

app.get('/api/tag/list', (req, res) => {
  const tags = tagsGroups.flatMap((group) => group.tags).map((name) => ({ name, imageCount: 0, groups: [] }));
  res.json(ok(tags));
});

app.get('/api/tag/listRecent', (req, res) => {
  const tags = tagsGroups.flatMap((group) => group.tags).map((name) => ({ name, imageCount: 0, groups: [] }));
  res.json(ok(tags.slice(0, 8)));
});

app.get('/api/tag/groups', (req, res) => {
  res.json(ok(tagsGroups));
});

app.post('/api/tag/update', (req, res) => {
  try {
    replaceTag(req.body.name, req.body.newName);
    res.json(ok({ name: req.body.newName, modificationTime: Date.now() }));
  } catch (err) {
    res.status(400).json(fail(err.message));
  }
});

app.post('/api/tag/merge', (req, res) => {
  try {
    mergeTags(req.body.source, req.body.target);
    res.json(ok(true));
  } catch (err) {
    res.status(400).json(fail(err.message));
  }
});

app.get('/api/item/list', (req, res) => {
  res.json(ok(readItems()));
});

function normalizeSearchValue(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    if (value.startsWith('[')) {
      try {
        return JSON.parse(value);
      } catch (err) {
        return value.split(',').map((entry) => entry.trim()).filter(Boolean);
      }
    }
    return value.split(',').map((entry) => entry.trim()).filter(Boolean);
  }
  return [];
}

function filterItems(items, query = {}) {
  const keyword = String(query.keyword || query.search || '').toLowerCase();
  const name = String(query.name || '').toLowerCase();
  const tags = normalizeSearchValue(query.tags);
  const folders = normalizeSearchValue(query.folders || query.folderIDs);
  const colors = query.colors ? normalizeSearchValue(query.colors) : query.color ? [query.color] : [];
  const star = Number(query.star);
  const ext = String(query.ext || '').toLowerCase();
  const minWidth = Number(query.minWidth);
  const minHeight = Number(query.minHeight);
  const maxWidth = Number(query.maxWidth);
  const maxHeight = Number(query.maxHeight);
  const dateFrom = query.dateFrom ? new Date(String(query.dateFrom)).getTime() : NaN;
  const dateTo = query.dateTo ? new Date(String(query.dateTo)).getTime() : NaN;
  const commentsKeyword = String(query.comments || '').toLowerCase();
  const hasComment = query.hasComment === 'true' || query.hasComment === true;
  const hasAnnotation = query.hasAnnotation === 'true' || query.hasAnnotation === true;
  const hasUrl = query.hasUrl === 'true' || query.hasUrl === true || query.urlRequired === 'true' || query.urlRequired === true;
  const deletedRaw = query.isDeleted;
  const isDeleted = deletedRaw === 'true' || deletedRaw === true
    ? true
    : deletedRaw === 'false' || deletedRaw === false
      ? false
      : undefined;

  function colorMatches(item, target) {
    const palettes = item.palettes || [];
    return palettes.some((palette) => {
      const color = Array.isArray(palette) ? palette : palette.color;
      return Array.isArray(color) && color.length >= 3 &&
        Math.abs(Number(color[0]) - target[0]) <= 12 &&
        Math.abs(Number(color[1]) - target[1]) <= 12 &&
        Math.abs(Number(color[2]) - target[2]) <= 12;
    });
  }

  function parseColor(value) {
    if (Array.isArray(value)) return value.slice(0, 3).map(Number);
    const text = String(value || '').trim();
    if (text.startsWith('#')) {
      const hex = text.replace('#', '');
      if (hex.length === 6) return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
    }
    const parts = text.split(',').map(Number);
    return parts.length >= 3 ? parts.slice(0, 3) : null;
  }

  const parsedColors = colors.map(parseColor).filter(Boolean);

  const filtered = items.filter((item) => {
    if (keyword) {
      const haystack = `${item.name} ${item.annotation || ''} ${item.url || ''} ${(item.tags || []).join(' ')} ${(item.comments || []).map((comment) => comment.text || '').join(' ')}`.toLowerCase();
      if (!haystack.includes(keyword)) return false;
    }
    if (name && !String(item.name || '').toLowerCase().includes(name)) return false;
    if (tags.length > 0 && !tags.every((tag) => (item.tags || []).includes(tag))) return false;
    if (folders.length > 0 && !folders.some((folderId) => (item.folders || []).includes(folderId))) return false;
    if (star && Number(item.star) !== star) return false;
    if (ext && String(item.ext || '').toLowerCase() !== ext) return false;
    if (minWidth && Number(item.width) < minWidth) return false;
    if (minHeight && Number(item.height) < minHeight) return false;
    if (maxWidth && Number(item.width) > maxWidth) return false;
    if (maxHeight && Number(item.height) > maxHeight) return false;
    if (!Number.isNaN(dateFrom) && Number(item.modificationTime) < dateFrom) return false;
    if (!Number.isNaN(dateTo) && Number(item.modificationTime) > dateTo) return false;
    if (commentsKeyword) {
      const commentText = (item.comments || []).map((comment) => comment.text || '').join(' ').toLowerCase();
      if (!commentText.includes(commentsKeyword)) return false;
    }
    if (hasComment && (item.comments || []).length === 0) return false;
    if (hasAnnotation && !String(item.annotation || '').trim()) return false;
    if (hasUrl && !String(item.url || '').trim()) return false;
    if (parsedColors.length > 0 && !parsedColors.some((color) => colorMatches(item, color))) return false;
    if (isDeleted !== undefined && Boolean(item.isDeleted) !== isDeleted) return false;
    return true;
  });

  const sortBy = String(query.sortBy || '');
  const sortIncrease = query.sortIncrease === 'true' || query.sortIncrease === true;
  if (sortBy) {
    filtered.sort((a, b) => {
      const left = a[sortBy] ?? '';
      const right = b[sortBy] ?? '';
      const result = typeof left === 'number' && typeof right === 'number' ? left - right : String(left).localeCompare(String(right));
      return sortIncrease ? result : -result;
    });
  }
  return filtered;
}

app.get('/api/item/search', (req, res) => {
  res.json(ok(filterItems(readItems(), req.query)));
});

app.post('/api/item/search', (req, res) => {
  res.json(ok(filterItems(readItems(), req.body || {})));
});

app.get('/api/item/info', (req, res) => {
  const id = String(req.query.id || '');
  const item = readItems().find((entry) => entry.id === id);
  if (!item) {
    res.status(404).json({ status: 'error', message: 'Item not found' });
    return;
  }
  res.json(ok(item));
});

app.get('/api/item/mediaInfo', (req, res) => {
  const id = String(req.query.id || '');
  const item = readItems().find((entry) => entry.id === id);
  if (!item) {
    res.status(404).json(fail('Item not found'));
    return;
  }
  res.json(ok(getMediaInfo(currentLibrary, item)));
});

app.get('/api/preferences/collect/on', (req, res) => {
  res.json(ok(true));
});

app.get('/api/preferences/collect/off', (req, res) => {
  res.json(ok(false));
});

app.get('/api/v2/library/info', (req, res) => {
  const items = readItems();
  res.json(
    ok({
      name: currentLibrary.libraryName,
      version: '4.0.0',
      path: currentLibrary.rootDir,
      itemCount: items.length,
    })
  );
});

app.get('/api/v2/item/list', (req, res) => {
  res.json(ok(readItems()));
});

app.get('/api/v2/smartFolder/all', (req, res) => {
  res.json(ok(smartFolders));
});

app.get('/api/v2/tagGroup/all', (req, res) => {
  res.json(ok(tagsGroups));
});

app.get('/api/application/info', (req, res) => {
  res.json(
    ok({
      name: 'Eagle Reverse Demo',
      version: '4.0.0',
      buildVersion: 20250801,
      platform: 'win32',
      isVersion4: true,
      preferences: {},
    })
  );
});

app.post('/api/library/switch', (req, res) => {
  try {
    const nextLibrary = activateLibrary(libraryService.switch(req.body.libraryPath || req.body.path || defaultMockLibrary()));
    res.json(ok({
      ...describeLibrary(nextLibrary, { includeItems: true }),
      history: libraryService.history(),
    }));
  } catch (err) {
    res.status(400).json(fail(err.message));
  }
});

app.get('/api/library/icon', (req, res) => {
  const iconPath = path.join(projectRoot, '..', 'src/app/collect-window/assets/images/base/icons/default-library-icon.png');
  if (fs.existsSync(iconPath)) res.sendFile(iconPath);
  else res.status(404).json(fail('Library icon not found'));
});

app.post('/api/folder/create', (req, res) => {
  const folder = createFolder(currentLibrary, req.body);
  res.json(ok(folder));
});

app.post('/api/folder/rename', (req, res) => {
  const folder = updateFolder(currentLibrary, req.body.folderId || req.body.id, { name: req.body.name });
  if (!folder) {
    res.status(404).json(fail('Folder not found'));
    return;
  }
  res.json(ok(folder));
});

app.post('/api/folder/update', (req, res) => {
  const folder = updateFolder(currentLibrary, req.body.folderId || req.body.id, req.body);
  if (!folder) {
    res.status(404).json(fail('Folder not found'));
    return;
  }
  res.json(ok(folder));
});

app.post('/api/folder/unlock', (req, res) => {
  const folder = findFolder(req.body.folderId);
  if (folder) folder.isUnLock = true;
  saveLibraryState(currentLibrary);
  res.json(ok(true));
});

app.post('/api/folder/setPassword', (req, res) => {
  try {
    const folder = findFolder(req.body.folderID || req.body.folderId);
    if (!folder) throw new Error('Folder not found');
    if (!req.body.password) throw new Error('Password is required');
    setFolderPassword(folder, req.body.password);
    res.json(ok({ id: folder.id, hasPassword: true }));
  } catch (err) {
    res.status(400).json(fail(err.message));
  }
});

app.post('/api/folder/verifyPassword', (req, res) => {
  const folder = findFolder(req.body.folderID || req.body.folderId);
  res.json(ok(folder ? verifyFolderPassword(folder, req.body.password || '') : false));
});

app.post('/api/folder/changePassword', (req, res) => {
  try {
    const folder = findFolder(req.body.folderID || req.body.folderId);
    if (!folder) throw new Error('Folder not found');
    if (!verifyFolderPassword(folder, req.body.currentPassword || '')) throw new Error('Current password is incorrect');
    setFolderPassword(folder, req.body.password || '');
    res.json(ok({ id: folder.id, hasPassword: true }));
  } catch (err) {
    res.status(400).json(fail(err.message));
  }
});

app.post('/api/folder/removePassword', (req, res) => {
  const folder = findFolder(req.body.folderID || req.body.folderId);
  if (!folder) {
    res.status(404).json(fail('Folder not found'));
    return;
  }
  updateFolder(currentLibrary, folder.id, {
    hasPassword: false,
    passwordHash: undefined,
    passwordSalt: undefined,
    modificationTime: Date.now(),
  });
  res.json(ok({ id: folder.id, hasPassword: false }));
});

function addMockItems(body) {
  let sources = body.images && typeof body.images === 'string' ? JSON.parse(body.images) : body.images;
  if (!sources && Array.isArray(body.paths)) sources = body.paths.map((sourcePath) => ({ path: sourcePath }));
  const list = Array.isArray(sources) ? sources : [body];
  if (list.length === 0) throw new Error('At least one import source is required');
  if (body.dryRun === true) {
    const now = Date.now();
    return list.map((source, index) => {
      const src = source.src || source.url || source.path || '';
      const name = source.name || source.title || path.basename(String(src).split('?')[0]) || 'New Item';
      const ext = source.ext || path.extname(name).replace('.', '') || 'png';
      return {
        id: `MOCK-ADDED-${now}-${index}`,
        name,
        ext,
        width: source.width || 1536,
        height: source.height || 960,
        size: source.size || 0,
        url: source.url || '',
        website: source.website || '',
        annotation: source.annotation || '',
        tags: source.tags || [],
        folders: source.folderIDs || source.folders || [],
        star: source.star || 0,
        modificationTime: now,
        lastModified: now,
        isDeleted: false,
        noThumbnail: false,
      };
    });
  }
  return list.map((source) => {
    const src = source.src || source.url || source.path || '';
    return importFile(currentLibrary, source.path || source.src, {
      name: source.name || source.title,
      originalName: source.originalName,
      ext: source.ext,
      mime: source.mime || source.type,
      width: source.width,
      height: source.height,
      size: source.size,
      url: source.url || '',
      website: source.website || '',
      annotation: source.annotation || '',
      tags: source.tags || [],
      folderIDs: source.folderIDs || source.folders || [],
      star: source.star || 0,
      modificationTime: source.modificationTime,
      lastModified: source.lastModified,
    });
  });
}

app.post('/api/item/addFromPath', (req, res) => {
  try {
    res.status(201).json(ok(addMockItems(req.body)[0]));
  } catch (err) {
    res.status(400).json(fail(err.message));
  }
});

app.post('/api/item/addFromPaths', (req, res) => {
  try {
    res.status(201).json(ok(addMockItems(req.body)));
  } catch (err) {
    res.status(400).json(fail(err.message));
  }
});

app.post('/api/item/addFromURL', async (req, res) => {
  try {
    if (req.body.dryRun === true) {
      res.json(ok(addMockItems(req.body)[0]));
      return;
    }
    const item = await importUrl(currentLibrary, req.body.url || req.body.src, req.body || {});
    res.status(201).json(ok(item));
  } catch (err) {
    res.status(400).json(fail(err.message));
  }
});

app.post('/api/item/addFromURLs', async (req, res) => {
  try {
    const sources = Array.isArray(req.body.images) ? req.body.images : Array.isArray(req.body.urls) ? req.body.urls : [];
    const items = [];
    for (const source of sources) {
      const params = typeof source === 'string' ? { url: source } : source;
      items.push(await importUrl(currentLibrary, params.url || params.src, params));
    }
    res.status(201).json(ok(items));
  } catch (err) {
    res.status(400).json(fail(err.message));
  }
});

app.post('/api/item/batchSave', (req, res) => {
  res.json(ok(addMockItems(req.body)));
});

app.post('/api/item/addBookmark', (req, res) => {
  res.json(ok(addMockItems(req.body)[0] || {}));
});

app.post('/api/item/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    res.status(400).json(fail('File is required'));
    return;
  }
  try {
    const parsed = path.parse(req.file.originalname);
    const item = importFile(currentLibrary, req.file.path, {
      name: parsed.name,
      originalName: req.file.originalname,
      ext: parsed.ext.slice(1),
      mime: req.file.mimetype,
      tags: req.body.tags ? String(req.body.tags).split(',').map((tag) => tag.trim()).filter(Boolean) : [],
      folderIDs: req.body.folderIDs ? String(req.body.folderIDs).split(',').map((id) => id.trim()).filter(Boolean) : [],
      annotation: req.body.annotation || '',
    });
    if (item.noThumbnail) {
      try {
        await generateThumbnailAsync(currentLibrary, item);
        item.noThumbnail = false;
        saveItems(currentLibrary);
      } catch (err) {
        item.noThumbnail = true;
      }
    }
    fs.rmSync(req.file.path, { force: true });
    res.status(201).json(ok(item));
  } catch (err) {
    fs.rmSync(req.file.path, { force: true });
    res.status(500).json(fail(err.message));
  }
});

app.post('/api/item/importFolder', async (req, res) => {
  try {
    const result = await importFolder(currentLibrary, req.body.folderPath, {
      tags: req.body.tags ? String(req.body.tags).split(',').map((tag) => tag.trim()).filter(Boolean) : [],
      folderIDs: Array.isArray(req.body.folderIDs) ? req.body.folderIDs : [],
      parentID: req.body.parentID,
      annotation: req.body.annotation || '',
      maxDepth: req.body.maxDepth,
      maxFiles: req.body.maxFiles,
    });
    folders = currentLibrary.folders;
    res.status(201).json(ok({ ...result, count: result.items.length }));
  } catch (err) {
    res.status(400).json(fail(err.message));
  }
});

app.post('/api/item/importBase64', (req, res) => {
  try {
    const item = importBase64(currentLibrary, req.body.data, {
      name: req.body.name,
      ext: req.body.ext,
      tags: req.body.tags ? String(req.body.tags).split(',').map((tag) => tag.trim()).filter(Boolean) : [],
      annotation: req.body.annotation || '',
    });
    res.json(ok(item));
  } catch (err) {
    res.status(400).json(fail(err.message));
  }
});

app.post('/api/item/importBookmark', (req, res) => {
  try {
    const item = importBookmark(currentLibrary, req.body);
    res.json(ok(item));
  } catch (err) {
    res.status(400).json(fail(err.message));
  }
});

app.post('/api/item/update', (req, res) => {
  const id = req.body.id || req.body.itemID;
  const item = readItems().find((entry) => entry.id === id);
  if (!item) {
    res.status(404).json(fail('Item not found'));
    return;
  }
  Object.assign(item, req.body, { id, lastModified: Date.now() });
  saveItems(currentLibrary);
  res.json(ok(item));
});

app.post('/api/item/batchUpdate', (req, res) => {
  const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
  if (ids.length === 0) {
    res.status(400).json(fail('ids are required'));
    return;
  }
  res.json(ok(batchUpdateItems(ids, req.body.patch || {})));
});

app.post('/api/item/batchRename', (req, res) => {
  const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
  if (ids.length === 0) {
    res.status(400).json(fail('ids are required'));
    return;
  }
  res.json(ok(batchRenameItems(ids, req.body)));
});

app.post('/api/item/addToFolder', (req, res) => {
  try {
    const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
    if (ids.length === 0) {
      res.status(400).json(fail('ids are required'));
      return;
    }
    res.json(ok(addItemsToFolder(ids, req.body.folderID || req.body.folderId, req.body.mode)));
  } catch (err) {
    res.status(400).json(fail(err.message));
  }
});

app.post('/api/item/moveToTrash', (req, res) => {
  const id = req.body.id || req.body.itemID;
  const item = readItems().find((entry) => entry.id === id);
  if (item) item.isDeleted = true;
  saveItems(currentLibrary);
  res.json(ok(true));
});

app.post('/api/item/setCustomThumbnail', (req, res) => {
  res.json(ok(true));
});

app.post('/api/item/refreshThumbnail', async (req, res) => {
  const id = req.body.id || req.body.itemID;
  const item = readItems().find((entry) => entry.id === id);
  if (!item) {
    res.status(404).json(fail('Item not found'));
    return;
  }
  const generated = await generateThumbnailAsync(currentLibrary, item);
  res.json(ok({ path: generated }));
});

app.post('/api/item/refreshPalette', (req, res) => {
  res.json(ok(true));
});

app.get('/api/item/thumbnail', (req, res) => {
  const item = readItems().find((entry) => entry.id === req.query.id);
  let thumbPath = '';
  if (item) {
    try {
      thumbPath = ensureThumbnail(currentLibrary, item);
    } catch (err) {
      thumbPath = '';
    }
  }
  if (thumbPath && fs.existsSync(thumbPath)) {
    res.sendFile(thumbPath);
  } else {
    res.status(404).json(fail('Thumbnail not found'));
  }
});

app.post('/api/item/export', (req, res) => {
  const id = req.body.id || req.body.itemID;
  const item = readItems().find((entry) => entry.id === id);
  if (!item) {
    res.status(404).json(fail('Item not found'));
    return;
  }
  const destDir = req.body.destDir || path.join(projectRoot, 'exports');
  const exportedPath = exportItem(currentLibrary, item, destDir);
  if (!exportedPath) {
    res.status(404).json(fail('Item has no local file to export'));
    return;
  }
  res.json(ok({ path: exportedPath }));
});

app.post('/api/export/images', async (req, res) => {
  try {
    res.json(ok(await exportImages(currentLibrary, req.body || {})));
  } catch (err) {
    res.status(400).json(fail(err.message));
  }
});

app.post('/api/export/as-folder', async (req, res) => {
  try {
    res.json(ok(await exportAsFolder(currentLibrary, req.body || {})));
  } catch (err) {
    res.status(400).json(fail(err.message));
  }
});

app.get('/api/export/csv', (req, res) => {
  const items = filterItems(readItems(), req.query);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="items.csv"');
  res.send(itemsToCsv(items));
});

app.post('/api/export/csv', (req, res) => {
  const items = filterItems(readItems(), req.body || {});
  if (req.body.destFile) {
    const exported = exportCsvFile(items, req.body.destFile);
    res.json(ok({ path: exported, count: items.length }));
    return;
  }
  res.json(ok({ csv: itemsToCsv(items), count: items.length }));
});

app.post('/api/export/eaglepack', (req, res) => {
  const target = req.body.libraryPath ? loadLibrary(req.body.libraryPath) : currentLibrary;
  const destFile = req.body.destFile || path.join(projectRoot, 'exports', `${target.libraryName}.eaglepack`);
  const packed = packLibrary(target, destFile);
  res.json(ok({ path: packed, count: target.items.length }));
});

app.post('/api/export/eaglepack/start', (req, res) => {
  const job = createJob('eaglepack-export', (currentJob) => startEaglepackExportJob(currentJob, req.body || {}));
  res.json(ok({ job }));
});

app.post('/api/export/library', (req, res) => {
  try {
    const destDir = req.body.destDir || path.join(projectRoot, 'exports', currentLibrary.libraryName);
    const exported = exportLibrary(currentLibrary, destDir);
    res.json(ok({ path: exported }));
  } catch (err) {
    res.status(400).json(fail(err.message));
  }
});

app.post('/api/library/backup', (req, res) => {
  const destFile = req.body.destFile || path.join(projectRoot, 'exports', `${currentLibrary.libraryName}-backup.eaglepack`);
  const packed = packLibrary(currentLibrary, destFile, { includeLibraryState: true });
  res.json(ok({ path: packed, count: currentLibrary.items.length }));
});

app.post('/api/library/restore', (req, res) => {
  try {
    const zipFile = path.resolve(req.body.file || '');
    if (!fs.existsSync(zipFile)) {
      res.status(400).json(fail('Backup file not found'));
      return;
    }
    const destDir = req.body.destDir || path.join(projectRoot, 'test-run', 'restored.library');
    const result = importEaglepack(zipFile, destDir, { mode: req.body.mode || 'replace' });
    res.json(ok({ library: result.library, manifest: result.manifest, merged: result.merged }));
  } catch (err) {
    res.status(400).json(fail(err.message));
  }
});

app.post('/api/import/eaglepack', (req, res) => {
  const zipFile = path.resolve(req.body.file || '');
  if (!fs.existsSync(zipFile)) {
    res.status(400).json(fail('Eaglepack file not found'));
    return;
  }
  const destDir = req.body.destDir || path.join(projectRoot, 'test-run', 'imported.library');
  try {
    const result = importEaglepack(zipFile, destDir, { mode: req.body.mode || 'replace' });
    res.json(
      ok({
        library: {
          path: result.library.libraryPath,
          name: result.library.libraryName,
          items: result.library.items.length,
        },
        manifest: result.manifest,
        merged: result.merged,
      })
    );
  } catch (err) {
    res.status(400).json(fail(err.message));
  }
});

app.post('/api/import/eaglepack/start', (req, res) => {
  const job = createJob('eaglepack-import', (currentJob) => startEaglepackImportJob(currentJob, req.body || {}));
  res.json(ok({ job }));
});

app.post('/api/item/importFolder/start', (req, res) => {
  const job = createJob('folder-import', (currentJob) => startFolderImportJob(currentJob, req.body || {}));
  res.status(202).json(ok({ job }));
});

app.post('/api/item/importPaths/start', (req, res) => {
  const files = Array.isArray(req.body.files) ? req.body.files : Array.isArray(req.body.images) ? req.body.images : [];
  if (files.length === 0) {
    res.status(400).json(fail('At least one file is required'));
    return;
  }
  const job = createJob('file-import', (currentJob) => startPathImportJob(currentJob, { ...req.body, files }));
  res.status(202).json(ok({ job }));
});

app.post('/api/jobs/cancel-active', (req, res) => {
  let count = 0;
  for (const job of jobs.values()) {
    if (job.status === 'queued' || job.status === 'running') {
      job.cancelled = true;
      updateJob(job, { message: 'Cancellation requested' });
      count += 1;
    }
  }
  res.json(ok({ count }));
});

app.post('/api/jobs/:id/cancel', (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) {
    res.status(404).json(fail('Job not found'));
    return;
  }
  if (job.status === 'complete' || job.status === 'error' || job.status === 'cancelled') {
    res.json(ok({ job, cancelled: false }));
    return;
  }
  job.cancelled = true;
  updateJob(job, { message: 'Cancellation requested' });
  res.json(ok({ job, cancelled: true }));
});

app.get('/api/jobs/:id', (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) {
    res.status(404).json(fail('Job not found'));
    return;
  }
  res.json(ok(job));
});

app.get('/api/item/duplicates', (req, res) => {
  res.json(ok(findDuplicates(currentLibrary)));
});

app.post('/api/item/duplicates/scan', (req, res) => {
  const method = req.body.method === 'similar' ? 'similar' : 'same';
  const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
  const items = ids.length > 0 ? readItems().filter((item) => ids.includes(item.id)) : readItems();
  const startedAt = Date.now();
  const groups = method === 'similar'
    ? findSimilarDuplicates(currentLibrary, items, Number(req.body.threshold) || 0.55)
    : findDuplicates(currentLibrary, items);
  res.json(ok({ method, groups, elapsedMs: Date.now() - startedAt, scanned: items.length }));
});

app.post('/api/item/mergeDuplicates', (req, res) => {
  const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
  const keepId = req.body.keepId || ids[0];
  const removeIds = req.body.removeIds || ids.slice(1);
  if (!keepId || removeIds.length === 0) {
    res.status(400).json(fail('keepId and removeIds are required'));
    return;
  }
  const keep = readItems().find((item) => item.id === keepId);
  if (!keep) {
    res.status(404).json(fail('Keep item not found'));
    return;
  }
  for (const removeId of removeIds) {
    const remove = readItems().find((item) => item.id === removeId);
    if (!remove) continue;
    keep.tags = [...new Set([...(keep.tags || []), ...(remove.tags || [])])];
    keep.folders = [...new Set([...(keep.folders || []), ...(remove.folders || [])])];
    keep.comments = [...(keep.comments || []), ...(remove.comments || [])];
    currentLibrary.items = currentLibrary.items.filter((item) => item.id !== removeId);
  }
  saveItems(currentLibrary);
  res.json(ok(keep));
});

app.post('/api/script/inject', (req, res) => {
  res.json(ok(true));
});

app.get('/item', (req, res) => res.redirect(`eagle://item/${req.query.id || ''}`));
app.get('/folder', (req, res) => res.redirect(`eagle://folder/${req.query.id || ''}`));
app.get('/smart-folder', (req, res) => res.redirect(`eagle://smart-folder/${req.query.id || ''}`));

app.get('/api/v2/app/info', (req, res) => {
  res.json(
    ok({
      name: 'Eagle Reverse Demo',
      version: '4.0.0',
      buildVersion: 20250801,
      platform: 'win32',
      isVersion4: true,
      preferences: {},
    })
  );
});

app.get('/api/v2/library/history', (req, res) => {
  res.json(ok(libraryService.history()));
});

app.post('/api/v2/library/switch', (req, res) => {
  try {
    const nextLibrary = activateLibrary(libraryService.switch(req.body.libraryPath || req.body.path || defaultMockLibrary()));
    res.json(ok({
      ...describeLibrary(nextLibrary, { includeItems: true }),
      history: libraryService.history(),
    }));
  } catch (err) {
    res.status(400).json(fail(err.message));
  }
});

app.get('/api/v2/library/icon', (req, res) => {
  const iconPath = path.join(projectRoot, '..', 'src/app/collect-window/assets/images/base/icons/default-library-icon.png');
  if (fs.existsSync(iconPath)) res.sendFile(iconPath);
  else res.status(404).json(fail('Library icon not found'));
});

function getItemFromRequest(req) {
  const id = req.query.id || req.body?.id || req.body?.itemID;
  return readItems().find((entry) => entry.id === id);
}

app.get('/api/v2/item/get', (req, res) => {
  const item = getItemFromRequest(req);
  if (!item) {
    res.status(404).json(fail('Item not found'));
    return;
  }
  res.json(ok(item));
});

app.post('/api/v2/item/get', (req, res) => {
  const item = getItemFromRequest(req);
  if (!item) {
    res.status(404).json(fail('Item not found'));
    return;
  }
  res.json(ok(item));
});

app.post('/api/v2/item/query', (req, res) => {
  const items = filterItems(readItems(), req.body || {});
  const limit = Math.min(Number(req.body?.limit || 50), 1000);
  const offset = Number(req.body?.offset || 0);
  res.json(ok({ data: items.slice(offset, offset + limit), total: items.length, offset, limit }));
});

app.get('/api/v2/item/countAll', (req, res) => {
  res.json(ok({ count: readItems().length }));
});

app.post('/api/v2/item/add', (req, res) => {
  res.json(ok(addMockItems(req.body)[0] || {}));
});

app.post('/api/v2/item/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    res.status(400).json(fail('File is required'));
    return;
  }
  try {
    const parsed = path.parse(req.file.originalname);
    const item = importFile(currentLibrary, req.file.path, {
      name: parsed.name,
      originalName: req.file.originalname,
      ext: parsed.ext.slice(1),
      mime: req.file.mimetype,
      tags: req.body.tags ? String(req.body.tags).split(',').map((tag) => tag.trim()).filter(Boolean) : [],
      folderIDs: req.body.folderIDs ? String(req.body.folderIDs).split(',').map((id) => id.trim()).filter(Boolean) : [],
      annotation: req.body.annotation || '',
    });
    if (item.noThumbnail) {
      try {
        await generateThumbnailAsync(currentLibrary, item);
        item.noThumbnail = false;
        saveItems(currentLibrary);
      } catch (err) {
        item.noThumbnail = true;
      }
    }
    fs.rmSync(req.file.path, { force: true });
    res.status(201).json(ok(item));
  } catch (err) {
    fs.rmSync(req.file.path, { force: true });
    res.status(500).json(fail(err.message));
  }
});

app.post('/api/v2/item/update', (req, res) => {
  const id = req.body.id || req.body.itemID;
  const item = readItems().find((entry) => entry.id === id);
  if (!item) {
    res.status(404).json(fail('Item not found'));
    return;
  }
  Object.assign(item, req.body, { id, lastModified: Date.now() });
  saveItems(currentLibrary);
  res.json(ok(item));
});

app.post('/api/v2/item/batchUpdate', (req, res) => {
  const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
  if (ids.length === 0) {
    res.status(400).json(fail('ids are required'));
    return;
  }
  res.json(ok(batchUpdateItems(ids, req.body.patch || {})));
});

app.post('/api/v2/item/batchRename', (req, res) => {
  const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
  if (ids.length === 0) {
    res.status(400).json(fail('ids are required'));
    return;
  }
  res.json(ok(batchRenameItems(ids, req.body)));
});

app.post('/api/v2/item/addToFolder', (req, res) => {
  try {
    const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
    if (ids.length === 0) {
      res.status(400).json(fail('ids are required'));
      return;
    }
    res.json(ok(addItemsToFolder(ids, req.body.folderID || req.body.folderId, req.body.mode)));
  } catch (err) {
    res.status(400).json(fail(err.message));
  }
});

app.post('/api/v2/item/setCustomThumbnail', (req, res) => {
  res.json(ok(true));
});

app.post('/api/v2/item/refreshThumbnail', async (req, res) => {
  const id = req.body.id || req.body.itemID;
  const item = readItems().find((entry) => entry.id === id);
  if (!item) {
    res.status(404).json(fail('Item not found'));
    return;
  }
  const generated = await generateThumbnailAsync(currentLibrary, item);
  res.json(ok({ path: generated }));
});

app.post('/api/v2/item/mergeDuplicates', (req, res) => {
  const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
  const keepId = req.body.keepId || ids[0];
  const removeIds = req.body.removeIds || ids.slice(1);
  if (!keepId || removeIds.length === 0) {
    res.status(400).json(fail('keepId and removeIds are required'));
    return;
  }
  const keep = readItems().find((item) => item.id === keepId);
  if (!keep) {
    res.status(404).json(fail('Keep item not found'));
    return;
  }
  for (const removeId of removeIds) {
    const remove = readItems().find((item) => item.id === removeId);
    if (!remove) continue;
    keep.tags = [...new Set([...(keep.tags || []), ...(remove.tags || [])])];
    keep.folders = [...new Set([...(keep.folders || []), ...(remove.folders || [])])];
    keep.comments = [...(keep.comments || []), ...(remove.comments || [])];
    currentLibrary.items = currentLibrary.items.filter((item) => item.id !== removeId);
  }
  saveItems(currentLibrary);
  res.json(ok(keep));
});

app.post('/api/v2/item/duplicates/scan', (req, res) => {
  const method = req.body.method === 'similar' ? 'similar' : 'same';
  const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
  const items = ids.length > 0 ? readItems().filter((item) => ids.includes(item.id)) : readItems();
  const startedAt = Date.now();
  const groups = method === 'similar'
    ? findSimilarDuplicates(currentLibrary, items, Number(req.body.threshold) || 0.55)
    : findDuplicates(currentLibrary, items);
  res.json(ok({ method, groups, elapsedMs: Date.now() - startedAt, scanned: items.length }));
});

app.get('/api/v2/item/getComments', (req, res) => {
  const item = getItemFromRequest(req);
  if (!item) {
    res.status(404).json(fail('Item not found'));
    return;
  }
  res.json(ok(item.comments || []));
});

app.post('/api/v2/item/addComment', (req, res) => {
  const item = getItemFromRequest(req);
  if (!item) {
    res.status(404).json(fail('Item not found'));
    return;
  }
  const comment = {
    id: `COMMENT-${Date.now()}`,
    text: req.body.text || '',
    modificationTime: Date.now(),
  };
  item.comments = item.comments || [];
  item.comments.push(comment);
  saveItems(currentLibrary);
  res.json(ok(comment));
});

app.post('/api/v2/item/updateComment', (req, res) => {
  const item = getItemFromRequest(req);
  if (!item) {
    res.status(404).json(fail('Item not found'));
    return;
  }
  const commentId = req.body.commentId || req.body.id;
  const comment = (item.comments || []).find((entry) => entry.id === commentId);
  if (!comment) {
    res.status(404).json(fail('Comment not found'));
    return;
  }
  comment.text = req.body.text || comment.text;
  comment.modificationTime = Date.now();
  saveItems(currentLibrary);
  res.json(ok(comment));
});

app.post('/api/v2/item/removeComment', (req, res) => {
  const item = getItemFromRequest(req);
  if (!item) {
    res.status(404).json(fail('Item not found'));
    return;
  }
  const commentId = req.body.commentId || req.body.id;
  item.comments = (item.comments || []).filter((entry) => entry.id !== commentId);
  saveItems(currentLibrary);
  res.json(ok(true));
});

function getFolderFromRequest(req) {
  return findFolder(req.query.id || req.body?.id || req.body?.folderID);
}

app.get('/api/v2/folder/get', (req, res) => {
  const folder = getFolderFromRequest(req);
  if (!folder) {
    res.status(404).json(fail('Folder not found'));
    return;
  }
  res.json(ok(folder));
});

app.post('/api/v2/folder/get', (req, res) => {
  const folder = getFolderFromRequest(req);
  if (!folder) {
    res.status(404).json(fail('Folder not found'));
    return;
  }
  res.json(ok(folder));
});

app.post('/api/v2/folder/create', (req, res) => {
  const folder = createFolder(currentLibrary, req.body);
  res.json(ok(folder));
});

app.post('/api/v2/folder/update', (req, res) => {
  const folder = updateFolder(currentLibrary, req.body.id || req.body.folderID, req.body);
  if (!folder) {
    res.status(404).json(fail('Folder not found'));
    return;
  }
  res.json(ok(folder));
});

app.get('/api/v2/folder/all', (req, res) => {
  res.json(ok(folders));
});

app.post('/api/v2/folder/remove', (req, res) => {
  const removed = removeFolder(currentLibrary, req.body.id || req.body.folderID);
  res.json(ok(removed));
});

app.post('/api/v2/folder/setPassword', (req, res) => {
  try {
    const folder = findFolder(req.body.id || req.body.folderID);
    if (!folder) throw new Error('Folder not found');
    setFolderPassword(folder, req.body.password || '');
    res.json(ok({ id: folder.id, hasPassword: true }));
  } catch (err) {
    res.status(400).json(fail(err.message));
  }
});

app.post('/api/v2/folder/verifyPassword', (req, res) => {
  const folder = findFolder(req.body.id || req.body.folderID);
  res.json(ok(folder ? verifyFolderPassword(folder, req.body.password || '') : false));
});

app.post('/api/v2/folder/changePassword', (req, res) => {
  try {
    const folder = findFolder(req.body.id || req.body.folderID);
    if (!folder) throw new Error('Folder not found');
    if (!verifyFolderPassword(folder, req.body.currentPassword || '')) throw new Error('Current password is incorrect');
    setFolderPassword(folder, req.body.password || '');
    res.json(ok({ id: folder.id, hasPassword: true }));
  } catch (err) {
    res.status(400).json(fail(err.message));
  }
});

app.post('/api/v2/folder/removePassword', (req, res) => {
  const folder = findFolder(req.body.id || req.body.folderID);
  if (!folder) {
    res.status(404).json(fail('Folder not found'));
    return;
  }
  updateFolder(currentLibrary, folder.id, {
    hasPassword: false,
    passwordHash: undefined,
    passwordSalt: undefined,
    modificationTime: Date.now(),
  });
  res.json(ok({ id: folder.id, hasPassword: false }));
});

function smartFolderFromRequest(req) {
  return smartFolders.find((entry) => entry.id === (req.query.id || req.body?.id || req.body?.smartFolderID));
}

app.get('/api/v2/smartFolder/get', (req, res) => {
  const folder = smartFolderFromRequest(req);
  if (!folder) {
    res.status(404).json(fail('Smart folder not found'));
    return;
  }
  res.json(ok(folder));
});

app.post('/api/v2/smartFolder/get', (req, res) => {
  const folder = smartFolderFromRequest(req);
  if (!folder) {
    res.status(404).json(fail('Smart folder not found'));
    return;
  }
  res.json(ok(folder));
});

app.post('/api/v2/smartFolder/create', (req, res) => {
  const folder = {
    id: `SMART-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
    name: String(req.body.name || 'New Smart Folder').trim() || 'New Smart Folder',
    description: req.body.description || '',
    conditions: req.body.conditions || [],
    modificationTime: Date.now(),
  };
  smartFolders.push(folder);
  currentLibrary.metadata.smartFolders = smartFolders;
  currentLibrary.metadata.modificationTime = Date.now();
  saveLibraryState(currentLibrary);
  res.json(ok(folder));
});

app.post('/api/v2/smartFolder/update', (req, res) => {
  const folder = smartFolderFromRequest(req);
  if (!folder) {
    res.status(404).json(fail('Smart folder not found'));
    return;
  }
  Object.assign(folder, req.body, { id: folder.id, modificationTime: Date.now() });
  currentLibrary.metadata.smartFolders = smartFolders;
  currentLibrary.metadata.modificationTime = Date.now();
  saveLibraryState(currentLibrary);
  res.json(ok(folder));
});

app.post('/api/v2/smartFolder/remove', (req, res) => {
  const index = smartFolders.findIndex((entry) => entry.id === (req.body.id || req.body.smartFolderID));
  if (index >= 0) smartFolders.splice(index, 1);
  currentLibrary.metadata.smartFolders = smartFolders;
  currentLibrary.metadata.modificationTime = Date.now();
  saveLibraryState(currentLibrary);
  res.json(ok(true));
});

app.get('/api/v2/smartFolder/getItems', (req, res) => {
  const folder = smartFolderFromRequest(req);
  res.json(ok(folder ? getSmartFolderItems(currentLibrary, folder) : []));
});

app.post('/api/v2/smartFolder/getItems', (req, res) => {
  const folder = smartFolderFromRequest(req);
  res.json(ok(folder ? getSmartFolderItems(currentLibrary, folder) : []));
});

app.get('/api/v2/smartFolder/getRules', (req, res) => {
  res.json(ok([]));
});

function tagsFromRequest(req) {
  const name = req.query.name || req.body?.name;
  if (!name) return null;
  return { name, imageCount: readItems().filter((item) => item.tags.includes(name)).length, groups: [] };
}

app.get('/api/v2/tag/get', (req, res) => {
  const tag = tagsFromRequest(req);
  if (!tag) {
    res.status(404).json(fail('Tag not found'));
    return;
  }
  res.json(ok(tag));
});

app.post('/api/v2/tag/get', (req, res) => {
  const tag = tagsFromRequest(req);
  if (!tag) {
    res.status(404).json(fail('Tag not found'));
    return;
  }
  res.json(ok(tag));
});

app.get('/api/v2/tag/all', (req, res) => {
  const tags = tagsGroups.flatMap((group) => group.tags).map((name) => ({ name, imageCount: 0, groups: [] }));
  res.json(ok(tags));
});

app.get('/api/v2/tag/getRecentTags', (req, res) => {
  res.json(ok(readItems().flatMap((item) => item.tags).slice(0, 12)));
});

app.get('/api/v2/tag/getStarredTags', (req, res) => {
  res.json(ok(['UI', '收藏']));
});

app.post('/api/v2/tag/update', (req, res) => {
  try {
    replaceTag(req.body.name, req.body.newName);
    res.json(ok({ name: req.body.newName, modificationTime: Date.now() }));
  } catch (err) {
    res.status(400).json(fail(err.message));
  }
});

app.post('/api/v2/tag/merge', (req, res) => {
  try {
    mergeTags(req.body.source, req.body.target);
    res.json(ok(true));
  } catch (err) {
    res.status(400).json(fail(err.message));
  }
});

app.post('/api/v2/tag/remove', (req, res) => {
  const name = req.body.name;
  if (!name) {
    res.status(400).json(fail('Tag name is required'));
    return;
  }
  for (const item of readItems()) {
    item.tags = (item.tags || []).filter((tag) => tag !== name);
  }
  for (const group of tagsGroups) {
    group.tags = (group.tags || []).filter((tag) => tag !== name);
  }
  saveItems(currentLibrary);
  currentLibrary.metadata.tagsGroups = tagsGroups;
  saveLibraryState(currentLibrary);
  res.json(ok(true));
});

function tagGroupFromRequest(req) {
  return tagsGroups.find((entry) => entry.id === (req.query.id || req.body?.id || req.body?.tagGroupID));
}

app.get('/api/v2/tagGroup/get', (req, res) => {
  const group = tagGroupFromRequest(req);
  if (!group) {
    res.status(404).json(fail('Tag group not found'));
    return;
  }
  res.json(ok(group));
});

app.post('/api/v2/tagGroup/create', (req, res) => {
  const group = {
    id: `TAGGROUP-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
    name: String(req.body.name || 'New Group').trim() || 'New Group',
    tags: req.body.tags || [],
    color: req.body.color || '#5B8DEF',
    modificationTime: Date.now(),
  };
  tagsGroups.push(group);
  currentLibrary.metadata.tagsGroups = tagsGroups;
  currentLibrary.metadata.modificationTime = Date.now();
  saveLibraryState(currentLibrary);
  res.json(ok(group));
});

app.post('/api/v2/tagGroup/update', (req, res) => {
  const group = tagGroupFromRequest(req);
  if (!group) {
    res.status(404).json(fail('Tag group not found'));
    return;
  }
  Object.assign(group, req.body, { id: group.id, modificationTime: Date.now() });
  currentLibrary.metadata.tagsGroups = tagsGroups;
  currentLibrary.metadata.modificationTime = Date.now();
  saveLibraryState(currentLibrary);
  res.json(ok(group));
});

app.post('/api/v2/tagGroup/remove', (req, res) => {
  const index = tagsGroups.findIndex((entry) => entry.id === (req.body.id || req.body.tagGroupID));
  if (index >= 0) tagsGroups.splice(index, 1);
  currentLibrary.metadata.tagsGroups = tagsGroups;
  currentLibrary.metadata.modificationTime = Date.now();
  saveLibraryState(currentLibrary);
  res.json(ok(true));
});

app.post('/api/v2/tagGroup/addTags', (req, res) => {
  const group = tagGroupFromRequest(req);
  if (group && Array.isArray(req.body.tags)) group.tags = [...new Set([...group.tags, ...req.body.tags])];
  currentLibrary.metadata.tagsGroups = tagsGroups;
  saveLibraryState(currentLibrary);
  res.json(ok(group || true));
});

app.post('/api/v2/tagGroup/removeTags', (req, res) => {
  const group = tagGroupFromRequest(req);
  if (group && Array.isArray(req.body.tags)) group.tags = group.tags.filter((tag) => !req.body.tags.includes(tag));
  currentLibrary.metadata.tagsGroups = tagsGroups;
  saveLibraryState(currentLibrary);
  res.json(ok(group || true));
});

app.get('/api/v2/aiSearch/isInstalled', (req, res) => res.json(ok(false)));
app.get('/api/v2/aiSearch/isReady', (req, res) => res.json(ok(false)));
app.get('/api/v2/aiSearch/isStarting', (req, res) => res.json(ok(false)));
app.get('/api/v2/aiSearch/isSyncing', (req, res) => res.json(ok(false)));
app.get('/api/v2/aiSearch/getSyncStatus', (req, res) => res.json(ok({ syncing: false, progress: 0 })));
app.get('/api/v2/aiSearch/checkServiceHealth', (req, res) => res.json(ok({ healthy: false })));
app.post('/api/v2/aiSearch/searchByText', (req, res) => res.json(ok({ items: [], total: 0 })));
app.post('/api/v2/aiSearch/searchByBase64', (req, res) => res.json(ok({ items: [], total: 0 })));
app.post('/api/v2/aiSearch/searchByItemId', (req, res) => res.json(ok({ items: [], total: 0 })));

app.get('/api/search/index', (req, res) => {
  res.json(ok(currentLibrary.searchIndex));
});

app.get('/api/v2/search/index', (req, res) => {
  res.json(ok(currentLibrary.searchIndex));
});

app.post('/api/v2/search/rebuild', (req, res) => {
  saveItems(currentLibrary);
  res.json(ok({ count: currentLibrary.items.length }));
});

function resolveThumbnailPath(filePath) {
  if (!filePath) return null;
  let decoded = String(filePath);
  try {
    decoded = decodeURIComponent(decoded);
  } catch (err) {
    // Keep the original value when decoding fails.
  }
  decoded = decoded.replace(/\\/g, '/');
  if (/^https?:\/\//i.test(decoded)) {
    try {
      decoded = new URL(decoded).pathname;
    } catch (err) {
      return null;
    }
  }

  const roots = [
    path.join(projectRoot, 'frontend/public'),
    path.join(projectRoot, '..', 'src'),
  ];
  let rel = decoded;
  if (decoded.startsWith('/mock-library/')) rel = decoded.slice(1);
  else if (decoded.startsWith('/src/')) rel = decoded.slice(1);

  for (const root of roots) {
    const rootResolved = path.resolve(root);
    const candidate = path.resolve(rootResolved, rel);
    if (candidate !== rootResolved && candidate.startsWith(rootResolved + path.sep) && fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }

  if (/^[a-zA-Z]:[\\/]/.test(decoded)) {
    const candidate = path.resolve(decoded);
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  return null;
}

const thumbnailApp = express();
thumbnailApp.use(cors());
thumbnailApp.get('/', (req, res) => {
  const filePath = req.query.filePath || req.query.path || '';
  const resolved = resolveThumbnailPath(filePath);
  if (!resolved) {
    res.status(404).json({ status: 'error', message: `Thumbnail not found: ${filePath}` });
    return;
  }
  res.sendFile(resolved);
});

const extensionApp = express();
extensionApp.use(cors());
extensionApp.use(express.urlencoded({ extended: true }));
extensionApp.use(express.json());
extensionApp.get('/', (req, res) => {
  res.json({
    status: 'success',
    showCollectModal: false,
    version: '4.0.0',
    platform: 'win32',
    isVersion4: true,
    buildVersion: 20250801,
  });
});
extensionApp.post('/', (req, res) => {
  const body = req.body || {};
  res.json({
    status: 'success',
    data: {
      id: `MOCK-ADDED-${Date.now()}`,
      ...body,
    },
  });
});

function normalizeExtensionArray(body, key) {
  if (Array.isArray(body[key])) return body[key];
  const indexed = Object.entries(body)
    .filter(([name]) => name.startsWith(`${key}[`))
    .sort(([left], [right]) => left.localeCompare(right, undefined, { numeric: true }))
    .map(([, value]) => value);
  if (indexed.length > 0) return indexed;
  if (typeof body[key] === 'string' && body[key].trim()) {
    try {
      const parsed = JSON.parse(body[key]);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch (err) {
      return body[key].split(',').map((value) => value.trim()).filter(Boolean);
    }
  }
  return [];
}

async function extensionSaveResponse(req, res) {
  const body = req.body || {};
  try {
    const type = body.type || 'image';
    if (type === 'image' && (body.src || body.base64)) {
      const data = body.src || body.base64;
      if (!String(data).startsWith('data:')) throw new Error('Collect image must be a base64 data URI');
      const mimeMatch = /^data:([^;,]+);base64,/.exec(String(data));
      const mime = mimeMatch ? mimeMatch[1] : 'image/png';
      const ext = mime === 'image/jpeg' ? 'jpg' : mime.split('/').pop() || 'png';
      const item = importBase64(currentLibrary, data, {
        name: body.title || body.name || 'Collected Image',
        ext,
        url: body.url || '',
        annotation: body.annotation || '',
        tags: normalizeExtensionArray(body, 'tags'),
        folderIDs: normalizeExtensionArray(body, 'folderIDs').concat(body.folderID ? [body.folderID] : []),
        star: body.star,
      });
      res.status(201).json(ok(item));
      return;
    }
    if (type === 'save-url' && (body.url || body.src)) {
      const item = importBookmark(currentLibrary, {
        name: body.title || body.name,
        url: body.url || body.src,
        annotation: body.annotation || '',
        tags: normalizeExtensionArray(body, 'tags'),
        folders: normalizeExtensionArray(body, 'folderIDs'),
        star: body.star,
      });
      res.status(201).json(ok(item));
      return;
    }
    throw new Error(`Unsupported collect type: ${type}`);
  } catch (err) {
    res.status(400).json(fail(err.message));
  }
}

extensionApp.post('/api/item/addFile', extensionSaveResponse);
extensionApp.post('/api/item/addURL', extensionSaveResponse);
extensionApp.post('/api/item/addURLs', extensionSaveResponse);
extensionApp.post('/api/item/batchSave', extensionSaveResponse);
extensionApp.post('/api/item/import-images', extensionSaveResponse);
extensionApp.post('/api/collect', extensionSaveResponse);
extensionApp.get('/api/version', (req, res) => {
  res.json({ status: 'success', version: '4.0.0', platform: 'win32', isVersion4: true });
});
extensionApp.get('/api/extension/status', (req, res) => {
  res.json({
    status: 'success',
    enabled: true,
    version: '1.0.0',
    endpoints: ['/api/collect', '/api/item/addFile', '/api/item/addURL', '/api/item/batchSave', '/api/item/import-images'],
  });
});
extensionApp.post('/api/extension/collect', extensionSaveResponse);

app.use((err, req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }
  res.status(500).json(fail(err.message || 'Internal server error'));
});

app.listen(port, () => {
  console.log(`Eagle Reverse API listening at http://localhost:${port}`);
});

thumbnailApp.listen(thumbnailPort, () => {
  console.log(`Eagle Reverse thumbnail service listening at http://localhost:${thumbnailPort}`);
});

extensionApp.listen(extensionPort, () => {
  console.log(`Eagle Reverse extension service listening at http://localhost:${extensionPort}`);
});
