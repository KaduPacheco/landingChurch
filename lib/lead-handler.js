import { isIP } from "node:net";
import {
  getSupabaseClient,
  leadSchema,
  saveLead,
  sendLeadToWebhook,
  updateLeadWebhookStatus,
  LEGACY_WEBHOOK_URL,
} from "./leads.js";

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
  client = getSupabaseClient,
  persist = saveLead,
  webhook = sendLeadToWebhook,
  updateStatus = updateLeadWebhookStatus,
  trustPlatformProxy = false,
  rateLimit = createRateLimiter(),
  logger = console,
} = {}) {
  const allowedOrigins = (env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const webhookUrl = env.N8N_WEBHOOK_URL ?? LEGACY_WEBHOOK_URL;
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
      return res.status(202).json({ ok: true });
    const parsed = leadSchema.safeParse(body);
    if (!parsed.success)
      return res.status(400).json({
        error: "Revise os dados informados.",
        details: parsed.error.flatten().fieldErrors,
      });
    let supabase;
    let savedLead;
    const lead = {
      ...parsed.data,
      source: "landing_simplechurch",
      submittedAt: new Date().toISOString(),
    };
    try {
      supabase = client(env);
      if (!supabase)
        return res.status(503).json({ error: "Serviço temporariamente indisponível." });
      const result = await persist({
        supabase,
        lead,
        userAgent: req.headers["user-agent"]?.slice(0, 500),
        ipAddress,
      });
      if (result.error || !result.data?.id) throw new Error("insert_failed");
      savedLead = result.data;
    } catch {
      logger.error("lead_persistence_failed");
      return res.status(503).json({ error: "Não foi possível registrar sua solicitação agora." });
    }
    // Notification errors must not turn a saved lead into a failed submission.
    if (webhookUrl) {
      let status = "sent";
      try {
        await webhook({ lead, leadId: savedLead.id, webhookUrl });
      } catch {
        status = "failed";
        logger.error("lead_notification_failed");
      }
      try {
        const result = await updateStatus({
          supabase,
          leadId: savedLead.id,
          status,
          error: status === "failed" ? "notification_failed" : null,
        });
        if (result?.error) logger.error("lead_notification_status_failed");
      } catch {
        logger.error("lead_notification_status_failed");
      }
    }
    return res.status(201).json({ ok: true });
  };
}
