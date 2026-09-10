# 扫描测试里把 scope 面当调用入口的站点（B8 后 TABLE-only 名不再供在 scope 上）。
import io, re, json, os, subprocess

d = json.load(io.open('tests-tmp/bz-b-scope-map.json', encoding='utf-8'))
SRC = [f for f in subprocess.check_output(['git', 'ls-files', 'src/app/react'], text=True).split()
       if f.endswith(('.ts', '.tsx'))]
WRITTEN = set()
for f in SRC:
    if any(f.replace('src/app/react/', '').startswith(x) for x in ('preview-window/', 'collect-window/', 'preferences/')):
        continue
    s = io.open(f, encoding='utf-8').read()
    for m in re.finditer(r'(?<![\w$])(?:\$)?(?:s|scope|s0|bodyScope|rootScope)\.([A-Za-z_$][\w$]*)\s*=[^=]', s):
        WRITTEN.add(m.group(1))
RISK = set(n for n, v in d.items() if v.get('route') == 'TABLE' and n not in WRITTEN)

tests = [f for f in subprocess.check_output(['git', 'ls-files', 'tests'], text=True).split()
         if f.endswith(('.mjs', '.js', '.cjs'))]

CALL = re.compile(r'(?:\$bodyScope|bodyScope|\$rootScope|\$scope|(?<![\w.])(?:s|sc|scope|b|bs))\s*\??\s*\.\s*([A-Za-z_$][\w$]*)\s*\(')
per = {}
tot = 0
allnames = set()
for f in tests:
    try:
        s = io.open(f, encoding='utf-8', errors='ignore').read()
    except Exception:
        continue
    hits = {}
    for m in CALL.finditer(s):
        n = m.group(1)
        if n in RISK:
            hits.setdefault(n, 0)
            hits[n] += 1
            allnames.add(n)
            tot += 1
    if hits:
        per[f] = hits
print('测试里经 scope 面调用 TABLE-only 名：%d 文件 / 去重 %d 名 / 站点 %d 处' % (len(per), len(allnames), tot))
for f, hits in sorted(per.items()):
    print('  %-46s %s' % (f, ', '.join('%s×%d' % (k, v) for k, v in sorted(hits.items()))))
print()
print('涉及名字:', ' '.join(sorted(allnames)))
