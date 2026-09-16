const fs = require('node:fs');
const path = require('node:path');

// ---------------------------------------------------------------------------
// EBML / WebM 改写：补齐 Info.Duration
//
// 背景：MediaRecorder 写出的 WebM 里 Segment > Info 不含 Duration 元素，
// Chromium 于是恒报 video.duration === Infinity（即便 readyState 已是 HAVE_ENOUGH_DATA）。
// 夹具消费方（detailHooks 的原生→MPV 判据）会因此把可播放的夹具误判为不可播放。
// 本模块只修夹具、不动产品判据。
//
// 注：MediaRecorder 的产物里既没有 SeekHead 也没有 Cues，Segment 本身是 unknown size，
// 因此“在 Info 尾部追加 + 重建缓冲区”不会产生任何悬空寻址，也不需要修 Segment 的 size。
// ---------------------------------------------------------------------------

const ID_SEGMENT = 0x18538067;
const ID_INFO = 0x1549a966;
const ID_DURATION = 0x4489;
const ID_TIMECODE_SCALE = 0x2ad7b1;
const DEFAULT_TIMECODE_SCALE = 1000000; // 纳秒；1ms
const NANOSECONDS_PER_MILLISECOND = 1000000;

// 前导 1 的位置决定变长整数的字节数；返回 0 表示首字节为 0（非法，需要 9 字节以上）。
function vintLength(firstByte) {
  if (firstByte === 0) return 0;
  let length = 1;
  for (let mask = 0x80; (firstByte & mask) === 0; mask >>= 1) length += 1;
  return length;
}

// 读 size 用的变长整数（值部分不含前导标记位）。
function readVint(buffer, offset) {
  if (offset >= buffer.length) throw new Error(`WebM fixture: unexpected end of file at offset ${offset}`);
  const length = vintLength(buffer[offset]);
  if (length === 0 || length > 8 || offset + length > buffer.length) {
    throw new Error(`WebM fixture: invalid variable-size integer at offset ${offset}`);
  }
  const valueBits = 0xff >> length;
  let value = buffer[offset] & valueBits;
  let unknown = value === valueBits;
  for (let i = 1; i < length; i += 1) {
    const byte = buffer[offset + i];
    value = value * 256 + byte;
    if (byte !== 0xff) unknown = false;
  }
  return { value, length, unknown };
}

// 读元素 ID：标记位本身属于 ID，原样拼接。
function readElementId(buffer, offset) {
  if (offset >= buffer.length) throw new Error(`WebM fixture: unexpected end of file at offset ${offset}`);
  const length = vintLength(buffer[offset]);
  if (length === 0 || length > 4 || offset + length > buffer.length) {
    throw new Error(`WebM fixture: invalid element id at offset ${offset}`);
  }
  let id = 0;
  for (let i = 0; i < length; i += 1) id = id * 256 + buffer[offset + i];
  return { id, length };
}

// 解析 offset 处的一个完整元素头。end 为其父元素的 content 边界。
function readElement(buffer, offset, end) {
  const id = readElementId(buffer, offset);
  const size = readVint(buffer, offset + id.length);
  const contentStart = offset + id.length + size.length;
  const contentEnd = size.unknown ? end : contentStart + size.value;
  if (contentEnd > end || contentStart > end) {
    throw new Error(`WebM fixture: element 0x${id.id.toString(16)} at offset ${offset} overruns its parent`);
  }
  return {
    id: id.id,
    idOffset: offset,
    idLength: id.length,
    sizeLength: size.length,
    sizeUnknown: size.unknown,
    contentStart,
    contentEnd,
  };
}

// 在 [start, end) 内按顺序找第一个目标子元素；遇到 unknown size 的兄弟元素就无法继续前进（返回 null）。
function findChild(buffer, start, end, targetId) {
  let offset = start;
  while (offset < end) {
    const element = readElement(buffer, offset, end);
    if (element.id === targetId) return element;
    if (element.sizeUnknown) return null;
    if (element.contentEnd <= offset) throw new Error(`WebM fixture: non-advancing element at offset ${offset}`);
    offset = element.contentEnd;
  }
  return null;
}

