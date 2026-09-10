# -*- coding: utf-8 -*-
"""b1-9bz-A apply：controllerFns 148 表体归位手术（单次执行，前置 HEAD-clean）。
- 121 壳逐字平移至 11 落点（export function 化 + getScope()→getBodyScope()）
- 27 死壳删除（22 双键死体 + 5 净死壳）
- 表项指针化 fns["NAME"] = NAME;（callScope/scope 双面零行为变化）
- 4 独立导出迁移（parseKeywordsWithOR→filterDomain，其余按 map）
- 模块级 const/函数 verbatim 随迁 + __lv_ 模块声明 + initLinkVars chunk
- 外部 4 import 改写 + stage1c3 计数 263→236
"""
import io, os, re, sys

BASE = r"H:\dev\Eagle-Sec-development - 副本\src\app\react"
CF = os.path.join(BASE, 'core', 'controllerFns.ts')
TEST13 = r"H:\dev\Eagle-Sec-development - 副本\tests\react-stage1c3-smoke.mjs"

exec(io.open(r"H:\dev\Eagle-Sec-development - 副本\tests-tmp\bz-a-map.py", encoding='utf-8').read())

def rd(p):
    with io.open(p, 'r', encoding='utf-8', errors='strict') as f:
        return f.read()

def wr(p, t):
    with io.open(p, 'w', encoding='utf-8', newline='') as f:
        f.write(t)

RE_PREV_OK = set('(,=:[!&|?;{}<>~^%')
RE_KW = {'return', 'typeof', 'case', 'in', 'of', 'new', 'delete', 'void', 'do', 'else',
         'instanceof', 'yield', 'await'}

text = rd(CF)
lines = text.split('\n')
n = len(lines)

def scan_block(start_idx, open_col):
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
assert len(names_found) == 148 and set(names_found) == set(TARGET) | DEL_SET, '覆盖缺口'

# ── 模块级声明源段提取（verbatim）──
cf_head_end = start_line
head_lines = lines[:cf_head_end]
const_decl_line = {}
def extract_decl(name):
    """提取模块级 const/let/var/function name 的完整源段"""
    for idx, ln in enumerate(head_lines):
        m = re.match(r'^(?:export\s+)?(?:const|let|var)\s+' + re.escape(name) + r'\b', ln) or \
            re.match(r'^(?:export\s+)?function\s+' + re.escape(name) + r'\b', ln)
        if not m:
            continue
        const_decl_line[name] = idx
        bcol = ln.find('{')
        if bcol == -1:
            # 单行声明（以 ; 结尾）
            return ln + '\n'
        end_i = scan_block(idx, bcol)
        seg = '\n'.join(lines[idx:end_i + 1])
        # IIFE/箭头尾随 ;）
        tail = lines[end_i + 1] if end_i + 1 < len(head_lines) else ''
        if tail.strip() in (';', ');'):
            seg += '\n' + tail
        return seg + '\n'
    raise AssertionError('模块级声明未找到: ' + name)

# initLinkVars chunk 源段（原 293-341 区间按 var 名抓取）
def extract_chunk(varname):
    for idx in range(280, 345):
        ln = lines[idx]
        if re.match(r'\s*' + re.escape(varname) + r'\s*=', ln):
            # 赋值语句到语句尾（函数值到配平）
            if ln.rstrip().endswith(';'):
                return ln + '\n'
            bcol = ln.find('{')
            end_i = scan_block(idx, bcol)
            seg = '\n'.join(lines[idx:end_i + 1])
            if not seg.rstrip().endswith(';'):
                seg += ';'
            return seg
    raise AssertionError('chunk 未找到: ' + varname)

# ── 裸调兄弟函数（跨落点需 import）──
def strip_noncode(src):
    out = []
    i = 0
    nlen = len(src)
    state = None
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
        if c == '/':
            state = 're'; out.append(' '); i += 1; continue
        out.append(c); i += 1
    return ''.join(out)

BARE_RX = lambda nm: re.compile(r'(?<![.\w$"\'`])' + re.escape(nm) + r'\s*\(')
moved_names = set(TARGET)

# ── 生成各落点内容 ──
NEED_CHUNKS = {
    'core/itemDomain.ts': ['__lv_path'],
    'services/folderCoreService.ts': ['__lv_path', '__lv_updateListHeight', '__lv_setLastFolder'],
    'services/uploadService.ts': ['__lv_path'],
    'services/viewOpsService.ts': ['__lv_saveListHeight'],
}
MODULE_LV = {'__lv_showFinderAlert'}  # 模块级 let（非闭包声明），走 const 块通道

