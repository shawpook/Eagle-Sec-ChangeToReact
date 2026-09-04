// b1-9m：matchStringMethod（bundle 8340-8368 逐字）——本文件是 bundle 8369-9418 的提取副本，
// 提取时把定义 matchStringMethod 的前导块切在了外面，26 个 isMatch*Rule 全部引用它
// → 调用即 ReferenceError: matchStringMethod is not defined（1m1-A9-smart-filter 断言面）
var matchStringMethod = {};
matchStringMethod["equal"] = function (name, value) {
	return name === value;
};
matchStringMethod["startWith"] = function (name, value) {
	var isStartWith = new RegExp('^' + value, 'i').test(name);
	return isStartWith;
};
matchStringMethod["endWith"] = function (name, value) {
	var isEndWith = new RegExp(value + '$', 'i').test(name);
	return isEndWith;
};
matchStringMethod["uncontain"] = function (name, value) {
	return name.indexOf(value) === -1;
};
matchStringMethod["contain"] = function (name, value) {
	return name.indexOf(value) !== -1;
};
matchStringMethod["empty"] = function (name, value) {
	return name === "";
};
matchStringMethod["not-empty"] = function (name, value) {
	return name !== "";
};
matchStringMethod["regex"] = function (name, value) {
	try { return new RegExp(value, "g").test(name); }
	catch (err) { return false; }
};

function isMatchNameRule (rule, image) {

	var method = rule.method; 	// equal, startWith, endWith, unequal, contain
	var name = image.name && image.name.toLowerCase();
	var value = rule.value && rule.value.toLowerCase();

	if (!name) name = "";
	if (method!== 'empty' && method !== 'not-empty' && value == '') return false;
	if (matchStringMethod[method]) {
		return matchStringMethod[method](name, value);
	}
	return false;
}

function isMatchFolderNameRule (rule, item) {

	const method = rule.method; 	// equal, startWith, endWith, unequal, contain
	const value = rule.value && rule.value.toLowerCase();

	if (!item?.folders?.length) return false;

	for (let i = 0; i < item.folders.length; i++) {
		const folderId = item.folders[i];
		const folder = $bodyScope.folderMappings[folderId];
		let name = folder?.name;
		if (!name) name = "";
		name = name.toLowerCase();
		if (method!== 'empty' && method !== 'not-empty' && value == '') return false;
		if (matchStringMethod[method]) {
			let isMatch = matchStringMethod[method](name, value);
			if (isMatch) return true;
		}
	}
	
	return false;
}

function isMatchUrlRule (rule, image) {

	var method = rule.method; 	// equal, startWith, endWith, unequal, contain
	var url = image.url && image.url.toLowerCase();
	var value = rule.value && rule.value.toLowerCase();

	if (!url) url = "";
	if (method!== 'empty' && method !== 'not-empty' && value == '') return false;

	if (matchStringMethod[method]) {
		return matchStringMethod[method](url, value);
	}
	return false;
}

function isMatchAnnotationRule (rule, image) {

	var method = rule.method; 	// equal, startWith, endWith, unequal, contain
	var annotation = image.annotation && image.annotation.toLowerCase();
	var value = rule.value && rule.value.toLowerCase();

	if (!annotation) annotation = "";
	if (method!== 'empty' && method !== 'not-empty' && value == '') return false;

	if (matchStringMethod[method]) {
		return matchStringMethod[method](annotation, value);
	}
	return false;
}

function isMatchWidthRule (rule, image) {
	try {
		var method = rule.method; 	// equal, startWith, endWith, unequal, contain
		var width = image.width;
		var value1 = rule.value[0];
		var value2 = rule.value[1];

		if (!width && width > 0) return false;

		switch (method) {
			case '=':
				return width === value1;
				break;
			case '>=':
				return width >= value1;
				break;
			case '<=':
				return width <= value1;
				break;
			case '>':
				return width > value1;
				break;
			case '<':
				return width < value1;
				break;
			case 'between':
				return value1 <= width && width <= value2;
				break;
		}
		return false;
	}
	catch (err) {
		return false;
	}
}

function isMatchHeightRule (rule, image) {
	try {
		var method = rule.method; 	// equal, startWith, endWith, unequal, contain
		var height = image.height;
		var value1 = rule.value[0];
		var value2 = rule.value[1];

		if (!height && height > 0) return false;

		switch (method) {
			case '=':
				return height === value1;
				break;
			case '>=':
				return height >= value1;
				break;
			case '<=':
				return height <= value1;
				break;
			case '>':
				return height > value1;
				break;
			case '<':
				return height < value1;
				break;
			case 'between':
				return value1 <= height && height <= value2;
				break;
		}
		return false;
	}
	catch (err) {
		return false;
	}
}

function isMatchFileSizeRule (rule, image) {
	try {
		var method = rule.method; 	// equal, startWith, endWith, unequal, contain
		var size = image.size;
		var value1 = rule.value[0];
		var value2 = rule.value[1];
		var unit = rule.unit;

		if (unit === 'kb') {
			size = size / 1024;
		}
		else {
			size = size / 1024 / 1024;
		}

		if (!size && size > 0) return false;

		switch (method) {
			case '=':
				return size === value1;
				break;
			case '>=':
				return size >= value1;
				break;
			case '<=':
				return size <= value1;
				break;
			case '>':
				return size > value1;
				break;
			case '<':
				return size < value1;
				break;
			case 'between':
				return value1 <= size && size <= value2;
				break;
		}
		return false;
	}
	catch (err) {
		return false;
	}
}

function isMatchDurationRule (rule, image) {
	try {
		var method = rule.method; 	// equal, startWith, endWith, unequal, contain
		var duration = image.duration;

		if (!duration) return false;

		var value1 = rule.value[0];
		var value2 = rule.value[1];
		var unit = rule.unit;

		if (unit === 'h') {
			duration = duration / 60 / 60;
		}
		else if (unit === 'm') {
			duration = duration / 60;
		}

		if (!duration && duration > 0) return false;

		switch (method) {
			case '=':
				return duration === value1;
				break;
			case '>=':
				return duration >= value1;
				break;
			case '<=':
				return duration <= value1;
				break;
			case '>':
				return duration > value1;
				break;
			case '<':
				return duration < value1;
				break;
			case 'between':
				return value1 <= duration && duration <= value2;
				break;
		}
		return false;
	}
	catch (err) {
		return false;
	}
}

function isMatchBPMRule (rule, image) {
	try {
		var method = rule.method; 	// equal, startWith, endWith, unequal, contain
		var bpm = image.bpm;

		if (!bpm) return false;

		var value1 = rule.value[0];
		var value2 = rule.value[1];
		var unit = rule.unit;

		if (!bpm) return false;

		switch (method) {
			case '=':
				return bpm === value1;
				break;
			case '>=':
				return bpm >= value1;
				break;
			case '<=':
				return bpm <= value1;
				break;
			case '>':
				return bpm > value1;
				break;
			case '<':
				return bpm < value1;
				break;
			case 'between':
				return value1 <= bpm && bpm <= value2;
				break;
		}
		return false;

	}
	catch (err) {
		return false;
	}
}

function isMatchTimeRule (rule, image) {
	try {
		var method = rule.method; 	// equal, startWith, endWith, unequal, contain
		var modificationTime = image.modificationTime;
		var value1 = rule.value[0];
		var value2 = rule.value[1];

		if (!modificationTime) return false;
		var DAY = 1000 * 60 * 60 * 24;
		switch (method) {
			case 'on':
				// 使用 toDateString() 判断同一天
				return new Date(modificationTime).toDateString() == new Date(value1).toDateString();
				break;
			case 'before':
				return modificationTime <= value1 + DAY;
				break;
			case 'after':
				return modificationTime >= value1;
				break;
			case 'between':
				return value1 <= modificationTime && modificationTime <= value2 + DAY;
				break;
			case 'within':
				var days = value1;
				return modificationTime + days * DAY >= Date.now();
				break;
		}
		return false;
	}
	catch (err) {
		return false;
	}
}

function isMatchMTimeRule (rule, image) {
	try {
		var method = rule.method; 	// equal, startWith, endWith, unequal, contain
		var mtime = image.mtime || image.modificationTime;
		var value1 = rule.value[0];
		var value2 = rule.value[1];

		if (!mtime) return false;
		var DAY = 1000 * 60 * 60 * 24;
		switch (method) {
			case 'on':
				// 使用 toDateString() 判断同一天
				return new Date(mtime).toDateString() == new Date(value1).toDateString();
				break;
			case 'before':
				return mtime <= value1 + DAY;
				break;
			case 'after':
				return mtime >= value1;
				break;
			case 'between':
				return value1 <= mtime && mtime <= value2 + DAY;
				break;
			case 'within':
				var days = value1;
				return mtime + days * DAY >= Date.now();
				break;
		}
		return false;
	}
	catch (err) {
		return false;
	}
}

function isMatchBTimeRule (rule, image) {
	try {
		var method = rule.method; 	// equal, startWith, endWith, unequal, contain
		var btime = image.btime || image.modificationTime;
		var value1 = rule.value[0];
		var value2 = rule.value[1];

		if (!btime) return false;
		var DAY = 1000 * 60 * 60 * 24;
		switch (method) {
			case 'on':
				// 使用 toDateString() 判断同一天
				return new Date(btime).toDateString() == new Date(value1).toDateString();
				break;
			case 'before':
				return btime <= value1 + DAY;
				break;
			case 'after':
				return btime >= value1;
				break;
			case 'between':
				return value1 <= btime && btime <= value2 + DAY;
				break;
			case 'within':
				var days = value1;
				return btime + days * DAY >= Date.now();
				break;
		}
		return false;
	}
	catch (err) {
		return false;
	}
}

