# 交接报告 · Nexus Mod Browser（Vortex 扩展）

> **文档性质**：模块级交接文档。每完成一个模块，就在 §3 补一节。
> **项目大纲**（需求与总体设计，不在本文重复）：
> - `../Vortex-N网MOD浏览插件方案.md`
> - `../Vortex插件开发接口与方法.md`
>
> **最后更新**：2026-10-21 · **进度**：数据层 + 下载桥接完成，UI 待重写

---

## 0. 当前进度总览

**版本 0.6.3** · 作者 `MC10086AAA` · 许可证 MIT · 单元测试 47 项

| 模块 | 状态 | 说明 |
| --- | --- | --- |
| 工程骨架 / 构建 / 打包 / 安装 / 自测脚本 | ✅ 完成 | 零 npm 依赖，离线可构建 |
| GraphQL 传输层 `nexus/client.ts` | ✅ 完成 | 含超时、错误归一化、限流提示 |
| 查询定义 `nexus/queries.ts` | ✅ 完成 | 4 条实测查询 + 变量构造 |
| 业务服务 `nexus/service.ts` | ✅ 完成 | 缓存、并发去重、文件排序 |
| 状态层 `state/reducer.ts` | ✅ 完成 | `session.nexusBrowser` |
| 下载桥接 `bridge/download.ts` | ✅ 完成 | 两条路径：Premium 走 `start-download`；免费账号直接开浏览器；支持作废/超时 |
| 工具层 `util/*` | ✅ 完成 | 游戏上下文、格式化、外链、已安装判定、文件分类 |
| **UI** | ✅ 完成 | 复刻官方「Browse Nexus Mods」外观；复用宿主 `MainPage` + `nxm-*` 语义类 |
| 搜索 / 分页 / 排序 / 刷新 | ✅ 完成 | 走 `NexusService`（缓存 + 去重） |
| 卡片「Download」 | ✅ 完成 | 只取主文件；多个主文件弹窗选择；免费账号开浏览器 |
| 卡片「View page」 | ✅ 完成 | `shell.openExternal` 打开 Nexus 页面 |
| 「Installed !」徽标 | ✅ 完成 | 卡片右下角；按 `attributes.modId` 判定，不靠名字 |
| 详情面板 | ⬜ 不做 | 官方整合包页面也没有详情面板，保持一致 |
| 封面图 / 页面文案 | ✅ 完成 | 封面在项目外的 `工作区\Nexus页面素材\`；文案在 `docs/03-Nexus页面文案.md` |
| 发布包 | ✅ 完成 | 0.6.3；上传用副本命名为 `Nexus Mod Browser - Vortex Extension <版本>.zip` |
| 设置页 / 国际化 / Mods 表集成 | ⬜ 未开始 | 见 §6 |

**验收状态**：47 项单元测试 + 5 组冒烟场景全过；核心流程已在用户的真实 Vortex 里逐项验证通过。

---

## 1. 目录结构

```
nexus-mod-browser/
├── info.json                  # 扩展元数据（Nexus 上传用，版本必须与站点一致）
├── package.json               # 只有 scripts，无 dependencies
├── tsconfig.json              # tsc 配置（jsx: react，输出 CommonJS）
├── README.md                  # 面向用户/站点页面的说明
├── HANDOVER.md                # 本文件
├── LICENSE                    # MIT
├── NOTICE                     # 第三方资源说明（MDI 图标、Vortex 类名）
├── .gitignore                 # 忽略 dist/build/release/node_modules
│                              # 仓库副本另在 E:\Github\nexus-mod-browser（见 §8）
├── docs/                      # 设计与接口文档（随仓库发布）
│   ├── 01-Vortex插件开发接口与方法.md
│   ├── 02-插件可行性评估与实施方案.md
│   └── 03-Nexus页面文案.md   # 发布用的中英双语文案（Summary + BBCode 描述 + 文件名规则）
├── src/
│   ├── index.ts               # 入口：registerReducer + registerMainPage
│   ├── constants.ts           # URL / 分页 / 缓存 / action 名
│   ├── types.ts               # 内部数据模型
│   ├── nexus/
│   │   ├── client.ts          # https POST + 错误归一化
│   │   ├── queries.ts         # 4 条 GraphQL + buildSearchVariables
│   │   ├── service.ts         # 缓存/去重/业务封装
│   │   └── index.ts           # 单例入口
│   ├── bridge/
│   │   └── download.ts        # ★ 下载桥接（本阶段核心）
│   ├── state/
│   │   └── reducer.ts         # session.nexusBrowser
│   ├── util/
│   │   ├── game.ts            # 游戏上下文（复刻官方 selectors）
│   │   ├── format.ts          # 数字/字节/日期/BBCode
│   │   ├── mods.ts            # 已安装判定（attributes.modId，不按名字）
│   │   ├── modFiles.ts        # 文件分类：MAIN/OPTIONAL… 兼容数字与枚举名
│   │   └── openExternal.ts    # 打开外部链接
│   ├── ui/                    # 官方同款外观（复用宿主 CSS 语义类）
│   │   ├── BrowseModsPage.tsx # 页面装配（当前为静态样张）
│   │   ├── ModTile.tsx        # Mod 卡片（镜像官方 CollectionTile 结构）
│   │   ├── primitives.tsx     # Button / TabBar / Pagination / SortMenu
│   │   ├── icons.tsx          # 内联 mdi 图标 path
│   │   └── sampleData.ts      # 样张假数据（接真实数据后删除）
│   └── typings/
│       └── shims.d.ts         # React / Node / vortex-api 的最小类型声明（见 §4.2）
├── scripts/
│   ├── tsbuild.js             # 构建（自动找 TypeScript 编译器）
│   ├── install.js             # 装到 %APPDATA%\Vortex\plugins
│   ├── uninstall.js           # 从插件目录删除（先退出 Vortex）
│   ├── pack.js                # 打发布包（7-Zip 优先）
│   ├── selftest.js            # 19 项单元测试（假 https）
│   ├── smoketest.js           # 冒烟测试（加载 + init + 渲染）
│   ├── render-preview.js      # 生成静态预览 HTML（套宿主真实 CSS）
│   └── stubs/                 # react / vortex-api 测试替身
├── build/preview/             # 预览产物（preview.html + tailwind.css）
├── dist/                      # 构建产物（不入库时可忽略）
└── release/                   # 发布包
```

> **不想装进 Vortex 就想看外观**：`node scripts/render-preview.js` 会生成
> `build/preview/preview.html`（内嵌宿主真实的 tailwind-v4.css），直接用浏览器打开即可。

---

## 2. 常用命令

> 全部是 Node 脚本，**不需要 npm install**，也不需要联网。

| 目的 | 命令 |
| --- | --- |
| 编译 | `node scripts/tsbuild.js`（或 `npm run build`） |
| 只做类型检查 | `node scripts/tsbuild.js --noEmit` |
| 单元测试 | `node scripts/selftest.js` |
| 冒烟测试 | `node scripts/smoketest.js` |
| 装到本机 Vortex | `node scripts/install.js` |
| 从本机 Vortex 卸载 | `node scripts/uninstall.js`（先完全退出 Vortex） |
| 生成静态预览 | `node scripts/render-preview.js` → 打开 `build/preview/preview.html` |
| 打发布包 | `node scripts/pack.js`（加 `--7z` 同时出 .7z） |

**构建脚本的编译器查找顺序**：环境变量 `TSC_PATH` → 项目内 `node_modules/typescript` → VS Code 自带 TypeScript。
本机实测命中：`E:\Software\Microsoft VS Code\<hash>\resources\app\extensions\node_modules\typescript\lib\typescript.js`（v6.0.3）。

**安装后必须重启 Vortex** 才会加载扩展。

---

## 3. 模块接口文档

### 3.1 `src/constants.ts`

集中所有"魔法值"。改行为优先改这里。

| 导出 | 用途 | 现值 |
| --- | --- | --- |
| `GRAPHQL_ENDPOINT` | Nexus GraphQL v2 端点 | `https://api.nexusmods.com/v2/graphql` |
| `NEXUS_BASE_URL` | 站点根地址 | `https://www.nexusmods.com` |
| `EXTENSION_ID` | 扩展 id | `nexus-mod-browser` |
| `PAGE_TITLE` | 导航标题 | `Browse Nexus Mods` |
| `DEFAULT_PAGE_SIZE` | 每页条数 | `24`（GraphQL `count` 建议 ≤50） |
| `SEARCH_DEBOUNCE_MS` | 输入防抖 | `350` |
| `CACHE_TTL_MS` | 搜索/详情缓存 | 5 分钟 |
| `GAME_CACHE_TTL_MS` | 游戏解析缓存 | 24 小时 |
| `REQUEST_TIMEOUT_MS` | 单请求超时 | 20 秒 |
| `ACTIONS` | Redux action 名（17 个） | 见 `reducer.ts` |
| `SORT_OPTIONS` | UI 排序项 → GraphQL 字段 | relevance / endorsements / downloads / updatedAt / createdAt |

