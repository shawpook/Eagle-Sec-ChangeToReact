const fs = require('fs');
const appRoot = require('app-root-path');
const { ipcRenderer } = require('electron');
const URL_MODULE = require(appRoot + '/my_modules/url');

module.exports = async ({ src, dest, item }) => {
    return new Promise(async (resolve, reject) => {
        try {
            let result = await audio2image(src, dest);
            
            // 無法產生縮圖時，改用 native 方式處理
            if (!fs.existsSync(dest)) {
                return reject(new Error(`Tga thumbnail generate fail.`));
            }

            item.width = result?.width ?? item.width;
            item.height = result?.height ?? item.height;
            item.duration = result?.duration ?? item.duration;
            item.bpm = result?.bpm ?? item.bpm;

            return resolve(item);
        }
        catch (err) {
            return reject(err);
        }
    });
}

async function audio2image(audioPath, dest, callback) {
    return new Promise(async (resolve, reject) => {
        var audioProcessTimeout;
        var hasCallback = false;
        var returnResolve = function (param) {
            try {
                clearTimeout(audioProcessTimeout);
                if (!hasCallback) {
                    hasCallback = true;
                    return resolve(param);
                }
            }
            catch (err) {
                ipcRenderer.send('electron-log', "" + err.stack || err);
            }
        }

        var returnReject = function (param) {
            clearTimeout(audioProcessTimeout);
            if (!hasCallback) {
                hasCallback = true;
                return reject(param);
            }
        }

        // 根據音頻長度動態調整超時時間
        var timeoutDuration = 60000; // 預設1分鐘
        
        audioProcessTimeout = setTimeout(function () {
            returnReject(new Error('Audio process timeout.'));
            ipcRenderer.send('electron-log', "[bg] Process audio file timeout, path: " + audioPath);
        }, timeoutDuration);

        getAudioMetadata(audioPath, function (err, metadata) {

            var height = 140;
            var width = 280;
            var duration;

            if (err) {
                returnReject(new Error(`[bg] Audio process failed, error type is ${err.error}`));
                return;
            }

            // 針對超長音頻的特殊處理
            if (metadata && metadata.duration > 3600) {
                ipcRenderer.send('electron-log', `[bg] Processing long audio file (${metadata.duration}s), using optimized sampling`);
                
                // 重新設定超時時間，給長音頻更多處理時間
                clearTimeout(audioProcessTimeout);
                var extendedTimeout = Math.min(180000, 60000 + (metadata.duration / 3600) * 60000); // 最多3分鐘
                audioProcessTimeout = setTimeout(function () {
                    returnReject(new Error('Audio process timeout.'));
                    ipcRenderer.send('electron-log', "[bg] Process long audio file timeout, path: " + audioPath);
                }, extendedTimeout);
                
                ipcRenderer.send('electron-log', `[bg] Extended timeout to ${extendedTimeout/1000}s for long audio processing`);
            }

            if (metadata) {
                duration = metadata.duration;

                var containerId = "audio-wavesurfer-" + guid();
                var $container = jQuery(`<div id="${containerId}" class="waveform"></div>`);
                jQuery("body").append($container);

                var WaveSurfer = new require(appRoot.path + "/app/js/vendors/wavesurfer.min.js");

                // 強制使用 44.1kHz AudioContext（若支援），避免外接音效卡高取樣率導致巨大 buffer
                var wsAudioContext;
                try {
                    var AC = window.AudioContext || window.webkitAudioContext;
                    wsAudioContext = new AC({ sampleRate: 44100 });
                }
                catch (e) {
                    try {
                        var AC2 = window.AudioContext || window.webkitAudioContext;
                        wsAudioContext = new AC2();
                    }
                    catch (e2) {
                        wsAudioContext = null;
                    }
                }

                var wavesurfer = WaveSurfer.create({
                    container: "#" + containerId,
                    waveColor: '#0072EF',
                    progressColor: '#0072EF',
                    cursorColor: "#fff",
                    normalize: true,
                    forceDecode: false,
                    height: 140,
                    // 我們自行管理 context 的生命週期
                    closeAudioContext: false,
                    audioContext: wsAudioContext || undefined,
                });

                wavesurfer.once('ready', function () {
                    let delay = 10;
                    let buffer = wavesurfer.backend.buffer;
                    if (process.platform !== 'darwin') {
                        currentWindow.show();
                        delay = 333;
                    }
                    setTimeout(function () {
                        try {
                            var canvas = wavesurfer.drawer.canvases[0].wave;
                            var base64 = canvas.toDataURL("image/png");
                            var decode = decodeBase64Image(base64);
                            if (!decode || !decode.data) {
                                ipcRenderer.send('electron-log', "[bg] wavesurfer buffer is null");
                                returnReject(new Error(`[bg] wavesurfer buffer is null`));
                                return;
                            }

                            // 写入前先备份，若发生失败要复原
                            fs.writeFile(dest, decode.data, function (err) {
                                if (err) {
                                    ipcRenderer.send('electron-log', "" + err.stack || err);
                                    returnReject(err);
                                    return;
                                }
                                else {
                                    getAudioBPM(buffer, function (err, bpm) {
                                        if (err) {
                                            ipcRenderer.send('electron-log', "" + err);
                                        }
                                        returnResolve({ height: height, width: width, duration: duration, bpm: bpm });
                                    });
                                }
                            });
                            wavesurfer.destroy();
                            if (wsAudioContext && typeof wsAudioContext.close === 'function' && wsAudioContext.state !== 'closed') {
                                try { wsAudioContext.close(); } catch (e) {}
                            }
                            $container.remove();
                        }
                        catch (err) {
                            returnReject(err);
                            return;
                        }
                    }, delay);
                });

                wavesurfer.on('error', function (err) {
                    if (err === "Error decoding audiobuffer") {
                        wavesurfer.destroy();
                        $container.remove();
                        returnReject(err);
                        ipcRenderer.send('electron-log', "[bg] An abnormal audio file added by the user may cause abnormal background functions");
                    }
                });

                try {
                    var request = new XMLHttpRequest();
                    request.open("GET", URL_MODULE.pathToFileURL(audioPath).href, true);
                    request.responseType = "arraybuffer";
                    
                    // 針對長音頻設定範圍請求頭部，只下載前面部分用於生成縮圖
                    if (duration > 3600) {
                        // 對於超過1小時的音頻，只載入前10分鐘的數據用於生成波形
                        request.setRequestHeader("Range", "bytes=0-10485760"); // 10MB，足夠長音頻的縮圖生成
                        ipcRenderer.send('electron-log', `[bg] Using partial loading for long audio file`);
                    }
                    
                    request.onerror = function (e) {
                        returnReject(new Error(`Can't load audio file: ${audioPath}`));
                    };
                    request.onload = function () {
                        wavesurfer.loadArrayBuffer(request.response);
                    };
                    request.send();
                    // wavesurfer.loadArrayBuffer(fs.readFileSync(audioPath).buffer);
                }
                catch (err) {
                    ipcRenderer.send('electron-log', err.stack || err);
                    returnReject(err);
                    return;
                }
            }
        });
    });

    function getAudioMetadata(audioPath, callback) {

        var audio = document.createElement('audio');
        var hasCallback = false;
        audio.src = URL_MODULE.pathToFileURL(audioPath).href;
        // audio.preload = 'metadata';
        audio.muted = 'muted';

        audio.addEventListener('abort', function () {
            if (!hasCallback) {
                hasCallback = true;
                callback({ error: 'abort' });
                audio.pause();
                audio.src = "";
                audio.load();
            }
        });

        audio.addEventListener('error', function () {
            if (!hasCallback) {
                hasCallback = true;
                callback({ error: 'error' });
                audio.pause();
                audio.src = "";
                audio.load();
            }
        });

        audio.addEventListener('loadeddata', function () {
            audio.play().then(function () { }, function (err) {
                hasCallback = true;
                callback({ error: 'error' });
                audio.src = "";
                audio.load();
            });
        });

        audio.addEventListener('playing', function () {
            if (!hasCallback) {
                hasCallback = true;
                callback(undefined, {
                    duration: audio.duration,
                });
                audio.pause();
                audio.removeAttribute('src');
                audio.load();
            }
        });
    }

};

