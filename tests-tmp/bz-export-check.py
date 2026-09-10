#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""校验：相对路径 import 的**命名导出**是否真的存在于目标模块。

背景（b1-9bz-C-0 教训）：`import { copyAsPath } from './miscDomain'` 写错模块时，
esbuild 的 transform 只做语法解析、**不校验命名导出**，因此语法检查全绿，
直到浏览器里 ESM 加载失败（整模块不可用）才暴露 —— 表现为启动加载链断裂，
极难定位。本检查器把这类错误前移到静态阶段。

用法：python tests-tmp/bz-export-check.py
"""
import io, os, re, subprocess, sys
from collections import defaultdict

ROOT = 'src/app/react'
files = [f for f in subprocess.check_output(['git', 'ls-files', ROOT], text=True).split()
         if f.endswith(('.ts', '.tsx'))]

# 注意：部分文件（如 core/smoothZoomEngine.ts）整体缩进一层，export 前有空白，
# 因此所有模式都允许前导空白（ESM 里 export 前有缩进是合法的）。
LEAD = r'^[ \t]*'
NAMED_IMP = re.compile(LEAD + r"import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*'([^']+)';", re.M)
DEFAULT_IMP = re.compile(LEAD + r"import\s+([A-Za-z_$][\w$]*)\s*(?:,\s*\{([^}]*)\})?\s+from\s*'([^']+)';", re.M)

EXPORTS = [
    re.compile(LEAD + r'export\s+(?:declare\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)', re.M),
    re.compile(LEAD + r'export\s+(?:const|let|var|class|enum)\s+([A-Za-z_$][\w$]*)', re.M),
    re.compile(LEAD + r'export\s+(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)', re.M),
    re.compile(LEAD + r'export\s+(?:type|interface)\s+([A-Za-z_$][\w$]*)', re.M),
]
EXPORT_LIST = re.compile(LEAD + r'export\s*\{([^}]*)\}(?:\s*from\s*\'([^\']+)\')?;', re.M)
EXPORT_STAR = re.compile(LEAD + r"export\s*\*\s*from\s*'([^']+)';", re.M)
EXPORT_DEFAULT = re.compile(LEAD + r'export\s+default\s', re.M)


def resolve(base, spec):
    if not spec.startswith('.'):
        return None
    d = os.path.dirname(base)
    p = os.path.normpath(os.path.join(d, spec))
    for cand in (p + '.ts', p + '.tsx', os.path.join(p, 'index.ts'), os.path.join(p, 'index.tsx')):
        if os.path.exists(cand):
            return cand
    return None


def exports_of(path, seen=None):
    if seen is None:
        seen = set()
    if path in seen:
        return set()
    seen.add(path)
    try:
        src = io.open(path, encoding='utf-8', errors='ignore').read()
    except Exception:
        return set()
    out = set()
    for rx in EXPORTS:
        out |= set(rx.findall(src))
    for names, frm in EXPORT_LIST.findall(src):
        if frm:
            tgt = resolve(path, frm)
            if tgt:
                out |= exports_of(tgt, seen)
        else:
            for n in names.split(','):
                n = n.strip()
                if not n:
                    continue
                out.add(n.split(' as ')[-1].strip())
    for star in EXPORT_STAR.findall(src):
        tgt = resolve(path, star)
        if tgt:
            out |= exports_of(tgt, seen)
    if EXPORT_DEFAULT.search(src):
        out.add('default')
    return out


bad = defaultdict(list)
missing = defaultdict(list)
checked = 0
for f in files:
    src = io.open(f, encoding='utf-8', errors='ignore').read()
    for names, mod in NAMED_IMP.findall(src):
        tgt = resolve(f, mod)
        if not tgt:
            # 相对路径却解析不到文件 = 致命错误（vite 加载即失败），必须报出来。
            # C-0 / C-2 都栽在这里：`from '../global/bus'` 在 components/xx/ 下应为 '../../global/bus'。
            # 外部包（react 等）不由本检查器负责，跳过。
            if mod.startswith('.'):
                missing[f].append((names.strip()[:40], mod))
            continue
        have = exports_of(tgt)
        for n in names.split(','):
            n = n.strip().split(' as ')[0].strip()
            if not n or n == 'default':
                continue
            checked += 1
            if n not in have:
                bad[f].append((n, mod, tgt))
    for default_name, named, mod in DEFAULT_IMP.findall(src):
        tgt = resolve(f, mod)
        if not tgt:
            if mod.startswith('.'):
                missing[f].append((default_name, mod))
            continue
        have = exports_of(tgt)
        if 'default' not in have:
            bad[f].append((default_name, mod + ' (default)', tgt))
        if named:
            for n in named.split(','):
                n = n.strip().split(' as ')[0].strip()
                if n and n not in have:
                    checked += 1
                    bad[f].append((n, mod, tgt))

print('已校验命名导入 %d 处（%d 文件）' % (checked, len(files)))
if missing:
    print()
    print('发现「相对路径 import 解析不到目标文件」（vite 加载即失败，致命）:')
    for f, items in sorted(missing.items()):
        print('  %s' % f.replace(ROOT + '/', ''))
        for n, mod in items:
            print('      <- %s   (%s)' % (mod, n))
    print('合计 %d 处' % sum(len(v) for v in missing.values()))
if bad:
    print('\n发现「目标模块不存在该命名导出」:')
    for f, items in sorted(bad.items()):
        print('  %s' % f.replace(ROOT + '/', ''))
        for n, mod, tgt in items:
            print('      %-28s <- %s   (实际在 %s)' % (n, mod, tgt.replace(ROOT + '/', '')))
    print('\n合计 %d 处' % sum(len(v) for v in bad.values()))
    sys.exit(1)
print('无问题')
