const assert = require('assert/strict');
const fs = require('fs');
const net = require('net');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright-core');

const root = path.resolve(__dirname, '..');
const adminPassword = 'E2eTestPassword!42';

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser'
  ].filter(Boolean);
  return candidates.find(candidate => fs.existsSync(candidate));
}

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

async function waitForServer(baseUrl, child) {
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Server exited with code ${child.exitCode}`);
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return;
    } catch (error) { }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Server did not become ready');
}

async function assertNoHorizontalOverflow(page, pathname) {
  await page.goto(pathname, { waitUntil: 'domcontentloaded' });
  const dimensions = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
  assert.ok(dimensions.scrollWidth <= dimensions.width + 1, `${pathname} overflows horizontally: ${dimensions.scrollWidth}px > ${dimensions.width}px`);
}

async function main() {
  const executablePath = findChrome();
  if (!executablePath) throw new Error('Chrome/Chromium was not found. Set CHROME_PATH to run browser checks.');

  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'byvit-e2e-check-'));
  const port = await freePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ['server.js'], {
    cwd: root,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      PORT: String(port),
      BYVIT_PUBLIC_URL: baseUrl,
      BYVIT_ALLOWED_ORIGINS: baseUrl,
      BYVIT_DATA_DIR: dataDir,
      BYVIT_BACKUP_DIR: path.join(dataDir, 'backups'),
      BYVIT_UPLOAD_DIR: path.join(dataDir, 'uploads'),
      BYVIT_ADMIN_PASSWORD: adminPassword
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let serverOutput = '';
  child.stdout.on('data', chunk => { serverOutput += chunk; });
  child.stderr.on('data', chunk => { serverOutput += chunk; });

  let browser;
  try {
    await waitForServer(baseUrl, child);
    browser = await chromium.launch({ executablePath, headless: true });

    const desktop = await browser.newContext({ baseURL: baseUrl, viewport: { width: 1440, height: 900 } });
    const page = await desktop.newPage();
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') pageErrors.push(message.text()); });

    await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
    await page.locator('.hero').waitFor();
    assert.equal(await page.locator('.hero video source').getAttribute('src'), 'assets/hero-default.mp4');
    assert.equal(await page.locator('a[href="admin.html"]').count(), 0, 'Public homepage must not expose an admin link');
    const homeBlockOrder = await page.locator('main > [data-home-block]').evaluateAll(nodes => nodes.map(node => node.dataset.homeBlock));
    assert.deepEqual(homeBlockOrder, ['categories', 'sale', 'goals', 'brands', 'trust']);
    assert.equal(await page.locator('[data-home-block="trust"]').evaluate(node => getComputedStyle(node).backgroundColor), 'rgb(255, 255, 255)');

    await page.goto('/catalog.html', { waitUntil: 'domcontentloaded' });
    await page.locator('.product-card').first().waitFor();
    assert.equal(await page.locator('.product-card').count(), 12);
    await page.locator('[data-action="cart"][data-id="1"]').click();
    await page.goto('/cart.html', { waitUntil: 'domcontentloaded' });
    await page.locator('.cart-item').waitFor();
    await page.locator('#orderName').fill('E2E Покупатель');
    await page.locator('#orderPhone').fill('+375 29 123-45-67');
    await page.locator('#checkoutForm button[type="submit"]').click();
    await page.locator('#modal.open').waitFor();
    assert.match(await page.locator('[data-modal-title]').textContent(), /спасибо/i);
    assert.equal(await page.locator('.cart-item').count(), 0, 'Cart must clear after a successful order');

    const state = await (await page.request.get('/api/state')).json();
    assert.equal(state.orders.length, 0, 'Public state must not expose customer orders');
    assert.equal(state.products.find(product => Number(product.id) === 1).stock, 14);

    await page.goto('/product.html?id=1', { waitUntil: 'domcontentloaded' });
    await page.locator('[data-product-add="1"]').waitFor();
    assert.match(await page.locator('.product-detail-title').textContent(), /whey protein/i);

    await page.goto('/admin.html', { waitUntil: 'domcontentloaded' });
    await page.locator('#adminPassword').fill(adminPassword);
    await page.locator('#adminLoginForm button[type="submit"]').click();
    await page.locator('#adminPanel').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#adminLogin').isVisible(), false);
    const adminStateResponse = await page.request.get('/api/admin/state');
    assert.equal(adminStateResponse.status(), 200);
    const adminState = await adminStateResponse.json();
    assert.equal(adminState.orders.length, 1);
    await page.locator('[data-admin-tab="moysklad"]').click();
    await page.locator('#admin-moysklad.active').waitFor();
    await page.locator('#adminMoySkladStatus').getByText('Не настроен', { exact: true }).first().waitFor();
    assert.equal(await page.locator('#adminMoySkladMappings tbody tr').count(), 12);
    assert.equal(await page.locator('[data-moysklad-sync]').isDisabled(), true);
    await page.locator('#adminMoySkladMappings [data-moysklad-edit]').first().click();
    await page.locator('#admin-products.active').waitFor();
    assert.equal(await page.locator('#adminProductId').inputValue(), '1');
    assert.deepEqual(pageErrors, [], `Browser page errors: ${pageErrors.join('; ')}`);
    await desktop.close();

    const mobile = await browser.newContext({ baseURL: baseUrl, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const mobilePage = await mobile.newPage();
    const mobileErrors = [];
    mobilePage.on('pageerror', error => mobileErrors.push(error.message));
    mobilePage.on('console', message => { if (message.type() === 'error') mobileErrors.push(message.text()); });
    await assertNoHorizontalOverflow(mobilePage, '/index.html');
    await mobilePage.locator('[data-burger]').click();
    await mobilePage.locator('[data-mobile-panel].open').waitFor();
    assert.equal(await mobilePage.locator('[data-burger]').getAttribute('aria-expanded'), 'true');
    for (const pathname of ['/catalog.html', '/product.html?id=1', '/cart.html', '/delivery.html']) {
      await assertNoHorizontalOverflow(mobilePage, pathname);
    }
    assert.deepEqual(mobileErrors, [], `Mobile page errors: ${mobileErrors.join('; ')}`);
    await mobile.close();

    console.log('Desktop and mobile browser journeys passed.');
  } finally {
    if (browser) await browser.close();
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
