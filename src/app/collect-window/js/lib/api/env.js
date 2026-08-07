class Environment {
	os;
	browser;
	canvas;
	appInfo;

	constructor() {
		this.os = this.#getOS();
		this.browser = this.#getBrowser();
		this.canvas = this.#getCanvas();
	}

	get browserTheme() {
		return this.#getBrowserTheme();
	}

	get isChrome() {
		return this.browser.name === "chrome" || this.browser.name === "chromium";
	}

	get isSafari() {
		return this.browser.name === "safari";
	}

	/**
	 * 回傳 Eagle App 本體是否支援 URL Enlarger
	 * @returns {boolean} 是否支援 URL Enlarger
	 */
	get isAppSupportURLEnlarger() {
		// NOTE: appInfo.buildVersion 有可能會出現 undefined，但是以程式邏輯來說這樣寫法不會有問題

		if (this.appInfo == undefined || this.appInfo.buildVersion == undefined) {
			return false;
		}

		if (this.appInfo.buildVersion >= 20230901 && this.appInfo.isVersion4) {
			return true;
		}

		return false;
	}

	/**
	 * 回傳 Eagle App 本體是否支援 Extension 新版的 Collect Window
	 * @returns {boolean} 是否支援 Extension 新版的 Collect Window
	 */
	get isAppSupportExtensionCollectWindow() {
		if (this.appInfo == undefined || this.appInfo.buildVersion == undefined) {
			return false;
		}

		if (this.appInfo.buildVersion >= 20240222 && this.appInfo.isVersion4) {
			return true;
		}

		return false;
	}

	/**
	 * 檢查是否顯示新版收藏視窗
	 * 新版收藏視窗在以下情況下顯示：
	 * 1. 使用者選擇「選擇...」選項時（folderID 為 "choose"）且應用程式支援新版擴充收藏視窗API。
	 * 2. 使用者啟用收藏功能（eagle.preference.usingCollect 為 true），且應用程式支援新版擴充收藏視窗API。
	 *
	 * @param {string|null} folderID - 資料夾 ID 或 null。"choose" 表示使用者選擇了「選擇...」選項，null 表示不指定資料夾。
	 * @returns {boolean} 是否顯示新版收藏視窗。
	 */
	shouldShowNewCollectWindow(folderID = null) {
		// 檢查應用程式是否支援擴充收藏視窗
		const isAppSupported = this.isAppSupportExtensionCollectWindow;
		const isUsingCollect = eagle.preference.usingCollect;

		if (folderID === null || folderID === "") {
			return isAppSupported && isUsingCollect;
		}

		if (folderID === "choose") {
			return isAppSupported;
		}

		return false;
	}

	#getOS() {
		const userAgent = navigator.userAgent;
		const isWindows = userAgent.indexOf("Win") !== -1;
		const isMac = userAgent.indexOf("Mac") !== -1;

		return {
			name: isWindows ? "Windows" : isMac ? "macOS" : "unknown",
			isWindows,
			isMac,
		};
	}

	#getBrowser() {
		const userAgent = navigator.userAgent;
		let name = "";
		let version = "";

		// 判斷Chrome
		if (/Chrome/.test(userAgent) && !/Edg/.test(userAgent)) {
			name = "chrome";
			version = userAgent.match(/Chrome\/(\d+)\./)?.[1] || "N/A";
		}
		// 判斷Firefox
		else if (/Firefox/.test(userAgent)) {
			name = "firefox";
			version = userAgent.match(/Firefox\/(\d+)\./)?.[1] || "N/A";
		}
		// 判斷Safari
		else if (/Safari/.test(userAgent) && !/Chrome/.test(userAgent)) {
			name = "safari";
			version = userAgent.match(/Version\/(\d+)\./)?.[1] || "N/A";
		}
		// 判斷Edge
		else if (/Edg/.test(userAgent)) {
			name = "edge";
			version = userAgent.match(/Edg\/(\d+)\./)?.[1] || "N/A";
		}
		// 判斷Chromium核心
		else if (/Chromium/.test(userAgent)) {
			name = "chromium";
			version = userAgent.match(/Chromium\/(\d+)\./)?.[1] || "N/A";
		}
		// 其它瀏覽器
		else {
			name = "unknown";
			version = "N/A";
		}

		name = name.toLowerCase();

		return {
			name,
			version: isNaN(parseInt(version)) ? version : parseInt(version),
			isFirefox: () => name === "firefox",
			isChrome: () => name === "chrome",
			isSafari: () => name === "safari",
		};
	}

	#getCanvas() {
		// 根據瀏覽器初始化 Canvas 限制
		let maxSide;
		let maxArea;

		switch (this.browser.name) {
		case "chrome":
		case "chromium":
		case "edge":
			if (this.browser.version <= 76) {
				maxSide = 32750;
				maxArea = 16384 * 16384;
			} else {
				maxSide = 65500;
				maxArea = 16384 * 16384;
			}
			break;
		case "firefox":
			maxSide = 32750;
			maxArea = 10836 * 10836;
			break;
		case "safari":
			if (this.browser.version >= 15) {
				maxSide = 20000;
				maxArea = 8196 * 8196;
			} else {
				maxSide = 16384;
				maxArea = 16384 * 16384;
			}
			break;
		default:
			maxSide = 32750;
			maxArea = 16384 * 16384;
			break;
		}

		return { maxSide, maxArea };
	}

	#getBrowserTheme() {
		if (this.isBackground() && !this.isPopup() && !this.isCollect()) {
			// MV3: 不支援直接在 background service worker 中存取 window.matchMedia
			throw new Error("Cannot access window.matchMedia in background service worker");
		} else {
			// content script 或 popup 都可以使用
			const isBrowserInDarkMode = window.matchMedia("(prefers-color-scheme: dark)").matches;
			return isBrowserInDarkMode ? "dark" : "light";
		}
	}

	async isReady() {
		return new Promise((resolve) => {
			(async () => {
				// 檢查與背景頁的連線
				if (!eagle.runtime.isAvailable) {
					eagle.dialog.showRuntimeUpdatedDialog();
					return resolve(false);
				}

				// 檢查Eagle是否開啟
				const isEagleOpen = await this.isEagleOpen();
				if (!isEagleOpen) {
					eagle.dialog.showEagleNotOpenedDialog();
					return resolve(false);
				}

				// 檢查隱私權政策 (Firefox)
				const isFirefox = eagle.env.browser.isFirefox();
				const isAgreePrivacyPolicy = eagle.preference.agreePrivacyPolicy || false;
				if (isFirefox && !isAgreePrivacyPolicy) {
					// 顯示隱私權政策
					eagle.dialog.showPrivacyPolicyDialog();
					return resolve(false);
				}

				// 通過
				return resolve(true);
			})();
		});
	}

	/**
	 * 檢查 Eagle 是否開啟 (同時會將版本資訊保存起來)
	 *
	 * @returns {Promise<boolean>} 回傳 Eagle 是否開啟
	 */
	async isEagleOpen() {
		// NOTE: 因為 Eagle 3.0 的 API 不會提供 showCollectModal，所以暫時要同時呼叫兩個 api 已取得這個資料，已確保 2.0 3.0 4.0 的用戶都能正常運作
		const results = await Promise.all([this.#fetchNewAPI(), this.#fetchOldAPI()]);

		this.appInfo = results[0] || results[1];

		if (this.appInfo) {
			return true;
		}

		return false;
	}

	async #fetchNewAPI() {
		try {
			// 檢查新版API
			let apiResponse = await eagle.fetch("http://localhost:41595", {
				timeout: 500,
			});

			// popup.js 在這裡有點神奇，他會先跑 background 進來這裡，然後再跑 foreground 進來這裡
			if (apiResponse.json) {
				apiResponse = apiResponse.json();
			}

			// 如果有取得新API buildVersion，就代表 Eagle 已經開啟
			if (apiResponse.data && apiResponse.data.version && apiResponse.data.buildVersion && apiResponse.data.platform && apiResponse.data.preferences) {
				// 順便把版本資訊存起來
				let appInfo = apiResponse.data;
				appInfo.buildVersion = parseInt(appInfo.buildVersion);
				appInfo.isVersion4 = true;

				return appInfo;
			}
		} catch (err) {
			eagle.logger.error("isEagleOpen error", err);
		}

		return false;
	}

	async #fetchOldAPI() {
		try {
			let oldApiResponse = await eagle.fetch("http://localhost:41593", {
				timeout: 500,
			});

			if (oldApiResponse.json) {
				oldApiResponse = oldApiResponse.json();
			}

			if (oldApiResponse) {
				let appInfo = {
					showCollectModal: oldApiResponse.showCollectModal,
				};

				return appInfo;
			}
		} catch (err) {
			eagle.logger.error("isEagleOpen error", err);
		}

		return false;
	}

	async isDOMReady() {
		return new Promise((resolve, reject) => {
			$(document).ready(() => {
				resolve();
			});
		});
	}

	/**
	 * 判斷是否在 background
	 *
	 * 本函數支援 Manifest V2 和 Manifest V3 及跨瀏覽器（Chrome, Firefox, Safari）上運作
	 * @returns {boolean} 是否在 background
	 */
	isBackground() {
		const isBrowserAPI = typeof browser !== "undefined" && typeof browser.runtime !== "undefined";
		if (isBrowserAPI) {
			// Firefox & Safari 瀏覽器
			const isBackgroundForOldVersion = browser && browser.runtime && browser.runtime.getBackgroundPage && browser.runtime.getBackgroundPage() === window;
			const isBackgroundForCurrentVersion = typeof browser?.runtime?.getBackgroundPage === "function";
			return isBackgroundForCurrentVersion || isBackgroundForOldVersion;
		} else {
			// Chrome 瀏覽器
			const isBackgroundForChromeManifest2 = typeof chrome?.runtime?.getBackgroundPage === "function";
			const isBackgroundForChromeManifest3 = chrome.tabs !== undefined;
			const isBackgroundForChromeOldVersion = chrome && chrome.extension && chrome.extension.getBackgroundPage && chrome.extension.getBackgroundPage() === window;

			return isBackgroundForChromeManifest2 || isBackgroundForChromeManifest3 || isBackgroundForChromeOldVersion;
		}
	}

	isPopup() {
		// NOTE: popup 的特徵是有 background 和 window 物件和 popup.html 的網址
		const isPopupPage = location.href.includes("popup.html");

		return this.isBackground() && isPopupPage;
	}

	isCollect() {
		const isCollectPage = location.href.includes("collect-window");

		return this.isBackground() && isCollectPage;
	}
}

eagle.env = new Environment();
