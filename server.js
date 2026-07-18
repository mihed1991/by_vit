const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const vm = require('vm');
const {createStorage} = require('./lib/storage');

const ROOT = __dirname;
const DEFAULT_DATA_DIR = path.join(ROOT, 'data');
const VOLUME_DATA_DIR = String(process.env.BYVIT_DATA_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH || '').trim();
const DATA_DIR = path.resolve(VOLUME_DATA_DIR || DEFAULT_DATA_DIR);
const BACKUP_DIR = path.resolve(String(process.env.BYVIT_BACKUP_DIR || '').trim() || path.join(DATA_DIR, 'backups'));
const PORT = Number(process.env.PORT || 3000);
const ADMIN_PASSWORD_HASH = '8e9b669109df89620b94f2387dc53206a82ddc71d658f8f7a2b3a9b417370d3e';
const SESSION_COOKIE = 'byvit_admin_session';
const MAX_BODY = 35 * 1024 * 1024;
const MAX_BACKUPS = Number(process.env.BYVIT_MAX_BACKUPS || 12);
const BACKUP_TOKEN = String(process.env.BYVIT_BACKUP_TOKEN || '').trim();
const STORAGE_DRIVER = String(process.env.BYVIT_STORAGE_DRIVER || 'file').trim().toLowerCase();
const STORAGE_PERSISTENT = /^(1|true|yes)$/i.test(String(process.env.BYVIT_STORAGE_PERSISTENT || '')) || Boolean(VOLUME_DATA_DIR);
const storage = createStorage({driver:STORAGE_DRIVER, dataDir:DATA_DIR, backupDir:BACKUP_DIR, maxBackups:MAX_BACKUPS, persistent:STORAGE_PERSISTENT});

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

function initialStore(defaults){
  return {
    products:clone(defaults.products || []),
    site:clone(defaults.site || {}),
    reviews:clone(defaults.reviews || []),
    orders:[],
    analytics:emptyAnalytics(),
    meta:{createdAt:new Date().toISOString(), recoveredCatalogAt:''}
  };
}

function emptyAnalytics(){
  return {
    totals:{pageViews:0, productViews:0, addToCart:0, orders:0, unitsOrdered:0, revenue:0},
    days:{},
    pages:{},
    products:{}
  };
}

function normalizeAnalytics(value){
  const defaults = emptyAnalytics();
  const source = value && typeof value === 'object' ? value : {};
  return {
    totals:{...defaults.totals, ...(source.totals || {})},
    days:source.days && typeof source.days === 'object' ? source.days : {},
    pages:source.pages && typeof source.pages === 'object' ? source.pages : {},
    products:source.products && typeof source.products === 'object' ? source.products : {}
  };
}

function analyticsBucket(store){
  store.analytics = normalizeAnalytics(store.analytics);
  const dayKey = new Date().toISOString().slice(0, 10);
  const dayDefaults = {pageViews:0, productViews:0, addToCart:0, orders:0, unitsOrdered:0, revenue:0};
  store.analytics.days[dayKey] = {...dayDefaults, ...(store.analytics.days[dayKey] || {})};
  const dayKeys = Object.keys(store.analytics.days).sort();
  dayKeys.slice(0, Math.max(0, dayKeys.length - 90)).forEach(key => delete store.analytics.days[key]);
  return {analytics:store.analytics, day:store.analytics.days[dayKey]};
}

function incrementMetric(target, key, amount=1){
  target[key] = Number(target[key] || 0) + Number(amount || 0);
}

function recordAnalyticsEvent(store, type, data={}){
  const {analytics, day} = analyticsBucket(store);
  const metricMap = {page_view:'pageViews', product_view:'productViews', add_to_cart:'addToCart'};
  const metric = metricMap[type];
  if(!metric) return false;
  incrementMetric(analytics.totals, metric);
  incrementMetric(day, metric);
  const productId = Number(data.productId || 0);
  if(type === 'page_view'){
    const page = String(data.page || 'unknown').replace(/[^a-z0-9_-]/gi, '').slice(0, 32) || 'unknown';
    incrementMetric(analytics.pages, page);
  }
  if(productId && (type === 'product_view' || type === 'add_to_cart')){
    if(!store.products.some(product => Number(product.id) === productId)) return true;
    const key = String(productId);
    analytics.products[key] = {views:0, addToCart:0, orders:0, unitsOrdered:0, ...(analytics.products[key] || {})};
    incrementMetric(analytics.products[key], type === 'product_view' ? 'views' : 'addToCart');
  }
  return true;
}

