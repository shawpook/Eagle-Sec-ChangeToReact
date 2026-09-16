/**
 * M3-1（批次 1）：智能筛选规则函数（26 个 `isMatch*Rule` + 工具函数）。
 *
 * 来源：`frontend/public/vendor/eagle-match-rules.js` L33-1067（原 bundle 8369-9418）。
 * 只搬 L33-1067：该文件 **L1068-1084 是三个第三方小库**（is.js 0.9.0 / bignumber.js
 * v9.0.0 / Mailcheck v1.1.2，均 MIT），其中 Mailcheck 正文在上游提取时就被切在范围外，
 * 属**被切断的提取副本**——补齐等于伪造第三方产物，删除则违反「未确认消费者的旧代码
 * 不得删」。故 vendor 文件**一字不改**，本模块与它并存。
 *
 * ── 搬迁中三处「隐式全局 → 显式读取」的处置（行为等价性由等价性测试锁死）──
 *
 * ① L56-58 的 `$bodyScope`：原样保留 `window.__eagleDriver || window.$bodyScope`，
 *    只把结果收窄为结构化类型（`global/globals.d.ts:11` 只把它声明成 `any`，
 *    且 `__eagleDriver` 未声明；本批只允许新增 `core/rules/**`，故不动 d.ts）。
 *
 * ② L819-821 的 `window.require('color-convert')` / `('delta-e')`：
 *    **不在模块顶层解构**。`bundleGlobals.ts:1501-1502` 的 `w.colorConvert`/`w.DeltaE`
 *    是 `installBundleGlobals()`（`:1421`）**函数体内**赋值到 `window` 的，
 *    `bundleGlobals.ts` 本身**只 export `installBundleGlobals`**——顶层
 *    `import { colorConvert } from '../bundleGlobals'` 必然拿到 `undefined`。
 *    → 一律经 `bundleGlobal()` 在**调用期**读取。
 *
 * ③ L1055/L1058 的裸全局 `installedFonts`，以及 `isMatchTypeRule` 依赖的
 *    `VIDEO_TYPES`/`AUDIO_TYPES`/`FONT_TYPES`（`bundleGlobals.ts:1444-1454`，
 *    同样是函数体内赋值到 `window`）：一并改为调用期读取。
 *
 *    `bundleGlobal()` 在缺席时**显式抛 ReferenceError**（复刻裸标识符的失败类别），
 *    而不是退化成 `undefined` 让后面的属性访问抛 TypeError —— 26 个规则里 8 个自带
 *    `try/catch`、其余由 `filterDomain.ts:1520-1522` 兜底，失败类别一致才能保证
 *    「改错了会在同一点以同一方式暴露」。
 *
 * ── 与 vendor 的既有差异（搬迁引入，已登记，非等价性测试覆盖范围）──
 * vendor 在**脚本装载期**执行 `window.require('color-convert')`：若那一刻依赖不可用，
 * 整个 vendor 脚本死掉，26 个 `isMatch*Rule` 全部是 `undefined`。本模块把读取推迟到
 * 调用期，依赖不可用时**只有 `color` 规则**以 ReferenceError 失败。
 * 即：失败更晚、更窄，不会更糟。
 */
import { matchStringMethod } from './matchStringMethod';

export type { MatchStringMethodFn } from './matchStringMethod';

// ─────────────────────────── 输入类型 ───────────────────────────

export interface RuleComment {
  annotation?: string;
}

export interface RulePalette {
  ratio: number;
  color: number[];
}

export interface RuleRawMetas {
  camera?: string;
  isoSpeed?: string | number;
  aperture?: string;
  focalLength?: string;
  shutter?: string;
  timestamp?: string | number;
}

export interface RuleFontMetas {
  postScriptName?: Record<string, string>;
}

/**
 * 规则判定的图片视图。字段**全部可选**：vendor 对多数字段只做「读出来再比较」，
 * 缺席时靠 `undefined` 参与比较得出 false，并不存在「必填」契约。
 */
export interface RuleImage {
  name?: string;
  url?: string;
  ext?: string;
  annotation?: string;
  medium?: string;
  width?: number;
  height?: number;
  size?: number;
  duration?: number;
  bpm?: number;
  star?: number;
  modificationTime?: number;
  mtime?: number;
  btime?: number;
  tags?: string[];
  folders?: string[];
  comments?: RuleComment[];
  palettes?: RulePalette[];
  rawMetas?: RuleRawMetas;
  fontMetas?: RuleFontMetas;
}

