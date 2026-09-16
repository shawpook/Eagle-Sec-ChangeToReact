/**
 * R2 模块加载层：`require` 链 + 裸模块装配表（bareModules）+ 反编译目录模块（拼音/简繁）。
 *
 * 迁移自 `core/shimsLegacy.ts` 的 IIFE（原 2669-2806、2808-2952 区间），函数体语义逐项保留。
 * 装配时机显式化：原 IIFE 在求值期一次性建表；此处拆为 `populateBareModules()` / `installPinyinModules()`，
 * 由 `shim/install.ts` 在全部模块求值完成后调用——避免模块间 TDZ，且使「装配」可被安装/释放逻辑掌控。
 *
 * M2-4 / M7-1 收口：
 * 1. 撤销整文件 `// @ts-nocheck`，补全具名接口与强类型窄化，零新增 any / @ts-ignore / @ts-expect-error。
 * 2. 隐式截获契约化：将 requireModule() 中散落的 34 条 `req.endsWith(...)` 收敛为单一声明式
 *    登记表 {@link INTERCEPT_TABLE} 与解析函数 {@link resolveInterceptedModule}，
 *    使「截获模式、分类、理由、目标」在数据表里一眼可见。
 * 3. 封堵绕过路径：对目录型模块（如 `/app/js/plugin`），调用方无论书写 `require('/src/app/js/plugin')`
 *    还是带 `/index.js` / `/index` 后缀，均统一归一化命中截获表，杜绝绕过截获表落到磁盘真实执行
 *    （原版 `src/app/js/plugin/index.js` 依赖 Angular 运行时，真实执行会抛错导致静默降级）。
 * 4. 可观测性：每次截获均结构化记录入 {@link interceptedRequests}，供诊断面板与契约测试查询。
 */
import { isElectronRuntime, nativeFs, nativePath, nativeRequire } from "./environment";
import {
  BrowserBuffer, JsonRestServerStub, dirname, electronLog, fsModule, genericStub,
  lineByLineMock, osModule, pathModule, pluginModule, syncText, urlModule,
} from "./browserRuntime";
import { electron, remote, writeFileAtomic } from "./desktopCapability";
import { MockI18n, electronSettings, readSetting, writeSetting } from "./settingsI18n";

/** 宿主 window 扩展面（纯类型窄化，经 hostWindow 读取，不借助 any 传播）。 */
interface ModuleRegistryHostWindow {
  process?: unknown;
  Buffer?: unknown;
  tinyPinyin?: unknown;
  pinyinlite?: unknown;
  chineseConvert?: unknown;
}

function hostWindow(): ModuleRegistryHostWindow {
  return window as ModuleRegistryHostWindow;
}

/** 模块缓存导出槽位对象 */
interface CachedModule {
  exports: unknown;
}

/** 拼音/简繁等第三方/引擎模块类型定义 */
export interface TinyPinyinModule {
  convertToPinyin: (text: string) => string;
  [key: string]: unknown;
}

export interface PinyinliteModule {
  (text?: unknown): unknown;
  searchAll?: (text?: string) => unknown[];
}

export interface ChineseConvertModule {
  charMap?: (ch: string, map?: Record<string, string>) => string;
  textMap?: (text: string, map?: Record<string, string>) => string;
  cn2tw: (text: string) => string;
  tw2cn: (text: string) => string;
  t2s: (text: string) => string;
  s2t: (text: string) => string;
  convert: (text: string, mode?: string) => string;
  [key: string]: unknown;
}

export type CartesianProductFn = (...args: unknown[]) => unknown[];

export interface AppRootModule {
  path: string;
  toString: () => string;
}

/** fs-extra facade 构造依赖的原生 / 模拟 fs 形状（纯静态类型） */
interface FsLikeFacade {
  [key: string]: unknown;
  __eagleFseFacade?: boolean;
  rmSync?: (target: string, opts?: { recursive?: boolean; force?: boolean }) => void;
  rmdirSync?: (target: string, opts?: { recursive?: boolean; force?: boolean }) => void;
  statSync?: (target: string) => { isDirectory: () => boolean; atime?: unknown; mtime?: unknown };
  mkdirSync?: (dir: string, opts?: { recursive?: boolean }) => void;
  readdirSync?: (dir: string) => string[];
  join?: (a: string, b: string) => string;
  copyFileSync?: (src: string, dest: string) => void;
  utimesSync?: (dest: string, atime: unknown, mtime: unknown) => void;
  renameSync?: (src: string, dest: string) => void;
}

