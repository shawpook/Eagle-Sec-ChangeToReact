#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""b1-9bz-B-2：DetailToolbar 34 点 / ListRegion 6 点的本地 call() 字符串派发 → 直调。

两文件的本地 call 都是 **scope 面直取**（scope[fn]），不像 hooks 的 callScope 表优先，故：
  MACHINERY 名 → callM(machineryXxx)：scope 面 s.NAME 就是 (…)=>machineryXxx(s,…)
  TABLE_ONLY 名 → call(落点导出)：scope 面由 shimFnsBridge 挂表项指针，同对象
  NONE 名     → callF('name')：表/machinery 都无供给，保留 scope 面回退（旧 bundle 或空转）
参数语义逐字保留（preArgs 优先、不传事件；事件为 undefined 时不传参；非函数时空转）。
用法：python tests-tmp/bz-b-detail.py
"""
import io
import os
import re

ROOT = os.getcwd()
DT = os.path.join(ROOT, 'src/app/react/components/detail/DetailToolbar.tsx')
LR = os.path.join(ROOT, 'src/app/react/components/shell/ListRegion.tsx')

DT_MACH = {
    'cancelCrop': 'machineryCancelCrop',
    'leaveDetailMode': 'machineryLeaveDetailMode',
    'nextGifFrame': 'machineryNextGifFrame',
    'openPluginPanel': 'machineryOpenPluginPanel',
    'prevGifFrame': 'machineryPrevGifFrame',
    'selectNext': 'machinerySelectNext',
    'selectPrev': 'machinerySelectPrev',
    'toggleAll': 'machineryToggleAll',
    'toggleCommentMode': 'machineryToggleCommentMode',
    'toggleZoom': 'machineryToggleZoom',
    'zoomActual': 'machineryZoomActual',
}
DT_TABLE = ['flipImage', 'flipVideo', 'maximize', 'openFileWithDefault', 'openItemContextMenu',
            'openRatioContextMenu', 'rotateImage', 'rotateVideo', 'saveCrop', 'toggleGifPlay']
DT_NONE = ['cropImage', 'openGifContextMenu', 'openSidebarMenu', 'toggleGifPlayerMode', 'toggleRatioContextMenu']

OLD_CALL = """const call = (fn: string, ...preArgs: any[]) => (e?: any) =>
  scopeApply(getBodyScope(), (scope) => {
    if (typeof scope[fn] === 'function') scope[fn](...(preArgs.length ? preArgs : e === undefined ? [] : [e]));
  });"""

NEW_CALL = """/* b1-9bz-B：原 `call(fn: string)` 字符串派发退役。三形态按「scope 面当前由谁供给」分流
   （本文件的 call 是 scope 面直取，不是 hooks 那种表优先）：
     call  —— 落点导出（表项指针 = 同对象）
     callM —— machinery 导出（s.NAME 由 applyDataMachineryScope 挂 machinery 包装）
     callF —— 表与 machinery 均无供给，保留 scope 面回退（命中旧 bundle 或空转，不得删调用点）
   参数语义逐字保留：preArgs 优先且不传事件；e 为 undefined 时不传参；目标非函数时空转。 */
const callArgs = (preArgs: any[], e: any) => (preArgs.length ? preArgs : e === undefined ? [] : [e]);
const call = (fn: (...a: any[]) => any, ...preArgs: any[]) => (e?: any) =>
  scopeApply(getBodyScope(), () => {
    if (typeof fn === 'function') fn(...callArgs(preArgs, e));
  });
const callM = (fn: (...a: any[]) => any, ...preArgs: any[]) => (e?: any) =>
  scopeApply(getBodyScope(), (s: any) => {
    if (typeof fn === 'function') fn(s, ...callArgs(preArgs, e));
  });
