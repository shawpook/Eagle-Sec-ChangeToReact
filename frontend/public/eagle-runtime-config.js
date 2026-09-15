/* M5-1（F22）：`/eagle-runtime-config.js` 的静态兜底副本。
 *
 * 正常情况下，页面请求本 URL 时由**当前正在服务的前端进程**按自己的启动环境重新生成内容
 * （dev：`frontend/vite.preview.config.mjs` 的中间件；生产：`scripts/serve-frontend.mjs`），
 * 生成逻辑与默认值见 `frontend/runtime-config.mjs`。
 *
 * 本文件只在一种情况下原样送达到页面：产物被一个不识别该路径的静态服务器直接托管。
 * 那时它补齐与各消费者自身兜底一致的默认端口，**不覆盖**服务端已经给出的值——
 * 因此它不会成为第二套地址来源，只是同一契约的缺省分支。
 *
 * 修改默认端口时必须同步 `frontend/runtime-config.mjs` 的 DEFAULT_PORTS。
 */
window.__EAGLE_API_BASE_URL = window.__EAGLE_API_BASE_URL || 'http://localhost:41695';
window.__EAGLE_THUMBNAIL_URL = window.__EAGLE_THUMBNAIL_URL || 'http://localhost:41692';
window.__EAGLE_EXTENSION_BASE_URL = window.__EAGLE_EXTENSION_BASE_URL || 'http://localhost:41693';
