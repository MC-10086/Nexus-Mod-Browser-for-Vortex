# Nexus Mod Browser（Vortex 扩展）

在 Vortex 里直接搜索、浏览、下载 Nexus Mods 的 MOD —— 不用切浏览器。

> ⚠️ 非官方扩展，与 Nexus Mods 官方无关。

> **定位：过渡方案。** Vortex 自带的「Browse Nexus Mods」页面目前只有整合包（Collections）标签，
> 「模组」标签还是占位状态。在官方 MOD 搜索功能上线之前，本扩展用来补上这块空缺。
>
> 🎉 **正式版 1.3.1**：修复多词精确搜索（例如完整 MOD 名 `Combat Pathing Revolution` 搜不到，只能搜单词）。搜索现在按词拆分后逐词 AND 匹配；多主文件选择仍显示文件描述，图片放大与三语切换保持不变。

## 功能

- 🔍 按关键词搜索当前游戏的 MOD（词干模糊匹配），支持排序：相关度 / 点赞 / 下载量 / 最近更新 / 最新发布
- 🧾 卡片展示封面、作者、分类、成人标记、下载量、点赞数、版本、简介
- ✅ 已安装的 MOD 会在卡片**右下角**（按钮栏行末）标注 `Installed !`（中文界面为 `已安装 !`，按 Nexus mod id 判定，不是按名字）
- ⬇️ **Download / 下载**：进入 Vortex 的下载队列并自动安装。只下载**主文件**（旧版/可选文件不会出现）；如果这个 MOD 有多个主文件（例如 R18 / 非 R18 两个版本），会先让你选一个再下载；选择列表会显示每个文件的 N 网描述（清理 BBCode/HTML 后截断到约 160 字）
- ↗️ **View page / 查看页面**：在浏览器打开该 MOD 的 Nexus 页面
- 🖼️ **Details / 详情**：弹出详情窗，显示主图 + 完整简介（复用 Vortex 的 BBCode 渲染，粗体 / 链接 / 列表 / 图片原样显示），支持 `Esc` / 点遮罩 / 点 `×` 关闭
- 🔍 **点击图片放大**：卡片封面和详情主图都复用 Vortex 自带的 `ZoomableImage`，点击全屏查看、再点关闭；卡片图片不再跳转 N 网，需要网页请用 **View page**
- 🧩 **前置检查**：点 Download 时先查 N 网登记的必需前置 —— 未安装的可以勾选一键下载，也可以每行单独 Download / View page / Details；已安装的显示本地版本，DLC 与站外组件只提示；勾「不再提醒」会持久记住
- 🌐 **语言切换**：页头下拉框切换 **中文 / English / 日本語**，复用现有排序下拉组件；只影响插件自身 UI，N 网的 MOD 名称、简介、作者、文件名、分类、DLC、前置备注**始终原样显示**
- 💾 搜索结果缓存，切页面不丢失；相同查询不会重复请求
- 🌗 复用 Vortex 原生 UI 组件样式，自动跟随明暗主题

## 环境要求

- Vortex **2.8 或更高**
- 需要登录 Nexus Mods（Vortex 右上角登录即可，插件会自动复用登录状态）

## 安装

**方式 A（最省事）**：

1. 在 Nexus Mods 的 **Modding Tools → Vortex Extensions** 页面，切到 **Files** 标签，点主文件的 **Mod manager download**
2. 会自动拉起 Vortex，Vortex 会弹出一个窗口，点窗口里的 **安装（Install）** 选项
3. 下载完成后重启 Vortex

**方式 B（最稳）**：下载压缩包 → 打开 Vortex 的「扩展（Extensions）」页面 → **把压缩包拖进该页面** → 按提示重启 Vortex。

