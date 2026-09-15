# ByVit

ByVit is a Russian-language sports nutrition storefront with a Node.js API, protected administration, server-side order calculation, PostgreSQL persistence, Telegram notifications, media uploads, backups, and a static GitHub Pages preview.

## Current modes

- `npm start` — local Node.js storefront and API.
- `docker compose up -d --build` — production-like Node.js + PostgreSQL stack.
- GitHub Pages — public visual preview only; checkout and administration intentionally require the server.

## Local verification

```bash
npm ci
npm run check
npm run check:e2e
npm run build:static
```

`check:e2e` uses an installed Chrome or Chromium and verifies the desktop/mobile storefront, cart, checkout, server-side stock update, protected order data, and admin login.

## Production preparation

1. Copy `.env.example` to `.env`.
2. Replace every placeholder with unique secrets.
3. Until a domain exists, keep the local URL values; before launch, replace them with the final HTTPS domain.
4. Run `npm run check:production`.
5. Start the stack with `docker compose up -d --build`.

See [DEPLOYMENT.md](DEPLOYMENT.md) for PostgreSQL backup/restore, migration, Caddy, TLS, and the first-server checklist. See [GITHUB_PAGES.md](GITHUB_PAGES.md) for the static preview.

## Important URLs

- Storefront: `/`
- Administration: `/admin.html` (not linked from the public interface)
- Health: `/api/health`
- Robots: `/robots.txt`
- Sitemap: `/sitemap.xml`

Do not commit `.env`, `data/store.json`, uploads, database volumes, or exported backups.

## Europost offices

When Europost is selected at checkout, the server loads the official office directory and exposes a compact searchable list to the storefront. The result is cached for 12 hours in the persistent data directory; a stale cache remains available if the external API is temporarily unavailable. `EUROPOST_CACHE_TTL_MS` and `EUROPOST_TIMEOUT_MS` can be adjusted in `.env`.

## MoySklad inventory

The server can import available product stock from MoySklad. The access token remains in `.env`; the browser receives only connection status and synchronization results.

1. Set `MOYSKLAD_TOKEN` in `.env`.
2. Start the server and open `/admin.html`.
3. In `Товары`, map each ByVit product by MoySklad product ID, full `meta.href`, or article.
4. Open `МойСклад`, test the connection, and run the first manual synchronization.
5. Set `MOYSKLAD_ENABLED=true` for periodic reconciliation. The default interval is five minutes.

The prepared webhook endpoint is `POST /api/integrations/moysklad/webhook`. Protect it with `MOYSKLAD_WEBHOOK_SECRET`; configure the final callback only after the production HTTPS domain exists.
