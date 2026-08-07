class Preference {
	#id = "";
	#dirty = {
		shortcut: false,
		locale: false,
	};
	#onChangeCallbacks = [];
	#onReadyCallbacks = [];
	keybindings = {};

	#userPreferences = {
		theme: "light",
		overrideLocale: "browser",
		dragMode: 1,
		dragEnable: true,
		urlBlackList: [],
		domainBlackList: [],
		shortcutsSettings: {
			macOS: {
				"url-save": "Alt + 0",
				"batch-save": "Alt + 1",
				"capture-area": "Alt + 2",
				"capture-visible": "Alt + 3",
				"capture-entire": "Alt + 4",
			},
			Windows: {
				"url-save": "Alt + 0",
				"batch-save": "Alt + 1",
				"capture-area": "Alt + 2",
				"capture-visible": "Alt + 3",
				"capture-entire": "Alt + 4",
			},
		},
		usingCollect: false,
		useRetina: false,
		captureDelay: 0.5,
		captureFormat: "png",
		agreePrivacyPolicy: false, // Firefox only
	};

	//#region getter/setter

	/**
	 * 取得顯示用的主題
	 */
	get displayTheme() {
		// 判斷是否使用系統主題
		if (this.#userPreferences.theme === "system") {
			// 取得系統主題
			return eagle.env.browserTheme;
		} else {
			// 取得使用者偏好的主題
			return this.#userPreferences.theme;
		}
	}

	get dragMode() {
		return this.#userPreferences.dragMode;
	}

	set dragMode(dragMode) {
		this.#userPreferences.dragMode = dragMode;
	}

	get dragEnable() {
		return this.#userPreferences.dragEnable;
	}

	set dragEnable(dragEnable) {
		this.#userPreferences.dragEnable = dragEnable;
	}

	get theme() {
		return this.#userPreferences.theme;
	}

	set theme(theme) {
		if (["light", "dark", "system"].includes(theme)) {
			this.#userPreferences.theme = theme;
		}
	}

	get overrideLocale() {
		return this.#userPreferences.overrideLocale;
	}

	set overrideLocale(overrideLocale) {
		if (this.#userPreferences.overrideLocale !== overrideLocale) {
			this.#dirty.locale = true;
			this.#userPreferences.overrideLocale = overrideLocale;
		}
	}

	get urlBlackList() {
		return this.#userPreferences.urlBlackList;
	}

	set urlBlackList(urlBlackList) {
		this.#userPreferences.urlBlackList = urlBlackList;
	}

	get domainBlackList() {
		return this.#userPreferences.domainBlackList;
	}

	set domainBlackList(domainBlackList) {
		this.#userPreferences.domainBlackList = domainBlackList;
	}

	get shortcutsSettings() {
		return this.#userPreferences.shortcutsSettings;
	}

	get usingCollect() {
		return this.#userPreferences.usingCollect;
	}

	set usingCollect(usingCollect) {
		this.#userPreferences.usingCollect = usingCollect;
	}

	get useRetina() {
		return this.#userPreferences.useRetina;
	}

	set useRetina(useRetina) {
		this.#userPreferences.useRetina = useRetina;
	}

	/**
	 * 取得截圖延遲時間
	 * @returns {float} 截圖延遲時間
	 */
	get captureDelay() {
		return this.#userPreferences.captureDelay || 0.5;
	}

	/**
	 * 設定截圖延遲時間
	 * @param {float} captureDelay
	 */
	set captureDelay(captureDelay) {
		captureDelay = parseFloat(captureDelay);

		if (eagle.env.isChrome) {
			// Chrome 最小值為 0.5
			if (captureDelay < 0.5) {
				captureDelay = 0.5;
			}
		} else {
			// Firefox / Safari 最小值為 0.3
			if (captureDelay < 0.3) {
				captureDelay = 0.3;
			}
		}

		// 預設值為 0.5
		this.#userPreferences.captureDelay = captureDelay || 0.5;
	}

	get captureFormat() {
		return this.#userPreferences.captureFormat;
	}

	set captureFormat(captureFormat) {
		this.#userPreferences.captureFormat = captureFormat;
	}

	/**
	 * 取得使用者是否同意隱私權政策
	 * @returns {boolean} 是否同意隱私權政策
	 */
	get agreePrivacyPolicy() {
		return this.#userPreferences.agreePrivacyPolicy;
	}

	/**
	 * 設定使用者是否同意隱私權政策
	 * @param {boolean} agreePrivacyPolicy - 是否同意隱私權政策
	 */
	set agreePrivacyPolicy(agreePrivacyPolicy) {
		this.#userPreferences.agreePrivacyPolicy = agreePrivacyPolicy;
	}

	//#endregion

	async init() {
		this.#id = eagle.crypto.generateUUID();
		this.#registerRuntimeChannel();
		await this.#initPreference();
		this.#onReadyCallbacks.forEach((callback) => {
			callback();
		});
	}

	updateKeybindings(keybindings) {
		this.#dirty.shortcut = true;
		this.#userPreferences.shortcutsSettings[eagle.env.os.name] = keybindings;
	}

	#registerRuntimeChannel() {
		eagle.runtime.onMessage("preference-changed", async (request, sender, sendResponse) => {
			const senderID = request.senderID;
			if (this.#id !== senderID) {
				console.log("preference-changed", request.senderID);

				await this.#initPreference();

				// 通知所有註冊 onchange 的元件
				this.#onChangeCallbacks.forEach((callback) => {
					callback(request);
				});
			}
			sendResponse();

			return true;
		});
	}

	changed(callback) {
		this.#onChangeCallbacks.push(callback);
	}

	ready(callback) {
		this.#onReadyCallbacks.push(callback);
	}

	/**
	 * 回傳首選語系
	 * @description 此函數用來獲取語系設定。如果使用者偏好設定為使用瀏覽器的語系，函數將回傳瀏覽器的語系。否則，它將回傳使用者偏好中設定的語系。
	 *
	 * 這個函數會檢查 `#userPreferences.overrideLocale` 的值。如果它的值為 "browser"，那麼函數會回傳瀏覽器的語系（`navigator.language`）。如果 `#userPreferences.overrideLocale` 是其他的值，那麼函數將回傳該值。
	 *
	 * 注意：這個函數假設 `#userPreferences.overrideLocale` 是一個有效的語系代碼，或者是 "browser"。如果這個假設不成立，函數的行為可能會不符合預期。
	 *
	 * @example
	 * // 假設瀏覽器語系是 "en-US"，並且使用者偏好是使用瀏覽器語系
	 * console.log(getPreferredLocale());  // "en-US"
	 *
	 * // 假設使用者偏好設定為 "fr"
	 * console.log(getPreferredLocale());  // "fr"
	 *
	 * @returns {string} 使用者偏好的語系或瀏覽器語系
	 */
	getPreferredLocale() {
		return this.#userPreferences.overrideLocale === "browser" ? navigator.language : this.#userPreferences.overrideLocale;
	}

	async #initPreference() {
		// 確保有正確與 Eagle 溝通
		await eagle.env.isEagleOpen();

		try {
			const preferenceKeys = Object.keys(this.#userPreferences);
			const cloudPreferences = await eagle.storage.sync.get(preferenceKeys);

			if (cloudPreferences.shortcutsSettings) {
				cloudPreferences.shortcutsSettings = JSON.parse(cloudPreferences.shortcutsSettings);
			}

			preferenceKeys.forEach((key) => {
				if (cloudPreferences[key] !== undefined) {
					this.#userPreferences[key] = cloudPreferences[key];
				}
			});
		} catch (error) {
			console.log("preference init error");
			console.log("probably shortcutsSettings is not a JSON string/or not exist");
			console.error(error);
		}

		// HACK: 這是從舊版API拿來的
		this.#userPreferences.usingCollect = eagle.env.appInfo?.showCollectModal || false;
		console.log("this.#userPreferences.usingCollect", this.#userPreferences.usingCollect);

		this.#dirty = {
			shortcut: false,
			locale: false,
		};

		// NOTE: 實際要使用的快捷鍵會註冊在 this.shortcut
		this.#updateShortcut();
	}

	async save() {
		await this.#storePreference();
		await this.#broadcastUpdateSettings();
	}

	/**
	 * 保存設定
	 */
	async #storePreference() {
		let preference = { ...this.#userPreferences };
		preference.shortcutsSettings = JSON.stringify(preference.shortcutsSettings);
		return await eagle.storage.sync.set(preference);
	}

	#updateShortcut() {
		const osName = eagle.env.os.isMac ? "macOS" : "Windows";
		this.keybindings = { ...this.shortcutsSettings[osName] };
	}

	async #broadcastUpdateSettings() {
		eagle.runtime.broadcast("preference-changed", {
			senderID: this.#id,
			dirty: {
				shortcut: this.#dirty.shortcut,
				locale: this.#dirty.locale,
			},
		});
		this.#dirty.shortcut = false;
		this.#dirty.locale = false;
	}

	isURLBlackList(url) {
		const currentDomain = new URL(url).hostname;
		const currentURL = url;

		// 檢查網域是否在黑名單中
		if (this.domainBlackList.includes(currentDomain)) {
			return true;
		}

		// 檢查網址是否在黑名單中
		if (this.urlBlackList.includes(currentURL)) {
			return true;
		}

		return false;
	}
}

eagle.preference = new Preference();
