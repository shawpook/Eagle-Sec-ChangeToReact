# -*- coding: utf-8 -*-
# b1-9q：openItemContextMenu（bundle 43451-44605）大块移植。
# - 主体：$scope.→s. / $rootScope.→s.$root. 机械适配后包装成 fns["openItemContextMenu"]。
# - 辅助件：bundleGlobals 补 4 个 bundle 顶层全局（removePlayingAudios+cleanupBoxHoverPreview/
#   openWithApplicationPath/ayncsImagesGeneratePalette/ReverseImageSearch 类）；
#   controllerFns 补 URL_MODULE/ContextMenu 模块常量 + renameImages/enableImageNameEditable
#   link 级函数（updateSuggestions 先例）。
import io, re, sys

CF = 'src/app/react/core/controllerFns.ts'
BG = 'src/app/react/core/bundleGlobals.ts'
SRC = 'tests-tmp/b49q-openItemContextMenu-src.txt'

with io.open(SRC, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# 函数体 = 提取件第 1..1154 行（43451..44604）
body_lines = lines[:1154]
body = ''.join(body_lines)
# 机械适配
body = body.replace('$scope.', 's.')
body = body.replace('$rootScope.', 's.$root.')
# 去一层缩进（8 空格 → 4），相对缩进保留
adapted = '\n'.join((l[4:] if l.startswith('        ') else l) for l in body.split('\n'))

WRAPPER = '''  /* openItemContextMenu（bundle 43451-44605 逐字；b1-9q 大块移植——条目右键真实菜单）。
     适配：$scope→s / $rootScope→s.$root（机械）；ContextMenu → 模块常量（bundle 15836-15843
     逐字语义：根 scope 广播 CONTEXTMENU.OPEN/CLOSE，React ContextMenuPanel 消费）；
     URL_MODULE → 模块级惰性解析（fileUrlHelper 同款）；removePlayingAudios/
     openWithApplicationPath/ayncsImagesGeneratePalette/ReverseImageSearch → bundleGlobals
     同名供给（bundle 顶层全局的原生归宿）；bare eagle/$/_/i18n/$bodyScope/swal/preferences/
     process 经 window 全局回退解析（本文件既有先例）。 */
  fns["openItemContextMenu"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (async (event, target) => {
'''

FOOTER = '''    }).apply(null, args);
  };
'''

with io.open(CF, 'r', encoding='utf-8') as f:
    cf = f.read()

if 'fns["openItemContextMenu"]' in cf:
    print('SKIP: controllerFns already has openItemContextMenu')
else:
    anchor = '  fns["addToRecentFolders"] = function (...args) {'
    if anchor not in cf:
        print('FAIL: controllerFns anchor missing'); sys.exit(1)
    entry = WRAPPER + adapted + '\n' + FOOTER + '\n' + anchor
    cf = cf.replace(anchor, entry, 1)
    print('controllerFns: main entry inserted')

# ── controllerFns 模块级辅助：URL_MODULE / ContextMenu / renameImages / enableImageNameEditable ──
HELPERS = '''
// ── b1-9q：openItemContextMenu 依赖的 link 级函数与模块常量 ──────────────────

// URL_MODULE（bundle 顶层 const；fileUrlHelper.ts 同款惰性解析）
const URL_MODULE: any = (() => {
  const req = (window as any).require;
  if (typeof req !== 'function') return (window as any).URL_MODULE;
  const appRoot = (window as any).appRoot;
  const rootPath = appRoot && (appRoot.path || appRoot);
  if (rootPath) { try { return req(`${rootPath}/my_modules/url`); } catch (err) {} }
  try { return req('url'); } catch (err) { return (window as any).URL_MODULE; }
})();

// ContextMenu（bundle 15836-15843 逐字；angular.element("html").scope() → getBodyScope()——
// 根 scope 广播，React ContextMenuPanel 经 $on('CONTEXTMENU.OPEN') 消费）
const ContextMenu: any = {
  open(options: any) {
    const root: any = getBodyScope();
    root && root.$broadcast && root.$broadcast('CONTEXTMENU.OPEN', options);
  },
  close() {
    const root: any = getBodyScope();
    root && root.$broadcast && root.$broadcast('CONTEXTMENU.CLOSE');
  },
};

// renameImages（bundle 41480-41495 逐字；$scope→getBodyScope()。bare event 为 bundle
// window.event 怪癖逐字保留——Chromium 下 bare 标识符经全局回退读到 window.event）
function renameImages() {
  const s: any = getBodyScope();
  if (!s) return;
  if (s.selected.length > 1) {
    s.$root.$broadcast('OPEN_RENAME', {
      type: 'IMAGE',
      images: s.selected,
    });
  }
  else {
    var imageId = s.selected[0].id;
    var $box = $(`#box-${imageId}`);
    if ($box.length > 0) {
      setTimeout(() => {
        enableImageNameEditable(event, $box.find('.name'));
      }, 50);
    }
  }
}

// enableImageNameEditable（bundle 21975-22062 逐字；$scope→getBodyScope()——原码
// blur 回调内 angular.element("body").scope() 的 shim 等价；debounce 经 window.debounce
// 全局回退；exitEditable 为原码内嵌函数逐字保留）
function enableImageNameEditable(event: any, $name: any) {
  if (!$name) return;
  if ($name.hasClass('editable')) return;
  var originalName = $name.text().trim();
  $name.attr('contenteditable', 'true');
  $name.addClass('editable');
  $name.focus();
  setTimeout(function () {
    $name.focus();
    $name.select();
    document.execCommand('selectAll', false, null);
  }, 50);

  $name.off('mousedown').on('mousedown', function (event: any) {
    event.stopPropagation();
  });

  $name.off('keydown').on('keydown', function (event: any) {
    var keyCode = event.keyCode;
    switch (keyCode) {
      case 13:
        event.preventDefault();
        event.stopPropagation();
        $name.trigger('blur');
        break;
      case 27:
        event.preventDefault();
        event.stopPropagation();
        $name.html(`<span>${originalName}</span>`);
        exitEditable();
        break;
      case 65:
        if (event.metaKey || event.ctrlKey) {
          event.preventDefault();
          event.stopPropagation();
          document.execCommand('selectAll', false, null);
        }
        break;
    }
  });

  $name.off('paste').on('paste', function (e: any) {
    e.preventDefault();
    var text = (e.originalEvent || e).clipboardData.getData('text/plain');
    document.execCommand('insertHTML', false, text);
  });

  $name.off('blur').on('blur', debounce(function () {
    exitEditable();
    var $scope = getBodyScope();
    var newName = $name.text();
    if (!newName || !newName.trim()) {
      $name.html(`<span>${originalName}</span>`);
      return;
    }
    if (newName !== originalName && $scope && $scope.selected[0]) {
      var name = newName;
      var image = $scope.selected[0];
      name = name.substr(0, remainingFilenameLength($scope.libraryPath));
      name = sanitize(name).replace(/%/g, '').replace(/&lt;/g, '').replace(/&gt;/g, '').trim();
      name = _.unescape(name);
      eagle.inspector.newName = name;

      if (emojiRegex.test(name)) {
        name = name.replace(emojiRegex, '');
        eagle.inspector.newName = name;
      }

      if (name) {
        image.oldName = originalName;
        image.name = name;
        image.newName = name;
      }
      $name.html(`<span>${name}</span>`);
      console.log(`${originalName} > ${name}`);
      ayncsImagesChange([image]);
      hiddenByCurrentFilter([image]);
      $scope.$evalAsync();
      try { electronLog && electronLog.info(`[app] Change list item's name: ${originalName}(${image.id}) > ${newName}`); } catch (err) {}
    }
  }, 200, true));

  function exitEditable() {
    $name.attr('contenteditable', 'false');
    $name.removeClass('editable');
    $name.off('blur').off('keydown').off('paste').off('mousedown');
    $name.blur();
  }
}
'''

if 'function enableImageNameEditable' in cf:
    print('SKIP: controllerFns helpers already present')
else:
    anchor2 = 'export function makeControllerFns(getScope: () => any) {'
    if anchor2 not in cf:
        print('FAIL: makeControllerFns anchor missing'); sys.exit(1)
    cf = cf.replace(anchor2, HELPERS + '\n' + anchor2, 1)
    print('controllerFns: helpers inserted')

with io.open(CF, 'w', encoding='utf-8', newline='') as f:
    f.write(cf)

# ── bundleGlobals：4 个 bundle 顶层全局 ──
BG_ADD = '''
  // ── b1-9q：openItemContextMenu 依赖的 bundle 顶层全局（原码 51042/49552/49777/985）──
  // playingAudiosElements（bundle 全局 let——cleanupBoxHoverPreview 归零写）
  if (!w.playingAudiosElements) w.playingAudiosElements = [];

  // cleanupBoxHoverPreview（bundle 50414-50457 逐字；hover 预览/音视频/iframe 清理）
  if (!w.cleanupBoxHoverPreview) {
    w.cleanupBoxHoverPreview = function ($box: any) {
      if (!$box || !$box.length || !$box.hasClass('hover-active')) return;
      $box.removeClass('hover-active');
      clearTimeout($box[0]._spinnerTimeout);

      var $thumbnail = $box.find('.thumbnail');
      var $image = $thumbnail.find('img');
      $image.show();

      // Video — pause 停渲染 → remove 脫離 DOM → 清 src 釋放資源
      $thumbnail.find('video').each(function (this: any) {
        try { this.pause(); } catch (e) {}
        $(this).remove();
        try { this.src = ''; this.load(); } catch (e) {}
      });

      // MPV
      $thumbnail.find('mpv-video').each(function (this: any) {
        try { this.destroy(); } catch (e) {}
      }).remove();

      // Audio
      $thumbnail.find('audio').each(function (this: any) {
        try { this.pause(); this.src = ''; } catch (e) {}
      }).remove();
      w.playingAudiosElements = [];

      // Iframe (YouTube/Vimeo)
      $thumbnail.find('.iframe-wrap').each(function (this: any) {
        try { $(this).find('iframe')[0].src = ''; } catch (e) {}
      }).remove();

      // 停用 iframe postMessage 狀態，避免 stale message handler 繼續更新已移除的 UI
      if (typeof w._vimeoPlayerState !== 'undefined') w._vimeoPlayerState.active = false;
      if (typeof w._ytPlayerState !== 'undefined') w._ytPlayerState.active = false;

      // UI
      $thumbnail.find('.video-loading-spinner').remove();
      $thumbnail.find('.video-progress-bar, .audio-progress-bar, .audio-progress-bar-cursor, .current-time, .controls').remove();
      $thumbnail.find('.mute-toggle').off().remove();
      $thumbnail.find('.autoplay-toggle').off();
      $image.off('mousedown.duration').off('mousemove.progressCursor');
      $thumbnail.find('.hover-sentinel').remove();
    };
  }

  // removePlayingAudios（bundle 51042-51045 逐字）
  if (!w.removePlayingAudios) {
    w.removePlayingAudios = function () {
      w.$('#box-container .box.hover-active').each(function (this: any) {
        w.cleanupBoxHoverPreview($(this));
      });
    };
  }

  // openWithApplicationPath（bundle 49552-49565 逐字）
  if (!w.openWithApplicationPath) {
    w.openWithApplicationPath = function (appPath: any, filePath: any, image: any) {
      var vidx = filePath.indexOf('?v=');
      if (vidx > -1 && filePath) {
        filePath = filePath.slice(0, vidx);
      }
      const spawnSync = w.require('child_process').spawnSync;
      var params = ['-a', appPath, decodeURIComponent(filePath)];
      var cp = spawnSync('open', params, {
        timeout: 10000
      });
      if (cp && cp.error) {
        w.process.kill(cp.pid);
      }
      w.RecentFileManager.addFile(image);
    };
  }

  // ayncsImagesGeneratePalette（bundle 49777-49799 逐字；backgroundWindowID 判定与
  // ayncsImagesChange 同型）
  if (!w.ayncsImagesGeneratePalette) {
    w.ayncsImagesGeneratePalette = function (images: any) {
      if (!images || images.length === 0) return;
      setTimeout(() => {
        let total = images.length;
        let once = 300;
        let loopCount = total / once;
        let countOfSend = 0;

        function send() {
          var start = countOfSend * once;
          var willSendImages = images.slice(start, start + once);
          countOfSend += 1;
          if (w.backgroundWindowID === undefined) {
            w.__eagleIpc.send('regenerate-palette', willSendImages);
          }
          else {
            w.__eagleIpc.sendTo(w.backgroundWindowID, 'regenerate-palette', willSendImages);
          }
          loop();
        }

        function loop() {
          if (countOfSend < loopCount) {
            window.requestAnimationFrame(send);
          }
        }
        loop();
      }, 0);
    };
  }

  // ReverseImageSearch（bundle 985-1011 逐字：类 + eagle.reverseImageSearch 挂载）
  if (!w.ReverseImageSearch) {
    w.ReverseImageSearch = class ReverseImageSearch {
      #pluginId = 'eagle-plugin-search-by-image';

      static ENGINES = {
        GOOGLE: 'google',
        YANDEX: 'yandex',
        BING: 'bing',
        TINEYE: 'tineye',
        BAIDU: 'baidu',
        SOGOU: 'sogou',
        SAUCENAO: 'saucenao'
      };

      search(item: any, searchEngine: any = 'google') {
        if (!item) return;
        if (!w.pluginModule.checkPluginInstalled(this.#pluginId)) {
          w.pluginModule.showInstallPluginDialog(this.#pluginId);
          return;
        }
        w.pluginModule.openPluginById(this.#pluginId, { searchEngine: searchEngine });
      }
    };
    w.eagle.reverseImageSearch = new w.ReverseImageSearch();
  }
'''

with io.open(BG, 'r', encoding='utf-8') as f:
    bg = f.read()

if 'w.ayncsImagesGeneratePalette' in bg:
    print('SKIP: bundleGlobals already has palette')
else:
    anchor3 = '  if (!w.guid) w.guid = _guid;'
    if anchor3 not in bg:
        print('FAIL: bundleGlobals anchor missing'); sys.exit(1)
    bg = bg.replace(anchor3, BG_ADD + '\n' + anchor3, 1)
    print('bundleGlobals: globals inserted')

with io.open(BG, 'w', encoding='utf-8', newline='') as f:
    f.write(bg)

print('DONE')
