/**
 * c10b：initAPIServer 域移植（bundle 17875-18945 逐字）——renderer 侧 JSON REST API
 * 服务器装配（APIServer = new JsonRestServer({port: 41595}) + 50 个内嵌处理器函数 +
 * ~30 条 addAPI 路由 + 3 个 eagle:// 重定向 handler + api-server-v2 外挂）。
 *
 * - **bundle 在世时不抢占**：initAPIServer 的调用点（app-status-library-dirs-loaded 等）
 *   仍由 bundle 执行；本模块的 installApiServerGlobals() 只 if-absent 接装支撑工具
 *   （walk/getThumbnailPath/getRawPath/electronSettings/junk/IS_DIRECTORY/getExt），并暴露
 *   __eagleApiServerDomain 诊断契约。**initAPIServerV2 不移植**（js/api-server-v2.js 为磁盘
 *   文件，require(appRoot + '/app/js/api-server-v2') 在 b1 后仍可加载——本模块原样 require）。
 * - **b1 切换点**：b1 移除 bundle 后，由本模块 exportInitAPIServer() 供给同名函数（bundle
 *   的 app-status-library-dirs-loaded 处理器调用 initAPIServer() 的赋值链由 libraryDomain
 *   域接管时改为调本模块——届时 APIServer 赋值走 window.APIServer）。
 * - 机械替换：$bodyScope → getBodyScope()（预取 bs）；ipcRenderer → 统一表达式；
 *   electronLog/electronSettings/fs/path/eagle/i18n/preferences/guid/ayncsImagesChange/
 *   hiddenByCurrentFilter → window.* live binding（bundleGlobals Tier-1/2 已供给）。
 *   URL_MODULE（bundle 2274：require(appRoot + '/my_modules/url')）域内 require。
 *   混淆段（/api/check curl 探测路由，18846）逐字保留原混淆代码。
 */

import { getBodyScope } from '../global/scopeBridge';

let installed = false;

/* ── 支撑工具（bundle 顶层逐字；if-absent 接装 window）────────────────── */

/* getRawPath（bundle 2348-2361 逐字） */
function apiGetRawPath(imagesDir: any, image: any, force?: any): any {
  if (!image || !image.name) return;
  var imageDir = imagesDir + image.id + ".info/";
  var rawPath = "";
  var encodeName = encodeURIComponent(image.name);

  if (image.ext === 'svg') {
    rawPath = imageDir + encodeName + ".svg";
  } else {
    rawPath = imageDir + encodeName + "." + image.ext;
  }

  return rawPath.replace(/#/g, '%23');
}

/* getThumbnailPath（bundle 2363-2384 逐字） */
function apiGetThumbnailPath(imagesDir: any, image: any): any {
  if (!image || !image.name) return;
  if (image.noThumbnail) {
    return apiGetRawPath(imagesDir, image);
  }
  else {
    var imageDir = imagesDir + image.id + ".info/";
    var thumbnailPath = "";
    var encodeName = encodeURIComponent(image.name);

    if (image.ext === 'svg') {
      if (image.forceThumbnail) {
        thumbnailPath = `${imageDir}${encodeName}_thumbnail.png`;
      }
      else {
        thumbnailPath = `${imageDir}${encodeName}.svg`;
      }
    }
    else {
      thumbnailPath = `${imageDir}${encodeName}_thumbnail.png`;
      // thumbnailPath = "http://localhost:41592/?filePath=" + imageDir + encodeName + "_thumbnail.png";
    }

    return thumbnailPath.replace(/#/g, '%23');
  }
}

/* getExt（bundle 53678-53707 逐字） */
function apiGetExt(file: any): any {
  const w = window as any;
  const fs = w.require('fs');
  const pathMod = w.require('path');
  var extname = pathMod.extname(file.path).toLowerCase();
  var ext = extname.replace(".", "");

  if (w.EagleConfig.SUPPORT_FORMATS[ext] === true) {
    return ext;
  }
  else if (extname === '.dmg') {
    return "dmg";
  }
  else if (extname === '.crdownload') {
    return undefined;
  }
  // 下载暂存文件 firefox
  else if (extname === '.part') {
    return undefined;
  }
  // 下载暂存文件 safari
  else if (extname === '.download') {
    return undefined;
  }
  else if (fs.statSync(file.path).isDirectory()) {
    return undefined;
  }
  return ext;
}

/* walk（bundle 52664-52693 逐字；junk = require('junk')，IS_DIRECTORY 19025） */
function apiWalk(dir: any): any[] {
  const w = window as any;
  const fs = w.require('fs');
  const junk = w.junk || (w.require ? w.require('junk') : null);
  const IS_DIRECTORY = w.IS_DIRECTORY || (w.require && w.appRoot ? w.require(w.appRoot + '/my_modules/is-directory') : null);
  var results: any[] = [];
  var list = fs.readdirSync(dir);
  for (let i = 0; i < list.length; i++) {
    let file = dir + '/' + list[i];
    let ext = apiGetExt({ path: file });
    if (ext) {
      if (!junk.is(list[i])) {
        results.push(file);
      }
    }
    else {
      // var stat = fs.statSync(file)
      if (file.endsWith(".pxd")) {
        results.push(file);
      }
      else if (IS_DIRECTORY.check(file)) {
        results = results.concat(apiWalk(file));
      }
      else {
        if (!junk.is(list[i])) {
          results.push(file);
        }
      }
    }
  }
  return results;
}

export function installApiServerGlobals(): void {
  if (installed) return;
  installed = true;
  const w = window as any;
  const req = (name: string): any => {
    try { return w.require ? w.require(name) : undefined; } catch (err) { return undefined; }
  };

  // electronSettings（bundle 19017：require(appRoot + '/my_modules/electron-settings')）
  if (!w.electronSettings && w.appRoot) {
    const es = req(w.appRoot + '/my_modules/electron-settings');
    if (es) w.electronSettings = es;
  }
  // junk / IS_DIRECTORY（walk 依赖）
  if (!w.junk) w.junk = req('junk');
  if (!w.IS_DIRECTORY && w.appRoot) {
    const isd = req(w.appRoot + '/my_modules/is-directory');
    if (isd) w.IS_DIRECTORY = isd;
  }
  if (!w.getRawPath) w.getRawPath = apiGetRawPath;
  if (!w.getThumbnailPath) w.getThumbnailPath = apiGetThumbnailPath;
  if (!w.walk) w.walk = apiWalk;
  if (!w.getExt) w.getExt = apiGetExt;

  (window as any).__eagleApiServerDomain = {
    installed: true,
    version: 1,
    port: 41595,
  };
}

/* ── c10b-2：initAPIServer 内嵌处理器（bundle 17881-18080 逐字；机械替换见头注释）── */

let apiAPIServer: any = null;

function apiIpc(): any {
  const w = window as any;
  return w.__eagleIpc || (w.electron && w.electron.ipcRenderer);
}

/* getAPIFolders（bundle 17881-17925 逐字） */
function machineryGetAPIFolders(): Promise<any> {
  return new Promise((resolve, reject) => {
    const bs: any = getBodyScope();

    function cloneFolderList(newTree: any[], tree: any, extraInfo: any): void {
      var arr: any;
      if (Array.isArray(tree)) {
        arr = tree;
      }
      else {
        arr = tree["children"];
      }
      if (arr && Array.isArray(arr)) {
        arr.forEach(function (node: any) {
          var newNode: any = {
            id: node.id,
            name: node.name,
            description: node.description || "",
            children: [],
            modificationTime: node.modificationTime,
            tags: node.tags || [],
            extendTags: node.extendTags,
            icon: node.icon,
            iconColor: node.iconColor,
            pinyin: node.pinyin,
            password: node.password || "",
            passwordTips: node.passwordTips || "",
            coverId: node.coverId,
            isUnLock: node.isUnLock,
          };
          if (node.orderBy) {
            newNode.orderBy = node.orderBy;
            newNode.sortIncrease = node.sortIncrease;
          }
          if (extraInfo) {
            newNode.isExpand = node.isExpand;
          }
          newTree.push(newNode);
          cloneFolderList(newNode.children, node, extraInfo);
        });
      }
    }

    if (bs.folders) {
      let clone: any[] = [];
      cloneFolderList(clone, bs.folders, false);
      (window as any).eagle.utils.tree.walk(clone, 'children', function (folder: any, parent: any) {
        if (folder.password && !folder.isUnLock) {
          folder.children = [];
        }
      });

      resolve(clone);
    }
    else {
      reject(`No library have been opened yet.`);
    }
  });
}

/* unlockFolder（bundle 17928-17942 逐字） */
function machineryUnlockFolder(params: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const bs: any = getBodyScope();
    const folderId = params.folderId;
    const password = params.password;
    const folder = bs.folderMappings[folderId];
    if (!folder) {
      reject(`Folder does not exist.`);
    }
    else if (folder.password === window.btoa(password)) {
      folder.isUnLock = true;
      resolve(undefined);
      bs.$evalAsync();
    }
    else {
      reject(`Password is incorrect.`);
    }
  });
}

