import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { calculateImageBinding } from '../../services/gridBindingService';
import { updateSelection } from '../../services/selectionService';
import { t } from '../../global/eagleGlobals';
import { filesize, second2time } from '../../app/filters';
import { getIpc } from '../detail/detailHooks';
import { openAppContextMenu } from './selectPanelEngine';
import { ayncsImagesChange } from './FolderModals';
import { ExtIcon } from '../inspector/Inspector';
import { useVsRepeat } from './FolderSelectPanels';
import { themePathOf } from './SelectPanels';
import { syncSidebarFromScope } from '../../store/sidebarState';
import { syncInspectorFromScope } from '../../store/inspectorState';
import { getBodyScope, getRootScope } from '../../core/appCore';
import { machineryRebindRefresh } from '../../core/dataMachinery';
import { scrollToSelectedItem } from '../../services/batchOpsService';
import { getThumbnailUrl as getThumbnailUrlImpl } from '../../services/imageOpsService';
import { calculateImageBindingChannel, glResetChannel, openDuplicateChannel, openDuplicateScanPanelChannel, rebindRefreshChannel } from '../../global/bus';

import { machineryOpenUnfiled, machineryQuickOpenFolder } from '../../core/libraryDomain';
/**
 * 阶段7d-4：duplicateScanPanel + mergeEditor + duplicateModal 接管。
 *
 * 规范来源：
 * - duplicateScanPanel = bundle 59423-59848 附近（镜像 js/directives/duplicate-scan-panel.js）
 *   + duplicate-scan-panel.html
 * - mergeEditor = bundle 59848-60099 附近（镜像 js/directives/merge-editor.js；replace:true）+
 *   merge-editor.html
 * - duplicateModal = bundle 60099-60358 附近（镜像 js/directives/duplicate-modal.js）+
 *   duplicate-modal.html
 *
 * 通道零改动：OPEN_DUPLICATE / OPEN_DUPLICATE_SCAN_PANEL 广播（on）、CALCULATE_IMAGE_BINDING /
 * REBIND_REFRESH / gl:reset 广播（send）、ipc 'show' / 'image.changed' / 'images-change' /
 * 'empty-trash' / 'palette-resume' / 'open-with-default'。
 * 依赖等价：eagle.duplicateChecker（shim）、require('cancellation')（shim bareModules）、
 * window.throttle、FileUrlHelper、openInNewWindow（bundle 顶层函数）、getHashID（bundle 顶层
 * 函数）、Array.prototype.unique（bundle 2607 原型扩展，页面内直接可用）。
 * 原版怪癖保留：duplicate-modal 模板 hasSelected() 在 scope 未定义（$exceptionHandler 记录，
 * button-disabled 恒不生效）；close() 内 `applyAll == 'false'` 为比较表达式 no-op。
 */

const ngShow = (show: boolean) => (show ? undefined : ({ display: 'none' } as React.CSSProperties));
const iv = (v: any): any => (v === undefined || v === null ? '' : v);
const w = () => window as any;

/** Angular number:0 过滤等价（千分位分组、0 位小数；非数值返回 ''） */
const ngNumber0 = (v: any) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return '';
  return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
};

/* ================= mergeEditor（镜像逐字；replace:true） ================= */

