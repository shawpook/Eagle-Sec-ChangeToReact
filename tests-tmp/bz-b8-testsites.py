# 列出测试里经 scope 面调用的 TABLE-only 名（精确到行），供改写为 __eaglePorts。
import io, re, json, subprocess

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
CALL = re.compile(r'([A-Za-z_$][\w$]*)\s*\??\s*\.\s*([A-Za-z_$][\w$]*)\s*\(')
for f in tests:
    try:
        s = io.open(f, encoding='utf-8', errors='ignore').read()
    except Exception:
        continue
    lines = s.split('\n')
    out = []
    for m in CALL.finditer(s):
        recv, name = m.group(1), m.group(2)
        if name not in RISK:
            continue
        if recv not in ('$bodyScope', 'bodyScope', '$scope', 'sc', 'b', 'body', 'bs', 'scope'):
            continue
        ln = s[:m.start()].count('\n')
        out.append((ln + 1, lines[ln].strip()[:110], recv + '.' + name))
    if out:
        print('### %s' % f)
        for ln, txt, tag in out:
            print('    :%-5d %-28s %s' % (ln, tag, txt))
