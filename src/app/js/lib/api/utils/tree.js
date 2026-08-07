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