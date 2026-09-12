import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FilterSnapshot, FilterFolderItem } from '../../store/filterState';
import { t } from '../../global/eagleGlobals';
import { shortcuts, shortcutsWrapper, substring } from '../../app/filters';
import { useTippy, useSelectAll } from '../hooks';
import { FilterItemShell, CheckItem,  focusInput } from './FilterItemShell';
import { ColorPicker } from './ColorPicker';
import { syncFilterFromScope } from '../../store/filterState';
import { getBodyScope, runInBodyScope } from '../../core/appCore';

import { calcuteContainFolders, excludeWithFolder, filterWithColor, filterWithFolder, filterWithHexColor, hexToRGB } from '../../core/filterDomain';
import { excludeWithTag } from '../../services/batchOpsService';
import { filterWithTag } from '../../services/fontTagService';
import { scopeEvalAsync } from '../../core/scopeRuntime';
import { machineryUpdateContainerHieght } from '../../services/gridService';
import { machineryCalculateFilterCounts, machineryFilterContent } from '../../core/filterDomain';
/** 阶段3b（1/2）：color/folders/tags + 组件注册表（其余 items 与容器在 FilterItems2）。 */

export const KIND_COMPONENTS: Record<string, React.ComponentType<{ snapshot: FilterSnapshot }>> = {};

const num0 = (value: number | undefined | null): string => {
  if (value == null) return '0';
  return String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

function themePathOf(theme: string): string {
  return theme === 'light' || theme === 'lightgray' ? 'light' : 'dark';
}

const menuIcon = (theme: string, icon: string) => `assets/images/${themePathOf(theme)}/icons/context-menu/${icon}`;

const filter = (): any => getBodyScope()?.eagle?.filter;
const bodyScope = (): any => getBodyScope();

/** `page = 1; filterContent();` / `page = 1; reload();` 等价。 */
const runSeq = (fns: Array<(s: any) => void>) =>
  runInBodyScope((s) => {
    fns.forEach((fn) => fn(s));
  });

/** changeDisplayName 公共副作用（300ms 后 updateContainerHieght）。 */
function useDisplayNameSideEffect(displayName: string) {
  useEffect(() => {
    const timer = setTimeout(() => {
      runInBodyScope((s) => machineryUpdateContainerHieght(s));
    }, 300);
    return () => clearTimeout(timer);
  }, [displayName]);
}

/* ============ 通用片段 ============ */

function NameHead({ theme, tipKeybind, title, icon, children }: {
  theme: string;
  tipKeybind?: string;
  title?: string;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="name"
      title={title}
      tippy=""
      tippy-placement="bottom"
      tippy-content={`${shortcuts(shortcutsWrapper(tipKeybind || ''))}`}
    >
      <img src={menuIcon(theme, icon)} />
      <div>{children}</div>
    </div>
  );
}

const ClearBtn = ({ onClick }: { onClick: (e: React.MouseEvent) => void }) => (
  <div className="clear-btn" onClick={onClick}>
    <img src="assets/images/dark/icons/ic-filter-clear-btn.png" />
  </div>
);

function DebouncedInput({ value, placeholder, onCommit, id, maxlength = 256, className }: {
  value: any;
  placeholder?: string;
  onCommit: (v: string) => void;
  id?: string;
  maxlength?: number;
  className?: string;
}) {
  const [draft, setDraft] = useState(value ?? '');
  useEffect(() => { if (!id || document.activeElement?.id !== id) setDraft(value ?? ''); }, [value, id]);
  const timer = useRef<any>(null);
  return (
    <input
      id={id}
      className={className}
      maxLength={maxlength}
      type="text"
      placeholder={placeholder}
      value={draft}
      onChange={(e) => {
        const v = e.target.value;
        setDraft(v);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => onCommit(v), 300);
      }}
      onBlur={() => {
        clearTimeout(timer.current);
        onCommit(draft);
      }}
    />
  );
}

/* ============ color（bundle:68091 + filter-item-color.html） ============ */

