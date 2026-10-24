/**
 * 游戏上下文工具
 * ---------------------------------------------------------------------------
 * 目标：在**不 import `@nexusmods/vortex-api` 运行时**的前提下，
 * 复刻 Vortex 官方的 3 个选择器（源码位置见注释）。
 *
 * 为什么不能直接 import：
 *   `@nexusmods/vortex-api` 是**纯类型包**（runtime 只有类型，没有实现），
 *   扩展在运行时 `require('vortex-api')` 会直接抛 MODULE_NOT_FOUND。
 *   官方内置扩展之所以能用 util/selectors，是因为它们被编进了主 bundle，
 *   第三方扩展没有这个待遇 —— 所以这里按官方源码的实现逻辑自行复刻。
 *
 * 复刻来源（Vortex 2.8.2）：
 *   activeGameId   → src/extensions/profile_management/selectors.ts:11
 *   knownGames     → src/extensions/gamemode_management/selectors.ts:11
 *   nexusGameId    → src/extensions/nexus_integration/util/convertGameId.ts:22
 *   apiKey/isPremium → src/extensions/nexus_integration/selectors.ts:11/25
 */

/** Vortex 内部游戏记录（只声明我们要用的字段；不导出，外部只通过函数访问） */
interface IGameStoredLite {
  id: string;
  name?: string;
  details?: {
    nexusPageId?: string;
    steamAppId?: number;
    [key: string]: any;
  };
  [key: string]: any;
}

/** 当前激活的游戏内部 id（如 "skyrimse"），没有激活游戏时返回 undefined */
export function activeGameId(state: any): string | undefined {
  const profileId = state?.settings?.profiles?.activeProfileId;
  if (profileId === undefined) {
    return undefined;
  }
  const profile = state?.persistent?.profiles?.[profileId];
  return profile?.gameId;
}

/** 已注册的全部游戏（数组；内部 helper） */
function knownGames(state: any): IGameStoredLite[] {
  return state?.session?.gameMode?.known ?? [];
}

/** 按内部 id 查找游戏记录（内部 helper） */
function gameById(state: any, gameId: string): IGameStoredLite | undefined {
  if (!gameId) {
    return undefined;
  }
  return knownGames(state).find((game) => game.id === gameId);
}

/**
 * 内部 game id 中少数与 Nexus 域名不一致的硬编码映射。
 * 与官方 convertGameId.ts 里的表保持完全一致。
 */
const SPECIAL_DOMAINS: { [gameId: string]: string } = {
  skyrimse: "skyrimspecialedition",
  skyrimvr: "skyrimspecialedition",
  falloutnv: "newvegas",
  fallout4vr: "fallout4",
  teso: "elderscrollsonline",
};

/**
 * 内部 game id → Nexus 域名（如 skyrimse → skyrimspecialedition）。
 * 优先使用游戏扩展声明的 `details.nexusPageId`，其次查硬编码表，最后小写原样返回。
 */
export function nexusDomain(state: any, gameId: string): string | undefined {
  if (!gameId) {
    return undefined;
  }
  const game = gameById(state, gameId);
  const pageId = game?.details?.nexusPageId;
  if (pageId !== undefined && pageId !== null && pageId !== "") {
    return pageId;
  }
  return SPECIAL_DOMAINS[gameId.toLowerCase()] ?? gameId.toLowerCase();
}

/** 游戏展示名（找不到时回退到 id） */
export function gameName(state: any, gameId: string): string {
  return gameById(state, gameId)?.name ?? gameId;
}

/** 用户的 Nexus API Key（未登录时为 undefined） */
export function nexusApiKey(state: any): string | undefined {
  return state?.confidential?.account?.nexus?.APIKey;
}

/** 是否 Premium（未加载完成时按 false 处理，仅用于 UI 提示，不用于功能门禁） */
export function isPremium(state: any): boolean {
  return state?.persistent?.nexus?.userInfo?.isPremium ?? false;
}
