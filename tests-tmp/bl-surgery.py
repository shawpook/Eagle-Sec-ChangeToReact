# -*- coding: utf-8 -*-
"""b1-9bl 调用面手术：`<recv>.smoothZoom(<args>)` → 引擎 API。

改写规则（接收者已普查核实）：
  recv ∈ {w.$("#detail-container"), $("#detail-container"), $()('#detail-container'),
          $detailContainer（局部别名，4 处均已核实 wrap #detail-container）}
  - 首参为 {    → ensureDetailZoom(<args>)        （仅 dataMachinery init 1 点）
  - 首参为引号 → detailZoom()?.<method>(<args>)
特例：detailHooks safeZoomData 包装体 `this.smoothZoom('getZoomData')` → `detailZoom()?.getZoomData()`
每个文件注入对应相对路径 import。断言：各文件改写计数与普查一致 + 残留 .smoothZoom( 为零（除注释/引擎）。
"""
import io, re

BASE = r"src/app/react"

# (file, rel_import, import_names, expected_rewrites)
FILES = [
    (r"core\controllerFns.ts",        "./smoothZoomEngine",         ["detailZoom"], 15),
    (r"core\dataMachinery.ts",        "./smoothZoomEngine",         ["detailZoom", "ensureDetailZoom"], 23),
    (r"core\itemDomain.ts",           "./smoothZoomEngine",         ["detailZoom"], 2),
    (r"core\selectionViewDomain.ts",  "./smoothZoomEngine",         ["detailZoom"], 1),
    (r"services\detailService.ts",    "../core/smoothZoomEngine",   ["detailZoom"], 2),
    (r"services\imageOpsService.ts",  "../core/smoothZoomEngine",   ["detailZoom"], 4),
    (r"components\inspector\inspectorActions.ts", "../../core/smoothZoomEngine", ["detailZoom"], 1),
    (r"components\detail\detailHooks.ts",         "../../core/smoothZoomEngine", ["detailZoom"], 1),
]

RECV_TAIL = re.compile(r"['\"]#detail-container['\"]\s*\)\s*\.\s*smoothZoom\s*\(")
RECV_ALIAS = re.compile(r"\$detailContainer\s*\.\s*smoothZoom\s*\(")
IDENT = re.compile(r"[A-Za-z_$][A-Za-z0-9_$]*")

def scan_backward_start(text, dot_pos):
    """从 `.smoothZoom` 的点位置向回扫描，返回接收者表达式起点。
    规则：跨过平衡括号组/下标组，再吞标识符/点链。"""
    i = dot_pos - 1
    depth_ok = True
    # 1) 向回跨闭括号组
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
    # 2) 吞标识符链（$/w./$() 已被跨括号覆盖；再吞 $name 与点）
    end = i
    while i >= 0 and (text[i].isalnum() or text[i] in "_$"):
        i -= 1
    return i + 1, end + 1

def find_call_end(text, open_pos):
    """从 `(` 位置前向扫描平衡括号，返回闭括号下标（含）。"""
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

def rewrite_file(path, rel_import, names, expected):
    with io.open(path, "r", encoding="utf-8") as f:
        text = f.read()
    n_init = 0
    n_method = 0
    methods = {}
    # 从右到左处理：init 的平衡括号扫描可能吞入 on_IMAGE_LOAD 回调内嵌的
    # smoothZoom 调用（dataMachinery 3333 init 内嵌 3356 updateNavigator），
    # 先改写右侧内层点，外层扫描时体内已无 .smoothZoom( 残留。
    while True:
        m1 = RECV_TAIL.search(text)
        m2 = RECV_ALIAS.search(text)
        if m2 and (not m1 or m2.start() > m1.start()):
            m = m2
            recv_start = m.start()
            recv_text = "$detailContainer"
        elif m1:
            m = m1
            recv_start, _ = scan_backward_start(text, m.end() - len(".smoothZoom("))
            recv_text = text[recv_start:m.end() - len(".smoothZoom(")]
            assert "#detail-container" in recv_text, "unexpected receiver: %r" % recv_text
        else:
            break
        open_pos = m.end() - 1
        call_end = find_call_end(text, open_pos)
        args_text = text[open_pos + 1:call_end]
        stripped = args_text.lstrip()
        if stripped.startswith("{") or stripped == "":
            # init（对象参数）
            repl = "ensureDetailZoom(%s)" % args_text
            n_init += 1
        else:
            mm = re.match(r"^(['\"])([A-Za-z_]+)\1\s*,?", stripped)
            assert mm, "unrecognized smoothZoom args at %r" % text[recv_start:call_end + 1][:120]
            meth = mm.group(2)
            # 去掉方法名与逗号，保留其余参数原样；args_text 不含闭括号，补回
            rest = stripped[mm.end():]
            repl = "detailZoom()?.%s(%s)" % (meth, rest)
            n_method += 1
            methods[meth] = methods.get(meth, 0) + 1
        text = text[:recv_start] + repl + text[call_end + 1:]

    # 特例：detailHooks safeZoomData 包装体
    if "detailHooks" in path:
        old = "return this.smoothZoom('getZoomData');"
        assert old in text, "detailHooks wrapper body not found"
        text = text.replace(old, "return detailZoom()?.getZoomData();")

    # import 注入（首个 import 行之后）
    if names and ("detailZoom()?" in text or "detailZoom()" in text or "ensureDetailZoom(" in text):
        # 避免重复注入
        if "smoothZoomEngine" not in text:
            lines = text.split("\n")
            for idx, ln in enumerate(lines):
                if ln.startswith("import "):
                    break
            else:
                raise AssertionError("no import line in %s" % path)
            imp = "import { %s } from '%s';" % (", ".join(sorted(names)), rel_import)
            lines.insert(idx + 1, imp)
            text = "\n".join(lines)

    total = n_init + n_method
    assert total == expected, "%s: expected %d rewrites, got %d (init=%d method=%d)" % (
        path, expected, total, n_init, n_method)
    # 残留检查：注释以外的 .smoothZoom( 必须为零
    residue = [ln for ln in text.split("\n") if ".smoothZoom(" in ln
               and not ln.strip().startswith(("*", "//", "/*")) and "smoothZoomEngine" not in ln]
    assert not residue, "%s residue: %s" % (path, residue[:3])
    with io.open(path, "w", encoding="utf-8", newline="") as f:
        f.write(text)
    print("OK %-52s init=%d method=%d %s" % (path, n_init, n_method, methods))

for f, rel, names, exp in FILES:
    rewrite_file(BASE + "\\" + f, rel, names, exp)

print("ALL CALL SITES REWRITTEN")
