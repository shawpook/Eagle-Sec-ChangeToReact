import re, os, collections

base = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'src', 'app', 'react')
cf = open(os.path.join(base, 'core', 'controllerFns.ts'), encoding='utf-8').read()
tab = set(re.findall(r'fns\["([^"]+)"\]\s*=', cf))
dm = open(os.path.join(base, 'core', 'dataMachinery.ts'), encoding='utf-8').read()
mach = set(re.findall(r'machinery([A-Za-z][A-Za-z0-9]*)', dm))
supplied = set(tab) | {m[0].lower() + m[1:] for m in mach} | set(mach)
shim_api = {'$evalAsync', '$apply', '$broadcast', '$emit', '$on', '$watch',
            '$watchCollection', '$digest', '$new', '$destroy', '$eval'}
# 只审计主窗口作用域：components / app / store / global / main.tsx / core(非七域)
SKIP_DIRS = {'preferences', 'collect-window', 'preview-window'}
CORE_DOMAIN = {'dataMachinery.ts', 'controllerFns.ts', 'libraryDomain.ts', 'itemDomain.ts',
               'filterDomain.ts', 'miscDomain.ts', 'selectionViewDomain.ts', 'apiServerDomain.ts'}
pats = [r'\bs\.([A-Za-z_$][\w$]*)\s*\(', r"callScope\(\s*'([^']+)'",
        r"getBodyScope\(\)\.([A-Za-z_$][\w$]*)\s*\("]
names = collections.Counter()
where = collections.defaultdict(set)
files = 0
for root, dirs, fs in os.walk(base):
    rel = os.path.relpath(root, base)
    top = rel.split(os.sep)[0]
    if top in SKIP_DIRS or 'node_modules' in root:
        continue
    for f in fs:
        if not f.endswith(('.ts', '.tsx')):
            continue
        if top == 'core' and f in CORE_DOMAIN:
            continue
        files += 1
        src = open(os.path.join(root, f), encoding='utf-8').read()
        for pt in pats:
            for n in set(re.findall(pt, src)):
                names[n] += 1
                where[n].add(rel + os.sep + f if rel != '.' else f)
miss = [(n, len(where[n])) for n in names
        if n not in supplied and n not in shim_api and n != 'X']
print("审计文件数:", files)
print("主窗口 React 侧 scope 函数调用名总数:", len(names))
print("有供给:", len(names) - len(miss), "  无供给:", len(miss))
print("")
for n, c in sorted(miss, key=lambda x: (-x[1], x[0])):
    print("  %-34s %d处  例:%s" % (n, c, sorted(where[n])[0]))
