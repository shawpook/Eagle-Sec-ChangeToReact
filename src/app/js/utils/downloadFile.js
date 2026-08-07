module.exports = (params) => {
	return new Promise((resolve, reject) => {

        const { net } = remote;
		const src = params.src;
		const dest = params.dest;
		const referer = params.referer;
        const userAgent = params.userAgent || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Eagle/3.0.0 Chrome/145.0.0.0 Safari/537.36";
		const outPutPath = path.normalize(dest);

        const writerStream = fs.createWriteStream(outPutPath, {flags:'w'});
        const request = net.request({
            url: src,
            method: 'GET',
        });
        let progress;
        let totalByte;
        let currentByte = 0;
		let netTimeout;
        let isResolved = false;
		let finalResolve = (err, param) => {
            if (!isResolved) {
                isResolved = true;
                clearTimeout(netTimeout);
				if (!err) {
                	return resolve(param);
				}
				else {
					return reject(err);
				}
            }
        };

		let startTimeout = () => {
            netTimeout = setTimeout(function () {
                console.error(`Download timeout: ${src}`);
                finalResolve(new Error(`Download timeout: ${src}`));
            }, 30000);
        };
        startTimeout();

        if (referer) {
            request.setHeader("referer", referer);
        }

        request.setHeader("user-agent", userAgent);

        request.on('response', (response) => {

            console.log(`STATUS: ${response.statusCode}`)

            if (response.headers["content-length"]) {
                let total = Math.abs(response.headers["content-length"]);
                if (typeof total === "number") {
                    totalByte = total;
                }
            }

            if (!((response.statusCode >= 200) && (response.statusCode <= 299))) {
                request.abort();
            }

            response.on('data', (chunk) => {
                clearTimeout(netTimeout);
                startTimeout();
                currentByte += chunk.length;
                writerStream.write(chunk);
                try {
                    if (totalByte && currentByte) {
                        progress = currentByte / totalByte * 100;
                        params.onProgress(progress);
                    }
                    if (currentByte === totalByte) {
                        finalResolve(undefined, outPutPath);
                    }
                }
                catch (err) {}
            });

            response.on('error', (error) => {
                console.error(error);
            })

            response.on('end', () => {
                console.log(`Downloaded: ${currentByte}`)
                if (currentByte === 0) {
                    finalResolve(new Error(`Download fail, please try again.`));
                }
                else {
                    writerStream.end();
                }
            });
        });

        request.on('error', (err) => {
            console.log(`request.error`);
            finalResolve(err);
            electronLog.error(`[main] cannot download url with net.ClientRequest: ${src}, error: ${err.stack || err}`);
        });

        request.on('abort', () => {
            console.log(`request.abort`);
            finalResolve(new Error(`Download task was interrupted`));
            electronLog.error(`[main] cannot download url with net.ClientRequest: ${src}, abort`);
        });

        writerStream.on("finish", function() {
            finalResolve(undefined, outPutPath);
        });

        request.end();
    });
}