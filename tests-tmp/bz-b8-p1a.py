# b1-9bz-B-8 / Phase 1a：folderMenuService 的 3 个匿名 install 表项提升为模块级具名导出，
# 并把 9 处 s.X() 调用点改为直接调用。
import io, re

P = 'src/app/react/services/folderMenuService.ts'
src = io.open(P, encoding='utf-8', newline='').read()
NL = '\r\n' if '\r\n' in src else '\n'
text = src.replace('\r\n', '\n')
L = text.split('\n')


def find_line(pat, start=0):
    for i in range(start, len(L)):
        if re.search(pat, L[i]):
            return i
    raise SystemExit('未找到锚点: ' + pat)


def block(start, endpat):
    """从 start 行起，找到首个匹配 endpat 的行，返回闭区间行号。"""
    for k in range(start + 1, len(L)):
        if re.match(endpat, L[k]):
            return (start, k)
    raise SystemExit('未找到结束行: ' + endpat)


def cut(a, b):
    seg = [l[2:] if l.startswith('  ') else l for l in L[a:b + 1]]
    return '\n'.join(seg)


# ── 1) 取出 install 内的两个闭包 ──
c1 = block(find_line(r'^  function reorderFolderByTitleClosure\('), r'^  \}$')
closure1 = cut(*c1)
c2 = block(find_line(r'^  function ayncsUpdateSmartFoldersCount\('), r'^  \}$')
closure2 = cut(*c2)

# ── 2) 取出 3 个匿名表项体（fns["X"] = function (...args) { ... };）──
def anon(name):
    a = find_line(r'^  fns\["%s"\] = function' % re.escape(name))
    return block(a, r'^  \};$')


a_reorder = anon('reorderFolderByTitle')
a_reorderAll = anon('reorderAllFolderByTitle')
a_refresh = anon('refreshSmartFolderCount')


def anon_body(name, span):
    body = '\n'.join(L[span[0]:span[1] + 1])
    # fns["X"] = function (...args) {  ->  export function X(...args: any[]) {
    body = re.sub(r'^  fns\["[^"]+"\] = function \(\.\.\.args\) \{',
                  'export function %s(...args: any[]) {' % name, body)
    # 内部缩进整体左移 2（原在 install 内）
    out = []
    for l in body.split('\n'):
        out.append(l[2:] if l.startswith('  ') else l)
    return '\n'.join(out)


fn_reorder = anon_body('reorderFolderByTitle', a_reorder)
fn_reorderAll = anon_body('reorderAllFolderByTitle', a_reorderAll)
fn_refresh = anon_body('refreshSmartFolderCount', a_refresh)

# ── 3) 删除 install 内的两个闭包（含其上方紧邻的注释行）──
removals = []
for span in [c1, c2]:
    s = span[0]
    while s - 1 >= 0 and L[s - 1].strip().startswith('//'):
        s -= 1
    removals.append((s, span[1]))

newL = []
for i, l in enumerate(L):
    if any(a <= i <= b for a, b in removals):
        continue
    newL.append(l)
L = newL
text = '\n'.join(L)

# ── 4) 3 个匿名表项：整块替换为指针（先替换再移除，否则注册会一起丢失）──
# 注意：上一步已改变行号，这里必须用文本锚点重新定位。
for name in ['reorderFolderByTitle', 'reorderAllFolderByTitle', 'refreshSmartFolderCount']:
    lines = text.split('\n')
    a = None
    for i, l in enumerate(lines):
        if re.match(r'^  fns\["%s"\] = function' % re.escape(name), l):
            a = i
            break
    if a is None:
        raise SystemExit('未找到表项: ' + name)
    b = None
    for k in range(a + 1, len(lines)):
        if re.match(r'^  \};$', lines[k]):
            b = k
            break
    if b is None:
        raise SystemExit('未找到表项结束: ' + name)
    lines[a:b + 1] = ['  fns["%s"] = %s;' % (name, name)]
    text = '\n'.join(lines)

# ── 5) 插入模块级块（installFolderMenuFns 之前）──
anchor = '\nexport function installFolderMenuFns('
if anchor not in text:
    anchor = '\nfunction installFolderMenuFns('
block_src = (
    '\n/* ── b1-9bz-B-8：以下 3 个函数由 installFolderMenuFns 的匿名表项提升为模块级具名导出 ──\n'
    '   原形为 `fns["X"] = function (...args) {…}`，依赖 install 内局部闭包，而调用点\n'
    '   （openFolderContextMenu / openSmartFolderContextMenu）在**模块级函数**内，\n'
    '   无法用局部 const 替代，故连同依赖闭包一并提升（bundle 41765-41781 / 41782-41829 /\n'
    '   26287-26290 / 26301-26331 逐字）。 */\n\n'
    + closure1 + '\n\n' + closure2 + '\n\n'
    + fn_reorder + '\n\n' + fn_reorderAll + '\n\n' + fn_refresh + '\n'
)
text = text.replace(anchor, block_src + anchor, 1)

# ── 6) 9 处调用点改直调 ──
subs = [
    (r'(?<![\w$.])s\.exportFolder\(', 'exportFolder('),
    (r'(?<![\w$.])s\.newFolder\(', 'newFolder('),
    (r'(?<![\w$.])s\.reorderFolderByTitle\(', 'reorderFolderByTitle('),
    (r'(?<![\w$.])s\.reorderAllFolderByTitle\(', 'reorderAllFolderByTitle('),
    (r'(?<![\w$.])s\.refreshSmartFolderCount\(', 'refreshSmartFolderCount('),
]
for pat, rep in subs:
    text = re.sub(pat, rep, text)

# ── 7) 补 import：exportFolder / newFolder（folderCoreService）──
m = re.search(r"^import \{([^}]*)\} from '\./folderCoreService';$", text, re.M)
need = ['exportFolder', 'newFolder']
if m:
    names = sorted(set([x.strip() for x in m.group(1).split(',') if x.strip()] + need))
    text = text[:m.start()] + "import { %s } from './folderCoreService';" % ', '.join(names) + text[m.end():]
else:
    raise SystemExit('未找到 folderCoreService import 行')

io.open(P, 'w', encoding='utf-8', newline='').write(text.replace('\n', NL))
print('Phase 1a 完成：提升 3 项 / 转换 9 处')
