import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { itemOriginalPath } from './library-store.js';
import {
  isPdfConvertibleExtension,
  isReadableOfficeExtension,
} from './office-document-viewer.js';

/**
 * Controlled PDF preview source service migrated from OrcaBox
 * `preview-service.ts` `getDocumentPreviewSource` / `getOfficePreviewPdf`.
 *
 * - Direct `.pdf` items are streamed through a controlled endpoint URL (never a
 *   `file://` or absolute local path).
 * - Convertible documents are rendered to a cached derived PDF keyed by item +
 *   source mtime, with timeout / size / concurrency limits.
 * - LibreOffice is an optional runtime: when missing or when conversion fails,
 *   the service reports null and the viewer falls back to the file card.
 */

const OFFICE_PREVIEW_TIMEOUT_MS = 120 * 1000;
const MAX_DERIVED_PDF_BYTES = 200 * 1024 * 1024;
const MAX_IN_FLIGHT_DERIVED_PDF = 8;

let cachedLibreOfficePathResolution = null;
const inFlightDerivedPdf = new Map();

export class DocumentPreviewServiceError extends Error {
  constructor(message, options = {}) {
    super(message, options);
    this.name = 'DocumentPreviewServiceError';
    this.code = options.code || 'DOCUMENT_PREVIEW_FAILED';
    this.statusCode = options.statusCode || 422;
  }
}

function normalizeExtension(extension) {
  return String(extension || '').replace(/^\./, '').toLowerCase();
}

function findItem(library, itemId) {
  if (!itemId) {
    throw new DocumentPreviewServiceError('Item id is required', { code: 'ITEM_ID_REQUIRED', statusCode: 400 });
  }
  const item = library.items.find((entry) => entry.id === itemId);
  if (!item) {
    throw new DocumentPreviewServiceError('Item not found', { code: 'ITEM_NOT_FOUND', statusCode: 404 });
  }
  return item;
}

function previewCacheDir(library) {
  return path.join(library.rootDir, '.document-viewer-cache');
}

function derivedPdfPath(library, itemId) {
  return path.join(previewCacheDir(library), `${itemId}.pdf`);
}

function isFreshDerivedPdf(candidatePath, sourceMtimeMs) {
  try {
    const stat = fs.statSync(candidatePath);
    return stat.size > 0 && stat.size <= MAX_DERIVED_PDF_BYTES && stat.mtimeMs >= sourceMtimeMs;
  } catch {
    return false;
  }
}

/** Resolve a LibreOffice/OpenOffice executable, honoring EAGLE_SOFFICE_PATH. */
export function resolveLibreOfficePath() {
  const cacheKey = JSON.stringify({
    env: process.env.EAGLE_SOFFICE_PATH ?? null,
    path: process.env.PATH ?? '',
  });
  if (cachedLibreOfficePathResolution?.key === cacheKey) {
    return cachedLibreOfficePathResolution.value;
  }

  const candidates = [
    process.env.EAGLE_SOFFICE_PATH,
    process.env.ORCABOX_SOFFICE_PATH,
    'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
    'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
    'C:\\Program Files\\LibreOffice\\program\\soffice.com',
    '/Applications/LibreOffice.app/Contents/MacOS/soffice',
    '/Applications/OpenOffice.app/Contents/MacOS/soffice',
    '/usr/bin/soffice',
    '/usr/local/bin/soffice',
    '/opt/homebrew/bin/soffice',
    '/usr/bin/libreoffice',
    '/usr/local/bin/libreoffice',
    '/opt/homebrew/bin/libreoffice',
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      cachedLibreOfficePathResolution = { key: cacheKey, value: candidate };
      return candidate;
    }
  }

  const resolved = findExecutableOnPath('soffice') || findExecutableOnPath('libreoffice');
  cachedLibreOfficePathResolution = { key: cacheKey, value: resolved };
  return resolved;
}

export function __test_resetLibreOfficePathCache() {
  cachedLibreOfficePathResolution = null;
}

/**
 * Resolve a controlled PDF preview source descriptor for an item, or null when
 * the file is not directly previewable or the conversion capability is absent.
 */
export async function resolveDocumentPreviewSource(library, itemId, hostBase) {
  const item = findItem(library, itemId);
  const extension = normalizeExtension(item.ext);
  const sourcePath = itemOriginalPath(library, item);
  if (!fs.existsSync(sourcePath)) {
    throw new DocumentPreviewServiceError('Original item file does not exist', {
      code: 'ORIGINAL_FILE_NOT_FOUND',
      statusCode: 404,
    });
  }
  const stat = fs.statSync(sourcePath);
  const token = String(Math.round(stat.mtimeMs));

  if (extension === 'pdf') {
    return {
      assetId: item.id,
      kind: 'pdf',
      url: buildPreviewFileUrl(hostBase, item.id, token),
      mimeType: 'application/pdf',
      derived: false,
    };
  }

  if (!isPdfConvertibleExtension(extension)) {
    return null;
  }

  const derivedPdf = await getDerivedPdfPath(library, item, sourcePath, stat.mtimeMs);
  if (!derivedPdf) return null;

  return {
    assetId: item.id,
    kind: 'pdf',
    url: buildPreviewFileUrl(hostBase, item.id, token),
    mimeType: 'application/pdf',
    derived: true,
  };
}

