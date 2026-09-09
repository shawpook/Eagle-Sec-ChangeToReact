import React from 'react';
import {
  pfT,
  themeAttrCss,
  themePathFor,
  ShortcutInput,
  PanelSnap,
} from './panels';
import { applyController, controllerScope } from './controller';

/**
 * 阶段8e：偏好窗口最后五个面板——通知（notification）/截图（screencapture）/
 * 密码保护（privacy）/自动导入（autoImport）/开发者（developer）。
 *
 * 规范来源 = src/app/preferences.html 77-451（Angular 模板逐字转写，行号为 8d 删块后）。
 * 控制函数（openPasswordModal/lockNow/toggleTouchIDClick/openAutoImport/chooseAutoImportPath/
 * revealAutoImportPath/copyApiToken/regenerateApiToken/toggleTouchID）由 controller.ts 承载
 * （8e-2），React 经 applyController 直调（数据面零改动）。
 *
 * 逐字怪癖：
 * - 弹窗区块 ng-if 是 `enable !== 'false'`（反式条件，undefined 时显示），逐字保留。
 * - developer 的 .api-token 与内层 .copy-btn 均绑 copyApiToken——嵌套 ng-click 冒泡双触发。
 * - privacy/autoImport 的开关同时有 ng-model 写入与 ng-click（openPasswordModal/openAutoImport）。
 */

/** toggle 开关（label.toggle > input + span.slider.round；全部 'true'/'false' 字符串语义）。 */
function NgToggle(props: {
  value: any;
  onChange: (value: string) => void;
  onClick?: (event: React.MouseEvent<HTMLInputElement>) => void;
}) {
  return (
    <label className="toggle">
      <input
        type="checkbox"
        checked={props.value === 'true'}
        onChange={(e) => props.onChange(e.currentTarget.checked ? 'true' : 'false')}
        onClick={props.onClick}
      />
      <span className="slider round"></span>
    </label>
  );
}

function themeDir(snap: PanelSnap): string {
  return themePathFor(themeAttrCss(snap));
}

/* b1-9bz-B：本地 callScope 字符串派发退役——8 个方法改为 controllerScope 直调。
   applyController 传入的 s 恒等于 controllerScope，故 `s[fn](...args)` 与
   `controllerScope.fn(...args)` 同对象同 this，notify 语义不变 → 零行为变化。 */

