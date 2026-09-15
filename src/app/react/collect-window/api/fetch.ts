import { eagle } from './eagleRef';

/**
 * R5：`js/lib/api/fetch.js`（64 行）的 TS 移植 —— `eagle.fetch` / `eagle.fetchLargeJSON`。
 *
 * 语义逐字（含 v6 老 API 的表单化怪癖）：
 *  - body 为对象时先剔除 null/undefined 键；
 *  - 非 `application/json` 时把数组值摊平成 `key[i]` 并以 `URLSearchParams` 序列化；
 *  - `fetchLargeJSON` 是**超大 JSON 的原样通路**（注释指出 Safari 重新序列化的性能问题），
 *    不做任何预处理——这条差异是调用方（folder.all / tag.all / tag.list 走 large、其余走 fetch）
 *    刻意区分的，必须保留。
 */
export class BaseFetch {
  async fetch(_url: string, _options?: any): Promise<any> {
    throw new Error('Not implemented');
  }
}

export class ForegroundFetch extends BaseFetch {
  async fetch(url: string, options?: any): Promise<any> {
    if (options?.body) {
      for (const key in options.body) {
        if (options.body[key] === null || options.body[key] === undefined) {
          delete options.body[key];
        }
      }
    }

    if (options?.headers?.['Content-Type'] !== 'application/json') {
      if (options?.body) {
        for (const [key, value] of Object.entries(options.body)) {
          if (Array.isArray(value)) {
            value.forEach((item, index) => {
              options.body[`${key}[${index}]`] = item;
            });
            delete options.body[key];
          }
        }

        options.body = new URLSearchParams(options.body);
      }
    }

    const result = await fetch(url, options);
    return await result.json();
  }

  // NOTE: 超大型 JSON 會因為前後端傳輸需要重新序列化，這會導致嚴重的效能問題，特別是 Safari
  async fetchLargeJSON(url: string, options?: any): Promise<any> {
    const result = await fetch(url, options);
    return await result.json();
  }
}

export class Fetch {
  // 原脚本 `constructor() { this._fetch = new ForegroundFetch(); }`——字段实际类型即 ForegroundFetch
  // （BaseFetch 只定义了 fetch 抽象口，没有 fetchLargeJSON，故此处按实型标注）。
  private _fetch: ForegroundFetch;

  constructor() {
    this._fetch = new ForegroundFetch();
  }

  async fetch(url: string, options?: any): Promise<any> {
    return this._fetch.fetch(url, options);
  }

  async fetchLargeJSON(url: string, options?: any): Promise<any> {
    return this._fetch.fetchLargeJSON(url, options);
  }
}

/** 原文件尾的 IIFE（安装 `eagle.fetch` / `eagle.fetchLargeJSON` 为直调函数形态）。 */
export function installFetch(): void {
  const eagleFetch = new Fetch();
  eagle.fetch = (url: any, options: any) => eagleFetch.fetch(url, options);
  eagle.fetchLargeJSON = (url: any, options: any) => eagleFetch.fetchLargeJSON(url, options);
}