/**
 * Determine the file to stream for a preview file request. Returns
 * `{ filePath, derived }` or null when the item is not previewable.
 */
export async function resolveDocumentPreviewFile(library, itemId, token) {
  const item = findItem(library, itemId);
  const extension = normalizeExtension(item.ext);
  const sourcePath = itemOriginalPath(library, item);
  if (!fs.existsSync(sourcePath)) return null;

  const stat = fs.statSync(sourcePath);
  if (String(token) !== String(Math.round(stat.mtimeMs))) {
    // Freshness token mismatch: the source changed since the preview URL was issued.
    return null;
  }

  if (extension === 'pdf') {
    return { filePath: sourcePath, derived: false };
  }

  if (!isPdfConvertibleExtension(extension)) return null;

  const derivedPdf = await getDerivedPdfPath(library, item, sourcePath, stat.mtimeMs);
  if (!derivedPdf) return null;
  return { filePath: derivedPdf, derived: true };
}

async function getDerivedPdfPath(library, item, sourcePath, sourceMtimeMs) {
  const targetPath = derivedPdfPath(library, item.id);
  if (isFreshDerivedPdf(targetPath, sourceMtimeMs)) return targetPath;

  const requestKey = `${item.id}:${sourcePath}:${sourceMtimeMs}`;
  const inFlight = inFlightDerivedPdf.get(requestKey);
  if (inFlight) return inFlight;

  if (inFlightDerivedPdf.size >= MAX_IN_FLIGHT_DERIVED_PDF) return null;

  const libreOfficePath = resolveLibreOfficePath();
  if (!libreOfficePath) return null;

  const request = generateDerivedPdf(library, item.id, libreOfficePath, targetPath, sourcePath, sourceMtimeMs)
    .finally(() => inFlightDerivedPdf.delete(requestKey));
  inFlightDerivedPdf.set(requestKey, request);
  return request;
}

async function generateDerivedPdf(library, itemId, libreOfficePath, targetPath, sourcePath, sourceMtimeMs) {
  const cacheDir = previewCacheDir(library);
  const outputDir = path.join(cacheDir, `office-${itemId}`);
  const expectedOutputPath = path.join(outputDir, `${path.parse(sourcePath).name}.pdf`);

  try {
    await fs.promises.mkdir(outputDir, { recursive: true });
    await fs.promises.rm(targetPath, { force: true });
    await runLibreOffice(libreOfficePath, [
      '--headless',
      '--convert-to',
      'pdf',
      '--outdir',
      outputDir,
      sourcePath,
    ], OFFICE_PREVIEW_TIMEOUT_MS);

    if (isNonEmptyFile(expectedOutputPath)) {
      await fs.promises.rename(expectedOutputPath, targetPath);
    } else {
      const generatedPdfPath = await findGeneratedPdfInDirectory(outputDir);
      if (generatedPdfPath) {
        await fs.promises.rename(generatedPdfPath, targetPath);
      }
    }

    return isFreshDerivedPdf(targetPath, sourceMtimeMs) ? targetPath : null;
  } catch (error) {
    console.warn('[document-preview-service] Derived PDF generation failed:', error);
    return null;
  } finally {
    try {
      await fs.promises.rm(outputDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('[document-preview-service] Derived PDF temp cleanup failed:', error);
    }
  }
}

function runLibreOffice(executable, args, timeoutMs) {
  return new Promise((resolve, reject) => {
    const child = execFile(executable, args, { timeout: timeoutMs, windowsHide: true }, (error, stdout, stderr) => {
      if (error) {
        const detail = stderr ? ` ${String(stderr).slice(0, 400)}` : '';
        const wrapped = new Error(`LibreOffice conversion failed: ${error.message}${detail}`);
        wrapped.cause = error;
        reject(wrapped);
        return;
      }
      resolve(stdout);
    });
    // Never leave a lingering child on timeout.
    child.on('error', reject);
  });
}

function isNonEmptyFile(filePath) {
  try {
    const stat = fs.statSync(filePath);
    return stat.isFile() && stat.size > 0;
  } catch {
    return false;
  }
}

async function findGeneratedPdfInDirectory(directory) {
  try {
    const entries = await fs.promises.readdir(directory);
    const pdf = entries.find((entry) => entry.toLowerCase().endsWith('.pdf'));
    if (!pdf) return null;
    const candidate = path.join(directory, pdf);
    return isNonEmptyFile(candidate) ? candidate : null;
  } catch {
    return null;
  }
}

function buildPreviewFileUrl(hostBase, itemId, token) {
  const base = String(hostBase || '').replace(/\/$/, '');
  return `${base}/api/v2/item/documentPreviewFile?id=${encodeURIComponent(itemId)}&t=${encodeURIComponent(token)}`;
}

function findExecutableOnPath(commandName) {
  const pathEntries = (process.env.PATH ?? '')
    .split(path.delimiter)
    .map((entry) => entry.trim())
    .filter(Boolean);

  for (const directory of pathEntries) {
    for (const candidate of [path.join(directory, commandName), path.join(directory, `${commandName}.exe`)]) {
      try {
        fs.accessSync(candidate, fs.constants.X_OK);
        return candidate;
      } catch {
        // Ignore missing path entries.
      }
    }
  }
  return null;
}
