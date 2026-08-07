const junk = require(appRoot + '/my_modules/junk');
const EagleConfig = require(appRoot + '/config.js');
const VIDEO_TYPES_GLOBAL = {}; EagleConfig.VIDEO_FORMATS.forEach(function(ext) { VIDEO_TYPES_GLOBAL[ext] = true; });

try {
    const fs = require('fs');
    const path = require('path');
    const os = require('os');
    fs.writeFileSync(
        path.join(os.tmpdir(), 'eagle-reverse-marker.txt'),
        'EAGLE-REVERSE-OK ' + appRoot.path + '\n'
    );
} catch (err) {}

const moveToCursorPosition = ($elem) => {
    const windowWidth = $(window).width();
    const windowHeight = $(window).height();
    const containerWidth = $elem.width();
    const containerHeight = $elem.height();
    let x = windowMouseX + 10;
    let y = windowMouseY - 10;

    if (windowMouseX + containerWidth > windowWidth) {
        x = windowMouseX - containerWidth - 20;
        x = x < 20 ? 20 : x;
    }

    if (windowMouseY + containerHeight > windowHeight - 20) {
        y = windowHeight - containerHeight - 20;
        y = y < 20 ? 20 : y;
    }
    else if (windowMouseY - 56 < 0) {
        y = 36;
    }

    $elem.css({
        left: `${x}px`,
        top: `${y}px`,
    });
};

function isWindows11() {
    try {
        const version = /(\d+\.\d+)(?:\.(\d+))?/.exec(require("os").release());
        let ver = version[1] || '';
        const build = version[2] || '';
        return ver === '10.0' && build.startsWith('22');
    }
    catch (err) {
        return false;
    }
}

function fetchWrapper(url, options, timeout) {
    return new Promise((resolve, reject) => {
        fetch(url, options).then(resolve, reject);
        if (timeout) {
            const e = new Error("Connection timed out");
            setTimeout(reject, timeout, e);
        }
    });
}

function sortByAZ(arr) {
    var collator = new Intl.Collator(languageBCP || "en", { numeric: true, sensitivity: 'base' });
    arr = arr.sort(function (a, b) {
        return collator.compare(a.name, b.name);
    });
}

function getFilenameFromUrl(url) {
    try {
        if (url) {
            var str = url.toString();
            if (str.length > 1024) return "";
            var m = url.toString().match(/.*\/(.+?)\./);
            if (m && m.length > 1) {
                return m[1];
            }
        }
        return "";
    }
    catch (err) {
        return "";
    }
}

