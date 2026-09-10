#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""C-0：把 dataMachinery 的 B8 新增静态 import 换成 externalSupply 延迟供给。

动作：
1) 撤销 B8 给 dataMachinery 新增/扩充的 5 条 import（回到 614d1ab 的依赖图形状）
2) 改为 import { callExternal } from './externalSupply'
3) 10 个挂载点改为运行期查表
4) 函数体内两处直调（getRawUrl / select）改走 callExternal
"""
import io, re

P = 'src/app/react/core/dataMachinery.ts'

s = io.open(P, encoding='utf-8', newline='').read()
nl = '\r\n' if '\r\n' in s else '\n'
t = s.replace('\r\n', '\n')

NAMES = ['activateFont', 'deactivateFont', 'isFontActivate', 'escHandler',
         'addImagesToFolder', 'copyAsPath', 'getRawPath', 'getRawUrl',
         'select', 'startDrag']

# ── 1) import 回退 ──
REVERT = [
    ("import { copyAsPath, getRawPath, getRawUrl, escHandler, updateCurrentOrderAndIncrease } from './miscDomain';",
     "import { updateCurrentOrderAndIncrease } from './miscDomain';"),
    ("import { activateFont, deactivateFont, isFontActivate } from '../services/fontTagService';\n", ""),
    ("import { addImagesToFolder } from '../services/folderCoreService';\n", ""),
    ("import { select } from '../services/selectionService';\n", ""),
    ("import { saveCrop, startDrag } from '../services/imageOpsService';",
     "import { saveCrop } from '../services/imageOpsService';"),
]
for a, b in REVERT:
    if a in t:
        t = t.replace(a, b, 1)

# 补 externalSupply import（放在 appCore import 之后）
anchor = "import { getBodyScope } from './appCore';"
assert anchor in t, '未找到 appCore import'
if 'externalSupply' not in t:
    t = t.replace(anchor, anchor + "\nimport { callExternal } from './externalSupply';", 1)

# ── 2) 挂载点改查表 ──
for n in NAMES:
    t = t.replace('  s.%s = (...args: any[]) => %s(...args);' % (n, n),
                  "  s.%s = (...args: any[]) => callExternal('%s', ...args);" % (n, n))

# ── 3) 函数体内直调改查表 ──
t = t.replace('w.$("img#detail-image").attr("src", getRawUrl(image));',
              'w.$("img#detail-image").attr("src", callExternal(\'getRawUrl\', image));')
t = t.replace('            select(undefined, target);',
              "            callExternal('select', undefined, target);")

io.open(P, 'w', encoding='utf-8', newline='').write(t.replace('\n', nl))

# 校验
left = [n for n in NAMES if re.search(r'(?<![\w$.])%s\s*\(' % n, t.split('import ')[-1])]
print('已改写。残留同名直调: %s' % (left or '无'))
print('import 行:')
for ln in t.split('\n')[:100]:
    if "from './externalSupply'" in ln or "from './miscDomain'" in ln or 'fontTagService' in ln or 'selectionService' in ln or 'folderCoreService' in ln or 'imageOpsService' in ln:
        print('   ' + ln.strip())
