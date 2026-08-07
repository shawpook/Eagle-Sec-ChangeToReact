const fs = require('fs');
const appRoot = require('app-root-path');
const imageSize = require(appRoot.path + '/app/js/utils/imageSize.js');


module.exports = async ({ src, dest, item }) => {
    return new Promise(async (resolve, reject) => {
        try { 
			let result = await indesign2image(src, dest);
			item.height = result?.height || item.height;
			item.width = result?.width || item.width;

			if (!fs.existsSync(dest)) {
                return reject(new Error(`InDesign thumbnail generate fail.`));
            }
			
			return resolve(item);
		} 
		catch (err) {
			return reject(err);
		}
    });
}

async function indesign2image (src, dest) {
	return new Promise((resolve, reject) => {

		src = path.normalize(src).replace(/\\/g, "/");
		dest = path.normalize(dest).replace(/\\/g, "/");
		const output = `${dest}.jpg`;

		var whenCommandFinish = async () => {
			if (fs.existsSync(output)) {
				// rename output to dest if is exists, otherwise, it will be a folder
				if (fs.existsSync(dest)) {
					fs.unlinkSync(dest);
				}
				fs.renameSync(output, dest);

				let imageSizes = await imageSize.async(dest);
				return resolve({
					width: imageSizes.width,
					height: imageSizes.height,
				});
			}
			else {
				return reject(new Error(`Can not parse InDesign File.`));
			}
		}

		if (process.platform === 'darwin') {
			const applescript = require(appRoot + '/my_modules/applescript');
			var script = `tell application id "com.adobe.indesign" to do script \"try { app.scriptPreferences.userInteractionLevel = UserInteractionLevels.NEVER_INTERACT; var isOpened = app.documents.length >= 1; var template = app.open(File (\'${src}\'), false); var pageName = \'1\'; if (template.pages.length > 1) { pageName = \'+1\'; } app.jpegExportPreferences.jpegQuality = JPEGOptionsQuality.MAXIMUM; app.jpegExportPreferences.pageString = pageName; app.jpegExportPreferences.jpegExportRange = ExportRangeOrAllPages.EXPORT_RANGE; template.exportFile(ExportFormat.JPG, new File(\'${dest}\'), false); if (!isOpened) { template.close(SaveOptions.NO); } app.scriptPreferences.userInteractionLevel = UserInteractionLevels.INTERACT_WITH_ALERTS; } catch (err) {} \" language javascript`; 
			applescript.execString(script, function(err, rtn) {
				if (err) { 
					ipcRenderer.send('electron-log', err.stack || err); 
					ipcRenderer.send('electron-log', script);
				}
				whenCommandFinish();
			});
		}
		else {
			var script = `$app = new-object -comobject InDesign.Application; $app.DoScript('try { app.scriptPreferences.userInteractionLevel = UserInteractionLevels.NEVER_INTERACT; var isOpened = app.documents.length >= 1; ;var template = app.open(File("${src}"), false); app.jpegExportPreferences.jpegQuality = JPEGOptionsQuality.MAXIMUM; var pageName = "1"; if (template.pages.length > 1) { pageName = "+1"; } app.jpegExportPreferences.pageString = pageName; app.jpegExportPreferences.jpegExportRange = ExportRangeOrAllPages.EXPORT_RANGE; template.exportFile(ExportFormat.JPG, new File("${dest}"), false); if (!isOpened) { template.close(SaveOptions.NO); } app.scriptPreferences.userInteractionLevel = UserInteractionLevels.INTERACT_WITH_ALERTS; } catch (err) {}', 1246973031)`;
			exec(script, {'shell':'powershell.exe'}, function (err, stdout, stderr) {
				if (err) { 
					ipcRenderer.send('electron-log', err.stack || err); 
					ipcRenderer.send('electron-log', script);
				}
				whenCommandFinish();
			});
		}
	});
}