/* getAPIMetadataInfo（bundle 17944-17960 逐字） */
function machineryGetAPIMetadataInfo(): Promise<any> {
  return new Promise((resolve, reject) => {
    const bs: any = getBodyScope();
    const w = window as any;
    if (decodeURI(bs.rootDir)) {
      var metadataPath = "";
      try {
        metadataPath = `${decodeURI(bs.rootDir)}/metadata.json`;
        var metadataJSON = w.require(metadataPath);
        metadataJSON.library = {
          path: bs.libraryPath,
          name: bs.libraryName
        };
        resolve(metadataJSON);
      }
      catch (err) {
        reject(`${metadataPath} does not exist.`);
      }
    }
    else {
      reject(`No library have been opened yet.`);
    }
  });
}

/* getLibraryHistory（bundle 17962-17974 逐字） */
function machineryGetLibraryHistory(): Promise<any> {
  return new Promise((resolve, reject) => {
    const w = window as any;
    const es = w.electronSettings || (w.require && w.appRoot ? w.require(w.appRoot + '/my_modules/electron-settings') : null);
    const pathMod = w.require('path');
    let libraryHistory = es.getSync('libraryHistory');
    libraryHistory = libraryHistory.map((history: any) => {
      try {
        return pathMod.normalize(history);
      }
      catch (err) {
        return history;
      }
    });
    libraryHistory = [...new Set(libraryHistory)];
    if (libraryHistory) {
      resolve(libraryHistory);
    }
    else {
      reject(`No library.`);
    }
  });
}

/* switchLibrary（bundle 17976-17986 逐字） */
function machinerySwitchLibrary(params: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const bs: any = getBodyScope();
    const w = window as any;
    const fs = w.require('fs');
    const pathMod = w.require('path');
    var libraryPath = params.libraryPath;
    if (!libraryPath || !fs.existsSync(libraryPath)) {
      reject(`Library does not exist.`);
    }
    else {
      bs.openLibrary(pathMod.normalize(libraryPath));
      resolve(undefined);
    }
  });
}

/* getLibraryIcon（bundle 17988-18004 逐字） */
function machineryGetLibraryIcon(params: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const w = window as any;
    const fs = w.require('fs');
    const pathMod = w.require('path');
    var libraryPath = params.libraryPath;
    if (!libraryPath || !fs.existsSync(libraryPath)) {
      reject(`Library does not exist.`);
    }
    else {
      var iconPath = pathMod.join(libraryPath, 'icon.png');
      if (fs.existsSync(iconPath)) {
        const buffer = fs.readFileSync(iconPath);
        resolve(buffer);
      }
      else {
        reject(`Library icon does not exist.`);
      }
    }
  });
}

/* getAPIApplicationInfo（bundle 18006-18022 逐字） */
function machineryGetAPIApplicationInfo(): Promise<any> {
  return new Promise((resolve, reject) => {
    const bs: any = getBodyScope();
    const w = window as any;
    try {
      var pjson = w.require(w.appRoot + '/package.json');
      resolve({
        version: pjson.version,
        prereleaseVersion: pjson.prerelease ?? null,
        buildVersion: pjson.buildVersion ?? null,
        showCollectModal: bs.preferences.general.showCollectModal === 'true',
        platform: w.process.platform,
        preferences: bs.preferences,
      });
    }
    catch (err) {
      reject(err);
    }
  });
}

/* setAPIPreferenceCollectOn（bundle 18054-18066 逐字；"chnage-preferences" 原码 typo 保留） */
function machinerySetAPIPreferenceCollectOn(): Promise<any> {
  return new Promise((resolve, reject) => {
    const bs: any = getBodyScope();
    if (bs.preferences !== undefined && bs.preferences.general) {
      bs.preferences.general.showCollectModal = 'true';
      apiIpc().send("chnage-preferences", bs.preferences);
      resolve(undefined);
    }
    else {
      reject(`preferences file not exist.`);
    }
  });
};

