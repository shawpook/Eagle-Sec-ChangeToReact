/* 全局类型声明：补齐浏览器 shims / preload 暴露的全局对象类型。 */
export {};

declare global {
  const process: any;
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
    dragCheck?: boolean;
    fuzzy_match?: (text: string, search: string) => string;
  }

  // 与旧版 DOM 属性逐字一致所需的自定义属性（Angular 指令名在 React 中以原生属性输出）。
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      key: any;
      s: any;
      'plugin-view': any;
      'web-view': any;
      'mpv-video': any;
      'ext-icon': any;
      'select-panel': any;
      'select-panel-list': any;
      'select-panel-overlay': any;
      'general-tag-select-panel': any;
      'inspector-tag-select-panel': any;
      group: any;
      item: any;
      'inspector-plugin-view': any;
    }
  }
  interface HTMLAttributes<T> {
    tippy?: string;
    'tippy-content'?: string;
    'tippy-placement'?: string;
    'library-icon'?: string;
    'library-path'?: string;
    parent?: string;
    resizable?: string;
    'on-resize'?: string;
    'auto-focus'?: string;
    'ng-click'?: string;
    selectall?: string;
    'comment-item'?: string;
    'comments-container'?: string;
    'crop-image'?: string;
    'tif-img'?: string;
    'tga-img'?: string;
    'controls-mode'?: string;
    'comment-video'?: string;
    duration?: any;
    'no-line-breaks'?: string;
  }
  interface InputHTMLAttributes<T> extends HTMLAttributes<T> {}
}