export interface MatchRule {
  property?: string;
  method?: string;
  unit?: string;
  /**
   * 形状由各规则自行解释：字符串类规则当 `string` 用，数值/时间类当元组下标用
   * （`value[0]`/`value[1]`）。与 vendor 一致：**没有任何运行期校验**，
   * 形状不对就在读取处抛错，由各规则自带的 `try/catch` 或调用方兜底。
   */
  value?: string | (string | number)[];
  width?: number;
  height?: number;
}

export type MatchRuleFn = (rule: MatchRule, image: RuleImage) => boolean;

// ─────────────────── bundle 全局的调用期读取 ───────────────────

/**
 * 调用期读取 `bundleGlobals` 安装到 `window` 的全局（见文件头 ② ③）。
 *
 * 缺席时抛 **ReferenceError**：vendor 里这些是裸标识符（`VIDEO_TYPES`）或装载期词法绑定
 * （`colorConvert`），缺席时正是 ReferenceError。类型上不做静默降级。
 */
function bundleGlobal<T>(name: string): T {
  const holder = window as unknown as Record<string, unknown>;
  if (!(name in holder)) throw new ReferenceError(`${name} is not defined`);
  return holder[name] as T;
}

interface DriverFolder {
  name?: string;
}

interface DriverScope {
  folderMappings?: Record<string, DriverFolder | undefined>;
}

/** vendor L56-58 的驱动面（`__eagleDriver` 优先于 `$bodyScope`，都没有则为 null）。 */
function driverScope(): DriverScope | null {
  const w = window as unknown as { __eagleDriver?: DriverScope; $bodyScope?: DriverScope };
  return w.__eagleDriver || w.$bodyScope || null;
}

// ─────────────────────── 字符串类规则 ───────────────────────

export function isMatchNameRule(rule: MatchRule, image: RuleImage): boolean {

  const method = rule.method; 	// equal, startWith, endWith, unequal, contain
  let name = image.name && image.name.toLowerCase();
  const value = (rule.value as string | undefined) && (rule.value as string).toLowerCase();

  if (!name) name = "";
  if (method !== 'empty' && method !== 'not-empty' && value == '') return false;
  const fn = matchStringMethod[method as string];
  if (fn) {
    return fn(name, value);
  }
  return false;
}

export function isMatchFolderNameRule(rule: MatchRule, item: RuleImage): boolean {

  const method = rule.method; 	// equal, startWith, endWith, unequal, contain
  const value = (rule.value as string | undefined) && (rule.value as string).toLowerCase();

  if (!item?.folders?.length) return false;

  for (let i = 0; i < item.folders.length; i++) {
    const folderId = item.folders[i];
    // b1-9bz-E5-4：原裸 $bodyScope 全局 → 显式驱动面（主窗 main.tsx 装 __eagleDriver）。
    const _bs = driverScope();
    const folder = _bs && _bs.folderMappings ? _bs.folderMappings[folderId] : null;
    let name = folder?.name;
    if (!name) name = "";
    name = name.toLowerCase();
    if (method !== 'empty' && method !== 'not-empty' && value == '') return false;
    const fn = matchStringMethod[method as string];
    if (fn) {
      const isMatch = fn(name, value);
      if (isMatch) return true;
    }
  }

  return false;
}

export function isMatchUrlRule(rule: MatchRule, image: RuleImage): boolean {

  const method = rule.method; 	// equal, startWith, endWith, unequal, contain
  let url = image.url && image.url.toLowerCase();
  const value = (rule.value as string | undefined) && (rule.value as string).toLowerCase();

  if (!url) url = "";
  if (method !== 'empty' && method !== 'not-empty' && value == '') return false;

  const fn = matchStringMethod[method as string];
  if (fn) {
    return fn(url, value);
  }
  return false;
}

export function isMatchAnnotationRule(rule: MatchRule, image: RuleImage): boolean {

  const method = rule.method; 	// equal, startWith, endWith, unequal, contain
  let annotation = image.annotation && image.annotation.toLowerCase();
  const value = (rule.value as string | undefined) && (rule.value as string).toLowerCase();

  if (!annotation) annotation = "";
  if (method !== 'empty' && method !== 'not-empty' && value == '') return false;

  const fn = matchStringMethod[method as string];
  if (fn) {
    return fn(annotation, value);
  }
  return false;
}

