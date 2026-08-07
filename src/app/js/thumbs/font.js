const fs = require('fs');
const appRoot = require('app-root-path');

let generateFontQueue = async.queue(async.timeout(generateFontQueueCallback, 60000), 1);

module.exports = async ({ src, dest, item }) => {
    return new Promise(async (resolve, reject) => {
        try {
			try {
				let result = await font2image(src, dest,item);

				item.height = result?.height || item.height;
            	item.width = result?.width || item.width;
				item.fontMetas = result?.fontMetas || item.fontMetas;

                if (!item.fontMetas?.postScriptName?.en) {
                    if (item.fontMetas?.fontFamily?.en) {
                        try {
                            item.fontMetas.postScriptName = {
                                ...item.fontMetas.postScriptName,
                                en: require('md5')(item.fontMetas.fontFamily.en)
                            };
                            if (!item.fontMetas?.fullName?.en) {
                                item.fontMetas.fullName = {
                                    ...item.fontMetas.fullName,
                                    en: item.fontMetas.postScriptName.en
                                };
                            }
                        }
                        catch (err) {}
                    }
                }

				if (preferences?.font?.autoTag === 'true') {
					if (item?.fontMetas?.weight) {
						if (item?.tags) {
							item.tags.push(item.fontMetas.weight);
						}
						else {
							item.tags = [item.fontMetas.weight];
						}
					}
				}

				if (!fs.existsSync(dest)) {
					return reject(new Error(`Font file thumbnail generate fail.`));
				}

				return resolve(item);
			}
			catch (err) {
				return reject(err);
			}        
        }
        catch (err) {
            return reject(err);
        }
    });
}

async function font2image (src, dest, item) {
	return new Promise(async (resolve, reject) => {
		generateFontQueue.push({ 
			fontMetas: item.fontMetas, 
			fontPath: src,
			output: dest, 
			callback: (result) => {
				if (result.error) {
					return reject(new Error(`Can not generate font thumbnail: ${src}`));
				}
				result.width = 600;
				result.height = 600;
				return resolve(result);
			}
		});
	});
}

