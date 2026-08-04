import fs from 'node:fs';
import path from 'node:path';
import { loadLibrary, resolveLibraryPath } from './library-store.js';

const INVALID_NAME = /[<>:"/\\|?*\u0000-\u001f]/;
const RESERVED_NAME = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2), 'utf8');
}

function canonicalLibraryPath(input) {
  const resolved = resolveLibraryPath(input);
  return resolved ? path.resolve(resolved) : null;
}

function validateLibraryDirectory(input) {
  const libraryPath = canonicalLibraryPath(input);
  if (!libraryPath) throw new Error('Library path is required');
  if (!libraryPath.toLowerCase().endsWith('.library')) {
    throw new Error('Library path must end with .library');
  }
  if (!fs.existsSync(libraryPath) || !fs.statSync(libraryPath).isDirectory()) {
    throw new Error(`Library not found: ${input}`);
  }
  const metadataFile = path.join(libraryPath, 'metadata.json');
  if (!fs.existsSync(metadataFile) || !fs.statSync(metadataFile).isFile()) {
    throw new Error(`Invalid library, metadata.json is missing: ${libraryPath}`);
  }
  return libraryPath;
}

function normalizeLibraryName(input) {
  const name = String(input || '').trim().replace(/\.library$/i, '');
  if (!name) throw new Error('Library name is required');
  if (name.length > 127) throw new Error('Library name must be 127 characters or fewer');
  if (INVALID_NAME.test(name) || RESERVED_NAME.test(name) || name.endsWith('.') || name.endsWith(' ')) {
    throw new Error('Library name contains unsupported characters');
  }
  return name.normalize('NFC');
}

function initialMetadata() {
  return {
    applicationVersion: '4.0.0',
    folders: [],
    smartFolders: [],
    quickAccess: [],
    tagsGroups: [],
    modificationTime: Date.now(),
  };
}

export function describeLibrary(library, options = {}) {
  const result = {
    path: library.rootDir,
    rootDir: library.rootDir,
    libraryPath: library.rootDir,
    name: library.libraryName,
    libraryName: library.libraryName,
    imagesDir: path.join(library.rootDir, 'images') + path.sep,
    cachePath: path.join(library.rootDir, 'cache.json'),
    imagesStringPath: path.join(library.rootDir, 'cache.json'),
    metadata: library.metadata,
    folders: library.folders,
    smartFolders: library.smartFolders,
    quickAccess: library.quickAccess,
    tagsGroups: library.tagsGroups,
    tags: library.tags,
    savedFilters: library.savedFilters,
    modificationTime: library.metadata.modificationTime || 0,
    itemCount: library.items.length,
  };
  if (options.includeItems) result.items = library.items;
  return result;
}

export class LibraryService {
  constructor(options = {}) {
    this.stateFile = path.resolve(options.stateFile);
    this.defaultLibraryPath = canonicalLibraryPath(options.defaultLibraryPath);
    this.state = this.#readState();
    this.#restoreCurrent();
  }

  #readState() {
    try {
      const parsed = JSON.parse(fs.readFileSync(this.stateFile, 'utf8'));
      return {
        version: 1,
        currentLibraryPath: parsed.currentLibraryPath || '',
        history: Array.isArray(parsed.history) ? parsed.history : [],
      };
    } catch (err) {
      return { version: 1, currentLibraryPath: '', history: [] };
    }
  }

  #saveState() {
    writeJson(this.stateFile, this.state);
  }

  #restoreCurrent() {
    const candidates = [this.state.currentLibraryPath, this.defaultLibraryPath].filter(Boolean);
    let restored = null;
    for (const candidate of candidates) {
      try {
        restored = validateLibraryDirectory(candidate);
        break;
      } catch (err) {
        // Try the next known library.
      }
    }
    if (!restored) throw new Error('No valid library is available');
    this.state.currentLibraryPath = restored;
    this.state.history = this.#normalizeHistory([restored, ...this.state.history]);
    this.#saveState();
  }

  #normalizeHistory(history) {
    const result = [];
    const seen = new Set();
    for (const entry of history || []) {
      try {
        const resolved = validateLibraryDirectory(entry);
        const key = process.platform === 'win32' ? resolved.toLowerCase() : resolved;
        if (!seen.has(key)) {
          seen.add(key);
          result.push(resolved);
        }
      } catch (err) {
        // Missing and invalid libraries are removed from persisted history.
      }
    }
    return result;
  }

  current(options = {}) {
    const library = loadLibrary(validateLibraryDirectory(this.state.currentLibraryPath));
    return describeLibrary(library, options);
  }

  currentLibrary() {
    return loadLibrary(validateLibraryDirectory(this.state.currentLibraryPath));
  }

  history() {
    this.state.history = this.#normalizeHistory(this.state.history);
    this.#saveState();
    return [...this.state.history];
  }

  setHistory(history) {
    const current = validateLibraryDirectory(this.state.currentLibraryPath);
    this.state.history = this.#normalizeHistory([current, ...(history || [])]);
    this.#saveState();
    return [...this.state.history];
  }

  open(libraryPath, options = {}) {
    const resolved = validateLibraryDirectory(libraryPath);
    const library = loadLibrary(resolved);
    if (options.makeCurrent !== false) {
      this.state.currentLibraryPath = resolved;
      this.state.history = this.#normalizeHistory([resolved, ...this.state.history]);
      this.#saveState();
    }
    return library;
  }

  switch(libraryPath) {
    return this.open(libraryPath, { makeCurrent: true });
  }

  create(params = {}) {
    const name = normalizeLibraryName(params.name || params.libraryName);
    const explicitPath = params.libraryPath ? path.resolve(String(params.libraryPath)) : null;
    const parentPath = path.resolve(String(params.parentPath || params.savePath || ''));
    if (!explicitPath && !String(params.parentPath || params.savePath || '').trim()) {
      throw new Error('Library parent path is required');
    }
    const libraryPath = explicitPath || path.join(parentPath, `${name}.library`);
    if (!libraryPath.toLowerCase().endsWith('.library')) {
      throw new Error('Library path must end with .library');
    }
    if (fs.existsSync(libraryPath)) {
      throw new Error(`Library already exists: ${libraryPath}`);
    }
    const parent = path.dirname(libraryPath);
    if (!fs.existsSync(parent) || !fs.statSync(parent).isDirectory()) {
      throw new Error(`Library parent directory not found: ${parent}`);
    }
    fs.accessSync(parent, fs.constants.W_OK);

    const imagesDir = path.join(libraryPath, 'images');
    fs.mkdirSync(imagesDir, { recursive: true });
    writeJson(path.join(libraryPath, 'metadata.json'), initialMetadata());
    writeJson(path.join(libraryPath, 'tags.json'), { historyTags: [], starredTags: [] });
    writeJson(path.join(libraryPath, 'saved-filters.json'), []);
    writeJson(path.join(libraryPath, 'folders.json'), []);
    fs.writeFileSync(path.join(libraryPath, 'cache.json'), '', 'utf8');
    writeJson(path.join(libraryPath, 'search-index.json'), {
      version: 1,
      updatedAt: Date.now(),
      items: [],
    });

    const library = this.open(libraryPath);
    return {
      library,
      createdFiles: [
        'metadata.json',
        'tags.json',
        'saved-filters.json',
        'folders.json',
        'cache.json',
        'search-index.json',
        'images',
      ],
    };
  }
}