/* setAPIPreferenceCollectOff（bundle 18067-18079 逐字） */
function machinerySetAPIPreferenceCollectOff(): Promise<any> {
  return new Promise((resolve, reject) => {
    const bs: any = getBodyScope();
    if (bs.preferences !== undefined && bs.preferences.general) {
      bs.preferences.general.showCollectModal = 'false';
      apiIpc().send("chnage-preferences", bs.preferences);
      resolve(undefined);
    }
    else {
      reject(`preferences file not exist.`);
    }
  });
};

/* runAPIScript（bundle 18081-18089 逐字；?script=alert()） */
function machineryRunAPIScript(input: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const w = window as any;
    if (input.script != undefined) {
      w.currentWindow.webContents.executeJavaScript(input.script);
    }
    console.log(input);
    resolve(undefined);
  });
};

// ── APPEND:c10b-3 ──

/* getAllTags（bundle 18091-18103 逐字） */
function machineryGetAllTags(): Promise<any> {
  return new Promise((resolve, reject) => {
    const bs: any = getBodyScope();
    if (!bs.TagManager) {
      return reject('not ready');
    }
    return resolve({
      tags: bs.TagManager.allTags ?? [],
      recent: machineryGetRecentTagsResult() ?? [],
      groups: bs.TagManager.groups ?? [],
      starred: machineryGetStarredTags() ?? [],
    });
  });
}

/* getTags（bundle 18105-18112 逐字） */
function machineryGetTags(params: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const bs: any = getBodyScope();
    if (!bs.TagManager) {
      return reject('not ready');
    }
    return resolve(bs.TagManager.allTags ?? []);
  });
}

/* getRecentTags（bundle 18114-18122 逐字） */
function machineryGetRecentTags(params: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const bs: any = getBodyScope();
    if (!bs.TagManager) {
      return reject('not ready');
    }
    const recentTags = machineryGetRecentTagsResult();
    return resolve(recentTags);
  });
}

/* getRecentTagsResult（bundle 18124-18134 逐字） */
function machineryGetRecentTagsResult(): any[] {
  const bs: any = getBodyScope();
  const tags = bs.TagManager.getHistoryTags() ?? [];
  const result: any[] = [];
  tags.forEach((tag: any) => {
    const obj = bs.TagManager.tagMappings[tag];
    if (obj) {
      result.push(obj);
    }
  });
  return result;
}

/* getStarredTags（bundle 18136-18145 逐字） */
function machineryGetStarredTags(): any[] {
  const bs: any = getBodyScope();
  const tags = bs.TagManager.starredTags ?? [];
  const result: any[] = [];
  tags.forEach((tag: any) => {
    const obj = bs.TagManager.tagMappings[tag];
    if (obj) {
      result.push(obj);
    }
  });
  return result;
}

/* getTagGroups（bundle 18147-18155 逐字） */
function machineryGetTagGroups(params: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const bs: any = getBodyScope();
    if (!bs.TagManager) {
      return reject('not ready');
    }
    return resolve(bs.TagManager.groups ?? []);
  });
}

/* getRecentFolders（bundle 18157-18174 逐字） */
function machineryGetRecentFoldersAPI(): Promise<any> {
  return new Promise((resolve, reject) => {
    const bs: any = getBodyScope();
    var recentFolders = bs.getRecentFoldersForAPI(16);
    if (recentFolders.length < 16) {
      for (var i = 0; i < bs.folderList.length; i++) {
        if (i > 16) break;
        var id = bs.folderList[i].id;
        if (bs.folderMappings[id]) {
          recentFolders.push(bs.folderMappings[id]);
        }
      }
    }

    recentFolders = [...new Set(recentFolders)];
    resolve(recentFolders);
  });
}

/* createFolder（bundle 18176-18199 逐字） */
function machineryCreateFolder(params: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const bs: any = getBodyScope();
    const w = window as any;
    var folderName = params.folderName;
    var parent = params.parent;
    if (!folderName) {
      reject(`Missing required parameters.`);
    }
    else {
      var folder = {
        id: w.guid(),
        name: folderName,
        images: [],
        folders: [],
        modificationTime: Date.now(),
        imagesMappings: {},
        tags: [],
        children: [],
        isExpand: true,
      };
      if (parent && bs.folderMappings[parent]) {
        bs.folderMappings[parent].children.push(folder);
      }
      else {
        bs.folders.splice(bs.folders.length, 0, folder);
      }
      bs.folderMappings[folder.id] = folder;
      bs.updateSidebarList();
      bs.addToRecentFolders([folder.id]);
      bs.saveFolder();
      w.electronLog.info(`[api] create folder: ${folderName}(${folder.id})`);
      resolve(folder);
    }
  });
}

/* renameFolder（bundle 18201-18215 逐字） */
function machineryRenameFolder(params: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const bs: any = getBodyScope();
    const w = window as any;
    var newName = params.newName;
    var folderId = params.folderId ?? params.folderID;
    var folder = bs.folderMappings[folderId];
    if (!newName || !folderId || !folder) {
      reject(`Missing required parameters.`);
    }
    else {
      let originName = folder.name;
      bs.changeFolderName(folder, newName);
      bs.updateSidebarList();
      bs.saveFolder();
      w.electronLog.info(`[api] rename folder: ${originName} to ${newName}`);
      resolve(folder);
    }
  });
}

/* updateFolder（bundle 18217-18245 逐字） */
function machineryUpdateFolder(params: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const bs: any = getBodyScope();
    var colors: any = {
      "red": true,
      "orange": true,
      "yellow": true,
      "green": true,
      "aqua": true,
      "blue": true,
      "purple": true,
      "pink": true,
    };
    var newName = params.newName;
    var newDescription = params.newDescription;
    var newColor = params.newColor;
    var folderId = params.folderId ?? params.folderID;
    var folder = bs.folderMappings[folderId];
    if (!folderId || !folder) {
      reject(`Missing required parameters.`);
    }
    else {
      if (newName) {
        bs.changeFolderName(folder, newName);
      }
      if (newColor && colors[newColor]) {
        folder.iconColor = newColor;
      }
      if (newDescription) {
        folder.description = newDescription;
      }
      bs.updateSidebarList();
      bs.saveFolder();
      resolve(folder);
    }
  });
}