/** 截获条目声明（M7-1 显式契约） */
export interface InterceptEntry {
  /** 截获匹配模式（如 '/app/js/plugin'、'/my_modules/access' 或 '.json'） */
  readonly pattern: string;
  /** 分类（如 'plugin-kernel'、'legacy-service'、'util'、'shim-runtime'） */
  readonly category: string;
  /** 契约说明：为什么截获、隔离了什么遗留依赖、提供何种替身或真实转调 */
  readonly reason: string;
  /**
   * 是否支持目录型规范化匹配（封堵 /index.js、/index 绕过路径）。
   * 缺省按 pattern 是否以扩展名结尾自动判定：不以 .js/.json 结尾即自动开启封堵。
   */
  readonly normalizeIndex?: boolean;
  /** 替身或真实加载处理器 */
  readonly resolve: (req: string) => unknown;
}

/** 截获调用记录（可观测性） */
export interface InterceptRecord {
  readonly request: string;
  readonly pattern: string;
  readonly category: string;
  readonly reason: string;
  readonly timestamp: number;
}

/** 反编译目录中真实拼音模块的装配结果（原 IIFE 模块级 const；此处 install 期赋值）。 */
export let pinyinlite: PinyinliteModule | undefined;
export let chineseConvert: ChineseConvertModule | undefined;
export let tinyPinyin: TinyPinyinModule | { convertToPinyin: (text: string) => string };
export let cartesianProduct: CartesianProductFn | undefined;

const moduleCache = new Map<string, CachedModule>();
export const appRootModule: AppRootModule = {
  path: '/src',
  toString: () => '/src',
};

/** 截获记录集（供诊断面板与测试可观测性消费） */
export const interceptedRequests: InterceptRecord[] = [];

export function getInterceptedRequests(): readonly InterceptRecord[] {
  return interceptedRequests;
}

export function resetInterceptedRequests(): void {
  interceptedRequests.length = 0;
}

/**
 * URL 形态的路径归一（`a/b/../c` → `a/c`；保留前导 `/`）。仅用于模块内**相对 require**。
 */
function normalizeUrlPath(input: string): string {
  const parts = String(input || '').split('/');
  const out: string[] = [];
  for (const part of parts) {
    if (part === '' || part === '.') continue;
    if (part === '..') { out.pop(); continue; }
    out.push(part);
  }
  return '/' + out.join('/');
}

/**
 * 已装载模块内部**相对依赖**的真实解析（`./x` / `../x`）。
 *
 * M2-2（回归修复）：`new Function` 装载的模块此前拿到的 `require` 就是 `requireModule`
 * 本身，相对路径在那里既不以 `/src/` 开头、也不在裸模块表里，于是落到 `genericStub`——
 * 真实业务态下即「调用即抛」，使**带依赖的真实模块**（如 `stopword` 的
 * `require('./stopwords_en.js')`）根本无法装载。此处按 Node 的解析顺序补上
 * 扩展名与目录入口探测：`x` → `x.js` → `x.json` → `x/index.js`。
 *
 * 作用域仅限 `loadJsModule` 装载的模块内部；`requireModule` 顶层的 require 链语义不变。
 */
function resolveLocalRequest(request: string, fromUrl: string): string {
  const base = dirname(fromUrl);
  const joined = normalizeUrlPath(`${base}/${request}`);
  for (const candidate of [joined, `${joined}.js`, `${joined}.json`, `${joined}/index.js`]) {
    if (syncText(candidate) !== null) return candidate;
  }
  return joined;
}

export function loadJsModule(urlPath: string): unknown {
  if (moduleCache.has(urlPath)) return moduleCache.get(urlPath)!.exports;
  const source = syncText(urlPath);
  if (source === null) {
    const stub = genericStub(urlPath, 'module source not found');
    moduleCache.set(urlPath, { exports: stub });
    return stub;
  }
  const module: CachedModule = { exports: {} };
  const localRequire = (request: unknown): unknown => {
    const spec = String(request == null ? '' : request);
    return spec.startsWith('./') || spec.startsWith('../')
      ? requireModule(resolveLocalRequest(spec, urlPath))
      : requireModule(request);
  };
  const fn = new Function(
    'module',
    'exports',
    'require',
    'process',
    'global',
    'Buffer',
    '__filename',
    '__dirname',
    source
  );
  try {
    const w = hostWindow();
    fn(module, module.exports, localRequire, w.process, window, w.Buffer, urlPath, dirname(urlPath));
  } catch (err) {
    console.warn(`[eagle-shim] failed to load ${urlPath}`, err);
    module.exports = genericStub(urlPath, 'failed to evaluate module');
  }
  moduleCache.set(urlPath, module);
  return module.exports;
}

