# 部署根布局（M8-6 固化）

> 本文件固化「生产部署副本必须长成什么形状」这一契约。它源自用户裁决 **D34：固化部署根布局，不改产品代码**
> ——即 M8-1 隔离部署门禁发现的四处「运行时资源根与发布清单落点不同根」，由**布局**收敛，不由改产品代码收敛。
>
> 门禁实现（两层，缺一不可）：
> - `tests/isolated-deployment.mjs`——**静态布局**断言：本文件每条契约在那里都有**会失败**的断言，不是打印登记。
>   另含「实际读了什么」的文件访问探针（起完整生产栈 + Electron，重）。
> - `tests/deployment-root-runtime-probe.mjs`——**运行期**断言（R2-3）：在真实部署根里起真实后端，
>   发真实 HTTP 请求，断言四处耦合点在**运行期**解析出的绝对路径落在部署根内、且读到的是**部署根里那一份**。
>   只起后端、不起 Electron，秒级～分钟级；单独跑（与其它自起后端的测试争端口）。
>
> 两层的分工：静态层证明「把路径拼出来时存在」，运行期层证明「跑起来时真的解析到了部署根里那一份」。
> `projectRoot` 若哪天被指回源工作区，静态层照样绿，只有运行期层会红。

---

## 1. 布局

运行时资源解析面（三段）：

```text
<部署根>/
  backend/     ← 耦合点 ②③④ 的锚点：projectRoot = <backend>/../..
  electron/    ← 耦合点 ①  的锚点：preload 模块作用域 __dirname = <electron>
  src/         ← 发布树的第二落点；耦合点 ①②③④ 的解析目标
```

完整的部署根——三段之外的条目是「跑起来所必需」的既有清单，见
`tests/isolated-deployment.mjs` 的 `DEPLOYMENT_TREE`（每项都带 `reason`）：

```text
<部署根>/                          <- 来源
  backend/                         backend/                    （仓库源目录）
  electron/                        electron/                   （仓库源目录）
  src/                             dist/frontend/src           （构建产物 = 发布清单产出）
  dist/frontend/                   dist/frontend               （构建产物；静态服务根）
  frontend/public/mock-library/    frontend/public/mock-library
  frontend/runtime-config.mjs      frontend/runtime-config.mjs
  plugins/                         plugins/
  scripts/start-production.mjs     scripts/start-production.mjs
  scripts/serve-frontend.mjs       scripts/serve-frontend.mjs
  package.json                     package.json
  node_modules/                    （junction 到共享依赖仓，不是源工作区）
```

`<部署根>/src` 与 `<部署根>/dist/frontend/src` 是**同一棵树的两份落点**（同一来源、逐文件同构），
不是两棵各自演化的树。这是本布局唯一的「重复」，也是必须付出的代价（见 §3）。

---

## 2. 每段的来源

| 段 | `DEPLOYMENT_TREE` 条目 | 来源 | 由谁产出 |
| --- | --- | --- | --- |
| `backend/` | `backend → backend`（kind=tree） | 仓库源目录 `backend/` | 源仓库（**不是**发布清单） |
| `electron/` | `electron → electron`（kind=tree） | 仓库源目录 `electron/` | 源仓库（**不是**发布清单） |
| `src/` | `dist/frontend/src → src`（kind=tree） | `PUBLISH_OUT_DIR/src` | **`frontend/publish-asset-manifest.mjs` 的 `PUBLISH_ASSET_MANIFEST`** |

第三段的完整链路：

```text
PUBLISH_ASSET_MANIFEST（17 条，frontend/publish-asset-manifest.mjs:42-71）
  │  由 frontend/vite.preview.config.mjs 的 eagle-production-assets 插件在 closeBundle 调用
  │  copyPublishAssets({ workspaceRoot, outDir, appRuntimeHtmlExcludes })
  ▼
dist/frontend/                  ← PUBLISH_OUT_DIR（= 'dist/frontend'），静态服务根
  └─ src/                       ← 清单每条 to 的前缀（17 条的 to 全部落在 src/ 下）
       │  再经 DEPLOYMENT_TREE 的 dist/frontend/src → src 原样落一份
       ▼
<部署根>/src/                   ← 四处耦合点的解析目标
```