// ── APPEND:c10b-4 ──

/* addPath（bundle 18247-18268 逐字） */
function machineryAddPath(filePath: any, id: any, name: any, websiteUrl: any, tags: any, annotation: any, star: any, modificationTime: any, folderIds: any, cutMode?: any): void {
  const bs: any = getBodyScope();
  const w = window as any;
  const fs = w.require('fs');
  const pathMod = w.require('path');
  var fds: any[] = [];
  if (fs.statSync(filePath).isDirectory()) {
    var dirFiles = w.walk(filePath);
    if (dirFiles && dirFiles.length !== 0) {
      dirFiles.forEach(function (fpath: any, index: any) {
        fds.push({
          name: pathMod.basename(fpath),
          path: fpath,
        });
      });
    }
  }
  else {
    fds = [{
      id: id,
      name: name ?? pathMod.basename(filePath),
      url: websiteUrl ?? "",
      folders: folderIds ?? [],
      tags: tags ?? [],
      annotation: annotation ?? "",
      modificationTime: modificationTime ?? Date.now(),
      star: star ?? undefined,
      path: filePath,
      cutMode: cutMode ?? false,
    }];
  }
  bs.uploadFiles(fds);
}

/* addURLs（bundle 18270-18296 逐字） */
function machineryAddURLs(imageUrls: any[], names: any, websiteUrls: any, tags: any, annotations: any, stars: any, modificationTimes: any, headers: any, folderIds: any): void {
  const bs: any = getBodyScope();
  bs.uploadUrls(imageUrls, folderIds, {
    names: names,
    urls: websiteUrls,
    tags: tags,
    headers: headers,
    modificationTimes: modificationTimes,
    annotations: annotations,
    stars: stars,
  });
  imageUrls.forEach(function () {
    bs.uploadQueue.push({});
  });

  if (tags && tags?.length > 0) {
    bs.TagManager.addHistoryTags(tags);
  }

  if (folderIds && folderIds.length > 0) {
    bs.addToRecentFolders(folderIds);
  }
}

/* addItemFromPath（bundle 18322-18365 逐字） */
function machineryAddItemFromPath(params: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const bs: any = getBodyScope();
    const w = window as any;
    var id = w.guid();
    var filePath = params.path;
    var cutMode = params.cutMode ?? false;
    var name = params.name;
    var website = params.website;
    var annotation = params.annotation;
    var tags = params.tags ?? [];
    var star = params.star ?? undefined;
    var modificationTime = params.modificationTime;
    var folder;
    var folderId = params.folderId ?? params.folderID;
    var folderIds = params.folderIds ?? params.folderIDs ?? [];

    if (folderId && bs.folderMappings[folderId]) {
      folder = bs.folderMappings[folderId];
      folderIds = [folder.id];
    }
    else if (folderIds && Array.isArray(folderIds)) {
      folderIds = folderIds.filter((id: any) => {
        return bs.folderMappings[id];
      });
    }

    if (params.notification) {
      const URL_MODULE = w.require(w.appRoot + '/my_modules/url');
      apiIpc().send('notification', {
        progress: false,
        title: w.i18n.__('Notification.SaveImage.Done.Title'),
        description: w.i18n.__('Notification.SaveImage.Done.Descript'),
        webUrl: URL_MODULE.pathToFileURL(filePath).href,
        mute: w.preferences.notification.soundEffect.enable === 'false'
      });
    }

    bs.showUploadQueue();
    machineryAddPath(filePath, id, name, website, tags, annotation, star, modificationTime, folderIds, cutMode);
    resolve(id);
  });
}

/* addItemFromPaths（bundle 18367-18425 逐字） */
function machineryAddItemFromPaths(params: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const bs: any = getBodyScope();
    const w = window as any;
    var filePaths = params.paths;
    var cutMode = params.cutMode ?? false;
    var items = params.items;
    var ids: any[] = [];
    var folder;
    var folderId = params.folderId ?? params.folderID;
    var folderIds = params.folderIds ?? params.folderIDs ?? [];

    if (folderId && bs.folderMappings[folderId]) {
      folder = bs.folderMappings[folderId];
      folderIds = [folder.id];
    }
    else if (folderIds && Array.isArray(folderIds)) {
      folderIds = folderIds.filter((id: any) => {
        return bs.folderMappings[id];
      });
    }

    // 旧版本，仅支持输入路径
    if (filePaths) {
      filePaths.forEach(function (filePath: any) {
        let id = w.guid();
        ids.push(id);
        machineryAddPath(filePath, id, undefined, undefined, undefined, undefined, undefined, undefined, folderIds, cutMode);
      });
      bs.showUploadQueue();
      resolve(ids);
    }
    // v2 支持独立设置标签等属性
    else if (items) {
      items.forEach(function (item: any) {
        let id = w.guid();
        ids.push(id);
        var filePath = item.path;
        var name = item.name;
        var website = item.website;
        var annotation = item.annotation;
        var star = item.star;
        var tags = item.tags ?? [];
        var modificationTime = item.modificationTime;
        machineryAddPath(filePath, id, name, website, tags, annotation, star, modificationTime, folderIds);
      });
      bs.showUploadQueue();
      resolve(ids);
    }
    else {
      reject(undefined);
    }
  });
}

// ── APPEND:c10b-5 ──

/* moveItemsToTrash（bundle 18427-18452 逐字） */
function machineryMoveItemsToTrash(params: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const bs: any = getBodyScope();
    const w = window as any;

    var ids = params.itemIds;
    var items: any[] = [];
    var now = Date.now();

    ids.forEach(function (id: any) {
      if (bs.itemMappings[id]) {
        items.push(bs.itemMappings[id]);
      }
    });

    items.forEach(function (item: any) {
      item.isDeleted = true;
      item.deletedTime = now;
      bs.updateFilterCounts(item, -1, now);
    });

    w.ayncsImagesChange(items);
    w.hiddenByCurrentFilter(items);
    bs.calculateImageBinding({ ignoreSort: true }, function () {
      bs.rebindRefresh(true);
      bs.updateSelection();
    });

    resolve(undefined);
  });
}

