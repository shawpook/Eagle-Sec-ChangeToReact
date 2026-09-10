#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""b1-9bz：修复工作树中 27 条 `from 'src/app/react/xxx.ts'` 绝对路径 import。

背景：scopeFace 直调化脚本（bz-b-lift-all.py / bz-b-scope-direct.py）在提升 install 体内
匿名函数为具名导出时，新增 import 用了「仓库根相对 + .ts 后缀」的裸说明符，vite/esbuild
无法解析（既非相对路径也非 bare 模块），会把 build 打死。本脚本：
  1. 把这些 import 改写为真正的相对路径（按文件目录深度计算，去 .ts 后缀）；
  2. 校验每个具名导入在目标文件里确有对应 export（缺失则报 MISSING_EXPORT）。
用法：python tests-tmp/bz-b-fix-abs-imports.py
"""
import io
import os
import re
import posixpath

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCAN = os.path.join(ROOT, 'src', 'app', 'react')

ABS_RE = re.compile(r"from\s+'src/app/react/([^']+?)\.ts'")
EXPORT_RE = re.compile(r'^export\s+(?:async\s+)?(?:function|const|let|var|class)\s+([A-Za-z_$][\w$]*)', re.M)
EXPORT_BRACE_RE = re.compile(r'^export\s*\{([^}]*)\}', re.M)


def collect_exports(path):
    if not os.path.exists(path):
        return None
    with io.open(path, 'r', encoding='utf-8') as f:
        src = f.read()
    names = set(EXPORT_RE.findall(src))
    for chunk in EXPORT_BRACE_RE.findall(src):
        for part in chunk.split(','):
            nm = part.split(' as ')[-1].strip()
            if nm:
                names.add(nm)
    return names


def main():
    changed = []
    problems = []
    for base, _dirs, files in os.walk(SCAN):
        for name in files:
            if not name.endswith(('.ts', '.tsx')):
                continue
            fp = os.path.join(base, name)
            with io.open(fp, 'r', encoding='utf-8') as f:
                text = f.read()
            if "from 'src/app/react/" not in text:
                continue

            def repl(m):
                rel_target = 'src/app/react/' + m.group(1) + '.ts'
                target_abs = os.path.join(ROOT, rel_target.replace('/', os.sep))
                rel = os.path.relpath(target_abs, base).replace(os.sep, '/')
                if not rel.startswith('.'):
                    rel = './' + rel
                rel = rel[:-3] if rel.endswith('.ts') else rel
                return "from '%s'" % rel

            new_text = ABS_RE.sub(repl, text)

            # 导出存在性校验（用改写后的相对路径定位目标）
            for m in re.finditer(r"import\s*\{([^}]*)\}\s*from\s*'([^']+)'", new_text):
                spec = m.group(2)
                if not spec.startswith('.'):
                    continue
                tgt = os.path.normpath(os.path.join(base, spec))
                for cand in (tgt + '.ts', tgt + '.tsx', os.path.join(tgt, 'index.ts')):
                    if os.path.exists(cand):
                        tgt = cand
                        break
                else:
                    problems.append('UNRESOLVED %s -> %s' % (os.path.relpath(fp, ROOT), spec))
                    continue
                exports = collect_exports(tgt)
                for part in m.group(1).split(','):
                    nm = part.split(' as ')[0].strip()
                    if not nm:
                        continue
                    if exports is not None and nm not in exports:
                        problems.append('MISSING_EXPORT %s: %s not exported by %s'
                                        % (os.path.relpath(fp, ROOT), nm, os.path.relpath(tgt, ROOT)))
            if new_text != text:
                with io.open(fp, 'w', encoding='utf-8', newline='') as f:
                    f.write(new_text)
                changed.append(os.path.relpath(fp, ROOT))

    print('FIXED FILES: %d' % len(changed))
    for p in changed:
        print('  ' + p)
    print('')
    print('PROBLEMS: %d' % len(problems))
    for p in problems:
        print('  ' + p)


if __name__ == '__main__':
    main()
