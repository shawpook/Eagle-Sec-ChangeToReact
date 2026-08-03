import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const libraryDir = path.resolve(here, '../frontend/public/mock-library/Eagle Reverse Demo.library');

const rootMetaFile = path.join(libraryDir, 'metadata.json');
const cacheFile = path.join(libraryDir, 'cache.json');
const tagsFile = path.join(libraryDir, 'tags.json');
const savedFiltersFile = path.join(libraryDir, 'saved-filters.json');

const errors = [];

function requireFile(file) {
  if (!fs.existsSync(file)) errors.push(`missing ${path.relative(process.cwd(), file)}`);
  return file;
}

requireFile(rootMetaFile);
requireFile(tagsFile);
requireFile(savedFiltersFile);

if (!fs.existsSync(cacheFile)) {
  errors.push(`missing ${path.relative(process.cwd(), cacheFile)}`);
  process.exit(1);
}

const items = fs
  .readFileSync(cacheFile, 'utf8')
  .split(/\r?\n/)
  .filter(Boolean)
  .map((line) => JSON.parse(line));

for (const item of items) {
  const dir = path.join(libraryDir, 'images', `${item.id}.info`);
  const metaFile = path.join(dir, 'metadata.json');
  const original = path.join(dir, `${item.name}.${item.ext}`);
  const thumbnail = path.join(dir, `${item.name}_thumbnail.${item.ext}`);
  if (!fs.existsSync(metaFile)) errors.push(`missing ${path.relative(process.cwd(), metaFile)}`);
  if (!fs.existsSync(original)) errors.push(`missing ${path.relative(process.cwd(), original)}`);
  if (!fs.existsSync(thumbnail)) errors.push(`missing ${path.relative(process.cwd(), thumbnail)}`);
  if (fs.existsSync(metaFile)) {
    const meta = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
    if (meta.id !== item.id) errors.push(`metadata id mismatch for ${item.id}`);
    if (meta.name !== item.name) errors.push(`metadata name mismatch for ${item.id}`);
    if (meta.ext !== item.ext) errors.push(`metadata ext mismatch for ${item.id}`);
  }
}

if (errors.length > 0) {
  console.error(errors.join('\n'));
  process.exit(1);
}

console.log(`library validation passed: ${items.length} items`);
