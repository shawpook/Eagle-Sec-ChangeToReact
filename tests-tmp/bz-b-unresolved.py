# 校验：所有「被转换器注入的符号」调用都必须有来源（import 或本文件顶层声明）。
# 覆盖两类：machineryXxx（MACH/DUAL/表项落点）与 map 里 TABLE 判档的落点导出名。
import io, os, re, json, subprocess, sys

ROOT = 'src'
CALL = re.compile(r'(?<![\w$.])([A-Za-z_$][\w$]*)\s*\(')
IMP = re.compile(r"^import\s*(?:type\s*)?\{([^}]*)\}\s*from\s*'([^']+)';", re.M)
IMP2 = re.compile(r"^import\s+([A-Za-z_$][\w$]*)\s+from\s*'([^']+)';", re.M)
DECL = re.compile(r'^(?:export\s+)?(?:async\s+)?(?:function|const|let|var|class)\s+([A-Za-z_$][\w$]*)', re.M)

# 关注的符号集：machinery* 全量 + map 里已解析落点的导出名
WATCH = set()
d = json.load(io.open('tests-tmp/bz-b-scope-map.json', encoding='utf-8'))
for n, info in d.items():
    exp = info.get('export')
    if exp and (info.get('route') in ('TABLE',) or exp.startswith('machinery')):
        WATCH.add(exp)

files = [f for f in subprocess.check_output(['git', 'ls-files', ROOT], text=True).split()
         if f.endswith(('.ts', '.tsx'))]

def strip_comments(s):
    s = re.sub(r'/\*[\s\S]*?\*/', '', s)
    s = re.sub(r'^[ \t]*//.*$', '', s, flags=re.M)
    return s


def strip_strings(s):
    # 去掉字符串/模板串：JSX 属性里的 "openFolder(...)"、callSeq(['openFolder']) 这类
    # 字符串字面量会被误判成调用。
    s = re.sub(r'`(?:[^`\\]|\\.)*`', '``', s, flags=re.S)
    s = re.sub(r"'(?:[^'\\\n]|\\.)*'", "''", s)
    s = re.sub(r'"(?:[^"\\\n]|\\.)*"', '""', s)
    return s


METHOD = re.compile(r'^[ \t]*(?:export\s+)?(?:async\s+)?(?:static\s+)?(?:get\s+|set\s+)?([A-Za-z_$][\w$]*)\s*\([^()]*\)\s*[:{]', re.M)


def sources_of(src):
    imported = set()
    for names, _mod in IMP.findall(src):
        for p in names.split(','):
            nm = p.strip().split(' as ')[-1].strip()
            if nm:
                imported.add(nm)
    for nm, _mod in IMP2.findall(src):
        imported.add(nm)
    declared = set(DECL.findall(src)) | set(METHOD.findall(src))
    return imported | declared


bad = 0
for f in files:
    raw = io.open(f, encoding='utf-8', errors='ignore').read()
    nocomment = strip_comments(raw)
    # 调用位检测用剥字符串版（否则 JSX 属性里的 "openFolder(...)" 会误报）；
    # 来源提取必须用**未剥字符串**版，否则 import 的模块路径 '...' 会被抹掉、全部误报。
    callsrc = strip_strings(nocomment)
    used = set(m for m in CALL.findall(callsrc) if m in WATCH)
    if not used:
        continue
    have = sources_of(nocomment)
    missing = []
    for m in sorted(used - have):
        if re.search(r'(?<![\w$.])%s\s*[:=]' % re.escape(m), nocomment):
            continue
        missing.append(m)
    if missing:
        bad += 1
        print('%-62s 未解析: %s' % (f.replace('src/app/react/', ''), ', '.join(missing)))

print('\n检查 %d 文件（关注符号 %d 个），存在问题 %d 个' % (len(files), len(WATCH), bad))
sys.exit(1 if bad else 0)
