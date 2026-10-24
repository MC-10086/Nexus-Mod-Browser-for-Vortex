/**
 * 前置（Requirements）数据整形
 * ---------------------------------------------------------------------------
 * 纯函数，全部可单测。把 GraphQL / 本地安装信息 / 手动标记揉成"弹窗能直接画"的行模型：
 *
 *   missing   未安装的 Nexus 前置（可勾选、可下载）
 *   manual    用户勾了"不再提醒"的前置（持久化；不参与下载，取消勾选后回到 missing）
 *   installed Vortex 已安装（显示本地版本，不可下载）
 *   external  站外组件（VC++ / .NET 之类，只能给链接）
 *   otherGame 属于其他游戏的前置（不能安全下载到当前游戏）
 *
 * 几个产品约定：
 *   - 本地有就默认可用：不做版本比较（Nexus API 也没有结构化的"要求版本"字段）
 *   - "不再提醒"是显式勾选 → 调用方持久化到 nexusBrowserPrefs（对任意 MOD 生效）
 *   - 已安装 / 站外 / 其他游戏 不参与批量下载
 */

import { NEXUS_BASE_URL, REQUIREMENTS_MAX_ROWS } from "../constants";
import { t } from "../i18n";
import { IModRequirementsInfo } from "../types";
import { IInstalledNexusMod } from "./mods";

type RequirementKind = "missing" | "manual" | "installed" | "external" | "otherGame";

export interface IRequirementRow {
  kind: RequirementKind;
  /** Nexus mod id；站外 / 非法 id 为 0 */
  modId: number;
  name: string;
  url?: string;
  /** 作者备注（版本要求通常写在这里） */
  notes?: string;
  /** installed 行：Vortex 记录的本地版本 */
  localVersion?: string;
  /** 是否参与勾选 / 批量下载 */
  downloadable: boolean;
}

export interface IDlcRow {
  name: string;
  notes?: string;
}

interface IBuildRowsInput {
  info: IModRequirementsInfo;
  /** modId → 本地版本（来自 util/mods.installedNexusMods） */
  installed: Map<number, IInstalledNexusMod>;
  /** 手动安装标记（来自 persistent.nexusBrowserPrefs） */
  manual: number[];
  /** Nexus 游戏域名，用于拼前置页面链接 */
  domain: string;
  /** 当前正在下载的 MOD（避免把自己当前置） */
  selfModId: number;
}

/** 常见 HTML 实体解码（Nexus 的 DLC 名/备注里会有 &amp;） */
function decodeText(input: string | undefined | null): string {
  if (input === undefined || input === null) {
    return "";
  }
  return String(input)
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;|&apos;/gi, "'")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/** 前置的 Nexus 页面地址（站外前置应该用作者给的 url） */
function nexusModUrl(domain: string, modId: number): string {
  return `${NEXUS_BASE_URL}/${domain}/mods/${modId}`;
}

function toModId(value: string | number | undefined | null): number {
  const parsed = typeof value === "number" ? value : parseInt(String(value ?? ""), 10);
  return isFinite(parsed) && parsed > 0 ? parsed : 0;
}

/**
 * 把一条 Nexus 前置转成行。
 * 排序/去重在 buildRequirementRows 里做。
 */
function buildRow(input: IBuildRowsInput, requirement: any): IRequirementRow | undefined {
  const { info, installed, manual, domain, selfModId } = input;

  const external = requirement?.externalRequirement === true;
  const modId = toModId(requirement?.modId);
  const isExternal = external || modId <= 0;
  const name =
    decodeText(requirement?.modName) ||
    (isExternal ? t("status.external") : t("requirements.unnamedMod", { modId }));
  const notes = decodeText(requirement?.notes) || undefined;

  if (!isExternal && modId === selfModId) {
    return undefined; // 自己依赖自己，忽略
  }

  const crossGame =
    !isExternal &&
    requirement?.gameId !== undefined &&
    requirement?.gameId !== null &&
    String(requirement.gameId) !== String(info.gameNumericId);

  if (isExternal) {
    const url = typeof requirement?.url === "string" && requirement.url.trim().length > 0
      ? requirement.url.trim()
      : undefined;
    return { kind: "external", modId: 0, name, url, notes, downloadable: false };
  }

  if (crossGame) {
    const url = typeof requirement?.url === "string" && requirement.url.trim().length > 0
      ? requirement.url.trim()
      : undefined;
    return { kind: "otherGame", modId, name, url, notes, downloadable: false };
  }

  const local = installed.get(modId);
  if (local !== undefined) {
    return {
      kind: "installed",
      modId,
      name,
      url: nexusModUrl(domain, modId),
      notes,
      localVersion: local.version,
      downloadable: false,
    };
  }

  if (manual.indexOf(modId) !== -1) {
    return {
      kind: "manual",
      modId,
      name,
      url: nexusModUrl(domain, modId),
      notes,
      // "不再提醒"的行不参与下载；取消不再提醒后才回到 missing
      downloadable: false,
    };
  }

  return {
    kind: "missing",
    modId,
    name,
    url: nexusModUrl(domain, modId),
    notes,
    downloadable: true,
  };
}

