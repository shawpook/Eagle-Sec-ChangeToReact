#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""C-4 批次 1：isCleaningTrash / removeProgress 源翻转到 bodyState，并改 EmptyTrashProgress 订阅。

原状：组件用 body.$watch('isCleaningTrash'|'removeProgress') 桥接 digest 变化。
改造：字段源翻转（scopeShim get/set 委托 store）→ 组件直接 useBodyState 订阅，watcher 归零。
"""
import io, re

# ── 1) bodyState：加字段 + 初始值 + 源翻转注册 ──
P = 'src/app/react/store/bodyState.ts'
s = io.open(P, encoding='utf-8', newline='').read()
nl = '\r\n' if '\r\n' in s else '\n'
t = s.replace('\r\n', '\n')

a = "  sidebarWidth: number;\n  inspectorWidth: number;\n}"
b = "  sidebarWidth: number;\n  inspectorWidth: number;\n  isCleaningTrash: boolean;\n  removeProgress: number;\n}"
assert a in t, 'interface 未匹配'
t = t.replace(a, b, 1)

a = "  sidebarWidth: 220,\n  inspectorWidth: 300,\n}));"
b = "  sidebarWidth: 220,\n  inspectorWidth: 300,\n  isCleaningTrash: false,\n  removeProgress: 0,\n}));"
assert a in t, '初始值未匹配'
t = t.replace(a, b, 1)

a = "  'isHideSidebar', 'isSlideshowMode', 'vibrancyEnabled',\n];"
b = "  'isHideSidebar', 'isSlideshowMode', 'vibrancyEnabled',\n  'isCleaningTrash', 'removeProgress',\n];"
assert a in t, 'MIGRATED 列表未匹配'
t = t.replace(a, b, 1)

io.open(P, 'w', encoding='utf-8', newline='').write(t.replace('\n', nl))
print('bodyState：字段 + 初始值 + 源翻转 已加')

# ── 2) ProgressDialogs：EmptyTrashProgress 改订阅 ──
P = 'src/app/react/components/stage7/ProgressDialogs.tsx'
s = io.open(P, encoding='utf-8', newline='').read()
nl = '\r\n' if '\r\n' in s else '\n'
t = s.replace('\r\n', '\n')

# import useBodyState
if 'useBodyState' not in t:
    anchor = "import { addToLibraryChannel, webpConvertStartChannel } from '../../global/bus';"
    assert anchor in t
    t = t.replace(anchor, anchor + "\nimport { useBodyState } from '../../store/bodyState';", 1)

old = """export function EmptyTrashProgress() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [, bump] = useState(0);
  const bumpAll = () => bump((v: number) => v + 1);
  const [isCleaning, setIsCleaning] = useState(false);
  const [removeProgress, setRemoveProgress] = useState(0);

  useEffect(() => {
    setHost(document.getElementById('eagle-empty-trash-progress-host'));
  }, []);

  useEffect(() => {
    const body = getBodyScope();
    if (!body) return;
    // 模板绑定 isCleaningTrash/removeProgress 解析到 body scope → $watch 桥接 digest 变化
    const off1 = body.$watch('isCleaningTrash', (v: any) => setIsCleaning(!!v));
    const off2 = body.$watch('removeProgress', (v: any) => {
      setRemoveProgress(Number(v) || 0);
      bumpAll();
    });
    setIsCleaning(!!body.isCleaningTrash);
    setRemoveProgress(Number(body.removeProgress) || 0);
    return () => {
      off1();
      off2();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host]);
"""
new = """export function EmptyTrashProgress() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  // b1-9bz-C-4：isCleaningTrash / removeProgress 已源翻转到 bodyState（scopeShim 读写委托
  // store）——组件直接订阅，原 body.$watch 桥接退役（watcher 归零）。
  const isCleaning = useBodyState((s) => s.isCleaningTrash);
  const removeProgress = useBodyState((s) => s.removeProgress);

  useEffect(() => {
    setHost(document.getElementById('eagle-empty-trash-progress-host'));
  }, []);
"""
assert old in t, 'EmptyTrashProgress 段未匹配'
t = t.replace(old, new, 1)

io.open(P, 'w', encoding='utf-8', newline='').write(t.replace('\n', nl))
print('ProgressDialogs：EmptyTrashProgress 已改订阅')
