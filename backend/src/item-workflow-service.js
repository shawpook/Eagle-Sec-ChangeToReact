import fs from 'node:fs';
import path from 'node:path';
import { saveItems } from './library-store.js';

const INVALID_NAME = /[<>:"/\\|?*\u0000-\u001f]/;
const RESERVED_NAME = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;
const ALLOWED_FIELDS = new Set([
  'name',
  'annotation',
  'url',
  'website',
  'star',
  'tags',
  'folders',
  'comments',
  'isDeleted',
  'deletedTime',
  'modificationTime',
]);
const V2_ALLOWED_FIELDS = new Set([
  ...ALLOWED_FIELDS,
  'ext',
  'width',
  'height',
  'noThumbnail',
  'noPreview',
]);

export class ItemWorkflowError extends Error {
  constructor(message, code = 'ITEM_WORKFLOW_FAILED', statusCode = 400) {
    super(message);
    this.name = 'ItemWorkflowError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

function normalizeItemName(value) {
  const rawName = String(value || '').normalize('NFC');
  const name = rawName.trim();
  if (!name) throw new ItemWorkflowError('Item name is required', 'INVALID_ITEM_NAME');
  if (name.length > 240) throw new ItemWorkflowError('Item name must be 240 characters or fewer', 'INVALID_ITEM_NAME');
  if (INVALID_NAME.test(name) || RESERVED_NAME.test(name) || /[. ]$/.test(rawName)) {
    throw new ItemWorkflowError('Item name contains unsupported characters', 'INVALID_ITEM_NAME');
  }
  return name;
}

function normalizeStringArray(value) {
  return [...new Set((Array.isArray(value) ? value : []).map((entry) => String(entry).trim()).filter(Boolean))];
}

function normalizeExtension(value) {
  const ext = String(value || '').normalize('NFC').trim().replace(/^\.+/, '').toLowerCase();
  if (!ext || ext.length > 32 || !/^[a-z0-9][a-z0-9._+-]*$/i.test(ext)) {
    throw new ItemWorkflowError('Item extension is invalid', 'INVALID_ITEM_EXTENSION');
  }
  return ext;
}

function normalizeDimension(value, key) {
  const dimension = Number(value);
  if (!Number.isFinite(dimension) || dimension < 0 || dimension > 1_000_000) {
    throw new ItemWorkflowError(`Item ${key} is invalid`, 'INVALID_ITEM_DIMENSION');
  }
  return Math.round(dimension);
}

function normalizePatch(input = {}, allowedFields = ALLOWED_FIELDS) {
  const patch = {};
  for (const key of allowedFields) {
    if (!Object.prototype.hasOwnProperty.call(input, key)) continue;
    if (key === 'name') patch.name = normalizeItemName(input.name);
    else if (key === 'ext') {
      if (typeof input.ext !== 'string') continue;
      patch.ext = normalizeExtension(input.ext);
    }
    else if (key === 'width' || key === 'height') {
      if (typeof input[key] !== 'number') continue;
      patch[key] = normalizeDimension(input[key], key);
    }
    else if (key === 'tags' || key === 'folders') patch[key] = normalizeStringArray(input[key]);
    else if (key === 'comments') patch.comments = Array.isArray(input.comments) ? structuredClone(input.comments) : [];
    else if (key === 'star') patch.star = Math.max(0, Math.min(5, Number(input.star) || 0));
    else if (key === 'isDeleted') patch.isDeleted = Boolean(input.isDeleted);
    else if (key === 'noThumbnail' || key === 'noPreview') {
      if (typeof input[key] !== 'boolean') continue;
      patch[key] = input[key];
    }
    else if (key === 'deletedTime' || key === 'modificationTime') patch[key] = Number(input[key]) || 0;
    else patch[key] = String(input[key] ?? '');
  }
  return patch;
}

function samePath(left, right) {
  const normalize = (value) => {
    const resolved = path.resolve(value);
    return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
  };
  return normalize(left) === normalize(right);
}

function itemRenamePairs(library, item, patch) {
  const newName = patch.name ?? item.name;
  const newExt = patch.ext ?? item.ext;
  const nameChanged = newName !== item.name;
  const extChanged = newExt !== item.ext;
  if (!nameChanged && !extChanged) return [];
  const infoDir = path.join(library.rootDir, 'images', `${item.id}.info`);
  const source = path.join(infoDir, `${item.name}.${item.ext}`);
  const target = path.join(infoDir, `${newName}.${newExt}`);
  const pairs = [];

  if (extChanged) {
    const sourceExists = fs.existsSync(source);
    const targetExists = fs.existsSync(target);
    if (!targetExists) {
      throw new ItemWorkflowError(`Item extension target is missing: ${path.basename(target)}`, 'ITEM_EXTENSION_TARGET_MISSING', 409);
    }
    if (sourceExists && !samePath(source, target)) {
      throw new ItemWorkflowError(`Item extension target already exists: ${path.basename(target)}`, 'ITEM_RENAME_CONFLICT', 409);
    }
  } else {
    pairs.push({ source, target, required: true });
  }

  if (nameChanged) {
    pairs.push({
      source: path.join(infoDir, `${item.name}_thumbnail.png`),
      target: path.join(infoDir, `${newName}_thumbnail.png`),
      required: false,
    });
  }
  return pairs;
}

function validateRenamePair(pair, item) {
  if (!fs.existsSync(pair.source)) {
    if (pair.required) {
      throw new ItemWorkflowError(`Item source file is missing: ${item.id}`, 'ITEM_SOURCE_MISSING', 409);
    }
    return false;
  }
  if (fs.existsSync(pair.target) && !samePath(pair.source, pair.target)) {
    throw new ItemWorkflowError(`Item rename target already exists: ${path.basename(pair.target)}`, 'ITEM_RENAME_CONFLICT', 409);
  }
  return !samePath(pair.source, pair.target) || pair.source !== pair.target;
}

function renameFileSafely(source, target) {
  if (source === target) return [];
  if (samePath(source, target)) {
    const temporary = path.join(path.dirname(source), `.${path.basename(source)}.rename-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    fs.renameSync(source, temporary);
    try {
      fs.renameSync(temporary, target);
      return [{ source, target }];
    } catch (err) {
      if (fs.existsSync(temporary)) fs.renameSync(temporary, source);
      throw err;
    }
  }
  fs.renameSync(source, target);
  return [{ source, target }];
}

function rollbackRenames(completed) {
  for (const operation of completed.slice().reverse()) {
    try {
      if (samePath(operation.source, operation.target) && operation.source !== operation.target) {
        if (fs.existsSync(operation.target)) renameFileSafely(operation.target, operation.source);
      } else if (fs.existsSync(operation.target) && !fs.existsSync(operation.source)) {
        fs.renameSync(operation.target, operation.source);
      }
    } catch (err) {
      // 保留原始错误；后续重新载入资料库时仍可通过 metadata 定位异常。
    }
  }
}

export class ItemWorkflowService {
  updateMany(library, inputs = [], options = {}) {
    const list = Array.isArray(inputs) ? inputs : [inputs];
    const allowedFields = options.contract === 'v2' ? V2_ALLOWED_FIELDS : ALLOWED_FIELDS;
    if (list.length === 0) throw new ItemWorkflowError('At least one item update is required', 'ITEM_UPDATES_REQUIRED');

    const seen = new Set();
    const plans = list.map((input) => {
      const id = String(input?.id || input?.itemID || '').trim();
      if (!id) throw new ItemWorkflowError('Item id is required', 'ITEM_ID_REQUIRED');
      if (seen.has(id)) throw new ItemWorkflowError(`Duplicate item update: ${id}`, 'DUPLICATE_ITEM_UPDATE');
      seen.add(id);
      const index = library.items.findIndex((entry) => entry.id === id);
      if (index < 0) throw new ItemWorkflowError(`Item not found: ${id}`, 'ITEM_NOT_FOUND', 404);
      const current = library.items[index];
      const patch = normalizePatch(input.patch && typeof input.patch === 'object' ? input.patch : input, allowedFields);
      const renamePairs = Object.prototype.hasOwnProperty.call(patch, 'name') || Object.prototype.hasOwnProperty.call(patch, 'ext')
        ? itemRenamePairs(library, current, patch).filter((pair) => validateRenamePair(pair, current))
        : [];
      return { id, index, current, patch, renamePairs };
    });

    const previousItems = library.items.slice();
    const completedRenames = [];
    try {
      for (const plan of plans) {
        for (const pair of plan.renamePairs) {
          completedRenames.push(...renameFileSafely(pair.source, pair.target));
        }
      }

      const now = Date.now();
      const updated = plans.map((plan) => {
        const next = {
          ...plan.current,
          ...plan.patch,
          id: plan.id,
          lastModified: now,
        };
        if (next.isDeleted && !next.deletedTime) next.deletedTime = now;
        if (!next.isDeleted) delete next.deletedTime;
        library.items[plan.index] = next;
        return next;
      });
      saveItems(library);
      return updated;
    } catch (err) {
      library.items = previousItems;
      rollbackRenames(completedRenames);
      try {
        saveItems(library);
      } catch (rollbackError) {
        // 不覆盖触发回滚的根因。
      }
      if (err instanceof ItemWorkflowError) throw err;
      throw new ItemWorkflowError(err.message, 'ITEM_UPDATE_TRANSACTION_FAILED', 500);
    }
  }

  moveToTrash(library, ids = []) {
    const now = Date.now();
    return this.updateMany(library, ids.map((id) => ({ id, isDeleted: true, deletedTime: now })));
  }

  restore(library, ids = []) {
    return this.updateMany(library, ids.map((id) => ({ id, isDeleted: false, deletedTime: 0 })));
  }
}