target_add = {}   # tgt -> {'imports': {mod: set}, 'consts': set, 'lv': set, 'funcs': [text]}
for name, si, ei in entries:
    tgt = TARGET.get(name)
    if tgt is None:
        continue
    if name in POINTER_EXISTING:
        continue  # 落点已有同名导出——c3 体不迁，表项指既有导出
    body_lines = lines[si:ei + 1]
    # 头改写
    body_lines[0] = re.sub(r'^  fns\["[A-Za-z_0-9]+"\] = function \(\.\.\.args\) \{',
                           'export function %s(...args: any[]) {' % name, body_lines[0])
    # 尾改写（}; → }）
    if body_lines[-1].strip() == '};':
        body_lines[-1] = body_lines[-1].replace('};', '}')
    body = '\n'.join(body_lines)
    # 体逐字保留（getScope 原样）——落点发 const getScope = getBodyScope 别名（零改写、哨兵计数最小漂移）
    ta = target_add.setdefault(tgt, {'imports': {}, 'consts': set(), 'lv': set(), 'funcs': []})
    ta['funcs'].append(body)
    # 裸调兄弟 → 跨落点 import（strip 后检测，避免字符串/注释误报）
    code = strip_noncode(body)
    for sib in moved_names:
        if sib == name:
            continue
        if BARE_RX(sib).search(code):
            sib_t = TARGET[sib]
            if sib_t != tgt:
                mod = rel_import(tgt, sib_t[:-3])
                ta['imports'].setdefault(mod, set()).add(sib)

# 独立导出
for sa, tgt in STANDALONE.items():
    if tgt == 'DEL':
        continue
    m = re.search(r'^export function ' + sa + r'\s*\(', text, re.M)
    si = text[:m.start()].count('\n')
    ei = scan_block(si, lines[si].index('{'))
    body = '\n'.join(lines[si:ei + 1])
    ta = target_add.setdefault(tgt, {'imports': {}, 'consts': set(), 'lv': set(), 'funcs': []})
    ta['funcs'].append(body)

# 需求清单（来自 need.json 分析 + 裸调增量合并）
import json
with io.open(r"H:\dev\Eagle-Sec-development - 副本\tests-tmp\bz-a-need.json", encoding='utf-8') as f:
    need = json.load(f)

def rebase_mod(mod, tgt):
    """controllerFns(core/) 相对路径 -> 落点相对路径"""
    if not mod.startswith('.'):
        return mod
    core_dir = 'core'
    parts = os.path.normpath(os.path.join(core_dir, mod)).replace('\\', '/')
    tdir = os.path.dirname(tgt).replace('\\', '/')
    depth = 0 if tdir == '' else tdir.count('/') + 1
    return ('../' * depth) + parts if depth else './' + parts

for tgt, info in need.items():
    ta = target_add.setdefault(tgt, {'imports': {}, 'consts': set(), 'lv': set(), 'funcs': []})
    for mod, ids in info['imports'].items():
        ta['imports'].setdefault(rebase_mod(mod, tgt), set()).update(ids)
    ta['consts'] |= set(info['consts'])
    ta['lv'] |= set(info['lv'])

# 既有落点顶层声明去重（const/let/var/function 名）
def top_decls(fp):
    if not os.path.exists(fp):
        return set()
    src = rd(fp)
    return set(re.findall(r'^(?:export\s+)?(?:const|let|var|function)\s+([A-Za-z_$][\w$]*)', src, re.M))


# chunk 联动：__lv_path chunk 需要 _req
for tgt, chunks in NEED_CHUNKS.items():
    ta = target_add[tgt]
    if '__lv_path' in chunks:
        ta['consts'].add('_req')
    ta['lv'] |= set(c for c in chunks)
    # chunk 变量同时是 lv 声明对象

# MODULE_LV（模块级 let）走 const 块通道
for tgt, ta in target_add.items():
    hit = set(MODULE_LV) & ta['lv']
    if hit:
        ta['consts'] |= hit
        ta['lv'] -= hit

