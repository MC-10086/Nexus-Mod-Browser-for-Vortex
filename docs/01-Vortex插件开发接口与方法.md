# Vortex 插件（扩展 / Extension）开发接口与方法

> **文档定位**：本文只讨论 **Vortex 自身的扩展（Extension）**，即给「MOD 管理器 Vortex」写插件，
> **不是**给游戏写的插件（SKSE 插件、BepInEx 插件、游戏 mod 那一类）。
>
> **调研来源**
> 1. 官方 Wiki：<https://github.com/Nexus-Mods/Vortex/wiki>（页面清单、Introduction、API Events 等，见 §11，抓取时间 2026-10）
> 2. 官方类型包：`@nexusmods/vortex-api`（原 `Nexus-Mods/vortex-api` 仓库已归档并迁移到 npm，v2.2 起随 Vortex 发布）
> 3. **本地实测校验**：本机安装的 **Vortex 2.8.2**（`E:\Game\Vortex`），
>    通过解析 `resources/app.asar` 内的 sourcemap 还原出 `src/types/IExtensionContext.ts`、
>    `src/ExtensionManager.ts`、`src/extensions/nexus_integration/*`、`src/extensions/browse_nexus/*` 等真实源码。
>    文中标注 `IExtensionContext.ts:1112` 形式的行号，均来自 **Vortex 2.8.2 的实际源码**。
>
> ⚠️ 注意：Wiki 中大量开发文档位于侧边栏的 “Modding.wiki (Developers)” / “Legacy” 分区，
> 官方自己标注为 *“迁移后未做质量校验、可能过时”*。因此本文对「接口是否存在、签名是什么」
> 一律以本地 2.8.2 源码为准，Wiki 只作为方法论与命名的参考。

---

## 0. 结论速览（TL;DR）

| 问题 | 结论 |
| --- | --- |
| 插件长什么样 | 一个目录，里面至少 `info.json` + `index.js`（或 `index.cjs`） |
| 装在哪 | `%APPDATA%\Vortex\plugins\<任意目录名>\`（也可随 Vortex 内置在 `resources/app.asar.unpacked/bundledPlugins`） |
| 入口约定 | 模块默认导出（或具名导出 `init`）一个 `function init(context)` |
| 能力从哪来 | ① `context.registerXxx(...)` 向宿主「注册」功能（约 40 个）；② `context.api` 运行时 API；③ `context.api.ext` 内置 Nexus/下载能力 |
| 能不能加一个「新页面」 | 能，`context.registerMainPage(id, title, Component, options)`，内置「Browse Nexus」页就是这么做的 |
| 能不能主动触发下载 | 能，`context.api.events.emit('start-download', [nxmUrl], modInfo, fileName, cb, redownload, opts)` |
| 能不能跨扩展调用 | 能，`context.registerAPI(name, fn, opts)` + `context.requireExtension(id)` |
| 前端技术栈 | React 18.3 + Redux 4（react-redux 7）+ 自带控件库 + SCSS |
| 依赖注入方式 | 扩展被打包成单文件，宿主提供 React/Redux/Bluebird 等 peer 依赖 |

---

## 1. 什么是 Vortex 扩展

### 1.1 三种扩展形态

Vortex 的一切功能（游戏支持、Mods 页、下载管理、集合安装、主题）本身都是「扩展」。
按用途分三类：

| 类型 | 典型 API | 说明 |
| --- | --- | --- |
| **游戏支持扩展**（game extension） | `registerGame` / `registerInstaller` / `registerModType` / `registerLoadOrder` | 让 Vortex 支持某款游戏，社区扩展绝大多数是这种 |
| **通用功能扩展**（feature extension） | `registerMainPage` / `registerAction` / `registerTableAttribute` / `registerSettings` | 给管理器加功能，**本项目属于这一类** |
| **主题扩展**（theme） | `setStylesheet` / SCSS | 改外观 |

> Wiki 原文（Introduction to Vortex extensions）：*“Extensions are a way for anyone who knows javascript to add features to Vortex.”*

### 1.2 与「游戏插件」的区别

- 游戏插件 = 运行在游戏进程里（SKSE `.dll`、BepInEx `.dll`、`.esm/.esp` 等），由游戏或脚本扩展加载器加载。
- Vortex 扩展 = 运行在 Vortex 的 Electron 渲染进程里，是 **CommonJS 模块**，拿到的是 Vortex 的 `context` 对象。
- 两者唯一的交集是：Vortex 扩展可以「安装/部署」游戏插件，但自己不进入游戏进程。

### 1.3 进程模型（很重要）

Vortex 是 Electron 应用，代码分主进程（`main.cjs`）与渲染进程（`renderer.js`）。

- `init(context)` **会被调用两次**（主进程 + 渲染进程各一次），所以 init 里**只能注册，不能干活**。
- 真正干活用 `context.once(...)`（渲染进程，UI 就绪、所有扩展注册完毕后调用一次）或 `context.onceMain(...)`（主进程）。
  源码：`IExtensionContext.ts:1589` / `IExtensionContext.ts:1608`。

```ts
function init(context: IExtensionContext) {
  context.registerMainPage(/* ... */);   // 注册 = 声明，不具备即时副作用
  context.once(() => {
    // 这里才可以读 store、发事件、发网络请求
  });
  return true;
}
```

---

## 2. 扩展的物理结构与加载机制

### 2.1 目录布局

```
%APPDATA%\Vortex\plugins\
└── my-extension\           ← 目录名任意，仅作为兜底 id
    ├── info.json           ← 必需
    └── index.js            ← 必需（或 index.cjs，优先匹配 .cjs）
