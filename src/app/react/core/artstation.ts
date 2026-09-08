/**
 * b1-9bx-B：artstation-download.js（7,644B 应用代码）移植（index.html classic 标签退役）。
 *
 * 消费面 = BatchRenameArtstationModals（Artstation.isValidUrl/getUserInfo/getUserProjects；
 * title/loading/urlLabel/folderLabel/import/importManual 为 i18n 键非方法）。
 * 逐字移植 + 三处去依赖/哑雷拆除（录档）：
 * ① $.getJSON → fetch().json()（renderer 内 fetch 可用，dialog/harness 先例）；
 * ② require('async') parallelLimit → 本地实现（20 并发同构）；
 * ③ getUserInfo 原码 `finishCallback(...)` 未定义（ReferenceError 哑雷）→ callback、
 *    `if (!userName)` 原 code 缺 return（userName 空仍发 getJSON → 二次 callback）→ 补 return；
 * ④ $(html).attr('src') / $(doc).find('source') → DOMParser 等价（iframe 视频源提取）。
 */

const _w: any = window as any;

let installed = false;

/* async.parallelLimit 本地实现（cbs 每项 (cb) => void；first error → final(err, partial)） */
function parallelLimit(tasks: Array<(cb: any) => void>, limit: number, final: (err: any, results: any[]) => void): void {
  const results: any[] = new Array(tasks.length);
  let index = 0;
  let done = 0;
  let fired = false;
  const next = () => {
    if (index >= tasks.length) return;
    const i = index++;
    tasks[i]((err: any, value: any) => {
      results[i] = value;
      done++;
      if (err && !fired) { fired = true; final(err, results); return; }
      if (done === tasks.length) final(null, results);
      else next();
    });
  };
  for (let i = 0; i < Math.min(limit, tasks.length); i++) next();
}

async function getJSON(url: string): Promise<any> {
  const response = await fetch(url);
  return response.json();
}

function getVideoSrcFromIframe(asset: any): Promise<string | undefined> {
  return new Promise((resolve) => {
    const doc = new DOMParser().parseFromString(asset.player_embedded, 'text/html');
    const iframeSrc = doc.querySelector('iframe')?.getAttribute('src');
    if (!iframeSrc) { resolve(undefined); return; }
    fetch(iframeSrc).then((response) => response.text()).then((data) => {
      try {
        const parser = new DOMParser();
        const parsed = parser.parseFromString(data, 'text/html');
        const source = parsed.querySelector('source') as any;
        if (!source) { resolve(undefined); return; }
        /* 原码 truthy 判断逐字（indexOf 非 0 即真——src 以 mp4 开头时亦走 else） */
        if (source.src.indexOf('mp4')) {
          resolve(source.src);
        } else {
          resolve(undefined);
        }
      } catch (err) {
        resolve(undefined);
      }
    }).catch(() => resolve(undefined));
  });
}

async function parseAsset(item: any, raw: any, images: any[], cb: () => void): Promise<void> {
  const assets = raw.assets;
  for (let i = 0; i < assets.length; i++) {
    const asset = assets[i];
    if (asset.width > 2560 || asset.height > 2560) {
      if (asset.image_url.indexOf('covers') === -1 && asset.image_url.indexOf('video') === -1) {
        asset.image_url = asset.image_url.replace('/large/', '/4k/');
      }
    }
    if (asset.oembed && asset.oembed.provider_name === 'ArtStation' && asset.player_embedded && asset.player_embedded.indexOf('artstation.com') > -1) {
      const videoUrl = await getVideoSrcFromIframe(asset);
      asset.image_url = videoUrl || asset.image_url;
    }
    images.push({
      id: asset.id,
      width: asset.width,
      height: asset.height,
      link: item.permalink,
      title: item.title.replace(/%/g, '').replace(/[:|"<>,.^&*?//-]+/g, '').substr(0, 36),
      src: asset.image_url,
      projectIndex: raw.id,
      assetIndex: asset.position,
    });
  }
  cb();
}

const Artstation: any = {
  /* 是否为支持网址 */
  isValidUrl: (url: string) => url.indexOf('www.artstation.com/') > -1,
  /* 取得 artstation 用户名称 */
  getUserNameFromUrl: (url: string, urlPattern: string) => {
    let name = url.split(urlPattern)[1];
    const queryIdx = name.indexOf('?');
    if (queryIdx > -1) name = name.slice(0, queryIdx);
    return name.replace('/', '');
  },
  /* 取得用户信息 */
  getUserInfo: (url: string, callback: any) => {
    if (!Artstation.isValidUrl(url)) {
      /* 原码 finishCallback 未定义（哑雷）→ callback */
      callback({ msg: '网址格式错误' }, null);
      return;
    }
    const userName = Artstation.getUserNameFromUrl(url, 'https://www.artstation.com/');
    if (!userName) {
      callback({ msg: '用户名称错误' });
      return;
    }
    getJSON('https://www.artstation.com/users/' + userName + '/projects.json?page=99999').then((data) => {
      if (!data || data.total_count === 0) {
        callback({ msg: '无法获取该用户信息' });
        return;
      }
      callback(null, { url, userName, total: data.total_count });
    }).catch(() => callback({ msg: '无法获取该用户信息' }));
  },
  getUserProjects: (params: any, updateCallback: any, finishCallback: any) => {
    const total = params.total;
    const userName = params.userName;
    const pageCount = Math.ceil(total / 50);
    const urls: string[] = [];
    let done = 0;
    for (let i = 0; i < pageCount; i++) {
      urls.push('https://www.artstation.com/users/' + userName + '/projects.json?page=' + (i + 1));
    }
    const cbs = urls.map((url) => (callback: any) => {
      getJSON(url).then((data) => {
        if (data) {
          updateCallback(null, data.data);
          callback(null, data.data);
        } else {
          callback({ msg: '无法取得结果' });
        }
      }).catch(() => callback({ msg: '无法取得结果' }));
    });
    parallelLimit(cbs, 20, (err: any, result: any[]) => {
      if (!result || result.length === 0) {
        finishCallback({ msg: '下载失败' });
      }
      const images: any[] = [];
      result.forEach((data: any) => {
        data.forEach((item: any) => {
          getJSON('https://www.artstation.com/projects/' + item.hash_id + '.json').then((raw) => {
            parseAsset(item, raw, images, () => {
              done++;
              if (done === total) {
                const sorted = images.sort((a, b) => {
                  if (a.projectIndex === b.projectIndex) {
                    return b.assetIndex - a.assetIndex;
                  }
                  if (a.projectIndex < b.projectIndex) return -1;
                  if (a.projectIndex > b.projectIndex) return 1;
                  return 0;
                });
                finishCallback(err, sorted, result.length);
              }
            });
          });
        });
      });
    });
  },
};

export function installArtstation(): void {
  if (installed) return;
  installed = true;
  if (!_w.Artstation) _w.Artstation = Artstation;
}
