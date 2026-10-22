/**
 * GraphQL 查询定义
 * ---------------------------------------------------------------------------
 * 全部照抄方案文档 §5.1 的 4 条查询，字段都是实测可用的。
 * 修改字段前请先看《NexusMods-GraphQL-API-完整参考.md》对应章节，
 * 尤其是：
 *   - `mod(modId, gameId)` 两个参数都必须传
 *   - `modFiles.sizeInBytes` 是 BigInt，JSON 里是字符串
 *   - 报错时 HTTP 仍是 200，必须检查 errors[]
 */

/** Q1 搜索列表（filter + sort + 分页） */
export const Q_SEARCH_MODS = `
query SearchMods($filter: ModsFilter, $sort: [ModsSort!], $offset: Int, $count: Int) {
  mods(filter: $filter, sort: $sort, offset: $offset, count: $count) {
    totalCount
    nodes {
      modId
      uid
      name
      summary
      category
      version
      author
      downloads
      endorsements
      adultContent
      createdAt
      updatedAt
      pictureUrl
      game { id domainName }
      uploader { name }
    }
  }
}`;

/** Q2 Mod 详情 */
export const Q_MOD_DETAIL = `
query ModDetail($modId: ID!, $gameId: ID!) {
  mod(modId: $modId, gameId: $gameId) {
    modId
    uid
    name
    summary
    description
    version
    author
    category
    downloads
    endorsements
    fileSize
    adultContent
    directDownloadEnabled
    supportsVortex
    createdAt
    updatedAt
    pictureUrl
    game { id domainName }
    uploader { name }
    viewerDownloaded
    viewerEndorsed
    viewerTracked
  }
}`;

/** Q3 文件列表 */
export const Q_MOD_FILES = `
query ModFiles($modId: ID!, $gameId: ID!) {
  modFiles(modId: $modId, gameId: $gameId) {
    fileId
    uid
    name
    version
    category
    primary
    size
    sizeInBytes
    uri
    date
  }
}`;

/** Q4 域名 → 游戏（用于校验「这个游戏在不在 Nexus 上」） */
export const Q_RESOLVE_GAME = `
query ResolveGame($domainName: String) {
  game(domainName: $domainName) {
    id
    name
    domainName
    modCount
    supportsVortex
  }
}`;

/**
 * 构造搜索变量。
 *
 * filter 是一棵布尔表达式树：
 *   - `gameDomainName` 精确匹配游戏
 *   - `nameStemmed + WILDCARD` 做词干模糊匹配（比 `name` 更宽容，不区分标点）
 *
 * 关键词为空时不加名称条件，等价于"按排序浏览该游戏"。
 */
export function buildSearchVariables(options: {
  domain: string;
  query: string;
  sortField: string;
  offset: number;
  count: number;
}) {
  const conditions: any[] = [
    { gameDomainName: [{ value: options.domain, op: "EQUALS" }] },
  ];

  const keyword = options.query.trim();
  if (keyword.length > 0) {
    conditions.push({ nameStemmed: [{ value: keyword, op: "WILDCARD" }] });
  }

  // relevance 只在有关键词时才有意义，否则 Nexus 会返回不稳定顺序
  const sortField = keyword.length === 0 && options.sortField === "relevance"
    ? "endorsements"
    : options.sortField;

  return {
    filter: { op: "AND", filter: conditions },
    sort: [{ [sortField]: { direction: "DESC" } }],
    offset: options.offset,
    count: options.count,
  };
}
