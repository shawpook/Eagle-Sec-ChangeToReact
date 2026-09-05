import fs from 'node:fs';
import path from 'node:path';
import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { convertToPdf, resolveSofficePath } from './legacy-office-thumbnail-renderer.js';

// b1-9at：native-viewer 主侧引擎（残余台账⑦）。原 EdgeJS COM Interop 管线
// （PowerPoint slid.Export / ImageMagick）随 7ba4c85 删除且不可重建（需 MS Office +
// Windows 专属 COM）。本服务以既有机器等价替换：PDF 兼容面走 pdf-thumbnail-worker
// （pdf.js），Office 面走 soffice→pdf→worker；无引擎格式（psd/psb——sharp 无 psdload
// 探针实证、DCRAW 族）抛 NATIVE_PREVIEW_UNSUPPORTED，由 main 侧转 native-preview-failed
// 优雅降级（viewer 停轮询 + ready，与原版不支持扩展早退同 UX）。

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '../..');
const electronBinary = path.resolve(projectRoot, 'node_modules/electron/dist/electron.exe');
const pdfWorker = path.resolve(projectRoot, 'electron/pdf-thumbnail-worker.cjs');

const MAX_SIZE = 4096; // pdf-thumbnail-worker 上限对齐
const DEFAULT_CONVERT_TIMEOUT_MS = 60_000;

export class NativePreviewError extends Error {
  constructor(message, options = {}) {
    super(message, options);
    this.name = 'NativePreviewError';
    this.code = options.code || 'NATIVE_PREVIEW_FAILED';
    this.statusCode = options.statusCode || 422;
  }
}

// soffice→pdf 可达面（ppt/pptx/potx）；ai 由 pdf.js 兼容面直读（PDF-compatible AI v9+）
const OFFICE_PREVIEW_EXTENSIONS = new Set(['ppt', 'pptx', 'potx']);
const PDF_DIRECT_EXTENSIONS = new Set(['ai']);

export function nativePreviewSupported(ext) {
  return OFFICE_PREVIEW_EXTENSIONS.has(ext) || PDF_DIRECT_EXTENSIONS.has(ext);
}

function renderViaPdfWorker({ source, output, maxSize }) {
  if (!fs.existsSync(electronBinary) || !fs.existsSync(pdfWorker)) {
    throw new NativePreviewError('PDF preview renderer is unavailable', {
      code: 'NATIVE_PREVIEW_RENDERER_UNAVAILABLE',
      statusCode: 501,
    });
  }
  return new Promise((resolve, reject) => {
    const env = { ...process.env };
    delete env.ELECTRON_RUN_AS_NODE;
    delete env.NODE_OPTIONS;
    env.EAGLE_PDF_THUMBNAIL_OPTIONS = JSON.stringify({
      source: path.resolve(source),
      output: path.resolve(output),
      maxSize,
      maxImagePixels: 100_000_000,
    });
    const child = fork(pdfWorker, [], {
      execPath: electronBinary,
      cwd: projectRoot,
      env,
      stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
    });
    let stderr = '';
    let settled = false;
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('message', (message) => {
      if (settled) return;
      settled = true;
      if (!child.killed) child.kill();
      if (message?.ok) resolve(message.result);
      else reject(new NativePreviewError(`Unable to render native preview: ${message?.error || 'Unknown renderer failure'}`, {
        code: 'NATIVE_PREVIEW_RENDER_FAILED',
        statusCode: 422,
      }));
    });
    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      reject(new NativePreviewError(`Unable to start native preview renderer: ${err.message}`, {
        code: 'NATIVE_PREVIEW_START_FAILED',
        statusCode: 500,
        cause: err,
      }));
    });
    child.on('exit', (code) => {
      if (settled) return;
      settled = true;
      reject(new NativePreviewError(`Native preview renderer exited with code ${code}${stderr ? `: ${stderr.trim()}` : ''}`, {
        code: 'NATIVE_PREVIEW_RENDER_FAILED',
        statusCode: 422,
      }));
    });
  });
}

export async function renderNativePreview({ filePath, output, size, ext }) {
  if (!filePath || !fs.existsSync(filePath)) {
    throw new NativePreviewError(`Native preview source not found: ${filePath}`, {
      code: 'NATIVE_PREVIEW_SOURCE_NOT_FOUND',
      statusCode: 404,
    });
  }
  const clampedSize = Math.max(1, Math.min(Number(size) || MAX_SIZE, MAX_SIZE));
  let pdfSource = filePath;
  let outdir = null;
  try {
    if (OFFICE_PREVIEW_EXTENSIONS.has(ext)) {
      const converter = resolveSofficePath();
      if (!converter) {
        throw new NativePreviewError(`No native preview engine for ${ext} (LibreOffice unavailable)`, {
          code: 'NATIVE_PREVIEW_UNSUPPORTED',
          statusCode: 422,
        });
      }
      const converted = await convertToPdf({
        source: filePath,
        converter,
        timeoutMs: DEFAULT_CONVERT_TIMEOUT_MS,
      });
      pdfSource = converted.pdf;
      outdir = converted.outdir;
    } else if (!PDF_DIRECT_EXTENSIONS.has(ext)) {
      throw new NativePreviewError(`No native preview engine for ${ext}`, {
        code: 'NATIVE_PREVIEW_UNSUPPORTED',
        statusCode: 422,
      });
    }
    return await renderViaPdfWorker({ source: pdfSource, output, maxSize: clampedSize });
  } finally {
    if (outdir) {
      try { fs.rmSync(outdir, { recursive: true, force: true }); } catch (err) { /* 临时目录清理尽力 */ }
    }
  }
}
