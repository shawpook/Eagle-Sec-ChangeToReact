# -*- coding: utf-8 -*-
"""数组根写入点量化：filtereds/allData/trash/raw/subFolders"""
import re, os, io

roots = ['filtereds', 'allData', 'trash', 'raw', 'subFolders']
alt = '|'.join(r for r in roots)
pat = re.compile(r'((?:\$root|window|scope|self|body|w|s)\.(?:' + alt + r')\b)')
mut = re.compile(r'(?:=(?!=)|(?:push|unshift|splice|pop|shift)\()')
base = 'src/app/react'
SEP = os.sep
counts = {}
for dirpath, _, files in os.walk(base):
    if 'node_modules' in dirpath: continue
    for fn in files:
        if not fn.endswith(('.ts', '.tsx')): continue
        p = os.path.join(dirpath, fn).replace(SEP, '/')
        src = io.open(p, encoding='utf-8').read()
        # 逐行扫，行内先找根引用再看行尾是否赋值/变异
        for line in src.splitlines():
            for m in pat.finditer(line):
                frag = m.group(1)
                root = frag.split('.')[-1]
                rest = line[m.end():]
                if re.match(r'\s*(?:\.\w+)*(?:\.length)?\s*(?:=(?!=)|(?:(?:push|unshift|splice|pop|shift)\())', rest):
                    rel = p.replace(base + '/', '')
                    counts.setdefault(root, {})
                    counts[root][rel] = counts[root].get(rel, 0) + 1
                break

total = 0
for root in sorted(counts, key=lambda k: -sum(counts[k].values())):
    n = sum(counts[root].values())
    total += n
    files = ', '.join('%s(%d)' % (f, c) for f, c in sorted(counts[root].items(), key=lambda kv: -kv[1])[:7])
    print('%-12s %3d | %s' % (root, n, files))
print('TOTAL:', total)