function rgbToHexFn(r?: number, g?: number, b?: number): string {
  if (r == null || g == null || b == null) return '';
  const toHex = (n: number) => Math.round(n).toString(16).padStart(2, '0').toUpperCase();
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

const COLOR_PALETTES = [
  ['#111111', false],
  ['#FFFFFF', false],
  ['#9E9E9E', false],
  ['#A48057', false],
  ['#FC85B3', false],
  ['#FF2727', false],
  ['#FFA34B', false],
  ['#FFD534', false],
  ['#47C595', false],
  ['#51C4C4', false],
  ['#2B76E7', false],
  ['#6D50ED', false],
] as const;

function ColorItem({ snapshot }: { snapshot: FilterSnapshot }) {
  const rules = snapshot.rules;
  const value = rules.color?.value;
  const gray = !!rules.color?.gray;
  const enabled = !!value || gray;
  const hideFilter = !enabled && !snapshot.pinned['color'];
  useDisplayNameSideEffect(enabled ? 'color' : '');
  const rootRef = useRef<HTMLDivElement>(null);
  useTippy(rootRef, snapshot);
  const [hexDraft, setHexDraft] = useState('#FFFFFF');

  const clearColor = (e: React.MouseEvent) => {
    e && e.stopPropagation();
    const f = filter();
    f.filterRules.color.value = undefined;
    f.filterRules.color.gray = false;
    runSeq([(s) => { s.page = 1; s.reload(); machineryCalculateFilterCounts(s); }]);
  };

  const activeHex = rgbToHexFn(value?.[0], value?.[1], value?.[2]);

  // b1-9bj：自研 ColorPicker（原 #colorpickerHolder jQuery ColorPicker，bundle:68096-68127
  // 契约等价——onChange 33ms 防抖 + currentColor ngModel 优先路径 + 同步 colors-picker
  // 双输入框 + 快捷输入框回焦）
  const colorChangeTimeout = useRef<any>(null);
  const handlePickerChange = (hex: string) => {
    const color = '#' + String(hex).toUpperCase();
    if (!color) return;
    clearTimeout(colorChangeTimeout.current);
    colorChangeTimeout.current = setTimeout(() => {
      const s = bodyScope();
      const root = s?.$root;
      if (root?.currentColor) {
        root.currentColor.$setViewValue(color);
        root.currentColor.$render();
        scopeEvalAsync();
      } else if (s) {
        s.hexColor = color;
        filterWithColor(hexToRGB(color));
        scopeEvalAsync();
      }
    }, 33);
    const valueInput = document.getElementById('colors-picker-value') as HTMLInputElement | null;
    const colorInput = document.getElementById('colors-picker') as HTMLInputElement | null;
    if (valueInput) valueInput.value = color.toUpperCase();
    if (colorInput) colorInput.value = color;
    setTimeout(() => {
      const si = rootRef.current?.querySelector('.shortcut-input') as HTMLElement | null;
      si?.focus();
    }, 24);
  };

  const openColorPicker = () => {
    const colorInput = document.getElementById('colors-picker') as HTMLInputElement | null;
    colorInput?.click();
  };

  return (
    <div ref={rootRef}>
      <FilterItemShell
        id="color-filter-item"
        active={enabled}
        hideFilter={hideFilter}
        onContextMenu={clearColor}
        onClear={clearColor}
      >
        <div
          className="name"
          tippy=""
          tippy-placement="bottom"
          tippy-content={shortcuts(shortcutsWrapper(snapshot.keybinds['find.filter.color'] || ''))}
        >
          <div className="color">
            {!value && !gray ? <img src={iconOf(snapshot.theme, 'ic-rainbow-btn.png')} /> : null}
            {!value && gray ? <img src="assets/images/base/icons/ic-filter-grayscale.png" /> : null}
            {value && !gray ? <div className="circle" style={{ backgroundColor: rgbToHexFn(value[0], value[1], value[2]) }} /> : null}
            <span>{t('filter.color')}</span>
          </div>
        </div>
        <div className="menu-wrap" close-filter-item="">
          <div className="filter-menu" style={{ minWidth: 202, width: 202 }} onMouseDown={(e) => e.stopPropagation()}>
            <div className="menu-content">
              <div className="color-filter">
                <div>
                  <div style={{ margin: '-10px -14px 0px' }}>
                    <ColorPicker color={value ? activeHex : undefined} onChange={handlePickerChange} />
                  </div>
                </div>
                <div className="palettes">
                  <div
                    className={`palette none${!gray && !activeHex ? ' active' : ''}`}
                    style={{ backgroundColor: '#ccc' }}
                    onClick={(e) => { focusInput(rootRef.current); runInBodyScope((s) => filterWithColor()); }}
                  />
                  <div
                    className="palette gray"
                    onClick={(e) => { focusInput(rootRef.current); runInBodyScope((s) => filterWithHexColor('gray')); }}
                  />
                  {COLOR_PALETTES.map(([hex]) => (
                    <div
                      key={hex}
                      className={`palette${hex === activeHex ? ' active' : ''}`}
                      style={{ backgroundColor: hex }}
                      onClick={(e) => { focusInput(rootRef.current); runInBodyScope((s) => filterWithHexColor(hex)); }}
                    />
                  ))}
                </div>
                <div className="colors-picker">
                  <input
                    id="colors-picker-value"
                    maxLength={256}
                    tabIndex={-1}
                    type="text"
                    placeholder="#FF0000"
                    selectall=""
                    value={hexDraft}
                    onChange={(e) => {
                      setHexDraft(e.target.value);
                      runInBodyScope((s) => { s.hexColor = e.target.value; });
                      runInBodyScope((s) => filterWithHexColor(e.target.value));
                    }}
                  />
                  <div className="fake-color-input" onClick={openColorPicker} style={{ backgroundColor: hexDraft }} />
                  <div className="open-palette-btn" onClick={openColorPicker}>
                    <img src={iconOf(snapshot.theme, 'ic-rainbow-btn.png')} />
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: 12, marginTop: 12, lineHeight: '1em' }}>
                  <div style={{ opacity: 0.7, whiteSpace: 'nowrap' }}>{t('filter.accuracy')}</div>
                  <input
                    style={{ transform: 'scaleX(-1)', width: '100%', marginLeft: 10, height: 12 }}
                    className="range"
                    type="range"
                    name="points"
                    min={5}
                    max={40}
                    step={1}
                    tabIndex={-1}
                    value={rules.color?.accuracy ?? 20}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      runInBodyScope((s) => { s.eagle.filter.filterRules.color.accuracy = v; });
                      runInBodyScope((s) => filterWithHexColor(s.hexColor));
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
        <ClearBtn onClick={clearColor} />
      </FilterItemShell>
    </div>
  );
}

