// @ts-nocheck
/**
 * R2 模块加载层：`require` 链 + 裸模块装配表（bareModules）+ 反编译目录模块（拼音/简繁）。
 *
 * 迁移自 `core/shimsLegacy.ts` 的 IIFE（原 2669-2806、2808-2952 区间），函数体逐字保留。
 * 与原实现的唯一差别是**装配时机显式化**：原 IIFE 在求值期一次性建表；此处拆为
 * `populateBareModules()` / `installPinyinModules()`，由 `shim/install.ts` 在
 * 全部模块求值完成后调用——避免模块间 TDZ，且使「装配」可被安装/释放逻辑掌控。
 * require 链语义零改动（`/src/` 前缀分支、`electron-settings`/`/src/i18n` 直取、
 * 未知名回落 `genericStub`）。
 */
import { isElectronRuntime, nativeFs, nativePath, nativeRequire } from "./environment";
import {
  BrowserBuffer, JsonRestServerStub, dirname, electronLog, fsModule, genericStub,
  lineByLineMock, osModule, pathModule, pluginModule, syncText, urlModule,
} from "./browserRuntime";
import { electron, remote, writeFileAtomic } from "./desktopCapability";
import { MockI18n, electronSettings, readSetting, writeSetting } from "./settingsI18n";

/** 反编译目录中真实拼音模块的装配结果（原 IIFE 模块级 const；此处 install 期赋值）。 */
export let pinyinlite: any;
export let chineseConvert: any;
export let tinyPinyin: any;
export let cartesianProduct: any;

const moduleCache = new Map();
export const appRootModule = {
  path: '/src',
  toString: () => '/src',
};

export function loadJsModule(urlPath) {
  if (moduleCache.has(urlPath)) return moduleCache.get(urlPath).exports;
  const source = syncText(urlPath);
  if (source === null) {
    const stub = genericStub(urlPath);
    moduleCache.set(urlPath, { exports: stub });
    return stub;
  }
  const module = { exports: {} };
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
    fn(module, module.exports, requireModule, window.process, window, window.Buffer, urlPath, dirname(urlPath));
  } catch (err) {
    console.warn(`[eagle-shim] failed to load ${urlPath}`, err);
    module.exports = genericStub(urlPath);
  }
  moduleCache.set(urlPath, module);
  return module.exports;
}

export function loadOriginalModule(urlPath) {
  try {
    return loadJsModule(urlPath);
  } catch (err) {
    console.warn(`[eagle-shim] failed to load ${urlPath}`, err);
    return undefined;
  }
}

