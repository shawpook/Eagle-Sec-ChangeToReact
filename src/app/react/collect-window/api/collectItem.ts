/**
 * R5：`js/models/collect-item.js`（26 行全局类）的 TS 移植。
 *
 * 契约逐字：字段默认值与顺序不变（title/src/url/type/tags/annotation/width/height/star），
 * 由 installCollectApi() 安装为 `window.CollectItem`（collect-window/index.html 原内联
 * `<script>window.CollectItem = CollectItem;</script>` 的同位替代）。
 */
export class CollectItem {
  title: string;
  src: string;
  url: string;
  type: string;
  tags: string[];
  annotation: string;
  width: number;
  height: number;
  star: any;

  constructor() {
    this.title = '';
    this.src = '';
    this.url = '';
    this.type = 'image';
    this.tags = [];
    this.annotation = '';
    this.width = 2048;
    this.height = 2048;
    this.star = undefined;
  }
}