---

### 3.2 `src/nexus/client.ts`

**职责**：唯一与 `api.nexusmods.com` 通信的地方。

```ts
graphql<T>(query: string, variables: object, apiKey?: string): Promise<T>
describeError(err: INexusError): string
```

| 参数 | 说明 |
| --- | --- |
| `query` | GraphQL 查询字符串（来自 `queries.ts`） |
| `variables` | 变量对象 |
| `apiKey` | 用户 Nexus API Key；**不传则匿名请求**（大部分查询仍可用） |

**行为约定**
- 必须是 POST（GET 会 404）。
- 先看 HTTP 状态：非 2xx 抛 `INexusError`；`429` 单独给出"请求过于频繁"文案，`403` 提示 Key 失效。
- 再看响应体 `errors[]`：取第一条的 `extensions.code` 作为 `err.code`（如 `UNAUTHORIZED` / `ADULT_CONTENT_BLOCKED` / `NOT_FOUND`）。
- `data` 为 null 也视为错误。
- 请求头带 `User-Agent: Vortex-NexusModBrowser/0.1.0`（便于 Nexus 侧识别客户端）。

**为什么用 Node `https` 而不是 `fetch`**：Vortex 主窗口 `webSecurity` 默认开启，渲染进程 `fetch` 受 CORS 限制；
扩展运行在 `nodeIntegration: true` 的渲染进程里，用 `https` 可以完全绕开，并能设置 `apikey` 头。

**错误码 → 中文提示**（`describeError`）

| code | 提示 |
| --- | --- |
| `UNAUTHORIZED` | 需要登录 Nexus Mods |
| `ADULT_CONTENT_BLOCKED` | 被成人内容偏好拦截，去站点改设置 |
| `NOT_FOUND` | 资源不存在/被隐藏 |
| `undefinedField` / `argumentNotAccepted` | 查询与 API 版本不匹配，提示更新插件 |
| 其他 | 原样返回 message |

---

### 3.3 `src/nexus/queries.ts`

4 条查询，全部来自实测通过的《GraphQL 参考》R1–R4、R8。

| 导出 | 用途 | 关键点 |
| --- | --- | --- |
| `Q_SEARCH_MODS` | 搜索/浏览列表 | `mods(filter, sort, offset, count)` |
| `Q_MOD_DETAIL` | 详情 | `mod(modId, gameId)` **两个参数都要** |
| `Q_MOD_FILES` | 文件列表 | `sizeInBytes` 是 BigInt 字符串 |
| `Q_RESOLVE_GAME` | domain → 游戏 | 用来判断"这游戏在不在 Nexus 上" |
| `buildSearchVariables(opts)` | 构造变量 | 见下 |

```ts
buildSearchVariables({
  domain: "skyrimspecialedition",  // Nexus 域名
  query: "weather",                // 空字符串 = 按排序浏览
  sortField: "relevance",          // ModsSort 字段名
  offset: 0,                       // 0-based
  count: 24,
})
```

行为：
- 过滤树固定为 `{ op: "AND", filter: [ gameDomainName EQUALS, nameStemmed WILDCARD? ] }`；
- 用 `nameStemmed` 而不是 `name`（词干匹配、不区分标点，模糊搜索体验更好）；
- **空关键词时把 `relevance` 自动换成 `endorsements`**，否则 Nexus 返回顺序不稳定。

---

### 3.4 `src/nexus/service.ts`

**职责**：业务编排 + 缓存 + 去重。UI 只调这一层，不碰 GraphQL。

```ts
class NexusService {
  constructor(getApiKey: () => string | undefined)
  clear(): void
  resolveGame(domain: string): Promise<INexusGame | undefined>
  search(options: ISearchOptions): Promise<ISearchResult>
  modDetail(domain: string, modId: number): Promise<IModDetail>
  modFiles(domain: string, modId: number): Promise<IModFile[]>
}
```

| 方法 | 参数 | 返回 | 说明 |
| --- | --- | --- | --- |
| `resolveGame` | `domain` | `{id,name,domainName,modCount,supportsVortex}` 或 `undefined` | 24h 缓存；`undefined` = 该游戏无 Nexus 页面 |
| `search` | `ISearchOptions` | `{totalCount, nodes[]}` | 5min 缓存；key 由完整变量序列化 |
| `modDetail` | `domain, modId` | `IModDetail` | 内部先 `resolveGame` 拿数字 gameId |
| `modFiles` | `domain, modId` | `IModFile[]` | 已排序：主文件（`category===1`）优先，其余按日期倒序 |
| `clear` | — | — | 清空缓存与在途请求（切游戏/点刷新时用） |

