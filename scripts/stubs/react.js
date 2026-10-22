/**
 * React 的最小替身，仅供 scripts/smoketest.js 使用。
 * 真正运行时用的是 Vortex 内置的 React 18（通过 require("react") 解析）。
 *
 * 它实现了一个"单次渲染"的 hooks 调度器：
 *   - useState 返回初值与 noop setter
 *   - useEffect 立即执行（收集 cleanup，不模拟依赖比较）
 *   - useMemo / useCallback 直通
 * 足以让函数组件被调用一次并检查返回的元素树。
 */

let hookIndex = 0;
let cleanups = [];

const React = {
  /**
   * 迷你渲染器：函数组件会被立即调用并展开（真实 React 也这么做，只是延后到 reconcile 阶段）。
   * 这样测试里遍历到的就是一整棵真实的 DOM 元素树。
   */
  createElement(type, props) {
    const children = Array.prototype.slice.call(arguments, 2);
    const merged = Object.assign({}, props || {});
    if (children.length === 1) {
      merged.children = children[0];
    } else if (children.length > 1) {
      merged.children = children;
    }
    if (typeof type === "function") {
      return type(merged);
    }
    return { type, props: merged, children };
  },

  Fragment: "Fragment",

  useState(initial) {
    const value = typeof initial === "function" ? initial() : initial;
    hookIndex += 1;
    return [value, () => {}];
  },

  useRef(initial) {
    hookIndex += 1;
    return { current: initial };
  },

  useMemo(factory) {
    hookIndex += 1;
    return factory();
  },

  useCallback(fn) {
    hookIndex += 1;
    return fn;
  },

  useEffect(effect) {
    hookIndex += 1;
    const cleanup = effect();
    if (typeof cleanup === "function") {
      cleanups.push(cleanup);
    }
  },

  /** 测试辅助：重置 hooks 状态 */
  __resetHooks() {
    hookIndex = 0;
    cleanups = [];
  },

  /** 测试辅助：执行已注册的 cleanup */
  __runCleanups() {
    for (const cleanup of cleanups) {
      cleanup();
    }
    cleanups = [];
  },
};

module.exports = React;
module.exports.default = React;
