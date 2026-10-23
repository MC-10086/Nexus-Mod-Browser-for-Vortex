/**
 * 浏览页（已接入真实数据）
 * ---------------------------------------------------------------------------
 * 数据流：
 *   组件 → dispatch(action) → session.nexusBrowser → store.subscribe → 重渲染
 *   组件 → NexusService（缓存/去重）→ GraphQL → dispatch(loadSuccess / loadError)
 *
 * 外观复用宿主：
 *   - 页面外壳 import { MainPage } from "@nexusmods/vortex-api"
 *   - 控件全部使用宿主 nxm-* 语义类（见 primitives.tsx）
 *
 * 约定：`slice.loading` 同时是"需要查询"的信号（任何改参数的动作都会置位），
 * 查询完成由 loadSuccess/loadError 清零，天然避免重复请求与 effect 死循环。
 */

import * as React from "react";

import { MainPage } from "@nexusmods/vortex-api";

import { downloadForUser } from "../bridge/download";
import { DEFAULT_PAGE_SIZE, SORT_OPTIONS } from "../constants";
import { describeError } from "../nexus/client";
import { getNexusService, resetNexusService } from "../nexus/index";
import { actions, nexusBrowserSlice } from "../state/reducer";
import { manualRequirementIds, prefsActions } from "../state/prefs";
import { IModDetail, IModSummary } from "../types";
import { activeGameId, gameName, isPremium, nexusDomain } from "../util/game";
import { installedNexusModIds, installedNexusMods } from "../util/mods";
import { gameModsUrl, modPageUrl, openExternal } from "../util/openExternal";
import {
  diffIgnoredMarks,
  IRequirementRow,
} from "../util/requirements";
import ModDetailDialog from "./ModDetailDialog";
import ModTile from "./ModTile";
import RequirementsDialog, {
  IRequirementsDecision,
  IRequirementsDialogData,
} from "./RequirementsDialog";
import { chooseModFile } from "./chooseFile";
import { notify } from "./notify";
import {
  buildRequirementsPromptData,
  isFreeAccount,
  notifyRequirementSummary,
  startRequirementDownload,
  startSelectedRequirementDownloads,
} from "./requirementsPrompt";
import { Button, Pagination, SortMenu, TabBar, TabButton } from "./primitives";

export interface IBrowseModsPageProps {
  api: any;
}

interface IRequirementDetailState {
  row: IRequirementRow;
  detail?: IModDetail;
  error?: string;
  loading: boolean;
}

