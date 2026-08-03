import fs from 'node:fs';
import path from 'node:path';

function escapeCell(value) {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

export function itemsToCsv(items) {
  const header = [
    'id',
    'name',
    'ext',
    'width',
    'height',
    'size',
    'url',
    'website',
    'annotation',
    'tags',
    'folders',
    'star',
    'modificationTime',
    'lastModified',
    'isDeleted',
  ];
  const rows = items.map((item) => [
    item.id,
    item.name,
    item.ext,
    item.width,
    item.height,
    item.size,
    item.url,
    item.website,
    item.annotation,
    (item.tags || []).join('|'),
    (item.folders || []).join('|'),
    item.star,
    item.modificationTime,
    item.lastModified,
    item.isDeleted,
  ]);
  return [header, ...rows].map((row) => row.map(escapeCell).join(',')).join('\n');
}

export function exportCsvFile(items, destFile) {
  const csv = itemsToCsv(items);
  fs.mkdirSync(path.dirname(destFile), { recursive: true });
  fs.writeFileSync(destFile, csv, 'utf8');
  return destFile;
}
