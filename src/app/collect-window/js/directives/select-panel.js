"use strict";
// TODO: 說好的不搞 prototype 呢？
// 實做 Panel Keyboard 事件監聽相關功能，將 keycode keyup / keydown 等邏輯抽象化
String.prototype.score = function (word, fuzziness) {
	// If the string is equal to the word, perfect match.
	if (this === word) {
		return 1;
	}

	//if it's not a perfect match and is empty return 0
	if (word === "") {
		return 0;
	}

	var runningScore = 0,
		charScore,
		finalScore,
		string = this,
		lString = string.toLowerCase(),
		strLength = string.length,
		lWord = word.toLowerCase(),
		wordLength = word.length,
		idxOf,
		startAt = 0,
		fuzzies = 1,
		fuzzyFactor,
		i;

	// Cache fuzzyFactor for speed increase
	if (fuzziness) {
		fuzzyFactor = 1 - fuzziness;
	}

	// Walk through word and add up scores.
	// Code duplication occurs to prevent checking fuzziness inside for loop
	if (fuzziness) {
		for (i = 0; i < wordLength; i += 1) {
			// Find next first case-insensitive match of a character.
			idxOf = lString.indexOf(lWord[i], startAt);

			if (idxOf === -1) {
				fuzzies += fuzzyFactor;
			} else {
				if (startAt === idxOf) {
					// Consecutive letter & start-of-string Bonus
					charScore = 0.7;
				} else {
					charScore = 0.1;

					// Acronym Bonus
					// Weighing Logic: Typing the first character of an acronym is as if you
					// preceded it with two perfect character matches.
					if (string[idxOf - 1] === " ") {
						charScore += 0.8;
					}
				}

				// Same case bonus.
				if (string[idxOf] === word[i]) {
					charScore += 0.1;
				}

				// Update scores and startAt position for next round of indexOf
				runningScore += charScore;
				startAt = idxOf + 1;
			}
		}
	} else {
		for (i = 0; i < wordLength; i += 1) {
			idxOf = lString.indexOf(lWord[i], startAt);
			if (-1 === idxOf) {
				return 0;
			}

			if (startAt === idxOf) {
				charScore = 0.7;
			} else {
				charScore = 0.1;
				if (string[idxOf - 1] === " ") {
					charScore += 0.8;
				}
			}
			if (string[idxOf] === word[i]) {
				charScore += 0.1;
			}
			runningScore += charScore;
			startAt = idxOf + 1;
		}
	}

	// Reduce penalty for longer strings.
	finalScore = (0.5 * (runningScore / strLength + runningScore / wordLength)) / fuzzies;

	if (lWord[0] === lString[0] && finalScore < 0.85) {
		finalScore += 0.15;
	}

	return finalScore;
};
class SelectPanelSearchInput {

    enterKeydown
    $input
    onChange
    onEnterKey
    onEscKey
    onTabKey
    onUpKey
    onDownKey
    onLeftKey
    onRightKey
    onPaste

    constructor(params) {
        this.$input = $(params.selector);
        this.onChange = params.onChange || function () {};
        this.onEnterKey = params.onEnterKey || function () {};
        this.onEscKey = params.onEscKey || function () {};
        this.onTabKey = params.onTabKey || function () {};
        this.onUpKey = params.onUpKey || function () {};
        this.onDownKey = params.onDownKey || function () {};
        this.onLeftKey = params.onLeftKey || function () {};
        this.onRightKey = params.onRightKey || function () {};
        this.onPaste = params.onPaste || function () {};
        this.enterKeydown = false;
        this.escKeydown = false;

        // HACK: 中文輸入法的 enter 不會有完整的 keydown + keyup，所以這邊用 enterKeydown 確保是一次完整的 enter keydown + keyup 事件
        this.$input.off('keyup').on('keyup', (event) => {
            switch (event.keyCode) {
                case 13: // enter
                    if (this.enterKeydown) {
                        this.onEnterKey(event);
                        this.enterKeydown = false;
                    }
                    break;
                case 27: // esc
                    if (this.escKeydown) {
                        event.preventDefault();
                        event.stopPropagation();
                        this.onEscKey();
                        this.escKeydown = false;
                    }
                    break;
            }
        });

        this.$input.off('keydown').on('keydown', (event) => {
            switch (event.keyCode) {
                case 9: // tab
                    if (this.onTabKey !== undefined) {
                        event.preventDefault();
                        event.stopPropagation();
                        this.onTabKey(event);
                    }
                    break;
                case 13: // enter
                    event.preventDefault();
                    if (event.metaKey || event.ctrlKey) {
                        this.onEnterKey(event);
                    }
                    else {
                        this.enterKeydown = true;
                    }
                    break;
                case 37: // left
                    this.onLeftKey(event);
                    break;
                case 39: // right
                    this.onRightKey(event);
                    break;
                case 38: // up
                    event.preventDefault();
                    this.onUpKey();
                    break;
                case 40: // down
                    event.preventDefault();
                    this.onDownKey();
                    break;
                case 27: // esc
                    event.preventDefault();
                    this.escKeydown = true;
                    break;
                default:
                    break;
            }
        });

        this.$input.off('paste').on('paste', (event) => {
            this.onPaste(event);
        });

        // off and bing jquery input change event
        this.$input.off('input').on('input', (event) => {
            this.onChange();
        });
    }

