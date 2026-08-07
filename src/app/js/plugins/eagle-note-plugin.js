/**
 * Eagle Note Plugin for mpv-video-player
 *
 * MpvPlugin 介面實作，讓 mpv-media-element 支援 Eagle 的視頻筆記功能。
 * 在進度條上顯示標記，並提供新增筆記按鈕。
 *
 * 使用方式：
 *   const EagleNotePlugin = require('./plugins/eagle-note-plugin');
 *   MpvVideoElement.use(EagleNotePlugin);
 *
 *   // 在 directive 中：
 *   var noteManager = video.plugins.get('eagle-notes');
 *   noteManager.setOnAdd(callback);
 *   noteManager.setComments(comments, duration);
 */

const STYLES = `
/* 標記容器 */
.eagle-video-comments {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    right: 0;
    pointer-events: none;
}

/* 標記：4px 垂直條（匹配 media-element 的 .video-comment 樣式） */
.eagle-video-comment {
    z-index: 10;
    position: absolute;
    top: 0;
    height: 100%;
    width: 4px;
    margin-left: -2px;
    background-color: var(--vp-text-color, rgba(255, 255, 255, 0.6));
    opacity: 0.6;
    cursor: context-menu;
    pointer-events: all;
    transition: opacity 200ms ease;
}

.eagle-video-comment:hover {
    opacity: 0.8;
}

.eagle-video-comment:hover .eagle-annotation {
    display: flex;
}

/* Tooltip：匹配 media-element 的 .annotation 樣式 */
.eagle-annotation {
    position: absolute;
    bottom: 32px;
    left: 50%;
    transform: translateX(-50%);
    display: none;
    justify-content: center;
    width: 200px;
    line-height: 1.4;
    pointer-events: none;
    text-align: left;
}

.eagle-annotation > div {
    display: inline-block;
    border-radius: 6px;
    background: var(--vp-tooltip-bg, rgba(0, 0, 0, 0.8));
    padding: 6px 8px;
    font-size: 12px;
    line-height: 18px;
    color: #fff;
    max-width: 200px;
    word-wrap: break-word;
}

/* 按鈕（匹配 vp-fullscreen-btn 樣式） */
.eagle-note-btn {
    width: var(--vp-button-size, 24px);
    height: var(--vp-button-size, 24px);
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    padding: 0;
    flex-shrink: 0;
    color: var(--vp-button-color, #BDBEC0);
    transition: background var(--vp-transition-duration, 0.15s),
                color var(--vp-transition-duration, 0.15s);
}

.eagle-note-btn:hover {
    background: var(--vp-button-hover-bg, rgba(44, 47, 50, 0.08));
    color: var(--vp-button-hover-color, #f8f9fb);
}

.eagle-note-btn svg {
    width: var(--vp-icon-size, 24px);
    height: var(--vp-icon-size, 24px);
    pointer-events: none;
}
`;