**缓存与去重实现**：`load(key, ttl, loader)` —— 命中缓存直接返回；同一 key 有在途 Promise 就复用它
（用户狂点或并发渲染只发一次请求）。**注意**：`undefined` 结果也会被缓存（游戏不存在这种情况不值得反复查）。

---

### 3.5 `src/nexus/index.ts`

```ts
getNexusService(api): NexusService   // 单例，跨页面挂载存活
resetNexusService(api): void         // 清缓存
```

单例是为了让缓存和去重跨页面切换存活，避免每次切回浏览页都重打 API。

---

### 3.6 `src/state/reducer.ts`

注册路径 **`["session", "nexusBrowser"]`**（`session` = 不持久化，符合官方约定）。

```ts
reducerSpec                        // { reducers, defaults }
nexusBrowserSlice(state)           // 防御式取切片，缺省回退 DEFAULTS
actions                            // 14 个 action creator
DEFAULTS                           // 初始状态
```

**state 形状**（`INexusBrowserState`）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `domain` | string? | 当前结果对应的 Nexus 域名；与当前游戏不一致时触发重查 |
| `query` | string | 已提交的关键词（输入框实时值不在 redux 里） |
| `sort` | string | `ModsSort` 字段名 |
| `page` | number | 0-based |
| `totalCount` | number | 总数，用于算分页 |
| `results` | IModSummary[] | 当前页 |
| `loading` | boolean | **同时是"需要查询"的信号**（见下） |
| `error` | `{code?,message}`? | 归一化后的错误 |
| `selectedModId` | number? | 当前打开的详情 |
| `detail` | IModDetail? | 详情缓存 |
| `files` | IModFile[] | 文件列表 |
| `detailLoading` | boolean | 详情/文件加载中 |
| `autoInstall` | boolean | 下载后自动安装（默认 true） |

**关键约定：`loading` 是"待查询"标志。** 任何改变查询参数的动作（SET_QUERY / SET_SORT / SET_PAGE / SET_GAME）
都会置 `loading = true`，页面监听到 `loading && domain` 就发请求，完成后 `LOAD_SUCCESS`/`LOAD_ERROR` 清零。
好处：不会出现重复请求或 effect 死循环，也不需要在组件里维护"上一次参数"。

**action 列表**：`setQuery` `setSort` `setPage` `loadStart` `loadSuccess` `loadError` `setGame` `selectMod`
`closeDetail` `setDetail` `setFiles` `setAutoInstall` `reset`。

> `downloading` 字段与 `downloadStart/downloadDone` 已移除——下载中的状态由页面内的 `busyMods`（按 modId）维护，
> 因为文件要等 `modFiles` 请求回来才知道 fileId。

> 用普通对象 action（`{type, payload}`），不依赖 `redux-act`。

---

### 3.7 `src/bridge/download.ts` ★ 本阶段核心

```ts
buildNxmUrl(domain, modId, fileId): string
downloadModFile(api, request: IDownloadRequest): Promise<IDownloadOutcome>
```

**`IDownloadRequest`**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `domain` | string | ✅ | Nexus 域名，用于拼 `nxm://<domain>/...` |
| `internalGameId` | string | ✅ | **Vortex 内部 game id**（如 `skyrimse`），下载器按它决定落盘目录 |
| `modId` | number | ✅ | |
| `fileId` | number | ✅ | |
| `fileName` | string | ❌ | 不传则由 Vortex 从响应头推断 |
| `autoInstall` | boolean | ✅ | 下载完成后是否 `start-install-download` |

**`IDownloadOutcome`**

| 字段 | 说明 |
| --- | --- |
| `downloadId` | Vortex 下载 id（成功时） |
| `installedModId` | 自动安装后的 mod id（未安装/失败时 undefined） |
| `canceled` | 用户取消（免费账号授权弹窗点取消） |
| `alreadyDownloaded` | 该文件之前已下载过 |

**内部流程**

```
buildNxmUrl(domain, modId, fileId)
  → api.events.emit("start-download", [nxmUrl],
        { game: internalGameId, name, fileId, modId },   // modInfo
        undefined,                                        // 文件名交给宿主
        cb,                                               // (err, downloadId)
        undefined,                                        // redownload
        { allowInstall: false })
  → 若 autoInstall && downloadId：emit("start-install-download", downloadId,
        { allowAutoEnable: true }, cb)
```

**两条下载路径（v0.6.0 起）**

入口统一是 `downloadForUser()`，它按账号自动选路：

| 账号 | 走哪条 | 行为 |
| --- | --- | --- |
| **Premium**（`userInfo.isPremium === true`） | `downloadModFile` | emit `start-download`，宿主换签名直链、进队列；**无弹窗，一键** |
| **免费**（`userInfo.isPremium === false`） | `downloadViaBrowser` | **不 emit**，直接用系统浏览器打开文件页（带 `nmm=1`）；用户在网页点一次 "Download with Vortex"，带 key 的 nxm 链接回到 Vortex 自动建下载 |
| **会员信息未加载**（`userInfo === undefined`） | `downloadModFile` | 不瞎猜，交给宿主的标准流程（它会自己判断） |

> 为什么要自己开浏览器：免费账号拿不到签名直链（API 返回 403），Nexus 要求用户在网页上"授权"一次。
> 宿主原本会先弹 `FreeUserDLDialog`（那个有「跳过模组」的框）再开浏览器；直接开浏览器能**省掉一次点击**，
> 也不再出现那个容易误解的弹窗。

**下载状态与回调（重要）**

`start-download` 的回调**只在文件落盘后**才触发（源码 `IPCDownloadAdapter.ts:497`）。
所以两条路都靠"轮询 store 里的下载记录"来推进 UI（实现：`watchDownloadRecord`）：

| 观测信号 | 位置 | 结果 |
| --- | --- | --- |
| 下载记录出现 | 见下方"两种 modInfo 形状" | 触发一次 `onStarted` → UI 切到 Downloading… |
| 记录变 `finished` | `record.state` | 返回 `{downloadId}`（回调丢了也能继续安装） |
| 记录变 `failed` | 同上 | 返回 `{}` |
| 记录中途消失 | 同上 | 返回 `{canceled:true}`（用户删了下载） |
| 授权弹窗挂起后消失、且无记录 | `session.nexus.freeUserDLQueue` | 返回 `{canceled:true}`（仅在 emit 路径可能出现） |
| 一直没开始下载 | — | 超过 `startTimeoutMs`（**统一 2 分钟**）→ `{pending:true}`，界面停止等待、按钮恢复 |

