import cors from 'cors';
import express from 'express';
import multer from 'multer';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createFolder,
  createSmartFolder,
  defaultMockLibrary,
  findSmartFolder,
  loadLibrary,
  moveFolder,
  moveSmartFolder,
  removeFolder,
  removeSmartFolder,
  resolveLibraryPath,
  saveItems,
  saveLibraryState,
  updateSmartFolder,
  updateFolder,
} from './library-store.js';
import { configureThumbnailTaskService, exportItem, exportLibrary, importBase64, importBookmark, importFile, importFolder, importUrl } from './importer.js';
import { thumbnailPath } from './thumbnailer.js';
import { exportCsvFile, itemsToCsv } from './csv-export.js';
import { importEaglepack, packLibrary } from './eaglepack.js';
import { findDuplicates, findDuplicatesWithProgress, findSimilarDuplicates } from './duplicates.js';
import { getSmartFolderItems } from './smart-folders.js';
import { getSerializableRules, validateConditions } from './smart-folder-rules.js';
import { computeStats, folderStats, repairLibrary } from './library-stats.js';
import { getMediaInfo } from './media-info.js';
import { installPlugin, listInstalledPlugins, packPlugin, uninstallPlugin } from './plugin-package.js';
import { migrateLibrary, scanLibrary } from './library-migration.js';
import { getRequestToken, isLocalRequest } from './security.js';
import { describeLibrary, LibraryService } from './library-service.js';
import { exportAsFolder, exportImages } from './export-service.js';
import { ColorAnalyzerService } from './color-analyzer.js';
import { CustomThumbnailService } from './custom-thumbnail.js';
import { DownloadError, getControlledDownloadService } from './controlled-downloader.js';
import { ThumbnailTaskError, ThumbnailTaskService } from './thumbnail-task-service.js';
import { ItemWorkflowError, ItemWorkflowService } from './item-workflow-service.js';
import { searchItems, searchItemsByFilterRules } from './search-service.js';
import { CaptureError, CaptureService } from './capture-service.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '../..');
const mockLibraryDir = path.join(projectRoot, 'frontend/public/mock-library');
const reverseRoot = path.resolve(projectRoot, '..');
const programRoot = path.resolve(projectRoot, '../..');
const port = Number(process.env.EAGLE_API_PORT || 41595);
const thumbnailPort = Number(process.env.EAGLE_THUMBNAIL_PORT || 41592);
const extensionPort = Number(process.env.EAGLE_EXTENSION_PORT || 41593);
const apiToken = process.env.EAGLE_API_TOKEN || 'preview-token';
const userDataDir = path.resolve(process.env.EAGLE_USER_DATA_DIR || path.join(projectRoot, 'test-run/user-data'));
const stateFile = path.resolve(process.env.EAGLE_LIBRARY_STATE_FILE || path.join(userDataDir, 'library-state.json'));
const uploadDir = path.join(userDataDir, 'uploads');
const userPluginsDir = path.join(userDataDir, 'Plugins');
fs.mkdirSync(uploadDir, { recursive: true });
fs.mkdirSync(userPluginsDir, { recursive: true });
const upload = multer({ dest: uploadDir });

const app = express();
app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));
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
const colorAnalyzer = new ColorAnalyzerService({
  concurrency: 3,
  timeoutMs: process.env.EAGLE_PALETTE_TIMEOUT_MS === undefined ? 30_000 : Number(process.env.EAGLE_PALETTE_TIMEOUT_MS),
  delayMs: process.env.EAGLE_PALETTE_DELAY_MS === undefined ? 20 : Number(process.env.EAGLE_PALETTE_DELAY_MS),
});
const thumbnailTasks = new ThumbnailTaskService({
  concurrency: process.env.EAGLE_THUMBNAIL_CONCURRENCY === undefined ? 3 : Number(process.env.EAGLE_THUMBNAIL_CONCURRENCY),
  timeoutMs: process.env.EAGLE_THUMBNAIL_TIMEOUT_MS === undefined ? 100_000 : Number(process.env.EAGLE_THUMBNAIL_TIMEOUT_MS),
  maxSize: process.env.EAGLE_THUMBNAIL_MAX_SIZE === undefined ? 480 : Number(process.env.EAGLE_THUMBNAIL_MAX_SIZE),
});
configureThumbnailTaskService(thumbnailTasks);
const customThumbnailService = new CustomThumbnailService({
  regenerate: (library, itemId, options = {}) => thumbnailTasks.generate(library, itemId, {
    ...options,
    clearCustomThumbnail: true,
  }),
});
const controlledDownloader = getControlledDownloadService();
const captureService = new CaptureService({
  downloadService: controlledDownloader,
  maxBatchItems: Number(process.env.EAGLE_CAPTURE_MAX_BATCH_ITEMS) || 200,
  screenshotLimitBytes: Number(process.env.EAGLE_CAPTURE_SCREENSHOT_BYTES) || 30 * 1024 * 1024,
});
const itemWorkflow = new ItemWorkflowService();
let currentLibrary = libraryService.currentLibrary();
thumbnailTasks.recover(currentLibrary);
let folders = currentLibrary.folders;
let smartFolders = currentLibrary.smartFolders;
let tagsGroups = currentLibrary.tagsGroups;

