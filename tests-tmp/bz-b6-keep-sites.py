# b1-9bz-B-6：把「契约可观测的派发点」回写为 scope 面调用。
# 这些处理器是 stage1m1 的 4 个 spy 断言的观测面，必须保留 `s.NAME(...)` 形态。
import io, re, sys

TARGETS = [
    # (文件, 锚点正则, 该块内需要回写的 [machinery 符号 -> 属性名])
    ('src/app/react/core/filterDomain.ts',
     r"onFilterRuleChange\(",
     {'machineryFilterContent': 'filterContent'}),
    ('src/app/react/core/filterDomain.ts',
     r"s0\.\$on\('REBIND_REFRESH'",
     {'machineryRebindRefresh': 'rebindRefresh'}),
    ('src/app/react/core/selectionViewDomain.ts',
     r's0\.\$watchCollection\("selected", function',
     {'machineryUpdateSelection': 'updateSelection'}),
    ('src/app/react/core/selectionViewDomain.ts',
     r"s0\.\$on\('UPDATE_SELECTION'",
     {'machineryUpdateSelection': 'updateSelection'}),
]


def block_span(src, anchor):
    m = re.search(anchor, src)
    if not m:
        return None
    i = src.find('{', m.end() - 1)
    if i < 0:
        return None
    depth = 0
    in_s = None
    j = i
    while j < len(src):
        c = src[j]
        if in_s:
            if c == '\\':
                j += 2; continue
            if c == in_s:
                in_s = None
        elif c in '"\'`':
            in_s = c
        elif c == '{':
            depth += 1
        elif c == '}':
            depth -= 1
            if depth == 0:
                return (m.start(), j + 1)
        j += 1
    return None


def revert_block(seg, mapping):
    n = 0

    def rep(m):
        nonlocal n
        sym, args = m.group(1), m.group(2).strip()
        key = 'machinery' + sym
        if key not in mapping:
            return m.group(0)          # 该块内其它 machinery 调用不动
        prop = mapping[key]
        args = re.sub(r'^\s*s\s*,?\s*', '', args)
        n += 1
        return 's.%s(%s)' % (prop, args)

    seg2 = re.sub(r'(?<![\w$.])machinery([A-Za-z_$][\w$]*)\s*\(([^()]*(?:\([^()]*\)[^()]*)*)\)', rep, seg)
    return seg2, n


mode = sys.argv[1] if len(sys.argv) > 1 else 'apply'
by_file = {}
for f, anchor, mp in TARGETS:
    by_file.setdefault(f, []).append((anchor, mp))

for f, items in by_file.items():
    src = io.open(f, encoding='utf-8', newline='').read()
    total = 0
    for anchor, mp in items:
        span = block_span(src, anchor)
        if not span:
            # revert 模式：找不到锚点说明该块内没有（已回写）
            if mode == 'apply':
                print('  !! 未找到锚点 %s in %s' % (anchor, f))
            continue
        seg, n = revert_block(src[span[0]:span[1]], mp)
        if n:
            src = src[:span[0]] + seg + src[span[1]:]
            total += n
    if total:
        if mode == 'apply':
            io.open(f, 'w', encoding='utf-8', newline='').write(src)
        print('  %-48s 回写 %d 处' % (f.replace('src/app/react/', ''), total))
    else:
        print('  %-48s 无需回写' % f.replace('src/app/react/', ''))
