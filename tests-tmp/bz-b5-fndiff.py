# B5 归因：按顶层函数切分 dataMachinery.ts，列出每个函数的变更行数与样例。
import io, re, subprocess, difflib, sys

OLD = subprocess.check_output(['git', 'show', 'HEAD:src/app/react/core/dataMachinery.ts'], text=True)
NEW = io.open('src/app/react/core/dataMachinery.ts', encoding='utf-8').read()

def fns(src):
    """返回 [(name, start_line, end_line)]，按行首 column-0 的 `}` 收尾。"""
    L = src.split('\n')
    out = []
    for i, ln in enumerate(L):
        m = re.match(r'^(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(', ln)
        if not m:
            continue
        end = None
        for k in range(i + 1, len(L)):
            if L[k] == '}':
                end = k; break
        out.append((m.group(1), i, end if end is not None else len(L) - 1))
    return out

fo = fns(OLD)
fn_ = fns(NEW)

# 用函数名+序号对齐（行数前部可能不变）
old_map = {}
for name, a, b in fo:
    old_map.setdefault(name, []).append((a, b))
new_map = {}
for name, a, b in fn_:
    new_map.setdefault(name, []).append((a, b))

OL = OLD.split('\n')
NL = NEW.split('\n')

report = []
for name, spans in new_map.items():
    for idx, (na, nb) in enumerate(spans):
        if name not in old_map or idx >= len(old_map[name]):
            continue
        oa, ob = old_map[name][idx]
        a_lines = [l.strip() for l in OL[oa:ob + 1]]
        b_lines = [l.strip() for l in NL[na:nb + 1]]
        sm = difflib.SequenceMatcher(None, a_lines, b_lines, autojunk=False)
        changed = sum(max(i2 - i1, j2 - j1) for tag, i1, i2, j1, j2 in sm.get_opcodes() if tag != 'equal')
        if changed:
            report.append((changed, name, ob - oa + 1, nb - na + 1))

report.sort(reverse=True)
mode = sys.argv[1] if len(sys.argv) > 1 else 'list'
if mode == 'list':
    print('变更最多 TOP30（变更行数 / 函数行数）：')
    for c, n, o, nw in report[:30]:
        print('  %4d 行  %-52s old %4d / new %4d' % (c, n, o, nw))
    print('\n合计变更函数 %d 个，变更行 %d' % (len(report), sum(c for c, *_ in report)))
elif mode == 'fn':
    target = sys.argv[2]
    for name, spans in new_map.items():
        if name != target:
            continue
        na, nb = spans[0]
        oa, ob = old_map[name][0]
        a = [l.strip() for l in OL[oa:ob + 1]]
        b = [l.strip() for l in NL[na:nb + 1]]
        d = list(difflib.unified_diff(a, b, 'OLD:' + name, 'NEW:' + name, lineterm='', n=1))
        print('\n'.join(d) if d else '<< 无变更 >>')
