#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""C-2：测试侧驱动改写（第二波）—— 覆盖所有接收者形态（$root / scope / body）。"""
import io, re

CH = ['MOVE-CROP-TOOL', 'RESIZE-CROP-TOOL', 'SET-FOLDER-PASSWORD', 'OPEN_RENAME',
      'REFRESH_VIDEO_COMMENTS', 'ADD_TO_LIBRARY', 'OPEN_DUPLICATE_SCAN_PANEL', 'OPEN_DUPLICATE',
      'WEBP_CONVERT_START', 'UPDATE_INSPECTOR', 'NEW.SMART.FOLDER',
      'INSPECTOR.TAG.SELECT.PANEL.OPEN', 'SAVE_FOLDER', 'OPEN_QUICK_SEARCH_MODAL', 'OPEN_URL_IN_PANEL']

FILES = ['tests/react-stage7c2-smoke.mjs', 'tests/react-stage7d1b-smoke.mjs',
         'tests/react-stage7d1c2-smoke.mjs', 'tests/react-stage7d3a-smoke.mjs',
         'tests/react-stage7d6c-smoke.mjs', 'tests/probe-7d2.mjs']

for p in FILES:
    try:
        s = io.open(p, encoding='utf-8', newline='').read()
    except IOError:
        continue
    nl = '\r\n' if '\r\n' in s else '\n'
    t = s.replace('\r\n', '\n')
    n = 0
    for ch in CH:
        # 任意接收者：xx.$broadcast('CH', payload)
        pat = r'[A-Za-z_$][\w$.]*\$broadcast\(\s*[\'"]' + re.escape(ch) + r'[\'"]\s*,\s*'
        t, k = re.subn(pat, "window.__eagleBus.emit('%s', " % ch, t)
        n += k
        pat2 = r'[A-Za-z_$][\w$.]*\$broadcast\(\s*[\'"]' + re.escape(ch) + r'[\'"]\s*\)'
        t, k2 = re.subn(pat2, "window.__eagleBus.emit('%s')" % ch, t)
        n += k2
    if n:
        io.open(p, 'w', encoding='utf-8', newline='').write(t.replace('\n', nl))
        print('  %-40s %d 处' % (p, n))
