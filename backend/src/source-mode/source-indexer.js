import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import fg from 'fast-glob';

const IMAGE_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'tif', 'tiff', 'heic', 'heif', 'avif', 'raw', 'cr2', 'nef', 'arw',
]);
const VIDEO_EXTENSIONS = new Set(['mp4', 'webm', 'mov', 'mkv', 'avi', 'm4v']);
const AUDIO_EXTENSIONS = new Set(['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'wma']);
const FONT_EXTENSIONS = new Set(['ttf', 'otf', 'woff', 'woff2']);
const MODEL_EXTENSIONS = new Set(['obj', 'glb', 'gltf', 'stl', 'ply', 'fbx', '3ds', 'dae']);
const TEXT_EXTENSIONS = new Set(['txt', 'md', 'markdown', 'json', 'xml', 'yaml', 'yml', 'csv', 'tsv', 'log', 'rst', 'rtf']);
const DOCUMENT_EXTENSIONS = new Set(['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp']);
const ARCHIVE_EXTENSIONS = new Set(['zip', 'rar', '7z', 'tar', 'gz', 'eaglepack']);

const SOURCE_IGNORE_PATTERNS = [
  '**/.git/**',
  '**/node_modules/**',
  '**/.orcabox-recycle/**',
  '**/*.library/**',
];

function normalizeExtension(extension) {
  return String(extension || '').replace(/^\.+/, '').toLowerCase();
}

export function classifySourceKind(extension) {
  const ext = normalizeExtension(extension);
  if (IMAGE_EXTENSIONS.has(ext)) return 'image';
  if (VIDEO_EXTENSIONS.has(ext)) return 'video';
  if (AUDIO_EXTENSIONS.has(ext)) return 'audio';
  if (FONT_EXTENSIONS.has(ext)) return 'font';
  if (MODEL_EXTENSIONS.has(ext)) return 'model';
  if (TEXT_EXTENSIONS.has(ext)) return 'text';
  if (DOCUMENT_EXTENSIONS.has(ext)) return 'document';
  if (ARCHIVE_EXTENSIONS.has(ext)) return 'archive';
  return 'other';
}

export function isSupportedSourceExtension(extension) {
  return classifySourceKind(extension) !== 'other';
}

function createId() {
  return crypto.randomUUID();
}

function nowIso() {
  return new Date().toISOString();
}

function normalizePath(input) {
  return path.resolve(String(input || ''));
}

function sourceRootById(db, id) {
  return db.prepare('SELECT * FROM source_roots WHERE id = ?').get(id);
}

function sourceRootByPath(db, rootPath) {
  return db.prepare('SELECT * FROM source_roots WHERE path = ?').get(rootPath);
}

export function mapSourceRootRow(db, row) {
  if (!row) return null;
  const assetCount = Number(row.asset_count || 0);
  const missingCount = Number(row.missing_count || 0);
  const directories = db.prepare(`
    SELECT relative_path, created_at
    FROM source_directories
    WHERE source_root_id = ?
    ORDER BY relative_path
  `).all(row.id).map((dir) => ({
    relativePath: dir.relative_path,
    createdAt: dir.created_at,
  }));
  return {
    id: String(row.id),
    path: String(row.path),
    name: String(row.name),
    enabled: Number(row.enabled) === 1,
    watch: Number(row.watch) === 1,
    storageKind: row.storage_kind === 'network' ? 'network' : 'local',
    mountType: row.mount_type || 'local',
    storageLabel: row.storage_label || null,
    available: row.available === undefined ? true : Number(row.available) === 1,
    unavailableSince: row.unavailable_since || null,
    assetCount,
    missingCount,
    sizeBytes: Number(row.size_bytes || 0),
    lastScannedAt: row.last_scanned_at || null,
    createdAt: String(row.created_at),
    directories,
  };
}

export class SourceIndexer {
  constructor(db, options = {}) {
    this.db = db;
    this.onActivity = options.onActivity || (() => {});
  }

  addSourceRoot(dirPath, requestedId) {
    const normalized = normalizePath(dirPath);
    if (!fs.existsSync(normalized) || !fs.statSync(normalized).isDirectory()) {
      throw new Error(`Source folder not found: ${dirPath}`);
    }
    const existing = sourceRootByPath(this.db.db, normalized);
    if (existing) {
      return mapSourceRootRow(this.db.db, existing);
    }
    const id = requestedId || createId();
    const createdAt = nowIso();
    this.db.db.prepare(`
      INSERT INTO source_roots (
        id, path, name, enabled, watch, storage_kind, mount_type, storage_label,
        available, unavailable_since, asset_count, missing_count, last_scanned_at, created_at
      )
      VALUES (?, ?, ?, 1, 1, 'local', 'local', NULL, 1, NULL, 0, 0, NULL, ?)
    `).run(id, normalized, path.basename(normalized) || normalized, createdAt);
    this.emitActivity('source-root-added', { id, path: normalized });
    return mapSourceRootRow(this.db.db, sourceRootById(this.db.db, id));
  }

  listSourceRoots() {
    const rows = this.db.db.prepare('SELECT * FROM source_roots ORDER BY created_at').all();
    return rows.map((row) => mapSourceRootRow(this.db.db, row));
  }

  getSourceRoot(id) {
    return mapSourceRootRow(this.db.db, sourceRootById(this.db.db, id));
  }

  removeSourceRoot(id) {
    const removed = this.db.db.prepare('DELETE FROM source_roots WHERE id = ?').run(id);
    if (removed.changes > 0) {
      this.emitActivity('source-root-removed', { id });
    }
    return removed.changes > 0;
  }

  async scanRoot(id, relativePath = null) {
    const root = sourceRootById(this.db.db, id);
    if (!root) throw new Error(`Source root not found: ${id}`);
    const rootPath = String(root.path);
    const cwd = relativePath && relativePath !== '.'
      ? path.join(rootPath, relativePath)
      : rootPath;
    const entries = await fg(['**/*'], {
      cwd,
      absolute: true,
      onlyFiles: true,
      followSymbolicLinks: false,
      suppressErrors: true,
      ignore: SOURCE_IGNORE_PATTERNS,
      dot: false,
    });
    const seen = new Set();
    const upsert = this.db.db.prepare(`
      INSERT INTO source_assets (
        id, source_root_id, relative_path, absolute_path, kind, ext, name,
        size_bytes, mtime_ms, fingerprint, width, height, duration_ms,
        missing, imported_at, modified_at
      )
      VALUES (@id, @sourceRootId, @relativePath, @absolutePath, @kind, @ext, @name,
        @sizeBytes, @mtimeMs, @fingerprint, @width, @height, @durationMs,
        0, @importedAt, @modifiedAt)
      ON CONFLICT(source_root_id, relative_path) DO UPDATE SET
        absolute_path = excluded.absolute_path,
        kind = excluded.kind,
        ext = excluded.ext,
        name = excluded.name,
        size_bytes = excluded.size_bytes,
        mtime_ms = excluded.mtime_ms,
        fingerprint = excluded.fingerprint,
        width = excluded.width,
        height = excluded.height,
        duration_ms = excluded.duration_ms,
        missing = 0,
        modified_at = excluded.modified_at
    `);
    const insertDirectory = this.db.db.prepare(`
      INSERT OR IGNORE INTO source_directories (id, source_root_id, relative_path, created_at)
      VALUES (?, ?, ?, ?)
    `);
    const touchedDirectories = new Set();

    for (let index = 0; index < entries.length; index += 120) {
      const batch = entries.slice(index, index + 120);
      for (const absolutePath of batch) {
        let stat;
        try {
          stat = fs.statSync(absolutePath);
        } catch (err) {
          continue;
        }
        if (!stat.isFile()) continue;
        const relativePathFromRoot = path.relative(rootPath, absolutePath).split(path.sep).join('/');
        if (!relativePathFromRoot || relativePathFromRoot.startsWith('..') || path.isAbsolute(relativePathFromRoot)) {
          continue;
        }
        const ext = normalizeExtension(path.extname(absolutePath));
        if (!isSupportedSourceExtension(ext)) continue;
        seen.add(relativePathFromRoot);
        const dirname = path.posix.dirname(relativePathFromRoot);
        if (dirname && dirname !== '.') {
          touchedDirectories.add(dirname);
          insertDirectory.run(createId(), id, dirname, nowIso());
        }
        const sizeBytes = stat.size;
        const mtimeMs = Math.floor(stat.mtimeMs);
        const fingerprint = `${normalizePath(absolutePath)}:${sizeBytes}:${mtimeMs}`;
        const parsed = path.parse(absolutePath);
        upsert.run({
          id: createId(),
          sourceRootId: id,
          relativePath: relativePathFromRoot,
          absolutePath: normalizePath(absolutePath),
          kind: classifySourceKind(ext),
          ext,
          name: parsed.name,
          sizeBytes,
          mtimeMs,
          fingerprint,
          width: null,
          height: null,
          durationMs: null,
          importedAt: nowIso(),
          modifiedAt: nowIso(),
        });
      }
      this.emitActivity('source-root-scan-progress', {
        id,
        processed: Math.min(index + batch.length, entries.length),
        total: entries.length,
      });
    }

    if (!relativePath || relativePath === '.') {
      const markMissing = this.db.db.prepare(`
        UPDATE source_assets SET missing = 1
        WHERE source_root_id = ? AND missing = 0 AND relative_path NOT IN (SELECT value FROM json_each(?))
      `);
      markMissing.run(id, JSON.stringify([...seen]));
    }

    this.db.db.prepare(`
      UPDATE source_roots SET last_scanned_at = ?, available = 1
      WHERE id = ?
    `).run(nowIso(), id);
    this.updateRootStats(id);
    this.emitActivity('source-root-scan-complete', { id, files: seen.size });
    return { id, files: seen.size, scannedAt: nowIso() };
  }

  indexFile(filePath, sourceRootId) {
    const root = sourceRootById(this.db.db, sourceRootId);
    if (!root) return null;
    const absolutePath = normalizePath(filePath);
    const rootPath = normalizePath(root.path);
    const relativePath = path.relative(rootPath, absolutePath).split(path.sep).join('/');
    if (!relativePath || relativePath.startsWith('..') || path.isAbsolute(relativePath)) return null;
    let stat;
    try {
      stat = fs.statSync(absolutePath);
    } catch (err) {
      return null;
    }
    const ext = normalizeExtension(path.extname(absolutePath));
    if (!stat.isFile() || !isSupportedSourceExtension(ext)) return null;
    const dirname = path.posix.dirname(relativePath);
    if (dirname && dirname !== '.') {
      this.db.db.prepare(`
        INSERT OR IGNORE INTO source_directories (id, source_root_id, relative_path, created_at)
        VALUES (?, ?, ?, ?)
      `).run(createId(), sourceRootId, dirname, nowIso());
    }
    const sizeBytes = stat.size;
    const mtimeMs = Math.floor(stat.mtimeMs);
    const existing = this.db.db.prepare(`
      SELECT id FROM source_assets WHERE source_root_id = ? AND relative_path = ?
    `).get(sourceRootId, relativePath);
    const id = existing ? existing.id : createId();
    this.db.db.prepare(`
      INSERT INTO source_assets (
        id, source_root_id, relative_path, absolute_path, kind, ext, name,
        size_bytes, mtime_ms, fingerprint, missing, imported_at, modified_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
      ON CONFLICT(source_root_id, relative_path) DO UPDATE SET
        absolute_path = excluded.absolute_path,
        kind = excluded.kind,
        ext = excluded.ext,
        name = excluded.name,
        size_bytes = excluded.size_bytes,
        mtime_ms = excluded.mtime_ms,
        fingerprint = excluded.fingerprint,
        missing = 0,
        modified_at = excluded.modified_at
    `).run(
      id,
      sourceRootId,
      relativePath,
      absolutePath,
      classifySourceKind(ext),
      ext,
      path.parse(absolutePath).name,
      sizeBytes,
      mtimeMs,
      `${absolutePath}:${sizeBytes}:${mtimeMs}`,
      nowIso(),
      nowIso(),
    );
    this.updateRootStats(sourceRootId);
    this.emitActivity('source-asset-indexed', { sourceRootId, relativePath });
    return this.getAssetById(id);
  }

  markPathDeleted(sourceRootId, filePath) {
    const root = sourceRootById(this.db.db, sourceRootId);
    if (!root) return false;
    const relativePath = path.relative(normalizePath(root.path), normalizePath(filePath)).split(path.sep).join('/');
    if (!relativePath || relativePath.startsWith('..') || path.isAbsolute(relativePath)) return false;
    const result = this.db.db.prepare(`
      UPDATE source_assets SET missing = 1
      WHERE source_root_id = ? AND relative_path = ?
    `).run(sourceRootId, relativePath);
    this.updateRootStats(sourceRootId);
    this.emitActivity('source-asset-deleted', { sourceRootId, relativePath });
    return result.changes > 0;
  }

  updateRootStats(sourceRootId) {
    const row = this.db.db.prepare(`
      SELECT
        COUNT(*) AS asset_count,
        COALESCE(SUM(CASE WHEN missing = 1 THEN 1 ELSE 0 END), 0) AS missing_count,
        COALESCE(SUM(CASE WHEN missing = 1 THEN 0 ELSE size_bytes END), 0) AS size_bytes
      FROM source_assets
      WHERE source_root_id = ?
    `).get(sourceRootId);
    this.db.db.prepare(`
      UPDATE source_roots SET asset_count = ?, missing_count = ?, size_bytes = ?
      WHERE id = ?
    `).run(row.asset_count, row.missing_count, row.size_bytes, sourceRootId);
  }

  getAssetById(id) {
    const row = this.db.db.prepare('SELECT * FROM source_assets WHERE id = ?').get(id);
    return row ? mapAssetRow(row) : null;
  }

  listAssets(options = {}) {
    const sourceRootId = options.sourceRootId;
    const relativePath = options.relativePath || null;
    const limit = Math.min(Number(options.limit) || 200, 500);
    const offset = Math.max(Number(options.offset) || 0, 0);
    const all = this.db.db.prepare(`
      SELECT * FROM source_assets
      WHERE source_root_id = ?
      ORDER BY name COLLATE NOCASE
    `).all(sourceRootId);
    const target = relativePath && relativePath !== '.'
      ? relativePath.replace(/[\\/]+$/, '')
      : '.';
    const search = options.search ? String(options.search).toLowerCase() : '';
    const filtered = all.filter((row) => {
      const dirname = path.posix.dirname(String(row.relative_path));
      if (dirname !== target) return false;
      if (!search) return true;
      return String(row.name).toLowerCase().includes(search)
        || String(row.relative_path).toLowerCase().includes(search);
    });
    const rows = filtered.slice(offset, offset + limit);
    return { items: rows.map(mapAssetRow), total: filtered.length, offset, limit };
  }

  listAllAssets(sourceRootId) {
    const rows = this.db.db.prepare(`
      SELECT * FROM source_assets
      WHERE source_root_id = ? AND missing = 0
      ORDER BY name COLLATE NOCASE
    `).all(sourceRootId);
    return rows.map(mapAssetRow);
  }

  buildTree() {
    const rows = this.db.db.prepare(`
      SELECT source_root_id, relative_path, size_bytes, missing
      FROM source_assets
      ORDER BY source_root_id, relative_path
    `).all();
    const byRoot = new Map();
    for (const row of rows) {
      const rootId = String(row.source_root_id);
      if (!byRoot.has(rootId)) byRoot.set(rootId, new Map());
      byRoot.get(rootId).set(String(row.relative_path), row);
    }
    const roots = this.listSourceRoots();
    return roots.map((root) => ({
      ...root,
      directories: buildDirectoryTree(root, byRoot.get(root.id) || new Map()),
    }));
  }

  emitActivity(type, data = {}) {
    this.onActivity({ type, ...data, at: nowIso() });
  }
}

function mapAssetRow(row) {
  return {
    id: String(row.id),
    sourceRootId: String(row.source_root_id),
    relativePath: String(row.relative_path),
    absolutePath: String(row.absolute_path),
    kind: String(row.kind),
    ext: String(row.ext),
    name: String(row.name),
    sizeBytes: Number(row.size_bytes),
    mtimeMs: Number(row.mtime_ms),
    fingerprint: String(row.fingerprint),
    width: row.width == null ? null : Number(row.width),
    height: row.height == null ? null : Number(row.height),
    durationMs: row.duration_ms == null ? null : Number(row.duration_ms),
    missing: Number(row.missing) === 1,
    importedAt: String(row.imported_at),
    modifiedAt: String(row.modified_at),
  };
}

function buildDirectoryTree(root, rows) {
  const nodes = new Map();
  const tree = [];
  const ensureNode = (relativePath) => {
    if (nodes.has(relativePath)) return nodes.get(relativePath);
    const segments = relativePath.split('/');
    const name = segments[segments.length - 1];
    const parentPath = segments.slice(0, -1).join('/');
    const node = {
      name,
      relativePath,
      directAssetCount: 0,
      assetCount: 0,
      sizeBytes: 0,
      missingCount: 0,
      children: [],
      childrenMap: new Map(),
    };
    nodes.set(relativePath, node);
    if (parentPath) {
      const parent = ensureNode(parentPath);
      parent.childrenMap.set(name, node);
      parent.children.push(node);
    } else {
      tree.push(node);
    }
    return node;
  };
  for (const [relativePath, row] of rows) {
    const dirname = path.posix.dirname(relativePath);
    if (!dirname || dirname === '.') continue;
    const node = ensureNode(dirname);
    node.directAssetCount += 1;
    if (Number(row.missing) === 1) node.missingCount += 1;
    node.sizeBytes += Number(row.size_bytes || 0);
  }
  const propagate = (node) => {
    let count = node.directAssetCount;
    let missing = node.missingCount;
    let size = node.sizeBytes;
    for (const child of node.children) {
      propagate(child);
      count += child.assetCount;
      missing += child.missingCount;
      size += child.sizeBytes;
    }
    node.assetCount = count;
    node.missingCount = missing;
    node.sizeBytes = size;
    delete node.childrenMap;
  };
  tree.forEach(propagate);
  return tree;
}
