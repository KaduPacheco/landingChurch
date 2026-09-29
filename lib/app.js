import express from "express";
import helmet from "helmet";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createLeadHandler } from "./lead-handler.js";
import { securityHeaders } from "./security.js";

const root = fileURLToPath(new URL("../", import.meta.url));

export function createApp({ env = process.env, leadHandler } = {}) {
  const app = express();
  app.disable("x-powered-by");
  if (env.TRUST_PROXY_HOPS) app.set("trust proxy", Number(env.TRUST_PROXY_HOPS));
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use((_req, res, next) => {
    for (const { key, value } of securityHeaders) res.setHeader(key, value);
    next();
  });
  app.get("/health", (_req, res) => res.json({ ok: true }));
  app.use("/api/leads", express.json({ limit: "32kb" }));
  app.all("/api/leads", leadHandler || createLeadHandler({ env }));
  const staticRoot =
    env.NODE_ENV === "production" && existsSync(path.join(root, "dist/index.html"))
      ? path.join(root, "dist")
      : root;
  const pages = new Map([
    ["/", "index.html"],
    ["/index", "index.html"],
    ["/index.html", "index.html"],
  ]);
  for (const page of ["privacidade", "termos", "obrigado"]) {
    pages.set(`/${page}`, `${page}.html`);
    pages.set(`/${page}.html`, `${page}.html`);
  }
  for (const file of [
    "styles.css",
    "script.js",
    "analytics.js",
    "analytics-config.js",
    "robots.txt",
    "sitemap.xml",
  ])
    pages.set(`/${file}`, file);
  app.use(
    "/assets",
    express.static(path.join(staticRoot, "assets"), {
      dotfiles: "deny",
      index: false,
      maxAge: "1d",
    }),
  );
  app.get([...pages.keys()], (req, res) =>
    res.sendFile(path.join(staticRoot, pages.get(req.path))),
  );
  app.use((_req, res) => res.status(404).type("text").send("Página não encontrada."));
  app.use((error, _req, res, _next) => {
    const status =
      error.type === "entity.too.large" ? 413 : error.type === "entity.parse.failed" ? 400 : 500;
    res.status(status).json({
      error:
        status === 413
          ? "Solicitação muito grande."
          : status === 400
            ? "JSON inválido."
            : "Erro interno.",
    });
  });
  return app;
}
