/**
 * R4 守卫：scope 字段「零字符串键」收敛台账（闭合分类）。
 *
 * R4 的分域收敛是把 `writeScopeField('<字段>', v)` 换成该域的具体写点（store 导出的具名
 * action）。本项把**每一处**字符串键写入强制归类，使「还剩多少」成为可测的账，而不是靠人记得：
 *
 *   1. `CONVERGED` —— 已收敛域：字段必须走具名写点；再出现字符串键即失败（防回退）。
 *   2. `LEGACY_SCOPE_SLOTS` —— 旧 scope **挂载槽**：写入的是函数/单例/命名空间对象/常量，
 *      属 R6 退役对象而非 R4 数据字段；在此显式登记（含理由），并校验登记项仍有写入点
 *      （防止清单变成僵尸账）。
 *   3. `PENDING_DATA_FIELDS` —— 尚未收敛的数据字段台账（R4 待办）。**未登记即失败**：
 *      新增的字符串键数据写入必须要么收敛、要么说明为何是挂载槽。
 *   4. 写入值是函数字面量/箭头函数的站点必须落在 `LEGACY_SCOPE_SLOTS`——挡住新引入的
 *      「字符串函数挂载」（R4 明令删除的面）。
 *
 * 判定时先剥离注释，避免把文档里出现的示例写法误判成真实调用。
 */
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(import.meta.dirname, '..');
const reactRoot = path.join(projectRoot, 'src/app/react');

