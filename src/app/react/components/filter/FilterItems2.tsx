import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useFilterState, FilterSnapshot } from '../../store/filterState';
import { t } from '../../global/eagleGlobals';
import { shortcuts, shortcutsWrapper } from '../../app/filters';
import { useTippy } from '../hooks';
import { FilterItemShell, CheckItem, useScopeEvent, focusInput } from './FilterItemShell';
import { KIND_COMPONENTS } from './FilterItems';
import { useToolbarState } from '../../store/toolbarState';
import { setFilterRule } from '../../services/filterService';
import { syncFilterFromScope } from '../../store/filterState';
import { getBodyScope, scopeApply } from '../../core/appCore';

/** 阶段3b（续）：types/shape/rating/fonts/camera/import/mtime/duration/bpm/size/resolution/annotation/note/url + 容器。 */

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
const runSeq = (fns: Array<(s: any) => void>) =>
  scopeApply(getBodyScope(), (s) => { fns.forEach((fn) => fn(s)); });

function useDisplayNameSideEffect(displayName: string) {
  useEffect(() => {
    const timer = setTimeout(() => {
      scopeApply(getBodyScope(), (s) => s.updateContainerHieght && s.updateContainerHieght());
    }, 300);
    return () => clearTimeout(timer);
  }, [displayName]);
}

function ClearBtn({ onClick }: { onClick: (e: React.MouseEvent) => void }) {
  return (
    <div className="clear-btn" onClick={onClick}>
      <img src="assets/images/dark/icons/ic-filter-clear-btn.png" />
    </div>
  );
}

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

/** 数值区间 displayName 推导（bundle:69237/69118/69181 逐字）。 */
function rangeDisplay(label: string, min: any, max: any, unitSuffix: string): { displayName: string; isEnabled: boolean } {
  let displayName = label;
  let isEnabled = false;
  if (min || max) {
    displayName = '';
    if (min > 0 && max > 0) displayName += `${min}≤${label}≤${max}`;
    else if (min > 0) displayName += `${label}≥${min}`;
    else if (max > 0) displayName += `${label}≤${max}`;
    if (min > 0 || max > 0) displayName += unitSuffix;
    if (displayName !== label) isEnabled = true;
  }
  return { displayName, isEnabled };
}

/* ============ types（bundle:68639） ============ */