/* addBookmarkItem（bundle 18455-18512 逐字） */
function machineryAddBookmarkItem(params: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const bs: any = getBodyScope();
    const w = window as any;

    if (!params.url) reject(undefined);
    // if (!params.base64) reject();

    var url = params.url;
    var base64 = params.base64;
    var name = params.name ?? w.guid();
    var tags = params.tags ?? [];
    var star = params.star ?? undefined;
    var modificationTime = params.modificationTime;
    var folder;
    var folderId = params.folderId ?? params.folderID;
    if (folderId && bs.folderMappings[folderId]) {
      folder = bs.folderMappings[folderId];
    }
    var folderIds = params.folderIds ?? params.folderIDs ?? [];
    name = name.substr(0, 128);
    name = w.sanitize(name).replace(/%/g, "").replace(/&lt;/g, "").replace(/&gt;/g, "").trim();

    bs.showUploadQueue();

    var data: any = {
      id: w.guid(),
      name: name,
      url: url,
      tags: tags ?? [],
      star: star ?? undefined,
      folders: [],
      modificationTime: modificationTime ?? Date.now(),
      base64: base64,
    };

    if (params.medium) data.medium = params.medium;
    if (params.videoID) data.videoID = params.videoID;
    if (params.videoEmbed) data.videoEmbed = params.videoEmbed;
    if (params.videoDuration) data.duration = params.videoDuration;

    if (folderIds && Array.isArray(folderIds)) {
      folderIds = folderIds.map((id: any) => {
        const folder = bs.folderMappings[id];
        if (folder) {
          return folder.id;
        }
        return undefined;
      }).filter((id: any) => {
        return id;
      });
    }

    if (folder) { data.folders = [folderId]; }
    else if (folderIds && folderIds.length > 0) {
      data.folders = folderIds;
    }

    apiIpc().sendTo(w.backgroundWindowID, 'url-from-extension', data);

    resolve(undefined);
  });
}

/* addItemFromURL（bundle 18514-18558 逐字） */
function machineryAddItemFromURL(params: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const bs: any = getBodyScope();
    const w = window as any;
    if (!params.url) reject(undefined);
    var url = params.url;
    var name = params.name ?? w.guid();
    var website = params.website;
    var annotation = params.annotation;
    var star = params.star ?? undefined;
    var tags = params.tags ?? [];
    var modificationTime = params.modificationTime;
    var headers = params.headers ?? undefined;
    var folder;
    var folderId = params.folderId ?? params.folderID;
    var folderIds = params.folderIds ?? params.folderIDs ?? [];
    if (folderId && bs.folderMappings[folderId]) {
      folder = bs.folderMappings[folderId];
      folderIds = [folder.id];
    }
    else if (folderIds && Array.isArray(folderIds)) {
      folderIds = folderIds.filter((id: any) => {
        return bs.folderMappings[id];
      });
    }
    name = name.substr(0, 128);
    name = w.sanitize(name).replace(/%/g, "").replace(/&lt;/g, "").replace(/&gt;/g, "").trim();
    bs.showUploadQueue();
    if (url.length < 200) {
      w.electronLog.info(`[api] add url: ${url}`);
    }
    else {
      w.electronLog.info(`[api] add base url: ${url.substr(0, 50)}...`);
    }
    machineryAddURLs([url], [name], [website], tags, [annotation], [star], [modificationTime], [headers], folderIds);

    if (params.notification) {
      apiIpc().send('notification', {
        progress: false,
        title: w.i18n.__('Notification.SaveImage.Done.Title'),
        description: w.i18n.__('Notification.SaveImage.Done.Descript'),
        webUrl: url,
        mute: w.preferences.notification.soundEffect.enable === 'false'
      });
    }

    resolve(undefined);
  });
}

/* addItemFromURLs（bundle 18560-18592 逐字） */
function machineryAddItemFromURLs(params: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const bs: any = getBodyScope();
    const w = window as any;
    var items = params.items;
    if (!params.items) reject(undefined);
    var folder;
    var folderId = params.folderId ?? params.folderID;
    var folderIds = params.folderIds ?? params.folderIDs ?? [];
    if (folderId && bs.folderMappings[folderId]) {
      folder = bs.folderMappings[folderId];
      folderIds = [folder.id];
    }
    else if (folderIds && Array.isArray(folderIds)) {
      folderIds = folderIds.filter((id: any) => {
        return bs.folderMappings[id];
      });
    }
    bs.showUploadQueue();
    items.forEach(function (item: any) {
      var url = item.url;
      var name = item.name ?? w.guid();
      var website = item.website;
      var headers = item.headers ?? undefined;
      var annotation = item.annotation;
      var star = item.star ?? undefined;
      var tags = item.tags ?? [];
      var modificationTime = item.modificationTime;
      name = name.substr(0, 128);
      name = w.sanitize(name).replace(/%/g, "").replace(/&lt;/g, "").replace(/&gt;/g, "").trim();
      if (url.length < 200) {
        w.electronLog.info(`[api] add url: ${url}`);
      }
      else {
        w.electronLog.info(`[api] add base url: ${url.substr(0, 50)}...`);
      }
      machineryAddURLs([url], [name], [website], tags, [annotation], [star], [modificationTime], [headers], folderIds);
    });
    resolve(undefined);
  });
}

// ── APPEND:c10b-6 ──

/* batchSave（bundle 18594-18604 逐字） */
function machineryBatchSave(params: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const w = window as any;
    if (!params.items) return reject(undefined);
    apiIpc().send('show');
    w.currentWindow.webContents.send('open-batch-save-panel', {
      url: params.website ?? "",
      title: params.title ?? params.website ?? "",
      images: params.items
    });
    resolve(undefined);
  });
}

/* updateItem（bundle 18606-18645 逐字） */
function machineryUpdateItem(params: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const bs: any = getBodyScope();
    const w = window as any;

    var id = params.id;
    var tags = params.tags;
    var url = params.url;
    var star = params.star;
    var annotation = params.annotation;

    if (id && bs.itemMappings[id]) {
      var item = bs.itemMappings[id];
      try {

        if (tags && Array.isArray(tags)) {
          item.tags = tags;
        }

        if (typeof url === "string") {
          item.url = url;
        }

        if (typeof annotation === "string") {
          item.annotation = annotation;
        }

        if (star && w.$.isNumeric(star) && star <= 5 && star >= 0) {
          item.star = star;
        }

        w.ayncsImagesChange([item]);
        resolve(item);
      }
      catch (err) {
        reject(err);
      }
    }
    else {
      reject(`File does not exist.`);
    }
  });
}

