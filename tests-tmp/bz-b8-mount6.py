import io

p = 'src/app/react/core/dataMachinery.ts'
s = io.open(p, encoding='utf-8', newline='').read()
nl = '\r\n' if '\r\n' in s else '\n'
t = s.replace('\r\n', '\n')

# imports
imports = [
    ("import { escHandler, updateCurrentOrderAndIncrease } from './miscDomain';",
     "import { copyAsPath, getRawPath, getRawUrl, escHandler, updateCurrentOrderAndIncrease } from './miscDomain';"),
    ("import { activateFont, deactivateFont, isFontActivate } from '../services/fontTagService';",
     "import { activateFont, deactivateFont, isFontActivate } from '../services/fontTagService';\n"
     "import { addImagesToFolder } from '../services/folderCoreService';\n"
     "import { select } from '../services/selectionService';"),
]
for a, b in imports:
    if a not in t:
        raise SystemExit('import 未匹配: ' + a[:60])
    t = t.replace(a, b, 1)

# startDrag 从 imageOpsService 引入（该文件已有其它 import 时合并）
if "from '../services/imageOpsService'" in t:
    import re
    m = re.search(r"^import \{([^}]*)\} from '\.\./services/imageOpsService';$", t, re.M)
    if m:
        names = sorted(set([x.strip() for x in m.group(1).split(',') if x.strip()] + ['startDrag']))
        t = t[:m.start()] + "import { %s } from '../services/imageOpsService';" % ', '.join(names) + t[m.end():]
    else:
        raise SystemExit('imageOpsService import 行未找到')
else:
    lines = t.split('\n')
    last = max(i for i, l in enumerate(lines) if l.startswith('import '))
    lines.insert(last + 1, "import { startDrag } from '../services/imageOpsService';")
    t = '\n'.join(lines)

anchor = '  s.escHandler = (...args: any[]) => escHandler(...args);'
if anchor not in t:
    raise SystemExit('挂载锚点未找到')
add = anchor + """

  // b1-9bz-B-8：原版主 UI 工作流驱动脚本（electron/main.cjs 的 selectItems / 等）经 scope
  // 面调用的名字 —— 与子窗口同款需求（脚本在页面主世界驱动 scope，无法直 import）。
  // 原由 fns 表 if-absent 供给，表退役后改为显式挂载。
  s.addImagesToFolder = (...args: any[]) => addImagesToFolder(...args);
  s.copyAsPath = (...args: any[]) => copyAsPath(...args);
  s.getRawPath = (...args: any[]) => getRawPath(...args);
  s.getRawUrl = (...args: any[]) => getRawUrl(...args);
  s.select = (...args: any[]) => select(...args);
  s.startDrag = (...args: any[]) => startDrag(...args);"""
t = t.replace(anchor, add, 1)

io.open(p, 'w', encoding='utf-8', newline='').write(t.replace('\n', nl))
print('主驱动 6 名已显式挂载')
