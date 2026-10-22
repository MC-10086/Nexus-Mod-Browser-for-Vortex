# Nexus Mods 页面文案（中英双语，英文在上）

> 用法：把「短简介」粘到 Nexus 页面的 **Summary** 字段；把「详细描述」粘到 **Description**（BBCode 直接生效）。
> 记得把 `[img]` 换成你自己的截图外链（Nexus 图片上传后会给你 URL）。

---

## 一、短简介（Summary 字段）

```
Browse, search and download Nexus Mods without leaving Vortex — one-click download and automatic install, with an interface that matches Vortex's own.
在 Vortex 内直接搜索、浏览并下载 Nexus Mods —— 一键下载、自动安装，界面与 Vortex 原生风格一致。
```

---

## 二、详细描述（Description 字段 · BBCode）

```bbcode
[b][size=5]Nexus Mod Browser[/size][/b]
[i]Browse, search and download Nexus Mods without leaving Vortex.[/i]
[i]在 Vortex 内直接搜索、浏览并下载 Nexus Mods。[/i]

[b]Version:[/b] 0.6.3   [b]Requires:[/b] Vortex 2.8+   [b]License:[/b] MIT
[b]版本：[/b] 0.6.3   [b]需要：[/b] Vortex 2.8+   [b]许可证：[/b] MIT

────────────────────────────

[b][size=4]Where it fits / 定位[/size][/b]
This add-on is an interim solution. Vortex's built-in "Browse Nexus Mods" page currently ships only the Collections tab — its Mods tab is still a placeholder — so this extension provides mod search until that native feature is available.
本插件定位为**过渡方案**。Vortex 自带的「Browse Nexus Mods」页面目前只提供整合包（Collections）标签页，「模组」标签仍是"即将推出"的占位状态；在官方 MOD 搜索功能上线之前，本扩展用来补上这块空缺。

────────────────────────────

[b][size=4]What it does / 功能[/size][/b]
[list]
[*][b]Search inside Vortex.[/b] Search the current game's mods by keyword, and sort by relevance, endorsements, downloads, last update or release date.
[*][b]在 Vortex 内搜索。[/b] 按关键词搜索当前游戏的 MOD，可按相关度、点赞、下载量、最近更新或发布时间排序。
[*][b]Real mod cards.[/b] Cover image, author, category, adult flag, downloads, endorsements, version and summary — the same layout Vortex uses for collections.
[*][b]真实的 MOD 卡片。[/b] 封面、作者、分类、成人标记、下载量、点赞数、版本与简介 —— 与 Vortex 的合集卡片同一套布局。
[*][b]One-click download and install.[/b] The file goes straight into Vortex's download queue and is installed automatically when it finishes.
[*][b]一键下载并安装。[/b] 文件直接进入 Vortex 的下载队列，下载完成后自动安装。
[*][b]Choose the right file.[/b] If a mod has several main files (for example an R18 and a non-R18 version), you get a small dialog to pick one. Only main files are ever offered.
[*][b]选择正确的文件。[/b] 如果一个 MOD 有多个主文件（例如 R18 版和非 R18 版），会弹出对话框让你选择。只提供主文件。
[*][b]Installed badge.[/b] Mods you already have are marked "Installed !", matched by Nexus mod ID instead of by name.
[*][b]已安装标记。[/b] 本地已有的 MOD 会标注 "Installed !"，按 Nexus mod ID 匹配，而不是按名字。
[*][b]Looks native.[/b] Built with Vortex's own UI classes, so it follows your theme and matches the rest of the application in both light and dark mode.
[*][b]原生外观。[/b] 使用 Vortex 自带的 UI 样式类，跟随你的主题，与程序其余部分保持一致（明暗主题都适配）。
[/list]

[b][size=4]Screenshots / 截图[/size][/b]
[img]https://staticdelivery.nexusmods.com/images/PLACEHOLDER_01.jpg[/img]
[img]https://staticdelivery.nexusmods.com/images/PLACEHOLDER_02.jpg[/img]

────────────────────────────

[b][size=4]Installation / 安装[/size][/b]

[b]Option A — install through Vortex (recommended)[/b]
[list=1]
[*]Open Vortex and go to the Extensions page.
[*]Drag the downloaded archive onto that page.
[*]Restart Vortex when prompted.
[/list]

[b]方式 A —— 通过 Vortex 安装（推荐）[/b]
[list=1]
[*]打开 Vortex，进入「扩展（Extensions）」页面。
[*]将下载的压缩包拖进该页面。
[*]按提示重启 Vortex。
[/list]

[b]Option B — manual installation[/b]
[list=1]
[*]Download the main file.
[*]Extract the archive into %APPDATA%\Vortex\plugins\nexus-mod-browser\
[*]Make sure info.json and index.js sit directly inside that folder — not inside a nested folder.
[*]Restart Vortex.
[/list]

[b]方式 B —— 手动安装[/b]
[list=1]
[*]下载主文件。
[*]把压缩包解压到 %APPDATA%\Vortex\plugins\nexus-mod-browser\
[*]确认 info.json 与 index.js 直接位于该文件夹下，不要再套一层文件夹。
[*]重启 Vortex。
[/list]

────────────────────────────

[b][size=4]How to use / 使用方法[/size][/b]
[list=1]
[*]Activate a game in Vortex.
[*]在 Vortex 中激活一个游戏。
[*]Click "Nexus Mod Browser" in the left sidebar (hotkey: Ctrl+Shift+B).
[*]点击左侧导航栏的 "Nexus Mod Browser"（快捷键 Ctrl+Shift+B）。
[*]Type a keyword and press Enter, or just browse the default list.
[*]输入关键词后回车，或直接浏览默认列表。
[*]Click [b]Download[/b] to download and install, or [b]View page[/b] to open the mod page on Nexus Mods.
[*]点击 [b]Download[/b] 下载并安装，或点击 [b]View page[/b] 在浏览器中打开该 MOD 的 Nexus 页面。
[*]If the mod has several main files, pick the one you want in the dialog that appears.
[*]如果该 MOD 有多个主文件，在弹出的对话框中选择你要的那个。
[/list]

────────────────────────────

[b][size=4]About downloads / 关于下载[/size][/b]

[b]Premium members[/b] get a true one-click download: the file is fetched and queued immediately, with no browser round trip.
[b]Premium 会员[/b] 是真正的一键下载：文件会立刻被抓取并加入队列，不需要跳转浏览器。

[b]Free accounts[/b] cannot be handled fully automatically — Nexus only issues signed download links to the website after you click there. This add-on opens the file's page in your browser directly; click [b]Download with Vortex[/b] once and Vortex takes over and queues the file.
[b]免费账号[/b] 无法做到全自动 —— Nexus 只会在你于网页上点击之后签发带签名的下载链接。本插件会直接在你的浏览器中打开该文件的页面，点一次 [b]Download with Vortex[/b]，Vortex 就会接手并把文件加入队列。

[b]Only main files are listed.[/b] Optional files, old versions and archived files are intentionally excluded, so you always get the current release.
[b]只列出主文件。[/b] 可选文件、旧版本和已归档文件会被有意排除，保证你拿到的是当前版本。

────────────────────────────

[b][size=4]Requirements / 需求[/size][/b]
[list]
[*]Vortex 2.8 or newer.
[*]Vortex 2.8 或更高版本。
[*]A Nexus Mods account, logged in inside Vortex.
[*]一个 Nexus Mods 账号，并在 Vortex 内登录。
[*]Internet access to api.nexusmods.com (the add-on talks to the official GraphQL API).
[*]能够访问 api.nexusmods.com（插件调用的是官方 GraphQL 接口）。
[/list]

────────────────────────────

[b][size=4]FAQ / 常见问题[/size][/b]

[b]Q: I installed it, but there is no new entry in the sidebar.[/b]
A: The page is registered as a per-game page, so it only appears after a game profile is active. Activate a game first, then look again.
[b]问：装好了，但左侧导航没有新条目。[/b]
答：该页面属于「按游戏」分类，只有在激活了游戏配置之后才会出现。先激活一个游戏再查看。

[b]Q: The list stays empty.[/b]
A: Check that you are online and logged in, then press the refresh button. Some very new games have no Nexus page yet.
[b]问：列表一直是空的。[/b]
答：先确认网络正常且已登录，然后点刷新按钮。部分很新的游戏在 Nexus 上还没有页面。

[b]Q: Clicking Download opens my browser instead of downloading.[/b]
A: That is the free-account flow described above. Complete the single click on the website and Vortex continues automatically.
[b]问：点下载却打开了浏览器，而不是直接下载。[/b]
答：这就是上面说的免费账号流程。在网页上完成那一次点击后，Vortex 会自动继续。

[b]Q: A mod I already have is not marked as installed.[/b]
A: The badge is based on the Nexus mod ID stored by Vortex. Mods installed from local archives, or from other sites, carry no Nexus ID and therefore cannot be matched.
[b]问：我明明装了某个 MOD，却没有显示已安装。[/b]
答：该标记依据的是 Vortex 记录的 Nexus mod ID。通过本地压缩包或其他站点安装的 MOD 没有 Nexus ID，因此无法匹配。

────────────────────────────

[b][size=4]更新日志 / Changelog[/size][/b]

[b]0.6.3[/b]
[list]
[*]修复：免费账号点 Download 后如果没完成下载，按钮会失效；现在可以直接再点一次重试，上一次的等待会自动作废。
[*]超时提示改为「没有检测到下载，可再点一次 Download」。
[*]发布包文件名带上 Extension，修复从 N 网一键安装时被当成游戏 MOD 的问题。
[/list]

[b]0.6.2[/b]
[list]
[*]排序下拉框：文字左对齐、箭头贴到最右，宽度固定。
[/list]

[b]0.6.1[/b]
[list]
[*]修复：免费账号下载时按钮一直不变成 Downloading…。
[*]两条下载路径的等待超时统一为 2 分钟。
[*]已经装过的 MOD 不再重复安装一次。
[/list]

[b]0.6.0[/b]
[list]
[*]免费账号不再弹出 Vortex 的授权对话框，点 Download 直接打开文件页，少一次点击。
[/list]

[b]0.5.0[/b]
[list]
[*]只下载主文件；有多个主文件（比如 R18 / 非 R18）时弹窗让你先选一个再下载。
[/list]

[b]0.4.0 – 0.4.4[/b]
[list]
[*]新增「Installed !」已安装标记（卡片右下角），按 Nexus mod ID 判定，不靠名字。
[*]通知改为单行，4~5 秒自动消失。
[*]鼠标移到 Download 按钮上才预加载文件列表，减少无谓请求。
[*]下载真正开始时自动关闭授权对话框。
[/list]

[b]0.3.0 – 0.3.1[/b]
[list]
[*]按钮只在下载真正开始时变成 Downloading…，等待期间可以反复点击。
[*]等待超时只对「下载开始前」计时，大文件下载不会被打断。
[/list]

[b]0.2.0 – 0.2.2[/b]
[list]
[*]修复取消下载后按钮卡在 Downloading…。
[*]修复卡片不显示分类。
[*]底部按钮固定到卡片底部，同一行卡片高度一致。
[*]无结果时提供「在网站上浏览」入口，未登录时提供 Log in。
[*]排序文案改为「English（中文）」。
[/list]

[b]0.1.0[/b]
[list]
[*]首个版本：关键词搜索、排序、分页、MOD 卡片、一键下载并安装。
[/list]

────────────────────────────

[b][size=4]Credits / 致谢[/size][/b]
[list]
[*]Icons: Material Design Icons (@mdi/js, Apache-2.0).
[*]图标：Material Design Icons（@mdi/js，Apache-2.0）。
[*]Interface: reuses Vortex's public CSS classes for a native look. No Vortex source code is included.
[*]界面：复用 Vortex 公开的 CSS 类以获得原生外观，不包含 Vortex 源代码。
[*]Data: Nexus Mods official GraphQL API.
[*]数据：Nexus Mods 官方 GraphQL 接口。
[/list]

[b]This add-on is unofficial and not affiliated with or endorsed by Nexus Mods.[/b] Nexus Mods and Vortex are trademarks of their respective owners.
[b]本插件为非官方作品，与 Nexus Mods 没有隶属或背书关系。[/b] Nexus Mods 与 Vortex 是其各自所有者的商标。

[b]License:[/b] MIT — see the LICENSE file in the repository.
[b]许可证：[/b] MIT —— 见仓库中的 LICENSE 文件。
```