/** 已收敛域：字段 → 提供具名写点的模块。具名写点约定 `write` + 字段名首字母大写。 */
const CONVERGED = {
  selection: {
    module: 'src/app/react/store/selectionState.ts',
    fields: [
      'selected', 'current', 'lastSelectedIndex',
    ],
  },
  body: {
    module: 'src/app/react/store/bodyState.ts',
    fields: [
      'currentFocus', 'viewMode', 'isLoading', 'layout', 'isDetailMode',
      'isCropMode', 'isMaximize', 'isHideSidebar', 'smoothZoomDone', 'isInlineMode',
      'layoutOptions', 'isHideNavigator', 'removeProgress', 'isCleaningTrash', 'theme',
      'isSlideshowMode', 'isCommentMode', 'isGrayscaleMode', 'platform',
    ],
  },
  folder: {
    module: 'src/app/react/store/folderState.ts',
    fields: [
      'currentFolder', 'currentSmartFolder', 'startCursor', 'folders', 'currentFolderChildren',
      'tags', 'smartFolders', 'folderList', 'navigationHistory', 'navigationHistoryIndex',
    ],
  },
  list: {
    module: 'src/app/react/store/listState.ts',
    fields: [
      'keyword', 'listDone', 'unfiledCount', 'untaggedCount', 'showSubfolderContent',
      'isHideSubFolder', 'currentOrderBy', 'currentSortIncrease',
    ],
  },
  item: {
    module: 'src/app/react/store/itemState.ts',
    fields: [
      'raw', 'shuffle', 'trash', 'selectedMappings', 'selectedFolderMappings',
      'lastItemStates', 'images', 'allData', 'all', 'folderMappings',
      'lockedImages', 'duplicateMappings', 'itemMappings', 'smartFolderMappings', 'modifiedMappings',
    ],
  },
  misc: {
    module: 'src/app/react/store/miscRawState.ts',
    fields: [
      'currentTagGroup', 'selectedTags', 'tagViewMode', 'tagViewModeName', 'hexColor',
      'isGifReady', 'subFolders', 'selectedSmartFolders', 'selectedSmartFoldersMappings', 'selectedFolders',
      'selectedFoldersMappings', 'selectedFolder', 'lastIndex', 'boxContianerWidth', 'boxContianerHeight',
      'zoomFitSize', 'lastZoomMode', 'sliderZoomRatio', 'isRotating', 'showLargeImage',
      'showDetailImage', 'useMpvPlayer', 'gifPlayer', 'usingGifPlayer', 'gifUpadteInterval',
      'ratio', 'commentRect', 'lastImageHeight', 'contentFilterCache', 'isPreviewing',
      'currentFolderPath', 'currentId', 'currentTag', 'imagesDir', 'libraryName',
      'libraryImagesPath', 'libraryPath', 'libraryModificationTime', 'libraryLoadedProgress', 'libraryHistory',
      'rootDir', 'quickAccess', 'draggedQuickAccess', 'sidebarIndex', 'sidebarList',
      'isExpandFolder', 'isExpandSmartFolder', 'isExpandQuickAccess', 'isHideMainNav', 'smartFolderList',
      'folderKeyword', 'tagKeyword', 'containFolders', 'containTags', 'preelaborations',
      'keywords', 'keywords_cn', 'keywords_tw', 'keyword_cn', 'keyword_tw',
      'isKeywordCN', 'isKeywordTW', 'isEnglish', 'isContainAlphabet', 'searchRegexGroup',
      'globalKeywords', 'historySearchKeywords', 'hsks', 'keywordSuggestions', 'keywordDebounce',
      'showSuggestions', 'page', 'colorDistancesMap', 'searchIndex', 'Registration',
      'addImageStartTime', 'addImageTimeLeftInSeconds', 'availableHistoryTags', 'canUseTouchID', 'currentProcessCount',
      'currentTrashRemoved', 'downloadQueueLength', 'duplicateGroupings', 'duplicateQueue', 'duplicateTarget',
      'duplicates', 'errorList', 'filtereds', 'finishGenerateQueue', 'finishQueue',
      'initDetailMode', 'isItemBindCalculated', 'isLibrarySaving', 'isOpenWebpagePanel', 'isSearchScopeAnnotation',
      'isSearchScopeExt', 'isSearchScopeFolderDesc', 'isSearchScopeFolderName', 'isSearchScopeName', 'isSearchScopeNote',
      'isSearchScopeTag', 'isSearchScopeUrl', 'isUILoaded', 'lastProcessCount', 'lastSelectedTag',
      'lastestAddItem', 'len', 'listLayoutSettings', 'listMetaType', 'loadMoreDisable',
      'metadataQueueLength', 'newGroupName', 'openWithInfo', 'orderBy', 'orderByName',
      'paletteQueueDelay', 'paletteQueueLength', 'paletteQueuePaused', 'progress', 'regenerateThumbnailQueue',
      'saveFolderDebounceTimeout', 'selectingTags', 'showAnnotation', 'showFileExtension', 'showFileExtensionLabel',
      'showMetas', 'showNTFSWarning', 'showName', 'showOriginalImageWhenLarge', 'showSlowNotify',
      'sortIncrease', 'tagsSuggestion', 'trashRemoved', 'unlockPassword', 'untagged',
      'uploadQueue', 'usingCache', 'winMenu',
    ],
  },
  toast: {
    module: 'src/app/react/store/toastState.ts',
    fields: [
      'localhostError', 'libraryPathPermissionError',
    ],
  },
  layout: {
    module: 'src/app/react/store/layoutState.ts',
    fields: [
      'containerSize', 'imageSize',
    ],
  },
  lock: {
    module: 'src/app/react/store/lockState.ts',
    fields: [
      'isAppLocked',
    ],
  },
  preferences: {
    module: 'src/app/react/store/preferencesState.ts',
    fields: [
      'trialRemain',
    ],
  },
};

/**
 * 旧 scope 挂载槽（R6 退役面）：写的是**函数/单例/命名空间对象/常量**，不是业务数据字段。
 * 格式 `[字段名, 归类理由]`。理由只写「它是什么」，不写迁移史。
 */
