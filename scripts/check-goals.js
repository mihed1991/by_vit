const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const net = require('net');
const {spawn} = require('child_process');
const {chromium} = require('playwright-core');

const root = path.resolve(__dirname, '..');
const password = 'GoalTestPassword!42';
const screenshots = process.env.BYVIT_E2E_SCREENSHOTS;
async function freePort(){
  const server = net.createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}
async function noOverflow(page){
  const bounds = await page.evaluate(() => ({width:document.documentElement.clientWidth, scroll:document.documentElement.scrollWidth}));
  assert.ok(bounds.scroll <= bounds.width + 1, `${page.url()} overflows: ${JSON.stringify(bounds)}`);
}
async function main(){
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'byvit-goals-check-'));
  const port = await freePort();
  const baseURL = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ['server.js'], {
    cwd:root,
    env:{...process.env,NODE_ENV:'test',PORT:String(port),BYVIT_PUBLIC_URL:baseURL,BYVIT_ALLOWED_ORIGINS:baseURL,BYVIT_DATA_DIR:directory,BYVIT_BACKUP_DIR:path.join(directory,'backups'),BYVIT_UPLOAD_DIR:path.join(directory,'uploads'),BYVIT_ADMIN_PASSWORD:password},
    stdio:['ignore','pipe','pipe']
  });
  let browser;
  let output = '';
  child.stderr.on('data', chunk => { output += chunk; });
  child.stdout.on('data', chunk => { output += chunk; });
  try{
    for(let attempt=0;attempt<80;attempt++){
      try{ if((await fetch(`${baseURL}/api/health`)).ok) break; }catch(error){}
      if(child.exitCode !== null) throw new Error(output);
      await new Promise(resolve => setTimeout(resolve,100));
    }
    const state = await (await fetch(`${baseURL}/api/state`)).json();
    const originalProducts = structuredClone(state.products);
    const defaults = {window:{}};
    require('vm').runInNewContext(fs.readFileSync(path.join(root,'js/data.js'),'utf8'), defaults);
    state.site.goals ||= structuredClone(defaults.window.ByVitDefaults.site.goals);
    const legacyMass = state.site.goals.find(goal=>goal.id==='mass');
    delete legacyMass.productIds;
    legacyMass.href = 'catalog.html?category=protein';
    const recovery = state.site.goals.find(goal => goal.id === 'recovery');
    recovery.productIds = [2,4,5,999999];
    recovery.description = 'Первый абзац.\n\nВторой абзац <script> — обычный текст.';
    recovery.seoTitle = 'Восстановление — тестовая подборка | ByVit';
    state.site.goals.push({id:'empty-test',title:'Пустая подборка',text:'Товары скоро появятся',productIds:[]});
    state.site.goals.push({id:'disabled-test',title:'Скрытая цель',productIds:[1],enabled:false});
    state.site.goals.push({id:'custom-test',title:'Своя ссылка',href:'catalog.html?category=minerals',productIds:[]});
    const many = Array.from({length:35},(_,index)=>({...structuredClone(state.products[0]),id:1000+index,name:`Тестовый товар ${index+1}`}));
    state.products.push(...many);
    state.site.goals.push({id:'many-test',title:'Большая подборка с длинным названием для адаптивной проверки',productIds:many.map(product=>product.id)});
    const executablePath = [process.env.CHROME_PATH,'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/usr/bin/google-chrome','/usr/bin/chromium'].filter(Boolean).find(file=>fs.existsSync(file));
    browser = await chromium.launch({executablePath,headless:true});
    const context = await browser.newContext({baseURL,viewport:{width:1384,height:900}});
    await context.route('**/api/state', route => route.fulfill({json:state}));
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error=>errors.push(error.message));
    await page.goto('/catalog.html');
    await page.locator('#catalogProducts .product-card').first().waitFor();
    assert.equal(await page.locator('#catalogSmart').count(),0);
    await page.locator('#catalogSearch').fill('Magnesium');
    await page.waitForURL('**/catalog.html?q=Magnesium');
    assert.match(page.url(),/q=Magnesium/);
    assert.ok(await page.locator('#catalogProducts .product-card').count()<30);
    assert.equal(await page.locator('#catalogProducts .product-card[data-product-id="5"]').count(),1);
    await page.locator('#catalogSearch').fill('');
    await page.waitForURL('**/catalog.html');
    await page.locator('#catalogSort').selectOption('price-desc');
    await page.waitForURL('**/catalog.html?sort=price-desc');
    const mostExpensive = state.products.toSorted((a,b)=>b.price-a.price)[0];
    assert.equal(await page.locator('#catalogProducts .product-card').first().getAttribute('data-product-id'),String(mostExpensive.id));
    assert.equal(await page.locator('#catalogCategoryContext').isVisible(),false);
    const top = await page.locator('#catalogProducts').evaluate(node=>node.getBoundingClientRect().top);
    assert.ok(top < 500, 'Products must appear before the old category matrix occupied the screen');
    if(screenshots){ fs.mkdirSync(screenshots,{recursive:true}); await page.screenshot({path:path.join(screenshots,'catalog-clean-desktop.png')}); }
    await page.goto('/catalog.html?category=protein');
    await page.locator('#catalogCategoryContext').waitFor();
    await page.locator('#catalogCategoryContext').getByRole('link',{name:'Изолят',exact:true}).click();
    await page.locator('#catalogProducts .product-card').first().waitFor();
    assert.match(page.url(),/category=protein/);
    assert.match(page.url(),/q=whey/);
    const subgroupIds = await page.locator('#catalogProducts .product-card').evaluateAll(nodes=>nodes.map(node=>Number(node.dataset.productId)));
    assert.deepEqual(subgroupIds.slice(0,2),[1,13]);
    assert.ok(subgroupIds.every(id=>state.products.find(product=>product.id===id)?.category==='protein'), 'Subgroups must stay within their category');
    await page.goto('/goals.html');
    await page.locator('.goal-selection-card').first().waitFor();
    assert.equal(await page.getByRole('link',{name:/Набор массы Протеин/}).getAttribute('href'),'goal.html?id=mass');
    assert.equal(await page.getByText('Скрытая цель',{exact:true}).count(),0);
    assert.equal(await page.getByRole('link',{name:/Своя ссылка/}).getAttribute('href'),'catalog.html?category=minerals');
    if(screenshots){ await page.waitForTimeout(800); await page.screenshot({path:path.join(screenshots,'goals-index-desktop.png')}); }
    await page.getByRole('link',{name:/Восстановление BCAA/}).click();
    await page.locator('#catalogProducts .product-card').first().waitFor();
    assert.deepEqual(await page.locator('#catalogProducts .product-card').evaluateAll(nodes=>nodes.map(node=>Number(node.dataset.productId))),[2,4,5]);
    assert.equal(await page.title(),recovery.seoTitle);
    assert.ok((await page.locator('link[rel="canonical"]').getAttribute('href')).endsWith('/goal.html?id=recovery'));
    assert.equal(await page.locator('#goalDescription p').count(),2);
    assert.equal(await page.locator('#goalDescription script').count(),0);
    assert.equal(await page.locator('#goalNavigation').getAttribute('open'),'');
    assert.equal(await page.locator('#catalogSearch, #catalogSearchPanel').count(),0);
    assert.ok(await page.locator('[data-header-search-form]').count()>0);
    await noOverflow(page);
    if(screenshots){ await page.waitForTimeout(800); await page.screenshot({path:path.join(screenshots,'goal-desktop.png')}); }
    assert.equal(await page.locator('#catalogSort, .toolbar').count(),0);
    const layout = await page.locator('.catalog-main').evaluate(node=>({
      top:node.getBoundingClientRect().top,
      filtersTop:node.querySelector('#catalogFilters').getBoundingClientRect().top,
      filtersMargin:parseFloat(getComputedStyle(node.querySelector('#catalogFilters')).marginTop)
    }));
    assert.ok(Math.abs(layout.filtersTop-layout.top-layout.filtersMargin)<1,'Goal filters must start at the top of the content with only their standard margin');
    await page.goto('/goal.html?id=recovery&q=Magnesium');
    await page.locator('#catalogProducts .product-card').first().waitFor();
    assert.equal(await page.locator('#catalogProducts .product-card').count(),1);
    await page.locator('.catalog-filter-menu-all > summary').click();
    await page.locator('#stockOnly').check();
    await page.waitForURL('**/goal.html?id=recovery&q=Magnesium&stock=1');
    assert.match(page.url(),/q=Magnesium/,'Subgroup links must retain their query when applying filters without a search input');
    assert.equal(await page.locator('#catalogProducts .product-card').count(),1);
    await page.locator('.catalog-filter-menu-all [data-clear-filters]').click();
    assert.ok(!new URL(page.url()).searchParams.has('q'));
    assert.equal(await page.locator('#catalogProducts .product-card').count(),3);
    await page.goto('/goal.html?id=recovery&q=не%20существует');
    await page.getByRole('heading',{name:'По этим фильтрам товаров нет'}).waitFor();
    await page.getByRole('link',{name:'Сбросить фильтры',exact:true}).click();
    await page.locator('#catalogProducts .product-card').first().waitFor();
    await page.locator('[data-action="cart"][data-id="2"]').click();
    await page.goto('/cart.html');
    assert.match(await page.locator('main').textContent(),/Creatine Monohydrate/);
    await page.goto('/goal.html?id=empty-test');
    await page.getByRole('heading',{name:'Подборка пока пустая'}).waitFor();
    for(const id of ['does-not-exist','disabled-test']){
      await page.goto(`/goal.html?id=${id}`);
      await page.getByRole('heading',{name:'Подборка не найдена'}).waitFor();
      assert.equal(await page.locator('meta[name="robots"]').first().getAttribute('content'),'noindex, nofollow');
    }
    await page.goto('/goal.html?id=many-test');
    await page.locator('.product-card').first().waitFor();
    assert.equal(await page.locator('.product-card').count(),30);
    await page.getByRole('button',{name:'Страница 2',exact:true}).click();
    assert.equal(await page.locator('.product-card').count(),5);
    assert.match(page.url(),/id=many-test.*page=2/);
    await page.goBack();
    assert.equal(await page.locator('.product-card').count(),30);
    for(const width of [320,375,432,820,1100]){
      await page.setViewportSize({width,height:width===820?390:804});
      await page.goto('/goals.html');
      await page.locator('.goal-selection-card').first().waitFor();
      await noOverflow(page);
      await page.goto('/goal.html?id=recovery');
      await page.locator('.product-card').first().waitFor();
      assert.equal(await page.locator('#goalNavigation').getAttribute('open'),null);
      await page.locator('#goalNavigation > summary').click();
      await page.locator('#goalNavigation nav a').first().waitFor();
      const targets = await page.locator('#goalNavigation nav a').evaluateAll(nodes=>nodes.map(node=>node.getBoundingClientRect().height));
      assert.ok(targets.every(height=>height>=48));
      await page.locator('#goalNavigation > summary').press('Enter');
      assert.equal(await page.locator('#goalNavigation').getAttribute('open'),null);
      assert.equal(await page.locator('#catalogSort').count(),0);
      assert.equal(await page.locator('#catalogSearch').count(),0);
      assert.equal(await page.locator('.toolbar').count(),0);
      await noOverflow(page);
      if(screenshots && width===375){ await page.waitForTimeout(800); await page.screenshot({path:path.join(screenshots,'goal-mobile.png')}); }
    }
    await page.setViewportSize({width:1101,height:900});
    assert.equal(await page.locator('#catalogSort, .toolbar').count(),0);
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.goto('/goal.html?id=many-test');
    await page.locator('.product-card').first().waitFor();
    await noOverflow(page);
    assert.deepEqual(errors,[]);
    await context.close();

    // Admin persistence uses only the isolated test store, not production data.
    const adminContext = await browser.newContext({baseURL,viewport:{width:1440,height:900}});
    const admin = await adminContext.newPage();
    await admin.goto('/admin.html');
    await admin.locator('#adminPassword').fill(password);
    await admin.locator('#adminLoginForm button[type="submit"]').click();
    await admin.locator('[data-admin-tab="goals"]').click();
    const card = admin.locator('[data-goal-key="recovery"]');
    await card.locator('[data-goal-product]').first().waitFor();
    for(const input of await card.locator('[data-goal-product]').all()) if(await input.isChecked()) await input.uncheck();
    await card.locator('[data-goal-product][value="2"]').check();
    await card.locator('[data-goal-product][value="5"]').check();
    await card.locator('[data-goal-product-search]').fill('Magnesium');
    assert.equal(await card.locator('[data-goal-product-option]:visible').count(),1);
    await card.locator('[data-goal-title]').fill('Восстановление после нагрузки');
    await card.locator('.admin-goal-details > summary').click();
    await card.locator('[data-goal-description]').fill('Обновлённый текст подборки.');
    assert.deepEqual(await card.locator('[data-goal-product]:checked').evaluateAll(inputs=>inputs.map(input=>Number(input.value))),[2,5], 'Admin selection before save');
    const saving = admin.waitForRequest(request=>request.method()==='PUT' && request.url().endsWith('/api/admin/state'));
    await admin.locator('#adminGoalsForm button[type="submit"]').click();
    const payload = (await saving).postDataJSON();
    assert.deepEqual(payload.site.goals.find(goal=>goal.id==='recovery').productIds,[2,5], 'Selection in persisted request');
    await admin.waitForFunction(async()=>{
      const state = await (await fetch('/api/state')).json();
      return state.site.goals?.some(goal=>goal.id==='recovery' && goal.title==='Восстановление после нагрузки');
    });
    const saved = await (await admin.request.get('/api/state')).json();
    assert.deepEqual(saved.site.goals.find(goal=>goal.id==='recovery').productIds,[2,5]);
    assert.deepEqual(saved.products,originalProducts,'Selecting products for a goal must not mutate the catalog');
    await admin.reload();
    await admin.locator('[data-admin-tab="goals"]').click();
    assert.equal(await admin.locator('[data-goal-key="recovery"] [data-goal-product]:checked').count(),2);
    const detail = await admin.request.get('/goal.html?id=recovery');
    assert.match(await detail.text(), /<title>Восстановление после нагрузки — подбор добавок \| ByVit<\/title>/);
    await admin.goto('/goal.html?id=recovery');
    await admin.locator('.product-card').first().waitFor();
    assert.deepEqual(await admin.locator('.product-card').evaluateAll(nodes=>nodes.map(node=>Number(node.dataset.productId))),[2,5]);
    const sitemap = await (await admin.request.get('/sitemap.xml')).text();
    assert.match(sitemap,/goal.html\?id=recovery/);
    await adminContext.close();
    console.log('Goals: catalog context, cross-category selection, pagination/back, cart, empty/disabled states, responsive navigation, SEO and admin persistence passed.');
  }finally{
    if(browser) await browser.close();
    child.kill('SIGTERM');
    await new Promise(resolve=>child.exitCode!==null?resolve():child.once('exit',resolve));
    fs.rmSync(directory,{recursive:true,force:true});
  }
}
main().catch(error=>{ console.error(error); process.exitCode=1; });
