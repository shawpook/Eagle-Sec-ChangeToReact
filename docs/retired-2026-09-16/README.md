# Retired legacy files (2026-09-16)

本目录保存 **M7 各批退役对象**在移出可发布源码树之前的内容。归档是**纯文档**，
不属于应用构建链，也不属于交付闭包——它**只**承担两件事：

1. 留下「为什么退役」与「替代落点在哪」的台账；
2. 保留**可恢复**的回滚基线。

归档路径一律等于**退役前的源路径**（`docs/retired-2026-09-16/<原路径>`），
移动一律用 `git mv` 完成，故历史连续、可 `git revert`。

---

## M7-1（2026-09-16）—— 四项低风险退役

| Archived path | Retired source path | Replacement / rationale |
|---|---|---|
| `src/app/js/services/url-state-service.js` | `src/app/js/services/url-state-service.js` | `src/app/react/core/bundleGlobals.ts` installs the active `window.UrlStateService` implementation. |
| `src/build/config.gypi` | `src/build/config.gypi` | Generated node-gyp configuration; the current build uses Vite and has no consumer. |
| `src/test/api-v2/test-snippets.js` | `src/test/api-v2/test-snippets.js` | Manual DevTools console script; API coverage now lives in `tests/**` and the real server routes. Kept here for its endpoint inventory. |
| `src/app/main.js` | `src/app/main.js` | Empty legacy Webpack shell; the active entry is `src/app/react/main.tsx`. |

---

## M7-2（2026-09-16，F02 / F20 · 用户决策 D24）—— tab-bar 退出发布清单 + 旧宿主隔离归档

### 1. `frontend/public/tab-bar.{js,css}` —— **退役（删除发布路径，保留归档）**

| Archived path | Retired source path | Replacement / rationale |
|---|---|---|
| `frontend/public/tab-bar.js` | `frontend/public/tab-bar.js` | **无替代实现，也不需要**——该功能在生产中当前就是空的（旧实现无加载入口，React 侧从未实现）。全仓逐项复核 0 命中加载入口，详见下节「退役取证」。 |
| `frontend/public/tab-bar.css` | `frontend/public/tab-bar.css` | 同上；无任何 `<link>` / `@import` 加载点。 |

**退役取证（M7-2 当场复核，不是照抄审计结论）**。检索模式与结果（全部 0 命中于**加载点**）：

| 检索面 | 模式 | 结果 |
|---|---|---|
| 全仓文本 | `tab-bar` / `tab_bar` / `tabbar` / `tabBar` / `TabBar` / `eagle-tab-bar` | 仅命中**文档、归档、门禁文件自身**；无一是加载点 |
| 页面 | `src/app/index.html` 的 `<script>` | 仅 `:254` 一条 `<script type="module" src="/src/app/react/main.tsx">` |
| 页面 | 全仓 `<script src=…>` / `<link href=…>` | 0 命中 tab-bar |
| 模块 | ESM `import` / `require(` / `importScripts` / `new Worker` / `import.meta.glob` | 0 命中 |
| 构建 | `frontend/vite.preview.config.mjs` 全文、`rollupOptions.input` | 0 命中（该文件里**没有**任何 tab-bar 注入逻辑） |
| 运行期 | `src/app/react/core/bundleGlobals.ts` 的「fetch 文本 → createElement('script')」通道 | 只有 3 个目标：`/vendor/eagle-match-rules.js`、`/vendor/eagle-zoom-helpers.js`、`/vendor/eagle-ga4mp.js`，**不含 tab-bar** |
| 宿主/后端 | `electron/**`、`backend/**`、`scripts/**`、根 `package.json` | 0 命中 |
| 动态拼接 | `'tab' + '-bar'` 之类 | 0 命中；另用可执行扩展名全仓裸扫（排除 `docs/`、`tests/`）复核，0 命中 |

**失真注释已订正**：两文件原第 3 行都写「注入路径: …（由 `vite.preview.config.mjs` 注入）」，
而该注入逻辑早已不存在。订正写进了**归档副本**本身（并因此改变了归档指纹，见下），
台账与门禁同步登记。

**唯一消费者**：`tests/tab-bar-closed-loop.mjs`。它原先是一份**与实现脱钩的孤儿 e2e**
（未登记任何套件；自己不注入 tab-bar.js，断言必然 30s 超时）。M7-2 未删除它，而是
**改造为负向门禁**（文件名保留为历史沿革，文件头已注明）：

```sh
node tests/tab-bar-closed-loop.mjs   # 真实仓库 + 真实产物 + 负向自证，11 项
```

