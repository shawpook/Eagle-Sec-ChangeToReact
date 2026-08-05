// 重复扫描服务：exact 按真实文件 hash 分组，similar 本轮不承诺视觉相似结果。
import crypto from 'node:crypto';
import fs from 'node:fs';
import { itemOriginalPath } from './library-store.js';

function fileHash(file) {
  if (!fs.existsSync(file)) return null;
  return crypto.createHash('sha1').update(fs.readFileSync(file)).digest('hex');
}

function fileHashStream(file) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha1');
    const stream = fs.createReadStream(file);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(hash.digest('hex')));
  });
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
  return 1 - matrix[a.length][b.length] / Math.max(a.length, b.length);
}

function groupId() {
  return crypto.randomUUID();
}

function groupFromItems(items) {
  return {
    id: groupId(),
    key: items.map((item) => item.id).join('|'),
    items,
  };
}

export async function findDuplicatesWithProgress(library, items = library.items, options = {}) {
  const onProgress = typeof options.onProgress === 'function' ? options.onProgress : () => {};
  const isCancelled = typeof options.isCancelled === 'function' ? options.isCancelled : () => false;
  const concurrency = Math.max(1, Number(options.concurrency) || 4);
  const total = items.length;
  let current = 0;
  const errors = [];
  const sizeBuckets = new Map();
  for (const item of items) {
    const size = String(item.size || 0);
    if (!sizeBuckets.has(size)) sizeBuckets.set(size, []);
    sizeBuckets.get(size).push(item);
  }

  const groups = [];
  for (const bucket of sizeBuckets.values()) {
    if (bucket.length < 2) {
      current += bucket.length;
      onProgress(current, total);
      continue;
    }
    const hashBuckets = new Map();
    for (let index = 0; index < bucket.length; index += concurrency) {
      if (isCancelled()) {
        return { cancelled: true, groups: [], errors };
      }
      const chunk = bucket.slice(index, index + concurrency);
      await Promise.all(chunk.map(async (item) => {
        if (isCancelled()) return;
        try {
          const hash = await fileHashStream(itemOriginalPath(library, item));
          const key = hash || `${String(item.name).toLowerCase()}:${item.ext}`;
          if (!hashBuckets.has(key)) hashBuckets.set(key, []);
          hashBuckets.get(key).push(item);
        } catch (err) {
          errors.push({ id: item.id, error: err.message });
        }
        current += 1;
        onProgress(current, total);
      }));
    }
    for (const duplicateItems of hashBuckets.values()) {
      if (duplicateItems.length > 1) groups.push(groupFromItems(duplicateItems));
    }
  }
  return { cancelled: false, groups, errors };
}

export function findDuplicates(library, items = library.items) {
  const sizeBuckets = new Map();
  for (const item of items) {
    const size = String(item.size || 0);
    if (!sizeBuckets.has(size)) sizeBuckets.set(size, []);
    sizeBuckets.get(size).push(item);
  }
  const groups = [];
  for (const bucket of sizeBuckets.values()) {
    if (bucket.length < 2) continue;
    const hashBuckets = new Map();
    for (const item of bucket) {
      const hash = fileHash(itemOriginalPath(library, item));
      const key = hash || `${String(item.name).toLowerCase()}:${item.ext}`;
      if (!hashBuckets.has(key)) hashBuckets.set(key, []);
      hashBuckets.get(key).push(item);
    }
    for (const duplicateItems of hashBuckets.values()) {
      if (duplicateItems.length > 1) groups.push(groupFromItems(duplicateItems));
    }
  }
  return groups;
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
    if (group.length > 1) groups.push(groupFromItems(group));
  }
  return groups;
}
