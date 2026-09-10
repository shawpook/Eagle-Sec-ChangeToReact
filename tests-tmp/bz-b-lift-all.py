#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""b1-9bz-B：批量把 install*Fns 体内的匿名注册条目提升为具名导出（bz-b-lift.py 的批量版）。

守卫（任一命中即跳过该条目，保持原样）：
  a. 条目体引用了 install 函数体内声明的局部名（提升后取不到）
  b. 条目体形态不是 `fns["X"] = function (...args) {` … `  };`
  c. 条目体内没有 `const s = getScope();`（说明形态特殊，人工看）
用法：python tests-tmp/bz-b-lift-all.py [--dry]
"""
import io
import os
import re
import sys

ROOT = os.getcwd()
SRC = os.path.join(ROOT, 'src/app/react')

INSTALL_RE = re.compile(r'^export function (install\w*Fns)\(fns: any, getScope: any\): void \{', re.M)
ENTRY_RE = re.compile(r'^  fns\["([A-Za-z0-9_$]+)"\] = function \(\.\.\.args\) \{$', re.M)
LOCAL_RE = re.compile(r'^  (?:const|let|var|function)\s+([A-Za-z_$][\w$]*)', re.M)


def read(p):
    with io.open(p, encoding='utf-8').read() if False else io.open(p, encoding='utf-8') as f:
        return f.read()


def write(p, s):
    with io.open(p, 'w', encoding='utf-8') as f:
        f.write(s)


def install_range(src):
    """返回 (install_start_line_index, install_end_line_index)。"""
    m = INSTALL_RE.search(src)
    if not m:
        return None
    lines = src.split('\n')
    start = src[:m.start()].count('\n')
    end = len(lines) - 1
    for j in range(start + 1, len(lines)):
        if lines[j] == '}':
            end = j
            break
    return start, end


def main():
    dry = '--dry' in sys.argv
    total = skipped = 0
    report = []
    for base, _dirs, files in os.walk(SRC):
        for fn in sorted(files):
            if not fn.endswith('.ts'):
                continue
            path = os.path.join(base, fn)
            src = read(path)
            rng = install_range(src)
            if not rng:
                continue
            i_start, i_end = rng
            lines = src.split('\n')
            install_body = '\n'.join(lines[i_start:i_end + 1])
            locals_ = set(LOCAL_RE.findall(install_body))
            locals_ = {x for x in locals_ if x != 'fns'}
            # 顶层已存在的同名导出/声明（bz-A 落点可能已有同名函数）→ 跳过，避免重复声明
            existing = set(re.findall(r'^(?:export\s+)?(?:async\s+)?(?:const|let|var|function|class)\s+'
                                      r'([A-Za-z_$][\w$]*)', '\n'.join(lines[:i_start]), re.M))

            # 收集待提升条目（从后往前处理，避免行号漂移）
            entries = []
            for m in ENTRY_RE.finditer(src):
                idx = src[:m.start()].count('\n')
                end = None
                for j in range(idx + 1, len(lines)):
                    if lines[j] == '  };':
                        end = j
                        break
                if end is None:
                    continue
                entries.append((m.group(1), idx, end))

            lifted_blocks = []
            for name, idx, end in entries:
                body = '\n'.join(lines[idx + 1:end])
                if 'const s = getScope();' not in body:
                    skipped += 1
                    report.append('SKIP(shape)  %s::%s' % (fn, name))
                    continue
                if name in existing:
                    skipped += 1
                    report.append('SKIP(dup)    %s::%s' % (fn, name))
                    continue
                if locals_:
                    used = {x for x in locals_ if re.search(r'\b%s\b' % re.escape(x), body)}
                    if used:
                        skipped += 1
                        report.append('SKIP(local)  %s::%s -> %s' % (fn, name, sorted(used)))
                        continue
                body2 = body.replace('const s = getScope();', 'const s = getBodyScope();')
                lifted_blocks.append('export function %s(...args: any[]) {' % name)
                lifted_blocks.extend(body2.split('\n'))
                lifted_blocks.extend(['}', ''])
                lines[idx] = '  fns["%s"] = %s;' % (name, name)
                for j in range(idx + 1, end + 1):
                    lines[j] = None
                total += 1

            if not lifted_blocks:
                continue
            lines = [ln for ln in lines if ln is not None]
            # 插到 install 函数之前
            out_lines = lines[:i_start] + lifted_blocks + lines[i_start:]
            if not dry:
                write(path, '\n'.join(out_lines))
            report.append('LIFT %-28s %d 条目' % (fn, len(lifted_blocks) // 1))

    print('提升 %d 条，跳过 %d 条' % (total, skipped))
    for r in report:
        if r.startswith('SKIP'):
            print('  ' + r)


if __name__ == '__main__':
    main()
