#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""C-2：最后 3 个频道（REBIND_REFRESH / CALCULATE_IMAGE_BINDING / UPDATE_SELECTION）
迁走后，测试侧契约同步改写：
- scope.__bus['CH'] 断言 → window.__eagleBus.listenerCount('CH')
- $root.$broadcast('CH') 驱动 → window.__eagleBus.emit('CH')
- $root.$on('CH', h) 监听 → window.__eagleBus.on('CH', h)
"""
import io

EDITS = [
    ('tests/react-stage1m1-unified-smoke.mjs',
     "const a4 = F.takenOver === true && lc('keyword-suggestion') >= 1 && lc('show-and-search') >= 1 && (s.__bus['REBIND_REFRESH'] || []).length >= 1;",
     "const a4 = F.takenOver === true && lc('keyword-suggestion') >= 1 && lc('show-and-search') >= 1 && window.__eagleBus.listenerCount('REBIND_REFRESH') >= 1;"),
    ('tests/react-stage1m1-unified-smoke.mjs',
     "const a5 = S.takenOver === true && (s.__bus['UPDATE_SELECTION'] || []).length >= 1 && window.__eagleBus.listenerCount('SAVE_FOLDER') >= 1;",
     "const a5 = S.takenOver === true && window.__eagleBus.listenerCount('UPDATE_SELECTION') >= 1 && window.__eagleBus.listenerCount('SAVE_FOLDER') >= 1;"),
    ('tests/react-stage1m1-unified-smoke.mjs',
     "s.$root.$broadcast('REBIND_REFRESH', true);",
     "window.__eagleBus.emit('REBIND_REFRESH', true);"),
    ('tests/react-stage1m1-unified-smoke.mjs',
     "s.$root.$broadcast('UPDATE_SELECTION');",
     "window.__eagleBus.emit('UPDATE_SELECTION');"),
    ('tests/react-stage7d4-smoke.mjs',
     "body.$root.$on('CALCULATE_IMAGE_BINDING', () => { window.__calcBindings++; });",
     "window.__eagleBus.on('CALCULATE_IMAGE_BINDING', () => { window.__calcBindings++; });"),
]

n = 0
for p, a, b in EDITS:
    s = io.open(p, encoding='utf-8', newline='').read()
    nl = '\r\n' if '\r\n' in s else '\n'
    t = s.replace('\r\n', '\n')
    if a in t:
        io.open(p, 'w', encoding='utf-8', newline='').write(t.replace(a, b, 1).replace('\n', nl))
        n += 1
        print('  已改 %-42s %s' % (p, a[:52]))
    else:
        print('  !! 未匹配 %s :: %s' % (p, a[:60]))
print('合计 %d 处' % n)
