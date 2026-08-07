const path = require('path');
const EAGLE_THUMBNAIL_LENGTH = 10;

function remainingFilenameLength(libraryPath) {
    let maxPathLength;

    // both windows and macosx have 255 filename length limit
    let maxFilenameLength = 255 - EAGLE_THUMBNAIL_LENGTH;

    const dirPath = path.normalize(libraryPath).replace(/\\/g, "/");

    // base on os platform to set max path length limit
    if (process.platform === 'win32') {
        // windows full path length limit is 260
        // null character is 1
        // 8.3 filename is 12
        // http://demon.tw/programming/max_path-or-max_path-1.html
        // https://docs.microsoft.com/en-us/windows/win32/fileio/naming-a-file#maximum-path-length-limitation
        maxPathLength = 260 - 1 - 12 - EAGLE_THUMBNAIL_LENGTH;
    }

    if (process.platform === 'darwin') {
        // mac actual file length limit is 1023
        maxPathLength = 1023;
    }

    // calc remaining filename length
    // -28 -> /images/LHXFONDA3HQZ2.info/
    const remainingLength = maxPathLength - dirPath.length - 28;

    if (remainingLength < 0) {
        return 0;
    }
    
    return Math.min(remainingLength, maxFilenameLength);
}

module.exports = remainingFilenameLength;