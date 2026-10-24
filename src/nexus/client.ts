/**
 * Nexus GraphQL v2 传输层（最底层）
 * ---------------------------------------------------------------------------
 * 为什么用 Node 的 `https` 而不是 `fetch`：
 *   Vortex 主窗口 `webPreferences.webSecurity` 默认为 true，渲染进程的 fetch 受同源策略约束，
 *   而 Nexus 的 GraphQL 端点并未给浏览器直连做 CORS 承诺。扩展运行在开启 nodeIntegration 的
 *   渲染进程里，用 Node 的 https 模块可以完全绕开 CORS，并且能自由设置 `apikey` 头。
 *
 * 该层只负责：拼请求 → 发出去 → 解析 JSON → 归一化错误。不含任何业务逻辑。
 */

import * as https from "https";

import { GRAPHQL_ENDPOINT, REQUEST_TIMEOUT_MS } from "../constants";
import { t } from "../i18n";
import { INexusError } from "../types";

/**
 * 把 GraphQL 的 errors[] 归一化成带 code 的 Error。
 * Nexus 的约定：HTTP 200 + errors[]，`extensions.code` 里是机器可读的代码。
 */
function toNexusError(message: string, errors?: any[]): INexusError {
  const first = errors && errors.length > 0 ? errors[0] : undefined;
  const err = new Error(message) as INexusError;
  err.name = "NexusError";
  err.code = first?.extensions?.code;
  err.errors = errors;
  return err;
}

/** 把 code 翻成人话，给 UI 直接用 */
export function describeError(err: INexusError): string {
  switch (err.code) {
    case "UNAUTHORIZED":
      return t("error.login");
    case "ADULT_CONTENT_BLOCKED":
      return t("error.adult");
    case "NOT_FOUND":
      return t("error.notFound");
    case "undefinedField":
    case "argumentNotAccepted":
      return t("error.schema", { code: err.code });
    default:
      return err.message || t("error.generic");
  }
}

interface IRawResponse {
  status: number;
  text: string;
}

/** 发一个 POST，返回原始文本（不做 JSON 解析） */
function postJson(body: string, apiKey: string | undefined): Promise<IRawResponse> {
  return new Promise<IRawResponse>((resolve, reject) => {
    const request = https.request(
      {
        hostname: "api.nexusmods.com",
        port: 443,
        path: "/v2/graphql",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
          // 加 UA 便于 Nexus 侧识别来源，也符合 API 使用政策的"可识别客户端"要求
          "User-Agent": "Vortex-NexusModBrowser/0.1.0",
          ...(apiKey ? { apikey: apiKey } : {}),
        },
      },
      (res) => {
        const chunks: any[] = [];
        res.on("data", (chunk: any) => {
          if (chunk !== undefined) {
            chunks.push(chunk);
          }
        });
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          resolve({ status: res.statusCode ?? 0, text });
        });
        res.on("error", (err: any) => reject(err));
      },
    );

    request.on("error", (err: any) => reject(err));
    request.setTimeout(REQUEST_TIMEOUT_MS, () => {
      request.destroy();
      reject(toNexusError(t("error.timeout")));
    });
    request.write(body);
    request.end();
  });
}

/**
 * 执行一次 GraphQL 查询。
 *
 * @param query     GraphQL 查询字符串（见 queries.ts）
 * @param variables 变量对象
 * @param apiKey    用户的 Nexus API Key；匿名调用时传 undefined（大部分查询仍可用）
 * @returns         `data` 部分
 * @throws          INexusError（带 code / errors）
 */
export async function graphql<T>(
  query: string,
  variables: { [key: string]: any },
  apiKey?: string,
): Promise<T> {
  const body = JSON.stringify({ query, variables });

  let raw: IRawResponse;
  try {
    raw = await postJson(body, apiKey);
  } catch (err) {
    if (err instanceof Error && err.name === "NexusError") {
      throw err;
    }
    throw toNexusError(
      t("error.connect", { message: (err as Error)?.message ?? String(err) }),
    );
  }

  if (raw.status < 200 || raw.status >= 300) {
    // 429 单独提示，方便用户理解（Nexus 有限流）
    if (raw.status === 429) {
      throw toNexusError(t("error.rateLimit"));
    }
    if (raw.status === 403) {
      throw toNexusError(t("error.forbidden"));
    }
    throw toNexusError(
      t("error.http", { status: raw.status, body: raw.text.slice(0, 300) }),
    );
  }

  let parsed: any;
  try {
    parsed = JSON.parse(raw.text);
  } catch {
    throw toNexusError(t("error.nonJson", { body: raw.text.slice(0, 200) }));
  }

  if (parsed.errors && parsed.errors.length > 0) {
    throw toNexusError(parsed.errors[0]?.message ?? t("error.generic"), parsed.errors);
  }

  if (parsed.data === undefined || parsed.data === null) {
    throw toNexusError(t("error.empty"));
  }

  return parsed.data as T;
}

export { GRAPHQL_ENDPOINT };