**两种 `modInfo` 形状（都真实存在，匹配时必须都认）**

```js
// 1) 我们自己 emit 时传的（Premium 路径）
{ game, name, modId, fileId }

// 2) 宿主从 nxm 链接下载时（免费账号网页授权回来后）—— 见 nexus_integration/util.ts:777
{ game, source:"nexus", name, nexus: { ids: { gameId, modId, fileId }, modInfo, fileInfo } }
```

第 2 种**没有顶层的 modId/fileId**，早期版本只按顶层匹配，导致免费账号永远收不到 `onStarted`
（按钮一直不变成 Downloading…）。现在 `findDownloadRecord()` 两种都匹配，且 id 用 `Number()` 归一化
（字符串/数字都能对上）。**这是 v0.6.1 修的真实 bug。**

> `startTimeoutMs` 默认值：**2 分钟**（Premium 与免费一致），导出为 `DEFAULT_START_TIMEOUT_MS` 供测试断言。

**onStarted 的意义**：点击 Download 时**不**立即把按钮改成 Downloading…。
只有 `onStarted`（下载真的开始）才切换；等待期间按钮仍是 Download，可反复点击
（页面用 `pendingRef` 按 modId 去重，避免重复请求/重复弹浏览器）。

> 注意：**一旦下载开始就不再计时**（`!sawRecord` 才判超时），所以 20 分钟的大文件不会被打断。

> 实现细节：监听必须在 emit **之前**挂上，且只能有**一个**轮询定时器。
> 所以 `watchDownloadRecord` 提供 `kickoff` 回调，由它内部触发 emit；
> 早期版本用 `Promise.race` 导致败者的 interval 泄漏、Node 进程退不出去（已有教训）。

回归测试：`scripts/selftest.js` §[5] 与 §[9]，共 11 项。

**错误处理约定**
- `UserCanceled`（按 `err.name` 判断，不 import 宿主类）→ 返回 `{canceled:true}`，**不弹错误**；
- `AlreadyDownloaded` → 返回 `{alreadyDownloaded:true}`，由 UI 提示"已在下载列表中"；
- 其他错误 → `api.showErrorNotification` + 返回 `{}`；
- 安装阶段失败 → 通知后返回 `installedModId: undefined`（下载本身仍是成功的）。

**为什么只能走 `nxm://`**（重要，别改）
1. Nexus 的下载直链是按账号/会员实时签名、带过期的，GraphQL 没有"取下载地址"的查询；
2. 免费账号必须走官网授权跳转，Vortex 会打开系统默认浏览器到 `…?tab=files&file_id=<fid>&nmm=1`；
3. 断点续传、MD5 校验、下载目录管理全在 Vortex 内部，插件不该重复实现。

**`start-download` 的参数校验（源码实证，改参数前必读）**

Vortex 2.8.2 的 `IPCDownloadAdapter.ts` 用 zod 校验该事件的全部参数，
**校验失败只打一条 warn 日志然后直接 return（静默失败、不触发回调）**：

```ts
const modInfoSchema = z.looseObject({
  game: z.string().optional(),
  name: z.string().optional(),
});   // looseObject：额外的 fileId / modId 会被保留

const startDownloadArgsSchema = z.tuple([
  z.array(urlStringSchema),                                   // urls
  modInfoSchema,                                              // modInfo
  z.string().optional(),                                      // fileName
  z.function({ input: [z.unknown().nullable(), z.string().optional()] }).optional(), // callback(err, dlId)
  z.enum(["never", "ask", "replace", "always"]).optional(),    // redownload
  z.object({ allowInstall: z.union([z.boolean(), z.literal("force")]).optional() }).optional(),
]).rest(z.unknown());
```

对应的正确调用（本模块已按此实现，参数结构已比对）：

```ts
api.events.emit("start-download",
  [nxmUrl],                                                   // 1 urls
  { game: internalGameId, name: fileName, fileId, modId },     // 2 modInfo（game 必须是内部 id）
  undefined,                                                   // 3 fileName（交给宿主推断）
  (err, dlId) => { ... },                                      // 4 callback
  undefined,                                                   // 5 redownload
  { allowInstall: false });                                    // 6 options
```

> `allowInstall` 也接受字符串 `"force"`；`redownload` 控制重复下载策略，MVP 不传即用默认。

---

### 3.8 `src/util/game.ts`

**职责**：在不 import 宿主模块的前提下复刻官方选择器。

| 函数 | 对应官方实现 |
| --- | --- |
| `activeGameId(state)` | `profile_management/selectors.ts:11` |
| `knownGames(state)` | `gamemode_management/selectors.ts:11` |
| `gameById(state, id)` | 同上（数组 find） |
| `nexusDomain(state, gameId)` | `nexus_integration/util/convertGameId.ts:22` |
| `nexusApiKey(state)` | `nexus_integration/selectors.ts:11` |
| `isNexusLoggedIn(state)` | `nexus_integration/selectors.ts:49` |
| `isPremium(state)` | `nexus_integration/selectors.ts:25` |
| `gameName(state, id)` | 展示用 |

**`nexusDomain` 的映射规则**（与官方完全一致）：
1. 游戏扩展声明了 `details.nexusPageId` → 用它；
2. 否则查硬编码表：`skyrimse/skyrimvr → skyrimspecialedition`、`falloutnv → newvegas`、`fallout4vr → fallout4`、`teso → elderscrollsonline`；
3. 再否则小写原样返回。

> ⚠️ 注意区分：**内部 id**（`skyrimse`）用于 `modInfo.game`；**Nexus 域名**（`skyrimspecialedition`）用于 GraphQL 过滤与 `nxm://`。
> 两者混淆会导致"下载落到错误游戏目录"这类难查的问题。

---

### 3.9 `src/util/format.ts`

纯函数，全部有单测覆盖。

| 函数 | 示例 |
| --- | --- |
| `formatCount(1234)` | `"1.23K"` |
| `formatBytes("56674")` | `"55.3 KB"`（同时接受 BigInt 字符串与 number） |
| `formatDate("2024-05-01T...")` | `"2024-05-01"` |
| `formatUnixDate(1714521600)` | 同上（`ModFile.date` 是 Unix 秒） |
| `bbcodeToPlainText(text)` | 去掉 BBCode/HTML 标签与 `[img]`，保留换行 |
| `truncate(text, max)` | 按单词边界截断并加 `…` |

---

### 3.10 `src/util/openExternal.ts`

| 函数 | 说明 |
| --- | --- |
| `openExternal(url)` | 优先 `electron.shell.openExternal`，兜底 `window.open` |
| `modPageUrl(domain, modId)` | `https://www.nexusmods.com/<domain>/mods/<id>` |
| `modFilePageUrl(domain, modId, fileId?)` | 追加 `?tab=files&file_id=..&nmm=1` |

