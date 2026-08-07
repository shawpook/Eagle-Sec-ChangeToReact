class Library {
	async info() {
		let result = await eagle.fetch("http://localhost:41595/api/library/info", {
			redirect: "manual",
		});

		if (result.isRedirect) {
			isRedirect = true;
			eagle.logger.info("[background] getRecentFolders, fail. localhost get redirect");
		}

		result.data.library.path = this.normalizePath(result.data.library.path);

		return result.data;
	}

	async history() {
		let result = await eagle.fetch("http://localhost:41595/api/library/history", {
			redirect: "manual",
		});

		if (result.isRedirect) {
			isRedirect = true;
			eagle.logger.info("[background] get folder list, fail. localhost get redirect");
		}

		return [...new Set(result.data.map((path) => this.normalizePath(path)))];
	}

	async switch(libraryPath) {
		const requestOptions = {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				libraryPath: libraryPath,
			}),
		};

		const result = await eagle.fetch("http://localhost:41595/api/library/switch", requestOptions);

		return result.status;
	}

	/**
	 * 清理檔案路徑格式
	 * 將 Windows 格式的路徑轉換為 macOS 格式，並統一處理特定的路徑結尾問題。
	 * @param {string} filePath 原始檔案路徑
	 * @return {string} 處理後的檔案路徑
	 */
	normalizePath(filePath) {
		// 檢查路徑是否為 Windows 格式（包含 ":\", 如 C:\）
		const isWindowsPath = filePath.includes(":\\");
		let convertedPath = filePath;

		if (isWindowsPath) {
			// 將 Windows 路徑分隔符號轉換為 macOS/Linux 格式
			convertedPath = convertedPath.replace(/\\/g, "/");
		}

		// 移除路徑結尾的 ".library/"（如果存在）
		if (convertedPath.endsWith(".library/")) {
			convertedPath = convertedPath.slice(0, -1);
		}

		return convertedPath;
	}

	switchPromise(libraryPath) {
		return new Promise(async (resolve, reject) => {
			const TIMEOUT = 10 * 1000;

			let checkTimer, timeoutTimer;

			const clearTimers = () => {
				clearInterval(checkTimer);
				clearTimeout(timeoutTimer);
			};

			checkTimer = setInterval(async () => {
				try {
					const currentLibrary = await this.info();
					if (currentLibrary.library.path === libraryPath) {
						clearTimers();
						resolve();
					}
				} catch (error) {
					clearTimers();
					console.error(error);
					reject();
				}
			}, 200);

			timeoutTimer = setTimeout(() => {
				clearTimers();
				console.log("timeout");
				reject();
			}, TIMEOUT);

			try {
				const status = await this.switch(libraryPath);
				if (status == "error") {
					clearTimers();
					reject();
				}
			} catch (error) {
				clearTimers();
				console.error(error);
				reject();
			}
		});
	}
}

eagle.library = new Library();