---

## 三、发布时建议填写

| 字段 | 建议值 |
| --- | --- |
| Game | **Modding Tools** |
| Category | **Vortex Extensions** |
| Version | **0.6.3**（必须与 `info.json` 完全一致） |
| File 名称 | **必须包含单词 `Extension`**（见下方说明） |
| Main files | 只放一个：`Nexus Mod Browser - Vortex Extension 0.6.3.zip` |
| Tags | Vortex, Mod Manager, Utility, Browser |
| Permissions | **允许修改、允许转载、允许在其他项目中使用**（署名即可，与 MIT 一致） |

## 四、截图建议（3–5 张，16:9）

1. **Browse list** — 整页列表（含搜索框、排序、卡片网格）
2. **Search result** — 输入关键词后的结果
3. **File picker** — 多主文件时的选择弹窗
4. **Installed badge** — 卡片右下角的 `Installed !`
5. **Downloading** — 按钮变成 `Downloading…` 的瞬间

> 截图直接用 Windows 的 `Win + Shift + S` 截，注意别把其它窗口截进去。

---

## 五、封面图

封面图**不放进插件包**（插件只需要 `info.json` + `index.js` + 编译产物），
成品放在工作区的外部目录：

`D:\File\AI Agent工作区\Nexus页面素材\`

| 文件 | 尺寸 | 用途 |
| --- | --- | --- |
| `cover-dark-1920x1080.png` | 1920×1080 | N 网主图（推荐，深色） |
| `cover-dark-1280x720.png` | 1280×720 | 深色 720p |
| `cover-light-1920x1080.png` | 1920×1080 | 浅色备选 |
| `cover-light-1280x720.png` | 1280×720 | 浅色 720p |
| `cover-dark-512x512.png` | 512×512 | 方形缩略图 |

设计：左 Vortex、右 Nexus Mods，中间双向箭头表示两者的连接；底部标注
"Connects Vortex with Nexus Mods · MIT"，**不含版本号**（版本号在页面字段里，避免图过期）。

生成脚本在 `build/cover/`（`render_svg.py` 光栅化 SVG，`compose.py` 排版，改文案/配色后重跑即可）。

---

## 六、文件名规则（重要，决定能否一键安装）

Vortex 判断"这个下载是扩展还是游戏 MOD"只看**下载文件的名字**，
源码在 `mod_management/util/queryGameId.ts`：

```ts
if (
  downloadGameIds.length === 1 &&
  downloadGameIds[0] === SITE_ID &&          // nxm://site/...（N 网的 Modding Tools）
  fileName.toLowerCase().includes("extension")   // ← 名字里必须有 "extension"
) {
  return Promise.resolve(downloadGameIds[0]);   // 当作扩展安装
}
```

名字里没有 `extension` 时，它会退回到"询问装到哪个游戏"，结果被当作普通游戏 MOD
装进了当前激活的游戏 —— 界面提示安装成功，但扩展列表里什么也没有。

所以：

- 上传的压缩包叫 `Nexus Mod Browser - Vortex Extension 0.6.3.zip`
- Files 页面的 **Name** 字段同样带 `Extension`，例如 `Vortex Extension - Nexus Mod Browser 0.6.3`

这样用户点 "Download with Vortex" 就能直接进扩展列表，不需要手动拖拽。
