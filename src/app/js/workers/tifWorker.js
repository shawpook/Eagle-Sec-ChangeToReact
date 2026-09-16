/**
 * 自有协议契约 —— 类型与字符串常量的唯一事实源：
 *   src/app/react/core/workers/protocol.ts
 *
 * 本文件是**经典 script worker**（`new Worker(url)`，无 type: module），没有模块加载器，
 * 无法 import 上面那个 .ts；两端一致性改由 tests/worker-protocol-contract.mjs 用 AST
 * 逐条比对（双向字面量校验）保证：改动本文件的协议字段 / 通道名 / 错误文案而不改
 * protocol.ts，该测试立刻变红。
 *
 * 注意：下方 importScripts(...) 是第三方引擎装载（libheif / UTIF），必须保留为字面量
 * 经典 importScripts —— tests/dist-entry-check.mjs 靠 AST 识别它才能把引擎文件拉进产物
 * 闭包；改成 ESM import 会让引擎静默掉出闭包（门禁不报错）。
 *
 * @protocol-version 1
 * @protocol-module src/app/react/core/workers/protocol.ts
 */

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