/**
 * M3-1（批次 1）：`eagle-zoom-helpers.js` 的具名 ESM 模块化。
 *
 * 来源：`frontend/public/vendor/eagle-zoom-helpers.js` L1-135（**整份都是第一方**，
 * 无第三方成分）。唯一业务消费者是 `services/detailService.ts:144/145/158/159/172/173`。
 *
 * ⚠️ **返回值类型按 vendor 实现照抄，不做「顺手修正」**：
 * `isMobileResolution` 命中时返回的是 `size.h`（数值，`detailService.ts:159` 直接拿它
 * 参与 `100 * ... / current.height` 的除法），未命中才返回 `false`；
 * `isMobileWidth` 命中时返回 `375`，未命中返回 `false`。
 * 若把它们「修正」成 boolean，就是把业务语义改坏。
 *
 * `devicesMetrics` 在主窗只由 vendor 文件异步注入供给（`src/app/index.html` 只加载
 * `main.tsx` 一个 module 脚本，不加载 `src/app/js/devices.js`），故这里作为模块常量
 * 与 vendor 的 `var devicesMetrics` 并存。
 */

export interface DeviceMetric {
  w: number;
  h: number;
}

export const devicesMetrics: DeviceMetric[] = [
// 竖屏
	{ w: 270, h: 480 },
	{ w: 288, h: 480 },
	// { w: 300, h: 480 },
	// { w: 320, h: 480 },
	{ w: 320, h: 504 },
	{ w: 320, h: 550 },
	{ w: 320, h: 568 },
	{ w: 320, h: 569 },
	{ w: 329, h: 584 },
	{ w: 329, h: 585 },
	// { w: 360, h: 640 },
	{ w: 360, h: 720 },
	{ w: 360, h: 740 },
	{ w: 360, h: 753 },
	{ w: 360, h: 755 },
	{ w: 360, h: 780 },
	{ w: 360, h: 1112 },
	{ w: 375, h: 667 },
	{ w: 375, h: 612 },
	{ w: 375, h: 603 },
	{ w: 375, h: 812 },
	{ w: 384, h: 640 },
	{ w: 384, h: 667 },
	{ w: 384, h: 667 },
	{ w: 390, h: 844 },
	{ w: 392, h: 696 },
	{ w: 400, h: 533 },
	{ w: 400, h: 692 },
	{ w: 400, h: 711 },
	{ w: 411, h: 731 },
	{ w: 412, h: 732 },
	{ w: 414, h: 736 },
	{ w: 414, h: 896 },
	{ w: 428, h: 926 },
	{ w: 430, h: 932 },
	{ w: 434, h: 640 },
	{ w: 450, h: 800 },
	{ w: 480, h: 853 },
	{ w: 480, h: 854 },
	{ w: 540, h: 1066 },
	{ w: 680, h: 360 },
	{ w: 720, h: 360 },
	{ w: 768, h: 1024 },
	{ w: 780, h: 360 },
	{ w: 750, h: 1333 },
    { w: 834, h: 1112 },
// 横屏
	{ h: 270, w: 480 },
	{ h: 288, w: 480 },
	// { h: 300, w: 480 },
	// { h: 320, w: 480 },
	{ h: 320, w: 504 },
	{ h: 320, w: 550 },
	{ h: 320, w: 568 },
	{ h: 320, w: 569 },
	{ h: 329, w: 584 },
	{ h: 329, w: 585 },
	// { h: 360, w: 640 },
	{ h: 360, w: 720 },
	{ h: 360, w: 740 },
	{ h: 360, w: 753 },
	{ h: 360, w: 755 },
	{ h: 360, w: 780 },
	{ h: 360, w: 1112 },
	{ h: 375, w: 667 },
	{ h: 375, w: 612 },
	{ h: 375, w: 603 },
	{ h: 375, w: 812 },
	{ h: 384, w: 640 },
	{ h: 384, w: 667 },
	{ h: 384, w: 667 },
	{ h: 390, w: 844 },
	{ h: 392, w: 696 },
	{ h: 400, w: 533 },
	{ h: 400, w: 692 },
	{ h: 400, w: 711 },
	{ h: 411, w: 731 },
	{ h: 412, w: 732 },
	{ h: 414, w: 736 },
	{ h: 414, w: 896 },
	{ h: 428, w: 926 },
	{ h: 434, w: 640 },
	{ h: 450, w: 800 },
	{ h: 480, w: 853 },
	{ h: 480, w: 854 },
	{ h: 540, w: 1066 },
	{ h: 680, w: 360 },
	{ h: 720, w: 360 },
	{ h: 768, w: 1024 },
	{ h: 780, w: 360 },
	{ h: 750, w: 1333 },
    { h: 834, w: 1112 },
];

/** 命中返回该设备的 `h`（**不是布尔**），未命中返回 `false`。 */
export function isMobileResolution(w: number, h: number): number | false {
	if (w === h) return false;
	for (let i = 0; i < devicesMetrics.length; i++) {
		const size = devicesMetrics[i];
		const remainderW = w % size.w;
		const remainderH = h % size.h;
		const multipleW = w / size.w;
		const multipleH = h / size.h;
		if (remainderW == 0 && remainderH == 0 && multipleW === multipleH) {
			if (w / size.w <= 3) {
				return size.h;
			}
		}
	}
	return false;
}

export function getImagePixelDensity(image: { name?: string } | null | undefined): number {
	if (image && image.name) {
		if (image.name.endsWith("@2x")) {
			return 50;
		}
		else if (image.name.endsWith("@3x")) {
			return 33.33;
		}
		else if (image.name.endsWith("@1.5x")) {
			return 66.66;
		}
		else if (image.name.endsWith("@0.5x")) {
			return 200;
		}
	}
	return 100;
}

/** 命中返回 `375`（**不是布尔**），未命中返回 `false`。 */
export function isMobileWidth(w: number): number | false {
	if (w % 375 === 0 && w <= 1125) { return 375; }
	return false;
}