function activateLibrary(library) {
  thumbnailTasks.recover(library);
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

async function startEaglepackExportJob(job, options = {}) {
  updateJob(job, { status: 'running', progress: 5, message: 'Preparing eaglepack export' });
  try {
    await new Promise((resolve) => setImmediate(resolve));
    updateJob(job, { progress: 10, message: 'Packing library metadata and images' });
    const target = options.libraryPath ? loadLibrary(options.libraryPath) : currentLibrary;
    const destFile = options.destFile || path.join(projectRoot, 'exports', `${target.libraryName}.eaglepack`);
    const total = resolveSelectedItemsForProgress(target, options).length;
    const packed = packLibrary(target, destFile, {
      items: options.items,
      folder: options.folder,
      folderId: options.folderId,
      includeLibraryState: options.includeLibraryState,
      onProgress(progress) {
        const percentage = total > 0 ? 10 + Math.round(((progress.current || 0) / total) * 80) : 10;
        updateJob(job, {
          progress: Math.min(percentage, 95),
          message: `Packing ${progress.current}/${total}`,
          result: { path: destFile, count: progress.current, total },
        });
      },
    });
    updateJob(job, {
      status: 'complete',
      progress: 100,
      message: 'Eaglepack export complete',
      result: { path: packed, count: total },
    });
  } catch (err) {
    updateJob(job, { status: 'error', progress: 100, message: err.message, error: err.message });
  }
}

function resolveSelectedItemsForProgress(library, options) {
  if (!Array.isArray(options.items) || options.items.length === 0) {
    return library.items.filter((item) => !item.isDeleted);
  }
  const ids = new Set(options.items.map((item) => typeof item === 'string' ? item : item.id));
  return library.items.filter((item) => ids.has(item.id));
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

async function startDuplicateScanJob(job, options = {}) {
  // 异步重复扫描任务：通过 job 状态轮询真实进度并支持取消。
  const method = options.method === 'similar' ? 'similar' : 'same';
  const ids = Array.isArray(options.ids) ? options.ids : [];
  const items = ids.length > 0 ? readItems().filter((item) => ids.includes(item.id)) : readItems();
  const startedAt = Date.now();
  updateJob(job, {
    status: 'running',
    progress: 0,
    message: `Scanning ${items.length} items`,
    cancelled: false,
    result: null,
  });
  if (method === 'similar') {
    updateJob(job, {
      status: 'complete',
      progress: 100,
      message: 'Similar scan is not part of this batch',
      result: { method, groups: [], elapsedMs: 0, scanned: items.length, cancelled: false },
    });
    return;
  }
  try {
    const result = await findDuplicatesWithProgress(currentLibrary, items, {
      onProgress: (current, total) => {
        if (job.cancelled) return;
        updateJob(job, {
          progress: total > 0 ? Math.round((current / total) * 100) : 100,
          message: `Hashed ${current}/${total}`,
        });
      },
      isCancelled: () => job.cancelled === true,
      concurrency: Number(process.env.EAGLE_DUPLICATE_SCAN_CONCURRENCY) || 4,
    });
    if (result.cancelled) {
      updateJob(job, {
        status: 'cancelled',
        progress: 100,
        message: 'Duplicate scan cancelled',
        result: { method, groups: [], elapsedMs: Date.now() - startedAt, scanned: items.length, cancelled: true, errors: [] },
      });
      return;
    }
    updateJob(job, {
      status: 'complete',
      progress: 100,
      message: 'Duplicate scan complete',
      result: { method, groups: result.groups, elapsedMs: Date.now() - startedAt, scanned: items.length, cancelled: false, errors: result.errors || [] },
    });
  } catch (err) {
    updateJob(job, { status: 'error', progress: 100, message: err.message, error: err.message });
  }
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

function batchRenameItems(ids, options = {}) {
  const selected = readItems().filter((item) => ids.includes(item.id));
  const mode = options.mode === 'replace' ? 'replace' : 'format';
  const startAt = Number(options.startAt) || 1;
  const targetOwners = new Map();
  const plans = selected.map((item, index) => {
    const oldName = item.name;
    let newName = mode === 'replace'
      ? String(oldName).split(options.find || '').join(options.replace || '')
      : formatBatchName(item, options.format || '*', startAt + index);
    newName = applyTextCase(newName, options.textCase);
    const key = `${String(item.ext || '').toLowerCase()}:${newName.toLowerCase()}`;
    const owner = targetOwners.get(key);
    if (owner && owner !== item.id) {
      throw new Error(`Batch rename conflict: ${newName}`);
    }
    targetOwners.set(key, item.id);
    return { id: item.id, oldName, newName };
  });
  const changes = plans.filter((plan) => plan.newName !== plan.oldName);
  if (changes.length === 0) return [];
  const updated = itemWorkflow.updateMany(
    currentLibrary,
    changes.map((plan) => ({ id: plan.id, name: plan.newName })),
    { contract: 'v1' },
  );
  const updatedMap = new Map(updated.map((item) => [item.id, item]));
  return changes.map((plan) => ({
    id: plan.id,
    name: (updatedMap.get(plan.id) || {}).name || plan.newName,
    oldName: plan.oldName,
  }));
}

function batchRenameFolders(ids, options = {}) {
  const mode = options.mode === 'replace' ? 'replace' : 'format';
  const startAt = Number(options.startAt) || 1;
  const changed = [];
  ids.forEach((id, index) => {
    const folder = findFolder(id);
    if (!folder) return;
    const oldName = folder.name;
    let newName = mode === 'replace'
      ? String(oldName).split(options.find || '').join(options.replace || '')
      : formatBatchName(folder, options.format || '*', startAt + index);
    newName = applyTextCase(newName, options.textCase);
    if (newName !== oldName) {
      updateFolder(currentLibrary, folder.id, { name: newName });
      changed.push({ id: folder.id, name: newName, oldName });
    }
  });
  return changed;
}

function batchRenameSmartFolders(ids, options = {}) {
  const mode = options.mode === 'replace' ? 'replace' : 'format';
  const startAt = Number(options.startAt) || 1;
  const changed = [];
  ids.forEach((id, index) => {
    const folder = findSmartFolder(smartFolders, id);
    if (!folder) return;
    const oldName = folder.name;
    let newName = mode === 'replace'
      ? String(oldName).split(options.find || '').join(options.replace || '')
      : formatBatchName(folder, options.format || '*', startAt + index);
    newName = applyTextCase(newName, options.textCase);
    if (newName !== oldName) {
      updateSmartFolder(currentLibrary, folder.id, { name: newName });
      changed.push({ id: folder.id, name: newName, oldName });
    }
  });
  return changed;
}

function batchRenameTags(names, options = {}) {
  const mode = options.mode === 'replace' ? 'replace' : 'format';
  const startAt = Number(options.startAt) || 1;
  const changed = [];
  names.forEach((name, index) => {
    const oldName = String(name || '').trim();
    if (!oldName) return;
    let newName = mode === 'replace'
      ? oldName.split(options.find || '').join(options.replace || '')
      : formatBatchName({ name: oldName, modificationTime: Date.now() }, options.format || '*', startAt + index);
    newName = applyTextCase(newName, options.textCase);
    if (newName && newName !== oldName) {
      replaceTag(oldName, newName);
      changed.push({ name: newName, oldName });
    }
  });
  return changed;
}

function addItemsToFolder(ids, folderId, mode = 'add') {
  const folder = findFolder(folderId);
  if (!folder) throw new Error('Folder not found');
  const selected = readItems().filter((item) => ids.includes(item.id));
  for (const item of selected) {
    if (mode === 'remove') {
      item.folders = (item.folders || []).filter((entry) => entry !== folder.id);
    } else if (mode === 'move') {
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
  if (Array.isArray(currentLibrary.tags.historyTags)) {
    currentLibrary.tags.historyTags = currentLibrary.tags.historyTags.map((tag) => (tag === source ? target : tag));
  }
  if (Array.isArray(currentLibrary.tags.starredTags)) {
    currentLibrary.tags.starredTags = currentLibrary.tags.starredTags.map((tag) => (tag === source ? target : tag));
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
  if (Array.isArray(currentLibrary.tags.historyTags)) {
    currentLibrary.tags.historyTags = [...new Set(currentLibrary.tags.historyTags.map((tag) => (tag === from ? to : tag)).filter((tag) => tag !== from))];
  }
  if (Array.isArray(currentLibrary.tags.starredTags)) {
    currentLibrary.tags.starredTags = [...new Set(currentLibrary.tags.starredTags.map((tag) => (tag === from ? to : tag)).filter((tag) => tag !== from))];
  }
  currentLibrary.metadata.tagsGroups = tagsGroups;
  saveItems(currentLibrary);
}

function removeTag(name) {
  // 删除标签时同步清理条目、标签组和历史/常用标签引用。
  const target = String(name || '').trim();
  if (!target) throw new Error('Tag name is required');
  for (const item of readItems()) {
    item.tags = (item.tags || []).filter((tag) => tag !== target);
  }
  for (const group of tagsGroups) {
    group.tags = (group.tags || []).filter((tag) => tag !== target);
  }
  currentLibrary.tags.historyTags = (currentLibrary.tags.historyTags || []).filter((tag) => tag !== target);
  currentLibrary.tags.starredTags = (currentLibrary.tags.starredTags || []).filter((tag) => tag !== target);
  currentLibrary.metadata.tagsGroups = tagsGroups;
  saveItems(currentLibrary);
}

function createTag(name) {
  const target = String(name || '').trim();
  if (!target) throw new Error('Tag name is required');
  currentLibrary.tags.historyTags = [target, ...(currentLibrary.tags.historyTags || []).filter((tag) => tag !== target)].slice(0, 120);
  saveItems(currentLibrary);
  return { name: target, imageCount: readItems().filter((item) => (item.tags || []).includes(target)).length, groups: [] };
}

app.get('/', (req, res) => {
  res.json(
    ok({
      name: 'Eagle Reverse API',
      version: '4.0.0',
      buildVersion: 20250801,
      platform: process.platform,
      isVersion4: true,
      preferences: {},
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

const pluginStateFile = path.join(userDataDir, 'plugin-state.json');
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
  res.json(ok(await repairLibrary(currentLibrary, { thumbnailTasks })));
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
    if (Array.isArray(req.body.savedFilters)) currentLibrary.savedFilters = req.body.savedFilters;
    if (req.body.tags && typeof req.body.tags === 'object' && !Array.isArray(req.body.tags)) {
      currentLibrary.tags = {
        historyTags: [...new Set((Array.isArray(req.body.tags.historyTags) ? req.body.tags.historyTags : []).filter((tag) => typeof tag === 'string' && tag.trim()).map((tag) => tag.trim()))].slice(0, 120),
        starredTags: [...new Set((Array.isArray(req.body.tags.starredTags) ? req.body.tags.starredTags : []).filter((tag) => typeof tag === 'string' && tag.trim()).map((tag) => tag.trim()))],
      };
    }
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

function tagObjects() {
  // 标签列表返回真实条目计数，避免侧栏计数与搜索合同不一致。
  return tagsGroups
    .flatMap((group) => group.tags || [])
    .map((name) => ({
      name,
      imageCount: readItems().filter((item) => (item.tags || []).includes(name)).length,
      groups: [],
    }));
}

app.get('/api/tag/all', (req, res) => {
  const tags = tagObjects();
  res.json(ok({ tags }));
});

app.get('/api/tag/list', (req, res) => {
  const tags = tagObjects();
  res.json(ok(tags));
});

app.get('/api/tag/listRecent', (req, res) => {
  const tags = tagObjects();
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

app.post('/api/tag/create', (req, res) => {
  try {
    res.json(ok(createTag(req.body.name)));
  } catch (err) {
    res.status(400).json(fail(err.message));
  }
});

app.post('/api/tag/batchRename', (req, res) => {
  try {
    const names = Array.isArray(req.body.names) ? req.body.names : [];
    if (names.length === 0) {
      res.status(400).json(fail('names are required'));
      return;
    }
    res.json(ok(batchRenameTags(names, req.body)));
  } catch (err) {
    res.status(400).json(fail(err.message));
  }
});

app.post('/api/tag/remove', (req, res) => {
  try {
    removeTag(req.body.name);
    res.json(ok(true));
  } catch (err) {
    res.status(400).json(fail(err.message));
  }
});

app.get('/api/item/list', (req, res) => {
  res.json(ok(readItems()));
});

app.get('/api/item/search', (req, res) => {
  res.json(ok(searchItems(readItems(), req.query)));
});

app.post('/api/item/search', (req, res) => {
  res.json(ok(searchItems(readItems(), req.body || {})));
});

app.post('/api/item/search/filters', (req, res) => {
  const rules = req.body.rules || req.body.filters || {};
  res.json(ok(searchItemsByFilterRules(readItems(), rules, req.body.query || {})));
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

app.post('/api/folder/batchRename', (req, res) => {
  try {
    const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
    if (ids.length === 0) {
      res.status(400).json(fail('ids are required'));
      return;
    }
    res.json(ok(batchRenameFolders(ids, req.body)));
  } catch (err) {
    res.status(400).json(fail(err.message));
  }
});

app.post('/api/folder/update', (req, res) => {
  const folder = updateFolder(currentLibrary, req.body.folderId || req.body.id, req.body);
  if (!folder) {
    res.status(404).json(fail('Folder not found'));
    return;
  }
  res.json(ok(folder));
});

app.post('/api/folder/remove', (req, res) => {
  const removed = removeFolder(currentLibrary, req.body.folderId || req.body.id);
  if (!removed) {
    res.status(404).json(fail('Folder not found'));
    return;
  }
  res.json(ok(true));
});

app.post('/api/folder/move', (req, res) => {
  try {
    const folder = moveFolder(
      currentLibrary,
      req.body.folderId || req.body.id,
      req.body.parentId || req.body.parentID || req.body.targetId,
      Number.isInteger(req.body.index) ? req.body.index : undefined,
    );
    res.json(ok(folder));
  } catch (err) {
    res.status(400).json(fail(err.message));
  }
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

function sendDownloadError(res, err) {
  if (err instanceof DownloadError) {
    res.status(err.statusCode).json({ status: 'error', message: err.message, code: err.code, detail: err.detail || undefined });
    return;
  }
  res.status(400).json(fail(err.message));
}

app.post('/api/download/start', (req, res) => {
  try {
    const started = controlledDownloader.start(req.body || {});
    started.promise.catch(() => {});
    res.status(202).json(ok({ task: controlledDownloader.task(started.id) }));
  } catch (err) {
    sendDownloadError(res, err);
  }
});

app.get('/api/download/status', (req, res) => {
  res.json(ok(controlledDownloader.status()));
});

app.get('/api/download/:id', (req, res) => {
  const task = controlledDownloader.task(req.params.id);
  if (!task) {
    res.status(404).json(fail('Download task not found'));
    return;
  }
  res.json(ok(task));
});

app.post('/api/download/:id/cancel', (req, res) => {
  const task = controlledDownloader.task(req.params.id);
  if (!task) {
    res.status(404).json(fail('Download task not found'));
    return;
  }
  res.json(ok({ cancelled: controlledDownloader.cancel(req.params.id), task: controlledDownloader.task(req.params.id) }));
});

app.post('/api/download/direct', async (req, res) => {
  try {
    const download = await controlledDownloader.download(req.body || {});
    res.status(201).json(ok(download));
  } catch (err) {
    sendDownloadError(res, err);
  }
});

app.post('/api/download/release', (req, res) => {
  res.json(ok({ released: controlledDownloader.release(req.body.taskId || req.body.path || '') }));
});

app.post('/api/download/:id/release', (req, res) => {
  res.json(ok({ released: controlledDownloader.release(req.params.id) }));
});

app.post('/api/item/addFromURL', async (req, res) => {
  try {
    if (req.body.dryRun === true) {
      res.json(ok(addMockItems(req.body)[0]));
      return;
    }
    const item = await importUrl(currentLibrary, req.body.url || req.body.src, { ...req.body, downloadService: controlledDownloader });
    res.status(201).json(ok(item));
  } catch (err) {
    sendDownloadError(res, err);
  }
});

app.post('/api/item/addFromURLs', async (req, res) => {
  try {
    const sources = Array.isArray(req.body.images) ? req.body.images : Array.isArray(req.body.urls) ? req.body.urls : [];
    const items = await Promise.all(sources.map((source) => {
      const params = typeof source === 'string' ? { url: source } : source;
      return importUrl(currentLibrary, params.url || params.src, { ...params, downloadService: controlledDownloader });
    }));
    res.status(201).json(ok(items));
  } catch (err) {
    sendDownloadError(res, err);
  }
});

app.post('/api/item/batchSave', (req, res) => {
  batchUpdateItemsResponse(req, res);
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
    if (item.noThumbnail && thumbnailTasks.supports(item.ext)) {
      try {
        await thumbnailTasks.generate(currentLibrary, item.id);
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
      folderIDs: Array.isArray(req.body.folderIDs) ? req.body.folderIDs : [],
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

function sendItemWorkflowError(res, err) {
  const statusCode = err instanceof ItemWorkflowError ? err.statusCode : 500;
  res.status(statusCode).json({ ...fail(err.message), code: err.code || 'ITEM_WORKFLOW_FAILED' });
}

function updateItemResponse(req, res, contract = 'v1') {
  try {
    res.json(ok(itemWorkflow.updateMany(currentLibrary, [req.body || {}], { contract })[0]));
  } catch (err) {
    sendItemWorkflowError(res, err);
  }
}

function updateItemsResponse(req, res, contract = 'v1') {
  try {
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    res.json(ok(itemWorkflow.updateMany(currentLibrary, items, { contract })));
  } catch (err) {
    sendItemWorkflowError(res, err);
  }
}

function batchUpdateItemsResponse(req, res, contract = 'v1') {
  try {
    const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
    if (ids.length === 0) throw new ItemWorkflowError('ids are required', 'ITEM_IDS_REQUIRED');
    const patch = { ...(req.body.patch || {}) };
    delete patch.id;
    delete patch.itemID;
    const updates = ids.map((id) => ({ ...patch, id }));
    res.json(ok(itemWorkflow.updateMany(currentLibrary, updates, { contract })));
  } catch (err) {
    sendItemWorkflowError(res, err);
  }
}

function changeTrashStateResponse(req, res, isDeleted) {
  try {
    const ids = Array.isArray(req.body.ids)
      ? req.body.ids
      : Array.isArray(req.body.itemIds)
        ? req.body.itemIds
        : [req.body.id || req.body.itemID].filter(Boolean);
    if (ids.length === 0) throw new ItemWorkflowError('ids are required', 'ITEM_IDS_REQUIRED');
    const items = isDeleted
      ? itemWorkflow.moveToTrash(currentLibrary, ids)
      : itemWorkflow.restore(currentLibrary, ids);
    const internalBatchRequest = Array.isArray(req.body.ids);
    res.json(ok(internalBatchRequest ? items : true));
  } catch (err) {
    sendItemWorkflowError(res, err);
  }
}

app.post('/api/item/update', (req, res) => updateItemResponse(req, res));
app.post('/api/item/updateMany', (req, res) => updateItemsResponse(req, res));
app.post('/api/item/batchUpdate', (req, res) => batchUpdateItemsResponse(req, res));

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

app.post('/api/item/moveToTrash', (req, res) => changeTrashStateResponse(req, res, true));
app.post('/api/item/restore', (req, res) => changeTrashStateResponse(req, res, false));

async function setCustomThumbnailResponse(req, res) {
  try {
    const result = await customThumbnailService.set(currentLibrary, req.body || {});
    res.json(ok(result));
  } catch (err) {
    res.status(err.statusCode || 422).json({ ...fail(err.message), code: err.code || 'CUSTOM_THUMBNAIL_FAILED' });
  }
}

async function resetCustomThumbnailResponse(req, res) {
  try {
    const id = req.body.id || req.body.itemID || req.body.itemId;
    const result = await customThumbnailService.reset(currentLibrary, id);
    res.json(ok(result));
  } catch (err) {
    res.status(err.statusCode || 422).json({ ...fail(err.message), code: err.code || 'CUSTOM_THUMBNAIL_RESET_FAILED' });
  }
}

async function refreshThumbnailResponse(req, res) {
  try {
    const id = req.body.id || req.body.itemID || req.body.itemId;
    const result = await customThumbnailService.refresh(currentLibrary, id, {
      startAt: req.body.startAt ?? req.body.thumbnailAt,
    });
    res.json(ok(result));
  } catch (err) {
    res.status(err.statusCode || 422).json({ ...fail(err.message), code: err.code || 'THUMBNAIL_REFRESH_FAILED' });
  }
}

function sendThumbnailTaskError(res, err) {
  const statusCode = err instanceof ThumbnailTaskError ? err.statusCode : (err.statusCode || 422);
  res.status(statusCode).json({ ...fail(err.message), code: err.code || 'THUMBNAIL_GENERATION_FAILED' });
}

app.post('/api/item/thumbnailTask/start', (req, res) => {
  try {
    const id = req.body.id || req.body.itemID || req.body.itemId;
    res.status(202).json(ok(thumbnailTasks.enqueue(currentLibrary, id, {
      maxSize: req.body.maxSize,
      startAt: req.body.startAt ?? req.body.thumbnailAt,
    })));
  } catch (err) {
    sendThumbnailTaskError(res, err);
  }
});

app.get('/api/item/thumbnailTask/status', (req, res) => {
  try {
    res.json(ok(thumbnailTasks.status(req.query.taskId || req.query.id)));
  } catch (err) {
    sendThumbnailTaskError(res, err);
  }
});

app.post('/api/item/thumbnailTask/cancel', (req, res) => {
  try {
    res.json(ok(thumbnailTasks.cancel(req.body.taskId || req.body.id)));
  } catch (err) {
    sendThumbnailTaskError(res, err);
  }
});

app.post('/api/item/setCustomThumbnail', setCustomThumbnailResponse);
app.post('/api/item/resetCustomThumbnail', resetCustomThumbnailResponse);
app.post('/api/item/refreshThumbnail', refreshThumbnailResponse);

app.post('/api/item/refreshPalette', async (req, res) => {
  try {
    const id = req.body.id || req.body.itemID;
    if (!id) {
      res.status(400).json(fail('Item id is required'));
      return;
    }
    const result = await colorAnalyzer.enqueue(currentLibrary, id);
    res.json(ok(result));
  } catch (err) {
    res.status(err.statusCode || 422).json({ ...fail(err.message), code: err.code || 'PALETTE_ANALYSIS_FAILED' });
  }
});

app.get('/api/item/paletteQueue', (req, res) => {
  res.json(ok(colorAnalyzer.status()));
});

app.post('/api/item/paletteQueue/pause', (req, res) => {
  res.json(ok(colorAnalyzer.pause()));
});

app.post('/api/item/paletteQueue/resume', (req, res) => {
  res.json(ok(colorAnalyzer.resume()));
});

app.post('/api/item/paletteQueue/delay', (req, res) => {
  try {
    res.json(ok(colorAnalyzer.setDelay(req.body.delayMs)));
  } catch (err) {
    res.status(err.statusCode || 400).json({ ...fail(err.message), code: err.code || 'INVALID_QUEUE_DELAY' });
  }
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
  const items = searchItems(readItems(), req.query);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="items.csv"');
  res.send(itemsToCsv(items));
});

app.post('/api/export/csv', (req, res) => {
  const items = searchItems(readItems(), req.body || {});
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

function permanentDeleteItems(library, ids, options = {}) {
  // 先暂存待删目录，落盘成功后再清理，失败时恢复原条目和目录。
  const idSet = new Set(ids);
  const items = library.items.filter((item) => idSet.has(item.id));
  if (items.length !== idSet.size) {
    const missingId = ids.find((id) => !items.some((item) => item.id === id));
    throw new Error(`Item not found: ${missingId}`);
  }
  if (!options.force && items.some((item) => !item.isDeleted)) {
    throw new Error('Items must be in trash before permanent deletion');
  }
  const previousItems = library.items.slice();
  const staged = [];
  const root = library.rootDir;
  try {
    for (const item of items) {
      const dir = path.join(root, 'images', `${item.id}.info`);
      if (fs.existsSync(dir)) {
        const stagedDir = path.join(root, 'images', `.delete-${item.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
        fs.renameSync(dir, stagedDir);
        staged.push({ dir, stagedDir });
      }
    }
    library.items = library.items.filter((item) => !idSet.has(item.id));
    saveItems(library);
    for (const entry of staged) fs.rmSync(entry.stagedDir, { recursive: true, force: true });
    return { count: items.length, removedIds: ids };
  } catch (err) {
    library.items = previousItems;
    for (const entry of staged.slice().reverse()) {
      if (fs.existsSync(entry.stagedDir) && !fs.existsSync(entry.dir)) fs.renameSync(entry.stagedDir, entry.dir);
    }
    try {
      saveItems(library);
    } catch (rollbackError) {
      // 保留触发回滚的根因。
    }
    throw err;
  }
}

function mergeDuplicatesResponse(req, res) {
  // 合并保留项元数据，冗余项默认进入回收站，permanent 模式才清理真实目录。
  try {
    const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
    const keepId = req.body.keepId || ids[0];
    const removeIds = Array.isArray(req.body.removeIds) ? req.body.removeIds : ids.slice(1);
    if (!keepId || removeIds.length === 0) {
      res.status(400).json(fail('keepId and removeIds are required'));
      return;
    }
    if (removeIds.includes(keepId)) {
      res.status(400).json(fail('removeIds must not include keepId'));
      return;
    }
    let keep = readItems().find((item) => item.id === keepId);
    if (!keep) {
      res.status(404).json(fail('Keep item not found'));
      return;
    }
    const removeItems = readItems().filter((item) => removeIds.includes(item.id));
    if (req.body.keep && typeof req.body.keep === 'object') {
      const patch = { ...req.body.keep, id: keepId };
      delete patch.itemID;
      delete patch.id;
      patch.id = keepId;
      keep = itemWorkflow.updateMany(currentLibrary, [patch], { contract: 'v2' })[0];
    } else {
      for (const remove of removeItems) {
        keep.tags = [...new Set([...(keep.tags || []), ...(remove.tags || [])])];
        keep.folders = [...new Set([...(keep.folders || []), ...(remove.folders || [])])];
        keep.comments = [...(keep.comments || []), ...(remove.comments || [])];
        if (!keep.annotation && remove.annotation) keep.annotation = remove.annotation;
        if (!keep.url && remove.url) keep.url = remove.url;
        if (!keep.star && remove.star) keep.star = remove.star;
      }
      keep.lastModified = Date.now();
    }
    if (req.body.removeMode === 'permanent' || req.body.permanent) {
      permanentDeleteItems(currentLibrary, removeIds, { force: true });
    } else {
      const now = Date.now();
      for (const remove of removeItems) {
        remove.isDeleted = true;
        remove.deletedTime = now;
      }
      saveItems(currentLibrary);
    }
    res.json(ok(keep));
  } catch (err) {
    res.status(400).json(fail(err.message));
  }
}

app.post('/api/item/duplicates/scan', (req, res) => {
  if (req.body.async === true) {
    const job = createJob('duplicate-scan', (jobInstance) => startDuplicateScanJob(jobInstance, {
      method: req.body.method,
      ids: req.body.ids,
      threshold: req.body.threshold,
    }));
    res.status(202).json(ok(job));
    return;
  }
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
  mergeDuplicatesResponse(req, res);
});

app.post('/api/item/emptyTrash', (req, res) => {
  try {
    const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
    if (ids.length === 0) {
      res.status(400).json(fail('ids are required'));
      return;
    }
    res.json(ok(permanentDeleteItems(currentLibrary, ids, { force: req.body.force === true })));
  } catch (err) {
    res.status(400).json(fail(err.message));
  }
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
  const items = searchItems(readItems(), req.body || {});
  const limit = Math.min(Number(req.body?.limit || 50), 1000);
  const offset = Number(req.body?.offset || 0);
  res.json(ok({ data: items.slice(offset, offset + limit), total: items.length, offset, limit }));
});

app.post('/api/v2/item/query/filters', (req, res) => {
  const rules = req.body.rules || req.body.filters || {};
  const items = searchItemsByFilterRules(readItems(), rules, req.body.query || {});
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
    if (item.noThumbnail && thumbnailTasks.supports(item.ext)) {
      try {
        await thumbnailTasks.generate(currentLibrary, item.id);
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

app.post('/api/v2/item/update', (req, res) => updateItemResponse(req, res, 'v2'));
app.post('/api/v2/item/updateMany', (req, res) => updateItemsResponse(req, res, 'v2'));
app.post('/api/v2/item/batchUpdate', (req, res) => batchUpdateItemsResponse(req, res, 'v2'));
app.post('/api/v2/item/batchSave', (req, res) => batchUpdateItemsResponse(req, res, 'v2'));
app.post('/api/v2/item/moveToTrash', (req, res) => changeTrashStateResponse(req, res, true));
app.post('/api/v2/item/restore', (req, res) => changeTrashStateResponse(req, res, false));

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

app.post('/api/v2/item/setCustomThumbnail', setCustomThumbnailResponse);
app.post('/api/v2/item/resetCustomThumbnail', resetCustomThumbnailResponse);
app.post('/api/v2/item/refreshThumbnail', refreshThumbnailResponse);
app.post('/api/v2/item/thumbnailTask/start', (req, res) => {
  try {
    const id = req.body.id || req.body.itemID || req.body.itemId;
    res.status(202).json(ok(thumbnailTasks.enqueue(currentLibrary, id, {
      maxSize: req.body.maxSize,
      startAt: req.body.startAt ?? req.body.thumbnailAt,
    })));
  } catch (err) {
    sendThumbnailTaskError(res, err);
  }
});
app.get('/api/v2/item/thumbnailTask/status', (req, res) => {
  try {
    res.json(ok(thumbnailTasks.status(req.query.taskId || req.query.id)));
  } catch (err) {
    sendThumbnailTaskError(res, err);
  }
});
app.post('/api/v2/item/thumbnailTask/cancel', (req, res) => {
  try {
    res.json(ok(thumbnailTasks.cancel(req.body.taskId || req.body.id)));
  } catch (err) {
    sendThumbnailTaskError(res, err);
  }
});

app.post('/api/v2/item/mergeDuplicates', (req, res) => {
  mergeDuplicatesResponse(req, res);
});

app.post('/api/v2/item/duplicates/scan', (req, res) => {
  if (req.body.async === true) {
    const job = createJob('duplicate-scan', (jobInstance) => startDuplicateScanJob(jobInstance, {
      method: req.body.method,
      ids: req.body.ids,
      threshold: req.body.threshold,
    }));
    res.status(202).json(ok(job));
    return;
  }
  const method = req.body.method === 'similar' ? 'similar' : 'same';
  const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
  const items = ids.length > 0 ? readItems().filter((item) => ids.includes(item.id)) : readItems();
  const startedAt = Date.now();
  const groups = method === 'similar'
    ? findSimilarDuplicates(currentLibrary, items, Number(req.body.threshold) || 0.55)
    : findDuplicates(currentLibrary, items);
  res.json(ok({ method, groups, elapsedMs: Date.now() - startedAt, scanned: items.length }));
});

app.post('/api/v2/item/emptyTrash', (req, res) => {
  try {
    const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
    if (ids.length === 0) {
      res.status(400).json(fail('ids are required'));
      return;
    }
    res.json(ok(permanentDeleteItems(currentLibrary, ids, { force: req.body.force === true })));
  } catch (err) {
    res.status(400).json(fail(err.message));
  }
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

app.post('/api/v2/folder/batchRename', (req, res) => {
  try {
    const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
    if (ids.length === 0) {
      res.status(400).json(fail('ids are required'));
      return;
    }
    res.json(ok(batchRenameFolders(ids, req.body)));
  } catch (err) {
    res.status(400).json(fail(err.message));
  }
});

app.get('/api/v2/folder/all', (req, res) => {
  res.json(ok(folders));
});

app.post('/api/v2/folder/remove', (req, res) => {
  const removed = removeFolder(currentLibrary, req.body.id || req.body.folderID);
  res.json(ok(removed));
});

app.post('/api/v2/folder/move', (req, res) => {
  try {
    const folder = moveFolder(
      currentLibrary,
      req.body.id || req.body.folderID,
      req.body.parentId || req.body.parentID || req.body.targetId,
      Number.isInteger(req.body.index) ? req.body.index : undefined,
    );
    res.json(ok(folder));
  } catch (err) {
    res.status(400).json(fail(err.message));
  }
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
  return findSmartFolder(smartFolders, req.query.id || req.body?.id || req.body?.smartFolderID);
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
  try {
    const conditions = Array.isArray(req.body.conditions) ? req.body.conditions : [];
    if (conditions.length > 0) validateConditions(conditions);
    const folder = createSmartFolder(currentLibrary, {
      name: req.body.name,
      description: req.body.description,
      conditions,
      parentID: req.body.parentID || req.body.parentId,
      index: req.body.index,
      icon: req.body.icon,
      iconColor: req.body.iconColor,
      children: req.body.children,
    });
    smartFolders = currentLibrary.smartFolders;
    res.json(ok(folder));
  } catch (err) {
    res.status(400).json(fail(err.message));
  }
});

app.post('/api/v2/smartFolder/update', (req, res) => {
  try {
    const folder = smartFolderFromRequest(req);
    if (!folder) {
      res.status(404).json(fail('Smart folder not found'));
      return;
    }
    if (Array.isArray(req.body.conditions)) validateConditions(req.body.conditions);
    const patch = { ...req.body };
    delete patch.id;
    delete patch.smartFolderID;
    const updated = updateSmartFolder(currentLibrary, folder.id, patch);
    smartFolders = currentLibrary.smartFolders;
    res.json(ok(updated));
  } catch (err) {
    res.status(400).json(fail(err.message));
  }
});

app.post('/api/v2/smartFolder/batchRename', (req, res) => {
  try {
    const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
    if (ids.length === 0) {
      res.status(400).json(fail('ids are required'));
      return;
    }
    res.json(ok(batchRenameSmartFolders(ids, req.body)));
  } catch (err) {
    res.status(400).json(fail(err.message));
  }
});

app.post('/api/v2/smartFolder/remove', (req, res) => {
  const removed = removeSmartFolder(currentLibrary, req.body.id || req.body.smartFolderID);
  if (!removed) {
    res.status(404).json(fail('Smart folder not found'));
    return;
  }
  smartFolders = currentLibrary.smartFolders;
  res.json(ok(true));
});

app.post('/api/v2/smartFolder/move', (req, res) => {
  try {
    const folder = moveSmartFolder(
      currentLibrary,
      req.body.id || req.body.smartFolderID,
      req.body.parentId || req.body.parentID || req.body.targetId,
      Number.isInteger(req.body.index) ? req.body.index : undefined,
    );
    smartFolders = currentLibrary.smartFolders;
    res.json(ok(folder));
  } catch (err) {
    res.status(400).json(fail(err.message));
  }
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
  res.json(ok(getSerializableRules()));
});

function tagsFromRequest(req) {
  const name = req.query.name || req.body?.name;
  if (!name) return null;
  return { name, imageCount: readItems().filter((item) => (item.tags || []).includes(name)).length, groups: [] };
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
  const tags = tagObjects();
  res.json(ok(tags));
});

app.get('/api/v2/tag/getRecentTags', (req, res) => {
  res.json(ok(currentLibrary.tags.historyTags || []));
});

app.get('/api/v2/tag/getStarredTags', (req, res) => {
  res.json(ok(currentLibrary.tags.starredTags || []));
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

app.post('/api/v2/item/removeFromFolder', (req, res) => {
  try {
    const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
    if (ids.length === 0) {
      res.status(400).json(fail('ids are required'));
      return;
    }
    res.json(ok(addItemsToFolder(ids, req.body.folderID || req.body.folderId, 'remove')));
  } catch (err) {
    res.status(400).json(fail(err.message));
  }
});

app.post('/api/item/removeFromFolder', (req, res) => {
  try {
    const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
    if (ids.length === 0) {
      res.status(400).json(fail('ids are required'));
      return;
    }
    res.json(ok(addItemsToFolder(ids, req.body.folderID || req.body.folderId, 'remove')));
  } catch (err) {
    res.status(400).json(fail(err.message));
  }
});

app.post('/api/v2/tag/create', (req, res) => {
  try {
    res.json(ok(createTag(req.body.name)));
  } catch (err) {
    res.status(400).json(fail(err.message));
  }
});

app.post('/api/v2/tag/batchRename', (req, res) => {
  try {
    const names = Array.isArray(req.body.names) ? req.body.names : [];
    if (names.length === 0) {
      res.status(400).json(fail('names are required'));
      return;
    }
    res.json(ok(batchRenameTags(names, req.body)));
  } catch (err) {
    res.status(400).json(fail(err.message));
  }
});

app.post('/api/v2/tag/remove', (req, res) => {
  try {
    removeTag(req.body.name);
    res.json(ok(true));
  } catch (err) {
    res.status(400).json(fail(err.message));
  }
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
    const allowedRoots = [currentLibrary.rootDir, ...roots].filter(Boolean).map((root) => path.resolve(root));
    const allowed = allowedRoots.some((root) => candidate === root || candidate.startsWith(root + path.sep));
    if (allowed && fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  return null;
}

const thumbnailApp = express();
thumbnailApp.use(cors());
function sendThumbnail(filePath, res) {
  const resolved = resolveThumbnailPath(filePath);
  if (!resolved) {
    res.status(404).json({ status: 'error', message: `Thumbnail not found: ${filePath}` });
    return;
  }
  res.sendFile(resolved);
}

thumbnailApp.get('/', (req, res) => {
  sendThumbnail(req.query.filePath || req.query.path || '', res);
});
thumbnailApp.get('/file/:encoded', (req, res) => {
  sendThumbnail(req.params.encoded || '', res);
});

const extensionApp = express();
const allowedExtensionOrigin = (origin) => {
  if (!origin || origin === 'null') return true;
  if (/^chrome-extension:\/\//i.test(origin)) return true;
  return /^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(origin);
};
extensionApp.use(cors({
  origin(origin, callback) {
    if (allowedExtensionOrigin(origin)) callback(null, true);
    else callback(new Error('Origin not allowed'));
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Content-Length'],
  maxAge: 600,
}));
extensionApp.use(express.urlencoded({ extended: true, limit: '30mb' }));
extensionApp.use(express.json({ limit: '30mb' }));
extensionApp.get('/', (req, res) => {
  res.json({
    status: 'success',
    showCollectModal: false,
    version: '4.0.0',
    platform: 'win32',
    isVersion4: true,
    buildVersion: 20250801,
    preferences: {},
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

function sendCaptureError(res, err) {
  const statusCode = err instanceof CaptureError ? err.statusCode : 500;
  res.status(statusCode).json({
    status: 'error',
    message: err && err.message ? err.message : 'Capture failed',
    code: err && err.code ? err.code : 'CAPTURE_FAILED',
    ...(err && err.detail ? { detail: err.detail } : {}),
  });
}

function hasBatchField(body) {
  if (!body || typeof body !== 'object') return false;
  if (Array.isArray(body.images) || Array.isArray(body.items)) return true;
  if (Object.keys(body).some((name) => /^(images|items)\[/.test(name))) return true;
  if (typeof body.images === 'string' && /^\[/.test(body.images.trim())) return true;
  if (typeof body.items === 'string' && /^\[/.test(body.items.trim())) return true;
  return false;
}

async function extensionSingleCapture(req, res) {
  try {
    const item = await captureService.captureSingle(currentLibrary, req.body || {});
    res.status(201).json(ok(item));
  } catch (err) {
    sendCaptureError(res, err);
  }
}

async function extensionBatchCapture(req, res) {
  if (!hasBatchField(req.body)) {
    await extensionSingleCapture(req, res);
    return;
  }
  try {
    const job = captureService.startBatch(currentLibrary, req.body || {});
    if (req.query.sync === 'true') {
      const done = await captureService.awaitJob(job.id);
      res.status(201).json(ok({
        jobId: job.id,
        status: done.status,
        ...done.result,
      }));
      return;
    }
    res.status(202).json(ok(job));
  } catch (err) {
    sendCaptureError(res, err);
  }
}

async function extensionRootCapture(req, res) {
  if (req.body && String(req.body.dryRun) === 'true') {
    res.json(ok({
      id: `MOCK-ADDED-${Date.now()}`,
      name: req.body.title || req.body.name || 'Smoke Save',
      ext: 'png',
    }));
    return;
  }
  if (hasBatchField(req.body)) {
    await extensionBatchCapture(req, res);
    return;
  }
  await extensionSingleCapture(req, res);
}

extensionApp.post('/', extensionRootCapture);
extensionApp.post('/api/capture', extensionSingleCapture);
extensionApp.post('/api/capture/batch', extensionBatchCapture);
extensionApp.get('/api/capture/status', (req, res) => {
  res.json(ok(captureService.status()));
});
extensionApp.get('/api/capture/jobs/:id', (req, res) => {
  const task = captureService.task(req.params.id);
  if (!task) {
    res.status(404).json(fail('Capture job not found'));
    return;
  }
  res.json(ok(task));
});
extensionApp.post('/api/capture/jobs/:id/cancel', (req, res) => {
  const task = captureService.task(req.params.id);
  if (!task) {
    res.status(404).json(fail('Capture job not found'));
    return;
  }
  res.json(ok({ cancelled: captureService.cancel(task.id), task: captureService.task(task.id) }));
});
extensionApp.post('/api/item/addFile', upload.single('file'), async (req, res) => {
  if (!req.file) {
    await extensionSingleCapture(req, res);
    return;
  }
  try {
    const parsed = path.parse(req.file.originalname);
    const item = importFile(currentLibrary, req.file.path, {
      name: parsed.name,
      originalName: req.file.originalname,
      ext: parsed.ext.slice(1),
      mime: req.file.mimetype,
      url: req.body.url || '',
      website: req.body.website || '',
      annotation: req.body.annotation || '',
      tags: normalizeExtensionArray(req.body, 'tags'),
      folderIDs: normalizeExtensionArray(req.body, 'folderIDs').concat(req.body.folderID ? [req.body.folderID] : []),
      star: req.body.star,
    });
    res.status(201).json(ok(item));
  } catch (err) {
    sendCaptureError(res, err);
  } finally {
    fs.rmSync(req.file.path, { force: true });
  }
});
extensionApp.post('/api/item/addURL', extensionSingleCapture);
extensionApp.post('/api/item/addURLs', extensionBatchCapture);
extensionApp.post('/api/item/batchSave', extensionBatchCapture);
extensionApp.post('/api/item/import-images', extensionBatchCapture);
extensionApp.post('/api/collect', extensionRootCapture);
extensionApp.get('/api/version', (req, res) => {
  res.json({ status: 'success', version: '4.0.0', platform: 'win32', isVersion4: true });
});
extensionApp.get('/api/extension/status', (req, res) => {
  res.json({
    status: 'success',
    enabled: true,
    version: '1.0.0',
    endpoints: ['/api/capture', '/api/capture/batch', '/api/collect', '/api/item/addFile', '/api/item/addURL', '/api/item/addURLs', '/api/item/batchSave', '/api/item/import-images'],
  });
});
extensionApp.post('/api/extension/collect', extensionRootCapture);
extensionApp.use((err, req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }
  const code = err && err.type === 'entity.too.large' ? 'REQUEST_TOO_LARGE' : 'INVALID_CAPTURE_REQUEST';
  const statusCode = err && err.message === 'Origin not allowed' ? 403 : err && err.statusCode ? err.statusCode : code === 'REQUEST_TOO_LARGE' ? 413 : 400;
  res.status(statusCode).json({ status: 'error', message: err && err.message ? err.message : 'Invalid capture request', code });
});

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
