import { invoke } from "@tauri-apps/api/core";

interface NativeHttpResponse {
  status: number;
  status_text: string;
  headers: Record<string, string>;
  body: string;
}

export const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36";

/**
 * 安全且无跨域限制的 HTTP 请求函数
 * 优先调用 Rust 原生 reqwest 命令发送请求，
 * 彻底绕过 WebView 浏览器的 CORS 跨域、OPTIONS 预检、Tauri Resource ID 等所有问题。
 * 在纯浏览器环境下自动平滑降级为原生 fetch。
 */
export async function safeFetch(url: string, init?: RequestInit): Promise<Response> {
  // 1. 如果在 Tauri 环境中，调用原生 Rust 客户端
  if (typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window)) {
    try {
      const headersRecord: Record<string, string> = {};
      if (init?.headers) {
        if (init.headers instanceof Headers) {
          init.headers.forEach((v, k) => {
            headersRecord[k] = v;
          });
        } else if (Array.isArray(init.headers)) {
          for (const [k, v] of init.headers) {
            headersRecord[k] = v;
          }
        } else {
          Object.assign(headersRecord, init.headers);
        }
      }

      // 若未指定 User-Agent，自动注入拟真 Chrome UA
      const hasUa = Object.keys(headersRecord).some(k => k.toLowerCase() === "user-agent");
      if (!hasUa) {
        headersRecord["User-Agent"] = DEFAULT_USER_AGENT;
      }

      let bodyStr: string | undefined = undefined;
      if (init?.body) {
        if (typeof init.body === "string") {
          bodyStr = init.body;
        } else {
          bodyStr = String(init.body);
        }
      }

      const resp = await invoke<NativeHttpResponse>("native_http_request", {
        req: {
          url,
          method: init?.method || "GET",
          headers: headersRecord,
          body: bodyStr,
          timeout_ms: 15000,
        },
      });

      // 封装为标准 Web API Response 对象供上层调用
      return new Response(resp.body, {
        status: resp.status,
        statusText: resp.status_text,
        headers: new Headers(resp.headers),
      });
    } catch (err) {
      console.warn("[safeFetch] Native request failed, falling back to window.fetch:", err);
    }
  }

  // 2. 浏览器直接请求降级
  return await window.fetch(url, init);
}
