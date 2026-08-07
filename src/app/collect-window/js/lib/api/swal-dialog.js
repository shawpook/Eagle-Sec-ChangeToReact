class SwalDialog {
	#dialogWrapperID = "eagle-swal-dialog-wrapper";
	#dialogIframeID = "eagle-extension-dialog-window";

	async open({ icon = "", title, description = "", inputType, inputPlaceholder, inputValue, confirmButtonText, cancelButtonText, onConfirm, onCancel, showCancelButton }) {
		onConfirm = onConfirm || async function () {};
		onCancel = onCancel || async function () {};

		const iframe = document.createElement("iframe");
		iframe.src = eagle.extension.path + "dialog/index.html";
		iframe.id = this.#dialogIframeID;
		document.body.appendChild(iframe);

		if (icon) {
			icon = eagle.extension.path + icon;
		}

		let options = {
			html: `
				<div class="alert">
					<img class="alert-icon" src="${icon}"></img>
					<h4 class="alert-title">${title}</h4>
					<p class="alert-desc">${description}</p>
				</div>
			`,
			customClass: "alert-box",
			showCloseButton: false,
			allowOutsideClick: true,
			focusConfirm: true,
			focusCancel: false,
			padding: 24,
			target: `#${this.#dialogWrapperID}`,
			theme: eagle.preference.displayTheme,
		};

		if (typeof showCancelButton != "undefined") {
			options.showCancelButton = showCancelButton;
		}

		if (typeof confirmButtonText != "undefined") {
			options.showConfirmButton = true;
			options.confirmButtonText = confirmButtonText;
		}

		if (typeof cancelButtonText != "undefined") {
			options.showCancelButton = true;
			options.cancelButtonText = cancelButtonText;
		}

		if (inputType) {
			options.inputValue = inputValue;
			options.inputPlaceholder = inputPlaceholder;
			options.input = inputType;
		}

		await this.waitIframeReady(iframe);

		iframe.contentWindow.postMessage({ channel: "swal-open", options }, "*");

		function selfRemove() {
			iframe.remove();
			window.removeEventListener("message", listener);
		}

		const closeDialog = () => {
			setTimeout(() => {
				selfRemove();
			}, 200);
		};

		// listen for messages from the iframe
		let listener = window.addEventListener("message", async (event) => {
			// 如果 iframe 不存在，就不處理
			if (!iframe) {
				return;
			}

			// 這個訊息不是由使用者代理所創建的
			if (event.isTrusted === false) {
				return;
			}

			// 這個訊息不是由 iframe 所傳送的 (例如別人家的事件)
			if (event.source !== iframe.contentWindow) {
				return;
			}

			// 沒有 channel 的話，就不處理
			if (!event.data.channel) {
				return;
			}

			const channel = event.data.channel;

			if (channel === "swal-confirm") {
				onConfirm.constructor.name === "AsyncFunction" ? await onConfirm(event.data.result) : onConfirm(event.data.result);
				closeDialog();
			}

			if (channel === "swal-cancel") {
				onCancel.constructor.name === "AsyncFunction" ? await onCancel() : onCancel();
				closeDialog();
			}
		});
	}

	close() {
		const iframe = document.getElementById(this.#dialogIframeID);
		if (iframe) iframe.remove();
	}

	/**
	 * 等待 iframe 載入完成
	 * @returns {Promise}
	 */
	async waitIframeReady(iframe) {
		return new Promise((resolve) => {
			let listener = window.addEventListener("message", (event) => {
				if (event.data === "dialog-iframe-ready" && event.source === iframe.contentWindow) {
					resolve();
					window.removeEventListener("message", listener);
				}
			});
		});
	}

	showCreateFolderDialog(inputValue) {
		return new Promise((resolve) => {
			this.open({
				title: eagle.i18n.words["collect-window.folder-select-panel.create-dialog.title"],
				icon: "images/default_icon.png",
				confirmButtonText: eagle.i18n.words["collect-window.folder-select-panel.create-dialog.confirm"],
				cancelButtonText: eagle.i18n.words["collect-window.folder-select-panel.create-dialog.cancel"],
				inputType: "text",
				inputValue: inputValue,
				inputPlaceholder: eagle.i18n.words["collect-window.folder-select-panel.create-dialog.placeholder"],
				onConfirm: (result) => {
					resolve(result);
				},
				onCancel: () => {
					resolve(null);
				},
			});
		});
	}

	/**
	 * 顯示「有多個Eagle 擴充功能」同時運行的提示
	 */
	showMultipleEagleExtensionRunningDialog() {
		const dialogIcon = `images/${eagle.preference.displayTheme}/eagle-not-opened.png`;

		this.open({
			icon: dialogIcon,
			title: eagle.i18n.words["dialog.multiple-extensions-running.title"],
			description: eagle.i18n.words["dialog.multiple-extensions-running.desc"],
			confirmButtonText: eagle.i18n.words["dialog.multiple-extensions-running.confirm"],
			showCancelButton: false,
			onConfirm: () => {
				eagle.tabs.create({ url: "chrome://extensions" });
			},
		});
	}

	/**
	 * 顯示 Eagle 尚未開啟的提示
	 * @description 這個提示會在 Eagle 尚未開啟時顯示
	 * @returns {void}
	 */
	showEagleNotOpenedDialog() {
		const dialogIcon = `images/${eagle.preference.displayTheme}/eagle-not-opened.png`;

		this.open({
			icon: dialogIcon,
			title: eagle.i18n.words["dialog.not-opened-title"],
			description: eagle.i18n.words["dialog.not-opened-desc"],
			confirmButtonText: eagle.i18n.words["dialog.not-opened-confirm"],
			cancelButtonText: eagle.i18n.words["dialog.not-opened-cancel"],
			onConfirm: () => {
				$("#open-eagle-iframe").remove();

				let iframe = document.createElement("iframe");
				iframe.id = "open-eagle-iframe";
				iframe.src = "eagle://open";
				iframe.name = "frame";

				$(iframe).css({
					h: 0,
					w: 0,
					opacity: 0,
				});

				$("body").append(iframe);

				setTimeout(() => {
					window.jQuery("#open-eagle-iframe").remove();
				}, 2000);
			},
		});
	}

	/**
	 * 顯示 Eagle 背景更新提示
	 * @description 這個提示會在 Eagle 背景更新時顯示
	 * @returns {void}
	 */
	showRuntimeUpdatedDialog() {
		const dialogIcon = `images/${eagle.preference.displayTheme}/eagle-not-opened.png`;

		this.open({
			icon: dialogIcon,
			title: eagle.i18n.words["dialog.updated-title"],
			description: eagle.i18n.words["dialog.updated-desc"],
			confirmButtonText: eagle.i18n.words["dialog.updated-confirm"],
			cancelButtonText: eagle.i18n.words["dialog.updated-cancel"],
			onConfirm: () => {
				// 重新整理頁面
				location.reload();
			},
		});
	}

	/**
	 * 顯示隱私權政策 (Firefox only)
	 * @description 這個提示會顯示隱私權政策
	 * @returns {void}
	 */
	showPrivacyPolicyDialog() {
		const dialogIcon = `images/${eagle.preference.displayTheme}/eagle-not-opened.png`;

		this.open({
			icon: dialogIcon,
			title: eagle.i18n.words["dialog.privacy-policy-title"],
			description: eagle.i18n.words["dialog.privacy-policy-desc"],
			confirmButtonText: eagle.i18n.words["dialog.privacy-policy-confirm"],
			cancelButtonText: eagle.i18n.words["dialog.privacy-policy-cancel"],
			onConfirm: () => {
				// 更新偏好設定
				eagle.preference.agreePrivacyPolicy = true;
				eagle.preference.save();

				// 重新整理頁面
				location.reload();
			},
		});
	}

	showBoardSaverKeepWaitingDialog({ onConfirm, onCancel }) {
		const dialogIcon = `images/${eagle.preference.displayTheme}/eagle-not-opened.png`;

		this.open({
			icon: dialogIcon,
			title: eagle.i18n.words["dialog.board-saver-keep-waiting.title"],
			description: eagle.i18n.words["dialog.board-saver-keep-waiting.desc"],
			confirmButtonText: eagle.i18n.words["dialog.board-saver-keep-waiting.confirm"],
			cancelButtonText: eagle.i18n.words["dialog.board-saver-keep-waiting.cancel"],
			showCancelButton: true,
			onConfirm: onConfirm,
			onCancel: onCancel,
		});
	}
}

eagle.dialog = new SwalDialog();
