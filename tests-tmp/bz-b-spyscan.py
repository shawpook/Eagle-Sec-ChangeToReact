"""扫描 tests/ 中被 spy/替换的 scope 面函数名（测试契约依赖 scope 面可拦截）。"""
import io
import os
import re
from collections import Counter

PATS = [
    re.compile(r'(?:const|let|var)\s+\w*[Oo]rig\w*\s*=\s*(?:s|scope|bodyScope|window\.\$bodyScope)\.([A-Za-z_$][\w$]*)'),
    re.compile(r'(?:s|scope|bodyScope|window\.\$bodyScope)\.([A-Za-z_$][\w$]*)\s*=\s*function'),
    re.compile(r'(?:s|scope|bodyScope|window\.\$bodyScope)\.([A-Za-z_$][\w$]*)\s*=\s*\('),
    re.compile(r'\.__spy\w*\s*=\s*(?:s|scope)\.([A-Za-z_$][\w$]*)'),
]

hits = Counter()
where = {}
for base, _d, files in os.walk('tests'):
    for fn in files:
        if not fn.endswith(('.mjs', '.js', '.cjs')):
            continue
        p = os.path.join(base, fn)
        t = io.open(p, encoding='utf-8', errors='ignore').read()
        for pat in PATS:
            for m in pat.finditer(t):
                n = m.group(1)
                if n.startswith('$'):
                    continue
                hits[n] += 1
                where.setdefault(n, set()).add(p.replace('\\', '/'))

print('测试中被 spy 的 scope 面函数名：%d 个' % len(hits))
for n, k in hits.most_common(60):
    print('  %-32s x%-3d  %s' % (n, k, ', '.join(sorted(where[n])[:2])))
