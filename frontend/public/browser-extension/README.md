# Eagle Reverse Collector（MV3 扩展）

以「加载已解压的扩展程序」加载**本目录**即可。`dist/frontend/browser-extension/` 是本目录的逐字副本
（`frontend/public/**` 由 Vite `publicDir` 原样拷贝，无构建期改写），两者内容一致。

## 端口 / 地址的单一来源

扩展要连的地址**只在 `background.js` 声明一次**（`DEFAULT_RUNTIME`）：

| 值 | 默认 | 与谁对齐 |
| --- | --- | --- |
| `apiBaseUrl` | `http://localhost:41693` | `scripts/start-production.mjs` 的 `EAGLE_EXTENSION_PORT` 默认 |
| `workbenchUrl` | `http://localhost:4173/workbench.html` | `scripts/start-production.mjs` 的 `EAGLE_FRONTEND_PORT` 默认 |

- `background.js` 直接使用这两个值；
- `popup.js` 通过 `chrome.runtime.sendMessage({ type: 'get-runtime' })` 取同一份值，**不复制常量**。

M5-1 建立的唯一地址来源 `/eagle-runtime-config.js`（经 `window.__EAGLE_*` 下发）在扩展里够不到：
MV3 service worker 没有 `window`，popup 也不与页面同源。扩展因此需要自己的一处声明。

运行期覆盖（可选，不改变默认值语义）：

```js
chrome.storage.local.set({ eagleRuntimeConfig: { apiBaseUrl: 'http://localhost:5199' } });
```

`tests/browser-extension-delivery.mjs` 会反向读取 `scripts/start-production.mjs`，校验上表两个默认值
未与生产漂移；改了生产默认端口而没改这里，该测试即失败。

## 权限面

- `host_permissions: ["http://localhost/*", "http://127.0.0.1/*"]`——loopback **全端口**。
  MV3 的 host permissions 不能在运行期变更（除非改用 `optional_host_permissions` 并弹窗申请），
  而扩展服务的端口可由 `EAGLE_EXTENSION_PORT` 配置，故按「回环地址」而非「某一端口」授权。
  这是刻意取舍：授权面收敛在 loopback（不含任何外部主机），但覆盖本机任意端口。
- `permissions: ["activeTab", "storage", "tabs"]`——
  `storage` 存运行期覆盖与安装标记；`tabs` 供 `chrome.tabs.query` / `chrome.tabs.create` /
  `chrome.tabs.captureVisibleTab`；`activeTab` 供用户手势后的当前标签访问。
- `content_scripts.matches: ["<all_urls>"]`——采集对象是**任意页面**，这是扩展的核心用途本身。

## popup 的两种加载环境

`popup.html` / `popup.js` 同时被两种环境加载，二者必须区分：

1. **真实扩展环境**：`chrome-extension://<id>/popup.html`，从磁盘读取，有扩展 API；
2. **被 HTTP 服务的演示页**：dev 中间件与 `scripts/serve-frontend.mjs` 会给它注入
   `/eagle-runtime-config.js` 后以 `http://` 提供（`tests/screenshot-regression.mjs`、
   `tests/browser-extension.mjs` 消费的就是这一份）。

`popup.js` 用 `chrome.runtime && chrome.runtime.id` 判定环境，演示态给出可读提示而不是抛
`TypeError`。磁盘副本不含注入标签，故注入不会进入扩展本体。
