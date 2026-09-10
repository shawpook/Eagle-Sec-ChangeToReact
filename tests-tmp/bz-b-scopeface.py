#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""b1-9bz-B：scopeFace（s.xxx() 消费面）落点普查。

扫描 src/app/react 下所有 `s.NAME(` / `scope.NAME(` 形态的 scope 面调用，按「当前由谁供给」
分类（口径同 bz-b-route-map.py）：
  MACHINERY   —— dataMachinery 有 s.NAME 挂载（scope 面走它，后挂覆盖表）
  DUAL        —— 表 + machinery 都有（bz-B-2 已按「双键走 machinery」处置）
  TABLE_ONLY  —— 只在 fns 表（scope 面 = shim 挂载的落点导出）
  NONE        —— 两处都无供给（命中旧 bundle 或空转）
排除了 dataMachinery.ts 自身（其互调已是 machineryXxx(s) 直调形态）。
输出：tests-tmp/bz-b-scopeface-map.txt（按文件分组）+ 汇总。
用法：python tests-tmp/bz-b-scopeface.py
"""
import io
import os
import re
from collections import defaultdict

ROOT = os.getcwd()
SRC = os.path.join(ROOT, 'src/app/react')
OUT = os.path.join(ROOT, 'tests-tmp', 'bz-b-scopeface-map.txt')

EXCLUDE_FILES = {'core/dataMachinery.ts'}


def read(p):
    with io.open(p, 'r', encoding='utf-8') as f:
        return f.read()


def table_keys():
    keys = {}
    for base, _dirs, files in os.walk(SRC):
        for fn in files:
            if not fn.endswith(('.ts', '.tsx')):
                continue
            p = os.path.join(base, fn)
            for m in re.finditer(r'fns\[\s*["\']([A-Za-z0-9_$]+)["\']\s*\]', read(p)):
                keys.setdefault(m.group(1), os.path.relpath(p, ROOT).replace('\\', '/'))
    return keys


def machinery_mounts():
    src = read(os.path.join(SRC, 'core/dataMachinery.ts'))
    mounts = {}
    for m in re.finditer(r'^\s*s\.([A-Za-z0-9_$]+)\s*=\s*(.+)$', src, re.M):
        mounts.setdefault(m.group(1), m.group(2).strip())
    return mounts


CALL = re.compile(r'\b(?:s|scope|bodyScope)\.([A-Za-z_$][\w$]*)\s*\(')

# scopeShim 自身的 API 面（$evalAsync/$apply/$on/$broadcast/$watch/…）——不是表体也不是
# machinery，属 P4-ca「删 scopeShim 永久哨兵扩面」的处置对象，**不属于 bz-B 直调化范围**。
SHIM_API = {'$evalAsync', '$apply', '$on', '$broadcast', '$watch', '$digest', '$emit',
            '$eval', '$new', '$destroy', '$watchCollection'}


def main():
    tbl = table_keys()
    mnt = machinery_mounts()
    per_file = defaultdict(lambda: defaultdict(int))
    per_name = defaultdict(lambda: defaultdict(int))
    for base, _dirs, files in os.walk(SRC):
        for fn in files:
            if not fn.endswith(('.ts', '.tsx')):
                continue
            p = os.path.join(base, fn)
            rel = os.path.relpath(p, ROOT).replace('\\', '/')
            rel = rel.replace('src/app/react/', '')
            if rel in EXCLUDE_FILES:
                continue
            src = read(p)
            for m in CALL.finditer(src):
                name = m.group(1)
                if name in SHIM_API:
                    continue
                if name in mnt:
                    route = 'DUAL' if name in tbl else 'MACHINERY'
                elif name in tbl:
                    route = 'TABLE_ONLY'
                else:
                    route = 'NONE'
                per_file[rel][(name, route)] += 1
                per_name[name][route] += 1

    lines = []
    total = 0
    for rel in sorted(per_file):
        items = sorted(per_file[rel].items(), key=lambda kv: (-kv[1], kv[0][0]))
        lines.append('── %s (%d calls)' % (rel, sum(v for _, v in items)))
        for (name, route), n in items:
            lines.append('    %-30s %-11s x%d' % (name, route, n))
            total += n
    summary = ['', '=== 汇总：%d 处 scope 面调用 / %d 个名字 ===' % (total, len(per_name))]
    agg = defaultdict(int)
    for name, routes in per_name.items():
        for r, n in routes.items():
            agg[r] += n
    for r in ['MACHINERY', 'DUAL', 'TABLE_ONLY', 'NONE']:
        summary.append('  %-11s %d 处' % (r, agg[r]))
    io.open(OUT, 'w', encoding='utf-8').write('\n'.join(lines + summary) + '\n')
    print('\n'.join(summary))


if __name__ == '__main__':
    main()
