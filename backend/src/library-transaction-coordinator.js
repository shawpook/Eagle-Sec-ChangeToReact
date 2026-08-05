import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  assertPathInside,
  copyFileSnapshot,
  listTransactionDirectories,
  readGeneration,
  readJsonSync,
  relativeLibraryPath,
  sha256File,
  sha256Text,
  transactionDirectory,
  writeJsonSync,
} from './library-strict.js';

const LOCK_FILE = 'lock.json';
const DEFAULT_STALE_LOCK_MS = 60_000;

export class LibraryTransactionError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'LibraryTransactionError';
    this.code = code;
    this.details = details;
  }
}

function txError(code, message, details = {}) {
  return new LibraryTransactionError(code, message, details);
}

function normalizedLibraryKey(rootDir) {
  const resolved = path.resolve(rootDir);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function samePathCase(left, right) {
  if (process.platform !== 'win32') return false;
  return path.resolve(left).toLowerCase() === path.resolve(right).toLowerCase() && left !== right;
}

function exactPathExists(file) {
  if (!fs.existsSync(file)) return false;
  const directory = path.dirname(file);
  try {
    return fs.readdirSync(directory).includes(path.basename(file));
  } catch {
    return true;
  }
}

function renameWithCaseWorkaround(source, target) {
  if (samePathCase(source, target)) {
    const temporary = path.join(path.dirname(source), `.${path.basename(source)}.rename-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    fs.renameSync(source, temporary);
    try {
      fs.renameSync(temporary, target);
    } catch (err) {
      if (fs.existsSync(temporary)) fs.renameSync(temporary, source);
      throw err;
    }
    return;
  }
  fs.renameSync(source, target);
}

function isProcessAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err && err.code === 'EPERM';
  }
}

export function acquireLibraryLock(rootDir, options = {}) {
  const root = path.resolve(rootDir);
  const recoveryRoot = transactionDirectory(root);
  fs.mkdirSync(path.join(recoveryRoot, 'transactions'), { recursive: true });
  const lockPath = path.join(recoveryRoot, LOCK_FILE);
  const token = crypto.randomUUID();
  const now = Date.now();
  const staleMs = Number(options.staleLockMs) || DEFAULT_STALE_LOCK_MS;

  if (fs.existsSync(lockPath)) {
    let existing = null;
    try {
      existing = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
    } catch {
      existing = null;
    }
    const stale = !existing
      || !existing.token
      || !isProcessAlive(Number(existing.pid))
      || (Number(existing.updatedAt) || 0) < now - staleMs;
    if (!stale) {
      throw txError('LIBRARY_WRITE_LOCKED', `Library is locked by another writer: ${root}`, {
        owner: existing.owner || 'unknown',
        pid: existing.pid,
      });
    }
  }

  const lock = {
    version: 1,
    token,
    owner: options.owner || process.env.EAGLE_LIBRARY_OWNER || `pid-${process.pid}`,
    pid: process.pid,
    createdAt: now,
    updatedAt: now,
    heartbeatMs: staleMs,
  };
  writeJsonSync(lockPath, lock);
  return { path: lockPath, token, rootDir: root };
}

export function refreshLibraryLock(lock) {
  if (!lock || !lock.token || !fs.existsSync(lock.path)) return lock;
  const current = readJsonSync(lock.path);
  if (!current || current.token !== lock.token) return lock;
  current.updatedAt = Date.now();
  writeJsonSync(lock.path, current);
  return lock;
}

export function releaseLibraryLock(lock) {
  if (!lock || !lock.token || !fs.existsSync(lock.path)) return;
  const current = readJsonSync(lock.path);
  if (!current || current.token !== lock.token) return;
  fs.rmSync(lock.path, { force: true });
}

function buildLibraryTargets(library) {
  const root = path.resolve(library.rootDir);
  const now = Date.now();
  const targets = [];
  const cacheData = (library.items || []).map((item) => JSON.stringify(item)).join('\n') + '\n';
  targets.push({ relative: 'cache.json', data: cacheData });

  const searchIndex = {
    version: 1,
    updatedAt: now,
    items: (library.items || []).map((item) => ({
      id: item.id,
      name: item.name,
      ext: item.ext,
      tags: item.tags || [],
      folders: item.folders || [],
      annotation: item.annotation || '',
      url: item.url || '',
      star: item.star || 0,
      modificationTime: item.modificationTime || 0,
    })),
  };
  targets.push({ relative: 'search-index.json', data: JSON.stringify(searchIndex, null, 2) });

  for (const item of library.items || []) {
    const relative = `images/${item.id}.info/metadata.json`;
    targets.push({ relative, data: JSON.stringify(item, null, 2) });
  }

  const stateFiles = [
    ['metadata.json', library.metadata],
    ['tags.json', library.tags],
    ['saved-filters.json', library.savedFilters],
    ['folders.json', library.folders],
  ];
  for (const [relative, value] of stateFiles) {
    targets.push({ relative, data: JSON.stringify(value, null, 2) });
  }

  return targets.map((target) => ({
    ...target,
    absolute: path.join(root, target.relative),
  }));
}

function normalizeFileOperation(operation, rootDir) {
  if (!operation || typeof operation !== 'object') {
    throw txError('TRANSACTION_MANIFEST_INVALID', 'File operation must be an object');
  }
  const kind = operation.kind;
  if (!['rename-file', 'delete-file'].includes(kind)) {
    throw txError('TRANSACTION_MANIFEST_INVALID', `Unsupported file operation kind: ${kind}`);
  }
  if (kind === 'rename-file') {
    if (!operation.source || !operation.target) {
      throw txError('TRANSACTION_MANIFEST_INVALID', 'rename-file requires source and target');
    }
    const source = assertPathInside(rootDir, path.resolve(String(operation.source)));
    const target = assertPathInside(rootDir, path.resolve(String(operation.target)));
    if (!fs.existsSync(source)) {
      throw txError('TRANSACTION_PREPARE_FAILED', `rename source does not exist: ${source}`);
    }
    return {
      kind,
      source: relativeLibraryPath(rootDir, source),
      target: relativeLibraryPath(rootDir, target),
      sourceAbsolute: source,
      targetAbsolute: target,
    };
  }
  if (!operation.target) {
    throw txError('TRANSACTION_MANIFEST_INVALID', 'delete-file requires target');
  }
  const target = assertPathInside(rootDir, path.resolve(String(operation.target)));
  return {
    kind,
    target: relativeLibraryPath(rootDir, target),
    targetAbsolute: target,
  };
}

function prepareTransaction(library, targets, fileOperations, lock, options = {}) {
  const rootDir = path.resolve(library.rootDir);
  const beforeGeneration = readGeneration(rootDir);
  const currentGeneration = Number(library.metadata?.generation ?? 0);
  const targetGeneration = Number.isInteger(options.targetGeneration)
    ? options.targetGeneration
    : currentGeneration + 1;
  const transactionId = `TX-${Date.now()}-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
  const txRoot = path.join(transactionDirectory(rootDir), 'transactions', transactionId);
  const beforeRoot = path.join(txRoot, 'before');
  const stagedRoot = path.join(txRoot, 'staged');
  fs.mkdirSync(beforeRoot, { recursive: true });
  fs.mkdirSync(stagedRoot, { recursive: true });

  const operations = [];
  targets.forEach((target, index) => {
    const beforeRelative = `before/${String(index).padStart(4, '0')}`;
    const stagedRelative = `staged/${String(index).padStart(4, '0')}`;
    const beforeAbsolute = path.join(txRoot, beforeRelative);
    const stagedAbsolute = path.join(txRoot, stagedRelative);
    const beforeExists = fs.existsSync(target.absolute);
    const beforeHash = beforeExists ? sha256File(target.absolute) : null;
    if (beforeExists) copyFileSnapshot(target.absolute, beforeAbsolute);
    fs.writeFileSync(stagedAbsolute, target.data, 'utf8');
    operations.push({
      kind: 'replace-file',
      target: target.relative,
      beforeExists,
      beforeHash,
      beforePath: beforeRelative,
      stagedPath: stagedRelative,
      afterHash: sha256Text(target.data),
      status: 'pending',
    });
  });

  for (const operation of fileOperations || []) {
    const normalized = normalizeFileOperation(operation, rootDir);
    const index = operations.length;
    const beforeRelative = `before/${String(index).padStart(4, '0')}`;
    const beforeAbsolute = path.join(txRoot, beforeRelative);
    if (normalized.kind === 'rename-file') {
      const afterHash = sha256File(normalized.sourceAbsolute);
      const targetBeforeExists = fs.existsSync(normalized.targetAbsolute);
      const targetBeforeHash = targetBeforeExists ? sha256File(normalized.targetAbsolute) : null;
      copyFileSnapshot(normalized.sourceAbsolute, beforeAbsolute);
      if (targetBeforeExists) {
        const targetBeforeRelative = `before/${String(index + 1000).padStart(4, '0')}`;
        copyFileSnapshot(normalized.targetAbsolute, path.join(txRoot, targetBeforeRelative));
        operations.push({
          kind: 'rename-file',
          source: normalized.source,
          target: normalized.target,
          beforeExists: true,
          beforeHash: afterHash,
          beforePath: beforeRelative,
          targetBeforeExists: true,
          targetBeforeHash,
          targetBeforePath: targetBeforeRelative,
          afterHash,
          status: 'pending',
        });
      } else {
        operations.push({
          kind: 'rename-file',
          source: normalized.source,
          target: normalized.target,
          beforeExists: true,
          beforeHash: afterHash,
          beforePath: beforeRelative,
          targetBeforeExists: false,
          targetBeforeHash: null,
          targetBeforePath: null,
          afterHash,
          status: 'pending',
        });
      }
    } else {
      const targetExists = fs.existsSync(normalized.targetAbsolute);
      const beforeHash = targetExists ? sha256File(normalized.targetAbsolute) : null;
      if (targetExists) copyFileSnapshot(normalized.targetAbsolute, beforeAbsolute);
      operations.push({
        kind: 'delete-file',
        target: normalized.target,
        beforeExists: targetExists,
        beforeHash,
        beforePath: targetExists ? beforeRelative : null,
        afterExists: false,
        afterHash: null,
        status: 'pending',
      });
    }
  }

  const manifest = {
    version: 1,
    id: transactionId,
    libraryId: library.metadata?.libraryId || path.basename(rootDir).replace(/\.library$/i, '') || 'library',
    libraryPath: relativeLibraryPath(path.dirname(rootDir), rootDir),
    type: 'library-snapshot',
    state: 'PREPARED',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    owner: {
      token: lock.token,
      pid: process.pid,
    },
    baseGeneration: beforeGeneration,
    targetGeneration,
    operations,
  };
  writeJsonSync(path.join(txRoot, 'manifest.json'), manifest);
  return { txRoot, manifest, targetGeneration };
}

function manifestFile(txRoot) {
  return path.join(txRoot, 'manifest.json');
}

function loadManifest(txRoot) {
  return readJsonSync(manifestFile(txRoot));
}

function saveManifest(txRoot, manifest) {
  manifest.updatedAt = Date.now();
  writeJsonSync(manifestFile(txRoot), manifest);
}

function maybeFailpoint(name, index) {
  const failpoint = process.env.EAGLE_TX_FAILPOINT;
  if (!failpoint) return;
  let hit = failpoint === name;
  if (failpoint.startsWith('after-operation:')) {
    const target = Number(failpoint.split(':')[1]);
    hit = hit || Number.isInteger(target) && target === index;
  }
  if (failpoint.startsWith('before-operation:')) {
    const target = Number(failpoint.split(':')[1]);
    hit = hit || Number.isInteger(target) && target === index;
  }
  if (!hit) return;
  if (process.env.EAGLE_TX_FAILPOINT_EXIT === '1') {
    process.exit(77);
  }
  throw txError('TRANSACTION_FAILPOINT', `Transaction failpoint: ${name}`, { failpoint });
}

function targetAbsolute(rootDir, relative) {
  return assertPathInside(rootDir, path.join(rootDir, relative));
}

function applyReplaceOperation(rootDir, txRoot, operation) {
  const target = targetAbsolute(rootDir, operation.target);
  const staged = path.join(txRoot, operation.stagedPath);
  if (!fs.existsSync(staged)) {
    throw txError('TRANSACTION_COMMIT_FAILED', `Staged file is missing: ${operation.stagedPath}`);
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.renameSync(staged, target);
}

function applyRenameOperation(rootDir, operation) {
  const source = targetAbsolute(rootDir, operation.source);
  const target = targetAbsolute(rootDir, operation.target);
  if (exactPathExists(target)) {
    throw txError('TRANSACTION_COMMIT_FAILED', `Rename target already exists: ${operation.target}`);
  }
  renameWithCaseWorkaround(source, target);
}

function applyDeleteOperation(rootDir, operation) {
  fs.rmSync(targetAbsolute(rootDir, operation.target), { force: true });
}

function applyOperation(rootDir, txRoot, operation) {
  if (operation.kind === 'replace-file') applyReplaceOperation(rootDir, txRoot, operation);
  else if (operation.kind === 'rename-file') applyRenameOperation(rootDir, operation);
  else if (operation.kind === 'delete-file') applyDeleteOperation(rootDir, operation);
  else throw txError('TRANSACTION_MANIFEST_INVALID', `Unknown operation kind: ${operation.kind}`);
}

function commitPreparedTransaction(library, prepared, existingLock = null) {
  const rootDir = path.resolve(library.rootDir);
  const { txRoot, manifest, targetGeneration } = prepared;
  const lock = existingLock || acquireLibraryLock(rootDir);
  const ownsLock = !existingLock;
  try {
    maybeFailpoint('after-manifest-prepared', -1);
    manifest.state = 'COMMITTING';
    saveManifest(txRoot, manifest);
    manifest.operations.forEach((operation, index) => {
      maybeFailpoint('before-operation', index);
      applyOperation(rootDir, txRoot, operation);
      operation.status = 'done';
      saveManifest(txRoot, manifest);
      maybeFailpoint('after-operation', index);
    });
    maybeFailpoint('before-commit-marker', -1);
    manifest.state = 'COMMITTED';
    saveManifest(txRoot, manifest);
    maybeFailpoint('after-commit-before-cleanup', -1);
    fs.rmSync(txRoot, { recursive: true, force: true });
    library.metadata.generation = targetGeneration;
    return { transactionId: manifest.id, targetGeneration };
  } finally {
    if (ownsLock) releaseLibraryLock(lock);
  }
}

function restoreBeforeSnapshot(rootDir, txRoot, operation) {
  const target = targetAbsolute(rootDir, operation.target);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (operation.beforeExists && operation.beforePath && fs.existsSync(path.join(txRoot, operation.beforePath))) {
    copyFileSnapshot(path.join(txRoot, operation.beforePath), target);
  } else {
    fs.rmSync(target, { force: true });
  }
}

function rollbackTransaction(txRoot, manifest, rootDir) {
  for (const operation of [...(manifest.operations || [])].reverse()) {
    if (operation.kind === 'rename-file') {
      const source = targetAbsolute(rootDir, operation.source);
      const target = targetAbsolute(rootDir, operation.target);
      if (!exactPathExists(source) && exactPathExists(target)) {
        renameWithCaseWorkaround(target, source);
      }
      if (operation.targetBeforeExists && operation.targetBeforePath && fs.existsSync(path.join(txRoot, operation.targetBeforePath))) {
        copyFileSnapshot(path.join(txRoot, operation.targetBeforePath), target);
      } else if (!operation.targetBeforeExists) {
        fs.rmSync(target, { force: true });
      }
      if (operation.beforeExists && operation.beforePath && fs.existsSync(path.join(txRoot, operation.beforePath))) {
        copyFileSnapshot(path.join(txRoot, operation.beforePath), source);
      }
    } else if (operation.kind === 'replace-file') {
      restoreBeforeSnapshot(rootDir, txRoot, operation);
    } else if (operation.kind === 'delete-file') {
      restoreBeforeSnapshot(rootDir, txRoot, operation);
    }
  }
  manifest.state = 'ROLLED_BACK';
  saveManifest(txRoot, manifest);
}

function operationTargetHash(rootDir, operation) {
  const target = targetAbsolute(rootDir, operation.target);
  return fs.existsSync(target) ? sha256File(target) : null;
}

function resolveOperation(rootDir, txRoot, operation) {
  const targetHash = operationTargetHash(rootDir, operation);
  if (operation.kind === 'replace-file') {
    if (targetHash === operation.afterHash) return true;
    if (targetHash === operation.beforeHash || targetHash === null) {
      if (operation.stagedPath && fs.existsSync(path.join(txRoot, operation.stagedPath))) {
        applyReplaceOperation(rootDir, txRoot, operation);
        return true;
      }
    }
    return false;
  }
  if (operation.kind === 'rename-file') {
    const source = targetAbsolute(rootDir, operation.source);
    const target = targetAbsolute(rootDir, operation.target);
    if (!exactPathExists(source) && exactPathExists(target) && targetHash === operation.afterHash) return true;
    if (exactPathExists(source) && !exactPathExists(target)) {
      applyRenameOperation(rootDir, operation);
      return true;
    }
    return false;
  }
  if (operation.kind === 'delete-file') {
    if (targetHash === null) return true;
    if (targetHash === operation.beforeHash) {
      applyDeleteOperation(rootDir, operation);
      return true;
    }
    return false;
  }
  return false;
}

function verifyCommittedTransaction(rootDir, txRoot, manifest) {
  for (const operation of manifest.operations || []) {
    const targetHash = operationTargetHash(rootDir, operation);
    if (operation.kind === 'delete-file' && targetHash !== null) return false;
    if (operation.kind !== 'delete-file' && targetHash !== operation.afterHash) return false;
  }
  return true;
}

export function commitLibrarySnapshot(library, options = {}) {
  if (!library || !library.rootDir) throw txError('LIBRARY_READ_FAILED', 'Library rootDir is required');
  const rootDir = path.resolve(library.rootDir);
  const beforeGeneration = readGeneration(rootDir);
  const currentGeneration = Number(library.metadata?.generation ?? 0);
  if (beforeGeneration !== currentGeneration && !options.forceGeneration) {
    throw txError('LIBRARY_VERSION_CONFLICT', `Library generation changed from ${currentGeneration} to ${beforeGeneration}`, {
      expected: currentGeneration,
      actual: beforeGeneration,
    });
  }
  library.metadata.generation = currentGeneration + 1;
  const targets = buildLibraryTargets(library);
  const lock = acquireLibraryLock(rootDir, options.lockOptions || {});
  try {
    const prepared = prepareTransaction(library, targets, options.fileOperations || [], lock, { targetGeneration: library.metadata.generation });
    let result;
    try {
      result = commitPreparedTransaction(library, prepared, lock);
    } catch (err) {
      try {
        rollbackTransaction(prepared.txRoot, prepared.manifest, rootDir);
      } catch (rollbackError) {
        // Preserve the original failure; startup recovery can still inspect the journal.
      }
      throw err;
    }
    if (library.searchIndex) {
      library.searchIndex = targets.find((target) => target.relative === 'search-index.json')
        ? JSON.parse(targets.find((target) => target.relative === 'search-index.json').data)
        : library.searchIndex;
    }
    if (library.items) library.itemMap = new Map(library.items.map((item) => [item.id, item]));
    return result;
  } catch (err) {
    library.metadata.generation = beforeGeneration;
    if (err && err.code === 'LIBRARY_VERSION_CONFLICT') throw err;
    throw err;
  } finally {
    releaseLibraryLock(lock);
  }
}

export function recoverLibrary(rootDir, options = {}) {
  const root = path.resolve(rootDir);
  const report = {
    libraryPath: root,
    recovered: 0,
    rolledBack: 0,
    cleaned: 0,
    recoveryRequired: 0,
    errors: [],
  };
  let lock = null;
  try {
    lock = acquireLibraryLock(root, options.lockOptions || {});
  } catch (err) {
    if (err.code !== 'LIBRARY_WRITE_LOCKED') throw err;
    report.errors.push({ code: err.code, message: err.message });
    return report;
  }
  try {
    for (const txRoot of listTransactionDirectories(root)) {
      const manifest = loadManifest(txRoot);
      if (!manifest) {
        report.errors.push({ code: 'TRANSACTION_MANIFEST_INVALID', message: txRoot });
        continue;
      }
      if (manifest.state === 'PREPARED') {
        rollbackTransaction(txRoot, manifest, root);
        fs.rmSync(txRoot, { recursive: true, force: true });
        report.rolledBack += 1;
        report.cleaned += 1;
        continue;
      }
      if (manifest.state === 'COMMITTING') {
        const allResolved = (manifest.operations || []).every((operation) => resolveOperation(root, txRoot, operation));
        if (allResolved && verifyCommittedTransaction(root, txRoot, manifest)) {
          manifest.state = 'COMMITTED';
          saveManifest(txRoot, manifest);
          fs.rmSync(txRoot, { recursive: true, force: true });
          report.recovered += 1;
          report.cleaned += 1;
        } else {
          rollbackTransaction(txRoot, manifest, root);
          fs.rmSync(txRoot, { recursive: true, force: true });
          report.rolledBack += 1;
          report.cleaned += 1;
        }
        continue;
      }
      if (manifest.state === 'COMMITTED') {
        if (verifyCommittedTransaction(root, txRoot, manifest)) {
          fs.rmSync(txRoot, { recursive: true, force: true });
          report.cleaned += 1;
        } else {
          manifest.state = 'RECOVERY_REQUIRED';
          saveManifest(txRoot, manifest);
          report.recoveryRequired += 1;
        }
        continue;
      }
      if (manifest.state === 'ROLLED_BACK') {
        fs.rmSync(txRoot, { recursive: true, force: true });
        report.cleaned += 1;
        continue;
      }
      report.recoveryRequired += 1;
    }
  } finally {
    releaseLibraryLock(lock);
  }
  return report;
}

export class LibraryTransactionCoordinator {
  #queues = new Map();

  run(library, operation = {}) {
    if (!library || !library.rootDir) {
      return Promise.reject(txError('LIBRARY_READ_FAILED', 'Library rootDir is required'));
    }
    const key = normalizedLibraryKey(library.rootDir);
    const previous = this.#queues.get(key) || Promise.resolve();
    const current = previous
      .catch(() => {})
      .then(async () => {
        const lock = acquireLibraryLock(library.rootDir);
        try {
          const mutate = operation.mutate || (() => {});
          await mutate(library, operation);
          const diskGeneration = readGeneration(library.rootDir);
          if (operation.expectedGeneration != null && diskGeneration !== Number(operation.expectedGeneration)) {
            throw txError('LIBRARY_VERSION_CONFLICT', 'Expected library generation does not match disk', {
              expected: operation.expectedGeneration,
              actual: diskGeneration,
            });
          }
          library.metadata.generation = diskGeneration + 1;
          const targets = buildLibraryTargets(library);
          const prepared = prepareTransaction(library, targets, operation.fileOperations || [], lock, { targetGeneration: library.metadata.generation });
          commitPreparedTransaction(library, prepared, lock);
          return { transactionId: prepared.manifest.id, targetGeneration: prepared.targetGeneration };
        } finally {
          releaseLibraryLock(lock);
        }
      });
    this.#queues.set(key, current);
    current.finally(() => {
      if (this.#queues.get(key) === current) this.#queues.delete(key);
    }).catch(() => {});
    return current;
  }

  status(rootDir) {
    const key = normalizedLibraryKey(rootDir);
    return {
      rootDir: path.resolve(rootDir),
      queued: this.#queues.has(key) ? 1 : 0,
    };
  }
}
