/**
 * MOD 文件的分类工具
 * ---------------------------------------------------------------------------
 * 背景（容易踩的坑）：
 *   GraphQL 里 `ModFile.category` 的类型是**枚举** `ModFileCategory!`，
 *   文档里同时又写"database ID"——实际返回可能是数字 `1`，也可能是字符串 `"MAIN"`，
 *   取决于服务端序列化方式。所以判断"是不是主文件"必须两种都认。
 *
 * 枚举取值（见《NexusMods-GraphQL-API-完整参考.md》ModFileCategory）：
 *   MAIN / UPDATE / OPTIONAL / OLD_VERSION / MISCELLANEOUS / REMOVED / ARCHIVED
 */

import { IModFile } from "../types";
import { t } from "../i18n";
import type { MessageKey } from "../i18n";

interface IFileCategoryInfo {
  /** 规范化的枚举名 */
  name: string;
  /** 给用户看的当前语言标签 */
  label: string;
}

/** 数字 id → 枚举名（Nexus 数据库里的顺序） */
const BY_ID: { [id: number]: string } = {
  1: "MAIN",
  2: "UPDATE",
  3: "OPTIONAL",
  4: "OLD_VERSION",
  5: "MISCELLANEOUS",
  6: "REMOVED",
  7: "ARCHIVED",
};

const LABEL_KEYS: { [name: string]: MessageKey } = {
  MAIN: "category.main",
  UPDATE: "category.update",
  OPTIONAL: "category.optional",
  OLD_VERSION: "category.oldVersion",
  MISCELLANEOUS: "category.misc",
  REMOVED: "category.removed",
  ARCHIVED: "category.archived",
};

/** 把数字或字符串统一成枚举名；无法识别时返回 undefined（内部 helper） */
function categoryNameOf(category: number | string | undefined | null): string | undefined {
  if (category === undefined || category === null) {
    return undefined;
  }
  if (typeof category === "string") {
    const upper = category.toUpperCase();
    return LABEL_KEYS[upper] !== undefined ? upper : undefined;
  }
  return BY_ID[category];
}

/** 分类信息（名称 + 当前语言标签） */
export function describeFileCategory(
  category: number | string | undefined | null,
): IFileCategoryInfo | undefined {
  const name = categoryNameOf(category);
  if (name === undefined) {
    return undefined;
  }
  return { name, label: t(LABEL_KEYS[name]) };
}

/** 是否主文件（兼容 1 与 "MAIN" 两种返回） */
export function isMainFile(file: IModFile | undefined | null): boolean {
  if (file === undefined || file === null) {
    return false;
  }
  const name = categoryNameOf(file.category);
  // primary === 1 也可以作为补充判据（部分文件没正确设置 category）
  return name === "MAIN" || file.primary === 1;
}

/** 文件排序：主文件优先，其次按上传时间倒序 */
export function compareModFiles(lhs: IModFile, rhs: IModFile): number {
  const lhsMain = isMainFile(lhs) ? 1 : 0;
  const rhsMain = isMainFile(rhs) ? 1 : 0;
  if (lhsMain !== rhsMain) {
    return rhsMain - lhsMain;
  }
  return (rhs.date ?? 0) - (lhs.date ?? 0);
}

/**
 * 前置下载用的"自动选文件"：不弹任何选择框。
 * 规则（与网站默认行为一致）：
 *   1. 主文件里带 primary === 1 的（网站标记的默认文件）
 *   2. 否则最新的主文件（files 已按主文件优先 + 日期倒序排列）
 *   3. 一个主文件都没有 → 最新的文件（避免完全下不了）
 *   4. 一个文件都没有 → undefined
 */
export function pickPrimaryFile(files: IModFile[] | undefined | null): IModFile | undefined {
  if (files === undefined || files === null || files.length === 0) {
    return undefined;
  }

  const mains = files.filter((file) => isMainFile(file));
  const primary = mains.find((file) => file.primary === 1);
  if (primary !== undefined) {
    return primary;
  }
  if (mains.length > 0) {
    return mains[0];
  }
  return files[0];
}
