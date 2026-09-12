/**
 * b1-9bz-A：lockService.ts 新建落点——controllerFns 表体归位。
 * 函数体为 makeControllerFns 表内壳逐字平移（getScope()→getBodyScope()）。
 */

import { getBodyScope } from '../core/appCore';
import { syncListFromScope } from '../store/listState';
import { syncFolderLock } from '../store/lockState';

import { scopeEvalAsync } from '../core/scopeRuntime';
import { q, focusOn, valOf, setValEl, addClass, removeClass, offEl } from '../utils/domQuery';


import { machineryUpdateSidebarList } from '../core/libraryDomain';
import { machineryCalculateImageBinding } from '../core/itemDomain';
import { machineryUpdateSelection } from '../core/selectionViewDomain';
import { machineryFocusAppUnlockPassword } from '../core/miscDomain';
import { usePreferencesState } from '../store/preferencesState';
// ═══ b1-9bz-A：controllerFns 表体归位（逐字平移；getScope()→getBodyScope()；表项指针化）═══
// —— controllerFns 模块级声明随迁（verbatim；按原声明顺序防 TDZ）——
const electronSettings: any = (window as any).electronSettings;

let preferences: any = (window as any).electronSettings?.getPreferences?.() || {};

const $timeout: any = (fn: any, ms?: number) => setTimeout(() => {
  try { if (typeof fn === 'function') fn(); } finally { try { scopeEvalAsync(); } catch (err) { /* noop */ } }
}, ms || 0);
// b1-9bz-A 收口：`$timeout.cancel(timer)` 是 Angular 注入服务的第二形态（详见 filterDomain
// 同款注释）——本落点当前无 cancel 消费面，但移植体与社会面共享同一 shim 语义，补平以防后续
// 归位体踩同类坑（`$timeout.cancel is not a function` 会被 electronLog 缺席的 catch 静默吞掉）。
$timeout.cancel = function (timer: any): boolean {
  if (timer === null || timer === undefined) return false;
  try { clearTimeout(timer); } catch (err) { /* noop */ }
  return true;
};


// b1-9bz-A 收口：lock 族无 __lv_ link 态随迁，但迁移体头部统一带 `try { initLinkVars(); }`
// 序言——缺少本声明时运行期 ReferenceError（被空 catch 吞掉，无症状但破坏迁移体统一形态）。
let lvInited = false;
const initLinkVars = () => {
  if (lvInited) return;
  lvInited = true;
};

const getScope = getBodyScope;  // b1-9bz-A：原 makeControllerFns(getScope) 注入的等价别名

export function focusAppUnlockPassword(...args: any[]) {
  // b1-9bz-B：双键单源化 —— 与 machinery 版逐行等价，统一转发消除重复实现。
   // 原 c3 体的 scope 守卫，逐字保留
  machineryFocusAppUnlockPassword();
}

export function focusUnlockPassword(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function () {
            setTimeout(() => {
                focusOn(q("#lock-password-input"));
            }, 24);
        }).apply(null, args);
  }

export function unlockAppPasswordKeydown(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function (event) {
            event && event.stopPropagation();
            return false;
        }).apply(null, args);
  }

export function unlockAppPasswordKeyup(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function (event) {

            var keyCode = event.keyCode;
            var password = usePreferencesState.getState().preferences.privacy.password;
            var typingPassword = valOf(q("#app-lock-password-input"));
            var currentPassword = window.atob(password);

            if (keyCode === 13) {

                $timeout(function () {
                    console.log(typingPassword);
                    if (
                        typingPassword === currentPassword || 
                        Registration && Registration.license && typingPassword && typingPassword === Registration.license.code
                    ) {
                        s.$root.isAppLocked = false;
                        setValEl(q("#app-lock-password-input"), "");
                        offEl(q("#app-lock-password-input"), "blur"); // 移除 blur 事件監聽
                        s.$root.initMenu();
                    }
                    else {
                        addClass("#app-lock-password-input", "animation--shake-horizontal constant");
                        setTimeout(function () {
                            removeClass("#app-lock-password-input", "animation--shake-horizontal constant");
                        }, 350);
                    }
                }, 10);
            }
        }).apply(null, args);
  }

export function unlockPasswordKeyup(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function (event) {

            var keyCode = event.keyCode;
            var folder = s.currentFolder;
            var currentPassword = window.atob(folder.password);

            if (keyCode === 13) {
                console.log(s.unlockPassword);
                if (
                    s.unlockPassword === currentPassword ||
                    Registration && Registration.license && s.unlockPassword && s.unlockPassword === Registration.license.code
                ) {
                    s.currentFolder.isUnLock = true;
                    syncFolderLock();
                    syncListFromScope();
                    s.isLoading = true;
                    machineryUpdateSidebarList();
                    machineryCalculateImageBinding(s, { ignoreSort: true }, function () {
                        s.reload();
                        machineryUpdateSelection(s);
                        s.isLoading = false;
                        s.unlockPassword = "";
                    });
                }
                else {
                    addClass("#lock-password-input", "animation--shake-horizontal constant");
                    setTimeout(function () {
                        removeClass("#lock-password-input", "animation--shake-horizontal constant");
                    }, 350);
                }
            }
        }).apply(null, args);
  }
