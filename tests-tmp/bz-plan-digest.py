#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""规划用：digest 面形态分布（$evalAsync / scopeApply / $broadcast / $on）。"""
import io, re, subprocess
from collections import Counter

files = [f for f in subprocess.check_output(['git', 'ls-files', 'src/app/react'], text=True).split()
         if f.endswith(('.ts', '.tsx'))]

def recv_dist(key):
    c = Counter()
    for f in files:
        s = io.open(f, encoding='utf-8', errors='ignore').read()
        for m in re.finditer(r'([A-Za-z_$][\w$]{0,30}?)\s*\.\s*' + re.escape(key), s):
            c[m.group(1)] += 1
    return c

for key in ['$evalAsync', '$broadcast', '$on', '$watch', '$watchCollection', '$apply']:
    c = recv_dist(key)
    print('=== %s 接收者 TOP ===' % key)
    for k, v in c.most_common(6):
        print('   %-30s %4d' % (k, v))
    print()

# $broadcast 频道名分布
ch = Counter()
for f in files:
    s = io.open(f, encoding='utf-8', errors='ignore').read()
    for m in re.finditer(r'\$broadcast\(\s*[\'"]([A-Za-z0-9_.\-]+)[\'"]', s):
        ch[m.group(1)] += 1
    for m in re.finditer(r'\$broadcast\(\s*([A-Z_][A-Z0-9_]+)\s*[,)]', s):
        ch[m.group(1)] += 1
print('=== $broadcast 频道 %d 个（TOP 12）===' % len(ch))
for k, v in ch.most_common(12):
    print('   %-34s %3d' % (k, v))

onch = Counter()
for f in files:
    s = io.open(f, encoding='utf-8', errors='ignore').read()
    for m in re.finditer(r'\$on\(\s*[\'"]([A-Za-z0-9_.\-]+)[\'"]', s):
        onch[m.group(1)] += 1
    for m in re.finditer(r'\$on\(\s*([A-Z_][A-Z0-9_]+)\s*[,)]', s):
        onch[m.group(1)] += 1
print()
print('=== $on 频道 %d 个（TOP 12）===' % len(onch))
for k, v in onch.most_common(12):
    print('   %-34s %3d' % (k, v))

bc = set(ch); on = set(onch)
print()
print('  广播有发送无接收: %d 个 -> %s' % (len(bc - on), ' '.join(sorted(bc - on)[:14])))
print('  有接收无发送    : %d 个 -> %s' % (len(on - bc), ' '.join(sorted(on - bc)[:14])))
