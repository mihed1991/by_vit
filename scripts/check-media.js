const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {createMedia} = require('../lib/media');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'byvit-media-'));

try{
  const media = createMedia({driver:'file', uploadDir:root, publicPath:'/uploads', maxBytes:1024, persistent:true});
  const saved = media.save({buffer:Buffer.from('image'), originalName:'Test Image.JPG', contentType:'image/jpeg', scope:'products'});
  assert.match(saved.url, /^\/uploads\/products\/test-image-\d+-[a-f0-9]{10}\.jpg$/);
  assert.strictEqual(fs.readFileSync(media.resolve(saved.url), 'utf8'), 'image');
  assert.strictEqual(media.info().files, 1);
  assert.throws(() => media.save({buffer:Buffer.from('x'), originalName:'x.exe', contentType:'application/octet-stream'}), /формат/);
  assert.throws(() => media.save({buffer:Buffer.alloc(1025), originalName:'large.png', contentType:'image/png'}), /больше/);
  assert.strictEqual(media.delete(saved.url), true);
  assert.strictEqual(media.info().files, 0);
  console.log('Media storage check passed.');
}finally{
  fs.rmSync(root, {recursive:true, force:true});
}
