// Import UTIF and UDOC from my_modules
importScripts("../../../my_modules/utif/UTIF.js");
try {
    importScripts("../../../my_modules/utif/UDOC.js");
} catch (e) {
    // UDOC is optional for better CMYK support
}

self.onmessage = async function (e) {
    const { url } = e.data;

    try {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        const ifds = UTIF.decode(arrayBuffer);
        UTIF.decodeImage(arrayBuffer, ifds[0])
        const rgba = UTIF.toRGBA8(ifds[0]); 
        const width = ifds[0].width;
        const height = ifds[0].height;
        postMessage({ rgba, width, height, url });
    } catch (error) {
        // Send an error message back to the main thread
        postMessage({ error: 'Failed to load or process image' });
        console.error(error);
    }
};