import { eagle } from './eagleRef';

/**
 * R5：`js/lib/api/swal-dialog.js`（264 行）的 TS 移植 —— `eagle.dialog`。
 *
 * 这是**浏览器扩展侧的对话框门面**（把请求 postMessage 给 `dialog/index.html` iframe）。
 * 在 Electron 采集窗里它只被 `env.isReady()` 调用，而 `isReady()` 本窗无调用方（R5 探针实证），
 * 故整条链路不可达；本模块随原脚本安装以保持 `window.eagle` 键集不变（install.ts 断言）。
 *
 * 两处原著缺陷**逐字保留**（不擅自修）：
 *  - `selfRemove()` / `waitIframeReady()` 里 `let listener = window.addEventListener(...)`，
 *    而 addEventListener 返回 undefined → `removeEventListener('message', undefined)` 实为 no-op。
 *  - `onConfirm.constructor.name === 'AsyncFunction'` 的 typeof 判定写法。
 * `eagle.extension` / `eagle.preference` / `eagle.tabs` 在本窗从未提供（探针实测 undefined），
 * 与原脚本一致。
 */
export class SwalDialog {
  #dialogWrapperID = 'eagle-swal-dialog-wrapper';
  #dialogIframeID = 'eagle-extension-dialog-window';

  async open({ icon = '', title, description = '', inputType, inputPlaceholder, inputValue, confirmButtonText, cancelButtonText, onConfirm, onCancel, showCancelButton }: any): Promise<void> {
    onConfirm = onConfirm || async function () {};
    onCancel = onCancel || async function () {};

    const iframe = document.createElement('iframe');
    iframe.src = eagle.extension.path + 'dialog/index.html';
    iframe.id = this.#dialogIframeID;
    document.body.appendChild(iframe);

    if (icon) {
      icon = eagle.extension.path + icon;
    }

    const options: any = {
      html: `
				<div class="alert">
					<img class="alert-icon" src="${icon}"></img>
					<h4 class="alert-title">${title}</h4>
					<p class="alert-desc">${description}</p>
				</div>
			`,
      customClass: 'alert-box',
      showCloseButton: false,
      allowOutsideClick: true,
      focusConfirm: true,
      focusCancel: false,
      padding: 24,
      target: `#${this.#dialogWrapperID}`,
      theme: eagle.preference.displayTheme,
    };

    if (typeof showCancelButton !== 'undefined') {
      options.showCancelButton = showCancelButton;
    }

    if (typeof confirmButtonText !== 'undefined') {
      options.showConfirmButton = true;
      options.confirmButtonText = confirmButtonText;
    }

    if (typeof cancelButtonText !== 'undefined') {
      options.showCancelButton = true;
      options.cancelButtonText = cancelButtonText;
    }

    if (inputType) {
      options.inputValue = inputValue;
      options.inputPlaceholder = inputPlaceholder;
      options.input = inputType;
    }

    await this.waitIframeReady(iframe);

    iframe.contentWindow!.postMessage({ channel: 'swal-open', options }, '*');

    function selfRemove() {
      iframe.remove();
      window.removeEventListener('message', listener);
    }

    const closeDialog = () => {
      setTimeout(() => {
        selfRemove();
      }, 200);
    };

    // listen for messages from the iframe
    const listener: any = window.addEventListener('message', async (event: any) => {
      // 如果 iframe 不存在，就不處理
      if (!iframe) {
        return;
      }

      // 這個訊息不是由使用者代理所創建的
      if (event.isTrusted === false) {
        return;
      }

      // 這個訊息不是由 iframe 所傳送的 (例如別人家的事件)
      if (event.source !== iframe.contentWindow) {
        return;
      }

      // 沒有 channel 的話，就不處理
      if (!event.data.channel) {
        return;
      }

      const channel = event.data.channel;

      if (channel === 'swal-confirm') {
        onConfirm.constructor.name === 'AsyncFunction' ? await onConfirm(event.data.result) : onConfirm(event.data.result);
        closeDialog();
      }

      if (channel === 'swal-cancel') {
        onCancel.constructor.name === 'AsyncFunction' ? await onCancel() : onCancel();
        closeDialog();
      }
    });
  }