```

加载路径来自源码 `ExtensionManager.getExtensionPaths()`（`ExtensionManager.ts:697`）：

```ts
[
  { path: path.join(getVortexPath("userData"), "plugins"), bundled: false }, // %APPDATA%\Vortex\plugins
  { path: getVortexPath("bundledPlugins"), bundled: true },                  // 随应用内置
]
```

> **例外：翻译扩展不需要 `info.json` / `index.js`。** 翻译包只是「以 ISO 语言标签命名的子目录 + `zh/common.json`」，
> 源码里对应 `loadDynamicExtension` 的 else 分支：*“this is not necessarily a problem, translation extensions
> for example have no index.js file”*（`ExtensionManager.ts:2876`）。
> 本机 `%APPDATA%\Vortex\plugins\Chinese Translation For Vortex Remake …\` 就是这种结构（只有 `zh\` + `readme.txt`）。
> 我们要做的是**功能扩展**，必须遵守上面的 `info.json` + `index.js` 约定。

Vortex 2.8.2 的 `resources/app.asar.unpacked/bundledPlugins/` 下有 **126 个**内置扩展目录，
它们是最好的源码范例：`game-skyrimse`、`game-baldursgate3`、`browse_nexus`、`mod-content`、
`theme-switcher`、`extension-dashlet` 等。

### 2.2 `info.json` 校验规则（源码级）

`src/extensions/extension_manager/extensionInfo.ts` 用 zod 定义，字段如下：

| 字段 | 必填 | 类型 | 说明 |
| --- | --- | --- | --- |
| `name` | ✅ | string | 展示名 |
| `version` | ✅ | string | 语义化版本（semver），用于比较同名扩展新旧 |
| `author` | ❌ | string | 缺省为 `"<unknown>"` |
| `description` | ❌ | string | 缺省为 `"<missing>"` |
| `id` | ❌ | string | 扩展唯一 id；缺省时用目录名 |
| `namespace` | ❌ | string | i18n 命名空间；缺省 = `id` 或由 name 生成 |
| `modId` | ❌ | int | 该扩展在 Nexus 上的 mod id（用于「从 Nexus 安装的扩展」关联） |

```json
{
  "name": "Nexus Mod Browser",
  "author": "your-name",
  "version": "0.1.0",
  "description": "Browse Nexus Mods inside Vortex and download with one click"
}
```

> 同名扩展同时存在时，**版本高的胜出**（`ExtensionManager.ts:2857` 用 `semver.gte` 比较）。

### 2.3 入口文件与导出约定

- 文件名只认 `index.cjs`、`index.js`（`mExtensionFormats = ["index.cjs", "index.js"]`，`ExtensionManager.ts:742`）。
- 导出解析（`ExtensionManager.ts:2894` `getExtensionInitFunc`）：
  1. `module.exports` 本身是函数 → 当作 init；
  2. `__esModule` 为真 → 取 `default`；
  3. 否则取 `default ?? module`，且必须是函数。

所以下面几种写法都合法：

```js
exports.default = function init(context) { /* ... */ };   // 官方 wiki 写法
module.exports = function init(context) { /* ... */ };    // CJS 直出
export default function init(context) { /* ... */ }       // 经 TS/打包后
```

### 2.4 版本与依赖

- `info.json` **没有** `apiVersion` / `minVortexVersion` 字段；兼容性靠运行时自查
  `context.api.isOutdated()`（`IExtensionContext.ts:866`）或 `requireExtension(id, version)`（`IExtensionContext.ts:1574`）。
- 开发期依赖：`@nexusmods/vortex-api`（类型 + 少量运行时再导出）；Vortex 提供 peer 依赖
  `react@18.3.1`、`react-dom@18.3.1`、`redux@4.2.1`、`react-redux@7.2.9`、`bluebird` 等，**不要重复打包**。

---

## 3. 生命周期与 `context` 的「延迟注册」语义

### 3.1 调用顺序

```
Vortex 启动
 ├─ 扫描 plugins/ 与 bundledPlugins/          (getExtensionPaths)
 ├─ 逐个 require 入口模块 → 取 init
 ├─ init(context) ×2（主进程、渲染进程各一次）
 │    └─ 期间调用 context.registerXxx / context.api.* 全部被「记录」，不立即执行
 ├─ 所有扩展注册完成，注册表求值（建页面、装 reducer、挂事件）
 ├─ 渲染进程 UI ready → once() 回调（只调一次，且仅当扩展真正被激活）
 └─ gamemode-activated（切换/激活游戏时；含启动首次）
