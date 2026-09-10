# -*- coding: utf-8 -*-
"""b1-9bu-C：youtube/vimeo iframe 悬停预览复活手术
hoverPreview.ts 增段：youtube-hover-preview.js 全文（303）+ vimeo-hover-preview.js 全文（291）
逐字搬迁（b1-9s 误删、git e8afdfc^ 取回；bilibili 为 site isolation 时代移除桩，无可移植）。
angular.element ×4 → _w.$bodyScope（b1-9d 同款）；getDurationString → _w；drag 三兄弟 ×6 → _w.?.
断言写盘前拦截。
"""
import io, re

ROOT = r"H:\dev\Eagle-Sec-development - 副本"
YT = ROOT + r"\tests-tmp\buB-youtube-hover-preview.js"
VM = ROOT + r"\tests-tmp\buB-vimeo-hover-preview.js"
HP = ROOT + r"\src\app\react\core\hoverPreview.ts"


def read(p):
    with io.open(p, "r", encoding="utf-8-sig") as f:
        return f.read().replace("\r\n", "\n")


def write(p, text):
    with io.open(p, "w", encoding="utf-8", newline="\n") as f:
        f.write(text)


def brace_delta(text):
    return text.count("{") - text.count("}")


yt = read(YT).rstrip("\n")
vm = read(VM).rstrip("\n")
assert yt.count('$("#box-container").on(') == 2, "yt 绑定数异常"
assert vm.count('$("#box-container").on(') == 2, "vm 绑定数异常"
assert "window.addEventListener('message', _onYouTubeMessage);" in yt
assert "window.addEventListener('message', _onVimeoMessage);" in vm

seg = "\n\n// ── b1-9bu-C：youtube/vimeo iframe 悬停预览复活 ───────────────────────────\n"
seg += "// youtube-hover-preview.js 1-303 + vimeo-hover-preview.js 1-291（b1-9s 误删，git\n"
seg += "// e8afdfc^ 取回）全文逐字搬迁。bilibili-hover-preview.js 为 site isolation 时代移除\n"
seg += "// 桩（3 行注释），无可移植。angular.element ×4 → _w.$bodyScope（b1-9d 同款）；\n"
seg += "// getDurationString → _w；drag 三兄弟 ×6 → _w.?.（同 bu-B 录档）；_ytPlayerState/\n"
seg += "// _vimeoPlayerState 为模块闭包 var——本模块 cleanupBoxHoverPreview 的 bare typeof\n"
seg += "// 清理引用与 handlers 同 install 作用域（var 提升语义一致）。\n"

seg += "\n// ── youtube 悬停预览（全文逐字）──\n" + yt
seg += "\n\n// ── vimeo 悬停预览（全文逐字）──\n" + vm

n0 = seg.count('let $scope = angular.element("body").scope();')
assert n0 == 4, "angular.element 赋值 %d 处（预期 4）" % n0
seg = seg.replace('let $scope = angular.element("body").scope();',
                  'let $scope = _w.$bodyScope;   // b1-9bu-C：去 Angular（b1-9d 同款）')

n0 = len(re.findall(r"(?<!_w\.)\$bodyScope\b", seg))
assert n0 >= 4, "段内 $bodyScope 裸引用过少: %d" % n0
seg = re.sub(r"(?<!_w\.)\$bodyScope\b", "_w.$bodyScope", seg)

n0 = len(re.findall(r"(?<!_w\.)\bgetDurationString\(", seg))
assert n0 == 4, "getDurationString %d 处（预期 4）" % n0
seg = re.sub(r"(?<!_w\.)\bgetDurationString\(", "_w.getDurationString(", seg)

n0 = len(re.findall(r"(?<!_w\.)\b(onDragStartContainer|onImageDrag|onDragEndContainer)\(", seg))
assert n0 == 6, "drag 三兄弟 %d 处（预期 6）" % n0
seg = re.sub(r"(?<!_w\.)\b(onDragStartContainer|onImageDrag|onDragEndContainer)\(", r"_w.\1?.(", seg)

assert "angular.element" not in "\n".join(
    l for l in seg.split("\n") if not l.strip().startswith("//")
), "段内 angular 残留"
code = "\n".join(l for l in seg.split("\n") if not l.strip().startswith("//"))
assert re.search(r"(?<!_w\.)\$bodyScope\b", code) is None
assert re.search(r"(?<!_w\.)\bgetDurationString\b", code) is None
for marker in [
    "var youtubeMouseoverVideoTimeout;",
    "var vimeoMouseoverVideoTimeout;",
    "var _ytPlayerState = {};",
    "var _vimeoPlayerState = {};",
    "function ytPostCommand(",
    "function vimeoPostMessage(",
    "window.addEventListener('message', _onYouTubeMessage);",
    "window.addEventListener('message', _onVimeoMessage);",
    "'.box.url.youtube .thumbnail'",
    "'.box.url.vimeo .thumbnail'",
    "youtube-nocookie.com/embed/",
    "player.vimeo.com/video/",
]:
    assert marker in seg, "缺 marker: %s" % marker
n0 = code.count('$("#box-container").on(')
assert n0 == 4, "#box-container 绑定 %d 处（预期 4）" % n0
assert brace_delta(seg) == 0, "段 brace delta: %d" % brace_delta(seg)

hp = read(HP)
hlines = hp.split("\n")
fidx = [i for i, l in enumerate(hlines) if l.startswith("// ── window facade")]
assert len(fidx) == 1, "facade 注释定位异常"
pre_delta = brace_delta(hp)
hlines[fidx[0]:fidx[0]] = seg.split("\n")
hp2 = "\n".join(hlines)
assert brace_delta(hp2) == pre_delta + brace_delta(seg), "合入 brace delta 不守恒"
assert hp2.count("startHoverPreviewWatch($box)") == 5, "watch 应 5 处（1 定义 + video/audio/yt/vm 4 调用）"
write(HP, hp2)
print("bu-C 增段 OK（+%d 行）" % seg.count("\n"))
print("ALL OK")
