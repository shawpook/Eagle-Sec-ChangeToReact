/**
 * M8-2：视频夹具 WebM Duration 注入的纯 Node 单测。
 *
 * 被测对象：tests/video-fixture-worker.cjs 导出的 injectWebmDuration()。
 * 它给 MediaRecorder 产出的 WebM 在 Segment > Info 里补一个 float64 的 Duration，
 * 否则 Chromium 恒报 video.duration === Infinity，原生 <video> 分支永远不被走到。
 *
 * 本测试不起 Electron，只用一份按真实 MediaRecorder 布局手搓的最小 WebM 样本做字节级断言：
 *   - 样本注入前 Info 里确实没有 Duration（0x4489）；
 *   - 注入后 Duration 存在、值等于本次录制时长、Info 的 size 字段同步增长且仍自洽；
 *   - 其后字节整体后移且逐字不变（重建缓冲区，而非原地 patch）；
 *   - 幂等：已有 Duration 时不重复追加；
 *   - 解析失败必须抛错，不产出"没修过的"夹具。
 *
 * 运行：
 *   node tests/video-fixture-duration.mjs                     # 正常跑，全绿
 *   node tests/video-fixture-duration.mjs --negative-control  # 负向自证：把注入换成恒等函数，断言必须整体跑红
 */
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const {
  injectWebmDuration: realInjectWebmDuration,
  encodeSize,
  findChild,
  ID_SEGMENT,
  ID_INFO,
  ID_DURATION,
} = require(path.join(projectRoot, 'tests', 'video-fixture-worker.cjs'));

// 可替换绑定：负向控制把它换成恒等函数，同一组断言应当整体变红。
let injectWebmDuration = realInjectWebmDuration;

// --- 最小 WebM 样本：布局对齐真实 MediaRecorder 产物 -----------------------------
// 真实产物实测结构：EBML Header →（无 SeekHead / 无 Cues）→ Segment(unknown size) →
// Info{TimecodeScale, MuxingApp, WritingApp} → Tracks → Cluster(unknown size)。
// 这里保留同样的形状，Cluster 里塞两个假 SimpleBlock，用来验证"其后字节整体后移"。

function vint(value, length) {
  const encoded = Buffer.alloc(length);
  let remaining = value;
  for (let i = length - 1; i >= 0; i -= 1) {
    encoded[i] = remaining & 0xff;
    remaining = Math.floor(remaining / 256);
  }
  encoded[0] |= 0x80 >> (length - 1);
  return encoded;
}

function uint(value, width) {
  const encoded = Buffer.alloc(width);
  let remaining = value;
  for (let i = width - 1; i >= 0; i -= 1) {
    encoded[i] = remaining & 0xff;
    remaining = Math.floor(remaining / 256);
  }
  return encoded;
}

function element(idBytes, payload) {
  return Buffer.concat([idBytes, vint(payload.length, 1), payload]);
}

const UNKNOWN_SIZE = Buffer.from([0x01, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]);

function buildSampleWebm() {
  const ebmlHeader = element(
    Buffer.from([0x1a, 0x45, 0xdf, 0xa3]),
    Buffer.concat([
      element(Buffer.from([0x42, 0x86]), uint(1, 1)), // EBMLVersion
      element(Buffer.from([0x42, 0xf7]), uint(1, 1)), // EBMLReadVersion
      element(Buffer.from([0x42, 0xf2]), uint(4, 1)), // EBMLMaxIDLength
      element(Buffer.from([0x42, 0xf3]), uint(8, 1)), // EBMLMaxSizeLength
      element(Buffer.from([0x42, 0x82]), Buffer.from('webm', 'latin1')), // DocType
      element(Buffer.from([0x42, 0x87]), uint(4, 1)), // DocTypeVersion
      element(Buffer.from([0x42, 0x85]), uint(2, 1)), // DocTypeReadVersion
    ]),
  );

  // Info：与真实产物逐字同构 —— 有 TimecodeScale/MuxingApp/WritingApp，没有 Duration。
  const info = element(
    Buffer.from([0x15, 0x49, 0xa9, 0x66]),
    Buffer.concat([
      element(Buffer.from([0x2a, 0xd7, 0xb1]), uint(1000000, 3)), // TimecodeScale = 1ms
      element(Buffer.from([0x4d, 0x80]), Buffer.from('Chrome', 'latin1')), // MuxingApp
      element(Buffer.from([0x57, 0x41]), Buffer.from('Chrome', 'latin1')), // WritingApp
    ]),
  );

  const trackEntry = element(
    Buffer.from([0xae]),
    Buffer.concat([
      element(Buffer.from([0xd7]), uint(1, 1)), // TrackNumber
      element(Buffer.from([0x73, 0xc5]), uint(1, 1)), // TrackUID
      element(Buffer.from([0x83]), uint(1, 1)), // TrackType = video
      element(Buffer.from([0x86]), Buffer.from('V_VP8', 'latin1')), // CodecID
    ]),
  );
  const tracks = element(Buffer.from([0x16, 0x54, 0xae, 0x6b]), trackEntry);

  // Cluster 用 unknown size（与 MediaRecorder 一致），内容是一段可辨识的假块负载。
  const clusterBody = Buffer.concat([
    element(Buffer.from([0xe7]), uint(0, 1)), // Timecode
    element(Buffer.from([0xa3]), Buffer.from('block-one-payload', 'latin1')),
    element(Buffer.from([0xa3]), Buffer.from('block-two-payload', 'latin1')),
  ]);
  const cluster = Buffer.concat([Buffer.from([0x1f, 0x43, 0xb6, 0x75]), UNKNOWN_SIZE, clusterBody]);

  const segmentBody = Buffer.concat([info, tracks, cluster]);
  const segment = Buffer.concat([Buffer.from([0x18, 0x53, 0x80, 0x67]), UNKNOWN_SIZE, segmentBody]);

  return Buffer.concat([ebmlHeader, segment]);
}

