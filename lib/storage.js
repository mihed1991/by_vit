const {createFileStorage} = require('./file-storage');

function createStorage(options={}){
  const driver = String(options.driver || 'file').toLowerCase();
  if(driver === 'file') return createFileStorage(options);
  throw new Error(`Unsupported storage driver: ${driver}`);
}

module.exports = {createStorage};
