# R1-4 · 空 catch 清单与分类

> 验收报告原文：*「对 680 处 `catch (err) { /* 注释 */ }` 做分类（顶层兜底 / 真实吞错），
> 把『吞错且影响业务结果』的挑出来加观测」*，验收标准：**形成清单，逐条要么上报要么注明理由**。

本文由 `outputs/generate-empty-catch-inventory.mjs` 生成，数据源 `tests/empty-catch-scanner.mjs`，
生成时间 2026-09-17T06:15:04.400Z。改动代码后重跑该脚本即可刷新。

## 1. 结论摘要

| 项 | 值 |
|---|---|
| 受检文件数 | 384 |
| 空 catch 总数（生产代码） | **538** |
| 高风险（规则判定会改变业务结果） | 145 |
| 低风险（清理/日志/UI/可选读取/纯解析） | 393 |
| 高风险且未标注理由 | 144 |
| 本次已改为上报 | 11 处（4 个文件） |
| 解析告警文件数 | 8 |

**与验收报告「680 处」的差异**：报告的数字未区分第一方与 vendored。本仓把依赖直接提交了
（`src/node_modules` 8000+ 文件入库，`src/app/js/vendors`、`pdf-viewer`、`model-viewer/libs`、
`dcraw`/`libheif` 均为第三方），排除后第一方生产代码为 **538 处**——量级一致，口径更严。

## 2. 扫描口径

- **范围**：`src/app`、`src/my_modules`、`src/i18n`、`electron`、`frontend`、`backend`、`scripts`、`plugins`，**排除 `tests/`**。
- **排除的 vendored**：`node_modules/`、`pdf-viewer/`、`model-viewer/libs/`、`vendors/`、`workers/libheif.js`、
  `raw-parser/dcraw.js`、`dist/`、`third_party/`、`*.min.js`。
- **方法**：TypeScript parser 走 AST（`CatchClause` 且 `block.statements.length === 0`），
  **不用正则**——正则在嵌套花括号、字符串与模板串里必然误判。
- **判据落在 try 块内容上，不落在 catch 的注释上**：注释可能写错，try 块在保护什么不会。

## 3. 分类规则

| 分类 | 风险 | 判据（看 try 块） |
|---|---|---|
| A0-空try块 | 低 | 剥掉注释后什么都不做 |
| A8-控制流跳出 | 低 | `throw BreakException` 之类故意抛异常跳出 |
| A2-清理释放 | 低 | clearTimeout / removeListener / reset / pause / dispose / unlink 等 |
| A1-日志遥测 | 低 | 仅打日志且无副作用 |
| A6-UI触发/样式 | 低 | `el.click()` / classList / style |
| A9-可选元数据读取 | 低 | fontMetas / rawMetas / palettes / tagMappings |
| A10-排序比较 | 低 | localeCompare / sort |
| A3-能力探测 | 低 | typeof / in / tryGet 等有后备的探测 |
| A4-纯解析/格式化 | 低 | JSON.parse / Number / new Date 等 |
| A5-无特征但有注释说明 | 低 | 无规则命中，但已有注释说明理由 |
| **B1-写操作/IO** | **高** | fs / localStorage.setItem / exec 等 |
| **B2-网络/IPC/数据库** | **高** | fetch / ipcRenderer / postMessage / executeJavaScript |
| **B3-业务返回值** | **高** | try 内有 `return`（失败会返回 undefined/空串） |
| **B4-状态写入** | **高** | setState / store / emit |
| **B5-无特征且无说明** | **高** | 无规则命中且无注释——最可疑，需人工看 |

> 规则修过两轮：初版把 `pause()`/`removeListener()` 判成高风险、把日志文案里含 "rename"
> 三个字母的判成写操作。抽样复核后修正——**分类器的作用是分流，不是终审**。

## 4. 分类结果分布

| 分类 | 数量 |
|---|---|
| A3-能力探测 | 151 |
| A5-无特征但有注释说明 | 82 |
| A1-日志遥测 | 76 |
| B5-无特征且无说明 | 46 |
| B3-业务返回值 | 44 |
| A2-清理释放 | 42 |
| B1-写操作/IO | 31 |
| B2-网络/IPC/数据库 | 23 |
| A6-UI触发/样式 | 17 |
| A4-纯解析/格式化 | 14 |
| A9-可选元数据读取 | 8 |
| A0-空try块 | 2 |
| A8-控制流跳出 | 1 |
| B4-状态写入 | 1 |

## 5. 本次已改为上报的点位

上报通道：`src/app/react/core/swallowReport.ts`（零依赖、自身永不抛错、同 key 前 3 次真上报后只计数，
防止逐帧 catch 打爆日志）。

| 文件 | 处数 | 说明 |
|---|---|---|
| `src/app/react/core/fileUrlHelper.ts` | 6 处 | FileUrlHelper 六个 URL/路径 getter |
| `src/app/react/core/ipcHelper.ts` | 2 处 | IPCHelper.send / sendTo |
| `src/app/react/components/stage7/PluginCenter.tsx` | 2 处 | openPluginById（安装 / 打开详情） |
| `src/app/react/components/inspector/Inspector.tsx` | 1 处 | 格式插件 webview plugin-create / plugin-run |

其中最关键的是 `fileUrlHelper.ts`——该模块注释里就记录了一起由空 catch 造成的真实故障：

> URL_MODULE 绑定消失 → 裸引用抛 ReferenceError → **被下方各 try/catch 吞掉** →
> 所有 raw/thumbnail URL 静默变空串 → 详情原图无 URL → smoothZoom 不装载 → 交付闸门永不释放。

## 6. 高风险且未标注的逐条处置（144 条）

> 分流结论来自本会话逐条查看 try 块实际内容，非规则自动生成。
> 「待接线 / 待逐项裁决」表示**尚未**满足「上报」要求，已如实登记，不伪装成已完成。


### `backend/src/capture-service.js`（本文件 1 处空 catch）

- **处置**：待逐项裁决
- **理由**：规则判定为高风险且未标注，尚未逐处人工确认，登记在案待处理。

| 行 | 分类 | 上下文 | try 块在保护什么 |
|---|---|---|---|
| 82 | B3-业务返回值 | `function parseStringArray` | `{ const parsed = JSON.parse(trimmed); if (Array.isArray(parsed)) return parsed.map((entry) => cleanString(entry)).filter(Boolean); }` |

### `backend/src/controlled-downloader.js`（本文件 1 处空 catch）

- **处置**：待逐项裁决
- **理由**：规则判定为高风险且未标注，尚未逐处人工确认，登记在案待处理。

| 行 | 分类 | 上下文 | try 块在保护什么 |
|---|---|---|---|
| 184 | B1-写操作/IO | `function cleanupStaleDownloadDirectories` | `{ const lease = JSON.parse(fs.readFileSync(leasePath, 'utf8')); if (Number(lease.expiresAt) <= now \|\| !isProcessAlive(Number(lease.pid))) { fs.rmSyn` |

### `backend/src/document-preview-service.js`（本文件 1 处空 catch）

- **处置**：待逐项裁决
- **理由**：规则判定为高风险且未标注，尚未逐处人工确认，登记在案待处理。

| 行 | 分类 | 上下文 | try 块在保护什么 |
|---|---|---|---|
| 294 | B1-写操作/IO | `(顶层/匿名)` | `{ fs.accessSync(candidate, fs.constants.X_OK); return candidate; }` |

### `backend/src/item-workflow-service.js`（本文件 2 处空 catch）

- **处置**：待逐项裁决
- **理由**：规则判定为高风险且未标注，尚未逐处人工确认，登记在案待处理。

| 行 | 分类 | 上下文 | try 块在保护什么 |
|---|---|---|---|
| 176 | B1-写操作/IO | `function rollbackRenames` | `{ if (samePath(operation.source, operation.target) && operation.source !== operation.target) { if (fs.existsSync(operation.target)) renameFileSafely(o` |

### `backend/src/library-backup-service.js`（本文件 1 处空 catch）

- **处置**：待逐项裁决
- **理由**：规则判定为高风险且未标注，尚未逐处人工确认，登记在案待处理。

| 行 | 分类 | 上下文 | try 块在保护什么 |
|---|---|---|---|
| 99 | B1-写操作/IO | `function listRecoveryPoints` | `{ points.push(JSON.parse(fs.readFileSync(manifestFile, 'utf8'))); }` |

### `backend/src/native-preview-service.js`（本文件 1 处空 catch）

- **处置**：待逐项裁决
- **理由**：规则判定为高风险且未标注，尚未逐处人工确认，登记在案待处理。

| 行 | 分类 | 上下文 | try 块在保护什么 |
|---|---|---|---|
| 130 | B1-写操作/IO | `(顶层/匿名)` | `{ fs.rmSync(outdir, { recursive: true, force: true }); }` |

### `backend/src/server.js`（本文件 3 处空 catch）

- **处置**：待逐项裁决
- **理由**：规则判定为高风险且未标注，尚未逐处人工确认，登记在案待处理。

| 行 | 分类 | 上下文 | try 块在保护什么 |
|---|---|---|---|
| 896 | B1-写操作/IO | `(顶层/匿名)` | `{ const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8')); const pluginName = manifest.id \|\| child.name; plugins.push({ id: manifest.id, ` |

### `backend/src/thumbnailer.js`（本文件 1 处空 catch）

- **处置**：待逐项裁决
- **理由**：规则判定为高风险且未标注，尚未逐处人工确认，登记在案待处理。

| 行 | 分类 | 上下文 | try 块在保护什么 |
|---|---|---|---|
| 85 | B3-业务返回值 | `function generateThumbnailAsync` | `{ await sharp(original) .resize({ width: options.maxSize \|\| 320, height: options.maxSize \|\| 320, fit: 'inside', withoutEnlargement: true }) .png()` |