export function requireModule(request) {
  const req = String(request || '').replace(/\\/g, '/');
  if (isElectronRuntime && nativeRequire && (req === 'fs' || req === 'node:fs' || req === 'path' || req === 'node:path')) {
    return nativeRequire(req);
  }
  if (req === 'app-root-path') return appRootModule;
  if (bareModules[req] !== undefined) return bareModules[req];
  if (req === '/src/i18n' || req === '/src/i18n/index.js') return MockI18n;
  if (req.startsWith('/src/')) {
    if (req.endsWith('/my_modules/electron-settings')) return electronSettings;
    if (req.endsWith('/my_modules/url')) return urlModule;
    if (req.endsWith('/my_modules/json-rest-light')) return { JsonRestServer: JsonRestServerStub };
    if (req.endsWith('/app/js/api-server-v2')) return { initAPIServerV2() {} };
    if (req.endsWith('/app/js/plugin')) return pluginModule;
    if (req.endsWith('/app/js/plugins/eagle-note-plugin')) return {};
    if (req.endsWith('/my_modules/n-readlines')) return lineByLineMock;
    if (req.endsWith('/my_modules/appdata-path')) return () => '/mock-user-data';
    if (req.endsWith('/my_modules/junk')) return { not: () => true, is: () => false };
    if (req.endsWith('/my_modules/is-hidden-file')) return { check: () => false };
    if (req.endsWith('/my_modules/file-icon')) return { getFileIcon: () => Promise.resolve({}), getFileIconSync: () => null };
    if (req.endsWith('/my_modules/is-directory')) return {
      check: (target) => {
        if (!nativeFs) return false;
        try { return nativeFs.statSync(target).isDirectory(); } catch (err) { return false; }
      },
      checkSync: (target) => {
        if (!nativeFs) return false;
        try { return nativeFs.statSync(target).isDirectory(); } catch (err) { return false; }
      },
    };
    if (req.endsWith('/my_modules/access')) return { checkALCs: () => true, checkAccess: () => true, checkACL: () => true };
    if (req.endsWith('/app/js/utils/remainingFilenameLength.js')) return () => 240;
    if (req.endsWith('/app/js/utils/getBestURL.js')) return () => '';
    if (req.endsWith('/app/js/utils/is-accelerator.js')) return () => true;
    if (req.endsWith('/app/js/utils/unorm.js')) return { nfc: (s) => s, nfd: (s) => s };
    // F06 第三批：本两行此前对 rotateImage/flipImage 返回 `() => {}` 空桩——主窗/预览窗
    // 的 `await util(...)` 对空函数不抛错，于是「界面上转了、磁盘一字节未动」的静默假成功
    // （flip 侧则是 `undefined.then` 的 TypeError 被记成「加载模块失败」）。两模块是产品原实现
    // （`src/app/js/utils/{rotate,flip}Image.js`，本批次不得改动），且经可行性实测：在 shim 的
    // require 链下可正常求值、导出 `(src, op[, options])` 且元数 2，JPEG 的 EXIF 路径可真实落盘。
    // 故改为与同文件其余 `/app/js/**` 模块**同一出口** `loadJsModule(req)`——不新增分支语义。
    if (req.endsWith('/app/js/utils/flipImage.js')) return loadJsModule(req);
    if (req.endsWith('/app/js/utils/rotateImage.js')) return loadJsModule(req);
    if (req.endsWith('/my_modules/tiny-pinyin')) return bareModules['tiny-pinyin'];
    if (req.endsWith('/my_modules/pinyinlite')) return bareModules['pinyinlite'];
    if (req.endsWith('/my_modules/cartesian-product')) return bareModules['cartesian-product'];
    if (req.endsWith('/my_modules/sanitize-filename')) return bareModules['sanitize-filename'];
    if (req.endsWith('/my_modules/chinese_convert')) return bareModules['chinese_convert'];
    if (req.endsWith('/my_modules/get-drive-type')) return () => 'local';
    if (req.endsWith('/my_modules/curl-request')) return { get: () => Promise.resolve(''), post: () => Promise.resolve('') };
    if (req.endsWith('/my_modules/downloadFile')) return { download: () => Promise.resolve() };
    if (req.endsWith('/my_modules/vtt2srt')) return () => {};
    if (req.endsWith('/my_modules/bplist-parse')) return () => '';
    if (req.endsWith('/my_modules/heif/native')) return {};
    if (req.endsWith('/my_modules/image-cropper')) return () => {};
    if (req.endsWith('/my_modules/get-associated-application')) return () => Promise.resolve([]);
    if (req.endsWith('/my_modules/image-size')) return () => null;
    if (req.endsWith('.json')) {
      const text = syncText(req);
      return text === null ? {} : JSON.parse(text);
    }
    return loadJsModule(req);
  }
  return genericStub(req);
}

/** 裸模块表（原 IIFE 内 `const bareModules = {...}` 逐字迁入；装配在 install 期）。 */
export const bareModules: Record<string, any> = {};