> `nmm=1` 是 Vortex 自己给免费用户用的"Download with Vortex"入口参数（源码 `nxmProtocol.ts:253`）。

---

### 3.11 `src/ui/*`（官方同款外观，已接真实数据）

目标外观 = 官方「Browse Nexus Mods」页。**复用策略**：

| 层 | 复用方式 |
| --- | --- |
| 页面外壳 | `import { MainPage } from "@nexusmods/vortex-api"` —— 宿主运行时导出 |
| 控件外观 | 宿主全局 CSS 里的 `nxm-*` 语义类（150 个，见 §3.11.1），**不复制源码** |
| 布局/字号/颜色 | 宿主 tailwind 工具类（`bg-surface-mid`、`text-body-sm`、`border-stroke-weak`…） |
| 图标 | 内联 `@mdi/js` 的 path（Apache-2.0），与宿主同一套图标 |

| 文件 | 作用 |
| --- | --- |
| `ui/BrowseModsPage.tsx` | 页面装配：标签栏 + 搜索行 + 结果数/排序 + 卡片网格 + 分页；接 `session.nexusBrowser` + `NexusService` |
| `ui/ModTile.tsx` | 卡片。结构镜像官方 `CollectionTile`；底部按钮 **Download / View page**（英文，符合 Nexus 生态） |
| `ui/primitives.tsx` | `Button` / `TabBar` / `TabButton` / `Pagination` / `SortMenu`（薄封装，只负责拼类名） |
| `ui/chooseFile.ts` | **选文件逻辑**：只认 MAIN；多个 MAIN 时用宿主原生 `showDialog + choices` 弹窗让用户选（见 §3.11.2） |
| `ui/icons.tsx` | 11 个图标 path + `Icon` / `ButtonIcon` |

**当前页面行为**

| 交互 | 行为 |
| --- | --- |
| 打开页面 | 若当前游戏与 `slice.domain` 不一致 → `SET_GAME` → 自动查询（默认按点赞排序） |
| 搜索框 | 回车或点放大镜 → `SET_QUERY`（重置到第 1 页） |
| 刷新按钮 | `resetNexusService()` 清缓存 + `SET_PAGE` 强制重查 |
| 排序 | `SET_SORT`；文案为 `English（中文）`，如 `Most Endorsed（点赞最多）`。按钮固定宽 240、内容左对齐（箭头在右），下拉面板 `left-0` 与按钮左缘对齐 |
| 分页 | 总数 > 24 时出现，`SET_PAGE`（0-based），翻页后回到顶部 |
| Download | 取文件列表 → `chooseModFile()`：唯一 MAIN 直接下载；多个 MAIN 先弹窗选择。然后 `downloadForUser()` 按会员自动选路（Premium 走 API / 免费开浏览器）。**下载真正开始后**按钮才变 `Downloading…`（之前可反复点，`pendingRef` 去重） |
| View page / 点封面 | `shell.openExternal` 打开 `https://www.nexusmods.com/<domain>/mods/<id>` |
| 卡片布局 | 容器 `flex flex-col` + 内容区 `grow`，底部按钮条固定在卡片底部，同一行卡片高度一致 |
| 已安装标记 | 卡片**右下角**：与 Download 同一行、用 `ml-auto` 推到行末，`Installed !`（绿色 `text-success-strong`）。不改变按钮栏结构。判定依据是 `persistent.mods[gameId][*].attributes.modId`（Nexus 数字 id），**不按名字** |
| 悬停预热 | **鼠标移到 Download 按钮上**（或键盘 focus）才预拉文件列表（`service.modFiles`）；卡片本身不触发，避免无谓请求 |
| 免费账号 | **不再出现宿主授权弹窗**：直接开浏览器到文件页，用户网页点一次后 nxm 回传，Vortex 自动建下载 |
| 通知 | 只填 `message` 不填 `title` → 单行；info/success 自动关闭（4~5 秒），错误常驻 |
| 分类 | 来自 GraphQL 的 `Mod.category`（如 `Utilities`），显示在作者行下方的分隔线里 |
| 加载中 | 6 个 `animate-pulse` 骨架块 |
| 出错 | 红色错误文案；普通错误给「重试」，`UNAUTHORIZED` 给 **Log in**（调 `api.ext.ensureLoggedIn`） |
| 无结果 | 提示文案 + 「在网站上浏览」按钮（跳 `nexusmods.com/games/<domain>/mods`） |
| 未激活游戏 | 提示「请先在 Games 页面激活一个游戏」，搜索/刷新禁用 |

> **有意不做详情面板**：对标的「整合包」页也没有详情页，点了就是「加入/查看页面」。
> Download 默认取第一个文件（`modFiles` 已按主文件优先排序），这是与官方一致的一步式体验。

#### 3.11.1 宿主 UI 复用要点（做后续 UI 时必读）

1. **组件不对外导出，但样式是全局的**。官方控件（`@/ui/components/*`）没有从 `vortex-api` 导出，
   但它们的样式全部落在 `assets/css/tailwind-v4.css` 的 150 个 `nxm-*` 语义类里，且是**裸选择器 + CSS 变量**：

   ```css
   .nxm-button{z-index:1;border-radius:var(--radius-sm);font-size:var(--text-body-sm);…}
   .nxm-button-primary.nxm-button-strong{background-color:var(--color-primary-moderate)}
   ```

   所以只要 DOM 结构和类名对上，外观就 100% 一致（含 hover / disabled / 明暗主题）。

2. **可复用的类族**：`nxm-button-*`、`nxm-input*`、`nxm-tab-bar*`、`nxm-tab-button*`、
   `nxm-pagination*`、`nxm-image*`（含 `nxm-image-mod`，官方已定义 `--aspect-mod`）、
   `nxm-dropdown*`、`nxm-pill*`、`nxm-checkbox*`、`nxm-switch*`、`nxm-table*`、`nxm-modal*`、`nxm-alert*`、`nxm-bullet`。

3. **tailwind 是按需编译的** —— 只有官方用过的工具类才存在。
   实测 35 个常用类里缺 `aspect-video` / `mt-1` / `w-64` / `z-50` / `select-none` / `h-28` / `text-danger-50`。
   遇到缺失时：优先换成语义类，其次用内联 style（本项目的 SortMenu 就是这么处理 `mt-1`/`w-64`/`z-50` 的）。

4. **Typography 的类映射**（照着写即可）：
   - `typographyType` → `text-{type}`（`body-sm` → `text-body-sm`，`title-*` 额外加 `uppercase`）
   - `brand + appearance` → `text-{brand}-{appearance}`（`neutral + moderate` → `text-neutral-moderate`）

