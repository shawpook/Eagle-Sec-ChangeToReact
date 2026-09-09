/**
 * b1-9bz-A：lockService.ts 新建落点——controllerFns 表体归位。
 * 函数体为 makeControllerFns 表内壳逐字平移（getScope()→getBodyScope()）。
 */

import { getBodyScope } from '../core/appCore';
import { syncListFromScope } from '../store/listState';
import { syncFolderLock } from '../store/lockState';


// ═══ b1-9bz-A：controllerFns 表体归位（逐字平移；getScope()→getBodyScope()；表项指针化）═══
// —— controllerFns 模块级声明随迁（verbatim；按原声明顺序防 TDZ）——
const electronSettings: any = (window as any).electronSettings;

let preferences: any = (window as any).electronSettings?.getPreferences?.() || {};

const $timeout: any = (fn: any, ms?: number) => setTimeout(() => {
  try { if (typeof fn === 'function') fn(); } finally { try { getBodyScope().$apply(); } catch (err) { /* noop */ } }
}, ms || 0);


const getScope = getBodyScope;  // b1-9bz-A：原 makeControllerFns(getScope) 注入的等价别名

export function focusAppUnlockPassword(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function () {
            setTimeout(() => {
                $("#app-lock-password-input").focus();
            }, 24);
            $("#app-lock-password-input").on("blur", () => {
                setTimeout(() => {
                    $("#app-lock-password-input").focus();
                }, 24);
            });
        }).apply(null, args);
  }

export function focusUnlockPassword(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function () {
            setTimeout(() => {
                $("#lock-password-input").focus();
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
            var password = s.$root.preferences.privacy.password;
            var typingPassword = $("#app-lock-password-input").val();
            var currentPassword = window.atob(password);

            if (keyCode === 13) {

                $timeout(function () {
                    console.log(typingPassword);
                    if (
                        typingPassword === currentPassword || 
                        Registration && Registration.license && typingPassword && typingPassword === Registration.license.code
                    ) {
                        s.$root.isAppLocked = false;
                        $("#app-lock-password-input").val("");
                        $("#app-lock-password-input").off("blur"); // 移除 blur 事件監聽
                        s.$root.initMenu();
                    }
                    else {
                        $("#app-lock-password-input").addClass("animation--shake-horizontal constant");
                        setTimeout(function () {
                            $("#app-lock-password-input").removeClass("animation--shake-horizontal constant");
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
                    s.updateSidebarList();
                    s.calculateImageBinding({ ignoreSort: true }, function () {
                        s.reload();
                        s.updateSelection();
                        s.isLoading = false;
                        s.unlockPassword = "";
                    });
                }
                else {
                    $("#lock-password-input").addClass("animation--shake-horizontal constant");
                    setTimeout(function () {
                        $("#lock-password-input").removeClass("animation--shake-horizontal constant");
                    }, 350);
                }
            }
        }).apply(null, args);
  }