export function populateBareModules() {
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
      randomBytes: (size) => BrowserBuffer.alloc(size || 16),
      createHash: () => ({ update() { return this; }, digest: () => BrowserBuffer.alloc(32) }),
    },
    'child_process': {
      execSync: () => BrowserBuffer.from(''),
      exec() {},
      spawnSync: () => ({ stdout: BrowserBuffer.from(''), status: 0 }),
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
          if (real && typeof real.moveSync === 'function') return real;
        } catch (err) { /* fall through to fs-based facade */ }
      }
      const base = nativeFs || fsModule;
      if (!base || base.__eagleFseFacade) return base;
      const fse = Object.assign({}, base);
      fse.__eagleFseFacade = true;
      if (typeof fse.removeSync !== 'function') {
        fse.removeSync = (target) => base.rmSync ? base.rmSync(target, { recursive: true, force: true })
          : (base.rmdirSync ? base.rmdirSync(target, { recursive: true, force: true }) : undefined);
      }
      if (typeof fse.remove !== 'function') fse.remove = (target, cb) => { try { fse.removeSync(target); } catch (err) { /* 与 fs-extra 一致：异步版经 cb 报错 */ } cb && cb(); };
      if (typeof fse.copySync !== 'function') {
        fse.copySync = (src, dest, opts) => {
          const stat = base.statSync(src);
          if (stat.isDirectory()) {
            base.mkdirSync(dest, { recursive: true });
            for (const entry of base.readdirSync(src)) fse.copySync(base.join(src, entry), base.join(dest, entry), opts);
          } else {
            const { preserveTimestamps } = opts || {};
            base.copyFileSync(src, dest);
            if (preserveTimestamps) {
              base.utimesSync(dest, stat.atime, stat.mtime);
            }
          }
        };
      }
      if (typeof fse.copy !== 'function') fse.copy = (src, dest, opts, cb) => {
        const callback = typeof opts === 'function' ? opts : cb;
        try { fse.copySync(src, dest, typeof opts === 'function' ? undefined : opts); callback && callback(null); }
        catch (err) { callback && callback(err); }
      };
      if (typeof fse.moveSync !== 'function') {
        fse.moveSync = (src, dest, opts) => {
          try {
            base.renameSync(src, dest);
          } catch (err) {
            if (err && (err.code === 'EXDEV' || err.code === 'EPERM')) {
              fse.copySync(src, dest, opts);
              fse.removeSync(src);
            } else {
              throw err;
            }
          }
        };
      }
      if (typeof fse.ensureDirSync !== 'function') fse.ensureDirSync = (dir) => base.mkdirSync(dir, { recursive: true });
      if (typeof fse.ensureDir !== 'function') fse.ensureDir = (dir, cb) => { try { fse.ensureDirSync(dir); cb && cb(null); } catch (err) { cb && cb(err); } };
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
    'tiny-pinyin': { convertToPinyin: (text) => String(text || '').split('').join('') },
    'pinyinlite': { searchAll: () => [] },
    'read-chunk': () => BrowserBuffer.alloc(0),
    'write-file-atomic': writeFileAtomic,
    'cartesian-product': () => [],
    'sanitize-filename': (name) => String(name || '').replace(/[\\/:*?"<>|]/g, '-'),
    'normalize-strings': (text) => String(text || ''),
    'chinese_convert': { t2s: (s) => s, s2t: (s) => s, convert: (s) => s },
    'isnumber': () => false,
    'moment': (value) => new Date(value || Date.now()),
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
export function installPinyinModules() {
  // 加载反编译目录中的真实拼音/简繁模块，保证原版快捷搜索的拼音与简繁路径可工作。
  const pinyinliteDict = loadOriginalModule('/src/my_modules/pinyinlite/src/dict_full.js');
  const pinyinliteFactory = loadOriginalModule('/src/my_modules/pinyinlite/src/pinyin.js');
  pinyinlite = typeof pinyinliteFactory === 'function' && pinyinliteDict
    ? pinyinliteFactory(pinyinliteDict)
    : function pinyinliteFallback() { return []; };
  pinyinlite.searchAll = function searchAllFallback() { return []; };

  const tw2cnMap = loadOriginalModule('/src/my_modules/chinese_convert/tw2cn.js');
  const cn2twMap = loadOriginalModule('/src/my_modules/chinese_convert/cn2tw.js');
  function convertByMap(text, map) {
    if (typeof text !== 'string' || !map) return text || '';
    let result = '';
    for (const ch of text) result += map[ch] === undefined ? ch : map[ch];
    return result;
  }
  chineseConvert = {
    charMap(ch, map) { return map && map[ch] !== undefined ? map[ch] : ch; },
    textMap(text, map) { return convertByMap(text, map); },
    cn2tw(text) { return convertByMap(text, cn2twMap); },
    tw2cn(text) { return convertByMap(text, tw2cnMap); },
    t2s(text) { return convertByMap(text, tw2cnMap); },
    s2t(text) { return convertByMap(text, cn2twMap); },
    convert(text, mode) {
      return mode === 's2t' || mode === 'cn2tw' ? convertByMap(text, cn2twMap) : convertByMap(text, tw2cnMap);
    },
  };

  tinyPinyin = loadOriginalModule('/src/my_modules/tiny-pinyin/index.js') || {
    convertToPinyin: (text) => String(text || '').split('').join(''),
  };
  cartesianProduct = loadOriginalModule('/src/my_modules/cartesian-product/index.js') || (() => []);

  bareModules['tiny-pinyin'] = tinyPinyin;
  bareModules['pinyinlite'] = pinyinlite;
  bareModules['chinese_convert'] = chineseConvert;
  bareModules['cartesian-product'] = cartesianProduct;
  window.tinyPinyin = window.tinyPinyin || tinyPinyin;
  window.pinyinlite = window.pinyinlite || pinyinlite;
  window.chineseConvert = window.chineseConvert || chineseConvert;
}
