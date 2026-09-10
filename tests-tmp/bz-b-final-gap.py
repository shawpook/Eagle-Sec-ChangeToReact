"""bz-B 收官差距分析：剩余 scope 面调用逐名给出处置结论（只读）。"""
import io
import json
import os
import re
import sys
from collections import Counter

sys.argv = ['x']
exec(io.open('tests-tmp/bz-b-scope-direct.py', encoding='utf-8').read().split('def main()')[0], globals())

d = build_map()
c = Counter()
where = {}
SKIP = ('preview-window', 'preferences', 'collect-window')
for base, _dirs, files in os.walk('src/app/react'):
    rel0 = base.replace('\\', '/')
    if any(x in rel0 for x in SKIP):
        continue
    for fn in files:
        if not fn.endswith(('.ts', '.tsx')):
            continue
        p = os.path.join(base, fn)
        s = io.open(p, encoding='utf-8').read()
        for m in CALL_RE.finditer(s):
            nm = m.group(2)
            if nm.startswith('$'):
                continue
            c[nm] += 1
            where.setdefault(nm, []).append(p.replace('\\', '/'))

CAT = {}
for nm, k in c.items():
    info = d.get(nm, {})
    r = info.get('route', '?')
    if nm == 'X':
        cat = 'DYNAMIC（s[X](...) 动态键，非具名）'
    elif r == 'SKIP':
        cat = 'KEEP-注入（外部注入的 fn 指针，非 machinery 体）'
    elif r == 'PREBIND':
        cat = 'KEEP-带参（预绑实例仅零参可还原，带参调用保留）'
    elif r == 'TABLE' and not info.get('export'):
        cat = 'TODO-提升（fns 表项无具名导出，需先提升）'
    elif r == 'MACH' or r == 'DUAL':
        cat = 'TODO-局部（判定可改，需查局部遮蔽）'
    else:
        cat = 'KEEP-无供给（machinery 与 fns 表都无，保留回退）'
    CAT.setdefault(cat, []).append((nm, k, r, where[nm][0]))

tot = 0
for cat in sorted(CAT, key=lambda x: -sum(k for _, k, _, _ in CAT[x])):
    items = sorted(CAT[cat], key=lambda x: -x[1])
    sub = sum(k for _, k, _, _ in items)
    tot += sub
    print('\n### %s —— %d 处 / %d 名' % (cat, sub, len(items)))
    for nm, k, r, f in items[:14]:
        print('   %-30s x%-3d route=%-6s %s' % (nm, k, r, f))
print('\n剩余总计：%d 处' % tot)