function recordOrderAnalytics(store, order){
  const {analytics, day} = analyticsBucket(store);
  incrementMetric(analytics.totals, 'orders');
  incrementMetric(day, 'orders');
  incrementMetric(analytics.totals, 'revenue', Number(order.total || 0));
  incrementMetric(day, 'revenue', Number(order.total || 0));
  (order.items || []).forEach(item => {
    const productId = Number(item.productId || item.id || 0);
    const qty = Math.max(1, Number(item.qty || 1));
    incrementMetric(analytics.totals, 'unitsOrdered', qty);
    incrementMetric(day, 'unitsOrdered', qty);
    if(!productId) return;
    const key = String(productId);
    analytics.products[key] = {views:0, addToCart:0, orders:0, unitsOrdered:0, ...(analytics.products[key] || {})};
    incrementMetric(analytics.products[key], 'orders');
    incrementMetric(analytics.products[key], 'unitsOrdered', qty);
  });
}

function loadStore(){
  const defaults = loadDefaults();
  storage.ensure();
  if(!storage.exists()){
    const initial = initialStore(defaults);
    saveStore(initial, {backup:false});
    return initial;
  }
  let stored;
  try{
    stored = storage.read();
  }catch(error){
    console.error('Store is corrupted, restoring defaults:', error.message);
    const initial = initialStore(defaults);
    saveStore(initial);
    return initial;
  }
  const normalized = {
    products:Array.isArray(stored.products) ? stored.products : clone(defaults.products || []),
    site:stored.site && typeof stored.site === 'object' ? stored.site : clone(defaults.site || {}),
    reviews:Array.isArray(stored.reviews) ? stored.reviews : clone(defaults.reviews || []),
    orders:Array.isArray(stored.orders) ? stored.orders : [],
    analytics:normalizeAnalytics(stored.analytics),
    meta:stored.meta && typeof stored.meta === 'object' ? stored.meta : {}
  };
  const canRecoverCatalog = normalized.site.allowEmptyCatalog !== true && (defaults.products || []).length > 0;
  if(!normalized.products.length && canRecoverCatalog){
    normalized.products = clone(defaults.products);
    normalized.meta.recoveredCatalogAt = new Date().toISOString();
    console.warn(`Empty catalog recovered with ${normalized.products.length} default products.`);
    saveStore(normalized);
  }
  return normalized;
}

function saveStore(store, options={}){
  storage.write(store, options);
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
    orders:[],
    catalogEmptyAllowed:store.site?.allowEmptyCatalog === true
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

function backupPayload(store){
  return {version:4, exportedAt:new Date().toISOString(), data:store};
}

function sendJsonDownload(res, filename, value){
  const payload = JSON.stringify(value, null, 2);
  res.writeHead(200, {
    'Content-Type':'application/json; charset=utf-8',
    'Content-Disposition':`attachment; filename="${filename}"`,
    'Content-Length':Buffer.byteLength(payload),
    'Cache-Control':'no-store'
  });
  res.end(payload);
}

function backupFileName(){
  const stamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
  return `byvit-server-backup-${stamp}.json`;
}

function requestOrigin(req){
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  const protocol = forwardedProto || (req.socket.encrypted ? 'https' : 'http');
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || 'localhost').split(',')[0].trim();
  return `${protocol}://${host}`;
}

