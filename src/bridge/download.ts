/**
 * 下载桥接层
 * ---------------------------------------------------------------------------
 * 两条路，按账号自动选择（入口：`downloadForUser`）：
 *
 *  A. **Premium** → `downloadModFile`
 *     emit `start-download`，宿主自己换签名直链、进队列，文件落盘后回调。
 *
 *  B. **免费账号** → `downloadViaBrowser`
 *     免费账号拿不到签名直链（API 会 403），Nexus 要求用户到网页上"授权"一次。
 *     宿主原本的做法是弹 `FreeUserDLDialog`（带「跳过模组」的那个框）让用户点一下再开浏览器。
 *     我们**跳过这个弹窗**：直接打开文件页（带 `nmm=1`），用户在网页点一次
 *     "Mod manager download"，带 key 的 nxm 链接回到 Vortex 就会新建一条下载记录；
 *     我们监听 store 里这条记录来推进 UI。
 *
 * 关键事实：`start-download` 的回调**只在文件落盘后**触发。
 * 所以两条路都靠"监听 store 里的下载记录"来得知『下载真的开始了』（`onStarted`）。
 *
 * 语义约定：
 *   - `onStarted` 只在下载真的开始时触发一次 → UI 把按钮切成 Downloading…
 *   - 下载记录 `finished` → 返回 downloadId（然后按需安装）
 *   - 记录 `failed` / 中途消失 → 返回 {} / {canceled:true}
 *   - 一直等不到下载开始 → 超时返回 {pending:true}
 *   - 一旦下载开始就不再计时（20 分钟的大文件也不会被打断）
 */

import { t } from "../i18n";
import { downloadRecordGame, isNexusModInstalled } from "../util/mods";
import { modFilePageUrl, openExternal } from "../util/openExternal";

/** 一次下载请求所需的全部信息 */
interface IDownloadRequest {
  /** Nexus 游戏域名，如 skyrimspecialedition */
  domain: string;
  /** Vortex 内部游戏 id，如 skyrimse（注意：不是域名） */
  internalGameId: string;
  modId: number;
  fileId: number;
  /** 文件名（可选，不传则由 Vortex 从响应头推断） */
  fileName?: string;
  /** 是否在下载完成后自动安装 */
  autoInstall: boolean;
}

interface IDownloadOutcome {
  /** Vortex 的下载 id（失败/取消时为 undefined） */
  downloadId?: string;
  /** 安装后的 mod id（未安装时为 undefined） */
  installedModId?: string;
  /** 用户主动取消 */
  canceled?: boolean;
  /** 该文件之前已经下载过 */
  alreadyDownloaded?: boolean;
  /** 超时：界面不再等待，但下载可能仍在后台进行 */
  pending?: boolean;
  /** 是否因为超时才返回 pending（页面据此给出"可以直接再点一次"的提示） */
  timedOut?: boolean;
}

interface IDownloadOptions {
  /** 下载**真正开始**时回调一次（UI 用它把按钮切成 Downloading…） */
  onStarted?: (downloadId?: string) => void;
  /**
   * 等待"下载开始"的上限。
   *   默认 2 分钟（两条路径一致；要留给用户登录 / 在网页点按钮）
   * 一旦下载真的开始，计时就失效。
   */
  startTimeoutMs?: number;
  /** 轮询间隔，默认 500ms（测试可调小） */
  pollIntervalMs?: number;
  /** 打开浏览器的实现（测试可注入；默认用系统浏览器） */
  openBrowser?: (url: string) => void;
  /**
   * 外部取消：每个轮询周期检查一次，返回 true 就立刻停下（不再等待、不再安装）。
   * 页面在用户重复点击 Download 时用它作废上一次等待。
   */
  cancel?: () => boolean;
}

/** 统一 2 分钟：Premium 与免费账号都一样（超过就放弃等待，按钮恢复） */
export const DEFAULT_START_TIMEOUT_MS = 2 * 60_000;
const DEFAULT_POLL_INTERVAL_MS = 500;

/** 构造 nxm 链接（内部 helper；Premium 路径的 emit 参数） */
function buildNxmUrl(domain: string, modId: number, fileId: number): string {
  return `nxm://${domain}/mods/${modId}/files/${fileId}`;
}

/** Vortex 的错误类型在运行时是 class，这里用 name 判断，避免 import 宿主模块 */
function isUserCanceled(err: any): boolean {
  return err?.name === "UserCanceled" || /usercanceled/i.test(String(err?.name ?? ""));
}

function isAlreadyDownloaded(err: any): boolean {
  return err?.name === "AlreadyDownloaded" || /alreadydownloaded/i.test(String(err?.name ?? ""));
}

function downloadFiles(api: any): Record<string, any> {
  try {
    return api.getState()?.persistent?.downloads?.files ?? {};
  } catch {
    return {};
  }
}

/** 同时兼容插件的顶层 ID 和宿主 nxm 下载的 nexus.ids。 */
function matchesDownload(record: any, request: IDownloadRequest): boolean {
  if (downloadRecordGame(record) !== request.internalGameId) {
    return false;
  }
  const info = record.modInfo;
  const matchesIds = (ids: any) =>
    Number(ids?.modId) === Number(request.modId) && Number(ids?.fileId) === Number(request.fileId);
  return matchesIds(info) || matchesIds(info?.nexus?.ids);
}