# itemMenuService 自引用豁免（openItemContextMenu 体调 itemMenuOpenItemContextMenu 同文件）
im = target_add.get('services/itemMenuService.ts')
if im:
    for mod in list(im['imports']):
        if mod.endswith('itemMenuService'):
            del im['imports'][mod]

# 通用补齐：体改写后 getBodyScope 全落点必引（分析期名为 getScope，属内建排除项）
for tgt, ta in target_add.items():
    if ta['funcs']:
        ta['imports'].setdefault(rel_import(tgt, 'core/appCore'), set()).add('getBodyScope')

# chunk 依赖补齐：setLastFolder chunk 引用 debounce
fc = target_add.get('services/folderCoreService.ts')
if fc and '__lv_setLastFolder' in NEED_CHUNKS.get('services/folderCoreService.ts', []):
    fc['imports'].setdefault('../utils/func', set()).add('debounce')

# 模块级函数随迁/导入：moved 体裸调 controllerFns 头部模块函数
head_fn_names = [m.group(1) for m in re.finditer(
    r'^(?:export\s+)?function\s+([A-Za-z_$][\w$]*)', text[:m0.start()], re.M)]
for fn in head_fn_names:
    rx = BARE_RX(fn)
    for name, tgt in TARGET.items():
        if name in POINTER_EXISTING:
            continue
        ta = target_add.get(tgt)
        if not ta:
            continue
        if not any(rx.search(strip_noncode(b)) for b in ta['funcs']):
            continue
        if fn in STANDALONE and STANDALONE[fn] != 'DEL':
            stgt = STANDALONE[fn]
            if stgt[:-3] != tgt[:-3]:
                ta['imports'].setdefault(rel_import(tgt, stgt[:-3]), set()).add(fn)
            # 同落点 → 同模块直呼，免
        else:
            ta['consts'].add(fn)

# const 引用闭包：复制的 const 源文本引用其他模块 const（如 _req）→ 一并随迁
mod_const_names = set()
for m in re.finditer(r'^(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)', text[:m0.start()], re.M):
    mod_const_names.add(m.group(1))
const_refs = {}
for cn in mod_const_names:
    try:
        seg = extract_decl(cn)
    except AssertionError:
        continue
    refs = set(re.findall(r'[A-Za-z_$][\w$]*', seg)) & mod_const_names - {cn}
    const_refs[cn] = refs
for _ in range(4):
    changed = False
    for tgt, ta in target_add.items():
        add_now = set()
        for cn in ta['consts']:
            for r in const_refs.get(cn, ()):
                if r not in ta['consts']:
                    add_now.add(r)
        if add_now:
            ta['consts'] |= add_now
            changed = True
    if not changed:
        break

# 既有落点顶层声明去重（最后一步——须在全部 consts 聚合之后；新建文件跳过——整体重写）
NEW_FILES = {'services/uploadService.ts', 'services/viewOpsService.ts', 'services/lockService.ts'}
for tgt, ta in target_add.items():
    if tgt in NEW_FILES:
        continue
    have = top_decls(os.path.join(BASE, tgt))
    dropped = ta['consts'] & have
    if dropped:
        ta['consts'] -= dropped

# const 撞既有 import 绑定（同名不同义，如 ipcRenderer 对象 vs eagleGlobals 函数）→ 复制体改名 __cf_*
for tgt, ta in target_add.items():
    if tgt in NEW_FILES:
        ta['_rename'] = set()
        continue
    src = rd(os.path.join(BASE, tgt))
    binds = set()
    for m in re.finditer(r'^import\s+(?:type\s+)?\{([^}]*)\}\s*from', src, re.M):
        for part in m.group(1).split(','):
            p = part.strip().split(' as ')[-1].strip().rstrip(',')
            if p: binds.add(p)
    ta['_rename'] = ta['consts'] & binds
    ta['consts'] -= ta['_rename']

def rename_decl(seg, cn):
    return re.sub(r'\b' + re.escape(cn) + r'\b', '__cf_' + cn, seg, count=1)

def rename_body(body, names):
    for nm in names:
        body = re.sub(r'(?<![.\w$])' + re.escape(nm) + r'(?![\w$])', '__cf_' + nm, body)
    return body

# ── 写各落点 ──
NEW_FILES = {'services/uploadService.ts', 'services/viewOpsService.ts', 'services/lockService.ts'}
HEADER_NOTE = '// ═══ b1-9bz-A：controllerFns 表体归位（逐字平移；getScope()→getBodyScope()；表项指针化）═══'

