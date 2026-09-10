# b1-9bz-B-8 / Phase 2：字符串式动态派发 → 函数引用直调。
# helper 改为「接受 string | Function」，再逐点把「表供给但未挂载」的名字换成标识符引用。
import io, os, re

ROOT = os.path.abspath('.')

HELP_CALL_OLD = """const call = (fn: string, ...preArgs: any[]) => (e?: any) =>
  scopeApply(getBodyScope(), (scope) => {
    if (typeof scope[fn] === 'function') scope[fn](...(preArgs.length ? preArgs : e === undefined ? [] : [e]));
  });"""
HELP_CALL_NEW = """const call = (fn: string | ((...a: any[]) => any), ...preArgs: any[]) => (e?: any) =>
  scopeApply(getBodyScope(), (scope) => {
    const target = typeof fn === 'function' ? fn : scope[fn];
    if (typeof target === 'function') target(...(preArgs.length ? preArgs : e === undefined ? [] : [e]));
  });"""

CALLSEQ_OLD = """const callSeq = (...fns: Array<[string, any?]>) => (e: any) =>"""
CALLSEQ_NEW = """const callSeq = (...fns: Array<[string | ((...a: any[]) => any), any?]>) => (e: any) =>"""
CALLSEQ_BODY_OLD = """    for (const [fn, arg] of fns) {
      if (typeof scope[fn] === 'function') scope[fn](...(arg !== undefined ? [arg] : [e]));
    }"""
CALLSEQ_BODY_NEW = """    for (const [fn, arg] of fns) {
      const target = typeof fn === 'function' ? fn : scope[fn];
      if (typeof target === 'function') target(...(arg !== undefined ? [arg] : [e]));
    }"""

SCOPE_FN_OLD = """function scopeFn(fn: string, ...args: any[]) {
  return (e?: any) => {
    const scope = getBodyScope();
    if (!scope || typeof scope[fn] !== 'function') return;
    const ev = e && e.nativeEvent ? e.nativeEvent : e;
    scope[fn](...(args.length ? args : [ev]));
  };
}"""
SCOPE_FN_NEW = """function scopeFn(fn: string | ((...a: any[]) => any), ...args: any[]) {
  return (e?: any) => {
    const scope = getBodyScope();
    if (!scope) return;
    const target = typeof fn === 'function' ? fn : scope[fn];
    if (typeof target !== 'function') return;
    const ev = e && e.nativeEvent ? e.nativeEvent : e;
    target(...(args.length ? args : [ev]));
  };
}"""

CG_OLD = """function callGetter(scope: any, name: string, arg?: any): string {
  try {
    if (typeof scope[name] !== 'function') return '';
    const value = arg !== undefined ? scope[name](arg) : scope[name]();
    return value == null ? '' : String(value);
  } catch (err) {
    return '';
  }
}"""
CG_NEW = """function callGetter(scope: any, name: string | ((...a: any[]) => any), arg?: any): string {
  try {
    const fn = typeof name === 'function' ? name : scope[name];
    if (typeof fn !== 'function') return '';
    const value = arg !== undefined ? fn(arg) : fn();
    return value == null ? '' : String(value);
  } catch (err) {
    return '';
  }
}"""


def rel_module(from_file, mod):
    if mod.startswith('src/'):
        target = os.path.join(ROOT, mod)
    else:
        target = os.path.normpath(os.path.join(ROOT, 'src/app/react/core', mod))
    target = re.sub(r'\.tsx?$', '', target)
    rel = os.path.relpath(target, os.path.dirname(os.path.join(ROOT, from_file))).replace('\\', '/')
    return rel if rel.startswith('.') else './' + rel


