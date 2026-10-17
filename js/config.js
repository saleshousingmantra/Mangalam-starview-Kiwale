/**
 * ==========================================================
 * CONFIG.JS
 * Mangalam Starview — Kiwale, Pune
 *
 * Central place for all environment / service credentials.
 * form.js reads everything it needs from window.SITE_CONFIG
 * so no keys are hardcoded inside the form logic itself.
 *
 * Load this file BEFORE form.js in index.html.
 * ==========================================================
 */

window.SITE_CONFIG = {

  /* Supabase project */
  SUPABASE_URL: "https://rgzpytocxhjzxsopkrmu.supabase.co",
  SUPABASE_ANON_KEY:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJnenB5dG9jeGhqenhzb3Brcm11Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU5Mjg0MDcsImV4cCI6MjEwMTUwNDQwN30.pMm_t48EOxFd2pnbu2gy4y7EK8fzmem3H4zbbpiqNJ4",

  /* Supabase table that stores enquiries */
  SUPABASE_TABLE: "enquiries",

  /* Default project label saved with every enquiry row */
  PROJECT_NAME: "Mangalam Starview, Kiwale, Pune",

  /* Default Relationship Manager assigned to every enquiry.
     Change these two values to reassign — index.js fills every
     "Relationship Manager" field on the page from here, and
     manager_email travels with each enquiry so the notification
     email is sent to this RM. */
  DEFAULT_DEVELOPER_NAME: "Mangalam Group",

  DEFAULT_MANAGER_NAME: "Amit",
  DEFAULT_MANAGER_EMAIL: "amit.housingmantrapune@gmail.com"

  /* NOTE ON EMAIL ROUTING:
     Every new enquiry row is emailed (by a database trigger and the
     send-enquiry-email Edge Function) to the manager_email saved on
     it, i.e. DEFAULT_MANAGER_EMAIL. Only RM addresses on the
     function's allow-list (ALLOWED_MANAGER_EMAILS) are mailed —
     config.js runs in the browser and can be spoofed. Any other
     address falls back to FALLBACK_EMAIL. When you assign a new RM
     here, add their email to that allow-list too. */

};

/**
 * ==========================================================
 * LEAD-SOURCE CAPTURE  (reusable — copy as-is into the next project)
 *
 * Nothing below this line is specific to this project. It only
 * depends on: this file loading before form.js/index.js (already
 * true — see the script order comment in index.html), and any form
 * on the page having two hidden fields named "source" and
 * "source_link". Drop this whole block into a new project's
 * config.js unchanged; only the credentials above need editing.
 *
 * What it does:
 *   1. On first page load in a browser tab, works out how the
 *      visitor arrived (ad click id, ?utm_source=, a known
 *      referring site, or "Direct / None") and remembers it in
 *      sessionStorage — so it survives internal navigation (e.g.
 *      reading a blog post before landing on the enquiry form)
 *      without being overwritten by the internal referrer.
 *   2. On every page's DOMContentLoaded, fills any [name="source"]
 *      field with that remembered value, and any [name="source_link"]
 *      field with the current page's URL (so that one always shows
 *      exactly which page the enquiry was submitted from).
 *
 * form.js then just reads those two fields like any other field
 * and sends them to Supabase — no changes needed there per project,
 * as long as the "enquiries" table (or equivalent) has "source" and
 * "source_link" columns.
 * ==========================================================
 */
(function () {

  var STORAGE_KEY = "lead_source";

  /* Map a referring domain to a friendly label. Extend this list per
     project as needed (e.g. add local classifieds/portal sites). */
  var KNOWN_REFERRERS = {
    "google.com": "Google (organic)",
    "google.co.in": "Google (organic)",
    "bing.com": "Bing (organic)",
    "facebook.com": "Facebook",
    "l.facebook.com": "Facebook",
    "instagram.com": "Instagram",
    "l.instagram.com": "Instagram",
    "youtube.com": "YouTube",
    "wa.me": "WhatsApp",
    "web.whatsapp.com": "WhatsApp",
    "t.co": "Twitter / X",
    "x.com": "Twitter / X",
    "linkedin.com": "LinkedIn"
  };

  function detectSource() {
    var params = new URLSearchParams(window.location.search);

    if (params.get("utm_source")) {
      var s = params.get("utm_source");
      if (params.get("utm_medium")) s += " / " + params.get("utm_medium");
      return s;
    }
    if (params.get("gclid")) return "Google Ads";
    if (params.get("fbclid")) return "Facebook Ads";

    if (document.referrer) {
      try {
        var host = new URL(document.referrer).hostname.replace(/^www\./, "");
        return KNOWN_REFERRERS[host] || host;
      } catch (e) {
        return "Direct / None";
      }
    }
    return "Direct / None";
  }

  /* Capture once per browser tab session (first touch only). */
  try {
    if (window.sessionStorage && !sessionStorage.getItem(STORAGE_KEY)) {
      sessionStorage.setItem(STORAGE_KEY, detectSource());
    }
  } catch (e) {
    /* Private/incognito mode or storage blocked — fields below simply
       fall back to "Direct / None" and the current URL. Never blocks
       the page or the form. */
  }

  /* Fill every matching field on every page, once the DOM is ready. */
  document.addEventListener("DOMContentLoaded", function () {
    try {
      var source = (window.sessionStorage && sessionStorage.getItem(STORAGE_KEY)) || "Direct / None";
      document.querySelectorAll('[name="source"]').forEach(function (el) {
        el.value = source;
      });
      document.querySelectorAll('[name="source_link"]').forEach(function (el) {
        el.value = window.location.href;
      });
    } catch (e) {
      /* no-op — forms still submit fine without these two fields */
    }
  });

})();
