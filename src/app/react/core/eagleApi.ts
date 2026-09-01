/**
 * c2：eagle 单例骨架逐字移植（源 = src/app/js/lib/eagle-api.js——bundle 加载序中先于
 * bundle 执行、var 上 window 的对象）。React 侧实例暂不覆写 window.eagle（bundle 内部
 * 经全局查找仍用其实例）；各 c 域切片逐步切换消费方，cZ 时由 bindEagle() 覆写挂载。
 */
// @ts-nocheck

class Eagle {
	constructor() {
        this.utils = {};
	}
}

export const eagle = new Eagle();

class TreeUtil {
	constructor() {
	}

    walk(tree, property, callback, parentNode = null, depth = 0) {

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

        function loadScript(index) {
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

