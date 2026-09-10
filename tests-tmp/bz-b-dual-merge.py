"""B7 第一步：已体检确认等价的 3 个双键，把 c3 实现改为转发 machinery（消除重复实现）。

只改函数体，不改导出名/签名 —— 消费面 import 与 fns 表项均不受影响。
"""
import io
import re

TARGETS = [
    ('src/app/react/services/mediaService.ts', 'toggleSlideshow', 'machineryToggleSlideshow'),
    ('src/app/react/services/lockService.ts', 'focusAppUnlockPassword', 'machineryFocusAppUnlockPassword'),
    ('src/app/react/services/sidebarService.ts', 'changeSidebarIndex', 'machineryChangeSidebarIndex'),
]

for path, sym, mach in TARGETS:
    src = io.open(path, encoding='utf-8').read()
    m = re.search(r'^export\s+(?:async\s+)?function\s+%s\s*\(' % re.escape(sym), src, re.M)
    if not m:
        print('!! 未找到 %s @%s' % (sym, path))
        continue
    i = src.find('{', m.start())
    depth = 0
    end = None
    for k in range(i, len(src)):
        if src[k] == '{':
            depth += 1
        elif src[k] == '}':
            depth -= 1
            if depth == 0:
                end = k
                break
    if end is None:
        print('!! 括号未配对 %s' % sym)
        continue

    sig = src[m.start():i]          # export function X(...)
    body = src[i:end + 1]
    new_body = ('{\n'
                '  // b1-9bz-B：双键单源化 —— 与 machinery 版逐行等价，统一转发消除重复实现。\n'
                '  %s(getBodyScope());\n'
                '}' % mach)
    if mach == 'machineryChangeSidebarIndex':
        new_body = ('{\n'
                    '  // b1-9bz-B：双键单源化 —— 与 machinery 版逐行等价（仅 $timeout 取法与\n'
                    '  // 局部变量名不同），统一转发消除重复实现。\n'
                    '  %s(getBodyScope(), args[0]);\n'
                    '}' % mach)

    old = src[m.start():end + 1]
    src = src.replace(old, sig + new_body, 1)

    # 确保 import 存在
    if ("import { %s }" % mach) not in src and mach not in re.findall(
            r'import\s*\{([^}]*)\}\s*from\s*[\'"][^\'"]*dataMachinery[\'"]', src).__str__():
        src = re.sub(r"(^import[^\n]*from\s*'[^']*dataMachinery';$)",
                     lambda mm: mm.group(1), src, count=0)
    if not re.search(r'import\s*\{[^}]*\b%s\b[^}]*\}\s*from\s*[\'"][^\'"]*dataMachinery[\'"]' % mach, src):
        # 新增一行 import
        lines = src.split('\n')
        last = 0
        for idx, ln in enumerate(lines):
            if ln.startswith('import '):
                last = idx
        rel = '../core/dataMachinery'
        if path.startswith('src/app/react/services/'):
            rel = '../core/dataMachinery'
        lines.insert(last + 1, "import { %s } from '%s';" % (mach, rel))
        src = '\n'.join(lines)
    if 'getBodyScope' not in re.findall(r'import\s*\{([^}]*)\}\s*from\s*[\'"][^\'"]*appCore[\'"]', src).__str__():
        if not re.search(r'import\s*\{[^}]*\bgetBodyScope\b[^}]*\}\s*from\s*[\'"][^\'"]*appCore[\'"]', src):
            lines = src.split('\n')
            last = 0
            for idx, ln in enumerate(lines):
                if ln.startswith('import '):
                    last = idx
            rel = '../core/appCore'
            lines.insert(last + 1, "import { getBodyScope } from '%s';" % rel)
            src = '\n'.join(lines)

    io.open(path, 'w', encoding='utf-8').write(src)
    print('%-46s %s -> 转发 %s（原 %d 行）' % (path.replace('src/app/react/', ''), sym, mach,
                                              body.count('\n') + 1))
