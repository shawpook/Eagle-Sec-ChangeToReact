# -*- coding: utf-8 -*-
"""b1-9bp span 手术：剩余 10 个菜单 builder → services/miscMenuService.ts（install 工厂）。
内容锚定位；提取件落 tests-tmp/bp-extracts/；手术与提取一文件两阶段。"""
import io
import os

CF = 'src/app/react/core/controllerFns.ts'
lines = io.open(CF, encoding='utf-8').read().split('\n')

NAMES = ['openTrashContextMenu', 'openFileListContextMenu', 'openOrderMenu', 'openApplicationContextMenu',
         'openFilterAddContextMenu', 'openNewContextMenu', 'openQuickAccessContextMenu',
         'openRatioContextMenu', 'openSidebarVisibleContextMenu', 'openSmartFolderExpandContextMenu']

def find_span(name):
    i = next(k for k, l in enumerate(lines) if f'fns["{name}"]' in l)
    depth = 0
    j = i
    while True:
        depth += lines[j].count('{') - lines[j].count('}')
        if depth == 0 and j > i:
            break
        j += 1
        assert j < len(lines), name + ' unbalanced'
    assert lines[j].rstrip() == '  };', f'{name} tail {lines[j]!r}'
    c = i
    while lines[c - 1].lstrip().startswith('//') or lines[c - 1].lstrip().startswith('/*'):
        c -= 1
    return c, j

spans = {}
for n in NAMES:
    c, e = find_span(n)
    spans[n] = (c, e)
    print(n, c + 1, '..', e + 1, 'width', e - c + 1)

# 顺序与不重叠
keys = sorted(spans.values())
for a, b in zip(keys, keys[1:]):
    assert a[1] + 1 < b[0], (a, b)

os.makedirs('tests-tmp/bp-extracts', exist_ok=True)
blocks = []
for n in NAMES:
    c, e = spans[n]
    blocks.append((n, c, e, '\n'.join(lines[c:e + 1])))
io.open('tests-tmp/bp-extracts/blocks.py.json', 'w', encoding='utf-8').write(
    io.open(__file__, encoding='utf-8').read() and __import__('json').dumps({n: [c, e] for n, (c, e) in spans.items()}))

all_src = '\n\n'.join(b[3] for b in blocks)
io.open('tests-tmp/bp-extracts/all-builders.ts', 'w', encoding='utf-8', newline='').write(all_src + '\n')

# ── 手术：从后往前删 ──
for n, c, e, _src in sorted(blocks, key=lambda x: -x[2]):
    del lines[c:e + 1]

out = '\n'.join(lines)
for n in NAMES:
    assert f'fns["{n}"]' not in out, n + ' 残留'
io.open(CF, 'w', encoding='utf-8', newline='').write(out)
print('手术完成，controllerFns 行数', len(lines))