function iconOf(theme: string, icon: string) {
  return `assets/images/${themePathOf(theme)}/icons/${icon}`;
}

/* ============ folders（bundle:68209 + filter-item-folders.html） ============ */

function filterFoldersFn(folders: FilterFolderItem[], keyword: string): FilterFolderItem[] {
  if (!keyword) return folders;
  try {
    const w = window as any;
    const chineseConvert = w.chineseConvert;
    const pinyinlite = w.pinyinlite;
    const cartesianProduct = w.cartesianProduct;
    // b1-9bj：原 `!_` 守卫（lodash）随 vendor 退役移除——本函数不消费 lodash 方法，
    // 该守卫在 bc 卸载 lodash.js 后会使关键词搜索静默失效（哨兵盲区：裸绑定无方法调用）
    if (!chineseConvert || !pinyinlite) return folders;
    const keyword_cn = chineseConvert.tw2cn(keyword).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/\ /g, '').toLowerCase();
    const items = folders.map((folder) => {
      const nameCN = chineseConvert.tw2cn(folder.name).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      if (keyword.length >= 30 || folder.name.length >= 30) {
        return { folder, search: [nameCN] };
      }
      return {
        folder,
        search: [nameCN, ...Array.from(new Set(
          cartesianProduct(pinyinlite(nameCN, { keepUnrecognized: true }).filter((p: string[]) => p.length > 0))
            .map((item: string[]) => item.join(' '))
        ) as Iterable<string>)],
      };
    });
    const scores = items.map((item) => ({
      item,
      // b1-9bj：原 `_.string && _.score ? _.score : fuzzy_score` 为失真 fallback——
      // 语义 = String.prototype.score 原型扩展（bundle 2621），对齐其余搜索面同形调用
      score: Math.max(...item.search.map((pinyin: string) => (pinyin as any).score(keyword_cn))),
    }));
    return scores
      .filter((i) => i.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((i) => i.item.folder);
  } catch (err) {
    return folders;
  }
}