export default function BrowseModsPage(props: IBrowseModsPageProps) {
  const { api } = props;

  const sliceRef = React.useRef(nexusBrowserSlice(api.getState()));
  const [, forceRender] = React.useState(0);
  const [draft, setDraft] = React.useState(sliceRef.current.query);
  /** 已经在等待下载开始的 mod（**只用于 Premium**，防止重复 emit） */
  const pendingRef = React.useRef<number[]>([]);
  /**
   * 免费账号的"本次等待"标记。用户可能关掉网页后想再点一次 Download，
   * 所以这里**不阻止**重复点击：新的一次点击会把上一次标记为作废，
   * 上一次的等待随即停止（不再弹提示、不再安装）。
   */
  const attemptRef = React.useRef<{ [modId: number]: { canceled: boolean } }>({});
  /** 下载**真的开始**之后才放进来（按钮切成 Downloading…） */
  const [busyMods, setBusyMods] = React.useState<number[]>([]);
  const scrollRef = React.useRef<any>(undefined);
  /**
   * 前置弹窗：undefined = 不显示。
   * 用 Promise 桥接，让 handleDownload 保持线性流程（弹窗选择 → 继续原来的下载）。
   */
  const [requirements, setRequirements] = React.useState<IRequirementsDialogData | undefined>(
    undefined,
  );
  const requirementsResolveRef = React.useRef<
    ((decision: IRequirementsDecision) => void) | undefined
  >(undefined);
  /**
   * 正在查前置/等用户在弹窗里做选择的 MOD。
   * 防止免费账号在弹窗还没出来时重复点 Download，把 Promise 桥接覆盖掉。
   */
  const requirementsInFlightRef = React.useRef<number[]>([]);
  /** 前置的详情弹窗（叠加在前置弹窗之上） */
  const [requirementDetail, setRequirementDetail] = React.useState<
    IRequirementDetailState | undefined
  >(undefined);

  // 订阅 store：只有我们的切片引用变了才重渲染
  React.useEffect(() => {
    const unsubscribe = api.store.subscribe(() => {
      const next = nexusBrowserSlice(api.getState());
      if (next !== sliceRef.current) {
        sliceRef.current = next;
        forceRender((value) => value + 1);
      }
    });
    return unsubscribe;
  }, [api]);

  // 页面卸载时如果前置弹窗还开着，按取消收尾，避免 handleDownload 永远挂着
  React.useEffect(() => {
    return () => {
      const resolve = requirementsResolveRef.current;
      requirementsResolveRef.current = undefined;
      resolve?.({ kind: "cancel", selected: [], ignored: [] });
    };
  }, []);

  const slice = sliceRef.current;
  const state = api.getState();
  const gameId = activeGameId(state);
  const domain = nexusDomain(state, gameId);
  /** 已安装的 Nexus mod id（按 Vortex 自己的 attributes.modId 判定，不靠名字） */
  const installedIds = installedNexusModIds(state, gameId);

  // 切换游戏 → 重置该游戏的浏览状态
  React.useEffect(() => {
    if (domain === undefined) {
      return;
    }
    if (slice.domain !== domain) {
      api.store.dispatch(actions.setGame(domain));
    }
  }, [domain, slice.domain, api]);

  // 搜索
  React.useEffect(() => {
    if (!slice.loading || slice.domain === undefined) {
      return;
    }
    const targetDomain = slice.domain;
    let cancelled = false;

    getNexusService(api)
      .search({
        domain: targetDomain,
        query: slice.query,
        sortField: slice.sort,
        offset: slice.page * DEFAULT_PAGE_SIZE,
        count: DEFAULT_PAGE_SIZE,
      })
      .then((result) => {
        if (!cancelled) {
          api.store.dispatch(actions.loadSuccess(targetDomain, result.nodes, result.totalCount));
        }
      })
      .catch((err) => {
        if (!cancelled) {
          api.store.dispatch(actions.loadError(describeError(err), err?.code));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [slice.loading, slice.domain, slice.query, slice.sort, slice.page, api]);

  // 详情：选中 mod 后拉一次详情（命中 NexusService 的 5 分钟缓存，重开不再发请求）
  React.useEffect(() => {
    if (slice.selectedModId === undefined || !slice.detailLoading) {
      return;
    }
    if (slice.domain === undefined) {
      return;
    }

    const modId = slice.selectedModId;
    const targetDomain = slice.domain;
    let cancelled = false;

    getNexusService(api)
      .modDetail(targetDomain, modId)
      .then((detail) => {
        if (!cancelled) {
          api.store.dispatch(actions.setDetail(detail));
        }
      })
      .catch((err) => {
        if (!cancelled) {
          api.store.dispatch(actions.setDetailError(describeError(err)));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [slice.selectedModId, slice.detailLoading, slice.domain, api]);

  const totalPages = Math.max(1, Math.ceil(slice.totalCount / DEFAULT_PAGE_SIZE));

  // 翻页后回到顶部（与官方 Page 的行为一致）
  React.useEffect(() => {
    if (scrollRef.current !== null && scrollRef.current !== undefined) {
      scrollRef.current.scrollTo?.({ top: 0 });
    }
  }, [slice.page]);

  const submitSearch = (evt: any) => {
    evt?.preventDefault?.();
    api.store.dispatch(actions.setQuery(draft.trim()));
  };

  const handleRefresh = () => {
    resetNexusService(api);
    // 重置页码以触发查询（即使参数没变，setPage 也会把 loading 置位）
    api.store.dispatch(actions.setPage(slice.page));
  };

  /**
   * 打开详情弹窗（唯一入口）。
   * 特意做成一个独立函数：以后要换触发方式（点封面 / 双击 / 右键菜单），
   * 只改调用处，弹窗组件和状态层都不用动。
   */
  const openDetail = (mod: IModSummary) => {
    api.store.dispatch(actions.selectMod(mod.modId));
  };

  /** 详情加载失败后重试：重新 SELECT_MOD 会把 detailLoading 置位，effect 自动重跑 */
  const retryDetail = () => {
    if (slice.selectedModId !== undefined) {
      api.store.dispatch(actions.selectMod(slice.selectedModId));
    }
  };

  // ---------------------------------------------------------------------------
  // 前置弹窗：Promise 桥接 + 单行动作
  // ---------------------------------------------------------------------------

  const askRequirements = (data: IRequirementsDialogData): Promise<IRequirementsDecision> => {
    return new Promise<IRequirementsDecision>((resolve) => {
      requirementsResolveRef.current = resolve;
      setRequirements(data);
    });
  };

  const finishRequirements = (decision: IRequirementsDecision) => {
    const resolve = requirementsResolveRef.current;
    requirementsResolveRef.current = undefined;
    setRequirements(undefined);
    setRequirementDetail(undefined);
    resolve?.(decision);
  };

  // ---------------------------------------------------------------------------
  // 前置详情：叠加在地前置弹窗之上，复用详情弹窗组件
  // ---------------------------------------------------------------------------

  const openRequirementDetail = (row: IRequirementRow) => {
    const current = api.getState();
    const internalGameId = activeGameId(current);
    const currentDomain = nexusDomain(current, internalGameId);

    if (currentDomain === undefined || row.modId <= 0) {
      return;
    }

    setRequirementDetail({ row, loading: true });

    getNexusService(api)
      .modDetail(currentDomain, row.modId)
      .then((detail) => {
        setRequirementDetail((prev) =>
          prev !== undefined && prev.row.modId === row.modId
            ? { row, detail, loading: false }
            : prev,
        );
      })
      .catch((err) => {
        setRequirementDetail((prev) =>
          prev !== undefined && prev.row.modId === row.modId
            ? { row, error: describeError(err), loading: false }
            : prev,
        );
      });
  };

  const retryRequirementDetail = () => {
    if (requirementDetail !== undefined) {
      openRequirementDetail(requirementDetail.row);
    }
  };

  /** 弹窗里某一行的 Download：立刻开始，不等主 MOD 流程 */
  const handleRequirementDownloadOne = async (row: IRequirementRow): Promise<boolean> => {
    const current = api.getState();
    const internalGameId = activeGameId(current);
    const currentDomain = nexusDomain(current, internalGameId);

    if (currentDomain === undefined || internalGameId === undefined) {
      return false;
    }

    // 用户手动标记过，但现在主动点 Download → 撤销标记，重新走插件下载
    if (row.kind === "manual") {
      api.store.dispatch(prefsActions.unmarkManualRequirement(currentDomain, row.modId));
    }

    return startRequirementDownload(api, { domain: currentDomain, internalGameId }, row);
  };

  const handleRequirementViewPage = (row: IRequirementRow) => {
    if (row.url !== undefined) {
      openExternal(row.url);
    }
  };

  const handleDownload = async (mod: IModSummary) => {
    const current = api.getState();
    const internalGameId = activeGameId(current);
    const currentDomain = nexusDomain(current, internalGameId);

    if (currentDomain === undefined || internalGameId === undefined) {
      notify(api, "error", "无法下载：没有激活的游戏。");
      return;
    }

    // 前置查询/弹窗进行中：同一 MOD 不允许再开一条流程（会覆盖 Promise 桥接）
    if (requirementsInFlightRef.current.indexOf(mod.modId) !== -1) {
      return;
    }

    const premium = isPremium(current);
    const freeAccount = isFreeAccount(current);

    // Premium 走宿主 API，重复 emit 会排两次队，所以这里仍然防重。
    // 免费账号走浏览器：重复点击只是再打开一次页面，必须允许（用户常常关掉网页重来）。
    let attempt: { canceled: boolean } | undefined;
    if (premium) {
      if (pendingRef.current.indexOf(mod.modId) !== -1) {
        return;
      }
      pendingRef.current = pendingRef.current.concat([mod.modId]);
    } else {
      const previous = attemptRef.current[mod.modId];
      if (previous !== undefined) {
        previous.canceled = true; // 作废上一次等待
      }
      attempt = { canceled: false };
      attemptRef.current[mod.modId] = attempt;
    }

    try {
      // ---- 前置检查（best-effort）----------------------------------------
      // 查询失败 / 超时 / 限流一律返回 undefined → 不弹窗，直接走原来的下载流程。
      let requirementsToDownload: IRequirementRow[] = [];
      requirementsInFlightRef.current = requirementsInFlightRef.current.concat([mod.modId]);
      try {
        const promptData = await buildRequirementsPromptData(api, {
          domain: currentDomain,
          internalGameId,
          modId: mod.modId,
          modName: mod.name,
          installed: installedNexusMods(current, internalGameId),
          manual: manualRequirementIds(current, currentDomain),
          freeAccount,
        });

        if (promptData !== undefined) {
          const decision = await askRequirements(promptData);

          if (decision.kind === "cancel") {
            return;
          }

          // "不再提醒"是显式勾选：不管是 Download 还是 Skip，都按最终状态持久化差集
          const originalIgnored = promptData.rows
            .filter((row) => row.kind === "manual")
            .map((row) => row.modId);
          const { mark, unmark } = diffIgnoredMarks(originalIgnored, decision.ignored);
          for (const id of mark) {
            api.store.dispatch(prefsActions.markManualRequirement(currentDomain, id));
          }
          for (const id of unmark) {
            api.store.dispatch(prefsActions.unmarkManualRequirement(currentDomain, id));
          }

          if (decision.kind === "download") {
            const wanted = new Set(decision.selected);
            requirementsToDownload = promptData.rows.filter(
              (row) =>
                (row.kind === "missing" || row.kind === "manual") &&
                wanted.has(row.modId),
            );
          }
          // kind === "skip"：不下载前置，但"不再提醒"的勾选照常生效
        }
      } finally {
        requirementsInFlightRef.current = requirementsInFlightRef.current.filter(
          (id) => id !== mod.modId,
        );
      }

      const files = await getNexusService(api).modFiles(currentDomain, mod.modId);
      if (files.length === 0) {
        notify(api, "error", "无法下载：该 MOD 没有可下载的文件。");
        return;
      }

      // 只认 MAIN 文件；有多个 MAIN 时弹原生对话框让用户选（见 ui/chooseFile.ts）
      const file = await chooseModFile(api, mod.name, files);
      if (file === undefined) {
        // 用户在选文件弹窗里点了取消 —— 什么都不做
        return;
      }

      // 主文件已选定 → 先把勾选的前置交给下载管道（后台，不阻塞主 MOD）
      if (requirementsToDownload.length > 0) {
        void startSelectedRequirementDownloads(
          api,
          { domain: currentDomain, internalGameId, freeAccount },
          requirementsToDownload,
        ).then((result) => notifyRequirementSummary(api, { freeAccount }, result));
      }

      const outcome = await downloadForUser(
        api,
        {
          domain: currentDomain,
          internalGameId,
          modId: mod.modId,
          fileId: file.fileId,
          fileName: file.name,
          autoInstall: slice.autoInstall,
        },
        {
          // 只有这里被调用，才说明下载真的开始了 → 按钮切成 Downloading…
          onStarted: () => {
            setBusyMods((prev) =>
              prev.indexOf(mod.modId) === -1 ? prev.concat([mod.modId]) : prev,
            );
          },
          // 被新的一次点击作废时，立刻停止等待
          cancel: attempt !== undefined ? () => attempt!.canceled : undefined,
        },
      );

      // 这次等待已被用户的新点击作废 → 静默退出
      if (attempt !== undefined && attempt.canceled) {
        return;
      }


      if (outcome.canceled === true) {
        // 用户明确取消了，给个轻量提示并让它自动消失，不打扰
        notify(api, "info", "已取消下载", 4000);
      } else if (outcome.alreadyDownloaded === true) {
        notify(api, "info", `已在下载列表中：${file.name}`, 4000);
      } else if (outcome.pending === true) {
        if (outcome.timedOut === true && !premium) {
          // 免费账号：没等到下载多半是网页关了/没点授权 —— 直接允许重来
          notify(api, "info", "没有检测到下载：如果网页已关闭，直接再点一次 Download 即可。", 5000);
        } else {
          notify(api, "info", "下载仍在进行，可在左侧「下载」页查看进度。", 5000);
        }
      } else if (outcome.downloadId !== undefined) {
        const installed = outcome.installedModId !== undefined;
        notify(
          api,
          installed ? "success" : "info",
          installed ? `已下载并安装：${mod.name}` : `已加入下载队列：${mod.name}`,
          5000,
        );
      }
    } catch (err) {
      notify(api, "error", `下载失败：${describeError(err as any)}`);
    } finally {
      pendingRef.current = pendingRef.current.filter((id) => id !== mod.modId);
      if (attempt !== undefined && attemptRef.current[mod.modId] === attempt) {
        delete attemptRef.current[mod.modId];
      }
      setBusyMods((prev) => prev.filter((id) => id !== mod.modId));
    }
  };

  // ---------------------------------------------------------------------------
  // 主体渲染
  // ---------------------------------------------------------------------------
  const renderBody = () => {
    if (domain === undefined) {
      return (
        <div className="py-16 text-center text-body-sm text-neutral-moderate">
          请先在 Games 页面激活一个游戏。
        </div>
      );
    }

    if (slice.loading) {
      return (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(26rem,1fr))] gap-4">
          {[0, 1, 2, 3, 4, 5].map((index) => (
            <div key={index} className="h-40 animate-pulse rounded-md bg-surface-mid" />
          ))}
        </div>
      );
    }

    if (slice.error !== undefined) {
      const needsLogin = slice.error.code === "UNAUTHORIZED";
      return (
        <div className="py-16 text-center">
          <p className="mb-3 text-body-sm text-danger-strong">{slice.error.message}</p>
          {needsLogin
            ? (
              <Button
                brand="primary"
                appearance="strong"
                onClick={() => {
                  // 调起 Vortex 自己的登录流程，登录成功后重试
                  Promise.resolve(api.ext?.ensureLoggedIn?.())
                    .then(() => {
                      resetNexusService(api);
                      api.store.dispatch(actions.setPage(slice.page));
                    })
                    .catch(() => undefined);
                }}
              >
                Log in
              </Button>
            )
            : (
              <Button brand="neutral" appearance="moderate" onClick={handleRefresh} icon="refresh">
                重试
              </Button>
            )}
        </div>
      );
    }

    if (slice.results.length === 0) {
      return (
        <div className="py-16 text-center">
          <p className="mb-3 text-body-sm text-neutral-moderate">
            {slice.query.length > 0
              ? `没有找到与「${slice.query}」匹配的 MOD。`
              : "这个游戏暂时没有取到结果。"}
          </p>
          <Button
            brand="neutral"
            appearance="moderate"
            icon="openInNew"
            onClick={() => openExternal(gameModsUrl(domain))}
          >
            在网站上浏览
          </Button>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-[repeat(auto-fit,minmax(26rem,1fr))] gap-4">
        {slice.results.map((mod) => (
          <ModTile
            key={mod.modId}
            mod={mod}
            category={mod.category}
            installed={installedIds.indexOf(mod.modId) !== -1}
            busy={busyMods.indexOf(mod.modId) !== -1}
            // 鼠标移入即预热文件列表：第一次点下载就不用等这一趟网络
            onPrefetch={() => {
              if (domain !== undefined) {
                void getNexusService(api).modFiles(domain, mod.modId).catch(() => undefined);
              }
            }}
            onDownload={() => {
              if (busyMods.indexOf(mod.modId) === -1) {
                void handleDownload(mod);
              }
            }}
            onOpen={() => openExternal(modPageUrl(domain, mod.modId))}
            onViewPage={() => openExternal(modPageUrl(domain, mod.modId))}
            onDetails={() => openDetail(mod)}
          />
        ))}
      </div>
    );
  };

  return (
    <MainPage id="nexus-mod-browser-page">
      <MainPage.Body className="h-full overflow-y-auto pt-6" ref={scrollRef}>
        <TabBar className="overflow-clip pl-6">
          <TabButton name="模组" count={slice.totalCount} selected />
        </TabBar>

        <div className="space-y-3 p-6">
          <form className="flex items-center gap-x-2" onSubmit={submitSearch}>
            <div className="max-w-60 flex-1">
              <input
                className="nxm-input w-full"
                placeholder={domain === undefined ? "先激活一个游戏…" : `在 ${gameName(state, gameId)} 中搜索…`}
                aria-label="搜索 MOD"
                value={draft}
                disabled={domain === undefined}
                onChange={(evt: any) => setDraft(evt.target.value)}
              />
            </div>

            <Button
              type="submit"
              brand="neutral"
              appearance="moderate"
              icon="magnify"
              ariaLabel="搜索"
              title="搜索"
              disabled={domain === undefined}
            />
          </form>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-x-2">
              <Button
                brand="neutral"
                appearance="moderate"
                icon="refresh"
                ariaLabel="刷新"
                title="刷新"
                disabled={domain === undefined || slice.loading}
                onClick={handleRefresh}
              />
              <p className="text-body-sm text-translucent-moderate">{slice.totalCount} 个结果</p>
            </div>

            <SortMenu
              options={SORT_OPTIONS.map((option) => ({ id: option.id, label: option.label }))}
              value={slice.sort}
              onChange={(id) => api.store.dispatch(actions.setSort(id))}
            />
          </div>

          {renderBody()}

          {slice.totalCount > DEFAULT_PAGE_SIZE
            ? (
              <Pagination
                currentPage={slice.page + 1}
                totalPages={totalPages}
                onChange={(page) => api.store.dispatch(actions.setPage(page - 1))}
                className="pt-2"
              />
            )
            : null}
        </div>
      </MainPage.Body>

      {/* 详情弹窗：.nxm-modal 是 position:fixed，放在 Body 外面不会被滚动容器裁切 */}
      {slice.selectedModId !== undefined
        ? (
          <ModDetailDialog
            summary={slice.results.find((item) => item.modId === slice.selectedModId)}
            detail={slice.detail}
            error={slice.detailError}
            onClose={() => api.store.dispatch(actions.closeDetail())}
            onRetry={retryDetail}
          />
        )
        : null}

      {/* 前置弹窗：由 Download 流程通过 Promise 打开，关闭后才继续下载 */}
      {requirements !== undefined
        ? (
          <RequirementsDialog
            data={requirements}
            onDecision={finishRequirements}
            onDownloadOne={handleRequirementDownloadOne}
            onViewPage={handleRequirementViewPage}
            onDetails={openRequirementDetail}
            escDisabled={requirementDetail !== undefined}
          />
        )
        : null}

      {/* 前置详情：叠在前置弹窗之上；ESC 只关这一层 */}
      {requirementDetail !== undefined
        ? (
          <ModDetailDialog
            title={requirementDetail.row.name}
            detail={requirementDetail.detail}
            error={requirementDetail.error}
            onClose={() => setRequirementDetail(undefined)}
            onRetry={retryRequirementDetail}
          />
        )
        : null}
    </MainPage>
  );
}