**方式 C（手动）**：把压缩包解压到 `%APPDATA%\Vortex\plugins\nexus-mod-browser\`
（确保该目录下直接有 `info.json` 和 `index.js`）。

> 方式 A 依赖文件名里带 `Extension`（Vortex 用它判断这是扩展而不是游戏 MOD）；现在的发布包已满足，若遇到旧文件请改用方式 B。

## 使用

1. 在 Games 页面激活一个游戏；
2. 左侧导航点 **Nexus Mod Browser**（快捷键 `Ctrl+Shift+B`，图标是镜像的放大镜）；
3. 输入关键词回车，或直接浏览热门；
4. 页头右侧的**语言选择框**切换 **中文 / English**——只影响插件 UI，N 网内容始终原样显示；
5. 点 **Download / 下载** 下载并安装（有前置时会先弹前置窗），点 **View page / 查看页面** 去网站看详情，或点 **Details / 详情** 在 Vortex 里看主图 + 完整简介。

## 前置（Requirements）

- 前置清单来自作者在 N 网 **Requirements** 区域的登记；写在简介正文里的需求识别不了。
- **只有存在未安装的 Nexus 前置时才弹窗**；全部已安装（或已设为不再提醒）直接下载，不打扰。
- 未安装的前置可以一键下载，也可以逐行单独下载；**Skip** 跳过前置继续当前 MOD，右上角 `×` / 遮罩 / `Esc` 取消整个操作。
- 本地已有就默认可用；页面会显示已安装的本地版本。N 网 API 没有结构化的「要求版本」字段，所以不做版本拦截，作者备注会原样显示。
- DLC 和站外组件（VC++/.NET 等）只在弹窗已打开时作为附注显示，不会单独触发弹窗。
- 每行可以勾「**不再提醒**」：以后任何 MOD 需要这个前置都跳过（灰色小字，重启后仍然有效），按"已安装"处理（不参与下载）；当它随其它前置一起出现时可取消勾选恢复。
- 前置下载与普通下载走同一套逻辑：Premium 自动下载，免费账号逐个打开浏览器页面。
- 前置不再有前置（v1 只处理一层）；装完后 Vortex 自带的 Health Check 会继续检查已安装 MOD 的依赖。

## 关于下载

- **Premium 账号**：点 Download 直接进队列。
- **免费账号**：点 **Download** 会直接打开浏览器到该文件的页面（不再经过 Vortex 的授权弹窗）。
  在页面上点一次 **Mod manager download**，Vortex 就会接住并开始下载。
  这是 Nexus 对免费账号的限制，网页上那一次点击无法省略。

## 常见问题

**Q：还会看到「跳过模组 / Skip this mod」弹窗吗？**

不会了 —— 本插件对免费账号改为直接打开浏览器，绕过了那个弹窗。
如果你在别的地方（比如官方的 Browse Nexus 页面）看到它，那是 Vortex 内置对话框，它的三个按钮：

| 按钮 | 作用 |
| --- | --- |
| Download | 打开浏览器到该文件页，你在页面上点 **Mod manager download** 即可 |
| 跳过模组 / Skip this mod | 关掉这个弹窗（对单个 MOD 来说等于本次不通过它下载） |
| Cancel | 取消整个队列 |

**下载一开始，这个弹窗会自动关掉**，你不用手动点跳过。
若你主动点了「跳过模组 / 取消下载」，本次就结束，按钮恢复成 Download，可以再点。

另外：按钮只有**下载真正开始**之后才会变成 Downloading…。
在下载开始之前（例如还在等你授权）按钮一直是 Download，想点几次都行——不会重复排队。

**Q：点了 Download 之后按钮一直显示 Downloading…？**

下载完成前按钮会保持这个状态（Vortex 的下载回调是在文件落盘后才触发的）。
如果急用，可以看 Vortex 左侧的「下载」页确认进度；取消/跳过后按钮会自动恢复。

**Q：为什么有些 MOD 没有「Adult」标记？**

标记来自 Nexus 返回的 `adultContent` 字段；你自己没开启成人内容的账号看不到这类结果。

## 隐私

- 插件只与你本机的 `api.nexusmods.com` 通信，请求使用你自己在 Vortex 里已登录的 API Key；
- 不向任何第三方服务器发送数据，不收集遥测。

## 开发文档

源码仓库（GitHub）里附带两份文档（`docs/`）：

- `docs/01-Vortex插件开发接口与方法.md` —— Vortex 扩展系统的接口、事件、下载管道、打包分发（开发者向调研）
- `docs/02-使用与开发指南.md` —— **完整的使用与开发指南**：安装、使用、FAQ、构建、项目结构、贡献约定

## 如何构建

仓库不含构建产物（`dist/` 已被忽略），克隆后自己编译一次即可。**没有任何 npm 依赖**，不需要 `npm install`：

```
node scripts/tsbuild.js     # 编译到 dist/
node scripts/selftest.js    # 运行单元测试
node scripts/smoketest.js   # 渲染冒烟测试
node scripts/pack.js        # 打包成可上传的 zip（输出到 release/）
node scripts/install.js     # 直接装到本机 %APPDATA%\Vortex\plugins\ 做本地测试
```

要求：本机装有 Node.js，以及任意一份 TypeScript（脚本会自动找 VS Code 自带的 tsc，找不到就用 PATH 里的）。

## 许可证

MIT，见 [LICENSE](LICENSE)。第三方资源说明见 [NOTICE](NOTICE)。

**你可以自由地使用、修改、再发布这个插件**（包括修改后闭源发布），只需保留版权声明与许可证文本。
欢迎基于它做自己的版本 —— 改个名字直接发也可以。

## 问题反馈

请在扩展的 Nexus 页面留言或提交 issue，并附上 `%APPDATA%\Vortex\vortex.log` 中相关片段。