**归档指纹（冻结基线）**：

| 归档路径 | md5 |
|---|---|
| `docs/retired-2026-09-16/frontend/public/tab-bar.js` | `e36afeae6a484c7d0dd0273e26a16184` |
| `docs/retired-2026-09-16/frontend/public/tab-bar.css` | `da01f6cd42e55e3ad06292e02c6e9036` |

指纹由 `tests/tab-bar-closed-loop.mjs` 的 `RETIRED_SOURCE` 常量守着：改动归档而不更新
常量 = 门禁变红。这是有意的摩擦——归档是回滚基线，必须冻结。

### 2. `src/run.js` / `src/run.jsc` / `src/main.jsc` —— **隔离归档（不删除）**

| Archived path | Retired source path | Replacement / rationale |
|---|---|---|
| `src/run.js` | `src/run.js` | 旧宿主启动入口（`bytenode` 加载两个 `.jsc`）。替代 = `electron/main.cjs`，由 `scripts/start-production.mjs:123` 真实启动。 |
| `src/run.jsc` | `src/run.jsc` | `src/run.js:4` 加载的主进程字节码。**内容不可读**，按任务书 §4「字节码不执行、不反推内部零依赖」，只隔离、不删。 |
| `src/main.jsc` | `src/main.jsc` | `src/run.js:5` 加载的字节码，同上。 |

**隔离取证（M7-2 当场复核）**：根 `package.json` 全部脚本、`scripts/*.mjs`、
`electron/main.cjs`、`electron/preload.cjs` 中 `bytenode` / `.jsc` / `src/run` **0 命中**
（`electron/main.cjs:1627` 只有一条**注释**提到「原 run.jsc 承载」）。三者**不进产物**
（`src/` 根级文件不在 `frontend/vite.preview.config.mjs` 的任何复制清单内）。

**已知遗留缺口（M7-2 未处理，如实登记）**：`src/package.json:12` 的 `"main": "run.js"`
在本次移动后**已悬空**。M7-2 按任务书要求**不动** `src/package.json`（它的处置依赖
`plugin/index.js:2989` 的耦合，属后续批次）。

### 3. 归档处标记：**非支持入口**

`docs/retired-2026-09-16/` 下的**任何文件都不是支持入口**：

- 它们**不在**应用构建链、产物闭包、发布路径中；
- 它们**不会被**任何 npm 脚本、suite 或验收流程执行；
- 重新启用它们**不是**「恢复配置」，而是一次需要重新取证 + 补替代 + 补测试的改造。

---

## 回滚方式

任一项均可单独回滚，互不影响：

```sh
# ① 按路径回滚（推荐，可精确到单个对象）
git mv docs/retired-2026-09-16/src/run.js src/run.js
git mv docs/retired-2026-09-16/src/run.jsc src/run.jsc
git mv docs/retired-2026-09-16/src/main.jsc src/main.jsc

# tab-bar 两项同理；回滚后必须同步：
#   - 恢复 tests/frontend-gate-manifest.mjs 的 FIRST_PARTY_SCRIPTS 登记
#     （否则 tests/typecheck.mjs 会报「图外运行脚本未登记」）
#   - 更新 tests/tab-bar-closed-loop.mjs 的 RETIRED_SOURCE / 负向断言
#   - 复跑 npm run build && node tests/dist-entry-check.mjs

# ② 整批回滚
git revert <M7-2 commit>
```

> 注意：tab-bar 归档副本的**注释已被订正**（原文为失真注释），故其内容与退役前的
> `frontend/public/tab-bar.{js,css}` **不完全逐字相同**——差异仅在文件头注释。
> 这正是 M7-2 的有意动作（任务书要求订正失真注释），diff 可在 M7-2 提交中逐字核对。

---

## M7-3（2026-09-16，登记驱动发布资产 + `src/my_modules` 退役）

### 1. 发布资产改为登记驱动

`frontend/publish-asset-manifest.mjs` 现在是构建与门禁共同 import 的单一事实源。
`frontend/vite.preview.config.mjs` 的 `closeBundle` 调用其中的
`copyPublishAssets()`；清单源不存在会抛错，复制/重定位失败也会让 `npm run build`
以非 0 退出。`src/my_modules` 不再作为父目录整树复制，而是 56 个顶层对象逐项登记；
退役后清单保留 8 项真实磁盘加载依赖，复制条目总数为 13。

**第 1 步前后产物逐文件对比原始结论：**

```text
BEFORE_FILES=2329
AFTER_FILES=2329
IDENTICAL=true
```

