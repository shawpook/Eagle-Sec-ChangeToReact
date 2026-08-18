import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

export function sourceModeRoot(libraryRoot) {
  return `${path.resolve(libraryRoot)}.eagle-source`;
}

export class SourceModeDatabase {
  constructor(libraryRoot) {
    this.libraryRoot = path.resolve(libraryRoot);
    this.root = sourceModeRoot(this.libraryRoot);
    this.thumbsPath = path.join(this.root, 'thumbs');
    this.previewsPath = path.join(this.root, 'previews');
    this.stateFile = path.join(this.root, 'mode.json');
    fs.mkdirSync(this.thumbsPath, { recursive: true });
    fs.mkdirSync(this.previewsPath, { recursive: true });
    this.db = new Database(path.join(this.root, 'source.db'));
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.migrate();
  }

  migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS source_roots (
        id TEXT PRIMARY KEY,
        path TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        watch INTEGER NOT NULL DEFAULT 1,
        storage_kind TEXT NOT NULL DEFAULT 'local',
        mount_type TEXT NOT NULL DEFAULT 'local',
        storage_label TEXT,
        available INTEGER NOT NULL DEFAULT 1,
        unavailable_since TEXT,
        asset_count INTEGER NOT NULL DEFAULT 0,
        missing_count INTEGER NOT NULL DEFAULT 0,
        size_bytes INTEGER NOT NULL DEFAULT 0,
        last_scanned_at TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS source_assets (
        id TEXT PRIMARY KEY,
        source_root_id TEXT NOT NULL REFERENCES source_roots(id) ON DELETE CASCADE,
        relative_path TEXT NOT NULL,
        absolute_path TEXT NOT NULL,
        kind TEXT NOT NULL,
        ext TEXT NOT NULL,
        name TEXT NOT NULL,
        size_bytes INTEGER NOT NULL,
        mtime_ms INTEGER NOT NULL,
        fingerprint TEXT NOT NULL,
        width INTEGER,
        height INTEGER,
        duration_ms REAL,
        missing INTEGER NOT NULL DEFAULT 0,
        imported_at TEXT NOT NULL,
        modified_at TEXT NOT NULL,
        UNIQUE(source_root_id, relative_path)
      );

      CREATE TABLE IF NOT EXISTS source_directories (
        id TEXT PRIMARY KEY,
        source_root_id TEXT NOT NULL REFERENCES source_roots(id) ON DELETE CASCADE,
        relative_path TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE(source_root_id, relative_path)
      );

      CREATE TABLE IF NOT EXISTS source_exclusions (
        id TEXT PRIMARY KEY,
        source_root_id TEXT NOT NULL REFERENCES source_roots(id) ON DELETE CASCADE,
        relative_path TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE(source_root_id, relative_path)
      );

      CREATE INDEX IF NOT EXISTS idx_source_assets_root_path
        ON source_assets(source_root_id, relative_path);
      CREATE INDEX IF NOT EXISTS idx_source_assets_missing
        ON source_assets(missing);
      CREATE INDEX IF NOT EXISTS idx_source_directories_root
        ON source_directories(source_root_id, relative_path);
    `);
  }

  readState() {
    try {
      const parsed = JSON.parse(fs.readFileSync(this.stateFile, 'utf8'));
      return {
        mode: parsed.mode === 'source' ? 'source' : 'library',
        selectedSourceRootId: parsed.selectedSourceRootId || '',
        selectedRelativePath: parsed.selectedRelativePath || '',
        updatedAt: parsed.updatedAt || 0,
      };
    } catch (err) {
      return {
        mode: 'library',
        selectedSourceRootId: '',
        selectedRelativePath: '',
        updatedAt: 0,
      };
    }
  }

  writeState(state) {
    fs.writeFileSync(this.stateFile, JSON.stringify({
      ...state,
      libraryPath: this.libraryRoot,
      updatedAt: Date.now(),
    }, null, 2), 'utf8');
  }

  dispose() {
    try {
      this.db.close();
    } catch (err) {
      // Closing an already-closed database is harmless.
    }
  }
}