export function isMatchCameraRule(rule: MatchRule, image: RuleImage): boolean {

  const method = rule.method; 	// equal, startWith, endWith, unequal, contain
  if (!image.rawMetas || !image.rawMetas.camera) return false;
  let camera = image.rawMetas.camera && image.rawMetas.camera.toLowerCase();
  const value = (rule.value as string | undefined) && (rule.value as string).toLowerCase();

  if (!camera) camera = "";
  if (method !== 'empty' && method !== 'not-empty' && value == '') return false;

  const fn = matchStringMethod[method as string];
  if (fn) {
    return fn(camera, value);
  }
  return false;
}

// ─────────────────────── 数值类规则 ───────────────────────

export function isMatchWidthRule(rule: MatchRule, image: RuleImage): boolean {
  try {
    const method = rule.method; 	// equal, startWith, endWith, unequal, contain
    // vendor 不做存在性校验（`if (!width && width > 0)` 恒不成立），缺席时靠 NaN 比较
    // 得出 false —— 这里显式收窄只是标注，运行期取值与 vendor 完全一致。
    const width = image.width as number;
    const values = rule.value as (string | number)[];
    const value1 = values[0] as number;
    const value2 = values[1] as number;

    if (!width && width > 0) return false;

    switch (method) {
      case '=':
        return width === value1;
      case '>=':
        return width >= value1;
      case '<=':
        return width <= value1;
      case '>':
        return width > value1;
      case '<':
        return width < value1;
      case 'between':
        return value1 <= width && width <= value2;
    }
    return false;
  }
  catch (err) {
    return false;
  }
}

export function isMatchHeightRule(rule: MatchRule, image: RuleImage): boolean {
  try {
    const method = rule.method; 	// equal, startWith, endWith, unequal, contain
    const height = image.height as number;
    const values = rule.value as (string | number)[];
    const value1 = values[0] as number;
    const value2 = values[1] as number;

    if (!height && height > 0) return false;

    switch (method) {
      case '=':
        return height === value1;
      case '>=':
        return height >= value1;
      case '<=':
        return height <= value1;
      case '>':
        return height > value1;
      case '<':
        return height < value1;
      case 'between':
        return value1 <= height && height <= value2;
    }
    return false;
  }
  catch (err) {
    return false;
  }
}

export function isMatchFileSizeRule(rule: MatchRule, image: RuleImage): boolean {
  try {
    const method = rule.method; 	// equal, startWith, endWith, unequal, contain
    let size = image.size as number;
    const values = rule.value as (string | number)[];
    const value1 = values[0] as number;
    const value2 = values[1] as number;
    const unit = rule.unit;

    if (unit === 'kb') {
      size = size / 1024;
    }
    else {
      size = size / 1024 / 1024;
    }

    if (!size && size > 0) return false;

    switch (method) {
      case '=':
        return size === value1;
      case '>=':
        return size >= value1;
      case '<=':
        return size <= value1;
      case '>':
        return size > value1;
      case '<':
        return size < value1;
      case 'between':
        return value1 <= size && size <= value2;
    }
    return false;
  }
  catch (err) {
    return false;
  }
}

export function isMatchDurationRule(rule: MatchRule, image: RuleImage): boolean {
  try {
    const method = rule.method; 	// equal, startWith, endWith, unequal, contain
    let duration = image.duration;

    if (!duration) return false;

    const values = rule.value as (string | number)[];
    const value1 = values[0] as number;
    const value2 = values[1] as number;
    const unit = rule.unit;

    if (unit === 'h') {
      duration = duration / 60 / 60;
    }
    else if (unit === 'm') {
      duration = duration / 60;
    }

    if (!duration && duration > 0) return false;

    switch (method) {
      case '=':
        return duration === value1;
      case '>=':
        return duration >= value1;
      case '<=':
        return duration <= value1;
      case '>':
        return duration > value1;
      case '<':
        return duration < value1;
      case 'between':
        return value1 <= duration && duration <= value2;
    }
    return false;
  }
  catch (err) {
    return false;
  }
}

export function isMatchBPMRule(rule: MatchRule, image: RuleImage): boolean {
  try {
    const method = rule.method; 	// equal, startWith, endWith, unequal, contain
    const bpm = image.bpm;

    if (!bpm) return false;

    const values = rule.value as (string | number)[];
    const value1 = values[0] as number;
    const value2 = values[1] as number;
    const unit = rule.unit;

    if (!bpm) return false;

    switch (method) {
      case '=':
        return bpm === value1;
      case '>=':
        return bpm >= value1;
      case '<=':
        return bpm <= value1;
      case '>':
        return bpm > value1;
      case '<':
        return bpm < value1;
      case 'between':
        return value1 <= bpm && bpm <= value2;
    }
    return false;

  }
  catch (err) {
    return false;
  }
}

