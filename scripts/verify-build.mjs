import { accessSync, constants } from "node:fs";
import { fileURLToPath } from "node:url";

export const staticFiles = [
  "index.html",
  "obrigado.html",
  "privacidade.html",
  "termos.html",
  "styles.css",
  "script.js",
  "analytics.js",
  "analytics-config.js",
  "assets/favicon.svg",
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
  "vercel.json",
];

export function verifyBuildFiles() {
  for (const file of requiredFiles) {
    accessSync(file, constants.R_OK);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  verifyBuildFiles();
  console.log("Build check passed.");
}