def add_imports(text, file, mods):
    by_mod = {}
    for name, mod in mods.items():
        by_mod.setdefault(rel_module(file, mod), []).append(name)
    for mod, names in by_mod.items():
        m = re.search(r"^import \{([^}]*)\} from '%s';$" % re.escape(mod), text, re.M)
        if m:
            merged = sorted(set([x.strip() for x in m.group(1).split(',') if x.strip()] + names))
            text = text[:m.start()] + "import { %s } from '%s';" % (', '.join(merged), mod) + text[m.end():]
        else:
            lines = text.split('\n')
            last = max(i for i, l in enumerate(lines) if l.startswith('import '))
            lines.insert(last + 1, "import { %s } from '%s';" % (', '.join(sorted(names)), mod))
            text = '\n'.join(lines)
    return text


# (file, 直接调用点列表 [(helper, name)], helper 替换对, 数组内 ['NAME'] 列表, imports)
JOBS = [
    ('src/app/react/components/detail/DetailViewer.tsx',
     [('call', 'openItemContextMenu')], (HELP_CALL_OLD, HELP_CALL_NEW), [],
     {'openItemContextMenu': '../services/itemMenuService'}),
    ('src/app/react/components/inspector/Inspector.tsx',
     [('call', 'removeFromFolder')], (HELP_CALL_OLD, HELP_CALL_NEW), [],
     {'removeFromFolder': 'src/app/react/services/batchOpsService.ts'}),
    ('src/app/react/components/stage7/TagManager.tsx',
     [('call', 'openTag')], (HELP_CALL_OLD, HELP_CALL_NEW), [],
     {'openTag': 'src/app/react/services/batchOpsService.ts'}),
    ('src/app/react/components/stage7/SmallPanels.tsx',
     [('call', 'showListSubfolderContent'), ('call', 'openApplicationContextMenu'), ('call', 'switchLibrary')],
     (HELP_CALL_OLD, HELP_CALL_NEW), [],
     {'showListSubfolderContent': 'src/app/react/services/folderMenuService.ts',
      'openApplicationContextMenu': 'src/app/react/services/miscMenuService.ts',
      'switchLibrary': '../services/folderCoreService'}),
    ('src/app/react/components/shell/ListRegion.tsx',
     [('scopeFn', 'importFolders'), ('scopeFn', 'showListSubfolderContent'),
      ('scopeFn', 'cleanSelected'), ('scopeFn', 'openFolder')],
     (SCOPE_FN_OLD, SCOPE_FN_NEW), [],
     {'importFolders': '../services/uploadService',
      'showListSubfolderContent': 'src/app/react/services/folderMenuService.ts',
      'cleanSelected': 'src/app/react/services/batchOpsService.ts',
      'openFolder': '../services/folderCoreService'}),
    ('src/app/react/components/toolbar/Toolbar.tsx',
     [('call', 'openApplicationContextMenu'), ('call', 'openSmartFolder'), ('call', 'openOrderMenu')],
     (HELP_CALL_OLD, HELP_CALL_NEW), ['resetFilter', 'openFolder'],
     {'openApplicationContextMenu': 'src/app/react/services/miscMenuService.ts',
      'openOrderMenu': 'src/app/react/services/miscMenuService.ts',
      'resetFilter': '../core/filterDomain',
      'openFolder': '../services/folderCoreService',
      'openSmartFolder': '../services/folderCoreService'}),
    ('src/app/react/components/sidebar/Sidebar.tsx',
     [], None, [],
     {'moveFoldersAsSibling': 'src/app/react/services/folderCoreService.ts',
      'moveFoldersToFolder': 'src/app/react/services/folderCoreService.ts'}),
    ('src/app/react/store/detailState.ts',
     [('callGetter', 'getRawUrl'), ('callGetter', 'getThumbnailUrl'), ('callGetter', 'getRawPath'),
      ('callGetter', 'getPDFPath'), ('callGetter', 'getGIFPath'), ('callGetter', 'getNativeViewerPath'),
      ('callGetter', 'getURLSrc'), ('callGetter', 'getRawViewerPath'), ('callGetter', 'getFontPath'),
      ('callGetter', 'getTxtPath'), ('callGetter', 'getModelPath')],
     (CG_OLD, CG_NEW), [],
     {'getRawUrl': '../core/itemDomain', 'getThumbnailUrl': 'src/app/react/services/imageOpsService.ts',
      'getRawPath': '../core/itemDomain', 'getPDFPath': '../core/itemDomain',
      'getGIFPath': '../core/itemDomain', 'getNativeViewerPath': '../core/itemDomain',
      'getURLSrc': '../core/itemDomain', 'getRawViewerPath': '../core/itemDomain',
      'getFontPath': 'src/app/react/services/fontTagService.ts', 'getTxtPath': '../core/itemDomain',
      'getModelPath': '../core/itemDomain'}),
]

