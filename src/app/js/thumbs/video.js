const fs = require('fs');
const appRoot = require('app-root-path');
const { ipcRenderer } = require('electron');
const URL_MODULE = require(appRoot + '/my_modules/url');

module.exports = async ({ src, dest, startAt, item }) => {
    return new Promise(async (resolve, reject) => {
        try {
            let result = await video2image(src, dest, startAt);
            // 無法產生縮圖時，改用 native 方式處理
            if (!fs.existsSync(dest)) {
                return reject(new Error(`Video thumbnail generate fail.`));
            }

            item.width = result?.width ?? item.width;
            item.height = result?.height ?? item.height;
			item.resolutionWidth = item.width;
			item.resolutionHeight = item.height;
            item.duration = result?.duration ?? item.duration;

            return resolve(item);
        }
        catch (err) {
            return reject(err);
        }
    });
}

function getVideoMetadata(videoPath, currentTime, callback) {
    var v = document.createElement('video');
    var hasCallback = false;

    try {
        if (currentTime === 0) currentTime = 0.01;
        v.src = URL_MODULE.pathToFileURL(videoPath).href;
        v.autoplay = false;
        v.preload = 'metadata';
        v.muted = 'muted';
        v.currentTime = currentTime ?? 1;
    }
    catch (err) {
        if (!hasCallback) {
            hasCallback = true;
            callback({ error: 'error' });
            v.src = "";
        }
    }

    v.addEventListener('abort', function () {
        if (!hasCallback) {
            hasCallback = true;
            callback({ error: 'abort' });
            v.pause();
            v.src = "";
            v.load();
        }
    });

    v.addEventListener('error', function () {
        if (!hasCallback) {
            hasCallback = true;
            callback({ error: 'error' });
            v.pause();
            v.src = "";
            v.load();
        }
    });
    
    v.addEventListener('loadeddata', function () {
        if (v.duration !== 0 && !currentTime) {
            v.currentTime = Math.min(10, v.duration / 3);
        }
        v.play().then(function () {

        }, function (err) {

            if (!v.videoHeight || !v.duration) {
                hasCallback = true;
                callback({ error: 'error' });
                v.src = "";
                v.load();
            }
            else {
                if (!hasCallback) {
                    hasCallback = true;
                    var canvas = document.createElement('canvas');
                    var ctx = canvas.getContext('2d');
                    canvas.width = 480;
                    canvas.height = 480 * v.videoHeight / v.videoWidth;
                    v.setAttribute("crossOrigin", 'Anonymous')
                    ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
                    let base64 = canvas.toDataURL("image/jpeg", 1.0);
                    if (base64.length < 10) {
                        callback({ error: 'error' });
                    }
                    else {
                        callback(undefined, {
                            duration: v.duration,
                            videoHeight: v.videoHeight,
                            videoWidth: v.videoWidth,
                            base64: canvas.toDataURL("image/jpeg", 1.0)
                        });
                    }
                    v.pause();
                    v.removeAttribute('src');
                    v.load();
                }
            }
        });
    });

    v.addEventListener('playing', function () {
        if (!hasCallback) {
            hasCallback = true;
            var canvas = document.createElement('canvas');
            var ctx = canvas.getContext('2d');
            canvas.width = 480;
            canvas.height = 480 * v.videoHeight / v.videoWidth;
            v.setAttribute("crossOrigin", 'Anonymous')
            ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
            callback(undefined, {
                duration: v.duration,
                videoHeight: v.videoHeight,
                videoWidth: v.videoWidth,
                base64: canvas.toDataURL("image/jpeg", 1.0)
            });
            v.pause();
            v.removeAttribute('src');
            v.load();
        }
    });
}

function writeMetadataToDest(metadata, dest) {
	return new Promise((resolve, reject) => {
		if (!metadata || !metadata.base64) {
			ipcRenderer.send('electron-log', "[bg] Can't generate video base64 thumbnail.");
			reject(new Error("Can't generate video base64 thumbnail."));
			return;
		}

		var decode = decodeBase64Image(metadata.base64);

		if (!decode || !decode.data) {
			ipcRenderer.send('electron-log', "[bg] Video decode result is null");
			reject(new Error("Video decode result is null"));
			return;
		}

		fs.writeFile(dest, decode.data, function (err) {
			if (err) {
				ipcRenderer.send('electron-log', "" + (err.stack || err));
				reject(err);
			}
			else {
				resolve({
					height: metadata.videoHeight,
					width: metadata.videoWidth,
					duration: metadata.duration,
				});
			}
		});
	});
}

