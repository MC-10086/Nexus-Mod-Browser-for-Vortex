/**
 * `@nexusmods/vortex-api` 的替身，仅供 scripts/smoketest.js 使用。
 * 真实环境里这个 require 会被 Vortex 劫持，返回宿主内部的 api 模块。
 *
 * 这里只实现页面外壳（MainPage / MainPage.Body），结构对齐宿主：
 *   <div class="main-page-inner"> <div class="main-page-body">…</div> </div>
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

module.exports = {
  MainPage,
  MainContext: {},
  DNDContainer: (props) => element("div", "", props),
  FlexLayout: (props) => element("div", "", props),
  Table: (props) => element("div", "", props),
  Icon: (props) => element("span", "", props),
  util: {},
  selectors: {},
  actions: {},
  fs: {},
  log: () => {},
  types: {},
};