function intersect (arr1, arr2) {
	var temp = {};
	var result = [];
	for (let i = 0; i < arr1.length; i++) { temp[arr1[i]] = true; }
	for (let j = 0; j < arr2.length; j++) { 
		if (temp[arr2[j]] === true) {
			result.push(arr2[j]);
		}
	}
	return result;
}

function isMatchCommentsRule(rule, image) {

	if (!image) { return false; };

	var method = rule.method; 	// intersection, union
	var comments = image.comments;
	var commentString = "";
	var value = rule.value;

	if (method === 'empty') {
		if (!image.comments || image.comments.length === 0) {
			return true;
		}
	}
	else if (method === 'not-empty') {
		if (image.comments && image.comments.length > 0) {
			return true;
		}
	}
	else {

		if (!image || !image.comments) { return false; };

		for(var i = 0; i < comments.length; i++) {
			commentString += comments[i].annotation;
		}
		switch (method) {
			case 'equal':
				return commentString === value;
				break;
			case 'startWith':
				var isStartWith = new RegExp('^' + value, 'i').test(commentString);
				return isStartWith;
				break;
			case 'endWith':
				var isEndWith = new RegExp(value + '$', 'i').test(commentString);
				return isEndWith;
				break;
			case 'uncontain':
				return commentString.indexOf(value) === -1;
				break;
			case 'contain':
				return commentString.indexOf(value) !== -1;
				break;
			case 'regex':
				try { return new RegExp(value, "g").test(commentString); }
				catch (err) { return false; }
				break;
		}
	}
	return false;
}

function isMatchTagsRule (rule, image) {

	if (!image) { return false; };
	if (!image.tags) return false;

	var method = rule.method; 	// intersection, union
	var tags = image.tags;
	var value = rule.value;

	if (method === 'empty') {
		if (!image.tags || image.tags.length === 0) {
			return true;
		}
	}
	else if (method === 'not-empty') {
		if (image.tags && image.tags.length > 0) {
			return true;
		}
	}
	else {
		// 两阵列取交集长度一样表示符合
		var isIntersect = intersect(tags, value).length === value.length && value.length != 0;
		var isUnion = false;
		var isIdentity = false;

		for (var i = 0; i < tags.length; i++) {
			if (value.indexOf(tags[i]) !== -1) {
				isUnion = true;
				break;
			}
		}

		switch (method) {
			case 'intersection':
				return isIntersect;
				break;
			case 'equal':
				return isIntersect && tags.length === value.length;
				break;
			case 'union':
				return isUnion;
			case 'identity':
				return !isUnion;
				break;
		}
	}
    return false;
}


function isMatchFoldersRule (rule, image) {

	if (!image || !image.folders) { return false; };

	var method = rule.method; 	// intersection, union
	var folders = image.folders;
	var value = rule.value;

	if (method === 'empty') {
		if (!folders || folders.length === 0) {
			return true;
		}
	}
	else if (method === 'not-empty') {
		if (folders && folders.length > 0) {
			return true;
		}
	}
	else {
		// 两阵列取交集长度一样表示符合
		var isIntersect = intersect(folders, value).length === value.length;
		var isUnion = false;

		for (var i = 0; i < folders.length; i++) {
			if (value.indexOf(folders[i]) !== -1) {
				isUnion = true;
				break;
			}
		}

		switch (method) {
			case 'intersection':
				return isIntersect;
				break;
			case 'equal':
				return isIntersect && folders.length === value.length;
				break;
			case 'union':
				return isUnion;
				break;
			case 'identity':
					return !isUnion;
					break;
		}
	}
    return false;
}

function isMatchTypeRule (rule, image) {

	var ext = image.ext;
	var result = false;

	if (ext === rule.value) {
		return (rule.method === "equal");
	}

	switch (rule.value) {
		case "videos":
		case "video":
			result = VIDEO_TYPES[ext];
			break;
		case "audio":
			result = AUDIO_TYPES[ext];
			break;
		case "powerpoint":
			if (ext == 'ppt' || ext == 'pptx' || ext == 'potx') result = true;
			break;
		case "presentation":
			if (ext == 'ppt' || ext == 'key' || ext == 'pptx') result = true;
			break;
		case "excel":
			if (ext == 'xls' || ext == 'xlsx') result = true;
			break;
		case "word":
			if (ext == 'doc' || ext == 'docx') result = true;
			break;
		case "font":
			result = FONT_TYPES[ext];
			break;
		case "url":
			if (ext == 'url' && !image.medium) result = true;
			break;
		case "youtube":
			if (ext == 'url' && image.medium == 'youtube') result = true;
			break;
		case "vimeo":
			if (ext == 'url' && image.medium == 'vimeo') result = true;
			break;
		case "bilibili":
			if (ext == 'url' && image.medium == 'bilibili') result = true;
			break;
		default:
			result = (ext === rule.value);
			break;
	}

	switch (rule.method) {
		case 'equal':
			return result;
			break;
		case 'unequal':
			return !result;
			break;
	}
	return false;
}

function isMatchRatingRule (rule, image) {
	try {
		var method = rule.method; 	// equal, startWith, endWith, unequal, contain
		var star = image.star || undefined;
		var value = parseInt(rule.value) || undefined;

		switch (method) {
			case 'contain':
				if (rule.value.indexOf('none') === -1) {
					return rule.value.indexOf(star) !== -1;
				}
				else {
					if (rule.value.indexOf(star) !== -1) {
						return true;
					}
					if (rule.value.indexOf("none") !== -1) {
						return true;
					}
					return false;
				}
				break;
			case 'equal':
				if (value !== 'none') {
					return star === value;
				}
				else {
					return star === undefined;
				}
				break;
			case 'unequal':
				if (value !== 'none') {
					return star !== value;
				}
				else {
					return star !== undefined;
				}
				break;
		}
		return false;
	}
	catch (err) {
		return false;
	}
}

function isMatchShapeRule (rule, image) {

	var method = rule.method; 	// equal, startWith, endWith, unequal, contain
	var value = rule.value;
	var width = image.width;
	var height = image.height;
	var isEqual = false;

	if (value !== "custom") {
		let shape;
		if (image.width > image.height) {
			if (image.width > image.height && image.width / image.height >= 2.5) {
				shape = "panoramic-landscape";
			}
			else {
				shape = "landscape";
			}
		}
		else if (image.width < image.height) {
			if (image.width < image.height && image.height / image.width >= 2.5) {
				shape = "panoramic-portrait";
			}
			else {
				shape = "portrait";
			}
		}
		else if (image.width === image.height) {
			shape = "square";
		}

		isEqual = (shape === value);
	}
	else {
		if (!rule.width || !rule.height) return false;
		isEqual = (rule.width / rule.height === width / height);
	}

	if (method === 'equal') {
		return isEqual;
	}
	else {
		return !isEqual;
	}

	return false;
}


var cacheColorMappings = {};
function isMatchColorRule (rule, image) {

	if (!image || !image.palettes) return false;

	if (!cacheColorMappings[rule.value]) {
		cacheColorMappings[rule.value] = hexToRGB(rule.value);
	}

	var method = rule.method;
	var similarColor = cacheColorMappings[rule.value] || hexToRGB(rule.value);
	var palettes = image.palettes;
	var similarity = 20;
    // var white = [255, 255, 255];
    // var black = [0, 0, 0];

	if (method === 'grayscale') {
		if (palettes) {
			for (var i = palettes.length - 1; i >= 0; i--) {
				let palette = palettes[i];
				if (palette.ratio >= 0.02) {
					var r = palette.color[0];
					var g = palette.color[1];
					var b = palette.color[2];
					if ( Math.abs(r-g) >= 8 || Math.abs(r-b) >= 8 || Math.abs(g-b) >= 8 ) {
						return false;
					}
				}
			}
			return true;
		}
		return false;
	}

    if (method === 'accuracy') {
    	similarity = 10;
    }

    if (!similarColor) return true;
    if (!image.palettes || image.palettes.length < 0) return false;
    if (!image.palettes[0]) return false;

    var ratio0 = image.palettes[0].ratio;
    var r0 = image.palettes[0].color[0];
    var g0 = image.palettes[0].color[1];
    var b0 = image.palettes[0].color[2];
    var rt = similarColor[0];
    var gt = similarColor[1];
    var bt = similarColor[2];

    if (ratio0 < 33) {
        return false;
    }

    if (
        r0 - rt > 96 ||
        g0 - gt > 96 ||
        b0 - bt > 96 || 
        r0 - rt < -96 ||
        g0 - gt < -96 ||
        b0 - bt < -96
    ) {
        return false;
    }

	if (image.palettes[0] && image.palettes[1]) {
		if (image.palettes[0].color[0] == similarColor[0] && image.palettes[0].color[1] == similarColor[1] && image.palettes[0].color[2] == similarColor[2] ||
			image.palettes[1].color[0] == similarColor[0] && image.palettes[1].color[1] == similarColor[1] && image.palettes[1].color[2] == similarColor[2]) {
			return true;
		}
	}

	if (image.palettes[0]) {
		if (image.palettes[0].ratio > 33) {
			let d = colorSimilarityDistance(similarColor, image.palettes[0].color);
			if (d.d2000 < similarity &&  d.d76 < similarity + 50) {
				return true;
			}
		}
	}
	
	if (image.palettes[1]) {
		if (image.palettes[1].ratio > 33) {
			let d2 = colorSimilarityDistance(similarColor, image.palettes[1].color);
			if (d2.d2000 < similarity &&  d2.d76 < similarity + 50) {
				return true;
			}
		}
	}
    return false;
}

