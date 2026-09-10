#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""下一批规划用：量化剩余改造面（digest 面 / shim 面 / 窗口面 / 挂载面）。"""
import io, os, re, subprocess
from collections import Counter, defaultdict

ROOT = 'src/app/react'
files = [f for f in subprocess.check_output(['git', 'ls-files', ROOT], text=True).split()
         if f.endswith(('.ts', '.tsx'))]

KEYS = ['$watch', '$watchCollection', '$apply', '$evalAsync', '$digest', '$broadcast',
        '$on', '$emit', 'scopeShim', 'scopeBridge', 'coreState', 'getBodyScope',
        'getRootScope', 'scopeApply', '$timeout']

def cnt(s, k):
    return len(re.findall(re.escape(k) + r'(?![A-Za-z0-9_$])', s))

per = Counter()
byfile = defaultdict(lambda: Counter())
for f in files:
    s = io.open(f, encoding='utf-8', errors='ignore').read()
    for k in KEYS:
        n = cnt(s, k)
        if n:
            per[k] += n
            byfile[f.replace(ROOT + '/', '')][k] += n

print('=== 全树关键面计数 ===')
for k, v in per.most_common():
    print('   %-20s %5d' % (k, v))

print()
print('=== 按目录分布（digest 族：$watch/$watchCollection/$apply/$evalAsync/$digest/$broadcast/$on）===')
DIG = ['$watch', '$watchCollection', '$apply', '$evalAsync', '$digest', '$broadcast', '$on']
bydir = Counter()
for f, c in byfile.items():
    d = f.split('/')[0] if '/' in f else '(root)'
    bydir[d] += sum(c.get(k, 0) for k in DIG)
for d, v in bydir.most_common(14):
    print('   %-34s %4d' % (d, v))

print()
print('=== 三大窗口面（preview-window / collect-window / preferences）独立统计 ===')
WINS = ('preview-window/', 'collect-window/', 'preferences/')
for w in WINS:
    sub = [f for f in files if f.replace(ROOT + '/', '').startswith(w)]
    c = Counter()
    for f in sub:
        s = io.open(f, encoding='utf-8', errors='ignore').read()
        for k in KEYS:
            n = cnt(s, k)
            if n:
                c[k] += n
        # 该窗口的 scope 面调用
        c['s.X('] += len(re.findall(r'(?<![\w$.])(?:s|scope|bodyScope)\.[A-Za-z_$][\w$]*\s*\(', s))
    print('   %-18s 文件 %2d  %s' % (w, len(sub), dict(c.most_common(8))))

print()
print('=== scope 面残留（非我方写入、且非挂载）的粗量 ===')
tot = 0
for f in files:
    rel = f.replace(ROOT + '/', '')
    s = io.open(f, encoding='utf-8', errors='ignore').read()
    n = len(re.findall(r'(?<![\w$.])(?:s|scope|s0|bodyScope)\.(?!\$)[A-Za-z_$][\w$]*\s*\(', s))
    tot += n
print('   s.X( 调用合计 %d 处' % tot)
