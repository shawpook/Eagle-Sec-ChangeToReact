import { detailZoom } from '../../core/smoothZoomEngine';
import { contextMenuOpenChannel, openAboutPanelChannel, rebindRefreshChannel, refreshVideoCommentsChannel, setFolderPasswordChannel, updateInspectorChannel } from '../../global/bus';
import { saveFolder } from '../../services/folderService';
import { t } from '../../global/eagleGlobals';
import { $, getIpc, req, getCurrentWindow } from '../detail/detailHooks';
import { unescape } from '../../utils/lang';
import { rememberVideoCurrentTime } from '../../services/mediaService';
import { getBodyScope, getRootScope, scopeApply } from '../../core/appCore';
import { machineryCheckOperationSafety, machineryEditTag, machineryEnterDetailMode } from '../../core/dataMachinery';
import { copyTags, pasteTags } from '../../services/batchOpsService';
import { openItemContextMenu } from '../../services/itemMenuService';
import { scopeEvalAsync } from '../../global/scopeShim';

/**
 * 阶段6：检查器行为转写 —— inspector 指令 link（bundle 54273-55300）逐字移植。
 *
 * 原函数挂在 link 作用域上，ng-click 等由模板消费；接管后等价函数改由 React 事件调用，
 * 数据读写仍然走 eagle.inspector（global）与 $bodyScope，与旧版共享同一份状态。
 */

