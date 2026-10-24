/**
 * 选择要下载的文件
 * ---------------------------------------------------------------------------
 * 规则（产品决定）：
 *   - **只提供 MAIN 文件的下载**。N 网上的 OPTIONAL / OLD_VERSION / ARCHIVED 是旧版本或
 *     附加内容，不进入选择列表（用户要的是"当前最新版本"）。
 *   - MAIN 只有 1 个 → 直接用，不打扰用户。
 *   - MAIN 有多个（例如同一版本拆成 R18 / 非 R18 两个主文件）→ 弹原生对话框让用户选，
 *     选完再走原来的下载流程。
 *   - 意外情况：一个 MAIN 都没有 → 退回"按日期排序的第一个文件"，避免完全下不了。
 *
 * 弹窗用的是宿主原生 `api.showDialog` 的 `choices`（单选 + 副标题），
 * 这样遮罩/ESC/焦点/多语言按钮全部白送，不需要自绘 UI。
 */

import { t } from "../i18n";
import { IModFile } from "../types";
import { formatBytes, formatUnixDate } from "../util/format";
import { describeFileCategory, isMainFile } from "../util/modFiles";

/** 该 MOD 的所有主文件（保持原顺序） */
export function mainFilesOf(files: IModFile[]): IModFile[] {
  return files.filter((file) => isMainFile(file));
}

/**
 * 文件选择弹窗的按钮文案保持英文。
 * ---------------------------------------------------------------------------
 * 这是宿主原生对话框的一部分（属于"不好改"的部分）：标题/说明会跟随插件语言，
 * 但原生按钮仍固定英文。零宽空格让 i18next 找不到翻译 key，从而原样显示英文；
 * 返回的 `result.action` 也带这个后缀，所以比较时必须用这两个常量。
 */
export const CHOOSE_FILE_ACTION = {
  cancel: "Cancel\u200B",
  download: "Download\u200B",
};

/**
 * 首选文件：优先 N 网标记的 primary=1，否则取上传时间最新的那个。
 */
export function defaultFileOf(files: IModFile[]): IModFile | undefined {
  if (files.length === 0) {
    return undefined;
  }
  const primary = files.find((file) => file.primary === 1);
  if (primary !== undefined) {
    return primary;
  }
  return files.slice().sort((lhs, rhs) => (rhs.date ?? 0) - (lhs.date ?? 0))[0];
}

/** 组装副标题："v1.2 · 12.3 MB · 2024-05-01 · 主文件" */
function subtitleOf(file: IModFile): string {
  return [
    file.version !== undefined && file.version !== "" ? `v${file.version}` : undefined,
    formatBytes(file.sizeInBytes ?? file.size),
    file.date !== undefined ? formatUnixDate(file.date) : undefined,
    describeFileCategory(file.category)?.label,
  ]
    .filter((part) => part !== undefined && part !== "")
    .join(" · ");
}

/**
 * 选文件。
 *
 * @returns 选中的文件；用户取消时返回 undefined
 */
export async function chooseModFile(
  api: any,
  modName: string,
  files: IModFile[],
): Promise<IModFile | undefined> {
  const mains = mainFilesOf(files);

  // 没有主文件（少见）→ 退回按日期排序的第一个，避免完全无法下载
  if (mains.length === 0) {
    return defaultFileOf(files);
  }

  // 只有一个主文件 → 不打扰
  if (mains.length === 1) {
    return mains[0];
  }

  const fallback = defaultFileOf(mains);

  const result = await api.showDialog(
    "question",
    t("filePicker.title"),
    {
      text: t("filePicker.text", { modName, count: mains.length }),
      choices: mains.map((file) => ({
        id: `file-${file.fileId}`,
        text: file.name,
        subText: subtitleOf(file),
        value: fallback !== undefined && file.fileId === fallback.fileId,
      })),
    },
    [
      { label: CHOOSE_FILE_ACTION.cancel },
      // 不设 default：宿主会给默认按钮加 autoFocus，弹窗一打开 Download 就一直
      // 处于聚焦高亮状态，直到用户点了某个文件。这个弹窗本来就要先选文件，
      // 不需要默认按钮；去掉后两个按钮都是普通按钮，点击/回车逻辑不变（回车不再
      // 直接确认，必须点 Download）。
      { label: CHOOSE_FILE_ACTION.download },
    ],
  );

  if (
    result === undefined ||
    result === null ||
    result.action !== CHOOSE_FILE_ACTION.download
  ) {
    return undefined;
  }

  const pickedId = Object.keys(result.input ?? {}).find(
    (key) => result.input[key] === true,
  );
  const pickedFileId =
    pickedId !== undefined && pickedId.indexOf("file-") === 0
      ? Number(pickedId.slice("file-".length))
      : NaN;

  const picked = mains.find((file) => file.fileId === pickedFileId);
  return picked ?? fallback;
}
