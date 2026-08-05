import path from 'node:path';
import sharp from 'sharp';
import { readTextSnippet } from './text-document-support.js';
import {
  isDelimitedTextExtension,
  isMarkdownExtension,
  isStructuredTextExtension,
  normalizeExtension,
  resolveTextMimeType,
  textThumbnailLabel,
} from './file-format-policy.js';

const THUMBNAIL_EDGE = 512;
const MAX_PREVIEW_LINES = 11;
const MAX_PREVIEW_CHARS = 2400;
const MAX_LINE_CHARS = 96;
const NEUTRAL_TEXT_PALETTES = Object.freeze([{ color: [248, 250, 252], ratio: 100 }]);
const TEXT_FONT = "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const MONO_FONT = "'SFMono-Regular', ui-monospace, Menlo, Consolas, monospace";

export class TextThumbnailError extends Error {
  constructor(message, options = {}) {
    super(message, options);
    this.name = 'TextThumbnailError';
    this.code = options.code || 'TEXT_THUMBNAIL_RENDER_FAILED';
    this.statusCode = options.statusCode || 422;
  }
}

function safeText(value) {
  return String(value || '')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function trimForThumbnail(value) {
  return safeText(value).slice(0, MAX_LINE_CHARS);
}

function visualLength(text) {
  let total = 0;
  for (const char of text) {
    total += /[\u2e80-\u9fff\uff00-\uffef]/.test(char) ? 2 : 1;
  }
  return total;
}

function escapeSvgText(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function trimLabel(value, maxLength = 30) {
  const text = safeText(value);
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 3))}...`;
}

function wrapForLine(text, maxChars) {
  if (visualLength(text) <= maxChars) return [text];

  const segments = [];
  let current = '';
  for (const char of text) {
    if (visualLength(current + char) > maxChars) {
      if (current) segments.push(current);
      current = char;
      if (segments.length >= 2) break;
      continue;
    }
    current += char;
  }
  if (current && segments.length < 2) segments.push(current);
  if (segments.length === 0 && text) segments.push(text.slice(0, maxChars));
  return segments.map((segment, index) => (index === segments.length - 1 ? `${segment}...` : segment));
}

function extractMarkdownPreviewLines(source) {
  const lines = [];
  let inCodeFence = false;

  for (const rawLine of source.split('\n')) {
    if (lines.length >= MAX_PREVIEW_LINES) break;
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith('```')) {
      inCodeFence = !inCodeFence;
      if (lines.length === 0) lines.push({ kind: 'code', text: 'code snippet' });
      continue;
    }

    if (inCodeFence) {
      lines.push({ kind: 'code', text: trimForThumbnail(trimmed.replace(/^`+|`+$/g, '')) });
      continue;
    }

    const heading = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      const depth = Math.min(3, heading[1].length);
      lines.push({
        kind: depth === 1 ? 'heading1' : depth === 2 ? 'heading2' : 'heading3',
        text: trimForThumbnail(heading[2]),
      });
      continue;
    }

    const quote = trimmed.match(/^>\s?(.*)$/);
    if (quote) {
      lines.push({ kind: 'quote', text: trimForThumbnail(quote[1]) });
      continue;
    }

    const task = trimmed.match(/^[-*+]\s+\[( |x|X)\]\s+(.*)$/);
    if (task) {
      lines.push({
        kind: 'task',
        text: trimForThumbnail(task[2]),
        checked: task[1].toLowerCase() === 'x',
      });
      continue;
    }

    const bullet = trimmed.match(/^([-*+]|\d+\.)\s+(.*)$/);
    if (bullet) {
      lines.push({ kind: 'bullet', text: trimForThumbnail(bullet[2]) });
      continue;
    }

    if (trimmed.includes('|') && trimmed.split('|').filter((segment) => segment.trim()).length >= 2) {
      const cells = trimmed
        .replace(/^\|/, '')
        .replace(/\|$/, '')
        .split('|')
        .map((segment) => trimForThumbnail(segment))
        .filter(Boolean);
      lines.push({ kind: 'table', text: cells.slice(0, 5).join(' | ') });
      continue;
    }

    if (trimmed.startsWith('---') || trimmed.startsWith('***') || trimmed.startsWith('___')) continue;
    lines.push({ kind: 'text', text: trimForThumbnail(trimmed) });
  }

  return lines;
}

function extractCodePreviewLines(source) {
  const lines = [];
  for (const rawLine of source.split('\n')) {
    if (lines.length >= MAX_PREVIEW_LINES) break;
    const trimmed = rawLine.trim();
    if (!trimmed) continue;
    lines.push({ kind: 'code', text: trimForThumbnail(trimmed) });
  }
  return lines;
}

