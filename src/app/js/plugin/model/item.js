const { ipcRenderer } = require("electron")
const path = require('path');
const url = require('url');

class Item {
    #id
    #name
    #ext
    #width
    #height
    #url
    #isDeleted
    #annotation
    #tags
    #folders
    #palettes
    #size
    #star
    #importedAt
    #modifiedAt
    #noThumbnail
    #noPreview
    #comments
    #dirty

    constructor(obj) {
        this.#id = obj.id;
        this.#name = obj.name;
        this.#ext = obj.ext;
        this.#width = obj.width;
        this.#height = obj.height;
        this.#url = obj.url;
        this.#isDeleted = obj.isDeleted;
        this.#annotation = obj.annotation;
        this.#tags = obj.tags;
        this.#folders = obj.folders;
        this.#palettes = obj.palettes;
        this.#size = obj.size;
        this.#star = obj.star;
        this.#importedAt = obj.modificationTime;
        this.#modifiedAt = obj.lastModified;
        this.#noThumbnail = !!obj.noThumbnail;
        this.#noPreview = !!obj.noPreview;
        this.#comments = obj.comments || [];
        this.#dirty = false;
    }

    setDirty(dirty = true) {
        this.#dirty = dirty;
    }

    async setCustomThumbnail(filePath, options) {
        return new Promise(async (resolve, reject) => {
            const fs = require('fs');
            if (!fs.existsSync(filePath)) {
                return reject(new Error(`File does not exists: ${filePath}`));
            }
            let params = {
                itemId: this.id,
                filePath: filePath
            };
            if (options && options.width) params.width = options.width;
            if (options && options.height) params.height = options.height;
            let result = await ipcRenderer.r2r(global?.parentID, 'item.setCustomThumbnail', params);
            return resolve(result);
        });
    }

    async replaceFile(replaceFilePath) {
        return new Promise(async (resolve, reject) => {

            const fs = require('fs');
            const path = require('path');
            const newExt = path.parse(replaceFilePath).ext.split(".")[1];
            let originFilePath = this.filePath;
            let changeExt = false;

            if (newExt && newExt !== this.ext) {
                this.ext = newExt;
                changeExt = true;
            }

            let tmpPath = path.normalize(`${originFilePath}.tmp`);
            let newFilePath = this.filePath;

            try {
                eagle.log.info(`Replace item file: ${replaceFilePath} > ${originFilePath}`);

                if (!fs.existsSync(replaceFilePath)) {
                    throw Error(`File does not exists: ${replaceFilePath}`);
                }
                
                if (fs.existsSync(tmpPath)) {
                    await fs.promises.unlink(tmpPath);
                }

                await fs.promises.rename(originFilePath, tmpPath);

                await fs.promises.copyFile(replaceFilePath, newFilePath);

                if (!fs.existsSync(newFilePath) || fs.statSync(newFilePath).size === 0) {
                    throw Error(`File does not exists: ${newFilePath}`);
                }

                // update the file extension
                if (changeExt) {
                    await this.save();
                }

                // remove the backup
                try { await fs.promises.unlink(tmpPath); } catch (err) { }
            }
            catch (err) {
                // restore the file
                if (fs.existsSync(tmpPath)) {
                    await fs.promises.rename(tmpPath, originFilePath);
                }
                reject(err)
                eagle.log.error(err);
                return;
            }
            // refresh the thumbnail
            await this.refreshThumbnail();
            eagle.log.info(`Replace item file success.`);
            return resolve();
        });
    }

    async refreshThumbnail() {
        return new Promise(async (resolve, reject) => {

            eagle.log.info(`Refresh item thumbnail: ${this.name}(${this.id})`);

            const waitForThumbnail = async (id) => {
                return new Promise((rv, reject) => {
                    let successChannel = `file-thumbnail-success-${id}`;
                    let success = (event, params) => {
                        rv(true);
                    };
                    ipcRenderer.once(successChannel, success);
                });
            }
            
            waitForThumbnail(this.id).then(async (a) => {
                return resolve(true);
            });

            await ipcRenderer.r2r(global?.parentID, 'item.refreshThumbnail', {
                itemId: this.id
            });
        });
    }