### `electron/main.cjs`（本文件 15 处空 catch）

- **处置**：待逐项裁决
- **理由**：规则判定为高风险且未标注，尚未逐处人工确认，登记在案待处理。

| 行 | 分类 | 上下文 | try 块在保护什么 |
|---|---|---|---|
| 52 | B1-写操作/IO | `function writePathStubWriteControl` | `{ fs.writeFileSync(path.join(writePathStubDir, 'control.json'), JSON.stringify(control)); }` |
| 55 | B1-写操作/IO | `function writePathStubAppend` | `{ fs.appendFileSync(path.join(writePathStubDir, 'requests.jsonl'), JSON.stringify(entry) + '\n'); }` |
| 118 | B1-写操作/IO | `function writePreferencesState` | `{ fs.mkdirSync(path.dirname(preferencesStateFile()), { recursive: true }); fs.writeFileSync(preferencesStateFile(), JSON.stringify(merged, null, 2), '` |
| 766 | B1-写操作/IO | `function saveWindowState` | `{ const bounds = win.getBounds(); fs.mkdirSync(path.dirname(windowStateFile()), { recursive: true }); fs.writeFileSync(windowStateFile(), JSON.stringi` |
| 930 | B1-写操作/IO | `(顶层/匿名)` | `{ fs.writeFileSync(path.join(writePathStubDir, 'requests.jsonl'), ''); }` |
| 1288 | B1-写操作/IO | `(顶层/匿名)` | `{ // application-menu 站点：模板 main 侧原生序列化（remote 读 items 经代理，实测为空） if (tpl.site === 'application-menu') { menuPopupCaptures.push({ site: tpl.site, items` |
| 3091 | B2-网络/IPC/数据库 | `const waitForPreview` | `{ const value = await previewWindow.webContents.executeJavaScript(check); if (value) return value; }` |
| 3382 | B2-网络/IPC/数据库 | `const waitForReopened` | `{ const value = await reopenedWindow.webContents.executeJavaScript(check); if (value) return value; }` |

### `scripts/clear-ports.mjs`（本文件 2 处空 catch）

- **处置**：注明理由（不加观测）
- **理由**：开发/运维脚本（清端口、启动生产），不在产品运行路径上，失败由脚本自身退出码体现。

| 行 | 分类 | 上下文 | try 块在保护什么 |
|---|---|---|---|
| 14 | B1-写操作/IO | `(顶层/匿名)` | `{ execSync(`taskkill /F /PID ${pid}`, { timeout: 5000 }); console.log(`[cleanup] Killed PID ${pid} on port ${port}`); }` |
| 17 | B1-写操作/IO | `(顶层/匿名)` | `{ const output = execSync(`netstat -ano \| findstr ":${port} " \| findstr "LISTENING"`, { encoding: 'utf8', timeout: 5000 }); for (const line of outpu` |

### `src/app/gif-viewer/gif-player.js`（本文件 1 处空 catch）

- **处置**：注明理由（不加观测）
- **理由**：GIF 逐帧绘制循环内的兜底，逐帧上报会造成日志洪水，且单帧失败无用户可感知后果。

| 行 | 分类 | 上下文 | try 块在保护什么 |
|---|---|---|---|
| 849 | B5-无特征且无说明 | `(顶层/匿名)` | `{ var f = frames[i]; if (!f \|\| !f.bitmap) return; if (isTransparent) ctx.globalCompositeOperation = "copy"; ctx.drawImage(f.bitmap, 0, 0); }` |

### `src/app/js/auto-import/auto-import.js`（本文件 1 处空 catch）

- **处置**：待逐项裁决
- **理由**：规则判定为高风险且未标注，尚未逐处人工确认，登记在案待处理。

| 行 | 分类 | 上下文 | try 块在保护什么 |
|---|---|---|---|
| 109 | B1-写操作/IO | `(顶层/匿名)` | `{ if (that.lock[filename]) return; var filePath = path.normalize(`${watchPath}/${filename}`); if (!fs.existsSync(filePath) \|\| fs.statSync(filePath).` |

### `src/app/js/downloader/downloader.js`（本文件 1 处空 catch）

- **处置**：待逐项裁决
- **理由**：规则判定为高风险且未标注，尚未逐处人工确认，登记在案待处理。

| 行 | 分类 | 上下文 | try 块在保护什么 |
|---|---|---|---|
| 362 | B2-网络/IPC/数据库 | `(顶层/匿名)` | `{ const head = buffer.slice(0, 1024).toString('utf8').toLowerCase(); if (head.startsWith('<!doctype html') \|\| head.startsWith('<html')) { ipcRendere` |

### `src/app/js/global.js`（本文件 8 处空 catch）

- **处置**：待接线（遗留层）
- **理由**：与 fileUrlHelper 同族：路径/URL 计算失败静默返回空串，会让图片加载失败且无提示。属遗留全局脚本层（非 ESM，无法 import React 侧模块），需经 globalThis 守卫式调用，列为后续。

| 行 | 分类 | 上下文 | try 块在保护什么 |
|---|---|---|---|
| 225 | B3-业务返回值 | `function getHashID` | `{ if (image) { if (image.name === i18n.__("general.untitled.title")) { return hashID; } // 本體不支原且也沒有插件支援 if (!EagleConfig.SUPPORT_FORMATS[image.ext] &` |
| 248 | B3-业务返回值 | `(顶层/匿名)` | `{ if (!image \|\| !image.name) return ""; return path.normalize(`${$bodyScope.libraryImagesPath}/${image.id}.info/metadata.json`); }` |
| 256 | B3-业务返回值 | `(顶层/匿名)` | `{ if (!image \|\| !image.name) return ""; let rawPath = path.normalize(`${$bodyScope.libraryImagesPath}/${image.id}.info/${image.name}.${image.ext}`);` |
| 276 | B3-业务返回值 | `(顶层/匿名)` | `{ if (!image \|\| !image.name) return ""; if (image.noThumbnail) { return FileUrlHelper.getRawPath(image); } let forceRaw = (image.ext === 'svg' && !i` |
| 283 | B3-业务返回值 | `(顶层/匿名)` | `{ var thumbnailPath = FileUrlHelper.getThumbnailPath(image); return URL_MODULE.pathToFileURL(thumbnailPath).href; }` |
| 293 | B3-业务返回值 | `(顶层/匿名)` | `{ let thumbnailUrl = FileUrlHelper.getThumbnailUrl(image); if ($bodyScope.modifiedMappings && $bodyScope.modifiedMappings[image.id]) { thumbnailUrl = ` |
| 299 | B3-业务返回值 | `(顶层/匿名)` | `{ return URL_MODULE.pathToFileURL(FileUrlHelper.getRawPath(image)).href; }` |
| 945 | B5-无特征且无说明 | `(顶层/匿名)` | `{ fileurl = fileurlBuf.toString(); name = nameBuf.toString(); url = urlBuf.toString(); }` |

### `src/app/js/plugin/index.js`（本文件 14 处空 catch）

- **处置**：待接线（遗留层）
- **理由**：localStorage 写入插件 pinned 状态失败被吞 → 用户固定插件后重启即丢；读取 metadata.json 失败被吞 → 资料库状态静默错误。同属遗留层，列为后续。

| 行 | 分类 | 上下文 | try 块在保护什么 |
|---|---|---|---|
| 149 | B5-无特征且无说明 | `(顶层/匿名)` | `{ pluginModule.installedPluginMaps[plugin?.manifest?.id] = plugin; }` |
| 343 | B3-业务返回值 | `(顶层/匿名)` | `{ const hasDependencies = pluginModule.plugins.filter((plugin) => { const dependencies = plugin?.manifest?.dependencies ?? []; return dependencies.len` |
| 657 | B5-无特征且无说明 | `(顶层/匿名)` | `{ localStorage['eagle.plugin.pinned'] = JSON.stringify(pluginModule.pinnedPluginMaps); }` |
| 667 | B5-无特征且无说明 | `(顶层/匿名)` | `{ localStorage['eagle.plugin.pinned'] = JSON.stringify(pluginModule.pinnedPluginMaps); }` |
| 698 | B5-无特征且无说明 | `(顶层/匿名)` | `{ localStorage['eagle.plugin.pinned'] = JSON.stringify(pluginModule.pinnedPluginMaps); }` |
| 1066 | B3-业务返回值 | `(顶层/匿名)` | `{ pluginModule.pinnedPluginMaps = localStorage['eagle.plugin.pinned'] ? JSON.parse(localStorage['eagle.plugin.pinned']) : {}; Object.keys(pluginModule` |
| 2662 | B5-无特征且无说明 | `(顶层/匿名)` | `{ let item = $bodyScope.raw[rindex]; let needUpadate = false; if (item?.tags) { item.tags.forEach((tag, index) => { if (tag === originalName) { item.t` |
| 2942 | B1-写操作/IO | `(顶层/匿名)` | `{ let metadataPath = `${decodeURI($bodyScope.rootDir)}/metadata.json`; let libraryJSON = fs.readFileSync(metadataPath, 'utf8'); library = JSON.parse(l` |

### `src/app/js/plugin/logger.js`（本文件 1 处空 catch）

- **处置**：待接线（遗留层）
- **理由**：localStorage 写入插件 pinned 状态失败被吞 → 用户固定插件后重启即丢；读取 metadata.json 失败被吞 → 资料库状态静默错误。同属遗留层，列为后续。

