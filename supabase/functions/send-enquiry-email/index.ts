/**
 * ==========================================================
 * SEND-ENQUIRY-EMAIL  (Supabase Edge Function)
 *
 * Called by js/form.js right after an enquiry row has been
 * saved in the "enquiries" table. Emails the enquiry to the
 * assigned Relationship Manager through Brevo.
 *
 * Brevo's transactional HTTP API (its "SMTP API") is used
 * instead of raw SMTP because Supabase Edge Functions block
 * outbound ports 25 and 587.
 *
 * Secrets (Supabase dashboard -> Edge Functions -> Secrets):
 *   BREVO_API_KEY           Brevo API key (xkeysib-...)
 *   BREVO_SENDER_EMAIL      a sender verified in Brevo
 *   BREVO_SENDER_NAME       optional, default "Housing Mantra"
 *   ALLOWED_MANAGER_EMAILS  comma list of RM emails this function
 *                           may send to (manager_email comes from
 *                           the browser, so it is never trusted
 *                           on its own)
 *   FALLBACK_EMAIL          receives the enquiry when manager_email
 *                           is missing or not in the list above
 *   CC_EMAILS               optional comma list copied on every email
 * ==========================================================
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function emailList(value: string | undefined): string[] {
  return (value || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function clean(value: unknown, max = 500): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  const apiKey = Deno.env.get("BREVO_API_KEY");
  const senderEmail = Deno.env.get("BREVO_SENDER_EMAIL");
  const senderName = Deno.env.get("BREVO_SENDER_NAME") || "Housing Mantra";
  const allowedManagers = emailList(Deno.env.get("ALLOWED_MANAGER_EMAILS"));
  const fallbackEmail = clean(Deno.env.get("FALLBACK_EMAIL")).toLowerCase();
  const ccEmails = emailList(Deno.env.get("CC_EMAILS"));

  if (!apiKey || !senderEmail) {
    console.error("BREVO_API_KEY / BREVO_SENDER_EMAIL secrets are not set.");
    return json(500, { error: "Email service is not configured" });
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }

  /* READ + VALIDATE FIELDS */
  const name = clean(payload.name, 100);
  const phone = clean(payload.phone, 20).replace(/\D/g, "");
  const email = clean(payload.email, 200);
  const interest = clean(payload.interest, 100);
  const project = clean(payload.project, 200) || "Website enquiry";
  const developer = clean(payload.developer, 200);
  const managerName = clean(payload.manager_name, 100);
  const managerEmail = clean(payload.manager_email, 200).toLowerCase();
  const source = clean(payload.source, 300);
  const sourceLink = clean(payload.source_link, 1000);

  if (!name || !/^\d{10}$/.test(phone)) {
    return json(400, { error: "Name and a 10-digit phone number are required" });
  }

  /* PICK RECIPIENT — only allow-listed RM addresses */
  const toEmail = allowedManagers.includes(managerEmail)
    ? managerEmail
    : fallbackEmail;

  if (!toEmail) {
    console.error(
      `No recipient: manager_email "${managerEmail}" not allowed and FALLBACK_EMAIL is not set.`,
    );
    return json(500, { error: "No recipient configured" });
  }

  const cc = ccEmails.filter((e) => e !== toEmail);

  /* BUILD EMAIL */
  const receivedAt = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date());

  const rows: [string, string, string?][] = [
    ["Name", name],
    ["Phone", phone, `tel:+91${phone}`],
    ["WhatsApp", `+91 ${phone}`, `https://wa.me/91${phone}`],
    ["Email", email, email ? `mailto:${email}` : undefined],
    ["Interested in", interest],
    ["Project", project],
    ["Developer", developer],
    ["Relationship Manager", managerName],
    ["Source", source],
    ["Page", sourceLink, sourceLink.startsWith("http") ? sourceLink : undefined],
    ["Received", `${receivedAt} IST`],
  ];

  const htmlRows = rows
    .filter(([, value]) => value)
    .map(([label, value, href]) => {
      const v = escapeHtml(value);
      const cell = href ? `<a href="${escapeHtml(href)}">${v}</a>` : v;
      return `<tr><td style="padding:6px 12px;color:#666;white-space:nowrap">${label}</td>` +
        `<td style="padding:6px 12px;font-weight:600">${cell}</td></tr>`;
    })
    .join("");

  const greeting = managerName && toEmail === managerEmail
    ? `Hi ${escapeHtml(managerName)},`
    : "Hi,";

  const htmlContent =
    `<div style="font-family:Arial,sans-serif;font-size:14px;color:#222">` +
    `<p>${greeting}</p>` +
    `<p>A new enquiry has been received for <b>${escapeHtml(project)}</b>. Please contact the customer at the earliest.</p>` +
    `<table style="border-collapse:collapse;border:1px solid #ddd">${htmlRows}</table>` +
    `</div>`;

  const textContent = [
    `New enquiry for ${project}`,
    "",
    ...rows.filter(([, v]) => v).map(([label, value]) => `${label}: ${value}`),
  ].join("\n");

  const message: Record<string, unknown> = {
    sender: { email: senderEmail, name: senderName },
    to: [{ email: toEmail, name: toEmail === managerEmail ? managerName || undefined : undefined }],
    subject: `New enquiry – ${project} – ${name}`,
    htmlContent,
    textContent,
  };
  if (cc.length) message.cc = cc.map((e) => ({ email: e }));
  if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    message.replyTo = { email, name };
  }

  /* SEND VIA BREVO */
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(message),
  });

  const result = await res.json().catch(() => ({}));

  if (!res.ok) {
    console.error("Brevo error:", res.status, JSON.stringify(result));
    return json(502, { error: "Email could not be sent" });
  }

  console.log(`Enquiry email sent to ${toEmail}`, result.messageId);
  return json(200, { ok: true, messageId: result.messageId });
});