    async save() {
        return new Promise(async (resolve, reject) => {

            const waitForSave = async (id) => {
                return new Promise((resolve, reject) => {

                    let successChannel = `file-save-success-${id}`;
                    let failChannel = `file-save-fail-${id}`;
                    let success = (event, params) => {
                        ipcRenderer.removeAllListeners(failChannel);
                        resolve(true);
                    };
                    let fail = (event, params) => {
                        ipcRenderer.removeAllListeners(successChannel);
                        reject(false);
                    };

                    ipcRenderer.once(successChannel, success);
                    ipcRenderer.once(failChannel, fail);
                });
            }
            
            let data = {
                id: this.id,
                name: this.name,
                annotation: this.#annotation,
                url: this.#url,
                height: this.#height,
                width: this.#width,
                tags: this.#tags,
                folders: this.#folders,
                star: this.#star,
                ext: this.#ext,
                isDeleted: this.#isDeleted,
                modificationTime: this.#importedAt,
            };
            eagle.log.info(`Save item`);
            eagle.log.info(data);
            waitForSave(this.id).then(async (a) => {
                return resolve(true);
            }, () => {
                return reject(false);
            })
            await ipcRenderer.r2r(global?.parentID, 'item.save', data);
        });
    }

    async open(options) {
        await Item.open(this.id, options);
    }

    async select() {
        await Item.select([this.id]);
    }

    async moveToTrash() {
        if (this.isDeleted) {
            return;
        }
        this.isDeleted = true;
        await this.save();
    }

