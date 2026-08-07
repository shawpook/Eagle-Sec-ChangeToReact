module.exports = ({src, dest, size}) => {
	return new Promise((resolve, reject) => {
		const appRoot = require('app-root-path');
		const URL_MODULE = require(appRoot + '/my_modules/url');
		var fileUrl = URL_MODULE.pathToFileURL(src).href;
		var callbackFunctionName = `threeJSReadyCallback${guid()}`;
		var $iframe = $(`<iframe id="texture-viewer" src="../app/texture-viewer/index.html?path=${fileUrl}" style="width: ${size}px; height: ${size}px; pointer-events: none; opacity: 0;" callback="${callbackFunctionName}"></iframe>`);
		window[callbackFunctionName] = async (err, result) => {
			$iframe.attr("src", "");
			$iframe.remove();
			delete window[callbackFunctionName];
			let base64 = result.base64;
			if (base64 && base64.length > 0) {
				var decode = decodeBase64Image(base64);
				if (!decode || !decode.data) {
                    reject(new Error(`Can not decode base64 data.`));
                }
                else {
                    await fs.promises.writeFile(dest, decode.data);
					resolve(result);
                }
			}
			else {
				reject(err);
			}
		};
		$("body").append($iframe);
	});
}