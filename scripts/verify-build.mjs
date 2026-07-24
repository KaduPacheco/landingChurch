import { accessSync, constants } from "node:fs";

const requiredFiles = [
  "index.html",
  "obrigado.html",
  "styles.css",
  "script.js",
  "analytics.js",
  "analytics-config.js",
  "api/leads.js",
  "lib/leads.js",
  "vercel.json",
  "assets/favicon.svg",
  "assets/og-simplechurch.png",
];

for (const file of requiredFiles) {
  accessSync(file, constants.R_OK);
}

console.log("Build check passed.");
