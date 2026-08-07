module.exports = async (urls) => {

    let isReturn = false;

    urls.push({
        url: `https://proxy.eagle.cool/?url=${urls[0].url}`,
        delay: 2000
    });

    const request = require('request');
    const checkURL = (url, delay) => {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                if (isReturn) {
                    return reject(null);
                }
                const options = {
                    url: url,
                    method: 'HEAD',
                    timeout: 5000
                };
                request(options, (err, res, body) => {
                    if (err) {
                        return reject(err);
                    }
                    if (res.statusCode === 200) {
                        return resolve(url);
                    } else {
                        return resolve(null);
                    }
                });
            }, delay);
        });
    };

    const promises = urls.map(({ url, delay }) => checkURL(url, delay));

    try {
        const url = await Promise.any(promises);
        isReturn = true;
        return url;
    } catch (err) {
        return null;
    }
}