5. **不能插进官方页面的「模组」标签页**：那个 tab 目前是 `modsComingSoon` 占位，没有扩展点。
   我们只能注册独立页面（`group: "per-game"`），所以插件导航名用 `Nexus Mod Browser` 以免与官方重名。

---

#### 3.11.2 选文件弹窗（只用 MAIN）

产品规则：
- **只提供 MAIN 文件**。OPTIONAL / OLD_VERSION / ARCHIVED 是旧版或附加内容，不进入选择列表。
- MAIN 只有 1 个 → 直接下载，不打扰。
- MAIN 有多个（典型：同一版本拆成 R18 / 非 R18）→ 用宿主原生 `api.showDialog` 的 `choices` 单选弹窗，
  用户选完再走原来的下载流程。
- 一个 MAIN 都没有（少见）→ 退回"按日期最新的文件"，避免完全下不了。

实现要点（`ui/chooseFile.ts`）：

```ts
const result = await api.showDialog("question", "选择要下载的文件", {
  text: `${modName} 有 ${mains.length} 个主文件…`,
  choices: mains.map((f) => ({
    id: `file-${f.fileId}`,
    text: f.name,
    subText: `v${f.version} · ${size} · ${date} · 主文件`,
    value: f.fileId === fallback.fileId,   // primary=1 优先，否则最新
  })),
}, [{ label: "Cancel" }, { label: "Download" }]);
// 结果：result.action === "Download"，选中项在 result.input["file-<id>"] === true
```

为什么用原生对话框：遮罩、ESC、焦点管理、按钮多语言全部由宿主负责，**零自绘 UI**，
和"复用宿主素材"的总体策略一致。将来要展示缩略图/分组时，再换成自绘 `nxm-modal`（见调研结论）。

---

### 3.12 `src/index.ts`

```ts
export default function init(context): boolean
```

做三件事：
1. `context.registerReducer(["session","nexusBrowser"], reducerSpec)`
2. `context.registerMainPage("search", PAGE_TITLE, BrowseModsPage, { id, group:"per-game", priority:25, hotkey:"B", mdi: MIRRORED_SEARCH_ICON, visible, props })`
3. `context.once(() => {})`（预留给启动期工作）

`visible()` 在 store 未就绪或无激活 profile 时返回 false，避免空页。

**导航图标（镜像的搜索图标）**：宿主的 `Menu` 组件是 `iconPath={page.mdi ?? getIconPath(page.icon)}`，
所以传 `mdi` 就能用任意 SVG path。官方「Browse Nexus Mods」用的是 `mdiMagnify`，
本插件用它的**水平镜像**（x → 24 − x），既同源又能区分：

- 常量：`constants.ts` 的 `MIRRORED_SEARCH_ICON`
- 生成方式：`node mirror-path.js "<mdiMagnify path>"`（脚本在调研目录，处理 M/L/H/V/C/A/Q/Z，
  镜像时 x 取反、圆弧 sweep 翻转、旋转角取反），结果已固化，运行时不依赖图标库
- 第一参数仍传 `"search"`，作为旧 UI / 无 `mdi` 时的兜底

---

## 4. 关键设计决策（含理由）

### 4.1 构建：不用 webpack，直接 tsc 输出多文件 CommonJS
- 宿主用原生 `require` 加载 `index.js`，同目录相对引用天然可解析，**不需要打包**；
- 目标机器可能没有网络，装不了 webpack/ts-loader/@types/react；
- VS Code 自带完整 TypeScript，可离线编译；
- 依赖越少，接手成本越低。
- 代价：发布包是多文件（`index.js` + `lib 目录`），但 Nexus 扩展包本来就允许子目录。

### 4.2 类型：自带最小 shim（`src/typings/shims.d.ts`）
只声明用到的 `react`（createElement/useState/useEffect/useMemo/useCallback/useRef）与 Node 的 `https`/`Buffer`/`require`。
**不要**在没有相应配置的情况下安装 `@types/react`，否则会和 shim 冲突；真要换正规类型，请同时删掉 shim 并装 `typescript` + `@types/react`。

### 4.3 运行时**不** import `@nexusmods/vortex-api`（当前）
本阶段为了让代码能在纯 Node 里跑测试（无宿主），`util/game.ts` 自己复刻了选择器。
**但下一步 UI 会需要宿主控件** —— 已确认运行时可用，见 §6.1。

### 4.4 状态放 redux 而不是组件 state
用户切到别的页面再切回来时，搜索结果还在；且 reducer 便于测试。

### 4.5 `loading` 兼作"待查询"信号
见 §3.6，避免 effect 依赖比较的坑。

### 4.6 缓存 + 并发去重放在 service 单例
API 配额有限，且用户会连点。`inflight` 复用保证同一查询只发一次。

---

## 5. 已验证 / 未验证

### 自动验证 ✅（每次改动都跑）

| 项目 | 方式 |
| --- | --- |
| 编译通过 | `tsc` 6.0.3，0 error |
| 查询变量构造、格式化、reducer、已安装判定、文件分类 | `selftest.js` §[1]~§[7] |
| 下载桥接两条路径：超时 / 取消 / 作废 / 已安装守卫 | `selftest.js` §[5] §[9] |
| 选文件逻辑（单主文件不弹窗 / 多主文件弹窗 / 取消） | `selftest.js` §[8] |
| 扩展可加载、init 注册正确、5 种页面状态渲染 | `smoketest.js` |
| 发布包结构（根目录 info.json/index.js，正斜杠） | `pack.js` + 解包检查 |

合计 **47 项**。

### 真实 Vortex 里已验证 ✅（用户实测）

| 项目 | 结论 |
| --- | --- |
| 搜索结果 / 分页 / 排序 / 卡片外观 | 正常，和官方整合包页一致 |
| Premium 一键下载并安装 | 正常 |
| 免费账号 → 浏览器 → 回传 nxm | 正常 |
| 「Installed !」徽标 | 正常（按 mod id 判定） |
| 多个主文件弹窗选择 | 正常 |
| 从 N 网一键安装（文件名含 Extension） | 正常 |

### 仍需真机确认 ⚠️

| 项目 | 风险 | 怎么验 |
| --- | --- | --- |
| 0.6.3 的「关掉网页后再点 Download」 | 低 | 点 Download → 关浏览器 → 再点一次，应立即重新打开 |
| 超长 MOD 名 / 极窄窗口下的卡片布局 | 低 | 搜索名字特别长的 MOD 看是否溢出 |
| 深色主题下的徽标对比度 | 低 | 切到深色主题看 `Installed !` 是否够亮 |

---

## 6. 下一步

### 6.1 发布（当前最优先）

