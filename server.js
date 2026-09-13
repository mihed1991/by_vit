const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const vm = require('vm');
const { createStorage } = require('./lib/storage');
const { createMedia } = require('./lib/media');
const { createMoySkladClient, mappingFor } = require('./lib/moysklad');

const ROOT = __dirname;
const DEFAULT_DATA_DIR = path.join(ROOT, 'data');
const VOLUME_DATA_DIR = String(process.env.BYVIT_DATA_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH || '').trim();
const DATA_DIR = path.resolve(VOLUME_DATA_DIR || DEFAULT_DATA_DIR);
const BACKUP_DIR = path.resolve(String(process.env.BYVIT_BACKUP_DIR || '').trim() || path.join(DATA_DIR, 'backups'));
const PORT = Number(process.env.PORT || 3000);
const NODE_ENV = String(process.env.NODE_ENV || 'development').trim().toLowerCase();
const IS_PRODUCTION = NODE_ENV === 'production';
const TRUST_PROXY = /^(1|true|yes)$/i.test(String(process.env.BYVIT_TRUST_PROXY || ''));
const ADMIN_PASSWORD = String(process.env.BYVIT_ADMIN_PASSWORD || '');
const ADMIN_PASSWORD_HASH = String(process.env.BYVIT_ADMIN_PASSWORD_HASH || '').trim() || (ADMIN_PASSWORD ? createPasswordHash(ADMIN_PASSWORD) : '');
const SESSION_COOKIE = 'byvit_admin_session';
const SESSION_TTL_MS = Math.max(5 * 60 * 1000, Number(process.env.BYVIT_SESSION_TTL_MS || 12 * 60 * 60 * 1000));
const MAX_BODY = 35 * 1024 * 1024;
const MAX_BACKUPS = Number(process.env.BYVIT_MAX_BACKUPS || 12);
const BACKUP_TOKEN = String(process.env.BYVIT_BACKUP_TOKEN || '').trim();
const PUBLIC_URL = String(process.env.BYVIT_PUBLIC_URL || '').trim();
const ADMIN_RECOVERY_BOT_TOKEN = String(process.env.BYVIT_ADMIN_RECOVERY_BOT_TOKEN || '').trim();
const ADMIN_RECOVERY_CHAT_IDS = String(process.env.BYVIT_ADMIN_RECOVERY_CHAT_IDS || '').trim();
const ADMIN_RECOVERY_TTL_MS = Math.max(60 * 1000, Number(process.env.BYVIT_ADMIN_RECOVERY_TTL_MS || 10 * 60 * 1000));
const ADMIN_RECOVERY_REQUEST_WINDOW_MS = 15 * 60 * 1000;
const ADMIN_RECOVERY_REQUEST_LIMIT = 3;
const ADMIN_RECOVERY_ATTEMPT_LIMIT = 5;
const STORAGE_DRIVER = String(process.env.BYVIT_STORAGE_DRIVER || 'file').trim().toLowerCase();
const DATABASE_URL = String(process.env.DATABASE_URL || '').trim();
const DATABASE_SSL = /^(1|true|yes)$/i.test(String(process.env.BYVIT_DATABASE_SSL || ''));
const DATABASE_SSL_REJECT_UNAUTHORIZED = !/^(0|false|no)$/i.test(String(process.env.BYVIT_DATABASE_SSL_REJECT_UNAUTHORIZED || ''));
const STORAGE_PERSISTENT = ['postgres', 'postgresql'].includes(STORAGE_DRIVER) || /^(1|true|yes)$/i.test(String(process.env.BYVIT_STORAGE_PERSISTENT || '')) || Boolean(VOLUME_DATA_DIR);
const storage = createStorage({
  driver: STORAGE_DRIVER,
  dataDir: DATA_DIR,
  backupDir: BACKUP_DIR,
  maxBackups: MAX_BACKUPS,
  persistent: STORAGE_PERSISTENT,
  databaseUrl: DATABASE_URL,
  poolSize: Number(process.env.BYVIT_DATABASE_POOL_SIZE || 10),
  ssl: DATABASE_SSL,
  sslRejectUnauthorized: DATABASE_SSL_REJECT_UNAUTHORIZED
});
const MEDIA_DRIVER = String(process.env.BYVIT_MEDIA_DRIVER || 'file').trim().toLowerCase();
const UPLOAD_DIR = path.resolve(String(process.env.BYVIT_UPLOAD_DIR || '').trim() || path.join(DATA_DIR, 'uploads'));
const MAX_UPLOAD_BYTES = Math.max(1024, Number(process.env.BYVIT_UPLOAD_MAX_BYTES || 25 * 1024 * 1024));
const MEDIA_PERSISTENT = /^(1|true|yes)$/i.test(String(process.env.BYVIT_MEDIA_PERSISTENT || '')) || Boolean(VOLUME_DATA_DIR);
const media = createMedia({ driver: MEDIA_DRIVER, uploadDir: UPLOAD_DIR, publicPath: '/uploads', maxBytes: MAX_UPLOAD_BYTES, persistent: MEDIA_PERSISTENT });
const MOYSKLAD_ENABLED = /^(1|true|yes)$/i.test(String(process.env.MOYSKLAD_ENABLED || ''));
const MOYSKLAD_TOKEN = String(process.env.MOYSKLAD_TOKEN || '').trim();
const MOYSKLAD_API_BASE = String(process.env.MOYSKLAD_API_BASE || 'https://api.moysklad.ru/api/remap/1.2').trim();
const MOYSKLAD_STOCK_ENDPOINT = String(process.env.MOYSKLAD_STOCK_ENDPOINT || '/report/stock/all').trim();
const MOYSKLAD_SYNC_INTERVAL_MS = Math.max(60_000, Number(process.env.MOYSKLAD_SYNC_INTERVAL_MS || 300_000));
const MOYSKLAD_WEBHOOK_SECRET = String(process.env.MOYSKLAD_WEBHOOK_SECRET || '').trim();
const moysklad = createMoySkladClient({
  token: MOYSKLAD_TOKEN,
  baseUrl: MOYSKLAD_API_BASE,
  stockEndpoint: MOYSKLAD_STOCK_ENDPOINT
});

const sessions = new Map();
const recoveryChallenges = new Map();
const recoveryRequestLog = new Map();
const telegramLinkChallenges = new Map();
const telegramUpdateOffsets = new Map();
const telegramUpdatePolls = new Map();
const rateLimitBuckets = new Map();
const ALLOWED_ORIGINS = new Set(String(process.env.BYVIT_ALLOWED_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean));
const PUBLIC_HTML_FILES = new Set([
  '/index.html', '/about.html', '/admin.html', '/brands.html', '/cart.html', '/catalog.html',
  '/compare.html', '/delivery.html', '/faq.html', '/product.html', '/sale.html', '/stores.html',
  '/wishlist.html'
]);
const PUBLIC_ASSET_PREFIXES = ['/assets/', '/css/', '/js/'];
let moyskladSyncTimer = null;
let moyskladSyncInterval = null;

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function loadDefaults() {
  const code = fs.readFileSync(path.join(ROOT, 'js', 'data.js'), 'utf8');
  const sandbox = { window: {}, encodeURIComponent };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: 'js/data.js' });
  return sandbox.window.ByVitDefaults || { products: [], site: {}, reviews: [] };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function initialStore(defaults) {
  return {
    products: clone(defaults.products || []),
    site: clone(defaults.site || {}),
    reviews: clone(defaults.reviews || []),
    orders: [],
    analytics: emptyAnalytics(),
    meta: { createdAt: new Date().toISOString(), recoveredCatalogAt: '' }
  };
}

function emptyAnalytics() {
  return {
    totals: { pageViews: 0, productViews: 0, addToCart: 0, orders: 0, unitsOrdered: 0, revenue: 0 },
    days: {},
    pages: {},
    products: {}
  };
}

