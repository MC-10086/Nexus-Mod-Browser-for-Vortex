/**
 * GraphQL 查询定义
 * ---------------------------------------------------------------------------
 * 每条查询只请求插件真正消费的字段，避免响应体膨胀。
 *
 * 改字段前必须用真实 API / introspection 验证，尤其注意：
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
    thumbnailLargeUrl
    thumbnailUrl
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
    description
  }
}`;

/**
 * Q3.5 前置（依赖）清单
 * ---------------------------------------------------------------------------
 * - `nexusRequirements(count: 50)`：N 网作者登记的必需 MOD。50 可以覆盖常见的前置列表，
 *   默认 10 会截断（例如补丁合集类 MOD）。
 * - `dlcRequirements`：需要的 DLC / 资料片，无法检测，只能提示。
 * - `legacyModRequirementsEnabled`：false = 新模型（文件级依赖），但公开 API 仍只暴露
 *   mod 级清单；**不要加 skipDisabledRequirements: true**，那会把 SkyUI 的 SKSE 过滤掉。
 */
export const Q_MOD_REQUIREMENTS = `
query ModRequirements($modId: ID!, $gameId: ID!) {
  mod(modId: $modId, gameId: $gameId) {
    modId
    legacyModRequirementsEnabled
    modRequirements {
      nexusRequirements(count: 50) {
        totalCount
        nodes {
          gameId
          modId
          modName
          notes
          url
          externalRequirement
        }
      }
      dlcRequirements {
        notes
        gameExpansion { id name }
      }
    }
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
