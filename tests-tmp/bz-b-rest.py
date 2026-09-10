"""列出 bz-B 范围内剩余的 scope 面调用及其判档。"""
import io
import os
import re
import sys
from collections import Counter

sys.argv = ['x']
SRC = os.path.abspath('tests-tmp/bz-b-scope-direct.py')
ns = {}
exec(io.open(SRC, encoding='utf-8').read().split('def main()')[0], ns)
build_map = ns['build_map']
CALL_RE = ns['CALL_RE']

d = build_map()
c = Counter()
where = {}
SKIP = ('preview-window', 'preferences', 'collect-window')
for base, dirs, files in os.walk('src/app/react'):
    rel = base.replace('\\', '/')
    if any(x in rel for x in SKIP):
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

print('剩余非 $ 调用总计: %d 处 / %d 名' % (sum(c.values()), len(c)))
for nm, k in c.most_common(60):
    info = d.get(nm, {})
    print('%-30s x%-3d route=%-6s export=%-34s %s' % (
        nm, k, info.get('route', '?'), str(info.get('export')), where[nm][0]))
