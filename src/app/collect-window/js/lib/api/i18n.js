class I18n {
	#onChangedCallback = [];

	// 語系對照表
	languageMap = {
		zh: "zh_CN",
		"zh-tw": "zh_TW",
		"zh-cn": "zh_CN",
		es: "es",
		de: "de",
		ru: "ru",
		ja: "ja",
		ko: "ko",
		en: "en",
	};

	// 語系資料保留的地方
	words = {};
	loadedLocale = "";

	async init() {
		await this.#initLocale();
		this.#registerRuntimeChannel();
	}

	/**
	 * 初始化語系
	 */
	async #initLocale(forceOverride = null) {
		const locale = preferences.general.language;

		// MV3: 不支援在前端 fetch，所以改用 eagle.runtime.getURL
		const localeFileURL = eagle.runtime.getURL(`locales/${locale}.json`);

		this.words = await fetch(encodeURI(localeFileURL))
			.then((response) => response.json())
			.catch((error) => {
				console.error(error);
			});

		this.loadedLocale = locale;
	}

	async update(forceOverride = null) {
		// HACK: 我必須丟一個 promise 出去，如果我這裡只 await 他會直接偷跑出去
		return new Promise(async (resolve) => {
			let locale = forceOverride || this.#getLocaleFromPreference();

			if (locale !== this.loadedLocale) {
				// 如果是預設值，就改成瀏覽器語系
				if (locale == "browser") {
					locale = this.#getLocaleFromPreference();
				}
				await this.#initLocale(locale);
			}

			resolve();
		});
	}

	/**
	 * 取得偏好設定語系代碼
	 * @returns {string} 語系代碼，例如 en、es、kr、zh-CN、zh-TW 等，如果沒有對應的語系就回傳 en
	 */
	#getLocaleFromPreference() {
		const browserLocale = navigator.language.toLowerCase();
		const overrideLocale = eagle.preference.overrideLocale.toLowerCase();

		// 防呆，如果沒有對應的語系就回傳英文
		if (overrideLocale && overrideLocale !== "browser") {
			return this.languageMap[overrideLocale] || "en";
		} else {
			return this.languageMap[browserLocale] || this.languageMap[browserLocale.split("-")[0]] || "en";
		}
	}

	changed(callback) {
		this.#onChangedCallback.push(callback);
	}

	#registerRuntimeChannel() {
		eagle.preference.changed(async ({ dirty }) => {
			if (dirty.locale) {
				await this.update(eagle.preference.overrideLocale);
				this.#onChangedCallback.forEach((callback) => callback());
			}
		});
	}
}

eagle.i18n = new I18n();