清单 17 条的落点（`to` 相对 `PUBLISH_OUT_DIR`）**恰好就是**它们在部署根内的相对路径：

| # | kind | `from` | `to` → `<部署根>/…` |
| --- | --- | --- | --- |
| 0 | app-runtime-tree | `src/app` | `src/app` |
| 1-8 | tree | `src/my_modules/<name>` ×8 | `src/my_modules/<name>` |
| 9-11 | tree | `src/node_modules/<pkg>` ×3 | `src/node_modules/<pkg>` |
| 12 | file | `src/package.json` | `src/package.json` |
| 13 | tree | `src/i18n` | `src/i18n` |
| 14 | file | `src/config.js` | `src/config.js` |
| 15-16 | file | `frontend/public/replaced/*.html` | `src/app/{registration,manage-device}.html` |

> 因为 `<部署根>/src` ≡ `dist/frontend/src`，清单里以 `src/` 开头的 `to` **直接就是**部署根内的路径。
> 这条恒等式是整个布局的支点，门禁里也有断言（见 §6 判据 i/ii）。

`kind=app-runtime-tree` 的过滤规则（`copyPublishAssets` 内的 filter）：排除 `src/app/react/**`
与 `REACT_PAGE_ENTRIES` 登记的页面 HTML。因此发布树**不是**源工作区 `src/` 的复制品——它被裁剪过，
`src/node_modules` 只有清单登记的 3 个包（源工作区那里是整棵 npm 树）。

---

## 3. 为什么必须是这个形状

产品代码里四处独立推导「项目根」，锚点都是**模块自身位置**，不是环境变量：

```js
// backend/src/server.js:75-76
// backend/src/library-store.js:7-8
// backend/src/native-preview-service.js:14-15
// backend/src/thumbnail-task-service.js:15-16
const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '../..');   // here = <部署根>/backend/src ⇒ projectRoot = <部署根>
```

```js
// electron/preload.cjs:14-16 —— 同族锚点，只是基准是 electron/ 而不是 backend/src/
const formatExtensionPreloadPath = path.join(
  __dirname, '..', 'src', 'app', 'js', 'plugin', 'api-format-extension.js',
);                                                  // __dirname = <部署根>/electron ⇒ <部署根>/src/...
```

推论是刚性的：**只要 `backend/` 与 `electron/` 落在 `<部署根>/` 下，`projectRoot/src` 就必然等于
`<部署根>/src`**。而它要读的东西（`src/app/js/plugin/api-format-extension.js`、库默认图标、
`/src/...` 虚拟路径背后的文件）全部由发布清单产出、落在 `dist/frontend/src`。
两者必须是同一棵树——这就是「`<部署根>/src` 必须**就是**发布树」的全部理由。

这不是设计偏好，是**既成事实的收敛**：把布局钉成上面那个形状，四处 `projectRoot/src` 就自然解析到发布树；
不这样做，部署副本要么读空（缺文件 404 / 抛错），要么读回源工作区（隔离门禁判红）。

---

## 4. 四处已知耦合

四处**全部**在部署根内解析到**存在**的路径（`tests/isolated-deployment.mjs` 逐条断言，见 §6）。

