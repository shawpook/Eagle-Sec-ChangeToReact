#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""C-3 前置：digest 面形态分类（$evalAsync / scopeApply / $apply / $timeout）。

$evalAsync(fn) 与 $evalAsync() 语义完全不同：
- `$evalAsync()`       —— 仅「在本轮 digest 后触发一次 digest」，无回调体；
- `$evalAsync(fn)`     —— 延后执行 fn（Angular 保证在 digest 循环内）。
React 时代前者多半是迁移期残留（digest 已无消费者），后者承载真实的「延后到下一帧/微任务」语义。
"""
import io, os, re, subprocess, sys
from collections import Counter, defaultdict

ROOT = 'src/app/react'
files = [f for f in subprocess.check_output(['git', 'ls-files', ROOT], text=True).split()
         if f.endswith(('.ts', '.tsx'))]

# 匹配 <recv>.$evalAsync(  并取到配对的右括号前的首个参数形态
CALL = re.compile(r'(?<![\w$.])([A-Za-z_$][\w$]*(?:\(\))?\??)\.\$evalAsync\s*\(')


def arg_kind(src, i):
    """i 指向 `(` 之后，判断首个实参形态。"""
    depth = 0
    j = i
    while j < len(src) and j < i + 400:
        c = src[j]
        if c in '([{':
            depth += 1
        elif c in ')]}':
            if depth == 0:
                return 'empty' if src[i:j].strip() == '' else 'expr'
            depth -= 1
        elif c == ',' and depth == 0:
            return 'expr'
        j += 1
    return 'expr'


# ── $evalAsync 分类 ──
kind = Counter()
recv = Counter()
fn_kind = Counter()          # 带参时的实参前缀形态
by_file = defaultdict(Counter)
samples = defaultdict(list)
for f in files:
    s = io.open(f, encoding='utf-8', errors='ignore').read()
    for m in CALL.finditer(s):
        k = arg_kind(s, m.end())
        kind[k] += 1
        recv[m.group(1)] += 1
        ln = s[:m.start()].count('\n')
        line = s.split('\n')[ln].strip()
        by_file[f.replace(ROOT + '/', '')][k] += 1
        if k == 'expr':
            body = s[m.end():m.end() + 60].split('\n')[0]
            fn_kind[body.strip()[:40]] += 1
            if len(samples['expr']) < 12:
                samples['expr'].append((f.replace(ROOT + '/', ''), ln + 1, line[:96]))
        else:
            if len(samples['empty']) < 12:
                samples['empty'].append((f.replace(ROOT + '/', ''), ln + 1, line[:96]))

print('=== $evalAsync 形态 ===')
print('  ', dict(kind))
print('   接收者 TOP:', recv.most_common(6))
print()
print('=== 无参 $evalAsync() 样本（候选「残留断言」）===')
for f, ln, l in samples['empty']:
    print('   %-46s :%-5d %s' % (f, ln, l))
print()
print('=== 带参 $evalAsync(...) 样本（候选「真延后」）===')
for f, ln, l in samples['expr']:
    print('   %-46s :%-5d %s' % (f, ln, l))
print()
print('=== 带参实参形态 TOP ===')
for k, v in fn_kind.most_common(12):
    print('   %-42s %d' % (k, v))
print()
print('=== 按文件（无参 / 带参）===')
rows = sorted(by_file.items(), key=lambda x: -(x[1].get('empty', 0) + x[1].get('expr', 0)))
for f, c in rows[:14]:
    print('   %-50s empty=%-4d expr=%-4d' % (f, c.get('empty', 0), c.get('expr', 0)))
