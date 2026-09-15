import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { itemOriginalPath, saveItems } from './library-store.js';

// sharp/libvips 默认会把「读过的文件」的句柄留在进程级 file cache 里。Windows 上
// 只要还有任何句柄打开，rename/unlink 覆盖该文件就会 EPERM —— 也就是源文件一旦被
// sharp 读过就再也换不掉了（缩略图任务同样会读源文件，所以这个锁不是本模块自己造成的）。
// files:0 关闭该缓存，读毕即关句柄；这是 Windows 上「写回源文件」能成立的前提。
sharp.cache({ files: 0 });

const MAX_SOURCE_BYTES = 100_000_000;
const MAX_DECODED_PIXELS = 30_000_000;

const REPLACE_RETRY_ATTEMPTS = 5;
const REPLACE_RETRY_DELAY_MS = 25;

const ROTATE_DEGREES = new Set([90, 180, 270]);
const FLIP_TYPES = new Set(['horizontal', 'vertical', 'both']);

// F06 写入范围（调研报告 §5 方案 C 的「按格式分流」）：
//   png / webp —— 原版走 Canvas 破坏性重编码（需 file:// + Canvas + APNG），
//                 该路径在 Electron/Vite 下脆弱且从未验证，改由后端 sharp 接管。
//   jpg / jpeg —— 由渲染层 piexif EXIF 无损路径负责（另一 worker），本端点明确拒绝，
//                 以免用 sharp 重编码破坏「无损、可逆」的原产品语义。
//   avif / bmp —— 原版即拒绝写入：AVIF 在 rotateImage.js:242 显式 reject；
//                 BMP 依赖从未被安装的 global.CanvasToBMP（调研 §7.5），
//                 且 sharp 无 BMP 编码器，故一并拒绝而不是假装支持。
const SHARP_WRITABLE_FORMATS = new Set(['png', 'webp']);
const RENDER_LAYER_FORMATS = new Set(['jpg', 'jpeg']);
const LEGACY_REFUSED_FORMATS = new Set(['avif', 'bmp']);

export class ImageTransformError extends Error {
  constructor(message, options = {}) {
    super(message, options);
    this.name = 'ImageTransformError';
    this.code = options.code || 'WRITE_FAILED';
    this.statusCode = options.statusCode || 500;
  }
}

function invalidArgument(message, options) {
  return new ImageTransformError(message, { code: 'INVALID_ARGUMENT', statusCode: 400, ...options });
}

function notFound(message, options) {
  return new ImageTransformError(message, { code: 'NOT_FOUND', statusCode: 404, ...options });
}

function unsupportedFormat(message, options) {
  return new ImageTransformError(message, { code: 'UNSUPPORTED_FORMAT', statusCode: 415, ...options });
}

function permissionDenied(message, options) {
  return new ImageTransformError(message, { code: 'PERMISSION_DENIED', statusCode: 403, ...options });
}

function writeFailed(message, options) {
  return new ImageTransformError(message, { code: 'WRITE_FAILED', statusCode: 500, ...options });
}

function isPermissionError(err) {
  return err && ['EACCES', 'EPERM', 'EROFS'].includes(err.code);
}

function uniqueSibling(filePath, label) {
  return `${filePath}.${label}-${process.pid}-${crypto.randomUUID()}`;
}

function isTransientLockError(err) {
  return err && ['EPERM', 'EBUSY', 'EACCES'].includes(err.code);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 同目录原子换入：要么全是旧字节，要么全是新字节，不存在中间态。
 * 杀毒/索引器/资源管理器可能瞬时持有目标句柄，这类共享冲突会在几十毫秒内消失，
 * 故做有限次退避重试；重试耗尽仍失败就如实抛出，绝不假装写成功。
 */
async function replaceFileAtomically(from, to) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      await fs.promises.rename(from, to);
      return;
    } catch (err) {
      if (!isTransientLockError(err) || attempt >= REPLACE_RETRY_ATTEMPTS) throw err;
      await sleep(REPLACE_RETRY_DELAY_MS * attempt);
    }
  }
}

function restoreItem(item, snapshot) {
  for (const key of Object.keys(item)) delete item[key];
  Object.assign(item, snapshot);
}

