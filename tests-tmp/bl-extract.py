# -*- coding: utf-8 -*-
"""b1-9bl：/vendor/eagle-smooth-zoom.js 剥壳归位——span 手术（内容锚定位，禁手算行号）。

产出：
  src/app/react/core/bitmapViewer.ts      ← vendor 29-826 逐字（class BitmapViewer）
  src/app/react/core/smoothZoomEngine.ts ← vendor 831-3926 + 3970-3985 逐字（defaults/Zoomer/
                                            checkBoolean/prop 常量）+ 单例 API 替换插件壳
断言：锚点唯一命中 + brace delta == 0 + 插件壳不在产出内。
"""
import io, re, sys

VENDOR = r"frontend/public/vendor/eagle-smooth-zoom.js"
OUT_BV = r"src/app/react/core/bitmapViewer.ts"
OUT_ENG = r"src/app/react/core/smoothZoomEngine.ts"

with io.open(VENDOR, "r", encoding="utf-8") as f:
    lines = f.read().split("\n")

def find_line(pred, desc, lo=1, hi=None):
    """1-indexed 唯一命中定位；lo/hi 为 1-indexed 闭区间。"""
    hits = []
    hi = hi if hi is not None else len(lines)
    for i in range(lo, hi + 1):
        if pred(lines[i - 1]):
            hits.append(i)
    assert len(hits) == 1, "anchor %s expected 1 hit, got %d: %s" % (desc, len(hits), hits)
    return hits[0]

def brace_delta(text):
    # 粗粒度配平（内容为已发布 vendor 代码，无字符串内花括号陷阱除 base64/URL——查无）
    return text.count("{") - text.count("}")

# ── 锚点定位 ──
bv_start = find_line(lambda s: s.startswith("class BitmapViewer {"), "class BitmapViewer {")
# IIFE 开行唯一锚定，向上回扫（≤5 行）找类闭括号（列 0 '}'）
iife_open = find_line(lambda s: s.startswith("(function ($, window, document) {"), "IIFE open")
k = iife_open - 2  # 0-indexed of line above IIFE open
bv_end = None
for back in range(5):
    idx = iife_open - 2 - back  # 0-indexed
    if lines[idx].rstrip() == "}" and lines[idx].startswith("}"):
        bv_end = idx + 1  # 1-indexed
        break
assert bv_end is not None, "BitmapViewer closing brace not found within 5 lines above IIFE open (%d)" % iife_open

iife_close = find_line(lambda s: s.startswith("})(jQuery, window, document);"), "IIFE close")
plugin_start = find_line(lambda s: "$.fn.smoothZoom = function (params) {" in s, "plugin entry")
checkbool_start = find_line(lambda s: s.strip().startswith("function checkBoolean"), "checkBoolean")
prop_start = find_line(lambda s: s.strip().startswith("var prop_transform = 'transform';"), "prop vars")

BV_BODY = "\n".join(lines[bv_start - 1: bv_end])          # class BitmapViewer 全体
ENG_BODY = "\n".join(lines[iife_open: iife_open + (plugin_start - 1 - iife_open)])  # IIFE 体 831..插件壳前
ENG_TAIL = "\n".join(lines[checkbool_start - 1: prop_start + 3])  # checkBoolean + prop 常量×4

# 断言：体内容完整性
assert "function Zoomer($elem, params) {" in ENG_BODY, "Zoomer missing"
assert "var defaults = {" in ENG_BODY, "defaults missing"
assert "var NAVIGATOR_SIZE = 120;" in ENG_BODY, "NAVIGATOR_SIZE missing"
assert "var $scope;" in ENG_BODY, "$scope missing"
assert "getChangedData: function (params) {" in ENG_BODY, "getChangedData missing"
assert "updateNavigator: async function (image) {" in ENG_BODY, "updateNavigator missing"
assert "focusTo: function (params) {" in ENG_BODY, "focusTo missing"
assert "resize: function (e) {" in ENG_BODY, "resize missing"
assert "$.fn.smoothZoom" not in ENG_BODY, "plugin shell leaked into engine body"
assert "#createBitmapWorker" in BV_BODY, "BitmapViewer private fields missing"
assert "isSupportFormat(ext) {" in BV_BODY, "isSupportFormat missing"

