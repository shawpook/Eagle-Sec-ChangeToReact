var Artstation = {
    // 是否为支持网址
    isValidUrl: (url) => {
        return url.indexOf("www.artstation.com/") > -1;
    },
    // 取得 artstation 用户名称
    getUserNameFromUrl: (url, urlPattern) => {
        var name = url.split(urlPattern)[1];
        var queryIdx = name.indexOf("?");
        if (queryIdx > -1) {
            name = name.slice(0, queryIdx);
        }
        return name.replace("/", "");
    },
    // 取得用户信息
    getUserInfo : (url, callback) => {
        if (!Artstation.isValidUrl(url)) {
            finishCallback({
                msg: '网址格式错误'
            }, null);
        }
        // var userName = getArtstationUserNameFromUrl("https://www.artstation.com/minskuju?a=123", "https://www.artstation.com/");
        var userName = Artstation.getUserNameFromUrl(url, "https://www.artstation.com/");
        if (!userName) {
            callback({
                msg: '用户名称错误'
            }); 
        }
        // 取得用户图片总数
        $.getJSON("https://www.artstation.com/users/" + userName + "/projects.json?page=99999", (data) => {
            if (!data || data.total_count === 0) {
                callback({
                    msg: '无法获取该用户信息'
                }); 
            }
            callback(null, {
                url: url,
                userName: userName,
                total: data.total_count
            });
        });
    },
    getUserProjects : (params, updateCallback, finishCallback) => {

        var total = params.total;
        var url = params.url;
        var userName = params.userName;
        var pageCount = Math.ceil(total / 50);
        
        // 一页一页开始获取 JSON，每获取一次，呼叫 updateCallback
        // 所有页面完成后，呼叫 finishCallback
        // var downloadQueue = async.queue(async.timeout(writeLibraryQueueCallback, 10000), 5);
        var urls = [];
        var done = 0;
        for (var i = 0; i < pageCount; i++) {
            urls.push("https://www.artstation.com/users/" + userName + "/projects.json?page=" + (i + 1));
        }

        var cbs = urls.map(function(url, index) {
            return function(callback) {
                $.getJSON(url, (data) => {
                    if (data) {
                        // https get json
                        updateCallback(null, data.data);
                        callback(null, data.data);
                    }
                    else {
                        callback({
                            msg: "无法取得结果"
                        });
                    }
                });
            }
        });

        var getVideoSrcFromIframe = async function (asset) {
            return new Promise(resolve => {
                var iframeSrc = $(asset.player_embedded).attr("src");
                fetch(iframeSrc).then(function (response) {
                    return response.text();
                }).then(function (data) {
                    try {
                        var parser = new DOMParser();
                        var doc = parser.parseFromString(data, 'text/html'); 
                        var iframeVideoElem = $(doc).find("source");
                        if (iframeVideoElem[0].src.indexOf("mp4")) {
                            resolve(iframeVideoElem[0].src);
                        }
                        else {
                            resolve();
                        }
                    } catch (err) {
                        resolve();    
                    }
                }).catch(function (err) {
                    resolve();
                });
            });
        };

        const parseAsset = async function (item, raw, images, cb) {
            var assets = raw.assets;
            for (var i = 0; i < assets.length; i++) {

                let asset = assets[i];

                if (asset.width > 2560 || asset.height > 2560) {
                    if (asset.image_url.indexOf("covers") === -1 && asset.image_url.indexOf("video") === -1) {
                        asset.image_url = asset.image_url.replace("/large/", "/4k/");
                    }
                }

                if (asset.oembed && asset.oembed.provider_name === "ArtStation" && asset.player_embedded && asset.player_embedded.indexOf("artstation.com") > -1) {
                    let videoUrl = await getVideoSrcFromIframe(asset);
                    asset.image_url = videoUrl || asset.image_url;
                }

                images.push({
                    id: asset.id,
                    width: asset.width,
                    height: asset.height,
                    link: item.permalink,
                    title: item.title.replace(/%/g, "").replace(/[:|"<>,.^&*?//-]+/g, '').substr(0, 36),
                    src: asset.image_url,
                    projectIndex: raw.id,
                    assetIndex: asset.position
                });
            }
            cb();
        }

        var async = require('async');
        async.parallelLimit(cbs, 20, function(err, result) {

            if (!result || result.length === 0) {
                finishCallback({
                    msg: "下载失败"
                });
            }

            // 正规划图片格式
            var images = [];
            result.forEach(function (data) {
                data.forEach(function (item, projectIndex) {
                    $.getJSON('https://www.artstation.com/projects/' + item.hash_id + '.json', function (raw) {
                        parseAsset(item, raw, images, function () {
                            done++;
                            if (done === total) {
                                // images = images.reverse();
                                images = images.sort(function (a, b) {
                                    if (a.projectIndex === b.projectIndex) {
                                        return b.assetIndex - a.assetIndex;
                                    }
                                    else {
                                        if (a.projectIndex < b.projectIndex)
                                            return -1;
                                        if (a.projectIndex > b.projectIndex)
                                            return 1;
                                    }
                                });
                                finishCallback(err, images, result.length);
                            }
                        });
                    });
                });
            });
        });
    }
};

// 下载 artstation 网址包含的图片
// var url = "https://www.artstation.com/haryarti";
// var downloadCount = 0;
// console.info("下载网址：" + url);
// Artstation.getUserInfo(url, (err, result) => {

//     if (err) { console.log(err); return; }

//     console.info("用户 %s 拥有 %d 张图片", result.userName, result.total);
//     Artstation.getUserProjects({
//         total: result.total,
//         userName: result.userName,
//         url: result.url
//     }, (err, images) => {
//         if (err) return;
//         downloadCount += images.length;
//         console.info("下载进度 %d / %d", downloadCount, result.total);
//     }, (err, result) => {
//         console.info("下载完成，共下载了 %d 张图片", downloadCount);
//         console.log(result);
//     });
// });