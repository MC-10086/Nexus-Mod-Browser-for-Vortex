/**
 * 前置（Requirements）弹窗
 * ---------------------------------------------------------------------------
 * 纯展示组件：数据、判定、下载动作全部由页面传入。
 *
 * 为什么不用原生 `api.showDialog`：原生对话框只能整窗放几个按钮，
 * 没法给"每一行前置"配 Download / View page / 不再提醒。所以这里用宿主的
 * `nxm-modal*` 外壳 + `nxm-button*` + `nxm-checkbox` 自己拼 DOM，
 * 不新增任何 CSS 类、不引入任何第三方组件。
 *
 * 交互约定：
 *   - 左侧勾选 = 点底部「Download selected」时由插件下载（默认勾选所有未安装的）
 *   - 每行的「不再提醒」勾选 = 以后任何 MOD 需要这个前置都跳过（持久化，灰色小字表示）
 *   - 每行 Download = 立刻单独下载这一条，成功后自动取消勾选、按钮变 Requested
 *   - 已安装 / 站外 / 其他游戏 的 Download 置灰（避免重复安装或下错游戏）
 *   - Skip = 不下载前置，继续下载当前 MOD；右上角 × / 遮罩 / ESC = 整个操作取消
 */

import * as React from "react";

import { t } from "../i18n";
import { IDlcRow, IRequirementRow, rowStatusLabel } from "../util/requirements";
import { Button } from "./primitives";
import { Icon } from "./icons";

export interface IRequirementsDialogData {
  modName: string;
  rows: IRequirementRow[];
  dlc: IDlcRow[];
  /** 默认勾选（未安装的前置） */
  defaultSelected: number[];
}

export type RequirementsDecisionKind = "cancel" | "skip" | "download";

export interface IRequirementsDecision {
  kind: RequirementsDecisionKind;
  selected: number[];
  /** 用户最终选择"不再提醒"的前置 modId（页面据此持久化差集） */
  ignored: number[];
}

export interface IRequirementsDialogProps {
  data: IRequirementsDialogData;
  onDecision: (decision: IRequirementsDecision) => void;
  /** 单行下载；resolve(true) 表示已经开始（浏览器已打开 / 已进队列） */
  onDownloadOne: (row: IRequirementRow) => Promise<boolean>;
  /** 打开前置的 Nexus 页面 */
  onViewPage: (row: IRequirementRow) => void;
  /** 打开前置的详情弹窗（同一个游戏、有 Nexus modId 的行才提供） */
  onDetails: (row: IRequirementRow) => void;
  /** 详情弹窗叠在上面时，禁用本弹窗的 ESC，避免一次 ESC 把两层都关掉 */
  escDisabled?: boolean;
}

/** 宿主新 UI 的勾选框（DOM 结构与 .nxm-checkbox 的 CSS 对齐） */
function CheckBox(props: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={props.checked}
      aria-label={props.label}
      className="nxm-checkbox"
      data-checked={props.checked ? "" : undefined}
      disabled={props.disabled}
      style={props.disabled === true ? { opacity: 0.5 } : undefined}
      onClick={props.onChange}
    >
      <Icon name="check" className="nxm-checkbox-icon nxm-checkbox-icon-check" size={4} />
    </button>
  );
}

function isIgnorable(row: IRequirementRow): boolean {
  return row.kind === "missing" || row.kind === "manual";
}

function statusText(row: IRequirementRow, ignored: boolean): string {
  if (ignored) {
    return t("status.ignored");
  }
  // 取消"不再提醒"后，manual 行回到未安装状态
  if (row.kind === "manual") {
    return t("status.notInstalled");
  }
  return rowStatusLabel(row);
}

function statusClass(row: IRequirementRow, ignored: boolean): string {
  if (ignored) {
    return "text-neutral-subdued";
  }
  switch (row.kind) {
    case "installed":
      return "text-success-strong";
    case "external":
    case "otherGame":
      return "text-neutral-subdued";
    default:
      return "text-danger-strong";
  }
}

