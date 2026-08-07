module.exports = async ({ src, dest, ext, size }) => {
	return new Promise(async (resolve, reject) => {
		let options = [src, dest];
		if (ext == "png" || ext == "gif" || ext == "psb" || ext == "psd" || ext == "psdt" || ext == "hdr" || ext == "exr" || ext == "tga" || ext == 'xlsx' || ext == 'xls' || ext == 'dds') {
			options.push("png");
		}
		else {
			options.push("jpg");
		}
		options.push(size);
		options.push(EdgeJS.GHOST_SCRIPT_PATH);

		EdgeJS.Magick(options, function (err, size) {
			if (err) {
				return reject(err);
			}
			return resolve({
				width: size[0],
				height: size[1],
			});
		});
	});
}