// ─────────────────────── 时间类规则 ───────────────────────

export function isMatchTimeRule(rule: MatchRule, image: RuleImage): boolean {
  try {
    const method = rule.method; 	// equal, startWith, endWith, unequal, contain
    const modificationTime = image.modificationTime;
    const values = rule.value as (string | number)[];
    const value1 = values[0] as number;
    const value2 = values[1] as number;

    if (!modificationTime) return false;
    const DAY = 1000 * 60 * 60 * 24;
    switch (method) {
      case 'on':
        // 使用 toDateString() 判断同一天
        return new Date(modificationTime).toDateString() == new Date(value1).toDateString();
      case 'before':
        return modificationTime <= value1 + DAY;
      case 'after':
        return modificationTime >= value1;
      case 'between':
        return value1 <= modificationTime && modificationTime <= value2 + DAY;
      case 'within':
        {
          const days = value1;
          return modificationTime + days * DAY >= Date.now();
        }
    }
    return false;
  }
  catch (err) {
    return false;
  }
}

export function isMatchMTimeRule(rule: MatchRule, image: RuleImage): boolean {
  try {
    const method = rule.method; 	// equal, startWith, endWith, unequal, contain
    const mtime = image.mtime || image.modificationTime;
    const values = rule.value as (string | number)[];
    const value1 = values[0] as number;
    const value2 = values[1] as number;

    if (!mtime) return false;
    const DAY = 1000 * 60 * 60 * 24;
    switch (method) {
      case 'on':
        // 使用 toDateString() 判断同一天
        return new Date(mtime).toDateString() == new Date(value1).toDateString();
      case 'before':
        return mtime <= value1 + DAY;
      case 'after':
        return mtime >= value1;
      case 'between':
        return value1 <= mtime && mtime <= value2 + DAY;
      case 'within':
        {
          const days = value1;
          return mtime + days * DAY >= Date.now();
        }
    }
    return false;
  }
  catch (err) {
    return false;
  }
}

export function isMatchBTimeRule(rule: MatchRule, image: RuleImage): boolean {
  try {
    const method = rule.method; 	// equal, startWith, endWith, unequal, contain
    const btime = image.btime || image.modificationTime;
    const values = rule.value as (string | number)[];
    const value1 = values[0] as number;
    const value2 = values[1] as number;

    if (!btime) return false;
    const DAY = 1000 * 60 * 60 * 24;
    switch (method) {
      case 'on':
        // 使用 toDateString() 判断同一天
        return new Date(btime).toDateString() == new Date(value1).toDateString();
      case 'before':
        return btime <= value1 + DAY;
      case 'after':
        return btime >= value1;
      case 'between':
        return value1 <= btime && btime <= value2 + DAY;
      case 'within':
        {
          const days = value1;
          return btime + days * DAY >= Date.now();
        }
    }
    return false;
  }
  catch (err) {
    return false;
  }
}

// ─────────────────────── 集合/枚举类规则 ───────────────────────

export function intersect<T extends string | number>(arr1: T[], arr2: T[]): T[] {
  const temp: Record<string, boolean> = {};
  const result: T[] = [];
  // vendor 用 `temp[arr1[i]]` 直接做对象键——JS 的键一律走 ToString，
  // 这里显式 `String(...)` 只是把同一强制转换写出来，取值完全一致。
  for (let i = 0; i < arr1.length; i++) { temp[String(arr1[i])] = true; }
  for (let j = 0; j < arr2.length; j++) {
    if (temp[String(arr2[j])] === true) {
      result.push(arr2[j]);
    }
  }
  return result;
}

