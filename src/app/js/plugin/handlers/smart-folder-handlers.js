const { registerHandler, bridgeIPC } = require('../handlers');
const { validateConditions, getSerializableRules } = require('./smart-folder-rules');
const MAX_STRING_LENGTH = 10000;

function initSmartFolderHandlers() {

	// ─── smartFolder.create ───────────────────────────────────────
	registerHandler('smartFolder.create', async (data) => {
		if (!data?.name || typeof data.name !== 'string') {
			throw new Error('name is required');
		}
		if (data.name.length > MAX_STRING_LENGTH) {
			throw new Error('name too long (max 10000)');
		}
		if (!data?.conditions) {
			throw new Error('conditions is required');
		}
		validateConditions(data.conditions);

		if (typeof data?.description === 'string' && data.description.length > MAX_STRING_LENGTH) {
			throw new Error('description too long (max 10000)');
		}

		var sf = {
			id: guid(),
			name: data.name,
			conditions: data.conditions,
			description: data.description || "",
			icon: data.icon || "",
			iconColor: data.iconColor || "",
			children: [],
			modificationTime: Date.now(),
		};

		if (typeof data?.parent === 'string' && data.parent) {
			let parentSf = $bodyScope.smartFolderMappings[data.parent];
			if (!parentSf) {
				throw new Error('parent smart folder not found: ' + data.parent);
			}
			if (!parentSf.children) {
				parentSf.children = [];
			}
			parentSf.children.push(sf);
		} else {
			$bodyScope.smartFolders.push(sf);
		}

		sf.imageCount = $bodyScope.smartFolderCount(sf);
		$bodyScope.smartFolderMappings[sf.id] = sf;
		$bodyScope.updateSidebarList();
		$bodyScope.saveFolder();

		return sf;
	});

	bridgeIPC('smartFolder.create', (err) => ({ error: err.message }));

	// ─── smartFolder.update ───────────────────────────────────────
	registerHandler('smartFolder.update', async (data) => {
		if (!data?.id || typeof data.id !== 'string') {
			throw new Error('id is required');
		}

		let sf = $bodyScope.smartFolderMappings[data.id];
		if (!sf) {
			throw new Error('smart folder not found: ' + data.id);
		}

		if (typeof data?.name === 'string') {
			if (data.name.length === 0) throw new Error('name cannot be empty');
			if (data.name.length > MAX_STRING_LENGTH) throw new Error('name too long (max 10000)');
			sf.name = data.name;
		}

		if (data?.conditions !== undefined) {
			validateConditions(data.conditions);
			sf.conditions = data.conditions;
		}

		if (typeof data?.description === 'string') {
			if (data.description.length > MAX_STRING_LENGTH) throw new Error('description too long (max 10000)');
			sf.description = data.description;
		}

		if (data?.icon !== undefined) {
			sf.icon = data.icon;
		}

		if (data?.iconColor !== undefined) {
			sf.iconColor = data.iconColor;
		}

		sf.modificationTime = Date.now();

		// Recalculate imageCount for this smart folder and its children
		sf.imageCount = $bodyScope.smartFolderCount(sf);
		if (sf.children && sf.children.length > 0) {
			eagle.utils.tree.walk(sf.children, 'children', function (child) {
				child.imageCount = $bodyScope.smartFolderCount(child);
			});
		}

		$bodyScope.updateSidebarList();
		$bodyScope.saveFolder();

		return sf;
	});

	bridgeIPC('smartFolder.update', (err) => ({ error: err.message }));

	// ─── smartFolder.remove ───────────────────────────────────────
	registerHandler('smartFolder.remove', async (data) => {
		if (!data?.id || typeof data.id !== 'string') {
			throw new Error('id is required');
		}

		let sf = $bodyScope.smartFolderMappings[data.id];
		if (!sf) {
			throw new Error('smart folder not found: ' + data.id);
		}

		// Find the parent children array that contains this smart folder
		let parentChildren = null;
		let found = false;

		// Check top-level smartFolders
		let idx = $bodyScope.smartFolders.indexOf(sf);
		if (idx !== -1) {
			parentChildren = $bodyScope.smartFolders;
			found = true;
		}

		// If not found at top level, search in nested children
		if (!found) {
			eagle.utils.tree.walk($bodyScope.smartFolders, 'children', function (item) {
				if (item.children) {
					let childIdx = item.children.indexOf(sf);
					if (childIdx !== -1) {
						parentChildren = item.children;
						found = true;
					}
				}
			});
		}

		if (parentChildren) {
			let spliceIdx = parentChildren.indexOf(sf);
			if (spliceIdx !== -1) {
				parentChildren.splice(spliceIdx, 1);
			}
		}

		// Remove from mappings and QuickAccess
		delete $bodyScope.smartFolderMappings[data.id];
		QuickAccessManager.remove("smartFolder", sf);

		// Recursively clean up children mappings
		if (sf.children && sf.children.length > 0) {
			eagle.utils.tree.walk(sf.children, 'children', function (child) {
				delete $bodyScope.smartFolderMappings[child.id];
				QuickAccessManager.remove("smartFolder", child);
			});
		}

		$bodyScope.updateSidebarList();
		$bodyScope.saveFolderDebounce();

		return true;
	});

	bridgeIPC('smartFolder.remove', (err) => ({ error: err.message }));

	// ─── smartFolder.get ──────────────────────────────────────────
	registerHandler('smartFolder.get', async (data) => {
		// No params: return full tree
		if (!data?.id && !Array.isArray(data?.ids)) {
			let result = $bodyScope.smartFolders || [];
			// Attach imageCount to each
			eagle.utils.tree.walk(result, 'children', function (sf) {
				sf.imageCount = $bodyScope.smartFolderCount(sf);
			});
			return result;
		}

		// Flatten tree for filtering
		let all = [];
		eagle.utils.tree.walk($bodyScope.smartFolders, 'children', function (sf) {
			all.push(sf);
		});

		let filtered;
		if (typeof data?.id === 'string') {
			filtered = all.filter(sf => sf.id === data.id);
		} else if (Array.isArray(data?.ids)) {
			let idsMap = {};
			data.ids.forEach(id => { idsMap[id] = true; });
			filtered = all.filter(sf => idsMap[sf.id]);
		}

		// Attach imageCount
		filtered.forEach(sf => {
			sf.imageCount = $bodyScope.smartFolderCount(sf);
		});

		return filtered;
	});

	bridgeIPC('smartFolder.get', []);

	// ─── smartFolder.getItems ─────────────────────────────────────
	registerHandler('smartFolder.getItems', async (data) => {
		if (!data?.smartFolderId || typeof data.smartFolderId !== 'string') {
			throw new Error('smartFolderId is required');
		}

		let sf = $bodyScope.smartFolderMappings[data.smartFolderId];
		if (!sf) {
			throw new Error('smart folder not found: ' + data.smartFolderId);
		}

		let items = $bodyScope.raw.filter(function (item) {
			if (item?.isDeleted) return false;
			return $bodyScope.existInSmartFilter(sf, item);
		});

		// Sort
		if (data?.orderBy) {
			items = $bodyScope.sortData(items, data.orderBy);
		}

		// Field projection
		if (Array.isArray(data?.fields)) {
			items = items.map(function (item) {
				let newItem = {};
				data.fields.forEach(function (field) {
					newItem[field] = item[field];
				});
				return newItem;
			});
		}

		return items;
	});

	bridgeIPC('smartFolder.getItems', []);

	// ─── smartFolder.getRules ────────────────────────────────────
	registerHandler('smartFolder.getRules', async () => {
		return getSerializableRules();
	});

	bridgeIPC('smartFolder.getRules', {});
}

module.exports = { initSmartFolderHandlers };
