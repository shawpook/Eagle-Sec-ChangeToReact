# -*- coding: utf-8 -*-
"""b1-9bz-A 审计：移动体标识符配平不变式。
new_uncovered(体在新落点) ⊆ old_uncovered(体在原 controllerFns)。
即：过去能解析的现在都能解析；过去就解析失败的保持失败（行为零变化）。"""
import io, os, re, json

BASE = r"H:\dev\Eagle-Sec-development - 副本\src\app\react"
CF = os.path.join(BASE, 'core', 'controllerFns.ts')
exec(io.open(r"H:\dev\Eagle-Sec-development - 副本\tests-tmp\bz-a-map.py", encoding='utf-8').read())

def rd(p):
    return io.open(p, encoding='utf-8', errors='strict').read()

RE_PREV_OK = set('(,=:[!&|?;{}<>~^%')
RE_KW = {'return', 'typeof', 'case', 'in', 'of', 'new', 'delete', 'void', 'do', 'else',
         'instanceof', 'yield', 'await'}

def strip_noncode(src):
    out = []
    i = 0
    nlen = len(src)
    state = None
    prev_sig = ''
    last_word = ''
    while i < nlen:
        c = src[i]
        nxt = src[i + 1] if i + 1 < nlen else ''
        if state in ("'", '"'):
            if c == '\\':
                out.append('  '); i += 2; continue
            if c == state:
                state = None
            out.append(c if c == '\n' else ' '); i += 1; continue
        if state == '`':
            if c == '\\':
                out.append('  '); i += 2; continue
            if c == '`':
                state = None; out.append(' '); i += 1; continue
            out.append(c if c == '\n' else ' '); i += 1; continue
        if state == '//':
            if c == '\n':
                state = None; out.append('\n')
            else:
                out.append(' ')
            i += 1; continue
        if state == '/*':
            if c == '*' and nxt == '/':
                state = None; out.append('  '); i += 2; continue
            out.append(c if c == '\n' else ' '); i += 1; continue
        if state == 're':
            if c == '\\':
                out.append('  '); i += 2; continue
            if c == '[':
                state = 'recc'; out.append(' '); i += 1; continue
            if c == '/':
                state = 'reflag'; out.append(' '); i += 1; continue
            out.append(' '); i += 1; continue
        if state == 'recc':
            if c == '\\':
                out.append('  '); i += 2; continue
            if c == ']':
                state = 're'; out.append(' '); i += 1; continue
            out.append(' '); i += 1; continue
        if state == 'reflag':
            if c.isalpha():
                out.append(' '); i += 1; continue
            state = None
        if c in ("'", '"'):
            state = c; out.append(' '); i += 1; continue
        if c == '`':
            state = '`'; out.append(' '); i += 1; continue
        if c == '/' and nxt == '/':
            state = '//'; out.append('  '); i += 2; continue
        if c == '/' and nxt == '*':
            state = '/*'; out.append('  '); i += 2; continue
        if c == '/' and (prev_sig in RE_PREV_OK or prev_sig == '' or last_word in RE_KW):
            state = 're'; out.append(' '); i += 1; continue
        if not c.isspace():
            prev_sig = c
            if c.isalnum() or c in '_$':
                last_word = (last_word + c) if last_word and (last_word[-1].isalnum() or last_word[-1] in '_$') else c
            else:
                last_word = ''
        out.append(c); i += 1
    return ''.join(out)

JS_KEYWORDS = set('''break case catch class const continue debugger default delete do else export
extends finally for function if import in instanceof let new return super switch this throw try typeof
var void while with yield async await of static get set null true false undefined NaN Infinity
any string number boolean unknown never object symbol bigint readonly keyof asserts infer is'''.split())

