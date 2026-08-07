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

var colorConvert = require('color-convert');
var DeltaE = require('delta-e');
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