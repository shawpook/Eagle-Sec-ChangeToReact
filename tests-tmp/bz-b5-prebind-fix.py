# 回修 PREBIND 误直调：machineryX(s) -> s.X()（仅这 5 个预绑实例名，且非定义/挂载处）
import io, re, subprocess, sys

NAMES = ['machineryReload', 'machineryPageDownHandler', 'machineryPageUpHandler',
         'machineryOffsetScrollbar', 'machineryToggleFilterByType']
SYM2PROP = {
    'machineryReload': 'reload',
    'machineryPageDownHandler': 'pageDownHandler',
    'machineryPageUpHandler': 'pageUpHandler',
    'machineryOffsetScrollbar': 'offsetScrollbar',
    'machineryToggleFilterByType': 'toggleFilterByType',
}

files = [f for f in subprocess.check_output(['git', 'ls-files', 'src/app/react'], text=True).split()
         if f.endswith(('.ts', '.tsx'))]

total = 0
touched = []
for f in files:
    src = io.open(f, encoding='utf-8', newline='').read()
    orig = src
    for sym in NAMES:
        prop = SYM2PROP[sym]

        def rep(m):
            global total
            pre = m.string[max(0, m.start() - 12):m.start()]
            if re.search(r'function\s+$', pre) or re.search(r'=\s*$', pre):
                return m.group(0)          # 定义处 / 挂载赋值处，保留
            total += 1
            return m.group(1) + '.' + prop + '()'

        src = re.sub(r'(?<![\w$.])' + sym + r'\(\s*(s|scope|bodyScope)\s*\)', rep, src)
    if src != orig:
        io.open(f, 'w', encoding='utf-8', newline='').write(src)
        touched.append(f)

print('回修 %d 处，涉及 %d 文件:' % (total, len(touched)))
for f in touched:
    print('   ' + f.replace('src/app/react/', ''))

# 清理已不再使用的 import（仅当文件内除 import 行外无其它引用）
for f in touched:
    src = io.open(f, encoding='utf-8', newline='').read()
    for sym in NAMES:
        body = re.sub(r"^import[^\n]*\n", '', src, flags=re.M)
        if re.search(r'(?<![\w$.])' + sym + r'\b', body):
            continue
        m = re.search(r"(^import \{[^}]*?\})\s*" + sym + r"\s*(,\s*)?", src, re.M)
        if m:
            seg = m.group(0)
            names = [x.strip() for x in re.search(r'\{([^}]*)\}', seg).group(1).split(',') if x.strip() and x.strip() != sym]
            new = "import { %s } from" % ', '.join(names) if names else ''
            repl = new + re.search(r"\s*from '[^']+';", seg).group(0) if names else ''
            src = src[:m.start()] + repl + src[m.end():]
            io.open(f, 'w', encoding='utf-8', newline='').write(src)
            print('   清 import %s in %s' % (sym, f.replace('src/app/react/', '')))
