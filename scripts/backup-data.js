const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const source = path.resolve(String(process.env.BYVIT_DATA_DIR || path.join(root, 'data')));
const destinationRoot = path.resolve(String(process.env.BYVIT_BACKUP_EXPORT_DIR || '').trim());
const keep = Math.max(1, Number(process.env.BYVIT_BACKUP_EXPORT_KEEP || 14));
const driver = String(process.env.BYVIT_STORAGE_DRIVER || 'file').trim().toLowerCase();
const databaseUrl = String(process.env.DATABASE_URL || '').trim();

if (!process.env.BYVIT_BACKUP_EXPORT_DIR) throw new Error('Set BYVIT_BACKUP_EXPORT_DIR to a directory outside BYVIT_DATA_DIR.');
if (destinationRoot === source || destinationRoot.startsWith(`${source}${path.sep}`)) throw new Error('Backup destination must be outside BYVIT_DATA_DIR.');
if (driver === 'file' && !fs.existsSync(path.join(source, 'store.json'))) throw new Error(`Store not found: ${path.join(source, 'store.json')}`);
if (['postgres', 'postgresql'].includes(driver) && !databaseUrl) throw new Error('DATABASE_URL is required for PostgreSQL backup.');
if (!['file', 'postgres', 'postgresql'].includes(driver)) throw new Error(`Unsupported storage driver: ${driver}`);

function listFiles(directory, prefix = '') {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const absolute = path.join(directory, entry.name);
    const relative = path.join(prefix, entry.name);
    return entry.isDirectory() ? listFiles(absolute, relative) : [relative];
  });
}

function digest(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

fs.mkdirSync(destinationRoot, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const name = `byvit-data-${stamp}`;
const temporary = path.join(destinationRoot, `.${name}-${process.pid}.tmp`);
const target = path.join(destinationRoot, name);

try {
  fs.mkdirSync(temporary, { recursive: true });
  if (driver === 'file') {
    fs.copyFileSync(path.join(source, 'store.json'), path.join(temporary, 'store.json'));
  } else {
    const dump = spawnSync('pg_dump', ['--dbname', databaseUrl, '--format=custom', `--file=${path.join(temporary, 'database.dump')}`], {
      env: process.env,
      encoding: 'utf8'
    });
    if (dump.status !== 0) throw new Error(`pg_dump failed: ${dump.stderr || dump.stdout || `exit ${dump.status}`}`);
  }
  const uploads = path.join(source, 'uploads');
  if (fs.existsSync(uploads)) fs.cpSync(uploads, path.join(temporary, 'uploads'), { recursive: true });
  const files = listFiles(temporary).sort();
  const manifest = {
    version: 2,
    createdAt: new Date().toISOString(),
    storageDriver: driver === 'postgresql' ? 'postgres' : driver,
    source,
    files: Object.fromEntries(files.map(file => [file.split(path.sep).join('/'), digest(path.join(temporary, file))]))
  };
  fs.writeFileSync(path.join(temporary, 'manifest.json'), JSON.stringify(manifest, null, 2));
  fs.renameSync(temporary, target);

  fs.readdirSync(destinationRoot, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && /^byvit-data-\d{4}-/.test(entry.name))
    .map(entry => entry.name)
    .sort()
    .reverse()
    .slice(keep)
    .forEach(entry => fs.rmSync(path.join(destinationRoot, entry), { recursive: true, force: true }));

  console.log(`Backup created: ${target}`);
} catch (error) {
  fs.rmSync(temporary, { recursive: true, force: true });
  throw error;
}