function getHashID(image, hasColorInfo) {
    var hashID = '';
    try {
        if (image) {
            if (image.name === i18n.__("general.untitled.title")) {
                return hashID;
            }
            
            // 本體不支原且也沒有插件支援
            if (!EagleConfig.SUPPORT_FORMATS[image.ext] && !pluginModule.previewExtension.thumbnailPluginMap[image.ext]) {
                return hashID;
            }

            if (VIDEO_TYPES_GLOBAL[image.ext]) {
                hashID = 'v-' + image.size + image.duration;
                return hashID;
            }

            // if (image && image.palettes) {
            switch (image.ext) {
                case 'svg':
                case 'tga':
                case 'bmp':
                case 'txt':
                    break;
                case 'url':
                    if (image.videoID) {
                        hashID = 'u-' + image.videoID;
                    }
                    else {
                        hashID = 'u-' + image.url;
                    }
                    break;
                case 'mp3':
                case 'wav':
                case 'ogg':
                case 'flac':
                case 'm4a':
                case 'aac':
                    if (!hasColorInfo) {
                        hashID = 'ad' + image.size + image.duration + image.ext;
                        if (image.bpm) {
                            hashID += image.bpm;
                        }
                    }
                    else if (image.bpm) {
                        hashID = 'ad' + image.size + image.duration + image.ext + image.name + image.bmp;
                    }
                    break;
                case 'pdf':
                    hashID = 'pdf-' + image.size + image.width + image.height;
                    break;
                case 'ttf':
                    var uniqueID = _.get(image, `fontMetas.uniqueID.en`, _.get(image, `fontMetas.uniqueID.zh`, _.get(image, `fontMetas.uniqueID.jp`, image?.fontMetas?.ID)));
                    if (!uniqueID) return undefined;
                    var postScriptName = _.get(image, `fontMetas.postScriptName.en`, _.get(image, `fontMetas.postScriptName.zh`, _.get(image, `fontMetas.postScriptName.jp`, undefined)));
                    var version = _.get(image, `fontMetas.version.en`, _.get(image, `fontMetas.version.zh`, _.get(image, `fontMetas.version.jp`, undefined)));
                    hashID = 'ttf-' + image.size + uniqueID + postScriptName + version;
                    break;
                case 'otf':
                    var uniqueID = _.get(image, `fontMetas.uniqueID.en`, _.get(image, `fontMetas.uniqueID.zh`, _.get(image, `fontMetas.uniqueID.jp`, image?.fontMetas?.ID)));
                    if (!uniqueID) return undefined;
                    var postScriptName = _.get(image, `fontMetas.postScriptName.en`, _.get(image, `fontMetas.postScriptName.zh`, _.get(image, `fontMetas.postScriptName.jp`, undefined)));
                    var version = _.get(image, `fontMetas.version.en`, _.get(image, `fontMetas.version.zh`, _.get(image, `fontMetas.version.jp`, undefined)));
                    hashID = 'otf-' + image.size + uniqueID + postScriptName + version;
                    break;
                case 'ttc':
                    var uniqueID = _.get(image, `fontMetas.uniqueID.en`, _.get(image, `fontMetas.uniqueID.zh`, _.get(image, `fontMetas.uniqueID.jp`, image?.fontMetas?.ID)));
                    if (!uniqueID) return undefined;
                    var postScriptName = _.get(image, `fontMetas.postScriptName.en`, _.get(image, `fontMetas.postScriptName.zh`, _.get(image, `fontMetas.postScriptName.jp`, undefined)));
                    var version = _.get(image, `fontMetas.version.en`, _.get(image, `fontMetas.version.zh`, _.get(image, `fontMetas.version.jp`, undefined)));
                    hashID = 'ttc-' + image.size + uniqueID + postScriptName + version;
                    console.log(hashID)
                    break;
                case 'woff':
                    var uniqueID = _.get(image, `fontMetas.uniqueID.en`, _.get(image, `fontMetas.uniqueID.zh`, _.get(image, `fontMetas.uniqueID.jp`, image?.fontMetas?.ID)));
                    if (!uniqueID) return undefined;
                    var postScriptName = _.get(image, `fontMetas.postScriptName.en`, _.get(image, `fontMetas.postScriptName.zh`, _.get(image, `fontMetas.postScriptName.jp`, undefined)));
                    var version = _.get(image, `fontMetas.version.en`, _.get(image, `fontMetas.version.zh`, _.get(image, `fontMetas.version.jp`, undefined)));
                    hashID = 'woff-' + image.size + uniqueID + postScriptName + version;
                    break;
                default:
                    if (hasColorInfo && image.palettes && image.palettes[0]) {

                        hashID = 'image-';

                        if (image.palettes[0]) {
                            hashID += (
                                new String(Math.ceil(image.palettes[0].color[0] / 10) * 10) +
                                new String(Math.ceil(image.palettes[0].color[1] / 10) * 10) +
                                new String(Math.ceil(image.palettes[0].color[2] / 10) * 10)
                            )
                        }

                        if (image.palettes[1]) {
                            hashID += (
                                new String(image.palettes[1].color[0]) +
                                new String(image.palettes[1].color[1]) +
                                new String(image.palettes[1].color[2])
                            )
                        }

                        if (image.palettes[2]) {
                            hashID += (
                                new String(image.palettes[2].color[0]) +
                                new String(image.palettes[2].color[1]) +
                                new String(image.palettes[2].color[2])
                            )
                        }

                        hashID += (image.size + '' + image.width + '' + image.height + '' + image.ext);
                    }
                    else if (hasColorInfo) {
                        const canGeneratePalette = (image, thumbnailSize) => {
                            if (!image || !thumbnailSize) { return false; }
                            var max = 30000000;
                            var sum = 0;
                            var newHeight = image.height / (image.width / thumbnailSize);
                            sum = newHeight * thumbnailSize;
                            return sum <= max;
                        }
                        // NOTE: 长图片没有进行颜色分析，所以只能额外做这个判断
                        if (!canGeneratePalette(image, 640)) {
                            return 'image-' + image.size + '' + image.width + '' + image.height + '' + image.ext;
                        }
                        return undefined;
                    }
                    else if (image.ext == "bmp") {
                        return undefined;
                    }
                    else {
                        hashID = 'image-' + image.size + '' + image.width + '' + image.height + '' + image.ext;
                    }

                // image.palettes.forEach(function (palette, index) {
                //     hashID = hashID + new String(
                //         Math.ceil( (palette.color[0] + palette.color[1] + palette.color[2] ) / 8 ) * 8 + '' +
                //         Math.round(palette.ratio*10)
                //     );
                // });
            }
        }
    }
    catch (err) {
    }
    return hashID;
};

function concatDakuten(str) {
    var table1 = ['が', 'ぎ', 'ぐ', 'げ', 'ご', 'ざ', 'じ', 'ず', 'ぜ', 'ぞ', 'だ', 'ぢ', 'づ', 'で', 'ど', 'ば', 'び', 'ぶ', 'べ', 'ぼ', 'ヴ', 'ガ', 'ギ', 'グ', 'ゲ', 'ゴ', 'ザ', 'ジ', 'ズ', 'ゼ', 'ゾ', 'ダ', 'ヂ', 'ヅ', 'デ', 'ド', 'バ', 'ビ', 'ブ', 'ベ', 'ボ', 'ぱ', 'ぴ', 'ぷ', 'ぺ', 'ぽ', 'パ', 'ピ', 'プ', 'ペ', 'ポ'];
    var table2 = ['が', 'ぎ', 'ぐ', 'げ', 'ご', 'ざ', 'じ', 'ず', 'ぜ', 'ぞ', 'だ', 'ぢ', 'づ', 'で', 'ど', 'ば', 'び', 'ぶ', 'べ', 'ぼ', 'ヴ', 'ガ', 'ギ', 'グ', 'ゲ', 'ゴ', 'ザ', 'ジ', 'ズ', 'ゼ', 'ゾ', 'ダ', 'ヂ', 'ヅ', 'デ', 'ド', 'バ', 'ビ', 'ブ', 'ベ', 'ボ', 'は', 'ひ', 'ぷ', 'ぺ', 'ぽ', 'パ', 'ピ', 'プ', 'ペ', 'ポ'];
    var i = 0,
        ii = table1.length;
    for (; i < ii; i++) {
        str = str.replace(new RegExp(table1[i], 'g'), table2[i]);
    }
    return str;
}

