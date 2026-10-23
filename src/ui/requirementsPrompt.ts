/**
 * 前置（Requirements）流程编排
 * ---------------------------------------------------------------------------
 * 拆成三块，页面只负责"什么时候调用"：
 *   1. buildRequirementsPromptData —— 查前置、过滤、组装弹窗数据（失败一律返回 undefined）
 *   2. startRequirementDownload      —— 下载单条前置（查文件 → 自动挑主文件 → 走 downloadForUser）
 *   3. startSelectedRequirementDownloads —— 批量下载 + 汇总提示
 *
 * 硬性约定：
 *   - 任何前置查询/下载失败都不能阻塞主 MOD 的下载
 *   - 下载逻辑与搜索页完全一致：Premium 走宿主 start-download，免费账号开浏览器
 *   - 前置的单行/批量下载都不显示 "Downloading…"，只发一条汇总提示
 */

import { downloadForUser } from "../bridge/download";
import { REQUIREMENTS_PROMPT_TIMEOUT_MS } from "../constants";
import { getNexusService } from "../nexus/index";
import {
  buildDlcRows,
  buildRequirementRows,
  defaultSelectedModIds,
  hasRequirementsPrompt,
  IRequirementRow,
} from "../util/requirements";
import { pickPrimaryFile } from "../util/modFiles";
import { IInstalledNexusMod } from "../util/mods";
import { notify } from "./notify";
import { IRequirementsDialogData } from "./RequirementsDialog";

export interface IRequirementsContext {
  /** Nexus 游戏域名（如 skyrimspecialedition） */
  domain: string;
  /** Vortex 内部游戏 id（如 skyrimse） */
  internalGameId: string;
}

export interface IBuildPromptOptions extends IRequirementsContext {
  modId: number;
  modName: string;
  installed: Map<number, IInstalledNexusMod>;
  manual: number[];
}

/** 是否是免费账号（会员信息没加载出来时按"未知"处理，下载走非免费路径） */
export function isFreeAccount(state: any): boolean {
  const info = state?.persistent?.nexus?.userInfo;
  return info !== undefined && info !== null && info.isPremium === false;
}

/**
 * 查前置并组装弹窗数据。
 * 返回 undefined = 不用弹（查询失败 / 没有需要提醒的前置）。
 */
export async function buildRequirementsPromptData(
  api: any,
  options: IBuildPromptOptions,
): Promise<IRequirementsDialogData | undefined> {
  let info;
  let timer: any;
  try {
    info = await Promise.race([
      getNexusService(api).modRequirements(options.domain, options.modId),
      new Promise<undefined>((resolve) => {
        timer = setTimeout(() => resolve(undefined), REQUIREMENTS_PROMPT_TIMEOUT_MS);
      }),
    ]);
  } catch {
    // best-effort：查不到就当没有前置，绝不阻塞下载
    return undefined;
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }

  if (info === undefined) {
    return undefined;
  }

  const rows = buildRequirementRows({
    info,
    installed: options.installed,
    manual: options.manual,
    domain: options.domain,
    selfModId: options.modId,
  });
  const dlc = buildDlcRows(info);

  if (!hasRequirementsPrompt(rows, dlc)) {
    return undefined;
  }

  return {
    modName: options.modName,
    rows,
    dlc,
    defaultSelected: defaultSelectedModIds(rows),
  };
}

/**
 * 下载单条前置。
 * resolve(true) 只表示"已经交给下载管道/浏览器"，不代表下载完成
 * （downloadForUser 本身要等下载结束才 resolve，所以这里不 await 它）。
 */
