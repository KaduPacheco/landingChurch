import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { createApp } from "../lib/app.js";

let server;
if (!process.env.TEST_BASE_URL) {
  server = createApp({ env: {} }).listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
}
const base = process.env.TEST_BASE_URL || `http://127.0.0.1:${server.address().port}`;
const browser = process.env.TEST_CDP_URL
  ? await chromium.connectOverCDP(process.env.TEST_CDP_URL)
  : await chromium.launch({
      channel: process.env.TEST_BROWSER_EXECUTABLE
        ? undefined
        : process.env.TEST_BROWSER_CHANNEL || "chrome",
      executablePath: process.env.TEST_BROWSER_EXECUTABLE,
      headless: true,
    });
const context = await browser.newContext();
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
mkdirSync("visual-validation", { recursive: true });
const report = { layouts: [], accessibility: [], flows: [] };

try {
  for (const width of [320, 375, 430, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(base, { waitUntil: "networkidle" });
    const layout = await page.evaluate(() => ({
      width: innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      brokenAnchors: [...document.querySelectorAll('a[href^="#"]')]
        .map((a) => a.getAttribute("href"))
        .filter((href) => href.length > 1 && !document.getElementById(href.slice(1))),
    }));
    report.layouts.push(layout);
    assert.ok(layout.scrollWidth <= width, `Overflow at ${width}px: ${layout.scrollWidth}`);
    assert.deepEqual(layout.brokenAnchors, []);
    const productImages = await page
      .locator(".product-screen-frame img")
      .evaluateAll((images) =>
        images.map((image) => ({ complete: image.complete, width: image.naturalWidth })),
      );
    assert.equal(productImages.length, 2);
    assert.ok(productImages.every((image) => image.complete && image.width > 0));
    await page.screenshot({ path: `visual-validation/premium-${width}.png`, fullPage: true });
    if ([375, 1440].includes(width))
      await page.screenshot({ path: `visual-validation/premium-hero-${width}.png` });
    if ([375, 1440].includes(width)) {
      await page.locator("#produto").scrollIntoViewIfNeeded();
      await page.evaluate(() => document.activeElement?.blur());
      await page.locator("#produto").screenshot({
        path: `visual-validation/premium-product-${width}.png`,
      });
    }
    if ([375, 1440].includes(width)) {
      const a11y = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      report.accessibility.push({
        width,
        violations: a11y.violations.map((v) => ({
          id: v.id,
          impact: v.impact,
          nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })),
        })),
      });
    }
  }
  await page.setViewportSize({ width: 375, height: 812 });
  await page.locator("[data-menu-toggle]").click();
  assert.equal(await page.locator("[data-menu-toggle]").getAttribute("aria-expanded"), "true");
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("[data-menu-toggle]").getAttribute("aria-expanded"), "false");
  await page.locator('[data-cta-location="hero"]').click();
  await page.waitForFunction(() => window.location.hash === "#demonstracao");
  assert.equal(await page.locator("[data-demo-form]").isVisible(), true);
  report.flows.push("hero CTA reaches the demo form");
  await page.locator("#faq-button-1").click();
  assert.equal(await page.locator("#faq-button-1").getAttribute("aria-expanded"), "true");
  assert.equal(await page.locator("#faq-1").isVisible(), true);
  await page.locator("#faq-button-7").click();
  assert.equal(await page.locator("#faq-button-7").getAttribute("aria-expanded"), "true");
  assert.equal(await page.locator("#faq-7").isVisible(), true);
  report.flows.push("mobile menu, Escape, FAQ, ease-of-use objection");
  await page.locator("[data-demo-submit]").click();
  assert.equal(await page.locator("#lead-name").getAttribute("aria-invalid"), "true");
  assert.equal(
    await page.locator("#lead-name").evaluate((el) => el === document.activeElement),
    true,
  );
  await page.locator("#lead-name").fill("Maria Teste");
  await page.locator("#lead-phone").fill("+55 21 97434-0508");
  await page.locator("#lead-church").fill("Comunidade Teste");
  await page.locator("#lead-email").fill("teste@example.test");
  await page.locator("#lead-size").selectOption("Até 100");
  await page.locator('[name="privacyConsent"]').check();
  assert.equal(await page.locator("#lead-phone").inputValue(), "(21) 97434-0508");
  let submissions = 0;
  await page.route("**/api/leads", async (route) => {
    submissions += 1;
    if (submissions === 1)
      return route.fulfill({
        status: 503,
        contentType: "application/json",
        body: '{"error":"unavailable"}',
      });
    assert.equal(route.request().postDataJSON().privacyConsent, "yes");
    return route.fulfill({ status: 201, contentType: "application/json", body: '{"ok":true}' });
  });
  await page.locator("[data-demo-submit]").click();
  await page.waitForFunction(
    () => document.querySelector("[data-demo-status]").dataset.status === "error",
  );
  assert.equal(await page.locator("#lead-name").inputValue(), "Maria Teste");
  assert.equal(await page.locator("[data-demo-submit]").isEnabled(), true);
  await page.locator("[data-demo-submit]").click();
  await page.waitForURL("**/obrigado");
  assert.equal(submissions, 2);
  report.flows.push(
    "validation, +55 phone, error preserves fields, retry, success redirect (mock API)",
  );
  for (const route of ["/obrigado", "/privacidade", "/termos"]) {
    await page.goto(base + route);
    assert.equal(await page.locator("h1").count(), 1);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: `visual-validation/premium${route}-375.png`, fullPage: true });
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    report.accessibility.push({
      route,
      violations: result.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })),
      })),
    });
  }
  let externalAnalytics = 0;
  await page.route("**/analytics-config.js", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: 'window.SIMPLECHURCH_ANALYTICS={ga4Id:"G-TEST12345",directEventForwarding:true};',
    }),
  );
  await page.route("https://www.googletagmanager.com/**", (route) => {
    externalAnalytics++;
    return route.fulfill({ contentType: "application/javascript", body: "" });
  });
  await page.goto(base);
  assert.equal(externalAnalytics, 0);
  await page.getByRole("button", { name: "Só essenciais" }).click();
  await page.reload();
  assert.equal(externalAnalytics, 0);
  assert.equal(await page.locator(".cookie-banner").count(), 0);
  await page.locator("[data-privacy-settings]").click();
  await page.getByRole("button", { name: "Aceitar opcionais" }).click();
  await page.waitForFunction(() => window.SimpleChurchPrivacy.allowed());
  await page.waitForFunction(() =>
    [...document.scripts].some((s) => s.src.includes("googletagmanager.com")),
  );
  assert.equal(
    await page.evaluate(() => localStorage.getItem("simplechurch_privacy_v1")),
    "accepted",
  );
  await page.locator("[data-privacy-settings]").click();
  await page.getByRole("button", { name: "Só essenciais" }).click();
  await page.waitForLoadState("networkidle");
  assert.equal(await page.evaluate(() => window.SimpleChurchPrivacy.allowed()), false);
  report.flows.push("analytics blocked before consent, refusal persists, opt-in, withdrawal");
  assert.deepEqual(errors, []);
  report.pageErrors = errors;
} finally {
  writeFileSync("visual-validation/report.json", JSON.stringify(report, null, 2));
  console.log(
    JSON.stringify(
      {
        layouts: report.layouts,
        flows: report.flows,
        accessibility: report.accessibility.map(({ width, route, violations }) => ({
          width,
          route,
          violations: violations.map((v) => ({ id: v.id, nodes: v.nodes.length })),
        })),
        pageErrors: report.pageErrors,
      },
      null,
      2,
    ),
  );
  await context.close();
  await browser.close();
  if (server) await new Promise((resolve) => server.close(resolve));
}
assert.equal(
  report.accessibility.reduce((sum, page) => sum + page.violations.length, 0),
  0,
  "Accessibility violations; see visual-validation/report.json",
);
