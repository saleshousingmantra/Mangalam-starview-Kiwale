/**
 * ==========================================================
 * SEND-ENQUIRY-EMAIL  (Supabase Edge Function)
 *
 * Emails every new row of the shared "enquiries" table to the
 * Relationship Manager that row's landing page assigned
 * (manager_email), through Brevo. Works for every landing page
 * and the Meta lead webhook — no per-site email code needed.
 *
 * Flow:
 *   INSERT into enquiries
 *     -> trigger enquiries_send_email (public.notify_enquiry_email)
 *     -> pg_net POST { id } here, with header x-enquiry-secret
 *     -> load the row with the service role, pick recipient,
 *        send via Brevo, write email_status back to the row.
 *
 * The caller only sends the row id; everything in the email is
 * read from the database. The shared secret lives in Vault
 * ("enquiry_email_secret") and is read via the service-role-only
 * RPC public.get_enquiry_email_secret().
 *
 * Brevo's transactional HTTP API (its "SMTP API") is used
 * instead of raw SMTP because Supabase Edge Functions block
 * outbound ports 25 and 587.
 *
 * Secrets (Supabase dashboard -> Edge Functions -> Secrets):
 *   BREVO_API_KEY           Brevo API key (xkeysib-...)       required
 *   BREVO_SENDER_EMAIL      a sender verified in Brevo         required
 *   BREVO_SENDER_NAME       default "Housing Mantra"
 *   ALLOWED_MANAGER_EMAILS  comma list of RM emails that may receive
 *                           enquiries (default: see DEFAULT_ALLOWED)
 *   FALLBACK_EMAIL          gets rows with no / unknown RM
 *                           (default: sales.housingmantra@gmail.com)
 *   CC_EMAILS               optional comma list copied on every email
 * ==========================================================
 */

import { createClient } from "npm:@supabase/supabase-js@2";

const DEFAULT_ALLOWED = [
  "amit.housingmantrapune@gmail.com",
  "manikhousingmantrapune@gmail.com",
];
const DEFAULT_FALLBACK = "sales.housingmantra@gmail.com";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

let cachedSecret: string | null = null;

