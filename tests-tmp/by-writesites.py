# -*- coding: utf-8 -*-
"""P4-by 考据：嵌套路径写入点分布量化"""
import re, os, io

SEP = os.sep
roots = ['eagle.filter', 'inspector', 'currentFolder', 'TagManager',
         'preferences', 'listLayoutSettings', 'pluginModule', 'containerSize',
         'imageSize', 'gifViewer', 'SavedFilter', 'selectedFolders', 'subFolders']
base = 'src/app/react'
alt = '|'.join(re.escape(r) for r in roots)
pat = re.compile(r'((?:\b(?:s|scope|w|window|\$root|self|eagle)\.(?:' + alt + r')(?:\.\w+)*))\s*=(?!=)')

counts = {}
for dirpath, _, files in os.walk(base):
    if 'node_modules' in dirpath:
        continue
    for fn in files:
        if not fn.endswith(('.ts', '.tsx')):
            continue
        p = os.path.join(dirpath, fn).replace(SEP, '/')
        src = io.open(p, encoding='utf-8').read()
        for m in pat.finditer(src):
            expr = m.group(1)
            norm = expr.replace('$root.', '.').replace('window.', '.').replace('w.', '.').replace('s.', '.').replace('scope.', '.').replace('self.', '.').replace('eagle.', '.')
            key = None
            for r in roots:
                if norm.startswith('.' + r) or norm == r or norm.startswith(r + '.') or ('.' + r + '.') in norm or ('.' + r) == norm:
                    key = r
                    break
            if not key:
                continue
            rel = p.replace(base + '/', '')
            counts.setdefault(key, {})
            counts[key][rel] = counts[key].get(rel, 0) + 1

total = 0
for root in sorted(counts, key=lambda k: -sum(counts[k].values())):
    n = sum(counts[root].values())
    total += n
    files = ', '.join('%s(%d)' % (f, c) for f, c in sorted(counts[root].items(), key=lambda kv: -kv[1])[:6])
    print('%-20s %3d | %s' % (root, n, files))
print('TOTAL nested write sites:', total)
