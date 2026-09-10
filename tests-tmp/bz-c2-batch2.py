#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""C-2 第二批：REFRESH_VIDEO_COMMENTS / ADD_TO_LIBRARY / OPEN_DUPLICATE_SCAN_PANEL / OPEN_DUPLICATE"""
import io, re

BUS = 'src/app/react/global/bus.ts'
s = io.open(BUS, encoding='utf-8', newline='').read()
nl = '\r\n' if '\r\n' in s else '\n'
t = s.replace('\r\n', '\n')
if 'refreshVideoCommentsChannel' not in t:
    t = t.rstrip('\n') + """

// ── b1-9bz-C-2 第二批 ──
export const refreshVideoCommentsChannel = defineChannel<void>('REFRESH_VIDEO_COMMENTS');
export const addToLibraryChannel = defineChannel<any>('ADD_TO_LIBRARY');
export const openDuplicateScanPanelChannel = defineChannel<any>('OPEN_DUPLICATE_SCAN_PANEL');
export const openDuplicateChannel = defineChannel<any>('OPEN_DUPLICATE');
"""
    io.open(BUS, 'w', encoding='utf-8', newline='').write(t.replace('\n', nl))
    print('bus.ts 频道已声明')

CHANS = {
    'REFRESH_VIDEO_COMMENTS': 'refreshVideoCommentsChannel',
    'ADD_TO_LIBRARY': 'addToLibraryChannel',
    'OPEN_DUPLICATE_SCAN_PANEL': 'openDuplicateScanPanelChannel',
    'OPEN_DUPLICATE': 'openDuplicateChannel',
}

RECV = r'[A-Za-z_$][\w$]*(?:\(\))?\??\.'

FILES = [
    ('src/app/react/components/inspector/inspectorActions.ts', '../global/bus'),
    ('src/app/react/services/mediaService.ts', '../global/bus'),
    ('src/app/react/core/tagManagerDomain.ts', '../global/bus'),
    ('src/app/react/services/folderMenuService.ts', '../global/bus'),
    ('src/app/react/services/itemMenuService.ts', '../global/bus'),
    ('src/app/react/core/dataMachinery.ts', '../global/bus'),
    ('src/app/react/core/itemDomain.ts', '../global/bus'),
    ('src/app/react/components/detail/detailHooks.ts', '../../global/bus'),
    ('src/app/react/components/stage7/ProgressDialogs.tsx', '../../global/bus'),
    ('src/app/react/components/stage7/DuplicateFamily.tsx', '../../global/bus'),
    ('src/app/react/components/stage7/BatchSavePanel.tsx', '../../global/bus'),
]

import sys as _sys
_ONLY = set(_sys.argv[1:])
if _ONLY:
    FILES = [x for x in FILES if any(k in x[0] for k in _ONLY)]
    print('仅处理: %s' % ', '.join(x[0] for x in FILES))

for f, mod in FILES:
    try:
        s = io.open(f, encoding='utf-8', newline='').read()
    except IOError:
        continue
    nl = '\r\n' if '\r\n' in s else '\n'
    t = s.replace('\r\n', '\n')
    need, n = [], 0
    for ch, var in CHANS.items():
        # emit 有载荷
        t, k1 = re.subn(RECV + r'\$broadcast\(\s*[\'"]' + re.escape(ch) + r'[\'"]\s*,\s*', var + '.emit(', t)
        # emit 无载荷
        t, k2 = re.subn(RECV + r'\$broadcast\(\s*[\'"]' + re.escape(ch) + r'[\'"]\s*\)', var + '.emit()', t)
        # on
        t, k3 = re.subn(RECV + r'\$on\(\s*[\'"]' + re.escape(ch) + r'[\'"]\s*,\s*', var + '.on(', t)
        if k1 + k2 + k3:
            need.append(var)
            n += k1 + k2 + k3
    if not n:
        continue
    m = re.search(r"^import \{([^}]*)\} from '%s';$" % re.escape(mod), t, re.M)
    if m:
        names = sorted(set([x.strip() for x in m.group(1).split(',') if x.strip()] + need))
        t = t[:m.start()] + "import { %s } from '%s';" % (', '.join(names), mod) + t[m.end():]
    else:
        lines = t.split('\n')
        last = max(i for i, l in enumerate(lines) if l.startswith('import '))
        lines.insert(last + 1, "import { %s } from '%s';" % (', '.join(sorted(need)), mod))
        t = '\n'.join(lines)
    io.open(f, 'w', encoding='utf-8', newline='').write(t.replace('\n', nl))
    print('  %-52s %d 处' % (f.replace('src/app/react/', ''), n))

# handler 签名：(e, params) → (params)（本批 3 处具名/匿名 handler）
SIG = [
    ('src/app/react/components/stage7/ProgressDialogs.tsx',
     'const onAddToLibrary = (e: any, params: any) => {', 'const onAddToLibrary = (params: any) => {'),
]
for f, a, b in SIG:
    s = io.open(f, encoding='utf-8', newline='').read()
    nl = '\r\n' if '\r\n' in s else '\n'
    t = s.replace('\r\n', '\n')
    if a in t:
        io.open(f, 'w', encoding='utf-8', newline='').write(t.replace(a, b, 1).replace('\n', nl))
        print('  签名修正 %s' % f.replace('src/app/react/', ''))
