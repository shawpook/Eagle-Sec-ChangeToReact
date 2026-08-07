/**
 * @class CollectItem
 * @classdesc 被收藏項目的資料模型
 * @property {string} title - 被收藏項目的標題名稱
 * @property {string} src - 被收藏項目的原始圖檔位址或是 base64 編碼之圖片
 * @property {string} url - 被收藏項目的原始網址
 * @property {string} type - 被收藏項目的類型 (image | video)
 * @property {string[]} tags - 被收藏項目的標籤
 * @property {string} annotation - 被收藏項目的註解
 * @property {number} width - 被收藏項目的寬度
 * @property {number} height - 被收藏項目的高度
 * @property {number} [star] - 被收藏項目的收藏評價(星星數)
 */
class CollectItem {
	constructor() {
		this.title = "";
		this.src = "";
		this.url = "";
		this.type = "image";
		this.tags = [];
		this.annotation = "";
		this.width = 2048;
		this.height = 2048;
		this.star = undefined;
	}
}
