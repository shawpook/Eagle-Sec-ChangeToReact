# 改写 tests/react-stage1c3-smoke.mjs 到 b1-9bz-B-8 终态契约。
import io, re

P = 'tests/react-stage1c3-smoke.mjs'
s = io.open(P, encoding='utf-8', newline='').read()
nl = '\r\n' if '\r\n' in s else '\n'
t = s.replace('\r\n', '\n')

# 1) 头注释
t = t.replace(''' *  1. 契约：__eagleCoreFns 14 函数在位''',
              ''' *  1. 契约（b1-9bz-B-8 改写）：fns 表 / shimFnsBridge 已退役（__eagleCoreFns 与
 *     __eagleShimFnsBridge 均不再存在），machinery 挂载面承接 scope 函数供给，
 *     测试观测改走窄口径钩子 __eaglePorts（同对象引用，无运行期供给语义）''')
t = t.replace(''' *  2. 路由证明：哨兵替换 scope.cancelAllTasks → callScope('cancelAllTasks') 不触哨兵但
 *     队列清空（core 命中）+ ipc 'cancel.all' spy''',
              ''' *  2. 直调证明：__eaglePorts.cancelAllTasks() 清空队列 + ipc 'cancel.all' spy''')
t = t.replace(''' *  4. bundle 后备：未移植函数（如 clickNode）经 callScope 仍走 scope''',
              ''' *  4. 表退役终态：TABLE-only 名（如 clickNode）不再由 scope 面供给''')

# 2) c3-contract 断言整体替换
i = t.find("  await assertExpr('c3-contract'")
end_marker = "  })()`);"
j = t.find(end_marker, i) + len(end_marker)
assert i > 0 and j > len(end_marker), 'c3-contract 未定位'
NEW = """  await assertExpr('c3-contract', `(() => {
    // b1-9bz-B-8 终态：controllerFns fns 表与 shimFnsBridge 退役，消费面全部直 import。
    //   ① 表 / 桥的全局痕迹必须消失；
    //   ② 窄口径观测钩子 __eaglePorts 在位（同对象引用，无运行期供给语义）；
    //   ③ machinery 挂载面承接 scope 函数供给（applyDataMachineryScope 写入的名字仍在）。
    const ports = window.__eaglePorts;
    const need = ['cancelAllTasks', 'changeOrderBy', 'switchGridLayout', 'cleanSelected'];
    return window.__eagleCoreFns === undefined
      && window.__eagleShimFnsBridge === undefined
      && !!ports && need.every((k) => typeof ports[k] === 'function')
      && typeof window.$bodyScope.calculateImageBinding === 'function'
      && typeof window.$bodyScope.rebindRefresh === 'function'
      && typeof window.$bodyScope.updateSidebarList === 'function';
  })()`);"""
t = t[:i] + NEW + t[j:]

# 3) __eagleCoreFns.X() -> __eaglePorts.X()
n = len(re.findall(r'window\.__eagleCoreFns', t))
t = t.replace('window.__eagleCoreFns', 'window.__eaglePorts')

# 4) c3-fallback-path 整行替换
lines = t.split('\n')
hit = [k for k, l in enumerate(lines) if "'c3-fallback-path'" in l]
assert len(hit) == 1, 'fallback-path 行数异常: %d' % len(hit)
k = hit[0]
lines[k:k + 1] = [
    '  // b1-9bz-B-8 终态：clickNode 属 TABLE-only（无 machinery 挂载），表退役后不再由',
    '  // scope 面供给；组件侧已改为直 import（Sidebar.tsx:6）。',
    "  await assertExpr('c3-table-retired', `typeof window.$bodyScope.clickNode !== 'function'`);",
]
t = '\n'.join(lines)

io.open(P, 'w', encoding='utf-8', newline='').write(t.replace('\n', nl))
print('stage1c3 改写完成；__eagleCoreFns->__eaglePorts %d 处' % n)
