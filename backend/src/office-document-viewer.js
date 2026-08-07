import fs from 'node:fs';
import path from 'node:path';
import mammoth from 'mammoth';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import sharp from 'sharp';
import { XMLParser } from 'fast-xml-parser';
import sanitizeHtml from 'sanitize-html';
import { itemOriginalPath, saveItems } from './library-store.js';

/**
 * Office Open XML structured reader/writer migrated from OrcaBox
 * `document-support.ts` (Office slices only). It feeds the migrated
 * `OfficeDocumentSurface` workspace and reuses Eagle item/path resolution,
 * mtime conflict control and atomic replacement.
 *
 * The Eagle `office-document-support.js` thumbnail extractor stays untouched;
 * this module is the richer read/save contract the viewer surface consumes.
 */

export const OFFICE_READER_EXTENSIONS = new Set(['docx', 'xlsx', 'pptx']);

export const OFFICE_CONVERTIBLE_EXTENSIONS = new Set([
  'doc', 'docm', 'docx', 'dot', 'dotm', 'dotx',
  'dps', 'et', 'odp', 'ods', 'odt',
  'pot', 'potm', 'potx', 'pps', 'ppsm', 'ppsx',
  'ppt', 'pptm', 'pptx',
  'wps', 'xls', 'xlsb', 'xlsm', 'xlsx', 'xlt', 'xltm', 'xltx',
]);

export const PDF_CONVERTIBLE_DOCUMENT_EXTENSIONS = new Set(['epub', 'rtf']);

const MAX_OFFICE_FILE_BYTES = 512 * 1024 * 1024;
const MAX_OFFICE_ENTRIES = 4096;
const MAX_OFFICE_ENTRY_UNCOMPRESSED_BYTES = 256 * 1024 * 1024;
const MAX_OFFICE_TOTAL_UNCOMPRESSED_BYTES = 768 * 1024 * 1024;
const OFFICE_READER_MAX_XLSX_SHEETS = 20;
const OFFICE_READER_MAX_XLSX_ROWS = 200;
const OFFICE_READER_MAX_XLSX_COLUMNS = 60;
const OFFICE_READER_MAX_PPTX_SLIDES = 80;
const OFFICE_READER_MAX_PPTX_TEXTS_PER_SLIDE = 80;
const OFFICE_READER_MAX_WARNING_COUNT = 12;
const OFFICE_READER_MAX_EMBEDDED_IMAGES = 18;
const OFFICE_READER_MAX_EMBEDDED_IMAGE_EDGE = 1280;
const OFFICE_READER_MAX_EMBEDDED_IMAGE_BYTES = 280 * 1024;

export class OfficeDocumentViewerError extends Error {
  constructor(message, options = {}) {
    super(message, options);
    this.name = 'OfficeDocumentViewerError';
    this.code = options.code || 'OFFICE_VIEWER_FAILED';
    this.statusCode = options.statusCode || 422;
  }
}

function normalizeExtension(extension) {
  return `.${String(extension || '').replace(/^\./, '').toLowerCase()}`;
}

function findItem(library, itemId) {
  if (!itemId) {
    throw new OfficeDocumentViewerError('Item id is required', { code: 'ITEM_ID_REQUIRED', statusCode: 400 });
  }
  const item = library.items.find((entry) => entry.id === itemId);
  if (!item) {
    throw new OfficeDocumentViewerError('Item not found', { code: 'ITEM_NOT_FOUND', statusCode: 404 });
  }
  return item;
}

function resolveOfficeReaderKind(extension) {
  const normalized = normalizeExtension(extension);
  if (normalized === '.docx') return 'docx';
  if (normalized === '.xlsx') return 'xlsx';
  if (normalized === '.pptx') return 'pptx';
  return null;
}

export function isOfficeConvertibleExtension(extension) {
  return OFFICE_CONVERTIBLE_EXTENSIONS.has(normalizeExtension(extension).slice(1));
}

export function isPdfConvertibleExtension(extension) {
  const normalized = normalizeExtension(extension).slice(1);
  return OFFICE_CONVERTIBLE_EXTENSIONS.has(normalized) || PDF_CONVERTIBLE_DOCUMENT_EXTENSIONS.has(normalized);
}

export function isReadableOfficeExtension(extension) {
  return OFFICE_READER_EXTENSIONS.has(normalizeExtension(extension).slice(1));
}

