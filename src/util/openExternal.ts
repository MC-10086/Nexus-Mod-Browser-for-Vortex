/**
 * 打开外部链接
 * ---------------------------------------------------------------------------
 * 渲染进程开启了 nodeIntegration，可以直接用 electron.shell。
 * 这里做了懒加载 + 兜底，避免在非 Electron 环境（比如单测）里直接崩。
 */

let cachedShell: any;

function getShell(): any {
  if (cachedShell !== undefined) {
    return cachedShell;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const electron = require("electron");
    cachedShell = electron?.shell ?? null;
  } catch {
    cachedShell = null;
  }
  return cachedShell;
}

/** 用系统默认浏览器打开一个 URL */
export function openExternal(url: string): void {
  const shell = getShell();
  if (shell !== null && typeof shell.openExternal === "function") {
    void shell.openExternal(url);
    return;
  }
  // 兜底：浏览器环境
  try {
    window.open(url, "_blank");
  } catch {
    /* 忽略 */
  }
}

/** 站点上的 mod 页面地址 */
export function modPageUrl(domain: string, modId: number): string {
  return `https://www.nexusmods.com/${domain}/mods/${modId}`;
}

/** 站点上该游戏的 mod 列表（官方空状态里的「去网站浏览」就是跳这里） */
export function gameModsUrl(domain: string): string {
  return `https://www.nexusmods.com/games/${domain}/mods`;
}

/** 站点上的文件页（带 nmm=1 让站点显示「用 Vortex 下载」按钮） */
export function modFilePageUrl(domain: string, modId: number, fileId?: number): string {
  const base = `${modPageUrl(domain, modId)}?tab=files`;
  return fileId === undefined ? base : `${base}&file_id=${fileId}&nmm=1`;
}