const callF = (name: string, ...preArgs: any[]) => (e?: any) =>
  scopeApply(getBodyScope(), (s: any) => {
    if (s && typeof s[name] === 'function') s[name](...callArgs(preArgs, e));
  });"""

DT_IMPORTS = [
    "import { flipImage, rotateImage, saveCrop } from '../../services/imageOpsService';",
    "import { flipVideo, rotateVideo, toggleGifPlay } from '../../services/mediaService';",
    "import { maximize } from '../../core/miscDomain';",
    "import { openFileWithDefault } from '../../core/itemDomain';",
    "import { openItemContextMenu } from '../../services/itemMenuService';",
    "import { openRatioContextMenu } from '../../services/miscMenuService';",
    "import { machineryCancelCrop, machineryLeaveDetailMode, machineryNextGifFrame, machineryOpenPluginPanel, machineryPrevGifFrame, machinerySelectNext, machinerySelectPrev, machineryToggleAll, machineryToggleCommentMode, machineryToggleZoom, machineryZoomActual } from '../../core/dataMachinery';",
]

LR_OLD = """    const call = (fn: string) => (e: Event) => {
      const s = getBodyScope();
      if (s && typeof s[fn] === 'function') s[fn](e);
    };"""

LR_NEW = """    /* b1-9bz-B：原 `call(fn: string)` 字符串派发退役（scope 面直取，同 DetailToolbar）。
       onDragEnter/Leave/Over/MouseMove 四个在表与 machinery 均无供给，保留 scope 面回退。 */
    const call = (fn: (...a: any[]) => any) => (e: Event) => {
      const s = getBodyScope();
      if (s && typeof fn === 'function') fn(e);
    };
    const callM = (fn: (...a: any[]) => any) => (e: Event) => {
      const s = getBodyScope();
      if (s && typeof fn === 'function') fn(s, e);
    };
    const callF = (name: string) => (e: Event) => {
      const s = getBodyScope();
      if (s && typeof s[name] === 'function') (s[name] as any)(e);
    };"""

LR_IMPORTS = [
    "import { openFileListContextMenu } from '../../services/miscMenuService';",
    "import { machineryOnDropContainer } from '../../core/dataMachinery';",
]


def add_imports(src, imports, anchor):
    assert src.count(anchor) == 1, anchor
    return src.replace(anchor, anchor + '\n' + '\n'.join(imports))


def main():
    # ── DetailToolbar ──
    s = io.open(DT, encoding='utf-8').read()
    assert s.count(OLD_CALL) == 1, 'DetailToolbar call def not found'
    s = s.replace(OLD_CALL, NEW_CALL)
    total = 0
    for name, mach in DT_MACH.items():
        pat = "call('%s'" % name
        n = s.count(pat)
        assert n >= 1, 'missing site ' + name
        s = s.replace(pat, "callM(%s" % mach)
        total += n
    for name in DT_TABLE:
        pat = "call('%s'" % name
        n = s.count(pat)
        assert n >= 1, 'missing site ' + name
        s = s.replace(pat, "call(%s" % name)
        total += n
    for name in DT_NONE:
        pat = "call('%s'" % name
        n = s.count(pat)
        assert n >= 1, 'missing site ' + name
        s = s.replace(pat, "callF('%s'" % name)
        total += n
    left = re.findall(r"call\('[A-Za-z]+'", s)
    assert not left, 'unmapped sites: %s' % left
    s = add_imports(s, DT_IMPORTS, "import { getBodyScope, scopeApply } from '../../core/appCore';")
    io.open(DT, 'w', encoding='utf-8').write(s)
    print('DetailToolbar: %d sites rewritten' % total)

    # ── ListRegion ──
    s = io.open(LR, encoding='utf-8').read()
    assert s.count(LR_OLD) == 1, 'ListRegion call def not found'
    s = s.replace(LR_OLD, LR_NEW)
    for name, repl in [('openFileListContextMenu', 'call(openFileListContextMenu'),
                        ('onDropContainer', 'callM(machineryOnDropContainer')]:
        pat = "call('%s'" % name
        assert s.count(pat) == 1, 'ListRegion site ' + name
        s = s.replace(pat, repl)
    for name in ['onDragEnterContainer', 'onDragLeaveContainer', 'onDragOverContainer', 'onMouseMoveContainer']:
        pat = "call('%s'" % name
        assert s.count(pat) == 1, 'ListRegion site ' + name
        s = s.replace(pat, "callF('%s'" % name)
    left = re.findall(r"call\('[A-Za-z]+'", s)
    assert not left, 'unmapped: %s' % left
    s = add_imports(s, LR_IMPORTS, "import { getBodyScope } from '../../core/appCore';")
    io.open(LR, 'w', encoding='utf-8').write(s)
    print('ListRegion: 6 sites rewritten')


if __name__ == '__main__':
    main()