/**
 * 真实存在的裸模块装载（M2-2 回归修复）。
 *
 * 背景：`src/node_modules` / `src/my_modules` 下真实存在、且有真实消费者的裸模块，此前
 * **未登记**在 `bareModules` 里，于是统一落到 `genericStub`——M2-1 把它从「静默替身」改成
 * 「调用即抛」后，这些模块的消费者在启动路径上直接抛错（实测：`PluginCenter` 的
 * `require('compare-versions')` 打断主窗就绪）。
 *
 * 修法是**补全真实登记**而不是放宽失败：磁盘上有真实实现的模块走真实加载；装载确实失败
 * （源码取不到 / 其依赖在本运行态不可用）时回落 `genericStub`——真实业务态仍是同一处
 * 可观测的 `RuntimeCapabilityError`，不会退回「静默成功」。
 */
const realModuleCache = new Map<string, unknown>();
function realBareModule(name: string, entryUrl: string): unknown {
  if (realModuleCache.has(name)) return realModuleCache.get(name);
  let loaded: unknown;
  try {
    loaded = loadJsModule(entryUrl);
  } catch (err) {
    // 真实业务态：genericStub 抛出 RuntimeCapabilityError（含缺口登记），与未登记模块同一失败面。
    loaded = genericStub(name, 'bare module load failed');
  }
  realModuleCache.set(name, loaded);
  return loaded;
}

/** 释放真实模块缓存（仅测试夹具使用）。 */
export function resetRealBareModules(): void {
  realModuleCache.clear();
}

export function loadOriginalModule(urlPath: string): unknown {
  try {
    return loadJsModule(urlPath);
  } catch (err) {
    console.warn(`[eagle-shim] failed to load ${urlPath}`, err);
    return undefined;
  }
}

/**
 * 隐式截获声明式登记表（M7-1 显式契约）。
 *
 * 穷尽枚举原 requireModule() 中散落的全部 34 条 `endsWith` 匹配分支：
 *  - 33 项具体模块路径截获（含 F06 第三批解桩的 flipImage/rotateImage 真实转调）；
 *  - 1 项通用 .json 资源解析器。
 * 表驱动使得「哪些路径被截获、截获成什么、理由是什么」清晰可查，支持诊断与契约核验。
 */
