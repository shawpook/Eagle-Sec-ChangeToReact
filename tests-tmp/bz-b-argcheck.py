"""验证：machineryXxx(...) 的调用点首参是否恒为 bodyScope 系变量。

决定 dataMachinery 定义侧 372 处 s.xxx() 能否批量直调化——
若所有调用点首参都来自 getBodyScope()，则形参 s 恒等于 bodyScope，可改。
"""
import io
import os
import re
from collections import Counter

DECL = re.compile(r'(?:export\s+)?(?:async\s+)?function\s+machinery[A-Za-z0-9_$]*\s*\(')
CALL = re.compile(r'(?<![\w$.])machinery([A-Za-z0-9_$]+)\s*\(\s*([^,)]*)')

c = Counter()
odd = []
for base, _d, files in os.walk('src/app/react'):
    for fn in files:
        if not fn.endswith(('.ts', '.tsx')):
            continue
        p = os.path.join(base, fn)
        src = io.open(p, encoding='utf-8').read()
        for m in DECL.finditer(src):
            pass
        for m in CALL.finditer(src):
            head = src[max(0, m.start() - 60):m.start()]
            if re.search(r'function\s+machinery[A-Za-z0-9_$]*\s*$', head):
                continue          # 函数声明，非调用
            if re.search(r'function\s+machinery[A-Za-z0-9_$]*\s*\(\s*$', head):
                continue
            a = m.group(2).strip()
            if ':' in a or not a:
                continue          # 声明形参 / 零参调用
            c[a] += 1
            if a not in ('s', 'scope', 'bodyScope'):
                odd.append((p.replace('\\', '/').replace('src/app/react/', ''), a))

print('调用点首参分布 TOP:', c.most_common(10))
print()
print('非 bodyScope 系首参：%d 处' % len(odd))
for p, a in odd[:20]:
    print('   %-52s %s' % (p, a[:44]))
