var getFolderList = function (dir) {
    var tree = walkTreeSync(dir);
    var counter = { depth: 1, files: 0 };
    treeDepth(tree, "folders", 1, counter);
    console.log(counter);
    return {
        tree: tree,
        depth: counter.depth,
        fileCount: counter.files,
    }
}

function createFolderStruture (newTree, tree) {
    var arr;
    var collator = new Intl.Collator("zh-CN", { numeric: true, sensitivity: 'base' } );
    if (Array.isArray(tree)) {
        arr = tree;
    }
    else {
        arr = tree["folders"];
    }
    if (arr && Array.isArray(arr)) {
        arr.forEach(function (node) {
            var newNode = {
                id: node.id,
                name: path.basename(node.dir),
                children: [],
                modificationTime: Date.now(),
                tags: [],
                isExpand: node.depth <= 1,
            };
            newTree.children.push(newNode);
            createFolderStruture(newNode, node);
        });
        newTree.children = newTree.children.sort(function (a, b) {
            return collator.compare(a.name, b.name);
        });
    }
}

var walkTreeSync = function(dir, tree) {

    var path = path || require('path');
    var fs = fs || require('fs'),
        files = fs.readdirSync(dir);

    var tree = tree || {
        id: guid(),
        dir: dir,
        files: [],
        folders: []
    };

    files.forEach(function(file) {
        var filepath = path.join(dir, file);
        try {
            var ext = getExt({path:filepath});
            if (ext) {
                if (!junk.is(file)) {
                    tree.files.push(filepath);
                }
            }
            else {
                if (IS_DIRECTORY.check(filepath) && !filepath.endsWith(".mindnode") && !filepath.endsWith(".key") && !filepath.endsWith(".pxd")) {
                    var folder = {
                        id: guid(),
                        dir: filepath,
                        files: [],
                        folders: [],
                    };
                    tree.folders.push(folder);
                    walkTreeSync(filepath, folder);
                }
                else {
                    if (!junk.is(file)) {
                        tree.files.push(filepath);
                    }
                }
            }
        }
        catch (err) {
            // 某些資料夾可能無法呼叫 statSync 例如 .asar 結尾的
            // console.error(err);
        }
    });

    return tree;
};

function treeDepth (tree, properity, depth, counter) {
    var depth = (depth)? depth : 1;
    var arr;

    tree.depth = depth;

    if (counter.depth < depth) {
        counter.depth = depth;
    }

    tree[properity].forEach(function (node) {
        if (counter.depth < depth + 1) {
            counter.depth = depth + 1;
            counter.path = node.dir;
        }
        treeDepth(node, properity, depth + 1, counter);
        counter.files += node.files.length;
    });
    return depth;
}

function cloneTree (newTree, tree, extraInfo) {
    var arr;
    if (Array.isArray(tree)) {
        arr = tree;
    }
    else {
        arr = tree["children"];
    }
    if (arr && Array.isArray(arr)) {
        arr.forEach(function (node) {
            var newNode = {
                id: node.id,
                name: node.name,
                description: node.description || "",
                children: [],
                modificationTime: node.modificationTime,
                tags: node.tags || [],
                extendTags: node.extendTags,
                icon: node.icon,
                iconColor: node.iconColor,
                pinyin: node.pinyin,
                password: node.password || "",
                passwordTips: node.passwordTips || "",
                coverId: node.coverId,
            };
            if (node.orderBy) {
                newNode.orderBy = node.orderBy;
                newNode.sortIncrease = node.sortIncrease;
            }
            if (extraInfo) {
                newNode.isExpand = node.isExpand;
            }
            newTree.push(newNode);
            cloneTree(newNode.children, node, extraInfo);
        });
    }
}
