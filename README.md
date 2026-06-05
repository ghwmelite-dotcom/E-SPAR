# OASL · e-SPAR Interactive Training

A self-contained, interactive web-based training on the **Staff Performance Appraisal System & e-SPAR** for officers of the **Office of the Administrator of Stool Lands (OASL)**. Organised by the Office of the Head of the Civil Service (OHCS).

Everything (HTML, CSS, JavaScript, logo and certificate) lives in a single `public/index.html` file — no build step, no external dependencies, no internet required at runtime.

---

## Project structure

```
oasl-espar-training/
├── public/
│   ├── index.html      ← the entire training (self-contained)
│   ├── favicon.png      ← Ghana Civil Service logo
│   └── _headers         ← caching + security headers for Pages
├── wrangler.toml        ← config for CLI deploys
├── .gitignore
└── README.md
```

The **build output directory** is `public`.

---

## Deploy — pick ONE method

### Method 1 — Dashboard drag & drop (fastest, no tools)

1. Go to the Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** → **Upload assets**.
2. Name the project, e.g. `oasl-espar-training`.
3. Drag the **`public`** folder (or its contents) into the upload area.
4. Click **Deploy**. Your site goes live at `https://oasl-espar-training.pages.dev`.

To update later, open the project → **Create new deployment** → upload the new `public` folder.

### Method 2 — Wrangler CLI (one command)

Requires [Node.js](https://nodejs.org) installed.

```bash
# from inside the oasl-espar-training/ folder
npx wrangler login           # opens a browser to authorise (first time only)
npx wrangler pages deploy public --project-name oasl-espar-training
```

Wrangler prints the live URL when it finishes. Re-run the same `deploy` command any time to publish updates.

### Method 3 — Git integration (auto-deploy on push)

1. Push this folder to a GitHub/GitLab repo.
2. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
3. Select the repo and set:
   - **Build command:** *(leave blank)*
   - **Build output directory:** `public`
4. **Save and Deploy.** Every future `git push` redeploys automatically.

---

## Custom domain (optional)

In the Pages project → **Custom domains** → **Set up a domain**, enter e.g. `training.oasl.gov.gh` and follow the DNS prompt. If the domain's DNS is already on Cloudflare, the record is added for you.

---

## Notes

- The live e-SPAR site referenced inside the training is **https://ohcs-espar.web.app**.
- The training works fully offline once loaded; the only outbound links are the e-SPAR site button and they open in a new tab.
- To edit content, open `public/index.html` in any editor — module sections are clearly commented (e.g. `<!-- 7 E-SPAR + ROLES -->`).
