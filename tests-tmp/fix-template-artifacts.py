import io, re

p = 'src/app/react/core/controllerFns.ts'
s = io.open(p, encoding='utf-8', newline='').read()

before = s.count('$${')
assert before > 0, 'nothing to fix'

# 提取器把模板字面量里的 ${ 转义成了 $${ → 运行时多出一个字面 $（URL/localStorage 键/
# jQuery 选择器/日志全被污染，bundle 原文为 ${...}，见 app.bundle.js 22990/31504/20711）。
lines = s.split('\n')
hits = [(i + 1, l.strip()[:110]) for i, l in enumerate(lines) if '$${' in l]
s2 = s.replace('$${', '${')

assert '$${' not in s2
assert s2.count('${') == s.count('${'), 'unexpected ${ count drift'

io.open(p, 'w', encoding='utf-8', newline='').write(s2)
print('replaced %d occurrences across %d lines' % (before, len(hits)))
for n, text in hits[:8]:
    print('  %d: %s' % (n, text))
print('  ... (%d lines total)' % len(hits))