对比口径：对 `dist/frontend` 递归列出 `相对路径 TAB 字节数 TAB md5`，排序后逐行比较。
构建日志为 `BUILD_EXIT=0`，且不再出现 `skip (absent)`；最终日志为
`runtime assets copied (13 item(s)); 4/4 page(s) relocated`。

### 2. 退役判据与当场扫描

实际命令（工作区根）：

```powershell
rg -n "my_modules/" src/app backend frontend electron scripts plugins --glob '!**/node_modules/**'
rg -n "importScripts\(" src/app --glob '!**/node_modules/**'
rg -n "<script[^>]+src=" src/app --glob '*.html'
rg -n --no-heading "nativeRequire\s*\(" src/app backend frontend electron scripts plugins --glob '!**/node_modules/**'
rg -n --no-heading "loadOriginalModule\('/src/my_modules/|realBareModule\('junk', '/src/my_modules/" src/app --glob '!**/node_modules/**'
```

另用 Node 对 `src/my_modules` 做两层只读扫描：一层按条目反查外部
`my_modules/<name>` 路径引用，一层解析所有内部相对 `require/import` 与
`my_modules/<name>` 绝对路径，逐项找出跨条目依赖。

**真实磁盘加载点（最终必须保留）：**

```text
src/app/react/core/shim/moduleRegistry.ts:309:realBareModule('junk', '/src/my_modules/junk/index.js')
src/app/react/core/shim/moduleRegistry.ts:741:loadOriginalModule('/src/my_modules/pinyinlite/src/dict_full.js')
src/app/react/core/shim/moduleRegistry.ts:742:loadOriginalModule('/src/my_modules/pinyinlite/src/pinyin.js')
src/app/react/core/shim/moduleRegistry.ts:752:loadOriginalModule('/src/my_modules/chinese_convert/tw2cn.js')
src/app/react/core/shim/moduleRegistry.ts:753:loadOriginalModule('/src/my_modules/chinese_convert/cn2tw.js')
src/app/react/core/shim/moduleRegistry.ts:772:loadOriginalModule('/src/my_modules/tiny-pinyin/index.js')
src/app/react/core/shim/moduleRegistry.ts:775:loadOriginalModule('/src/my_modules/cartesian-product/index.js')
src/app/raw-viewer/index.html:8:<script ... src="../../my_modules/raw-parser/dcraw.js">
src/app/js/workers/bitmapWorker.js:474:importScripts("../../../my_modules/utif/UTIF.js")
src/app/js/workers/tifWorker.js:19:importScripts("../../../my_modules/utif/UTIF.js")
src/app/react/preferences/controller.ts:648:req(String(appRoot) + '/my_modules/is-network-drive')
```

`nativeRequire(...)` 的扫描结果没有落入 `src/my_modules`；可变参数调用只有
`moduleRegistry.ts:538-539` 的 `fs/path` 白名单，其它直接目标为 `electron`、
`node:fs`、`node:path`、`fs-extra`。

**内部跨条目引用原始输出（补充了审计报告漏掉的 2 条绝对路径依赖）：**

```text
src/my_modules/UPNG/index.js:8: pako = require("../pako") -> pako
src/my_modules/image-palette/index.js:4: require("../quantize") -> quantize
src/my_modules/image-palette/index.js:5: require("../readimage") -> readimage
src/my_modules/file-icon/index.js:7: require(appRoot + '/my_modules/url') -> url
src/my_modules/file-icon/index.js:60: require(appRoot + '/my_modules/extract-icon') -> extract-icon
src/my_modules/json-rest-light/lib/sever_proc.js:2: require(appRoot + '/my_modules/ua-parser') -> ua-parser
src/my_modules/model-thumbnail/index.js:5: require(appRoot + '/my_modules/url') -> url
src/my_modules/set-icon/index.js:40: require(appRoot + '/my_modules/sudo-prompt') -> sudo-prompt
```

### 3. 逐项归档台账（48 项）

下表每一项均使用 `git mv` 归档；共同依据是上面的当场扫描。`拦截 shim` 表示调用点
仍在，但 `moduleRegistry.ts` 在 `loadJsModule()` 之前返回替身，磁盘目录不会被求值；
`无外部命中` 表示上述条目反查输出为 `[NO_EXTERNAL_PATH_REFERENCE]`。
"归档路径"均为 `docs/retired-2026-09-16/src/my_modules/<条目>`；"回滚"均是把该归档
路径用 `git mv` 移回 `src/my_modules/<条目>`，并同步恢复发布清单登记。

