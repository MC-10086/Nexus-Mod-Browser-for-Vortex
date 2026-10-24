#!/usr/bin/env node
/**
 * 冒烟测试（开发期用，不随插件发布）
 * ---------------------------------------------------------------------------
 * 验证：
 *   1. 扩展能被加载、init 注册的参数正确（含导航图标 mdi）
 *   2. 页面能用"已加载数据"的假 store 渲染出列表
 *   3. 结构符合官方设计（MainPage 外壳 / tab-bar / 卡片 / 分页 / nxm-* 类）
 *   4. 只有「模组」一个标签，没有「整合包」
 *
 * 用法：node scripts/smoketest.js
 */

const assert = require("assert");
const path = require("path");
const Module = require("module");

// ---------------------------------------------------------------------------
// 1) 宿主模块 → stub；并把 https 拨到"永不应答"，避免冒烟测试真的访问 Nexus
// ---------------------------------------------------------------------------
const https = require("https");
const { EventEmitter } = require("events");

let httpCalls = 0;
https.request = function fakeRequest() {
  httpCalls += 1;
  const req = new EventEmitter();
  req.write = () => {};
  req.end = () => {};
  req.setTimeout = () => {};
  req.destroy = () => {};
  return req;
};

const reactStubPath = path.join(__dirname, "stubs", "react.js");
const vortexApiStubPath = path.join(__dirname, "stubs", "vortex-api.js");

const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (request === "react" || request === "react/jsx-runtime") {
    return reactStubPath;
  }
  if (request === "@nexusmods/vortex-api" || request === "vortex-api") {
    return vortexApiStubPath;
  }
  return originalResolve.call(this, request, ...rest);
};

const React = require(reactStubPath);

// ---------------------------------------------------------------------------
// 2) init
// ---------------------------------------------------------------------------
const extension = require("../dist/index.js");
const init = extension.default ?? extension;
assert.strictEqual(typeof init, "function", "index.js 必须默认导出 init 函数");

const calls = { reducers: [], pages: [], once: 0 };

const gameState = {
  settings: { profiles: { activeProfileId: "p1" } },
  persistent: { profiles: { p1: { gameId: "skyrimse" } } },
  session: {
    gameMode: {
      known: [
        { id: "skyrimse", name: "Skyrim Special Edition", details: { nexusPageId: "skyrimspecialedition" } },
      ],
    },
  },
};

const context = {
  registerReducer(pathParts, spec) {
    calls.reducers.push({ pathParts, spec });
  },
  registerMainPage(icon, title, element, options) {
    calls.pages.push({ icon, title, element, options });
  },
  once(callback) {
    calls.once += 1;
    callback();
  },
  api: {
    store: { getState: () => gameState },
    sendNotification() {},
  },
  optional: {},
  requireExtension() {},
};

assert.strictEqual(init(context), true, "init 应返回 true");

assert.strictEqual(calls.reducers.length, 2, "应注册 2 个 reducer（会话 + 持久化偏好）");
const sliceReducer = calls.reducers.find(
  (item) => item.pathParts.join(".") === "session.nexusBrowser",
);
const prefsReducer = calls.reducers.find(
  (item) => item.pathParts.join(".") === "persistent.nexusBrowserPrefs",
);
assert.ok(sliceReducer, "reducer 路径必须是 session.nexusBrowser");
assert.ok(prefsReducer, "应注册 persistent.nexusBrowserPrefs（手动安装标记）");
assert.ok(prefsReducer.spec.defaults.manualRequirements !== undefined, "偏好 reducer 默认值应含 manualRequirements");

assert.strictEqual(calls.pages.length, 1, "应注册 1 个主页面");
const page = calls.pages[0];
assert.strictEqual(page.options.id, "nexus-mod-browser");
assert.strictEqual(page.options.group, "per-game");
assert.strictEqual(page.title, "Nexus Mod Browser");

// 导航图标：必须是镜像后的搜索图标（mdi 路径）
assert.strictEqual(typeof page.options.mdi, "string", "应通过 mdi 指定导航图标");
assert.ok(page.options.mdi.length > 40, "mdi 应是完整的 SVG path");
assert.ok(page.options.mdi.indexOf("M14.5 3A6.5") === 0, "mdi 应是 mdiMagnify 的水平镜像");

