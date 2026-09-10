# -*- coding: utf-8 -*-
"""b1-9by-C store 转换器：bindXxxSync 的 startScopeSync 内联 build 逐字平移为独立函数
+ syncXxxFromScope + 订阅 bind。单 apply 路径。"""
import re, io, sys

SPECS = [
    # (file, bind_name, store_hook, snapshot_type, sub_stores)
    ('src/app/react/store/toolbarState.ts', 'bindToolbarSync', 'useToolbarState', 'ToolbarSnapshot',
     ['useBodyState', 'useListState', 'useFilterState', 'usePanelState', 'useSidebarState']),
    ('src/app/react/store/bodyState.ts', 'bindBodySync', 'useBodyState', 'Partial<BodyState>',
     ['useFilterState', 'usePanelState']),
    ('src/app/react/store/detailState.ts', 'bindDetailSync', 'useDetailState', 'Partial<DetailSnapshot>',
     ['useBodyState', 'useListState', 'useFilterState', 'usePanelState']),
    ('src/app/react/store/inspectorState.ts', 'bindInspectorSync', 'useInspectorState', 'InspectorSnapshot',
     ['useBodyState', 'useListState', 'useFilterState', 'usePanelState']),
]

def find_block_end(lines, start_idx):
    """start_idx 行含 'export function bind'——返回其闭合 } 的行号。"""
    depth = 0
    for i in range(start_idx, len(lines)):
        depth += lines[i].count('{') - lines[i].count('}')
        if depth <= 0 and i > start_idx:
            return i
    raise RuntimeError('no block end for ' + str(start_idx))

def transform(path, bind_name, store_hook, snap_type, sub_stores):
    src = io.open(path, encoding='utf-8').read()
    lines = src.splitlines(True)
    start = next(i for i, l in enumerate(lines) if 'export function ' + bind_name in l)
    end = find_block_end(lines, start)
    block = ''.join(lines[start:end+1])
    # 提取 build 体：'build: (scope) => {' 到 'as XXX,' 行
    m = re.search(r'build: \(scope\) => \{\n(.*?)\n(\s*)\} as ([^,]+),', block, re.S)
    assert m, path + ': build body not found'
    body, close_indent, as_clause = m.group(1), m.group(2), m.group(3)
    # 去一层缩进（12→8 或 6→4）：统一减 2 空格 ×2？直接按原样保留（JS 不敏感）——保留原缩进
    build_fn = 'function build' + bind_name.replace('bind', '').replace('Sync', '') + 'Snapshot(scope: any): ' + snap_type + ' {\n' + body + '\n' + close_indent + '} as ' + as_clause + ';\n' + close_indent + '}'
    # 修正：body 尾行是 `    } as XXX,`（含 as）——上面已并成 return 尾；把 body 尾的 `} as X,` 变 `} as X;`
    build_fn = build_fn.replace('} as ' + as_clause + ';\n' + close_indent + '} as ' + as_clause + ';', '} as ' + as_clause + ';\n' + close_indent + '}')
    sync_name = 'sync' + bind_name.replace('bind', '').replace('Sync', '') + 'FromScope'
    short = bind_name.replace('bind', '').replace('Sync', '')
    subs = '\n'.join('  %s.subscribe(() => %s());' % (s, sync_name) for s in sub_stores)
    new_block = (
        'function build' + short + 'Snapshot(scope: any): ' + snap_type + ' {\n'
        + body + '\n' + close_indent + '} as ' + as_clause + ';\n' + close_indent + '}\n\n'
        '// b1-9by-C：快照深比较守卫（scopeBridge startScopeSync 同款语义）。\n'
        'function shallowEq' + short + '(a: any, b: any): boolean {\n'
        '  if (a === b) return true;\n'
        "  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;\n"
        '  const ka = Object.keys(a);\n'
        '  if (ka.length !== Object.keys(b).length) return false;\n'
        '  return ka.every((k) => a[k] === b[k]);\n'
        '}\n\n'
        'let last' + short + 'Snapshot: any = null;\n\n'
        '/** b1-9by-C：快照直写收敛——原 startScopeSync 200ms 轮询退役。 */\n'
        'export function ' + sync_name + '(): void {\n'
        '  const scope: any = getBodyScope();\n'
        '  if (!scope) return;\n'
        '  const next = build' + short + 'Snapshot(scope);\n'
        '  if (last' + short + 'Snapshot !== null && shallowEq' + short + '(next, last' + short + 'Snapshot)) return;\n'
        '  last' + short + 'Snapshot = next;\n'
        '  ' + store_hook + '.setState(next as any);\n'
        '}\n\n'
        'export function ' + bind_name + '(): void {\n'
        "  // 供闭环测试直写 scope 后手动驱动（原 $evalAsync 触发快照链的等价物）。\n"
        "  (window as any).__eagle" + short + "Sync = " + sync_name + ";\n"
        + subs + '\n'
        '  // 启动期一次性对齐。\n'
        '  ' + sync_name + '();\n'
        '}'
    )
    lines[start:end+1] = [new_block + '\n']
    src = ''.join(lines)
    # import 面：去掉 startScopeSync（若无其他引用），补 getBodyScope + 订阅 store
    if src.count('startScopeSync') == 1:
        src = re.sub(r"import \{([^}]*)startScopeSync,?\s*([^}]*)\} from '\.\./global/scopeBridge';",
                     lambda mm: ("import { getBodyScope%s } from '../global/scopeBridge';" % ((',' + mm.group(2)) if mm.group(2).strip() else '')) if 'getBodyScope' not in mm.group(1) else mm.group(0), src, count=1)
    for store, mod in [('useBodyState', './bodyState'), ('useListState', './listState'),
                       ('useFilterState', './filterState'), ('usePanelState', './panelState'),
                       ('useSidebarState', './sidebarState')]:
        if store in sub_stores and not re.search(r'import\s*\{[^}]*\b' + store + r'\b[^}]*\} from', src):
            src = src.replace("import { create } from 'zustand';",
                              "import { create } from 'zustand';\nimport { %s } from '%s';" % (store, mod), 1)
    io.open(path, 'w', encoding='utf-8', newline='').write(src)
    print('transformed', path)

for spec in SPECS:
    transform(*spec)
print('DONE')
