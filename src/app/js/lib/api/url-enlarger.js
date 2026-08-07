globalThis.URLEnlarger = class {
	// NOTE: 為了避免每次都需檢查大圖網址是否損壞，浪費時間，所以在第一次檢查後，就會將檢查結果記錄下來
	#ruleValidMap = {};
	rules = [
		{
			site: "Reddit",
			srcPattern: "https://preview.redd.it/(.*)",
			replace: (src) => {
				const pureURL = src.split("?")[0];
				return pureURL.replace("preview.redd.it", "i.redd.it");
			},
		},
		{
			site: "deviantArt",
			srcPattern: /https:\/\/images\S+\.wixmp\.com\/f\/\S+\/v1\/fill\/\S+\?token\S+/,
			replace: (src) => {
				const parseJwt = (token) => {
					var base64Url = token.split(".")[1];
					var base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
					var jsonPayload = decodeURIComponent(atob(base64)
						.split("")
						.map((c) => {
							return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
						})
						.join(""));

					return JSON.parse(jsonPayload);
				};
				let token = new URL(src).searchParams.get("token");

				// 要有 token 才能往下執行
				if (!token) return src;

				let jwt = parseJwt(token);

				// 拆解 json
				if (jwt.obj && jwt.obj[0] && jwt.obj[0][0] && jwt.obj[0][0].height) {
					let height = jwt.obj[0][0].height.replace("<=", "");
					let width = jwt.obj[0][0].width.replace("<=", "");
					return src.replace(/\/w_\d+,h_\d+,q_\d+/, `/w_${width},h_${height},q_100`);
				}

				return src;
			},
		},
		{
			site: "behance",
			srcPattern: /(.*)behance.net\/(project_modules|projects)\/(.*)/,
			replace: (src) => {
				let key = "/source/";
				return src
					.replace("/max_1200/", key)
					.replace(/\/max_\d+(_webp)?\//, `${key}`)
					.replace("/2800_opt_1/", key)
					.replace("/1400_opt_1/", key)
					.replace("/disp/", key)
					.replace(/project_modules\/\d+\//, `/project_modules/${key}/`)
					.replace(/projects\/\d+\//, `/projects/${key}/`);
			},
		},
		{
			site: "imgur",
			srcPattern: /(.*)i\.imgur\.com\/(.*)/,
			replace: (src) => {
				return src.replace(/\?(.*)/, "?maxwidth=99999");
			},
		},
		{
			site: "twitter",
			srcPattern: /(.*)twimg.com(.*)name=(.*)/,
			replaceAsync: async (src) => {
				const originalSrc = src;
				src = src.replace(/name=(.*)/, "name=orig");
				return new Promise((resolve) => {
					const controller = new AbortController();
					setTimeout(() => controller.abort(), 3000);
					const p1 = fetch(src.replace("format=webp", "format=jpg"), {
						method: "HEAD",
						signal: controller.signal,
					});
					const p2 = fetch(src.replace("format=jpg", "format=webp"), {
						method: "HEAD",
						signal: controller.signal,
					});

					Promise.all([p1, p2]).then((fetches) => {
						if (fetches[0].status === 200) {
							return resolve(fetches[0].url);
						}
						if (fetches[1].status === 200) {
							return resolve(fetches[1].url);
						}
						// 退回至原本的圖片
						return resolve(originalSrc);
					});
				});
			},
		},
		{
			site: "Bluesky",
			srcPattern: "https://cdn.bsky.app/img/feed_thumbnail/plain/(.*)@jpeg",
			replace: (src) => {
				return src.replace("feed_thumbnail", "feed_fullsize");
			},
		},
		{
			site: "midjourney",
			srcPattern: "https://cdn.midjourney.com/(.*)",
			replace: (src) => {
				return src.replace(/_\d+_N/, "").replace(/\.webp/, ".png");
			},
		},
		{
			site: "花瓣网 (v4) - 增加了 ?auth_key 支援",
			srcPattern: "https://gd-hbimg-edge.huaban(img)?.com/(.*)",
			replace: (str) => {
				return str
					.replace(/_\/fw[^?]*(?=\?|$)/, "")
					.replace(/_sq\d+\/format[^?]*(?=\?|$)/, "")
					.replace(/\/format\/[^?]*(?=\?|$)/, "")
					.replace(/_sq\d+\w*(?=\?|$)/, "")
					.replace(/_fw\d+\w*(?=\?|$)/, "")
					.replace(/small\//, "");
			},
		},
		{
			site: "花瓣网 (v3)",
			srcPattern: "https://gd-hbimg.huaban(img)?.com/(.*)",
			replace: (str) => {
				return str
					.replace(/_\/fw(.*)/, "")
					.replace(/_sq\d+\/format(.*)/, "")
					.split("/format/")[0]
					.replace(/_sq235$/, "")
					.replace(/_sq75$/, "")
					.replace(/_sq(.*)$/, "")
					.replace(/_fw[\d]+[w]*$/, "")
					.split("_fw")[0]
					.split("/fw/")[0]
					.replace(/small\//, "");
			},
		},
		{
			site: "花瓣网 (v2)",
			srcPattern: "(.*)hbimg.huaban.com/(.*)",
			replace: (str) => {
				return str
					.replace(/_\/fw(.*)/, "")
					.replace(/_sq\d+\/format(.*)/, "")
					.split("/format/")[0]
					.replace(/_sq235$/, "")
					.replace(/_sq75$/, "")
					.replace(/_sq(.*)$/, "")
					.replace(/_fw[\d]+[w]*$/, "")
					.split("_fw")[0]
					.split("/fw/")[0];
			},
		},
		{
			site: "花瓣网 (v1)",
			srcPattern: "//hbimg[.]*/*",
			replace: (str) => {
				return str
					.split("/format/")[0]
					.replace(/_sq235$/, "")
					.replace(/_sq75$/, "")
					.replace(/_fw[\d]+[w]*$/, "")
					.split("_fw")[0]
					.split("/fw/")[0];
			},
		},
		{
			site: "大作",
			srcPattern: "(.*)bigurl(.*)",
			replace: (str) => {
				return str.replace("pc_236_webp_2x", "pc_680_webp").replace("pc_236_webp", "pc_680_webp");
			},
		},
		{
			site: "Lapa.ninja",
			srcPattern: "(.*)cdn.lapaninja.com(.*)",
			replace: (str) => {
				return str.replace("-thumb.jpg", ".jpg");
			},
		},
		{
			site: "Dribbble",
			srcPattern: "https://cdn.dribbble.com/*",
			replace: (src) => {
				if (src.includes("userupload")) {
					return src.split("?")[0];
				}

				if (src.includes("screenshots") && src.includes("media")) {
					return src.split("?")[0];
				}

				if (src.includes("screenshots") && src.includes(".gif")) {
					return src.split("?")[0].replace("_4x", "");
				}

				if (src.includes("/videos/")) {
					return src.replace("_large_preview", "");
				}

				if (src.includes("/attachments/")) {
					return src;
				} else {
					return src.replace(/_1x/g, "").replace(/_teaser/g, "");
				}
			},
		},
		{
			site: "Pexels",
			srcPattern: "https?://images.pexels.com/*",
			replace: (src) => {
				return src.split("?")[0] + "?auto=compress";
			},
		},
		{
			site: "Tenor",
			srcPattern: "https://media.tenor.com/*",
			replace: (src) => {
				return src.replace(/(d|M)\//, "C/");
			},
		},
		{
			site: "新浪微博 weibo",
			srcPattern: /(.*)\/\/.*[.]sinaimg[.]cn\/([a-z]*)(\d+)\//,
			ignoreCheck: true,
			replace: (src) => {
				if (src.includes(".mp4")) {
					return src;
				}

				// NOTE: 他會跑出來403，但是圖片其實是存在的，另外他現在會檢查 referer
				return src.replace(/(cn)\/([a-z]*)(\d+)\//, "cn/large/");
			},
		},
		{
			site: "百度贴吧",
			srcPattern: "https?://tiebapic[.]baidu[.]com/forum.*",
			replace: (src) => {
				var reg = /^(http:\/\/tiebapic\.baidu\.com\/forum\/)ab(pic\/item\/[\w.]+)/i;
				var portrait = /\/sys\/portrait/;
				var result = src.match(reg);
				if (portrait.test(src)) {
					return src.replace(/\/sys\/portrait/, "/sys/portraitl");
				} else if (result) {
					//小图的时候
					return result[1] + result[2];
				} else {
					//小图点击之后的较大图，或者帖子内容页面的图片。
					var prefix = "http://tiebapic.baidu.com/forum/pic/item/";
					var reg2 = /\/sign=\w+\/([\w.]+)$/;
					var sign = src.match(reg2);
					return sign ? prefix + sign[1] : src;
				}
			},
		},
		{
			site: "豆瓣相册",
			srcPattern: /https?:\/\/img[\d]*\.doubanio\.com\/.*/,
			replace: (src) => {
				// NOTE: 不一定會有 original，如果遇到沒有的會出現空白畫面導致Eagle異常
				return src
					.replace(/[/]s[/]/, "/orginal/")
					.replace(/[/]m[/]/, "/orginal/")
					.replace(/[/]l[/]/, "/orginal/")
					.replace(/[/]sqs[/]/, "/orginal/");
			},
		},
		{
			site: "pixAI.Art",
			srcPattern: "https://images-ng.pixai.art/images/thumb/*",
			replace: (src) => {
				return src.replace("/thumb/", "/orig/");
			},
		},
		{
			site: "Flickr",
			srcPattern: ".*[.]staticflickr[.]com.*",
			replace: (src) => {
				return src.replace(/_[nms]\.jpg$/, "_b.jpg");
			},
		},
		{
			site: "颇可网 | poco.cn | 舊版, 相容性不確定",
			srcPattern: "http?://img[d].*pocoimg*",
			replace: (src) => {
				return src.replace(/_\d{3}.jpg$/, ".jpg");
			},
		},
		{
			site: "颇可网 | poco.cn | 新版",
			srcPattern: "https://(.*).pocoimg.cn/(.*)",
			replace: (src) => {
				return src.replace(/_H\d+./, ".");
			},
		},
		{
			site: "蘑菇街",
			srcPattern: "https?://.*[.]mogucdn[.]com/.*.jpg",
			replace: (src) => {
				return src.replace(/_[\d]{3}x[\d]+.jpg$/, "_468x468.jpg").split(".jpg")[0] + ".jpg";
			},
		},
		{
			site: "Pinterest",
			srcPattern: "https://(.*).pinimg.com/(.*).(jpg|png|webp)",
			replaceAsync: async (originalSrc) => {
				// 如果原始網址已經是75x75_RS或不包含圖片格式，直接返回
				if (originalSrc.includes("75x75_RS") || !/\.(jpg|png|webp)/.test(originalSrc)) return originalSrc;

				try {
					const baseSrc = originalSrc.replace(/[0-9]+x/g, "originals");
					const originalExt = originalSrc.match(/\.(jpg|png|webp)/)[0];
					const possibleFormats = [".jpg",
						".png",
						".webp",
						".gif"];
					const newSrcs = possibleFormats.map((ext) => baseSrc.replace(originalExt, ext));
					const controller = new AbortController();
					const timeoutId = setTimeout(() => controller.abort(), 3000);
					const fetchOptions = { method: "HEAD", signal: controller.signal };

					const responses = await Promise.all(newSrcs.map(async (src) => {
						const response = await fetch(src, fetchOptions);
						if (response.ok) {
							clearTimeout(timeoutId);
							return response.url;
						}
					}));

					const validResponse = responses.find((response) => typeof response === "string");
					if (validResponse) {
						return validResponse;
					}

					clearTimeout(timeoutId);
				} catch (error) {
					return originalSrc;
				}

				// 如果所有格式的图片都无法获取或请求被中断，返回原始网址
				return originalSrc;
			},
		},
		{
			site: "pixiv",
			srcPattern: /(.*)\/\/i\.pximg\.net\/(.*)/,
			ignoreCheck: true,
			replaceAsync: async (src) => {
				return new Promise(async (resolve) => {
					try {
						const abortController = new AbortController();

						// 換成大圖網址
						const originalSrc = src
							.replace(/c\/\d+x\d+_\d+(_[A-z0-9]{2}){0,1}\//, "")
							.replace(/img-master/, "img-original")
							.replace(/custom-thumb/, "img-original")
							.replace(/_(master|square|custom)1200/, "");

						// 看起來不是圖片就不處理
						if (!(originalSrc.includes(".jpg") || originalSrc.includes(".png"))) {
							return resolve(originalSrc);
						}

						// HACK: 因為大圖有可能是 jpg 或 png，所以要分別檢查

						// 原始來源 (pixiv)
						const originalPngUrl = originalSrc.replace(".jpg", ".png");
						const originalJpgUrl = originalSrc.replace(".png", ".jpg");

						// 替代來源1: eagle workers
						// const alternativePngUrl = originalSrc.replace("i.pximg.net", "pixiv.eagle-app.workers.dev").replace(".jpg", ".png");
						// const alternativeJpgUrl = originalSrc.replace("i.pximg.net", "pixiv.eagle-app.workers.dev").replace(".png", ".jpg");

						// 替代來源2: pixiv.cat
						// NOTE: 未採用，濫用別人家的資源好像不太好，雖然他沒說不能商用就是了

						// 測試網址是否有效
						const test1 = this.#isValidImageURL(originalPngUrl, abortController).then((result) => ({ group: "test1", result }));
						const test2 = this.#isValidImageURL(originalJpgUrl, abortController).then((result) => ({ group: "test2", result }));
						// const test3 = this.#isValidImageURL(alternativePngUrl).then((result) => ({ group: "test3", result }));
						// const test4 = this.#isValidImageURL(alternativeJpgUrl).then((result) => ({ group: "test4", result }));

						// 比較哪一組測試結果最快回傳
						Promise.race([test1, test2]).then((fastest) => {
							abortController.abort("cancelled reason");
							console.log("[pixiv-race-fetch] 最快速的組別是:", fastest.group);
							console.log("[pixiv-race-fetch] 其輸出結果是:", fastest.result);

							// 因為錯誤結果會最快回來，我們可以藉此反向推論答案
							if (fastest.result === false) {
								console.log("[pixiv-race-fetch] 收到錯誤的結果，反推正確連結");
								if (fastest.group === "test1") {
									return resolve(originalJpgUrl);
								}

								if (fastest.group === "test2") {
									return resolve(originalPngUrl);
								}

								// if (fastest.group === "test3") {
								// 	return resolve(alternativeJpgUrl);
								// }

								// if (fastest.group === "test4") {
								// 	return resolve(alternativePngUrl);
								// }
							}

							// 當然，如果回來的東西就是有效的網址，我們就直接回傳
							return resolve(fastest.result);
						});
					} catch (error) {
						console.log("[pixiv-race-fetch] 發生了一些錯誤: ", error);
					}

					// NOTE: 💀💀💀 先保留，以防萬一上面那套邏輯不適用 💀💀💀
					// 因為 pixiv 改版，現在有圖片的會回傳 403，不存在的則會回傳 404，這是基於這個特型錯誤的判斷
					// (反正兩者會有一個是 false，然後如果都不成立的話，就回傳原本的圖片)
					// if (testers[0] === false && testers[1] !== false) {
					// 	return resolve(origAssertJpg);
					// }

					// if (testers[1] === false && testers[0] !== false) {
					// 	return resolve(origAssertPng);
					// }
				});
			},
		},
		{
			site: "1688",
			srcPattern: "https?://cbu01.alicdn.com/img/ibank/.*..*x.*.jpg",
			replace: (src) => {
				return src.replace(/\.\d+x.*\./, ".");
			},
		},
		{
			site: "淘宝",
			srcPattern: /.(?:taobao|tb|ali)cdn(.+)_\d+x\d+.jpg(.*)/,
			replace: (src) => {
				return src.replace(/_\d+x\d+.jpg(_.webp)?/, "");
			},
		},
		{
			site: "天猫",
			srcPattern: /.(?:taobao|tb|ali)cdn(.+)_\d+x\d+\S\d+.jpg(.*)/,
			replace: (src) => {
				return src.replace(/_\d+x\d+\S\d+.jpg(_.webp)?/, "");
			},
		},
		{
			site: "Amazon",
			srcPattern: "https://(images-na.ssl-images|images-fe.ssl-images|m.media)-amazon.com/images/(.*)",
			replace: (src) => {
				return src.replace(/\.\_\S+\./, ".");
			},
		},
		{
			site: "京东",
			srcPattern: "https://.*.360buyimg.com.*",
			replace: (src) => {
				return src
					.replace(/\/n\d+\//, "/n0/")
					.replace(/s\d+x\d+_?/, "")
					.split("!cc")[0]
					.split("!q")[0]
					.replace(/.jpg.avif/, ".jpg");
			},
		},
		{
			site: "Houzz",
			srcPattern: "https://st.hzcdn.com/fimgs/*",
			replace: (src) => {
				return src
					.replace(/_/, "_14-")
					.replace("fimgs", "simgs")
					.replace(/-w\d+-h\d+-b0-p0/, "");
			},
		},
		{
			site: "HouseBeautiful",
			srcPattern: "https://hips[.]hearstapps[.]com/.*",
			replace: (src) => {
				return src.replace(/[.]jpg{1,}/, ".jpg").split("&resize=")[0];
			},
		},
		{
			site: "Officesnapshots",
			srcPattern: "https://officesnapshots[.]com/.*",
			replace: (src) => {
				return src.replace(/-\d{3,4}x\d{3,4}/, "");
			},
		},
		{
			site: "Archilovers",
			srcPattern: "https://cdn.archilovers.com/.*",
			replace: (src) => {
				return src.replace(/(\S_\d+_|thumb\d_)/, "");
			},
		},
		{
			site: "AD",
			srcPattern: "https://media[.]architecturaldigest[.]com/.*",
			replace: (src) => {
				return src.replace(/w_\d+/, "w_5000").replace(/,h_\d+/, "");
			},
		},
		{
			site: "Archdaily 中文版",
			srcPattern: "https?://images[.]adsttc[.]com[.]qtlcn[.]com/.*",
			replace: (src) => {
				return src
					.replace(/thumb_jpg/, "large_jpg")
					.replace("/medium_jpg/", "/large_jpg/")
					.replace("/newsletter/", "/large_jpg/");
			},
		},
		{
			site: "ArchDaily 国际版",
			srcPattern: "https?://images[.]adsttc[.]com/.*",
			replace: (src) => {
				return src
					.replace(/slideshow/, "large_jpg")
					.replace(/thumb_jpg/, "large_jpg")
					.replace("/medium_jpg/", "/large_jpg/")
					.replace("/newsletter/", "/large_jpg/");
			},
		},
		{
			site: "Dezeen",
			srcPattern: "https://static[.]dezeen[.]com/.*",
			replace: (src) => {
				return src
					.replace(/slideshow/, "large_jpg")
					.replace(/thumb_jpg/, "large_jpg")
					.replace(/-\d+x\d+.jpg/, ".jpg");
			},
		},
		{
			site: "Archiproducts",
			srcPattern: "https://img[.]edilportale[.]com/.*",
			replace: (src) => {
				return src.replace(/-thumbs.*.[a-z]_/, "s/").replace(/news.*.[a-z]_/, "news/");
			},
		},
		{
			site: "officesnapshots wordpress",
			srcPattern: "https://officesnapshots.com/wp-content/uploads/(.*)",
			replace: (src) => {
				return src.replace(/-\d+x\d+-(.*)\./, ".").split("?w=")[0];
			},
		},
		{
			site: "wordpress 通用 2.0 (asnyc)",
			srcPattern: "/wp-content/uploads/.*",
			replaceAsync: async (src) => {
				return new Promise((resolve) => {
					let newsrc = src.replace(/-\d+x\d+/, "").split("?w=")[0];
					let isDoubleExt = newsrc.match(/\.[a-z]{3,4}\.[a-z]{3,4}$/);

					const controller = new AbortController();
					const timeoutId = setTimeout(() => controller.abort(), 3000);
					let promises = [];

					// 原本的 wordpress 邏輯
					let p1 = fetch(newsrc, { method: "HEAD", signal: controller.signal });
					promises.push(p1);

					// 雙副檔名的 wordpress 邏輯
					if (isDoubleExt) {
						let src = newsrc.split(".");
						src.pop();
						src = src.join(".");
						let p2 = fetch(src, { method: "HEAD", signal: controller.signal });
						promises.push(p2);
					}

					Promise.all(promises)
						.then((fetches) => {
							if (fetches[1] && fetches[1].status === 200) {
								return resolve(fetches[1].url);
							}

							if (fetches[0].status === 200) {
								return resolve(fetches[0].url);
							}

							// 退回至原本的圖片
							return resolve(src);
						})
						.catch(() => {
							// 退回至原本的圖片
							return resolve(src);
						});
				});
			},
		},
		{
			site: "Squarespace 通用",
			srcPattern: "https://static[0-9][.]squarespace[.]com/.*",
			replace: (src) => {
				return src.replace(/format=[0-9]{3,4}w/, "format=3000w");
			},
		},
		{
			site: "bilibili专栏",
			srcPattern: "https://(.*).hdslb.com/(.*)@(.*).(webp|avif)",
			replace: (src) => {
				return src.split("@")[0];
			},
		},
		{
			site: "AliyunOSS 通用",
			srcPattern: /\?x-oss-process=\S+/,
			replace: (src) => {
				const removeQueryParameter = (url, parameter) => {
					let urlObject = new URL(url);
					let params = urlObject.searchParams;
					params.delete(parameter);
					return urlObject.toString();
				};

				return removeQueryParameter(src, "x-oss-process");
			},
		},
		{
			site: "小红书",
			srcPattern: "https?://sns-webpic-qc.xhscdn.com/(.*)",
			replace: (src) => {
				return src.replace(/:\/\/[^/]+(\.xhscdn.com\/+)[0-9]+\/+[0-9a-f]{10,}\/+([^/.?#!]+)(?:[?#!].*)?/, "://sns-img-al$1$2").split("!")[0];
			},
		},
		{
			site: "Medium",
			srcPattern: "https://cdn-images-[0-9][.]medium[.]com/.*",
			replace: (src) => {
				return src.replace(/\/max\/\d{2,4}/, "");
			},
		},
		{
			site: "Medium | 新版",
			srcPattern: "https://miro.medium.com/v2/(.*)",
			replace: (src) => {
				return src.replace(/\/[^/]*:[^/]*\//g, "/");
			},
		},
		{
			site: "Artstation",
			srcPattern: "https://cdn(.*).artstation.com/(.*)",
			ignoreCheck: true,
			replaceAsync: async (src) => {
				return new Promise(async (resolve) => {
					try {
						const abortController = new AbortController();

						const largeSrc = src
							.replace(/\d{14}\//, "")
							.replace(/large/, "large")
							.replace(/micro_square/, "large")
							.replace(/smaller_square/, "large")
							.replace(/small_square/, "large");
						const large4kSrc = largeSrc.replace(/large/, "4k");

						// 測試網址是否有效
						const test1 = this.#isValidImageURL(large4kSrc, abortController).then((result) => ({ src: large4kSrc, valid: result }));
						const test2 = this.#isValidImageURL(largeSrc, abortController).then((result) => ({ src: largeSrc, valid: result }));

						// 等待所有測試結束
						Promise.all([test1, test2]).then((results) => {
							abortController.abort();

							// 篩選出有效的網址
							const validResults = results.filter((result) => result.valid);
							if (validResults.length > 0) {
								// 如果有有效的網址，則回傳第一個
								resolve(validResults[0].src);
							}
						});
					} catch (error) {
						console.log("[artstation-race-fetch] 發生了一些錯誤: ", error);
						resolve(src);
					}
				});
			},
		},
		{
			site: "GameUI",
			srcPattern: "https://image.gameuiux.cn.*",
			replace: (src) => {
				return src.replace(/_list/, "_detail");
			},
		},
		{
			site: "GameUI2",
			srcPattern: "https://img.gameui.net/*",
			replace: (src) => {
				// 只會有 "-1"
				// -1@1x520
				if (src.match(/(-1@\d+x\d+)/)) {
					return src.replace(/(-1@\d+x\d+)\.webp/g, ".webp");
				}

				// @1x520.webp
				if (src.match(/(@\d+x\d+)\.webp/)) {
					return src.replace(/(@\d+x\d+)\.webp/g, ".webp");
				}

				return src;
			},
		},
		{
			site: "interiordesign",
			srcPattern: "https://d4qwptktddc5f[.]cloudfront[.]net/.*",
			replace: (src) => {
				return src.replace(/easy_thumbnails\/thumbs_/, "").replace(/[.]jpg.*/, ".jpg");
			},
		},
		{
			site: "meiye",
			srcPattern: "(.*)image.meiye.art/(.*)",
			replace: (src) => {
				return src.split("?imageMogr2")[0].split("?vframe")[0];
			},
		},
		{
			site: "即刻",
			srcPattern: "https://cdn(.*)[.]ruguoapp[.]com/.*",
			replace: (src) => {
				return src.split("?imageMogr2")[0];
			},
		},
		{
			site: "腾讯云 通用",
			srcPattern: "https://(.*)?imageMogr2(.*)",
			replace: (src) => {
				if (src.includes("sign-algorithm=")) return src;
				if (src.includes("?imageMogr2")) src = src.split("?imageMogr2")[0];
				return src;
			},
		},
		{
			site: "腾讯云 通用 #2",
			srcPattern: "https://(.*)?imageView2(.*)",
			replace: (src) => {
				if (src.includes("q-sign-algorithm=")) return src;
				if (src.includes("?imageView2")) src = src.split("?imageView2")[0];
				return src;
			},
		},
	];

	/**
	 * 判斷目前執行環境是否在 Eagle App (electron) 內執行
	 * @returns {boolean} 回傳是否在 Eagle App (electron) 內執行
	 */
	get isRunningInEagleApp() {
		// 如果環境有 electron 這個變數，就代表是在 Eagle App 裡面跑的
		return typeof electron !== "undefined";
	}

	/**
	 * 判斷 Eagle App 本體是否支援轉大圖功能
	 * @returns {boolean} 是否支援轉大圖功能
	 */
	get isEagleHasAbilityToEnlarge() {
		if (!this.isRunningInEagleApp) {
			// 且 Eagle App 本體支援轉大圖的話
			if (eagle.env?.isAppSupportURLEnlarger) {
				return true;
			}
		}

		return false;
	}

	/**
	 * 轉換圖片網址，當超時會回傳原始圖片網址
	 *
	 * @param {string} url 原始圖片網址
	 * @returns {Promise<{ url: string, largeUrl: string }>} 回傳原始圖片網址與大圖網址
	 */
	async enlarge(url, timeout = 3000) {
		// 如果 Eagle App 本體支援轉大圖功能的話，就把該功能交給他處理，這裡直接回傳原始圖片網址跳出
		if (this.isEagleHasAbilityToEnlarge) {
			return { url, largeUrl: null };
		}

		const timeoutPromise = new Promise((resolve) =>
			setTimeout(() => {
				this.log(`URLEnlarger.enlarge timeout, url: ${url}`);
				return resolve({ url, largeUrl: null });
			}, timeout));

		return Promise.race([this.#convertURL(url), timeoutPromise]);
	}

	async enlargeWithoutCheckEagleHasAbility(url) {
		const timeoutPromise = new Promise((resolve) =>
			setTimeout(() => {
				this.log(`URLEnlarger.enlarge timeout, url: ${url}`);
				return resolve({ url, largeUrl: null });
			}, 3000));

		return Promise.race([this.#convertURL(url), timeoutPromise]);
	}

	/**
	 * 批次轉大圖
	 * 如果你要大批量網址轉換大圖話，使用該方法會比較有效率
	 *
	 * @param {Array<string>} urls 原始圖片網址陣列
	 * @param {number} eachTimeout 每個網址的timeout時間
	 * @returns {Promise<Array<{ url: string, largeUrl: string }>>} 回傳原始圖片網址與大圖網址
	 */
	async enlargeBatch(urls, eachTimeout = 3000) {
		// 如果 Eagle App 本體支援轉大圖功能的話，就把該功能交給他處理，這裡直接回傳原始圖片網址跳出
		if (this.isEagleHasAbilityToEnlarge) {
			return urls.map((url) => ({ url, largeUrl: null }));
		}

		let workers = [];

		for (let url of urls) {
			const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve({ url, largeUrl: null }), eachTimeout));
			const racePromise = Promise.race([this.#convertURL(url), timeoutPromise]);
			workers.push(racePromise);
		}

		// 執行所有的轉換
		return await Promise.all(workers);
	}

	/**
	 * 檢查規則是否存在
	 *
	 * @param {string} url 原始圖片網址
	 * @returns {boolean} 回傳規則是否存在
	 */
	isEnlargable(url) {
		if (!url) return false;

		// NOTE: 如果有一個超大的base64(>=100000)跑進來，會導致瀏覽器當機，況且他也不應該進來轉大圖，所以一定要過濾掉
		if (url.includes("data:image") || url.includes("blob:")) return false;

		return this.rules.find((rule) => {
			try {
				const regexp = RegExp(rule?.srcPattern);
				if (regexp.test(url)) {
					return true;
				}
			} catch (err) {
				return false;
			}
		});
	}

	/**
	 * 提供轉換圖片網址的方法
	 *
	 * @param {string} url 原始圖片網址
	 * @returns {Promise<{ url: string, largeUrl: string }>} 回傳原始圖片網址與大圖網址
	 */
	async #convertURL(url) {
		return new Promise(async (resolve) => {
			if (!url) return resolve(url, null);
			if (url.indexOf("data:image") > -1) return resolve({ url, largeUrl: null });
			if (!(url.startsWith("http://") || url.startsWith("https://"))) return resolve({ url, largeUrl: null });

			const rule = this.isEnlargable(url);
			if (!rule) return resolve({ url, largeUrl: null });

			const newURL = await this.#ruleReplace(rule, url);

			// 根本沒改變，不用再驗證
			if (newURL === url) return resolve({ url, largeUrl: null });

			// 如果有 ignoreCheck 的話，就不用再驗證了
			// 如果是在 Eagle App 裡面跑的話，也不用再驗證了
			if (rule.ignoreCheck || this.isRunningInEagleApp) {
				return resolve({ url, largeUrl: newURL });
			}

			// 如果規則驗證過可用的話，就不用再驗證了
			if (this.#ruleValidMap[rule.site]) {
				console.log(`[URLEnlarger] ${rule.site} 規則已通過，無須驗證圖片是否存在`);
				return resolve({ url, largeUrl: newURL });
			}

			// 確認轉出來的東西是真實存在的
			if (await this.#isURLExists(newURL)) {
				this.#ruleValidMap[rule.site] = true;
				return resolve({ url, largeUrl: newURL });
			}
			// 大圖網址不存在，回傳原本的網址
			else {
				this.log("electron-info", `[bg] Large url: ${newURL} not exists, so use original url: ${url}`);
				delete this.#ruleValidMap[rule.name];
				return resolve({ url, largeUrl: null });
			}
		});
	}

	/**
	 * 對網址套用規則進行轉換
	 *
	 * @param {object} rule 轉換規則
	 * @param {string} url 原始圖片網址
	 * @returns
	 */
	async #ruleReplace(rule, url) {
		return new Promise((resolve) => {
			if (rule.replace) {
				return resolve(rule.replace(url));
			} else if (rule.replaceAsync) {
				rule.replaceAsync(url).then((largeUrl) => {
					return resolve(largeUrl);
				});
			} else {
				return resolve(url);
			}
		});
	}

	/**
	 * 檢查圖片網址是否存在
	 *
	 * @param {string} url
	 * @returns {Promise<boolean>} 回傳圖片網址是否存在
	 */
	async #isURLExists(url) {
		return new Promise((resolve) => {
			eagle.urlTest(url, {}).then((result) => {
				console.log(`[URLEnlarger] ${url} ${result.responseStatus}`);
				resolve(result.responseStatus === true);
			});
		});
	}

	/**
	 * 檢查圖片網址是否有效 (舊版，不具備 reject)
	 *
	 * @param {string} url 圖片網址
	 * @returns {Promise<string>} 回傳圖片網址
	 */
	async #isValidImageURL(url, controller = null) {
		if (this.isRunningInEagleApp) {
			return this.#checkURLByEagle(url);
		} else {
			return this.#checkURLByImageElement(url, controller);
		}
	}

	async #checkURLByEagle(url) {
		return new Promise((resolve) => {
			const request = url.startsWith("https") ? require("https") : require("http");
			request.get(url,
				{
					method: "HEAD",
					timeout: 3000,
					headers: {
						Referer: url,
					},
				},
				(res) => {
					if (res.statusCode >= 400) {
						return resolve(false);
					} else {
						return resolve(url);
					}
				});
		});
	}

	async #checkURLByImageElement(url, controller) {
		return new Promise((resolve) => {
			let img = new Image();
			img.src = url;
			img.onload = () => {
				resolve(url);
			};

			img.onerror = () => {
				img.onload = null;
				img.onerror = null;
				img.src = "";
				resolve(false);
			};

			if (controller) {
				controller.signal.addEventListener("abort", ({ target }) => {
					// controller.signal.removeEventListener("abort", abortListener);
					img.onload = null;
					img.onerror = null;
					img.src = "";
				});
			}
		});
	}

	/**
	 * 檢查圖片網址是否有效
	 *
	 * @param {string} url 圖片網址
	 * @returns {Promise<string>} 回傳圖片網址
	 */
	async #isValidImageURLRejectable(url) {
		return new Promise((resolve, reject) => {
			let img = new Image();
			img.src = url;
			img.onload = () => {
				resolve(url);
			};
			img.onerror = () => {
				img.onload = null;
				img.onerror = null;
				img.src = "";
				reject();
			};
		});
	}

	log(message) {
		try {
			if (ipcRenderer) {
				ipcRenderer.send("electron-info", `[bg] ${message}`);
			} else {
				console.log(message);
			}
		} catch (err) {}
	}
};

eagle.urlEnlarger = new globalThis.URLEnlarger();