GLOBALS = GLOBALS | set('''window document localStorage navigator location setTimeout setInterval
clearInterval Date Math JSON Object Array String Number Boolean Promise RegExp parseInt parseFloat
isNaN encodeURIComponent decodeURIComponent console process require globalThis arguments this $ jQuery
eagle alert confirm requestAnimationFrame cancelAnimationFrame chineseConvert pinyinlite
cartesianProduct TagManager i18n fuzzy_match'''.split())

def analyze_code(code):
    used = set(re.findall(r'[A-Za-z_$][\w$]*', code))
    decl = set(re.findall(r'(?:\bvar\b|\blet\b|\bconst\b)\s+([A-Za-z_$][\w$]*)', code))
    decl |= set(re.findall(r'\bfunction\s+([A-Za-z_$][\w$]*)\s*\(', code))
    for mm in re.finditer(r'\(function\s*\(([^)]*)\)', code):
        for p in mm.group(1).split(','):
            p = p.strip().split('=')[0].split(':')[0].strip()
            if p: decl.add(p)
    return used, decl

# 旧环境：controllerFns(HEAD 版) modscope + 闭包名 —— 注意必须取 git HEAD 文本，
# 当前工作树 controllerFns 已被 apply 重写为指针表（其 import 含全部指针名，会污染旧侧）
import subprocess
old_cf = subprocess.run(['git', 'show', 'HEAD:src/app/react/core/controllerFns.ts'],
                        capture_output=True, text=True, encoding='utf-8',
                        cwd=r"H:\dev\Eagle-Sec-development - 副本").stdout
NL = chr(10)
lines_old = old_cf.split(NL)
stripped_old = strip_noncode(old_cf)
assert len(stripped_old) == len(old_cf)

def old_body_of(nm):
    m = re.search(r'  fns\["' + nm + r'"\] = function \(\.\.\.args\) \{', old_cf)
    if not m:
        return ''
    start = m.start()
    depth = 0
    started = False
    for i in range(start, len(stripped_old)):
        c = stripped_old[i]
        if c == '{':
            depth += 1; started = True
        elif c == '}':
            depth -= 1
            if depth == 0 and started:
                return old_cf[start:i + 1]
    return old_cf[start:start + 20000]

old_entries = {}
for m in re.finditer(r'  fns\["([A-Za-z_0-9]+)"\] = function', old_cf):
    old_entries[m.group(1)] = old_body_of(m.group(1))

m0 = re.search(r'^export function makeControllerFns', old_cf, re.M)
modscope = set()
for m in re.finditer(r'^import\s+([\w*{},\s]+?)\s+from', old_cf, re.M):
    mb = re.match(r'\{([^}]*)\}', m.group(1).strip())
    if mb:
        for part in mb.group(1).split(','):
            if part.split(' as ')[-1].strip():
                modscope.add(part.split(' as ')[-1].strip())
    else:
        modscope.add(m.group(1).replace('* as ', '').strip())
for m in re.finditer(r'^(?:export\s+)?(?:const|let|var|function)\s+([A-Za-z_$][\w$]*)', old_cf[:m0.start()], re.M):
    modscope.add(m.group(1))
closure = modscope | {'fns', 'initLinkVars', 'linkVarsInited', 'getScope', 'args'}
closure |= {v for v in re.findall(r'var\s+(__lv_[A-Za-z_0-9]+)', old_cf)}

# 新环境：各落点文件顶层名 + import
def file_scope(fp):
    src = rd(fp)
    names = set(re.findall(r'^(?:export\s+)?(?:async\s+)?(?:const|let|var|function)\s+([A-Za-z_$][\w$]*)', src, re.M))
    for m in re.finditer(r'^import\s+(?:type\s+)?\{([^}]*)\}\s*from', src, re.M):
        for part in m.group(1).split(','):
            p = part.strip().split(' as ')[-1].strip().rstrip(',')
            if p: names.add(p)
    return names, src

# 旧体文本（HEAD 版 controllerFns）
import subprocess
old_cf = subprocess.run(['git', 'show', 'HEAD:src/app/react/core/controllerFns.ts'],
                        capture_output=True, text=True, encoding='utf-8',
                        cwd=r"H:\dev\Eagle-Sec-development - 副本").stdout
