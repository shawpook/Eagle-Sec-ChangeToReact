const { ipcRenderer } = require("electron")

class Tag {

    #name
    #originalName
    #groups
    #color
    #count
    #pinyin
    #dirty

    constructor(obj) {
        if (!obj) { throw new Error("Error processing argument at index 0"); }
        this.#name = obj?.name;
        this.#originalName = obj?.name;
        this.#groups = obj?.groups || [];
        this.#color = obj?.color;
        this.#count = obj?.imageCount;
        this.#pinyin = obj?.pinyin;
        this.#dirty = false;
    }

    get name() {
        return this.#name;
    }
    set name(value) {
        if (this.#name === value) { return; }
        if (typeof value !== 'string') { throw new Error("Invalid type for property 'name'"); }
        this.#name = value;
        this.#dirty = true;
    }

    get groups() {
        return this.#groups;
    }

    get color() {
        return this.#color;
    }

    get count() {
        return this.#count;
    }

    get pinyin() {
        return this.#pinyin;
    }

    async save() {
        return new Promise(async (resolve, reject) => {
            if (!this.#dirty) {
                return resolve(this);
            }
            
            // 只支援修改名稱
            if (this.#name === this.#originalName) {
                this.#dirty = false;
                return resolve(this);
            }
            
            let data = {
                originalName: this.#originalName,
                name: this.#name
            };

            try {
                const result = await ipcRenderer.r2r(global?.parentID, 'tag.save', data);

                if (!result) {
                    this.#dirty = true;
                    return reject(new Error("Error saving tag"));
                }

                // 成功時更新原始值
                this.#originalName = this.#name;
                this.#dirty = false;
                return resolve(new Tag(result));
            } catch (error) {
                return reject(error);
            }
        });
    }

    static async get (options) {
        return new Promise(async (resolve, reject) => {
            const result = await ipcRenderer.r2r(global?.parentID, 'tag.get', options);
            result.forEach((item, index) => {
                result[index] = new Tag(item);
            });
            return resolve(result);
        });
    }

    static async getRecentTags () {
        return new Promise(async (resolve, reject) => {
            const result = await ipcRenderer.r2r(global?.parentID, 'tag.getRecentTags');
            result.forEach((item, index) => {
                result[index] = new Tag(item);
            });
            return resolve(result);
        });
    }

    static async getStarredTags () {
        return new Promise(async (resolve, reject) => {
            const result = await ipcRenderer.r2r(global?.parentID, 'tag.getStarredTags');
            result.forEach((item, index) => {
                result[index] = new Tag(item);
            });
            return resolve(result);
        });
    }

    static async merge(options) {
        return new Promise(async (resolve, reject) => {
            if (!options) {
                return reject(new Error("Options are required"));
            }
            if (typeof options.source !== 'string' || !options.source.trim()) {
                return reject(new Error("Source tag name is required"));
            }
            if (typeof options.target !== 'string' || !options.target.trim()) {
                return reject(new Error("Target tag name is required"));
            }
            if (options.source.trim() === options.target.trim()) {
                return reject(new Error("Source and target tags cannot be the same"));
            }

            const data = {
                source: options.source.trim(),
                target: options.target.trim()
            };

            try {
                const result = await ipcRenderer.r2r(global?.parentID, 'tag.merge', data);
                if (!result) {
                    return reject(new Error("Source tag not found"));
                }
                return resolve(result);
            } catch (error) {
                return reject(error);
            }
        });
    }
}

module.exports = Tag;