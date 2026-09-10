# -*- coding: utf-8 -*-
"""b1-9bz-A 预分析 v2：模块作用域求交。
自由标识符 ∩ controllerFns 模块作用域名（import 绑定/顶层 const/独立导出）= 需迁移依赖。
裸调其他表函数今天即 ReferenceError（try/catch 吞），逐字平移保持不变，不处理。
只读分析，输出 per-target 依赖清单 -> tests-tmp/bz-a-need.json。"""
import io, os, re, json

BASE = r"H:\dev\Eagle-Sec-development - 副本\src\app\react"
CF = os.path.join(BASE, 'core', 'controllerFns.ts')

exec(io.open(r"H:\dev\Eagle-Sec-development - 副本\tests-tmp\bz-a-map.py", encoding='utf-8').read())

def rd(p):
    with io.open(p, 'r', encoding='utf-8', errors='strict') as f:
        return f.read()

text = rd(CF)
lines = text.split('\n')
n = len(lines)

RE_PREV_OK = set('(,=:[!&|?;{}<>~^%')
RE_KW = {'return', 'typeof', 'case', 'in', 'of', 'new', 'delete', 'void', 'do', 'else',
         'instanceof', 'yield', 'await'}

def scan_block(start_idx, open_col):
    """字符串感知 + 正则字面量识别的花括号配平，返回结束行 idx。"""
    depth = 0
    i, col = start_idx, open_col
    state = None
    started = False
    prev_sig = ''
    last_word = ''
    while i < n:
        ln = lines[i]
        j = col
        while j < len(ln):
            c = ln[j]
            nxt = ln[j + 1] if j + 1 < len(ln) else ''
            if state == "'":
                if c == '\\': j += 2; continue
                if c == "'": state = None
            elif state == '"':
                if c == '\\': j += 2; continue
                if c == '"': state = None
            elif state == '`':
                if c == '\\': j += 2; continue
                if c == '`': state = None
                elif c == '$' and nxt == '{': j += 2; continue
            elif state == '//':
                break
            elif state == '/*':
                if c == '*' and nxt == '/': state = None; j += 2; continue
            elif state == 're':
                if c == '\\': j += 2; continue
                if c == '[': state = 'recc'
                elif c == '/': state = 'reflag'
            elif state == 'recc':
                if c == '\\': j += 2; continue
                if c == ']': state = 're'
            elif state == 'reflag':
                if not c.isalpha():
                    state = None; j -= 1
            else:
                if c == "'": state = "'"
                elif c == '"': state = '"'
                elif c == '`': state = '`'
                elif c == '/' and nxt == '/': state = '//'
                elif c == '/' and nxt == '*': state = '/*'; j += 1
                elif c == '/' and (prev_sig in RE_PREV_OK or prev_sig == '' or last_word in RE_KW):
                    state = 're'
                elif c == '{':
                    depth += 1; started = True
                elif c == '}':
                    depth -= 1
                    if depth == 0 and started:
                        return i
                if state is None:
                    if not c.isspace():
                        prev_sig = c
                        if c.isalnum() or c in '_$':
                            last_word = (last_word + c) if last_word and (last_word[-1].isalnum() or last_word[-1] in '_$') else c
                        else:
                            last_word = ''
            j += 1
        i += 1; col = 0
        if state == '//':
            state = None
    raise AssertionError('brace unbalanced at line %d' % (start_idx + 1))

JS_KEYWORDS = set('''break case catch class const continue debugger default delete do else export
extends finally for function if import in instanceof let new return super switch this throw try typeof
var void while with yield async await of static get set null true false undefined NaN Infinity'''.split())

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

def analyze(body):
    code = strip_noncode(body)
    used = set(re.findall(r'[A-Za-z_$][\w$]*', code))
    decl = set(re.findall(r'(?:\bvar\b|\blet\b|\bconst\b)\s+([A-Za-z_$][\w$]*)', code))
    decl |= set(re.findall(r'\bfunction\s+([A-Za-z_$][\w$]*)\s*\(', code))
    for mm in re.finditer(r'\(function\s*\(([^)]*)\)', code):
        for p in mm.group(1).split(','):
            p = p.strip().split('=')[0].split(':')[0].strip()
            if p: decl.add(p)
    lv_free = set()
    for lv in set(re.findall(r'__lv_[A-Za-z_0-9]+', code)):
        if not re.search(r'(?:\bvar\b|\blet\b|\bconst\b)\s+' + lv + r'\b', code):
            lv_free.add(lv)
    free = used - decl - GLOBALS - JS_KEYWORDS - {'initLinkVars', 'linkVarsInited', 'args', 's', 'w', 'getScope'}
    free = {f for f in free if not f.startswith('__lv_')}
    return free, lv_free

# ── 表体条目 ──
m0 = re.search(r'^export function makeControllerFns', text, re.M)
ret_m = re.search(r'^  return fns;\n\}', text, re.M)
assert m0 and ret_m
start_line = text[:m0.start()].count('\n')
end_line = text[:ret_m.end()].count('\n')
entries = []
i = start_line
while i <= end_line:
    m = re.match(r'  fns\["([A-Za-z_0-9]+)"\] = function \(\.\.\.args\) \{', lines[i])
    if m:
        end_i = scan_block(i, 2)
        entries.append((m.group(1), i, end_i))
        i = end_i + 1
    else:
        i += 1
