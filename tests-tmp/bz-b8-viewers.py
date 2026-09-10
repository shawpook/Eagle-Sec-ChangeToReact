# 枚举子窗口(viewers/)经 parent.$bodyScope 需要的名字，并与 RISK（表供给且我方未挂载）求交。
import io, re, json, subprocess, os

d = json.load(io.open('tests-tmp/bz-b-scope-map.json', encoding='utf-8'))
OLD = subprocess.check_output(['git', 'show', 'HEAD:src/app/react/core/dataMachinery.ts'], text=True)
i = OLD.find('export function applyDataMachineryScope')
MOUNTED = set(re.findall(r'\bs\.([A-Za-z_$][\w$]*)\s*=', OLD[i:])) | set(
    re.findall(r'\bs\.([A-Za-z_$][\w$]*)\s*=\s*(?:\(|machinery|function)', OLD))

# 我方代码其它写入
SRC = [f for f in subprocess.check_output(['git', 'ls-files', 'src/app/react'], text=True).split()
       if f.endswith(('.ts', '.tsx'))]
WRITTEN = set(MOUNTED)
for f in SRC:
    if any(f.replace('src/app/react/', '').startswith(x) for x in ('preview-window/', 'collect-window/', 'preferences/')):
        continue
    s = io.open(f, encoding='utf-8').read()
    for m in re.finditer(r'(?<![\w$])(?:\$)?(?:s|scope|s0|bodyScope|rootScope)\.([A-Za-z_$][\w$]*)\s*=[^=]', s):
        WRITTEN.add(m.group(1))

RISK = set(n for n, v in d.items() if v.get('route') == 'TABLE' and n not in WRITTEN)

V = [f for f in SRC if f.replace('src/app/react/', '').startswith('viewers/')]
print('viewers/ 文件 %d 个' % len(V))
need = {}
for f in V:
    s = io.open(f, encoding='utf-8').read()
    # parentCall('X')  /  $parentScope.X(  /  parentScope.X(  /  $parentScope['X']
    names = set(re.findall(r"parentCall\(\s*'([A-Za-z_$][\w$]*)'", s))
    names |= set(re.findall(r'(?:\$)?parentScope\.([A-Za-z_$][\w$]*)\s*[\(\.]', s))
    names |= set(re.findall(r"(?:\$)?parentScope\[\s*'([A-Za-z_$][\w$]*)'\s*\]", s))
    hit = sorted(n for n in names if n in RISK)
    allnames = sorted(names)
    print('  %-44s 引用 %d 名，其中 RISK %d: %s' % (f.replace('src/app/react/', ''), len(allnames), len(hit), ' '.join(hit)))
    for n in hit:
        need.setdefault(n, set()).add(f.replace('src/app/react/', ''))
print()
print('子窗需要但已无供给的名字 %d 个:' % len(need))
for n, fs in sorted(need.items()):
    print('  %-24s %s' % (n, ' '.join(sorted(fs))))
print()
print('各名字落点模块:')
for n in sorted(need):
    v = d.get(n) or {}
    print('  %-24s mod=%s' % (n, v.get('module') or '-'))
