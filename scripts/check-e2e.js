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
  const qaScreenshotDir = String(process.env.BYVIT_E2E_SCREENSHOTS || '').trim();
  if(qaScreenshotDir) fs.mkdirSync(qaScreenshotDir, { recursive: true });
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
    await page.locator('body.home-ready').waitFor();
    assert.equal(await page.title(), 'Спортивное питание и добавки с доставкой по Беларуси - BYVIT');
    assert.equal(await page.locator('meta[property="og:title"]').getAttribute('content'), await page.title());
    assert.equal(await page.locator('link[rel="icon"]').getAttribute('href'), 'assets/favicon.svg?v=9');
    assert.equal(await page.locator('link[rel="icon"]').getAttribute('sizes'), '48x48');
    await page.locator('.hero').waitFor();
    assert.equal(await page.locator('.site-header .brand-mark').isVisible(), false, 'Default header icon must be hidden');
    assert.equal(await page.locator('.site-header .brand-wordmark-img').getAttribute('src'), 'assets/byvit-header-wordmark.svg');
    assert.equal(await page.locator('.site-header .brand-tagline-img').getAttribute('src'), 'assets/byvit-header-tagline.svg');
    assert.equal(await page.locator('.site-header .brand-tagline-img').isVisible(), false);
    assert.equal(await page.locator('.site-header .brand-desktop-logo img').getAttribute('src'), 'assets/byvit-desktop-logo.png');
    await page.locator('.site-header .brand-desktop-logo img').evaluate(image => image.decode());
    const desktopLockup = await page.locator('.site-header .brand-lockup').evaluate(node => ({width:node.getBoundingClientRect().width, gap:getComputedStyle(node).gap}));
    assert.ok(Math.abs(desktopLockup.width - 211.2) < 1);
    assert.equal(desktopLockup.gap, '10px');
    const footerLockup = await page.locator('.footer-wordmark').evaluate(node => ({width:node.getBoundingClientRect().width, height:node.getBoundingClientRect().height, image:node.querySelector('.footer-wordmark-image')?.getAttribute('src'), filter:getComputedStyle(node.querySelector('.footer-wordmark-image')).filter}));
    assert.ok(Math.abs(footerLockup.width - desktopLockup.width * .5) < 1, 'Desktop footer logo must be half the header size');
    assert.ok(Math.abs(footerLockup.height - 19.78) < 1, 'Desktop footer logo must retain its original footprint');
    assert.equal(footerLockup.image, 'assets/byvit-footer-logo.png');
    assert.equal(footerLockup.filter, 'none', 'Footer artwork must retain its supplied beige color');
    if(qaScreenshotDir) await page.locator('.footer').screenshot({path:path.join(qaScreenshotDir, 'footer-desktop.png')});
    await page.setViewportSize({ width:1200, height:814 });
    const desktopHeaderFit = await page.evaluate(() => document.querySelector('.site-header .brand').getBoundingClientRect().right < document.querySelector('.site-header .main-nav').getBoundingClientRect().left);
    assert.equal(desktopHeaderFit, true, 'Larger desktop logo must not overlap navigation at 1200px');
    await page.setViewportSize({ width:1440, height:900 });
    if(qaScreenshotDir) await page.locator('.site-header').screenshot({ path:path.join(qaScreenshotDir, 'header-desktop.png') });
    assert.equal(await page.locator('.hero .hero-desktop-media').getAttribute('src'), 'assets/hero-default.webp');
    await page.locator('.hero .hero-desktop-media').evaluate(image => image.decode());
    assert.equal(await page.locator('.hero').getAttribute('data-align'), 'left');
    assert.equal(await page.locator('#heroEyebrow').textContent(), 'Больше, чем добавки');
    assert.equal(await page.locator('#heroTitle').innerText(), 'Забота о себе в каждой детали');
    assert.equal(await page.locator('#heroText').innerText(), 'Качественные добавки для энергии, здоровья и баланса');
    assert.equal(await page.locator('a[href="admin.html"]').count(), 0, 'Public homepage must not expose an admin link');
    const homeBlockOrder = await page.locator('main > [data-home-block]').evaluateAll(nodes => nodes.map(node => node.dataset.homeBlock));
    assert.deepEqual(homeBlockOrder, ['categories', 'sale', 'goals', 'brands', 'trust']);
    for(const width of [1440, 1200, 1000]){
      await page.setViewportSize({width, height:900});
      const sizes = [];
      for(const tab of ['sale', 'featured']){
        await page.locator(`[data-home-product-tab="${tab}"]`).click();
        sizes.push(await page.locator(`#${tab === 'sale' ? 'sale' : 'featured'}Products .product-card`).first().evaluate(card => {
          const box = card.getBoundingClientRect();
          return {width:box.width, height:box.height};
        }));
      }
      assert.ok(Math.abs(sizes[0].width - sizes[1].width) < 1 && Math.abs(sizes[0].height - sizes[1].height) < 1, `Home product tabs must have matching card sizes at ${width}px: ${JSON.stringify(sizes)}`);
    }
    await page.setViewportSize({width:1440, height:900});
    await page.locator('[data-home-product-tab="sale"]').click();
    assert.equal(await page.locator('[data-home-block="trust"]').evaluate(node => getComputedStyle(node).backgroundColor), 'rgb(255, 255, 255)');
    await page.locator('#homeGoals .goal-card').first().waitFor();
    assert.equal(await page.locator('#homeGoals .goal-card').count(), 6);
    const desktopGoalLayout = await page.locator('#homeGoals .goal-card').evaluateAll(cards => cards.map(card => {
      const box = card.getBoundingClientRect();
      const icon = card.querySelector('.desktop-goal-icon').getBoundingClientRect();
      const heading = card.querySelector('h3').getBoundingClientRect();
      const copy = card.querySelector('p').getBoundingClientRect();
      return { top:card.offsetTop, border:getComputedStyle(card).borderTopWidth, icon:getComputedStyle(card.querySelector('.desktop-goal-icon')).display, iconCenterOffset:Math.abs((icon.top + icon.bottom - box.top - box.bottom) / 2), textSpacingDiff:Math.abs((heading.top - box.top) - (box.bottom - copy.bottom)) };
    }));
    assert.equal(new Set(desktopGoalLayout.slice(0, 3).map(card => card.top)).size, 1, 'Desktop goals must form a three-column first row');
    assert.ok(desktopGoalLayout[3].top > desktopGoalLayout[0].top && desktopGoalLayout.every(card => card.border === '1px' && card.icon !== 'none' && card.iconCenterOffset <= 2 && card.textSpacingDiff <= 7));
    assert.equal(await page.locator('#homeGoals .desktop-goal-action').count(), 0);
    assert.equal(await page.locator('#homeGoals .figma-goal-arrow').first().evaluate(node => getComputedStyle(node).display), 'none');
    assert.equal(await page.locator('#homeGoals .goal-card').first().locator('.desktop-goal-icon rect').count(), 4, 'Mass goal needs a symmetric dumbbell icon');
    await page.locator('#homeGoals .goal-card').first().hover();
    assert.equal(await page.locator('#homeGoals .goal-card').first().evaluate(node => getComputedStyle(node).borderTopColor), 'rgb(18, 61, 48)');
    assert.equal(await page.locator('[data-home-block="brands"] .home-section-link').textContent(), 'Все бренды');
    assert.equal(await page.locator('#homeBrands').evaluate(node => getComputedStyle(node).borderTopWidth), '1px');
    await page.locator('#homeBrands .brand-card').nth(1).hover();
    await page.waitForFunction(() => getComputedStyle(document.querySelector('#homeBrands .brand-card:nth-child(2)')).outlineColor === 'rgb(18, 61, 48)');
    assert.equal(await page.locator('#homeBrands .brand-card').nth(1).evaluate(node => getComputedStyle(node).outlineWidth), '1px');
    const textBrandCard = page.locator('#homeBrands .brand-card:not(.has-image)').first();
    for(const width of [1440, 1200]){
      await page.setViewportSize({width, height:900});
      const alignment = await textBrandCard.evaluate(card => {
        const box = card.getBoundingClientRect();
        const media = card.querySelector('.brand-media').getBoundingClientRect();
        const label = card.querySelector('.brand-letter').getBoundingClientRect();
        return {mediaOffset:Math.abs((media.top + media.bottom - box.top - box.bottom) / 2), labelOffset:Math.abs((label.top + label.bottom - box.top - box.bottom) / 2), align:getComputedStyle(card.querySelector('.brand-letter')).alignItems};
      });
      assert.ok(alignment.mediaOffset <= 2 && alignment.labelOffset <= 2 && alignment.align === 'center', `Text-only brand must be vertically centered at ${width}px: ${JSON.stringify(alignment)}`);
    }
    await page.setViewportSize({width:1440, height:900});
    assert.equal(await page.locator('#homeTrust').evaluate(node => getComputedStyle(node).gridTemplateColumns.split(' ').length), 4);
    assert.equal(await page.locator('#homeTrust .desktop-trust-top span').count(), 0);
    assert.equal(await page.locator('#homeTrust .desktop-trust-top svg').count(), 4);
    if(qaScreenshotDir){
      for(const [block, file] of [['goals','home-goals-desktop.png'], ['brands','home-brands-desktop.png'], ['trust','home-trust-desktop.png']]){
        const section = page.locator(`[data-home-block="${block}"]`);
        await section.scrollIntoViewIfNeeded();
        await page.waitForTimeout(500);
        await section.screenshot({path:path.join(qaScreenshotDir, file)});
      }
    }

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
    await page.locator('#catalogFilters summary').filter({ hasText: 'Все фильтры' }).click();
    assert.equal(await page.locator('[data-filter-menu]').first().getAttribute('open'), '');
    await page.locator('.page-hero h1').click();
    assert.equal(await page.locator('[data-filter-menu][open]').count(), 0, 'An open catalog filter must close after an outside click');
    await page.locator('#catalogFilters summary').filter({ hasText: 'Все фильтры' }).click();
    await page.locator('#catalogSearch').fill('про');
    await page.locator('#catalogSearchPanel').waitFor({ state: 'visible' });
    assert.equal(await page.locator('[data-filter-menu][open]').count(), 0, 'Search suggestions must close an open catalog filter');
    const desktopSearchOverlay = await page.evaluate(() => {
      const panel = document.querySelector('#catalogSearchPanel');
      const coversFilters = [...document.querySelectorAll('#catalogFilters summary')].every(summary => {
        const box = summary.getBoundingClientRect();
        return Boolean(document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)?.closest('#catalogSearchPanel'));
      });
      return {
        background: getComputedStyle(panel).backgroundColor,
        coversFilters
      };
    });
    assert.equal(desktopSearchOverlay.background, 'rgb(254, 253, 251)');
    assert.equal(desktopSearchOverlay.coversFilters, true, 'Desktop search suggestions must cover the filter row');
    await page.locator('#catalogSearch').fill('');
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
    const firstCatalogCartButton = page.locator('[data-action="cart"][data-id="1"]');
    assert.equal((await firstCatalogCartButton.textContent()).trim(), 'В корзину');
    await firstCatalogCartButton.click();
    assert.equal((await firstCatalogCartButton.textContent()).trim(), 'В корзине');
    await page.waitForTimeout(250);
    assert.equal(await firstCatalogCartButton.evaluate(button => getComputedStyle(button).backgroundColor), 'rgb(254, 253, 251)');
    await firstCatalogCartButton.click();
    assert.equal((await firstCatalogCartButton.textContent()).trim(), 'В корзину');
    assert.equal(await page.locator('[data-count="cart"]').first().textContent(), '');
    await firstCatalogCartButton.click();
    assert.equal((await firstCatalogCartButton.textContent()).trim(), 'В корзине');
    await page.goto('/cart.html', { waitUntil: 'domcontentloaded' });
    await page.locator('.cart-item').waitFor();
    assert.equal(await page.locator('.cart-item-img').first().evaluate(image => getComputedStyle(image).borderRadius), '2px');
    assert.equal(await page.locator('.cart-item.has-sale-price').count(), 1);
    assert.match(await page.locator('.cart-item.has-sale-price .cart-item-old-price').textContent(), /149 BYN/);
    assert.match(await page.locator('.cart-item.has-sale-price .cart-price-badge-sale').textContent(), /хит/i);
    await page.locator('#promoCode').fill('WELCOME');
    await page.locator('#promoApply').click();
    assert.equal(await page.locator('#cartSummary').getByText(/Промокод WELCOME/).count(), 0, 'Promo must not apply to sale products');
    assert.match(await page.locator('.toast').textContent(), /не действует на акционные товары/i);
    await page.goto('/catalog.html', { waitUntil: 'domcontentloaded' });
    await page.locator('[data-action="cart"][data-id="4"]').click();
    await page.goto('/cart.html', { waitUntil: 'domcontentloaded' });
    await page.locator('#promoCode').fill('WELCOME');
    await page.locator('#promoApply').click();
    assert.equal(await page.locator('.cart-item.has-promo-price').count(), 1, 'Promo badge must identify only eligible products');
    assert.match(await page.locator('.cart-item.has-promo-price .cart-price-badge-promo').textContent(), /WELCOME.*10%/i);
    assert.match(await page.locator('.cart-item.has-promo-price .cart-promo-note').textContent(), /7,90 BYN/);
    assert.equal(await page.locator('.cart-item.has-sale-price.has-promo-price').count(), 0, 'Sale products must remain excluded from promo discounts');
    assert.match(await page.locator('#cartSummary').textContent(), /Промокод WELCOME/);
    assert.match(await page.locator('.delivery-option-price').first().textContent(), /Бесплатно/);
    await page.locator('.delivery-option:has(input[name="delivery"][value="europost"])').click();
    await page.locator('#europostOfficeOptions').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#orderAddress').isVisible(), false, 'Free-form address must be hidden for Europost');
    assert.equal(await page.locator('#europostOfficeDropdown').isVisible(), false, 'Europost list must start collapsed');
    const closedPickerBox = await page.locator('#europostOfficeOptions').boundingBox();
    await page.locator('#europostOfficeToggle').click();
    await page.locator('#europostOfficeDropdown').waitFor({ state: 'visible' });
    const openPickerBox = await page.locator('#europostOfficeOptions').boundingBox();
    assert.equal(Math.round(openPickerBox.x), Math.round(closedPickerBox.x), 'Europost picker must not shift horizontally when opened');
    assert.equal(Math.round(openPickerBox.width), Math.round(closedPickerBox.width), 'Europost picker width must stay fixed');
    const officeListOverflow = await page.locator('#europostOfficeList').evaluate(list => ({
      overflowX:getComputedStyle(list).overflowX,
      scrollbarWidth:getComputedStyle(list).scrollbarWidth
    }));
    assert.equal(officeListOverflow.overflowX, 'hidden');
    assert.equal(officeListOverflow.scrollbarWidth, 'none');
    await page.locator('#europostOfficeSearch').fill('Минск');
    await page.locator('.europost-office').first().waitFor();
    await page.locator('.europost-office').first().click();
    assert.equal(await page.locator('#europostOfficeDropdown').isVisible(), false, 'Selecting an office must collapse the list');
    assert.match(await page.locator('#europostOfficeToggleText').textContent(), /Отделение №1/);
    await page.locator('#europostOfficeClear').click();
    assert.match(await page.locator('#europostOfficeToggleText').textContent(), /Выберите отделение/);
    await page.locator('#europostOfficeToggle').click();
    await page.locator('.europost-office').first().click();
    if(qaScreenshotDir) await page.locator('.cart-layout').screenshot({ path:path.join(qaScreenshotDir, 'cart-pricing-desktop.png') });
    await page.locator('#orderName').fill('E2E Покупатель');
    await page.locator('#orderPhone').fill('+375 29 123-45-67');
    await page.locator('#checkoutForm button[type="submit"]').click();
    await page.locator('#modal.open').waitFor();
    assert.match(await page.locator('[data-modal-title]').textContent(), /спасибо/i);
    assert.equal(await page.locator('.cart-item').count(), 0, 'Cart must clear after a successful order');
    await page.goto('/catalog.html', { waitUntil: 'domcontentloaded' });
    assert.equal((await page.locator('[data-action="cart"][data-id="1"]').textContent()).trim(), 'В корзину');

    const state = await (await page.request.get('/api/state')).json();
    assert.equal(state.orders.length, 0, 'Public state must not expose customer orders');
    assert.equal(state.products.find(product => Number(product.id) === 1).stock, 14);

    await page.goto('/product.html?id=1', { waitUntil: 'domcontentloaded' });
    await page.locator('[data-product-add="1"]').waitFor();
    const desktopDetailCartButton = page.locator('[data-product-add="1"]');
    assert.equal(await desktopDetailCartButton.textContent(), 'Добавить в корзину');
    await desktopDetailCartButton.click();
    assert.equal(await desktopDetailCartButton.textContent(), 'В корзине');
    await page.waitForTimeout(250);
    assert.equal(await desktopDetailCartButton.evaluate(button => getComputedStyle(button).backgroundColor), 'rgb(254, 253, 251)');
    await desktopDetailCartButton.click();
    assert.equal(await desktopDetailCartButton.textContent(), 'Добавить в корзину');
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
    assert.equal(adminState.orders[0].deliveryKey, 'europost');
    assert.match(adminState.orders[0].customer.address, /Отделение №1: г\. Минск/);
    assert.match(await page.locator('[data-hero-control="src"]').textContent(), /2560 × 1024 px/);
    assert.match(await page.locator('[data-mobile-hero-control="src"]').textContent(), /1200 × 650 px/);
    await page.locator('[data-mobile-home-field="heroTitle"]').fill('Тест мобильного баннера');
    await page.locator('[data-mobile-home-item="trust"]').first().locator('[data-mobile-item-field="title"]').fill('Тестовое преимущество');
    await page.locator('#adminSiteForm button[type="submit"]').click();
    await page.waitForFunction(async () => (await (await fetch('/api/state')).json()).site.mobileHome?.heroTitle === 'Тест мобильного баннера');
    await page.locator('[data-admin-tab="quick-contact"]').click();
    await page.locator('#admin-quick-contact.active').waitFor();
    await page.locator('#stockContactPhone').fill('+375 29 111-22-33');
    await page.locator('#stockContactTelegram').fill('@byvit_support');
    await page.locator('#quickContactButtonColor').fill('#804020');
    await page.locator('#adminQuickContactForm button[type="submit"]').click();
    await page.waitForTimeout(600);
    const contactState = await (await page.request.get('/api/state')).json();
    assert.equal(contactState.site.stockContact.phone, '+375 29 111-22-33');
    assert.equal(contactState.site.stockContact.telegram, '@byvit_support');
    assert.equal(contactState.site.quickContact.buttonColor, '#804020');
    assert.equal(await page.locator('.quick-contact-button').evaluate(node => getComputedStyle(node).backgroundColor), 'rgb(128, 64, 32)');
    assert.equal(await page.locator('#quickContactButtonColor').evaluate(node => Math.round(node.getBoundingClientRect().width)), 48);
    await page.locator('[data-admin-tab="delivery"]').click();
    await page.locator('#admin-delivery.active').waitFor();
    const courierCard = page.locator('[data-delivery-method-key="delivery"]');
    await courierCard.locator('[data-delivery-method-price]').fill('12.50');
    await page.locator('#adminDeliveryForm button[type="submit"]').click();
    await page.waitForTimeout(600);
    const deliveryState = await (await page.request.get('/api/state')).json();
    assert.equal(deliveryState.site.deliveryMethods.delivery.price, 12.5, 'Admin must persist the delivery price');
    await page.goto('/catalog.html', { waitUntil: 'domcontentloaded' });
    await page.locator('[data-action="cart"][data-id="4"]').click();
    await page.goto('/cart.html', { waitUntil: 'domcontentloaded' });
    await page.locator('#promoCode').fill('WELCOME');
    await page.locator('#promoApply').click();
    await page.locator('.delivery-option:has(input[name="delivery"][value="delivery"])').click();
    assert.match(await page.locator('.delivery-option:has(input[value="delivery"]) .delivery-option-price').textContent(), /12,50 BYN/);
    assert.match(await page.locator('#cartSummary').textContent(), /12,50 BYN/);
    assert.match(await page.locator('#cartSummary .summary-total').textContent(), /83,60 BYN/, 'Delivery must be added after the promo discount');
    await page.locator('#orderName').fill('Доставка Test');
    await page.locator('#orderPhone').fill('+375 29 765-43-21');
    await page.locator('#orderAddress').fill('Минск, тестовый адрес 1');
    await page.locator('#checkoutForm button[type="submit"]').click();
    await page.locator('#modal.open').waitFor();
    await page.goto('/admin.html', { waitUntil: 'domcontentloaded' });
    await page.locator('#adminPanel').waitFor({ state: 'visible' });
    const paidDeliveryAdminState = await (await page.request.get('/api/admin/state')).json();
    assert.equal(paidDeliveryAdminState.orders.length, 2);
    assert.equal(paidDeliveryAdminState.orders[0].discount, 7.9);
    assert.equal(paidDeliveryAdminState.orders[0].deliveryPrice, 12.5);
    assert.equal(paidDeliveryAdminState.orders[0].total, 83.6, 'Server total must keep delivery outside the promo discount');
    await page.locator('[data-admin-tab="moysklad"]').click();
    await page.locator('#admin-moysklad.active').waitFor();
    await page.locator('#adminMoySkladStatus').getByText('Не настроен', { exact: true }).first().waitFor();
    assert.equal(await page.locator('#adminMoySkladMappings tbody tr').count(), 13);
    assert.equal(await page.locator('[data-moysklad-sync]').isDisabled(), true);
    await page.locator('#adminMoySkladMappings [data-moysklad-edit]').first().click();
    await page.locator('#admin-products.active').waitFor();
    assert.equal(await page.locator('#adminProductId').inputValue(), '1');
    assert.equal(await page.locator('#adminProductImages [data-product-image-item]').count(), 1);
    const galleryUploads = [
      ['product-side.svg', '#dbe8d8'],
      ['product-back.svg', '#e7dfcf'],
      ['product-label.svg', '#d9e1ea'],
      ['product-detail.svg', '#ead8d8']
    ].map(([name, color], index) => ({
      name,
      mimeType:'image/svg+xml',
      buffer:Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600"><rect width="600" height="600" fill="${color}"/><text x="300" y="315" text-anchor="middle" font-family="Arial" font-size="54" fill="#2d5a27">BYVIT ${index + 2}</text></svg>`)
    }));
    await page.locator('#adminImageUpload').setInputFiles(galleryUploads);
    await page.waitForFunction(() => document.querySelectorAll('#adminProductImages [data-product-image-item]').length === 5);
    assert.equal(await page.locator('#adminImageUpload').isDisabled(), true, 'Product editor must limit the gallery to five images');
    await page.locator('[data-product-image-primary]').last().check();
    assert.equal(await page.locator('[data-product-image-item].is-primary').count(), 1);
    if(qaScreenshotDir) await page.locator('.admin-product-images-section').screenshot({ path:path.join(qaScreenshotDir, 'admin-product-images.png') });
    const selectedPrimaryImage = await page.locator('[data-product-image-item].is-primary [data-product-image-src]').inputValue();
    await page.locator('#adminProductForm button[type="submit"]').click();
    await page.waitForTimeout(600);
    const savedGalleryState = await (await page.request.get('/api/state')).json();
    const savedGalleryProduct = savedGalleryState.products.find(item => Number(item.id) === 1);
    assert.equal(savedGalleryProduct.images.length, 5);
    assert.equal(savedGalleryProduct.images[0], selectedPrimaryImage);
    await page.goto('/product.html?id=1', { waitUntil: 'domcontentloaded' });
    await page.locator('.gallery-thumbs button').first().waitFor();
    assert.equal(await page.locator('.gallery-thumbs button').count(), 5);
    assert.equal(await page.locator('#mainProductImage').getAttribute('src'), selectedPrimaryImage);
    const desktopThumbTops = await page.locator('.gallery-thumbs button').evaluateAll(nodes => nodes.map(node => Math.round(node.getBoundingClientRect().top)));
    assert.equal(new Set(desktopThumbTops).size, 1, 'Desktop product thumbnails must stay on one line');
    const secondGalleryImage = await page.locator('.gallery-thumbs button').nth(1).getAttribute('data-gallery');
    await page.locator('.gallery-thumbs button').nth(1).click();
    assert.equal(await page.locator('#mainProductImage').getAttribute('src'), secondGalleryImage);
    assert.equal(await page.locator('.gallery-thumbs button').nth(1).getAttribute('aria-pressed'), 'true');
    if(qaScreenshotDir) await page.locator('.product-gallery').screenshot({ path:path.join(qaScreenshotDir, 'product-gallery-desktop.png') });
    const outOfStockState = await (await page.request.get('/api/admin/state')).json();
    outOfStockState.products.find(item => Number(item.id) === 3).stock = 0;
    const saveOutOfStock = await page.request.put('/api/admin/state', { data:outOfStockState });
    assert.equal(saveOutOfStock.status(), 200);
    await page.goto('/product.html?id=3', { waitUntil: 'domcontentloaded' });
    const stockContactToggle = page.locator('[data-stock-contact-toggle]');
    await stockContactToggle.waitFor();
    assert.match(await stockContactToggle.textContent(), /Уточнить по наличию/);
    const desktopContactAlignment = await page.locator('.product-panel, [data-stock-contact-toggle]').evaluateAll(nodes => nodes.map(node => ({right:node.getBoundingClientRect().right})));
    assert.ok(Math.abs(desktopContactAlignment[0].right - desktopContactAlignment[1].right) <= 3, 'Availability contact must align to the right edge of the product panel');
    await stockContactToggle.click();
    await page.locator('[data-stock-contact-menu]').waitFor({ state:'visible' });
    assert.equal(await page.locator('.stock-contact-action').first().getAttribute('href'), 'tel:+375291112233');
    assert.equal(await page.locator('.stock-contact-action').nth(1).getAttribute('href'), 'https://t.me/byvit_support');
    assert.equal(await page.locator('[data-product-add="3"]').isDisabled(), true);
    await page.locator('.gallery-main').click();
    assert.equal(await page.locator('[data-stock-contact-menu]').isVisible(), false, 'Availability contact menu must close after an outside click');
    assert.deepEqual(pageErrors, [], `Browser page errors: ${pageErrors.join('; ')}`);
    await desktop.close();

    const mobile = await browser.newContext({ baseURL: baseUrl, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const mobilePage = await mobile.newPage();
    const mobileErrors = [];
    mobilePage.on('pageerror', error => mobileErrors.push(error.message));
    mobilePage.on('console', message => { if (message.type() === 'error') mobileErrors.push(message.text()); });
    await assertNoHorizontalOverflow(mobilePage, '/index.html');
    assert.equal(await mobilePage.locator('#homeGoals .desktop-goal-icon').first().evaluate(node => getComputedStyle(node).display), 'none');
    assert.equal(await mobilePage.locator('#homeTrust .desktop-trust-top').first().evaluate(node => getComputedStyle(node).display), 'none');
    assert.equal(await mobilePage.locator('.site-header .brand-mark').isVisible(), false);
    assert.equal(await mobilePage.locator('.site-header .brand-wordmark-img').isVisible(), false);
    assert.equal(await mobilePage.locator('.site-header .brand-mobile-logo').isVisible(), true);
    assert.equal(await mobilePage.locator('.site-header .brand-mobile-logo img').getAttribute('src'), 'assets/byvit-mobile-logo.png');
    assert.equal(await mobilePage.locator('.site-header .brand-tagline-img').isVisible(), false);
    const mobileLockup = await mobilePage.locator('.site-header .brand-lockup').evaluate(node => ({width:node.getBoundingClientRect().width, display:getComputedStyle(node).display}));
    assert.ok(Math.abs(mobileLockup.width - 105.6) < 1 && mobileLockup.display === 'flex');
    assert.ok(Math.abs(await mobilePage.locator('.site-header .brand-lockup').evaluate(node => node.getBoundingClientRect().height) - 11.18) < 1, 'Mobile logo must retain its previous footprint');
    const headerControls = await mobilePage.locator('.site-header .burger, .site-header .brand, .site-header .header-search-trigger, .site-header .header-contact-trigger').evaluateAll(nodes => nodes.map(node => ({left:node.getBoundingClientRect().left, center:node.getBoundingClientRect().left + node.getBoundingClientRect().width / 2, visible:getComputedStyle(node).display !== 'none'})));
    assert.equal(headerControls.length, 4);
    assert.ok(headerControls.every(item => item.visible));
    assert.ok(headerControls[1].left < headerControls[0].left && headerControls[0].left < headerControls[2].left && headerControls[2].left < headerControls[3].left, 'Mobile header must show menu, centered logo, search, and contact in order');
    assert.ok(Math.abs(headerControls[0].center - 195) < 2, 'Mobile wordmark must be centered');
    assert.match(await mobilePage.locator('.header-contact-trigger').getAttribute('href'), /^tel:/);
    await mobilePage.evaluate(() => window.scrollTo(0, 650));
    await mobilePage.waitForFunction(() => window.scrollY >= 600);
    const stickyState = await mobilePage.locator('.site-header').evaluate(node => ({top:node.getBoundingClientRect().top, position:getComputedStyle(node).position, bodyOverflowX:getComputedStyle(document.body).overflowX, bodyOverflowY:getComputedStyle(document.body).overflowY, scrollY:window.scrollY}));
    assert.ok(Math.abs(stickyState.top) < 1, `Mobile header must remain visible while scrolling: ${JSON.stringify(stickyState)}`);
    await mobilePage.evaluate(() => window.scrollTo(0, 0));
    assert.equal(await mobilePage.locator('.footer-wordmark').evaluate(node => node.getBoundingClientRect().width), mobileLockup.width);
    assert.equal(await mobilePage.locator('.footer-wordmark').isVisible(), false, 'Mobile footer logo must be hidden without collapsing its spacing');
    assert.ok(Math.abs(await mobilePage.locator('.footer-wordmark').evaluate(node => node.getBoundingClientRect().height) - 11.18) < 1);
    if(qaScreenshotDir) await mobilePage.locator('.site-header').screenshot({ path:path.join(qaScreenshotDir, 'header-mobile.png') });
    assert.equal(await mobilePage.locator('.mv-hero h1').textContent(), 'Тест мобильного баннера');
    assert.equal(await mobilePage.locator('.mv-trust-list article h3').first().textContent(), 'Тестовое преимущество');
    assert.equal(await mobilePage.locator('.mv-trust-list article').first().evaluate(node => getComputedStyle(node).backgroundColor), 'rgb(255, 255, 255)');
    assert.deepEqual(await mobilePage.locator('.mv-product-card').evaluateAll(nodes => nodes.slice(0, 2).map(node => node.dataset.productId)), ['1','2']);
    const homeCardSize = await mobilePage.locator('.mv-product-card').first().evaluate(card => ({width:card.getBoundingClientRect().width, height:card.getBoundingClientRect().height}));
    assert.equal(await mobilePage.locator('.mv-goal-list a').count(), 6);
    assert.match(await mobilePage.locator('.mv-goal-list a[href*="category=joints"] use').getAttribute('href'), /#joints$/);
    assert.match(await mobilePage.locator('.mv-goal-list a[href*="category=vitamins"] use').getAttribute('href'), /#shield$/);
    assert.deepEqual(await mobilePage.locator('.mobile-bottom-nav a > span:nth-child(2)').allTextContents(), ['Главная', 'Каталог', 'Акции', 'Корзина', 'Магазины']);
    assert.equal(await mobilePage.locator('.mobile-bottom-nav a[href="sale.html"] .bottom-nav-icon').textContent(), '%');
    assert.equal(await mobilePage.locator('.mobile-bottom-nav a:first-child .bottom-nav-icon').evaluate(icon => getComputedStyle(icon).fontSize), '24px');
    await mobilePage.locator('.mobile-bottom-nav a[href="sale.html"]').click();
    assert.equal(new URL(mobilePage.url()).pathname, '/sale.html');
    assert.equal(await mobilePage.locator('.mobile-bottom-nav a.active').getAttribute('href'), 'sale.html');
    for (const pathname of ['/index.html', '/catalog.html', '/sale.html']) {
      await mobilePage.goto(pathname, { waitUntil: 'domcontentloaded' });
      const redesignedHome = pathname === '/index.html';
      const productCard = redesignedHome
        ? mobilePage.locator('.mv-product-card').first()
        : mobilePage.locator('.product-grid .product-card').first();
      await productCard.waitFor();
      const mobileCardStyle = await productCard.evaluate((card, isRedesignedHome) => {
        const button = card.querySelector(isRedesignedHome ? '.mv-card-cart' : '.card-buttons .btn');
        const price = card.querySelector(isRedesignedHome ? '.mv-card-price strong' : '.price');
        return {
          cardRadius:getComputedStyle(card).borderRadius,
          cardShadow:getComputedStyle(card).boxShadow,
          buttonRadius:getComputedStyle(button).borderRadius,
          buttonHeight:button.getBoundingClientRect().height,
          buttonFontSize:getComputedStyle(button).fontSize,
          priceWeight:getComputedStyle(price).fontWeight
        };
      }, redesignedHome);
      assert.equal(mobileCardStyle.cardRadius, '2px', `${pathname} product card must use Swiss radius`);
      assert.equal(mobileCardStyle.cardShadow, 'none', `${pathname} product card must stay flat`);
      assert.equal(mobileCardStyle.buttonRadius, '2px', `${pathname} add-to-cart button must use the shared square radius`);
      assert.equal(mobileCardStyle.buttonHeight, 38, `${pathname} add-to-cart button must keep its specified mobile height`);
      if(!redesignedHome) assert.equal(mobileCardStyle.buttonFontSize, '13px', `${pathname} add-to-cart button must keep its mobile typography`);
      assert.equal(mobileCardStyle.priceWeight, '600', `${pathname} price must match the current brand typography`);
      if(pathname === '/sale.html') assert.equal(await productCard.evaluate(card => getComputedStyle(card).minHeight), '0px', 'Sale cards must not retain extra space below their content');
    }
    await mobilePage.goto('/index.html', { waitUntil: 'domcontentloaded' });
    await mobilePage.locator('[data-burger]').click();
    await mobilePage.locator('[data-mobile-panel].open').waitFor();
    assert.equal(await mobilePage.locator('[data-burger]').getAttribute('aria-expanded'), 'true');
    for (const pathname of ['/catalog.html', '/product.html?id=1', '/cart.html', '/delivery.html']) {
      await assertNoHorizontalOverflow(mobilePage, pathname);
    }
    await mobilePage.goto('/catalog.html', { waitUntil: 'domcontentloaded' });
    assert.equal(await mobilePage.locator('.mobile-card-wishlist').count(), 0, 'Mobile catalog must not overlay wishlist controls on product images');
    await mobilePage.locator('[data-action="cart"][data-id="1"]').click();
    await mobilePage.locator('[data-action="cart"][data-id="4"]').click();
    await mobilePage.goto('/cart.html', { waitUntil: 'domcontentloaded' });
    assert.equal(await mobilePage.locator('#cartList .cart-item-product-link').first().getAttribute('href'), 'product.html?id=1');
    assert.equal(await mobilePage.locator('#cartList .cart-item-info h3 a').first().getAttribute('href'), 'product.html?id=1');
    assert.equal(await mobilePage.locator('#cartList .cart-remove-icon').first().isVisible(), true);
    assert.equal(await mobilePage.locator('#cartList .cart-remove-label').first().isVisible(), false);
    const cartRadii = await mobilePage.evaluate(() => ['.mobile-panel', '.page-hero', '#promoCode', '#promoApply'].map(selector => getComputedStyle(document.querySelector(selector)).borderRadius));
    assert.deepEqual(cartRadii, ['2px', '2px', '2px', '2px']);
    await mobilePage.locator('#cartList .cart-item-product-link').first().click();
    assert.equal(new URL(mobilePage.url()).pathname + new URL(mobilePage.url()).search, '/product.html?id=1');
    await mobilePage.goBack({ waitUntil: 'domcontentloaded' });
    await mobilePage.locator('#cartList .cart-price-badge').first().click();
    assert.equal(new URL(mobilePage.url()).pathname + new URL(mobilePage.url()).search, '/product.html?id=1');
    await mobilePage.goBack({ waitUntil: 'domcontentloaded' });
    await mobilePage.locator('#promoCode').fill('WELCOME');
    await mobilePage.locator('#promoApply').click();
    await mobilePage.locator('.delivery-option:has(input[name="delivery"][value="europost"])').click();
    await mobilePage.locator('#europostOfficeOptions').waitFor({ state: 'visible' });
    await mobilePage.locator('#europostOfficeToggle').click();
    await mobilePage.locator('#europostOfficeDropdown').waitFor({ state: 'visible' });
    await mobilePage.locator('#europostOfficeSearch').fill('Брест');
    await mobilePage.locator('.europost-office').first().waitFor();
    await mobilePage.locator('.europost-office').first().click();
    assert.equal(await mobilePage.locator('.cart-item.has-sale-price').count(), 1);
    assert.equal(await mobilePage.locator('.cart-item.has-promo-price').count(), 1);
    assert.equal(await mobilePage.locator('.cart-item-img').first().evaluate(image => getComputedStyle(image).borderRadius), '2px');
    await mobilePage.locator('#europostOfficeToggle').click();
    const mobileCartDimensions = await mobilePage.evaluate(() => ({ width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
    assert.ok(mobileCartDimensions.scrollWidth <= mobileCartDimensions.width + 1, 'Open Europost picker must not create horizontal overflow');
    if(qaScreenshotDir) await mobilePage.locator('.cart-layout').screenshot({ path:path.join(qaScreenshotDir, 'cart-pricing-mobile.png') });
    await mobilePage.goto('/product.html?id=4', { waitUntil: 'domcontentloaded' });
    await mobilePage.locator('.product-detail-title').waitFor();
    await mobilePage.goto('/product.html?id=1', { waitUntil: 'domcontentloaded' });
    assert.equal(await mobilePage.locator('.gallery-thumbs button').count(), 5);
    const productTabs = await mobilePage.locator('.tab-buttons').evaluate(tabs => ({scrollbarWidth:getComputedStyle(tabs).scrollbarWidth, scrolls:tabs.scrollWidth > tabs.clientWidth}));
    assert.deepEqual(productTabs, {scrollbarWidth:'none', scrolls:true});
    for(const selector of ['#similarProducts .product-card', '#recentProducts .product-card']){
      const size = await mobilePage.locator(selector).first().evaluate(card => ({width:card.getBoundingClientRect().width, height:card.getBoundingClientRect().height}));
      assert.deepEqual(size, homeCardSize, `${selector} must match the mobile home card size`);
    }
    const detailCartButton = mobilePage.locator('[data-product-add="1"]');
    assert.equal(await detailCartButton.textContent(), 'В корзине');
    await detailCartButton.click();
    assert.equal(await detailCartButton.textContent(), 'Добавить в корзину');
    await detailCartButton.click();
    assert.equal(await detailCartButton.textContent(), 'В корзине');
    await mobilePage.locator('#flavorOptions [data-flavor="Ваниль"]').click();
    assert.equal(await detailCartButton.textContent(), 'Добавить в корзину');
    await mobilePage.locator('#flavorOptions [data-flavor="Шоколад"]').click();
    assert.equal(await detailCartButton.textContent(), 'В корзине');
    const mobileThumbTops = await mobilePage.locator('.gallery-thumbs button').evaluateAll(nodes => nodes.map(node => Math.round(node.getBoundingClientRect().top)));
    assert.equal(new Set(mobileThumbTops).size, 1, 'Mobile product thumbnails must stay on one horizontal line');
    if(qaScreenshotDir) await mobilePage.locator('.product-gallery').screenshot({ path:path.join(qaScreenshotDir, 'product-gallery-mobile.png') });
    await mobilePage.goto('/product.html?id=4', { waitUntil: 'domcontentloaded' });
    await mobilePage.locator('#packageOptions .chip.active').waitFor();
    const mobileProductControls = await mobilePage.evaluate(() => {
      const style = selector => getComputedStyle(document.querySelector(selector)).borderRadius;
      return {
        packageRadius:style('#packageOptions .chip.active'),
        cartRadius:style('[data-product-add]'),
        wishlistRadius:style('[data-action="wishlist"]'),
        compareRadius:style('[data-action="compare"]'),
        wishlistIcon:document.querySelector('[data-action="wishlist"] .header-action-glyph')?.outerHTML || '',
        compareIcon:document.querySelector('[data-action="compare"] .header-action-glyph')?.outerHTML || ''
      };
    });
    assert.deepEqual({
      packageRadius:mobileProductControls.packageRadius,
      cartRadius:mobileProductControls.cartRadius,
      wishlistRadius:mobileProductControls.wishlistRadius,
      compareRadius:mobileProductControls.compareRadius
    }, {packageRadius:'2px', cartRadius:'2px', wishlistRadius:'2px', compareRadius:'2px'});
    assert.match(mobileProductControls.wishlistIcon, /M12 20\.2/);
    assert.match(mobileProductControls.compareIcon, /M5 8h13/);
    await mobilePage.locator('.product-panel [data-action="wishlist"]').click();
    assert.equal(await mobilePage.locator('.product-panel [data-action="wishlist"] .header-action-glyph').count(), 1, 'Wishlist action must retain the shared header icon after changing state');
    await mobilePage.locator('.product-panel [data-action="compare"]').click();
    assert.equal(await mobilePage.locator('.product-panel [data-action="compare"] .header-action-glyph').count(), 1, 'Compare action must retain the shared header icon after changing state');
    assert.equal(await mobilePage.locator('.page-hero').evaluate(node => getComputedStyle(node).borderRadius), '2px');
    const footerAndNav = await mobilePage.evaluate(() => {
      const footer = document.querySelector('.footer');
      const nav = document.querySelector('.mobile-bottom-nav');
      return {
        navBorder:getComputedStyle(nav).borderTopWidth,
        footerBeforeNav:Boolean(footer.compareDocumentPosition(nav) & Node.DOCUMENT_POSITION_FOLLOWING)
      };
    });
    assert.deepEqual(footerAndNav, {navBorder:'0px', footerBeforeNav:true});
    await mobilePage.goto('/product.html?id=3', { waitUntil: 'domcontentloaded' });
    await mobilePage.locator('[data-stock-contact-toggle]').click();
    await mobilePage.locator('[data-stock-contact-menu]').waitFor({ state:'visible' });
    const mobileStockContactDimensions = await mobilePage.evaluate(() => ({ width:document.documentElement.clientWidth, scrollWidth:document.documentElement.scrollWidth }));
    assert.ok(mobileStockContactDimensions.scrollWidth <= mobileStockContactDimensions.width + 1, 'Availability contact menu must not create mobile horizontal overflow');
    await mobilePage.setViewportSize({ width: 319, height: 730 });
    await mobilePage.goto('/catalog.html', { waitUntil: 'domcontentloaded' });
    const bottomNavFits = await mobilePage.locator('.mobile-bottom-nav').evaluate(nav => {
      const navRect = nav.getBoundingClientRect();
      return [...nav.querySelectorAll('a')].every(link => {
        const rect = link.getBoundingClientRect();
        return rect.left >= navRect.left && rect.right <= navRect.right;
      });
    });
    assert.equal(bottomNavFits, true, 'Five bottom-navigation items must fit at 319px');
    await mobilePage.locator('#catalogFilters summary').first().waitFor();
    assert.equal(await mobilePage.locator('#catalogSort').isVisible(), false, 'Catalog sorting must be hidden on mobile');
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
    const filterBarBox = await mobilePage.locator('#catalogFilters').boundingBox();
    const triggerBoxes = await mobilePage.locator('#catalogFilters summary').evaluateAll(nodes => nodes.map(node => ({
      x: Math.round(node.getBoundingClientRect().x),
      width: Math.round(node.getBoundingClientRect().width)
    })));
    for(let index = 0; index < 3; index += 1){
      await mobilePage.locator('#catalogFilters summary').nth(index).click();
      const openMenu = mobilePage.locator('[data-filter-menu][open]');
      assert.equal(await openMenu.count(), 1);
      const popoverBox = await openMenu.locator('.catalog-filter-popover').boundingBox();
      const openTriggerBox = await mobilePage.locator('#catalogFilters summary').nth(index).boundingBox();
      assert.ok(popoverBox.x >= filterBarBox.x - 1, `Mobile filter ${index + 1} must not move beyond the left catalog edge`);
      assert.ok(popoverBox.x + popoverBox.width <= filterBarBox.x + filterBarBox.width + 1, `Mobile filter ${index + 1} must not move beyond the right catalog edge`);
      assert.ok(Math.abs(Math.round(openTriggerBox.x) - triggerBoxes[index].x) <= 1, `Mobile filter trigger ${index + 1} must not visibly shift when opened`);
      await mobilePage.locator('.page-hero h1').click();
      assert.equal(await mobilePage.locator('[data-filter-menu][open]').count(), 0);
    }
    await mobilePage.locator('#catalogSearch').fill('про');
    await mobilePage.locator('#catalogSearchPanel').waitFor({ state: 'visible' });
    const mobileSearchOverlay = await mobilePage.evaluate(() => {
      const panel = document.querySelector('#catalogSearchPanel');
      const coversFilters = [...document.querySelectorAll('#catalogFilters summary')].every(summary => {
        const box = summary.getBoundingClientRect();
        return Boolean(document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)?.closest('#catalogSearchPanel'));
      });
      return {
        background: getComputedStyle(panel).backgroundColor,
        coversFilters
      };
    });
    assert.equal(mobileSearchOverlay.background, 'rgb(254, 253, 251)');
    assert.equal(mobileSearchOverlay.coversFilters, true, 'Mobile search suggestions must cover the filter row');
    const mobileCatalogDimensions = await mobilePage.evaluate(() => ({ width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
    assert.ok(mobileCatalogDimensions.scrollWidth <= mobileCatalogDimensions.width + 1, 'Open mobile filters must not create horizontal overflow');
    assert.deepEqual(mobileErrors, [], `Mobile page errors: ${mobileErrors.join('; ')}`);
    await mobile.close();

    const updates = await browser.newContext({ baseURL: baseUrl, viewport: { width: 1440, height: 900 } });
    const updatePage = await updates.newPage();
    await updatePage.goto('/admin.html', { waitUntil: 'domcontentloaded' });
    await updatePage.locator('#adminPassword').fill(adminPassword);
    await updatePage.locator('#adminLoginForm button[type="submit"]').click();
    await updatePage.locator('#adminPanel').waitFor({ state: 'visible' });
    const expandedState = await (await updatePage.request.get('/api/admin/state')).json();
    const productTemplate = expandedState.products[0];
    expandedState.products.push(...Array.from({ length: 22 }, (_, index) => ({
      ...productTemplate,
      id:1000 + index,
      name:`Тест пагинации ${index + 1}`,
      slug:`pagination-test-${index + 1}`
    })));
    expandedState.site.homeGallery = [
      {id:'qa-gallery-1', src:'assets/home-mobile-hero.jpg', alt:'Фото 1', caption:'Подпись первого фото'},
      {id:'qa-gallery-2', src:'assets/home-mobile-hero.jpg', alt:'Фото 2', caption:'Подпись второго фото'}
    ];
    const expandedSave = await updatePage.request.put('/api/admin/state', {data:expandedState});
    assert.equal(expandedSave.status(), 200, 'Expanded catalog and gallery data must save');
    await updatePage.reload({waitUntil:'domcontentloaded'});
    await updatePage.locator('#adminHomeGalleryStoryTitle').fill('BYVIT — МАГАЗИН СПОРТИВНОГО ПИТАНИЯ');
    await updatePage.locator('#adminHomeGalleryStoryText').fill('Оригинальные добавки для ваших целей.\nПоможем с выбором и получением заказа.');
    await updatePage.locator('#adminHomeGalleryStoryButtonText').fill('О магазинах');
    await updatePage.locator('#adminSiteForm button[type="submit"]').click();
    await updatePage.waitForFunction(async () => (await (await fetch('/api/state')).json()).site.homeGalleryStoryTitle === 'BYVIT — МАГАЗИН СПОРТИВНОГО ПИТАНИЯ');
    await updatePage.goto('/index.html', {waitUntil:'domcontentloaded'});
    await updatePage.waitForFunction(() => document.querySelector('#homeGalleryStoryTitle')?.textContent === 'BYVIT — МАГАЗИН СПОРТИВНОГО ПИТАНИЯ');
    assert.equal(await updatePage.locator('#homeGalleryStoryTitle').textContent(), 'BYVIT — МАГАЗИН СПОРТИВНОГО ПИТАНИЯ');
    assert.equal(await updatePage.locator('#homeGalleryStoryTitle').evaluate(node => getComputedStyle(node).textTransform), 'none');
    assert.equal(await updatePage.locator('#homeGalleryStoryTitle .home-gallery-title-logo').isVisible(), true);
    assert.equal(await updatePage.locator('#homeGalleryStoryTitle image').getAttribute('href'), 'assets/byvit-store-logo.png');
    assert.match(await updatePage.locator('#homeGalleryStoryText').textContent(), /Поможем с выбором/);
    assert.equal(await updatePage.locator('#homeGalleryStoryButton').textContent(), 'О магазинах');
    assert.equal(await updatePage.locator('#homeGalleryStoryButton').getAttribute('href'), 'stores.html');
    assert.equal(await updatePage.locator('#homeGalleryControls').count(), 0, 'Gallery must not show arrow controls');
    const galleryColumns = await updatePage.locator('.home-gallery-copy, .home-gallery-media').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().toJSON()));
    assert.ok(galleryColumns[0].right < galleryColumns[1].left, 'Desktop gallery must place text left of the photo');
    assert.equal(await updatePage.locator('#homeGallery').evaluate(rail => rail.scrollWidth > rail.clientWidth), true, 'Photo rail must be horizontally scrollable');
    assert.equal(await updatePage.locator('.home-gallery-item').nth(1).locator('.home-gallery-caption').textContent(), 'Подпись второго фото');
    assert.equal(await updatePage.locator('.home-gallery-caption').first().isVisible(), false, 'Desktop copy must be separate from photos');
    assert.equal(await updatePage.locator('.home-gallery-dots').isVisible(), true);
    const galleryDotStyle = await updatePage.locator('.home-gallery-dots button').first().evaluate(dot => ({width:getComputedStyle(dot).width, height:getComputedStyle(dot).height, radius:getComputedStyle(dot).borderRadius, color:getComputedStyle(dot).color}));
    assert.deepEqual(galleryDotStyle, {width:'8px', height:'8px', radius:'0px', color:'rgb(17, 61, 48)'});
    await updatePage.locator('#homeGallerySection').scrollIntoViewIfNeeded();
    await updatePage.locator('.home-gallery-head.is-revealed').waitFor();
    await updatePage.waitForTimeout(600);
    if(qaScreenshotDir) await updatePage.locator('#homeGallerySection').screenshot({path:path.join(qaScreenshotDir, 'home-gallery-desktop.png')});
    await updatePage.locator('[data-gallery-index="1"]').click();
    await updatePage.waitForFunction(() => document.querySelector('#homeGallery').scrollLeft > 0);
    await updatePage.locator('[data-gallery-index="0"]').click();
    await updatePage.waitForFunction(() => document.querySelector('#homeGallery').scrollLeft === 0);
    const galleryBox = await updatePage.locator('#homeGallery').boundingBox();
    await updatePage.mouse.move(galleryBox.x + galleryBox.width * .75, galleryBox.y + galleryBox.height * .5);
    await updatePage.mouse.down();
    await updatePage.mouse.move(galleryBox.x + galleryBox.width * .2, galleryBox.y + galleryBox.height * .5, {steps:8});
    await updatePage.mouse.up();
    await updatePage.waitForFunction(() => document.querySelector('#homeGallery').scrollLeft > 0, null, {timeout:3000});
    assert.equal(await updatePage.locator('.product-card .circle-action .card-action-glyph').count() > 0, true);
    await updatePage.goto('/catalog.html?sort=popular', {waitUntil:'domcontentloaded'});
    await updatePage.locator('#catalogProducts .product-card').first().waitFor();
    assert.equal(await updatePage.locator('#catalogProducts .product-card').count(), 30);
    assert.equal(await updatePage.locator('#catalogPagination').isVisible(), true);
    await updatePage.locator('#catalogPagination [aria-label="Страница 2"]').click();
    assert.match(updatePage.url(), /sort=popular.*page=2/);
    assert.equal(await updatePage.locator('#catalogProducts .product-card').count(), 5);
    await updatePage.goBack();
    assert.equal(await updatePage.locator('#catalogProducts .product-card').count(), 30, 'Browser back must restore the first page');
    await updatePage.goForward();
    assert.equal(await updatePage.locator('#catalogProducts .product-card').count(), 5, 'Browser forward must restore the second page');
    await updatePage.locator('#catalogSort').selectOption('price-asc');
    assert.equal(new URL(updatePage.url()).searchParams.has('page'), false, 'Sort change must reset pagination');
    assert.equal(await updatePage.locator('#catalogProducts .product-card').count(), 30);
    await updatePage.goto('/catalog.html?page=99', {waitUntil:'domcontentloaded'});
    await updatePage.locator('#catalogProducts .product-card').first().waitFor();
    assert.equal(new URL(updatePage.url()).searchParams.get('page'), '2', 'Out-of-range page must clamp');
    await updatePage.goto('/catalog.html', {waitUntil:'domcontentloaded'});
    assert.equal(await updatePage.locator('.mobile-card-wishlist').count(), 0);
    await updatePage.locator('.footer-wordmark').hover();
    const footerWordmarkDecoration = await updatePage.locator('.footer-wordmark').evaluate(element => getComputedStyle(element).textDecorationLine);
    assert.equal(footerWordmarkDecoration, 'none');
    await updates.close();

    const galleryMobile = await browser.newContext({baseURL:baseUrl, viewport:{width:390,height:844}, isMobile:true, hasTouch:true});
    const galleryMobilePage = await galleryMobile.newPage();
    await galleryMobilePage.goto('/index.html', {waitUntil:'domcontentloaded'});
    await galleryMobilePage.locator('.home-gallery-item').first().waitFor();
    assert.equal(await galleryMobilePage.locator('.home-gallery-story').isVisible(), true, 'Mobile store story must appear below its photo');
    assert.equal(await galleryMobilePage.locator('#homeGalleryStoryTitle').textContent(), 'BYVIT — МАГАЗИН СПОРТИВНОГО ПИТАНИЯ');
    assert.equal(await galleryMobilePage.locator('#homeGalleryStoryTitle .home-gallery-title-logo').isVisible(), true);
    assert.equal(await galleryMobilePage.locator('#homeGalleryStoryTitle image').getAttribute('href'), 'assets/byvit-store-logo.png');
    assert.match(await galleryMobilePage.locator('#homeGalleryStoryText').textContent(), /Поможем с выбором/);
    const galleryMobileLayout = await galleryMobilePage.locator('.home-gallery-head, .home-gallery-media, .home-gallery-story').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().toJSON()));
    assert.ok(galleryMobileLayout[0].bottom <= galleryMobileLayout[2].top && galleryMobileLayout[2].bottom <= galleryMobileLayout[1].top, 'Mobile store block must read title, photo, then story');
    const mobilePhoto = await galleryMobilePage.locator('.home-gallery-item').first().boundingBox();
    assert.ok(Math.abs(mobilePhoto.height / mobilePhoto.width - 9 / 16) < .02, 'Mobile store photo must keep its original 16:9 size');
    assert.equal(await galleryMobilePage.locator('.home-gallery-caption').first().evaluate(node => getComputedStyle(node).clipPath), 'inset(50%)');
    assert.equal(await galleryMobilePage.locator('#homeGalleryControls').count(), 0);
    assert.deepEqual(await galleryMobilePage.locator('.home-gallery-dots button').first().evaluate(dot => ({width:getComputedStyle(dot).width, height:getComputedStyle(dot).height, radius:getComputedStyle(dot).borderRadius, color:getComputedStyle(dot).color, fontSize:getComputedStyle(dot).fontSize, background:getComputedStyle(dot).backgroundColor, panelBackground:getComputedStyle(dot.parentElement).backgroundColor})), {width:'8px', height:'8px', radius:'0px', color:'rgb(17, 61, 48)', fontSize:'12px', background:'rgba(0, 0, 0, 0)', panelBackground:'rgba(0, 0, 0, 0)'});
    await galleryMobilePage.locator('#homeGallerySection').scrollIntoViewIfNeeded();
    await galleryMobilePage.locator('.home-gallery-head.is-revealed').waitFor();
    await galleryMobilePage.waitForTimeout(600);
    if(qaScreenshotDir) await galleryMobilePage.locator('#homeGallerySection').screenshot({path:path.join(qaScreenshotDir, 'home-gallery-mobile.png')});
    await galleryMobile.close();

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
