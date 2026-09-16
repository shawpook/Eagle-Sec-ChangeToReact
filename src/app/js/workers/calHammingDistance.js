/**
 * 自有协议契约 —— 类型与字符串常量的唯一事实源：
 *   src/app/react/core/workers/protocol.ts
 *
 * 本文件是**经典 script worker**（`new Worker(url)`，无 type: module），没有模块加载器，
 * 无法 import 上面那个 .ts；两端一致性改由 tests/worker-protocol-contract.mjs 用 AST
 * 逐条比对（双向字面量校验）保证：改动本文件的协议字段 / 通道名 / 错误文案而不改
 * protocol.ts，该测试立刻变红。
 *
 * @protocol-version 1
 * @protocol-module src/app/react/core/workers/protocol.ts
 */

function hammingDistance(string1, string2) {
    var xorResult = BigInt("0b" + string1) ^ BigInt("0b" + string2);
    var binary = xorResult.toString(2);
    var count = 0;
    for (var i = 0; i < binary.length; i++) {
        if (binary[i] === '1') {
            count++;
        }
    }
    return count;
}

self.onmessage = function(event) {
    const {part, all, fingerprintMap, fingerprintWeighted} = event.data;
    const addedItemMap = {};
    let result = [];

    for (let i = 0; i < part.length; i++) {
        const itemA = part[i];

        if (addedItemMap[itemA.id]) continue;

        const ratioA = itemA.width / itemA.height;
        const fingerprintA = fingerprintMap[itemA.id];
        const similarities = [itemA];

        for (let j = i + 1; j < all.length; j++) {
            const itemB = all[j];

            if (addedItemMap[itemB.id]) continue;

            const ratioB = itemB.width / itemB.height;
            const fingerprintB = fingerprintMap[itemB.id];

            if (!fingerprintA || !fingerprintB) continue;
            if (Math.abs(ratioA - ratioB) > 0.1) continue;
            
            const length = fingerprintA.length;
            const diff = hammingDistance(fingerprintA, fingerprintB);
            const similarity = 1 - diff / length;

            if (similarity >= fingerprintWeighted) {
                similarities.push(itemB);
                addedItemMap[itemB.id] = true;
            }
        }

        if (similarities.length > 1) {
            result.push({
                id: similarities[similarities.length - 1].id,
                items: similarities
            });
        }
    }

    self.postMessage(result);
};