# b1-9bz-B-8 / 第二波：去掉「scope 存在性守卫」。
# 表退役后，TABLE-only 名在 scope 面上不再存在，`s.X && X(...)` / `typeof s.X === 'function'`
# 这类守卫会**短路**掉紧随其后的直调 —— 守卫本身已成为错误前提（直 import 恒可用）。
import io, os, re

ROOT = os.path.abspath('.')
JOBS = [
    ('src/app/react/components/filter/FilterItems.tsx', [
        ("s.filterWithColor && filterWithColor(", "filterWithColor("),
        ("s.filterWithHexColor && filterWithHexColor(", "filterWithHexColor("),
        ("s.calcuteContainFolders && calcuteContainFolders(", "calcuteContainFolders("),
        ("s.filterWithFolder && filterWithFolder(", "filterWithFolder("),
        ("s.excludeWithFolder && excludeWithFolder(", "excludeWithFolder("),
        ("s.filterWithTag && filterWithTag(", "filterWithTag("),
        ("s.excludeWithTag && excludeWithTag(", "excludeWithTag("),
    ]),
    ('src/app/react/components/filter/FilterItems2.tsx', [
        ("s.toggleExtFilterExclude && toggleExtFilterExclude(", "toggleExtFilterExclude("),
        ("s.toggleExtFilter && toggleExtFilter(", "toggleExtFilter("),
        ("s.calculateDateFilter && calculateDateFilter();", "calculateDateFilter();"),
        ("s.getDateFilterCountsArray && getDateFilterCountsArray(", "getDateFilterCountsArray("),
        ("s.filterWithColor && filterWithColor(", "filterWithColor("),
        ("s.hexToRGB && hexToRGB(", "hexToRGB("),
        ("s.openFilterAddContextMenu && openFilterAddContextMenu(", "openFilterAddContextMenu("),
        ("s.resetFilter && resetFilter();", "resetFilter();"),
    ]),
    ('src/app/react/components/grid/BoxList.tsx', [
        ("if (item && typeof s.select === 'function') select(e, item);", "if (item) select(e, item);"),
        ("s.cleanSelected && cleanSelected(e)", "cleanSelected(e)"),
    ]),
    ('src/app/react/components/inspector/Inspector.tsx', [
        ("if (typeof s.filterWithColor === 'function') filterWithColor(palette.color);",
         "filterWithColor(palette.color);"),
    ]),
    ('src/app/react/components/shell/BodyBindings.tsx', [
        ("if (typeof s.hoverShowSidebar === 'function') hoverShowSidebar($event);",
         "hoverShowSidebar($event);"),
        ("if (typeof s.onSidebarResize === 'function') onSidebarResize(event, ui);",
         "onSidebarResize(event, ui);"),
    ]),
    ('src/app/react/components/shell/MiscContainers.tsx', [
        ("            if (typeof s.filterWithColor === 'function' && typeof s.hexToRGB === 'function') {\n"
         "              filterWithColor(hexToRGB(value));\n"
         "            }",
         "            filterWithColor(hexToRGB(value));"),
    ]),
    ('src/app/react/components/stage7/SmallPanels.tsx', [
        ("if (typeof s.switchGridLayout === 'function') switchGridLayout();", "switchGridLayout();"),
        ("if (typeof s.switchJustifiedLayout === 'function') switchJustifiedLayout();", "switchJustifiedLayout();"),
        ("if (typeof s.switchSquareLayout === 'function') switchSquareLayout();", "switchSquareLayout();"),
        ("if (typeof s.switchListLayout === 'function') switchListLayout();", "switchListLayout();"),
        ("if (typeof s.changeOrderBy === 'function') changeOrderBy(", "changeOrderBy("),
    ]),
    ('src/app/react/components/stage7/TagManager.tsx', [
        ("if (typeof s.onTagSidebarResize === 'function') onTagSidebarResize(event, ui);",
         "onTagSidebarResize(event, ui);"),
    ]),
    ('src/app/react/components/toolbar/Toolbar.tsx', [
        ("if (typeof s.searchFocus === 'function') searchFocus(e);", "searchFocus(e);"),
    ]),
    ('src/app/react/components/detail/detailHooks.ts', [
        ("s.onDetailClick && onDetailClick(event)", "onDetailClick(event)"),
    ]),
    ('src/app/react/components/stage7/QuickSearchModal.tsx', [
        ("if (s && typeof s.closeQuickSearch === 'function') scopeApply(s, (sc: any) => sc.closeQuickSearch());",
         "if (s) scopeApply(s, () => closeQuickSearch());"),
    ]),
    ('src/app/react/store/inspectorState.ts', [
        ("folderFullPath[id] = typeof scope.getFolderFullPath === 'function' ? String(getFolderFullPath(folderMappings[id]) || '') : '';",
         "folderFullPath[id] = String(getFolderFullPath(folderMappings[id]) || '');"),
    ]),
]

for file, pairs in JOBS:
    p = os.path.join(ROOT, file)
    s = io.open(p, encoding='utf-8', newline='').read()
    nl = '\r\n' if '\r\n' in s else '\n'
    t = s.replace('\r\n', '\n')
    n = 0
    for a, b in pairs:
        k = t.count(a)
        if k == 0:
            raise SystemExit('未匹配 %s :: %s' % (file, a[:70]))
        t = t.replace(a, b)
        n += k
    io.open(p, 'w', encoding='utf-8', newline='').write(t.replace('\n', nl))
    print('  %-52s 修 %d 处' % (file.replace('src/app/react/', ''), n))

# QuickSearchModal 补 closeQuickSearch import
p = os.path.join(ROOT, 'src/app/react/components/stage7/QuickSearchModal.tsx')
s = io.open(p, encoding='utf-8', newline='').read()
nl = '\r\n' if '\r\n' in s else '\n'
t = s.replace('\r\n', '\n')
m = re.search(r"^import \{([^}]*)\} from '\.\./\.\./core/filterDomain';$", t, re.M)
assert m, 'filterDomain import 行未找到'
names = sorted(set([x.strip() for x in m.group(1).split(',') if x.strip()] + ['closeQuickSearch']))
t = t[:m.start()] + "import { %s } from '../../core/filterDomain';" % ', '.join(names) + t[m.end():]
io.open(p, 'w', encoding='utf-8', newline='').write(t.replace('\n', nl))
print('  QuickSearchModal import 已补')
print('第二波完成')