export function isMatchCommentsRule(rule: MatchRule, image: RuleImage): boolean {

  if (!image) { return false; }

  const method = rule.method; 	// intersection, union
  const comments = image.comments as RuleComment[];
  let commentString = "";
  const value = rule.value as string;

  if (method === 'empty') {
    if (!image.comments || image.comments.length === 0) {
      return true;
    }
  }
  else if (method === 'not-empty') {
    if (image.comments && image.comments.length > 0) {
      return true;
    }
  }
  else {

    if (!image || !image.comments) { return false; }

    for (let i = 0; i < comments.length; i++) {
      commentString += comments[i].annotation as string;
    }
    switch (method) {
      case 'equal':
        return commentString === value;
      case 'startWith':
        {
          const isStartWith = new RegExp(`^${value}`, 'i').test(commentString);
          return isStartWith;
        }
      case 'endWith':
        {
          const isEndWith = new RegExp(`${value}$`, 'i').test(commentString);
          return isEndWith;
        }
      case 'uncontain':
        return commentString.indexOf(value) === -1;
      case 'contain':
        return commentString.indexOf(value) !== -1;
      case 'regex':
        try { return new RegExp(value, "g").test(commentString); }
        catch (err) { return false; }
    }
  }
  return false;
}

export function isMatchTagsRule(rule: MatchRule, image: RuleImage): boolean {

  if (!image) { return false; }
  if (!image.tags) return false;

  const method = rule.method; 	// intersection, union
  const tags = image.tags;
  const value = rule.value as string[];

  if (method === 'empty') {
    if (!image.tags || image.tags.length === 0) {
      return true;
    }
  }
  else if (method === 'not-empty') {
    if (image.tags && image.tags.length > 0) {
      return true;
    }
  }
  else {
    // 两阵列取交集长度一样表示符合
    const isIntersect = intersect(tags, value).length === value.length && value.length != 0;
    let isUnion = false;

    for (let i = 0; i < tags.length; i++) {
      if (value.indexOf(tags[i]) !== -1) {
        isUnion = true;
        break;
      }
    }

    switch (method) {
      case 'intersection':
        return isIntersect;
      case 'equal':
        return isIntersect && tags.length === value.length;
      case 'union':
        return isUnion;
      case 'identity':
        return !isUnion;
    }
  }
  return false;
}

export function isMatchFoldersRule(rule: MatchRule, image: RuleImage): boolean {

  if (!image || !image.folders) { return false; }

  const method = rule.method; 	// intersection, union
  const folders = image.folders;
  const value = rule.value as string[];

  if (method === 'empty') {
    if (!folders || folders.length === 0) {
      return true;
    }
  }
  else if (method === 'not-empty') {
    if (folders && folders.length > 0) {
      return true;
    }
  }
  else {
    // 两阵列取交集长度一样表示符合
    const isIntersect = intersect(folders, value).length === value.length;
    let isUnion = false;

    for (let i = 0; i < folders.length; i++) {
      if (value.indexOf(folders[i]) !== -1) {
        isUnion = true;
        break;
      }
    }

    switch (method) {
      case 'intersection':
        return isIntersect;
      case 'equal':
        return isIntersect && folders.length === value.length;
      case 'union':
        return isUnion;
      case 'identity':
        return !isUnion;
    }
  }
  return false;
}

export function isMatchTypeRule(rule: MatchRule, image: RuleImage): boolean {

  const ext = image.ext;
  let result = false;

  if (ext === rule.value) {
    return (rule.method === "equal");
  }

  switch (rule.value) {
    case "videos":
    case "video":
      result = bundleGlobal<Record<string, boolean>>('VIDEO_TYPES')[ext as string];
      break;
    case "audio":
      result = bundleGlobal<Record<string, boolean>>('AUDIO_TYPES')[ext as string];
      break;
    case "powerpoint":
      if (ext == 'ppt' || ext == 'pptx' || ext == 'potx') result = true;
      break;
    case "presentation":
      if (ext == 'ppt' || ext == 'key' || ext == 'pptx') result = true;
      break;
    case "excel":
      if (ext == 'xls' || ext == 'xlsx') result = true;
      break;
    case "word":
      if (ext == 'doc' || ext == 'docx') result = true;
      break;
    case "font":
      result = bundleGlobal<Record<string, boolean>>('FONT_TYPES')[ext as string];
      break;
    case "url":
      if (ext == 'url' && !image.medium) result = true;
      break;
    case "youtube":
      if (ext == 'url' && image.medium == 'youtube') result = true;
      break;
    case "vimeo":
      if (ext == 'url' && image.medium == 'vimeo') result = true;
      break;
    case "bilibili":
      if (ext == 'url' && image.medium == 'bilibili') result = true;
      break;
    default:
      result = (ext === rule.value);
      break;
  }

  switch (rule.method) {
    case 'equal':
      return result;
    case 'unequal':
      return !result;
  }
  return false;
}

