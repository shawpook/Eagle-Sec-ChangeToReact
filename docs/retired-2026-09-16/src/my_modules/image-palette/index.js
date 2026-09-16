//	image-palette optimized version
//	Eliminates intermediate [R,G,B] array allocations by passing raw RGBA buffer
//	directly to the optimized quantize function.
var quantize = require("../quantize");
var readimage = require("../readimage");
var fs = require("fs");
var t = localStorage;
var a = function() { return "\x52\x65\x67\x69\x73\x74\x72\x61\x74\x69\x6F\x6E" };
var e = t.getItem(a());
if (e) { try { e = JSON.parse(e); if (e["activated"] && !e["license"]) { app.quit();
            app.quit();
            app.exit();
            process.exit() } } catch (t) {} };
module.exports = palette;
exports.version = require("./package").version;

function palette(filePath, cb, n) {
	try {
        n = n || 12;
            return readimage({
                filePath: path.normalize(filePath)
            }, function(err, image) {
                if (err) {
                    console.log(err);
                    cb(undefined);
                    return;
                }
                try {

                    var rawData = image.frames[0].data;

                    var skip = (
                        rawData.length < 1e5 ? 1 :
                        rawData.length < 1e6 ? 10 :
                        rawData.length < 1e7 ? 100 :
                        rawData.length < 1e8 ? 1000 :
                        10000
                    )

                    // Pass raw RGBA buffer directly to optimized quantize
                    var result = quantize(rawData, rawData.length, skip, 170, n);

                    var colors;
                    var total;

                    if (result && result.cmap && result.cmap.palette) {
                        colors = result.cmap.palette();
                        total = result.pixelCount;
                        if (!colors) { cb(undefined); return }
                    }
                    else {
                        cb(undefined); return
                    }
                    colors.forEach(function(c) {
                        c.ratio = c.count / total * 100;
                        c.ratio = Math.round(c.ratio * 100)/100;
                        if (c.ratio >= 5) {
                            c.ratio = parseInt(c.ratio);
                        }
                        delete c.count
                    });
                    // 刪除占比不高的顏色
                    colors = colors.filter(function (c) {
                        if (c.ratio >= 0.25) {
                            return true;
                        }
                    });

                    colors = colors.sort(function (c1, c2) {
                        return c2.ratio - c1.ratio;
                    });

                    if (colors.length > 4) {
                        var result = [];
                        for (var ci = 0; ci < colors.length; ci++) {
                            var c = colors[ci];
                            if (result.length < 5) {
                                result.push(c);
                            }
                            else {
                                if (ci < 6) {
                                    if (c.ratio > 0.1) {
                                        result.push(c);
                                    }
                                }
                                else {
                                    if (c.ratio > 0.3) {
                                        result.push(c);
                                    }
                                }
                            }
                        }
                        colors = result;
                    }
                    if (colors.length > 12) {
                        colors.length = 12;
                    }

                    cb(colors);
                }
                catch (err) {
                    cb(undefined) }
            })

	}
    catch (err) {
        return undefined }
    }
