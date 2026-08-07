class Tag {
	async recent() {
		// listRecent
		let result = await eagle.fetch("http://localhost:41595/api/tag/listRecent", {
			redirect: "manual",
		});

		if (result.isRedirect) {
			isRedirect = true;
			eagle.logger.info("[background] get folder list, fail. localhost get redirect");
		}

		return result.data;
	}

	async all() {
		let result = await eagle.fetchLargeJSON("http://localhost:41595/api/tag/all", {
			redirect: "manual",
		});

		if (result.isRedirect) {
			isRedirect = true;
			eagle.logger.info("[background] get folder list, fail. localhost get redirect");
		}

		return result.data;
	}

	async list() {
		let result = await eagle.fetchLargeJSON("http://localhost:41595/api/tag/list", {
			redirect: "manual",
		});

		if (result.isRedirect) {
			isRedirect = true;
			eagle.logger.info("[background] get folder list, fail. localhost get redirect");
		}

		return result.data;
	}
}

eagle.tag = new Tag();