function assertOfficeDocumentSize(filePath) {
  const stats = fs.statSync(filePath);
  if (stats.size > MAX_OFFICE_FILE_BYTES) {
    throw new OfficeDocumentViewerError('Office document is too large to preview or edit.', {
      code: 'OFFICE_FILE_TOO_LARGE',
      statusCode: 413,
    });
  }
}

async function loadOfficeZip(filePath) {
  let stat;
  try {
    stat = fs.statSync(filePath);
  } catch (err) {
    throw new OfficeDocumentViewerError('Office file does not exist', {
      code: 'ORIGINAL_FILE_NOT_FOUND',
      statusCode: 404,
      cause: err,
    });
  }
  if (stat.size > MAX_OFFICE_FILE_BYTES) {
    throw new OfficeDocumentViewerError(`Office file exceeds ${MAX_OFFICE_FILE_BYTES} bytes`, {
      code: 'OFFICE_FILE_TOO_LARGE',
      statusCode: 413,
    });
  }

  let zip;
  try {
    zip = await JSZip.loadAsync(fs.readFileSync(filePath), { checkCRC32: true });
  } catch (err) {
    throw new OfficeDocumentViewerError(`Office ZIP cannot be loaded: ${err.message}`, {
      code: 'OFFICE_ZIP_INVALID',
      statusCode: 422,
      cause: err,
    });
  }

  const entries = Object.values(zip.files).filter((entry) => !entry.dir);
  if (entries.length > MAX_OFFICE_ENTRIES) {
    throw new OfficeDocumentViewerError(`Office ZIP contains more than ${MAX_OFFICE_ENTRIES} entries`, {
      code: 'OFFICE_ZIP_ENTRIES_EXCEEDED',
      statusCode: 413,
    });
  }

  let totalUncompressed = 0;
  for (const entry of entries) {
    const size = Number(entry._data?.uncompressedSize);
    if (!Number.isFinite(size) || size < 0) {
      throw new OfficeDocumentViewerError('Office ZIP entry size metadata is invalid', {
        code: 'OFFICE_ZIP_METADATA_INVALID',
        statusCode: 422,
      });
    }
    if (size > MAX_OFFICE_ENTRY_UNCOMPRESSED_BYTES) {
      throw new OfficeDocumentViewerError(`Office ZIP entry exceeds ${MAX_OFFICE_ENTRY_UNCOMPRESSED_BYTES} bytes`, {
        code: 'OFFICE_ZIP_ENTRY_TOO_LARGE',
        statusCode: 413,
      });
    }
    totalUncompressed += size;
    if (totalUncompressed > MAX_OFFICE_TOTAL_UNCOMPRESSED_BYTES) {
      throw new OfficeDocumentViewerError(`Office ZIP total uncompressed size exceeds ${MAX_OFFICE_TOTAL_UNCOMPRESSED_BYTES} bytes`, {
        code: 'OFFICE_ZIP_TOTAL_TOO_LARGE',
        statusCode: 413,
      });
    }
  }
  return zip;
}

/** Read an Office Open XML item into the structured data the surface consumes. */
export async function readOfficeDocumentViewer(library, itemId) {
  const item = findItem(library, itemId);
  const extension = normalizeExtension(item.ext);
  const readerKind = resolveOfficeReaderKind(extension);
  if (!readerKind) {
    throw new OfficeDocumentViewerError(`Unsupported Office reader extension: ${extension}`, {
      code: 'OFFICE_FORMAT_UNSUPPORTED',
      statusCode: 415,
    });
  }

  const filePath = itemOriginalPath(library, item);
  assertOfficeDocumentSize(filePath);

  let document;
  if (readerKind === 'docx') document = await readDocxDocument(filePath, extension, readerKind);
  else if (readerKind === 'xlsx') document = await readXlsxDocument(filePath, extension, readerKind);
  else document = await readPptxDocument(filePath, extension, readerKind);

  const stat = fs.statSync(filePath);
  return {
    ...document,
    assetId: item.id,
    mtimeMs: stat.mtimeMs,
  };
}

/**
 * Save a quick-edit input back into the Office item. Enforces the same
 * external-modification conflict semantics as Eagle's text save service and
 * writes through a temporary file with atomic replacement.
 */
