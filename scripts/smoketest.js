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
// 1) 宿主模块 → stub
// ---------------------------------------------------------------------------
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

assert.strictEqual(calls.reducers.length, 1, "应注册 1 个 reducer");
assert.deepStrictEqual(
  calls.reducers[0].pathParts,
  ["session", "nexusBrowser"],
  "reducer 路径必须是 session.nexusBrowser",
);

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

const DEFAULTS = calls.reducers[0].spec.defaults;

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

  const pageNumbers = findAll(tree, (el) => hasClass(el, "nxm-pagination-number"));
  assert.ok(pageNumbers.length >= 3, "总数 131 > 24，应显示分页");

  assert.ok(text.indexOf("Download") !== -1, "卡片按钮应为英文 Download");
  assert.ok(text.indexOf("View page") !== -1, "卡片按钮应为英文 View page");
  assert.ok(text.indexOf("131 个结果") !== -1, "应显示结果数");
  assert.ok(text.indexOf("模组") !== -1, "应保留「模组」标签");
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
  assert.ok(text.indexOf("Installed !") !== -1, "已安装的 MOD 应显示双语徽标");
  // 预热必须绑在 Download 按钮上，而不是整张卡片
  const downloadBtn = findAll(
    tree,
    (el) => el.type === "button" && String((el.props && el.props.title) || "").indexOf("Download") === 0,
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

console.log("冒烟测试通过：");
console.log(`  reducer 路径 : ${calls.reducers[0].pathParts.join(".")}`);
console.log(`  页面         : ${page.title}（id=${page.options.id}, group=${page.options.group}）`);
console.log("  导航图标     : 镜像搜索图标（mdi path）");
console.log("  渲染场景     : 有数据 / 加载中 / 错误 / 切换游戏");