```

### 3.2 `context` 是一个 Proxy

源码注释（`IExtensionContext.ts:1039`）明确写道：

> *“context is a "Proxy" object that will accept calls to any "registerXYZ" function no matter if it's available or not. You can't "introspect" this object reliably.”*

含义与坑：

1. 你调用一个**不存在**的 `registerFoo()` 不会报错；
2. 但如果最终发现该函数不存在，**你的扩展不会被加载**（init 跑了，注册全部作废）——
   这是「依赖了未安装扩展」的安全失败机制；
3. 想「有就用、没有就算了」，用 `context.optional.registerFoo(...)`（`IExtensionContext.ts:1623`）；
4. 不要 `console.log(Object.keys(context))` 之类去探测能力，探不出来；
5. init 里**绝不能**读 `context.api.getState()`（会抛 “extension uses api in init function”），要放到 `once` 里。

### 3.3 `once` 的边界

- `once` 在**所有扩展注册完成之后**、**gamemode 激活之前**调用，所以此刻**还拿不到当前游戏的 profile**；
  需要游戏上下文就监听 `gamemode-activated`。
- `once` 与 `onceMain` 的区别：前者渲染进程（绝大多数逻辑写这里），后者主进程（只有确实需要时用）。

---

## 4. 注册接口全表（`context.registerXxx`）

以下行号均指 Vortex 2.8.2 的 `src/types/IExtensionContext.ts`。

### 4.1 UI 相关

| API | 行 | 签名要点 |
| --- | --- | --- |
| `registerMainPage` | 1112 | `(icon, title, Component, options: IMainPageOptions)` — 往左侧主导航加页面 |
| `registerSettings` | 1060 | `(title, Component, props?, visible?, priority?)` — 设置页 |
| `registerDashlet` | 1117 | `(title, width 1-3, height 1-6, position, Component, isVisible, props, opts)` — 首页小部件 |
| `registerAction` | 1098 | `(group, position, iconOrComponent, options, titleOrProps?, action?, condition?)` — 按钮/菜单项 |
| `registerTableAttribute` | 1264 | `(tableId, attribute: ITableAttribute)` — 给已有表格加列/详情字段（Mods 表 id = `"mods"`） |
| `registerDialog` | 1124 | `(id, Component, props?)` — 自管可见性的模态框 |
| `registerOverlay` | 1130 | `(id, Component)` — 覆盖层 |
| `registerFooter` | 1138 | `(id, Component, props?)` |
| `registerBanner` | 1154 | `(group, Component, options)` |
| `registerToDo` | 1147 | 新用户待办提示 |
| `registerControlWrapper` | 1104 | 包裹内置控件（仅支持开放给扩展的控件） |
| `setStylesheet` | 802 | `(key, filePath)` — 注入 SCSS 编译后的样式 |

### 4.2 状态 / 持久化 / 跨扩展

| API | 行 | 说明 |
| --- | --- | --- |
| `registerReducer` | 1207 | `(path: string[], spec: IReducerSpec)` 注入 Redux 分支；**必须放在 init 最前面** |
| `registerPersistor` | 1254 | `(hive, persistor, debounce?)` 自定义存储格式 |
| `registerSettingsHive` | 1222 | `(type: 'global'|'game'|'profile', hive)` 让某个 state 分支自动持久化 |
| `registerAPI` | 1559 | `(name, fn, options)` 暴露给其他扩展 |
| `requireExtension` | 1574 | `(extId, version?, optional?)` 声明依赖 |
| `registerMigration` | 1463 | 版本迁移钩子 |
| `registerHistoryStack` | 1548 | 注册撤销/重做栈 |

```ts
// registerReducer 的路径语义（源码注释 1207 行附近）
// ['settings','interface'] ✅ 可给已有叶子加 reducer
// ['settings']            ❌ 不能给已有子树加节点
// ['session', ...]        非持久化（临时状态统一放 session）
```

### 4.3 Mod / 游戏 / 安装器

| API | 行 | 说明 |
| --- | --- | --- |
| `registerGame` | 1299 | 注册游戏（游戏扩展的核心） |
| `registerGameStub` | 1305 | 注册占位游戏，供「扩展下载」补齐 |
| `registerInstaller` | 1085 | `(id, priority 21–99 常规, testSupported, install)` |
| `registerModType` | 1358 | 自定义 mod 类型与部署目标 |
| `registerModSource` | 1164 | `(id, name, onBrowse?, options?)` 声明「Mod 来源站点」，可弹浏览 |
| `registerDeploymentMethod` | 1067 | 自定义部署方式（symlink/hardlink/…） |
| `registerMerge` | 1408 | 文件合并（如 XML/INI） |
| `registerArchiveType` | 1292 | 让其他扩展能读你的压缩格式 |
| `registerLoadOrder` / `registerLoadOrderPage` | 1543 / 1537 | 加载顺序系统 |
| `registerAttributeExtractor` | 1341 | 从压缩包提取属性 |
| `registerActionCheck` | 1383 | 动作可行性检查 |
| `registerToolVariables` | 1533 | 工具启动参数变量 |
| `registerStartHook` | 1434 | 启动/运行前的钩子 |
| `registerInterpreter` | 1420 | 脚本解释器 |
| `registerPreview` | 1515 | 文件预览 |
| `registerProfileFile` / `registerProfileFeature` | 1473 / 1480 | profile 级文件/特性 |

### 4.4 网络 / 下载 / 协议

| API | 行 | 说明 |
| --- | --- | --- |
| `registerDownloadProtocol` | 1229 | `(scheme, handler)` 把自定义协议解析成 http(s) URL |
| `registerProtocol`（api 上） | 697 | `(protocol, isDefault, callback)` 系统级 URI 协议（如 `nxm://`） |
| `registerRepositoryLookup` | 707 | 用站点 id 反查 Mod 元数据（替代 MD5 查找） |

### 4.5 诊断

| API | 行 |
| --- | --- |
| `registerTest`（旧） | 1273 |
| `registerHealthCheck`（推荐） | 1284 |
| `registerGameInfoProvider` | 1322 |
| `registerGameSpecificCollectionsData` | 1553 |

---

## 5. 运行时 API：`context.api`

