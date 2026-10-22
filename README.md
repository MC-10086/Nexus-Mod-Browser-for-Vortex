# Nexus Mod Browser（Vortex 扩展）

在 Vortex 里直接搜索、浏览、下载 Nexus Mods 的 MOD —— 不用切浏览器。

> ⚠️ 非官方扩展，与 Nexus Mods 官方无关。

> **定位：过渡方案。** Vortex 自带的「Browse Nexus Mods」页面目前只有整合包（Collections）标签，
> 「模组」标签还是占位状态。在官方 MOD 搜索功能上线之前，本扩展用来补上这块空缺。

## 功能

- 🔍 按关键词搜索当前游戏的 MOD（词干模糊匹配），支持排序：相关度 / 点赞 / 下载量 / 最近更新 / 最新发布
- 🧾 卡片展示封面、作者、分类、成人标记、下载量、点赞数、版本、简介
- ✅ 已安装的 MOD 会在卡片**右下角**（按钮栏行末）标注 `Installed !`（按 Nexus mod id 判定，不是按名字）
- ⬇️ **Download**：进入 Vortex 的下载队列并自动安装。只下载**主文件**（旧版/可选文件不会出现）；如果这个 MOD 有多个主文件（例如 R18 / 非 R18 两个版本），会先让你选一个再下载
- ↗️ **View page**：在浏览器打开该 MOD 的 Nexus 页面
- 💾 搜索结果缓存，切页面不丢失；相同查询不会重复请求
- 🌗 复用 Vortex 原生 UI 组件样式，自动跟随明暗主题

## 环境要求

- Vortex **2.8 或更高**
- 需要登录 Nexus Mods（Vortex 右上角登录即可，插件会自动复用登录状态）

## 安装

**方式 A（最省事）**：

1. 在 Nexus Mods 的 **Modding Tools → Vortex Extensions** 页面，切到 **Files** 标签，点主文件的 **Download with Vortex**（用 Mod 管理器下载）
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
4. 点 **Download** 下载并安装，或点 **View page** 去网站看详情。

## 关于下载

- **Premium 账号**：点 Download 直接进队列。
- **免费账号**：点 **Download** 会直接打开浏览器到该文件的页面（不再经过 Vortex 的授权弹窗）。
  在页面上点一次 **Download with Vortex**，Vortex 就会接住并开始下载。
  这是 Nexus 对免费账号的限制，网页上那一次点击无法省略。

## 常见问题

**Q：还会看到「跳过模组 / Skip this mod」弹窗吗？**

不会了 —— 本插件对免费账号改为直接打开浏览器，绕过了那个弹窗。
如果你在别的地方（比如官方的 Browse Nexus 页面）看到它，那是 Vortex 内置对话框，它的三个按钮：

| 按钮 | 作用 |
| --- | --- |
| Download | 打开浏览器到该文件页，你在页面上点 **Download with Vortex** 即可 |
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
