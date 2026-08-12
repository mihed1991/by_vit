# GitHub Pages

The storefront is published from `main` by `.github/workflows/pages.yml`.

Expected URL:

`https://mihed1991.github.io/by_vit/`

The workflow runs `npm run build:static` and uploads only the public storefront.
`admin.html`, `server.js`, storage files, and server-only API features are excluded.

## One-time GitHub setting

Open **Settings -> Pages** in the repository and select **GitHub Actions** as the
source. Every subsequent push to `main` publishes a new version automatically.

## Static-mode limitations

GitHub Pages cannot run Node.js. Catalog pages, product pages, favorites,
comparison, and the browser-local cart work. Shared administration, server-side
orders, uploaded files, Telegram recovery, and persistent server data require a
separate backend service.
