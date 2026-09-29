import { accessSync, constants, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { securityHeaders } from "../lib/security.js";

export const repoRoot = dirname(fileURLToPath(new URL("../package.json", import.meta.url)));

export const staticFiles = [
  "index.html",
  "obrigado.html",
  "privacidade.html",
  "termos.html",
  "styles.css",
  "script.js",
  "analytics.js",
  "analytics-config.js",
  "robots.txt",
  "sitemap.xml",
  "assets/favicon.svg",
  "assets/favicon-32.png",
  "assets/apple-touch-icon.png",
  "assets/simplechurch-symbol.svg",
  "assets/simplechurch-logo.svg",
  "assets/product-admin-preview.svg",
  "assets/product-member-preview.svg",
  "assets/og-simplechurch.png",
  "assets/simplechurch-icon-light.png",
  "assets/simplechurch-icon-dark.png",
  "assets/simplechurch-icon-light-128.png",
  "assets/simplechurch-icon-dark-128.png",
  "assets/simplechurch-logo-principal.png",
];

export const requiredFiles = [
  ...staticFiles,
  "api/leads.js",
  "lib/leads.js",
  "lib/lead-handler.js",
  "lib/security.js",
  "vercel.json",
];

export function verifyBuildFiles() {
  for (const file of requiredFiles) {
    accessSync(join(repoRoot, file), constants.R_OK);
  }
  const config = JSON.parse(readFileSync(join(repoRoot, "vercel.json"), "utf8"));
  if (JSON.stringify(config.headers[0].headers) !== JSON.stringify(securityHeaders))
    throw new Error("Express and Vercel security headers must match.");
  for (const file of staticFiles.filter((file) => file.endsWith(".html"))) {
    const html = readFileSync(join(repoRoot, file), "utf8");
    if ((html.match(/<h1\b/g) || []).length !== 1)
      throw new Error(`${file}: exactly one h1 is required.`);
    for (const [, ref] of html.matchAll(/(?:src|href)="([^"#]+)"/g)) {
      if (/^(https?:|mailto:|data:)/.test(ref)) continue;
      const local = ref.split(/[?#]/)[0].replace(/^\//, "");
      const asset = local || "index.html";
      const mapped = ["privacidade", "termos", "obrigado"].includes(asset)
        ? `${asset}.html`
        : asset;
      if (!staticFiles.includes(mapped)) throw new Error(`${file}: missing public asset ${mapped}`);
    }
    for (const [, json] of html.matchAll(
      /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g,
    ))
      JSON.parse(json);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  verifyBuildFiles();
  console.log("Build check passed.");
}
