#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""C-3/C-4 前置：列 $watch / $watchCollection 的全部使用点与 watcher 表达式形态。"""
import io, re, subprocess
from collections import Counter

ROOT = 'src/app/react'
files = [f for f in subprocess.check_output(['git', 'ls-files', ROOT], text=True).split()
         if f.endswith(('.ts', '.tsx'))]

rows = []
expr = Counter()
for f in files:
    s = io.open(f, encoding='utf-8', errors='ignore').read()
    L = s.split('\n')
    for i, l in enumerate(L):
        st = l.strip()
        if st.startswith(('//', '*', '/*')):
            continue
        m = re.search(r'\$watch(Collection)?\s*\(', l)
        if not m:
            continue
        rows.append((f.replace(ROOT + '/', ''), i + 1, m.group(1) or '', st[:104]))
        # 尝试取 watcher 表达式（首个实参）
        seg = l[m.end():m.end() + 60]
        e = seg.split(',')[0].strip()
        expr[e[:44]] += 1

print('=== $watch / $watchCollection 共 %d 处 ===' % len(rows))
for f, ln, kind, t in rows:
    print('   %-46s :%-5d %-11s %s' % (f, ln, kind or '$watch', t))
print()
print('=== watcher 表达式 TOP ===')
for k, v in expr.most_common(20):
    print('   %-46s %d' % (k, v))
