# B8 漏网扫描：捕获 $bodyScope / $rootScope 限定形态的表供给名调用点。
import io, re, json, subprocess

d = json.load(io.open('tests-tmp/bz-b-scope-map.json', encoding='utf-8'))
files = [f for f in subprocess.check_output(['git', 'ls-files', 'src/app/react'], text=True).split()
         if f.endswith(('.ts', '.tsx'))]

WRITTEN = set()
for f in files:
    # 其它窗口（preview/collect/preferences）的 scope 与 bodyScope 无关，排除其写入以免误判
    if any(f.replace('src/app/react/', '').startswith(x) for x in ('preview-window/', 'collect-window/', 'preferences/')):
        continue
    s = io.open(f, encoding='utf-8').read()
    for m in re.finditer(r'(?<![\w$])(?:\$)?(?:s|scope|s0|bodyScope|rootScope)\.([A-Za-z_$][\w$]*)\s*=[^=]', s):
        WRITTEN.add(m.group(1))

RISK = set(n for n, v in d.items() if v.get('route') == 'TABLE' and n not in WRITTEN)
SKIP = ('preview-window/', 'collect-window/', 'preferences/')

CALL = re.compile(r'(?:\$bodyScope|\$rootScope|(?<![\w.])(?:bodyScope|scope|s0|s))\.([A-Za-z_$][\w$]*)\s*\(')
tot = 0
for f in files:
    rel = f.replace('src/app/react/', '')
    if any(rel.startswith(x) for x in SKIP):
        continue
    s = io.open(f, encoding='utf-8').read()
    lines = s.split('\n')
    for m in CALL.finditer(s):
        n = m.group(1)
        if n.startswith('$') or n not in RISK:
            continue
        ln = s[:m.start()].count('\n') + 1
        print('  %-48s :%-5d %s' % (rel, ln, lines[ln - 1].strip()[:100]))
        tot += 1
print('\n漏网「表供给名」调用点合计 %d 处' % tot)
