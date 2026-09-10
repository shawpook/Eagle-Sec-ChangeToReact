# -*- coding: utf-8 -*-
"""getBodyScope 引用形态分类：函数调用 / 属性读写 / 取引用后多次用"""
import re, io, os
BASE = 'src/app/react'
pat_call = re.compile(r'getBodyScope\(\)\.[A-Za-z_$]+\s*\(')
pat_prop_write = re.compile(r'getBodyScope\(\)\.[A-Za-z_$]+(\.[A-Za-z_$]+)*\s*=(?!=)')
pat_prop_read = re.compile(r'getBodyScope\(\)\.(?![A-Za-z_$]+\s*\()')
pat_assign = re.compile(r'(?:const|let|var)\s+\w+\s*=\s*getBodyScope\(\)')
total_call = total_write = total_read = total_assign = 0
per_file = {}
for dirpath, _, files in os.walk(BASE):
    if 'node_modules' in dirpath: continue
    for fn in files:
        if not fn.endswith(('.ts', '.tsx')): continue
        p = os.path.join(dirpath, fn)
        src = io.open(p, encoding='utf-8').read()
        c = len(pat_call.findall(src)); w = len(pat_prop_write.findall(src))
        r = len(pat_prop_read.findall(src)) - c - w  # 去重
        a = len(pat_assign.findall(src))
        if c + w + r + a:
            per_file[p.replace(BASE + os.sep, '').replace(BASE + '/', '')] = (c, max(0, r), w, a)
        total_call += c; total_write += w; total_read += max(0, r); total_assign += a
print('直接链式调用 s.fn():', total_call)
print('直接链式读 s.x:', total_read)
print('直接链式写 s.x=:', total_write)
print('取引用 const s = getBodyScope():', total_assign)
print('TOTAL refs:', total_call + total_read + total_write + total_assign)
print()
for f, (c, r, w, a) in sorted(per_file.items(), key=lambda kv: -sum(kv[1]))[:12]:
    print('%-46s call=%3d read=%3d write=%3d assign=%3d' % (f, c, r, w, a))