// visible()
assert.strictEqual(page.options.visible(), true, "有激活 profile 时应可见");
context.api.store.getState = () => ({ settings: { profiles: {} } });
assert.strictEqual(page.options.visible(), false, "没有激活 profile 时应隐藏");
context.api.store.getState = () => undefined;
assert.strictEqual(page.options.visible(), false, "store 未就绪时应隐藏");

// ---------------------------------------------------------------------------
// 3) 渲染（用已加载数据的假 store）
// ---------------------------------------------------------------------------
const MODS = [
  {
    modId: 1,
    name: "Stracker's Loader",
    summary: "Restores the plugin loader.",
    version: "1.24",
    downloads: 1284000,
    endorsements: 21800,
    uploader: { name: "Stracker" },
    pictureUrl: "https://staticdelivery.nexusmods.com/thumb1.png",
    adultContent: false,
  },
  {
    modId: 2,
    name: "Worldly Improvements",
    summary: "Bare essentials for QoL.",
    version: "2.1",
    downloads: 341000,
    endorsements: 5400,
    uploader: { name: "KaptainChrucklz" },
    adultContent: false,
  },
  {
    modId: 3,
    name: "Renn's Armor Replacer",
    summary: "Adult themed armour.",
    version: "1.6",
    downloads: 92000,
    endorsements: 2100,
    uploader: { name: "garcia1402" },
    adultContent: true,
  },
];

const DEFAULTS = sliceReducer.spec.defaults;

function makeState(slice, extra) {
  return {
    ...gameState,
    confidential: { account: { nexus: { APIKey: "fake" } } },
    ...(extra || {}),
    session: { ...gameState.session, nexusBrowser: slice },
  };
}

function makeApi(state) {
  const notifications = [];
  const dispatched = [];
  return {
    notifications,
    dispatched,
    getState: () => state,
    sendNotification: (n) => notifications.push(n),
    store: {
      getState: () => state,
      subscribe: () => () => {},
      dispatch: (action) => dispatched.push(action),
    },
  };
}