export function isMatchRatingRule(rule: MatchRule, image: RuleImage): boolean {
  try {
    const method = rule.method; 	// equal, startWith, endWith, unequal, contain
    const star = image.star || undefined;
    // vendor 把 parseInt 的结果与字符串 'none' 比较（L656/L664）——该比较恒为 true，
    // 即 'equal'/'unequal' 永远走第一条分支。此处**保留同一个比较**（断言成更宽的
    // 联合类型，让 TS 不把它当死代码消掉），而不是直接塌成「走第一分支」：
    // 后者会在 rule.value 真的取到 'none' 时悄悄改变行为。
    const value = (parseInt(rule.value as string) || undefined) as number | string | undefined;
    const rawValue = rule.value as string;

    switch (method) {
      case 'contain':
        if (rawValue.indexOf('none') === -1) {
          return rawValue.indexOf(String(star)) !== -1;
        }
        else {
          if (rawValue.indexOf(String(star)) !== -1) {
            return true;
          }
          if (rawValue.indexOf("none") !== -1) {
            return true;
          }
          return false;
        }
      case 'equal':
        if (value !== 'none') {
          return star === value;
        }
        else {
          return star === undefined;
        }
      case 'unequal':
        if (value !== 'none') {
          return star !== value;
        }
        else {
          return star !== undefined;
        }
    }
    return false;
  }
  catch (err) {
    return false;
  }
}

export function isMatchShapeRule(rule: MatchRule, image: RuleImage): boolean {

  const method = rule.method; 	// equal, startWith, endWith, unequal, contain
  const value = rule.value;
  const width = image.width as number;
  const height = image.height as number;
  let isEqual = false;

  if (value !== "custom") {
    // vendor 此处反复读 `image.width`/`image.height`；规则输入是纯数据对象，
    // 提到局部量后取值完全一致（width/height 的收窄见上方声明）。
    let shape: string | undefined;
    if (width > height) {
      if (width > height && width / height >= 2.5) {
        shape = "panoramic-landscape";
      }
      else {
        shape = "landscape";
      }
    }
    else if (width < height) {
      if (width < height && height / width >= 2.5) {
        shape = "panoramic-portrait";
      }
      else {
        shape = "portrait";
      }
    }
    else if (width === height) {
      shape = "square";
    }

    isEqual = (shape === value);
  }
  else {
    if (!rule.width || !rule.height) return false;
    isEqual = (rule.width / rule.height === width / height);
  }

  if (method === 'equal') {
    return isEqual;
  }
  else {
    return !isEqual;
  }
}

export const cacheColorMappings: Record<string, number[] | undefined> = {};

export function isMatchColorRule(rule: MatchRule, image: RuleImage): boolean {

  if (!image || !image.palettes) return false;

  const value = rule.value as string;

  if (!cacheColorMappings[value]) {
    cacheColorMappings[value] = hexToRGB(value);
  }

  const method = rule.method;
  const similarColor = cacheColorMappings[value] || hexToRGB(value);
  const palettes = image.palettes;
  let similarity = 20;
  // var white = [255, 255, 255];
  // var black = [0, 0, 0];

  if (method === 'grayscale') {
    if (palettes) {
      for (let i = palettes.length - 1; i >= 0; i--) {
        const palette = palettes[i];
        if (palette.ratio >= 0.02) {
          const r = palette.color[0];
          const g = palette.color[1];
          const b = palette.color[2];
          if (Math.abs(r - g) >= 8 || Math.abs(r - b) >= 8 || Math.abs(g - b) >= 8) {
            return false;
          }
        }
      }
      return true;
    }
    return false;
  }

  if (method === 'accuracy') {
    similarity = 10;
  }

  if (!similarColor) return true;
  if (!image.palettes || image.palettes.length < 0) return false;
  if (!image.palettes[0]) return false;

  const ratio0 = image.palettes[0].ratio;
  const r0 = image.palettes[0].color[0];
  const g0 = image.palettes[0].color[1];
  const b0 = image.palettes[0].color[2];
  const rt = similarColor[0];
  const gt = similarColor[1];
  const bt = similarColor[2];

  if (ratio0 < 33) {
    return false;
  }

  if (
    r0 - rt > 96 ||
    g0 - gt > 96 ||
    b0 - bt > 96 ||
    r0 - rt < -96 ||
    g0 - gt < -96 ||
    b0 - bt < -96
  ) {
    return false;
  }

  if (image.palettes[0] && image.palettes[1]) {
    if (image.palettes[0].color[0] == similarColor[0] && image.palettes[0].color[1] == similarColor[1] && image.palettes[0].color[2] == similarColor[2] ||
      image.palettes[1].color[0] == similarColor[0] && image.palettes[1].color[1] == similarColor[1] && image.palettes[1].color[2] == similarColor[2]) {
      return true;
    }
  }

  if (image.palettes[0]) {
    if (image.palettes[0].ratio > 33) {
      const d = colorSimilarityDistance(similarColor, image.palettes[0].color);
      if (d.d2000 < similarity && d.d76 < similarity + 50) {
        return true;
      }
    }
  }

  if (image.palettes[1]) {
    if (image.palettes[1].ratio > 33) {
      const d2 = colorSimilarityDistance(similarColor, image.palettes[1].color);
      if (d2.d2000 < similarity && d2.d76 < similarity + 50) {
        return true;
      }
    }
  }
  return false;
}