const KIND_ORDER: { [kind in RequirementKind]: number } = {
  missing: 0,
  manual: 1,
  installed: 2,
  external: 3,
  otherGame: 4,
};

/**
 * 生成弹窗行（已按"要处理的优先"排序：未安装 → 手动 → 已安装 → 站外 → 其他游戏）。
 * 同一个 modId 只保留一条。
 */
export function buildRequirementRows(input: IBuildRowsInput): IRequirementRow[] {
  const rows: IRequirementRow[] = [];
  const seen = new Set<number>();

  for (const requirement of input.info.nexus) {
    const row = buildRow(input, requirement);
    if (row === undefined) {
      continue;
    }
    if (row.modId > 0) {
      if (seen.has(row.modId)) {
        continue;
      }
      seen.add(row.modId);
    }
    rows.push(row);
  }

  rows.sort((lhs, rhs) => KIND_ORDER[lhs.kind] - KIND_ORDER[rhs.kind]);
  return rows.slice(0, REQUIREMENTS_MAX_ROWS);
}

/** DLC 行：去重 + 实体解码（无法检测，只展示） */
export function buildDlcRows(info: IModRequirementsInfo): IDlcRow[] {
  const out: IDlcRow[] = [];
  const seen = new Set<string>();

  for (const dlc of info.dlc) {
    const name = decodeText(dlc?.gameExpansion?.name);
    if (name.length === 0 || seen.has(name)) {
      continue;
    }
    seen.add(name);
    const notes = decodeText(dlc?.notes) || undefined;
    out.push({ name, notes });
  }

  return out;
}

/**
 * 需要弹窗吗。
 * ---------------------------------------------------------------------------
 * **只有"未安装"的 Nexus 前置才值得打断下载。**
 * 已安装 / 不再提醒 / 站外 / 其他游戏 / DLC 只在弹窗已经打开时作为附注展示，
 * 不单独触发弹窗 —— 否则"所有前置都装好了还弹"（典型：只剩一个站外 VC++）会很烦。
 */
export function hasRequirementsPrompt(rows: IRequirementRow[], dlc: IDlcRow[]): boolean {
  // dlc 不参与触发；保留参数是为了让调用方/测试的语义完整
  void dlc;
  return rows.some((row) => row.kind === "missing");
}

/** 默认勾选：所有"未安装"的行（"不再提醒"的默认不勾） */
export function defaultSelectedModIds(rows: IRequirementRow[]): number[] {
  return rows.filter((row) => row.kind === "missing").map((row) => row.modId);
}

/**
 * 把"不再提醒"的最终状态换算成持久化变更：
 *   - 本次新勾上的 → mark
 *   - 本次取消勾上的 → unmark
 *
 * 弹窗会把初始的 manual 行作为 ignored 的初值，所以这里比较的是两个集合的差集。
 */
export function diffIgnoredMarks(
  originalIgnored: number[],
  currentIgnored: number[],
): { mark: number[]; unmark: number[] } {
  const original = new Set(originalIgnored);
  const current = new Set(currentIgnored);
  return {
    mark: currentIgnored.filter((id) => !original.has(id)),
    unmark: originalIgnored.filter((id) => !current.has(id)),
  };
}

/** 行状态标签（当前语言）；"不再提醒"由弹窗按本地状态覆盖成灰色文案 */
export function rowStatusLabel(row: IRequirementRow): string {
  switch (row.kind) {
    case "missing":
      return t("status.notInstalled");
    case "manual":
      return t("status.ignored");
    case "installed":
      return row.localVersion !== undefined && row.localVersion.length > 0
        ? t("status.installedVersion", { version: row.localVersion })
        : t("status.installed");
    case "external":
      return t("status.external");
    case "otherGame":
      return t("status.otherGame");
    default:
      return "";
  }
}
