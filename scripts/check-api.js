const assert = require('assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const net = require('net');
const { spawn } = require('child_process');

const root = path.resolve(__dirname, '..');

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const port = probe.address().port;
      probe.close(error => error ? reject(error) : resolve(port));
    });
  });
}

async function request(baseUrl, pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    headers: options.body ? { 'Content-Type': 'application/json', ...(options.headers || {}) } : options.headers,
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const text = await response.text();
  let data = text;
  try { data = text ? JSON.parse(text) : {}; } catch (error) { }
  return { status: response.status, data, headers: response.headers };
}

async function waitForServer(baseUrl, child) {
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Server exited with code ${child.exitCode}`);
    try {
      const health = await request(baseUrl, '/api/health');
      if (health.status === 200) return;
    } catch (error) { }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Server did not become ready');
}

async function main() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'byvit-api-check-'));
  const port = await freePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ['server.js'], {
    cwd: root,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      PORT: String(port),
      BYVIT_DATA_DIR: dataDir,
      BYVIT_BACKUP_DIR: path.join(dataDir, 'backups'),
      BYVIT_UPLOAD_DIR: path.join(dataDir, 'uploads'),
      BYVIT_ADMIN_PASSWORD: 'ApiTestPassword!42',
      BYVIT_TRUST_PROXY: 'true'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let serverOutput = '';
  child.stdout.on('data', chunk => { serverOutput += chunk; });
  child.stderr.on('data', chunk => { serverOutput += chunk; });

  try {
    await waitForServer(baseUrl, child);

    for (const pathname of ['/server.js', '/package.json', '/.git/config', '/data/store.json', '/.env']) {
      const response = await request(baseUrl, pathname);
      assert.equal(response.status, 404, `${pathname} must not be public`);
    }

    const homepage = await request(baseUrl, '/index.html');
    assert.match(homepage.data, new RegExp(`<link rel="canonical" href="${baseUrl}/">`));
    assert.match(homepage.data, /property="og:title"/);
    assert.match(homepage.headers.get('content-security-policy') || '', /object-src 'none'/);
    const productPage = await request(baseUrl, '/product.html?id=1');
    assert.match(productPage.data, new RegExp(`<link rel="canonical" href="${baseUrl}/product.html\\?id=1">`));
    assert.match(productPage.data, /"@type":"Product"/);

    const europostOffices = await request(baseUrl, '/api/europost/offices?q=Минск');
    assert.equal(europostOffices.status, 200);
    assert.ok(europostOffices.data.availableTotal >= 6);
    assert.ok(europostOffices.data.total >= 1);
    assert.equal(europostOffices.data.offices[0].city, 'Минск');
    assert.ok(europostOffices.data.offices[0].id);

    const forgedOrder = {
      items: [{ productId: 1, optionId: '900g', flavor: 'Шоколад', qty: 2, price: 0.01, lineTotal: 0.01 }],
      subtotal: 0.01,
      discount: 999999,
      total: 0.01,
      promo: 'WELCOME',
      deliveryKey: 'pickup',
      pickupStoreId: 'main',
      payment: 'Оплата при получении',
      customer: { name: 'API Test', phone: '+375 29 123-45-67', address: '' }
    };
    const created = await request(baseUrl, '/api/orders', { method: 'POST', body: { order: forgedOrder } });
    assert.equal(created.status, 201, JSON.stringify(created.data));
    assert.equal(created.data.order.subtotal, 258);
    assert.equal(created.data.order.discount, 0, 'Promo codes must not discount sale products');
    assert.equal(created.data.order.total, 258);
    assert.equal(created.data.order.promo, '');
    assert.equal(created.data.order.items[0].price, 129);

    const state = await request(baseUrl, '/api/state');
    assert.equal(state.data.products.find(product => Number(product.id) === 1).stock, 13);
    assert.equal(state.data.products.find(product => Number(product.id) === 13).stock, 15);

    const largePackageOrder = {
      items: [{ productId: 13, optionId: '2270g', flavor: 'Шоколад', qty: 1, price: 0.01 }],
      deliveryKey: 'pickup',
      pickupStoreId: 'main',
      payment: 'Оплата при получении',
      customer: { name: 'Package Variant Test', phone: '+375 29 123-45-67', address: '' }
    };
    const largePackageCreated = await request(baseUrl, '/api/orders', { method: 'POST', body: { order: largePackageOrder } });
    assert.equal(largePackageCreated.status, 201, JSON.stringify(largePackageCreated.data));
    assert.equal(largePackageCreated.data.order.items[0].price, 249);
    assert.equal(largePackageCreated.data.order.total, 249);
    const stateAfterLargePackage = await request(baseUrl, '/api/state');
    assert.equal(stateAfterLargePackage.data.products.find(product => Number(product.id) === 1).stock, 13);
    assert.equal(stateAfterLargePackage.data.products.find(product => Number(product.id) === 13).stock, 14);

    const regularProductOrder = {
      items: [{ productId: 4, optionId: '90caps', flavor: '', qty: 1 }],
      promo: 'WELCOME',
      deliveryKey: 'pickup',
      pickupStoreId: 'main',
      payment: 'Оплата при получении',
      customer: { name: 'Promo Test', phone: '+375 29 123-45-67', address: '' }
    };
    const regularProductCreated = await request(baseUrl, '/api/orders', { method: 'POST', body: { order: regularProductOrder } });
    assert.equal(regularProductCreated.status, 201, JSON.stringify(regularProductCreated.data));
    assert.equal(regularProductCreated.data.order.subtotal, 79);
    assert.equal(regularProductCreated.data.order.discount, 7.9, 'Promo codes must still discount regular products');
    assert.equal(regularProductCreated.data.order.total, 71.1);
    assert.equal(regularProductCreated.data.order.promo, 'WELCOME');

    const europostOrder = {
      items: [{ productId: 4, optionId: '90caps', flavor: '', qty: 1 }],
      deliveryKey: 'europost',
      europostOffice: europostOffices.data.offices[0],
      payment: 'Оплата при получении',
      customer: { name: 'Europost Test', phone: '+375 29 123-45-67', address: 'подменённый адрес' }
    };
    const europostCreated = await request(baseUrl, '/api/orders', { method: 'POST', body: { order: europostOrder } });
    assert.equal(europostCreated.status, 201, JSON.stringify(europostCreated.data));
    assert.equal(europostCreated.data.order.deliveryKey, 'europost');
    assert.equal(europostCreated.data.order.europostOffice.id, europostOffices.data.offices[0].id);
    assert.match(europostCreated.data.order.customer.address, /Отделение №1: г\. Минск/);
    assert.doesNotMatch(europostCreated.data.order.customer.address, /подменённый/);

    const concurrentOrder = {
      items: [{ productId: 2, optionId: '300g', flavor: 'Без вкуса', qty: 14 }],
      deliveryKey: 'pickup',
      pickupStoreId: 'main',
      payment: 'Оплата при получении',
      customer: { name: 'Concurrent Test', phone: '+375 29 123-45-67', address: '' }
    };
    const concurrent = await Promise.all([
      request(baseUrl, '/api/orders', { method: 'POST', body: { order: concurrentOrder } }),
      request(baseUrl, '/api/orders', { method: 'POST', body: { order: concurrentOrder } })
    ]);
    assert.deepEqual(concurrent.map(result => result.status), [201, 201]);
    const stateAfterConcurrentOrders = await request(baseUrl, '/api/state');
    assert.equal(stateAfterConcurrentOrders.data.products.find(product => Number(product.id) === 2).stock, 0);

    const excessive = structuredClone(forgedOrder);
    excessive.items[0].qty = 14;
    const insufficient = await request(baseUrl, '/api/orders', { method: 'POST', body: { order: excessive } });
    assert.equal(insufficient.status, 409);

    const missingProductReview = await request(baseUrl, '/api/reviews', {
      method: 'POST',
      body: { productId: 999999, name: 'Test', rating: 5, text: 'Review' }
    });
    assert.equal(missingProductReview.status, 400);
    const invalidRating = await request(baseUrl, '/api/reviews', {
      method: 'POST',
      body: { productId: 1, name: 'Test', rating: 999, text: 'Review' }
    });
    assert.equal(invalidRating.status, 400);

    const crossOrigin = await request(baseUrl, '/api/orders', {
      method: 'POST',
      headers: { Origin: 'https://attacker.example' },
      body: { order: forgedOrder }
    });
    assert.equal(crossOrigin.status, 403);

    const successfulLogin = await request(baseUrl, '/api/admin/login', {
      method: 'POST',
      headers: { 'X-Forwarded-For': '127.0.0.2' },
      body: { password: 'ApiTestPassword!42' }
    });
    assert.equal(successfulLogin.status, 200);
    const sessionCookie = successfulLogin.headers.get('set-cookie') || '';
    assert.match(sessionCookie, /byvit_admin_session=/);
    assert.match(sessionCookie, /HttpOnly/i);
    assert.match(sessionCookie, /SameSite=Lax/i);
    const adminState = await request(baseUrl, '/api/admin/state', { headers: { Cookie: sessionCookie.split(';')[0] } });
    assert.equal(adminState.status, 200);
    assert.equal(adminState.data.orders.length, 6);
    const moyskladStatus = await request(baseUrl, '/api/admin/moysklad/status', { headers: { Cookie: sessionCookie.split(';')[0] } });
    assert.equal(moyskladStatus.status, 200);
    assert.equal(moyskladStatus.data.configured, false);
    assert.equal(Object.prototype.hasOwnProperty.call(moyskladStatus.data, 'token'), false);
    const moyskladWebhook = await request(baseUrl, '/api/integrations/moysklad/webhook', { method: 'POST' });
    assert.equal(moyskladWebhook.status, 503);
    adminState.data.products[0].moyskladId = 'private-mapping-id';
    const mappedAdminState = await request(baseUrl, '/api/admin/state', {
      method: 'PUT',
      headers: { Cookie: sessionCookie.split(';')[0] },
      body: { products: adminState.data.products }
    });
    assert.equal(mappedAdminState.status, 200);
    const sanitizedPublicState = await request(baseUrl, '/api/state');
    assert.equal(Object.prototype.hasOwnProperty.call(sanitizedPublicState.data.products[0], 'moyskladId'), false);

    const loginStatuses = [];
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const login = await request(baseUrl, '/api/admin/login', { method: 'POST', body: { password: 'wrong' } });
      loginStatuses.push(login.status);
    }
    assert.deepEqual(loginStatuses, [403, 403, 403, 403, 403, 429]);

    console.log('API security and order calculation check passed.');
  } finally {
    child.kill('SIGTERM');
    await new Promise(resolve => {
      if (child.exitCode !== null) resolve();
      else child.once('exit', resolve);
      setTimeout(resolve, 2000).unref();
    });
    fs.rmSync(dataDir, { recursive: true, force: true });
    if (child.exitCode && child.exitCode !== 0 && child.signalCode !== 'SIGTERM') process.stderr.write(serverOutput);
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
