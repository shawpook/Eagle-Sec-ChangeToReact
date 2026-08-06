# 拖放导入审查与修复记录

## 结论

md/txt 等文本文件无法通过原版主界面拖放导入，根因不在后端。当前改动已修复 shim 的 `is-hidden-file` mock、补齐浏览器导入回退，并让导入后的缩略图任务完成时主动通知原版界面。

## 应支持的格式

原版 `config.js` 的 `SUPPORT_FORMATS_WIN` 已覆盖图片、视频、音频、Office、PDF、字体、3D、RAW、URL 等，并且包含 `txt`，但不包含 `md`、`markdown`、`json`、`csv` 等本项目新增文本格式。

本项目后端 `importer.js` 没有扩展名白名单，`md` 通过 `/api/item/upload` 与 `/api/item/importPaths/start` 均可正常落库。因此问题集中在原版渲染层与 shim 桥接层。

## 根因

1. `frontend/public/shims.js` 把 `/my_modules/is-hidden-file` mock 成 `() => false`，但原版代码调用的是 `IS_HIDDEN_FILE.check(...)`。`txt` 在原版 `SUPPORT_FORMATS` 内不会进入该分支，`md` 会进入并抛 `TypeError`，上传队列卡住。
2. 纯浏览器打开原版页面时，`ipcRenderer.send('upload-local-files')` 没有后端回退，主区域文件拖放没有打通。
3. 后端导入时已经创建文本封面，但 renderer 没有收到 `thumbnail-generated`，所以重启后才会显示封面。

## 修改

- `frontend/public/shims.js`
  - `is-hidden-file` mock 改为原版模块形状 `{ check: () => false }`。
  - 增加浏览器主区域拖放回退，直接走 `/api/item/upload`。
  - 增加 `upload-local-files`、`upload-url`、`upload-urls` 的浏览器回退。
  - 导入项带 `thumbnailTask` 时轮询缩略图任务，完成后派发 `thumbnail-generated`。
- `electron/main.cjs` 与 `tests/main-ui-workflow-closed-loop.mjs`
  - 主界面闭环加入 txt、md 拖放导入与缩略图生成断言。

## 验证

- `node tests/main-ui-workflow-closed-loop.mjs` 通过：txt/md 均可拖放导入，并收到 `thumbnail-generated`。
- `node tests/workbench-upload.mjs` 通过。
- `node tests/text-thumbnail-closed-loop.mjs` 通过。
- 浏览器原版主界面使用无头 Chrome 验证：txt/md 通过浏览器回退可入库。