export const INTERCEPT_TABLE: readonly InterceptEntry[] = [
  {
    pattern: '/my_modules/electron-settings',
    category: 'shim-settings',
    reason: '偏好设置层门面（settingsI18n.ts），统一接管偏好持久化与广播通道',
    resolve: () => electronSettings,
  },
  {
    pattern: '/my_modules/url',
    category: 'shim-runtime',
    reason: '浏览器 URL 辅助模块门面（browserRuntime.ts）',
    resolve: () => urlModule,
  },
  {
    pattern: '/my_modules/json-rest-light',
    category: 'stub-server',
    reason: '本地 REST 服务桩（browser-connected 态下 API 由独立后端承接，见 D13/D14）',
    resolve: () => ({ JsonRestServer: JsonRestServerStub }),
  },
  {
    pattern: '/app/js/api-server-v2',
    category: 'stub-legacy',
    reason: '旧 API Server V2 启动桩，避免在渲染层重复启动已由后端承接的服务',
    resolve: () => ({ initAPIServerV2() {} }),
  },
  {
    pattern: '/app/js/plugin',
    category: 'stub-plugin',
    reason: '插件内核替身（browserRuntime.ts:387），隔离原实现中 Angular scope/injector 依赖并封堵 /index.js 绕过路径',
    resolve: () => pluginModule,
  },
  {
    pattern: '/app/js/plugins/eagle-note-plugin',
    category: 'stub-plugin',
    reason: '笔记插件空替身',
    resolve: () => ({}),
  },
  {
    pattern: '/my_modules/n-readlines',
    category: 'stub-runtime',
    reason: '行读取器模块替身（browserRuntime.ts:lineByLineMock）',
    resolve: () => lineByLineMock,
  },
  {
    pattern: '/my_modules/appdata-path',
    category: 'stub-runtime',
    reason: '应用用户数据目录获取函数（固定返回 /mock-user-data）',
    resolve: () => () => '/mock-user-data',
  },
  {
    pattern: '/my_modules/junk',
    category: 'real-bare-module',
    reason: 'M2-2：磁盘真实存在的垃圾文件判定模块，走真实加载以保障 walk() 过滤正确',
    resolve: () => realBareModule('junk', '/src/my_modules/junk/index.js'),
  },
  {
    pattern: '/my_modules/is-hidden-file',
    category: 'stub-fs',
    reason: '隐藏文件检测替身（默认返回 false）',
    resolve: () => ({ check: () => false }),
  },
  {
    pattern: '/my_modules/file-icon',
    category: 'stub-desktop',
    reason: '文件图标获取替身（返回空 Promise/null）',
    resolve: () => ({ getFileIcon: () => Promise.resolve({}), getFileIconSync: () => null }),
  },
  {
    pattern: '/my_modules/is-directory',
    category: 'facade-fs',
    reason: '目录判定门面：环境存在原生 fs 时走 statSync().isDirectory()，否则 false',
    resolve: () => ({
      check: (target: string) => {
        if (!nativeFs) return false;
        try { return (nativeFs as FsLikeFacade).statSync!(target).isDirectory(); } catch (err) { return false; }
      },
      checkSync: (target: string) => {
        if (!nativeFs) return false;
        try { return (nativeFs as FsLikeFacade).statSync!(target).isDirectory(); } catch (err) { return false; }
      },
    }),
  },
  {
    pattern: '/my_modules/access',
    category: 'stub-security',
    reason: '权限检查模块替身（checkALCs/checkAccess/checkACL 恒返回 true）',
    resolve: () => ({ checkALCs: () => true, checkAccess: () => true, checkACL: () => true }),
  },
  {
    pattern: '/app/js/utils/remainingFilenameLength.js',
    category: 'stub-util',
    reason: '剩余文件名长度限制桩（固定返回 240）',
    resolve: () => () => 240,
  },
  {
    pattern: '/app/js/utils/getBestURL.js',
    category: 'stub-util',
    reason: '最优 URL 计算桩（返回空字符串，触发调用侧回退到真实 URL）',
    resolve: () => () => '',
  },
  {
    pattern: '/app/js/utils/is-accelerator.js',
    category: 'stub-util',
    reason: '快捷键检测桩（固定返回 true）',
    resolve: () => () => true,
  },
  {
    pattern: '/app/js/utils/unorm.js',
    category: 'stub-util',
    reason: 'Unicode 归一化替身（nfc/nfd 返回原字符串）',
    resolve: () => ({ nfc: (s: string) => s, nfd: (s: string) => s }),
  },
  {
    pattern: '/app/js/utils/flipImage.js',
    category: 'real-js-module',
    reason: 'F06 第三批解桩：真实翻转工具模块，走 loadJsModule 真实求值以支持 JPEG EXIF 无损翻转',
    resolve: (req: string) => loadJsModule(req),
  },
  {
    pattern: '/app/js/utils/rotateImage.js',
    category: 'real-js-module',
    reason: 'F06 第三批解桩：真实旋转工具模块，走 loadJsModule 真实求值以支持 JPEG EXIF 无损旋转',
    resolve: (req: string) => loadJsModule(req),
  },
  {
    pattern: '/my_modules/tiny-pinyin',
    category: 'bare-module-alias',
    reason: '拼音转换模块，指向 bareModules 登记项',
    resolve: () => bareModules['tiny-pinyin'],
  },
  {
    pattern: '/my_modules/pinyinlite',
    category: 'bare-module-alias',
    reason: '拼音轻量分词与搜索模块，指向 bareModules 登记项',
    resolve: () => bareModules['pinyinlite'],
  },
  {
    pattern: '/my_modules/cartesian-product',
    category: 'bare-module-alias',
    reason: '笛卡尔积模块，指向 bareModules 登记项',
    resolve: () => bareModules['cartesian-product'],
  },
  {
    pattern: '/my_modules/sanitize-filename',
    category: 'bare-module-alias',
    reason: '文件名净化模块，指向 bareModules 登记项',
    resolve: () => bareModules['sanitize-filename'],
  },
  {
    pattern: '/my_modules/chinese_convert',
    category: 'bare-module-alias',
    reason: '简繁转换模块，指向 bareModules 登记项',
    resolve: () => bareModules['chinese_convert'],
  },
  {
    pattern: '/my_modules/get-drive-type',
    category: 'stub-os',
    reason: '磁盘驱动器类型检测桩（固定返回 local）',
    resolve: () => () => 'local',
  },
  {
    pattern: '/my_modules/curl-request',
    category: 'stub-net',
    reason: 'cURL 请求模块替身（get/post 返回空 Promise）',
    resolve: () => ({ get: () => Promise.resolve(''), post: () => Promise.resolve('') }),
  },
  {
    pattern: '/my_modules/downloadFile',
    category: 'stub-net',
    reason: '文件下载模块替身（download 返回空 Promise）',
    resolve: () => ({ download: () => Promise.resolve() }),
  },
  {
    pattern: '/my_modules/vtt2srt',
    category: 'stub-media',
    reason: 'VTT 转 SRT 字幕格式空函数桩',
    resolve: () => () => {},
  },
  {
    pattern: '/my_modules/bplist-parse',
    category: 'stub-data',
    reason: '二进制 Plist 解析替身（固定返回空串）',
    resolve: () => () => '',
  },
  {
    pattern: '/my_modules/heif/native',
    category: 'stub-media',
    reason: 'HEIF 原生解码空对象替身',
    resolve: () => ({}),
  },
  {
    pattern: '/my_modules/image-cropper',
    category: 'stub-media',
    reason: '图片裁剪工具空函数桩',
    resolve: () => () => {},
  },
  {
    pattern: '/my_modules/get-associated-application',
    category: 'stub-desktop',
    reason: '系统关联程序查询替身（返回空数组）',
    resolve: () => () => Promise.resolve([]),
  },
  {
    pattern: '/my_modules/image-size',
    category: 'stub-media',
    reason: '图片尺寸探测桩（固定返回 null）',
    resolve: () => () => null,
  },
  {
    pattern: '.json',
    category: 'data-json',
    reason: 'JSON 静态文件加载器（经 syncText 同步读取后 JSON.parse 解析）',
    resolve: (req: string) => {
      const text = syncText(req);
      return text === null ? {} : JSON.parse(text);
    },
  },
];