    // 所有 setter 都要防呆、類型要一樣、不能為空值等
    get id() { return this.#id; }
    // set id(newId) { this.#id = newId; }

    get name() { return this.#name; }
    set name(newName) {
        if (typeof newName === 'string' && newName.length > 0) {
            this.#name = newName;
            this.#dirty = true;
        }
        else {
            throw new Error("value must be a string.");
        }
    }

    get ext() { return this.#ext; }
    set ext(newExt) {
        if (typeof newExt === 'string' && newExt.length > 0) {
            this.#ext = newExt;
            this.#dirty = true;
        }
        else {
            throw new Error("value must be a string.");
        }
    }

    get width() { return this.#width; }
    set width(newWidth) { 
        if (typeof newWidth === 'number') {
            this.#width = newWidth; 
            this.#dirty = true;
        }
        else {
            throw new Error("value must be numeric.");
        }
    }

    get height() { return this.#height; }
    set height(newHeight) { 
        if (typeof newHeight === 'number') {
            this.#height = newHeight;
            this.#dirty = true;
        }
        else {
            throw new Error("value must be numeric.");
        }
    }

    get url() { return this.#url; }
    set url(newURL) {
        if (
            newURL === '' ||
            typeof newURL === 'string' && newURL.match(/[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)?/)
        ) {
            this.#url = newURL;
            this.#dirty = true;
        }
        else {
            throw new Error("value must be a URL or a empty string.");
        }
    }

    get isDeleted() { return this.#isDeleted; }
    set isDeleted(bool) { 
        if (typeof bool === 'boolean') {
            this.#isDeleted = bool;
            this.#dirty = true;
        }
        else {
            throw new Error("value must be a boolean.");
        }
    }

    get annotation() { return this.#annotation; }
    set annotation(newAnnotation) {
        if (typeof newAnnotation === 'string') {
            this.#annotation = newAnnotation;
            this.#dirty = true;
        }
        else {
            throw new Error("value must be a string.");
        }
    }


    get tags() { return this.#tags; }
    set tags(newTags) {
        if (Array.isArray(newTags)) {
            this.#tags = newTags;
            this.#dirty = true;
        }
    }

    get folders() { return this.#folders; }
    set folders(folderIds) {
        if (Array.isArray(folderIds)) {
            this.#folders = folderIds;
            this.#dirty = true;
        }
    }

    get palettes() { return this.#palettes; }

    get size() { return this.#size; }

    get star() { return this.#star; }
    set star(newStar) { 
        if (typeof newStar === 'number' && newStar >= 0 && newStar <= 5) {
            this.#star = newStar;
            this.#dirty = true;
        }
        else {
            throw new Error("value must be numeric & >= 0 && <= 5");
        }
    }

    get importedAt() { return this.#importedAt; }
    set importedAt(time) {
        if (Number.isInteger(time) && time > 0) {
            this.#importedAt = time;
            this.#dirty = true;
        }
    }

    get modifiedAt() { return this.#modifiedAt; }

    get noThumbnail() { return this.#noThumbnail; }
    // set noThumbnail(bool) { 
    //     if (typeof bool === 'boolean') {
    //         this.#noThumbnail = bool;
    //         this.#dirty = true;
    //     }
    //     else {
    //         throw new Error("value must be a boolean.");
    //     }
    // }

    get comments() { return this.#comments; }

    async addComment(commentData) {
        let result = await ipcRenderer.r2r(global?.parentID, 'item.addComment', {
            id: this.id,
            ...commentData,
        });
        if (result) this.#comments = (await ipcRenderer.r2r(global?.parentID, 'item.getComments', { id: this.id })) || [];
        return result;
    }

    async updateComment(commentId, updateData) {
        let result = await ipcRenderer.r2r(global?.parentID, 'item.updateComment', {
            id: this.id,
            commentId: commentId,
            ...updateData,
        });
        if (result) this.#comments = (await ipcRenderer.r2r(global?.parentID, 'item.getComments', { id: this.id })) || [];
        return result;
    }

    async removeComment(commentId) {
        let result = await ipcRenderer.r2r(global?.parentID, 'item.removeComment', {
            id: this.id,
            commentId: commentId,
        });
        if (result) this.#comments = (await ipcRenderer.r2r(global?.parentID, 'item.getComments', { id: this.id })) || [];
        return result;
    }

    get noPreview() { return this.#noPreview; }
    // set noPreview(bool) {
    //     if (typeof bool === 'boolean') {
    //         this.#noPreview = bool;
    //         this.#dirty = true;
    //     }
    //     else {
    //         throw new Error("value must be a boolean.");
    //     }
    // }

    get filePath() {
        return path.normalize(`${eagle.library.path}/images/${this.id}.info/${this.name}.${this.ext}`);
    }

    get fileURL() {
        return url.pathToFileURL(this.filePath).href;
    }

    get thumbnailPath() {
        if (this.noThumbnail) {
            return this.filePath;
        }
        else {
            return path.normalize(`${eagle.library.path}/images/${this.id}.info/${this.name}_thumbnail.png`);
        }
    }

    get thumbnailURL() {
        return url.pathToFileURL(this.thumbnailPath).href;
    }

    get metadataFilePath() {
        return path.normalize(`${eagle.library.path}/images/${this.id}.info/metadata.json`);
    }

    // ------------------------------------
    // Util methods
    // ------------------------------------
    static async count(options = {}) {
        return new Promise(async (resolve, reject) => {
            let result = await ipcRenderer.r2r(global?.parentID, 'item.get', {
                fields: [],
                ...options,
            }) || [];
            return resolve(result.length);
        });
    }

    static async countSelected() {
        return new Promise(async (resolve, reject) => {
            let count = await this.count({ isSelected: true });
            return resolve(count);
        });
    }

    static async countAll() {
        return new Promise(async (resolve, reject) => {
            let count = await ipcRenderer.r2r(global?.parentID, 'item.countAll') || 0;
            return resolve(count);
        });
    }

    static async get(options = {}) {
        return new Promise(async (resolve, reject) => {
            let result = await ipcRenderer.r2r(global?.parentID, 'item.get', options);
            return resolve(Item.convert(result));
        });
    }

    static async query(options) {
        // options.query
        return new Promise(async (resolve, reject) => {
            let result = await ipcRenderer.r2r(global?.parentID, 'item.query', options);
            return resolve(Item.convert(result));
        });
    }

    static async getAll () {
        return (await eagle.item.get());
    }

    static async getIdsWithModifiedAt () {
        let result = await ipcRenderer.r2r(global?.parentID, 'item.get', {
            fields: ['id', 'lastModified']
        }) || [];
        return result.map((item) => {
            return {
                id: item.id,
                modifiedAt: item.lastModified
            };
        });
    }

    static async getById (id) {
        return (await eagle.item.get({ id: id }))[0];
    }

    static async getByIds (ids) {
        return (await eagle.item.get({ ids: ids }));
    }

    static async getSelected () {
        return (await eagle.item.get({ isSelected: true }));
    }

    static #formatName(str) {
        if (!str || typeof str !== 'string') return str;
        
        // 只處理 HTML 實體，不處理標籤
        return str.replace(/&[#\w\d]+;/g, (entity) => {
            try {
                const textarea = document.createElement('textarea');
                textarea.innerHTML = entity;
                return textarea.value;
            } catch (e) {
                return entity; // 解碼失敗時保持原樣
            }
        });
    }

    static async #waitForAdded(id) {
        return new Promise((resolve, reject) => {

            let successChannel = `file-add-success-${id}`;
            let failChannel = `file-add-fail-${id}`;
            let success = (event, params) => {
                ipcRenderer.removeAllListeners(failChannel);
                resolve(id);
            };
            let fail = (event, params) => {
                ipcRenderer.removeAllListeners(successChannel);
                reject(false);
            };

            ipcRenderer.once(successChannel, success);
            ipcRenderer.once(failChannel, fail);
        });
    }

    static async #add(options) {
        return new Promise(async (resolve, reject) => {

            const { path, url, base64, name, website, annotation, tags, folders, bookmarkURL } = options;
            const itemId = eagle.guid();

            let result = await ipcRenderer.r2r(global?.parentID, 'item.add', {
                id: itemId,
                path: path,
                url: url,
                bookmarkURL: bookmarkURL,
                base64: base64,
                name: this.#formatName(name) || itemId,
                website: website || "",
                annotation: annotation || "",
                tags: tags || [],  
                folders: folders || [],
            });

            if (!result) {
                return reject(false);
            }
            this.#waitForAdded(itemId).then(async (itemId) => {
                resolve(itemId);
            }, () => {
                reject(false);
            })
        });
    }

    static async addFromBase64(base64, options = {}) {
        options.base64 = base64;
        return (await this.#add(options));
    }

    static async addFromURL(url, options = {}) {
        options.url = url;
        return (await this.#add(options));
    }

    static async addFromPath(path, options = {}) {
        options.path = path;
        return (await this.#add(options));
    }

    static async addBookmark(bookmarkURL, options = {}) {
        options.bookmarkURL = bookmarkURL;
        options.website = bookmarkURL;
        return (await this.#add(options));
    }

    /**
     * 批量添加項目（支援混合 path / url / bookmarkURL / base64）
     * @param {Array<Object>} items - 每項可含 path, url, base64, bookmarkURL, name, tags, folders 等
     * @returns {Promise<string[]>} ids
     */
    static async addItems(items) {
        let formattedItems = items.map(item => ({
            ...item,
            name: this.#formatName(item.name),
        }));
        return await ipcRenderer.r2r(global?.parentID, 'item.add', {
            items: formattedItems,
        });
    }

    static async open(itemId, options = {}) {
        return new Promise(async (resolve, reject) => {
            let result = await ipcRenderer.r2r(global?.parentID, 'item.open', { itemId: itemId, options: options });
            return resolve(result);
        });
    }

    static async select(itemIds = []) {
        return new Promise(async (resolve, reject) => {
            let result = await ipcRenderer.r2r(global?.parentID, 'item.select', { itemIds: itemIds });
            return resolve(result);
        });
    }

    static convert(objs) {
        let items = [];
        objs.forEach(obj => {
            items.push(new Item(obj));
        });
        return items;
    }
    
}

module.exports = Item;