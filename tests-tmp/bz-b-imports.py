"""校验 src/app/react 下所有相对 import 路径是否可解析（只读，单/双引号都查）。"""
import io
import os
import re

IMP = re.compile(r"""^\s*import\s+[\s\S]*?from\s+["']([^"']+)["']""", re.M)
EXT = ('.ts', '.tsx', '.js', '.jsx', '.css', '.json', '.svg', '.png', '.mjs', '.cjs')

bad = []
total = 0
for base, _d, files in os.walk('src/app/react'):
    for fn in files:
        if not fn.endswith(('.ts', '.tsx')):
            continue
        p = os.path.join(base, fn)
        rel = p.replace('\\', '/')
        src = io.open(p, encoding='utf-8').read()
        for m in IMP.finditer(src):
            mod = m.group(1)
            if not mod.startswith('.'):
                if mod.startswith('src/') or mod.startswith('frontend/'):
                    bad.append((rel, mod, '非相对裸路径'))
                continue
            total += 1
            tgt = os.path.normpath(os.path.join(os.path.dirname(rel), mod))
            cands = [tgt + e for e in EXT] + [tgt + '/index.ts', tgt + '/index.tsx', tgt]
            ok = False
            for c in cands:
                c2 = c.replace('\\', '/')
                if os.path.exists(c2):
                    # 带 .ts/.tsx 后缀的显式扩展名 import 在 vite 下可解析但 tsconfig 可能不允许
                    if c2.endswith(('.ts', '.tsx')) and not mod.endswith(('.ts', '.tsx')):
                        pass
                    ok = True
                    break
            if not ok:
                bad.append((rel, mod, tgt.replace('\\', '/')))

print('相对 import 总数：%d' % total)
print('问题：%d' % len(bad))
for rel, mod, why in bad[:50]:
    print('  %s\n      import "%s"  (%s)' % (rel, mod, why))
