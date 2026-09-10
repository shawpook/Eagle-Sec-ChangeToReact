# -*- coding: utf-8 -*-
"""bz 考据盘点：fns 表 148 壳 + dataMachinery 236 导出 + shim 函数面消费图谱。
只读分析，不改动业务代码。输出 tests-tmp/bz-inventory.json + 控制台摘要。
"""
import re, os, json, io, sys

BASE = r"H:\dev\Eagle-Sec-development - 副本\src\app\react"
TESTS = r"H:\dev\Eagle-Sec-development - 副本\tests"
OUT = r"H:\dev\Eagle-Sec-development - 副本\tests-tmp\bz-inventory.json"
DUALDIR = r"H:\dev\Eagle-Sec-development - 副本\tests-tmp\bz-dual"

def rd(p):
    with io.open(p, 'r', encoding='utf-8', errors='replace') as f:
        return f.read()

def walk_ts(base):
    out = []
    for root, dirs, files in os.walk(base):
        dirs[:] = [d for d in dirs if d not in ('node_modules', '.git')]
        for fn in files:
            if fn.endswith(('.ts', '.tsx')):
                out.append(os.path.join(root, fn))
    return out

SRC_FILES = walk_ts(BASE)
TEST_FILES = walk_ts(TESTS) if os.path.isdir(TESTS) else []

# ---------- 1. controllerFns 表体 ----------
CF = os.path.join(BASE, 'core', 'controllerFns.ts')
cf_text = rd(CF)
cf_lines = cf_text.split('\n')
fns_entries = []  # (name, start_line_idx0)
for i, ln in enumerate(cf_lines):
    m = re.match(r'\s*fns\["([A-Za-z_0-9]+)"\]\s*=', ln)
    if m:
        fns_entries.append((m.group(1), i))
# 尾界：下一个 fns[" 或 `return fns;`
ret_idx = next((i for i, ln in enumerate(cf_lines) if re.match(r'\s*return fns;', ln)), len(cf_lines))
fns_bodies = {}
for k, (name, start) in enumerate(fns_entries):
    nxt = fns_entries[k + 1][1] if k + 1 < len(fns_entries) else ret_idx
    fns_bodies[name] = {'start': start + 1, 'end': nxt, 'text': '\n'.join(cf_lines[start:nxt])}
fns_names = [n for n, _ in fns_entries]

# __lv_ 变量声明与使用
lv_decls = re.findall(r'var\s+(__lv_[A-Za-z_0-9]+)', cf_text)
lv_use = {}
for name, body in fns_bodies.items():
    for lv in set(re.findall(r'__lv_[A-Za-z_0-9]+', body['text'])):
        lv_use.setdefault(lv, set()).add(name)

# ---------- 2. dataMachinery 导出面 ----------
DM = os.path.join(BASE, 'core', 'dataMachinery.ts')
dm_text = rd(DM)
dm_exports = []
for m in re.finditer(r'^export\s+(?:async\s+)?function\s+([A-Za-z_0-9]+)', dm_text, re.M):
    dm_exports.append(m.group(1))
dm_export_set = set(dm_exports)

# applyDataMachineryScope 挂载名（s.xxx = ...）
app_start = dm_text.index('export function applyDataMachineryScope')
app_text = dm_text[app_start:]
mounted = re.findall(r'\bs\.([A-Za-z_0-9]+)\s*=', app_text)
mounted_set = set(mounted)

# ---------- 3. 消费方图谱 ----------
def grep_files(files, pattern):
    hits = {}
    rx = re.compile(pattern)
    for p in files:
        try:
            t = rd(p)
        except Exception:
            continue
        for i, ln in enumerate(t.split('\n'), 1):
            if rx.search(ln):
                rel = os.path.relpath(p, BASE).replace('\\', '/')
                hits.setdefault(rel, []).append(i)
    return hits

report = {}
for name in fns_names:
    ent = {'line': [fns_bodies[name]['start'], fns_bodies[name]['end']],
           'size': fns_bodies[name]['end'] - fns_bodies[name]['start']}
    # callScope('name') / callScope("name")
    cs = grep_files(SRC_FILES, r"callScope\(\s*['\"]" + re.escape(name) + r"['\"]")
    if cs:
        ent['callScope'] = {k: len(v) for k, v in cs.items()}
    # scope 函数面：s.name( / scope.name( / Scope().name( / ['name'](
    sf = grep_files(SRC_FILES, r"(?:\bs|\bscope|Scope\(\))\." + re.escape(name) + r"\s*\(|\[['\"]" + re.escape(name) + r"['\"]\]\s*\(")
    sf = {k: v for k, v in sf.items() if not k.startswith('core/controllerFns.ts') or True}
    if sf:
        ent['scopeFace'] = {k: len(v) for k, v in sf.items()}
    # 测试面
    ts = grep_files(TEST_FILES, r"['\"]" + re.escape(name) + r"['\"]|\b" + re.escape(name) + r"\b")
    if ts:
        ent['tests'] = {k: len(v) for k, v in ts.items()}
    ent['dualMachinery'] = name in mounted_set
    ent['dualMachineryExport'] = name in dm_export_set
    report[name] = ent

