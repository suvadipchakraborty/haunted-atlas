# Haunted Atlas
Classified paranormal map PWA. Vanilla HTML/CSS/JS, Leaflet, PapaParse. No build step.

- US data: published Google Sheets CSV (uses `latitude`/`longitude`, falls back to `city_latitude`/`city_longitude`; `location` = name, `description` = narrative)
- Global data: Wikidata SPARQL (haunted locations, 300 max) + Wikipedia REST summaries on click

## Deploy
Push this folder to GitHub, connect to Cloudflare Pages (no build command, output dir `/`).
Add a 1200x630 `preview.png` to the root for social sharing.