export default function RequirementsDialog(props: IRequirementsDialogProps) {
  const { data, onDecision, onDownloadOne, onViewPage, onDetails, escDisabled } = props;

  const [selected, setSelected] = React.useState<number[]>(() => data.defaultSelected.slice());
  const [ignored, setIgnored] = React.useState<number[]>(() =>
    data.rows.filter((row) => row.kind === "manual").map((row) => row.modId),
  );
  const [requested, setRequested] = React.useState<number[]>([]);
  const [busy, setBusy] = React.useState<number[]>([]);

  const selectableRows = data.rows.filter(
    (row) => isIgnorable(row) && ignored.indexOf(row.modId) === -1,
  );
  const allSelected =
    selectableRows.length > 0 && selectableRows.every((row) => selected.indexOf(row.modId) !== -1);

  // ESC = 取消整个操作（不是跳过）；详情弹窗打开时由详情弹窗处理
  const cancelRef = React.useRef(onDecision);
  cancelRef.current = onDecision;
  const escDisabledRef = React.useRef(escDisabled === true);
  escDisabledRef.current = escDisabled === true;

  React.useEffect(() => {
    if (typeof document === "undefined") {
      return undefined;
    }
    const onKeyDown = (evt: any) => {
      if (escDisabledRef.current) {
        return;
      }
      if (evt !== null && evt !== undefined && (evt.key === "Escape" || evt.keyCode === 27)) {
        evt.preventDefault?.();
        cancelRef.current({ kind: "cancel", selected: [], ignored: [] });
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const toggle = (modId: number) => {
    setSelected((prev) =>
      prev.indexOf(modId) === -1 ? prev.concat([modId]) : prev.filter((id) => id !== modId),
    );
  };

  const toggleAll = () => {
    setSelected(allSelected ? [] : selectableRows.map((row) => row.modId));
  };

  const toggleIgnored = (modId: number) => {
    const isIgnored = ignored.indexOf(modId) !== -1;
    setIgnored((prev) =>
      isIgnored ? prev.filter((id) => id !== modId) : prev.concat([modId]),
    );
    if (!isIgnored) {
      // 选择"不再提醒"就不该再参与批量下载
      setSelected((prev) => prev.filter((id) => id !== modId));
    }
  };

  const handleDownloadOne = async (row: IRequirementRow) => {
    if (busy.indexOf(row.modId) !== -1 || requested.indexOf(row.modId) !== -1) {
      return;
    }
    setBusy((prev) => prev.concat([row.modId]));
    let ok = false;
    try {
      ok = await onDownloadOne(row);
    } catch {
      ok = false;
    }
    setBusy((prev) => prev.filter((id) => id !== row.modId));
    if (ok) {
      setRequested((prev) => prev.concat([row.modId]));
      // 已经单行下载了，批量里就不再重复
      setSelected((prev) => prev.filter((id) => id !== row.modId));
    }
  };

  const cancel = () => onDecision({ kind: "cancel", selected: [], ignored: [] });
  const skip = () => onDecision({ kind: "skip", selected: [], ignored });
  const confirm = () => onDecision({ kind: "download", selected, ignored });

  const missingCount = data.rows.filter((row) => row.kind === "missing").length;
  const actionLabel =
    selected.length === 0
      ? t("common.continue")
      : t("requirements.downloadSelected", { count: selected.length });

  return (
    <div
      className="nxm-modal nxm-modal-xl"
      role="dialog"
      aria-modal="true"
      aria-label={t("requirements.title")}
      data-testid="requirements-dialog"
    >
      <div className="nxm-modal-overlay" onClick={cancel} />

      <div
        className="nxm-modal-panel flex flex-col"
        style={{ maxHeight: "85vh", overflow: "hidden" }}
      >
        <button
          type="button"
          className="nxm-modal-close"
          title={t("common.close")}
          aria-label={t("common.close")}
          onClick={cancel}
        >
          <Icon name="close" size={5} />
        </button>

        <div className="shrink-0" style={{ paddingRight: 40 }}>
          <p className="nxm-modal-title" style={{ marginBottom: 4 }}>
            {t("requirements.title")}
          </p>
          <p className="text-body-xs text-neutral-subdued">
            {t("requirements.subtitle", {
              modName: data.modName,
              count: data.rows.length,
              missing: missingCount,
            })}
          </p>
        </div>

        <div
          className="flex min-h-0 grow flex-col overflow-y-auto"
          style={{ overscrollBehavior: "contain" }}
        >
          {data.rows.map((row, index) => {
            const isIgnored = ignored.indexOf(row.modId) !== -1;
            const checked = selected.indexOf(row.modId) !== -1 && !isIgnored;
            const isRequested = requested.indexOf(row.modId) !== -1;
            const isBusy = busy.indexOf(row.modId) !== -1;
            const canBeIgnored = isIgnorable(row);
            const canDownload =
              canBeIgnored && !isIgnored && !isRequested && !isBusy;

            return (
              <div
                key={`req-${index}-${row.kind}-${row.modId}`}
                className="flex flex-wrap items-start gap-x-3 border-t border-stroke-weak py-2"
                data-testid="requirement-row"
                data-kind={row.kind}
              >
                <div className="flex h-6 shrink-0 items-center">
                  {canBeIgnored && !isIgnored
                    ? (
                      <CheckBox
                        checked={checked}
                        label={row.name}
                        onChange={() => toggle(row.modId)}
                      />
                    )
                    : <span style={{ display: "inline-block", width: 16, height: 16 }} />}
                </div>

                <div className="flex min-w-0 grow flex-col gap-y-1">
                  <div className="flex flex-wrap items-center gap-x-2">
                    <p className="truncate font-semibold text-body-sm" title={row.name}>
                      {row.name}
                    </p>
                    <p className={`text-body-xs ${statusClass(row, isIgnored)}`}>
                      {statusText(row, isIgnored)}
                    </p>
                  </div>
                  {row.notes !== undefined
                    ? (
                      <p
                        className="line-clamp-2 text-body-xs text-neutral-subdued"
                        title={row.notes}
                      >
                        {row.notes}
                      </p>
                    )
                    : null}
                </div>

                <div className="flex shrink-0 items-center gap-x-3">
                  {canBeIgnored
                    ? (
                      <div className="flex items-center gap-x-1">
                        <CheckBox
                          checked={isIgnored}
                          label={t("requirements.ignoreLabel", { name: row.name })}
                          onChange={() => toggleIgnored(row.modId)}
                        />
                        <button
                          type="button"
                          className="text-body-xs text-neutral-subdued"
                          style={{ cursor: "pointer" }}
                          title={t("requirements.ignoreHint")}
                          onClick={() => toggleIgnored(row.modId)}
                        >
                          {t("requirements.ignore")}
                        </button>
                      </div>
                    )
                    : null}

                  <Button
                    size="sm"
                    brand="neutral"
                    appearance="moderate"
                    icon="download"
                    disabled={!canDownload}
                    title={
                      isIgnored
                        ? t("requirements.ignoredTitle")
                        : row.kind === "installed"
                          ? t("requirements.installedTitle")
                          : canBeIgnored
                            ? isRequested
                              ? t("requirements.requestedTitle")
                              : t("requirements.downloadTitle")
                            : t("requirements.cannotDownloadTitle")
                    }
                    onClick={() => void handleDownloadOne(row)}
                  >
                    {isRequested ? t("common.requested") : t("common.download")}
                  </Button>

                  <Button
                    size="sm"
                    brand="neutral"
                    appearance="weak"
                    icon="openInNew"
                    disabled={row.url === undefined}
                    title={t("card.viewPageTitle")}
                    onClick={() => onViewPage(row)}
                  >
                    {t("common.viewPage")}
                  </Button>

                  {row.modId > 0 && row.kind !== "otherGame"
                    ? (
                      <Button
                        size="sm"
                        brand="neutral"
                        appearance="weak"
                        icon="details"
                        title={t("card.detailsTitle")}
                        onClick={() => onDetails(row)}
                      >
                        {t("common.details")}
                      </Button>
                    )
                    : null}
                </div>
              </div>
            );
          })}

          {data.dlc.length > 0
            ? (
              <div
                className="flex flex-col gap-y-1 border-t border-stroke-weak py-3"
                data-testid="requirements-dlc"
              >
                <p className="text-body-sm font-semibold">{t("requirements.dlcTitle")}</p>
                <p className="text-body-sm text-neutral-moderate">
                  {data.dlc.map((dlc) => dlc.name).join(t("common.nameSeparator"))}
                </p>
                <p className="text-body-xs text-neutral-subdued">
                  {t("requirements.dlcNote")}
                </p>
              </div>
            )
            : null}
        </div>

        <div className="mt-2 flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-stroke-weak pt-3">
          <div className="flex items-center gap-x-2">
            <CheckBox
              checked={allSelected}
              label={t("common.selectAll")}
              disabled={selectableRows.length === 0}
              onChange={toggleAll}
            />
            <p className="text-body-xs text-neutral-subdued">
              {t("common.selectAll")}
              {selectableRows.length > 0
                ? t("requirements.selected", {
                    selected: selected.length,
                    total: selectableRows.length,
                  })
                : ""}
            </p>
          </div>

          <div className="flex items-center gap-x-2">
            <Button
              brand="neutral"
              appearance="moderate"
              title={t("requirements.skipTitle")}
              onClick={skip}
            >
              {t("common.skip")}
            </Button>
            <Button
              title={t("requirements.downloadSelectedTitle")}
              onClick={confirm}
              disabled={busy.length > 0}
            >
              {actionLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