export async function saveOfficeDocumentViewer(library, itemId, input, expectedMtimeMs) {
  const item = findItem(library, itemId);
  const extension = normalizeExtension(item.ext);
  const readerKind = resolveOfficeReaderKind(extension);
  if (!readerKind) {
    throw new OfficeDocumentViewerError(`Unsupported Office writer extension: ${extension}`, {
      code: 'OFFICE_FORMAT_UNSUPPORTED',
      statusCode: 415,
    });
  }
  if (!input || input.readerKind !== readerKind) {
    throw new OfficeDocumentViewerError(`Office writer kind mismatch: expected ${readerKind}, received ${input?.readerKind}`, {
      code: 'OFFICE_WRITER_KIND_MISMATCH',
      statusCode: 422,
    });
  }

  const expected = Number(expectedMtimeMs);
  if (!Number.isFinite(expected)) {
    throw new OfficeDocumentViewerError('expectedMtimeMs is required to prevent save conflicts', {
      code: 'OFFICE_SAVE_MTIME_REQUIRED',
      statusCode: 400,
    });
  }

  const source = itemOriginalPath(library, item);
  const currentStat = fs.statSync(source);
  if (Math.abs(currentStat.mtimeMs - expected) > 1) {
    throw new OfficeDocumentViewerError('Office file was modified since it was loaded', {
      code: 'OFFICE_SAVE_CONFLICT',
      statusCode: 409,
    });
  }
  assertOfficeDocumentSize(source);

  // Build the next bytes in memory first so a writer failure never touches disk.
  let buffer;
  if (readerKind === 'docx') buffer = await buildDocxBytes(source, input.blocks ?? []);
  else if (readerKind === 'xlsx') buffer = await buildXlsxBytes(source, input.sheets ?? []);
  else buffer = await buildPptxBytes(source, input.slides ?? []);

  const itemSnapshot = structuredClone(item);
  const infoDir = path.dirname(source);
  fs.mkdirSync(infoDir, { recursive: true });
  const backup = `${source}.backup-${process.pid}-${Date.now()}`;
  const temp = `${source}.pending-${process.pid}-${Date.now()}`;
  const hadOriginal = fs.existsSync(source);
  let installed = false;
  try {
    fs.writeFileSync(temp, buffer);
    if (hadOriginal) fs.renameSync(source, backup);
    fs.renameSync(temp, source);
    installed = true;
    item.size = buffer.length;
    item.lastModified = Date.now();
    item.modificationTime = item.lastModified;
    saveItems(library);
  } catch (err) {
    for (const key of Object.keys(item)) delete item[key];
    Object.assign(item, itemSnapshot);
    if (installed && fs.existsSync(source)) fs.rmSync(source, { force: true });
    if (hadOriginal && fs.existsSync(backup)) fs.renameSync(backup, source);
    throw err;
  } finally {
    if (fs.existsSync(temp)) fs.rmSync(temp, { force: true });
    if (installed && fs.existsSync(backup)) fs.rmSync(backup, { force: true });
  }

  return {
    assetId: item.id,
    mtimeMs: fs.statSync(source).mtimeMs,
  };
}

// ─── DOCX ────────────────────────────────────────────────────────────────────

