const TEXT_THUMBNAIL_EXTENSIONS = Object.freeze([
  'txt',
  'md',
  'markdown',
  'log',
  'rst',
  'json',
  'xml',
  'yaml',
  'yml',
  'csv',
  'tsv',
]);

const MARKDOWN_EXTENSIONS = new Set(['md', 'markdown']);
const STRUCTURED_TEXT_EXTENSIONS = new Set(['json', 'xml', 'yaml', 'yml']);
const DELIMITED_TEXT_EXTENSIONS = new Set(['csv', 'tsv']);

const TEXT_MIME_TYPES = Object.freeze({
  txt: 'text/plain',
  md: 'text/markdown',
  markdown: 'text/markdown',
  log: 'text/plain',
  rst: 'text/plain',
  json: 'application/json',
  xml: 'application/xml',
  yaml: 'application/yaml',
  yml: 'application/yaml',
  csv: 'text/csv',
  tsv: 'text/tab-separated-values',
});

export function normalizeExtension(extension) {
  return String(extension || '').replace(/^\.+/, '').toLowerCase();
}

export function isTextThumbnailExtension(extension) {
  return TEXT_THUMBNAIL_EXTENSIONS.includes(normalizeExtension(extension));
}

export function isMarkdownExtension(extension) {
  return MARKDOWN_EXTENSIONS.has(normalizeExtension(extension));
}

export function isStructuredTextExtension(extension) {
  return STRUCTURED_TEXT_EXTENSIONS.has(normalizeExtension(extension));
}

export function isDelimitedTextExtension(extension) {
  return DELIMITED_TEXT_EXTENSIONS.has(normalizeExtension(extension));
}

export function resolveTextMimeType(extension) {
  return TEXT_MIME_TYPES[normalizeExtension(extension)] || 'text/plain';
}

export function textThumbnailLabel(extension) {
  const normalized = normalizeExtension(extension);
  return normalized ? normalized.toUpperCase() : 'TEXT';
}

export { TEXT_THUMBNAIL_EXTENSIONS, MARKDOWN_EXTENSIONS, STRUCTURED_TEXT_EXTENSIONS, DELIMITED_TEXT_EXTENSIONS };
