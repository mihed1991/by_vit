const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const TYPES = {
  'image/jpeg':'.jpg',
  'image/png':'.png',
  'image/webp':'.webp',
  'image/svg+xml':'.svg',
  'image/gif':'.gif',
  'video/mp4':'.mp4',
  'video/webm':'.webm'
};

function safeScope(value){
  const scope = String(value || 'misc').toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32);
  return scope || 'misc';
}

function safeBaseName(value){
  const parsed = path.parse(path.basename(String(value || 'file'))).name;
  const name = parsed.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48);
  return name || 'file';
}

function normalizePublicPath(value){
  const publicPath = `/${String(value || 'uploads').replace(/^\/+|\/+$/g, '')}`;
  if(publicPath === '/') throw new Error('Invalid public upload path');
  return publicPath;
}

class FileMedia {
  constructor(options={}){
    this.driver = 'file';
    this.uploadDir = path.resolve(options.uploadDir);
    this.publicPath = normalizePublicPath(options.publicPath);
    this.maxBytes = Math.max(1024, Number(options.maxBytes || 25 * 1024 * 1024));
    this.persistent = options.persistent === true;
  }

  ensure(){
    fs.mkdirSync(this.uploadDir, {recursive:true});
  }

  save({buffer, originalName, contentType, scope}){
    this.ensure();
    if(!Buffer.isBuffer(buffer) || !buffer.length) throw new Error('Файл пустой');
    if(buffer.length > this.maxBytes) throw new Error(`Файл больше ${Math.round(this.maxBytes / 1024 / 1024)} МБ`);
    const type = String(contentType || '').split(';')[0].trim().toLowerCase();
    const extension = TYPES[type];
    if(!extension) throw new Error('Неподдерживаемый формат файла');
    const folder = safeScope(scope);
    const directory = path.join(this.uploadDir, folder);
    fs.mkdirSync(directory, {recursive:true});
    const suffix = `${Date.now()}-${crypto.randomBytes(5).toString('hex')}`;
    const name = `${safeBaseName(originalName)}-${suffix}${extension}`;
    const target = path.join(directory, name);
    const temporary = `${target}.${process.pid}.tmp`;
    fs.writeFileSync(temporary, buffer, {flag:'wx'});
    fs.renameSync(temporary, target);
    return {
      url:`${this.publicPath}/${folder}/${name}`,
      name,
      size:buffer.length,
      type
    };
  }

  resolve(urlValue){
    let pathname;
    try{ pathname = new URL(String(urlValue || ''), 'http://localhost').pathname; }
    catch(error){ return null; }
    if(pathname !== this.publicPath && !pathname.startsWith(`${this.publicPath}/`)) return null;
    let relative;
    try{ relative = decodeURIComponent(pathname.slice(this.publicPath.length)).replace(/^\/+/, ''); }
    catch(error){ return null; }
    if(!relative) return null;
    const target = path.resolve(this.uploadDir, relative);
    if(target === this.uploadDir || !target.startsWith(`${this.uploadDir}${path.sep}`)) return null;
    return target;
  }

  delete(urlValue){
    const target = this.resolve(urlValue);
    if(!target) throw new Error('Можно удалить только загруженный файл');
    if(!fs.existsSync(target)) return false;
    fs.unlinkSync(target);
    return true;
  }

  list(){
    this.ensure();
    const files = [];
    const walk = directory => {
      fs.readdirSync(directory, {withFileTypes:true}).forEach(entry => {
        const target = path.join(directory, entry.name);
        if(entry.isDirectory()) walk(target);
        if(entry.isFile()){
          const stats = fs.statSync(target);
          const relative = path.relative(this.uploadDir, target).split(path.sep).join('/');
          files.push({url:`${this.publicPath}/${relative}`, size:stats.size, updatedAt:stats.mtime.toISOString()});
        }
      });
    };
    walk(this.uploadDir);
    return files.sort((a,b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  info(){
    const files = this.list();
    return {
      driver:this.driver,
      persistent:this.persistent,
      files:files.length,
      size:files.reduce((sum, item) => sum + item.size, 0),
      maxBytes:this.maxBytes,
      publicPath:this.publicPath
    };
  }
}

function createFileMedia(options){
  return new FileMedia(options);
}

module.exports = {createFileMedia, TYPES};
