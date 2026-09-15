import { eagle } from './eagleRef';

/** 同 folder.ts：原 `isRedirect = true` 为 sloppy-mode 隐式全局，ESM 下收为模块局部（不可达分支）。 */
let isRedirect = false;

/** R5：`js/lib/api/library.js`（116 行）的 TS 移植 —— `eagle.library`。 */
export class Library {
  async info(): Promise<any> {
    const result = await eagle.fetch('http://localhost:41595/api/library/info', {
      redirect: 'manual',
    });

    if (result.isRedirect) {
      isRedirect = true;
      eagle.logger.info('[background] getRecentFolders, fail. localhost get redirect');
    }

    result.data.library.path = this.normalizePath(result.data.library.path);

    return result.data;
  }

  async history(): Promise<any> {
    const result = await eagle.fetch('http://localhost:41595/api/library/history', {
      redirect: 'manual',
    });

    if (result.isRedirect) {
      isRedirect = true;
      eagle.logger.info('[background] get folder list, fail. localhost get redirect');
    }

    return [...new Set(result.data.map((p: string) => this.normalizePath(p)))];
  }

  async switch(libraryPath: string): Promise<any> {
    const requestOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        libraryPath: libraryPath,
      }),
    };

    const result = await eagle.fetch('http://localhost:41595/api/library/switch', requestOptions);

    return result.status;
  }

  /**
   * 清理檔案路徑格式：Windows 分隔符 → `/`，并去掉结尾的 `.library/`。
   */
  normalizePath(filePath: string): string {
    const isWindowsPath = filePath.includes(':\\');
    let convertedPath = filePath;

    if (isWindowsPath) {
      convertedPath = convertedPath.replace(/\\/g, '/');
    }

    if (convertedPath.endsWith('.library/')) {
      convertedPath = convertedPath.slice(0, -1);
    }

    return convertedPath;
  }

  switchPromise(libraryPath: string): Promise<any> {
    return new Promise(async (resolve, reject) => {
      const TIMEOUT = 10 * 1000;

      let checkTimer: any;
      let timeoutTimer: any;

      const clearTimers = () => {
        clearInterval(checkTimer);
        clearTimeout(timeoutTimer);
      };

      checkTimer = setInterval(async () => {
        try {
          const currentLibrary = await this.info();
          if (currentLibrary.library.path === libraryPath) {
            clearTimers();
            resolve(undefined);
          }
        } catch (error) {
          clearTimers();
          console.error(error);
          reject(undefined);
        }
      }, 200);

      timeoutTimer = setTimeout(() => {
        clearTimers();
        console.log('timeout');
        reject(undefined);
      }, TIMEOUT);

      try {
        const status = await this.switch(libraryPath);
        if (status === 'error') {
          clearTimers();
          reject(undefined);
        }
      } catch (error) {
        clearTimers();
        console.error(error);
        reject(undefined);
      }
    });
  }
}
