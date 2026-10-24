/**
 * `@nexusmods/vortex-api` 的替身，仅供 scripts/smoketest.js 与 render-preview.js 使用。
 * 真实环境里这个 require 会被 Vortex 劫持，返回宿主内部的 api 模块。
 *
 * 这里只实现页面外壳（MainPage / MainPage.Body）、弹窗用到的 Image 控件，
 * 以及一个**极简**的 BBCode 渲染器（见 stubs/bbcode.js）。
 */

function element(type, className, props) {
  return {
    type,
    props: { ...(props || {}), className: className.trim() },
    children: (props && props.children) || [],
  };
}

function MainPage(props) {
  return element("div", `main-page-inner ${(props && props.className) || ""}`, props);
}

function MainPageBody(props) {
  return element("div", `main-page-body ${(props && props.className) || ""}`, props);
}

MainPage.Body = MainPageBody;
MainPage.Header = (props) => element("div", "main-page-header", props);

const React = require("react");
const { bbcodeToReact } = require("./bbcode");

/**
 * 宿主 Image 的替身：真实实现会按 srcs 顺序在 onError 时回退，
 * 这里渲染第一张即可（预览/冒烟只看结构）。
 */
function Image(props) {
  const srcs = Array.isArray(props.srcs) ? props.srcs : [];
  const rest = { ...(props || {}) };
  delete rest.srcs;
  return React.createElement("img", { ...rest, src: srcs[0] });
}

/** 宿主 ZoomableImage 的替身：真实实现点击后全屏，这里只保留 wrapper + img 结构 */
function ZoomableImage(props) {
  return React.createElement(
    "div",
    { className: props.className },
    React.createElement("img", {
      className: "zoomable-image",
      src: props.url,
      "data-zoomable": "true",
    }),
  );
}

module.exports = {
  MainPage,
  MainContext: {},
  DNDContainer: (props) => element("div", "", props),
  FlexLayout: (props) => element("div", "", props),
  Table: (props) => element("div", "", props),
  Icon: (props) => element("span", "", props),
  Image,
  ZoomableImage,
  util: {
    bbcodeToReact: (input) => bbcodeToReact(input, React),
    bbcodePreProcess: (input) => String(input === undefined || input === null ? "" : input),
    bbcodeToHTML: (input) => String(input === undefined || input === null ? "" : input),
  },
  selectors: {},
  actions: {},
  fs: {},
  log: () => {},
  types: {},
};
