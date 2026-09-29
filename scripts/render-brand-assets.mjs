import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";

const browser = await chromium.launch({
  executablePath: process.env.TEST_BROWSER_EXECUTABLE,
  headless: true,
});
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  const jobs = [
    ["favicon.svg", "favicon-32.png", 32, 32],
    ["favicon.svg", "apple-touch-icon.png", 180, 180],
    ["favicon.svg", "simplechurch-icon-dark-128.png", 128, 128],
    ["favicon.svg", "simplechurch-icon-light-128.png", 128, 128],
    ["favicon.svg", "simplechurch-icon-dark.png", 512, 512],
    ["favicon.svg", "simplechurch-icon-light.png", 512, 512],
    ["simplechurch-logo.svg", "simplechurch-logo-principal.png", 1520, 320],
    ["og-simplechurch.svg", "og-simplechurch.png", 1200, 630],
  ];
  for (const [source, target, width, height] of jobs) {
    await page.setViewportSize({ width, height });
    await page.setContent(
      `<style>html,body{margin:0;background:#03182b}svg{display:block;width:100vw;height:100vh}</style>${readFileSync(`assets/${source}`, "utf8")}`,
    );
    await page.screenshot({ path: `assets/${target}` });
  }
} finally {
  await browser.close();
}
