#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""修正迁移器留下的 `s.<var>Channel.emit(` 误加前缀。

根因：迁移器正则 `[A-Za-z_$][\\w$]*(?:\\(\\))?\\??\\.\\$broadcast\\(` 中，
`[A-Za-z_$]` 含 `$`，因此 `$root` 被当作标识符整体匹配 —— `s.$root.$broadcast(` 里
匹配到的是 `$root.$broadcast(`，前面的 `s.` 残留下来，产出 `s.resetFilterChannel.emit()`。
"""
import io, os, re

PAT = re.compile(r'(?<![\w$.])([A-Za-z_$][\w$]*)\.([a-z][A-Za-z0-9]*Channel)\.(emit|on)\(')

total = 0
for base, _d, files in os.walk('src/app/react'):
    for fn in files:
        if not fn.endswith(('.ts', '.tsx')):
            continue
        p = os.path.join(base, fn)
        s = io.open(p, encoding='utf-8', newline='').read()
        nl = '\r\n' if '\r\n' in s else '\n'
        t = s.replace('\r\n', '\n')
        t2, n = PAT.subn(lambda m: '%s.%s(' % (m.group(2), m.group(3)), t)
        if n:
            io.open(p, 'w', encoding='utf-8', newline='').write(t2.replace('\n', nl))
            print('  %-52s %d 处' % (p.replace('src/app/react/', ''), n))
            total += n
print('合计修正 %d 处' % total)
