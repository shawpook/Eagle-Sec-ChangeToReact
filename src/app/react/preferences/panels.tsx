import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { applyController, controllerScope, subscribeController } from './controller';
import {
  NotificationPanelContent,
  ScreencapturePanelContent,
  PrivacyPanelContent,
  AutoImportPanelContent,
  DeveloperPanelContent,
} from './panels8e';

/**
 * 阶段8b/8c：偏好窗口面板接管——「常用（general）」「左栏（sidebar）」（8b）+
 * 「操控（control）」「习惯设定（habits）」（8c）。
 *
 * 规范来源 = src/app/preferences.html 各 .panel-content 块（Angular 模板逐字转写）+
 * js/preferences.js（changeTheme/languageChange/changeZoom/changeAutoLaunch/onKeywordChange +
 * searchShow 指令 54-81 + selectAll 指令 130-142 + themeAttr 1097-1109）。
 *
 * 渲染位置：宿主 #eagle-preferences-react-host 在 .content 末尾（footer 之后，8a 契约不动）；
 * 而 .panel-content 块在原版 DOM 里位于 footer 之前（footer 在 .content 内随内容滚动），
 * 因此面板经 portal 渲染进 .content 顶部动态锚点（insertBefore firstChild），
 * 既保住 DOM 顺序，又保住 Angular showSearchEmpty 的统计面
 * （preferences.js 332：$(".content").find(".panel-content :visible") 必须能数到 React 块）。
 *
 * i18n：偏好页没有 window.i18n（preferences.js 用模块级 const i18n），自建 pfT 通道：
 * require('app-root-path') + '/i18n'（mock shim → MockI18n，真实环境 → i18n 类）。
 *
 * search-show 等价（preferences.js 54-81 逐字）：currentPanel.name !== 'search' 时不处理
 * display（原版切回普通面板由 ng-switch 重建元素复位，React 侧渲染驱动等价复位）；
 * search 模式按 (textContent + search-keywords 属性值).includes(keyword) 设 display:block/none。
 *
 * selectAll / sidebar-search（3.5）：#sidebar-search 原位元素保留在 preferences.html
 * （去掉 select-all/ng-model/ng-change 属性），React 绑 keydown（mod+a 全选 / esc 失焦）
 * 与 input（写 scope.keyword + onKeywordChange()），value 由 scope $watch 桥同步
 * （等价原版 ng-model 的双向渲染）。
 */

const ngSafe = (fn: () => void) => {
  try {
    fn();
  } catch (err) {
    console.error(err);
  }
};

export { pfT } from './controller';
import { pfT } from './controller';
import { qa, dataSet } from '../utils/domQuery';

const req = (name: string): any => (window as any).require?.(name);

/** 8e-2 起：数据面为 controller.ts 的 controllerScope（无 Angular）。
 * 保留 getPreferencesScope/runPrefsController 两个符号使面板调用点零改动（面板内部使用）。 */
const getPreferencesScope = (): any => controllerScope;
const runPrefsController = (_scope: any, fn: (s: any) => void) => applyController(fn);

/* ================= scope 桥（签名 watcher：digest 变化 → 快照） ================= */

export interface PanelSnap {
  panel: string;
  keyword: string;
  shortcutKeyword: string;
  preferences: any;
  themes: any[];
  currentTheme: any;
  launchAtLogin: any;
  platform: any;
  isAppleSilicon: any;
  keybindGroups: any[];
  installPlugins: any[];
  canUseTouchID: any;
}

const EMPTY_SNAP: PanelSnap = {
  panel: '',
  keyword: '',
  shortcutKeyword: '',
  preferences: null,
  themes: [],
  currentTheme: null,
  launchAtLogin: undefined,
  platform: undefined,
  isAppleSilicon: undefined,
  keybindGroups: [],
  installPlugins: [],
  canUseTouchID: undefined,
};

function buildSnapshot(scope: any): PanelSnap {
  return {
    panel: (scope.currentPanel && scope.currentPanel.name) || '',
    keyword: scope.keyword || '',
    shortcutKeyword: scope.shortcutKeyword || '',
    preferences: scope.preferences || null,
    themes: Array.isArray(scope.themes) ? scope.themes : [],
    currentTheme: scope.currentTheme || null,
    launchAtLogin: scope.launchAtLogin,
    platform: scope.platform,
    isAppleSilicon: scope.isAppleSilicon,
    keybindGroups: Array.isArray(scope.keybindGroups) ? scope.keybindGroups : [],
    installPlugins: Array.isArray(scope.installPlugins) ? scope.installPlugins : [],
    canUseTouchID: scope.canUseTouchID,
  };
}

/** 本面板消费的 scope 字段签名（digest 期重算；字符串引用比较 → 有变才 bump React）。 */
function snapshotSignature(scope: any): string {
  const p = scope.preferences;
  return JSON.stringify([
    scope.currentPanel && scope.currentPanel.name,
    scope.keyword,
    scope.shortcutKeyword,
    scope.currentTheme && scope.currentTheme.name,
    scope.launchAtLogin,
    scope.platform,
    scope.isAppleSilicon,
    scope.themes,
    p && p.general,
    p && p.sidebar,
    p && p.habits,
    p && p.video,
    p && p.font,
    p && p.shortcuts,
    scope.keybindGroups,
    scope.installPlugins,
    p && p.notification,
    p && p.screencapture,
    p && p.privacy,
    p && p.autoImport,
    p && p.developer,
    scope.canUseTouchID,
  ]);
}

function usePreferencesPanelSnap(): PanelSnap {
  const [snap, setSnap] = useState<PanelSnap>(EMPTY_SNAP);
  useEffect(() => {
    const scope = getPreferencesScope();
    let lastSig: string | null = null;
    const push = () => {
      const sig = snapshotSignature(scope);
      if (sig === lastSig) return;
      lastSig = sig;
      ngSafe(() => setSnap(buildSnapshot(scope)));
    };
    // 首帧快照（initPreference 完成前以守卫空形态渲染）
    push();
    return subscribeController(push);
  }, []);
  return snap;
}

/* ================= 小组件（DOM 逐字） ================= */

/** checkbox-item + control checkbox（ng-model + ng-true/false-value 等价；GIF 组用 'on'/'off'）。
 * onToggle 收到解析后的模型值字符串（trueValue/falseValue），与 ng-model 写入语义一致。 */
function NgStringCheckbox(props: {
  label: string;
  value: any;
  trueValue?: string;
  falseValue?: string;
  tip?: React.ReactNode;
  onToggle: (value: string) => void;
}) {
  const trueValue = props.trueValue ?? 'true';
  const falseValue = props.falseValue ?? 'false';
  return (
    <div className="checkbox-item">
      <label className="control checkbox">
        <input
          type="checkbox"
          checked={props.value === trueValue}
          onChange={(e) => props.onToggle(e.currentTarget.checked ? trueValue : falseValue)}
        />
        <span className="control-indicator"></span>
        {props.label}
        {props.tip}
      </label>
    </div>
  );
}

