/**
 * Enquiry email template — dark red / soft red / light black theme.
 *
 * Compact layout sized so the whole email fits on one phone screen
 * in Gmail: project and time in a slim header, customer card with
 * Call / WhatsApp buttons, then a tight two-column details table.
 * Table layout + inline styles only, so it renders in Gmail,
 * Outlook and phone mail apps alike.
 */

export type Detail = [label: string, value: string, href?: string];

export interface EmailView {
  project: string;
  developer: string;
  receivedAt: string;
  greeting: string;
  note: string;
  name: string;
  phoneDisplay: string;
  callHref: string;
  whatsappHref: string;
  details: Detail[];
}

const C = {
  darkRed: "#8b1e1e",
  softRed: "#fbe9e7",
  softRedAlt: "#fdf6f5",
  line: "#f1d4d1",
  rowLine: "#f6e3e1",
  pink: "#f6c9c4",
  text: "#3a3a3a",
  textStrong: "#2b2b2b",
  label: "#777777",
};

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderHtml(o: EmailView): string {
  const btn = (href: string, label: string, primary: boolean) =>
    href
      ? `<a href="${escapeHtml(href)}" style="display:inline-block;${
        primary
          ? `background:${C.darkRed};color:#ffffff;padding:7px 14px;`
          : `background:#ffffff;color:${C.darkRed};border:1px solid #d9827a;padding:6px 14px;`
      }text-decoration:none;font-size:13px;font-weight:bold;border-radius:5px;margin-right:6px">${label}</a>`
      : "";

  const detailRows = o.details
    .map(([label, value, href], i) => {
      const bg = i % 2 ? `background:${C.softRedAlt};` : "";
      const border = i < o.details.length - 1 ? `border-bottom:1px solid ${C.rowLine};` : "";
      const v = escapeHtml(value);
      const cell = href ? `<a href="${escapeHtml(href)}" style="color:${C.darkRed}">${v}</a>` : v;
      return `<tr><td style="padding:6px 10px;color:${C.label};width:34%;white-space:nowrap;${bg}${border}">${label}</td>` +
        `<td style="padding:6px 10px;color:${C.textStrong};font-weight:bold;word-break:break-word;${bg}${border}">${cell}</td></tr>`;
    })
    .join("");

  const meta = [o.developer, o.receivedAt].filter(Boolean).map(escapeHtml).join(" &middot; ");

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#ffffff">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;border:1px solid ${C.line};border-radius:10px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;color:${C.text}">
<tr><td style="background:${C.darkRed};padding:12px 14px">
  <div style="font-size:11px;letter-spacing:1px;text-transform:uppercase;color:${C.pink}">New enquiry</div>
  <div style="font-size:17px;font-weight:bold;color:#ffffff;margin-top:2px;line-height:1.3">${escapeHtml(o.project)}</div>
  <div style="font-size:12px;color:${C.pink};margin-top:2px">${meta}</div>
</td></tr>
<tr><td style="padding:10px 14px 0;font-size:13px;line-height:1.45;color:${C.text}">${o.greeting} ${o.note}</td></tr>
<tr><td style="padding:10px 14px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.softRed};border-left:4px solid ${C.darkRed};border-radius:6px"><tr><td style="padding:10px 12px">
    <div style="font-size:17px;font-weight:bold;color:${C.textStrong}">${escapeHtml(o.name)}</div>
    <div style="font-size:14px;color:${C.text};margin:2px 0 8px">${escapeHtml(o.phoneDisplay)}</div>
    ${btn(o.callHref, "&#9742; Call", true)}${btn(o.whatsappHref, "WhatsApp", false)}
  </td></tr></table>
</td></tr>
<tr><td style="padding:0 14px 12px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${C.line};border-radius:6px;border-collapse:separate;font-size:13px">${detailRows}</table>
</td></tr>
<tr><td style="background:${C.softRed};padding:7px 14px;font-size:11px;color:${C.label};text-align:center">Housing Mantra &middot; Reply to this email to contact the customer</td></tr>
</table></body></html>`;
}
