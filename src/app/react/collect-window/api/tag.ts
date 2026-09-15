import { eagle } from './eagleRef';

/** 同 folder.ts：原 `isRedirect = true` 为 sloppy-mode 隐式全局，ESM 下收为模块局部（不可达分支）。 */
let isRedirect = false;

/** R5：`js/lib/api/tag.js`（43 行）的 TS 移植 —— `eagle.tag`。 */
export class Tag {
  async recent(): Promise<any> {
    // listRecent
    const result = await eagle.fetch('http://localhost:41595/api/tag/listRecent', {
      redirect: 'manual',
    });

    if (result.isRedirect) {
      isRedirect = true;
      eagle.logger.info('[background] get folder list, fail. localhost get redirect');
    }

    return result.data;
  }

  async all(): Promise<any> {
    const result = await eagle.fetchLargeJSON('http://localhost:41595/api/tag/all', {
      redirect: 'manual',
    });

    if (result.isRedirect) {
      isRedirect = true;
      eagle.logger.info('[background] get folder list, fail. localhost get redirect');
    }

    return result.data;
  }

  async list(): Promise<any> {
    const result = await eagle.fetchLargeJSON('http://localhost:41595/api/tag/list', {
      redirect: 'manual',
    });

    if (result.isRedirect) {
      isRedirect = true;
      eagle.logger.info('[background] get folder list, fail. localhost get redirect');
    }

    return result.data;
  }
}
