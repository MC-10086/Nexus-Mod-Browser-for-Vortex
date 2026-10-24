/**
 * 基础控件
 * ---------------------------------------------------------------------------
 * 这些不是"重新实现一套 UI"，而是**对宿主现有 CSS 类的最小封装**：
 *   - 按钮   → `.nxm-button` + `.nxm-button-{brand}` + `.nxm-button-{appearance}`（官方同款类）
 *   - 标签页 → `.nxm-tab-bar` / `.nxm-tab-button*`
 *   - 分页   → `.nxm-pagination*`
 *   - 输入框 → `.nxm-input`
 * 样式全部来自宿主全局注入的 tailwind-v4.css（含 CSS 变量，自动跟随明暗主题），
 * 所以外观与官方页面 1:1，且不需要 import 任何未导出的内部组件。
 */

import * as React from "react";

import { t } from "../i18n";
import { ButtonIcon, Icon, IconName } from "./icons";

// ---------------------------------------------------------------------------
// Button
// ---------------------------------------------------------------------------

type ButtonBrand = "primary" | "info" | "neutral" | "success" | "danger" | "premium";
type ButtonAppearance = "weak" | "subdued" | "moderate" | "strong";

interface IButtonProps {
  brand?: ButtonBrand;
  appearance?: ButtonAppearance;
  size?: "md" | "sm";
  icon?: IconName;
  disabled?: boolean;
  title?: string;
  type?: "button" | "submit";
  /** 无障碍标签（图标按钮必填） */
  ariaLabel?: string;
  className?: string;
  /** 内联样式（用于对齐/宽度这类一次性调整） */
  style?: any;
  /** 作用于内容外层 span 的类名（比如让内容撑满按钮） */
  contentClassName?: string;
  onClick?: (evt: any) => void;
  /** 鼠标移入（用于 hover 预热等） */
  onMouseEnter?: () => void;
  /** 键盘 focus（无障碍：和 hover 做同一件事） */
  onFocus?: () => void;
  children?: any;
}

export function Button(props: IButtonProps) {
  const {
    brand = "primary",
    appearance = "strong",
    size = "md",
    icon,
    disabled,
    title,
    type = "button",
    ariaLabel,
    className,
    style,
    contentClassName,
    onClick,
    onMouseEnter,
    onFocus,
    children,
  } = props;

  const classes = [
    "nxm-button",
    `nxm-button-${brand}`,
    `nxm-button-${appearance}`,
    size === "sm" ? "nxm-button-sm" : "",
    disabled ? "nxm-button-disabled" : "",
    !children ? "nxm-button-icon-only" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type={type}
      className={classes}
      style={style}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onFocus={onFocus}
    >
      {icon !== undefined ? <ButtonIcon name={icon} /> : null}
      {children ? <span className={contentClassName}>{children}</span> : null}
    </button>
  );
}

// ---------------------------------------------------------------------------
// 标签页
// ---------------------------------------------------------------------------

