/**
 * 项目内部类型定义
 * ---------------------------------------------------------------------------
 * 这里只定义「我们真正消费的字段」，不试图复刻 Nexus 的完整 schema。
 * 所有字段都是从 GraphQL 实测返回里挑出来的（见方案文档 §5.2 字段映射表）。
 */

import type { Language } from "./i18n";

/** 搜索列表里的一行（对应 GraphQL `ModsResult.nodes`） */
export interface IModSummary {
  modId: number;
  uid: string;
  name: string;
  summary?: string;
  /** 分类名（如 "Utilities"），卡片上分类那一行的来源 */
  category?: string;
  version?: string;
  author?: string;
  downloads?: number;
  endorsements?: number;
  adultContent?: boolean;
  createdAt?: string;
  updatedAt?: string;
  pictureUrl?: string;
  /** 大缩略图；主图缺失时作为第一候选（详情查询有，列表查询没查） */
  thumbnailLargeUrl?: string;
  /** 小缩略图；主图和大缩略图都缺失时作为候选（详情查询有，列表查询没查） */
  thumbnailUrl?: string;
  game?: { domainName?: string; id?: string };
  uploader?: { name?: string };
}

/** 详情（对应 GraphQL `mod()`） */
export interface IModDetail extends IModSummary {
  description?: string;
  category?: string;
  fileSize?: number;
  directDownloadEnabled?: boolean;
  supportsVortex?: boolean;
  viewerDownloaded?: boolean;
  viewerEndorsed?: boolean;
  viewerTracked?: boolean;
}

/** 文件（对应 GraphQL `modFiles()`） */
export interface IModFile {
  fileId: number;
  uid: string;
  name: string;
  version?: string;
  /** MAIN=1 / UPDATE=2 / OPTIONAL=3 / OLD_VERSION=4 …（可能是数字或枚举名） */
  category?: number | string;
  /** 1 = 主文件标记 */
  primary?: number;
  size?: number;
  /** BigInt，JSON 里是字符串 */
  sizeInBytes?: string;
  uri?: string;
  date?: number;
  description?: string;
}

/** 一条 Nexus 前置（对应 GraphQL `ModRequirement`） */
interface IModRequirement {
  /** 前置所属游戏的**数字** id（如 "1704"），用来判断是不是同一个游戏 */
  gameId?: string;
  /** 前置的 Nexus mod id（字符串；站外组件是 "0"） */
  modId: string;
  modName: string;
  /** 作者备注（版本要求等常常写在这里） */
  notes?: string;
  url?: string;
  externalRequirement?: boolean;
}

/** 一条 DLC 前置（无法检测，只提示） */
interface IModDlcRequirement {
  notes?: string;
  gameExpansion?: { id?: string; name?: string };
}

/** `modRequirements()` 的返回值（已裁成插件好用的形状） */
export interface IModRequirementsInfo {
  /** 当前游戏在 Nexus 的数字 id（字符串形式） */
  gameNumericId: string;
  /** true = 作者用的是旧版"mod 级依赖"模型 */
  legacyModRequirementsEnabled?: boolean;
  nexus: IModRequirement[];
  dlc: IModDlcRequirement[];
  /** 服务端总数（超过 50 时说明被截断） */
  totalCount: number;
}

/** 一次搜索的查询参数 */
export interface ISearchOptions {
  /** Nexus 游戏域名，如 skyrimspecialedition */
  domain: string;
  /** 关键词，空字符串表示"浏览"（按排序取热门） */
  query: string;
  /** ModsSort 字段名 */
  sortField: string;
  /** 0-based */
  offset: number;
  count: number;
}

/** 搜索结果 */
export interface ISearchResult {
  totalCount: number;
  nodes: IModSummary[];
}

/** 插件自己的 state 切片（session.nexusBrowser） */
export interface INexusBrowserState {
  /** 当前结果对应的游戏域名；切换游戏时用于判断是否需要重查 */
  domain?: string;
  query: string;
  sort: string;
  page: number;
  totalCount: number;
  results: IModSummary[];
  loading: boolean;
  error?: { code?: string; message: string };
  selectedModId?: number;
  detail?: IModDetail;
  /** 详情加载失败的文案（成功或关闭时清空） */
  detailError?: string;
  /** 详情是否在加载 */
  detailLoading: boolean;
}

/** 规范化后的错误 */
export interface INexusError extends Error {
  code?: string;
  /** GraphQL 原始 errors 数组 */
  errors?: any[];
}

/**
 * 持久化偏好（persistent.nexusBrowserPrefs）
 * 只放"需要跨重启保留"的小数据：
 *   - 用户手动标记过的前置（按游戏域名分组）
 *   - 插件 UI 语言（只由用户在页头下拉框修改）
 */
export interface INexusBrowserPrefs {
  /** 游戏域名 → 已手动安装的前置 Nexus mod id 列表 */
  manualRequirements: { [domain: string]: number[] };
  /** 插件 UI 语言（只由用户在页头下拉框里修改，不跟随宿主） */
  language: Language;
}

