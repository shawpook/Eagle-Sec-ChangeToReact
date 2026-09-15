/**
 * c2：eagle 单例骨架逐字移植（源 = src/app/js/lib/eagle-api.js——bundle 加载序中先于
 * bundle 执行、var 上 window 的对象）。
 *
 * R6：源脚本标签已从 `src/app/index.html` 摘除，本模块即 eagle 基座的唯一供给方——
 * `installEagleBase()` 在 main.tsx 首个 import（core/eagleBase.ts）完成 `window.eagle`
 * 挂载，时序等价原「脚本先于 React 模块求值」。
 */

class Eagle {
	utils: any;
	urlEnlargerRemote: any;
	/* eagleClasses 安装的成员（c2 骨架未列全，导致消费侧 Property 不存在） */
	inspector: any;
	filter: any;
	duplicateChecker: any;
	reverseImageSearch: any;
	aiSearch: any;
	customExport: any;
	combineImages: any;
	action: any;
	constructor() {
        this.utils = {};
	}
}

export const eagle = new Eagle();

class TreeUtil {
	constructor() {
	}

    walk(tree: any, property: any, callback: any, parentNode: any = null, depth: any = 0) {

        if (tree === undefined) tree = [];

        // 如果 tree 是一個數組，則對其每個元素進行遍歷
        if (Array.isArray(tree)) {
            for (let i = 0; i < tree.length; i++) {
                this.walk(tree[i], property, callback, parentNode, depth);
            }
        }
        // 如果 tree 是一個物件，則調用 callback 並遍歷其子節點
        else {
            callback(tree, parentNode, depth);
            if (tree[property]) {
                this.walk(tree[property], property, callback, tree, depth + 1);
            }
        }
    }
}

eagle.utils.tree = new TreeUtil();
eagle.urlEnlargerRemote = {
    load: () =>{
        const scripts = [
            `https://oss-app.eagle.cool/js/url-enlarger.js?v=${Date.now()}`,
            'https://eagleapp.oss-cn-hongkong.aliyuncs.com/js/url-enlarger.js'
        ];

        function loadScript(index: any) {
            if (index >= scripts.length) return;

            const script = document.createElement('script');
            const src = scripts[index];
            script.src = src;
            script.onload = function() {
                console.log("remote rule loaded.");
            };
            script.onerror = function() {
                // Error occurred loading script. Load next one.
                console.log(`remote rule fail, ${src}`);
                loadScript(index + 1);
            };
            document.head.appendChild(script);
        }

        loadScript(0);
    }
}

/**
 * R6：eagle 基座供给——等价原 `src/app/js/lib/eagle-api.js` 独立 `<script>` 标签的求值效果
 * （`var eagle = new Eagle()` + `eagle.utils.tree = new TreeUtil()`）。
 *
 * 时序契约：必须在**任何消费方之前**调用。已知求值期读点：`core/shim/demoSeed.ts` 的
 * duplicateChecker 保鲜（`if (!window.eagle) return`——脚本摘除后不再早于它则静默失效）、
 * 主窗 React 树与驱动面的 `eagle.utils.tree.walk`、`BatchSavePanel` 的 `eagle.urlEnlarger`。
 * 调用点见 `core/eagleBase.ts`（main.tsx 首个 import，ESM 按源码顺序求值即该时序保证）。
 *
 * 幂等：`window.eagle` 已存在（bundle/多入口场景）时不覆写，只在缺成员时补齐。
 */
export function installEagleBase(): void {
  const w = window as any;
  if (!w.eagle) w.eagle = eagle;
  const e = w.eagle;
  if (!e.utils) e.utils = {};
  if (!e.utils.tree) e.utils.tree = eagle.utils.tree;
  if (!e.urlEnlargerRemote) e.urlEnlargerRemote = eagle.urlEnlargerRemote;
}

