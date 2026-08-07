var app = angular.module("TextEditor", ['mgo-mousetrap',]);

$("body").on('click', 'a', function(event) {
    event && event.preventDefault();
    if ($(this).attr("target") == "_blank") {
        var link = this.href;
        window.parent.require("electron").shell.openExternal(link);
    }
});

window.focus();

app.config(function($sceProvider, $httpProvider) {
    $sceProvider.enabled(false);
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

app.controller("TextEditorController", function ($scope, $timeout) {

	var $parentScope = window.parent.$bodyScope;

	$scope.isLoaded = false;
	$scope.title = "";
	$scope.lastStat;
	$scope.isDirty = false;
	$("#content").html("");
	
	$scope.preventEnter = function(event) {
		if (event.shiftKey && event.keyCode === 13) {
	        event.stopPropagation();
	        event.preventDefault();
	    }
	    else if (event.keyCode === 27) {
	        event.preventDefault();
	        $(event.target).trigger("blur");
	    }
	    else if (event.keyCode === 9) {
	    	document.execCommand('insertHTML', false, '&#009');
	        event.preventDefault();
	    }
	    else if (event.keyCode === 83 && (event.metaKey || event.ctrlKey)) {
	    	$scope.save();
	    	$scope.$evalAsync();
	    }
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
		$scope.save(function () {
			$parentScope.escHandler();
			$parentScope.$evalAsync();
		});
	};

	var retryCount = 3;
	$scope.refresh = function () {
		if (!window.parent) {
			return;
		}
		var fs = window.parent.require("fs");
		$scope.isLoaded = false;
		var path = window.parent.require("path");
		var title = path.basename($scope.txtPath, ".txt");
		if (!fs.existsSync($scope.txtPath)) {
			setTimeout(() => {
				retryCount--;
				if (retryCount > 0) {
					$scope.refresh();
				}
			}, 400);
			console.error("file not exists");
			return;
		}
		retryCount = 3;
		fs.readFile($scope.txtPath, 'utf8', (err, text) => {
			if (err) {
				console.error(err);
			}
			else {
				console.log(text.length);
				var content = $("#content").text();
				if (content !== "" && text === "") return;

				$scope.title = title;
				$scope.newTitle = title;
				$scope.originText = text;
				$("#content").text(text).promise().then(function () {

					$("#content").off("input").on("input", function () {
						$scope.autoSave();
						$scope.$evalAsync();
					});

					$("#content").off("blur").on("blur", function () {
						$scope.save();
						$scope.$evalAsync();
					});

					$("#content").off("keydown").on("keydown", function (event) {
						$scope.preventEnter(event);
						$scope.autoSave();
						$scope.$evalAsync();
					});

					$scope.lastStat = fs.statSync($scope.txtPath);
					$scope.isLoaded = true;
					$scope.isDirty = false;
					$scope.$evalAsync();

				});
			}
		});
	};

	var isCheckingForUpdate = false;
	function checkForUpdate () {
		if (isCheckingForUpdate) return;
		isCheckingForUpdate = true;
		var fs = window.parent.require("fs");
		if (fs.existsSync($scope.txtPath)) {
			var stat = fs.statSync($scope.txtPath);
			if (stat.mtimeMs !== $scope.lastStat.mtimeMs) {
				console.log("发现修改，重新载入");
				isCheckingForUpdate = false;
				$scope.refresh();
			}
			else {
				console.log("没有修改，无须更动");
				isCheckingForUpdate = false;
			}
		}
	}

	// 全选功能
	$("body").on('keydown', 'input, textarea', function(event) {
	    var keyCode = event.keyCode;
	    if (keyCode == 65 && (event.ctrlKey || event.metaKey)) {
	        $(this).select();
	    }
	});

	$('#preview-size').on('input', function () {
		$(this).trigger('change');
		var size = parseFloat($('#preview-size').val());
		$("html").css("font-size", `${size}%`);
		$(this).blur();
		// $(".waterfall").scrollLeft(0);
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

	$scope.changeName = function () {
		$timeout(function () {
			var newName = $scope.newTitle;
			if ($scope.newTitle === $scope.title) return;
			if (newName !== "") {
				$scope.title = $scope.newTitle;
				$parentScope.inspector.newName = newName;
				$parentScope.imagesChange();
				$parentScope.$evalAsync();
			}
			else {
				$scope.newTitle = $scope.title;
			}
		}, 200);
	};

	$scope.autoSave = debounce(function () {
		$scope.isDirty = true;	
		$scope.save();
	}, 500);

	$scope.save = debounce(function (callback) {
		var fs = window.parent.require("fs");
		var text = $("#content").text();
		if (text === "") {
			return;
		}
		$scope.isDirty = (text !== $scope.originText);
		if ($scope.isDirty) {
			console.log("开始保存");
			var tempDir = $scope.txtPath + "." + Date.now();
			var tempWStream = fs.createWriteStream(tempDir, { flags: 'w' });

			tempWStream.write(text);

			tempWStream.on('error', function(err) {
                ipcRenderer.send('electron-info', "[app] An error has occurred save text file");
                ipcRenderer.send('electron-log', "" + err.stack || err);
                window.parent.require('@electron/remote').dialog.showMessageBox({
	                type: "error",
	                cancelId: 1,
	                buttons: ["OK"],
	                message: err.stack || err,
	            });
	            if (fs.existsSync(tempDir)) {
                    fse.removeSync(tempDir);
                }
            });


			tempWStream.on('finish', function () {

				console.log("保存完成");

				var fse = window.parent.require("fs-extra");
				fse.moveSync(tempDir, $scope.txtPath, { overwrite: true });
				if (fs.existsSync(tempDir)) {
                    fse.removeSync(tempDir);
                }

			// fs.writeFile($scope.txtPath, text, 'utf8', (err) => {
				$scope.originText = text;
				$scope.lastStat = fs.statSync($scope.txtPath);
				window.parent.require('electron').ipcRenderer.send("update-txt-item", {
					id: $scope.id,
					text: text.substr(0, 1024 * 32)
				});
				$scope.isDirty = false;
				$scope.$evalAsync();
				if (callback) {
					callback();
				}
			});
			tempWStream.end();
		}
		else {
			if (callback) {
				callback();
			}
		}
	}, 300, true);

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

	var id = urlParams.id;
	$scope.id = id;
	$scope.theme = urlParams.theme;
	$scope.language = urlParams.language || "en";
	
	var txtPath = $parentScope.imagesDir + $parentScope.current.id + ".info/" + $parentScope.current.name + "." + $parentScope.current.ext;

	$scope.txtPath = decodeURIComponent(txtPath);
	console.log($scope.txtPath);

	$scope.refresh();
	
	// window.parent.require('electron').ipcRenderer.on('update-txt-item', function(e, params) {
	// 	if (params.id === $scope.id) {
	// 		$scope.refresh();
	// 	}
 //    });

	$(window).on("focus", function () {
		if ($scope.lastStat) {
			checkForUpdate();
		}
	});

});