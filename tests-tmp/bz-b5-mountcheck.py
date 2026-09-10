# B5 静态判别：把每处替换映射回「原 scope 属性名」，检查该属性是否真被挂载表覆盖。
import io, re, subprocess, difflib, json

OLD = subprocess.check_output(['git', 'show', 'HEAD:src/app/react/core/dataMachinery.ts'], text=True)
NEW = io.open('src/app/react/core/dataMachinery.ts', encoding='utf-8').read()

# --- 挂载表：s.NAME = ... （covers 挂载块与其它页面）---
mounted = set()
for m in re.finditer(r'\bs\.([A-Za-z_$][\w$]*)\s*=\s*(?:\(|machinery|function|machinery[A-Za-z])', OLD):
    mounted.add(m.group(1))
# 兼容 s.X = machineryX(s) 形态
for m in re.finditer(r'\bs\.([A-Za-z_$][\w$]*)\s*=\s*machinery', OLD):
    mounted.add(m.group(1))

sm = difflib.SequenceMatcher(None, OLD.split('\n'), NEW.split('\n'), autojunk=False)
rows = []
for tag, i1, i2, j1, j2 in sm.get_opcodes():
    if tag == 'equal':
        continue
    olds = OLD.split('\n')[i1:i2]
    news = NEW.split('\n')[j1:j2]
    for a, b in zip(olds, news):
        ms = re.findall(r'(?<![\w$.])(?:s|scope|bodyScope)\.([A-Za-z_$][\w$]*)\s*\(', a)
        nm = re.findall(r'(?<![\w$.])machinery([A-Za-z_$][\w$]*)\s*\(', b)
        if ms and nm:
            rows.append((ms[0], nm[0], a.strip(), b.strip()))

print('可解析替换 %d 处 / 不可解析 %d 处' % (len(rows), sum(1 for t, i1, i2, j1, j2 in sm.get_opcodes() if t != 'equal' for _ in OLD.split('\n')[i1:i2]) - len(rows)))
no_mount = [r for r in rows if r[0] not in mounted]
print('\n★ 原属性名不在挂载表（= 原调用解析到 bundle/别处，替换后走 machinery 移植版）: %d 处' % len(no_mount))
seen = set()
for prop, sym, a, b in no_mount:
    if prop in seen:
        continue
    seen.add(prop)
    print('   s.%-32s -> machinery%-32s' % (prop, sym))
    print('        OLD: %s' % a[:100])
    print('        NEW: %s' % b[:100])
print('\n涉及属性 %d 个' % len(seen))
