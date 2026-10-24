/**
 * MOD 详情弹窗
 * ---------------------------------------------------------------------------
 * 定位：**纯展示组件**。数据、加载态、错误全部由页面传入，这里不碰 store、不发请求。
 * 因此"怎么打开它"是可以随时换的：
 *   - 现在：卡片底部的 Details 按钮 → dispatch(selectMod(id))
 *   - 以后想改成双击 / 右键菜单：只要在页面里换个地方调 openDetail()，
 *     本组件与状态层完全不用动（详见 BrowseModsPage.tsx 的 openDetail）。
 *   - 卡片封面现在用于"点击放大"，不承担打开详情 / 打开网页的职责。
 *
 * 复用的宿主素材（全部是运行时调用，不复制源码）：
 *   - util.bbcodeToReact   渲染 N 网 BBCode 简介（含粗体/链接/列表/图片/折叠块）
 *   - ZoomableImage        主图点击全屏放大（单 URL；没有多 src 回退）
 *   - nxm-modal-*          弹窗外壳（fixed 全屏遮罩 + 面板 + 关闭按钮）
 *   - nxm-image            图片容器（背景、居中、圆角裁切）
 *
 * 唯一自写的样式：组件内部一段 scoped <style>（见 DETAIL_CSS）。
 * 原因：宿主 tailwind 的 preflight 会把 a 的颜色/下划线、ul/ol 的项目符号、
 * h1~h6 的字号字重全部重置掉，不补的话"链接/列表/标题"在简介里根本看不出来。
 * 里面只用宿主 CSS 变量取色，所以自动跟随明暗主题，没有硬编码颜色。
 */

import * as React from "react";

import { ZoomableImage, util } from "@nexusmods/vortex-api";

import { t } from "../i18n";
import { IModDetail, IModSummary } from "../types";
import { detailBody, detailImageSources, detailMeta } from "../util/detail";
import { Button } from "./primitives";
import { Icon } from "./icons";

interface IModDetailDialogProps {
  /** 列表里的卡片数据：弹窗一打开就能显示标题/主图，不必等详情回来 */
  summary?: IModSummary;
  /** 没有 summary 时的兜底标题（例如从「前置」行打开详情） */
  title?: string;
  /** modDetail() 的结果；undefined 表示还在加载 */
  detail?: IModDetail;
  /** 详情加载失败时的文案 */
  error?: string;
  /** 关闭（ESC / 点遮罩 / 点 × 都走这里） */
  onClose: () => void;
  /** 详情加载失败后重试 */
  onRetry?: () => void;
}

const BODY_CLASS = "text-body-sm text-neutral-moderate";

/**
 * 弹窗内的 BBCode 排版补丁。
 * 作用域只用宿主已有的 `.nxm-modal .nxm-modal-panel`，**不新增任何类名**；
 * 颜色全部取宿主 CSS 变量，自动跟随明暗主题。
 *
 * 为什么必须补：tailwind 的 preflight 会把 `a` 的颜色/下划线、`ul/ol` 的项目符号、
 * `h1~h6` 的字号字重全部重置，不补的话简介里的链接/列表/标题在视觉上完全消失。
 */
const SCOPE = ".nxm-modal .nxm-modal-panel";

const DETAIL_CSS = `
${SCOPE} a { color: var(--color-info-strong); text-decoration: underline; }
${SCOPE} a:hover { text-decoration: none; }
${SCOPE} p { margin: 0.5em 0; }
${SCOPE} ul, ${SCOPE} ol { margin: 0.5em 0; padding-left: 1.5em; }
${SCOPE} ul { list-style: disc; }
${SCOPE} ol { list-style: decimal; }
${SCOPE} li { margin: 0.15em 0; }
${SCOPE} h1, ${SCOPE} h2, ${SCOPE} h3,
${SCOPE} h4, ${SCOPE} h5, ${SCOPE} h6 {
  margin: 0.8em 0 0.35em; font-size: 1.05em; font-weight: 600;
}
${SCOPE} blockquote {
  margin: 0.6em 0; padding-left: 0.8em;
  border-left: 2px solid var(--color-stroke-weak);
  color: var(--color-neutral-subdued);
}
${SCOPE} .detail-main-zoom .zoomable-image {
  display: block;
  width: 100%;
  max-width: none;
  max-height: 40vh;
  object-fit: contain;
  margin: 0 auto;
}
${SCOPE} img { border-radius: var(--radius-xs); }
${SCOPE} hr { margin: 1em 0; border-color: var(--color-stroke-weak); }
${SCOPE} pre, ${SCOPE} code {
  font-family: ui-monospace, "Cascadia Mono", Consolas, monospace;
  background: var(--color-surface-mid);
  border-radius: var(--radius-xs);
}
${SCOPE} pre { padding: 0.5em; overflow-x: auto; }
${SCOPE} code { padding: 0 0.25em; }
`;

/**
 * 调宿主 BBCode 渲染器。
 * - 宿主 2.8.2 的 util.bbcodeToReact 内部已经调过 preProcess（源码实证），不要再套一遍
 * - 万一某天这个 API 不见了/抛异常，退回纯文本，至少不出现空白弹窗
 */
function renderBBCode(text: string): any {
  const renderer = util === undefined ? undefined : util.bbcodeToReact;
  if (typeof renderer === "function") {
    try {
      return renderer(text);
    } catch {
      /* 解析失败 → 纯文本兜底 */
    }
  }
  return text;
}