function extractPlainPreviewLines(source) {
  const lines = [];
  for (const rawLine of source.split('\n')) {
    if (lines.length >= MAX_PREVIEW_LINES) break;
    const trimmed = rawLine.trim();
    if (!trimmed) continue;
    lines.push({ kind: 'text', text: trimForThumbnail(trimmed) });
  }
  return lines;
}

function extractDelimitedPreviewLines(source, extension) {
  const delimiter = extension === 'tsv' ? '\t' : ',';
  const lines = [];
  for (const rawLine of source.split('\n')) {
    if (lines.length >= MAX_PREVIEW_LINES) break;
    const trimmed = rawLine.trim();
    if (!trimmed) continue;
    const cells = trimmed.split(delimiter).map((cell) => trimForThumbnail(cell)).filter((cell) => cell.length > 0);
    lines.push({ kind: 'table', text: cells.slice(0, 5).join(' | ') });
  }
  return lines;
}

export function extractTextPreviewLines(content, extension) {
  const source = String(content || '').replace(/\r\n?/g, '\n').slice(0, MAX_PREVIEW_CHARS);
  const normalizedExtension = normalizeExtension(extension);
  const lines = isMarkdownExtension(normalizedExtension)
    ? extractMarkdownPreviewLines(source)
    : isDelimitedTextExtension(normalizedExtension)
      ? extractDelimitedPreviewLines(source, normalizedExtension)
      : isStructuredTextExtension(normalizedExtension)
        ? extractCodePreviewLines(source)
        : extractPlainPreviewLines(source);

  if (lines.length > 0) return lines;
  return [
    { kind: 'heading2', text: 'Empty text file' },
    { kind: 'text', text: 'No readable content was found.' },
  ];
}

function getLineTemplate(kind) {
  switch (kind) {
    case 'heading1':
      return { kind, x: 84, fontSize: 25, fill: '#0F172A', fontWeight: 780, maxChars: 18, lineHeight: 32 };
    case 'heading2':
      return { kind, x: 84, fontSize: 21, fill: '#1E3A5F', fontWeight: 720, maxChars: 22, lineHeight: 28 };
    case 'heading3':
      return { kind, x: 84, fontSize: 18, fill: '#334155', fontWeight: 680, maxChars: 28, lineHeight: 25 };
    case 'quote':
      return { kind, x: 96, fontSize: 15, fill: '#64748B', fontWeight: 560, maxChars: 30, lineHeight: 22, borderFill: '#0EA5E9' };
    case 'bullet':
      return { kind, x: 100, fontSize: 15, fill: '#334155', fontWeight: 560, maxChars: 28, lineHeight: 22 };
    case 'task':
      return { kind, x: 108, fontSize: 15, fill: '#334155', fontWeight: 560, maxChars: 27, lineHeight: 22 };
    case 'code':
      return {
        kind,
        x: 88,
        fontSize: 13,
        fill: '#0F766E',
        fontWeight: 560,
        fontFamily: MONO_FONT,
        maxChars: 32,
        lineHeight: 23,
        backgroundFill: '#F1F5F9',
      };
    case 'table':
      return {
        kind,
        x: 88,
        fontSize: 13,
        fill: '#334155',
        fontWeight: 560,
        fontFamily: MONO_FONT,
        maxChars: 32,
        lineHeight: 23,
        backgroundFill: '#F8FAFC',
      };
    case 'text':
    default:
      return { kind: 'text', x: 84, fontSize: 15, fill: '#475569', fontWeight: 520, maxChars: 32, lineHeight: 22 };
  }
}

function layoutRenderLines(lines) {
  const result = [];
  let y = 130;
  for (const line of lines) {
    const template = getLineTemplate(line.kind);
    const segments = wrapForLine(line.text, template.maxChars);
    for (const segment of segments) {
      if (y > 350) return result;
      result.push({
        ...template,
        checked: line.checked,
        text: segment,
        y,
      });
      y += template.lineHeight;
    }
    y += ['heading1', 'heading2'].includes(template.kind) ? 4 : 0;
  }
  return result;
}

function estimateLineWidth(text, fontSize) {
  return visualLength(text) * (fontSize * 0.54);
}