old_entries = {}
NL = chr(10)
lines_old = old_cf.split(NL)
stripped_old = strip_noncode(old_cf)
assert len(stripped_old) == len(old_cf)

def old_body_of(nm):
    m = re.search(r'  fns\["' + nm + r'"\] = function \(\.\.\.args\) \{', old_cf)
    if not m:
        return ''
    start = m.start()
    depth = 0
    started = False
    for i in range(start, len(stripped_old)):
        c = stripped_old[i]
        if c == '{':
            depth += 1; started = True
        elif c == '}':
            depth -= 1
            if depth == 0 and started:
                return old_cf[start:i + 1]
    return old_cf[start:start + 20000]

for m in re.finditer(r'  fns\["([A-Za-z_0-9]+)"\] = function', old_cf):
    old_entries[m.group(1)] = old_body_of(m.group(1))

fails = []
checked = 0
for name, tgt in sorted(TARGET.items()):
    if name in POINTER_EXISTING:
        continue
    fp = os.path.join(BASE, tgt)
    scope_names, src = file_scope(fp)
    # 从新文件提取该函数体（export function NAME(...args: any[]) { 到配平——直接抓 export function NAME 段）
    m = re.search(r'^export function ' + re.escape(name) + r'\(', src, re.M)
    if not m:
        fails.append((name, tgt, 'BODY NOT FOUND IN TARGET'))
        continue
    body = src[m.start():]
    # 剪到函数结束：用 strip 后大括号配平
    code = body
    depth = 0
    endpos = None
    i = 0
    st = None
    started = False
    stripped = strip_noncode(code)
    for i, c in enumerate(stripped):
        if st is None:
            if c == '{':
                depth += 1; started = True
            elif c == '}':
                depth -= 1
                if depth == 0 and started:
                    endpos = i
                    break
        elif c == st:
            st = None
    if endpos is None:
        fails.append((name, tgt, 'BODY UNBALANCED'))
        continue
    code = body[:endpos + 1]
    st2 = strip_noncode(code)
    used, decl = analyze_code(st2)
    lv_decl = {v for v in re.findall(r'(?:var|let|const)\s+(__lv_[A-Za-z_0-9]+)', st2)}
    free = used - decl - scope_names - JS_KEYWORDS - GLOBALS - {
        'initLinkVars', 'lvInited', 'getBodyScope', 'args', 's', 'w', 'getScope'}
    free = {f for f in free if not f.startswith('__lv_') or f not in lv_decl}
    lv_free = {v for v in set(re.findall(r'__lv_[A-Za-z_0-9]+', st2))
               if v not in lv_decl and v not in scope_names}
    new_uncovered = (free | lv_free)

    # 旧体同口径未解析集
    old_body = old_entries.get(name, '')
    st1 = strip_noncode(old_body)
    used1, decl1 = analyze_code(st1)
    lv_decl1 = {v for v in re.findall(r'(?:var|let|const)\s+(__lv_[A-Za-z_0-9]+)', st1)}
    free1 = used1 - decl1 - closure - JS_KEYWORDS - GLOBALS - {'args', 's', 'w'}
    free1 = {f for f in free1 if not f.startswith('__lv_') or f not in lv_decl1}
    lv_free1 = {v for v in set(re.findall(r'__lv_[A-Za-z_0-9]+', st1))
                if v not in lv_decl1 and v not in closure}
    old_uncovered = free1 | lv_free1

    checked += 1
    for f in sorted(new_uncovered - old_uncovered):
        fails.append((name, tgt, 'NEW-UNRESOLVED: ' + f))

print('检查移动体:', checked)
if fails:
    for f in fails[:40]:
        print('  !!', f)
    print('FAIL 总数:', len(fails))
else:
    print('审计不变式 PASS：新未解析集 = 旧未解析集（行为零变化）')
