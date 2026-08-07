var RecentFileManager = {
	libraryName: "",
	recentFiles: [],
	recentFilesOrder: {},
	maxHistory: 5000,
	init: function (libraryName) {
		RecentFileManager.libraryName = libraryName;
		let json = localStorage[`eagle.recentFiles.${RecentFileManager.libraryName}`];
		if (json) {
			try {
				RecentFileManager.recentFiles = JSON.parse(json);
				RecentFileManager.calOrders();
			}
			catch (err) {
				RecentFileManager.recentFiles = [];
			}
		}
	},
	calOrders: function () {
		try {
			for (var i = 0; i < RecentFileManager.recentFiles.length; i++) {
				let itemId = RecentFileManager.recentFiles[i];
				RecentFileManager.recentFilesOrder[itemId] = i+1;
			}
		}
		catch (err) {}
	},
	isExists: function (item) {
		if (!item || !item.id) return false;
		return RecentFileManager.recentFilesOrder[item.id];
	},
	addFile: function (item) {
		try {
			if (!RecentFileManager.libraryName) {
				console.error("RecentFileManager.libraryName is empty");
				return;
			}
			if (!item || !item.id) return;
			RecentFileManager.recentFiles.unshift(item.id);
			RecentFileManager.calOrders();
			RecentFileManager.save();
		}
		catch (err) {}
	},
	addFiles: function (items) {
		try {
			if (!RecentFileManager.libraryName) {
				console.error("RecentFileManager.libraryName is empty");
				return;
			}
			if (!items) return;
			if (items.length >= 20) return;
			items.reverse().forEach(function (item) {
				if (!item || !item.id) return;
				RecentFileManager.recentFiles.unshift(item.id);
				RecentFileManager.calOrders();
			});
			RecentFileManager.save();
		}
		catch (err) {}
	},
	clean: function () {
		RecentFileManager.recentFiles = [];
		RecentFileManager.recentFilesOrder = {};
		RecentFileManager.save();
	},
	save: throttle(function () {
		try {
			if (!RecentFileManager.libraryName) {
				console.error("RecentFileManager.libraryName is empty");
				return;
			}
			// 最多保存 5000 個
			RecentFileManager.recentFiles = [...new Set(RecentFileManager.recentFiles)];
			if (RecentFileManager.recentFiles.length > RecentFileManager.maxHistory) {
				RecentFileManager.recentFiles.length = RecentFileManager.maxHistory;
			}
			let json = JSON.stringify(RecentFileManager.recentFiles);
			localStorage[`eagle.recentFiles.${RecentFileManager.libraryName}`] = json;
		}
		catch (err) {}
	}, 1000, true)
};