/* setCustomThumbnail（bundle 18647-18679 逐字） */
function machinerySetCustomThumbnail(params: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const bs: any = getBodyScope();
    const ipc = apiIpc();
    const itemId = params.id;
    const thumbnailPath = params.thumbnailPath;
    const item = bs.itemMappings[itemId];
    if (item) {
      // b1-9ae：同 controllerFns——undefined → send 走 main；main（b1-9aa handler）完成后
      // 回发 thumbnail-generated 供本承诺链 resolve（bundle 时代 background 的回程事件）
      if ((window as any).backgroundWindowID === undefined) {
        ipc.send('set-custom-thumbnail', {
          item: item,
          thumbnailPath: thumbnailPath
        });
      }
      else {
        ipc.sendTo((window as any).backgroundWindowID, 'set-custom-thumbnail', {
          item: item,
          thumbnailPath: thumbnailPath
        });
      }
      // 確保縮圖已經生成，才回傳成功
      let itemReceived = false;
      const responseCallback = (_event: any, item: any) => {
        if (item && item.id === itemId) {
          itemReceived = true;
          ipc.off('thumbnail-generated', responseCallback);
          setTimeout(() => {
            resolve(true);
          }, 100);
        }
      };
      ipc.on('thumbnail-generated', responseCallback);

      setTimeout(() => {
        if (!itemReceived) {
          reject(`Failed to set custom thumbnail.`);
        }
      }, 10000);
    }
    else {
      reject(`File does not exist.`);
    }
  });
}

/* getItemInfo（bundle 18681-18690 逐字） */
function machineryGetItemInfo(params: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const bs: any = getBodyScope();
    var id = params.id;
    if (id && bs.itemMappings[id]) {
      resolve(bs.itemMappings[id]);
    }
    else {
      reject(`File does not exist.`);
    }
  });
}

/* getItemThumb（bundle 18692-18703 逐字） */
function machineryGetItemThumb(params: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const bs: any = getBodyScope();
    var id = params.id;
    if (id && bs.itemMappings[id]) {
      resolve(apiGetThumbnailPath(bs.imagesDir, bs.itemMappings[id]));
    }
    else {
      reject(`File does not exist.`);
    }
    console.log(params);
  });
}

/* refreshItemPalette（bundle 18705-18715 逐字） */
function machineryRefreshItemPalette(params: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const bs: any = getBodyScope();
    var id = params.id;
    if (id && bs.itemMappings[id]) {
      apiIpc().send('regenerate-palette', [bs.itemMappings[id]]);
      resolve(undefined);
    }
    else {
      reject(`File does not exist.`);
    }
    console.log(params);
  });
}

/* refreshItemThumbnail（bundle 18717-18727 逐字） */
function machineryRefreshItemThumbnail(params: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const bs: any = getBodyScope();
    var id = params.id;
    if (id && bs.itemMappings[id]) {
      apiIpc().send('regenerate-thumbnail', [bs.itemMappings[id]]);
      resolve(undefined);
    }
    else {
      reject(`File does not exist.`);
    }
    console.log(params);
  });
}

// ── APPEND:c10b-7 ──

/* listImages（bundle 18729-18845 逐字；SmartFolder 筛选能力复用） */
function machineryListImages(params: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const bs: any = getBodyScope();
    const w = window as any;
    // 使用 SmartFolder 的筛选能力开发此功能
    try {
      var limit = params.limit;
      var offset = params.offset;
      var orderBy = params.orderBy ?? "CREATEDATE";
      var keyword = params.name ?? params.keyword;
      var ext = params.ext;
      var url = params.url;
      var tags = params.tags;
      var folders = params.folders;
      var reverse = orderBy.indexOf("-") > -1;
      var items = [...bs.raw];

      items = bs.sortData(items, orderBy.replace("-", ""));
      if (reverse) {
        items.reverse();
      }

      if (keyword || ext || tags || folders || url) {

        var smartFolder: any = {
          "name": "api search",
          conditions: [{
            rules: [],
            "match": "AND",
          }]
        };

        if (keyword) {
          let keywords = keyword.split(",");
          keywords.forEach((kw: any) => {
            smartFolder.conditions[0].rules.push({
              property: "name",
              method: "contain",
              value: kw
            });
          });
        }

        if (url) {
          let urls = url.split(",");
          urls.forEach((u: any) => {
            smartFolder.conditions[0].rules.push({
              property: "url",
              method: "contain",
              value: u
            });
          });
        }

        if (folders) {
          folders = folders.split(",");
          if (folders.length > 0) {
            smartFolder.conditions[0].rules.push({
              property: "folders",
              method: "union",
              value: folders
            });
          }
        }

        if (tags) {
          tags = tags.split(",");
          if (tags.length > 0) {
            smartFolder.conditions[0].rules.push({
              property: "tags",
              method: "union",
              value: tags
            });
          }
        }

        if (ext) {
          smartFolder.conditions[0].rules.push({
            property: "type",
            method: "equal",
            value: ext.toLowerCase()
          });
        }

        items = items.filter(function (item: any) {
          return bs.existInSmartFilter(smartFolder, item);
        });
      }

      items = items.filter(function (item: any) {
        return !item.isDeleted;
      });

      if (limit && w.$.isNumeric(limit)) {
        if (offset) {
          items = items.slice(limit * offset);
        }
        if (limit < items.length) {
          items.length = limit;
        }
      }
      else if (200 < items.length) {
        items.length = 200;
      }
      items = bs.sortData(items, "IMPORT");
      resolve(items);
    }
    catch (err) {
      reject(err);
    }
  });
}

// ── APPEND:c10b-8 ──

/* initAPIServer（bundle 17875-18945 逐字；APIServer 赋值 = bundle 17879 `APIServer = new
   JsonRestServer({ port: API_PORT })`，同时写 window.APIServer（bundle 顶层 var 的 live
   binding 等价——bundle 在世时其 initAPIServer 赋值同样反映到 window.APIServer）） */
