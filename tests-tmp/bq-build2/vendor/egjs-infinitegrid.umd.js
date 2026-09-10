(function webpackUniversalModuleDefinition(root, factory) {
	if(typeof exports === 'object' && typeof module === 'object')
		module.exports = factory();
	else if(typeof define === 'function' && define.amd)
		define([], factory);
	else if(typeof exports === 'object')
		exports["InfiniteGrid"] = factory();
	else
		root["eg"] = root["eg"] || {}, root["eg"]["InfiniteGrid"] = factory();
})(typeof self !== 'undefined' ? self : this, function() {
return /******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId]) {
/******/ 			return installedModules[moduleId].exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			i: moduleId,
/******/ 			l: false,
/******/ 			exports: {}
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.l = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// define getter function for harmony exports
/******/ 	__webpack_require__.d = function(exports, name, getter) {
/******/ 		if(!__webpack_require__.o(exports, name)) {
/******/ 			Object.defineProperty(exports, name, {
/******/ 				configurable: false,
/******/ 				enumerable: true,
/******/ 				get: getter
/******/ 			});
/******/ 		}
/******/ 	};
/******/
/******/ 	// getDefaultExport function for compatibility with non-harmony modules
/******/ 	__webpack_require__.n = function(module) {
/******/ 		var getter = module && module.__esModule ?
/******/ 			function getDefault() { return module['default']; } :
/******/ 			function getModuleExports() { return module; };
/******/ 		__webpack_require__.d(getter, 'a', getter);
/******/ 		return getter;
/******/ 	};
/******/
/******/ 	// Object.prototype.hasOwnProperty.call
/******/ 	__webpack_require__.o = function(object, property) { return Object.prototype.hasOwnProperty.call(object, property); };
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(__webpack_require__.s = 7);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


exports.__esModule = true;
exports.STYLE = undefined;

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };
var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

exports.toArray = toArray;
exports.matchHTML = matchHTML;
exports.$ = $;
exports.addEvent = addEvent;
exports.removeEvent = removeEvent;
exports.scroll = scroll;
exports.scrollTo = scrollTo;
exports.scrollBy = scrollBy;
exports.getStyles = getStyles;
exports.innerWidth = innerWidth;
exports.innerHeight = innerHeight;
exports.getStyleNames = getStyleNames;
exports.assignOptions = assignOptions;
exports.toZeroArray = toZeroArray;
exports.isWindow = isWindow;
exports.fill = fill;

var _browser = __webpack_require__(2);

var _consts = __webpack_require__(1);

function toArray(nodes) {
	// SCRIPT5014 in IE8
	var array = [];

	if (nodes) {
		for (var i = 0, len = nodes.length; i < len; i++) {
			array.push(nodes[i]);
		}
	}
	return array;
}
function matchHTML(html) {
	return html.match(/^<([A-z]+)\s*([^>]*)>/);
}
/**
 * Select or create element
 * @param {String|HTMLElement|jQuery} param
 *  when string given is as HTML tag, then create element
 *  otherwise it returns selected elements
 * @param {Boolean} multi
 * @returns {HTMLElement}
 */
function $(param) {
	var multi = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;

	var el = void 0;

	if (typeof param === "string") {
		// String (HTML, Selector)
		// check if string is HTML tag format
		var match = matchHTML(param);

		// creating element
		if (match) {
			// HTML
			var dummy = _browser.document.createElement("div");
			dummy.innerHTML = param;
			el = dummy.childNodes;
		} else {
			// Selector
			el = _browser.document.querySelectorAll(param);
		}
		if (multi) {
			el = toArray(el);
		} else {
			el = el && el.length > 0 && el[0] || undefined;
		}
	} else if (param === _browser.window) {
		// window
		el = param;
	} else if (param && param.nodeName && (param.nodeType === 1 || param.nodeType === 9)) {
		// HTMLElement, Document
		el = param;
	} else if ("jQuery" in _browser.window && param instanceof _browser.window.jQuery || (param && param.constructor.prototype.jquery) ) {
		// jQuery
		el = multi ? param.toArray() : param.get(0);
	} else if (Array.isArray(param)) {
		// console.time("param.map")
		el = param.map(function (v) {
			return $(v);
		});
		// console.timeEnd("param.map")
	
		if (!multi) {
			el = el.length >= 1 ? el[0] : undefined;
		}
	}
	return el;
}
function addEvent(element, type, handler, eventListenerOptions) {
	if (_consts.SUPPORT_ADDEVENTLISTENER) {
		var options = eventListenerOptions || false;

		if ((typeof eventListenerOptions === "undefined" ? "undefined" : _typeof(eventListenerOptions)) === "object") {
			options = _consts.SUPPORT_PASSIVE ? eventListenerOptions : false;
		}
		element.addEventListener(type, handler, options);
	} else if (element.attachEvent) {
		element.attachEvent("on" + type, handler);
	} else {
		element["on" + type] = handler;
	}
}
function removeEvent(element, type, handler) {
	if (element.removeEventListener) {
		element.removeEventListener(type, handler, false);
	} else if (element.detachEvent) {
		element.detachEvent("on" + type, handler);
	} else {
		element["on" + type] = null;
	}
}
function scroll(el, isVertical) {
	var prop = "scroll" + (isVertical ? "Top" : "Left");

	if (el === _browser.window) {
		return _browser.window[isVertical ? "pageYOffset" : "pageXOffset"] || _browser.document.body[prop] || _browser.document.documentElement[prop];
	} else {
		return el[prop];
	}
}
function scrollTo(el, x, y) {
	if (el === _browser.window) {
		el.scroll(x, y);
	} else {
		el.scrollLeft = x;
		el.scrollTop = y;
	}
}
function scrollBy(el, x, y) {
	if (el === _browser.window) {
		el.scrollBy(x, y);
	} else {
		el.scrollLeft += x;
		el.scrollTop += y;
	}
}
function getStyles(el) {
	return _consts.SUPPORT_COMPUTEDSTYLE ? _browser.window.getComputedStyle(el) : el.currentStyle;
}
function _getSize(el, name) {
	if (el === _browser.window) {
		// WINDOW
		return el.document.documentElement["client" + name];
	} else if (el.nodeType === 9) {
		// DOCUMENT_NODE
		var doc = el.documentElement;

		return Math.max(el.body["scroll" + name], doc["scroll" + name], el.body["offset" + name], doc["offset" + name], doc["client" + name]);
	} else {
		// NODE
		// console.time("getStyles");
		// var style = getStyles(el);
		// console.timeEnd("getStyles");
		// var value = style[name.toLowerCase()];
		var value = jQuery(el).css(name.toLowerCase());
		// console.log("value: ", value);
		// console.log("value2: ", value2);

		return parseFloat(/auto|%/.test(value) ? el["offset" + name] : value);
	}
}
function innerWidth(el) {
	return _getSize(el, "Width");
}
function innerHeight(el) {
	return _getSize(el, "Height");
}
var STYLE = exports.STYLE = {
	vertical: {
		pos1: "top",
		endPos1: "bottom",
		size1: "height",
		pos2: "left",
		endPos2: "right",
		size2: "width"
	},
	horizontal: {
		pos1: "left",
		endPos1: "right",
		size1: "width",
		pos2: "top",
		endPos2: "bottom",
		size2: "height"
	}
};

function getStyleNames(isHorizontal) {
	return STYLE[isHorizontal ? _consts.HORIZONTAL : _consts.VERTICAL];
}

function assignOptions(defaultOptions, options) {
	return _extends({}, _consts.DEFAULT_OPTIONS, defaultOptions, options);
}

function toZeroArray(outline) {
	if (!outline || !outline.length) {
		return [0];
	}
	return outline;
}

function isWindow(el) {
	return el === _browser.window;
}

function fill(arr, value) {
	var length = arr.length;

	for (var i = length - 1; i >= 0; --i) {
		arr[i] = value;
	}

	return arr;
}

/***/ }),
/* 1 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


exports.__esModule = true;
exports.DEFENSE_BROWSER = exports.WEBKIT_VERSION = exports.PROCESSING = exports.LOADING_PREPEND = exports.LOADING_APPEND = exports.IDLE = exports.ALIGN = exports.isMobile = exports.agent = exports.DEFAULT_OPTIONS = exports.GROUPKEY_ATT = exports.DUMMY_POSITION = exports.SINGLE = exports.MULTI = exports.NO_TRUSTED = exports.TRUSTED = exports.NO_CACHE = exports.CACHE = exports.HORIZONTAL = exports.VERTICAL = exports.PREPEND = exports.APPEND = exports.IGNORE_CLASSNAME = exports.CONTAINER_CLASSNAME = exports.RETRY = exports.IS_ANDROID2 = exports.IS_IOS = exports.IS_IE = exports.SUPPORT_PASSIVE = exports.SUPPORT_ADDEVENTLISTENER = exports.SUPPORT_COMPUTEDSTYLE = undefined;

var _browser = __webpack_require__(2);

var ua = _browser.window.navigator.userAgent;

var SUPPORT_COMPUTEDSTYLE = exports.SUPPORT_COMPUTEDSTYLE = !!("getComputedStyle" in _browser.window);
var SUPPORT_ADDEVENTLISTENER = exports.SUPPORT_ADDEVENTLISTENER = !!("addEventListener" in document);
var SUPPORT_PASSIVE = exports.SUPPORT_PASSIVE = function () {
	var supportsPassiveOption = false;

	try {
		if (SUPPORT_ADDEVENTLISTENER && Object.defineProperty) {
			document.addEventListener("test", null, Object.defineProperty({}, "passive", {
				get: function get() {
					supportsPassiveOption = true;
				}
			}));
		}
	} catch (e) {}
	return supportsPassiveOption;
}();

var IS_IE = exports.IS_IE = /MSIE|Trident|Windows Phone|Edge/.test(ua);
var IS_IOS = exports.IS_IOS = /iPhone|iPad/.test(ua);
var IS_ANDROID2 = exports.IS_ANDROID2 = /Android 2\./.test(ua);
var RETRY = exports.RETRY = 3;
var CONTAINER_CLASSNAME = exports.CONTAINER_CLASSNAME = "_eg-infinitegrid-container_";
var IGNORE_CLASSNAME = exports.IGNORE_CLASSNAME = "_eg-infinitegrid-ignore_";

var APPEND = exports.APPEND = true;
var PREPEND = exports.PREPEND = false;
var VERTICAL = exports.VERTICAL = "vertical";
var HORIZONTAL = exports.HORIZONTAL = "horizontal";
var CACHE = exports.CACHE = true;
var NO_CACHE = exports.NO_CACHE = false;
var TRUSTED = exports.TRUSTED = true;
var NO_TRUSTED = exports.NO_TRUSTED = false;
var MULTI = exports.MULTI = true;
var SINGLE = exports.SINGLE = false;
var DUMMY_POSITION = exports.DUMMY_POSITION = -100000;
var GROUPKEY_ATT = exports.GROUPKEY_ATT = "data-groupkey";

var DEFAULT_OPTIONS = exports.DEFAULT_OPTIONS = {
	horizontal: false,
	margin: 0
};

var agent = exports.agent = ua.toLowerCase();
var isMobile = exports.isMobile = /mobi|ios|android/.test(agent);

var ALIGN = exports.ALIGN = {
	START: "start",
	CENTER: "center",
	END: "end",
	JUSTIFY: "justify"
};

var IDLE = exports.IDLE = 0;
var LOADING_APPEND = exports.LOADING_APPEND = 1;
var LOADING_PREPEND = exports.LOADING_PREPEND = 2;
var PROCESSING = exports.PROCESSING = 4;

var webkit = /applewebkit\/([\d|.]*)/g.exec(agent);

var WEBKIT_VERSION = exports.WEBKIT_VERSION = webkit && parseInt(webkit[1], 10) || 0;
var DEFENSE_BROWSER = exports.DEFENSE_BROWSER = WEBKIT_VERSION && WEBKIT_VERSION < 537;

/***/ }),
/* 2 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


exports.__esModule = true;
/* eslint-disable no-new-func, no-nested-ternary */
var win = window;
/* eslint-enable no-new-func, no-nested-ternary */

exports.window = win;
var document = exports.document = win.document;

/***/ }),
/* 3 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


exports.__esModule = true;

var _browser = __webpack_require__(2);

var _utils = __webpack_require__(0);

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var elements = [];
/* eslint-disable */
function onResize(e) {
	AutoSizer.resizeAll();
}
/* eslint-enable */

var AutoSizer = function () {
	function AutoSizer() {
		_classCallCheck(this, AutoSizer);
	}

	AutoSizer.add = function add(element) {
		var prefix = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : "data-";

		if (!element.length) {
			(0, _utils.addEvent)(_browser.window, "resize", onResize);
		}
		element.__PREFIX__ = prefix;
		elements.push(element);
		AutoSizer.resize(element);
	};

	AutoSizer.remove = function remove(element) {
		var isFixed = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;

		var fixed = element.getAttribute(element.__PREFIX__ + "fixed") || "width";

		if (!isFixed) {
			element.style[fixed === "width" ? "height" : "width"] = "";
		}
		var index = elements.indexOf(element);

		if (!~index) {
			return;
		}
		elements.splice(index, 1);
		if (!elements.length) {
			(0, _utils.removeEvent)(_browser.window, "reisze", onResize);
		}
	};

	AutoSizer.resize = function resize(element) {
		var prefix = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : "data-";

		var elementPrefix = typeof element.__PREFIX__ === "string" ? element.__PREFIX__ : prefix;
		var dataWidth = element.getAttribute(elementPrefix + "width");
		var dataHeight = element.getAttribute(elementPrefix + "height");
		var fixed = element.getAttribute(elementPrefix + "fixed") || "width";

		if (fixed === "width") {
			var size = (0, _utils.innerWidth)(element) || dataWidth;
			element.style.height = dataHeight / dataWidth * size + "px";
		} else if (fixed === "height") {
			var _size = (0, _utils.innerHeight)(element) || dataHeight;

			element.style.width = dataWidth / dataHeight * _size + "px";
		}
	};

	AutoSizer.resizeAll = function resizeAll() {
		elements.forEach(function (element) {
			return AutoSizer.resize(element);
		});
	};

	return AutoSizer;
}();

exports["default"] = AutoSizer;
module.exports = exports["default"];

