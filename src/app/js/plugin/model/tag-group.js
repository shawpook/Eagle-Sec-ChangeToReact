const { ipcRenderer } = require("electron");

class TagGroupColor {
    static get RED() { return 'red'; }
    static get ORANGE() { return 'orange'; }
    static get YELLOW() { return 'yellow'; }
    static get GREEN() { return 'green'; }
    static get AQUA() { return 'aqua'; }
    static get BLUE() { return 'blue'; }
    static get PURPLE() { return 'purple'; }
    static get PINK() { return 'pink'; }
    
    static isValid(value) {
        if (value === undefined) { return true; }
        return [
            TagGroupColor.RED,
            TagGroupColor.ORANGE,
            TagGroupColor.YELLOW,
            TagGroupColor.GREEN,
            TagGroupColor.AQUA,
            TagGroupColor.BLUE,
            TagGroupColor.PURPLE,
            TagGroupColor.PINK
        ].includes(value);
    }
}

class TagGroup {

    #name
    #color
    #tags
    #id
    #description
    #dirty

    constructor(obj) {
        if (!obj) { throw new Error("Error processing argument at index 0"); }
        this.#name = obj?.name;
        this.#color = obj?.color;
        this.#tags = obj?.tags;
        this.#id = obj?.id;
        this.#description = obj?.description;
        this.#dirty = false;
    }

    get name () {
        return this.#name;
    }
    set name (value) {
        if (this.#name === value) { return; }
        if (typeof value !== 'string') { throw new Error("Invalid type for property 'name'"); }
        this.#name = value;
        this.#dirty = true;
    }

    get color () {
        return this.#color;
    }
    set color (value) {
        if (value === undefined) {
            this.#color = undefined;
        }
        else {
            if (!TagGroupColor.isValid(value)) { throw new Error("Invalid value for property 'color'"); }
            this.#color = value;
        }
        this.#dirty = true;
    }


    get tags () {
        return this.#tags;
    }
    set tags (value) {
        if (!Array.isArray(value)) { throw new Error("Invalid type for property 'tags'"); }
        this.#tags = value;
        this.#tags = [...new Set(this.#tags)];
        this.#dirty = true;
    }

    get id () {
        return this.#id;
    }

    get description () {
        return this.#description;
    }
    set description (value) {
        if (this.#description === value) { return; }
        if (value !== undefined && typeof value !== 'string') { throw new Error("Invalid type for property 'description'"); }
        this.#description = value;
        this.#dirty = true;
    }

    async remove() {
        return new Promise(async (resolve, reject) => {
            const data = {
                id: this.id
            };
            const result = await ipcRenderer.r2r(global?.parentID, 'tagGroup.remove', data);
            return resolve(result);
        });
    }

    async addTags(options) {
        return new Promise(async (resolve, reject) => {
            if (!options || !options.tags) {
                return reject(new Error("Invalid value for property 'tags'"));
            }
            if (!Array.isArray(options.tags)) {
                return reject(new Error("Invalid type for property 'tags'"));
            }
            if (options.tags.some(tag => typeof tag !== 'string')) {
                return reject(new Error("Invalid value for property 'tags'"));
            }

            const data = {
                groupId: this.id,
                tags: [...new Set(options.tags)],
                removeFromSource: options.removeFromSource ?? false
            };

            const result = await ipcRenderer.r2r(global?.parentID, 'tagGroup.addTags', data);
            if (!result) {
                return reject(new Error("Tag group not found"));
            }
            return resolve(new TagGroup(result));
        });
    }

    async removeTags(options) {
        return new Promise(async (resolve, reject) => {
            if (!options || !options.tags) {
                return reject(new Error("Invalid value for property 'tags'"));
            }
            if (!Array.isArray(options.tags)) {
                return reject(new Error("Invalid type for property 'tags'"));
            }
            if (options.tags.some(tag => typeof tag !== 'string')) {
                return reject(new Error("Invalid value for property 'tags'"));
            }

            const data = {
                groupId: this.id,
                tags: [...new Set(options.tags)]
            };

            const result = await ipcRenderer.r2r(global?.parentID, 'tagGroup.removeTags', data);
            if (!result) {
                return reject(new Error("Tag group not found"));
            }
            return resolve(new TagGroup(result));
        });
    }

    async save() {
        return new Promise(async (resolve, reject) => {
            let data = {
                id: this.id,
                name: this.#name,
                color: this.#color,
                tags: this.#tags,
                description: this.#description
            };

            eagle.log.info(`Save tagGroup`);
            eagle.log.info(data);

            const result = await ipcRenderer.r2r(global?.parentID, 'tagGroup.save', data);
            this.#dirty = false;
            return resolve(new TagGroup(result));
        });
    }

    static async create (options) {
        return new Promise(async (resolve, reject) => {

            const data = {
                name: options.name ?? "Untitled",
                color: options.color ?? undefined,
                tags: options.tags ?? [],
                description: options.description ?? undefined
            };

            if (!data.name) { throw new Error("Invalid value for property 'name'"); }
            if (!TagGroupColor.isValid(data.color)) { throw new Error("Invalid value for property 'color'"); }
            if (!Array.isArray(data.tags)) { throw new Error("Invalid value for property 'tags'"); }
            if (data.tags.some(tag => typeof tag !== 'string')) { throw new Error("Invalid value for property 'tags'"); }
            if (data.description !== undefined && typeof data.description !== 'string') { throw new Error("Invalid value for property 'description'"); }
            data.tags = [...new Set(data.tags)];

            const result = await ipcRenderer.r2r(global?.parentID, 'tagGroup.create', data);
            return resolve(new TagGroup(result));
        });
    }

    static async get (options) {
        return new Promise(async (resolve, reject) => {
            const result = await ipcRenderer.r2r(global?.parentID, 'tagGroup.get', options);
            result.forEach((item, index) => {
                result[index] = new TagGroup(item);
            });
            return resolve(result);
        });
    }
}

module.exports = TagGroup;