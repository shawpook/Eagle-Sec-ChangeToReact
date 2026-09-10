# B5 二分：按「行级 opcode 子集」重建 dataMachinery.ts
# 用法：python bz-b5-subset.py <N>          -> 应用前 N 个变更块（prefix）
#       python bz-b5-subset.py all          -> 全部
#       python bz-b5-subset.py none         -> 原样
#       python bz-b5-subset.py idx 3,7,12   -> 指定块
import io, sys, difflib

OLD = io.open('tests-tmp/dm_old.ts', encoding='utf-8').read()
NEW = io.open('tests-tmp/dm_new.ts', encoding='utf-8').read()
OL = OLD.split('\n')
NL = NEW.split('\n')

sm = difflib.SequenceMatcher(None, OL, NL, autojunk=False)
ops = sm.get_opcodes()
change_idx = [i for i, op in enumerate(ops) if op[0] != 'equal']

mode = sys.argv[1]
if mode == 'all':
    sel = set(range(len(change_idx)))
elif mode == 'none':
    sel = set()
elif mode == 'idx':
    sel = set(int(x) for x in sys.argv[2].split(',') if x != '')
else:
    sel = set(range(int(mode)))

out = []
applied = 0
for k, (i, op) in enumerate(zip(change_idx, [ops[j] for j in change_idx])):
    tag, i1, i2, j1, j2 = op
    if k in sel:
        out.extend(NL[j1:j2]); applied += 1
    else:
        out.extend(OL[i1:i2])

# equal 区段也要原样保留
res = []
pos_old = 0
for k, j in enumerate(change_idx):
    op = ops[j]
    if op[1] > pos_old:
        res.extend(OL[pos_old:op[1]])
    if k in sel:
        res.extend(NL[op[3]:op[4]])
    else:
        res.extend(OL[op[1]:op[2]])
    pos_old = op[2]
res.extend(OL[pos_old:])

io.open('src/app/react/core/dataMachinery.ts', 'w', encoding='utf-8', newline='').write('\n'.join(res))
print('change_blocks=%d applied=%d' % (len(change_idx), applied))
