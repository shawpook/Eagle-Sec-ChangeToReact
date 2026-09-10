# -*- coding: utf-8 -*-
"""b1-9bo 面B span 手术：folder/smartFolder 族搬迁 folderMenuService（内容锚，无手算行号）。

搬迁单位（controllerFns → services/folderMenuService.ts）：
  1. 模块级辅助 3 个：treeWalkSafe / wElectronLogInfo / wQueryFocusFolderInput
  2. ap 依赖区（台账⑨批头 .. openFolderContextMenu fns 行前）—— 27 fns + 2 闭包函数
  3. aq 依赖区（台账⑨第三批批头 .. openNewSmartFolderContextMenu fns 行前）—— 20 fns + 2 闭包
  4. openFolderContextMenu（542 行）/ openSmartFolderContextMenu（369 行）/
     openNewSmartFolderContextMenu（35 行）三个 builder

controllerFns 侧：全部区域删除 → fns 壳（47+3 builder = 50 个壳）+ import。
fns 壳形态与 bn 完全一致（initLinkVars 前导 + getScope）。
"""
import io
import os

CF = 'src/app/react/core/controllerFns.ts'
lines = io.open(CF, encoding='utf-8').read().split('\n')

def find_line(pred, desc, lo=0, hi=None):
    hi = hi if hi is not None else len(lines)
    hits = [i for i in range(lo, min(hi, len(lines))) if pred(lines[i])]
    assert len(hits) == 1, f'{desc}: {len(hits)} hits at {[h + 1 for h in hits]}'
    return hits[0]

def span_to_close(start_idx, desc):
    """从 fns["x"] = function 行配平到 '  };'"""
    depth = 0
    j = start_idx
    while True:
        depth += lines[j].count('{') - lines[j].count('}')
        if depth == 0 and j > start_idx:
            break
        j += 1
        assert j < len(lines), desc + ' unbalanced'
    assert lines[j].rstrip() == '  };', f'{desc}: tail not "  }};" at {j + 1}: {lines[j]!r}'
    return j

# ── 定位 ──
i_tws = find_line(lambda l: l.startswith('function treeWalkSafe'), 'treeWalkSafe')
i_weli = find_line(lambda l: l.startswith('function wElectronLogInfo'), 'wElectronLogInfo')
i_wqfi = find_line(lambda l: l.startswith('function wQueryFocusFolderInput'), 'wQueryFocusFolderInput')
i_ap = find_line(lambda l: 'b1-9ap：台账⑨主菜单第一批' in l, 'ap header')
i_aq = find_line(lambda l: 'b1-9aq：台账⑨第三批' in l, 'aq header')
i_ofc = find_line(lambda l: 'fns["openFolderContextMenu"]' in l, 'openFolderContextMenu')
i_ofc_end = span_to_close(i_ofc, 'openFolderContextMenu')
i_osfc = find_line(lambda l: 'fns["openSmartFolderContextMenu"]' in l, 'openSmartFolderContextMenu')
i_osfc_end = span_to_close(i_osfc, 'openSmartFolderContextMenu')
i_nsf = find_line(lambda l: 'fns["openNewSmartFolderContextMenu"]' in l, 'openNewSmartFolderContextMenu')
i_nsf_end = span_to_close(i_nsf, 'openNewSmartFolderContextMenu')
# ap 区结束边界 = openFolderContextMenu 的注释行（fns 行向上找连续注释块）
i_ofc_cmt = i_ofc
while lines[i_ofc_cmt - 1].lstrip().startswith('//') or lines[i_ofc_cmt - 1].lstrip().startswith('/*'):
    i_ofc_cmt -= 1
# aq 区结束边界 = openNewSmartFolderContextMenu 注释行
i_nsf_cmt = i_nsf
while lines[i_nsf_cmt - 1].lstrip().startswith('//') or lines[i_nsf_cmt - 1].lstrip().startswith('/*'):
    i_nsf_cmt -= 1
# 模块级辅助区头注释（b1-9ap 模块级辅助）
i_helper_cmt = find_line(lambda l: 'b1-9ap 模块级辅助' in l, 'helper header')

# 交叉验证
print('helpers:', i_helper_cmt + 1, '..', i_wqfi, '(0-based', i_helper_cmt, i_wqfi, ')')
print('ap zone:', i_ap + 1, '..', i_ofc_cmt, '(0-based', i_ap, i_ofc_cmt, ')')
print('folder builder:', i_ofc_cmt + 1, '..', i_ofc_end + 1)
print('aq zone:', i_aq + 1, '..', i_nsf_cmt, '(0-based', i_aq, i_nsf_cmt, ')')
print('newSmartFolder builder:', i_nsf_cmt + 1, '..', i_nsf_end + 1)
print('smartFolder builder:', i_osfc + 1, '..', i_osfc_end + 1)

# 区间不重叠检查
assert i_helper_cmt < i_ap < i_ofc_cmt <= i_ofc < i_ofc_end < i_aq <= i_nsf_cmt <= i_nsf < i_nsf_end
# aq 区后：openNewSmartFolderContextMenu 紧接 openSmartFolderContextMenu？核对顺序
assert i_nsf_end < i_osfc, 'osfc after nsf expected'

# ── 提取 ──
os.makedirs('tests-tmp/bo-extracts', exist_ok=True)
helpers = lines[i_helper_cmt:i_wqfi + 1]
ap_zone = lines[i_ap:i_ofc_cmt]
folder_builder = lines[i_ofc_cmt:i_ofc_end + 1]
aq_zone = lines[i_aq:i_nsf_cmt]
nsf_builder = lines[i_nsf_cmt:i_nsf_end + 1]
sf_builder = lines[i_osfc:i_osfc_end + 1]

print('helpers', len(helpers), '/ ap', len(ap_zone), '/ folderBuilder', len(folder_builder),
      '/ aq', len(aq_zone), '/ nsfBuilder', len(nsf_builder), '/ sfBuilder', len(sf_builder))

io.open('tests-tmp/bo-extracts/helpers.ts', 'w', encoding='utf-8', newline='').write('\n'.join(helpers) + '\n')
io.open('tests-tmp/bo-extracts/ap-zone.ts', 'w', encoding='utf-8', newline='').write('\n'.join(ap_zone) + '\n')
io.open('tests-tmp/bo-extracts/folder-builder.ts', 'w', encoding='utf-8', newline='').write('\n'.join(folder_builder) + '\n')
io.open('tests-tmp/bo-extracts/aq-zone.ts', 'w', encoding='utf-8', newline='').write('\n'.join(aq_zone) + '\n')
io.open('tests-tmp/bo-extracts/nsf-builder.ts', 'w', encoding='utf-8', newline='').write('\n'.join(nsf_builder) + '\n')
io.open('tests-tmp/bo-extracts/sf-builder.ts', 'w', encoding='utf-8', newline='').write('\n'.join(sf_builder) + '\n')
print('extracts written')
