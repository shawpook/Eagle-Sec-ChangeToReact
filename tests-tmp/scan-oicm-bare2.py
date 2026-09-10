# -*- coding: utf-8 -*-
# 全量扫描 openItemContextMenu 移植体内的裸标识符，对照供给清单分类。
import io, re

CF = 'src/app/react/core/controllerFns.ts'
with io.open(CF, 'r', encoding='utf-8') as f:
    cf_lines = f.readlines()

# 定位新入口范围
start = next(i for i, l in enumerate(cf_lines) if 'openItemContextMenu（bundle 43452-44603' in l)
end = next(i for i, l in enumerate(cf_lines) if i > start and 'fns["addToRecentFolders"]' in l)
seg = cf_lines[start:end]

# 供给清单
with io.open('tests-tmp/b49q-openItemContextMenu-src.txt', 'r', encoding='utf-8') as f:
    pass

SUPPLIED_WINDOW = set('''eagle EagleConfig FONT_TYPES VIDEO_TYPES AUDIO_TYPES SPECIAL_TYPES swal _ $ i18n preferences
process ipcRenderer electronLog electron settings require module FileUrlHelper RecentFileManager
ayncsImagesChange hiddenByCurrentFilter removePlayingAudios cleanupBoxHoverPreview openWithApplicationPath
ayncsImagesGeneratePalette ReverseImageSearch getHashID guid throttle debounce fuzzy_match fuzzy_score
cloneTree decodeBase64Image getRawPath getThumbnailPath getExt ayncsImagesRemove updateWindowProgressBar
startAPIServer stopAPIServer checkBackgroundHeartbeat ContextMenu URL_MODULE currentWindow appRoot
path fs os crypto child_process localStorage document window navigator setTimeout setInterval
clearTimeout clearInterval requestAnimationFrame console JSON Math Object Array String Number Boolean
Date Promise Promise Set Map RegExp Error TypeError parseInt parseFloat isNaN encodeURIComponent
decodeURIComponent structuredClone AbortController fetch Blob URL alert confirm prompt location
history $bodyScope $$electronIpc __eagleIpc $electronIpc eagleDesktop angular pluginModule
hashtags vocabularies'''.split())

SUPPLIED_MODULE = set('''s event target args getScope initLinkVars getBodyScope getFilter getTimeout machineryGetFilter
$timeout $filter EagleConfig DATE_1_DAY DATE_2_DAY DATE_7_DAY DATE_30_DAY DATE_90_DAY DATE_365_DAY
VIDEO_TYPES AUDIO_TYPES FONT_TYPES SPECIAL_TYPES emojiRegex fs remainingFilenameLength sanitize
currentWindow electronSettings electronLog ipcRenderer i18n preferences FixUtils dialog systemPreferences
URL_MODULE ContextMenu renameImages enableImageNameEditable _req IPCHelper coreFnsCache
machineryGetVideoPlayer machineryCalcRotateDegree machineryGetFolderParentChilder machineryGetArroundBox
machineryGetAncestorSmartFolders machineryCalcuteContainFolders machineryToggleAllFolders
machineryToggleCurrentLevelFolders machineryToggleAllSmartFoldersInner machineryToggleCurrentLevelSmartFoldersInner
machineryFilterSidebarItem machineryGetFilter FileUrlHelper coreEagle
getRecentFolders openItemLocation removePlayingAudios'''.split())

KEYWORDS = set('''if for while return const let var new typeof instanceof function switch case break continue
else try catch finally throw delete void in of do this true false null undefined async await yield
push filter map reduce slice reverse find findIndex sort some every includes indexOf join concat splice
forEach shift unshift pop length toString call apply bind then import export from as class extends
static get set constructor super has'''.split())

found = {}
for idx, line in enumerate(seg, start=start + 1):
    code = re.sub(r"'[^']*'|\"[^\"]*\"|`[^`]*`", '""', line)   # 抹掉字符串
    code = code.split('//')[0]
    for m in re.finditer(r'(?<![\w.$"\'])([a-zA-Z_$][\w$]*)', code):
        name = m.group(1)
        if name in KEYWORDS or name in SUPPLIED_WINDOW or name in SUPPLIED_MODULE:
            continue
        # 前一个字符是 . → 属性访问，跳过
        pos = m.start()
        if pos > 0 and code[pos - 1] == '.':
            continue
        # 形参/局部量粗判：本行有 `const name` / `var name` / `let name` 或是 for-of/in
        if re.search(r'(const|let|var)\s+' + re.escape(name) + r'\b', code):
            continue
        found.setdefault(name, []).append(idx)

for name, lns in sorted(found.items()):
    print(f'{name}: {len(lns)}x {lns[:8]}')