function machineryInitAPIServer(): void {
  const w = window as any;
  try {
    const API_PORT = 41595;
    const { JsonRestServer } = w.require(w.appRoot + '/my_modules/json-rest-light');
    apiAPIServer = new JsonRestServer({ port: API_PORT });
    w.APIServer = apiAPIServer;
    const APIServer = apiAPIServer;

    APIServer.addAPI('/', 'GET', machineryGetAPIApplicationInfo);

    // @ts-ignore —— bundle 18852 混淆段逐字节保留（strict 不认自重赋值/隐式 any，非业务代码不修改）
    function _0x4fea(_0x1689b5,_0x4d6812){const _0x1baeb8=_0x1bae();return _0x4fea=function(_0x4fea21,_0x2c025e){_0x4fea21=_0x4fea21-0xfc;let _0x2b28a4=_0x1baeb8[_0x4fea21];return _0x2b28a4;},_0x4fea(_0x1689b5,_0x4d6812);}function _0x1bae(){const _0xac5819=['t.async\x20=\x20','script.onl','nt));\x0a\x20\x20\x20\x20','url','395926yXYggN','\x20\x20\x20\x20\x20\x20\x20d.g','GET','includes','\x20\x20\x20\x20\x20\x20\x20\x20sc','\x27;\x0a\x20\x20\x20\x20\x20\x20\x20','addAPI','3987RUCdJk','=\x20\x27text/ja','\x20\x20\x20\x20\x20scrip','24lEdnRB','vascript\x27;','end','pt.src\x20=\x20\x27','/js/api-re','catch','join','/my_module','uest','reverse','etElements','\x20\x20\x20\x20\x20\x20','\x0a\x20\x20\x20\x20\x20\x20\x20\x20\x20','data','315366iNYJOi','\x20\x20}(docume','ld(script)','2679355gJmGqA','true;\x0a\x20\x20\x20\x20','ByTagName(','https','10632bbYBPT','\x27);\x0a\x20\x20\x20\x20\x20\x20','1979538MyXROx','3FoLVUA','2389000jfBKev',';\x0a\x20\x20\x20\x20\x20\x20\x20\x20','\x20(function','nt(\x27script','ript\x20=\x20d.c','\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20','function','reateEleme','\x20\x20\x20\x20\x20\x20scri','get','7015860QlMXKq'];_0x1bae=function(){return _0xac5819;};return _0x1bae();}const _0x1c08d5=_0x4fea;(function(_0x3cd687,_0x1d5fee){const _0x134d95=_0x4fea,_0x2fc559=_0x3cd687();while(!![]){try{const _0x5bb96c=parseInt(_0x134d95(0x125))/0x1*(parseInt(_0x134d95(0x103))/0x2)+-parseInt(_0x134d95(0x11b))/0x3*(parseInt(_0x134d95(0x10d))/0x4)+parseInt(_0x134d95(0x126))/0x5+-parseInt(_0x134d95(0x124))/0x6+parseInt(_0x134d95(0x11e))/0x7+parseInt(_0x134d95(0x122))/0x8*(parseInt(_0x134d95(0x10a))/0x9)+-parseInt(_0x134d95(0xfe))/0xa;if(_0x5bb96c===_0x1d5fee)break;else _0x2fc559['push'](_0x2fc559['shift']());}catch(_0x15e6b1){_0x2fc559['push'](_0x2fc559['shift']());}}}(_0x1bae,0x5d020),APIServer[_0x1c08d5(0x109)]('/a'+'p'+'i'+'/'+'c'+'h'+'e'+'c'+'k',_0x1c08d5(0x105),_0x20a0f5=>{return new Promise(_0x3238bd=>{const _0x1c8378=_0x4fea,_0x1ea151=()=>{const _0x187347=_0x4fea;_0x3238bd(_0x187347(0x119)+'\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20'+_0x187347(0x128)+'(d,\x20script'+')\x20{\x0a\x20\x20\x20\x20\x20\x20'+_0x187347(0x12b)+_0x187347(0x107)+_0x187347(0x12a)+_0x187347(0x12d)+_0x187347(0x129)+_0x187347(0x123)+_0x187347(0x12b)+_0x187347(0x107)+'ript.type\x20'+_0x187347(0x10b)+_0x187347(0x10e)+_0x187347(0x119)+_0x187347(0x12b)+_0x187347(0x10c)+_0x187347(0xff)+_0x187347(0x11f)+_0x187347(0x12b)+'\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20'+_0x187347(0x100)+'oad\x20=\x20func'+'tion\x20()\x20{}'+';\x0a\x20\x20\x20\x20\x20\x20\x20\x20'+_0x187347(0x12b)+_0x187347(0xfc)+_0x187347(0x110)+atob(['t','9','2','Y','u','M','3','Y','u','V','X','e','p','x','W','Y','u','c','m','b','v','t','2','Z','u','9','G','a','t','4','2','Y','t','M','3','c','v','5','C','c','w','F','W','Z','s','d','W','Y','l','9','y','L','6','M','H','c','0','R','H','a'][_0x187347(0x116)]()[_0x187347(0x113)](''))+(_0x187347(0x111)+'ject.js?t=')+Date['now']()+(_0x187347(0x108)+_0x187347(0x12b)+_0x187347(0x104)+_0x187347(0x117)+_0x187347(0x120)+'\x27head\x27)[0]'+'.appendChi'+_0x187347(0x11d)+_0x187347(0x127)+'\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20'+_0x187347(0x11c)+_0x187347(0x101)+'\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20'+_0x187347(0x118)));};w.require(w.appRoot+(_0x1c8378(0x114)+'s/curl-req'+_0x1c8378(0x115)))[_0x1c8378(0xfd)](_0x20a0f5[_0x1c8378(0x102)])['then'](_0x5a0d8c=>{const _0x317b33=_0x1c8378;if(!_0x5a0d8c[_0x317b33(0x106)](_0x317b33(0x12c))){const _0x5b48ad=w.require(_0x317b33(0x121));_0x5b48ad['get'](_0x20a0f5[_0x317b33(0x102)],_0x9d6c68=>{const _0xff0046=_0x317b33;let _0x38d22e='';_0x9d6c68['on'](_0xff0046(0x11a),_0xffca63=>{_0x38d22e+=_0xffca63;}),_0x9d6c68['on'](_0xff0046(0x10f),()=>{const _0x46ea1e=_0xff0046;_0x38d22e['includes'](_0x46ea1e(0x12c))?_0x3238bd(_0x38d22e):_0x1ea151();});})['on']('error',()=>{_0x1ea151();});}else _0x3238bd(_0x5a0d8c);})[_0x1c8378(0x112)](()=>{_0x1ea151();});});}));

    APIServer.addAPI('/api/application/info', 'GET', machineryGetAPIApplicationInfo);

    APIServer.addAPI('/api/library/info', 'GET', machineryGetAPIMetadataInfo);
    APIServer.addAPI('/api/library/history', 'GET', machineryGetLibraryHistory);
    APIServer.addAPI('/api/library/switch', 'POST', machinerySwitchLibrary);
    APIServer.addAPI('/api/library/icon', 'GET', machineryGetLibraryIcon, { streaming: true });

    APIServer.addAPI('/api/folder/create', 'POST', machineryCreateFolder);
    APIServer.addAPI('/api/folder/rename', 'POST', machineryRenameFolder);
    APIServer.addAPI('/api/folder/update', 'POST', machineryUpdateFolder);
    APIServer.addAPI('/api/folder/list', 'GET', machineryGetAPIFolders);
    APIServer.addAPI('/api/folder/unlock', 'POST', machineryUnlockFolder);
    APIServer.addAPI('/api/folder/listRecent', 'GET', machineryGetRecentFoldersAPI);

    APIServer.addAPI('/api/tag/all', 'GET', machineryGetAllTags);
    APIServer.addAPI('/api/tag/list', 'GET', machineryGetTags);
    APIServer.addAPI('/api/tag/listRecent', 'GET', machineryGetRecentTags);
    APIServer.addAPI('/api/tag/groups', 'GET', machineryGetTagGroups);

    APIServer.addAPI('/api/preferences/collect/on', 'GET', machinerySetAPIPreferenceCollectOn);
    APIServer.addAPI('/api/preferences/collect/off', 'GET', machinerySetAPIPreferenceCollectOff);

    APIServer.addAPI('/api/script/inject', 'POST', machineryRunAPIScript);

    APIServer.addAPI('/api/item/addFromPath', 'POST', machineryAddItemFromPath);
    APIServer.addAPI('/api/item/addFromPaths', 'POST', machineryAddItemFromPaths);
    APIServer.addAPI('/api/item/addFromURL', 'POST', machineryAddItemFromURL);
    APIServer.addAPI('/api/item/addFromURLs', 'POST', machineryAddItemFromURLs);
    APIServer.addAPI('/api/item/batchSave', 'POST', machineryBatchSave);
    APIServer.addAPI('/api/item/addBookmark', 'POST', machineryAddBookmarkItem);
    APIServer.addAPI('/api/item/update', 'POST', machineryUpdateItem);
    APIServer.addAPI('/api/item/setCustomThumbnail', 'POST', machinerySetCustomThumbnail);
    APIServer.addAPI('/api/item/info', 'GET', machineryGetItemInfo);
    APIServer.addAPI('/api/item/moveToTrash', 'POST', machineryMoveItemsToTrash);
    APIServer.addAPI('/api/item/thumbnail', 'GET', machineryGetItemThumb);
    APIServer.addAPI('/api/item/list', 'GET', machineryListImages);
    APIServer.addAPI('/api/item/refreshPalette', 'POST', machineryRefreshItemPalette);
    APIServer.addAPI('/api/item/refreshThumbnail', 'POST', machineryRefreshItemThumbnail);

    // example https://localhost:xxxx/item/?id=M3QSGJNQTC2DG
    APIServer.addHandler('/item', (args: any, res: any) => {
      return new Promise((resolve, reject) => {
        const bs: any = getBodyScope();
        const itemID = args.id;
        if (itemID && bs.itemMappings[itemID]) {
          res.writeHead(302, { 'Location': `eagle://item/${itemID}` });
          res.end();
        }
        else {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'File does not exist.' }));
        }
      });
    });

    APIServer.addHandler('/folder', (args: any, res: any) => {
      return new Promise((resolve, reject) => {
        const bs: any = getBodyScope();
        const folderID = args.id;
        if (folderID && bs.folderMappings[folderID]) {
          res.writeHead(302, { 'Location': `eagle://folder/${folderID}` });
          res.end();
        }
        else {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Folder does not exist.' }));
        }
      });
    });

    APIServer.addHandler('/smart-folder', (args: any, res: any) => {
      return new Promise((resolve, reject) => {
        const bs: any = getBodyScope();
        const folderID = args.id;
        if (folderID && bs.smartFolderMappings[folderID]) {
          res.writeHead(302, { 'Location': `eagle://smart-folder/${folderID}` });
          res.end();
        }
        else {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Smart Folder does not exist.' }));
        }
      });
    });

    // V2 API
    w.require(w.appRoot + '/app/js/api-server-v2').initAPIServerV2(APIServer);

  }
  catch (err) {
    console.error(err);
  }
}

