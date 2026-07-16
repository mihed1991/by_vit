const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const vm = require('vm');

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const STORE_PATH = path.join(DATA_DIR, 'store.json');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const PORT = Number(process.env.PORT || 3000);
const ADMIN_PASSWORD_HASH = '8e9b669109df89620b94f2387dc53206a82ddc71d658f8f7a2b3a9b417370d3e';
const SESSION_COOKIE = 'byvit_admin_session';
const MAX_BODY = 35 * 1024 * 1024;
const MAX_BACKUPS = 12;

const sessions = new Map();

function loadDefaults(){
  const code = fs.readFileSync(path.join(ROOT, 'js', 'data.js'), 'utf8');
  const sandbox = {window:{}, encodeURIComponent};
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, {filename:'js/data.js'});
  return sandbox.window.ByVitDefaults || {products:[], site:{}, reviews:[]};
}

function clone(value){
  return JSON.parse(JSON.stringify(value));
}

function ensureDataDir(){
  fs.mkdirSync(DATA_DIR, {recursive:true});
}

function backupStore(){
  if(!fs.existsSync(STORE_PATH)) return;
  fs.mkdirSync(BACKUP_DIR, {recursive:true});
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  fs.copyFileSync(STORE_PATH, path.join(BACKUP_DIR, `store-${stamp}.json`));
  const files = fs.readdirSync(BACKUP_DIR)
    .filter(name => /^store-.+\.json$/.test(name))
    .sort();
  files.slice(0, Math.max(0, files.length - MAX_BACKUPS)).forEach(name => {
    fs.unlinkSync(path.join(BACKUP_DIR, name));
  });
}

function loadStore(){
  const defaults = loadDefaults();
  ensureDataDir();
  if(!fs.existsSync(STORE_PATH)){
    const initial = {
      products:clone(defaults.products || []),
      site:clone(defaults.site || {}),
      reviews:clone(defaults.reviews || []),
      orders:[]
    };
    saveStore(initial);
    return initial;
  }
  const stored = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
  return {
    products:Array.isArray(stored.products) ? stored.products : clone(defaults.products || []),
    site:stored.site && typeof stored.site === 'object' ? stored.site : clone(defaults.site || {}),
    reviews:Array.isArray(stored.reviews) ? stored.reviews : clone(defaults.reviews || []),
    orders:Array.isArray(stored.orders) ? stored.orders : []
  };
}

function saveStore(store){
  ensureDataDir();
  backupStore();
  const temp = `${STORE_PATH}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(store, null, 2));
  fs.renameSync(temp, STORE_PATH);
}

function publicSite(site){
  const safe = clone(site || {});
  delete safe.adminPasswordHash;
  safe.telegram = {contact:safe.telegram?.contact || ''};
  return safe;
}

function publicState(store){
  return {
    products:store.products,
    site:publicSite(store.site),
    reviews:store.reviews.filter(review => review.status === 'approved'),
    orders:[]
  };
}

function send(res, status, body, headers={}){
  const payload = typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': typeof body === 'string' ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8',
    'Cache-Control':'no-store',
    ...headers
  });
  res.end(payload);
}

function parseCookies(req){
  return Object.fromEntries(String(req.headers.cookie || '').split(';').map(part => part.trim()).filter(Boolean).map(part => {
    const index = part.indexOf('=');
    return index >= 0 ? [part.slice(0, index), decodeURIComponent(part.slice(index + 1))] : [part, ''];
  }));
}

function isAdmin(req){
  const token = parseCookies(req)[SESSION_COOKIE];
  return Boolean(token && sessions.has(token));
}

function requireAdmin(req, res){
  if(isAdmin(req)) return true;
  send(res, 401, {error:'Unauthorized'});
  return false;
}

function readJson(req){
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', chunk => {
      size += chunk.length;
      if(size > MAX_BODY){
        reject(new Error('Request body is too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if(!chunks.length){ resolve({}); return; }
      try{ resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch(error){ reject(error); }
    });
    req.on('error', reject);
  });
}

function sha256(value){
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function money(value){
  const num = Number(value || 0);
  const formatted = Number.isInteger(num) ? String(num) : num.toFixed(2).replace('.', ',');
  return `${formatted} BYN`;
}

function buildOrderText(order){
  const lines = [];
  lines.push('🟢 Новый заказ ');
  lines.push(`ByVit #${order.id}`);
  lines.push('');
  lines.push(`Имя: ${order.customer?.name || ''}`);
  lines.push(`Телефон: ${order.customer?.phone || ''}`);
  lines.push(`Получение: ${order.deliveryTitle || ''}`);
  lines.push(`Адрес/отделение: ${order.pickupStore ? ([order.pickupStore.title, order.pickupStore.address].filter(Boolean).join(' - ') || '—') : (order.customer?.address || '—')}`);
  lines.push(`Оплата: ${order.payment || ''}`);
  lines.push(`Промокод: ${order.promo || ''}`);
  if(order.comment) lines.push(`Комментарий: ${order.comment}`);
  lines.push('');
  lines.push('Товары:');
  (order.items || []).forEach((item, index) => {
    const details = [item.optionLabel, item.flavor].filter(Boolean).join(', ');
    lines.push(`   ${index + 1}. ${item.name || 'Товар'} `);
    lines.push(`       — ${details || '1 шт.'} × ${item.qty || 1} = ${money(item.lineTotal)}`);
  });
  lines.push('');
  lines.push(`Скидка: −${money(order.discount || 0)}`);
  lines.push(`Итого: ${money(order.total)}`);
  lines.push('');
  return lines.join('\n');
}

