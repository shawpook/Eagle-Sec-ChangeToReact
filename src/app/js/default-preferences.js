module.exports = {
    // 常用设置（部分设置采用）
    general: {
        zoom: '100',
        language: "",
        showMenuItem: 'true',
        keepDockIcon: 'true',
        showSidebarBadge: 'true',
        autoSelect: 'true',
        showCollectModal: 'false',
        showCaptureCollectModal: 'false',
        IPTC: 'false',
        enableGPU: 'true',
        enableVibrancy: 'true'
    },
    habits: {
        dblclickSidebarItem: "collapse",  // rename, collapse
        scrollBehavior: "scroll",   // paging, zoom, scroll
        videoScrollBehavior: "progress",    // progress, volume
        hoverZoom: "on",            // on off
        scrollBehaviorTour: false,
        renderBehavior: "non-pixelated",  // pixelated, non-pixelated
        defaultMode: "preview",     // preview, annotation
        rememberLastZoom: "on",
        defaultRatio: "auto",       // auto, 100%
        transparency: "hide",
        keyspace: "preview", // preview, scaroll
        middleBtn: "openNewWindow",
        doubleclick: "internal",
        gifViewer: "off",
        alwaysPlayGIF: "off",
        imageRotateMode: "write"    // preview, write
    },
    shortcuts: {
        keybinds: {
            "global.show.eagle": "",
            "global.show.search": "",
            "global.capture.area": "CmdOrCtrl + Alt + E",
            "global.capture.window": "",
            "global.capture.full": "",
            "file.create.new": "CmdOrCtrl + N",
            "file.create.folder": "CmdOrCtrl + Shift + N",
            "file.create.subfolder": "Alt + N",
            "file.create.smartfolder": "CmdOrCtrl + Shift + Alt + N",
            "file.import.folders": "",
            "file.import.links": "",
            "file.import.eaglepack": "",
            "file.import.pinterest": "",
            "file.import.artstation": "CmdOrCtrl + Shift + Alt + S",
            "file.export.item.eaglepack": "CmdOrCtrl + Shift + E",
            "file.export.item.computer": "CmdOrCtrl + E",
            "file.export.item.as": "Shift + E",
            "file.export.csv": "",
            "library.create": "",
            "library.load": "",

            "edit.rename.win32": "F2",
            "edit.rename.darwin": "CmdOrCtrl + R",
            "edit.copy.path": "CmdOrCtrl + Alt + C",
            "edit.copy.folderpath": "CmdOrCtrl + Alt + Shift + C",
            "edit.copy.eaglelink": "",
            "edit.copy.thumbnail": "",
            "edit.copy.base64": "",
            "edit.copy.name": "",
            "edit.duplicate": "CmdOrCtrl + D",
            "edit.thumbnail.refresh": "CmdOrCtrl + Alt + R",
            "edit.thumbnail.custom.file": "CmdOrCtrl + Alt + T",
            "edit.thumbnail.custom.clipboard": "CmdOrCtrl + Shift + Alt + T",
            "edit.thumbnail.custom.reset": "",
            "edit.image.flip": "Shift + F",
            "edit.image.rotate": "Shift + R",
            "edit.image.crop": "Shift + C",
            "edit.image.merge": "CmdOrCtrl + Shift + M",
            "edit.folder.setting": "CmdOrCtrl + Shift + R",
            "edit.folder.password.create": "",
            "edit.folder.password.change": "",
            "edit.folder.password.reset": "",
            "edit.folder.password.lock": "CmdOrCtrl + Shift + L",
            "edit.folder.move": "",
            "edit.remove.folder.darwin": "CmdOrCtrl + Shift + Backspace",   // macOS 從資料夾移除
            "edit.remove.folder.win32": "Shift + Delete",                 // Windows 從資料夾移除
            "edit.remove.trash.darwin": "CmdOrCtrl + Backspace",         // macOS 移至垃圾桶
            "edit.remove.trash.win32": "Delete",                       // Windows 移至垃圾桶
            "library.switch": "CmdOrCtrl + L",

            "view.alwaysOnTop": "Shift + T",
            "find.search.current": "CmdOrCtrl + F",
            "find.search.all": "CmdOrCtrl + Alt + F",
            "find.sidebar.filter": "Alt + Shift + F",
            "find.filter.toggle": "CmdOrCtrl + Shift + F",
            "find.filter.reset": "CmdOrCtrl + Shift + Alt + F",
            "find.filter.folder": "Alt + F",
            "find.filter.tag": "Alt + T",
            "find.filter.color": "Alt + C",
            "find.filter.shape": "Alt + S",
            "find.filter.rating": "Alt + R",
            "find.filter.date": "Alt + D",
            "find.filter.type": "Alt + E",
            "find.filter.other": "",
            "find.filter.size": "",
            "find.filter.resolution": "",
            "find.filter.duration": "",
            "find.filter.annotation": "",
            "find.filter.note": "",
            "find.filter.url": "",
            "find.filter.semantic": "",
            "find.filter.bpm": "",
            "find.filter.camera": "",
            "find.filter.fonts": "",
            "find.filter.import": "",
            "find.filter.image": "",

            "find.reverse.eagle": "",
            "find.reverse.google": "Shift + G",
            "find.reverse.bing": "",
            "find.reverse.yandex": "",
            "find.reverse.tineye": "",
            "find.reverse.saucenao": "",
            "find.reverse.baidu": "",
            "find.reverse.sogou": "",

            "find.quicksearch": "CmdOrCtrl + J",
            "find.add.to": "CmdOrCtrl + Shift + J",

            "organize.folder.add": "",
            "organize.folder.addLast": "Shift + D",

            // 整理菜單 - 評分
            "organize.rating.5": "",
            "organize.rating.4": "",
            "organize.rating.3": "",
            "organize.rating.2": "",
            "organize.rating.1": "",
            "organize.rating.0": "",
            
            // 整理菜單 - 標籤
            "organize.tag.add": "CmdOrCtrl + T",
            "organize.tag.copy": "CmdOrCtrl+Shift+C",
            "organize.tag.paste": "CmdOrCtrl+Shift+V",
            "organize.tag.clear": "",

            // 檢視菜單 - 頁面切換
            "view.all": "CmdOrCtrl + 1",
            "view.unfiled": "CmdOrCtrl + 2",
            "view.untagged": "CmdOrCtrl + 3",
            "view.recent": "CmdOrCtrl + 4",
            "view.random": "CmdOrCtrl + 5",
            "view.alltags": "CmdOrCtrl + 6",
            "view.trash": "CmdOrCtrl + 7",
            
            // 檢視菜單 - 佈局切換
            "view.layout.grid": "Alt + 1",
            "view.layout.justified": "Alt + 2",
            "view.layout.waterfall": "Alt + 3",
            "view.layout.list": "Alt + 4",
            
            // 檢視菜單 - 縮放 (已存在，保留)
            "view.zoom.in": "CmdOrCtrl + =",
            "view.zoom.out": "CmdOrCtrl + -",
            "view.zoom.actual": "CmdOrCtrl + 0",
            "view.zoom.fit": "CmdOrCtrl + 9",
            
            // 檢視菜單 - 檔案操作
            "view.file.openlink": "CmdOrCtrl + Shift + O",
            "view.file.opendefault": "Shift + Enter",
            "view.file.openfinder": "CmdOrCtrl + Enter",
            "view.file.opennewwindow": "CmdOrCtrl + O",
            "view.file.openother": "",
            "view.reveal.darwin": "CmdOrCtrl + Alt + S",
            "view.reveal.win32": "Alt + CmdOrCtrl + S",
            "view.duplicate.darwin": "CmdOrCtrl + Alt + D",
            "view.duplicate.win32": "Alt + CmdOrCtrl + D",
            
            // 檢視菜單 - 頁面滾動
            "view.scroll.home": "Home",
            "view.scroll.end": "End",
            "view.scroll.prevpage": "PageUp",
            "view.scroll.nextpage": "PageDown",
            
            // 檢視菜單 - 切換顯示
            "view.toggle.sidebar": "CmdOrCtrl + Alt + 1",
            "view.toggle.inspector": "CmdOrCtrl + Alt + 2",
            "view.toggle.all": "CmdOrCtrl + Alt + 3",
            "view.toggle.listname": "CmdOrCtrl + Alt + 4",
            "view.toggle.listmetas": "CmdOrCtrl + Alt + 5",
            "view.toggle.listannotation": "CmdOrCtrl + Alt + 6",
            "view.toggle.subfolder": "CmdOrCtrl + Alt + 7",
            "view.toggle.navigator": "CmdOrCtrl + Alt + 8",
            
            // 檢視菜單 - 其他功能
            "view.grayscale": "CmdOrCtrl + Alt + G",
            "view.toggle.slideshow": "F5",
            
            // 檢視菜單 - 音訊/影片控制
            "player.volume.increase": "CmdOrCtrl + Up",
            "player.volume.decrease": "CmdOrCtrl + Down",
            "player.step.forward": "CmdOrCtrl + Right",
            "player.step.backward": "CmdOrCtrl + Left",
            "player.speed.up": "Shift + .",
            "player.speed.down": "Shift + ,",
            "player.playAndPause": "Space",
            "player.prev1frame": "[",
            "player.next1frame": "]",
            "player.prev10frame": "Shift + [",
            "player.next10frame": "Shift + ]",

            'player.thumbnail.set': "",
            'player.thumbnail.copy': "Shift + C",
            'player.thumbnail.save': "Shift + S",

            "app.preferences": "CmdOrCtrl + ,",
            "app.lock": "CmdOrCtrl + Alt + L"
        }
    },
    theme: {
        name: "DARK",
        color: "#1F2023",
        css: "dark",
    },
    notification: {
        soundEffect: {
            enable: 'true',
            when: {
                deleteImage: 'true',
                deleteFolder: 'true',
                screencapture: 'true',
                extension: 'true'
            }
        },
        notification: {
            enable: 'true',
            when: {
                screencapture: 'true',
                extension: 'true',
                repeatImage: 'true',
                autoImport: 'true',
            }
        }
    },
    sidebar: {
        untagged: 'true',
        unfiled: 'true',
        recent: 'true',
        random: 'true',
        community2: 'true',
        quickAccess: 'true',
        smartFolder: 'true',
        folder: 'true',
    },
    screencapture: {
        autoTagging: {
            enable: 'true'
        },
        autoWriteClipboard: 'false',
        useRetina: 'true',
        shortcutsEnable: 'true',
        format: 'png',
        quality: '90',
    },
    video: {
        hoverPlay: 'true',
        zoomFill: 'false',
        autoPlay: 'true',
        rememberPosition: 'true',
        loopShortVideo: 'true'
    },
    font: {
        autoTag: 'true'
    },
    proxy: {
        enable: 'false',
        ip: '127.0.0.1',
        port: 1087
    },
    privacy: {
        enable: 'false',
        password: '',
        passwordTips: '',
    },
    autoImport: {
        enable: 'false',
        path: ''
    },
	developer: {
		apiToken: ""
	}
}
