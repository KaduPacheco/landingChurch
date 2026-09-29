import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const PLACEHOLDER_VALUES = new Set(["https://your-project.supabase.co", "your-service-role-key"]);
// Preserve the existing integration for deployments without an explicit override.
// Setting N8N_WEBHOOK_URL to an empty string disables notifications.
export const LEGACY_WEBHOOK_URL = "https://n8n.forteia.com.br/webhook/LandingChurch";
const phoneSchema = z
  .string()
  .trim()
  .min(8)
  .max(40)
  .refine((value) => {
    const digits = value.replace(/\D/g, "");
    return /^[1-9]{2}(?:[2-5]\d{7}|9\d{8})$/.test(digits) && /^[\d\s()+-]+$/.test(value);
  }, "Informe um WhatsApp com DDD.");

const optionalText = z
  .string()
  .trim()
  .max(255)
  .optional()
  .or(z.literal("").transform(() => undefined));

export const leadSchema = z.object({
  name: z.string().trim().min(2).max(120),
  church: z.string().trim().min(2).max(160),
  phone: phoneSchema,
  email: z.string().trim().email().max(160),
  size: z.enum(["Até 100", "101 a 500", "501 a 1.000", "Mais de 1.000"]),
  privacyConsent: z.literal("yes"),
  companyWebsite: optionalText,
  source: optionalText.default("landing_simplechurch"),
  page: optionalText,
  submittedAt: z.string().datetime().optional(),
  tracking: z
    .object(
      Object.fromEntries(
        [
          "utm_source",
          "utm_medium",
          "utm_campaign",
          "utm_term",
          "utm_content",
          "gclid",
          "fbclid",
        ].map((key) => [key, z.string().trim().max(500).optional()]),
      ),
    )
    .optional(),
});

export function getSupabaseClient(env = process.env) {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = env;
  if (
    !SUPABASE_URL ||
    !SUPABASE_SERVICE_ROLE_KEY ||
    PLACEHOLDER_VALUES.has(SUPABASE_URL) ||
    PLACEHOLDER_VALUES.has(SUPABASE_SERVICE_ROLE_KEY)
  )
    return null;
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (url, options) => fetch(url, { ...options, signal: AbortSignal.timeout(5000) }),
    },
  });
}

export async function saveLead({ supabase, lead, userAgent, ipAddress }) {
  return supabase
    .from("demo_leads")
    .insert({
      name: lead.name,
      church: lead.church,
      phone: lead.phone,
      email: lead.email,
      church_size: lead.size,
      source: lead.source,
      page: lead.page,
      submitted_at: lead.submittedAt,
      tracking: {
        ...lead.tracking,
        privacy_consent: true,
        consent_version: "2026-09-29",
        consent_at: lead.submittedAt,
      },
      user_agent: userAgent,
      ip_address: ipAddress,
      webhook_status: "pending",
    })
    .select("id")
    .single();
}

export async function sendLeadToWebhook({ lead, leadId, webhookUrl }) {
  if (new URL(webhookUrl).protocol !== "https:") throw new Error("Webhook must use HTTPS");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3_000);
  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      redirect: "error",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        id: leadId,
        name: lead.name,
        church: lead.church,
        phone: lead.phone,
        email: lead.email,
        size: lead.size,
        source: lead.source,
        page: lead.page,
        submittedAt: lead.submittedAt,
        tracking: lead.tracking ?? {},
      }),
    });
    if (!response.ok) throw new Error(`Webhook returned ${response.status}`);
  } finally {
    clearTimeout(timeout);
  }
}

export async function updateLeadWebhookStatus({ supabase, leadId, status, error }) {
  return supabase
    .from("demo_leads")
    .update({
      webhook_status: status,
      webhook_sent_at: status === "sent" ? new Date().toISOString() : null,
      webhook_error: error || null,
    })
    .eq("id", leadId);
}