  close(): void {
    const iframe = document.getElementById(this.#dialogIframeID);
    if (iframe) iframe.remove();
  }

  /** 等待 iframe 載入完成 */
  async waitIframeReady(iframe: HTMLIFrameElement): Promise<void> {
    return new Promise((resolve) => {
      const listener: any = window.addEventListener('message', (event: any) => {
        if (event.data === 'dialog-iframe-ready' && event.source === iframe.contentWindow) {
          resolve();
          window.removeEventListener('message', listener);
        }
      });
    });
  }

  showCreateFolderDialog(inputValue: any): Promise<any> {
    return new Promise((resolve) => {
      this.open({
        title: eagle.i18n.words['collect-window.folder-select-panel.create-dialog.title'],
        icon: 'images/default_icon.png',
        confirmButtonText: eagle.i18n.words['collect-window.folder-select-panel.create-dialog.confirm'],
        cancelButtonText: eagle.i18n.words['collect-window.folder-select-panel.create-dialog.cancel'],
        inputType: 'text',
        inputValue: inputValue,
        inputPlaceholder: eagle.i18n.words['collect-window.folder-select-panel.create-dialog.placeholder'],
        onConfirm: (result: any) => {
          resolve(result);
        },
        onCancel: () => {
          resolve(null);
        },
      });
    });
  }

  /** 顯示「有多個Eagle 擴充功能」同時運行的提示 */
  showMultipleEagleExtensionRunningDialog(): void {
    const dialogIcon = `images/${eagle.preference.displayTheme}/eagle-not-opened.png`;

    this.open({
      icon: dialogIcon,
      title: eagle.i18n.words['dialog.multiple-extensions-running.title'],
      description: eagle.i18n.words['dialog.multiple-extensions-running.desc'],
      confirmButtonText: eagle.i18n.words['dialog.multiple-extensions-running.confirm'],
      showCancelButton: false,
      onConfirm: () => {
        eagle.tabs.create({ url: 'chrome://extensions' });
      },
    });
  }

  /** 顯示 Eagle 尚未開啟的提示 */
  showEagleNotOpenedDialog(): void {
    const dialogIcon = `images/${eagle.preference.displayTheme}/eagle-not-opened.png`;

    this.open({
      icon: dialogIcon,
      title: eagle.i18n.words['dialog.not-opened-title'],
      description: eagle.i18n.words['dialog.not-opened-desc'],
      confirmButtonText: eagle.i18n.words['dialog.not-opened-confirm'],
      cancelButtonText: eagle.i18n.words['dialog.not-opened-cancel'],
      onConfirm: () => {
        const stale = document.getElementById('open-eagle-iframe');
        if (stale) stale.remove();

        const iframe = document.createElement('iframe');
        iframe.id = 'open-eagle-iframe';
        iframe.src = 'eagle://open';
        iframe.name = 'frame';

        // R5：原 $(iframe).css({h:0,w:0,opacity:0})——h/w 不是合法 CSS 属性，jQuery 的
        // .css() 会静默忽略，实际只有 opacity 生效；Native 等价即只设 opacity。
        iframe.style.opacity = '0';

        document.body.appendChild(iframe);

        setTimeout(() => {
          const el = document.getElementById('open-eagle-iframe');
          if (el) el.remove();
        }, 2000);
      },
    });
  }

  /** 顯示 Eagle 背景更新提示 */
  showRuntimeUpdatedDialog(): void {
    const dialogIcon = `images/${eagle.preference.displayTheme}/eagle-not-opened.png`;

    this.open({
      icon: dialogIcon,
      title: eagle.i18n.words['dialog.updated-title'],
      description: eagle.i18n.words['dialog.updated-desc'],
      confirmButtonText: eagle.i18n.words['dialog.updated-confirm'],
      cancelButtonText: eagle.i18n.words['dialog.updated-cancel'],
      onConfirm: () => {
        // 重新整理頁面
        location.reload();
      },
    });
  }

  /** 顯示隱私權政策 (Firefox only) */
  showPrivacyPolicyDialog(): void {
    const dialogIcon = `images/${eagle.preference.displayTheme}/eagle-not-opened.png`;

    this.open({
      icon: dialogIcon,
      title: eagle.i18n.words['dialog.privacy-policy-title'],
      description: eagle.i18n.words['dialog.privacy-policy-desc'],
      confirmButtonText: eagle.i18n.words['dialog.privacy-policy-confirm'],
      cancelButtonText: eagle.i18n.words['dialog.privacy-policy-cancel'],
      onConfirm: () => {
        // 更新偏好設定
        eagle.preference.agreePrivacyPolicy = true;
        eagle.preference.save();

        // 重新整理頁面
        location.reload();
      },
    });
  }

  showBoardSaverKeepWaitingDialog({ onConfirm, onCancel }: any): void {
    const dialogIcon = `images/${eagle.preference.displayTheme}/eagle-not-opened.png`;

    this.open({
      icon: dialogIcon,
      title: eagle.i18n.words['dialog.board-saver-keep-waiting.title'],
      description: eagle.i18n.words['dialog.board-saver-keep-waiting.desc'],
      confirmButtonText: eagle.i18n.words['dialog.board-saver-keep-waiting.confirm'],
      cancelButtonText: eagle.i18n.words['dialog.board-saver-keep-waiting.cancel'],
      showCancelButton: true,
      onConfirm: onConfirm,
      onCancel: onCancel,
    });
  }
}
