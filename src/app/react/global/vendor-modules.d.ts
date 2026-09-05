/* b1-9ad：无类型 npm 包的 ambient 模块声明（script 上下文——本文件不得带 import/export）。
   color-convert 锁 v2：bundle 9153 顶层 require 同款 CJS API；v3 改 ESM 且输出取整策略变化，
   勿升。delta-e 0.0.8 导出 `new DeltaE` 实例（getDeltaE76/getDeltaE00）。vite 负责打包，
   运行时无 nodeIntegration 依赖。 */
declare module 'color-convert' {
  const colorConvert: any;
  export default colorConvert;
}
declare module 'delta-e' {
  const DeltaE: {
    getDeltaE76(l1: any, l2: any): number;
    getDeltaE00(l1: any, l2: any): number;
  };
  export default DeltaE;
}