function TypesItem({ snapshot }: { snapshot: FilterSnapshot }) {
  const rules = snapshot.rules;
  const includes = rules.type?.includes || {};
  const excludes = rules.type?.excludes || {};
  const [typesKeyword, setTypesKeyword] = useState('');
  const { displayName, isEnabled } = useMemo(() => {
    let dn = t('filter.types');
    let en = false;
    if (Object.keys(includes).length > 0 || Object.keys(excludes).length > 0) {
      dn = '';
      const arr: string[] = [];
      Object.keys(includes).forEach((key) => { if (includes[key]) arr.push(key); });
      Object.keys(excludes).forEach((key) => { if (excludes[key]) arr.push('-' + key); });
      if (arr.length > 0) { en = true; dn += arr.join(','); }
    }
    return { displayName: dn, isEnabled: en };
  }, [includes, excludes]);
  useDisplayNameSideEffect(displayName);
  const rootRef = useRef<HTMLDivElement>(null);
  useTippy(rootRef, snapshot);

  const typeResult = useMemo(() => {
    const list = snapshot.filterTypes || [];
    if (!typesKeyword) return list;
    const kw = typesKeyword.toLowerCase();
    return list.filter((ext) => String(ext).toLowerCase().includes(kw));
  }, [snapshot.filterTypes, typesKeyword]);

  const clearTypes = (e: React.MouseEvent) => {
    e && e.stopPropagation();
    const f = filter();
    f.filterRules.type.includes = {};
    f.filterRules.type.excludes = {};
    runSeq([(s) => { s.page = 1; s.reload(); }]);
  };

  return (
    <FilterItemShell id="types-filter-item" active={isEnabled} hideFilter={!isEnabled && !snapshot.pinned['types']}>
      <div
        className="name"
        title={displayName}
        tippy=""
        tippy-placement="bottom"
        tippy-content={shortcuts(shortcutsWrapper(snapshot.keybinds['find.filter.type'] || ''))}
      >
        <img src={menuIcon(snapshot.theme, 'ic-filter-item-ext.svg')} />
        <div>{displayName}</div>
      </div>
      <div className="menu-wrap">
        <div className="filter-menu" style={{ width: 240, maxWidth: 240, minHeight: 40 }} onMouseDown={(e) => e.stopPropagation()}>
          <input
            id="filter-panel-types-search"
            maxLength={1024}
            type="search"
            style={snapshot.filteredsCount === 0 ? { display: 'none' } : undefined}
            className="search shortcut-input focus"
            placeholder={t('filter.folders>search')}
            value={typesKeyword}
            onChange={(e) => setTypesKeyword(e.target.value)}
          />
          <div className="menu-content" style={{ overflow: 'auto', maxHeight: 480 }}>
            <div className="empty" style={typeResult.length === 0 || snapshot.filteredsCount === 0 ? undefined : { display: 'none' }}>{t('filter.emptyMsg')}</div>
            {typeResult.map((typeItem) => (
              (snapshot.counts?.type?.[typeItem] > 0 || excludes[typeItem]) ? (
                <CheckItem
                  key={typeItem}
                  checked={!!includes[typeItem]}
                  excluded={!!excludes[typeItem]}
                  onClick={() => {
                    focusInput(rootRef.current);
                    scopeApply(bodyScope(), (s) => s.toggleExtFilter && s.toggleExtFilter(typeItem));
                    runSeq([(s) => { s.page = 1; s.filterContent && s.filterContent(); }]);
                    setTypesKeyword('');
                  }}
                  onContextMenu={(e) => {
                    focusInput(rootRef.current);
                    scopeApply(bodyScope(), (s) => s.toggleExtFilterExclude && s.toggleExtFilterExclude(typeItem));
                    runSeq([(s) => { s.page = 1; s.filterContent && s.filterContent(); }]);
                    setTypesKeyword('');
                  }}
                  name={typeItem}
                  badge={num0(snapshot.counts?.type?.[typeItem])}
                />
              ) : null
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
      <ClearBtn onClick={clearTypes} />
    </FilterItemShell>
  );
}

/* ============ shape（bundle:68704） ============ */

const SHAPE_ITEMS: Array<{ countKey: string; ruleKey: string; labelKey?: string; literal?: string }> = [
  { countKey: 'landscape', ruleKey: 'landscape', labelKey: 'filter.orientation>landscape' },
  { countKey: 'portrait', ruleKey: 'portrait', labelKey: 'filter.orientation>portrait' },
  { countKey: 'square', ruleKey: 'square', labelKey: 'filter.orientation>square' },
  { countKey: 'panoramic-landscape', ruleKey: 'panoramicLandscape', labelKey: 'filter.orientation>panoramicLandscape' },
  { countKey: 'panoramic-portrait', ruleKey: 'panoramicPortrait', labelKey: 'filter.orientation>panoramicPortrait' },
  { countKey: '4:3', ruleKey: '43', literal: '4:3' },
  { countKey: '3:4', ruleKey: '34', literal: '3:4' },
  { countKey: '16:9', ruleKey: '169', literal: '16:9' },
  { countKey: '9:16', ruleKey: '916', literal: '9:16' },
];

function ShapeItem({ snapshot }: { snapshot: FilterSnapshot }) {
  const shape = snapshot.rules.shape || {};
  const { displayName, isEnabled } = useMemo(() => {
    let dn = t('filter.orientation');
    let en = false;
    const anyOn = SHAPE_ITEMS.some((s) => shape[s.ruleKey]) || shape.custom;
    if (anyOn) {
      dn = '';
      const arr: string[] = [];
      SHAPE_ITEMS.forEach((s) => { if (shape[s.ruleKey]) arr.push(s.literal || t(s.labelKey!)); });
      if (shape.custom && shape.width && shape.height) arr.push(`${shape.width}:${shape.height}`);
      if (arr.length > 0) { en = true; dn += arr.join(','); }
    }
    return { displayName: dn, isEnabled: en };
  }, [shape]);
  useDisplayNameSideEffect(displayName);
  const rootRef = useRef<HTMLDivElement>(null);
  useTippy(rootRef, snapshot);

  const toggle = (ruleKey: string) => {
    shape[ruleKey] = !shape[ruleKey];
    runSeq([(s) => { s.page = 1; s.filterContent && s.filterContent(); }]);
  };

  const clearShape = (e: React.MouseEvent) => {
    e && e.stopPropagation();
    const f = filter();
    const s = f.filterRules.shape;
    s.landscape = s.portrait = s.square = s.panoramicLandscape = s.panoramicPortrait = s.custom = s['43'] = s['34'] = s['169'] = s['916'] = false;
    runSeq([(s2) => { s2.page = 1; s2.reload(); }]);
  };

  return (
    <FilterItemShell id="shape-filter-item" active={isEnabled} hideFilter={!isEnabled && !snapshot.pinned['shape']} onContextMenu={clearShape} onClear={clearShape}>
      <div
          className="name"
        tippy=""
        tippy-placement="bottom"
        tippy-content={shortcuts(shortcutsWrapper(snapshot.keybinds['find.filter.shape'] || ''))}
      >
        <img src={menuIcon(snapshot.theme, 'ic-filter-item-shape.svg')} />
        <div>{displayName}</div>
      </div>
      <input tabIndex={-1} type="text" className="shortcut-input" />
      <div className="menu-wrap">
        <div className="filter-menu" style={{ minHeight: 40 }} onMouseDown={(e) => e.stopPropagation()}>
          <div className="menu-content">
            <div />
            {SHAPE_ITEMS.map((item) => (
              snapshot.filteredsCount > 0 && snapshot.counts?.shape?.[item.countKey] > 0 ? (
                <CheckItem
                  key={item.ruleKey}
                  checked={!!shape[item.ruleKey]}
                  onClick={() => { focusInput(rootRef.current); toggle(item.ruleKey); }}
                  name={item.literal || t(item.labelKey!)}
                  badge={num0(snapshot.counts?.shape?.[item.countKey])}
                />
              ) : null
            ))}
            <CheckItem
              checked={!!shape.custom}
              onClick={() => {
                setTimeout(() => {
                  if (filter().filterRules.shape.custom) {
                    (document.getElementById('custom-shape-filter-w') as HTMLElement)?.focus();
                  } else {
                    focusInput(rootRef.current);
                  }
                }, 200);
                toggle('custom');
              }}
              name={t('filter.orientation>custom')}
            />
            {shape.custom ? (
              <div className="custom-shapre-item row">
                <DebouncedInput
                  id="custom-shape-filter-w"
                  className="col-xs-4"
                  maxlength={256}
                  placeholder="W"
                  value={shape.width}
                  onCommit={(v) => { setFilterRule('shape', 'width', v === '' ? undefined : Number(v)); }}
                />
                :
                <DebouncedInput
                  className="col-xs-4"
                  maxlength={256}
                  placeholder="H"
                  value={shape.height}
                  onCommit={(v) => { setFilterRule('shape', 'height', v === '' ? undefined : Number(v)); }}
                />
              </div>
            ) : null}
          </div>
        </div>
      </div>
      <ClearBtn onClick={clearShape} />
    </FilterItemShell>
  );
}

/* ============ rating（bundle:68766） ============ */

const RATING_ITEMS = ['5', '4', '3', '2', '1', '0'] as const;

function RatingItem({ snapshot }: { snapshot: FilterSnapshot }) {
  const rating = snapshot.rules.rating || {};
  const { displayName, isEnabled } = useMemo(() => {
    let dn = t('filter.rating');
    let en = false;
    if (RATING_ITEMS.some((k) => rating[k])) {
      dn = '';
      const arr: string[] = [];
      RATING_ITEMS.forEach((k) => {
        if (rating[k]) arr.push(k === '0' ? t('filter.rating>none') : String(Number(k)));
      });
      if (arr.length > 0) { en = true; dn += arr.join(','); }
    }
    return { displayName: dn, isEnabled: en };
  }, [rating]);
  useDisplayNameSideEffect(displayName);
  const rootRef = useRef<HTMLDivElement>(null);
  useTippy(rootRef, snapshot);

  const clearRating = (e: React.MouseEvent) => {
    e && e.stopPropagation();
    const r = filter().filterRules.rating;
    RATING_ITEMS.forEach((k) => { r[k] = false; });
    runSeq([(s) => { s.page = 1; s.reload(); }]);
  };

  const stars = (filled: number) => (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <s key={i} className={i < filled ? undefined : 'empty'} />
      ))}
    </>
  );

  const nameFor = (k: string) => {
    if (k === '0') return t('filter.rating>none');
    const n = Number(k);
    return stars(n);
  };

  return (
    <FilterItemShell id="rating-filter-item" active={isEnabled} hideFilter={!isEnabled && !snapshot.pinned['rating']} onContextMenu={clearRating} onClear={clearRating}>
      <div
          className="name"
        tippy=""
        tippy-placement="bottom"
        tippy-content={shortcuts(shortcutsWrapper(snapshot.keybinds['find.filter.rating'] || ''))}
      >
        <img src={menuIcon(snapshot.theme, 'ic-filter-item-rating.svg')} />
        <div>{displayName}</div>
      </div>
      <input tabIndex={-1} type="text" className="shortcut-input" />
      <div className="menu-wrap">
        <div className="filter-menu" style={{ minWidth: 180 }} onMouseDown={(e) => e.stopPropagation()}>
          <div className="menu-content">
            <div className="empty" style={snapshot.filteredsCount === 0 ? undefined : { display: 'none' }}>{t('filter.emptyMsg')}</div>
            {RATING_ITEMS.map((k) => (
              snapshot.filteredsCount > 0 && snapshot.counts?.rating?.[k] > 0 ? (
                <CheckItem
                  key={k}
                  checked={!!rating[k]}
                  onClick={() => {
                    focusInput(rootRef.current);
                    filter().filterRules.rating[k] = !filter().filterRules.rating[k];
                    runSeq([(s) => { s.page = 1; s.filterContent && s.filterContent(); }]);
                  }}
                  name={nameFor(k)}
                  badge={num0(snapshot.counts?.rating?.[k])}
                />
              ) : null
            ))}
          </div>
        </div>
      </div>
      <ClearBtn onClick={clearRating} />
    </FilterItemShell>
  );
}

