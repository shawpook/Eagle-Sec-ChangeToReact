#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""b1-9bz-B 直调化落点判定：给一批函数名判定「scope 面当前由谁供给」。

输出三分类：
  TABLE_ONLY   —— 只在 fns 表（controllerFns 指针 + install*Fns 注册），machinery 未挂载
                  → 直调化 = import 落点导出（可证同对象）
  MACHINERY    —— machinery 有 s.NAME 挂载（可能与表并存 = 双键）
                  → scope 面 s.NAME() 走 machinery（后挂覆盖）；直调化须 import machinery 导出
  NONE         —— 表与 machinery 都没有 → 当前 scope[fn] 命中旧 bundle 或空转，须保留回退
用法：python tests-tmp/bz-b-route-map.py NAME...
"""
import io
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath__file__)) if False else os.getcwd()
DM = os.path.join(ROOT, 'src/app/react/core/dataMachinery.ts')


def read(p):
    with io.open(p, 'r', encoding='utf-8') as f:
        return f.read()


def table_keys():
    """fns["X"] / fns['X'] 全树注册名（controllerFns 指针 + install*Fns 家族）。"""
    keys = {}
    for base, _dirs, files in os.walk(os.path.join(ROOT, 'src/app/react')):
        for fn in files:
            if not fn.endswith(('.ts', '.tsx')):
                continue
            p = os.path.join(base, fn)
            src = read(p)
            for m in re.finditer(r'fns\[\s*["\']([A-Za-z0-9_$]+)["\']\s*\]', src):
                keys.setdefault(m.group(1), os.path.relpath(p, ROOT).replace('\\', '/'))
    return keys


def machinery_mounts():
    """dataMachinery 的 s.NAME = ... 挂载名 → 右侧表达式。"""
    src = read(DM)
    mounts = {}
    for m in re.finditer(r'^\s*s\.([A-Za-z0-9_$]+)\s*=\s*(.+)$', src, re.M):
        mounts.setdefault(m.group(1), m.group(2).strip())
    return mounts


def main():
    names = sys.argv[1:]
    tbl = table_keys()
    mnt = machinery_mounts()
    print('%-28s %-10s %s' % ('NAME', 'ROUTE', 'DETAIL'))
    for n in names:
        in_tbl = n in tbl
        in_mnt = n in mnt
        if in_mnt:
            route = 'MACHINERY'
            detail = mnt[n][:70]
            if in_tbl:
                detail = 'DUAL(machinery 覆盖表) ' + detail
        elif in_tbl:
            route = 'TABLE_ONLY'
            detail = tbl[n]
        else:
            route = 'NONE'
            detail = '无供给 → 保留 scope 面回退'
        print('%-28s %-10s %s' % (n, route, detail))


if __name__ == '__main__':
    main()
