# Date-windowed Access Lock Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Serve the e-SPAR training only on the six scheduled GMT dates, showing a branded "closed" page (with the next session date) at all other times, enforced at Cloudflare's edge.

**Architecture:** A Cloudflare Pages *advanced-mode* worker (`public/_worker.js`) intercepts every request. It serves the static training via the `ASSETS` binding when today's GMT date is in an allow-list (or a secret preview key is supplied), and otherwise returns a self-contained closed page. Pure date/format logic is factored into named exports so it can be unit-tested with Node's built-in test runner; the thin request handler is verified against the deployed site.

**Tech Stack:** Cloudflare Pages (advanced mode `_worker.js`), Wrangler CLI, Node.js 24 built-in test runner (`node --test`), no third-party dependencies.

**Spec:** `docs/superpowers/specs/2026-06-05-date-windowed-access-lock-design.md`

---

## File Structure

- **Create `package.json`** (repo root) — declares `"type": "module"` so Node treats `.js` as ESM (lets the test import `_worker.js`), and a `test` script. Not uploaded as a Pages asset.
- **Create `public/_worker.js`** — the edge worker: configuration (`ALLOWED_DATES`, `PREVIEW_KEY`), pure helpers (`gmtDateString`, `isAllowed`, `nextSessionDate`, `formatLongDate`, `securityHeaders`, `closedPageHTML`) as named exports, and the `default` fetch handler.
- **Create `test/worker.test.js`** — unit tests for the pure helpers.
- **`public/_headers`** — left untouched but becomes **inert** in advanced mode; its rules are re-applied inside the worker (`securityHeaders` + cache-control in `withHeaders`). No edit needed.

**Note on deploy:** `wrangler pages deploy public` auto-detects `public/_worker.js` (advanced mode). No change to the existing deploy command. In advanced mode the `_headers` file is ignored, which is why headers are re-applied in the worker.

---

## Task 1: Test harness setup

**Files:**
- Create: `package.json`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "e-spar-training",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test"
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add package.json
git commit -m "chore: add package.json for ESM + node test runner"
```

---

## Task 2: Pure schedule & closed-page logic (TDD)

**Files:**
- Create: `test/worker.test.js`
- Create: `public/_worker.js`

- [ ] **Step 1: Write the failing tests**

Create `test/worker.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import {
  ALLOWED_DATES,
  gmtDateString,
  isAllowed,
  nextSessionDate,
  formatLongDate,
  closedPageHTML,
} from "../public/_worker.js";

test("gmtDateString returns YYYY-MM-DD in UTC regardless of time", () => {
  assert.equal(gmtDateString(new Date("2026-06-08T13:45:00Z")), "2026-06-08");
  assert.equal(gmtDateString(new Date("2026-06-08T23:59:59Z")), "2026-06-08");
});

test("isAllowed is true only on scheduled dates", () => {
  for (const d of ALLOWED_DATES) assert.equal(isAllowed(d), true);
  assert.equal(isAllowed("2026-06-10"), false); // gap between sessions
  assert.equal(isAllowed("2026-06-07"), false); // day before first session
  assert.equal(isAllowed("2026-07-01"), false); // after final session
});

test("nextSessionDate returns the next upcoming scheduled date", () => {
  assert.equal(nextSessionDate("2026-06-05"), "2026-06-08");
  assert.equal(nextSessionDate("2026-06-08"), "2026-06-09");
  assert.equal(nextSessionDate("2026-06-10"), "2026-06-22");
  assert.equal(nextSessionDate("2026-06-30"), null);
  assert.equal(nextSessionDate("2026-07-15"), null);
});

test("formatLongDate formats deterministically in UTC", () => {
  assert.equal(formatLongDate("2026-06-22"), "Monday, 22 June 2026");
  assert.equal(formatLongDate("2026-06-08"), "Monday, 8 June 2026");
});

test("closedPageHTML shows the next session date when sessions remain", () => {
  const html = closedPageHTML("2026-06-05");
  assert.match(html, /currently closed/);
  assert.match(html, /Monday, 8 June 2026/);
});

