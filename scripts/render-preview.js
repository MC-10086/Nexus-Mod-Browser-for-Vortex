#!/usr/bin/env node
/**
 * 生成静态预览（开发期用，不随插件发布）
 * ---------------------------------------------------------------------------
 * 把页面组件渲染成 HTML，套上宿主真实的 tailwind-v4.css，
 * 然后用 Edge 无头模式截图，用来在装进 Vortex 之前先看外观。
 *
 * 用法：node scripts/render-preview.js
 * 产物：build/preview/preview.html（+ tailwind.css 副本）
 */

const fs = require("fs");
const path = require("path");
const Module = require("module");

const projectRoot = path.resolve(__dirname, "..");
const outDir = path.join(projectRoot, "build", "preview");

// ---------------------------------------------------------------------------
// 1) 宿主模块 stub
// ---------------------------------------------------------------------------
const reactStub = path.join(__dirname, "stubs", "react.js");
const vortexStub = path.join(__dirname, "stubs", "vortex-api.js");
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (request === "react" || request === "react/jsx-runtime") {
    return reactStub;
  }
  if (request === "@nexusmods/vortex-api" || request === "vortex-api") {
    return vortexStub;
  }
  return originalResolve.call(this, request, ...rest);
};

const React = require(reactStub);
const page = require("../dist/ui/BrowseModsPage.js").default;
const RequirementsDialog = require("../dist/ui/RequirementsDialog.js").default;
const reqUtil = require("../dist/util/requirements.js");
const { DEFAULTS } = require("../dist/state/reducer.js");
const { generate, detailOf } = require("./preview-data.js");

// ---------------------------------------------------------------------------
// 2) 构造"已经加载好数据"的假 store；列表页与详情弹窗各渲染一份
// ---------------------------------------------------------------------------
const GAME_ID = "monsterhunterworld";
const GAME_DOMAIN = "monsterhunterworld";
const RESULTS = generate(6);

function makeState(slice) {
  return {
    settings: { profiles: { activeProfileId: "p1" } },
    persistent: {
      profiles: { p1: { gameId: GAME_ID } },
      // 让预览里能看到「已安装」徽标（modId 1000 = 生成的第一个 mod）
      mods: { [GAME_ID]: { "installed-preview": { attributes: { modId: 1000, source: "nexus" } } } },
    },
    confidential: { account: { nexus: { APIKey: "preview-key" } } },
    session: {
      gameMode: {
        known: [
          { id: GAME_ID, name: "Monster Hunter: World", details: { nexusPageId: GAME_DOMAIN } },
        ],
      },
      nexusBrowser: {
        ...DEFAULTS,
        domain: GAME_DOMAIN,
        loading: false,
        results: RESULTS,
        totalCount: 131,
        ...slice,
      },
    },
  };
}

function makeApi(state) {
  return {
    getState: () => state,
    sendNotification: () => {},
    store: {
      getState: () => state,
      subscribe: () => () => {},
      dispatch: () => {},
    },
  };
}

function renderPage(state) {
  React.__resetHooks();
  const tree = page({ api: makeApi(state) });
  React.__runCleanups();
  return tree;
}

const listTree = renderPage(makeState({}));
const detailTree = renderPage(
  makeState({
    selectedModId: RESULTS[0].modId,
    detail: detailOf(RESULTS[0]),
  }),
);

// ---------------------------------------------------------------------------
// 2b) 前置弹窗（独立组件，直接喂假数据）
// ---------------------------------------------------------------------------
const REQUIREMENT_INFO = {
  gameNumericId: "1704",
  legacyModRequirementsEnabled: true,
  totalCount: 6,
  nexus: [
    {
      gameId: "1704",
      modId: "30379",
      modName: "Skyrim Script Extender (SKSE64)",
      notes: "需要游戏版本 1.6.640 或更高",
      externalRequirement: false,
    },
    {
      gameId: "1704",
      modId: "32444",
      modName: "Address Library for SKSE Plugins",
      externalRequirement: false,
    },
    {
      gameId: "1704",
      modId: "999",
      modName: "PapyrusUtil SE",
      externalRequirement: false,
    },
    {
      gameId: "1704",
      modId: "123",
      modName: "Unofficial Skyrim Special Edition Patch",
      externalRequirement: false,
    },
    {
      gameId: "1704",
      modId: "0",
      modName: "Microsoft Visual C++ 2015-2022 Redistributable",
      url: "https://example.invalid/vc",
      externalRequirement: true,
    },
  ],
  dlc: [
    { gameExpansion: { name: "Saints &amp; Seducers" }, notes: "" },
    { gameExpansion: { name: "Rare Curios" }, notes: "" },
  ],
};

