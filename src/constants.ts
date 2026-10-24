/**
 * 全局常量
 * ---------------------------------------------------------------------------
 * 所有对外部世界的"契约"（URL、分页、缓存时长、action 名称）都集中在这里，
 * 改动时只需要动这一个文件。
 */

import type { MessageKey } from "./i18n";

/** Nexus Mods GraphQL v2 端点（必须是 POST，GET 会 404） */
export const GRAPHQL_ENDPOINT = "https://api.nexusmods.com/v2/graphql";

/** Nexus Mods 站点根地址，用于拼「在网站上打开」链接 */
export const NEXUS_BASE_URL = "https://www.nexusmods.com";

/** 扩展 id（与 info.json 的 id 保持一致） */
export const EXTENSION_ID = "nexus-mod-browser";

/** 主页面标题 / 导航栏文字（与官方 "Browse Nexus Mods" 区分开，避免两个同名入口） */
export const PAGE_TITLE = "Nexus Mod Browser";

/**
 * 导航图标：把官方的搜索图标（mdiMagnify）水平镜像（x → 24 - x）。
 * 这样视觉上"和官方那个搜索图标是一家"，但又能区分开。
 * 路径已经固化成常量，运行时不依赖任何图标库；需要调整时直接改下面的 path。
 */
export const MIRRORED_SEARCH_ICON =
  "M14.5 3A6.5 6.5 0 0 0 8 9.5C8 11.11 8.59 12.59 9.56 13.73L9.29 14H8.5L3.5 19L5 20.5L10 15.5V14.71L10.27 14.44C11.41 15.41 12.89 16 14.5 16A6.5 6.5 0 0 0 21 9.5A6.5 6.5 0 0 0 14.5 3M14.5 5C17 5 19 7 19 9.5C19 12 17 14 14.5 14C12 14 10 12 10 9.5C10 7 12 5 14.5 5Z";

/** 每页条数。GraphQL 的 count 建议 <= 50 */
export const DEFAULT_PAGE_SIZE = 24;

/** 搜索结果 / 详情缓存时间 */
export const CACHE_TTL_MS = 5 * 60 * 1000;

/** 前置清单缓存时间（前置很少变，30 分钟足够；避免每次点下载都查一次） */
export const REQUIREMENTS_CACHE_TTL_MS = 30 * 60 * 1000;

/** 前置清单最多显示多少行（服务端一次取 50，正常用不到截断） */
export const REQUIREMENTS_MAX_ROWS = 50;

/**
 * 下载前查前置的最长等待时间。
 * 超过就当作"查不到"直接继续下载——前置检查是 best-effort，不能因为网络慢卡住主流程。
 */
export const REQUIREMENTS_PROMPT_TIMEOUT_MS = 6000;

/** 游戏列表缓存时间（游戏表变化很慢，一天足够） */
export const GAME_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/** 单次 HTTP 请求超时 */
export const REQUEST_TIMEOUT_MS = 20000;

/** Redux action 名称（纯字符串，不依赖 redux-act） */
export const ACTIONS = {
  SET_QUERY: "NEXUS_BROWSER_SET_QUERY",
  SET_SORT: "NEXUS_BROWSER_SET_SORT",
  SET_PAGE: "NEXUS_BROWSER_SET_PAGE",
  LOAD_START: "NEXUS_BROWSER_LOAD_START",
  LOAD_SUCCESS: "NEXUS_BROWSER_LOAD_SUCCESS",
  LOAD_ERROR: "NEXUS_BROWSER_LOAD_ERROR",
  SET_GAME: "NEXUS_BROWSER_SET_GAME",
  SELECT_MOD: "NEXUS_BROWSER_SELECT_MOD",
  CLOSE_DETAIL: "NEXUS_BROWSER_CLOSE_DETAIL",
  SET_DETAIL: "NEXUS_BROWSER_SET_DETAIL",
  SET_DETAIL_ERROR: "NEXUS_BROWSER_SET_DETAIL_ERROR",
};

/**
 * 排序选项：field 直接对应 GraphQL 的 ModsSort 字段。
 * labelKey 指向 i18n 字典；中文 / 英文 / 日文不再拼在一起，由当前语言决定显示哪一个。
 */
export const SORT_OPTIONS: Array<{ id: string; labelKey: MessageKey; field: string }> = [
  { id: "relevance", labelKey: "sort.relevance", field: "relevance" },
  { id: "endorsements", labelKey: "sort.endorsements", field: "endorsements" },
  { id: "downloads", labelKey: "sort.downloads", field: "downloads" },
  { id: "updatedAt", labelKey: "sort.updatedAt", field: "updatedAt" },
  { id: "createdAt", labelKey: "sort.createdAt", field: "createdAt" },
];