const LEGACY_SCOPE_SLOTS = [
  // 面板派发目标（SmallPanels / 搜索范围菜单 / 缩放滑条 onChange 的字符串派发面）
  ['changeSmartFolderName', 'fn 挂载（Sidebar RenameInput 经 scope[commitFn] 派发）'],
  ['changeSortIncrease', 'fn 挂载（排列面板派发）'],
  ['toggleShowOriginalImageWhenLarge', 'fn 挂载（排列面板派发）'],
  ['showListName', 'fn 挂载（列表列头开关）'],
  ['showListMetas', 'fn 挂载（列表列头开关）'],
  ['showListAnnotation', 'fn 挂载（列表列头开关）'],
  ['showListExtension', 'fn 挂载（列表列头开关）'],
  ['showListExtensionLabel', 'fn 挂载（列表列头开关）'],
  ['toggleSidebar', 'fn 挂载（侧栏开合）'],
  ['switchLayoutOtpions', 'fn 挂载（视图切换）'],
  ['createLibrary', 'fn 挂载（库创建入口）'],
  ['importLibrary', 'fn 挂载（库导入入口）'],
  ['refresh', 'fn 挂载（列表刷新入口）'],
  ['openSearchScopeMenu', 'fn 挂载（搜索范围下拉）'],
  ['onListSizeChange', 'fn 挂载（缩放滑条 onChange）'],
  ['boxListSizeChange', 'fn 挂载（缩放滑条 onChange）'],
  ['changeFolderName', 'fn 挂载（Sidebar RenameInput 派发）'],
  ['openLibrary', 'fn 挂载（库切换入口）'],
  // 通知 / 键位 / 懒加载单例
  ['notify', 'fn 挂载（$rootScope.notify 等价实现，root/body 双写）'],
  ['mousetrap', '单例挂载（键位绑定实例）'],
  ['lazyLoadManager', '单例挂载（旧图片懒加载管理器）'],
  ['undo', '回调槽挂载（notify 的 restore 回调）'],
  // 标签管理器族：旧 scope 函数面（React 侧入口已直调模块导出）
  ['addGroupTags', 'fn 挂载（标签组右键菜单）'],
  ['addStarredTags', 'fn 挂载（标签组右键菜单）'],
  ['changeTagGroupColor', 'fn 挂载（标签组改色）'],
  ['createTagGroup', 'fn 挂载（标签组新建）'],
  ['filterWithTags', 'fn 挂载（按标签过滤）'],
  ['openStarredGroup', 'fn 挂载（标签组开合）'],
  ['openTagAllGroup', 'fn 挂载（标签组开合）'],
  ['openTagGroup', 'fn 挂载（标签组开合）'],
  ['openTagGroupContextMenu', 'fn 挂载（标签组右键菜单）'],
  ['openUnfiledGroup', 'fn 挂载（标签组开合）'],
  ['removeTagGroup', 'fn 挂载（标签组删除）'],
  ['renameTagGroup', 'fn 挂载（标签组改名）'],
  ['renameTagGroupBlur', 'fn 挂载（标签组改名输入框）'],
  ['renameTagGroupKeyup', 'fn 挂载（标签组改名输入框）'],
  ['selectTag', 'fn 挂载（标签选择）'],
  ['tagGroupDescriptionBlur', 'fn 挂载（标签组描述输入框）'],
  ['tagGroupDescriptionChange', 'fn 挂载（标签组描述输入框）'],
  ['tagGroupDescriptionFocus', 'fn 挂载（标签组描述输入框）'],
  ['toggleFilter', 'fn 挂载（筛选面板开合）'],
  // 文件夹落盘入口
  ['saveFolder', 'fn 挂载（直存版）'],
  ['saveFolderDebounce', 'fn 挂载（1s 防抖版）'],
  // 命名空间 / 常量 / 单例对象（写入的是共享单例本身，不是每次变更的状态）
  ['TagManager', '单例挂载（标签管理器实例）'],
  ['eagle', '命名空间挂载（$rootScope.eagle shim 等价）'],
  ['inspector', '单例挂载（eagle.inspector 同引用）'],
  ['options', '常量挂载（旧瀑布流分页配置）'],
  ['folderIcons', '常量挂载（文件夹图标清单）'],
  ['fixUtils', '单例挂载（fixutil 进度对话框状态载体，原地变更）'],
  ['gifViewer', '单例挂载（GIF 查看器实例）'],
  ['fontFolder', '全局路径挂载（字体目录，消费方读 window.fontFolder）'],
  ['removeSound', '单例挂载（音效对象）'],
  ['duplicateSound', '单例挂载（音效对象）'],
  ['errorSound', '单例挂载（音效对象）'],
  ['MAX_LIST_WIDTH', '常量挂载（列表宽度上限）'],
  ['MAX_DIMENSION', '常量挂载（图片尺寸上限）'],
  // 桩函数
  ['initMenu', 'fn 挂载（旧 shims no-op 桩）'],
];

