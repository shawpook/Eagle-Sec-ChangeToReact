class Folder {
	async recent() {
		let result = await eagle.fetch("http://localhost:41595/api/folder/listRecent", {
			redirect: "manual",
		});

		if (result.isRedirect) {
			// NOTE: 如果 localhost 被 redirect (SSR稀有案例，但是存在)
			isRedirect = true;
			eagle.logger.info("[background] getRecentFolders, fail. localhost get redirect");
		}

		return result.data;
	}

	async all() {
		let result = await eagle.fetchLargeJSON("http://localhost:41595/api/folder/list", {
			redirect: "manual",
		});

		if (result.isRedirect) {
			isRedirect = true;
			eagle.logger.info("[background] get folder list, fail. localhost get redirect");
		}

		return result.data;
	}

	/**
	 * Creates a folder with the given name via the API and returns the result object.
	 * @async
	 * @param {string} folderName - The name of the folder to create.
	 * @returns {Promise<Object>} A Promise that resolves to an object representing the folder that was created.
	 * The object structure is:
	 * {
	 *   "status": "success",
	 *   "data": {
	 *     "id": "string", // The ID of the folder.
	 *     "name": "string", // The name of the folder.
	 *     "images": "array", // An array of images in the folder.
	 *     "folders": "array", // An array of sub-folders.
	 *     "modificationTime": "number", // The timestamp of the last modification.
	 *     "imagesMappings": "object", // An object of images mappings.
	 *     "tags": "array", // An array of tags associated with the folder.
	 *     "children": "array", // An array of child items.
	 *     "isExpand": "boolean" // Indicates whether the folder is expanded.
	 *   }
	 * }
	 * @example
	 * const folderObject = await create("New Folder");
	 * console.log(folderObject);
	 */
	async create(folderName) {
		folderName = folderName?.trim();

		const data = JSON.stringify({
			folderName: folderName,
		});

		const result = await eagle.fetch("http://localhost:41595/api/folder/create", {
			method: "POST",
			body: data,
			headers: {
				"Content-Type": "application/json",
			},
		});

		const folder = result.data;

		return folder;
	}
}

eagle.folder = new Folder();