function FoldersItem({ snapshot }: { snapshot: FilterSnapshot }) {
  const rules = snapshot.rules;
  const includes = rules.folder?.includes || {};
  const excludes = rules.folder?.excludes || {};
  const { displayName, isEnabled } = useMemo(() => {
    let dn = t('filter.folders');
    let en = false;
    if (Object.keys(includes).length > 0 || Object.values(excludes).length > 0) {
      dn = '';
      const arr: string[] = [];
      Object.values(includes).forEach((f: any) => arr.push(f.name));
      Object.values(excludes).forEach((f: any) => arr.push('-' + f.name));
      if (arr.length > 0) {
        en = true;
        dn += arr.join(',');
      } else {
        en = false;
        dn = t('filter.folders');
      }
    }
    return { displayName: dn, isEnabled: en };
  }, [includes, excludes]);
  useDisplayNameSideEffect(displayName);
  const rootRef = useRef<HTMLDivElement>(null);
  useTippy(rootRef, snapshot);
  const [searchDraft, setSearchDraft] = useState(snapshot.filterFolderKeyword);
  useEffect(() => { setSearchDraft(snapshot.filterFolderKeyword); }, [snapshot.filterFolderKeyword]);

  const foldersList = useMemo(() => {
    let result = snapshot.containFolders;
    if (snapshot.filterFolderKeyword) result = filterFoldersFn(result, snapshot.filterFolderKeyword);
    return result;
  }, [snapshot.containFolders, snapshot.filterFolderKeyword]);

  const onOpen = () => {
    runInBodyScope((s) => {
      if (s.eagle.filter.folderFilterLogic === 'OR') {
        calcuteContainFolders(s.preelaborations);
      } else {
        calcuteContainFolders(s.allData);
      }
      scopeEvalAsync();
    });
  };

  const clearFolders = (e: React.MouseEvent) => {
    e && e.stopPropagation();
    const f = filter();
    f.filterRules.folder.includes = {};
    f.filterRules.folder.excludes = {};
    runSeq([(s) => { s.page = 1; s.reload(); }]);
  };

  const changeRule = (rule: string) => {
    runInBodyScope((s) => {
      s.eagle.filter.folderFilterLogic = rule;
      syncFilterFromScope();
      const selectedCount = (s.containFolders || []).filter((f: any) => f && f.isSelected).length;
      if (selectedCount > 0) {
        s.page = 1;
        machineryFilterContent(s);
      }
    });
    focusInput(rootRef.current);
  };

  const fuzzyName = (name: string) => {
    const fn = (window as any).fuzzy_match;
    if (!fn || !snapshot.filterFolderKeyword) return name;
    return fn(snapshot.filterFolderKeyword, name) || name;
  };

  return (
    <FilterItemShell
      id="folders-filter-item"
      active={isEnabled}
      hideFilter={!isEnabled && !snapshot.pinned['folders']}
      onOpen={onOpen}
      onContextMenu={clearFolders}
      onClear={clearFolders}
    >
      <div
        className="name"
        title={displayName}
        tippy=""
        tippy-placement="bottom"
        tippy-content={shortcuts(shortcutsWrapper(snapshot.keybinds['find.filter.folder'] || ''))}
      >
        <img src={menuIcon(snapshot.theme, 'ic-filter-item-folder.svg')} />
        <div>{displayName}</div>
      </div>
      <div className="menu-wrap">
        <div className="filter-menu" style={{ width: 360, maxWidth: 360 }} onMouseDown={(e) => e.stopPropagation()}>
          <div className="menu-header">
            <div className="search">
              <input
                id="filter-panel-folders-search"
                maxLength={1024}
                type="search"
                className="search shortcut-input focus"
                placeholder={t('filter.folders>search')}
                value={searchDraft}
                onChange={(e) => {
                  setSearchDraft(e.target.value);
                  clearTimeout((window as any).__foldersSearchTimer);
                  (window as any).__foldersSearchTimer = setTimeout(() => {
                    runInBodyScope((s) => { s.eagle.filter.filterFolderKeyword = e.target.value; });
                    syncFilterFromScope();
                  }, 100);
                }}
              />
            </div>
            {t('Filter.Tags.Rule')}
            <div className="tabs">
              {['OR', 'AND', 'EQUAL'].map((rule) => (
                <div
                  key={rule}
                  className={`tab${snapshot.folderFilterLogic === rule ? ' active' : ''}`}
                  tippy=""
                  tippy-placement="top"
                  tippy-content={t(rule === 'OR' ? 'Filter.Tags.Any' : rule === 'AND' ? 'Filter.Tags.All' : 'Filter.Tags.Equal')}
                  onClick={() => changeRule(rule)}
                >
                  <img src={`assets/images/${themePathOf(snapshot.theme)}/icons/filter/ic-logic-${rule.toLowerCase()}.svg`} />
                </div>
              ))}
            </div>
          </div>
          <div className="menu-content" style={{ margin: '4px 0 0' }}>
            <div
              id="filter-folder-list"
              className="folder-list"
              onMouseUp={() => focusInput(rootRef.current)}
            >
              <div style={{ display: snapshot.filteredsCount === 0 && foldersList.length === 0 ? '' : 'none' }} className="empty">{t('filter.emptyMsg')}</div>
              {foldersList.map((folder) => (
                <CheckItem
                  key={folder.id}
                  checked={!!includes[folder.id]}
                  excluded={!!excludes[folder.id]}
                  onClick={(e) => {
                    focusInput(rootRef.current);
                    const live = bodyScope()?.containFolders?.find((f: any) => f && f.id === folder.id);
                    runInBodyScope((s) => filterWithFolder(live));
                    runSeq([(s) => { s.page = 1; machineryFilterContent(s); }]);
                  }}
                  onContextMenu={(e) => {
                    e.stopPropagation();
                    focusInput(rootRef.current);
                    const live = bodyScope()?.containFolders?.find((f: any) => f && f.id === folder.id);
                    runInBodyScope((s) => excludeWithFolder(live));
                    runSeq([(s) => { s.page = 1; machineryFilterContent(s); }]);
                  }}
                  nameHtml={substring(fuzzyName(folder.name), 0, 200)}
                  badge={num0(folder.imageCount)}
                />
              ))}
            </div>
            <div className="menu-footer" style={{ position: 'initial' }}>
              <div className="left">
                <div className="shortcut-tip">{t('filter.select')}<key>{t('general.l-click')}</key></div>
                <div className="shortcut-tip">{t('filter.exclude')}<key>{t('general.r-click')}</key></div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <ClearBtn onClick={clearFolders} />
    </FilterItemShell>
  );
}

