/**
 * b1-9bm：媒体服务 —— 视频族函数归位（自 dataMachinery 逐字搬移；machinery 留委托壳，
 * 挂载面不变）。覆盖：addVideoComment（swal textarea 输入 → comments 落库 + 广播刷新）、
 * getVideoPlayer（mpv 优先 / native 次之双探）、rememberVideoCurrentTime（per-item
 * currentTime 持久化）、videoScreenShot（mpv screenshot API / native drawImage 双路 →
 * 剪贴板或后台窗上送）。组件侧唯一入口：detailHooks 的 addVideoComment ×2 /
 * videoScreenShot ×4、inspectorActions 的 rememberVideoCurrentTime ×2 改直调。
 */
import { getBodyScope } from '../global/scopeBridge';

/* addVideoComment（bundle 21182-21237 逐字：swal textarea（i18n 经 window）→ guid（Tier-2）
   构造 comment（duration/annotation）→ current.comments 插入 + duration 升序排序 →
   REFRESH_VIDEO_COMMENTS 广播 + updateItemView（scope 解析）+ ipcRenderer 统一表达式
   send('image-change')） */
export function mediaAddVideoComment(s: any, video: any, videoElem: any): void {
  const w = window as any;
  if (!video || !videoElem) return;

  videoElem.pause();

  w.swal({
    html: `
                    <div class="alert">
                        <div class="alert-icon create"></div>
                        <h4 class="alert-title">${w.i18n.__('dialog.videoComment.title')}</h4>
                    </div>
                `,
    input: 'textarea',
    inputPlaceholder: w.i18n.__("dialog.videoComment.placeholder"),
    allowEnterKey: false,
    showCloseButton: false,
    showCancelButton: true,
    allowOutsideClick: false,
    focusConfirm: false,
    focusCancel: false,
    padding: 10,
    position: 'bottom',
    width: 400,
    customClass: "alert-box",
    cancelButtonColor: "#777777",
    confirmButtonText: w.i18n.__("dialog.videoComment.save"),
    cancelButtonText: w.i18n.__("general.cancel"),
  }).then(function (result: any) {

    if (!result) return;

    var comment = {
      id: w.guid(),
      duration: videoElem.currentTime,
      annotation: result,
      lastModified: Date.now()
    }

    if (!s.current.comments) {
      s.current.comments = [];
    }

    s.current.comments.push(comment);
    s.current.comments = s.current.comments.sort(function (a: any, b: any) {
      var da = a.duration;
      var db = b.duration;
      if (da > db) return 1;
      if (da < db) return -1;
      return 0;
    })
    s.$root.$broadcast("REFRESH_VIDEO_COMMENTS");
    s.updateItemView(video);
    s.$evalAsync();

    const ipc = w.__eagleIpc || (w.electron && w.electron.ipcRenderer);
    ipc.send('image-change', s.current);
  })
}

/* getVideoPlayer（bundle 36159-36164 逐字，controller 闭包：mpv 优先 native 次之） */
export function mediaGetVideoPlayer(s: any): any {
  const w = window as any;
  var mpv = w.$(".detail-wrap mpv-video")[0];
  if (mpv) return { el: mpv, type: 'mpv' };
  var native = w.$(".detail-wrap video")[0];
  if (native) return { el: native, type: 'native' };
  return null;
}

/* rememberVideoCurrentTime（bundle 31726-31736 逐字：视频类 → getVideoPlayer().el.currentTime
   → eagle.videoPlayer.currentTime.{id} 键） */
export function mediaRememberVideoCurrentTime(s: any, item: any): void {
  const w = window as any;
  if (!item) return;
  if (w.VIDEO_TYPES[item.ext]) {
    var player = mediaGetVideoPlayer(s);
    if (player) {
      var currentTime = player.el.currentTime;
      w.localStorage.setItem("eagle.videoPlayer.currentTime." + item.id, currentTime);
    }
  }
}

/* videoScreenShot（bundle 33233-33288 逐字 async：mpv screenshot API / native drawImage
   双路 → copyMode 剪贴板（electron.nativeImage）或 screencapture-from-extension 上送
   （guid + currentTime.toFixed(2) 命名）） */
export async function mediaVideoScreenShot(s: any, copyMode: any): Promise<void> {
  const w = window as any;
  if (s.current && w.VIDEO_TYPES[s.current.ext]) {

    var player = mediaGetVideoPlayer(s);
    if (!player) return;

    var currentTime = player.el.currentTime;
    var width = s.current.width;
    var height = s.current.height;
    var base64;

    if (player.type === 'mpv') {
      // mpv-video: 使用 screenshot API 取得 ImageData 再轉 base64
      try {
        var imageData = await player.el.screenshot(currentTime);
        if (!imageData) return;
        var canvas = document.createElement('canvas');
        canvas.width = imageData.width;
        canvas.height = imageData.height;
        canvas.getContext('2d')!.putImageData(imageData, 0, 0);
        base64 = canvas.toDataURL("image/jpeg", 0.95);
      } catch (err: any) {
        w.electronLog && w.electronLog.error(err.stack || err);
        return;
      }
    }
    else {
      // native video: 使用 canvas drawImage
      var video = player.el;
      var canvas = document.createElement('canvas');
      var ctx = canvas.getContext('2d')!;
      canvas.width = width;
      canvas.height = height;
      video.setAttribute("crossOrigin", 'Anonymous');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      base64 = canvas.toDataURL("image/jpeg", 0.95);
    }

    if (copyMode) {
      try {
        var nativeImage = w.electron.nativeImage;
        var newImage = nativeImage.createFromDataURL(base64);

        w.electron.clipboard.writeImage(newImage);
        s.notify({
          message: w.i18n.__("previewWindow.copied"),
          duration: 750
        });
      }
      catch (err: any) {
        w.electronLog && w.electronLog.error(err.stack || err);
      }
    }
    else {
      var data = {
        id: w.guid(),
        name: `${s.current.name} - ${currentTime.toFixed(2)}`,
        url: s.current.url || "",
        tags: [],
        modificationTime: s.current.modificationTime + 1 || Date.now(),
        folders: s.current.folders || [],
        base64data: base64,
      };
      const ipc = w.__eagleIpc || (w.electron && w.electron.ipcRenderer);
      ipc.sendTo(w.backgroundWindowID, 'screencapture-from-extension', data);
    }
  }
}
/* ── React 直调便捷面（无 scope 参数版本）——组件侧直调不绕 scope。 */
export function getVideoPlayer(): any {
  const s = getBodyScope();
  return s ? mediaGetVideoPlayer(s) : null;
}

export function rememberVideoCurrentTime(item: any): void {
  const s = getBodyScope();
  if (s) mediaRememberVideoCurrentTime(s, item);
}

export function videoScreenShot(copyMode?: any): Promise<void> {
  const s = getBodyScope();
  if (s) return mediaVideoScreenShot(s, copyMode);
  return Promise.resolve();
}

export function addVideoComment(video: any, videoElem: any): void {
  const s = getBodyScope();
  if (s) mediaAddVideoComment(s, video, videoElem);
}
