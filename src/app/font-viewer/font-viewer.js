
var app = angular.module("FontViewerApp", ['mgo-mousetrap', 'contenteditable', 'tippy']);
var fs = window.parent.require("fs");
var urlParams = window.location.search.substr(1).split('&').reduce(
	function(accumulator, currentValue) {
		var pair = currentValue
			.split('=')
			.map(function(value) {
				return decodeURIComponent(value);
			});

		accumulator[pair[0]] = pair[1];

		return accumulator;
	},
	{}
);

$("body").on('click', 'a', function(event) {
    event && event.preventDefault();
    if ($(this).attr("target") == "_blank") {
        var link = this.href;
        window.parent.require("electron").shell.openExternal(link);
    }
});

window.focus();

var i18nStrings = {
	'zh_CN': {
		"FontViewer.Tab.Article": "预览",
		"FontViewer.Tab.Waterfall": "大小",
		"FontViewer.Tab.Alphabet": "字形",
		"FontViewer.Tab.Other": "其它",
		"Information.postScriptName": "名称",
		"Information.fullName": "全名",
		"Information.fullName.Button": "设为文件名",
		"Information.fontFamily": "系列",
		"Information.preferredFamily": "样式",
		"Information.version": "版本",
		"Information.designer": "设计师",
		"Information.manufacturer": "制造商",
        "Information.description": "介绍",
		"Information.copyright": "版权",
		"Information.trademark": "商标",
		"Information.numGlyphs": "字数",
		"Font.Activate": "启用字体",
		"Font.Deactivate": "停用字体",
		"DoubleClick.Edit": "双击进行编辑",
		"NotSupport": "很抱歉无法预览这个字体，问题原因：字体大小超过 30MB 或字体格式不完整，可以使用 <a href='https://convertio.co/ttf-otf/' target='_blank'>TTF to OTF Converter</a> 工具修复字体缺失的信息。",
	},
	'zh_TW': {
		"FontViewer.Tab.Article": "預覽",
		"FontViewer.Tab.Waterfall": "大小",
		"FontViewer.Tab.Alphabet": "字形",
		"FontViewer.Tab.Other": "其它",
		"Information.postScriptName": "名稱",
		"Information.fullName": "全名",
		"Information.fullName.Button": "設為檔案名稱",
		"Information.fontFamily": "系列",
		"Information.preferredFamily": "樣式",
		"Information.version": "版本",
		"Information.designer": "設計師",
		"Information.manufacturer": "製造商",
        "Information.description": "介紹",
		"Information.copyright": "版權",
		"Information.trademark": "商標",
		"Information.numGlyphs": "字數",
		"Font.Activate": "啟用字體",
		"Font.Deactivate": "停用字體",
		"DoubleClick.Edit": "雙擊進行編輯",
		"NotSupport": "很抱歉無法預覽這個字體，問題原因：字體大小超過 30MB 或字體格式不完整，可以使用 <a href='https://convertio.co/ttf-otf/' target='_blank'>TTF to OTF Converter</a> 工具修復字體缺少的信息。",
	},
	'ja_JP': {
		"FontViewer.Tab.Article": "プレビュー",
		"FontViewer.Tab.Waterfall": "ウォーターフォール",
		"FontViewer.Tab.Alphabet": "一覧",
		"FontViewer.Tab.Other": "インフォメーション",
		"Information.postScriptName": "Postscript Name",
		"Information.fullName": "Full Name",
		"Information.fullName.Button": "Set as File Name",
		"Information.fontFamily": "Family",
		"Information.preferredFamily": "Style",
		"Information.version": "Version",
		"Information.designer": "Designer",
		"Information.manufacturer": "Manufacturer",
        "Information.description": "Description",
		"Information.copyright": "Copyright",
		"Information.trademark": "Trademark",
		"Information.numGlyphs": "Characters",
		"Font.Activate": "Activate",
		"Font.Deactivate": "Deactivate",
		"DoubleClick.Edit": "Double-click to edit",
		"NotSupport": "このフォントをプレビューできません。理由：フォントサイズが30MBを超えるか、フォントフォーマットが不完全です。 「欠落した情報を修復するには、オンラインツールである「<a href='https://convertio.co/ttf-otf/' target='_blank'>TTF to OTF Converter</a>」を使用することをお勧めします。</a> .",
	},
	'en': {
		"FontViewer.Tab.Article": "Preview",
		"FontViewer.Tab.Waterfall": "Waterfall",
		"FontViewer.Tab.Alphabet": "Glyphs",
		"FontViewer.Tab.Other": "Information",
		"Information.postScriptName": "Postscript Name",
		"Information.fullName": "Full Name",
		"Information.fullName.Button": "Set as File Name",
		"Information.fontFamily": "Family",
		"Information.preferredFamily": "Style",
		"Information.version": "Version",
		"Information.designer": "Designer",
		"Information.manufacturer": "Manufacturer",
        "Information.description": "Description",
		"Information.copyright": "Copyright",
		"Information.trademark": "Trademark",
		"Information.numGlyphs": "Characters",
		"Font.Activate": "Activate",
		"Font.Deactivate": "Deactivate",
		"DoubleClick.Edit": "Double-click to edit",
		"NotSupport": "Cannot preview this font. Reason: Font size exceeds 30MB or font format is incomplete. To repair its missing information, we recommend using the online tool:  <a href='https://convertio.co/ttf-otf/' target='_blank'>TTF to OTF Converter</a> .",
	}
}

app.config(function($sceProvider, $httpProvider) {
    $sceProvider.enabled(false);
});

app.filter('i18n', function($window) {
    return function(key, pairs) {
    	var $parentScope = window.parent.$bodyScope;
    	var lng = $parentScope.preferences.general.language;
    	if (i18nStrings[lng]) {
        	return i18nStrings[lng][key];
        }
        else {
        	return i18nStrings["en"][key];
        }
    };
});

app.directive('mediumEditor', function () {
    return {
        restrict: 'A',
        link: function (scope, element, attrs) {
            var editor = new MediumEditor(element[0], {
            	placeholder: {
            		text: '',
        			hideOnClick: true
            	},
            	toolbar: {
            		// buttons: ['h2', 'h3', 'bold', 'italic', 'underline', 'anchor', 'quote'],
            		buttons: ['h2', 'h3', 'bold', 'italic', 'underline', 'quote'],
            	},
            	anchor: {
			        customClassOption: null,
			        customClassOptionText: 'Button',
			        linkValidation: false,
			        placeholderText: 'Paste or type a link',
			        targetCheckbox: false,
			        targetCheckboxText: 'Open in new window'
			    },
			    paste: {
			        cleanPastedHTML: true,
			        cleanAttrs: ['style', 'dir'],
			        cleanTags: ['label', 'meta'],
			        cleanReplacements: ['img'],
			        unwrapTags: ['sub', 'sup']
			    },
			    autoLink: true,
			    // extensions: {
			    //     'imageDragging': {}
			    // }
            });
            editor.subscribe("editableKeydown", function (event) {
            	var keyCode = event.keyCode;
            	console.log(event)
			    if (keyCode == 65 && (event.ctrlKey || event.metaKey)) {
			        editor.selectAllContents();
			    }
            });
        }
    }
});

app.directive('editableSelectall', function() {
    return function(scope, element, attrs) {
        var mousetrap = new Mousetrap(element[0]);
        mousetrap.bind('mod+a', function(event) {
            event && event.stopPropagation();
            window.setTimeout(function() {
                var sel, range;
                if (window.getSelection && document.createRange) {
                    range = document.createRange();
                    range.selectNodeContents(element[0]);
                    sel = window.getSelection();
                    sel.removeAllRanges();
                    sel.addRange(range);
                } else if (document.body.createTextRange) {
                    range = document.body.createTextRange();
                    range.moveToElementText(element[0]);
                    range.select();
                }
            }, 1);
        });
        mousetrap.bind('esc', function(event) {
            event && event.stopPropagation();
            element.blur();
        });
    }
});

app.filter('themePath', function () {
    return function (theme) {
        if (theme === 'light' || theme === 'lightgray') {
            return 'light';
        }
        else {
            return 'dark';
        }
    };
});