function xmlEscape(value){
  return String(value || '').replace(/[<>&'\"]/g, char => ({'<':'&lt;','>':'&gt;','&':'&amp;',"'":'&apos;','"':'&quot;'}[char]));
}

function handleSeoFile(req, res){
  const url = new URL(req.url, requestOrigin(req));
  const origin = requestOrigin(req);
  if(url.pathname === '/robots.txt'){
    const body = [
      'User-agent: *',
      'Allow: /',
      'Disallow: /admin.html',
      'Disallow: /cart.html',
      'Disallow: /wishlist.html',
      'Disallow: /compare.html',
      `Sitemap: ${origin}/sitemap.xml`,
      ''
    ].join('\n');
    send(res, 200, body, {'Content-Type':'text/plain; charset=utf-8', 'Cache-Control':'public, max-age=3600'});
    return true;
  }
  if(url.pathname === '/sitemap.xml'){
    const store = loadStore();
    const staticPages = [
      '/', '/catalog.html', '/brands.html', '/sale.html', '/delivery.html',
      '/stores.html', '/about.html', '/faq.html'
    ];
    const productPages = store.products.map(product => `/product.html?id=${encodeURIComponent(product.id)}`);
    const entries = [...staticPages, ...productPages].map(pathname =>
      `  <url><loc>${xmlEscape(new URL(pathname, origin).href)}</loc></url>`
    ).join('\n');
    const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`;
    send(res, 200, body, {'Content-Type':'application/xml; charset=utf-8', 'Cache-Control':'public, max-age=3600'});
    return true;
  }
  return false;
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

function bearerToken(req){
  const value = String(req.headers.authorization || '');
  return value.startsWith('Bearer ') ? value.slice(7).trim() : '';
}

function tokenMatches(expected, actual){
  if(!expected || !actual) return false;
  const left = Buffer.from(expected);
  const right = Buffer.from(actual);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function requireBackupAccess(req, res){
  if(isAdmin(req) || tokenMatches(BACKUP_TOKEN, bearerToken(req))) return true;
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
      const storageInfo = storage.info();
      send(res, 200, {
        ok:true,
        products:store.products.length,
        storage:storageInfo.persistent ? 'persistent' : 'ephemeral',
        storageDriver:storageInfo.driver,
        storageUpdatedAt:storageInfo.updatedAt,
        backups:storageInfo.backups,
        recoveredCatalogAt:store.meta?.recoveredCatalogAt || ''
      });
      return;
    }
    if(req.method === 'GET' && url.pathname === '/api/backup'){
      if(!requireBackupAccess(req, res)) return;
      sendJsonDownload(res, backupFileName(), backupPayload(store));
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
    if(req.method === 'GET' && url.pathname === '/api/admin/backups'){
      if(!requireAdmin(req, res)) return;
      send(res, 200, {storage:storage.info(), backups:storage.listBackups(), externalExport:Boolean(BACKUP_TOKEN)});
      return;
    }
    if(req.method === 'GET' && url.pathname === '/api/admin/backup/download'){
      if(!requireAdmin(req, res)) return;
      sendJsonDownload(res, backupFileName(), backupPayload(store));
      return;
    }
    if(req.method === 'POST' && url.pathname === '/api/admin/backups'){
      if(!requireAdmin(req, res)) return;
      const backup = storage.createBackup('manual');
      send(res, 201, {ok:true, backup, storage:storage.info(), backups:storage.listBackups()});
      return;
    }
    if(req.method === 'POST' && url.pathname === '/api/admin/backups/restore'){
      if(!requireAdmin(req, res)) return;
      const body = await readJson(req);
      storage.restoreBackup(body.name);
      const restoredStore = loadStore();
      send(res, 200, {ok:true, store:restoredStore, storage:storage.info(), backups:storage.listBackups()});
      return;
    }
    if(req.method === 'POST' && url.pathname === '/api/analytics'){
      const body = await readJson(req);
      const type = String(body.type || '');
      const analyticsStore = loadStore();
      if(!recordAnalyticsEvent(analyticsStore, type, {productId:body.productId, page:body.page})){
        send(res, 400, {error:'Unsupported analytics event'});
        return;
      }
      saveStore(analyticsStore, {backup:false});
      send(res, 201, {ok:true});
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
      const adminStore = loadStore();
      if(Array.isArray(body.products)){
        const allowEmptyCatalog = body.allowEmptyCatalog === true || body.site?.allowEmptyCatalog === true;
        if(!body.products.length && !allowEmptyCatalog){
          send(res, 400, {error:'Каталог не может быть пустым. Включите allowEmptyCatalog только для намеренного отключения витрины.'});
          return;
        }
        adminStore.products = body.products;
      }
      if(body.site && typeof body.site === 'object') adminStore.site = body.site;
      if(Array.isArray(body.reviews)) adminStore.reviews = body.reviews;
      if(Array.isArray(body.orders)) adminStore.orders = body.orders;
      if(body.restoreAnalytics === true && body.analytics && typeof body.analytics === 'object') adminStore.analytics = normalizeAnalytics(body.analytics);
      saveStore(adminStore);
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
      const orderStore = loadStore();
      orderStore.orders.unshift(order);
      recordOrderAnalytics(orderStore, order);
      saveStore(orderStore);
      sendTelegram(orderStore.site, order).catch(error => console.error('Telegram error:', error.message));
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
      const reviewStore = loadStore();
      reviewStore.reviews.unshift(review);
      saveStore(reviewStore);
      send(res, 201, {ok:true, review});
      return;
    }
    send(res, 404, {error:'Not found'});
  }catch(error){
    send(res, 500, {error:error.message || 'Server error'});
  }
}

const server = http.createServer((req, res) => {
  if(handleSeoFile(req, res)) return;
  if(req.url.startsWith('/api/')){
    handleApi(req, res);
    return;
  }
  serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`ByVit MVP server: http://localhost:${PORT}`);
});