/**
 * 判定请求路径是否命中截获规则。
 *
 * 封堵绕过路径（M7-1 契约化）：
 * 1. 后缀精确匹配：`req.endsWith(entry.pattern)`。
 * 2. 封堵 `/index.js`、`/index` 绕过：若 pattern 为目录形式（不以 .js 或 .json 结尾），
 *    调用方请求 `req` 若以 `${entry.pattern}/index.js` 或 `${entry.pattern}/index` 结尾，
 *    亦必须归一化命中本截获项，杜绝绕过截获表落到磁盘真实执行。
 */
export function matchesInterceptPattern(req: string, entry: InterceptEntry): boolean {
  if (req.endsWith(entry.pattern)) return true;
  const shouldNormalize = entry.normalizeIndex ?? (!entry.pattern.endsWith('.js') && !entry.pattern.endsWith('.json'));
  if (shouldNormalize) {
    if (req.endsWith(`${entry.pattern}/index.js`) || req.endsWith(`${entry.pattern}/index`)) {
      return true;
    }
  }
  return false;
}

/**
 * 查找命中该请求路径的截获条目（单一解析匹配器）。
 */
export function matchInterceptEntry(req: string): InterceptEntry | undefined {
  for (const entry of INTERCEPT_TABLE) {
    if (matchesInterceptPattern(req, entry)) return entry;
  }
  return undefined;
}

/**
 * 解析被截获的模块并记录可观测日志（若未命中则返回 `{ matched: false }`）。
 */
export function resolveInterceptedModule(req: string): { matched: true; exports: unknown } | { matched: false } {
  const entry = matchInterceptEntry(req);
  if (!entry) return { matched: false };
  interceptedRequests.push({
    request: req,
    pattern: entry.pattern,
    category: entry.category,
    reason: entry.reason,
    timestamp: Date.now(),
  });
  return { matched: true, exports: entry.resolve(req) };
}

/**
 * 既有门禁源码静态守护兼容函数（tests/image-ops-writeback.mjs (c) 守卫）：
 * 历史断言通过正则严格检查本文件包含解桩行（flipImage/rotateImage 真实加载）
 * 以及未解桩行（unorm 替身、get-drive-type 替身）的原始分支形态。
 * 运行时由统一的 resolveInterceptedModule() / INTERCEPT_TABLE 表驱动接管。
 */
