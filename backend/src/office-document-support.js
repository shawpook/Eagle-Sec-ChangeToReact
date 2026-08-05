import fs from 'node:fs';
import JSZip from 'jszip';
import { XMLParser } from 'fast-xml-parser';

export const OFFICE_EXTENSIONS = new Set(['docx', 'xlsx', 'pptx']);

const MAX_OFFICE_FILE_BYTES = 512 * 1024 * 1024;
const MAX_OFFICE_ENTRIES = 4096;
const MAX_OFFICE_ENTRY_UNCOMPRESSED_BYTES = 256 * 1024 * 1024;
const MAX_OFFICE_TOTAL_UNCOMPRESSED_BYTES = 768 * 1024 * 1024;
const MAX_OFFICE_XML_BYTES = 64 * 1024 * 1024;
const MAX_PREVIEW_LINES = 12;
const MAX_PREVIEW_ROWS = 20;
const MAX_PREVIEW_COLUMNS = 8;
const MAX_PREVIEW_SLIDES = 3;
const MAX_PREVIEW_TEXTS_PER_SLIDE = 5;

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  processEntities: false,
  trimValues: false,
  allowBooleanAttributes: true,
});

export class OfficeDocumentError extends Error {
  constructor(message, options = {}) {
    super(message, options);
    this.name = 'OfficeDocumentError';
    this.code = options.code || 'OFFICE_DOCUMENT_READ_FAILED';
    this.statusCode = options.statusCode || 422;
  }
}

