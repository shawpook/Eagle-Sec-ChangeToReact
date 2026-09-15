import { eagle } from './eagleRef';

/**
 * 原脚本里 `isRedirect = true` 是**隐式全局赋值**（classic script 为 sloppy mode）。ESM 是严格
 * 模式，同样的写法会抛 ReferenceError；且该标志全仓无读取方，所在分支（`result.isRedirect`）
 * 在采集窗不可达——`eagle.fetch` 返回的是已解析 JSON，从不带 isRedirect。故收为模块局部变量，
 * 对可达路径零影响（见 PROGRESS R5 采集 API 迁移批的「不可达路径」清单）。
 */
let isRedirect = false;

/** R5：`js/lib/api/folder.js`（74 行）的 TS 移植 —— `eagle.folder`。 */
export class Folder {
  async recent(): Promise<any> {
    const result = await eagle.fetch('http://localhost:41595/api/folder/listRecent', {
      redirect: 'manual',
    });

    if (result.isRedirect) {
      // NOTE: 如果 localhost 被 redirect (SSR稀有案例，但是存在)
      isRedirect = true;
      eagle.logger.info('[background] getRecentFolders, fail. localhost get redirect');
    }

    return result.data;
  }

  async all(): Promise<any> {
    const result = await eagle.fetchLargeJSON('http://localhost:41595/api/folder/list', {
      redirect: 'manual',
    });

    if (result.isRedirect) {
      isRedirect = true;
      eagle.logger.info('[background] get folder list, fail. localhost get redirect');
    }

    return result.data;
  }

  /**
   * Creates a folder with the given name via the API and returns the result object.
   * 返回结构（逐字自原注释）：{ id, name, images, folders, modificationTime, imagesMappings,
   * tags, children, isExpand }。
   */
  async create(folderName: string): Promise<any> {
    folderName = folderName?.trim() as any;

    const data = JSON.stringify({
      folderName: folderName,
    });

    const result = await eagle.fetch('http://localhost:41595/api/folder/create', {
      method: 'POST',
      body: data,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    return result.data;
  }
}
