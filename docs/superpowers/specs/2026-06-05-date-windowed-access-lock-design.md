# Date-windowed access lock for the e-SPAR training

**Date:** 2026-06-05
**Status:** Approved (design) — pending implementation plan
**Project:** `e-spar-training` (Cloudflare Pages, account `ohcsghana.main@gmail.com`)
**Repo:** https://github.com/ghwmelite-dotcom/E-SPAR

---

## 1. Goal

The OASL · e-SPAR interactive training must be reachable **only on the six scheduled
training days**, closed in the gaps between sessions, and **permanently closed after the
final session** — with the lock enforced at Cloudflare's edge so it cannot be bypassed by
changing a device clock or reading the page source.

This exists to stop the live link from living on and circulating after the events. It is a
deterrence/availability control, not digital rights management.

## 2. Schedule (the allowed windows)

Three 2-day sessions (same training, different cohorts):

| Session | Dates |
|---------|-------|
| 1 | 8–9 June 2026 |
| 2 | 22–23 June 2026 |
| 3 | 29–30 June 2026 |

- **Open:** the full calendar day (00:00–23:59) on each of the six dates.
- **Timezone:** Ghana / GMT (UTC+0, no daylight saving) — so the GMT calendar date is the
  source of truth.
- **Closed:** every other day, including the gaps (10–21 June, 24–28 June) and everything
  from 1 July 2026 onward (permanent, automatic — no manual takedown required).
- **No cohort restriction:** the lock is purely date-based. Anyone with the link can enter
  on any of the six open days; the lock does not distinguish cohort 1 from cohort 3. This is
  acceptable and in scope as agreed — the objective is post-event/between-session lockout,
  not per-cohort isolation.

## 3. Architecture

Today `public/index.html` is served directly as a public static asset. We place a small
gatekeeper in front of all content using Cloudflare Pages **advanced mode** — a single
`public/_worker.js` that runs on every request before any asset is served.

```
Request ──▶ _worker.js (runs on Cloudflare edge)
              │
              ├─ Preview key present and valid?  ── yes ──▶ serve training (bypass date check)
              │
              ├─ Is today (GMT) in ALLOWED_DATES? ── yes ──▶ serve training via ASSETS binding
              │
              └─ otherwise ──────────────────────────────▶ serve branded "closed" page
                                                            (content bytes never sent)
```

Key properties:

- The date check uses **Cloudflare's server clock**, not the visitor's — nothing client-side
  to tamper with.
- On a closed day, the real training bytes (`index.html`) are never returned for any path,
  including deep links — every route resolves to the closed page.
- `public/_worker.js` lives inside the build output directory, so the existing deploy command
  `wrangler pages deploy public --project-name e-spar-training` picks it up automatically with
  no change to the deploy flow.

### Why advanced mode (`_worker.js`) over `functions/_middleware.js`

`_worker.js` is the most reliable option for the current direct-upload deploy flow and gives
full control over both allowed and denied responses. **Consequence:** in advanced mode the
`public/_headers` file is **not** applied automatically, so the security headers currently in
`_headers` must be re-applied inside the worker (see §6). The `_headers` file may be kept for
documentation but should be treated as inert once `_worker.js` is in place.

## 4. Configuration

A single, easy-to-edit list at the top of `public/_worker.js`:

```js
const ALLOWED_DATES = [
  "2026-06-08", "2026-06-09",
  "2026-06-22", "2026-06-23",
  "2026-06-29", "2026-06-30",
];
```

"Today" is derived as the `YYYY-MM-DD` string in UTC (equivalent to Ghana time). A visit is
allowed if that string is a member of `ALLOWED_DATES`.

Editing this array (and redeploying) is the entire process for running the training again on
future dates.

## 5. Behaviour

### 5.1 Open day
- Any request is served the corresponding static asset via the `env.ASSETS` binding
  (`index.html`, `favicon.png`, etc.), with security headers applied.

### 5.2 Closed day
- Any request — root or deep link — returns a single **self-contained** HTML page:
  - OASL / OHCS branding and colours, logo inlined (no external asset references, so it renders
    even though assets are gated).
  - Headline: **"This training is currently closed."**
  - **Next session date:** computed as the earliest date in `ALLOWED_DATES` strictly after
    today, shown in a friendly format (e.g. "The next session opens on Monday, 22 June 2026").
  - When no future date remains (on/after 1 July 2026): show **"This training has concluded."**
    with no date.
- Served with `Cache-Control: no-store` so the closed page is never cached and a later open-day
  visit is re-evaluated fresh.
- HTTP status: `200` (a normal page, not an error), so it renders cleanly everywhere.

### 5.3 Preview / testing bypass
- A **secret preview key** lets the team open the site on any day for demos and verification:
  `https://e-spar-training.pages.dev/?key=<LONG_RANDOM_STRING>`.
- When the `key` query parameter matches the configured secret, the date check is skipped and
  the training is served as on an open day.
- The key is a long, unguessable random string, stored as the `PREVIEW_KEY` configuration value
  in the worker, not linked from anywhere, and trivially rotated by changing the value and
  redeploying.
- The preview bypass is intentionally simple (a shared secret link); it is for internal
  pre-launch checks, not a participant-facing access control.

## 6. Security headers (re-applied in the worker)

The following headers, currently in `public/_headers`, are applied to all worker responses
(both the served training and the closed page):

```
X-Frame-Options: SAMEORIGIN
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), microphone=(), camera=()
```

Asset-specific caching previously expressed in `_headers` (e.g. `index.html` no-cache,
`favicon.png` 1-day cache) is preserved by setting equivalent `Cache-Control` headers on the
served asset responses inside the worker.

## 7. Explicit non-goals / accepted limits

- **Does not prevent same-day copying.** A participant present on a live day can still
  screenshot, screen-record, or save the page. This is inherent to browser-delivered content
  and is accepted; the goal is between-session and post-event lockout.
- **No cohort isolation** (see §2).
- **No participant accounts, identity, or attendance tracking** — out of scope for this change.
- **Not DRM.** The preview key is a convenience bypass, not a hardened auth system.

## 8. Deployment & rollback

- **Deploy:** unchanged command — `wrangler pages deploy public --project-name e-spar-training`
  (with `CLOUDFLARE_ACCOUNT_ID=f4f236a6cd8fbddf397c6e9de17d8113`). The worker ships as part of
  the `public/` output.
- **Rollback:** removing `public/_worker.js` and redeploying reverts to the current
  always-public static behaviour. Cloudflare Pages deployment history also allows rolling back
  to a previous deployment from the dashboard.

## 9. Verification plan

Because the natural open dates are in the future, verification before 8 June relies on:

1. **Unit-level date logic** — a small test (or inline assertions) confirming `isAllowed()`
   returns true for the six dates and false for representative gap/after dates, and that
   `nextSessionDate()` returns the correct upcoming date (and "concluded" past 30 June). Date is
   injected, not read from the real clock, so it is testable.
2. **Local/edge preview** — load the deployed site with `?key=<secret>` and confirm the training
   renders; load without the key on a current (pre-8-June) date and confirm the closed page
   renders showing "next session: 8 June 2026".
3. **Closed-page self-containment** — confirm the closed page renders with no failed asset
   requests (logo inline).

## 10. Future maintenance

To run the training on new dates: edit `ALLOWED_DATES` in `public/_worker.js` and redeploy.
To rotate the preview key: change `PREVIEW_KEY` and redeploy.
