import { eagle } from './eagleRef';

/**
 * R5：`js/lib/api/item.js`（101 行）的 TS 移植 —— `eagle.item`。
 *
 * 可达性（R5 实测探针 + 消费面核对，见 PROGRESS）：采集窗只走 `addFile`
 * （controller.save → eagle.item.addFile）。`addURL` / `batchSave` 在本窗无调用方——
 * 它们依赖 `eagle.screenCapturer`、`eagle.logger` 这两个**本窗从未提供**的全局
 * （原 classic 脚本同此），故照原样保留引用而不擅自补实现：补实现属未经测试验证的行为改动。
 */
export class Item {
  async addFile(data: any): Promise<any> {
    if (data.title) {
      data.title = eagle.utils.clearWeirdCharacters(data.title).substr(0, 65);
    }

    const options = {
      method: 'POST',
      'Content-Type': 'application/x-www-form-urlencoded',
      body: {
        type: 'image',
        version: 'eagle-collect-window',
        ...data,
      },
    };

    if (data.folderID && data.folderIDs) {
      throw new Error('The folderID and folderIDs should not exist at the same time');
    }

    return await eagle.fetch('http://localhost:41593', options);
  }

  /** 收藏網址 */
  async addURL(meta: any): Promise<any> {
    const options: any = {
      method: 'POST',
      'Content-Type': 'application/x-www-form-urlencoded',
      body: {
        type: 'save-url',
        version: 'eagle4.0',
        title: eagle.utils.clearWeirdCharacters(document.title).substr(0, 65),
        ...meta,
      },
    };

    if (meta.videoThumb) {
      // 如果有影片的話，就把影片的縮圖轉成 base64
      options.body.base64 = await eagle.utils.urlToBase64(meta.videoThumb, 10000);
    } else {
      // 如果沒有影片的話，就把當前頁面轉成 base64
      const captureOptions = {
        format: 'jpeg',
        quality: 85,
      };

      options.body.base64 = await eagle.screenCapturer.captureCurrentTab(captureOptions);
      if (options.body.base64) {
        const { base64 } = await eagle.utils.resizeBase64ImageToMaxSize(meta.src, 720);
        options.body.base64 = base64;
      }
    }

    return await eagle.fetch('http://localhost:41593', options);
  }

  /** 批次收藏 */
  async batchSave(items: any[]): Promise<any> {
    const options: any = {
      method: 'POST',
      'Content-Type': 'application/x-www-form-urlencoded',
      body: {
        type: 'import-images',
        version: 'eagle4.0',
        url: location.href,
        images: [],
      },
    };

    // 清洗數據
    items.forEach((image: any) => {
      // 避免沒名稱
      if (!image.title) {
        image.title = document.title;
      }

      // 避免名稱出現特殊符號
      image.title = eagle.utils.clearWeirdCharacters(image.title).substr(0, 65);

      // 有些网址可能是 "url 1.5x" 这样的格式，需避免
      if (image.src && image.src.indexOf(' ') > -1) {
        image.src = image.src.trim().split(' ')[0];
      }
    });

    options.body.title = eagle.utils.clearWeirdCharacters(document.title).substr(0, 65);
    options.body.images = JSON.stringify(items);

    eagle.logger.info(`[background] batch save[${location.href}] count[${items.length}]`);

    return await eagle.fetch('http://localhost:41593', options);
  }
}
