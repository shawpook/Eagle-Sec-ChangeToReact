import fs from 'node:fs';
import chardet from 'chardet';
import iconv from 'iconv-lite';

export const DEFAULT_TEXT_SNIPPET_BYTES = 128 * 1024;

const ENCODING_CANDIDATES = [
  'utf-8',
  'utf-16le',
  'utf-16be',
  'gb18030',
  'gbk',
  'big5',
  'shift_jis',
  'euc-jp',
  'euc-kr',
  'windows-1252',
  'iso-8859-1',
];

const BINARY_SIGNATURES = [
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from([0xff, 0xd8, 0xff]),
  Buffer.from([0x47, 0x49, 0x46, 0x38]),
  Buffer.from([0x52, 0x49, 0x46, 0x46]),
  Buffer.from([0x50, 0x4b, 0x03, 0x04]),
  Buffer.from([0x50, 0x4b, 0x05, 0x06]),
  Buffer.from([0x50, 0x4b, 0x07, 0x08]),
  Buffer.from([0x1f, 0x8b]),
  Buffer.from([0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c]),
  Buffer.from([0x4d, 0x5a]),
  Buffer.from([0x7f, 0x45, 0x4c, 0x46]),
  Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d]),
];

export class TextDocumentError extends Error {
  constructor(message, options = {}) {
    super(message, options);
    this.name = 'TextDocumentError';
    this.code = options.code || 'TEXT_DECODE_FAILED';
    this.statusCode = options.statusCode || 422;
  }
}

function readExactly(fd, length, position = 0) {
  const buffer = Buffer.alloc(length);
  let offset = 0;
  while (offset < length) {
    const bytesRead = fs.readSync(fd, buffer, offset, length - offset, position + offset);
    if (bytesRead === 0) break;
    offset += bytesRead;
  }
  return buffer.subarray(0, offset);
}

function detectTextEncoding(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return 'utf-8';
  }

  if (buffer.length >= 2) {
    if (buffer[0] === 0xff && buffer[1] === 0xfe) return 'utf-16le';
    if (buffer[0] === 0xfe && buffer[1] === 0xff) return 'utf-16be';
  }

  const detected = chardet.detect(buffer)?.toLowerCase() ?? null;
  if (!detected) return null;

  const normalized = detected
    .replace(/_/g, '-')
    .replace(/^gb2312$/, 'gb18030')
    .replace(/^gbk$/, 'gb18030')
    .replace(/^utf8$/, 'utf-8')
    .replace(/^utf16le$/, 'utf-16le')
    .replace(/^utf16be$/, 'utf-16be');

  return iconv.encodingExists(normalized) ? normalized : null;
}

function isBinarySignature(buffer) {
  return BINARY_SIGNATURES.some((signature) => buffer.length >= signature.length && buffer.subarray(0, signature.length).equals(signature));
}

function assertNotBinary(buffer, allowNul) {
  if (buffer.length === 0) return;
  if (isBinarySignature(buffer)) {
    throw new TextDocumentError('Text source contains a binary file signature', {
      code: 'TEXT_SOURCE_BINARY',
      statusCode: 422,
    });
  }
  if (allowNul) return;

  const probe = buffer.subarray(0, Math.min(buffer.length, 4096));
  if (probe.includes(0)) {
    throw new TextDocumentError('Text source contains NUL bytes and is not valid text', {
      code: 'TEXT_SOURCE_BINARY',
      statusCode: 422,
    });
  }

  let suspicious = 0;
  for (const byte of probe) {
    if (byte < 0x09 || (byte > 0x0d && byte < 0x20) || byte === 0x7f) suspicious += 1;
  }
  if (probe.length > 0 && suspicious / probe.length > 0.02) {
    throw new TextDocumentError('Text source contains too many control bytes', {
      code: 'TEXT_SOURCE_BINARY',
      statusCode: 422,
    });
  }
}

function stripIncompleteTail(decoded, encoding) {
  let value = decoded;
  if (encoding === 'utf-16le' || encoding === 'utf-16be') {
    value = value.replace(/\uFFFD+$/, '');
  }
  return value.replace(/\uFFFD+$/, '');
}

function countCharacter(value, predicate) {
  let count = 0;
  for (let index = 0; index < value.length; index += 1) {
    if (predicate(value.charCodeAt(index))) count += 1;
  }
  return count;
}

