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

/** ISO 时间 → "2024-05-01"（内部 helper，formatUnixDate 使用） */
function formatDate(iso: string | undefined): string {
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