// 无符号整数元素的值（TimecodeScale 用）。
function readUnsignedElement(buffer, element) {
  const width = element.contentEnd - element.contentStart;
  if (width < 1 || width > 8) throw new Error(`WebM fixture: unexpected integer width ${width}`);
  let value = 0;
  for (let i = element.contentStart; i < element.contentEnd; i += 1) value = value * 256 + buffer[i];
  return value;
}

// 把 size 编成变长整数。preferredLength 用于尽量保持原有宽度，装不下才加宽。
function encodeSize(value, preferredLength) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`WebM fixture: invalid element size ${value}`);
  let length = preferredLength && preferredLength >= 1 && preferredLength <= 8 ? preferredLength : 1;
  while (length < 8 && value > Math.pow(2, 7 * length) - 2) length += 1;
  if (value > Math.pow(2, 7 * 8) - 2) throw new Error('WebM fixture: element size exceeds EBML limit');
  const encoded = Buffer.alloc(length);
  let remaining = value;
  for (let i = length - 1; i >= 0; i -= 1) {
    encoded[i] = remaining & 0xff;
    remaining = Math.floor(remaining / 256);
  }
  encoded[0] |= 0x80 >> (length - 1);
  return encoded;
}

// Duration 是 float64（8 字节 payload）。0x4489 的 ID 宽度 2 字节，size 恒为 8（单字节 VINT 0x88）。
function encodeDurationElement(durationValue) {
  const payload = Buffer.alloc(8);
  payload.writeDoubleBE(durationValue, 0);
  return Buffer.concat([Buffer.from([0x44, 0x89]), encodeSize(8, 1), payload]);
}

function readDurationValue(buffer, element) {
  const width = element.contentEnd - element.contentStart;
  if (width === 4) return buffer.readFloatBE(element.contentStart);
  if (width === 8) return buffer.readDoubleBE(element.contentStart);
  throw new Error(`WebM fixture: unsupported Duration width ${width}`);
}

// 从重建后的缓冲区里把刚写进去的 Duration 再读一遍，确认真的落盘且解析得回来。
function verifyInjectedDuration(buffer, expectedValue) {
  const segment = findChild(buffer, 0, buffer.length, ID_SEGMENT);
  if (!segment) throw new Error('WebM fixture: injected buffer lost its Segment element');
  const info = findChild(buffer, segment.contentStart, segment.contentEnd, ID_INFO);
  if (!info) throw new Error('WebM fixture: injected buffer lost its Info element');
  const duration = findChild(buffer, info.contentStart, info.contentEnd, ID_DURATION);
  if (!duration) throw new Error('WebM fixture: injected Duration element is not readable back');
  const actual = readDurationValue(buffer, duration);
  if (!Number.isFinite(actual) || Math.abs(actual - expectedValue) > Math.max(1e-6, Math.abs(expectedValue) * 1e-9)) {
    throw new Error(`WebM fixture: injected Duration read back as ${actual}, expected ${expectedValue}`);
  }
}

// 解析失败必须抛错：静默写出一份没修过的夹具会让上层测试变成随机红。
function injectWebmDuration(buffer, durationMs) {
  if (!Buffer.isBuffer(buffer)) throw new Error('WebM fixture: expected a Buffer');
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    throw new Error(`WebM fixture: invalid recording duration ${durationMs}`);
  }

  const segment = findChild(buffer, 0, buffer.length, ID_SEGMENT);
  if (!segment) throw new Error('WebM fixture: missing Segment element');
  const info = findChild(buffer, segment.contentStart, segment.contentEnd, ID_INFO);
  if (!info) throw new Error('WebM fixture: missing Info element inside Segment');

  const existing = findChild(buffer, info.contentStart, info.contentEnd, ID_DURATION);
  if (existing) {
    // 幂等：已有 Duration 就原样返回，不重复追加。
    verifyInjectedDuration(buffer, readDurationValue(buffer, existing));
    return { buffer, injected: false };
  }

  const scaleElement = findChild(buffer, info.contentStart, info.contentEnd, ID_TIMECODE_SCALE);
  const timecodeScale = scaleElement ? readUnsignedElement(buffer, scaleElement) : DEFAULT_TIMECODE_SCALE;
  if (!Number.isFinite(timecodeScale) || timecodeScale <= 0) {
    throw new Error(`WebM fixture: invalid TimecodeScale ${timecodeScale}`);
  }

  // Duration 的单位是 TimecodeScale，默认 1000000ns 时即等于毫秒。
  const durationValue = (durationMs * NANOSECONDS_PER_MILLISECOND) / timecodeScale;
  if (!Number.isFinite(durationValue) || durationValue <= 0) {
    throw new Error(`WebM fixture: duration ${durationMs}ms is not representable at TimecodeScale ${timecodeScale}`);
  }

  const durationElement = encodeDurationElement(durationValue);
  const content = buffer.subarray(info.contentStart, info.contentEnd);
  const sizeField = encodeSize(content.length + durationElement.length, info.sizeLength);

  const rebuilt = Buffer.concat([
    buffer.subarray(0, info.idOffset),
    buffer.subarray(info.idOffset, info.idOffset + info.idLength), // Info 的 ID，原样保留
    sizeField, // 换掉旧的 size 字段
    content,
    durationElement, // 追加在 Info 内容末尾 => 其后的字节整体后移
    buffer.subarray(info.contentEnd),
  ]);

  verifyInjectedDuration(rebuilt, durationValue);
  return { buffer: rebuilt, injected: true };
}