test("closedPageHTML shows concluded after the last session", () => {
  const html = closedPageHTML("2026-07-01");
  assert.match(html, /concluded/);
  assert.doesNotMatch(html, /opens on/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test`
Expected: FAIL — cannot resolve module `../public/_worker.js` (file does not exist yet).

- [ ] **Step 3: Create `public/_worker.js` with configuration and pure helpers**

```js
// Cloudflare Pages advanced-mode worker.
// Gates the OASL e-SPAR training so content is served only on scheduled GMT dates.
// Spec: docs/superpowers/specs/2026-06-05-date-windowed-access-lock-design.md

// --- Configuration ------------------------------------------------------

// Training is open for the full GMT calendar day on each of these dates.
export const ALLOWED_DATES = [
  "2026-06-08", "2026-06-09",
  "2026-06-22", "2026-06-23",
  "2026-06-29", "2026-06-30",
];

// Secret bypass for internal previews: append ?key=<PREVIEW_KEY> to any URL.
// Rotate by changing this value and redeploying.
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test`
Expected: PASS — all 6 tests pass (`tests 6`, `pass 6`, `fail 0`).

- [ ] **Step 5: Commit**

```bash
git add public/_worker.js test/worker.test.js
git commit -m "feat: add date-window schedule logic and closed page"
```

---

## Task 3: Request handler (edge gate)

**Files:**
- Modify: `public/_worker.js` (append the handler below the pure helpers)

- [ ] **Step 1: Append the request handler to `public/_worker.js`**

Add this to the end of `public/_worker.js` (after `closedPageHTML`):

```js
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
```

- [ ] **Step 2: Re-run unit tests (still green)**

Run: `node --test`
Expected: PASS — adding the handler does not change the pure helpers; still `pass 6`, `fail 0`.

- [ ] **Step 3: Local smoke test with Wrangler (optional but recommended)**

Today (2026-06-05) is a closed date, so the local dev server should serve the closed page, and the preview key should serve the training.

Start the dev server in the background:

Run: `npx --yes wrangler@latest pages dev public --port 8788`

In a second shell, check the closed page and the preview bypass:

```powershell
(Invoke-WebRequest "http://localhost:8788/" -UseBasicParsing).Content -match "currently closed"           # True
(Invoke-WebRequest "http://localhost:8788/?key=espar-preview-7Qx2Lm9KpV3wZ8Rt5Nf" -UseBasicParsing).Content -match "<title>OASL"   # True (training served)
```

Expected: first match `True` (closed page with "Monday, 8 June 2026"), second match `True` (full training served). Stop the dev server when done.

- [ ] **Step 4: Commit**

```bash
git add public/_worker.js
git commit -m "feat: gate asset serving behind date window + preview key"
```

---

## Task 4: Deploy and verify on Cloudflare

**Files:** none (deploy + verification only)

- [ ] **Step 1: Deploy to Cloudflare Pages**

```powershell
$env:CLOUDFLARE_ACCOUNT_ID = "f4f236a6cd8fbddf397c6e9de17d8113"
npx --yes wrangler@latest pages deploy public --project-name e-spar-training --branch main --commit-dirty=true
```

Expected: `Deployment complete!` with a deployment URL.

- [ ] **Step 2: Verify the live site is CLOSED today (real Cloudflare clock)**

Today is 2026-06-05 — a closed date — so production should show the closed page with the next session date.

```powershell
$c = (Invoke-WebRequest "https://e-spar-training.pages.dev/" -UseBasicParsing).Content
$c -match "currently closed"        # True
$c -match "Monday, 8 June 2026"     # True
$c -match "Staff Performance Appraisal"  # False (training content NOT served)
```

Expected: first two `True`, third `False` (the real training is not sent on a closed day).

- [ ] **Step 3: Verify the preview key opens the training**

```powershell
$t = (Invoke-WebRequest "https://e-spar-training.pages.dev/?key=espar-preview-7Qx2Lm9KpV3wZ8Rt5Nf" -UseBasicParsing).Content
$t -match "Staff Performance Appraisal"  # True (training served via preview key)
```

Expected: `True` — the full training renders when the secret key is supplied.

- [ ] **Step 4: Verify security headers are present**

```powershell
(Invoke-WebRequest "https://e-spar-training.pages.dev/" -UseBasicParsing).Headers["X-Frame-Options"]   # SAMEORIGIN
```

Expected: `SAMEORIGIN`.

- [ ] **Step 5: Final commit (no-op if clean) and push**

```bash
git push origin main
```

Expected: branch `main` pushed; GitHub reflects the worker. (Cloudflare auto-deploy is not connected, so the `wrangler` deploy in Step 1 is what made it live.)

---

## Post-implementation notes

- **Running on future dates:** edit `ALLOWED_DATES` in `public/_worker.js` and redeploy.
- **Rotating the preview key:** change `PREVIEW_KEY` and redeploy.
- **Reverting the lock entirely:** delete `public/_worker.js` and redeploy (returns to always-public static serving), or roll back to a previous deployment in the Cloudflare dashboard.
- **`public/_headers` is now inert** (advanced mode ignores it); the worker re-applies its security and cache rules. Leave the file in place for documentation or delete it — no behavioural effect either way.
