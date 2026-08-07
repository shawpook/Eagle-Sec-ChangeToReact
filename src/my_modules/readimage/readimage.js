"use strict";

var fs = require("fs");

module.exports = read
module.exports.Image = Image
module.exports.Frame = Frame

function read(params, callback) {
    return parseImage(params.filePath, callback);
}

async function parseImage(filePath, callback) {
    if (!filePath) return callback(null);

    try {
        var buffer = fs.readFileSync(filePath);
        var blob = new Blob([buffer]);
        var bitmap = await createImageBitmap(blob);

        var W = Math.min(bitmap.width, 360);
        var ratio = bitmap.width / W;
        var H = Math.round(bitmap.height / ratio);

        var canvas = new OffscreenCanvas(W, H);
        var ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(bitmap, 0, 0, W, H);
        bitmap.close();

        var data = ctx.getImageData(0, 0, W, H).data;
        var result = new Image(H, W);
        result.addFrame(data);
        return callback(null, result);
    }
    catch (err) {
        return callback(null);
    }
}

function Image(height, width) {
    this.height = +height
    this.width = +width
    this.frames = []
}

Image.prototype.addFrame = function(rgba, delay) {
    this.frames.push(new Frame(rgba, delay))
}

function Frame(rgba, delay) {
    if (!(this instanceof Frame)) {
        return new Frame(rgba, delay)
    }
    this.data = rgba
    this.delay = delay
}