const assert = require('assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'byvit-backup-check-'));
const dataDir = path.join(root, 'data');
const exportDir = path.join(root, 'exports');

try {
  fs.mkdirSync(path.join(dataDir, 'uploads', 'products'), { recursive: true });
  fs.writeFileSync(path.join(dataDir, 'store.json'), JSON.stringify({ products: [{ id: 1 }], orders: [] }));
  fs.writeFileSync(path.join(dataDir, 'uploads', 'products', 'image.jpg'), Buffer.from([0xff, 0xd8, 0xff]));
  const result = spawnSync(process.execPath, [path.join(__dirname, 'backup-data.js')], {
    env: { ...process.env, BYVIT_DATA_DIR: dataDir, BYVIT_BACKUP_EXPORT_DIR: exportDir },
    encoding: 'utf8'
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const exports = fs.readdirSync(exportDir).filter(name => name.startsWith('byvit-data-'));
  assert.equal(exports.length, 1);
  const backup = path.join(exportDir, exports[0]);
  const manifest = JSON.parse(fs.readFileSync(path.join(backup, 'manifest.json'), 'utf8'));
  assert.ok(manifest.files['store.json']);
  assert.ok(manifest.files['uploads/products/image.jpg']);
  assert.ok(fs.existsSync(path.join(backup, 'store.json')));
  assert.ok(fs.existsSync(path.join(backup, 'uploads', 'products', 'image.jpg')));
  fs.writeFileSync(path.join(dataDir, 'store.json'), JSON.stringify({ products: [{ id: 999 }], orders: [] }));
  fs.rmSync(path.join(dataDir, 'uploads'), { recursive: true, force: true });
  const restore = spawnSync(process.execPath, [path.join(__dirname, 'restore-data.js')], {
    env: {
      ...process.env,
      BYVIT_DATA_DIR: dataDir,
      BYVIT_STORAGE_DRIVER: 'file',
      BYVIT_RESTORE_FROM: backup,
      BYVIT_RESTORE_CONFIRM: 'RESTORE'
    },
    encoding: 'utf8'
  });
  assert.equal(restore.status, 0, restore.stderr || restore.stdout);
  assert.equal(JSON.parse(fs.readFileSync(path.join(dataDir, 'store.json'), 'utf8')).products[0].id, 1);
  assert.ok(fs.existsSync(path.join(dataDir, 'uploads', 'products', 'image.jpg')));
  console.log('Full data backup check passed.');
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