| # | 文件:行号 | 解析表达式 | 在部署根内解析到什么 | 类型 |
| --- | --- | --- | --- | --- |
| ① | `electron/preload.cjs:14-16`（锚点 `:15`） | `path.join(__dirname, '..', 'src', 'app', 'js', 'plugin', 'api-format-extension.js')` | `<部署根>/src/app/js/plugin/api-format-extension.js` | file |
| ② | `backend/src/server.js:1489`、`backend/src/server.js:2483` | `path.join(projectRoot, 'src/app/collect-window/assets/images/base/icons/default-library-icon.png')` | `<部署根>/src/app/collect-window/assets/images/base/icons/default-library-icon.png` | file |
| ③ | `backend/src/server.js:3264-3267` | `resolveThumbnailPath` 的 `roots = [path.join(projectRoot, 'frontend/public'), path.join(projectRoot, 'src')]` | `roots[0]` → `<部署根>/frontend/public`（`/mock-library/...` 虚拟前缀的解析根）；`roots[1]` → `<部署根>/src`；**两者同时是 `:3280` 绝对路径白名单的成员** | dir ×2 |

> **③ 的校正（R2-3 运行期实测）**：`roots` 的 `/src/...` 虚拟前缀**实际是死的**——
> `:3269-3270` 对 `/src/X` 取 `slice(1)` 得 `src/X`，再与 `roots[1] = <root>/src` 拼接 ⇒ 找的是
> `<root>/src/src/X`，恒不命中（`roots[0]` 侧同理为 `<root>/frontend/public/src/X`）。
> 现网无调用方（缩略图 URL 由 `FileUrlHelper.getThumbnailUrl` 产成**库内绝对路径**，走 `:3280` 的白名单分支），
> 故该缺陷**休眠**；已按现状钉在 `tests/deployment-root-runtime-probe.mjs` 的 `DORMANT_BRANCHES` 里
> （行为一变就红）。本表不再把 `/src/...` 写作 ③ 的解析目标。
| ④ | `backend/src/library-store.js:110` | `path.join(projectRoot, value.replace(/^\//, ''))`，其中 `value` 起手 `/src/` | `<部署根>/src/...`（如 `/src/package.json` → `<部署根>/src/package.json`） | dir（代表路径为 file） |

逐条用途：

- **①** 格式插件 webview 的唯一真实磁盘 preload 来源。消费者 `electron/preload.cjs:160`
  （`fs.existsSync(formatExtensionPreloadPath)` → 不存在则返回 `{ ok: false, reason: 'preload 脚本不存在' }`），
  `:165-166` 用 `pathToFileURL(...)` 交给 webview。**缺失即格式插件整块不可用，且是静默降级**（有 reason，不抛）。
- **②** `/api/library/icon` 与 `/api/v2/library/icon` 返回的库默认图标。两处都是
  `if (fs.existsSync(iconPath)) res.sendFile(iconPath); else 404 'Library icon not found'`——缺失即 404。
- **③** 缩略图虚拟路径的解析根：`/mock-library/...`（走 `roots[0]`）与 `/src/...`（走 `roots[1]`）。
  命中条件是 `candidate` 在 root 内、存在、且是文件（`server.js:3272-3275`）。缺失即缩略图回落 404。
- **④** 库路径的 `/src/` 虚拟前缀映射。代表路径 `/src/package.json` 是 M8-3 补登的产物：
  运行期 8+ 处用 `req(appRoot.path + '/package.json')` 读版本元数据（`appRoot.path` 恒为 `/src`），
  产物里没有它就是 404、`version`/`buildVersion` 全空。

---

## 5. 已知耦合的性质 / 若要改成「单一可配置根」需要动哪些文件

**性质**：这四处是**已知耦合**，不是缺陷登记。它们成立的前提是 §1 的布局；布局被破坏时它们**不会报错**，
只会静默读到错误的位置或读空（①②③④ 的消费者全部是「存在性判断 + 回落」的形状，没有一处会在路径错误时抛异常）。
这正是必须由门禁断言、而不能靠代码自证的原因。

**改成单一可配置根（一个环境变量/一个模块统一推导只读资源根）需要动的地方（只描述，不做）**：

