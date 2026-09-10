# -*- coding: utf-8 -*-
"""b1-9bu-A：hover-preview 家族接管手术
A. 生成 src/app/react/core/hoverPreview.ts（vendor 494 行逐字 install 化 + Z 键段回填 + 声明补齐）
B. bundleGlobals.ts：c16b fetch 块摘除、两个 if-absent 重复定义删除、install 调用 + import
C. controllerFns.ts：HoverPreviewKeydown = false 裸赋值 strict-mode 拆雷
所有断言在写盘前拦截。
"""
import io, re, sys

ROOT = r"H:\dev\Eagle-Sec-development - 副本"
VENDOR = ROOT + r"\frontend\public\vendor\eagle-hover-preview.js"
OLDJS = ROOT + r"\src\app\js\hover-preview.js"
OUT = ROOT + r"\src\app\react\core\hoverPreview.ts"
BG = ROOT + r"\src\app\react\core\bundleGlobals.ts"
CF = ROOT + r"\src\app\react\core\controllerFns.ts"


def read(p):
    with io.open(p, "r", encoding="utf-8-sig") as f:
        return f.read().replace("\r\n", "\n")


def write(p, text):
    with io.open(p, "w", encoding="utf-8", newline="\n") as f:
        f.write(text)


def find_line(lines, pred, desc, lo=0, hi=None):
    hi = len(lines) if hi is None else hi
    hits = [i for i in range(lo, hi) if pred(lines[i])]
    assert len(hits) == 1, "find_line 非唯一命中 [%s]: %d 处" % (desc, len(hits))
    return hits[0]


def block_end(lines, start_idx):
    """start_idx 行含首 '{'，返回配对 '}' 行 idx（粗扫，块内字符串无花括号才可用）"""
    depth = 0
    started = False
    for i in range(start_idx, len(lines)):
        for ch in lines[i]:
            if ch == "{":
                depth += 1
                started = True
            elif ch == "}":
                depth -= 1
                if started and depth == 0:
                    return i
    raise AssertionError("block_end 未找到配对闭括号")


def brace_delta(text):
    return text.count("{") - text.count("}")


# ═══ A. 生成 hoverPreview.ts ═══
vendor = read(VENDOR)
vlines = vendor.split("\n")
assert vlines[0].startswith("// b1-9aw"), "vendor 头注释异常: %r" % vlines[0]
assert "function cleanupBoxHoverPreview" in vendor
assert vendor.rstrip().endswith("});"), "vendor 尾异常"

oldjs = read(OLDJS)
jlines = oldjs.split("\n")
zstart = find_line(jlines, lambda l: l.startswith('$(window).on("keydown.hover-preview"'), "Z keydown 绑定头")
assert jlines[-1] == "});", "旧 js 尾行异常: %r" % jlines[-1]
zblock = jlines[zstart:]
assert sum(1 for l in zblock if "keyCode === 90" in l) == 2, "Z 段 keyCode 计数异常"

# ── 替换（vendor 体）──
body = vendor
n0 = body.count("var HoverPreviewKeydown = false;")
assert n0 == 1, "HoverPreviewKeydown 声明 %d 处" % n0
body = body.replace("var HoverPreviewKeydown = false;", "_w.HoverPreviewKeydown = false;")

n0 = len(re.findall(r"(?<!_w\.)\bHoverPreviewKeydown\b", body))
assert n0 == 2, "vendor 体剩余 HoverPreviewKeydown %d 处（预期 2=435 注释+453 守卫）" % n0
body = re.sub(r"(?<!_w\.)\bHoverPreviewKeydown\b", "_w.HoverPreviewKeydown", body)

n0 = body.count("var updateCursorInterval;")
assert n0 == 1
body = body.replace(
    "var updateCursorInterval;",
    "var updateCursorInterval;\nvar mouseoverAudioProgressTimeout;   // b1-9bu-A：提取片缺失声明补齐（vendor:116 裸引用全仓无声明）",
)

n0 = len(re.findall(r"(?<!_w\.)\bplayingAudiosElements\b", body))
assert n0 == 4, "playingAudiosElements 裸引用 %d 处（预期 4）" % n0
body = re.sub(r"(?<!_w\.)\bplayingAudiosElements\b", "_w.playingAudiosElements", body)

n0 = len(re.findall(r"(?<!_w\.)\$bodyScope\b", body))
assert n0 == 6, "vendor $bodyScope 裸引用 %d 处（预期 6=5 代码+1 注释）" % n0
body = re.sub(r"(?<!_w\.)\$bodyScope\b", "_w.$bodyScope", body)

