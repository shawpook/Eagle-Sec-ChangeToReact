"""从 HEAD 恢复指定函数的**完整**实现（括号配对，避免正则截断）。"""
import io
import re
import subprocess
import sys


def full(src, sym):
    m = re.search(r'^export (?:async )?function %s\(' % re.escape(sym), src, re.M)
    if not m:
        return None, None
    i = src.find('{', m.start())
    depth = 0
    for k in range(i, len(src)):
        if src[k] == '{':
            depth += 1
        elif src[k] == '}':
            depth -= 1
            if depth == 0:
                return m.start(), src[m.start():k + 1]
    return None, None


for path, sym in [(a.split('::')[0], a.split('::')[1]) for a in sys.argv[1:]]:
    old = subprocess.check_output(['git', 'show', 'HEAD:' + path], text=True)
    _, orig = full(old, sym)
    if not orig:
        print('!! HEAD 未找到 %s @%s' % (sym, path))
        continue
    cur = io.open(path, encoding='utf-8').read()
    m = re.search(r'^export (?:async )?function %s\(' % re.escape(sym), cur, re.M)
    if not m:
        print('!! 当前未找到 %s' % sym)
        continue
    i = cur.find('{', m.start())
    depth = 0
    end = None
    for k in range(i, len(cur)):
        if cur[k] == '{':
            depth += 1
        elif cur[k] == '}':
            depth -= 1
            if depth == 0:
                end = k + 1
                break
    cur = cur[:m.start()] + orig + cur[end:]
    io.open(path, 'w', encoding='utf-8').write(cur)
    print('%-44s %s 已恢复为 HEAD 原实现（%d 行）'
          % (path.replace('src/app/react/', ''), sym, len(orig.split('\n'))))