1. **四处 `projectRoot` 定义点**（各自独立推导，不存在共享模块，改必须四处都改）：
   `backend/src/server.js:76`、`backend/src/library-store.js:8`、`backend/src/native-preview-service.js:15`、
   `backend/src/thumbnail-task-service.js:16`。
2. **`electron/preload.cjs:14-16`**：它不用 `projectRoot`，基准是 `__dirname`。改动需与同族锚点
   `electron/main.cjs:1770` 的 `path.join(__dirname, '..', 'plugins')` 一起考虑，否则会拆出两套根语义。
3. **`projectRoot` 的其余消费者需要先分类**——它们语义不同，不能一刀切进同一个「只读资源根」：
   - 只读资源：`server.js:77`（`frontend/public/mock-library`）、`:1489`/`:2483`（图标）、`:3266`（`src`）、
     `library-store.js:9`（同 mock-library）、`native-preview-service.js:16-17` 与
     `thumbnail-task-service.js:17-19`（`node_modules/electron/dist/electron.exe`、`electron/*-worker.cjs`）。
   - 可写状态 / 导出目录：`server.js:85`（`test-run/user-data`）、`:391`/`:972`/`:2122`/`:2166`/`:2178`/`:2187`/`:2199`/`:2213`
     （`exports/`、`test-run/`）、`:210`（`plugins/` 加载根，另有 `EAGLE_PLUGINS_ROOT` 覆盖）。
   - 纯路径运算产物：`server.js:78`（`reverseRoot`，本批无消费者）、`library-store.js:11`
     （`fixtureLibraryExampleDir`，指向 `tests/fixtures`）。
4. **注入侧**：新配置项要在 `scripts/start-production.mjs` 注入（那里已在注入 `EAGLE_FRONTEND_ROOT`，
   见 `:34`），并与 `scripts/serve-frontend.mjs:26` 的同类口径对齐（`EAGLE_FRONTEND_ROOT` 默认
   `<repo>/dist/frontend`）。
5. **门禁侧**：`tests/isolated-deployment.mjs` 的 `DEPLOYMENT_TREE` 里那条
   `dist/frontend/src → src` 应改为「指向配置的只读资源根」，`RUNTIME_ROOT_GAPS` 的四条断言随之改写。

**本批不做的原因**：用户裁决 D34 明确「零产品代码改动」。上面 5 项全部落在产品代码里。

---

## 6. 验收口径

**判定标准是「探针记录的读有没有落在源工作区」，不是「代码里 grep 不到路径」。**

展开成三层，全部在 `tests/isolated-deployment.mjs` 里：

1. **布局断言（静态，构建后、启动前）**——本文件 §1/§2/§4 的每一条：
   - 三段 `{backend, electron, src}` 存在，且在 `DEPLOYMENT_TREE` 里被显式声明为 `kind=tree`；
   - `src` 段来自发布清单产出，判据三条：
     - **(i)** 清单每条 `to`（全部以 `src/` 起手）在 `<部署根>/` 下存在，类型与 `kind` 一致；
     - **(ii)** `<部署根>/src` 与 `<部署根>/dist/frontend/src` 是同一棵树（相对路径集合 + 逐文件大小相等）；
     - **(iii)** `<部署根>/src/node_modules` 的子目录集合**恰好等于** `SRC_NODE_MODULE_PACKAGES`
       （判别性证据：源工作区 `src/node_modules` 是整棵 npm 树，这条把「发布树」与「源工作区 src」区分开）；
   - 四处耦合点逐一解析到**存在**的 file/dir（含 ③ 的 `roots[0]` 与 ④ 的代表路径）。
2. **运行期探针（动态，启动后）**——`--require` + `--experimental-loader` 三个进程全覆盖，
   记录**实际发生的读**：`bucket === 'repo'`（源工作区/`tests`/源 `src/node_modules`）必须为空数组；
   落在 `<部署根>/src` 下的「存在性探测未命中」只允许登记在案的哨兵
   （`__production_ready__`，健康检查语义，404 即「就绪但无此文件」），其余未命中一律判红。
