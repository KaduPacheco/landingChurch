import { z } from "zod";

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
  email: z.union([z.string().trim().email().max(160), z.literal("")]).optional(),
  size: z
    .union([z.enum(["Até 100", "101 a 500", "501 a 1.000", "Mais de 1.000"]), z.literal("")])
    .optional(),
  requestId: z.string().uuid().optional(),
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

// Legacy workflow acknowledges the commercial notification, not durable storage.
export async function sendLeadToWebhook({
  lead,
  leadId,
  webhookUrl,
  webhookToken,
  webhookMode,
  fetchImpl = fetch,
}) {
  const destination = new URL(webhookUrl);
  if (destination.protocol !== "https:" || destination.username || destination.password)
    throw new Error("Webhook must use HTTPS without URL credentials");
  const legacy = webhookMode === "legacy_notification";
  if (!legacy && !webhookToken?.trim()) throw new Error("Webhook authentication required");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetchImpl(webhookUrl, {
      method: "POST",
      redirect: "error",
      headers: {
        "Content-Type": "application/json",
        ...(webhookToken?.trim() ? { Authorization: `Bearer ${webhookToken}` } : {}),
        "Idempotency-Key": leadId,
      },
      signal: controller.signal,
      body: JSON.stringify({
        id: leadId,
        name: lead.name,
        church: lead.church,
        phone: lead.phone,
        email: lead.email || "",
        size: lead.size || "",
        quantidadeMembros: lead.size || "",
        source: lead.source,
        page: lead.page,
        submittedAt: lead.submittedAt,
        privacyConsent: "yes",
        tracking: {
          ...lead.tracking,
          privacy_consent: true,
          consent_version: "2026-11-16",
          consent_at: lead.submittedAt,
        },
      }),
    });
    if (!response.ok) throw new Error("Webhook request failed");
    const acknowledgement = await response.json();
    if (
      acknowledgement?.ok !== true ||
      (legacy ? acknowledgement.protocolo : acknowledgement.id) !== leadId
    )
      throw new Error("Webhook did not confirm registration");
  } finally {
    clearTimeout(timeout);
  }
}