def emit_section(tgt, ta):
    parts = ['\n' + HEADER_NOTE + '\n']
    rn = ta.get('_rename', set())
    all_consts = ta['consts'] | rn
    if all_consts:
        parts.append('// —— controllerFns 模块级声明随迁（verbatim；按原声明顺序防 TDZ）——\n')
        ordered = sorted(all_consts, key=lambda cn: const_decl_line.get(cn, 10 ** 9))
        for cn in ordered:
            seg = extract_decl(cn)
            if cn in rn:
                seg = rename_decl(seg, cn)
            parts.append(seg)
            parts.append('\n')
    chunks = NEED_CHUNKS.get(tgt, [])
    lv_all = sorted(ta['lv'])
    if lv_all or chunks:
        parts.append('// —— link 级共享态（原 makeControllerFns 闭包声明）——\n')
        for v in lv_all:
            parts.append('var %s: any;\n' % v)
        parts.append('\nlet lvInited = false;\n')
        parts.append('const initLinkVars = () => {\n  if (lvInited) return;\n  lvInited = true;\n')
        for ch in chunks:
            parts.append('  // ' + ch + '（原 initLinkVars 逐字）\n')
            chunk = extract_chunk(ch)
            parts.append('\n'.join('  ' + x if x.strip() else x for x in chunk.split('\n')) + '\n')
        parts.append('};\n')
    if ta['funcs']:
        parts.append('\nconst getScope = getBodyScope;  // b1-9bz-A：原 makeControllerFns(getScope) 注入的等价别名\n')
    rn = ta.get('_rename', set())
    for fnc in ta['funcs']:
        if rn:
            fnc = rename_body(fnc, rn)
        parts.append('\n')
        parts.append(fnc)
        parts.append('\n')
    return ''.join(parts)

def emit_imports(tgt, ta):
    mods = {}
    for mod, ids in ta['imports'].items():
        mods.setdefault(mod, set()).update(ids)
    out = []
    for mod in sorted(mods):
        ids = sorted(mods[mod])
        out.append('import { %s } from \'%s\';' % (', '.join(ids), mod))
    return out

for tgt, ta in sorted(target_add.items()):
    fp = os.path.join(BASE, tgt)
    sec = emit_section(tgt, ta)
    imps = emit_imports(tgt, ta)
    if tgt in NEW_FILES:
        head = ['/**', ' * b1-9bz-A：' + tgt.split('/')[-1] + ' 新建落点——controllerFns 表体归位。',
                ' * 函数体为 makeControllerFns 表内壳逐字平移（getScope()→getBodyScope()）。',
                ' */', '']
        head += imps + ['', '']
        wr(fp, '\n'.join(head) + sec)
    else:
        src = rd(fp)
        # import 插入：最后一条顶层 import 之后；与既有 import 去重
        existing_mods = {}
        for m in re.finditer(r'import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*[\'"]([^\'"]+)[\'"]\s*;', src, re.S):
            ids = {x.strip().rstrip(',') for x in m.group(1).split(',') if x.strip()}
            existing_mods.setdefault(m.group(2), set()).update(ids)
        for mod in list(ta['imports']):
            base = mod.split('/')[-1]
            for emod, eids in list(existing_mods.items()):
                if emod.split('/')[-1].replace('.js', '') == base.replace('.js', ''):
                    ta['imports'][mod] -= eids
                    if not ta['imports'][mod]:
                        del ta['imports'][mod]
                    break
        imps = emit_imports(tgt, ta)
        last_end = 0
        for m in re.finditer(r'^import\s+[^;]+?;', src, re.M | re.S):
            if m.start() < 6000:
                last_end = m.end()
        if imps:
            src = src[:last_end] + '\n' + '\n'.join(imps) + src[last_end:]
        wr(fp, src.rstrip('\n') + '\n' + sec)

# ── 重写 controllerFns.ts ──
# 头部注释保留（1..@ts-nocheck + 原说明块到第一个 import 前）
first_import = next(i for i, ln in enumerate(lines) if ln.startswith('import '))
hdr = lines[:first_import]
hdr = [ln for ln in hdr if not re.match(r'^// @ts-nocheck', ln)]
hdr = [ln for ln in hdr if not ln.startswith('import ')]
# 裁掉原说明尾部空行
while hdr and hdr[-1].strip() == '':
    hdr.pop()
