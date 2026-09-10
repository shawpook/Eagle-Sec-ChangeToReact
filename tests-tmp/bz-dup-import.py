#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""C-0 工具：扫描并修复「同一符号被 import 两次」的 ESM 重复声明错误。

ESM 中 `import { a } from 'x'; import { a } from 'x';` 是重复声明 SyntaxError，
esbuild 只做语法解析不检查绑定，因此会静默通过并在运行时整模块加载失败。
"""
import io, os, re, subprocess, sys

ROOT = 'src/app/react'
IMP = re.compile(r"^import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*'([^']+)';\s*$")


def scan_file(f):
    """返回 (重复符号列表, 是否改动)"""
    s = io.open(f, encoding='utf-8', newline='').read()
    nl = '\r\n' if '\r\n' in s else '\n'
    t = s.replace('\r\n', '\n')
    lines = t.split('\n')
    seen = {}
    dups = []
    for i, ln in enumerate(lines):
        m = IMP.match(ln)
        if not m:
            continue
        names = [x.strip().split(' as ')[0].strip() for x in m.group(1).split(',') if x.strip()]
        mod = m.group(2)
        for n in names:
            if n in seen:
                dups.append((n, seen[n], i, mod))
            else:
                seen[n] = i
    return dups, lines, nl


def fix_file(f, apply=True):
    dups, lines, nl = scan_file(f)
    if not dups:
        return 0
    drop = set()
    move = {}
    for n, first, dup_line, mod in dups:
        if mod == IMP.match(lines[first]).group(2):
            drop.add(dup_line)
        else:
            # 不同模块同名：无法自动合并，报告
            print('  !! 跨模块同名冲突 %s :: %s (%s vs %s)' % (f, n, IMP.match(lines[first]).group(2), mod))
    # 同模块多条 import 时，删掉重复行后需确保符号仍在
    out = []
    for i, ln in enumerate(lines):
        if i in drop:
            continue
        out.append(ln)
    new = '\n'.join(out)
    if apply:
        io.open(f, 'w', encoding='utf-8', newline='').write(new.replace('\n', nl))
    return len(drop)


if __name__ == '__main__':
    apply = '--fix' in sys.argv
    files = [f for f in subprocess.check_output(['git', 'ls-files', ROOT], text=True).split()
             if f.endswith(('.ts', '.tsx'))]
    tot = 0
    for f in files:
        n = fix_file(f, apply=apply)
        if n:
            print('  %-58s 删除重复 import 行 %d' % (f.replace(ROOT + '/', ''), n))
            tot += n
    print('\n%s 重复 import 行 %d 处' % ('已修复' if apply else '检出', tot))