BV_HEADER = """/**
 * b1-9bl：/vendor/eagle-smooth-zoom.js 剥壳归位——BitmapViewer 全类逐字搬迁
 * （vendor 29-826；数学/DOM/Worker 行为锁定，见 PROGRESS「S4-bl 考据定案」）。
 * 过渡期保留面：$ 为 window.$（jQuery DOM 微操作，P4 统一退役）；$bodyScope 走
 * window（bundleGlobals 供给）；bitmapWorker 路径不变（js/workers/bitmapWorker.js）。
 * vendor 脚本随本批自 index.html 摘除；压缩版（js/vendors/jquery.smoothZoom.min.js）
 * 留 bl-B 预览窗切换时一并退役。
 */
// @ts-nocheck

"""

ENG_HEADER = """/**
 * b1-9bl：/vendor/eagle-smooth-zoom.js 剥壳归位——smoothZoom 引擎逐字搬迁
 * （vendor IIFE 体 831-3926 + checkBoolean/prop 常量 3970-3985；defaults 表、
 * NAVIGATOR_SIZE、Animate 边界锁、wheel 三模、drag 阈值、getZoomData toFixed(14)
 * 字段全部逐字锁定）。原 `$.fn.smoothZoom` 插件壳替换为模块单例 API：
 *   ensureDetailZoom(params) —— 首次进详情初始化（等价插件 data('smoothZoom') 守卫）
 *   detailZoom()             —— 后续 12 方法派发（未初始化时 no-op 语义与插件一致）
 * 消费面切换：`w.$("#detail-container").smoothZoom(m, ...)` → `detailZoom()?.m(...)`。
 * FileUrlHelper 自 react/core/fileUrlHelper 具名导入（裸标识符解析到 import）。
 */
// @ts-nocheck
import { FileUrlHelper } from './fileUrlHelper';
import { BitmapViewer } from './bitmapViewer';

"""

ENG_ADAPTER = """

	/* ── b1-9bl：原 $.fn.smoothZoom 插件壳 → 模块单例 API（等价 data('smoothZoom') 守卫）── */
	let instance = null;

	export function detailZoom(): any {
		return instance;
	}

	export function ensureDetailZoom(params: any): any {
		const elem = document.getElementById('detail-container');
		if (!elem) return instance;
		if (!instance) {
			instance = new Zoomer((window as any).$(elem), params);
		}
		return instance;
	}
"""

ENG_FOOT = "\n"

bv_out = BV_HEADER + BV_BODY + "\n"
eng_out = ENG_HEADER + ENG_BODY + ENG_ADAPTER + "\n" + ENG_TAIL + ENG_FOOT

assert brace_delta(bv_out) == 0, "bitmapViewer brace delta != 0: %d" % brace_delta(bv_out)
assert brace_delta(eng_out.replace(ENG_ADAPTER, "")) == 0, "engine body brace delta != 0: %d" % brace_delta(eng_out.replace(ENG_ADAPTER, ""))
# adapter 自身配平
assert brace_delta(ENG_ADAPTER) == 0, "adapter brace delta != 0"

with io.open(OUT_BV, "w", encoding="utf-8", newline="\n") as f:
    f.write(bv_out)
with io.open(OUT_ENG, "w", encoding="utf-8", newline="\n") as f:
    f.write(eng_out)

print("OK bitmapViewer.ts lines=%d" % bv_out.count("\n"))
print("OK smoothZoomEngine.ts lines=%d" % eng_out.count("\n"))
print("anchors: bv=%d..%d iife_open=%d plugin=%d checkbool=%d prop=%d close=%d" % (
    bv_start, bv_end, iife_open, plugin_start, checkbool_start, prop_start, iife_close))
