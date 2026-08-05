import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export class LibraryStrictError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'LibraryStrictError';
    this.code = code;
    this.details = details;
  }
}

export function sha256File(file) {
  if (!fs.existsSync(file)) return null;
  const hash = crypto.createHash('sha256');
  const fd = fs.openSync(file, 'r');
  try {
    const buffer = Buffer.alloc(1024 * 1024);
    let bytesRead = 0;
    do {
      bytesRead = fs.readSync(fd, buffer, 0, buffer.length, null);
      if (bytesRead > 0) hash.update(buffer.subarray(0, bytesRead));
    } while (bytesRead > 0);
  } finally {
    fs.closeSync(fd);
  }
  return hash.digest('hex');
}

export function sha256Text(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function copyFileSnapshot(source, target) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

export function relativeLibraryPath(rootDir, target) {
  const resolvedRoot = path.resolve(rootDir);
  const resolvedTarget = path.resolve(target);
  const relative = path.relative(resolvedRoot, resolvedTarget);
  if (relative === '' || relative.startsWith(`..${path.sep}`) || relative === '..' || path.isAbsolute(relative)) {
    throw new LibraryStrictError('PATH_OUTSIDE_LIBRARY', `Path escapes library root: ${target}`, { path: target });
  }
  return relative.split(path.sep).join('/');
}

export function assertPathInside(rootDir, target) {
  const resolvedRoot = path.resolve(rootDir);
  const resolvedTarget = path.resolve(target);
  if (resolvedTarget !== resolvedRoot && !resolvedTarget.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new LibraryStrictError('PATH_OUTSIDE_LIBRARY', `Path escapes library root: ${target}`, { path: target });
  }
  return resolvedTarget;
}

export function readJsonStrict(file, options = {}) {
  const { fallback = undefined, allowMissing = false, schema = null } = options;
  if (!fs.existsSync(file)) {
    if (allowMissing) return fallback;
    throw new LibraryStrictError('LIBRARY_JSON_MISSING', `Missing JSON file: ${file}`, { path: file });
  }
  let value;
  try {
    value = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    throw new LibraryStrictError('LIBRARY_JSON_PARSE_ERROR', `Invalid JSON file: ${file}`, {
      path: file,
      reason: err.message,
    });
  }
  if (schema) {
    const schemaError = schema(value);
    if (schemaError) {
      throw new LibraryStrictError('LIBRARY_JSON_SCHEMA_ERROR', schemaError, { path: file });
    }
  }
  return value;
}

export function readGeneration(rootDir) {
  const metadataFile = path.join(rootDir, 'metadata.json');
  if (!fs.existsSync(metadataFile)) return 0;
  try {
    const metadata = JSON.parse(fs.readFileSync(metadataFile, 'utf8'));
    const value = Number(metadata.generation ?? 0);
    return Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
  } catch {
    return 0;
  }
}

export function transactionDirectory(rootDir) {
  return path.join(rootDir, 'backup', 'recovery-v1');
}

export function listTransactionDirectories(rootDir) {
  const root = path.join(transactionDirectory(rootDir), 'transactions');
  if (!fs.existsSync(root)) return [];
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(root, entry.name))
    .sort();
}

export function writeJsonSync(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2), 'utf8');
}

export function readJsonSync(file, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}