完整路径与逐项回滚命令：

```powershell
git mv src/my_modules/UPNG docs/retired-2026-09-16/src/my_modules/UPNG                    # 回滚：git mv docs/retired-2026-09-16/src/my_modules/UPNG src/my_modules/UPNG
git mv src/my_modules/pako docs/retired-2026-09-16/src/my_modules/pako                    # 回滚：git mv docs/retired-2026-09-16/src/my_modules/pako src/my_modules/pako
git mv src/my_modules/image-palette docs/retired-2026-09-16/src/my_modules/image-palette  # 回滚：git mv docs/retired-2026-09-16/src/my_modules/image-palette src/my_modules/image-palette
git mv src/my_modules/quantize docs/retired-2026-09-16/src/my_modules/quantize            # 回滚：git mv docs/retired-2026-09-16/src/my_modules/quantize src/my_modules/quantize
git mv src/my_modules/readimage docs/retired-2026-09-16/src/my_modules/readimage          # 回滚：git mv docs/retired-2026-09-16/src/my_modules/readimage src/my_modules/readimage
git mv src/my_modules/file-icon docs/retired-2026-09-16/src/my_modules/file-icon          # 回滚：git mv docs/retired-2026-09-16/src/my_modules/file-icon src/my_modules/file-icon
git mv src/my_modules/extract-icon docs/retired-2026-09-16/src/my_modules/extract-icon    # 回滚：git mv docs/retired-2026-09-16/src/my_modules/extract-icon src/my_modules/extract-icon
git mv src/my_modules/url docs/retired-2026-09-16/src/my_modules/url                      # 回滚：git mv docs/retired-2026-09-16/src/my_modules/url src/my_modules/url
git mv src/my_modules/set-icon docs/retired-2026-09-16/src/my_modules/set-icon            # 回滚：git mv docs/retired-2026-09-16/src/my_modules/set-icon src/my_modules/set-icon
git mv src/my_modules/sudo-prompt docs/retired-2026-09-16/src/my_modules/sudo-prompt      # 回滚：git mv docs/retired-2026-09-16/src/my_modules/sudo-prompt src/my_modules/sudo-prompt
git mv src/my_modules/model-thumbnail docs/retired-2026-09-16/src/my_modules/model-thumbnail # 回滚：git mv docs/retired-2026-09-16/src/my_modules/model-thumbnail src/my_modules/model-thumbnail
git mv src/my_modules/electron-window-state docs/retired-2026-09-16/src/my_modules/electron-window-state # 回滚：git mv docs/retired-2026-09-16/src/my_modules/electron-window-state src/my_modules/electron-window-state
git mv src/my_modules/applescript docs/retired-2026-09-16/src/my_modules/applescript      # 回滚：git mv docs/retired-2026-09-16/src/my_modules/applescript src/my_modules/applescript
git mv src/my_modules/audiobuffer-slice docs/retired-2026-09-16/src/my_modules/audiobuffer-slice # 回滚：git mv docs/retired-2026-09-16/src/my_modules/audiobuffer-slice src/my_modules/audiobuffer-slice
git mv src/my_modules/check-disk-space docs/retired-2026-09-16/src/my_modules/check-disk-space # 回滚：git mv docs/retired-2026-09-16/src/my_modules/check-disk-space src/my_modules/check-disk-space
git mv src/my_modules/ms docs/retired-2026-09-16/src/my_modules/ms                        # 回滚：git mv docs/retired-2026-09-16/src/my_modules/ms src/my_modules/ms
git mv src/my_modules/access docs/retired-2026-09-16/src/my_modules/access                # 回滚：git mv docs/retired-2026-09-16/src/my_modules/access src/my_modules/access
git mv src/my_modules/appdata-path docs/retired-2026-09-16/src/my_modules/appdata-path    # 回滚：git mv docs/retired-2026-09-16/src/my_modules/appdata-path src/my_modules/appdata-path
git mv src/my_modules/bplist-parse docs/retired-2026-09-16/src/my_modules/bplist-parse    # 回滚：git mv docs/retired-2026-09-16/src/my_modules/bplist-parse src/my_modules/bplist-parse
git mv src/my_modules/curl-request docs/retired-2026-09-16/src/my_modules/curl-request    # 回滚：git mv docs/retired-2026-09-16/src/my_modules/curl-request src/my_modules/curl-request
git mv src/my_modules/electron-settings docs/retired-2026-09-16/src/my_modules/electron-settings # 回滚：git mv docs/retired-2026-09-16/src/my_modules/electron-settings src/my_modules/electron-settings
git mv src/my_modules/exif docs/retired-2026-09-16/src/my_modules/exif                    # 回滚：git mv docs/retired-2026-09-16/src/my_modules/exif src/my_modules/exif
git mv src/my_modules/extract-file-from-zip docs/retired-2026-09-16/src/my_modules/extract-file-from-zip # 回滚：git mv docs/retired-2026-09-16/src/my_modules/extract-file-from-zip src/my_modules/extract-file-from-zip
git mv src/my_modules/file-type docs/retired-2026-09-16/src/my_modules/file-type          # 回滚：git mv docs/retired-2026-09-16/src/my_modules/file-type src/my_modules/file-type
git mv src/my_modules/get-associated-application docs/retired-2026-09-16/src/my_modules/get-associated-application # 回滚：git mv docs/retired-2026-09-16/src/my_modules/get-associated-application src/my_modules/get-associated-application
git mv src/my_modules/get-drive-type docs/retired-2026-09-16/src/my_modules/get-drive-type # 回滚：git mv docs/retired-2026-09-16/src/my_modules/get-drive-type src/my_modules/get-drive-type
git mv src/my_modules/heif docs/retired-2026-09-16/src/my_modules/heif                    # 回滚：git mv docs/retired-2026-09-16/src/my_modules/heif src/my_modules/heif
git mv src/my_modules/image-cropper docs/retired-2026-09-16/src/my_modules/image-cropper  # 回滚：git mv docs/retired-2026-09-16/src/my_modules/image-cropper src/my_modules/image-cropper
git mv src/my_modules/image-size docs/retired-2026-09-16/src/my_modules/image-size        # 回滚：git mv docs/retired-2026-09-16/src/my_modules/image-size src/my_modules/image-size
git mv src/my_modules/iptc docs/retired-2026-09-16/src/my_modules/iptc                    # 回滚：git mv docs/retired-2026-09-16/src/my_modules/iptc src/my_modules/iptc
git mv src/my_modules/is-directory docs/retired-2026-09-16/src/my_modules/is-directory    # 回滚：git mv docs/retired-2026-09-16/src/my_modules/is-directory src/my_modules/is-directory
git mv src/my_modules/is-hidden-file docs/retired-2026-09-16/src/my_modules/is-hidden-file # 回滚：git mv docs/retired-2026-09-16/src/my_modules/is-hidden-file src/my_modules/is-hidden-file
git mv src/my_modules/jpgjs docs/retired-2026-09-16/src/my_modules/jpgjs                  # 回滚：git mv docs/retired-2026-09-16/src/my_modules/jpgjs src/my_modules/jpgjs
git mv src/my_modules/json-rest-light docs/retired-2026-09-16/src/my_modules/json-rest-light # 回滚：git mv docs/retired-2026-09-16/src/my_modules/json-rest-light src/my_modules/json-rest-light
git mv src/my_modules/ua-parser docs/retired-2026-09-16/src/my_modules/ua-parser          # 回滚：git mv docs/retired-2026-09-16/src/my_modules/ua-parser src/my_modules/ua-parser
git mv src/my_modules/n-readlines docs/retired-2026-09-16/src/my_modules/n-readlines      # 回滚：git mv docs/retired-2026-09-16/src/my_modules/n-readlines src/my_modules/n-readlines
git mv src/my_modules/native-extract-zip.js docs/retired-2026-09-16/src/my_modules/native-extract-zip.js # 回滚：git mv docs/retired-2026-09-16/src/my_modules/native-extract-zip.js src/my_modules/native-extract-zip.js
git mv src/my_modules/native-mouse docs/retired-2026-09-16/src/my_modules/native-mouse    # 回滚：git mv docs/retired-2026-09-16/src/my_modules/native-mouse src/my_modules/native-mouse
git mv src/my_modules/opentype docs/retired-2026-09-16/src/my_modules/opentype            # 回滚：git mv docs/retired-2026-09-16/src/my_modules/opentype src/my_modules/opentype
git mv src/my_modules/osascript docs/retired-2026-09-16/src/my_modules/osascript          # 回滚：git mv docs/retired-2026-09-16/src/my_modules/osascript src/my_modules/osascript
git mv src/my_modules/electron-download docs/retired-2026-09-16/src/my_modules/electron-download # 回滚：git mv docs/retired-2026-09-16/src/my_modules/electron-download src/my_modules/electron-download
git mv src/my_modules/pngjs docs/retired-2026-09-16/src/my_modules/pngjs                  # 回滚：git mv docs/retired-2026-09-16/src/my_modules/pngjs src/my_modules/pngjs
git mv src/my_modules/sanitize-filename docs/retired-2026-09-16/src/my_modules/sanitize-filename # 回滚：git mv docs/retired-2026-09-16/src/my_modules/sanitize-filename src/my_modules/sanitize-filename
git mv src/my_modules/tmp docs/retired-2026-09-16/src/my_modules/tmp                      # 回滚：git mv docs/retired-2026-09-16/src/my_modules/tmp src/my_modules/tmp
git mv src/my_modules/unicode-normalize docs/retired-2026-09-16/src/my_modules/unicode-normalize # 回滚：git mv docs/retired-2026-09-16/src/my_modules/unicode-normalize src/my_modules/unicode-normalize
git mv src/my_modules/vtt2srt docs/retired-2026-09-16/src/my_modules/vtt2srt              # 回滚：git mv docs/retired-2026-09-16/src/my_modules/vtt2srt src/my_modules/vtt2srt
git mv src/my_modules/win-clipboard docs/retired-2026-09-16/src/my_modules/win-clipboard  # 回滚：git mv docs/retired-2026-09-16/src/my_modules/win-clipboard src/my_modules/win-clipboard
git mv src/my_modules/zip-folder docs/retired-2026-09-16/src/my_modules/zip-folder        # 回滚：git mv docs/retired-2026-09-16/src/my_modules/zip-folder src/my_modules/zip-folder
```

