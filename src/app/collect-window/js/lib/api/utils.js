class Utils {
	throttle(
		fn, delay, immediate, debounce
	) {
		var curr = +new Date(),
			last_call = 0,
			last_exec = 0,
			timer = null,
			diff,
			context,
			args,
			exec = function () {
				last_exec = curr;
				fn.apply(context, args);
			};
		return function () {
			curr = +new Date();
			(context = this), (args = arguments), (diff = curr - (debounce ? last_call : last_exec) - delay);
			clearTimeout(timer);
			if (debounce) {
				if (immediate) {
					timer = setTimeout(exec, delay);
				} else if (diff >= 0) {
					exec();
				}
			} else {
				if (diff >= 0) {
					exec();
				} else if (immediate) {
					timer = setTimeout(exec, -diff);
				}
			}
			last_call = curr;
		};
	}

	debounce(func, wait, immediate) {
		var timeout;
		return function () {
			var context = this,
				args = arguments;
			var later = function () {
				timeout = null;
				if (!immediate) func.apply(context, args);
			};
			var callNow = immediate && !timeout;
			clearTimeout(timeout);
			timeout = setTimeout(later, wait);
			if (callNow) func.apply(context, args);
		};
	}

	clearWeirdCharacters(str) {
		if (str == undefined) return "";

		const emojiRegexPlus = /(?![*#0-9]+)[\p{Emoji}\p{Emoji_Modifier}\p{Emoji_Component}\p{Emoji_Modifier_Base}\p{Emoji_Presentation}]/gu;
		const emojiRegex = /\p{Emoji_Presentation}|\p{Extended_Pictographic}|([0-9]\u{FE0F}\u{20E3})|([*#\u{1F51F}]\u{FE0F}\u{20E3})/gmu; // NOTE: 這行好像刪得不夠乾淨
		const specialCharRegex = /[#$%^&*()<>:'"/\\|?*]+/g;

		// 移除開頭的連續 "."、emoji、特殊字元
		return str.replace(/^\.+/, "").replace(emojiRegexPlus, "").replace(specialCharRegex, "").replace(emojiRegex, "").replace("\uD83D", "").replace("\uFE0F", "");
	}

	isValidUrl(url) {
		return /^(?:(?:https?|ftp):\/\/)?(?:(?!(?:10|127)(?:\.\d{1,3}){3})(?!(?:169\.254|192\.168)(?:\.\d{1,3}){2})(?!172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})(?:[1-9]\d?|1\d\d|2[01]\d|22[0-3])(?:\.(?:1?\d{1,2}|2[0-4]\d|25[0-5])){2}(?:\.(?:[1-9]\d?|1\d\d|2[0-4]\d|25[0-4]))|(?:(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)(?:\.(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)*(?:\.(?:[a-z\u00a1-\uffff]{2,})))(?::\d{2,5})?(?:\/\S*)?$/i.test(url);
	}

	absolutePath(href) {
		if (!href) return;
		// 有些网址可能是 "url 1.5x" 这样的格式，需避免
		if (href && href.indexOf(" ") > -1) {
			href = href.trim().split(" ")[0];
		}
		var link = document.createElement("a");
		link.href = href;
		return link.href;
	}

	urlToBase64(url, timeout = 700) {
		return new Promise((resolve) => {
			if (url.startsWith("//")) {
				url = "https:" + url;
			}

			let xhr = new XMLHttpRequest();
			let sent = false;
			let isVideo = url.toLowerCase().indexOf(".mp4") > -1 || url.toLowerCase().indexOf(".webm") > -1;
			let isGIF = url.toLowerCase().indexOf(".gif") > -1;

			if (isGIF) {
				timeout = 1200;
			}

			if (isVideo) {
				resolve(undefined);
				return;
			}

			xhr.onload = function () {
				clearTimeout(timeout);
				let reader = new FileReader();
				reader.onloadend = function () {
					if (!sent) {
						sent = true;
						if (reader.result.indexOf("data:image") > -1) {
							resolve(reader.result);
						} else {
							resolve(undefined);
						}
					}
				};
				reader.readAsDataURL(xhr.response);
			};
			xhr.open("GET", url);
			xhr.responseType = "blob";
			xhr.send();

			timeout = setTimeout(() => {
				// timeout, abort both the call and the timeout
				if (!sent) {
					sent = true;
					xhr.abort();
					resolve(undefined);
				}
			}, timeout);
		});
	}

	deepUnique(array) {
		return array.sort().filter((element, index) => {
			return JSON.stringify(element) !== JSON.stringify(array[index - 1]);
		});
	}

	imageLoaded(img) {
		return new Promise((resolve) => {
			if (img.complete) {
				resolve(true);
			} else {
				img.addEventListener("load", () => {
					resolve(true);
				});
				img.addEventListener("error", () => {
					resolve(false);
				});
			}
		});
	}

	getElementDimensions(element) {
		let result = {
			width: 0,
			height: 0,
		};

		const tagName = element?.tagName?.toLowerCase();

		if (!tagName) {
			return result;
		}

		if (tagName === "video") {
			result = {
				width: element.videoWidth || element.width,
				height: element.videoHeight || element.height,
			};
		} else if (tagName === "svg" || tagName === "audio") {
			result = {
				width: element.clientWidth,
				height: element.clientHeight,
			};
		} else {
			result = {
				width: element.naturalWidth || element.width,
				height: element.naturalHeight || element.height,
			};
		}

		result.width = parseInt(result.width);
		result.height = parseInt(result.height);

		return result;
	}

	getURLDimensions(url) {
		return new Promise((resolve) => {
			const img = new Image();
			img.src = url;
			img.onload = () => {
				resolve({
					width: img.width,
					height: img.height,
				});
			};
			img.onerror = () => {
				resolve({
					width: 0,
					height: 0,
				});
			};
		});
	}

	/**
	 * @typedef {Object} resizeResultObject
	 * @property {string} base64 - 輸出的 base64 編碼圖片
	 * @property {number} width - 輸出的圖片寬度
	 * @property {number} height - 輸出的圖片高度
	 */

	/**
	 * 將 base64 編碼的圖片大小調整為不超過最大尺寸，同時保持其長寬比。
	 *
	 * @param {string} dataURI - 要調整大小的 base64 編碼圖片。
	 * @param {number} [maxSize=720] - 調整後圖片的最大寬度或高度（像素）。如果未指定，默認為 720。
	 * @returns {Promise<resizeResultObject|null>} - 返回一個 Promise，當調整成功時，將返回一個 resizeResultObject；當調整失敗時，將返回 null。
	 * @async
	 * @example
	 * // 使用示例：
	 * resizeBase64ImageToMaxSize('data:image/png;base64,iVBORw0KGgo...', 500)
	 *   .then(resizedImage => {
	 *     console.log(resizedImage);
	 *   })
	 *   .catch(error => {
	 *     console.error(error);
	 *   });
	 */
	async resizeBase64ImageToMaxSize(dataURI, maxSize = 720) {
		return new Promise((resolve) => {
			let image = new Image();
			image.onload = function () {
				const canvas = document.createElement("canvas");

				if (image.width > maxSize) {
					canvas.width = maxSize;
					canvas.height = parseInt((maxSize * image.height) / image.width);
				} else {
					canvas.width = image.width;
					canvas.height = image.height;
				}

				const ctx = canvas.getContext("2d");
				ctx.drawImage(
					image, 0, 0, canvas.width, canvas.height
				);

				const base64 = canvas.toDataURL();

				eagle.logger.info(`saveURL, base64[${base64.length}]`);

				resolve({
					width: canvas.width,
					height: canvas.height,
					base64: base64,
				});
			};

			image.onerror = () => {
				resolve();
			};

			image.src = dataURI;
		});
	}

	async sleep(time) {
		return new Promise((resolve) => {
			setTimeout(() => {
				resolve();
			}, time);
		});
	}

	deepClone(obj) {
		return JSON.parse(JSON.stringify(obj));
	}

	/**
	 * 判斷元素的媒體類型，返回 "video"、"audio" 或 "image"
	 * @param {HTMLElement} element - 要判斷的元素。
	 * @returns {string} - 返回元素的媒體類型
	 */
	determineMediaType(element) {
		const tagName = element.tagName.toLowerCase();

		if (tagName === "video" || tagName === "audio") {
			return tagName;
		}

		return "image";
	}
}

eagle.utils = new Utils();

class TreeUtil {
	walk(
		tree, property, callback, parentNode = null, depth = 0
	) {
		if (tree === undefined) tree = [];

		// 如果 tree 是一個數組，則對其每個元素進行遍歷
		if (Array.isArray(tree)) {
			for (let i = 0; i < tree.length; i++) {
				this.walk(
					tree[i], property, callback, parentNode, depth
				);
			}
		}
		// 如果 tree 是一個物件，則調用 callback 並遍歷其子節點
		else {
			callback(tree, parentNode, depth);
			if (tree[property]) {
				this.walk(
					tree[property], property, callback, tree, depth + 1
				);
			}
		}
	}

	depth(tree, property) {
		let maxDepth = 0;

		this.walk(tree, property, (node, parentNode, depth) => {
			if (depth > maxDepth) {
				maxDepth = depth;
			}
		});

		return maxDepth;
	}
}

eagle.utils.tree = new TreeUtil();

class URLUtil {
	isSameHost(url1, url2) {
		return new URL(url1).host === new URL(url2).host;
	}

	isSameRootDomain(url1, url2) {
		// NOTE: 這個作法無法判斷 xxx.com.tw  xxx.com xxx.com.cn
		return this.getRootDomain(url1) === this.getRootDomain(url2);
	}

	getRootDomain(url) {
		return new URL(url).host.split(".").slice(-2).join(".");
	}
}

eagle.utils.url = new URLUtil();
