import chokidar from 'chokidar';
import path from 'node:path';

const WATCH_DEBOUNCE_MS = 250;

export class SourceWatcher {
  constructor(db, indexer) {
    this.db = db;
    this.indexer = indexer;
    this.watchers = new Map();
    this.timers = new Map();
  }

  watch(sourceRootId) {
    const row = this.db.db.prepare(`
      SELECT * FROM source_roots WHERE id = ? AND enabled = 1 AND watch = 1 AND available = 1
    `).get(sourceRootId);
    if (!row || this.watchers.has(sourceRootId)) return;
    const rootPath = String(row.path);
    let watcher;
    try {
      watcher = chokidar.watch(rootPath, {
        ignoreInitial: true,
        persistent: true,
        followSymlinks: false,
        ignored: [
          (candidate) => /(?:^|[\\/])\.git(?:[\\/]|$)/i.test(candidate)
            || /(?:^|[\\/])node_modules(?:[\\/]|$)/i.test(candidate)
            || /(?:^|[\\/])\.orcabox-recycle(?:[\\/]|$)/i.test(candidate),
        ],
      });
    } catch (err) {
      console.warn('[source-watch] failed to watch source root:', sourceRootId, err && err.message);
      return;
    }
    const debouncedIndex = (filePath) => {
      const key = `${sourceRootId}:${filePath}`;
      if (this.timers.has(key)) clearTimeout(this.timers.get(key));
      this.timers.set(key, setTimeout(() => {
        this.timers.delete(key);
        try {
          this.indexer.indexFile(filePath, sourceRootId);
        } catch (err) {
          console.warn('[source-watch] index failed:', filePath, err && err.message);
        }
      }, WATCH_DEBOUNCE_MS));
    };
    watcher.on('add', debouncedIndex);
    watcher.on('change', debouncedIndex);
    watcher.on('unlink', (filePath) => {
      const key = `${sourceRootId}:${filePath}`;
      if (this.timers.has(key)) clearTimeout(this.timers.get(key));
      this.timers.delete(key);
      this.indexer.markPathDeleted(sourceRootId, filePath);
    });
    watcher.on('error', (err) => {
      console.warn('[source-watch] watcher error:', sourceRootId, err && err.message);
    });
    this.watchers.set(sourceRootId, watcher);
  }

  unwatch(sourceRootId) {
    const watcher = this.watchers.get(sourceRootId);
    if (watcher) {
      watcher.close().catch(() => {});
      this.watchers.delete(sourceRootId);
    }
    for (const [key, timer] of this.timers) {
      if (key.startsWith(`${sourceRootId}:`)) clearTimeout(timer);
    }
  }

  watchAll() {
    const rows = this.db.db.prepare(`
      SELECT id FROM source_roots WHERE enabled = 1 AND watch = 1 AND available = 1
    `).all();
    for (const row of rows) this.watch(row.id);
  }

  dispose() {
    for (const id of [...this.watchers.keys()]) this.unwatch(id);
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
  }
}