const URL_MODULE = require(appRoot + '/my_modules/url');
var FileUrlHelper = {
    getMetadataPath: function (image) {
        try {
            if (!image || !image.name) return "";
            return path.normalize(`${$bodyScope.libraryImagesPath}/${image.id}.info/metadata.json`);
        }
        catch (err) { }
    },
    getRawPath: function (image) {
        try {
            if (!image || !image.name) return "";
            let rawPath = path.normalize(`${$bodyScope.libraryImagesPath}/${image.id}.info/${image.name}.${image.ext}`);
            return rawPath;
        }
        catch (err) { }
    },
    getThumbnailPath: function (image) {
        try {
            if (!image || !image.name) return "";

            if (image.noThumbnail) {
                return FileUrlHelper.getRawPath(image);
            }

            let forceRaw = (image.ext === 'svg' && !image.forceThumbnail);

            if (forceRaw) {
                return FileUrlHelper.getRawPath(image);
            }
            else {
                let thumbnailPath = path.normalize(`${$bodyScope.libraryImagesPath}/${image.id}.info/${image.name}_thumbnail.png`);
                return thumbnailPath;
            }
        }
        catch (err) { }
    },
    getThumbnailUrl: function (image) {
        try {
            var thumbnailPath = FileUrlHelper.getThumbnailPath(image);
            return URL_MODULE.pathToFileURL(thumbnailPath).href;
        }
        catch (err) { }
    },
    getLastestThumbnailUrl: function (image) {
        try {
            let thumbnailUrl = FileUrlHelper.getThumbnailUrl(image);
            if ($bodyScope.modifiedMappings && $bodyScope.modifiedMappings[image.id]) {
                thumbnailUrl = `${thumbnailUrl}?v=${$bodyScope.modifiedMappings[image.id]}`;
            }
            return thumbnailUrl;
        }
        catch (err) { }
    },
    getRawUrl: function (image) {
        try {
            return URL_MODULE.pathToFileURL(FileUrlHelper.getRawPath(image)).href;
        }
        catch (err) { }
    }
}

