/**
 * 详情弹窗的数据整形（纯函数，可在 Node 里单测）
 * ---------------------------------------------------------------------------
 * 弹窗本身只负责"怎么显示"，这里负责"显示什么"：
 *   1. 主图三级兜底（pictureUrl → thumbnailLargeUrl → thumbnailUrl）
 *   2. 简介回退链（description → summary → 兜底文案）
 *   3. 把 N 网描述里的换行统一成宿主 BBCode 渲染器认识的 [br]
 *
 * 换行处理的实测依据（2026-10-23，SkyUI / USSEP / MO2 三条真实 description）：
 *   N 网返回的是「BBCode + <br />」，且每个 <br /> 前通常还带一个裸 \n；
 *   而 bbcode-to-react 的 toReact() 把文本原样塞进 React（源码实证），
 *   裸 \n 会被浏览器折叠成空格，所以必须先归一化，否则长简介会变成一堵墙。
 */

import { t } from "../i18n";
import { IModDetail, IModSummary } from "../types";
import { formatCount } from "./format";

/** 详情/列表都能喂进来（详情字段更全） */
export type IDetailSource = Partial<IModDetail & IModSummary> | undefined | null;

/** 简介为空时的兜底文案 */
export const EMPTY_DESCRIPTION = "该 MOD 未提供简介。";

/**
 * 主图候选列表（按兜底顺序）。
 * - 去掉空串 / 纯空白
 * - 去重（有些 MOD 的 pictureUrl 和 thumbnailLargeUrl 完全一样）
 * - 保持顺序（Image 控件就是按数组顺序回退的）
 */
export function detailImageSources(mod: IDetailSource): string[] {
  if (mod === undefined || mod === null) {
    return [];
  }

  const candidates = [
    (mod as any).pictureUrl,
    (mod as any).thumbnailLargeUrl,
    (mod as any).thumbnailUrl,
  ];

  const out: string[] = [];
  for (const candidate of candidates) {
    const url = typeof candidate === "string" ? candidate.trim() : "";
    if (url.length > 0 && out.indexOf(url) === -1) {
      out.push(url);
    }
  }
  return out;
}

/** 简介的回退链：description → summary → 兜底文案（返回**未归一化**的原文） */
export function detailBodySource(mod: IDetailSource): string {
  if (mod === undefined || mod === null) {
    return "";
  }

  const description = typeof (mod as any).description === "string" ? (mod as any).description : "";
  if (description.trim().length > 0) {
    return description;
  }

  const summary = typeof (mod as any).summary === "string" ? (mod as any).summary : "";
  if (summary.trim().length > 0) {
    return summary;
  }

  return "";
}

/**
 * 弹窗正文（已归一化，可直接交给 util.bbcodeToReact）。
 * 注意：description 是 BBCode 原文；summary 是纯文本，走同一个渲染器也没问题。
 */
export function detailBody(mod: IDetailSource): string {
  const source = detailBodySource(mod);
  const normalized = normalizeDetailText(source);
  // 只有 <br /> 之类"看起来有内容、渲染出来是空的"描述，也要回退到兜底文案
  return normalized.length > 0 ? normalized : t("detail.empty");
}

/**
 * 换行归一化：
 *   1. 去掉紧贴在 <br> 前面的裸 \n（N 网常见 `\n<br />`，不去会双倍行距）
 *   2. <br> / <br/> / <br /> 统一成 [br] 文本行
 *   3. 剩下的裸 \n 也变成 [br] 文本行
 *   4. 去掉首尾多余的 [br]
 *
 * 为什么必须写成 `[br][/br]` 而不是 `[br]`：宿主的 BBCode 解析器在遇到未闭合标签时
 * 会把后续内容当成子节点，而 BrTag 渲染时丢弃子节点 —— 只写 `[br]` 会吞掉后面的正文
 * （宿主自己的 preProcess 也是生成成对的 `[br][/br]`）。
 */
export function normalizeDetailText(input: string): string {
  if (typeof input !== "string" || input.length === 0) {
    return "";
  }

  const BR = "[br][/br]";

  return input
    .replace(/\r\n/g, "\n")
    .replace(/\n(?=\s*<br\s*\/?>)/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/\n/g, BR)
    .replace(/^(?:\[br\]\[\/br\])+/, "")
    .replace(/(?:\[br\]\[\/br\])+$/, "");
}

/**
 * 标题下方的一行元信息（作者 · 版本 · 下载 · 点赞）。
 * 只显示确实有值的项；一条都没有时返回空串，调用方不渲染这一行。
 */
export function detailMeta(mod: IDetailSource): string {
  if (mod === undefined || mod === null) {
    return "";
  }

  const parts: string[] = [];

  const author = (mod as any).uploader?.name ?? (mod as any).author;
  if (typeof author === "string" && author.length > 0) {
    parts.push(author);
  }

  if (typeof (mod as any).version === "string" && (mod as any).version.length > 0) {
    parts.push(`v${(mod as any).version}`);
  }

  if (typeof (mod as any).downloads === "number") {
    parts.push(t("detail.downloads", { count: formatCount((mod as any).downloads) }));
  }

  if (typeof (mod as any).endorsements === "number") {
    parts.push(t("detail.endorsements", { count: formatCount((mod as any).endorsements) }));
  }

  return parts.join("  ·  ");
}