`context.api` 是 `IExtensionApi`（`IExtensionContext.ts:~640` 起），它是**唯一**在 init 之外你还需要的东西。

### 5.1 核心成员

| 成员 | 说明 |
| --- | --- |
| `api.store` | Redux store（ThunkStore），`getState()` / `dispatch()` / `subscribe()` |
| `api.getState()` | `api.store.getState()` 的带类型包装（`IExtensionContext.ts:897`） |
| `api.events` | Node EventEmitter：`on` / `emit` |
| `api.onAsync(name, listener)` | 监听「需要等待结果」的异步事件（`IExtensionContext.ts:835`） |
| `api.emitAndAwait(name, ...args)` | 发出异步事件并等待全部 handler（`:818`），返回结果数组 |
| `api.sendNotification({...})` | 通知，返回 id |
| `api.showErrorNotification(msg, err, opts)` | 错误通知 |
| `api.showDialog(type, title, content, actions, id?)` | 对话框，`Promise<{ action, input }>` |
| `api.dismissNotification(id)` / `suppressNotification` | 通知管理 |
| `api.translate(str, opts)` / `api.locale()` | i18n |
| `api.getPath(name)` | Electron 路径（`userData`、`temp`、`downloads`…） |
| `api.selectFile` / `selectDir` / `saveFile` / `selectExecutable` | 系统文件对话框 |
| `api.onStateChange(path, cb)` | 监听 state 子树变化（`:686`） |
| `api.awaitUI()` | 等 UI 就绪 |
| `api.highlightControl(selector, ms, text?)` | 高亮某控件引导用户 |
| `api.getLoadedExtensions()` | 列出已加载扩展 |
| `api.isOutdated()` | 判断 Vortex 版本是否过旧 |

### 5.2 `context.api.ext`：宿主内置能力（重点）

`api.ext` 是由内置扩展通过 `registerAPI` 暴露的函数集合，**这是插件复用官方能力的入口**。
Vortex 2.8.2 的 Nexus/Hub 相关函数（源自 `nexus_integration/index.tsx:~920` 的注册表）：

| 函数 | 用途 |
| --- | --- |
| `ext.nexusGetModInfo(gameId, modId)` | Mod 详情 |
| `ext.nexusGetModFiles(gameId, modId)` | Mod 文件列表（`IFileInfo[]`） |
| `ext.nexusDownload(gameId, modId, fileId, fileName?, allowInstall?)` | **触发官方下载管道**（返回 dlId） |
| `ext.nexusGetLatestMods(...)` / `nexusGetTrendingMods(...)` | 最新/热门 |
| `ext.nexusSearchCollections(...)` / `nexusGetCollections(...)` | 合集搜索 |
| `ext.nexusGetUserKeyData()` / `nexusGetPreferences()` | 用户信息/偏好 |
| `ext.nexusModUpdate(...)` / `nexusEndorseMod(...)` | 更新/点赞 |
| `ext.ensureLoggedIn()` | 确保已登录（会弹登录流程） |
| `ext.nexusRequestNexusLogin(cb)` | 主动请求登录 |
| `ext.getNexusGames()` | Nexus 游戏表 |
| `ext.addToHistory` / `withSuppressedTests` / `registerOverlayComponent` … | 其他内置 API |

> ⚠️ 这些函数在类型定义里是 `IExtensionApiExtension` 的可选成员，**运行时可能不存在**（老版本/未来版本），
> 官方推荐写法 `api.ext.nexusGetModFiles?.(...)`（见 `health_check` 源码）。

### 5.3 可重导出的工具（来自 `@nexusmods/vortex-api`）

`src/api.ts` 的导出即扩展可用的「标准库」：

```ts
export { actions, PromiseBB as Promise, fs, log, selectors, types, util };
export * from "./controls/api";   // 内置控件
export * from "./views/api";      // MainPage / MainContext / DNDContainer
export { ComponentEx, PureComponentEx } from "./controls/ComponentEx";
export { VortexError } from "@vortex/shared";
```

常用：
- `selectors.activeGameId(state)` / `selectors.activeProfile(state)`
- `util.getGame(gameId)` / `util.nexusGameId(game, gameId)`（内部 id ↔ Nexus 域名互转）
- `util.showError` / `util.showActivity` / `util.renderError` / `util.bbcodeToReact`
- `util.checksum` / `util.fileMD5` / `util.Archive`
- `fs.*`（Vortex 封装的异步文件系统，含 `fs.ensureDirWritableAsync` 等安全建目录工具）
- 错误类型 `util.UserCanceled` / `util.ProcessCanceled` / `util.SetupError` …

