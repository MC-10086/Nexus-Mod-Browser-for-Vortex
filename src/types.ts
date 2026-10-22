/**
 * 项目内部类型定义
 * ---------------------------------------------------------------------------
 * 这里只定义「我们真正消费的字段」，不试图复刻 Nexus 的完整 schema。
 * 所有字段都是从 GraphQL 实测返回里挑出来的（见方案文档 §5.2 字段映射表）。
 */

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
  files: IModFile[];
  /** 详情/文件是否在加载 */
  detailLoading: boolean;
  /** 下载并安装（false = 只下载） */
  autoInstall: boolean;
}

/** 规范化后的错误 */
export interface INexusError extends Error {
  code?: string;
  /** GraphQL 原始 errors 数组 */
  errors?: any[];
}
