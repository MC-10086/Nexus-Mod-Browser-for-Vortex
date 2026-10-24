/**
 * 插件自带的多语言（只翻译插件 UI，不翻译任何 N 网内容）
 * ---------------------------------------------------------------------------
 * 设计约束（产品要求）：
 *   - N 网返回的内容（MOD 名、简介、作者、文件名、分类名、DLC、前置备注）原样显示；
 *   - 语言只在用户通过页头选择框选择时改变一次，不跟随 Vortex 语言、不自动探测；
 *   - 不引入 i18next 等运行时库；字典直接编译进 JS，查表是 O(1)。
 */

export type Language = "zh" | "en";

export const LANGUAGES: Array<{ id: Language; label: string }> = [
  { id: "zh", label: "中文" },
  { id: "en", label: "English" },
];

const EN = {
  "common.download": "Download",
  "common.downloading": "Downloading…",
  "common.viewPage": "View page",
  "common.details": "Details",
  "common.skip": "Skip",
  "common.continue": "Continue",
  "common.requested": "Requested",
  "common.selectAll": "Select all",
  "common.search": "Search",
  "common.refresh": "Refresh",
  "common.login": "Log in",
  "common.retry": "Retry",
  "common.close": "Close",
  "common.listSeparator": "; ",
  "common.nameSeparator": ", ",
  "language.label": "Language",

  "page.tab": "Mods",
  "page.activatePlaceholder": "Activate a game first…",
  "page.searchPlaceholder": "Search in {game}…",
  "page.results": "{count} results",
  "page.activateGame": "Activate a game on the Games page first.",
  "page.emptyQuery": "No mods found for \"{query}\".",
  "page.emptyNoResults": "No results for this game yet.",
  "page.browseSite": "Browse on the website",

  "card.installed": "Installed !",
  "card.installedTitle": "This mod is already installed",
  "card.adult": "Adult",
  "card.downloadTitle": "Download and install",
  "card.viewPageTitle": "Open on Nexus Mods",
  "card.detailsTitle": "Show mod details",

  "detail.fallbackTitle": "Mod details",
  "detail.empty": "This mod has no description.",
  "detail.downloads": "{count} downloads",
  "detail.endorsements": "{count} endorsements",

  "status.notInstalled": "Not installed",
  "status.ignored": "Ignored",
  "status.installed": "Installed",
  "status.installedVersion": "Installed v{version}",
  "status.external": "External component",
  "status.otherGame": "Other game",

  "requirements.title": "Required mods",
  "requirements.subtitle": "{modName} · {count} prerequisites ({missing} missing)",
  "requirements.unnamedMod": "Mod {modId}",
  "requirements.ignore": "Don't remind me",
  "requirements.ignoreLabel": "Don't remind me about {name}",
  "requirements.ignoreHint": "Skip this prerequisite for all mods and don't remind me again.",
  "requirements.ignoredTitle": "Ignored",
  "requirements.installedTitle": "Already installed via Vortex",
  "requirements.requestedTitle": "Already requested",
  "requirements.downloadTitle": "Download this prerequisite",
  "requirements.cannotDownloadTitle": "Cannot download automatically",
  "requirements.dlcTitle": "Also requires the following DLC",
  "requirements.dlcNote": "DLC cannot be detected automatically; please verify manually.",
  "requirements.selected": "({selected}/{total} selected)",
  "requirements.skipTitle": "Skip prerequisites and download the mod",
  "requirements.downloadSelected": "Download selected ({count})",
  "requirements.downloadSelectedTitle": "Download the checked prerequisites, then the mod",

  "filePicker.title": "Choose a file",
  "filePicker.text": "{modName} has {count} main files. Choose one to download.",

  "category.main": "Main file",
  "category.update": "Update",
  "category.optional": "Optional file",
  "category.oldVersion": "Old version",
  "category.misc": "Miscellaneous",
  "category.removed": "Removed",
  "category.archived": "Archived",

  "sort.relevance": "Relevance",
  "sort.endorsements": "Most Endorsed",
  "sort.downloads": "Most Downloaded",
  "sort.updatedAt": "Recently Updated",
  "sort.createdAt": "Recently Listed",
  "sort.title": "Sort by",

  "pagination.prev": "Previous page",
  "pagination.next": "Next page",
  "pagination.page": "Page {page}",

  "notify.noGame": "Cannot download: no active game.",
  "notify.noFiles": "Cannot download: this mod has no downloadable files.",
  "notify.cancelled": "Download cancelled",
  "notify.alreadyInQueue": "Already in the download queue: {name}",
  "notify.pendingFree": "No download detected. If the page was closed, click {button} again.",
  "notify.pending": "Download is still in progress; check the Downloads page.",
  "notify.installed": "Downloaded and installed: {name}",
  "notify.queued": "Added to the download queue: {name}",
  "notify.downloadFailed": "Download failed: {error}",
  "notify.reqFilesFailed": "Could not get the file list for prerequisite {name}.",
  "notify.reqNoFile": "Prerequisite {name} has no downloadable file.",
  "notify.reqDownloadFailed": "Failed to download prerequisite {name}.",
  "notify.reqSummaryFree": "Opened {count} prerequisite pages in the browser",
  "notify.reqSummaryPremium": "Started downloading {count} prerequisites",
  "notify.reqSummaryFailed": "{count} could not be downloaded automatically; use {button} to handle them.",
  "notify.reqSummarySuffix": " (click Mod manager download once on each page)",

  "error.login": "You need to be logged in to Nexus Mods. Log in from the top-right corner of Vortex and try again.",
  "error.adult": "This content is blocked by your Nexus adult-content preference. Adjust the Adult Content option in your Nexus account settings.",
  "error.notFound": "The requested resource could not be found (it may have been removed or hidden).",
  "error.schema": "Nexus rejected the query ({code}). The extension may be out of date; please update it.",
  "error.generic": "Failed to request the Nexus API",
  "error.timeout": "Request to the Nexus API timed out. Check your connection and try again.",
  "error.connect": "Could not connect to api.nexusmods.com: {message}",
  "error.rateLimit": "Too many requests (HTTP 429). Please try again later.",
  "error.forbidden": "Nexus rejected the request (HTTP 403). The API key may be invalid or lack permission.",
  "error.http": "Nexus API returned HTTP {status}: {body}",
  "error.nonJson": "Nexus API returned non-JSON content: {body}",
  "error.empty": "Nexus API returned empty data.",
  "error.noGamePage": "Game \"{domain}\" has no Nexus Mods page.",
  "error.modNotFound": "Mod {modId} was not found (it may have been removed or hidden).",

  "download.installFailed": "Installation failed",
  "download.downloadFailed": "Download failed",
} as const;