# 4 独立导出消费方
standalone = {}
for fn in ['updateCurrentOrderAndIncrease', 'isInFolder', 'parseKeywordsWithOR', 'updateSuggestions']:
    cons = {}
    for p in SRC_FILES:
        t = rd(p)
        if p == CF:
            continue
        if re.search(r'import\s*\{[^}]*\b' + fn + r'\b[^}]*\}\s*from', t, re.S) or re.search(r'\b' + fn + r'\b', t):
            rel = os.path.relpath(p, BASE).replace('\\', '/')
            if rel != 'core/controllerFns.ts':
                cons[rel] = len(re.findall(r'\b' + fn + r'\b', t))
    standalone[fn] = cons

# machinery 导出消费方（import 面）
dm_consumers = {}
for name in dm_exports:
    files = []
    for p in SRC_FILES:
        rel = os.path.relpath(p, BASE).replace('\\', '/')
        if rel == 'core/dataMachinery.ts':
            continue
        t = rd(p)
        if re.search(r"from\s+'[^']*dataMachinery'", t) and re.search(r'\b' + re.escape(name) + r'\b', t):
            files.append(rel)
    if files:
        dm_consumers[name] = files

# getBodyScope / scopeApply 每文件计数
gbs = {os.path.relpath(p, BASE).replace('\\', '/'): len(re.findall(r'\bgetBodyScope\(', rd(p)))
       for p in SRC_FILES if re.search(r'\bgetBodyScope\(', rd(p))}
sap = {os.path.relpath(p, BASE).replace('\\', '/'): len(re.findall(r'\bscopeApply\(', rd(p)))
       for p in SRC_FILES if re.search(r'\bscopeApply\(', rd(p))}

# 双键双体 dump（对比用）
os.makedirs(DUALDIR, exist_ok=True)
dual = [n for n in fns_names if n in mounted_set]
for n in dual:
    with io.open(os.path.join(DUALDIR, n + '.fns.txt'), 'w', encoding='utf-8') as f:
        f.write(fns_bodies[n]['text'])
    # machinery 侧函数体（export function name ... 到下一个 export）
    m = re.search(r'^export\s+(?:async\s+)?function\s+' + re.escape(n) + r'\s*\(', dm_text, re.M)
    if m:
        nxt = re.search(r'^export\s+', dm_text[m.end():], re.M)
        end = m.end() + (nxt.start() if nxt else 4000)
        with io.open(os.path.join(DUALDIR, n + '.mach.txt'), 'w', encoding='utf-8') as f:
            f.write(dm_text[m.start():end])

out = {
    'fnsCount': len(fns_names),
    'fnsTotalLines': sum(v['size'] for v in report.values()),
    'lvVars': {k: sorted(v) for k, v in lv_use.items()},
    'lvDeclCount': len(set(lv_decls)),
    'dualKeys': dual,
    'standaloneConsumers': standalone,
    'machineryExportCount': len(dm_exports),
    'machineryMountedCount': len(mounted_set),
    'machineryConsumers': dm_consumers,
    'getBodyScope': gbs,
    'scopeApply': sap,
    'fns': report,
}
with io.open(OUT, 'w', encoding='utf-8') as f:
    json.dump(out, f, ensure_ascii=False, indent=1, default=lambda o: sorted(o) if isinstance(o, set) else o)

# ---------- 摘要 ----------
print('fns 表壳数:', len(fns_names), ' 表体总行数:', sum(v['size'] for v in report.values()))
print('双键（machinery 也挂同名）:', len(dual))
print('  ', dual)
dead = [n for n, v in report.items() if 'callScope' not in v and 'scopeFace' not in v and 'tests' not in v]
print('零消费壳（callScope/scopeFace/tests 全无）:', len(dead))
print('  ', dead)
only_callscope = [n for n, v in report.items() if 'callScope' in v and 'scopeFace' not in v]
print('仅 callScope 消费:', len(only_callscope))
both = [n for n, v in report.items() if 'callScope' in v and 'scopeFace' in v]
print('callScope + scopeFace 双消费:', len(both), both)
print('仅 scopeFace 消费:', [n for n, v in report.items() if 'callScope' not in v and 'scopeFace' in v])
print('有测试引用:', [n for n, v in report.items() if 'tests' in v])
print('独立导出消费方:', json.dumps(standalone, indent=1))
print('machinery 导出数:', len(dm_exports), ' 挂载数:', len(mounted_set))
print('machinery 有 import 消费方的导出数:', len(dm_consumers))
zero_imp = [n for n in dm_exports if n not in dm_consumers]
print('machinery 零 import 消费导出（仅 scope 面/内部）:', len(zero_imp))
print('  ', zero_imp[:40])
print('getBodyScope top10:', sorted(gbs.items(), key=lambda x: -x[1])[:10])
print('scopeApply:', sap)
print('OK ->', OUT)
