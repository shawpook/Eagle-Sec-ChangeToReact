# -*- coding: utf-8 -*-
"""b1-9bl-B：preview-window/controller.ts 调用面手术 + preview-window.html 摘除。

同 bl-surgery.py 逻辑（右到左、平衡括号、init→ensureDetailZoom/method→detailZoom()?.m），
追加前缀剥离：`(window as any).detailZoom()?.` → `detailZoom()?.`、
`(window as any).ensureDetailZoom(` → `ensureDetailZoom(`。
html：摘 window.angular stub 块 + jquery.smoothZoom.min.js 标签（注释同步改写）。
"""
import io, re

CTRL = r"src/app/react/preview-window/controller.ts"
HTML = r"src/app/preview-window.html"
EXPECTED = 16

RECV_TAIL = re.compile(r"\$\(\s*['\"]#detail-container['\"]\s*\)\s*\.\s*smoothZoom\s*\(")

def scan_backward_start(text, dot_pos):
    i = dot_pos - 1
    while i >= 0 and text[i] in ")]":
        open_ch = "(" if text[i] == ")" else "["
        close_ch = text[i]
        depth = 0
        while i >= 0:
            c = text[i]
            if c == close_ch:
                depth += 1
            elif c == open_ch:
                depth -= 1
                if depth == 0:
                    i -= 1
                    break
            i -= 1
        else:
            raise AssertionError("unbalanced backward scan")
    while i >= 0 and (text[i].isalnum() or text[i] in "_$"):
        i -= 1
    return i + 1

def find_call_end(text, open_pos):
    depth = 0
    i = open_pos
    in_str = None
    while i < len(text):
        c = text[i]
        if in_str:
            if c == "\\":
                i += 2
                continue
            if c == in_str:
                in_str = None
        elif c in "'\"`":
            in_str = c
        elif c == "(":
            depth += 1
        elif c == ")":
            depth -= 1
            if depth == 0:
                return i
        i += 1
    raise AssertionError("unbalanced forward scan")

# ── controller.ts ──
text = io.open(CTRL, encoding="utf-8").read()
n_init = 0
n_method = 0
methods = {}
while True:
    m = RECV_TAIL.search(text)
    if not m:
        break
    open_pos = m.end() - 1
    dot_pos = m.end() - len(".smoothZoom(")
    recv_start = scan_backward_start(text, dot_pos)
    recv_text = text[recv_start:dot_pos]
    assert "#detail-container" in recv_text, "receiver: %r" % recv_text
    call_end = find_call_end(text, open_pos)
    args_text = text[open_pos + 1:call_end]
    stripped = args_text.lstrip()
    if stripped.startswith("{") or stripped == "":
        repl = "ensureDetailZoom(%s)" % args_text
        n_init += 1
    else:
        mm = re.match(r"^(['\"])([A-Za-z_]+)\1\s*,?", stripped)
        assert mm, "args: %r" % text[recv_start:call_end + 1][:120]
        meth = mm.group(2)
        rest = stripped[mm.end():]
        repl = "detailZoom()?.%s(%s)" % (meth, rest)
        n_method += 1
        methods[meth] = methods.get(meth, 0) + 1
    text = text[:recv_start] + repl + text[call_end + 1:]

total = n_init + n_method
assert total == EXPECTED, "expected %d rewrites, got %d (init=%d method=%d)" % (EXPECTED, total, n_init, n_method)
# 前缀剥离
n_strip = text.count("(window as any).detailZoom()?.") + text.count("(window as any).ensureDetailZoom(")
text = text.replace("(window as any).detailZoom()?.", "detailZoom()?.")
text = text.replace("(window as any).ensureDetailZoom(", "ensureDetailZoom(")
# import 注入
if "smoothZoomEngine" not in text:
    lines = text.split("\n")
    for idx, ln in enumerate(lines):
        if ln.startswith("import "):
            break
    else:
        raise AssertionError("no import line")
    lines.insert(idx + 1, "import { detailZoom, ensureDetailZoom } from '../core/smoothZoomEngine';")
    text = "\n".join(lines)
residue = [ln for ln in text.split("\n") if ".smoothZoom(" in ln and not ln.strip().startswith(("*", "//", "/*"))]
assert not residue, "residue: %s" % residue[:3]
io.open(CTRL, "w", encoding="utf-8", newline="").write(text)
print("OK controller.ts init=%d method=%d strip=%d %s" % (n_init, n_method, n_strip, methods))

# ── preview-window.html ──
html = io.open(HTML, encoding="utf-8").read()
# 1) angular stub 块（注释 + <script>…</script>）整体摘除
stub_pat = re.compile(
    r"\n?[ \t]*<!-- 阶段9a：预览窗移除 Angular 后的微型 stub[^\n]*\n"
    r"(?:[ \t]*[^\n]*\n)*?"
    r"[ \t]*<script>\n(?:(?!</script>)[\s\S])*?</script>",
)
m = stub_pat.search(html)
assert m and "window.angular" in m.group(0), "angular stub block not found"
html = html[:m.start()] + "\n" + html[m.end():]
# 2) min.js 标签
tag = '<script src="js/vendors/jquery.smoothZoom.min.js"></script>\n'
assert html.count(tag) == 1, "min.js tag count: %d" % html.count(tag)
html = html.replace(tag, "")
io.open(HTML, "w", encoding="utf-8", newline="").write(html)
print("OK preview-window.html stub+tag removed")
