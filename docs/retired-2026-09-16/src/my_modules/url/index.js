const URL_NATIVE = require("url");
const path = require("path");

module.exports = {
	pathToFileURL: pathToFileURL,
    fileURLToPath: fileURLToPath
};

function pathToFileURL (filePath) {
	try {
        if (process.platform === 'darwin') {
            return URL_NATIVE.pathToFileURL(filePath);
        }
        else {
        	filePath = path.normalize(filePath);
        	if (filePath[0] === '\\' && filePath[1] === '\\') {
        		return {
        			href: "file://" + URL_NATIVE.pathToFileURL(filePath).hostname + URL_NATIVE.pathToFileURL(filePath).pathname
        		}
        	}
            else {
                return URL_NATIVE.pathToFileURL(filePath);
            }
        }
    }
    catch (err) {
        return "";
    }
}


function fileURLToPath (fileURL) {
    try {
        return URL_NATIVE.fileURLToPath(fileURL);
    }
    catch (err) {
        return "";
    }
}