/**
 * b1-9bx-B：jquery-audio 自研替换（js/vendors/jquery-audio.js 1,068B 退役）。
 * D-2e：命名空间由挂 `$`（jQuery 函数对象）改为 `window.__eagleAudio`（去 jQuery 依赖）。
 *
 * 消费面 = dataMachinery 音效三件套（__eagleAudio.playSound('sounds/*.wav') ×3）。
 * 原实现（jQuery 插件）：playSound = debounce(500, immediate)——连续触发 500ms 窗口内
 * 只建一次；stopSound = 移除全部 .sound-player。本实现去 jQuery 化（vanilla DOM），
 * debounce 语义逐字（immediate=true：窗口首触发立即执行）。
 */

const _w: any = window as any;

let installed = false;

function debounceImmediate(func: (...args: any[]) => any, wait: number): (...args: any[]) => any {
  let timeout: any;
  return function (this: any, ...args: any[]) {
    const context = this;
    const later = () => { timeout = null; };
    const callNow = !timeout;
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    if (callNow) return func.apply(context, args);
  };
}

function playSound(src: string): Element {
  const player = document.createElement('audio');
  player.className = 'sound-player';
  player.setAttribute('autoplay', 'autoplay');
  player.style.display = 'none';
  const source = document.createElement('source');
  source.setAttribute('src', src);
  player.appendChild(source);
  const embed = document.createElement('embed');
  embed.setAttribute('src', src);
  embed.setAttribute('hidden', 'true');
  embed.setAttribute('autostart', 'true');
  embed.setAttribute('loop', 'false');
  player.appendChild(embed);
  document.body.appendChild(player);
  return player;
}

export function installAudioPlugin(): void {
  if (installed) return;
  installed = true;
  if (!_w.__eagleAudio) _w.__eagleAudio = {};
  if (!_w.__eagleAudio.playSound) _w.__eagleAudio.playSound = debounceImmediate(playSound, 500);
  if (!_w.__eagleAudio.stopSound) {
    _w.__eagleAudio.stopSound = function () {
      document.querySelectorAll('.sound-player').forEach((el) => el.remove());
    };
  }
}