/* ============ fonts（bundle:68812） ============ */

function FontsItem({ snapshot }: { snapshot: FilterSnapshot }) {
  const font = snapshot.rules.font || {};
  const { displayName, isEnabled } = useMemo(() => {
    let dn = t('filter.fontActivated');
    let en = false;
    if (font.activated || font.deactivated) {
      en = true;
      if (font.activated) dn = t('filter.fontActivated>activated');
      else if (font.deactivated) dn = t('filter.fontActivated>deactivated');
    }
    return { displayName: dn, isEnabled: en };
  }, [font]);
  useDisplayNameSideEffect(displayName);
  const rootRef = useRef<HTMLDivElement>(null);
  useTippy(rootRef, snapshot);

  const clearFonts = (e: React.MouseEvent) => {
    e && e.stopPropagation();
    const f = filter().filterRules.font;
    f.activated = false;
    f.deactivated = false;
    runSeq([(s) => { s.page = 1; s.reload(); }]);
  };

  const counts = snapshot.counts?.fontActivated || {};

  return (
    <FilterItemShell id="fontActivated-filter-item" active={isEnabled} hideFilter={!isEnabled && !snapshot.pinned['fontActivated']} onContextMenu={clearFonts} onClear={clearFonts}>
      <div
          className="name"
        title={displayName}
        tippy=""
        tippy-placement="bottom"
        tippy-content={shortcuts(shortcutsWrapper(snapshot.keybinds['find.filter.fonts'] || ''))}
      >
        <img src={menuIcon(snapshot.theme, 'ic-filter-item-font.svg')} />
        <div>{displayName}</div>
      </div>
      <input tabIndex={-1} type="text" className="shortcut-input" />
      <div className="menu-wrap">
        <div className="filter-menu" style={{ minHeight: 40, minWidth: 200 }} onMouseDown={(e) => e.stopPropagation()}>
          <div className="menu-content">
            <div className="empty" style={counts.activated === 0 && counts.deactivated === 0 ? undefined : { display: 'none' }}>{t('filter.emptyMsg')}</div>
            {counts.activated > 0 ? (
              <CheckItem
                checked={!!font.activated}
                onClick={() => {
                  focusInput(rootRef.current);
                  const f = filter().filterRules.font;
                  f.activated = !f.activated;
                  f.deactivated = false;
                  runSeq([(s) => { s.page = 1; s.filterContent && s.filterContent(); }]);
                }}
                name={t('filter.fontActivated>activated')}
                badge={num0(counts.activated)}
              />
            ) : null}
            {counts.deactivated > 0 ? (
              <CheckItem
                checked={!!font.deactivated}
                onClick={() => {
                  focusInput(rootRef.current);
                  const f = filter().filterRules.font;
                  f.deactivated = !f.deactivated;
                  f.activated = false;
                  runSeq([(s) => { s.page = 1; s.filterContent && s.filterContent(); }]);
                }}
                name={t('filter.fontActivated>deactivated')}
                badge={num0(counts.deactivated)}
              />
            ) : null}
          </div>
        </div>
      </div>
      <ClearBtn onClick={clearFonts} />
    </FilterItemShell>
  );
}

