# -*- coding: utf-8 -*-
"""b1-9bu-B：video/audio 悬停播放复活手术
A. hoverPreview.ts 增段（插入 window facade 前）：
   - video part1（video-hover-preview.js 78-84 disarmHoverSentinel——vendor 提取片缺失，
     bu-A 模块 removeBoxAudioPlayer:107 裸调用的哑雷一并拆除）
   - video part2（86-475：decls + videoHoverSelector + enter/leave 绑定 + removeBoxVideoPlayer）
   - audio（buB-audio-hover-preview.js 7-216：enter 绑定 + 播放器 UI）
B. bundleGlobals.ts：videoHelper + getDurationString 供给（global.js 694-703/891-909 逐字；
   detailHooks 详情视频 seek 活雷同批修复）
所有断言写盘前拦截。
"""
import io, re

ROOT = r"H:\dev\Eagle-Sec-development - 副本"
VIDEO = ROOT + r"\src\app\js\hover-preview\video-hover-preview.js"
AUDIO = ROOT + r"\tests-tmp\buB-audio-hover-preview.js"
HP = ROOT + r"\src\app\react\core\hoverPreview.ts"
BG = ROOT + r"\src\app\react\core\bundleGlobals.ts"
GJ = ROOT + r"\src\app\js\global.js"


def read(p):
    with io.open(p, "r", encoding="utf-8-sig") as f:
        return f.read().replace("\r\n", "\n")


def write(p, text):
    with io.open(p, "w", encoding="utf-8", newline="\n") as f:
        f.write(text)


def brace_delta(text):
    return text.count("{") - text.count("}")


# ═══ A. hoverPreview.ts 增段 ═══
vlines = read(VIDEO).split("\n")
assert "function disarmHoverSentinel($box) {" in vlines[77], "part1 头异常: %r" % vlines[77]
assert vlines[83] == "}", "part1 尾异常: %r" % vlines[83]
assert vlines[85] == "// MP4 文件悬停自动播放", "part2 头异常: %r" % vlines[85]
assert vlines[86] == "var mouseoverVideoTimeout;", "part2 decl 异常: %r" % vlines[86]
assert "function removeBoxVideoPlayer(event) {" in vlines[442], "removeBoxVideoPlayer 定位异常"
part1 = "\n".join(vlines[77:84])
part2 = "\n".join(vlines[85:])

alines = read(AUDIO).split("\n")
assert alines[6].startswith("$(\"#box-container\").on('mouseenter', '.box.mp3"), "audio 段头异常: %r" % alines[6]
# audio 段裁剪：7-167（enter + 播放器 UI + mouseleave/dragstart 两绑定）+ 169（currentWindow
# hide 绑定）；171-174 removePlayingAudios 与 177-216 removeBoxAudioPlayer 为 vendor 已有
# 版本的重复声明——排除（模块 bu-A 已收 vendor 提取版）。
audio_a = "\n".join(alines[6:167])
assert alines[166].startswith("$(\"#box-container\").on('dragstart'"), "audio 绑定尾异常: %r" % alines[166]
assert alines[168] == "currentWindow.on('hide', removePlayingAudios);", "hide 绑定异常: %r" % alines[168]
audio_b = alines[168] + "   // b1-9bu-B：窗口隐藏即停播（audio-hover-preview.js 169 逐字）"
audio_seg = audio_a + "\n\n" + audio_b

seg = "\n\n// ── b1-9bu-B：video/audio 悬停播放复活 ─────────────────────────────────\n"
seg += "// video-hover-preview.js 78-84/86-475 + audio-hover-preview.js 7-167/169（b1-9s 误删，\n"
seg += "// git e8afdfc^ 取回）逐字搬迁。angular.element → _w.$bodyScope（b1-9d 同款）；drag\n"
seg += "// 三兄弟 → _w.?.（onDragStartContainer 族 React 世界尚未供给——网格拖拽独立缺口另批，\n"
seg += "// preventDefault 先行保证悬停视频拖拽阻断语义）；mouseX bundle 隐式全局显式化；\n"
seg += "// videoHelper/getDurationString → _w（bundleGlobals 本批供给）。\n"
seg += "// ── disarmHoverSentinel（video-hover-preview.js 78-84 逐字；vendor 提取片缺失，\n"
seg += "// 本模块 removeBoxAudioPlayer 裸调用的哑雷随本批拆除）──\n\n"
seg += part1 + "\n\n"
seg += "var mouseX;   // bundle 隐式全局显式化（strict 模式裸赋值即炸）\n\n"
seg += part2 + "\n\n// ── audio 悬停播放（audio-hover-preview.js 7-167/169 逐字）──\n"
seg += audio_seg

