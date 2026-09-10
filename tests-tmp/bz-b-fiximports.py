"""修复误生成的裸绝对路径 import（如 from "src/app/react/services/x.ts"）→ 正确相对路径。"""
import io
import os
import re

IMP = re.compile(r"""^(\s*import\s+)([\s\S]*?)(\s+from\s+)(["'])src/app/react/([^"']+?)(?:\.tsx?)?\4;?\s*$""", re.M)
MARK = 'src/app/react/'

fixed = []
for base, _d, files in os.walk('src/app/react'):
    for fn in files:
        if not fn.endswith(('.ts', '.tsx')):
            continue
        p = os.path.join(base, fn)
        rel = p.replace('\\', '/')
        src = io.open(p, encoding='utf-8').read()
        if MARK not in src:
            continue
        out = src
        n = 0

        def rep(m):
            global n
            tail = m.group(5)
            tgt = 'src/app/react/' + tail
            # 目标文件真实存在性（带/不带扩展名）
            cand = None
            for c in (tgt, tgt + '.ts', tgt + '.tsx', tgt + '/index.ts'):
                if os.path.exists(c):
                    cand = c
                    break
            if not cand:
                return m.group(0)
            cand = cand.replace('\\', '/')
            if cand.endswith(('.ts', '.tsx')):
                cand = cand.rsplit('.', 1)[0]
            relpath = os.path.relpath(cand, os.path.dirname(rel)).replace('\\', '/')
            if not relpath.startswith('.'):
                relpath = './' + relpath
            n += 1
            return '%s%s%s%s%s%s;' % (m.group(1), m.group(2), m.group(3),
                                      m.group(4), relpath, m.group(4))

        out = IMP.sub(rep, out)
        if out != src:
            io.open(p, 'w', encoding='utf-8').write(out)
            fixed.append((rel, n))

print('修复文件 %d 个：' % len(fixed))
for rel, n in fixed:
    print('  %-56s %d 条' % (rel, n))

# 复查：还有没有残留
left = []
for base, _d, files in os.walk('src/app/react'):
    for fn in files:
        if not fn.endswith(('.ts', '.tsx')):
            continue
        p = os.path.join(base, fn)
        src = io.open(p, encoding='utf-8').read()
        for m in re.finditer(r"""from\s+["']src/app/react/[^"']+["']""", src):
            left.append((p.replace('\\', '/'), m.group(0)))
print('残留：%d' % len(left))
for r in left[:10]:
    print('  ', r)