// b1-9d：w 为 bundle 时代词法绑定，vendor 注入环境无此名——经 window.require 同源解析
var colorConvert = window.require('color-convert');
var DeltaE = window.require('delta-e');
function colorSimilarityDistance (color1, color2) {
    var c1 = colorConvert.rgb.lab(color1[0], color1[1], color1[2]);
    var c2 = colorConvert.rgb.lab(color2[0], color2[1], color2[2]);
    var l1 = { L: c1[0], A: c1[1], B: c1[2] };
    var l2 = { L: c2[0], A: c2[1], B: c2[2] };
    var d76 = DeltaE.getDeltaE76(l1, l2);
    var d2000 = DeltaE.getDeltaE00(l1, l2);
    return {
    	d76: d76,
    	d2000: d2000,
    };
};

function hexToRGB (hex, alpha) {
    var r = parseInt(hex.slice(1, 3), 16),
        g = parseInt(hex.slice(3, 5), 16),
        b = parseInt(hex.slice(5, 7), 16);
    return [r,g,b];
}

function rgbToHex (r, g, b) {
    if (r === undefined) {
        return false;
    }
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
}

function isMatchCameraRule (rule, image) {

	var method = rule.method; 	// equal, startWith, endWith, unequal, contain
	if (!image.rawMetas || !image.rawMetas.camera) return false;
	var camera = image.rawMetas.camera && image.rawMetas.camera.toLowerCase();
	var value = rule.value && rule.value.toLowerCase();

	if (!camera) camera = "";
	if (method!== 'empty' && method !== 'not-empty' && value == '') return false;

	if (matchStringMethod[method]) {
		return matchStringMethod[method](camera, value);
	}
	return false;
}

function isMatchISORule (rule, image) {
	var method = rule.method; 	// equal, startWith, endWith, unequal, contain
	if (!image.rawMetas || !image.rawMetas.isoSpeed) return false;
	var iso = parseInt(image.rawMetas.isoSpeed);
	var value1 = parseInt(rule.value[0]);
	var value2 = parseInt(rule.value[1]);

	if (!iso && iso > 0) return false;

	switch (method) {
		case '=':
			return iso === value1;
			break;
		case '>=':
			return iso >= value1;
			break;
		case '<=':
			return iso <= value1;
			break;
		case '>':
			return iso > value1;
			break;
		case '<':
			return iso < value1;
			break;
		case 'between':
			return value1 <= iso && iso <= value2;
			break;
	}
	return false;
}

function isMatchApertureRule (rule, image) {
	try {
		var method = rule.method; 	// equal, startWith, endWith, unequal, contain
		if (!image.rawMetas || !image.rawMetas.aperture) return false;
		var aperture = parseFloat(image.rawMetas.aperture.match(/[+-]?\d+(\.\d+)?/g)[0]);
		var value1 = parseFloat(rule.value[0]);
		var value2 = parseFloat(rule.value[1]);

		if (!aperture && aperture > 0) return false;

		switch (method) {
			case '=':
				return aperture === value1;
				break;
			case '>=':
				return aperture >= value1;
				break;
			case '<=':
				return aperture <= value1;
				break;
			case '>':
				return aperture > value1;
				break;
			case '<':
				return aperture < value1;
				break;
			case 'between':
				return value1 <= aperture && aperture <= value2;
				break;
		}
		return false;
	}
	catch (err) {
		return false;
	}
}

function isMatchFocalLengthRule (rule, image) {

	try {
		var method = rule.method; 	// equal, startWith, endWith, unequal, contain
		if (!image.rawMetas || !image.rawMetas.focalLength) return false;
		var focalLength = parseFloat(image.rawMetas.focalLength.match(/[+-]?\d+(\.\d+)?/g)[0]);
		var value1 = parseFloat(rule.value[0]);
		var value2 = parseFloat(rule.value[1]);

		if (!focalLength && focalLength > 0) return false;

		switch (method) {
			case '=':
				return focalLength === value1;
				break;
			case '>=':
				return focalLength >= value1;
				break;
			case '<=':
				return focalLength <= value1;
				break;
			case '>':
				return focalLength > value1;
				break;
			case '<':
				return focalLength < value1;
				break;
			case 'between':
				return value1 <= focalLength && focalLength <= value2;
				break;
		}
		return false;
	}
	catch (err) {
		return false;
	}
}


function isMatchShutterRule (rule, image) {

	try {
		var method = rule.method; 	// equal, startWith, endWith, unequal, contain
		if (!image.rawMetas || !image.rawMetas.shutter) return false;
		var shutter = parseFloat(image.rawMetas.shutter.match(/[+-]?\d+(\.\d+)?/g)[1]);
		var value1 = parseFloat(rule.value[0]);
		var value2 = parseFloat(rule.value[1]);

		if (!shutter && shutter > 0) return false;

		switch (method) {
			case '=':
				return shutter === value1;
				break;
			case '>=':
				return shutter >= value1;
				break;
			case '<=':
				return shutter <= value1;
				break;
			case '>':
				return shutter > value1;
				break;
			case '<':
				return shutter < value1;
				break;
			case 'between':
				return value1 <= shutter && shutter <= value2;
				break;
		}
		return false;
	}
	catch (err) {
		return false;
	}
}


function isMatchTimestampRule (rule, image) {

	var method = rule.method; 	// equal, startWith, endWith, unequal, contain
	if (!image.rawMetas || !image.rawMetas.timestamp) return false;
	var timestamp = parseInt(image.rawMetas.timestamp);
	var value1 = parseInt(rule.value[0]);
	var value2 = parseInt(rule.value[1]);

	if (!timestamp) return false;
	var DAY = 1000 * 60 * 60 * 24;
	switch (method) {
		case 'on':
			// 使用 toDateString() 判断同一天
			return new Date(timestamp).toDateString() == new Date(value1).toDateString();
			break;
		case 'before':
			return timestamp <= value1 + DAY;
			break;
		case 'after':
			return timestamp >= value1;
			break;
		case 'between':
			return value1 <= timestamp && timestamp <= value2 + DAY;
			break;
		case 'within':
			var days = value1;
			return timestamp + days * 1000 * 24 * 60 * 60 >= Date.now();
			break;
	}
	return false;
}

function isMatchFontActivatedRule (rule, image) {

	if (!image || !image.fontMetas) return false;

	try {
		var method = rule.method; 	// equal, startWith, endWith, unequal, contain
		var key = Object.keys(image.fontMetas.postScriptName)[0];
	    var postScriptName = image.fontMetas.postScriptName && image.fontMetas.postScriptName[key];
	    if (!postScriptName) return false;
	    switch (method) {
			case 'activate':
				return installedFonts[`${postScriptName}_.${image.ext}`];
				break;
			case 'deactivate':
				return !installedFonts[`${postScriptName}_.${image.ext}`];
				break;
		}
    }
    catch (err) {
    	return false;
    }

	return false;
}
/*!
 * is.js 0.9.0
 * Author: Aras Atasaygin
 */