const REQUIREMENT_ROWS = reqUtil.buildRequirementRows({
  info: REQUIREMENT_INFO,
  installed: new Map([[123, { version: "4.3.1" }]]),
  manual: [999],
  domain: "skyrimspecialedition",
  selfModId: 1,
});

React.__resetHooks();
const requirementsTree = RequirementsDialog({
  data: {
    modName: "SkyUI",
    rows: REQUIREMENT_ROWS,
    dlc: reqUtil.buildDlcRows(REQUIREMENT_INFO),
    freeAccount: false,
    defaultSelected: reqUtil.defaultSelectedModIds(REQUIREMENT_ROWS),
  },
  onDecision: () => undefined,
  onDownloadOne: async () => true,
  onViewPage: () => undefined,
  onDetails: () => undefined,
});
React.__runCleanups();

const VOID_TAGS = new Set(["img", "input", "br", "hr", "meta", "link", "path", "circle", "rect", "stop", "use"]);
const SKIP_PROPS = new Set([
  "onClick",
  "onChange",
  "onSubmit",
  "onKeyDown",
  "onMouseEnter",
  "onMouseLeave",
  "children",
]);

function escapeText(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttr(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function styleToString(style) {
  if (!style) {
    return "";
  }
  if (typeof style === "string") {
    return style;
  }
  return Object.keys(style)
    .filter((key) => style[key] !== undefined && style[key] !== null)
    .map((key) => `${key.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase())}:${style[key]}`)
    .join(";");
}

function attrs(props) {
  const out = [];
  for (const key of Object.keys(props || {})) {
    if (SKIP_PROPS.has(key)) {
      continue;
    }
    const value = props[key];
    if (value === undefined || value === null || value === false) {
      continue;
    }
    if (key === "className") {
      out.push(`class="${escapeAttr(value)}"`);
      continue;
    }
    if (key === "style") {
      const style = styleToString(value);
      if (style) {
        out.push(`style="${escapeAttr(style)}"`);
      }
      continue;
    }
    if (key === "dangerouslySetInnerHTML") {
      continue;
    }
    if (typeof value === "object") {
      continue;
    }
    if (value === true) {
      out.push(key);
      continue;
    }
    out.push(`${key}="${escapeAttr(value)}"`);
  }
  return out.length > 0 ? " " + out.join(" ") : "";
}

function childrenOf(node) {
  const value = node.children !== undefined ? node.children : node.props && node.props.children;
  if (value === undefined || value === null) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function render(node) {
  if (node === null || node === undefined || node === false || node === true) {
    return "";
  }
  if (Array.isArray(node)) {
    return node.map(render).join("");
  }
  if (typeof node === "string" || typeof node === "number") {
    return escapeText(node);
  }
  if (typeof node !== "object" || node.type === undefined) {
    return "";
  }

  const tag = String(node.type);
  const open = `<${tag}${attrs(node.props)}>`;
  if (VOID_TAGS.has(tag)) {
    return open;
  }
  return `${open}${childrenOf(node).map(render).join("")}</${tag}>`;
}

// ---------------------------------------------------------------------------
// 3) 输出
// ---------------------------------------------------------------------------
fs.mkdirSync(outDir, { recursive: true });

const cssSource = "E:/Game/Vortex/resources/app.asar.unpacked/assets/css/tailwind-v4.css";
if (fs.existsSync(cssSource)) {
  fs.copyFileSync(cssSource, path.join(outDir, "tailwind.css"));
} else {
  console.warn("[preview] 找不到 tailwind-v4.css，预览将没有样式");
}

function pageHtml(title, tree) {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${title}</title>
<link rel="stylesheet" href="tailwind.css" />
<style>
  html, body { margin: 0; height: 100%; }
  body {
    background: #141414;
    color: #dddddd;
    font-family: "Segoe UI", system-ui, sans-serif;
    font-size: 14px;
  }
  /* 模拟 Vortex 主内容区的容器尺寸 */
  #host { height: 100%; overflow: hidden; }
  .main-page-inner { height: 100%; }
</style>
</head>
<body>
<div id="host">${render(tree)}</div>
</body>
</html>`;
}

const targets = [
  ["preview.html", "Nexus Mod Browser · preview", listTree],
  ["preview-detail.html", "Nexus Mod Browser · detail dialog", detailTree],
  ["preview-requirements.html", "Nexus Mod Browser · requirements dialog", requirementsTree],
];

for (const [file, title, tree] of targets) {
  const target = path.join(outDir, file);
  fs.writeFileSync(target, pageHtml(title, tree), "utf8");
  console.log("[preview] 已生成 " + target);
}
