# b1-9bz-B-8 终态校验：bodyScope 侧不得再有「仅由已退役 fns 表供给」的名字引用。
#
# 判定：
#   RISK = 判定图为 TABLE（= 仅 fns 表供给）且 **我方代码未写入 scope** 的名字
#          （写入集排除其它窗口目录，避免 preview-window 的 scope.getRawUrl 之类误判）
#   引用 = 任何 scope 限定形态下的名字出现（调用或属性读取；守卫读取同样会短路）
# 例外：core/miscDomain.ts 的 `chans` 表——值是「bundle 特征串片段」（用于截肢匹配），
#       不是被求值的表达式，故白名单排除。
import io, re, json, subprocess, sys

SKIP_DIRS = ('preview-window/', 'collect-window/', 'preferences/')
ALLOW = {('core/miscDomain.ts', 'chans')}

d = json.load(io.open('tests-tmp/bz-b-scope-map.json', encoding='utf-8'))
files = [f for f in subprocess.check_output(['git', 'ls-files', 'src/app/react'], text=True).split()
         if f.endswith(('.ts', '.tsx'))]

WRITTEN = set()
for f in files:
    if any(f.replace('src/app/react/', '').startswith(x) for x in SKIP_DIRS):
        continue
    s = io.open(f, encoding='utf-8').read()
    for m in re.finditer(r'(?<![\w$])(?:\$)?(?:s|scope|s0|bodyScope|rootScope)\.([A-Za-z_$][\w$]*)\s*=[^=]', s):
        WRITTEN.add(m.group(1))

RISK = set(n for n, v in d.items() if v.get('route') == 'TABLE' and n not in WRITTEN)
# 穷尽式：任何 .NAME( 调用都视为潜在 scope 引用，除非接收者是已知的**非 scope** 对象。
# （前缀式扫描会漏掉 `body.` / `bs.` / `sc.` / `s2.` 这类捕获别名——B8 两次踩坑的根源）
NON_SCOPE = {
    'FileUrlHelper', 'reverseImageSearch', 'el', 'input', '$name', 'helper',
    'currentWindow', 'eagleIns', 'inspector', 'this', 'tasks', 'win', 'win0',
}
REF = re.compile(r'([A-Za-z_$][\w$]*)\.([A-Za-z_$][\w$]*)\s*\(')

# miscDomain 的 chans 表区域（bundle 特征串）行号范围
def chans_range(src):
    m = re.search(r'const chans: Array<\[string, string\[\]\]> = \[', src)
    if not m:
        return None
    lines = src.split('\n')
    start = src[:m.start()].count('\n')
    for k in range(start + 1, len(lines)):
        if lines[k].strip() == '];':
            return (start, k)
    return None

def strip_noise(src):
    """去掉注释与字符串字面量——注释/日志串里的 `s.uploadFiles` 不是真实引用。"""
    src = re.sub(r'/\*[\s\S]*?\*/', lambda m: '\n' * m.group(0).count('\n'), src)
    src = re.sub(r'^[ \t]*//.*$', '', src, flags=re.M)
    src = re.sub(r'`(?:[^`\\]|\\.)*`', lambda m: '\n' * m.group(0).count('\n'), src)
    src = re.sub(r"'(?:[^'\\\n]|\\.)*'", "''", src)
    src = re.sub(r'"(?:[^"\\\n]|\\.)*"', '""', src)
    return src


bad = 0
for f in files:
    rel = f.replace('src/app/react/', '')
    if any(rel.startswith(x) for x in SKIP_DIRS):
        continue
    raw = io.open(f, encoding='utf-8').read()
    lines = raw.split('\n')
    src = strip_noise(raw)
    cr = chans_range(raw)
    for m in REF.finditer(src):
        recv, n = m.group(1), m.group(2)
        if recv in NON_SCOPE or n not in RISK:
            continue
        ln = src[:m.start()].count('\n')
        if cr and cr[0] <= ln <= cr[1] and (rel, 'chans') in ALLOW:
            continue
        print('  残留 %-46s :%-5d %-14s %s' % (rel, ln + 1, recv + '.' + n, lines[ln].strip()[:88]))
        bad += 1
print('\n检查 %d 文件；RISK（表供给且我方未写入）%d 个；残留引用 %d 处' % (len(files), len(RISK), bad))
sys.exit(1 if bad else 0)
