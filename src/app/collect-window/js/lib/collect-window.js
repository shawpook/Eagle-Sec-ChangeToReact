class CollectPreviewerSize {
	constructor(width, height) {
		// preview 區域的最大寬高
		const MAX_PREVIEW_WIDTH = CollectWindow.MAX_PREVIEW_WIDTH;

		let result = {
			width: 0,
			height: 0,
		};

		if (width > 0 && height > 0) {
			// 確保輸入的寬度和高度是有效的
			let ratio = width / height;

			if (ratio >= 1) {
				// 當圖片是橫向或正方形時
				result.width = MAX_PREVIEW_WIDTH;
				result.height = MAX_PREVIEW_WIDTH / ratio;
			} else {
				// 當圖片是縱向時
				result.width = MAX_PREVIEW_WIDTH * ratio;
				result.height = MAX_PREVIEW_WIDTH;
			}
		} else {
			// 如果輸入的寬度或高度無效，則將預覽尺寸設定為預設最大寬度
			result.width = result.height = MAX_PREVIEW_WIDTH;
		}

		return result;
	}
}

class CollectWindowIframe {
	iframe;
	isReady = false;

	constructor(params) {
		const { width, height } = params;

		// 深拷貝但是不要拷貝函數
		this.meta = JSON.parse(JSON.stringify(params));

		this.meta.previewerSize = new CollectPreviewerSize(width, height);

		const $iframe = jQuery(`<iframe id="eagle-extension-collect-window" src="${eagle.extension.path}collect-window/index.html"></iframe>`);
		$iframe.appendTo("body");

		this.iframe = $iframe[0];

		// 消除畫面的捲軸，同時防止背景捲動
		document.body.classList.add("eagle-show-collect-window");

		this.isReady = false;
		this.#setupReadyListener();

		return this;
	}

	#setupReadyListener() {
		let listener = window.addEventListener("message", (event) => {
			if (event.source === this.iframe.contentWindow && event.data.channel === "iframe-ready") {
				this.isReady = true;
				window.removeEventListener("message", listener);
			}
		});
	}

	sendMessage(message) {
		this.iframe.contentWindow.postMessage(message, "*");
	}

	#sendMeta() {
		this.sendMessage({ channel: "preview-meta", ...this.meta });
	}

	async loaded() {
		if (this.isReady) return Promise.resolve();
		return new Promise((resolve) => {
			const checkLoad = () => {
				if (this.isReady) {
					this.#sendMeta();
					resolve();
				} else {
					setTimeout(checkLoad, 100);
				}
			};
			checkLoad();
		});
	}

	remove() {
		document.body.removeChild(this.iframe);
		document.body.classList.remove("eagle-show-collect-window");
	}
}

class CollectWindowPreviewer {
	mainContainer;
	previewContainer;
	previewBox;
	resolutionDiv;

	constructor(params) {
		const { type, src, width, height } = params;
		const originalResolution = { width, height };
		const previewerSize = new CollectPreviewerSize(width, height);
		const previewerElementTag = type === "image" || type === "save-url" ? "img" : type;

		this.mainContainer = document.createElement("div");
		this.mainContainer.id = "eagle-extension-collect-preview";
		this.mainContainer.setAttribute("eagle-extension-locale", eagle.preference.getPreferredLocale());
		this.mainContainer.setAttribute("eagle-extension", "");
		this.mainContainer.setAttribute("translate", "no");
		this.mainContainer.style.display = "flex";
		this.mainContainer.style.opacity = 0;

		// 根據原始元素建立預覽元素
		this.previewContainer = document.createElement("div");
		this.previewContainer.id = "eagle-extension-collect-preview-container";

		this.previewBox = document.createElement("div");
		this.previewBox.id = "eagle-extension-collect-preview-box";

		// 把原始元素的 src 複製到預覽圖上
		let previewer = document.createElement(previewerElementTag);
		previewer.style.width = `${previewerSize.width}px`;
		previewer.style.height = `${previewerSize.height}px`;
		previewer.style.aspectRatio = `${previewerSize.width} / ${previewerSize.height}`;

		// 如果是影片，就要特別處理
		if (previewerElementTag === "video") {
			previewer.autoplay = true;
			previewer.muted = true;
			previewer.loop = true;
			previewer.src = src;
		}

		if (previewerElementTag === "audio") {
			previewer.controls = true;
			previewer.autoplay = false;

			let source = document.createElement("source");
			source.src = src;
			previewer.appendChild(source);
		}

		if (previewerElementTag === "img") {
			previewer.src = src;
		}

		this.previewBox.appendChild(previewer);

		this.previewContainer.appendChild(this.previewBox);

		if (previewerElementTag !== "audio") {
			this.resolutionDiv = document.createElement("div");
			this.resolutionDiv.classList.add("resolution");
			this.resolutionDiv.style.display = "none";
			this.previewBox.appendChild(this.resolutionDiv);
		}

		this.mainContainer.appendChild(this.previewContainer);
		document.body.appendChild(this.mainContainer);

		return this;
	}

	setResolution(width, height) {
		this.resolutionDiv.textContent = `${width}×${height}`;
		this.resolutionDiv.style.display = "flex";
	}

	setPreviewContainerSize({ depth }) {
		this.previewContainer.removeAttribute("class");

		this.previewContainer.classList.add(`depth-${depth}`);
	}

	show() {
		this.mainContainer.style.opacity = 1;
	}

	remove() {
		document.body.removeChild(this.mainContainer);
	}
}

/**
 * @typedef {Object} CollectWindowResult
 * @property {string} title - The name of the collect item.
 * @property {string[]} tags - The tags associated with the collect item.
 * @property {string} annotation 收藏項目的註解或描述
 * @property {string[]} folderIDs - The folder IDs of the collect item.
 * @property {number} [star] - The star rating of the collect item.
 */