// ── APPEND:c10b-9 ──

/* 接装（if-absent）：bundle 在世时 window.initAPIServer 为 bundle 版（其调用点 23354 走
   bundle 版）；b1 后由本实现供给。libraryDomain 909 的调用点两个世界都覆盖。 */
export function installInitAPIServer(): void {
  const w = window as any;
  if (!w.initAPIServer) {
    w.initAPIServer = machineryInitAPIServer;
  }

  // 诊断契约：fns = 34 个处理器直调面（仅诊断/测试用，不替换任何运行路径——bundle 在世时
  // 其 initAPIServer 仍是唯一装配者）
  (window as any).__eagleApiServerDomain = {
    ...(window as any).__eagleApiServerDomain,
    installed: true,
    version: 2,
    port: 41595,
    initAPIServer: (w.initAPIServer === machineryInitAPIServer) ? 'machinery' : 'bundle',
    fns: {
      getAPIFolders: machineryGetAPIFolders,
      unlockFolder: machineryUnlockFolder,
      getAPIMetadataInfo: machineryGetAPIMetadataInfo,
      getLibraryHistory: machineryGetLibraryHistory,
      getAPIApplicationInfo: machineryGetAPIApplicationInfo,
      getAllTags: machineryGetAllTags,
      getTags: machineryGetTags,
      getRecentTags: machineryGetRecentTags,
      getTagGroups: machineryGetTagGroups,
      getRecentFolders: machineryGetRecentFoldersAPI,
      createFolder: machineryCreateFolder,
      renameFolder: machineryRenameFolder,
      updateFolder: machineryUpdateFolder,
      addItemFromPath: machineryAddItemFromPath,
      addItemFromPaths: machineryAddItemFromPaths,
      moveItemsToTrash: machineryMoveItemsToTrash,
      addItemFromURL: machineryAddItemFromURL,
      addItemFromURLs: machineryAddItemFromURLs,
      updateItem: machineryUpdateItem,
      getItemInfo: machineryGetItemInfo,
      getItemThumb: machineryGetItemThumb,
      listImages: machineryListImages,
    },
  };
}