/**
 * 把请求体归一化为可执行指令；任何不合法的入参都在触碰磁盘之前被拒绝。
 */
function normalizeRequest(params) {
  const id = params.id || params.itemID || params.itemId;
  if (!id) throw invalidArgument('Item id is required');

  const op = String(params.op || '').trim().toLowerCase();
  if (op === 'rotate') {
    const raw = params.degree ?? params.rotate ?? params.angle;
    const degree = Number(raw);
    if (raw === undefined || raw === null || raw === '' || !Number.isInteger(degree) || !ROTATE_DEGREES.has(degree)) {
      throw invalidArgument(`Rotate degree must be one of 90, 180, 270; received ${JSON.stringify(raw)}`);
    }
    return { id: String(id), op, degree };
  }
  if (op === 'flip') {
    const flipType = String(params.flipType || params.direction || '').trim().toLowerCase();
    if (!FLIP_TYPES.has(flipType)) {
      throw invalidArgument(`Flip type must be one of ${[...FLIP_TYPES].join(', ')}; received ${JSON.stringify(params.flipType ?? params.direction)}`);
    }
    return { id: String(id), op, flipType };
  }
  throw invalidArgument(`Unsupported op: ${JSON.stringify(params.op)}; expected rotate or flip`);
}

/**
 * 用 sharp 把关；返回值只在真正解码成功后给出，绝不猜测格式是否可用。
 */
async function readSourceMetadata(source, extension) {
  let metadata;
  try {
    metadata = await sharp(source, {
      animated: false,
      failOn: 'error',
      limitInputPixels: MAX_DECODED_PIXELS,
      pages: 1,
      sequentialRead: true,
    }).metadata();
  } catch (err) {
    throw unsupportedFormat(`Unable to decode ${extension.toUpperCase()} source: ${err.message}`, { cause: err });
  }
  const width = Number(metadata?.width) || 0;
  const height = Number(metadata?.height) || 0;
  if (width <= 0 || height <= 0) {
    throw unsupportedFormat(`Image has no decodable raster dimensions: ${source}`);
  }
  if (width * height > MAX_DECODED_PIXELS) {
    throw invalidArgument(`Decoded image dimensions exceed the safety limit (${MAX_DECODED_PIXELS} pixels)`, { statusCode: 413 });
  }
  return { width, height, format: String(metadata.format || extension).toLowerCase() };
}

function encodeTo(pipeline, extension) {
  // 编码参数刻意与原版 Canvas 路径的 `quality = 1`（rotateImage.js:232/326）对齐：
  // PNG 无损、WebP 亦取无损，使旋转/翻转严格可逆（连转 4 次 90° 回到原像素）。
  if (extension === 'png') return pipeline.png({ compressionLevel: 9 });
  return pipeline.webp({ lossless: true, effort: 4 });
}

/**
 * 把变换结果渲染到 pending 文件。此时源文件一个字节都没有被改动。
 */
async function renderTransformed(source, output, request, extension) {
  const source_metadata = await readSourceMetadata(source, extension);
  let pipeline = sharp(source, {
    animated: false,
    failOn: 'error',
    limitInputPixels: MAX_DECODED_PIXELS,
    pages: 1,
    sequentialRead: true,
  });
  if (request.op === 'rotate') {
    // sharp 的正角度为顺时针，与原版 Canvas 的 ctx.rotate(+deg) 方向一致。
    pipeline = pipeline.rotate(request.degree);
  } else if (request.flipType === 'horizontal') {
    pipeline = pipeline.flop();
  } else if (request.flipType === 'vertical') {
    pipeline = pipeline.flip();
  } else {
    pipeline = pipeline.flop().flip();
  }
  let result;
  try {
    result = await encodeTo(pipeline, extension).toFile(output);
  } catch (err) {
    if (isPermissionError(err)) throw permissionDenied(`Unable to write transformed image: ${err.message}`, { cause: err });
    throw writeFailed(`Unable to render transformed ${extension.toUpperCase()}: ${err.message}`, { cause: err });
  }
  return { width: source_metadata.width, height: source_metadata.height, outputWidth: result.width, outputHeight: result.height };
}