export type MessageKey = keyof typeof EN;

const ZH: Record<MessageKey, string> = {
  "common.download": "下载",
  "common.downloading": "下载中…",
  "common.viewPage": "查看页面",
  "common.details": "详情",
  "common.skip": "跳过",
  "common.continue": "继续",
  "common.requested": "已请求",
  "common.selectAll": "全选",
  "common.search": "搜索",
  "common.refresh": "刷新",
  "common.login": "登录",
  "common.retry": "重试",
  "common.close": "关闭",
  "common.listSeparator": "；",
  "common.nameSeparator": "、",
  "language.label": "语言",

  "page.tab": "模组",
  "page.activatePlaceholder": "先激活一个游戏…",
  "page.searchPlaceholder": "在 {game} 中搜索…",
  "page.results": "{count} 个结果",
  "page.activateGame": "请先在 Games 页面激活一个游戏。",
  "page.emptyQuery": "没有找到与「{query}」匹配的 MOD。",
  "page.emptyNoResults": "这个游戏暂时没有取到结果。",
  "page.browseSite": "在网站上浏览",

  "card.installed": "已安装 !",
  "card.installedTitle": "该 MOD 已安装",
  "card.adult": "成人内容",
  "card.downloadTitle": "下载并安装",
  "card.viewPageTitle": "在 Nexus Mods 打开",
  "card.detailsTitle": "查看 MOD 详情",

  "detail.fallbackTitle": "MOD 详情",
  "detail.empty": "该 MOD 未提供简介。",
  "detail.downloads": "{count} 次下载",
  "detail.endorsements": "{count} 点赞",

  "status.notInstalled": "未安装",
  "status.ignored": "不再提醒",
  "status.installed": "已安装",
  "status.installedVersion": "已安装 v{version}",
  "status.external": "站外组件",
  "status.otherGame": "其他游戏",

  "requirements.title": "需要的前置 MOD",
  "requirements.subtitle": "{modName} · {count} 个前置（{missing} 个未安装）",
  "requirements.unnamedMod": "MOD {modId}",
  "requirements.ignore": "不再提醒",
  "requirements.ignoreLabel": "不再提醒 {name}",
  "requirements.ignoreHint": "以后任何 MOD 需要这个前置时都跳过，不再提醒",
  "requirements.ignoredTitle": "已设为不再提醒",
  "requirements.installedTitle": "已通过 Vortex 安装",
  "requirements.requestedTitle": "已请求",
  "requirements.downloadTitle": "下载此前置",
  "requirements.cannotDownloadTitle": "无法自动下载",
  "requirements.dlcTitle": "还需要以下 DLC",
  "requirements.dlcNote": "插件无法检测 DLC 是否已安装，请自行确认。",
  "requirements.selected": "（已选 {selected}/{total}）",
  "requirements.skipTitle": "跳过前置并下载该 MOD",
  "requirements.downloadSelected": "下载所选（{count}）",
  "requirements.downloadSelectedTitle": "下载勾选的前置，然后下载该 MOD",

  "filePicker.title": "选择要下载的文件",
  "filePicker.text": "{modName} 有 {count} 个主文件，请选择要下载的那一个。",

  "category.main": "主文件",
  "category.update": "更新包",
  "category.optional": "可选文件",
  "category.oldVersion": "旧版本",
  "category.misc": "其他",
  "category.removed": "已移除",
  "category.archived": "已归档",

  "sort.relevance": "相关度",
  "sort.endorsements": "点赞最多",
  "sort.downloads": "下载最多",
  "sort.updatedAt": "最近更新",
  "sort.createdAt": "最新发布",
  "sort.title": "排序方式",

  "pagination.prev": "上一页",
  "pagination.next": "下一页",
  "pagination.page": "第 {page} 页",

  "notify.noGame": "无法下载：没有激活的游戏。",
  "notify.noFiles": "无法下载：该 MOD 没有可下载的文件。",
  "notify.cancelled": "已取消下载",
  "notify.alreadyInQueue": "已在下载列表中：{name}",
  "notify.pendingFree": "没有检测到下载：如果网页已关闭，直接再点一次「{button}」即可。",
  "notify.pending": "下载仍在进行，可在左侧「下载」页查看进度。",
  "notify.installed": "已下载并安装：{name}",
  "notify.queued": "已加入下载队列：{name}",
  "notify.downloadFailed": "下载失败：{error}",
  "notify.reqFilesFailed": "无法获取前置 {name} 的文件列表。",
  "notify.reqNoFile": "前置 {name} 没有可下载的文件。",
  "notify.reqDownloadFailed": "前置下载失败：{name}",
  "notify.reqSummaryFree": "已在浏览器打开 {count} 个前置页面",
  "notify.reqSummaryPremium": "已开始下载 {count} 个前置",
  "notify.reqSummaryFailed": "{count} 个未能自动下载，可用 {button} 手动处理",
  "notify.reqSummarySuffix": "（每个页面需点一次 Mod manager download）",

  "error.login": "需要登录 Nexus Mods 才能执行该操作。请在 Vortex 右上角登录后重试。",
  "error.adult": "该内容被 Nexus 的成人内容偏好拦截。请到 Nexus 网站设置中调整 Adult Content 选项。",
  "error.notFound": "找不到该资源（可能已被删除或隐藏）。",
  "error.schema": "Nexus API 拒绝了该查询（{code}）。可能是插件与 API 版本不匹配，请更新插件。",
  "error.generic": "请求 Nexus API 失败",
  "error.timeout": "请求 Nexus API 超时，请检查网络后重试。",
  "error.connect": "无法连接 api.nexusmods.com：{message}",
  "error.rateLimit": "请求过于频繁（HTTP 429），请稍后再试。",
  "error.forbidden": "Nexus 拒绝了该请求（HTTP 403），可能是 API Key 失效或权限不足。",
  "error.http": "Nexus API 返回 HTTP {status}：{body}",
  "error.nonJson": "Nexus API 返回了非 JSON 内容：{body}",
  "error.empty": "Nexus API 返回了空数据。",
  "error.noGamePage": "游戏 \"{domain}\" 在 Nexus Mods 上没有对应页面。",
  "error.modNotFound": "找不到 Mod {modId}（可能已删除或隐藏）。",

  "download.installFailed": "安装失败",
  "download.downloadFailed": "下载失败",
};

const MESSAGES: Record<Language, Record<MessageKey, string>> = { en: EN, zh: ZH };

let current: Language = "zh";

/** 只在用户选择语言时调用；不要跟随宿主语言自动更新 */
export function setLanguage(language: Language): void {
  current = language;
}

export function getLanguage(): Language {
  return current;
}

export function isLanguage(value: unknown): value is Language {
  return value === "zh" || value === "en";
}

/** O(1) 查表 + `{name}` 占位符替换；不解析 JSON、不做正则大循环 */
export function t(key: MessageKey, params?: Record<string, string | number>): string {
  let text = MESSAGES[current][key] ?? MESSAGES.en[key] ?? key;
  if (params !== undefined) {
    for (const name of Object.keys(params)) {
      text = text.split(`{${name}}`).join(String(params[name]));
    }
  }
  return text;
}
