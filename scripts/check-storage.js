const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const {createStorage} = require('../lib/storage');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'byvit-storage-'));

try{
  const storage = createStorage({driver:'file', dataDir:root, maxBackups:2, persistent:true});
  storage.write({version:1, products:[{id:1}]}, {backup:false});
  assert.deepStrictEqual(storage.read(), {version:1, products:[{id:1}]});

  storage.write({version:2, products:[{id:1},{id:2}]}, {reason:'test-save'});
  storage.write({version:3, products:[{id:3}]}, {reason:'test-save'});
  const manual = storage.createBackup('manual');
  assert.strictEqual(storage.listBackups().length, 2);

  storage.write({version:4, products:[]}, {backup:false});
  storage.restoreBackup(manual.name);
  assert.strictEqual(storage.read().version, 3);
  assert.strictEqual(storage.info().persistent, true);
  console.log('Storage adapter check passed');
}finally{
  fs.rmSync(root, {recursive:true, force:true});
}