/* ============ camera（bundle:68853） ============ */

function CameraItem({ snapshot }: { snapshot: FilterSnapshot }) {
  const cameraRules = snapshot.rules.camera || {};
  const { displayName, isEnabled } = useMemo(() => {
    let dn = t('filter.camera');
    let en = false;
    if (Object.keys(cameraRules).length > 0) {
      dn = '';
      const arr = Object.keys(cameraRules);
      if (arr.length > 0) { en = true; dn += arr.join(','); }
      else { en = false; dn = t('filter.camera'); }
    }
    return { displayName: dn, isEnabled: en };
  }, [cameraRules]);
  useDisplayNameSideEffect(displayName);
  const rootRef = useRef<HTMLDivElement>(null);
  useTippy(rootRef, snapshot);

  const clearCamera = (e: React.MouseEvent) => {
    e && e.stopPropagation();
    filter().filterRules.camera = {};
    runSeq([(s) => { s.page = 1; s.reload(); }]);
  };

  return (
    <FilterItemShell id="camera-filter-item" active={isEnabled} hideFilter={!isEnabled && !snapshot.pinned['camera']} onContextMenu={clearCamera} onClear={clearCamera}>
      <div
          className="name"
        title={displayName}
        tippy=""
        tippy-placement="bottom"
        tippy-content={shortcuts(shortcutsWrapper(snapshot.keybinds['find.filter.camera'] || ''))}
      >
        <img src={menuIcon(snapshot.theme, 'ic-filter-item-camera.svg')} />
        <div>{displayName}</div>
      </div>
      <input tabIndex={-1} type="text" className="shortcut-input" />
      <div className="menu-wrap">
        <div className="filter-menu" style={{ minHeight: 40, minWidth: 200 }} onMouseDown={(e) => e.stopPropagation()}>
          <div className="menu-content">
            <div className="empty" style={snapshot.filterCameras.length === 0 || snapshot.filteredsCount === 0 ? undefined : { display: 'none' }}>{t('filter.emptyMsg')}</div>
            {snapshot.filterCameras.map((camera) => (
              snapshot.filteredsCount > 0 && snapshot.counts?.camera?.[camera] > 0 ? (
                <CheckItem
                  key={camera}
                  checked={!!cameraRules[camera]}
                  onClick={() => {
                    focusInput(rootRef.current);
                    const rules = filter().filterRules.camera;
                    if (rules[camera]) delete rules[camera];
                    else rules[camera] = true;
                    runSeq([(s) => { s.page = 1; s.filterContent && s.filterContent(); }]);
                  }}
                  name={camera}
                  badge={num0(snapshot.counts?.camera?.[camera])}
                />
              ) : null
            ))}
          </div>
        </div>
      </div>
      <ClearBtn onClick={clearCamera} />
    </FilterItemShell>
  );
}

/* ============ import / mtime（bundle:68913 / 69010） ============ */

