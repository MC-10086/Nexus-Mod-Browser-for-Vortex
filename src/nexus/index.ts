/**
 * Nexus 服务的单例入口
 * ---------------------------------------------------------------------------
 * 为什么要单例：缓存和"请求去重"必须跨页面挂载/卸载存活，
 * 否则每次切回浏览页都会重新打一遍 API（既慢又浪费配额）。
 */

import { nexusApiKey } from "../util/game";
import { NexusService } from "./service";

let singleton: NexusService | undefined;

/**
 * @param api Vortex 的 IExtensionApi。只有第一次调用时会被用来构造 Key 读取函数，
 *            之后每次请求都会重新 `api.getState()`，所以用户中途登录也能生效。
 */
export function getNexusService(api: any): NexusService {
  if (singleton === undefined) {
    singleton = new NexusService(() => nexusApiKey(api.getState()));
  }
  return singleton;
}

/** 清空缓存（切换游戏 / 用户点刷新时用） */
export function resetNexusService(api: any): void {
  getNexusService(api).clear();
}

export { NexusService };
