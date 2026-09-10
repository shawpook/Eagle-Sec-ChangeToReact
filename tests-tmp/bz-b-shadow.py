"""排查：改造新增的 import 符号是否被文件内的局部声明遮蔽（只读）。"""
import io
import os
import re
import subprocess

files = [f for f in subprocess.check_output(
    ['git', 'diff', '--name-only', '--', 'src/app/react/'], text=True).split()
    if f.endswith(('.ts', '.tsx'))]

# 收集本次改造新增的 import 符号（对比 HEAD 版本）
added_imports = {}   # file -> [syms]
for f in files:
    old = subprocess.check_output(['git', 'show', 'HEAD:' + f.replace('\\', '/')], text=True)
    new = io.open(f, encoding='utf-8').read()

    def imports_of(t):
        out = set()
        for m in re.finditer(r"""^import\s*\{([^}]*)\}\s*from\s*['"][^'"]+['"]""", t, re.M):
            for part in m.group(1).split(','):
                nm = part.strip().split(' as ')[0].strip()
                if nm:
                    out.add(nm)
        return out

    a = imports_of(new) - imports_of(old)
    if a:
        added_imports[f] = sorted(a)

# 局部声明（任意层级）：const/let/var/function/class
DECL = re.compile(r'^\s*(?:export\s+)?(?:async\s+)?(?:const|let|var|function\*?|class)\s+([A-Za-z_$][\w$]*)', re.M)
PARAM = re.compile(r'(?:function\s*[A-Za-z_$\w]*\s*\(([^)]*)\)|\(([^)]*)\)\s*=>)')

print('本次改造新增 import 的文件：%d' % len(added_imports))
conflicts = []
for f, syms in sorted(added_imports.items()):
    src = io.open(f, encoding='utf-8').read()
    local = set(m.group(1) for m in DECL.finditer(src))
    # 形参也算遮蔽（箭头函数参数）
    for m in PARAM.finditer(src):
        chunk = m.group(1) or m.group(2) or ''
        for p in chunk.split(','):
            p = p.strip().split(':')[0].strip().split('=')[0].strip()
            if re.match(r'^[A-Za-z_$][\w$]*$', p):
                local.add(p)
    hit = [s for s in syms if s in local]
    if hit:
        conflicts.append((f, hit))

print('存在同名遮蔽的文件：%d' % len(conflicts))
for f, hit in conflicts:
    print('  %s' % f)
    for s in hit:
        print('      %s' % s)