// ─────────────────────── 颜色工具 ───────────────────────

interface LabColor {
  L: number;
  A: number;
  B: number;
}

interface ColorConvertModule {
  rgb: { lab: (r: number, g: number, b: number) => number[] };
}

interface DeltaEModule {
  getDeltaE76: (a: LabColor, b: LabColor) => number;
  getDeltaE00: (a: LabColor, b: LabColor) => number;
}

export interface ColorDistance {
  d76: number;
  d2000: number;
}

// b1-9d：w 为 bundle 时代词法绑定，vendor 注入环境无此名——经 window.require 同源解析。
// M3-1：原 vendor L819-821 在此处**装载期**绑定 colorConvert/DeltaE；本模块改为调用期读取
// （见文件头 ②），因此不再有「装载期拿不到就整份死掉」的耦合。
export function colorSimilarityDistance(color1: number[], color2: number[]): ColorDistance {
  const colorConvert = bundleGlobal<ColorConvertModule>('colorConvert');
  const DeltaE = bundleGlobal<DeltaEModule>('DeltaE');
  const c1 = colorConvert.rgb.lab(color1[0], color1[1], color1[2]);
  const c2 = colorConvert.rgb.lab(color2[0], color2[1], color2[2]);
  const l1 = { L: c1[0], A: c1[1], B: c1[2] };
  const l2 = { L: c2[0], A: c2[1], B: c2[2] };
  const d76 = DeltaE.getDeltaE76(l1, l2);
  const d2000 = DeltaE.getDeltaE00(l1, l2);
  return {
    d76: d76,
    d2000: d2000,
  };
}