// SVG icon: Eagle 的 ic-toolbar-note.svg path data
var NOTE_ICON_SVG = '<svg viewBox="0 0 24 24" fill="currentColor">' +
    '<path fill-rule="evenodd" clip-rule="evenodd" d="M16.8861 11.2826C17.2928 10.8971 17.9023 10.9081 18.2967 11.3027L19.7073 12.7138C20.0976 13.1042 20.0976 13.7347 19.7073 14.125L15.6751 18.1593C15.2449 18.5897 14.6746 18.8599 14.0744 18.9099L13.0939 19C12.7934 19 12.5131 18.9294 12.2935 18.7098C12.0835 18.4996 11.9734 18.2093 12.0034 17.9091L12.0934 16.9283C12.1435 16.3277 12.4136 15.7573 12.8438 15.3269L16.8861 11.2826ZM19.007 13.4044L17.5964 11.9932L13.5541 16.0175C13.294 16.2877 13.1239 16.638 13.0939 17.0083L13.0039 17.9891L13.9843 17.8991C14.3645 17.869 14.7146 17.6989 14.9748 17.4387L19.007 13.4044Z"/>' +
    '<path fill-rule="evenodd" clip-rule="evenodd" d="M8.79998 6H13.2C14.0566 6 14.6389 6.00078 15.0889 6.03755C15.5274 6.07337 15.7516 6.1383 15.908 6.21799C16.2843 6.40973 16.5903 6.71569 16.782 7.09202C16.8617 7.24842 16.9266 7.47262 16.9624 7.91104C16.9864 8.20468 16.9951 8.5546 16.9982 9.00024H17.9983C17.9902 7.83517 17.9434 7.16876 17.673 6.63803C17.3854 6.07354 16.9264 5.6146 16.362 5.32698C15.7202 5 14.8801 5 13.2 5H8.79998C7.11983 5 6.27975 5 5.63801 5.32698C5.07353 5.6146 4.61459 6.07354 4.32697 6.63803C3.99998 7.27976 3.99998 8.11984 3.99998 9.8V14.2C3.99998 15.8802 3.99998 16.7202 4.32697 17.362C4.61459 17.9265 5.07353 18.3854 5.63801 18.673C6.27975 19 7.11983 19 8.79999 19H9.99998V18H8.79999C7.94341 18 7.36111 17.9992 6.91102 17.9624C6.47261 17.9266 6.2484 17.8617 6.092 17.782C5.71568 17.5903 5.40972 17.2843 5.21797 16.908C5.13828 16.7516 5.07336 16.5274 5.03754 16.089C5.00076 15.6389 4.99998 15.0566 4.99998 14.2V9.8C4.99998 8.94342 5.00076 8.36113 5.03754 7.91104C5.07336 7.47262 5.13828 7.24842 5.21797 7.09202C5.40972 6.71569 5.71568 6.40973 6.092 6.21799C6.2484 6.1383 6.47261 6.07337 6.91102 6.03755C7.36111 6.00078 7.94341 6 8.79998 6Z"/>' +
    '<rect x="6.99998" y="8" width="8" height="1" rx="0.5"/>' +
    '<rect x="6.99998" y="10" width="8" height="1" rx="0.5"/>' +
    '<rect x="6.99998" y="12" width="6" height="1" rx="0.5"/>' +
    '</svg>';

var EagleNotePlugin = {
    name: 'eagle-notes',
    version: '1.0.0',
    dependencies: ['progress'],
    styles: STYLES,
    install: function (player) {
        return new EagleNoteManager(player);
    }
};

function EagleNoteManager(player) {
    this.name = 'eagle-notes';
    this.player = player;
    this._onAddCallback = null;
    this._comments = null;
    this._duration = 0;
    this.toggleBtn = null;
    this.markersContainer = null;
    this._enabled = true;
    this.eventCleanups = [];

    this.initialize();
}

EagleNoteManager.prototype.initialize = function () {
    var shadowRoot = this.player.shadowRoot;
    if (!shadowRoot) return;

    this.createToggleButton(shadowRoot);
    this.createMarkersContainer(shadowRoot);

    var self = this;
    var onDurationChange = function () {
        self.renderMarkers();
    };
    this.player.addEventListener('durationchange', onDurationChange);
    this.eventCleanups.push(function () {
        self.player.removeEventListener('durationchange', onDurationChange);
    });
};

/**
 * 在 .vp-controls-right 中建立筆記按鈕
 */
EagleNoteManager.prototype.createToggleButton = function (shadowRoot) {
    var container = shadowRoot.querySelector('.vp-controls-right');
    if (!container) return;

    this.toggleBtn = document.createElement('button');
    this.toggleBtn.className = 'vp-btn eagle-note-btn';
    this.toggleBtn.title = '新增筆記 (N)';
    this.toggleBtn.dataset.order = '15';
    this.toggleBtn.innerHTML = NOTE_ICON_SVG;

    var self = this;
    var onClick = function (e) {
        e.stopPropagation();
        if (self._onAddCallback) {
            self._onAddCallback();
        }
    };
    this.toggleBtn.addEventListener('click', onClick);
    this.eventCleanups.push(function () {
        self.toggleBtn.removeEventListener('click', onClick);
    });

    this.insertByOrder(container, this.toggleBtn);
};

/**
 * 在 .mpv-progress-bar 或 .vp-progress-bar 中建立標記容器
 */
