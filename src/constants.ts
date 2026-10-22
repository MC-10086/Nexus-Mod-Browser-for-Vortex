/**
 * 全局常量
 * ---------------------------------------------------------------------------
 * 所有对外部世界的"契约"（URL、分页、缓存时长、action 名称）都集中在这里，
 * 改动时只需要动这一个文件。
 */

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
 * 生成方式：`node mirror-path.js "<mdiMagnify path>"`（见开发记录），
 * 结果已固化在这里，运行时不依赖任何图标库。
 */
export const MIRRORED_SEARCH_ICON =
  "M14.5 3A6.5 6.5 0 0 0 8 9.5C8 11.11 8.59 12.59 9.56 13.73L9.29 14H8.5L3.5 19L5 20.5L10 15.5V14.71L10.27 14.44C11.41 15.41 12.89 16 14.5 16A6.5 6.5 0 0 0 21 9.5A6.5 6.5 0 0 0 14.5 3M14.5 5C17 5 19 7 19 9.5C19 12 17 14 14.5 14C12 14 10 12 10 9.5C10 7 12 5 14.5 5Z";

/** 每页条数。GraphQL 的 count 建议 <= 50 */
export const DEFAULT_PAGE_SIZE = 24;

/** 搜索输入防抖（毫秒） */
export const SEARCH_DEBOUNCE_MS = 350;

/** 搜索结果 / 详情缓存时间 */
export const CACHE_TTL_MS = 5 * 60 * 1000;

/** 游戏列表缓存时间（游戏表变化很慢，一天足够） */
export const GAME_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/** 单次 HTTP 请求超时 */
export const REQUEST_TIMEOUT_MS = 20000;

/** 插件自己的 state 分支：session.nexusBrowser（session = 不持久化） */
export const SLICE_KEY = "nexusBrowser";

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
  SET_FILES: "NEXUS_BROWSER_SET_FILES",
  SET_AUTO_INSTALL: "NEXUS_BROWSER_SET_AUTO_INSTALL",
  RESET: "NEXUS_BROWSER_RESET",
};

/**
 * 排序选项：field 直接对应 GraphQL 的 ModsSort 字段
 * 文案采用「English（中文）」格式，和 Nexus 站点的英文术语对齐，同时方便中文用户。
 */
export const SORT_OPTIONS: Array<{ id: string; label: string; field: string }> = [
  { id: "relevance", label: "Relevance（相关度）", field: "relevance" },
  { id: "endorsements", label: "Most Endorsed（点赞最多）", field: "endorsements" },
  { id: "downloads", label: "Most Downloaded（下载最多）", field: "downloads" },
  { id: "updatedAt", label: "Recently Updated（最近更新）", field: "updatedAt" },
  { id: "createdAt", label: "Recently Listed（最新发布）", field: "createdAt" },
];
