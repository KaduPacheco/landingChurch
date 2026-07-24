import { DEFAULT_N8N_WEBHOOK_URL, getClientIp, getSupabaseClient, leadSchema, saveLead, sendLeadToWebhook, updateLeadWebhookStatus } from "../lib/leads.js";

const allowedOrigins = (process.env.ALLOWED_ORIGINS || "").split(",").map((origin) => origin.trim()).filter(Boolean);

function getCorsHeaders(req) {
  const origin = req.headers.origin;
  if (!origin) return {};
  try {
    if (new URL(origin).host === req.headers.host || allowedOrigins.includes(origin)) return { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", Vary: "Origin" };
  } catch { return {}; }
  return {};
}
function parseBody(body) { if (!body) return {}; return typeof body === "string" ? JSON.parse(body) : body; }

export default async function handler(req, res) {
  Object.entries(getCorsHeaders(req)).forEach(([key, value]) => res.setHeader(key, value));
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") { res.setHeader("Allow", "POST, OPTIONS"); return res.status(405).json({ error: "Method not allowed." }); }

  const supabase = getSupabaseClient();
  if (!supabase) return res.status(503).json({ error: "Supabase is not configured." });

  let body;
  try { body = parseBody(req.body); } catch { return res.status(400).json({ error: "Invalid JSON body." }); }
  const parsed = leadSchema.safeParse(body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid lead data.", details: parsed.error.flatten().fieldErrors });

  const lead = parsed.data;
  if (lead.companyWebsite) return res.status(202).json({ ok: true });

  try {
    const { data: savedLead, error } = await saveLead({ supabase, lead, userAgent: req.headers["user-agent"], ipAddress: getClientIp(req.headers, req.socket?.remoteAddress) });
    if (error) { console.error("Failed to insert demo lead", error); return res.status(500).json({ error: "Could not save lead." }); }
    try {
      await sendLeadToWebhook({ lead, leadId: savedLead.id, webhookUrl: process.env.N8N_WEBHOOK_URL || DEFAULT_N8N_WEBHOOK_URL });
      await updateLeadWebhookStatus({ supabase, leadId: savedLead.id, status: "sent" });
    } catch (webhookError) {
      console.error("Failed to send lead to n8n", webhookError);
      await updateLeadWebhookStatus({ supabase, leadId: savedLead.id, status: "failed", error: webhookError instanceof Error ? webhookError.message : "Unknown webhook error" });
    }
    return res.status(201).json({ ok: true });
  } catch (error) {
    console.error("Unexpected lead submission error", error);
    return res.status(500).json({ error: "Could not save lead." });
  }
}