function telegramRecipients(site){
  return String(site?.telegram?.chatId || '')
    .split(/[\n,;]+/)
    .map(item => item.trim())
    .filter(Boolean)
    .filter((item, index, list) => list.indexOf(item) === index);
}

function postForm(url, form){
  return new Promise((resolve, reject) => {
    const data = new URLSearchParams(form).toString();
    const request = https.request(url, {
      method:'POST',
      headers:{
        'Content-Type':'application/x-www-form-urlencoded',
        'Content-Length':Buffer.byteLength(data)
      }
    }, response => {
      response.resume();
      response.on('end', () => resolve(response.statusCode));
    });
    request.on('error', reject);
    request.write(data);
    request.end();
  });
}

async function sendTelegram(site, order){
  const token = site?.telegram?.botToken;
  const recipients = telegramRecipients(site);
  if(!token || !recipients.length) return {skipped:true};
  const text = buildOrderText(order);
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const results = await Promise.allSettled(recipients.map(chatId => postForm(url, {chat_id:chatId, text})));
  return {ok:true, count:recipients.length, results};
}

function contentType(filePath){
  const ext = path.extname(filePath).toLowerCase();
  return {
    '.html':'text/html; charset=utf-8',
    '.css':'text/css; charset=utf-8',
    '.js':'application/javascript; charset=utf-8',
    '.json':'application/json; charset=utf-8',
    '.png':'image/png',
    '.jpg':'image/jpeg',
    '.jpeg':'image/jpeg',
    '.svg':'image/svg+xml',
    '.webp':'image/webp',
    '.mp4':'video/mp4',
    '.txt':'text/plain; charset=utf-8'
  }[ext] || 'application/octet-stream';
}

function serveStatic(req, res){
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
  const resolved = path.normalize(path.join(ROOT, pathname));
  if(!resolved.startsWith(ROOT) || resolved.includes(`${path.sep}data${path.sep}`)){
    send(res, 403, 'Forbidden');
    return;
  }
  fs.readFile(resolved, (error, data) => {
    if(error){ send(res, 404, 'Not found'); return; }
    res.writeHead(200, {'Content-Type':contentType(resolved)});
    res.end(data);
  });
}

async function handleApi(req, res){
  const store = loadStore();
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  try{
    if(req.method === 'GET' && url.pathname === '/api/health'){
      send(res, 200, {ok:true});
      return;
    }
    if(req.method === 'GET' && url.pathname === '/api/state'){
      send(res, 200, publicState(store));
      return;
    }
    if(req.method === 'GET' && url.pathname === '/api/admin/state'){
      if(!requireAdmin(req, res)) return;
      send(res, 200, store);
      return;
    }
    if(req.method === 'POST' && url.pathname === '/api/admin/login'){
      const body = await readJson(req);
      const hash = sha256(body.password || '');
      const expected = store.site?.adminPasswordHash || ADMIN_PASSWORD_HASH;
      if(hash !== expected){
        send(res, 403, {error:'Wrong password'});
        return;
      }
      const token = crypto.randomBytes(24).toString('hex');
      sessions.set(token, {createdAt:Date.now()});
      send(res, 200, {ok:true}, {'Set-Cookie':`${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/`});
      return;
    }
    if(req.method === 'POST' && url.pathname === '/api/admin/logout'){
      const token = parseCookies(req)[SESSION_COOKIE];
      if(token) sessions.delete(token);
      send(res, 200, {ok:true}, {'Set-Cookie':`${SESSION_COOKIE}=; Max-Age=0; SameSite=Lax; Path=/`});
      return;
    }
    if(req.method === 'PUT' && url.pathname === '/api/admin/state'){
      if(!requireAdmin(req, res)) return;
      const body = await readJson(req);
      if(Array.isArray(body.products)) store.products = body.products;
      if(body.site && typeof body.site === 'object') store.site = body.site;
      if(Array.isArray(body.reviews)) store.reviews = body.reviews;
      if(Array.isArray(body.orders)) store.orders = body.orders;
      saveStore(store);
      send(res, 200, {ok:true});
      return;
    }
    if(req.method === 'POST' && url.pathname === '/api/orders'){
      const body = await readJson(req);
      const order = body.order || body;
      if(!order.customer?.name || !order.customer?.phone || !Array.isArray(order.items) || !order.items.length){
        send(res, 400, {error:'Invalid order'});
        return;
      }
      order.id = order.id || Date.now();
      order.date = order.date || new Date().toLocaleString('ru-RU');
      order.status = order.status || 'new';
      store.orders.unshift(order);
      saveStore(store);
      sendTelegram(store.site, order).catch(error => console.error('Telegram error:', error.message));
      send(res, 201, {ok:true, order});
      return;
    }
    if(req.method === 'POST' && url.pathname === '/api/reviews'){
      const body = await readJson(req);
      if(!body.productId || !body.name || !body.text){
        send(res, 400, {error:'Invalid review'});
        return;
      }
      const review = {
        id:Date.now(),
        productId:Number(body.productId),
        name:String(body.name).trim(),
        rating:Number(body.rating || 5),
        text:String(body.text).trim(),
        status:'pending',
        date:new Date().toLocaleDateString('ru-RU')
      };
      store.reviews.unshift(review);
      saveStore(store);
      send(res, 201, {ok:true, review});
      return;
    }
    send(res, 404, {error:'Not found'});
  }catch(error){
    send(res, 500, {error:error.message || 'Server error'});
  }
}

const server = http.createServer((req, res) => {
  if(req.url.startsWith('/api/')){
    handleApi(req, res);
    return;
  }
  serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`ByVit MVP server: http://localhost:${PORT}`);
});
