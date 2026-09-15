/**
 * R5：采集窗 `window.eagle` 命名空间的惰性访问口。
 *
 * 背景（考据 = 本批 R5 实测探针，非推断）：该窗的 `eagle.*` 由 `js/lib/api/*` 一组 classic 脚本
 * 在解析期写入，React 侧代码（controller/folderPanel/LibrarySwitcher）在模块求值期即读取。
 * 迁移为 TS 模块后，模块间互相引用（如 `utils` 内的 `eagle.logger`）必须仍然能拿到**同一个**
 * 命名空间对象，且必须**惰性求值**——install.ts 的装配发生在模块求值之后，模块顶层若定值捕获
 * `window.eagle` 会拿到 undefined。
 *
 * 故此处导出 Proxy：读/写/`in` 全部转发到当时的 `window.eagle`，使各模块得以保留原脚本里
 * `eagle.foo = new Foo()` / `eagle.foo.bar(...)` 的**逐字写法**，把转写风险降到最低。
 */
export function ensureEagle(): any {
  const w = window as any;
  if (!w.eagle) w.eagle = {};
  return w.eagle;
}

export const eagle: any = new Proxy({}, {
  get: (_target, key) => ensureEagle()[key],
  set: (_target, key, value) => {
    ensureEagle()[key] = value;
    return true;
  },
  has: (_target, key) => key in ensureEagle(),
  ownKeys: () => Reflect.ownKeys(ensureEagle()),
  getOwnPropertyDescriptor: (_target, key) => Reflect.getOwnPropertyDescriptor(ensureEagle(), key),
});