function infoElement(buffer) {
  const segment = findChild(buffer, 0, buffer.length, ID_SEGMENT);
  assert.ok(segment, '样本应当含 Segment');
  const info = findChild(buffer, segment.contentStart, segment.contentEnd, ID_INFO);
  assert.ok(info, '样本应当含 Info');
  return info;
}

function readDurationMs(buffer) {
  const info = infoElement(buffer);
  const duration = findChild(buffer, info.contentStart, info.contentEnd, ID_DURATION);
  assert.ok(duration, 'Info 里应当存在 Duration 元素');
  assert.equal(duration.contentEnd - duration.contentStart, 8, 'Duration 应当是 float64');
  // TimecodeScale = 1000000ns = 1ms，故 EBML 值即为毫秒数。
  return buffer.readDoubleBE(duration.contentStart);
}

// --- 断言集：正反两向共用同一份 ---------------------------------------------------
// injectorDependent=false 的是"前置自证 / 纯编码器自检"，它们本就不经过注入器，
// 负向控制模式下不作为"必须跑红"的期望对象。

const RECORDED_MS = 1234.5;

const checks = [
  {
    name: '样本注入前不含 Duration（前置自证）',
    injectorDependent: false,
    check() {
      const sample = buildSampleWebm();
      const info = infoElement(sample);
      assert.equal(findChild(sample, info.contentStart, info.contentEnd, ID_DURATION), null, '注入前不该有 Duration');
    },
  },
  {
    name: '注入后 Duration 存在且值正确',
    injectorDependent: true,
    check() {
      const { buffer, injected } = injectWebmDuration(buildSampleWebm(), RECORDED_MS);
      assert.equal(injected, true, '应当报告完成注入');
      assert.equal(readDurationMs(buffer), RECORDED_MS, 'Duration 应当等于本次录制时长');
    },
  },
  {
    name: 'Info 的 size 字段随之增长且仍自洽',
    injectorDependent: true,
    check() {
      const sample = buildSampleWebm();
      const { buffer } = injectWebmDuration(sample, RECORDED_MS);
      const before = infoElement(sample);
      const after = infoElement(buffer);
      assert.equal(
        after.contentEnd - after.contentStart,
        before.contentEnd - before.contentStart + 11,
        'Info 内容应当恰好多出 11 字节（Duration：2 字节 ID + 1 字节 size + 8 字节 float64）',
      );
      // size 字段必须覆盖到新内容末尾：下一个兄弟元素（Tracks）应当紧跟在 Info 之后。
      assert.equal(buffer.readUInt32BE(after.contentEnd), 0x1654ae6b, 'Info 之后应当紧接 Tracks');
    },
  },
  {
    name: 'Info 之后的字节整体后移且逐字不变',
    injectorDependent: true,
    check() {
      const sample = buildSampleWebm();
      const { buffer } = injectWebmDuration(sample, RECORDED_MS);
      const before = infoElement(sample);
      const after = infoElement(buffer);
      assert.equal(after.contentEnd - before.contentEnd, 11, '后移量应当等于 Duration 元素长度');
      assert.deepEqual(buffer.subarray(after.contentEnd), sample.subarray(before.contentEnd), 'Info 之后的所有字节必须逐字不变');
      // Info 的 ID 之前（含 EBML Header、Segment 头）必须逐字不变；ID 本身也不变。
      // 注意 Info 的 size 字段本就应当变化，故只比较到 idOffset。
      assert.deepEqual(buffer.subarray(0, after.idOffset), sample.subarray(0, before.idOffset), 'Info 的 ID 之前的字节必须逐字不变');
      assert.deepEqual(
        buffer.subarray(after.idOffset, after.idOffset + after.idLength),
        sample.subarray(before.idOffset, before.idOffset + before.idLength),
        'Info 的 ID 必须原样保留',
      );
      assert.equal(buffer.length, sample.length + 11, '整体长度应当恰好多出 11 字节');
    },
  },
  {
    name: 'TimecodeScale 非默认值时按刻度换算而不写死毫秒',
    injectorDependent: true,
    check() {
      const sample = buildSampleWebm();
      // 把 TimecodeScale 改成 500000ns（0.5ms），同一条时长的 EBML 值应当翻倍。
      const scaleOffset = sample.indexOf(Buffer.from([0x2a, 0xd7, 0xb1, 0x83, 0x0f, 0x42, 0x40]));
      assert.ok(scaleOffset > 0, '样本应当含默认 TimecodeScale=1000000');
      const custom = Buffer.from(sample);
      custom.writeUIntBE(500000, scaleOffset + 4, 3);
      const { buffer } = injectWebmDuration(custom, 1000);
      assert.equal(readDurationMs(buffer), 2000, 'TimecodeScale=500000 时 1000ms 应当记作 2000 刻度');
    },
  },
  {
    name: '幂等：已有 Duration 时不重复追加',
    injectorDependent: true,
    check() {
      const first = injectWebmDuration(buildSampleWebm(), RECORDED_MS);
      const second = injectWebmDuration(first.buffer, 999);
      assert.equal(second.injected, false, '第二次调用不应再次注入');
      assert.ok(second.buffer.equals(first.buffer), '第二次调用必须原样返回缓冲区');
      assert.equal(readDurationMs(second.buffer), RECORDED_MS, '已有 Duration 不得被改写');
    },
  },
  {
    name: '解析失败必须抛错（不产出没修的夹具）',
    injectorDependent: true,
    check() {
      assert.throws(() => injectWebmDuration(buildSampleWebm().subarray(0, 8), 1000), /WebM fixture:/, '截断输入必须抛错');
      assert.throws(() => injectWebmDuration(buildSampleWebm(), 0), /invalid recording duration/, '零时长必须抛错');
      assert.throws(() => injectWebmDuration(buildSampleWebm(), Number.POSITIVE_INFINITY), /invalid recording duration/, '非有限时长必须抛错');
      assert.throws(() => injectWebmDuration(buildSampleWebm(), Number.NaN), /invalid recording duration/, 'NaN 时长必须抛错');
      assert.throws(() => injectWebmDuration('not-a-buffer', 1000), /expected a Buffer/, '非缓冲区必须抛错');
    },
  },
  {
    name: 'encodeSize 的宽度跃迁正确（纯编码器自检）',
    injectorDependent: false,
    check() {
      assert.deepEqual(encodeSize(36, 1), Buffer.from([0xa4]), '36 应当保持单字节');
      assert.deepEqual(encodeSize(126, 1), Buffer.from([0xfe]), '126 是单字节上限');
      assert.deepEqual(encodeSize(127, 1), Buffer.from([0x40, 0x7f]), '127 必须升到双字节（0xff 是 unknown size 标记）');
    },
  },
];

