const {createFileMedia} = require('./file-media');

function createMedia(options={}){
  const driver = String(options.driver || 'file').toLowerCase();
  if(driver === 'file') return createFileMedia(options);
  throw new Error(`Unsupported media driver: ${driver}`);
}

module.exports = {createMedia};