app.controller("FontViewerController", function ($scope, $timeout) {

	const $parentScope = window.parent.$bodyScope;
	const  $window = jQuery(window);

	$scope.getTheme = () => {
		return urlParams.theme || "gray";
	}

	$scope.lng = $parentScope.preferences.general.language;
	$scope.platform = window.parent.process.platform;
    $scope.theme = $scope.getTheme();
	$scope.currentTheme = localStorage.getItem("eagle.fontViewer.theme") || "auto";
	$scope.currentTab = localStorage.getItem("eagle.fontViewer.tab") || "article";
	
	$scope.setAsFileName = function (fullName) {
		if (!fullName) return;
		$scope.fontName = fullName; 
		$scope.newFontName = fullName;
		$parentScope.inspector.newName = fullName;
		$parentScope.imagesChange();
		$parentScope.$evalAsync();
	};

	$scope.preventEnter = function(event) {
	    if (event.keyCode === 13 || event.keyCode === 27) {
	        event.preventDefault();
	        $(event.target).trigger("blur");
	    }
	};

	$scope.changeFontName = function () {
		$timeout(function () {
			var newName = $scope.newFontName;
			if ($scope.newFontName === $scope.fontName) return;
			if (newName !== "") {
				$scope.fontName = $scope.newFontName;
				$parentScope.inspector.newName = newName;
				$parentScope.imagesChange();
				$parentScope.$evalAsync();
			}
			else {
				$scope.newFontName = $scope.fontName;
			}
		}, 200);
	};

	$scope.removeStar = function () {
		$parentScope.removeStar();
		$parentScope.$eavlAsync();
	};
	$scope.changeTo1Star = function () {
		$parentScope.changeTo1Star();
		$parentScope.$eavlAsync();
	};
	$scope.changeTo2Star = function () {
		$parentScope.changeTo2Star();
		$parentScope.$eavlAsync();
	};
	$scope.changeTo3Star = function () {
		$parentScope.changeTo3Star();
		$parentScope.$eavlAsync();
	};
	$scope.changeTo4Star = function () {
		$parentScope.changeTo4Star();
		$parentScope.$eavlAsync();
	};
	$scope.changeTo5Star = function () {
		$parentScope.changeTo5Star();
		$parentScope.$eavlAsync();
	};
	$scope.leftHandler = function () {
		$parentScope.selectPrev();
		$parentScope.$evalAsync();
	};
	$scope.rightHandler = function () {
		$parentScope.selectNext();
		$parentScope.$evalAsync();
	};
	$scope.escHandler = function (event) {
		event && event.preventDefault();
		$parentScope.escHandler();
		$parentScope.$evalAsync();
	};

	$scope.chnageTheme = function (theme) {
		$scope.currentTheme = theme;
		localStorage.setItem("eagle.fontViewer.theme", theme);
	};

	$scope.chnageTab = function (tab) {
		$scope.currentTab = tab;
		localStorage.setItem("eagle.fontViewer.tab", tab);
	};

	$window.on("scroll", _.debounce(function () {
		localStorage.setItem("eagle.fontViewer.scrollTop", $window.scrollTop());
	}, 500, true));

	// 全选功能
	$("body").on('keydown', 'input, textarea', function(event) {
	    var keyCode = event.keyCode;
	    if (keyCode == 65 && (event.ctrlKey || event.metaKey)) {
	        $(this).select();
	    }
	});

	$("body").on('keydown', '[contenteditable]', function(event) {
		var keyCode = event.keyCode;
		var element = $(this);
	    if (keyCode == 65 && (event.ctrlKey || event.metaKey)) {
			event && event.stopPropagation();
			window.setTimeout(function() {
				var sel, range;
				if (window.getSelection && document.createRange) {
					range = document.createRange();
					range.selectNodeContents(element[0]);
					sel = window.getSelection();
					sel.removeAllRanges();
					sel.addRange(range);
				} else if (document.body.createTextRange) {
					range = document.body.createTextRange();
					range.moveToElementText(element[0]);
					range.select();
				}
			}, 1);
		}
	});

	$("body").on("keyup", ".waterfall [contenteditable]", function () {
		var val = $(this).text();
		$(".waterfall [contenteditable]").not(this).text(val);
	});

	$('#preview-size').on('input', function () {
		$(this).trigger('change');
		var size = parseFloat($('#preview-size').val());
		$("html").css("font-size", `${size}%`);
		console.log($('#preview-size').val())
		$(this).blur();
		$(".waterfall").scrollLeft(0);
	});

	$scope.preventDefault = function (event) {
		event.preventDefault();
		event.stopPropagation();
	};

	$("body").on("mousewheel.zoomming", function (e) {
	    if (e.altKey || e.ctrlKey || e.metaKey) {
	        e.preventDefault();
	        e.stopPropagation();
	    }
	});


	$("body").on("mousewheel.zoomming", throttle(function(e) {
	    if (e.altKey || e.ctrlKey || e.metaKey) {
	        e.preventDefault();
	        e.stopPropagation();
	        if (e.originalEvent.wheelDelta > 5) { //alternative options for wheelData: wheelDeltaX & wheelDeltaY
	            $scope.zoomIn();
	            $scope.$evalAsync();
	        } else if (e.originalEvent.wheelDelta < -5) {
	            $scope.zoomOut();
	            $scope.$evalAsync();
	        }
	        return false;
	    }
	}, 200, true));

	$scope.zoomIn = function (event) {
		event && event.preventDefault();
		var size = parseFloat($('#preview-size').val());
		size += 62.5 / 2;
		size = Math.min(625, size);
		$('#preview-size').val(size);
		$('#preview-size').trigger("input");
	};

	$scope.zoomOut = function (event) {
		event && event.preventDefault();
		var size = parseFloat($('#preview-size').val());
		size -= 62.5 / 2;
		size = Math.max(31.25, size);
		$('#preview-size').val(size);
		$('#preview-size').trigger("input");
	};

	$scope.zoomFit = function (event) {
		event && event.preventDefault();
		$('#preview-size').val(62.5);
		$('#preview-size').trigger("input");
	};

	var id = urlParams.id;
	var lang = "en";
	var fontMetas = $parentScope.current.fontMetas;
	var fontPath = $parentScope.imagesDir + $parentScope.current.id + ".info/" + $parentScope.current.name + "." + $parentScope.current.ext;

	fontPath = decodeURIComponent(fontPath);
	// var key = 'en';
	// if (lang === 'zh_TW') {
	// 	key = 'zh-TW';
	// }
	// else if (lang === 'zh_CN') {
	// 	key = 'zh';
	// }
	
	var preferLng = 'en';
	switch ($scope.lng) {
		case 'zh_TW':
		case 'zh_CN':
			preferLng = "zh";
			break;
		default: 
			preferLng = "en";
	}

	$scope.info = {
		version: _.get(fontMetas, `version.${preferLng}`, undefined) || _.get(fontMetas, `version.en`, ""),
		postScriptName: _.get(fontMetas, `postScriptName.${preferLng}`, undefined) || _.get(fontMetas, `postScriptName.en`, ""),
		fullName: _.get(fontMetas, `fullName.${preferLng}`, undefined) || _.get(fontMetas, `fullName.en`, ""),
		fontFamily: _.get(fontMetas, `fontFamily.${preferLng}`, undefined) || _.get(fontMetas, `fontFamily.en`, ""),
		fontSubfamily: _.get(fontMetas, `fontSubfamily.${preferLng}`, undefined) || _.get(fontMetas, `fontSubfamily.en`, ""),
		preferredFamily: _.get(fontMetas, `preferredSubfamily.en`, "Regular"),
		preferredSubfamily: _.get(fontMetas, `preferredSubfamily.en`, "Regular"),
		designer: _.get(fontMetas, `designer.${preferLng}`, undefined) || _.get(fontMetas, `designer.en`, ""),
		designerURL: _.get(fontMetas, `designerURL.${preferLng}`, undefined) || _.get(fontMetas, `designerURL.en`, ""),
		trademark: _.get(fontMetas, `trademark.${preferLng}`, undefined) || _.get(fontMetas, `trademark.en`, ""),
        description: _.get(fontMetas, `description.${preferLng}`, undefined) || _.get(fontMetas, `description.en`, ""),
		manufacturer: _.get(fontMetas, `manufacturer.${preferLng}`, undefined) || _.get(fontMetas, `manufacturer.en`, ""),
		manufacturerURL: _.get(fontMetas, `manufacturerURL.${preferLng}`, undefined) || _.get(fontMetas, `manufacturerURL.en`, ""),
		copyright: _.get(fontMetas, `copyright.${preferLng}`, undefined) || _.get(fontMetas, `copyright.en`, ""),
		license: _.get(fontMetas, `license.${preferLng}`, undefined) || _.get(fontMetas, `license.en`, ""),
		licenseURL: _.get(fontMetas, `licenseURL.${preferLng}`, undefined) || _.get(fontMetas, `licenseURL.en`, ""),
		numGlyphs: _.get(fontMetas, `numGlyphs`, undefined),
		weight: _.get(fontMetas, `weight`, undefined),
	}
    $scope.fontName = $parentScope.current.name;
    $scope.newFontName = $scope.fontName;
    $scope.fontFamily = (fontMetas.fontFamily && fontMetas.fontFamily.en) || $parentScope.current.name;

    console.log($parentScope.current);
    console.log(fontPath);

    if (fs.existsSync(fontPath)) {
    	window.parent.require("fs").readFile(fontPath, function (err, fontBinary) {
    		if (!FontFace) return;
    		let fontName = $scope.fontFamily.replace(/[({.})]/ig,"").replace(/\s/g, "").replace(/[@#$%^&*()<>:`'"\/\\|?*]/g, "").replace(/^\d+/, '');
    		var font = new FontFace(fontName, fontBinary, {
			 	style: 'normal', 
			});
			font.load();
			font.loaded.then(function() {
				document.fonts.add(font);
				$scope.fontCSSName = fontName;
				document.body.style.fontFamily = `'${fontName}'` + `, "Fallback Outline"`;
				document.body.style.display = "block";
				$scope.isSupport = true;

				var translation = {
					'jp': {
						article: `
							<h2>蓮池の月色</h2>
							<p>ここ何日か、はなはだ心が落ち着かない。今宵、庭に坐って涼をとっていると、突然、毎日通り過ぎている蓮池が、満月の光の中では、きっとまた別の趣があるはずではなかろうかと思い起こされた。月はだんだんと高くなり、壁の外の道路での子供たちの笑いさざめきはすでに聞こえない。妻は家の中でうつらうつらしながら子供に子守唄を口ずさんでいる。わたしはこっそりと上着をはおり、かるく戸を閉めて外へ出た。</p>
							<p>蓮池に沿って、曲がりくねった、ひっそりとほの暗い石炭屑を敷き詰めた路がある。昼間でも歩く人は少なく、夜になるとなおさら寂しい。蓮池の周りには多くの樹が植えてあって青々と茂っている。路の片側には、たくさんの柳と、名前の知らない樹がある。月の光が無い夜はこの路には樹がこんもりと茂り、いささか気味が悪い。月光は淡く、今宵はむしろそれがとてもよい。</p>
							<blockquote><i>わたしは只一人、手を背に回して路をそぞろ歩く。この見渡す限りの天地はまるでわたしだけのもののようで、わたしも又、普段の自分から抜け出て別の世界に入り込んだようだ。わたしは賑やかなのが好きだし、又静かなのも好む。皆と居るのも、一人だけなのもよい。今宵のように蒼茫とした月の下、何を思ってもよし、思わなくてもよし、まことに自由なことだ。日中はやらねばならないことや、話さなくてはならないことがあるが、今はすべて気にしなくてもよい。</i></blockquote>
							<p>曲がりくねった蓮池の上面には、見渡す限り葉が繋がっている。葉は水から高く出ていて、まるでしなやかに舞う女の裳裾のようだ。数え切れない葉の間にぱらぱらと飾り付けられた白い花花はたおやかに開き、恥ずかしげに大きく咲いていて、まことに一粒の真珠のようであり、又、碧い空の星星のようだし、湯浴みから出たばかりの美女のようでもある。微かに風が通ると、かぐわしい香りが絶え間なく漂ってきて、遠くの高い建物からのぼんやりとした歌声を思わせる。この時、葉も花もかすかに震え、稲妻のように、瞬く間に蓮池にさざめいていく。葉は元々ぎっしりとつまっていて、ちょうど碧い波のうねりのようだ。葉の下にはそっと水が流れていて、葉に遮られてその色は見えないが、かえって葉は更に味わい深く見える。</p>
							<p><u>月の光は流水のように静かに、さあっと葉と花に注がれている。蓮池に薄い霧がかかり、葉と花はまるで牛乳の中で洗われたようだし、又、細い紗の夢に覆われているようだ。満月ではあるが空には一筋の薄い雲がかかっているので明るく照ってはいない。しかしわたしには、心ゆくまでぐっすりとまではいかなくても、ひとときのまどろみを味わうにはぴったりした処だと思われた。月光は樹に遮られて照り、高い所に群生している灌木の斑な黒い影が落ちて、それはすっくと立っている鬼のようであり、しなった柳のうるわしい影は絵に描かれた蓮の葉のようだ。池の中の月光は決して均等ではない。しかしその光と影はまるでバイオリンの奏でる名曲のように調和の取れた旋律がある。</u></p>
							<p>池の周りには、遠くから近くまで、高いところから低いところまで樹があり柳が最も多い。これらの樹は蓮池を幾重にも囲み、小路の脇にはわざわざ月の光を留めるように抜け落ちたような隙間がある。樹の色は一律にほの暗く、ぱっと見ると霧の塊がかかっているようだ。</p>
							<p>しかし柳の姿は霧の中でもはっきりと見分けられる。梢の上には微かに遠くの山々が見え隠れているようだ。樹の裂け目からは、わずかに街灯が漏れ、今にも眠ってしまう眼のようにぼんやりとしている。この時一番賑やかなのは樹の上の蝉と水の中の蛙の楽しんでいるかれらの声だが、わたしには何も気にならない。</p>
							<p>突然、「採蓮」を思い出した。「採蓮」は江南地方の古い習慣でかなり昔からあり、六朝時代に盛んだったことは詞歌の中からおよそ知ることが出来る。蓮の実を採るのは若い女性で、彼女達はゆれる小船に乗って、ただ恋歌を歌う。それは楽しく、風流な季節である。梁元帝の《采蓮賦》の中に詠われているのがとても好い。</p>
							<p>そこには うるわしい若者と、美しい乙女が<br>ゆれる小舟に乗って、黙って互いに見つめ合う<br>舟はゆらゆらと揺れ動き、二人は盃を交わし<br>櫂に藻が絡み、舟は浮き草から離れ動き出す</p>
							<p>乙女はほっそりとしなやかな腰に薄い淡色の絹を巻き、ゆっくりと振り向いた</p>
							<p>春が終わり夏の始まり、葉は青々として花は開く<br>裳裾が濡らされ、笑われるのではないかと船べりによって裾をからげる</p>
							<p>これによって当時の楽しく戯れている光景がよく解る。これはまことに趣の有ることだが、最早惜しいことに、現在はこのような楽しみを享受出来なくなってしまった。</p>
							<p>そこで又、《西洲曲》の句を思い出した。</p>
							<p>秋に南にある池で蓮の実を採る、蓮の花は人よりも高く<br>腰をかがめて蓮の実をたのしんで採る、蓮の実は青く水のごとく</p>
							<p>今宵もし蓮の実を採る人がいたら、ここの蓮の花も又“人より高い”はずだ。ただ流れる水が見られないのは何故だろう。しきりに江南が思い出された。——こんなことを思っていてふと顔を上げると、知らないうちに家の門の前だった。そっと門を押して入ると、何ひとつ物音はなく、妻はもう夢の境に入っていた。</p>
						`,
						waterfall: `
							<div contenteditable="true" class="size72">永和九年 ABCDEFGH 0123456789</div>
							<div contenteditable="true" class="size64">永和九年 ABCDEFGH 0123456789</div>
							<div contenteditable="true" class="size56">永和九年 ABCDEFGH 0123456789</div>
							<div contenteditable="true" class="size48">永和九年 ABCDEFGH 0123456789</div>
							<div contenteditable="true" class="size38">永和九年 ABCDEFGH 0123456789</div>
							<div contenteditable="true" class="size30">永和九年 ABCDEFGH 0123456789</div>
							<div contenteditable="true" class="size24">永和九年 ABCDEFGH 0123456789</div>
							<div contenteditable="true" class="size20">永和九年 ABCDEFGH 0123456789</div>
							<div contenteditable="true" class="size16">永和九年 ABCDEFGH 0123456789</div>
							<div contenteditable="true" class="size14">永和九年 ABCDEFGH 0123456789</div>
							<div contenteditable="true" class="size12">永和九年 ABCDEFGH 0123456789</div>
						`,
						alphabet: getAlphabetHTML(`
							<div>
								<div class="group">
									<div class="group-name">ラテン</div>
									<div class="group-items">ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz</div>
								</div>
								<div class="group">
									<div class="group-name">番号</div>
									<div class="group-items">1234567890</div>
								</div>
								<div class="group">
									<div class="group-name">ひらがな</div>
									<div class="group-items">のいにしるすてまでをはなたりとおらがさかこきもせんれっあだめわつちうみけよごやそへどえじろべばずゃねびむょげほぐぶざぎひゆふづぞぱぜぼぽぁぴぷぬゅぇぃぺぉぅ゜ゞぢゝ゛ゐゎゑゔゕゟゖく</div>
								</div>
								<div class="group">
									<div class="group-name">カタカナ</div>
									<div class="group-items">ントイスッルリクラアプジタシロフグドメマレサコカテバムブキニィチュビャポペデオウセパナエミョツダズェホネワガベピケモゴハボォァザソヘゲヤギユヒゼヨヴヶゾヌゥﾝﾌｽﾄｲｯｸﾀｼﾊﾘﾙｷﾉｱﾗｶﾛｺﾃﾁヲﾚﾎｻﾏヵﾋｳｬﾒﾆﾍｵｴヽヂﾑﾜｭｨﾅｾｮｹﾐｪｧﾓﾂヾヅｿﾈﾔｫﾖヱﾕｩﾇヮヰｦㇼㇾㇺㇽㇷㇲㇵㇻㇳㇱㇿヺㇰㇶㇸヷヿㇹヸヹㇴノ</div>
								</div>
								<div class="group">
									<div class="group-name">漢字</div>
									<div class="group-items">一二三四五六七八九十百千萬今力国愛書東永袋酬鬱鷹上中下左右大小春夏秋冬東南西北金木水火土天地日月星黑白紅橙黃綠藍靛紫食住衣行育樂忠孝仁愛信義和平子曰父母兄弟夫婦君臣馬牛羊雞犬豕喜怒哀懼惡目耳口手足見聞聲貝車雨赤青言語魚鳥羽電不乃之乎人以何具倫儀先光入具初則匏協去友同名善器嚴執孟孫學宜容專少山師席常幼序從性恩恭情惰應成所才揚擇教敬數文斷方於族昔時智曾有朋本杼某梨機次欲此歲溫為燕玄玉琢畜當相知石祖禮稷稻穀窮竇竹粱紊絲綱習老者而能自至與苟菽處融親調識讓貴身近運過道遠遷鄰長非革音順飼養首香高麥黍齡思源谷歌年早林川空田生花草蟲女男力円出立休夕字學校村町森正王糸多萬半形太細広點丸交角計直線矢弱強姉妹體毛頭心曜朝夜分周今新古間前後外場國園野原里市京風雪雲池海岩室家寺通門話答聲書記紙畫工晴考理算作元肉鳴麥米茶色黃走止活店買売午汽弓回會組船明社切合台公引科刀番用</div>
								</div>
								<div class="group">
									<div class="group-name">シンボル</div>
									<div class="group-items">、。〃「」『』〝〞︰﹐﹒﹔﹔﹕！＃＄％＆＊，．：；？＠～•…“‘·′”’</div>
								</div>
							</div>
						`),
					},
					'kr': {
						article: `
							<h2>하당월색 </h2>
							<p>요 며칠은 내 마음이 퍽 심란 하였다. 오늘 밤 정원에 앉아서 바람을 쐬다가 불현듯 날마다 거닐었던 연못이 생각났다. 휘영청 달 밝은 밤에는 뭔가 색다른 느낌이 있을 것이다. 달은 점점 높이 떠오르고 담장 밖 한길가의 떠들썩한 아이들 웃음소리도 더 이상 들리지 않는다. 아내는 방 안에서 윤아 의 등을 다독거리며 잠 재우고 있다. 졸음이 가득한 목소리로 자장가를 웅얼거린다. 나는 살그머니 겉옷을 걸치고 문 밖을 나섰다.</p>
							<p>연못을 따라 구불구불 굽이진 조그마한 길이 나 있다. 호젓하고 깊숙한 이 길은 낮에도 인적이 드물고 밤에는 더욱 적막함이 흐른다. 연못 사방으로 수많은 나무들이 울창하게 우거져 있다. 길 한쪽으로 대부분 버드나무들이고, 그밖에 이름을 알 수 없는 나무들이 늘어서 있다. 달빛이 없는 밤이면 무서운 느낌이 들 만큼 음침하고 으슥하다. 하지만 오늘 밤은 다르다. 희미해져 가는 달빛아래 무척 분위기가 있다.</p>
							<blockquote><i>지금 길에는 나 한 사람뿐이다. 혼자 뒷짐을 지고서 한가로이 걷고 있다. 이 세상이 온통 내 것처럼 느껴진다. 일상의 나를 벗어나 또 다른 세계로 들어선 것 같다. 나는 떠들썩한 열기를 좋아하고, 또한 차분한 고요를 좋아한다. 그리고 군중들과 함께 하는 것도 사랑하지만 혼자 있는 것을 더욱 사랑한다. 오늘 같은 밤, 이 창망 한 하늘아래 나는 뭐든지 다 생각할 수 있고 아무것도 생각하지 않을 수도 있다. 그야말로 나 자신이 무한한 자유인임을 느낀다. 낮에 반드시 해야 할 일과 해야 할 말을 지금 이 순간에는 모두 접어두었다. 혼자 있는 기쁨의 묘미를 저 끝없는 연꽃 향기와 어슴푸레한 달빛과 더불어 누린다.</i></blockquote>
							<p>구불구불 굽이진 연못 위로 연잎들이 파랗게 수면 가득 덮여 있다. 물에서 우뚝하게 높이 솟은 연잎은 꼿꼿이 세운 무희의 치마같다. 겹겹이 포개진 연잎 사이로 간간이 하얀 꽃송이가 맺혀 있다. 더러 가냘프게 피어있거나 부끄러운 듯한. 꽃망울은 마치 알알이 나뒹기는 진주같고,파아란 하늘의 반짝이는 별 같기도 하고, 또 방금 목욕하고 나온 뽀얀 미인 같기도 하다. 산들바람이 스치고 지나가자 맑은 향기가 마치 저 멀리 높은 누각에서 들려오는 아득한 노랫소리처럼 전해오는 듯 싶다. 이때 연잎과 연꽃 사이에 미세한 떨림이 번개처럼 일더니 금세 연못 저쪽으로 물결쳐 간다. 원래 어깨를 나란히 하듯 촘촘히 붙어있던 연잎에 짙푸른 물결의 무늬가 완연했다. 연잎 아래로 소리없이 흐르는 물은 수많은 잎사귀에 가려 어떤 빛깔인지 알 수 없지만 연잎은 도리어 더욱 돋보이고 운치가 있는 것이다.</p>
							<p><u>달빛은 흐르는 물처럼 고요히 연잎과 연꽃에 쏟아지고 있다. 희미하게 옅은 안개가 연못에 피어오른다. 연잎과 연꽃은 우유로 씻은 듯하고 또한 얇은 망사에 가려진 꿈만 같다. 오늘 밤은 비록 만월 이지만 하늘에 잿빛의 층을 이룬 구름이 떠 있어 환히 비추지는 못한다. 하지만 나는 지금 이대로가 좋다. ㅡㅡㅡ 단잠을 자는 것도 물론 필요하지만 잠깐 눈을 붙이는 것도 나름대로 독특한 맛을 지니고 있다고나 할까. 달빛이 나무 사이로 비쳐 들어온다. 높은 곳에 무성하게 자란 관목 위로 어슴푸레 얼룩거리는 검은 그림자는 차가운 기운이 돌만큼 으슥한 것이 흡사 귀신이 걸려있는 듯 싶다. 그리고 넓게 펼쳐진 연잎위로 버드나무의 그림자가 띄엄띄엄 가늘게 늘어져 있는 것이 한 폭의 그림을 그려놓은 것 같다. 오늘 밤 연못가에 달빛이 환히 고르게 내비치지는 않았지만 그런대로 달빛에 잠긴 연못가의 빛과 그림자가 잘 어우러졌다. 그 조화를 이루는 선율은 마치 바이올린 선상에서 흘러나오는 명곡 같다.</u></p>
							<p>연못의 주변 가득 나무로 뒤덮여 있다. 멀리 혹은 가까이 높고 낮은 나무들로 둘러싸여 있는데 그중 버드나무가 가장 많다. 버드나무가 이 연못을 겹겹이 에워싸고 있는 것이다. 다만 오솔길 한쪽으로 몇 군데 빈 자리가 나 있다. 그 공간은 특별히 달빛을 위해 남겨둔 것인지도 모른다. 나무 빛은 한결같이 어두침침하다. 언뜻 보면 희뿌연 연기가 한데 엉긴 안개처럼 보인다. 그러나 유독 버드나무만이 안개 속에 자태를 빛내고 있다. 나뭇가지에 먼 산이 어슴프레하게 걸려있는 듯 한데 윤곽만이 그려질 뿐이다. 그나마 나무 틈새로 새어나오는 한 두개 가로등 불빛도 졸음이 가득한 눈처럼 또렷하지 못하다. 지금 이 순간 가장 활기찬 것은 나무숲의 매미 소리와 연못속의 개구리 소리뿐이다. 활기를 띤 자연의 생물과는 달리 나는 한가로이 아무것도 없다.</p>
						`,
						waterfall: `
							<div contenteditable="true" class="size72">파도가푸르 ABCDEFGH 0123456789</div>
							<div contenteditable="true" class="size64">파도가푸르 ABCDEFGH 0123456789</div>
							<div contenteditable="true" class="size56">파도가푸르 ABCDEFGH 0123456789</div>
							<div contenteditable="true" class="size48">파도가푸르 ABCDEFGH 0123456789</div>
							<div contenteditable="true" class="size38">파도가푸르 ABCDEFGH 0123456789</div>
							<div contenteditable="true" class="size30">파도가푸르 ABCDEFGH 0123456789</div>
							<div contenteditable="true" class="size24">파도가푸르 ABCDEFGH 0123456789</div>
							<div contenteditable="true" class="size20">파도가푸르 ABCDEFGH 0123456789</div>
							<div contenteditable="true" class="size16">파도가푸르 ABCDEFGH 0123456789</div>
							<div contenteditable="true" class="size14">파도가푸르 ABCDEFGH 0123456789</div>
							<div contenteditable="true" class="size12">파도가푸르 ABCDEFGH 0123456789</div>
						`,
						alphabet: getAlphabetHTML(`
							<div>
								<div class="group">
									<div class="group-name">Latin</div>
									<div class="group-items">ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz</div>
								</div>
								<div class="group">
									<div class="group-name">Hangul Syllables</div>
									<div class="group-items">가개갸거게겨고괴괘교구귀궤규그긔기나내냐너네녀노뇌놰뇨누뉘눼뉴느늬니다대댜더데뎌도되돼됴두뒤뒈류드듸디라래랴러레려로뢰뢔료루뤼뤠류르릐리마매먀머메며모뫼뫠묘무뮈뭬뮤므믜미바배뱌버베벼보뵈봬뵤부뷔붸뷰브븨비사새샤서세셔소쇠쇄쇼수쉬쉐슈브븨비아애야어에여오외왜요우위웨유으의이자재쟈저제져조죄좨죠주쥐줴쥬즈즤지차채챠처체쳐초최쵀쵸추취췌츄츠츼치카캐캬커케켜코쾨쾌쿄쿠퀴퀘큐크킈키타태탸터테텨토퇴퇘툐투튀퉤튜트틔티파패퍄퍼페펴포푀퐤표푸퓌풰퓨프픠피하해햐허헤혀호회홰효후휘훼휴흐희히</div>
								</div>
								<div class="group">
									<div class="group-name">Number</div>
									<div class="group-items">1234567890</div>
								</div>
								<div class="group">
									<div class="group-name">Symbol</div>
									<div class="group-items">‘?’“!”(%)[#]{@}/&\<-+÷×=>®©$€£¥¢:;,.*</div>
								</div>
							</div>
						`),
					},
					'zh_TW': {
						article: `
							<h2>荷塘月色</h2>
							<p>這幾天心裡頗不寧靜。今晚在院子里坐著乘涼，忽然想起日日走過的荷塘，在這滿月的光里，總該另有一番樣子吧。月亮漸漸地升高了，牆外馬路上孩子們的歡笑，已經聽不見了；妻在屋裡拍著閏兒，迷迷糊糊地哼著眠歌。我悄悄地披了大衫，帶上門出去。</p>
							<p>沿著荷塘是一條曲折的小煤屑路。這是一條幽僻的路；白天也少人走，夜晚更加寂寞。荷塘四面，長著許多樹，翁翁鬱鬱的。路的一旁，是些楊柳，和一些不知道名字的樹。沒有月光的晚上，這路上陰森森的，有些怕人。今晚卻很好，雖然月光也還是淡淡的。</p>
							<blockquote><i>路上只我一個人，背著手踱著。這一片天地好像是我的；我也像超出了平常的自己，到了另一世界里。我愛熱鬧，也愛冷靜；愛群居，也愛獨處。像今晚上，一個人在這蒼茫的月下，什麼都可以想，什麼都可以不想，便覺是個自由的人。白天里一定要做的事，一定要說的話，現在都可不理。這是獨處的妙處；我且受用這無邊的荷香月色好了。</i></blockquote>
							<p>曲曲折折的荷塘上面，彌望的是田田的葉子。葉子出水很高，像亭亭的舞女的裙。層層的葉子中間，零星地點綴著些白花，有裊娜地開著的，有羞澀地打著朵兒的；正如一粒粒的明珠，又如碧天里的星星，又如剛出浴的美人。微風過處，送來縷縷清香，彷彿遠處高樓上渺茫的歌聲似的。這時候葉子與花也有一絲的頗動，像閃電般，霎時傳過荷塘的那邊去了。葉子本是肩並肩密密地挨著，這便宛然有了一道凝碧的波痕。葉子底下是脈脈的流水，遮住了，不能見一些顏色；而葉子卻更見風致了。</p>
							<p><u>月光如流水一般，靜靜地瀉在這一片葉子和花上。薄薄的青霧浮起在荷塘里：葉子和花彷彿在牛乳中洗過一樣；又像籠著輕紗的夢。雖然是滿月，天上卻有一層淡淡的雲，所以不能朗照；但我以為這恰是到了好處——酣眠固不可少，小睡也別有風味的。月光是隔了樹照過來的，高處叢生的灌木，落下參差的斑駁的黑影，峭愣愣如鬼一般；彎彎的楊柳的稀疏的倩影，卻又像是畫在荷葉上。塘中的月色並不均勻；但光與影有著和諧的旋律，如梵炯鈴上奏著的名曲。</u></p>
							<p>荷塘的四面，遠遠近近，高高低低都是樹，幾而楊柳最多。這些樹將一片荷塘重重圍住；只在小路一旁，漏著幾段空隙，像是特為月光留下的。樹色一例是陰陰的，乍看像一團煙霧；但楊柳的丰姿，便在煙霧裡也辨得出。樹梢上隱隱約約的是一帶遠山，只有些大意罷了。樹縫里也漏著一兩點路燈光，沒精打採的，是渴睡人的眼。這時候最熱鬧的，要數樹上的蟬聲與水里的蛙聲；但熱鬧是它們的，我什麼也沒有。</p>
							<p>忽然想起採蓮的事情來了。採蓮是江南的舊俗。似乎很早就有，而六朝時為盛；從詩歌里可以約略知道。採蓮的是少年的女子，她們是蕩著小船，唱著艷歌去的。採蓮人不用說很多，還有看採蓮的人。那是一個熱鬧。的季節，也是一個風流的季節。梁元帝《採蓮斌》里說得好：</p>
							<p>於是妖童媛女，蕩舟心許：鷁首徐回，兼傳羽杯；櫂將移而藻掛，船欲動而萍開。爾其纖腰束素，遷延顧步；夏始春余，葉嫩花初，恐沾裘而淺笑，畏傾船而斂裾。</p>
							<p>可見當時嬉遊的光景了。這真是有趣的事，可惜我們現在早已無福消受了。</p>
							<p>於是又記起《西州曲》里的句子：</p>
							<p>採蓮南塘秋，蓮花過人頭。尹低頭弄蓮子，蓮子清如水。</p>
							<p>今晚若有採蓮人，這兒的蓮花也算得「過人頭」了；只不見一些流水的影子，是不行的；這令我到底惦著江南了——這樣想著，猛一抬頭，不覺已是自己的門前；輕輕地推門進去，什麼聲息也沒有，妻已睡熟好久了。</p>
						`,
						waterfall: `
							<div contenteditable="true" class="size72">永和九年 ABCDEFGH 0123456789</div>
							<div contenteditable="true" class="size64">永和九年 ABCDEFGH 0123456789</div>
							<div contenteditable="true" class="size56">永和九年 ABCDEFGH 0123456789</div>
							<div contenteditable="true" class="size48">永和九年 ABCDEFGH 0123456789</div>
							<div contenteditable="true" class="size38">永和九年 ABCDEFGH 0123456789</div>
							<div contenteditable="true" class="size30">永和九年 ABCDEFGH 0123456789</div>
							<div contenteditable="true" class="size24">永和九年 ABCDEFGH 0123456789</div>
							<div contenteditable="true" class="size20">永和九年 ABCDEFGH 0123456789</div>
							<div contenteditable="true" class="size16">永和九年 ABCDEFGH 0123456789</div>
							<div contenteditable="true" class="size14">永和九年 ABCDEFGH 0123456789</div>
							<div contenteditable="true" class="size12">永和九年 ABCDEFGH 0123456789</div>
						`,
						alphabet: getAlphabetHTML(`
							<div>
								<div class="group">
									<div class="group-name">字母</div>
									<div class="group-items">ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz</div>
								</div>
								<div class="group">
									<div class="group-name">數字</div>
									<div class="group-items">1234567890</div>
								</div>
								<div class="group">
									<div class="group-name">漢字</div>
									<div class="group-items">一二三四五六七八九十百千萬今力国愛書東永袋酬鬱鷹上中下左右大小春夏秋冬東南西北金木水火土天地日月星黑白紅橙黃綠藍靛紫食住衣行育樂忠孝仁愛信義和平子曰父母兄弟夫婦君臣馬牛羊雞犬豕喜怒哀懼惡目耳口手足見聞聲貝車雨赤青言語魚鳥羽電不乃之乎人以何具倫儀先光入具初則匏協去友同名善器嚴執孟孫學宜容專少山師席常幼序從性恩恭情惰應成所才揚擇教敬數文斷方於族昔時智曾有朋本杼某梨機次欲此歲溫為燕玄玉琢畜當相知石祖禮稷稻穀窮竇竹粱紊絲綱習老者而能自至與苟菽處融親調識讓貴身近運過道遠遷鄰長非革音順飼養首香高麥黍齡思源谷歌年早林川空田生花草蟲女男力円出立休夕字學校村町森正王糸多萬半形太細広點丸交角計直線矢弱強姉妹體毛頭心曜朝夜分周今新古間前後外場國園野原里市京風雪雲池海岩室家寺通門話答聲書記紙畫工晴考理算作元肉鳴麥米茶色黃走止活店買売午汽弓回會組船明社切合台公引科刀番用</div>
								</div>
								<div class="group">
									<div class="group-name">符号</div>
									<div class="group-items">、。〃「」『』〝〞︰﹐﹒﹔﹔﹕！＃＄％＆＊，．：；？＠～•…“‘·′”’</div>
								</div>
							</div>
						`),
					},
					'zh_CN': {
						article: `
							<h2>荷塘月色</h2>
							<p>这几天心里颇不宁静。今晚在院子里坐着乘凉，忽然想起日日走过的荷塘，在这满月的光里，总该另有一番样子吧。月亮渐渐地升高了，墙外马路上孩子们的欢笑，已经听不见了；妻在屋里拍着闰儿，迷迷糊糊地哼着眠歌。我悄悄地披了大衫，带上门出去。</p>
							<p>沿着荷塘是一条曲折的小煤屑路。这是一条幽僻的路；白天也少人走，夜晚更加寂寞。荷塘四面，长着许多树，翁翁郁郁的。路的一旁，是些杨柳，和一些不知道名字的树。没有月光的晚上，这路上阴森森的，有些怕人。今晚却很好，虽然月光也还是淡淡的。</p>
							<blockquote><i>路上只我一个人，背着手踱着。这一片天地好像是我的；我也像超出了平常的自己，到了另一世界里。我爱热闹，也爱冷静；爱群居，也爱独处。像今晚上，一个人在这苍茫的月下，什么都可以想，什么都可以不想，便觉是个自由的人。白天里一定要做的事，一定要说的话，现在都可不理。这是独处的妙处；我且受用这无边的荷香月色好了。</i></blockquote>
							<p>曲曲折折的荷塘上面，弥望的是田田的叶子。叶子出水很高，像亭亭的舞女的裙。层层的叶子中间，零星地点缀着些白花，有袅娜地开着的，有羞涩地打着朵儿的；正如一粒粒的明珠，又如碧天里的星星，又如刚出浴的美人。微风过处，送来缕缕清香，仿佛远处高楼上渺茫的歌声似的。这时候叶子与花也有一丝的颇动，像闪电般，霎时传过荷塘的那边去了。叶子本是肩并肩密密地挨着，这便宛然有了一道凝碧的波痕。叶子底下是脉脉的流水，遮住了，不能见一些颜色；而叶子却更见风致了。</p>
							<p><u>月光如流水一般，静静地泻在这一片叶子和花上。薄薄的青雾浮起在荷塘里：叶子和花仿佛在牛乳中洗过一样；又像笼着轻纱的梦。虽然是满月，天上却有一层淡淡的云，所以不能朗照；但我以为这恰是到了好处——酣眠固不可少，小睡也别有风味的。月光是隔了树照过来的，高处丛生的灌木，落下参差的斑驳的黑影，峭愣愣如鬼一般；弯弯的杨柳的稀疏的倩影，却又像是画在荷叶上。塘中的月色并不均匀；但光与影有着和谐的旋律，如梵炯铃上奏着的名曲。</u></p>
							<p>荷塘的四面，远远近近，高高低低都是树，几而杨柳最多。这些树将一片荷塘重重围住；只在小路一旁，漏着几段空隙，像是特为月光留下的。树色一例是阴阴的，乍看像一团烟雾；但杨柳的丰姿，便在烟雾里也辨得出。树梢上隐隐约约的是一带远山，只有些大意罢了。树缝里也漏着一两点路灯光，没精打采的，是渴睡人的眼。这时候最热闹的，要数树上的蝉声与水里的蛙声；但热闹是它们的，我什么也没有。</p>
							<p>忽然想起采莲的事情来了。采莲是江南的旧俗。似乎很早就有，而六朝时为盛；从诗歌里可以约略知道。采莲的是少年的女子，她们是荡着小船，唱着艳歌去的。采莲人不用说很多，还有看采莲的人。那是一个热闹的季节，也是一个风流的季节。梁元帝《采莲斌》里说得好：</p>
							<p>于是妖童媛女，荡舟心许：鷁首徐回，兼传羽杯；櫂将移而藻挂，船欲动而萍开。尔其纤腰束素，迁延顾步；夏始春余，叶嫩花初，恐沾裘而浅笑，畏倾船而敛裾。</p>
							<p>可见当时嬉游的光景了。这真是有趣的事，可惜我们现在早已无福消受了。</p>
							<p>于是又记起《西州曲》里的句子：</p>
							<p>采莲南塘秋，莲花过人头。尹低头弄莲子，莲子清如水。</p>
							<p>今晚若有采莲人，这儿的莲花也算得“过人头”了；只不见一些流水的影子，是不行的；这令我到底惦着江南了——这样想着，猛一抬头，不觉已是自己的门前；轻轻地推门进去，什么声息也没有，妻已睡熟好久了。</p>
						`,
						waterfall: `
							<div contenteditable="true" class="size72">永和九年 ABCDEFGH 0123456789</div>
							<div contenteditable="true" class="size64">永和九年 ABCDEFGH 0123456789</div>
							<div contenteditable="true" class="size56">永和九年 ABCDEFGH 0123456789</div>
							<div contenteditable="true" class="size48">永和九年 ABCDEFGH 0123456789</div>
							<div contenteditable="true" class="size38">永和九年 ABCDEFGH 0123456789</div>
							<div contenteditable="true" class="size30">永和九年 ABCDEFGH 0123456789</div>
							<div contenteditable="true" class="size24">永和九年 ABCDEFGH 0123456789</div>
							<div contenteditable="true" class="size20">永和九年 ABCDEFGH 0123456789</div>
							<div contenteditable="true" class="size16">永和九年 ABCDEFGH 0123456789</div>
							<div contenteditable="true" class="size14">永和九年 ABCDEFGH 0123456789</div>
							<div contenteditable="true" class="size12">永和九年 ABCDEFGH 0123456789</div>
						`,
						alphabet: getAlphabetHTML(`
							<div>
								<div class="group">
									<div class="group-name">字母</div>
									<div class="group-items">ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz</div>
								</div>
								<div class="group">
									<div class="group-name">数字</div>
									<div class="group-items">1234567890</div>
								</div>
								<div class="group">
									<div class="group-name">汉字</div>
									<div class="group-items">一二三四五六七八九十百千万今国意我永然警转酬随风鹰上中下左右大小春夏秋冬东南西北金木水火土天地日月星黑白红橙黄绿蓝靛紫食住衣行育乐忠孝仁爱信义和平子曰父母兄弟夫妇君臣马牛羊鸡犬豕喜怒哀惧恶目耳口手足见闻声贝车雨赤青言语鱼鸟羽电不乃之乎人以何具伦仪先光入具初则匏协去友同名善器严执孟孙学宜容专少山师席常幼序从性恩恭情惰应成所才扬择教敬数文断方于族昔时智曾有朋本杼某梨机次欲此岁温为燕玄玉琢畜当相知石祖礼稷稻谷穷窦竹粱紊丝纲习老者而能自至与苟菽处融亲调识让贵身近运过道远迁邻长非革音顺饲养首香高麦黍龄思源谷歌年早林川空田生花草虫女男力円出立休夕字学校村町森正王糸多万半形太细広点丸交角计直线矢弱强姉妹体毛头心曜朝夜分周今新古间前后外场国园野原里市京风雪云池海岩室家寺通门话答声书记纸画工晴考理算作元肉鸣麦米茶色黄走止活店买売午汽弓回会组船明社切合台公引科刀番用</div>
								</div>
								<div class="group">
									<div class="group-name">符号</div>
									<div class="group-items">、。〃「」『』〝〞︰﹐﹒﹔﹔﹕！＃＄％＆＊，．：；？＠～•…“‘·′”’</div>
								</div>
							</div>
						`),
					},
					'en': {
						article: `
							<h2>Moonlight over the Lotus Pond</h2>
							<p>It has been rather disquieting these days. Tonight, when I was sitting in the yard enjoying the cool, it occurred to me that the Lotus Pond, which I pass by every day, must assume quite a different look in such moonlit night. A full moon was rising high in the sky; the laughter of children playing outside had died away; in the room, my wife was patting the son, Run-er, sleepily humming a cradle song. Shrugging on an overcoat, quietly, 1 made my way out, closing the door behind me.</p>
							<p>Alongside the Lotus Pond runs a small cinder footpath. It is peaceful and secluded here, a place not frequented by pedestrians even in the daytime; now at night, it looks mare solitary, in a lush, shady ambience of trees all around the pond. On the side where the path is, there are willows, interlaced with some others whose names I do not know. The foliage, which, in a moonless night, would loom somewhat frighteningly dark, looks very nice tonight, although the moonlight is not more than a thin, grayish veil.</p>
							<blockquote><i>I am on my own, strolling, hands behind my back. This bit of the universe seems in my possession now; and I myself seem to have been uplifted from my ordinary self into another world. 1 like a serene and peaceful life, as much as a busy and active one; I like being in solitude, as much as in company. As it is tonight, basking in a misty moonshine all by myself, I feel I am a free man, free to think of anything, or of nothing. All that one is obliged to do, or to say, in the daytime, can be very well cast aside now. That is the beauty of being alone. For the moment, just let me indulge in this profusion of moonlight and lotus fragrance.</i></blockquote>
							<p>All over this winding stretch of water, what meets the eye is a silken field of leaves, reaching rather high above the surface, like the skirts of dancing girls in all their grace. Here and there, layers of leaves are dotted with white lotus blossoms, some in demure bloom, others in shy bud, like scattering pearls, or twinkling stars, or beauties just out of the bath. A breeze stirs, sending over breaths of fragrance, like faint singing drifting from a distant building. At this moment, a tiny thrill shoots through the leaves and lilies, like, a streak of lightning, straight across the forest of lotuses. The leaves, which have been standing shoulder to shoulder, are caught shimmering in an emerald heave of the pond. Underneath, the exquisite water is covered from view, and none can tell its colour; yet the leaves on top project themselves all the more attractively.</p>
							<p><u>The moon sheds her liquid light silently over the leaves and flowers, which, in the floating transparency of a bluish haze from the pond, look as if they had just been bathed in milk, or like a dream wrapped in a gauzy hood. Although it is a full moon, shining through a film of clouds, the light is not at its brightest; it is, however, just right for me -a profound sleep is indispensable, vet a snatched doze also has a savour of its own. The moonlight is streaming down through the foliage, casting bushy shadows on the ground from high above, jagged and checkered, as grotesque as a party of spectres; whereas the benign figures of the drooping willows, here and there, lank like paintings on the lotus leaves. The moonlight is not spread evenly over the pond, but rather in a harmonious rhythm of light and shade, like a famous melody played on a violin.</u></p>
							<p>Around the pond, far anti near, high and low, are trees. Most of them are willows. Only on the path side, can taro or three gap; he seen through the heavy fringe, as if specially reserved for the moon. The shadowy shapes of the leafage at first sight seem diffused into a mass of mist, against which, however, the charm of those willow trees is still discernible. Over the trees appear some distant mountains, but merely in sketchy silhouette. Through the branches are also a couple of lamps, as listless as sleepy eyes. The most lively creatures here, for the moment, must he the cicadas in the trees and the frogs in the pond. But the liveliness is theirs, I have nothing.</p>
							<p>Suddenly, something like lotus-gathering crosses my mind. It used to he celebrated as a folk festival in the South, probably dating very far hack in history, mast popular in the period of Six Dynasties. We can pick up some outlines of this activity in the poetry. It was young girls who went gathering lotuses, in sampans and singing love songs. Needless to say, there were a great number of them doing the gathering, apart from those who were watching. It was a lively season, brimming with vitality, and romance. A brilliant description can be found in Lotus Gathering written by the Yuan Emperor of the Liang Dynasty:</p>
							<p>So those charming youngsters row their sampans, heart buoyant with tacit love, pass to eath other cups of wine while their bird- shaped prows drift around. From time to time their oars are caught in dangling algae, and duckweed float apart the moment their boats are about to move on. Their slender figures, girdled with plain silk, tread watchfully on board. This is the time when spring is growing into summer, the leaves a tender green and the flowers blooming,- among which the girls are giggling when evading an outreaching stem. Their shirts tucked in for fear that the sampan might tilt.</p>
							<p>That is a glimpse of those merrymaking scenes. It must have been fascinating, but unfortunately we have long been denied such a delight.</p>
							<p>If there were somebody gathering lotuses tonight, she could tell that the lilies here are high enough to "reach over her head"; but, one would certainly miss the sight of the water. So my memories drift back to the South after all.Deep in my thoughts, I looked up, just to find myself at the door of my own house. Gently I pushed the door open and walked in. Not a sound inside, my wife had been fast asleep for quite a while.</p>
						`,
						waterfall: `
							<div contenteditable="true" class="size72">ABCDEFGH 0123456789</div>
							<div contenteditable="true" class="size64">ABCDEFGH 0123456789</div>
							<div contenteditable="true" class="size56">ABCDEFGH 0123456789</div>
							<div contenteditable="true" class="size48">ABCDEFGH 0123456789</div>
							<div contenteditable="true" class="size38">ABCDEFGH 0123456789</div>
							<div contenteditable="true" class="size30">ABCDEFGH 0123456789</div>
							<div contenteditable="true" class="size24">ABCDEFGH 0123456789</div>
							<div contenteditable="true" class="size20">ABCDEFGH 0123456789</div>
							<div contenteditable="true" class="size16">ABCDEFGH 0123456789</div>
							<div contenteditable="true" class="size14">ABCDEFGH 0123456789</div>
							<div contenteditable="true" class="size12">ABCDEFGH 0123456789</div>
						`,
						alphabet: getAlphabetHTML(`
							<div>
								<div class="group">
									<div class="group-name">Latin</div>
									<div class="group-items">ABCČĆDĐEFGHIJKLMNOPQRSŠTUVWXYZŽabcčćdđefghijklmnopqrsštuvwxyzžАБВГҐДЂЕЁЄЖЗЅИІЇЙЈКЛЉМНЊОПРСТЋУЎФХЦЧЏШЩЪЫЬЭЮЯабвгґдђеёєжзѕиіїйјклљмнњопрстћуўфхцчџшщъыьэюяΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩαβγδεζηθικλμνξοπρστυφχψωάΆέΈέΉίϊΐΊόΌύΰϋΎΫΏĂÂÊÔƠƯăâêôơư</div>
								</div>
								<div class="group">
									<div class="group-name">Number</div>
									<div class="group-items">1234567890</div>
								</div>
								<div class="group">
									<div class="group-name">Symbol</div>
									<div class="group-items">‘?’“!”(%)[#]{@}/&\<-+÷×=>®©$€£¥¢:;,.*</div>
								</div>
								<div class="group">
									<div class="group-name">Cyrillic Lowercase</div>
									<div class="group-items">аӑӓәӛӕбвгѓґғӻҕӷдђҙеѐӗёєжӂӝҗзӟԑѕӡиѝӥӣҋіїйјкќқӄҡҟҝԛлӆԯԓљмӎнԩӊңӈҥњоӧөӫпԥрҏсҫтҭћуўӱӳӯүұфхӽӿҳһԧцҵчӵҷӌҹҽҿџшщъыӹьҍѣэӭюяѫѳѵҩԝӏ</div>
								</div>
								<div class="group">
									<div class="group-name">Cyrillic Uppercase</div>
									<div class="group-items">АӐӒӘӚӔБВГЃҐҒӺҔӶДЂҘЕЀӖЁЄЖӁӜҖЗӞԐЅӠИЍӤӢҊІЇЙЈКЌҚӃҠҞҜԚЛӅԮԒЉМӍНԨӉҢӇҤЊОӦӨӪПԤРҎСҪТҬЋУЎӰӲӮҮҰФХӼӾҲҺԦЦҴЧӴҶӋҸҼҾЏШЩЪЫӸЬҌѢЭӬЮЯѪѲѴҨԜӀ</div>
								</div>
							</div>
						
						`),
					},
				}

				function getAlphabetHTML (alphas) {
					try {
						const $html = $(alphas);
						
						$html.find(".group-items").each(function () {
							const $items = $(this);
							$items.html($items.html().replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').split('').map((alpha) => {
								return `<span class="alpha-preview" label="${alpha}"><div class="char"><div class="before" style="font-family:'${$scope.fontCSSName}'">${alpha}</div><div class="after">${alpha}</div></div><div class="zoom" style="font-family:'${$scope.fontCSSName}'">${alpha}</div></span>`
							}).join(''));
						});

						return $html.html();
					}
					catch (err) {
						console.log(err);
						return "";
					}
				};

				$scope.content = {
					article: translation[lang].article,
					waterfall: translation[lang].waterfall,
					alphabet: translation[lang].alphabet,
				}

				$scope.$apply();
				setTimeout(function () {
					var scrollTop = localStorage.getItem("eagle.fontViewer.scrollTop") || 0;
					$window.scrollTop(scrollTop);

					var editor = new MediumEditor($(".content .article"), {
						placeholder: {
							text: '',
							hideOnClick: true
						},
						toolbar: {
							// buttons: ['h2', 'h3', 'bold', 'italic', 'underline', 'anchor', 'quote'],
							buttons: ['h2', 'h3', 'bold', 'italic', 'underline', 'quote'],
						},
						anchor: {
							customClassOption: null,
							customClassOptionText: 'Button',
							linkValidation: false,
							placeholderText: 'Paste or type a link',
							targetCheckbox: false,
							targetCheckboxText: 'Open in new window'
						},
						paste: {
							cleanPastedHTML: true,
							cleanAttrs: ['style', 'dir'],
							cleanTags: ['label', 'meta'],
							cleanReplacements: ['img'],
							unwrapTags: ['sub', 'sup']
						},
						autoLink: true,
						// extensions: {
						//     'imageDragging': {}
						// }
					});
					editor.subscribe("editableKeydown", function (event) {
						var keyCode = event.keyCode;
						if (keyCode == 65 && (event.ctrlKey || event.metaKey)) {
							editor.selectAllContents();
						}
					});
				}, 30);
			}, function (err) {
				console.log(err);
				document.body.style.display = "block";
				$scope.isSupport = false;
				$scope.$evalAsync();
			});
    	});
    }
    else {
    	document.body.style.display = "block";
		$scope.isSupport = false;
		$scope.$evalAsync();
    }

	var lng = window.parent.$bodyScope.preferences.general.language;
	var lngMap = {
		"ko_KR": "kr",
		"ja_JP": "jp",
	};

	if (fontMetas.support) {
		if (lng && lng !== "en" && fontMetas.support[lngMap[lng]]) {
			lang = lngMap[lng];
		}
		else {
			if (
		    	(fontMetas.postScriptName && fontMetas.postScriptName.ja) || 
		    	(fontMetas.fontFamily && fontMetas.fontFamily.ja)
	    	) { lang = 'jp'; }
			else if (fontMetas.support['zh_CN'] && fontMetas.support['zh_TW']) { lang = 'zh_CN'; }
		    else if (fontMetas.support['zh_CN'] && fontMetas.postScriptName && fontMetas.postScriptName.zh) { lang = 'zh_CN'; }
		    else if (fontMetas.support['zh_TW'] && fontMetas.postScriptName && fontMetas.postScriptName["zh_TW"]) { lang = 'zh_TW'; }
		    else if (fontMetas.support['zh_CN']) { lang = 'zh_CN'; }
		    else if (fontMetas.support['zh_TW']) { lang = 'zh_TW'; }
		    else if (fontMetas.support['kr']) { lang = 'kr'; }
		    else if (fontMetas.support['jp']) { lang = 'jp'; }
		    else { lang = 'en'; }
		}
	}
	else { lang = "en"; }

	if (fontMetas.preferLng) {
		lang = fontMetas.preferLng;
	}

	console.log(`语言判断：${lang}`);

	$scope.activateFont = function () {
		$scope.isActivate = true;
		$parentScope.activateFont($parentScope.current, {showNotify: true, updateView: true});
	};

	$scope.deactivateFont = function () {
		$scope.isActivate = false;
		$parentScope.deactivateFont($parentScope.current, {showNotify: true, updateView: true});
	};

    $scope.isActivate = $parentScope.isFontActivate($parentScope.current);
});