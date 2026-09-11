const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createMedia } = require('../lib/media');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'byvit-media-'));
const appSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');

try {
  const media = createMedia({ driver: 'file', uploadDir: root, publicPath: '/uploads', maxBytes: 1024, persistent: true });
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x01]);
  const saved = media.save({ buffer: jpeg, originalName: 'Test Image.JPG', contentType: 'image/jpeg', scope: 'products' });
  assert.match(saved.url, /^\/uploads\/products\/test-image-\d+-[a-f0-9]{10}\.jpg$/);
  assert.deepStrictEqual(fs.readFileSync(media.resolve(saved.url)), jpeg);
  assert.strictEqual(media.info().files, 1);
  assert.throws(() => media.save({ buffer: Buffer.from('x'), originalName: 'x.exe', contentType: 'application/octet-stream' }), /формат/);
  assert.throws(() => media.save({ buffer: Buffer.from('<script>alert(1)</script>'), originalName: 'fake.jpg', contentType: 'image/jpeg' }), /соответствует/);
  assert.throws(() => media.save({ buffer: Buffer.alloc(1025), originalName: 'large.png', contentType: 'image/png' }), /больше/);
  assert.strictEqual(media.delete(saved.url), true);
  assert.strictEqual(media.info().files, 0);
  assert.match(appSource, /scope:'brands', inline:true, format:'image\/png'/);
  assert.match(appSource, /scope:'home-gallery', format:'image\/jpeg'/);
  assert.doesNotMatch(appSource, /data-brand-logo[^>]*loading="lazy"/);
  console.log('Media storage check passed.');
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
