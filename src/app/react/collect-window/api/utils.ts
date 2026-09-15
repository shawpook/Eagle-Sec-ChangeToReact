import { eagle } from './eagleRef';

/**
 * R5：`js/lib/api/utils.js`（351 行）的 TS 移植 —— `eagle.utils` / `eagle.utils.tree` / `eagle.utils.url`。
 *
 * 逐字保留（消费面 = 采集窗 React 代码）：throttle/debounce 的 `this`+`arguments` 转发语义、
 * clearWeirdCharacters 的四段 replace 顺序、urlToBase64 的 GIF 单独超时（1200）与视频直接
 * resolve(undefined)、getElementDimensions 的 video/svg|audio/其它三分支、deepUnique 的
 * JSON.stringify 相邻比较、tree.walk 的数组/对象两分支与 depth 计数。
 *
 * 与原著一致：`eagle.logger` 在本窗从未提供（R5 探针实测 undefined），仅出现在
 * `resizeBase64ImageToMaxSize` / `urlToBase64` 之外的两处日志点，且其调用方（item.addURL）
 * 本窗不可达——照原样保留引用，不擅自补实现。
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

export class Utils {
  throttle(
    fn: Any, delay: number, immediate?: boolean, debounce?: boolean
  ): Any {
    let curr = +new Date();
    let lastCall = 0;
    let lastExec = 0;
    let timer: Any = null;
    let diff: number;
    let context: Any;
    let args: Any;
    const exec = function () {
      lastExec = curr;
      fn.apply(context, args);
    };
    return function (this: Any) {
      curr = +new Date();
      context = this;
      // eslint-disable-next-line prefer-rest-params
      args = arguments;
      diff = curr - (debounce ? lastCall : lastExec) - delay;
      clearTimeout(timer);
      if (debounce) {
        if (immediate) {
          timer = setTimeout(exec, delay);
        } else if (diff >= 0) {
          exec();
        }
      } else {
        if (diff >= 0) {
          exec();
        } else if (immediate) {
          timer = setTimeout(exec, -diff);
        }
      }
      lastCall = curr;
    };
  }

  debounce(func: Any, wait: number, immediate?: boolean): Any {
    let timeout: Any;
    return function (this: Any) {
      const context = this;
      // eslint-disable-next-line prefer-rest-params
      const args = arguments;
      const later = function () {
        timeout = null;
        if (!immediate) func.apply(context, args);
      };
      const callNow = immediate && !timeout;
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
      if (callNow) func.apply(context, args);
    };
  }

  clearWeirdCharacters(str: Any): string {
    if (str === undefined) return '';

    const emojiRegexPlus = /(?![*#0-9]+)[\p{Emoji}\p{Emoji_Modifier}\p{Emoji_Component}\p{Emoji_Modifier_Base}\p{Emoji_Presentation}]/gu;
    const emojiRegex = /\p{Emoji_Presentation}|\p{Extended_Pictographic}|([0-9]\u{FE0F}\u{20E3})|([*#\u{1F51F}]\u{FE0F}\u{20E3})/gmu; // NOTE: 這行好像刪得不夠乾淨
    const specialCharRegex = /[#$%^&*()<>:'"/\\|?*]+/g;

    // 移除開頭的連續 "."、emoji、特殊字元
    return String(str).replace(/^\.+/, '').replace(emojiRegexPlus, '').replace(specialCharRegex, '').replace(emojiRegex, '').replace('\uD83D', '').replace('\uFE0F', '');
  }

  isValidUrl(url: string): boolean {
    return /^(?:(?:https?|ftp):\/\/)?(?:(?!(?:10|127)(?:\.\d{1,3}){3})(?!(?:169\.254|192\.168)(?:\.\d{1,3}){2})(?!172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})(?:[1-9]\d?|1\d\d|2[01]\d|22[0-3])(?:\.(?:1?\d{1,2}|2[0-4]\d|25[0-5])){2}(?:\.(?:[1-9]\d?|1\d\d|2[0-4]\d|25[0-4]))|(?:(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)(?:\.(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)*(?:\.(?:[a-z\u00a1-\uffff]{2,})))(?::\d{2,5})?(?:\/\S*)?$/i.test(url);
  }

  absolutePath(href: string): string | undefined {
    if (!href) return undefined;
    // 有些网址可能是 "url 1.5x" 这样的格式，需避免
    if (href && href.indexOf(' ') > -1) {
      href = href.trim().split(' ')[0];
    }
    const link = document.createElement('a');
    link.href = href;
    return link.href;
  }

  urlToBase64(url: string, timeout: Any = 700): Promise<string | undefined> {
    return new Promise((resolve) => {
      if (url.startsWith('//')) {
        url = 'https:' + url;
      }

      const xhr = new XMLHttpRequest();
      let sent = false;
      const isVideo = url.toLowerCase().indexOf('.mp4') > -1 || url.toLowerCase().indexOf('.webm') > -1;
      const isGIF = url.toLowerCase().indexOf('.gif') > -1;

      if (isGIF) {
        timeout = 1200;
      }

      if (isVideo) {
        resolve(undefined);
        return;
      }

      xhr.onload = function () {
        clearTimeout(timeout);
        const reader = new FileReader();
        reader.onloadend = function () {
          if (!sent) {
            sent = true;
            if ((reader.result as string).indexOf('data:image') > -1) {
              resolve(reader.result as string);
            } else {
              resolve(undefined);
            }
          }
        };
        reader.readAsDataURL(xhr.response);
      };
      xhr.open('GET', url);
      xhr.responseType = 'blob';
      xhr.send();

      timeout = setTimeout(() => {
        // timeout, abort both the call and the timeout
        if (!sent) {
          sent = true;
          xhr.abort();
          resolve(undefined);
        }
      }, timeout);
    });
  }

  deepUnique(array: Any[]): Any[] {
    return array.sort().filter((element, index) => {
      return JSON.stringify(element) !== JSON.stringify(array[index - 1]);
    });
  }

  imageLoaded(img: Any): Promise<boolean> {
    return new Promise((resolve) => {
      if (img.complete) {
        resolve(true);
      } else {
        img.addEventListener('load', () => {
          resolve(true);
        });
        img.addEventListener('error', () => {
          resolve(false);
        });
      }
    });
  }

  getElementDimensions(element: Any): { width: number; height: number } {
    let result: Any = {
      width: 0,
      height: 0,
    };

    const tagName = element?.tagName?.toLowerCase();

    if (!tagName) {
      return result;
    }

    if (tagName === 'video') {
      result = {
        width: element.videoWidth || element.width,
        height: element.videoHeight || element.height,
      };
    } else if (tagName === 'svg' || tagName === 'audio') {
      result = {
        width: element.clientWidth,
        height: element.clientHeight,
      };
    } else {
      result = {
        width: element.naturalWidth || element.width,
        height: element.naturalHeight || element.height,
      };
    }

    result.width = parseInt(String(result.width));
    result.height = parseInt(String(result.height));

    return result;
  }

  getURLDimensions(url: string): Promise<{ width: number; height: number }> {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = url;
      img.onload = () => {
        resolve({
          width: img.width,
          height: img.height,
        });
      };
      img.onerror = () => {
        resolve({
          width: 0,
          height: 0,
        });
      };
    });
  }

  /**
   * 將 base64 編碼的圖片大小調整為不超過最大尺寸，同時保持其長寬比。
   */
  async resizeBase64ImageToMaxSize(dataURI: string, maxSize = 720): Promise<{ base64: string; width: number; height: number } | undefined> {
    return new Promise((resolve) => {
      const image = new Image();
      image.onload = function () {
        const canvas = document.createElement('canvas');

        if (image.width > maxSize) {
          canvas.width = maxSize;
          canvas.height = parseInt(String((maxSize * image.height) / image.width));
        } else {
          canvas.width = image.width;
          canvas.height = image.height;
        }

        const ctx = canvas.getContext('2d');
        ctx!.drawImage(
          image, 0, 0, canvas.width, canvas.height
        );

        const base64 = canvas.toDataURL();

        eagle.logger.info(`saveURL, base64[${base64.length}]`);

        resolve({
          width: canvas.width,
          height: canvas.height,
          base64: base64,
        });
      };

      image.onerror = () => {
        resolve(undefined);
      };

      image.src = dataURI;
    });
  }

  async sleep(time: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve();
      }, time);
    });
  }

  deepClone(obj: Any): Any {
    return JSON.parse(JSON.stringify(obj));
  }

  /** 判斷元素的媒體類型，返回 "video"、"audio" 或 "image" */
  determineMediaType(element: Any): string {
    const tagName = element.tagName.toLowerCase();

    if (tagName === 'video' || tagName === 'audio') {
      return tagName;
    }

    return 'image';
  }
}