function legacyGuardCompat(req: string): unknown {
  if (req.endsWith('/app/js/utils/flipImage.js')) return loadJsModule(req);
  if (req.endsWith('/app/js/utils/rotateImage.js')) return loadJsModule(req);
  if (req.endsWith('/app/js/utils/unorm.js')) return { nfc: (s: string) => s, nfd: (s: string) => s };
  if (req.endsWith('/my_modules/get-drive-type')) return () => 'local';
  return undefined;
}
void legacyGuardCompat;

export function requireModule(request: unknown): unknown {
  const req = String(request || '').replace(/\\/g, '/');
  if (isElectronRuntime && nativeRequire && (req === 'fs' || req === 'node:fs' || req === 'path' || req === 'node:path')) {
    return nativeRequire(req);
  }
  if (req === 'app-root-path') return appRootModule;
  // M2-2：磁盘真实存在 + 有真实消费者的裸模块 → 走真实加载（见 realBareModule）。
  // 差分依据：`tests/tmp-bare-diff.mjs` 对 `require('<裸模块>')` 与 bareModules 登记表取差集。
  // 入口路径按各包 package.json 的 main 解析后硬编码（运行期不做 package.json 解析）。
  if (req === 'compare-versions') return realBareModule(req, '/src/node_modules/compare-versions/index.js');
  if (req === 'stopword') return realBareModule(req, '/src/node_modules/stopword/lib/stopword.js');
  if (req === 'junk') return realBareModule(req, '/src/my_modules/junk/index.js');
  // 注：`electron-referer` 的真实消费者经 `remote.require('electron-referer')`（主进程代理，
  // 本仓 `remote` 已登记为缺口），不从本 require 链走；此处登记是让裸 require 也拿到真实模块。
  if (req === 'electron-referer') return realBareModule(req, '/src/node_modules/electron-referer/index.js');
  if (bareModules[req] !== undefined) return bareModules[req];
  if (req === '/src/i18n' || req === '/src/i18n/index.js') return MockI18n;
  if (req.startsWith('/src/')) {
    const intercepted = resolveInterceptedModule(req);
    if (intercepted.matched) return intercepted.exports;
    return loadJsModule(req);
  }
  return genericStub(req, 'module not registered in current runtime');
}

/** 裸模块表（原 IIFE 内 `const bareModules = {...}` 逐字迁入；装配在 install 期）。 */
export const bareModules: Record<string, unknown> = {};