function childrenOf(node) {
  if (node === null || typeof node !== "object") {
    return [];
  }
  const value = node.children !== undefined ? node.children : node.props && node.props.children;
  if (value === undefined || value === null) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function textOf(element) {
  let out = "";
  const walk = (node) => {
    if (node === null || node === undefined || typeof node === "boolean") {
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (typeof node === "string" || typeof node === "number") {
      out += String(node) + " ";
      return;
    }
    if (typeof node === "object") {
      childrenOf(node).forEach(walk);
    }
  };
  walk(element);
  return out;
}

function findAll(element, predicate) {
  const found = [];
  const walk = (node) => {
    if (node === null || node === undefined || typeof node !== "object") {
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (node.type !== undefined) {
      if (predicate(node)) {
        found.push(node);
      }
      childrenOf(node).forEach(walk);
    }
  };
  walk(element);
  return found;
}

function classOf(node) {
  return String((node.props && node.props.className) || "");
}

/** 精确匹配 class token（避免 "nxm-tab-bar" 命中 "nxm-tab-bar-scroller"） */
function hasClass(node, token) {
  return classOf(node).split(/\s+/).indexOf(token) !== -1;
}

function render(state) {
  React.__resetHooks();
  const api = makeApi(state);
  const tree = page.element({ api });
  React.__runCleanups();
  return { tree, api, text: textOf(tree).replace(/\s+/g, " ") };
}

// 场景 A：有数据
{
  const slice = {
    ...DEFAULTS,
    domain: "skyrimspecialedition",
    loading: false,
    query: "",
    results: MODS,
    totalCount: 131,
  };
  const { tree, text } = render(makeState(slice));

  assert.strictEqual(
    findAll(tree, (el) => hasClass(el, "main-page-inner")).length,
    1,
    "应渲染 MainPage 外壳",
  );
  assert.strictEqual(
    findAll(tree, (el) => hasClass(el, "nxm-tab-bar")).length,
    1,
    "应渲染标签栏",
  );

  const tiles = findAll(tree, (el) => el.props && el.props["data-testid"] === "mod-tile");
  assert.strictEqual(tiles.length, 3, "应渲染 3 张卡片");

  const zoomCovers = findAll(
    tree,
    (el) => el.type === "img" && el.props && el.props["data-zoomable"] === "true",
  );
  assert.ok(zoomCovers.length >= 1, "卡片封面应使用 ZoomableImage");
  assert.strictEqual(zoomCovers[0].props.onClick, undefined, "封面不应再跳 N 网");

  const pageNumbers = findAll(tree, (el) => hasClass(el, "nxm-pagination-number"));
  assert.ok(pageNumbers.length >= 3, "总数 131 > 24，应显示分页");

  assert.ok(text.indexOf("下载") !== -1, "卡片按钮应显示当前语言「下载」");
  assert.ok(text.indexOf("查看页面") !== -1, "卡片按钮应显示当前语言「查看页面」");
  assert.ok(text.indexOf("131 个结果") !== -1, "应显示结果数");
  assert.ok(text.indexOf("模组") !== -1, "应保留「模组」标签");

  const languageMenus = findAll(
    tree,
    (el) => el.type === "button" && el.props && el.props.title === "语言",
  );
  assert.strictEqual(languageMenus.length, 1, "页头应有复用 SortMenu 的语言下拉");
  assert.ok(
    textOf(languageMenus[0]).indexOf("中文") !== -1,
    "语言下拉默认应显示中文",
  );
  assert.strictEqual(text.indexOf("整合包"), -1, "不应再有「整合包」标签");

  const buttons = findAll(tree, (el) => el.type === "button");
  const bad = buttons.filter((btn) => !/(^|\s)nxm-/.test(classOf(btn)));
  assert.strictEqual(bad.length, 0, "所有按钮都必须使用宿主 nxm-* 语义类");
}

// 场景 A2：已安装徽标（按 attributes.modId 判定，不靠名字）
{
  const slice = {
    ...DEFAULTS,
    domain: "skyrimspecialedition",
    loading: false,
    results: MODS,
    totalCount: 60,
  };
  const state = makeState(slice, {
    persistent: {
      profiles: { p1: { gameId: "skyrimse" } },
      mods: {
        skyrimse: {
          "installed-1": { attributes: { modId: MODS[0].modId, source: "nexus" } },
        },
      },
    },
  });
  const { text, tree } = render(state);
  assert.ok(text.indexOf("已安装 !") !== -1, "已安装的 MOD 应显示当前语言徽标");
  // 预热必须绑在 Download 按钮上，而不是整张卡片
  const downloadBtn = findAll(
    tree,
    (el) => el.type === "button" && String((el.props && el.props.title) || "") === "下载并安装",
  )[0];
  assert.ok(downloadBtn, "应存在 Download 按钮");
  assert.strictEqual(typeof downloadBtn.props.onMouseEnter, "function", "Download 按钮应绑定 hover 预热");
  const tileRoot = findAll(tree, (el) => el.props && el.props["data-testid"] === "mod-tile")[0];
  assert.strictEqual(tileRoot.props.onMouseEnter, undefined, "卡片本身不应再绑定预热");
}

// 场景 B：加载中 → 骨架
{
  const slice = { ...DEFAULTS, domain: "skyrimspecialedition", loading: true };
  const { tree } = render(makeState(slice));
  assert.ok(
    findAll(tree, (el) => hasClass(el, "animate-pulse")).length === 6,
    "加载中应显示 6 个骨架块",
  );
}

// 场景 C：错误态
{
  const slice = {
    ...DEFAULTS,
    domain: "skyrimspecialedition",
    loading: false,
    error: { message: "请求 Nexus API 超时，请检查网络后重试。" },
  };
  const { text } = render(makeState(slice));
  assert.ok(text.indexOf("超时") !== -1, "应显示错误信息");
  assert.ok(text.indexOf("重试") !== -1, "应提供重试按钮");
}

// 场景 D：切换游戏时应 dispatch SET_GAME
{
  const slice = { ...DEFAULTS, domain: "fallout4", loading: false, results: MODS, totalCount: 3 };
  const { api } = render(makeState(slice));
  const setGame = api.dispatched.find((action) => action.type === "NEXUS_BROWSER_SET_GAME");
  assert.ok(setGame, "游戏域名变化时应 dispatch SET_GAME");
  assert.strictEqual(setGame.payload.domain, "skyrimspecialedition");
}

// ---------------------------------------------------------------------------
// 详情弹窗：入口 / 内容 / 三种数据状态 / 空简介
// ---------------------------------------------------------------------------
const DETAIL = {
  modId: MODS[0].modId,
  name: MODS[0].name,
  summary: MODS[0].summary,
  description:
    "[b]Bold text[/b] and [url=https://www.nexusmods.com/skyrimspecialedition]a link[/url]\n<br />" +
    "[list]\n<br />[*]First item[/*]\n<br />[*]Second item[/*]\n<br />[/list]",
  pictureUrl: "https://staticdelivery.nexusmods.com/main.png",
  thumbnailLargeUrl: "https://images.nexusmods.com/large.png",
  author: "Stracker",
  version: "1.24",
  downloads: 1284000,
  endorsements: 21800,
  uploader: { name: "Stracker" },
};

// 场景 E：入口按钮 → dispatch SELECT_MOD（入口本身可随时换掉，弹窗只看 state）
{
  const slice = {
    ...DEFAULTS,
    domain: "skyrimspecialedition",
    loading: false,
    results: MODS,
    totalCount: 131,
  };
  const { tree, api } = render(makeState(slice));
  const detailsButton = findAll(
    tree,
    (el) => el.type === "button" && textOf(el).trim() === "详情",
  )[0];
  assert.ok(detailsButton, "卡片底部应有 Details 按钮");
  assert.strictEqual(typeof detailsButton.props.onClick, "function", "Details 按钮应可点击");
  assert.strictEqual(detailsButton.props.disabled, undefined, "Details 不应被禁用");

  detailsButton.props.onClick();
  const action = api.dispatched.find((item) => item.type === "NEXUS_BROWSER_SELECT_MOD");
  assert.ok(action, "点 Details 应 dispatch SELECT_MOD");
  assert.strictEqual(action.payload.modId, MODS[0].modId);
}

// 场景 F：详情已就绪 → 主图 + 标题 + 元信息 + BBCode 正文 + 三种关闭方式
{
  const slice = {
    ...DEFAULTS,
    domain: "skyrimspecialedition",
    loading: false,
    results: MODS,
    totalCount: 131,
    selectedModId: MODS[0].modId,
    detail: DETAIL,
  };
  const { tree, text } = render(makeState(slice));

  const dialog = findAll(tree, (el) => el.props && el.props["data-testid"] === "mod-detail");
  assert.strictEqual(dialog.length, 1, "应渲染详情弹窗");
  assert.ok(hasClass(dialog[0], "nxm-modal"), "弹窗外壳应使用宿主 nxm-modal 类");
  assert.ok(hasClass(dialog[0], "nxm-modal-xl"), "详情弹窗应为 -xl 尺寸");

  const overlay = findAll(tree, (el) => hasClass(el, "nxm-modal-overlay"))[0];
  assert.ok(overlay, "应有遮罩层");
  assert.strictEqual(typeof overlay.props.onClick, "function", "点遮罩应能关闭");

  const closeButton = findAll(
    tree,
    (el) => el.type === "button" && hasClass(el, "nxm-modal-close"),
  )[0];
  assert.ok(closeButton, "右上角应有宿主样式的关闭按钮");
  assert.strictEqual(closeButton.props["aria-label"], "关闭", "关闭按钮跟随当前语言");
  assert.strictEqual(typeof closeButton.props.onClick, "function", "点 × 应能关闭");

  const hero = findAll(
    tree,
    (el) => el.type === "img" && el.props && el.props.src === DETAIL.pictureUrl,
  );
  assert.strictEqual(hero.length, 1, "应显示主图（第一候选）");
  assert.strictEqual(hero[0].props["data-zoomable"], "true", "主图应使用 ZoomableImage");

  assert.ok(text.indexOf(MODS[0].name) !== -1, "应显示标题");
  assert.ok(text.indexOf("1.28M 次下载") !== -1, "应显示下载量元信息");
  assert.ok(text.indexOf("v1.24") !== -1, "应显示版本");

  const body = findAll(
    tree,
    (el) => el.props && el.props["data-testid"] === "mod-detail-body",
  )[0];
  assert.ok(body, "简介应渲染在正文容器里");

  // 排版补丁：必须是"宿主类作用域"，不能新造类名（tailwind 是按需编译的）
  const detailStyles = findAll(tree, (el) => el.type === "style");
  const styleNode = detailStyles.find(
    (el) => textOf(el).indexOf(".nxm-modal .nxm-modal-panel a") !== -1,
  );
  assert.ok(styleNode, "应注入 BBCode 排版补丁 <style>");
  const cssText = textOf(styleNode);
  assert.ok(
    cssText.indexOf(".nxm-modal .nxm-modal-panel a") !== -1,
    "排版补丁应以宿主 .nxm-modal 作用域生效",
  );
  assert.strictEqual(
    cssText.indexOf("nxm-mod-browser-detail"),
    -1,
    "不应自造类名（只用宿主类 + 内联样式）",
  );
  assert.ok(
    findAll(tree, (el) => el.type === "strong").length >= 1,
    "BBCode 粗体应被渲染成 <strong>",
  );
  const link = findAll(tree, (el) => el.type === "a")[0];
  assert.ok(link, "BBCode 链接应被渲染成 <a>");
  assert.strictEqual(link.props.href, "https://www.nexusmods.com/skyrimspecialedition");
  assert.ok(findAll(tree, (el) => el.type === "ul").length >= 1, "BBCode 列表应被渲染成 <ul>");
  assert.ok(findAll(tree, (el) => el.type === "li").length >= 2, "列表项应被渲染成 <li>");
  assert.strictEqual(
    findAll(tree, (el) => el.props && el.props["data-testid"] === "mod-detail-loading").length,
    0,
    "详情就绪后不应再显示骨架",
  );
}

// 场景 G：详情加载中 → 骨架，而不是空弹窗
{
  const slice = {
    ...DEFAULTS,
    domain: "skyrimspecialedition",
    loading: false,
    results: MODS,
    totalCount: 131,
    selectedModId: MODS[0].modId,
    detailLoading: true,
  };
  const { tree, text } = render(makeState(slice));
  assert.strictEqual(
    findAll(tree, (el) => el.props && el.props["data-testid"] === "mod-detail-loading").length,
    1,
    "加载中应显示骨架",
  );
  assert.ok(text.indexOf("该 MOD 未提供简介") === -1, "加载中不能先闪『未提供简介』");
}

// 场景 H：详情加载失败 → 错误文案 + Retry
{
  const slice = {
    ...DEFAULTS,
    domain: "skyrimspecialedition",
    loading: false,
    results: MODS,
    totalCount: 131,
    selectedModId: MODS[0].modId,
    detailLoading: false,
    detailError: "请求 Nexus API 超时，请检查网络后重试。",
  };
  const { tree, text } = render(makeState(slice));
  assert.ok(text.indexOf("超时") !== -1, "应显示详情错误文案");
  const retry = findAll(tree, (el) => el.type === "button" && textOf(el).trim() === "重试")[0];
  assert.ok(retry, "应提供 Retry 按钮");
  assert.strictEqual(typeof retry.props.onClick, "function", "Retry 应可点击");
}

// 场景 I：简介为空的 MOD → 显示兜底文案，不出现空白正文
{
  const slice = {
    ...DEFAULTS,
    domain: "skyrimspecialedition",
    loading: false,
    results: MODS,
    totalCount: 131,
    selectedModId: MODS[0].modId,
    detail: { ...DETAIL, description: "", summary: "" },
  };
  const { tree, text } = render(makeState(slice));
  assert.ok(text.indexOf("该 MOD 未提供简介") !== -1, "空简介应显示兜底文案");
  const body = findAll(
    tree,
    (el) => el.props && el.props["data-testid"] === "mod-detail-body",
  )[0];
  assert.ok(body, "兜底文案也应放在正文容器里");
}

// ---------------------------------------------------------------------------
// 前置弹窗：行模型 / 每行按钮 / 勾选 / 底部操作
// ---------------------------------------------------------------------------
{
  const reqUtil = require("../dist/util/requirements");
  const RequirementsDialog = require("../dist/ui/RequirementsDialog.js").default;

  const info = {
    gameNumericId: "1704",
    totalCount: 6,
    nexus: [
      { gameId: "1704", modId: "30379", modName: "SKSE", notes: "需要 1.6.640+", externalRequirement: false },
      { gameId: "1704", modId: "266", modName: "USSEP", externalRequirement: false },
      { gameId: "1704", modId: "999", modName: "Manual Mod", externalRequirement: false },
      { gameId: "1704", modId: "123", modName: "Installed Mod", externalRequirement: false },
      { gameId: "1704", modId: "0", modName: "VC++", url: "https://example.invalid/vc", externalRequirement: true },
      { gameId: "9999", modId: "555", modName: "Cross Game", externalRequirement: false },
    ],
    dlc: [{ gameExpansion: { name: "Saints &amp; Seducers" }, notes: "" }],
  };

  const rows = reqUtil.buildRequirementRows({
    info,
    installed: new Map([[123, { version: "1.2.3" }]]),
    manual: [999],
    domain: "skyrimspecialedition",
    selfModId: 100,
  });

  const decisions = [];
  const downloads = [];
  const views = [];
  const details = [];

  React.__resetHooks();
  const tree = RequirementsDialog({
    data: {
      modName: "SkyUI",
      rows,
      dlc: reqUtil.buildDlcRows(info),
      defaultSelected: reqUtil.defaultSelectedModIds(rows),
    },
    onDecision: (decision) => decisions.push(decision),
    onDownloadOne: async (row) => {
      downloads.push(row.modId);
      return true;
    },
    onViewPage: (row) => views.push(row.modId),
    onDetails: (row) => details.push(row.modId),
  });
  React.__runCleanups();

  assert.strictEqual(
    findAll(tree, (el) => el.props && el.props["data-testid"] === "requirements-dialog").length,
    1,
    "应渲染前置弹窗",
  );

  const rowNodes = findAll(tree, (el) => el.props && el.props["data-testid"] === "requirement-row");
  assert.strictEqual(rowNodes.length, 6, "应渲染 6 行前置");
  assert.deepStrictEqual(
    rowNodes.map((el) => el.props["data-kind"]),
    ["missing", "missing", "manual", "installed", "external", "otherGame"],
    "行顺序：未安装 → 手动 → 已安装 → 站外 → 其他游戏",
  );

  // 每行都有 Download / View page
  const downloadButtons = findAll(
    tree,
    (el) => el.type === "button" && textOf(el).trim() === "下载",
  );
  assert.strictEqual(downloadButtons.length, 6, "每行都应有 Download 按钮");
  assert.deepStrictEqual(
    downloadButtons.map((btn) => btn.props.disabled === true),
    [false, false, true, true, true, true],
    "不再提醒 / 已安装 / 站外 / 其他游戏的 Download 应置灰",
  );

  const viewButtons = findAll(
    tree,
    (el) => el.type === "button" && textOf(el).trim() === "查看页面",
  );
  assert.strictEqual(viewButtons.length, 6, "每行都应有 View page 按钮");
  assert.strictEqual(
    viewButtons[5].props.disabled,
    true,
    "没有 URL 的其他游戏前置 View page 应置灰",
  );

  // 2 个未安装行的下载勾选 + 3 个"不再提醒"（2 未安装 + 1 忽略）+ 1 个全选 = 6
  const checkboxes = findAll(tree, (el) => el.props && el.props.role === "checkbox");
  assert.strictEqual(checkboxes.length, 6, "下载勾选 / 不再提醒 / 全选");

  const boxByLabel = (label) =>
    checkboxes.find((box) => box.props["aria-label"] === label);
  assert.strictEqual(boxByLabel("SKSE").props["aria-checked"], true, "未安装默认勾选");
  assert.strictEqual(boxByLabel("USSEP").props["aria-checked"], true, "未安装默认勾选");
  assert.strictEqual(
    boxByLabel("Manual Mod"),
    undefined,
    "不再提醒的行视为已安装，不应有下载勾选",
  );
  assert.strictEqual(
    boxByLabel("不再提醒 Manual Mod").props["aria-checked"],
    true,
    "手动标记的行默认勾上『不再提醒』",
  );
  assert.strictEqual(boxByLabel("不再提醒 SKSE").props["aria-checked"], false);
  assert.strictEqual(boxByLabel("全选").props["aria-checked"], true);

  const text = textOf(tree).replace(/\s+/g, " ");
  assert.ok(text.indexOf("还需要以下 DLC") !== -1, "应提示 DLC");
  assert.ok(text.indexOf("Saints & Seducers") !== -1, "DLC 名应解码显示");
  assert.strictEqual(text.indexOf("当前是免费账号"), -1, "前置弹窗不应再显示免费账号说明");
  assert.strictEqual(text.indexOf("Mod manager download"), -1, "前置弹窗不应再显示免费下载说明");
  assert.ok(text.indexOf("不再提醒") !== -1, "应有『不再提醒』选项");
  assert.ok(text.indexOf("下载所选（2）") !== -1, "主按钮应显示已选数量");

  // 弹窗底部不再有 Cancel（和右上角 × 重复）
  assert.strictEqual(
    findAll(tree, (el) => el.type === "button" && textOf(el).trim() === "Cancel").length,
    0,
    "底部不应再有 Cancel 按钮",
  );

  // 点主按钮：返回默认勾选的 2 项 + 已忽略的 999
  const primary = findAll(
    tree,
    (el) => el.type === "button" && textOf(el).trim() === "下载所选（2）",
  )[0];
  primary.props.onClick();
  assert.strictEqual(decisions[0].kind, "download");
  assert.deepStrictEqual(decisions[0].selected, [30379, 266]);
  assert.deepStrictEqual(decisions[0].ignored, [999]);

  // 单行 Download 立即触发
  downloadButtons[0].props.onClick();
  assert.deepStrictEqual(downloads, [30379], "单行 Download 应立即触发");

  // View page 打开链接
  viewButtons[0].props.onClick();
  assert.deepStrictEqual(views, [30379], "View page 应打开对应页面");

  // Details：同一个游戏且有 Nexus modId 的行（SKSE / USSEP / PapyrusUtil / 已安装）
  const detailButtons = findAll(
    tree,
    (el) => el.type === "button" && textOf(el).trim() === "详情",
  );
  assert.strictEqual(detailButtons.length, 4, "站外/其他游戏行不应有 Details");
  detailButtons[0].props.onClick();
  assert.deepStrictEqual(details, [30379], "Details 应把行传给页面");

  // 右上角 × = Cancel
  const closeButton = findAll(
    tree,
    (el) => el.type === "button" && hasClass(el, "nxm-modal-close"),
  )[0];
  closeButton.props.onClick();
  assert.strictEqual(decisions[decisions.length - 1].kind, "cancel");
}

// ---------------------------------------------------------------------------
// 场景 L：英文界面 + N 网内容原样显示
// ---------------------------------------------------------------------------
{
  const i18n = require("../dist/i18n.js");
  const ModTile = require("../dist/ui/ModTile.js").default;
  const mod = {
    modId: 999,
    name: "N网名称",
    summary: "N网简介",
    category: "N网分类",
    downloads: 1,
    endorsements: 2,
  };

  i18n.setLanguage("en");
  React.__resetHooks();
  const tree = ModTile({
    mod,
    category: "N网分类",
    installed: true,
    onDownload: () => undefined,
    onViewPage: () => undefined,
    onDetails: () => undefined,
  });
  React.__runCleanups();

  const text = textOf(tree).replace(/\s+/g, " ");
  assert.ok(text.indexOf("Download") !== -1, "英文界面应显示 Download");
  assert.ok(text.indexOf("View page") !== -1, "英文界面应显示 View page");
  assert.ok(text.indexOf("Details") !== -1, "英文界面应显示 Details");
  assert.ok(text.indexOf("Installed !") !== -1, "英文界面应显示 Installed !");
  assert.ok(text.indexOf("N网名称") !== -1, "N 网 MOD 名称必须原样显示");
  assert.ok(text.indexOf("N网简介") !== -1, "N 网简介必须原样显示");
  assert.ok(text.indexOf("N网分类") !== -1, "N 网分类必须原样显示");

  i18n.setLanguage("zh");
}

console.log("冒烟测试通过：");
console.log(`  reducer 路径 : ${sliceReducer ? sliceReducer.pathParts.join(".") : "?"}`);
console.log(`  页面         : ${page.title}（id=${page.options.id}, group=${page.options.group}）`);
console.log("  导航图标     : 镜像搜索图标（mdi path）");
console.log("  渲染场景     : 有数据 / 加载中 / 错误 / 切换游戏 / 详情就绪 / 详情加载 / 详情错误 / 空简介 / 前置弹窗");