function normalizeAnalytics(value) {
  const defaults = emptyAnalytics();
  const source = value && typeof value === 'object' ? value : {};
  return {
    totals: { ...defaults.totals, ...(source.totals || {}) },
    days: source.days && typeof source.days === 'object' ? source.days : {},
    pages: source.pages && typeof source.pages === 'object' ? source.pages : {},
    products: source.products && typeof source.products === 'object' ? source.products : {}
  };
}

function analyticsBucket(store) {
  store.analytics = normalizeAnalytics(store.analytics);
  const dayKey = new Date().toISOString().slice(0, 10);
  const dayDefaults = { pageViews: 0, productViews: 0, addToCart: 0, orders: 0, unitsOrdered: 0, revenue: 0 };
  store.analytics.days[dayKey] = { ...dayDefaults, ...(store.analytics.days[dayKey] || {}) };
  const dayKeys = Object.keys(store.analytics.days).sort();
  dayKeys.slice(0, Math.max(0, dayKeys.length - 90)).forEach(key => delete store.analytics.days[key]);
  return { analytics: store.analytics, day: store.analytics.days[dayKey] };
}

function incrementMetric(target, key, amount = 1) {
  target[key] = Number(target[key] || 0) + Number(amount || 0);
}

function recordAnalyticsEvent(store, type, data = {}) {
  const { analytics, day } = analyticsBucket(store);
  const metricMap = { page_view: 'pageViews', product_view: 'productViews', add_to_cart: 'addToCart' };
  const metric = metricMap[type];
  if (!metric) return false;
  incrementMetric(analytics.totals, metric);
  incrementMetric(day, metric);
  const productId = Number(data.productId || 0);
  if (type === 'page_view') {
    const page = String(data.page || 'unknown').replace(/[^a-z0-9_-]/gi, '').slice(0, 32) || 'unknown';
    incrementMetric(analytics.pages, page);
  }
  if (productId && (type === 'product_view' || type === 'add_to_cart')) {
    if (!store.products.some(product => Number(product.id) === productId)) return true;
    const key = String(productId);
    analytics.products[key] = { views: 0, addToCart: 0, orders: 0, unitsOrdered: 0, ...(analytics.products[key] || {}) };
    incrementMetric(analytics.products[key], type === 'product_view' ? 'views' : 'addToCart');
  }
  return true;
}

function recordOrderAnalytics(store, order) {
  const { analytics, day } = analyticsBucket(store);
  incrementMetric(analytics.totals, 'orders');
  incrementMetric(day, 'orders');
  incrementMetric(analytics.totals, 'revenue', Number(order.total || 0));
  incrementMetric(day, 'revenue', Number(order.total || 0));
  (order.items || []).forEach(item => {
    const productId = Number(item.productId || item.id || 0);
    const qty = Math.max(1, Number(item.qty || 1));
    incrementMetric(analytics.totals, 'unitsOrdered', qty);
    incrementMetric(day, 'unitsOrdered', qty);
    if (!productId) return;
    const key = String(productId);
    analytics.products[key] = { views: 0, addToCart: 0, orders: 0, unitsOrdered: 0, ...(analytics.products[key] || {}) };
    incrementMetric(analytics.products[key], 'orders');
    incrementMetric(analytics.products[key], 'unitsOrdered', qty);
  });
}

async function loadStore() {
  const defaults = loadDefaults();
  await storage.ensure();
  if (!await storage.exists()) {
    const initial = initialStore(defaults);
    await saveStore(initial, { backup: false });
    return initial;
  }
  let stored;
  try {
    stored = await storage.read();
  } catch (error) {
    console.error('Store is corrupted, restoring defaults:', error.message);
    const initial = initialStore(defaults);
    await saveStore(initial);
    return initial;
  }
  const normalized = {
    products: Array.isArray(stored.products) ? stored.products : clone(defaults.products || []),
    site: stored.site && typeof stored.site === 'object' ? stored.site : clone(defaults.site || {}),
    reviews: Array.isArray(stored.reviews) ? stored.reviews : clone(defaults.reviews || []),
    orders: Array.isArray(stored.orders) ? stored.orders : [],
    analytics: normalizeAnalytics(stored.analytics),
    meta: stored.meta && typeof stored.meta === 'object' ? stored.meta : {}
  };
  const canRecoverCatalog = normalized.site.allowEmptyCatalog !== true && (defaults.products || []).length > 0;
  if (!normalized.products.length && canRecoverCatalog) {
    normalized.products = clone(defaults.products);
    normalized.meta.recoveredCatalogAt = new Date().toISOString();
    console.warn(`Empty catalog recovered with ${normalized.products.length} default products.`);
    await saveStore(normalized);
  }
  return normalized;
}

async function saveStore(store, options = {}) {
  return storage.write(store, options);
}

function publicSite(site) {
  const safe = clone(site || {});
  delete safe.adminPasswordHash;
  safe.telegram = { contact: safe.telegram?.contact || '' };
  return safe;
}

function publicProduct(product) {
  const safe = clone(product || {});
  delete safe.moyskladId;
  delete safe.moyskladHref;
  delete safe.moyskladArticle;
  return safe;
}

function publicState(store) {
  return {
    products: store.products.map(publicProduct),
    site: publicSite(store.site),
    reviews: store.reviews.filter(review => review.status === 'approved'),
    orders: [],
    catalogEmptyAllowed: store.site?.allowEmptyCatalog === true
  };
}

function moyskladStatus(store) {
  const linkedProducts = (store.products || []).filter(product => {
    const mapping = mappingFor(product, moysklad.baseUrl);
    return Boolean(mapping.href || mapping.id || mapping.article);
  }).length;
  const lastSync = store.meta?.moysklad || null;
  return {
    enabled: MOYSKLAD_ENABLED,
    configured: moysklad.configured(),
    webhookConfigured: Boolean(MOYSKLAD_WEBHOOK_SECRET),
    syncIntervalMs: MOYSKLAD_SYNC_INTERVAL_MS,
    linkedProducts,
    totalProducts: (store.products || []).length,
    lastSync
  };
}

async function syncMoySkladStock(store) {
  if (!moysklad.configured()) throw new HttpError(503, 'MOYSKLAD_TOKEN не настроен на сервере.');
  const result = await moysklad.syncStock(store);
  await saveStore(store);
  return result;
}

function scheduleMoySkladSync(reason = 'scheduled', delayMs = 1000) {
  if (!moysklad.configured()) return false;
  clearTimeout(moyskladSyncTimer);
  moyskladSyncTimer = setTimeout(async () => {
    try {
      const operation = async () => {
        const store = await loadStore();
        const result = await syncMoySkladStock(store);
        console.log(`MoySklad ${reason} sync: ${result.matched} matched, ${result.changed} changed`);
      };
      if (typeof storage.withWriteLock === 'function') await storage.withWriteLock(operation);
      else await operation();
    } catch (error) {
      console.error(`MoySklad ${reason} sync error:`, error.message);
    }
  }, Math.max(0, delayMs));
  moyskladSyncTimer.unref();
  return true;
}

function send(res, status, body, headers = {}) {
  const payload = typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': typeof body === 'string' ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    ...headers
  });
  res.end(payload);
}

function backupPayload(store) {
  return { version: 4, exportedAt: new Date().toISOString(), data: store };
}

function sendJsonDownload(res, filename, value) {
  const payload = JSON.stringify(value, null, 2);
  res.writeHead(200, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store'
  });
  res.end(payload);
}

function backupFileName() {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
  return `byvit-server-backup-${stamp}.json`;
}

function requestOrigin(req) {
  const forwardedProto = TRUST_PROXY ? String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() : '';
  const protocol = forwardedProto || (req.socket.encrypted ? 'https' : 'http');
  const forwardedHost = TRUST_PROXY ? String(req.headers['x-forwarded-host'] || '').split(',')[0].trim() : '';
  const host = forwardedHost || String(req.headers.host || 'localhost').split(',')[0].trim();
  return `${protocol}://${host}`;
}

