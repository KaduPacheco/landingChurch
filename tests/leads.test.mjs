import test from "node:test";
import assert from "node:assert/strict";
import { createLeadHandler, createRateLimiter } from "../lib/lead-handler.js";
import { leadSchema, saveLead, sendLeadToWebhook } from "../lib/leads.js";
import { createApp } from "../lib/app.js";

const validLead = {
  name: "Maria Alves",
  church: "Comunidade Central",
  phone: "(21) 97434-0508",
  email: "maria@example.test",
  size: "Até 100",
  privacyConsent: "yes",
};
function response() {
  return {
    headers: {},
    code: 200,
    setHeader(k, v) {
      this.headers[k] = v;
    },
    status(code) {
      this.code = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
    end() {
      return this;
    },
  };
}
const request = (override = {}) => ({
  method: "POST",
  headers: {
    host: "localhost:3000",
    origin: "http://localhost:3000",
    "content-type": "application/json",
  },
  socket: { remoteAddress: "127.0.0.1" },
  body: validLead,
  ...override,
});
function handler(options = {}) {
  return createLeadHandler({
    client: () => ({}),
    persist: async () => ({ data: { id: "lead-id" } }),
    logger: { error() {} },
    ...options,
    env: { N8N_WEBHOOK_URL: "", ...options.env },
  });
}
async function call(req, options) {
  const res = response();
  await handler(options)(req, res);
  return res;
}

test("validates consent, member range, phone and timestamp", () => {
  assert.equal(leadSchema.safeParse(validLead).success, true);
  for (const patch of [
    { privacyConsent: undefined },
    { size: "any" },
    { phone: "(00) 00000-0000" },
    { phone: "text21974340508" },
    { name: "  " },
    { submittedAt: "yesterday" },
  ]) {
    assert.equal(leadSchema.safeParse({ ...validLead, ...patch }).success, false);
  }
});
test("accepts JSON and saves a server-generated timestamp", async () => {
  let saved;
  const res = await call(
    request({ body: JSON.stringify({ ...validLead, submittedAt: "2001-01-01T00:00:00.000Z" }) }),
    {
      persist: async ({ lead }) => {
        saved = lead;
        return { data: { id: "id" } };
      },
    },
  );
  assert.equal(res.code, 201);
  assert.equal(res.body.ok, true);
  assert.ok(new Date(saved.submittedAt).getTime() > Date.now() - 5000);
});
test("rejects untrusted origins before persistence", async () => {
  let persisted = false;
  const res = await call(
    request({
      headers: {
        host: "localhost:3000",
        origin: "https://evil.test",
        "content-type": "application/json",
      },
    }),
    {
      persist: () => {
        persisted = true;
      },
    },
  );
  assert.equal(res.code, 403);
  assert.equal(persisted, false);
});
test("accepts allowlisted origins and handles preflight", async () => {
  const res = await call(
    request({ method: "OPTIONS", headers: { origin: "https://example.test" } }),
    { env: { ALLOWED_ORIGINS: "https://example.test" } },
  );
  assert.equal(res.code, 204);
  assert.equal(res.headers["Access-Control-Allow-Origin"], "https://example.test");
});
test("supports same-origin Vercel requests", async () => {
  const res = await call(
    request({
      headers: {
        host: "preview.vercel.app",
        origin: "https://preview.vercel.app",
        "content-type": "application/json",
      },
    }),
    { trustPlatformProxy: true },
  );
  assert.equal(res.code, 201);
});
test("rejects unsupported methods, content types, malformed JSON and oversized bodies", async () => {
  assert.equal((await call(request({ method: "GET" }))).code, 405);
  assert.equal((await call(request({ headers: {} }))).code, 415);
  assert.equal((await call(request({ body: "{" }))).code, 400);
  assert.equal(
    (await call(request({ body: JSON.stringify({ extra: "x".repeat(33000) }) }))).code,
    413,
  );
  assert.equal((await call(request({ body: null }))).code, 400);
});
test("honeypot succeeds without contacting storage", async () => {
  const res = await call(request({ body: { companyWebsite: "bot.test" } }), {
    client: () => {
      throw new Error("must not run");
    },
  });
  assert.equal(res.code, 202);
});
test("unavailable storage returns a retryable failure without leaking internals", async () => {
  assert.equal((await call(request(), { client: () => null })).code, 503);
  const res = await call(request(), {
    persist: async () => {
      throw new Error("secret credential");
    },
  });
  assert.equal(res.code, 503);
  assert.ok(!JSON.stringify(res).includes("secret credential"));
});
test("saved leads remain successful when notification and status update fail", async () => {
  let status;
  const res = await call(request(), {
    env: { N8N_WEBHOOK_URL: "https://notify.test" },
    webhook: async () => {
      throw new Error("timeout");
    },
    updateStatus: async (data) => {
      status = data.status;
      throw new Error("database offline");
    },
  });
  assert.equal(res.code, 201);
  assert.equal(status, "failed");
});
test("successful notifications record their delivery status", async () => {
  let status;
  const res = await call(request(), {
    env: { N8N_WEBHOOK_URL: "https://notify.test" },
    webhook: async () => {},
    updateStatus: async (data) => {
      status = data.status;
      return {};
    },
  });
  assert.equal(res.code, 201);
  assert.equal(status, "sent");
});
test("no configured webhook means no outbound notification", async () => {
  const res = await call(request(), {
    webhook: () => {
      throw new Error("must not run");
    },
  });
  assert.equal(res.code, 201);
});
test("legacy notification destination remains compatible when the variable is absent", async () => {
  let destination;
  const res = await call(request(), {
    env: { N8N_WEBHOOK_URL: undefined },
    webhook: async ({ webhookUrl }) => {
      destination = webhookUrl;
    },
    updateStatus: async () => ({}),
  });
  assert.equal(res.code, 201);
  assert.equal(destination, "https://n8n.forteia.com.br/webhook/LandingChurch");
});
test("rate limiter expires buckets and responds with Retry-After", async () => {
  let now = 0;
  const limit = createRateLimiter({ limit: 1, now: () => now });
  const h = handler({ rateLimit: limit });
  await h(request(), response());
  const blocked = response();
  await h(request(), blocked);
  assert.equal(blocked.code, 429);
  assert.equal(blocked.headers["Retry-After"], "900");
  now = 900_001;
  const accepted = response();
  await h(request(), accepted);
  assert.equal(accepted.code, 201);
});
test("direct server does not trust a spoofed forwarded IP", async () => {
  let ip;
  await call(request({ headers: { ...request().headers, "x-forwarded-for": "1.2.3.4" } }), {
    persist: async ({ ipAddress }) => {
      ip = ipAddress;
      return { data: { id: "id" } };
    },
  });
  assert.equal(ip, "127.0.0.1");
});
test("only known campaign fields are retained", () => {
  const parsed = leadSchema.parse({
    ...validLead,
    tracking: { utm_source: "google", arbitrary: "drop" },
    unknown: "drop",
  });
  assert.deepEqual(parsed.tracking, { utm_source: "google" });
  assert.equal(parsed.unknown, undefined);
});
test("persistence retains the contact-consent evidence", async () => {
  let inserted;
  const supabase = {
    from: () => ({
      insert: (data) => {
        inserted = data;
        return { select: () => ({ single: async () => ({ data: { id: "id" } }) }) };
      },
    }),
  };
  await saveLead({ supabase, lead: { ...validLead, submittedAt: "2026-09-29T12:00:00.000Z" } });
  assert.equal(inserted.tracking.privacy_consent, true);
  assert.equal(inserted.tracking.consent_at, "2026-09-29T12:00:00.000Z");
});
test("webhooks require HTTPS before sending any data", async () => {
  await assert.rejects(
    sendLeadToWebhook({ lead: validLead, webhookUrl: "http://notify.test" }),
    /HTTPS/,
  );
});
test("Express serves only public files, matches security policy, and handles invalid JSON", async (t) => {
  const app = createApp({ env: {}, leadHandler: handler() });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const home = await fetch(base);
  assert.equal(home.status, 200);
  assert.match(home.headers.get("content-security-policy"), /frame-ancestors 'none'/);
  for (const path of ["/.env", "/package.json", "/lib/leads.js", "/.git/config"])
    assert.equal((await fetch(base + path)).status, 404);
  for (const path of [
    "/privacidade",
    "/termos",
    "/obrigado",
    "/styles.css",
    "/sitemap.xml",
    "/robots.txt",
  ])
    assert.equal((await fetch(base + path)).status, 200);
  const malformed = await fetch(base + "/api/leads", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{",
  });
  assert.equal(malformed.status, 400);
  assert.equal((await malformed.json()).error, "JSON inválido.");
  const tooLarge = await fetch(base + "/api/leads", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ data: "x".repeat(34000) }),
  });
  assert.equal(tooLarge.status, 413);
});
