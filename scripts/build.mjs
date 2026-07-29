import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { staticFiles, verifyBuildFiles } from "./verify-build.mjs";

const outputDir = "dist";

function readAnalyticsId(name, pattern) {
  const value = process.env[name]?.trim() || "";
  if (value && !pattern.test(value)) throw new Error(`${name} has an invalid format.`);
  return value;
}

function writeAnalyticsConfig() {
  const gtmId = readAnalyticsId("GTM_ID", /^GTM-[A-Z0-9]+$/);
  const ga4Id = readAnalyticsId("GA4_ID", /^G-[A-Z0-9]+$/);
  const metaPixelId = readAnalyticsId("META_PIXEL_ID", /^\d{8,20}$/);
  const directSetting = process.env.ANALYTICS_DIRECT_FORWARDING?.trim().toLowerCase();

  if (directSetting && !["true", "false"].includes(directSetting)) {
    throw new Error("ANALYTICS_DIRECT_FORWARDING must be true or false.");
  }
  if (!gtmId && !ga4Id && !metaPixelId) return;

  const directEventForwarding = directSetting
    ? directSetting === "true"
    : !gtmId;
  const config = `window.SIMPLECHURCH_ANALYTICS = ${JSON.stringify({
    gtmId,
    ga4Id,
    metaPixelId,
    directEventForwarding,
  }, null, 2)};\n`;

  writeFileSync(join(outputDir, "analytics-config.js"), config, "utf8");
  console.log("Analytics configuration generated from environment variables.");
}

verifyBuildFiles();
rmSync(outputDir, { recursive: true, force: true });
mkdirSync(outputDir, { recursive: true });

for (const file of staticFiles) {
  const target = join(outputDir, file);
  mkdirSync(dirname(target), { recursive: true });
  cpSync(file, target, { recursive: true });
}

writeAnalyticsConfig();
console.log(`Build output generated in ${outputDir}.`);