/***/ }),
/* 4 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


exports.__esModule = true;

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _consts = __webpack_require__(1);

var _utils = __webpack_require__(0);

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defense(element) {
	var container = document.createElement("div");

	container.className = _consts.CONTAINER_CLASSNAME;
	container.style.position = "relative";
	container.style.height = "100%";

	var children = element.children;
	var length = children.length; // for IE8

	for (var i = 0; i < length; i++) {
		container.appendChild(children[0]);
	}

	element.appendChild(container);
	return container;
}

var DOMRenderer = function () {
	DOMRenderer.renderItem = function renderItem(item, styles) {
		if (item.el) {
			// var elStyle = item.el.style;
			// for debugging
			item.el.setAttribute(_consts.GROUPKEY_ATT, item.groupKey);
			// elStyle.position = "absolute";
			// ["left", "top", "width", "height"].forEach(function (p) {
			// 	p in styles && (elStyle[p] = styles[p] + "px");
			// });
			// EDIT: by Augus
			// var width = item.el.getAttribute("data-width");
			// var height = item.el.getAttribute("data-height");
			// item.el.setAttribute(`style`, `width: ${styles.width}px; height: ${styles.height}px; left: ${~~(styles.left)}px; top: ${~~(styles.top)}px;`);
			// NOTE: Windwos 如果 translateY 不是 4 倍数，就会变得很模糊
			item.el.setAttribute(`style`, `width: ${parseInt(styles.width / 2) * 2}px; height: ${parseInt(styles.height)}px; transform: ${"translate(" + parseInt(styles.left / 2) * 2 + "px, " + parseInt(styles.top / 2) * 2 + "px)"};`);
			item.el.setAttribute(`posX`, `${parseInt(styles.left / 2) * 2}`);
			item.el.setAttribute(`posY`, `${parseInt(styles.top / 2) * 2}`);
			// item.el.setAttribute(`style`, `width: ${parseInt(styles.width)}px; height: ${parseInt(styles.height)}px; transform: ${"translate(" + styles.left + "px, " + styles.top + "px)"};`);
			// item.el.setAttribute(`posX`, `${styles.left}`);
			// item.el.setAttribute(`posY`, `${styles.top}`);
			// item.el.style.width = styles.width;
			// item.el.style.height = styles.height;
			// item.el.style.transform = "translate3d(" + ~~(styles.left) + "px, " + ~~(styles.top) + "px, 0)";
			// $(item.el).css({
			// 	// position: "absolute",
			// 	width: styles.width,
			// 	height: styles.height,
			// 	transform: "translate3d(" + ~~(styles.left) + "px, " + ~~(styles.top) + "px, 0)"
			// });
		}
	};

	DOMRenderer.renderItems = function renderItems(items) {
		items.forEach(function (item) {
			if (ig._layout.options.column) {
				DOMRenderer.renderItem(item, item.rect);
			}
			else {
				DOMRenderer.renderItem(item, {
					top: item.rect.top,
					left: item.rect.left,
					height: item.size && item.size.height,
					width: item.size && item.size.width,
				});
			}
		});
	};

	DOMRenderer.asyncRemoveItems = function (images) {
		setTimeout(() => {
	        let total = images.length;
	        let once = 50;
	        let loopCount = total / once;
	        let countOfSend = 0;

	        function remove () {
	            var start = countOfSend * once;
	            var willRemoveImages = images.slice(start, start + once);
	            countOfSend += 1;
	            // console.log("正在删除第 %d 批图片", countOfSend);
	            DOMRenderer.removeItems(willRemoveImages);
	            loop();
	        }

	        function loop() {
	            if (countOfSend < loopCount) {
	                window.requestAnimationFrame(remove);
	            }
	        }
	        loop();
	    }, 0);
	};

	DOMRenderer.removeItems = function removeItems(items) {
		requestAnimationFrame(() => {
			// Note: 移除先將 src 清空，強制瀏覽器清除緩存
			for (var i = 0; i < items.length; i++) {
				var item = items[i];
			// items.forEach(function (item) {
				if (item.el) {
					var $el = $(item.el);
					// $.removeData(item.el);
					// $el.find("*").off();
					$el.find("img").off().attr("src" , "");
					$el.off();
					$el.remove();
					$el.removeClass("show");
					delete item.el;
				}
			}
			items = undefined;
		});
	};

	DOMRenderer.removeElement = function removeElement(element) {
		if (element && element.parentNode) {
			element.parentNode.removeChild(element);
		}
	};

	DOMRenderer.createElements = function createElements(items) {
		var elements = (0, _utils.$)(items.reduce(function (acc, v, i) {
			acc.push(v.content.replace(/^[\s\uFEFF]+|[\s\uFEFF]+$/g, ""));
			return acc;
		}, []).join(""), _consts.MULTI);

		return items.map(function (item, index) {
			item.el = elements[index];
			return item;
		});
	};

	function DOMRenderer(element, options) {
		_classCallCheck(this, DOMRenderer);

		_extends(this.options = {
			isOverflowScroll: false,
			isEqualSize: false,
			isVertical: true
		}, options);
		this._size = {
			containerOffset: 0,
			container: -1,
			view: -1,
			item: null
		};
		this._init(element);
		// this.resize();
	}

	DOMRenderer.prototype.getStatus = function getStatus() {
		return {
			cssText: this.container.style.cssText,
			options: _extends({}, this.options),
			_size: _extends({}, this._size)
		};
	};

	DOMRenderer.prototype.setStatus = function setStatus(status, items) {
		this.container.style.cssText = status.cssText;
		_extends(this.options, status.options);
		_extends(this._size, status._size);

		DOMRenderer.renderItems(items);
		this._insert(items, _consts.APPEND);
	};

	DOMRenderer.prototype.updateSize = function updateSize(items) {
		

		var _this = this;
		if (!items[0]) { return; }

		var $scope = $bodyScope || angular.element("body").scope();
		var isGridLayout = $scope.layout === "GridLayout";
		var blockWidth = $scope.imageSize.height;
		var isNameVisible = $scope.showName;
		var isMetasVisible = $scope.showMetas;
		var maxThumbnailHeight = parseInt(4000 * blockWidth / 200);

		var result = items.map(function (item) {
			if (item.el) {

					if ($bodyScope.layout === "ListLayout") {
						let listHeight = Math.max(40, Math.ceil(parseInt(blockWidth / 10) * 10 / 3));
						item.size = {
							width: 10000,
							height: parseInt(listHeight / 2) * 2
						};
						return item;
					}
				// if (_this.options.isEqualSize) {
					// item.size = _extends({}, _this._size.item);
				// } else {

					// var $el = $(item.el);
					var width;
					var height;

					if ($bodyScope.layout === "SquareLayout") {
						width = 200;
						height = 200;
					}
					else {
						width = parseInt(item.el.dataset.width) || 200;
						height = parseInt(item.el.dataset.height) || 200;	
					}

					// var width = $el.data("width") || 200;
					// var height = $el.data("height") || 200;

					// 如果图片超级长，让图片比例维持容易阅读的模式
					if (!isGridLayout) {
						if (height / width >= 3 ) {
							height = width * 3;
						}
					}
					else {
						if (height / width >= 16 ) {
							height = width * 16;	
						}
					}

					height = height / (width / blockWidth);
					if (height > maxThumbnailHeight) height = maxThumbnailHeight;

					var finalHeight = height;
					if (isGridLayout || $bodyScope.layout === "SquareLayout") {
						if (isNameVisible) finalHeight += (23 + 13);
						if (isMetasVisible) finalHeight += 17;
					}
					
					// $el.height(finalHeight);
					// item.content = $el[0].outerHTML;

									// 設置初始尺寸，實際寬度將由 GridLayout 的 checkColumn 和 _layout 函數調整
				item.size = {
					width: blockWidth,
					height: finalHeight
				};
				// }
				// if (!item.orgSize) {
					// item.orgSize = _extends({}, item.size);
					// item.orgSize = item.size;
				// }
			}
			return item;
		});
		// console.timeEnd("infinite:updateSize");
		return result;
	};

	DOMRenderer.prototype._init = function _init(el) {
		var element = (0, _utils.$)(el);
		var style = (0, _utils.getStyles)(element);

		this._orgStyle = {};

		if (style.position === "static") {
			this._orgStyle.position = element.style.position;
			element.style.position = "relative";
		}
		if (this.options.isOverflowScroll) {
			var target = this.options.isVertical ? ["Y", "X"] : ["X", "Y"];

			this._orgStyle.overflowX = element.style.overflowX;
			this._orgStyle.overflowY = element.style.overflowY;
			element.style["overflow" + target[0]] = "scroll";
			element.style["overflow" + target[1]] = "hidden";
			this.view = element;
			// defense code for android < 4.4 or webkit < 537
			this.container = !this.options.isVertical && _consts.DEFENSE_BROWSER ? _defense(element) : element;
		} else {
			// debugger
			// this.view = window;
			this.view = document.getElementById("box-container");
			this.container = element;
		}
	};

	DOMRenderer.prototype.append = function append(items) {
		this._insert(items, _consts.APPEND, {
			top: _consts.DUMMY_POSITION,
			left: _consts.DUMMY_POSITION
		});
	};

	DOMRenderer.prototype.prepend = function prepend(items) {
		this._insert(items, _consts.PREPEND, {
			top: _consts.DUMMY_POSITION,
			left: _consts.DUMMY_POSITION
		});
	};

	function clearChildren (elem) {
		while (elem.firstChild) {
		   elem.removeChild(elem.firstChild);
		}
	}

	DOMRenderer.prototype.clear = function clear() {

		// this.container.innerHTML = "";
		// NOTE: elem.removeChild 比 innerHTML 快很多...
		// 清除 connect 佔用
		this.container.querySelectorAll("img[src]").forEach(function (image) {
			if (!image.complete) {
				image.src = "";
				image.onload = null;
				image.onerror = null;
			}
		});
		clearChildren(this.container);
		// if (!this.options.isOverflowScroll) {
		// 	this.container.style[this.options.isVertical ? "height" : "width"] = "";
		// }
		this._size = {
			item: null,
			containerOffset: 0,
			viewport: -1,
			container: -1,
			view: -1
		};
	};

	DOMRenderer.prototype.createAndInsert = function createAndInsert(items, isAppend) {
		var itemsWithElement = DOMRenderer.createElements(items);

		DOMRenderer.renderItems(itemsWithElement);
		this._insert(itemsWithElement, isAppend);
	};

	DOMRenderer.prototype._insert = function _insert(items, isAppend, styles) {
		var df = document.createDocumentFragment();

		items.forEach(function (item) {
			styles && DOMRenderer.renderItem(item, styles);
			isAppend ? df.appendChild(item.el) : df.insertBefore(item.el, df.firstChild);
		});
		isAppend ? this.container.appendChild(df) : this.container.insertBefore(df, this.container.firstChild);
	};

	DOMRenderer.prototype._calcSize = function _calcSize() {
		return this.options.isVertical ? (0, _utils.innerWidth)(this.container) : (0, _utils.innerHeight)(this.container);
	};

	DOMRenderer.prototype.getViewSize = function getViewSize() {
		return window.innerHeight;
		// return this._size.view;
	};

	DOMRenderer.prototype.scrollBy = function scrollBy(point) {
		var pos = this.options.isVertical ? [0, point] : [point, 0];

		_utils.scrollBy.apply(undefined, [this.view].concat(pos));
	};

	DOMRenderer.prototype.getContainerOffset = function getContainerOffset() {
		return this._size.containerOffset;
	};

	DOMRenderer.prototype.getViewportSize = function getViewportSize() {
		// if (!this._size.viewport) {
		// this.resize();
		// }
		// return this._size.viewport;
		if (!$bodyScope.boxContianerWidth) {
			$bodyScope.boxContianerWidth = $("#box-container").innerWidth() || $bodyScope.boxContianerWidth;
		}

		if ($bodyScope.boxContianerWidth) {
			return $bodyScope.boxContianerWidth - 30;	
		}
		else {
			this.resize();
			return this._size.viewport;
		}
	};

	DOMRenderer.prototype.setContainerSize = function setContainerSize(size) {

		// // Note: 自订一个元件，让它一直处于已经载入内容的最下方，这样就能保持 scrollbar 不会跳动
		// 实验结果：目前架构没办法根据 scrollbar 位置决定内容，所以添加这个功能也没屁用
		// var $container = $("#box-container .box-list");
		// var $boxPlaceholder = $(".box-placeholder");
		// if ($boxPlaceholder.length === 0) {
		// 	console.log("在 %d 插入占位元素", size);
		// 	var $placeholder = $('<div class="box-placeholder""></div>');
		// 	$placeholder.css({
		// 		position: "absolute",
		// 		width: 1,
		// 		height: 1,
		// 		top: size
		// 	});
		// 	$placeholder.prependTo($container);
		// }
		// else {
		// 	var currentTop = parseInt($boxPlaceholder.css("top"));
		// 	if (currentTop < size) {
		// 		console.log("将 placeholder 移动到 %d", size);
		// 		$boxPlaceholder.css({
		// 			top: size
		// 		});
		// 	}
		// }
		// console.log(size);

		// if (!this.options.isOverflowScroll || !this.options.isVertical && _consts.DEFENSE_BROWSER) {
		// 	this.container.style[this.options.isVertical ? "height" : "width"] = size + "px";
		// }
		this.container.style.height = size + "px";
	};

	DOMRenderer.prototype.resize = function resize() {
		var isVertical = this.options.isVertical;

		// if (this.isNeededResize()) {
			this._size = {
				containerOffset: this.options.isOverflowScroll ? 0 : this.container["offset" + (isVertical ? "Top" : "Left")],
				viewport: this._calcSize(),
				view: isVertical ? (0, _utils.innerHeight)(this.view) : (0, _utils.innerWidth)(this.view),
				item: null
			};
			return true;
		// } else {
		// 	this._size.view = isVertical ? (0, _utils.innerHeight)(this.view) : (0, _utils.innerWidth)(this.view);
		// }
		// return false;
	};

	DOMRenderer.prototype.isNeededResize = function isNeededResize() {
		return this._calcSize() !== this._size.viewport;
	};

	DOMRenderer.prototype.destroy = function destroy() {
		this._size = {
			containerOffset: 0,
			viewport: -1,
			view: -1,
			item: null
		};
		// this.container.style[this.options.isVertical ? "height" : "width"] = "";
		// for (var p in this._orgStyle) {
		// 	this[this.options.isOverflowScroll ? "view" : "container"].style[p] = this._orgStyle[p];
		// }
	};

	return DOMRenderer;
}();

exports["default"] = DOMRenderer;
module.exports = exports["default"];

/***/ }),
/* 5 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


exports.__esModule = true;
exports.CHECK_ONLY_ERROR = exports.CHECK_ALL = undefined;

var _consts = __webpack_require__(1);

var _utils = __webpack_require__(0);

var _AutoSizer = __webpack_require__(3);

var _AutoSizer2 = _interopRequireDefault(_AutoSizer);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var CHECK_ALL = exports.CHECK_ALL = 1;
var CHECK_ONLY_ERROR = exports.CHECK_ONLY_ERROR = 2;

var errorImages = [];

function isDataAttribute(target, prefix) {
	return !!target.getAttribute(prefix + "width");
}

var ImageLoaded = function () {
	function ImageLoaded() {
		_classCallCheck(this, ImageLoaded);
	}

	ImageLoaded.waitImageLoaded = function waitImageLoaded(needCheck, _ref) {

		var prefix = _ref.prefix,
		    length = _ref.length,
		    type = _ref.type,
		    complete = _ref.complete,
		    error = _ref.error,
		    end = _ref.end;

		var checkCount = 0;
		var endCount = length || needCheck.reduce(function (sum, element) {
			return sum + element.length;
		}, 0);

		if (type !== CHECK_ONLY_ERROR) {
			checkCount = endCount;
		}
		var checkEnd = function checkEnd() {
			if (--endCount !== 0) {
				return;
			}
			end && end();
		};
		var checkImage = function checkImage() {
			checkCount--;
			if (checkCount !== 0) {
				return;
			}
			complete && complete();
		};
		// var onError = function onError(target) {
		// 	error && error({
		// 		target: target,
		// 		itemIndex: target.__ITEM_INDEX__
		// 	});
		// };
		var onCheck = function onCheck(e) {
			// var target = e.target || e.srcElement;

			// (0, _utils.removeEvent)(target, "error", onCheck);
			// (0, _utils.removeEvent)(target, "load", onCheck);

			// if (type === CHECK_ALL && isDataAttribute(target, prefix)) {
			// 	_AutoSizer2["default"].remove(target, e.type === "error");
			// } else {
				checkImage();
			// }
			// if (e.type === "error") {
			// 	errorImages.push(target.src);
			// 	onError(target);
			// }
			// delete target.__ITEM_INDEX__;
			checkEnd();
		};

		needCheck.forEach(function (images, i) {
			images.forEach(function (v) {
				// workaround for IE
				// if (v.complete) {
				// 	if (errorImages.indexOf(v.src) !== -1) {
				// 		onError(v);
				// 	}
				// 	checkImage();
				// 	checkEnd();
				// 	return;
				// }
				// v.__ITEM_INDEX__ = i;
				// if (type === CHECK_ALL && isDataAttribute(v, prefix)) {
				// 	_AutoSizer2["default"].add(v, prefix);
				// 	checkImage();
				// }
				// (0, _utils.addEvent)(v, "load", onCheck);
				// (0, _utils.addEvent)(v, "error", onCheck);
				// setTimeout(function () {
				onCheck();
				// }, 10);

				// _consts.IS_IE && v.setAttribute("src", v.getAttribute("src"));
			});
		});
	};

	ImageLoaded.checkImageLoaded = function checkImageLoaded(el) {
		if (el.tagName === "IMG") {
			return !el.complete ? [el] : [];
		} else {
			return (0, _utils.toArray)(el.querySelectorAll("img"));
		}
	};

	ImageLoaded.check = function check(elements, _ref2) {
	   	_ref2.complete && _ref2.complete();
		_ref2.end && _ref2.end();
	};

	return ImageLoaded;
}();

exports["default"] = ImageLoaded;

/***/ }),
/* 6 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


exports.__esModule = true;

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _consts = __webpack_require__(1);

var _utils = __webpack_require__(0);

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function disableFrame(frame, type, x, y, width, height) {
	for (var i = y; i < y + height; ++i) {
		for (var j = x; j < x + width; ++j) {
			if (type !== frame[i][j]) {
				continue;
			}
			frame[i][j] = 0;
		}
	}
}
function searchShapeInFrame(frame, type, top, left, width, height) {
	var size = {
		left: left,
		top: top,
		type: type,
		width: 1,
		height: 1
	};

	for (var i = left; i < width; ++i) {
		if (frame[top][i] === type) {
			size.width = i - left + 1;
			continue;
		}
		break;
	}
	for (var _i = top; _i < height; ++_i) {
		if (frame[_i][left] === type) {
			size.height = _i - top + 1;
			continue;
		}
		break;
	}
	// After finding the shape, it will not find again.
	disableFrame(frame, type, left, top, size.width, size.height);
	return size;
}
function getShapes(frame) {
	var height = frame.length;
	var width = height ? frame[0].length : 0;
	var shapes = [];

	for (var i = 0; i < height; ++i) {
		for (var j = 0; j < width; ++j) {
			var type = frame[i][j];

			if (!type) {
				continue;
			}
			// Separate shapes with other numbers.
			shapes.push(searchShapeInFrame(frame, type, i, j, width, height));
		}
	}
	shapes.sort(function (a, b) {
		return a.type < b.type ? -1 : 1;
	});
	return {
		shapes: shapes,
		width: width,
		height: height
	};
}

var FrameLayout = function () {
	function FrameLayout() {
		var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

		_classCallCheck(this, FrameLayout);

		this.options = (0, _utils.assignOptions)({
			itemSize: 0,
			frame: [],
			frameFill: true
		}, options);
		var frame = this.options.frame.map(function (row) {
			return row.slice();
		});
		// divide frame into shapes.
		var shapes = getShapes(frame);

		this._itemSize = this.options.itemSize || 0;
		this._shapes = shapes;
		this._size = 0;
		this._style = (0, _utils.getStyleNames)(this.options.horizontal);
	}

	FrameLayout.prototype._getItemSize = function _getItemSize() {
		this._checkItemSize();

		return this._itemSize;
	};

	FrameLayout.prototype._checkItemSize = function _checkItemSize() {
		if (this.options.itemSize) {
			this._itemSize = this.options.itemSize;
			return;
		}
		var style = this._style;
		var size = style.size2;
		var margin = this.options.margin;

		// if itemSize is not in options, caculate itemSize from size.
		this._itemSize = (this._size + margin) / this._shapes[size] - margin;
	};

	FrameLayout.prototype._layout = function _layout(items) {
		var outline = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : [];
		var isAppend = arguments[2];

		var length = items.length;
		var style = this._style;
		var _options = this.options,
		    margin = _options.margin,
		    frameFill = _options.frameFill;

		var size1Name = style.size1;
		var size2Name = style.size2;
		var pos1Name = style.pos1;
		var pos2Name = style.pos2;
		var itemSize = this._getItemSize();
		var isItemObject = (typeof itemSize === "undefined" ? "undefined" : _typeof(itemSize)) === "object";
		var itemSize2 = isItemObject ? itemSize[size2Name] : itemSize;
		var itemSize1 = isItemObject ? itemSize[size1Name] : itemSize;
		var shapesSize = this._shapes[size2Name];
		var shapes = this._shapes.shapes;
		var shapesLength = shapes.length;
		var startOutline = (0, _utils.fill)(new Array(shapesSize), _consts.DUMMY_POSITION);
		var endOutline = (0, _utils.fill)(new Array(shapesSize), _consts.DUMMY_POSITION);
		var dist = 0;
		var end = 0;
		var startIndex = -1;
		var endIndex = -1;
		var minPos = -1;
		var maxPos = -1;

		if (!shapesLength) {
			return { start: outline, end: outline, startIndex: startIndex, endIndex: endIndex };
		}
		for (var i = 0; i < length; i += shapesLength) {
			for (var j = 0; j < shapesLength && i + j < length; ++j) {
				var _item$rect;

				var item = items[i + j];
				var shape = shapes[j];
				var shapePos1 = shape[pos1Name];
				var shapePos2 = shape[pos2Name];
				var shapeSize1 = shape[size1Name];
				var shapeSize2 = shape[size2Name];
				var pos1 = end - dist + shapePos1 * (itemSize1 + margin);
				var pos2 = shapePos2 * (itemSize2 + margin);
				var size1 = shapeSize1 * (itemSize1 + margin) - margin;
				var size2 = shapeSize2 * (itemSize2 + margin) - margin;

				for (var k = shapePos2; k < shapePos2 + shapeSize2 && k < shapesSize; ++k) {
					if (startOutline[k] === _consts.DUMMY_POSITION) {
						startOutline[k] = pos1;
					}
					if (startIndex === -1) {
						minPos = pos1;
						startIndex = i + j;
						maxPos = pos1 + size1 + margin;
						endIndex = i + j;
					}
					if (minPos > pos1) {
						minPos = pos1;
						startIndex = i + j;
					}
					if (maxPos < pos1 + size1 + margin) {
						maxPos = pos1 + size1 + margin;
						endIndex = i + j;
					}
					startOutline[k] = Math.min(startOutline[k], pos1);
					endOutline[k] = Math.max(endOutline[k], pos1 + size1 + margin);
				}
				item.rect = (_item$rect = {}, _item$rect[pos1Name] = pos1, _item$rect[pos2Name] = pos2, _item$rect[size1Name] = size1, _item$rect[size2Name] = size2, _item$rect);
			}
			end = Math.max.apply(Math, endOutline);
			// check dist once
			if (i !== 0) {
				continue;
			}
			// find & fill empty block
			if (!frameFill) {
				dist = 0;
				continue;
			}
			dist = end;

			for (var _j = 0; _j < shapesSize; ++_j) {
				if (startOutline[_j] === _consts.DUMMY_POSITION) {
					continue;
				}
				// the dist between frame's end outline and next frame's start outline
				// expect that next frame's start outline is startOutline[j] + end
				dist = Math.min(startOutline[_j] + end - endOutline[_j], dist);
			}
		}
		for (var _i2 = 0; _i2 < shapesSize; ++_i2) {
			if (startOutline[_i2] !== _consts.DUMMY_POSITION) {
				continue;
			}
			startOutline[_i2] = Math.max.apply(Math, startOutline);
			endOutline[_i2] = startOutline[_i2];
		}
		// The target outline is start outline when type is APPENDING
		var targetOutline = isAppend ? startOutline : endOutline;
		var prevOutlineEnd = outline.length === 0 ? 0 : Math[isAppend ? "max" : "min"].apply(Math, outline);
		var prevOutlineDist = isAppend ? 0 : end;

		if (frameFill && outline.length === shapesSize) {
			prevOutlineDist = -_consts.DUMMY_POSITION;
			for (var _i3 = 0; _i3 < shapesSize; ++_i3) {
				if (startOutline[_i3] === endOutline[_i3]) {
					continue;
				}
				// if appending type is PREPEND, subtract dist from appending group's height.

				prevOutlineDist = Math.min(targetOutline[_i3] + prevOutlineEnd - outline[_i3], prevOutlineDist);
			}
		}
		for (var _i4 = 0; _i4 < shapesSize; ++_i4) {
			startOutline[_i4] += prevOutlineEnd - prevOutlineDist;
			endOutline[_i4] += prevOutlineEnd - prevOutlineDist;
		}
		items.forEach(function (item) {
			item.rect[pos1Name] += prevOutlineEnd - prevOutlineDist;
		});
		return {
			start: startOutline,
			end: endOutline,
			startIndex: startIndex,
			endIndex: endIndex
		};
	};

	FrameLayout.prototype._insert = function _insert(items, outline, type) {
		// this only needs the size of the item.
		var clone = items.map(function (item) {
			return _extends({}, item);
		});

		return {
			items: clone,
			outlines: this._layout(clone, outline, type)
		};
	};

	FrameLayout.prototype.layout = function layout(groups, outlines) {
		var length = groups.length;
		var point = outlines;

		for (var i = 0; i < length; ++i) {
			var group = groups[i];

			point = this._layout(group.items, point, _consts.APPEND);
			group.outlines = point;
			point = point.end;
		}
		return this;
	};

	FrameLayout.prototype.setSize = function setSize(size) {
		this._size = size;
		return this;
	};

	FrameLayout.prototype.append = function append(items, outline) {
		return this._insert(items, outline, _consts.APPEND);
	};

	FrameLayout.prototype.prepend = function prepend(items, outline) {
		return this._insert(items, outline, _consts.PREPEND);
	};

	return FrameLayout;
}();

exports["default"] = FrameLayout;
module.exports = exports["default"];

/***/ }),
/* 7 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var _InfiniteGrid = __webpack_require__(8);

var _InfiniteGrid2 = _interopRequireDefault(_InfiniteGrid);

var _GridLayout = __webpack_require__(12);

var _GridLayout2 = _interopRequireDefault(_GridLayout);

var _FrameLayout = __webpack_require__(6);

var _FrameLayout2 = _interopRequireDefault(_FrameLayout);

var _SquareLayout = __webpack_require__(13);

var _SquareLayout2 = _interopRequireDefault(_SquareLayout);

var _PackingLayout = __webpack_require__(14);

var _PackingLayout2 = _interopRequireDefault(_PackingLayout);

var _JustifiedLayout = __webpack_require__(16);

var _JustifiedLayout2 = _interopRequireDefault(_JustifiedLayout);

var _ImageLoaded = __webpack_require__(5);

var _ImageLoaded2 = _interopRequireDefault(_ImageLoaded);

var _AutoSizer = __webpack_require__(3);

var _AutoSizer2 = _interopRequireDefault(_AutoSizer);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

/**
 * Copyright (c) NAVER Corp.
 * egjs-infinitegrid projects are licensed under the MIT license
 */
