const fs = require('fs');
module.exports = async ({ src, item }) => {
    return new Promise((resolve, reject) => {
        fs.readFile(src, 'utf8', (err, text) => {
            if (!err) {
                item.text = text.substr(0, 1024 * 32);
                return resolve(item);
            }
            return reject(err);
        });
    });
}
