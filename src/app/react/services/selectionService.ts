import { getBodyScope } from '../core/appCore';
import { cancelCleanSelectedTimeout } from '../services/batchOpsService';
import { syncInspectorFromScope } from '../store/inspectorState';
import { syncListFromScope } from '../store/listState';
import { machineryEnterDetailMode, machineryOpenPluginPanel } from '../core/dataMachinery';
import { openFileWithDefault, openFilesWithDefault } from '../core/itemDomain';
import { scopeEvalAsync } from '../global/scopeShim';
import { q, hasClass, textEl, setAttrEl, addClassEl, removeClassEl, setHtmlEl, focusOn, selectText, onEl, offAllEl, blurEl } from '../utils/domQuery';
import { machineryGetSelection, machineryUpdateSelection } from '../core/selectionViewDomain';
/**
 * b1-9bb：选中集服务 —— updateSelection 热点收编。
 *
 * 实现体仍在 machinery（dataMachinery.machineryUpdateSelection，30ms 防抖派生
 * inspector 面板全部字段后广播 UPDATE_INSPECTOR）；本模块是**组件侧唯一入口**
 * （此前 3 处直呼 scope 属性）。注意同名不同义：components/inspector/inspectorActions.ts
 * 的本地 updateSelection 是 React 镜像版（不走 scope），互不相干。S7 inspector 竖切
 * 把实现体迁入本模块并退役 scope 挂载。
 */

export function updateSelection(): void {
  const s = getBodyScope();
  if (s) machineryUpdateSelection(s);
}

// ═══ b1-9bz-A：controllerFns 表体归位（逐字平移；getScope()→getBodyScope()；表项指针化）═══
// —— controllerFns 模块级声明随迁（verbatim；按原声明顺序防 TDZ）——
const _req: any = (n: string) => { try { return (window as any).require(n); } catch (err) { return undefined; } };

const EagleConfig: any = (window as any).EagleConfig || {};

const AUDIO_TYPES: any = {}; (EagleConfig.AUDIO_FORMATS || []).forEach(function (ext: string) { AUDIO_TYPES[ext] = true; });

const currentWindow: any = (window as any).electron?.remote?.getCurrentWindow?.() || _req('@electron/remote')?.getCurrentWindow?.();

const electronSettings: any = (window as any).electronSettings;

const ipcRenderer: any = (window as any).__eagleIpc || (window as any).electron?.ipcRenderer;

let preferences: any = (window as any).electronSettings?.getPreferences?.() || {};

const remote: any = _req('@electron/remote');

