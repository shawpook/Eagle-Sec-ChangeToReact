const fs = window.parent.require("fs");
const os = window.parent.require("os");
const appRoot = window.parent.require('app-root-path');
const URL_MODULE = window.parent.require(appRoot + '/my_modules/url');

$(document).ready(function () {

    window.parent.focus();
    var urlParams = window.location.search.substr(1).split('&').reduce(function(accumulator, currentValue) {
            var pair = currentValue
                .split('=')
                .map(function(value) {
                    return decodeURIComponent(value);
                });

            accumulator[pair[0]] = pair[1];

            return accumulator;
        },
        {}
    );
    var path = urlParams.path;
    var ext = urlParams.ext;
    var rawName = urlParams.name;
    var rawPath = decodeURIComponent(path) + rawName + "." + ext;
    var thumbPath = decodeURIComponent(path) + rawName + "_thumbnail.png";
    var rawUrl = URL_MODULE.pathToFileURL(rawPath).href;
    var thumbUrl = URL_MODULE.pathToFileURL(thumbPath).href;
    var orientation = urlParams.orientation;
    orientation = parseInt(orientation);
    var height = parseInt(urlParams.height);
    var width = parseInt(urlParams.width);

    var $image = $("#main-image");
    var $canvas = $("#canvas");

    // thumbPath = thumbPath.replace(/#/g, '%23');

    $image.addClass(`r${orientation}`);
    $canvas.addClass(`r${orientation}`);

    switch (orientation) {
        case 5:
        case 6:
        case 7:
        case 8:
            if (width > height) {
                $image.addClass(`fit-height2`);
                $canvas.addClass(`fit-height2`);
            }
            else {
                $image.addClass(`fit-width2`);
                $canvas.addClass(`fit-width2`);
            }
            break;
        default:
            if (width > height) {
                $image.addClass(`fit-width`);
                $canvas.addClass(`fit-width`);
            }
            else {
                $image.addClass(`fit-height`);
                $canvas.addClass(`fit-height`);
            }
    }

    $image.attr("src", thumbUrl);
    $image.addClass("show");

    setTimeout(function () {
        try {
            const buf = fs.readFileSync(rawPath);
            const jpegBuf = dcraw(buf, { extractThumbnail: true });
            const arrayBuf = toArrayBuffer(jpegBuf);
            const blob = new Blob([arrayBuf], {type: 'image/jpg'});

            var canvas = document.getElementById('canvas');
            var ctx = canvas.getContext("2d");
            var img = new Image();
            img.onload = function() {
				if (img?.width < 480 || img?.height < 480) return;
                canvas.width = img.width;
                canvas.height = img.height;
                console.log(img.width);
                ctx.drawImage(img, 0, 0);
                $canvas.addClass("show");
                // $image.removeClass("show");
            };
            img.src = URL.createObjectURL(blob);
        }
        catch (err) {
            console.log(err);
        }
    }, 100);

});

function toArrayBuffer(buf) {
    var ab = new ArrayBuffer(buf.length);
    var view = new Uint8Array(ab);
    for (var i = 0; i < buf.length; ++i) {
        view[i] = buf[i];
    }
    return ab;
}