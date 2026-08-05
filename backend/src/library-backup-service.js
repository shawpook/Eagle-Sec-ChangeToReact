import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  assertPathInside,
  readGeneration,
  sha256File,
  sha256Text,
  transactionDirectory,
  writeJsonSync,
} from './library-strict.js';

function backupsRoot(rootDir) {
  return path.join(transactionDirectory(rootDir), 'backups');
}

function walkFiles(directory, root, output = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      walkFiles(full, root, output);
    } else if (entry.isFile()) {
      output.push(path.relative(root, full));
    }
  }
  return output;
}

function backupId() {
  return `BP-${Date.now()}-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
}

export function createRecoveryPoint(rootDir, options = {}) {
  const root = path.resolve(rootDir);
  const id = options.id || backupId();
  const target = assertPathInside(backupsRoot(root), path.join(backupsRoot(root), id));
  if (fs.existsSync(target)) throw new Error(`Backup already exists: ${id}`);
  const backupRoot = backupsRoot(root);
  fs.mkdirSync(backupRoot, { recursive: true });
  fs.mkdirSync(target, { recursive: true });

  const skipRelative = (source) => {
    const relative = path.relative(root, source);
    if (!relative) return false;
    if (relative.startsWith(`backup${path.sep}recovery-v1`)) return true;
    const targetRelative = path.relative(root, target);
    return targetRelative && (relative === targetRelative || relative.startsWith(`${targetRelative}${path.sep}`));
  };
  const copyTree = (source) => {
    if (skipRelative(source)) return;
    for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
      const full = path.join(source, entry.name);
      if (skipRelative(full)) continue;
      const relative = path.relative(root, full);
      const destination = path.join(target, relative);
      if (entry.isDirectory()) {
        fs.mkdirSync(destination, { recursive: true });
        copyTree(full);
      } else if (entry.isFile()) {
        fs.mkdirSync(path.dirname(destination), { recursive: true });
        fs.copyFileSync(full, destination);
      }
    }
  };
  copyTree(root);

  const files = walkFiles(target, target);
  const manifest = {
    version: 1,
    id,
    label: options.label || 'manual recovery point',
    createdAt: Date.now(),
    libraryPath: root,
    libraryName: path.basename(root).replace(/\.library$/i, ''),
    generation: readGeneration(root),
    files: files
      .map((relative) => ({
        path: relative.split(path.sep).join('/'),
        sha256: sha256File(path.join(target, relative)),
      }))
      .sort((left, right) => left.path.localeCompare(right.path)),
  };
  manifest.digest = sha256Text(JSON.stringify(manifest.files));
  writeJsonSync(path.join(target, 'recovery-manifest.json'), manifest);
  return manifest;
}

export function listRecoveryPoints(rootDir) {
  const root = backupsRoot(path.resolve(rootDir));
  if (!fs.existsSync(root)) return [];
  const points = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const manifestFile = path.join(root, entry.name, 'recovery-manifest.json');
    if (!fs.existsSync(manifestFile)) continue;
    try {
      points.push(JSON.parse(fs.readFileSync(manifestFile, 'utf8')));
    } catch {
      // Ignore incomplete manifests; verify will report them if explicitly requested.
    }
  }
  return points.sort((left, right) => Number(right.createdAt || 0) - Number(left.createdAt || 0));
}

export function verifyRecoveryPoint(rootDir, id) {
  const root = path.resolve(rootDir);
  const target = assertPathInside(backupsRoot(root), path.join(backupsRoot(root), id));
  const manifestFile = path.join(target, 'recovery-manifest.json');
  if (!fs.existsSync(manifestFile)) throw new Error(`Backup manifest not found: ${id}`);
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  if (manifest.version !== 1 || manifest.id !== id) throw new Error(`Invalid backup manifest: ${id}`);
  const errors = [];
  const verified = [];
  for (const file of manifest.files || []) {
    const absolute = path.join(target, file.path.split('/').join(path.sep));
    if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) {
      errors.push({ path: file.path, error: 'missing' });
      continue;
    }
    const hash = sha256File(absolute);
    if (hash !== file.sha256) errors.push({ path: file.path, error: 'hash mismatch' });
    else verified.push(file.path);
  }
  const currentDigest = sha256Text(JSON.stringify([...(manifest.files || [])].map((file) => ({
    path: file.path,
    sha256: file.sha256,
  })).sort((left, right) => left.path.localeCompare(right.path))));
  if (currentDigest !== manifest.digest) errors.push({ path: 'recovery-manifest.json', error: 'manifest digest mismatch' });
  return {
    id,
    ok: errors.length === 0,
    verifiedCount: verified.length,
    errorCount: errors.length,
    errors,
  };
}

export function restoreRecoveryPoint(rootDir, id, destDir) {
  const verified = verifyRecoveryPoint(rootDir, id);
  if (!verified.ok) throw new Error(`Backup verification failed: ${JSON.stringify(verified)}`);
  const root = path.resolve(rootDir);
  const source = assertPathInside(backupsRoot(root), path.join(backupsRoot(root), id));
  const destination = path.resolve(destDir);
  if (!destination.toLowerCase().endsWith('.library')) throw new Error('Restore destination must end with .library');
  if (fs.existsSync(destination)) throw new Error(`Restore destination already exists: ${destination}`);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.cpSync(source, destination, {
    recursive: true,
    filter: (sourcePath) => path.basename(sourcePath) !== 'recovery-manifest.json',
  });
  return {
    id,
    destination,
    libraryName: path.basename(destination).replace(/\.library$/i, ''),
    verifiedCount: verified.verifiedCount,
  };
}

export function recoveryPointManifest(rootDir, id) {
  const root = path.resolve(rootDir);
  const target = assertPathInside(backupsRoot(root), path.join(backupsRoot(root), id));
  const manifestFile = path.join(target, 'recovery-manifest.json');
  if (!fs.existsSync(manifestFile)) throw new Error(`Backup manifest not found: ${id}`);
  return JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
}