#### A 批：`file-icon/url` 与 `UPNG/pako` 依赖闭包

| 条目 | 依据与替代 | 归档路径 / 回滚 |
|---|---|---|
| `UPNG` | `[NO_EXTERNAL_PATH_REFERENCE]`；内部仅由已退役 `pako` 子图引用 | `.../UPNG` → `git mv docs/retired-2026-09-16/src/my_modules/UPNG src/my_modules/UPNG` |
| `pako` | 仅 `UPNG/index.js:8` 引用；父项同批退役。根包已有独立 `pako` 依赖，运行期不依赖本目录 | `.../pako` → 同路径 `git mv` 回滚 |
| `image-palette` | `[NO_EXTERNAL_PATH_REFERENCE]`；内部依赖 `quantize`、`readimage` | `.../image-palette` → 同路径 `git mv` 回滚 |
| `quantize` | 仅 `image-palette/index.js:4` 引用；父项同批退役 | `.../quantize` → 同路径 `git mv` 回滚 |
| `readimage` | 仅 `image-palette/index.js:5` 引用；父项同批退役 | `.../readimage` → 同路径 `git mv` 回滚 |
| `file-icon` | `Inspector.tsx:124` 调用点命中 `moduleRegistry.ts:318` 空图标 shim，磁盘不执行 | `.../file-icon` → 同路径 `git mv` 回滚 |
| `extract-icon` | 仅 `file-icon/index.js:60` 引用；父项同批退役 | `.../extract-icon` → 同路径 `git mv` 回滚 |
| `url` | 多个调用点命中 `moduleRegistry.ts:264` / `browserRuntime.ts` URL 实现；磁盘不执行 | `.../url` → 同路径 `git mv` 回滚 |

