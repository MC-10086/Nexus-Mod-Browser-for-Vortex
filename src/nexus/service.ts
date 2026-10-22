/**
 * Nexus 业务服务层
 * ---------------------------------------------------------------------------
 * 职责：
 *   1. 把 domain 解析成 Nexus 数字 gameId（带 24h 缓存）
 *   2. 对 4 条查询做统一封装，返回插件内部类型
 *   3. 内存缓存（TTL）+ 并发请求去重（同一 key 同时只发一次）
 *   4. 把 GraphQL 的原始结构（nodes / totalCount）裁成 UI 需要的形状
 *
 * 这一层是唯一知道"Nexus 怎么查"的地方；UI 只调方法，不碰 GraphQL。
 */

import {
  CACHE_TTL_MS,
  GAME_CACHE_TTL_MS,
} from "../constants";
import {
  IModDetail,
  IModFile,
  IModSummary,
  ISearchOptions,
  ISearchResult,
} from "../types";
import { compareModFiles } from "../util/modFiles";
import { graphql } from "./client";
import {
  buildSearchVariables,
  Q_MOD_DETAIL,
  Q_MOD_FILES,
  Q_RESOLVE_GAME,
  Q_SEARCH_MODS,
} from "./queries";

/** 解析出来的游戏信息 */
export interface INexusGame {
  id: string;
  name: string;
  domainName: string;
  modCount?: number;
  supportsVortex?: boolean;
}

interface ICacheEntry {
  at: number;
  ttl: number;
  value: any;
}

export class NexusService {
  private cache = new Map<string, ICacheEntry>();
  private inflight = new Map<string, Promise<any>>();

  /**
   * @param getApiKey 每次请求时现取 Key（用户可能在运行中登录/登出）
   */
  constructor(private readonly getApiKey: () => string | undefined) {}

  /** 清空全部缓存（切换游戏或用户点刷新时调用） */
  public clear(): void {
    this.cache.clear();
    this.inflight.clear();
  }

  /**
   * 缓存 + 去重包装。
   * 同一 key 的并发调用共享同一个 Promise，避免用户狂点导致重复请求。
   */
  private load<T>(key: string, ttl: number, loader: () => Promise<T>): Promise<T> {
    const hit = this.cache.get(key);
    if (hit !== undefined && Date.now() - hit.at < hit.ttl) {
      return Promise.resolve(hit.value as T);
    }

    const running = this.inflight.get(key);
    if (running !== undefined) {
      return running as Promise<T>;
    }

    const promise = loader()
      .then((value) => {
        this.cache.set(key, { at: Date.now(), ttl, value });
        return value;
      })
      .finally(() => {
        this.inflight.delete(key);
      });

    this.inflight.set(key, promise);
    return promise;
  }

  /**
   * 域名 → Nexus 游戏信息。
   * 返回 undefined 表示这个游戏在 Nexus 上没有页面（例如自建游戏扩展）。
   */
  public resolveGame(domain: string): Promise<INexusGame | undefined> {
    return this.load<INexusGame | undefined>(
      `game:${domain}`,
      GAME_CACHE_TTL_MS,
      async () => {
        const data = await graphql<{ game: INexusGame | null }>(
          Q_RESOLVE_GAME,
          { domainName: domain },
          this.getApiKey(),
        );
        return data?.game ?? undefined;
      },
    );
  }

  /**
   * 搜索 / 浏览。
   * @param options 见 ISearchOptions；query 为空表示"按排序浏览"
   */
  public search(options: ISearchOptions): Promise<ISearchResult> {
    const variables = buildSearchVariables(options);
    const key = `search:${JSON.stringify(variables)}`;

    return this.load<ISearchResult>(key, CACHE_TTL_MS, async () => {
      const data = await graphql<{ mods: { totalCount: number; nodes: IModSummary[] } | null }>(
        Q_SEARCH_MODS,
        variables,
        this.getApiKey(),
      );

      const mods = data?.mods;
      if (mods === null || mods === undefined) {
        return { totalCount: 0, nodes: [] };
      }
      return {
        totalCount: mods.totalCount ?? 0,
        nodes: (mods.nodes ?? []).filter((node) => node !== null && node !== undefined),
      };
    });
  }

  /** Mod 详情。需要先解析出数字 gameId，所以内部会 await resolveGame */
  public async modDetail(domain: string, modId: number): Promise<IModDetail> {
    const game = await this.resolveGame(domain);
    if (game === undefined) {
      throw new Error(`游戏 "${domain}" 在 Nexus Mods 上没有对应页面。`);
    }

    return this.load<IModDetail>(`mod:${game.id}:${modId}`, CACHE_TTL_MS, async () => {
      const data = await graphql<{ mod: IModDetail | null }>(
        Q_MOD_DETAIL,
        { modId: String(modId), gameId: String(game.id) },
        this.getApiKey(),
      );
      if (data?.mod === null || data?.mod === undefined) {
        throw new Error(`找不到 Mod ${modId}（可能已删除或隐藏）。`);
      }
      return data.mod;
    });
  }

  /** 文件列表，按「主文件优先、日期倒序」排序 */
  public async modFiles(domain: string, modId: number): Promise<IModFile[]> {
    const game = await this.resolveGame(domain);
    if (game === undefined) {
      throw new Error(`游戏 "${domain}" 在 Nexus Mods 上没有对应页面。`);
    }

    const files = await this.load<IModFile[]>(
      `files:${game.id}:${modId}`,
      CACHE_TTL_MS,
      async () => {
        const data = await graphql<{ modFiles: IModFile[] | null }>(
          Q_MOD_FILES,
          { modId: String(modId), gameId: String(game.id) },
          this.getApiKey(),
        );
        return (data?.modFiles ?? []).filter((file) => file !== null && file !== undefined);
      },
    );

    return files.slice().sort(compareModFiles);
  }
}
