/**
 * D-1 / Track B / B-2：颜色工具（自 `core/dataMachinery.ts` 归位）。
 *
 * - `machineryColorSimilarityDistance`：bundle 32784-32795 逐字（color-convert@2 裸 `.lab`
 *   取整 Lab + delta-e E76/E00）；仅颜色筛选管线消费。
 * - `machineryRgbToHex`：bundle 28976-28981 逐字（首参 `s` 为 bundle scope 形参，函数体
 *   不使用——原样保留签名以免调用面改动）。
 *
 * 本模块为零反向依赖叶子：dataMachinery 与 filterDomain 均从此处 import，不产生环。
 */

import colorConvert from 'color-convert';
import DeltaE from 'delta-e';

export function machineryColorSimilarityDistance(color1: any, color2: any): any {
  var c1: any = colorConvert.rgb.lab(color1[0], color1[1], color1[2]);
  var c2: any = colorConvert.rgb.lab(color2[0], color2[1], color2[2]);
  var l1 = { L: c1[0], A: c1[1], B: c1[2] };
  var l2 = { L: c2[0], A: c2[1], B: c2[2] };
  var d76 = DeltaE.getDeltaE76(l1, l2);
  var d2000 = DeltaE.getDeltaE00(l1, l2);
  return {
    d76: d76,
    d2000: d2000,
  };
}

export function machineryRgbToHex(r: any, g: any, b: any): any {
  if (r === undefined) {
    return false;
  }
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
}