function mutationOriginAllowed(req) {
  const origin = String(req.headers.origin || '').trim();
  if (!origin) return true;
  return origin === requestOrigin(req) || ALLOWED_ORIGINS.has(origin);
}

function xmlEscape(value) {
  return String(value || '').replace(/[<>&'\"]/g, char => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[char]));
}

function seoBaseUrl(req) {
  try {
    if (PUBLIC_URL) return new URL(PUBLIC_URL.replace(/\/?$/, '/'));
  } catch (error) { }
  return new URL(`${requestOrigin(req)}/`);
}

function htmlMetadataTag(attributes) {
  return `<meta ${Object.entries(attributes).map(([name, value]) => `${name}="${xmlEscape(value)}"`).join(' ')}>`;
}

async function injectServerMetadata(source, pathname, searchParams, req) {
  const base = seoBaseUrl(req);
  const canonicalPath = pathname === '/index.html' ? './' : pathname.replace(/^\//, '');
  let canonical = new URL(canonicalPath, base);
  let title = source.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.trim() || 'ByVit';
  let description = source.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i)?.[1]?.trim() || '';
  let image = new URL('assets/hero-fallback.svg', base).href;
  let type = 'website';
  let robots = 'index, follow, max-image-preview:large';
  let structuredData = null;

  if (pathname === '/product.html') {
    const id = String(searchParams.get('id') || '');
    const store = await loadStore();
    const product = store.products.find(item => String(item.id) === id);
    if (product) {
      canonical.searchParams.set('id', id);
      title = `${product.name} — ${product.brand || 'ByVit'} | ByVit`;
      description = product.shortDescription || product.description || `${product.name} в магазине ByVit.`;
      image = new URL((product.images || [])[0] || 'assets/hero-fallback.svg', base).href;
      type = 'product';
      const reviews = store.reviews.filter(review => String(review.productId) === id && review.status === 'approved');
      structuredData = {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: product.name,
        image: (product.images?.length ? product.images : ['assets/hero-fallback.svg']).map(value => new URL(value, base).href),
        description,
        sku: id,
        brand: { '@type': 'Brand', name: product.brand || 'ByVit' },
        offers: {
          '@type': 'Offer',
          url: canonical.href,
          priceCurrency: 'BYN',
          price: Number(product.packageOptions?.[0]?.price || product.price || 0),
          availability: Number(product.stock || 0) > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
          itemCondition: 'https://schema.org/NewCondition'
        }
      };
      if (reviews.length) {
        const rating = reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / reviews.length;
        structuredData.aggregateRating = { '@type': 'AggregateRating', ratingValue: Number(rating.toFixed(2)), reviewCount: reviews.length };
      }
    } else {
      robots = 'noindex, nofollow';
    }
  } else if (pathname === '/index.html') {
    structuredData = {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'ByVit',
      url: canonical.href,
      potentialAction: {
        '@type': 'SearchAction',
        target: `${new URL('catalog.html', base).href}?q={search_term_string}`,
        'query-input': 'required name=search_term_string'
      }
    };
  }

  const tags = [
    `<link rel="canonical" href="${xmlEscape(canonical.href)}">`,
    htmlMetadataTag({ name: 'robots', content: robots }),
    htmlMetadataTag({ property: 'og:site_name', content: 'ByVit' }),
    htmlMetadataTag({ property: 'og:type', content: type }),
    htmlMetadataTag({ property: 'og:title', content: title }),
    htmlMetadataTag({ property: 'og:description', content: description }),
    htmlMetadataTag({ property: 'og:url', content: canonical.href }),
    htmlMetadataTag({ property: 'og:image', content: image }),
    htmlMetadataTag({ name: 'twitter:card', content: 'summary_large_image' })
  ];
  if (structuredData) tags.push(`<script type="application/ld+json">${JSON.stringify(structuredData).replace(/</g, '\\u003c')}</script>`);
  return source.replace(/\s*<\/head>/i, `\n  ${tags.join('\n  ')}\n</head>`);
}

async function handleSeoFile(req, res) {
  const url = new URL(req.url, requestOrigin(req));
  const origin = requestOrigin(req);
  if (url.pathname === '/robots.txt') {
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
    send(res, 200, body, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' });
    return true;
  }
  if (url.pathname === '/sitemap.xml') {
    const store = await loadStore();
    const staticPages = [
      '/', '/catalog.html', '/brands.html', '/sale.html', '/delivery.html',
      '/stores.html', '/about.html', '/faq.html'
    ];
    const productPages = store.products.map(product => `/product.html?id=${encodeURIComponent(product.id)}`);
    const entries = [...staticPages, ...productPages].map(pathname =>
      `  <url><loc>${xmlEscape(new URL(pathname, origin).href)}</loc></url>`
    ).join('\n');
    const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`;
    send(res, 200, body, { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' });
    return true;
  }
  return false;
}

function parseCookies(req) {
  return Object.fromEntries(String(req.headers.cookie || '').split(';').map(part => part.trim()).filter(Boolean).map(part => {
    const index = part.indexOf('=');
    return index >= 0 ? [part.slice(0, index), decodeURIComponent(part.slice(index + 1))] : [part, ''];
  }));
}

function isAdmin(req) {
  const token = parseCookies(req)[SESSION_COOKIE];
  const session = token ? sessions.get(token) : null;
  if (!session) return false;
  if (Date.now() - session.createdAt > SESSION_TTL_MS) {
    sessions.delete(token);
    return false;
  }
  session.lastSeenAt = Date.now();
  return true;
}

function requireAdmin(req, res) {
  if (isAdmin(req)) return true;
  send(res, 401, { error: 'Unauthorized' });
  return false;
}

function bearerToken(req) {
  const value = String(req.headers.authorization || '');
  return value.startsWith('Bearer ') ? value.slice(7).trim() : '';
}

function tokenMatches(expected, actual) {
  if (!expected || !actual) return false;
  const left = Buffer.from(expected);
  const right = Buffer.from(actual);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function requireBackupAccess(req, res) {
  if (isAdmin(req) || tokenMatches(BACKUP_TOKEN, bearerToken(req))) return true;
  send(res, 401, { error: 'Unauthorized' });
  return false;
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', chunk => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new HttpError(413, 'Тело запроса слишком большое.'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (!chunks.length) { resolve({}); return; }
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch (error) { reject(new HttpError(400, 'Некорректный JSON.')); }
    });
    req.on('error', reject);
  });
}

function readBuffer(req, maxBytes = MAX_BODY) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let failed = false;
    const chunks = [];
    req.on('data', chunk => {
      size += chunk.length;
      if (size > maxBytes) {
        if (!failed) reject(new Error(`Файл больше ${Math.round(maxBytes / 1024 / 1024)} МБ`));
        failed = true;
        return;
      }
      if (!failed) chunks.push(chunk);
    });
    req.on('end', () => { if (!failed) resolve(Buffer.concat(chunks)); });
    req.on('error', reject);
  });
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function createPasswordHash(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const digest = crypto.scryptSync(String(password || ''), salt, 64).toString('hex');
  return `scrypt$${salt}$${digest}`;
}

function verifyPassword(password, storedHash) {
  const stored = String(storedHash || '');
  if (stored.startsWith('scrypt$')) {
    const [, salt, expectedHex] = stored.split('$');
    if (!salt || !/^[a-f0-9]{128}$/i.test(expectedHex || '')) return false;
    const actual = crypto.scryptSync(String(password || ''), salt, 64);
    const expected = Buffer.from(expectedHex, 'hex');
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
  }
  return tokenMatches(stored, sha256(password));
}

function strongEnoughPassword(password) {
  return String(password || '').length >= 12;
}

function sessionCookie(req, token = '', maxAge) {
  const forwardedProto = TRUST_PROXY ? String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() : '';
  const secure = forwardedProto === 'https' || Boolean(req.socket.encrypted);
  const parts = [`${SESSION_COOKIE}=${encodeURIComponent(token)}`, 'HttpOnly', 'SameSite=Lax', 'Path=/'];
  if (Number.isFinite(maxAge)) parts.push(`Max-Age=${maxAge}`);
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

function splitRecipients(value) {
  return String(value || '')
    .split(/[\n,;]+/)
    .map(item => item.trim())
    .filter(Boolean)
    .filter((item, index, list) => list.indexOf(item) === index);
}

function recoveryTelegramSettings(site) {
  const telegram = site?.telegram || {};
  return {
    token: ADMIN_RECOVERY_BOT_TOKEN || String(telegram.botToken || '').trim(),
    recipients: splitRecipients(ADMIN_RECOVERY_CHAT_IDS || telegram.recoveryChatId || telegram.chatId)
  };
}

function telegramBotToken(site, override = '') {
  return ADMIN_RECOVERY_BOT_TOKEN || String(override || site?.telegram?.botToken || '').trim();
}

function requestIp(req) {
  const forwarded = TRUST_PROXY ? req.headers['x-forwarded-for'] : '';
  return String(forwarded || req.socket.remoteAddress || 'unknown').split(',')[0].trim();
}

function allowRateLimitedRequest(req, res, scope, limit, windowMs) {
  const now = Date.now();
  const key = `${scope}:${requestIp(req)}`;
  const active = (rateLimitBuckets.get(key) || []).filter(timestamp => now - timestamp < windowMs);
  if (active.length >= limit) {
    const retryAfter = Math.max(1, Math.ceil((windowMs - (now - active[0])) / 1000));
    send(res, 429, { error: 'Слишком много запросов. Попробуйте позже.' }, { 'Retry-After': String(retryAfter) });
    return false;
  }
  active.push(now);
  rateLimitBuckets.set(key, active);
  if (rateLimitBuckets.size > 5000) {
    for (const [bucketKey, timestamps] of rateLimitBuckets) {
      if (!timestamps.some(timestamp => now - timestamp < windowMs)) rateLimitBuckets.delete(bucketKey);
    }
  }
  return true;
}

function textField(value, name, maxLength, options = {}) {
  const valueText = String(value || '').trim();
  if (options.required && !valueText) throw new HttpError(400, `Поле «${name}» обязательно.`);
  if (valueText.length > maxLength) throw new HttpError(400, `Поле «${name}» слишком длинное.`);
  return valueText;
}

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function normalizeOrder(store, payload) {
  const source = payload && typeof payload === 'object' ? payload : {};
  const rawItems = Array.isArray(source.items) ? source.items : [];
  if (!rawItems.length || rawItems.length > 50) throw new HttpError(400, 'В заказе должно быть от 1 до 50 позиций.');

  const requestedByProduct = new Map();
  const items = rawItems.map(rawItem => {
    const productId = Number(rawItem.productId || rawItem.id || 0);
    const product = store.products.find(item => Number(item.id) === productId);
    if (!product) throw new HttpError(400, 'Один из товаров больше не существует. Обновите корзину.');
    const qty = Number(rawItem.qty);
    if (!Number.isInteger(qty) || qty < 1 || qty > 99) throw new HttpError(400, `Некорректное количество товара «${product.name}».`);

    const options = Array.isArray(product.packageOptions) && product.packageOptions.length
      ? product.packageOptions
      : [{ id: 'base', label: '1 шт.', price: product.price }];
    const optionId = textField(rawItem.optionId || options[0].id, 'Фасовка', 64, { required: true });
    const option = options.find(item => String(item.id) === optionId);
    if (!option) throw new HttpError(400, `Фасовка товара «${product.name}» больше недоступна.`);

    const flavors = Array.isArray(product.flavors) ? product.flavors.map(String) : [];
    const flavor = textField(rawItem.flavor, 'Вкус', 100);
    if (flavors.length && !flavors.includes(flavor)) throw new HttpError(400, `Выберите доступный вкус товара «${product.name}».`);
    if (!flavors.length && flavor) throw new HttpError(400, `У товара «${product.name}» нет выбора вкуса.`);

    requestedByProduct.set(productId, (requestedByProduct.get(productId) || 0) + qty);
    const unitPrice = roundMoney(option.price ?? product.price);
    if (!Number.isFinite(unitPrice) || unitPrice < 0) throw new HttpError(500, `Для товара «${product.name}» не настроена цена.`);
    return {
      key: `${productId}::${optionId}::${flavor}`,
      productId,
      name: String(product.name || 'Товар'),
      optionId,
      optionLabel: String(option.label || '1 шт.'),
      flavor,
      price: unitPrice,
      qty,
      lineTotal: roundMoney(unitPrice * qty)
    };
  });

  for (const [productId, qty] of requestedByProduct) {
    const product = store.products.find(item => Number(item.id) === productId);
    const stock = Math.max(0, Math.floor(Number(product.stock || 0)));
    if (qty > stock) throw new HttpError(409, `Недостаточно товара «${product.name}». Доступно: ${stock}.`);
  }

  const subtotal = roundMoney(items.reduce((sum, item) => sum + item.lineTotal, 0));
  const promoSubtotal = roundMoney(items.reduce((sum, item) => {
    const product = store.products.find(productItem => Number(productItem.id) === Number(item.productId));
    return sum + (Number(product?.oldPrice || 0) > 0 ? 0 : item.lineTotal);
  }, 0));
  const promoCode = textField(source.promo, 'Промокод', 64).toUpperCase();
  const promo = (store.site?.promos || []).find(item => item.enabled !== false && String(item.code || '').trim().toUpperCase() === promoCode);
  const promoValue = Math.max(0, Number(promo?.value || 0));
  const appliedPromo = promo && promoSubtotal > 0 ? promo : null;
  const rawDiscount = appliedPromo ? (appliedPromo.type === 'fixed' ? promoValue : promoSubtotal * Math.min(100, promoValue) / 100) : 0;
  const discount = roundMoney(Math.min(promoSubtotal, rawDiscount));

  const deliveryMethods = store.site?.deliveryMethods || {};
  const deliveryKey = textField(source.deliveryKey || 'pickup', 'Способ доставки', 64, { required: true });
  const delivery = deliveryMethods[deliveryKey];
  if (!delivery || delivery.enabled === false) throw new HttpError(400, 'Выбранный способ доставки недоступен.');
  const deliveryPrice = roundMoney(Math.max(0, Number(delivery.price || 0)));

  const pickupStores = Array.isArray(store.site?.pickupStores) ? store.site.pickupStores.filter(item => item.enabled !== false) : [];
  let pickupStore = null;
  let address = textField(source.customer?.address, 'Адрес', 300);
  if (deliveryKey === 'pickup') {
    const pickupStoreId = textField(source.pickupStoreId || source.pickupStore?.id || pickupStores[0]?.id, 'Пункт самовывоза', 64);
    pickupStore = pickupStores.find(item => String(item.id) === pickupStoreId) || null;
    if (pickupStores.length && !pickupStore) throw new HttpError(400, 'Выберите доступный пункт самовывоза.');
    address = pickupStore ? [pickupStore.title, pickupStore.address].filter(Boolean).join(': ') : '';
  } else if (store.site?.checkout?.blocks?.address !== false && !address) {
    throw new HttpError(400, 'Укажите адрес или отделение доставки.');
  }

  const name = textField(source.customer?.name, 'Имя', 100, { required: true });
  const phone = textField(source.customer?.phone, 'Телефон', 32, { required: true });
  if (!/^[+\d][\d\s()+-]{5,31}$/.test(phone)) throw new HttpError(400, 'Укажите корректный номер телефона.');
  const paymentOptions = Array.isArray(store.site?.checkout?.paymentOptions) ? store.site.checkout.paymentOptions.map(String) : [];
  const payment = textField(source.payment || paymentOptions[0] || 'Оплата при получении', 'Способ оплаты', 120, { required: true });
  if (paymentOptions.length && !paymentOptions.includes(payment)) throw new HttpError(400, 'Выбранный способ оплаты недоступен.');

  return {
    id: Date.now(),
    date: new Date().toLocaleString('ru-RU'),
    status: 'new',
    items,
    subtotal,
    discount,
    deliveryPrice,
    total: roundMoney(subtotal - discount + deliveryPrice),
    promo: appliedPromo ? String(appliedPromo.code).trim().toUpperCase() : '',
    deliveryKey,
    deliveryTitle: String(delivery.title || deliveryKey),
    pickupStore: pickupStore ? clone(pickupStore) : null,
    payment,
    comment: textField(source.comment, 'Комментарий', 1000),
    customer: { name, phone, address }
  };
}

function deductOrderStock(store, order) {
  const quantities = new Map();
  order.items.forEach(item => quantities.set(item.productId, (quantities.get(item.productId) || 0) + item.qty));
  for (const [productId, qty] of quantities) {
    const product = store.products.find(item => Number(item.id) === Number(productId));
    product.stock = Math.max(0, Math.floor(Number(product.stock || 0)) - qty);
  }
}

function pruneRecoveryState() {
  const now = Date.now();
  recoveryChallenges.forEach((challenge, id) => {
    if (challenge.expiresAt <= now) recoveryChallenges.delete(id);
  });
  telegramLinkChallenges.forEach((challenge, id) => {
    if (challenge.expiresAt <= now) telegramLinkChallenges.delete(id);
  });
  recoveryRequestLog.forEach((timestamps, ip) => {
    const active = timestamps.filter(timestamp => now - timestamp < ADMIN_RECOVERY_REQUEST_WINDOW_MS);
    if (active.length) recoveryRequestLog.set(ip, active);
    else recoveryRequestLog.delete(ip);
  });
}

function allowRecoveryRequest(req) {
  pruneRecoveryState();
  const ip = requestIp(req);
  const now = Date.now();
  const timestamps = recoveryRequestLog.get(ip) || [];
  if (timestamps.length >= ADMIN_RECOVERY_REQUEST_LIMIT) return false;
  timestamps.push(now);
  recoveryRequestLog.set(ip, timestamps);
  return true;
}

function money(value) {
  const num = Number(value || 0);
  const formatted = Number.isInteger(num) ? String(num) : num.toFixed(2).replace('.', ',');
  return `${formatted} BYN`;
}

function buildOrderText(order) {
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
  if (order.comment) lines.push(`Комментарий: ${order.comment}`);
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

function telegramRecipients(site) {
  return splitRecipients(site?.telegram?.chatId);
}

function postForm(url, form) {
  return new Promise((resolve, reject) => {
    const data = new URLSearchParams(form).toString();
    const request = https.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(data)
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

function telegramApi(token, method, form = {}) {
  return new Promise((resolve, reject) => {
    const data = new URLSearchParams(form).toString();
    const request = https.request(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(data)
      }
    }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => {
        try {
          const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
          if (response.statusCode < 200 || response.statusCode >= 300 || body.ok !== true) {
            reject(new Error(body.description || `Telegram API ${response.statusCode}`));
            return;
          }
          resolve(body.result);
        } catch (error) {
          reject(error);
        }
      });
    });
    request.on('error', reject);
    request.write(data);
    request.end();
  });
}

async function sendTelegram(site, order) {
  const token = site?.telegram?.botToken;
  const recipients = telegramRecipients(site);
  if (!token || !recipients.length) return { skipped: true };
  const text = buildOrderText(order);
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const results = await Promise.allSettled(recipients.map(chatId => postForm(url, { chat_id: chatId, text })));
  return { ok: true, count: recipients.length, results };
}

async function sendRecoveryCode(site, code) {
  const { token, recipients } = recoveryTelegramSettings(site);
  if (!token || !recipients.length) throw new Error('Telegram recovery is not configured');
  const text = [
    `Код восстановления админки ByVit: ${code}`,
    '',
    `Код действует ${Math.round(ADMIN_RECOVERY_TTL_MS / 60000)} минут.`,
    'Если вы не запрашивали восстановление, проигнорируйте сообщение.'
  ].join('\n');
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const results = await Promise.allSettled(recipients.map(chatId => postForm(url, { chat_id: chatId, text })));
  const delivered = results.filter(result => result.status === 'fulfilled' && result.value >= 200 && result.value < 300).length;
  if (!delivered) throw new Error('Telegram rejected recovery message');
  return delivered;
}

function telegramOwnerLabel(chat, from) {
  const fullName = [from?.first_name, from?.last_name].filter(Boolean).join(' ').trim();
  return fullName || (from?.username ? `@${from.username}` : '') || chat?.title || `Chat ${chat?.id || ''}`;
}

async function connectTelegramOwner(challenge, message) {
  const chat = message?.chat || {};
  const from = message?.from || {};
  if (!chat.id || (chat.type && chat.type !== 'private')) return false;
  const adminStore = await loadStore();
  adminStore.site.telegram = adminStore.site.telegram || {};
  adminStore.site.telegram.recoveryChatId = String(chat.id);
  adminStore.site.telegram.recoveryName = telegramOwnerLabel(chat, from);
  adminStore.site.telegram.recoveryUsername = String(from.username || '');
  await saveStore(adminStore);
  challenge.connected = {
    chatId: String(chat.id),
    name: adminStore.site.telegram.recoveryName,
    username: adminStore.site.telegram.recoveryUsername
  };
  challenge.connectedAt = Date.now();
  try {
    await telegramApi(challenge.token, 'sendMessage', {
      chat_id: String(chat.id),
      text: 'Telegram подключён к админке ByVit. Сюда будут приходить коды восстановления доступа.'
    });
  } catch (error) {
    console.warn('Telegram link confirmation error:', error.message);
  }
  return true;
}

async function processTelegramLinkUpdates(token) {
  const tokenKey = sha256(token);
  if (telegramUpdatePolls.has(tokenKey)) return telegramUpdatePolls.get(tokenKey);
  const task = (async () => {
    const offset = telegramUpdateOffsets.get(tokenKey) || 0;
    let updates;
    try {
      updates = await telegramApi(token, 'getUpdates', {
        offset: String(offset),
        limit: '100',
        timeout: '0',
        allowed_updates: JSON.stringify(['message'])
      });
    } catch (error) {
      if (/webhook/i.test(error.message)) {
        throw new Error('У бота уже включён webhook. Отключите его или используйте отдельного бота для восстановления.');
      }
      throw error;
    }
    let nextOffset = offset;
    for (const update of Array.isArray(updates) ? updates : []) {
      nextOffset = Math.max(nextOffset, Number(update.update_id || 0) + 1);
      const message = update.message;
      const text = String(message?.text || '').trim();
      const match = text.match(/^\/start(?:@\w+)?\s+([A-Za-z0-9_-]{1,64})$/);
      if (!match) continue;
      const candidates = Array.from(telegramLinkChallenges.values()).filter(challenge => (
        challenge.tokenKey === tokenKey &&
        challenge.startParameter === match[1] &&
        challenge.expiresAt > Date.now() &&
        !challenge.connected
      ));
      for (const challenge of candidates) await connectTelegramOwner(challenge, message);
    }
    telegramUpdateOffsets.set(tokenKey, nextOffset);
  })();
  telegramUpdatePolls.set(tokenKey, task);
  try { await task; }
  finally { telegramUpdatePolls.delete(tokenKey); }
}

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.txt': 'text/plain; charset=utf-8'
  }[ext] || 'application/octet-stream';
}

function serveUpload(req, res) {
  const target = media.resolve(req.url);
  if (!target) return false;
  let stats;
  try { stats = fs.statSync(target); }
  catch (error) { send(res, 404, 'Not found'); return true; }
  if (!stats.isFile()) { send(res, 404, 'Not found'); return true; }
  const headers = {
    'Content-Type': contentType(target),
    'Cache-Control': 'public, max-age=31536000, immutable',
    'Accept-Ranges': 'bytes',
    'X-Content-Type-Options': 'nosniff'
  };
  if (path.extname(target).toLowerCase() === '.svg') headers['Content-Security-Policy'] = "default-src 'none'; style-src 'unsafe-inline'; sandbox";
  const range = String(req.headers.range || '');
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match) { res.writeHead(416, { 'Content-Range': `bytes */${stats.size}` }); res.end(); return true; }
    const start = match[1] ? Number(match[1]) : 0;
    const end = match[2] ? Math.min(Number(match[2]), stats.size - 1) : stats.size - 1;
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || start > end || start >= stats.size) {
      res.writeHead(416, { 'Content-Range': `bytes */${stats.size}` }); res.end(); return true;
    }
    res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${stats.size}`, 'Content-Length': end - start + 1 });
    fs.createReadStream(target, { start, end }).pipe(res);
    return true;
  }
  res.writeHead(200, { ...headers, 'Content-Length': stats.size });
  fs.createReadStream(target).pipe(res);
  return true;
}

async function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
  const allowed = PUBLIC_HTML_FILES.has(pathname) || PUBLIC_ASSET_PREFIXES.some(prefix => pathname.startsWith(prefix));
  if (!allowed || pathname.includes('..') || pathname.includes('\\')) {
    send(res, 404, 'Not found');
    return;
  }
  const resolved = path.normalize(path.join(ROOT, pathname));
  if (!resolved.startsWith(`${ROOT}${path.sep}`)) {
    send(res, 403, 'Forbidden');
    return;
  }
  let data;
  try { data = await fs.promises.readFile(resolved); }
  catch (error) { send(res, 404, 'Not found'); return; }
  const isHtml = path.extname(resolved).toLowerCase() === '.html';
  if (isHtml && pathname !== '/admin.html') data = Buffer.from(await injectServerMetadata(data.toString('utf8'), pathname, url.searchParams, req));
  const contentSecurityPolicy = [
    "default-src 'self'",
    "base-uri 'self'",
    "connect-src 'self'",
    "font-src 'self' data: https://fonts.gstatic.com",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "img-src 'self' data: https:",
    "media-src 'self' blob: https:",
    "object-src 'none'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com"
  ].join('; ');
  res.writeHead(200, {
    'Content-Type': contentType(resolved),
    'Content-Length': data.length,
    'Cache-Control': isHtml ? 'no-cache' : 'public, max-age=3600',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Content-Security-Policy': contentSecurityPolicy
  });
  res.end(data);
}

