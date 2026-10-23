/**
 * 扩展入口
 * ---------------------------------------------------------------------------
 * Vortex 的加载约定（源码 ExtensionManager.ts:742 / 2894）：
 *   - 目录里必须有 info.json + index.js（或 index.cjs，.cjs 优先）
 *   - index.js 默认导出（或具名导出 init）一个 `function init(context)`
 *   - init 会被调用两次（主进程 + 渲染进程），所以**只能注册，不能干活**
 *   - 真正的初始化放到 context.once() 里
 *
 * 本文件只做三件事：注册 reducer、注册主页面、（可选）注册设置项。
 */

import { EXTENSION_ID, MIRRORED_SEARCH_ICON, PAGE_TITLE } from "./constants";
import { reducerSpec } from "./state/reducer";
import { prefsReducerSpec } from "./state/prefs";
import BrowseModsPage from "./ui/BrowseModsPage";

/**
 * Vortex 的 IExtensionContext 子集。
 * 只声明本项目用到的成员，避免依赖 `@nexusmods/vortex-api`（它只有类型，运行时不可 require）。
 */
export interface IExtensionContextLite {
  /** 注册 redux reducer：path 决定 state 位置与是否持久化 */
  registerReducer: (path: string[], spec: any) => void;

  /** 注册主内容区页面 */
  registerMainPage: (
    icon: string,
    title: string,
    element: any,
    options: {
      id?: string;
      group: "dashboard" | "global" | "per-game" | "support" | "hidden";
      priority?: number;
      mdi?: string;
      hotkey?: string;
      hotkeyRaw?: string;
      visible?: () => boolean;
      props?: () => any;
    },
  ) => void;

  /** 所有扩展加载完成后调用一次（渲染进程） */
  once: (callback: () => void | PromiseLike<void>) => void;

  /** 运行时 API（store / events / notifications …） */
  api: any;

  /** 可选的注册函数：宿主或依赖扩展没提供时，调用它不会导致扩展加载失败 */
  optional: any;

  /** 声明依赖其他扩展，缺失时不加载本扩展 */
  requireExtension: (extId: string, version?: string, optional?: boolean) => void;
}

function init(context: IExtensionContextLite): boolean {
  // 1) reducer 必须最先注册：后续所有注册都可能在初始化完成后立刻读 state
  //    ["session", ...] = 不持久化，符合官方对临时 UI 状态的约定
  context.registerReducer(["session", "nexusBrowser"], reducerSpec);

  //    持久化偏好：用户声明"已手动安装"的前置（Vortex 重启后仍然保留）
  context.registerReducer(["persistent", "nexusBrowserPrefs"], prefsReducerSpec);

  // 2) 主页面
  context.registerMainPage("search", PAGE_TITLE, BrowseModsPage, {
    id: EXTENSION_ID,
    // per-game：只在激活了游戏时出现在左侧导航（本插件必须知道"当前是哪个游戏"）
    group: "per-game",
    priority: 25,
    // 新 UI 用 mdi 路径（宿主的 Menu 组件：iconPath={page.mdi ?? getIconPath(page.icon)}）；
    // 旧 UI / 兜底仍用内置图标名 "search"
    mdi: MIRRORED_SEARCH_ICON,
    hotkey: "B",
    visible: () => {
      // 防御：store 尚未就绪时不要显示
      const state = context.api?.store?.getState?.();
      if (state === undefined) {
        return false;
      }
      const profileId = state?.settings?.profiles?.activeProfileId;
      return profileId !== undefined;
    },
    props: () => ({ api: context.api }),
  });

  // 3) 一次性初始化：这里才可以安全地读 state / 发事件
  context.once(() => {
    // 目前没有需要在启动时做的事。
    // 预留给后续版本：例如检查插件更新、预热游戏域名缓存。
  });

  return true;
}

export default init;
