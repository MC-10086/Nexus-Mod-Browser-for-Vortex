/**
 * 极简 BBCode → React 转换器（**仅测试/预览用的替身**，不随插件发布）
 * ---------------------------------------------------------------------------
 * 真实运行环境里用的是宿主 `util.bbcodeToReact`（Vortex 内部的完整解析器）。
 * 这个替身只覆盖 N 网简介里常见的标签，目的是让 `smoketest.js` 能断言弹窗结构、
 * 让 `render-preview.js` 生成的静态预览看起来接近真实排版。
 *
 * 不要把它当成生产实现，也不要指望它和宿主 100% 一致。
 */

function parse(input) {
  const root = { name: null, children: [] };
  const stack = [root];
  const top = () => stack[stack.length - 1];
  const pushText = (text) => {
    if (text && text.length > 0) {
      top().children.push(text);
    }
  };

  const KNOWN = new Set([
    "b", "i", "u", "s", "url", "link", "email", "img", "list", "*", "quote",
    "center", "color", "size", "heading", "spoiler", "br", "line", "hr",
    "font", "style", "youtube", "more", "tooltip", "svg",
  ]);

  const re = /\[(\/?)([a-zA-Z*]+)(?:=([^\]]*))?\]/g;
  let last = 0;
  let match;

  while ((match = re.exec(input)) !== null) {
    pushText(input.slice(last, match.index));
    last = re.lastIndex;

    const closing = match[1] === "/";
    const name = match[2].toLowerCase();
    const param = match[3];

    if (!KNOWN.has(name)) {
      pushText(match[0]);
      continue;
    }

    if (closing) {
      for (let i = stack.length - 1; i > 0; i -= 1) {
        if (stack[i].name === name) {
          stack.length = i;
          break;
        }
      }
      continue;
    }

    if (name === "br" || name === "line" || name === "hr") {
      top().children.push({ name, children: [] });
      continue;
    }

    if (name === "*") {
      while (stack.length > 1 && top().name !== "list") {
        stack.pop();
      }
      const item = { name: "li", children: [] };
      top().children.push(item);
      stack.push(item);
      continue;
    }

    const node = { name, param, children: [] };
    top().children.push(node);
    stack.push(node);
  }

  pushText(input.slice(last));
  return root.children;
}

function textOf(nodes) {
  return nodes
    .map((node) => (typeof node === "string" ? node : textOf(node.children)))
    .join("");
}

function renderNodes(nodes, React) {
  return nodes.map((node) => renderNode(node, React)).filter((node) => node !== undefined);
}

function renderNode(node, React) {
  if (typeof node === "string") {
    return node;
  }

  const kids = () => renderNodes(node.children, React);

  switch (node.name) {
    case "br":
      return React.createElement("br");
    case "hr":
    case "line":
      return React.createElement("hr");
    case "img":
      return React.createElement("img", { src: textOf(node.children).trim(), alt: "" });
    case "b":
      return React.createElement("strong", null, kids());
    case "i":
      return React.createElement("em", null, kids());
    case "u":
      return React.createElement("u", null, kids());
    case "s":
      return React.createElement("del", null, kids());
    case "heading":
      return React.createElement("h3", null, kids());
    case "quote":
      return React.createElement("blockquote", null, kids());
    case "center":
      return React.createElement("div", { style: { textAlign: "center" } }, kids());
    case "color":
      return React.createElement("span", { style: { color: node.param } }, kids());
    case "size": {
      const factor = Number(node.param);
      const style = isNaN(factor) ? undefined : { fontSize: `${1 + factor * 0.1}rem` };
      return React.createElement("span", { style }, kids());
    }
    case "list": {
      const tag = node.param === "1" ? "ol" : "ul";
      return React.createElement(tag, null, kids());
    }
    case "li":
      return React.createElement("li", null, kids());
    case "url":
    case "link":
    case "email": {
      const href = node.param !== undefined ? node.param : textOf(node.children);
      return React.createElement("a", { href }, kids());
    }
    case "youtube": {
      const id = textOf(node.children).trim();
      return React.createElement("a", { href: `https://www.youtube.com/watch?v=${id}` }, id);
    }
    case "spoiler": {
      const label = node.param !== undefined ? node.param : "More";
      return React.createElement(
        "div",
        { className: "bbcode-spoiler-tag" },
        [React.createElement("strong", null, label)].concat(kids()),
      );
    }
    case "font":
    case "style":
    case "tooltip":
    case "more":
    case "svg":
    default:
      return React.createElement("span", null, kids());
  }
}

/** 与宿主同名的入口：输入 BBCode 字符串，输出 React 子节点数组 */
function bbcodeToReact(input, React) {
  return renderNodes(parse(String(input === undefined || input === null ? "" : input)), React);
}

module.exports = { bbcodeToReact, parse };