_InfiniteGrid2["default"].GridLayout = _GridLayout2["default"];
_InfiniteGrid2["default"].FrameLayout = _FrameLayout2["default"];
_InfiniteGrid2["default"].SquareLayout = _SquareLayout2["default"];
_InfiniteGrid2["default"].PackingLayout = _PackingLayout2["default"];
_InfiniteGrid2["default"].JustifiedLayout = _JustifiedLayout2["default"];
_InfiniteGrid2["default"].ImageLoaded = _ImageLoaded2["default"];
_InfiniteGrid2["default"].AutoSizer = _AutoSizer2["default"];

module.exports = _InfiniteGrid2["default"];

/***/ }),
/* 8 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


exports.__esModule = true;

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; /**
                                                                                                                                                                                                                                                                               * Copyright (c) 2017 NAVER Corp.
                                                                                                                                                                                                                                                                               * egjs projects are licensed under the MIT license
                                                                                                                                                                                                                                                                              */


var _component = __webpack_require__(9);

var _component2 = _interopRequireDefault(_component);

var _ItemManager = __webpack_require__(10);

var _ItemManager2 = _interopRequireDefault(_ItemManager);

var _DOMRenderer = __webpack_require__(4);

var _DOMRenderer2 = _interopRequireDefault(_DOMRenderer);

var _ImageLoaded = __webpack_require__(5);

var _ImageLoaded2 = _interopRequireDefault(_ImageLoaded);

var _Watcher = __webpack_require__(11);

var _Watcher2 = _interopRequireDefault(_Watcher);

var _AutoSizer = __webpack_require__(3);

var _AutoSizer2 = _interopRequireDefault(_AutoSizer);

var _consts = __webpack_require__(1);

var _utils = __webpack_require__(0);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

// IE8
// https://stackoverflow.com/questions/43216659/babel-ie8-inherit-issue-with-object-create
/* eslint-disable */
if (typeof Object.create !== "function") {
	Object.create = function (o, properties) {
		if ((typeof o === "undefined" ? "undefined" : _typeof(o)) !== "object" && typeof o !== "function") {
			throw new TypeError("Object prototype may only be an Object: " + o);
		} else if (o === null) {
			throw new Error("This browser's implementation of Object.create is a shim and doesn't support 'null' as the first argument.");
		}
		function F() {}
		F.prototype = o;
		return new F();
	};
}
/* eslint-enable */

function hasTarget() {
	for (var _len = arguments.length, targets = Array(_len), _key = 0; _key < _len; _key++) {
		targets[_key] = arguments[_key];
	}

	return targets.every(function (target) {
		return ~target[0].indexOf(target[1]);
	});
}

