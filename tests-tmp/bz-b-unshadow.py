"""撤销被局部同名声明遮蔽的改造点：sym(...) 改回 s.NAME(...)，并从 import 移除符号。

只改动"本次改造引入"的调用点（依据 HEAD 版本的 s.NAME( 出现次数配对），
不触碰文件里原有的、指向局部函数的同名调用。
"""
import io
import json
import re
import subprocess
import difflib

MAP = json.load(io.open('tests-tmp/bz-b-scope-map.json', encoding='utf-8'))
EXPORT2NAME = {}
for name, info in MAP.items():
    if info.get('export'):
        EXPORT2NAME.setdefault(info['export'], name)

TARGETS = {
    'src/app/react/components/stage7/ProgressDialogs.tsx': ['cancelEmptyTrash', 'cancelRegenerateThumbnail'],
    'src/app/react/components/toolbar/Toolbar.tsx': ['maximize'],
    'src/app/react/services/folderMenuService.ts': ['exportFolder', 'newFolder'],
}

for f, syms in TARGETS.items():
    old = subprocess.check_output(['git', 'show', 'HEAD:' + f], text=True).split('\n')
    new = io.open(f, encoding='utf-8').read()
    new_lines = new.split('\n')
    sm = difflib.SequenceMatcher(None, old, new_lines, autojunk=False)
    ops = sm.get_opcodes()

    changed = 0
    for tag, i1, i2, j1, j2 in ops:
        if tag not in ('replace', 'insert'):
            continue
        oblock, nblock = old[i1:i2], new_lines[j1:j2]
        # 逐块配对：统计 old 中 s.NAME( 的次数，与 new 中 sym( 的次数
        for sym in syms:
            name = EXPORT2NAME.get(sym)
            if not name:
                print('  !! 无反向映射 %s' % sym)
                continue
            pat_old = re.compile(r'(?<![\w$.])(?:s|scope|bodyScope)\.%s\s*\(' % re.escape(name))
            pat_new = re.compile(r'(?<![\w$.])%s\s*\(' % re.escape(sym))
            n_old = sum(len(pat_old.findall(l)) for l in oblock)
            if not n_old:
                continue
            for k in range(len(nblock)):
                hits = pat_new.findall(nblock[k])
                if not hits:
                    continue
                take = min(len(hits), n_old)
                nblock[k] = pat_new.sub(lambda m, _c=[0]: (
                    (lambda: 's.%s(' % name)() if (_c.__setitem__(0, _c[0] + 1) or _c[0] <= take)
                    else m.group(0)
                ), nblock[k], count=take)
                changed += take
                n_old -= take
                if n_old <= 0:
                    break
        new_lines[j1:j2] = nblock

    out = '\n'.join(new_lines)
    # 从 import 语句移除这些符号
    for sym in syms:
        def drop(m):
            parts = [p.strip() for p in m.group(1).split(',') if p.strip()]
            rest = [p for p in parts if p.split(' as ')[0].strip() != sym]
            if not rest:
                return ''
            return 'import { %s } from %s;' % (', '.join(rest), m.group(2))
        out = re.sub(r'import\s*\{([^}]*)\}\s*from\s*([\'"][^\'"]+[\'"]);', drop, out)

    io.open(f, 'w', encoding='utf-8').write(out)
    print('%-56s 回退 %d 处' % (f, changed))
