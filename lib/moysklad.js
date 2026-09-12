const DEFAULT_BASE_URL = 'https://api.moysklad.ru/api/remap/1.2';

function clean(value) {
  return String(value || '').trim();
}

function normalizeHref(value) {
  return clean(value).replace(/[?#].*$/, '').replace(/\/$/, '');
}

function idFromHref(value) {
  return normalizeHref(value).split('/').filter(Boolean).pop() || '';
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function availableStock(row) {
  const stock = numberOrNull(row?.stock);
  if (stock !== null) return Math.max(0, Math.floor(stock));
  const quantity = numberOrNull(row?.quantity);
  const reserve = numberOrNull(row?.reserve) || 0;
  return Math.max(0, Math.floor((quantity || 0) - reserve));
}

function mappingFor(product, baseUrl = DEFAULT_BASE_URL) {
  const href = normalizeHref(product?.moyskladHref);
  const id = clean(product?.moyskladId) || idFromHref(href);
  const article = clean(product?.moyskladArticle);
  return {
    href: href || (id ? `${baseUrl}/entity/product/${encodeURIComponent(id)}` : ''),
    id,
    article
  };
}

function rowKeys(row) {
  const href = normalizeHref(row?.assortment?.meta?.href || row?.meta?.href);
  return [
    href && `href:${href}`,
    href && `id:${idFromHref(href)}`,
    clean(row?.id) && `id:${clean(row.id)}`,
    clean(row?.article) && `article:${clean(row.article).toLowerCase()}`,
    clean(row?.code) && `code:${clean(row.code).toLowerCase()}`,
    clean(row?.externalCode) && `external:${clean(row.externalCode).toLowerCase()}`
  ].filter(Boolean);
}

function productKeys(product, baseUrl) {
  const mapping = mappingFor(product, baseUrl);
  return [
    mapping.href && `href:${mapping.href}`,
    mapping.id && `id:${mapping.id}`,
    mapping.article && `article:${mapping.article.toLowerCase()}`
  ].filter(Boolean);
}

class MoySkladClient {
  constructor(options = {}) {
    this.baseUrl = clean(options.baseUrl || DEFAULT_BASE_URL).replace(/\/$/, '');
    this.token = clean(options.token);
    this.stockEndpoint = clean(options.stockEndpoint || '/report/stock/all');
    this.timeoutMs = Math.max(1000, Number(options.timeoutMs || 15000));
    this.fetchImpl = options.fetchImpl || globalThis.fetch;
  }

  configured() {
    return Boolean(this.token);
  }

  async request(endpoint, options = {}) {
    if (!this.configured()) throw new Error('MOYSKLAD_TOKEN is not configured.');
    const url = /^https?:\/\//i.test(endpoint) ? new URL(endpoint) : new URL(`${this.baseUrl}/${String(endpoint).replace(/^\//, '')}`);
    Object.entries(options.query || {}).forEach(([name, value]) => {
      if (value !== undefined && value !== null && value !== '') url.searchParams.set(name, String(value));
    });
    const response = await this.fetchImpl(url, {
      method: options.method || 'GET',
      headers: {
        Accept: 'application/json;charset=utf-8',
        Authorization: `Bearer ${this.token}`,
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.headers || {})
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: AbortSignal.timeout(this.timeoutMs)
    });
    const text = await response.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch (error) { data = { raw: text }; }
    if (!response.ok) {
      const message = data?.errors?.[0]?.error || data?.error || response.statusText || `HTTP ${response.status}`;
      const failure = new Error(`МойСклад: ${message}`);
      failure.status = response.status;
      throw failure;
    }
    return data;
  }

  async testConnection() {
    const employee = await this.request('/context/employee');
    return { ok: true, accountId: clean(employee.accountId), employeeId: clean(employee.id), name: clean(employee.name) };
  }

  async stockRows() {
    const rows = [];
    const limit = 1000;
    let offset = 0;
    for (;;) {
      const page = await this.request(this.stockEndpoint, { query: { limit, offset } });
      const batch = Array.isArray(page.rows) ? page.rows : [];
      rows.push(...batch);
      offset += batch.length;
      const total = Number(page.meta?.size || 0);
      if (!batch.length || batch.length < limit || (total && offset >= total)) break;
    }
    return rows;
  }

  async syncStock(store) {
    const rows = await this.stockRows();
    const index = new Map();
    rows.forEach(row => rowKeys(row).forEach(key => { if (!index.has(key)) index.set(key, row); }));
    const matched = [];
    const unmatched = [];
    let changed = 0;
    (store.products || []).forEach(product => {
      const keys = productKeys(product, this.baseUrl);
      if (!keys.length) return;
      const row = keys.map(key => index.get(key)).find(Boolean);
      if (!row) {
        unmatched.push({ productId: product.id, name: product.name, mapping: mappingFor(product, this.baseUrl) });
        return;
      }
      const previous = Number(product.stock || 0);
      const stock = availableStock(row);
      product.stock = stock;
      if (previous !== stock) changed += 1;
      matched.push({ productId: product.id, name: product.name, previous, stock, mapping: mappingFor(product, this.baseUrl) });
    });
    const result = {
      syncedAt: new Date().toISOString(),
      sourceRows: rows.length,
      linked: matched.length + unmatched.length,
      matched: matched.length,
      unmatched: unmatched.length,
      changed,
      items: matched,
      missing: unmatched
    };
    store.meta = store.meta && typeof store.meta === 'object' ? store.meta : {};
    store.meta.moysklad = {
      lastSyncAt: result.syncedAt,
      lastSyncStatus: 'success',
      sourceRows: result.sourceRows,
      linked: result.linked,
      matched: result.matched,
      unmatched: result.unmatched,
      changed: result.changed
    };
    return result;
  }
}

function createMoySkladClient(options) {
  return new MoySkladClient(options);
}

module.exports = { createMoySkladClient, mappingFor, availableStock };