function format(err) {
  return String(err && err.stack ? err.stack : err).replace(/^/gm, '    ');
}

// --- 负向控制：注入换成恒等函数，依赖注入器的断言必须整体跑红 ---------------------

if (process.argv.includes('--negative-control')) {
  injectWebmDuration = (buffer) => ({ buffer, injected: false }); // 恒等替身：等价于"注入完全没生效"
  const expected = checks.filter((entry) => entry.injectorDependent);
  const survived = [];
  for (const entry of expected) {
    try {
      entry.check();
      survived.push(entry.name);
    } catch (err) {
      console.log(`[negative-control] 断言「${entry.name}」如预期跑红 —— 原始报错原文：`);
      console.log(format(err));
    }
  }
  if (survived.length) {
    console.error(`NEGATIVE_CONTROL_FAIL 以下断言在恒等注入下仍然变绿，说明它们没有牙齿：${JSON.stringify(survived)}`);
    process.exit(1);
  }
  console.log(`NEGATIVE_CONTROL_OK ${expected.length}/${expected.length} 条依赖注入器的断言在恒等注入下全部跑红`);
  process.exit(0);
}

let failed = 0;
for (const entry of checks) {
  try {
    entry.check();
    console.log(`  ok   ${entry.name}`);
  } catch (err) {
    failed += 1;
    console.error(`  FAIL ${entry.name}`);
    console.error(format(err));
  }
}
if (failed) {
  console.error(`VIDEO_FIXTURE_DURATION_FAIL ${failed}/${checks.length} 条断言失败`);
  process.exit(1);
}
console.log(`VIDEO_FIXTURE_DURATION_OK ${checks.length} 条断言全绿（样本 ${buildSampleWebm().length} 字节）`);
