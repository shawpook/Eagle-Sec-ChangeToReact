"""给 dataMachinery.ts 中被外部 import 但未导出的 machineryXxx 补 export 关键字。"""
import io
import os
import re

DM = 'src/app/react/core/dataMachinery.ts'
src = io.open(DM, encoding='utf-8').read()

# 1) 收集全树对 dataMachinery 的 import 符号
wanted = set()
for base, _d, files in os.walk('src/app/react'):
    for fn in files:
        if not fn.endswith(('.ts', '.tsx')):
            continue
        p = os.path.join(base, fn)
        if os.path.normpath(p).replace('\\', '/') == DM:
            continue
        t = io.open(p, encoding='utf-8').read()
        for m in re.finditer(r"""import\s*\{([^}]*)\}\s*from\s*['"][^'"]*dataMachinery['"]""", t):
            for part in m.group(1).split(','):
                nm = part.strip().split(' as ')[0].strip()
                if nm:
                    wanted.add(nm)

# 2) 现有导出面
exported = set()
for m in re.finditer(r'^export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)', src, re.M):
    exported.add(m.group(1))
for m in re.finditer(r'^export\s+(?:const|let|var)\s+([A-Za-z_$][\w$]*)', src, re.M):
    exported.add(m.group(1))
for m in re.finditer(r'^export\s*\{([^}]*)\}', src, re.M):
    for part in m.group(1).split(','):
        nm = part.strip().split(' as ')[0].strip()
        if nm:
            exported.add(nm)

missing = sorted(wanted - exported)
print('外部引用 %d 个符号；其中未导出 %d 个' % (len(wanted), len(missing)))

# 3) 给未导出的 function 声明补 export
fixed = []
for nm in missing:
    pat = re.compile(r'^(function\s+%s\s*\()' % re.escape(nm), re.M)
    if pat.search(src):
        src = pat.sub(r'export \1', src, count=1)
        fixed.append(nm)
    else:
        print('  !! 未找到 function 声明：%s' % nm)

io.open(DM, 'w', encoding='utf-8').write(src)
print('补 export：%d 个' % len(fixed))
for nm in fixed[:40]:
    print('   +', nm)
