# b1-9bz-B-8 / 第五波：接收者为「调用表达式」的漏网（getBodyScope().NAME(...)）。
# 扫描器只认「简单标识符.NAME(」，漏掉了 getBodyScope().NAME( / getScope().NAME( 形态。
import io, os, re

ROOT = os.path.abspath('.')
JOBS = {
    'src/app/react/components/detail/commentHooks.ts': [('getRawPath', '../core/itemDomain')],
    'src/app/react/components/detail/detailHooks.ts': [('setAsVideoThumbnail', '../services/mediaService')],
    'src/app/react/components/inspector/Inspector.tsx': [('getRawUrl', '../core/itemDomain')],
    'src/app/react/components/inspector/inspectorActions.ts': [
        ('pasteTags', 'src/app/react/services/batchOpsService.ts'),
        ('copyTags', 'src/app/react/services/batchOpsService.ts'),
        ('openItemContextMenu', '../services/itemMenuService')],
    'src/app/react/components/stage7/BatchRenameArtstationModals.tsx': [
        ('openFolder', '../services/folderCoreService'),
        ('addToRecentFolders', 'src/app/react/services/batchOpsService.ts'),
        ('uploadUrls', '../services/uploadService')],
    'src/app/react/components/stage7/selectPanelEngine.ts': [('createFolder', 'src/app/react/services/folderCoreService.ts')],
}


def rel_module(from_file, mod):
    if mod.startswith('src/'):
        target = os.path.join(ROOT, mod)
    else:
        target = os.path.normpath(os.path.join(ROOT, 'src/app/react/core', mod))
    target = re.sub(r'\.tsx?$', '', target)
    rel = os.path.relpath(target, os.path.dirname(os.path.join(ROOT, from_file))).replace('\\', '/')
    return rel if rel.startswith('.') else './' + rel


for f, items in JOBS.items():
    p = os.path.join(ROOT, f)
    s = io.open(p, encoding='utf-8', newline='').read()
    nl = '\r\n' if '\r\n' in s else '\n'
    t = s.replace('\r\n', '\n')
    total = 0
    mods = {}
    for name, mod in items:
        pat = r'(?:getBodyScope|getRootScope|bodyScope|getScope)\s*\(\s*\)\s*\.\s*%s\s*\(' % re.escape(name)
        t, k = re.subn(pat, name + '(', t)
        if k == 0:
            raise SystemExit('未匹配 %s :: %s' % (f, name))
        total += k
        mods.setdefault(rel_module(f, mod), []).append(name)
    for mod, names in mods.items():
        m = re.search(r"^import \{([^}]*)\} from '%s';$" % re.escape(mod), t, re.M)
        if m:
            merged = sorted(set([x.strip() for x in m.group(1).split(',') if x.strip()] + names))
            t = t[:m.start()] + "import { %s } from '%s';" % (', '.join(merged), mod) + t[m.end():]
        else:
            lines = t.split('\n')
            idx = [i for i, l in enumerate(lines) if l.startswith('import ')]
            at = idx[-1] + 1 if idx else 0
            lines.insert(at, "import { %s } from '%s';" % (', '.join(sorted(names)), mod))
            t = '\n'.join(lines)
    io.open(p, 'w', encoding='utf-8', newline='').write(t.replace('\n', nl))
    print('  %-56s 修 %d 处' % (f.replace('src/app/react/', ''), total))
print('第五波完成')
