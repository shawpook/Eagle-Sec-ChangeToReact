"""双键分类（精确版）：40 个 DUAL 按 c3 落点形态分档。

修正 v1 的两个 bug：
  1. 函数体提取改用括号配对（v1 用 `^}` 会截断/溢出，行数严重失真）；
  2. 同名转发判定用 `\\bmachineryXxx\\s*\\(` 精确匹配（v1 的子串匹配把
     `machineryZoomFit(` 误判成 `machineryZoom(`）。
"""
import io
import json
import os
import re

d = json.load(io.open('tests-tmp/bz-b-scope-map.json', encoding='utf-8'))
dual = sorted([(n, v['export']) for n, v in d.items() if v['route'] == 'DUAL'])
cf = io.open('src/app/react/core/controllerFns.ts', encoding='utf-8').read()

imp = {}
for line in cf.split('\n'):
    if line.startswith('import {'):
        m = re.search(r"from '([^']+)'", line)
        if m:
            for p in re.search(r'\{([^}]*)\}', line).group(1).split(','):
                nm = p.strip().split(' as ')[0].strip()
                if nm:
                    imp[nm] = m.group(1)


def body(path, sym):
    t = io.open(path, encoding='utf-8').read()
    m = re.search(r'^export\s+(?:async\s+)?function\s+%s\s*\(' % re.escape(sym), t, re.M)
    if not m:
        return None
    i = t.find('{', m.start())
    depth = 0
    for k in range(i, len(t)):
        if t[k] == '{':
            depth += 1
        elif t[k] == '}':
            depth -= 1
            if depth == 0:
                return t[m.start():k + 1]
    return None


def src_of(sym):
    mod = imp.get(sym)
    if not mod:
        return None
    p = os.path.normpath(os.path.join('src/app/react/core', mod)).replace('\\', '/')
    for c in (p + '.ts', p + '.tsx'):
        if os.path.exists(c):
            return c
    return None


cat = {'A': [], 'B': [], 'C': []}
for n, e in dual:
    m = re.search(r'^\s*fns\["%s"\]\s*=\s*([A-Za-z0-9_$]+)\s*;' % re.escape(n), cf, re.M)
    sym = m.group(1) if m else None
    if not sym:
        cat['C'].append((n, 'install 家族注册（不在 controllerFns.ts）'))
        continue
    p = src_of(sym)
    b = body(p, sym) if p else None
    if not b:
        cat['C'].append((n, '落点体未解析 %s' % sym))
        continue
    lines = len(b.split('\n'))
    self_call = bool(e) and re.search(r'\b%s\s*\(' % re.escape(e), b) is not None
    other = sorted(set(re.findall(r'\bmachinery[A-Za-z0-9_$]+\s*\(', b)))
    if self_call and lines <= 12:
        cat['A'].append((n, '%s：%d 行纯转发 → %s' % (sym, lines, e)))
    else:
        cat['B'].append((n, '%s：%d 行独立体（内含 machinery 调用 %d 种）@%s'
                         % (sym, lines, len(other), os.path.basename(p))))

print('DUAL 总数 %d' % len(dual))
for k in ('A', 'B', 'C'):
    print('\n### %s 类：%d 个' % (k, len(cat[k])))
    for n, why in cat[k]:
        print('   %-30s %s' % (n, why))
