import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import sharp from 'sharp';

export const LEGACY_OFFICE_EXTENSIONS = new Set([
  'doc',
  'xls',
  'ppt',
  'wps',
  'et',
  'dps',
  'odt',
  'ods',
  'odp',
]);

const DEFAULT_CONVERT_TIMEOUT_MS = 60_000;
const NEUTRAL_OFFICE_PALETTES = Object.freeze([{ color: [248, 250, 252], ratio: 100 }]);
const TEXT_FONT = "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

let cachedSofficePath = null;

export class LegacyOfficeError extends Error {
  constructor(message, options = {}) {
    super(message, options);
    this.name = 'LegacyOfficeError';
    this.code = options.code || 'OFFICE_CONVERT_FAILED';
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

export function resolveSofficePath() {
  if (cachedSofficePath !== null) return cachedSofficePath;
  const candidates = [
    process.env.EAGLE_SOFFICE_PATH,
    '/usr/bin/soffice',
    '/usr/local/bin/soffice',
    '/opt/homebrew/bin/soffice',
    '/Applications/LibreOffice.app/Contents/MacOS/soffice',
    'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
    'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
  ].filter(Boolean);
  cachedSofficePath = candidates.find((candidate) => fs.existsSync(candidate)) || null;
  return cachedSofficePath;
}

export function __test_resetSofficePathCache() {
  cachedSofficePath = null;
}

function killChildTree(child) {
  if (!child || !child.pid) return;
  try {
    child.kill();
  } catch (err) {
    // Ignore process kill races.
  }
  if (process.platform === 'win32') {
    try {
      spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    } catch (err) {
      // taskkill may be unavailable; the direct kill above is still attempted.
    }
  }
}

function spawnConverter(converter, args, options) {
  if (converter.toLowerCase().endsWith('.js')) {
    return spawn(process.execPath, [converter, ...args], options);
  }
  return spawn(converter, args, options);
}

function runConverter({ converter, source, outdir, timeoutMs, onChild }) {
  return new Promise((resolve, reject) => {
    const child = spawnConverter(converter, [
      '--headless',
      '--convert-to',
      'pdf',
      '--outdir',
      outdir,
      source,
    ], {
      cwd: outdir,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    onChild?.(child);
    let stderr = '';
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    const timeout = setTimeout(() => {
      killChildTree(child);
      reject(new LegacyOfficeError(`LibreOffice conversion timed out after ${timeoutMs} ms`, {
        code: 'OFFICE_CONVERT_TIMEOUT',
        statusCode: 504,
      }));
    }, timeoutMs);
    child.on('error', (err) => {
      clearTimeout(timeout);
      killChildTree(child);
      reject(new LegacyOfficeError(`Unable to start LibreOffice: ${err.message}`, {
        code: 'OFFICE_CONVERT_START_FAILED',
        statusCode: 500,
        cause: err,
      }));
    });
    child.on('exit', (code) => {
      clearTimeout(timeout);
      if (code === 0) resolve();
      else reject(new LegacyOfficeError(`LibreOffice exited with code ${code}${stderr ? `: ${stderr.trim()}` : ''}`, {
        code: 'OFFICE_CONVERT_FAILED',
        statusCode: 422,
      }));
    });
  });
}

// b1-9at：native-preview-service 复用（native-viewer 主侧引擎 soffice→pdf 面）
export async function convertToPdf({ source, converter, timeoutMs, onChild }) {
  const outdir = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-office-convert-'));
  try {
    await runConverter({ converter, source, outdir, timeoutMs, onChild });
    const expected = path.join(outdir, `${path.basename(source, path.extname(source))}.pdf`);
    if (!fs.existsSync(expected)) {
      throw new LegacyOfficeError('LibreOffice did not produce a PDF output', {
        code: 'OFFICE_CONVERT_NO_OUTPUT',
        statusCode: 422,
      });
    }
    return { pdf: expected, outdir };
  } catch (err) {
    fs.rmSync(outdir, { recursive: true, force: true });
    throw err;
  }
}

function buildPlaceholderSvg({ assetName, extension, error }) {
  const title = escapeSvgText(trimLabel(assetName || 'Office Document'));
  const formatLabel = escapeSvgText(String(extension || '').replace(/^\./, '').toUpperCase() || 'OFFICE');
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">`,
    '<rect width="512" height="512" fill="#F1F5F9"/>',
    '<rect x="28" y="28" width="456" height="456" rx="22" fill="#FFFFFF" stroke="#CBD5E1"/>',
    '<rect x="48" y="48" width="416" height="44" rx="12" fill="#F0F9FF" stroke="#BAE6FD"/>',
    `<text x="64" y="77" fill="#0369A1" font-size="15" font-family="${TEXT_FONT}" font-weight="760">${formatLabel}</text>`,
    `<text x="424" y="77" text-anchor="end" fill="#64748B" font-size="12" font-family="${TEXT_FONT}" font-weight="560">Legacy Office preview</text>`,
    `<text x="80" y="150" fill="#B91C1C" font-size="18" font-family="${TEXT_FONT}" font-weight="700">Preview unavailable</text>`,
    `<text x="80" y="180" fill="#64748B" font-size="14" font-family="${TEXT_FONT}" font-weight="520">${escapeSvgText(error?.code || 'OFFICE_CONVERT_FAILED')}</text>`,
    '<rect x="48" y="408" width="416" height="58" rx="14" fill="#F8FAFC" stroke="#E2E8F0"/>',
    `<text x="68" y="437" fill="#0F172A" font-size="20" font-family="${TEXT_FONT}" font-weight="760">${title}</text>`,
    '</svg>',
  ].join('');
}

async function renderPlaceholder({ source, output, maxSize, extension, item, error }) {
  const svg = buildPlaceholderSvg({
    assetName: item?.name || path.basename(source),
    extension,
    error,
  });
  const edge = Math.max(64, Math.min(512, Math.floor(Number(maxSize) || 480)));
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
    placeholder: error?.code || 'OFFICE_CONVERT_FAILED',
  };
}

export async function renderLegacyOfficeThumbnail({ source, output, maxSize, extension, item, renderPdf, onChild, timeoutMs }) {
  try {
    const converter = resolveSofficePath();
    if (!converter) {
      throw new LegacyOfficeError('LibreOffice is not available', {
        code: 'OFFICE_CONVERTER_UNAVAILABLE',
        statusCode: 501,
      });
    }
    const limit = Number(timeoutMs) || DEFAULT_CONVERT_TIMEOUT_MS;
    const { pdf, outdir } = await convertToPdf({ source, converter, timeoutMs: limit, onChild });
    try {
      const info = await renderPdf(pdf, output, maxSize, onChild);
      return {
        ...info,
        skipPaletteAnalysis: true,
        palettes: NEUTRAL_OFFICE_PALETTES,
        converter: 'libreoffice',
      };
    } finally {
      fs.rmSync(outdir, { recursive: true, force: true });
    }
  } catch (err) {
    return renderPlaceholder({ source, output, maxSize, extension, item, error: err });
  }
}