function generateFontQueueCallback ({ fontMetas, fontPath, output, callback }, nextCallback) {

    var oldFileName = path.basename(fontPath).replace(path.extname(fontPath), "");
    var fileName = oldFileName.replace(/[({.})]/ig,"").replace(/\s/g, "").replace(/[@#$%^&*()<>:'"\/\\|?*]/g, "");
    var fontFamily = guid() + fileName;
    var baseName = fileName + path.extname(fontPath);
    var fixedFontPath = path.normalize(path.dirname(fontPath) + "/" + baseName);

    try {
        if (oldFileName.indexOf("?") > -1 || oldFileName.indexOf("#") > -1) {
            fse.moveSync(fontPath, fixedFontPath, { overwrite: true });
            fontPath = fixedFontPath;
        }
        else if (decodeURIComponent(oldFileName) !== oldFileName) {
            fse.moveSync(fontPath, fixedFontPath, { overwrite: true });
            fontPath = fixedFontPath;
        }
    } catch (err) {}

    var lang = "en";

    readFont(fontPath, function (result) {

        if (!result || !result.font) {
            callback({ error: true });
            nextCallback();
            ipcRenderer.send('electron-log', "[bg] Unable to parse font file: " + fontPath);
            return;
        }

        if (result.supportCN && result.supportTW) { lang = 'zh_CN'; }
        else if (result.fontMetas.postScriptName && result.fontMetas.postScriptName.ja) { lang = 'jp'; }
        // else if (result.fontMetas.postScriptName && result.fontMetas.postScriptName.kr) { lang = 'kr'; }
        else if (result.supportCN && result.fontMetas.postScriptName && result.fontMetas.postScriptName.zh) { lang = 'zh_CN'; }
        else if (result.supportTW && result.fontMetas.postScriptName && result.fontMetas.postScriptName["zh_TW"]) { lang = 'zh_TW'; }
        else if (result.supportCN) { lang = 'zh_CN'; }
        else if (result.supportKR) { lang = 'kr'; }
        else if (result.supportTW) { lang = 'zh_TW'; }
        else if (result.supportJP) { lang = 'jp'; }
        else { lang = 'en'; }

        if (fontMetas && fontMetas.preferLng) {
            result.fontMetas.preferLng = fontMetas.preferLng;
            lang = fontMetas.preferLng;
        }

        var fontUrl = URL_MODULE.pathToFileURL(fontPath).href.replace(/'/g, "%27");
        var font = new FontFace(fontFamily, `url('${fontUrl}')`);

        font.load().then(function() {

            fontLoadSuccess({lang, fontFamily, font, result, output, callback, nextCallback});

        }, function (err) {
            console.error(`字体格式异常，无法支持预览: ${fontFamily}`);
            ipcRenderer.send('electron-log', "[bg] Missing CMap properties, Unable to preview font file: " + decodeURI(fontPath));
            fontLoadError({lang, fontFamily, font, result, output, callback, nextCallback});
        });
    });
}

function fontLoadSuccess ({lang, fontFamily, font, result, output, callback, nextCallback}) {
    document.fonts.add(font);
    var $preview;
    switch (lang) {
        case 'zh_CN':
            $preview = jQuery(`<div class="font-preview"><div class="font-text" style="width: 380px; text-align: center; font-size: 100px;"><span>永和九年</span><span>岁在癸丑</span><span style="font-size: 82px;">AaBbCcDd</span><span style="font-size: 82px;">01234567</span></div><div class="font-name">${fontFamily}</div>`)
            break;
        case 'jp':
            $preview = jQuery(`<div class="font-preview"><div class="font-text" style="width: 380px; text-align: center; font-size: 100px;"><span>あなやわ</span><span>永和九年</span><span style="font-size: 82px;">AaBbCcDd</span><span style="font-size: 82px;">01234567</span></div><div class="font-name">${fontFamily}</div>`)
            break;
        case 'zh_TW':
            $preview = jQuery(`<div class="font-preview"><div class="font-text" style="width: 380px; text-align: center; font-size: 100px;"><span>永和九年</span><span>歲在癸丑</span><span style="font-size: 82px;">AaBbCcDd</span><span style="font-size: 82px;">01234567</span></div><div class="font-name">${fontFamily}</div>`)
            break;
        case 'kr':
            $preview = jQuery(`<div class="font-preview"><div class="font-text" style="width: 380px; text-align: center; font-size: 90px;"><span>파도가푸르</span><span style="font-size: 82px;">AaBbCcDd</span><span style="font-size: 82px;">01234567</span></div><div class="font-name">${fontFamily}</div>`)
            break;
        case 'en':
        default:
            $preview = jQuery(`<div class="font-preview"><div class="font-text" style="font-size: 90px;"><span>ABCDEFG</span><span>abcdefg</span><span>0123456</span></div><div class="font-name">${fontFamily}</div>`)
    }
    $preview.appendTo("body");
    $preview.css("font-family", `'${fontFamily}', Fallback Outline`);
    document.body.style.display = "block";
    var html2canvas = require(appRoot.path + "/app/js/vendors/html2canvas.min.js");
    html2canvas($preview[0], {
        async: false,
    }).then(canvas => {
        try {
            document.fonts.delete(font);
        }
        catch (err) {}
        var base64data = canvas.toDataURL("image/jpeg", 1);
        var buffer = decodeBase64Image(base64data).data;
        fs.writeFileSync(output, buffer);
        $preview.remove();
        callback({ 
            error: false,
            fontMetas: result.fontMetas,
            fixedPath: result.fixedPath,
        });
        nextCallback();
    }, function () {
        callback({ error: true });
        nextCallback();
    });
}

function fontLoadError ({lang, fontFamily, font, result, output, callback, nextCallback}) {
    var $preview;
    switch (lang) {
        case 'zh_CN':
            $preview = jQuery(`<div class="font-preview"><div class="font-text" style="width: 380px; text-align: center; font-size: 100px;"><span>永和九年</span><span>岁在癸丑</span><span style="font-size: 82px;">AaBbCcDd</span><span style="font-size: 82px;">01234567</span></div><div class="font-name">${fontFamily}</div>`)
            break;
        case 'jp':
            $preview = jQuery(`<div class="font-preview"><div class="font-text" style="width: 380px; text-align: center; font-size: 100px;"><span>あなやわ</span><span>永和九年</span><span style="font-size: 82px;">AaBbCcDd</span><span style="font-size: 82px;">01234567</span></div><div class="font-name">${fontFamily}</div>`)
            break;
        case 'zh_TW':
            $preview = jQuery(`<div class="font-preview"><div class="font-text" style="width: 380px; text-align: center; font-size: 100px;"><span>永和九年</span><span>歲在癸丑</span><span style="font-size: 82px;">AaBbCcDd</span><span style="font-size: 82px;">01234567</span></div><div class="font-name">${fontFamily}</div>`)
            break;
        case 'kr':
            $preview = jQuery(`<div class="font-preview"><div class="font-text" style="width: 380px; text-align: center; font-size: 90px;"><span>파도가푸르</span><span style="font-size: 82px;">AaBbCcDd</span><span style="font-size: 82px;">01234567</span></div><div class="font-name">${fontFamily}</div>`)
            break;
        case 'en':
        default:
            $preview = jQuery(`<div class="font-preview"><div class="font-text" style="font-size: 90px;"><span>ABCDEFG</span><span>abcdefg</span><span>0123456</span></div><div class="font-name">${fontFamily}</div>`)
    }
    $preview.appendTo("body");
    $preview.css("font-family", `'${fontFamily}', Fallback Outline`);
    document.body.style.display = "block";
    var html2canvas = require(appRoot.path + "/app/js/vendors/html2canvas.min.js");
    html2canvas($preview[0], {
        async: false,
    }).then(canvas => {
        try {
            document.fonts.delete(font);
        }
        catch (err) {}
        var base64data = canvas.toDataURL("image/jpeg", 1);
        var buffer = decodeBase64Image(base64data).data;
        fs.writeFileSync(output, buffer);
        $preview.remove();
        callback({ 
            error: false,
            fontMetas: result.fontMetas,
        });
        nextCallback();
    }, function () {
        callback({ error: true });
        nextCallback();
    });
}

function readFont (fontPath, callback, retry) {

    const opentype = require(appRoot + '/my_modules/opentype');
    opentype.load(fontPath, function(err, font) {

        if (err) {
            console.log(err);

            if (retry) {
                console.log("確認無法修復")
                callback(undefined);
                return;
            }

            loadFontTypr(fontPath, function (resp) {
                try {
					const Typr = require(appRoot.path +'/app/js/vendors/Typr.js');
                    var parsed = Typr.parse(resp);
                    var font = parsed && parsed[0];
                    // console.log(font.name);
                    if (font && font.name) {

                        var fullName = font.name.fontFamily;
                        var manufacturerURL = font.name.urlDesigner || "";
                        var designer = font.name.designer || "";
                        var copyright = font.name.copyright || "";
                        var preferredSubfamily = font.name.fontSubfamily || "";

                        // console.log(`正在解析:【${fullName}】`)
                        // var fontMetas = {... font.names };

                        var fontMetas = {
                            "copyright": { en: font.name.copyright },
                            "fontFamily": { en: font.name.fontFamily },
                            "fontSubfamily": { en: font.name.fontSubfamily },
                            "preferredFamily": { en: font.name.fontSubfamily },
                            "preferredSubfamily": { en: font.name.fontSubfamily },
                            "ID": font.name.ID,
                            "fullName": { en: font.name.fullName },
                            "version": { en: font.name.version },
                            "postScriptName": { en: font.name.postScriptName },
                            "trademark": { en: font.name.trademark },
                            "manufacturer": { en: font.name.manufacturer },
                            "designer": { en: font.name.designer },
                            "description": { en: font.name.description },
                            "manufacturerURL": { en: font.name.urlVendor },
                            "designerURL": { en: font.name.urlDesigner },
                            "license": { en: font.name.licence },
                            "licenseURL": { en: font.name.licenceURL },
                            "typoFamilyName": { en: font.name.typoFamilyName },
                            "typoSubfamilyName": { en: font.name.typoSubfamilyName },
                            "compatibleFull": { en: font.name.compatibleFull },
                            "sampleText": { en: font.name.sampleText },
                            "postScriptCID": { en: font.name.postScriptCID },
                            "wwsFamilyName": { en: font.name.wwsFamilyName },
                            "wwsSubfamilyName": { en: font.name.wwsSubfamilyName },
                            "lightPalette": { en: font.name.lightPalette },
                            "darkPalette": { en: font.name.darkPalette }
                        };

                        fontMetas.numGlyphs = font.maxp && font.maxp.numGlyphs;

                        // 包含字詞測試
                        var supportCN = !!font.name.supportCN;
                        var supportTW = !!font.name.supportTW;
                        var supportEN = !!font.name.supportEN;
                        var supportJP = !!font.name.supportJP;
                        var supportKR = !!font.name.supportKR;

                        fontMetas.support = {};

                        if (supportCN) { fontMetas.support["zh_CN"] = true; }
                        if (supportTW) { fontMetas.support["zh_TW"] = true; }
                        if (supportJP) { fontMetas.support["jp"] = true; }
                        if (supportKR) { fontMetas.support["kr"] = true; }

                        var postScriptName = (font.name.postScriptName && font.name.postScriptName.toLowerCase()) || "";
                        var weight;
                        // 如果字体本身没有包含这些信息，
                        if (postScriptName) {
                            if (postScriptName.toLowerCase().indexOf("thin") > -1) { weight = "Thin"; }
                            else if (postScriptName.toLowerCase().indexOf("hairline") > -1) { weight = "Hairline"; }
                            else if (postScriptName.toLowerCase().indexOf("extralight") > -1) { weight = "ExtraLight"; }
                            else if (postScriptName.toLowerCase().indexOf("ultralight") > -1) { weight = "UltraLight"; }
                            else if (postScriptName.toLowerCase().indexOf("light") > -1) { weight = "Light"; }
                            else if (postScriptName.toLowerCase().indexOf("regular") > -1) { weight = "Regular"; }
                            else if (postScriptName.toLowerCase().indexOf("normal") > -1) { weight = "Regular"; }
                            else if (postScriptName.toLowerCase().indexOf("medium") > -1) { weight = "Medium"; }
                            else if (postScriptName.toLowerCase().indexOf("demibold") > -1) { weight = "DemiBold"; }
                            else if (postScriptName.toLowerCase().indexOf("semibold") > -1) { weight = "SemiBold"; }
                            else if (postScriptName.toLowerCase().indexOf("bold") > -1) { weight = "Bold"; }
                            else if (postScriptName.toLowerCase().indexOf("extrabold") > -1) { weight = "ExtraBold"; }
                            else if (postScriptName.toLowerCase().indexOf("ultrabold") > -1) { weight = "UltraBold"; }
                            else if (postScriptName.toLowerCase().indexOf("black") > -1) { weight = "Black"; }
                            else if (postScriptName.toLowerCase().indexOf("extrablack") > -1) { weight = "ExtraBlack"; }
                            else if (postScriptName.toLowerCase().indexOf("heavy") > -1) { weight = "Heavy"; }

                            if (!weight) {
                                weight = _.get(fontMetas, `preferredSubfamily.en`, _.get(fontMetas, `fontSubfamily.en`, 'Regular'));
                            }

                            if (["Thin","Hairline","ExtraLight","UltraLight","Light","Regular","Regular","Medium","SemiBold","DemiBold","Bold","ExtraBold","Black","Black","UltraBold","ExtraBlack", "Heavy"].indexOf(weight) === -1) {
                                weight = undefined;   
                            }

                            if (!weight) {
                                weight = 'Regular';
                            }

                            if (weight && weight.toLowerCase().indexOf("italic") === -1 && postScriptName.toLowerCase().indexOf("italic") > -1) {
                                weight += " Italic";
                            }
                        }
                        else {
                            weight = "Regular";
                        }

                        // console.log(weight);

                        fontMetas.weight = weight;

                        callback({
                            font: font,
                            supportCN: supportCN,
                            supportTW: supportTW,
                            supportJP: supportJP,
                            supportKR: supportKR,
                            supportEN: supportEN,
                            fontMetas: fontMetas
                        });
                    }
                    else {
                        callback(undefined);
                    }
                }
                catch (err) {
                    callback(undefined);
                }
            });
            return;
        }

        if (Object.keys(font.names).length === 0 ) {
            let fakeName = guid();
            font.names = {
                postScriptName: { en: fakeName },
                fullName: { en: fakeName },
            }
        }

        if (font.names && !font.names.postScriptName) {
            let uniqueID = _.get(font.names, `uniqueID.en`, undefined);
            let fakeName = uniqueID || guid();
            font.names.postScriptName = { en: fakeName };
        }

        var fullName = font.names && font.names.fullName && (font.names.fullName.zh || font.names.fullName.en);
        var manufacturerURL = font.names.manufacturerURL && (font.names.manufacturerURL.zh || font.names.manufacturerURL.en) || "";
        var designer = font.names.designer && (font.names.designer.zh || font.names.designer.en) || "";
        var copyright = font.names.copyright && (font.names.copyright.zh || font.names.copyright.en) || "";
        var preferredSubfamily = font.names.preferredSubfamily && font.names.preferredSubfamily.en || "";
        var fontMetas = {... font.names };

        fontMetas.numGlyphs = font.numGlyphs;

        // 包含字詞測試
        var supportCN = isFontContainsChar(font, "龙") && isFontContainsChar(font, "岁");
        var supportEN = isFontContainsChar(font, "A");
        var supportJP = isFontContainsChar(font, "実") && isFontContainsChar(font, "匁") && isFontContainsChar(font, "図");
        var supportTW = isFontContainsChar(font, "陳") && isFontContainsChar(font, "鑿") && isFontContainsChar(font, "發");
        var supportKR = isFontContainsChar(font, "별") && isFontContainsChar(font, "았");

        fontMetas.support = {};

        if (supportCN) { fontMetas.support["zh_CN"] = true; }
        if (supportJP) { fontMetas.support["jp"] = true; }
        if (supportTW) { fontMetas.support["zh_TW"] = true; }
        if (supportKR) { fontMetas.support["kr"] = true; }

        if (fontMetas.postScriptName) {
            var key = Object.keys(fontMetas.postScriptName)[0];
            var postScriptName = _.get(fontMetas, `postScriptName.${key}`, "").toLowerCase();
            var weight;
            // 如果字体本身没有包含这些信息，
            if (postScriptName) {
                if (postScriptName.toLowerCase().indexOf("thin") > -1) { weight = "Thin"; }
                else if (postScriptName.toLowerCase().indexOf("hairline") > -1) { weight = "Hairline"; }
                else if (postScriptName.toLowerCase().indexOf("extralight") > -1) { weight = "ExtraLight"; }
                else if (postScriptName.toLowerCase().indexOf("ultralight") > -1) { weight = "UltraLight"; }
                else if (postScriptName.toLowerCase().indexOf("light") > -1) { weight = "Light"; }
                else if (postScriptName.toLowerCase().indexOf("regular") > -1) { weight = "Regular"; }
                else if (postScriptName.toLowerCase().indexOf("normal") > -1) { weight = "Regular"; }
                else if (postScriptName.toLowerCase().indexOf("medium") > -1) { weight = "Medium"; }
                else if (postScriptName.toLowerCase().indexOf("demibold") > -1) { weight = "DemiBold"; }
                else if (postScriptName.toLowerCase().indexOf("semibold") > -1) { weight = "SemiBold"; }
                else if (postScriptName.toLowerCase().indexOf("bold") > -1) { weight = "Bold"; }
                else if (postScriptName.toLowerCase().indexOf("extrabold") > -1) { weight = "ExtraBold"; }
                else if (postScriptName.toLowerCase().indexOf("ultrabold") > -1) { weight = "UltraBold"; }
                else if (postScriptName.toLowerCase().indexOf("black") > -1) { weight = "Black"; }
                else if (postScriptName.toLowerCase().indexOf("extrablack") > -1) { weight = "ExtraBlack"; }
                else if (postScriptName.toLowerCase().indexOf("heavy") > -1) { weight = "Heavy"; }

                if (!weight) {
                    weight = _.get(fontMetas, `preferredSubfamily.en`, _.get(fontMetas, `fontSubfamily.en`, 'Regular'));
                }

                if (["Thin","Hairline","ExtraLight","UltraLight","Light","Regular","Regular","Medium","SemiBold","DemiBold","Bold","ExtraBold","UltraBold","Black","Black","ExtraBlack","Heavy"].indexOf(weight) === -1) {
                    weight = undefined;   
                }

                if (!weight) {
                    weight = 'Regular';
                }

                if (weight.toLowerCase().indexOf("italic") === -1 && postScriptName.toLowerCase().indexOf("italic") > -1) {
                    weight += " Italic";
                }
            }
            else {
                weight = "Regular";
            }

            // console.log(weight);

            fontMetas.weight = weight;
        }

        callback({
            font: font,
            supportCN: supportCN,
            supportTW: supportTW,
            supportJP: supportJP,
            supportKR: supportKR,
            supportEN: supportEN,
            fontMetas: fontMetas
        });

    });
};

function isFontContainsChar (font, char) {
    var isContains = false;
    isContains = (font.charToGlyph(char).index > 0);
    return isContains;
}

function loadFontTypr (path, resp) {
    var request = new XMLHttpRequest();
    request.open("GET", URL_MODULE.pathToFileURL(path).href, true);
    request.responseType = "arraybuffer";
    request.onload = function(e) { resp(e.target.response); };
    request.send();
}