async function getSharedSecret(): Promise<string | null> {
  if (cachedSecret) return cachedSecret;
  const { data, error } = await supabase.rpc("get_enquiry_email_secret");
  if (error) {
    console.error("Could not read enquiry_email_secret:", error.message);
    return null;
  }
  cachedSecret = data || null;
  return cachedSecret;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function emailList(value: string | undefined): string[] {
  return (value || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/* manager_name / manager_email are jsonb: a string, or an array of strings */
function jsonbStrings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.filter((v) => typeof v === "string");
  return [];
}

function text(value: unknown): string {
  return value === null || value === undefined ? "" : String(value).trim();
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/* EMAIL TEMPLATE — dark red / soft red / light black theme.
   Table layout + inline styles only, so it renders in Gmail,
   Outlook and phone mail apps alike. */
const C = {
  darkRed: "#8b1e1e",
  softRed: "#fbe9e7",
  softRedAlt: "#fdf6f5",
  page: "#fdf3f2",
  line: "#f1d4d1",
  rowLine: "#f6e3e1",
  pink: "#f6c9c4",
  text: "#3a3a3a",
  textStrong: "#2b2b2b",
  textMuted: "#555555",
  label: "#777777",
};

function renderHtml(o: {
  project: string;
  subtitle: string;
  greeting: string;
  note: string;
  name: string;
  phoneDisplay: string;
  callHref: string;
  whatsappHref: string;
  details: [string, string, string?][];
}): string {
  const btn = (href: string, label: string, primary: boolean) =>
    href
      ? `<a href="${escapeHtml(href)}" style="display:inline-block;${
        primary
          ? `background:${C.darkRed};color:#ffffff;padding:10px 18px;`
          : `background:#ffffff;color:${C.darkRed};border:1px solid #d9827a;padding:9px 18px;`
      }text-decoration:none;font-size:14px;font-weight:bold;border-radius:6px;margin:0 8px 8px 0">${label}</a>`
      : "";

  const detailRows = o.details
    .map(([label, value, href], i) => {
      const bg = i % 2 ? `background:${C.softRedAlt};` : "";
      const border = i < o.details.length - 1 ? `border-bottom:1px solid ${C.rowLine};` : "";
      const v = escapeHtml(value);
      const cell = href ? `<a href="${escapeHtml(href)}" style="color:${C.darkRed}">${v}</a>` : v;
      return `<tr><td style="padding:10px 14px;color:${C.label};width:40%;${bg}${border}">${label}</td>` +
        `<td style="padding:10px 14px;color:${C.textStrong};font-weight:bold;word-break:break-word;${bg}${border}">${cell}</td></tr>`;
    })
    .join("");

  const sectionTitle = (t: string) =>
    `<div style="font-size:12px;text-transform:uppercase;letter-spacing:1px;color:${C.darkRed};font-weight:bold">${t}</div>`;

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${C.page}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.page};padding:24px 12px"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid ${C.line};font-family:Arial,Helvetica,sans-serif;color:${C.text}">
<tr><td style="background:${C.darkRed};padding:24px 28px">
  <div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:${C.pink}">New enquiry</div>
  <div style="font-size:22px;font-weight:bold;color:#ffffff;margin-top:6px">${escapeHtml(o.project)}</div>
  <div style="font-size:13px;color:${C.pink};margin-top:4px">${escapeHtml(o.subtitle)}</div>
</td></tr>
<tr><td style="padding:24px 28px 8px">
  <p style="margin:0 0 8px;font-size:15px;color:${C.text}">${o.greeting}</p>
  <p style="margin:0;font-size:14px;line-height:1.6;color:${C.textMuted}">A new enquiry has been received. ${o.note}</p>
</td></tr>
<tr><td style="padding:16px 28px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.softRed};border-left:4px solid ${C.darkRed};border-radius:8px"><tr><td style="padding:18px 20px">
    ${sectionTitle("Customer")}
    <div style="font-size:20px;font-weight:bold;color:${C.textStrong};margin-top:4px">${escapeHtml(o.name)}</div>
    <div style="font-size:15px;color:${C.text};margin-top:4px">${escapeHtml(o.phoneDisplay)}</div>
    <div style="margin-top:14px">${btn(o.callHref, "&#9742; Call now", true)}${btn(o.whatsappHref, "WhatsApp", false)}</div>
  </td></tr></table>
</td></tr>
<tr><td style="padding:8px 28px 24px">
  <div style="margin-bottom:8px">${sectionTitle("Enquiry details")}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${C.line};border-radius:8px;border-collapse:separate;font-size:14px">${detailRows}</table>
</td></tr>
<tr><td style="background:${C.softRed};padding:14px 28px;font-size:12px;color:${C.label};text-align:center">
  Housing Mantra &middot; Automatic enquiry notification. Reply to this email to contact the customer.
</td></tr>
</table></td></tr></table></body></html>`;
}

async function markRow(id: number, status: string, sentTo: string | null) {
  const { error } = await supabase
    .from("enquiries")
    .update({
      email_status: status.slice(0, 500),
      email_sent_to: sentTo,
      email_sent_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) console.error(`Could not update enquiry ${id}:`, error.message);
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  /* AUTH — only the database trigger knows this secret */
  const secret = await getSharedSecret();
  if (!secret || req.headers.get("x-enquiry-secret") !== secret) {
    return json(401, { error: "Unauthorized" });
  }

  let id: number;
  try {
    id = Number((await req.json()).id);
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }
  if (!Number.isInteger(id) || id <= 0) {
    return json(400, { error: "Missing enquiry id" });
  }

  /* LOAD ROW */
  const { data: row, error: loadError } = await supabase
    .from("enquiries")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (loadError || !row) {
    console.error(`Enquiry ${id} not found:`, loadError?.message);
    return json(404, { error: "Enquiry not found" });
  }
  if (row.email_status === "sent") {
    return json(200, { ok: true, skipped: "already sent" });
  }

  /* CONFIG */
  const apiKey = Deno.env.get("BREVO_API_KEY");
  const senderEmail = Deno.env.get("BREVO_SENDER_EMAIL");
  const senderName = Deno.env.get("BREVO_SENDER_NAME") || "Housing Mantra";
  const allowed = emailList(Deno.env.get("ALLOWED_MANAGER_EMAILS"));
  const allowedManagers = allowed.length ? allowed : DEFAULT_ALLOWED;
  const fallbackEmail =
    text(Deno.env.get("FALLBACK_EMAIL")).toLowerCase() || DEFAULT_FALLBACK;
  const ccEmails = emailList(Deno.env.get("CC_EMAILS"));

  if (!apiKey || !senderEmail) {
    console.error("BREVO_API_KEY / BREVO_SENDER_EMAIL secrets are not set.");
    await markRow(id, "failed: email service not configured", null);
    return json(500, { error: "Email service is not configured" });
  }

  /* PICK RECIPIENTS — the RM(s) on the row, if allow-listed */
  const managerEmails = jsonbStrings(row.manager_email)
    .map((e) => e.trim().toLowerCase())
    .filter((e) => allowedManagers.includes(e));
  const managerName = jsonbStrings(row.manager_name).join(", ");
  const toRM = managerEmails.length > 0;
  const toEmails = toRM ? [...new Set(managerEmails)] : [fallbackEmail];
  const cc = ccEmails.filter((e) => !toEmails.includes(e));

  /* BUILD EMAIL */
  const name = text(row.name);
  const phone = text(row.phone).replace(/\D/g, "");
  const waPhone = phone.length === 10 ? `91${phone}` : phone;
  const email = text(row.email);
  const project = text(row.project) || text(row.meta_page_name) || "Website enquiry";
  const sourceLink = text(row.source_link);
  const receivedAt = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(row.created_at || Date.now()));

  const rows: [string, string, string?][] = [
    ["Name", name],
    ["Phone", text(row.phone), phone ? `tel:+${waPhone}` : undefined],
    ["WhatsApp", phone ? `+${waPhone}` : "", phone ? `https://wa.me/${waPhone}` : undefined],
    ["Email", email, EMAIL_RE.test(email) ? `mailto:${email}` : undefined],
    ["Interested in", text(row.interest)],
    ["Project", project],
    ["Developer", text(row.developer)],
    ["Relationship Manager", managerName],
    ["Source", text(row.source) || (row.meta_lead_id ? `Meta ${text(row.meta_platform)}`.trim() : "")],
    ["Page", sourceLink, sourceLink.startsWith("http") ? sourceLink : undefined],
    ["Meta campaign", text(row.meta_campaign_name)],
    ["Meta ad", text(row.meta_ad_name)],
    ["Meta form", text(row.meta_form_name)],
    ["Received", `${receivedAt} IST`],
    ["Enquiry no.", `#${row.id}`],
  ];

  const greeting = toRM && managerName ? `Hi ${escapeHtml(managerName)},` : "Hi,";
  const note = toRM
    ? "Please contact the customer at the earliest."
    : "This enquiry has no assigned Relationship Manager.";

  const htmlContent = renderHtml({
    project,
    subtitle: [text(row.developer), `${receivedAt} IST`].filter(Boolean).join(" · "),
    greeting,
    note,
    name,
    phoneDisplay: phone.length === 10 ? `+91 ${phone.slice(0, 5)} ${phone.slice(5)}` : text(row.phone),
    callHref: phone ? `tel:+${waPhone}` : "",
    whatsappHref: phone ? `https://wa.me/${waPhone}` : "",
    // Name / phone / WhatsApp are shown in the customer card instead
    details: rows.filter(([label, value]) =>
      value && !["Name", "Phone", "WhatsApp", "Received"].includes(label)
    ),
  });

  const textContent = [
    `New enquiry for ${project}. ${note}`,
    "",
    ...rows.filter(([, v]) => v).map(([label, value]) => `${label}: ${value}`),
  ].join("\n");

  const message: Record<string, unknown> = {
    sender: { email: senderEmail, name: senderName },
    to: toEmails.map((e) => ({ email: e })),
    subject: `New enquiry – ${project} – ${name || phone}`,
    htmlContent,
    textContent,
  };
  if (cc.length) message.cc = cc.map((e) => ({ email: e }));
  if (EMAIL_RE.test(email)) message.replyTo = { email, name: name || email };

  /* SEND VIA BREVO */
  let res: Response;
  try {
    res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(message),
    });
  } catch (err) {
    console.error(`Brevo request failed for enquiry ${id}:`, err);
    await markRow(id, `failed: ${err}`, null);
    return json(502, { error: "Email could not be sent" });
  }

  const result = await res.json().catch(() => ({}));
  const sentTo = toEmails.join(", ");

  if (!res.ok) {
    console.error(`Brevo error for enquiry ${id}:`, res.status, JSON.stringify(result));
    await markRow(id, `failed: Brevo ${res.status} ${result.message || ""}`.trim(), sentTo);
    return json(502, { error: "Email could not be sent" });
  }

  await markRow(id, "sent", sentTo);
  console.log(`Enquiry ${id} emailed to ${sentTo}`, result.messageId);
  return json(200, { ok: true, sentTo, messageId: result.messageId });
});
