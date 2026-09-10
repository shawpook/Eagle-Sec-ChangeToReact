# -*- coding: utf-8 -*-
"""b1-9bo 面B controllerFns 手术：删除 6 个已迁区域 + 挂 installFolderMenuFns 调用。"""
import io

CF = 'src/app/react/core/controllerFns.ts'
lines = io.open(CF, encoding='utf-8').read().split('\n')

def find_line(pred, desc, lo=0, hi=None):
    hi = hi if hi is not None else len(lines)
    hits = [i for i in range(lo, min(hi, len(lines))) if pred(lines[i])]
    assert len(hits) == 1, f'{desc}: {len(hits)} hits at {[h + 1 for h in hits]}'
    return hits[0]

def span_to_close(start_idx, desc):
    depth = 0
    j = start_idx
    while True:
        depth += lines[j].count('{') - lines[j].count('}')
        if depth == 0 and j > start_idx:
            break
        j += 1
        assert j < len(lines), desc + ' unbalanced'
    assert lines[j].rstrip() == '  };', f'{desc} tail {lines[j]!r}'
    return j

# 与 bo-extract.py 相同锚点（手术时文件未变，行号可复算——但仍走内容锚）
i_helper_cmt = find_line(lambda l: 'b1-9ap 模块级辅助' in l, 'helper header')
i_wqfi = find_line(lambda l: l.startswith('function wQueryFocusFolderInput'), 'wQueryFocusFolderInput')
# helper 区尾 = wQueryFocusFolderInput 函数闭合
depth = 0; j = i_wqfi
while True:
    depth += lines[j].count('{') - lines[j].count('}')
    if depth == 0 and j > i_wqfi: break
    j += 1
i_helper_end = j

i_ap = find_line(lambda l: 'b1-9ap：台账⑨主菜单第一批' in l, 'ap header')
i_ofc = find_line(lambda l: 'fns["openFolderContextMenu"]' in l, 'ofc')
i_ofc_end = span_to_close(i_ofc, 'ofc')
i_ofc_cmt = i_ofc
while lines[i_ofc_cmt - 1].lstrip().startswith('//') or lines[i_ofc_cmt - 1].lstrip().startswith('/*'):
    i_ofc_cmt -= 1

i_aq = find_line(lambda l: 'b1-9aq：台账⑨第三批' in l, 'aq header')
i_nsf = find_line(lambda l: 'fns["openNewSmartFolderContextMenu"]' in l, 'nsf')
i_nsf_end = span_to_close(i_nsf, 'nsf')
i_nsf_cmt = i_nsf
while lines[i_nsf_cmt - 1].lstrip().startswith('//') or lines[i_nsf_cmt - 1].lstrip().startswith('/*'):
    i_nsf_cmt -= 1

i_osfc = find_line(lambda l: 'fns["openSmartFolderContextMenu"]' in l, 'osfc')
i_osfc_end = span_to_close(i_osfc, 'osfc')

i_return = find_line(lambda l: l.strip() == 'return fns;', 'return fns', 11000)

assert i_helper_cmt < i_wqfi <= i_helper_end < i_ap < i_ofc_cmt <= i_ofc < i_ofc_end < i_aq < i_nsf_cmt <= i_nsf < i_nsf_end < i_osfc < i_osfc_end < i_return

# 从后往前删（行号大者先）：
# D: openSmartFolderContextMenu builder（含其注释行——osfc 的前置注释块）
i_osfc_cmt = i_osfc
while lines[i_osfc_cmt - 1].lstrip().startswith('//') or lines[i_osfc_cmt - 1].lstrip().startswith('/*'):
    i_osfc_cmt -= 1
del lines[i_osfc_cmt:i_osfc_end + 1]
# C: nsf builder（aq 区尾段；nsf_cmt..nsf_end）
del lines[i_nsf_cmt:i_nsf_end + 1]
# B: aq 区（aq header .. nsf_cmt）
del lines[i_aq:i_nsf_cmt]
# A: folder builder + ap 区（ap header .. ofc_end）一次删（连续）
del lines[i_ap:i_ofc_end + 1]
# H: 模块级辅助 3 个（helper_cmt .. helper_end）
del lines[i_helper_cmt:i_helper_end + 1]

# 插入 install 调用（return fns 前）
i_return2 = None
for i, l in enumerate(lines):
    if l.strip() == 'return fns;':
        i_return2 = i
        break
assert i_return2 is not None
lines[i_return2:i_return2] = [
    '',
    '  // b1-9bo：folder/smartFolder 菜单 + CRUD 族（ap/aq 台账区 + 三 builder，2,540 行）',
    '  // 整体迁 folderMenuService——installFolderMenuFns 批量注册（条目名零改动）',
    '  installFolderMenuFns(fns, getScope);',
]

out = '\n'.join(lines)
for probe in ['fns["openFolderContextMenu"]', 'fns["openSmartFolderContextMenu"]', 'fns["newSmartFolder"]',
              'fns["removeFolder"]', 'fns["cloneSmartFolder"]', 'function treeWalkSafe', 'b1-9ap：台账⑨主菜单第一批']:
    assert probe not in out, probe + ' 残留'
assert out.count('installFolderMenuFns') == 2  # 代码 1 + 注释 1
io.open(CF, 'w', encoding='utf-8', newline='').write(out)
print('手术完成，行数', len(lines))
