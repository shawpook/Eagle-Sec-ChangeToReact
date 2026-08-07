const config = {
	DELAYED_INIT : 1000,
	SUPPORT_FORMATS_DARWIN: ['afx', 'eva', 'vap', '360', 'avif', 'url', 'html', 'mhtml', 'png', 'jpg', 'jfif', 'jxl', 'jpe', 'insp', 'gif', 'tiff', 'tif', 'jpeg', 'psd', 'psdt', 'psb', 'ai', 'ait', 'pdf', 'svg', 'bmp', 'icns', 'ico', 'txt', 'eps', 'xd', 'c4d', 'blend', 'clip', 'skp', 'dwg', 'prd', 'webp', 'fig', 'sketch', 'af', 'afpub', 'afdesign', 'afphoto', 'pdf', 'mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'ts', '3gp', 'mp4', 'mkv', 'mpg', 'mov', 'm4v', 'webm', 'avi', 'mts', 'wmv', 'flv', 'm2ts', 'f4v', 'key', 'pages', 'number', 'potx', 'pptx', 'ppt', 'doc', 'docx', 'xls', 'xlsx', 'numbers', 'glb', 'fbx', 'obj', '3ds', '3mf', 'dae', 'ifc', 'ply', 'stl', 'hdr', 'exr', 'cdr', 'skt', 'hif', 'heic', 'heif', 'pxd', 'ttf', 'otf', 'ttc', 'woff', 'graffle', 'xmind', 'mindnode', 'tga', 'indd', 'indt', 'idml', 'dds', 'arw', 'cr2', 'cr3', 'crw', 'dng', 'raf', 'rw2', 'orf', 'nef', 'nrw', 'raw', '3fr', 'erf', 'srw', 'sr2', 'pef', 'x3f','mrw', 'eddx', 'emmx'],
	SUPPORT_FORMATS_WIN: ['afx', 'eva', 'vap', '360', 'avif', 'url', 'html', 'mhtml', 'png', 'jpg', 'jfif', 'jxl', 'jpe', 'insp', 'gif', 'tiff', 'tif', 'jpeg', 'psd', 'psdt', 'psb', 'pdf', 'svg', 'bmp', 'icns', 'ico', 'txt', 'xd', 'ps', 'webp', 'mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'ts', '3gp', 'mp4', 'mkv', 'mpg', 'mov', 'm4v', 'webm', 'avi', 'mts', 'wmv', 'flv', 'm2ts', 'f4v', 'potx', 'pptx', 'ppt', 'glb', 'fbx', 'obj', '3ds', '3mf', 'dae', 'ifc', 'ply', 'stl', 'hdr', 'exr', 'cdr', 'skp', 'dwg', 'c4d', 'clip', 'blend', 'af', 'afpub', 'afdesign', 'afphoto', 'ttf', 'otf', 'ttc', 'woff', 'tga', 'indd', 'indt', 'idml', 'dds', 'heic', 'heif', 'hif', 'xmind', 'doc', 'docx', 'xls', 'xlsx', 'arw', 'cr2', 'cr3', 'crw', 'dng', 'raf', 'rw2', 'orf', 'nef', 'nrw', 'raw', '3fr', 'erf', 'srw', 'sr2', 'pef', 'x3f','mrw', 'eddx', 'emmx'],
	EXTENSION_PORT : 41593,
	STATIC_PORT : 41592,
	API_PORT : 41595,
	THUMBNAIL_SIZE : 320,
	NO_THUMBNAIL_SIZE: 960,
	NO_THUMBNAIL_FILE_SIZE: 15000000,
	SUPPORT_FORMATS: [],
    MAX_FILENAME: 240,
	VIDEO_FORMATS: ['ts', '3gp', '360', 'afx', 'vap', 'eva', 'mp4', 'mov', 'm4v', 'webm', 'mkv', 'avi', 'wmv', 'mpg', 'mts', 'flv', 'm2ts', 'f4v'],
	AUDIO_FORMATS: ['mp3', 'wav', 'flac', 'ogg', 'aac', 'm4a'],
	MODEL_FORMATS: ['glb', 'obj', 'fbx', '3ds', '3mf', 'dae', 'ifc', 'ply', 'stl'],
	FONT_FORMATS:  ['ttf', 'otf', 'ttc', 'woff', 'woff2'],
	URL_FORMATS:   ['url', 'mhtml', 'html'],
}

if( process.platform == 'darwin' ) {
    config.USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36 Safari/537.36 Electron/21.0.0 Eagle/4.0.0";
    config.SUPPORT_FORMATS_DARWIN.forEach(function (ext) {
		config.SUPPORT_FORMATS[ext] = true;
	});

	// 移除 EPS 格式支持
	if (parseInt(require('os').release()) >= 22) {
		delete config.SUPPORT_FORMATS["eps"];
	}

}
else {
    config.USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36 Safari/537.36 Electron/21.0.0 Eagle/4.0.0";
    config.SUPPORT_FORMATS_WIN.forEach(function (ext) {
		config.SUPPORT_FORMATS[ext] = true;
	});
}

module.exports = config;
