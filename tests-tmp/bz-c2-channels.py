#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""C-2 第一批：4 个频道从 $broadcast/$on 迁到 eagleBus。

选型：MOVE-CROP-TOOL / RESIZE-CROP-TOOL / SET-FOLDER-PASSWORD / OPEN_RENAME
（均不涉及 B6 保留的 4 个契约观测点，也不在 EXCLUDE spy 名单内）。
CALCULATE_IMAGE_BINDING 因 calculateImageBinding 在 EXCLUDE 内，本批跳过。
"""
import io, re

BUS = 'src/app/react/global/bus.ts'

# ── 1) bus.ts 追加频道声明 ──
s = io.open(BUS, encoding='utf-8', newline='').read()
nl = '\r\n' if '\r\n' in s else '\n'
t = s.replace('\r\n', '\n')
if 'moveCropToolChannel' not in t:
    t = t.rstrip('\n') + """

// ── b1-9bz-C-2：裁剪工具 / 文件夹密码 / 批量重命名的频道迁移 ──
// 载荷沿用原广播：MOVE/RESIZE-CROP-TOOL = { horizontal, vertical }；
// SET-FOLDER-PASSWORD = { folder, mode: 'new' | 'change' | 'reset' }；
// OPEN_RENAME = { type, images, ... }（原 $on 的 params）。
export const moveCropToolChannel = defineChannel<any>('MOVE-CROP-TOOL');
export const resizeCropToolChannel = defineChannel<any>('RESIZE-CROP-TOOL');
export const setFolderPasswordChannel = defineChannel<any>('SET-FOLDER-PASSWORD');
export const openRenameChannel = defineChannel<any>('OPEN_RENAME');
"""
    io.open(BUS, 'w', encoding='utf-8', newline='').write(t.replace('\n', nl))
    print('bus.ts 频道已声明')

# ── 2) 各文件改写 ──
JOBS = [
    # file, [(channel_var, 频道名, 模块相对路径)]
    ('src/app/react/core/dataMachinery.ts',
     [('moveCropToolChannel', 'MOVE-CROP-TOOL'),
      ('resizeCropToolChannel', 'RESIZE-CROP-TOOL'),
      ('openRenameChannel', 'OPEN_RENAME')],
     './../global/bus'),
    ('src/app/react/services/folderMenuService.ts',
     [('setFolderPasswordChannel', 'SET-FOLDER-PASSWORD')], '../global/bus'),
    ('src/app/react/components/inspector/inspectorActions.ts',
     [('setFolderPasswordChannel', 'SET-FOLDER-PASSWORD')], '../../global/bus'),
    ('src/app/react/core/contextMenuDomain.ts',
     [('openRenameChannel', 'OPEN_RENAME')], '../global/bus'),
]

EMIT_RE = r'[A-Za-z_$][\w$]*(?:\(\))?\??\.\$broadcast\(\s*[\'"]%s[\'"]\s*,\s*'

for f, chans, mod in JOBS:
    s = io.open(f, encoding='utf-8', newline='').read()
    nl = '\r\n' if '\r\n' in s else '\n'
    t = s.replace('\r\n', '\n')
    n = 0
    need = []
    for var, name in chans:
        t, k = re.subn(EMIT_RE % re.escape(name), var + '.emit(', t)
        if k:
            n += k
            need.append(var)
    if not n:
        continue
    # 补 import
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
    print('  %-52s emit %d 处' % (f.replace('src/app/react/', ''), n))

# ── 3) on 侧改写（签名 (event, params) → (params)）──
ON_JOBS = [
    ('src/app/react/components/detail/commentHooks.ts', [
        ("const offMove = getBodyScope()?.$on('MOVE-CROP-TOOL', function (event: any, params: any) {",
         "const offMove = moveCropToolChannel.on(function (params: any) {"),
        ("const offResize = getBodyScope()?.$on('RESIZE-CROP-TOOL', function (event: any, params: any) {",
         "const offResize = resizeCropToolChannel.on(function (params: any) {"),
    ], '../../global/bus', ['moveCropToolChannel', 'resizeCropToolChannel']),
    ('src/app/react/components/stage7/SmallPanels.tsx', [
        ("const off = scope.$on('SET-FOLDER-PASSWORD', (e: any, params: any) => {",
         "const off = setFolderPasswordChannel.on((params: any) => {"),
    ], '../../global/bus', ['setFolderPasswordChannel']),
    ('src/app/react/components/stage7/BatchRenameArtstationModals.tsx', [
        ("const off = body.$on('OPEN_RENAME', (e: any, params: any) => {",
         "const off = openRenameChannel.on((params: any) => {"),
    ], '../../global/bus', ['openRenameChannel']),
]

for f, pairs, mod, need in ON_JOBS:
    s = io.open(f, encoding='utf-8', newline='').read()
    nl = '\r\n' if '\r\n' in s else '\n'
    t = s.replace('\r\n', '\n')
    n = 0
    for a, b in pairs:
        if a in t:
            t = t.replace(a, b, 1)
            n += 1
        else:
            print('  !! 未匹配 %s :: %s' % (f, a[:60]))
    if n:
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
    print('  %-52s on %d 处' % (f.replace('src/app/react/', ''), n))