/** 静态 disable 项（原版无 ng-model 无 ng-change，checked 恒 true，逐字保留）。 */
function NgStaticCheckbox(props: { label: string }) {
  return (
    <div className="checkbox-item">
      <label className="control checkbox disable">
        <input type="checkbox" defaultChecked={true} />
        <span className="control-indicator"></span>
        {props.label}
      </label>
    </div>
  );
}

/** radio inline（ng-model + value 等价；无 ng-change，仅模型写入）。 */
function NgRadio(props: {
  id?: string;
  name: string;
  value: string;
  model: any;
  label: string;
  onSelect: (value: string) => void;
}) {
  return (
    <div className="checkbox-item">
      <label className="control radio inline">
        <input
          id={props.id}
          name={props.name}
          type="radio"
          value={props.value}
          checked={props.model === props.value}
          onChange={() => props.onSelect(props.value)}
        />
        <span className="control-indicator"></span> {props.label}
      </label>
    </div>
  );
}

/* ================= 8c：control/habits 共用件 ================= */

/** themeAttr() 等价（preferences.js 1097-1109）+ themePath 过滤器（144-153）。 */
export function themeAttrCss(snap: PanelSnap): string {
  const theme = snap.preferences && snap.preferences.theme;
  try {
    if (theme && theme.name === 'Auto') {
      const nativeTheme = req('@electron/remote')?.nativeTheme;
      return nativeTheme && nativeTheme.shouldUseDarkColors ? 'gray' : 'light';
    }
  } catch (err) {
    // 原版在 Auto 且无 nativeTheme 时抛错（interpolation 记录后空串）；此处守卫回退
  }
  return (theme && theme.css) || 'gray';
}
export function themePathFor(css: string): string {
  return css === 'light' || css === 'lightgray' ? 'light' : 'dark';
}

/** hover-tip 悬浮提示（preferences.html habits 面板三处，DOM 逐字）。 */
function HoverTip(props: {
  snap: PanelSnap;
  image: string;
  titleKey: string;
  descKey: string;
  contentStyle?: React.CSSProperties;
}) {
  const dir = themePathFor(themeAttrCss(props.snap));
  return (
    <div className="hover-tip">
      <img src={`assets/images/${dir}/icons/preferences/ic-hover-tip.svg`} />
      <div className="hover-tip-content" style={props.contentStyle}>
        <div className="thumb">
          <img src={`assets/images/${dir}/illustrations/preferences/${props.image}`} width={320} height={180} />
        </div>
        <div className="title">{pfT(props.titleKey)}</div>
        <div className="desc">{pfT(props.descKey)}</div>
      </div>
    </div>
  );
}

