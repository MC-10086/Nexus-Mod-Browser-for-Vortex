/**
 * `@nexusmods/vortex-api` 的替身，仅供 scripts/smoketest.js 与 render-preview.js 使用。
 * 真实环境里这个 require 会被 Vortex 劫持，返回宿主内部的 api 模块。
 *
 * 只实现本插件真正用到的三个成员：
 *   - MainPage / MainPage.Body：页面外壳
 *   - ZoomableImage：点击放大控件（这里只保留 wrapper + img 结构）
 *   - util.bbcodeToReact：简介渲染（见 stubs/bbcode.js）
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
  ZoomableImage,
  util: {
    bbcodeToReact: (input) => bbcodeToReact(input, React),
  },
};