export default function ModDetailDialog(props: IModDetailDialogProps) {
  const { summary, title, detail, error, onClose, onRetry } = props;

  // ESC / 关闭按钮的回调放进 ref：effect 只挂一次，避免每次渲染重装监听
  const closeRef = React.useRef(onClose);
  closeRef.current = onClose;

  // 打开时锁背景滚动 + 监听 ESC；关闭（卸载）时原样恢复
  React.useEffect(() => {
    if (typeof document === "undefined") {
      return undefined;
    }

    const onKeyDown = (evt: any) => {
      if (evt !== null && evt !== undefined && (evt.key === "Escape" || evt.keyCode === 27)) {
        evt.preventDefault?.();
        closeRef.current();
      }
    };

    document.addEventListener("keydown", onKeyDown);

    const body = document.body;
    const previousOverflow = body !== null ? body.style.overflow : "";
    if (body !== null) {
      body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (body !== null) {
        body.style.overflow = previousOverflow;
      }
    };
  }, []);

  // 详情优先；没有详情时用列表数据顶着（标题/主图/元信息先出来）
  const mod: any = detail ?? summary;
  const name: string =
    (mod !== undefined && mod !== null ? mod.name : undefined) ?? title ?? t("detail.fallbackTitle");
  const meta = detailMeta(mod);

  /**
   * 主图控件：用宿主自带 ZoomableImage（点击全屏放大、再点关闭）。
   * 单一 url 没有多级回退；若宿主版本没有这个导出，退回普通 img。
   */
  const imageProps: any = {
    alt: "",
    className: "rounded-xs",
    style: {
      display: "block",
      width: "100%",
      maxHeight: "40vh",
      objectFit: "contain",
    },
  };

  const sources = React.useMemo(() => {
    const fromDetail = detailImageSources(detail);
    return fromDetail.length > 0 ? fromDetail : detailImageSources(summary);
  }, [detail, summary]);

  const bodyText = React.useMemo(() => detailBody(mod), [mod]);

  // 简介只在详情到手后渲染；否则显示骨架（避免先闪一下"未提供简介"）
  const bodyNodes = React.useMemo(
    () => (detail !== undefined && error === undefined ? renderBBCode(bodyText) : []),
    [detail, error, bodyText],
  );

  return (
    <div
      className="nxm-modal nxm-modal-xl"
      role="dialog"
      aria-modal="true"
      aria-label={name}
      data-testid="mod-detail"
    >
      {/* 点遮罩关闭：overlay 是面板的兄弟节点，点面板本身不会冒泡到这里 */}
      <div className="nxm-modal-overlay" onClick={onClose} />

      <div
        className="nxm-modal-panel flex flex-col gap-y-3"
        style={{ maxHeight: "85vh", overflow: "hidden" }}
      >
        {/* 宿主 .nxm-modal-close 是绝对定位（面板右上角），不参与滚动 */}
        <button
          type="button"
          className="nxm-modal-close"
          title={t("common.close")}
          aria-label={t("common.close")}
          onClick={onClose}
        >
          <Icon name="close" size={5} />
        </button>

        <div className="shrink-0" style={{ paddingRight: 40 }}>
          <p className="nxm-modal-title" style={{ marginBottom: 4 }}>
            {name}
          </p>
          {meta.length > 0
            ? <p className="text-body-xs text-neutral-subdued">{meta}</p>
            : null}
        </div>

        {/* 只有这块滚动：长简介不会把标题和关闭按钮顶走 */}
        <div
          className="flex min-h-0 grow flex-col gap-y-3 overflow-y-auto"
          style={{ overscrollBehavior: "contain" }}
        >
          {sources.length > 0
            ? (
              // 用宿主的 nxm-image 负责居中/圆角裁切，但把底色改透明：
              // 主图按 max-height 等比缩放，两侧留白不该出现一块灰色方块。
              <div
                className="nxm-image w-full shrink-0 rounded-xs detail-main-zoom"
                style={{ backgroundColor: "transparent" }}
              >
                {ZoomableImage !== undefined
                  ? <ZoomableImage className="detail-main-zoom w-full" url={sources[0]} />
                  : <img src={sources[0]} {...imageProps} />}
              </div>
            )
            : null}

          {error !== undefined
            ? (
              <div className="flex flex-col gap-y-3">
                <p className="text-body-sm text-danger-strong">{error}</p>
                {onRetry !== undefined
                  ? (
                    <div>
                      <Button
                        brand="neutral"
                        appearance="moderate"
                        icon="refresh"
                        onClick={onRetry}
                      >
                        {t("common.retry")}
                      </Button>
                    </div>
                  )
                  : null}
              </div>
            )
            : detail === undefined
              ? (
                <div className="flex flex-col gap-y-2" data-testid="mod-detail-loading">
                  <div className="h-4 w-full animate-pulse rounded-xs bg-surface-mid" />
                  <div className="h-4 w-3/4 animate-pulse rounded-xs bg-surface-mid" />
                  <div className="h-4 w-1/2 animate-pulse rounded-xs bg-surface-mid" />
                </div>
              )
              : (
                <div
                  className={BODY_CLASS}
                  data-testid="mod-detail-body"
                  style={{ lineHeight: 1.55, overflowWrap: "anywhere" }}
                >
                  {bodyNodes}
                </div>
              )}
        </div>

        <style>{DETAIL_CSS}</style>
      </div>
    </div>
  );
}