function getAudioBPM (buffer, callback) {

    const audioBufferSlice = require(appRoot + '/my_modules/audiobuffer-slice');

    const processBuffer = function (buf) {
        try {
            var audioData = [];
            // Take the average of the two channels
            if (buf.numberOfChannels == 2) {
                var channel1Data = buf.getChannelData(0);
                var channel2Data = buf.getChannelData(1);
                var length = channel1Data.length;
                for (var i = 0; i < length; i++) {
                    audioData[i] = (channel1Data[i] + channel2Data[i]) / 2;
                }
            } 
            else {
                audioData = buf.getChannelData(0);
            }
            
            var mt = new MusicTempo(audioData);
            if (mt && mt.tempo) {
                callback(undefined, parseFloat(mt.tempo));
            }
            else {
                callback("tempo is undefined");
            }
        }
        catch (err) {
            callback && callback(err);
        }
    }

    // 根據音頻長度動態調整取樣策略
    var sampleDuration;
    if (buffer.duration > 3600) {
        sampleDuration = 60; // 超過1小時只取前1分鐘
    } else if (buffer.duration > 600) {
        sampleDuration = 120; // 超過10分鐘只取前2分鐘
    } else if (buffer.duration > 180) {
        sampleDuration = 180; // 超過3分鐘只取前3分鐘
    }
    
    if (sampleDuration && buffer.duration > sampleDuration) {
        audioBufferSlice(buffer, 0, sampleDuration * 1000, function(error, sliceBuffer) {
            if (error) {
                callback && callback(error);
            } 
            else {
                processBuffer(sliceBuffer);
            }
        });
    }
    else {
        processBuffer(buffer);
    }
}