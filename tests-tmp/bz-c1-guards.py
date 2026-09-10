#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""C-1：给 machinery 版补回 c3 版有的可选能力守卫（解锁删除族 4 个 + refreshSubfolderList 的单源化）。

对照 c3（folderMenuService 的逐字移植体）：
  s.removeSound && s.removeSound.play && s.removeSound.play();
  s.saveFolderDebounce && machinerySaveFolderDebounce(s);
  (s.$root.notify || s.notify).call(s.$root, {...}, cb)
  if (s.subFolderSortableOptions) s.subFolderSortableOptions.disabled = <bool>;

按行号精确定位（全部为同行替换，行号在过程中稳定），逐行先校验原文再改。
"""
import io

P = 'src/app/react/core/dataMachinery.ts'
s = io.open(P, encoding='utf-8', newline='').read()
nl = '\r\n' if '\r\n' in s else '\n'
L = s.replace('\r\n', '\n').split('\n')

JOBS = [
    # 行号(1-based), 原文（strip 后必须完全匹配）, 新文
    (4641, 's.removeSound.play();', 's.removeSound && s.removeSound.play && s.removeSound.play();'),
    (7727, 's.removeSound.play();', 's.removeSound && s.removeSound.play && s.removeSound.play();'),
    (7906, 's.removeSound.play();', 's.removeSound && s.removeSound.play && s.removeSound.play();'),
    (8084, 's.removeSound.play();', 's.removeSound && s.removeSound.play && s.removeSound.play();'),
    (7732, 'machinerySaveFolderDebounce(s);', 's.saveFolderDebounce && machinerySaveFolderDebounce(s);'),
    (7755, 'machinerySaveFolderDebounce(s);', 's.saveFolderDebounce && machinerySaveFolderDebounce(s);'),
    (7921, 'machinerySaveFolderDebounce(s);', 's.saveFolderDebounce && machinerySaveFolderDebounce(s);'),
    (7957, 'machinerySaveFolderDebounce(s);', 's.saveFolderDebounce && machinerySaveFolderDebounce(s);'),
    (4605, 's.$root.notify({', '(s.$root.notify || s.notify).call(s.$root, {'),
    (7738, 's.$root.notify({', '(s.$root.notify || s.notify).call(s.$root, {'),
    (7930, 's.$root.notify({', '(s.$root.notify || s.notify).call(s.$root, {'),
    (8092, 's.$root.notify({', '(s.$root.notify || s.notify).call(s.$root, {'),
    (9822, 's.subFolderSortableOptions.disabled = true;', 'if (s.subFolderSortableOptions) s.subFolderSortableOptions.disabled = true;'),
    (9827, 's.subFolderSortableOptions.disabled = false;', 'if (s.subFolderSortableOptions) s.subFolderSortableOptions.disabled = false;'),
    (9842, 's.subFolderSortableOptions.disabled = true;', 'if (s.subFolderSortableOptions) s.subFolderSortableOptions.disabled = true;'),
]

ok = 0
for ln, expect, newv in JOBS:
    cur = L[ln - 1].strip()
    if cur != expect:
        print('  !! 行 %d 不匹配\n     期望: %s\n     实际: %s' % (ln, expect, cur))
        continue
    indent = L[ln - 1][:len(L[ln - 1]) - len(L[ln - 1].lstrip())]
    L[ln - 1] = indent + newv
    ok += 1

print('已补守卫 %d / %d 处' % (ok, len(JOBS)))
io.open(P, 'w', encoding='utf-8', newline='').write('\n'.join(L).replace('\n', nl))

# 复查
chk = io.open(P, encoding='utf-8').read()
print('残留 s.removeSound.play();（无守卫）: %d' % chk.count('s.removeSound.play();'))
print('残留裸 s.$root.notify({ : %d' % chk.count('s.$root.notify({'))
print('残留裸 subFolderSortableOptions.disabled: %d' % len([1 for x in chk.split('\n') if 'subFolderSortableOptions.disabled' in x and 'if (s.subFolderSortableOptions)' not in x]))