#### B 批：旧桌面/工具依赖

| 条目 | 依据与替代 | 归档路径 / 回滚 |
|---|---|---|
| `set-icon` | `[NO_EXTERNAL_PATH_REFERENCE]`；无运行入口 | `.../set-icon` → 同路径 `git mv` 回滚 |
| `sudo-prompt` | 仅 `set-icon/index.js:40` 引用；父项同批退役 | `.../sudo-prompt` → 同路径 `git mv` 回滚 |
| `model-thumbnail` | `[NO_EXTERNAL_PATH_REFERENCE]`；内部 URL 依赖已退役 | `.../model-thumbnail` → 同路径 `git mv` 回滚 |
| `electron-window-state` | 仅 `src/app/js/plugin/main.js:125` 的死入口引用；该文件无运行加载入口 | `.../electron-window-state` → 同路径 `git mv` 回滚 |
| `applescript` | `[NO_EXTERNAL_PATH_REFERENCE]` | `.../applescript` → 同路径 `git mv` 回滚 |
| `audiobuffer-slice` | `[NO_EXTERNAL_PATH_REFERENCE]` | `.../audiobuffer-slice` → 同路径 `git mv` 回滚 |
| `check-disk-space` | `[NO_EXTERNAL_PATH_REFERENCE]` | `.../check-disk-space` → 同路径 `git mv` 回滚 |
| `ms` | `[NO_EXTERNAL_PATH_REFERENCE]` | `.../ms` → 同路径 `git mv` 回滚 |

