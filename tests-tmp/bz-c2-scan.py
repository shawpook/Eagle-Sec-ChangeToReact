#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""C-2：列 $broadcast / $on 频道的收发分布与位置。
用法：python tests-tmp/bz-c2-scan.py [CHANNEL ...]   （不带参数=列表，带参数=打印位置）
"""
import io, re, subprocess, sys
from collections import Counter, defaultdict

files = [f for f in subprocess.check_output(['git', 'ls-files', 'src/app/react'], text=True).split()
         if f.endswith(('.ts', '.tsx'))]
BC = re.compile(r'\$broadcast\(\s*[\'"]([A-Za-z0-9_.\-]+)[\'"]')
ON = re.compile(r'\$on\(\s*[\'"]([A-Za-z0-9_.\-]+)[\'"]')

bc, on = Counter(), Counter()
loc = defaultdict(list)
for f in files:
    s = io.open(f, encoding='utf-8', errors='ignore').read()
    L = s.split('\n')
    for i, l in enumerate(L):
        if l.strip().startswith('*') or l.strip().startswith('//'):
            continue
        for m in BC.finditer(l):
            bc[m.group(1)] += 1
            loc[m.group(1)].append(('B', f.replace('src/app/react/', ''), i + 1, l.strip()[:70]))
        for m in ON.finditer(l):
            on[m.group(1)] += 1
            loc[m.group(1)].append(('O', f.replace('src/app/react/', ''), i + 1, l.strip()[:70]))

if len(sys.argv) > 1:
    for ch in sys.argv[1:]:
        print('=== %s (emit %d / on %d) ===' % (ch, bc.get(ch, 0), on.get(ch, 0)))
        for kind, f, ln, txt in loc.get(ch, []):
            print('   %s %-46s :%-5d %s' % (kind, f, ln, txt))
        print()
else:
    print('%-38s %5s %4s' % ('CHANNEL', 'emit', 'on'))
    rows = sorted(((bc.get(c, 0) + on.get(c, 0), c) for c in set(bc) | set(on)), reverse=True)
    for tot, c in rows:
        print('  %-36s %5d %4d' % (c, bc.get(c, 0), on.get(c, 0)))
    print()
    print('频道 %d 个；emit %d / on %d' % (len(set(bc) | set(on)), sum(bc.values()), sum(on.values())))