# ── 替换（Z 段）──
ztext = "\n".join(zblock)
n0 = len(re.findall(r"(?<!_w\.)\bHoverPreviewKeydown\b", ztext))
assert n0 == 3, "Z 段 HoverPreviewKeydown %d 处（预期 3）" % n0
ztext = re.sub(r"(?<!_w\.)\bHoverPreviewKeydown\b", "_w.HoverPreviewKeydown", ztext)
n0 = len(re.findall(r"(?<!_w\.)\$bodyScope\b", ztext))
assert n0 == 1, "Z 段 $bodyScope %d 处（预期 1）" % n0
ztext = re.sub(r"(?<!_w\.)\$bodyScope\b", "_w.$bodyScope", ztext)

zheader = (
    "\n// ── b1-9bu-A：Z 键监听回填（js/hover-preview.js 361-387 逐字；b1-9am 提取片缺失段，\n"
    "// Z 键悬停预览自 React 切换起死——本段即复活路径；$bodyScope/HoverPreviewKeydown → _w）──"
)

facade = (
    "\n\n// ── window facade（classic script 顶层声明→window 属性语义等价；消费点零改动：\n"
    "// dataMachinery w.HoverPreview/w.removePlayingAudios、itemMenuService removePlayingAudios、\n"
    "// controllerFns HoverPreview.isShow/HoverPreviewKeydown、gridDirectives delete lastElem）──\n"
    "_w.cleanupBoxHoverPreview = cleanupBoxHoverPreview;\n"
    "_w.startHoverPreviewWatch = startHoverPreviewWatch;\n"
    "_w.removePlayingAudios = removePlayingAudios;\n"
    "_w.removeBoxAudioPlayer = removeBoxAudioPlayer;\n"
    "_w.HoverPreview = HoverPreview;"
)

header = """/**
 * b1-9bu-A：/vendor/eagle-hover-preview.js 剥壳归位——悬浮预览家族逐字搬迁 install 化
 * （vendor 494 行全量 + js/hover-preview.js Z 键监听段回填——b1-9am 按函数选拼提取时
 * 绑定段落在区间外，Z 键悬停预览自 React 切换起死，b1-9aw 仅回填声明未到位；
 * 考据定案见 PROGRESS「P2-bu」。mouseoverAudioProgressTimeout 为提取片缺失声明补齐
 * （vendor:116 裸引用、全仓无声明，removeBoxAudioPlayer 一调用即 ReferenceError 的哑雷）。
 * 过渡期保留面：$ / FileUrlHelper / throttle 裸标识经 window（bundleGlobals 供给，bl 同款；
 * throttle 必须 bundle 2400 helper——签名 fn/delay/immediate，与 utils/func 版不同）；
 * $bodyScope / playingAudiosElements / HoverPreviewKeydown 显式 _w 前缀（跨世界共享存储：
 * openItemContextMenu 与 controllerFns 清理点同源）。vendor 脚本与 c16b fetch 注入/
 * if-absent 重复定义随本批退役；install 由 bundleGlobals 在 _throttle 挂载后同步调用。
 */
// @ts-nocheck

const _w: any = window as any;

let installed = false;

export function installHoverPreview(): void {
  if (installed) return;
  installed = true;

"""

module = header + body + "\n" + zheader + "\n" + ztext + "\n" + facade + "\n}\n"

# ── 终检（纯代码段：过滤注释行——body/facade 注释含裸名说明）──
code = "\n".join(
    l for l in (body + "\n" + ztext + "\n" + facade).split("\n")
    if not l.strip().startswith("//")
)
assert re.search(r"(?<!_w\.)\bplayingAudiosElements\b", code) is None
assert re.search(r"(?<!_w\.)\bHoverPreviewKeydown\b", code) is None
assert re.search(r"(?<!_w\.)\$bodyScope\b", code) is None
for marker in [
    "function cleanupBoxHoverPreview",
    "function startHoverPreviewWatch",
    "function removePlayingAudios",
    "function removeBoxAudioPlayer",
    "var HoverPreview = {",
    'on("keydown.hover-preview"',
    'on("keyup.hover-preview"',
]:
    assert marker in code, "缺 marker: %s" % marker
n0 = code.count('$("body").on(')
assert n0 == 4, "body 绑定 %d 处（预期 4）" % n0
assert code.count("mouseoverAudioProgressTimeout") == 2, "补齐声明未到位"
assert brace_delta(module) == 0, "brace delta != 0: %d" % brace_delta(module)

write(OUT, module)
print("A. hoverPreview.ts 写入 OK（%d 行）" % module.count("\n"))

