#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""b1-9bz-B：把 install*Fns 体内的匿名注册条目提升为具名导出（bz-A 落点同形态）。

对每个 (file, name)：
  1. 找到 `  fns["NAME"] = function (...args) {` 起、首个行首 `  };` 止的整段
  2. 原段替换为 `  fns["NAME"] = NAME;`
  3. 段落到 install 函数之前，改写为
         export function NAME(...args: any[]) {
           ...  (const s = getScope();  →  const s = getBodyScope();)
         }
install 注入的 getScope 与 getBodyScope 等价（makeControllerFns(getBodyScope) /
attachCoreFnsToShim 传同一 scope），故零行为变化。
用法：python tests-tmp/bz-b-lift.py
"""
import io
import os
import re

ROOT = os.getcwd()

TARGETS = [
    ('src/app/react/services/imageOpsService.ts', 'rotateImage'),
    ('src/app/react/services/imageOpsService.ts', 'flipImage'),
    ('src/app/react/services/imageOpsService.ts', 'saveCrop'),
    ('src/app/react/services/miscMenuService.ts', 'openRatioContextMenu'),
]

LIFT_NOTE = {
    'imageOpsService': 'imageOpsService',
    'miscMenuService': 'miscMenuService',
}


def lift(path, name):
    src = io.open(path, encoding='utf-8').read()
    lines = src.split('\n')
    start = None
    for i, ln in enumerate(lines):
        if ln == '  fns["%s"] = function (...args) {' % name:
            start = i
            break
    if start is None:
        raise SystemExit('start not found: %s %s' % (path, name))
    end = None
    for j in range(start + 1, len(lines)):
        if lines[j] == '  };':
            end = j
            break
    if end is None:
        raise SystemExit('end not found: %s %s' % (path, name))

    block = lines[start:end + 1]
    body_lines = block[1:-1]  # 去掉首行 `fns[...] = function...{` 与末行 `};`
    body = '\n'.join(body_lines)
    if 'const s = getScope();' not in body:
        raise SystemExit('unexpected body shape: %s %s' % (path, name))
    body = body.replace('const s = getScope();', 'const s = getBodyScope();')

    lifted = [
        '/* b1-9bz-B：原 install 体内匿名注册条目——DetailToolbar 的 call 派发只能字符串命中，',
        '   提升为具名导出（install 注入的 getScope 等价 getBodyScope），表项改指针，',
        '   组件侧改直 import，零行为变化。 */',
        'export function %s(...args: any[]) {' % name,
    ] + body.split('\n') + ['}', '']

    # 安装函数起始行
    inst = None
    for i, ln in enumerate(lines):
        if ln.startswith('export function install') and ln.rstrip().endswith('(fns: any, getScope: any): void {'):
            inst = i
            break
    if inst is None:
        raise SystemExit('install fn not found: %s' % path)

    new_lines = lines[:inst] + lifted + lines[inst:]
    # 删除原段（位置受插入影响需重算）
    src2 = '\n'.join(new_lines)
    lines2 = src2.split('\n')
    s2 = None
    for i, ln in enumerate(lines2):
        if ln == '  fns["%s"] = function (...args) {' % name:
            s2 = i
            break
    e2 = None
    for j in range(s2 + 1, len(lines2)):
        if lines2[j] == '  };':
            e2 = j
            break
    lines2 = lines2[:s2] + ['  fns["%s"] = %s;' % (name, name)] + lines2[e2 + 1:]
    io.open(path, 'w', encoding='utf-8').write('\n'.join(lines2))
    print('lifted %-22s <- %s (%d lines)' % (name, os.path.basename(path), end - start + 1))


def main():
    for path, name in TARGETS:
        lift(os.path.join(ROOT, path), name)


if __name__ == '__main__':
    main()