class CollectWindow {
	collectWindowIframe;
	collectWindowPreviewer;
	listener;
	static MAX_PREVIEW_WIDTH = 207; // 預覽圖的最大寬度

	constructor() {
		this.collectWindowIframe = null;
		this.collectWindowPreviewer = null;
		// this.#registerEventListener();
	}

	/**
	 * 開啟收藏視窗
	 * 此函數異步執行，用於根據提供的參數開啟一個收藏視窗，並返回收藏的相關資訊
	 *
	 * @async
	 * @param {object} options 包含開啟收藏視窗所需的所有選項
	 * @param {string} options.type 收藏項目的類型
	 * @param {number} options.width 視窗的寬度
	 * @param {number} options.height 視窗的高度
	 * @param {string} options.src 收藏項目的來源或連結
	 * @param {string} options.title 收藏項目的標題
	 * @param {string} options.annotation 收藏項目的註解或描述
	 * @param {Array<string>} options.tags 與收藏項目相關的標籤列表
	 * @returns {Promise<CollectWindowResult>} 一個 Promise 物件，解析時返回一個物件。
	 */
	async open(params) {
		if (this.collectWindowIframe) {
			return;
		}

		this.collectWindowIframe = new CollectWindowIframe(params);
		this.collectWindowPreviewer = new CollectWindowPreviewer(params);

		// 等待 iframe 載入完成後，傳送訊息
		await this.collectWindowIframe.loaded();

		// NOTE: Safari 會發神經，他沒有幫我自動 focus 到 iframe 上
		this.collectWindowIframe.iframe.focus();

		// 延遲 200ms，讓預覽圖淡入
		setTimeout(() => {
			this.collectWindowPreviewer.show();
		}, 200);

		// 等待使用者收藏完畢
		this.#waitForCollectItem()
			// 當用戶收藏完畢後
			.then((data) => {
				params.onCollect && params.onCollect(data);
			})
			// 當用戶取消收藏時
			.catch(() => {
				params.onCancel && params.onCancel();
			});
	}

	/**
	 * 關閉收藏視窗
	 * @returns {void}
	 */
	close() {
		if (this.collectWindowIframe) this.collectWindowIframe.remove();
		if (this.collectWindowPreviewer) this.collectWindowPreviewer.remove();

		this.collectWindowIframe = null;
		this.collectWindowPreviewer = null;

		if (this.listener) {
			// 反註冊事件
			window.removeEventListener("message", this.listener);
		}
	}

	#waitForCollectItem() {
		return new Promise((resolve, reject) => {
			this.listener = window.addEventListener("message", (event) => {
				if (event.data.channel === "collect-item") {
					const data = event.data.result;

					if (data.folderID) {
						// TODO: 把使用這個方法的人都抓出來
						throw new Error("choose");
					}

					if (eagle.env.shouldShowNewCollectWindow()) {
						data.forceOpenCollectModal = undefined;
						data.forceHideCollectModal = true;
					}

					resolve(data);

					// 反註冊事件
					window.removeEventListener("message", this.listener);

					// 把自己從 DOM 上移除
					this.close();
				} else if (event.data.channel === "iframe-closed") {
					reject();

					this.close();
				}
			});
		});
	}

	/**
	 * 註冊事件監聽器
	 * @returns {void}
	 */
	#registerEventListener() {
		window.addEventListener("message", async (event) => {
			// 如果 iframe 不存在，就不處理
			if (!this.collectWindowIframe) {
				return;
			}

			// 這個訊息不是由使用者代理所創建的
			if (event.isTrusted === false) {
				return;
			}

			// 這個訊息不是由 iframe 所傳送的 (例如別人家的事件)
			if (event.source !== this.collectWindowIframe.iframe.contentWindow) {
				return;
			}

			// 沒有 channel 的話，就不處理
			if (!event.data.channel) {
				return;
			}

			const channel = event.data.channel;

			if (channel === "open-create-folder-dialog") {
				// NOTE: Firefox 有病，他會靠邀這個來源違反 cross-origin
				// Error: Not allowed to define cross-origin object as property on [Object] or [Array] XrayWrapper

				// 用戶要收藏的資訊
				const collectItem = eagle.utils.deepClone(event.data.collectItem);

				// 用戶當前選擇的資料夾
				const selectedFolder = event.data.item;

				const inputFolderName = await eagle.dialog.showCreateFolderDialog(selectedFolder.name?.trim());

				if (inputFolderName == null) {
					this.collectWindowIframe.sendMessage({ channel: "cancel-create-folder-dialog" });
				} else {
					if (inputFolderName.trim() == "") {
						alert("please input folder name");
						return;
					}

					const folder = await eagle.folder.create(inputFolderName);
					collectItem.folderIDs = [folder.id];

					window.postMessage({ channel: "collect-item", result: collectItem });

					this.close();
				}
			}

			if (channel == "update-previewer-position") {
				const { depth } = event.data;
				console.log("received update-previewer-position", depth);

				this.collectWindowPreviewer.setPreviewContainerSize({ depth });
			}
		});
	}

	updateTheme() {
		if (this.collectWindowIframe) {
			this.collectWindowIframe.contentWindow.postMessage({ channel: "update-theme" }, "*");
		}
	}

	updateResolution(width, height) {
		if (this.collectWindowPreviewer && width > 0 && height > 0) {
			this.collectWindowPreviewer.setResolution(width, height);
		}
	}
}

// NOTE: 限定 content 使用
eagle.collectWindow = new CollectWindow();
