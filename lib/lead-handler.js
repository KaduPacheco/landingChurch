import { isIP } from "node:net";
import { randomUUID } from "node:crypto";
import { leadSchema, sendLeadToWebhook } from "./leads.js";

const MAX_BODY_BYTES = 32 * 1024;
const WINDOW_MS = 15 * 60 * 1000;

// Per-process protection. Use a platform WAF/shared store for a global limit.
export function createRateLimiter({ limit = 12, now = Date.now } = {}) {
  const buckets = new Map();
  return (key) => {
    const time = now();
    for (const [ip, bucket] of buckets) if (bucket.resetAt <= time) buckets.delete(ip);
    if (!buckets.has(key)) {
      if (buckets.size >= 10_000) return 60;
      buckets.set(key, { count: 0, resetAt: time + WINDOW_MS });
    }
    const bucket = buckets.get(key);
    bucket.count += 1;
    return bucket.count > limit ? Math.ceil((bucket.resetAt - time) / 1000) : 0;
  };
}

export function createLeadHandler({
  env = process.env,
  webhook = sendLeadToWebhook,
  trustPlatformProxy = false,
  rateLimit = createRateLimiter(),
  logger = console,
} = {}) {
  const allowedOrigins = (env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const webhookUrl = env.N8N_WEBHOOK_URL?.trim();
  return async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Vary", "Origin");
    const origin = req.headers.origin;
    if (origin) {
      let sameOrigin = false;
      try {
        const parsed = new URL(origin);
        const protocol = req.protocol || (trustPlatformProxy ? "https" : "http");
        sameOrigin = parsed.origin === `${protocol}://${req.headers.host}`;
      } catch {
        /* Invalid origins are rejected. */
      }
      if (!sameOrigin && !allowedOrigins.includes(origin))
        return res.status(403).json({ error: "Origem não permitida." });
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    }
    if (req.method === "OPTIONS") return res.status(204).end();
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST, OPTIONS");
      return res.status(405).json({ error: "Método não permitido." });
    }
    const forwarded = trustPlatformProxy
      ? req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim()
      : null;
    const candidate = forwarded || req.ip || req.socket?.remoteAddress;
    const ipAddress = candidate && isIP(candidate) ? candidate : undefined;
    const retryAfter = rateLimit(ipAddress || "unknown");
    if (retryAfter) {
      res.setHeader("Retry-After", String(retryAfter));
      return res
        .status(429)
        .json({ error: "Muitas tentativas. Aguarde antes de tentar novamente." });
    }
    if (req.headers["content-type"]?.split(";")[0].trim().toLowerCase() !== "application/json")
      return res.status(415).json({ error: "Envie os dados como application/json." });
    let body;
    try {
      const raw = typeof req.body === "string" ? req.body : JSON.stringify(req.body ?? {});
      if (Buffer.byteLength(raw) > MAX_BODY_BYTES)
        return res.status(413).json({ error: "Solicitação muito grande." });
      body = JSON.parse(raw);
    } catch {
      return res.status(400).json({ error: "JSON inválido." });
    }
    if (typeof body?.companyWebsite === "string" && body.companyWebsite.trim())
      return res.status(400).json({ error: "Não foi possível validar o formulário." });
    const parsed = leadSchema.safeParse(body);
    if (!parsed.success)
      return res.status(400).json({
        error: "Revise os dados informados.",
        details: parsed.error.flatten().fieldErrors,
      });
    const leadId = parsed.data.requestId || randomUUID();
    const lead = {
      ...parsed.data,
      source: "landing_simplechurch",
      submittedAt: new Date().toISOString(),
    };
    if (!webhookUrl || !env.N8N_WEBHOOK_TOKEN?.trim())
      return res.status(503).json({ error: "Registro automático indisponível. Fale conosco pelo WhatsApp." });
    try {
      await webhook({ lead, leadId, webhookUrl, webhookToken: env.N8N_WEBHOOK_TOKEN });
    } catch {
      // No personal data, destination URL or credentials in logs.
      logger.error("lead_registration_unconfirmed");
      return res.status(503).json({ error: "Não conseguimos confirmar o registro. Continue pelo WhatsApp." });
    }
    return res.status(201).json({ ok: true, id: leadId });
  };
}