for file, calls, helper, arrays, imports in JOBS:
    p = os.path.join(ROOT, file)
    s = io.open(p, encoding='utf-8', newline='').read()
    nl = '\r\n' if '\r\n' in s else '\n'
    t = s.replace('\r\n', '\n')
    n = 0
    if helper:
        a, b = helper
        if a not in t:
            raise SystemExit('helper 未匹配: ' + file)
        t = t.replace(a, b, 1)
    if file.endswith('Toolbar.tsx'):
        for a, b in [(CALLSEQ_OLD, CALLSEQ_NEW), (CALLSEQ_BODY_OLD, CALLSEQ_BODY_NEW)]:
            if a not in t:
                raise SystemExit('callSeq 未匹配')
            t = t.replace(a, b, 1)
    for helper_name, name in calls:
        pat = r"(?<![\w$.])%s\('%s'" % (re.escape(helper_name), re.escape(name))
        t, k = re.subn(pat, "%s(%s" % (helper_name, name), t)
        if k == 0:
            raise SystemExit('调用点未匹配 %s :: %s' % (file, name))
        n += k
    for name in arrays:
        pat = r"\[\s*'%s'" % re.escape(name)
        t, k = re.subn(pat, "[%s" % name, t)
        if k == 0:
            raise SystemExit('数组站点未匹配 %s :: %s' % (file, name))
        n += k
    if file.endswith('Sidebar.tsx'):
        pairs = [
            ("    const zones: Array<[string, string, boolean?]> = isQuick",
             "    const zones: Array<[string, any, boolean?]> = isQuick"),
            ("? [[`.${prefix}-top-area`, 'moveFoldersAsSibling'], [`.${prefix}-bottom-area`, 'moveFoldersAsSibling', true]]",
             "? [[`.${prefix}-top-area`, moveFoldersAsSibling], [`.${prefix}-bottom-area`, moveFoldersAsSibling, true]]"),
            ("        : [[`.${prefix}-name-area`, 'moveFoldersToFolder'], [`.${prefix}-top-area`, 'moveFoldersAsSibling'], [`.${prefix}-bottom-area`, 'moveFoldersAsSibling', true]];",
             "        : [[`.${prefix}-name-area`, moveFoldersToFolder], [`.${prefix}-top-area`, moveFoldersAsSibling], [`.${prefix}-bottom-area`, moveFoldersAsSibling, true]];"),
            ("    zones.forEach(([selector, fnName, asSiblingBelow]) => {",
             "    zones.forEach(([selector, fnEntry, asSiblingBelow]) => {"),
            ("          bodyScope[fnName](dragged, target, ...(asSiblingBelow ? [true] : []));",
             "          const impl = typeof fnEntry === 'function' ? fnEntry : bodyScope[fnEntry];\n          if (typeof impl !== 'function') return;\n          impl(dragged, target, ...(asSiblingBelow ? [true] : []));"),
        ]
        for a, b in pairs:
            if a not in t:
                raise SystemExit('Sidebar 段落未匹配: ' + a[:60])
            t = t.replace(a, b, 1)
            n += 1
    t = add_imports(t, file, imports)
    io.open(p, 'w', encoding='utf-8', newline='').write(t.replace('\n', nl))
    print('  patched %-52s sites=%d imports=%d' % (file.replace('src/app/react/', ''), n, len(imports)))

print('Phase 2 完成')