/** 授权弹窗队列里是否有这条链接（兼容 session.nexus.* 与旧结构） */
function isQueuedForAuth(api: any, nxmUrl: string): boolean {
  try {
    const state = api.getState();
    const queue: string[] =
      state?.session?.nexus?.freeUserDLQueue ?? state?.session?.freeUserDLQueue ?? [];
    return queue.indexOf(nxmUrl) !== -1;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// 下载完成后的安装
// ---------------------------------------------------------------------------

async function installDownloaded(
  api: any,
  request: IDownloadRequest,
  downloadId: string,
): Promise<string | undefined> {
  if (!request.autoInstall) {
    return undefined;
  }
  // 宿主可能已经按 automation 设置自动装过了，避免重复安装出一个副本
  try {
    if (isNexusModInstalled(api.getState(), request.internalGameId, request.modId)) {
      return undefined;
    }
  } catch {
    /* 读 store 失败就照常安装 */
  }
  return new Promise<string | undefined>((resolve) => {
    try {
      api.events.emit(
        "start-install-download",
        downloadId,
        { allowAutoEnable: true },
        (err: any, modId?: string) => {
          if (err !== null && err !== undefined) {
            if (!isUserCanceled(err)) {
              api.showErrorNotification?.(t("download.installFailed"), err);
            }
            resolve(undefined);
            return;
          }
          resolve(modId);
        },
      );
    } catch (err) {
      api.showErrorNotification?.(t("download.installFailed"), err);
      resolve(undefined);
    }
  });
}

// ---------------------------------------------------------------------------
// 共用：轮询 store 观察下载记录
// ---------------------------------------------------------------------------

interface IWatchOptions {
  api: any;
  request: IDownloadRequest;
  startTimeoutMs: number;
  pollIntervalMs: number;
  onStarted?: (downloadId?: string) => void;
  /** 授权弹窗队列（仅 emit 路径用） */
  nxmUrl?: string;
  /** 每个轮询周期检查一次：返回 true 就立刻停止等待（被新的点击作废） */
  cancel?: () => boolean;
  /**
   * 监听挂上之后执行的一次性动作（通知宿主或打开浏览器）。
   * 用 kickoff 而不是外面 Promise.race，是为了保证**只有一个**轮询定时器，
   * 谁先结束都在同一处 clearInterval（否则 race 的败者会泄漏 interval，进程不退出）。
   */
  kickoff?: (handlers: {
    onError: (err: any) => void;
    onDownloadId: (downloadId?: string) => void;
  }) => void;
}

type WatchResult = IDownloadOutcome;

function watchDownloadRecord(options: IWatchOptions): Promise<WatchResult> {
  const { api, request, startTimeoutMs, pollIntervalMs, onStarted, nxmUrl, kickoff, cancel } =
    options;

  return new Promise<WatchResult>((resolve) => {
    const startedAt = Date.now();
    let settled = false;
    let watchTimer: any;
    let watchedId: string | undefined;
    let sawQueueEntry = false;
    let reportedStart = false;
    // 旧失败记录不属于本次请求。同一个 ID 恢复下载后仍然可以认领。
    const previouslyFailed = new Set(Object.entries(downloadFiles(api))
      .filter(([, record]) => record?.state === "failed" && matchesDownload(record, request))
      .map(([id]) => id));

    const reportStarted = (downloadId?: string) => {
      if (!reportedStart) {
        reportedStart = true;
        try {
          onStarted?.(downloadId);
        } catch {
          /* UI 回调抛错不影响下载 */
        }
      }
    };

    const finish = (outcome: WatchResult) => {
      if (settled) {
        return;
      }
      settled = true;
      if (watchTimer !== undefined) {
        clearInterval(watchTimer);
        watchTimer = undefined;
      }
      resolve(outcome);
    };

    const isInactive = () => {
      if (settled) {
        return true;
      }
      if (cancel?.()) {
        finish({ canceled: true });
        return true;
      }
      return false;
    };

    watchTimer = setInterval(() => {
      if (isInactive()) {
        return;
      }

      let queued = false;
      if (nxmUrl !== undefined) {
        queued = isQueuedForAuth(api, nxmUrl);
        if (queued) {
          sawQueueEntry = true;
        }
      }

      const files = downloadFiles(api);
      if (watchedId === undefined) {
        let newlyFailed = false;
        for (const [id, record] of Object.entries(files)) {
          if (!matchesDownload(record, request)) {
            continue;
          }
          if (record.state !== "failed") {
            watchedId = id;
            break;
          }
          if (!previouslyFailed.has(id)) {
            newlyFailed = true;
          }
        }
        if (watchedId === undefined && newlyFailed) {
          finish({});
          return;
        }
      }

      if (watchedId !== undefined) {
        const record = files[watchedId];
        if (!matchesDownload(record, request)) {
          finish({ canceled: true });
        } else if (record.state === "failed") {
          finish({});
        } else {
          reportStarted(watchedId);
          if (record.state === "finished") {
            finish({ downloadId: watchedId });
          }
        }
        return;
      }

      if (sawQueueEntry && !queued) {
        finish({ canceled: true }); // 授权弹窗被关掉
        return;
      }

      // 还没等到下载开始 → 超时放弃等待（按钮恢复可点）
      if (Date.now() - startedAt > startTimeoutMs) {
        finish({ pending: true, timedOut: true });
      }
    }, pollIntervalMs);

    if (kickoff !== undefined) {
      try {
        kickoff({
          onError: (err: any) => {
            if (isInactive()) {
              return;
            }
            if (isUserCanceled(err)) {
              finish({ canceled: true });
              return;
            }
            if (isAlreadyDownloaded(err)) {
              finish({ alreadyDownloaded: true });
              return;
            }
            api.showErrorNotification?.(t("download.downloadFailed"), err);
            finish({});
          },
          onDownloadId: (downloadId?: string) => {
            if (isInactive()) {
              return;
            }
            const record = downloadId === undefined ? undefined : downloadFiles(api)[downloadId];
            const game = downloadRecordGame(record);
            if (game !== undefined && game !== request.internalGameId) {
              return;
            }
            reportStarted(downloadId);
            finish({ downloadId });
          },
        });
      } catch (err) {
        api.showErrorNotification?.(t("download.downloadFailed"), err);
        finish({});
      }
    }
  });
}

// ---------------------------------------------------------------------------
// A. 走宿主的 start-download（Premium 路径）
// ---------------------------------------------------------------------------

export function downloadModFile(
  api: any,
  request: IDownloadRequest,
  options?: IDownloadOptions,
): Promise<IDownloadOutcome> {
  const nxmUrl = buildNxmUrl(request.domain, request.modId, request.fileId);
  const startTimeoutMs = options?.startTimeoutMs ?? DEFAULT_START_TIMEOUT_MS;

  const modInfo = {
    // 必须用内部 game id：下载器按内部 id 决定落盘目录
    game: request.internalGameId,
    name: request.fileName,
    fileId: request.fileId,
    modId: request.modId,
  };

  // 监听先挂上，再 emit（kickoff），保证只有一个轮询定时器、结束即清理
  return watchDownloadRecord({
    api,
    request,
    startTimeoutMs,
    pollIntervalMs: options?.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS,
    onStarted: options?.onStarted,
    nxmUrl,
    cancel: options?.cancel,
    kickoff: (handlers) => {
      api.events.emit(
        "start-download",
        [nxmUrl],
        modInfo,
        undefined,
        (err: any, downloadId?: string) => {
          if (err !== null && err !== undefined) {
            handlers.onError(err);
            return;
          }
          handlers.onDownloadId(downloadId);
        },
        undefined,
        { allowInstall: false },
      );
    },
  }).then(async (outcome) => {
    if (outcome.downloadId === undefined) {
      return outcome;
    }
    const installedModId = await installDownloaded(api, request, outcome.downloadId);
    return { ...outcome, installedModId };
  });
}

// ---------------------------------------------------------------------------
// B. 直接开浏览器（免费账号路径，跳过宿主授权弹窗）
// ---------------------------------------------------------------------------

export function downloadViaBrowser(
  api: any,
  request: IDownloadRequest,
  options?: IDownloadOptions,
): Promise<IDownloadOutcome> {
  const startTimeoutMs = options?.startTimeoutMs ?? DEFAULT_START_TIMEOUT_MS;
  const openBrowser = options?.openBrowser ?? ((url: string) => openExternal(url));

  return watchDownloadRecord({
    api,
    request,
    startTimeoutMs,
    pollIntervalMs: options?.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS,
    onStarted: options?.onStarted,
    cancel: options?.cancel,
    kickoff: () => {
      // 网页上的 "Mod manager download" 会把带 key 的 nxm 链接交回 Vortex。
      try {
        openBrowser(modFilePageUrl(request.domain, request.modId, request.fileId));
      } catch {
        /* 打不开浏览器就靠超时收尾 */
      }
    },
  }).then(async (outcome) => {
    if (outcome.downloadId === undefined) {
      return outcome;
    }
    const installedModId = await installDownloaded(api, request, outcome.downloadId);
    return { ...outcome, installedModId };
  });
}

// ---------------------------------------------------------------------------
// 入口：按账号自动选路
// ---------------------------------------------------------------------------

/**
 * 免费账号走浏览器（跳过宿主授权弹窗），Premium 走宿主 API。
 */
export function downloadForUser(
  api: any,
  request: IDownloadRequest,
  options?: IDownloadOptions,
): Promise<IDownloadOutcome> {
  let known = false;
  let premium = false;
  try {
    const info = api.getState()?.persistent?.nexus?.userInfo;
    // 会员信息还没加载出来时不要瞎猜：交给宿主走标准流程（它会自己判断）
    known = info !== undefined && info !== null;
    premium = known ? info.isPremium === true : false;
  } catch {
    known = false;
  }

  if (known && !premium) {
    return downloadViaBrowser(api, request, options);
  }
  return downloadModFile(api, request, options);
}