const emojiRegex = /\p{Emoji_Presentation}|\p{Extended_Pictographic}|([0-9]\u{FE0F}\u{20E3})|([\*#\u{1F51F}]\u{FE0F}\u{20E3})/gmu;

/** 原 ContextMenu.open（class 声明在 bundle 闭包内不可达，等价发射同一通道）。 */
export function contextMenuOpen(options: any) {
  // b1-9bo：CONTEXTMENU 频道切 eagleBus（b1-9ao 时代的 htmlScope/angular 缺席问题
  // 随频道切换一并消亡——不再依赖 scope 面）
  contextMenuOpenChannel.emit(options);
}

const isUrlLike = (value: string): boolean => {
  // 原 is.url(...)（is-js 模块绑定在 bundle 闭包内不可达）；等价语义：http(s)/ftp 协议或 www. 前缀
  if (typeof window !== 'undefined' && (window as any).is?.url) return !!(window as any).is.url(value);
  return /^(https?|ftp):\/\/[^\s]+$/.test(value) || /^www\.[^\s]+$/.test(value);
};

/* ---------------- updateSelection（54677-54826，含 30ms debounce） ---------------- */

let updateSelectionTimeout: any;

function sortTags(scope: any, original: string[]): string[] {
  try {
    if (!original || original.length === 0) return original;
    let tags = [...original];

    const tagGroupsIndexMap: Record<string, number> = {};
    (scope.TagManager.groups || []).forEach((tagGroup: any, index: number) => {
      tagGroupsIndexMap[tagGroup.id] = index;
    });
    tagGroupsIndexMap['none'] = (scope.TagManager.groups || []).length;

    tags = tags.sort((tagA, tagB) => {
      const a = scope.TagManager.tagMappings[tagA];
      const b = scope.TagManager.tagMappings[tagB];
      const aName = a.name;
      const bName = b.name;
      const aGroup = a?.groups?.[0] || 'none';
      const bGroup = b?.groups?.[0] || 'none';

      if (tagGroupsIndexMap[aGroup] < tagGroupsIndexMap[bGroup]) return -1;
      if (tagGroupsIndexMap[aGroup] > tagGroupsIndexMap[bGroup]) return 1;
      if (aName < bName) return -1;
      if (aName > bName) return 1;
      return 0;
    });

    return tags;
  } catch (err) {
    console.error(err);
    return original;
  }
}

export function updateSelection() {
  clearTimeout(updateSelectionTimeout);
  updateSelectionTimeout = setTimeout(function () {
    scopeApply(getBodyScope(), function (s) {
      const eagleIns = (window as any).eagle.inspector;
      const selected = Array.isArray(s.selected) ? s.selected : [];
      const i18n = (window as any).i18n;
      if (selected.length > 1) {
        eagleIns.newNamePlaceholder = i18n.__('inspector.names.multipleTitles');
        eagleIns.newUrlPlaceholder = i18n.__('inspector.names.multipleUrls');
        eagleIns.newName = eagleIns.calculateName(selected);
        eagleIns.newUrl = eagleIns.calculateUrl(selected);
        eagleIns.newTags = eagleIns.calculateTags(selected);
        eagleIns.newAnnotation = eagleIns.calculateAnnotation(selected);
        eagleIns.folders = eagleIns.calculateFolders(selected);
        eagleIns.star = eagleIns.calculateStar(selected);
        eagleIns.size = eagleIns.calculateFileSize(selected);
        eagleIns.activeTab = 'ITEM';
      } else if (selected.length == 1) {
        if (selected[0]) {
          eagleIns.newNamePlaceholder = i18n.__('title');
          eagleIns.newUrlPlaceholder = 'http://';
          eagleIns.newName = selected[0].name || '';
          eagleIns.newUrl = selected[0].url || '';
          eagleIns.newTags = selected[0].tags;
          eagleIns.newAnnotation = selected[0].annotation || '';
          eagleIns.folders = [];
          eagleIns.star = selected[0].star || 0;
          eagleIns.activeTab = 'ITEM';
        }
      } else {
        eagleIns.activeTab = 'SIDEBAR';
        switch (s.viewMode) {
          case 'all':
            eagleIns.category = {
              newName: i18n.__('inspector.names.all'),
              newDescription: '',
              createDate: undefined,
              imageCount: s.all.length,
              fileSize: eagleIns.calculateFileSize(s.all),
              exportable: false,
              editable: false,
            };
            break;
          case 'unfiled':
            eagleIns.category = {
              newName: i18n.__('inspector.names.unfiled'),
              newDescription: '',
              createDate: undefined,
              imageCount: s.unfiledCount,
              fileSize: eagleIns.calculateFileSize(s.allData),
              exportable: false,
              editable: false,
            };
            break;
          case 'untagged':
            eagleIns.category = {
              newName: i18n.__('inspector.names.untagged'),
              newDescription: '',
              createDate: undefined,
              imageCount: s.untaggedCount,
              fileSize: eagleIns.calculateFileSize(s.allData),
              exportable: false,
              editable: false,
            };
            break;
          case 'trash':
            eagleIns.category = {
              newName: i18n.__('inspector.names.trash'),
              newDescription: '',
              createDate: undefined,
              imageCount: s.allData.length,
              fileSize: eagleIns.calculateFileSize(s.allData),
              exportable: false,
              editable: false,
            };
            break;
          case 'duplicate':
            eagleIns.category = {
              newName: i18n.__('inspector.names.duplicate'),
              newDescription: '',
              createDate: undefined,
              imageCount: s.allData.length,
              fileSize: eagleIns.calculateFileSize(s.allData),
              exportable: false,
              editable: false,
            };
            break;
          default:
            if (s.$root.selectedFolders.length > 0) {
              eagleIns.category = {
                newName: i18n.__('inspector.names.multipleTitles'),
                newDescription: '',
                createDate: undefined,
                imageCount: s.allData.length,
                fileSize: eagleIns.calculateFileSize(s.allData),
                exportable: false,
                editable: false,
              };
            } else if (s.selectedFolderMappings && Object.keys(s.selectedFolderMappings).length >= 1) {
              const selectedFolders = Object.keys(s.selectedFolderMappings).map(function (key) {
                return key;
              });
              if (selectedFolders[0] && s.folderMappings[selectedFolders[0]]) {
                eagleIns.inspectorFolder = s.folderMappings[selectedFolders[0]];
                eagleIns.category = {
                  newName: eagleIns.inspectorFolder.name,
                  newDescription: eagleIns.inspectorFolder.description || '',
                  createDate: eagleIns.inspectorFolder.modificationTime,
                  imageCount: eagleIns.inspectorFolder.imageCount,
                  fileSize: undefined,
                  exportable: !(eagleIns.inspectorFolder.password && !eagleIns.inspectorFolder.isUnLock),
                  editable: !(eagleIns.inspectorFolder.password && !eagleIns.inspectorFolder.isUnLock),
                };
              }
            } else if (s.currentFolder) {
              eagleIns.inspectorFolder = s.currentFolder;
              eagleIns.category = {
                newName: eagleIns.inspectorFolder.name,
                newDescription: eagleIns.inspectorFolder.description || '',
                createDate: eagleIns.inspectorFolder.modificationTime,
                imageCount: s.allData.length,
                fileSize: eagleIns.calculateFileSize(s.allData),
                exportable: true,
                editable: true,
              };
            } else if (s.currentSmartFolder) {
              eagleIns.category = {
                newName: s.currentSmartFolder.name,
                newDescription: s.currentSmartFolder.description || '',
                createDate: s.currentSmartFolder.modificationTime,
                imageCount: s.allData.length,
                fileSize: eagleIns.calculateFileSize(s.allData),
                exportable: true,
                editable: true,
              };
            }
        }
      }

      // 排序標籤，優先使用群組順序排，皆者使用字母順序排
      if (eagleIns.newTags?.length > 0) {
        eagleIns.newTags = sortTags(s, eagleIns.newTags);
      }
    });
  }, 30) as unknown as number;
}

/* ---------------- imagesChange / urlChange / annotationChange ---------------- */

export function imagesChange() {
  const eagleIns = (window as any).eagle.inspector;
  let name = eagleIns.newName;
  name = String(name ?? '').substr(0, req((window as any).appRoot.path + '/app/js/utils/remainingFilenameLength.js')(getBodyScope()?.libraryPath));
  name = (window as any).sanitize(name).replace(/%/g, '').replace(/&lt;/g, '').replace(/&gt;/g, '').trim();
  name = unescape(name);

  // 禁止清除名稱，一定要有文字
  if (name === '' && getBodyScope().selected.length === 1) {
    updateSelection();
    return;
  }

  eagleIns.newName = name;

  if (emojiRegex.test(name)) {
    name = name.replace(emojiRegex, '');
    eagleIns.newName = name;
  }

  const changedItems: any[] = [];

  getBodyScope().selected.forEach(function (image: any) {
    let hasChanged = false;

    if (typeof eagleIns.newUrl === 'string' && image.url !== eagleIns.newUrl) {
      if (isUrlLike(eagleIns.newUrl) || eagleIns.newUrl == '' || eagleIns.newUrl.indexOf('file://') === 0) {
        image.url = eagleIns.newUrl;
        hasChanged = true;
      } else if (req('fs').existsSync(eagleIns.newUrl)) {
        image.url = eagleIns.newUrl;
        hasChanged = true;
      } else if (eagleIns.newUrl.indexOf('://') > -1) {
        image.url = eagleIns.newUrl;
        hasChanged = true;
      }
    }

    const cloneImage = JSON.parse(JSON.stringify(image));

    if (name) {
      if (cloneImage.name !== name) {
        cloneImage.oldName = cloneImage.name;
        cloneImage.name = name;
        cloneImage.newName = name;
        hasChanged = true;
      }
    }

    if (hasChanged) {
      changedItems.push(cloneImage);
      getBodyScope().updateItemView(cloneImage);

      if (!getBodyScope().modifiedMappings[image.id]) {
        getBodyScope().modifiedMappings[image.id] = 1;
      } else {
        getBodyScope().modifiedMappings[image.id]++;
      }
    }
  });

  if (changedItems.length > 0) {
    (window as any).ayncsImagesChange(changedItems);
    (window as any).hiddenByCurrentFilter(changedItems);

    (window as any).electronLog.info(`[app] Change items info from inspctor, total: ${getBodyScope().selected.length} files`);

    // 避免修改影片名稱造成影片重頭播放
    if (getBodyScope().isDetailMode) {
      rememberVideoCurrentTime(getBodyScope()?.current);
      if ($()('#font-viewer').length > 0) {
        $()('iframe#font-viewer').contents().find('.font-name span').text(eagleIns.newName);
      }
    }
    getBodyScope().rebindRefresh(true);
  }
}

export function inspectorNameChange() {
  const bodyScope = getBodyScope();
  const ext = bodyScope?.current?.ext;
  const isVideo = (window as any).VIDEO_TYPES?.[ext];
  const isAudio = (window as any).AUDIO_TYPES?.[ext];
  if (bodyScope?.isDetailMode && (isVideo || isAudio)) {
    (window as any).eagle.inspector.isRenaming = true;
    scopeEvalAsync();
    setTimeout(() => {
      imagesChange();
      setTimeout(() => {
        (window as any).eagle.inspector.isRenaming = false;
      }, 500);
    }, 200);
  } else {
    imagesChange();
  }
}

export function annotationChange() {
  const eagleIns = (window as any).eagle.inspector;
  let annotation = eagleIns.newAnnotation;
  annotation = String(annotation ?? '').substr(0, 20480);
  annotation = unescape(annotation);

  const items = [...getBodyScope().selected];

  machineryCheckOperationSafety(getBodyScope(), () => {
    items.forEach((image: any) => {
      image.annotation = annotation;
    });
    (window as any).ayncsImagesChange(items);
    (window as any).hiddenByCurrentFilter(items);
    getBodyScope().rebindRefresh(true);
    (window as any).electronLog.info(`[app] Change file comemnt, total: ${items.length} files`);
  });
}

export function urlChange() {
  machineryCheckOperationSafety(getBodyScope(), () => {
    const eagleIns = (window as any).eagle.inspector;
    const changedItems: any[] = [];

    getBodyScope().selected.forEach(function (image: any) {
      let hasChanged = false;

      if (typeof eagleIns.newUrl === 'string' && image.url !== eagleIns.newUrl) {
        if (isUrlLike(eagleIns.newUrl) || eagleIns.newUrl == '' || eagleIns.newUrl.indexOf('file://') === 0) {
          image.url = eagleIns.newUrl;
          hasChanged = true;
        } else if (req('fs').existsSync(eagleIns.newUrl)) {
          image.url = eagleIns.newUrl;
          hasChanged = true;
        } else if (eagleIns.newUrl.indexOf('://') > -1) {
          image.url = eagleIns.newUrl;
          hasChanged = true;
        }
      }

      const cloneImage = JSON.parse(JSON.stringify(image));
      if (hasChanged) {
        changedItems.push(cloneImage);
        getBodyScope().updateItemView(cloneImage);

        if (!getBodyScope().modifiedMappings[image.id]) {
          getBodyScope().modifiedMappings[image.id] = 1;
        } else {
          getBodyScope().modifiedMappings[image.id]++;
        }
      }
    });

    if (changedItems.length > 0) {
      (window as any).ayncsImagesChange(changedItems);
      (window as any).hiddenByCurrentFilter(changedItems);

      (window as any).electronLog.info(`[app] Change items info from inspctor, total: ${getBodyScope().selected.length} files`);

      if (getBodyScope().isDetailMode) {
        rememberVideoCurrentTime(getBodyScope()?.current);
        if ($()('#font-viewer').length > 0) {
          $()('iframe#font-viewer').contents().find('.font-name span').text(eagleIns.newName);
        }
      }
      getBodyScope().rebindRefresh(true);
    }
  });
}

/* ---------------- 分類（資料夾/智能資料夾）名稱與描述 ---------------- */

let inspectorCategoryNameChangeTimeout: any;
export function inspectorCategoryNameChange() {
  const eagleIns = (window as any).eagle.inspector;
  const name = eagleIns.category.newName;
  let target;
  if (eagleIns.inspectorFolder) {
    target = eagleIns.inspectorFolder;
  } else {
    target = getBodyScope()?.currentSmartFolder;
  }
  if (name === '') {
    eagleIns.category.newName = target.name;
    return;
  }
  clearTimeout(inspectorCategoryNameChangeTimeout);
  inspectorCategoryNameChangeTimeout = setTimeout(() => {
    if (target) {
      const originalName = target.name;
      let newName = String(name).substr(0, 1024);
      newName = newName.replaceAll('&amp;', '&');
      target.name = newName;
      if (typeof target.name === 'string') {
        target.pinyin = (window as any).tinyPinyin.convertToPinyin(target.name);
      }
      try {
        (window as any).electronLog &&
          (window as any).electronLog.info(`[app] Change inspctor folder name: ${originalName}(${target.id}) > ${target.name}`);
      } catch (err) {}
    }
    saveFolder();
  }, 1000);
}

let inspectorCategoryDescriptionChangeTimeout: any;
export function inspectorCategoryDescriptionChange() {
  const eagleIns = (window as any).eagle.inspector;
  const description = eagleIns.category.newDescription;
  let target;
  if (eagleIns.inspectorFolder) {
    target = eagleIns.inspectorFolder;
  } else {
    target = getBodyScope()?.currentSmartFolder;
  }
  if (target) {
    target.description = description;
  }
  clearTimeout(inspectorCategoryDescriptionChangeTimeout);
  inspectorCategoryDescriptionChangeTimeout = setTimeout(() => {
    saveFolder();
  }, 1000);
}

/* ---------------- 小工具 ---------------- */

export function preventEnter(event: any) {
  if (event.keyCode === 13) {
    event.preventDefault();
    $(event.target).trigger('blur');
  } else if (event.keyCode === 27) {
    event.preventDefault();
    event.stopPropagation();
  }
}

export function selectLinkInput($event: any) {
  if ($event && $event.target) {
    $($event.target).trigger('select');
  }
}

export function newUrlKeyup(event: any) {
  if (event.keyCode === 13) {
    urlChange();
  }
}

export function setFolderPassword(folder: any) {
  if (!folder) return;
  setFolderPasswordChannel.emit({ folder: folder, mode: 'new' });
}

export function changeFolderPassword(folder: any) {
  if (!folder) return;
  setFolderPasswordChannel.emit({ folder: folder, mode: 'change' });
}

export function resetFolderPassword(folder: any) {
  if (!folder) return;
  setFolderPasswordChannel.emit({ folder: folder, mode: 'reset' });
}

export function rgbToHex(r: number, g: number, b: number): string | false {
  if (r === undefined) {
    return false;
  }
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
}

/* ---------------- 批注相关（55236-55210） ---------------- */

export function copyComment(event: any, image: any, comment: any) {
  if (comment && comment.annotation) {
    req('electron')?.clipboard?.writeText(unescape(comment.annotation));
    getBodyScope().notify({
      message: t('previewWindow.copied'),
      duration: 750,
    });
  }
}

export function openComment(event: any, image: any, comment: any) {
  const bodyScope = getBodyScope();
  if (!bodyScope?.isDetailMode) {
    machineryEnterDetailMode(bodyScope, event, image);
    setTimeout(function () {
      openComment(event, image, comment);
    }, 500);
    return;
  }

  if (comment && comment.y) {
    const $commentElem = $()(`#comment-${comment.id}`);
    if ($commentElem.length > 0 && !(window as any).isElementInViewport($commentElem[0])) {
      const offsetY = -200;
      $()('#detail-container').safeZoomData();
      detailZoom()?.goToY( -(comment.y + offsetY) * (bodyScope.imageSize.zoomRatio || 100) / 100);
      setTimeout(function () {
        (window as any).AnnotationPreview.show();
      }, 100);
    }
  }
}

export function highlightAnnotation(event: any, comment: any) {
  const bodyScope = getBodyScope();
  if (bodyScope?.isDetailMode && comment) {
    const $comment = $()(`#comment-${comment.id}`);
    $comment.addClass('highlight');
    (window as any).AnnotationPreview.lastElem = $comment[0];
    (window as any).AnnotationPreview.hoverTimeout = setTimeout(function () {
      (window as any).AnnotationPreview.show();
    }, 200);
  }
}

export function removeHighlightAnnotation(event: any, comment: any) {
  const bodyScope = getBodyScope();
  if (bodyScope?.isDetailMode && comment) {
    const $comment = $()(`#comment-${comment.id}`);
    $comment.removeClass('highlight');
    clearTimeout((window as any).AnnotationPreview.hoverTimeout);
    if ((window as any).AnnotationPreview.lastElem) {
      (window as any).AnnotationPreview.hide();
    }
  }
}

export function removeImageComment(item: any, index: number) {
  const originComments = JSON.parse(JSON.stringify(item.comments));
  const ipc = getIpc();

  item.comments.splice(index, 1);
  rebindRefreshChannel.emit(true);
  ipc.send('image-change', item);

  (window as any).electronLog && (window as any).electronLog.info(`[app] Remove image annotation: ${item.name}(${item.id})`);

  const message = t('notify.annotation.remove');
  getRootScope()?.notify({ message: message, duration: 4000 }, () => {
    item.comments = originComments;
    rebindRefreshChannel.emit(true);
    ipc.send('image-change', item);
  });
  (window as any).AnnotationPreview.blur();
  (window as any).AnnotationPreview.hide();
}

export function openVideoComment(event: any, image: any, comment: any) {
  const bodyScope = getBodyScope();
  if (!bodyScope?.isDetailMode) {
    machineryEnterDetailMode(bodyScope, event, image);
    setTimeout(function () {
      openVideoComment(event, image, comment);
    }, 500);
    return;
  }
  const current = bodyScope.current;
  const isVideo = (window as any).VIDEO_TYPES?.[current?.ext];
  const isAudio = (window as any).AUDIO_TYPES?.[current?.ext];
  if (isVideo || isAudio) {
    const video = $()('.detail-wrap video')[0] || $()('.detail-wrap mpv-video')[0];
    if (video && comment.duration !== undefined) {
      video.currentTime = comment.duration;
    }
  }
}

export function editVideoComment(event: any, image: any, comment: any) {
  const bodyScope = getBodyScope();
  if (!bodyScope?.isDetailMode) {
    machineryEnterDetailMode(bodyScope, event, image);
    setTimeout(function () {
      editVideoComment(event, image, comment);
    }, 500);
    return;
  }

  const video = $()('.detail-wrap video')[0] || $()('.detail-wrap mpv-video')[0];
  if (video) {
    video.currentTime = comment.duration;
    video.pause();
  }

  (window as any).swal({
    html: `
                    <div class="alert">
                        <div class="alert-icon create"></div>
                        <h4 class="alert-title">${t('dialog.videoComment.title')}</h4>
                    </div>
                `,
    input: 'textarea',
    inputPlaceholder: t('dialog.videoComment.placeholder'),
    inputValue: comment.annotation,
    allowEnterKey: false,
    showCloseButton: false,
    showCancelButton: true,
    allowOutsideClick: false,
    focusConfirm: false,
    focusCancel: false,
    padding: 10,
    position: 'bottom',
    width: 400,
    customClass: 'alert-box',
    cancelButtonColor: '#777777',
    confirmButtonText: t('dialog.videoComment.save'),
    cancelButtonText: t('general.cancel'),
  }).then((result: any) => {
    if (!result) return;
    comment.annotation = result;
    getIpc().send('image-change', image);
    refreshVideoCommentsChannel.emit();
    getBodyScope().updateItemView(video);
    scopeEvalAsync();
  });
}

export function removeVideoComment(event: any, video: any, comment: any) {
  event.stopPropagation();
  const ipc = getIpc();
  if (video.comments) {
    const idx = video.comments.indexOf(comment);
    if (idx > -1) {
      const originComments = JSON.parse(JSON.stringify(video.comments));

      video.comments.splice(idx, 1);
      ipc.send('image-change', video);
      getBodyScope().updateItemView(video);
      rebindRefreshChannel.emit(true);
      refreshVideoCommentsChannel.emit();

      (window as any).electronLog && (window as any).electronLog.info(`[app] Remove video annotation: ${video.name}(${video.id})`);

      const message = t('notify.annotation.remove');
      getRootScope()?.notify({ message: message, duration: 4000 }, function () {
        video.comments = originComments;
        rebindRefreshChannel.emit(true);
        refreshVideoCommentsChannel.emit();
        getBodyScope().updateItemView(video);
        ipc.send('image-change', video);
      });
    }
  }
}

/* ---------------- 标签行右键菜单（tagsInputMouseDown，54936-55021） ---------------- */

export function tagsInputMouseDown(event: any, tag?: string) {
  if (event.button === 2) {
    event.stopPropagation();
    event.preventDefault();
    const bodyScope = getBodyScope();
    const eagleIns = (window as any).eagle.inspector;
    let items: any[] = [];
    if (tag) {
      items = [
        {
          label: t('Context.Tag.FilterWithTags'),
          icon: 'ic-tag-filter.svg',
          click: () => {
            getBodyScope().TagManager.filterWithTags([tag]);
            scopeEvalAsync();
          },
        },
        { role: 'separator' },
        {
          label: t('Context.Tag.Edit.Title'),
          icon: 'ic-rename.svg',
          click: () => {
            machineryEditTag(getBodyScope(), getBodyScope().TagManager.tagMappings[tag]);
            scopeEvalAsync();
          },
        },
        {
          disabled: !(eagleIns?.newTags?.length > 0),
          label: t('context.tagInput.copyTag'),
          icon: 'ic-tag-copy.svg',
          click: () => {
            eagleIns.copyTags([tag]);
            getBodyScope().notify({
              message: t('Context.Tag.Copy.Success'),
              duration: 750,
            });
            scopeEvalAsync();
          },
        },
        {
          disabled: !eagleIns.copiedTags,
          label: t('context.tagInput.pasteTag'),
          icon: 'ic-tag-paste.svg',
          click: () => {
            pasteTags();
          },
        },
      ];
    } else {
      items = [
        {
          disabled: !(eagleIns?.newTags?.length > 0),
          label: t('context.tagInput.copyTag'),
          icon: 'ic-tag-copy.svg',
          accelerator: (window as any).preferences.shortcuts.keybinds['organize.tag.copy'],
          click: () => {
            copyTags();
          },
        },
        {
          disabled: !eagleIns.copiedTags,
          label: t('context.tagInput.pasteTag'),
          icon: 'ic-tag-paste.svg',
          accelerator: (window as any).preferences.shortcuts.keybinds['organize.tag.paste'],
          click: () => {
            pasteTags();
          },
        },
        { role: 'separator' },
        {
          label: t('context.tagInput.clearTag'),
          icon: 'ic-tag-empty.svg',
          accelerator: (window as any).preferences.shortcuts.keybinds['organize.tag.clear'],
          click: () => {
            getBodyScope().clearAllTags();
            scopeEvalAsync();
          },
        },
      ];
    }
    contextMenuOpen({
      items: items,
      showSearch: false,
    });
    void bodyScope;
  }
}

/* ---------------- 底部帮助菜单（55212-55297） ---------------- */

export function openHelpContextMenu() {
  const ipc = getIpc();
  contextMenuOpen({
    items: [
      {
        label: t('appmenu.app>about'),
        icon: 'ic-eagle-logo.svg',
        keywords: 'about アバウト 关于',
        click: () => {
          openAboutPanelChannel.emit();
        },
      },
      {
        label: t('appmenu.app>checkUpdate'),
        icon: 'ic-check-for-update.svg',
        keywords: 'check update 检查更新 檢查更新 アップデート',
        click: () => {
          ipc.send('check-for-update', {
            machineID: (window as any).machineID,
            showAlredy: true,
          });
        },
      },
      {
        label: t('appmenu.app>preferences'),
        icon: 'ic-settings.svg',
        keywords: 'preferences 偏好设置 偏好設置 設定 設置 settings',
        accelerator: (window as any).preferences.shortcuts.keybinds['app.preferences'] || 'CmdOrCtrl+,',
        enabled: !getRootScope()?.isAppLocked,
        click: () => {
          if (getRootScope()?.isAppLocked) return;
          ipc.send('open.preferences');
        },
      },
      { role: 'separator' },
      {
        label: t('appmenu.help>helpCenter'),
        icon: 'ic-help.svg',
        keywords: 'help center 帮助中心 帮助中心 ヘルプセンター',
        click: () => {
          getBodyScope().openHelpCenter();
        },
      },
      {
        label: t('appmenu.help>openTips'),
        icon: 'ic-tips.svg',
        keywords: 'tips 小技巧 小技巧 ヒント',
        click: () => {
          getBodyScope().openGetStarted();
        },
      },
      {
        label: t('appmenu.help>shortcuts'),
        icon: 'ic-shortcuts.svg',
        keywords: 'shortcuts 快捷键 ショートカット',
        click: () => {
          ipc.send('open.preferences', {
            panel: 'shortcuts',
          });
        },
      },
      { role: 'separator' },
      {
        label: t('appmenu.help>privacy'),
        icon: 'ic-privacy.svg',
        keywords: 'privacy 隐私 プライバシー',
        click: () => {
          getBodyScope().openPrivacy();
        },
      },
      {
        label: 'Eagle API',
        icon: 'ic-developer.svg',
        keywords: 'api developer 開發者 開發者 開発者',
        click: () => {
          getBodyScope().openAPIDocument();
        },
      },
      {
        label: 'Twitter - @eagle_app',
        icon: 'ic-twitter.svg',
        keywords: 'twitter social media 社交媒体 社交媒體 ソーシャルメディア',
        click: () => {
          getBodyScope().openTwitter();
        },
      },
    ],
    showSearch: true,
  });
}

/* ---------------- 缩放（resizable="w" 指令 + onInspectorResize，54342-54352） ---------------- */

export function onInspectorResize(event: any, ui: any) {
  if (ui && ui.size.width >= 200) {
    clearTimeout((window as any).__eagleInspectorResizeTimeout);
    (window as any).eagle.inspector.width = ui.size.width;
    (window as any).__eagleInspectorResizeTimeout = setTimeout(() => {
      getBodyScope().relayout();
      getBodyScope().offsetScrollbar(30);
    }, 500);
  }
}

/* ---------------- 事件订阅（link 中的 $on/ipc） ---------------- */

export function bindInspectorEvents(): () => void {
  const scope = getBodyScope();
  const ipc = getIpc();
  const offs: Array<() => void> = [];

  const onPluginInstalled = () => {
    (window as any).eagle.inspector.initPlugins();
    scopeEvalAsync();
  };
  ipc?.on?.('plugin-installed', onPluginInstalled);
  ipc?.on?.('plugin-reloaded', onPluginInstalled);
  offs.push(() => {
    try {
      ipc?.removeListener?.('plugin-installed', onPluginInstalled);
      ipc?.removeListener?.('plugin-reloaded', onPluginInstalled);
    } catch (err) {}
  });

  if (scope) {
    // b1-9ba：INSPECTOR_SAVE_CHANGES / PLUGIN_UNINSTALL 兩頻道全樹無發送者（原發送面在
    // bundle，摘除後死亡）——死監聽移除；UPDATE_INSPECTOR 仍有活發送面，保留。
    const offUpdate = updateInspectorChannel.on(() => {
      updateSelection();
    });
    offs.push(() => {
      offUpdate();
    });
  }

  // .inspector 上的 .image mouseup（中鍵/右鍵）—— 原委托 .inspector 根元素
  const onMouseUp = (event: any) => {
    const target = event.target as HTMLElement;
    if (!target?.closest?.('.image')) return;
    const button = event?.button;
    const inspectorEl = document.querySelector('.inspector');
    if (!inspectorEl || !inspectorEl.contains(target)) return;
    if (button === 1) {
      getBodyScope().openPluginPanel();
      scopeEvalAsync();
    } else if (button !== 0) {
      openItemContextMenu(event, getBodyScope()?.selected?.[0]);
      scopeEvalAsync();
    }
  };
  document.addEventListener('mouseup', onMouseUp);
  offs.push(() => document.removeEventListener('mouseup', onMouseUp));

  // 選擇變化時的 activeTab 副作用（原 $watchCollection("selected")）
  const offSelected = scope?.$watchCollection?.('selected', () => {
    const eagleIns = (window as any).eagle.inspector;
    const selected = getBodyScope()?.selected;
    if (!selected) return;
    if (selected.length > 0) {
      eagleIns.activeTab = 'ITEM';
    } else {
      eagleIns.activeTab = 'SIDEBAR';
    }
  });
  if (offSelected) offs.push(() => offSelected());

  // 供闭环测试（electron/main.cjs --smoke-main-workflow）等价驱动 inspector 行为
  (window as any).__eagleInspectorActions = { updateSelection, imagesChange, annotationChange };

  return () => offs.forEach((fn) => fn());
}

void getCurrentWindow;
void scopeApply;
