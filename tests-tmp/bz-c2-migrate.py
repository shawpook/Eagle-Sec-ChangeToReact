#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""C-2 通用频道迁移器：$broadcast/$on → eagleBus.defineChannel。

用法：python tests-tmp/bz-c2-migrate.py CHANNEL [CHANNEL ...]

要点（前两批踩过的坑都在此固化）：
1. bus import 路径**按文件目录深度自动计算**（components/xx/ 下是 '../../global/bus'，
   core/ 与 services/ 下是 '../global/bus'）—— 写死路径曾导致 vite 加载失败。
2. handler 签名同步改：Angular 的 (event, params) → bus 的 (params)。
3. emit 支持有载荷与无载荷两种形态。
4. 已存在同模块 import 时合并，不新增重复行。
"""
import io, os, re, subprocess, sys

ROOT = 'src/app/react'
BUS = ROOT + '/global/bus.ts'


def var_of(ch):
    """MOVE-CROP-TOOL -> moveCropToolChannel；NEW.SMART.FOLDER -> newSmartFolderChannel"""
    parts = re.split(r'[^A-Za-z0-9]+', ch)
    parts = [p for p in parts if p]
    name = parts[0].lower()
    for p in parts[1:]:
        name += p[0].upper() + p[1:].lower()
    return name + 'Channel'


def bus_path(f):
    rel = os.path.relpath(os.path.dirname(f), ROOT).replace('\\', '/')
    depth = 0 if rel == '.' else len(rel.split('/'))
    return '../' * depth + 'global/bus' if depth else './global/bus'


def add_channels(chans):
    s = io.open(BUS, encoding='utf-8', newline='').read()
    nl = '\r\n' if '\r\n' in s else '\n'
    t = s.replace('\r\n', '\n')
    block = ''
    for var, ch in chans:
        if var in t:
            continue
        block += "export const %s = defineChannel<any>('%s');\n" % (var, ch)
    if not block:
        return
    t = t.rstrip('\n') + '\n\n// ── b1-9bz-C-2 频道迁移 ──\n' + block
    io.open(BUS, 'w', encoding='utf-8', newline='').write(t.replace('\n', nl))


def main(chs):
    files = [f for f in subprocess.check_output(['git', 'ls-files', ROOT], text=True).split()
             if f.endswith(('.ts', '.tsx'))]
    # 以 @ 开头的参数视为「仅处理这些文件」（用于二分定位），如 @dataMachinery
    only = [c[1:] for c in chs if c.startswith('@')]
    if only:
        chs = [c for c in chs if not c.startswith('@')]
        files = [f for f in files if any(k in f for k in only)]
        print('仅处理文件: %s' % ', '.join(files))
    chans = [(var_of(c), c) for c in chs]
    add_channels(chans)
    print('bus.ts 频道: %s' % ', '.join(v for v, _ in chans))

    RECV = r'[A-Za-z_$][\w$]*(?:\(\))?\??\.'
    total = 0
    for f in files:
        s = io.open(f, encoding='utf-8', newline='').read()
        nl = '\r\n' if '\r\n' in s else '\n'
        t = s.replace('\r\n', '\n')
        need, n = [], 0
        for var, ch in chans:
            # `.$root.$broadcast(` 与 `.$broadcast(` 必须分两条 —— 合并写法里 `[\w$]` 含 `$`，
            # 会把 `$root` 当标识符整体匹配，导致 `s.$root.$broadcast(` 只被吃掉 `$root.`，
            # 前缀 `s.` 残留在输出里（产 s.xxxChannel.emit()，运行期直接 TypeError）。
            t, k1 = re.subn(r'[A-Za-z_$][\w$]*(?:\(\))?\??\.\$root\.\$broadcast\(\s*[\'"]' + re.escape(ch) + r'[\'"]\s*,\s*',
                            var + '.emit(', t)
            t, k1b = re.subn(r'[A-Za-z_$][\w$]*(?:\(\))?\??\.\$broadcast\(\s*[\'"]' + re.escape(ch) + r'[\'"]\s*,\s*',
                             var + '.emit(', t)
            t, k2 = re.subn(r'[A-Za-z_$][\w$]*(?:\(\))?\??\.\$root\.\$broadcast\(\s*[\'"]' + re.escape(ch) + r'[\'"]\s*\)',
                            var + '.emit()', t)
            t, k2b = re.subn(r'[A-Za-z_$][\w$]*(?:\(\))?\??\.\$broadcast\(\s*[\'"]' + re.escape(ch) + r'[\'"]\s*\)',
                             var + '.emit()', t)
            t, k3 = re.subn(r'[A-Za-z_$][\w$]*(?:\(\))?\??\.\$on\(\s*[\'"]' + re.escape(ch) + r'[\'"]\s*,\s*',
                            var + '.on(', t)
            if k1 + k1b + k2 + k2b + k3:
                need.append(var)
                n += k1 + k1b + k2 + k2b + k3
        if not n:
            continue
        # handler 签名：(e|event|x, params) → (params)（仅本批新接的 channel.on）
        for var, ch in chans:
            t = re.sub(re.escape(var) + r'\.on\(\s*\(\s*(?:e|event|evt|_e|_\w*)\s*:\s*any\s*,\s*(\w+)\s*:\s*any\s*\)\s*=>',
                       var + r'.on((\1: any) =>', t)
            t = re.sub(re.escape(var) + r'\.on\(\s*function\s*\(\s*(?:e|event|evt|_e|_\w*)\s*:\s*any\s*,\s*(\w+)\s*:\s*any\s*\)\s*',
                       var + r'.on(function (\1: any) ', t)
        mod = bus_path(f)
        m = re.search(r"^import \{([^}]*)\} from '%s';$" % re.escape(mod), t, re.M)
        if m:
            names = sorted(set([x.strip() for x in m.group(1).split(',') if x.strip()] + need))
            t = t[:m.start()] + "import { %s } from '%s';" % (', '.join(names), mod) + t[m.end():]
        else:
            lines = t.split('\n')
            last = max(i for i, l in enumerate(lines) if l.startswith('import '))
            lines.insert(last + 1, "import { %s } from '%s';" % (', '.join(sorted(need)), mod))
            t = '\n'.join(lines)
        io.open(f, 'w', encoding='utf-8', newline='').write(t.replace('\n', nl))
        print('  %-52s %d 处  (%s)' % (f.replace(ROOT + '/', ''), n, mod))
        total += n
    print('\n合计迁移 %d 处' % total)


if __name__ == '__main__':
    main(sys.argv[1:])