export class ImageTransformService {
  constructor(options = {}) {
    const maxSourceBytes = Number(options.maxSourceBytes);
    this.maxSourceBytes = Number.isFinite(maxSourceBytes) && maxSourceBytes > 0 ? maxSourceBytes : MAX_SOURCE_BYTES;
    this.regenerate = options.regenerate || null;
    this.active = new Set();
  }

  /**
   * 旋转/翻转一个条目的源图片，并在同一请求内完成
   * 「写源文件 → 重新生成缩略图 → 更新 metadata 宽高」。
   * 任何一步失败都会把源文件字节与条目状态回滚到请求开始前的样子。
   */
  async transform(library, params = {}) {
    const request = normalizeRequest(params || {});
    const item = this.#assertItem(library, request.id);
    const extension = this.#assertFormat(item);
    const key = `${path.resolve(library.rootDir)}\0${item.id}`;
    if (this.active.has(key)) {
      throw new ImageTransformError('An image transform is already running for this item', {
        code: 'IMAGE_TRANSFORM_CONFLICT',
        statusCode: 409,
      });
    }
    this.active.add(key);
    try {
      return await this.#run(library, item, extension, request);
    } finally {
      this.active.delete(key);
    }
  }

  async #run(library, item, extension, request) {
    const source = itemOriginalPath(library, item);
    this.#assertSourceWritable(source);
    const stat = fs.statSync(source);
    if (!stat.isFile()) throw notFound('Original item source must be a regular file');
    if (stat.size <= 0) throw invalidArgument('Original item source is empty');
    if (stat.size > this.maxSourceBytes) {
      throw invalidArgument(`Original item source exceeds ${this.maxSourceBytes} bytes`, { statusCode: 413 });
    }
    if (typeof this.regenerate !== 'function') {
      throw writeFailed('Thumbnail regeneration is not configured for image transforms');
    }
    const pending = uniqueSibling(source, 'imageops-pending');
    const backup = uniqueSibling(source, 'imageops-backup');
    const snapshot = structuredClone(item);
    const previousWidth = Number(item.width) || 0;
    const previousHeight = Number(item.height) || 0;

    // 1) 渲染到 pending —— 源文件未动，失败可直接丢弃。
    let rendered;
    try {
      rendered = await renderTransformed(source, pending, request, extension);
    } catch (err) {
      fs.rmSync(pending, { force: true });
      throw err;
    }

    // 2) 备份源文件字节，供后续任何一步失败时原样回滚。
    let backupReady = false;
    let swapped = false;
    try {
      fs.copyFileSync(source, backup);
      backupReady = true;
    } catch (err) {
      fs.rmSync(pending, { force: true });
      if (isPermissionError(err)) throw permissionDenied(`Unable to back up source file: ${err.message}`, { cause: err });
      throw writeFailed(`Unable to back up source file: ${err.message}`, { cause: err });
    }