export function buildTextThumbnailSvg({ assetName, extension, content, truncated = false }) {
  const lines = extractTextPreviewLines(content, extension);
  const renderLines = layoutRenderLines(lines);
  const title = escapeSvgText(trimLabel(assetName || 'Untitled'));
  const formatLabel = escapeSvgText(textThumbnailLabel(extension));
  const mimeType = escapeSvgText(resolveTextMimeType(extension));
  const previewLabel = truncated ? 'Snippet preview (truncated)' : 'Snippet preview';

  const svg = [`<svg xmlns="http://www.w3.org/2000/svg" width="${THUMBNAIL_EDGE}" height="${THUMBNAIL_EDGE}" viewBox="0 0 ${THUMBNAIL_EDGE} ${THUMBNAIL_EDGE}">`];
  svg.push('<rect width="512" height="512" fill="#F1F5F9"/>');
  svg.push('<rect x="32" y="32" width="448" height="448" rx="24" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="1.5"/>');
  svg.push('<rect x="52" y="52" width="408" height="40" rx="12" fill="#F0F9FF" stroke="#BAE6FD"/>');
  svg.push(`<text x="68" y="79" fill="#0369A1" font-size="14" font-family="${TEXT_FONT}" font-weight="760">${formatLabel}</text>`);
  svg.push(`<text x="420" y="79" text-anchor="end" fill="#94A3B8" font-size="12" font-family="${TEXT_FONT}" font-weight="560">${mimeType}</text>`);
  svg.push(`<text x="52" y="120" fill="#64748B" font-size="12" font-family="${TEXT_FONT}" font-weight="600">${previewLabel}</text>`);

  for (const line of renderLines) {
    if (line.backgroundFill) {
      const boxHeight = line.kind === 'code' || line.kind === 'table' ? 23 : 20;
      const boxWidth = Math.min(356, Math.max(120, estimateLineWidth(line.text, line.fontSize) + 20));
      svg.push(`<rect x="${line.x - 10}" y="${line.y - boxHeight + 8}" width="${boxWidth}" height="${boxHeight}" rx="7" fill="${line.backgroundFill}"/>`);
    }
    if (line.borderFill) {
      svg.push(`<rect x="${line.x - 16}" y="${line.y - 17}" width="4" height="22" rx="2" fill="${line.borderFill}"/>`);
    }
    if (line.kind === 'bullet') {
      svg.push(`<circle cx="${line.x - 10}" cy="${line.y - 5}" r="3.5" fill="#0EA5E9"/>`);
    }
    if (line.kind === 'task') {
      svg.push(`<rect x="${line.x - 18}" y="${line.y - 14}" width="11" height="11" rx="2.5" fill="${line.checked ? '#10B981' : '#FFFFFF'}" stroke="${line.checked ? '#10B981' : '#94A3B8'}" stroke-width="1.5"/>`);
      if (line.checked) {
        svg.push(`<path d="M${line.x - 15.2} ${line.y - 8.4} L${line.x - 12.7} ${line.y - 5.8} L${line.x - 8.4} ${line.y - 11}" fill="none" stroke="#FFFFFF" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`);
      }
    }
    const fontFamily = line.fontFamily || TEXT_FONT;
    svg.push(`<text x="${line.x}" y="${line.y}" fill="${line.fill}" font-size="${line.fontSize}" font-family="${fontFamily}" font-weight="${line.fontWeight}">${escapeSvgText(line.text)}</text>`);
  }

  svg.push('<rect x="52" y="392" width="408" height="58" rx="14" fill="#F8FAFC" stroke="#E2E8F0"/>');
  svg.push(`<text x="72" y="421" fill="#0F172A" font-size="20" font-family="${TEXT_FONT}" font-weight="760">${title}</text>`);
  svg.push(`<text x="72" y="441" fill="#64748B" font-size="13" font-family="${TEXT_FONT}" font-weight="560">${previewLabel}</text>`);
  svg.push('</svg>');
  return svg.join('');
}

export async function renderTextThumbnail({ source, output, maxSize, extension, item }) {
  let snippet;
  try {
    snippet = readTextSnippet(source);
  } catch (err) {
    if (err.code) throw err;
    throw new TextThumbnailError(`Unable to read text thumbnail source: ${err.message}`, {
      code: 'TEXT_DECODE_FAILED',
      statusCode: 422,
      cause: err,
    });
  }

  let svg;
  try {
    svg = buildTextThumbnailSvg({
      assetName: item?.name || path.basename(source),
      extension,
      content: snippet.content,
      truncated: snippet.truncated,
    });
  } catch (err) {
    throw new TextThumbnailError(`Unable to build text thumbnail SVG: ${err.message}`, {
      code: 'TEXT_THUMBNAIL_RENDER_FAILED',
      statusCode: 422,
      cause: err,
    });
  }

  try {
    const edge = Math.max(64, Math.min(THUMBNAIL_EDGE, Math.floor(Number(maxSize) || 480)));
    const result = await sharp(Buffer.from(svg), { density: 144 })
      .resize({ width: edge, height: edge, fit: 'inside', withoutEnlargement: true })
      .png({ compressionLevel: 9 })
      .toFile(output);
    return {
      width: 0,
      height: 0,
      thumbnailWidth: result.width,
      thumbnailHeight: result.height,
      skipPaletteAnalysis: true,
      palettes: NEUTRAL_TEXT_PALETTES,
    };
  } catch (err) {
    throw new TextThumbnailError(`Unable to rasterize text thumbnail: ${err.message}`, {
      code: 'TEXT_THUMBNAIL_RENDER_FAILED',
      statusCode: 422,
      cause: err,
    });
  }
}
