const fs = require('fs');
const path = require('path');

function safeInteger(value, fallback){
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

function safeReason(value){
  return String(value || 'save').toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32) || 'save';
}

function assertBackupName(value){
  const name = path.basename(String(value || ''));
  if(!/^store-[a-z0-9._-]+\.json$/i.test(name)) throw new Error('Invalid backup name');
  return name;
}

class FileStorage {
  constructor(options={}){
    this.driver = 'file';
    this.dataDir = path.resolve(options.dataDir);
    this.backupDir = path.resolve(options.backupDir || path.join(this.dataDir, 'backups'));
    this.storePath = path.join(this.dataDir, options.fileName || 'store.json');
    this.maxBackups = safeInteger(options.maxBackups, 12);
    this.persistent = options.persistent === true;
  }

  ensure(){
    fs.mkdirSync(this.dataDir, {recursive:true});
    fs.mkdirSync(this.backupDir, {recursive:true});
  }

  exists(){
    return fs.existsSync(this.storePath);
  }

  read(){
    if(!this.exists()) return null;
    return JSON.parse(fs.readFileSync(this.storePath, 'utf8'));
  }

  write(value, options={}){
    this.ensure();
    if(options.backup !== false && this.exists()) this.createBackup(options.reason || 'before-save');
    const tempPath = `${this.storePath}.${process.pid}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(value, null, 2));
    fs.renameSync(tempPath, this.storePath);
    return this.info();
  }

  createBackup(reason='manual'){
    this.ensure();
    if(!this.exists()) return null;
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const name = `store-${stamp}-${safeReason(reason)}.json`;
    const target = path.join(this.backupDir, name);
    fs.copyFileSync(this.storePath, target);
    this.pruneBackups();
    return this.backupInfo(name);
  }

  backupInfo(name){
    const safeName = assertBackupName(name);
    const stats = fs.statSync(path.join(this.backupDir, safeName));
    return {name:safeName, createdAt:stats.mtime.toISOString(), size:stats.size};
  }

  listBackups(){
    this.ensure();
    return fs.readdirSync(this.backupDir)
      .filter(name => /^store-[a-z0-9._-]+\.json$/i.test(name))
      .map(name => this.backupInfo(name))
      .sort((a,b) => b.createdAt.localeCompare(a.createdAt));
  }

  pruneBackups(){
    this.listBackups().slice(this.maxBackups).forEach(item => {
      fs.unlinkSync(path.join(this.backupDir, item.name));
    });
  }

  readBackup(name){
    const safeName = assertBackupName(name);
    return JSON.parse(fs.readFileSync(path.join(this.backupDir, safeName), 'utf8'));
  }

  restoreBackup(name){
    const value = this.readBackup(name);
    this.write(value, {backup:true, reason:'before-restore'});
    return value;
  }

  info(){
    this.ensure();
    const stats = this.exists() ? fs.statSync(this.storePath) : null;
    return {
      driver:this.driver,
      persistent:this.persistent,
      updatedAt:stats ? stats.mtime.toISOString() : '',
      size:stats ? stats.size : 0,
      backups:this.listBackups().length,
      maxBackups:this.maxBackups
    };
  }
}

function createFileStorage(options){
  return new FileStorage(options);
}

module.exports = {createFileStorage};
