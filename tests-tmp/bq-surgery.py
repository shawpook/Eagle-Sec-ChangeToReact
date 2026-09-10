# -*- coding: utf-8 -*-
"""b1-9bq span 手术：批量操作 19 fns（679 行）→ services/batchOpsService.ts（install 工厂）。
内容锚定位；提取件 tests-tmp/bq-extracts/；断言后手术。"""
import io
import os
import json

CF = 'src/app/react/core/controllerFns.ts'
lines = io.open(CF, encoding='utf-8').read().split('\n')

NAMES = ['cancelEmptyTrash', 'emptyTrash', 'addToFolders', 'addToRecentFolders', 'addToLastUsedFolder',
         'cleanAllError', 'cleanSelected', 'copyTags', 'pasteTags', 'removeFromFolder',
         'getSelectedTags', 'getSelectedItemElements', 'scrollToSelectedItem', 'excludeWithTag', 'openTag',
         'exportSelectedAsFolder', 'exportSelectedAsEaglepack', 'exportSelectedAsFormat', 'exportSelectedToCsv']

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

keys = sorted(spans.values())
for a, b in zip(keys, keys[1:]):
    assert a[1] + 1 < b[0], (a, b)

os.makedirs('tests-tmp/bq-extracts', exist_ok=True)
io.open('tests-tmp/bq-extracts/spans.json', 'w', encoding='utf-8').write(
    json.dumps({n: [c, e] for n, (c, e) in spans.items()}, ensure_ascii=False, indent=1))

blocks = []
for n in NAMES:
    c, e = spans[n]
    blocks.append((n, c, e, '\n'.join(lines[c:e + 1])))
all_src = '\n\n'.join(b[3] for b in blocks)
io.open('tests-tmp/bq-extracts/all-fns.ts', 'w', encoding='utf-8', newline='').write(all_src + '\n')

for n, c, e, _ in sorted(blocks, key=lambda x: -x[2]):
    del lines[c:e + 1]

out = '\n'.join(lines)
for n in NAMES:
    assert f'fns["{n}"]' not in out, n + ' 残留'
io.open(CF, 'w', encoding='utf-8', newline='').write(out)
print('手术完成，行数', len(lines), '；19 fns 合计', sum(e - c + 1 for c, e in spans.values()), '行')
