/**
 * 单行通知（多处复用）
 * ---------------------------------------------------------------------------
 * 只填 message、不填 title —— Vortex 的通知是「标题 + 正文」两行，
 * 只给正文就只占一行。
 *
 * 放在 ui/ 下是因为它依赖 api.sendNotification 这个 UI 侧能力；
 * 页面和前置弹窗流程都用同一份，避免两边文案/id 规则不一致。
 */

let notificationSeq = 0;

export function notify(
  api: any,
  type: "info" | "success" | "error",
  text: string,
  /** 自动关闭时间（毫秒）；不传则一直保留，需要用户手动关 */
  displayMS?: number,
): void {
  notificationSeq += 1;
  try {
    api.sendNotification({
      id: `nexus-mod-browser-${Date.now()}-${notificationSeq}`,
      type,
      message: text,
      ...(displayMS !== undefined ? { displayMS } : {}),
    });
  } catch {
    /* 通知失败不影响主流程 */
  }
}