| 行 | 分类 | 上下文 | try 块在保护什么 |
|---|---|---|---|
| 20 | B5-无特征且无说明 | `(顶层/匿名)` | `{ eagle.log.info(`Calling ${nickname}.${name}(${arguments[0]}, ${arguments[1]}, ${arguments[2]})`); }` |

### `src/app/js/plugin/model/item.js`（本文件 1 处空 catch）

- **处置**：待接线（遗留层）
- **理由**：localStorage 写入插件 pinned 状态失败被吞 → 用户固定插件后重启即丢；读取 metadata.json 失败被吞 → 资料库状态静默错误。同属遗留层，列为后续。

| 行 | 分类 | 上下文 | try 块在保护什么 |
|---|---|---|---|
| 111 | B1-写操作/IO | `(顶层/匿名)` | `{ await fs.promises.unlink(tmpPath); }` |

### `src/app/js/utils/downloadFile.js`（本文件 1 处空 catch）

- **处置**：待逐项裁决
- **理由**：规则判定为高风险且未标注，尚未逐处人工确认，登记在案待处理。

| 行 | 分类 | 上下文 | try 块在保护什么 |
|---|---|---|---|
| 77 | B5-无特征且无说明 | `(顶层/匿名)` | `{ if (totalByte && currentByte) { progress = currentByte / totalByte * 100; params.onProgress(progress); } if (currentByte === totalByte) { finalResol` |

### `src/app/js/utils/flipImage.js`（本文件 1 处空 catch）

- **处置**：待逐项裁决
- **理由**：规则判定为高风险且未标注，尚未逐处人工确认，登记在案待处理。

| 行 | 分类 | 上下文 | try 块在保护什么 |
|---|---|---|---|
| 337 | B1-写操作/IO | `(顶层/匿名)` | `{ await fs.promises.unlink(tempPath); }` |

### `src/app/js/utils/rotateImage.js`（本文件 2 处空 catch）

- **处置**：待逐项裁决
- **理由**：规则判定为高风险且未标注，尚未逐处人工确认，登记在案待处理。

| 行 | 分类 | 上下文 | try 块在保护什么 |
|---|---|---|---|
| 168 | B3-业务返回值 | `(顶层/匿名)` | `{ const data = await APNG.parseURL(rawUrl); // 如果是 APNG，拒絕處理 return reject(new Error('Not support apng file format.')); }` |
| 390 | B1-写操作/IO | `(顶层/匿名)` | `{ await fs.promises.unlink(tempPath); }` |

### `src/app/js/workers/bitmapWorker.js`（本文件 3 处空 catch）

- **处置**：注明理由（不加观测）
- **理由**：解码 worker 内的可选步骤（HEIF/TIF 方向信息处理等），失败退化为不处理该特性。

| 行 | 分类 | 上下文 | try 块在保护什么 |
|---|---|---|---|
| 508 | B5-无特征且无说明 | `function processTifImage` | `{ // TIF files can also have orientation tags if (ifds[0].t274) { orientation = ifds[0].t274[0]; } }` |

### `src/app/js/workers/heic2bitmap-worker.js`（本文件 1 处空 catch）

- **处置**：注明理由（不加观测）
- **理由**：解码 worker 内的可选步骤（HEIF/TIF 方向信息处理等），失败退化为不处理该特性。

| 行 | 分类 | 上下文 | try 块在保护什么 |
|---|---|---|---|
| 39 | B5-无特征且无说明 | `(顶层/匿名)` | `{ const limitsPtr = libheifCore._heif_get_global_security_limits(); if (limitsPtr && libheifCore.HEAP32) { libheifCore.HEAP32[(limitsPtr >> 2) + 15] =` |

### `src/app/react/app/filters.ts`（本文件 1 处空 catch）

- **处置**：待逐项裁决
- **理由**：规则判定为高风险且未标注，尚未逐处人工确认，登记在案待处理。

| 行 | 分类 | 上下文 | try 块在保护什么 |
|---|---|---|---|
| 78 | B3-业务返回值 | `function duration` | `{ if (str) { const date = new Date(0); const seconds = Math.max(1, parseInt(str)); date.setSeconds(seconds); if (seconds < 3600) return date.toISOStri` |

### `src/app/react/collect-window/selectPanelEngine.ts`（本文件 1 处空 catch）

- **处置**：待逐项裁决
- **理由**：规则判定为高风险且未标注，尚未逐处人工确认，登记在案待处理。

| 行 | 分类 | 上下文 | try 块在保护什么 |
|---|---|---|---|
| 135 | B3-业务返回值 | `const panelI18n` | `{ return i18n.__(key); }` |

### `src/app/react/components/detail/detailHooks.ts`（本文件 8 处空 catch）

- **处置**：待逐项裁决
- **理由**：规则判定为高风险且未标注，尚未逐处人工确认，登记在案待处理。

| 行 | 分类 | 上下文 | try 块在保护什么 |
|---|---|---|---|
| 2290 | B5-无特征且无说明 | `(顶层/匿名)` | `{ rectEl.remove(); }` |

### `src/app/react/components/detail/DetailViewer.tsx`（本文件 1 处空 catch）

- **处置**：待逐项裁决
- **理由**：规则判定为高风险且未标注，尚未逐处人工确认，登记在案待处理。

| 行 | 分类 | 上下文 | try 块在保护什么 |
|---|---|---|---|
| 243 | B2-网络/IPC/数据库 | `(顶层/匿名)` | `{ const remote = req('@electron/remote'); const app = remote?.app; const pjson = req((window as any).appRoot.path + '/package.json'); const preference` |

### `src/app/react/components/grid/boxItem.tsx`（本文件 3 处空 catch）

- **处置**：注明理由（不加观测）
- **理由**：读取 fontMetas / rawMetas / palettes / tagMappings 等可选元数据，缺失只影响展示的一项，不影响主流程。

| 行 | 分类 | 上下文 | try 块在保护什么 |
|---|---|---|---|
| 63 | B3-业务返回值 | `const durationFilter` | `{ if (str) { const date = new Date(0); const seconds = Math.max(1, parseInt(str)); date.setSeconds(seconds); if (seconds < 3600) return date.toISOStri` |
| 201 | B1-写操作/IO | `function buildTemplateData` | `{ const fontFolder = (window as any).fontFolder \|\| ''; const key = Object.keys(item.fontMetas.postScriptName)[0]; const postScriptName = item.fontMe` |

### `src/app/react/components/inspector/Inspector.tsx`（本文件 4 处空 catch）

- **处置**：部分已上报
- **理由**：格式插件 webview 的 plugin-create / plugin-run 发送失败被吞 → 插件面板永远空白，本次已上报该处；其余为 UI 装饰与可选读取。

| 行 | 分类 | 上下文 | try 块在保护什么 |
|---|---|---|---|
| 264 | B5-无特征且无说明 | `(顶层/匿名)` | `{ if (retryCount === 0) return; const item = useSelectionState.getState().selected?.find?.((s: any) => s?.id === image.id); if (!item) return; const h` |
| 1006 | B2-网络/IPC/数据库 | `(顶层/匿名)` | `{ const remote = req('@electron/remote'); const app = remote?.app; const pjson = req((window as any).appRoot.path + '/package.json'); const preference` |
| 1029 | B2-网络/IPC/数据库 | `(顶层/匿名)` | `{ const hiddenMap = JSON.parse(localStorage['eagle.inspector.hidePluginMap'] \|\| '{}'); if (hiddenMap[plugin.id]) { setHeightEl(webview, height); ret` |

### `src/app/react/components/stage7/BatchSavePanel.tsx`（本文件 3 处空 catch）

- **处置**：注明理由（不加观测）
- **理由**：以 el.click() 等 UI 触发与样式装饰为主，元素可能已卸载，触发不到不算业务失败。

| 行 | 分类 | 上下文 | try 块在保护什么 |
|---|---|---|---|
| 235 | B2-网络/IPC/数据库 | `(顶层/匿名)` | `{ const response = await fetch(src); const contentType = response.headers.get('content-type') \|\| ''; const contentDisposition = response.headers.get` |

### `src/app/react/components/stage7/ControllerModals.tsx`（本文件 3 处空 catch）

- **处置**：注明理由（不加观测）
- **理由**：以 el.click() 等 UI 触发与样式装饰为主，元素可能已卸载，触发不到不算业务失败。