#### C 批：截获 shim 与零消费者工具目录

| 条目 | 依据与替代 | 归档路径 / 回滚 |
|---|---|---|
| `access` | 调用点命中 `moduleRegistry.ts:339-342` 恒真权限 shim | `.../access` → 同路径 `git mv` 回滚 |
| `appdata-path` | 只命中 `moduleRegistry.ts:300-303` mock 路径 shim | `.../appdata-path` → 同路径 `git mv` 回滚 |
| `bplist-parse` | 只命中 `moduleRegistry.ts:435-438` 空字符串 shim | `.../bplist-parse` → 同路径 `git mv` 回滚 |
| `curl-request` | 只命中 `moduleRegistry.ts:417-420` 空请求 shim | `.../curl-request` → 同路径 `git mv` 回滚 |
| `electron-settings` | 调用点命中 `moduleRegistry.ts:258-261` / `settingsI18n` 真实现 shim | `.../electron-settings` → 同路径 `git mv` 回滚 |
| `exif` | `[NO_EXTERNAL_PATH_REFERENCE]` | `.../exif` → 同路径 `git mv` 回滚 |
| `extract-file-from-zip` | `[NO_EXTERNAL_PATH_REFERENCE]` | `.../extract-file-from-zip` → 同路径 `git mv` 回滚 |
| `file-type` | `[NO_EXTERNAL_PATH_REFERENCE]`；读取文件类型未载入本目录 | `.../file-type` → 同路径 `git mv` 回滚 |

#### D 批：截获 shim 的平台能力

| 条目 | 依据与替代 | 归档路径 / 回滚 |
|---|---|---|
| `get-associated-application` | 调用点命中 `moduleRegistry.ts:453-456` 空数组 shim | `.../get-associated-application` → 同路径 `git mv` 回滚 |
| `get-drive-type` | 调用点命中 `moduleRegistry.ts:411-414`、`:531` 的 `local` 实现 | `.../get-drive-type` → 同路径 `git mv` 回滚 |
| `heif` | `/heif/native` 命中 `moduleRegistry.ts:441-444` 空对象 shim；Worker 的真实引擎在 `src/app/js/workers/libheif.js` | `.../heif` → 同路径 `git mv` 回滚 |
| `image-cropper` | 调用点命中 `moduleRegistry.ts:447-450` 空函数 shim | `.../image-cropper` → 同路径 `git mv` 回滚 |
| `image-size` | 只命中 `moduleRegistry.ts:459-462` 空结果 shim | `.../image-size` → 同路径 `git mv` 回滚 |
| `iptc` | `[NO_EXTERNAL_PATH_REFERENCE]` | `.../iptc` → 同路径 `git mv` 回滚 |
| `is-directory` | 调用点命中 `moduleRegistry.ts:324-336` 的原生 `fs` facade | `.../is-directory` → 同路径 `git mv` 回滚 |
| `is-hidden-file` | 调用点命中 `moduleRegistry.ts:312-315` 的 `false` shim | `.../is-hidden-file` → 同路径 `git mv` 回滚 |

#### E 批：无消费者插件/工具闭包

| 条目 | 依据与替代 | 归档路径 / 回滚 |
|---|---|---|
| `jpgjs` | `[NO_EXTERNAL_PATH_REFERENCE]`；同名包只在 `utif` 的旧 devDependency 文本出现 | `.../jpgjs` → 同路径 `git mv` 回滚 |
| `json-rest-light` | 调用点命中 `moduleRegistry.ts:270-273` 的 `JsonRestServerStub` | `.../json-rest-light` → 同路径 `git mv` 回滚 |
| `ua-parser` | 仅已退役 `json-rest-light` 内部引用 | `.../ua-parser` → 同路径 `git mv` 回滚 |
| `n-readlines` | 调用点命中 `moduleRegistry.ts:294-297` 行读取 mock | `.../n-readlines` → 同路径 `git mv` 回滚 |
| `native-extract-zip.js` | `[NO_EXTERNAL_PATH_REFERENCE]` | `.../native-extract-zip.js` → 同路径 `git mv` 回滚 |
| `native-mouse` | `[NO_EXTERNAL_PATH_REFERENCE]` | `.../native-mouse` → 同路径 `git mv` 回滚 |
| `opentype` | `[NO_EXTERNAL_PATH_REFERENCE]` | `.../opentype` → 同路径 `git mv` 回滚 |
| `osascript` | `[NO_EXTERNAL_PATH_REFERENCE]` | `.../osascript` → 同路径 `git mv` 回滚 |

