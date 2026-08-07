const { ipcRenderer } = require("electron")

class Folder {
    #id
    #name
    #description
    #icon
    #iconColor
    #createdAt
    #children
    #parent
    #dirty

    static #Colors = ['red', 'orange', 'yellow', 'green', 'aqua', 'blue', 'purple', 'pink']
    
    static IconColor = Object.freeze({
        Red: 'red',
        Orange: 'orange', 
        Yellow: 'yellow',
        Green: 'green',
        Aqua: 'aqua',
        Blue: 'blue',
        Purple: 'purple',
        Pink: 'pink'
    })

    constructor(obj) {
        if (!obj) { throw new Error("Error processing argument at index 0"); }
        this.#id = obj?.id;
        this.#name = obj?.name;
        this.#children = [];
        this.#description = obj?.description;
        this.#iconColor = obj?.iconColor;
        this.#icon = obj?.icon;
        this.#createdAt = obj?.modificationTime;
        this.#parent = obj?.parent ?? null;
        // this.#tags = obj?.tags;
        this.#dirty = false;
        if (obj.children && obj.children.length > 0) {
            this.#children = Folder.convert(obj.children);
        }
    }

    // 保存修改
    async save() {
        return new Promise(async (resolve, reject) => {
            console.log(this);
            const obj = {
                id: this.id,
                name: this.name,
                description: this.description,
                iconColor: this.iconColor,
            };

            if (this.parent) {
                obj.parent = this.parent;
            }

            let result = await ipcRenderer.r2r(global?.parentID, 'folder.save', obj);
            // TODO: 要有日誌
            if (result && result.id) {
                this.#dirty = false;
                return resolve(new Folder(result));
            }
            else {
                return reject(result);
            }
        });
    }

    // 🚧
    // 設定封面
    async setCover(item) {
        // TODO: 要有日誌
    }

    async open() {
        await Folder.open(this.id);
    }

    get id() { return this.#id; }

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

    get description() { return this.#description; }
    set description(newDescription) {
        if (typeof newDescription === 'string') {
            this.#description = newDescription;
            this.#dirty = true;
        }
        else {
            throw new Error("value must be a string.");
        }
    }

    get parent() { return this.#parent; }
    set parent(newParentId) {
        if (newParentId === this.#id) {
            throw new Error("A folder cannot be its own parent.");
        }
        this.#parent = newParentId;
        this.#dirty = true;
    }

    get icon() { return this.#icon; }

    get iconColor() { return this.#iconColor; }
    set iconColor(newIconColor) {
        if (newIconColor === null || newIconColor === undefined || newIconColor === '') {
            this.#iconColor = newIconColor;
            this.#dirty = true;
        }
        else if (typeof newIconColor === 'string' && Folder.#Colors.includes(newIconColor)) {
            this.#iconColor = newIconColor;
            this.#dirty = true;
        }
        else {
            throw new Error(`Invalid iconColor. Allowed values: ${Folder.#Colors.join(', ')} or empty.`);
        }
    }

    get createdAt() { return this.#createdAt; }

    get children() { return this.#children; }

    // get tags() { return this.#tags; }

    static async create (options) {
        return new Promise(async (resolve, reject) => {
            // TODO: 要有日誌
            let result = await ipcRenderer.r2r(global?.parentID, 'folder.create', options);
            if (result) {
                return resolve(new Folder(result));
            }
            return resolve(result);
        });
    }

    static async createSubfolder (parentId, options) {
        options.parent = parentId;
        return (await eagle.folder.create(options) )
    }

    static async get (options) {
        return new Promise(async (resolve, reject) => {
            let result = await ipcRenderer.r2r(global?.parentID, 'folder.get', options);
            return resolve(Folder.convert(result));
        });
    }

    static async getAll () { return (await eagle.folder.get()); }

    static async getById (id) { return (await eagle.folder.get({id: id}))[0];  }
    
    static async getByIds (ids) { return (await eagle.folder.get({ids: ids})); }

    static async getSelected () { return (await eagle.folder.get({ isSelected: true })); }

    static async getRecents () { return (await eagle.folder.get({ isRecent: true })); }
    
    static async open (folderId) {
        return new Promise(async (resolve, reject) => {
            let result = await ipcRenderer.r2r(global?.parentID, 'folder.open', { folderId: folderId });
            return resolve(result);
        });
    }

    static convert(objs) {
        try {
            let folders = [];
            objs.forEach(obj => {
                folders.push(new Folder(obj));
            });
            return folders;
        } catch (err) {
            return [];
        }
    }
}

module.exports = Folder;