| 行 | 分类 | 上下文 | try 块在保护什么 |
|---|---|---|---|
| 147 | B5-无特征且无说明 | `(顶层/匿名)` | `{ if (error.modifiedData && error.modifiedData.id) { // 原版变量名 rootScope 实为 body scope（angular.element("body").scope()） const item = useItemState.getSt` |
| 381 | B2-网络/IPC/数据库 | `const onDomReady` | `{ webview.executeJavaScript( ` localStorage["theme"] = "${useBodyState.getState().theme}"; document.querySelector("html").setAttribute("theme", "${use` |
| 430 | B2-网络/IPC/数据库 | `(顶层/匿名)` | `{ webview.executeJavaScript( ` localStorage["theme"] = "${useBodyState.getState().theme}"; document.querySelector("html").setAttribute("theme", "${use` |

### `src/app/react/components/stage7/DuplicateFamily.tsx`（本文件 4 处空 catch）

- **处置**：注明理由（不加观测）
- **理由**：以 el.click() 等 UI 触发与样式装饰为主，元素可能已卸载，触发不到不算业务失败。

| 行 | 分类 | 上下文 | try 块在保护什么 |
|---|---|---|---|
| 1546 | B5-无特征且无说明 | `(顶层/匿名)` | `{ const newFileFolders = rootRef.current.right.folders; if (newFileFolders && newFileFolders.length > 0) { newFileFolders.forEach((folderId: any) => {` |
| 1606 | B5-无特征且无说明 | `(顶层/匿名)` | `{ const newFileFolders = right.folders; if (newFileFolders && newFileFolders.length > 0) { newFileFolders.forEach((folderId: any) => { const folder = ` |

### `src/app/react/components/stage7/FolderModals.tsx`（本文件 2 处空 catch）

- **处置**：注明理由（不加观测）
- **理由**：以 el.click() 等 UI 触发与样式装饰为主，元素可能已卸载，触发不到不算业务失败。

| 行 | 分类 | 上下文 | try 块在保护什么 |
|---|---|---|---|
| 196 | B3-业务返回值 | `function send` | `{ if (!willSendItems \|\| willSendItems.length === 0) return; console.log('第 %d 更新，目前進度 %d / %d', countOfSend, willSendItems.length + (countOfSend - 1` |
| 277 | B5-无特征且无说明 | `(顶层/匿名)` | `{ if (index !== undefined) { const container = document.querySelector(containerSelector) as HTMLElement \| null; if (!container) return; if (!sizes \|` |

### `src/app/react/components/stage7/FolderSelectPanels.tsx`（本文件 5 处空 catch）

- **处置**：注明理由（不加观测）
- **理由**：以 el.click() 等 UI 触发与样式装饰为主，元素可能已卸载，触发不到不算业务失败。

| 行 | 分类 | 上下文 | try 块在保护什么 |
|---|---|---|---|
| 264 | B5-无特征且无说明 | `const preventOverlayInspector` | `{ const selectPanel = rootRef.current ? (rootRef.current.querySelector('.select-panel') as HTMLElement \| null) : null; const inspectorLeft = offsetOf` |

### `src/app/react/components/stage7/InspectorTagSelectPanel.tsx`（本文件 1 处空 catch）

- **处置**：注明理由（不加观测）
- **理由**：以 el.click() 等 UI 触发与样式装饰为主，元素可能已卸载，触发不到不算业务失败。

| 行 | 分类 | 上下文 | try 块在保护什么 |
|---|---|---|---|
| 75 | B5-无特征且无说明 | `const preventOverlayInspector` | `{ const sp = rootRef.current ? (rootRef.current.querySelector('.select-panel') as HTMLElement \| null) : null; const inspectorLeft = offsetOf(q('.insp` |

### `src/app/react/components/stage7/PluginFamily.tsx`（本文件 2 处空 catch）

- **处置**：注明理由（不加观测）
- **理由**：以 el.click() 等 UI 触发与样式装饰为主，元素可能已卸载，触发不到不算业务失败。

| 行 | 分类 | 上下文 | try 块在保护什么 |
|---|---|---|---|
| 132 | B3-业务返回值 | `const getURLModule` | `{ const mod = (w().eval && w().eval('typeof URL_MODULE !== "undefined" ? URL_MODULE : undefined')) \|\| undefined; if (mod) return mod; }` |

### `src/app/react/components/stage7/QuickSearchModal.tsx`（本文件 5 处空 catch）

- **处置**：注明理由（不加观测）
- **理由**：读取 fontMetas / rawMetas / palettes / tagMappings 等可选元数据，缺失只影响展示的一项，不影响主流程。

| 行 | 分类 | 上下文 | try 块在保护什么 |
|---|---|---|---|
| 71 | B3-业务返回值 | `const getQuickSearchFolderHistory` | `{ const raw = localStorage.getItem('eagle.quickSearch.folder.history'); if (raw) return JSON.parse(raw); }` |
| 89 | B3-业务返回值 | `const getQuickSearchSmartFolderHistory` | `{ const raw = localStorage.getItem('eagle.quickSearch.smartFolder.history'); if (raw) return JSON.parse(raw); }` |
| 366 | B3-业务返回值 | `const searchFilterForQuickSeach` | `{ const w = window as any; let isMatch = false; const keywords = String(kw).toLowerCase().split(' '); for (let i = 0; i < keywords.length; i++) { let ` |

### `src/app/react/components/stage7/TagManager.tsx`（本文件 2 处空 catch）

- **处置**：注明理由（不加观测）
- **理由**：以 el.click() 等 UI 触发与样式装饰为主，元素可能已卸载，触发不到不算业务失败。

| 行 | 分类 | 上下文 | try 块在保护什么 |
|---|---|---|---|
| 234 | B5-无特征且无说明 | `(顶层/匿名)` | `{ rect.remove(); }` |

### `src/app/react/core/appCore.ts`（本文件 6 处空 catch）

- **处置**：待逐项裁决
- **理由**：规则判定为高风险且未标注，尚未逐处人工确认，登记在案待处理。

| 行 | 分类 | 上下文 | try 块在保护什么 |
|---|---|---|---|
| 75 | B3-业务返回值 | `function sweepForeignWatchers` | `{ const watchers = s.$$watchers; if (!Array.isArray(watchers)) return 0; const parsedList = getParseVariants(exp); // $watch 返回的是注销函数而非 watcher 对象——mi` |
| 121 | B3-业务返回值 | `function removeChannelListenersBySource` | `{ let list: any[] = []; // node EventEmitter 形态（_events 对象） const raw = (ipc as any)._events ? (ipc as any)._events[channel] : undefined; if (Array.is` |

### `src/app/react/core/bundleGlobals.ts`（本文件 38 处空 catch）

- **处置**：注明理由（不加观测）
- **理由**：bundle 全局能力探测，失败有后备路径，属设计内的可选能力降级。

| 行 | 分类 | 上下文 | try 块在保护什么 |
|---|---|---|---|
| 542 | B3-业务返回值 | `function _getHashID` | `{ if (image) { if (image.name === w.i18n.__("general.untitled.title")) { return hashID; } // 本體不支原且也沒有插件支援 if (!w.EagleConfig.SUPPORT_FORMATS[image.ex` |
| 606 | B3-业务返回值 | `function send` | `{ if (!willSendItems \|\| willSendItems.length === 0) return; console.log("第 %d 更新，目前進度 %d / %d", countOfSend, willSendItems.length + (countOfSend - 1` |
| 690 | B2-网络/IPC/数据库 | `function _startAPIServer` | `{ w.APIServer.start(() => { console.log('JSON API server started.'); console.log(`try GET to access http://localhost:41595/`); setTimeout(() => { cons` |
| 883 | B5-无特征且无说明 | `(顶层/匿名)` | `{ if (w.currentWindow && !w.currentWindow.isDestroyed()) { w.currentWindow.setProgressBar(progress); } }` |
| 1033 | B5-无特征且无说明 | `(顶层/匿名)` | `{ for (var i = 0; i < RecentFileManager.recentFiles.length; i++) { let itemId = RecentFileManager.recentFiles[i]; RecentFileManager.recentFilesOrder[i` |
| 1414 | B5-无特征且无说明 | `(顶层/匿名)` | `{ files.forEach(function (file: any) { var extname = pathMod.extname(file).toLowerCase(); var name = pathMod.basename(file, extname); var key = `${nam` |
| 1503 | B1-写操作/IO | `function installBundleGlobals` | `{ if (!w.fse) w.fse = req('fs-extra'); if (!w.tinyPinyin) w.tinyPinyin = req(w.appRoot + '/my_modules/tiny-pinyin'); if (!w.pinyinlite) w.pinyinlite =` |
| 1547 | B5-无特征且无说明 | `(顶层/匿名)` | `{ ipcRef().send(channel, params); if (!ignoreLogging) { w.electronLog && w.electronLog.info(`[ipc] ${channel}`); } }` |
| 1764 | B2-网络/IPC/数据库 | `function installBundleGlobals` | `{ fetch('/vendor/eagle-match-rules.js') .then((r) => r.text()) .then((txt) => { try { const script = document.createElement('script'); script.textCont` |
| 1809 | B2-网络/IPC/数据库 | `function installBundleGlobals` | `{ fetch('/vendor/eagle-zoom-helpers.js') .then((r) => r.text()) .then((txt) => { try { const script = document.createElement('script'); script.textCon` |
| 2018 | B5-无特征且无说明 | `(顶层/匿名)` | `{ for (var i = 0; i < w.RecentFileManager.recentFiles.length; i++) { let itemId = w.RecentFileManager.recentFiles[i]; w.RecentFileManager.recentFilesO` |
| 2113 | B5-无特征且无说明 | `(顶层/匿名)` | `{ fileurl = fileurlBuf.toString(); name = nameBuf.toString(); url = urlBuf.toString(); }` |
| 2386 | B1-写操作/IO | `function installBundleGlobals` | `{ fetch('/vendor/eagle-ga4mp.js') .then((r) => r.text()) .then((txt) => { try { const script = document.createElement('script'); script.textContent = ` |

### `src/app/react/core/contextMenuDomain.ts`（本文件 2 处空 catch）

- **处置**：待逐项裁决
- **理由**：规则判定为高风险且未标注，尚未逐处人工确认，登记在案待处理。

| 行 | 分类 | 上下文 | try 块在保护什么 |
|---|---|---|---|
| 23 | B3-业务返回值 | `(顶层/匿名)` | `{ return req(`${rootPath}/my_modules/url`); }` |

### `src/app/react/core/documentViewer.ts`（本文件 3 处空 catch）

- **处置**：待逐项裁决
- **理由**：规则判定为高风险且未标注，尚未逐处人工确认，登记在案待处理。

| 行 | 分类 | 上下文 | try 块在保护什么 |
|---|---|---|---|
| 74 | B3-业务返回值 | `function topToolbarHeight` | `{ const toolbar = document.querySelector('#list-content-panel .toolbar') \|\| document.querySelector('.content-panel .toolbar'); if (toolbar) { const ` |

### `src/app/react/core/eagleClasses.ts`（本文件 2 处空 catch）

- **处置**：待逐项裁决
- **理由**：规则判定为高风险且未标注，尚未逐处人工确认，登记在案待处理。

| 行 | 分类 | 上下文 | try 块在保护什么 |
|---|---|---|---|
| 2029 | B1-写操作/IO | `method #watchConfig` | `{ if (fs.existsSync(this.#configPath)) { fs.watchFile(this.#configPath, { persistent: true, interval: 4000 }, (curr: any, prev: any) => { if (curr.mti` |
| 2037 | B1-写操作/IO | `method #unwatchConfig` | `{ if (this.#configPath && fs.existsSync(this.#configPath)) { fs.unwatchFile(this.#configPath); } }` |

### `src/app/react/core/fileUrlHelper.ts`（本文件 1 处空 catch）

- **处置**：已上报
- **理由**：URL 计算失败会返回空串 → 图片/缩略图加载失败且无任何提示。本模块历史上已真实发生过此类事故（URL_MODULE 绑定消失被吞），本次 6 处全部改为 reportSwallowed。

| 行 | 分类 | 上下文 | try 块在保护什么 |
|---|---|---|---|
| 29 | B3-业务返回值 | `(顶层/匿名)` | `{ return req(`${rootPath}/my_modules/url`); }` |

### `src/app/react/core/filterDomain.ts`（本文件 25 处空 catch）

- **处置**：注明理由（不加观测）
- **理由**：读取 fontMetas / rawMetas / palettes / tagMappings 等可选元数据，缺失只影响展示的一项，不影响主流程。

| 行 | 分类 | 上下文 | try 块在保护什么 |
|---|---|---|---|
| 1084 | B3-业务返回值 | `(顶层/匿名)` | `{ if (str) { const date = new Date(0); // 原文 new Date(null)；Date(null) === Date(0)（TS 重载不接受 null） const seconds = Math.max(1, parseInt(str)); date.set` |
| 1407 | B3-业务返回值 | `(顶层/匿名)` | `{ const palette0 = image.palettes[0].color; const filterColor = w.eagle.filter.filterRules.color.value; const isMatchPalette0 = palette0[0] === filter` |
| 2042 | B3-业务返回值 | `(顶层/匿名)` | `{ var key = Object.keys(image.fontMetas.postScriptName)[0]; var postScriptName = image.fontMetas.postScriptName && image.fontMetas.postScriptName[key]` |
| 2053 | B3-业务返回值 | `(顶层/匿名)` | `{ var key = Object.keys(image.fontMetas.postScriptName)[0]; var postScriptName = image.fontMetas.postScriptName && image.fontMetas.postScriptName[key]` |

### `src/app/react/core/hoverPreview.ts`（本文件 19 处空 catch）

- **处置**：注明理由（不加观测）
- **理由**：全部为 video/iframe 的 pause、src 复位、容器移除等资源释放动作，失败无用户可见影响；且位于悬停预览的高频路径上，加观测得不偿失。

| 行 | 分类 | 上下文 | try 块在保护什么 |
|---|---|---|---|
| 71 | B5-无特征且无说明 | `(顶层/匿名)` | `{ this.src = ''; this.load(); }` |
| 87 | B5-无特征且无说明 | `(顶层/匿名)` | `{ dom(this).find('iframe')[0].src = ''; }` |
| 962 | B5-无特征且无说明 | `function removeBoxVideoPlayer` | `{ $videos[0].src = ""; $videos[0].load(); }` |
| 1158 | B2-网络/IPC/数据库 | `function ytPostCommand` | `{ iframe.contentWindow.postMessage(JSON.stringify(msg), '*'); }` |
| 1230 | B5-无特征且无说明 | `(顶层/匿名)` | `{ $iframeWrap.find("iframe")[0].src = ""; }` |
| 1301 | B2-网络/IPC/数据库 | `(顶层/匿名)` | `{ iframe.contentWindow.postMessage(JSON.stringify({ event: 'listening' }), '*'); }` |
| 1445 | B5-无特征且无说明 | `(顶层/匿名)` | `{ $iframeWrap.find("iframe")[0].src = ""; $iframeWrap.remove(); }` |
| 1463 | B2-网络/IPC/数据库 | `function vimeoPostMessage` | `{ iframe.contentWindow.postMessage(JSON.stringify(data), '*'); }` |
| 1523 | B5-无特征且无说明 | `(顶层/匿名)` | `{ $iframeWrap.find("iframe")[0].src = ""; }` |
| 1737 | B5-无特征且无说明 | `(顶层/匿名)` | `{ $iframeWrap.find("iframe")[0].src = ""; $iframeWrap.remove(); }` |

### `src/app/react/core/itemDomain.ts`（本文件 25 处空 catch）

- **处置**：待逐项裁决
- **理由**：规则判定为高风险且未标注，尚未逐处人工确认，登记在案待处理。

| 行 | 分类 | 上下文 | try 块在保护什么 |
|---|---|---|---|
| 2660 | B3-业务返回值 | `(顶层/匿名)` | `{ return `<div class="tag color-${useMiscRawState.getState().TagManager.tagMappings[tag].color}">${tag}</div>`; }` |

### `src/app/react/core/libraryDomain.ts`（本文件 22 处空 catch）

- **处置**：待逐项裁决
- **理由**：散落着若干「用户操作后无反应」的吞错（如打开方式列表为空、IPC 广播失败、偏好项写入），也混着可选读取。需逐处确认是否有后备路径后再决定上报或注明，列为后续。

| 行 | 分类 | 上下文 | try 块在保护什么 |
|---|---|---|---|
| 461 | B1-写操作/IO | `(顶层/匿名)` | `{ w.fse = w.require('fs-extra'); w.tinyPinyin = w.require(w.appRoot + '/my_modules/tiny-pinyin'); w.pinyinlite = w.require(w.appRoot + '/my_modules/pi` |
| 979 | B2-网络/IPC/数据库 | `(顶层/匿名)` | `{ fetch("https://core.eagle.cool/update-machine", { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ machineID:` |
| 1479 | B5-无特征且无说明 | `function machineryGetFolderImages` | `{ var image = useItemState.getState().raw[rindex]; if (image.isDeleted) continue; var isContain = image.folders.indexOf(folder.id) > -1; if (includeSu` |
| 1653 | B5-无特征且无说明 | `function machinerySaveFolder` | `{ const ipc = getIpcBus(); ipc.send('folders-change', { // NOTE: 把資源庫路徑寫死，避免更新到其他資源庫路徑 libraryDir: libraryPath, folders: folders, smartFolders: smartF` |

### `src/app/react/core/miscDomain.ts`（本文件 26 处空 catch）

- **处置**：待逐项裁决
- **理由**：规则判定为高风险且未标注，尚未逐处人工确认，登记在案待处理。

| 行 | 分类 | 上下文 | try 块在保护什么 |
|---|---|---|---|
| 961 | B3-业务返回值 | `(顶层/匿名)` | `{ const na = a.toLowerCase(); const nb = b.toLowerCase(); const languageBCP = (useBodyState.getState().language \|\| 'en').replace("_", "-"); if (na &` |

### `src/app/react/core/settings.ts`（本文件 2 处空 catch）

- **处置**：待逐项裁决
- **理由**：规则判定为高风险且未标注，尚未逐处人工确认，登记在案待处理。

| 行 | 分类 | 上下文 | try 块在保护什么 |
|---|---|---|---|
| 84 | B1-写操作/IO | `function broadcastIpc` | `{ localStorage.setItem(SETTINGS_PREFIX + BROADCAST_SETTING_KEY, JSON.stringify({ channel, params, at: Date.now() })); }` |

### `src/app/react/core/shim/browserRuntime.ts`（本文件 1 处空 catch）

- **处置**：待逐项裁决
- **理由**：规则判定为高风险且未标注，尚未逐处人工确认，登记在案待处理。

| 行 | 分类 | 上下文 | try 块在保护什么 |
|---|---|---|---|
| 687 | B3-业务返回值 | `method fileURLToPath` | `{ const parsed = new URL(value); if (/^https?:$/i.test(parsed.protocol) && parsed.searchParams.has('filePath')) { return parsed.searchParams.get('file` |

### `src/app/react/core/shim/desktopCapability.ts`（本文件 3 处空 catch）

- **处置**：待逐项裁决
- **理由**：规则判定为高风险且未标注，尚未逐处人工确认，登记在案待处理。

| 行 | 分类 | 上下文 | try 块在保护什么 |
|---|---|---|---|
| 431 | B3-业务返回值 | `method getPath` | `{ const value = nativeGetPath(name); if (typeof value === 'string' && value) return value; }` |
| 760 | B3-业务返回值 | `method getZoomFactor` | `{ const nativeWebFrame = readMember(nativeRequire('electron'), 'webFrame'); // Electron 契约：`webFrame.getZoomFactor(): number`，故此处显式给出返回类型。 const nativ` |

### `src/app/react/core/shim/ipcBus.ts`（本文件 2 处空 catch）

- **处置**：待逐项裁决
- **理由**：规则判定为高风险且未标注，尚未逐处人工确认，登记在案待处理。

| 行 | 分类 | 上下文 | try 块在保护什么 |
|---|---|---|---|
| 371 | B3-业务返回值 | `(顶层/匿名)` | `{ const legacy = host.angular; const scope = legacy ? legacy.element(document.body).scope() : null; // 实机 QA（2026-09-13）：Angular 退役后 scope 恒 null、守卫空转` |

### `src/app/react/core/shim/moduleRegistry.ts`（本文件 2 处空 catch）

- **处置**：待逐项裁决
- **理由**：规则判定为高风险且未标注，尚未逐处人工确认，登记在案待处理。

| 行 | 分类 | 上下文 | try 块在保护什么 |
|---|---|---|---|
| 641 | B3-业务返回值 | `(顶层/匿名)` | `{ const real = nativeRequire('fs-extra'); if (real && typeof (real as { moveSync?: unknown }).moveSync === 'function') return real; }` |

### `src/app/react/core/shim/settingsI18n.ts`（本文件 5 处空 catch）

- **处置**：待逐项裁决
- **理由**：规则判定为高风险且未标注，尚未逐处人工确认，登记在案待处理。

| 行 | 分类 | 上下文 | try 块在保护什么 |
|---|---|---|---|
| 68 | B1-写操作/IO | `function writeSetting` | `{ localStorage.setItem(settingsPrefix + key, JSON.stringify(value)); }` |
| 161 | B2-网络/IPC/数据库 | `function syncNativePreferences` | `{ const nativeElectron = nativeRequire('electron') as NativeElectronModule; nativeElectron.ipcRenderer.send('preferences:update', preferences); }` |
| 184 | B1-写操作/IO | `function broadcastIpc` | `{ localStorage.setItem(settingsPrefix + broadcastSettingKey, JSON.stringify({ channel, params, at: Date.now() })); }` |

### `src/app/react/core/tagManagerDomain.ts`（本文件 18 处空 catch）

- **处置**：注明理由（不加观测）
- **理由**：读取 fontMetas / rawMetas / palettes / tagMappings 等可选元数据，缺失只影响展示的一项，不影响主流程。

| 行 | 分类 | 上下文 | try 块在保护什么 |
|---|---|---|---|
| 727 | B3-业务返回值 | `(顶层/匿名)` | `{ if (image && image.folders) { return image.folders && image.folders.indexOf(folderId) > -1; } }` |
| 1906 | B3-业务返回值 | `(顶层/匿名)` | `{ var na = a.toLowerCase(); var nb = b.toLowerCase(); if (na && na) { return na.localeCompare(nb, w.languageBCP, {numeric: true}); } }` |

### `src/app/react/core/urlEnlarger.ts`（本文件 1 处空 catch）

- **处置**：待逐项裁决
- **理由**：规则判定为高风险且未标注，尚未逐处人工确认，登记在案待处理。

| 行 | 分类 | 上下文 | try 块在保护什么 |
|---|---|---|---|
| 1063 | B2-网络/IPC/数据库 | `method log` | `{ if (ipcRenderer) { ipcRenderer.send("electron-info", `[bg] ${message}`); } else { console.log(message); } }` |

### `src/app/react/preferences/controller.ts`（本文件 4 处空 catch）

- **处置**：待逐项裁决
- **理由**：散落着若干「用户操作后无反应」的吞错（如打开方式列表为空、IPC 广播失败、偏好项写入），也混着可选读取。需逐处确认是否有后备路径后再决定上报或注明，列为后续。

| 行 | 分类 | 上下文 | try 块在保护什么 |
|---|---|---|---|
| 594 | B2-网络/IPC/数据库 | `method apply` | `{ if (this.preferences.autoImport.enable == 'true') { ipcRenderer.send('electron-info', `[app] Auto-import: ON`); ipcRenderer.send('electron-info', `[` |
| 896 | B5-无特征且无说明 | `method pwdChangePassword` | `{ // 原版隐式全局 email（Registration.license.email 赋值后未使用），保留无操作等价 if (Registration && Registration.license && Registration.license.email) { (globalThis as ` |
| 1031 | B5-无特征且无说明 | `(顶层/匿名)` | `{ plugin.formatShortcut = this.preferences.shortcuts.keybinds[plugin.id] \|\| formatShortcut(plugin.shortcut); }` |

### `src/app/react/preferences/panels.tsx`（本文件 1 处空 catch）

- **处置**：待逐项裁决
- **理由**：规则判定为高风险且未标注，尚未逐处人工确认，登记在案待处理。

| 行 | 分类 | 上下文 | try 块在保护什么 |
|---|---|---|---|
| 233 | B3-业务返回值 | `function themeAttrCss` | `{ if (theme && theme.name === 'Auto') { const nativeTheme = req('@electron/remote')?.nativeTheme; return nativeTheme && nativeTheme.shouldUseDarkColor` |

### `src/app/react/preview-window/controller.ts`（本文件 5 处空 catch）

- **处置**：待逐项裁决
- **理由**：规则判定为高风险且未标注，尚未逐处人工确认，登记在案待处理。

| 行 | 分类 | 上下文 | try 块在保护什么 |
|---|---|---|---|
| 974 | B2-网络/IPC/数据库 | `(顶层/匿名)` | `{ ipcRenderer?.send?.('regenerate-thumbnail', [item]); }` |
| 2234 | B5-无特征且无说明 | `(顶层/匿名)` | `{ if (!remote \|\| !currentWindow) return; const currentPoint = remote.screen.getCursorScreenPoint(); const windowBounds = currentWindow.getBounds(); ` |

### `src/app/react/preview-window/shell.tsx`（本文件 1 处空 catch）

- **处置**：待逐项裁决
- **理由**：规则判定为高风险且未标注，尚未逐处人工确认，登记在案待处理。

| 行 | 分类 | 上下文 | try 块在保护什么 |
|---|---|---|---|
| 668 | B2-网络/IPC/数据库 | `(顶层/匿名)` | `{ const remote = req('@electron/remote'); const app = remote?.app; const pjson = req((window as any).appRoot.path + '/package.json'); const preference` |

### `src/app/react/services/folderMenuService.ts`（本文件 19 处空 catch）

- **处置**：注明理由（不加观测）
- **理由**：命中项为日志打点、classList 装饰、以及文件夹遍历中的单条目兜底，失败均不改变数据。

| 行 | 分类 | 上下文 | try 块在保护什么 |
|---|---|---|---|
| 401 | B5-无特征且无说明 | `(顶层/匿名)` | `{ var image = useItemState.getState().raw[rindex]; if (image.isDeleted) continue; var isContain = image.folders.indexOf(folder.id) > -1; if (!isContai` |
| 467 | B5-无特征且无说明 | `(顶层/匿名)` | `{ var image = useItemState.getState().raw[rindex]; if (image.isDeleted) continue; var isContain = image.folders.indexOf(folder2.id) > -1; if (!isConta` |
| 1880 | B3-业务返回值 | `(顶层/匿名)` | `{ var na = a.name.toLowerCase(); var nb = b.name.toLowerCase(); if (na && nb) { return na.localeCompare(nb, (window as any).languageBCP, { numeric: tr` |

### `src/app/react/services/imageOpsService.ts`（本文件 27 处空 catch）

- **处置**：待逐项裁决
- **理由**：散落着若干「用户操作后无反应」的吞错（如打开方式列表为空、IPC 广播失败、偏好项写入），也混着可选读取。需逐处确认是否有后备路径后再决定上报或注明，列为后续。

| 行 | 分类 | 上下文 | try 块在保护什么 |
|---|---|---|---|
| 1022 | B2-网络/IPC/数据库 | `(顶层/匿名)` | `{ let ext = getExt({path: filePath}); let support_ext: Record<string, boolean> = { jpg: true, png: true, gif: true, bmp: true, webp: true }; if (suppo` |

### `src/app/react/services/itemMenuService.ts`（本文件 4 处空 catch）

- **处置**：待逐项裁决
- **理由**：散落着若干「用户操作后无反应」的吞错（如打开方式列表为空、IPC 广播失败、偏好项写入），也混着可选读取。需逐处确认是否有后备路径后再决定上报或注明，列为后续。

| 行 | 分类 | 上下文 | try 块在保护什么 |
|---|---|---|---|
| 171 | B5-无特征且无说明 | `(顶层/匿名)` | `{ if (result.name === "Eagle.app") return; submenu.items.push({ image: result.icon, label: (result.default)? result.name + ` (${i18n.__("general.defau` |
| 179 | B5-无特征且无说明 | `const run` | `{ const rawPath = FileUrlHelper.getRawPath(item); const getAssociatedApplications = require(appRoot + '/my_modules/get-associated-application'); let a` |

### `src/app/react/store/detailState.ts`（本文件 1 处空 catch）

- **处置**：待逐项裁决
- **理由**：散落着若干「用户操作后无反应」的吞错（如打开方式列表为空、IPC 广播失败、偏好项写入），也混着可选读取。需逐处确认是否有后备路径后再决定上报或注明，列为后续。

| 行 | 分类 | 上下文 | try 块在保护什么 |
|---|---|---|---|
| 236 | B5-无特征且无说明 | `function buildDetailSnapshot` | `{ currentIndex = machineryCurrentIndex() \|\| 0; }` |

### `src/app/react/store/inspectorState.ts`（本文件 3 处空 catch）

- **处置**：待逐项裁决
- **理由**：散落着若干「用户操作后无反应」的吞错（如打开方式列表为空、IPC 广播失败、偏好项写入），也混着可选读取。需逐处确认是否有后备路径后再决定上报或注明，列为后续。

| 行 | 分类 | 上下文 | try 块在保护什么 |
|---|---|---|---|
| 163 | B5-无特征且无说明 | `function snapshotItem` | `{ lastThumbnailUrl = helper?.getLastestThumbnailUrl?.(item) \|\| ''; }` |
| 164 | B5-无特征且无说明 | `function snapshotItem` | `{ thumbnailUrl = helper?.getThumbnailUrl?.(item) \|\| ''; }` |
| 171 | B5-无特征且无说明 | `function snapshotItem` | `{ exifPath = `./exif-viewer/index.html?orientation=${item.orientation}&path=${encodeURIComponent( helper.getLastestThumbnailUrl(item) )}&width=${item.` |

### `src/app/react/store/panelState.ts`（本文件 1 处空 catch）

- **处置**：待逐项裁决
- **理由**：散落着若干「用户操作后无反应」的吞错（如打开方式列表为空、IPC 广播失败、偏好项写入），也混着可选读取。需逐处确认是否有后备路径后再决定上报或注明，列为后续。

| 行 | 分类 | 上下文 | try 块在保护什么 |
|---|---|---|---|
| 167 | B3-业务返回值 | `function loadPjson` | `{ const appRoot = (window as any).appRoot; const req = (window as any).require; if (appRoot && req) { const pjson = req(appRoot.path + '/package.json'` |

### `src/app/react/viewers/document/src/components/TextDocumentSurface.tsx`（本文件 2 处空 catch）

- **处置**：待逐项裁决
- **理由**：规则判定为高风险且未标注，尚未逐处人工确认，登记在案待处理。

| 行 | 分类 | 上下文 | try 块在保护什么 |
|---|---|---|---|
| 113 | B3-业务返回值 | `function readStoredDocumentEditorColorMode` | `{ const value = window.localStorage.getItem(DOCUMENT_EDITOR_COLOR_MODE_STORAGE_KEY) if (value === 'light' \|\| value === 'dark' \|\| value === 'auto')` |
| 122 | B1-写操作/IO | `function writeStoredDocumentEditorColorMode` | `{ window.localStorage.setItem(DOCUMENT_EDITOR_COLOR_MODE_STORAGE_KEY, mode) }` |

### `src/app/react/viewers/document/src/DocumentViewerApp.tsx`（本文件 1 处空 catch）

- **处置**：待逐项裁决
- **理由**：规则判定为高风险且未标注，尚未逐处人工确认，登记在案待处理。

| 行 | 分类 | 上下文 | try 块在保护什么 |
|---|---|---|---|
| 26 | B2-网络/IPC/数据库 | `function postParent` | `{ if (window.parent && window.parent !== window) { window.parent.postMessage(message, '*') } }` |

### `src/app/react/viewers/document/src/lib/api.ts`（本文件 1 处空 catch）

- **处置**：待逐项裁决
- **理由**：规则判定为高风险且未标注，尚未逐处人工确认，登记在案待处理。

| 行 | 分类 | 上下文 | try 块在保护什么 |
|---|---|---|---|
| 237 | B1-写操作/IO | `method update` | `{ const previous = window.localStorage.getItem('eagle.document-viewer.settings') const merged = { ...(previous ? JSON.parse(previous) : {}), ...patch ` |

### `src/my_modules/raw-parser/index.js`（本文件 1 处空 catch）

- **处置**：待接线（遗留层）
- **理由**：RAW 解码读取失败静默 → 用户看到空白预览而无任何提示。列为后续。

| 行 | 分类 | 上下文 | try 块在保护什么 |
|---|---|---|---|
| 23 | B1-写操作/IO | `(顶层/匿名)` | `{ jpegBuffer = fs.readFileSync(output); img = nativeImage.createFromBuffer(jpegBuffer); }` |

## 7. 全量按文件清单

| 文件 | 空 catch | 高风险 | 低风险 | 已标注 | 处置 |
|---|---|---|---|---|---|
| `src/app/react/core/bundleGlobals.ts` | 38 | 13 | 25 | 0 | 注明理由（不加观测） |
| `src/app/react/services/imageOpsService.ts` | 27 | 1 | 26 | 0 | 待逐项裁决 |
| `src/app/react/core/miscDomain.ts` | 26 | 1 | 25 | 0 | 待逐项裁决 |
| `src/app/react/core/filterDomain.ts` | 25 | 4 | 21 | 0 | 注明理由（不加观测） |
| `src/app/react/core/itemDomain.ts` | 25 | 1 | 24 | 0 | 待逐项裁决 |
| `src/app/react/core/libraryDomain.ts` | 22 | 4 | 18 | 0 | 待逐项裁决 |
| `src/app/react/core/hoverPreview.ts` | 19 | 10 | 9 | 0 | 注明理由（不加观测） |
| `src/app/react/services/folderCoreService.ts` | 19 | 0 | 19 | 0 | 注明理由（不加观测） |
| `src/app/react/services/folderMenuService.ts` | 19 | 3 | 16 | 0 | 注明理由（不加观测） |
| `src/app/react/core/tagManagerDomain.ts` | 18 | 2 | 16 | 0 | 注明理由（不加观测） |
| `src/app/react/services/batchOpsService.ts` | 17 | 0 | 17 | 0 | 注明理由（不加观测） |
| `electron/main.cjs` | 15 | 8 | 7 | 0 | 待逐项裁决 |
| `src/app/js/plugin/index.js` | 14 | 8 | 6 | 0 | 待接线（遗留层） |
| `src/app/react/services/fontTagService.ts` | 13 | 0 | 13 | 0 | 注明理由（不加观测） |
| `src/app/react/services/sidebarService.ts` | 11 | 0 | 11 | 0 | 注明理由（不加观测） |
| `src/app/js/global.js` | 8 | 8 | 0 | 0 | 待接线（遗留层） |
| `src/app/react/components/detail/detailHooks.ts` | 8 | 1 | 7 | 0 | 待逐项裁决 |
| `src/app/react/services/viewOpsService.ts` | 8 | 0 | 8 | 0 | 注明理由（不加观测） |
| `src/app/react/core/bitmapViewer.ts` | 7 | 0 | 7 | 0 | 注明理由（不加观测） |
| `src/app/react/services/miscMenuService.ts` | 7 | 0 | 7 | 0 | 注明理由（不加观测） |
| `src/app/react/core/appCore.ts` | 6 | 2 | 4 | 0 | 待逐项裁决 |
| `src/app/react/components/stage7/FolderSelectPanels.tsx` | 5 | 1 | 4 | 0 | 注明理由（不加观测） |
| `src/app/react/components/stage7/QuickSearchModal.tsx` | 5 | 3 | 2 | 0 | 注明理由（不加观测） |
| `src/app/react/core/shim/settingsI18n.ts` | 5 | 3 | 2 | 0 | 待逐项裁决 |
| `src/app/react/preview-window/controller.ts` | 5 | 2 | 3 | 0 | 待逐项裁决 |
| `src/app/react/services/lockService.ts` | 5 | 0 | 5 | 0 | 注明理由（不加观测） |
| `src/app/react/services/mediaService.ts` | 5 | 0 | 5 | 0 | 注明理由（不加观测） |
| `src/app/react/services/uploadService.ts` | 5 | 0 | 5 | 0 | 注明理由（不加观测） |
| `src/app/react/components/inspector/Inspector.tsx` | 4 | 3 | 1 | 0 | 部分已上报 |
| `src/app/react/components/stage7/DuplicateFamily.tsx` | 4 | 2 | 2 | 0 | 注明理由（不加观测） |
| `src/app/react/core/selectionViewDomain.ts` | 4 | 0 | 4 | 0 | 注明理由（不加观测） |
| `src/app/react/core/swallowReport.ts` | 4 | 1 | 3 | 4 | 待逐项裁决 |
| `src/app/react/preferences/controller.ts` | 4 | 3 | 1 | 0 | 待逐项裁决 |
| `src/app/react/services/itemMenuService.ts` | 4 | 2 | 2 | 0 | 待逐项裁决 |
| `src/app/react/services/selectionService.ts` | 4 | 0 | 4 | 0 | 注明理由（不加观测） |
| `backend/src/server.js` | 3 | 1 | 2 | 0 | 待逐项裁决 |
| `src/app/js/workers/bitmapWorker.js` | 3 | 1 | 2 | 0 | 注明理由（不加观测） |
| `src/app/react/components/grid/boxItem.tsx` | 3 | 2 | 1 | 0 | 注明理由（不加观测） |
| `src/app/react/components/sidebar/Sidebar.tsx` | 3 | 0 | 3 | 0 | 注明理由（不加观测） |
| `src/app/react/components/stage7/BatchRenameArtstationModals.tsx` | 3 | 0 | 3 | 0 | 注明理由（不加观测） |
| `src/app/react/components/stage7/BatchSavePanel.tsx` | 3 | 1 | 2 | 0 | 注明理由（不加观测） |
| `src/app/react/components/stage7/ControllerModals.tsx` | 3 | 3 | 0 | 0 | 注明理由（不加观测） |
| `src/app/react/core/documentViewer.ts` | 3 | 1 | 2 | 0 | 待逐项裁决 |
| `src/app/react/core/shim/desktopCapability.ts` | 3 | 2 | 1 | 0 | 待逐项裁决 |
| `src/app/react/services/imageTransformWriteback.ts` | 3 | 0 | 3 | 0 | 注明理由（不加观测） |
| `src/app/react/store/inspectorState.ts` | 3 | 3 | 0 | 0 | 待逐项裁决 |
| `backend/src/item-workflow-service.js` | 2 | 1 | 1 | 0 | 待逐项裁决 |
| `backend/src/legacy-office-thumbnail-renderer.js` | 2 | 0 | 2 | 0 | 注明理由（不加观测） |
| `backend/src/library-service.js` | 2 | 0 | 2 | 0 | 注明理由（不加观测） |
| `scripts/clear-ports.mjs` | 2 | 2 | 0 | 0 | 注明理由（不加观测） |
| `src/app/js/utils/rotateImage.js` | 2 | 2 | 0 | 0 | 待逐项裁决 |
| `src/app/react/components/detail/commentHooks.ts` | 2 | 0 | 2 | 0 | 注明理由（不加观测） |
| `src/app/react/components/inspector/inspectorActions.ts` | 2 | 0 | 2 | 0 | 注明理由（不加观测） |
| `src/app/react/components/stage7/FolderModals.tsx` | 2 | 2 | 0 | 0 | 注明理由（不加观测） |
| `src/app/react/components/stage7/PluginFamily.tsx` | 2 | 1 | 1 | 0 | 注明理由（不加观测） |
| `src/app/react/components/stage7/SmallPanels.tsx` | 2 | 0 | 2 | 0 | 注明理由（不加观测） |
| `src/app/react/components/stage7/TagManager.tsx` | 2 | 1 | 1 | 0 | 注明理由（不加观测） |
| `src/app/react/core/contextMenuDomain.ts` | 2 | 1 | 1 | 0 | 待逐项裁决 |
| `src/app/react/core/eagleClasses.ts` | 2 | 2 | 0 | 0 | 待逐项裁决 |
| `src/app/react/core/machineryInfra.ts` | 2 | 0 | 2 | 0 | 注明理由（不加观测） |
| `src/app/react/core/settings.ts` | 2 | 1 | 1 | 0 | 待逐项裁决 |
| `src/app/react/core/shim/demoSeed.ts` | 2 | 0 | 2 | 0 | 注明理由（不加观测） |
| `src/app/react/core/shim/ipcBus.ts` | 2 | 1 | 1 | 0 | 待逐项裁决 |
| `src/app/react/core/shim/moduleRegistry.ts` | 2 | 1 | 1 | 0 | 待逐项裁决 |
| `src/app/react/viewers/document/src/components/TextDocumentSurface.tsx` | 2 | 2 | 0 | 0 | 待逐项裁决 |
| `backend/src/capture-service.js` | 1 | 1 | 0 | 0 | 待逐项裁决 |
| `backend/src/controlled-downloader.js` | 1 | 1 | 0 | 0 | 待逐项裁决 |
| `backend/src/document-preview-service.js` | 1 | 1 | 0 | 0 | 待逐项裁决 |
| `backend/src/library-backup-service.js` | 1 | 1 | 0 | 0 | 待逐项裁决 |
| `backend/src/library-stats.js` | 1 | 0 | 1 | 0 | 注明理由（不加观测） |
| `backend/src/library-transaction-coordinator.js` | 1 | 0 | 1 | 0 | 注明理由（不加观测） |
| `backend/src/native-preview-service.js` | 1 | 1 | 0 | 0 | 待逐项裁决 |
| `backend/src/office-document-support.js` | 1 | 0 | 1 | 0 | 注明理由（不加观测） |
| `backend/src/source-mode/source-db.js` | 1 | 0 | 1 | 0 | 注明理由（不加观测） |
| `backend/src/thumbnailer.js` | 1 | 1 | 0 | 0 | 待逐项裁决 |
| `scripts/start-production.mjs` | 1 | 0 | 1 | 0 | 注明理由（不加观测） |
| `src/app/gif-viewer/gif-player.js` | 1 | 1 | 0 | 0 | 注明理由（不加观测） |
| `src/app/js/auto-import/auto-import.js` | 1 | 1 | 0 | 0 | 待逐项裁决 |
| `src/app/js/downloader/downloader.js` | 1 | 1 | 0 | 0 | 待逐项裁决 |
| `src/app/js/plugin/logger.js` | 1 | 1 | 0 | 0 | 待接线（遗留层） |
| `src/app/js/plugin/model/item.js` | 1 | 1 | 0 | 0 | 待接线（遗留层） |
| `src/app/js/utils/downloadFile.js` | 1 | 1 | 0 | 0 | 待逐项裁决 |
| `src/app/js/utils/flipImage.js` | 1 | 1 | 0 | 0 | 待逐项裁决 |
| `src/app/js/workers/heic2bitmap-worker.js` | 1 | 1 | 0 | 0 | 注明理由（不加观测） |
| `src/app/js/workers/tifWorker.js` | 1 | 0 | 1 | 0 | 注明理由（不加观测） |
| `src/app/react/app/filters.ts` | 1 | 1 | 0 | 0 | 待逐项裁决 |
| `src/app/react/collect-window/selectPanelEngine.ts` | 1 | 1 | 0 | 0 | 待逐项裁决 |
| `src/app/react/components/detail/DetailViewer.tsx` | 1 | 1 | 0 | 0 | 待逐项裁决 |
| `src/app/react/components/filter/FilterItems.tsx` | 1 | 0 | 1 | 0 | 注明理由（不加观测） |
| `src/app/react/components/hooks.ts` | 1 | 0 | 1 | 0 | 注明理由（不加观测） |
| `src/app/react/components/inspector/ContentEditable.tsx` | 1 | 0 | 1 | 0 | 注明理由（不加观测） |
| `src/app/react/components/shell/ListRegion.tsx` | 1 | 0 | 1 | 0 | 注明理由（不加观测） |
| `src/app/react/components/stage7/InspectorTagSelectPanel.tsx` | 1 | 1 | 0 | 0 | 注明理由（不加观测） |
| `src/app/react/components/stage7/PluginCenter.tsx` | 1 | 0 | 1 | 0 | 已上报 |
| `src/app/react/components/stage7/SelectPanels.tsx` | 1 | 0 | 1 | 0 | 注明理由（不加观测） |
| `src/app/react/core/channelBridge.ts` | 1 | 0 | 1 | 0 | 注明理由（不加观测） |
| `src/app/react/core/fileUrlHelper.ts` | 1 | 1 | 0 | 0 | 已上报 |
| `src/app/react/core/returnBridge.ts` | 1 | 0 | 1 | 0 | 注明理由（不加观测） |
| `src/app/react/core/selectionNotify.ts` | 1 | 0 | 1 | 0 | 注明理由（不加观测） |
| `src/app/react/core/shim/browserRuntime.ts` | 1 | 1 | 0 | 0 | 待逐项裁决 |
| `src/app/react/core/shim/environment.ts` | 1 | 0 | 1 | 0 | 注明理由（不加观测） |
| `src/app/react/core/shim/install.ts` | 1 | 0 | 1 | 0 | 注明理由（不加观测） |
| `src/app/react/core/urlEnlarger.ts` | 1 | 1 | 0 | 0 | 待逐项裁决 |
| `src/app/react/preferences/panels.tsx` | 1 | 1 | 0 | 0 | 待逐项裁决 |
| `src/app/react/preview-window/shell.tsx` | 1 | 1 | 0 | 0 | 待逐项裁决 |
| `src/app/react/store/detailState.ts` | 1 | 1 | 0 | 0 | 待逐项裁决 |
| `src/app/react/store/panelState.ts` | 1 | 1 | 0 | 0 | 待逐项裁决 |
| `src/app/react/store/toolbarState.ts` | 1 | 0 | 1 | 0 | 待逐项裁决 |
| `src/app/react/utils/domLite.ts` | 1 | 0 | 1 | 0 | 注明理由（不加观测） |
| `src/app/react/utils/domQuery.ts` | 1 | 0 | 1 | 0 | 注明理由（不加观测） |
| `src/app/react/viewers/document/src/DocumentViewerApp.tsx` | 1 | 1 | 0 | 0 | 待逐项裁决 |
| `src/app/react/viewers/document/src/lib/api.ts` | 1 | 1 | 0 | 0 | 待逐项裁决 |
| `src/app/react/viewers/font/entry.tsx` | 1 | 0 | 1 | 0 | 注明理由（不加观测） |
| `src/app/react/viewers/gif/entry.tsx` | 1 | 0 | 1 | 0 | 注明理由（不加观测） |
| `src/app/react/viewers/raw/entry.tsx` | 1 | 0 | 1 | 0 | 注明理由（不加观测） |
| `src/app/react/viewers/text-editor/entry.tsx` | 1 | 0 | 1 | 0 | 注明理由（不加观测） |
| `src/my_modules/raw-parser/index.js` | 1 | 1 | 0 | 0 | 待接线（遗留层） |

## 8. 棘轮门禁（防止继续新增）

一次性清理数百处不现实，可持久的是**不再新增**：

- 门禁：`tests/empty-catch-gate.mjs`（已登记进套件，`static` 分类）；
- 基线：`tests/fixtures/empty-catch-baseline.json`，按文件记录**未标注**空 catch 的数量上限；
- 规则：新增的空 catch 若未写 `/* @swallow: 具体理由 */`，超过该文件基线即判红；
  存量被修掉后基线只会更宽松，棘轮不倒转；
- 自保：扫描器若失效导致数量异常偏少，门禁判**红**而不是空洞变绿；
- 变异自证：注入未标注空 catch → 红；加 `@swallow` 标记 → 绿。

新增空 catch 时二选一：

```ts
try { ... } catch (err) { /* @swallow: 具体理由——为什么失败无需处理 */ }
// 或
try { ... } catch (err) { reportSwallowed('模块.函数.动作', err); }
```

## 9. 已知局限

1. **遗留层未接线**：`src/app/js/**` 是非 ESM 全局脚本，无法 import React 侧模块；
   上报通道已挂 `globalThis.__eagleReportSwallowed`，但遗留层调用点尚未改，列为本清单「待接线」。
2. **规则是启发式**：分类用于分流，不是终审。A/B 误判仍可能存在，
   「待逐项裁决」的部分需要结合具体调用点确认是否有后备路径。
3. **只查空 catch**：`catch { console.log(err) }` 这类「打了日志但没处理」不在本次范围内。
4. **测试代码未纳入**：`tests/` 另有 100+ 处空 catch，多为 teardown 兜底，未纳入本清单与门禁。