interface ITabButtonProps {
  name: string;
  count?: number;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

export function TabBar(props: { children?: any; className?: string }) {
  return (
    <div className={["nxm-tab-bar", "nxm-tab-bar-primary", props.className].filter(Boolean).join(" ")}>
      <div className="nxm-tab-bar-scroller" role="tablist">
        {props.children}
      </div>
    </div>
  );
}

export function TabButton(props: ITabButtonProps) {
  const { name, count, selected, disabled, onClick } = props;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected === true}
      className={[
        "nxm-tab-button",
        selected ? "nxm-tab-button-selected" : "",
        disabled ? "nxm-tab-button-disabled" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      disabled={disabled}
      tabIndex={selected ? 0 : -1}
      onClick={onClick}
    >
      <span className="nxm-tab-button-content">
        {name}
        {count !== undefined ? <span className="nxm-tab-button-count">{count}</span> : null}
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// 分页
// ---------------------------------------------------------------------------

interface IPaginationProps {
  currentPage: number; // 1-based
  totalPages: number;
  onChange: (page: number) => void;
  className?: string;
}

/** 生成 [1, 2, '...', 20, 21] 这样的页码序列（与官方一致的省略策略） */
function activePages(current: number, total: number): Array<number | "..."> {
  if (total <= 7) {
    return Array.from({ length: total }, (_, index) => index + 1);
  }
  if (current <= 4) {
    return [1, 2, 3, 4, 5, "...", total];
  }
  if (current >= total - 3) {
    return [1, "...", total - 4, total - 3, total - 2, total - 1, total];
  }
  return [1, "...", current - 1, current, current + 1, "...", total];
}

export function Pagination(props: IPaginationProps) {
  const { currentPage, totalPages, onChange, className } = props;

  return (
    <nav className={["nxm-pagination", className].filter(Boolean).join(" ")} role="navigation">
      <div className="nxm-pagination-items">
        <button
          type="button"
          className="nxm-pagination-arrow"
          aria-label={t("pagination.prev")}
          title={t("pagination.prev")}
          disabled={totalPages < 1 || currentPage === 1}
          onClick={() => onChange(Math.max(1, currentPage - 1))}
        >
          <Icon name="menuLeft" size={5} />
        </button>

        {activePages(currentPage, totalPages).map((page, index) =>
          page === "..." ? (
            <span className="nxm-pagination-separator" key={`dots-${index}`}>…</span>
          ) : (
            <button
              key={page}
              type="button"
              className={[
                "nxm-pagination-number",
                currentPage === page ? "nxm-pagination-number-active" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              aria-current={currentPage === page ? "true" : "false"}
              aria-label={t("pagination.page", { page })}
              onClick={() => onChange(page)}
            >
              {page}
            </button>
          ),
        )}

        <button
          type="button"
          className="nxm-pagination-arrow"
          aria-label={t("pagination.next")}
          title={t("pagination.next")}
          disabled={totalPages < 1 || currentPage === totalPages}
          onClick={() => onChange(Math.min(totalPages, currentPage + 1))}
        >
          <Icon name="menuRight" size={5} />
        </button>
      </div>
    </nav>
  );
}

// ---------------------------------------------------------------------------
// 排序下拉
// ---------------------------------------------------------------------------

interface ISortOption {
  id: string;
  label: string;
}

interface ISortMenuProps {
  options: ISortOption[];
  value: string;
  onChange: (id: string) => void;
  /** 按钮 tooltip / aria；默认「排序方式」 */
  title?: string;
  /** 下拉宽度；默认 240（排序），语言选择可传更小 */
  width?: number;
  ariaLabel?: string;
}

/**
 * 官方用的是 Headless UI 的 Listbox；我们只需要外观一致，
 * 所以用 `nxm-dropdown-*` 类 + 一个受控的开关自己实现（少一个依赖）。
 */
export function SortMenu(props: ISortMenuProps) {
  const { options, value, onChange, title, width, ariaLabel } = props;
  const [open, setOpen] = React.useState(false);
  const current = options.find((option) => option.id === value) ?? options[0];

  const WIDTH = width ?? 240;
  const buttonTitle = title ?? t("sort.title");

  return (
    <div className="relative">
      {/* 宿主 .nxm-button 默认把内容居中；这里显式改成左对齐 + 固定宽度，
          让「文字左、箭头右」，和官方的 Picker 一致 */}
      <Button
        brand="neutral"
        appearance="moderate"
        onClick={() => setOpen(!open)}
        title={buttonTitle}
        ariaLabel={ariaLabel ?? buttonTitle}
        style={{ width: WIDTH, justifyContent: "flex-start" }}
        contentClassName="flex w-full items-center justify-between gap-x-1"
      >
        <span className="truncate">{current?.label}</span>
        <Icon name="chevronDown" size={4} />
      </Button>

      {open
        ? (
          <div
            className="nxm-dropdown absolute left-0"
            style={{ marginTop: 4, width: WIDTH, zIndex: 50 }}
            role="listbox"
          >
            <div className="nxm-dropdown-items">
              {options.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  role="option"
                  aria-selected={option.id === value}
                  className="nxm-dropdown-item nxm-dropdown-item-hoverable"
                  style={{ justifyContent: "flex-start", textAlign: "left" }}
                  onClick={() => {
                    setOpen(false);
                    onChange(option.id);
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        )
        : null}
    </div>
  );
}