var InfiniteGrid = function (_Component) {
	_inherits(InfiniteGrid, _Component);

	function InfiniteGrid(element, options) {
		_classCallCheck(this, InfiniteGrid);

		var _this = _possibleConstructorReturn(this, _Component.call(this));

		_extends(_this.options = {
			itemSelector: "*",
			isOverflowScroll: false,
			threshold: 1000,
			isEqualSize: false,
			useRecycle: true,
			horizontal: false,
			attributePrefix: "data-"
		}, options);
		_consts.IS_ANDROID2 && (_this.options.isOverflowScroll = false);
		_this._isVertical = !_this.options.horizontal;
		_this._reset();
		_this._items = new _ItemManager2["default"]();
		_this._renderer = new _DOMRenderer2["default"](element, {
			isOverflowScroll: _this.options.isOverflowScroll,
			isEqualSize: _this.options.isEqualSize,
			isVertical: _this._isVertical
		});
		_this._loadingBar = {};
		_this._watcher = new _Watcher2["default"](_this._renderer, {
			layout: function layout() {
				return _this.layout();
			},
			check: function check(param) {
				return _this._onCheck(param);
			}
		});
		return _this;
	}

	InfiniteGrid.prototype.append = function append(elements, groupKey) {
		this._layout && this._insert(elements, _consts.APPEND, groupKey);
		return this;
	};

	InfiniteGrid.prototype.prepend = function prepend(elements, groupKey) {
		this._layout && this._insert(elements, _consts.PREPEND, groupKey);
		return this;
	};

	InfiniteGrid.prototype.setLayout = function setLayout(LayoutKlass, options) {
		if (typeof LayoutKlass === "function") {
			this._layout = new LayoutKlass(_extends(options || {}, {
				horizontal: !this._isVertical
			}));
		} else {
			this._layout = LayoutKlass;
			this._layout.options.horizontal = !this._isVertical;
		}
		this._layout.setSize(this._renderer.getViewportSize());
		return this;
	};

	InfiniteGrid.prototype.getItems = function getItems() {
		var includeCached = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : false;

		return this[includeCached ? "_getItems" : "_getVisibleItems"]();
	};

	InfiniteGrid.prototype._getItems = function _getItems() {
		return this._items.pluck("items", 0, this._items.size());
	};

	InfiniteGrid.prototype._getVisibleItems = function _getVisibleItems() {
		return this._items.pluck("items", this._status.startCursor, this._status.endCursor);
	};

	InfiniteGrid.prototype._updateEdge = function _updateEdge() {
		this._status.start = this._items.getEdge("start", this._status.startCursor, this._status.endCursor);
		this._status.end = this._items.getEdge("end", this._status.startCursor, this._status.endCursor);
	};

	InfiniteGrid.prototype._getEdgeOffset = function _getEdgeOffset(cursor) {
		var rect = null;

		if (!this._status[cursor]) {
			var item = this._items.getEdge(cursor);

			this._status[cursor] = item;
		}

		if (this._status[cursor]) {
			rect = this._status[cursor].rect;
			if (cursor === "start") {
				rect.bottom = rect.top + this._status[cursor].size.height;
				rect.right = rect.left + this._status[cursor].size.width;
			}
		}
		return rect;
	};
	// called by visible


	InfiniteGrid.prototype._fit = function _fit() {

		var scrollCycle = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : "after";

		// for caching
		if (!this._layout) {
			return 0;
		}
		var base = this._getEdgeValue("start");
		var margin = this._getLoadingStatus() === _consts.LOADING_PREPEND && this._status.loadingSize || 0;

		if (!this.options.useRecycle || _consts.DEFENSE_BROWSER) {
			if (scrollCycle === "before" && margin && base < margin) {
				this._renderer.scrollBy(-Math.abs(base) + margin);
				this._watcher.setScrollPos();
				this._items.fit(base - margin, this._isVertical);
				_DOMRenderer2["default"].renderItems(this._getVisibleItems());
				this._renderer.setContainerSize(this._getEdgeValue("end") || margin);
			} else if (scrollCycle === "after" && base < 0) {
				this._items.fit(base - margin, this._isVertical);
				this._renderer.setContainerSize(this._getEdgeValue("end") || margin);
				_DOMRenderer2["default"].renderItems(this._getVisibleItems());
				this._renderer.scrollBy(Math.abs(base));
				this._watcher.setScrollPos();
			}
			return 0;
		}

		if (base !== 0 || margin) {
			var isProcessing = this._isProcessing();

			this._process(_consts.PROCESSING);
			if (scrollCycle === "before") {
				this._renderer.scrollBy(-Math.abs(base) + margin);
				this._watcher.setScrollPos();
			}
			this._items.fit(base - margin, this._isVertical);
			_DOMRenderer2["default"].renderItems(this._getVisibleItems());
			this._renderer.setContainerSize(this._getEdgeValue("end") || margin);
			if (scrollCycle === "after") {
				this._renderer.scrollBy(Math.abs(base) + margin);
				this._watcher.setScrollPos();
			}
			if (!isProcessing) {
				this._process(_consts.PROCESSING, false);
			}
		}
		return base;
	};

	InfiniteGrid.prototype._getEdgeValue = function _getEdgeValue(cursor) {
		return this._items.getEdgeValue(cursor, this._status.startCursor, this._status.endCursor);
	};

	InfiniteGrid.prototype.layout = function layout() {
		var _this2 = this;

		var isRelayout = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : true;

		if (!this._layout) {
			return this;
		}
		// check childElement
		if (!this._items.size()) {
			this._insert((0, _utils.toArray)(this._renderer.container.children), true);
			return this;
		}
		var data = void 0;
		var outline = void 0;

		if (isRelayout) {
			// remove cache
			if (this.options.isEqualSize) {
				this._renderer.updateSize([this._status.start]);
				data = this._items.get(0, this._status.endCursor);
				// outline = this._items.getOutline(0, "start");
			} else {
				data = this._items.get(this._status.startCursor, this._status.endCursor);
			}
			// if (this._renderer.resize()) {
				this._layout.setSize(this._renderer.getViewportSize());
				data.forEach(function (v) {
					data.items = _this2._renderer.updateSize(v.items);
				});
			// }
		} else {
			data = this._items.get(this._status.startCursor, this._items.size());
			// outline = this._items.getOutline(this._status.startCursor, "start");
		}
		if (!data.length) {
			return this;
		}

		this._layout.layout(data, outline);

		if (isRelayout) {
			if (!this.options.isEqualSize) {
				this._items._data.forEach(function (group, cursor) {
					if (_this2._status.startCursor <= cursor && cursor <= _this2._status.endCursor) {
						return;
					}
					group.outlines.start = [];
					group.outlines.end = [];
				});
			} else {
				this._fit("after");
			}
		} else {
			data.forEach(function (v) {
				return _this2._items.set(v, v.groupKey);
			});
		}

		// this._onLayoutComplete(data, _consts.APPEND, _consts.NO_TRUSTED, false, true);
		// if (data.length && data.length > 0) {
		// 	var items = [];
		// 	data.forEach(function (da) {
		// 		items = items.concat(da.items);
		// 	});
		// 	// this._onLayoutComplete(items, _consts.APPEND, _consts.NO_TRUSTED, false, true);
		// }
		// else {
			// this._onLayoutComplete(data.items, _consts.APPEND, _consts.NO_TRUSTED, false, true);
		// }
		_DOMRenderer2["default"].renderItems(this._getVisibleItems());
		// isRelayout && this._watcher.setScrollPos();

		return this;
	};

	InfiniteGrid.prototype.remove = function remove(element) {
		if (element) {
			var items = this._items.remove(element, this._status.startCursor, this._status.endCursor);
			if (items) {
				_DOMRenderer2["default"].removeElement(element);
				return items;
			}
		}
		return null;
	};

	InfiniteGrid.prototype.moveElementsBefore = function moveElementsBefore(elements, target, isAppend) {
		if (elements) {
			for (var i = elements.length - 1; i >= 0; i--) {
				ig.remove(elements[i]);
			}
			var items = this._items.moveElementsBefore(target, this._status.startCursor, this._status.endCursor, elements, isAppend);
			if (items) {
				ig._renderer.updateSize(items);
				ig.layout(false);
				return items;
			}
		}
		return null;
	};

	InfiniteGrid.prototype._getNextItems = function _getNextItems(isAppend) {
		var items = [];
		var size = this._items.size();

		// from cache
		if (size > 0 && this._status.startCursor !== -1 && this._status.endCursor !== -1) {
			if (isAppend && size > this._status.endCursor + 1) {
				items = this._items.pluck("items", this._status.endCursor + 1);
			} else if (!isAppend && this._status.startCursor > 0) {
				items = this._items.pluck("items", this._status.startCursor - 1);
			}
		}
		return items;
	};

	InfiniteGrid.prototype.getGroupKeys = function getGroupKeys(includeCached) {
		var data = includeCached ? this._items.get() : this._items.get(this._status.startCursor, this._status.endCursor);

		return data.map(function (v) {
			return v.groupKey;
		});
	};

	InfiniteGrid.prototype.getStatus = function getStatus() {
		return {
			options: _extends({}, this.options),
			_status: _extends({}, this._status),
			_items: this._items.getStatus(),
			_renderer: this._renderer.getStatus(),
			_watcher: this._watcher.getStatus()
		};
	};

	InfiniteGrid.prototype.setStatus = function setStatus(status) {
		var applyScrollPos = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : true;

		if (!status || !status.options || !status._status || !status._renderer || !status._items || !status._watcher) {
			return this;
		}
		this._watcher.detachEvent();
		_extends(this.options, status.options);
		_extends(this._status, status._status);
		this._items.setStatus(status._items, this._status.startCursor, this._status.endCursor);
		this._renderer.setStatus(status._renderer, this._getVisibleItems());
		this._watcher.setStatus(status._watcher, applyScrollPos);
		this._updateEdge();
		this._watcher.attachEvent();
		return this;
	};

	InfiniteGrid.prototype.clear = function clear() {
		this._items.clear();
		this._renderer.clear();
		this._reset();
		this._appendLoadingBar();
		return this;
	};

	InfiniteGrid.prototype.setLoadingBar = function setLoadingBar() {
		var userLoadingBar = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

		var loadingBarObj = (typeof userLoadingBar === "undefined" ? "undefined" : _typeof(userLoadingBar)) === "object" ? userLoadingBar : {
			"append": userLoadingBar,
			"prepend": userLoadingBar
		};

		this._status.loadingSize = 0;
		this._status.loadingStyle = {};
		var loadingBar = this._loadingBar;

		for (var type in loadingBarObj) {
			loadingBar[type] = (0, _utils.$)(loadingBarObj[type]);
			loadingBar[type].className += " " + _consts.IGNORE_CLASSNAME;
		}
		this._appendLoadingBar();
		return this;
	};

	InfiniteGrid.prototype._appendLoadingBar = function _appendLoadingBar() {
		var loadingBar = this._loadingBar;
		var container = this._renderer.container;

		for (var type in loadingBar) {
			container.appendChild(loadingBar[type]);
		}
	};

	InfiniteGrid.prototype.isProcessing = function isProcessing() {
		return this._isProcessing() || this._isLoading();
	};

	InfiniteGrid.prototype._isProcessing = function _isProcessing() {
		return (this._status.processingStatus & _consts.PROCESSING) > 0;
	};

	InfiniteGrid.prototype._isLoading = function _isLoading() {
		return false;
		// return this._getLoadingStatus() > 0;
	};

	InfiniteGrid.prototype._getLoadingStatus = function _getLoadingStatus() {
		return this._status.processingStatus & (_consts.LOADING_APPEND | _consts.LOADING_PREPEND);
	};

	InfiniteGrid.prototype._process = function _process(status) {
		var isAdd = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : true;

		if (isAdd) {
			this._status.processingStatus |= status;
		} else {
			this._status.processingStatus -= this._status.processingStatus & status;
		}
	};

	InfiniteGrid.prototype._insert = function _insert(elements, isAppend, groupKey) {
		if (this._isProcessing() || (elements && elements.length === 0) ) {
			return;
		}

		// Note: 避免插入已存在的内容
		if (groupKey) {
			var groupKeys = ig.getGroupKeys();
			if (groupKeys.indexOf(groupKey) > -1) {
				// console.log(`重复插入${groupKey}`);
				return;
			}
		}


		var key = typeof groupKey === "undefined" ? new Date().getTime() + Math.floor(Math.random() * 1000) : groupKey;
		var items = _ItemManager2["default"].from((0, _utils.$)(elements, true), this.options.itemSelector, {
			isAppend: isAppend,
			groupKey: key
		});

		if (!items.length) {
			return;
		}
		this._postLayout(_consts.NO_CACHE, items, isAppend, _consts.NO_TRUSTED);
	};
	// add items, and remove items for recycling

	InfiniteGrid.prototype._recycle = function _recycle(isAppend, ignoreLimit) {

		if (ig.getItems().length <= 300) {
		// if (ig.getItems().length <= 420) {
			// console.log("ignore");
			return;
		}
		// else {
			// console.log("recycling");
		// }

		var remove = [];

		if (this._status.startCursor !== this._status.endCursor) {
			for (var i = this._status.startCursor; i <= this._status.endCursor; i++) {
				remove.push(this._isVisible(i));
			}
		}

		var start = remove.indexOf(isAppend ? 1 : -1);
		var end = remove.lastIndexOf(isAppend ? 1 : -1);
		var visible = remove.indexOf(0);

		if (visible === -1 || start === -1 || end === -1) {
			return;
		}

		start = this._status.startCursor + (isAppend ? 0 : start);
		end = isAppend ? this._status.startCursor + end : this._status.endCursor;
		var removeItems = this._items.pluck("items", start, end);

		_DOMRenderer2["default"].removeItems(removeItems);
		// _DOMRenderer2["default"].asyncRemoveItems(removeItems);
		if (isAppend) {
			this._status.startCursor = end + 1;
		} else {
			this._status.endCursor = start - 1;
		}

	};

	InfiniteGrid.prototype.getLoadingBar = function getLoadingBar() {
		var isAppend = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : this._getLoadingStatus() !== _consts.LOADING_PREPEND;

		return this._loadingBar[isAppend ? "append" : "prepend"];
	};

	InfiniteGrid.prototype.startLoading = function startLoading(isAppend) {
		var userStyle = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : { display: "block" };

		if (this._isLoading()) {
			return this;
		}
		var type = isAppend ? "append" : "prepend";

		this._process(isAppend ? _consts.LOADING_APPEND : _consts.LOADING_PREPEND);
		if (!this._loadingBar[type]) {
			return this;
		}
		this._renderLoading(userStyle);
		this._status.loadingStyle = userStyle;
		if (!isAppend) {
			this._fit("before");
		} else {
			this._renderer.setContainerSize(this._getEdgeValue("end") + this._status.loadingSize);
		}
		return this;
	};

	InfiniteGrid.prototype._renderLoading = function _renderLoading() {
		var _extends2;

		var userStyle = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : this._status.loadingStyle;

		if (!this._isLoading()) {
			return;
		}
		var isAppend = this._getLoadingStatus() === _consts.LOADING_APPEND;
		var el = this._loadingBar[isAppend ? "append" : "prepend"];

		if (!el) {
			return;
		}
		this._status.loadingSize = this._isVertical ? (0, _utils.innerHeight)(el) : (0, _utils.innerWidth)(el);
		var pos = isAppend ? this._getEdgeValue("end") : this._getEdgeValue("start") - this._status.loadingSize;
		var style = _extends((_extends2 = {
			position: "absolute"
		}, _extends2[this._isVertical ? "top" : "left"] = pos + "px", _extends2), userStyle);

		for (var property in style) {
			el.style[property] = style[property];
		}
	};

	InfiniteGrid.prototype.endLoading = function endLoading() {
		var _extends3;

		var userStyle = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : { display: "none" };

		if (!this._isLoading()) {
			return this;
		}
		var isAppend = this._getLoadingStatus() === _consts.LOADING_APPEND;
		var type = isAppend ? "append" : "prepend";
		var el = this._loadingBar[type];
		var size = this._status.loadingSize;

		this._process(_consts.LOADING_APPEND | _consts.LOADING_PREPEND, false);
		this._status.loadingSize = 0;
		this._status.loadingStyle = {};
		if (!el) {
			return this;
		}
		var style = _extends((_extends3 = {}, _extends3[this._isVertical ? "top" : "left"] = -size + "px", _extends3), userStyle);

		for (var property in style) {
			el.style[property] = style[property];
		}
		if (!isAppend && this.options.useRecycle && !_consts.DEFENSE_BROWSER) {
			this._renderer.scrollBy(-size);
			this._watcher.setScrollPos();
			this._items.fit(size, this._isVertical);
			_DOMRenderer2["default"].renderItems(this._getVisibleItems());
			this._renderer.setContainerSize(this._getEdgeValue("end"));
		}
		this._renderer.setContainerSize(this._getEdgeValue("end"));
		return this;
	};

	InfiniteGrid.prototype._postImageLoaded = function _postImageLoaded(fromCache, layouted, isAppend, isTrusted) {
		if (fromCache) {
			this._setItems(layouted);
		} else {
			this._insertItems(layouted, isAppend);
		}
		this._updateCursor(isAppend);
		_DOMRenderer2["default"].renderItems(layouted.items);
		this._onLayoutComplete(layouted.items, isAppend, isTrusted, false);
	};

	InfiniteGrid.prototype._onImageError = function _onImageError(target, item, itemIndex, removeTarget, replaceTarget) {
		var element = item.el;
		var prefix = this.options.attributePrefix;

		item.content = element.outerHTML;

		var removeItem = function removeItem() {
			if (hasTarget([removeTarget, element])) {
				return;
			}
			removeTarget.push(element);
			var index = replaceTarget.indexOf(itemIndex);

			if (index !== -1) {
				replaceTarget.splice(index, 1);
			}
		};

		this.trigger("imageError", {
			target: target,
			element: element,
			item: item,
			itemIndex: itemIndex,
			// remove item
			removeItem: removeItem,
			// remove image
			remove: function remove() {
				if (target === element) {
					removeItem();
					return;
				}
				if (hasTarget([removeTarget, element])) {
					return;
				}
				target.parentNode.removeChild(target);
				item.content = element.outerHTML;
				if (hasTarget([replaceTarget, itemIndex])) {
					return;
				}
				replaceTarget.push(itemIndex);
			},
			// replace image
			replace: function replace(src) {
				if (hasTarget([removeTarget, element])) {
					return;
				}
				if (src) {
					if ((0, _utils.matchHTML)(src) || (typeof src === "undefined" ? "undefined" : _typeof(src)) === "object") {
						var parentNode = target.parentNode;

						parentNode.insertBefore((0, _utils.$)(src), target);
						parentNode.removeChild(target);
						item.content = element.outerHTML;
					} else {
						target.src = src;
						if (target.getAttribute(prefix + "width")) {
							_AutoSizer2["default"].remove(target);
							target.removeAttribute(prefix + "width");
							target.removeAttribute(prefix + "height");
						}
					}
				}
				item.content = element.outerHTML;
				if (hasTarget([replaceTarget, itemIndex])) {
					return;
				}
				replaceTarget.push(itemIndex);
			},
			// replace item
			replaceItem: function replaceItem(content) {
				if (hasTarget([removeTarget, element], [replaceTarget, itemIndex])) {
					return;
				}
				element.innerHTML = content;
				item.content = element.outerHTML;
				replaceTarget.push(itemIndex);
			}
		});
	};

	InfiniteGrid.prototype._postImageLoadedEnd = function _postImageLoadedEnd(layouted, isAppend, removeTarget, replaceTarget) {

		// Note: 這一段主要處理回收機制，scrollbar 跳動也是出現在這裡

		var _this3 = this;

		if (!removeTarget.length && !replaceTarget.length) {
			if (this.options.useRecycle) {
			// if (!this.isProcessing() && this.options.useRecycle) {
				this._recycle(isAppend);
			}
			return;
		}
		var prefix = this.options.attributePrefix;
		var layoutedItems = replaceTarget.map(function (itemIndex) {
			return layouted.items[itemIndex];
		});

		removeTarget.forEach(function (element) {
			_this3.remove(element);
		});
		if (this.options.isEqualSize) {
			if (removeTarget.length > 0) {
				this.layout(false);
			// } else if (!this.isProcessing() && this.options.useRecycle) {
			} else if (this.options.useRecycle) {
				this._recycle(isAppend);
			}
			return;
		}
		// wait layoutComplete beacause of error event.
		_ImageLoaded2["default"].check(layoutedItems.map(function (v) {
			return v.el;
		}), {
			prefix: prefix,
			complete: function complete() {
				_this3._renderer.updateSize(layoutedItems);
				_this3.layout(false);
			}
		});
	};

	InfiniteGrid.prototype._postLayout = function _postLayout(fromCache, items, isAppend, isTrusted) {
		var _this4 = this;

		var _status = this._status,
		    startCursor = _status.startCursor,
		    endCursor = _status.endCursor;

		var outline = this._items.getOutline(isAppend ? endCursor : startCursor, isAppend ? "end" : "start");

		var fromRelayout = false;

		if (fromCache) {
			var cacheOutline = this._items.getOutline(isAppend ? endCursor + 1 : startCursor - 1, isAppend ? "start" : "end");

			fromRelayout = outline.length === cacheOutline.length ? !outline.every(function (v, index) {
				return v === cacheOutline[index];
			}) : true;

			if (!fromRelayout) {
				this._renderer.createAndInsert(items, isAppend);
				this._updateCursor(isAppend);
				this._onLayoutComplete(items, isAppend, isTrusted);
				return this;
			}
		}
		this._process(_consts.PROCESSING);
		var method = isAppend ? "append" : "prepend";

		fromCache && _DOMRenderer2["default"].createElements(items);
		this._renderer[method](items);

		// check image sizes after elements are attated on DOM
		// var type = this.options.isEqualSize && this._renderer._size.item ? _ImageLoaded.CHECK_ONLY_ERROR : _ImageLoaded.CHECK_ALL;
		// var prefix = this.options.attributePrefix;
		var replaceTarget = [];
		var removeTarget = [];
		var layouted = void 0;
		
		// console.time("infinite:complete");
		// _ImageLoaded2["default"].check(items.map(function (item) {
		// 	return item.el;
		// }), {
		// 	prefix: prefix,
		// 	type: type,
		// 	complete: function complete() {
			// requestAnimationFrame(() => {
				// console.time("infinite:layouted");
				layouted = _this4._layout[method](_this4._renderer.updateSize(items), _this4._items.getOutline(isAppend ? endCursor : startCursor, isAppend ? "end" : "start"));
				// console.timeEnd("infinite:layouted");
				// console.time("infinite:_postImageLoaded");
				_this4._postImageLoaded(fromCache, layouted, isAppend, isTrusted);
				// console.timeEnd("infinite:_postImageLoaded");
				// console.timeEnd("infinite:complete");
			// },
			// error: function error(_ref) {
			// 	var target = _ref.target,
			// 	    itemIndex = _ref.itemIndex;

			// 	var item = (layouted && layouted.items || items)[itemIndex];

			// 	_this4._onImageError(target, item, itemIndex, removeTarget, replaceTarget);
			// },
			// end: function end() {
				_this4._postImageLoadedEnd(layouted, isAppend, removeTarget, replaceTarget);
			// }
			// });
		// });
		return this;
	};

	InfiniteGrid.prototype._isVisible = function _isVisible(index) {
		var min = Math.min.apply(Math, this._items.getOutline(index, "start"));
		var max = Math.max.apply(Math, this._items.getOutline(index, "end"));
		var pos = this._watcher.getScrollPos();
		var viewSize = this._renderer.getViewSize();

        var $subFolderContainer = $("#sub-folder-container");
        var subFolderListHeight = ($subFolderContainer[0] && $subFolderContainer[0].clientHeight) || 0;

        pos = pos - subFolderListHeight;

		if (pos + viewSize + this.options.threshold < min - 1000) {
			return -1;
		} 
		else if (pos - this.options.threshold > max + 1000) {
			return 1;
		}
		return 0;
	};

	InfiniteGrid.prototype._updateCursor = function _updateCursor(isAppend) {
		if (this.options.useRecycle) {
			if (isAppend) {
				this._status.endCursor++;
			} else if (this._status.startCursor > 0) {
				this._status.startCursor--;
			} else {
				this._status.endCursor++; // outside prepend
			}
			if (this._status.startCursor < 0) {
				this._status.startCursor = 0;
			}
		} else {
			this._status.startCursor = 0;
			this._status.endCursor = this._items.size() - 1;
		}
	};

	InfiniteGrid.prototype._setItems = function _setItems(layouted) {
		var groupKey = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : layouted.items && layouted.items[0].groupKey || 0;

		layouted.groupKey = groupKey;
		this._items.set(layouted, groupKey);
	};

	InfiniteGrid.prototype._insertItems = function _insertItems(layouted, isAppend) {
		layouted.groupKey = layouted.items[0].groupKey;
		this._items[isAppend ? "append" : "prepend"](layouted);
	};
	// called by visible


	InfiniteGrid.prototype._requestAppend = function _requestAppend() {
		var items = this._getNextItems(_consts.APPEND);

		// if (this._isProcessing()) {
		// 	return;
		// }
		if (items.length) {
			this._postLayout(_consts.CACHE, items, _consts.APPEND, _consts.TRUSTED);
		} else {
			this.trigger("append", {
				isTrusted: true,
				groupKey: this.getGroupKeys().pop()
			});
		}
	};
	// called by visible


	InfiniteGrid.prototype._requestPrepend = function _requestPrepend() {
		var items = this._getNextItems(_consts.PREPEND);
		if (items.length) {
			this._postLayout(_consts.CACHE, items, _consts.PREPEND, _consts.TRUSTED);
		} else {
			this.trigger("prepend", {
				isTrusted: true,
				groupKey: this.getGroupKeys().shift()
			});
		}
		return items;
	};

	var InfiniteGridCheckTimeout;
	InfiniteGrid.prototype._onCheck = function _onCheck(_ref2) {
		var that = this;
		// clearTimeout(InfiniteGridCheckTimeout);
		// InfiniteGridCheckTimeout = setTimeout(function () {

			var isForward = _ref2.isForward,
			    scrollPos = _ref2.scrollPos,
			    horizontal = _ref2.horizontal,
			    orgScrollPos = _ref2.orgScrollPos;

			that.trigger("change", {
				isForward: isForward,
				horizontal: horizontal,
				scrollPos: scrollPos,
				orgScrollPos: orgScrollPos
			});

			var rect = that._getEdgeOffset(isForward ? "end" : "start");
			var isProcessing = that.isProcessing();
			if (!rect) {
				return;
			}
			var threshold = that.options.threshold;
			// var targetPos = isForward ? rect[horizontal ? "left" : "top"] - that._renderer.getViewSize() : rect[horizontal ? "right" : "bottom"];
			var targetPos = isForward ? rect["top"] - that._renderer.getViewSize() : rect["bottom"];

			if (isForward) {
				if (scrollPos + threshold >= targetPos) {
					that._requestAppend();
				}
			}
			else if (ig.getItems().length > 0) {
				var offset = $(ig.getItems()[0].el).offset();
				if (offset) {
					var targetPos = offset.top;
					if (targetPos + threshold / 2 > 0) {
						that._fit("before");
						that._requestPrepend();
					}
				}
			}
			else {
				var targetPos = ig._watcher.getScrollPos();
				if (targetPos + threshold / 2 > 0) {
					that._fit("before");
					that._requestPrepend();
				}
			}
		// }, 10);
	};

	InfiniteGrid.prototype._onLayoutComplete = function _onLayoutComplete(items, isAppend) {
		var isTrusted = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;
		var useRecycle = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : this.options.useRecycle;
		var isLayout = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : false;

		this._isLoading() && this._renderLoading();
		!isAppend && this._fit("after");
		if (useRecycle) {
			this._recycle(isAppend);
		}

		var size = this._getEdgeValue("end");

		// recycle after _fit beacause prepend and append are occured simultaneously by scroll.
		this._updateEdge();

		isAppend && this._renderer.setContainerSize(size + this._status.loadingSize || 0);
		!isLayout && this._process(_consts.PROCESSING, false);

		var scrollPos = this._watcher.getScrollPos();
		var viewSize = this._renderer.getViewSize();

		this.trigger("layoutComplete", {
			// target: items.concat(),
			target: items,
			isAppend: isAppend,
			isTrusted: isTrusted,
			isScroll: viewSize < this._renderer.getContainerOffset() + size,
			scrollPos: scrollPos,
			// orgScrollPos: this._watcher.getOrgScrollPos(),
			size: size
		});
		if (isLayout) {
			return;
		}
		var threshold = this.options.threshold;

		if (isAppend && Math.abs(size - viewSize - scrollPos) <= threshold) {
			this._requestAppend();
		} else if (!isAppend && scrollPos <= this._getEdgeValue("start") + threshold) {
			this._fit("before");
			this._requestPrepend();
		}
	};

	InfiniteGrid.prototype._updateContainerHeight = function _updateContainerHeight() {
		let boxListHeight = this._getEdgeValue("end");
		this._renderer.setContainerSize(boxListHeight);
	}

	InfiniteGrid.prototype._reset = function _reset() {
		this._status = {
			processingStatus: _consts.IDLE,
			loadingSize: 0,
			startCursor: -1,
			endCursor: -1,
			start: null,
			end: null
		};
	};

	InfiniteGrid.prototype.destroy = function destroy() {
		// Note: 移除先將 src 清空，強制瀏覽器清除緩存
		var items = ig._getItems();
		items.forEach(function (item) {
			if (item.el) {
				var $el = $(item.el);
				// $(item.el).find("img").attr("src" , "").css("display" , "none");
				$el.find("img").attr("src" , "");
				item.el.style.display = 'none';
				$el.find("*").off();
				$el.off();
				$el.remove();
				// DOMRenderer.removeElement(item.el);
				delete item.el;
			}
		});
		this.off();
		this._watcher.destroy();
		this._reset();
		this._items.clear();
		this._renderer.destroy();
	};

	return InfiniteGrid;
}(_component2["default"]);