n0 = seg.count('var $scope = angular.element("body").scope();')
assert n0 == 3, "angular.element 赋值 %d 处（预期 3=video enter/video rBVP/audio enter）" % n0
seg = seg.replace('var $scope = angular.element("body").scope();',
                  'var $scope = _w.$bodyScope;   // b1-9bu-B：去 Angular（b1-9d 同款——$bodyScope 即 bundle 世界同对象）')

n0 = seg.count("angular.isNumber(")
assert n0 == 1, "angular.isNumber %d 处（预期 1）" % n0
seg = seg.replace("angular.isNumber(", "Number.isFinite(")   # b1-9av 同款换新

n0 = len(re.findall(r"(?<!_w\.)\$bodyScope\b", seg))
assert n0 >= 4, "段内 $bodyScope 裸引用过少: %d" % n0
seg = re.sub(r"(?<!_w\.)\$bodyScope\b", "_w.$bodyScope", seg)

n0 = len(re.findall(r"(?<!_w\.)\bvideoHelper\.", seg))
assert n0 == 1, "videoHelper %d 处（预期 1）" % n0
seg = re.sub(r"(?<!_w\.)\bvideoHelper\.", "_w.videoHelper.", seg)

n0 = len(re.findall(r"(?<!_w\.)\bgetDurationString\(", seg))
assert n0 == 2, "getDurationString %d 处（预期 2）" % n0
seg = re.sub(r"(?<!_w\.)\bgetDurationString\(", "_w.getDurationString(", seg)

n0 = len(re.findall(r"(?<!_w\.)\b(onDragStartContainer|onImageDrag|onDragEndContainer)\(", seg))
assert n0 == 6, "drag 三兄弟 %d 处（预期 6）" % n0
seg = re.sub(r"(?<!_w\.)\b(onDragStartContainer|onImageDrag|onDragEndContainer)\(", r"_w.\1?.(", seg)

n0 = len(re.findall(r"(?<!_w\.)\bplayingAudiosElements\b", seg))
assert n0 == 1, "audio 段 playingAudiosElements %d 处（预期 1=push）" % n0
seg = re.sub(r"(?<!_w\.)\bplayingAudiosElements\b", "_w.playingAudiosElements", seg)

# 段内终检（过滤注释行——段头注释含 angular.element 字样说明）
assert "angular.element" not in "\n".join(
    l for l in seg.split("\n") if not l.strip().startswith("//")
), "段内 angular 残留"
code = "\n".join(l for l in seg.split("\n") if not l.strip().startswith("//"))
assert re.search(r"(?<!_w\.)\bvideoHelper\b", code) is None
assert re.search(r"(?<!_w\.)\bgetDurationString\b", code) is None
assert re.search(r"(?<!_w\.)\bplayingAudiosElements\b", code) is None
assert re.search(r"(?<!_w\.)\$bodyScope\b", code) is None
for marker in [
    "function disarmHoverSentinel",
    "var videoHoverSelector",
    "function removeBoxVideoPlayer",
    'on(\'mouseenter\', videoHoverSelector',
    "on('mouseleave', videoHoverSelector, removeBoxVideoPlayer",
    "function fallbackToMpv",
    'document.createElement("mpv-video")',
    "'.box.mp3 .thumbnail",
    "autoplay-toggle",
    "audio-progress-bar-cursor",
    "currentWindow.on('hide', removePlayingAudios)",
]:
    assert marker in seg, "缺 marker: %s" % marker
assert "function removeBoxAudioPlayer" not in seg, "removeBoxAudioPlayer 重复声明混入"
assert "function removePlayingAudios" not in seg, "removePlayingAudios 重复声明混入"
assert seg.count("startHoverPreviewWatch($box)") == 2, "watch 调用（video 436 + audio 163）应 2 处"
n0 = code.count('$("#box-container").on(')
assert n0 == 5, "#box-container 绑定 %d 处（预期 5=video enter/leave + audio enter/leave/dragstart）" % n0
assert brace_delta(seg) == 0, "段 brace delta: %d" % brace_delta(seg)