export async function startRequirementDownload(
  api: any,
  context: IRequirementsContext,
  row: IRequirementRow,
): Promise<boolean> {
  if (row.modId <= 0) {
    return false;
  }
  // 只有"未安装"或刚取消"不再提醒"的前置才允许下载
  if (row.kind !== "missing" && row.kind !== "manual") {
    return false;
  }

  if (hasDownloadRecord(api, row.modId)) {
    return true; // 已经在下载列表里，视为已请求
  }

  let file;
  try {
    const files = await getNexusService(api).modFiles(context.domain, row.modId);
    file = pickPrimaryFile(files);
  } catch {
    notify(api, "error", `无法获取前置 ${row.name} 的文件列表。`, 6000);
    return false;
  }

  if (file === undefined) {
    notify(api, "error", `前置 ${row.name} 没有可下载的文件。`, 6000);
    return false;
  }

  try {
    void downloadForUser(api, {
      domain: context.domain,
      internalGameId: context.internalGameId,
      modId: row.modId,
      fileId: file.fileId,
      fileName: file.name,
      autoInstall: true,
    }).catch(() => undefined);
    return true;
  } catch {
    notify(api, "error", `前置下载失败：${row.name}`, 6000);
    return false;
  }
}

export interface IRequirementDownloadResult {
  started: number;
  failed: number;
}

/**
 * 这个 MOD 是否已经在 Vortex 下载列表里（含已完成但还没装的）。
 * 避免重复 emit 触发宿主的 AlreadyDownloaded 提示。
 */
function hasDownloadRecord(api: any, modId: number): boolean {
  try {
    const files = api.getState()?.persistent?.downloads?.files ?? {};
    for (const key of Object.keys(files)) {
      const record = files[key];
      if (record === undefined || record === null) {
        continue;
      }
      const info = record.modInfo;
      const candidate = Number(info?.modId ?? info?.nexus?.ids?.modId);
      if (candidate === modId && record.state !== "failed") {
        return true;
      }
    }
  } catch {
    /* 读 store 失败就当没有记录 */
  }
  return false;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 批量下载勾选的前置。
 * - Premium：3 个并发，尽快排队
 * - 免费账号：串行 + 600ms 间隔，避免浏览器一次弹出好几个标签页
 */
export async function startSelectedRequirementDownloads(
  api: any,
  context: IRequirementsContext & { freeAccount: boolean },
  rows: IRequirementRow[],
): Promise<IRequirementDownloadResult> {
  const queue = rows
    .filter(
      (row) =>
        row.modId > 0 && (row.kind === "missing" || row.kind === "manual"),
    )
    .slice();

  if (queue.length === 0) {
    return { started: 0, failed: 0 };
  }

  let started = 0;
  let failed = 0;
  const concurrency = context.freeAccount ? 1 : 3;

  const worker = async () => {
    while (queue.length > 0) {
      const row = queue.shift();
      if (row === undefined) {
        return;
      }
      const ok = await startRequirementDownload(api, context, row);
      if (ok) {
        started += 1;
        if (context.freeAccount) {
          // 给浏览器一点时间，别一次开一排
          await wait(600);
        }
      } else {
        failed += 1;
      }
    }
  };

  const workers: Array<Promise<void>> = [];
  for (let index = 0; index < Math.min(concurrency, queue.length); index += 1) {
    workers.push(worker());
  }
  await Promise.all(workers);

  return { started, failed };
}

/** 批量结束后的唯一一条汇总提示（不做逐项进度） */
export function notifyRequirementSummary(
  api: any,
  options: { freeAccount: boolean },
  result: IRequirementDownloadResult,
): void {
  if (result.started === 0 && result.failed === 0) {
    return;
  }

  const parts: string[] = [];
  if (result.started > 0) {
    parts.push(
      options.freeAccount
        ? `已在浏览器打开 ${result.started} 个前置页面`
        : `已开始下载 ${result.started} 个前置`,
    );
  }
  if (result.failed > 0) {
    parts.push(`${result.failed} 个未能自动下载，可用 View page 手动处理`);
  }

  const suffix = options.freeAccount && result.started > 0
    ? "（每个页面需点一次 Mod manager download）"
    : "";

  notify(api, "info", parts.join("；") + suffix, 7000);
}
