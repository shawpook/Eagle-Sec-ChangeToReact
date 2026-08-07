
class BaseFetch {
	async fetch(url, options) {
		throw new Error("Not implemented");
	}
}

class ForegroundFetch extends BaseFetch {
	async fetch(url, options) {

		if (options?.body) {
			for (let key in options.body) {
				if (options.body[key] === null || options.body[key] === undefined) {
					delete options.body[key];
				}
			}
		}

		if (options?.headers?.["Content-Type"] !== "application/json") {
			if (options?.body) {
				for (const [key, value] of Object.entries(options.body)) {
					if (Array.isArray(value)) {
						value.forEach((item, index) => {
							options.body[`${key}[${index}]`] = item;
						});
						delete options.body[key];
					}
				}

				options.body = new URLSearchParams(options.body);
			}
		}
		
		const result = await fetch(url, options);
		return await result.json();
	}

	// NOTE: 超大型 JSON 會因為前後端傳輸需要重新序列化，這會導致嚴重的效能問題，特別是 Safari
	async fetchLargeJSON(url, options) {
		const result = await fetch(url, options);
		return await result.json();
	}
}

class Fetch {
	_fetch;
	constructor() {
		this._fetch = new ForegroundFetch();
	}

	async fetch(url, options) {
		return this._fetch.fetch(url, options);
	}

	async fetchLargeJSON(url, options) {
		return this._fetch.fetchLargeJSON(url, options);
	}
}

(() => {
	const eagleFetch = new Fetch();
	eagle.fetch = (url, options) => eagleFetch.fetch(url, options);
	eagle.fetchLargeJSON = (url, options) => eagleFetch.fetchLargeJSON(url, options);
})();
