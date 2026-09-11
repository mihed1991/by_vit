const fs = require('fs');
const path = require('path');
const { createStorage } = require('../lib/storage');

async function main() {
  const databaseUrl = String(process.env.DATABASE_URL || '').trim();
  if (!databaseUrl) throw new Error('DATABASE_URL is required.');
  const source = path.resolve(String(process.env.BYVIT_IMPORT_FILE || path.join(__dirname, '..', 'data', 'store.json')));
  if (!fs.existsSync(source)) throw new Error(`Import file not found: ${source}`);
  const data = JSON.parse(fs.readFileSync(source, 'utf8'));
  if (!Array.isArray(data.products) || !data.site || typeof data.site !== 'object') throw new Error('Import file is not a valid ByVit store.');

  const storage = createStorage({
    driver: 'postgres',
    databaseUrl,
    maxBackups: Number(process.env.BYVIT_MAX_BACKUPS || 30),
    ssl: /^(1|true|yes)$/i.test(String(process.env.BYVIT_DATABASE_SSL || '')),
    sslRejectUnauthorized: !/^(0|false|no)$/i.test(String(process.env.BYVIT_DATABASE_SSL_REJECT_UNAUTHORIZED || ''))
  });
  try {
    await storage.ensure();
    if (await storage.exists() && !/^(1|true|yes)$/i.test(String(process.env.BYVIT_IMPORT_FORCE || ''))) {
      throw new Error('PostgreSQL already contains ByVit data. Set BYVIT_IMPORT_FORCE=true only after creating a backup.');
    }
    await storage.write(data, { backup: true, reason: 'json-import' });
    console.log(`Imported ByVit data from ${source}`);
  } finally {
    await storage.close();
  }
}

main().catch(error => {
  console.error(error.message || error);
  process.exitCode = 1;
});