async function video2image (videoPath, dest, thumbnailAt) {
	return new Promise(async (resolve, reject) => {

		// Step1: 嘗試使用原生 <video> 取得 metadata 和縮圖
		console.time("getVideoMetadata");

		getVideoMetadata(videoPath, thumbnailAt, async function (err, metadata) {

			console.timeEnd("getVideoMetadata");

			var hasValidMetadata = metadata
				&& metadata.base64
				&& Number.isFinite(metadata.videoWidth) && metadata.videoWidth > 0
				&& Number.isFinite(metadata.videoHeight) && metadata.videoHeight > 0
				&& Number.isFinite(metadata.duration) && metadata.duration > 0;

			var isNativeSuccess = !err && hasValidMetadata;

			if (isNativeSuccess) {
				try {
					var result = await writeMetadataToDest(metadata, dest);
					resolve(result);
				} catch (writeErr) {
					reject(writeErr);
				}
				return;
			}

			// Step2: 原生無法解析，改用 mpv-video 作為備案
			ipcRenderer.send('electron-log', "[bg] Native video metadata failed, fallback to mpv-video. Error: " + (err ? JSON.stringify(err) : 'no metadata'));
			console.time("getVideoMetadataViaMpvVideo");

			getVideoMetadataViaMpvVideo(videoPath, thumbnailAt, async function (err2, metadata2) {

				console.timeEnd("getVideoMetadataViaMpvVideo");

				if (err2 || !metadata2 || !metadata2.videoWidth || !metadata2.duration) {
					var errMsg = "[bg] Both native and mpv-video failed to generate video thumbnail.";
					ipcRenderer.send('electron-log', errMsg + " mpv error: " + (err2 ? JSON.stringify(err2) : 'no metadata'));
					reject(new Error(errMsg));
					return;
				}

				try {
					var result = await writeMetadataToDest(metadata2, dest);
					resolve(result);
				} catch (writeErr) {
					reject(writeErr);
				}
			});
		});
	});
}


function getVideoMetadataViaMpvVideo(videoPath, currentTime, callback) {
    var player = document.createElement('mpv-video');
    var hasCallback = false;
    var timeoutId;

    // 需要給予實際尺寸，mpv 的 OpenGL 渲染管線需要有效的渲染表面才能截圖
    // 使用 visibility:hidden 隱藏，不佔版面但仍有渲染尺寸
    Object.assign(player.style, {
        position: 'fixed',
        left: '0',
        top: '0',
        width: '480px',
        height: '270px',
        visibility: 'hidden',
        pointerEvents: 'none',
        zIndex: '-1',
    });

    function cleanup() {
        if (timeoutId) clearTimeout(timeoutId);
        try {
            player.pause();
            player.removeAttribute('src');
            if (player.parentNode) {
                player.parentNode.removeChild(player);
            }
            // 完整銷毀 MPV 原生資源（WebGL context、native controller、plugins 等）
            player.destroy();
        } catch (e) {}
    }

    function done(err, metadata) {
        if (hasCallback) return;
        hasCallback = true;
        cleanup();
        callback(err, metadata);
    }

    // 30 秒超時保護
    timeoutId = setTimeout(function () {
        done({ error: 'timeout' });
    }, 30000);

    player.addEventListener('error', function () {
        done({ error: 'error' });
    });

    // playing: mpv 渲染管線已就緒，先 seek 到目標時間再截圖
    player.addEventListener('playing', async function () {
        try {
            var duration = player.duration;
            var videoWidth = player.sourceWidth || player.videoWidth;
            var videoHeight = player.sourceHeight || player.videoHeight;

            if (!videoWidth || !duration) {
                done({ error: 'no metadata' });
                return;
            }

            // 計算截圖時間點：
            // - thumbnailAt 有明確指定（含 0）→ 用指定值
            // - thumbnailAt 未指定 → 用 min(10, duration/3) 避免拿第一幀當封面
            var screenshotTime;
            if (currentTime != null) {
                screenshotTime = currentTime === 0 ? 0.01 : currentTime;
            } else {
                screenshotTime = Math.min(10, duration / 3);
            }

            // 先 seek 到目標時間，等 seeked 確認解碼完成
            // 不提前 pause，保持 render pipeline 活躍以確保 seek 後能正確解碼畫面
            await new Promise(function (resolve) {
                player.addEventListener('seeked', resolve, { once: true });
                player.currentTime = screenshotTime;
            });

            // 等兩個 animation frame，確保 MPV GPU surface 已將解碼後的畫面實際渲染上去
            await new Promise(function (resolve) {
                requestAnimationFrame(function () {
                    requestAnimationFrame(resolve);
                });
            });

            player.pause();

            var imageData = await player.screenshot(screenshotTime, { maxWidth: 480 });

            if (!imageData) {
                done({ error: 'screenshot failed' });
                return;
            }

            // 將 ImageData 轉換為 base64
            var canvas = document.createElement('canvas');
            canvas.width = imageData.width;
            canvas.height = imageData.height;
            var ctx = canvas.getContext('2d');
            ctx.putImageData(imageData, 0, 0);
            var base64 = canvas.toDataURL('image/jpeg', 1.0);

            if (base64.length < 10) {
                done({ error: 'empty base64' });
                return;
            }

            done(undefined, {
                duration: duration,
                videoHeight: videoHeight,
                videoWidth: videoWidth,
                base64: base64,
            });
        } catch (err) {
            done({ error: err.message || 'screenshot error' });
        }
    });

    // 掛載到 DOM，設定 autoplay 讓 mpv 開始播放並觸發 playing 事件
    document.body.appendChild(player);
    player.src = URL_MODULE.pathToFileURL(videoPath).href;
    player.muted = true;
    player.autoplay = true;
}