export function hexToRGB(hex: string, alpha?: number): number[] {
  const r = parseInt(hex.slice(1, 3), 16),
    g = parseInt(hex.slice(3, 5), 16),
    b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

export function rgbToHex(r: number, g: number, b: number): string | false {
  // vendor L843 的 `if (r === undefined)` 是它自己的写法；类型上 r 已是 number，
  // 故此处放宽断言以保留该守卫（运行期取值不变）。
  if ((r as number | undefined) === undefined) {
    return false;
  }
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
}

// ─────────────────────── 相机元数据类规则 ───────────────────────

export function isMatchISORule(rule: MatchRule, image: RuleImage): boolean {
  const method = rule.method; 	// equal, startWith, endWith, unequal, contain
  if (!image.rawMetas || !image.rawMetas.isoSpeed) return false;
  const iso = parseInt(image.rawMetas.isoSpeed as string);
  const values = rule.value as (string | number)[];
  const value1 = parseInt(values[0] as string);
  const value2 = parseInt(values[1] as string);

  if (!iso && iso > 0) return false;

  switch (method) {
    case '=':
      return iso === value1;
    case '>=':
      return iso >= value1;
    case '<=':
      return iso <= value1;
    case '>':
      return iso > value1;
    case '<':
      return iso < value1;
    case 'between':
      return value1 <= iso && iso <= value2;
  }
  return false;
}

export function isMatchApertureRule(rule: MatchRule, image: RuleImage): boolean {
  try {
    const method = rule.method; 	// equal, startWith, endWith, unequal, contain
    if (!image.rawMetas || !image.rawMetas.aperture) return false;
    const matched = image.rawMetas.aperture.match(/[+-]?\d+(\.\d+)?/g) as RegExpMatchArray;
    const aperture = parseFloat(matched[0]);
    const values = rule.value as (string | number)[];
    const value1 = parseFloat(values[0] as string);
    const value2 = parseFloat(values[1] as string);

    if (!aperture && aperture > 0) return false;

    switch (method) {
      case '=':
        return aperture === value1;
      case '>=':
        return aperture >= value1;
      case '<=':
        return aperture <= value1;
      case '>':
        return aperture > value1;
      case '<':
        return aperture < value1;
      case 'between':
        return value1 <= aperture && aperture <= value2;
    }
    return false;
  }
  catch (err) {
    return false;
  }
}

export function isMatchFocalLengthRule(rule: MatchRule, image: RuleImage): boolean {

  try {
    const method = rule.method; 	// equal, startWith, endWith, unequal, contain
    if (!image.rawMetas || !image.rawMetas.focalLength) return false;
    const matched = image.rawMetas.focalLength.match(/[+-]?\d+(\.\d+)?/g) as RegExpMatchArray;
    const focalLength = parseFloat(matched[0]);
    const values = rule.value as (string | number)[];
    const value1 = parseFloat(values[0] as string);
    const value2 = parseFloat(values[1] as string);

    if (!focalLength && focalLength > 0) return false;

    switch (method) {
      case '=':
        return focalLength === value1;
      case '>=':
        return focalLength >= value1;
      case '<=':
        return focalLength <= value1;
      case '>':
        return focalLength > value1;
      case '<':
        return focalLength < value1;
      case 'between':
        return value1 <= focalLength && focalLength <= value2;
    }
    return false;
  }
  catch (err) {
    return false;
  }
}

export function isMatchShutterRule(rule: MatchRule, image: RuleImage): boolean {

  try {
    const method = rule.method; 	// equal, startWith, endWith, unequal, contain
    if (!image.rawMetas || !image.rawMetas.shutter) return false;
    const matched = image.rawMetas.shutter.match(/[+-]?\d+(\.\d+)?/g) as RegExpMatchArray;
    const shutter = parseFloat(matched[1]);
    const values = rule.value as (string | number)[];
    const value1 = parseFloat(values[0] as string);
    const value2 = parseFloat(values[1] as string);

    if (!shutter && shutter > 0) return false;

    switch (method) {
      case '=':
        return shutter === value1;
      case '>=':
        return shutter >= value1;
      case '<=':
        return shutter <= value1;
      case '>':
        return shutter > value1;
      case '<':
        return shutter < value1;
      case 'between':
        return value1 <= shutter && shutter <= value2;
    }
    return false;
  }
  catch (err) {
    return false;
  }
}

export function isMatchTimestampRule(rule: MatchRule, image: RuleImage): boolean {

  const method = rule.method; 	// equal, startWith, endWith, unequal, contain
  if (!image.rawMetas || !image.rawMetas.timestamp) return false;
  const timestamp = parseInt(image.rawMetas.timestamp as string);
  const values = rule.value as (string | number)[];
  const value1 = parseInt(values[0] as string);
  const value2 = parseInt(values[1] as string);

  if (!timestamp) return false;
  const DAY = 1000 * 60 * 60 * 24;
  switch (method) {
    case 'on':
      // 使用 toDateString() 判断同一天
      return new Date(timestamp).toDateString() == new Date(value1).toDateString();
    case 'before':
      return timestamp <= value1 + DAY;
    case 'after':
      return timestamp >= value1;
    case 'between':
      return value1 <= timestamp && timestamp <= value2 + DAY;
    case 'within':
      {
        const days = value1;
        return timestamp + days * 1000 * 24 * 60 * 60 >= Date.now();
      }
  }
  return false;
}

export function isMatchFontActivatedRule(rule: MatchRule, image: RuleImage): boolean {

  if (!image || !image.fontMetas) return false;

  try {
    const method = rule.method; 	// equal, startWith, endWith, unequal, contain
    const postScriptNames = image.fontMetas.postScriptName as Record<string, string>;
    const key = Object.keys(postScriptNames)[0];
    const postScriptName = postScriptNames && postScriptNames[key];
    if (!postScriptName) return false;
    const installedFonts = bundleGlobal<Record<string, boolean>>('installedFonts');
    switch (method) {
      case 'activate':
        return installedFonts[`${postScriptName}_.${image.ext}`];
      case 'deactivate':
        return !installedFonts[`${postScriptName}_.${image.ext}`];
    }
  }
  catch (err) {
    return false;
  }

  return false;
}