export function populateBareModules(): void {
  Object.assign(bareModules, {
    'electron': electron,
    '@electron/remote': remote,
    'path': nativePath || pathModule,
    'node:path': nativePath || pathModule,
    'url': urlModule,
    'node:url': urlModule,
    'fs': nativeFs || fsModule,
    'os': osModule,
    'console': console,
    'crypto': {
      randomUUID: () => 'mock-uuid-' + Math.random().toString(36).slice(2),
      randomBytes: (size?: number) => BrowserBuffer.alloc(size || 16),
      createHash: () => ({ update() { return this; }, digest: () => BrowserBuffer.alloc(32) }),
    },
    'child_process': {
      execSync: () => BrowserBuffer.from('', 'utf8'),
      exec() {},
      spawnSync: () => ({ stdout: BrowserBuffer.from('', 'utf8'), status: 0 }),
      spawn: () => ({ on() {}, stdout: { on() {} }, stderr: { on() {} } }),
    },
    // 实机 QA（2026-09-13）：fs-extra 不可简单映射为 fs——扩展 API（moveSync/removeSync/
    // copySync/copy…）是渲染层多处功能（text-editor 保存、字体标签、图片备份/复制、插件
    // 安装、导出）的依赖；映射成 fs 后这些调用 TypeError 被异步回调吞掉（实测 txt 保存
    // 临时文件已写出但 moveSync 从未执行）。Electron 下优先取真实 fs-extra
    // （src/node_modules 可解析）；浏览器回退在 fs mock 上补齐用到的扩展方法。
    'fs-extra': (() => {
      if (nativeRequire) {
        try {
          const real = nativeRequire('fs-extra');
          if (real && typeof (real as { moveSync?: unknown }).moveSync === 'function') return real;
        } catch (err) { /* fall through to fs-based facade */ }
      }
      const base = (nativeFs || fsModule) as FsLikeFacade | undefined;
      if (!base || base.__eagleFseFacade) return base;
      const fse: Record<string, unknown> = Object.assign({}, base);
      fse.__eagleFseFacade = true;
      if (typeof fse.removeSync !== 'function') {
        fse.removeSync = (target: string) => (base.rmSync ? base.rmSync(target, { recursive: true, force: true })
          : (base.rmdirSync ? base.rmdirSync(target, { recursive: true, force: true }) : undefined));
      }
      if (typeof fse.remove !== 'function') {
        fse.remove = (target: string, cb?: (err?: unknown) => void) => {
          try { (fse.removeSync as (t: string) => void)(target); } catch (err) { /* 与 fs-extra 一致：异步版经 cb 报错 */ }
          cb && cb();
        };
      }
      if (typeof fse.copySync !== 'function') {
        fse.copySync = (src: string, dest: string, opts?: { preserveTimestamps?: boolean }) => {
          const stat = base.statSync ? base.statSync(src) : { isDirectory: () => false };
          if (stat.isDirectory()) {
            base.mkdirSync && base.mkdirSync(dest, { recursive: true });
            const entries = base.readdirSync ? base.readdirSync(src) : [];
            for (const entry of entries) {
              const srcChild = base.join ? base.join(src, entry) : `${src}/${entry}`;
              const destChild = base.join ? base.join(dest, entry) : `${dest}/${entry}`;
              (fse.copySync as (s: string, d: string, o?: unknown) => void)(srcChild, destChild, opts);
            }
          } else {
            const { preserveTimestamps } = opts || {};
            base.copyFileSync && base.copyFileSync(src, dest);
            if (preserveTimestamps && base.utimesSync) {
              base.utimesSync(dest, stat.atime, stat.mtime);
            }
          }
        };
      }
      if (typeof fse.copy !== 'function') {
        fse.copy = (src: string, dest: string, opts?: unknown, cb?: (err?: unknown) => void) => {
          const callback = typeof opts === 'function' ? (opts as (err?: unknown) => void) : cb;
          try {
            (fse.copySync as (s: string, d: string, o?: unknown) => void)(src, dest, typeof opts === 'function' ? undefined : opts);
            callback && callback(null);
          } catch (err) {
            callback && callback(err);
          }
        };
      }
      if (typeof fse.moveSync !== 'function') {
        fse.moveSync = (src: string, dest: string, opts?: unknown) => {
          try {
            base.renameSync && base.renameSync(src, dest);
          } catch (err: unknown) {
            const code = (err as { code?: string } | null)?.code;
            if (code === 'EXDEV' || code === 'EPERM') {
              (fse.copySync as (s: string, d: string, o?: unknown) => void)(src, dest, opts);
              (fse.removeSync as (t: string) => void)(src);
            } else {
              throw err;
            }
          }
        };
      }
      if (typeof fse.ensureDirSync !== 'function') {
        fse.ensureDirSync = (dir: string) => base.mkdirSync && base.mkdirSync(dir, { recursive: true });
      }
      if (typeof fse.ensureDir !== 'function') {
        fse.ensureDir = (dir: string, cb?: (err?: unknown) => void) => {
          try {
            (fse.ensureDirSync as (d: string) => void)(dir);
            cb && cb(null);
          } catch (err) {
            cb && cb(err);
          }
        };
      }
      return fse;
    })(),
    'async': {
      each() {},
      eachOf() {},
      eachLimit() {},
      eachOfLimit() {},
      map() {},
      series() {},
      parallel() {},
      waterfall() {},
      queue: () => ({ push() {}, drain() {} }),
    },
    'request': Object.assign(function request() {}, { get() {}, post() {}, put() {}, del() {} }),
    'mpv-video-player': {
      MpvVideoElement: { use() {} },
      defaultPlugins: [],
      ABLoopPlugin: {},
    },
    'auto-launch': class AutoLaunchMock {
      private _enabled: boolean;
      constructor() {
        this._enabled = readSetting('autoLaunch') === true;
      }
      enable() {
        this._enabled = true;
        writeSetting('autoLaunch', true);
        return Promise.resolve();
      }
      disable() {
        this._enabled = false;
        writeSetting('autoLaunch', false);
        return Promise.resolve();
      }
      isEnabled() {
        return Promise.resolve(this._enabled);
      }
    },
    'color-convert': {},
    'delta-e': { getDeltaE76: () => 0, getDeltaE00: () => 0 },
    'tiny-pinyin': { convertToPinyin: (text: string) => String(text || '').split('').join('') },
    'pinyinlite': { searchAll: () => [] },
    'read-chunk': () => BrowserBuffer.alloc(0),
    'write-file-atomic': writeFileAtomic,
    'cartesian-product': () => [],
    'sanitize-filename': (name: unknown) => String(name || '').replace(/[\\/:*?"<>|]/g, '-'),
    'normalize-strings': (text: unknown) => String(text || ''),
    'chinese_convert': { t2s: (s: string) => s, s2t: (s: string) => s, convert: (s: string) => s },
    'isnumber': () => false,
    'moment': (value?: unknown) => new Date(typeof value === 'string' || typeof value === 'number' ? value : Date.now()),
    'cancellation': () => ({ token: {} }),
    'fast-glob': () => Promise.resolve([]),
    'archiver': () => ({
      on() { return this; },
      pipe() { return this; },
      append() { return this; },
      directory() { return this; },
      finalize() { return this; },
    }),
    'electron-log': electronLog,
  });
  bareModules['tiny-pinyin'] = tinyPinyin;
  bareModules['pinyinlite'] = pinyinlite;
  bareModules['chinese_convert'] = chineseConvert;
  bareModules['cartesian-product'] = cartesianProduct;
}

/** 反编译目录中的真实拼音/简繁模块（原 IIFE 内联求值逐字迁入；装配在 install 期）。 */
export function installPinyinModules(): void {
  // 加载反编译目录中的真实拼音/简繁模块，保证原版快捷搜索的拼音与简繁路径可工作。
  const pinyinliteDict = loadOriginalModule('/src/my_modules/pinyinlite/src/dict_full.js');
  const pinyinliteFactory = loadOriginalModule('/src/my_modules/pinyinlite/src/pinyin.js');
  const fallbackPinyinlite: PinyinliteModule = Object.assign(
    function pinyinliteFallback() { return []; },
    { searchAll: function searchAllFallback() { return []; } }
  );
  pinyinlite = typeof pinyinliteFactory === 'function' && pinyinliteDict
    ? (pinyinliteFactory as (dict: unknown) => PinyinliteModule)(pinyinliteDict)
    : fallbackPinyinlite;
  pinyinlite.searchAll = pinyinlite.searchAll || function searchAllFallback() { return []; };

  const tw2cnMap = loadOriginalModule('/src/my_modules/chinese_convert/tw2cn.js') as Record<string, string> | undefined;
  const cn2twMap = loadOriginalModule('/src/my_modules/chinese_convert/cn2tw.js') as Record<string, string> | undefined;
  function convertByMap(text: string, map?: Record<string, string>): string {
    if (typeof text !== 'string' || !map) return text || '';
    let result = '';
    for (const ch of text) result += map[ch] === undefined ? ch : map[ch];
    return result;
  }
  chineseConvert = {
    charMap(ch: string, map?: Record<string, string>) { return map && map[ch] !== undefined ? map[ch] : ch; },
    textMap(text: string, map?: Record<string, string>) { return convertByMap(text, map); },
    cn2tw(text: string) { return convertByMap(text, cn2twMap); },
    tw2cn(text: string) { return convertByMap(text, tw2cnMap); },
    t2s(text: string) { return convertByMap(text, tw2cnMap); },
    s2t(text: string) { return convertByMap(text, cn2twMap); },
    convert(text: string, mode?: string) {
      return mode === 's2t' || mode === 'cn2tw' ? convertByMap(text, cn2twMap) : convertByMap(text, tw2cnMap);
    },
  };

  tinyPinyin = (loadOriginalModule('/src/my_modules/tiny-pinyin/index.js') as TinyPinyinModule) || {
    convertToPinyin: (text: string) => String(text || '').split('').join(''),
  };
  cartesianProduct = (loadOriginalModule('/src/my_modules/cartesian-product/index.js') as CartesianProductFn) || (() => []);

  bareModules['tiny-pinyin'] = tinyPinyin;
  bareModules['pinyinlite'] = pinyinlite;
  bareModules['chinese_convert'] = chineseConvert;
  bareModules['cartesian-product'] = cartesianProduct;
  const w = hostWindow();
  w.tinyPinyin = w.tinyPinyin || tinyPinyin;
  w.pinyinlite = w.pinyinlite || pinyinlite;
  w.chineseConvert = w.chineseConvert || chineseConvert;
}
