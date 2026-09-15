/**
 * R5：`js/lib/api/crypto.js`（16 行）的 TS 移植 —— `eagle.crypto.generateUUID()`。
 * 语义逐字：优先 `crypto.randomUUID`（非 https 环境不存在时回落手写 v4 模板）。
 */
export class EagleCrypto {
  generateUUID(): string {
    const c: any = (globalThis as any).crypto;
    if (c && c.randomUUID) {
      return c.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
      const randomNumber = (Math.random() * 16) | 0;
      const value = char === 'x' ? randomNumber : (randomNumber & 0x3) | 0x8;
      return value.toString(16);
    });
  }
}