> **⚠️ 重要更正（2026-10 实测，直接读 renderer.js 得到）**：
> `@nexusmods/vortex-api` **不只是类型包** —— Vortex 在运行时劫持了 `Module.prototype.require`，
> 对扩展代码里的 `require("vortex-api")` / `require("@nexusmods/vortex-api")` 返回**宿主内部 api 模块的 Proxy**：
>
> ```js
> // renderer.js（2.8.2）
> if ("vortex-api" === id || "@nexusmods/vortex-api" === id) {
>   const ext = getExtensions().find(iter => this.filename.startsWith(iter.path));
>   if (ext !== undefined) {
>     return (handlerMapAPI[ext.name] ??= new Proxy(api, new ExtProxyHandler(ext, state)));
>   }
>   return api;
> }
> if ("react-select" === id) return reactSelect;
> if ("redux-act" === id) return /* 同样按扩展代理，自动给 action 打 extension meta */;
> ```
>
> 也就是说：
> - **可以**在运行时 `require("@nexusmods/vortex-api")` 拿到 `FlexLayout` / `Table` / `Icon` /
>   `ComponentEx` / `selectors` / `util` / `fs` … 这些**宿主自带控件与工具**（内置扩展 `game-bladeandsorcery`
>   的产物里就有一行 `const { actions, fs, FlexLayout, log, selectors, util } = require("@nexusmods/vortex-api")`）；
> - `log` 会被自动加上 `[扩展namespace]` 前缀；其余成员过一层 `deprecatedApiUsage` 检查（只告警，不拦截）；
> - `react-select`、`redux-act` 也由宿主提供，不必打包。
>
> **实践建议**：想做「和 Vortex 一致的 UI」，直接 `import { FlexLayout, Table, Icon, TooltipControls } from "@nexusmods/vortex-api"`，
> 依赖不要打包（webpack `externals` / 或不打包）。本项目当前的构建方式是「不打包、tsc 输出 CommonJS」，
> 所以 `require` 保持原生语义，天然可用。

---

## 6. UI 开发

### 6.1 技术栈事实（2.8.2）

- React **18.3.1**、react-dom 18.3.1、react-redux **7.2.9**、redux **4.2.1**、i18next 21
- 自带控件库（`import { Button } from "@nexusmods/vortex-api"` 之外还有更新的一批 `@/ui/components/*`，
  但那是内部别名，**对外稳定的是 `controls/api` 里导出的那批**）：
  `Table`、`Icon`、`IconBar`、`Dropdown`、`Toggle`、`FormInput`、`FormFields`、`Modal`、`ProgressBar`、
  `Spinner`、`TooltipControls`、`ContextMenu`、`ToolbarIcon`、`FlexLayout`、`Steps` …
- 页面骨架用 `MainPage`（`views/api` 导出）。

### 6.2 `registerMainPage` 详解

```ts
type RegisterMainPage = (
  icon: string,                                  // 旧图标名（如 'search'），或用 options.mdi
  title: string,                                 // 导航标题
  element: React.ComponentType<PropsWithChildren<any>>,
  options: IMainPageOptions,
) => void;                                       // IExtensionContext.ts:222
```

`IMainPageOptions`（`IExtensionContext.ts:182`）：

| 字段 | 说明 |
| --- | --- |
| `id` | 页面 id，缺省用标题；`show-main-page` 命令用它跳转 |
| `group` | **必填**：`"dashboard" \| "global" \| "per-game" \| "support" \| "hidden"` |
| `priority` | 排序，越小越靠前 |
| `mdi` | Material Design Icon 的 path（`@mdi/js`） |
| `visible` | `() => boolean`，控制是否出现（例如只在有激活游戏时显示） |
| `props` | `() => object`，注入组件 props |
| `hotkey` | 单键（自动加 Ctrl+Shift），如 `"B"` |
| `hotkeyRaw` | Electron 格式完整热键 |
| `badge` / `menuBadge` | 导航项徽标 / 自订阅徽标组件 |
| `newLayout` | 使用新版 UI 外壳（页面自渲染 `Page`） |

### 6.3 真实范例：内置「Browse Nexus」扩展

`bundledPlugins/browse_nexus/index.cjs`（源码 `src/extensions/browse_nexus/index.ts`）：

```ts
function init(context: IExtensionContext): boolean {
  context.registerMainPage("search", "Browse Nexus Mods", BrowseNexusPage, {
    priority: 20,
    hotkey: "B",
    group: "per-game",
    visible: () => activeGameId(context.api.store.getState()) !== undefined,
    props: () => ({ api: context.api }),
    mdi: mdiMagnify,
  });
  return true;
}
```

页面组件里做的事（可作为「管理器内浏览」的现成模板）：

- `useSelector(state => activeGameId(state))` 拿当前游戏 → `nexusGameId(getGame(gameId), gameId)` 转成 Nexus 域名
- `useSelector(state => state.confidential?.account?.["nexus"]?.APIKey)` 判断是否登录
- `useSelector(state => state.persistent["nexus"]?.userInfo?.adult)` 读取成人内容偏好
- 搜索/排序/分页（`Listing` / `Pagination` / `Input` / `TabBar`）+ `api.showDialog` 做成人内容拦截提示

> 结论：**「在管理器里搜索 + 列表展示」这件事，Vortex 官方已经在合集（Collections）上做过一遍**，
> 只是没有对「单个 Mod」做。我们的插件是把同一套 UI 模式复制到 Mod 上，风险很低。

### 6.4 样式与图标

```ts
context.setStylesheet('my-ext-styles', path.join(__dirname, 'styles.scss'));
```
- SCSS 由宿主编译（`styles:compile` IPC），**注意**：注入的样式是全局的，必须自己加命名空间前缀。
- 图标优先用 `@mdi/js` 的 path 字符串（`mdiMagnify` 等），与新版 UI 一致。

---

## 7. 事件与命令系统

### 7.1 两种「事件」

| 机制 | 发出 | 监听 | 语义 |
| --- | --- | --- | --- |
| 同步事件 | `api.events.emit(name, ...args)` | `api.events.on(name, cb)` | 不等待返回值 |
| 异步事件 | `api.emitAndAwait(name, ...args)` | `api.onAsync(name, cb)` | 等待所有 handler 的 Promise，返回结果数组 |

