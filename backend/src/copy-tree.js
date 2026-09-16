import fs from 'node:fs';
import path from 'node:path';

/**
 * M8-7：手动递归拷贝——宿主 `fs.cpSync(recursive)` 缺陷绕行（与 server.js 的
 * `copyInfoDirRecursive`、frontend/publish-asset-manifest.mjs 的 `copyTree` 同源手法）。
 *
 * 宿主实测（Node v22.23.0 / Windows 11 26200）：`fs.cpSync(src, dest, { recursive: true })`
 * 在 **src 路径含任意非 ASCII 字符**时把进程直接打死——退出码 0xC0000409
 * (STATUS_STACK_BUFFER_OVERRUN)，**无异常栈、catch 不到**。
 *
 * 触发条件是「源路径的非 ASCII」，与其它变量全部无关，均已实测排除：
 *   - 树形状/深度/宽度/文件数/体积/内容：同一棵树在纯 ASCII 路径下正常；
 *   - dest 路径含非 ASCII：正常（只有 src 一侧触发）；
 *   - 路径长度、空格：正常；
 *   - 非 ASCII 的种类不限于中文，é / д / 🚀 / 全角Ａ 同样触发。
 * 本仓库路径常含中文（工作区即 `... - 副本/...`），且真实用户的 Eagle 库路径
 * 也常含中文，因此产品代码不得直接使用 `fs.cpSync(recursive)`。
 *
 * 与 `fs.cpSync(recursive)` **默认值**的对齐情况（本模块四处调用点都不传这些选项）：
 *   - `force: true`（默认）            → `copyFileSync` 默认即覆盖，一致。
 *   - `errorOnExist: false`（默认）    → 仅在 `force: false` 时有意义，本处不适用。
 *   - `mode: 0`（默认）                → 不启用 COPYFILE_FICLONE 等修饰位，
 *                                        `copyFileSync` 默认同为 0，一致。
 *   - `preserveTimestamps: false`（默认）→ 两边都不保留 mtime，一致。
 *   - `dereference: false`（默认）     → **重建链接本身**，不跟随目标（见下）。
 *
 * 符号链接取舍：显式重建链接，而非按既有先例的「一律 copyFileSync」简单处理。理由是
 * 先例那种写法在这里会**引入 cpSync 没有的新失败模式**——`copyFileSync` 会跟随链接，
 * 遇到「指向目录的链接」直接抛 EISDIR，而 cpSync 只是把链接复制过去；指向文件的链接
 * 则会被悄悄换成目标内容的副本。Eagle 库实际不含符号链接，两条路径对真实数据等价，
 * 但重建链接既更贴近 cpSync 语义，也不会把「有链接」变成「有异常」。
 * 已知差异：本模块用 `readlinkSync` 的**原样**目标重建（等同 `verbatimSymlinks: true`），
 * 而 cpSync 默认 `verbatimSymlinks: false` 会把相对目标改写成绝对路径。Eagle 库不含
 * 链接故无实际影响；原样重建不篡改链接语义，是更保守的一侧。
 *
 * @param {string} source 源目录或文件
 * @param {string} destination 目标路径
 * @param {{ filter?: (sourcePath: string, destinationPath: string) => boolean }} [options]
 *   `filter` 语义对齐 cpSync：对**根本身**与每个条目各调用一次（入参为 src/dest 两侧路径），
 *   返回 false 则跳过该条目；目录被跳过时整棵子树一并跳过。
 */
export function copyTreeSync(source, destination, options = {}) {
  const filter = options.filter;
  copyAny(source, destination, filter, null);
  return destination;
}

function copyAny(source, destination, filter, entry) {
  if (filter && !filter(source, destination)) return;
  const link = entry ? entry.isSymbolicLink() : fs.lstatSync(source).isSymbolicLink();
  if (link) {
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.symlinkSync(fs.readlinkSync(source), destination);
    return;
  }
  const directory = entry ? entry.isDirectory() : fs.statSync(source).isDirectory();
  if (!directory) {
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(source, destination);
    return;
  }
  fs.mkdirSync(destination, { recursive: true });
  for (const child of fs.readdirSync(source, { withFileTypes: true })) {
    copyAny(path.join(source, child.name), path.join(destination, child.name), filter, child);
  }
}