function asArray(value) {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function collectText(value) {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map(collectText).join('');
  if (value && typeof value === 'object') {
    if (typeof value['#text'] === 'string') return value['#text'];
    return Object.values(value).map(collectText).join('');
  }
  return '';
}

function collectParagraphs(value, paragraphKey) {
  const paragraphs = [];
  const visit = (node) => {
    if (Array.isArray(node)) {
      for (const child of node) visit(child);
      return;
    }
    if (!node || typeof node !== 'object') return;
    if (node[paragraphKey]) {
      paragraphs.push(...asArray(node[paragraphKey]));
    }
    for (const child of Object.values(node)) visit(child);
  };
  visit(value);
  return paragraphs;
}

function cleanLine(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function assertSafeXml(xml) {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) {
    throw new OfficeDocumentError('Office XML contains DOCTYPE or entity declarations', {
      code: 'OFFICE_XML_UNSAFE_ENTITY',
      statusCode: 422,
    });
  }
}

function parseXml(buffer) {
  const xml = buffer.toString('utf8');
  assertSafeXml(xml);
  try {
    return xmlParser.parse(xml);
  } catch (err) {
    throw new OfficeDocumentError(`Unable to parse Office XML: ${err.message}`, {
      code: 'OFFICE_XML_PARSE_FAILED',
      statusCode: 422,
      cause: err,
    });
  }
}

async function loadOfficeZip(filePath) {
  let stat;
  try {
    stat = fs.statSync(filePath);
  } catch (err) {
    throw new OfficeDocumentError('Office file does not exist', {
      code: 'ORIGINAL_FILE_NOT_FOUND',
      statusCode: 404,
      cause: err,
    });
  }
  if (stat.size > MAX_OFFICE_FILE_BYTES) {
    throw new OfficeDocumentError(`Office file exceeds ${MAX_OFFICE_FILE_BYTES} bytes`, {
      code: 'OFFICE_FILE_TOO_LARGE',
      statusCode: 413,
    });
  }

  let zip;
  try {
    zip = await JSZip.loadAsync(fs.readFileSync(filePath), { checkCRC32: true });
  } catch (err) {
    throw new OfficeDocumentError(`Office ZIP cannot be loaded: ${err.message}`, {
      code: 'OFFICE_ZIP_INVALID',
      statusCode: 422,
      cause: err,
    });
  }

  const entries = Object.values(zip.files).filter((entry) => !entry.dir);
  if (entries.length > MAX_OFFICE_ENTRIES) {
    throw new OfficeDocumentError(`Office ZIP contains more than ${MAX_OFFICE_ENTRIES} entries`, {
      code: 'OFFICE_ZIP_ENTRIES_EXCEEDED',
      statusCode: 413,
    });
  }

  let totalUncompressed = 0;
  for (const entry of entries) {
    const size = Number(entry._data?.uncompressedSize);
    if (!Number.isFinite(size) || size < 0) {
      throw new OfficeDocumentError('Office ZIP entry size metadata is invalid', {
        code: 'OFFICE_ZIP_METADATA_INVALID',
        statusCode: 422,
      });
    }
    if (size > MAX_OFFICE_ENTRY_UNCOMPRESSED_BYTES) {
      throw new OfficeDocumentError(`Office ZIP entry exceeds ${MAX_OFFICE_ENTRY_UNCOMPRESSED_BYTES} bytes`, {
        code: 'OFFICE_ZIP_ENTRY_TOO_LARGE',
        statusCode: 413,
      });
    }
    totalUncompressed += size;
    if (totalUncompressed > MAX_OFFICE_TOTAL_UNCOMPRESSED_BYTES) {
      throw new OfficeDocumentError(`Office ZIP total uncompressed size exceeds ${MAX_OFFICE_TOTAL_UNCOMPRESSED_BYTES} bytes`, {
        code: 'OFFICE_ZIP_TOTAL_TOO_LARGE',
        statusCode: 413,
      });
    }
  }
  return zip;
}

async function readZipEntry(zip, entryName, maxBytes = MAX_OFFICE_XML_BYTES) {
  const entry = zip.file(entryName);
  if (!entry) return null;
  const size = Number(entry._data?.uncompressedSize);
  if (!Number.isFinite(size) || size > maxBytes) {
    throw new OfficeDocumentError(`Office ZIP entry exceeds ${maxBytes} bytes`, {
      code: 'OFFICE_ZIP_ENTRY_TOO_LARGE',
      statusCode: 413,
    });
  }
  const buffer = await entry.async('nodebuffer');
  if (buffer.length > maxBytes) {
    throw new OfficeDocumentError(`Office ZIP entry exceeds ${maxBytes} bytes`, {
      code: 'OFFICE_ZIP_ENTRY_TOO_LARGE',
      statusCode: 413,
    });
  }
  return buffer;
}

function findEntryName(zip, pattern) {
  return Object.keys(zip.files).find((name) => pattern.test(name));
}

async function extractDocx(zip) {
  const xml = await readZipEntry(zip, 'word/document.xml');
  if (!xml) throw new OfficeDocumentError('DOCX document.xml is missing', { code: 'OFFICE_DOCX_MISSING_DOCUMENT' });
  const parsed = parseXml(xml);
  const paragraphs = collectParagraphs(parsed, 'w:p')
    .map(collectText)
    .map(cleanLine)
    .filter(Boolean)
    .slice(0, MAX_PREVIEW_LINES);
  return {
    kind: 'docx',
    title: paragraphs[0] || 'Word Document',
    paragraphs,
  };
}

async function extractSharedStrings(zip) {
  const xml = await readZipEntry(zip, 'xl/sharedStrings.xml');
  if (!xml) return [];
  const parsed = parseXml(xml);
  return asArray(parsed?.sst?.si).map(collectText);
}

async function extractXlsx(zip) {
  const shared = await extractSharedStrings(zip);
  const sheetNameEntry = findEntryName(zip, /^xl\/worksheets\/sheet\d+\.xml$/i);
  const xml = sheetNameEntry ? await readZipEntry(zip, sheetNameEntry) : null;
  if (!xml) throw new OfficeDocumentError('XLSX worksheet is missing', { code: 'OFFICE_XLSX_MISSING_WORKSHEET' });
  const parsed = parseXml(xml);
  const rows = asArray(parsed?.worksheet?.sheetData?.row).slice(0, MAX_PREVIEW_ROWS);
  const previewRows = rows.map((row) => {
    const cells = asArray(row?.c).slice(0, MAX_PREVIEW_COLUMNS);
    return cells.map((cell) => {
      const type = cell?.['@_t'];
      if (type === 's') {
        const index = Number(cell?.v);
        return Number.isInteger(index) && shared[index] != null ? cleanLine(shared[index]) : '';
      }
      if (type === 'inlineStr') return cleanLine(collectText(cell?.is));
      return cleanLine(collectText(cell?.v ?? cell?.['#text']));
    });
  });

  let sheetName = 'Sheet 1';
  try {
    const workbookXml = await readZipEntry(zip, 'xl/workbook.xml');
    if (workbookXml) {
      const workbook = parseXml(workbookXml);
      sheetName = cleanLine(asArray(workbook?.workbook?.sheets?.sheet)[0]?.['@_name']) || sheetName;
    }
  } catch (err) {
    // Sheet name is cosmetic; keep the fallback when workbook metadata is unavailable.
  }
  return {
    kind: 'xlsx',
    title: sheetName,
    previewRows,
    columnCount: Math.max(1, Math.min(MAX_PREVIEW_COLUMNS, Math.max(1, ...previewRows.map((row) => row.length)))),
  };
}

async function extractPptx(zip) {
  const slideNames = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
    .sort((left, right) => {
      const leftNumber = Number(left.match(/slide(\d+)\.xml/i)?.[1] || 0);
      const rightNumber = Number(right.match(/slide(\d+)\.xml/i)?.[1] || 0);
      return leftNumber - rightNumber;
    })
    .slice(0, MAX_PREVIEW_SLIDES);

  if (slideNames.length === 0) {
    throw new OfficeDocumentError('PPTX slide XML is missing', { code: 'OFFICE_PPTX_MISSING_SLIDES' });
  }

  const slides = [];
  for (const slideName of slideNames) {
    const parsed = parseXml(await readZipEntry(zip, slideName));
    const paragraphs = collectParagraphs(parsed, 'a:p')
      .map(collectText)
      .map(cleanLine)
      .filter(Boolean);
    slides.push({
      title: paragraphs[0] || `Slide ${slides.length + 1}`,
      texts: paragraphs.slice(0, MAX_PREVIEW_TEXTS_PER_SLIDE),
    });
  }
  return {
    kind: 'pptx',
    title: slides[0]?.title || 'Presentation',
    slides,
  };
}

export async function extractOfficeDocument(filePath, extension) {
  const normalized = String(extension || '').toLowerCase();
  if (!OFFICE_EXTENSIONS.has(normalized)) {
    throw new OfficeDocumentError(`Office thumbnail is not supported for format: ${normalized || 'unknown'}`, {
      code: 'OFFICE_FORMAT_UNSUPPORTED',
      statusCode: 415,
    });
  }
  const zip = await loadOfficeZip(filePath);
  if (normalized === 'docx') return extractDocx(zip);
  if (normalized === 'xlsx') return extractXlsx(zip);
  return extractPptx(zip);
}
