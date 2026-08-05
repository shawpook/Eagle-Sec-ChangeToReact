import path from 'node:path';
import sharp from 'sharp';
import { extractOfficeDocument } from './office-document-support.js';

const THUMBNAIL_EDGE = 512;
const NEUTRAL_OFFICE_PALETTES = Object.freeze([{ color: [248, 250, 252], ratio: 100 }]);
const TEXT_FONT = "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const MONO_FONT = "'SFMono-Regular', ui-monospace, Menlo, Consolas, monospace";

export class OfficeThumbnailError extends Error {
  constructor(message, options = {}) {
    super(message, options);
    this.name = 'OfficeThumbnailError';
    this.code = options.code || 'OFFICE_THUMBNAIL_RENDER_FAILED';
    this.statusCode = options.statusCode || 422;
  }
}

function safeText(value) {
  return String(value || '')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeSvgText(value) {
  return safeText(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function trimLabel(value, maxLength = 34) {
  const text = safeText(value);
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 3))}...`;
}

function visualLength(text) {
  let total = 0;
  for (const char of text) {
    total += /[\u2e80-\u9fff\uff00-\uffef]/.test(char) ? 2 : 1;
  }
  return total;
}

function wrapForLine(text, maxChars) {
  const value = safeText(text);
  if (visualLength(value) <= maxChars) return [value];
  const segments = [];
  let current = '';
  for (const char of value) {
    if (visualLength(current + char) > maxChars) {
      if (current) segments.push(current);
      current = char;
      if (segments.length >= 2) break;
      continue;
    }
    current += char;
  }
  if (current && segments.length < 2) segments.push(current);
  return segments.map((segment, index) => (index === segments.length - 1 ? `${segment}...` : segment));
}

function appendTextLines(svg, lines, startY, maxY = 360) {
  let y = startY;
  for (const line of lines.slice(0, 12)) {
    if (y > maxY) break;
    for (const segment of wrapForLine(line, 42)) {
      if (y > maxY) break;
      svg.push(`<text x="80" y="${y}" fill="#334155" font-size="15" font-family="${TEXT_FONT}" font-weight="560">${escapeSvgText(segment)}</text>`);
      y += 23;
    }
    y += 3;
  }
}

function buildDocxSvg(document) {
  const svg = [];
  appendTextLines(svg, document.paragraphs || [], 118);
  return svg;
}

function buildXlsxSvg(document) {
  const rows = (document.previewRows || []).slice(0, 8);
  const columnCount = document.columnCount || Math.max(1, ...rows.map((row) => row.length));
  const tableX = 56;
  const tableY = 112;
  const tableWidth = 400;
  const cellWidth = tableWidth / Math.max(1, columnCount);
  const cellHeight = 34;
  const svg = [];
  svg.push(`<rect x="${tableX}" y="${tableY}" width="${tableWidth}" height="${Math.max(1, rows.length) * cellHeight}" fill="#FFFFFF" stroke="#CBD5E1"/>`);
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const y = tableY + rowIndex * cellHeight;
    for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
      const x = tableX + columnIndex * cellWidth;
      if (rowIndex > 0) svg.push(`<path d="M${tableX} ${y}H${tableX + tableWidth}" stroke="#E2E8F0"/>`);
      if (columnIndex > 0) svg.push(`<path d="M${x} ${tableY}V${tableY + rows.length * cellHeight}" stroke="#E2E8F0"/>`);
      const cell = rows[rowIndex][columnIndex] || '';
      svg.push(`<text x="${x + 8}" y="${y + 22}" fill="${rowIndex === 0 ? '#0F172A' : '#475569'}" font-size="12" font-family="${MONO_FONT}" font-weight="${rowIndex === 0 ? 700 : 500}">${escapeSvgText(trimLabel(cell, 18))}</text>`);
    }
  }
  return svg;
}

function buildPptxSvg(document) {
  const svg = [];
  let y = 116;
  for (const slide of (document.slides || []).slice(0, 3)) {
    if (y > 370) break;
    svg.push(`<rect x="56" y="${y}" width="400" height="78" rx="10" fill="#FFFFFF" stroke="#CBD5E1"/>`);
    svg.push(`<text x="72" y="${y + 24}" fill="#0F172A" font-size="17" font-family="${TEXT_FONT}" font-weight="720">${escapeSvgText(trimLabel(slide.title, 30))}</text>`);
    let lineY = y + 48;
    for (const text of (slide.texts || []).slice(1, 3)) {
      if (lineY > y + 64) break;
      svg.push(`<circle cx="78" cy="${lineY - 4}" r="3" fill="#0EA5E9"/>`);
      svg.push(`<text x="90" y="${lineY}" fill="#475569" font-size="13" font-family="${TEXT_FONT}" font-weight="520">${escapeSvgText(trimLabel(text, 42))}</text>`);
      lineY += 20;
    }
    y += 92;
  }
  return svg;
}

export function buildOfficeThumbnailSvg({ assetName, extension, document, error }) {
  const title = escapeSvgText(trimLabel(assetName || 'Office Document'));
  const formatLabel = escapeSvgText(String(extension || '').replace(/^\./, '').toUpperCase() || 'OFFICE');
  const svg = [`<svg xmlns="http://www.w3.org/2000/svg" width="${THUMBNAIL_EDGE}" height="${THUMBNAIL_EDGE}" viewBox="0 0 ${THUMBNAIL_EDGE} ${THUMBNAIL_EDGE}">`];
  svg.push('<rect width="512" height="512" fill="#F1F5F9"/>');
  svg.push('<rect x="28" y="28" width="456" height="456" rx="22" fill="#FFFFFF" stroke="#CBD5E1"/>');
  svg.push('<rect x="48" y="48" width="416" height="44" rx="12" fill="#F0F9FF" stroke="#BAE6FD"/>');
  svg.push(`<text x="64" y="77" fill="#0369A1" font-size="15" font-family="${TEXT_FONT}" font-weight="760">${formatLabel}</text>`);
  svg.push(`<text x="424" y="77" text-anchor="end" fill="#64748B" font-size="12" font-family="${TEXT_FONT}" font-weight="560">Office preview</text>`);

  if (error) {
    svg.push(`<text x="80" y="150" fill="#B91C1C" font-size="18" font-family="${TEXT_FONT}" font-weight="700">Preview unavailable</text>`);
    svg.push(`<text x="80" y="180" fill="#64748B" font-size="14" font-family="${TEXT_FONT}" font-weight="520">${escapeSvgText(error.code || 'OFFICE_DOCUMENT_READ_FAILED')}</text>`);
  } else if (document?.kind === 'docx') {
    svg.push(...buildDocxSvg(document));
  } else if (document?.kind === 'xlsx') {
    svg.push(...buildXlsxSvg(document));
  } else if (document?.kind === 'pptx') {
    svg.push(...buildPptxSvg(document));
  }

  svg.push('<rect x="48" y="408" width="416" height="58" rx="14" fill="#F8FAFC" stroke="#E2E8F0"/>');
  svg.push(`<text x="68" y="437" fill="#0F172A" font-size="20" font-family="${TEXT_FONT}" font-weight="760">${title}</text>`);
  svg.push('</svg>');
  return svg.join('');
}

export async function renderOfficeThumbnail({ source, output, maxSize, extension, item }) {
  let document = null;
  let error = null;
  try {
    document = await extractOfficeDocument(source, extension);
  } catch (err) {
    error = err;
  }

  let svg;
  try {
    svg = buildOfficeThumbnailSvg({
      assetName: item?.name || path.basename(source),
      extension,
      document,
      error,
    });
  } catch (err) {
    throw new OfficeThumbnailError(`Unable to build Office thumbnail SVG: ${err.message}`, {
      code: 'OFFICE_THUMBNAIL_RENDER_FAILED',
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
      palettes: NEUTRAL_OFFICE_PALETTES,
      placeholder: error ? error.code : false,
    };
  } catch (err) {
    throw new OfficeThumbnailError(`Unable to rasterize Office thumbnail: ${err.message}`, {
      code: 'OFFICE_THUMBNAIL_RENDER_FAILED',
      statusCode: 422,
      cause: err,
    });
  }
}