function DateFilterItem({ snapshot, kind }: { snapshot: FilterSnapshot; kind: 'import' | 'mtime' }) {
  const rule = snapshot.rules[kind] || {};
  const isImport = kind === 'import';
  const baseLabel = isImport ? t('modal.smartFolder.rule.propertyCreateTime') : t('modal.smartFolder.rule.propertyMTime');
  const { displayName, isEnabled } = useMemo(() => {
    let dn = baseLabel;
    let en = false;
    const anyOn = rule.today || rule.yesterday || rule.last7day || rule.last30day || rule.last90day || rule.last365day || rule.usingRange || (rule.selectedMonths && Object.keys(rule.selectedMonths).length > 0);
    if (anyOn) {
      dn = '';
      const arr: string[] = [];
      if (rule.today) arr.push(t('filter.import>today'));
      if (rule.yesterday) arr.push(t('filter.import>yesterday'));
      if (rule.last7day) arr.push(t('filter.import>last7Days'));
      if (rule.last30day) arr.push(t('filter.import>last30Days'));
      if (rule.last90day) arr.push(t('filter.import>last90Days'));
      if (rule.last365day) arr.push(t('filter.import>last365Days'));
      if (rule.usingRange) arr.push(t('filter.import>range'));
      arr.push(...Object.keys(rule.selectedMonths || {}));
      if (arr.length > 0) { en = true; dn += arr.join(','); }
    }
    return { displayName: dn, isEnabled: en };
  }, [rule, baseLabel]);
  useDisplayNameSideEffect(displayName);
  const rootRef = useRef<HTMLDivElement>(null);
  useTippy(rootRef, snapshot);

  const id = `${kind}-filter-item`;
  const keybind = isImport ? snapshot.keybinds['find.filter.date'] : snapshot.keybinds['find.filter.import'];
  const icon = isImport ? 'ic-filter-item-duration.svg' : 'ic-filter-item-modify.svg';

  const onOpen = () => {
    scopeApply(bodyScope(), (s) => {
      s.calculateDateFilter && s.calculateDateFilter();
      s.filterImportDateMonths = s.getDateFilterCountsArray && s.getDateFilterCountsArray('date');
      syncFilterFromScope();
      s.filterModifyDateMonths = s.getDateFilterCountsArray && s.getDateFilterCountsArray('mtime');
      s.$evalAsync();
    });
  };

  const clearDate = (e: React.MouseEvent) => {
    e && e.stopPropagation();
    const f = filter();
    const r = f.filterRules[kind];
    r.selectedMonths = {};
    r.today = r.yesterday = r.last7day = r.last30day = r.last90day = r.last365day = r.usingRange = false;
    runSeq([(s) => {
      s.page = 1;
      if (isImport && s.filterContent) s.filterContent();
      s.reload && s.reload();
      if (isImport) { s.filterImportDateMonths = []; s.filterModifyDateMonths = []; }
      syncFilterFromScope();
    }]);
  };

  const toggleMonth = (key: string) => {
    const r = filter().filterRules[kind];
    if (!r.selectedMonths[key]) r.selectedMonths[key] = true;
    else delete r.selectedMonths[key];
  };

  const DATE_ROWS: Array<[string, string, string]> = [
    ['today', 'filter.import>today', 'today'],
    ['yesterday', 'filter.import>yesterday', 'yesterday'],
    ['last7day', 'filter.import>last7Days', '7day'],
    ['last30day', 'filter.import>last30Days', '30day'],
    ['last90day', 'filter.import>last90Days', '90day'],
    ['last365day', 'filter.import>last365Days', '365day'],
  ];

  return (
    <FilterItemShell id={id} active={isEnabled} hideFilter={!isEnabled && !snapshot.pinned[kind]} onOpen={onOpen} onContextMenu={clearDate} onClear={clearDate}>
      <div
          className="name"
        tippy=""
        tippy-placement="bottom"
        tippy-content={shortcuts(shortcutsWrapper(keybind || ''))}
      >
        <img src={menuIcon(snapshot.theme, icon)} />
        <div>{displayName}</div>
      </div>
      <input tabIndex={-1} type="text" className="shortcut-input" />
      <div className="menu-wrap">
        <div className="filter-menu" style={isImport ? { minWidth: 220 } : undefined} onMouseDown={(e) => e.stopPropagation()}>
          <div className="menu-content">
            <div />
            {DATE_ROWS.map(([ruleKey, labelKey, countKey]) => (
              <CheckItem
                key={ruleKey}
                checked={!!rule[ruleKey]}
                onClick={() => {
                  focusInput(rootRef.current);
                  filter().filterRules[kind][ruleKey] = !filter().filterRules[kind][ruleKey];
                  runSeq([(s) => { s.page = 1; s.filterContent && s.filterContent(); }]);
                }}
                name={t(labelKey)}
                badge={num0(snapshot.counts?.[kind]?.[countKey])}
              />
            ))}
            {snapshot.filterImportDateMonths.map((obj) => (
              <CheckItem
                key={obj.key}
                checked={!!rule.selectedMonths?.[obj.key]}
                onClick={() => {
                  focusInput(rootRef.current);
                  toggleMonth(obj.key);
                  runSeq([(s) => { s.page = 1; s.filterContent && s.filterContent(); }]);
                }}
                name={obj.key}
                badge={num0(obj.value)}
              />
            ))}
            <CheckItem
              checked={!!rule.usingRange}
              onClick={() => {
                filter().filterRules[kind].usingRange = !filter().filterRules[kind].usingRange;
                setTimeout(() => (document.getElementById('filter-date-picker') as HTMLElement | null)?.focus?.(), 100);
                runSeq([(s) => { s.page = 1; s.filterContent && s.filterContent(); }]);
              }}
              name={t('filter.import>range')}
            />
            {rule.usingRange ? (
              <input
                id="filter-date-picker"
                data-enabletime="true"
                placeholder={t('filter.import>rangePlaceholder')}
                onBlur={(e) => {
                  const v = e.target.value;
                  scopeApply(bodyScope(), (s) => { s.eagle.filter.filterRules[kind].model = v; });
                  runSeq([(s) => { s.page = 1; s.filterContent && s.filterContent(); }]);
                }}
              />
            ) : null}
          </div>
        </div>
      </div>
      <ClearBtn onClick={clearDate} />
    </FilterItemShell>
  );
}

/* ============ duration / bpm / size / resolution（数值族） ============ */

function DurationItem({ snapshot }: { snapshot: FilterSnapshot }) {
  const rule = snapshot.rules.duration || {};
  const { displayName, isEnabled } = rangeDisplay(t('filter.duration'), rule.min, rule.max, rule.unit || '');
  useDisplayNameSideEffect(displayName);
  const rootRef = useRef<HTMLDivElement>(null);
  useTippy(rootRef, snapshot);
  const clear = (e: React.MouseEvent) => {
    e && e.stopPropagation();
    setFilterRule('duration', 'min', undefined);
    setFilterRule('duration', 'max', undefined);
    runSeq([(s) => { s.page = 1; s.reload(); }]);
  };
  return (
    <FilterItemShell id="duration-filter-item" active={isEnabled} hideFilter={!isEnabled && !snapshot.pinned['duration']} onContextMenu={clear} onClear={clear}>
      <div
          className="name" tippy="" tippy-placement="bottom" tippy-content={shortcuts(shortcutsWrapper(snapshot.keybinds['find.filter.duration'] || ''))}>
        <img src={menuIcon(snapshot.theme, 'ic-filter-item-duration.svg')} />
        <div>{displayName}</div>
      </div>
      <div className="menu-wrap" close-filter-item="">
        <div className="filter-menu file-size">
          <div className="menu-content">
            <div className="file-size-filter">
              <div className="item">
                <div className="range">
                  <DebouncedInput placeholder={t('filter.duration>Min')} value={rule.min} onCommit={(v) => { setFilterRule('duration', 'min', v === '' ? undefined : Number(v)); }} />
                  <span>-</span>
                  <DebouncedInput placeholder={t('filter.duration>Max')} value={rule.max} onCommit={(v) => { setFilterRule('duration', 'max', v === '' ? undefined : Number(v)); }} />
                  <div className="select select-xs">
                    <select
                      tabIndex={-1}
                      value={rule.unit || 's'}
                      onChange={(e) => {
                        filter().filterRules.duration.unit = e.target.value;
                        runSeq([(s) => { s.page = 1; s.filterContent && s.filterContent(); }]);
                      }}
                    >
                      <option value="s">{t('modal.smartFolder.ruleValue.s')}</option>
                      <option value="m">{t('modal.smartFolder.ruleValue.m')}</option>
                      <option value="h">{t('modal.smartFolder.ruleValue.h')}</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <ClearBtn onClick={clear} />
    </FilterItemShell>
  );
}

