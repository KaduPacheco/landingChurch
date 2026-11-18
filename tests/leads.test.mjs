import test from "node:test";
import assert from "node:assert/strict";
import { createLeadHandler, createRateLimiter } from "../lib/lead-handler.js";
import { leadSchema, sendLeadToWebhook } from "../lib/leads.js";
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
    webhook: async () => {},
    logger: { error() {} },
    ...options,
    env: {
      N8N_WEBHOOK_URL: "https://notify.test",
      N8N_WEBHOOK_TOKEN: "test-token",
      ...options.env,
    },
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
test("only known campaign fields are retained", () => {
  const parsed = leadSchema.parse({
    ...validLead,
    tracking: { utm_source: "google", arbitrary: "drop" },
    unknown: "drop",
  });
  assert.deepEqual(parsed.tracking, { utm_source: "google" });
  assert.equal(parsed.unknown, undefined);
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

test("only three contact fields and explicit consent are required", () => {
  const minimal = {
    name: "Maria",
    church: "Igreja Central",
    phone: "21974340508",
    privacyConsent: "yes",
  };
  assert.equal(leadSchema.safeParse(minimal).success, true);
  assert.equal(leadSchema.safeParse({ ...minimal, email: "", size: "" }).success, true);
  assert.equal(leadSchema.safeParse({ ...minimal, email: "invalid" }).success, false);
  assert.equal(leadSchema.safeParse({ ...minimal, requestId: "invalid" }).success, false);
});
test("sends directly to webhook with UUID, server timestamp and consent; no Supabase config", async () => {
  let sent;
  const before = Date.now();
  const res = await call(
    request({
      body: JSON.stringify({
        ...validLead,
        source: "spoof",
        submittedAt: "2001-01-01T00:00:00.000Z",
      }),
    }),
    {
      webhook: async (args) => {
        sent = args;
      },
    },
  );
  assert.equal(res.code, 201);
  assert.equal(res.body.id, sent.leadId);
  assert.match(sent.leadId, /^[0-9a-f-]{36}$/);
  assert.equal(sent.lead.source, "landing_simplechurch");
  assert.ok(Date.parse(sent.lead.submittedAt) >= before);
  assert.equal(sent.lead.privacyConsent, "yes");
  assert.equal(sent.webhookToken, "test-token");
});
test("keeps the same id on retries for workflow deduplication", async () => {
  const requestId = "18c293df-4e9c-4ec3-8029-485d29291d84";
  let sent;
  const res = await call(request({ body: { ...validLead, requestId } }), {
    webhook: async (args) => {
      sent = args;
    },
  });
  assert.equal(res.body.id, requestId);
  assert.equal(sent.leadId, requestId);
});
test("missing configuration never contacts a legacy URL or reports success", async () => {
  for (const env of [
    { N8N_WEBHOOK_URL: undefined },
    { N8N_WEBHOOK_URL: "" },
    { N8N_WEBHOOK_TOKEN: "" },
  ]) {
    let called = false;
    const res = await call(request(), {
      env,
      webhook: async () => {
        called = true;
      },
    });
    assert.equal(res.code, 503);
    assert.equal(called, false);
    assert.notEqual(res.body.ok, true);
  }
});
test("webhook timeout/failure is an unconfirmed registration, not success", async () => {
  const res = await call(request(), {
    webhook: async () => {
      throw new Error("secret credential");
    },
  });
  assert.equal(res.code, 503);
  assert.notEqual(res.body.ok, true);
  assert.ok(!JSON.stringify(res).includes("secret credential"));
});
test("untrusted origins and honeypots never contact the webhook", async () => {
  for (const req of [
    request({ headers: { ...request().headers, origin: "https://evil.test" } }),
    request({ body: { companyWebsite: "bot.test" } }),
  ]) {
    let called = false;
    const res = await call(req, {
      webhook: async () => {
        called = true;
      },
    });
    assert.ok([400, 403].includes(res.code));
    assert.equal(called, false);
  }
});
test("direct Express does not trust a spoofed forwarded IP", async () => {
  let ip;
  await call(request({ headers: { ...request().headers, "x-forwarded-for": "1.2.3.4" } }), {
    rateLimit: (key) => {
      ip = key;
      return 0;
    },
  });
  assert.equal(ip, "127.0.0.1");
});
test("webhook sends authenticated compatible payload and consent evidence", async () => {
  let options;
  await sendLeadToWebhook({
    lead: { ...validLead, submittedAt: "2026-11-16T12:00:00.000Z" },
    leadId: "test-id",
    webhookUrl: "https://notify.test",
    webhookToken: "test-token",
    fetchImpl: async (_url, args) => {
      options = args;
      return { ok: true, json: async () => ({ ok: true, id: "test-id" }) };
    },
  });
  const payload = JSON.parse(options.body);
  assert.equal(options.headers.Authorization, "Bearer test-token");
  assert.equal(options.headers["Idempotency-Key"], "test-id");
  assert.equal(options.redirect, "error");
  assert.equal(payload.id, "test-id");
  assert.equal(payload.name, validLead.name);
  assert.equal(payload.privacyConsent, "yes");
  assert.equal(payload.tracking.privacy_consent, true);
  assert.equal(payload.tracking.consent_at, payload.submittedAt);
});
test("generic 2xx, mismatched acknowledgement and upstream errors do not count as registered", async () => {
  const args = {
    lead: validLead,
    leadId: "test-id",
    webhookUrl: "https://notify.test",
    webhookToken: "test-token",
  };
  for (const reply of [
    { ok: false },
    { ok: true, json: async () => ({ message: "Workflow was started" }) },
    { ok: true, json: async () => ({ ok: true, id: "wrong" }) },
    {
      ok: true,
      json: async () => {
        throw new Error("Invalid JSON");
      },
    },
  ]) {
    await assert.rejects(sendLeadToWebhook({ ...args, fetchImpl: async () => reply }));
  }
  await assert.rejects(sendLeadToWebhook({ ...args, webhookToken: "" }), /authentication/);
});

test("legacy notification confirms matching protocol and member range without invented auth", async () => {
  const id = "55e39435-1874-49fc-a65a-02bc3273bd77";
  const options = {
    lead: validLead,
    leadId: id,
    webhookUrl: "https://example.test/webhook",
    webhookMode: "legacy_notification",
  };
  await sendLeadToWebhook({
    ...options,
    fetchImpl: async (_url, request) => {
      assert.equal(request.headers.Authorization, undefined);
      assert.equal(JSON.parse(request.body).quantidadeMembros, validLead.size);
      return { ok: true, json: async () => ({ ok: true, protocolo: id }) };
    },
  });
  await assert.rejects(
    sendLeadToWebhook({
      ...options,
      fetchImpl: async () => ({ ok: true, json: async () => ({ ok: true, protocolo: "wrong" }) }),
    }),
  );
  await assert.rejects(sendLeadToWebhook({ ...options, webhookMode: undefined }));
});