InfiniteGrid.VERSION = "3.2.4";

exports["default"] = InfiniteGrid;
module.exports = exports["default"];

/***/ }),
/* 9 */
/***/ (function(module, exports, __webpack_require__) {

(function webpackUniversalModuleDefinition(root, factory) {
	if(true)
		module.exports = factory();
	else if(typeof define === 'function' && define.amd)
		define([], factory);
	else if(typeof exports === 'object')
		exports["Component"] = factory();
	else
		root["eg"] = root["eg"] || {}, root["eg"]["Component"] = factory();
})(this, function() {
return /******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId]) {
/******/ 			return installedModules[moduleId].exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			i: moduleId,
/******/ 			l: false,
/******/ 			exports: {}
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.l = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// define getter function for harmony exports
/******/ 	__webpack_require__.d = function(exports, name, getter) {
/******/ 		if(!__webpack_require__.o(exports, name)) {
/******/ 			Object.defineProperty(exports, name, {
/******/ 				configurable: false,
/******/ 				enumerable: true,
/******/ 				get: getter
/******/ 			});
/******/ 		}
/******/ 	};
/******/
/******/ 	// getDefaultExport function for compatibility with non-harmony modules
/******/ 	__webpack_require__.n = function(module) {
/******/ 		var getter = module && module.__esModule ?
/******/ 			function getDefault() { return module['default']; } :
/******/ 			function getModuleExports() { return module; };
/******/ 		__webpack_require__.d(getter, 'a', getter);
/******/ 		return getter;
/******/ 	};
/******/
/******/ 	// Object.prototype.hasOwnProperty.call
/******/ 	__webpack_require__.o = function(object, property) { return Object.prototype.hasOwnProperty.call(object, property); };
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(__webpack_require__.s = 0);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var _Component = __webpack_require__(1);

var _Component2 = _interopRequireDefault(_Component);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

_Component2["default"].VERSION = "2.1.0";
module.exports = _Component2["default"];

/***/ }),
/* 1 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


exports.__esModule = true;

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Component = function () {
	/**
  * @support {"ie": "7+", "ch" : "latest", "ff" : "latest",  "sf" : "latest", "edge" : "latest", "ios" : "7+", "an" : "2.1+ (except 3.x)"}
  */
	function Component() {
		_classCallCheck(this, Component);

		this._eventHandler = {};
		this.options = {};
	}

	Component.prototype.trigger = function trigger(eventName) {
		var customEvent = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

		var handlerList = this._eventHandler[eventName] || [];
		var hasHandlerList = handlerList.length > 0;

		if (!hasHandlerList) {
			return true;
		}

		// If detach method call in handler in first time then handeler list calls.
		handlerList = handlerList.concat();

		customEvent.eventType = eventName;

		var isCanceled = false;
		var arg = [customEvent];
		var i = 0;

		customEvent.stop = function () {
			isCanceled = true;
		};
		customEvent.currentTarget = this;

		for (var _len = arguments.length, restParam = Array(_len > 2 ? _len - 2 : 0), _key = 2; _key < _len; _key++) {
			restParam[_key - 2] = arguments[_key];
		}

		if (restParam.length >= 1) {
			arg = arg.concat(restParam);
		}

		for (i = 0; handlerList[i]; i++) {
			handlerList[i].apply(this, arg);
		}

		return !isCanceled;
	};

	Component.prototype.once = function once(eventName, handlerToAttach) {
		if ((typeof eventName === "undefined" ? "undefined" : _typeof(eventName)) === "object" && typeof handlerToAttach === "undefined") {
			var eventHash = eventName;
			var i = void 0;

			for (i in eventHash) {
				this.once(i, eventHash[i]);
			}
			return this;
		} else if (typeof eventName === "string" && typeof handlerToAttach === "function") {
			var self = this;

			this.on(eventName, function listener() {
				for (var _len2 = arguments.length, arg = Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
					arg[_key2] = arguments[_key2];
				}

				handlerToAttach.apply(self, arg);
				self.off(eventName, listener);
			});
		}

		return this;
	};

	Component.prototype.hasOn = function hasOn(eventName) {
		return !!this._eventHandler[eventName];
	};

	Component.prototype.on = function on(eventName, handlerToAttach) {
		if ((typeof eventName === "undefined" ? "undefined" : _typeof(eventName)) === "object" && typeof handlerToAttach === "undefined") {
			var eventHash = eventName;
			var name = void 0;

			for (name in eventHash) {
				this.on(name, eventHash[name]);
			}
			return this;
		} else if (typeof eventName === "string" && typeof handlerToAttach === "function") {
			var handlerList = this._eventHandler[eventName];

			if (typeof handlerList === "undefined") {
				this._eventHandler[eventName] = [];
				handlerList = this._eventHandler[eventName];
			}

			handlerList.push(handlerToAttach);
		}

		return this;
	};

	Component.prototype.off = function off(eventName, handlerToDetach) {
		// All event detach.
		if (typeof eventName === "undefined") {
			this._eventHandler = {};
			return this;
		}

		// All handler of specific event detach.
		if (typeof handlerToDetach === "undefined") {
			if (typeof eventName === "string") {
				this._eventHandler[eventName] = undefined;
				return this;
			} else {
				var eventHash = eventName;
				var name = void 0;

				for (name in eventHash) {
					this.off(name, eventHash[name]);
				}
				return this;
			}
		}

		// The handler of specific event detach.
		var handlerList = this._eventHandler[eventName];

		if (handlerList) {
			var k = void 0;
			var handlerFunction = void 0;

			for (k = 0; (handlerFunction = handlerList[k]) !== undefined; k++) {
				if (handlerFunction === handlerToDetach) {
					handlerList = handlerList.splice(k, 1);
					break;
				}
			}
		}

		return this;
	};

	return Component;
}();

exports["default"] = Component;
module.exports = exports["default"];

/***/ })
/******/ ]);
});
//# sourceMappingURL=component.js.map