names_found = [e[0] for e in entries]
print('条目数:', len(names_found))
missing = set(names_found) ^ (set(TARGET) | DEL_SET)
if missing:
    print('!! 覆盖缺口:', sorted(missing)); raise SystemExit(1)
print('覆盖断言 OK（148 = 移 %d + 删 %d）' % (len(TARGET), len(DEL_SET)))

# ── 模块作用域名 → 源 ──
modscope = {}
for m in re.finditer(r'^import\s+([\w*{},\s]+?)\s+from\s+[\'"]([^\'"]+)[\'"];', text, re.M):
    clause = m.group(1); mod = m.group(2)
    mb = re.match(r'\{([^}]*)\}', clause)
    if mb:
        for part in mb.group(1).split(','):
            part = part.strip()
            if part:
                modscope[part.split(' as ')[-1].strip()] = ('import', mod)
    else:
        nm = clause.replace('* as ', '').strip()
        if nm:
            modscope[nm] = ('import', mod)
cf_head = text[:m0.start()]
for m in re.finditer(r'^(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)', cf_head, re.M):
    modscope[m.group(1)] = ('const', m.group(1))
for m in re.finditer(r'^export function ([A-Za-z_$][\w$]*)', cf_head, re.M):
    modscope[m.group(1)] = ('topfn', m.group(1))
print('模块作用域名:', len(modscope))

# 独立导出体
sa_bodies = {}
for sa in STANDALONE:
    m = re.search(r'^export function ' + sa + r'\s*\(', text, re.M)
    if m:
        si = text[:m.start()].count('\n')
        col = lines[si].index('{')
        ei = scan_block(si, col)
        sa_bodies[sa] = '\n'.join(lines[si:ei + 1])

# ── 聚合 ──
report = {}
for name, si, ei in entries:
    tgt = TARGET.get(name)
    if tgt is None:
        continue
    body = '\n'.join(lines[si:ei + 1])
    free, lv_free = analyze(body)
    r = report.setdefault(tgt, {'free': {}, 'lv': set(), 'names': []})
    r['names'].append(name)
    for f in free:
        if f in modscope:
            r['free'].setdefault(f, []).append(name)
        elif f not in ('getScope',):
            print('!! [%s] 未解析引用(逐字保留将保持现状):' % name, f)
    r['lv'] |= lv_free
for sa, body in sa_bodies.items():
    tgt = STANDALONE.get(sa)
    if tgt == 'DEL':
        continue
    free, lv_free = analyze(body)
    r = report.setdefault(tgt, {'free': {}, 'lv': set(), 'names': []})
    r['names'].append(sa + ' (独立导出)')
    for f in free:
        if f in modscope:
            r['free'].setdefault(f, []).append(sa)
    r['lv'] |= lv_free

# 既有落点 import 面
existing = {}
for tgt in set(TARGET.values()) | {v for v in STANDALONE.values() if v != 'DEL'}:
    fp = os.path.join(BASE, tgt)
    if not os.path.exists(fp):
        existing[tgt] = ('', {})
        continue
    src = rd(fp)
    mods = {}
    for m in re.finditer(r'import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*[\'"]([^\'"]+)[\'"]\s*;', src, re.S):
        ids = {x.strip().rstrip(',') for x in m.group(1).split(',') if x.strip()}
        mods.setdefault(m.group(2), set()).update(ids)
    existing[tgt] = (src, mods)

out = {}
for tgt, r in sorted(report.items()):
    src, mods = existing[tgt]
    print('=' * 16, tgt, '(%d 函数)' % len(r['names']))
    new_imports = {}
    consts = set()
    topfns = []
    for f in sorted(r['free']):
        kind, src2 = modscope[f]
        if kind == 'import':
            new_imports.setdefault(src2, set()).add(f)
        elif kind == 'const':
            consts.add(f)
        else:
            topfns.append(f)
    for mod, ids in sorted(new_imports.items()):
        have = set()
        base = mod.split('/')[-1]
        for hm, hids in mods.items():
            if hm.split('/')[-1].replace('.js', '') == base.replace('.js', ''):
                have |= hids
        add = sorted(ids - have)
        if add:
            print('  import { %s } from "%s"' % (', '.join(add), mod))
        else:
            print('  (已有) %s' % mod)
    if consts:
        print('  const 块:', sorted(consts))
    if topfns:
        print('  独立导出随迁:', topfns)
    if r['lv']:
        print('  __lv_ 模块声明:', sorted(r['lv']))
    out[tgt] = {'names': r['names'], 'imports': {k: sorted(v) for k, v in new_imports.items()},
                'consts': sorted(consts), 'lv': sorted(r['lv'])}

with io.open(r"H:\dev\Eagle-Sec-development - 副本\tests-tmp\bz-a-need.json", 'w', encoding='utf-8') as f:
    json.dump(out, f, ensure_ascii=False, indent=1)
print('OK -> tests-tmp/bz-a-need.json')
