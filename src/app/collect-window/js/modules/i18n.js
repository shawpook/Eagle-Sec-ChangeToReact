angular
	.module("i18n", [])
	.filter("i18n", [
		"i18nService", (i18nService) => {
			let filter = function (input) {
				if (!i18nService.isLoaded()) {
					return input;
				}

				let i18nData = i18nService.getI18nData();

				return i18nData[input] || input;
			};

			filter.$stateful = true;

			return filter;
		},
	])
	.factory("i18nService", [
		"$rootScope", "$http", ($rootScope, $http) => {
			let localeData = {};
			let isLoaded = false;

			return {
				initLocale: async function (locale) {
					let response = await $http.get(`locales/${locale}.json`);
					localeData = await response.data;
					isLoaded = true;
					$rootScope.$evalAsync();
				},

				getLocales: function () {
					return {
						"zh-CN": "简体中文",
						"zh-TW": "繁體中文",
						en: "English",
						es: "Español",
						de: "Deutsch",
						ru: "Русский",
						ja: "日本語",
						ko: "한국어",
					};
				},

				getI18nData: function () {
					return localeData;
				},
				isLoaded: function () {
					return isLoaded;
				},
			};
		},
	]);