/** notification 面板（preferences.html 78-169 逐字）。 */
export function NotificationPanelContent(props: { snap: PanelSnap }) {
  const { snap } = props;
  const p = snap.preferences;
  const sound = p && p.notification && p.notification.soundEffect ? p.notification.soundEffect : {};
  const soundWhen = sound.when || {};
  const popup = p && p.notification && p.notification.notification ? p.notification.notification : {};
  const popupWhen = popup.when || {};

  const set = (path: string[], value: string) =>
    applyController((s: any) => {
      let obj = s.preferences.notification;
      for (let i = 0; i < path.length - 1; i++) obj = obj[path[i]];
      obj[path[path.length - 1]] = value;
    });

  return (
    <div className="panel-content">
      {/* 音效 */}
      <div className="panel-block" search-show={snap.keyword} search-keywords="notification sound 通知 音效">
        <div className="block-content">
          <div className="block-title">
            {pfT('preferencesWindow.general.soundEffect')}
            <NgToggle value={sound.enable} onChange={(v) => set(['soundEffect', 'enable'], v)} />
          </div>
          {sound.enable === 'true' && (
            <div style={{ marginTop: '8px' }}>
              <div className="checkbox-items">
                <div className="checkbox-item">
                  <label className="control checkbox">
                    <input
                      type="checkbox"
                      checked={soundWhen.deleteImage === 'true'}
                      onChange={(e) => set(['soundEffect', 'when', 'deleteImage'], e.currentTarget.checked ? 'true' : 'false')}
                    />
                    <span className="control-indicator"></span>
                    {pfT('preferencesWindow.general.soundEffect>deleteImage')}
                  </label>
                </div>
                <div className="checkbox-item">
                  <label className="control checkbox">
                    <input
                      type="checkbox"
                      checked={soundWhen.deleteFolder === 'true'}
                      onChange={(e) => set(['soundEffect', 'when', 'deleteFolder'], e.currentTarget.checked ? 'true' : 'false')}
                    />
                    <span className="control-indicator"></span>
                    {pfT('preferencesWindow.general.soundEffect>deleteFolder')}
                  </label>
                </div>
              </div>
              <div className="checkbox-items">
                <div className="checkbox-item">
                  <label className="control checkbox">
                    <input
                      type="checkbox"
                      checked={soundWhen.screencapture === 'true'}
                      onChange={(e) => set(['soundEffect', 'when', 'screencapture'], e.currentTarget.checked ? 'true' : 'false')}
                    />
                    <span className="control-indicator"></span>
                    {pfT('preferencesWindow.general.soundEffect>screencapture')}
                  </label>
                </div>
                <div className="checkbox-item">
                  <label className="control checkbox">
                    <input
                      type="checkbox"
                      checked={soundWhen.extension === 'true'}
                      onChange={(e) => set(['soundEffect', 'when', 'extension'], e.currentTarget.checked ? 'true' : 'false')}
                    />
                    <span className="control-indicator"></span>
                    {pfT('preferencesWindow.general.soundEffect>extension')}
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 弹窗（原版 ng-if 为 enable !== 'false'，逐字保留反式） */}
      <div className="panel-block" search-show={snap.keyword} search-keywords="notification alert 通知 弹窗">
        <div className="block-content">
          <div className="block-title">
            {pfT('preferencesWindow.notification.popup')}
            <NgToggle value={popup.enable} onChange={(v) => set(['notification', 'enable'], v)} />
          </div>
          {popup.enable !== 'false' && (
            <div style={{ marginTop: '8px' }}>
              <div className="checkbox-item">
                <label className="control checkbox">
                  <input
                    type="checkbox"
                    checked={popupWhen.screencapture === 'true'}
                    onChange={(e) => set(['notification', 'when', 'screencapture'], e.currentTarget.checked ? 'true' : 'false')}
                  />
                  <span className="control-indicator"></span>
                  {pfT('preferencesWindow.notification.soundEffect.screencapture')}
                </label>
              </div>
              <div className="checkbox-item">
                <label className="control checkbox">
                  <input
                    type="checkbox"
                    checked={popupWhen.extension === 'true'}
                    onChange={(e) => set(['notification', 'when', 'extension'], e.currentTarget.checked ? 'true' : 'false')}
                  />
                  <span className="control-indicator"></span>
                  {pfT('preferencesWindow.notification.soundEffect.extension')}
                </label>
              </div>
              <div className="checkbox-item">
                <label className="control checkbox">
                  <input
                    type="checkbox"
                    checked={popupWhen.repeatImage === 'true'}
                    onChange={(e) => set(['notification', 'when', 'repeatImage'], e.currentTarget.checked ? 'true' : 'false')}
                  />
                  <span className="control-indicator"></span>
                  {pfT('preferencesWindow.general.notification.repeatImage')}
                </label>
              </div>
              <div className="checkbox-item">
                <label className="control checkbox">
                  <input
                    type="checkbox"
                    checked={popupWhen.autoImport === 'true'}
                    onChange={(e) => set(['notification', 'when', 'autoImport'], e.currentTarget.checked ? 'true' : 'false')}
                  />
                  <span className="control-indicator"></span>
                  {pfT('preferencesWindow.general.notification.autoImport')}
                </label>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** screencapture 面板（preferences.html 172-336 逐字）。 */
export function ScreencapturePanelContent(props: { snap: PanelSnap }) {
  const { snap } = props;
  const p = snap.preferences;
  const sc = p && p.screencapture ? p.screencapture : {};
  const autoTagging = sc.autoTagging ? sc.autoTagging : {};
  const keybinds = p && p.shortcuts ? p.shortcuts.keybinds : {};
  const popupWhen =
    p && p.notification && p.notification.notification && p.notification.notification.when
      ? p.notification.notification.when
      : {};
  const formatNotPng = sc.format !== 'png';
  const captureDisabled = sc.shortcutsEnable === 'false';

  const setSc = (key: string, value: string) =>
    applyController((s: any) => {
      s.preferences.screencapture[key] = value;
    });
  const setGeneral = (key: string, checked: boolean) =>
    applyController((s: any) => {
      s.preferences.general[key] = checked ? 'true' : 'false';
    });
  const setPopupWhen = (key: string, checked: boolean) =>
    applyController((s: any) => {
      s.preferences.notification.notification.when[key] = checked ? 'true' : 'false';
    });
  const setAutoTagging = (checked: boolean) =>
    applyController((s: any) => {
      s.preferences.screencapture.autoTagging.enable = checked ? 'true' : 'false';
    });
  const commitKeybind = (key: string, result: string) =>
    applyController((s: any) => {
      s.preferences.shortcuts.keybinds[key] = result;
    });

  const placeholder = pfT('preferencesWindow.shortcutInputPlaceholder');
  const captureRows: Array<{ key: string; label: string }> = [
    { key: 'global.capture.area', label: pfT('shortcuts.global.capture.area') },
    { key: 'global.capture.window', label: pfT('shortcuts.global.capture.window') },
    { key: 'global.capture.full', label: pfT('shortcuts.global.capture.full') },
  ];

  return (
    <div className="panel-content">
      {/* 通用 */}
      <div
        className="panel-block"
        search-show={snap.keyword}
        search-keywords="screencapture screenshot quality format 質量 品質"
      >
        <div className="block-content">
          <div className="block-title">{pfT('preferencesWindow.screencCapture.formatNquality')}</div>
          {/* 保存格式 */}
          <div className="label-item">
            <label htmlFor="" style={{ width: '240px' }}>
              {pfT('preferencesWindow.screencCapture.format')}
            </label>
            <div className="right">
              <div className="checkbox-items">
                <div className="checkbox-item" style={{ width: '32%' }}>
                  <label className="control radio inline">
                    <input
                      id="radio-page"
                      name="radio-scroll"
                      type="radio"
                      value="png"
                      checked={sc.format === 'png'}
                      onChange={() => setSc('format', 'png')}
                    />
                    <span className="control-indicator"></span> PNG
                  </label>
                </div>
                <div className="checkbox-item" style={{ width: '32%' }}>
                  <label className="control radio inline">
                    <input
                      id="radio-scroll"
                      name="radio-scroll"
                      type="radio"
                      value="jpg"
                      checked={sc.format === 'jpg'}
                      onChange={() => setSc('format', 'jpg')}
                    />
                    <span className="control-indicator"></span> JPG
                  </label>
                </div>
                <div className="checkbox-item" style={{ width: '32%' }}>
                  <label className="control radio inline">
                    <input
                      id="radio-scroll"
                      name="radio-scroll"
                      type="radio"
                      value="webp"
                      checked={sc.format === 'webp'}
                      onChange={() => setSc('format', 'webp')}
                    />
                    <span className="control-indicator"></span> WebP
                  </label>
                </div>
              </div>
            </div>
          </div>
          <div className="separator" style={formatNotPng ? undefined : { display: 'none' }}></div>
          {/* 保存品质 */}
          <div className="label-item" style={formatNotPng ? undefined : { display: 'none' }}>
            <label htmlFor="" style={{ width: '240px' }}>
              {pfT('preferencesWindow.screencCapture.quality')}
            </label>
            <div className="right">
              <div className="checkbox-items">
                <div className="checkbox-item" style={{ width: '32%' }}>
                  <label className="control radio inline">
                    <input
                      name="radio-quality"
                      type="radio"
                      value="90"
                      checked={sc.quality === '90'}
                      onChange={() => setSc('quality', '90')}
                    />
                    <span className="control-indicator"></span> {pfT('preferencesWindow.screencCapture.quality>high')}
                  </label>
                </div>
                <div className="checkbox-item" style={{ width: '32%' }}>
                  <label className="control radio inline">
                    <input
                      name="radio-quality"
                      type="radio"
                      value="80"
                      checked={sc.quality === '80'}
                      onChange={() => setSc('quality', '80')}
                    />
                    <span className="control-indicator"></span> {pfT('preferencesWindow.screencCapture.quality>medium')}
                  </label>
                </div>
                <div className="checkbox-item" style={{ width: '32%' }}>
                  <label className="control radio inline">
                    <input
                      name="radio-quality"
                      type="radio"
                      value="70"
                      checked={sc.quality === '70'}
                      onChange={() => setSc('quality', '70')}
                    />
                    <span className="control-indicator"></span> {pfT('preferencesWindow.screencCapture.quality>low')}
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 快速键 */}
      <div
        className="panel-block"
        search-show={snap.keyword}
        search-keywords="keyboard shortcut screencapture screenshot 快速键 快捷鍵"
      >
        <div className="block-content shortcut-toggle-block">
          <div className="shortcut-toggle-header">
            <span className="shortcut-toggle-label">{pfT('preferencesWindow.screencCapture.shortcutsEnable')}</span>
            <NgToggle value={sc.shortcutsEnable} onChange={(v) => setSc('shortcutsEnable', v)} />
          </div>
          <div
            className="shortcut-table enhanced-shortcut-table"
            style={sc.shortcutsEnable === 'true' ? undefined : { display: 'none' }}
          >
            <div className="tbody">
              {captureRows.map((row) => (
                <div className="table-row" key={row.key}>
                  <div className="table-col function-name">
                    <div className="function-name-text">{row.label}</div>
                  </div>
                  <div className="table-col function-shortcut">
                    <ShortcutInput
                      name={row.key}
                      value={keybinds[row.key]}
                      placeholder={placeholder}
                      disabled={captureDisabled}
                      onCommit={(result) => commitKeybind(row.key, result)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 进阶设置 */}
      <div className="panel-block" search-show={snap.keyword}>
        <div className="block-content">
          <div className="block-title">{pfT('preferencesWindow.screencCapture.options')}</div>
          <div className="checkbox-item">
            <label className="control checkbox">
              <input
                type="checkbox"
                checked={p && p.general ? p.general.showCaptureCollectModal === 'true' : false}
                onChange={(e) => setGeneral('showCaptureCollectModal', e.currentTarget.checked)}
              />
              <span className="control-indicator"></span>
              {pfT('preferencesWindow.general.showCaptureCollectModal')}
            </label>
          </div>
          <div className="checkbox-item">
            <label className="control checkbox">
              <input
                type="checkbox"
                checked={popupWhen.screencapture === 'true'}
                onChange={(e) => setPopupWhen('screencapture', e.currentTarget.checked)}
              />
              <span className="control-indicator"></span>
              {pfT('preferencesWindow.screencCapture.notification')}
            </label>
          </div>
          <div className="checkbox-item">
            <label className="control checkbox">
              <input
                type="checkbox"
                checked={autoTagging.enable === 'true'}
                onChange={(e) => setAutoTagging(e.currentTarget.checked)}
              />
              <span className="control-indicator"></span>
              {pfT('preferencesWindow.screencCapture.autoTagging')}
            </label>
          </div>
          <div className="checkbox-item">
            <label className="control checkbox">
              <input
                type="checkbox"
                checked={sc.autoWriteClipboard === 'true'}
                onChange={(e) => setSc('autoWriteClipboard', e.currentTarget.checked ? 'true' : 'false')}
              />
              <span className="control-indicator"></span>
              {pfT('preferencesWindow.screencCapture.autoWriteClipboard')}
            </label>
          </div>
          <div className="checkbox-item">
            <label className="control checkbox">
              <input
                type="checkbox"
                checked={sc.useRetina === 'true'}
                onChange={(e) => setSc('useRetina', e.currentTarget.checked ? 'true' : 'false')}
              />
              <span className="control-indicator"></span>
              {pfT('preferencesWindow.screencCapture.useRetina')}
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}

/** privacy 面板（preferences.html 339-388 逐字）。 */
export function PrivacyPanelContent(props: { snap: PanelSnap }) {
  const { snap } = props;
  const p = snap.preferences;
  const privacy = p && p.privacy ? p.privacy : {};
  const dir = themeDir(snap);
  const disabled = privacy.enable === 'false';
  const touchIdVisible = snap.platform === 'darwin' && !!snap.canUseTouchID;

  const setPrivacy = (key: string, value: string) =>
    applyController((s: any) => {
      s.preferences.privacy[key] = value;
    });

  return (
    <div className="panel-content">
      <div className="panel-block" search-show={snap.keyword} search-keywords="app lock password pwd">
        <div className={`block-content${disabled ? ' disable' : ''}`}>
          <div className="block-title">
            {pfT('preferencesWindow.privacy.enable')}
            <NgToggle
              value={privacy.enable}
              onChange={(v) => setPrivacy('enable', v)}
              onClick={(e) => applyController(() => controllerScope.openPasswordModal(e, 'new'))}
            />
          </div>
          <div className="block-hint">
            <p className="auto-import-hint">{pfT('preferencesWindow.privacy.tips')}</p>
          </div>
          {privacy.enable === 'true' && (
            <>
              <div className="separator"></div>
              <div className="list-item" onClick={(e) => applyController(() => controllerScope.openPasswordModal(e, 'change'))}>
                <img src={`assets/images/${dir}/icons/preferences/ic-edit.svg`} width={20} height={20} />
                {pfT('preferencesWindow.privacy.change')}
                <div className="right">
                  <img src={`assets/images/${dir}/icons/preferences/ic-next.svg`} width={16} height={16} />
                </div>
              </div>
              <div className="separator"></div>
              <div className="list-item" onClick={(e) => applyController(() => controllerScope.lockNow(e))}>
                <img src={`assets/images/${dir}/icons/preferences/ic-lock.svg`} width={20} height={20} />
                {pfT('preferencesWindow.privacy.lock')}
                <div className="right">
                  <img src={`assets/images/${dir}/icons/preferences/ic-next.svg`} width={16} height={16} />
                </div>
              </div>
              {/* Touch ID 選項 - 僅在 macOS 且支援 Touch ID 時顯示 */}
              {touchIdVisible && (
                <>
                  <div className="separator"></div>
                  <div className="list-item" onClick={(e) => applyController(() => controllerScope.toggleTouchIDClick(e))}>
                    <img src={`assets/images/${dir}/icons/preferences/ic-touchid.svg`} width={20} height={20} />
                    {pfT('preferencesWindow.privacy.touchid')}
                    <div className="right">
                      <label className="toggle">
                        <input
                          type="checkbox"
                          checked={privacy.enableTouchID === 'true'}
                          onChange={(e) => {
                            const v = e.currentTarget.checked ? 'true' : 'false';
                            applyController((s: any) => {
                              s.preferences.privacy.enableTouchID = v;
                              s.toggleTouchID && s.toggleTouchID();
                            });
                          }}
                        />
                        <span className="slider round"></span>
                      </label>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** autoImport 面板（preferences.html 391-425 逐字）。 */
export function AutoImportPanelContent(props: { snap: PanelSnap }) {
  const { snap } = props;
  const p = snap.preferences;
  const autoImport = p && p.autoImport ? p.autoImport : {};
  const dir = themeDir(snap);
  const disabled = autoImport.enable === 'false';

  return (
    <div className="panel-content">
      <div className="panel-block" search-show={snap.keyword} search-keywords="auto import watch">
        <div className={`block-content${disabled ? ' disable' : ''}`}>
          <div className="block-title">
            {pfT('preferencesWindow.autoImport.enable')}
            <NgToggle
              value={autoImport.enable}
              onChange={(v) =>
                applyController((s: any) => {
                  s.preferences.autoImport.enable = v;
                })
              }
              onClick={(e) => applyController(() => controllerScope.openAutoImport(e))}
            />
          </div>
          <div className="block-hint">
            <p className="auto-import-hint">{pfT('preferencesWindow.autoImport.tips')}</p>
          </div>
          {autoImport.enable === 'true' && (
            <>
              <div className="separator"></div>
              <div className="list-item" onClick={(e) => applyController(() => controllerScope.chooseAutoImportPath(e))}>
                <img src={`assets/images/${dir}/icons/preferences/ic-watch-folder.svg`} width={20} height={20} />
                {pfT('preferencesWindow.autoImport.chooseBtn')}
                <div
                  className="right"
                  tippy=""
                  tippy-content={autoImport.path == null ? '' : String(autoImport.path)}
                  tippy-placement="top"
                >
                  <div className="value">{autoImport.path}</div>
                  <img src={`assets/images/${dir}/icons/preferences/ic-next.svg`} width={16} height={16} />
                </div>
              </div>
              <div className="separator"></div>
              <div className="list-item" onClick={(e) => applyController(() => controllerScope.revealAutoImportPath(e))}>
                <img src={`assets/images/${dir}/icons/preferences/ic-folder.svg`} width={20} height={20} />
                {pfT('preferencesWindow.autoImport.revealBtn')}
                <div className="right">
                  <img src={`assets/images/${dir}/icons/preferences/ic-next.svg`} width={16} height={16} />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** developer 面板（preferences.html 428-451 逐字）。
 * .api-token 与内层 .copy-btn 均绑 copyApiToken（原版嵌套 ng-click 事件冒泡双触发，逐字保留）。 */
export function DeveloperPanelContent(props: { snap: PanelSnap }) {
  const { snap } = props;
  const p = snap.preferences;
  const developer = p && p.developer ? p.developer : {};
  const dir = themeDir(snap);
  const apiToken = developer.apiToken == null ? '' : String(developer.apiToken);

  return (
    <div className="panel-content">
      <div className="panel-block" search-show={snap.keyword} search-keywords="developer development api token restful">
        <div className="block-content api-token-container">
          <div className="block-title">{pfT('preferencesWindow.developer.apiToken')}</div>
          <div className="api-token-block">
            <div className="api-token" onClick={() => applyController(() => controllerScope.copyApiToken())}>
              <div className="value">{apiToken}</div>
              <div
                className="copy-btn"
                onClick={() => applyController(() => controllerScope.copyApiToken())}
                tippy=""
                tippy-placement="top"
                tippy-content={pfT('appmenu.edit>copy')}
              >
                <img src={`assets/images/${dir}/icons/preferences/ic-copy.svg`} />
              </div>
            </div>
            <div className="button button-grey button-xs" onClick={(e) => applyController(() => controllerScope.regenerateApiToken(e))}>
              {pfT('preferencesWindow.developer.regenerate')}
            </div>
          </div>
          <div className="separator"></div>
          <div className="checkbox-item api-token-url">
            <img src={`assets/images/${dir}/icons/preferences/ic-link.svg`} />
            <a className="auto-import-hint" href={`http://localhost:41595/?token=${apiToken}`} target="_blank">
              {`http://localhost:41595/?token=${apiToken}`}
            </a>
            <img src={`assets/images/${dir}/icons/preferences/ic-next.svg`} />
          </div>
        </div>
      </div>
    </div>
  );
}