/** label-item 单选行（control/habits 面板的重复结构；hidden = ng-show 等价 display:none）。 */
function RadioRow(props: {
  labelNode: React.ReactNode;
  name: string;
  model: any;
  rowHidden?: boolean;
  options: Array<{ value: string; label: string; id?: string; hidden?: boolean; itemStyle?: React.CSSProperties }>;
  onSelect: (value: string) => void;
}) {
  return (
    <div className="label-item" style={props.rowHidden ? { display: 'none' } : undefined}>
      <label htmlFor="" style={{ width: '240px' }}>
        {props.labelNode}
      </label>
      <div className="right">
        <div className="checkbox-items">
          {props.options.map((o, i) => (
            <div className="checkbox-item" style={o.itemStyle} key={o.value + '-' + i}>
              <label className="control radio inline" style={o.hidden ? { display: 'none' } : undefined}>
                <input
                  id={o.id}
                  name={props.name}
                  type="radio"
                  value={o.value}
                  checked={props.model === o.value}
                  onChange={() => props.onSelect(o.value)}
                />
                <span className="control-indicator"></span> {o.label}
              </label>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ================= general 面板（preferences.html 73-229 逐字） ================= */

function GeneralPanelContent(props: { snap: PanelSnap }) {
  const { snap } = props;
  const p = snap.preferences;
  const general = p && p.general ? p.general : {};
  const notificationWhen =
    p && p.notification && p.notification.notification && p.notification.notification.when
      ? p.notification.notification.when
      : {};
  const screencapture = p && p.screencapture ? p.screencapture : {};
  const platform = snap.platform;
  const isAppleSilicon = snap.isAppleSilicon;

  const themeClick = (theme: any) =>
    runPrefsController(getPreferencesScope(), (s: any) => s.changeTheme(theme));
  const languageChange = (value: string) =>
    runPrefsController(getPreferencesScope(), (s: any) => {
      s.preferences.general.language = value;
      // 原版怪癖（preferences.html:100）：ng-change="languageChange({{'preferences.general.language'}})"
      // 传参是字面量字符串（$scope.changes.language 为死存储，语义无观察面差异）
      s.languageChange('preferences.general.language');
    });
  const zoomChange = (value: string) =>
    runPrefsController(getPreferencesScope(), (s: any) => {
      s.preferences.general.zoom = value;
      s.changeZoom(value);
    });
  const launchAtLoginToggle = (checked: boolean) =>
    runPrefsController(getPreferencesScope(), (s: any) => {
      s.launchAtLogin = checked ? 'true' : 'false';
      s.changeAutoLaunch(s.launchAtLogin);
    });
  const setGeneral = (key: string, checked: boolean) =>
    runPrefsController(getPreferencesScope(), (s: any) => {
      s.preferences.general[key] = checked ? 'true' : 'false';
    });

  return (
    <div className="panel-content">
      <div
        className="panel-block"
        search-show={snap.keyword}
        search-keywords="general badge theme color language locale zoom 主题 皮肤 颜色 语系 语言 缩放 主題 主題 顏色 語系 語言 縮放 dark light blue purple gray auto"
      >
        <div className="block-content">
          <div className="block-title">{pfT('preferencesWindow.general.appearance')}</div>

          <div className="label-item">
            <label htmlFor="">{pfT('preferencesWindow.sidebar.themes')}</label>
            <div className="right">
              <div className="themes-picker">
                {snap.themes.map((theme: any, i: number) => (
                  <div
                    key={theme && theme.name ? theme.name : i}
                    className={`theme ${theme && theme.css ? theme.css : ''}${
                      theme && snap.currentTheme && theme.name === snap.currentTheme.name ? ' active' : ''
                    }`}
                    tippy=""
                    tippy-content={pfT('preferencesWindow.themes.' + (theme && theme.name))}
                    tippy-placement="top"
                    onClick={() => themeClick(theme)}
                  ></div>
                ))}
              </div>
            </div>
          </div>

          <div className="separator"></div>

          <div className="label-items">
            <div className="label-item">
              <label htmlFor="">{pfT('preferencesWindow.general.language')}</label>
              <div className="right">
                <div className="select">
                  <select
                    value={general.language == null ? '' : String(general.language)}
                    onChange={(e) => languageChange(e.currentTarget.value)}
                  >
                    <option value="en">English</option>
                    <option value="es_ES">Español</option>
                    <option value="de_DE">Deutsch</option>
                    <option value="ru_RU">Русский</option>
                    <option value="zh_TW">繁體中文</option>
                    <option value="zh_CN">简体中文</option>
                    <option value="ja_JP">日本語</option>
                    <option value="ko_KR">한국어</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="separator vertical"></div>
            <div className="label-item">
              <label htmlFor="">{pfT('preferencesWindow.general.zoom')}</label>
              <div className="right">
                <div className="select">
                  <select
                    value={general.zoom == null ? '' : String(general.zoom)}
                    onChange={(e) => zoomChange(e.currentTarget.value)}
                  >
                    <option value="50">50%</option>
                    <option value="75">75%</option>
                    <option value="80">80%</option>
                    <option value="90">90%</option>
                    <option value="100">100%</option>
                    <option value="110">110%</option>
                    <option value="125">125%</option>
                    <option value="150">150%</option>
                    <option value="175">175%</option>
                    <option value="200">200%</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="separator"></div>
          <div className="checkbox-item">
            <label className="control checkbox">
              <input
                type="checkbox"
                checked={general.enableVibrancy === 'true'}
                onChange={(e) => setGeneral('enableVibrancy', e.currentTarget.checked)}
              />
              <span className="control-indicator"></span>
              {pfT('preferencesWindow.general.enableVibrancy')}
            </label>
          </div>
          <div className="separator"></div>
          <div className="checkbox-item">
            <label className="control checkbox">
              <input
                type="checkbox"
                checked={general.showSidebarBadge === 'true'}
                onChange={(e) => setGeneral('showSidebarBadge', e.currentTarget.checked)}
              />
              <span className="control-indicator"></span>
              {pfT('preferencesWindow.general.showSidebarBadge')}
            </label>
          </div>
          {platform === 'darwin' && (
            <div className="checkbox-item">
              <label className="control checkbox">
                <input
                  type="checkbox"
                  checked={general.showMenuItem === 'true'}
                  onChange={(e) => setGeneral('showMenuItem', e.currentTarget.checked)}
                />
                <span className="control-indicator"></span>
                {pfT('preferencesWindow.general.showMenuItem')}
              </label>
            </div>
          )}
          {platform === 'darwin' && (
            <div className="checkbox-item">
              <label className="control checkbox">
                <input
                  type="checkbox"
                  checked={general.keepDockIcon === 'true'}
                  onChange={(e) => setGeneral('keepDockIcon', e.currentTarget.checked)}
                />
                <span className="control-indicator"></span>
                {pfT('preferencesWindow.general.keepDockIcon')}
              </label>
            </div>
          )}
        </div>
      </div>

      <div
        className="panel-block"
        search-show={snap.keyword}
        search-keywords="general launch startup login gpu 顯示卡 显卡 啟動 启动 开机 開機"
      >
        <div className="block-content">
          <div className="block-title">{pfT('preferencesWindow.general.launch')}</div>
          <div className="checkbox-item">
            <label className="control checkbox">
              <input
                type="checkbox"
                checked={snap.launchAtLogin === 'true'}
                onChange={(e) => launchAtLoginToggle(e.currentTarget.checked)}
              />
              <span className="control-indicator"></span>
              {pfT('preferencesWindow.general.lauchAtLogin')}
            </label>
          </div>
          {!isAppleSilicon && (
            <div className="checkbox-item">
              <label className="control checkbox">
                <input
                  type="checkbox"
                  checked={general.enableGPU === 'true'}
                  onChange={(e) => setGeneral('enableGPU', e.currentTarget.checked)}
                />
                <span className="control-indicator"></span>
                {pfT('preferencesWindow.general.enableGPU')}
              </label>
            </div>
          )}
        </div>
      </div>

      <div
        className="panel-block"
        search-show={snap.keyword}
        search-keywords="general auto select 自动 选择 自動 選取"
      >
        <div className="block-content">
          <div className="block-title">{pfT('preferencesWindow.general.collect')}</div>
          <div className="checkbox-item">
            <label className="control checkbox">
              <input
                type="checkbox"
                checked={general.autoSelect === 'true'}
                onChange={(e) => setGeneral('autoSelect', e.currentTarget.checked)}
              />
              <span className="control-indicator"></span>
              {pfT('preferencesWindow.general.autoSelect')}
            </label>
          </div>
          <div className="checkbox-item">
            <label className="control checkbox">
              <input
                type="checkbox"
                checked={notificationWhen.repeatImage === 'true'}
                onChange={(e) => {
                  const checked = e.currentTarget.checked;
                  runPrefsController(getPreferencesScope(), (s: any) => {
                    s.preferences.notification.notification.when.repeatImage = checked ? 'true' : 'false';
                  });
                }}
              />
              <span className="control-indicator"></span>
              {pfT('preferencesWindow.general.notification.repeatImage')}
            </label>
          </div>
          <div className="checkbox-item">
            <label className="control checkbox">
              <input
                type="checkbox"
                checked={general.showCollectModal === 'true'}
                onChange={(e) => setGeneral('showCollectModal', e.currentTarget.checked)}
              />
              <span className="control-indicator"></span>
              {pfT('preferencesWindow.general.showCollectModal')}
            </label>
          </div>
          <div className="checkbox-item">
            <label className="control checkbox">
              <input
                type="checkbox"
                checked={screencapture.useRetina === 'true'}
                onChange={(e) => {
                  const checked = e.currentTarget.checked;
                  runPrefsController(getPreferencesScope(), (s: any) => {
                    s.preferences.screencapture.useRetina = checked ? 'true' : 'false';
                  });
                }}
              />
              <span className="control-indicator"></span>
              {pfT('preferencesWindow.general.notification.useRetina')}
            </label>
          </div>
          <div className="checkbox-item">
            <label className="control checkbox">
              <input
                type="checkbox"
                checked={general.IPTC === 'true'}
                onChange={(e) => setGeneral('IPTC', e.currentTarget.checked)}
              />
              <span className="control-indicator"></span>
              {pfT('preferencesWindow.general.IPTC')}
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================= sidebar 面板（preferences.html 232-353 逐字） ================= */

function SidebarPanelContent(props: { snap: PanelSnap }) {
  const { snap } = props;
  const p = snap.preferences;
  const sidebar = p && p.sidebar ? p.sidebar : {};
  const dblclickSidebarItem = p && p.habits ? p.habits.dblclickSidebarItem : undefined;

  const setSidebar = (key: string, value: string) =>
    runPrefsController(getPreferencesScope(), (s: any) => {
      s.preferences.sidebar[key] = value;
    });
  const setDblclick = (value: string) =>
    runPrefsController(getPreferencesScope(), (s: any) => {
      s.preferences.habits.dblclickSidebarItem = value;
    });

  return (
    <div className="panel-content">
      <div className="panel-block" search-show={snap.keyword} search-keywords="sidebar rename expand collapse">
        <div className="block-content">
          <div className="block-title">{pfT('preferencesWindow.habits.dblclickSidebarItem')}</div>

          <div className="checkbox-items grid-3">
            <NgRadio
              id="radio-scroll"
              name="radio-scroll"
              value="rename"
              model={dblclickSidebarItem}
              label={pfT('preferencesWindow.habits.dblclickSidebarItem>rename')}
              onSelect={setDblclick}
            />
            <NgRadio
              id="radio-page"
              name="radio-scroll"
              value="collapse"
              model={dblclickSidebarItem}
              label={pfT('preferencesWindow.habits.dblclickSidebarItem>collapse')}
              onSelect={setDblclick}
            />
          </div>
        </div>
      </div>

      <div className="panel-block" search-show={snap.keyword} search-keywords="sidebar smart folder">
        <div className="block-content">
          <div className="block-title">{pfT('preferencesWindow.sidebar.label')}</div>
          <div className="checkbox-items grid-3">
            <NgStaticCheckbox label={pfT('preferencesWindow.sidebar.all')} />

            <NgStringCheckbox
              label={pfT('preferencesWindow.sidebar.unfiled')}
              value={sidebar.unfiled}
              onToggle={(c) => setSidebar('unfiled', c)}
            />

            <NgStringCheckbox
              label={pfT('preferencesWindow.sidebar.untagged')}
              value={sidebar.untagged}
              onToggle={(c) => setSidebar('untagged', c)}
            />

            <NgStringCheckbox
              label={pfT('general.pages.recent')}
              value={sidebar.recent}
              onToggle={(c) => setSidebar('recent', c)}
            />

            <NgStringCheckbox
              label={pfT('preferencesWindow.sidebar.random')}
              value={sidebar.random}
              onToggle={(c) => setSidebar('random', c)}
            />

            <NgStringCheckbox
              label={pfT('preferencesWindow.sidebar.community')}
              value={sidebar.community2}
              onToggle={(c) => setSidebar('community2', c)}
            />

            <NgStaticCheckbox label={pfT('preferencesWindow.sidebar.allTags')} />

            <NgStaticCheckbox label={pfT('preferencesWindow.sidebar.trash')} />
          </div>

          <div className="separator"></div>

          <div className="checkbox-items grid-3">
            <NgStringCheckbox
              label={pfT('preferencesWindow.sidebar.quickAccess')}
              value={sidebar.quickAccess}
              onToggle={(c) => setSidebar('quickAccess', c)}
            />

            <NgStringCheckbox
              label={pfT('preferencesWindow.sidebar.smartFolder')}
              value={sidebar.smartFolder}
              onToggle={(c) => setSidebar('smartFolder', c)}
            />

            <NgStringCheckbox
              label={pfT('preferencesWindow.sidebar.folder')}
              value={sidebar.folder}
              onToggle={(c) => setSidebar('folder', c)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================= control 面板（preferences.html 75-207 逐字） ================= */

function ControlPanelContent(props: { snap: PanelSnap }) {
  const { snap } = props;
  const habits = snap.preferences && snap.preferences.habits ? snap.preferences.habits : {};
  const platform = snap.platform;

  const setHabits = (key: string, value: string) =>
    runPrefsController(getPreferencesScope(), (s: any) => {
      s.preferences.habits[key] = value;
    });

  return (
    <div className="panel-content">
      <div
        className="panel-block"
        search-show={snap.keyword}
        search-keywords="control mouse scroll hover double click middle button"
      >
        <div className="block-content">
          <div className="block-title">{pfT('preferencesWindow.controls.mouse')}</div>
          {/* 滾輪 */}
          <RadioRow
            labelNode={pfT('preferencesWindow.habits.scrollBehavior')}
            name="radio-scroll"
            model={habits.scrollBehavior}
            onSelect={(v) => setHabits('scrollBehavior', v)}
            options={[
              { value: 'scroll', label: pfT('preferencesWindow.habits.scrollBehavior>scroll'), id: 'radio-scroll' },
              { value: 'paging', label: pfT('preferencesWindow.habits.scrollBehavior>paging'), id: 'radio-page' },
              { value: 'zoom', label: pfT('preferencesWindow.habits.scrollBehavior>zoom'), id: 'radio-zoom' },
            ]}
          />
          <div className="separator"></div>
          {/* 懸停 */}
          <RadioRow
            labelNode={pfT('preferencesWindow.habits.hoverZoom')}
            name="radio-hoverZoom"
            model={habits.hoverZoom}
            onSelect={(v) => setHabits('hoverZoom', v)}
            options={[
              { value: 'on', label: pfT('preferencesWindow.habits.hoverZoom>on') },
              { value: 'off', label: pfT('preferencesWindow.habits.hoverZoom>off') },
            ]}
          />
          <div className="separator"></div>
          {/* 雙擊 */}
          <RadioRow
            labelNode={pfT('preferencesWindow.habits.doubleclick')}
            name="radio-doubleclick"
            model={habits.doubleclick}
            onSelect={(v) => setHabits('doubleclick', v)}
            options={[
              { value: 'internal', label: pfT('preferencesWindow.habits.doubleclick>internal') },
              { value: 'external', label: pfT('preferencesWindow.habits.doubleclick>external') },
            ]}
          />
          <div className="separator"></div>
          {/* 滾輪按鈕 */}
          <RadioRow
            labelNode={pfT('preferencesWindow.habits.middleBtnBehavior')}
            name="radio-middleBtn"
            model={habits.middleBtn}
            onSelect={(v) => setHabits('middleBtn', v)}
            options={[
              { value: 'openNewWindow', label: pfT('preferencesWindow.habits.middleBtnBehavior>openNewWindow') },
              { value: 'none', label: pfT('preferencesWindow.habits.middleBtnBehavior>none') },
              { value: 'openPluginPanel', label: pfT('preferencesWindow.habits.middleBtnBehavior>plugin') },
            ]}
          />
        </div>
      </div>

      <div className="panel-block" search-show={snap.keyword} search-keywords="control keyboard space scroll">
        <div className="block-content">
          <div className="block-title">{pfT('preferencesWindow.controls.keyboard')}</div>
          <RadioRow
            labelNode={pfT('preferencesWindow.habits.spaceBehavior')}
            name="radio-keyspace"
            model={habits.keyspace}
            onSelect={(v) => setHabits('keyspace', v)}
            options={[
              { value: 'preview', label: pfT('preferencesWindow.habits.spaceBehavior>preview') },
              { value: 'preview-native', label: pfT('preferencesWindow.habits.spaceBehavior>previewNative'), hidden: platform !== 'darwin' },
              { value: 'scroll', label: pfT('preferencesWindow.habits.spaceBehavior>scroll') },
            ]}
          />
        </div>
      </div>
    </div>
  );
}

/* ================= habits 面板（preferences.html 210-451 逐字） ================= */

function HabitsPanelContent(props: { snap: PanelSnap }) {
  const { snap } = props;
  const p = snap.preferences;
  const habits = p && p.habits ? p.habits : {};
  const video = p && p.video ? p.video : {};
  const font = p && p.font ? p.font : {};

  const setHabits = (key: string, value: string) =>
    runPrefsController(getPreferencesScope(), (s: any) => {
      s.preferences.habits[key] = value;
    });
  const setVideo = (key: string, value: string) =>
    runPrefsController(getPreferencesScope(), (s: any) => {
      s.preferences.video[key] = value;
    });
  const setFont = (key: string, value: string) =>
    runPrefsController(getPreferencesScope(), (s: any) => {
      s.preferences.font[key] = value;
    });

  return (
    <div className="panel-content">
      {/* 通用 */}
      <div
        className="panel-block"
        search-show={snap.keyword}
        search-keywords="view viewer detail hover zoom pixel last ratio transparency grid 懸停 放大 縮放 像素 最後 比例 透明 網格 格 悬停 放大 缩放 像素 最后 比例 透明 网格"
      >
        <div className="block-content">
          <div className="block-title">{pfT('preferencesWindow.habits.image')}</div>
          {/* 放大細節 */}
          <RadioRow
            labelNode={
              <>
                {pfT('preferencesWindow.habits.renderBehavior')}{' '}
                <HoverTip
                  snap={snap}
                  image="illustration-pixelate.png"
                  titleKey="preferencesWindow.hoverTip.pixelate.title"
                  descKey="preferencesWindow.hoverTip.pixelate.desc"
                />
              </>
            }
            name="radio-zoom"
            model={habits.renderBehavior}
            onSelect={(v) => setHabits('renderBehavior', v)}
            options={[
              { value: 'pixelated', label: pfT('preferencesWindow.habits.renderBehavior>pixelated'), id: 'radio-scroll' },
              { value: 'non-pixelated', label: pfT('preferencesWindow.habits.renderBehavior>nonpixelated'), id: 'radio-page' },
            ]}
          />
          <div className="separator"></div>
          {/* 記住上次位置 */}
          <RadioRow
            labelNode={pfT('preferencesWindow.habits.rememberLastZoom')}
            name="radio-rememberLastZoom"
            model={habits.rememberLastZoom}
            onSelect={(v) => setHabits('rememberLastZoom', v)}
            options={[
              { value: 'on', label: pfT('preferencesWindow.habits.rememberLastZoom>on') },
              { value: 'off', label: pfT('preferencesWindow.habits.rememberLastZoom>off') },
            ]}
          />
          <div className="separator"></div>
          {/* 默認比例 */}
          <RadioRow
            labelNode={pfT('preferencesWindow.habits.defaultRatio')}
            name="radio-ratio"
            model={habits.defaultRatio}
            onSelect={(v) => setHabits('defaultRatio', v)}
            options={[
              { value: 'auto', label: pfT('preferencesWindow.habits.defaultRatio>auto') },
              { value: '100%', label: pfT('preferencesWindow.habits.defaultRatio>100') },
            ]}
          />
          <div className="separator"></div>
          {/* 圖片變換操作 */}
          <RadioRow
            labelNode={pfT('preferencesWindow.habits.imageRotateMode')}
            name="radio-imageRotateMode"
            model={habits.imageRotateMode}
            onSelect={(v) => setHabits('imageRotateMode', v)}
            options={[
              { value: 'preview', label: pfT('preferencesWindow.habits.imageRotateMode>preview') },
              { value: 'write', label: pfT('preferencesWindow.habits.imageRotateMode>write') },
            ]}
          />
          <div className="separator"></div>
          {/* 透明背景 */}
          <RadioRow
            labelNode={
              <>
                {pfT('preferencesWindow.habits.transparency')}{' '}
                <HoverTip
                  snap={snap}
                  image="illustration-transparent-grid.png"
                  titleKey="preferencesWindow.hoverTip.transparentGrid.title"
                  descKey="preferencesWindow.hoverTip.transparentGrid.desc"
                />
              </>
            }
            name="radio-transparency"
            model={habits.transparency}
            onSelect={(v) => setHabits('transparency', v)}
            options={[
              { value: 'show', label: pfT('preferencesWindow.habits.transparency>show') },
              { value: 'hide', label: pfT('preferencesWindow.habits.transparency>hide') },
            ]}
          />
        </div>
      </div>

      {/* 視頻 */}
      <div
        className="panel-block"
        search-show={snap.keyword}
        search-keywords="video movie 视频 影片 loop hover 懸停 悬停 scroll 滚动 滾動"
      >
        <div className="block-content">
          <div className="block-title">{pfT('preferencesWindow.habits.video')}</div>
          <RadioRow
            labelNode={pfT('preferencesWindow.habits.videoScrollBehavior')}
            name="radio-scroll"
            model={habits.videoScrollBehavior}
            onSelect={(v) => setHabits('videoScrollBehavior', v)}
            options={[
              { value: 'progress', label: pfT('preferencesWindow.habits.videoScrollBehavior>progress'), id: 'radio-scroll' },
              { value: 'volume', label: pfT('preferencesWindow.habits.videoScrollBehavior>volume'), id: 'radio-page' },
            ]}
          />
          <div className="separator"></div>

          <NgStringCheckbox
            label={pfT('preferencesWindow.video.hoverPlay')}
            value={video.hoverPlay}
            onToggle={(v) => setVideo('hoverPlay', v)}
            tip={
              <HoverTip
                snap={snap}
                image="illustration-hover-preview.png"
                titleKey="preferencesWindow.hoverTip.hoverPreview.title"
                descKey="preferencesWindow.hoverTip.hoverPreview.desc"
                contentStyle={{ marginTop: '-60px' }}
              />
            }
          />

          <NgStringCheckbox
            label={pfT('preferencesWindow.video.zoomFill')}
            value={video.zoomFill}
            onToggle={(v) => setVideo('zoomFill', v)}
          />

          <NgStringCheckbox
            label={pfT('preferencesWindow.video.autoPlay')}
            value={video.autoPlay}
            onToggle={(v) => setVideo('autoPlay', v)}
          />

          <NgStringCheckbox
            label={pfT('preferencesWindow.video.rememberPosition')}
            value={video.rememberPosition}
            onToggle={(v) => setVideo('rememberPosition', v)}
          />

          <NgStringCheckbox
            label={pfT('preferencesWindow.video.loopShortVideo')}
            value={video.loopShortVideo}
            onToggle={(v) => setVideo('loopShortVideo', v)}
          />
        </div>
      </div>

      {/* GIF/動圖 */}
      <div className="panel-block" search-show={snap.keyword} search-keywords="gif webp 動畫 动画 动图 動圖">
        <div className="block-content">
          <div className="block-title">{pfT('preferencesWindow.habits.gif')}</div>
          <NgStringCheckbox
            label={pfT('preferencesWindow.habits.alwaysPlayGIF')}
            value={habits.alwaysPlayGIF}
            trueValue="on"
            falseValue="off"
            onToggle={(v) => setHabits('alwaysPlayGIF', v)}
          />
          <NgStringCheckbox
            label={pfT('preferencesWindow.habits.gifViewer')}
            value={habits.gifViewer}
            trueValue="on"
            falseValue="off"
            onToggle={(v) => setHabits('gifViewer', v)}
          />
        </div>
      </div>

      {/* 字型 */}
      <div className="panel-block" search-show={snap.keyword} search-keywords="font 字體 字体 字型 字形">
        <div className="block-content">
          <div className="block-title">{pfT('preferencesWindow.habits.font')}</div>
          <NgStringCheckbox
            label={pfT('preferencesWindow.font.autoTag')}
            value={font.autoTag}
            onToggle={(v) => setFont('autoTag', v)}
          />
        </div>
      </div>
    </div>
  );
}

/* ================= shortcuts 面板（preferences.html 76-135 逐字 + shortcutInput 指令等价） ================= */

/** updateKeybinds 逐字移植（preferences.js 601-656）：keyword 过滤 keybindGroups 分组与插件清单。
 * i18n.__ → pfT 等价；$('#shortcut-input').val() 读取点由 React state 顶替。 */
function computeShortcutResults(keyword: string, snap: PanelSnap) {
  const lowerKeyword = (keyword || '').toLowerCase();
  const keybindGroups = snap.keybindGroups;
  const installPlugins = snap.installPlugins;
  const keybinds = snap.preferences && snap.preferences.shortcuts ? snap.preferences.shortcuts.keybinds : {};

  if (!lowerKeyword) {
    return {
      groups: keybindGroups.map((group: any) => ({ ...group, items: [...group.items] })),
      plugins: installPlugins || [],
    };
  }

  const groups = keybindGroups
    .map((group: any) => {
      const filteredItems = (group.items || []).filter((item: any) => {
        const shortcutName = pfT('shortcuts.' + item.key) || '';
        const lowerName = shortcutName.toLowerCase();
        const shortcut = keybinds[item.key];
        const lowerShortcut =
          shortcut != null ? String(shortcut).toLowerCase().replaceAll(' ', '') : '';
        const lowerKey = String(item.key).toLowerCase();
        const groupName = (pfT('shortcuts.group.' + group.name) || '').toLowerCase();
        const str = `${lowerName} ${lowerShortcut} ${lowerKey} ${groupName}`;
        return str.indexOf(lowerKeyword) > -1;
      });
      return { ...group, items: filteredItems };
    })
    .filter((group: any) => group.items.length > 0);

  const plugins = (installPlugins || []).filter((plugin: any) => {
    const pluginName = (plugin && plugin.name ? String(plugin.name) : '').toLowerCase();
    const pluginId = (plugin && plugin.id ? String(plugin.id) : '').toLowerCase();
    const shortcut = (plugin && plugin.formatShortcut ? String(plugin.formatShortcut) : '').replaceAll(' ', '');
    const pluginKeyword = (pfT('preferencesWindow.shortcuts.plugin') || 'plugin').toLowerCase();
    const str = `${pluginName} ${pluginId} ${shortcut} ${pluginKeyword}`;
    return str.indexOf(lowerKeyword) > -1;
  });

  return { groups, plugins };
}

/** shortcutInput 指令等价（js/directives/shortcut-input.js 逐字）：
 * keydown 捕获（preventDefault + 修饰键前缀 + 键值映射）、冲突检测不写模型（1.5s 提示）、
 * updateStatus（valid/invalid/conflict class + 提示元素）、focus 显原值 / blur 格式化。
 * ShortcutManager 消费 window 全局单例（数据面零改动）。 */
export function ShortcutInput(props: {
  name: string;
  value: any;
  placeholder: string;
  disabled?: boolean;
  onCommit: (result: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const errorRef = useRef<HTMLDivElement | null>(null);
  const conflictRef = useRef<HTMLDivElement | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;
  const valueRef = useRef(props.value);
  valueRef.current = props.value;

  const getManager = (): any => (window as any).ShortcutManager;

  const conflictNames = (conflicts: string[]): string[] =>
    conflicts.map((conflictKey: string) => {
      const i18nKey = 'shortcuts.' + conflictKey;
      const displayName = pfT(i18nKey);
      return displayName !== i18nKey ? displayName : conflictKey;
    });

  const updateStatus = (shortcutValue: string) => {
    const el = inputRef.current;
    const errorElement = errorRef.current;
    const conflictElement = conflictRef.current;
    if (!el || !errorElement || !conflictElement) return;

    el.classList.remove('shortcut-valid', 'shortcut-invalid', 'shortcut-conflict');
    errorElement.style.display = 'none';
    errorElement.textContent = '';
    conflictElement.style.display = 'none';
    conflictElement.textContent = '';

    if (!shortcutValue) {
      el.classList.add('shortcut-valid');
      return;
    }

    const manager = getManager();
    if (!manager) return;

    const validation = manager.validateShortcut(shortcutValue);
    if (!validation.valid) {
      el.classList.add('shortcut-invalid');
      errorElement.textContent = validation.error;
      errorElement.style.display = '';
      return;
    }

    const conflicts = manager.getConflicts(shortcutValue, propsRef.current.name);
    if (conflicts.length > 0) {
      el.classList.add('shortcut-conflict');
      const names = conflictNames(conflicts);
      const conflictText = (pfT('shortcuts.conflict.usedBy') || '').replace('{0}', names[0]);
      conflictElement.textContent = conflictText;
      conflictElement.style.display = '';
      return;
    }

    el.classList.add('shortcut-valid');
  };

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    const errorElement = errorRef.current;
    const conflictElement = conflictRef.current;
    let conflictTimer: any = null;
    let refocusTimer: any = null;
    let clearTimer: any = null;

    const showConflictFlow = (result: string) => {
      const manager = getManager();
      const current = propsRef.current;
      const originalValue = valueRef.current == null ? '' : String(valueRef.current);
      if (!el || !errorElement || !conflictElement || !manager) return;

      const conflicts = manager.getConflicts(result, current.name);
      if (conflicts.length > 0) {
        el.classList.remove('shortcut-valid', 'shortcut-invalid');
        el.classList.add('shortcut-conflict');
        const names = conflictNames(conflicts);
        const conflictText = (pfT('shortcuts.conflict.usedBy') || '').replace('{0}', names[0]);
        conflictElement.textContent = conflictText;
        conflictElement.style.display = '';
        // 保持原始值
        el.value = manager.formatForDisplay(originalValue);
        (el as any).__showingConflict = true;
        clearTimeout(conflictTimer);
        conflictTimer = setTimeout(() => {
          (el as any).__showingConflict = false;
          conflictElement.style.display = 'none';
          updateStatus(originalValue);
        }, 1500);
        clearTimeout(refocusTimer);
        refocusTimer = setTimeout(() => {
          el.blur();
          el.focus();
        }, 100);
      } else {
        current.onCommit(result);
        el.value = manager.formatForDisplay(result);
        updateStatus(result);
        el.blur();
        el.focus();
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      const keyCode = e.which;
      let char: string | undefined;
      if (e.code) {
        char = e.code.replace('Key', '').replace('Digit', '');
        switch (char) {
          case 'BracketLeft': char = '['; break;
          case 'BracketRight': char = ']'; break;
          case 'Minus': char = '-'; break;
          case 'Equal': char = '='; break;
          case 'Backslash': char = '\\'; break;
          case 'Semicolon': char = ';'; break;
          case 'Quote': char = "'"; break;
          case 'Backquote': char = '`'; break;
          case 'Slash': char = '/'; break;
          case 'Period': char = '.'; break;
          case 'Comma': char = ','; break;
        }
      }

      const shiftKey = e.shiftKey;
      const metaKey = e.metaKey;
      const ctrlKey = e.ctrlKey;
      const altKey = e.altKey;
      let needCombindKey = false;
      let result = '';

      if (ctrlKey) {
        result += 'Ctrl + ';
        needCombindKey = true;
      }
      if (metaKey && process.platform === 'darwin') {
        if (!ctrlKey) {
          result += 'Command + ';
        }
        needCombindKey = true;
      }
      if (shiftKey) { result += 'Shift + '; needCombindKey = true; }
      if (altKey) {
        result += 'Alt + ';
        needCombindKey = true;
      }

      switch (keyCode) {
        case 8:
          // Backspace 鍵處理：無修飾鍵時清空快捷鍵
          if (result.length === 0) {
            result = '';
            propsRef.current.onCommit('');
            updateStatus('');
            return;
          } else {
            result += 'Backspace';
            needCombindKey = false;
          }
          break;
        case 46: result += 'Delete'; needCombindKey = false; break;
        case 36: result += 'Home'; needCombindKey = false; break;
        case 35: result += 'End'; needCombindKey = false; break;
        case 33: result += 'PageUp'; needCombindKey = false; break;
        case 34: result += 'PageDown'; needCombindKey = false; break;
        case 112: result += 'F1'; needCombindKey = false; break;
        case 113: result += 'F2'; needCombindKey = false; break;
        case 114: result += 'F3'; needCombindKey = false; break;
        case 115: result += 'F4'; needCombindKey = false; break;
        case 116: result += 'F5'; needCombindKey = false; break;
        case 117: result += 'F6'; needCombindKey = false; break;
        case 118: result += 'F7'; needCombindKey = false; break;
        case 119: result += 'F8'; needCombindKey = false; break;
        case 120: result += 'F9'; needCombindKey = false; break;
        case 121: result += 'F10'; needCombindKey = false; break;
        case 122: result += 'F11'; needCombindKey = false; break;
        case 123: result += 'F12'; needCombindKey = false; break;
        case 219: result += '['; needCombindKey = false; break;
        case 221: result += ']'; needCombindKey = false; break;
        case 13: result += 'Enter'; needCombindKey = false; break;
        case 32: result += 'Space'; needCombindKey = false; break;
        case 38: result += 'Up'; needCombindKey = false; break;
        case 40: result += 'Down'; needCombindKey = false; break;
        case 39: result += 'Right'; needCombindKey = false; break;
        case 37: result += 'Left'; needCombindKey = false; break;
        default:
          // 英文数字按键必须要有搭配按键才算数
          if (needCombindKey) {
            if (ctrlKey || metaKey || altKey || shiftKey) {
              if (keyCode === 107) {
                result += 'Plus';
                needCombindKey = false;
              } else if (keyCode === 189 || keyCode === 109) {
                result += '-';
                needCombindKey = false;
              } else if (keyCode === 187) {
                result += '=';
                needCombindKey = false;
              } else if (char && char.length === 1 && /^[A-Za-z0-9\[\]\\;',./`~\-=]$/.test(char)) {
                result += char.toUpperCase();
                needCombindKey = false;
              }
            }
          }
      }

      if (result && !needCombindKey) {
        // $timeout 等价
        clearTimeout(clearTimer);
        clearTimer = setTimeout(() => showConflictFlow(result), 0);
      } else {
        propsRef.current.onCommit(valueRef.current == null ? '' : String(valueRef.current));
      }
    };

    const onFocus = () => {
      const currentValue = valueRef.current;
      if (currentValue) {
        el.value = String(currentValue);
      }
    };

    const onBlur = () => {
      if ((el as any).__showingConflict) {
        return;
      }
      const currentValue = valueRef.current == null ? '' : String(valueRef.current);
      updateStatus(currentValue);
      const manager = getManager();
      if (currentValue && manager) {
        el.value = manager.formatForDisplay(currentValue);
      }
    };

    el.addEventListener('keydown', onKeyDown);
    el.addEventListener('focus', onFocus);
    el.addEventListener('blur', onBlur);

    // 初始化時更新狀態和顯示格式（$timeout(100) 等价）
    const initTimer = setTimeout(() => {
      const currentValue = valueRef.current == null ? '' : String(valueRef.current);
      updateStatus(currentValue);
      const manager = getManager();
      if (currentValue && manager) {
        el.value = manager.formatForDisplay(currentValue);
      }
    }, 100);

    return () => {
      el.removeEventListener('keydown', onKeyDown);
      el.removeEventListener('focus', onFocus);
      el.removeEventListener('blur', onBlur);
      clearTimeout(initTimer);
      clearTimeout(conflictTimer);
      clearTimeout(refocusTimer);
      clearTimeout(clearTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 外部模型变化（restoreDefaults 等）→ 显示值跟随（ng-model $render 等价）
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    if ((el as any).__showingConflict) return;
    const manager = getManager();
    el.value = props.value == null ? '' : manager ? manager.formatForDisplay(String(props.value)) : String(props.value);
  }, [props.value]);

  return (
    <div className="shortcut-input-container">
      <div className="shortcut-conflict-tip color-warning" style={{ display: 'none' }} ref={conflictRef}></div>
      <input type="text" className="shortcut-input" placeholder={props.placeholder} disabled={props.disabled} ref={inputRef} />
      <div className="shortcut-error" style={{ display: 'none' }} ref={errorRef}></div>
    </div>
  );
}

function ShortcutsPanelContent(props: { snap: PanelSnap; shortcutKeyword: string }) {
  const { snap, shortcutKeyword } = props;
  const results = computeShortcutResults(shortcutKeyword, snap);

  const commitKeybind = (key: string, result: string) =>
    runPrefsController(getPreferencesScope(), (s: any) => {
      s.preferences.shortcuts.keybinds[key] = result;
    });
  const commitPlugin = (plugin: any, result: string) =>
    runPrefsController(getPreferencesScope(), (s: any) => {
      // 原版 ng-model 写 installPlugin.formatShortcut + ng-change onPluginShortcutChange
      plugin.formatShortcut = result;
      s.onPluginShortcutChange && s.onPluginShortcutChange(plugin);
    });
  const restoreDefaults = () =>
    runPrefsController(getPreferencesScope(), (s: any) => s.restoreDefaultShortcuts && s.restoreDefaultShortcuts());

  const placeholder = pfT('preferencesWindow.shortcutInputPlaceholder');

  return (
    <div className="panel-content">
      {results.groups.map((group: any) => (
        <div
          key={group.name}
          className="panel-block"
          search-show={snap.keyword}
          search-keywords={'shortcuts ' + group.name}
        >
          <div className="block-content shortcut-block">
            <div className="block-title">
              {pfT('shortcuts.group.' + group.name)} ({group.items.length})
            </div>
            <div className="shortcut-table enhanced-shortcut-table">
              <div className="tbody">
                {group.items.map((keybind: any) => (
                  <div className="table-row" key={keybind.key}>
                    <div className="table-col function-name">
                      <div className="function-name-text">{pfT('shortcuts.' + keybind.key)}</div>
                      {keybind.description ? (
                        <div className="function-description">{keybind.description}</div>
                      ) : null}
                    </div>
                    <div className="table-col function-shortcut">
                      <ShortcutInput
                        name={keybind.key}
                        value={
                          snap.preferences && snap.preferences.shortcuts
                            ? snap.preferences.shortcuts.keybinds[keybind.key]
                            : undefined
                        }
                        placeholder={placeholder}
                        onCommit={(result) => commitKeybind(keybind.key, result)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* ng-show="filteredInstallPlugins.length > 0"——常驻 DOM，display 由 search-show 效果统一驱动 */}
      <div className="panel-block" search-show={snap.keyword} search-keywords="shortcuts plugin">
        <div className="block-content shortcut-block">
          <div className="block-title">
            {pfT('preferencesWindow.shortcuts.plugin')} ({results.plugins.length})
          </div>
          <div className="shortcut-table enhanced-shortcut-table">
            <div className="tbody">
              {results.plugins.map((installPlugin: any, index: number) => (
                <div className="table-row" key={installPlugin.id || index}>
                  <div className="table-col function-name">
                    <div className="function-name-text">{installPlugin.name}</div>
                  </div>
                  <div className="table-col function-shortcut">
                    <ShortcutInput
                      name={installPlugin.id}
                      value={installPlugin.formatShortcut}
                      placeholder={placeholder}
                      onCommit={(result) => commitPlugin(installPlugin, result)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Restore Defaults Section（ng-show="keybindGroupResult.length > 0" 同上） */}
      <div
        className="restore-defaults-section"
        search-show={snap.keyword}
        search-keywords="shortcuts 快捷鍵 快捷键 恢復默認 恢复默认"
      >
        <div className="separator"></div>
        <div className="restore-defaults-container">
          <div className="button button-grey" onClick={restoreDefaults}>
            {pfT('preferencesWindow.shortcuts.restoreDefaults')}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================= 根组件（portal + search-show + tippy + sidebar-search 接管） ================= */

export function PreferencesPanels() {
  const snap = usePreferencesPanelSnap();
  const [container, setContainer] = useState<HTMLElement | null>(null);

  // portal 锚点：.content 顶部（原版 .panel-content 位于 footer 之前；host 在 footer 之后
  // 不能直接承载面板块。showSearchEmpty 统计 .content 内 .panel-content :visible，
  // 锚点必须在 .content 内）
  useEffect(() => {
    const content = document.querySelector('.content');
    if (!content) return;
    const el = document.createElement('div');
    el.setAttribute('data-eagle-react-panels', 'panels');
    content.insertBefore(el, content.firstChild);
    setContainer(el);
    return () => {
      el.remove();
    };
  }, []);

  // search-show 等价（preferences.js 54-81 逐字：textContent + search-keywords 包含 keyword；
  // 指令挂在一切 [search-show] 元素上，含 shortcuts 面板的 .restore-defaults-section）。
  // 非搜索态的 display 复位在此统一负责，兼顾 shortcuts 面板两处 ng-show：
  // 插件块（filteredInstallPlugins.length）与 restore 区（keybindGroupResult.length）。
  useEffect(() => {
    const root = container;
    if (!root) return;
    const results = computeShortcutResults(snap.shortcutKeyword, snap);
    root.querySelectorAll<HTMLElement>('[search-show]').forEach((el) => {
      if (snap.panel !== 'search') {
        // 原版切回普通面板由 ng-switch 重建元素复位 display；渲染驱动等价
        const keywords = el.getAttribute('search-keywords');
        if (keywords === 'shortcuts plugin' && !(snap.installPlugins && snap.installPlugins.length > 0)) {
          el.style.display = 'none';
        } else if (el.classList.contains('restore-defaults-section') && results.groups.length === 0) {
          el.style.display = 'none';
        } else {
          el.style.display = '';
        }
        return;
      }
      const keywords = (el.getAttribute('search-keywords') || '').toLowerCase();
      const text = el.textContent.toLowerCase() + '' + keywords;
      const keyword = (snap.keyword || '').toLowerCase();
      el.style.display = text.indexOf(keyword) > -1 ? 'block' : 'none';
    });
  }, [container, snap]);

  // tippy 等价（js/modules/tippy.js：animation scale / arrow false / allowHTML / placement）
  useEffect(() => {
    const root = container;
    if (!root) return;
    const tippy = (window as any).tippy;
    if (!tippy) return;
    const instances: Array<any> = [];
    root.querySelectorAll<HTMLElement>('[tippy][tippy-content]').forEach((el) => {
      instances.push(
        tippy(el, {
          animation: 'scale',
          arrow: false,
          content: el.getAttribute('tippy-content') || '',
          placement: (el.getAttribute('tippy-placement') as any) || 'right',
          allowHTML: true,
        })
      );
    });
    return () => instances.forEach((instance) => instance.destroy());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [container, snap.preferences && snap.preferences.autoImport && snap.preferences.autoImport.path]);

  // updateKeybinds 的 $('.shortcut-input').data('search-active', isSearching) 等价（原样写 jQuery data）
  useEffect(() => {
    ngSafe(() => {
      qa('.shortcut-input').forEach((el) => {
        dataSet(el, 'search-active', !!snap.shortcutKeyword);
      });
    });
  }, [snap.shortcutKeyword, snap.panel]);

  if (!container) return null;
  if (
    snap.panel !== 'general' &&
    snap.panel !== 'sidebar' &&
    snap.panel !== 'control' &&
    snap.panel !== 'habits' &&
    snap.panel !== 'shortcuts' &&
    snap.panel !== 'notification' &&
    snap.panel !== 'screencapture' &&
    snap.panel !== 'privacy' &&
    snap.panel !== 'autoImport' &&
    snap.panel !== 'developer' &&
    snap.panel !== 'search'
  ) {
    return null;
  }

  return createPortal(
    <>
      {(snap.panel === 'general' || snap.panel === 'search') && <GeneralPanelContent snap={snap} />}
      {(snap.panel === 'sidebar' || snap.panel === 'search') && <SidebarPanelContent snap={snap} />}
      {(snap.panel === 'control' || snap.panel === 'search') && <ControlPanelContent snap={snap} />}
      {(snap.panel === 'habits' || snap.panel === 'search') && <HabitsPanelContent snap={snap} />}
      {(snap.panel === 'shortcuts' || snap.panel === 'search') && (
        <ShortcutsPanelContent snap={snap} shortcutKeyword={snap.shortcutKeyword} />
      )}
      {(snap.panel === 'notification' || snap.panel === 'search') && <NotificationPanelContent snap={snap} />}
      {(snap.panel === 'screencapture' || snap.panel === 'search') && <ScreencapturePanelContent snap={snap} />}
      {(snap.panel === 'privacy' || snap.panel === 'search') && <PrivacyPanelContent snap={snap} />}
      {(snap.panel === 'autoImport' || snap.panel === 'search') && <AutoImportPanelContent snap={snap} />}
      {(snap.panel === 'developer' || snap.panel === 'search') && <DeveloperPanelContent snap={snap} />}
    </>,
    container
  );
}
