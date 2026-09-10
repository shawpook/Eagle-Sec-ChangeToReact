#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""b1-9bz-A 标识符绑定漂移审计。

背景：bz-A 把 controllerFns.ts 的 121 个函数体迁移到 11+3 个落点文件。
函数名/ miej属性的可解析性由 esbuild 保证，但「自由标识符」在新模块的解析对象
可能静默改变（例：$timeout 在新落点解析成不带 .cancel 的本地 shim → 运行期
TypeError，且被 calculateImageBinding 的 catch(electronLog 缺席) 完全吞掉）。

本脚本做两类检查：
  A. MISSING   —— 标识符在原 controllerFns 顶层有声明，新落点既无顶层声明也无 import
                  → 运行期 ReferenceError / 解析到 window 同名全局（语义漂移）
  B. DRIFT     —— 标识符两边顶层都有声明，但声明体不同（去掉注释/空白后比较）
                  → 可能解析到语义不同的同名对象（本次 $timeout 就属此类）
用法：python tests-tmp/bz-a-binding-audit.py
"""
import io
import json
import re
import os

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

KNOWN_GLOBALS = set('''
window document console Math JSON Object Array String Number Boolean Date RegExp Error TypeError
Promise Map Set WeakMap WeakSet Symbol Proxy Reflect Function setTimeout setInterval clearTimeout
clearInterval requestAnimationFrame cancelAnimationFrame parseInt parseFloat isNaN isFinite encodeURIComponent
decodeURIComponent encodeURI decodeURI Blob File FileReader FormData URL localStorage sessionStorage
navigator location history Image Audio Video fetch XMLHttpRequest HTMLElement IntersectionObserver
MutationObserver CustomEvent Event MouseEvent KeyboardEvent WeakRef BigInt ArrayBuffer Uint8Array
Int8Array Uint16Array Int32Array Float32Array Float64Array DataView globalThis process require module
exports __dirname Infinity NaN undefined null true false arguments this super new typeof instanceof
void delete in of do if else for while switch case try catch finally throw return var let const function
class extends import export from default async await yield static get set of with debugger Boolean
'''.split())

# 迁移体的统一序言指纹
PROLOGUE = 'try { initLinkVars(); }'


def read(p):
    with io.open(p, 'r', encoding='utf-8') as f:
        return f.read()


def strip_noise(src):
    """去注释与字符串字面量，保留标识符结构（行数不变，便于定位行号）。"""
    out = []
    lines = src.split('\n')
    in_block = False
    for line in lines:
        buf = []
        i = 0
        in_line_comment = False
        in_s = None
        while i < len(line):
            c = line[i]
            nxt = line[i + 1] if i + 1 < len(line) else ''
            if in_block:
                if c == '*' and nxt == '/':
                    in_block = False
                    i += 2
                    continue
                i += 1
                continue
            if in_line_comment:
                i += 1
                continue
            if in_s:
                if c == '\\':
                    i += 2
                    continue
                if c == in_s:
                    in_s = None
                i += 1
                continue
            if c == '/' and nxt == '/':
                in_line_comment = True
                i += 2
                continue
            if c == '/' and nxt == '*':
                in_block = True
                i += 2
                continue
            if c in '"\'`':
                # 保留引号定界符（import 解析依赖它），丢弃字面量内容
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


def top_decls(src):
    """采集顶层（列 0 起）const/let/var/function/class 声明名 → 声明首文本（含附加属性赋值）。

    关键：`$timeout.cancel = function…` 这类「声明后紧跟的顶层属性赋值」必须并入指纹，
    否则 bz-A 的 $timeout 漂移（新落点缺少 .cancel）检测不出来。
    """
    decls = {}
    extra = {}
    lines = strip_noise(src).split('\n')
    pat = re.compile(r'^(?:export\s+)?(?:declare\s+)?(?:async\s+)?(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)')
    pat_multi = re.compile(r'^(?:export\s+)?(?:const|let|var)\s+([^=;{]+?)\s*=')
    attach = re.compile(r'^([A-Za-z_$][\w$]*)\.[A-Za-z_$][\w$]*\s*=')
    for ln in lines:
        m = pat.match(ln)
        if m:
            decls[m.group(1)] = ln.strip()
            continue
        m2 = pat_multi.match(ln)
        if m2:
            for nm in re.findall(r'[A-Za-z_$][\w$]*', m2.group(1)):
                decls.setdefault(nm, ln.strip())
            continue
        ma = attach.match(ln)
        if ma:
            extra.setdefault(ma.group(1), []).append(ln.strip())
    # 把附加属性赋值追加进指纹
    for nm, extra_lines in extra.items():
        if nm in decls:
            decls[nm] = decls[nm] + ' ||ATTACH|| ' + ' ;; '.join(sorted(extra_lines))
    return decls


def imports_of(src):
    names = set()
    text = strip_noise(src)
    for m in re.finditer(r'import\s+([\s\S]*?)\s+from\s+[\'"][^\'"]*[\'"]', text):
        chunk = m.group(1)
        br = re.search(r'\{([^}]*)\}', chunk)
        if br:
            for part in br.group(1).split(','):
                part = part.strip()
                if not part:
                    continue
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
    for m in re.finditer(r'const\s*\{([^}]*)\}\s*=\s*require', text):
        for part in m.group(1).split(','):
            nm = part.split(':')[-1].strip()
            if nm:
                names.add(nm)
    return names


def norm_decl(s):
    s = re.sub(r'\s+', ' ', s).strip()
    return s


def idents_of(body):
    text = strip_noise(body)
    # 去掉 a.b / a?.b 的属性名
    text = re.sub(r'\?\.\s*[A-Za-z_$][\w$]*', ' ', text)
    text = re.sub(r'\.\s*[A-Za-z_$][\w$]*', ' ', text)
    # 去掉对象字面量的 key:
    text = re.sub(r'([A-Za-z_$][\w$]*)\s*:', r'  ', text)
    # 去掉标签/强转
    text = re.sub(r'<[A-Za-z_$][\w$]*>', ' ', text)
    return set(re.findall(r'[A-Za-z_$][\w$]*', text))


def split_migrated(src):
    """返回 [(funcName, startLine, endLine)] —— 带 bz-A 序言的迁移体。"""
    lines = src.split('\n')
    out = []
    for idx, ln in enumerate(lines):
        m = re.match(r'^(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)', ln)
        if not m:
            continue
        # 函数体范围：向后找列 0 的 '}'（保守）或 EOF
        end = len(lines) - 1
        for j in range(idx + 1, len(lines)):
            if re.match(r'^\}\s*$', lines[j]):
                end = j
                break
        body = '\n'.join(lines[idx:end + 1])
        if PROLOGUE in body:
            out.append((m.group(1), idx + 1, end + 1, body))
    return out


def main():
    orig_src = read(ORIG)
    orig_decls = top_decls(orig_src)
    orig_imports = imports_of(orig_src)

    report = {'missing': [], 'drift': []}
    for rel in LANDING:
        path = os.path.join(ROOT, rel)
        if not os.path.exists(path):
            continue
        src = read(path)
        ldecls = top_decls(src)
        limports = imports_of(src)
        fns = split_migrated(src)
        touchedMissing = {}
        touchedDrift = {}
        for name, ls, le, body in fns:
            ids = idents_of(body)
            for nm in sorted(ids):
                if nm in KNOWN_GLOBALS:
                    continue
                if nm.startswith('__lv_'):
                    continue
                if nm[0].isupper():
                    continue
                if nm in ldecls or nm in limports:
                    # B：同名本地/import，但若原处也是顶层声明且声明体不同 → 漂移
                    if nm in orig_decls and nm != 'getScope':
                        a = norm_decl(orig_decls[nm])
                        b = norm_decl(ldecls.get(nm) or ('import ' + nm))
                        if a != b:
                            touchedDrift.setdefault(nm, {'line': ls, 'fns': []})
                            if len(touchedDrift[nm]['fns']) < 6:
                                touchedDrift[nm]['fns'].append(name)
                    continue
                # A：新落点没绑定
                if nm in orig_decls:
                    touchedMissing.setdefault(nm, {'orig': orig_decls[nm][:120], 'fns': []})
                    if len(touchedMissing[nm]['fns']) < 6:
                        touchedMissing[nm]['fns'].append(name)
        for nm, info in touchedMissing.items():
            report['missing'].append({'file': rel, 'ident': nm, 'orig': info['orig'], 'consumers': info['fns']})
        for nm, info in touchedDrift.items():
            old = norm_decl(orig_decls.get(nm, ''))
            new = norm_decl(ldecls.get(nm, 'import'))
            report['drift'].append({'file': rel, 'ident': nm, 'old': old[:200], 'new': new[:200], 'consumers': info['fns']})

    print('=== MISSING（新落点无绑定，原处有顶层声明） ===' % ())
    for row in report['missing']:
        print('%s :: %s\n    orig: %s\n    consumers: %s' % (row['file'], row['ident'], row['orig'], ','.join(row['consumers'])))
    print('')
    print('=== DRIFT（两边都有声明但声明体不同） ===')
    for row in report['drift']:
        print('%s :: %s\n    old: %s\n    new: %s\n    consumers: %s' % (row['file'], row['ident'], row['old'], row['new'], ','.join(row['consumers'])))
    with io.open(os.path.join(ROOT, 'tests-tmp', 'bz-a-binding-audit.json'), 'w', encoding='utf-8') as f:
        f.write(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
