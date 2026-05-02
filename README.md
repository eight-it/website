# Eight IT — Website

Public-facing website for [Eight IT](https://eightit.com) — embedded technology consulting for businesses across Los Angeles, Riverside, and Orange counties.

Static HTML + CSS, no framework, no build step. Deployed automatically to Cloudflare Pages on push to `main`.

## Local development

```sh
python -m http.server 8000
```

Open http://localhost:8000.

## Status ticker

The ticker on the homepage pulls live items from public RSS feeds:

- Cloudflare status (incident history)
- CISA cybersecurity advisories
- Bleeping Computer (threat intel)
- Microsoft 365 (pinned link to public status page — no public RSS available)

It refreshes automatically once per day via GitHub Actions. To refresh manually:

```sh
node scripts/update-ticker.mjs
```

Then commit and push the resulting change to `index.html`.

## Files

| Path | Purpose |
|---|---|
| `index.html`, `services.html`, `downloads.html`, `accessibility.html`, `404.html` | Site pages |
| `styles.css` | Design system + page styles |
| `images/` | Hero + section photography |
| `favicon.svg`, `og-image.png` | Branding assets |
| `sitemap.xml`, `robots.txt` | SEO |
| `scripts/update-ticker.mjs` | RSS-driven ticker updater (no npm deps) |
| `.github/workflows/update-ticker.yml` | Daily cron that runs the updater |
