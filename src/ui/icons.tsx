/**
 * 图标
 * ---------------------------------------------------------------------------
 * 图标路径来自 Material Design Icons（@mdi/js，Apache-2.0），
 * 与 Vortex 界面用的是同一套图标，视觉一致。
 *
 * 为什么不 import "@mdi/js"：宿主的 require 只映射了 vortex-api / react-select / redux-act，
 * 其他包必须在扩展里自带；这里只需要十来个路径，直接内联更省事（也不用打包）。
 */

import * as React from "react";

export const ICONS = {
  magnify:
    "M9.5,3A6.5,6.5 0 0,1 16,9.5C16,11.11 15.41,12.59 14.44,13.73L14.71,14H15.5L20.5,19L19,20.5L14,15.5V14.71L13.73,14.44C12.59,15.41 11.11,16 9.5,16A6.5,6.5 0 0,1 3,9.5A6.5,6.5 0 0,1 9.5,3M9.5,5C7,5 5,7 5,9.5C5,12 7,14 9.5,14C12,14 14,12 14,9.5C14,7 12,5 9.5,5Z",
  refresh:
    "M17.65,6.35C16.2,4.9 14.21,4 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20C15.73,20 18.84,17.45 19.73,14H17.65C16.83,16.33 14.61,18 12,18A6,6 0 0,1 6,12A6,6 0 0,1 12,6C13.66,6 15.14,6.69 16.22,7.78L13,11H20V4L17.65,6.35Z",
  openInNew:
    "M14,3V5H17.59L7.76,14.83L9.17,16.24L19,6.41V10H21V3M19,19H5V5H12V3H5C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V12H19V19Z",
  thumbUp:
    "M23,10C23,8.89 22.1,8 21,8H14.68L15.64,3.43C15.66,3.33 15.67,3.22 15.67,3.11C15.67,2.7 15.5,2.32 15.23,2.05L14.17,1L7.59,7.58C7.22,7.95 7,8.45 7,9V19A2,2 0 0,0 9,21H18C18.83,21 19.54,20.5 19.84,19.78L22.86,12.73C22.95,12.5 23,12.26 23,12V10M1,21H5V9H1V21Z",
  download: "M5,20H19V18H5M19,9H15V3H9V9H5L12,16L19,9Z",
  star: "M12,17.27L18.18,21L16.54,13.97L22,9.24L14.81,8.62L12,2L9.19,8.62L2,9.24L7.45,13.97L5.82,21L12,17.27Z",
  menuLeft: "M14,7L9,12L14,17V7Z",
  menuRight: "M10,17L15,12L10,7V17Z",
  chevronDown: "M7.41,8.58L12,13.17L16.59,8.58L18,10L12,16L6,10L7.41,8.58Z",
  check: "M21,7L9,19L3.5,13.5L4.91,12.09L9,16.17L19.59,5.59L21,7Z",
  imageBroken:
    "M19,3A2,2 0 0,1 21,5V11H19V13H19L17,13V15H15V17H13V19H11V21H5C3.89,21 3,20.1 3,19V5A2,2 0 0,1 5,3H19M21,15V19A2,2 0 0,1 19,21H19L15,21V19H17V17H19V15H21M19,8.5A0.5,0.5 0 0,0 18.5,8H5.5A0.5,0.5 0 0,0 5,8.5V15.5A0.5,0.5 0 0,0 5.5,16H11V15H13V13H15V11H17V9H19V8.5Z",
  clock:
    "M12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22C6.47,22 2,17.5 2,12A10,10 0 0,1 12,2M12.5,7V12.25L17,14.92L16.25,16.15L11,13V7H12.5Z",
  tag: "M5.5,7A1.5,1.5 0 0,1 4,5.5A1.5,1.5 0 0,1 5.5,4A1.5,1.5 0 0,1 7,5.5A1.5,1.5 0 0,1 5.5,7M21.41,11.58L12.41,2.58C12.05,2.22 11.55,2 11,2H4C2.89,2 2,2.89 2,4V11C2,11.55 2.22,12.05 2.59,12.41L11.58,21.41C11.95,21.77 12.45,22 13,22C13.55,22 14.05,21.77 14.41,21.41L21.41,14.41C21.78,14.05 22,13.55 22,13C22,12.44 21.77,11.94 21.41,11.58Z",
  alert:
    "M11,15H13V17H11V15M11,7H13V13H11V7M12,2C6.47,2 2,6.5 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20Z",
} as const;

export type IconName = keyof typeof ICONS;

/** 与宿主一致的尺寸档位（size-3 ~ size-8 都是已编译的 tailwind 类） */
const SIZE_CLASS = {
  3: "size-3",
  4: "size-4",
  5: "size-5",
  6: "size-6",
  8: "size-8",
} as const;

export interface IIconProps {
  name: IconName;
  size?: keyof typeof SIZE_CLASS;
  className?: string;
  /** 传了就带 role="img" + aria-label，供读屏 */
  title?: string;
}

export function Icon(props: IIconProps) {
  const { name, size = 5, className, title } = props;
  return (
    <svg
      className={["shrink-0", SIZE_CLASS[size], className].filter(Boolean).join(" ")}
      viewBox="0 0 24 24"
      role={title !== undefined ? "img" : "presentation"}
      aria-label={title}
      focusable="false"
    >
      <path d={ICONS[name]} fill="currentColor" />
    </svg>
  );
}

/** 按钮内部的图标：宿主用 `.nxm-button-icon` 控制尺寸与间距，所以不再加 size-* */
export function ButtonIcon(props: { name: IconName; className?: string }) {
  return (
    <svg
      className={["nxm-button-icon", "shrink-0", props.className].filter(Boolean).join(" ")}
      viewBox="0 0 24 24"
      role="presentation"
      focusable="false"
    >
      <path d={ICONS[props.name]} fill="currentColor" />
    </svg>
  );
}
