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
const { DEFAULTS } = require("../dist/state/reducer.js");
const { generate } = require("./preview-data.js");

// ---------------------------------------------------------------------------
// 2) 构造一个"已经加载好数据"的假 store，让页面直接渲染列表
// ---------------------------------------------------------------------------
const GAME_ID = "monsterhunterworld";
const GAME_DOMAIN = "monsterhunterworld";

const previewState = {
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
      results: generate(6),
      totalCount: 131,
    },
  },
};

const fakeApi = {
  getState: () => previewState,
  sendNotification: () => {},
  store: {
    getState: () => previewState,
    subscribe: () => () => {},
    dispatch: () => {},
  },
};

const tree = page({ api: fakeApi });

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

const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Nexus Mod Browser · preview</title>
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

fs.writeFileSync(path.join(outDir, "preview.html"), html, "utf8");
console.log("[preview] 已生成 " + path.join(outDir, "preview.html"));
