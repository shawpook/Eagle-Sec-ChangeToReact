import crypto from 'node:crypto';
import fs from 'node:fs';
import { itemOriginalPath } from './library-store.js';

function fileHash(file) {
  if (!fs.existsSync(file)) return null;
  return crypto.createHash('sha1').update(fs.readFileSync(file)).digest('hex');
}

function normalizeName(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/gi, ' ')
    .trim();
}

function nameSimilarity(left, right) {
  const a = normalizeName(left);
  const b = normalizeName(right);
  if (!a || !b) return 0;
  if (a === b || a.includes(b) || b.includes(a)) return 1;
  const matrix = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i += 1) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost);
    }
  }
  const distance = matrix[a.length][b.length];
  return 1 - distance / Math.max(a.length, b.length);
}

export function findDuplicates(library, items = library.items) {
  const buckets = new Map();
  for (const item of items) {
    const file = itemOriginalPath(library, item);
    const hash = fileHash(file);
    const key = hash ? `${item.size}:${hash}` : `${String(item.name).toLowerCase()}:${item.ext}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(item);
  }
  return Array.from(buckets.values())
    .filter((group) => group.length > 1)
    .map((group) => ({
      key: `${group[0].size}:${fileHash(itemOriginalPath(library, group[0])) || `${group[0].name}:${group[0].ext}`}`,
      items: group.map((item) => ({ id: item.id, name: item.name, ext: item.ext, size: item.size })),
    }));
}

export function findSimilarDuplicates(library, items = library.items, threshold = 0.55) {
  const candidates = items.filter((item) => !item.isDeleted);
  const groups = [];
  const seen = new Set();
  for (let i = 0; i < candidates.length; i += 1) {
    if (seen.has(i)) continue;
    const group = [candidates[i]];
    seen.add(i);
    for (let j = i + 1; j < candidates.length; j += 1) {
      if (seen.has(j)) continue;
      const left = candidates[i];
      const right = candidates[j];
      const sameSize = Number(left.size) === Number(right.size);
      const sameExt = String(left.ext || '').toLowerCase() === String(right.ext || '').toLowerCase();
      if (sameSize && sameExt && nameSimilarity(left.name, right.name) >= threshold) {
        group.push(right);
        seen.add(j);
      }
    }
    if (group.length > 1) {
      groups.push({
        key: `${group[0].size}:similar:${group.map((item) => item.id).join('|')}`,
        items: group.map((item) => ({ id: item.id, name: item.name, ext: item.ext, size: item.size })),
      });
    }
  }
  return groups;
}
