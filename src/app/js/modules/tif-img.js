angular.module("tifImg", []).directive('tifImg', function () {
    return {
        restrict: 'A',
        scope: {
            tifImg: "=tifImg"
        },
        link: function (scope, element) {

            let worker;
            const $parent = $(element[0].parentNode);

            scope.$watch("tifImg", loadTif);

            async function loadURLFromWorker(url) {
                return new Promise((resolve, reject) => {

                    if (worker) {
                        worker.terminate();
                        worker = null;
                    }

                    worker = new Worker('js/workers/tifWorker.js');
                    worker.postMessage({ url });

                    worker.onmessage = (e) => {
                        const processedURL = e?.data?.url;
                        if (processedURL !== url && processedURL) {
                            worker.terminate();
                            return;
                        }
                        if (e.data.error) {
                            reject(new Error(e.data.error));
                        } else {
                            resolve(e.data);
                        }
                        worker.terminate();
                    };

                    worker.onerror = () => {
                        reject(new Error('Worker error occurred'));
                        worker.terminate();
                    };
                });
            }

            async function loadTif(newValue, oldValue) {
                if (!newValue) return;

                $("#detail-image").css("opacity", 1);

                const canvas = $parent.find("canvas");
                if (canvas.length > 0) {
                    canvas.remove();
                    element.css({
                        "opacity": 1,
                        "position": "",
                        "z-index": ""
                    });
                }

                const image = scope.tifImg;
                const filePath = FileUrlHelper.getRawUrl(image);
                const { rgba, width, height } = await loadURLFromWorker(filePath);

                if (rgba) {
                    canvas.remove();
                    const cnv = document.createElement("canvas");
                    cnv.width = width;
                    cnv.height = height;
                    const ctx = cnv.getContext("2d");
                    const imgd = ctx.createImageData(width, height);
                    for (let i = 0; i < rgba.length; i++) {
                        imgd.data[i] = rgba[i];
                    }
                    ctx.putImageData(imgd, 0, 0);
                    console.timeEnd("tif");
                    const attr = ["class", "id"];
                    for (let i = 0; i < attr.length; i++) {
                        cnv.setAttribute(attr[i], element[0].getAttribute(attr[i]));
                    }
                    $(cnv).css({
                        'z-index': '10000',
                        position: 'relative'
                    });
                    $parent.append(cnv);
                    element.css({
                        "position": "absolute",
                        "z-index": "9999"
                    });
                    $("#detail-image").css("opacity", 0);
                }
            }
        }
    }
});