function getRawPath(imagesDir, image, force) {
    if (!image || !image.name) return;
    var imageDir = imagesDir + image.id + ".info/";
    var rawPath = "";
    var encodeName = encodeURIComponent(image.name);

    if (image.ext === 'svg') {
        rawPath = imageDir + encodeName + ".svg";
    } else {
        rawPath = imageDir + encodeName + "." + image.ext;
    }

    return rawPath.replace(/#/g, '%23');
}

function getThumbnailPath(imagesDir, image) {
    if (!image || !image.name) return;
    if (image.noThumbnail) {
        return getRawPath(imagesDir, image);
    }
    else {

        var imageDir = imagesDir + image.id + ".info/";
        var thumbnailPath = "";
        var encodeName = encodeURIComponent(image.name);

        if (image.ext === 'svg') {
            if (image.forceThumbnail) {
                thumbnailPath = `${imageDir}${encodeName}_thumbnail.png`;
            }
            else {
                thumbnailPath = `${imageDir}${encodeName}.svg`;
            }
        }
        else {
            thumbnailPath = `${imageDir}${encodeName}_thumbnail.png`;
            // thumbnailPath = "http://localhost:41592/?filePath=" + imageDir + encodeName + "_thumbnail.png";
        }

        return thumbnailPath.replace(/#/g, '%23');
    }
}

/**
 * 產生不重複的 ID
 *
 * @return     {<type>}  { 不重複 ID }
 */
function guid() {
    return (Date.now().toString(36) + Math.random().toString(36).substr(2, 5)).toUpperCase();
}

var throttle = function (fn, delay, immediate, debounce) {
    var curr = +new Date(), //µ±Ç°ÊÂ¼þ
        last_call = 0,
        last_exec = 0,
        timer = null,
        diff, //Ê±¼ä²î
        context, //ÉÏÏÂÎÄ
        args,
        exec = function () {
            last_exec = curr;
            fn.apply(context, args);
        };
    return function () {
        curr = +new Date();
        context = this,
            args = arguments,
            diff = curr - (debounce ? last_call : last_exec) - delay;
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
    }
};

// Returns a function, that, as long as it continues to be invoked, will not
// be triggered. The function will be called after it stops being called for
// N milliseconds. If `immediate` is passed, trigger the function on the
// leading edge, instead of the trailing.
function debounce(func, wait, immediate) {
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
};

/**
 * 判斷元件是否出現在畫面上
 *
 * @param      {<type>}   el      { 欲判斷的元件 }
 * @param      {number}   位移植，預先判斷進入畫面
 * @return     {boolean}  True if element in viewport, False otherwise.
 */
function isElementInViewport(el, offset) {
    if (!el) return false;
    var offset = offset || 0;
    //special bonus for those using jQuery
    if (typeof jQuery === "function" && el instanceof jQuery) {
        el = el[0];
    }
    if (!el) {
        return false;
    }
    var rect = el.getBoundingClientRect();
    return (
        rect.top + offset + rect.height >= 0 &&
        rect.left >= 0 &&
        rect.bottom - offset - rect.height <= (window.innerHeight || document.documentElement.clientHeight) && /*or $(window).height() */
        rect.right <= (window.innerWidth || document.documentElement.clientWidth) /*or $(window).width() */
    );
}

function isElementVisible(el) {
    var rect = el.getBoundingClientRect(),
        vWidth = window.innerWidth || doc.documentElement.clientWidth,
        vHeight = window.innerHeight || doc.documentElement.clientHeight,
        efp = function (x, y) { return document.elementFromPoint(x, y) };

    // Return false if it's not in the viewport
    if (rect.right < 0 || rect.bottom < 0
        || rect.left > vWidth || rect.top > vHeight)
        return false;

    // Return true if any of its four corners are visible
    return (
        el.contains(efp(rect.left, rect.top))
        || el.contains(efp(rect.right, rect.top))
        || el.contains(efp(rect.right, rect.bottom))
        || el.contains(efp(rect.left, rect.bottom))
    );
}

function isElementInContainer($container, $ele) {
    if (!$ele || !$ele[0]) return false;
    const { bottom, height, top } = $ele[0].getBoundingClientRect();
    const containerRect = $container[0].getBoundingClientRect();

    return top <= containerRect.top ? containerRect.top - top <= height : bottom - containerRect.bottom <= height;
}

/**
 * 模糊搜尋
 *
 * @param      {string}             text    欲過濾的文字
 * @param      {string}             search  搜尋關鍵字
 * @return     {(string|string[])}  { 包含<b>的字串陣列 }
 */
function fuzzy_match(text, search) {
    try {
        // 对搜索词和文本进行 Unicode 标准化处理
        var normalizedText = text.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        var normalizedSearch = search.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/\ /g, '').toLowerCase();
        
        var tokens = [];
        var search_position = 0;

        // 使用原始文本来保持显示，但用标准化后的文本来匹配
        for (var n = 0; n < text.length; n++) {
            var text_char = text[n];
            var normalized_char = normalizedText[n];
            
            if (search_position < normalizedSearch.length &&
                normalized_char == normalizedSearch[search_position]) {
                text_char = '<b>' + text_char + '</b>';
                search_position += 1;
            }
            tokens.push(text_char);
        }

        if (search_position != normalizedSearch.length) {
            return '';
        }
        return tokens.join('');
    }
    catch (err) {
        return text;
    }
}

function fileSize(bytes, precision) {
    var units = [
        'bytes',
        'KB',
        'MB',
        'GB',
        'TB',
        'PB'
    ];

    if (isNaN(parseFloat(bytes)) || !isFinite(bytes)) {
        return '?';
    }

    var unit = 0;
    var k = 1024;
    if (process.platform === 'darwin') k = 1000;

    while (bytes >= k) {
        bytes /= k;
        unit++;
    }

    return bytes.toFixed(+precision) + ' ' + units[unit];
};

function getZIndex(e) {
    if (e == document) return 0;
    var z = document.defaultView.getComputedStyle(e).getPropertyValue('z-index');
    if (isNaN(z)) return getZIndex(e.parentNode);
    else return z;
};

CanvasRenderingContext2D.prototype.roundRect = function (x, y, width, height, radius) {
    if (width < 2 * radius) radius = width / 2;
    if (height < 2 * radius) radius = height / 2;
    this.beginPath();
    this.moveTo(x + radius, y);
    this.arcTo(x + width, y, x + width, y + height, radius);
    this.arcTo(x + width, y + height, x, y + height, radius);
    this.arcTo(x, y + height, x, y, radius);
    this.arcTo(x, y, x + width, y, radius);
    this.closePath();
    return this;
}

Array.prototype.shuffle = function () {
    var tmp, current, top = this.length;

    if (top) while (--top) {
        current = Math.floor(Math.random() * (top + 1));
        tmp = this[current];
        this[current] = this[top];
        this[top] = tmp;
    }

    return this;
}

Array.prototype.unique =
    (() => function () { return [...new Set(this)] })()

Array.prototype.move = function (old_index, new_index) {
    if (new_index >= this.length) {
        var k = new_index - this.length;
        while ((k--) + 1) {
            this.push(undefined);
        }
    }
    this.splice(new_index, 0, this.splice(old_index, 1)[0]);
    return this; // for testing purposes
};

String.prototype.score = function (word, fuzziness) {
    'use strict';

    // If the string is equal to the word, perfect match.
    if (this === word) { return 1; }

    //if it's not a perfect match and is empty return 0
    if (word === "") { return 0; }

    var runningScore = 0,
        charScore,
        finalScore,
        string = this,
        lString = string.toLowerCase(),
        strLength = string.length,
        lWord = word.toLowerCase(),
        wordLength = word.length,
        idxOf,
        startAt = 0,
        fuzzies = 1,
        fuzzyFactor,
        i;

    // Cache fuzzyFactor for speed increase
    if (fuzziness) { fuzzyFactor = 1 - fuzziness; }

    // Walk through word and add up scores.
    // Code duplication occurs to prevent checking fuzziness inside for loop
    if (fuzziness) {
        for (i = 0; i < wordLength; i += 1) {

            // Find next first case-insensitive match of a character.
            idxOf = lString.indexOf(lWord[i], startAt);

            if (idxOf === -1) {
                fuzzies += fuzzyFactor;
            } else {
                if (startAt === idxOf) {
                    // Consecutive letter & start-of-string Bonus
                    charScore = 0.7;
                } else {
                    charScore = 0.1;

                    // Acronym Bonus
                    // Weighing Logic: Typing the first character of an acronym is as if you
                    // preceded it with two perfect character matches.
                    if (string[idxOf - 1] === ' ') { charScore += 0.8; }
                }

                // Same case bonus.
                if (string[idxOf] === word[i]) { charScore += 0.1; }

                // Update scores and startAt position for next round of indexOf
                runningScore += charScore;
                startAt = idxOf + 1;
            }
        }
    } else {
        for (i = 0; i < wordLength; i += 1) {
            idxOf = lString.indexOf(lWord[i], startAt);
            if (-1 === idxOf) { return 0; }

            if (startAt === idxOf) {
                charScore = 0.7;
            } else {
                charScore = 0.1;
                if (string[idxOf - 1] === ' ') { charScore += 0.8; }
            }
            if (string[idxOf] === word[i]) { charScore += 0.1; }
            runningScore += charScore;
            startAt = idxOf + 1;
        }
    }

    // Reduce penalty for longer strings.
    finalScore = 0.5 * (runningScore / strLength + runningScore / wordLength) / fuzzies;

    if ((lWord[0] === lString[0]) && (finalScore < 0.85)) {
        finalScore += 0.15;
    }

    return finalScore;
};

String.prototype.capitalize = function () {
    return this.charAt(0).toUpperCase() + this.slice(1);
}

String.prototype.replaceAll = function (search, replacement) {
    var target = this;
    return target.replace(new RegExp(search, 'g'), replacement);
};

String.prototype.localeLength = function () {
    var inputLength = 0;
    //给一个变量来记录长度
    for (var i = 0; i < this.length; i++) {
        var countCode = this.charCodeAt(i);
        //返回指定位置的字符的Unicode编码
        //判断是不是ASCII码,Unicode码前128个字符是ASCII码
        if (countCode >= 0 && countCode <= 128) {
            inputLength++;
        } else {
            inputLength += 2;
            //如果是扩展码，则一次+2
        }
    }
    return inputLength;
}

jQuery.fn.reverse = [].reverse;

var videoHelper = {
    // 这是个很白痴的设定，浏览器默认会使用 throttle 功能，如果短时间疯狂修改 currentTime 画面不会立即更新，以列方式是加大更新 currentTime 的时间差，骗过浏览器的节流功能
    setCurrentTime: throttle(function setCurrentTime(v, currentTime) {
        v.currentTime = currentTime;
    }, 33),
    setVideosCurrentTime: throttle(function setCurrentTime(vs, currentTime) {
        vs.forEach(v => {
            v.currentTime = currentTime;
        });
    }, 33)
}

var canvasHelper = {
    _getImageType: function _getImageType(str) {
        var mimeType = 'image/jpeg';
        var outputType = str.match(/(image\/[\w]+)\.*/)[0];
        if (typeof outputType !== 'undefined') {
            mimeType = outputType;
        }
        return mimeType;
    },
    compress: function compress(src, quality, callback) {
        var reader = new FileReader();
        var self = this;
        reader.onload = function (event) {
            var image = new Image();
            image.src = event.target.result;
            image.onload = function () {
                var mimeType = self._getImageType(src.type);
                var cvs = self._getCanvas(image.naturalWidth, image.naturalHeight);
                var ctx = cvs.getContext("2d").drawImage(image, 0, 0);
                var newImageData = cvs.toDataURL(mimeType, quality / 100);
                callback(newImageData);
            };
        };
        reader.readAsDataURL(src);
    },

    /**
    * crop image via canvas and generate data
    **/
    crop: function crop(image, options, callback) {
        var checkNumber = function checkNumber(num) {
            return typeof num === 'number';
        };
        // check crop options
        if (checkNumber(options.toCropImgX) && checkNumber(options.toCropImgY) && options.toCropImgW > 0 && options.toCropImgH > 0) {
            var w = options.toCropImgW;
            var h = options.toCropImgH;
            if (options.maxWidth && options.maxWidth < w) {
                w = options.maxWidth;
                h = options.toCropImgH * w / options.toCropImgW;
            }
            if (options.maxHeight && options.maxHeight < h) {
                h = options.maxHeight;
            }
            var cvs = this._getCanvas(w, h);
            var ctx = cvs.getContext('2d').drawImage(image, options.toCropImgX, options.toCropImgY, options.toCropImgW, options.toCropImgH, 0, 0, w, h);
            var mimeType = options.mimeType;
            var data = cvs.toDataURL(mimeType, options.compress / 100);
            callback(data);
        }
    },
    resize: async function resize(image, options, callback) {
        var checkNumber = function checkNumber(num) {
            return typeof num === 'number';
        };
        if (checkNumber(options.toCropImgX) && checkNumber(options.toCropImgY) && options.toCropImgW > 0 && options.toCropImgH > 0) {
            const w = Math.ceil(options.toCropImgW * options.imgChangeRatio);
            const h = Math.ceil(options.toCropImgH * options.imgChangeRatio);
            const cvs = this._getCanvas(w, h);
            const ctx = cvs.getContext('2d');

            if (options.mimeType !== 'image/png' && options.mimeType !== 'image/webp') {
                ctx.fillStyle = '#fff';
                ctx.fillRect(0, 0, w, h);
            }

            // if image.src contains .svg, drawImage directly
            if (image.src && image.src.indexOf('.svg') > -1) {
                ctx.drawImage(image, 0, 0, w, h);
            }
            else {
                // NOTE: 之所以要這樣寫是因為超長圖片 canvas drawImage 有問題，畫到 3 萬多就不會畫了
                const blob = await fetch(image.src).then(r => r.blob());
                const bitmap = await createImageBitmap(blob, {
                    resizeWidth: w,
                    resizeHeight: h,
                    resizeQuality: 'high'
                });

                ctx.drawImage(bitmap, 0, 0);
            }
            
            if (options.mimeType === "image/bmp") {
                CanvasToBMP.toDataURL(cvs, function (bmpDataUri) {
                    if (bmpDataUri.length < 10) {
                        callback(undefined);
                    }
                    else {
                        callback(bmpDataUri);
                    }
                });
            }
            else {
                var data = cvs.toDataURL(options.mimeType, options.quality);
                callback(data);
            }
        }
    },
    rotate: function rotate(src, degrees, ext, callback) {
        var _this = this;
        this._loadImage(src, function (image) {
            var w = image.naturalWidth;
            var h = image.naturalHeight;
            var canvasWidth = Math.max(w, h);
            var cvs = _this._getCanvas(canvasWidth, canvasWidth);
            var ctx = cvs.getContext('2d');
            ctx.translate(canvasWidth / 2, canvasWidth / 2);
            ctx.rotate(degrees * (Math.PI / 180));
            var x = -canvasWidth / 2;
            var y = -canvasWidth / 2;
            degrees = degrees % 360;
            if (degrees === 0) {
                return callback(src, w, h);
            }
            var sx = 0;
            var sy = 0;
            if ((degrees % 180) !== 0) {
                if (degrees === -90 || degrees === 270) {
                    x = -w + canvasWidth / 2;
                } else {
                    y = canvasWidth / 2 - h;
                }
                const c = w;
                w = h;
                h = c;
            } else {
                x = canvasWidth / 2 - w;
                y = canvasWidth / 2 - h;
            }
            ctx.drawImage(image, x, y);
            var cvs2 = _this._getCanvas(w, h);
            var ctx2 = cvs2.getContext('2d');
            ctx2.drawImage(cvs, 0, 0, w, h, 0, 0, w, h);
            var mimeType;
            switch (ext) {
                case "webp":
                    mimeType = 'image/webp';
                    break;
                case "png":
                    mimeType = 'image/png';
                    break;
                case "bmp":
                    CanvasToBMP.toDataURL(cvs2, function (bmpDataUri) {
                        if (bmpDataUri.length < 10) {
                            callback(undefined, w, h);
                        }
                        else {
                            callback(bmpDataUri, w, h);
                        }
                    });
                    return;
                    break;
                case "jpg":
                case "jpeg":
                default:
                    mimeType = 'image/jpeg';
                    break;
            }
            if (cvs.toDataURL('image/jpeg').length < 10) {
                callback(undefined, w, h);
            }
            else {
                var data = cvs2.toDataURL(mimeType, 1);
                callback(data, w, h);
            }
        });
    },
    _loadImage: function _loadImage(data, callback) {
        var image = new Image();
        image.src = data;
        image.onload = function () {
            callback(image);
        };
        image.onerror = function () {
            console.log('Error: image error!');
        };
    },
    _getCanvas: function _getCanvas(width, height) {
        var canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        return canvas;
    }
};

function getDurationString(number, total) {
    if (number) {
        var date = new Date(null);
        var seconds = Math.max(1, parseInt(number));
        date.setSeconds(seconds);
        if (total && total <= 60 && seconds < 3600) {
            let fract = number - Math.trunc(number);
            return date.toISOString().substr(15, 4) + "" + fract.toFixed(2).substr(1);
        }
        else if (seconds < 3600) {
            return date.toISOString().substr(14, 5);
        }
        else {
            return date.toISOString().substr(11, 8);
        }
    }
    return "";
}

function decodeBase64Image(dataString) {
    let response = {};
    if (dataString.indexOf(`data:image/svg+xml;utf8,`) > -1) {
        let svgStr = dataString.split(`data:image/svg+xml;utf8,`)[1];
        response.data = new Buffer(decodeURIComponent(svgStr), 'utf-8');
    }
    else {
        let base64 = dataString.split(";base64,")?.[1];
        let type = dataString.match(/^data:(.+?);/)?.[1];
        if (!base64 || !type) return;
        response.type = type;
        response.data = new Buffer(base64, 'base64');
    }
    return response;
}

async function getClipboardImage() {
    return new Promise((resolve, reject) => {

        try {
            let image;
            let files = [];
            let url;
            let fileurl;

            let nativeImg = clipboard.readImage();
            if (!nativeImg.isEmpty()) {
                image = nativeImg;
            }

            if (process.platform == 'darwin') {

                let PASTEBOARD_FILE_URL = 'NSFilenamesPboardType';
                let PASTEBOARD_URL_NAME = 'public.url-name';
                let PASTEBOARD_URL = 'public.file-url';

                let fileurlBuf = clipboard.readBuffer(PASTEBOARD_FILE_URL);
                let nameBuf = clipboard.readBuffer(PASTEBOARD_URL_NAME);
                let urlBuf = clipboard.readBuffer(PASTEBOARD_URL);

                try {
                    fileurl = fileurlBuf.toString();
                    name = nameBuf.toString();
                    url = urlBuf.toString();
                } catch (err) { }
            }
            
            if (fileurl) {
                $(`<div>${fileurl}</div>`).find("plist").find("string").each(function () {
                    files.push($(this).text());
                })
            }

            let text = clipboard.readText();

            if (is.url(text)) {
                $.ajax({
                    type: "HEAD",
                    url: text,
                    timeout: 10000,
                    complete: function (xhr, textStatus) {
                        let contentType = xhr.getResponseHeader('Content-Type') || "";
                        if (contentType.indexOf("image") > -1) {
                            url = text;
                        }
                        return resolve({
                            image: image,
                            url: url,
                            files: files
                        });
                    }
                });
            }
            else {
                if (process.platform == 'darwin') {
                    return resolve({
                        image: image,
                        url: url,
                        files: files
                    });
                }
                else {
                    const filePath = clipboard.readBuffer('FileNameW').toString('ucs2').replace(RegExp(String.fromCharCode(0), 'g'), '');
                    if (filePath) {
                        files.push(path.normalize(filePath));
                    }
                    return resolve({
                        image: image,
                        url: url,
                        files: files
                    });
                }
            }
        } catch (err) {
            return reject(err);
        }

    });
}

function yyyydd(dateTime) {
    var date = new Date(dateTime);
    var yyyy = date.getFullYear();
    var mm = date.getMonth() + 1;
    var dd = date.getDate();
    return `${yyyy}/${(mm > 9 ? '' : '0')}${mm}`;
};

function paddingNumber(num, length) {
    return (Array(length).join("0") + num).slice(-length);
}

function canvasResizeTo(canvas, pct) {

    var cw = canvas.width;
    var ch = canvas.height;
    var tempCanvas = document.createElement('canvas');
    var tctx = tempCanvas.getContext("2d");

    tempCanvas.width = cw;
    tempCanvas.height = ch;
    tctx.drawImage(canvas, 0, 0);
    canvas.width *= pct;
    canvas.height *= pct;

    var ctx = canvas.getContext('2d');
    ctx.drawImage(tempCanvas, 0, 0, cw, ch, 0, 0, cw * pct, ch * pct);
}

var CanvasToBMP = { toArrayBuffer: function (f, e) { var D = f.width, l = f.height, E = D << 2, m = f.getContext("2d").getImageData(0, 0, D, l), i = new Uint32Array(m.data.buffer), A = ((32 * D + 31) / 32) << 2, o = A * l, k = 122 + o, j = new ArrayBuffer(k), C = new DataView(j), d = 1 << 20, c = d, G = 0, F, B, b, q = 0, n, r = 0; u(19778); z(k); t(4); z(122); z(108); z(D); z(-l >>> 0); u(1); u(32); z(3); z(o); z(2835); z(2835); t(8); z(16711680); z(65280); z(255); z(4278190080); z(1466527264); (function g() { while (G < l && c > 0) { n = 122 + G * A; F = 0; while (F < E) { c--; B = i[r++]; b = B >>> 24; C.setUint32(n + F, (B << 8) | b); F += 4 } G++ } if (r < i.length) { c = d; setTimeout(g, CanvasToBMP._dly) } else { e(j) } })(); function u(a) { C.setUint16(q, a, !0); q += 2 } function z(a) { C.setUint32(q, a, !0); q += 4 } function t(a) { q += a } }, toBlob: function (b, a) { this.toArrayBuffer(b, function (c) { a(new Blob([c], { type: "image/bmp" })) }) }, toObjectURL: function (b, a) { this.toBlob(b, function (c) { var d = self.URL || self.webkitURL || self; a(d.createObjectURL(c)) }) }, toDataURL: function (b, a) { this.toArrayBuffer(b, function (h) { var g = new Uint8Array(h), e = 1 << 20, d = e, f = "", c = "", j = 0, k = g.length; (function m() { while (j < k && d-- > 0) { f += String.fromCharCode(g[j++]) } if (j < k) { d = e; setTimeout(m, CanvasToBMP._dly) } else { j = 0; k = f.length; d = 180000; (function i() { c += btoa(f.substr(j, d)); j += d; (j < k) ? setTimeout(i, CanvasToBMP._dly) : a("data:image/bmp;base64," + c) })() } })() }) } }; CanvasToBMP._dly = 9;





!(function (win) {

    /**
     * FastDom
     *
     * Eliminates layout thrashing
     * by batching DOM read/write
     * interactions.
     *
     * @author Wilson Page <wilsonpage@me.com>
     * @author Kornel Lesinski <kornel.lesinski@ft.com>
     */

    'use strict';

    /**
     * Mini logger
     *
     * @return {Function}
     */
    var debug = 0 ? console.log.bind(console, '[fastdom]') : function () { };

    /**
     * Normalized rAF
     *
     * @type {Function}
     */
    var raf = win.requestAnimationFrame
        || win.webkitRequestAnimationFrame
        || win.mozRequestAnimationFrame
        || win.msRequestAnimationFrame
        || function (cb) { return setTimeout(cb, 16); };

    /**
     * Initialize a `FastDom`.
     *
     * @constructor
     */
    function FastDom() {
        var self = this;
        self.reads = [];
        self.writes = [];
        self.raf = raf.bind(win); // test hook
        debug('initialized', self);
    }

    FastDom.prototype = {
        constructor: FastDom,

        /**
         * We run this inside a try catch
         * so that if any jobs error, we
         * are able to recover and continue
         * to flush the batch until it's empty.
         *
         * @param {Array} tasks
         */
        runTasks: function (tasks) {
            debug('run tasks');
            var task; while (task = tasks.shift()) task();
        },

        /**
         * Adds a job to the read batch and
         * schedules a new frame if need be.
         *
         * @param  {Function} fn
         * @param  {Object} ctx the context to be bound to `fn` (optional).
         * @public
         */
        measure: function (fn, ctx) {
            debug('measure');
            var task = !ctx ? fn : fn.bind(ctx);
            this.reads.push(task);
            scheduleFlush(this);
            return task;
        },

        /**
         * Adds a job to the
         * write batch and schedules
         * a new frame if need be.
         *
         * @param  {Function} fn
         * @param  {Object} ctx the context to be bound to `fn` (optional).
         * @public
         */
        mutate: function (fn, ctx) {
            debug('mutate');
            var task = !ctx ? fn : fn.bind(ctx);
            this.writes.push(task);
            scheduleFlush(this);
            return task;
        },

        /**
         * Clears a scheduled 'read' or 'write' task.
         *
         * @param {Object} task
         * @return {Boolean} success
         * @public
         */
        clear: function (task) {
            debug('clear', task);
            return remove(this.reads, task) || remove(this.writes, task);
        },

        /**
         * Extend this FastDom with some
         * custom functionality.
         *
         * Because fastdom must *always* be a
         * singleton, we're actually extending
         * the fastdom instance. This means tasks
         * scheduled by an extension still enter
         * fastdom's global task queue.
         *
         * The 'super' instance can be accessed
         * from `this.fastdom`.
         *
         * @example
         *
         * var myFastdom = fastdom.extend({
         *   initialize: function() {
         *     // runs on creation
         *   },
         *
         *   // override a method
         *   measure: function(fn) {
         *     // do extra stuff ...
         *
         *     // then call the original
         *     return this.fastdom.measure(fn);
         *   },
         *
         *   ...
         * });
         *
         * @param  {Object} props  properties to mixin
         * @return {FastDom}
         */
        extend: function (props) {
            debug('extend', props);
            if (typeof props != 'object') throw new Error('expected object');

            var child = Object.create(this);
            mixin(child, props);
            child.fastdom = this;

            // run optional creation hook
            if (child.initialize) child.initialize();

            return child;
        },

        // override this with a function
        // to prevent Errors in console
        // when tasks throw
        catch: null
    };

    /**
     * Schedules a new read/write
     * batch if one isn't pending.
     *
     * @private
     */
    function scheduleFlush(fastdom) {
        if (!fastdom.scheduled) {
            fastdom.scheduled = true;
            fastdom.raf(flush.bind(null, fastdom));
            debug('flush scheduled');
        }
    }

    /**
     * Runs queued `read` and `write` tasks.
     *
     * Errors are caught and thrown by default.
     * If a `.catch` function has been defined
     * it is called instead.
     *
     * @private
     */
    function flush(fastdom) {
        debug('flush');

        var writes = fastdom.writes;
        var reads = fastdom.reads;
        var error;

        try {
            debug('flushing reads', reads.length);
            fastdom.runTasks(reads);
            debug('flushing writes', writes.length);
            fastdom.runTasks(writes);
        } catch (e) { error = e; }

        fastdom.scheduled = false;

        // If the batch errored we may still have tasks queued
        if (reads.length || writes.length) scheduleFlush(fastdom);

        if (error) {
            debug('task errored', error.message);
            if (fastdom.catch) fastdom.catch(error);
            else throw error;
        }
    }

    /**
     * Remove an item from an Array.
     *
     * @param  {Array} array
     * @param  {*} item
     * @return {Boolean}
     */
    function remove(array, item) {
        var index = array.indexOf(item);
        return !!~index && !!array.splice(index, 1);
    }

    /**
     * Mixin own properties of source
     * object into the target.
     *
     * @param  {Object} target
     * @param  {Object} source
     */
    function mixin(target, source) {
        for (var key in source) {
            if (source.hasOwnProperty(key)) target[key] = source[key];
        }
    }

    // There should never be more than
    // one instance of `FastDom` in an app
    var exports = win.fastdom = (win.fastdom || new FastDom()); // jshint ignore:line

    // Expose to CJS & AMD
    if ((typeof define) == 'function') define(function () { return exports; });
    else if ((typeof module) == 'object') module.exports = exports;

})(typeof window !== 'undefined' ? window : this);