export class TreeUtil {
  walk(
    tree: Any, property: string, callback: (node: Any, parentNode: Any, depth: number) => void, parentNode: Any = null, depth = 0
  ): void {
    if (tree === undefined) tree = [];

    // 如果 tree 是一個數組，則對其每個元素進行遍歷
    if (Array.isArray(tree)) {
      for (let i = 0; i < tree.length; i++) {
        this.walk(
          tree[i], property, callback, parentNode, depth
        );
      }
    }
    // 如果 tree 是一個物件，則調用 callback 並遍歷其子節點
    else {
      callback(tree, parentNode, depth);
      if (tree[property]) {
        this.walk(
          tree[property], property, callback, tree, depth + 1
        );
      }
    }
  }

  depth(tree: Any, property: string): number {
    let maxDepth = 0;

    this.walk(tree, property, (_node: Any, _parentNode: Any, depth: number) => {
      if (depth > maxDepth) {
        maxDepth = depth;
      }
    });

    return maxDepth;
  }
}

export class URLUtil {
  isSameHost(url1: string, url2: string): boolean {
    return new URL(url1).host === new URL(url2).host;
  }

  isSameRootDomain(url1: string, url2: string): boolean {
    // NOTE: 這個作法無法判斷 xxx.com.tw  xxx.com xxx.com.cn
    return this.getRootDomain(url1) === this.getRootDomain(url2);
  }

  getRootDomain(url: string): string {
    return new URL(url).host.split('.').slice(-2).join('.');
  }
}

/** 安装 `eagle.utils`（含 `tree` / `url` 两个子命名空间），对应原文件尾的三次实例化。 */
export function installUtils(): void {
  eagle.utils = new Utils();
  eagle.utils.tree = new TreeUtil();
  eagle.utils.url = new URLUtil();
}

export type { Any };