1. **GitHub**：仓库已生成在 `E:\Github\nexus-mod-browser`（见 §8），push 后把链接填进 N 网页面
2. **N 网**：上传 `Nexus Mod Browser - Vortex Extension 0.6.3.zip`（分类 Modding Tools → Vortex Extensions）
3. **封面**：`工作区\Nexus页面素材\cover-dark-1920x1080.png` 传到 Images 并设为主图

### 6.2 功能待办（按性价比排序）

| 想法 | 说明 | 工作量 |
| --- | --- | --- |
| 设置页 | 每页条数、默认排序、是否自动安装（`registerSettings`） | 小 |
| 成人内容过滤 | 按 `state.persistent.nexus.userInfo.adult` 决定是否显示 | 小 |
| 更新提示 | 用 `info.json` 版本对比 Nexus 上的最新文件，提示用户升级 | 中 |
| Mods 表集成 | `registerTableAttribute("mods", …)` 显示 Nexus 下载量/版本 | 中 |
| 国际化 | `language.json` + `api.translate`，目前是中文硬编码 | 中 |
| 收藏/订阅 | 需要写权限的 API，目前只读公开数据，暂不做 | 大 |

### 6.3 维护提醒

- Vortex 升级后先检查 `nxm-*` 类名是否还在（见 §7 第 9 条）
- Nexus GraphQL 若改字段，`queries.ts` 会直接报 `undefinedField`
- 免费账号策略由 Nexus 决定，若哪天开放直链，`downloadViaBrowser` 可以直接退休

---

## 7. 接手须知 / 已知坑

1. **`info.json` 的 `version` 必须和 Nexus 站点上填的完全一致**，否则扩展页可能不更新。
2. **发布包根目录必须有 `info.json` + `index.js`**；不能套一层文件夹（审核最常见失败原因）。
3. **不要 `require("vortex-api")` 之外再 import 宿主内部模块**（`@/...` 之类的别名只存在于宿主源码）。
4. **`init` 里不能读 `api.getState()`**，会抛 "extension uses api in init function"；放 `once` 或事件回调里。
5. **切换游戏时务必让 `domain` 与 `internalGameId` 同步更新**，否则会把 mod 下载到别的游戏目录。
6. **不要自己拼 CDN 直链**，也不要绕开 `start-download`。
7. 修改查询字段前先查《NexusMods-GraphQL-API-完整参考.md》，字段名错会直接 400/`undefinedField`。
8. 扩展目录是 `%APPDATA%\Vortex\plugins\nexus-mod-browser`；重装时 `install.js` 会清空该目录。
9. **`nxm-*` 类没有官方文档**，是 2.8.2 的"事实标准"。升级 Vortex 后若视觉错乱，优先怀疑类名变了；
   排查方法：`grep -o "\.nxm-[a-z-]*" assets/css/tailwind-v4.css`，对比还在不在。
10. **不要自造 tailwind 类名**：CSS 是按需编译的，没被官方用过的类不会存在（会静默无样式）。
11. **UI 里不要用 `@/...` 别名 import**：那些是宿主源码内部路径，扩展里不存在。
12. **发布包文件名必须含 `Extension`**：Vortex 靠文件名判断"这是扩展还是游戏 MOD"
    （`mod_management/util/queryGameId.ts` 里的 `fileName.toLowerCase().includes("extension")`）。
    名字里没有它，会被当成普通 MOD 装进当前激活的游戏 —— 界面提示"安装成功"，但扩展列表里什么都没有。
13. **宿主 nxm 下载的 modInfo 是嵌套的**：`{ game, source:"nexus", nexus:{ ids:{ modId, fileId } } }`，
    **没有顶层 modId/fileId**。只按顶层匹配会永远找不到下载记录（Downloading… 不触发就是这么来的）。
14. **不要用 `Promise.race` 包两个各自轮询的 promise**：败者的 `setInterval` 不会被清理，
    Node 进程退不出去（测试会卡死）。改成"单定时器 + kickoff 回调"（见 §3.7）。
15. **Vortex 通知只给 `message`、不给 `title` 才是单行**；给了 title 就是两行。

---

## 8. 发布与仓库

### 8.1 目录约定

| 位置 | 内容 |
| --- | --- |
| `E:\Github\nexus-mod-browser` | **GitHub 仓库根目录**（纯源码，不含 dist/build/release） |
| `D:\File\AI Agent工作区\nexus-mod-browser` | 开发工作区（构建、测试、打包都在这里） |
| `D:\File\AI Agent工作区\nexus-mod-browser\release` | 发布产物 |
| `D:\File\AI Agent工作区\Nexus页面素材` | 封面图（不进仓库、不进插件包） |

两个目录是**同源副本**：改代码在开发工作区，改完再同步到 GitHub 目录（或直接在 GitHub 目录里开发）。

### 8.2 发布产物

| 文件 | 用途 |
| --- | --- |
| `Nexus Mod Browser - Vortex Extension <版本>.zip` | **上传 N 网用**（文件名必须含 `Extension`，见第 12 条坑） |
| `nexus-mod-browser-<版本>.zip` | 同内容，旧命名 |
| `nexus-mod-browser-<版本>.7z` | 备用格式 |
| `nexus-mod-browser-<版本>-source.zip` | 源码快照（GitHub / 备份） |

生成命令：

```
node scripts/tsbuild.js      # 编译到 dist/
node scripts/selftest.js     # 47 项单测
node scripts/smoketest.js    # 渲染冒烟
node scripts/pack.js --7z    # 打包（会额外生成"Extension"命名副本与源码包）
```

### 8.3 GitHub 步骤

```
cd E:\Github\nexus-mod-browser
git init
git add .
git commit -m "Initial commit: Nexus Mod Browser 0.6.3"
git branch -M main
git remote add origin https://github.com/<账号>/nexus-mod-browser.git
git push -u origin main
```

- Releases 里建议附上 `Nexus Mod Browser - Vortex Extension <版本>.zip`（不装 Vortex 商店也能手动装）
- 仓库根目录已有 `.gitignore`（忽略 `dist/ build/ release/ node_modules/`）
- 注意：`dist/` 被忽略，别人克隆后需要自己 `node scripts/tsbuild.js`（脚本零依赖，不需要 npm install）

### 8.4 许可证

当前 **MIT**：别人可以改动、改名、甚至闭源分发，只需保留版权声明。

若想"防止被人拿去闭源"，把 `LICENSE` 换成 **GPL-3.0** 并同步 `package.json` 的 `license` 字段即可 ——
Vortex 本体就是 GPL-3.0，生态上没有问题（我们的代码不依赖它的源码）。

### 8.5 N 网页面