function MergeEditor({
  groups,
  selectedGroupMap,
  onMerged,
  folderMappings,
}: {
  groups: any[];
  selectedGroupMap: any;
  onMerged: any;
  folderMappings: any;
}) {
  const [, bump] = useState(0);
  const bumpAll = () => bump((v: number) => v + 1);
  const stateRef = useRef<any>({});
  const listRef = useRef<HTMLElement | null>(null);

  // init()（镜像 18-110 逐字；link 期一次）
  if (!stateRef.current.initialized) {
    stateRef.current.initialized = true;
    stateRef.current.isMerging = false;
    // 計算出選取的 groups
    const selectedGroups = groups.filter((group: any) => selectedGroupMap[group.id]);
    stateRef.current.selectedGroups = selectedGroups;
    stateRef.current.currentGroup = selectedGroups[0];

    stateRef.current.selectedItems = [];

    // 剛進入 merge 模式，初始化默認值
    selectedGroups.forEach((group: any) => {
      // 計算每個 group 的 props
      group.props = {
        names: [],
        urls: [],
        folders: [],
        tags: [],
        annotations: [],
        mergedAnnotation: '',
      };

      group.items.forEach((item: any) => {
        if (item.name) {
          group.props.names.push(item.name);
        }
        if (item.url) {
          group.props.urls.push(item.url);
        }
        if (item.folders && item.folders.length > 0) {
          group.props.folders = group.props.folders.concat(item.folders);
        }
        if (item.tags && item.tags.length > 0) {
          group.props.tags = group.props.tags.concat(item.tags);
          syncSidebarFromScope();
        }
        if (item.annotation) {
          group.props.annotations.push(item.annotation);
        }

        group.props.names = [...new Set(group.props.names)];
        group.props.urls = [...new Set(group.props.urls)];
        group.props.folders = [...new Set(group.props.folders)];
        group.props.tags = [...new Set(group.props.tags)];
        syncSidebarFromScope();
        // sort tags
        group.props.tags = group.props.tags.sort((a: any, b: any) => {
          try {
            return a.localeCompare(b, 'zh-Hant-CN');
          } catch (err) {
            return 0;
          }
        });
        syncSidebarFromScope();
        group.props.annotations = [...new Set(group.props.annotations)];

        if (item.star && item.star > 0) {
          if (group.props.star === undefined) {
            group.props.star = item.star;
          } else if (group.props.star < item.star) {
            group.props.star = item.star;
          }
        }

        stateRef.current.selectedItems.push(item);
      });

      group.mergedData = {
        name: group.props.names[0],
        thumbnailUrl: w().FileUrlHelper.getThumbnailUrl(group.items[0]),
        url: group.props.urls[0] || '',
        folders: [...group.props.folders],
        foldersMap: {},
        tags: [...group.props.tags],
        tagsMap: {},
        annotation: group.props.annotations[0] || '',
        star: group.props.star ?? undefined,
      };

      group.mergedData.folders.forEach((folder: any) => {
        group.mergedData.foldersMap[folder] = folder;
      });

      group.mergedData.tags.forEach((tag: any) => {
        group.mergedData.tagsMap[tag] = tag;
      });

      // 如果 props annotation 超過 2 個以上，建立一個合併的 annotation
      if (group.props.annotations.length > 1) {
        group.mergedData.mergedAnnotation = group.props.annotations.join('\n').substring(0, 4096);
      }
    });

    console.log(selectedGroups);
  }

  const isMerging = stateRef.current.isMerging;
  const selectedGroups: any[] = stateRef.current.selectedGroups || [];
  const currentGroup = stateRef.current.currentGroup;
  const selectedItems: any[] = stateRef.current.selectedItems || [];

  const getThumbnailUrl = (item: any) => {
    return w().FileUrlHelper.getThumbnailUrl(item);
  };

  const selectGroup = (group: any) => {
    stateRef.current.currentGroup = group;
    bumpAll();
  };

  const changeName = (group: any, name: any) => {
    group.mergedData.name = name;
    bumpAll();
  };

  const changeUrl = (group: any, url: any) => {
    group.mergedData.url = url;
    bumpAll();
  };

  const selectCustomAnnotation = (group: any) => {
    group.customAnnotation = true;
    group.mergedData.annotation = group.props.mergedAnnotation;
    bumpAll();
  };

  const changeAnnotation = (group: any, annotation: any) => {
    group.customAnnotation = false;
    group.mergedData.annotation = annotation;
    bumpAll();
  };

  const toggleFolder = (group: any, folder: any) => {
    if (group.mergedData.folders.includes(folder)) {
      group.mergedData.folders = group.mergedData.folders.filter((f: any) => f !== folder);
      delete group.mergedData.foldersMap[folder];
    } else {
      group.mergedData.folders.push(folder);
      group.mergedData.foldersMap[folder] = folder;
    }
    group.mergedData.folders = [...new Set(group.mergedData.folders)];
    bumpAll();
  };

  const toggleTag = (group: any, tag: any) => {
    if (group.mergedData.tags.includes(tag)) {
      group.mergedData.tags = group.mergedData.tags.filter((t: any) => t !== tag);
      delete group.mergedData.tagsMap[tag];
    } else {
      group.mergedData.tags.push(tag);
      group.mergedData.tagsMap[tag] = tag;
    }
    group.mergedData.tags = [...new Set(group.mergedData.tags)];
    bumpAll();
  };

  const checkOperationSafety = (callback: any, amount = 1) => {
    void amount;
    try {
      if (selectedItems && selectedItems.length >= 1) {
        const html = t('Dialog.BulkAction.Descript', [{ property: 'count', value: String(selectedItems.length) }]);
        w().swal({
          html: `
                                <div class="alert">
                                    <div class="alert-icon warning"></div>
                                    <h4 class="alert-title">${t('Dialog.BulkAction.Title')}</h4>
                                    <p class="alert-desc">${html}</p>
                                </div>
                            `,
          showCloseButton: false,
          showCancelButton: true,
          allowOutsideClick: false,
          focusConfirm: false,
          focusCancel: false,
          padding: 24,
          width: 400,
          customClass: 'alert-box',
          cancelButtonColor: '#777777',
          confirmButtonText: t('Dialog.BulkAction.Button'),
          cancelButtonText: t('general.cancel'),
          allowEnterKey: false,
        }).then(function (result: any) {
          void result;
          callback && callback();
          bumpAll();
        });
      } else {
        callback && callback();
      }
    } catch (err) {
      callback && callback();
    }
  };

  // merge()（镜像 196-251 逐字）
  const merge = () => {
    checkOperationSafety(() => {
      if (stateRef.current.isMerging) return;
      stateRef.current.isMerging = true;
      stateRef.current.mergeProgress = 0;

      const body = getBodyScope();
      const changed: any[] = [];
      const trash: any[] = [];
      selectedGroups.forEach((group: any) => {
        if (!group.choice?.id) return;
        const choice = body.itemMappings[group.choice.id];
        const originName = choice.name;
        const newName = group.mergedData.name;
        choice.name = newName;
        choice.oldName = originName;
        choice.newName = newName;
        choice.tags = group.mergedData.tags ?? choice.tags;
        choice.folders = group.mergedData.folders ?? choice.folders;
        choice.star = group.mergedData.star ?? choice.star;

        if (group.customAnnotation) {
          choice.annotation = group.mergedData.mergedAnnotation ?? choice.annotation;
        } else {
          choice.annotation = group.mergedData.annotation ?? choice.annotation;
        }
        choice.url = group.mergedData.url ?? choice.url;

        group.items.forEach((item: any) => {
          const origin = body.itemMappings[item.id];
          if (!origin) return;
          if (group.choice !== item) {
            origin.isDeleted = true;
            trash.push(origin);
          }
          changed.push(origin);
        });
      });

      ayncsImagesChange(changed);
      calculateImageBinding({}, function () {
        body.notify({
          message: t('notify.removeDuplicate.successMsg'),
          duration: 750,
        });
        machineryRebindRefresh(body, undefined, undefined, undefined);
        updateSelection();
        stateRef.current.isMerging = false;
        onMerged({
          changed: changed,
          trash: trash,
        });
        try {
          if (w().electronLog) w().electronLog.info(`[app] Clear all duplicate items, ${trash.length} files has been removed to trash`);
        } catch (err) {}
      });
      bumpAll();
    }, 1);
  };

  const vr = useVsRepeat(listRef, selectedGroups, { elementSize: 56, excess: 30 }, selectedGroups.length);

  return (
    <div className={`merge-editor${isMerging ? ' is-merging' : ''}`}>
      {/* 側欄 */}
      <div className="merge-editor-sidebar">
        {/* 群組s */}
        <div className="group-list" ref={listRef as any} vs-excess="30" vs-repeat="56">
          <div className="vs-repeat-before-content" style={{ width: '100%', minHeight: vr.beforeHeight }} />
          {vr.innerItems.map((group: any, index: number) => (
            <div key={index} className={`group-item${group === currentGroup ? ' selected' : ''}`} onClick={() => selectGroup(group)}>
              <div className="thumbnail" style={{ backgroundImage: `url('${group.mergedData.thumbnailUrl}')` }}>
                {group.choice.noPreview && <ExtIcon itemId={group.choice.id} />}
              </div>
              <div className="info">
                <div className="name">{group.mergedData.name}</div>
                <div className="meta">
                  {group.items.length} {t('duplicatePanel.step4.list.items')}
                </div>
              </div>
            </div>
          ))}
          <div className="vs-repeat-after-content" style={{ width: '100%', minHeight: vr.afterHeight }} />
        </div>
        {/* 底部工具列 */}
        <div className="bottom">
          {/* 进度条 */}
          <div className="merge-progress" style={ngShow(!!isMerging)}>
            <div className="progress-bar">
              <div className="current" style={{ width: `${stateRef.current.mergeProgress || 0}%` }} />
            </div>
            <div className="message">{t('duplicatePanel.step4.progress.msg')} 2 / 8</div>
          </div>
          {/* 按鈕 */}
          <div
            className="button button-primary"
            style={ngShow(!isMerging)}
            onClick={() => merge()}
          >
            <img src="assets/images/base/icons/ic-duplicate-merge-all.svg" />
            {t('duplicatePanel.footer.mergeBtn')}
            <span style={ngShow(selectedItems.length <= 1)}>({selectedItems.length})</span>
          </div>
          <div className="button button-primary button-disabled" style={ngShow(!isMerging)}>
            <img src="assets/images/base/icons/ic-duplicate-merge-all.svg" />
            {t('duplicatePanel.footer.mergeBtn')}
            <span style={ngShow(selectedItems.length <= 1)}>({selectedItems.length})</span>
          </div>
        </div>
      </div>
      {/* 屬性編輯器 */}
      <div className="merge-editor-content">
        {/* 文件名稱 */}
        <div className="prop">
          <div className="label">{t('duplicatePanel.step4.prop.filename')}</div>
          {currentGroup && currentGroup.props.names.length > 1 && (
            <div className="value">
              <div className="radio-items">
                {currentGroup.props.names.map((name: any, index: number) => (
                  <div
                    key={index}
                    className={`radio-item${currentGroup.mergedData.name === name ? ' selected' : ''}`}
                    onClick={() => changeName(currentGroup, name)}
                  >
                    <div className="icon" />
                    <div className="name">{name}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {currentGroup && currentGroup.props.names.length === 1 && <div className="value empty">{currentGroup.mergedData.name}</div>}
        </div>
        {/* 链接 */}
        <div className="prop">
          <div className="label">{t('duplicatePanel.step4.prop.link')}</div>
          {currentGroup && currentGroup.props.urls.length > 0 && (
            <div className="value">
              <div className="radio-items">
                {currentGroup.props.urls.map((url: any, index: number) => (
                  <div
                    key={index}
                    className={`radio-item${currentGroup.mergedData.url === url ? ' selected' : ''}`}
                    onClick={() => changeUrl(currentGroup, url)}
                  >
                    <div className="icon" />
                    <div className="name">{url}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {currentGroup && currentGroup.props.urls.length <= 0 && <div className="value empty">{t('duplicatePanel.step4.prop.empty.link')}</div>}
        </div>
        {/* 文件夹 */}
        <div className="prop">
          <div className="label">{t('duplicatePanel.step4.prop.folder')}</div>
          {currentGroup && currentGroup.props.folders.length > 0 && (
            <div className="value">
              <div className="checkbox-items">
                {currentGroup.props.folders.map((folder: any, index: number) => (
                  <div
                    key={index}
                    className={`checkbox-item folder${currentGroup.mergedData.foldersMap[folder] ? ' selected' : ''}`}
                    onClick={() => toggleFolder(currentGroup, folder)}
                  >
                    <div className="icon" />
                    <div className="name">{folderMappings[folder]?.name}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {currentGroup && currentGroup.props.folders.length === 0 && <div className="value empty">{t('duplicatePanel.step4.prop.empty.folder')}</div>}
        </div>
        {/* 标签 */}
        <div className="prop">
          <div className="label">{t('duplicatePanel.step4.prop.tag')}</div>
          {currentGroup && currentGroup.props.tags.length > 0 && (
            <div className="value">
              <div className="checkbox-items">
                {currentGroup.props.tags.map((tag: any, index: number) => (
                  <div
                    key={index}
                    className={`checkbox-item tag${currentGroup.mergedData.tagsMap[tag] ? ' selected' : ''}`}
                    onClick={() => toggleTag(currentGroup, tag)}
                  >
                    <div className="icon" />
                    <div className="name">{tag}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {currentGroup && currentGroup.props.tags.length === 0 && <div className="value empty">{t('duplicatePanel.step4.prop.empty.tag')}</div>}
        </div>
        {/* 注释 */}
        <div className="prop">
          <div className="label">{t('duplicatePanel.step4.prop.note')}</div>
          {currentGroup && currentGroup.props.annotations.length > 0 && (
            <div className="value">
              <div className="radio-items">
                {currentGroup.props.annotations.map((annotation: any, index: number) => (
                  <div
                    key={index}
                    className={`radio-item${currentGroup.mergedData.annotation === annotation ? ' selected' : ''}`}
                    onClick={() => changeAnnotation(currentGroup, annotation)}
                  >
                    <div className="icon" />
                    <div className="name">{annotation}</div>
                  </div>
                ))}
                <div
                  className={`radio-item${currentGroup.customAnnotation ? ' selected' : ''}`}
                  onClick={() => selectCustomAnnotation(currentGroup)}
                >
                  <div className="icon" />
                  <div className="name">{t('duplicatePanel.step4.prop.mergeNote')}</div>
                </div>
                {currentGroup.customAnnotation && (
                  <textarea
                    value={currentGroup.mergedData.mergedAnnotation ?? ''}
                    onChange={(e: any) => {
                      currentGroup.mergedData.mergedAnnotation = e.target.value;
                      bumpAll();
                    }}
                  />
                )}
              </div>
            </div>
          )}
          {currentGroup && currentGroup.props.annotations.length <= 0 && <div className="value empty">{t('duplicatePanel.step4.prop.empty.note')}</div>}
        </div>
      </div>
    </div>
  );
}

/* ================= duplicateScanPanel（镜像逐字 + 模板） ================= */

export function DuplicateScanPanel() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [, bump] = useState(0);
  const bumpAll = () => bump((v: number) => v + 1);
  const rootRef = useRef<any>({});
  const listRef = useRef<HTMLElement | null>(null);

  // $scope.$on("OPEN_DUPLICATE_SCAN_PANEL")（镜像 386-389）
  useEffect(() => {
    setHost(document.getElementById('eagle-duplicate-scan-panel-host'));
  }, []);

  useEffect(() => {
    const body = getBodyScope();
    if (!body) return;
    const off = openDuplicateScanPanelChannel.on((params: any) => {
      // $scope.init(options)（镜像 11-18；原版 `[...options.items] || []` 右侧为死代码）
      rootRef.current.isOpen = true;
      rootRef.current.items = [...params.items];
      rootRef.current.onMergedCallback = params.onMergedCallback || function () {};
      rootRef.current.fingerprintMap = {};
      rootRef.current.step = 'INITIAL';
      reset();
      bumpAll();
    });
    // 闭环测试契约
    (window as any).__eagleDuplicateScanPanel = {
      get step() {
        return rootRef.current.step;
      },
      get groups() {
        return rootRef.current.groups;
      },
      get selectedItems() {
        return rootRef.current.selectedItems;
      },
      get isOpen() {
        return rootRef.current.isOpen;
      },
    };
    return () => off();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host]);

  const reset = () => {
    rootRef.current.scanMethod = undefined;
    rootRef.current.similarity = 0.8;
    rootRef.current.selectedItems = [];
    rootRef.current.reducedSize = 0;
    rootRef.current.total = (rootRef.current.items || []).length;
    rootRef.current.current = 0;
    rootRef.current.scanProgress = 0;

    rootRef.current.groups = [];
    rootRef.current.selectedGroupMap = {};
    rootRef.current.hasPotentialSimilarResults = false;
  };

  const back = () => {
    if (rootRef.current.cancelControl) {
      rootRef.current.cancelControl.cancel('user cancelled');
    }
    rootRef.current.step = 'INITIAL';
    reset();
    bumpAll();
  };

  const goResult = () => {
    goToStep('SCAN-RESULT');
  };

  const scanSame = () => {
    const tokenSource = w().require('cancellation');
    rootRef.current.cancelControl = tokenSource();
    rootRef.current.scanMethod = 'SAME';
    setTimeout(async () => {
      goToStep('SCAN');
      bumpAll();
      const result = await w().eagle.duplicateChecker.findDuplicateFiles(rootRef.current.items, rootRef.current.cancelControl.token, {
        onProgress: (curr: any, total: any) => {
          const progress = Math.floor((curr / total) * 100);
          rootRef.current.total = total;
          rootRef.current.current = curr;
          rootRef.current.scanProgress = progress;
          bumpAll();
        },
      });
      console.log(result);

      if (result.cancel) return;

      rootRef.current.groups = result.groups;
      rootRef.current.groups.forEach((group: any) => {
        rootRef.current.selectedGroupMap[group.id] = group;
        group.choice = group.items[0];
      });
      rootRef.current.subsetItems = [];
      rootRef.current.groups.forEach((group: any) => {
        rootRef.current.subsetItems = rootRef.current.subsetItems.concat(group.items);
      });
      updateSelectedItems();
      goToStep('SCAN-RESULT');
      bumpAll();
    }, 600);
  };

  const scanSimilar = () => {
    const tokenSource = w().require('cancellation');
    rootRef.current.cancelControl = tokenSource();
    rootRef.current.scanMethod = 'SIMILAR';
    setTimeout(async () => {
      goToStep('SCAN');
      bumpAll();
      const startTime = Date.now();

      const calcuteTimeLeft = (percent: any) => {
        // 计算剩馀时间
        const elapsedTime = Date.now() - startTime;
        const chunksPerTime = percent / elapsedTime;
        const estimatedTotalTime = 100 / chunksPerTime;
        rootRef.current.timeLeftInSeconds = parseInt(String((estimatedTotalTime - elapsedTime) / 1000));
      };

      const result = await w().eagle.duplicateChecker.findSimilarFiles(rootRef.current.items, rootRef.current.cancelControl.token, {
        fingerprintMap: rootRef.current.fingerprintMap,
        fingerprintWeighted: rootRef.current.similarity,
        onProgress: w().throttle(
          (curr: any, total: any) => {
            const progress = Math.floor((curr / total) * 100);
            rootRef.current.total = total;
            rootRef.current.current = curr;
            rootRef.current.scanProgress = progress;
            calcuteTimeLeft(progress);
            bumpAll();
          },
          16,
          true
        ),
      });

      console.log(result);
      if (result.cancel) return;

      rootRef.current.fingerprintMap = result.fingerprintMap;
      rootRef.current.groups = result.groups;

      rootRef.current.subsetItems = [];
      rootRef.current.groups.forEach((group: any) => {
        rootRef.current.subsetItems = rootRef.current.subsetItems.concat(group.items);
      });

      // 記錄是否有潛在的相似結果（在最低相似度下）
      rootRef.current.hasPotentialSimilarResults = rootRef.current.subsetItems.length > 0;

      initSimilarGroups();
      goToStep('SCAN-RESULT');
      bumpAll();
    }, 600);
  };

  const changeSimilarity = (similarity: any) => {
    clearTimeout(rootRef.current.changeSimilarityTimeout);
    rootRef.current.changeSimilarityTimeout = setTimeout(async () => {
      rootRef.current.similarity = similarity;
      console.time('changeSimilarity');
      const result = await w().eagle.duplicateChecker.findSimilarFiles(rootRef.current.subsetItems, rootRef.current.cancelControl.token, {
        fingerprintMap: rootRef.current.fingerprintMap,
        fingerprintWeighted: rootRef.current.similarity,
      });
      console.timeEnd('changeSimilarity');
      console.log(result);
      rootRef.current.selectedItems = [];
      rootRef.current.reducedSize = 0;
      rootRef.current.groups = result.groups;
      rootRef.current.selectedGroupMap = {};
      initSimilarGroups();
      bumpAll();
    }, 100);
  };

  const initSimilarGroups = () => {
    // 根據 group item 的格式、分辨率、檔案大小進行排序（镜像 152-203 逐字）
    rootRef.current.groups.forEach((group: any) => {
      group.items.sort((a: any, b: any) => {
        const aArea = a.width * a.height;
        const bArea = b.width * b.height;
        if (aArea > bArea) return -1;
        if (aArea < bArea) return 1;
        const aFormat = a.ext;
        const bFormat = b.ext;
        if (aFormat === bFormat) {
          const aSize = a.size;
          const bSize = b.size;
          if (aSize > bSize) return -1;
          if (aSize < bSize) return 1;
        }
        if (aFormat === 'png') return -1;
        if (bFormat === 'png') return 1;
        if (aFormat === 'bmp') return -1;
        if (bFormat === 'bmp') return 1;
        if (aFormat === 'jpg') return -1;
        if (bFormat === 'jpg') return 1;
        if (aFormat === 'jpeg') return -1;
        if (bFormat === 'jpeg') return 1;
        if (aFormat === 'webp') return -1;
        if (bFormat === 'webp') return 1;
        if (aFormat === 'avif') return -1;
        if (bFormat === 'avif') return 1;
        if (aFormat === 'jxl') return -1;
        if (bFormat === 'jxl') return 1;
        if (aFormat === 'heic') return -1;
        if (bFormat === 'heic') return 1;
        if (aFormat === 'heif') return -1;
        if (bFormat === 'heif') return 1;
        if (aFormat === 'jfif') return -1;
        if (bFormat === 'jfif') return 1;

        return 0;
      });

      group.choice = group.items[0];
    });

    rootRef.current.groups.forEach((group: any) => {
      rootRef.current.selectedGroupMap[group.id] = group;
    });

    updateSelectedItems();
  };

  const startMerge = () => {
    goToStep('MERGE');
    bumpAll();
  };

  const goToStep = (step: any) => {
    rootRef.current.step = step;
  };

  const isGroupSelected = (group: any) => {
    return rootRef.current.selectedGroupMap[group.id] ? true : false;
  };

  const removeGroup = (group: any) => {
    const idx = rootRef.current.groups.indexOf(group);
    if (idx > -1) {
      rootRef.current.groups.splice(idx, 1);
    }
    // remove form items
    rootRef.current.subsetItems = rootRef.current.subsetItems.filter((item: any) => {
      return group.items.indexOf(item) === -1;
    });
    delete rootRef.current.selectedGroupMap[group.id];
    updateSelectedItems();
  };

  const toggleGroupSelection = (group: any) => {
    if (isGroupSelected(group)) {
      delete rootRef.current.selectedGroupMap[group.id];
    } else {
      rootRef.current.selectedGroupMap[group.id] = group;
    }
    updateSelectedItems();
  };

  const selectChoice = (group: any, item: any) => {
    group.choice = item;
    updateSelectedItems();
  };

  const openInNewWindowFor = (item: any) => {
    w().openInNewWindow([item]);
  };

  const onItemMouseup = (event: any, item: any) => {
    if (event.which === 2) {
      event.stopPropagation();
      openInNewWindowFor(item);
    }
  };

  const openItemContextMenu = (group: any, item: any) => {
    openAppContextMenu({
      items: [
        {
          label: t('context.image.openInDefault'),
          icon: 'ic-open-default.svg',
          click: () => {
            const rawPath = w().FileUrlHelper.getRawPath(item);
            getIpc().send('open-with-default', rawPath);
          },
        },
        // 在新窗口打开
        {
          label: t('Context.Open.New.Window'),
          icon: 'ic-open-new-window.svg',
          click: () => {
            openInNewWindowFor(item);
          },
        },
        {
          label: t('duplicatePanel.step3.list.removeItem'),
          icon: 'ic-file-delete-permanently.svg',
          click: () => {
            // remove item from group.items
            const idx = group.items.indexOf(item);
            if (idx > -1) {
              group.items.splice(idx, 1);
              group.choice = group.items[0];
            }

            // remove from items
            const idx2 = rootRef.current.subsetItems.indexOf(item);
            if (idx2 > -1) {
              rootRef.current.subsetItems.splice(idx2, 1);
            }

            // remove group if group.items is empty
            if (group.items.length === 1) {
              removeGroup(group);
            }
            bumpAll();
          },
        },
      ],
      showSearch: false,
    });
  };

  const updateSelectedItems = () => {
    rootRef.current.reducedSize = 0;
    rootRef.current.selectedItems = [];

    for (const key in rootRef.current.selectedGroupMap) {
      const group = rootRef.current.selectedGroupMap[key];
      const items = group.items;
      rootRef.current.selectedItems = rootRef.current.selectedItems.concat(items);

      if (rootRef.current.scanMethod === 'SAME') {
        items.forEach((item: any, index: number) => {
          if (items.length - 1 === index) return;
          rootRef.current.reducedSize += item.size;
        });
      } else {
        const choice = group.choice;
        items.forEach((item: any, index: number) => {
          if (item === choice) return;
          rootRef.current.reducedSize += item.size;
        });
      }
    }
  };

  const getThumbnailUrl = (item: any) => {
    return w().FileUrlHelper.getThumbnailUrl(item);
  };

  const onMerged = ({ changed, trash }: any) => {
    rootRef.current.onMergedCallback({
      changed: changed,
      trash: trash,
    });

    const totalSize = trash.reduce((acc: any, item: any) => {
      return acc + item.size;
    }, 0);
    const size = filesize(totalSize);
    const count = trash.length;

    const desc = t('duplicatePanel.dialog.desc', [
      { property: 'count', value: String(count) },
      { property: 'size', value: size },
    ]);

    w().swal({
      html: `
                    <div class="alert">
                        <div class="alert-icon success"></div>
                        <h4 class="alert-title">${t('duplicatePanel.dialog.title')}</h4>
                        <p class="alert-desc">${desc}</p>
                    </div>
                    `,
      showCloseButton: false,
      showCancelButton: true,
      allowOutsideClick: false,
      focusConfirm: true,
      focusCancel: false,
      padding: 24,
      width: 400,
      customClass: 'alert-box',
      cancelButtonColor: '#777777',
      confirmButtonText: t('duplicatePanel.dialog.continue'),
      cancelButtonText: t('duplicatePanel.dialog.exit'),
    }).then(
      () => {
        rootRef.current.groups = rootRef.current.groups.filter((group: any) => {
          return !rootRef.current.selectedGroupMap[group.id];
        });
        rootRef.current.selectedGroupMap = {};
        rootRef.current.selectedItems = [];
        goResult();
        bumpAll();
      },
      () => {
        close();
        bumpAll();
      }
    );
  };

  const close = () => {
    if (rootRef.current.cancelControl) {
      rootRef.current.cancelControl.cancel('user cancelled');
    }
    rootRef.current.isOpen = false;
    bumpAll();
  };

  // hooks 必须在早退前调用（host 未就绪时 items 传 undefined 即可）
  const step = rootRef.current.step;
  const isOpen = rootRef.current.isOpen;
  const scanMethod = rootRef.current.scanMethod;
  const groups: any[] = rootRef.current.groups || [];
  const selectedItems: any[] = rootRef.current.selectedItems || [];
  const similarity = rootRef.current.similarity;
  const scanProgress = rootRef.current.scanProgress;
  const current = rootRef.current.current;
  const total = rootRef.current.total;
  const timeLeftInSeconds = rootRef.current.timeLeftInSeconds;
  const hasPotentialSimilarResults = rootRef.current.hasPotentialSimilarResults;
  const reducedSize = rootRef.current.reducedSize;
  const body = getBodyScope();
  const theme = (body?.theme as string) || 'dark';

  const vr = useVsRepeat(listRef, step === 'SCAN-RESULT' ? groups : undefined, { elementSize: 275, excess: 10 }, groups.length);

  if (!host) return null;

  const renderGroupItems = (isSimilar: boolean) => (
    <>
      <div className="vs-repeat-before-content" style={{ width: '100%', minHeight: vr.beforeHeight }} />
      {vr.innerItems.map((group: any, index: number) => (
        <div className="duplicate-group" key={index}>
          <div className="group-header">
            <div className="title" onClick={() => toggleGroupSelection(group)}>
              <div className={`checkbox${isGroupSelected(group) ? ' checked' : ''}`}>
                <div className="check-icon" />
              </div>
              <b>{group.items.length}</b>
              {isSimilar ? t('duplicatePanel.step3.list.similar') : t('duplicatePanel.step3.list.same')}
            </div>
            <div className="right">
              <div
                className="ic-btn"
                tippy=""
                tippy-content={t('duplicatePanel.step3.list.removeFromList')}
                tippy-placement="top"
                onClick={() => removeGroup(group)}
              >
                <img src={`assets/images/${themePathOf(theme)}/icons/ic-duplicate-remove-group.svg`} />
              </div>
            </div>
          </div>
          <div className="group-items">
            {group.items.map((item: any, itemIndex: number) =>
              isSimilar ? (
                <div
                  key={itemIndex}
                  data-box-id={item.id}
                  data-hover-delay="500"
                  className={`group-item similar-item box${group.choice === item ? ' selected' : ''}`}
                  onClick={() => selectChoice(group, item)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    openItemContextMenu(group, item);
                  }}
                  onMouseUp={(e) => onItemMouseup(e.nativeEvent, item)}
                >
                  <div className="thumbnail">
                    <div className={`img-wrap${item.width > item.height ? ' fit-width' : ''}${item.width <= item.height ? ' fit-height' : ''}`}>
                      {group.choice === item && (
                        <div className="choice-icon">
                          <img src="assets/images/base/icons/ic-duplicate-choice.svg" />
                        </div>
                      )}
                      {!item.noPreview && (
                        <img className="zoom-btn" src={getThumbnailUrl(item)} style={{ aspectRatio: `${item.width}/${item.height}` }} />
                      )}
                      {!!item.noPreview && <ExtIcon itemId={item.id} />}
                    </div>
                  </div>
                  <div className="title">{item.name}</div>
                  <div className="meta">
                    {item.ext}・{filesize(item.size)}
                  </div>
                  <div className="meta" style={ngShow(!(item.width > 0))}>
                    {ngNumber0(item.width)} × {ngNumber0(item.height)}
                  </div>
                </div>
              ) : (
                <div
                  key={itemIndex}
                  className="group-item"
                  onContextMenu={(e) => {
                    e.preventDefault();
                    openItemContextMenu(group, item);
                  }}
                  onMouseUp={(e) => onItemMouseup(e.nativeEvent, item)}
                >
                  <div className="thumbnail">
                    {!item.noPreview && <img src={getThumbnailUrl(item)} style={{ aspectRatio: `${item.width}/${item.height}` }} />}
                    {!!item.noPreview && <ExtIcon itemId={item.id} />}
                  </div>
                  <div className="title">{item.name}</div>
                  <div className="meta">
                    {item.ext}・{filesize(item.size)}
                  </div>
                  <div className="meta" style={ngShow(!(item.width > 0))}>
                    {ngNumber0(item.width)} × {ngNumber0(item.height)}
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      ))}
      <div className="vs-repeat-after-content" style={{ width: '100%', minHeight: vr.afterHeight }} />
    </>
  );

  return createPortal(
    <>
      <div id="duplicate-scan-panel" className={`duplicate-scan-panel${isOpen ? ' open' : ''}`}>
        {/* 步驟1 - 選擇掃描方式 */}
        {step === 'INITIAL' && (
          <div className="page">
            <div className="panel-header">
              <div className="left">
                <div className="ic-btn back" onClick={() => back()} style={{ opacity: 0, pointerEvents: 'none' }}>
                  <img src={`assets/images/${themePathOf(theme)}/icons/ic-modal-back.svg`} />
                </div>
              </div>
              <div className="center">
                <div className="title">{t('duplicatePanel.step1.title')}</div>
              </div>
              <div className="right">
                <div className="ic-btn close" onClick={() => close()}>
                  <img src={`assets/images/${themePathOf(theme)}/icons/ic-modal-close.svg`} />
                </div>
              </div>
            </div>
            <div className="panel-content">
              <div
                className={`methods${scanMethod === 'SAME' ? ' animating-same' : ''}${scanMethod === 'SIMILAR' ? ' animating-similar' : ''}`}
              >
                {/* 掃描相同 */}
                <div className="method">
                  <img src={`assets/images/${themePathOf(theme)}/illustrations/duplicate-same-scanning.png`} width={300} height={144} />
                  <div className="title">{t('duplicatePanel.same.title')}</div>
                  <div className="desc">{t('duplicatePanel.same.desc')}</div>
                  <div className="button button-primary" onClick={() => scanSame()}>
                    <img src="assets/images/base/icons/ic-duplicate-scan.svg" />
                    {t('duplicatePanel.step1.scanBtn')}
                  </div>
                </div>
                {/* 掃描相似 */}
                <div className="method">
                  <img src={`assets/images/${themePathOf(theme)}/illustrations/duplicate-similar-scanning.png`} width={300} height={144} />
                  <div className="title">{t('duplicatePanel.similar.title')}</div>
                  <div className="desc">{t('duplicatePanel.similar.desc')}</div>
                  <div className="button button-primary" onClick={() => scanSimilar()}>
                    <img src="assets/images/base/icons/ic-duplicate-scan.svg" />
                    {t('duplicatePanel.step1.scanBtn')}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 步驟2 - 掃描中 */}
        {step === 'SCAN' && (
          <div style={{ height: '100%' }}>
            {/* 相同 */}
            {scanMethod === 'SAME' && (
              <div className="page">
                <div className="panel-header">
                  <div className="left">
                    <div className="ic-btn back" onClick={() => back()}>
                      <img src={`assets/images/${themePathOf(theme)}/icons/ic-modal-back.svg`} />
                    </div>
                  </div>
                  <div className="center">
                    <div className="title">{t('duplicatePanel.same.title')}</div>
                  </div>
                  <div className="right">
                    <div className="ic-btn close" onClick={() => close()}>
                      <img src={`assets/images/${themePathOf(theme)}/icons/ic-modal-close.svg`} />
                    </div>
                  </div>
                </div>
                <div className="panel-content">
                  <div className="scan-progress">
                    <img src={`assets/images/${themePathOf(theme)}/illustrations/duplicate-same-scanning.png`} width={300} height={144} />
                    <div className="title">{t('duplicatePanel.step2.title')}</div>
                    <div className="progress">
                      <div className="curr" style={{ width: `${scanProgress}%` }} />
                    </div>
                    <div className="desc">
                      {ngNumber0(current)}/{ngNumber0(total)}
                      <span>({scanProgress}%)</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 相似 */}
            {scanMethod === 'SIMILAR' && (
              <div className="page">
                <div className="panel-header">
                  <div className="left">
                    <div className="ic-btn back" onClick={() => back()}>
                      <img src={`assets/images/${themePathOf(theme)}/icons/ic-modal-back.svg`} />
                    </div>
                  </div>
                  <div className="center">
                    <div className="title">{t('duplicatePanel.similar.title')}</div>
                  </div>
                  <div className="right">
                    <div className="ic-btn close" onClick={() => close()}>
                      <img src={`assets/images/${themePathOf(theme)}/icons/ic-modal-close.svg`} />
                    </div>
                  </div>
                </div>
                <div className="panel-content">
                  <div className="scan-progress">
                    <img src={`assets/images/${themePathOf(theme)}/illustrations/duplicate-similar-scanning.png`} width={300} height={144} />
                    <div className="title">{t('duplicatePanel.step2.title')}</div>
                    <div className="progress">
                      <div className="curr" style={{ width: `${scanProgress}%` }} />
                    </div>
                    <div className="desc">
                      {ngNumber0(current)}/{ngNumber0(total)}
                      <span>({scanProgress}%)</span>
                      <span className="counter" style={ngShow(!!timeLeftInSeconds)}>
                        {' '}
                        ({second2time(timeLeftInSeconds)})
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 步驟3 - 掃描結果 */}
        {step === 'SCAN-RESULT' && (
          <div style={{ height: '100%' }}>
            {/* 相同 */}
            {scanMethod === 'SAME' && (
              <div className="page">
                <div className="panel-header">
                  <div className="left">
                    <div className="ic-btn back" onClick={() => back()}>
                      <img src={`assets/images/${themePathOf(theme)}/icons/ic-modal-back.svg`} />
                    </div>
                  </div>
                  <div className="center">
                    <div className="title">{t('duplicatePanel.same.title')}</div>
                  </div>
                  <div className="right">
                    <div className="ic-btn close" onClick={() => close()}>
                      <img src={`assets/images/${themePathOf(theme)}/icons/ic-modal-close.svg`} />
                    </div>
                  </div>
                </div>
                {/* 空狀態 */}
                {groups.length === 0 && (
                  <div className="panel-content">
                    <div className="empty-state">
                      <img src={`assets/images/${themePathOf(theme)}/illustrations/duplicate-same-empty.png`} width={286} height={144} />
                      <div className="title">{t('duplicatePanel.step3.empty.title')}</div>
                      <div className="desc">{t('duplicatePanel.step3.empty.same')}</div>
                    </div>
                  </div>
                )}
                {/* 結果列表 */}
                {groups.length > 0 && (
                  <div className="panel-content">
                    <div className="duplicate-groups" ref={listRef as any} vs-excess="10" vs-repeat="275" vs-size="size">
                      {renderGroupItems(false)}
                    </div>
                  </div>
                )}
                {groups.length > 0 && (
                  <div className="panel-footer">
                    <div className="left" style={ngShow(selectedItems.length > 0)}>
                      {t('duplicatePanel.footer.selectedMsg1')}
                      <b>{ngNumber0(selectedItems.length)}</b>
                      {t('duplicatePanel.footer.selectedMsg2')}
                      <b>{filesize(reducedSize)}</b>
                      {t('duplicatePanel.footer.selectedMsg3')}
                    </div>
                    <div className="right">
                      <div
                        className={`button button-primary${selectedItems.length === 0 ? ' button-disabled' : ''}`}
                        onClick={() => startMerge()}
                      >
                        <img src="assets/images/base/icons/ic-duplicate-merge-all.svg" />
                        {t('duplicatePanel.footer.nextBtn')}
                        <span style={ngShow(selectedItems.length <= 0)}> ({selectedItems.length})</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 相似 */}
            {scanMethod === 'SIMILAR' && (
              <div className="page">
                <div className="panel-header">
                  <div className="left">
                    <div className="ic-btn back" onClick={() => back()}>
                      <img src={`assets/images/${themePathOf(theme)}/icons/ic-modal-back.svg`} />
                    </div>
                  </div>
                  <div className="center">
                    <div className="title">{t('duplicatePanel.similar.title')}</div>
                  </div>
                  <div className="right">
                    <div className="ic-btn close" onClick={() => close()}>
                      <img src={`assets/images/${themePathOf(theme)}/icons/ic-modal-close.svg`} />
                    </div>
                  </div>
                </div>
                {/* 空狀態 */}
                {groups.length === 0 && (
                  <div className="panel-content">
                    <div className="empty-state">
                      <img src={`assets/images/${themePathOf(theme)}/illustrations/duplicate-similar-empty.png`} width={286} height={144} />
                      <div className="title">{t('duplicatePanel.step3.empty.title')}</div>
                      <div className="desc">{t('duplicatePanel.step3.empty.similar')}</div>
                    </div>
                  </div>
                )}
                {/* 結果列表 */}
                {groups.length > 0 && (
                  <div className="panel-content">
                    <div className="duplicate-groups" ref={listRef as any} vs-excess="10" vs-repeat="275" vs-size="size">
                      {renderGroupItems(true)}
                    </div>
                  </div>
                )}
                {/* 相似度滑塊區域，只在有潛在相似結果時顯示 */}
                <div className="panel-footer" style={ngShow(!!hasPotentialSimilarResults)}>
                  <div className="left" style={ngShow(!!(selectedItems.length > 0 && groups.length > 0))}>
                    {t('duplicatePanel.footer.selectedMsg1')}
                    <b>{ngNumber0(selectedItems.length)}</b>
                    {t('duplicatePanel.footer.selectedMsg2')}
                    <b>{filesize(reducedSize)}</b>
                    {t('duplicatePanel.footer.selectedMsg3')}
                  </div>
                  <div className="right">
                    {t('duplicatePanel.footer.similarity')}
                    <div className="sliders-bar has-btn">
                      <div className="slider">
                        <div className="range-wrap">
                          <div className="range-progressbar">
                            <div className="current" style={{ width: `${((similarity - 1) / 0.15) * 100}%` }} />
                          </div>
                          <input
                            className="range"
                            type="range"
                            name="points"
                            min={0.8}
                            max={1}
                            step={0.01}
                            tabIndex={-1}
                            value={similarity}
                            onChange={(e: any) => {
                              rootRef.current.similarity = Number(e.target.value);
                              bumpAll();
                              changeSimilarity(Number(e.target.value));
                            }}
                          />
                        </div>
                      </div>
                    </div>
                    <div
                      className={`button button-primary${selectedItems.length === 0 || groups.length === 0 ? ' button-disabled' : ''}`}
                      onClick={() => startMerge()}
                    >
                      <img src="assets/images/base/icons/ic-duplicate-merge-all.svg" />
                      {t('duplicatePanel.footer.nextBtn')}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 步驟4 - 合併預覽 */}
        {step === 'MERGE' && (
          <div className="page">
            <div className="page">
              <div className="panel-header">
                <div className="left">
                  <div className="ic-btn back" onClick={() => goResult()}>
                    <img src={`assets/images/${themePathOf(theme)}/icons/ic-modal-back.svg`} />
                  </div>
                </div>
                <div className="center">
                  <div className="title">{t('duplicatePanel.step4.title')}</div>
                </div>
                <div className="right">
                  <div className="ic-btn close" onClick={() => close()}>
                    <img src={`assets/images/${themePathOf(theme)}/icons/ic-modal-close.svg`} />
                  </div>
                </div>
              </div>
              <div className="panel-content">
                <MergeEditor
                  groups={groups}
                  selectedGroupMap={rootRef.current.selectedGroupMap}
                  onMerged={onMerged}
                  folderMappings={body?.folderMappings || {}}
                />
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="duplicate-scan-panel-overlay" />
    </>,
    host
  );
}

/* ================= duplicateModal（镜像逐字 + 模板） ================= */

export function DuplicateModal() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [, bump] = useState(0);
  const bumpAll = () => bump((v: number) => v + 1);
  const rootRef = useRef<any>({});
  const isOpenRef = useRef(false);
  isOpenRef.current = isOpen;

  useEffect(() => {
    setHost(document.getElementById('eagle-duplicate-modal-host'));
  }, []);

  // link 期初始化（镜像 14-19：isOpen=false/left/right/duplicates=[]/applyAll='false'/usingExist='true'）
  if (rootRef.current.duplicates === undefined) {
    rootRef.current.duplicates = [];
    rootRef.current.applyAll = 'false';
    rootRef.current.usingExist = 'true';
  }

  useEffect(() => {
    const body = getBodyScope();
    if (!body) return;
    const ipc = getIpc();

    // $("body").on("click", ".duplicate-modal *", ...)（镜像 22-24）
    const onBodyClick = (e: any) => {
      const t = e.target as Element | null;
      if (t && typeof (t as any).closest === 'function' && (t as any).closest('.duplicate-modal')) {
        document.getElementById('duplicate-input')?.focus();
      }
    };
    document.body.addEventListener('click', onBodyClick);
    const offBodyClick = () => document.body.removeEventListener('click', onBodyClick);

    // $on("OPEN_DUPLICATE")（镜像 26-41 逐字）
    const offOpen = openDuplicateChannel.on((params: any) => {
      ipc.send('show');
      rootRef.current.currentFolder = params.currentFolder;
      rootRef.current.mappings = params.mappings;
      rootRef.current.applyAll = 'false';
      params.duplicates.forEach((d: any) => {
        rootRef.current.duplicates.push(d);
      });
      loadFirst();
      setTimeout(() => {
        setIsOpen(true);
        setTimeout(() => {
          document.getElementById('duplicate-input')?.focus();
        }, 200);
      }, 300);
      bumpAll();
    });

    // ipcRenderer.on('image.changed')（镜像 43-54 逐字）
    const onImageChanged = (event: any, newImage: any) => {
      if (rootRef.current.duplicates && rootRef.current.duplicates.length > 0) {
        const hashID = w().getHashID(newImage);
        for (let i = 0; i < rootRef.current.duplicates.length; i++) {
          const img = rootRef.current.duplicates[i];
          if (hashID == w().getHashID(img)) {
            img.palettes = newImage.palettes;
            delete img.processingPalette;
          }
        }
      }
    };
    if (ipc && ipc.on) {
      ipc.on('image.changed', onImageChanged);
    }

    // auto-focus 指令（OPEN_DUPLICATE → $timeout(100) → click + focus + select）
    const offAutoFocus = openDuplicateChannel.on(() => {
      setTimeout(() => {
        const el = document.getElementById('duplicate-input') as HTMLInputElement | null;
        if (el) {
          try {
            el.click();
          } catch (err) {}
          el.focus();
          el.select();
        }
      }, 100);
    });

    // 闭环测试契约
    (window as any).__eagleDuplicateModal = {
      get isOpen() {
        return isOpenRef.current;
      },
      get duplicates() {
        return rootRef.current.duplicates;
      },
      get left() {
        return rootRef.current.left;
      },
      get right() {
        return rootRef.current.right;
      },
    };

    return () => {
      if (offBodyClick) offBodyClick();
      offOpen();
      offAutoFocus();
      if (ipc && ipc.off) ipc.off('image.changed', onImageChanged);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host]);

  const loadFirst = () => {
    const duplicates = rootRef.current.duplicates || [];
    const hashID = w().getHashID(duplicates[0]);
    const image = duplicates[0];
    rootRef.current.left = rootRef.current.mappings[hashID];
    rootRef.current.right = image;
  };

  const revealInUnfiled = (item: any) => {
    const body = getBodyScope();
    machineryOpenUnfiled(body, undefined);
    setTimeout(() => {
      body.selected = [item];
      syncInspectorFromScope();
      scrollToSelectedItem();
    }, 500);
  };

  const onKeyup = (event: any) => {
    const keyCode = event.keyCode;
    if (keyCode === 27) {
      if (event.metaKey || event.ctrlKey) {
        cancelAll();
      } else {
        cancel();
      }
    }
    if (keyCode === 13) {
      if (event.metaKey || event.ctrlKey) {
        saveAll();
      } else {
        save();
      }
    }
  };

  // 取得继承炼的标签（镜像 92-111 逐字）
  const getExtendTags = (folder: any, tags: any) => {
    try {
      if (folder.tags) {
        folder.tags.forEach((tag: any) => {
          tags.push(tag);
        });
      }
      const parent = rootRef.current.folderMappings?.[folder.parent] ?? getBodyScope().folderMappings[folder.parent];
      if (parent && parent.tags && folder.parent) {
        return getExtendTags(parent, tags);
      } else {
        return (tags as any).unique().reverse();
      }
    } catch (err: any) {
      if (w().electronLog) w().electronLog.error(err.stack || err);
      return [];
    }
  };

  const save = () => {
    const body = getBodyScope();
    const ipc = getIpc();
    const rootScope = body; // 原：rootScope = angular.element("body").scope()（隐式全局）

    if (rootRef.current.applyAll == 'true') {
      saveAll();
    } else {
      // 如果勾选使用资源库版本
      if (rootRef.current.usingExist == 'true') {
        // 将新导入对应的文件夹添加到既有文件上
        try {
          const newFileFolders = rootRef.current.right.folders;
          if (newFileFolders && newFileFolders.length > 0) {
            newFileFolders.forEach((folderId: any) => {
              const folder = body.folderMappings[folderId];
              if (!folder) return;

              const idx = rootRef.current.left.folders.indexOf(folderId);
              if (idx === -1) {
                rootRef.current.left.folders.push(folderId);
                // 添加自动标签
                if (!rootRef.current.left.tags) {
                  rootRef.current.left.tags = [];
                }
                const tags = getExtendTags(folder, []);
                tags.forEach((tag: any) => {
                  rootRef.current.left.tags.push(tag);
                });
              }
            });
          }
        } catch (err) {}

        rootRef.current.left.folders = [...new Set(rootRef.current.left.folders)];
        rootRef.current.left.tags = [...new Set(rootRef.current.left.tags)];

        rootRef.current.left.modificationTime = rootRef.current.right.modificationTime;
        ipc.send('images-change', [rootRef.current.left]);
        ipc.send('empty-trash', rootRef.current.right.id);
      } else {
        // 將圖片添加至內容列表
        rootScope.addToDuplicateMapping(rootRef.current.right);
        rootScope.raw.push(rootRef.current.right);
      }
      rootRef.current.duplicates.splice(0, 1);
      const rootScopeB = getRootScope();
      calculateImageBindingChannel.emit();
      rebindRefreshChannel.emit(false);

      ipc.send('palette-resume');

      if (rootRef.current.duplicates.length > 0) {
        loadFirst();
      } else {
        close();
      }
      bumpAll();
    }
  };

  const saveAll = () => {
    const body = getBodyScope();
    const ipc = getIpc();
    const rootScope = body;

    // 如果勾选使用资源库版本
    if (rootRef.current.usingExist == 'true') {
      // left: mappings[hashID]
      let imageIdString = '';
      rootRef.current.duplicates.forEach((right: any) => {
        const hashID = w().getHashID(right);
        const left = rootRef.current.mappings[hashID];

        try {
          const newFileFolders = right.folders;
          if (newFileFolders && newFileFolders.length > 0) {
            newFileFolders.forEach((folderId: any) => {
              const folder = body.folderMappings[folderId];
              if (!folder) return;

              const idx = left.folders.indexOf(folderId);
              if (idx === -1) {
                left.folders.push(folderId);
                // 添加自动标签
                if (!left.tags) {
                  left.tags = [];
                }
                const tags = getExtendTags(folder, []);
                tags.forEach((tag: any) => {
                  left.tags.push(tag);
                });
              }
            });
          }
        } catch (err) {}

        left.folders = [...new Set(left.folders)];
        left.tags = [...new Set(left.tags)];
        left.modificationTime = right.modificationTime;
        ipc.send('images-change', [left]);
        imageIdString += right.id + ',';
      });
      ipc.send('empty-trash', imageIdString);
    } else {
      rootRef.current.duplicates.forEach((image: any) => {
        rootScope.addToDuplicateMapping(image);
        rootScope.raw.push(image);
      });
    }

    rootRef.current.duplicates = [];
    const rootScopeB = getRootScope();
    calculateImageBindingChannel.emit();
    rebindRefreshChannel.emit(false);
    ipc.send('palette-resume');
    close();
  };

  const cancel = () => {
    const body = getBodyScope();
    const ipc = getIpc();

    if (rootRef.current.applyAll == 'true') {
      cancelAll();
    } else {
      // 移除該圖片
      const image = rootRef.current.right;

      ipc.send('empty-trash', image.id);
      rootRef.current.duplicates.splice(0, 1);
      delete body.itemMappings[image.id];

      if (rootRef.current.duplicates.length > 0) {
        loadFirst();
      } else {
        if (body.selectedMappings[image.id]) {
          body.selectedMappings = {};
          body.selected = [];
          syncInspectorFromScope();
          updateSelection();
        }
        close();
      }
      bumpAll();
    }
  };

  const cancelAll = () => {
    const body = getBodyScope();
    const ipc = getIpc();
    const rootScope = body;

    let imageIdString = '';
    rootRef.current.duplicates.forEach((r: any) => {
      imageIdString += r.id + ',';
      delete body.itemMappings[r.id];
    });
    ipc.send('empty-trash', imageIdString);
    rootRef.current.duplicates = [];
    const rootScopeB = getRootScope();
    calculateImageBindingChannel.emit();
    rebindRefreshChannel.emit(false);
    glResetChannel.emit(rootScope.allData);
    close();
  };

  const close = () => {
    setTimeout(() => {
      rootRef.current.left = undefined;
      rootRef.current.right = undefined;
      rootRef.current.duplicates = [];
      // 原版此处为 `$scope.applyAll == 'false'` 比较表达式（no-op 怪癖，保留语义）
      void (rootRef.current.applyAll == 'false');
    }, 500);
    setIsOpen(false);
    document.getElementById('duplicate-input')?.blur();
    bumpAll();
  };

  if (!host) return null;

  const duplicates: any[] = rootRef.current.duplicates || [];
  const left = rootRef.current.left;
  const right = rootRef.current.right;
  const usingExist = rootRef.current.usingExist;
  const applyAll = rootRef.current.applyAll;
  const body = getBodyScope();
  const folderMappings = rootRef.current.folderMappings || body?.folderMappings || {};

  const videoExts = 'ts|3gp|360|afx|vap|eva|mp4|mov|m4v|webm|mkv|avi|wmv|mpg|mts|flv|m2ts|f4v'.split('|');
  const renderDuplicate = (side: 'left' | 'right', item: any) => {
    if (!item) return null;
    const isVideoExt = videoExts.indexOf(item.ext) > -1;
    const isNew = side === 'right';
    return (
      <div className="duplicate">
        <div className={`image ${item.ext}${isNew && usingExist === 'true' ? ' fade' : ''}`}>
          {/* 原版怪癖：右側 iframe 的 ng-src 傳入的是 left（getExifPath(left)），逐字保留 */}
          {item.orientation && item.orientation !== 1 && (
            <iframe src={body?.getExifPath(isNew ? rootRef.current.left : item)} frameBorder={0} />
          )}
          {!(item.orientation && item.orientation !== 1) && <img src={getThumbnailUrlImpl(item)} alt="" />}
          {!!item.noPreview && <ExtIcon itemId={item.id} />}
          <div className={`label${isNew ? ' new' : ''}`}>{isNew ? t('modal.duplicate.now') : t('modal.duplicate.exist')}</div>
        </div>
        <div className="name">
          {item.name}.{item.ext}
        </div>
        {isVideoExt ? (
          <div className="metas">
            {item.width} × {item.height} / {ngNumber0(item.size / 1024)}KB / {String(item.ext || '').toUpperCase()}
          </div>
        ) : (
          <div className="metas">
            <span style={ngShow(item.width > 0)}>
              {item.width} × {item.height} /{' '}
            </span>
            {ngNumber0(item.size / 1024)}KB
          </div>
        )}
        {!isNew && (
          <div className="folder">
            {item.folders.length > 0 && (
              <span onClick={() => body && machineryQuickOpenFolder(body, folderMappings[item.folders[0]], item)}>{folderMappings[item.folders[0]]?.name}</span>
            )}
            {item.folders.length === 0 && (
              <span onClick={() => revealInUnfiled(item)}>{t('modal.duplicate.unfiled')}</span>
            )}
          </div>
        )}
        {isNew && item.folders.length > 0 && (
          <div className="folder">
            <span>{folderMappings[item.folders[0]]?.name}</span>
          </div>
        )}
      </div>
    );
  };

  return createPortal(
    <>
      {isOpen && (
        <div className="modal duplicate-modal open">
          <div className="modal-header">
            <div className="name">
              {t('modal.duplicate.title')}
              <span style={ngShow(duplicates.length <= 1)}> ({duplicates.length})</span>
            </div>
            <div className="close" onClick={() => cancel()} />
          </div>
          <div className="section">
            <div className="duplicate-container">
              {renderDuplicate('left', left)}
              {renderDuplicate('right', right)}
            </div>
            <input
              id="duplicate-input"
              style={{ opacity: 0, height: 0 }}
              onKeyDown={onKeyup}
              auto-focus="OPEN_DUPLICATE"
              tabIndex={-1}
            />
          </div>
          <div className="section darken textAlign-right">
            <label className="control radio" style={{ marginRight: '12px' }}>
              <input
                type="checkbox"
                checked={usingExist === 'true'}
                onChange={(e: any) => {
                  rootRef.current.usingExist = e.target.checked ? 'true' : 'false';
                  bumpAll();
                }}
              />
              <span className="control-indicator" />
              {t('modal.duplicate.usingExist')}
            </label>
            <label className="control radio">
              <input
                type="checkbox"
                checked={usingExist === 'false'}
                onChange={(e: any) => {
                  rootRef.current.usingExist = e.target.checked ? 'false' : 'true';
                  bumpAll();
                }}
              />
              <span className="control-indicator" />
              {t('modal.duplicate.keepBoth')}
            </label>

            <label className="control checkbox" style={{ marginRight: '12px', ...(duplicates.length > 1 ? {} : ngShow(false) || {}) }}>
              <input
                type="checkbox"
                checked={applyAll === 'true'}
                onChange={(e: any) => {
                  rootRef.current.applyAll = e.target.checked ? 'true' : 'false';
                  bumpAll();
                }}
              />
              <span className="control-indicator" />
              {t('modal.duplicate.applyAll')}({duplicates.length})
            </label>
            <div className="button button-xs button-primary" onClick={() => save()}>
              {t('modal.duplicate.importBtn')}
            </div>
          </div>
        </div>
      )}
      <div className="modal-overlay" />
    </>,
    host
  );
}