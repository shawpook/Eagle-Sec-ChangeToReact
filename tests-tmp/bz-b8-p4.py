# b1-9bz-B-8 / 第三波：$bodyScope.X(...) 限定形态的漏网调用点（扫描器早前把 `$` 前缀排除了）。
import io, os, re

ROOT = os.path.abspath('.')
JOBS = [
    ('src/app/react/components/grid/gridDirectives.ts',
     [("$bodyScope.scrollToSelectedItem();", "scrollToSelectedItem();")],
     {'scrollToSelectedItem': 'src/app/react/services/batchOpsService.ts'}),
    ('src/app/react/core/bitmapViewer.ts',
     [("const url = $bodyScope.getRawUrl(item);", "const url = getRawUrl(item);")],
     {'getRawUrl': '../core/itemDomain'}),
    ('src/app/react/core/dataMachinery.ts',
     [('w.$("img#detail-image").attr("src", w.$bodyScope.getRawUrl(image));',
       'w.$("img#detail-image").attr("src", getRawUrl(image));')],
     None),   # 本地导出，无需 import
    ('src/app/react/core/hoverPreview.ts',
     [("_w.$bodyScope.getRawUrl(image)", "getRawUrl(image)")],
     {'getRawUrl': '../core/itemDomain'}),
    ('src/app/react/core/smoothZoomEngine.ts',
     [("$bodyScope.startDrag && $bodyScope.startDrag();", "startDrag();"),
      ("const rawURL = $bodyScope.getRawUrl(image);", "const rawURL = getRawUrl(image);"),
      ("const thumbnailURL = $bodyScope.getThumbnailUrl(image);", "const thumbnailURL = getThumbnailUrl(image);")],
     {'getRawUrl': '../core/itemDomain',
      'getThumbnailUrl': 'src/app/react/services/imageOpsService.ts',
      'startDrag': 'src/app/react/services/imageOpsService.ts'}),
    ('src/app/react/core/tagManagerDomain.ts',
     [("historyLibraryMenu.items = $bodyScope.getLibraryHistory().filter(", "historyLibraryMenu.items = getLibraryHistory().filter(")],
     {'getLibraryHistory': '../services/folderCoreService'}),
    ('src/app/react/services/itemMenuService.ts',
     [("historyLibraryMenu.items = $bodyScope.getLibraryHistory().filter(", "historyLibraryMenu.items = getLibraryHistory().filter(")],
     {'getLibraryHistory': '../services/folderCoreService'}),
]


def rel_module(from_file, mod):
    if mod.startswith('src/'):
        target = os.path.join(ROOT, mod)
    else:
        target = os.path.normpath(os.path.join(ROOT, 'src/app/react/core', mod))
    target = re.sub(r'\.tsx?$', '', target)
    rel = os.path.relpath(target, os.path.dirname(os.path.join(ROOT, from_file))).replace('\\', '/')
    return rel if rel.startswith('.') else './' + rel


def insert_imports(t, mods):
    for mod, names in mods.items():
        m = re.search(r"^import \{([^}]*)\} from '%s';$" % re.escape(mod), t, re.M)
        if m:
            merged = sorted(set([x.strip() for x in m.group(1).split(',') if x.strip()] + names))
            t = t[:m.start()] + "import { %s } from '%s';" % (', '.join(merged), mod) + t[m.end():]
            continue
        lines = t.split('\n')
        idx = [i for i, l in enumerate(lines) if l.startswith('import ')]
        if idx:
            at = idx[-1] + 1
        else:
            # 无 import 的文件（vendor 搬迁件）：插在 @ts-nocheck 之后，否则插在首个非注释行之前
            at = 0
            for i, l in enumerate(lines[:40]):
                if l.strip() == '// @ts-nocheck':
                    at = i + 1
                    break
            else:
                for i, l in enumerate(lines):
                    if l.strip() and not l.strip().startswith(('*', '/*', '//')):
                        at = i
                        break
        lines.insert(at, "import { %s } from '%s';" % (', '.join(sorted(names)), mod))
        t = '\n'.join(lines)
    return t


for file, pairs, imports in JOBS:
    p = os.path.join(ROOT, file)
    s = io.open(p, encoding='utf-8', newline='').read()
    nl = '\r\n' if '\r\n' in s else '\n'
    t = s.replace('\r\n', '\n')
    n = 0
    for a, b in pairs:
        if a in t:
            n += t.count(a)
            t = t.replace(a, b)
        elif b not in t:
            raise SystemExit('未匹配 %s :: %s' % (file, a[:70]))
    if imports:
        mods = {}
        for name, mod in imports.items():
            mods.setdefault(rel_module(file, mod), []).append(name)
        t = insert_imports(t, mods)
    io.open(p, 'w', encoding='utf-8', newline='').write(t.replace('\n', nl))
    print('  %-52s 修 %d 处' % (file.replace('src/app/react/', ''), n))
print('第三波完成')