/***/ }),
/* 10 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


exports.__esModule = true;

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _consts = __webpack_require__(1);

var _DOMRenderer = __webpack_require__(4);

var _DOMRenderer2 = _interopRequireDefault(_DOMRenderer);

var _utils = __webpack_require__(0);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var ItemManager = function () {
	ItemManager.from = function from(elements, selector, _ref) {
		var groupKey = _ref.groupKey,
		    isAppend = _ref.isAppend;

		var filted = ItemManager.selectItems((0, _utils.$)(elements, _consts.MULTI), selector);

		// Item Structure
		return (0, _utils.toArray)(filted).map(function (el) {
			// var id = el.id.replace("box-", "");
			var id = el.getAttribute("data-box-id");
			return {
				id: id,
				el: el,
				groupKey: groupKey,
				// content: el.outerHTML
				content: NgGridStrings[id],
			};
		});
	};

	ItemManager.selectItems = function selectItems(elements) {
		var selector = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : "*";
		if (!elements) return [];
		return elements.filter(function (v) {
			var classNames = v.className.split(" ");

			if (classNames.some(function (c) {
				return c === _consts.IGNORE_CLASSNAME;
			})) {
				return false;
			} else if (!selector || selector === "*") {
				return v;
			} else {
				return classNames.some(function (c) {
					return c === selector;
				});
			}
		});
	};

	ItemManager.pluck = function pluck(data, property) {
		return data.reduce(function (acc, v) {
			return acc.concat(v[property]);
		}, []);
	};

	function ItemManager() {
		_classCallCheck(this, ItemManager);

		this.clear();
	}

	ItemManager.prototype.getStatus = function getStatus() {
		return {
			_data: this._data.map(function (data) {
				var items = data.items.map(function (item) {
					var item2 = _extends({}, item);

					delete item2.el;
					return item2;
				});
				var data2 = _extends({}, data);

				data2.items = items;
				return data2;
			})
		};
	};

	ItemManager.prototype.setStatus = function setStatus(status, start, end) {
		var data = status._data;

		for (var i = start; i <= end; i++) {
			data[i].items = _DOMRenderer2["default"].createElements(data[i].items);
		}
		this.set(data);
	};

	ItemManager.prototype.size = function size() {
		return this._data.length;
	};

	ItemManager.prototype.fit = function fit(base, isVertical) {
		if (!this._data.length) {
			return;
		}
		var property = isVertical ? "top" : "left";

		if (base !== 0) {
			this._data = this._data.map(function (v) {
				v.items = v.items.map(function (item) {
					item.rect[property] -= base;
					return item;
				});
				v.outlines.start = v.outlines.start.map(function (start) {
					return start - base;
				});
				v.outlines.end = v.outlines.end.map(function (end) {
					return end - base;
				});
				return v;
			});
		}
	};

	ItemManager.prototype.pluck = function pluck(property, start, end) {
		if (typeof start !== "undefined") {
			if (typeof end !== "undefined") {
				return ItemManager.pluck(this._data.slice(start, end + 1), property);
			} else {
				return ItemManager.pluck(this._data.slice(start, start + 1), property);
			}
		} else {
			return ItemManager.pluck(this._data, property);
		}
	};

	ItemManager.prototype.getOutline = function getOutline(index, property) {
		if (this._data.length && this._data[index]) {
			return this._data[index].outlines[property];
		} else {
			return [];
		}
	};

	ItemManager.prototype.getEdgeIndex = function getEdgeIndex(cursor, start, end) {
		var prop = cursor === "start" ? "min" : "max";
		var index = -1;
		var targetValue = cursor === "start" ? Infinity : -Infinity;

		for (var i = start; i <= end; i++) {
			var value = Math[prop].apply(Math, this.getOutline(i, cursor));

			if (cursor === "start" && targetValue > value || cursor === "end" && targetValue < value) {
				targetValue = value;
				index = i;
			}
		}
		return index;
	};

	ItemManager.prototype.getEdge = function getEdge(cursor, start, end) {
		var dataIdx = this.getEdgeIndex(cursor, start, end);
		var items = this.pluck("items", dataIdx);

		if (items.length) {
			var itemIdx = this.getOutline(dataIdx, cursor + "Index");

			return items.length > itemIdx ? items[itemIdx] : null;
		}
		return null;
	};

	ItemManager.prototype.getEdgeValue = function getEdgeValue(cursor, start, end) {
		var outlines = this.pluck("outlines", this.getEdgeIndex(cursor, start, end)).reduce(function (acc, v) {
			return acc.concat(v[cursor]);
		}, []);

		return outlines.length ? Math[cursor === "start" ? "min" : "max"].apply(Math, outlines) : 0;
	};

	ItemManager.prototype.append = function append(layouted) {
		this._data.push(layouted);
		return layouted.items;
	};

	ItemManager.prototype.prepend = function prepend(layouted) {
		this._data.unshift(layouted);
		return layouted.items;
	};

	ItemManager.prototype.clear = function clear() {
		this._data = [];
	};

	ItemManager.prototype.remove = function remove(element, start, end) {
		var items = null;
		var key = element.getAttribute(_consts.GROUPKEY_ATT);
		// var data = this.get(start, end).filter(function (v) {
		var data = this.get(start, ig._items._data.length).filter(function (v) {
			return String(v.groupKey) === key;
		});

		if (!data.length) {
			return items;
		}
		data = data[0];

		var len = data.items.length;
		var idx = -1;
		// var boxID = element.id.replace("box-", "");
		var boxID = element.getAttribute("data-box-id");

		for (var i = 0; i < len; i++) {
			if (boxID === data.items[i].id || data.items[i].el === element) {
				idx = i;
				break;
			}
		}
		if (~idx) {
			// remove item information
			data.items.splice(idx, 1);
			this.set(data, key);
			items = data.items;
		}
		return items;
	};

	// TODO: 塞入 item 到某个 item 之前
	ItemManager.prototype.moveElementsBefore = function moveElementsBefore(element, start, end, newElements, isAppend) {
		var items = null;
		var key = element.getAttribute(_consts.GROUPKEY_ATT);
		var data = this.get(start, end).filter(function (v) {
			return String(v.groupKey) === key;
		});

		if (!data.length) {
			return items;
		}
		data = data[0];

		var len = data.items.length;
		var idx = -1;

		for (var i = 0; i < len; i++) {
			if (data.items[i].el === element) {
				idx = i;
				break;
			}
		}
		if (idx > -1) {
			var targetElement = data.items[idx];
			if (isAppend) {
				idx += 1;
			}
			newElements.reverse().forEach(function (newElement) {
				if (!newElement) return;
				var $clone = $(newElement).clone();
				$clone.insertAfter(element);
				// var id = $clone[0].id.replace("box-", "");
				var id = $clone[0].getAttribute("data-box-id");
				var item = {
					id: id,
					el: $clone[0],
					groupKey: targetElement.groupKey,
					content: $clone[0].outerHTML,
				};
				data.items.splice(idx, 0, item);
			});
			this.set(data, key);
			items = data.items;
		}
		return items;
	};

	ItemManager.prototype.get = function get(start, end) {
		if (typeof start !== "undefined") {
			if (typeof end !== "undefined") {
				return this._data.slice(start, end + 1);
			} else {
				return this._data.slice(start, start + 1);
			}
		} else {
			return this._data.concat();
		}
	};

	ItemManager.prototype.set = function set(data, key) {
		if (typeof key !== "undefined" && !Array.isArray(data)) {
			var len = this._data.length;
			var idx = -1;

			for (var i = 0; i < len; i++) {
				if (this._data[i].groupKey === key) {
					idx = i;
					break;
				}
			}
			~idx && (this._data[idx] = data);
		} else {
			this._data = data.concat();
		}
	};

	return ItemManager;
}();

exports["default"] = ItemManager;
module.exports = exports["default"];

/***/ }),
/* 11 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


exports.__esModule = true;

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _consts = __webpack_require__(1);

var _utils = __webpack_require__(0);

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Watcher = function () {
	function Watcher(renderer, callback) {
		_classCallCheck(this, Watcher);

		_extends(this._callback = {
			layout: null,
			check: null
		}, callback);
		this._timer = {
			resize: null
			// doubleCheck: null,
			// doubleCheckCount: RETRY,
		};
		this.reset();
		this._renderer = renderer;
		this._onCheck = this._onCheck.bind(this);
		this._onResize = this._onResize.bind(this);
		this.attachEvent();
		// this.setScrollPos();
	}

	Watcher.prototype.getStatus = function getStatus() {
		return {
			_prevPos: this._prevPos,
			scrollPos: this.getOrgScrollPos()
		};
	};

	Watcher.prototype.setStatus = function setStatus(status) {
		var applyScrollPos = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : true;

		this._prevPos = status._prevPos;
		applyScrollPos && this.scrollTo(status.scrollPos);
	};

	Watcher.prototype.scrollTo = function scrollTo(pos) {
		var arrPos = this._renderer.options.isVertical ? [0, pos] : [pos, 0];

		_utils.scrollTo.apply(undefined, [this._renderer.view].concat(arrPos));
	};

	Watcher.prototype.getScrollPos = function getScrollPos() {
		return this._prevPos;
	};

	Watcher.prototype.setScrollPos = function setScrollPos(pos) {
		var rawPos = pos;

		if (typeof pos === "undefined") {
			rawPos = this.getOrgScrollPos();
		}
		// this._prevPos = rawPos - this._renderer.getContainerOffset();
		this._prevPos = rawPos;
		// console.log(this._renderer.getContainerOffset());
	};

	var watcherScrollTimeout;
	var watcherResizeTimeout;
	Watcher.prototype.attachEvent = function attachEvent() {
		var that = this;
		$(this._renderer.view).on("scroll", throttle(function () {
		// (0, _utils.addEvent)(this._renderer.view, "scroll", function () {
			// clearTimeout(watcherScrollTimeout);
			// watcherScrollTimeout = setTimeout(function () {
				that._onCheck();
			// }, 5);
		}, 50, true));
		(0, _utils.addEvent)(window, "resize", function () {
			clearTimeout(watcherResizeTimeout);
			watcherResizeTimeout = setTimeout(function () {
				that._onResize();
			}, 100);
		});
	};

	Watcher.prototype.getOrgScrollPos = function getOrgScrollPos() {
		return this._renderer.view.scrollTop;
	};

	Watcher.prototype.reset = function reset() {
		this._prevPos = null;
	};
	
	Watcher.prototype._onCheck = function _onCheck() {
		var that = this;
		clearTimeout(that.onCheckTimeout);
		that.onCheckTimeout = setTimeout(function () {
			if (!that.ticking) {
				requestAnimationFrame(() => {
					var prevPos = that.getScrollPos();
					var orgScrollPos = that.getOrgScrollPos();

					that.setScrollPos(orgScrollPos);
					var scrollPos = that.getScrollPos();


					// Note: 避免内容缩放后高度无法触及无法滚动
					if (prevPos === scrollPos) {
						scrollPos += 1;
					}
					// if (prevPos === null || _consts.IS_IOS && orgScrollPos === 0) {
					// if (prevPos === null || _consts.IS_IOS && orgScrollPos === 0 || prevPos === scrollPos) {
						// return;
					// }
					that._callback.check && that._callback.check({
						isForward: prevPos < scrollPos,
						scrollPos: scrollPos,
						orgScrollPos: orgScrollPos,
						horizontal: false
					});
					that.ticking = false;
				});
				that.ticking = true;
			}
		}, 10);
	};

	Watcher.prototype._onResize = function _onResize() {
		var _this = this;

		if (this._timer.resize) {
			clearTimeout(this._timer.resize);
		}
		this._timer.resize = setTimeout(function () {
			_this._renderer.isNeededResize() && _this._callback.layout && _this._callback.layout();
			_this._timer.resize = null;
			_this.reset();
		}, 300);
	};

	Watcher.prototype.detachEvent = function detachEvent() {
		(0, _utils.removeEvent)(window, "resize", this._onResize);
	};

	Watcher.prototype.destroy = function destroy() {
		this.detachEvent();
		this.reset();
	};

	return Watcher;
}();

exports["default"] = Watcher;
module.exports = exports["default"];

/***/ }),
/* 12 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


exports.__esModule = true;

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _consts = __webpack_require__(1);

var _utils = __webpack_require__(0);

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

// ALIGN
var START = _consts.ALIGN.START,
    CENTER = _consts.ALIGN.CENTER,
    END = _consts.ALIGN.END,
    JUSTIFY = _consts.ALIGN.JUSTIFY;


var GridLayout = function () {
	function GridLayout() {
		var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

		_classCallCheck(this, GridLayout);

		this.options = (0, _utils.assignOptions)({
			align: START,
			itemSize: 0
		}, options);
		this._size = 0;
		this._columnSize = 0;
		this._columnLength = 0;
		this._style = (0, _utils.getStyleNames)(this.options.horizontal);
	}

	GridLayout.prototype.getPoints = function getPoints(outlines) {
		var pos = this.options.horizontal ? "left" : "top";

		return outlines.map(function (outline) {
			return outline[pos];
		});
	};

	GridLayout.prototype.checkColumn = function checkColumn(item) {
		var margin = this.options.margin;
		var sizeName = this.options.horizontal ? "height" : "width";
		var columnSize = this.options.itemSize || item && item.size[sizeName] || 0;

		if (!columnSize) {
			this._columnLength = 1;
			this._columnSize = 0;
			return;
		}
		
		// 基於原始 columnSize 和 margin 計算能容納的列數，保持 margin 不變
		this._columnLength = Math.max(parseInt((this._size + margin) / (columnSize + margin), 10), 1);
		
		// 重新計算 columnSize 以完全填滿容器寬度，保持 margin 不變
		// 公式：總寬度 = (columnSize + margin) * columnLength - margin
		// 解出：columnSize = (總寬度 + margin) / columnLength - margin
		this._columnSize = (this._size + margin) / this._columnLength - margin;
		
		// 確保 columnSize 不會小於原始設定的最小值
		if (this._columnSize < columnSize * 0.8) {
			this._columnSize = columnSize * 0.8;
		}
	};

	GridLayout.prototype._layout = function _layout(items, outline, isAppend) {
		var length = items.length;
		var margin = this.options.margin;
		var align = this.options.align;
		var style = this._style;

		var size1Name = style.size1;
		var size2Name = style.size2;
		var pos1Name = style.pos1;
		var pos2Name = style.pos2;
		var columnSize = this._columnSize;
		var columnLength = this._columnLength;

		var size = this._size;
		// 由於 columnSize 已經重新計算以填滿寬度，剩餘空間應該是 0 或接近 0
		var usedWidth = (columnSize + margin) * columnLength - margin;
		var viewDist = Math.max(0, size - usedWidth);

		var pointCaculateName = isAppend ? "min" : "max";
		var startOutline = outline.slice();
		var endOutline = outline.slice();
		var startIndex = 0;
		var endIndex = -1;
		var endPos = -1;

		for (var i = 0; i < length; ++i) {
			var _item$rect;

			var point = Math[pointCaculateName].apply(Math, endOutline) || 0;
			var index = endOutline.indexOf(point);
					var item = items[isAppend ? i : length - 1 - i];
		var size1 = item.size[size1Name];
		var size2 = item.size[size2Name];
		var originalSize2 = size2;
		
		// 使用調整後的 columnSize 作為格子寬度，保持 margin 不變
		size2 = columnSize;
		
		// 如果寬度被調整，高度也要等比例調整以保持比例
		if (size2 !== originalSize2 && originalSize2 > 0) {
			var scaleRatio = size2 / originalSize2;
			size1 = size1 * scaleRatio;
		}
		
		// 同時更新 item.size 對象，確保其他地方也能使用調整後的尺寸
		item.size[size2Name] = size2;
		item.size[size1Name] = size1;
			var pos1 = isAppend ? point : point - margin - size1;
			var endPos1 = pos1 + size1 + margin;

			if (index === -1) {
				index = 0;
			}
			var pos2 = (columnSize + margin) * index;
			// Note: 这里会造成 prepend 模式 grid layout 顺序错乱，所以补上下面这行
			if (!isAppend) {
				pos2 = (columnSize + margin) * (endOutline.length - index - 1);
			}
			
			// ALIGN
			if (align === CENTER) {
				pos2 += viewDist / 2;
			} else if (align === END) {
				pos2 += viewDist;
			} else if (align === JUSTIFY) {
				if (columnLength <= 1) {
					pos2 += viewDist / 2;
				} else {
					// 使用調整後的列寬來均勻分佈
					pos2 = (columnSize + margin) * index;
				}
			}
			// tetris
			item.rect = (_item$rect = {}, _item$rect[pos1Name] = pos1, _item$rect[pos2Name] = pos2, _item$rect);
			item.column = index;
			endOutline[index] = isAppend ? endPos1 : pos1;
			if (endIndex === -1) {
				endIndex = i;
				endPos = endPos1;
			} else if (endPos < endPos1) {
				endIndex = i;
				endPos = endPos1;
			}
		}
		if (!isAppend) {
			items.sort(function (a, b) {
				var item1pos1 = a.rect[pos1Name];
				var item1pos2 = a.rect[pos2Name];
				var item2pos1 = b.rect[pos1Name];
				var item2pos2 = b.rect[pos2Name];

				if (item1pos1 - item2pos1) {
					return item1pos1 - item2pos1;
				}
				return item1pos2 - item2pos2;
			});
			endIndex = length - 1;
		}
		// if append items, startOutline is low, endOutline is high
		// if prepend items, startOutline is high, endOutline is low
		return {
			start: isAppend ? startOutline : endOutline,
			end: isAppend ? endOutline : startOutline,
			startIndex: startIndex,
			endIndex: endIndex
		};
	};

	GridLayout.prototype._insert = function _insert() {
		var items = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : [];
		var outline = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : [];
		var type = arguments[2];

		var clone = items.map(function (item) {
			return _extends({}, item);
		});

		var startOutline = outline;

		if (!this._columnLength) {
			this.checkColumn(items[0]);
		}
		if (outline.length !== this._columnLength) {
			startOutline = (0, _utils.fill)(new Array(this._columnLength), outline.length === 0 ? 0 : Math[type === _consts.APPEND ? "min" : "max"].apply(Math, outline) || 0);
		}

		var result = this._layout(clone, startOutline, type);

		return {
			items: clone,
			outlines: result
		};
	};

	GridLayout.prototype.append = function append(items, outline) {
		return this._insert(items, outline, _consts.APPEND);
	};

	GridLayout.prototype.prepend = function prepend(items, outline) {
		return this._insert(items, outline, _consts.PREPEND);
	};
	
	GridLayout.prototype.layout = function layout() {
		var _this = this;

		var groups = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : [];
		var outline = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : [];

		// var firstItem = groups.length && groups[0].items.length && groups[0].items[0] || 0;
		// Fixed: by augus
		// 避免刪除圖片後，版行跑版
		var firstItem = ig.getItems()[0];

		this.checkColumn(firstItem);

		// if outlines' length and columns' length are now same, re-caculate outlines.
		var startOutline = void 0;

		if (outline.length !== this._columnLength) {
			var pos = outline.length === 0 ? 0 : Math.min.apply(Math, outline);

			// re-layout items.
			startOutline = (0, _utils.fill)(new Array(this._columnLength), pos);
		} else {
			startOutline = outline.slice();
		}
		groups.forEach(function (group) {
			var items = group.items;
			var result = _this._layout(items, startOutline, _consts.APPEND);

			group.outlines = result;
			startOutline = result.end;
		});

		return this;
	};

	GridLayout.prototype.setSize = function setSize(size) {
		this._size = size;
		return this;
	};

	return GridLayout;
}();

exports["default"] = GridLayout;
module.exports = exports["default"];

/***/ }),
/* 13 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


exports.__esModule = true;

var _FrameLayout2 = __webpack_require__(6);

var _FrameLayout3 = _interopRequireDefault(_FrameLayout2);

var _utils = __webpack_require__(0);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

function makeShapeOutline(outline, itemSize, columnLength, isAppend) {
	var point = Math[isAppend ? "min" : "max"].apply(Math, outline) || 0;

	if (outline.length !== columnLength) {
		return (0, _utils.fill)(new Array(columnLength), 0);
	}
	return outline.map(function (l) {
		return parseInt((l - point) / itemSize, 10);
	});
}
function getColumn(item) {
	if (item.column) {
		return item.column;
	}
	var column = 0;

	if (item.el) {
		var dataset = item.el.dataset;

		if (dataset) {
			column = dataset.column || 1;
		} else {
			column = item.el.getAttribute("column") || 1;
		}
	} else {
		column = 1;
	}
	item.column = column;
	return column;
}

var SquareLayout = function (_FrameLayout) {
	_inherits(SquareLayout, _FrameLayout);

	function SquareLayout() {
		_classCallCheck(this, SquareLayout);

		return _possibleConstructorReturn(this, _FrameLayout.apply(this, arguments));
	}

	SquareLayout.prototype._checkItemSize = function _checkItemSize() {
		var column = this.options.column;

		if (!column) {
			_FrameLayout.prototype._checkItemSize.call(this);
			return;
		}
		var margin = this.options.margin;

		// 計算 itemSize 以完全填滿容器寬度，保持 margin 不變
		this._itemSize = (this._size + margin) / column - margin;
	};

	SquareLayout.prototype._layout = function _layout(items) {
		var _shapes;

		var outline = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : [];
		var isAppend = arguments[2];

		var itemSize = this._getItemSize();
		var margin = this.options.margin;
		var columnLength = this.options.column || parseInt((this._size + margin) / (itemSize + margin), 10) || 1;
		var length = items.length;
		var endOutline = makeShapeOutline(outline, itemSize, columnLength, isAppend);
		var pointCaculateName = isAppend ? "min" : "max";
		var shapes = [];
		var sign = isAppend ? 1 : -1;
		var style = this._style;
		var pos1Name = style.pos1;
		var pos2Name = style.pos2;

		for (var i = 0; i < length; ++i) {
			var _shapes$push;

			var point = Math[pointCaculateName].apply(Math, endOutline);
			var index = endOutline[isAppend ? "indexOf" : "lastIndexOf"](point);
			var item = items[i];
			var columnWidth = item.columnWidth;
			var column = columnWidth && columnWidth[0] === columnLength && columnWidth[1] || getColumn(item);
			var columnCount = 1;

			if (column > 1) {
				for (var j = 1; j < column && (isAppend && index + j < columnLength || !isAppend && index - j >= 0); ++j) {
					if (isAppend && endOutline[index + sign * j] <= point || !isAppend && endOutline[index + sign * j] >= point) {
						++columnCount;
						continue;
					}
					break;
				}
				if (!isAppend) {
					index -= columnCount - 1;
				}
			}
			item.columnWidth = [columnLength, columnCount];
			shapes.push((_shapes$push = {
				width: columnCount,
				height: columnCount
			}, _shapes$push[pos1Name] = point - (!isAppend ? columnCount : 0), _shapes$push[pos2Name] = index, _shapes$push.index = i, _shapes$push));
			for (var _j = 0; _j < columnCount; ++_j) {
				endOutline[index + _j] = point + sign * columnCount;
			}
		}
		this._shapes = (_shapes = {
			shapes: shapes
		}, _shapes[style.size2] = columnLength, _shapes);

		var result = _FrameLayout.prototype._layout.call(this, items, outline, isAppend);

		if (!isAppend) {
			var lastItem = items[items.length - 1];

			shapes.sort(function (shape1, shape2) {
				var item1pos1 = shape1[pos1Name];
				var item1pos2 = shape1[pos2Name];
				var item2pos1 = shape2[pos1Name];
				var item2pos2 = shape2[pos2Name];

				if (item1pos1 - item2pos1) {
					return item1pos1 - item2pos1;
				}
				return item1pos2 - item2pos2;
			});
			items.sort(function (a, b) {
				var item1pos1 = a.rect[pos1Name];
				var item1pos2 = a.rect[pos2Name];
				var item2pos1 = b.rect[pos1Name];
				var item2pos2 = b.rect[pos2Name];

				if (item1pos1 - item2pos1) {
					return item1pos1 - item2pos1;
				}
				return item1pos2 - item2pos2;
			});
			result.startIndex = 0;
			result.endIndex = items.indexOf(lastItem);
		}
		return result;
	};

	return SquareLayout;
}(_FrameLayout3["default"]);

exports["default"] = SquareLayout;
module.exports = exports["default"];

/***/ }),
/* 14 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


exports.__esModule = true;

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _BoxModel = __webpack_require__(15);

var _BoxModel2 = _interopRequireDefault(_BoxModel);

var _consts = __webpack_require__(1);

var _utils = __webpack_require__(0);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function getCost(originLength, length) {
	var cost = originLength / length;

	if (cost < 1) {
		cost = 1 / cost;
	}

	return cost - 1;
}
function fitArea(item, bestFitArea, itemFitSize, containerFitSize, layoutVertical) {
	item.setHeight(itemFitSize.height);
	item.setWidth(itemFitSize.width);
	bestFitArea.setHeight(containerFitSize.height);
	bestFitArea.setWidth(containerFitSize.width);

	if (layoutVertical) {
		item.setTop(bestFitArea.getTop() + bestFitArea.getHeight());
		item.setLeft(bestFitArea.getLeft());
	} else {
		item.setLeft(bestFitArea.getLeft() + bestFitArea.getWidth());
		item.setTop(bestFitArea.getTop());
	}
}

var PackingLayout = function () {
	function PackingLayout() {
		var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

		_classCallCheck(this, PackingLayout);

		this.options = (0, _utils.assignOptions)({
			aspectRatio: 1,
			sizeWeight: 1,
			ratioWeight: 1
		}, options);
		this._size = 0;
		this._style = (0, _utils.getStyleNames)(this.options.horizontal);
	}

	PackingLayout.prototype._findBestFitArea = function _findBestFitArea(container, item) {
		if (container.getRatio() === 0) {
			// 아이템 최초 삽입시 전체영역 지정
			container.setOriginWidth(item.getWidth());
			container.setOriginHeight(item.getHeight());
			container.setWidth(item.getWidth());
			container.setHeight(item.getHeight());
			return;
		}

		var bestFitArea = null;
		var minCost = 10000000;
		var layoutVertical = false;
		var itemFitSize = {
			width: 0,
			height: 0
		};
		var containerFitSize = {
			width: 0,
			height: 0
		};
		var _options = this.options,
		    sizeWeight = _options.sizeWeight,
		    ratioWeight = _options.ratioWeight;


		container.innerItem().forEach(function (v) {
			var containerSizeCost = getCost(v.getOriginSize(), v.getSize()) * sizeWeight;
			var containerRatioCost = getCost(v.getOriginRatio(), v.getRatio()) * ratioWeight;
			var cost = void 0;

			for (var i = 0; i < 2; ++i) {
				var itemWidth = void 0;
				var itemHeight = void 0;
				var containerWidth = void 0;
				var containerHeight = void 0;

				if (i === 0) {
					// 상하에 아이템 추가
					itemWidth = v.getWidth();
					itemHeight = v.getHeight() * (item.getHeight() / (v.getOriginHeight() + item.getHeight()));
					containerWidth = v.getWidth();
					containerHeight = v.getHeight() - itemHeight;
				} else {
					// 좌우에 아이템 추가
					itemHeight = v.getHeight();
					itemWidth = v.getWidth() * (item.getWidth() / (v.getOriginWidth() + item.getWidth()));
					containerHeight = v.getHeight();
					containerWidth = v.getWidth() - itemWidth;
				}

				var itemSize = itemWidth * itemHeight;
				var itemRatio = itemWidth / itemHeight;
				var containerSize = containerWidth * containerHeight;
				var containerRatio = containerHeight / containerHeight;

				cost = getCost(item.getSize(), itemSize) * sizeWeight;
				cost += getCost(item.getRatio(), itemRatio) * ratioWeight;
				cost += getCost(v.getOriginSize(), containerSize) * sizeWeight - containerSizeCost;
				cost += getCost(v.getOriginRatio(), containerRatio) * ratioWeight - containerRatioCost;

				if (cost === Math.min(cost, minCost)) {
					minCost = cost;
					bestFitArea = v;
					layoutVertical = i === 0;
					itemFitSize.width = itemWidth;
					itemFitSize.height = itemHeight;
					containerFitSize.width = containerWidth;
					containerFitSize.height = containerHeight;
				}
			}
		});

		fitArea(item, bestFitArea, itemFitSize, containerFitSize, layoutVertical);
	};

	PackingLayout.prototype._layout = function _layout(items) {
		var _this = this;

		var outline = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : [];
		var isAppend = arguments[2];

		var style = this._style;
		var isHorizontal = this.options.horizontal;
		var aspectRatio = this.options.aspectRatio;
		var margin = this.options.margin;
		var pos1Name = style.pos1;
		var size1Name = style.size1;
		var containerWidth = this._size * (isHorizontal ? aspectRatio : 1);
		var containerHeight = this._size / (isHorizontal ? 1 : aspectRatio);
		var containerSize1 = isHorizontal ? containerWidth : containerHeight;
		var prevOutline = (0, _utils.toZeroArray)(outline);
		var start = isAppend ? Math.max.apply(Math, prevOutline) : Math.min.apply(Math, prevOutline) - containerSize1 - margin;
		var end = start + containerSize1 + margin;
		var container = new _BoxModel2["default"]({});

		var startIndex = -1;
		var endIndex = -1;
		var startPos = -1;
		var endPos = -1;

		items.forEach(function (item) {
			var model = new _BoxModel2["default"]({
				originWidth: item.orgSize.width,
				originHeight: item.orgSize.height,
				width: item.orgSize.width,
				height: item.orgSize.height
			});

			_this._findBestFitArea(container, model);
			container.pushItem(model);
			container.scaleTo(containerWidth + margin, containerHeight + margin);
		});
		items.forEach(function (item, i) {
			var boxItem = container.innerItem()[i];
			// console.log("boxItem", boxItem, boxItem instanceof BoxModel);
			var width = boxItem.getWidth();
			var height = boxItem.getHeight();
			var top = boxItem.getTop();
			var left = boxItem.getLeft();

			item.rect = { top: top, left: left, width: width - margin, height: height - margin };
			item.rect[pos1Name] += start;

			if (startIndex === -1) {
				startIndex = i;
				endIndex = i;
				startPos = item.rect[pos1Name];
				endPos = startPos;
			}
			if (startPos > item.rect[pos1Name]) {
				startPos = item.rect[pos1Name];
				startIndex = i;
			}
			if (endPos < item.rect[pos1Name] + item.rect[size1Name] + margin) {
				endPos = item.rect[pos1Name] + item.rect[size1Name] + margin;
				endIndex = i;
			}
		});

		return {
			start: [start],
			end: [end],
			startIndex: startIndex,
			endIndex: endIndex
		};
	};

	PackingLayout.prototype._insert = function _insert() {
		var items = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : [];
		var outline = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : [];
		var type = arguments[2];

		// this only needs the size of the item.
		var clone = items.map(function (item) {
			return _extends({}, item);
		});

		return {
			items: clone,
			outlines: this._layout(clone, outline, type)
		};
	};

	PackingLayout.prototype.append = function append(items, outline) {
		return this._insert(items, outline, _consts.APPEND);
	};

	PackingLayout.prototype.prepend = function prepend(items, outline) {
		return this._insert(items, outline, _consts.PREPEND);
	};

	PackingLayout.prototype.layout = function layout() {
		var groups = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : [];
		var outline = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : [];

		var length = groups.length;
		var point = outline;

		for (var i = 0; i < length; ++i) {
			var group = groups[i];

			point = this._layout(group.items, point, _consts.APPEND);
			group.outlines = point;
			point = point.end;
		}
		return this;
	};

	PackingLayout.prototype.setSize = function setSize(size) {
		this._size = size;
		return this;
	};

	return PackingLayout;
}();

exports["default"] = PackingLayout;
module.exports = exports["default"];

/***/ }),
/* 15 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var BoxModel = function () {
	function BoxModel(option) {
		_classCallCheck(this, BoxModel);

		this._originWidth = option.originWidth || 0;
		this._originHeight = option.originHeight || 0;
		this._width = option.width || 0;
		this._height = option.height || 0;
		this._left = option.left || 0;
		this._top = option.top || 0;
		this._item = option.item;
		this._innerItem = option.innerItem || [];
	}

	BoxModel.prototype.getOriginWidth = function getOriginWidth() {
		return this._originWidth;
	};

	BoxModel.prototype.setOriginWidth = function setOriginWidth(width) {
		this._originWidth = width;
	};

	BoxModel.prototype.getOriginHeight = function getOriginHeight() {
		return this._originHeight;
	};

	BoxModel.prototype.setOriginHeight = function setOriginHeight(height) {
		this._originHeight = height;
	};

	BoxModel.prototype.getWidth = function getWidth() {
		return this._width;
	};

	BoxModel.prototype.setWidth = function setWidth(width) {
		this._width = width;
	};

	BoxModel.prototype.getHeight = function getHeight() {
		return this._height;
	};

	BoxModel.prototype.setHeight = function setHeight(height) {
		this._height = height;
	};

	BoxModel.prototype.getLeft = function getLeft() {
		return this._left;
	};

	BoxModel.prototype.setLeft = function setLeft(left) {
		this._left = left;
	};

	BoxModel.prototype.getTop = function getTop() {
		return this._top;
	};

	BoxModel.prototype.setTop = function setTop(top) {
		this._top = top;
	};

	BoxModel.prototype.innerItem = function innerItem() {
		return this._innerItem;
	};

	BoxModel.prototype.scaleTo = function scaleTo(width, height) {
		var scaleX = this._width === 0 ? 0 : width / this._width;
		var scaleY = this._height === 0 ? 0 : height / this._height;

		this._innerItem.forEach(function (v) {
			if (scaleX !== 0) {
				v._left *= scaleX;
				v._width *= scaleX;
			}
			if (scaleY !== 0) {
				v._top *= scaleY;
				v._height *= scaleY;
			}
		});

		this._width = width;
		this._height = height;
	};

	BoxModel.prototype.pushItem = function pushItem(item) {
		this._innerItem.push(item);
	};

	BoxModel.prototype.getOriginSize = function getOriginSize() {
		return this._originWidth * this._originHeight;
	};

	BoxModel.prototype.getSize = function getSize() {
		return this._width * this._height;
	};

	BoxModel.prototype.getOriginRatio = function getOriginRatio() {
		return this._originHeight === 0 ? 0 : this._originWidth / this._originHeight;
	};

	BoxModel.prototype.getRatio = function getRatio() {
		return this._height === 0 ? 0 : this._width / this._height;
	};

	BoxModel.prototype.isSmallerThen = function isSmallerThen(box) {
		return this._width <= box._width && this._height <= box._height;
	};

	BoxModel.prototype.isEqual = function isEqual(box) {
		return this._left === box._left && this._top === box._top && this._width === box._width && this._height === box._height;
	};

	return BoxModel;
}();

module.exports = BoxModel;

/***/ }),
/* 16 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


exports.__esModule = true;

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _dijkstra = __webpack_require__(17);

var _dijkstra2 = _interopRequireDefault(_dijkstra);

var _consts = __webpack_require__(1);

var _utils = __webpack_require__(0);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var JustifiedLayout = function () {
	function JustifiedLayout() {
		var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

		_classCallCheck(this, JustifiedLayout);

		this.options = (0, _utils.assignOptions)({
			minSize: 0,
			maxSize: 0,
			column: [1, 16]
		}, options);

		this._style = (0, _utils.getStyleNames)(this.options.horizontal);
		this._size = 0;
	}

	JustifiedLayout.prototype._layout = function _layout(items, outline, isAppend) {
		var _this = this;

		var style = this._style;
		var size1Name = style.size1;
		var size2Name = style.size2;
		var startIndex = 0;
		var endIndex = items.length;
		var column = this.options.column;

		var maxSize = this.options.maxSize;
		var minSize = this.options.minSize;
		var containerWidth = ig._layout._size || $("#box-container .box-list").width();
		var maxColumn = Math.ceil(containerWidth / minSize);
		// Note: 如果 maxColumn = 0，將會導致 Error: Could not find a path from node0 to node14
		if (maxColumn === 0) { maxColumn = parseInt(window.innerWidth / minSize); }
		// var allData = angular.element("body").scope().allData;

		if ((typeof column === "undefined" ? "undefined" : _typeof(column)) !== "object") {
			column = [column, column];
		}

		var graph = function graph(_start) {
			var results = {};
			var start = +_start.replace(/[^0-9]/g, "");
			var length = endIndex + 1;
			var itemsLength = length;

			for (var i = Math.min(start + column[0], length - 1); i < length; ++i) {

				// Note: 避免一排出現太多元素造成元素高度太低
				if (i - start >= maxColumn + 1) {
					break;
				}

				if (i - start >= column[1]) {
					break;
				}
				
				var cost = _this._getCost(items, start, i, size1Name, size2Name, itemsLength);

				// if (cost < 0 && i === length - 1) {
				// 	cost = 0;
				// }

				if (cost !== null) {
					results["node" + i] = Math.pow(cost, 2);
				}
			}
			return results;
		};
		// shortest path for items' total height.
		var path = _dijkstra2["default"].find_path(graph, "node" + startIndex, "node" + endIndex);

		// Note: 當已無更多資料（最後一頁）且項目數超過一排時，
		// 使用貪心填充取代 Dijkstra 平均分配，讓第一排盡量塞滿，
		// 溢出的項目自然落到下一排，最後一排允許不填滿
		var allData = $bodyScope.allData;
		if (allData && allData.length <= items.length && items.length > maxColumn) {
			path = [];
			for (var k = startIndex; k <= endIndex; k += maxColumn) {
				path.push("node" + k);
			}
			if (path[path.length - 1] !== "node" + endIndex) {
				path.push("node" + endIndex);
			}
			// 避免最後一排只有 1 個項目，從前一排借 1 個過來
			if (path.length >= 3) {
				var lastNode = parseInt(path[path.length - 1].replace("node", ""), 10);
				var prevNode = parseInt(path[path.length - 2].replace("node", ""), 10);
				if (lastNode - prevNode === 1) {
					path[path.length - 2] = "node" + (prevNode - 1);
				}
			}
		}

		return this._setStyle(items, path, outline, isAppend);
	};

	JustifiedLayout.prototype._getSize = function _getSize(items, size1Name, size2Name, itemsLength) {
		// console.log(itemsLength)
		var margin = this.options.margin;
		var size = items.reduce(function (sum, item) {
			return sum + item.size[size2Name] / item.size[size1Name];
		}, 0);

		var length = items.length;
		var result = (this._size - margin * (length - 1)) / size;
		// var maxSize = this.options.maxSize;
		// var minSize = this.options.minSize;
		// var size = parseInt($("#box-container").width() / maxSize) * maxSize;
		// var maxColumn = Math.floor( / minSize);
		var allData = $bodyScope.allData;
		if (result >= size && itemsLength < 5 && allData && allData.length < 5) {
		// if (result >= size && itemsLength < 6) {
			// debugger
			return Math.min(ig._layout.options.minSize, result);
		}
		else {
			return result;
		}
	};

	JustifiedLayout.prototype._getCost = function _getCost(items, i, j, size1Name, size2Name, itemsLength) {
		var size = this._getSize(items.slice(i, j), size1Name, size2Name, itemsLength);
		var min = this.options.minSize || 0;
		var max = this.options.maxSize || Infinity;

		if (isFinite(max)) {
			// if this size is not in range, the cost increases sharply.
			// if (size < min) {
			// 	return Math.pow(size - min, 2) + Math.pow(max, 2);
			// }
			// else if (size > max) {
			// 	return Math.pow(size - max, 2) + Math.pow(max, 2);
			// }
			// else {
				// if this size in range, the cost is negative or low.
				return Math.min(size - max, min - size);
			// }
		}
		// if max is infinite type, caculate cost only with "min".
		if (size < min) {
			return Math.max(Math.pow(min, 2), Math.pow(size, 2));
		}
		return size - min;
	};

	JustifiedLayout.prototype._setStyle = function _setStyle(items, path) {

		var outline = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : [];
		var isAppend = arguments[3];

		var style = this._style;
		// if direction is vertical
		// pos1 : top, pos11 : bottom
		// size1 : height
		// pos2 : left, pos22 : right
		// size2 : width

		// if direction is horizontal
		// pos1 : left, pos11 : right
		// size1 : width
		// pos2 : top, pos22 : bottom
		// size2 : height
		var pos1Name = style.pos1;
		var size1Name = style.size1;
		var pos2Name = style.pos2;
		var size2Name = style.size2;
		var length = path.length;
		var margin = this.options.margin;
		var startPoint = outline[0] || 0;
		var endPoint = startPoint;
		var height = 0;

		// b1-9d：去 Angular 后 window.angular 缺席；$bodyScope 即 bundle 世界同对象
		// （与本文 673 行 Eagle 自有写法一致），bundle 在世时语义零改变。
		var $scope = $bodyScope || angular.element("body").scope();
		var isNameVisible = $scope.showName;
		var isMetasVisible = $scope.showMetas;

		var groupKeys = ig.getGroupKeys();
		var prevRowSize1 = 0;
		var allData = $bodyScope.allData;
		var isEndOfData = allData && allData.length <= items.length;

		for (var i = 0; i < length - 1; ++i) {
			var path1 = parseInt(path[i].replace("node", ""), 10);
			var path2 = parseInt(path[i + 1].replace("node", ""), 10);
			// pathItems(path1 to path2) are in 1 line.
			var pathItems = items.slice(path1, path2);
			var pathItemsLength = pathItems.length;
			var size1 = this._getSize(pathItems, size1Name, size2Name, length);	// height
			var pos1 = endPoint;

			// Note: 避免出现超大一张图片，塞满画面
			if (items.length <= 6) {
				var blockWidth = $scope.imageSize.height;
				if (size1 > blockWidth * 1.5) size1 = blockWidth;
			}

			// Note: 當已無更多資料（最後一頁）時，最後一排高度不超過前一排
			// 配合貪心填充，讓最後一排項目維持與前排一致的大小，右側留白
			var isLastRow = (i === length - 2);
			if (isLastRow && prevRowSize1 > 0 && isEndOfData) {
				if (size1 > prevRowSize1) {
					size1 = prevRowSize1;
				}
			}
			prevRowSize1 = size1;

			var actuallySize1 = size1;
			if (isNameVisible) { actuallySize1 += 23; }
			if (isMetasVisible) { actuallySize1 += 17; }

			for (var j = 0; j < pathItemsLength; ++j) {
				var _item$rect;

				var item = pathItems[j];
				var isLast = i === length - 2 && item.groupKey === groupKeys[groupKeys.length - 1];
				var size2 = item.size[size2Name] / item.size[size1Name] * size1;
				var minWidth  = this.options.minSize;
				var finalWidth = size2;
				
				// 如果是最後一排資料，則將最後一個元素的寬度設為最小寬度
				if (isLast) {
					finalWidth = Math.min(size2, minWidth * 1.7);
				}

				// item has margin bottom and right.
				// first item has not margin.
				var prevItemRect = j === 0 ? 0 : pathItems[j - 1].rect;
				var pos2 = prevItemRect ? prevItemRect[pos2Name] + prevItemRect[size2Name] + margin : 0;

				item.rect = (_item$rect = {}, _item$rect[pos1Name] = pos1, _item$rect[pos2Name] = pos2, _item$rect[size1Name] = actuallySize1, _item$rect[size2Name] = finalWidth, _item$rect);
			}

			if (isNameVisible) { height += (23 + 16); }
			if (isMetasVisible) { height += 17; }

			height += margin + size1;
			endPoint = startPoint + height;
		}
		var itemsLength = items.length;
		var startIndex = itemsLength ? 0 : -1;
		var endIndex = itemsLength ? itemsLength - 1 : -1;

		if (isAppend) {
			// previous group's end outline is current group's start outline
			return {
				start: [startPoint],
				end: [endPoint],
				startIndex: startIndex,
				endIndex: endIndex
			};
		}
		// for prepend, only substract height from position.
		// always start is lower than end.

		for (var _i = 0; _i < itemsLength; ++_i) {
			var _item = items[_i];

			// move items as long as height for prepend
			_item.rect[pos1Name] -= height;
		}
		return {
			start: [startPoint - height],
			end: [startPoint], // endPoint - height = startPoint
			startIndex: startIndex,
			endIndex: endIndex
		};
	};

	JustifiedLayout.prototype._insert = function _insert(items, outline, type) {
		// this only needs the size of the item.
		var clone = items.map(function (item) {
			return _extends({}, item);
		});

		return {
			items: clone,
			outlines: this._layout(clone, outline, type)
		};
	};

	JustifiedLayout.prototype.setSize = function setSize(size) {
		this._size = size;
		return this;
	};

	JustifiedLayout.prototype.append = function append(items, outline) {
		return this._insert(items, outline, _consts.APPEND);
	};

	JustifiedLayout.prototype.prepend = function prepend(items, outline) {
		return this._insert(items, outline, _consts.PREPEND);
	};

	JustifiedLayout.prototype.layout = function layout(groups, outlines) {
		var length = groups.length;
		var point = outlines;

		for (var i = 0; i < length; ++i) {
			var group = groups[i];

			point = this._layout(group.items, point, _consts.APPEND);
			group.outlines = point;
			point = point.end;
		}
		return this;
	};

	return JustifiedLayout;
}();

exports["default"] = JustifiedLayout;
module.exports = exports["default"];

/***/ }),
/* 17 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

(function () {
  var dijkstra = {
    single_source_shortest_paths: function single_source_shortest_paths(graph, s, d) {
      // Predecessor map for each node that has been encountered.
      // node ID => predecessor node ID
      var predecessors = {};

      // Costs of shortest paths from s to all nodes encountered.
      // node ID => cost
      var costs = {};
      costs[s] = 0;

      // Costs of shortest paths from s to all nodes encountered; differs from
      // `costs` in that it provides easy access to the node that currently has
      // the known shortest path from s.
      // XXX: Do we actually need both `costs` and `open`?
      var open = new BinaryHeap(function (x) {
        return x.cost;
      });
      open.push({ value: s, cost: 0 });

      var closest, u, cost_of_s_to_u, adjacent_nodes, cost_of_e, cost_of_s_to_u_plus_cost_of_e, cost_of_s_to_v, first_visit;
      while (open.size()) {
        // In the nodes remaining in graph that have a known cost from s,
        // find the node, u, that currently has the shortest path from s.
        closest = open.pop();
        u = closest.value;
        cost_of_s_to_u = closest.cost;

        // Get nodes adjacent to u...
        adjacent_nodes = graph(u) || {};

        // ...and explore the edges that connect u to those nodes, updating
        // the cost of the shortest paths to any or all of those nodes as
        // necessary. v is the node across the current edge from u.
        for (var v in adjacent_nodes) {
          // Get the cost of the edge running from u to v.
          cost_of_e = adjacent_nodes[v];

          // Cost of s to u plus the cost of u to v across e--this is *a*
          // cost from s to v that may or may not be less than the current
          // known cost to v.
          cost_of_s_to_u_plus_cost_of_e = cost_of_s_to_u + cost_of_e;

          // If we haven't visited v yet OR if the current known cost from s to
          // v is greater than the new cost we just found (cost of s to u plus
          // cost of u to v across e), update v's cost in the cost list and
          // update v's predecessor in the predecessor list (it's now u).
          cost_of_s_to_v = costs[v];
          first_visit = typeof costs[v] === 'undefined';
          if (first_visit || cost_of_s_to_v > cost_of_s_to_u_plus_cost_of_e) {
            costs[v] = cost_of_s_to_u_plus_cost_of_e;
            open.push({ value: v, cost: cost_of_s_to_u_plus_cost_of_e });
            predecessors[v] = u;
          }
        }
      }

      if (typeof costs[d] === 'undefined') {
        var msg = ['Could not find a path from ', s, ' to ', d, '.'].join('');
        throw new Error(msg);
      }

      return predecessors;
    },

    extract_shortest_path_from_predecessor_list: function extract_shortest_path_from_predecessor_list(predecessors, d) {
      var nodes = [];
      var u = d;
      var predecessor;
      while (u) {
        nodes.push(u);
        predecessor = predecessors[u];
        u = predecessors[u];
      }
      nodes.reverse();
      return nodes;
    },

    find_path: function find_path(graph, s, d) {
      var predecessors = dijkstra.single_source_shortest_paths(graph, s, d);
      return dijkstra.extract_shortest_path_from_predecessor_list(predecessors, d);
    }

  };

  function BinaryHeap(scoreFunction) {
    this.content = [];
    this.scoreFunction = scoreFunction;
  }

  BinaryHeap.prototype = {
    push: function push(element) {
      // Add the new element to the end of the array.
      this.content.push(element);
      // Allow it to bubble up.
      this.bubbleUp(this.content.length - 1);
    },

    pop: function pop() {
      // Store the first element so we can return it later.
      var result = this.content[0];
      // Get the element at the end of the array.
      var end = this.content.pop();
      // If there are any elements left, put the end element at the
      // start, and let it sink down.
      if (this.content.length > 0) {
        this.content[0] = end;
        this.sinkDown(0);
      }
      return result;
    },

    remove: function remove(node) {
      var len = this.content.length;
      // To remove a value, we must search through the array to find
      // it.
      for (var i = 0; i < len; i++) {
        if (this.content[i] === node) {
          // When it is found, the process seen in 'pop' is repeated
          // to fill up the hole.
          var end = this.content.pop();
          if (i !== len - 1) {
            this.content[i] = end;
            if (this.scoreFunction(end) < this.scoreFunction(node)) {
              this.bubbleUp(i);
            } else {
              this.sinkDown(i);
            }
          }
          return;
        }
      }
      throw new Error('Node not found.');
    },

    size: function size() {
      return this.content.length;
    },

    bubbleUp: function bubbleUp(n) {
      // Fetch the element that has to be moved.
      var element = this.content[n];
      // When at 0, an element can not go up any further.
      while (n > 0) {
        // Compute the parent element's index, and fetch it.
        var parentN = Math.floor((n + 1) / 2) - 1,
            parent = this.content[parentN];
        // Swap the elements if the parent is greater.
        if (this.scoreFunction(element) < this.scoreFunction(parent)) {
          this.content[parentN] = element;
          this.content[n] = parent;
          // Update 'n' to continue at the new position.
          n = parentN;
        }
        // Found a parent that is less, no need to move it further.
        else {
            break;
          }
      }
    },

    sinkDown: function sinkDown(n) {
      // Look up the target element and its score.
      var length = this.content.length,
          element = this.content[n],
          elemScore = this.scoreFunction(element);

      while (true) {
        // Compute the indices of the child elements.
        var child2N = (n + 1) * 2,
            child1N = child2N - 1;
        // This is used to store the new position of the element,
        // if any.
        var swap = null;
        // If the first child exists (is inside the array)...
        if (child1N < length) {
          // Look it up and compute its score.
          var child1 = this.content[child1N],
              child1Score = this.scoreFunction(child1);
          // If the score is less than our element's, we need to swap.
          if (child1Score < elemScore) {
            swap = child1N;
          }
        }
        // Do the same checks for the other child.
        if (child2N < length) {
          var child2 = this.content[child2N],
              child2Score = this.scoreFunction(child2);
          if (child2Score < (swap == null ? elemScore : child1Score)) {
            swap = child2N;
          }
        }

        // If the element needs to be moved, swap it, and continue.
        if (swap !== null) {
          this.content[n] = this.content[swap];
          this.content[swap] = element;
          n = swap;
        }
        // Otherwise, we are done.
        else {
            break;
          }
      }
    }
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = dijkstra;
  } else {
    window.dijkstra = dijkstra;
  }
})();

/***/ })
/******/ ]);
});
//# sourceMappingURL=infinitegrid.pkgd.js.map
