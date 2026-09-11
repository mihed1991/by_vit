const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const dataDir = path.resolve(String(process.env.BYVIT_DATA_DIR || path.join(root, 'data')));
const backupDir = path.resolve(String(process.env.BYVIT_RESTORE_FROM || '').trim());
const driver = String(process.env.BYVIT_STORAGE_DRIVER || 'file').trim().toLowerCase();
const databaseUrl = String(process.env.DATABASE_URL || '').trim();

if (process.env.BYVIT_RESTORE_CONFIRM !== 'RESTORE') throw new Error('Set BYVIT_RESTORE_CONFIRM=RESTORE to allow replacement of current data.');
if (!process.env.BYVIT_RESTORE_FROM || !fs.existsSync(backupDir)) throw new Error('BYVIT_RESTORE_FROM must point to an existing ByVit backup directory.');

function digest(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

const manifestPath = path.join(backupDir, 'manifest.json');
if (!fs.existsSync(manifestPath)) throw new Error('Backup manifest is missing.');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
for (const [relative, expected] of Object.entries(manifest.files || {})) {
  const target = path.resolve(backupDir, relative);
  if (!target.startsWith(`${backupDir}${path.sep}`) || !fs.existsSync(target)) throw new Error(`Backup file is missing: ${relative}`);
  if (digest(target) !== expected) throw new Error(`Backup checksum mismatch: ${relative}`);
}

if (['postgres', 'postgresql'].includes(driver)) {
  if (!databaseUrl) throw new Error('DATABASE_URL is required for PostgreSQL restore.');
  const dumpPath = path.join(backupDir, 'database.dump');
  if (!fs.existsSync(dumpPath)) throw new Error('PostgreSQL dump is missing.');
  const restore = spawnSync('pg_restore', ['--dbname', databaseUrl, '--clean', '--if-exists', '--no-owner', '--no-privileges', dumpPath], {
    env: process.env,
    encoding: 'utf8'
  });
  if (restore.status !== 0) throw new Error(`pg_restore failed: ${restore.stderr || restore.stdout || `exit ${restore.status}`}`);
} else if (driver === 'file') {
  const storeSource = path.join(backupDir, 'store.json');
  if (!fs.existsSync(storeSource)) throw new Error('store.json is missing.');
  fs.mkdirSync(dataDir, { recursive: true });
  const temporaryStore = path.join(dataDir, `store.json.${process.pid}.restore.tmp`);
  fs.copyFileSync(storeSource, temporaryStore);
  fs.renameSync(temporaryStore, path.join(dataDir, 'store.json'));
} else {
  throw new Error(`Unsupported storage driver: ${driver}`);
}

const uploadSource = path.join(backupDir, 'uploads');
const uploadTarget = path.join(dataDir, 'uploads');
fs.rmSync(uploadTarget, { recursive: true, force: true });
if (fs.existsSync(uploadSource)) fs.cpSync(uploadSource, uploadTarget, { recursive: true });
else fs.mkdirSync(uploadTarget, { recursive: true });

console.log(`Backup restored from ${backupDir}`);