hdr.append('// @ts-nocheck')
hdr.append('// b1-9bz-A：148 表体归位 11 落点（services/* + core/*）——本文件缩为指针注册表：')
hdr.append('// fns["NAME"] = 落点导出指针（callScope/scope 函数面零行为变化）；27 死壳删除。')
hdr.append('// bz-B 摘 callScope/attach 双面后本文件退役（bz-C 删除）。')
hdr.append('')

ptr_by_target = {}
for name, si, ei in entries:
    tgt = TARGET.get(name)
    if tgt is None:
        continue
    ptr_by_target.setdefault(tgt, []).append(name)

imp_lines = []
for tgt in sorted(ptr_by_target):
    mod = rel_import('core/controllerFns.ts', tgt[:-3])
    imp_lines.append('import { %s } from \'%s\';' % (', '.join(sorted(ptr_by_target[tgt])), mod))
imp_lines.append('import { installFolderMenuFns } from \'../services/folderMenuService\';')
imp_lines.append('import { installMiscMenuFns } from \'../services/miscMenuService\';')
imp_lines.append('import { installBatchOpsFns } from \'../services/batchOpsService\';')
imp_lines.append('import { installFolderCoreFns } from \'../services/folderCoreService\';')
imp_lines.append('import { installImageOpsFns } from \'../services/imageOpsService\';')
imp_lines.append('import { installFontTagFns } from \'../services/fontTagService\';')

body = ['']
body.append('export function makeControllerFns(getScope: () => any) {')
body.append('  const fns: Record<string, any> = {};')
body.append('')
for tgt in sorted(ptr_by_target):
    body.append('  // ' + tgt)
    for nm in sorted(ptr_by_target[tgt]):
        body.append('  fns["%s"] = %s;' % (nm, nm))
body.append('')
body.append('  // b1-9bn..bt 菜单/批量/文件夹核心/图像操作/字体族 install 注册面（条目名零改动）')
body.append('  installFolderMenuFns(fns, getScope);')
body.append('  installMiscMenuFns(fns, getScope);')
body.append('  installBatchOpsFns(fns, getScope);')
body.append('  installFolderCoreFns(fns, getScope);')
body.append('  installImageOpsFns(fns, getScope);')
body.append('  installFontTagFns(fns, getScope);')
body.append('  return fns;')
body.append('}')
new_cf = '\n'.join(hdr + imp_lines + body) + '\n'
wr(CF, new_cf)

# ── 外部 import 改写 ──
dm = os.path.join(BASE, 'core', 'dataMachinery.ts')
t = rd(dm)
t = t.replace("import { updateCurrentOrderAndIncrease, isInFolder } from './controllerFns';",
              "import { updateCurrentOrderAndIncrease } from './miscDomain';\nimport { isInFolder } from './itemDomain';")
wr(dm, t)

ld = os.path.join(BASE, 'core', 'libraryDomain.ts')
t = rd(ld)
t = t.replace("import { isInFolder } from './controllerFns';", "import { isInFolder } from './itemDomain';")
wr(ld, t)

ms = os.path.join(BASE, 'services', 'miscMenuService.ts')
t = rd(ms)
t = t.replace("import { updateCurrentOrderAndIncrease } from '../core/controllerFns';",
              "import { updateCurrentOrderAndIncrease } from '../core/miscDomain';")
wr(ms, t)

idom = os.path.join(BASE, 'core', 'itemDomain.ts')
t = rd(idom)
t = t.replace("import { isInFolder } from './controllerFns';\n", "")
wr(idom, t)

# ── stage1c3 计数 263→236 ──
t = rd(TEST13)
assert 'Object.keys(c).length === 263' in t
t = t.replace('Object.keys(c).length === 263', 'Object.keys(c).length === 236')
t = t.replace('//    b1-9au 网格交互层（openFileWithDefault/\n//    openFileListContextMenu/openOrderMenu/onBoxMouseup/onBoxListDblClick）258→263）──',
              '//    b1-9au 网格交互层 258→263；b1-9bz-A 表体归位（148→121 指针 + 27 死壳删）263→236）──')
wr(TEST13, t)

print('APPLY OK')
print('指针数:', sum(len(v) for v in ptr_by_target.values()))
print('落点:', {k: len(v) for k, v in sorted(target_add.items())})
