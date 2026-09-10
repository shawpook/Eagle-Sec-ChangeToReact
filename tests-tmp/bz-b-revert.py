"""按名字回退直调化：sym(...) -> s.NAME(...)，并移除对应 import。

用于保留必须留在 scope 面的调用（$watch/$broadcast 桥接的测试契约需要
scope 面可 spy —— P4-ca 删除 scopeShim 时统一处置）。
"""
import difflib
import io
import json
import re
import subprocess

MAP = json.load(io.open('tests-tmp/bz-b-scope-map.json', encoding='utf-8'))

# 需要保留在 scope 面的名字：测试契约通过替换 s.NAME 做 spy，
# 直调化会绕过 scope 面导致 spy 失效（P4-ca 删 scopeShim 时统一处置）。
NAMES = [
    'updateSelection', 'rebindRefresh', 'filterContent',
    'calculateImageBinding', 'restoreDefaultShortcuts', 'copyApiToken', 'search',
]

name2info = {n: MAP.get(n, {}) for n in NAMES}

files = [f for f in subprocess.check_output(
    ['git', 'diff', '--name-only', '--', 'src/app/react/'], text=True).split()
    if f.endswith(('.ts', '.tsx'))]

total = 0
for f in files:
    new = io.open(f, encoding='utf-8').read()
    old = subprocess.check_output(['git', 'show', 'HEAD:' + f], text=True).split('\n')
    new_lines = new.split('\n')
    sm = difflib.SequenceMatcher(None, old, new_lines, autojunk=False)
    changed = 0
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag not in ('replace', 'insert'):
            continue
        oblock, nblock = old[i1:i2], new_lines[j1:j2]
        for name in NAMES:
            info = name2info.get(name) or {}
            sym = info.get('export')
            if not sym:
                continue
            po = re.compile(r'(?<![\w$.])(?:s|scope|bodyScope)\.%s\s*\(' % re.escape(name))
            pn = re.compile(r'(?<![\w$.])%s\s*\(' % re.escape(sym))
            budget = sum(len(po.findall(l)) for l in oblock)
            if not budget:
                continue
            for k in range(len(nblock)):
                hits = pn.findall(nblock[k])
                if not hits:
                    continue
                take = min(len(hits), budget)
                cnt = [0]

                def sub(m):
                    cnt[0] += 1
                    return 's.%s(' % name if cnt[0] <= take else m.group(0)

                nblock[k] = pn.sub(sub, nblock[k])
                changed += take
                budget -= take
                if budget <= 0:
                    break
        new_lines[j1:j2] = nblock

    out = '\n'.join(new_lines)
    if not changed:
        continue
    for name in NAMES:
        sym = (name2info.get(name) or {}).get('export')
        if not sym:
            continue

        def drop(m):
            parts = [p.strip() for p in m.group(1).split(',') if p.strip()]
            rest = [p for p in parts if p.split(' as ')[0].strip() != sym]
            return '' if not rest else 'import { %s } from %s;' % (', '.join(rest), m.group(2))

        out = re.sub(r'import\s*\{([^}]*)\}\s*from\s*([\'"][^\'"]+[\'"]);', drop, out)
    io.open(f, 'w', encoding='utf-8').write(out)
    print('%-56s 回退 %d 处' % (f, changed))
    total += changed
print('合计回退 %d 处' % total)
