#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""C-2：把测试侧对已迁移频道的 $root.$broadcast 驱动改为 window.__eagleBus.emit。

频道迁到 eagleBus 后，接收端改为 channel.on，不再监听 scope 广播 —— 测试若仍用
`body.$root.$broadcast(...)` 驱动将无人接收（与 B8 摘 fns 表后同型）。
bus.ts 已把实例挂在 window.__eagleBus。
"""
import io, re

CH = ['MOVE-CROP-TOOL', 'RESIZE-CROP-TOOL', 'SET-FOLDER-PASSWORD', 'OPEN_RENAME',
      'REFRESH_VIDEO_COMMENTS', 'ADD_TO_LIBRARY', 'OPEN_DUPLICATE_SCAN_PANEL', 'OPEN_DUPLICATE']
FILES = ['tests/react-stage7c-smoke.mjs', 'tests/react-stage7d2-smoke.mjs',
         'tests/react-stage7d4-smoke.mjs', 'tests/react-stage7d6b-smoke.mjs']

tot = 0
for p in FILES:
    s = io.open(p, encoding='utf-8', newline='').read()
    nl = '\r\n' if '\r\n' in s else '\n'
    t = s.replace('\r\n', '\n')
    n = 0
    for ch in CH:
        pat = r'[A-Za-z_$][\w$.]*\$root\.\$broadcast\(\s*[\'"]' + re.escape(ch) + r'[\'"]\s*,\s*'
        t, k = re.subn(pat, "window.__eagleBus.emit('%s', " % ch, t)
        n += k
        # 无载荷形态
        pat2 = r'[A-Za-z_$][\w$.]*\$root\.\$broadcast\(\s*[\'"]' + re.escape(ch) + r'[\'"]\s*\)'
        t, k2 = re.subn(pat2, "window.__eagleBus.emit('%s')" % ch, t)
        n += k2
    if n:
        io.open(p, 'w', encoding='utf-8', newline='').write(t.replace('\n', nl))
        print('  %-40s %d 处' % (p, n))
        tot += n
print('合计改写 %d 处' % tot)
