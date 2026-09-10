# -*- coding: utf-8 -*-
# 扫 openItemContextMenu 提取件中的裸调用（标识符后跟 "("），排除关键字/方法调用（前导 .），
# 产出需在移植时解析的依赖清单。
import io, re

with io.open('tests-tmp/b49q-openItemContextMenu-src.txt', 'r', encoding='utf-8') as f:
    lines = f.readlines()

KEYWORDS = set('''if for while return const let var new typeof instanceof function switch case break continue
else try catch finally throw delete void in of do this true false null undefined async await yield
push filter map reduce slice reverse find findIndex sort some every includes indexOf join concat splice
forEach shift unshift pop length toString call apply bind then catch'''.split())

calls = {}
access = {}
for idx, line in enumerate(lines, start=1):
    code = line.split('//')[0]
    # 裸调用：非前导点的标识符 + "("
    for m in re.finditer(r'(?<![\w.$])([a-zA-Z_$][\w$]*)\s*\(', code):
        name = m.group(1)
        if name in KEYWORDS:
            continue
        calls.setdefault(name, []).append(idx)
    # 裸读（非前导点、非 $scope/$rootScope、后跟 .）——字段链根
    for m in re.finditer(r'(?<![\w.$])([a-zA-Z_$][\w$]*)\.', code):
        name = m.group(1)
        if name in KEYWORDS or name in ('$scope', '$rootScope'):
            continue
        access.setdefault(name, []).append(idx)

print('=== bare CALLS ===')
for name, lns in sorted(calls.items()):
    print(f'{name}: {len(lns)}x lines {lns[:6]}')
print('=== bare ACCESS roots (excl $scope/$rootScope) ===')
for name, lns in sorted(access.items()):
    print(f'{name}: {len(lns)}x lines {lns[:6]}')