# ═══ B. bundleGlobals.ts 手术 ═══
bg = read(BG)
blines = bg.split("\n")
orig_delta = brace_delta(bg)

# B1. c16b fetch 块摘除（注释头 3 行 + if 块）
cstart = find_line(blines, lambda l: "c16b：hover-preview 子系统" in l, "c16b 注释头")
ifstart = find_line(blines, lambda l: l.strip() == "if (!w.HoverPreview) {", "c16b if 头", cstart, cstart + 6)
cend = block_end(blines, ifstart)
assert "hover-preview fetch failed" in blines[cend - 2], "c16b 块尾异常: %r" % blines[cend - 2]

marker = [
    "  // ── c16b→b1-9bu-A：hover-preview 注入块退役 ─────────────────────────────",
    "  // 原 fetch('/vendor/eagle-hover-preview.js') 注入 + cleanupBoxHoverPreview/",
    "  // removePlayingAudios if-absent 重复定义已摘除——改由 react/core/hoverPreview.ts",
    "  // installHoverPreview() 同步供给（消 load 竞态）；安装点在 _throttle 挂载之后",
    "  // （vendor body 委托绑定 install 期即以裸 throttle 实例化，bundle 2400 helper",
    "  // 签名 fn/delay/immediate 与 utils/func 版不同，不可换用）。",
]
blines[cstart : cend + 1] = marker

# B2. cleanupBoxHoverPreview if-absent 删除
kstart = find_line(blines, lambda l: "cleanupBoxHoverPreview（bundle 50414-50457 逐字" in l, "cleanup if-absent 注释")
kif = find_line(blines, lambda l: l.strip() == "if (!w.cleanupBoxHoverPreview) {", "cleanup if 头", kstart, kstart + 3)
kend = block_end(blines, kif)
assert kend == kstart + 46, "cleanup 块长异常: %d" % (kend - kstart)
del blines[kstart : kend + 1]

# B3. removePlayingAudios if-absent 删除
rstart = find_line(blines, lambda l: "removePlayingAudios（bundle 51042-51045 逐字）" in l, "rPA if-absent 注释")
rif = find_line(blines, lambda l: l.strip() == "if (!w.removePlayingAudios) {", "rPA if 头", rstart, rstart + 3)
rend = block_end(blines, rif)
assert rend == rstart + 7, "rPA 块长异常: %d" % (rend - rstart)
del blines[rstart : rend + 1]

# B4. install 调用（_throttle 挂载后）
tstart = find_line(blines, lambda l: l.strip() == "if (!w.throttle) w.throttle = _throttle;", "throttle 挂载行")
inst = [
    "",
    "  // b1-9bu-A：hover-preview 家族同步安装（原 c16b 注入块退役；Z 键监听段随 install 回填）",
    "  installHoverPreview();",
    "  if (w.__eagleBundleGlobals) w.__eagleBundleGlobals.hoverPreviewLoaded = true;",
]
blines[tstart + 1 : tstart + 1] = inst

# B5. import
istart = find_line(blines, lambda l: l.startswith("import { get } from '../utils/lang';"), "utils/lang import")
blines.insert(istart + 1, "import { installHoverPreview } from './hoverPreview';")

bg2 = "\n".join(blines)
assert "if (!w.HoverPreview)" not in bg2, "c16b if 残留"
assert "w.cleanupBoxHoverPreview = function" not in bg2, "cleanup if-absent 残留"
assert "w.removePlayingAudios = function" not in bg2, "rPA if-absent 残留"
assert bg2.count("if (!w.playingAudiosElements) w.playingAudiosElements = [];") == 1, "playingAudiosElements 初始化必须保留"
assert bg2.count("installHoverPreview();") == 1
assert bg2.count("import { installHoverPreview } from './hoverPreview';") == 1
assert brace_delta(bg2) == orig_delta, "bundleGlobals brace delta 漂移"

write(BG, bg2)
print("B. bundleGlobals.ts 手术 OK（c16b 摘除 + 双 if-absent 删除 + install + import）")

# ═══ C. controllerFns.ts 拆雷 ═══
cf = read(CF)
pat = re.compile(r"^([ \t]+)HoverPreviewKeydown = false;$", re.M)
hits = pat.findall(cf)
assert len(hits) == 1, "controllerFns 裸赋值 %d 处（预期 1）" % len(hits)
cf2 = pat.sub(lambda m: m.group(1) + "(window as any).HoverPreviewKeydown = false;", cf)
assert cf2.count("(window as any).HoverPreviewKeydown = false;") == 1
write(CF, cf2)
print("C. controllerFns.ts strict-mode 拆雷 OK")
print("ALL OK")