#### F 批：其余零磁盘消费者条目

| 条目 | 依据与替代 | 归档路径 / 回滚 |
|---|---|---|
| `electron-download` | `[NO_EXTERNAL_PATH_REFERENCE]` | `.../electron-download` → 同路径 `git mv` 回滚 |
| `pngjs` | 无 `my_modules/pngjs` 路径型消费者；测试中的裸 `pngjs` 走根包解析 | `.../pngjs` → 同路径 `git mv` 回滚 |
| `sanitize-filename` | 调用点命中 `moduleRegistry.ts:399-402` / `:716` 的纯函数替身 | `.../sanitize-filename` → 同路径 `git mv` 回滚 |
| `tmp` | `[NO_EXTERNAL_PATH_REFERENCE]` | `.../tmp` → 同路径 `git mv` 回滚 |
| `unicode-normalize` | `[NO_EXTERNAL_PATH_REFERENCE]` | `.../unicode-normalize` → 同路径 `git mv` 回滚 |
| `vtt2srt` | 调用点命中 `moduleRegistry.ts:429-432` 空函数 shim | `.../vtt2srt` → 同路径 `git mv` 回滚 |
| `win-clipboard` | `[NO_EXTERNAL_PATH_REFERENCE]` | `.../win-clipboard` → 同路径 `git mv` 回滚 |
| `zip-folder` | `[NO_EXTERNAL_PATH_REFERENCE]` | `.../zip-folder` → 同路径 `git mv` 回滚 |

### 4. 明确拒绝退役（8 项）

| 保留项 | 拒绝退役依据 |
|---|---|
| `pinyinlite` | `moduleRegistry.ts:741-742` 的真实字典与工厂加载 |
| `chinese_convert` | `moduleRegistry.ts:752-753` 的真实简繁映射加载 |
| `tiny-pinyin` | `moduleRegistry.ts:772` 的真实 `convertToPinyin` 加载 |
| `cartesian-product` | `moduleRegistry.ts:775` 的真实组合函数加载 |
| `junk` | `moduleRegistry.ts:309` / `:547` 明确读取 `junk/index.js`；内联 fallback 未做完整语义等价 |
| `raw-parser` | `src/app/raw-viewer/index.html:8` 经典 script 加载 `dcraw.js`，React RAW viewer 依赖 `window.dcraw` |
| `utif` | `bitmapWorker.js:474/476`、`tifWorker.js:19/21` 的 Worker `importScripts`，缺文件会直接影响 TIFF/CMYK 解码 |
| `is-network-drive` | `preferences/controller.ts:648` 仍调用，且未被 `moduleRegistry` 替换；当前没有等价替代或运行期验证 |

存疑但不纳入本批的动作：`junk` 的内联 fallback 与真实模块尚无语义矩阵对照；
`is-network-drive` 的 `main.js` 顶层 `bindings` 解析尚未做运行期验证。二者因此都保留。

### 5. `src/package.json`

保留现役元数据字段：`version`、`buildVersion`、`buildNumber`（以及本文件原有描述性元数据
和依赖表）。退役旧宿主字段：`main`、`scripts`、`devDependencies`、`build`、
`extend-info`。逐字段消费者已由 `bundleGlobals.ts`、`apiServerDomain.ts`、
`collect-window/api/env.ts`、`PluginCenter.tsx`、三处 webview 注入和 About/notification
路径复核，未发现待删字段的在跑消费者。

回滚 `src/package.json` 使用该文件的 `git revert` 或从对应提交恢复；它不参与
`src/my_modules` 的归档回滚。

### 6. M7-3 门禁原始结果

```text
node tests/publish-asset-manifest.mjs
# tests 5
# pass 5
# fail 0

node tests/dist-entry-check.mjs
--- 汇总：FAIL 0；已检查文件 304 ---
DIST_ENTRY_CHECK_OK（仅静态产物检查，不授予 release 资格）

node tests/frontend-gates-unit.mjs
# tests 59
# pass 59
# fail 0

node tests/frontend-public-policy.mjs
# tests 9
# pass 9
# fail 0
```

两条负向探针的退出码均为 1，原始首行如下：

```text
Error: 发布资产清单[0]: 必需源资源不存在 missing.txt
Error: 未登记的 src/my_modules 条目: junk
```

该测试只读取固定的 `frontend/`、`src/my_modules/` 和归档根，不做工作区递归扫描；
因此不依赖未跟踪抓痕目录，符合 D25。
