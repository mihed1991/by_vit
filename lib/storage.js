const {createFileStorage} = require('./file-storage');
const {createPostgresStorage} = require('./postgres-storage');

function createStorage(options={}){
  const driver = String(options.driver || 'file').toLowerCase();
  if(driver === 'file') return createFileStorage(options);
  if(driver === 'postgres' || driver === 'postgresql') return createPostgresStorage(options);
  throw new Error(`Unsupported storage driver: ${driver}`);
}

module.exports = {createStorage};