> 关键约定：**监听方必须自己处理错误**，返回 rejected Promise 会被视为 bug（源码注释 `IExtensionContext.ts:830`）。

### 7.2 常用事件（Wiki: API events，实测仍有效）

| 事件 | 参数 | 时机 |
| --- | --- | --- |
| `gamemode-activated` | `(gameId: string)` | 切换/首次激活游戏；**扩展做「按游戏初始化」的首选** |
| `startup` | — | 应用启动、UI 显示前 |
| `will-deploy` / `did-deploy` | `(profileId, deployment)` | 部署前/后（异步） |
| `will-purge` / `did-purge` | `(profileId, deployment)` | 清除部署 |
| `profile-will-change` / `profile-did-change` | `(newProfileId, enqueue?)` | 切换 profile（含换游戏） |
| `mods-enabled` / `mod-enabled` / `mod-disabled` | `(mods[], enabled, gameId)` 等 | 启用/禁用 |
| `mod-content-changed` | `(profileId, modId)` | 磁盘内容变化 |
| `will-install-mod` / `did-install-mod` | `(gameId, archiveId, modId, fullInfo)` | 安装 Mod |
| `will-remove-mod(s)` / `did-remove-mod(s)` | `(gameId, modIds, opts)` | 卸载 |
| `did-import-downloads` | `(dlIds: string[])` | 导入下载 |
| `filehash-calculated` | `(filePath, md5, size)` | 计算完 MD5 |
| `added-files` | `(profileId, files)` | mods 目录出现新文件 |

### 7.3 常用命令（emit 后由宿主执行）

| 命令 | 参数 | 用途 |
| --- | --- | --- |
| `start-download` | `(urls[], modInfo, fileName, cb, redownload, opts?)` | **发起下载（核心）** |
| `start-install-download` | `(downloadId, allowAutoEnable, cb)` | 把已下载文件装成 mod |
| `nexus-download` | `(gameId, modId, fileId)` | 走官方 Nexus 下载（异步） |
| `start-install` | `(archivePath, cb)` | 从本地压缩包安装 |
| `show-main-page` | `(pageId)` | 跳到某个主页面 |
| `show-modal` | `(id)` | 打开注册过的模态框 |
| `import-downloads` | `(paths[])` | 把外部文件导入下载目录 |
| `remove-download` / `pause-download` / `resume-download` | `(id)` | 下载管理 |
| `activate-game` | `(gameId)` | 切换游戏 |
| `check-mods-version` | `(gameId, mods, forceFull)` | 检查更新 |
| `mod-update` | `(gameId, modId, fileId)` | 更新某 mod |
| `open-mod-page` | `(gameId, modId, source)` | 打开 mod 网页 |
| `deploy-mods` / `purge-mods` / `deploy-single-mod` | … | 部署控制 |
| `quick-launch` | — | 启动游戏 |
| `browse-for-download` | `(url, instructions)` | 打开内置浏览器让用户手动下载（免费用户场景） |
| `enable-download-watch` | `(enabled)` | 暂停/恢复下载目录监听 |
| `autosort-plugins` | `(manual, cb)` | 排序插件 |

> `start-download` 的 `modInfo` 建议至少带 `{ game, name, fileId, modId }`，
> `game` 用**内部 game id**（如 `skyrimse`），不是 Nexus 域名（`skyrimspecialedition`）。
> 源码里专门有这个转换注释，见 §8.3。

---

## 8. 下载管道：`nxm://` 是唯一正确的入口（关键）

### 8.1 为什么不能自己拼 CDN URL

Nexus 的文件下载链接是**按账号与会员等级即时签发、带过期时间**的：

- Premium 用户：API 直接换出 CDN URL（带 `md5`/`expires` 签名）；
- 免费用户：必须经过「网页授权 → 生成一次性链接」的流程，Vortex 用一个对话框引导用户在浏览器里点下载。

因此插件**不应该**自己构造 `https://…/file?id=…`，也不应该自己去要 API Key 换链接——那会绕过官方的免费用户流程与配额。

### 8.2 官方管道结构（源码 `nxmProtocol.ts`）

```
插件 emit('start-download', [nxm://game/mods/<modId>/files/<fileId>], ...)
        ↓ 宿主 download_management 识别 nxm:// 协议
        ↓ NxmProtocol.resolve()
        ├─ premium：用内置 nexus client 调 API 换出 CDN URL
        └─ free   ：弹「免费用户请到网站授权」对话框（FreeUserDLDialog）
        ↓ 进入下载队列（下载目录、进度、断点续传、MD5 校验都由宿主负责）
```

源码里 `needsAuthorisedLink(url)` 的判定：

```ts
// 免费用户只有「真实游戏的、没有 key 的 mod 链接」才需要走网站往返
function needsAuthorisedLink(url: NXMUrl): boolean {
  return url.type === "mod" && url.gameId !== SITE_ID && url.key === undefined;
}
```

### 8.3 标准调用序列（照抄内置 `health_check` 的实现）

```ts
// 1) 拼 nxm 链接（域名用 Nexus 域名）
const nxmUrl = `nxm://${nexusDomainName}/mods/${modId}/files/${fileId}`;

// 2) 发起下载
const dlId: string = await new Promise((resolve, reject) =>
  api.events.emit(
    "start-download",
    [nxmUrl],
    { game: internalGameId, name: fileName, fileId, modId },  // modInfo
    undefined,                                                // 让宿主决定文件名
    (err, id) => (err ? reject(err) : resolve(id)),
    undefined,                                                // redownload
    { allowInstall: false },                                  // 只下载，不立刻安装
  ),
);