EagleNoteManager.prototype.createMarkersContainer = function (shadowRoot) {
    var progressBar = shadowRoot.querySelector('.mpv-progress-bar, .vp-progress-bar');
    if (!progressBar) {
        // 如果還沒有 progress bar，監聽 durationchange 重試一次
        var self = this;
        var retryHandler = function () {
            self.player.removeEventListener('durationchange', retryHandler);
            var bar = self.player.shadowRoot.querySelector('.mpv-progress-bar, .vp-progress-bar');
            if (bar && !self.markersContainer) {
                self.markersContainer = document.createElement('div');
                self.markersContainer.className = 'eagle-video-comments';
                bar.appendChild(self.markersContainer);
                self.renderMarkers();
            }
        };
        this.player.addEventListener('durationchange', retryHandler);
        this.eventCleanups.push(function () {
            self.player.removeEventListener('durationchange', retryHandler);
        });
        return;
    }

    this.markersContainer = document.createElement('div');
    this.markersContainer.className = 'eagle-video-comments';
    progressBar.appendChild(this.markersContainer);
};

/**
 * 渲染進度條上的標記
 */
EagleNoteManager.prototype.renderMarkers = function () {
    if (!this.markersContainer) return;

    this.markersContainer.innerHTML = '';

    var comments = this._comments;
    var duration = this._duration || this.player.duration;
    if (!comments || !comments.length || !duration) return;

    var self = this;
    for (var i = 0; i < comments.length; i++) {
        var comment = comments[i];
        if (comment.duration === undefined || comment.duration === null) continue;

        var marker = document.createElement('div');
        marker.className = 'eagle-video-comment';
        marker.style.left = (comment.duration / duration * 100) + '%';
        marker.setAttribute('comment-id', comment.id || i);

        // Annotation tooltip
        var annotation = document.createElement('div');
        annotation.className = 'eagle-annotation';
        var annotationText = document.createElement('div');
        annotationText.textContent = comment.annotation || '';
        annotation.appendChild(annotationText);
        marker.appendChild(annotation);

        // Events
        (function (commentItem) {
            marker.addEventListener('mouseenter', function () {
                self.player.tooltipEnabled = false;
            });
            marker.addEventListener('mouseleave', function () {
                self.player.tooltipEnabled = true;
            });
            marker.addEventListener('click', function (e) {
                e.stopPropagation();
                self.player.currentTime = commentItem.duration;
            });
        })(comment);

        this.markersContainer.appendChild(marker);
    }
};

// ===== 公開 API =====

/**
 * 設定按鈕點擊回呼（由 directive 呼叫）
 */
EagleNoteManager.prototype.setOnAdd = function (callback) {
    this._onAddCallback = callback;
};

/**
 * 更新 comments 資料並重新渲染標記（由 directive 呼叫）
 */
EagleNoteManager.prototype.setComments = function (comments, duration) {
    this._comments = comments || [];
    if (duration) {
        this._duration = duration;
    }
    this.renderMarkers();
};

/**
 * 顯示按鈕
 */
EagleNoteManager.prototype.showButton = function () {
    if (this.toggleBtn) {
        this.toggleBtn.style.display = '';
    }
};

/**
 * 隱藏按鈕
 */
EagleNoteManager.prototype.hideButton = function () {
    if (this.toggleBtn) {
        this.toggleBtn.style.display = 'none';
    }
};

/**
 * 按 data-order 屬性排序插入元素
 */
EagleNoteManager.prototype.insertByOrder = function (container, element) {
    var order = parseInt(element.dataset.order || '999', 10);
    var children = Array.from(container.children);
    var insertBefore = children.find(function (child) {
        var childOrder = parseInt(child.dataset.order || '999', 10);
        return childOrder > order;
    });
    if (insertBefore) {
        container.insertBefore(element, insertBefore);
    } else {
        container.appendChild(element);
    }
};

// ===== PluginInstance 標準方法 =====

EagleNoteManager.prototype.enable = function () {
    this._enabled = true;
    if (this.toggleBtn) {
        this.toggleBtn.classList.remove('disabled');
    }
};

EagleNoteManager.prototype.disable = function () {
    this._enabled = false;
    if (this.toggleBtn) {
        this.toggleBtn.classList.add('disabled');
    }
};

Object.defineProperty(EagleNoteManager.prototype, 'enabled', {
    get: function () {
        return this._enabled;
    }
});

EagleNoteManager.prototype.destroy = function () {
    for (var i = 0; i < this.eventCleanups.length; i++) {
        this.eventCleanups[i]();
    }
    this.eventCleanups = [];

    if (this.toggleBtn) {
        this.toggleBtn.remove();
        this.toggleBtn = null;
    }
    if (this.markersContainer) {
        this.markersContainer.remove();
        this.markersContainer = null;
    }

    this._onAddCallback = null;
    this._comments = null;
};

module.exports = EagleNotePlugin;
