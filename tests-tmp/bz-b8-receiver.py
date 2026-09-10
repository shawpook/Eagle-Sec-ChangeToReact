# 按「接收者」反查：RISK 名字的每一处 .NAME( 调用，打印接收者表达式，人工识别 scope 别名。
import io, re, json, subprocess
from collections import Counter

d = json.load(io.open('tests-tmp/bz-b-scope-map.json', encoding='utf-8'))
SRC = [f for f in subprocess.check_output(['git', 'ls-files', 'src/app/react'], text=True).split()
       if f.endswith(('.ts', '.tsx'))]
WRITTEN = set()
for f in SRC:
    if any(f.replace('src/app/react/', '').startswith(x) for x in ('preview-window/', 'collect-window/', 'preferences/')):
        continue
    s = io.open(f, encoding='utf-8').read()
    for m in re.finditer(r'(?<![\w$])(?:\$)?(?:s|scope|s0|bodyScope|rootScope)\.([A-Za-z_$][\w$]*)\s*=[^=]', s):
        WRITTEN.add(m.group(1))
RISK = set(n for n, v in d.items() if v.get('route') == 'TABLE' and n not in WRITTEN)

CALL = re.compile(r'([A-Za-z_$][\w$]*)\.([A-Za-z_$][\w$]*)\s*\(')
KNOWN = {'s', 'scope', 's0', 'bodyScope', '$bodyScope', '$rootScope', '$root', '$scope', 'sc', 'body', 'bs', 'w', 'win', 'b'}
recv = Counter()
rows = []
for f in SRC:
    rel = f.replace('src/app/react/', '')
    if any(rel.startswith(x) for x in ('preview-window/', 'collect-window/', 'preferences/')):
        continue
    s = io.open(f, encoding='utf-8').read()
    lines = s.split('\n')
    for m in CALL.finditer(s):
        if m.group(2) not in RISK:
            continue
        r = m.group(1)
        recv[r] += 1
        if r in KNOWN:
            ln = s[:m.start()].count('\n') + 1
            rows.append((rel, ln, r, m.group(2), lines[ln - 1].strip()[:96]))
print('接收者分布（前 16）:', dict(recv.most_common(16)))
print()
print('接收者为已知 scope 别名的调用点 %d 处:' % len(rows))
for rel, ln, r, n, txt in rows:
    print('  %-44s :%-5d %-10s %s' % (rel, ln, r + '.' + n, txt))