async function handleApi(req, res) {
  const store = await loadStore();
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  try {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && !mutationOriginAllowed(req)) {
      throw new HttpError(403, 'Запрос с этого адреса запрещён.');
    }
    if (req.method === 'GET' && url.pathname === '/api/health') {
      const storageInfo = await storage.info();
      const mediaInfo = media.info();
      send(res, 200, {
        ok: true,
        products: store.products.length,
        storage: storageInfo.persistent ? 'persistent' : 'ephemeral',
        storageDriver: storageInfo.driver,
        storageUpdatedAt: storageInfo.updatedAt,
        backups: storageInfo.backups,
        mediaDriver: mediaInfo.driver,
        mediaStorage: mediaInfo.persistent ? 'persistent' : 'ephemeral',
        mediaFiles: mediaInfo.files,
        mediaSize: mediaInfo.size,
        recoveredCatalogAt: store.meta?.recoveredCatalogAt || '',
        moysklad: {
          enabled: MOYSKLAD_ENABLED,
          configured: moysklad.configured(),
          lastSyncAt: store.meta?.moysklad?.lastSyncAt || ''
        }
      });
      return;
    }
    if (req.method === 'GET' && url.pathname === '/api/backup') {
      if (!requireBackupAccess(req, res)) return;
      sendJsonDownload(res, backupFileName(), backupPayload(store));
      return;
    }
    if (req.method === 'GET' && url.pathname === '/api/state') {
      send(res, 200, publicState(store));
      return;
    }
    if (req.method === 'GET' && url.pathname === '/api/admin/state') {
      if (!requireAdmin(req, res)) return;
      send(res, 200, store);
      return;
    }
    if (req.method === 'GET' && url.pathname === '/api/admin/moysklad/status') {
      if (!requireAdmin(req, res)) return;
      send(res, 200, moyskladStatus(store));
      return;
    }
    if (req.method === 'POST' && url.pathname === '/api/admin/moysklad/test') {
      if (!requireAdmin(req, res)) return;
      if (!moysklad.configured()) throw new HttpError(503, 'MOYSKLAD_TOKEN не настроен на сервере.');
      const connection = await moysklad.testConnection();
      send(res, 200, { ok: true, connection, status: moyskladStatus(store) });
      return;
    }
    if (req.method === 'POST' && url.pathname === '/api/admin/moysklad/sync') {
      if (!requireAdmin(req, res)) return;
      const result = await syncMoySkladStock(store);
      send(res, 200, { ok: true, result, status: moyskladStatus(store), store });
      return;
    }
    if (req.method === 'POST' && url.pathname === '/api/integrations/moysklad/webhook') {
      if (!MOYSKLAD_WEBHOOK_SECRET) throw new HttpError(503, 'Webhook МойСклад ещё не настроен.');
      const suppliedSecret = String(req.headers['x-byvit-webhook-secret'] || url.searchParams.get('secret') || '').trim();
      if (!tokenMatches(MOYSKLAD_WEBHOOK_SECRET, suppliedSecret)) throw new HttpError(401, 'Unauthorized');
      scheduleMoySkladSync('webhook');
      send(res, 202, { ok: true, queued: true });
      return;
    }
    if (req.method === 'GET' && url.pathname === '/api/admin/uploads') {
      if (!requireAdmin(req, res)) return;
      send(res, 200, { media: media.info(), files: media.list() });
      return;
    }
    if (req.method === 'POST' && url.pathname === '/api/admin/uploads') {
      if (!requireAdmin(req, res)) return;
      const buffer = await readBuffer(req, MAX_UPLOAD_BYTES);
      let originalName = String(req.headers['x-file-name'] || 'file');
      try { originalName = decodeURIComponent(originalName); } catch (error) { }
      const file = media.save({
        buffer,
        originalName,
        contentType: req.headers['content-type'],
        scope: req.headers['x-upload-scope']
      });
      send(res, 201, { ok: true, file, media: media.info() });
      return;
    }
    if (req.method === 'DELETE' && url.pathname === '/api/admin/uploads') {
      if (!requireAdmin(req, res)) return;
      const body = await readJson(req);
      const deleted = media.delete(body.url);
      send(res, 200, { ok: true, deleted, media: media.info() });
      return;
    }
    if (req.method === 'GET' && url.pathname === '/api/admin/backups') {
      if (!requireAdmin(req, res)) return;
      send(res, 200, { storage: await storage.info(), media: media.info(), backups: await storage.listBackups(), externalExport: Boolean(BACKUP_TOKEN) });
      return;
    }
    if (req.method === 'GET' && url.pathname === '/api/admin/backup/download') {
      if (!requireAdmin(req, res)) return;
      sendJsonDownload(res, backupFileName(), backupPayload(store));
      return;
    }
    if (req.method === 'POST' && url.pathname === '/api/admin/backups') {
      if (!requireAdmin(req, res)) return;
      const backup = await storage.createBackup('manual');
      send(res, 201, { ok: true, backup, storage: await storage.info(), media: media.info(), backups: await storage.listBackups() });
      return;
    }
    if (req.method === 'POST' && url.pathname === '/api/admin/backups/restore') {
      if (!requireAdmin(req, res)) return;
      const body = await readJson(req);
      await storage.restoreBackup(body.name);
      const restoredStore = await loadStore();
      send(res, 200, { ok: true, store: restoredStore, storage: await storage.info(), media: media.info(), backups: await storage.listBackups() });
      return;
    }
    if (req.method === 'POST' && url.pathname === '/api/analytics') {
      if (!allowRateLimitedRequest(req, res, 'analytics', 120, 60 * 1000)) return;
      const body = await readJson(req);
      const type = String(body.type || '');
      const analyticsStore = await loadStore();
      if (!recordAnalyticsEvent(analyticsStore, type, { productId: body.productId, page: body.page })) {
        send(res, 400, { error: 'Unsupported analytics event' });
        return;
      }
      await saveStore(analyticsStore, { backup: false });
      send(res, 201, { ok: true });
      return;
    }
    if (req.method === 'POST' && url.pathname === '/api/admin/login') {
      if (!allowRateLimitedRequest(req, res, 'admin-login', 5, 15 * 60 * 1000)) return;
      const body = await readJson(req);
      const expected = store.site?.adminPasswordHash || ADMIN_PASSWORD_HASH;
      if (!expected) {
        send(res, 503, { error: 'Пароль администратора не настроен на сервере.' });
        return;
      }
      if (!verifyPassword(body.password, expected)) {
        send(res, 403, { error: 'Wrong password' });
        return;
      }
      if (!String(expected).startsWith('scrypt$')) {
        store.site.adminPasswordHash = createPasswordHash(body.password);
        await saveStore(store);
      }
      const token = crypto.randomBytes(24).toString('hex');
      sessions.set(token, { createdAt: Date.now() });
      send(res, 200, { ok: true }, { 'Set-Cookie': sessionCookie(req, token) });
      return;
    }
    if (req.method === 'POST' && url.pathname === '/api/admin/logout') {
      const token = parseCookies(req)[SESSION_COOKIE];
      if (token) sessions.delete(token);
      send(res, 200, { ok: true }, { 'Set-Cookie': sessionCookie(req, '', 0) });
      return;
    }
    if (req.method === 'POST' && url.pathname === '/api/admin/telegram/recovery-link') {
      if (!requireAdmin(req, res)) return;
      const body = await readJson(req);
      const token = telegramBotToken(store.site, body.botToken);
      if (!token) {
        send(res, 400, { error: 'Сначала вставьте Bot Token от BotFather.' });
        return;
      }
      let bot;
      try {
        bot = await telegramApi(token, 'getMe');
      } catch (error) {
        send(res, 400, { error: 'Bot Token не принят Telegram. Проверьте его и попробуйте снова.' });
        return;
      }
      if (!bot?.username) {
        send(res, 400, { error: 'У бота нет username, поэтому ссылку подключения создать нельзя.' });
        return;
      }
      if (!ADMIN_RECOVERY_BOT_TOKEN && String(body.botToken || '').trim()) {
        store.site.telegram = store.site.telegram || {};
        store.site.telegram.botToken = String(body.botToken).trim();
        await saveStore(store);
      }
      pruneRecoveryState();
      const challengeId = crypto.randomBytes(24).toString('hex');
      const startParameter = `byvit_${crypto.randomBytes(18).toString('base64url')}`;
      telegramLinkChallenges.set(challengeId, {
        token,
        tokenKey: sha256(token),
        startParameter,
        botUsername: String(bot.username),
        expiresAt: Date.now() + ADMIN_RECOVERY_TTL_MS,
        connected: null
      });
      send(res, 200, {
        ok: true,
        challengeId,
        deepLink: `https://t.me/${bot.username}?start=${startParameter}`,
        botUsername: String(bot.username),
        expiresIn: Math.round(ADMIN_RECOVERY_TTL_MS / 1000)
      });
      return;
    }
    if (req.method === 'GET' && url.pathname === '/api/admin/telegram/recovery-link/status') {
      if (!requireAdmin(req, res)) return;
      pruneRecoveryState();
      const challengeId = String(url.searchParams.get('challengeId') || '');
      const challenge = telegramLinkChallenges.get(challengeId);
      if (!challenge) {
        send(res, 404, { error: 'Ссылка подключения истекла. Создайте новую.' });
        return;
      }
      if (!challenge.connected) {
        try {
          await processTelegramLinkUpdates(challenge.token);
        } catch (error) {
          console.error('Telegram link error:', error.message);
          send(res, 502, { error: error.message || 'Не удалось проверить подключение Telegram.' });
          return;
        }
      }
      send(res, 200, {
        ok: true,
        connected: Boolean(challenge.connected),
        owner: challenge.connected,
        botUsername: challenge.botUsername,
        expiresIn: Math.max(0, Math.round((challenge.expiresAt - Date.now()) / 1000))
      });
      return;
    }
    if (req.method === 'POST' && url.pathname === '/api/admin/telegram/recovery-link/disconnect') {
      if (!requireAdmin(req, res)) return;
      const adminStore = await loadStore();
      adminStore.site.telegram = adminStore.site.telegram || {};
      adminStore.site.telegram.recoveryChatId = '';
      adminStore.site.telegram.recoveryName = '';
      adminStore.site.telegram.recoveryUsername = '';
      await saveStore(adminStore);
      telegramLinkChallenges.clear();
      send(res, 200, { ok: true });
      return;
    }
    if (req.method === 'POST' && url.pathname === '/api/admin/recovery/request') {
      const settings = recoveryTelegramSettings(store.site);
      if (!settings.token || !settings.recipients.length) {
        send(res, 503, { error: 'Восстановление через Telegram ещё не настроено.' });
        return;
      }
      if (!allowRecoveryRequest(req)) {
        send(res, 429, { error: 'Слишком много запросов. Попробуйте через 15 минут.' });
        return;
      }
      const challengeId = crypto.randomBytes(24).toString('hex');
      const code = String(crypto.randomInt(100000, 1000000));
      try {
        await sendRecoveryCode(store.site, code);
      } catch (error) {
        console.error('Telegram recovery error:', error.message);
        send(res, 502, { error: 'Не удалось отправить код в Telegram. Проверьте настройки бота.' });
        return;
      }
      recoveryChallenges.set(challengeId, {
        codeHash: sha256(`${challengeId}:${code}`),
        expiresAt: Date.now() + ADMIN_RECOVERY_TTL_MS,
        attempts: 0
      });
      send(res, 200, { ok: true, challengeId, expiresIn: Math.round(ADMIN_RECOVERY_TTL_MS / 1000) });
      return;
    }
    if (req.method === 'POST' && url.pathname === '/api/admin/recovery/reset') {
      pruneRecoveryState();
      const body = await readJson(req);
      const challengeId = String(body.challengeId || '');
      const challenge = recoveryChallenges.get(challengeId);
      if (!challenge) {
        send(res, 400, { error: 'Код истёк. Запросите новый.' });
        return;
      }
      challenge.attempts += 1;
      if (challenge.attempts > ADMIN_RECOVERY_ATTEMPT_LIMIT) {
        recoveryChallenges.delete(challengeId);
        send(res, 429, { error: 'Превышено число попыток. Запросите новый код.' });
        return;
      }
      const codeMatches = tokenMatches(challenge.codeHash, sha256(`${challengeId}:${String(body.code || '').trim()}`));
      if (!codeMatches) {
        send(res, 400, { error: 'Неверный код.' });
        return;
      }
      if (!strongEnoughPassword(body.password)) {
        send(res, 400, { error: 'Пароль должен содержать не менее 12 символов.' });
        return;
      }
      const adminStore = await loadStore();
      adminStore.site.adminPasswordHash = createPasswordHash(body.password);
      await saveStore(adminStore);
      recoveryChallenges.delete(challengeId);
      sessions.clear();
      send(res, 200, { ok: true }, { 'Set-Cookie': sessionCookie(req, '', 0) });
      return;
    }
    if (req.method === 'PUT' && url.pathname === '/api/admin/password') {
      if (!requireAdmin(req, res)) return;
      const body = await readJson(req);
      if (!strongEnoughPassword(body.password)) {
        send(res, 400, { error: 'Пароль должен содержать не менее 12 символов.' });
        return;
      }
      const adminStore = await loadStore();
      adminStore.site.adminPasswordHash = createPasswordHash(body.password);
      await saveStore(adminStore);
      sessions.clear();
      send(res, 200, { ok: true }, { 'Set-Cookie': sessionCookie(req, '', 0) });
      return;
    }
    if (req.method === 'PUT' && url.pathname === '/api/admin/state') {
      if (!requireAdmin(req, res)) return;
      const body = await readJson(req);
      const adminStore = await loadStore();
      if (Array.isArray(body.products)) {
        const allowEmptyCatalog = body.allowEmptyCatalog === true || body.site?.allowEmptyCatalog === true;
        if (!body.products.length && !allowEmptyCatalog) {
          send(res, 400, { error: 'Каталог не может быть пустым. Включите allowEmptyCatalog только для намеренного отключения витрины.' });
          return;
        }
        adminStore.products = body.products;
      }
      if (body.site && typeof body.site === 'object') {
        const passwordHash = adminStore.site?.adminPasswordHash || ADMIN_PASSWORD_HASH;
        adminStore.site = body.site;
        adminStore.site.adminPasswordHash = passwordHash;
      }
      if (Array.isArray(body.reviews)) adminStore.reviews = body.reviews;
      if (Array.isArray(body.orders)) adminStore.orders = body.orders;
      if (body.restoreAnalytics === true && body.analytics && typeof body.analytics === 'object') adminStore.analytics = normalizeAnalytics(body.analytics);
      await saveStore(adminStore);
      send(res, 200, { ok: true });
      return;
    }
    if (req.method === 'POST' && url.pathname === '/api/orders') {
      if (!allowRateLimitedRequest(req, res, 'orders', 10, 10 * 60 * 1000)) return;
      const body = await readJson(req);
      const orderStore = await loadStore();
      const order = normalizeOrder(orderStore, body.order || body);
      deductOrderStock(orderStore, order);
      orderStore.orders.unshift(order);
      recordOrderAnalytics(orderStore, order);
      await saveStore(orderStore);
      sendTelegram(orderStore.site, order).catch(error => console.error('Telegram error:', error.message));
      send(res, 201, { ok: true, order });
      return;
    }
    if (req.method === 'POST' && url.pathname === '/api/reviews') {
      if (!allowRateLimitedRequest(req, res, 'reviews', 5, 60 * 60 * 1000)) return;
      const body = await readJson(req);
      const reviewStore = await loadStore();
      const productId = Number(body.productId || 0);
      if (!reviewStore.products.some(product => Number(product.id) === productId)) throw new HttpError(400, 'Товар для отзыва не найден.');
      const name = textField(body.name, 'Имя', 100, { required: true });
      const text = textField(body.text, 'Отзыв', 2000, { required: true });
      const rating = Number(body.rating);
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new HttpError(400, 'Оценка должна быть от 1 до 5.');
      const review = {
        id: Date.now(),
        productId,
        name,
        rating,
        text,
        status: 'pending',
        date: new Date().toLocaleDateString('ru-RU')
      };
      reviewStore.reviews.unshift(review);
      await saveStore(reviewStore);
      send(res, 201, { ok: true, review });
      return;
    }
    send(res, 404, { error: 'Not found' });
  } catch (error) {
    const status = Number(error.status || 0);
    if (status >= 400 && status < 600) {
      send(res, status, { error: error.message || 'Ошибка запроса' });
      return;
    }
    console.error('API error:', error);
    send(res, 500, { error: 'Внутренняя ошибка сервера.' });
  }
}

