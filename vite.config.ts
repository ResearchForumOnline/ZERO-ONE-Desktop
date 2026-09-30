import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { createRequire } from "node:module";
const localRequire = createRequire(import.meta.url);

export default defineConfig({
  plugins: [react(), {
    name: "local-zerothink-development",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/api/dev-zerothink", async (request, response) => {
        response.setHeader("Content-Type", "application/json");
        try {
          if (request.headers.origin && request.headers.origin !== "http://127.0.0.1:5173") throw new Error("Use the loopback development origin.");
          const engine = localRequire("./electron/zerothink/engine.cjs");
          if (request.url === "/processes" && request.method === "GET") {
            response.end(JSON.stringify(engine.getProcesses().map((entry: { id: string; name: string; purpose: string; stages: string[]; checks: string[] }) => ({ id: entry.id, label: entry.name, description: entry.purpose, stages: entry.stages, checks: entry.checks }))));
            return;
          }
          if (request.url !== "/run" || request.method !== "POST") { response.statusCode = 404; response.end("{}"); return; }
          const chunks: Buffer[] = []; let length = 0;
          for await (const chunk of request) { const value = Buffer.from(chunk); length += value.length; if (length > 3 * 1024 * 1024) throw new Error("Request exceeds the development limit."); chunks.push(value); }
          const raw = JSON.parse(Buffer.concat(chunks).toString("utf8"));
          if (raw.useModel) throw new Error("Model runs and secure notes require the desktop app. This development view runs the actual offline research engine.");
          const { normalizeResearchRequest } = localRequire("./electron/zerothink-desktop.cjs");
          response.end(JSON.stringify(await engine.runResearch(normalizeResearchRequest(raw))));
        } catch (error) { response.statusCode = 400; response.end(JSON.stringify({ error: error instanceof Error ? error.message : "Research could not run." })); }
      });
    },
  }],
  base: "./",
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: "dist",
    sourcemap: false,
  },
});
