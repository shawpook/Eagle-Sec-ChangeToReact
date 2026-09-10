#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""b1-9bz-A 二段审计：迁移体「自由标识符」增量。

口径：对每一个迁移函数，分别算出
  oldFree = 原 controllerFns.ts 表体中的自由标识符（既不在原文件模块/闭包作用域，也不是内建）
  newFree = 新落点文件中同一个函数的自由标识符
报告 newFree - oldFree —— 即「迁移后新出现的未绑定标识符」（运行期 ReferenceError /
漂移到 window 同名全局）。这正是 isInFolder/updateSuggestions 落点的漏网之鱼类型。
用法：python tests-tmp/bz-a-delta2.py
"""
import io
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ORIG = os.path.join(ROOT, 'tests-tmp', 'bz-a-cfns-orig.ts')

LANDING = [
    'src/app/react/core/filterDomain.ts',
    'src/app/react/core/itemDomain.ts',
    'src/app/react/core/miscDomain.ts',
    'src/app/react/services/folderCoreService.ts',
    'src/app/react/services/selectionService.ts',
    'src/app/react/services/sidebarService.ts',
    'src/app/react/services/mediaService.ts',
    'src/app/react/services/imageOpsService.ts',
    'src/app/react/services/itemMenuService.ts',
    'src/app/react/services/lockService.ts',
    'src/app/react/services/uploadService.ts',
    'src/app/react/services/viewOpsService.ts',
]

KNOWN = set('''
window document console Math JSON Object Array String Number Boolean Date RegExp Error TypeError
Promise Map Set WeakMap WeakSet Symbol Proxy Reflect Function setTimeout setInterval clearTimeout
clearInterval requestAnimationFrame cancelAnimationFrame parseInt parseFloat isNaN isFinite
encodeURIComponent decodeURIComponent encodeURI decodeURI Blob File FileReader FormData URL
localStorage sessionStorage navigator location history Image Audio Video fetch XMLHttpRequest
HTMLElement IntersectionObserver MutationObserver CustomEvent Event MouseEvent KeyboardEvent
ArrayBuffer Uint8Array Int32Array Float32Array DataView globalThis process require module exports
Infinity NaN undefined null true false arguments typeof instanceof void delete new in of if else
for while switch case try catch finally throw return var let const function class extends import
export from default async await yield static get set with debugger Boolean do this super digit
'''.split())

# 隐含全局：依赖 window 同名属性（旧实现里也靠 window 解析），不计入回归
IMPLICIT_GLOBALS = set('''
eagle $ ig $bodyScope FileUrlHelper path resetNgGridLayoutData chineseConvert analytics Registration
i18n RecentFileManager HoverPreview electronLog swal lodash _ jQuery angular ngRoute filterApp
gulp ngDialog Sortable jscolor Toast dpx electron regenerative platform pane registry Menu MenuItem
remote Optional dependencies optional Dependencies q notify store pkg productName utc
'''.split())


def read(p):
    with io.open(p, 'r', encoding='utf-8') as f:
        return f.read()


def strip_noise(src):
    out = []
    in_block = False
    for line in src.split('\n'):
        buf = []
        i = 0
        ilc = False
        ins = None
        while i < len(line):
            c = line[i]
            nx = line[i + 1] if i + 1 < len(line) else ''
            if in_block:
                if c == '*' and nx == '/':
                    in_block = False
                    i += 2
                    continue
                i += 1
                continue
            if ilc:
                i += 1
                continue
            if ins:
                if c == '\\':
                    i += 2
                    continue
                if c == ins:
                    ins = None
                i += 1
                continue
            if c == '/' and nx == '/':
                ilc = True
                i += 2
                continue
            if c == '/' and nx == '*':
                in_block = True
                i += 2
                continue
            if c in '"\'`':
                # 保留引号定界符（import 解析依赖它），但丢弃字面量内容（避免把字符串里的
                # 单词误当作自由标识符）
                j = i + 1
                while j < len(line):
                    if line[j] == '\\':
                        j += 2
                        continue
                    if line[j] == c:
                        break
                    j += 1
                buf.append(c)
                buf.append(c)
                i = (j + 1) if j < len(line) else len(line)
                continue
            buf.append(c)
            i += 1
        out.append(''.join(buf))
    return '\n'.join(out)


def brace_end(lines, start_idx, open_col):
    """从 start_idx 行 open_col 处的 '{' 起做花括号配对，返回结束行号索引。"""
    depth = 0
    i = start_idx
    started = False
    while i < len(lines):
        ln = lines[i]
        for j, c in enumerate(ln):
            if i == start_idx and j < open_col:
                continue
            if c == '{':
                depth += 1
                started = True
            elif c == '}':
                depth -= 1
                if started and depth == 0:
                    return i
        i += 1
    return len(lines) - 1


def extract_orig_bodies(src):
    """从原 controllerFns.ts 抽取 fns["NAME"] = function 的体 [{name, body}]。"""
    clean = strip_noise(src).split('\n')
    raw = src.split('\n')
    out = {}
    pat = re.compile(r'^\s*fns\["([^"]+)"\]\s*=\s*function\s*(\([^)]*\))?\s*\{')
    # 注意：strip_noise 会抹掉字符串字面量内容（含 fns["NAME"] 的键），故在 raw 行上匹配、
    # 在 clean 行上做花括号配对（static: 行数对齐，clean 里行内 { } 已剔除字符串干扰）
    for idx, ln in enumerate(raw):
        m = pat.match(ln)
        if not m:
            continue
        open_col = clean[idx].rfind('{')
        end = brace_end(clean, idx, open_col)
        out[m.group(1)] = '\n'.join(raw[idx:end + 1])
    return out


def extract_new_bodies(src):
    """从落点文件抽取 export function NAME(...args) 且带 bz-A 序言的体。"""
    clean = strip_noise(src).split('\n')
    raw = src.split('\n')
    out = {}
    pat = re.compile(r'^(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(')
    for idx, ln in enumerate(clean):
        m = pat.match(ln)
        if not m:
            continue
        open_col = ln.index('(')
        # 找到参数列表后的 '{'
        j = idx
        while j < len(clean) and '{' not in clean[j][open_col:]:
            open_col = 0
            j += 1
        if j >= len(clean):
            continue
        open_col = clean[j].index('{', open_col)
        end = brace_end(clean, j, open_col)
        body = '\n'.join(raw[idx:end + 1])
        if 'initLinkVars()' in body:
            out.setdefault(m.group(1), body)
    return out


def module_scope(src):
    """模块/顶层可用名集合：顶层声明 + import + 顶层 function/class。"""
    clean = strip_noise(src)
    names = set()
    for ln in clean.split('\n'):
        if not ln or ln[0] in ' \t':
            continue
        m = re.match(r'^(?:export\s+)?(?:declare\s+)?(?:async\s+)?(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)', ln)
        if m:
            names.add(m.group(1))
            continue
        m2 = re.match(r'^(?:export\s+)?(?:const|let|var)\s+([^=;{]+?)\s*=', ln)
        if m2:
            names.update(re.findall(r'[A-Za-z_$][\w$]*', m2.group(1)))
            continue
    for m in re.finditer(r'import\s+([\s\S]*?)\s+from\s+[\'"][^\'"]*[\'"]', clean):
        chunk = m.group(1)
        br = re.search(r'\{([^}]*)\}', chunk)
        if br:
            for part in br.group(1).split(','):
                nm = part.split(' as ')[-1].strip()
                if nm:
                    names.add(nm)
        else:
            head = chunk.split(',')[0].strip()
            if re.match(r'^[A-Za-z_$][\w$]*$', head):
                names.add(head)
            ns = re.search(r'\*\s+as\s+([A-Za-z_$][\w$]*)', chunk)
            if ns:
                names.add(ns.group(1))
    for m in re.finditer(r'const\s*\{([^}]*)\}\s*=\s*require', clean):
        for part in m.group(1).split(','):
            nm = part.split(':')[-1].strip()
            if nm:
                names.add(nm)
    return names


def local_bound(body):
    """函数体内自己声明的名字 + 形参（简化：任何 (const|let|var|function|class) NAME 与箭头参数）。"""
    names = set()
    clean = strip_noise(body)
    for m in re.finditer(r'(?:\bconst|\blet|\bvar|\bfunction|\bclass)\s+([A-Za-z_$][\w$]*)', clean):
        names.add(m.group(1))
    for m in re.finditer(r'(?:\bconst|\blet|\bvar)\s*\{([^}]*)\}', clean):
        for part in m.group(1).split(','):
            nm = part.split(':')[-1].strip()
            if nm:
                names.add(nm)
    for m in re.finditer(r'\(([^()]*)\)\s*=>', clean):
        for nm in re.findall(r'[A-Za-z_$][\w$]*', m.group(1)):
            names.add(nm)
    for m in re.finditer(r'function\s*[A-Za-z_$][\w$]*\s*\(([^)]*)\)', clean):
        for nm in re.findall(r'[A-Za-z_$][\w$]*', m.group(1)):
            names.add(nm)
    for m in re.finditer(r'\.catch\s*\(\s*([A-Za-z_$][\w$]*)', clean):
        names.add(m.group(1))
    for m in re.finditer(r'\.then\s*\(\s*([A-Za-z_$][\w$]*)', clean):
        names.add(m.group(1))
    for m in re.finditer(r'callback\s*\(\s*function\s*\(([^)]*)\)', clean):
        for nm in re.findall(r'[A-Za-z_$][\w$]*', m.group(1)):
            names.add(nm)
    return names


def free_idents(body, scope_names):
    text = strip_noise(body)
    text = re.sub(r'\?\.\s*[A-Za-z_$][\w$]*', ' ', text)
    text = re.sub(r'\.\s*[A-Za-z_$][\w$]*', ' ', text)
    text = re.sub(r'([A-Za-z_$][\w$]*)\s*:', r'  ', text)
    text = re.sub(r'<[A-Za-z_$][\w$]*>', ' ', text)
    ids = set(re.findall(r'[A-Za-z_$][\w$]*', text))
    lb = local_bound(body)
    out = set()
    for nm in ids:
        if nm in KNOWN or nm in IMPLICIT_GLOBALS:
            continue
        if nm in lb or nm in scope_names:
            continue
        if nm.startswith('__lv_') or nm.startswith('__cc_'):
            continue
        if nm[0].isupper():
            continue
        out.add(nm)
    return out


def main():
    orig_src = read(ORIG)
    orig_scope = module_scope(orig_src)
    orig_scope |= {'getScope', 'initLinkVars', 'fns'}
    orig_bodies = extract_orig_bodies(orig_src)

    findings = []
    for rel in LANDING:
        path = os.path.join(ROOT, rel)
        if not os.path.exists(path):
            continue
        src = read(path)
        scope = module_scope(src)
        for name, body in sorted(extract_new_bodies(src).items()):
            old = orig_bodies.get(name)
            if old is None:
                continue
            old_free = free_idents(old, orig_scope)
            new_free = free_idents(body, scope)
            delta = sorted(new_free - old_free)
            if delta:
                findings.append({'file': rel, 'fn': name, 'delta': delta})

    print('=== 迁移后新出现的未绑定标识符（newFree - oldFree）===')
    if not findings:
        print('(无)')
    for row in findings:
        print('%s :: %s -> %s' % (row['file'], row['fn'], ', '.join(row['delta'])))
    with io.open(os.path.join(ROOT, 'tests-tmp', 'bz-a-delta2.json'), 'w', encoding='utf-8') as f:
        f.write(json.dumps(findings, ensure_ascii=False, indent=2))
    print('')
    print('migrated bodies matched: %d' % len([r for r in findings]))


if __name__ == '__main__':
    main()
