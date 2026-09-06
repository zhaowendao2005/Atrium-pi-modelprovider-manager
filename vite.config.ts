import { defineConfig, type Plugin } from "vite";
import vue from "@vitejs/plugin-vue";
import path from "node:path";
import http from "node:http";
import https from "node:https";

function devCorsProxyPlugin(): Plugin {
  return {
    name: "dev-cors-proxy",
    configureServer(server) {
      server.middlewares.use("/api-proxy", (req, res) => {
        const urlObj = new URL(req.url || "", "http://localhost:8632");
        const targetUrl = urlObj.searchParams.get("url");
        if (!targetUrl) {
          res.statusCode = 400;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Missing url parameter" }));
          return;
        }

        try {
          const parsed = new URL(targetUrl);
          const client = parsed.protocol === "https:" ? https : http;

          const forwardHeaders: Record<string, string> = {};
          for (const [k, v] of Object.entries(req.headers)) {
            if (["authorization", "x-api-key", "anthropic-version", "content-type"].includes(k.toLowerCase()) && v) {
              forwardHeaders[k] = Array.isArray(v) ? v[0] : v;
            }
          }
          forwardHeaders["User-Agent"] =
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36";
          forwardHeaders["Accept"] = "application/json";

          const proxyReq = client.request(
            targetUrl,
            {
              method: req.method || "GET",
              headers: forwardHeaders,
              timeout: 10000,
            },
            (proxyRes) => {
              res.setHeader("Access-Control-Allow-Origin", "*");
              res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
              res.setHeader("Access-Control-Allow-Headers", "*");
              res.setHeader("Content-Type", proxyRes.headers["content-type"] || "application/json");
              res.statusCode = proxyRes.statusCode || 200;
              proxyRes.pipe(res);
            }
          );

          proxyReq.on("error", (err) => {
            res.setHeader("Access-Control-Allow-Origin", "*");
            res.statusCode = 502;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: err.message }));
          });

          proxyReq.end();
        } catch (err: any) {
          res.setHeader("Access-Control-Allow-Origin", "*");
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: err.message }));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [vue(), devCorsProxyPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: "dist/ui",
    emptyOutDir: true,
  },
  server: {
    port: 8632,
    strictPort: true,
  },
  clearScreen: false,
});
