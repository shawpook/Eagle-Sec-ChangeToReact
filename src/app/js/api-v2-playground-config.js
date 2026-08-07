/**
 * Eagle API v2 Playground - Endpoint metadata definitions
 *
 * Defines all API v2 endpoint parameters, types, and descriptions.
 * Used by api-v2-playground.js to generate the interactive Playground page.
 */

module.exports = {
	groups: [
		{
			name: 'App',
			endpoints: [
				{
					method: 'GET',
					path: '/api/v2/app/info',
					handler: 'app.info',
					description: 'Get application info (version, platform)',
					params: []
				},
			]
		},
		{
			name: 'Library',
			endpoints: [
				{
					method: 'GET',
					path: '/api/v2/library/info',
					handler: 'library.info',
					description: 'Get current library info',
					params: []
				},
				{
					method: 'GET',
					path: '/api/v2/library/history',
					handler: 'library.history',
					description: 'Get library open history',
					params: [
						{ name: 'offset', type: 'number', required: false, description: 'Pagination offset', example: '0' },
						{ name: 'limit', type: 'number', required: false, description: 'Items per page (default 50, max 1000)', example: '50' },
					]
				},
				{
					method: 'POST',
					path: '/api/v2/library/switch',
					handler: 'library.switch',
					description: 'Switch library',
					params: [
						{ name: 'libraryPath', type: 'string', required: true, description: 'Library path (.library folder)' },
					]
				},
				{
					method: 'GET',
					path: '/api/v2/library/icon',
					handler: 'library.icon',
					description: 'Get library icon',
					params: [
						{ name: 'libraryPath', type: 'string', required: true, description: 'Library path' },
					]
				},
			]
		},
		{
			name: 'Item',
			endpoints: [
				{
					method: 'GET',
					path: '/api/v2/item/get',
					handler: 'item.get',
					description: 'Get items with simple filters and pagination (use POST for array filters)',
					params: [
						{ name: 'id', type: 'string', required: false, description: 'Item ID (returns a single item when specified)' },
						{ name: 'ext', type: 'string', required: false, description: 'Filter by file extension (e.g. png, jpg)' },
						{ name: 'annotation', type: 'string', required: false, description: 'Filter by annotation' },
						{ name: 'url', type: 'string', required: false, description: 'Filter by source URL' },
						{ name: 'shape', type: 'string', required: false, description: 'Filter by shape (square, landscape, portrait)' },
						{ name: 'rating', type: 'number', required: false, description: 'Filter by rating (0-5)' },
						{ name: 'offset', type: 'number', required: false, description: 'Pagination offset', example: '0' },
						{ name: 'limit', type: 'number', required: false, description: 'Items per page (default 50, max 1000)', example: '50' },
					]
				},
				{
					method: 'POST',
					path: '/api/v2/item/get',
					handler: 'item.get',
					description: 'Get items (POST version, suitable for complex filters)',
					params: [
						{ name: 'id', type: 'string', required: false, description: 'Item ID (returns a single item when specified)' },
						{ name: 'ids', type: 'array', required: false, description: 'Multiple item IDs', example: '["id1","id2"]' },
						{ name: 'smartFolders', type: 'array', required: false, description: 'Filter by smart folder IDs (OR logic, combinable with other filters)', example: '["sfId1"]' },
						{ name: 'tags', type: 'array', required: false, description: 'Filter by tags', example: '["tag1","tag2"]' },
						{ name: 'folders', type: 'array', required: false, description: 'Filter by folder IDs', example: '["folderId1"]' },
						{ name: 'keywords', type: 'array', required: false, description: 'Filter by name keywords', example: '["keyword"]' },
						{ name: 'ext', type: 'string', required: false, description: 'Filter by file extension (e.g. png, jpg)' },
						{ name: 'annotation', type: 'string', required: false, description: 'Filter by annotation' },
						{ name: 'url', type: 'string', required: false, description: 'Filter by source URL' },
						{ name: 'shape', type: 'string', required: false, description: 'Filter by shape (square, landscape, portrait)' },
						{ name: 'rating', type: 'number', required: false, description: 'Filter by rating (0-5)' },
						{ name: 'isSelected', type: 'boolean', required: false, description: 'Get currently selected items' },
						{ name: 'isUnfiled', type: 'boolean', required: false, description: 'Get unfiled items' },
						{ name: 'isUntagged', type: 'boolean', required: false, description: 'Get untagged items' },
						{ name: 'fields', type: 'array', required: false, description: 'Specify return fields', example: '["id","name","tags"]' },
						{ name: 'offset', type: 'number', required: false, description: 'Pagination offset', example: '0' },
						{ name: 'limit', type: 'number', required: false, description: 'Items per page (default 50, max 1000)', example: '50' },
					]
				},
				{
					method: 'POST',
					path: '/api/v2/item/query',
					handler: 'item.query',
					description: 'Full-text search items (supports OR syntax, exclusion)',
					params: [
						{ name: 'query', type: 'string', required: false, description: 'Search keywords (supports OR, parentheses, -exclusion)', example: 'cat OR dog' },
						{ name: 'offset', type: 'number', required: false, description: 'Pagination offset', example: '0' },
						{ name: 'limit', type: 'number', required: false, description: 'Items per page (default 50, max 1000)', example: '10' },
					]
				},
				{
					method: 'GET',
					path: '/api/v2/item/countAll',
					handler: 'item.countAll',
					description: 'Get total item count',
					params: []
				},
				{
					method: 'POST',
					path: '/api/v2/item/add',
					handler: 'item.add',
					description: 'Add item to library (supports URL, file path, Base64, bookmark)',
					params: [
						{ name: 'url', type: 'string', required: false, description: 'Image URL (at least one of: url, path, base64, bookmarkURL)' },
						{ name: 'path', type: 'string', required: false, description: 'Local file path' },
						{ name: 'base64', type: 'string', required: false, description: 'Base64-encoded image data' },
						{ name: 'bookmarkURL', type: 'string', required: false, description: 'Bookmark URL' },
						{ name: 'name', type: 'string', required: false, description: 'Item name' },
						{ name: 'website', type: 'string', required: false, description: 'Source website URL' },
						{ name: 'tags', type: 'array', required: false, description: 'Tags array', example: '["tag1","tag2"]' },
						{ name: 'annotation', type: 'string', required: false, description: 'Annotation' },
						{ name: 'folders', type: 'array', required: false, description: 'Target folder IDs', example: '["folderId"]' },
						{ name: 'star', type: 'number', required: false, description: 'Rating (0-5)' },
						{ name: 'items', type: 'object', required: false, description: 'Batch mode: items array (max 1000)', example: '[{"url":"...","name":"...","tags":[]}]' },
					]
				},
				{
					method: 'POST',
					path: '/api/v2/item/update',
					handler: 'item.save',
					description: 'Update item properties',
					params: [
						{ name: 'id', type: 'string', required: true, description: 'Item ID' },
						{ name: 'name', type: 'string', required: false, description: 'New name' },
						{ name: 'annotation', type: 'string', required: false, description: 'New annotation' },
						{ name: 'url', type: 'string', required: false, description: 'Source URL' },
						{ name: 'tags', type: 'array', required: false, description: 'Tags array (full replacement)', example: '["tag1","tag2"]' },
						{ name: 'folders', type: 'array', required: false, description: 'Folder IDs array (full replacement)', example: '["folderId"]' },
						{ name: 'star', type: 'number', required: false, description: 'Rating (0-5)' },
						{ name: 'ext', type: 'string', required: false, description: 'File extension' },
						{ name: 'width', type: 'number', required: false, description: 'Width' },
						{ name: 'height', type: 'number', required: false, description: 'Height' },
						{ name: 'noThumbnail', type: 'boolean', required: false, description: 'Disable thumbnail' },
						{ name: 'noPreview', type: 'boolean', required: false, description: 'Disable preview' },
						{ name: 'isDeleted', type: 'boolean', required: false, description: 'Move to trash' },
						{ name: 'modificationTime', type: 'number', required: false, description: 'Modification time (timestamp)' },
					]
				},
				{
					method: 'POST',
					path: '/api/v2/item/setCustomThumbnail',
					handler: 'item.setCustomThumbnail',
					description: 'Set custom thumbnail',
					params: [
						{ name: 'itemId', type: 'string', required: true, description: 'Item ID' },
						{ name: 'filePath', type: 'string', required: true, description: 'Thumbnail file path' },
						{ name: 'width', type: 'number', required: false, description: 'Width' },
						{ name: 'height', type: 'number', required: false, description: 'Height' },
					]
				},
				{
					method: 'POST',
					path: '/api/v2/item/refreshThumbnail',
					handler: 'item.refreshThumbnail',
					description: 'Regenerate thumbnail',
					params: [
						{ name: 'itemId', type: 'string', required: true, description: 'Item ID' },
					]
				},
				{
					method: 'GET',
					path: '/api/v2/item/getComments',
					handler: 'item.getComments',
					description: 'Get all comments (annotations) for an item',
					params: [
						{ name: 'id', type: 'string', required: true, description: 'Item ID' },
					]
				},
				{
					method: 'POST',
					path: '/api/v2/item/addComment',
					handler: 'item.addComment',
					description: 'Add a comment to an item (image rect or video timestamp)',
					params: [
						{ name: 'id', type: 'string', required: true, description: 'Item ID' },
						{ name: 'annotation', type: 'string', required: false, description: 'Comment text' },
						{ name: 'x', type: 'number', required: false, description: 'Rect X position (image comment)' },
						{ name: 'y', type: 'number', required: false, description: 'Rect Y position (image comment)' },
						{ name: 'width', type: 'number', required: false, description: 'Rect width (image comment, must > 0)' },
						{ name: 'height', type: 'number', required: false, description: 'Rect height (image comment, must > 0)' },
						{ name: 'duration', type: 'number', required: false, description: 'Video timestamp in seconds (video comment, must >= 0)' },
					]
				},
				{
					method: 'POST',
					path: '/api/v2/item/updateComment',
					handler: 'item.updateComment',
					description: 'Update an existing comment',
					params: [
						{ name: 'id', type: 'string', required: true, description: 'Item ID' },
						{ name: 'commentId', type: 'string', required: true, description: 'Comment ID to update' },
						{ name: 'annotation', type: 'string', required: false, description: 'New comment text' },
						{ name: 'x', type: 'number', required: false, description: 'New X position (image comment only)' },
						{ name: 'y', type: 'number', required: false, description: 'New Y position (image comment only)' },
						{ name: 'width', type: 'number', required: false, description: 'New width (image comment only, must > 0)' },
						{ name: 'height', type: 'number', required: false, description: 'New height (image comment only, must > 0)' },
						{ name: 'duration', type: 'number', required: false, description: 'New timestamp (video comment only, must >= 0)' },
					]
				},
				{
					method: 'POST',
					path: '/api/v2/item/removeComment',
					handler: 'item.removeComment',
					description: 'Remove a comment from an item',
					params: [
						{ name: 'id', type: 'string', required: true, description: 'Item ID' },
						{ name: 'commentId', type: 'string', required: true, description: 'Comment ID to remove' },
					]
				},
			]
		},
		{
			name: 'Folder',
			endpoints: [
				{
					method: 'GET',
					path: '/api/v2/folder/get',
					handler: 'folder.get',
					description: 'Get folder list (use POST for array filters)',
					params: [
						{ name: 'id', type: 'string', required: false, description: 'Folder ID (get specific folder)' },
						{ name: 'isRecent', type: 'boolean', required: false, description: 'Get recently used folders' },
						{ name: 'isSelected', type: 'boolean', required: false, description: 'Get currently selected folders' },
						{ name: 'offset', type: 'number', required: false, description: 'Pagination offset', example: '0' },
						{ name: 'limit', type: 'number', required: false, description: 'Items per page (default 50, max 1000)', example: '50' },
					]
				},
				{
					method: 'POST',
					path: '/api/v2/folder/get',
					handler: 'folder.get',
					description: 'Get folder list (POST version)',
					params: [
						{ name: 'id', type: 'string', required: false, description: 'Folder ID (get specific folder)' },
						{ name: 'ids', type: 'array', required: false, description: 'Multiple folder IDs', example: '["id1","id2"]' },
						{ name: 'isRecent', type: 'boolean', required: false, description: 'Get recently used folders' },
						{ name: 'isSelected', type: 'boolean', required: false, description: 'Get currently selected folders' },
						{ name: 'offset', type: 'number', required: false, description: 'Pagination offset', example: '0' },
						{ name: 'limit', type: 'number', required: false, description: 'Items per page (default 50, max 1000)', example: '50' },
					]
				},
				{
					method: 'POST',
					path: '/api/v2/folder/create',
					handler: 'folder.create',
					description: 'Create a new folder',
					params: [
						{ name: 'name', type: 'string', required: true, description: 'Folder name' },
						{ name: 'description', type: 'string', required: false, description: 'Folder description' },
						{ name: 'parent', type: 'string', required: false, description: 'Parent folder ID (root level if omitted)' },
						{ name: 'iconColor', type: 'select', required: false, description: 'Icon color', options: ['', 'red', 'orange', 'yellow', 'green', 'aqua', 'blue', 'purple', 'pink'], optionLabels: ['(default)', 'red', 'orange', 'yellow', 'green', 'aqua', 'blue', 'purple', 'pink'] },
					]
				},
				{
					method: 'POST',
					path: '/api/v2/folder/update',
					handler: 'folder.save',
					description: 'Update folder properties',
					params: [
						{ name: 'id', type: 'string', required: true, description: 'Folder ID' },
						{ name: 'name', type: 'string', required: false, description: 'New name' },
						{ name: 'description', type: 'string', required: false, description: 'New description' },
						{ name: 'tags', type: 'array', required: false, description: 'Tags array', example: '["tag1"]' },
						{ name: 'iconColor', type: 'select', required: false, description: 'Icon color', options: ['', 'red', 'orange', 'yellow', 'green', 'aqua', 'blue', 'purple', 'pink'], optionLabels: ['(default)', 'red', 'orange', 'yellow', 'green', 'aqua', 'blue', 'purple', 'pink'] },
						{ name: 'parent', type: 'string', required: false, description: 'Move to new parent folder ID (null for root level)' },
					]
				},
			]
		},
		{
			name: 'Smart Folder',
			endpoints: [
				{
					method: 'GET',
					path: '/api/v2/smartFolder/get',
					handler: 'smartFolder.get',
					description: 'Get smart folders (all or by ID)',
					params: [
						{ name: 'id', type: 'string', required: false, description: 'Smart folder ID' },
						{ name: 'offset', type: 'number', required: false, description: 'Pagination offset', example: '0' },
						{ name: 'limit', type: 'number', required: false, description: 'Items per page (default 50, max 1000)', example: '50' },
					]
				},
				{
					method: 'POST',
					path: '/api/v2/smartFolder/get',
					handler: 'smartFolder.get',
					description: 'Get smart folders (POST version, supports ids)',
					params: [
						{ name: 'id', type: 'string', required: false, description: 'Smart folder ID' },
						{ name: 'ids', type: 'array', required: false, description: 'Multiple smart folder IDs', example: '["id1","id2"]' },
						{ name: 'offset', type: 'number', required: false, description: 'Pagination offset', example: '0' },
						{ name: 'limit', type: 'number', required: false, description: 'Items per page (default 50, max 1000)', example: '50' },
					]
				},
				{
					method: 'POST',
					path: '/api/v2/smartFolder/create',
					handler: 'smartFolder.create',
					description: 'Create a new smart folder with filter conditions',
					params: [
						{ name: 'name', type: 'string', required: true, description: 'Smart folder name' },
						{ name: 'conditions', type: 'conditions-builder', required: true, description: 'Filter conditions (visual builder)' },
						{ name: 'description', type: 'string', required: false, description: 'Description' },
						{ name: 'iconColor', type: 'select', required: false, description: 'Icon color', options: ['', 'red', 'orange', 'yellow', 'green', 'aqua', 'blue', 'purple', 'pink'], optionLabels: ['(default)', 'red', 'orange', 'yellow', 'green', 'aqua', 'blue', 'purple', 'pink'] },
						{ name: 'parent', type: 'string', required: false, description: 'Parent smart folder ID' },
					]
				},
				{
					method: 'POST',
					path: '/api/v2/smartFolder/update',
					handler: 'smartFolder.update',
					description: 'Update smart folder properties',
					params: [
						{ name: 'id', type: 'string', required: true, description: 'Smart folder ID' },
						{ name: 'name', type: 'string', required: false, description: 'New name' },
						{ name: 'conditions', type: 'conditions-builder', required: false, description: 'New filter conditions (visual builder)' },
						{ name: 'description', type: 'string', required: false, description: 'New description' },
						{ name: 'iconColor', type: 'select', required: false, description: 'Icon color', options: ['', 'red', 'orange', 'yellow', 'green', 'aqua', 'blue', 'purple', 'pink'], optionLabels: ['(default)', 'red', 'orange', 'yellow', 'green', 'aqua', 'blue', 'purple', 'pink'] },
						{ name: 'icon', type: 'string', required: false, description: 'Icon' },
					]
				},
				{
					method: 'POST',
					path: '/api/v2/smartFolder/remove',
					handler: 'smartFolder.remove',
					description: 'Delete a smart folder',
					params: [
						{ name: 'id', type: 'string', required: true, description: 'Smart folder ID' },
					]
				},
				{
					method: 'GET',
					path: '/api/v2/smartFolder/getItems',
					handler: 'smartFolder.getItems',
					description: 'Get items matching a smart folder',
					params: [
						{ name: 'smartFolderId', type: 'string', required: true, description: 'Smart folder ID' },
						{ name: 'orderBy', type: 'string', required: false, description: 'Sort field' },
						{ name: 'fields', type: 'array', required: false, description: 'Return fields', example: '["id","name","tags"]' },
						{ name: 'offset', type: 'number', required: false, description: 'Pagination offset', example: '0' },
						{ name: 'limit', type: 'number', required: false, description: 'Items per page (default 50, max 1000)', example: '50' },
					]
				},
				{
					method: 'GET',
					path: '/api/v2/smartFolder/getRules',
					handler: 'smartFolder.getRules',
					description: 'Get available property rules schema (methods, value types)',
					params: []
				},
			]
		},
		{
			name: 'Tag',
			endpoints: [
				{
					method: 'GET',
					path: '/api/v2/tag/get',
					handler: 'tag.get',
					description: 'Get all tags',
					params: [
						{ name: 'name', type: 'string', required: false, description: 'Fuzzy search by name' },
						{ name: 'offset', type: 'number', required: false, description: 'Pagination offset', example: '0' },
						{ name: 'limit', type: 'number', required: false, description: 'Items per page (default 50, max 1000)', example: '50' },
					]
				},
				{
					method: 'POST',
					path: '/api/v2/tag/get',
					handler: 'tag.get',
					description: 'Get tags (POST version)',
					params: [
						{ name: 'name', type: 'string', required: false, description: 'Fuzzy search by name' },
						{ name: 'offset', type: 'number', required: false, description: 'Pagination offset', example: '0' },
						{ name: 'limit', type: 'number', required: false, description: 'Items per page (default 50, max 1000)', example: '50' },
					]
				},
				{
					method: 'GET',
					path: '/api/v2/tag/getRecentTags',
					handler: 'tag.getRecentTags',
					description: 'Get recently used tags',
					params: [
						{ name: 'offset', type: 'number', required: false, description: 'Pagination offset', example: '0' },
						{ name: 'limit', type: 'number', required: false, description: 'Items per page (default 50, max 1000)', example: '50' },
					]
				},
				{
					method: 'GET',
					path: '/api/v2/tag/getStarredTags',
					handler: 'tag.getStarredTags',
					description: 'Get starred tags',
					params: [
						{ name: 'offset', type: 'number', required: false, description: 'Pagination offset', example: '0' },
						{ name: 'limit', type: 'number', required: false, description: 'Items per page (default 50, max 1000)', example: '50' },
					]
				},
				{
					method: 'POST',
					path: '/api/v2/tag/update',
					handler: 'tag.save',
					description: 'Update tag (rename)',
					params: [
						{ name: 'originalName', type: 'string', required: true, description: 'Original tag name' },
						{ name: 'name', type: 'string', required: true, description: 'New tag name' },
					]
				},
				{
					method: 'POST',
					path: '/api/v2/tag/merge',
					handler: 'tag.merge',
					description: 'Merge tags (merge source into target)',
					params: [
						{ name: 'source', type: 'string', required: true, description: 'Source tag name (will be removed)' },
						{ name: 'target', type: 'string', required: true, description: 'Target tag name (will be kept)' },
					]
				},
			]
		},
		{
			name: 'TagGroup',
			endpoints: [
				{
					method: 'GET',
					path: '/api/v2/tagGroup/get',
					handler: 'tagGroup.get',
					description: 'Get all tag groups',
					params: [
						{ name: 'offset', type: 'number', required: false, description: 'Pagination offset', example: '0' },
						{ name: 'limit', type: 'number', required: false, description: 'Items per page (default 50, max 1000)', example: '50' },
					]
				},
				{
					method: 'POST',
					path: '/api/v2/tagGroup/create',
					handler: 'tagGroup.create',
					description: 'Create a tag group',
					params: [
						{ name: 'name', type: 'string', required: true, description: 'Group name' },
						{ name: 'tags', type: 'array', required: false, description: 'Initial tags', example: '["tag1","tag2"]' },
						{ name: 'color', type: 'select', required: false, description: 'Group color', options: ['', 'red', 'orange', 'yellow', 'green', 'aqua', 'blue', 'purple', 'pink'], optionLabels: ['(default)', 'red', 'orange', 'yellow', 'green', 'aqua', 'blue', 'purple', 'pink'] },
						{ name: 'description', type: 'string', required: false, description: 'Group description' },
					]
				},
				{
					method: 'POST',
					path: '/api/v2/tagGroup/update',
					handler: 'tagGroup.save',
					description: 'Update a tag group',
					params: [
						{ name: 'id', type: 'string', required: true, description: 'Group ID' },
						{ name: 'name', type: 'string', required: false, description: 'New name' },
						{ name: 'tags', type: 'array', required: false, description: 'Tags array (full replacement)', example: '["tag1","tag2"]' },
						{ name: 'color', type: 'select', required: false, description: 'Group color', options: ['', 'red', 'orange', 'yellow', 'green', 'aqua', 'blue', 'purple', 'pink'], optionLabels: ['(default)', 'red', 'orange', 'yellow', 'green', 'aqua', 'blue', 'purple', 'pink'] },
						{ name: 'description', type: 'string', required: false, description: 'Group description' },
					]
				},
				{
					method: 'POST',
					path: '/api/v2/tagGroup/remove',
					handler: 'tagGroup.remove',
					description: 'Delete a tag group',
					params: [
						{ name: 'id', type: 'string', required: true, description: 'Group ID' },
					]
				},
				{
					method: 'POST',
					path: '/api/v2/tagGroup/addTags',
					handler: 'tagGroup.addTags',
					description: 'Add tags to a group incrementally',
					params: [
						{ name: 'groupId', type: 'string', required: true, description: 'Group ID' },
						{ name: 'tags', type: 'array', required: true, description: 'Tags to add', example: '["tag1","tag2"]' },
						{ name: 'removeFromSource', type: 'boolean', required: false, description: 'Remove from source group' },
					]
				},
				{
					method: 'POST',
					path: '/api/v2/tagGroup/removeTags',
					handler: 'tagGroup.removeTags',
					description: 'Remove tags from a group',
					params: [
						{ name: 'groupId', type: 'string', required: true, description: 'Group ID' },
						{ name: 'tags', type: 'array', required: true, description: 'Tags to remove', example: '["tag1"]' },
					]
				},
			]
		},
		{
			name: 'AI Search',
			endpoints: [
				{
					method: 'GET',
					path: '/api/v2/aiSearch/isInstalled',
					handler: 'aiSearch.isInstalled',
					description: 'Check if AI Search is installed',
					params: []
				},
				{
					method: 'GET',
					path: '/api/v2/aiSearch/isReady',
					handler: 'aiSearch.isReady',
					description: 'Check if AI Search is ready',
					params: []
				},
				{
					method: 'GET',
					path: '/api/v2/aiSearch/isStarting',
					handler: 'aiSearch.isStarting',
					description: 'Check if AI Search is starting',
					params: []
				},
				{
					method: 'GET',
					path: '/api/v2/aiSearch/isSyncing',
					handler: 'aiSearch.isSyncing',
					description: 'Check if AI Search is syncing',
					params: []
				},
				{
					method: 'GET',
					path: '/api/v2/aiSearch/getSyncStatus',
					handler: 'aiSearch.getSyncStatus',
					description: 'Get AI Search sync status',
					params: []
				},
				{
					method: 'GET',
					path: '/api/v2/aiSearch/checkServiceHealth',
					handler: 'aiSearch.checkServiceHealth',
					description: 'Check AI Search service health',
					params: []
				},
				{
					method: 'POST',
					path: '/api/v2/aiSearch/searchByText',
					handler: 'aiSearch.searchByText',
					description: 'Search similar items by text',
					params: [
						{ name: 'query', type: 'string', required: true, description: 'Search text' },
						{ name: 'options', type: 'object', required: false, description: 'Search options', example: '{"limit":10}' },
					]
				},
				{
					method: 'POST',
					path: '/api/v2/aiSearch/searchByBase64',
					handler: 'aiSearch.searchByBase64',
					description: 'Search similar items by Base64 image',
					params: [
						{ name: 'base64', type: 'string', required: true, description: 'Base64-encoded image' },
						{ name: 'options', type: 'object', required: false, description: 'Search options', example: '{"limit":10}' },
					]
				},
				{
					method: 'POST',
					path: '/api/v2/aiSearch/searchByItemId',
					handler: 'aiSearch.searchByItemId',
					description: 'Search similar items by item ID',
					params: [
						{ name: 'itemId', type: 'string', required: true, description: 'Item ID' },
						{ name: 'options', type: 'object', required: false, description: 'Search options', example: '{"limit":10}' },
					]
				},
			]
		},
	]
};