async function validateProductionConfig() {
  if (!IS_PRODUCTION) return;
  const store = await loadStore();
  const errors = [];
  if (!(store.site?.adminPasswordHash || ADMIN_PASSWORD_HASH)) errors.push('задайте BYVIT_ADMIN_PASSWORD или сохраните пароль через админку');
  if (ADMIN_PASSWORD && !strongEnoughPassword(ADMIN_PASSWORD)) errors.push('BYVIT_ADMIN_PASSWORD должен содержать не менее 12 символов');
  if (!BACKUP_TOKEN || BACKUP_TOKEN.length < 24 || /replace-with|change-me/i.test(BACKUP_TOKEN)) errors.push('задайте уникальный BYVIT_BACKUP_TOKEN длиной не менее 24 символов');
  if (!PUBLIC_URL) errors.push('задайте BYVIT_PUBLIC_URL');
  else {
    try {
      const configuredUrl = new URL(PUBLIC_URL);
      const local = ['localhost', '127.0.0.1', '::1'].includes(configuredUrl.hostname);
      if (!local && configuredUrl.protocol !== 'https:') errors.push('BYVIT_PUBLIC_URL должен использовать HTTPS');
    } catch (error) {
      errors.push('BYVIT_PUBLIC_URL должен быть абсолютным URL');
    }
  }
  if (!ALLOWED_ORIGINS.size) errors.push('задайте BYVIT_ALLOWED_ORIGINS');
  if (!STORAGE_PERSISTENT) errors.push('задайте BYVIT_DATA_DIR и BYVIT_STORAGE_PERSISTENT=true');
  if (!MEDIA_PERSISTENT) errors.push('задайте BYVIT_UPLOAD_DIR и BYVIT_MEDIA_PERSISTENT=true');
  if (['postgres', 'postgresql'].includes(STORAGE_DRIVER) && !DATABASE_URL) errors.push('задайте DATABASE_URL');
  if (MOYSKLAD_ENABLED && !MOYSKLAD_TOKEN) errors.push('MOYSKLAD_ENABLED требует MOYSKLAD_TOKEN');
  if (errors.length) throw new Error(`Production configuration error: ${errors.join('; ')}`);
}