function enableImageNameEditable(event: any, nameEl: HTMLElement | null) {
  if (!nameEl) return;
  if (hasClass(nameEl, 'editable')) return;
  var originalName = textEl(nameEl).trim();
  setAttrEl(nameEl, 'contenteditable', 'true');
  addClassEl(nameEl, 'editable');
  focusOn(nameEl);
  setTimeout(function () {
    focusOn(nameEl);
    selectText(nameEl);
    document.execCommand('selectAll', false, null);
  }, 50);

  onEl(nameEl, 'mousedown', function (event: any) {
    event.stopPropagation();
  });

  onEl(nameEl, 'keydown', function (event: any) {
    var keyCode = event.keyCode;
    switch (keyCode) {
      case 13:
        event.preventDefault();
        event.stopPropagation();
        nameEl.blur();
        break;
      case 27:
        event.preventDefault();
        event.stopPropagation();
        setHtmlEl(nameEl, `<span>${originalName}</span>`);
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

  onEl(nameEl, 'paste', function (e: any) {
    e.preventDefault();
    var text = (e.originalEvent || e).clipboardData.getData('text/plain');
    document.execCommand('insertHTML', false, text);
  });

  onEl(nameEl, 'blur', debounce(function () {
    exitEditable();
    var $scope = getBodyScope();
    var newName = textEl(nameEl);
    if (!newName || !newName.trim()) {
      setHtmlEl(nameEl, `<span>${originalName}</span>`);
      return;
    }
    if (newName !== originalName && $scope && $scope.selected[0]) {
      var name = newName;
      var image = $scope.selected[0];
      name = name.substr(0, remainingFilenameLength($scope.libraryPath));
      name = sanitize(name).replace(/%/g, '').replace(/&lt;/g, '').replace(/&gt;/g, '').trim();
      name = unescape(name);
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
      setHtmlEl(nameEl, `<span>${name}</span>`);
      console.log(`${originalName} > ${name}`);
      ayncsImagesChange([image]);
      hiddenByCurrentFilter([image]);
      scopeEvalAsync();
      try { electronLog && electronLog.info(`[app] Change list item's name: ${originalName}(${image.id}) > ${newName}`); } catch (err) {}
    }
  }, 200, true));

  function exitEditable() {
    setAttrEl(nameEl, 'contenteditable', 'false');
    removeClassEl(nameEl, 'editable');
    offAllEl(nameEl);
    nameEl.blur();
  }
}

// —— link 级共享态（原 makeControllerFns 闭包声明）——
var __lv_image: any;

let lvInited = false;
const initLinkVars = () => {
  if (lvInited) return;
  lvInited = true;
};

const getScope = getBodyScope;  // b1-9bz-A：原 makeControllerFns(getScope) 注入的等价别名

export function onBoxMouseup(...args: any[]) {
    const s = getScope();
    if (!s) return;
    return (function (event: any, image: any) {
            if (event && event.button === 0) {

                // 如果從 sidebar focus 狀態點擊列表已選擇圖片，不該造成已選擇圖片選取狀態消失
                if (s.$root.currentFocus !== "content" && s.selected.length > 1) {
                    if (image && s.selectedMappings[image.id]) {
                        s.$root.currentFocus = "content";
                        return;
                    }
                }
                if (image && s.selectedMappings[image.id]) {
                    // 如果點擊這些按鍵，就許消選取
                    if (event) {
                        if (event.metaKey || event.shiftKey || event.ctrlKey) {}
                        // 符合系统操作逻辑
                        else {
                            var targetSelectedIndex = s.allData.indexOf(image);
                            s.selected = [image];
                            syncInspectorFromScope();
                            s.lastSelectedIndex = targetSelectedIndex;
                        }
                    }
                    return;
                }
            }
    }).apply(null, args);
  }

export function onBoxListDblClick(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function (event: any, item: any, isName: any, $element: any) {
            if (isName) {
                enableImageNameEditable(event, $element);
                return;
            }
            if (!item) return;
            if (event.metaKey || event.ctrlKey) {
                if (
                    (EagleConfig.SUPPORT_FORMATS[item.ext] && !AUDIO_TYPES[item.ext]) ||
                    (window as any).pluginModule?.previewExtension?.viewerPluginMap?.[item.ext]
                ) {
                    openInNewWindow([item]);
                    (window as any).analytics?.event?.('NewWindow', 'Open', item.ext);
                }
                return;
            }
            else if (event.altKey) {
                openFilesWithDefault([item]);
                return;
            }
            else {
                if (s.$root.preferences.habits.doubleclick !== 'external') {
                    machineryEnterDetailMode(s, event, item);
                }
                else {
                    // 使用预设软体开启
                    openFileWithDefault(item);
                }
                scopeEvalAsync();
            }
    }).apply(null, args);
  }

export function onDetailClick(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function($event, __lv_image) {
            if ($event.which == 2) {
                ipcRenderer.send('toggle-slideshow');
            }
        }).apply(null, args);
  }

export function select(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function(event, __lv_image) {

        	if (event && event.button >= 3) {
        		return;
        	}

        	if (event) event.stopPropagation();

            // 中键点击
            if (event && event.button === 1) {
                if (s.$root.preferences.habits.middleBtn === "openNewWindow") {
                    event && event.preventDefault();
                    if (!AUDIO_TYPES[__lv_image.ext]) {
						openInNewWindow([__lv_image]);
                        RecentFileManager.addFile(__lv_image);
	                    analytics.event('NewWindow', 'Open', __lv_image.ext);
                    }
                }
				else if (s.$root.preferences.habits.middleBtn === "openPluginPanel") {
					event && event.preventDefault();
					machineryOpenPluginPanel(s);
				}
                return;
            }

            if (HoverPreview.isShow) {
                HoverPreview.hide();
                (window as any).HoverPreviewKeydown = false;
                HoverPreview.lastElem = undefined;
            }

            if (s.$root.currentFocus !== "content" && s.selected.length > 1) {
            	if (__lv_image && s.selectedMappings[__lv_image.id]) {
            		return;
            	}
            }

            s.$root.currentFocus = "content";
            s.selectedFolderMappings = {};
            syncListFromScope();

            blurEl("input:focus");
            blurEl("[contenteditable]:focus");

            cancelCleanSelectedTimeout();

            if (s.isPreviewing) {
                s.isPreviewing = false;
                currentWindow.closeFilePreview();
            }
            window.getSelection().removeAllRanges();

            if (!__lv_image) {
                return;
            }

            // 如果點擊的內容已經選取
            if (__lv_image && s.selectedMappings[__lv_image.id]) {
                // 如果點擊這些按鍵，就許消選取
                if (event) {

                    // Note: macOS control + 点击等同右键
                    let cancelSelect = false;
                    if (process.platform === 'darwin') {
                        cancelSelect = event.metaKey || event.shiftKey;
                    }
                    else {
                        cancelSelect = event.shiftKey || event.ctrlKey;
                    }

                    if (cancelSelect) {
                    	if (event.button !== 2) {
	                        var __lv_idx = s.selected.indexOf(__lv_image);
	                        s.selected.splice(__lv_idx, 1);
	                        syncInspectorFromScope();
	                        delete s.selectedMappings[__lv_image.id];
                        }
                    }
                }
                return;
            }

            var targetSelectedIndex = s.allData.indexOf(__lv_image);

            if (event && !event.metaKey && !event.shiftKey && !event.ctrlKey) {
                s.selected = [];
                syncInspectorFromScope();
                s.lastSelectedIndex = targetSelectedIndex;
            }
            if (event && (event.metaKey || event.ctrlKey) ) {
                s.lastSelectedIndex = targetSelectedIndex;
            }
            if (event && event.shiftKey) {
                s.selected.push(__lv_image);
                syncInspectorFromScope();
                s.selectedMappings[__lv_image.id] = true;
                var selection = machineryGetSelection(s);

                var __lv_start = selection.start;
                var end = selection.end;

                if (s.lastSelectedIndex >= 0) {
                    __lv_start = s.lastSelectedIndex;
                }

                if (targetSelectedIndex >= 0) {
                    end = targetSelectedIndex;
                }

                if (__lv_start > end) {
                    [__lv_start, end] = [end, __lv_start];
                }

                var invert = selection.invert;
                if (!invert) {
                    for (var i = __lv_start; i <= end; i++) {
                        if (s.allData[i]) {
                            var alidx = s.selected.indexOf(s.allData[i]);
                            if (alidx !== -1) {
                                s.selected.splice(alidx, 1);
                                syncInspectorFromScope();
                            }
                            s.selected.push(s.allData[i]);
                            syncInspectorFromScope();
                            s.selectedMappings[s.allData[i].id] = true;
                        }
                    }
                }
                else {
                    for (var i = end; i >= __lv_start; i--) {
                        if (s.allData[i]) {
                            var alidx = s.selected.indexOf(s.allData[i]);
                            if (alidx !== -1) {
                                s.selected.splice(alidx, 1);
                                syncInspectorFromScope();
                            }
                            s.selected.push(s.allData[i]);
                            syncInspectorFromScope();
                            s.selectedMappings[s.allData[i].id] = true;
                        }
                    }
                }
            } else if (!s.selectedMappings[__lv_image.id]) {
                if (__lv_image && s.selected.indexOf(__lv_image) === -1) {
                    s.selected.push(__lv_image);
                    syncInspectorFromScope();
                    s.selectedMappings[__lv_image.id] = true;
                }
            }
            s.selected = [...new Set(s.selected)];
            syncInspectorFromScope();
        }).apply(null, args);
  }
