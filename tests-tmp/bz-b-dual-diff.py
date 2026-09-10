"""B 档短体体检：并列输出 c3 落点体与 machinery 体，供人工判等价。"""
import io
import json
import os
import re
import sys

d = json.load(io.open('tests-tmp/bz-b-scope-map.json', encoding='utf-8'))
cf = io.open('src/app/react/core/controllerFns.ts', encoding='utf-8').read()
imp = {}
for line in cf.split('\n'):
    if line.startswith('import {'):
        m = re.search(r"from '([^']+)'", line)
        if m:
            for p in re.search(r'\{([^}]*)\}', line).group(1).split(','):
                nm = p.strip().split(' as ')[0].strip()
                if nm:
                    imp[nm] = m.group(1)


def body(path, sym):
    t = io.open(path, encoding='utf-8').read()
    m = re.search(r'^(?:export\s+)?(?:async\s+)?function\s+%s\s*\(' % re.escape(sym), t, re.M)
    if not m:
        return None
    i = t.find('{', m.start())
    depth = 0
    for k in range(i, len(t)):
        if t[k] == '{':
            depth += 1
        elif t[k] == '}':
            depth -= 1
            if depth == 0:
                return t[m.start():k + 1]
    return None


import sys
SHORT = sys.argv[1:] or ['undo', 'toggleSelectSmartFolder', 'toggleSlideshow',
                         'focusAppUnlockPassword', 'changeSidebarIndex']
DM = 'src/app/react/core/dataMachinery.ts'

for name in SHORT:
    info = d.get(name, {})
    e = info.get('export')
    m = re.search(r'^\s*fns\["%s"\]\s*=\s*([A-Za-z0-9_$]+)\s*;' % re.escape(name), cf, re.M)
    sym = m.group(1) if m else None
    p = None
    if sym and sym in imp:
        c = os.path.normpath(os.path.join('src/app/react/core', imp[sym])).replace('\\', '/')
        p = c + '.ts' if os.path.exists(c + '.ts') else None
    print('=' * 78)
    print('## %s   (c3: %s @%s   |   machinery: %s)' % (name, sym, os.path.basename(p or '?'), e))
    print('-' * 78 + ' C3 落点体 ' + '-' * 40)
    print(body(p, sym) if (p and sym) else '<<未解析>>')
    print('-' * 78 + ' MACHINERY 体 ' + '-' * 38)
    print(body(DM, e) if e else '<<未解析>>')
