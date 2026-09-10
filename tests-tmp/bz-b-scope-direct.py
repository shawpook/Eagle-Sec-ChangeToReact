#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""b1-9bz-B scopeFace 直调化：主改造器。

判定图（route）
  MACH —— dataMachinery 的 s.NAME = 挂载体，且形态可机械还原：
            () => machineryX(s)              → machineryX(s)
            (a: any) => machineryX(s, a)     → machineryX(s, a)
         不可还原的（如 s.reload = machineryReload(s) 预绑实例、或 s.x = notifyFn 复用体）
         一律 SKIP，保持 s.NAME() 原样。
  DUAL —— 表键与 machinery 挂载的交集；scope 面由 applyDataMachineryScope 后挂覆盖 →
         同样走 machinery（与 MACH 同处置）。
  TABLE —— 只在 fns 表（scope 面 = shimFnsBridge 挂的表项指针 = 落点导出）→ NAME(...)
  NONE —— 两处都无供给 → 保持 s.NAME(...) 回退，绝不改。

用法：
  python tests-tmp/bz-b-scope-direct.py --map           # 只输出判定图
  python tests-tmp/bz-b-scope-direct.py --apply DIR     # 改造某个目录（services|core|components|store）
"""
import io
import json
import os
import re
import sys

ROOT = os.getcwd()
SRC = os.path.join(ROOT, 'src/app/react')
DM = os.path.join(SRC, 'core', 'dataMachinery.ts')
MAP_OUT = os.path.join(ROOT, 'tests-tmp', 'bz-b-scope-map.json')

# 挂载体可还原形态：(params) => machineryX(s[, params...])
MOUNT_ARROW = re.compile(r'^\(?\s*([^)]*?)\s*\)?\s*=>\s*machinery([A-Za-z0-9_$]+)\((.+)\)$')
# 变量部分捕获为 group(1)：替换时必须沿用**原变量名**（s/scope/bodyScope），
# 否则会在只有 scope 的作用域里插入不存在的 s → ReferenceError（被 try/catch 吞掉）。
CALL_RE = re.compile(r'(?<![\w$.])(s|scope|bodyScope)\.([A-Za-z_$][\w$]*)\s*\(')

# 保留在 scope 面的名字：测试契约通过替换 s.NAME 做 spy，直调化会让 spy 失效。
# b1-9bz-B-6 起：这 4 个已解锁（其派发点改为逐点保留，见 KEEP_SITES），故移出白名单。
# 仍保留的 3 个：
#   · search                 —— machinery 无对应导出（无挂载），落点只能是表项，收益小
#   · restoreDefaultShortcuts —— stage8d 契约 spy（preferences 控制器 scope）
#   · copyApiToken            —— stage8e 契约 spy（同上，嵌套 click 双触发）
EXCLUDE = {
    'restoreDefaultShortcuts', 'copyApiToken',
}

# 契约可观测的派发点（唯一允许保留 scope 面调用的调用点）：
#   filterDomain.ts      onFilterRuleChange 处理器内的 s.filterContent()（1f-D-filter-watch）
#   filterDomain.ts      $on('REBIND_REFRESH') 处理器内的 s.rebindRefresh(mute)（1f-D-rebind）
#   selectionViewDomain  $watchCollection('selected') 处理器内的 s.updateSelection()（1f-E-selected）
#   selectionViewDomain  $on('UPDATE_SELECTION') 处理器内的 s.updateSelection()（1f-E-broadcast）
# 具体位置由 tests-tmp/bz-b6-keep-sites.py 在改造后回写。
KEEP_SITES = {}


def _nl_of(p):
    """探测文件原有行尾：CRLF 为主则 CRLF，否则 LF。"""
    with open(p, 'rb') as f:
        b = f.read()
    crlf = b.count(b'\r\n')
    return '\r\n' if crlf and crlf >= (b.count(b'\n') - crlf) else '\n'


def read(p):
    # 通用换行：读进来统一成 \n，行锚定正则（^...$）才可靠
    with io.open(p, 'r', encoding='utf-8') as f:
        return f.read()


def write(p, s):
    # ★ 必须沿用原文件行尾：默认写会强制 CRLF，把仓库里本为 LF 的文件
    #   （如 core/dataMachinery.ts）整文件翻成 CRLF → 全文件 diff。
    nl = _nl_of(p)
    with io.open(p, 'w', encoding='utf-8', newline='') as f:
        f.write(s.replace('\r\n', '\n').replace('\n', nl))


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


def table_import_of(name):
    """表项指到哪个模块的具名导出（controllerFns.ts 的 import 行 + fns['X'] = X; 注册行）。"""
    cf = read(os.path.join(SRC, 'core', 'controllerFns.ts'))
    m = re.search(r'^\s*fns\["%s"\]\s*=\s*([A-Za-z0-9_$]+)\s*;' % re.escape(name), cf, re.M)
    if m:
        sym = m.group(1)
        for line in cf.split('\n'):
            if line.startswith('import {') and (' ' + sym + ',') in line or \
               line.startswith('import {') and (line.rstrip().endswith(sym + ' } from')) or \
               (line.startswith('import {') and re.search(r'[{,]\s*' + re.escape(sym) + r'\s*[,}]', line)):
                mod = re.search(r"from '([^']+)'", line)
                if mod:
                    return sym, mod.group(1)
        return sym, None
    # install 家族注册（fns["X"] = X; 出现在 service 文件里）
    for base, _dirs, files in os.walk(SRC):
        for fn in files:
            if not fn.endswith('.ts'):
                continue
            p = os.path.join(base, fn)
            src = read(p)
            m2 = re.search(r'^\s*fns\["%s"\]\s*=\s*([A-Za-z0-9_$]+)\s*;' % re.escape(name), src, re.M)
            if m2:
                return m2.group(1), os.path.relpath(p, ROOT).replace('\\', '/')
    return None, None


def build_map():
    tbl = table_keys()
    dm = read(DM)
    mounts = {}
    for m in re.finditer(r'^\s*s\.([A-Za-z0-9_$]+)\s*=\s*(.+?);\s*$', dm, re.M):
        mounts.setdefault(m.group(1), m.group(2).strip())

    routes = {}
    for name in set(list(mounts) + list(tbl)):
        rhs = mounts.get(name)
        exp = None
        arity = 0
        route = None
        if rhs:
            am = MOUNT_ARROW.match(rhs)
            if am:
                # 形参归一：`type?: any` -> type，`a: any = 1` -> a（可选/默认值不影响判档）
                params = [re.split(r'[?:=]', x.strip())[0].strip()
                          for x in am.group(1).split(',') if x.strip()]
                inner = [x.strip() for x in am.group(3).split(',')]
                # 形态要求：内层调用首参必须是 s，其余与形参一一对应
                if inner and inner[0] == 's' and len(inner) - 1 == len(params) and \
                   all(inner[i + 1] == params[i] for i in range(len(params))):
                    exp = 'machinery' + am.group(2)
                    arity = len(params)
                    route = 'DUAL' if name in tbl else 'MACH'
        if route is None and rhs:
            # 预绑实例形态：s.X = machineryX(s); —— 零参调用可等价还原为 machineryX(s)
            pm = re.match(r'^machinery([A-Za-z0-9_$]+)\(\s*s\s*\)$', rhs)
            if pm and name not in tbl:
                exp = 'machinery' + pm.group(1)
                arity = 0
                route = 'PREBIND'
        if route is None:
            if name in tbl:
                route = 'TABLE'
            elif rhs is not None:
                route = 'SKIP'   # machinery 有挂载但形态不可还原（如外部注入 notifyFn）
            else:
                route = 'NONE'
        routes[name] = {'route': route, 'export': exp, 'arity': arity, 'rhs': (rhs or '')[:80]}

    for name, info in routes.items():
        if info['route'] == 'TABLE':
            sym, mod = table_import_of(name)
            info['export'] = sym
            info['module'] = mod
    return routes


# ────────────────────────── 应用改造 ──────────────────────────

def top_level_names(src):
    """文件顶层**声明**的名字（不含 import）—— 避免 import 撞名。"""
    names = set()
    for m in re.finditer(r'^(?:export\s+)?(?:declare\s+)?(?:async\s+)?'
                         r'(?:const|let|var|function|class|interface|type)\s+([A-Za-z_$][\w$]*)',
                         src, re.M):
        names.add(m.group(1))
    return names


def local_decls(src):
    """文件内**任意层级**的局部声明名 + 形参名 —— import 进来会被遮蔽（同名）。"""
    names = set()
    for m in re.finditer(r'^\s*(?:export\s+)?(?:async\s+)?'
                         r'(?:const|let|var|function\*?|class)\s+([A-Za-z_$][\w$]*)', src, re.M):
        names.add(m.group(1))
    for m in re.finditer(r'(?:function\s*[A-Za-z_$\w]*\s*\(([^)]*)\)|\(([^)]*)\)\s*=>)', src):
        chunk = m.group(1) or m.group(2) or ''
        for p in chunk.split(','):
            p = p.strip().split(':')[0].strip().split('=')[0].strip()
            if re.match(r'^[A-Za-z_$][\w$]*$', p):
                names.add(p)
    return names


def imported_syms(src):
    """已 import 的具名符号 → 模块字符串（可能被复用，无需重复 import）。"""
    out = {}
    for m in re.finditer(r'^import\s+([\s\S]*?)\s+from\s+[\'"] ([^\'"]*) [\'"]'.replace(' ', ''), src, re.M):
        chunk, mod = m.group(1), m.group(2)
        br = re.search(r'\{([^}]*)\}', chunk)
        if br:
            for part in br.group(1).split(','):
                nm = part.split(' as ')[-1].strip()
                if nm:
                    out.setdefault(nm, mod)
        else:
            head = chunk.split(',')[0].strip()
            if re.match(r'^[A-Za-z_$][\w$]*$', head):
                out.setdefault(head, mod)
    return out


def rel_import(target_file, module_field):
    """module_field 是相对 controllerFns.ts（src/app/react/core/）的路径 → 转成 target 的相对路径。"""
    if not module_field:
        return None
    if not module_field.startswith('.'):
        return module_field
    base_dir = os.path.dirname(os.path.join(SRC, 'core', 'controllerFns.ts'))
    abs_mod = os.path.normpath(os.path.join(base_dir, module_field))
    rel = os.path.relpath(abs_mod, os.path.dirname(target_file)).replace('\\', '/')
    if not rel.startswith('.'):
        rel = './' + rel
    return rel


def add_imports(src, needed):
    """needed: {module_path: [symbols]} —— 合并进既有 import，否则新增一行。"""
    for mod, syms in sorted(needed.items()):
        syms = sorted(set(syms))
        m = re.search(r"^import \{([^}]*)\} from '%s';$" % re.escape(mod), src, re.M)
        if m:
            exist = [x.strip() for x in m.group(1).split(',') if x.strip()]
            merged = sorted(set(exist) | set(syms))
            src = src[:m.start()] + "import { %s } from '%s';" % (', '.join(merged), mod) + src[m.end():]
        else:
            lines = src.split('\n')
            last = 0
            for i, ln in enumerate(lines):
                if ln.startswith('import '):
                    last = i
            lines.insert(last + 1, "import { %s } from '%s';" % (', '.join(syms), mod))
            src = '\n'.join(lines)
    return src


def apply_dir(dirname):
    routes = json.load(io.open(MAP_OUT, encoding='utf-8'))
    root = os.path.join(SRC, dirname)
    changed = []
    skipped = {}
    for base, _dirs, files in os.walk(root):
        for fn in sorted(files):
            if not fn.endswith(('.ts', '.tsx')):
                continue
            path = os.path.join(base, fn)
            rel = os.path.relpath(path, ROOT).replace('\\', '/')
            src = read(path)
            # 守卫放宽：条目提升（bz-b-lift-all）后文件里可能已无 `const s = getScope();`
            # 字样，只要仍持有 getBodyScope/getScope 任一面即视为 body scope 消费文件。
            if 'getBodyScope' not in src and 'getScope' not in src:
                skipped[rel] = 'no scope binding'
                continue
            local_names = top_level_names(src)
            imported = imported_syms(src)
            shadowed = local_decls(src)
            needed = {}
            added = set()
            hits = 0
            miss = 0

            def rep(m):
                nonlocal hits, miss
                var = m.group(1)
                name = m.group(2)
                if name in EXCLUDE:
                    miss += 1
                    return m.group(0)
                info = routes.get(name)
                if not info:
                    miss += 1
                    return m.group(0)
                r = info['route']
                if r in ('MACH', 'DUAL', 'PREBIND'):
                    sym = info['export']
                    mod = rel_import(path, '../core/dataMachinery')
                elif r == 'TABLE' and info.get('module') and info.get('export'):
                    sym = info['export']
                    mod = rel_import(path, info['module'])
                else:
                    miss += 1
                    return m.group(0)
                if not sym or not mod:
                    miss += 1
                    return m.group(0)
                if r == 'PREBIND':
                    # ★ 预绑实例**永不直调**：挂载是 `s.X = machineryX(s)`，其返回值（debounce/
                    # throttle 实例）才是 s.X。`machineryX(s)` 只是重新造一个实例并丢弃，
                    # 函数体永不执行 —— 属语义错误（B5 首轮 allData 加载链断裂的真因：
                    # `s.reload()` 被改成 `machineryReload(s)`，防抖实例从未被调用）。
                    # 正确落点：保留 `s.X(...)`（scope 面调用预绑实例）。
                    miss += 1
                    return m.group(0)
                # ★ 零参调用不能留尾逗号：s.foo() -> machineryFoo(s
                # （闭合括号由原源码的 `)` 提供，此处不可自带）
                # 注意：这里只决定 **参数前缀**，绝不能提前 return —— 否则会跳过下面的
                # import 登记，产生「引用 18 次、零 import」的 ReferenceError（B6 踩过）。
                zero_arg = bool(r in ('MACH', 'DUAL')
                                and re.match(r'\s*\)', m.string[m.end():m.end() + 4]))
                pre = sym + '(' + (var + ('' if zero_arg else ', ') if r in ('MACH', 'DUAL') else '')
                if sym in imported:
                    # 已在本文件 import 过：同模块复用，异模块撞名则保守保留
                    if imported[sym] == mod or imported[sym].split('/')[-1] == mod.split('/')[-1]:
                        hits += 1
                        return pre
                    miss += 1
                    return m.group(0)
                if sym in local_names:
                    # 本文件已有该符号的**顶层声明**，直接调用，无需 import：
                    #  - dataMachinery.ts：machineryXxx 就是本地定义（定义侧自调用）
                    #  - 其他文件：TABLE 名被 lift-all 提升为同名导出
                    if not (os.path.basename(path) == 'dataMachinery.ts' or r == 'TABLE'):
                        miss += 1
                        return m.group(0)
                else:
                    # 需要新增 import —— 此时才检查局部同名遮蔽：
                    # （ProgressDialogs 的 const cancelEmptyTrash 会覆盖导入符号 → 自我递归）
                    if sym in shadowed:
                        miss += 1
                        return m.group(0)
                    needed.setdefault(mod, []).append(sym)
                hits += 1
                return pre

            out = CALL_RE.sub(rep, src)
            if hits:
                out = add_imports(out, needed)
                write(path, out)
                changed.append((rel, hits, miss))
            elif miss:
                skipped[rel] = '%d untransformed' % miss
    print('── %s ──' % dirname)
    for rel, hits, miss in sorted(changed, key=lambda x: -x[1]):
        print('   %-52s 直调 %3d  保留 %2d' % (rel, hits, miss))
    print('   合计：%d 文件 / %d 处直调' % (len(changed), sum(h for _, h, _ in changed)))
    if skipped:
        print('   跳过：%s' % json.dumps(skipped, ensure_ascii=False)[:600])


def main():
    if '--map' in sys.argv:
        routes = build_map()
        agg = {}
        for n, i in routes.items():
            agg.setdefault(i['route'], 0)
            agg[i['route']] += 1
        io.open(MAP_OUT, 'w', encoding='utf-8').write(json.dumps(routes, ensure_ascii=False, indent=1))
        print(json.dumps(agg, indent=1))
        print('map ->', MAP_OUT)
        return
    if '--apply' in sys.argv:
        apply_dir(sys.argv[sys.argv.index('--apply') + 1])
        return
    print('use --map / --apply DIR')


if __name__ == '__main__':
    main()