module.exports = {
  injectWebmDuration,
  encodeSize,
  readVint,
  readElementId,
  readElement,
  findChild,
  ID_SEGMENT,
  ID_INFO,
  ID_DURATION,
  ID_TIMECODE_SCALE,
  DEFAULT_TIMECODE_SCALE,
};

// ---------------------------------------------------------------------------
// Electron 夹具渲染进程的宿主。
// 只在真正的 Electron 主进程里启动；被纯 Node 单测 require 时必须彻底静默
// （进程无关的纯函数已经在上面的 module.exports 里暴露）。
// ---------------------------------------------------------------------------
function loadElectron() {
  if (!process.versions.electron) return null;
  if (process.env.ELECTRON_RUN_AS_NODE) return null;
  try {
    const electron = require('electron');
    return electron && electron.app && typeof electron.app.whenReady === 'function' ? electron : null;
  } catch (err) {
    return null;
  }
}

const electron = loadElectron();

if (!electron && require.main === module) {
  // 被当作主脚本启动、却拿不到 Electron 运行时：明确失败。
  // 静默空转会让 fork 的调用方一直等到超时，把"配置错"伪装成"夹具慢"。
  const reason = process.versions.electron
    ? 'Electron 主进程内无法加载 electron 模块（是否设置了 ELECTRON_RUN_AS_NODE？）'
    : '必须以 Electron 运行时启动（fork 的 execPath 需指向 electron 可执行文件）';
  if (process.send) process.send({ ok: false, error: `video-fixture-worker: ${reason}` });
  else console.error(`video-fixture-worker: ${reason}`);
  process.exit(1);
}

if (electron) {
  const { app, BrowserWindow } = electron;

  function send(message) {
    if (process.send) process.send(message);
  }

  app.whenReady().then(async () => {
    let window;
    try {
      const output = path.resolve(process.env.EAGLE_VIDEO_FIXTURE_OUTPUT || '');
      const workerFile = path.join(__dirname, 'video-fixture-worker.html');
      window = new BrowserWindow({
        show: false,
        webPreferences: {
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
          webSecurity: true,
        },
      });
      await window.loadFile(workerFile);
      const fixture = await window.webContents.executeJavaScript('window.createVideoFixture()', true);
      if (!fixture || typeof fixture !== 'object' || typeof fixture.dataUrl !== 'string') {
        throw new Error('Fixture renderer returned an unexpected result');
      }
      const match = /^data:video\/webm(?:;[^,]*)?;base64,(.+)$/s.exec(fixture.dataUrl);
      if (!match) throw new Error('Fixture renderer returned invalid WebM data');
      const raw = Buffer.from(match[1], 'base64');
      const { buffer: webm, injected } = injectWebmDuration(raw, Number(fixture.durationMs));
      fs.mkdirSync(path.dirname(output), { recursive: true });
      fs.writeFileSync(output, webm);
      send({ ok: true, output, durationMs: Number(fixture.durationMs), durationInjected: injected });
      app.exit(0);
    } catch (err) {
      send({ ok: false, error: err.message });
      app.exit(1);
    } finally {
      if (window && !window.isDestroyed()) window.destroy();
    }
  });

  app.on('window-all-closed', () => {});
}
