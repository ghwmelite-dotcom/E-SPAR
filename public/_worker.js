// Cloudflare Pages advanced-mode worker.
// Gates the OASL e-SPAR training so content is served only on scheduled GMT dates.
// Spec: docs/superpowers/specs/2026-06-05-date-windowed-access-lock-design.md

// --- Configuration ------------------------------------------------------

// Training is open for the full GMT calendar day on each of these dates.
export const ALLOWED_DATES = [
  // Session 1 opened early: continuous access 5-9 June (closes 00:00 GMT 10 June).
  "2026-06-05", "2026-06-06", "2026-06-07", "2026-06-08", "2026-06-09",
  "2026-06-22", "2026-06-23",
  "2026-06-29", "2026-06-30",
];

// Secret bypass for internal previews: append ?key=<PREVIEW_KEY> to any URL.
// Rotate by changing this value and redeploying.
// NOTE: this value lives in source. Treat it as a low-privilege convenience key,
// not a security secret. Move to a Pages env var if the repo becomes public.
export const PREVIEW_KEY = "espar-preview-7Qx2Lm9KpV3wZ8Rt5Nf";

// --- Pure helpers (unit tested) -----------------------------------------

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];

// YYYY-MM-DD for the given Date in GMT/UTC.
export function gmtDateString(date) {
  return date.toISOString().slice(0, 10);
}

// True when the GMT date string is one of the scheduled training days.
export function isAllowed(todayStr, allowed = ALLOWED_DATES) {
  return allowed.includes(todayStr);
}

// Earliest scheduled date strictly after today, or null if none remain.
export function nextSessionDate(todayStr, allowed = ALLOWED_DATES) {
  const upcoming = allowed.filter((d) => d > todayStr).sort();
  return upcoming.length ? upcoming[0] : null;
}

// "Monday, 22 June 2026" from "2026-06-22" (UTC, deterministic).
export function formatLongDate(dateStr) {
  const d = new Date(dateStr + "T00:00:00Z");
  return `${DAY_NAMES[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

// Security headers applied to every response (re-applies the old _headers file).
export function securityHeaders() {
  return {
    "X-Frame-Options": "SAMEORIGIN",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
  };
}

// Self-contained branded "closed" page (no external asset references).
export function closedPageHTML(todayStr, allowed = ALLOWED_DATES) {
  const next = nextSessionDate(todayStr, allowed);
  const heading = next ? "This training is currently closed" : "This training has concluded";
  const message = next
    ? `The next session opens on <strong>${formatLongDate(next)}</strong>.`
    : "This training has concluded. Thank you for your participation.";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>OASL · e-SPAR Training — Closed</title>
<style>
  :root{--green:#0a5c2b;--green-d:#073f1d;--gold:#f4b400;--ink:#1a1a1a;}
  *{box-sizing:border-box}
  body{margin:0;min-height:100vh;display:grid;place-items:center;
    font-family:'Segoe UI',system-ui,-apple-system,sans-serif;color:var(--ink);
    background:linear-gradient(160deg,#0a5c2b,#073f1d);padding:24px}
  .card{background:#fff;max-width:480px;width:100%;border-radius:16px;
    box-shadow:0 18px 50px rgba(0,0,0,.28);padding:40px 32px;text-align:center}
  .crest{width:72px;height:72px;border-radius:50%;margin:0 auto 18px;
    display:grid;place-items:center;background:var(--green);color:var(--gold);
    font-weight:800;font-size:22px;letter-spacing:1px;border:3px solid var(--gold)}
  h1{font-size:22px;color:var(--green-d);margin:0 0 10px}
  p{font-size:15.5px;line-height:1.6;color:#3a3a3a;margin:0 0 8px}
  .tag{margin-top:18px;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#8a8a8a}
</style>
</head>
<body>
  <main class="card">
    <div class="crest">OASL</div>
    <h1>${heading}</h1>
    <p>${message}</p>
    <p class="tag">OASL · e-SPAR Interactive Training · OHCS</p>
  </main>
</body>
</html>`;
}

// --- Request handler ----------------------------------------------------

// Clone an asset response, adding security headers and asset cache-control.
function withHeaders(res, pathname) {
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(securityHeaders())) headers.set(k, v);
  if (pathname === "/" || pathname.endsWith(".html")) {
    headers.set("Cache-Control", "public, max-age=0, must-revalidate");
  } else if (pathname.endsWith("favicon.png")) {
    headers.set("Cache-Control", "public, max-age=86400");
  }
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const today = gmtDateString(new Date());
    const key = url.searchParams.get("key");
    const open = (key && key === PREVIEW_KEY) || isAllowed(today);

    if (open) {
      const assetRes = await env.ASSETS.fetch(request);
      return withHeaders(assetRes, url.pathname);
    }

    return new Response(closedPageHTML(today), {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        ...securityHeaders(),
      },
    });
  },
};