(function(n,t){if(typeof define==="function"&&define.amd){define(function(){return n.is=t()})}else if(typeof exports==="object"){module.exports=t()}else{n.is=t()}})(this,function(){var n={};n.VERSION="0.8.0";n.not={};n.all={};n.any={};var t=Object.prototype.toString;var e=Array.prototype.slice;var r=Object.prototype.hasOwnProperty;function a(n){return function(){return!n.apply(null,e.call(arguments))}}function u(n){return function(){var t=c(arguments);var e=t.length;for(var r=0;r<e;r++){if(!n.call(null,t[r])){return false}}return true}}function o(n){return function(){var t=c(arguments);var e=t.length;for(var r=0;r<e;r++){if(n.call(null,t[r])){return true}}return false}}var i={"<":function(n,t){return n<t},"<=":function(n,t){return n<=t},">":function(n,t){return n>t},">=":function(n,t){return n>=t}};function f(n,t){var e=t+"";var r=+(e.match(/\d+/)||NaN);var a=e.match(/^[<>]=?|/)[0];return i[a]?i[a](n,r):n==r||r!==r}function c(t){var r=e.call(t);var a=r.length;if(a===1&&n.array(r[0])){r=r[0]}return r}n.arguments=function(n){return t.call(n)==="[object Arguments]"||n!=null&&typeof n==="object"&&"callee"in n};n.array=Array.isArray||function(n){return t.call(n)==="[object Array]"};n.boolean=function(n){return n===true||n===false||t.call(n)==="[object Boolean]"};n.char=function(t){return n.string(t)&&t.length===1};n.date=function(n){return t.call(n)==="[object Date]"};n.domNode=function(t){return n.object(t)&&t.nodeType>0};n.error=function(n){return t.call(n)==="[object Error]"};n["function"]=function(n){return t.call(n)==="[object Function]"||typeof n==="function"};n.json=function(n){return t.call(n)==="[object Object]"};n.nan=function(n){return n!==n};n["null"]=function(n){return n===null};n.number=function(e){return n.not.nan(e)&&t.call(e)==="[object Number]"};n.object=function(n){return Object(n)===n};n.regexp=function(n){return t.call(n)==="[object RegExp]"};n.sameType=function(e,r){var a=t.call(e);if(a!==t.call(r)){return false}if(a==="[object Number]"){return!n.any.nan(e,r)||n.all.nan(e,r)}return true};n.sameType.api=["not"];n.string=function(n){return t.call(n)==="[object String]"};n.undefined=function(n){return n===void 0};n.windowObject=function(n){return n!=null&&typeof n==="object"&&"setInterval"in n};n.empty=function(t){if(n.object(t)){var e=Object.getOwnPropertyNames(t).length;if(e===0||e===1&&n.array(t)||e===2&&n.arguments(t)){return true}return false}return t===""};n.existy=function(n){return n!=null};n.falsy=function(n){return!n};n.truthy=a(n.falsy);n.above=function(t,e){return n.all.number(t,e)&&t>e};n.above.api=["not"];n.decimal=function(t){return n.number(t)&&t%1!==0};n.equal=function(t,e){if(n.all.number(t,e)){return t===e&&1/t===1/e}if(n.all.string(t,e)||n.all.regexp(t,e)){return""+t===""+e}if(n.all.boolean(t,e)){return t===e}return false};n.equal.api=["not"];n.even=function(t){return n.number(t)&&t%2===0};n.finite=isFinite||function(t){return n.not.infinite(t)&&n.not.nan(t)};n.infinite=function(n){return n===Infinity||n===-Infinity};n.integer=function(t){return n.number(t)&&t%1===0};n.negative=function(t){return n.number(t)&&t<0};n.odd=function(t){return n.number(t)&&t%2===1};n.positive=function(t){return n.number(t)&&t>0};n.under=function(t,e){return n.all.number(t,e)&&t<e};n.under.api=["not"];n.within=function(t,e,r){return n.all.number(t,e,r)&&t>e&&t<r};n.within.api=["not"];var l={affirmative:/^(?:1|t(?:rue)?|y(?:es)?|ok(?:ay)?)$/,alphaNumeric:/^[A-Za-z0-9]+$/,caPostalCode:/^(?!.*[DFIOQU])[A-VXY][0-9][A-Z]\s?[0-9][A-Z][0-9]$/,creditCard:/^(?:(4[0-9]{12}(?:[0-9]{3})?)|(5[1-5][0-9]{14})|(6(?:011|5[0-9]{2})[0-9]{12})|(3[47][0-9]{13})|(3(?:0[0-5]|[68][0-9])[0-9]{11})|((?:2131|1800|35[0-9]{3})[0-9]{11}))$/,dateString:/^(1[0-2]|0?[1-9])([\/-])(3[01]|[12][0-9]|0?[1-9])(?:\2)(?:[0-9]{2})?[0-9]{2}$/,email:/^((([a-z]|\d|[!#\$%&'\*\+\-\/=\?\^_`{\|}~]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])+(\.([a-z]|\d|[!#\$%&'\*\+\-\/=\?\^_`{\|}~]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])+)*)|((\x22)((((\x20|\x09)*(\x0d\x0a))?(\x20|\x09)+)?(([\x01-\x08\x0b\x0c\x0e-\x1f\x7f]|\x21|[\x23-\x5b]|[\x5d-\x7e]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(\\([\x01-\x09\x0b\x0c\x0d-\x7f]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]))))*(((\x20|\x09)*(\x0d\x0a))?(\x20|\x09)+)?(\x22)))@((([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.)+(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))$/i,eppPhone:/^\+[0-9]{1,3}\.[0-9]{4,14}(?:x.+)?$/,hexadecimal:/^(?:0x)?[0-9a-fA-F]+$/,hexColor:/^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/,ipv4:/^(?:(?:\d|[1-9]\d|1\d{2}|2[0-4]\d|25[0-5])\.){3}(?:\d|[1-9]\d|1\d{2}|2[0-4]\d|25[0-5])$/,ipv6:/^((?=.*::)(?!.*::.+::)(::)?([\dA-F]{1,4}:(:|\b)|){5}|([\dA-F]{1,4}:){6})((([\dA-F]{1,4}((?!\3)::|:\b|$))|(?!\2\3)){2}|(((2[0-4]|1\d|[1-9])?\d|25[0-5])\.?\b){4})$/i,nanpPhone:/^\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})$/,socialSecurityNumber:/^(?!000|666)[0-8][0-9]{2}-?(?!00)[0-9]{2}-?(?!0000)[0-9]{4}$/,timeString:/^(2[0-3]|[01]?[0-9]):([0-5]?[0-9]):([0-5]?[0-9])$/,ukPostCode:/^[A-Z]{1,2}[0-9RCHNQ][0-9A-Z]?\s?[0-9][ABD-HJLNP-UW-Z]{2}$|^[A-Z]{2}-?[0-9]{4}$/,url:/^(?:(?:https?|ftp):\/\/)?(?:(?!(?:10|127)(?:\.\d{1,3}){3})(?!(?:169\.254|192\.168)(?:\.\d{1,3}){2})(?!172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})(?:[1-9]\d?|1\d\d|2[01]\d|22[0-3])(?:\.(?:1?\d{1,2}|2[0-4]\d|25[0-5])){2}(?:\.(?:[1-9]\d?|1\d\d|2[0-4]\d|25[0-4]))|(?:(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)(?:\.(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)*(?:\.(?:[a-z\u00a1-\uffff]{2,})))(?::\d{2,5})?(?:\/\S*)?$/i,usZipCode:/^[0-9]{5}(?:-[0-9]{4})?$/};function d(t,e){n[t]=function(n){return e[t].test(n)}}for(var s in l){if(l.hasOwnProperty(s)){d(s,l)}}n.ip=function(t){return n.ipv4(t)||n.ipv6(t)};n.capitalized=function(t){if(n.not.string(t)){return false}var e=t.split(" ");for(var r=0;r<e.length;r++){var a=e[r];if(a.length){var u=a.charAt(0);if(u!==u.toUpperCase()){return false}}}return true};n.endWith=function(t,e){if(n.not.string(t)){return false}e+="";var r=t.length-e.length;return r>=0&&t.indexOf(e,r)===r};n.endWith.api=["not"];n.include=function(n,t){return n.indexOf(t)>-1};n.include.api=["not"];n.lowerCase=function(t){return n.string(t)&&t===t.toLowerCase()};n.palindrome=function(t){if(n.not.string(t)){return false}t=t.replace(/[^a-zA-Z0-9]+/g,"").toLowerCase();var e=t.length-1;for(var r=0,a=Math.floor(e/2);r<=a;r++){if(t.charAt(r)!==t.charAt(e-r)){return false}}return true};n.space=function(t){if(n.not.char(t)){return false}var e=t.charCodeAt(0);return e>8&&e<14||e===32};n.startWith=function(t,e){return n.string(t)&&t.indexOf(e)===0};n.startWith.api=["not"];n.upperCase=function(t){return n.string(t)&&t===t.toUpperCase()};var F=["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];var p=["january","february","march","april","may","june","july","august","september","october","november","december"];n.day=function(t,e){return n.date(t)&&e.toLowerCase()===F[t.getDay()]};n.day.api=["not"];n.dayLightSavingTime=function(n){var t=new Date(n.getFullYear(),0,1);var e=new Date(n.getFullYear(),6,1);var r=Math.max(t.getTimezoneOffset(),e.getTimezoneOffset());return n.getTimezoneOffset()<r};n.future=function(t){var e=new Date;return n.date(t)&&t.getTime()>e.getTime()};n.inDateRange=function(t,e,r){if(n.not.date(t)||n.not.date(e)||n.not.date(r)){return false}var a=t.getTime();return a>e.getTime()&&a<r.getTime()};n.inDateRange.api=["not"];n.inLastMonth=function(t){return n.inDateRange(t,new Date((new Date).setMonth((new Date).getMonth()-1)),new Date)};n.inLastWeek=function(t){return n.inDateRange(t,new Date((new Date).setDate((new Date).getDate()-7)),new Date)};n.inLastYear=function(t){return n.inDateRange(t,new Date((new Date).setFullYear((new Date).getFullYear()-1)),new Date)};n.inNextMonth=function(t){return n.inDateRange(t,new Date,new Date((new Date).setMonth((new Date).getMonth()+1)))};n.inNextWeek=function(t){return n.inDateRange(t,new Date,new Date((new Date).setDate((new Date).getDate()+7)))};n.inNextYear=function(t){return n.inDateRange(t,new Date,new Date((new Date).setFullYear((new Date).getFullYear()+1)))};n.leapYear=function(t){return n.number(t)&&(t%4===0&&t%100!==0||t%400===0)};n.month=function(t,e){return n.date(t)&&e.toLowerCase()===p[t.getMonth()]};n.month.api=["not"];n.past=function(t){var e=new Date;return n.date(t)&&t.getTime()<e.getTime()};n.quarterOfYear=function(t,e){return n.date(t)&&n.number(e)&&e===Math.floor((t.getMonth()+3)/3)};n.quarterOfYear.api=["not"];n.today=function(t){var e=new Date;var r=e.toDateString();return n.date(t)&&t.toDateString()===r};n.tomorrow=function(t){var e=new Date;var r=new Date(e.setDate(e.getDate()+1)).toDateString();return n.date(t)&&t.toDateString()===r};n.weekend=function(t){return n.date(t)&&(t.getDay()===6||t.getDay()===0)};n.weekday=a(n.weekend);n.year=function(t,e){return n.date(t)&&n.number(e)&&e===t.getFullYear()};n.year.api=["not"];n.yesterday=function(t){var e=new Date;var r=new Date(e.setDate(e.getDate()-1)).toDateString();return n.date(t)&&t.toDateString()===r};var D=n.windowObject(typeof global=="object"&&global)&&global;var h=n.windowObject(typeof self=="object"&&self)&&self;var v=n.windowObject(typeof this=="object"&&this)&&this;var b=D||h||v||Function("return this")();var g=h&&h.document;var m=b.is;var w=h&&h.navigator;var y=(w&&w.appVersion||"").toLowerCase();var x=(w&&w.userAgent||"").toLowerCase();var A=(w&&w.vendor||"").toLowerCase();n.android=function(){return/android/.test(x)};n.android.api=["not"];n.androidPhone=function(){return/android/.test(x)&&/mobile/.test(x)};n.androidPhone.api=["not"];n.androidTablet=function(){return/android/.test(x)&&!/mobile/.test(x)};n.androidTablet.api=["not"];n.blackberry=function(){return/blackberry/.test(x)||/bb10/.test(x)};n.blackberry.api=["not"];n.chrome=function(n){var t=/google inc/.test(A)?x.match(/(?:chrome|crios)\/(\d+)/):null;return t!==null&&f(t[1],n)};n.chrome.api=["not"];n.desktop=function(){return n.not.mobile()&&n.not.tablet()};n.desktop.api=["not"];n.edge=function(n){var t=x.match(/edge\/(\d+)/);return t!==null&&f(t[1],n)};n.edge.api=["not"];n.firefox=function(n){var t=x.match(/(?:firefox|fxios)\/(\d+)/);return t!==null&&f(t[1],n)};n.firefox.api=["not"];n.ie=function(n){var t=x.match(/(?:msie |trident.+?; rv:)(\d+)/);return t!==null&&f(t[1],n)};n.ie.api=["not"];n.ios=function(){return n.iphone()||n.ipad()||n.ipod()};n.ios.api=["not"];n.ipad=function(n){var t=x.match(/ipad.+?os (\d+)/);return t!==null&&f(t[1],n)};n.ipad.api=["not"];n.iphone=function(n){var t=x.match(/iphone(?:.+?os (\d+))?/);return t!==null&&f(t[1]||1,n)};n.iphone.api=["not"];n.ipod=function(n){var t=x.match(/ipod.+?os (\d+)/);return t!==null&&f(t[1],n)};n.ipod.api=["not"];n.linux=function(){return/linux/.test(y)};n.linux.api=["not"];n.mac=function(){return/mac/.test(y)};n.mac.api=["not"];n.mobile=function(){return n.iphone()||n.ipod()||n.androidPhone()||n.blackberry()||n.windowsPhone()};n.mobile.api=["not"];n.offline=a(n.online);n.offline.api=["not"];n.online=function(){return!w||w.onLine===true};n.online.api=["not"];n.opera=function(n){var t=x.match(/(?:^opera.+?version|opr)\/(\d+)/);return t!==null&&f(t[1],n)};n.opera.api=["not"];n.phantom=function(n){var t=x.match(/phantomjs\/(\d+)/);return t!==null&&f(t[1],n)};n.phantom.api=["not"];n.safari=function(n){var t=x.match(/version\/(\d+).+?safari/);return t!==null&&f(t[1],n)};n.safari.api=["not"];n.tablet=function(){return n.ipad()||n.androidTablet()||n.windowsTablet()};n.tablet.api=["not"];n.touchDevice=function(){return!!g&&("ontouchstart"in h||"DocumentTouch"in h&&g instanceof DocumentTouch)};n.touchDevice.api=["not"];n.windows=function(){return/win/.test(y)};n.windows.api=["not"];n.windowsPhone=function(){return n.windows()&&/phone/.test(x)};n.windowsPhone.api=["not"];n.windowsTablet=function(){return n.windows()&&n.not.windowsPhone()&&/touch/.test(x)};n.windowsTablet.api=["not"];n.propertyCount=function(t,e){if(n.not.object(t)||n.not.number(e)){return false}var a=0;for(var u in t){if(r.call(t,u)&&++a>e){return false}}return a===e};n.propertyCount.api=["not"];n.propertyDefined=function(t,e){return n.object(t)&&n.string(e)&&e in t};n.propertyDefined.api=["not"];n.inArray=function(t,e){if(n.not.array(e)){return false}for(var r=0;r<e.length;r++){if(e[r]===t){return true}}return false};n.inArray.api=["not"];n.sorted=function(t,e){if(n.not.array(t)){return false}var r=i[e]||i[">="];for(var a=1;a<t.length;a++){if(!r(t[a],t[a-1])){return false}}return true};function j(){var t=n;for(var e in t){if(r.call(t,e)&&n["function"](t[e])){var i=t[e].api||["not","all","any"];for(var f=0;f<i.length;f++){if(i[f]==="not"){n.not[e]=a(n[e])}if(i[f]==="all"){n.all[e]=u(n[e])}if(i[f]==="any"){n.any[e]=o(n[e])}}}}}j();n.setNamespace=function(){b.is=m;return this};n.setRegexp=function(n,t){for(var e in l){if(r.call(l,e)&&t===e){l[e]=n}}};return n});
/* bignumber.js v9.0.0 https://github.com/MikeMcl/bignumber.js/LICENCE */!function(e){"use strict";var r,x=/^-?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i,L=Math.ceil,U=Math.floor,I="[BigNumber Error] ",T=I+"Number primitive has more than 15 significant digits: ",C=1e14,M=14,G=9007199254740991,k=[1,10,100,1e3,1e4,1e5,1e6,1e7,1e8,1e9,1e10,1e11,1e12,1e13],F=1e7,q=1e9;function j(e){var r=0|e;return 0<e||e===r?r:r-1}function $(e){for(var r,n,t=1,i=e.length,o=e[0]+"";t<i;){for(r=e[t++]+"",n=M-r.length;n--;r="0"+r);o+=r}for(i=o.length;48===o.charCodeAt(--i););return o.slice(0,i+1||1)}function z(e,r){var n,t,i=e.c,o=r.c,s=e.s,f=r.s,u=e.e,l=r.e;if(!s||!f)return null;if(n=i&&!i[0],t=o&&!o[0],n||t)return n?t?0:-f:s;if(s!=f)return s;if(n=s<0,t=u==l,!i||!o)return t?0:!i^n?1:-1;if(!t)return l<u^n?1:-1;for(f=(u=i.length)<(l=o.length)?u:l,s=0;s<f;s++)if(i[s]!=o[s])return i[s]>o[s]^n?1:-1;return u==l?0:l<u^n?1:-1}function H(e,r,n,t){if(e<r||n<e||e!==U(e))throw Error(I+(t||"Argument")+("number"==typeof e?e<r||n<e?" out of range: ":" not an integer: ":" not a primitive number: ")+String(e))}function V(e){var r=e.c.length-1;return j(e.e/M)==r&&e.c[r]%2!=0}function W(e,r){return(1<e.length?e.charAt(0)+"."+e.slice(1):e)+(r<0?"e":"e+")+r}function X(e,r,n){var t,i;if(r<0){for(i=n+".";++r;i+=n);e=i+e}else if(++r>(t=e.length)){for(i=n,r-=t;--r;i+=n);e+=i}else r<t&&(e=e.slice(0,r)+"."+e.slice(r));return e}(r=function e(r){var v,a,h,n,l,s,f,u,c,g,t=B.prototype={constructor:B,toString:null,valueOf:null},w=new B(1),N=20,O=4,p=-7,d=21,m=-1e7,y=1e7,b=!1,o=1,E=0,A={prefix:"",groupSize:3,secondaryGroupSize:0,groupSeparator:",",decimalSeparator:".",fractionGroupSize:0,fractionGroupSeparator:" ",suffix:""},S="0123456789abcdefghijklmnopqrstuvwxyz";function B(e,r){var n,t,i,o,s,f,u,l,c=this;if(!(c instanceof B))return new B(e,r);if(null==r){if(e&&!0===e._isBigNumber)return c.s=e.s,void(!e.c||e.e>y?c.c=c.e=null:e.e<m?c.c=[c.e=0]:(c.e=e.e,c.c=e.c.slice()));if((f="number"==typeof e)&&0*e==0){if(c.s=1/e<0?(e=-e,-1):1,e===~~e){for(o=0,s=e;10<=s;s/=10,o++);return void(c.c=y<o?c.e=null:(c.e=o,[e]))}l=String(e)}else{if(!x.test(l=String(e)))return h(c,l,f);c.s=45==l.charCodeAt(0)?(l=l.slice(1),-1):1}-1<(o=l.indexOf("."))&&(l=l.replace(".","")),0<(s=l.search(/e/i))?(o<0&&(o=s),o+=+l.slice(s+1),l=l.substring(0,s)):o<0&&(o=l.length)}else{if(H(r,2,S.length,"Base"),10==r)return D(c=new B(e),N+c.e+1,O);if(l=String(e),f="number"==typeof e){if(0*e!=0)return h(c,l,f,r);if(c.s=1/e<0?(l=l.slice(1),-1):1,B.DEBUG&&15<l.replace(/^0\.0*|\./,"").length)throw Error(T+e)}else c.s=45===l.charCodeAt(0)?(l=l.slice(1),-1):1;for(n=S.slice(0,r),o=s=0,u=l.length;s<u;s++)if(n.indexOf(t=l.charAt(s))<0){if("."==t){if(o<s){o=u;continue}}else if(!i&&(l==l.toUpperCase()&&(l=l.toLowerCase())||l==l.toLowerCase()&&(l=l.toUpperCase()))){i=!0,s=-1,o=0;continue}return h(c,String(e),f,r)}f=!1,-1<(o=(l=a(l,r,10,c.s)).indexOf("."))?l=l.replace(".",""):o=l.length}for(s=0;48===l.charCodeAt(s);s++);for(u=l.length;48===l.charCodeAt(--u););if(l=l.slice(s,++u)){if(u-=s,f&&B.DEBUG&&15<u&&(G<e||e!==U(e)))throw Error(T+c.s*e);if((o=o-s-1)>y)c.c=c.e=null;else if(o<m)c.c=[c.e=0];else{if(c.e=o,c.c=[],s=(o+1)%M,o<0&&(s+=M),s<u){for(s&&c.c.push(+l.slice(0,s)),u-=M;s<u;)c.c.push(+l.slice(s,s+=M));s=M-(l=l.slice(s)).length}else s-=u;for(;s--;l+="0");c.c.push(+l)}}else c.c=[c.e=0]}function i(e,r,n,t){var i,o,s,f,u;if(null==n?n=O:H(n,0,8),!e.c)return e.toString();if(i=e.c[0],s=e.e,null==r)u=$(e.c),u=1==t||2==t&&(s<=p||d<=s)?W(u,s):X(u,s,"0");else if(o=(e=D(new B(e),r,n)).e,f=(u=$(e.c)).length,1==t||2==t&&(r<=o||o<=p)){for(;f<r;u+="0",f++);u=W(u,o)}else if(r-=s,u=X(u,o,"0"),f<o+1){if(0<--r)for(u+=".";r--;u+="0");}else if(0<(r+=o-f))for(o+1==f&&(u+=".");r--;u+="0");return e.s<0&&i?"-"+u:u}function R(e,r){for(var n,t=1,i=new B(e[0]);t<e.length;t++){if(!(n=new B(e[t])).s){i=n;break}r.call(i,n)&&(i=n)}return i}function _(e,r,n){for(var t=1,i=r.length;!r[--i];r.pop());for(i=r[0];10<=i;i/=10,t++);return(n=t+n*M-1)>y?e.c=e.e=null:e.c=n<m?[e.e=0]:(e.e=n,r),e}function D(e,r,n,t){var i,o,s,f,u,l,c,a=e.c,h=k;if(a){e:{for(i=1,f=a[0];10<=f;f/=10,i++);if((o=r-i)<0)o+=M,s=r,c=(u=a[l=0])/h[i-s-1]%10|0;else if((l=L((o+1)/M))>=a.length){if(!t)break e;for(;a.length<=l;a.push(0));u=c=0,s=(o%=M)-M+(i=1)}else{for(u=f=a[l],i=1;10<=f;f/=10,i++);c=(s=(o%=M)-M+i)<0?0:u/h[i-s-1]%10|0}if(t=t||r<0||null!=a[l+1]||(s<0?u:u%h[i-s-1]),t=n<4?(c||t)&&(0==n||n==(e.s<0?3:2)):5<c||5==c&&(4==n||t||6==n&&(0<o?0<s?u/h[i-s]:0:a[l-1])%10&1||n==(e.s<0?8:7)),r<1||!a[0])return a.length=0,t?(r-=e.e+1,a[0]=h[(M-r%M)%M],e.e=-r||0):a[0]=e.e=0,e;if(0==o?(a.length=l,f=1,l--):(a.length=l+1,f=h[M-o],a[l]=0<s?U(u/h[i-s]%h[s])*f:0),t)for(;;){if(0==l){for(o=1,s=a[0];10<=s;s/=10,o++);for(s=a[0]+=f,f=1;10<=s;s/=10,f++);o!=f&&(e.e++,a[0]==C&&(a[0]=1));break}if(a[l]+=f,a[l]!=C)break;a[l--]=0,f=1}for(o=a.length;0===a[--o];a.pop());}e.e>y?e.c=e.e=null:e.e<m&&(e.c=[e.e=0])}return e}function P(e){var r,n=e.e;return null===n?e.toString():(r=$(e.c),r=n<=p||d<=n?W(r,n):X(r,n,"0"),e.s<0?"-"+r:r)}return B.clone=e,B.ROUND_UP=0,B.ROUND_DOWN=1,B.ROUND_CEIL=2,B.ROUND_FLOOR=3,B.ROUND_HALF_UP=4,B.ROUND_HALF_DOWN=5,B.ROUND_HALF_EVEN=6,B.ROUND_HALF_CEIL=7,B.ROUND_HALF_FLOOR=8,B.EUCLID=9,B.config=B.set=function(e){var r,n;if(null!=e){if("object"!=typeof e)throw Error(I+"Object expected: "+e);if(e.hasOwnProperty(r="DECIMAL_PLACES")&&(H(n=e[r],0,q,r),N=n),e.hasOwnProperty(r="ROUNDING_MODE")&&(H(n=e[r],0,8,r),O=n),e.hasOwnProperty(r="EXPONENTIAL_AT")&&((n=e[r])&&n.pop?(H(n[0],-q,0,r),H(n[1],0,q,r),p=n[0],d=n[1]):(H(n,-q,q,r),p=-(d=n<0?-n:n))),e.hasOwnProperty(r="RANGE"))if((n=e[r])&&n.pop)H(n[0],-q,-1,r),H(n[1],1,q,r),m=n[0],y=n[1];else{if(H(n,-q,q,r),!n)throw Error(I+r+" cannot be zero: "+n);m=-(y=n<0?-n:n)}if(e.hasOwnProperty(r="CRYPTO")){if((n=e[r])!==!!n)throw Error(I+r+" not true or false: "+n);if(n){if("undefined"==typeof crypto||!crypto||!crypto.getRandomValues&&!crypto.randomBytes)throw b=!n,Error(I+"crypto unavailable");b=n}else b=n}if(e.hasOwnProperty(r="MODULO_MODE")&&(H(n=e[r],0,9,r),o=n),e.hasOwnProperty(r="POW_PRECISION")&&(H(n=e[r],0,q,r),E=n),e.hasOwnProperty(r="FORMAT")){if("object"!=typeof(n=e[r]))throw Error(I+r+" not an object: "+n);A=n}if(e.hasOwnProperty(r="ALPHABET")){if("string"!=typeof(n=e[r])||/^.$|[+-.\s]|(.).*\1/.test(n))throw Error(I+r+" invalid: "+n);S=n}}return{DECIMAL_PLACES:N,ROUNDING_MODE:O,EXPONENTIAL_AT:[p,d],RANGE:[m,y],CRYPTO:b,MODULO_MODE:o,POW_PRECISION:E,FORMAT:A,ALPHABET:S}},B.isBigNumber=function(e){if(!e||!0!==e._isBigNumber)return!1;if(!B.DEBUG)return!0;var r,n,t=e.c,i=e.e,o=e.s;e:if("[object Array]"=={}.toString.call(t)){if((1===o||-1===o)&&-q<=i&&i<=q&&i===U(i)){if(0===t[0]){if(0===i&&1===t.length)return!0;break e}if((r=(i+1)%M)<1&&(r+=M),String(t[0]).length==r){for(r=0;r<t.length;r++)if((n=t[r])<0||C<=n||n!==U(n))break e;if(0!==n)return!0}}}else if(null===t&&null===i&&(null===o||1===o||-1===o))return!0;throw Error(I+"Invalid BigNumber: "+e)},B.maximum=B.max=function(){return R(arguments,t.lt)},B.minimum=B.min=function(){return R(arguments,t.gt)},B.random=(n=9007199254740992,l=Math.random()*n&2097151?function(){return U(Math.random()*n)}:function(){return 8388608*(1073741824*Math.random()|0)+(8388608*Math.random()|0)},function(e){var r,n,t,i,o,s=0,f=[],u=new B(w);if(null==e?e=N:H(e,0,q),i=L(e/M),b)if(crypto.getRandomValues){for(r=crypto.getRandomValues(new Uint32Array(i*=2));s<i;)9e15<=(o=131072*r[s]+(r[s+1]>>>11))?(n=crypto.getRandomValues(new Uint32Array(2)),r[s]=n[0],r[s+1]=n[1]):(f.push(o%1e14),s+=2);s=i/2}else{if(!crypto.randomBytes)throw b=!1,Error(I+"crypto unavailable");for(r=crypto.randomBytes(i*=7);s<i;)9e15<=(o=281474976710656*(31&r[s])+1099511627776*r[s+1]+4294967296*r[s+2]+16777216*r[s+3]+(r[s+4]<<16)+(r[s+5]<<8)+r[s+6])?crypto.randomBytes(7).copy(r,s):(f.push(o%1e14),s+=7);s=i/7}if(!b)for(;s<i;)(o=l())<9e15&&(f[s++]=o%1e14);for(i=f[--s],e%=M,i&&e&&(o=k[M-e],f[s]=U(i/o)*o);0===f[s];f.pop(),s--);if(s<0)f=[t=0];else{for(t=-1;0===f[0];f.splice(0,1),t-=M);for(s=1,o=f[0];10<=o;o/=10,s++);s<M&&(t-=M-s)}return u.e=t,u.c=f,u}),B.sum=function(){for(var e=1,r=arguments,n=new B(r[0]);e<r.length;)n=n.plus(r[e++]);return n},a=function(){var d="0123456789";function m(e,r,n,t){for(var i,o,s=[0],f=0,u=e.length;f<u;){for(o=s.length;o--;s[o]*=r);for(s[0]+=t.indexOf(e.charAt(f++)),i=0;i<s.length;i++)s[i]>n-1&&(null==s[i+1]&&(s[i+1]=0),s[i+1]+=s[i]/n|0,s[i]%=n)}return s.reverse()}return function(e,r,n,t,i){var o,s,f,u,l,c,a,h,g=e.indexOf("."),p=N,w=O;for(0<=g&&(u=E,E=0,e=e.replace(".",""),c=(h=new B(r)).pow(e.length-g),E=u,h.c=m(X($(c.c),c.e,"0"),10,n,d),h.e=h.c.length),f=u=(a=m(e,r,n,i?(o=S,d):(o=d,S))).length;0==a[--u];a.pop());if(!a[0])return o.charAt(0);if(g<0?--f:(c.c=a,c.e=f,c.s=t,a=(c=v(c,h,p,w,n)).c,l=c.r,f=c.e),g=a[s=f+p+1],u=n/2,l=l||s<0||null!=a[s+1],l=w<4?(null!=g||l)&&(0==w||w==(c.s<0?3:2)):u<g||g==u&&(4==w||l||6==w&&1&a[s-1]||w==(c.s<0?8:7)),s<1||!a[0])e=l?X(o.charAt(1),-p,o.charAt(0)):o.charAt(0);else{if(a.length=s,l)for(--n;++a[--s]>n;)a[s]=0,s||(++f,a=[1].concat(a));for(u=a.length;!a[--u];);for(g=0,e="";g<=u;e+=o.charAt(a[g++]));e=X(e,f,o.charAt(0))}return e}}(),v=function(){function S(e,r,n){var t,i,o,s,f=0,u=e.length,l=r%F,c=r/F|0;for(e=e.slice();u--;)f=((i=l*(o=e[u]%F)+(t=c*o+(s=e[u]/F|0)*l)%F*F+f)/n|0)+(t/F|0)+c*s,e[u]=i%n;return f&&(e=[f].concat(e)),e}function R(e,r,n,t){var i,o;if(n!=t)o=t<n?1:-1;else for(i=o=0;i<n;i++)if(e[i]!=r[i]){o=e[i]>r[i]?1:-1;break}return o}function _(e,r,n,t){for(var i=0;n--;)e[n]-=i,i=e[n]<r[n]?1:0,e[n]=i*t+e[n]-r[n];for(;!e[0]&&1<e.length;e.splice(0,1));}return function(e,r,n,t,i){var o,s,f,u,l,c,a,h,g,p,w,d,m,v,N,O,y,b=e.s==r.s?1:-1,E=e.c,A=r.c;if(!(E&&E[0]&&A&&A[0]))return new B(e.s&&r.s&&(E?!A||E[0]!=A[0]:A)?E&&0==E[0]||!A?0*b:b/0:NaN);for(g=(h=new B(b)).c=[],b=n+(s=e.e-r.e)+1,i||(i=C,s=j(e.e/M)-j(r.e/M),b=b/M|0),f=0;A[f]==(E[f]||0);f++);if(A[f]>(E[f]||0)&&s--,b<0)g.push(1),u=!0;else{for(v=E.length,O=A.length,b+=2,1<(l=U(i/(A[f=0]+1)))&&(A=S(A,l,i),E=S(E,l,i),O=A.length,v=E.length),m=O,w=(p=E.slice(0,O)).length;w<O;p[w++]=0);y=A.slice(),y=[0].concat(y),N=A[0],A[1]>=i/2&&N++;do{if(l=0,(o=R(A,p,O,w))<0){if(d=p[0],O!=w&&(d=d*i+(p[1]||0)),1<(l=U(d/N)))for(i<=l&&(l=i-1),a=(c=S(A,l,i)).length,w=p.length;1==R(c,p,a,w);)l--,_(c,O<a?y:A,a,i),a=c.length,o=1;else 0==l&&(o=l=1),a=(c=A.slice()).length;if(a<w&&(c=[0].concat(c)),_(p,c,w,i),w=p.length,-1==o)for(;R(A,p,O,w)<1;)l++,_(p,O<w?y:A,w,i),w=p.length}else 0===o&&(l++,p=[0]);g[f++]=l,p[0]?p[w++]=E[m]||0:(p=[E[m]],w=1)}while((m++<v||null!=p[0])&&b--);u=null!=p[0],g[0]||g.splice(0,1)}if(i==C){for(f=1,b=g[0];10<=b;b/=10,f++);D(h,n+(h.e=f+s*M-1)+1,t,u)}else h.e=s,h.r=+u;return h}}(),s=/^(-?)0([xbo])(?=\w[\w.]*$)/i,f=/^([^.]+)\.$/,u=/^\.([^.]+)$/,c=/^-?(Infinity|NaN)$/,g=/^\s*\+(?=[\w.])|^\s+|\s+$/g,h=function(e,r,n,t){var i,o=n?r:r.replace(g,"");if(c.test(o))e.s=isNaN(o)?null:o<0?-1:1;else{if(!n&&(o=o.replace(s,function(e,r,n){return i="x"==(n=n.toLowerCase())?16:"b"==n?2:8,t&&t!=i?e:r}),t&&(i=t,o=o.replace(f,"$1").replace(u,"0.$1")),r!=o))return new B(o,i);if(B.DEBUG)throw Error(I+"Not a"+(t?" base "+t:"")+" number: "+r);e.s=null}e.c=e.e=null},t.absoluteValue=t.abs=function(){var e=new B(this);return e.s<0&&(e.s=1),e},t.comparedTo=function(e,r){return z(this,new B(e,r))},t.decimalPlaces=t.dp=function(e,r){var n,t,i;if(null!=e)return H(e,0,q),null==r?r=O:H(r,0,8),D(new B(this),e+this.e+1,r);if(!(n=this.c))return null;if(t=((i=n.length-1)-j(this.e/M))*M,i=n[i])for(;i%10==0;i/=10,t--);return t<0&&(t=0),t},t.dividedBy=t.div=function(e,r){return v(this,new B(e,r),N,O)},t.dividedToIntegerBy=t.idiv=function(e,r){return v(this,new B(e,r),0,1)},t.exponentiatedBy=t.pow=function(e,r){var n,t,i,o,s,f,u,l,c=this;if((e=new B(e)).c&&!e.isInteger())throw Error(I+"Exponent not an integer: "+P(e));if(null!=r&&(r=new B(r)),s=14<e.e,!c.c||!c.c[0]||1==c.c[0]&&!c.e&&1==c.c.length||!e.c||!e.c[0])return l=new B(Math.pow(+P(c),s?2-V(e):+P(e))),r?l.mod(r):l;if(f=e.s<0,r){if(r.c?!r.c[0]:!r.s)return new B(NaN);(t=!f&&c.isInteger()&&r.isInteger())&&(c=c.mod(r))}else{if(9<e.e&&(0<c.e||c.e<-1||(0==c.e?1<c.c[0]||s&&24e7<=c.c[1]:c.c[0]<8e13||s&&c.c[0]<=9999975e7)))return o=c.s<0&&V(e)?-0:0,-1<c.e&&(o=1/o),new B(f?1/o:o);E&&(o=L(E/M+2))}for(u=s?(n=new B(.5),f&&(e.s=1),V(e)):(i=Math.abs(+P(e)))%2,l=new B(w);;){if(u){if(!(l=l.times(c)).c)break;o?l.c.length>o&&(l.c.length=o):t&&(l=l.mod(r))}if(i){if(0===(i=U(i/2)))break;u=i%2}else if(D(e=e.times(n),e.e+1,1),14<e.e)u=V(e);else{if(0==(i=+P(e)))break;u=i%2}c=c.times(c),o?c.c&&c.c.length>o&&(c.c.length=o):t&&(c=c.mod(r))}return t?l:(f&&(l=w.div(l)),r?l.mod(r):o?D(l,E,O,void 0):l)},t.integerValue=function(e){var r=new B(this);return null==e?e=O:H(e,0,8),D(r,r.e+1,e)},t.isEqualTo=t.eq=function(e,r){return 0===z(this,new B(e,r))},t.isFinite=function(){return!!this.c},t.isGreaterThan=t.gt=function(e,r){return 0<z(this,new B(e,r))},t.isGreaterThanOrEqualTo=t.gte=function(e,r){return 1===(r=z(this,new B(e,r)))||0===r},t.isInteger=function(){return!!this.c&&j(this.e/M)>this.c.length-2},t.isLessThan=t.lt=function(e,r){return z(this,new B(e,r))<0},t.isLessThanOrEqualTo=t.lte=function(e,r){return-1===(r=z(this,new B(e,r)))||0===r},t.isNaN=function(){return!this.s},t.isNegative=function(){return this.s<0},t.isPositive=function(){return 0<this.s},t.isZero=function(){return!!this.c&&0==this.c[0]},t.minus=function(e,r){var n,t,i,o,s=this,f=s.s;if(r=(e=new B(e,r)).s,!f||!r)return new B(NaN);if(f!=r)return e.s=-r,s.plus(e);var u=s.e/M,l=e.e/M,c=s.c,a=e.c;if(!u||!l){if(!c||!a)return c?(e.s=-r,e):new B(a?s:NaN);if(!c[0]||!a[0])return a[0]?(e.s=-r,e):new B(c[0]?s:3==O?-0:0)}if(u=j(u),l=j(l),c=c.slice(),f=u-l){for((i=(o=f<0)?(f=-f,c):(l=u,a)).reverse(),r=f;r--;i.push(0));i.reverse()}else for(t=(o=(f=c.length)<(r=a.length))?f:r,f=r=0;r<t;r++)if(c[r]!=a[r]){o=c[r]<a[r];break}if(o&&(i=c,c=a,a=i,e.s=-e.s),0<(r=(t=a.length)-(n=c.length)))for(;r--;c[n++]=0);for(r=C-1;f<t;){if(c[--t]<a[t]){for(n=t;n&&!c[--n];c[n]=r);--c[n],c[t]+=C}c[t]-=a[t]}for(;0==c[0];c.splice(0,1),--l);return c[0]?_(e,c,l):(e.s=3==O?-1:1,e.c=[e.e=0],e)},t.modulo=t.mod=function(e,r){var n,t,i=this;return e=new B(e,r),!i.c||!e.s||e.c&&!e.c[0]?new B(NaN):!e.c||i.c&&!i.c[0]?new B(i):(9==o?(t=e.s,e.s=1,n=v(i,e,0,3),e.s=t,n.s*=t):n=v(i,e,0,o),(e=i.minus(n.times(e))).c[0]||1!=o||(e.s=i.s),e)},t.multipliedBy=t.times=function(e,r){var n,t,i,o,s,f,u,l,c,a,h,g,p,w,d,m=this,v=m.c,N=(e=new B(e,r)).c;if(!(v&&N&&v[0]&&N[0]))return!m.s||!e.s||v&&!v[0]&&!N||N&&!N[0]&&!v?e.c=e.e=e.s=null:(e.s*=m.s,v&&N?(e.c=[0],e.e=0):e.c=e.e=null),e;for(t=j(m.e/M)+j(e.e/M),e.s*=m.s,(u=v.length)<(a=N.length)&&(p=v,v=N,N=p,i=u,u=a,a=i),i=u+a,p=[];i--;p.push(0));for(w=C,d=F,i=a;0<=--i;){for(n=0,h=N[i]%d,g=N[i]/d|0,o=i+(s=u);i<o;)n=((l=h*(l=v[--s]%d)+(f=g*l+(c=v[s]/d|0)*h)%d*d+p[o]+n)/w|0)+(f/d|0)+g*c,p[o--]=l%w;p[o]=n}return n?++t:p.splice(0,1),_(e,p,t)},t.negated=function(){var e=new B(this);return e.s=-e.s||null,e},t.plus=function(e,r){var n,t=this,i=t.s;if(r=(e=new B(e,r)).s,!i||!r)return new B(NaN);if(i!=r)return e.s=-r,t.minus(e);var o=t.e/M,s=e.e/M,f=t.c,u=e.c;if(!o||!s){if(!f||!u)return new B(i/0);if(!f[0]||!u[0])return u[0]?e:new B(f[0]?t:0*i)}if(o=j(o),s=j(s),f=f.slice(),i=o-s){for((n=0<i?(s=o,u):(i=-i,f)).reverse();i--;n.push(0));n.reverse()}for((i=f.length)-(r=u.length)<0&&(n=u,u=f,f=n,r=i),i=0;r;)i=(f[--r]=f[r]+u[r]+i)/C|0,f[r]=C===f[r]?0:f[r]%C;return i&&(f=[i].concat(f),++s),_(e,f,s)},t.precision=t.sd=function(e,r){var n,t,i;if(null!=e&&e!==!!e)return H(e,1,q),null==r?r=O:H(r,0,8),D(new B(this),e,r);if(!(n=this.c))return null;if(t=(i=n.length-1)*M+1,i=n[i]){for(;i%10==0;i/=10,t--);for(i=n[0];10<=i;i/=10,t++);}return e&&this.e+1>t&&(t=this.e+1),t},t.shiftedBy=function(e){return H(e,-G,G),this.times("1e"+e)},t.squareRoot=t.sqrt=function(){var e,r,n,t,i,o=this,s=o.c,f=o.s,u=o.e,l=N+4,c=new B("0.5");if(1!==f||!s||!s[0])return new B(!f||f<0&&(!s||s[0])?NaN:s?o:1/0);if((n=0==(f=Math.sqrt(+P(o)))||f==1/0?(((r=$(s)).length+u)%2==0&&(r+="0"),f=Math.sqrt(+r),u=j((u+1)/2)-(u<0||u%2),new B(r=f==1/0?"1e"+u:(r=f.toExponential()).slice(0,r.indexOf("e")+1)+u)):new B(f+"")).c[0])for((f=(u=n.e)+l)<3&&(f=0);;)if(i=n,n=c.times(i.plus(v(o,i,l,1))),$(i.c).slice(0,f)===(r=$(n.c)).slice(0,f)){if(n.e<u&&--f,"9999"!=(r=r.slice(f-3,f+1))&&(t||"4999"!=r)){+r&&(+r.slice(1)||"5"!=r.charAt(0))||(D(n,n.e+N+2,1),e=!n.times(n).eq(o));break}if(!t&&(D(i,i.e+N+2,0),i.times(i).eq(o))){n=i;break}l+=4,f+=4,t=1}return D(n,n.e+N+1,O,e)},t.toExponential=function(e,r){return null!=e&&(H(e,0,q),e++),i(this,e,r,1)},t.toFixed=function(e,r){return null!=e&&(H(e,0,q),e=e+this.e+1),i(this,e,r)},t.toFormat=function(e,r,n){var t;if(null==n)null!=e&&r&&"object"==typeof r?(n=r,r=null):e&&"object"==typeof e?(n=e,e=r=null):n=A;else if("object"!=typeof n)throw Error(I+"Argument not an object: "+n);if(t=this.toFixed(e,r),this.c){var i,o=t.split("."),s=+n.groupSize,f=+n.secondaryGroupSize,u=n.groupSeparator||"",l=o[0],c=o[1],a=this.s<0,h=a?l.slice(1):l,g=h.length;if(f&&(i=s,s=f,g-=f=i),0<s&&0<g){for(i=g%s||s,l=h.substr(0,i);i<g;i+=s)l+=u+h.substr(i,s);0<f&&(l+=u+h.slice(i)),a&&(l="-"+l)}t=c?l+(n.decimalSeparator||"")+((f=+n.fractionGroupSize)?c.replace(new RegExp("\\d{"+f+"}\\B","g"),"$&"+(n.fractionGroupSeparator||"")):c):l}return(n.prefix||"")+t+(n.suffix||"")},t.toFraction=function(e){var r,n,t,i,o,s,f,u,l,c,a,h,g=this,p=g.c;if(null!=e&&(!(f=new B(e)).isInteger()&&(f.c||1!==f.s)||f.lt(w)))throw Error(I+"Argument "+(f.isInteger()?"out of range: ":"not an integer: ")+P(f));if(!p)return new B(g);for(r=new B(w),l=n=new B(w),t=u=new B(w),h=$(p),o=r.e=h.length-g.e-1,r.c[0]=k[(s=o%M)<0?M+s:s],e=!e||0<f.comparedTo(r)?0<o?r:l:f,s=y,y=1/0,f=new B(h),u.c[0]=0;c=v(f,r,0,1),1!=(i=n.plus(c.times(t))).comparedTo(e);)n=t,t=i,l=u.plus(c.times(i=l)),u=i,r=f.minus(c.times(i=r)),f=i;return i=v(e.minus(n),t,0,1),u=u.plus(i.times(l)),n=n.plus(i.times(t)),u.s=l.s=g.s,a=v(l,t,o*=2,O).minus(g).abs().comparedTo(v(u,n,o,O).minus(g).abs())<1?[l,t]:[u,n],y=s,a},t.toNumber=function(){return+P(this)},t.toPrecision=function(e,r){return null!=e&&H(e,1,q),i(this,e,r,2)},t.toString=function(e){var r,n=this,t=n.s,i=n.e;return null===i?t?(r="Infinity",t<0&&(r="-"+r)):r="NaN":(r=null==e?i<=p||d<=i?W($(n.c),i):X($(n.c),i,"0"):10===e?X($((n=D(new B(n),N+i+1,O)).c),n.e,"0"):(H(e,2,S.length,"Base"),a(X($(n.c),i,"0"),10,e,t,!0)),t<0&&n.c[0]&&(r="-"+r)),r},t.valueOf=t.toJSON=function(){return P(this)},t._isBigNumber=!0,null!=r&&B.set(r),B}()).default=r.BigNumber=r,"function"==typeof define&&define.amd?define(function(){return r}):"undefined"!=typeof module&&module.exports?module.exports=r:(e||(e="undefined"!=typeof self&&self?self:window),e.BigNumber=r)}(this);
/* globals define, module, jQuery */

/*
 * Mailcheck https://github.com/mailcheck/mailcheck
 * Author
 * Derrick Ko (@derrickko)
 *
 * Released under the MIT License.
 *
 * v 1.1.2
 */

