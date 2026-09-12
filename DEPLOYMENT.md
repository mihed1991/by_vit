# ByVit production deployment

The repository can be prepared and tested locally before a server or domain is purchased. The production runtime is one Node.js container with a persistent data volume. A reverse proxy such as Caddy, Traefik, or nginx terminates HTTPS and forwards traffic to `127.0.0.1:3000`.

## Local preparation

1. Copy `.env.example` to `.env`.
2. Replace every `replace-with-...` value and set `BYVIT_PUBLIC_URL` and `BYVIT_ALLOWED_ORIGINS` to the future HTTPS domain.
3. Run `npm ci`, `npm run check`, and `npm run check:e2e`.
4. Start Docker Desktop and run `docker compose build`.
5. Start the application with `docker compose up -d`.
6. Check `http://127.0.0.1:3000/api/health` and place a test order.

The application refuses to start with `NODE_ENV=production` unless the admin password and persistent storage are configured.

## Persistent data

Production Compose uses three independent persistent volumes:

```text
byvit-db       PostgreSQL database
byvit-data     uploaded media and runtime snapshots
byvit-backups  database dumps, uploaded media, and SHA-256 manifests
```

Back up both the database and uploaded product/banner files. Keep at least one encrypted copy on another machine or object-storage provider; a backup left only on the same server is not sufficient.

For a mounted external backup directory, run `docker compose exec byvit npm run backup:data`. PostgreSQL mode exports `database.dump`; file mode exports `store.json`. Both modes include uploaded media and a SHA-256 manifest. Schedule this command from the host and copy exports off the server.

Test restoration only on a separate instance. Stop the application, set `BYVIT_RESTORE_FROM` to an extracted backup directory and `BYVIT_RESTORE_CONFIRM=RESTORE`, then run `npm run restore:data`. PostgreSQL restoration replaces the current ByVit tables.

## Migrate the current file store

Do this before the first full production start if the existing `data/store.json` must be preserved:

1. Create a complete file backup and keep a copy outside the server.
2. Start only PostgreSQL: `docker compose up -d postgres`.
3. Import the JSON through the application container:

```bash
docker compose run --rm \
  -v "$PWD/data/store.json:/import/store.json:ro" \
  -e BYVIT_IMPORT_FILE=/import/store.json \
  byvit npm run migrate:postgres
```

4. If `data/uploads` exists, copy it into the persistent media volume:

```bash
docker compose run --rm \
  -v "$PWD/data/uploads:/import/uploads:ro" \
  byvit sh -c 'cp -R /import/uploads/. /app/runtime/data/uploads/'
```

5. Start the complete stack and verify product count, orders, uploaded images, and `/api/health`.

The importer refuses to overwrite a non-empty PostgreSQL store. `BYVIT_IMPORT_FORCE=true` is available only for an intentional replacement after a verified backup.

## First server launch

1. Install Docker Engine and the Compose plugin.
2. Clone the repository and create `.env` from `.env.example`.
3. Set the real domain in `BYVIT_PUBLIC_URL` and `BYVIT_ALLOWED_ORIGINS`.
4. Generate unique admin and backup secrets.
5. Run `docker compose up -d --build`.
6. Configure the reverse proxy, TLS certificate, firewall, and automatic volume backups.
7. Open `/admin.html`, log in, and configure contacts and Telegram. `BYVIT_ADMIN_PASSWORD` is the bootstrap password; a password later changed through the admin/recovery API is stored as a scrypt hash and takes precedence.
8. Verify an order from a phone and desktop before opening the store to customers.

`Caddyfile.example` is ready for the future domain. Replace `shop.example.com`, install Caddy on the server, copy the file to the Caddy configuration, and reload Caddy. The application itself remains bound to `127.0.0.1:3000`; only Caddy should be exposed publicly.

## Required production checks

- `/api/health` reports persistent storage and media.
- `/server.js`, `/.git/config`, `/data/store.json`, and `/.env` return 404.
- A forged browser price does not change the server-calculated order total.
- An order above the available stock is rejected.
- Telegram receives the same server-calculated order saved in the store.
- The data volume survives a container rebuild.
- A backup is restored on a separate test instance.

GitHub Pages remains a public preview only. It cannot receive real orders or run the admin API.

## MoySklad stock synchronization

MoySklad is treated as the source of truth for product-level stock. ByVit matches products by MoySklad ID or full `meta.href`, with article as a fallback, then writes the available stock into its own catalog. Access credentials never enter the public storefront state.

Before deployment, you can complete the code and product mapping locally:

1. Obtain a MoySklad access token and place it in `MOYSKLAD_TOKEN` inside `.env`.
2. Keep `MOYSKLAD_ENABLED=false` while mapping and testing manually.
3. In the admin product editor, add an ID, `meta.href`, or article for every synchronized product.
4. Use the `МойСклад` admin section to test access and run a manual stock synchronization.
5. After verification, set `MOYSKLAD_ENABLED=true` to enable periodic reconciliation.

After the domain and TLS are active, generate a long random `MOYSKLAD_WEBHOOK_SECRET` and configure the callback URL as `https://your-domain.example/api/integrations/moysklad/webhook?secret=YOUR_SECRET`. Keep periodic reconciliation enabled as a fallback for missed webhook events.

This stage synchronizes product-level stock only. Creating customer orders and reserves inside MoySklad is intentionally deferred until the production organization, warehouse, sales channel, and counterparty rules are known.
