const { ipcRenderer } = require("electron")

class Rule {
	constructor(property, method, value, extra) {
		this.property = property;
		this.method = method;
		if (value !== undefined) this.value = value;
		if (extra) {
			for (const key of Object.keys(extra)) {
				if (!['property', 'method', 'value'].includes(key)) this[key] = extra[key];
			}
		}
	}
}

class Condition {
	constructor(match, rules, boolean) {
		this.match = match || 'AND';
		this.rules = rules || [];
		if (boolean) this.boolean = boolean;
	}
	static create(match, rules, boolean) {
		return new Condition(
			match,
			rules.map(r => r instanceof Rule ? r : new Rule(r.property, r.method, r.value, r)),
			boolean
		);
	}
}

class SmartFolder {
	#id
	#name
	#conditions
	#description
	#icon
	#iconColor
	#modificationTime
	#children
	#parent
	#imageCount
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
		this.#conditions = obj?.conditions || [];
		this.#description = obj?.description;
		this.#icon = obj?.icon;
		this.#iconColor = obj?.iconColor;
		this.#modificationTime = obj?.modificationTime;
		this.#parent = obj?.parent ?? null;
		this.#imageCount = obj?.imageCount ?? 0;
		this.#children = [];
		this.#dirty = false;
		if (obj.children && obj.children.length > 0) {
			this.#children = SmartFolder.convert(obj.children);
		}
	}

	async save() {
		return new Promise(async (resolve, reject) => {
			const obj = {
				id: this.id,
				name: this.name,
				conditions: this.conditions,
				description: this.description,
				icon: this.icon,
				iconColor: this.iconColor,
			};

			let result = await ipcRenderer.r2r(global?.parentID, 'smartFolder.update', obj);
			if (result?.error) {
				return reject(new Error(result.error));
			}
			if (result && result.id) {
				this.#dirty = false;
				return resolve(new SmartFolder(result));
			} else {
				return reject(result);
			}
		});
	}

	async getItems(options) {
		return new Promise(async (resolve, reject) => {
			let data = Object.assign({}, options || {}, { smartFolderId: this.id });
			let result = await ipcRenderer.r2r(global?.parentID, 'smartFolder.getItems', data);
			return resolve(result);
		});
	}

	get id() { return this.#id; }

	get name() { return this.#name; }
	set name(newName) {
		if (typeof newName === 'string' && newName.length > 0) {
			this.#name = newName;
			this.#dirty = true;
		} else {
			throw new Error("value must be a non-empty string.");
		}
	}

	get conditions() { return this.#conditions; }
	set conditions(newConditions) {
		if (Array.isArray(newConditions)) {
			this.#conditions = newConditions;
			this.#dirty = true;
		} else {
			throw new Error("conditions must be an array.");
		}
	}

	get description() { return this.#description; }
	set description(newDescription) {
		if (typeof newDescription === 'string') {
			this.#description = newDescription;
			this.#dirty = true;
		} else {
			throw new Error("value must be a string.");
		}
	}

	get icon() { return this.#icon; }

	get iconColor() { return this.#iconColor; }
	set iconColor(newIconColor) {
		if (newIconColor === null || newIconColor === undefined || newIconColor === '') {
			this.#iconColor = newIconColor;
			this.#dirty = true;
		} else if (typeof newIconColor === 'string' && SmartFolder.#Colors.includes(newIconColor)) {
			this.#iconColor = newIconColor;
			this.#dirty = true;
		} else {
			throw new Error(`Invalid iconColor. Allowed values: ${SmartFolder.#Colors.join(', ')} or empty.`);
		}
	}

	get modificationTime() { return this.#modificationTime; }
	get children() { return this.#children; }
	get parent() { return this.#parent; }
	get imageCount() { return this.#imageCount; }

	static async create(options) {
		return new Promise(async (resolve, reject) => {
			let result = await ipcRenderer.r2r(global?.parentID, 'smartFolder.create', options);
			if (result?.error) {
				return reject(new Error(result.error));
			}
			if (result) {
				return resolve(new SmartFolder(result));
			}
			return resolve(result);
		});
	}

	static async get(options) {
		return new Promise(async (resolve, reject) => {
			let result = await ipcRenderer.r2r(global?.parentID, 'smartFolder.get', options);
			return resolve(SmartFolder.convert(result));
		});
	}

	static async getAll() { return (await eagle.smartFolder.get()); }

	static async getById(id) { return (await eagle.smartFolder.get({ id: id }))[0]; }

	static async getByIds(ids) { return (await eagle.smartFolder.get({ ids: ids })); }

	static async remove(id) {
		return new Promise(async (resolve, reject) => {
			let result = await ipcRenderer.r2r(global?.parentID, 'smartFolder.remove', { id: id });
			if (result?.error) {
				return reject(new Error(result.error));
			}
			return resolve(result);
		});
	}

	static async getRules() {
		return await ipcRenderer.r2r(global?.parentID, 'smartFolder.getRules');
	}

	static rule(property) {
		const builder = {};
		const allMethods = [
			'equal', 'startWith', 'endWith', 'contain', 'uncontain', 'empty', 'not-empty', 'regex',
			'=', '>=', '<=', '>', '<', 'between',
			'on', 'before', 'after', 'within',
			'union', 'intersection', 'identity', 'unequal',
			'similar', 'accuracy', 'grayscale',
			'activate', 'deactivate'
		];
		allMethods.forEach(m => {
			builder[m] = (value, extra) => new Rule(property, m, value, extra);
		});
		return builder;
	}

	static convert(objs) {
		try {
			let smartFolders = [];
			objs.forEach(obj => {
				smartFolders.push(new SmartFolder(obj));
			});
			return smartFolders;
		} catch (err) {
			return [];
		}
	}
}

SmartFolder.Rule = Rule;
SmartFolder.Condition = Condition;

module.exports = SmartFolder;
