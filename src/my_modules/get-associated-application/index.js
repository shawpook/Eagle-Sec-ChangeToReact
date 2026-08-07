module.exports = getAssociatedApplications;

const fs = require("fs");
const path = require("path");
const appRoot = require('app-root-path');

var AssociatedApplicationsCache = {};

async function getAssociatedApplications (filePath) {
    return new Promise(function (resolve, reject) {
        var ext = path.extname(filePath);
        if (AssociatedApplicationsCache[ext]) return resolve(AssociatedApplicationsCache[ext]);
        const exec = require('child_process').exec;
        if (isDev) { RESOURCES_PATH = path.join(appRoot.path, '/build_files/'); }
        else { RESOURCES_PATH = path.join(process.resourcesPath); }
        var scriptPath = path.normalize(`${RESOURCES_PATH}/AppleScript/asso.applescript`);
		var launchHandlerPath = path.normalize(`${RESOURCES_PATH}/AppleScript/launchHandler`);

        console.time("getAssociatedApplications")
        let tempFilePath = `${EAGLE_THUMBNAIL_TEMP_PATH}/${guid()}.${ext}`;
        fs.writeFileSync(tempFilePath, "");

		// require("electron").ipcRenderer.send('electron-log-debug', `${launchHandlerPath} "${tempFilePath}"`);
		exec(`"${launchHandlerPath}" "${tempFilePath}"`, { timeout: 5000 }, function (err, stdout, stderr) {

			if (err) {
				require("electron").ipcRenderer.send('electron-log', err.stack || err);
				return;
			}
			if (stderr) {
				require("electron").ipcRenderer.send('electron-log', stderr);
				return;
			}
			console.timeEnd("getAssociatedApplications")
			let stdArr = stdout.split("\n");
			let result = [];
			stdArr.forEach(function (line, index) {
				let p = line.split(":::")[1];
				let name = line.split(":::")[0];
				if (name && p) {
					result.push({
						default: index === 0,
						name: path.basename(name),
						path: p,
						icon: `${EAGLE_APP_ICON_TEMP_PATH}/${path.parse(p).name}@2x.png`
					});
				}
			});
			// console.log(result);

			result = result.sort(function (a, b) {
				if (a.default) return -1;
				if (b.default) return 1;
				if ( a.name < b.name ){
					return -1;
				}
				if ( a.name > b.name ){
					return 1;
				}
				return 0;
			});
			if (!err) {
				AssociatedApplicationsCache[ext] = result;
			}
			return resolve(result);
		});
    });
}