# 合入模块（facade 注释前）
hp = read(HP)
hlines = hp.split("\n")
fidx = [i for i, l in enumerate(hlines) if l.startswith("// ── window facade")]
assert len(fidx) == 1, "facade 注释定位异常: %d" % len(fidx)
hlines[fidx[0]:fidx[0]] = seg.split("\n")
hp2 = "\n".join(hlines)
assert brace_delta(hp2) == brace_delta(hp) + brace_delta(seg), "合入 brace delta 不守恒"
assert hp2.count("var mouseX;") == 1
write(HP, hp2)
print("A. hoverPreview.ts 增段 OK（+%d 行）" % seg.count("\n"))

# ═══ B. bundleGlobals：videoHelper + getDurationString ═══
g = read(GJ).split("\n")
vh0 = [i for i, l in enumerate(g) if l.strip() == "var videoHelper = {"]
assert len(vh0) == 1, "videoHelper 定位异常"
vh1 = [i for i, l in enumerate(g) if i > vh0[0] and l.strip() == "}"]
vh_end = vh1[0]
assert g[vh0[0] + 2].strip().startswith("setCurrentTime: throttle(function setCurrentTime(v, currentTime)"), \
    "setCurrentTime 头异常: %r" % g[vh0[0] + 2]
video_helper_src = "\n".join(g[vh0[0]:vh_end + 1])

gd0 = [i for i, l in enumerate(g) if l.startswith("function getDurationString(number, total) {")]
assert len(gd0) == 1, "getDurationString 定位异常"
gd1 = [i for i, l in enumerate(g) if i > gd0[0] and l == "}"]
gd_end = gd1[0]
get_duration_src = "\n".join(g[gd0[0]:gd_end + 1])

vh_port = video_helper_src.replace("var videoHelper = {", "var _videoHelper = {")
n0 = vh_port.count("throttle(function setCurrentTime")
assert n0 == 2, "videoHelper throttle %d 处（预期 2）" % n0
vh_port = vh_port.replace("throttle(function setCurrentTime", "_throttle(function setCurrentTime")

b = read(BG)
blines = b.split("\n")
orig_delta = brace_delta(b)
tstart = [i for i, l in enumerate(blines) if l.strip() == "if (!w.throttle) w.throttle = _throttle;"]
assert len(tstart) == 1, "throttle 挂载行定位异常"
insert = [
    "",
    "  /* b1-9bu-B：videoHelper（global.js 694-703 逐字；throttle → bundle 2400 helper _throttle——",
    "     global.js 已退役不再加载，bundleGlobals 供给；detailHooks 详情视频 seek 的",
    "     window.videoHelper 活雷同批修复） */",
    "  " + vh_port.replace("\n", "\n  "),
    "  if (!w.videoHelper) w.videoHelper = _videoHelper;",
    "",
    "  /* b1-9bu-B：getDurationString（global.js 891-909 逐字；悬停播放 current-time 依赖） */",
    "  " + get_duration_src.replace("function getDurationString(", "function _getDurationString(").replace("\n", "\n  "),
    "  if (!w.getDurationString) w.getDurationString = _getDurationString;",
]
blines[tstart[0] + 1:tstart[0] + 1] = insert

# present 诊断名单补两名
pstart = [i for i, l in enumerate(blines) if l.strip() == "'guid', 'throttle', 'debounce', 'fuzzy_match', 'decodeBase64Image', 'cloneTree', 'getHashID',"]
assert len(pstart) == 1, "present 名单锚点异常"
blines[pstart[0]] = blines[pstart[0]].replace("'guid', 'throttle',", "'guid', 'videoHelper', 'getDurationString', 'throttle',")

b2 = "\n".join(blines)
assert b2.count("if (!w.videoHelper) w.videoHelper = _videoHelper;") == 1
assert b2.count("if (!w.getDurationString) w.getDurationString = _getDurationString;") == 1
assert b2.count("_throttle(function setCurrentTime") == 2
assert b2.count("var mouseX;") == 0  # mouseX 只属 hoverPreview 模块
assert brace_delta(b2) == orig_delta, "bundleGlobals brace delta 漂移"
write(BG, b2)
print("B. bundleGlobals videoHelper/getDurationString 供给 OK")
print("ALL OK")
