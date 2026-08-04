import fs from 'node:fs';
import path from 'node:path';
import { itemOriginalPath } from './library-store.js';

const RESERVED_NAME = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;

function sanitizeSegment(value, fallback = 'Untitled') {
  let result = String(value || '')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
    .replace(/[. ]+$/g, '')
    .trim();
  if (!result) result = fallback;
  if (RESERVED_NAME.test(result)) result += '_';
  return result.slice(0, 180);
}

function uniqueDestination(directory, name, ext, reserved) {
  const base = sanitizeSegment(name, 'Untitled');
  const suffix = String(ext || '').replace(/^\./, '').toLowerCase();
  let index = 0;
  while (true) {
    const label = index === 0 ? '' : `-${index}`;
    const fileName = suffix ? `${base}${label}.${suffix}` : `${base}${label}`;
    const key = fileName.toLowerCase();
    const target = path.join(directory, fileName);
    if (!reserved.has(key) && !fs.existsSync(target)) {
      reserved.add(key);
      return target;
    }
    index += 1;
  }
}

async function copyWithTimestamps(source, destination) {
  const stat = await fs.promises.stat(source);
  await fs.promises.copyFile(source, destination, fs.constants.COPYFILE_EXCL);
  await fs.promises.utimes(destination, stat.atime, stat.mtime);
}

function normalizeItems(library, items) {
  const requested = Array.isArray(items) ? items : [];
  return requested.map((entry) => {
    const id = typeof entry === 'string' ? entry : entry && entry.id;
    const item = library.itemMap.get(id);
    if (!item) throw new Error(`Item not found: ${id || 'unknown'}`);
    const source = itemOriginalPath(library, item);
    if (!fs.existsSync(source) || !fs.statSync(source).isFile()) throw new Error(`Item original file missing: ${item.id}`);
    return { item, source };
  });
}

export class ExportCancelledError extends Error {
  constructor() {
    super('Export cancelled');
    this.name = 'ExportCancelledError';
  }
}

export async function exportImages(library, params = {}, hooks = {}) {
  const destination = path.resolve(String(params.savePath || params.destDir || ''));
  if (!String(params.savePath || params.destDir || '').trim()) throw new Error('Export destination is required');
  fs.mkdirSync(destination, { recursive: true });
  fs.accessSync(destination, fs.constants.W_OK);
  const selected = normalizeItems(library, params.images || params.ids || []);
  if (selected.length === 0) throw new Error('At least one item is required for export');

  const existing = new Set(fs.readdirSync(destination).map((entry) => entry.toLowerCase()));
  const outputPaths = [];
  for (let index = 0; index < selected.length; index += 1) {
    if (hooks.isCancelled && hooks.isCancelled()) throw new ExportCancelledError();
    const { item, source } = selected[index];
    const target = uniqueDestination(destination, item.name, item.ext, existing);
    await copyWithTimestamps(source, target);
    outputPaths.push(target);
    if (hooks.onProgress) hooks.onProgress({ current: index + 1, total: selected.length, item, path: target });
  }
  return { destination, paths: outputPaths, count: outputPaths.length };
}

function collectFolderTasks(library, folder, destination, tasks) {
  const folderDirectory = path.join(destination, sanitizeSegment(folder.name, 'Folder'));
  const directIds = new Set(Array.isArray(folder.images) ? folder.images.map((entry) => typeof entry === 'string' ? entry : entry.id) : []);
  if (directIds.size === 0) {
    for (const item of library.items) {
      if ((item.folders || []).includes(folder.id)) directIds.add(item.id);
    }
  }
  tasks.push({ directory: folderDirectory, ids: [...directIds] });
  for (const child of folder.children || []) collectFolderTasks(library, child, folderDirectory, tasks);
}

export async function exportAsFolder(library, params = {}, hooks = {}) {
  const destination = path.resolve(String(params.savePath || params.destDir || ''));
  if (!String(params.savePath || params.destDir || '').trim()) throw new Error('Export destination is required');
  if (!params.folder) return exportImages(library, params, hooks);

  const tasks = [];
  collectFolderTasks(library, params.folder, destination, tasks);
  const total = tasks.reduce((sum, task) => sum + task.ids.length, 0);
  const paths = [];
  let current = 0;
  for (const task of tasks) {
    if (hooks.isCancelled && hooks.isCancelled()) throw new ExportCancelledError();
    fs.mkdirSync(task.directory, { recursive: true });
    const result = await exportImages(library, { savePath: task.directory, ids: task.ids }, {
      isCancelled: hooks.isCancelled,
      onProgress(progress) {
        current += 1;
        paths.push(progress.path);
        if (hooks.onProgress) hooks.onProgress({ ...progress, current, total });
      },
    });
    if (result.count === 0 && task.ids.length > 0) throw new Error(`Folder export failed: ${task.directory}`);
  }
  return { destination, paths, count: paths.length };
}
