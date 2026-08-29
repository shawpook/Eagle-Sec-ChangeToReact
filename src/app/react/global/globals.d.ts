/* 全局类型声明：补齐浏览器 shims / preload 暴露的全局对象类型。 */
export {};

declare global {
  interface Window {
    i18n: any;
    eagle: any;
    eagleDesktop: any;
    electronSettings: any;
    $bodyScope?: any;
    languageBCP?: string;
    module?: any;
    __eagleMockI18n?: any;
    __mockLibrary?: any;
    $$electronIpc?: any;
    __eagleIpc?: any;
    __EAGLE_API_BASE_URL?: string;
    __EAGLE_EXTENSION_BASE_URL?: string;
    __EAGLE_THUMBNAIL_URL?: string;
  }
}