async function routeRequest(req, res) {
  if (await handleSeoFile(req, res)) return;
  if (serveUpload(req, res)) return;
  if (req.url.startsWith('/api/')) {
    const writesState = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(String(req.method || '').toUpperCase());
    if (writesState && typeof storage.withWriteLock === 'function') await storage.withWriteLock(() => handleApi(req, res));
    else await handleApi(req, res);
    return;
  }
  await serveStatic(req, res);
}

const server = http.createServer((req, res) => {
  routeRequest(req, res).catch(error => {
    console.error('Request error:', error);
    if (!res.headersSent) send(res, 500, { error: 'Внутренняя ошибка сервера.' });
    else res.end();
  });
});

async function start() {
  await validateProductionConfig();
  server.listen(PORT, () => {
    console.log(`ByVit MVP server: http://localhost:${PORT}`);
    if (MOYSKLAD_ENABLED && moysklad.configured()) {
      scheduleMoySkladSync('startup', 5000);
      moyskladSyncInterval = setInterval(() => scheduleMoySkladSync('interval'), MOYSKLAD_SYNC_INTERVAL_MS);
      moyskladSyncInterval.unref();
    }
  });
}

function shutdown(signal) {
  console.log(`${signal}: stopping ByVit server`);
  clearTimeout(moyskladSyncTimer);
  clearInterval(moyskladSyncInterval);
  server.close(async error => {
    if (error) {
      console.error('Shutdown error:', error);
      process.exitCode = 1;
    }
    if (typeof storage.close === 'function') await storage.close().catch(closeError => console.error('Storage close error:', closeError));
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

start().catch(error => {
  console.error(error.message || error);
  process.exitCode = 1;
});