/** R4 待办：仍以字符串键写入的数据字段。每收敛一批，从此表移入 `CONVERGED`。 */
const PENDING_DATA_FIELDS = [

];

function stripComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

/** 从 `(` 起匹配到配对的 `)`，返回其下标；失败返回 -1。 */
function matchParen(code, openIdx) {
  let depth = 0;
  let inStr = null;
  for (let i = openIdx; i < code.length; i += 1) {
    const ch = code[i];
    if (inStr) {
      if (ch === '\\') { i += 1; continue; }
      if (ch === inStr) inStr = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') { inStr = ch; continue; }
    if (ch === '(') depth += 1;
    else if (ch === ')') { depth -= 1; if (depth === 0) return i; }
  }
  return -1;
}

/** 取 `writeScopeField(` 的第 2 个实参文本（括号/字符串感知）。 */
function secondArg(code, callOpen) {
  let depth = 1;
  let i = callOpen + 1;
  let commaAt = -1;
  let inStr = null;
  for (; i < code.length; i += 1) {
    const ch = code[i];
    if (inStr) {
      if (ch === '\\') { i += 1; continue; }
      if (ch === inStr) inStr = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') { inStr = ch; continue; }
    if (ch === '(' || ch === '[' || ch === '{') depth += 1;
    else if (ch === ')' || ch === ']' || ch === '}') {
      depth -= 1;
      if (depth === 0) return commaAt < 0 ? null : code.slice(commaAt + 1, i).trim();
    } else if (ch === ',' && depth === 1 && commaAt < 0) commaAt = i;
  }
  return null;
}

/** 实参是否为函数值（function 字面量 / 箭头函数）。刻意保守：宁可漏判不误判。 */
function isFunctionValue(arg) {
  const a = arg.trim();
  if (/^(async\s+)?function\b/.test(a)) return true;
  if (/^[A-Za-z_$][\w$]*\s*=>/.test(a)) return true;
  if (a.startsWith('(')) {
    const close = matchParen(a, 0);
    if (close < 0) return false;
    const rest = a.slice(close + 1).trim();
    if (/^=>/.test(rest)) return true;
    if (/^:\s*[\w<>[\]|.,\s]*=>/.test(rest)) return true;
  }
  return false;
}

/** 从 store 文件收集已注册字段：`MIGRATED*` 数组字面量 + `migrateScopeFieldToStore('<名>'` 直调。 */
function collectRegisteredFields() {
  const registered = new Set();
  const storeDir = path.join(reactRoot, 'store');
  for (const entry of fs.readdirSync(storeDir)) {
    if (!entry.endsWith('.ts')) continue;
    const text = stripComments(fs.readFileSync(path.join(storeDir, entry), 'utf8'));
    for (const array of text.matchAll(/const\s+MIGRATED[A-Z_]*[^=]*=\s*\[([\s\S]*?)\]/g)) {
      for (const name of array[1].matchAll(/['"]([A-Za-z_$][\w$]*)['"]/g)) registered.add(name[1]);
    }
    for (const call of text.matchAll(/migrateScopeFieldToStore\(\s*['"]([A-Za-z_$][\w$]*)/g)) {
      registered.add(call[1]);
    }
  }
  return registered;
}

const files = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { walk(full); continue; }
    if (/\.(ts|tsx)$/.test(entry.name)) files.push(full);
  }
})(reactRoot);

const failures = [];
const ledger = new Map();
const siteFiles = new Map();
const functionSites = [];
const registered = collectRegisteredFields();
const legacyNames = new Set(LEGACY_SCOPE_SLOTS.map(([name]) => name));
const pendingNames = new Set(PENDING_DATA_FIELDS);
const actionName = (field) => `write${field[0].toUpperCase()}${field.slice(1)}`;
const convergedFields = Object.values(CONVERGED).flatMap((spec) => spec.fields);

if (pendingNames.size !== PENDING_DATA_FIELDS.length) {
  failures.push('PENDING_DATA_FIELDS 自身有重复项（台账必须逐字段唯一）');
}

for (const file of files) {
  const rel = path.relative(projectRoot, file).replace(/\\/g, '/');
  const code = stripComments(fs.readFileSync(file, 'utf8'));
  const re = /writeScopeField\(\s*(['"])([A-Za-z_$][\w$]*)\1/g;
  let match;
  while ((match = re.exec(code))) {
    const field = match[2];
    const arg = secondArg(code, re.lastIndex - 1);
    ledger.set(field, (ledger.get(field) || 0) + 1);
    if (!siteFiles.has(field)) siteFiles.set(field, new Set());
    siteFiles.get(field).add(rel);
    if (arg != null && isFunctionValue(arg)) functionSites.push(`${rel}: writeScopeField('${field}', <函数值>)`);

    if (convergedFields.includes(field)) {
      failures.push(`${rel}: writeScopeField('${field}') 属已收敛域，应改用具体写点`);
    } else if (!legacyNames.has(field) && !pendingNames.has(field)) {
      failures.push(
        `${rel}: 未分类的字符串键写入 '${field}'——或收敛为具名写点，或登记进 LEGACY_SCOPE_SLOTS（附理由）`,
      );
    }
    if (!registered.has(field) && !legacyNames.has(field)) {
      failures.push(`${rel}: 字段 '${field}' 未注册到 store，写入将落回退分支（应注册或登记为挂载槽）`);
    }
  }
}

// 函数值站点必须落在挂载槽清单里（挡住新引入的「字符串函数挂载」）
for (const site of functionSites) {
  const field = /writeScopeField\('([^']+)'/.exec(site)[1];
  if (!legacyNames.has(field)) {
    failures.push(`${site}: 函数值写入不在 LEGACY_SCOPE_SLOTS —— 禁止以字符串键挂载函数`);
  }
}

// 清单不得变成僵尸账：登记项必须仍有写入点
for (const [name, reason] of LEGACY_SCOPE_SLOTS) {
  if (!ledger.has(name)) failures.push(`LEGACY_SCOPE_SLOTS 的 '${name}'（${reason}）已无写入点，请从清单移除`);
}
for (const name of PENDING_DATA_FIELDS) {
  if (!ledger.has(name)) failures.push(`PENDING_DATA_FIELDS 的 '${name}' 已无写入点，请收敛进 CONVERGED 或从台账移除`);
}
for (const field of convergedFields) {
  if (ledger.has(field)) failures.push(`已收敛字段 '${field}' 仍以字符串键写入`);
}

// 写点必须真的存在于声明的模块里
for (const [domain, spec] of Object.entries(CONVERGED)) {
  const abs = path.join(projectRoot, spec.module);
  if (!fs.existsSync(abs)) { failures.push(`域 ${domain} 的写点模块缺失：${spec.module}`); continue; }
  const code = fs.readFileSync(abs, 'utf8');
  for (const field of spec.fields) {
    const action = actionName(field);
    if (!new RegExp(`export function ${action}\\s*\\(`).test(code)) {
      failures.push(`域 ${domain} 缺少导出的写点 ${action}（${spec.module}）`);
    }
  }
}

if (failures.length > 0) {
  console.error('SCOPE_CONVERGENCE_FAIL');
  for (const line of failures) console.error(`  ${line}`);
  process.exit(1);
}

console.log(
  `SCOPE_CONVERGENCE_OK：已收敛 ${convergedFields.length} 个字段 / ${Object.keys(CONVERGED).length} 个域，`
  + `挂载槽 ${LEGACY_SCOPE_SLOTS.length} 个（R6 退役面），无未分类字符串键写入`,
);
console.log(
  `  注册表 ${registered.size} 字段；R4 待办数据字段 ${PENDING_DATA_FIELDS.length} 个 / `
  + `${PENDING_DATA_FIELDS.reduce((acc, f) => acc + (ledger.get(f) || 0), 0)} 处写入点；`
  + `函数值站点 ${functionSites.length} 处（全部在挂载槽清单内）`,
);
const top = PENDING_DATA_FIELDS
  .map((f) => [f, ledger.get(f) || 0])
  .sort((a, b) => b[1] - a[1])
  .slice(0, 12)
  .map(([f, c]) => `${f}(${c})`)
  .join(' ');
console.log(`  写入点最多：${top} …`);