async function readDocxDocument(filePath, extension, readerKind) {
  const [blocks, backgroundColor] = await Promise.all([
    extractDocxEditableBlocks(filePath),
    extractDocxBackgroundColor(filePath),
  ]);
  const embeddedImages = [];
  const result = await mammoth.convertToHtml(
    { path: filePath },
    {
      convertImage: mammoth.images.imgElement(async (image) => {
        const altText = 'altText' in image && typeof image.altText === 'string' ? image.altText : '';
        const optimized = await createEmbeddedImagePreview(await image.readAsBuffer(), image.contentType ?? 'image/png');
        if (!optimized) return { alt: altText, src: '' };

        embeddedImages.push({
          id: `docx-image-${embeddedImages.length + 1}`,
          dataUrl: optimized.dataUrl,
          mimeType: optimized.mimeType,
          width: optimized.width,
          height: optimized.height,
          title: altText || null,
          altText: altText || null,
          group: null,
        });

        return { src: optimized.dataUrl, alt: altText, title: altText, loading: 'lazy', decoding: 'async' };
      }),
      externalFileAccess: false,
      ignoreEmptyParagraphs: true,
    },
  );
  const html = sanitizeHtml(result.value, {
    allowedTags: [
      'a', 'b', 'blockquote', 'br', 'code', 'del', 'em', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'hr', 'i', 'img', 'li', 'ol', 'p', 'pre', 's', 'span', 'strong', 'sub', 'sup',
      'table', 'tbody', 'td', 'tfoot', 'th', 'thead', 'tr', 'u', 'ul',
    ],
    allowedAttributes: {
      a: ['href', 'name', 'target'],
      img: ['alt', 'decoding', 'height', 'loading', 'src', 'title', 'width'],
      td: ['colspan', 'rowspan'],
      th: ['colspan', 'rowspan'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesByTag: {
      img: ['data'],
    },
  }).replace(/<img\b[^>]*src=(['"])\s*\1[^>]*>/gi, '');

  return {
    filePath,
    extension,
    readerKind,
    title: deriveTitleFromText(stripHtmlTags(html)) ?? 'DOCX document',
    backgroundColor,
    html,
    blocks,
    images: embeddedImages,
    warnings: result.messages
      .map((message) => message.message)
      .filter(Boolean)
      .slice(0, OFFICE_READER_MAX_WARNING_COUNT),
  };
}

async function buildDocxBytes(filePath, blocks) {
  const buffer = await fs.promises.readFile(filePath);
  const zip = await loadOfficeZip(filePath);
  const documentEntry = zip.file('word/document.xml');
  if (!documentEntry) {
    throw new OfficeDocumentViewerError('DOCX writer could not find word/document.xml', {
      code: 'OFFICE_DOCX_MISSING_DOCUMENT',
    });
  }
  const sourceXml = await documentEntry.async('text');
  const paragraphEntries = extractDocxParagraphEntries(sourceXml);
  const blocksById = new Map(blocks.map((block) => [block.id, block]));
  let paragraphIndex = 0;
  const nextXml = sourceXml.replace(/<w:p\b[\s\S]*?<\/w:p>/g, (paragraphXml) => {
    const entry = paragraphEntries[paragraphIndex];
    paragraphIndex += 1;
    if (!entry?.editable) return paragraphXml;
    const nextText = blocksById.get(entry.id)?.text ?? entry.text;
    return replaceDocxParagraphText(paragraphXml, nextText);
  });
  zip.file('word/document.xml', nextXml);
  return zip.generateAsync({ type: 'nodebuffer' });
}

async function extractDocxEditableBlocks(filePath) {
  const zip = await loadOfficeZip(filePath);
  const documentEntry = zip.file('word/document.xml');
  if (!documentEntry) return [];
  return extractDocxBlocksFromXml(await documentEntry.async('text'));
}

async function extractDocxBackgroundColor(filePath) {
  const zip = await loadOfficeZip(filePath);
  const documentEntry = zip.file('word/document.xml');
  if (!documentEntry) return null;
  return extractDocxBackgroundColorFromXml(await documentEntry.async('text'));
}

function extractDocxBackgroundColorFromXml(xml) {
  const backgroundMatch = xml.match(/<w:background\b[^>]*\bw:(?:color|fill)=["']([0-9a-f]{6})["']/i);
  return normalizeOfficeBackgroundColor(backgroundMatch?.[1] ?? null);
}

function extractDocxBlocksFromXml(xml) {
  return extractDocxParagraphEntries(xml)
    .filter((entry) => entry.editable)
    .map((entry) => ({ id: entry.id, level: entry.level, text: entry.text }));
}

function extractDocxParagraphEntries(xml) {
  const entries = [];
  let paragraphIndex = 0;
  xml.replace(/<w:p\b[\s\S]*?<\/w:p>/g, (paragraphXml) => {
    const texts = [...paragraphXml.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g)]
      .map((match) => decodeXmlText(match[1]));
    const text = texts.join('');
    const level = resolveDocxParagraphLevel(paragraphXml);
    const editable = texts.length > 0;
    entries.push({ id: `p-${paragraphIndex}`, level, text, editable });
    paragraphIndex += 1;
    return paragraphXml;
  });
  return entries;
}

function resolveDocxParagraphLevel(paragraphXml) {
  const headingMatch = paragraphXml.match(/<w:pStyle\b[^>]*w:val="Heading(\d+)"/i);
  if (headingMatch) return Math.max(1, Math.min(4, Number(headingMatch[1]) || 1));
  return 0;
}

function replaceDocxParagraphText(paragraphXml, nextText) {
  let wrotePrimaryText = false;
  return paragraphXml.replace(/(<w:t\b[^>]*)(>)([\s\S]*?)(<\/w:t>)/g, (_match, openTagStart, openTagEnd, _content, closeTag) => {
    if (!wrotePrimaryText) {
      wrotePrimaryText = true;
      const escaped = escapeXmlText(nextText);
      const needsPreserve = shouldPreserveXmlSpace(nextText);
      const normalizedOpenTag = needsPreserve && !/\bxml:space=/.test(openTagStart)
        ? `${openTagStart} xml:space="preserve"`
        : openTagStart;
      return `${normalizedOpenTag}${openTagEnd}${escaped}${closeTag}`;
    }
    return `${openTagStart}${openTagEnd}${closeTag}`;
  });
}

// ─── XLSX ───────────────────────────────────────────────────────────────────

async function readXlsxDocument(filePath, extension, readerKind) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const warnings = [];
  const images = [];
  const worksheets = workbook.worksheets.slice(0, OFFICE_READER_MAX_XLSX_SHEETS);
  if (workbook.worksheets.length > worksheets.length) {
    warnings.push(`Showing ${worksheets.length} of ${workbook.worksheets.length} sheets.`);
  }

  const sheets = [];
  for (const worksheet of worksheets) {
    const previewRows = [];
    const columnCount = Math.min(resolveWorksheetColumnCount(worksheet), OFFICE_READER_MAX_XLSX_COLUMNS);
    const rowCount = worksheet.actualRowCount || worksheet.rowCount || 0;
    const previewRowCount = Math.min(rowCount, OFFICE_READER_MAX_XLSX_ROWS);

    for (let rowNumber = 1; rowNumber <= previewRowCount; rowNumber += 1) {
      const row = worksheet.getRow(rowNumber);
      const values = [];
      for (let columnNumber = 1; columnNumber <= columnCount; columnNumber += 1) {
        values.push(formatExcelCellValue(row.getCell(columnNumber).value));
      }
      previewRows.push(values);
    }

    if (rowCount > previewRows.length) {
      warnings.push(`Sheet "${worksheet.name}" has more rows than the reader preview limit.`);
    }

    images.push(...await extractWorksheetEmbeddedImages(workbook, worksheet, warnings, images.length));

    sheets.push({
      name: worksheet.name,
      rowCount: rowCount || previewRows.length,
      columnCount: worksheet.actualColumnCount || columnCount,
      previewRows,
    });
  }

  return {
    filePath,
    extension,
    readerKind,
    title: path.basename(filePath) || 'XLSX workbook',
    backgroundColor: null,
    sheets,
    images,
    warnings: warnings.slice(0, OFFICE_READER_MAX_WARNING_COUNT),
  };
}

async function buildXlsxBytes(filePath, sheets) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  for (const incomingSheet of sheets) {
    const worksheet = workbook.getWorksheet(incomingSheet.name);
    if (!worksheet) continue;
    const maxRows = Math.min(incomingSheet.previewRows.length, OFFICE_READER_MAX_XLSX_ROWS);
    const maxColumns = Math.min(incomingSheet.columnCount, OFFICE_READER_MAX_XLSX_COLUMNS);
    for (let rowIndex = 0; rowIndex < maxRows; rowIndex += 1) {
      const row = incomingSheet.previewRows[rowIndex] ?? [];
      for (let columnIndex = 0; columnIndex < maxColumns; columnIndex += 1) {
        worksheet.getCell(rowIndex + 1, columnIndex + 1).value = row[columnIndex] ?? '';
      }
    }
  }
  return workbook.xlsx.writeBuffer();
}

async function extractWorksheetEmbeddedImages(workbook, worksheet, warnings, existingCount) {
  const bindings = typeof worksheet.getImages === 'function' ? worksheet.getImages() : [];
  const remaining = Math.max(0, OFFICE_READER_MAX_EMBEDDED_IMAGES - existingCount);
  if (remaining <= 0 || bindings.length === 0) {
    if (bindings.length > 0) {
      warnings.push('Embedded spreadsheet images were truncated to protect preview performance.');
    }
    return [];
  }
  if (bindings.length > remaining) {
    warnings.push(`Sheet "${worksheet.name}" has more embedded images than the preview limit.`);
  }

  const images = [];
  for (const [index, binding] of bindings.slice(0, remaining).entries()) {
    const media = workbook.getImage(Number(binding.imageId));
    if (!media?.buffer) continue;
    const optimized = await createEmbeddedImagePreview(Buffer.from(media.buffer), resolveOfficeImageMimeType(media.extension));
    if (!optimized) continue;
    images.push({
      id: `xlsx-${worksheet.name}-${index + 1}`,
      dataUrl: optimized.dataUrl,
      mimeType: optimized.mimeType,
      width: optimized.width,
      height: optimized.height,
      title: `${worksheet.name} · ${formatWorksheetImageRange(binding.range)}`,
      altText: null,
      group: worksheet.name,
    });
  }
  return images;
}

// ─── PPTX ───────────────────────────────────────────────────────────────────

async function readPptxDocument(filePath, extension, readerKind) {
  const buffer = await fs.promises.readFile(filePath);
  const zip = await loadOfficeZip(filePath);
  const parser = new XMLParser({ ignoreAttributes: false, parseTagValue: false, trimValues: true });
  const slideEntries = Object.values(zip.files)
    .filter((entry) => !entry.dir && /^ppt\/slides\/slide\d+\.xml$/i.test(entry.name))
    .sort((a, b) => getPptxSlideNumber(a.name) - getPptxSlideNumber(b.name));
  const visibleSlideEntries = slideEntries.slice(0, OFFICE_READER_MAX_PPTX_SLIDES);
  const warnings = [];
  const images = [];

  if (slideEntries.length > visibleSlideEntries.length) {
    warnings.push(`Showing ${visibleSlideEntries.length} of ${slideEntries.length} slides.`);
  }

  const slides = [];
  for (let index = 0; index < visibleSlideEntries.length; index += 1) {
    const entry = visibleSlideEntries[index];
    const xml = await entry.async('text');
    const parsed = parser.parse(xml);
    const allTexts = extractPptxTextRuns(parsed);
    const texts = allTexts.slice(0, OFFICE_READER_MAX_PPTX_TEXTS_PER_SLIDE);
    if (allTexts.length > texts.length) {
      warnings.push(`Slide ${index + 1} has more text runs than the reader preview limit.`);
    }
    images.push(...await extractPptxSlideEmbeddedImages(zip, entry.name, parser, warnings, images.length, index + 1));
    slides.push({
      index: index + 1,
      title: deriveTitleFromText(texts[0] ?? null),
      texts,
      backgroundColor: extractPptxSlideBackgroundColor(xml),
    });
  }

  return {
    filePath,
    extension,
    readerKind,
    title: deriveTitleFromText(slides[0]?.title ?? slides[0]?.texts[0] ?? null) ?? 'PPTX presentation',
    backgroundColor: slides[0]?.backgroundColor ?? null,
    slides,
    images,
    warnings: warnings.slice(0, OFFICE_READER_MAX_WARNING_COUNT),
  };
}

async function buildPptxBytes(filePath, slides) {
  const zip = await loadOfficeZip(filePath);
  const slidesByIndex = new Map(slides.map((slide) => [slide.index, slide]));
  const slideEntries = Object.values(zip.files)
    .filter((entry) => !entry.dir && /^ppt\/slides\/slide\d+\.xml$/i.test(entry.name))
    .sort((a, b) => getPptxSlideNumber(a.name) - getPptxSlideNumber(b.name));

  for (const entry of slideEntries) {
    const slideIndex = getPptxSlideNumber(entry.name);
    const incomingSlide = slidesByIndex.get(slideIndex);
    if (!incomingSlide) continue;
    const sourceXml = await entry.async('text');
    let textIndex = 0;
    const nextXml = sourceXml.replace(/(<a:t>)([\s\S]*?)(<\/a:t>)/g, (_match, openTag, _content, closeTag) => {
      const nextText = incomingSlide.texts[textIndex] ?? '';
      textIndex += 1;
      return `${openTag}${escapeXmlText(nextText)}${closeTag}`;
    });
    zip.file(entry.name, nextXml);
  }
  return zip.generateAsync({ type: 'nodebuffer' });
}

async function extractPptxSlideEmbeddedImages(zip, slideEntryName, parser, warnings, existingCount, slideIndex) {
  const relationshipsPath = slideEntryName.replace(/slides\/(slide\d+\.xml)$/i, 'slides/_rels/$1.rels');
  const relationshipEntry = zip.file(relationshipsPath);
  if (!relationshipEntry) return [];

  const remaining = Math.max(0, OFFICE_READER_MAX_EMBEDDED_IMAGES - existingCount);
  if (remaining <= 0) {
    warnings.push('Embedded slide images were truncated to protect preview performance.');
    return [];
  }

  const relsXml = await relationshipEntry.async('text');
  const parsed = parser.parse(relsXml);
  const relationshipNodes = toArray(parsed?.Relationships?.Relationship);
  const imageTargets = relationshipNodes
    .map((node) => {
      if (!node || typeof node !== 'object') return null;
      const target = readXmlAttribute(node, 'Target');
      const type = readXmlAttribute(node, 'Type');
      if (!target || !type || !/\/image$/i.test(type)) return null;
      return normalizeZipEntryPath(path.posix.join('ppt/slides', target));
    })
    .filter(Boolean);

  if (imageTargets.length > remaining) {
    warnings.push(`Slide ${slideIndex} has more embedded images than the preview limit.`);
  }

  const images = [];
  for (const [index, targetPath] of imageTargets.slice(0, remaining).entries()) {
    const file = zip.file(targetPath);
    if (!file) continue;
    const buffer = await file.async('nodebuffer');
    const optimized = await createEmbeddedImagePreview(buffer, resolveOfficeImageMimeType(path.extname(targetPath).replace(/^\./, '')));
    if (!optimized) continue;
    images.push({
      id: `pptx-slide-${slideIndex}-${index + 1}`,
      dataUrl: optimized.dataUrl,
      mimeType: optimized.mimeType,
      width: optimized.width,
      height: optimized.height,
      title: `Slide ${slideIndex} · Image ${index + 1}`,
      altText: null,
      group: `Slide ${slideIndex}`,
    });
  }
  return images;
}

// ─── Shared helpers ──────────────────────────────────────────────────────────

async function createEmbeddedImagePreview(buffer, mimeType) {
  if (!buffer.byteLength) return null;
  try {
    if (mimeType === 'image/svg+xml') {
      return { dataUrl: `data:${mimeType};base64,${buffer.toString('base64')}`, mimeType, width: null, height: null };
    }
    const transformer = sharp(buffer, { animated: false, limitInputPixels: 120_000_000 }).rotate();
    const metadata = await transformer.metadata();
    const resized = transformer.resize(OFFICE_READER_MAX_EMBEDDED_IMAGE_EDGE, OFFICE_READER_MAX_EMBEDDED_IMAGE_EDGE, {
      fit: 'inside',
      withoutEnlargement: true,
    });
    const outputBuffer = await resized.clone().webp({ quality: 82, effort: 1 }).toBuffer();
    const finalBuffer = outputBuffer.byteLength > OFFICE_READER_MAX_EMBEDDED_IMAGE_BYTES
      ? await resized.clone().jpeg({ quality: 76, mozjpeg: true }).toBuffer()
      : outputBuffer;
    return {
      dataUrl: `data:${finalBuffer === outputBuffer ? 'image/webp' : 'image/jpeg'};base64,${finalBuffer.toString('base64')}`,
      mimeType: finalBuffer === outputBuffer ? 'image/webp' : 'image/jpeg',
      width: metadata.width ?? null,
      height: metadata.height ?? null,
    };
  } catch (error) {
    console.warn('[office-document-viewer] Embedded image preview generation failed:', error);
    return { dataUrl: `data:${mimeType};base64,${buffer.toString('base64')}`, mimeType, width: null, height: null };
  }
}

function resolveOfficeImageMimeType(extension) {
  const normalized = String(extension || '').replace(/^\./, '').toLowerCase();
  switch (normalized) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'gif':
      return 'image/gif';
    case 'bmp':
      return 'image/bmp';
    case 'svg':
      return 'image/svg+xml';
    case 'webp':
      return 'image/webp';
    case 'tif':
    case 'tiff':
      return 'image/tiff';
    case 'png':
    default:
      return 'image/png';
  }
}

function formatWorksheetImageRange(range) {
  if (!range?.tl) return 'Image';
  const start = `${columnNumberToLetters(Math.floor((range.tl.col ?? 0) + 1))}${Math.floor((range.tl.row ?? 0) + 1)}`;
  if (!range.br) return start;
  const end = `${columnNumberToLetters(Math.floor((range.br.col ?? 0) + 1))}${Math.floor((range.br.row ?? 0) + 1)}`;
  return start === end ? start : `${start}:${end}`;
}

function columnNumberToLetters(columnNumber) {
  let current = Math.max(1, Math.floor(columnNumber));
  let result = '';
  while (current > 0) {
    const remainder = (current - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    current = Math.floor((current - 1) / 26);
  }
  return result || 'A';
}

function normalizeZipEntryPath(entryPath) {
  const segments = String(entryPath || '')
    .replace(/\\/g, '/')
    .split('/')
    .filter(Boolean);
  const normalized = [];
  for (const segment of segments) {
    if (segment === '.') continue;
    if (segment === '..') {
      normalized.pop();
      continue;
    }
    normalized.push(segment);
  }
  return normalized.join('/');
}

function readXmlAttribute(node, attributeName) {
  const direct = node[`@_${attributeName}`];
  if (typeof direct === 'string' && direct.trim()) return direct;
  const namespaced = node[attributeName];
  if (typeof namespaced === 'string' && namespaced.trim()) return namespaced;
  return null;
}

function toArray(value) {
  if (Array.isArray(value)) return value;
  return value === undefined || value === null ? [] : [value];
}

function resolveWorksheetColumnCount(worksheet) {
  const explicitCount = worksheet.actualColumnCount || worksheet.columnCount;
  if (explicitCount > 0) return Math.min(explicitCount, OFFICE_READER_MAX_XLSX_COLUMNS);
  let maxColumn = 0;
  worksheet.eachRow({ includeEmpty: false }, (row) => {
    maxColumn = Math.max(maxColumn, row.cellCount);
  });
  return Math.min(maxColumn, OFFICE_READER_MAX_XLSX_COLUMNS);
}

function formatExcelCellValue(value) {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString().replace(/T.*$/, '');
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map((part) => formatExcelCellValue(part)).filter(Boolean).join(', ');
  if (typeof value === 'object') {
    if ('text' in value && typeof value.text === 'string') return value.text;
    if ('result' in value) return formatExcelCellValue(value.result);
    if ('richText' in value && Array.isArray(value.richText)) return value.richText.map((part) => part.text).filter(Boolean).join('');
    if ('hyperlink' in value && 'text' in value && typeof value.text === 'string') return value.text;
    if ('formula' in value && typeof value.formula === 'string') return `=${value.formula}`;
    if ('error' in value && typeof value.error === 'string') return value.error;
  }
  return String(value);
}

function extractPptxTextRuns(value) {
  const texts = [];
  collectPptxTextRuns(value, texts);
  return texts.map((text) => text.trim()).filter(Boolean);
}

function collectPptxTextRuns(value, texts) {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    for (const item of value) collectPptxTextRuns(item, texts);
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    if (key === 'a:t') {
      if (typeof child === 'string') texts.push(child);
      else if (Array.isArray(child)) texts.push(...child.filter((item) => typeof item === 'string'));
      continue;
    }
    collectPptxTextRuns(child, texts);
  }
}

function getPptxSlideNumber(name) {
  const match = /slide(\d+)\.xml$/i.exec(name);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

function extractPptxSlideBackgroundColor(xml) {
  const backgroundMatch = xml.match(/<p:bg\b[\s\S]*?<a:srgbClr\b[^>]*\bval=["']([0-9a-f]{6})["']/i);
  return normalizeOfficeBackgroundColor(backgroundMatch?.[1] ?? null);
}

function normalizeOfficeBackgroundColor(value) {
  if (!value || !/^[0-9a-f]{6}$/i.test(value)) return null;
  return `#${value.toUpperCase()}`;
}

function stripHtmlTags(html) {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function deriveTitleFromText(value) {
  const normalized = value?.replace(/\s+/g, ' ').trim();
  if (!normalized) return null;
  return normalized.length > 96 ? `${normalized.slice(0, 95)}...` : normalized;
}

function decodeXmlText(value) {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function escapeXmlText(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function shouldPreserveXmlSpace(value) {
  return /^\s|\s$| {2,}|\n|\t/.test(String(value));
}