3. **两条负向自证**（门禁不能是橡皮章）：
   - `EAGLE_ISOLATION_PROBE_DISABLE=1` ⇒ 必须因缺少探针证据变红；
   - `EAGLE_ISOLATION_NEGATIVE=missing-asset` ⇒ 删掉隔离根里一个已登记产物后必须响亮失败。

> 为什么不能靠 grep：四处耦合点的路径字符串在源码里**依然存在且是正确的**——它们指向的
> `projectRoot/src/...` 是相对表达，源码里 grep 不到任何绝对路径。布局对不对，只有「实际读到了什么」说了算。

---

## 7. R2-3：四处耦合点的**运行期**探针

§6 第 1 层是**静态**的：把 `path.join(...)` 的结果 `existsSync` 一下。它证明「拼出来的路径存在」，
证明不了「运行期真的解析到了部署根里那一份」——`projectRoot` 若被指回源工作区，静态层照样绿。

`tests/deployment-root-runtime-probe.mjs` 补的就是这一层（R2-3，2026-09-17）。做法：

1. 按同一份 `DEPLOYMENT_TREE`（已抽到 `tests/deployment-root.mjs`，两个门禁共用一份，防止漂移）构造部署根；
2. 往部署根里写**哨兵**——只有部署根才有的内容：
   把默认库图标换成一张 1×1 PNG、在 `src/__probe__/` 放一个哨兵缩略图与一个哨兵 `.library`；
3. **在部署根里起真实后端进程**（`projectRoot = <backend>/../..` ⇒ 自动等于部署根），发真实 HTTP 请求；
4. 断言每条耦合点**运行期吐回来的字节/路径与哨兵一致**——源工作区没有这些哨兵，
   解析根一旦漂移就是 404 或字节不符。

四条与哨兵/判据的对应：

| # | 运行期怎么探 | 判据 |
| --- | --- | --- |
| ① | `vm` 真实装载 `<部署根>/electron/preload.cjs`（桩掉 electron 桥、注入真实 `__dirname`），真实调用 `formatExtensionPreload()` | `ok:true` 且 `diskPath` == `<部署根>/src/app/js/plugin/api-format-extension.js` |
| ② | `GET /api/library/icon` 与 `GET /api/v2/library/icon` | 200 + `image/png` + 字节 == 部署根哨兵图标 |
| ③ | 缩略图服务 `/file/<encoded>`：虚拟前缀 `/mock-library/...`（`roots[0]`）、部署根内绝对路径（白名单）、**部署根外绝对路径（必须拒收）** | 200 + 字节 == 哨兵；越界那条必须 404 |
| ④ | `POST /api/library/switch { libraryPath: '/src/__probe__/DeployRootProbe.library' }` | 200 且 `data.path` == `<部署根>/src/__probe__/DeployRootProbe.library` |

**两条负向自证**（`EAGLE_DEPLOY_PROBE_NEGATIVE=...`，都必须把脚本跑红）：

- `missing-src`：把部署根的 `src/` 段挪走 ⇒ 四条**全部**必须判红（任何一条还绿，说明它没真正锚在部署根上）；
- `anchor-source`：后端改在**源工作区**启动 ⇒ ②③④ 必须判红（哨兵只在部署根），而 **① 必须仍然通过**
  ——它的锚点是 `__dirname`，本就不该随 cwd 漂移。这条自证同时说明 ① 与 ②③④ 的锚点性质不同。

覆盖完整性：探针的覆盖集合与 `RUNTIME_ROOT_GAPS` 的登记集合**必须相等**，
多一条少一条都判红 ⇒ 新增第五处耦合点而探针没跟上时，门禁立刻红。

用法：`npm run build && node tests/deployment-root-runtime-probe.mjs`（**单独跑**，会自起后端）。