    focus () {
        setTimeout(() => {
            this.$input.focus();
        }, 24);
    }

    blur () {
        this.$input.blur();
    }
} 
class SelectPanel {

    fixedSize
    searchInput
    searchKeyword
    listData
    $panel
    
    // 事件 callbacks
    onOpened
    onClosed

    scope

    constructor(params) {

        this.scope = params.scope;
        this.$panel = $(params.panelSelector);
        this.fixedSize = params.fixedSize ?? false;

        // 初始化搜尋輸入框、回呼函式
        this.searchInput = new SelectPanelSearchInput({
            scope: params.scope,
            selector: params.searchInputSelector,
            onChange: () => {
                this.listData.searchKeyword = this.searchInput.$input.val();
                this.keywordChanged();
                this.scope.$evalAsync();
            },
            onEnterKey: (event) => {
                let item = this.listData?.items?.[this.listData.currentIndex];
                this.openItem(event, item);
                this.scope.$evalAsync();
            },
            onEscKey: () => { 
                this.close();
                this.scope.$evalAsync();
            },
            onTabKey: (event) => {
                this.onTabKey(event);
                this.scope.$evalAsync();
            },
            onUpKey: (event) => {
                this.selectUp(event); 
                this.scope.$evalAsync();
            },
            onDownKey: (event) => { 
                this.selectDown(event);
                this.scope.$evalAsync();
            },
            onLeftKey: (event) => {
                this.selectLeft && this.selectLeft(event);
                this.onLeftKey && this.onLeftKey(event);
                this.scope.$evalAsync();
            },
            onRightKey: (event) => {
                this.selectRight && this.selectRight(event);
                this.onRightKey && this.onRightKey(event);
                this.scope.$evalAsync();
            },
            onPaste: (event) => {
                this.onPaste(event);
                this.scope.$evalAsync();
            },
        });
    }

    init (params) {
        this.reset();
        this.panelHeight = this.$panel.height();
        // 初始化事件 callbacks
        this.onOpened = params.onOpened || (() => {});
        this.onClosed = params.onClosed || (() => {});
    }

    reset() {
        if (!this.listData) {
            this.listData = {
                items: [],
                currentIndex: -1,
                searchKeyword: "",
            };
        }
        this.listData.items = [];
        this.listData.currentIndex = -1;
        this.listData.searchKeyword = "";
        this.clearSearchInput();
    }

