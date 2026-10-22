/**
 * 格式化助手
 * ---------------------------------------------------------------------------
 * 全部是纯函数，方便单测；不依赖任何宿主 API。
 */

/** 1200000 → "1.2M"（与 Nexus 站点的展示风格一致） */
export function formatCount(value: number | undefined | null): string {
  if (value === undefined || value === null || isNaN(value)) {
    return "-";
  }
  if (value >= 1_000_000_000) {
    return trimZero(value / 1_000_000_000) + "B";
  }
  if (value >= 1_000_000) {
    return trimZero(value / 1_000_000) + "M";
  }
  if (value >= 1_000) {
    return trimZero(value / 1_000) + "K";
  }
  return String(Math.round(value));
}

function trimZero(value: number): string {
  const fixed = value >= 100 ? value.toFixed(0) : value >= 10 ? value.toFixed(1) : value.toFixed(2);
  return fixed.replace(/\.0+$/, "").replace(/(\.\d)0$/, "$1");
}

/** 字节数 → "12.3 MB"。GraphQL 的 sizeInBytes 是字符串（BigInt），这里两种都接受 */
export function formatBytes(input: number | string | undefined | null): string {
  if (input === undefined || input === null || input === "") {
    return "-";
  }
  const bytes = typeof input === "string" ? Number(input) : input;
  if (isNaN(bytes) || bytes <= 0) {
    return "-";
  }
  const units = ["B", "KB", "MB", "GB", "TB"];
  let index = 0;
  let value = bytes;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value >= 100 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`;
}

/** ISO 时间 → "2024-05-01" */
export function formatDate(iso: string | undefined): string {
  if (!iso) {
    return "-";
  }
  const date = new Date(iso);
  if (isNaN(date.getTime())) {
    return "-";
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Unix 秒 → "2024-05-01"（ModFile.date 是 Unix 时间戳） */
export function formatUnixDate(seconds: number | undefined): string {
  if (!seconds) {
    return "-";
  }
  return formatDate(new Date(seconds * 1000).toISOString());
}

/**
 * 极简 BBCode → 纯文本。
 * Nexus 的 mod 描述是 BBCode（[b] [url=] [img] 等），MVP 阶段不做富文本渲染，
 * 只去掉标记保留文字，避免把 `[b]` 直接显示给用户。
 */
export function bbcodeToPlainText(input: string | undefined): string {
  if (!input) {
    return "";
  }
  return input
    // [img]...[/img] 整体丢弃
    .replace(/\[img\][\s\S]*?\[\/img\]/gi, "")
    // [url=xxx]text[/url] → text；[url]xxx[/url] → xxx
    .replace(/\[url=[^\]]*\]([\s\S]*?)\[\/url\]/gi, "$1")
    .replace(/\[url\]([\s\S]*?)\[\/url\]/gi, "$1")
    // 其余 [xxx] / [/xxx] 标记直接去掉
    .replace(/\[\/?[a-z*][^\]]*\]/gi, "")
    // HTML 标签也顺手清掉
    .replace(/<[^>]+>/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** 截断长文本，保留完整单词边界 */
export function truncate(text: string, maxLength: number): string {
  if (!text || text.length <= maxLength) {
    return text ?? "";
  }
  const slice = text.slice(0, maxLength);
  const lastSpace = slice.lastIndexOf(" ");
  return (lastSpace > maxLength * 0.6 ? slice.slice(0, lastSpace) : slice) + "…";
}
