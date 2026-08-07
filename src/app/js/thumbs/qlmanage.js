const fs = require('fs');
const path = require('path');
const appRoot = require('app-root-path');
const imageSize = require(appRoot.path + '/app/js/utils/imageSize.js');
const { ipcRenderer } = require('electron');

const runQlmanage = async (src, folder, size = 1440, useServer = true) => {
	return new Promise((resolve, reject) => {
		let spawn = require('child_process').spawn;
		let params = ['-t'];
		
		if (useServer) {
			params.push('-x');
		}
		params.push('-s', size);
		params.push(src);
		params.push('-o');
		params.push(folder);

		const output = path.normalize(`${src}.png`);
		
		const pwd = spawn('qlmanage', params, { timeout: 20000 });
		
		pwd.stdout.on('data', (data) => {
			console.log(`stdout: ${data}`);
		});
		
		pwd.stderr.on('data', (data) => {
			console.error(`stderr: ${data}`);
		});

		pwd.on('close', (code) => {
			console.log(`child process exit code: ${code}`);
			if (fs.existsSync(output)) {
				resolve(output);
			} else {
				reject(new Error(`Thumbnail generate fail.`));
			}
		});
	});
};

module.exports = async ({ src, dest, item }) => {
	if (process.platform === 'win32') {
		return Promise.reject(new Error(`${item.ext} is not supported on Windows.`));
	}

	const folder = path.dirname(dest);
	let useServer = item.ext === 'sketch';
	let size = (useServer) ? 1440 : 6000;
	
	try {
		// 首先嘗試使用 -x 參數
		const output = await runQlmanage(src, folder, size, useServer);
		const fse = require('fs-extra');
		fse.moveSync(output, dest, { overwrite: true });
	} catch (error) {
		return Promise.reject(error);
	}

	// 獲取縮略圖尺寸
	let thumbSize;
	try {
		thumbSize = await imageSize.async(dest);
	} catch (err) {
		console.error('Failed to get thumbnail size:', err);
	}

	item.width = thumbSize?.width ?? item.width;
	item.height = thumbSize?.height ?? item.height;

	return item;
};