function isReasonableDecodedText(value) {
  if (!value) return true;
  const length = value.length || 1;
  const replacementRatio = countCharacter(value, (code) => code === 0xfffd) / length;
  const nullRatio = countCharacter(value, (code) => code === 0) / length;
  const controlRatio = countCharacter(value, (code) => (
    code < 0x09 || (code > 0x0d && code < 0x20) || code === 0x7f
  )) / length;
  const mojibakeCount = (value.match(/[\u00C3\u00C2\uFFFD]/g) || []).length;
  return replacementRatio < 0.02 && nullRatio < 0.01 && controlRatio < 0.05 && mojibakeCount / length < 0.25;
}

function scoreDecodedText(value, encoding) {
  if (!value) return 0;
  const length = value.length || 1;
  const replacementRatio = countCharacter(value, (code) => code === 0xfffd) / length;
  const nullRatio = countCharacter(value, (code) => code === 0) / length;
  const controlRatio = countCharacter(value, (code) => (
    code < 0x09 || (code > 0x0d && code < 0x20) || code === 0x7f
  )) / length;
  const mojibakeCount = (value.match(/[\u00C3\u00C2\uFFFD]/g) || []).length;
  const normalized = encoding.toLowerCase();
  const encodingBonus = normalized === 'utf-8'
    ? 20
    : ['gb18030', 'gbk'].includes(normalized)
      ? 16
      : normalized === 'big5'
        ? 14
        : ['utf-16le', 'utf-16be'].includes(normalized)
          ? 12
          : ['euc-jp', 'shift_jis', 'euc-kr'].includes(normalized)
            ? 11
            : 8;
  return encodingBonus - replacementRatio * 100 - nullRatio * 100 - controlRatio * 50 - (mojibakeCount / length) * 40;
}

function decodeBufferWithFallback(buffer, preferredEncoding) {
  const encodings = preferredEncoding
    ? [preferredEncoding, ...ENCODING_CANDIDATES.filter((encoding) => encoding !== preferredEncoding)]
    : [...ENCODING_CANDIDATES];

  let best = null;
  for (const encoding of encodings) {
    if (!iconv.encodingExists(encoding)) continue;
    const decoded = stripIncompleteTail(iconv.decode(buffer, encoding), encoding);
    if (!isReasonableDecodedText(decoded)) continue;
    const score = scoreDecodedText(decoded, encoding);
    if (!best || score > best.score) best = { encoding, content: decoded, score };
  }

  if (best) return { encoding: best.encoding, content: best.content };
  throw new TextDocumentError('Text content could not be decoded with any supported encoding', {
    code: 'TEXT_DECODE_FAILED',
    statusCode: 422,
  });
}

export function readTextSnippet(filePath, options = {}) {
  const fd = fs.openSync(filePath, 'r');
  try {
    const stat = fs.fstatSync(fd);
    if (!stat.isFile()) {
      throw new TextDocumentError('Text source must be a regular file', {
        code: 'INVALID_TEXT_SOURCE',
        statusCode: 400,
      });
    }

    const maxBytes = Math.max(1, Math.floor(Number(options.maxBytes) || DEFAULT_TEXT_SNIPPET_BYTES));
    const startOffset = Math.min(stat.size, Math.max(0, Math.floor(Number(options.offset) || 0)));
    const requestedBytes = Math.min(stat.size - startOffset, maxBytes);
    const raw = requestedBytes > 0 ? readExactly(fd, requestedBytes, startOffset) : Buffer.alloc(0);
    const detectedEncoding = options.encoding || detectTextEncoding(raw);
    const allowNul = detectedEncoding === 'utf-16le' || detectedEncoding === 'utf-16be';
    if (startOffset === 0) assertNotBinary(raw, allowNul);
    const decodedBuffer = startOffset === 0 && raw.length >= 3 && raw[0] === 0xef && raw[1] === 0xbb && raw[2] === 0xbf
      ? raw.subarray(3)
      : startOffset === 0 && raw.length >= 2 && ((raw[0] === 0xff && raw[1] === 0xfe) || (raw[0] === 0xfe && raw[1] === 0xff))
        ? raw.subarray(2)
        : raw;
    const decoded = decodeBufferWithFallback(decodedBuffer, detectedEncoding);

    const content = (startOffset > 0 ? decoded.content.replace(/^\uFFFD+/, '') : decoded.content).replace(/\r\n?/g, '\n');
    return {
      content,
      encoding: decoded.encoding,
      truncated: stat.size > startOffset + raw.length,
      bytesRead: raw.length,
      totalBytes: stat.size,
      offset: startOffset,
      endOffset: startOffset + raw.length,
    };
  } finally {
    fs.closeSync(fd);
  }
}
