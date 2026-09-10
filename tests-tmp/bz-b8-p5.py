# b1-9bz-B-8 / 第四波：别名接收者（body./bs./sc.）下的漏网调用点。
# 起因：终态校验只覆盖固定前缀（s/scope/s0/bodyScope/$bodyScope/$rootScope），
# 漏掉了 `$on` 处理器里捕获的别名（body/bs/sc）。按「接收者」反查才发现。
import io, os, re

ROOT = os.path.abspath('.')
# (文件, 接收者, 名字, map module)
JOBS = [
    ('src/app/react/components/detail/detailHooks.ts', 'sc', 'openItemContextMenu', '../services/itemMenuService'),
    ('src/app/react/components/stage7/BatchSavePanel.tsx', 'body', 'uploadUrls', '../services/uploadService'),
    ('src/app/react/components/stage7/BatchSavePanel.tsx', 'body', 'addToRecentFolders', 'src/app/react/services/batchOpsService.ts'),
    ('src/app/react/components/stage7/ControllerModals.tsx', 'body', 'uploadFiles', '../services/uploadService'),
    ('src/app/react/components/stage7/DuplicateFamily.tsx', 'body', 'scrollToSelectedItem', 'src/app/react/services/batchOpsService.ts'),
    ('src/app/react/components/stage7/FolderModals.tsx', 'body', 'moveFoldersAsSibling', 'src/app/react/services/folderCoreService.ts'),
    ('src/app/react/components/stage7/FolderModals.tsx', 'body', 'moveFoldersToFolder', 'src/app/react/services/folderCoreService.ts'),
    ('src/app/react/components/stage7/FolderSelectPanels.tsx', 'body', 'openSmartFolder', '../services/folderCoreService'),
    ('src/app/react/core/apiServerDomain.ts', 'bs', 'addToRecentFolders', 'src/app/react/services/batchOpsService.ts'),
    ('src/app/react/core/apiServerDomain.ts', 'bs', 'uploadFiles', '../services/uploadService'),
    ('src/app/react/core/apiServerDomain.ts', 'bs', 'uploadUrls', '../services/uploadService'),
]


def rel_module(from_file, mod):
    if mod.startswith('src/'):
        target = os.path.join(ROOT, mod)
    else:
        target = os.path.normpath(os.path.join(ROOT, 'src/app/react/core', mod))
    target = re.sub(r'\.tsx?$', '', target)
    rel = os.path.relpath(target, os.path.dirname(os.path.join(ROOT, from_file))).replace('\\', '/')
    return rel if rel.startswith('.') else './' + rel


by_file = {}
for f, recv, name, mod in JOBS:
    by_file.setdefault(f, []).append((recv, name, mod))

for f, items in by_file.items():
    p = os.path.join(ROOT, f)
    s = io.open(p, encoding='utf-8', newline='').read()
    nl = '\r\n' if '\r\n' in s else '\n'
    t = s.replace('\r\n', '\n')
    total = 0
    mods = {}
    for recv, name, mod in items:
        t, k = re.subn(r'\b%s\s*\.\s*%s\s*\(' % (re.escape(recv), re.escape(name)), name + '(', t)
        if k == 0:
            raise SystemExit('未匹配 %s :: %s.%s(' % (f, recv, name))
        total += k
        mods.setdefault(rel_module(f, mod), []).append(name)
    for mod, names in mods.items():
        m = re.search(r"^import \{([^}]*)\} from '%s';$" % re.escape(mod), t, re.M)
        if m:
            merged = sorted(set([x.strip() for x in m.group(1).split(',') if x.strip()] + names))
            t = t[:m.start()] + "import { %s } from '%s';" % (', '.join(merged), mod) + t[m.end():]
        else:
            lines = t.split('\n')
            last = max(i for i, l in enumerate(lines) if l.startswith('import '))
            lines.insert(last + 1, "import { %s } from '%s';" % (', '.join(sorted(names)), mod))
            t = '\n'.join(lines)
    io.open(p, 'w', encoding='utf-8', newline='').write(t.replace('\n', nl))
    print('  %-52s 修 %d 处' % (f.replace('src/app/react/', ''), total))
print('第四波完成')