// 3) 安装（可选，也可以让用户在「下载」页手动安装）
await new Promise((resolve, reject) =>
  api.events.emit(
    "start-install-download",
    dlId,
    { allowAutoEnable: true },
    (err, modId) => (err ? reject(err) : resolve(modId)),
  ),
);
```

源码位置：`src/extensions/health_check/utils/modRequirements/onDownloadRequirement.ts:72-112`。

### 8.4 更省事的方式

如果只要「下载某个 mod 的某个文件」，可直接：

```ts
const dlId = await context.api.ext.nexusDownload(gameId, modId, fileId);
```

它内部就是 `ensureLoggedIn() → downloadFile() → start-download` 的一层封装，返回值是下载 id。

---

## 9. 打包、调试与分发

### 9.1 依赖与构建

```json
{
  "devDependencies": {
    "@nexusmods/vortex-api": "^2.2.0",
    "typescript": "^5",
    "webpack": "^5"
  }
}
```

- `@nexusmods/vortex-api` 把 React/Redux/Bluebird 等声明为 **peerDependencies**，不要打进包里。
- 产物必须是**单文件** CJS（`index.js` / `index.cjs`），所有第三方依赖 inline 进去（除宿主提供的 peer）。
- webpack 配置要点：`target: 'electron-renderer'`、`libraryTarget: 'commonjs2'`、
  `externals` 里排除 `@nexusmods/vortex-api`（其实它本身就是转发到宿主）。

### 9.2 本地安装/调试

**官方推荐的起手式：直接用样例扩展脚手架**

```powershell
git clone https://github.com/nexus-mods/sample-extension.git my-extension
cd my-extension
yarn install
yarn build        # 构建可分发产物
yarn copyplugin   # 自动复制到 %APPDATA%\vortex\plugins
yarn lint         # ESLint 检查
yarn bundle7z     # 打成可分发的 .7z
```

样例扩展自带 ESLint 规则、webpack 配置与上述脚本，是最省事的起点。

**手动流程**

1. 构建出 `index.js` + `info.json`；
2. 复制到 `%APPDATA%\Vortex\plugins\my-extension\`；
3. 重启 Vortex（或从「扩展」页重新加载）；
4. 渲染进程 DevTools：**F12**（源码里 `browser-window-created` 绑定了 F12 → `toggleDevTools`）；
5. 日志：`%APPDATA%\Vortex\vortex.log`；需要详细日志时设环境变量 `VORTEX_ENABLE_LOGGING=1`。

> 开发期把插件目录做成**指向构建产物的符号链接**，改完只需重启 Vortex，不必反复复制。

### 9.3 分发（有坑，务必先看清楚）

**官方分发通道 = 上传到 <https://www.nexusmods.com/site>**（Nexus 专门给 Vortex 扩展开的"游戏"域，
在 Vortex 内部 id 就是 `"site"`）。

Wiki 上有两版说明，**以较新的《How to package a game extension》为准**：

| 要求 | 说明 |
| --- | --- |
| 分类 | 上传到 **Modding Tools > Vortex Extensions** 分类 |
| 主文件唯一 | “Main Files” 下只能有一个文件 |
| 版本 | semver；**`info.json` 的 version 必须与站点上填的完全一致** |
| 命名 | 名字不要带版本号，后续更新不要改名 |
| 生效时间 | 上传后 **2 小时内**被 Vortex 抓取；**不需要先等审核**（之后是周期性复审） |
| 一游戏一扩展 | Vortex 每个游戏只展示一个扩展；多个时取 **endorsement 最多**的那个 |
| 压缩包结构 | `info.json` / `index.js`（游戏扩展还需 `gameart.png`）**必须在压缩包根目录** |

> 最常见的审核/加载失败原因：**把文件全塞进压缩包里的一个文件夹**（`my-ext/index.js` ✗，应为 `index.js` ✓）。

游戏扩展的 `info.json` 还要求 `gameId`（Nexus 数字游戏 id），可从
`https://data.nexusmods.com/file/nexus-data/games.json` 查（无需 API Key）。功能扩展没有这个字段。

**⚠️ 一个重要的现实限制（源码级发现）**：

Vortex 内置「扩展（Extensions）」页的数据来自 Nexus 的 v3 接口 `GET /v3/vortex/extensions`，
返回结构只有三段：`extensions`（**type = game**）、`themes`、`translations`
（见 `src/extensions/extension_manager/availableExtensions.ts`）。
也就是说，**这个列表是给「游戏扩展 / 主题 / 翻译」准备的，通用功能扩展（feature extension）不一定能进这个列表**。

更麻烦的是：`extension_manager/index.ts` 注册了一个 `site-installer`（优先级 0），

```ts
context.registerInstaller("site-installer", 0,
  (_, gameId) => Promise.resolve({ supported: gameId === "site", requiredFiles: [] }),
  () => Promise.reject(new ProcessCanceled("Extensions have to be installed from the extensions page.")));
```

意思是：**来自 `site` 域的扩展包，不能当普通 mod 安装**，会直接被拒绝并提示「请到扩展页安装」。

因此本项目的分发路径实际是：

