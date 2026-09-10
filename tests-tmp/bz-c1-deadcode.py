#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""C-1 后半：删除 install*Fns 死代码家族。

依据：B8 退役 controllerFns / makeControllerFns 后，6 个 install*Fns 已无任何调用方
（全树 grep 只剩注释提及），其体内注册的 fns 表项与匿名闭包永不执行。删除=零行为变化。
注意：B8 曾把其中 3 个匿名闭包提升为模块级具名导出（仍在用），不受影响。
"""
import io, re

TARGETS = [
    ('src/app/react/services/batchOpsService.ts', 'installBatchOpsFns'),
    ('src/app/react/services/folderCoreService.ts', 'installFolderCoreFns'),
    ('src/app/react/services/folderMenuService.ts', 'installFolderMenuFns'),
    ('src/app/react/services/fontTagService.ts', 'installFontTagFns'),
    ('src/app/react/services/imageOpsService.ts', 'installImageOpsFns'),
    ('src/app/react/services/miscMenuService.ts', 'installMiscMenuFns'),
    ('src/app/react/services/itemMenuService.ts', 'installItemMenuFns'),
    ('src/app/react/services/sidebarService.ts', 'installSidebarFns'),
    ('src/app/react/services/viewOpsService.ts', 'installViewOpsFns'),
    ('src/app/react/services/uploadService.ts', 'installUploadFns'),
    ('src/app/react/services/detailService.ts', 'installDetailFns'),
    ('src/app/react/services/gridService.ts', 'installGridFns'),
    ('src/app/react/services/mediaService.ts', 'installMediaFns'),
    ('src/app/react/services/lockService.ts', 'installLockFns'),
    ('src/app/react/services/selectionService.ts', 'installSelectionFns'),
]

total = 0
for f, name in TARGETS:
    try:
        s = io.open(f, encoding='utf-8', newline='').read()
    except IOError:
        continue
    nl = '\r\n' if '\r\n' in s else '\n'
    t = s.replace('\r\n', '\n')
    L = t.split('\n')
    st = None
    for i, l in enumerate(L):
        if re.match(r'^[ \t]*export function %s\(' % name, l):
            st = i
            break
    if st is None:
        continue
    end = None
    for k in range(st + 1, len(L)):
        if re.match(r'^\}\s*$', L[k]):
            end = k
            break
    if end is None:
        print('  !! %s: 未找到函数结束' % name)
        continue
    # 向上吞掉紧邻的注释块
    top = st
    while top - 1 >= 0:
        p = L[top - 1].strip()
        if p.startswith('//') or p.startswith('*') or p.startswith('/*') or p == '':
            if p == '' and (top - 2 < 0 or not L[top - 2].strip().startswith(('//', '*', '/*'))):
                break
            top -= 1
        else:
            break
    n = end - top + 1
    del L[top:end + 1]
    # 收敛多余空行
    while top < len(L) and top > 0 and L[top].strip() == '' and L[top - 1].strip() == '':
        del L[top]
    io.open(f, 'w', encoding='utf-8', newline='').write('\n'.join(L).replace('\n', nl))
    total += n
    print('  %-46s %-24s 删除 %d 行' % (f.replace('src/app/react/', ''), name, n))

print('\n合计删除 %d 行' % total)
