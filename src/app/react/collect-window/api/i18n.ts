import { eagle } from './eagleRef';

/**
 * R5：`js/lib/api/i18n.js`（91 行）的 TS 移植 —— `eagle.i18n`。
 *
 * 注意：采集窗的 React 代码**不消费 `eagle.i18n`**（它走 shims 的 `window.i18n` 与页面相对路径
 * 的 `locales/*.json`）。本类随原脚本一同安装以保持全局形状不变（见 install.ts 的键集断言），
 * 其 `init()` / `update()` / `changed()` 在本窗无调用方。
 *
 * `eagle.runtime`（`#initLocale`、`#registerRuntimeChannel`）与 `eagle.preference`
 * （`#getLocaleFromPreference`、`#registerRuntimeChannel`）在本窗从未提供（R5 探针实测 undefined），
 * 原脚本同样如此——故照原样保留引用，不擅自补实现。
 */
export class I18n {
  private onChangedCallback: Array<() => void> = [];

  /** 語系對照表 */
  languageMap: Record<string, string> = {
    zh: 'zh_CN',
    'zh-tw': 'zh_TW',
    'zh-cn': 'zh_CN',
    es: 'es',
    de: 'de',
    ru: 'ru',
    ja: 'ja',
    ko: 'ko',
    en: 'en',
  };

  /** 語系資料保留的地方 */
  words: any = {};
  loadedLocale = '';

  async init(): Promise<void> {
    await this.initLocale();
    this.registerRuntimeChannel();
  }

  /** 初始化語系 */
  private async initLocale(_forceOverride: any = null): Promise<void> {
    const locale = (window as any).preferences.general.language;

    // MV3: 不支援在前端 fetch，所以改用 eagle.runtime.getURL
    const localeFileURL = eagle.runtime.getURL(`locales/${locale}.json`);

    this.words = await fetch(encodeURI(localeFileURL))
      .then((response) => response.json())
      .catch((error) => {
        console.error(error);
      });

    this.loadedLocale = locale;
  }

  async update(forceOverride: any = null): Promise<void> {
    // HACK: 我必須丟一個 promise 出去，如果我這裡只 await 他會直接偷跑出去
    return new Promise(async (resolve) => {
      let locale = forceOverride || this.getLocaleFromPreference();

      if (locale !== this.loadedLocale) {
        // 如果是預設值，就改成瀏覽器語系
        if (locale === 'browser') {
          locale = this.getLocaleFromPreference();
        }
        await this.initLocale(locale);
      }

      resolve(undefined);
    });
  }

  /**
   * 取得偏好設定語系代碼；沒有對應的語系就回傳 en。
   */
  private getLocaleFromPreference(): string {
    const browserLocale = navigator.language.toLowerCase();
    const overrideLocale = eagle.preference.overrideLocale.toLowerCase();

    // 防呆，如果沒有對應的語系就回傳英文
    if (overrideLocale && overrideLocale !== 'browser') {
      return this.languageMap[overrideLocale] || 'en';
    }
    return this.languageMap[browserLocale] || this.languageMap[browserLocale.split('-')[0]] || 'en';
  }

  changed(callback: () => void): void {
    this.onChangedCallback.push(callback);
  }

  private registerRuntimeChannel(): void {
    eagle.preference.changed(async ({ dirty }: any) => {
      if (dirty.locale) {
        await this.update(eagle.preference.overrideLocale);
        this.onChangedCallback.forEach((callback) => callback());
      }
    });
  }
}
