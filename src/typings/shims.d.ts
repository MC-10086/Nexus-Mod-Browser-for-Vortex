/**
 * 极简类型声明（shim）
 * ---------------------------------------------------------------------------
 * 本项目刻意不依赖 `@types/react` / `@types/node`，原因：
 * 目标机器可能没有网络，而 VS Code 自带 TypeScript 编译器可以直接离线编译。
 * 这里只声明我们真正用到的 React / Node API 子集，类型为宽泛的 any，够用即可。
 *
 * 注意：这是一个全局声明文件（没有 import / export），因此 `JSX` 命名空间是全局的。
 */

declare const require: (id: string) => any;
declare const __dirname: string;
declare const __filename: string;
declare const module: any;
declare const process: any;

declare const Buffer: {
  byteLength(input: string): number;
  from(input: any, encoding?: string): any;
  concat(list: any[], totalLength?: number): any;
};

declare module "https" {
  export interface IRequestOptions {
    hostname: string;
    port?: number;
    path: string;
    method?: string;
    headers?: { [key: string]: string | number };
    timeout?: number;
  }
  export interface IIncomingMessage {
    statusCode?: number;
    headers: { [key: string]: string | string[] | undefined };
    on(event: string, cb: (chunk?: any) => void): void;
    setEncoding(enc: string): void;
  }
  export interface IClientRequest {
    on(event: string, cb: (err: any) => void): void;
    write(chunk: string): void;
    end(): void;
    destroy(): void;
    setTimeout(ms: number, cb: () => void): void;
  }
  export function request(
    options: IRequestOptions,
    callback: (res: IIncomingMessage) => void,
  ): IClientRequest;
}

declare module "react" {
  export function createElement(
    type: any,
    props?: any,
    ...children: any[]
  ): any;

  export function useState<S>(
    initial: S | (() => S),
  ): [S, (value: S | ((prev: S) => S)) => void];

  export function useEffect(
    effect: () => void | (() => void),
    deps?: any[],
  ): void;

  export function useMemo<T>(factory: () => T, deps: any[]): T;

  export function useRef<T>(initial: T): { current: T };

  const React: {
    createElement: typeof createElement;
    useState: typeof useState;
    useEffect: typeof useEffect;
    useMemo: typeof useMemo;
    useRef: typeof useRef;
  };
  export default React;
}

declare namespace JSX {
  interface Element {}
  interface IntrinsicAttributes {
    key?: any;
  }
  interface ElementChildrenAttribute {
    children: {};
  }
  interface IntrinsicElements {
    [elemName: string]: any;
  }
}

/**
 * 宿主在运行时提供的模块（由 Vortex 注入，不需要安装）。
 * Vortex 劫持了 Module.prototype.require，扩展里 require("@nexusmods/vortex-api")
 * 会拿到宿主内部 api 模块的 Proxy，因此这些导入在真实环境可用。
 * 这里只声明我们真正用到的成员，类型从宽（any），避免引入完整类型包。
 */
declare module "@nexusmods/vortex-api" {
  /** 页面外壳：<MainPage><MainPage.Body>…</MainPage.Body></MainPage> */
  export const MainPage: any;

  /** 宿主的 BBCode / 纯文本工具 */
  export const util: any;

  /** 宿主自带的点击放大控件（props: { className, url, container?, overlayClass? }） */
  export const ZoomableImage: any;
}
