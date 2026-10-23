/**
 * Mod 卡片
 * ---------------------------------------------------------------------------
 * 结构镜像官方 `CollectionTile`（Vortex 2.8.2），类名逐一对齐：
 *   容器   flex w-full flex-col rounded-md bg-surface-mid
 *   内容行 flex grow items-start gap-x-3.5 p-3
 *   封面   nxm-image nxm-image-mod（官方已内置 --aspect-mod 比例）
 *   统计行 border-t border-stroke-weak pt-1.5
 *   底部条 rounded-b bg-surface-translucent-low px-3 py-2
 * 因此外观与官方合集卡片一致，但我们只写 JSX，不复制任何源码。
 */

import * as React from "react";

import { IModSummary } from "../types";
import { formatCount } from "../util/format";
import { Icon, IconName } from "./icons";
import { Button } from "./primitives";

export interface IModTileProps {
  mod: IModSummary;
  /** 分类名（GraphQL 的 category 是字符串；没有时传 undefined） */
  category?: string;
  /** 这个 MOD 本地是否已经装过（按 Nexus mod id 判定，见 util/mods.ts） */
  installed?: boolean;
  /** 正在下载 / 安装：按钮禁用并改文案 */
  busy?: boolean;
  /** 鼠标移入 Download 按钮时预热文件列表（让第一次点下载不用等网络） */
  onPrefetch?: () => void;
  onOpen?: () => void;
  onDownload?: () => void;
  onViewPage?: () => void;
  /**
   * 打开详情弹窗。
   * 故意做成可选 prop：入口不要写死在卡片里 —— 以后想换成「点封面打开详情」，
   * 只要不传 onDetails、把 onOpen 指到同一个 handler 即可，弹窗与状态层都不用动。
   */
  onDetails?: () => void;
}

function Stat(props: { icon: IconName; children: any }) {
  return (
    <div className="flex items-center gap-x-1">
      <Icon name={props.icon} size={4} className="text-neutral-subdued" />
      <p className="text-body-sm text-neutral-moderate">{props.children}</p>
    </div>
  );
}

export default function ModTile(props: IModTileProps) {
  const { mod, category, installed, busy, onPrefetch, onOpen, onDownload, onViewPage, onDetails } =
    props;
  const author = mod.uploader?.name ?? mod.author ?? "unknown";

  return (
    <div
      className="flex w-full flex-col rounded-md bg-surface-mid"
      data-testid="mod-tile"
    >
      <div className="flex grow items-start gap-x-3.5 p-3">
        {/* 左列：封面 +（可选）已安装标记 */}
        <div className="flex w-full max-w-35 shrink-0 flex-col gap-y-1">
          <div
            className="nxm-image nxm-image-mod w-full rounded-xs"
            onClick={onOpen}
            role="button"
            tabIndex={0}
            onKeyDown={(evt: any) => {
              if (evt.key === "Enter" || evt.key === " ") {
                onOpen?.();
              }
            }}
          >
            {mod.pictureUrl !== undefined && mod.pictureUrl !== ""
              ? (
                <img
                  className="nxm-image-media nxm-image-media-cover"
                  src={mod.pictureUrl}
                  alt=""
                  loading="lazy"
                  draggable={false}
                />
              )
              : <Icon name="imageBroken" size={6} className="text-neutral-subdued" />}
          </div>
        </div>

        <div className="flex min-w-0 grow flex-col gap-y-1.5">
          <div className="flex flex-col gap-y-1">
            <p className="truncate font-semibold text-body-lg" title={mod.name}>
              {mod.name}
            </p>

            <p className="flex items-center gap-x-1 text-body-sm text-neutral-moderate">
              <span className="size-4 overflow-hidden rounded-full bg-surface-translucent-low" />
              {author}
            </p>
          </div>

          <div className="flex items-center gap-x-1.5 border-t border-stroke-weak pt-1.5">
            {category !== undefined
              ? <p className="text-body-sm text-info-strong">{category}</p>
              : null}

            {mod.adultContent === true
              ? (
                <>
                  {category !== undefined ? <span className="nxm-bullet" /> : null}
                  <p className="text-body-sm text-danger-strong">Adult</p>
                </>
              )
              : null}
          </div>

          <div className="flex items-center gap-x-5 border-t border-stroke-weak pt-1.5">
            <Stat icon="download">{formatCount(mod.downloads)}</Stat>
            <Stat icon="thumbUp">{formatCount(mod.endorsements)}</Stat>
            {mod.version !== undefined && mod.version !== ""
              ? <Stat icon="tag">v{mod.version}</Stat>
              : null}
          </div>

          <p className="line-clamp-3 border-t border-stroke-weak pt-1.5 text-body-sm text-neutral-subdued">
            {mod.summary ?? ""}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-x-2 rounded-b bg-surface-translucent-low px-3 py-2">
        <Button
          size="sm"
          icon="download"
          onClick={onDownload}
          onMouseEnter={onPrefetch}
          onFocus={onPrefetch}
          disabled={busy === true}
          title="Download and install"
        >
          {busy === true ? "Downloading…" : "Download"}
        </Button>

        <Button
          size="sm"
          brand="neutral"
          appearance="weak"
          icon="openInNew"
          onClick={onViewPage}
          title="Open on Nexus Mods"
        >
          View page
        </Button>

        {onDetails !== undefined
          ? (
            <Button
              size="sm"
              brand="neutral"
              appearance="weak"
              icon="details"
              onClick={onDetails}
              title="Show mod details"
            >
              Details
            </Button>
          )
          : null}

        {installed === true
          ? (
            <p
              className="ml-auto text-body-xs text-success-strong"
              title="This mod is already installed"
            >
              Installed !
            </p>
          )
          : null}
      </div>
    </div>
  );
}