    let thumbnailTaskId = null;
    try {
      // 3) 原子换入：同目录 rename，源文件要么是旧字节要么是新字节，不存在中间态。
      try {
        await replaceFileAtomically(pending, source);
        swapped = true;
      } catch (err) {
        if (isPermissionError(err)) throw permissionDenied(`Unable to replace source file: ${err.message}`, { cause: err });
        throw writeFailed(`Unable to replace source file: ${err.message}`, { cause: err });
      }

      // 4) 从磁盘读回，确认真实落盘且尺寸符合预期 —— 绝不在未写盘时报成功。
      const written = await this.#verifyWritten(source, extension, rendered);
      if (!written.ok) {
        throw writeFailed(`Transformed image was not persisted as expected: ${written.reason}`);
      }

      // 5) 同一请求内重新生成缩略图；该调用同时把新的 width/height 落进 metadata.json
      //    （thumbnail-task-service.js:451-466 → commitThumbnail），走既有库事务。
      try {
        const task = await this.regenerate(library, item.id);
        thumbnailTaskId = task?.id || null;
      } catch (err) {
        throw writeFailed(`Thumbnail regeneration failed: ${err.message}`, { cause: err, upstreamCode: err.code || null });
      }

      const finalWidth = Number(item.width) || rendered.outputWidth;
      const finalHeight = Number(item.height) || rendered.outputHeight;
      return {
        item,
        id: item.id,
        name: item.name,
        ext: extension,
        op: request.op,
        ...(request.op === 'rotate' ? { degree: request.degree } : { flipType: request.flipType }),
        width: finalWidth,
        height: finalHeight,
        previousWidth,
        previousHeight,
        bytes: fs.statSync(source).size,
        path: source,
        thumbnailTaskId,
      };
    } catch (err) {
      const rollbackProblems = await this.#rollback(library, item, snapshot, { source, backup, pending, backupReady, swapped });
      if (rollbackProblems.length > 0) {
        throw writeFailed(`${err.message}; rollback incomplete: ${rollbackProblems.join('; ')}`, {
          cause: err,
          statusCode: 500,
        });
      }
      throw err;
    } finally {
      fs.rmSync(pending, { force: true });
      if (backupReady) fs.rmSync(backup, { force: true });
    }
  }

  #assertItem(library, id) {
    if (!library || !library.rootDir) throw writeFailed('Library rootDir is required');
    const item = (library.items || []).find((entry) => entry.id === id);
    if (!item) throw notFound(`Item not found: ${id}`);
    return item;
  }

  #assertFormat(item) {
    const extension = String(item.ext || '').trim().toLowerCase();
    if (!extension) throw unsupportedFormat(`Item ${item.id} has no file extension to transform`);
    if (RENDER_LAYER_FORMATS.has(extension)) {
      throw unsupportedFormat(
        `JPEG is handled by the renderer EXIF path and cannot be transformed here: ${extension}`
      );
    }
    if (LEGACY_REFUSED_FORMATS.has(extension)) {
      throw unsupportedFormat(`Format does not support writing: ${extension}`);
    }
    if (!SHARP_WRITABLE_FORMATS.has(extension)) {
      throw unsupportedFormat(`Unsupported format for writing: ${extension}`);
    }
    return extension;
  }

  #assertSourceWritable(source) {
    if (!fs.existsSync(source)) throw notFound(`Original item file does not exist: ${source}`);
    for (const target of [source, path.dirname(source)]) {
      try {
        fs.accessSync(target, fs.constants.W_OK);
      } catch (err) {
        throw permissionDenied(`No write permission for ${target}`, { cause: err });
      }
    }
  }

  async #verifyWritten(source, extension, rendered) {
    let metadata;
    try {
      metadata = await sharp(source, { animated: false, failOn: 'error', pages: 1, sequentialRead: true }).metadata();
    } catch (err) {
      return { ok: false, reason: `rewritten file is not decodable (${err.message})` };
    }
    const width = Number(metadata?.width) || 0;
    const height = Number(metadata?.height) || 0;
    if (width !== rendered.outputWidth || height !== rendered.outputHeight) {
      return { ok: false, reason: `on-disk size ${width}x${height} does not match rendered ${rendered.outputWidth}x${rendered.outputHeight}` };
    }
    if (!fs.statSync(source).size) return { ok: false, reason: `rewritten ${extension} file is empty` };
    return { ok: true };
  }

  /**
   * 回滚：源文件字节 → 条目内存状态 → 尽力持久化。
   * 若上一步事务本身就没写成功，磁盘快照仍是请求开始前的样子，持久化失败不构成半成品。
   */
  async #rollback(library, item, snapshot, { source, backup, pending, backupReady, swapped }) {
    const problems = [];
    if (backupReady && fs.existsSync(backup)) {
      try {
        if (swapped) await replaceFileAtomically(backup, source);
        else fs.copyFileSync(backup, source);
      } catch (err) {
        try {
          fs.copyFileSync(backup, source);
        } catch (copyError) {
          problems.push(`source restore failed: ${copyError.message}`);
        }
      }
    } else if (swapped) {
      problems.push('source was replaced but no backup is available');
    }
    fs.rmSync(pending, { force: true });
    restoreItem(item, snapshot);
    try {
      saveItems(library);
    } catch (err) {
      problems.push(`item state persist failed: ${err.message}`);
    }
    return problems;
  }
}
