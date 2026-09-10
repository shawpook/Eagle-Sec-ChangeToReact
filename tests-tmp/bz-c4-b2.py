#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""C-4 批次 2：detailHooks 的 $watch('theme') / $watch('current.id') → store 订阅。

theme 已源翻转到 bodyState（批次 1 之前就在 MIGRATED 列表）；
current.id 用 detailState（DetailViewer 已把 snapshot.current?.id 作 currentId 传入）。
zustand.subscribe 返回退订函数，与原 $watch 同名，cleanups 段零改动。
"""
import io

P = 'src/app/react/components/detail/detailHooks.ts'
s = io.open(P, encoding='utf-8', newline='').read()
nl = '\r\n' if '\r\n' in s else '\n'
t = s.replace('\r\n', '\n')

# 1) import
a = "import { useEffect } from 'react';"
b = "import { useEffect } from 'react';"
if "import { useBodyState }" not in t:
    t = t.replace("import { syncDetailFromScope } from '../../store/detailState';",
                  "import { syncDetailFromScope, useDetailState } from '../../store/detailState';\nimport { useBodyState } from '../../store/bodyState';", 1)

# 2) theme watch → bodyState 订阅
old_theme = """    const unwatchTheme = $bodyScope?.$watch('theme', function (newTheme: string, oldTheme: string) {
      if (newTheme !== oldTheme) {
        applyMpvTheme(newTheme);
      }
    });"""
new_theme = """    // b1-9bz-C-4：$watch('theme') → bodyState 订阅（theme 已源翻转，watcher 归零）
    let lastTheme = bodyScope?.theme;
    const unwatchTheme = useBodyState.subscribe((state: any) => {
      if (state.theme !== lastTheme) {
        lastTheme = state.theme;
        applyMpvTheme(state.theme);
      }
    });"""
assert old_theme in t, 'theme watch 未匹配'
t = t.replace(old_theme, new_theme, 1)

# 3) current.id watch → detailState 订阅
old_cur = """    const unwatchCurrent = getBodyScope()?.$watch('current.id', function (newId: string, oldId: string) {
      if (newId !== oldId && oldId !== undefined) {
        scopeApply(getBodyScope(), function (s) {
          s.useMpvPlayer = false;
          syncDetailFromScope();
        });
      }
    });"""
new_cur = """    // b1-9bz-C-4：$watch('current.id') → detailState 订阅（DetailViewer 传 snapshot.current?.id）
    let lastCurrentId: string | undefined = useDetailState.getState().snapshot.current?.id;
    const unwatchCurrent = useDetailState.subscribe((state: any) => {
      const id = state.snapshot.current?.id;
      if (id !== lastCurrentId && lastCurrentId !== undefined) {
        scopeApply(getBodyScope(), function (s: any) {
          s.useMpvPlayer = false;
          syncDetailFromScope();
        });
      }
      lastCurrentId = id;
    });"""
assert old_cur in t, 'current.id watch 未匹配'
t = t.replace(old_cur, new_cur, 1)

io.open(P, 'w', encoding='utf-8', newline='').write(t.replace('\n', nl))
print('detailHooks：2 处 watcher → store 订阅')
