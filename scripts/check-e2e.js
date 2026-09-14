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
    assert.equal(await page.locator('.product-card').count(), 13);
    const catalogSectionOrder = await page.locator('.catalog-main').evaluate(node => {
      const smart = node.querySelector('#catalogSmart');
      const filters = node.querySelector('#catalogFilters');
      const toolbar = node.querySelector('.toolbar');
      return toolbar.compareDocumentPosition(filters) === Node.DOCUMENT_POSITION_FOLLOWING
        && filters.compareDocumentPosition(smart) === Node.DOCUMENT_POSITION_FOLLOWING;
    });
    assert.equal(catalogSectionOrder, true, 'Catalog order must be search, filters, then categories');
    const catalogFilterLabels = (await page.locator('#catalogFilters summary').allTextContents()).map(label => label.replace(/\s+0$/, '').trim());
    assert.deepEqual(catalogFilterLabels, ['Все фильтры', 'Производитель', 'Вкус']);
    const catalogFilterVisualStyle = await page.locator('#catalogFilters summary').first().evaluate((summary, allProductsLink) => ({
      color: getComputedStyle(summary).color,
      fontSize: getComputedStyle(summary).fontSize,
      borderStyle: getComputedStyle(summary).borderTopStyle,
      referenceColor: getComputedStyle(allProductsLink).color,
      referenceFontSize: getComputedStyle(allProductsLink).fontSize
    }), await page.locator('.catalog-filter-all-link').elementHandle());
    assert.equal(catalogFilterVisualStyle.color, catalogFilterVisualStyle.referenceColor);
    assert.equal(catalogFilterVisualStyle.fontSize, catalogFilterVisualStyle.referenceFontSize);
    assert.equal(catalogFilterVisualStyle.borderStyle, 'none', 'Catalog filter triggers must stay visually light');
    const desktopFilterRowTops = await page.locator('#catalogFilters summary, #catalogFilters .catalog-filter-all-link').evaluateAll(nodes => nodes.map(node => Math.round(node.getBoundingClientRect().top)));
    assert.equal(new Set(desktopFilterRowTops).size, 1, 'Filters and the all-products link must share one desktop row');
    await page.locator('#catalogFilters summary').filter({ hasText: 'Производитель' }).click();
    await page.locator('#catalogFilters input[name="brand"][value="Optimum Nutrition"]').check();
    await page.waitForFunction(() => document.querySelectorAll('#catalogProducts .product-card').length === 2);
    assert.match(page.url(), /brand=Optimum\+Nutrition/);
    assert.equal(await page.locator('.catalog-filter-chip').filter({ hasText: 'Optimum Nutrition' }).count(), 1);
    await page.locator('.catalog-filter-chip').filter({ hasText: 'Optimum Nutrition' }).click();
    await page.waitForFunction(() => document.querySelectorAll('#catalogProducts .product-card').length === 13);
    await page.locator('#catalogFilters summary').filter({ hasText: 'Вкус' }).click();
    await page.locator('#catalogFilters input[name="flavor"][value="Клубника"]').check();
    await page.waitForFunction(() => document.querySelectorAll('#catalogProducts .product-card').length === 2);
    assert.match(page.url(), /flavor=%D0%9A%D0%BB%D1%83%D0%B1%D0%BD%D0%B8%D0%BA%D0%B0/);
    await page.locator('#catalogFilters summary').filter({ hasText: 'Все фильтры' }).click();
    await page.locator('#catalogPriceMin').fill('200');
    await page.waitForFunction(() => document.querySelectorAll('#catalogProducts .product-card').length === 1);
    assert.match(page.url(), /priceMin=200/);
    await page.locator('.catalog-filter-reset').click();
    await page.waitForFunction(() => document.querySelectorAll('#catalogProducts .product-card').length === 13);
    assert.equal(new URL(page.url()).search, '', 'Clear filters must restore the unfiltered catalog URL');
    await page.locator('[data-action="cart"][data-id="1"]').click();
    await page.goto('/cart.html', { waitUntil: 'domcontentloaded' });
    await page.locator('.cart-item').waitFor();
    await page.locator('#promoCode').fill('WELCOME');
    await page.locator('#promoApply').click();
    assert.equal(await page.locator('#cartSummary').getByText(/Промокод WELCOME/).count(), 0, 'Promo must not apply to sale products');
    assert.match(await page.locator('.toast').textContent(), /не действует на акционные товары/i);
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
    assert.deepEqual(await page.locator('#packageOptions .chip').allTextContents(), ['900 г', '2.27 кг']);
    assert.equal(await page.locator('#packageOptions .chip.active').textContent(), '900 г');
    await page.locator('[data-package-product-id="13"]').click();
    await page.waitForURL('**/product.html?id=13');
    assert.equal(await page.locator('#packageOptions .chip.active').textContent(), '2.27 кг');
    assert.equal(await page.locator('#productPrice').textContent(), '249 BYN');

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
    assert.equal(await page.locator('#adminMoySkladMappings tbody tr').count(), 13);
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
    for (const pathname of ['/index.html', '/catalog.html', '/sale.html']) {
      await mobilePage.goto(pathname, { waitUntil: 'domcontentloaded' });
      const productCard = mobilePage.locator('.product-grid .product-card').first();
      await productCard.waitFor();
      const mobileCardStyle = await productCard.evaluate(card => {
        const button = card.querySelector('.card-buttons .btn');
        const price = card.querySelector('.price');
        return {
          cardRadius:getComputedStyle(card).borderRadius,
          cardShadow:getComputedStyle(card).boxShadow,
          buttonRadius:getComputedStyle(button).borderRadius,
          buttonHeight:button.getBoundingClientRect().height,
          buttonFontSize:getComputedStyle(button).fontSize,
          priceWeight:getComputedStyle(price).fontWeight
        };
      });
      assert.equal(mobileCardStyle.cardRadius, '2px', `${pathname} product card must use Swiss radius`);
      assert.equal(mobileCardStyle.cardShadow, 'none', `${pathname} product card must stay flat`);
      assert.equal(mobileCardStyle.buttonRadius, '2px', `${pathname} add-to-cart button must use Swiss radius`);
      assert.equal(mobileCardStyle.buttonHeight, 36, `${pathname} add-to-cart button must keep its compact mobile height`);
      assert.equal(mobileCardStyle.buttonFontSize, '13px', `${pathname} add-to-cart button must keep its mobile typography`);
      assert.equal(mobileCardStyle.priceWeight, '650', `${pathname} price must match desktop weight`);
    }
    await mobilePage.goto('/index.html', { waitUntil: 'domcontentloaded' });
    await mobilePage.locator('[data-burger]').click();
    await mobilePage.locator('[data-mobile-panel].open').waitFor();
    assert.equal(await mobilePage.locator('[data-burger]').getAttribute('aria-expanded'), 'true');
    for (const pathname of ['/catalog.html', '/product.html?id=1', '/cart.html', '/delivery.html']) {
      await assertNoHorizontalOverflow(mobilePage, pathname);
    }
    await mobilePage.goto('/catalog.html', { waitUntil: 'domcontentloaded' });
    await mobilePage.locator('#catalogFilters summary').first().waitFor();
    const mobileFilterLayout = await mobilePage.locator('#catalogFilters summary, #catalogFilters .catalog-filter-all-link').evaluateAll(nodes => nodes.map(node => ({
      top: Math.round(node.getBoundingClientRect().top),
      height: Math.round(node.getBoundingClientRect().height),
      width: Math.round(node.getBoundingClientRect().width)
    })));
    assert.equal(new Set(mobileFilterLayout.map(item => item.top)).size, 1, 'Mobile filter controls must stay on one row');
    mobileFilterLayout.forEach(item => {
      assert.ok(item.height >= 42, 'Mobile filter controls must keep a usable touch target');
      assert.ok(item.width >= 30, 'Mobile filter controls must remain readable');
    });
    await mobilePage.locator('#catalogFilters summary').filter({ hasText: 'Вкус' }).click();
    const mobileCatalogDimensions = await mobilePage.evaluate(() => ({ width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
    assert.ok(mobileCatalogDimensions.scrollWidth <= mobileCatalogDimensions.width + 1, 'Open mobile filter must not create horizontal overflow');
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
