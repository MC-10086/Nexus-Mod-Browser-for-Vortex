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

export interface IFileCategoryInfo {
  /** 规范化的枚举名 */
  name: string;
  /** 给用户看的中文标签 */
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

const LABELS: { [name: string]: string } = {
  MAIN: "主文件",
  UPDATE: "更新包",
  OPTIONAL: "可选文件",
  OLD_VERSION: "旧版本",
  MISCELLANEOUS: "其他",
  REMOVED: "已移除",
  ARCHIVED: "已归档",
};

/** 把数字或字符串统一成枚举名；无法识别时返回 undefined */
export function categoryNameOf(category: number | string | undefined | null): string | undefined {
  if (category === undefined || category === null) {
    return undefined;
  }
  if (typeof category === "string") {
    const upper = category.toUpperCase();
    return LABELS[upper] !== undefined ? upper : undefined;
  }
  return BY_ID[category];
}

/** 分类信息（名称 + 中文标签） */
export function describeFileCategory(
  category: number | string | undefined | null,
): IFileCategoryInfo | undefined {
  const name = categoryNameOf(category);
  if (name === undefined) {
    return undefined;
  }
  return { name, label: LABELS[name] };
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