/* ============ tags（bundle:68364 + filter-item-tags.html） ============ */

function TagsItem({ snapshot }: { snapshot: FilterSnapshot }) {
  const rules = snapshot.rules;
  const includes = rules.tag?.includes || [];
  const excludes = rules.tag?.excludes || [];
  const noTag = !!rules.tag?.no;
  const enabled = (Array.isArray(includes) && includes.length > 0) || (Array.isArray(excludes) && excludes.length > 0) || noTag;
  const hideFilter = !enabled && !snapshot.pinned['tags'];
  const { displayName } = useMemo(() => {
    let dn = t('filter.tags');
    if (enabled) {
      dn = '';
      const arr: string[] = [];
      if (noTag) arr.push(t('Filter.NoTags'));
      includes.forEach((tagName: string) => arr.push(tagName));
      excludes.forEach((tagName: string) => arr.push(`-${tagName}`));
      if (arr.length > 0) dn += arr.join(',');
      else dn = t('filter.tags');
    }
    return { displayName: dn };
  }, [includes, excludes, noTag, enabled]);
  useDisplayNameSideEffect(displayName);
  const rootRef = useRef<HTMLDivElement>(null);
  useTippy(rootRef, snapshot);
  const [filterMode, setFilterMode] = useState<'ALL' | 'SELECTED' | 'GROUP'>('ALL');
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [searchDraft, setSearchDraft] = useState(snapshot.tagKeyword);
  useEffect(() => { setSearchDraft(snapshot.tagKeyword); }, [snapshot.tagKeyword]);

  const selectedCount = snapshot.containTags.filter((tg) => tg.isSelected || tg.isExcluded).length;

  const tagsGroupsSidebar = useMemo(() => {
    const map: Record<string, number> = {};
    try {
      const mappings = bodyScope()?.TagManager?.tagMappings;
      snapshot.containTags.forEach((tag) => {
        const origin = mappings && mappings[tag.name];
        if (origin && origin.groups && origin.groups.length > 0) {
          origin.groups.forEach((groupId: string) => {
            map[groupId] = (map[groupId] || 0) + 1;
          });
        }
      });
    } catch (err) {}
    return map;
  }, [snapshot.containTags]);

  const allTagsCount = snapshot.containTags.length;

  const tagsList = useMemo(() => {
    let result = snapshot.containTags;
    if (filterMode === 'SELECTED') {
      result = result.filter((tg) => tg.isSelected || tg.isExcluded);
    } else {
      if (snapshot.tagKeyword) {
        const fn = (window as any).fuzzy_match;
        if (fn) {
          result = result
            .map((tg) => ({ tg, score: fn(snapshot.tagKeyword, tg.name)?.score || (fn(snapshot.tagKeyword, tg.name) ? 1 : 0) }))
            .filter((x) => x.score > 0)
            .sort((a, b) => b.score - a.score)
            .map((x) => x.tg);
        }
      }
      if (selectedGroup) {
        const group = snapshot.tagGroups.find((g) => g.id === selectedGroup);
        if (group) {
          const set = new Set(group.tags);
          result = result.filter((tg) => set.has(tg.name));
        }
      }
      if (!snapshot.tagKeyword) {
        const groupIndexMap: Record<string, number> = {};
        snapshot.tagGroups.forEach((g, index) => { groupIndexMap[g.id] = index; });
        const liveGroups = bodyScope()?.TagManager?.groups || [];
        result = result.slice().sort((a, b) => {
          const liveA = liveGroups && undefined; // 排序仅依赖 tag 的 group id
          const aGroup = (a as any).groupId;
          const bGroup = (b as any).groupId;
          if (aGroup === bGroup) {
            if (a.name < b.name) return -1;
            if (a.name > b.name) return 1;
          }
          const aIdx = aGroup ? groupIndexMap[aGroup] : undefined;
          const bIdx = bGroup ? groupIndexMap[bGroup] : undefined;
          if (!aGroup && bGroup) return 1;
          if (aGroup && !bGroup) return -1;
          if (aIdx != null && bIdx != null && aIdx < bIdx) return -1;
          if (aIdx != null && bIdx != null && aIdx > bIdx) return 1;
          return 0;
        });
      }
    }
    return result;
  }, [snapshot.containTags, snapshot.tagKeyword, filterMode, selectedGroup, snapshot.tagGroups]);

  const onOpen = () => {};

  const clearTags = (e: React.MouseEvent) => {
    e && e.stopPropagation();
    const f = filter();
    f.filterRules.tag.includes.length = 0;
    f.filterRules.tag.excludes.length = 0;
    f.filterRules.tag.no = false;
    runSeq([(s) => { s.page = 1; s.reload(); }]);
  };

  const changeRule = (rule: string) => {
    runInBodyScope((s) => {
      s.eagle.filter.tagFilterLogic = rule;
      syncFilterFromScope();
      const sel = (s.containTags || []).filter((tg: any) => tg && (tg.isSelected || tg.isExcluded)).length;
      if (sel > 0) {
        s.page = 1;
        machineryFilterContent(s);
      }
    });
    focusInput(rootRef.current);
  };

  const fuzzyName = (name: string) => {
    const fn = (window as any).fuzzy_match;
    if (!fn || !snapshot.tagKeyword) return name;
    return fn(snapshot.tagKeyword, name) || name;
  };

  const findLiveTag = (name: string) => bodyScope()?.containTags?.find((tg: any) => tg && tg.name === name);

  return (
    <FilterItemShell
      id="tags-filter-item"
      active={enabled}
      hideFilter={hideFilter}
      onOpen={onOpen}
      onContextMenu={clearTags}
      onClear={clearTags}
    >
      <div
        className="name"
        title={displayName}
        tippy=""
        tippy-placement="bottom"
        tippy-content={shortcuts(shortcutsWrapper(snapshot.keybinds['find.filter.tag'] || ''))}
      >
        <img src={menuIcon(snapshot.theme, 'ic-filter-item-tag.svg')} />
        <div>{displayName}</div>
      </div>
      <div className="menu-wrap" close-filter-item="">
        <div className="filter-menu" style={{ maxWidth: 540, width: 540, height: 480 }} onMouseDown={(e) => e.stopPropagation()}>
          <div className="menu-header">
            <div className="search">
              <input
                id="filter-panel-tags-search"
                maxLength={1024}
                type="search"
                className="search shortcut-input focus"
                placeholder={t('filter.tags>search')}
                value={searchDraft}
                onChange={(e) => {
                  setSearchDraft(e.target.value);
                  clearTimeout((window as any).__tagsSearchTimer);
                  (window as any).__tagsSearchTimer = setTimeout(() => {
                    runInBodyScope((s) => { s.tagKeyword = e.target.value; });
                    syncFilterFromScope();
                  }, 100);
                }}
              />
            </div>
            {t('Filter.Tags.Rule')}
            <div className="tabs">
              {['OR', 'AND', 'EQUAL'].map((rule) => (
                <div
                  key={rule}
                  className={`tab${snapshot.tagFilterLogic === rule ? ' active' : ''}`}
                  tippy=""
                  tippy-placement="top"
                  tippy-content={t(rule === 'OR' ? 'Filter.Tags.Any' : rule === 'AND' ? 'Filter.Tags.All' : 'Filter.Tags.Equal')}
                  onClick={() => changeRule(rule)}
                >
                  <img src={`assets/images/${themePathOf(snapshot.theme)}/icons/filter/ic-logic-${rule.toLowerCase()}.svg`} />
                </div>
              ))}
            </div>
          </div>
          <div className="menu-sidebar" onClick={() => focusInput(rootRef.current)}>
            <div className="menu-sidebar-container">
              <div
                className={`menu-sidebar-item${filterMode === 'SELECTED' ? ' active' : ''}`}
                onClick={() => setFilterMode('SELECTED')}
              >
                <div className="name">{t('Filter.Tags.Sidebar.Selected')}</div>
                <div className="badge" style={selectedCount ? undefined : { display: 'none' }}>{num0(selectedCount)}</div>
              </div>
              <div
                className={`menu-sidebar-item${filterMode === 'ALL' ? ' active' : ''}`}
                onClick={() => { setFilterMode('ALL'); setSelectedGroup(null); }}
              >
                <div className="name">{t('Filter.Tags.Sidebar.All')}</div>
                <div className="badge" style={allTagsCount ? undefined : { display: 'none' }}>{num0(allTagsCount)}</div>
              </div>
              {snapshot.tagGroups.map((group) => (
                <div
                  key={group.id}
                  className={`menu-sidebar-item${selectedGroup === group.id && filterMode === 'GROUP' ? ' active' : ''}`}
                  style={tagsGroupsSidebar[group.id] ? undefined : { display: 'none' }}
                  onClick={() => { setFilterMode('GROUP'); setSelectedGroup(group.id); }}
                >
                  <div className="name">{group.name}</div>
                  <div className="badge">{num0(tagsGroupsSidebar[group.id] || 0)}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="menu-container" onClick={() => focusInput(rootRef.current)}>
            <div className="menu-content">
              <div className="tags-container" onMouseUp={() => focusInput(rootRef.current)} style={tagsList.length === 0 ? undefined : { display: 'none' }}>
                <div className="empty" style={filterMode !== 'SELECTED' ? undefined : { display: 'none' }}>{t('filter.tags>noTags')}</div>
              </div>
              <div
                id="filter-tags-container"
                className={`tags-container${filterMode === 'GROUP' ? ' has-footer' : ''}`}
                onMouseUp={() => focusInput(rootRef.current)}
              >
                {tagsList.map((tag) => (
                  <CheckItem
                    key={tag.name}
                    checked={!!tag.isSelected}
                    excluded={!!tag.isExcluded}
                    nameClassName={`color-${tag.groupColor || ''}`}
                    onClick={() => {
                      focusInput(rootRef.current);
                      const live = findLiveTag(tag.name);
                      runInBodyScope((s) => filterWithTag(live));
                      runSeq([(s) => { s.page = 1; machineryFilterContent(s); }]);
                    }}
                    onContextMenu={(e) => {
                      e.stopPropagation();
                      focusInput(rootRef.current);
                      const live = findLiveTag(tag.name);
                      runInBodyScope((s) => excludeWithTag(live));
                      runSeq([(s) => { s.page = 1; machineryFilterContent(s); }]);
                    }}
                    nameHtml={substring(fuzzyName(tag.name), 0, 200)}
                    badge={num0(tag.imageCount)}
                  />
                ))}
              </div>
              <div className="tags-container-footer" style={filterMode === 'GROUP' ? undefined : { display: 'none' }}>
                <CheckItem
                  checked={tagsList.length > 0 && tagsList.every((tg) => tg.isSelected)}
                  onClick={() => {
                    runInBodyScope((s) => {
                      const live = s.containTags || [];
                      const isAllSelected = live.every((tg: any) => tg.isSelected);
                      if (isAllSelected) {
                        live.forEach((tg: any) => {
                          delete tg.isSelected;
                          const idx = s.eagle.filter.filterRules.tag.includes.indexOf(tg.name);
                          if (idx > -1) s.eagle.filter.filterRules.tag.includes.splice(idx, 1);
                        });
                      } else {
                        live.forEach((tg: any) => {
                          tg.isSelected = true;
                          s.eagle.filter.filterRules.tag.includes.push(tg.name);
                        });
                      }
                      s.eagle.filter.filterRules.tag.includes = [...new Set(s.eagle.filter.filterRules.tag.includes)];
                      machineryFilterContent(s);
                      machineryCalculateFilterCounts(s);
                    });
                  }}
                  name={t('filter.tags>selectAll')}
                />
              </div>
            </div>
          </div>
          <div className="menu-footer">
            <div className="left">
              <div className="shortcut-tip">{t('filter.select')}<key>{t('general.l-click')}</key></div>
              <div className="shortcut-tip">{t('filter.exclude')}<key>{t('general.r-click')}</key></div>
            </div>
            <div className="right">
              <div className="shortcut-tip">{t('selectFolderPanel.shortcuts.close')}<key>︎ESC</key></div>
            </div>
          </div>
        </div>
      </div>
      <ClearBtn onClick={clearTags} />
    </FilterItemShell>
  );
}

KIND_COMPONENTS['color'] = ColorItem;
KIND_COMPONENTS['folders'] = FoldersItem;
KIND_COMPONENTS['tags'] = TagsItem;