| 方式 | 可行性 | 说明 |
| --- | --- | --- |
| Vortex 扩展页一键安装 | ⚠️ 需与官方确认 | 取决于 Nexus 是否接受「功能扩展」进 v3 feed |
| Nexus `/site` 页面上架 + 用户手动装 | 中 | 用户从站点下载压缩包 → 解压到 `%APPDATA%\Vortex\plugins\<name>\` |
| GitHub Releases + 安装脚本 | 高 | 最省事：`install.ps1` 复制到 plugins 目录；或提供 `.bat` |
| 随游戏扩展"捆绑" | 中 | 把功能扩展作为某个游戏扩展的依赖一起分发（需该游戏扩展配合） |

> 建议：MVP 阶段先用 **GitHub Release + 一键安装脚本 + 图文说明**，验证有需求后再去和 Nexus 官方谈上架。

### 9.4 兼容性策略

- GraphQL/Web API 与 Vortex 内部 API 都可能变：所有 `api.ext.*` 调用都用 `?.`，并做降级。
- 用 `requireExtension()` 声明对内置扩展（如 `nexus_integration`）的依赖，缺失时自动不加载，避免半残状态。

---

## 10. 常见坑清单

| # | 坑 | 正确做法 |
| --- | --- | --- |
| 1 | 在 `init` 里读 `api.getState()` | 放到 `once()` 或 `gamemode-activated` 回调里 |
| 2 | 在 `init` 里做网络请求/IO | 同上；`init` 会被调用两次 |
| 3 | 用 `Object.keys(context)` 探测能力 | 用 `context.optional.registerXxx` 或 `requireExtension` |
| 4 | `registerReducer` 写在 init 末尾 | 放在 **第一行**，否则其他依赖它的注册可能读到空 state |
| 5 | 把 `state` 存进闭包当快照 | 永远 `api.getState()` 实时取；state 是不可变对象 |
| 6 | 自己 `fetch('https://api.nexusmods.com/...')` | 浏览器 CORS 会拦（主窗口 `webSecurity` 默认开启）；用 `https`/`net` 模块或走 `api.ext` |
| 7 | 自己拼 Nexus 下载直链 | 走 `nxm://` + `start-download`，让宿主处理会员/签名 |
| 8 | 扩展样式污染全局 | SCSS 全部包在 `#my-ext-root` 之类的前缀下 |
| 9 | 中英文硬编码 | 用 `api.translate(key, { ns: ['myext','common'] })` + `language.json` |
| 10 | 把 React 打进 bundle | 作为 peer 依赖 externals，否则 hooks/context 双实例直接崩 |
| 11 | `info.json` 版本不递增 | 同名扩展按 semver 比大小，版本低的不加载 |
| 12 | 假设 `api.ext.xxx` 一定存在 | 全部可选链 + 缺失时禁用功能并提示 |
| 13 | 硬编码绝对路径（`C:\Games\...`） | 一律用相对路径 / `api.getPath('userData')` / `__dirname` 推导，保证换机器可用 |
| 14 | 引用不存在的目录 | 先 `fs.ensureDirWritableAsync(path)` 建目录再写；官方审核会专门查这条 |

---

## 11. 参考链接

**Wiki 页面（官方）**
- Wiki 首页：<https://github.com/Nexus-Mods/Vortex/wiki>
- 扩展入门：<https://github.com/Nexus-Mods/Vortex/wiki/MODDINGWIKI-Developers-General-Introduction-to-Vortex-extensions>
- API 事件参考：<https://github.com/Nexus-Mods/Vortex/wiki/MODDINGWIKI-Developers-Reference-API-events>
- 添加主页面：<https://github.com/Nexus-Mods/Vortex/wiki/MODDINGWIKI-Developers-General-Adding-a-main-page>
- 用 React 构建 UI：<https://github.com/Nexus-Mods/Vortex/wiki/MODDINGWIKI-Developers-General-Building-UI-with-Vortex-and-React>
- 打包扩展：<https://github.com/Nexus-Mods/Vortex/wiki/MODDINGWIKI-Developers-General-Packaging-an-extension>
- 测试游戏扩展：<https://github.com/Nexus-Mods/Vortex/wiki/How-to-test-a-game-extension>
- 上传扩展到 Nexus：<https://github.com/Nexus-Mods/Vortex/wiki/How-to-upload-an-extension-to-nexus>
- 常见 API 用法（Legacy，但模式仍有参考价值）：<https://github.com/Nexus-Mods/Vortex/wiki/LEGACY-Tutorial-Common-patterns-Vortex-API-usage>
- 开发环境搭建（Legacy）：<https://github.com/Nexus-Mods/Vortex/wiki/LEGACY-General-Setting-up-your-dev-environment>

**代码与类型**
- 扩展 API 类型包：<https://www.npmjs.com/package/@nexusmods/vortex-api>
- 旧类型仓库（已归档）：<https://github.com/Nexus-Mods/vortex-api>
- Vortex 主仓库：<https://github.com/Nexus-Mods/Vortex>

**本地校验依据（Vortex 2.8.2）**
- `resources/app.asar` → `src/types/IExtensionContext.ts`（注册表与 api 定义）
- `src/ExtensionManager.ts:697/742/2826/2894`（加载路径、入口格式、info.json 解析）
- `src/extensions/extension_manager/extensionInfo.ts`（info.json 的 zod schema）
- `src/extensions/nexus_integration/nxmProtocol.ts`（nxm 下载协议）
- `src/extensions/health_check/utils/modRequirements/onDownloadRequirement.ts:72-112`（start-download 标准调用）
- `src/extensions/browse_nexus/{index.ts,views/BrowseNexusPage.tsx}`（管理器内浏览页范例）
