import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
const PLACEHOLDER_VALUES = new Set(["https://your-project.supabase.co", "your-service-role-key"]);
export const DEFAULT_N8N_WEBHOOK_URL = "https://n8n.forteia.com.br/webhook/LandingChurch";
const optionalText = z.string().trim().max(255).optional().or(z.literal("").transform(() => undefined));
export const leadSchema = z.object({
  name: z.string().trim().min(2).max(120), church: z.string().trim().min(2).max(160),
  phone: z.string().trim().min(8).max(40), email: z.string().trim().email().max(160),
  size: z.string().trim().min(1).max(40), privacyConsent: z.literal("yes"),
  companyWebsite: optionalText, source: optionalText.default("landing_simplechurch"),
  page: optionalText, submittedAt: optionalText,
  tracking: z.record(z.string().trim().max(120), z.string().trim().max(500)).optional(),
});
export function getSupabaseClient(env = process.env) {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || PLACEHOLDER_VALUES.has(SUPABASE_URL) || PLACEHOLDER_VALUES.has(SUPABASE_SERVICE_ROLE_KEY)) return null;
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
}
export function getClientIp(headers = {}, fallbackIp) {
  const forwardedFor = headers["x-forwarded-for"] || headers["X-Forwarded-For"] || headers.get?.("x-forwarded-for");
  return forwardedFor ? forwardedFor.toString().split(",")[0]?.trim() : fallbackIp;
}
export async function saveLead({ supabase, lead, userAgent, ipAddress }) {
  return supabase.from("demo_leads").insert({
    name: lead.name, church: lead.church, phone: lead.phone, email: lead.email, church_size: lead.size,
    source: lead.source, page: lead.page, submitted_at: lead.submittedAt, tracking: lead.tracking ?? {},
    user_agent: userAgent, ip_address: ipAddress, webhook_status: "pending",
  }).select("id").single();
}
export async function sendLeadToWebhook({ lead, leadId, webhookUrl }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(webhookUrl, {
      method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal,
      body: JSON.stringify({ id: leadId, name: lead.name, church: lead.church, phone: lead.phone, email: lead.email, size: lead.size, source: lead.source, page: lead.page, submittedAt: lead.submittedAt, tracking: lead.tracking ?? {} }),
    });
    if (!response.ok) throw new Error(`Webhook returned ${response.status}`);
  } finally { clearTimeout(timeout); }
}
export async function updateLeadWebhookStatus({ supabase, leadId, status, error }) {
  return supabase.from("demo_leads").update({ webhook_status: status, webhook_sent_at: status === "sent" ? new Date().toISOString() : null, webhook_error: error || null }).eq("id", leadId);
}