function BpmItem({ snapshot }: { snapshot: FilterSnapshot }) {
  const rule = snapshot.rules.bpm || {};
  const { displayName, isEnabled } = rangeDisplay('BPM', rule.min, rule.max, '');
  useDisplayNameSideEffect(displayName);
  const rootRef = useRef<HTMLDivElement>(null);
  useTippy(rootRef, snapshot);
  const clear = (e: React.MouseEvent) => {
    e && e.stopPropagation();
    setFilterRule('bpm', 'min', undefined);
    setFilterRule('bpm', 'max', undefined);
    runSeq([(s) => { s.page = 1; s.reload(); }]);
  };
  return (
    <FilterItemShell id="bpm-filter-item" active={isEnabled} hideFilter={!isEnabled && !snapshot.pinned['bpm']} onContextMenu={clear} onClear={clear}>
      <div
          className="name" tippy="" tippy-placement="bottom" tippy-content={shortcuts(shortcutsWrapper(snapshot.keybinds['find.filter.bpm'] || ''))}>
        <img src={menuIcon(snapshot.theme, 'ic-filter-item-bpm.svg')} />
        <div>{displayName}</div>
      </div>
      <div className="menu-wrap" close-filter-item="">
        <div className="filter-menu" style={{ width: 160 }} onMouseDown={(e) => e.stopPropagation()}>
          <div className="menu-content">
            <div className="file-size-filter">
              <div className="item">
                <div className="range">
                  <DebouncedInput placeholder={t('filter.duration>Min')} value={rule.min} onCommit={(v) => { setFilterRule('bpm', 'min', v === '' ? undefined : Number(v)); }} />
                  <span>-</span>
                  <DebouncedInput placeholder={t('filter.duration>Max')} value={rule.max} onCommit={(v) => { setFilterRule('bpm', 'max', v === '' ? undefined : Number(v)); }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <ClearBtn onClick={clear} />
    </FilterItemShell>
  );
}

function SizeItem({ snapshot }: { snapshot: FilterSnapshot }) {
  const rule = snapshot.rules.file || {};
  const { displayName, isEnabled } = rangeDisplay(t('filter.fileSize'), rule.min, rule.max, String(rule.unit || 'kb').toUpperCase());
  useDisplayNameSideEffect(displayName);
  const rootRef = useRef<HTMLDivElement>(null);
  useTippy(rootRef, snapshot);
  const clear = (e: React.MouseEvent) => {
    e && e.stopPropagation();
    setFilterRule('file', 'min', undefined);
    setFilterRule('file', 'max', undefined);
    runSeq([(s) => { s.page = 1; s.reload(); }]);
  };
  return (
    <FilterItemShell id="size-filter-item" active={isEnabled} hideFilter={!isEnabled && !snapshot.pinned['size']} onContextMenu={clear} onClear={clear}>
      <div
          className="name" tippy="" tippy-placement="bottom" tippy-content={shortcuts(shortcutsWrapper(snapshot.keybinds['find.filter.size'] || ''))}>
        <img src={menuIcon(snapshot.theme, 'ic-filter-item-size.svg')} />
        <div>{displayName}</div>
      </div>
      <div className="menu-wrap" close-filter-item="">
        <div className="filter-menu file-size">
          <div className="menu-content">
            <div className="file-size-filter">
              <div className="item">
                <div className="range">
                  <DebouncedInput placeholder={t('filter.fileSize>Min')} value={rule.min} onCommit={(v) => { setFilterRule('file', 'min', v === '' ? undefined : Number(v)); }} />
                  <span>-</span>
                  <DebouncedInput placeholder={t('filter.fileSize>Max')} value={rule.max} onCommit={(v) => { setFilterRule('file', 'max', v === '' ? undefined : Number(v)); }} />
                  <div className="select select-xs">
                    <select
                      tabIndex={-1}
                      value={rule.unit || 'kb'}
                      onChange={(e) => {
                        filter().filterRules.file.unit = e.target.value;
                        runSeq([(s) => { s.page = 1; s.filterContent && s.filterContent(); }]);
                      }}
                    >
                      <option value="kb">KB</option>
                      <option value="mb">MB</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <ClearBtn onClick={clear} />
    </FilterItemShell>
  );
}

function ResolutionItem({ snapshot }: { snapshot: FilterSnapshot }) {
  const rule = snapshot.rules.resolution || {};
  const { displayName, isEnabled } = useMemo(() => {
    let dn = t('filter.resolution');
    let en = false;
    if (rule.minW || rule.maxW || rule.minH || rule.maxH) {
      dn = '';
      const wLabel = t('filter.resolution>width');
      const hLabel = t('filter.resolution>height');
      if (rule.minW > 0 && rule.maxW > 0) dn += `${rule.minW}≤${wLabel}≤${rule.maxW}`;
      else if (rule.minW > 0) dn += `${wLabel}≥${rule.minW}`;
      else if (rule.maxW > 0) dn += `${wLabel}≤${rule.maxW}`;
      if ((rule.minW > 0 || rule.maxW > 0) && (rule.minH > 0 || rule.maxH > 0)) dn += '，';
      if (rule.minH > 0 && rule.maxH > 0) dn += `${rule.minH}≤${hLabel}≤${rule.maxH}`;
      else if (rule.minH > 0) dn += `${hLabel}≥${rule.minH}`;
      else if (rule.maxH > 0) dn += `${hLabel}≤${rule.maxH}`;
      if (dn !== t('filter.resolution')) en = true;
    }
    return { displayName: dn, isEnabled: en };
  }, [rule]);
  useDisplayNameSideEffect(displayName);
  const rootRef = useRef<HTMLDivElement>(null);
  useTippy(rootRef, snapshot);
  const clear = (e: React.MouseEvent) => {
    e && e.stopPropagation();
    setFilterRule('resolution', 'minW', undefined);
    setFilterRule('resolution', 'maxW', undefined);
    setFilterRule('resolution', 'minH', undefined);
    setFilterRule('resolution', 'maxH', undefined);
    runSeq([(s) => { s.page = 1; s.reload(); }]);
  };
  return (
    <FilterItemShell id="resolution-filter-item" active={isEnabled} hideFilter={!isEnabled && !snapshot.pinned['resolution']} onContextMenu={clear} onClear={clear}>
      <div
          className="name" tippy="" tippy-placement="bottom" tippy-content={shortcuts(shortcutsWrapper(snapshot.keybinds['find.filter.resolution'] || ''))}>
        <img src={menuIcon(snapshot.theme, 'ic-filter-item-resolution.svg')} />
        <div>{displayName}</div>
      </div>
      <div className="menu-wrap" close-filter-item="">
        <div className="filter-menu" style={{ minWidth: 200 }} onMouseDown={(e) => e.stopPropagation()}>
          <div className="menu-content">
            <div className="image-size-filter">
              <div className="item">
                <div className="label">{t('filter.resolution>width')}</div>
                <div className="range">
                  <DebouncedInput placeholder={t('filter.resolution>min')} value={rule.minW} onCommit={(v) => { setFilterRule('resolution', 'minW', v === '' ? undefined : Number(v)); }} />
                  -
                  <DebouncedInput placeholder={t('filter.resolution>max')} value={rule.maxW} onCommit={(v) => { setFilterRule('resolution', 'maxW', v === '' ? undefined : Number(v)); }} />
                </div>
              </div>
              <div className="item">
                <div className="label">{t('filter.resolution>height')}</div>
                <div className="range">
                  <DebouncedInput placeholder={t('filter.resolution>min')} value={rule.minH} onCommit={(v) => { setFilterRule('resolution', 'minH', v === '' ? undefined : Number(v)); }} />
                  -
                  <DebouncedInput placeholder={t('filter.resolution>max')} value={rule.maxH} onCommit={(v) => { setFilterRule('resolution', 'maxH', v === '' ? undefined : Number(v)); }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <ClearBtn onClick={clear} />
    </FilterItemShell>
  );
}

/* ============ annotation / note / url（关键词族） ============ */

function KeywordFilterItem({ snapshot, kind }: { snapshot: FilterSnapshot; kind: 'annotation' | 'note' | 'url' }) {
  const rule = snapshot.rules[kind] || {};
  const meta = {
    annotation: { base: 'filter.comments', has: 'filter.comments>has', no: 'filter.comments>hasNot', ph: 'filter.comments>placeholder', icon: 'ic-filter-item-comment.svg', id: 'annotation-filter-item', kb: 'find.filter.annotation' },
    note: { base: 'filter.annotation', has: 'filter.annotation>has', no: 'filter.annotation>hasNot', ph: 'filter.annotation>placeholder', icon: 'ic-filter-item-note.svg', id: 'note-filter-item', kb: 'find.filter.note' },
    url: { base: 'filter.url', has: 'filter.url>has', no: 'filter.url>hasNot', ph: 'filter.url>placeholder', icon: 'ic-filter-item-url.svg', id: 'url-filter-item', kb: 'find.filter.url' },
  }[kind];
  const { displayName, isEnabled } = useMemo(() => {
    let dn = t(meta.base);
    let en = false;
    if (rule.has || rule.no) {
      dn = '';
      const arr: string[] = [];
      if (rule.has) arr.push(t('Filter.Yes'));
      if (rule.no) arr.push(t('Filter.No'));
      if (rule.keywords) { en = true; dn += rule.keywords; }
      else if (arr.length > 0) { en = true; dn += arr.join(','); }
    }
    return { displayName: dn, isEnabled: en };
  }, [rule]);
  useDisplayNameSideEffect(displayName);
  const rootRef = useRef<HTMLDivElement>(null);
  useTippy(rootRef, snapshot);
  const [kwDraft, setKwDraft] = useState(rule.keywords || '');
  useEffect(() => { setKwDraft(rule.keywords || ''); }, [rule.keywords]);

  const clearKw = (e: React.MouseEvent) => {
    e && e.stopPropagation();
    const r = filter().filterRules[kind];
    r.has = r.no = false;
    r.keywords = undefined;
    runSeq([(s) => { s.page = 1; s.reload(); }]);
  };

  return (
    <FilterItemShell id={meta.id} active={isEnabled} hideFilter={!isEnabled && !snapshot.pinned[kind]} onContextMenu={clearKw} onClear={clearKw}>
      <div
          className="name" tippy="" tippy-placement="bottom" tippy-content={shortcuts(shortcutsWrapper(snapshot.keybinds[meta.kb] || ''))}>
        <img src={menuIcon(snapshot.theme, meta.icon)} />
        <div>{displayName}</div>
      </div>
      <input tabIndex={-1} type="text" className="shortcut-input" maxLength={kind === 'url' ? 2048 : undefined} />
      <div className="menu-wrap">
        <div className="filter-menu" style={{ minWidth: 240 }} onMouseDown={(e) => e.stopPropagation()}>
          <div className="menu-content">
            <div />
            <CheckItem
              checked={!!rule.has}
              onClick={() => {
                focusInput(rootRef.current);
                const r = filter().filterRules[kind];
                r.has = !r.has;
                r.no = false;
                runSeq([(s) => { s.page = 1; s.filterContent && s.filterContent(); }]);
              }}
              name={t(meta.has)}
            />
            <CheckItem
              checked={!!rule.no}
              onClick={() => {
                focusInput(rootRef.current);
                const r = filter().filterRules[kind];
                r.no = !r.no;
                r.has = false;
                runSeq([(s) => { s.page = 1; s.filterContent && s.filterContent(); }]);
              }}
              name={t(meta.no)}
            />
            <textarea
              maxLength={1024}
              cols={30}
              rows={2}
              placeholder={t(meta.ph)}
              className={!rule.has ? 'input-disabled' : undefined}
              value={kwDraft}
              onPaste={(e) => e.stopPropagation()}
              onChange={(e) => {
                setKwDraft(e.target.value);
                clearTimeout((window as any).__kwTimer);
                (window as any).__kwTimer = setTimeout(() => {
                  filter().filterRules[kind].keywords = e.target.value;
                  runSeq([(s) => { s.page = 1; s.filterContent && s.filterContent(); }]);
                }, 300);
              }}
            />
          </div>
        </div>
      </div>
      <ClearBtn onClick={clearKw} />
    </FilterItemShell>
  );
}

/* ============ 容器（index.html 舊 157-203 逐字） ============ */

export function FilterPanel() {
  const snapshot = useFilterState((s) => s.snapshot);
  const viewMode = useToolbarState((s) => s.snapshot.viewMode);
  const isDetailMode = useToolbarState((s) => s.snapshot.isDetailMode);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const tippyRef = useRef<HTMLDivElement>(null);
  useTippy(tippyRef, snapshot);

  useEffect(() => {
    setHost(document.getElementById('eagle-filter-toolbar-host'));
  }, []);

  // 原 #filter-toolbar 的 ng-hide="viewMode == 'alltags'" + ng-class="{'hide-filter': isDetailMode}"
  useEffect(() => {
    if (!host) return;
    const visible = viewMode !== 'alltags';
    host.style.display = visible ? '' : 'none';
    host.classList.toggle('hide-filter', isDetailMode);
    const onMouseDown = (e: MouseEvent) => e.stopPropagation();
    host.addEventListener('mousedown', onMouseDown);
    return () => host.removeEventListener('mousedown', onMouseDown);
  }, [host, viewMode, isDetailMode]);

  if (!host) return null;

  return createPortal(
    <>
      <div className="filter-items">
        <input
          style={{ height: 1, width: 1, position: 'absolute', visibility: 'hidden' }}
          id="colors-picker"
          tabIndex={-1}
          type="color"
          name="favcolor"
          defaultValue="#ff0000"
          onChange={(e) => {
            const v = e.target.value;
            scopeApply(bodyScope(), (s) => {
              s.hexColor = v.toUpperCase();
              s.filterWithColor && s.filterWithColor(s.hexToRGB && s.hexToRGB(s.hexColor));
            });
          }}
        />
        <div style={snapshot.filterIsOpen ? undefined : { display: 'none' }}>
          {snapshot.toolbarTypes.map((type, index) => {
            const Comp = KIND_COMPONENTS[type];
            return Comp ? <Comp key={`${type}-${index}`} snapshot={snapshot} /> : null;
          })}
          <div className="ic-btn filter-add-btn" onClick={() => scopeApply(bodyScope(), (s) => s.openFilterAddContextMenu && s.openFilterAddContextMenu())}>
            <img src={`assets/images/${themePathOf(snapshot.theme)}/icons/ic-filter-add.svg`} />
          </div>
        </div>
      </div>
      <div className="filter-right" style={snapshot.filterBadge > 0 || snapshot.savedFilterCount > 0 ? undefined : { display: 'none' }}>
        <div className="separator" />
        <div className="ic-btns">
          <div
            className={`ic-btn${snapshot.savedFilterIsOpen ? ' active' : ''}`}
            tippy=""
            tippy-placement="bottom"
            tippy-content={t('savedFilter.filterButton')}
            style={snapshot.filterBadge > 0 || snapshot.savedFilterCount > 0 || snapshot.keyword.length > 0 ? undefined : { display: 'none' }}
            onClick={(e) => scopeApply(bodyScope(), (s) => s.SavedFilter && s.SavedFilter.toggle(e))}
          >
            <img src={`assets/images/${themePathOf(snapshot.theme)}/icons/ic-filter-saved.svg`} />
          </div>
          <div
            className={`ic-btn${snapshot.isLock ? ' active' : ''}`}
            tippy=""
            tippy-placement="bottom"
            tippy-content={t('Filter.Lock')}
            style={snapshot.filterBadge > 0 || snapshot.keyword ? undefined : { display: 'none' }}
            onClick={() => { if (filter()) filter().isLock = !filter().isLock; runSeq([(s) => s.$evalAsync && s.$evalAsync()]); }}
          >
            <img src={`assets/images/${themePathOf(snapshot.theme)}/icons/ic-filter-lock.svg`} />
          </div>
          <div
            className="ic-btn"
            tippy=""
            tippy-placement="bottom"
            tippy-content={`${t('Filter.Reset')}${shortcuts(shortcutsWrapper(snapshot.keybinds['find.filter.reset'] || ''))}`}
            style={snapshot.filterBadge > 0 || snapshot.keyword ? undefined : { display: 'none' }}
            onClick={() => runSeq([(s) => { s.resetFilter && s.resetFilter(); s.filterContent && s.filterContent(); }])}
          >
            <img src={`assets/images/${themePathOf(snapshot.theme)}/icons/ic-filter-reset.svg`} />
          </div>
        </div>
      </div>
    </>,
    host
  );
}

KIND_COMPONENTS['rating'] = RatingItem;
KIND_COMPONENTS['fontActivated'] = FontsItem;
KIND_COMPONENTS['camera'] = CameraItem;
KIND_COMPONENTS['shape'] = ShapeItem;
KIND_COMPONENTS['types'] = TypesItem;
KIND_COMPONENTS['import'] = (props) => <DateFilterItem {...props} kind="import" />;
KIND_COMPONENTS['mtime'] = (props) => <DateFilterItem {...props} kind="mtime" />;
KIND_COMPONENTS['duration'] = DurationItem;
KIND_COMPONENTS['bpm'] = BpmItem;
KIND_COMPONENTS['size'] = SizeItem;
KIND_COMPONENTS['resolution'] = ResolutionItem;
KIND_COMPONENTS['annotation'] = (props) => <KeywordFilterItem {...props} kind="annotation" />;
KIND_COMPONENTS['note'] = (props) => <KeywordFilterItem {...props} kind="note" />;
KIND_COMPONENTS['url'] = (props) => <KeywordFilterItem {...props} kind="url" />;