| 字段 | 值 |
| --- | --- |
| Title | `Nexus Mod Browser for Vortex - Browse and Download Nexus Mods`（或自定） |
| Game / Category | Modding Tools / Vortex Extensions |
| Version | 与 `info.json` 完全一致 |
| File 名称 | 必须含 `Extension` |
| Summary / Description | 见 `docs/03-Nexus页面文案.md`（英上中下逐句对应） |

---

## 9. 变更记录

| 日期 | 内容 |
| --- | --- |
| 2026-10-21 | v1：工程骨架、GraphQL 层、状态层、下载桥接、自绘原型 UI；19 项单元测试 + 5 组冒烟场景 |
| 2026-10-21 | v2：UI 重做为**官方同款样张**（`MainPage` + `nxm-*` 语义类），删除自绘 UI；冒烟测试改为校验宿主类名与页面结构 |
| 2026-10-21 | v3：卡片按钮改英文（Download / View page）；移除「整合包」标签；导航图标改为镜像搜索图标；**UI 接入真实数据**（搜索/分页/排序/刷新/下载全部可用） |
| 2026-10-22 | v4：排序文案改 `English（中文）`；下载中按钮禁用并显示 Downloading…；无结果加「在网站上浏览」；UNAUTHORIZED 加 Log in；翻页回到顶部；移除无用的 `downloading` state；版本 0.2.0 |
| 2026-10-22 | v5：修复卡片不显示分类（查询缺 `category` 字段 + 未传 prop）；底部按钮固定到卡片底部；修复取消下载后按钮卡在 Downloading…（轮询兜底 + 3 项回归测试）；取消提示文案改为准确描述；版本 0.2.1 |
| 2026-10-22 | v6：通知支持 `displayMS` 自动关闭；关掉授权弹窗改为「继续等待 + 90s 宽限 + 超时 pending」而不是立即取消；下载记录 finished 也能触发安装（回调丢失可自愈）；版本 0.2.2 |
| 2026-10-22 | v7：**回退** Skip=取消 的语义；新增 `onStarted`，按钮只在下载真正开始时变 Downloading…，开始前可反复点击（pendingRef 去重）；记录消失/失败也会正确收尾；版本 0.3.0 |
| 2026-10-22 | v8：超时改为**只对"等待开始"阶段**计时（默认 3 分钟），下载开始后不再计时，避免大文件被误判；新增 2 项回归测试；版本 0.3.1 |
| 2026-10-22 | v9：新增「已安装」徽标（`util/mods.ts`，按 attributes.modId 判定，排除合集）；下载开始自动关授权弹窗；通知改单行；排序下拉与左侧垂直对齐；悬停预热文件列表；修正 `freeUserDLQueue` 的真实路径（`session.nexus.*`）；版本 0.4.0 |
| 2026-10-22 | v10：徽标文案改 `Installed !` 并移到 Download 按钮上方；预热改为**只在 Download 按钮 hover/focus** 时触发（卡片本身不再触发）；版本 0.4.1 |
| 2026-10-22 | v11：徽标位置修正为**内容区底部、按钮栏上方**的独立一行（v10 误把按钮栏拆成两行，已还原）；版本 0.4.2 |
| 2026-10-22 | v12：徽标最终位置 = **封面图下方、左侧列内**（按钮栏与卡片高度均未改动）；版本 0.4.3 |
| 2026-10-22 | v13：徽标最终定稿在**卡片右下角**（与 Download 同行、`ml-auto` 行末）；版本 0.4.4 |
| 2026-10-22 | v14：新增 `util/modFiles.ts`（`ModFile.category` 兼容数字 1 与枚举名 "MAIN"，含中文标签，供下一步文件选择弹窗使用）；修正主文件排序判据；+3 项测试；版本 0.4.5 |
| 2026-10-22 | v15：新增 `ui/chooseFile.ts` —— 只下载 MAIN，多个 MAIN 时用宿主原生 `showDialog + choices` 让用户选（R18/非 R18 场景）；+7 项测试（共 38）；版本 0.5.0 |
| 2026-10-22 | v16：免费账号**跳过宿主授权弹窗**，改为直接打开浏览器（`downloadViaBrowser`）+ `downloadForUser` 自动选路；会员信息未加载时回退宿主流程；`watchDownloadRecord` 重构为 kickoff 单定时器（修掉 race 导致的定时器泄漏）；+4 项测试（共 42）；版本 0.6.0 |
| 2026-10-22 | v17：修复**免费账号永远不触发 Downloading…**（下载记录的 id 在 `modInfo.nexus.ids` 里，之前只按顶层匹配）；等待超时两条路径统一 2 分钟；排序下拉改左对齐 + 固定宽度（`.nxm-button` 默认居中）；已安装过不再重复安装；+3 项测试（共 45）；版本 0.6.1 |
| 2026-10-22 | v18：排序下拉的内容撑满按钮（新增 `Button.contentClassName`），箭头贴到盒子最右侧；版本 0.6.2 |
| 2026-10-22 | v19：打包发布准备 —— 作者改为 `MC10086AAA`；新增 MIT `LICENSE`、`NOTICE`（MDI/Vortex 类名归属）、`.gitignore`；设计文档收进 `docs/`；打包脚本额外产出源码包与 `.7z`；版本 0.6.2（未变） |
| 2026-10-22 | v20：新增 `docs/03-Nexus页面文案.md`（中英双语、英上中下逐句对应，含安装指引、下载说明、FAQ、更新日志） |
| 2026-10-22 | v21：生成封面图（深/浅两套，1080p/720p/512）—— 从 Vortex 安装包提取真实图标、自写 SVG 光栅化器渲染 Nexus 图标 |
| 2026-10-22 | v22：封面图**移出插件项目**（改放 `工作区\Nexus页面素材\`），封面不再带版本号；插件包与源码包回到纯代码状态 |
| 2026-10-22 | v23：查明 **N 网一键安装失败**的原因 —— Vortex 靠文件名里的 `extension` 判断是否按扩展安装（`queryGameId.ts`），已把发布包命名为 `Nexus Mod Browser - Vortex Extension <ver>.zip` 并在打包脚本里自动生成副本 |
| 2026-10-22 | v25：交接报告刷新 —— §0 进度表、§5 验证情况、§6 下一步全部重写；新增 §8「发布与仓库」（仓库路径 / 产物 / GitHub 步骤 / 许可证 / N 网字段）；已知坑补充 4 条（文件名 extension、嵌套 modInfo、Promise.race 泄漏、单行通知）；源码同步到 `E:\Github\nexus-mod-browser` |
| 2026-10-22 | v24：修复**免费账号点 Download 后按钮失效**（`pendingRef` 阻塞了重复点击）—— 免费路径改为"每次点击作废旧等待"（`downloadViaBrowser` 新增 `cancel()` 选项）；超时返回 `timedOut` 并提示可直接重试；+2 项测试（共 47）；版本 0.6.3 |
