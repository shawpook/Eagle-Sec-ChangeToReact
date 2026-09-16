# 插件根（`plugins/`）

本目录是**仓库内单一插件根**。backend 与 electron 都从这里读，不再经工作区父目录解析。

## 目录约定

```
plugins/
  example-service-plugin/   示例 service 插件（供 /plugins/eagle-reverse-example-service/**）
  _templates/               插件模板根（供 /plugin-templates/**）
    window/                 新建「窗口插件」时复制的模板
    service/                新建「服务插件」时复制的模板
    preview/                新建「格式/预览插件」时复制的模板
    inspector/              新建「检查器插件」时复制的模板
```

`_templates/` 的四个子目录名是**硬契约**：`src/app/react/components/stage7/PluginFamily.tsx`
用 `插件类型 key`（`window` / `service` / `preview` / `inspector`）拼模板路径
（`${resourcesPath}/plugin_templates/${type}`）后 `copySync`。改名会让「新建插件」复制失败。

## 对外 URL 不变

磁盘根换了，两个 HTTP 面保持不变：

| URL 前缀 | 磁盘根 |
|---|---|
| `/plugins/eagle-reverse-example-service/**` | `plugins/example-service-plugin/` |
| `/plugin-templates/**` | `plugins/_templates/` |
| `/plugins/**`（用户已安装插件） | `<userData>/Plugins/`（不属于本根） |

## 根可以被环境变量覆盖

`EAGLE_PLUGINS_ROOT` 覆盖本根（backend 与 electron 都读）。默认值是**仓库内的 `plugins/`**，
不依赖工作区父目录层级，也不依赖 `H:/dev/plugins`、`H:/resources` 这类开发机路径。

## 缺资源 = 明确失败

插件根是**随仓库交付的产品资源**，不是可选运行时数据。三个根
（`plugins/`、`plugins/example-service-plugin/`、`plugins/_templates/`）任一缺失时：

- backend 启动即抛错并以非零码退出，错误码 `PLUGIN_ROOT_MISSING` /
  `PLUGIN_EXAMPLE_MISSING` / `PLUGIN_TEMPLATES_MISSING`（见 `backend/src/server.js`）；
- electron 输出 `SERVICE_PLUGIN_LOAD_FAILED: PLUGIN_RESOURCE_MISSING: ...` 后 `app.exit(1)`
  （见 `electron/main.cjs` 的 `loadServicePlugins`）。

历史上这两条路径分别是「静默跳过（`fs.existsSync` 后 continue）」和
「`console.warn` 后继续启动」，桌面端会在插件静默不存在的状态下照常运行且退出码为 0。
用户已安装插件目录（`<userData>/Plugins/`）是**用户数据**，缺失由 `mkdirSync` 兜底，不在断言内。

## 插件页的 SDK 顺序

backend 的 `pluginHtmlMiddleware` 会把 `/plugin-shim.js` 注入到**插件自身脚本之前**
（`<head>` 起始处）。插件入口按约定写在 `<head>` 内且在顶层就调用 `eagle.onPluginCreate(...)`，
因此**不要**靠把 `<script>` 挪到 `<body>` 末尾来规避顺序问题——顺序由服务端保证。

模板目录当前内容为**重建的最小脚手架**（不含图标资源）；原 `resources/plugin_templates`
的原始内容在检出与 git 历史中均不存在。
