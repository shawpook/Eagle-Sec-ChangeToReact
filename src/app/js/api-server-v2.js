const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 1000;

// 需要自動分頁的 handler（回傳陣列的列表型端點）
const PAGINATED_HANDLERS = {
	'item.get': true,
	'item.query': true,
	'folder.get': true,
	'tag.get': true,
	'tag.getRecentTags': true,
	'tag.getStarredTags': true,
	'tagGroup.get': true,
	'library.history': true,
	'smartFolder.get': true,
	'smartFolder.getItems': true,
};

/**
 * 對陣列結果套用分頁
 * @param {Array} items - handler 回傳的完整陣列
 * @param {object} args - 請求參數（含 offset / limit）
 * @returns {{ data: Array, total: number, offset: number, limit: number }}
 */
function paginate(items, args) {
	const total = items.length;
	const offset = Math.max(0, parseInt(args?.offset) || 0);
	const rawLimit = parseInt(args?.limit);
	// 有明確給 limit 就用，否則走預設；上限 MAX_LIMIT
	const limit = Math.min(
		MAX_LIMIT,
		(Number.isFinite(rawLimit) && rawLimit > 0) ? rawLimit : DEFAULT_LIMIT
	);

	const paged = items.slice(offset, offset + limit);

	return {
		data: paged,
		total: total,
		offset: offset,
		limit: limit,
	};
}

function initAPIServerV2(APIServer) {
	const { callHandler } = require('./plugin/handlers');

	// V2 路由定義表：URL 與 Plugin API handler 名稱一致
	const routes = [
		// Item
		['GET', '/api/v2/item/get', 'item.get'],
		['POST', '/api/v2/item/get', 'item.get'],
		['POST', '/api/v2/item/query', 'item.query'],
		['GET', '/api/v2/item/countAll', 'item.countAll'],
		['POST', '/api/v2/item/add', 'item.add'],
		['POST', '/api/v2/item/update', 'item.save'],
		['POST', '/api/v2/item/setCustomThumbnail', 'item.setCustomThumbnail'],
		['POST', '/api/v2/item/refreshThumbnail', 'item.refreshThumbnail'],
		['GET',  '/api/v2/item/getComments',   'item.getComments'],
		['POST', '/api/v2/item/addComment',    'item.addComment'],
		['POST', '/api/v2/item/updateComment', 'item.updateComment'],
		['POST', '/api/v2/item/removeComment', 'item.removeComment'],

		// Folder
		['GET', '/api/v2/folder/get', 'folder.get'],
		['POST', '/api/v2/folder/get', 'folder.get'],
		['POST', '/api/v2/folder/create', 'folder.create'],
		['POST', '/api/v2/folder/update', 'folder.save'],

		// Smart Folder
		['GET',  '/api/v2/smartFolder/get',      'smartFolder.get'],
		['POST', '/api/v2/smartFolder/get',      'smartFolder.get'],
		['POST', '/api/v2/smartFolder/create',   'smartFolder.create'],
		['POST', '/api/v2/smartFolder/update',   'smartFolder.update'],
		['POST', '/api/v2/smartFolder/remove',   'smartFolder.remove'],
		['GET',  '/api/v2/smartFolder/getItems', 'smartFolder.getItems'],
		['POST', '/api/v2/smartFolder/getItems', 'smartFolder.getItems'],
		['GET',  '/api/v2/smartFolder/getRules', 'smartFolder.getRules'],

		// Tag
		['GET', '/api/v2/tag/get', 'tag.get'],
		['POST', '/api/v2/tag/get', 'tag.get'],
		['GET', '/api/v2/tag/getRecentTags', 'tag.getRecentTags'],
		['GET', '/api/v2/tag/getStarredTags', 'tag.getStarredTags'],
		['POST', '/api/v2/tag/update', 'tag.save'],
		['POST', '/api/v2/tag/merge', 'tag.merge'],

		// TagGroup
		['GET', '/api/v2/tagGroup/get', 'tagGroup.get'],
		['POST', '/api/v2/tagGroup/create', 'tagGroup.create'],
		['POST', '/api/v2/tagGroup/update', 'tagGroup.save'],
		['POST', '/api/v2/tagGroup/remove', 'tagGroup.remove'],
		['POST', '/api/v2/tagGroup/addTags', 'tagGroup.addTags'],
		['POST', '/api/v2/tagGroup/removeTags', 'tagGroup.removeTags'],

		// Library
		['GET', '/api/v2/library/info', 'library.info'],
		['GET', '/api/v2/library/history', 'library.history'],
		['POST', '/api/v2/library/switch', 'library.switch'],
		['GET', '/api/v2/library/icon', 'library.icon'],

		// App
		['GET', '/api/v2/app/info', 'app.info'],

		// AI Search
		['GET', '/api/v2/aiSearch/isInstalled', 'aiSearch.isInstalled'],
		['GET', '/api/v2/aiSearch/isReady', 'aiSearch.isReady'],
		['GET', '/api/v2/aiSearch/isStarting', 'aiSearch.isStarting'],
		['GET', '/api/v2/aiSearch/isSyncing', 'aiSearch.isSyncing'],
		['GET', '/api/v2/aiSearch/getSyncStatus', 'aiSearch.getSyncStatus'],
		['GET', '/api/v2/aiSearch/checkServiceHealth', 'aiSearch.checkServiceHealth'],
		['POST', '/api/v2/aiSearch/searchByText', 'aiSearch.searchByText'],
		['POST', '/api/v2/aiSearch/searchByBase64', 'aiSearch.searchByBase64'],
		['POST', '/api/v2/aiSearch/searchByItemId', 'aiSearch.searchByItemId'],
	];

	// Playground 互動式 API 測試介面
	require('./api-v2-playground').initPlayground(APIServer);

	routes.forEach(([method, path, handlerName]) => {
		APIServer.addAPI(path, method, async (args) => {
			// item.add：自動生成 ID 並回傳，讓呼叫方知道新增項目的 ID
			if (handlerName === 'item.add') {
				// 批量模式
				if (Array.isArray(args.items)) {
					const ids = await callHandler(handlerName, args);
					return { ids };
				}
				// 單一模式
				if (!args.id) args.id = guid();
				await callHandler(handlerName, args);
				return { id: args.id };
			}

			const result = await callHandler(handlerName, args);

			// 列表型端點：自動分頁
			if (PAGINATED_HANDLERS[handlerName] && Array.isArray(result)) {
				return paginate(result, args);
			}

			return result;
		});
	});
}

module.exports = { initAPIServerV2 };
