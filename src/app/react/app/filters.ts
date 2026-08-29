/**
 * 过滤器移植 —— 逐字转写自 app.bundle.js（机械转换，不重写语义）。
 *
 * 说明：所有函数体从 bundle 内对应 filter 声明原文照搬，仅替换 Angular 依赖注入为显式参数。
 */

export function numberFixedLen(a: any, b: number): string {
  const d = String(a).length;
  const max = Math.max(d, b);
  return (1e9 + '' + a).slice(-max);
}

export function noZero(number: any): any {
  if (number == '0') return '';
  return number;
}

export function longTitle(name: any): string {
  if (name && name.length > 12) return name;
  return '';
}

export function unique(items: any, filterOn?: any): any {
  if (filterOn === false) return items;
  if ((filterOn || filterOn === undefined) && Array.isArray(items)) {
    const newItems: any[] = [];
    const extractValueToCompare = (item: any) => {
      if (item && typeof filterOn === 'string') return item[filterOn];
      return item;
    };
    items.forEach((item: any) => {
      let isDuplicate = false;
      for (let i = 0; i < newItems.length; i++) {
        if (JSON.stringify(extractValueToCompare(newItems[i])) === JSON.stringify(extractValueToCompare(item))) {
          isDuplicate = true;
          break;
        }
      }
      if (!isDuplicate) newItems.push(item);
    });
    items = newItems;
  }
  return items;
}

export function encodeHash(url: string): string {
  if (url) return url.replace(/#/g, '%23');
  return url;
}

export function second2time(second: number): string {
  if (second > 0) {
    const sec_num = parseInt(String(second), 10);
    const hours = Math.floor(sec_num / 3600);
    const minutes = Math.floor((sec_num - hours * 3600) / 60);
    const seconds = sec_num - hours * 3600 - minutes * 60;

    let h = hours < 10 ? '' + hours : '' + hours;
    let m = minutes < 10 ? '0' + minutes : '' + minutes;
    let s = seconds < 10 ? '0' + seconds : '' + seconds;

    if (hours && minutes) return `${h}:${m}:${s}`;
    else if (!hours && minutes) return `${m}:${s}`;
    else if (!hours && !minutes) return s;
  }
  return '';
}

export function duration(str: any): string {
  try {
    if (str) {
      const date = new Date(0);
      const seconds = Math.max(1, parseInt(str));
      date.setSeconds(seconds);
      if (seconds < 3600) return date.toISOString().substr(14, 5);
      else return date.toISOString().substr(11, 8);
    }
  } catch (err) {}
  return '';
}

export function domainName(url: string): string {
  if (!url) return '';
  const a = document.createElement('a');
  a.href = url;
  return a.hostname.toLowerCase();
}

export function encodeURIComponent(url: string): string {
  return encodeURIComponent(url);
}

export function encodeURIComponentUrl(url: string): string {
  const a = encodeURIComponent(url);
  return a.replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

export function substring(input: any, start?: number, end?: number): string {
  if (!input || !input?.substring) return '';
  return input.substring(start, end);
}

export function thumbnailExt(ext: string): string {
  if (ext === 'svg') return 'svg';
  return 'png';
}

export function mod(key: string): string {
  if ((window as any).process?.platform !== 'darwin') return 'Ctrl';
  return '⌘';
}

export function numberAbbreviate(input: number): string | null {
  if (isNaN(input)) return null;
  if (input < 1000) return String(input);
  if (input >= 1000 && input < 1000000) return (input / 1000).toFixed(1) + 'K';
  if (input >= 1000000 && input < 1000000000) return (input / 1000000).toFixed(1) + 'M';
  if (input >= 1000000000) return (input / 1000000000).toFixed(1) + 'B';
  return null;
}

export function shortcuts(key: string): string {
  if (!key) return '';
  const platform = (window as any).process?.platform;
  if (platform != 'darwin') {
    return key.replace('CommandOrControl', 'Ctrl').replace('CmdOrCtrl', 'Ctrl').replace('⌘', 'Ctrl');
  } else {
    return key
      .replace(/\+/g, ' ')
      .replace('CommandOrControl', '⌘')
      .replace('CmdOrCtrl', '⌘')
      .replace('Command', '⌘')
      .replace('Ctrl', '⌘')
      .replace('Shift', '⇧')
      .replace('Alt', '⌥')
      .replace('Delete', '⌫')
      .replace('Control', '⌃')
      .replace('Option', '⌥')
      .replace('Backspace', '⌫');
  }
}

export function shortcutsWrapper(shortcut: string): string {
  if (!shortcut) return '';
  if (shortcut.includes('<key>') && shortcut.includes('</key>')) return shortcut;
  return shortcut
    .replace(/\+/g, '')
    .split(' ')
    .filter((key) => key.trim().length > 0)
    .map((key) => '<key>' + key.trim() + '</key>')
    .join(' ');
}

export function filesize(bytes: number): string {
  const units = ['bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
  if (isNaN(parseFloat(String(bytes))) || !isFinite(bytes)) return '?';
  let unit = 0;
  let k = 1024;
  if ((window as any).process?.platform === 'darwin') k = 1000;
  while (bytes >= k) {
    bytes /= k;
    unit++;
  }
  return bytes.toFixed(2) + ' ' + units[unit];
}

export function themePath(theme: string): string {
  if (theme === 'light' || theme === 'lightgray') return 'light';
  return 'dark';
}

// eslint-disable-next-line @typescript-eslint/no-var-requires
const colorConvert = (globalThis as any).colorConvert;
const maxNum = (a: number, b: number) => (a > b ? a : b);

export function sortHSL(palettes: any[]): any[] | undefined {
  try {
    if (!palettes) return undefined;
    const getHSL = (color: any) => {
      const [r, g, b] = [color[0], color[1], color[2]];
      const hsl = colorConvert.rgb.hsl(r, g, b);
      const [h, s, l] = [hsl[0], hsl[1], hsl[2]];
      return [h, s, l] as any;
    };
    const maxRatioPalette = palettes.reduce((prev, curr) => (prev.ratio > curr.ratio ? prev : curr));
    const maxRatio = maxRatioPalette.ratio;
    const maxRatioHSL = getHSL(maxRatioPalette.color);
    let others = palettes.filter((color) => color.ratio !== maxRatio);
    others = others.sort((a, b) => {
      const hslA = getHSL(a.color);
      const hslB = getHSL(b.color);
      const hADiff = Math.abs(hslA[0] - maxRatioHSL[0]);
      const hBDiff = Math.abs(hslB[0] - maxRatioHSL[0]);
      const sADiff = Math.abs(hslA[1] - maxRatioHSL[1]);
      const sBDiff = Math.abs(hslB[1] - maxRatioHSL[1]);
      const lADiff = Math.abs(hslA[2] - maxRatioHSL[2]);
      const lBDiff = Math.abs(hslB[2] - maxRatioHSL[2]);
      if (Math.abs(hADiff - hBDiff) >= 30) return hADiff - hBDiff;
      else if (Math.abs(sADiff - sBDiff) >= 10) return sADiff - sBDiff;
      else return lADiff - lBDiff;
    });
    return [maxRatioPalette, ...others];
  } catch (err) {
    return palettes.sort((a, b) => a.ratio - b.ratio);
  }
}
