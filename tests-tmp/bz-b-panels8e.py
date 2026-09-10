#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""b1-9bz-B-3：panels8e 本地 callScope（10 点 / 8 方法）→ controllerScope 直调。

panels8e 的 callScope 走的是 preferences 的 controllerScope（不是 body scope）：
    applyController((s) => s[fn] && s[fn](...args))
而 applyController 传入的 s 恒等于 controllerScope，故 `s[fn](...args)` 与
`controllerScope.fn(...args)` 同对象、同 this，notify 语义不变 → 零行为变化。
用法：python tests-tmp/bz-b-panels8e.py
"""
import io
import re

P = 'src/app/react/preferences/panels8e.tsx'

OLD_DEF = """function callScope(fn: string, ...args: any[]) {
  applyController((s: any) => s[fn] && s[fn](...args));
}"""

NEW_DEF = """/* b1-9bz-B：本地 callScope 字符串派发退役——8 个方法改为 controllerScope 直调。
   applyController 传入的 s 恒等于 controllerScope，故 `s[fn](...args)` 与
   `controllerScope.fn(...args)` 同对象同 this，notify 语义不变 → 零行为变化。 */"""

OLD_IMPORT = "import { applyController } from './controller';"
NEW_IMPORT = "import { applyController, controllerScope } from './controller';"


def main():
    src = io.open(P, encoding='utf-8').read()
    count = [0]

    def rep(m):
        count[0] += 1
        args = (m.group(2) or '').strip()
        return 'applyController(() => controllerScope.%s(%s))' % (m.group(1), args)

    out = re.sub(r"callScope\('([A-Za-z]+)'\s*(,[^()]*)?\)", rep, src)
    assert count[0] == 10, 'site count %d != 10' % count[0]
    assert out.count(OLD_DEF) == 1, 'callScope def not found'
    out = out.replace(OLD_DEF, NEW_DEF)
    assert out.count(OLD_IMPORT) == 1, 'import not found'
    out = out.replace(OLD_IMPORT, NEW_IMPORT)
    assert 'callScope(' not in out, 'residual callScope'
    io.open(P, 'w', encoding='utf-8').write(out)
    print('panels8e: %d sites rewritten' % count[0])


if __name__ == '__main__':
    main()