    // 打開 Panel
    open (params) {
        if (params?.preventCollisionWithElement) {
			this.#moveToCursorPositionAndPreventCollisionWithElement(() => {
				this.$panel.addClass("open");
				this.onOpened && this.onOpened();
				setTimeout(() => {
					this.searchInput.focus();
				}, 50);
			},
			params.preventCollisionWithElement,
			0);
		} else {
			this.#moveToCursorPosition(() => {
				this.$panel.addClass("open");
				this.onOpened && this.onOpened();
				setTimeout(() => {
					this.searchInput.focus();
				}, 50);
			}, 0);
		}
    }

    // 關閉 Panel
    close () {
        this.scrollTop();
        this.$panel.removeClass("open");
        this.searchInput.blur();
        this.reset();
        this.onClosed();
    }

    // 選擇上一個項目
    selectUp () {
        if (this.listData.currentIndex > 0) {
            let prevIdx = this.listData.currentIndex - 1;
            let prevItem = this.listData.items[prevIdx];
            if (!prevItem) return;
            this.listData.currentIndex = prevIdx;
            if (!this.isItemSelectable(prevItem)) {
                this.selectUp();
            }
        }
    }

    // 選擇下一個項目
    selectDown () {
        if (this.listData.currentIndex < this.listData.items.length - 1) {
            let nextIdx = this.listData.currentIndex + 1;
            let nextItem = this.listData.items[nextIdx];
            if (!nextItem) return;
            this.listData.currentIndex = nextIdx;
            if (!this.isItemSelectable(nextItem)) {
                this.selectDown();
            }
        }
    }

    // 父類不實作，由子類實作
    openItem (event, item) {
        throw new Error('You have to implement the method doSomething!');
    }

    onTabKey () {
        
    }

    onPaste () {
    }

    // 滑鼠懸停項目
    hoverItem (index) {
        this.listData.currentIndex = index;
    }

    focusSearchInput () {
        this.searchInput.focus();
    }

    clearSearchInput () {
        this.searchInput.$input.val("");
    }

    keywordChanged () {
        throw new Error('You have to implement the method doSomething!');
    }

    // 判斷項目是否可選擇
    isItemSelectable (item) {
        throw new Error('You have to implement the method doSomething!');
    }

    scrollTop () {
        this.$panel.find("select-panel-list").scrollTop(0);
    }

	#moveToCursorPositionAndPreventCollisionWithElement(callback, element, retry) {
		const windowWidth = $(window).width();
		const windowHeight = $(window).height();
		const containerWidth = this.$panel.width();
		const containerHeight = this.$panel.height();
		let x = windowMouseX + 10;
		let y = windowMouseY - 10;

		// NOTE: 避免尚未完成渲染的時候，取得的 containerHeight 為 0
		if (retry < 3 && containerHeight === this.panelHeight) {
			setTimeout(() => {
				this.#moveToCursorPositionAndPreventCollisionWithElement(callback, element, retry + 1);
			}, 50);
			return;
		}

		if (windowMouseX + containerWidth > windowWidth) {
			x = windowMouseX - containerWidth - 20;
		}

		if (windowMouseY + containerHeight > windowHeight - 20) {
			y = windowHeight - containerHeight - 20;
			y = y < 20 ? 20 : y;
		}

		if (element) {
			const elementRect = element.getBoundingClientRect();
			const elementBottom = elementRect.top + elementRect.height;
			const elementRight = elementRect.left + elementRect.width;

			// 檢查有沒有重疊到 element
			// 有的話就移動到 element 下方或是右邊
			if (x < elementRight && y < elementBottom) {
				// 假設優先移動到元素下方
				const potentialBottomY = elementBottom + 10;
				if (potentialBottomY + containerHeight <= windowHeight - 20) {
					y = potentialBottomY;
				} else {
					// 如果下方沒有足夠空間，則移動到右側
					const potentialRightX = elementRight + 10;
					if (potentialRightX + containerWidth <= windowWidth - 20) {
						x = potentialRightX;
					}
				}
			}
		}

		this.$panel.css({
			left: `${x}px`,
			top: `${y}px`,
		});

		callback();
	}

    #moveToCursorPosition(callback, retry) {
        const windowWidth = $(window).width();
        const windowHeight = $(window).height();
        const containerWidth = this.$panel.width();
        const containerHeight = this.$panel.height();
        let x = windowMouseX + 10; 
        let y = windowMouseY - 10;
        let maxHeight = windowHeight; // 初始化最大高度為視窗高度
    
        // NOTE: 避免尚未完成渲染的時候，取得的 containerHeight 為 0
        if (!this.fixedSize) {
            if (retry < 30 && (containerHeight === this.panelHeight)) {
                setTimeout(() => {
                    this.#moveToCursorPosition(callback, retry + 1);
                }, 5);
                return;
            }
        }

        if (windowMouseX + containerWidth > windowWidth) {
            x = windowMouseX - containerWidth - 20;
        }
    
        if (windowMouseY + containerHeight > windowHeight - 20) {
            y = windowHeight - containerHeight - 20;
            y = y < 20 ? 20 : y;
        }
        else if (windowMouseY - 56 < 0) {
            y = 36;
        }

        maxHeight = windowHeight - y - 80;
    
        this.$panel.css({
            left: `${x}px`,
            top: `${y}px`,
        });

        // find [select-panel-list] and set max-height
        this.$panel.find("select-panel-list").css({
            'max-height': `${maxHeight - 40}px` // 設定最大高度
        });

        callback();
    };
}
function cartesianProduct(elements, length) {
	if (!length) {
		length = 10;
	}

	if (!Array.isArray(elements)) {
		throw new TypeError();
	}

	var end = elements.length - 1,
		result = [];

	function addTo(curr, start) {
		var first = elements[start],
			last = start === end;

		for (var i = 0; i < first.length; ++i) {
			var copy = curr.slice();
			copy.push(first[i]);

			if (result.length >= length) break;

			if (last) {
				result.push(copy);
			} else {
				addTo(copy, start + 1);
			}
		}
	}

	if (elements.length) {
		addTo([], 0);
	} else {
		result.push([]);
	}
	return result;
}
